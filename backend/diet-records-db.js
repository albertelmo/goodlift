const { Pool } = require('pg');

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

// 식단기록 테이블 생성
const createDietRecordsTable = async () => {
  try {
    // 테이블 존재 여부 확인
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'diet_records'
    `;
    const checkResult = await pool.query(checkQuery);
    
    // 테이블이 없을 때만 생성
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE diet_records (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          meal_date DATE NOT NULL,
          meal_time TIME,
          meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
          image_url VARCHAR(500),
          image_thumbnail_url VARCHAR(500),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // 인덱스 생성
      await createDietRecordsIndexes();
      
      // 코멘트 테이블 생성
      await createDietCommentsTable();
      
      console.log('[PostgreSQL] diet_records 테이블이 생성되었습니다.');
    } else {
      console.log('[PostgreSQL] diet_records 테이블이 이미 존재합니다.');
      // 기존 테이블 마이그레이션
      await migrateDietRecordsTable();
      // 코멘트 테이블도 확인
      await createDietCommentsTable();
    }
  } catch (error) {
    console.error('[PostgreSQL] 식단기록 테이블 생성 오류:', error);
    throw error;
  }
};

// 식단 코멘트 테이블 생성
const createDietCommentsTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'diet_comments'
    `;
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE diet_comments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          diet_record_id UUID NOT NULL REFERENCES diet_records(id) ON DELETE CASCADE,
          commenter_type VARCHAR(20) NOT NULL CHECK (commenter_type IN ('user', 'trainer')),
          commenter_id VARCHAR(100) NOT NULL,
          commenter_name VARCHAR(100),
          comment_text TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // 인덱스 생성
      await createDietCommentsIndexes();
      
      console.log('[PostgreSQL] diet_comments 테이블이 생성되었습니다.');
    } else {
      console.log('[PostgreSQL] diet_comments 테이블이 이미 존재합니다.');
      // 기존 테이블 마이그레이션
      await migrateDietCommentsTable();
    }
  } catch (error) {
    console.error('[PostgreSQL] 식단 코멘트 테이블 생성 오류:', error);
    throw error;
  }
};

