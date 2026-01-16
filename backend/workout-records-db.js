const { Pool } = require('pg');

// PostgreSQL 연결 풀 생성 (기존 DB 모듈 패턴과 동일)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 운동기록 테이블 생성
const createWorkoutRecordsTable = async () => {
  try {
    // 테이블 존재 여부 확인
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'workout_records'
    `;
    const checkResult = await pool.query(checkQuery);
    
    // 테이블이 없을 때만 생성
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE workout_records (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          workout_date DATE NOT NULL,
          workout_type VARCHAR(50),
          duration_minutes INTEGER,
          calories_burned INTEGER,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // 인덱스 생성
      await createWorkoutRecordsIndexes();
      
      console.log('[PostgreSQL] 운동기록 테이블이 생성되었습니다.');
    } else {
      console.log('[PostgreSQL] 운동기록 테이블이 이미 존재합니다.');
      // 기존 테이블에 컬럼 추가 (마이그레이션)
      await migrateWorkoutRecordsTable();
    }
  } catch (error) {
    console.error('[PostgreSQL] 운동기록 테이블 생성 오류:', error);
  }
};

// 기존 테이블에 컬럼 추가 (마이그레이션)
const migrateWorkoutRecordsTable = async () => {
  // 향후 컬럼 추가 시 사용
};

// 인덱스 생성
const createWorkoutRecordsIndexes = async () => {
  try {
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_workout_records_user_id ON workout_records(app_user_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_workout_records_date ON workout_records(workout_date)
    `);
  } catch (error) {
    console.error('[PostgreSQL] 운동기록 인덱스 생성 오류:', error);
  }
};

// 운동기록 목록 조회 (앱 유저 ID로 필터링)
const getWorkoutRecords = async (appUserId, filters = {}) => {
  try {
    let query = `
      SELECT 
        id,
        app_user_id,
        workout_date,
        workout_type,
        duration_minutes,
        calories_burned,
        notes,
        created_at,
        updated_at
      FROM workout_records
      WHERE app_user_id = $1
    `;
    const params = [appUserId];
    
    // 날짜 필터
    if (filters.startDate) {
      query += ` AND workout_date >= $${params.length + 1}`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ` AND workout_date <= $${params.length + 1}`;
      params.push(filters.endDate);
    }
    
    // 정렬 (최신순)
    query += ` ORDER BY workout_date DESC, created_at DESC`;
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 운동기록 조회 오류:', error);
    throw error;
  }
};

// 운동기록 단일 조회
const getWorkoutRecordById = async (id, appUserId) => {
  try {
    const query = `
      SELECT 
        id,
        app_user_id,
        workout_date,
        workout_type,
        duration_minutes,
        calories_burned,
        notes,
        created_at,
        updated_at
      FROM workout_records
      WHERE id = $1 AND app_user_id = $2
    `;
    const result = await pool.query(query, [id, appUserId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] 운동기록 단일 조회 오류:', error);
    throw error;
  }
};

// 운동기록 추가
const addWorkoutRecord = async (workoutData) => {
  try {
    const query = `
      INSERT INTO workout_records (
        app_user_id,
        workout_date,
        workout_type,
        duration_minutes,
        calories_burned,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [
      workoutData.app_user_id,
      workoutData.workout_date,
      workoutData.workout_type || null,
      workoutData.duration_minutes || null,
      workoutData.calories_burned || null,
      workoutData.notes || null
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 운동기록 추가 오류:', error);
    throw error;
  }
};

// 운동기록 수정
const updateWorkoutRecord = async (id, appUserId, updates) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (updates.workout_date !== undefined) {
      fields.push(`workout_date = $${paramIndex++}`);
      values.push(updates.workout_date);
    }
    if (updates.workout_type !== undefined) {
      fields.push(`workout_type = $${paramIndex++}`);
      values.push(updates.workout_type || null);
    }
    if (updates.duration_minutes !== undefined) {
      fields.push(`duration_minutes = $${paramIndex++}`);
      values.push(updates.duration_minutes || null);
    }
    if (updates.calories_burned !== undefined) {
      fields.push(`calories_burned = $${paramIndex++}`);
      values.push(updates.calories_burned || null);
    }
    if (updates.notes !== undefined) {
      fields.push(`notes = $${paramIndex++}`);
      values.push(updates.notes || null);
    }
    
    if (fields.length === 0) {
      throw new Error('수정할 필드가 없습니다.');
    }
    
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id, appUserId);
    
    const query = `
      UPDATE workout_records
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex++} AND app_user_id = $${paramIndex++}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] 운동기록 수정 오류:', error);
    throw error;
  }
};

// 운동기록 삭제
const deleteWorkoutRecord = async (id, appUserId) => {
  try {
    const query = `
      DELETE FROM workout_records
      WHERE id = $1 AND app_user_id = $2
      RETURNING id
    `;
    const result = await pool.query(query, [id, appUserId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] 운동기록 삭제 오류:', error);
    throw error;
  }
};

// 통계 조회 (기간별 합계)
const getWorkoutStats = async (appUserId, startDate, endDate) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_workouts,
        COALESCE(SUM(duration_minutes), 0) as total_duration,
        COALESCE(SUM(calories_burned), 0) as total_calories
      FROM workout_records
      WHERE app_user_id = $1
        AND workout_date >= $2
        AND workout_date <= $3
    `;
    const result = await pool.query(query, [appUserId, startDate, endDate]);
    return result.rows[0] || { total_workouts: 0, total_duration: 0, total_calories: 0 };
  } catch (error) {
    console.error('[PostgreSQL] 운동기록 통계 조회 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  await createWorkoutRecordsTable();
};

module.exports = {
  initializeDatabase,
  getWorkoutRecords,
  getWorkoutRecordById,
  addWorkoutRecord,
  updateWorkoutRecord,
  deleteWorkoutRecord,
  getWorkoutStats
};
