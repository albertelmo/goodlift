const { Pool } = require('pg');

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
        regdate::text, sessions, remain_sessions, status
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
      remainSessions: row.remain_sessions
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
      INSERT INTO members (name, gender, phone, trainer, center, regdate, sessions, remain_sessions, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, name, gender, phone, trainer, center, regdate::text, sessions, remain_sessions, status
    `;
    const values = [
      member.name, member.gender, member.phone, member.trainer, member.center,
      member.regdate, member.sessions, member.remainSessions || member.sessions, member.status || '유효'
    ];
    const result = await pool.query(query, values);
    
    const row = result.rows[0];
    return {
      ...row,
      remainSessions: row.remain_sessions
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
    if (updates.addSessions && !isNaN(Number(updates.addSessions))) {
      const add = Number(updates.addSessions);
      fields.push(`sessions = sessions + $${paramIndex++}`);
      fields.push(`remain_sessions = remain_sessions + $${paramIndex++}`);
      fields.push(`regdate = CURRENT_DATE`);
      values.push(add, add);
    }

    if (fields.length === 0) {
      throw new Error('수정할 필드가 없습니다.');
    }

    values.push(name);
    const query = `
      UPDATE members 
      SET ${fields.join(', ')}
      WHERE name = $${paramIndex}
      RETURNING id, name, gender, phone, trainer, center, regdate::text, sessions, remain_sessions, status
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('회원을 찾을 수 없습니다.');
    }
    
    const row = result.rows[0];
    return {
      ...row,
      remainSessions: row.remain_sessions
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

// 데이터베이스 초기화
const initializeDatabase = async () => {
  try {
    await createMembersTable();
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
  getMemberByName
}; 