// 기존 테이블 마이그레이션
const migrateDietRecordsTable = async () => {
  try {
    // 기존 컬럼 확인
    const columnsQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'diet_records'
      ORDER BY ordinal_position
    `;
    const columnsResult = await pool.query(columnsQuery);
    const existingColumns = columnsResult.rows.map(row => row.column_name);
    
    // 필요한 컬럼이 없으면 추가
    if (!existingColumns.includes('meal_time')) {
      await pool.query(`
        ALTER TABLE diet_records 
        ADD COLUMN meal_time TIME
      `);
      console.log('[PostgreSQL] meal_time 컬럼이 추가되었습니다.');
    }
    
    if (!existingColumns.includes('image_thumbnail_url')) {
      await pool.query(`
        ALTER TABLE diet_records 
        ADD COLUMN image_thumbnail_url VARCHAR(500)
      `);
      console.log('[PostgreSQL] image_thumbnail_url 컬럼이 추가되었습니다.');
    }
    
    // meal_type 컬럼 추가 (아침/점심/저녁/간식)
    if (!existingColumns.includes('meal_type')) {
      await pool.query(`
        ALTER TABLE diet_records 
        ADD COLUMN meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack'))
      `);
      console.log('[PostgreSQL] meal_type 컬럼이 추가되었습니다.');
    } else {
      // 기존 컬럼이 있으면 NOT NULL 제약조건 추가
      const checkNotNull = await pool.query(`
        SELECT is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'diet_records' 
          AND column_name = 'meal_type'
      `);
      if (checkNotNull.rows.length > 0 && checkNotNull.rows[0].is_nullable === 'YES') {
        await pool.query(`
          ALTER TABLE diet_records 
          ALTER COLUMN meal_type SET NOT NULL
        `);
        console.log('[PostgreSQL] meal_type 컬럼에 NOT NULL 제약조건이 추가되었습니다.');
      }
    }
    
    // food_name 컬럼 삭제 (더 이상 사용하지 않음)
    if (existingColumns.includes('food_name')) {
      await pool.query(`
        ALTER TABLE diet_records 
        DROP COLUMN food_name
      `);
      console.log('[PostgreSQL] food_name 컬럼이 삭제되었습니다.');
    }
    
    // 인덱스 업데이트
    await createDietRecordsIndexes();
  } catch (error) {
    console.error('[PostgreSQL] diet_records 테이블 마이그레이션 오류:', error);
    throw error;
  }
};

// 코멘트 테이블 마이그레이션
const migrateDietCommentsTable = async () => {
  try {
    // 기존 컬럼 확인
    const columnsQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'diet_comments'
      ORDER BY ordinal_position
    `;
    const columnsResult = await pool.query(columnsQuery);
    const existingColumns = columnsResult.rows.map(row => row.column_name);
    const columnInfo = {};
    columnsResult.rows.forEach(row => {
      columnInfo[row.column_name] = row.data_type;
    });
    
    // commenter_name 컬럼 추가 (없으면)
    if (!existingColumns.includes('commenter_name')) {
      await pool.query(`
        ALTER TABLE diet_comments 
        ADD COLUMN commenter_name VARCHAR(100)
      `);
      console.log('[PostgreSQL] commenter_name 컬럼이 추가되었습니다.');
    }
    
    // commenter_id 타입을 UUID에서 VARCHAR로 변경 (향후 트레이너 username 저장을 위해)
    if (columnInfo.commenter_id === 'uuid') {
      console.log('[PostgreSQL] commenter_id 컬럼 타입을 UUID에서 VARCHAR로 변경합니다...');
      
      // 1. 임시 컬럼 생성
      await pool.query(`
        ALTER TABLE diet_comments 
        ADD COLUMN commenter_id_new VARCHAR(100)
      `);
      
      // 2. 기존 UUID 데이터를 문자열로 변환하여 임시 컬럼에 복사
      await pool.query(`
        UPDATE diet_comments 
        SET commenter_id_new = commenter_id::text
      `);
      
      // 3. 기존 컬럼 삭제
      await pool.query(`
        ALTER TABLE diet_comments 
        DROP COLUMN commenter_id
      `);
      
      // 4. 임시 컬럼을 commenter_id로 이름 변경
      await pool.query(`
        ALTER TABLE diet_comments 
        RENAME COLUMN commenter_id_new TO commenter_id
      `);
      
      // 5. NOT NULL 제약조건 추가
      await pool.query(`
        ALTER TABLE diet_comments 
        ALTER COLUMN commenter_id SET NOT NULL
      `);
      
      console.log('[PostgreSQL] commenter_id 컬럼이 VARCHAR(100)로 변경되었습니다.');
    }
    
    // 인덱스 업데이트
    await createDietCommentsIndexes();
  } catch (error) {
    console.error('[PostgreSQL] diet_comments 테이블 마이그레이션 오류:', error);
    throw error;
  }
};

// 인덱스 생성
const createDietRecordsIndexes = async () => {
  try {
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_diet_records_user_id ON diet_records(app_user_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_diet_records_date ON diet_records(meal_date)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_diet_records_user_date 
      ON diet_records(app_user_id, meal_date DESC)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_diet_records_user_date_created 
      ON diet_records(app_user_id, meal_date DESC, created_at DESC)
    `);
    
    console.log('[PostgreSQL] 식단기록 인덱스가 생성되었습니다.');
    
    // 인덱스 변경 후 통계 정보 업데이트
    await pool.query(`ANALYZE diet_records`);
  } catch (error) {
    console.error('[PostgreSQL] 식단기록 인덱스 생성 오류:', error);
  }
};

// 코멘트 인덱스 생성
const createDietCommentsIndexes = async () => {
  try {
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_diet_comments_record_id 
      ON diet_comments(diet_record_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_diet_comments_created 
      ON diet_comments(diet_record_id, created_at ASC)
    `);
    
    console.log('[PostgreSQL] 식단 코멘트 인덱스가 생성되었습니다.');
  } catch (error) {
    console.error('[PostgreSQL] 식단 코멘트 인덱스 생성 오류:', error);
  }
};

