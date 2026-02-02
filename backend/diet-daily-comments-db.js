const { Pool } = require('pg');
const { runMigration } = require('./migrations-manager');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const createDietDailyCommentsTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'diet_daily_comments'
    `;
    const checkResult = await pool.query(checkQuery);

    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE diet_daily_comments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          diet_date DATE NOT NULL,
          commenter_type VARCHAR(20) NOT NULL,
          commenter_app_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
          commenter_username VARCHAR(50),
          commenter_name VARCHAR(100),
          comment TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");

      await createDietDailyCommentsIndexes();

      console.log('[PostgreSQL] diet_daily_comments 테이블이 생성되었습니다.');
    } else {
      await runMigration(
        'add_columns_to_diet_daily_comments_20260202',
        '식단 하루 코멘트 테이블 컬럼 및 인덱스 보강',
        migrateDietDailyCommentsTable
      );
    }
  } catch (error) {
    console.error('[PostgreSQL] 식단 하루 코멘트 테이블 생성 오류:', error);
    throw error;
  }
};

const createDietDailyCommentsIndexes = async () => {
  try {
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_diet_daily_comments_user_date
      ON diet_daily_comments(app_user_id, diet_date DESC, created_at DESC)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_diet_daily_comments_commenter
      ON diet_daily_comments(commenter_app_user_id)
    `);

    console.log('[PostgreSQL] diet_daily_comments 인덱스가 생성되었습니다.');
  } catch (error) {
    console.error('[PostgreSQL] 식단 하루 코멘트 인덱스 생성 오류:', error);
    throw error;
  }
};

const migrateDietDailyCommentsTable = async () => {
  try {
    const checkColumnsQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'diet_daily_comments'
    `;
    const columnsResult = await pool.query(checkColumnsQuery);
    const existingColumns = columnsResult.rows.map(row => row.column_name);

    const addColumnIfMissing = async (columnName, columnType) => {
      if (!existingColumns.includes(columnName)) {
        await pool.query(`ALTER TABLE diet_daily_comments ADD COLUMN ${columnName} ${columnType}`);
        console.log(`[PostgreSQL] diet_daily_comments 테이블에 ${columnName} 컬럼이 추가되었습니다.`);
      }
    };

    await addColumnIfMissing('commenter_type', "VARCHAR(20)");
    await addColumnIfMissing('commenter_app_user_id', "UUID REFERENCES app_users(id) ON DELETE SET NULL");
    await addColumnIfMissing('commenter_username', "VARCHAR(50)");
    await addColumnIfMissing('commenter_name', "VARCHAR(100)");

    await createDietDailyCommentsIndexes();
  } catch (error) {
    console.error('[PostgreSQL] 식단 하루 코멘트 테이블 마이그레이션 오류:', error);
    throw error;
  }
};

const addComment = async (commentData) => {
  try {
    const query = `
      INSERT INTO diet_daily_comments (
        app_user_id,
        diet_date,
        commenter_type,
        commenter_app_user_id,
        commenter_username,
        commenter_name,
        comment,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() AT TIME ZONE 'Asia/Seoul', NOW() AT TIME ZONE 'Asia/Seoul')
      RETURNING
        id,
        app_user_id,
        diet_date,
        commenter_type,
        commenter_app_user_id,
        commenter_username,
        commenter_name,
        comment,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
    `;
    const values = [
      commentData.app_user_id,
      commentData.diet_date,
      commentData.commenter_type,
      commentData.commenter_app_user_id || null,
      commentData.commenter_username || null,
      commentData.commenter_name || null,
      commentData.comment
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 식단 하루 코멘트 추가 오류:', error);
    throw error;
  }
};

const getComments = async (appUserId, filters = {}) => {
  try {
    let query = `
      SELECT
        id,
        app_user_id,
        diet_date,
        commenter_type,
        commenter_app_user_id,
        commenter_username,
        commenter_name,
        comment,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
      FROM diet_daily_comments
      WHERE app_user_id = $1
    `;
    const values = [appUserId];
    let paramIndex = 2;

    if (filters.startDate) {
      query += ` AND diet_date >= $${paramIndex}`;
      values.push(filters.startDate);
      paramIndex++;
    }
    if (filters.endDate) {
      query += ` AND diet_date <= $${paramIndex}`;
      values.push(filters.endDate);
      paramIndex++;
    }
    if (filters.date) {
      query += ` AND diet_date = $${paramIndex}`;
      values.push(filters.date);
      paramIndex++;
    }

    query += ` ORDER BY diet_date DESC, created_at DESC`;

    const result = await pool.query(query, values);
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 식단 하루 코멘트 조회 오류:', error);
    throw error;
  }
};

const getCommentById = async (commentId) => {
  try {
    const query = `
      SELECT
        id,
        app_user_id,
        diet_date,
        commenter_type,
        commenter_app_user_id,
        commenter_username,
        commenter_name,
        comment,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
      FROM diet_daily_comments
      WHERE id = $1
    `;
    const result = await pool.query(query, [commentId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] 식단 하루 코멘트 조회 오류:', error);
    throw error;
  }
};

const updateComment = async (commentId, updates) => {
  try {
    const query = `
      UPDATE diet_daily_comments
      SET comment = $1, updated_at = NOW() AT TIME ZONE 'Asia/Seoul'
      WHERE id = $2
      RETURNING
        id,
        app_user_id,
        diet_date,
        commenter_type,
        commenter_app_user_id,
        commenter_username,
        commenter_name,
        comment,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
    `;
    const result = await pool.query(query, [updates.comment, commentId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] 식단 하루 코멘트 수정 오류:', error);
    throw error;
  }
};

const deleteComment = async (commentId) => {
  try {
    const query = `
      DELETE FROM diet_daily_comments
      WHERE id = $1
      RETURNING
        id,
        app_user_id,
        diet_date,
        commenter_type,
        commenter_app_user_id,
        commenter_username,
        commenter_name,
        comment,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
    `;
    const result = await pool.query(query, [commentId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] 식단 하루 코멘트 삭제 오류:', error);
    throw error;
  }
};

const initializeDatabase = async () => {
  try {
    await createDietDailyCommentsTable();
    console.log('[PostgreSQL] diet_daily_comments 데이터베이스 초기화 완료');
  } catch (error) {
    console.error('[PostgreSQL] diet_daily_comments 데이터베이스 초기화 오류:', error);
  }
};

module.exports = {
  initializeDatabase,
  addComment,
  getComments,
  getCommentById,
  updateComment,
  deleteComment,
  pool
};
