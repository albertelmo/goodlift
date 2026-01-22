const { Pool } = require('pg');

// PostgreSQL 연결 풀 생성 (기존 DB 모듈 패턴과 동일)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 쿼리 로깅 설정
const ENABLE_QUERY_LOGGING = process.env.ENABLE_QUERY_LOGGING !== 'false';

// 상담기록 테이블 생성
const createConsultationRecordsTable = async () => {
  try {
    // 테이블 존재 여부 확인 (최초에는 생성, 이후에는 생성 과정 생략)
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'consultation_records'
    `;
    const checkResult = await pool.query(checkQuery);
    
    // 테이블이 없을 때만 생성
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE consultation_records (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          center VARCHAR(100) NOT NULL,
          trainer_username VARCHAR(100) NOT NULL,
          name VARCHAR(100) NOT NULL,
          phone VARCHAR(50) NOT NULL,
          gender VARCHAR(20),
          age_range VARCHAR(50),
          exercise_history TEXT,
          medical_history TEXT,
          preferred_time VARCHAR(100),
          visit_source VARCHAR(100),
          visit_reason VARCHAR(100),
          referrer VARCHAR(100),
          purpose VARCHAR(50),
          purpose_other VARCHAR(200),
          inbody TEXT,
          overhead_squat TEXT,
          slr_test TEXT,
          empty_can_test TEXT,
          rom TEXT,
          flexibility TEXT,
          static_posture TEXT,
          exercise_performed TEXT,
          summary TEXT,
          requirements TEXT
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // 인덱스 생성
      await createConsultationRecordsIndexes();
      
      console.log('[PostgreSQL] 상담기록 테이블이 생성되었습니다.');
    } else {
      console.log('[PostgreSQL] 상담기록 테이블이 이미 존재합니다.');
      // 기존 테이블에 컬럼 추가 (마이그레이션)
      await migrateConsultationRecordsTable();
    }
  } catch (error) {
    console.error('[PostgreSQL] 상담기록 테이블 생성 오류:', error);
  }
};

// 기존 테이블에 컬럼 추가 (마이그레이션)
const migrateConsultationRecordsTable = async () => {
  try {
    // 모든 컬럼 목록 확인
    const checkColumnQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'consultation_records'
    `;
    const columnResult = await pool.query(checkColumnQuery);
    
    const existingColumns = columnResult.rows.map(row => row.column_name);
    
    // 필요한 컬럼 목록
    const requiredColumns = {
      'id': 'UUID PRIMARY KEY DEFAULT gen_random_uuid()',
      'created_at': 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
      'updated_at': 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
      'center': 'VARCHAR(100) NOT NULL',
      'trainer_username': 'VARCHAR(100) NOT NULL',
      'name': 'VARCHAR(100) NOT NULL',
      'phone': 'VARCHAR(50) NOT NULL',
      'gender': 'VARCHAR(20)',
      'age_range': 'VARCHAR(50)',
      'exercise_history': 'TEXT',
      'medical_history': 'TEXT',
      'preferred_time': 'VARCHAR(100)',
      'visit_source': 'VARCHAR(100)',
      'visit_reason': 'VARCHAR(100)',
      'referrer': 'VARCHAR(100)',
      'purpose': 'VARCHAR(50)',
      'purpose_other': 'VARCHAR(200)',
      'inbody': 'TEXT',
      'overhead_squat': 'TEXT',
      'slr_test': 'TEXT',
      'empty_can_test': 'TEXT',
      'rom': 'TEXT',
      'flexibility': 'TEXT',
      'static_posture': 'TEXT',
      'exercise_performed': 'TEXT',
      'summary': 'TEXT',
      'requirements': 'TEXT'
    };
    
    // 누락된 컬럼 추가 (id는 제외 - 이미 존재해야 함)
    for (const [columnName, columnType] of Object.entries(requiredColumns)) {
      if (columnName === 'id') continue; // PK는 건너뛰기
      
      // created_at과 updated_at은 특별 처리
      if (columnName === 'created_at' || columnName === 'updated_at') {
        if (!existingColumns.includes(columnName)) {
          await pool.query(`ALTER TABLE consultation_records ADD COLUMN ${columnName} ${columnType}`);
          console.log(`[PostgreSQL] 상담기록 테이블에 ${columnName} 컬럼이 추가되었습니다.`);
        }
        continue;
      }
      
      if (!existingColumns.includes(columnName)) {
        // NOT NULL 제약조건이 있는 컬럼은 기본값 설정
        let alterQuery = `ALTER TABLE consultation_records ADD COLUMN ${columnName} ${columnType}`;
        
        if (columnType.includes('NOT NULL') && !columnType.includes('DEFAULT')) {
          // NOT NULL이지만 DEFAULT가 없는 경우, 기본값 추가
          if (columnName === 'center' || columnName === 'trainer_username' || columnName === 'name' || columnName === 'phone') {
            // 필수 필드는 빈 문자열로 기본값 설정 (나중에 데이터 입력 시 채워짐)
            alterQuery = `ALTER TABLE consultation_records ADD COLUMN ${columnName} ${columnType.replace('NOT NULL', '')} DEFAULT ''`;
            await pool.query(alterQuery);
            // 기본값 제거하고 NOT NULL 추가
            await pool.query(`ALTER TABLE consultation_records ALTER COLUMN ${columnName} DROP DEFAULT`);
            await pool.query(`ALTER TABLE consultation_records ALTER COLUMN ${columnName} SET NOT NULL`);
          } else {
            alterQuery = `ALTER TABLE consultation_records ADD COLUMN ${columnName} ${columnType}`;
            await pool.query(alterQuery);
          }
        } else {
          await pool.query(alterQuery);
        }
        
        console.log(`[PostgreSQL] 상담기록 테이블에 ${columnName} 컬럼이 추가되었습니다.`);
      }
    }
    
    // 인덱스 확인 및 생성
    await createConsultationRecordsIndexes();
  } catch (error) {
    console.error('[PostgreSQL] 상담기록 테이블 마이그레이션 오류:', error);
  }
};

