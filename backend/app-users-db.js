const { Pool } = require('pg');

// PostgreSQL 연결 풀 생성 (기존 DB 모듈 패턴과 동일)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 앱 유저 테이블 생성
const createAppUsersTable = async () => {
  try {
    // 테이블 존재 여부 확인 (최초에는 생성, 이후에는 생성 과정 생략)
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'app_users'
    `;
    const checkResult = await pool.query(checkQuery);
    
    // 테이블이 없을 때만 생성
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE app_users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          username VARCHAR(50) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(100) NOT NULL,
          phone VARCHAR(20) NOT NULL,
          member_name VARCHAR(100),
          trainer VARCHAR(50),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login_at TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // 인덱스 생성
      await createAppUsersIndexes();
      
      console.log('[PostgreSQL] 앱 유저 테이블이 생성되었습니다.');
    } else {
      console.log('[PostgreSQL] 앱 유저 테이블이 이미 존재합니다.');
      // 기존 테이블에 컬럼 추가 (마이그레이션)
      await migrateAppUsersTable();
    }
  } catch (error) {
    console.error('[PostgreSQL] 앱 유저 테이블 생성 오류:', error);
  }
};

// 기존 테이블에 컬럼 추가 (마이그레이션)
const migrateAppUsersTable = async () => {
  try {
    // member_name 컬럼 확인 및 추가
    const checkMemberNameQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'member_name'
    `;
    const checkMemberNameResult = await pool.query(checkMemberNameQuery);
    
    if (checkMemberNameResult.rows.length === 0) {
      await pool.query(`ALTER TABLE app_users ADD COLUMN member_name VARCHAR(100)`);
      console.log('[PostgreSQL] member_name 컬럼이 추가되었습니다.');
    }
    
    // is_active 컬럼 확인 및 추가
    const checkIsActiveQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'is_active'
    `;
    const checkIsActiveResult = await pool.query(checkIsActiveQuery);
    
    if (checkIsActiveResult.rows.length === 0) {
      await pool.query(`ALTER TABLE app_users ADD COLUMN is_active BOOLEAN DEFAULT true`);
      console.log('[PostgreSQL] is_active 컬럼이 추가되었습니다.');
    }
    
    // last_login_at 컬럼 확인 및 추가
    const checkLastLoginAtQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'last_login_at'
    `;
    const checkLastLoginAtResult = await pool.query(checkLastLoginAtQuery);
    
    if (checkLastLoginAtResult.rows.length === 0) {
      await pool.query(`ALTER TABLE app_users ADD COLUMN last_login_at TIMESTAMP`);
      console.log('[PostgreSQL] last_login_at 컬럼이 추가되었습니다.');
    }
    
    // trainer 컬럼 확인 및 추가
    const checkTrainerQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'trainer'
    `;
    const checkTrainerResult = await pool.query(checkTrainerQuery);
    
    if (checkTrainerResult.rows.length === 0) {
      await pool.query(`ALTER TABLE app_users ADD COLUMN trainer VARCHAR(50)`);
      console.log('[PostgreSQL] trainer 컬럼이 추가되었습니다.');
    }
    
    // 인덱스 생성 (없으면 생성)
    await createAppUsersIndexes();
  } catch (error) {
    console.error('[PostgreSQL] 앱 유저 테이블 마이그레이션 오류:', error);
  }
};

// 인덱스 생성
const createAppUsersIndexes = async () => {
  try {
    // username 인덱스 확인 및 생성
    const checkUsernameIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND tablename = 'app_users' AND indexname = 'idx_app_users_username'
    `;
    const checkUsernameIndexResult = await pool.query(checkUsernameIndexQuery);
    
    if (checkUsernameIndexResult.rows.length === 0) {
      await pool.query(`CREATE INDEX idx_app_users_username ON app_users(username)`);
      console.log('[PostgreSQL] idx_app_users_username 인덱스가 생성되었습니다.');
    }
    
    // member_name 인덱스 확인 및 생성
    const checkMemberNameIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND tablename = 'app_users' AND indexname = 'idx_app_users_member_name'
    `;
    const checkMemberNameIndexResult = await pool.query(checkMemberNameIndexQuery);
    
    if (checkMemberNameIndexResult.rows.length === 0) {
      await pool.query(`CREATE INDEX idx_app_users_member_name ON app_users(member_name)`);
      console.log('[PostgreSQL] idx_app_users_member_name 인덱스가 생성되었습니다.');
    }
    
    // phone 인덱스 확인 및 생성
    const checkPhoneIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND tablename = 'app_users' AND indexname = 'idx_app_users_phone'
    `;
    const checkPhoneIndexResult = await pool.query(checkPhoneIndexQuery);
    
    if (checkPhoneIndexResult.rows.length === 0) {
      await pool.query(`CREATE INDEX idx_app_users_phone ON app_users(phone)`);
      console.log('[PostgreSQL] idx_app_users_phone 인덱스가 생성되었습니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] 앱 유저 인덱스 생성 오류:', error);
  }
};

// 앱 유저 목록 조회
const getAppUsers = async (filters = {}) => {
  try {
    let query = `
      SELECT 
        id, username, name, phone, member_name, trainer, is_active,
        created_at, updated_at, last_login_at
      FROM app_users
    `;
    const params = [];
    let paramIndex = 1;

    // 필터 조건 추가
    const conditions = [];
    if (filters.member_name) {
      conditions.push(`member_name = $${paramIndex++}`);
      params.push(filters.member_name);
    }
    if (filters.trainer) {
      conditions.push(`trainer = $${paramIndex++}`);
      params.push(filters.trainer);
    }
    if (filters.is_active !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      params.push(filters.is_active);
    }
    if (filters.username) {
      conditions.push(`username = $${paramIndex++}`);
      params.push(filters.username);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 앱 유저 조회 오류:', error);
    throw error;
  }
};

// ID로 앱 유저 조회
const getAppUserById = async (id) => {
  try {
    const query = `
      SELECT 
        id, username, name, phone, member_name, trainer, is_active,
        created_at, updated_at, last_login_at
      FROM app_users 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 앱 유저 ID 조회 오류:', error);
    throw error;
  }
};

// 아이디로 앱 유저 조회 (로그인용, password_hash 포함)
const getAppUserByUsername = async (username) => {
  try {
    const query = `
      SELECT 
        id, username, password_hash, name, phone, member_name, trainer, is_active,
        created_at, updated_at, last_login_at
      FROM app_users 
      WHERE username = $1
    `;
    
    const result = await pool.query(query, [username]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 앱 유저 아이디 조회 오류:', error);
    throw error;
  }
};

// 앱 유저 추가
const addAppUser = async (userData) => {
  try {
    const query = `
      INSERT INTO app_users (username, password_hash, name, phone, member_name, trainer, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, username, name, phone, member_name, trainer, is_active, created_at, updated_at
    `;
    const values = [
      userData.username,
      userData.password_hash,
      userData.name,
      userData.phone,
      userData.member_name || null,
      userData.trainer || null,
      userData.is_active !== undefined ? userData.is_active : true
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 앱 유저 추가 오류:', error);
    throw error;
  }
};

// 앱 유저 정보 수정
const updateAppUser = async (id, updates) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.phone !== undefined) {
      fields.push(`phone = $${paramIndex++}`);
      values.push(updates.phone);
    }
    if (updates.member_name !== undefined) {
      fields.push(`member_name = $${paramIndex++}`);
      values.push(updates.member_name || null);
    }
    if (updates.trainer !== undefined) {
      fields.push(`trainer = $${paramIndex++}`);
      values.push(updates.trainer || null);
    }
    if (updates.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(updates.is_active);
    }
    if (updates.password_hash) {
      fields.push(`password_hash = $${paramIndex++}`);
      values.push(updates.password_hash);
    }

    if (fields.length === 0) {
      throw new Error('수정할 필드가 없습니다.');
    }

    // updated_at 자동 업데이트
    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(id);
    const query = `
      UPDATE app_users 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, username, name, phone, member_name, trainer, is_active, created_at, updated_at, last_login_at
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('앱 유저를 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 앱 유저 수정 오류:', error);
    throw error;
  }
};

// 앱 유저 삭제
const deleteAppUser = async (id) => {
  try {
    const query = `
      DELETE FROM app_users 
      WHERE id = $1
      RETURNING id, username, name
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('앱 유저를 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 앱 유저 삭제 오류:', error);
    throw error;
  }
};

// 마지막 로그인 시각 업데이트
const updateLastLogin = async (username) => {
  try {
    const query = `
      UPDATE app_users 
      SET last_login_at = CURRENT_TIMESTAMP
      WHERE username = $1
      RETURNING id, username, last_login_at
    `;
    
    const result = await pool.query(query, [username]);
    
    if (result.rows.length === 0) {
      throw new Error('앱 유저를 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 마지막 로그인 시각 업데이트 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  try {
    await createAppUsersTable();
    console.log('[PostgreSQL] 앱 유저 데이터베이스 초기화 완료');
  } catch (error) {
    console.error('[PostgreSQL] 앱 유저 데이터베이스 초기화 오류:', error);
  }
};

module.exports = {
  initializeDatabase,
  getAppUsers,
  getAppUserById,
  getAppUserByUsername,
  addAppUser,
  updateAppUser,
  deleteAppUser,
  updateLastLogin,
  pool
};