// 식단기록 목록 조회 (앱 유저 ID로 필터링)
const getDietRecords = async (appUserId, filters = {}) => {
  try {
    let query = `
      SELECT 
        dr.id,
        dr.app_user_id,
        dr.meal_date,
        dr.meal_time,
        dr.meal_type,
        dr.image_url,
        dr.image_thumbnail_url,
        dr.notes,
        dr.created_at,
        dr.updated_at
      FROM diet_records dr
      WHERE dr.app_user_id = $1
    `;
    const params = [appUserId];
    
    // 날짜 필터
    if (filters.startDate) {
      query += ` AND dr.meal_date >= $${params.length + 1}`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ` AND dr.meal_date <= $${params.length + 1}`;
      params.push(filters.endDate);
    }
    
    // 정렬 (날짜 내림차순, 시간 오름차순 - 아침부터 저녁까지)
    query += ` ORDER BY dr.meal_date DESC, dr.meal_time ASC NULLS LAST`;
    
    // 페이지네이션
    if (filters.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(filters.limit);
      if (filters.offset) {
        query += ` OFFSET $${params.length + 1}`;
        params.push(filters.offset);
      }
    }
    
    const result = await pool.query(query, params);
    
    // 날짜 정규화
    for (const record of result.rows) {
      // meal_date를 YYYY-MM-DD 형식의 문자열로 변환
      if (record.meal_date) {
        if (record.meal_date instanceof Date) {
          const year = record.meal_date.getFullYear();
          const month = String(record.meal_date.getMonth() + 1).padStart(2, '0');
          const day = String(record.meal_date.getDate()).padStart(2, '0');
          record.meal_date = `${year}-${month}-${day}`;
        } else if (typeof record.meal_date === 'string') {
          record.meal_date = record.meal_date.split('T')[0];
        }
      }
      
      // meal_time 정규화 (HH:MM:SS 형식)
      if (record.meal_time) {
        if (typeof record.meal_time === 'string') {
          // TIME 타입은 이미 HH:MM:SS 형식
          record.meal_time = record.meal_time.split('.')[0]; // 밀리초 제거
        }
      }
      
      // 초기화: 빈 배열로 시작
      record.comments = [];
      record.comment_count = 0;
    }
    
    // 코멘트 조회 (일괄 조회로 N+1 문제 해결)
    const recordIds = result.rows.map(r => r.id);
    if (recordIds.length > 0) {
      // 코멘트 개수 조회
      const commentCountQuery = `
        SELECT 
          diet_record_id,
          COUNT(*) as count
        FROM diet_comments
        WHERE diet_record_id = ANY($1::uuid[])
        GROUP BY diet_record_id
      `;
      const commentCountResult = await pool.query(commentCountQuery, [recordIds]);
      
      // 코멘트 개수를 각 레코드에 할당
      const countMap = new Map();
      commentCountResult.rows.forEach(row => {
        countMap.set(row.diet_record_id, parseInt(row.count));
      });
      
      // 코멘트 내용 조회 (유저 + 트레이너 코멘트 모두) - 변환 없이 그대로 반환
      const commentsQuery = `
        SELECT 
          id,
          diet_record_id,
          commenter_type,
          commenter_id,
          commenter_name,
          comment_text,
          created_at
        FROM diet_comments
        WHERE diet_record_id = ANY($1::uuid[])
          AND commenter_type IN ('user', 'trainer')
        ORDER BY created_at ASC
      `;
      const commentsResult = await pool.query(commentsQuery, [recordIds]);
      
      // 코멘트를 각 레코드에 할당 (PostgreSQL에서 이미 한국 시간으로 변환됨)
      const commentsMap = new Map();
      commentsResult.rows.forEach(comment => {
        if (!commentsMap.has(comment.diet_record_id)) {
          commentsMap.set(comment.diet_record_id, []);
        }
        commentsMap.get(comment.diet_record_id).push({
          id: comment.id,
          commenter_type: comment.commenter_type,
          commenter_id: comment.commenter_id,
          commenter_name: comment.commenter_name,
          comment_text: comment.comment_text,
          created_at: comment.created_at
        });
      });
      
      result.rows.forEach(record => {
        record.comment_count = countMap.get(record.id) || 0;
        record.comments = commentsMap.get(record.id) || [];
      });
    }
    
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 식단기록 조회 오류:', error);
    throw error;
  }
};

