const { Pool } = require('pg');
const { runMigration } = require('./migrations-manager');

// PostgreSQL 연결 풀 생성
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 고정지출 테이블 생성
const createFixedExpenseTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'fixed_expenses'
    `;
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE fixed_expenses (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          center VARCHAR(100) NOT NULL,
          month VARCHAR(7) NOT NULL,
          item VARCHAR(200) NOT NULL,
          amount INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // 인덱스 생성
      await pool.query(`
        CREATE INDEX idx_fixed_expenses_center_month ON fixed_expenses(center, month)
      `);
      
      console.log('[PostgreSQL] 고정지출 테이블이 생성되었습니다.');
    } else {
      // 기존 테이블에 컬럼 추가 (마이그레이션)
      await runMigration(
        'add_columns_to_fixed_expenses_20250131',
        '고정지출 테이블에 tax_type, start_date, end_date 컬럼 추가',
        migrateFixedExpenseTable
      );
    }
  } catch (error) {
    console.error('[PostgreSQL] 고정지출 테이블 생성 오류:', error);
    throw error;
  }
};

// 고정지출 테이블 마이그레이션
const migrateFixedExpenseTable = async () => {
  try {
    // 모든 컬럼 목록 확인
    const checkColumnQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'fixed_expenses'
    `;
    const columnResult = await pool.query(checkColumnQuery);
    
    const existingColumns = columnResult.rows.map(row => row.column_name);
    
    // 필요한 컬럼 목록
    const requiredColumns = {
      'id': 'UUID PRIMARY KEY DEFAULT gen_random_uuid()',
      'center': 'VARCHAR(100) NOT NULL',
      'month': 'VARCHAR(7) NOT NULL',
      'item': 'VARCHAR(200) NOT NULL',
      'amount': 'INTEGER NOT NULL DEFAULT 0',
      'created_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      'updated_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    };
    
    // 누락된 컬럼 추가
    for (const [columnName, columnDef] of Object.entries(requiredColumns)) {
      if (!existingColumns.includes(columnName)) {
        try {
          // PRIMARY KEY나 DEFAULT가 있는 경우는 제외하고 추가
          if (columnName === 'id') {
            // id는 이미 존재해야 하므로 스킵
            continue;
          }
          
          await pool.query(`
            ALTER TABLE fixed_expenses 
            ADD COLUMN ${columnName} ${columnDef.includes('NOT NULL') ? columnDef.replace(' NOT NULL', '') : columnDef}
          `);
          
          // NOT NULL 제약조건이 필요한 경우
          if (columnDef.includes('NOT NULL')) {
            // 기존 데이터에 기본값 설정
            if (columnName === 'center') {
              await pool.query(`
                UPDATE fixed_expenses SET ${columnName} = '미지정' WHERE ${columnName} IS NULL
              `);
            } else if (columnName === 'month') {
              const now = new Date();
              const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
              await pool.query(`
                UPDATE fixed_expenses SET ${columnName} = '${yearMonth}' WHERE ${columnName} IS NULL
              `);
            } else if (columnName === 'item') {
              await pool.query(`
                UPDATE fixed_expenses SET ${columnName} = '' WHERE ${columnName} IS NULL
              `);
            } else if (columnName === 'amount') {
              await pool.query(`
                UPDATE fixed_expenses SET ${columnName} = 0 WHERE ${columnName} IS NULL
              `);
            }
            await pool.query(`
              ALTER TABLE fixed_expenses 
              ALTER COLUMN ${columnName} SET NOT NULL
            `);
          }
          
          console.log(`[PostgreSQL] 고정지출 테이블에 ${columnName} 컬럼이 추가되었습니다.`);
        } catch (err) {
          // 컬럼이 이미 존재하거나 다른 오류인 경우 무시
          if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
            console.error(`[PostgreSQL] ${columnName} 컬럼 추가 오류:`, err);
          }
        }
      }
    }
    
    // 인덱스 확인 및 생성
    const checkIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'fixed_expenses' AND schemaname = 'public'
    `;
    const indexResult = await pool.query(checkIndexQuery);
    const existingIndexes = indexResult.rows.map(row => row.indexname);
    
    if (!existingIndexes.some(idx => idx.includes('fixed_expenses_center_month'))) {
      try {
        await pool.query(`
          CREATE INDEX idx_fixed_expenses_center_month ON fixed_expenses(center, month)
        `);
      } catch (err) {
        // 인덱스가 이미 존재하는 경우 무시
      }
    }
  } catch (error) {
    console.error('[PostgreSQL] 고정지출 테이블 마이그레이션 오류:', error);
    // 마이그레이션 오류는 치명적이지 않으므로 throw하지 않음
  }
};

// 변동지출 테이블 생성
const createVariableExpenseTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'variable_expenses'
    `;
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE variable_expenses (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          center VARCHAR(100) NOT NULL,
          month VARCHAR(7) NOT NULL,
          date DATE,
          item VARCHAR(200) NOT NULL,
          amount INTEGER NOT NULL DEFAULT 0,
          note VARCHAR(500),
          tax_type VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // 인덱스 생성
      await pool.query(`
        CREATE INDEX idx_variable_expenses_center_month ON variable_expenses(center, month)
      `);
      
      console.log('[PostgreSQL] 변동지출 테이블이 생성되었습니다.');
    } else {
      // 기존 테이블에 컬럼 추가 (마이그레이션)
      await runMigration(
        'add_columns_to_variable_expenses_20250131',
        '변동지출 테이블에 tax_type, updated_at 컬럼 추가',
        migrateVariableExpenseTable
      );
    }
  } catch (error) {
    console.error('[PostgreSQL] 변동지출 테이블 생성 오류:', error);
    throw error;
  }
};

