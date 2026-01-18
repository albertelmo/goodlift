const { Pool } = require('pg');

// PostgreSQL 연결 풀 생성 (기존 DB 모듈 패턴과 동일)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 앱 유저 설정 테이블 생성
const createAppUserSettingsTable = async () => {
  try {
    // 테이블 존재 여부 확인
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'app_user_settings'
    `;
    const checkResult = await pool.query(checkQuery);
    
    // 테이블이 없을 때만 생성
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE app_user_settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          setting_key VARCHAR(100) NOT NULL,
          setting_value TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(app_user_id, setting_key)
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // 인덱스 생성
      await createSettingsIndexes();
      
      console.log('[PostgreSQL] app_user_settings 테이블이 생성되었습니다.');
    } else {
      console.log('[PostgreSQL] app_user_settings 테이블이 이미 존재합니다.');
      // 기존 테이블 마이그레이션 (구버전 구조가 있을 경우)
      await migrateAppUserSettingsTable();
    }
  } catch (error) {
    console.error('[PostgreSQL] 앱 유저 설정 테이블 생성 오류:', error);
    throw error;
  }
};

// 기존 컬럼 기반 테이블을 Key-Value 구조로 마이그레이션 (필요한 경우)
const migrateAppUserSettingsTable = async () => {
  try {
    // setting_key, setting_value 컬럼이 있는지 확인
    const checkSettingKeyQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'app_user_settings' AND column_name = 'setting_key'
    `;
    const checkSettingKeyResult = await pool.query(checkSettingKeyQuery);
    
    // 이미 Key-Value 구조면 마이그레이션 불필요
    if (checkSettingKeyResult.rows.length > 0) {
      return;
    }
    
    // show_favorites_only 컬럼이 있는지 확인 (구버전 구조)
    const checkOldColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'app_user_settings' AND column_name = 'show_favorites_only'
    `;
    const checkOldColumnResult = await pool.query(checkOldColumnQuery);
    
    if (checkOldColumnResult.rows.length > 0) {
      // 구버전 구조를 Key-Value 구조로 마이그레이션
      console.log('[PostgreSQL] 기존 컬럼 기반 구조를 Key-Value 구조로 마이그레이션합니다...');
      
      // 1. setting_key, setting_value 컬럼 추가
      await pool.query(`ALTER TABLE app_user_settings ADD COLUMN setting_key VARCHAR(100)`);
      await pool.query(`ALTER TABLE app_user_settings ADD COLUMN setting_value TEXT`);
      
      // 2. 기존 데이터 마이그레이션
      await pool.query(`
        UPDATE app_user_settings 
        SET setting_key = 'show_favorites_only', 
            setting_value = CASE WHEN show_favorites_only THEN 'true' ELSE 'false' END
        WHERE setting_key IS NULL
      `);
      
      // 3. NOT NULL 제약조건 추가
      await pool.query(`ALTER TABLE app_user_settings ALTER COLUMN setting_key SET NOT NULL`);
      
      // 4. UNIQUE 제약조건 추가 (기존 app_user_id UNIQUE 제거 후)
      await pool.query(`ALTER TABLE app_user_settings DROP CONSTRAINT IF EXISTS app_user_settings_app_user_id_key`);
      await pool.query(`ALTER TABLE app_user_settings ADD CONSTRAINT app_user_settings_app_user_id_setting_key_unique UNIQUE(app_user_id, setting_key)`);
      
      // 5. 기존 컬럼 삭제 (선택사항, 데이터 백업 후 진행)
      // await pool.query(`ALTER TABLE app_user_settings DROP COLUMN show_favorites_only`);
      
      console.log('[PostgreSQL] 마이그레이션이 완료되었습니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] 앱 유저 설정 테이블 마이그레이션 오류:', error);
    // 마이그레이션 실패해도 계속 진행
  }
};

// 인덱스 생성
const createSettingsIndexes = async () => {
  try {
    // app_user_id 인덱스 확인 및 생성
    const checkAppUserIdIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND tablename = 'app_user_settings' AND indexname = 'idx_app_user_settings_app_user_id'
    `;
    const checkAppUserIdIndexResult = await pool.query(checkAppUserIdIndexQuery);
    
    if (checkAppUserIdIndexResult.rows.length === 0) {
      await pool.query(`CREATE INDEX idx_app_user_settings_app_user_id ON app_user_settings(app_user_id)`);
      console.log('[PostgreSQL] idx_app_user_settings_app_user_id 인덱스가 생성되었습니다.');
    }
    
    // UNIQUE 제약조건 (app_user_id, setting_key)이 이미 인덱스를 생성하므로 별도 인덱스는 불필요
  } catch (error) {
    console.error('[PostgreSQL] 앱 유저 설정 인덱스 생성 오류:', error);
    throw error;
  }
};

