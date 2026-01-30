const { Pool } = require('pg');
const { runMigration } = require('./migrations-manager');

// PostgreSQL 연결 풀 생성
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 트레이너 고정지출 테이블 생성
const createTrainerFixedExpenseTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'trainer_fixed_expenses'
    `;
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE trainer_fixed_expenses (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          trainer VARCHAR(100) NOT NULL,
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
        CREATE INDEX idx_trainer_fixed_expenses_trainer_month ON trainer_fixed_expenses(trainer, month)
      `);
      
      console.log('[PostgreSQL] 트레이너 고정지출 테이블이 생성되었습니다.');
    } else {
      // 기존 테이블에 컬럼 추가 (마이그레이션)
      await runMigration(
        'add_columns_to_trainer_fixed_expenses_20250131',
        '트레이너 고정지출 테이블에 tax_type, start_date, end_date 컬럼 추가',
        migrateTrainerFixedExpenseTable
      );
    }
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 고정지출 테이블 생성 오류:', error);
    throw error;
  }
};

// 트레이너 고정지출 테이블 마이그레이션
const migrateTrainerFixedExpenseTable = async () => {
  try {
    const checkColumnQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'trainer_fixed_expenses'
    `;
    const columnResult = await pool.query(checkColumnQuery);
    
    const existingColumns = columnResult.rows.map(row => row.column_name);
    
    const requiredColumns = {
      'id': 'UUID PRIMARY KEY DEFAULT gen_random_uuid()',
      'trainer': 'VARCHAR(100) NOT NULL',
      'month': 'VARCHAR(7) NOT NULL',
      'item': 'VARCHAR(200) NOT NULL',
      'amount': 'INTEGER NOT NULL DEFAULT 0',
      'created_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      'updated_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    };
    
    for (const [columnName, columnDef] of Object.entries(requiredColumns)) {
      if (!existingColumns.includes(columnName)) {
        try {
          if (columnName === 'id') {
            continue;
          }
          
          await pool.query(`
            ALTER TABLE trainer_fixed_expenses 
            ADD COLUMN ${columnName} ${columnDef.includes('NOT NULL') ? columnDef.replace(' NOT NULL', '') : columnDef}
          `);
          
          if (columnDef.includes('NOT NULL')) {
            if (columnName === 'trainer') {
              await pool.query(`
                UPDATE trainer_fixed_expenses SET ${columnName} = 'unknown' WHERE ${columnName} IS NULL
              `);
            } else if (columnName === 'month') {
              const now = new Date();
              const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
              await pool.query(`
                UPDATE trainer_fixed_expenses SET ${columnName} = '${yearMonth}' WHERE ${columnName} IS NULL
              `);
            } else if (columnName === 'item') {
              await pool.query(`
                UPDATE trainer_fixed_expenses SET ${columnName} = '' WHERE ${columnName} IS NULL
              `);
            } else if (columnName === 'amount') {
              await pool.query(`
                UPDATE trainer_fixed_expenses SET ${columnName} = 0 WHERE ${columnName} IS NULL
              `);
            }
            await pool.query(`
              ALTER TABLE trainer_fixed_expenses 
              ALTER COLUMN ${columnName} SET NOT NULL
            `);
          }
          
          console.log(`[PostgreSQL] 트레이너 고정지출 테이블에 ${columnName} 컬럼이 추가되었습니다.`);
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
      WHERE tablename = 'trainer_fixed_expenses' AND schemaname = 'public'
    `;
    const indexResult = await pool.query(checkIndexQuery);
    const existingIndexes = indexResult.rows.map(row => row.indexname);
    
    if (!existingIndexes.some(idx => idx.includes('trainer_fixed_expenses_trainer_month'))) {
      try {
        await pool.query(`
          CREATE INDEX idx_trainer_fixed_expenses_trainer_month ON trainer_fixed_expenses(trainer, month)
        `);
      } catch (err) {
        // 인덱스가 이미 존재하는 경우 무시
      }
    }
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 고정지출 테이블 마이그레이션 오류:', error);
  }
};

// 트레이너 변동지출 테이블 생성
const createTrainerVariableExpenseTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'trainer_variable_expenses'
    `;
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE trainer_variable_expenses (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          trainer VARCHAR(100) NOT NULL,
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
        CREATE INDEX idx_trainer_variable_expenses_trainer_month ON trainer_variable_expenses(trainer, month)
      `);
      
      console.log('[PostgreSQL] 트레이너 변동지출 테이블이 생성되었습니다.');
    } else {
      await runMigration(
        'add_columns_to_trainer_variable_expenses_20250131',
        '트레이너 변동지출 테이블에 tax_type, updated_at 컬럼 추가',
        migrateTrainerVariableExpenseTable
      );
    }
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 변동지출 테이블 생성 오류:', error);
    throw error;
  }
};

