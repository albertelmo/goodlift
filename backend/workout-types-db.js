const { Pool } = require('pg');

// PostgreSQL 연결 풀 생성 (기존 DB 모듈 패턴과 동일)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 분류 테이블 생성 (1, 2, 3, 4)
const createCategoryTable = async (categoryNumber) => {
  try {
    const tableName = `workout_categories_${categoryNumber}`;
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = $1
    `;
    const checkResult = await pool.query(checkQuery, [tableName]);
    
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE ${tableName} (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(100) UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // 인덱스 생성
      await pool.query(`
        CREATE INDEX idx_${tableName}_name ON ${tableName}(name)
      `);
      
      console.log(`[PostgreSQL] ${tableName} 테이블이 생성되었습니다.`);
    } else {
      console.log(`[PostgreSQL] ${tableName} 테이블이 이미 존재합니다.`);
    }
  } catch (error) {
    console.error(`[PostgreSQL] ${tableName} 테이블 생성 오류:`, error);
    throw error;
  }
};

// 모든 분류 테이블 생성
const createAllCategoryTables = async () => {
  for (let i = 1; i <= 4; i++) {
    await createCategoryTable(i);
  }
};

// 운동종류 테이블 생성
const createWorkoutTypesTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'workout_types'
    `;
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE workout_types (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(100) UNIQUE NOT NULL,
          type VARCHAR(20) DEFAULT '세트' NOT NULL,
          category_1_id UUID REFERENCES workout_categories_1(id) ON DELETE SET NULL,
          category_2_id UUID REFERENCES workout_categories_2(id) ON DELETE SET NULL,
          category_3_id UUID REFERENCES workout_categories_3(id) ON DELETE SET NULL,
          category_4_id UUID REFERENCES workout_categories_4(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // 인덱스 생성
      await createWorkoutTypesIndexes();
      
      console.log('[PostgreSQL] workout_types 테이블이 생성되었습니다.');
    } else {
      console.log('[PostgreSQL] workout_types 테이블이 이미 존재합니다.');
      // 기존 테이블에 컬럼 추가 (마이그레이션)
      await migrateWorkoutTypesTable();
    }
  } catch (error) {
    console.error('[PostgreSQL] workout_types 테이블 생성 오류:', error);
    throw error;
  }
};

// 운동종류 테이블 인덱스 생성
const createWorkoutTypesIndexes = async () => {
  try {
    // name 인덱스 확인 및 생성
    const checkNameIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND tablename = 'workout_types' AND indexname = 'idx_workout_types_name'
    `;
    const checkNameIndexResult = await pool.query(checkNameIndexQuery);
    
    if (checkNameIndexResult.rows.length === 0) {
      await pool.query(`CREATE INDEX idx_workout_types_name ON workout_types(name)`);
      console.log('[PostgreSQL] idx_workout_types_name 인덱스가 생성되었습니다.');
    }
    
    // category 인덱스들 생성
    for (let i = 1; i <= 4; i++) {
      const indexName = `idx_workout_types_category_${i}`;
      const checkCategoryIndexQuery = `
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public' AND tablename = 'workout_types' AND indexname = $1
      `;
      const checkCategoryIndexResult = await pool.query(checkCategoryIndexQuery, [indexName]);
      
      if (checkCategoryIndexResult.rows.length === 0) {
        await pool.query(`CREATE INDEX ${indexName} ON workout_types(category_${i}_id)`);
        console.log(`[PostgreSQL] ${indexName} 인덱스가 생성되었습니다.`);
      }
    }
  } catch (error) {
    console.error('[PostgreSQL] 운동종류 인덱스 생성 오류:', error);
    throw error;
  }
};

// 운동종류 테이블 마이그레이션
const migrateWorkoutTypesTable = async () => {
  try {
    // type 컬럼 확인 및 추가
    const checkTypeColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'workout_types' AND column_name = 'type'
    `;
    const checkTypeColumnResult = await pool.query(checkTypeColumnQuery);
    
    if (checkTypeColumnResult.rows.length === 0) {
      await pool.query(`
        ALTER TABLE workout_types 
        ADD COLUMN type VARCHAR(20) DEFAULT '세트' NOT NULL
      `);
      console.log('[PostgreSQL] type 컬럼이 추가되었습니다.');
    }
    
    // category 컬럼들 확인 및 추가
    for (let i = 1; i <= 4; i++) {
      const columnName = `category_${i}_id`;
      const checkColumnQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'workout_types' AND column_name = $1
      `;
      const checkColumnResult = await pool.query(checkColumnQuery, [columnName]);
      
      if (checkColumnResult.rows.length === 0) {
        const categoryTableName = `workout_categories_${i}`;
        await pool.query(`
          ALTER TABLE workout_types 
          ADD COLUMN ${columnName} UUID REFERENCES ${categoryTableName}(id) ON DELETE SET NULL
        `);
        console.log(`[PostgreSQL] ${columnName} 컬럼이 추가되었습니다.`);
      }
    }
    
    // 인덱스 생성 (없으면 생성)
    await createWorkoutTypesIndexes();
  } catch (error) {
    console.error('[PostgreSQL] 운동종류 테이블 마이그레이션 오류:', error);
    throw error;
  }
};

// ========== 분류 CRUD 함수 ==========

// 분류 목록 조회
const getCategories = async (categoryNumber) => {
  try {
    const tableName = `workout_categories_${categoryNumber}`;
    const query = `
      SELECT id, name, created_at, updated_at
      FROM ${tableName}
      ORDER BY name
    `;
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error(`[PostgreSQL] 분류 ${categoryNumber} 조회 오류:`, error);
    throw error;
  }
};

// 분류 추가
const addCategory = async (categoryNumber, name) => {
  try {
    const tableName = `workout_categories_${categoryNumber}`;
    const query = `
      INSERT INTO ${tableName} (name)
      VALUES ($1)
      RETURNING id, name, created_at, updated_at
    `;
    const result = await pool.query(query, [name]);
    return result.rows[0];
  } catch (error) {
    console.error(`[PostgreSQL] 분류 ${categoryNumber} 추가 오류:`, error);
    throw error;
  }
};

// 분류 수정
const updateCategory = async (categoryNumber, id, name) => {
  try {
    const tableName = `workout_categories_${categoryNumber}`;
    const query = `
      UPDATE ${tableName}
      SET name = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, name, created_at, updated_at
    `;
    const result = await pool.query(query, [name, id]);
    if (result.rows.length === 0) {
      throw new Error('분류를 찾을 수 없습니다.');
    }
    return result.rows[0];
  } catch (error) {
    console.error(`[PostgreSQL] 분류 ${categoryNumber} 수정 오류:`, error);
    throw error;
  }
};

// 분류 삭제
const deleteCategory = async (categoryNumber, id) => {
  try {
    const tableName = `workout_categories_${categoryNumber}`;
    const query = `
      DELETE FROM ${tableName}
      WHERE id = $1
      RETURNING id, name
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) {
      throw new Error('분류를 찾을 수 없습니다.');
    }
    return result.rows[0];
  } catch (error) {
    console.error(`[PostgreSQL] 분류 ${categoryNumber} 삭제 오류:`, error);
    throw error;
  }
};

// ========== 운동종류 CRUD 함수 ==========

// 운동종류 목록 조회
const getWorkoutTypes = async (filters = {}) => {
  try {
    let query = `
      SELECT 
        wt.id,
        wt.name,
        wt.type,
        wt.category_1_id,
        c1.name as category_1_name,
        wt.category_2_id,
        c2.name as category_2_name,
        wt.category_3_id,
        c3.name as category_3_name,
        wt.category_4_id,
        c4.name as category_4_name,
        wt.created_at,
        wt.updated_at
      FROM workout_types wt
      LEFT JOIN workout_categories_1 c1 ON wt.category_1_id = c1.id
      LEFT JOIN workout_categories_2 c2 ON wt.category_2_id = c2.id
      LEFT JOIN workout_categories_3 c3 ON wt.category_3_id = c3.id
      LEFT JOIN workout_categories_4 c4 ON wt.category_4_id = c4.id
    `;
    const params = [];
    let paramIndex = 1;
    const conditions = [];

    // 필터 조건 추가
    if (filters.category_1_id) {
      conditions.push(`wt.category_1_id = $${paramIndex++}`);
      params.push(filters.category_1_id);
    }
    if (filters.category_2_id) {
      conditions.push(`wt.category_2_id = $${paramIndex++}`);
      params.push(filters.category_2_id);
    }
    if (filters.category_3_id) {
      conditions.push(`wt.category_3_id = $${paramIndex++}`);
      params.push(filters.category_3_id);
    }
    if (filters.category_4_id) {
      conditions.push(`wt.category_4_id = $${paramIndex++}`);
      params.push(filters.category_4_id);
    }
    if (filters.name) {
      conditions.push(`wt.name ILIKE $${paramIndex++}`);
      params.push(`%${filters.name}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY wt.name';
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 운동종류 조회 오류:', error);
    throw error;
  }
};

// 운동종류 단일 조회
const getWorkoutTypeById = async (id) => {
  try {
    const query = `
      SELECT 
        wt.id,
        wt.name,
        wt.type,
        wt.category_1_id,
        c1.name as category_1_name,
        wt.category_2_id,
        c2.name as category_2_name,
        wt.category_3_id,
        c3.name as category_3_name,
        wt.category_4_id,
        c4.name as category_4_name,
        wt.created_at,
        wt.updated_at
      FROM workout_types wt
      LEFT JOIN workout_categories_1 c1 ON wt.category_1_id = c1.id
      LEFT JOIN workout_categories_2 c2 ON wt.category_2_id = c2.id
      LEFT JOIN workout_categories_3 c3 ON wt.category_3_id = c3.id
      LEFT JOIN workout_categories_4 c4 ON wt.category_4_id = c4.id
      WHERE wt.id = $1
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) {
      return null;
    }
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 운동종류 단일 조회 오류:', error);
    throw error;
  }
};

// 운동종류 추가
const addWorkoutType = async (workoutTypeData) => {
  try {
    const query = `
      INSERT INTO workout_types (name, type, category_1_id, category_2_id, category_3_id, category_4_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, type, category_1_id, category_2_id, category_3_id, category_4_id, created_at, updated_at
    `;
    const values = [
      workoutTypeData.name,
      workoutTypeData.type || '세트',
      workoutTypeData.category_1_id || null,
      workoutTypeData.category_2_id || null,
      workoutTypeData.category_3_id || null,
      workoutTypeData.category_4_id || null
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 운동종류 추가 오류:', error);
    throw error;
  }
};

// 운동종류 수정
const updateWorkoutType = async (id, updates) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.type !== undefined) {
      fields.push(`type = $${paramIndex++}`);
      values.push(updates.type);
    }
    if (updates.category_1_id !== undefined) {
      fields.push(`category_1_id = $${paramIndex++}`);
      values.push(updates.category_1_id || null);
    }
    if (updates.category_2_id !== undefined) {
      fields.push(`category_2_id = $${paramIndex++}`);
      values.push(updates.category_2_id || null);
    }
    if (updates.category_3_id !== undefined) {
      fields.push(`category_3_id = $${paramIndex++}`);
      values.push(updates.category_3_id || null);
    }
    if (updates.category_4_id !== undefined) {
      fields.push(`category_4_id = $${paramIndex++}`);
      values.push(updates.category_4_id || null);
    }

    if (fields.length === 0) {
      throw new Error('수정할 필드가 없습니다.');
    }

    // updated_at 자동 업데이트
    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(id);
    const query = `
      UPDATE workout_types 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, type, category_1_id, category_2_id, category_3_id, category_4_id, created_at, updated_at
    `;
    
    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      throw new Error('운동종류를 찾을 수 없습니다.');
    }
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 운동종류 수정 오류:', error);
    throw error;
  }
};

// 운동종류 삭제
const deleteWorkoutType = async (id) => {
  try {
    const query = `
      DELETE FROM workout_types 
      WHERE id = $1
      RETURNING id, name
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) {
      throw new Error('운동종류를 찾을 수 없습니다.');
    }
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 운동종류 삭제 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  try {
    // 분류 테이블들을 먼저 생성 (외래키 참조를 위해)
    await createAllCategoryTables();
    // 운동종류 테이블 생성
    await createWorkoutTypesTable();
    console.log('[PostgreSQL] 운동종류 데이터베이스 초기화 완료');
  } catch (error) {
    console.error('[PostgreSQL] 운동종류 데이터베이스 초기화 오류:', error);
    throw error;
  }
};

module.exports = {
  initializeDatabase,
  // 분류 함수들
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  // 운동종류 함수들
  getWorkoutTypes,
  getWorkoutTypeById,
  addWorkoutType,
  updateWorkoutType,
  deleteWorkoutType,
  pool
};
