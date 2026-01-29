const { Pool } = require('pg');

// PostgreSQL 연결 풀 생성 (기존 DB 모듈 패턴과 동일)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 활동 이벤트 테이블 생성
const createAppUserActivityEventsTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'app_user_activity_events'
    `;
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE app_user_activity_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          actor_app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          subject_app_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
          actor_role VARCHAR(20) NOT NULL,
          event_type VARCHAR(50) NOT NULL,
          source VARCHAR(30) NOT NULL,
          meta JSONB,
          event_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // 인덱스 생성
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_app_user_activity_events_event_at
        ON app_user_activity_events(event_at)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_app_user_activity_events_actor
        ON app_user_activity_events(actor_app_user_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_app_user_activity_events_subject
        ON app_user_activity_events(subject_app_user_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_app_user_activity_events_type
        ON app_user_activity_events(event_type)
      `);
      
      console.log('[PostgreSQL] app_user_activity_events 테이블이 생성되었습니다.');
    } else {
      console.log('[PostgreSQL] app_user_activity_events 테이블이 이미 존재합니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] 활동 이벤트 테이블 생성 오류:', error);
    throw error;
  }
};

// 활동 이벤트 추가
const addActivityEvent = async (eventData) => {
  try {
    const query = `
      INSERT INTO app_user_activity_events (
        actor_app_user_id,
        subject_app_user_id,
        actor_role,
        event_type,
        source,
        meta
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, event_at
    `;
    const values = [
      eventData.actor_app_user_id,
      eventData.subject_app_user_id || null,
      eventData.actor_role,
      eventData.event_type,
      eventData.source,
      eventData.meta || null
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 활동 이벤트 추가 오류:', error);
    throw error;
  }
};

// 기간별 활동 통계 조회
const getActivityStatsByDateRange = async (startDate, endDate) => {
  try {
    const query = `
      SELECT 
        event_type,
        actor_role,
        source,
        COUNT(*) AS event_count,
        COUNT(DISTINCT actor_app_user_id) AS actor_count,
        COUNT(DISTINCT subject_app_user_id) AS subject_count
      FROM app_user_activity_events
      WHERE event_at >= $1::date
        AND event_at < ($2::date + INTERVAL '1 day')
      GROUP BY event_type, actor_role, source
    `;
    
    const result = await pool.query(query, [startDate, endDate]);
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 활동 통계 조회 오류:', error);
    throw error;
  }
};

// 운동기록 날짜 기준 건수 (종류 무관)
const getWorkoutDistinctDateCountsByDateRange = async (startDate, endDate) => {
  try {
    const query = `
      SELECT 
        actor_role,
        source,
        COUNT(DISTINCT (
          COALESCE(subject_app_user_id::text, actor_app_user_id::text)
          || ':' ||
          COALESCE(split_part(meta->>'workout_date', 'T', 1), '')
        )) AS event_count
      FROM app_user_activity_events
      WHERE event_type = 'workout_create'
        AND event_at >= $1::date
        AND event_at < ($2::date + INTERVAL '1 day')
      GROUP BY actor_role, source
    `;
    
    const result = await pool.query(query, [startDate, endDate]);
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 운동 날짜 기준 통계 조회 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  try {
    await createAppUserActivityEventsTable();
    console.log('[PostgreSQL] 활동 이벤트 데이터베이스 초기화 완료');
  } catch (error) {
    console.error('[PostgreSQL] 활동 이벤트 데이터베이스 초기화 오류:', error);
  }
};

module.exports = {
  initializeDatabase,
  addActivityEvent,
  getActivityStatsByDateRange,
  getWorkoutDistinctDateCountsByDateRange
};
