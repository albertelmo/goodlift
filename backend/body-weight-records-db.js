const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const createBodyWeightRecordsTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'body_weight_records'
    `;
    const checkResult = await pool.query(checkQuery);

    if (checkResult.rows.length === 0) {
      await pool.query(`
        CREATE TABLE body_weight_records (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          record_date DATE NOT NULL,
          weight_kg DECIMAL(5,2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(app_user_id, record_date)
        )
      `);
      await pool.query(`
        CREATE INDEX idx_body_weight_records_user_date
        ON body_weight_records(app_user_id, record_date DESC)
      `);
      console.log('[PostgreSQL] body_weight_records 테이블이 생성되었습니다.');
    } else {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_body_weight_records_user_date
        ON body_weight_records(app_user_id, record_date DESC)
      `);
    }
  } catch (error) {
    console.error('[PostgreSQL] body_weight_records 테이블 생성 오류:', error);
    throw error;
  }
};

const initializeDatabase = async () => {
  await createBodyWeightRecordsTable();
};

const normalizeWeight = (weightKg) => {
  const value = parseFloat(weightKg);
  if (!Number.isFinite(value) || value < 20 || value > 300) {
    throw new Error('체중은 20kg 이상 300kg 이하로 입력해주세요.');
  }
  return Math.round(value * 10) / 10;
};

const upsertRecord = async (appUserId, recordDate, weightKg) => {
  const weight = normalizeWeight(weightKg);
  const query = `
    INSERT INTO body_weight_records (app_user_id, record_date, weight_kg, updated_at)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    ON CONFLICT (app_user_id, record_date)
    DO UPDATE SET
      weight_kg = EXCLUDED.weight_kg,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id, app_user_id, record_date::text AS record_date, weight_kg,
      created_at, updated_at
  `;
  const result = await pool.query(query, [appUserId, recordDate, weight]);
  const row = result.rows[0];
  return {
    ...row,
    weight_kg: parseFloat(row.weight_kg)
  };
};

const getByDate = async (appUserId, recordDate) => {
  const query = `
    SELECT id, app_user_id, record_date::text AS record_date, weight_kg, created_at, updated_at
    FROM body_weight_records
    WHERE app_user_id = $1 AND record_date = $2
  `;
  const result = await pool.query(query, [appUserId, recordDate]);
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows[0];
  return {
    ...row,
    weight_kg: parseFloat(row.weight_kg)
  };
};

/** 최근 N회 (날짜 내림차순 조회 후 차트용 오름차순 반환) */
const getRecentRecords = async (appUserId, limit = 20) => {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const query = `
    SELECT record_date::text AS record_date, weight_kg
    FROM body_weight_records
    WHERE app_user_id = $1
    ORDER BY record_date DESC
    LIMIT $2
  `;
  const result = await pool.query(query, [appUserId, safeLimit]);
  const records = result.rows
    .map(row => ({
      record_date: row.record_date,
      weight_kg: parseFloat(row.weight_kg)
    }))
    .reverse();
  return records;
};

module.exports = {
  initializeDatabase,
  upsertRecord,
  getByDate,
  getRecentRecords
};