// 변동지출 테이블 마이그레이션
const migrateVariableExpenseTable = async () => {
  try {
    // 모든 컬럼 목록 확인
    const checkColumnQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'variable_expenses'
    `;
    const columnResult = await pool.query(checkColumnQuery);
    
    const existingColumns = columnResult.rows.map(row => row.column_name);
    
    // 필요한 컬럼 목록
    const requiredColumns = {
      'id': 'UUID PRIMARY KEY DEFAULT gen_random_uuid()',
      'center': 'VARCHAR(100) NOT NULL',
      'month': 'VARCHAR(7) NOT NULL',
      'date': 'DATE',
      'item': 'VARCHAR(200) NOT NULL',
      'amount': 'INTEGER NOT NULL DEFAULT 0',
      'note': 'VARCHAR(500)',
      'tax_type': 'VARCHAR(50)',
      'created_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      'updated_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    };
    
    // 누락된 컬럼 추가
    for (const [columnName, columnDef] of Object.entries(requiredColumns)) {
      if (!existingColumns.includes(columnName)) {
        try {
          // PRIMARY KEY나 DEFAULT가 있는 경우는 제외하고 추가
          if (columnName === 'id') {
            // id는 이미 존재해야 하므로 스킵
            continue;
          }
          
          await pool.query(`
            ALTER TABLE variable_expenses 
            ADD COLUMN ${columnName} ${columnDef.includes('NOT NULL') ? columnDef.replace(' NOT NULL', '') : columnDef}
          `);
          
          // NOT NULL 제약조건이 필요한 경우
          if (columnDef.includes('NOT NULL')) {
            // 기존 데이터에 기본값 설정
            if (columnName === 'center') {
              await pool.query(`
                UPDATE variable_expenses SET ${columnName} = '미지정' WHERE ${columnName} IS NULL
              `);
            } else if (columnName === 'month') {
              const now = new Date();
              const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
              await pool.query(`
                UPDATE variable_expenses SET ${columnName} = '${yearMonth}' WHERE ${columnName} IS NULL
              `);
            } else if (columnName === 'date') {
              // date는 선택 사항이므로 NOT NULL 제약조건을 추가하지 않음
              continue;
            } else if (columnName === 'item') {
              await pool.query(`
                UPDATE variable_expenses SET ${columnName} = '' WHERE ${columnName} IS NULL
              `);
            } else if (columnName === 'amount') {
              await pool.query(`
                UPDATE variable_expenses SET ${columnName} = 0 WHERE ${columnName} IS NULL
              `);
            }
            await pool.query(`
              ALTER TABLE variable_expenses 
              ALTER COLUMN ${columnName} SET NOT NULL
            `);
          }
          
          console.log(`[PostgreSQL] 변동지출 테이블에 ${columnName} 컬럼이 추가되었습니다.`);
        } catch (err) {
          // 컬럼이 이미 존재하거나 다른 오류인 경우 무시
          if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
            console.error(`[PostgreSQL] ${columnName} 컬럼 추가 오류:`, err);
          }
        }
      }
    }
    
    // 기존 date 컬럼의 NOT NULL 제약조건 제거 (date는 선택 사항)
    if (existingColumns.includes('date')) {
      try {
        // date 컬럼이 NOT NULL인지 확인
        const checkNotNullQuery = `
          SELECT is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public' 
          AND table_name = 'variable_expenses'
          AND column_name = 'date'
        `;
        const notNullResult = await pool.query(checkNotNullQuery);
        
        if (notNullResult.rows.length > 0 && notNullResult.rows[0].is_nullable === 'NO') {
          // NOT NULL 제약조건 제거
          await pool.query(`
            ALTER TABLE variable_expenses 
            ALTER COLUMN date DROP NOT NULL
          `);
          console.log('[PostgreSQL] 변동지출 테이블의 date 컬럼 NOT NULL 제약조건이 제거되었습니다.');
        }
      } catch (err) {
        console.error('[PostgreSQL] date 컬럼 NOT NULL 제약조건 제거 오류:', err);
      }
    }
    
    // 인덱스 확인 및 생성
    const checkIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'variable_expenses' AND schemaname = 'public'
    `;
    const indexResult = await pool.query(checkIndexQuery);
    const existingIndexes = indexResult.rows.map(row => row.indexname);
    
    if (!existingIndexes.some(idx => idx.includes('variable_expenses_center_month'))) {
      try {
        await pool.query(`
          CREATE INDEX idx_variable_expenses_center_month ON variable_expenses(center, month)
        `);
      } catch (err) {
        // 인덱스가 이미 존재하는 경우 무시
      }
    }
  } catch (error) {
    console.error('[PostgreSQL] 변동지출 테이블 마이그레이션 오류:', error);
    // 마이그레이션 오류는 치명적이지 않으므로 throw하지 않음
  }
};