// ========== 설정 CRUD 함수 ==========

// 유저 설정 조회 (Key-Value를 객체로 변환)
const getUserSettings = async (appUserId) => {
  try {
    const query = `
      SELECT 
        setting_key,
        setting_value
      FROM app_user_settings
      WHERE app_user_id = $1
    `;
    const result = await pool.query(query, [appUserId]);
    
    // Key-Value를 객체로 변환
    const settings = {};
    result.rows.forEach(row => {
      // setting_value를 적절한 타입으로 변환
      const value = row.setting_value;
      if (value === 'true') settings[row.setting_key] = true;
      else if (value === 'false') settings[row.setting_key] = false;
      else if (value === null || value === 'null') settings[row.setting_key] = null;
      else if (!isNaN(value) && value !== '') settings[row.setting_key] = Number(value);
      else settings[row.setting_key] = value;
    });
    
    return {
      app_user_id: appUserId,
      ...settings
    };
  } catch (error) {
    console.error('[PostgreSQL] 유저 설정 조회 오류:', error);
    throw error;
  }
};

// 특정 설정값 조회
const getSetting = async (appUserId, settingKey, defaultValue = null) => {
  try {
    const query = `
      SELECT setting_value
      FROM app_user_settings
      WHERE app_user_id = $1 AND setting_key = $2
    `;
    const result = await pool.query(query, [appUserId, settingKey]);
    
    if (result.rows.length === 0) {
      return defaultValue;
    }
    
    const value = result.rows[0].setting_value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === null || value === 'null') return null;
    if (!isNaN(value) && value !== '') return Number(value);
    return value;
  } catch (error) {
    console.error('[PostgreSQL] 설정값 조회 오류:', error);
    throw error;
  }
};

// 유저 설정 생성 또는 업데이트 (여러 설정 한번에)
const upsertUserSettings = async (appUserId, settings) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const results = [];
      
      for (const [key, value] of Object.entries(settings)) {
        // 값을 문자열로 변환
        const stringValue = value === null || value === undefined ? null : String(value);
        
        const query = `
          INSERT INTO app_user_settings (app_user_id, setting_key, setting_value)
          VALUES ($1, $2, $3)
          ON CONFLICT (app_user_id, setting_key)
          DO UPDATE SET
            setting_value = EXCLUDED.setting_value,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id, app_user_id, setting_key, setting_value, created_at, updated_at
        `;
        
        const result = await client.query(query, [appUserId, key, stringValue]);
        results.push(result.rows[0]);
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[PostgreSQL] 유저 설정 저장 오류:', error);
    throw error;
  }
};

// 유저 설정 업데이트 (여러 설정 한번에)
const updateUserSettings = async (appUserId, updates) => {
  try {
    if (!updates || Object.keys(updates).length === 0) {
      throw new Error('수정할 설정이 없습니다.');
    }
    
    // upsertUserSettings를 사용하여 업데이트
    return await upsertUserSettings(appUserId, updates);
  } catch (error) {
    console.error('[PostgreSQL] 유저 설정 수정 오류:', error);
    throw error;
  }
};

// 단일 설정값 설정
const setSetting = async (appUserId, settingKey, settingValue) => {
  try {
    const stringValue = settingValue === null || settingValue === undefined ? null : String(settingValue);
    
    const query = `
      INSERT INTO app_user_settings (app_user_id, setting_key, setting_value)
      VALUES ($1, $2, $3)
      ON CONFLICT (app_user_id, setting_key)
      DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, app_user_id, setting_key, setting_value, created_at, updated_at
    `;
    
    const result = await pool.query(query, [appUserId, settingKey, stringValue]);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 설정값 저장 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  try {
    // app_users 테이블이 먼저 생성되어야 함
    await createAppUserSettingsTable();
    console.log('[PostgreSQL] 앱 유저 설정 데이터베이스 초기화 완료');
  } catch (error) {
    console.error('[PostgreSQL] 앱 유저 설정 데이터베이스 초기화 오류:', error);
  }
};

module.exports = {
  initializeDatabase,
  getUserSettings,
  getSetting,
  upsertUserSettings,
  updateUserSettings,
  setSetting
};
