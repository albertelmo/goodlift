const { Pool } = require('pg');
const { runMigration } = require('./migrations-manager');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const createAdminPushSettingsTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'admin_push_settings'
    `;
    const checkResult = await pool.query(checkQuery);

    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE admin_push_settings (
          username TEXT PRIMARY KEY,
          is_enabled BOOLEAN DEFAULT true,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      console.log('[PostgreSQL] admin_push_settings 테이블이 생성되었습니다.');
    } else {
      await runMigration(
        'add_admin_push_settings_columns_20260221',
        'admin_push_settings 테이블 컬럼 보강',
        migrateAdminPushSettingsTable
      );
    }
  } catch (error) {
    console.error('[PostgreSQL] admin_push_settings 테이블 생성 오류:', error);
    throw error;
  }
};

const migrateAdminPushSettingsTable = async () => {
  const columns = [
    { name: 'is_enabled', type: 'BOOLEAN DEFAULT true' },
    { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' }
  ];

  for (const column of columns) {
    const checkQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'admin_push_settings' AND column_name = $1
    `;
    const checkResult = await pool.query(checkQuery, [column.name]);
    if (checkResult.rows.length === 0) {
      await pool.query(`ALTER TABLE admin_push_settings ADD COLUMN ${column.name} ${column.type}`);
    }
  }
};

const initializeDatabase = async () => {
  await createAdminPushSettingsTable();
};

const setPushEnabled = async (username, enabled) => {
  const query = `
    INSERT INTO admin_push_settings (username, is_enabled, updated_at)
    VALUES ($1, $2, CURRENT_TIMESTAMP)
    ON CONFLICT (username)
    DO UPDATE SET is_enabled = EXCLUDED.is_enabled, updated_at = CURRENT_TIMESTAMP
    RETURNING username, is_enabled, updated_at
  `;
  const result = await pool.query(query, [username, enabled]);
  return result.rows[0];
};

const getPushEnabled = async (username) => {
  const query = `
    SELECT is_enabled
    FROM admin_push_settings
    WHERE username = $1
  `;
  const result = await pool.query(query, [username]);
  if (result.rows.length === 0) {
    return true;
  }
  return result.rows[0]?.is_enabled !== false;
};

const getSettingsMap = async (usernames) => {
  if (!Array.isArray(usernames) || usernames.length === 0) {
    return new Map();
  }
  const query = `
    SELECT username, is_enabled
    FROM admin_push_settings
    WHERE username = ANY($1)
  `;
  const result = await pool.query(query, [usernames]);
  const map = new Map();
  result.rows.forEach(row => {
    map.set(row.username, row.is_enabled);
  });
  return map;
};

module.exports = {
  initializeDatabase,
  setPushEnabled,
  getPushEnabled,
  getSettingsMap
};
