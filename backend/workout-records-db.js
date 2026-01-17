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
      // 새 테이블 생성 (외래키 제약조건은 나중에 추가)
      const createQuery = `
        CREATE TABLE workout_records (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          workout_date DATE NOT NULL,
          workout_type_id UUID,
          duration_minutes INTEGER,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // workout_types 테이블이 존재하는 경우에만 외래키 제약조건 추가
      const checkWorkoutTypesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'workout_types'
      `;
      const checkWorkoutTypesResult = await pool.query(checkWorkoutTypesQuery);
      
      if (checkWorkoutTypesResult.rows.length > 0) {
        await pool.query(`
          ALTER TABLE workout_records 
          ADD CONSTRAINT fk_workout_records_workout_type_id 
          FOREIGN KEY (workout_type_id) REFERENCES workout_types(id) ON DELETE SET NULL
        `);
        console.log('[PostgreSQL] workout_records 테이블에 workout_type_id 외래키 제약조건이 추가되었습니다.');
      } else {
        console.warn('[PostgreSQL] workout_types 테이블이 아직 존재하지 않습니다. 외래키 제약조건은 나중에 추가됩니다.');
      }
      
      // 인덱스 생성
      await createWorkoutRecordsIndexes();
      
      // 세트 테이블 생성
      await createWorkoutRecordSetsTable();
      
      console.log('[PostgreSQL] workout_records 테이블이 생성되었습니다.');
    } else {
      console.log('[PostgreSQL] workout_records 테이블이 이미 존재합니다.');
      // 기존 테이블 마이그레이션
      await migrateWorkoutRecordsTable();
    }
  } catch (error) {
    console.error('[PostgreSQL] 운동기록 테이블 생성 오류:', error);
    throw error;
  }
};

// 세트 테이블 생성
const createWorkoutRecordSetsTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'workout_record_sets'
    `;
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE workout_record_sets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workout_record_id UUID NOT NULL REFERENCES workout_records(id) ON DELETE CASCADE,
          set_number INTEGER NOT NULL,
          weight DECIMAL(10,2),
          reps INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(workout_record_id, set_number)
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // 인덱스 생성
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_workout_record_sets_workout_record_id 
        ON workout_record_sets(workout_record_id)
      `);
      
      console.log('[PostgreSQL] workout_record_sets 테이블이 생성되었습니다.');
    } else {
      console.log('[PostgreSQL] workout_record_sets 테이블이 이미 존재합니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] workout_record_sets 테이블 생성 오류:', error);
    throw error;
  }
};

// 완료 상태 컬럼 추가 (마이그레이션)
const addCompletedColumns = async () => {
  try {
    // workout_records 테이블에 is_completed 컬럼 추가 (시간 운동용)
    const checkWorkoutRecordsCompleted = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'workout_records' 
      AND column_name = 'is_completed'
    `);
    
    if (checkWorkoutRecordsCompleted.rows.length === 0) {
      await pool.query(`
        ALTER TABLE workout_records 
        ADD COLUMN is_completed BOOLEAN DEFAULT false
      `);
      console.log('[PostgreSQL] workout_records 테이블에 is_completed 컬럼이 추가되었습니다.');
    }
    
    // workout_record_sets 테이블에 is_completed 컬럼 추가 (세트별 완료용)
    const checkSetsCompleted = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'workout_record_sets' 
      AND column_name = 'is_completed'
    `);
    
    if (checkSetsCompleted.rows.length === 0) {
      await pool.query(`
        ALTER TABLE workout_record_sets 
        ADD COLUMN is_completed BOOLEAN DEFAULT false
      `);
      console.log('[PostgreSQL] workout_record_sets 테이블에 is_completed 컬럼이 추가되었습니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] 완료 상태 컬럼 추가 오류:', error);
    throw error;
  }
};

