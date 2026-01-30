const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const { runMigration } = require('./migrations-manager');

// PostgreSQL 연결 풀 생성
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 날짜 유효성 검사 및 수정 함수
const validateAndFixDate = (dateString) => {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }
  
  try {
    // 날짜 형식 검사 (YYYY-MM-DD)
    const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
    const match = dateString.match(dateRegex);
    
    if (!match) {
      console.warn(`[Date Validation] Invalid date format: ${dateString}`);
      return null;
    }
    
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    const day = parseInt(match[3]);
    
    // 기본 범위 검사
    if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      console.warn(`[Date Validation] Date out of range: ${dateString}`);
      return null;
    }
    
    // 실제 날짜 유효성 검사
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      console.warn(`[Date Validation] Invalid date: ${dateString}, adjusting...`);
      
      // 해당 월의 마지막 날짜로 조정
      const lastDay = new Date(year, month, 0).getDate();
      const adjustedDay = Math.min(day, lastDay);
      
      const adjustedDate = `${year}-${String(month).padStart(2, '0')}-${String(adjustedDay).padStart(2, '0')}`;
      console.log(`[Date Validation] Adjusted date: ${dateString} -> ${adjustedDate}`);
      
      return adjustedDate;
    }
    
    return dateString;
  } catch (error) {
    console.error(`[Date Validation] Error validating date ${dateString}:`, error);
    return null;
  }
};

// Trial 테이블 생성 및 마이그레이션
const createTrialsTable = async () => {
  try {
    // 테이블 존재 여부 확인 (최초에는 생성, 이후에는 생성 과정 생략)
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'trials'
    `;
    const checkResult = await pool.query(checkQuery);
    
    // 테이블이 없을 때만 생성
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE trials (
          id UUID PRIMARY KEY,
          session_id UUID UNIQUE,
          center VARCHAR(100),
          date DATE NOT NULL,
          time TIME NOT NULL,
          trainer VARCHAR(100) NOT NULL,
          member_name VARCHAR(100),
          gender VARCHAR(10),
          phone VARCHAR(20),
          source VARCHAR(100),
          purpose TEXT,
          notes TEXT,
          result TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      console.log('[PostgreSQL] Trial 테이블이 생성되었습니다.');
    } else {
      // 기존 테이블에 컬럼 추가 (마이그레이션) - 추적 시스템 사용
      await runMigration(
        'add_columns_to_trials_20250131',
        'Trial 테이블에 session_id, center, created_at, updated_at 컬럼 추가',
        migrateTrialsTable
      );
    }
  } catch (error) {
    console.error('[PostgreSQL] Trial 테이블 생성 오류:', error);
  }
};

// 마이그레이션 함수 - 컬럼 추가 등을 처리
const migrateTrialsTable = async () => {
  try {
    // 각 컬럼의 존재 여부 확인 및 추가
    const columns = [
      { name: 'session_id', type: 'UUID UNIQUE' },
      { name: 'center', type: 'VARCHAR(100)' },
      { name: 'created_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' }
    ];
    
    for (const col of columns) {
      const checkQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'trials' 
        AND column_name = $1
      `;
      const result = await pool.query(checkQuery, [col.name]);
      
      if (result.rows.length === 0) {
        const alterQuery = `ALTER TABLE trials ADD COLUMN ${col.name} ${col.type}`;
        await pool.query(alterQuery);
        console.log(`[PostgreSQL] Trial 테이블에 ${col.name} 컬럼이 추가되었습니다.`);
      }
    }
  } catch (error) {
    console.error('[PostgreSQL] Trial 테이블 마이그레이션 오류:', error);
  }
};