// 트레이너 변동지출 테이블 마이그레이션
const migrateTrainerVariableExpenseTable = async () => {
  try {
    const checkColumnQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'trainer_variable_expenses'
    `;
    const columnResult = await pool.query(checkColumnQuery);
    
    const existingColumns = columnResult.rows.map(row => row.column_name);
    
    const requiredColumns = {
      'id': 'UUID PRIMARY KEY DEFAULT gen_random_uuid()',
      'trainer': 'VARCHAR(100) NOT NULL',
      'month': 'VARCHAR(7) NOT NULL',
      'date': 'DATE',
      'item': 'VARCHAR(200) NOT NULL',
      'amount': 'INTEGER NOT NULL DEFAULT 0',
      'note': 'VARCHAR(500)',
      'tax_type': 'VARCHAR(50)',
      'created_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      'updated_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    };
    
    for (const [columnName, columnDef] of Object.entries(requiredColumns)) {
      if (!existingColumns.includes(columnName)) {
        try {
          if (columnName === 'id') {
            continue;
          }
          
          await pool.query(`
            ALTER TABLE trainer_variable_expenses 
            ADD COLUMN ${columnName} ${columnDef.includes('NOT NULL') ? columnDef.replace(' NOT NULL', '') : columnDef}
          `);
          
          if (columnDef.includes('NOT NULL')) {
            if (columnName === 'trainer') {
              await pool.query(`
                UPDATE trainer_variable_expenses SET ${columnName} = 'unknown' WHERE ${columnName} IS NULL
              `);
            } else if (columnName === 'month') {
              const now = new Date();
              const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
              await pool.query(`
                UPDATE trainer_variable_expenses SET ${columnName} = '${yearMonth}' WHERE ${columnName} IS NULL
              `);
            } else if (columnName === 'item') {
              await pool.query(`
                UPDATE trainer_variable_expenses SET ${columnName} = '' WHERE ${columnName} IS NULL
              `);
            } else if (columnName === 'amount') {
              await pool.query(`
                UPDATE trainer_variable_expenses SET ${columnName} = 0 WHERE ${columnName} IS NULL
              `);
            }
            await pool.query(`
              ALTER TABLE trainer_variable_expenses 
              ALTER COLUMN ${columnName} SET NOT NULL
            `);
          }
          
          console.log(`[PostgreSQL] 트레이너 변동지출 테이블에 ${columnName} 컬럼이 추가되었습니다.`);
        } catch (err) {
          if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
            console.error(`[PostgreSQL] ${columnName} 컬럼 추가 오류:`, err);
          }
        }
      }
    }
    
    // date 컬럼의 NOT NULL 제약조건 제거 (date는 선택 사항)
    if (existingColumns.includes('date')) {
      try {
        const checkNotNullQuery = `
          SELECT is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public' 
          AND table_name = 'trainer_variable_expenses'
          AND column_name = 'date'
        `;
        const notNullResult = await pool.query(checkNotNullQuery);
        
        if (notNullResult.rows.length > 0 && notNullResult.rows[0].is_nullable === 'NO') {
          await pool.query(`
            ALTER TABLE trainer_variable_expenses 
            ALTER COLUMN date DROP NOT NULL
          `);
          console.log('[PostgreSQL] 트레이너 변동지출 테이블의 date 컬럼 NOT NULL 제약조건이 제거되었습니다.');
        }
      } catch (err) {
        console.error('[PostgreSQL] date 컬럼 NOT NULL 제약조건 제거 오류:', err);
      }
    }
    
    // 인덱스 확인 및 생성
    const checkIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'trainer_variable_expenses' AND schemaname = 'public'
    `;
    const indexResult = await pool.query(checkIndexQuery);
    const existingIndexes = indexResult.rows.map(row => row.indexname);
    
    if (!existingIndexes.some(idx => idx.includes('trainer_variable_expenses_trainer_month'))) {
      try {
        await pool.query(`
          CREATE INDEX idx_trainer_variable_expenses_trainer_month ON trainer_variable_expenses(trainer, month)
        `);
      } catch (err) {
        // 인덱스가 이미 존재하는 경우 무시
      }
    }
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 변동지출 테이블 마이그레이션 오류:', error);
  }
};

