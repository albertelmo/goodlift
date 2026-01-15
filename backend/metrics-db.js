const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// PostgreSQL 연결 풀 생성
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Metrics 테이블 생성 및 마이그레이션
const createMetricsTable = async () => {
  try {
    // 테이블 존재 여부 확인 (최초에는 생성, 이후에는 생성 과정 생략)
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'metrics'
    `;
    const checkResult = await pool.query(checkQuery);
    
    // 테이블이 없을 때만 생성
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          center VARCHAR(100) NOT NULL,
          month VARCHAR(7) NOT NULL,
          naver_clicks INTEGER DEFAULT 0,
          naver_leads INTEGER DEFAULT 0,
          karrot_clicks INTEGER DEFAULT 0,
          karrot_leads INTEGER DEFAULT 0,
          pt_new INTEGER DEFAULT 0,
          pt_consultation INTEGER DEFAULT 0,
          pt_renewal INTEGER DEFAULT 0,
          pt_expiring INTEGER DEFAULT 0,
          membership_new INTEGER DEFAULT 0,
          membership_renewal INTEGER DEFAULT 0,
          membership_expiring INTEGER DEFAULT 0,
          total_members INTEGER DEFAULT 0,
          pt_total_members INTEGER DEFAULT 0,
          total_sales INTEGER DEFAULT 0,
          pt_sales INTEGER DEFAULT 0,
          membership_sales INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(center, month)
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // 조회용 인덱스 생성
      await pool.query(`
        CREATE INDEX idx_metrics_center_month 
        ON metrics(center, month)
      `);
      await pool.query(`
        CREATE INDEX idx_metrics_month 
        ON metrics(month)
      `);
      
      console.log('[PostgreSQL] Metrics 테이블이 생성되었습니다.');
    } else {
      console.log('[PostgreSQL] Metrics 테이블이 이미 존재합니다.');
      // 기존 테이블에 컬럼 추가 (마이그레이션)
      await migrateMetricsTable();
    }
  } catch (error) {
    console.error('[PostgreSQL] Metrics 테이블 생성 오류:', error);
  }
};

// 마이그레이션 함수 - 컬럼 추가 등을 처리
const migrateMetricsTable = async () => {
  try {
    // 모든 컬럼 목록 확인
    const checkColumnQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'metrics'
    `;
    const columnResult = await pool.query(checkColumnQuery);
    
    const existingColumns = columnResult.rows.map(row => row.column_name);
    
    // 필요한 컬럼 목록
    const requiredColumns = {
      'naver_clicks': 'INTEGER DEFAULT 0',
      'naver_leads': 'INTEGER DEFAULT 0',
      'karrot_clicks': 'INTEGER DEFAULT 0',
      'karrot_leads': 'INTEGER DEFAULT 0',
      'pt_new': 'INTEGER DEFAULT 0',
      'pt_consultation': 'INTEGER DEFAULT 0',
      'pt_renewal': 'INTEGER DEFAULT 0',
      'pt_expiring': 'INTEGER DEFAULT 0',
      'membership_new': 'INTEGER DEFAULT 0',
      'membership_renewal': 'INTEGER DEFAULT 0',
      'membership_expiring': 'INTEGER DEFAULT 0',
      'total_members': 'INTEGER DEFAULT 0',
      'pt_total_members': 'INTEGER DEFAULT 0',
      'total_sales': 'INTEGER DEFAULT 0',
      'pt_sales': 'INTEGER DEFAULT 0',
      'membership_sales': 'INTEGER DEFAULT 0'
    };
    
    // 누락된 컬럼 추가
    for (const [columnName, columnType] of Object.entries(requiredColumns)) {
      if (!existingColumns.includes(columnName)) {
        await pool.query(`
          ALTER TABLE metrics 
          ADD COLUMN ${columnName} ${columnType}
        `);
        console.log(`[PostgreSQL] Metrics 테이블에 ${columnName} 컬럼이 추가되었습니다.`);
      }
    }
    
    // UNIQUE 제약조건 확인 및 추가
    const checkUniqueQuery = `
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'public' 
      AND table_name = 'metrics'
      AND constraint_type = 'UNIQUE'
      AND constraint_name LIKE '%center%month%'
    `;
    const uniqueResult = await pool.query(checkUniqueQuery);
    
    if (uniqueResult.rows.length === 0) {
      // UNIQUE 제약조건 추가
      await pool.query(`
        ALTER TABLE metrics 
        ADD CONSTRAINT metrics_center_month_unique UNIQUE(center, month)
      `);
      console.log('[PostgreSQL] Metrics 테이블에 (center, month) UNIQUE 제약조건이 추가되었습니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] Metrics 테이블 마이그레이션 오류:', error);
  }
};

// Metrics 목록 조회
const getMetrics = async (filters = {}) => {
  try {
    let query = `
      SELECT 
        id, center, month, naver_clicks, naver_leads, karrot_clicks, karrot_leads,
        pt_new, pt_consultation, pt_renewal, pt_expiring, membership_new, membership_renewal, membership_expiring,
        total_members, pt_total_members, total_sales, pt_sales, membership_sales,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
      FROM metrics
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

    query += ' ORDER BY month DESC, center ASC';
    const result = await pool.query(query, params);
    
    return result.rows.map(row => ({
      id: row.id,
      center: row.center,
      month: row.month,
      naver_clicks: row.naver_clicks || 0,
      naver_leads: row.naver_leads || 0,
      karrot_clicks: row.karrot_clicks || 0,
      karrot_leads: row.karrot_leads || 0,
      pt_new: row.pt_new || 0,
      pt_consultation: row.pt_consultation || 0,
      pt_renewal: row.pt_renewal || 0,
      pt_expiring: row.pt_expiring || 0,
      membership_new: row.membership_new || 0,
      membership_renewal: row.membership_renewal || 0,
      membership_expiring: row.membership_expiring || 0,
      total_members: row.total_members || 0,
      pt_total_members: row.pt_total_members || 0,
      total_sales: row.total_sales || 0,
      pt_sales: row.pt_sales || 0,
      membership_sales: row.membership_sales || 0,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  } catch (error) {
    console.error('[PostgreSQL] Metrics 조회 오류:', error);
    throw error;
  }
};

// Metric 추가
const addMetric = async (metric) => {
  try {
    const id = metric.id || uuidv4();
    const query = `
      INSERT INTO metrics (
        id, center, month, naver_clicks, naver_leads, karrot_clicks, karrot_leads,
        pt_new, pt_consultation, pt_renewal, pt_expiring, membership_new, membership_renewal, membership_expiring,
        total_members, pt_total_members, total_sales, pt_sales, membership_sales,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING 
        id, center, month, naver_clicks, naver_leads, karrot_clicks, karrot_leads,
        pt_new, pt_consultation, pt_renewal, pt_expiring, membership_new, membership_renewal, membership_expiring,
        total_members, pt_total_members, total_sales, pt_sales, membership_sales,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
    `;
    
    const values = [
      id,
      metric.center,
      metric.month,
      metric.naver_clicks || 0,
      metric.naver_leads || 0,
      metric.karrot_clicks || 0,
      metric.karrot_leads || 0,
      metric.pt_new || 0,
      metric.pt_consultation || 0,
      metric.pt_renewal || 0,
      metric.pt_expiring || 0,
      metric.membership_new || 0,
      metric.membership_renewal || 0,
      metric.membership_expiring || 0,
      metric.total_members || 0,
      metric.pt_total_members || 0,
      metric.total_sales || 0,
      metric.pt_sales || 0,
      metric.membership_sales || 0
    ];
    
    const result = await pool.query(query, values);
    const row = result.rows[0];
    return {
      id: row.id,
      center: row.center,
      month: row.month,
      naver_clicks: row.naver_clicks || 0,
      naver_leads: row.naver_leads || 0,
      karrot_clicks: row.karrot_clicks || 0,
      karrot_leads: row.karrot_leads || 0,
      pt_new: row.pt_new || 0,
      pt_consultation: row.pt_consultation || 0,
      pt_renewal: row.pt_renewal || 0,
      pt_expiring: row.pt_expiring || 0,
      membership_new: row.membership_new || 0,
      membership_renewal: row.membership_renewal || 0,
      membership_expiring: row.membership_expiring || 0,
      total_members: row.total_members || 0,
      pt_total_members: row.pt_total_members || 0,
      total_sales: row.total_sales || 0,
      pt_sales: row.pt_sales || 0,
      membership_sales: row.membership_sales || 0,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  } catch (error) {
    console.error('[PostgreSQL] Metric 추가 오류:', error);
    throw error;
  }
};

// Metric 수정
const updateMetric = async (id, updates) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const updateableFields = [
      'naver_clicks', 'naver_leads', 'karrot_clicks', 'karrot_leads',
      'pt_new', 'pt_consultation', 'pt_renewal', 'pt_expiring', 'membership_new', 'membership_renewal', 'membership_expiring',
      'total_members', 'pt_total_members', 'total_sales', 'pt_sales', 'membership_sales'
    ];

    for (const field of updateableFields) {
      if (updates[field] !== undefined) {
        fields.push(`${field} = $${paramIndex++}`);
        values.push(updates[field] || 0);
      }
    }

    if (fields.length === 0) {
      throw new Error('업데이트할 필드가 없습니다.');
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE metrics 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING 
        id, center, month, naver_clicks, naver_leads, karrot_clicks, karrot_leads,
        pt_new, pt_consultation, membership_new, membership_renewal, membership_expiring,
        total_members, pt_total_members, total_sales, pt_sales, membership_sales,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Metric을 찾을 수 없습니다.');
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      center: row.center,
      month: row.month,
      naver_clicks: row.naver_clicks || 0,
      naver_leads: row.naver_leads || 0,
      karrot_clicks: row.karrot_clicks || 0,
      karrot_leads: row.karrot_leads || 0,
      pt_new: row.pt_new || 0,
      pt_consultation: row.pt_consultation || 0,
      pt_renewal: row.pt_renewal || 0,
      pt_expiring: row.pt_expiring || 0,
      membership_new: row.membership_new || 0,
      membership_renewal: row.membership_renewal || 0,
      membership_expiring: row.membership_expiring || 0,
      total_members: row.total_members || 0,
      pt_total_members: row.pt_total_members || 0,
      total_sales: row.total_sales || 0,
      pt_sales: row.pt_sales || 0,
      membership_sales: row.membership_sales || 0,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  } catch (error) {
    console.error('[PostgreSQL] Metric 수정 오류:', error);
    throw error;
  }
};

// Metric 삭제
const deleteMetric = async (id) => {
  try {
    const query = 'DELETE FROM metrics WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('Metric을 찾을 수 없습니다.');
    }
    
    return { id: result.rows[0].id };
  } catch (error) {
    console.error('[PostgreSQL] Metric 삭제 오류:', error);
    throw error;
  }
};

// Metric ID로 조회
const getMetricById = async (id) => {
  try {
    const query = `
      SELECT 
        id, center, month, naver_clicks, naver_leads, karrot_clicks, karrot_leads,
        pt_new, pt_consultation, pt_renewal, pt_expiring, membership_new, membership_renewal, membership_expiring,
        total_members, pt_total_members, total_sales, pt_sales, membership_sales,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
      FROM metrics
      WHERE id = $1
    `;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      center: row.center,
      month: row.month,
      naver_clicks: row.naver_clicks || 0,
      naver_leads: row.naver_leads || 0,
      karrot_clicks: row.karrot_clicks || 0,
      karrot_leads: row.karrot_leads || 0,
      pt_new: row.pt_new || 0,
      pt_consultation: row.pt_consultation || 0,
      pt_renewal: row.pt_renewal || 0,
      pt_expiring: row.pt_expiring || 0,
      membership_new: row.membership_new || 0,
      membership_renewal: row.membership_renewal || 0,
      membership_expiring: row.membership_expiring || 0,
      total_members: row.total_members || 0,
      pt_total_members: row.pt_total_members || 0,
      total_sales: row.total_sales || 0,
      pt_sales: row.pt_sales || 0,
      membership_sales: row.membership_sales || 0,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  } catch (error) {
    console.error('[PostgreSQL] Metric 조회 오류:', error);
    throw error;
  }
};

// 센터와 월로 조회 (UPSERT용)
const getMetricByCenterAndMonth = async (center, month) => {
  try {
    const query = `
      SELECT 
        id, center, month, naver_clicks, naver_leads, karrot_clicks, karrot_leads,
        pt_new, pt_consultation, pt_renewal, pt_expiring, membership_new, membership_renewal, membership_expiring,
        total_members, pt_total_members, total_sales, pt_sales, membership_sales,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
      FROM metrics
      WHERE center = $1 AND month = $2
    `;
    const result = await pool.query(query, [center, month]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      center: row.center,
      month: row.month,
      naver_clicks: row.naver_clicks || 0,
      naver_leads: row.naver_leads || 0,
      karrot_clicks: row.karrot_clicks || 0,
      karrot_leads: row.karrot_leads || 0,
      pt_new: row.pt_new || 0,
      pt_consultation: row.pt_consultation || 0,
      pt_renewal: row.pt_renewal || 0,
      pt_expiring: row.pt_expiring || 0,
      membership_new: row.membership_new || 0,
      membership_renewal: row.membership_renewal || 0,
      membership_expiring: row.membership_expiring || 0,
      total_members: row.total_members || 0,
      pt_total_members: row.pt_total_members || 0,
      total_sales: row.total_sales || 0,
      pt_sales: row.pt_sales || 0,
      membership_sales: row.membership_sales || 0,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  } catch (error) {
    console.error('[PostgreSQL] Metric 조회 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  await createMetricsTable();
};

module.exports = {
  initializeDatabase,
  getMetrics,
  addMetric,
  updateMetric,
  deleteMetric,
  getMetricById,
  getMetricByCenterAndMonth
};
