const { Pool } = require('pg');

// PostgreSQL 연결 풀 생성 (기존 DB 모듈 패턴과 동일)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 회원 활동 로그 테이블 생성
const createMemberActivityLogsTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'member_activity_logs'
    `;
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE member_activity_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          trainer_username VARCHAR(50) NOT NULL,
          trainer_name VARCHAR(100),
          activity_type VARCHAR(20) NOT NULL CHECK (activity_type IN ('workout_recorded', 'diet_comment_added')),
          activity_message TEXT NOT NULL,
          related_record_id UUID,
          record_date DATE,
          is_read BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // 인덱스 생성
      await createMemberActivityLogsIndexes();
      
      console.log('[PostgreSQL] member_activity_logs 테이블이 생성되었습니다.');
    } else {
      console.log('[PostgreSQL] member_activity_logs 테이블이 이미 존재합니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] 회원 활동 로그 테이블 생성 오류:', error);
    throw error;
  }
};

// 인덱스 생성
const createMemberActivityLogsIndexes = async () => {
  try {
    // 회원별 최신순 조회를 위한 인덱스
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_member_activity_logs_user_created 
      ON member_activity_logs(app_user_id, created_at DESC)
    `);
    
    // 읽지 않은 로그 조회를 위한 인덱스
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_member_activity_logs_user_unread 
      ON member_activity_logs(app_user_id, is_read, created_at DESC)
    `);
    
    console.log('[PostgreSQL] 회원 활동 로그 인덱스가 생성되었습니다.');
  } catch (error) {
    console.error('[PostgreSQL] 회원 활동 로그 인덱스 생성 오류:', error);
    throw error;
  }
};

// 활동 로그 추가
const addActivityLog = async (logData) => {
  try {
    const query = `
      INSERT INTO member_activity_logs (
        app_user_id,
        trainer_username,
        trainer_name,
        activity_type,
        activity_message,
        related_record_id,
        record_date,
        is_read,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() AT TIME ZONE 'Asia/Seoul')
      RETURNING 
        id, app_user_id, trainer_username, trainer_name, activity_type, activity_message,
        related_record_id, record_date, is_read, created_at
    `;
    const values = [
      logData.app_user_id,
      logData.trainer_username,
      logData.trainer_name || null,
      logData.activity_type,
      logData.activity_message,
      logData.related_record_id || null,
      logData.record_date || null,
      false
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 회원 활동 로그 추가 오류:', error);
    throw error;
  }
};

// 회원 활동 로그 조회
const getActivityLogs = async (appUserId, filters = {}) => {
  try {
    let query = `
      SELECT 
        id,
        app_user_id,
        trainer_username,
        trainer_name,
        activity_type,
        activity_message,
        related_record_id,
        record_date,
        is_read,
        created_at
      FROM member_activity_logs
      WHERE app_user_id = $1
    `;
    const params = [appUserId];
    let paramIndex = 2;
    
    // 읽지 않은 로그만 조회
    if (filters.unread_only === true) {
      query += ` AND is_read = false`;
    }
    
    // 날짜 필터
    if (filters.start_date) {
      query += ` AND created_at >= $${paramIndex++}`;
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      query += ` AND created_at <= $${paramIndex++}`;
      params.push(filters.end_date);
    }
    
    // 정렬 (최신순)
    query += ` ORDER BY created_at DESC`;
    
    // 제한
    if (filters.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(filters.limit);
    } else {
      // 기본값: 최신 50개
      query += ` LIMIT $${paramIndex++}`;
      params.push(50);
    }
    
    // 오프셋 (페이지네이션)
    if (filters.offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(filters.offset);
    }
    
    const result = await pool.query(query, params);
    
    // 날짜 정규화
    for (const log of result.rows) {
      if (log.created_at) {
        if (log.created_at instanceof Date) {
          log.created_at = log.created_at.toISOString();
        }
      }
    }
    
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 회원 활동 로그 조회 오류:', error);
    throw error;
  }
};

// 읽지 않은 로그 개수 조회
const getUnreadCount = async (appUserId) => {
  try {
    const query = `
      SELECT COUNT(*) as count
      FROM member_activity_logs
      WHERE app_user_id = $1 AND is_read = false
    `;
    const result = await pool.query(query, [appUserId]);
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('[PostgreSQL] 읽지 않은 로그 개수 조회 오류:', error);
    throw error;
  }
};

// 로그 읽음 처리
const markAsRead = async (logId, appUserId) => {
  try {
    const query = `
      UPDATE member_activity_logs
      SET is_read = true
      WHERE id = $1 AND app_user_id = $2
      RETURNING id, is_read
    `;
    const result = await pool.query(query, [logId, appUserId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] 로그 읽음 처리 오류:', error);
    throw error;
  }
};

// 모든 로그 읽음 처리
const markAllAsRead = async (appUserId) => {
  try {
    const query = `
      UPDATE member_activity_logs
      SET is_read = true
      WHERE app_user_id = $1 AND is_read = false
    `;
    const result = await pool.query(query, [appUserId]);
    return { count: result.rowCount || 0 };
  } catch (error) {
    console.error('[PostgreSQL] 전체 로그 읽음 처리 오류:', error);
    throw error;
  }
};

// 오래된 로그 삭제 (30일 이상 된 읽은 로그)
const cleanOldLogs = async (daysOld = 30) => {
  try {
    const query = `
      DELETE FROM member_activity_logs
      WHERE is_read = true 
        AND created_at < NOW() AT TIME ZONE 'Asia/Seoul' - INTERVAL '${daysOld} days'
      RETURNING COUNT(*) as count
    `;
    const result = await pool.query(query);
    const deletedCount = parseInt(result.rows[0]?.count || 0);
    if (deletedCount > 0) {
      console.log(`[PostgreSQL] ${deletedCount}개의 오래된 회원 활동 로그가 삭제되었습니다.`);
    }
    return { deletedCount };
  } catch (error) {
    console.error('[PostgreSQL] 오래된 로그 삭제 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  await createMemberActivityLogsTable();
};

module.exports = {
  initializeDatabase,
  addActivityLog,
  getActivityLogs,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  cleanOldLogs
};
