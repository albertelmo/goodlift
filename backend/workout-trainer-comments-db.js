const { Pool } = require('pg');

// PostgreSQL 연결 풀 생성 (기존 DB 모듈 패턴과 동일)
const basePool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 쿼리 로깅 설정 (테스트용: Render에서도 기본 활성화)
const ENABLE_QUERY_LOGGING = process.env.ENABLE_QUERY_LOGGING !== 'false';
const SLOW_QUERY_THRESHOLD = parseInt(process.env.SLOW_QUERY_THRESHOLD || '100', 10);

/**
 * 쿼리 실행 시간 측정 및 로깅
 */
const logQuery = (query, params, duration) => {
  if (!ENABLE_QUERY_LOGGING) return;
  
  const isSlow = duration >= SLOW_QUERY_THRESHOLD;
  const queryPreview = query.replace(/\s+/g, ' ').trim().substring(0, 150);
  
  if (isSlow) {
    console.warn(`[SLOW QUERY] ${duration}ms - ${queryPreview}${query.length > 150 ? '...' : ''}`);
    if (params && params.length > 0) {
      console.warn(`[PARAMS]`, params.length > 3 ? params.slice(0, 3).concat(['...']) : params);
    }
  } else if (process.env.DEBUG_QUERIES === 'true') {
    console.log(`[QUERY] ${duration}ms - ${queryPreview}${query.length > 150 ? '...' : ''}`);
  }
};

// Pool의 query 메서드를 래핑하여 로깅 추가
const pool = {
  query: async (query, params) => {
    const startTime = Date.now();
    try {
      const result = await basePool.query(query, params);
      const duration = Date.now() - startTime;
      logQuery(query, params, duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[QUERY ERROR] ${duration}ms - ${error.message}`);
      console.error(`[QUERY] ${query.replace(/\s+/g, ' ').trim().substring(0, 200)}`);
      if (params && params.length > 0) {
        console.error(`[PARAMS]`, params.length > 3 ? params.slice(0, 3).concat(['...']) : params);
      }
      throw error;
    }
  },
  connect: basePool.connect.bind(basePool),
  end: basePool.end.bind(basePool),
  on: basePool.on.bind(basePool),
  once: basePool.once.bind(basePool),
  removeListener: basePool.removeListener.bind(basePool),
  removeAllListeners: basePool.removeAllListeners.bind(basePool)
};

// 운동 코멘트 테이블 생성
const createWorkoutTrainerCommentsTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'workout_trainer_comments'
    `;
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE workout_trainer_comments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          workout_date DATE NOT NULL,
          trainer_username VARCHAR(50) NOT NULL,
          trainer_name VARCHAR(100),
          comment TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // 인덱스 생성
      await createWorkoutTrainerCommentsIndexes();
      
      console.log('[PostgreSQL] workout_trainer_comments 테이블이 생성되었습니다.');
    } else {
      console.log('[PostgreSQL] workout_trainer_comments 테이블이 이미 존재합니다.');
      // 기존 테이블 마이그레이션
      await migrateWorkoutTrainerCommentsTable();
    }
  } catch (error) {
    console.error('[PostgreSQL] 운동 코멘트 테이블 생성 오류:', error);
    throw error;
  }
};

// 인덱스 생성
const createWorkoutTrainerCommentsIndexes = async () => {
  try {
    // 날짜별 최신순 조회를 위한 인덱스
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_workout_trainer_comments_user_date 
      ON workout_trainer_comments(app_user_id, workout_date DESC, created_at DESC)
    `);
    
    // 트레이너별 조회를 위한 인덱스
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_workout_trainer_comments_trainer 
      ON workout_trainer_comments(trainer_username)
    `);
    
    console.log('[PostgreSQL] 운동 코멘트 인덱스가 생성되었습니다.');
  } catch (error) {
    console.error('[PostgreSQL] 운동 코멘트 인덱스 생성 오류:', error);
    throw error;
  }
};

