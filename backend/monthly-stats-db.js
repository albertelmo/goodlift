const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 월별 통계 테이블 생성
const createMonthlyStatsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS monthly_stats (
        id SERIAL PRIMARY KEY,
        year_month VARCHAR(7) NOT NULL, -- YYYY-MM 형식
        new_sessions INTEGER DEFAULT 0,
        re_registration_sessions INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(year_month)
      )
    `;
    await pool.query(query);
    await pool.query("SET client_encoding TO 'UTF8'");
    console.log('[PostgreSQL] 월별 통계 테이블이 생성되었습니다.');
  } catch (error) {
    console.error('[PostgreSQL] 월별 통계 테이블 생성 오류:', error);
  }
};

// 현재 월의 년월 문자열 반환 (YYYY-MM)
const getCurrentYearMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

// 월별 통계 가져오기 (조회 시 자동 생성)
const getMonthlyStats = async (yearMonth = null) => {
  try {
    const targetMonth = yearMonth || getCurrentYearMonth();
    
    // 먼저 해당 월 데이터가 있는지 확인
    const checkQuery = `SELECT COUNT(*) FROM monthly_stats WHERE year_month = $1`;
    const checkResult = await pool.query(checkQuery, [targetMonth]);
    const exists = parseInt(checkResult.rows[0].count) > 0;
    
    // 데이터가 없으면 자동 생성
    if (!exists) {
      const insertQuery = `
        INSERT INTO monthly_stats (year_month, new_sessions, re_registration_sessions)
        VALUES ($1, 0, 0)
      `;
      await pool.query(insertQuery, [targetMonth]);
    }
    
    // 데이터 조회
    const query = `
      SELECT year_month, new_sessions, re_registration_sessions,
             (new_sessions + re_registration_sessions) as total_sessions
      FROM monthly_stats 
      WHERE year_month = $1
    `;
    const result = await pool.query(query, [targetMonth]);
    return result.rows[0] || { year_month: targetMonth, new_sessions: 0, re_registration_sessions: 0, total_sessions: 0 };
  } catch (error) {
    console.error('[PostgreSQL] 월별 통계 조회 오류:', error);
    return { year_month: targetMonth, new_sessions: 0, re_registration_sessions: 0, total_sessions: 0 };
  }
};

// 올해 월별 통계 가져오기
const getAllMonthlyStats = async () => {
  try {
    // 올해 1월부터 현재 월까지의 년월 배열 생성 (최신 월이 맨 위)
    const months = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    for (let month = currentDate.getMonth() + 1; month >= 1; month--) {
      const yearMonth = `${currentYear}-${String(month).padStart(2, '0')}`;
      months.push(yearMonth);
    }
    
    // 각 월별로 데이터 조회 (없으면 0으로 초기화)
    const stats = [];
    for (const yearMonth of months) {
      const stat = await getMonthlyStats(yearMonth);
      stats.push(stat);
    }
    
    return stats;
  } catch (error) {
    console.error('[PostgreSQL] 전체 월별 통계 조회 오류:', error);
    return [];
  }
};

// 신규 세션 추가 (회원 등록 시)
const addNewSessions = async (sessionCount, yearMonth = null) => {
  try {
    const targetMonth = yearMonth || getCurrentYearMonth();
    
    // 실제 DB에서 해당 월 데이터가 있는지 확인
    const checkQuery = `SELECT COUNT(*) FROM monthly_stats WHERE year_month = $1`;
    const checkResult = await pool.query(checkQuery, [targetMonth]);
    const exists = parseInt(checkResult.rows[0].count) > 0;
    
    if (exists) {
      // 기존 통계 업데이트
      const query = `
        UPDATE monthly_stats 
        SET new_sessions = new_sessions + $1, updated_at = CURRENT_TIMESTAMP
        WHERE year_month = $2
      `;
      await pool.query(query, [sessionCount, targetMonth]);
    } else {
      // 새 통계 생성
      const query = `
        INSERT INTO monthly_stats (year_month, new_sessions, re_registration_sessions)
        VALUES ($1, $2, 0)
      `;
      await pool.query(query, [targetMonth, sessionCount]);
    }
    

  } catch (error) {
    console.error('[PostgreSQL] 신규 세션 추가 오류:', error);
  }
};

// 재등록 세션 추가 (회원 정보 수정 시)
const addReRegistrationSessions = async (sessionCount, yearMonth = null) => {
  try {
    const targetMonth = yearMonth || getCurrentYearMonth();
    
    // 실제 DB에서 해당 월 데이터가 있는지 확인
    const checkQuery = `SELECT COUNT(*) FROM monthly_stats WHERE year_month = $1`;
    const checkResult = await pool.query(checkQuery, [targetMonth]);
    const exists = parseInt(checkResult.rows[0].count) > 0;
    
    if (exists) {
      // 기존 통계 업데이트
      const query = `
        UPDATE monthly_stats 
        SET re_registration_sessions = re_registration_sessions + $1, updated_at = CURRENT_TIMESTAMP
        WHERE year_month = $2
      `;
      await pool.query(query, [sessionCount, targetMonth]);
    } else {
      // 새 통계 생성
      const query = `
        INSERT INTO monthly_stats (year_month, new_sessions, re_registration_sessions)
        VALUES ($1, 0, $2)
      `;
      await pool.query(query, [targetMonth, sessionCount]);
    }
    

  } catch (error) {
    console.error('[PostgreSQL] 재등록 세션 추가 오류:', error);
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  await createMonthlyStatsTable();
};

module.exports = {
  initializeDatabase,
  getMonthlyStats,
  getAllMonthlyStats,
  addNewSessions,
  addReRegistrationSessions,
  getCurrentYearMonth
}; 