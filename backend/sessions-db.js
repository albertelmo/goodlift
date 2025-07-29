const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL 연결 풀 생성
const pool = new Pool({
  user: 'fms_user',
  host: 'localhost',
  database: 'fms_db',
  password: 'password',
  port: 5432,
  ssl: false
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
    let query = 'SELECT id, member, trainer, date::text, SUBSTRING(time::text, 1, 5) as time, status FROM sessions';
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
      INSERT INTO sessions (id, member, trainer, date, time, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, member, trainer, date::text, SUBSTRING(time::text, 1, 5) as time, status
    `;
    const values = [session.id, session.member, session.trainer, session.date, session.time, session.status];
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

    if (fields.length === 0) {
      throw new Error('업데이트할 필드가 없습니다.');
    }

    values.push(id);
    const query = `
      UPDATE sessions 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, member, trainer, date::text, SUBSTRING(time::text, 1, 5) as time, status
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
    const query = 'SELECT id, member, trainer, date::text, SUBSTRING(time::text, 1, 5) as time, status FROM sessions WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 세션 ID 조회 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  try {
    await createSessionsTable();
    console.log('[PostgreSQL] 데이터베이스 초기화 완료');
  } catch (error) {
    console.error('[PostgreSQL] 데이터베이스 초기화 오류:', error);
  }
};

module.exports = {
  initializeDatabase,
  getSessions,
  addSession,
  updateSession,
  deleteSession,
  getSessionById,
  pool
}; 