const { Pool } = require('pg');

// PostgreSQL 연결 풀 생성
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 마케팅 테이블 생성 및 마이그레이션
const createMarketingTable = async () => {
  try {
    // 테이블 존재 여부 확인
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'marketing'
    `;
    const checkResult = await pool.query(checkQuery);
    
    // 테이블이 없을 때만 생성
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE marketing (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          center VARCHAR(100) NOT NULL,
          month VARCHAR(7) NOT NULL,
          type VARCHAR(20) NOT NULL CHECK (type IN ('online', 'offline')),
          item VARCHAR(200) NOT NULL,
          direction VARCHAR(200),
          target VARCHAR(200),
          cost VARCHAR(50) DEFAULT '0',
          action_result VARCHAR(500),
          target_result VARCHAR(500),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // 인덱스 생성
      await pool.query(`
        CREATE INDEX idx_marketing_center ON marketing(center)
      `);
      await pool.query(`
        CREATE INDEX idx_marketing_type ON marketing(type)
      `);
      
      console.log('[PostgreSQL] 마케팅 테이블이 생성되었습니다.');
    } else {
      console.log('[PostgreSQL] 마케팅 테이블이 이미 존재합니다.');
      // 기존 테이블에 컬럼 추가 (마이그레이션)
      await migrateMarketingTable();
    }
  } catch (error) {
    console.error('[PostgreSQL] 마케팅 테이블 생성 오류:', error);
    throw error;
  }
};

// 마이그레이션 함수 - 컬럼 추가 등을 처리
const migrateMarketingTable = async () => {
  try {
    // 모든 컬럼 목록 확인
    const checkColumnQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'marketing'
    `;
    const columnResult = await pool.query(checkColumnQuery);
    
    const existingColumns = columnResult.rows.map(row => row.column_name);
    
    // 필요한 컬럼 목록
    const requiredColumns = {
      'center': 'VARCHAR(100) NOT NULL',
      'month': 'VARCHAR(7) NOT NULL',
      'type': 'VARCHAR(20) NOT NULL CHECK (type IN (\'online\', \'offline\'))',
      'item': 'VARCHAR(200) NOT NULL',
      'direction': 'VARCHAR(200)',
      'target': 'VARCHAR(200)',
      'cost': 'VARCHAR(50) DEFAULT \'0\'',
      'action_result': 'VARCHAR(500)',
      'target_result': 'VARCHAR(500)',
      'created_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      'updated_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    };
    
    // 누락된 컬럼 추가
    for (const [columnName, columnDef] of Object.entries(requiredColumns)) {
      if (!existingColumns.includes(columnName)) {
        try {
          // CHECK 제약조건이 있는 경우는 제외하고 추가
          if (columnName === 'type') {
            // type 컬럼은 CHECK 제약조건이 있으므로 별도 처리
            await pool.query(`
              ALTER TABLE marketing 
              ADD COLUMN ${columnName} VARCHAR(20)
            `);
            // 기본값 설정
            await pool.query(`
              ALTER TABLE marketing 
              ALTER COLUMN ${columnName} SET DEFAULT 'online'
            `);
            // NOT NULL 제약조건 추가 (기존 데이터가 있을 경우)
            await pool.query(`
              ALTER TABLE marketing 
              ALTER COLUMN ${columnName} SET NOT NULL
            `);
            // CHECK 제약조건 추가
            await pool.query(`
              ALTER TABLE marketing 
              ADD CONSTRAINT marketing_type_check 
              CHECK (type IN ('online', 'offline'))
            `);
          } else {
            await pool.query(`
              ALTER TABLE marketing 
              ADD COLUMN ${columnName} ${columnDef.includes('NOT NULL') ? columnDef.replace(' NOT NULL', '') : columnDef}
            `);
            
            // NOT NULL 제약조건이 필요한 경우
            if (columnDef.includes('NOT NULL')) {
              // 기존 데이터에 기본값 설정
              if (columnName === 'center') {
                await pool.query(`
                  UPDATE marketing SET ${columnName} = '미지정' WHERE ${columnName} IS NULL
                `);
              } else if (columnName === 'month') {
                // 현재 날짜의 YYYY-MM 형식으로 기본값 설정
                const now = new Date();
                const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                await pool.query(`
                  UPDATE marketing SET ${columnName} = '${yearMonth}' WHERE ${columnName} IS NULL
                `);
              } else if (columnName === 'item') {
                await pool.query(`
                  UPDATE marketing SET ${columnName} = '' WHERE ${columnName} IS NULL
                `);
              }
              await pool.query(`
                ALTER TABLE marketing 
                ALTER COLUMN ${columnName} SET NOT NULL
              `);
            }
          }
          
          console.log(`[PostgreSQL] 마케팅 테이블에 ${columnName} 컬럼이 추가되었습니다.`);
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
      WHERE tablename = 'marketing' AND schemaname = 'public'
    `;
    const indexResult = await pool.query(checkIndexQuery);
    const existingIndexes = indexResult.rows.map(row => row.indexname);
    
    if (!existingIndexes.some(idx => idx.includes('marketing_center'))) {
      try {
        await pool.query(`
          CREATE INDEX idx_marketing_center ON marketing(center)
        `);
      } catch (err) {
        // 인덱스가 이미 존재하는 경우 무시
      }
    }
    
    if (!existingIndexes.some(idx => idx.includes('marketing_type'))) {
      try {
        await pool.query(`
          CREATE INDEX idx_marketing_type ON marketing(type)
        `);
      } catch (err) {
        // 인덱스가 이미 존재하는 경우 무시
      }
    }
    
    // cost 컬럼 타입 확인 및 변경 (INTEGER -> VARCHAR)
    const checkCostTypeQuery = `
      SELECT data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'marketing'
      AND column_name = 'cost'
    `;
    const costTypeResult = await pool.query(checkCostTypeQuery);
    
    if (costTypeResult.rows.length > 0 && costTypeResult.rows[0].data_type === 'integer') {
      try {
        // INTEGER를 VARCHAR로 변경
        await pool.query(`
          ALTER TABLE marketing 
          ALTER COLUMN cost TYPE VARCHAR(50) 
          USING cost::text
        `);
        console.log('[PostgreSQL] 마케팅 테이블의 cost 컬럼이 VARCHAR로 변경되었습니다.');
      } catch (err) {
        console.error('[PostgreSQL] cost 컬럼 타입 변경 오류:', err);
      }
    }
    
  } catch (error) {
    console.error('[PostgreSQL] 마케팅 테이블 마이그레이션 오류:', error);
    // 마이그레이션 오류는 치명적이지 않으므로 throw하지 않음
  }
};

// 마케팅 데이터 조회
const getMarketing = async (filters = {}) => {
  try {
    let query = `
      SELECT 
        id, center, month, type, item, direction, target, cost, 
        action_result, target_result, created_at, updated_at
      FROM marketing
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
    
    if (filters.type) {
      conditions.push(`type = $${paramIndex++}`);
      params.push(filters.type);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY center, created_at DESC';
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 마케팅 조회 오류:', error);
    throw error;
  }
};

// 마케팅 데이터 추가
const addMarketing = async (marketing) => {
  try {
    const query = `
      INSERT INTO marketing (center, month, type, item, direction, target, cost, action_result, target_result)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, center, month, type, item, direction, target, cost, action_result, target_result, created_at, updated_at
    `;
    const values = [
      marketing.center,
      marketing.month,
      marketing.type,
      marketing.item,
      marketing.direction || null,
      marketing.target || null,
      marketing.cost || '0',
      marketing.action_result || null,
      marketing.target_result || null
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 마케팅 추가 오류:', error);
    throw error;
  }
};

// 마케팅 데이터 수정
const updateMarketing = async (id, updates) => {
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
    if (updates.type !== undefined) {
      fields.push(`type = $${paramIndex++}`);
      values.push(updates.type);
    }
    if (updates.item !== undefined) {
      fields.push(`item = $${paramIndex++}`);
      values.push(updates.item);
    }
    if (updates.direction !== undefined) {
      fields.push(`direction = $${paramIndex++}`);
      values.push(updates.direction);
    }
    if (updates.target !== undefined) {
      fields.push(`target = $${paramIndex++}`);
      values.push(updates.target);
    }
    if (updates.cost !== undefined) {
      fields.push(`cost = $${paramIndex++}`);
      values.push(updates.cost);
    }
    if (updates.action_result !== undefined) {
      fields.push(`action_result = $${paramIndex++}`);
      values.push(updates.action_result);
    }
    if (updates.target_result !== undefined) {
      fields.push(`target_result = $${paramIndex++}`);
      values.push(updates.target_result);
    }
    
    if (fields.length === 0) {
      throw new Error('수정할 필드가 없습니다.');
    }
    
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    
    const query = `
      UPDATE marketing 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, center, month, type, item, direction, target, cost, action_result, target_result, created_at, updated_at
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('마케팅 데이터를 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 마케팅 수정 오류:', error);
    throw error;
  }
};

// 마케팅 데이터 삭제
const deleteMarketing = async (id) => {
  try {
    const query = `
      DELETE FROM marketing 
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('마케팅 데이터를 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 마케팅 삭제 오류:', error);
    throw error;
  }
};

// 마케팅 데이터 ID로 조회
const getMarketingById = async (id) => {
  try {
    const query = `
      SELECT 
        id, center, month, type, item, direction, target, cost, 
        action_result, target_result, created_at, updated_at
      FROM marketing
      WHERE id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] 마케팅 ID 조회 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  try {
    await createMarketingTable();
  } catch (error) {
    console.error('[PostgreSQL] 마케팅 데이터베이스 초기화 오류:', error);
    throw error;
  }
};

module.exports = {
  initializeDatabase,
  getMarketing,
  addMarketing,
  updateMarketing,
  deleteMarketing,
  getMarketingById
};