// 트레이너 급여 테이블 생성
const createTrainerSalaryTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'trainer_salaries'
    `;
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE trainer_salaries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          trainer VARCHAR(100) NOT NULL,
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
        CREATE INDEX idx_trainer_salaries_trainer_month ON trainer_salaries(trainer, month)
      `);
      
      console.log('[PostgreSQL] 트레이너 급여 테이블이 생성되었습니다.');
    } else {
      await runMigration(
        'add_updated_at_to_trainer_salary_20250131',
        '트레이너 급여 테이블에 updated_at 컬럼 추가',
        migrateTrainerSalaryTable
      );
    }
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 급여 테이블 생성 오류:', error);
    throw error;
  }
};

// 트레이너 급여 테이블 마이그레이션
const migrateTrainerSalaryTable = async () => {
  try {
    const checkColumnQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'trainer_salaries'
    `;
    const columnResult = await pool.query(checkColumnQuery);
    
    const existingColumns = columnResult.rows.map(row => row.column_name);
    
    const requiredColumns = {
      'id': 'UUID PRIMARY KEY DEFAULT gen_random_uuid()',
      'trainer': 'VARCHAR(100) NOT NULL',
      'month': 'VARCHAR(7) NOT NULL',
      'item': 'VARCHAR(200) NOT NULL',
      'amount': 'INTEGER NOT NULL DEFAULT 0',
      'created_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      'updated_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    };
    
    for (const [columnName, columnDef] of Object.entries(requiredColumns)) {
      if (!existingColumns.includes(columnName)) {
        try {
          if (columnName === 'id') {
            continue;
          }
          
          await pool.query(`
            ALTER TABLE trainer_salaries 
            ADD COLUMN ${columnName} ${columnDef.includes('NOT NULL') ? columnDef.replace(' NOT NULL', '') : columnDef}
          `);
          
          if (columnDef.includes('NOT NULL')) {
            if (columnName === 'trainer') {
              await pool.query(`
                UPDATE trainer_salaries SET ${columnName} = 'unknown' WHERE ${columnName} IS NULL
              `);
            } else if (columnName === 'month') {
              const now = new Date();
              const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
              await pool.query(`
                UPDATE trainer_salaries SET ${columnName} = '${yearMonth}' WHERE ${columnName} IS NULL
              `);
            } else if (columnName === 'item') {
              await pool.query(`
                UPDATE trainer_salaries SET ${columnName} = '' WHERE ${columnName} IS NULL
              `);
            } else if (columnName === 'amount') {
              await pool.query(`
                UPDATE trainer_salaries SET ${columnName} = 0 WHERE ${columnName} IS NULL
              `);
            }
            await pool.query(`
              ALTER TABLE trainer_salaries 
              ALTER COLUMN ${columnName} SET NOT NULL
            `);
          }
          
          console.log(`[PostgreSQL] 트레이너 급여 테이블에 ${columnName} 컬럼이 추가되었습니다.`);
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
      WHERE tablename = 'trainer_salaries' AND schemaname = 'public'
    `;
    const indexResult = await pool.query(checkIndexQuery);
    const existingIndexes = indexResult.rows.map(row => row.indexname);
    
    if (!existingIndexes.some(idx => idx.includes('trainer_salaries_trainer_month'))) {
      try {
        await pool.query(`
          CREATE INDEX idx_trainer_salaries_trainer_month ON trainer_salaries(trainer, month)
        `);
      } catch (err) {
        // 인덱스가 이미 존재하는 경우 무시
      }
    }
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 급여 테이블 마이그레이션 오류:', error);
  }
};