// 인덱스 생성
const createConsultationRecordsIndexes = async () => {
  try {
    // created_at 인덱스 확인 및 생성
    const checkCreatedAtIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND tablename = 'consultation_records' AND indexname = 'idx_consultation_records_created_at'
    `;
    const checkCreatedAtIndexResult = await pool.query(checkCreatedAtIndexQuery);
    
    if (checkCreatedAtIndexResult.rows.length === 0) {
      await pool.query(`CREATE INDEX idx_consultation_records_created_at ON consultation_records(created_at)`);
      console.log('[PostgreSQL] idx_consultation_records_created_at 인덱스가 생성되었습니다.');
    }
    
    // trainer_username 인덱스 확인 및 생성
    const checkTrainerIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND tablename = 'consultation_records' AND indexname = 'idx_consultation_records_trainer'
    `;
    const checkTrainerIndexResult = await pool.query(checkTrainerIndexQuery);
    
    if (checkTrainerIndexResult.rows.length === 0) {
      await pool.query(`CREATE INDEX idx_consultation_records_trainer ON consultation_records(trainer_username)`);
      console.log('[PostgreSQL] idx_consultation_records_trainer 인덱스가 생성되었습니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] 상담기록 인덱스 생성 오류:', error);
  }
};

// 상담기록 추가
const addConsultationRecord = async (recordData) => {
  try {
    const query = `
      INSERT INTO consultation_records (
        center, trainer_username, name, phone, gender, age_range, exercise_history,
        medical_history, preferred_time, visit_source, visit_reason, referrer, purpose,
        purpose_other, inbody, overhead_squat, slr_test, empty_can_test,
        rom, flexibility, static_posture, exercise_performed, summary, requirements,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, NOW() AT TIME ZONE 'Asia/Seoul', NOW() AT TIME ZONE 'Asia/Seoul')
      RETURNING 
        id, center, trainer_username, name, phone, gender, age_range, exercise_history,
        medical_history, preferred_time, visit_source, visit_reason, referrer, purpose,
        purpose_other, inbody, overhead_squat, slr_test, empty_can_test,
        rom, flexibility, static_posture, exercise_performed, summary, requirements,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
    `;
    
    const values = [
      recordData.center,
      recordData.trainer_username,
      recordData.name,
      recordData.phone,
      recordData.gender || null,
      recordData.age_range || null,
      recordData.exercise_history || null,
      recordData.medical_history || null,
      recordData.preferred_time || null,
      recordData.visit_source || null,
      recordData.visit_reason || null,
      recordData.referrer || null,
      recordData.purpose || null,
      recordData.purpose_other || null,
      recordData.inbody || null,
      recordData.overhead_squat || null,
      recordData.slr_test || null,
      recordData.empty_can_test || null,
      recordData.rom || null,
      recordData.flexibility || null,
      recordData.static_posture || null,
      recordData.exercise_performed || null,
      recordData.summary || null,
      recordData.requirements || null
    ];
    
    const result = await pool.query(query, values);
    const row = result.rows[0];
    
    if (!row) return null;
    
    // 타임스탬프를 ISO 문자열로 변환 (AT TIME ZONE으로 이미 한국 시간으로 변환됨)
    if (row.created_at) {
      try {
        const date = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          row.created_at = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+09:00`;
        }
      } catch (error) {
        console.error('[PostgreSQL] created_at 변환 오류:', error, row.created_at);
      }
    }
    if (row.updated_at) {
      try {
        const date = row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          row.updated_at = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+09:00`;
        }
      } catch (error) {
        console.error('[PostgreSQL] updated_at 변환 오류:', error, row.updated_at);
      }
    }
    
    return row;
  } catch (error) {
    console.error('[PostgreSQL] 상담기록 추가 오류:', error);
    throw error;
  }
};

