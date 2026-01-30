const { Pool } = require('pg');
const { runMigration } = require('./migrations-manager');

// PostgreSQL 연결 풀 생성
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 트레이너 매출 테이블 생성
const createTrainerRevenueTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'trainer_revenues'
    `;
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE trainer_revenues (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          trainer VARCHAR(100) NOT NULL,
          month VARCHAR(7) NOT NULL,
          amount INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(trainer, month)
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // 인덱스 생성
      await pool.query(`
        CREATE INDEX idx_trainer_revenues_trainer_month ON trainer_revenues(trainer, month)
      `);
      
      console.log('[PostgreSQL] 트레이너 매출 테이블이 생성되었습니다.');
    } else {
      await runMigration(
        'add_columns_to_trainer_revenue_20250131',
        '트레이너 매출 테이블에 year_month, total_sessions 등 7개 컬럼 추가',
        migrateTrainerRevenueTable
      );
    }
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 매출 테이블 생성 오류:', error);
    throw error;
  }
};

// 트레이너 매출 테이블 마이그레이션
const migrateTrainerRevenueTable = async () => {
  try {
    const checkColumnQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'trainer_revenues'
    `;
    const columnResult = await pool.query(checkColumnQuery);
    
    const existingColumns = columnResult.rows.map(row => row.column_name);
    
    const requiredColumns = {
      'id': 'UUID PRIMARY KEY DEFAULT gen_random_uuid()',
      'trainer': 'VARCHAR(100) NOT NULL',
      'month': 'VARCHAR(7) NOT NULL',
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
            ALTER TABLE trainer_revenues 
            ADD COLUMN ${columnName} ${columnDef.includes('NOT NULL') ? columnDef.replace(' NOT NULL', '') : columnDef}
          `);
          
          if (columnDef.includes('NOT NULL')) {
            if (columnName === 'trainer') {
              await pool.query(`
                UPDATE trainer_revenues SET ${columnName} = 'unknown' WHERE ${columnName} IS NULL
              `);
            } else if (columnName === 'month') {
              const now = new Date();
              const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
              await pool.query(`
                UPDATE trainer_revenues SET ${columnName} = '${yearMonth}' WHERE ${columnName} IS NULL
              `);
            } else if (columnName === 'amount') {
              await pool.query(`
                UPDATE trainer_revenues SET ${columnName} = 0 WHERE ${columnName} IS NULL
              `);
            }
            await pool.query(`
              ALTER TABLE trainer_revenues 
              ALTER COLUMN ${columnName} SET NOT NULL
            `);
          }
          
          console.log(`[PostgreSQL] 트레이너 매출 테이블에 ${columnName} 컬럼이 추가되었습니다.`);
        } catch (err) {
          if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
            console.error(`[PostgreSQL] ${columnName} 컬럼 추가 오류:`, err);
          }
        }
      }
    }
    
    // UNIQUE 제약조건 확인 및 생성
    try {
      const checkUniqueQuery = `
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_schema = 'public' 
        AND table_name = 'trainer_revenues'
        AND constraint_type = 'UNIQUE'
      `;
      const uniqueResult = await pool.query(checkUniqueQuery);
      const hasUnique = uniqueResult.rows.some(row => 
        row.constraint_name.includes('trainer') && row.constraint_name.includes('month')
      );
      
      if (!hasUnique) {
        await pool.query(`
          ALTER TABLE trainer_revenues 
          ADD CONSTRAINT trainer_revenues_trainer_month_unique UNIQUE(trainer, month)
        `);
        console.log('[PostgreSQL] 트레이너 매출 테이블에 UNIQUE 제약조건이 추가되었습니다.');
      }
    } catch (err) {
      if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
        console.error('[PostgreSQL] UNIQUE 제약조건 추가 오류:', err);
      }
    }
    
    // 인덱스 확인 및 생성
    const checkIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'trainer_revenues' AND schemaname = 'public'
    `;
    const indexResult = await pool.query(checkIndexQuery);
    const existingIndexes = indexResult.rows.map(row => row.indexname);
    
    if (!existingIndexes.some(idx => idx.includes('trainer_revenues_trainer_month'))) {
      try {
        await pool.query(`
          CREATE INDEX idx_trainer_revenues_trainer_month ON trainer_revenues(trainer, month)
        `);
      } catch (err) {
        // 인덱스가 이미 존재하는 경우 무시
      }
    }
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 매출 테이블 마이그레이션 오류:', error);
  }
};

// 트레이너 기타수입 테이블 생성
const createTrainerOtherRevenueTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'trainer_other_revenues'
    `;
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE trainer_other_revenues (
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
        CREATE INDEX idx_trainer_other_revenues_trainer_month ON trainer_other_revenues(trainer, month)
      `);
      
      console.log('[PostgreSQL] 트레이너 기타수입 테이블이 생성되었습니다.');
    } else {
      await runMigration(
        'add_columns_to_trainer_other_revenue_20250131',
        '트레이너 기타수입 테이블에 year_month, updated_at 컬럼 추가',
        migrateTrainerOtherRevenueTable
      );
    }
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 기타수입 테이블 생성 오류:', error);
    throw error;
  }
};

