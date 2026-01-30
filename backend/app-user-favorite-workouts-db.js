const { Pool } = require('pg');

// PostgreSQL 연결 풀 생성 (기존 DB 모듈 패턴과 동일)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 앱 유저 즐겨찾기 운동 테이블 생성
const createAppUserFavoriteWorkoutsTable = async () => {
  try {
    // 테이블 존재 여부 확인
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'app_user_favorite_workouts'
    `;
    const checkResult = await pool.query(checkQuery);
    
    // 테이블이 없을 때만 생성
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE app_user_favorite_workouts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          workout_type_id UUID NOT NULL REFERENCES workout_types(id) ON DELETE CASCADE,
          display_order INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(app_user_id, workout_type_id)
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // 인덱스 생성
      await createFavoriteWorkoutsIndexes();
      
      console.log('[PostgreSQL] app_user_favorite_workouts 테이블이 생성되었습니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] 앱 유저 즐겨찾기 운동 테이블 생성 오류:', error);
    throw error;
  }
};

// 인덱스 생성
const createFavoriteWorkoutsIndexes = async () => {
  try {
    // app_user_id 인덱스 확인 및 생성
    const checkAppUserIdIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND tablename = 'app_user_favorite_workouts' AND indexname = 'idx_app_user_favorite_workouts_app_user_id'
    `;
    const checkAppUserIdIndexResult = await pool.query(checkAppUserIdIndexQuery);
    
    if (checkAppUserIdIndexResult.rows.length === 0) {
      await pool.query(`CREATE INDEX idx_app_user_favorite_workouts_app_user_id ON app_user_favorite_workouts(app_user_id)`);
      console.log('[PostgreSQL] idx_app_user_favorite_workouts_app_user_id 인덱스가 생성되었습니다.');
    }
    
    // workout_type_id 인덱스 확인 및 생성
    const checkWorkoutTypeIdIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND tablename = 'app_user_favorite_workouts' AND indexname = 'idx_app_user_favorite_workouts_workout_type_id'
    `;
    const checkWorkoutTypeIdIndexResult = await pool.query(checkWorkoutTypeIdIndexQuery);
    
    if (checkWorkoutTypeIdIndexResult.rows.length === 0) {
      await pool.query(`CREATE INDEX idx_app_user_favorite_workouts_workout_type_id ON app_user_favorite_workouts(workout_type_id)`);
      console.log('[PostgreSQL] idx_app_user_favorite_workouts_workout_type_id 인덱스가 생성되었습니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] 앱 유저 즐겨찾기 운동 인덱스 생성 오류:', error);
    throw error;
  }
};

// ========== 즐겨찾기 CRUD 함수 ==========

// 즐겨찾기 목록 조회
const getFavoriteWorkouts = async (appUserId) => {
  try {
    const query = `
      SELECT 
        fw.id,
        fw.app_user_id,
        fw.workout_type_id,
        fw.display_order,
        fw.created_at,
        fw.updated_at,
        wt.name as workout_type_name,
        wt.type as workout_type_type
      FROM app_user_favorite_workouts fw
      INNER JOIN workout_types wt ON fw.workout_type_id = wt.id
      WHERE fw.app_user_id = $1
      ORDER BY fw.display_order ASC, fw.created_at ASC
    `;
    const result = await pool.query(query, [appUserId]);
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 즐겨찾기 운동 목록 조회 오류:', error);
    throw error;
  }
};

// 즐겨찾기 추가
const addFavoriteWorkout = async (appUserId, workoutTypeId, displayOrder = null) => {
  try {
    // 기존 즐겨찾기 개수 조회하여 display_order 자동 설정
    let order = displayOrder;
    if (order === null || order === undefined) {
      const countResult = await pool.query(
        'SELECT COUNT(*) as count FROM app_user_favorite_workouts WHERE app_user_id = $1',
        [appUserId]
      );
      order = parseInt(countResult.rows[0].count);
    }
    
    const query = `
      INSERT INTO app_user_favorite_workouts (app_user_id, workout_type_id, display_order)
      VALUES ($1, $2, $3)
      RETURNING id, app_user_id, workout_type_id, display_order, created_at, updated_at
    `;
    const result = await pool.query(query, [appUserId, workoutTypeId, order]);
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') { // UNIQUE constraint violation
      throw new Error('이미 즐겨찾기에 추가된 운동입니다.');
    }
    console.error('[PostgreSQL] 즐겨찾기 추가 오류:', error);
    throw error;
  }
};

// 즐겨찾기 삭제
const removeFavoriteWorkout = async (appUserId, workoutTypeId) => {
  try {
    const query = `
      DELETE FROM app_user_favorite_workouts
      WHERE app_user_id = $1 AND workout_type_id = $2
      RETURNING id
    `;
    const result = await pool.query(query, [appUserId, workoutTypeId]);
    
    if (result.rows.length === 0) {
      throw new Error('즐겨찾기를 찾을 수 없습니다.');
    }
    
    return true;
  } catch (error) {
    if (error.message === '즐겨찾기를 찾을 수 없습니다.') {
      throw error;
    }
    console.error('[PostgreSQL] 즐겨찾기 삭제 오류:', error);
    throw error;
  }
};

// 즐겨찾기 ID로 삭제
const removeFavoriteWorkoutById = async (id, appUserId) => {
  try {
    const query = `
      DELETE FROM app_user_favorite_workouts
      WHERE id = $1 AND app_user_id = $2
      RETURNING id
    `;
    const result = await pool.query(query, [id, appUserId]);
    
    if (result.rows.length === 0) {
      throw new Error('즐겨찾기를 찾을 수 없습니다.');
    }
    
    return true;
  } catch (error) {
    if (error.message === '즐겨찾기를 찾을 수 없습니다.') {
      throw error;
    }
    console.error('[PostgreSQL] 즐겨찾기 삭제 오류:', error);
    throw error;
  }
};

// 즐겨찾기 여부 확인
const isFavoriteWorkout = async (appUserId, workoutTypeId) => {
  try {
    const query = `
      SELECT id FROM app_user_favorite_workouts
      WHERE app_user_id = $1 AND workout_type_id = $2
      LIMIT 1
    `;
    const result = await pool.query(query, [appUserId, workoutTypeId]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('[PostgreSQL] 즐겨찾기 여부 확인 오류:', error);
    throw error;
  }
};

// 즐겨찾기 정렬 순서 업데이트
const updateDisplayOrder = async (appUserId, favoriteIds) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // 각 즐겨찾기의 display_order 업데이트
      for (let i = 0; i < favoriteIds.length; i++) {
        await client.query(
          'UPDATE app_user_favorite_workouts SET display_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND app_user_id = $3',
          [i, favoriteIds[i], appUserId]
        );
      }
      
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[PostgreSQL] 즐겨찾기 정렬 순서 업데이트 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  try {
    // app_users와 workout_types 테이블이 먼저 생성되어야 함
    await createAppUserFavoriteWorkoutsTable();
    console.log('[PostgreSQL] 앱 유저 즐겨찾기 운동 데이터베이스 초기화 완료');
  } catch (error) {
    console.error('[PostgreSQL] 앱 유저 즐겨찾기 운동 데이터베이스 초기화 오류:', error);
  }
};

module.exports = {
  initializeDatabase,
  getFavoriteWorkouts,
  addFavoriteWorkout,
  removeFavoriteWorkout,
  removeFavoriteWorkoutById,
  isFavoriteWorkout,
  updateDisplayOrder
};