// 상담기록 목록 조회
const getConsultationRecords = async (filters = {}) => {
  try {
    let query = `
      SELECT 
        id, center, trainer_username, name, phone, gender, age_range, exercise_history,
        medical_history, preferred_time, visit_source, visit_reason, referrer, purpose,
        purpose_other, inbody, overhead_squat, slr_test, empty_can_test,
        rom, flexibility, static_posture, exercise_performed, summary, requirements,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
      FROM consultation_records
      WHERE 1=1
    `;
    const values = [];
    let paramIndex = 1;
    
    if (filters.center && filters.center.trim() !== '') {
      query += ` AND TRIM(center) = TRIM($${paramIndex})`;
      values.push(filters.center.trim());
      paramIndex++;
    }
    
    if (filters.trainer && filters.trainer.trim() !== '') {
      query += ` AND trainer_username = $${paramIndex}`;
      values.push(filters.trainer.trim());
      paramIndex++;
    }
    
    if (filters.startDate && filters.startDate.trim() !== '') {
      query += ` AND created_at >= $${paramIndex}::date`;
      values.push(filters.startDate.trim());
      paramIndex++;
    }
    
    if (filters.endDate && filters.endDate.trim() !== '') {
      // 종료일은 해당 날짜의 23:59:59까지 포함
      query += ` AND created_at <= ($${paramIndex}::date + INTERVAL '1 day' - INTERVAL '1 second')`;
      values.push(filters.endDate.trim());
      paramIndex++;
    }
    
    query += ` ORDER BY created_at DESC`;
    
    const result = await pool.query(query, values);
    
    // 결과 정규화: 타임스탬프를 ISO 문자열로 변환 (AT TIME ZONE으로 이미 한국 시간으로 변환됨)
    const normalizedRows = result.rows.map(row => {
      if (row.created_at) {
        try {
          const date = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
          if (!isNaN(date.getTime())) {
            // SQL에서 이미 한국 시간으로 변환되었으므로, 그대로 ISO 문자열로 변환 (한국 시간대 오프셋 포함)
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            row.created_at = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+09:00`;
          }
        } catch (error) {
          console.error('[PostgreSQL] created_at 변환 오류:', error, row.created_at);
        }
      }
      if (row.updated_at) {
        try {
          const date = row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            row.updated_at = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+09:00`;
          }
        } catch (error) {
          console.error('[PostgreSQL] updated_at 변환 오류:', error, row.updated_at);
        }
      }
      return row;
    });
    
    return normalizedRows;
  } catch (error) {
    console.error('[PostgreSQL] 상담기록 목록 조회 오류:', error);
    throw error;
  }
};

