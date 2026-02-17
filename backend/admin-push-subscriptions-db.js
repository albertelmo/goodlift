const { Pool } = require('pg');
const { runMigration } = require('./migrations-manager');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const createAdminPushSubscriptionsTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'admin_push_subscriptions'
    `;
    const checkResult = await pool.query(checkQuery);

    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE admin_push_subscriptions (
          id SERIAL PRIMARY KEY,
          username TEXT NOT NULL,
          endpoint TEXT NOT NULL,
          p256dh TEXT,
          auth TEXT,
          subscription JSONB,
          user_agent TEXT,
          platform TEXT,
          device_label TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(username, endpoint)
        )
      `;
      await pool.query(createQuery);
      await createAdminPushSubscriptionIndexes();
      console.log('[PostgreSQL] admin_push_subscriptions 테이블이 생성되었습니다.');
    } else {
      await runMigration(
        'add_admin_push_subscription_columns_20260221',
        'admin_push_subscriptions 테이블 컬럼 보강',
        migrateAdminPushSubscriptionsTable
      );
    }
  } catch (error) {
    console.error('[PostgreSQL] admin_push_subscriptions 테이블 생성 오류:', error);
    throw error;
  }
};

const migrateAdminPushSubscriptionsTable = async () => {
  const columns = [
    { name: 'subscription', type: 'JSONB' },
    { name: 'user_agent', type: 'TEXT' },
    { name: 'platform', type: 'TEXT' },
    { name: 'device_label', type: 'TEXT' },
    { name: 'is_active', type: 'BOOLEAN DEFAULT true' }
  ];

  for (const column of columns) {
    const checkQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'admin_push_subscriptions' AND column_name = $1
    `;
    const checkResult = await pool.query(checkQuery, [column.name]);
    if (checkResult.rows.length === 0) {
      await pool.query(`ALTER TABLE admin_push_subscriptions ADD COLUMN ${column.name} ${column.type}`);
    }
  }
};

const createAdminPushSubscriptionIndexes = async () => {
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_admin_push_subscriptions_user
    ON admin_push_subscriptions(username)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_admin_push_subscriptions_active
    ON admin_push_subscriptions(is_active)
  `);
};

const initializeDatabase = async () => {
  await createAdminPushSubscriptionsTable();
};

const upsertSubscription = async (username, subscription, metadata = {}) => {
  const endpoint = subscription?.endpoint;
  const keys = subscription?.keys || {};
  if (!endpoint) {
    throw new Error('subscription endpoint가 필요합니다.');
  }

  const query = `
    INSERT INTO admin_push_subscriptions (
      username,
      endpoint,
      p256dh,
      auth,
      subscription,
      user_agent,
      platform,
      device_label,
      is_active,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, CURRENT_TIMESTAMP)
    ON CONFLICT (username, endpoint)
    DO UPDATE SET
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      subscription = EXCLUDED.subscription,
      user_agent = EXCLUDED.user_agent,
      platform = EXCLUDED.platform,
      device_label = EXCLUDED.device_label,
      is_active = true,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;

  const values = [
    username,
    endpoint,
    keys.p256dh || null,
    keys.auth || null,
    JSON.stringify(subscription),
    metadata.userAgent || null,
    metadata.platform || null,
    metadata.deviceLabel || null
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

const deactivateSubscription = async (username, endpoint = null) => {
  let query = `
    UPDATE admin_push_subscriptions
    SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE username = $1
  `;
  const params = [username];
  if (endpoint) {
    query += ` AND endpoint = $2`;
    params.push(endpoint);
  }
  const result = await pool.query(query, params);
  return result.rowCount;
};

const getActiveSubscriptionsByUsernames = async (usernames) => {
  if (!Array.isArray(usernames) || usernames.length === 0) {
    return [];
  }
  const query = `
    SELECT *
    FROM admin_push_subscriptions
    WHERE username = ANY($1) AND is_active = true
  `;
  const result = await pool.query(query, [usernames]);
  return result.rows;
};

const getSubscriptionsByUser = async (username) => {
  const query = `
    SELECT id, username, endpoint, user_agent, platform, device_label, is_active, created_at, updated_at
    FROM admin_push_subscriptions
    WHERE username = $1
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
  `;
  const result = await pool.query(query, [username]);
  return result.rows;
};

const getActiveCountByUser = async (username) => {
  const query = `
    SELECT COUNT(*)::int AS count
    FROM admin_push_subscriptions
    WHERE username = $1 AND is_active = true
  `;
  const result = await pool.query(query, [username]);
  return result.rows[0]?.count || 0;
};

const deactivateByEndpoint = async (endpoint) => {
  if (!endpoint) return 0;
  const query = `
    UPDATE admin_push_subscriptions
    SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE endpoint = $1
  `;
  const result = await pool.query(query, [endpoint]);
  return result.rowCount;
};

module.exports = {
  initializeDatabase,
  upsertSubscription,
  deactivateSubscription,
  getActiveSubscriptionsByUsernames,
  getSubscriptionsByUser,
  getActiveCountByUser,
  deactivateByEndpoint
};
