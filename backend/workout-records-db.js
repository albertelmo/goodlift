const { Pool } = require('pg');
const { runMigration } = require('./migrations-manager');

// PostgreSQL 연결 풀 생성 (기존 DB 모듈 패턴과 동일)
const basePool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 쿼리 로깅 설정 (테스트용: Render에서도 기본 활성화)
// 명시적으로 'false'로 설정하지 않는 한 항상 활성화
const ENABLE_QUERY_LOGGING = process.env.ENABLE_QUERY_LOGGING !== 'false';
const SLOW_QUERY_THRESHOLD = parseInt(process.env.SLOW_QUERY_THRESHOLD || '100', 10); // 기본 100ms

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
  // Pool의 다른 메서드들도 위임
  connect: basePool.connect.bind(basePool),
  end: basePool.end.bind(basePool),
  on: basePool.on.bind(basePool),
  once: basePool.once.bind(basePool),
  removeListener: basePool.removeListener.bind(basePool),
  removeAllListeners: basePool.removeAllListeners.bind(basePool)
};

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
          condition_level VARCHAR(10),
          intensity_level VARCHAR(10),
          fatigue_level VARCHAR(10),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT workout_records_condition_level_check 
            CHECK (condition_level IN ('high', 'medium', 'low') OR condition_level IS NULL),
          CONSTRAINT workout_records_intensity_level_check 
            CHECK (intensity_level IN ('high', 'medium', 'low') OR intensity_level IS NULL),
          CONSTRAINT workout_records_fatigue_level_check 
            CHECK (fatigue_level IN ('high', 'medium', 'low') OR fatigue_level IS NULL)
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
      // 기존 테이블 마이그레이션 - 추적 시스템 사용
      await runMigration(
        'migrate_workout_records_structure_20250131',
        '운동 기록 테이블 데이터 구조 마이그레이션 (sets, reps, weight 등)',
        migrateWorkoutRecordsTable
      );
      await runMigration(
        'add_workout_record_levels_20260202',
        '운동 기록 테이블에 컨디션/강도/피로도 컬럼 추가',
        migrateWorkoutRecordLevels
      );
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
      
      // 정렬 최적화를 위한 인덱스
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_workout_record_sets_record_set 
        ON workout_record_sets(workout_record_id, set_number ASC)
      `);
      
      console.log('[PostgreSQL] workout_record_sets 테이블이 생성되었습니다.');
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
      
      // is_completed 컬럼 추가 후 인덱스 생성
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_workout_record_sets_completed 
        ON workout_record_sets(workout_record_id, is_completed)
        WHERE is_completed IS NOT NULL
      `);
    } else {
      // 컬럼이 이미 있는 경우에도 인덱스가 없으면 생성
      const checkIndex = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'workout_record_sets' 
        AND indexname = 'idx_workout_record_sets_completed'
      `);
      if (checkIndex.rows.length === 0) {
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_workout_record_sets_completed 
          ON workout_record_sets(workout_record_id, is_completed)
          WHERE is_completed IS NOT NULL
        `);
      }
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
    
    // 4. display_order 컬럼 추가 (없으면)
    if (!existingColumns.includes('display_order')) {
      await pool.query(`
        ALTER TABLE workout_records 
        ADD COLUMN display_order INTEGER
      `);
      console.log('[PostgreSQL] display_order 컬럼이 추가되었습니다.');
      
      // 기존 데이터 순서 초기화 (같은 날짜 내 created_at 기준 오름차순)
      await pool.query(`
        UPDATE workout_records wr1
        SET display_order = sub.row_num
        FROM (
          SELECT 
            id,
            ROW_NUMBER() OVER (
              PARTITION BY workout_date, app_user_id 
              ORDER BY created_at ASC
            ) as row_num
          FROM workout_records
        ) sub
        WHERE wr1.id = sub.id
      `);
      console.log('[PostgreSQL] 기존 데이터의 display_order가 초기화되었습니다.');
    } else {
      // display_order 컬럼이 이미 있는 경우, NULL인 레코드만 보완
      const nullCountResult = await pool.query(`
        SELECT COUNT(*) as count 
        FROM workout_records 
        WHERE display_order IS NULL
      `);
      const nullCount = parseInt(nullCountResult.rows[0].count);
      
      if (nullCount > 0) {
        console.log(`[PostgreSQL] display_order가 NULL인 레코드 ${nullCount}개 발견. 보완 중...`);
        
        // NULL인 레코드들에 대해 순서 할당
        await pool.query(`
          UPDATE workout_records wr1
          SET display_order = sub.row_num
          FROM (
            SELECT 
              id,
              workout_date,
              app_user_id,
              ROW_NUMBER() OVER (
                PARTITION BY workout_date, app_user_id 
                ORDER BY COALESCE(display_order, 999999) ASC, created_at ASC
              ) as row_num
            FROM workout_records
            WHERE display_order IS NULL
          ) sub
          WHERE wr1.id = sub.id AND wr1.display_order IS NULL
        `);
        
        console.log(`[PostgreSQL] display_order NULL 레코드 ${nullCount}개 보완 완료.`);
      }
    }
    
    // 5. calories_burned 컬럼 제거 (있으면)
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
    
    // 6. 텍스트 기록 컬럼 추가 (is_text_record, text_content)
    if (!existingColumns.includes('is_text_record')) {
      await pool.query(`
        ALTER TABLE workout_records 
        ADD COLUMN is_text_record BOOLEAN DEFAULT FALSE
      `);
      console.log('[PostgreSQL] is_text_record 컬럼이 추가되었습니다.');
    }
    
    if (!existingColumns.includes('text_content')) {
      await pool.query(`
        ALTER TABLE workout_records 
        ADD COLUMN text_content TEXT
      `);
      console.log('[PostgreSQL] text_content 컬럼이 추가되었습니다.');
    }
    
    // 7. 인덱스 업데이트 (createWorkoutRecordsIndexes에서 처리하므로 여기서는 제거)
    // 인덱스는 createWorkoutRecordsIndexes()에서 일괄 생성됨
  } catch (error) {
    console.error('[PostgreSQL] workout_records 테이블 마이그레이션 오류:', error);
    throw error;
  }
};

