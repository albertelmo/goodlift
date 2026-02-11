const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const createWebCentersTable = async () => {
  const checkQuery = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'web_center_profiles'
  `;
  const checkResult = await pool.query(checkQuery);
  if (checkResult.rows.length === 0) {
    const createQuery = `
      CREATE TABLE web_center_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        center_name TEXT UNIQUE NOT NULL,
        title TEXT,
        subtitle TEXT,
        description TEXT,
        image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await pool.query(createQuery);
    await pool.query("SET client_encoding TO 'UTF8'");
    console.log('[PostgreSQL] web_center_profiles 테이블이 생성되었습니다.');
  }
};

const initializeDatabase = async () => {
  try {
    await createWebCentersTable();
  } catch (error) {
    console.error('[PostgreSQL] web_center_profiles 테이블 초기화 오류:', error);
  }
};

const listCenterProfiles = async () => {
  const query = `
    SELECT center_name, title, subtitle, description, image_urls, updated_at
    FROM web_center_profiles
    ORDER BY center_name ASC
  `;
  const result = await pool.query(query);
  return result.rows.map(row => ({
    center_name: row.center_name,
    title: row.title || '',
    subtitle: row.subtitle || '',
    description: row.description || '',
    image_urls: Array.isArray(row.image_urls) ? row.image_urls : [],
    updated_at: row.updated_at
  }));
};

const getCenterProfile = async (centerName) => {
  if (!centerName) return null;
  const query = `
    SELECT center_name, title, subtitle, description, image_urls, updated_at
    FROM web_center_profiles
    WHERE center_name = $1
    LIMIT 1
  `;
  const result = await pool.query(query, [centerName]);
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    center_name: row.center_name,
    title: row.title || '',
    subtitle: row.subtitle || '',
    description: row.description || '',
    image_urls: Array.isArray(row.image_urls) ? row.image_urls : [],
    updated_at: row.updated_at
  };
};

const upsertCenterProfile = async (centerName, { title, subtitle, description, image_urls } = {}) => {
  if (!centerName) return null;
  const query = `
    INSERT INTO web_center_profiles (center_name, title, subtitle, description, image_urls)
    VALUES ($1, $2, $3, $4, $5::jsonb)
    ON CONFLICT (center_name)
    DO UPDATE SET
      title = EXCLUDED.title,
      subtitle = EXCLUDED.subtitle,
      description = EXCLUDED.description,
      image_urls = EXCLUDED.image_urls,
      updated_at = CURRENT_TIMESTAMP
    RETURNING center_name, title, subtitle, description, image_urls, updated_at
  `;
  const values = [
    centerName,
    title || '',
    subtitle || '',
    description || '',
    JSON.stringify(Array.isArray(image_urls) ? image_urls : [])
  ];
  const result = await pool.query(query, values);
  const row = result.rows[0];
  return {
    center_name: row.center_name,
    title: row.title || '',
    subtitle: row.subtitle || '',
    description: row.description || '',
    image_urls: Array.isArray(row.image_urls) ? row.image_urls : [],
    updated_at: row.updated_at
  };
};

module.exports = {
  initializeDatabase,
  listCenterProfiles,
  getCenterProfile,
  upsertCenterProfile
};
