const { Pool } = require('pg');
const { runMigration } = require('./migrations-manager');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const createAnnouncementsTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'announcements'
    `;
    const checkResult = await pool.query(checkQuery);

    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE announcements (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          image_urls JSONB,
          created_by VARCHAR(50),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      await createAnnouncementsIndexes();
      console.log('[PostgreSQL] announcements 테이블이 생성되었습니다.');
    } else {
      await runMigration(
        'migrate_announcements_add_columns_20260208',
        'announcements 테이블 필드 보강',
        migrateAnnouncementsTable
      );
      await runMigration(
        'migrate_announcements_add_image_urls_20260209',
        'announcements 테이블 image_urls 컬럼 추가',
        migrateAnnouncementsImagesColumn
      );
    }
  } catch (error) {
    console.error('[PostgreSQL] announcements 테이블 생성 오류:', error);
    throw error;
  }
};

const migrateAnnouncementsTable = async () => {
  const columns = [
    { name: 'image_urls', type: 'JSONB' },
    { name: 'created_by', type: 'VARCHAR(50)' },
    { name: 'is_active', type: 'BOOLEAN DEFAULT true' },
    { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' }
  ];

  for (const column of columns) {
    const checkQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'announcements' AND column_name = $1
    `;
    const checkResult = await pool.query(checkQuery, [column.name]);
    if (checkResult.rows.length === 0) {
      await pool.query(`ALTER TABLE announcements ADD COLUMN ${column.name} ${column.type}`);
    }
  }
  await createAnnouncementsIndexes();
};

const migrateAnnouncementsImagesColumn = async () => {
  const checkQuery = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'announcements' AND column_name = 'image_urls'
  `;
  const checkResult = await pool.query(checkQuery);
  if (checkResult.rows.length === 0) {
    await pool.query(`ALTER TABLE announcements ADD COLUMN image_urls JSONB`);
  }
};

const createAnnouncementsIndexes = async () => {
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_announcements_created_at
    ON announcements(created_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_announcements_active
    ON announcements(is_active)
  `);
};

const initializeDatabase = async () => {
  await createAnnouncementsTable();
};

const addAnnouncement = async ({ title, content, createdBy = null, imageUrls = null }) => {
  const query = `
    INSERT INTO announcements (title, content, image_urls, created_by, is_active, created_at, updated_at)
    VALUES ($1, $2, $3, $4, true, NOW() AT TIME ZONE 'Asia/Seoul', NOW() AT TIME ZONE 'Asia/Seoul')
    RETURNING id, title, content, image_urls, created_by, is_active, created_at, updated_at
  `;
  const result = await pool.query(query, [title, content, imageUrls ? JSON.stringify(imageUrls) : null, createdBy]);
  return parseAnnouncementRow(result.rows[0]);
};

const getAnnouncements = async ({ includeInactive = false, limit = 200 } = {}) => {
  let query = `
    SELECT id, title, content, image_urls, created_by, is_active,
           to_char(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS.MS"+09:00"') as created_at,
           to_char(updated_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS.MS"+09:00"') as updated_at
    FROM announcements
  `;
  const params = [];
  if (!includeInactive) {
    query += ' WHERE is_active = true';
  }
  query += ' ORDER BY created_at DESC';
  if (limit) {
    query += ' LIMIT $1';
    params.push(limit);
  }
  const result = await pool.query(query, params);
  return result.rows.map(parseAnnouncementRow);
};

const getAnnouncementById = async (id) => {
  const query = `
    SELECT id, title, content, image_urls, created_by, is_active,
           to_char(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS.MS"+09:00"') as created_at,
           to_char(updated_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS.MS"+09:00"') as updated_at
    FROM announcements
    WHERE id = $1
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] ? parseAnnouncementRow(result.rows[0]) : null;
};

const updateAnnouncement = async (id, updates = {}) => {
  const fields = [];
  const values = [];
  let idx = 1;
  const allowed = ['title', 'content', 'image_urls', 'is_active'];
  allowed.forEach(key => {
    if (updates[key] === undefined) return;
    fields.push(`${key} = $${idx++}`);
    if (key === 'image_urls') {
      values.push(updates[key] ? JSON.stringify(updates[key]) : null);
    } else {
      values.push(updates[key]);
    }
  });
  if (fields.length === 0) return null;
  values.push(id);
  const query = `
    UPDATE announcements
    SET ${fields.join(', ')}, updated_at = NOW() AT TIME ZONE 'Asia/Seoul'
    WHERE id = $${idx}
    RETURNING id, title, content, image_urls, created_by, is_active,
      to_char(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS.MS"+09:00"') as created_at,
      to_char(updated_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS.MS"+09:00"') as updated_at
  `;
  const result = await pool.query(query, values);
  return result.rows[0] ? parseAnnouncementRow(result.rows[0]) : null;
};

const deactivateAnnouncement = async (id) => {
  const query = `
    UPDATE announcements
    SET is_active = false, updated_at = NOW() AT TIME ZONE 'Asia/Seoul'
    WHERE id = $1
    RETURNING id, is_active
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

module.exports = {
  initializeDatabase,
  addAnnouncement,
  updateAnnouncement,
  getAnnouncements,
  getAnnouncementById,
  deactivateAnnouncement
};

function parseAnnouncementRow(row) {
  if (!row) return row;
  const parsed = { ...row };
  if (parsed.image_urls) {
    parsed.image_urls = typeof parsed.image_urls === 'string'
      ? JSON.parse(parsed.image_urls)
      : parsed.image_urls;
  } else {
    parsed.image_urls = null;
  }
  return parsed;
}
