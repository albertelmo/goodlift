const { Pool } = require('pg');
const { runMigration } = require('./migrations-manager');
const bcrypt = require('bcrypt');

// PostgreSQL 연결 풀 생성 (기존 DB와 동일한 연결 사용)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Elmo 사용자 테이블 생성
const createElmoUsersTable = async () => {
  try {
    // 테이블 존재 여부 확인
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'elmo_users'
    `;
    const checkResult = await pool.query(checkQuery);
    
    // 테이블이 없을 때만 생성
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE elmo_users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          username VARCHAR(50) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login_at TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // 인덱스 생성
      await createElmoUsersIndexes();
      
      console.log('[PostgreSQL] Elmo 사용자 테이블이 생성되었습니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] Elmo 사용자 테이블 생성 오류:', error);
  }
};

// 인덱스 생성
const createElmoUsersIndexes = async () => {
  try {
    // username 인덱스 확인 및 생성
    const checkUsernameIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND tablename = 'elmo_users' AND indexname = 'idx_elmo_users_username'
    `;
    const checkUsernameIndexResult = await pool.query(checkUsernameIndexQuery);
    
    if (checkUsernameIndexResult.rows.length === 0) {
      await pool.query(`CREATE INDEX idx_elmo_users_username ON elmo_users(username)`);
      console.log('[PostgreSQL] idx_elmo_users_username 인덱스가 생성되었습니다.');
    }
    
    // email 인덱스 확인 및 생성
    const checkEmailIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND tablename = 'elmo_users' AND indexname = 'idx_elmo_users_email'
    `;
    const checkEmailIndexResult = await pool.query(checkEmailIndexQuery);
    
    if (checkEmailIndexResult.rows.length === 0) {
      await pool.query(`CREATE INDEX idx_elmo_users_email ON elmo_users(email)`);
      console.log('[PostgreSQL] idx_elmo_users_email 인덱스가 생성되었습니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] Elmo 사용자 인덱스 생성 오류:', error);
  }
};

// Elmo 사용자 조회 (username으로)
const getElmoUserByUsername = async (username) => {
  try {
    const query = `
      SELECT id, username, password_hash, name, email, is_active, role, created_at, updated_at, last_login_at
      FROM elmo_users 
      WHERE username = $1
    `;
    
    const result = await pool.query(query, [username]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[Elmo DB] 사용자 조회 오류:', error);
    throw error;
  }
};

// Elmo 사용자 조회 (id로)
const getElmoUserById = async (id) => {
  try {
    const query = `
      SELECT id, username, name, email, is_active, role, created_at, updated_at, last_login_at
      FROM elmo_users 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[Elmo DB] 사용자 조회 오류:', error);
    throw error;
  }
};