// 기존 테이블 마이그레이션
const migrateWorkoutRecordsTable = async () => {
  try {
    // 1. workout_record_sets 테이블 생성 (없으면)
    await createWorkoutRecordSetsTable();
    
    // 2. 완료 상태 컬럼 추가
    await addCompletedColumns();
    
    // 2. 기존 컬럼 확인
    const columnsQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'workout_records'
      ORDER BY ordinal_position
    `;
    const columnsResult = await pool.query(columnsQuery);
    const existingColumns = columnsResult.rows.map(row => row.column_name);
    
    // 3. workout_type_id 컬럼 추가 (없으면)
    if (!existingColumns.includes('workout_type_id')) {
      await pool.query(`
        ALTER TABLE workout_records 
        ADD COLUMN workout_type_id UUID
      `);
      console.log('[PostgreSQL] workout_type_id 컬럼이 추가되었습니다.');
      
      // 기존 workout_type 문자열을 workout_types 테이블과 매칭하여 UUID로 변환
      const existingRecords = await pool.query(`
        SELECT id, workout_type 
        FROM workout_records 
        WHERE workout_type IS NOT NULL AND workout_type != '' AND workout_type_id IS NULL
      `);
      
      if (existingRecords.rows.length > 0) {
        let matchedCount = 0;
        let unmatchedCount = 0;
        
        for (const record of existingRecords.rows) {
          // workout_types 테이블에서 name으로 검색
          const workoutTypeResult = await pool.query(`
            SELECT id FROM workout_types WHERE name = $1
          `, [record.workout_type]);
          
          if (workoutTypeResult.rows.length > 0) {
            // 매칭되는 경우 UUID로 업데이트
            await pool.query(`
              UPDATE workout_records 
              SET workout_type_id = $1 
              WHERE id = $2
            `, [workoutTypeResult.rows[0].id, record.id]);
            matchedCount++;
          } else {
            // 매칭되지 않는 경우 경고 로그
            console.warn(`[PostgreSQL] workout_type "${record.workout_type}"에 해당하는 workout_types를 찾을 수 없습니다. (record_id: ${record.id})`);
            unmatchedCount++;
          }
        }
        
        console.log(`[PostgreSQL] workout_type 마이그레이션 완료: 매칭 ${matchedCount}개, 미매칭 ${unmatchedCount}개`);
      }
      
      // workout_types 테이블이 존재하는 경우 외래키 제약조건 추가
      const checkWorkoutTypesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'workout_types'
      `;
      const checkWorkoutTypesResult = await pool.query(checkWorkoutTypesQuery);
      
      if (checkWorkoutTypesResult.rows.length > 0) {
        // 기존 외래키 제약조건 확인
        const fkCheckQuery = `
          SELECT constraint_name 
          FROM information_schema.table_constraints 
          WHERE table_schema = 'public' 
            AND table_name = 'workout_records' 
            AND constraint_name = 'fk_workout_records_workout_type_id'
        `;
        const fkCheckResult = await pool.query(fkCheckQuery);
        
        if (fkCheckResult.rows.length === 0) {
          await pool.query(`
            ALTER TABLE workout_records 
            ADD CONSTRAINT fk_workout_records_workout_type_id 
            FOREIGN KEY (workout_type_id) REFERENCES workout_types(id) ON DELETE SET NULL
          `);
          console.log('[PostgreSQL] workout_type_id 외래키 제약조건이 추가되었습니다.');
        }
      }
    }
    
    // 4. calories_burned 컬럼 제거 (있으면)
    if (existingColumns.includes('calories_burned')) {
      await pool.query(`
        ALTER TABLE workout_records 
        DROP COLUMN IF EXISTS calories_burned
      `);
      console.log('[PostgreSQL] calories_burned 컬럼이 제거되었습니다.');
    }
    
    // 5. workout_type 컬럼 제거 (workout_type_id로 완전히 대체된 후)
    if (existingColumns.includes('workout_type')) {
      // 모든 데이터가 마이그레이션되었는지 확인
      const unmigratedCount = await pool.query(`
        SELECT COUNT(*) as count 
        FROM workout_records 
        WHERE workout_type IS NOT NULL AND workout_type != '' AND workout_type_id IS NULL
      `);
      
      if (unmigratedCount.rows[0].count === '0') {
        await pool.query(`
          ALTER TABLE workout_records 
          DROP COLUMN IF EXISTS workout_type
        `);
        console.log('[PostgreSQL] workout_type 컬럼이 제거되었습니다.');
      } else {
        console.warn(`[PostgreSQL] workout_type 컬럼 제거 보류: ${unmigratedCount.rows[0].count}개의 미마이그레이션 레코드가 있습니다.`);
      }
    }
    
    // 6. 인덱스 업데이트
    const checkTypeIdIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND tablename = 'workout_records' AND indexname = 'idx_workout_records_type_id'
    `;
    const checkTypeIdIndexResult = await pool.query(checkTypeIdIndexQuery);
    
    if (checkTypeIdIndexResult.rows.length === 0) {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_workout_records_type_id 
        ON workout_records(workout_type_id)
      `);
      console.log('[PostgreSQL] idx_workout_records_type_id 인덱스가 생성되었습니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] workout_records 테이블 마이그레이션 오류:', error);
    throw error;
  }
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
        wr.id,
        wr.app_user_id,
        wr.workout_date,
        wr.workout_type_id,
        wt.name as workout_type_name,
        wt.type as workout_type_type,
        wr.duration_minutes,
        wr.notes,
        wr.is_completed,
        wr.created_at,
        wr.updated_at
      FROM workout_records wr
      LEFT JOIN workout_types wt ON wr.workout_type_id = wt.id
      WHERE wr.app_user_id = $1
    `;
    const params = [appUserId];
    
    // 날짜 필터
    if (filters.startDate) {
      query += ` AND wr.workout_date >= $${params.length + 1}`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ` AND wr.workout_date <= $${params.length + 1}`;
      params.push(filters.endDate);
    }
    
    // 정렬 (최신순)
    query += ` ORDER BY wr.workout_date DESC, wr.created_at DESC`;
    
    const result = await pool.query(query, params);
    
    // 각 운동기록에 세트 정보 추가 및 날짜 정규화
    for (const record of result.rows) {
      // workout_date를 YYYY-MM-DD 형식의 문자열로 변환 (타임존 이슈 방지)
      if (record.workout_date) {
        if (record.workout_date instanceof Date) {
          const year = record.workout_date.getFullYear();
          const month = String(record.workout_date.getMonth() + 1).padStart(2, '0');
          const day = String(record.workout_date.getDate()).padStart(2, '0');
          record.workout_date = `${year}-${month}-${day}`;
        } else if (typeof record.workout_date === 'string') {
          // ISO 형식 문자열인 경우 날짜 부분만 추출
          record.workout_date = record.workout_date.split('T')[0];
        }
      }
      
      const sets = await pool.query(`
        SELECT id, set_number, weight, reps, is_completed, created_at, updated_at
        FROM workout_record_sets
        WHERE workout_record_id = $1
        ORDER BY set_number ASC
      `, [record.id]);
      record.sets = sets.rows;
    }
    
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
        wr.id,
        wr.app_user_id,
        wr.workout_date,
        wr.workout_type_id,
        wt.name as workout_type_name,
        wt.type as workout_type_type,
        wr.duration_minutes,
        wr.notes,
        wr.is_completed,
        wr.created_at,
        wr.updated_at
      FROM workout_records wr
      LEFT JOIN workout_types wt ON wr.workout_type_id = wt.id
      WHERE wr.id = $1 AND wr.app_user_id = $2
    `;
    const result = await pool.query(query, [id, appUserId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const record = result.rows[0];
    
    // 세트 정보 조회
    const sets = await pool.query(`
      SELECT id, set_number, weight, reps, is_completed, created_at, updated_at
      FROM workout_record_sets
      WHERE workout_record_id = $1
      ORDER BY set_number ASC
    `, [id]);
    record.sets = sets.rows;
    
    return record;
  } catch (error) {
    console.error('[PostgreSQL] 운동기록 단일 조회 오류:', error);
    throw error;
  }
};

