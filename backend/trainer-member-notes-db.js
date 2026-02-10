const { Pool } = require('pg');
const { runMigration } = require('./migrations-manager');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const createTrainerMemberNotesTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'trainer_member_notes'
    `;
    const checkResult = await pool.query(checkQuery);

    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE trainer_member_notes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          trainer_username VARCHAR(50) NOT NULL,
          app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          content TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(trainer_username, app_user_id)
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      await createTrainerMemberNotesIndexes();
      console.log('[PostgreSQL] trainer_member_notes 테이블이 생성되었습니다.');
    } else {
      await runMigration(
        'add_indexes_to_trainer_member_notes_20260210',
        '트레이너-회원 노트 인덱스 추가',
        createTrainerMemberNotesIndexes
      );
    }
  } catch (error) {
    console.error('[PostgreSQL] trainer_member_notes 테이블 생성 오류:', error);
    throw error;
  }
};

const createTrainerMemberNotesIndexes = async () => {
  try {
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_trainer_member_notes_user
      ON trainer_member_notes(app_user_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_trainer_member_notes_trainer
      ON trainer_member_notes(trainer_username)
    `);
    console.log('[PostgreSQL] trainer_member_notes 인덱스가 생성되었습니다.');
  } catch (error) {
    console.error('[PostgreSQL] trainer_member_notes 인덱스 생성 오류:', error);
    throw error;
  }
};

const getNote = async (trainerUsername, appUserId) => {
  try {
    const query = `
      SELECT
        trainer_username,
        app_user_id,
        content,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
      FROM trainer_member_notes
      WHERE trainer_username = $1 AND app_user_id = $2
    `;
    const result = await pool.query(query, [trainerUsername, appUserId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] trainer_member_notes 조회 오류:', error);
    throw error;
  }
};

const upsertNote = async (trainerUsername, appUserId, content) => {
  try {
    const query = `
      INSERT INTO trainer_member_notes (
        trainer_username,
        app_user_id,
        content,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, NOW() AT TIME ZONE 'Asia/Seoul', NOW() AT TIME ZONE 'Asia/Seoul')
      ON CONFLICT (trainer_username, app_user_id)
      DO UPDATE SET
        content = EXCLUDED.content,
        updated_at = NOW() AT TIME ZONE 'Asia/Seoul'
      RETURNING
        trainer_username,
        app_user_id,
        content,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
    `;
    const result = await pool.query(query, [trainerUsername, appUserId, content]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] trainer_member_notes 저장 오류:', error);
    throw error;
  }
};

const initializeDatabase = async () => {
  await createTrainerMemberNotesTable();
};

module.exports = {
  initializeDatabase,
  getNote,
  upsertNote
};