// 식단기록 단일 조회
const getDietRecordById = async (id, appUserId) => {
  try {
    const query = `
      SELECT 
        dr.id,
        dr.app_user_id,
        dr.meal_date,
        dr.meal_time,
        dr.meal_type,
        dr.image_url,
        dr.image_thumbnail_url,
        dr.notes,
        dr.created_at,
        dr.updated_at
      FROM diet_records dr
      WHERE dr.id = $1 AND dr.app_user_id = $2
    `;
    const result = await pool.query(query, [id, appUserId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const record = result.rows[0];
    
    // 날짜 정규화
    if (record.meal_date) {
      if (record.meal_date instanceof Date) {
        const year = record.meal_date.getFullYear();
        const month = String(record.meal_date.getMonth() + 1).padStart(2, '0');
        const day = String(record.meal_date.getDate()).padStart(2, '0');
        record.meal_date = `${year}-${month}-${day}`;
      } else if (typeof record.meal_date === 'string') {
        record.meal_date = record.meal_date.split('T')[0];
      }
    }
    
    // meal_time 정규화
    if (record.meal_time && typeof record.meal_time === 'string') {
      record.meal_time = record.meal_time.split('.')[0];
    }
    
    // 코멘트 정보 조회 - 변환 없이 그대로 반환
    const comments = await pool.query(`
      SELECT 
        id,
        diet_record_id,
        commenter_type,
        commenter_id,
        commenter_name,
        comment_text,
        created_at,
        updated_at
      FROM diet_comments
      WHERE diet_record_id = $1
      ORDER BY created_at ASC
    `, [id]);
    
    record.comments = comments.rows;
    
    return record;
  } catch (error) {
    console.error('[PostgreSQL] 식단기록 단일 조회 오류:', error);
    throw error;
  }
};

// 식단기록 추가
const addDietRecord = async (dietData) => {
  try {
    if (!dietData.meal_type) {
      throw new Error('식사 구분은 필수 항목입니다.');
    }
    
    const insertQuery = `
      INSERT INTO diet_records (
        app_user_id,
        meal_date,
        meal_time,
        meal_type,
        image_url,
        image_thumbnail_url,
        notes,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() AT TIME ZONE 'Asia/Seoul', NOW() AT TIME ZONE 'Asia/Seoul')
      RETURNING 
        id, app_user_id, meal_date, meal_time, meal_type, 
        image_url, image_thumbnail_url, notes,
        created_at,
        updated_at
    `;
    const insertValues = [
      dietData.app_user_id,
      dietData.meal_date,
      dietData.meal_time || null,
      dietData.meal_type,
      dietData.image_url || null,
      dietData.image_thumbnail_url || null,
      dietData.notes || ''
    ];
    const result = await pool.query(insertQuery, insertValues);
    const record = result.rows[0];
    
    // 날짜 정규화
    if (record.meal_date) {
      if (record.meal_date instanceof Date) {
        const year = record.meal_date.getFullYear();
        const month = String(record.meal_date.getMonth() + 1).padStart(2, '0');
        const day = String(record.meal_date.getDate()).padStart(2, '0');
        record.meal_date = `${year}-${month}-${day}`;
      } else if (typeof record.meal_date === 'string') {
        record.meal_date = record.meal_date.split('T')[0];
      }
    }
    
    // meal_time 정규화
    if (record.meal_time && typeof record.meal_time === 'string') {
      record.meal_time = record.meal_time.split('.')[0];
    }
    
    record.comments = [];
    record.comment_count = 0;
    
    return record;
  } catch (error) {
    console.error('[PostgreSQL] 식단기록 추가 오류:', error);
    throw error;
  }
};

// 식단기록 수정
const updateDietRecord = async (id, appUserId, updates) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (updates.meal_date !== undefined) {
      fields.push(`meal_date = $${paramIndex++}`);
      values.push(updates.meal_date);
    }
    if (updates.meal_time !== undefined) {
      fields.push(`meal_time = $${paramIndex++}`);
      values.push(updates.meal_time || null);
    }
    if (updates.meal_type !== undefined) {
      if (!updates.meal_type) {
        throw new Error('식사 구분은 필수 항목입니다.');
      }
      fields.push(`meal_type = $${paramIndex++}`);
      values.push(updates.meal_type);
    }
    if (updates.image_url !== undefined) {
      fields.push(`image_url = $${paramIndex++}`);
      values.push(updates.image_url || null);
    }
    if (updates.image_thumbnail_url !== undefined) {
      fields.push(`image_thumbnail_url = $${paramIndex++}`);
      values.push(updates.image_thumbnail_url || null);
    }
    if (updates.notes !== undefined) {
      fields.push(`notes = $${paramIndex++}`);
      values.push(updates.notes || '');
    }
    
    if (fields.length > 0) {
      fields.push(`updated_at = NOW() AT TIME ZONE 'Asia/Seoul'`);
      values.push(id, appUserId);
      
      const query = `
        UPDATE diet_records
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex++} AND app_user_id = $${paramIndex++}
        RETURNING 
          id, app_user_id, meal_date, meal_time, meal_type, 
          image_url, image_thumbnail_url, notes,
          created_at,
          updated_at
      `;
      
      await pool.query(query, values);
    }
    
    // 업데이트된 레코드 조회
    return await getDietRecordById(id, appUserId);
  } catch (error) {
    console.error('[PostgreSQL] 식단기록 수정 오류:', error);
    throw error;
  }
};