// 상담기록 단건 조회
const getConsultationRecordById = async (id) => {
  try {
    const query = `
      SELECT 
        id, center, trainer_username, name, phone, gender, age_range, exercise_history,
        medical_history, preferred_time, visit_source, visit_reason, referrer, purpose,
        purpose_other, inbody, overhead_squat, slr_test, empty_can_test,
        rom, flexibility, static_posture, exercise_performed, summary, requirements,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
      FROM consultation_records
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    const row = result.rows[0];
    
    if (!row) return null;
    
    // 타임스탬프를 ISO 문자열로 변환 (AT TIME ZONE으로 이미 한국 시간으로 변환됨)
    if (row.created_at) {
      try {
        const date = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          row.created_at = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+09:00`;
        }
      } catch (error) {
        console.error('[PostgreSQL] created_at 변환 오류:', error, row.created_at);
      }
    }
    if (row.updated_at) {
      try {
        const date = row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          row.updated_at = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+09:00`;
        }
      } catch (error) {
        console.error('[PostgreSQL] updated_at 변환 오류:', error, row.updated_at);
      }
    }
    
    return row;
  } catch (error) {
    console.error('[PostgreSQL] 상담기록 단건 조회 오류:', error);
    throw error;
  }
};

// 상담기록 수정
const updateConsultationRecord = async (id, updates) => {
  try {
    const allowedFields = [
      'center', 'trainer_username', 'name', 'phone', 'gender', 'age_range',
      'exercise_history', 'medical_history', 'preferred_time', 'visit_source', 'visit_reason',
      'referrer', 'purpose', 'purpose_other', 'inbody', 'overhead_squat',
      'slr_test', 'empty_can_test', 'rom', 'flexibility', 'static_posture',
      'exercise_performed', 'summary', 'requirements'
    ];
    
    const updateFields = [];
    const values = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(value !== undefined ? value : null);
        paramIndex++;
      }
    }
    
    if (updateFields.length === 0) {
      return null;
    }
    
    // updated_at을 한국 시간으로 업데이트
    updateFields.push(`updated_at = NOW() AT TIME ZONE 'Asia/Seoul'`);
    
    values.push(id);
    const query = `
      UPDATE consultation_records
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING 
        id, center, trainer_username, name, phone, gender, age_range, exercise_history,
        medical_history, preferred_time, visit_source, visit_reason, referrer, purpose,
        purpose_other, inbody, overhead_squat, slr_test, empty_can_test,
        rom, flexibility, static_posture, exercise_performed, summary, requirements,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
    `;
    
    const result = await pool.query(query, values);
    const row = result.rows[0];
    
    if (!row) return null;
    
    // 타임스탬프를 ISO 문자열로 변환 (AT TIME ZONE으로 이미 한국 시간으로 변환됨)
    if (row.created_at) {
      try {
        const date = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          row.created_at = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+09:00`;
        }
      } catch (error) {
        console.error('[PostgreSQL] created_at 변환 오류:', error, row.created_at);
      }
    }
    if (row.updated_at) {
      try {
        const date = row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          row.updated_at = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+09:00`;
        }
      } catch (error) {
        console.error('[PostgreSQL] updated_at 변환 오류:', error, row.updated_at);
      }
    }
    
    return row;
  } catch (error) {
    console.error('[PostgreSQL] 상담기록 수정 오류:', error);
    throw error;
  }
};

// 상담기록 삭제
const deleteConsultationRecord = async (id) => {
  try {
    const query = `
      DELETE FROM consultation_records
      WHERE id = $1
      RETURNING id
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] 상담기록 삭제 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  try {
    await createConsultationRecordsTable();
    console.log('[PostgreSQL] 상담기록 데이터베이스 초기화 완료');
  } catch (error) {
    console.error('[PostgreSQL] 상담기록 데이터베이스 초기화 오류:', error);
  }
};

module.exports = {
  initializeDatabase,
  createConsultationRecordsTable,
  migrateConsultationRecordsTable,
  addConsultationRecord,
  getConsultationRecords,
  getConsultationRecordById,
  updateConsultationRecord,
  deleteConsultationRecord
};
