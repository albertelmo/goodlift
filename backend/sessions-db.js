const { Pool } = require('pg');

// PostgreSQL 연결 풀 생성
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 세션 테이블 생성
const createSessionsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY,
        member VARCHAR(100) NOT NULL,
        trainer VARCHAR(100) NOT NULL,
        date DATE NOT NULL,
        time TIME NOT NULL,
        status VARCHAR(20) DEFAULT '예정'
      )
    `;
    await pool.query(query);
    
    // 데이터베이스 인코딩 설정
    await pool.query("SET client_encoding TO 'UTF8'");
    
    console.log('[PostgreSQL] 세션 테이블이 생성되었습니다.');
  } catch (error) {
    console.error('[PostgreSQL] 테이블 생성 오류:', error);
  }
};

// 세션 목록 조회
const getSessions = async (filters = {}) => {
  try {
    let query = 'SELECT id, member, trainer, date::text, SUBSTRING(time::text, 1, 5) as time, status, "30min" FROM sessions';
    const params = [];
    let paramIndex = 1;

    // 필터 조건 추가
    const conditions = [];
    if (filters.trainer) {
      conditions.push(`trainer = $${paramIndex++}`);
      params.push(filters.trainer);
    }
    if (filters.date) {
      conditions.push(`date = $${paramIndex++}`);
      params.push(filters.date);
    }
    if (filters.week) {
      conditions.push(`date >= $${paramIndex++} AND date <= $${paramIndex++}`);
      const weekStart = new Date(filters.week);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      params.push(weekStart.toISOString().split('T')[0]);
      params.push(weekEnd.toISOString().split('T')[0]);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY date, time';
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 세션 조회 오류:', error);
    throw error;
  }
};

// 세션 추가
const addSession = async (session) => {
  try {
    const query = `
      INSERT INTO sessions (id, member, trainer, date, time, status, "30min")
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, member, trainer, date::text, SUBSTRING(time::text, 1, 5) as time, status, "30min"
    `;
    const values = [session.id, session.member, session.trainer, session.date, session.time, session.status, session['30min'] || false];
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 세션 추가 오류:', error);
    throw error;
  }
};

// 세션 수정
const updateSession = async (id, updates) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.date) {
      fields.push(`date = $${paramIndex++}`);
      values.push(updates.date);
    }
    if (updates.time) {
      fields.push(`time = $${paramIndex++}`);
      values.push(updates.time);
    }
    if (updates.status) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates['30min'] !== undefined) {
      fields.push(`"30min" = $${paramIndex++}`);
      values.push(updates['30min']);
    }

    if (fields.length === 0) {
      throw new Error('업데이트할 필드가 없습니다.');
    }

    values.push(id);
    const query = `
      UPDATE sessions 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, member, trainer, date::text, SUBSTRING(time::text, 1, 5) as time, status, "30min"
    `;
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 세션 수정 오류:', error);
    throw error;
  }
};

// 세션 삭제
const deleteSession = async (id) => {
  try {
    const query = 'DELETE FROM sessions WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 세션 삭제 오류:', error);
    throw error;
  }
};

// 세션 ID로 조회
const getSessionById = async (id) => {
  try {
    const query = 'SELECT id, member, trainer, date::text, SUBSTRING(time::text, 1, 5) as time, status, "30min" FROM sessions WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 세션 ID 조회 오류:', error);
    throw error;
  }
};

// 날짜 범위로 세션 조회
async function getSessionsByDateRange(startDate, endDate) {
  try {
    const query = `
      SELECT id, member, trainer, date::text, SUBSTRING(time::text, 1, 5) as time, status, "30min" FROM sessions 
      WHERE date >= $1 AND date <= $2 
      ORDER BY date ASC, time ASC
    `;
    
    const result = await pool.query(query, [startDate, endDate]);
    return result.rows;
  } catch (error) {
    console.error('날짜 범위 세션 조회 오류:', error);
    throw error;
  }
}

// 시간 중복 체크 (같은 트레이너의 해당 시간 ±30분)
const checkTimeConflict = async (trainer, date, time, is30min = false) => {
  try {
    let query;
    if (is30min) {
      // 30분 세션: 해당 시간과 이후 30분만 체크
      query = `
        SELECT COUNT(*) FROM sessions 
        WHERE trainer = $1 
          AND date = $2 
          AND (
            time = $3::time 
            OR time = ($3::time + INTERVAL '30 minutes')
          )
      `;
    } else {
      // 1시간 세션: 이전 30분, 해당 시간, 다음 30분 체크
      query = `
        SELECT COUNT(*) FROM sessions 
        WHERE trainer = $1 
          AND date = $2 
          AND (
            time = $3::time 
            OR time = ($3::time - INTERVAL '30 minutes')
            OR time = ($3::time + INTERVAL '30 minutes')
          )
      `;
    }
    const result = await pool.query(query, [trainer, date, time]);
    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    console.error('[PostgreSQL] 시간 중복 체크 오류:', error);
    throw error;
  }
};

// 여러 세션 일괄 추가
const addMultipleSessions = async (sessions) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const addedSessions = [];
      for (const session of sessions) {
        const query = `
          INSERT INTO sessions (id, member, trainer, date, time, status, "30min")
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, member, trainer, date::text, SUBSTRING(time::text, 1, 5) as time, status, "30min"
        `;
        const values = [session.id, session.member, session.trainer, session.date, session.time, session.status, session['30min'] || false];
        const result = await client.query(query, values);
        addedSessions.push(result.rows[0]);
      }
      
      await client.query('COMMIT');
      return addedSessions;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[PostgreSQL] 여러 세션 추가 오류:', error);
    throw error;
  }
};

// 회원별 세션 삭제
const deleteSessionsByMember = async (memberName) => {
  try {
    const query = `
      DELETE FROM sessions 
      WHERE member = $1
      RETURNING id, member
    `;
    
    const result = await pool.query(query, [memberName]);
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 회원별 세션 삭제 오류:', error);
    throw error;
  }
};

// 30min 필드 마이그레이션
const migrate30minField = async () => {
  try {
    // 30min 컬럼이 존재하는지 확인
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sessions' AND column_name = '30min'
    `;
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      // 30min 컬럼이 없으면 추가
      const alterQuery = `
        ALTER TABLE sessions 
        ADD COLUMN "30min" BOOLEAN DEFAULT false
      `;
      await pool.query(alterQuery);
      console.log('[Migration] 30min 컬럼이 추가되었습니다.');
    } else {
      console.log('[Migration] 30min 컬럼이 이미 존재합니다.');
    }
  } catch (error) {
    console.error('[Migration] 30min 컬럼 마이그레이션 오류:', error);
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  try {
    await createSessionsTable();
    // await migrate30minField(); // 마이그레이션 실행
    console.log('[PostgreSQL] 데이터베이스 초기화 완료');
  } catch (error) {
    console.error('[PostgreSQL] 데이터베이스 초기화 오류:', error);
  }
};

module.exports = {
  initializeDatabase,
  migrate30minField,
  getSessions,
  addSession,
  updateSession,
  deleteSession,
  getSessionById,
  getSessionsByDateRange,
  checkTimeConflict,
  addMultipleSessions,
  deleteSessionsByMember,
  pool
}; 