// 운동 기록 컨디션/강도/피로도 컬럼 마이그레이션
const migrateWorkoutRecordLevels = async () => {
  try {
    const columnsQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'workout_records'
    `;
    const columnsResult = await pool.query(columnsQuery);
    const existingColumns = columnsResult.rows.map(row => row.column_name);
    
    const addColumnIfMissing = async (columnName) => {
      if (!existingColumns.includes(columnName)) {
        await pool.query(`ALTER TABLE workout_records ADD COLUMN ${columnName} VARCHAR(10)`);
        console.log(`[PostgreSQL] workout_records 테이블에 ${columnName} 컬럼이 추가되었습니다.`);
      }
    };
    
    await addColumnIfMissing('condition_level');
    await addColumnIfMissing('intensity_level');
    await addColumnIfMissing('fatigue_level');
    
    await pool.query(`ALTER TABLE workout_records DROP CONSTRAINT IF EXISTS workout_records_condition_level_check`);
    await pool.query(`
      ALTER TABLE workout_records
      ADD CONSTRAINT workout_records_condition_level_check
      CHECK (condition_level IN ('high', 'medium', 'low') OR condition_level IS NULL)
    `);
    
    await pool.query(`ALTER TABLE workout_records DROP CONSTRAINT IF EXISTS workout_records_intensity_level_check`);
    await pool.query(`
      ALTER TABLE workout_records
      ADD CONSTRAINT workout_records_intensity_level_check
      CHECK (intensity_level IN ('high', 'medium', 'low') OR intensity_level IS NULL)
    `);
    
    await pool.query(`ALTER TABLE workout_records DROP CONSTRAINT IF EXISTS workout_records_fatigue_level_check`);
    await pool.query(`
      ALTER TABLE workout_records
      ADD CONSTRAINT workout_records_fatigue_level_check
      CHECK (fatigue_level IN ('high', 'medium', 'low') OR fatigue_level IS NULL)
    `);
    
    console.log('[PostgreSQL] workout_records 컨디션/강도/피로도 제약조건이 업데이트되었습니다.');
  } catch (error) {
    console.error('[PostgreSQL] 운동 기록 컨디션/강도/피로도 마이그레이션 오류:', error);
    throw error;
  }
};


// 인덱스 생성
const createWorkoutRecordsIndexes = async () => {
  try {
    // 단일 컬럼 인덱스
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_workout_records_user_id ON workout_records(app_user_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_workout_records_date ON workout_records(workout_date)
    `);
    
    // 텍스트 기록 인덱스 (부분 인덱스)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_workout_records_is_text_record 
      ON workout_records(is_text_record) 
      WHERE is_text_record = TRUE
    `);
    
    // 기존 ASC 인덱스가 있으면 제거 (DESC로 재생성하기 위해)
    // 인덱스 방향 변경을 위해 기존 인덱스 확인 및 재생성
    const checkIndexQuery = `
      SELECT indexdef 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND tablename = 'workout_records' 
        AND indexname = 'idx_workout_records_user_date'
    `;
    const indexCheck = await pool.query(checkIndexQuery);
    
    if (indexCheck.rows.length > 0) {
      const indexDef = indexCheck.rows[0].indexdef;
      // ASC 인덱스가 있으면 제거하고 DESC로 재생성
      if (indexDef && !indexDef.includes('DESC')) {
        console.log('[PostgreSQL] 기존 ASC 인덱스를 DESC로 재생성합니다...');
        await pool.query(`DROP INDEX IF EXISTS idx_workout_records_user_date`);
      }
    }
    
    // 복합 인덱스 (app_user_id와 workout_date를 함께 필터링하는 쿼리 최적화)
    // 날짜 범위 쿼리와 DESC 정렬을 모두 커버하는 인덱스
    // PostgreSQL은 범위 쿼리 후 정렬을 위해 이 인덱스를 역순으로 스캔할 수 있음
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_workout_records_user_date 
      ON workout_records(app_user_id, workout_date DESC)
    `);
    
    // 정렬 최적화를 위한 인덱스 (DESC 정렬이 필요한 경우)
    // 범위 쿼리와 정렬을 모두 커버하는 최적 인덱스
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_workout_records_user_date_created 
      ON workout_records(app_user_id, workout_date DESC, created_at DESC)
    `);
    
    // workout_type_id 인덱스 (JOIN 최적화)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_workout_records_type_id 
      ON workout_records(workout_type_id)
      WHERE workout_type_id IS NOT NULL
    `);
    
    console.log('[PostgreSQL] 운동기록 인덱스가 생성되었습니다.');
    
    // 인덱스 변경 후 통계 정보 업데이트 (쿼리 플래너가 최신 인덱스를 활용하도록)
    await pool.query(`ANALYZE workout_records`);
    console.log('[PostgreSQL] workout_records 테이블 통계 정보가 업데이트되었습니다.');
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
        wr.condition_level,
        wr.intensity_level,
        wr.fatigue_level,
        wr.is_completed,
        wr.display_order,
        wr.is_text_record,
        wr.text_content,
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
    
    // 정렬: 날짜 내림차순, 같은 날짜 내에서는 display_order 우선 (없으면 created_at)
    // 인덱스 (app_user_id, workout_date DESC)를 활용하여 정렬 비용 최소화
    query += ` ORDER BY wr.workout_date DESC, 
                     COALESCE(wr.display_order, 999999) ASC, 
                     wr.created_at ASC`;
    
    const result = await pool.query(query, params);
    
    // 날짜 정규화 및 세트 정보 일괄 조회를 위한 ID 수집
    const recordIds = [];
    const recordsMap = new Map();
    
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
      
      // 초기화: 빈 배열로 시작
      record.sets = [];
      recordIds.push(record.id);
      recordsMap.set(record.id, record);
    }
    
    // 모든 세트를 한 번의 쿼리로 조회 (N+1 문제 해결)
    if (recordIds.length > 0) {
      const setsQuery = `
        SELECT 
          id, 
          workout_record_id,
          set_number, 
          weight, 
          reps, 
          is_completed, 
          created_at, 
          updated_at
        FROM workout_record_sets
        WHERE workout_record_id = ANY($1::uuid[])
        ORDER BY workout_record_id, set_number ASC
      `;
      const setsResult = await pool.query(setsQuery, [recordIds]);
      
      // 세트를 workout_record_id별로 그룹화하여 각 운동기록에 할당
      for (const set of setsResult.rows) {
        const record = recordsMap.get(set.workout_record_id);
        if (record) {
          record.sets.push({
            id: set.id,
            set_number: set.set_number,
            weight: set.weight,
            reps: set.reps,
            is_completed: set.is_completed,
            created_at: set.created_at,
            updated_at: set.updated_at
          });
        }
      }
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
        wr.condition_level,
        wr.intensity_level,
        wr.fatigue_level,
        wr.is_completed,
        wr.display_order,
        wr.is_text_record,
        wr.text_content,
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
    
    // 날짜 정규화 (YYYY-MM-DD 형식으로 변환)
    if (record.workout_date) {
      if (record.workout_date instanceof Date) {
        const year = record.workout_date.getFullYear();
        const month = String(record.workout_date.getMonth() + 1).padStart(2, '0');
        const day = String(record.workout_date.getDate()).padStart(2, '0');
        record.workout_date = `${year}-${month}-${day}`;
      } else if (typeof record.workout_date === 'string') {
        record.workout_date = record.workout_date.split('T')[0];
      }
    }
    
    // 세트 정보 조회 (텍스트 기록이 아닌 경우만, 하지만 항상 조회)
    const sets = await pool.query(`
      SELECT id, set_number, weight, reps, is_completed, created_at, updated_at
      FROM workout_record_sets
      WHERE workout_record_id = $1
      ORDER BY set_number ASC
    `, [id]);
    record.sets = sets.rows;
    
    // null 값 정리 (JSON 직렬화를 위해)
    if (record.workout_type_id === null) {
      record.workout_type_name = null;
      record.workout_type_type = null;
    }
    
    // boolean 값 명시적 변환
    record.is_text_record = record.is_text_record === true || record.is_text_record === 'true';
    record.is_completed = record.is_completed === true || record.is_completed === 'true';
    
    // Date 필드를 ISO 문자열로 변환 (JSON 직렬화를 위해)
    if (record.created_at instanceof Date) {
      record.created_at = record.created_at.toISOString();
    }
    if (record.updated_at instanceof Date) {
      record.updated_at = record.updated_at.toISOString();
    }
    
    // sets 배열의 Date 필드도 변환
    if (Array.isArray(record.sets)) {
      record.sets = record.sets.map(set => {
        if (set.created_at instanceof Date) {
          set.created_at = set.created_at.toISOString();
        }
        if (set.updated_at instanceof Date) {
          set.updated_at = set.updated_at.toISOString();
        }
        return set;
      });
    }
    
    return record;
  } catch (error) {
    console.error('[PostgreSQL] 운동기록 단일 조회 오류:', error);
    throw error;
  }
};