// 운동기록 추가
const addWorkoutRecord = async (workoutData) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 운동기록 추가
    const insertQuery = `
      INSERT INTO workout_records (
        app_user_id,
        workout_date,
        workout_type_id,
        duration_minutes,
        notes
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const insertValues = [
      workoutData.app_user_id,
      workoutData.workout_date,
      workoutData.workout_type_id || null,
      workoutData.duration_minutes || null,
      workoutData.notes || null
    ];
    const insertResult = await client.query(insertQuery, insertValues);
    const workoutRecord = insertResult.rows[0];
    
    // 세트 데이터 추가 (있는 경우)
    if (workoutData.sets && Array.isArray(workoutData.sets) && workoutData.sets.length > 0) {
      for (const set of workoutData.sets) {
        await client.query(`
          INSERT INTO workout_record_sets (
            workout_record_id,
            set_number,
            weight,
            reps
          ) VALUES ($1, $2, $3, $4)
        `, [
          workoutRecord.id,
          set.set_number,
          set.weight || null,
          set.reps || null
        ]);
      }
    }
    
    await client.query('COMMIT');
    
      // 세트 정보 포함하여 반환
    const setsResult = await pool.query(`
      SELECT id, set_number, weight, reps, is_completed, created_at, updated_at
      FROM workout_record_sets
      WHERE workout_record_id = $1
      ORDER BY set_number ASC
    `, [workoutRecord.id]);
    
    workoutRecord.sets = setsResult.rows;
    
    // workout_type 정보도 조회
    if (workoutRecord.workout_type_id) {
      const typeResult = await pool.query(`
        SELECT name, type FROM workout_types WHERE id = $1
      `, [workoutRecord.workout_type_id]);
      if (typeResult.rows.length > 0) {
        workoutRecord.workout_type_name = typeResult.rows[0].name;
        workoutRecord.workout_type_type = typeResult.rows[0].type;
      }
    }
    
    return workoutRecord;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[PostgreSQL] 운동기록 추가 오류:', error);
    throw error;
  } finally {
    client.release();
  }
};

// 운동기록 수정
const updateWorkoutRecord = async (id, appUserId, updates) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (updates.workout_date !== undefined) {
      fields.push(`workout_date = $${paramIndex++}`);
      values.push(updates.workout_date);
    }
    if (updates.workout_type_id !== undefined) {
      fields.push(`workout_type_id = $${paramIndex++}`);
      values.push(updates.workout_type_id || null);
    }
    if (updates.duration_minutes !== undefined) {
      fields.push(`duration_minutes = $${paramIndex++}`);
      values.push(updates.duration_minutes || null);
    }
    if (updates.notes !== undefined) {
      fields.push(`notes = $${paramIndex++}`);
      values.push(updates.notes || null);
    }
    
    if (fields.length > 0) {
      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id, appUserId);
      
      const query = `
        UPDATE workout_records
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex++} AND app_user_id = $${paramIndex++}
        RETURNING *
      `;
      
      await client.query(query, values);
    }
    
    // 세트 데이터 업데이트 (있는 경우)
    if (updates.sets !== undefined) {
      // 기존 세트 삭제
      await client.query(`
        DELETE FROM workout_record_sets WHERE workout_record_id = $1
      `, [id]);
      
      // 새 세트 추가 (완료 상태 보존)
      if (Array.isArray(updates.sets) && updates.sets.length > 0) {
        for (const set of updates.sets) {
          await client.query(`
            INSERT INTO workout_record_sets (
              workout_record_id,
              set_number,
              weight,
              reps,
              is_completed
            ) VALUES ($1, $2, $3, $4, $5)
          `, [
            id,
            set.set_number,
            set.weight || null,
            set.reps || null,
            set.is_completed !== undefined ? set.is_completed : false
          ]);
        }
      }
    }
    
    await client.query('COMMIT');
    
    // 업데이트된 레코드 조회 (세트 정보 포함)
    return await getWorkoutRecordById(id, appUserId);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[PostgreSQL] 운동기록 수정 오류:', error);
    throw error;
  } finally {
    client.release();
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

// 운동기록 완료 상태 업데이트 (시간 운동용)
const updateWorkoutRecordCompleted = async (id, appUserId, isCompleted) => {
  try {
    const query = `
      UPDATE workout_records
      SET is_completed = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND app_user_id = $3
      RETURNING *
    `;
    const result = await pool.query(query, [isCompleted, id, appUserId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] 운동기록 완료 상태 업데이트 오류:', error);
    throw error;
  }
};

// 세트 완료 상태 업데이트
const updateWorkoutSetCompleted = async (setId, workoutRecordId, appUserId, isCompleted) => {
  try {
    // workout_record_id가 해당 app_user_id에 속하는지 확인
    const checkQuery = `
      SELECT id FROM workout_records 
      WHERE id = $1 AND app_user_id = $2
    `;
    const checkResult = await pool.query(checkQuery, [workoutRecordId, appUserId]);
    
    if (checkResult.rows.length === 0) {
      throw new Error('운동기록을 찾을 수 없습니다.');
    }
    
    const query = `
      UPDATE workout_record_sets
      SET is_completed = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND workout_record_id = $3
      RETURNING *
    `;
    const result = await pool.query(query, [isCompleted, setId, workoutRecordId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] 세트 완료 상태 업데이트 오류:', error);
    throw error;
  }
};

// 통계 조회 (기간별 합계)
const getWorkoutStats = async (appUserId, startDate, endDate) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_workouts,
        COALESCE(SUM(duration_minutes), 0) as total_duration
      FROM workout_records
      WHERE app_user_id = $1
        AND workout_date >= $2
        AND workout_date <= $3
    `;
    const result = await pool.query(query, [appUserId, startDate, endDate]);
    return result.rows[0] || { total_workouts: 0, total_duration: 0 };
  } catch (error) {
    console.error('[PostgreSQL] 운동기록 통계 조회 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  await createWorkoutRecordsTable();
  // migrateWorkoutRecordsTable에서 createWorkoutRecordSetsTable 호출됨
};

module.exports = {
  initializeDatabase,
  getWorkoutRecords,
  getWorkoutRecordById,
  addWorkoutRecord,
  updateWorkoutRecord,
  deleteWorkoutRecord,
  getWorkoutStats,
  updateWorkoutRecordCompleted,
  updateWorkoutSetCompleted
};
