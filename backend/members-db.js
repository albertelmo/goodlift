const { Pool } = require('pg');
const { getKoreanDate } = require('./utils');

// PostgreSQL 연결 풀 생성 (sessions-db.js와 동일한 설정 사용)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 회원 테이블 생성
const createMembersTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS members (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        gender VARCHAR(10) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        trainer VARCHAR(100) NOT NULL,
        center VARCHAR(100) NOT NULL,
        regdate DATE NOT NULL,
        sessions INTEGER DEFAULT 0,
        remain_sessions INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT '유효'
      )
    `;
    await pool.query(query);
    
    // 데이터베이스 인코딩 설정
    await pool.query("SET client_encoding TO 'UTF8'");
    
    console.log('[PostgreSQL] 회원 테이블이 생성되었습니다.');
  } catch (error) {
    console.error('[PostgreSQL] 회원 테이블 생성 오류:', error);
  }
};

// 회원 목록 조회
const getMembers = async (filters = {}) => {
  try {
    let query = `
      SELECT 
        id, name, gender, phone, trainer, center, 
        regdate::text, sessions, remain_sessions, status, vip_session
      FROM members
    `;
    const params = [];
    let paramIndex = 1;

    // 필터 조건 추가
    const conditions = [];
    if (filters.trainer) {
      conditions.push(`trainer = $${paramIndex++}`);
      params.push(filters.trainer);
    }
    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY name';
    const result = await pool.query(query, params);
    
    // remainSessions 필드명을 camelCase로 변환
    return result.rows.map(row => ({
      ...row,
      remainSessions: row.remain_sessions,
      vip_session: row.vip_session || 0
    }));
  } catch (error) {
    console.error('[PostgreSQL] 회원 조회 오류:', error);
    throw error;
  }
};

// 회원 추가
const addMember = async (member) => {
  try {
    const query = `
      INSERT INTO members (name, gender, phone, trainer, center, regdate, sessions, remain_sessions, status, vip_session)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, name, gender, phone, trainer, center, regdate::text, sessions, remain_sessions, status, vip_session
    `;
    const values = [
      member.name, member.gender, member.phone, member.trainer, member.center,
      member.regdate, member.sessions, member.remainSessions || member.sessions, member.status || '유효', member.vip_session || 0
    ];
    const result = await pool.query(query, values);
    
    const row = result.rows[0];
    return {
      ...row,
      remainSessions: row.remain_sessions,
      vip_session: row.vip_session || 0
    };
  } catch (error) {
    console.error('[PostgreSQL] 회원 추가 오류:', error);
    throw error;
  }
};

// 회원 정보 수정
const updateMember = async (name, updates) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.status) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.trainer) {
      fields.push(`trainer = $${paramIndex++}`);
      values.push(updates.trainer);
    }
    if (updates.gender) {
      fields.push(`gender = $${paramIndex++}`);
      values.push(updates.gender);
    }
    if (updates.center) {
      fields.push(`center = $${paramIndex++}`);
      values.push(updates.center);
    }
    if (updates.phone !== undefined) {
      fields.push(`phone = $${paramIndex++}`);
      values.push(updates.phone);
    }
    if (updates.addSessions && !isNaN(Number(updates.addSessions))) {
      const add = Number(updates.addSessions);
      fields.push(`sessions = sessions + $${paramIndex++}`);
      fields.push(`remain_sessions = remain_sessions + $${paramIndex++}`);
      // 한국 시간대 기준 날짜
      fields.push(`regdate = $${paramIndex++}`);
      values.push(add, add, getKoreanDate());
    }
    if (updates.vipSession !== undefined && !isNaN(Number(updates.vipSession))) {
      fields.push(`vip_session = $${paramIndex++}`);
      values.push(Number(updates.vipSession));
    }

    if (fields.length === 0) {
      throw new Error('수정할 필드가 없습니다.');
    }

    values.push(name);
    const query = `
      UPDATE members 
      SET ${fields.join(', ')}
      WHERE name = $${paramIndex}
      RETURNING id, name, gender, phone, trainer, center, regdate::text, sessions, remain_sessions, status, vip_session
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('회원을 찾을 수 없습니다.');
    }
    
    const row = result.rows[0];
    return {
      ...row,
      remainSessions: row.remain_sessions,
      vip_session: row.vip_session || 0
    };
  } catch (error) {
    console.error('[PostgreSQL] 회원 수정 오류:', error);
    throw error;
  }
};