// 같은 날짜의 마지막 순서 조회
const getNextDisplayOrder = async (appUserId, workoutDate) => {
  try {
    const result = await pool.query(
      `SELECT COALESCE(MAX(display_order), 0) + 1 as next_order
       FROM workout_records 
       WHERE app_user_id = $1 AND workout_date = $2`,
      [appUserId, workoutDate]
    );
    return result.rows[0].next_order;
  } catch (error) {
    console.error('[PostgreSQL] 다음 display_order 조회 오류:', error);
    return 1; // 에러 시 기본값 1
  }
};

// 운동기록 검증
const validateWorkoutRecord = (workoutData) => {
  const { is_text_record, text_content, workout_type_id, condition_level, intensity_level, fatigue_level } = workoutData;
  const allowedLevels = ['high', 'medium', 'low'];
  
  const validateLevel = (value, label) => {
    if (value && !allowedLevels.includes(value)) {
      throw new Error(`${label} 값이 올바르지 않습니다.`);
    }
  };
  
  validateLevel(condition_level, '컨디션');
  validateLevel(intensity_level, '운동강도');
  validateLevel(fatigue_level, '피로도');
  
  const hasLevels = Boolean(condition_level || intensity_level || fatigue_level);
  
  // 텍스트 기록인 경우
  if (is_text_record === true) {
    if ((!text_content || text_content.trim() === '') && !hasLevels) {
      throw new Error('텍스트 기록은 내용 또는 상태 선택이 필요합니다.');
    }
    if (workout_type_id !== null && workout_type_id !== undefined) {
      throw new Error('텍스트 기록은 운동 종류를 가질 수 없습니다.');
    }
  } else {
    // 일반 기록인 경우
    if (!workout_type_id) {
      throw new Error('운동 종류는 필수입니다.');
    }
    if (text_content) {
      throw new Error('일반 기록은 텍스트 내용을 가질 수 없습니다.');
    }
  }
};

