const { Pool } = require('pg');
const { runMigration } = require('./migrations-manager');
const { v4: uuidv4 } = require('uuid');

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
    const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
    const match = dateString.match(dateRegex);
    
    if (!match) {
      console.warn(`[Date Validation] Invalid date format: ${dateString}`);
      return null;
    }
    
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    const day = parseInt(match[3]);
    
    if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      console.warn(`[Date Validation] Date out of range: ${dateString}`);
      return null;
    }
    
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      const lastDay = new Date(year, month, 0).getDate();
      const adjustedDay = Math.min(day, lastDay);
      const adjustedDate = `${year}-${String(month).padStart(2, '0')}-${String(adjustedDay).padStart(2, '0')}`;
      return adjustedDate;
    }
    
    return dateString;
  } catch (error) {
    console.error(`[Date Validation] Error validating date ${dateString}:`, error);
    return null;
  }
};

// Renewals 테이블 생성 및 마이그레이션
const createRenewalsTable = async () => {
  try {
    // 테이블 존재 여부 확인 (최초에는 생성, 이후에는 생성 과정 생략)
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'renewals'
    `;
    const checkResult = await pool.query(checkQuery);
    
    // 테이블이 없을 때만 생성
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE renewals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          center VARCHAR(100) NOT NULL,
          trainer VARCHAR(100) NOT NULL,
          month VARCHAR(7) NOT NULL,
          member_names TEXT[] NOT NULL,
          expected_sessions JSONB NOT NULL,
          actual_sessions JSONB,
          status JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      console.log('[PostgreSQL] Renewals 테이블이 생성되었습니다.');
    } else {
      // 기존 테이블에 컬럼 추가 (마이그레이션)
      await runMigration(
        'migrate_renewals_20250131',
        'Renewals 테이블 마이그레이션',
        migrateRenewalsTable
      );
    }
  } catch (error) {
    console.error('[PostgreSQL] Renewals 테이블 생성 오류:', error);
  }
};

// 마이그레이션 함수 - 컬럼 타입 변경 등을 처리
const migrateRenewalsTable = async () => {
  try {
    // expected_sessions와 actual_sessions 컬럼 타입 확인 및 변경
    const checkColumnQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'renewals'
      AND column_name IN ('expected_sessions', 'actual_sessions', 'status')
    `;
    const columnResult = await pool.query(checkColumnQuery);
    
    const columnTypes = {};
    columnResult.rows.forEach(row => {
      columnTypes[row.column_name] = row.data_type;
    });
    
    // expected_sessions가 INTEGER면 JSONB로 변경
    if (columnTypes.expected_sessions === 'integer') {
      // 컬럼 타입을 먼저 TEXT로 변경 (중간 단계)
      await pool.query(`
        ALTER TABLE renewals 
        ALTER COLUMN expected_sessions TYPE TEXT 
        USING expected_sessions::text
      `);
      
      // 기존 데이터를 JSONB 형식으로 변환
      const existingData = await pool.query('SELECT id, member_names, expected_sessions FROM renewals');
      
      for (const row of existingData.rows) {
        const memberNames = row.member_names || [];
        const sessionValue = parseInt(row.expected_sessions) || 0;
        const jsonbValue = {};
        memberNames.forEach(name => {
          jsonbValue[name] = sessionValue;
        });
        
        await pool.query(
          'UPDATE renewals SET expected_sessions = $1 WHERE id = $2',
          [JSON.stringify(jsonbValue), row.id]
        );
      }
      
      // 컬럼 타입을 JSONB로 변경
      await pool.query(`
        ALTER TABLE renewals 
        ALTER COLUMN expected_sessions TYPE JSONB 
        USING expected_sessions::jsonb
      `);
      await pool.query(`
        ALTER TABLE renewals 
        ALTER COLUMN expected_sessions SET NOT NULL
      `);
      console.log('[PostgreSQL] Renewals 테이블의 expected_sessions 컬럼이 JSONB로 변경되었습니다.');
    }
    
    // actual_sessions가 INTEGER면 JSONB로 변경
    if (columnTypes.actual_sessions === 'integer') {
      // 컬럼 타입을 먼저 TEXT로 변경 (중간 단계)
      await pool.query(`
        ALTER TABLE renewals 
        ALTER COLUMN actual_sessions TYPE TEXT 
        USING CASE 
          WHEN actual_sessions IS NULL THEN NULL
          ELSE actual_sessions::text
        END
      `);
      
      // 기존 데이터를 JSONB 형식으로 변환
      const existingData = await pool.query('SELECT id, member_names, actual_sessions FROM renewals WHERE actual_sessions IS NOT NULL');
      
      for (const row of existingData.rows) {
        const memberNames = row.member_names || [];
        const sessionValue = parseInt(row.actual_sessions) || 0;
        const jsonbValue = {};
        memberNames.forEach(name => {
          jsonbValue[name] = sessionValue;
        });
        
        await pool.query(
          'UPDATE renewals SET actual_sessions = $1 WHERE id = $2',
          [JSON.stringify(jsonbValue), row.id]
        );
      }
      
      // 컬럼 타입을 JSONB로 변경
      await pool.query(`
        ALTER TABLE renewals 
        ALTER COLUMN actual_sessions TYPE JSONB 
        USING CASE 
          WHEN actual_sessions IS NULL THEN NULL
          ELSE actual_sessions::jsonb
        END
      `);
      console.log('[PostgreSQL] Renewals 테이블의 actual_sessions 컬럼이 JSONB로 변경되었습니다.');
    }
    
    // month 컬럼 추가 (없으면 추가)
    const checkMonthColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'renewals' 
      AND column_name = 'month'
    `);
    
    if (checkMonthColumn.rows.length === 0) {
      // month 컬럼 추가
      await pool.query(`
        ALTER TABLE renewals 
        ADD COLUMN month VARCHAR(7)
      `);
      
      // 기존 데이터의 month 값을 created_at에서 추출하여 설정
      const existingData = await pool.query('SELECT id, created_at FROM renewals WHERE month IS NULL');
      
      for (const row of existingData.rows) {
        const createdAt = new Date(row.created_at);
        const year = createdAt.getFullYear();
        const month = String(createdAt.getMonth() + 1).padStart(2, '0');
        const yearMonth = `${year}-${month}`;
        
        await pool.query(
          'UPDATE renewals SET month = $1 WHERE id = $2',
          [yearMonth, row.id]
        );
      }
      
      // NOT NULL 제약조건 추가
      await pool.query(`
        ALTER TABLE renewals 
        ALTER COLUMN month SET NOT NULL
      `);
      
      console.log('[PostgreSQL] Renewals 테이블에 month 컬럼이 추가되었습니다.');
    }
    
    // status가 VARCHAR면 JSONB로 변경
    if (columnTypes.status === 'character varying' || columnTypes.status === 'varchar') {
      // DEFAULT 제약조건 제거
      await pool.query(`
        ALTER TABLE renewals 
        ALTER COLUMN status DROP DEFAULT
      `);
      
      // 컬럼 타입을 먼저 TEXT로 변경 (중간 단계)
      await pool.query(`
        ALTER TABLE renewals 
        ALTER COLUMN status TYPE TEXT 
        USING status::text
      `);
      
      // 기존 데이터를 JSONB 형식으로 변환 (모든 회원에 동일한 상태 적용)
      const existingData = await pool.query('SELECT id, member_names, status FROM renewals');
      
      for (const row of existingData.rows) {
        const memberNames = row.member_names || [];
        const statusValue = row.status || '예상';
        const jsonbValue = {};
        memberNames.forEach(name => {
          jsonbValue[name] = statusValue;
        });
        
        await pool.query(
          'UPDATE renewals SET status = $1 WHERE id = $2',
          [JSON.stringify(jsonbValue), row.id]
        );
      }
      
      // 컬럼 타입을 JSONB로 변경
      await pool.query(`
        ALTER TABLE renewals 
        ALTER COLUMN status TYPE JSONB 
        USING status::jsonb
      `);
      console.log('[PostgreSQL] Renewals 테이블의 status 컬럼이 JSONB로 변경되었습니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] Renewals 테이블 마이그레이션 오류:', error);
  }
};

// Renewals 목록 조회
const getRenewals = async (filters = {}) => {
  try {
    let query = `
      SELECT 
        id, center, trainer, month, member_names, expected_sessions, actual_sessions, status,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
      FROM renewals
    `;
    const params = [];
    let paramIndex = 1;

    const conditions = [];
    if (filters.center) {
      conditions.push(`center = $${paramIndex++}`);
      params.push(filters.center);
    }
    if (filters.trainer) {
      conditions.push(`trainer = $${paramIndex++}`);
      params.push(filters.trainer);
    }
    if (filters.month) {
      conditions.push(`month = $${paramIndex++}`);
      params.push(filters.month);
    }
    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    
    return result.rows.map(row => ({
      id: row.id,
      center: row.center,
      trainer: row.trainer,
      month: row.month,
      member_names: row.member_names || [],
      expected_sessions: row.expected_sessions,
      actual_sessions: row.actual_sessions,
      status: (() => {
        if (row.status === null || row.status === undefined) return null;
        if (typeof row.status === 'string') {
          try {
            return JSON.parse(row.status);
          } catch (e) {
            return null;
          }
        }
        return typeof row.status === 'object' ? row.status : null;
      })(),
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  } catch (error) {
    console.error('[PostgreSQL] Renewals 조회 오류:', error);
    throw error;
  }
};

// Renewal 추가
const addRenewal = async (renewal) => {
  try {
    const id = renewal.id || uuidv4();
    const query = `
      INSERT INTO renewals (
        id, center, trainer, month, member_names, expected_sessions, actual_sessions, status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING 
        id, center, trainer, month, member_names, expected_sessions, actual_sessions, status,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
    `;
    
    const values = [
      id,
      renewal.center,
      renewal.trainer,
      renewal.month,
      renewal.member_names || [],
      renewal.expected_sessions || {},
      renewal.actual_sessions || null,
      renewal.status || null
    ];
    
    const result = await pool.query(query, values);
    const row = result.rows[0];
    return {
      id: row.id,
      center: row.center,
      trainer: row.trainer,
      month: row.month,
      member_names: row.member_names || [],
      expected_sessions: row.expected_sessions,
      actual_sessions: row.actual_sessions,
      status: (() => {
        if (row.status === null || row.status === undefined) return null;
        if (typeof row.status === 'string') {
          try {
            return JSON.parse(row.status);
          } catch (e) {
            return null;
          }
        }
        return typeof row.status === 'object' ? row.status : null;
      })(),
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  } catch (error) {
    console.error('[PostgreSQL] Renewal 추가 오류:', error);
    throw error;
  }
};

// Renewal 수정
const updateRenewal = async (id, updates) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.member_names !== undefined) {
      fields.push(`member_names = $${paramIndex++}`);
      values.push(updates.member_names);
    }
    if (updates.expected_sessions !== undefined) {
      fields.push(`expected_sessions = $${paramIndex++}::jsonb`);
      values.push(updates.expected_sessions);
    }
    if (updates.actual_sessions !== undefined) {
      fields.push(`actual_sessions = $${paramIndex++}::jsonb`);
      values.push(updates.actual_sessions);
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex++}::jsonb`);
      values.push(updates.status);
    }

    if (fields.length === 0) {
      throw new Error('업데이트할 필드가 없습니다.');
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE renewals 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING 
        id, center, trainer, month, member_names, expected_sessions, actual_sessions, status,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Renewal을 찾을 수 없습니다.');
    }
    
    const row = result.rows[0];
    
    // JSONB가 문자열로 반환되는 경우 파싱
    let statusValue = null;
    if (row.status !== null && row.status !== undefined) {
      if (typeof row.status === 'string') {
        try {
          statusValue = JSON.parse(row.status);
        } catch (e) {
          console.error(`[PostgreSQL] Renewal 수정 - status 파싱 오류:`, e);
          statusValue = null;
        }
      } else if (typeof row.status === 'object') {
        statusValue = row.status;
      }
    }
    
    return {
      id: row.id,
      center: row.center,
      trainer: row.trainer,
      month: row.month,
      member_names: row.member_names || [],
      expected_sessions: row.expected_sessions,
      actual_sessions: row.actual_sessions,
      status: statusValue,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  } catch (error) {
    console.error('[PostgreSQL] Renewal 수정 오류:', error);
    throw error;
  }
};