// 회원 잔여세션 차감 (세션 출석 시)
const decrementRemainSessions = async (memberName) => {
  try {
    const query = `
      UPDATE members 
      SET remain_sessions = GREATEST(remain_sessions - 1, 0)
      WHERE name = $1
      RETURNING id, name, remain_sessions
    `;
    
    const result = await pool.query(query, [memberName]);
    
    if (result.rows.length === 0) {
      throw new Error('회원을 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 잔여세션 차감 오류:', error);
    throw error;
  }
};

// 회원 이름으로 조회
const getMemberByName = async (name) => {
  try {
    const query = `
      SELECT id, name, gender, phone, trainer, center, 
             regdate::text, sessions, remain_sessions, status
      FROM members 
      WHERE name = $1
    `;
    
    const result = await pool.query(query, [name]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      ...row,
      remainSessions: row.remain_sessions
    };
  } catch (error) {
    console.error('[PostgreSQL] 회원 조회 오류:', error);
    throw error;
  }
};

// 회원 삭제
const deleteMember = async (name) => {
  try {
    const query = `
      DELETE FROM members 
      WHERE name = $1
      RETURNING id, name
    `;
    
    const result = await pool.query(query, [name]);
    
    if (result.rows.length === 0) {
      throw new Error('회원을 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 회원 삭제 오류:', error);
    throw error;
  }
};

// vip_session 필드 마이그레이션
const migrateVipSessionField = async () => {
  try {
    // vip_session 컬럼이 존재하는지 확인
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'members' AND column_name = 'vip_session'
    `;
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      // vip_session 컬럼이 없으면 추가
      const alterQuery = `
        ALTER TABLE members 
        ADD COLUMN vip_session INTEGER DEFAULT 0 CHECK (vip_session >= 0 AND vip_session <= 99)
      `;
      await pool.query(alterQuery);
      console.log('[Migration] vip_session 컬럼이 추가되었습니다.');
    } else {
      // vip_session 컬럼이 이미 존재하면 제약 조건 업데이트
      try {
        // 기존 제약 조건 삭제 (제약 조건 이름을 찾아서 삭제)
        const constraintQuery = `
          SELECT constraint_name 
          FROM information_schema.check_constraints 
          WHERE constraint_schema = 'public' 
          AND constraint_name LIKE '%vip_session%'
        `;
        const constraintResult = await pool.query(constraintQuery);
        
        if (constraintResult.rows.length > 0) {
          const constraintName = constraintResult.rows[0].constraint_name;
          await pool.query(`ALTER TABLE members DROP CONSTRAINT ${constraintName}`);
          console.log(`[Migration] 기존 제약 조건 ${constraintName} 삭제됨`);
        }
        
        // 새로운 제약 조건 추가
        const newConstraintQuery = `
          ALTER TABLE members 
          ADD CONSTRAINT vip_session_range_check 
          CHECK (vip_session >= 0 AND vip_session <= 99)
        `;
        await pool.query(newConstraintQuery);
        console.log('[Migration] vip_session 제약 조건이 0~99로 업데이트되었습니다.');
      } catch (constraintError) {
        console.log('[Migration] 제약 조건 업데이트 중 오류 (무시됨):', constraintError.message);
      }
    }
  } catch (error) {
    console.error('[Migration] vip_session 컬럼 마이그레이션 오류:', error);
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  try {
    await createMembersTable();
    // await migrateVipSessionField(); // 마이그레이션 실행
    console.log('[PostgreSQL] 회원 데이터베이스 초기화 완료');
  } catch (error) {
    console.error('[PostgreSQL] 회원 데이터베이스 초기화 오류:', error);
  }
};

module.exports = {
  initializeDatabase,
  getMembers,
  addMember,
  updateMember,
  decrementRemainSessions,
  getMemberByName,
  deleteMember,
  // 센터 이름 일괄 변경 (oldName -> newName)
  renameCenter: async (oldName, newName) => {
    try {
      const result = await pool.query(
        'UPDATE members SET center = $2 WHERE center = $1',
        [oldName, newName]
      );
      return { updated: result.rowCount };
    } catch (error) {
      console.error('[PostgreSQL] 회원 센터명 일괄 변경 오류:', error);
      throw error;
    }
  }
}; 