// Trial 목록 조회
const getTrials = async (filters = {}) => {
  try {
    let query = `
      SELECT 
        id, session_id, center, date::text, SUBSTRING(time::text, 1, 5) as time,
        trainer, member_name, gender, phone, source, purpose, notes, result,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
      FROM trials
    `;
    const params = [];
    let paramIndex = 1;

    // 필터 조건 추가
    const conditions = [];
    if (filters.trainer) {
      conditions.push(`trainer = $${paramIndex++}`);
      params.push(filters.trainer);
    }
    if (filters.date) {
      const validatedDate = validateAndFixDate(filters.date);
      if (validatedDate) {
        conditions.push(`date = $${paramIndex++}`);
        params.push(validatedDate);
      } else {
        console.warn(`[Date Validation] Skipping invalid date filter: ${filters.date}`);
      }
    }
    if (filters.startDate && filters.endDate) {
      const validatedStartDate = validateAndFixDate(filters.startDate);
      const validatedEndDate = validateAndFixDate(filters.endDate);
      if (validatedStartDate && validatedEndDate) {
        conditions.push(`date >= $${paramIndex++} AND date <= $${paramIndex++}`);
        params.push(validatedStartDate);
        params.push(validatedEndDate);
      }
    }
    if (filters.yearMonth) {
      const [year, month] = filters.yearMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
      const validatedStartDate = validateAndFixDate(startDate);
      const validatedEndDate = validateAndFixDate(endDate);
      if (validatedStartDate && validatedEndDate) {
        conditions.push(`date >= $${paramIndex++} AND date <= $${paramIndex++}`);
        params.push(validatedStartDate);
        params.push(validatedEndDate);
      }
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY date DESC, time DESC';
    const result = await pool.query(query, params);
    
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] Trial 조회 오류:', error);
    throw error;
  }
};

// Trial 추가
const addTrial = async (trial) => {
  try {
    const validatedDate = validateAndFixDate(trial.date);
    if (!validatedDate) {
      throw new Error(`Invalid date: ${trial.date}`);
    }
    
    const id = trial.id || uuidv4();
    const query = `
      INSERT INTO trials (
        id, session_id, center, date, time, trainer, member_name, gender, phone, 
        source, purpose, notes, result, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING 
        id, session_id, center, date::text, SUBSTRING(time::text, 1, 5) as time,
        trainer, member_name, gender, phone, source, purpose, notes, result,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
    `;
    
    const values = [
      id,
      trial.session_id || null,
      trial.center || null,
      validatedDate,
      trial.time,
      trial.trainer,
      trial.member_name || null,
      trial.gender || null,
      trial.phone || null,
      trial.source || null,
      trial.purpose || null,
      trial.notes || null,
      trial.result || null
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] Trial 추가 오류:', error);
    throw error;
  }
};

