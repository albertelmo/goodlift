const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const DEFAULT_PAGES = [
  {
    slug: 'center',
    title: '센터소개',
    content: {
      title: '센터소개',
      subtitle: '운동을 더 즐겁고 꾸준하게',
      description: '우리 센터는 체계적인 프로그램과 따뜻한 코칭으로 회원님의 목표 달성을 돕습니다.',
      highlights: ['1:1 맞춤 코칭', '최신 장비', '체계적인 루틴 관리'],
      background_images: []
    }
  },
  {
    slug: 'service',
    title: '서비스',
    content: {
      title: '서비스',
      intro: '운동 목적에 맞는 다양한 프로그램을 제공합니다.',
      items: [
        { title: 'PT 프로그램', description: '목표에 맞춘 1:1 맞춤 트레이닝' },
        { title: '그룹 클래스', description: '즐겁게 땀 흘릴 수 있는 소규모 클래스' }
      ],
      background_images: []
    }
  },
  {
    slug: 'review',
    title: '리뷰',
    content: {
      title: '리뷰',
      items: [
        { name: '회원 A', content: '코치님 피드백이 정말 좋아요!', rating: 5, date: '2026-02-01' },
        { name: '회원 B', content: '센터 분위기가 깔끔하고 친절합니다.', rating: 5, date: '2026-02-03' }
      ],
      background_images: []
    }
  }
];

const createWebPagesTable = async () => {
  const checkQuery = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'web_pages'
  `;
  const checkResult = await pool.query(checkQuery);
  if (checkResult.rows.length === 0) {
    const createQuery = `
      CREATE TABLE web_pages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(50) UNIQUE NOT NULL,
        title TEXT NOT NULL,
        content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        is_published BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await pool.query(createQuery);
    await pool.query("SET client_encoding TO 'UTF8'");
    console.log('[PostgreSQL] web_pages 테이블이 생성되었습니다.');
  }
};

const ensureDefaultPages = async () => {
  await Promise.all(
    DEFAULT_PAGES.map(page => {
      const query = `
        INSERT INTO web_pages (slug, title, content_json, is_published)
        VALUES ($1, $2, $3::jsonb, true)
        ON CONFLICT (slug) DO NOTHING
      `;
      const values = [page.slug, page.title, JSON.stringify(page.content || {})];
      return pool.query(query, values);
    })
  );
};

const initializeDatabase = async () => {
  try {
    await createWebPagesTable();
    await ensureDefaultPages();
  } catch (error) {
    console.error('[PostgreSQL] web_pages 테이블 초기화 오류:', error);
  }
};

const listPages = async ({ includeDraft = false } = {}) => {
  const query = `
    SELECT slug, title, is_published, updated_at
    FROM web_pages
    ${includeDraft ? '' : 'WHERE is_published = true'}
    ORDER BY slug ASC
  `;
  const result = await pool.query(query);
  return result.rows.map(row => ({
    slug: row.slug,
    title: row.title,
    is_published: row.is_published === true,
    updated_at: row.updated_at
  }));
};

const getPageBySlug = async (slug, { includeDraft = false } = {}) => {
  if (!slug) return null;
  const query = `
    SELECT slug, title, content_json, is_published, updated_at
    FROM web_pages
    WHERE slug = $1
    ${includeDraft ? '' : 'AND is_published = true'}
    LIMIT 1
  `;
  const result = await pool.query(query, [slug]);
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    slug: row.slug,
    title: row.title,
    content: row.content_json || {},
    is_published: row.is_published === true,
    updated_at: row.updated_at
  };
};

const upsertPage = async (slug, { title, content, is_published } = {}) => {
  if (!slug) return null;
  const query = `
    INSERT INTO web_pages (slug, title, content_json, is_published)
    VALUES ($1, $2, $3::jsonb, $4)
    ON CONFLICT (slug)
    DO UPDATE SET
      title = EXCLUDED.title,
      content_json = EXCLUDED.content_json,
      is_published = EXCLUDED.is_published,
      updated_at = CURRENT_TIMESTAMP
    RETURNING slug, title, content_json, is_published, updated_at
  `;
  const values = [
    slug,
    title || slug,
    JSON.stringify(content || {}),
    is_published !== undefined ? Boolean(is_published) : true
  ];
  const result = await pool.query(query, values);
  const row = result.rows[0];
  return {
    slug: row.slug,
    title: row.title,
    content: row.content_json || {},
    is_published: row.is_published === true,
    updated_at: row.updated_at
  };
};

module.exports = {
  initializeDatabase,
  listPages,
  getPageBySlug,
  upsertPage
};
