const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 등록 로그 테이블 생성
const createRegistrationLogsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS registration_logs (
        id SERIAL PRIMARY KEY,
        member_name VARCHAR(100) NOT NULL,
        registration_type VARCHAR(20) NOT NULL,
        session_count INTEGER NOT NULL,
        center VARCHAR(100) NOT NULL,
        trainer VARCHAR(100) NOT NULL,
        registration_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await pool.query(query);
    await pool.query("SET client_encoding TO 'UTF8'");
    console.log('[PostgreSQL] 등록 로그 테이블이 생성되었습니다.');
  } catch (error) {
    console.error('[PostgreSQL] 등록 로그 테이블 생성 오류:', error);
  }
};

// 로그 추가
const addLog = async (logData) => {
  try {
    const query = `
      INSERT INTO registration_logs (member_name, registration_type, session_count, center, trainer, registration_date)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, member_name, registration_type, session_count, center, trainer, registration_date::text, created_at::text
    `;
    const values = [
      logData.member_name,
      logData.registration_type,
      logData.session_count,
      logData.center,
      logData.trainer,
      logData.registration_date
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 등록 로그 추가 오류:', error);
    throw error;
  }
};

// 특정 월의 로그 조회
const getLogsByMonth = async (yearMonth) => {
  try {
    const query = `
      SELECT id, member_name, registration_type, session_count, center, trainer, registration_date::text, created_at::text
      FROM registration_logs 
      WHERE TO_CHAR(registration_date, 'YYYY-MM') = $1
      ORDER BY registration_date DESC, created_at DESC
    `;
    const result = await pool.query(query, [yearMonth]);
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 등록 로그 조회 오류:', error);
    throw error;
  }
};

// 모든 로그 조회 (최신순)
const getAllLogs = async () => {
  try {
    const query = `
      SELECT id, member_name, registration_type, session_count, center, trainer, registration_date::text, created_at::text
      FROM registration_logs 
      ORDER BY registration_date DESC, created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 전체 등록 로그 조회 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  try {
    await createRegistrationLogsTable();
    console.log('[PostgreSQL] 등록 로그 데이터베이스 초기화 완료');
  } catch (error) {
    console.error('[PostgreSQL] 등록 로그 데이터베이스 초기화 오류:', error);
  }
};

module.exports = {
  initializeDatabase,
  addLog,
  getLogsByMonth,
  getAllLogs
}; 