// 트레이너 고정지출 조회
const getTrainerFixedExpenses = async (filters = {}) => {
  try {
    let query = `
      SELECT id, trainer, month, item, amount, created_at, updated_at
      FROM trainer_fixed_expenses
    `;
    const params = [];
    let paramIndex = 1;
    const conditions = [];
    
    if (filters.trainer) {
      conditions.push(`trainer = $${paramIndex++}`);
      params.push(filters.trainer);
    }
    
    if (filters.month) {
      conditions.push(`month = $${paramIndex++}`);
      params.push(filters.month);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY month, item';
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 고정지출 조회 오류:', error);
    throw error;
  }
};

// 트레이너 변동지출 조회
const getTrainerVariableExpenses = async (filters = {}) => {
  try {
    let query = `
      SELECT id, trainer, month, date, item, amount, note, tax_type, created_at, updated_at
      FROM trainer_variable_expenses
    `;
    const params = [];
    let paramIndex = 1;
    const conditions = [];
    
    if (filters.trainer) {
      conditions.push(`trainer = $${paramIndex++}`);
      params.push(filters.trainer);
    }
    
    if (filters.month) {
      conditions.push(`month = $${paramIndex++}`);
      params.push(filters.month);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY month, date DESC, item';
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 변동지출 조회 오류:', error);
    throw error;
  }
};

// 트레이너 급여 조회
const getTrainerSalaries = async (filters = {}) => {
  try {
    let query = `
      SELECT id, trainer, month, item, amount, created_at, updated_at
      FROM trainer_salaries
    `;
    const params = [];
    let paramIndex = 1;
    const conditions = [];
    
    if (filters.trainer) {
      conditions.push(`trainer = $${paramIndex++}`);
      params.push(filters.trainer);
    }
    
    if (filters.month) {
      conditions.push(`month = $${paramIndex++}`);
      params.push(filters.month);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY month, item';
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 급여 조회 오류:', error);
    throw error;
  }
};

// 트레이너 고정지출 추가
const addTrainerFixedExpense = async (expense) => {
  try {
    const query = `
      INSERT INTO trainer_fixed_expenses (trainer, month, item, amount)
      VALUES ($1, $2, $3, $4)
      RETURNING id, trainer, month, item, amount, created_at, updated_at
    `;
    const values = [
      expense.trainer,
      expense.month,
      expense.item,
      expense.amount || 0
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 고정지출 추가 오류:', error);
    throw error;
  }
};

// 트레이너 변동지출 추가
const addTrainerVariableExpense = async (expense) => {
  try {
    const query = `
      INSERT INTO trainer_variable_expenses (trainer, month, date, item, amount, note, tax_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, trainer, month, date, item, amount, note, tax_type, created_at, updated_at
    `;
    const values = [
      expense.trainer,
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
    console.error('[PostgreSQL] 트레이너 변동지출 추가 오류:', error);
    throw error;
  }
};

// 트레이너 급여 추가
const addTrainerSalary = async (salary) => {
  try {
    const query = `
      INSERT INTO trainer_salaries (trainer, month, item, amount)
      VALUES ($1, $2, $3, $4)
      RETURNING id, trainer, month, item, amount, created_at, updated_at
    `;
    const values = [
      salary.trainer,
      salary.month,
      salary.item,
      salary.amount || 0
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 급여 추가 오류:', error);
    throw error;
  }
};

// 트레이너 고정지출 수정
const updateTrainerFixedExpense = async (id, updates) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
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
      UPDATE trainer_fixed_expenses 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, trainer, month, item, amount, created_at, updated_at
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('트레이너 고정지출 데이터를 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 고정지출 수정 오류:', error);
    throw error;
  }
};

// 트레이너 변동지출 수정
const updateTrainerVariableExpense = async (id, updates) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
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
      UPDATE trainer_variable_expenses 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, trainer, month, date, item, amount, note, tax_type, created_at, updated_at
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('트레이너 변동지출 데이터를 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 변동지출 수정 오류:', error);
    throw error;
  }
};

// 트레이너 급여 수정
const updateTrainerSalary = async (id, updates) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
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
      UPDATE trainer_salaries 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, trainer, month, item, amount, created_at, updated_at
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('트레이너 급여 데이터를 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 급여 수정 오류:', error);
    throw error;
  }
};

// 트레이너 고정지출 삭제
const deleteTrainerFixedExpense = async (id) => {
  try {
    const query = `
      DELETE FROM trainer_fixed_expenses 
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('트레이너 고정지출 데이터를 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 고정지출 삭제 오류:', error);
    throw error;
  }
};

// 트레이너 변동지출 삭제
const deleteTrainerVariableExpense = async (id) => {
  try {
    const query = `
      DELETE FROM trainer_variable_expenses 
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('트레이너 변동지출 데이터를 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 변동지출 삭제 오류:', error);
    throw error;
  }
};

// 트레이너 급여 삭제
const deleteTrainerSalary = async (id) => {
  try {
    const query = `
      DELETE FROM trainer_salaries 
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('트레이너 급여 데이터를 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 급여 삭제 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  try {
    await createTrainerFixedExpenseTable();
    await createTrainerVariableExpenseTable();
    await createTrainerSalaryTable();
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 장부 데이터베이스 초기화 오류:', error);
    throw error;
  }
};

module.exports = {
  initializeDatabase,
  getTrainerFixedExpenses,
  getTrainerVariableExpenses,
  getTrainerSalaries,
  addTrainerFixedExpense,
  addTrainerVariableExpense,
  addTrainerSalary,
  updateTrainerFixedExpense,
  updateTrainerVariableExpense,
  updateTrainerSalary,
  deleteTrainerFixedExpense,
  deleteTrainerVariableExpense,
  deleteTrainerSalary
};