// 고정지출 조회
const getFixedExpenses = async (filters = {}) => {
  try {
    let query = `
      SELECT id, center, month, item, amount, created_at, updated_at
      FROM fixed_expenses
    `;
    const params = [];
    let paramIndex = 1;
    const conditions = [];
    
    if (filters.center) {
      conditions.push(`center = $${paramIndex++}`);
      params.push(filters.center);
    }
    
    if (filters.month) {
      conditions.push(`month = $${paramIndex++}`);
      params.push(filters.month);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY center, month, item';
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 고정지출 조회 오류:', error);
    throw error;
  }
};

// 변동지출 조회
const getVariableExpenses = async (filters = {}) => {
  try {
    let query = `
      SELECT id, center, month, date, item, amount, note, tax_type, created_at, updated_at
      FROM variable_expenses
    `;
    const params = [];
    let paramIndex = 1;
    const conditions = [];
    
    if (filters.center) {
      conditions.push(`center = $${paramIndex++}`);
      params.push(filters.center);
    }
    
    if (filters.month) {
      conditions.push(`month = $${paramIndex++}`);
      params.push(filters.month);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY center, month, date DESC, item';
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 변동지출 조회 오류:', error);
    throw error;
  }
};

// 고정지출 추가
const addFixedExpense = async (expense) => {
  try {
    const query = `
      INSERT INTO fixed_expenses (center, month, item, amount)
      VALUES ($1, $2, $3, $4)
      RETURNING id, center, month, item, amount, created_at, updated_at
    `;
    const values = [
      expense.center,
      expense.month,
      expense.item,
      expense.amount || 0
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 고정지출 추가 오류:', error);
    throw error;
  }
};

// 변동지출 추가
const addVariableExpense = async (expense) => {
  try {
    const query = `
      INSERT INTO variable_expenses (center, month, date, item, amount, note, tax_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, center, month, date, item, amount, note, tax_type, created_at, updated_at
    `;
    const values = [
      expense.center,
      expense.month,
      expense.date,
      expense.item,
      expense.amount || 0,
      expense.note || null,
      expense.taxType || null
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 변동지출 추가 오류:', error);
    throw error;
  }
};

// 고정지출 수정
const updateFixedExpense = async (id, updates) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (updates.center !== undefined) {
      fields.push(`center = $${paramIndex++}`);
      values.push(updates.center);
    }
    if (updates.month !== undefined) {
      fields.push(`month = $${paramIndex++}`);
      values.push(updates.month);
    }
    if (updates.item !== undefined) {
      fields.push(`item = $${paramIndex++}`);
      values.push(updates.item);
    }
    if (updates.amount !== undefined) {
      fields.push(`amount = $${paramIndex++}`);
      values.push(updates.amount);
    }
    
    if (fields.length === 0) {
      throw new Error('수정할 필드가 없습니다.');
    }
    
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    
    const query = `
      UPDATE fixed_expenses 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, center, month, item, amount, created_at, updated_at
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('고정지출 데이터를 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 고정지출 수정 오류:', error);
    throw error;
  }
};

// 변동지출 수정
const updateVariableExpense = async (id, updates) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (updates.center !== undefined) {
      fields.push(`center = $${paramIndex++}`);
      values.push(updates.center);
    }
    if (updates.month !== undefined) {
      fields.push(`month = $${paramIndex++}`);
      values.push(updates.month);
    }
    if (updates.date !== undefined) {
      fields.push(`date = $${paramIndex++}`);
      values.push(updates.date);
    }
    if (updates.item !== undefined) {
      fields.push(`item = $${paramIndex++}`);
      values.push(updates.item);
    }
    if (updates.amount !== undefined) {
      fields.push(`amount = $${paramIndex++}`);
      values.push(updates.amount);
    }
    if (updates.note !== undefined) {
      fields.push(`note = $${paramIndex++}`);
      values.push(updates.note);
    }
    if (updates.taxType !== undefined) {
      fields.push(`tax_type = $${paramIndex++}`);
      values.push(updates.taxType || null);
    }
    
    if (fields.length === 0) {
      throw new Error('수정할 필드가 없습니다.');
    }
    
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    
    const query = `
      UPDATE variable_expenses 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, center, month, date, item, amount, note, tax_type, created_at, updated_at
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('변동지출 데이터를 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 변동지출 수정 오류:', error);
    throw error;
  }
};

// 고정지출 삭제
const deleteFixedExpense = async (id) => {
  try {
    const query = `
      DELETE FROM fixed_expenses 
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('고정지출 데이터를 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 고정지출 삭제 오류:', error);
    throw error;
  }
};

// 변동지출 삭제
const deleteVariableExpense = async (id) => {
  try {
    const query = `
      DELETE FROM variable_expenses 
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('변동지출 데이터를 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 변동지출 삭제 오류:', error);
    throw error;
  }
};

// 급여 테이블 생성
const createSalaryTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'salaries'
    `;
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE salaries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          center VARCHAR(100) NOT NULL,
          month VARCHAR(7) NOT NULL,
          item VARCHAR(200) NOT NULL,
          amount INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // 인덱스 생성
      await pool.query(`
        CREATE INDEX idx_salaries_center_month ON salaries(center, month)
      `);
      
      console.log('[PostgreSQL] 급여 테이블이 생성되었습니다.');
    } else {
      // 기존 테이블에 컬럼 추가 (마이그레이션)
      await runMigration(
        'add_updated_at_to_salary_20250131',
        '급여 테이블에 updated_at 컬럼 추가',
        migrateSalaryTable
      );
    }
  } catch (error) {
    console.error('[PostgreSQL] 급여 테이블 생성 오류:', error);
    throw error;
  }
};

// 급여 테이블 마이그레이션
const migrateSalaryTable = async () => {
  try {
    // 모든 컬럼 목록 확인
    const checkColumnQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'salaries'
    `;
    const columnResult = await pool.query(checkColumnQuery);
    
    const existingColumns = columnResult.rows.map(row => row.column_name);
    
    // 필요한 컬럼 목록
    const requiredColumns = {
      'id': 'UUID PRIMARY KEY DEFAULT gen_random_uuid()',
      'center': 'VARCHAR(100) NOT NULL',
      'month': 'VARCHAR(7) NOT NULL',
      'item': 'VARCHAR(200) NOT NULL',
      'amount': 'INTEGER NOT NULL DEFAULT 0',
      'created_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      'updated_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    };
    
    // 누락된 컬럼 추가
    for (const [columnName, columnDef] of Object.entries(requiredColumns)) {
      if (!existingColumns.includes(columnName)) {
        try {
          if (columnName === 'id') {
            continue;
          }
          
          await pool.query(`
            ALTER TABLE salaries 
            ADD COLUMN ${columnName} ${columnDef.includes('NOT NULL') ? columnDef.replace(' NOT NULL', '') : columnDef}
          `);
          
          // NOT NULL 제약조건이 필요한 경우
          if (columnDef.includes('NOT NULL')) {
            if (columnName === 'center') {
              await pool.query(`
                UPDATE salaries SET ${columnName} = '미지정' WHERE ${columnName} IS NULL
              `);
            } else if (columnName === 'month') {
              const now = new Date();
              const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
              await pool.query(`
                UPDATE salaries SET ${columnName} = '${yearMonth}' WHERE ${columnName} IS NULL
              `);
            } else if (columnName === 'item') {
              await pool.query(`
                UPDATE salaries SET ${columnName} = '' WHERE ${columnName} IS NULL
              `);
            } else if (columnName === 'amount') {
              await pool.query(`
                UPDATE salaries SET ${columnName} = 0 WHERE ${columnName} IS NULL
              `);
            }
            await pool.query(`
              ALTER TABLE salaries 
              ALTER COLUMN ${columnName} SET NOT NULL
            `);
          }
          
          console.log(`[PostgreSQL] 급여 테이블에 ${columnName} 컬럼이 추가되었습니다.`);
        } catch (err) {
          if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
            console.error(`[PostgreSQL] ${columnName} 컬럼 추가 오류:`, err);
          }
        }
      }
    }
    
    // 인덱스 확인 및 생성
    const checkIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'salaries' AND schemaname = 'public'
    `;
    const indexResult = await pool.query(checkIndexQuery);
    const existingIndexes = indexResult.rows.map(row => row.indexname);
    
    if (!existingIndexes.some(idx => idx.includes('salaries_center_month'))) {
      try {
        await pool.query(`
          CREATE INDEX idx_salaries_center_month ON salaries(center, month)
        `);
      } catch (err) {
        // 인덱스가 이미 존재하는 경우 무시
      }
    }
  } catch (error) {
    console.error('[PostgreSQL] 급여 테이블 마이그레이션 오류:', error);
  }
};

// 급여 조회
const getSalaries = async (filters = {}) => {
  try {
    let query = `
      SELECT id, center, month, item, amount, created_at, updated_at
      FROM salaries
    `;
    const params = [];
    let paramIndex = 1;
    const conditions = [];
    
    if (filters.center) {
      conditions.push(`center = $${paramIndex++}`);
      params.push(filters.center);
    }
    
    if (filters.month) {
      conditions.push(`month = $${paramIndex++}`);
      params.push(filters.month);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY center, month, item';
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 급여 조회 오류:', error);
    throw error;
  }
};

// 급여 추가
const addSalary = async (salary) => {
  try {
    const query = `
      INSERT INTO salaries (center, month, item, amount)
      VALUES ($1, $2, $3, $4)
      RETURNING id, center, month, item, amount, created_at, updated_at
    `;
    const values = [
      salary.center,
      salary.month,
      salary.item,
      salary.amount || 0
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 급여 추가 오류:', error);
    throw error;
  }
};

// 급여 수정
const updateSalary = async (id, updates) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (updates.center !== undefined) {
      fields.push(`center = $${paramIndex++}`);
      values.push(updates.center);
    }
    if (updates.month !== undefined) {
      fields.push(`month = $${paramIndex++}`);
      values.push(updates.month);
    }
    if (updates.item !== undefined) {
      fields.push(`item = $${paramIndex++}`);
      values.push(updates.item);
    }
    if (updates.amount !== undefined) {
      fields.push(`amount = $${paramIndex++}`);
      values.push(updates.amount);
    }
    
    if (fields.length === 0) {
      throw new Error('수정할 필드가 없습니다.');
    }
    
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    
    const query = `
      UPDATE salaries 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, center, month, item, amount, created_at, updated_at
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('급여 데이터를 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 급여 수정 오류:', error);
    throw error;
  }
};

