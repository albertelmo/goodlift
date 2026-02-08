const { Pool } = require('pg');
const { runMigration } = require('./migrations-manager');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const createAnnouncementDeliveriesTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'announcement_deliveries'
    `;
    const checkResult = await pool.query(checkQuery);

    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE announcement_deliveries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
          app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          delivery_type VARCHAR(20) DEFAULT 'selected',
          delivered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          read_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(announcement_id, app_user_id)
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      await createAnnouncementDeliveriesIndexes();
      console.log('[PostgreSQL] announcement_deliveries 테이블이 생성되었습니다.');
    } else {
      await runMigration(
        'migrate_announcement_deliveries_add_columns_20260208',
        'announcement_deliveries 테이블 필드 보강',
        migrateAnnouncementDeliveriesTable
      );
    }
  } catch (error) {
    console.error('[PostgreSQL] announcement_deliveries 테이블 생성 오류:', error);
    throw error;
  }
};

const migrateAnnouncementDeliveriesTable = async () => {
  const columns = [
    { name: 'delivery_type', type: "VARCHAR(20) DEFAULT 'selected'" },
    { name: 'delivered_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
    { name: 'read_at', type: 'TIMESTAMP' },
    { name: 'created_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' }
  ];

  for (const column of columns) {
    const checkQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'announcement_deliveries' AND column_name = $1
    `;
    const checkResult = await pool.query(checkQuery, [column.name]);
    if (checkResult.rows.length === 0) {
      await pool.query(`ALTER TABLE announcement_deliveries ADD COLUMN ${column.name} ${column.type}`);
    }
  }
  await createAnnouncementDeliveriesIndexes();
};

const createAnnouncementDeliveriesIndexes = async () => {
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_announcement_deliveries_user
    ON announcement_deliveries(app_user_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_announcement_deliveries_unread
    ON announcement_deliveries(app_user_id, read_at)
  `);
};

const initializeDatabase = async () => {
  await createAnnouncementDeliveriesTable();
};

const addDeliveries = async (announcementId, appUserIds = [], deliveryType = 'selected') => {
  if (!announcementId || appUserIds.length === 0) {
    return { count: 0 };
  }
  const values = [];
  const placeholders = appUserIds.map((appUserId, index) => {
    const baseIndex = index * 3;
    values.push(announcementId, appUserId, deliveryType);
    return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, NOW() AT TIME ZONE 'Asia/Seoul', NOW() AT TIME ZONE 'Asia/Seoul')`;
  });

  const query = `
    INSERT INTO announcement_deliveries (
      announcement_id,
      app_user_id,
      delivery_type,
      delivered_at,
      created_at
    ) VALUES ${placeholders.join(',')}
    ON CONFLICT (announcement_id, app_user_id)
    DO UPDATE SET
      delivery_type = EXCLUDED.delivery_type,
      delivered_at = EXCLUDED.delivered_at,
      read_at = NULL
  `;
  const result = await pool.query(query, values);
  return { count: result.rowCount || 0 };
};

const getInbox = async (appUserId, { limit = 30, offset = 0 } = {}) => {
  const query = `
    SELECT 
      d.id as delivery_id,
      d.announcement_id,
      d.read_at,
      d.delivered_at,
      a.title,
      a.content,
      a.image_urls,
      a.created_by,
      to_char(a.created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS.MS"+09:00"') as created_at
    FROM announcement_deliveries d
    INNER JOIN announcements a ON a.id = d.announcement_id
    WHERE d.app_user_id = $1
      AND a.is_active = true
    ORDER BY d.delivered_at DESC
    LIMIT $2 OFFSET $3
  `;
  const result = await pool.query(query, [appUserId, limit, offset]);
  return result.rows.map(parseDeliveryRow);
};

const getUnreadCount = async (appUserId) => {
  const query = `
    SELECT COUNT(*) as count
    FROM announcement_deliveries d
    INNER JOIN announcements a ON a.id = d.announcement_id
    WHERE d.app_user_id = $1
      AND d.read_at IS NULL
      AND a.is_active = true
  `;
  const result = await pool.query(query, [appUserId]);
  return parseInt(result.rows[0]?.count || 0, 10);
};

const getDeliveryDetail = async (deliveryId, appUserId) => {
  const query = `
    SELECT 
      d.id as delivery_id,
      d.announcement_id,
      d.read_at,
      d.delivered_at,
      a.title,
      a.content,
      a.image_urls,
      a.created_by,
      to_char(a.created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS.MS"+09:00"') as created_at
    FROM announcement_deliveries d
    INNER JOIN announcements a ON a.id = d.announcement_id
    WHERE d.id = $1
      AND d.app_user_id = $2
      AND a.is_active = true
  `;
  const result = await pool.query(query, [deliveryId, appUserId]);
  return result.rows[0] ? parseDeliveryRow(result.rows[0]) : null;
};

const markAsRead = async (deliveryId, appUserId) => {
  const query = `
    UPDATE announcement_deliveries
    SET read_at = NOW() AT TIME ZONE 'Asia/Seoul'
    WHERE id = $1 AND app_user_id = $2
    RETURNING id, read_at
  `;
  const result = await pool.query(query, [deliveryId, appUserId]);
  return result.rows[0] || null;
};

module.exports = {
  initializeDatabase,
  addDeliveries,
  getInbox,
  getUnreadCount,
  getDeliveryDetail,
  markAsRead
};

function parseDeliveryRow(row) {
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