// 운동기록 추가
const addWorkoutRecord = async (workoutData) => {
  const client = await pool.connect();
  try {
    // 검증
    validateWorkoutRecord(workoutData);
    
    await client.query('BEGIN');
    
    // 같은 날짜의 마지막 순서 + 1 계산
    const displayOrder = await getNextDisplayOrder(workoutData.app_user_id, workoutData.workout_date);
    
    // 운동기록 추가
    const insertQuery = `
      INSERT INTO workout_records (
        app_user_id,
        workout_date,
        workout_type_id,
        duration_minutes,
        notes,
        display_order,
        is_text_record,
        text_content,
        condition_level,
        intensity_level,
        fatigue_level
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const insertValues = [
      workoutData.app_user_id,
      workoutData.workout_date,
      workoutData.is_text_record ? null : (workoutData.workout_type_id || null),
      workoutData.duration_minutes || null,
      workoutData.notes || null,
      displayOrder,
      workoutData.is_text_record || false,
      workoutData.is_text_record ? (workoutData.text_content || null) : null,
      workoutData.condition_level || null,
      workoutData.intensity_level || null,
      workoutData.fatigue_level || null
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
          set.weight !== null && set.weight !== undefined ? set.weight : null,
          set.reps !== null && set.reps !== undefined ? set.reps : null
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
    
    // 날짜 정규화 (YYYY-MM-DD 형식으로 변환)
    if (workoutRecord.workout_date) {
      if (workoutRecord.workout_date instanceof Date) {
        const year = workoutRecord.workout_date.getFullYear();
        const month = String(workoutRecord.workout_date.getMonth() + 1).padStart(2, '0');
        const day = String(workoutRecord.workout_date.getDate()).padStart(2, '0');
        workoutRecord.workout_date = `${year}-${month}-${day}`;
      } else if (typeof workoutRecord.workout_date === 'string') {
        workoutRecord.workout_date = workoutRecord.workout_date.split('T')[0];
      }
    }
    
    // workout_type 정보도 조회 (텍스트 기록이 아닌 경우만)
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

// 운동기록 일괄 추가
const addWorkoutRecordsBatch = async (workoutDataArray) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const addedRecords = [];
    
    // 같은 날짜별로 그룹화하여 순서 계산
    const dateOrderMap = new Map();
    
    for (const workoutData of workoutDataArray) {
      const dateKey = `${workoutData.app_user_id}_${workoutData.workout_date}`;
      if (!dateOrderMap.has(dateKey)) {
        // 해당 날짜의 마지막 순서 조회
        const result = await client.query(
          `SELECT COALESCE(MAX(display_order), 0) as max_order
           FROM workout_records 
           WHERE app_user_id = $1 AND workout_date = $2`,
          [workoutData.app_user_id, workoutData.workout_date]
        );
        dateOrderMap.set(dateKey, result.rows[0].max_order || 0);
      }
      const currentOrder = dateOrderMap.get(dateKey) + 1;
      dateOrderMap.set(dateKey, currentOrder);
      
      // 검증
      validateWorkoutRecord(workoutData);
      
      // 운동기록 추가
      const insertQuery = `
        INSERT INTO workout_records (
          app_user_id,
          workout_date,
          workout_type_id,
          duration_minutes,
          notes,
          display_order,
          is_text_record,
          text_content,
          condition_level,
          intensity_level,
          fatigue_level
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
      const insertValues = [
        workoutData.app_user_id,
        workoutData.workout_date,
        workoutData.is_text_record ? null : (workoutData.workout_type_id || null),
        workoutData.duration_minutes || null,
        workoutData.notes || null,
        currentOrder,
        workoutData.is_text_record || false,
        workoutData.is_text_record ? (workoutData.text_content || null) : null,
        workoutData.condition_level || null,
        workoutData.intensity_level || null,
        workoutData.fatigue_level || null
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
            set.weight !== null && set.weight !== undefined ? set.weight : null,
            set.reps !== null && set.reps !== undefined ? set.reps : null
          ]);
        }
      }
      
      addedRecords.push(workoutRecord);
    }
    
    await client.query('COMMIT');
    
    // 모든 기록에 대해 세트 정보 및 workout_type 정보 조회
    for (const record of addedRecords) {
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
      
      const setsResult = await pool.query(`
        SELECT id, set_number, weight, reps, is_completed, created_at, updated_at
        FROM workout_record_sets
        WHERE workout_record_id = $1
        ORDER BY set_number ASC
      `, [record.id]);
      record.sets = setsResult.rows;
      
      if (record.workout_type_id) {
        const typeResult = await pool.query(`
          SELECT name, type FROM workout_types WHERE id = $1
        `, [record.workout_type_id]);
        if (typeResult.rows.length > 0) {
          record.workout_type_name = typeResult.rows[0].name;
          record.workout_type_type = typeResult.rows[0].type;
        }
      }
    }
    
    return addedRecords;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[PostgreSQL] 운동기록 일괄 추가 오류:', error);
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
    
    // 기존 레코드 조회 (날짜 변경 확인용)
    const existingRecord = await client.query(
      `SELECT workout_date, display_order FROM workout_records WHERE id = $1 AND app_user_id = $2`,
      [id, appUserId]
    );
    
    if (existingRecord.rows.length === 0) {
      throw new Error('운동기록을 찾을 수 없습니다.');
    }
    
    const oldDateRaw = existingRecord.rows[0].workout_date;
    const existingDisplayOrder = existingRecord.rows[0].display_order;
    const newDate = updates.workout_date;
    
    // 날짜를 YYYY-MM-DD 형식의 문자열로 정규화하여 비교
    const normalizeDate = (date) => {
      if (!date) return null;
      if (date instanceof Date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      if (typeof date === 'string') {
        // ISO 형식 문자열인 경우 날짜 부분만 추출
        return date.split('T')[0];
      }
      return date;
    };
    
    const oldDateNormalized = normalizeDate(oldDateRaw);
    const newDateNormalized = normalizeDate(newDate);
    
    // 날짜가 실제로 변경되는 경우에만 순서 재할당
    if (newDateNormalized && newDateNormalized !== oldDateNormalized) {
      // 새 날짜의 마지막 순서 + 1로 할당
      const orderResult = await client.query(
        `SELECT COALESCE(MAX(display_order), 0) + 1 as next_order
         FROM workout_records 
         WHERE app_user_id = $1 AND workout_date = $2`,
        [appUserId, newDateNormalized]
      );
      updates.display_order = orderResult.rows[0].next_order;
    } else if (newDateNormalized && newDateNormalized === oldDateNormalized) {
      // 날짜가 변경되지 않았으면 기존 display_order 유지
      // display_order가 updates에 명시적으로 포함되지 않은 경우에만
      if (updates.display_order === undefined) {
        // 기존 display_order를 유지하기 위해 명시적으로 설정하지 않음
        // (업데이트 쿼리에서 display_order 필드를 포함하지 않으면 기존 값이 유지됨)
      }
    }
    
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (updates.workout_date !== undefined) {
      fields.push(`workout_date = $${paramIndex++}`);
      values.push(updates.workout_date);
    }
    if (updates.display_order !== undefined) {
      fields.push(`display_order = $${paramIndex++}`);
      values.push(updates.display_order);
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
    if (updates.condition_level !== undefined) {
      fields.push(`condition_level = $${paramIndex++}`);
      values.push(updates.condition_level || null);
    }
    if (updates.intensity_level !== undefined) {
      fields.push(`intensity_level = $${paramIndex++}`);
      values.push(updates.intensity_level || null);
    }
    if (updates.fatigue_level !== undefined) {
      fields.push(`fatigue_level = $${paramIndex++}`);
      values.push(updates.fatigue_level || null);
    }
    if (updates.is_text_record !== undefined) {
      fields.push(`is_text_record = $${paramIndex++}`);
      values.push(updates.is_text_record || false);
    }
    if (updates.text_content !== undefined) {
      fields.push(`text_content = $${paramIndex++}`);
      values.push(updates.text_content || null);
    }
    
    // 검증 (업데이트 시)
    if (updates.is_text_record !== undefined || updates.text_content !== undefined || updates.workout_type_id !== undefined || updates.condition_level !== undefined || updates.intensity_level !== undefined || updates.fatigue_level !== undefined) {
      // 기존 레코드 조회하여 검증
      const existingRecord = await client.query(
        `SELECT is_text_record, text_content, workout_type_id, condition_level, intensity_level, fatigue_level FROM workout_records WHERE id = $1 AND app_user_id = $2`,
        [id, appUserId]
      );
      if (existingRecord.rows.length > 0) {
        const existing = existingRecord.rows[0];
        const mergedData = {
          is_text_record: updates.is_text_record !== undefined ? updates.is_text_record : existing.is_text_record,
          text_content: updates.text_content !== undefined ? updates.text_content : existing.text_content,
          workout_type_id: updates.workout_type_id !== undefined ? updates.workout_type_id : existing.workout_type_id,
          condition_level: updates.condition_level !== undefined ? updates.condition_level : existing.condition_level,
          intensity_level: updates.intensity_level !== undefined ? updates.intensity_level : existing.intensity_level,
          fatigue_level: updates.fatigue_level !== undefined ? updates.fatigue_level : existing.fatigue_level
        };
        validateWorkoutRecord(mergedData);
      }
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
            set.weight !== null && set.weight !== undefined ? set.weight : null,
            set.reps !== null && set.reps !== undefined ? set.reps : null,
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

// 캘린더용 경량 조회 (날짜별 완료 여부만 반환)
const getWorkoutRecordsForCalendar = async (appUserId, startDate = null, endDate = null) => {
  try {
    // 기본 조회 범위: 현재 월 기준 전후 1개월 (3개월)
    let query = `
      SELECT 
        wr.workout_date,
        wr.workout_type_id,
        wt.type as workout_type_type,
        wr.is_completed,
        wr.is_text_record,
        wr.id as workout_record_id
      FROM workout_records wr
      LEFT JOIN workout_types wt ON wr.workout_type_id = wt.id
      WHERE wr.app_user_id = $1
    `;
    const params = [appUserId];
    let paramIndex = 2;
    
    if (startDate) {
      query += ` AND wr.workout_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      query += ` AND wr.workout_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }
    
    query += ` ORDER BY wr.workout_date ASC`;
    
    const result = await pool.query(query, params);
    
    // 날짜별로 그룹화
    const recordsByDate = {};
    const recordIds = [];
    const recordIdToDateMap = new Map();
    
    for (const record of result.rows) {
      // workout_date를 YYYY-MM-DD 형식의 문자열로 변환
      let dateStr = record.workout_date;
      if (dateStr instanceof Date) {
        const year = dateStr.getFullYear();
        const month = String(dateStr.getMonth() + 1).padStart(2, '0');
        const day = String(dateStr.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      } else if (typeof dateStr === 'string') {
        dateStr = dateStr.split('T')[0];
      }
      
      if (!recordsByDate[dateStr]) {
        recordsByDate[dateStr] = [];
      }
      
      recordsByDate[dateStr].push({
        workout_record_id: record.workout_record_id,
        workout_type_type: record.workout_type_type,
        is_completed: record.is_completed,
        is_text_record: record.is_text_record
      });
      
      recordIds.push(record.workout_record_id);
      recordIdToDateMap.set(record.workout_record_id, dateStr);
    }
    
    // 세트 운동의 경우 세트 완료 여부도 확인 (일괄 조회)
    if (recordIds.length > 0) {
      const setsQuery = `
        SELECT 
          workout_record_id,
          is_completed
        FROM workout_record_sets
        WHERE workout_record_id = ANY($1::uuid[])
        ORDER BY workout_record_id, set_number ASC
      `;
      const setsResult = await pool.query(setsQuery, [recordIds]);
      
      // 세트를 workout_record_id별로 그룹화
      const setsByRecordId = {};
      for (const set of setsResult.rows) {
        if (!setsByRecordId[set.workout_record_id]) {
          setsByRecordId[set.workout_record_id] = [];
        }
        setsByRecordId[set.workout_record_id].push(set.is_completed);
      }
      
      // 각 날짜별로 완료 여부 계산
      for (const dateStr in recordsByDate) {
        const records = recordsByDate[dateStr];
        for (const record of records) {
          if (record.workout_type_type === '세트') {
            const sets = setsByRecordId[record.workout_record_id] || [];
            // 세트가 있고 모두 완료되었는지 확인
            record.allSetsCompleted = sets.length > 0 && sets.every(completed => completed === true);
          }
        }
      }
    }
    
    // 날짜별로 완료 여부 요약
    const summary = {};
    for (const dateStr in recordsByDate) {
      const records = recordsByDate[dateStr];
      const hasWorkout = records.length > 0;
      
      // 모든 운동이 완료되었는지 확인
      const allCompleted = records.every(record => {
        // 텍스트 기록의 경우
        if (record.is_text_record === true) {
          return record.is_completed === true;
        }
        // 시간 운동의 경우
        if (record.workout_type_type === '시간') {
          return record.is_completed === true;
        } 
        // 세트 운동의 경우
        else if (record.workout_type_type === '세트') {
          return record.allSetsCompleted === true;
        }
        return false;
      });
      
      summary[dateStr] = {
        hasWorkout,
        allCompleted: hasWorkout && allCompleted
      };
    }
    
    return summary;
  } catch (error) {
    console.error('[PostgreSQL] 캘린더용 운동기록 조회 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  await createWorkoutRecordsTable();
  // migrateWorkoutRecordsTable에서 createWorkoutRecordSetsTable 호출됨
};

// 운동기록 순서 변경
const reorderWorkoutRecords = async (appUserId, workoutDate, order) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 같은 날짜 내 모든 순서 업데이트
    for (const item of order) {
      // UUID 형식 검증
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(item.id)) {
        throw new Error(`Invalid UUID format for id: ${item.id}`);
      }
      if (!uuidRegex.test(appUserId)) {
        throw new Error(`Invalid UUID format for appUserId: ${appUserId}`);
      }
      
      // 날짜 형식 검증
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(workoutDate)) {
        throw new Error(`Invalid date format: ${workoutDate}`);
      }
      
      const updateResult = await client.query(
        `UPDATE workout_records 
         SET display_order = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 AND app_user_id = $3 AND workout_date = $4`,
        [item.order, item.id, appUserId, workoutDate]
      );
      
      // 업데이트된 행 수 확인
      if (updateResult.rowCount === 0) {
        console.error('[PostgreSQL] 순서 업데이트 실패 - 레코드를 찾을 수 없음:', {
          order: item.order,
          id: item.id,
          appUserId,
          workoutDate
        });
        throw new Error(`운동기록을 찾을 수 없습니다. (id: ${item.id}, app_user_id: ${appUserId}, workout_date: ${workoutDate})`);
      }
      
      if (updateResult.rowCount > 1) {
        console.warn('[PostgreSQL] 순서 업데이트 경고 - 여러 행이 업데이트됨:', {
          rowCount: updateResult.rowCount,
          order: item.order,
          id: item.id,
          appUserId,
          workoutDate
        });
      }
    }
    
    await client.query('COMMIT');
    
    // 저장 확인: 실제로 올바른 순서 값이 저장되었는지 확인
    const verifyResult = await pool.query(
      `SELECT id, display_order 
       FROM workout_records 
       WHERE app_user_id = $1 AND workout_date = $2 
       AND id = ANY($3::uuid[])
       ORDER BY display_order ASC`,
      [appUserId, workoutDate, order.map(item => item.id)]
    );
    
    // 요청한 순서와 실제 저장된 순서 비교
    const expectedOrder = new Map(order.map(item => [item.id, item.order]));
    const actualOrder = new Map(verifyResult.rows.map(row => [row.id, row.display_order]));
    
    const mismatches = [];
    for (const [id, expectedOrderValue] of expectedOrder.entries()) {
      const actualOrderValue = actualOrder.get(id);
      if (actualOrderValue !== expectedOrderValue) {
        mismatches.push({
          id,
          expected: expectedOrderValue,
          actual: actualOrderValue
        });
      }
    }
    
    if (mismatches.length > 0) {
      console.error('[PostgreSQL] 순서 변경 검증 실패 - 순서 불일치:', {
        mismatches,
        appUserId,
        workoutDate,
        requestedOrder: order,
        actualOrder: verifyResult.rows.map(row => ({ id: row.id, display_order: row.display_order }))
      });
      throw new Error(`순서 변경 검증 실패: ${mismatches.length}개의 레코드가 올바른 순서로 저장되지 않았습니다.`);
    }
    
    if (verifyResult.rows.length !== order.length) {
      console.error('[PostgreSQL] 순서 변경 검증 실패 - 레코드 수 불일치:', {
        requestedCount: order.length,
        actualCount: verifyResult.rows.length,
        appUserId,
        workoutDate
      });
      throw new Error(`순서 변경 검증 실패: 요청한 ${order.length}개 중 ${verifyResult.rows.length}개만 저장되었습니다.`);
    }
    
    return { success: true, count: order.length };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[PostgreSQL] 운동기록 순서 변경 오류:', error);
    console.error('[PostgreSQL] 에러 상세:', {
      message: error.message,
      stack: error.stack,
      appUserId,
      workoutDate,
      order: JSON.stringify(order, null, 2)
    });
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  initializeDatabase,
  getWorkoutRecords,
  getWorkoutRecordById,
  addWorkoutRecord,
  addWorkoutRecordsBatch,
  updateWorkoutRecord,
  deleteWorkoutRecord,
  getWorkoutStats,
  updateWorkoutRecordCompleted,
  updateWorkoutSetCompleted,
  getWorkoutRecordsForCalendar,
  reorderWorkoutRecords
};