// 트레이너 기타수입 테이블 마이그레이션
const migrateTrainerOtherRevenueTable = async () => {
  try {
    const checkColumnQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'trainer_other_revenues'
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
            ALTER TABLE trainer_other_revenues 
            ADD COLUMN ${columnName} ${columnDef.includes('NOT NULL') ? columnDef.replace(' NOT NULL', '') : columnDef}
          `);
          
          if (columnDef.includes('NOT NULL')) {
            if (columnName === 'trainer') {
              await pool.query(`
                UPDATE trainer_other_revenues SET ${columnName} = 'unknown' WHERE ${columnName} IS NULL
              `);
            } else if (columnName === 'month') {
              const now = new Date();
              const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
              await pool.query(`
                UPDATE trainer_other_revenues SET ${columnName} = '${yearMonth}' WHERE ${columnName} IS NULL
              `);
            } else if (columnName === 'item') {
              await pool.query(`
                UPDATE trainer_other_revenues SET ${columnName} = '' WHERE ${columnName} IS NULL
              `);
            } else if (columnName === 'amount') {
              await pool.query(`
                UPDATE trainer_other_revenues SET ${columnName} = 0 WHERE ${columnName} IS NULL
              `);
            }
            await pool.query(`
              ALTER TABLE trainer_other_revenues 
              ALTER COLUMN ${columnName} SET NOT NULL
            `);
          }
          
          console.log(`[PostgreSQL] 트레이너 기타수입 테이블에 ${columnName} 컬럼이 추가되었습니다.`);
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
      WHERE tablename = 'trainer_other_revenues' AND schemaname = 'public'
    `;
    const indexResult = await pool.query(checkIndexQuery);
    const existingIndexes = indexResult.rows.map(row => row.indexname);
    
    if (!existingIndexes.some(idx => idx.includes('trainer_other_revenues_trainer_month'))) {
      try {
        await pool.query(`
          CREATE INDEX idx_trainer_other_revenues_trainer_month ON trainer_other_revenues(trainer, month)
        `);
      } catch (err) {
        // 인덱스가 이미 존재하는 경우 무시
      }
    }
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 기타수입 테이블 마이그레이션 오류:', error);
  }
};

// 트레이너 매출 조회
const getTrainerRevenues = async (filters = {}) => {
  try {
    let query = `
      SELECT id, trainer, month, amount, created_at, updated_at
      FROM trainer_revenues
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
    
    query += ' ORDER BY month';
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 매출 조회 오류:', error);
    throw error;
  }
};

// 트레이너 기타수입 조회
const getTrainerOtherRevenues = async (filters = {}) => {
  try {
    let query = `
      SELECT id, trainer, month, item, amount, created_at, updated_at
      FROM trainer_other_revenues
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
    console.error('[PostgreSQL] 트레이너 기타수입 조회 오류:', error);
    throw error;
  }
};

// 트레이너 매출 추가/수정 (UNIQUE 제약조건으로 자동 처리)
const addTrainerRevenue = async (revenue) => {
  try {
    const query = `
      INSERT INTO trainer_revenues (trainer, month, amount)
      VALUES ($1, $2, $3)
      ON CONFLICT (trainer, month) 
      DO UPDATE SET amount = $3, updated_at = CURRENT_TIMESTAMP
      RETURNING id, trainer, month, amount, created_at, updated_at
    `;
    const values = [
      revenue.trainer,
      revenue.month,
      revenue.amount || 0
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 매출 추가/수정 오류:', error);
    throw error;
  }
};

// 트레이너 기타수입 추가
const addTrainerOtherRevenue = async (revenue) => {
  try {
    const query = `
      INSERT INTO trainer_other_revenues (trainer, month, item, amount)
      VALUES ($1, $2, $3, $4)
      RETURNING id, trainer, month, item, amount, created_at, updated_at
    `;
    const values = [
      revenue.trainer,
      revenue.month,
      revenue.item,
      revenue.amount || 0
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 기타수입 추가 오류:', error);
    throw error;
  }
};

// 트레이너 매출 수정
const updateTrainerRevenue = async (id, updates) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (updates.month !== undefined) {
      fields.push(`month = $${paramIndex++}`);
      values.push(updates.month);
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
      UPDATE trainer_revenues 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, trainer, month, amount, created_at, updated_at
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('트레이너 매출 데이터를 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 매출 수정 오류:', error);
    throw error;
  }
};

// 트레이너 기타수입 수정
const updateTrainerOtherRevenue = async (id, updates) => {
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
      UPDATE trainer_other_revenues 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, trainer, month, item, amount, created_at, updated_at
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('트레이너 기타수입 데이터를 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 기타수입 수정 오류:', error);
    throw error;
  }
};

// 트레이너 매출 삭제
const deleteTrainerRevenue = async (id) => {
  try {
    const query = `
      DELETE FROM trainer_revenues 
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('트레이너 매출 데이터를 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 매출 삭제 오류:', error);
    throw error;
  }
};

// 트레이너 기타수입 삭제
const deleteTrainerOtherRevenue = async (id) => {
  try {
    const query = `
      DELETE FROM trainer_other_revenues 
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('트레이너 기타수입 데이터를 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 기타수입 삭제 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  try {
    await createTrainerRevenueTable();
    await createTrainerOtherRevenueTable();
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 매출 데이터베이스 초기화 오류:', error);
    throw error;
  }
};

module.exports = {
  initializeDatabase,
  getTrainerRevenues,
  getTrainerOtherRevenues,
  addTrainerRevenue,
  addTrainerOtherRevenue,
  updateTrainerRevenue,
  updateTrainerOtherRevenue,
  deleteTrainerRevenue,
  deleteTrainerOtherRevenue
};