// Elmo 사용자 추가 (회원가입)
const addElmoUser = async (userData) => {
  try {
    // 비밀번호 해싱
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(userData.password, saltRounds);
    
    const query = `
      INSERT INTO elmo_users (username, password_hash, name, email, is_active, role)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, username, name, email, is_active, role, created_at, updated_at
    `;
    const values = [
      userData.username,
      password_hash,
      userData.name,
      userData.email || null,
      userData.is_active !== undefined ? userData.is_active : true,
      userData.role || 'user'  // 기본값 'user'
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[Elmo DB] 사용자 추가 오류:', error);
    throw error;
  }
};

// 비밀번호 검증
const verifyPassword = async (username, password) => {
  try {
    const user = await getElmoUserByUsername(username);
    
    if (!user) {
      return null;
    }
    
    if (!user.is_active) {
      throw new Error('비활성화된 계정입니다.');
    }
    
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (isValid) {
      // 비밀번호 해시는 반환하지 않음
      const { password_hash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }
    
    return null;
  } catch (error) {
    console.error('[Elmo DB] 비밀번호 검증 오류:', error);
    throw error;
  }
};

// 마지막 로그인 시간 업데이트
const updateLastLogin = async (username) => {
  try {
    const query = `
      UPDATE elmo_users 
      SET last_login_at = CURRENT_TIMESTAMP
      WHERE username = $1
      RETURNING id, username, last_login_at
    `;
    
    const result = await pool.query(query, [username]);
    
    if (result.rows.length === 0) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[Elmo DB] 마지막 로그인 시간 업데이트 오류:', error);
    throw error;
  }
};

// 테이블 마이그레이션 (role 컬럼 추가)
const migrateElmoUsersTable = async () => {
  try {
    // role 컬럼 존재 여부 확인
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'elmo_users' 
        AND column_name = 'role'
    `;
    const checkResult = await pool.query(checkColumnQuery);
    
    if (checkResult.rows.length === 0) {
      // role 컬럼 추가
      await pool.query(`
        ALTER TABLE elmo_users 
        ADD COLUMN role VARCHAR(20) DEFAULT 'user' 
        CHECK (role IN ('su', 'admin', 'user'))
      `);
      
      // 기존 사용자 처리: 가장 오래된 사용자를 SU로 설정
      const updateResult = await pool.query(`
        UPDATE elmo_users 
        SET role = 'su' 
        WHERE id = (
          SELECT id 
          FROM elmo_users 
          ORDER BY created_at ASC 
          LIMIT 1
        )
        AND (role IS NULL OR role = '' OR role = 'user')
        RETURNING id, username, role
      `);
      
      if (updateResult.rows.length > 0) {
        console.log(`[Elmo DB] 첫 번째 사용자 "${updateResult.rows[0].username}"가 SU로 설정되었습니다.`);
      }
      
      // 나머지 사용자는 'user'로 설정 (이미 DEFAULT이지만 명시적으로)
      await pool.query(`
        UPDATE elmo_users 
        SET role = 'user' 
        WHERE role IS NULL OR role = ''
      `);
      
      console.log('[Elmo DB] role 컬럼이 추가되었습니다.');
    }
  } catch (error) {
    console.error('[Elmo DB] 테이블 마이그레이션 오류:', error);
  }
};

// role 인덱스 생성 (선택사항)
const createElmoUsersRoleIndex = async () => {
  try {
    const checkIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND tablename = 'elmo_users' 
        AND indexname = 'idx_elmo_users_role'
    `;
    const checkResult = await pool.query(checkIndexQuery);
    
    if (checkResult.rows.length === 0) {
      await pool.query(`CREATE INDEX idx_elmo_users_role ON elmo_users(role)`);
      console.log('[Elmo DB] idx_elmo_users_role 인덱스가 생성되었습니다.');
    }
  } catch (error) {
    console.error('[Elmo DB] role 인덱스 생성 오류:', error);
  }
};

// 사용자 수 조회 (첫 번째 계정 판별용)
const getElmoUserCount = async () => {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM elmo_users');
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    console.error('[Elmo DB] 사용자 수 조회 오류:', error);
    return 0;
  }
};

// 모든 Elmo 사용자 조회 (관리자용)
const getAllElmoUsers = async () => {
  try {
    const query = `
      SELECT id, username, name, email, is_active, role, created_at, updated_at, last_login_at
      FROM elmo_users 
      ORDER BY created_at ASC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error('[Elmo DB] 모든 사용자 조회 오류:', error);
    throw error;
  }
};

// Elmo 사용자 권한 수정
const updateElmoUserRole = async (userId, role) => {
  try {
    const query = `
      UPDATE elmo_users 
      SET role = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, username, name, email, is_active, role, created_at, updated_at, last_login_at
    `;
    
    const result = await pool.query(query, [role, userId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[Elmo DB] 사용자 권한 수정 오류:', error);
    throw error;
  }
};

// Elmo 사용자 삭제
const deleteElmoUser = async (userId) => {
  try {
    const query = `
      DELETE FROM elmo_users 
      WHERE id = $1
      RETURNING id, username
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[Elmo DB] 사용자 삭제 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  try {
    await createElmoUsersTable();
    await runMigration(
      'add_role_to_elmo_users_20250131',
      'Elmo 사용자 테이블에 role 컬럼 추가',
      migrateElmoUsersTable
    );
    await createElmoUsersRoleIndex();  // 인덱스 추가
    console.log('[PostgreSQL] Elmo 사용자 데이터베이스 초기화 완료');
  } catch (error) {
    console.error('[PostgreSQL] Elmo 사용자 데이터베이스 초기화 오류:', error);
  }
};

module.exports = {
  initializeDatabase,
  getElmoUserByUsername,
  getElmoUserById,
  addElmoUser,
  verifyPassword,
  updateLastLogin,
  getElmoUserCount,
  getAllElmoUsers,
  updateElmoUserRole,
  deleteElmoUser,
  pool
};
