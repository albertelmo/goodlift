const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// created_at은 KST 벽시계(timestamp without time zone)로 저장 — to_char 전 timestamptz 변환 시 세션 TZ(UTC)로 잘못 표시됨
const CREATED_AT_FORMAT = "to_char(created_at, 'YYYY-MM-DD\"T\"HH24:MI:SS.MS') || '+09:00'";
const LOG_RETENTION_DAYS = 7;

const createAdminPushNotificationLogsTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'admin_push_notification_logs'
    `;
    const checkResult = await pool.query(checkQuery);

    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE admin_push_notification_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          category VARCHAR(20) NOT NULL,
          action VARCHAR(20),
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Seoul')
        )
      `;
      await pool.query(createQuery);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_admin_push_notification_logs_created_at
        ON admin_push_notification_logs(created_at DESC)
      `);
      console.log('[PostgreSQL] admin_push_notification_logs 테이블이 생성되었습니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] admin_push_notification_logs 테이블 생성 오류:', error);
    throw error;
  }
};

const initializeDatabase = async () => {
  await createAdminPushNotificationLogsTable();
};

const addLog = async (logData) => {
  const query = `
    INSERT INTO admin_push_notification_logs (category, action, title, body)
    VALUES ($1, $2, $3, $4)
    RETURNING
      id,
      category,
      action,
      title,
      body,
      ${CREATED_AT_FORMAT} as created_at
  `;
  const values = [
    logData.category,
    logData.action || null,
    logData.title,
    logData.body
  ];
  const result = await pool.query(query, values);
  return result.rows[0];
};

const getRecentLogs = async (filters = {}) => {
  const limit = Number.isFinite(filters.limit) ? filters.limit : 200;
  const params = [LOG_RETENTION_DAYS];
  let query = `
    SELECT
      id,
      category,
      action,
      title,
      body,
      ${CREATED_AT_FORMAT} as created_at
    FROM admin_push_notification_logs
    WHERE created_at >= (NOW() AT TIME ZONE 'Asia/Seoul') - ($1::int * INTERVAL '1 day')
  `;

  if (filters.category) {
    params.push(filters.category);
    query += ` AND category = $${params.length}`;
  }

  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await pool.query(query, params);
  return result.rows;
};

module.exports = {
  initializeDatabase,
  addLog,
  getRecentLogs,
  LOG_RETENTION_DAYS
};