// 급여 삭제
const deleteSalary = async (id) => {
  try {
    const query = `
      DELETE FROM salaries 
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('급여 데이터를 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 급여 삭제 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
// 정산 테이블 생성
const createSettlementTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'settlements'
    `;
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE settlements (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          month VARCHAR(7) NOT NULL UNIQUE,
          profit_amount INTEGER NOT NULL,
          settlement_amount INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // 인덱스 생성
      await pool.query(`
        CREATE INDEX idx_settlements_month ON settlements(month)
      `);
      
      console.log('[PostgreSQL] 정산 테이블이 생성되었습니다.');
    } else {
      // 기존 테이블에 컬럼 추가 (마이그레이션)
      await runMigration(
        'migrate_settlement_20250131',
        '정산 테이블 마이그레이션',
        migrateSettlementTable
      );
    }
  } catch (error) {
    console.error('[PostgreSQL] 정산 테이블 생성 오류:', error);
    throw error;
  }
};

// 정산 테이블 마이그레이션
const migrateSettlementTable = async () => {
  try {
    const checkColumnQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'settlements'
    `;
    const columnResult = await pool.query(checkColumnQuery);
    
    const existingColumns = columnResult.rows.map(row => row.column_name);
    
    // 필요한 컬럼 목록
    const requiredColumns = {
      'id': 'UUID PRIMARY KEY DEFAULT gen_random_uuid()',
      'month': 'VARCHAR(7) NOT NULL',
      'profit_amount': 'INTEGER NOT NULL',
      'settlement_amount': 'INTEGER',
      'created_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      'updated_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    };
    
    // 누락된 컬럼 추가
    for (const [columnName, columnDef] of Object.entries(requiredColumns)) {
      if (!existingColumns.includes(columnName)) {
        try {
          if (columnName === 'id') {
            continue;
          }
          
          await pool.query(`
            ALTER TABLE settlements 
            ADD COLUMN ${columnName} ${columnDef.includes('NOT NULL') ? columnDef.replace(' NOT NULL', '') : columnDef}
          `);
          
          // NOT NULL 제약조건이 필요한 경우
          if (columnDef.includes('NOT NULL')) {
            if (columnName === 'profit_amount') {
              await pool.query(`
                UPDATE settlements SET ${columnName} = 0 WHERE ${columnName} IS NULL
              `);
            }
            await pool.query(`
              ALTER TABLE settlements ALTER COLUMN ${columnName} SET NOT NULL
            `);
          }
          
          console.log(`[PostgreSQL] settlements 테이블에 ${columnName} 컬럼이 추가되었습니다.`);
        } catch (err) {
          console.log(`[PostgreSQL] settlements 테이블 ${columnName} 컬럼 추가 시도 (이미 존재할 수 있음):`, err.message);
        }
      }
    }
    
    // UNIQUE 제약조건 추가 (month)
    try {
      const uniqueCheckQuery = `
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'settlements'
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%month%'
      `;
      const uniqueResult = await pool.query(uniqueCheckQuery);
      
      if (uniqueResult.rows.length === 0) {
        await pool.query(`
          ALTER TABLE settlements ADD CONSTRAINT settlements_month_unique UNIQUE(month)
        `);
        console.log('[PostgreSQL] settlements 테이블에 month UNIQUE 제약조건이 추가되었습니다.');
      }
    } catch (err) {
      console.log('[PostgreSQL] settlements 테이블 month UNIQUE 제약조건 추가 시도 (이미 존재할 수 있음):', err.message);
    }
  } catch (error) {
    console.error('[PostgreSQL] 정산 테이블 마이그레이션 오류:', error);
  }
};

// 정산 조회
const getSettlements = async (filters = {}) => {
  try {
    let query = `
      SELECT id, month, profit_amount, settlement_amount, created_at, updated_at
      FROM settlements
    `;
    const params = [];
    const conditions = [];
    
    if (filters.month) {
      conditions.push(`month = $${params.length + 1}`);
      params.push(filters.month);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY month DESC';
    
    const result = await pool.query(query, params);
    
    return result.rows.map(row => ({
      id: row.id,
      month: row.month,
      profitAmount: row.profit_amount,
      settlementAmount: row.settlement_amount,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  } catch (error) {
    console.error('[PostgreSQL] 정산 조회 오류:', error);
    throw error;
  }
};

// 정산 추가
const addSettlement = async (settlementData) => {
  try {
    const query = `
      INSERT INTO settlements (month, profit_amount, settlement_amount)
      VALUES ($1, $2, $3)
      RETURNING id, month, profit_amount, settlement_amount, created_at, updated_at
    `;
    
    const values = [
      settlementData.month,
      settlementData.profitAmount || 0,
      settlementData.settlementAmount || null
    ];
    
    const result = await pool.query(query, values);
    
    const row = result.rows[0];
    return {
      id: row.id,
      month: row.month,
      profitAmount: row.profit_amount,
      settlementAmount: row.settlement_amount,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } catch (error) {
    console.error('[PostgreSQL] 정산 추가 오류:', error);
    throw error;
  }
};

// 정산 수정
const updateSettlement = async (id, updates) => {
  try {
    const updateFields = [];
    const values = [];
    let paramIndex = 1;
    
    if (updates.profitAmount !== undefined) {
      updateFields.push(`profit_amount = $${paramIndex++}`);
      values.push(updates.profitAmount);
    }
    
    if (updates.settlementAmount !== undefined) {
      updateFields.push(`settlement_amount = $${paramIndex++}`);
      values.push(updates.settlementAmount || null);
    }
    
    if (updateFields.length === 0) {
      throw new Error('수정할 필드가 없습니다.');
    }
    
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    
    const query = `
      UPDATE settlements
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, month, profit_amount, settlement_amount, created_at, updated_at
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('정산을 찾을 수 없습니다.');
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      month: row.month,
      profitAmount: row.profit_amount,
      settlementAmount: row.settlement_amount,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } catch (error) {
    console.error('[PostgreSQL] 정산 수정 오류:', error);
    throw error;
  }
};