// Renewal 삭제
const deleteRenewal = async (id) => {
  try {
    const query = 'DELETE FROM renewals WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('Renewal을 찾을 수 없습니다.');
    }
    
    return { id: result.rows[0].id };
  } catch (error) {
    console.error('[PostgreSQL] Renewal 삭제 오류:', error);
    throw error;
  }
};

// Renewal ID로 조회
const getRenewalById = async (id) => {
  try {
    const query = `
      SELECT 
        id, center, trainer, month, member_names, expected_sessions, actual_sessions, status,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
      FROM renewals
      WHERE id = $1
    `;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      center: row.center,
      trainer: row.trainer,
      month: row.month,
      member_names: row.member_names || [],
      expected_sessions: row.expected_sessions,
      actual_sessions: row.actual_sessions,
      status: (() => {
        if (row.status === null || row.status === undefined) return null;
        if (typeof row.status === 'string') {
          try {
            return JSON.parse(row.status);
          } catch (e) {
            return null;
          }
        }
        return typeof row.status === 'object' ? row.status : null;
      })(),
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  } catch (error) {
    console.error('[PostgreSQL] Renewal 조회 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  await createRenewalsTable();
};

module.exports = {
  initializeDatabase,
  getRenewals,
  addRenewal,
  updateRenewal,
  deleteRenewal,
  getRenewalById
};