// 식단기록 삭제
const deleteDietRecord = async (id, appUserId) => {
  try {
    const query = `
      DELETE FROM diet_records
      WHERE id = $1 AND app_user_id = $2
      RETURNING id
    `;
    const result = await pool.query(query, [id, appUserId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] 식단기록 삭제 오류:', error);
    throw error;
  }
};

// 캘린더용 경량 조회 (날짜별 완료 여부만 반환)
const getDietRecordsForCalendar = async (appUserId, startDate = null, endDate = null) => {
  try {
    let query = `
      SELECT 
        dr.meal_date,
        COUNT(*) as count
      FROM diet_records dr
      WHERE dr.app_user_id = $1
    `;
    const params = [appUserId];
    let paramIndex = 2;
    
    if (startDate) {
      query += ` AND dr.meal_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      query += ` AND dr.meal_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }
    
    query += ` GROUP BY dr.meal_date ORDER BY dr.meal_date ASC`;
    
    const result = await pool.query(query, params);
    
    // 날짜별로 요약
    const summary = {};
    for (const row of result.rows) {
      let dateStr = row.meal_date;
      if (dateStr instanceof Date) {
        const year = dateStr.getFullYear();
        const month = String(dateStr.getMonth() + 1).padStart(2, '0');
        const day = String(dateStr.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      } else if (typeof dateStr === 'string') {
        dateStr = dateStr.split('T')[0];
      }
      
      summary[dateStr] = {
        hasDiet: true,
        count: parseInt(row.count)
      };
    }
    
    return summary;
  } catch (error) {
    console.error('[PostgreSQL] 캘린더용 식단기록 조회 오류:', error);
    throw error;
  }
};

// 코멘트 추가
const addDietComment = async (dietRecordId, commentData) => {
  try {
    const insertQuery = `
      INSERT INTO diet_comments (
        diet_record_id,
        commenter_type,
        commenter_id,
        commenter_name,
        comment_text,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW() AT TIME ZONE 'Asia/Seoul', NOW() AT TIME ZONE 'Asia/Seoul')
      RETURNING 
        id, diet_record_id, commenter_type, commenter_id, 
        commenter_name, comment_text,
        created_at,
        updated_at
    `;
    const insertValues = [
      dietRecordId,
      commentData.commenter_type,
      commentData.commenter_id,
      commentData.commenter_name || null,
      commentData.comment_text
    ];
    const result = await pool.query(insertQuery, insertValues);
    // PostgreSQL에서 이미 한국 시간으로 변환됨
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 식단 코멘트 추가 오류:', error);
    throw error;
  }
};

// 코멘트 수정
const updateDietComment = async (commentId, commenterId, commenterType, updates) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (updates.comment_text !== undefined) {
      fields.push(`comment_text = $${paramIndex++}`);
      values.push(updates.comment_text);
    }
    
    if (fields.length > 0) {
      fields.push(`updated_at = NOW() AT TIME ZONE 'Asia/Seoul'`);
      values.push(commentId, commenterId, commenterType);
      
      const query = `
        UPDATE diet_comments
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex++} 
          AND commenter_id = $${paramIndex++} 
          AND commenter_type = $${paramIndex++}
        RETURNING 
          id, diet_record_id, commenter_type, commenter_id, 
          commenter_name, comment_text,
          created_at,
          updated_at
      `;
      
      const result = await pool.query(query, values);
      // PostgreSQL에서 이미 한국 시간으로 변환됨
      return result.rows[0] || null;
    }
    
    return null;
  } catch (error) {
    console.error('[PostgreSQL] 식단 코멘트 수정 오류:', error);
    throw error;
  }
};

// 코멘트 삭제
const deleteDietComment = async (commentId, commenterId, commenterType) => {
  try {
    const query = `
      DELETE FROM diet_comments
      WHERE id = $1 AND commenter_id = $2 AND commenter_type = $3
      RETURNING id
    `;
    const result = await pool.query(query, [commentId, commenterId, commenterType]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] 식단 코멘트 삭제 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  await createDietRecordsTable();
  // createDietRecordsTable 내에서 createDietCommentsTable 호출됨
};

module.exports = {
  initializeDatabase,
  getDietRecords,
  getDietRecordById,
  addDietRecord,
  updateDietRecord,
  deleteDietRecord,
  getDietRecordsForCalendar,
  addDietComment,
  updateDietComment,
  deleteDietComment
};