// 정산 삭제
const deleteSettlement = async (id) => {
  try {
    const query = `
      DELETE FROM settlements
      WHERE id = $1
      RETURNING id
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('정산을 찾을 수 없습니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] 정산 삭제 오류:', error);
    throw error;
  }
};

// 정산 ID로 조회
const getSettlementById = async (id) => {
  try {
    const query = `
      SELECT id, month, profit_amount, settlement_amount, created_at, updated_at
      FROM settlements
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      month: row.month,
      profitAmount: row.profit_amount,
      settlementAmount: row.settlement_amount,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } catch (error) {
    console.error('[PostgreSQL] 정산 ID로 조회 오류:', error);
    throw error;
  }
};

const initializeDatabase = async () => {
  try {
    await createFixedExpenseTable();
    await createVariableExpenseTable();
    await createSalaryTable();
    await createSettlementTable();
  } catch (error) {
    console.error('[PostgreSQL] 장부 데이터베이스 초기화 오류:', error);
    throw error;
  }
};

module.exports = {
  initializeDatabase,
  getFixedExpenses,
  getVariableExpenses,
  getSalaries,
  getSettlements,
  addFixedExpense,
  addVariableExpense,
  addSalary,
  addSettlement,
  updateFixedExpense,
  updateVariableExpense,
  updateSalary,
  updateSettlement,
  deleteFixedExpense,
  deleteVariableExpense,
  deleteSalary,
  deleteSettlement,
  getSettlementById
};