// 테이블 마이그레이션
const migrateWorkoutTrainerCommentsTable = async () => {
  try {
    // 컬럼 존재 여부 확인
    const checkColumnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'workout_trainer_comments'
    `;
    const columnsResult = await pool.query(checkColumnsQuery);
    const existingColumns = columnsResult.rows.map(row => row.column_name);
    
    // trainer_name 컬럼이 없으면 추가
    if (!existingColumns.includes('trainer_name')) {
      await pool.query(`
        ALTER TABLE workout_trainer_comments 
        ADD COLUMN trainer_name VARCHAR(100)
      `);
      console.log('[PostgreSQL] workout_trainer_comments 테이블에 trainer_name 컬럼이 추가되었습니다.');
    }
    
    // 인덱스가 없으면 생성
    const checkIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND tablename = 'workout_trainer_comments'
    `;
    const indexesResult = await pool.query(checkIndexQuery);
    const existingIndexes = indexesResult.rows.map(row => row.indexname);
    
    if (!existingIndexes.includes('idx_workout_trainer_comments_user_date')) {
      await createWorkoutTrainerCommentsIndexes();
    }
  } catch (error) {
    console.error('[PostgreSQL] 운동 코멘트 테이블 마이그레이션 오류:', error);
    throw error;
  }
};

// 코멘트 추가
const addComment = async (commentData) => {
  try {
    const query = `
      INSERT INTO workout_trainer_comments (
        app_user_id,
        workout_date,
        trainer_username,
        trainer_name,
        comment,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW() AT TIME ZONE 'Asia/Seoul', NOW() AT TIME ZONE 'Asia/Seoul')
      RETURNING 
        id, app_user_id, workout_date, trainer_username, trainer_name, comment, 
        created_at AT TIME ZONE 'Asia/Seoul' as created_at, 
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
    `;
    const values = [
      commentData.app_user_id,
      commentData.workout_date,
      commentData.trainer_username,
      commentData.trainer_name || null,
      commentData.comment
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 코멘트 추가 오류:', error);
    throw error;
  }
};

// 코멘트 조회 (날짜 범위)
const getComments = async (appUserId, filters = {}) => {
  try {
    let query = `
      SELECT 
        id, app_user_id, workout_date, trainer_username, trainer_name, comment, 
        created_at AT TIME ZONE 'Asia/Seoul' as created_at, 
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
      FROM workout_trainer_comments
      WHERE app_user_id = $1
    `;
    const values = [appUserId];
    let paramIndex = 2;
    
    // 날짜 필터
    if (filters.startDate) {
      query += ` AND workout_date >= $${paramIndex}`;
      values.push(filters.startDate);
      paramIndex++;
    }
    if (filters.endDate) {
      query += ` AND workout_date <= $${paramIndex}`;
      values.push(filters.endDate);
      paramIndex++;
    }
    if (filters.date) {
      query += ` AND workout_date = $${paramIndex}`;
      values.push(filters.date);
      paramIndex++;
    }
    
    // 트레이너 필터
    if (filters.trainer_username) {
      query += ` AND trainer_username = $${paramIndex}`;
      values.push(filters.trainer_username);
      paramIndex++;
    }
    
    // 정렬 (날짜 내림차순, 생성일 내림차순)
    query += ` ORDER BY workout_date DESC, created_at DESC`;
    
    const result = await pool.query(query, values);
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 코멘트 조회 오류:', error);
    throw error;
  }
};

// 코멘트 조회 (ID로)
const getCommentById = async (commentId) => {
  try {
    const query = `
      SELECT 
        id, app_user_id, workout_date, trainer_username, trainer_name, comment, 
        created_at AT TIME ZONE 'Asia/Seoul' as created_at, 
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
      FROM workout_trainer_comments
      WHERE id = $1
    `;
    const result = await pool.query(query, [commentId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] 코멘트 조회 오류:', error);
    throw error;
  }
};

// 코멘트 수정
const updateComment = async (commentId, commentData) => {
  try {
    const query = `
      UPDATE workout_trainer_comments
      SET 
        comment = $1,
        updated_at = NOW() AT TIME ZONE 'Asia/Seoul'
      WHERE id = $2
      RETURNING 
        id, app_user_id, workout_date, trainer_username, trainer_name, comment, 
        created_at AT TIME ZONE 'Asia/Seoul' as created_at, 
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
    `;
    const result = await pool.query(query, [commentData.comment, commentId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] 코멘트 수정 오류:', error);
    throw error;
  }
};

// 코멘트 삭제
const deleteComment = async (commentId) => {
  try {
    const query = `
      DELETE FROM workout_trainer_comments
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(query, [commentId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] 코멘트 삭제 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  await createWorkoutTrainerCommentsTable();
};

// 서버 시작 시 자동 초기화
initializeDatabase().catch(error => {
  console.error('[PostgreSQL] 운동 코멘트 테이블 초기화 오류:', error);
});

module.exports = {
  initializeDatabase,
  addComment,
  getComments,
  getCommentById,
  updateComment,
  deleteComment
};