// Trial 수정
const updateTrial = async (id, updates) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.date) {
      const validatedDate = validateAndFixDate(updates.date);
      if (validatedDate) {
        fields.push(`date = $${paramIndex++}`);
        values.push(validatedDate);
      } else {
        throw new Error(`Invalid date: ${updates.date}`);
      }
    }
    if (updates.session_id !== undefined) {
      fields.push(`session_id = $${paramIndex++}`);
      values.push(updates.session_id || null);
    }
    if (updates.center !== undefined) {
      fields.push(`center = $${paramIndex++}`);
      values.push(updates.center || null);
    }
    if (updates.time) {
      fields.push(`time = $${paramIndex++}`);
      values.push(updates.time);
    }
    if (updates.trainer !== undefined) {
      fields.push(`trainer = $${paramIndex++}`);
      values.push(updates.trainer);
    }
    if (updates.member_name !== undefined) {
      fields.push(`member_name = $${paramIndex++}`);
      values.push(updates.member_name || null);
    }
    if (updates.gender !== undefined) {
      fields.push(`gender = $${paramIndex++}`);
      values.push(updates.gender || null);
    }
    if (updates.phone !== undefined) {
      fields.push(`phone = $${paramIndex++}`);
      values.push(updates.phone || null);
    }
    if (updates.source !== undefined) {
      fields.push(`source = $${paramIndex++}`);
      values.push(updates.source || null);
    }
    if (updates.purpose !== undefined) {
      fields.push(`purpose = $${paramIndex++}`);
      values.push(updates.purpose || null);
    }
    if (updates.notes !== undefined) {
      fields.push(`notes = $${paramIndex++}`);
      values.push(updates.notes || null);
    }
    if (updates.result !== undefined) {
      fields.push(`result = $${paramIndex++}`);
      values.push(updates.result || null);
    }

    if (fields.length === 0) {
      throw new Error('업데이트할 필드가 없습니다.');
    }

    // updated_at 자동 업데이트
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE trials 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING 
        id, session_id, center, date::text, SUBSTRING(time::text, 1, 5) as time,
        trainer, member_name, gender, phone, source, purpose, notes, result,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
    `;
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Trial을 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] Trial 수정 오류:', error);
    throw error;
  }
};

// Trial 삭제
const deleteTrial = async (id) => {
  try {
    const query = 'DELETE FROM trials WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('Trial을 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] Trial 삭제 오류:', error);
    throw error;
  }
};

// Trial ID로 조회
const getTrialById = async (id) => {
  try {
    const query = `
      SELECT 
        id, session_id, center, date::text, SUBSTRING(time::text, 1, 5) as time,
        trainer, member_name, gender, phone, source, purpose, notes, result,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
      FROM trials 
      WHERE id = $1
    `;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] Trial ID 조회 오류:', error);
    throw error;
  }
};

// session_id로 trial 조회
const getTrialBySessionId = async (sessionId) => {
  try {
    const query = `
      SELECT 
        id, session_id, center, date::text, SUBSTRING(time::text, 1, 5) as time,
        trainer, member_name, gender, phone, source, purpose, notes, result,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
      FROM trials 
      WHERE session_id = $1
    `;
    const result = await pool.query(query, [sessionId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] Trial session_id 조회 오류:', error);
    throw error;
  }
};

// session_id로 trial 삭제
const deleteTrialBySessionId = async (sessionId) => {
  try {
    const query = 'DELETE FROM trials WHERE session_id = $1 RETURNING id';
    const result = await pool.query(query, [sessionId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] Trial session_id 삭제 오류:', error);
    throw error;
  }
};

// session_id로 trial 업데이트
const updateTrialBySessionId = async (sessionId, updates) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.date) {
      const validatedDate = validateAndFixDate(updates.date);
      if (validatedDate) {
        fields.push(`date = $${paramIndex++}`);
        values.push(validatedDate);
      } else {
        throw new Error(`Invalid date: ${updates.date}`);
      }
    }
    if (updates.time) {
      fields.push(`time = $${paramIndex++}`);
      values.push(updates.time);
    }
    if (updates.trainer !== undefined) {
      fields.push(`trainer = $${paramIndex++}`);
      values.push(updates.trainer);
    }
    if (updates.center !== undefined) {
      fields.push(`center = $${paramIndex++}`);
      values.push(updates.center || null);
    }
    if (updates.member_name !== undefined) {
      fields.push(`member_name = $${paramIndex++}`);
      values.push(updates.member_name || null);
    }

    if (fields.length === 0) {
      throw new Error('업데이트할 필드가 없습니다.');
    }

    // updated_at 자동 업데이트
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(sessionId);

    const query = `
      UPDATE trials 
      SET ${fields.join(', ')}
      WHERE session_id = $${paramIndex}
      RETURNING 
        id, session_id, center, date::text, SUBSTRING(time::text, 1, 5) as time,
        trainer, member_name, gender, phone, source, purpose, notes, result,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
    `;
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] Trial session_id 수정 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  await createTrialsTable();
};

module.exports = {
  initializeDatabase,
  getTrials,
  addTrial,
  updateTrial,
  deleteTrial,
  getTrialById,
  getTrialBySessionId,
  deleteTrialBySessionId,
  updateTrialBySessionId
};
