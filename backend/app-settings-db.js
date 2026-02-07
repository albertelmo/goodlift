const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const createAppSettingsTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'app_settings'
    `;
    const checkResult = await pool.query(checkQuery);
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE app_settings (
          setting_key VARCHAR(100) PRIMARY KEY,
          setting_value TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      console.log('[PostgreSQL] app_settings 테이블이 생성되었습니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] app_settings 테이블 생성 오류:', error);
    throw error;
  }
};

const getSetting = async (settingKey, defaultValue = null) => {
  try {
    const query = `
      SELECT setting_value
      FROM app_settings
      WHERE setting_key = $1
    `;
    const result = await pool.query(query, [settingKey]);
    if (result.rows.length === 0) return defaultValue;
    return result.rows[0].setting_value;
  } catch (error) {
    console.error('[PostgreSQL] app_settings 조회 오류:', error);
    throw error;
  }
};

const setSetting = async (settingKey, settingValue) => {
  try {
    const query = `
      INSERT INTO app_settings (setting_key, setting_value)
      VALUES ($1, $2)
      ON CONFLICT (setting_key)
      DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        updated_at = CURRENT_TIMESTAMP
      RETURNING setting_key, setting_value, updated_at
    `;
    const result = await pool.query(query, [settingKey, settingValue]);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] app_settings 저장 오류:', error);
    throw error;
  }
};

const initializeDatabase = async () => {
  try {
    await createAppSettingsTable();
    console.log('[PostgreSQL] app_settings 데이터베이스 초기화 완료');
  } catch (error) {
    console.error('[PostgreSQL] app_settings 초기화 오류:', error);
  }
};

module.exports = {
  initializeDatabase,
  getSetting,
  setSetting
};
