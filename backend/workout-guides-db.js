const { Pool } = require('pg');
const { runMigration } = require('./migrations-manager');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrateWorkoutGuidesTable = async () => {
  await pool.query(`
    ALTER TABLE workout_guides
    ADD COLUMN IF NOT EXISTS external_link TEXT
  `);
};

const createWorkoutGuidesTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'workout_guides'
    `;
    const checkResult = await pool.query(checkQuery);
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE workout_guides (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workout_type_id UUID UNIQUE NOT NULL REFERENCES workout_types(id) ON DELETE CASCADE,
          title TEXT,
          description TEXT,
          video_url TEXT,
          external_link TEXT,
          video_filename TEXT,
          video_size BIGINT,
          video_mime TEXT,
          video_uploaded_at TIMESTAMP,
          video_uploaded_by TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      console.log('[PostgreSQL] workout_guides 테이블이 생성되었습니다.');
    } else {
      await runMigration(
        'migrate_workout_guides_20260207_external_link',
        '운동 가이드 외부 링크 컬럼 추가',
        migrateWorkoutGuidesTable
      );
    }
  } catch (error) {
    console.error('[PostgreSQL] workout_guides 테이블 생성 오류:', error);
    throw error;
  }
};

const initializeDatabase = async () => {
  try {
    await createWorkoutGuidesTable();
    console.log('[PostgreSQL] workout_guides 데이터베이스 초기화 완료');
  } catch (error) {
    console.error('[PostgreSQL] workout_guides 초기화 오류:', error);
  }
};

const getGuideByWorkoutTypeId = async (workoutTypeId) => {
  try {
    const query = `
      SELECT *
      FROM workout_guides
      WHERE workout_type_id = $1
    `;
    const result = await pool.query(query, [workoutTypeId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] 운동 가이드 조회 오류:', error);
    throw error;
  }
};

const getGuidesByWorkoutTypeIds = async (workoutTypeIds = []) => {
  try {
    if (!Array.isArray(workoutTypeIds) || workoutTypeIds.length === 0) {
      return [];
    }
    const query = `
      SELECT *
      FROM workout_guides
      WHERE workout_type_id = ANY($1::uuid[])
    `;
    const result = await pool.query(query, [workoutTypeIds]);
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 운동 가이드 목록 조회 오류:', error);
    throw error;
  }
};

const upsertGuide = async (workoutTypeId, updates = {}) => {
  try {
    const {
      title = null,
      description = null,
      external_link = null,
      is_active = true
    } = updates;
    const query = `
      INSERT INTO workout_guides (workout_type_id, title, description, external_link, is_active)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (workout_type_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        external_link = EXCLUDED.external_link,
        is_active = EXCLUDED.is_active,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const result = await pool.query(query, [workoutTypeId, title, description, external_link, is_active]);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 운동 가이드 저장 오류:', error);
    throw error;
  }
};

const updateGuide = async (workoutTypeId, updates = {}) => {
  try {
    const fields = [];
    const values = [];
    let idx = 1;
    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = $${idx++}`);
      values.push(value);
    });
    if (fields.length === 0) {
      return await getGuideByWorkoutTypeId(workoutTypeId);
    }
    values.push(workoutTypeId);
    const query = `
      UPDATE workout_guides
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE workout_type_id = $${idx}
      RETURNING *
    `;
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] 운동 가이드 수정 오류:', error);
    throw error;
  }
};

module.exports = {
  initializeDatabase,
  getGuideByWorkoutTypeId,
  getGuidesByWorkoutTypeIds,
  upsertGuide,
  updateGuide,
  pool
};
