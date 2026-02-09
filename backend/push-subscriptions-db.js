const { Pool } = require('pg');
const { runMigration } = require('./migrations-manager');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const createPushSubscriptionsTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'push_subscriptions'
    `;
    const checkResult = await pool.query(checkQuery);

    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE push_subscriptions (
          id SERIAL PRIMARY KEY,
          app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          endpoint TEXT NOT NULL,
          p256dh TEXT,
          auth TEXT,
          subscription JSONB,
          user_agent TEXT,
          platform TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(app_user_id, endpoint)
        )
      `;
      await pool.query(createQuery);
      await createPushSubscriptionIndexes();
      console.log('[PostgreSQL] push_subscriptions 테이블이 생성되었습니다.');
    } else {
      await runMigration(
        'add_push_subscription_columns_20260207',
        'push_subscriptions 테이블 신규 컬럼 보강 (JSONB/metadata)',
        migratePushSubscriptionsTable
      );
    }
  } catch (error) {
    console.error('[PostgreSQL] push_subscriptions 테이블 생성 오류:', error);
    throw error;
  }
};

const migratePushSubscriptionsTable = async () => {
  const columns = [
    { name: 'subscription', type: 'JSONB' },
    { name: 'user_agent', type: 'TEXT' },
    { name: 'platform', type: 'TEXT' },
    { name: 'is_active', type: 'BOOLEAN DEFAULT true' }
  ];

  for (const column of columns) {
    const checkQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'push_subscriptions' AND column_name = $1
    `;
    const checkResult = await pool.query(checkQuery, [column.name]);
    if (checkResult.rows.length === 0) {
      await pool.query(`ALTER TABLE push_subscriptions ADD COLUMN ${column.name} ${column.type}`);
    }
  }
};

const createPushSubscriptionIndexes = async () => {
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
    ON push_subscriptions(app_user_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active
    ON push_subscriptions(is_active)
  `);
};

const initializeDatabase = async () => {
  await createPushSubscriptionsTable();
};

const upsertSubscription = async (appUserId, subscription, metadata = {}) => {
  const endpoint = subscription?.endpoint;
  const keys = subscription?.keys || {};
  if (!endpoint) {
    throw new Error('subscription endpoint가 필요합니다.');
  }

  const query = `
    INSERT INTO push_subscriptions (
      app_user_id,
      endpoint,
      p256dh,
      auth,
      subscription,
      user_agent,
      platform,
      is_active,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP)
    ON CONFLICT (app_user_id, endpoint)
    DO UPDATE SET
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      subscription = EXCLUDED.subscription,
      user_agent = EXCLUDED.user_agent,
      platform = EXCLUDED.platform,
      is_active = true,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;

  const values = [
    appUserId,
    endpoint,
    keys.p256dh || null,
    keys.auth || null,
    JSON.stringify(subscription),
    metadata.userAgent || null,
    metadata.platform || null
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

const deactivateSubscription = async (appUserId, endpoint = null) => {
  let query = `
    UPDATE push_subscriptions
    SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE app_user_id = $1
  `;
  const params = [appUserId];
  if (endpoint) {
    query += ` AND endpoint = $2`;
    params.push(endpoint);
  }

  const result = await pool.query(query, params);
  return result.rowCount;
};

const getActiveSubscriptions = async (appUserId) => {
  const query = `
    SELECT *
    FROM push_subscriptions
    WHERE app_user_id = $1 AND is_active = true
  `;
  const result = await pool.query(query, [appUserId]);
  return result.rows;
};

const getSubscriptionStatus = async (appUserId) => {
  const query = `
    SELECT COUNT(*)::int AS count
    FROM push_subscriptions
    WHERE app_user_id = $1 AND is_active = true
  `;
  const result = await pool.query(query, [appUserId]);
  return (result.rows[0]?.count || 0) > 0;
};

const getSubscriptionsByUser = async (appUserId) => {
  const query = `
    SELECT id, app_user_id, endpoint, user_agent, platform, is_active, created_at, updated_at
    FROM push_subscriptions
    WHERE app_user_id = $1
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
  `;
  const result = await pool.query(query, [appUserId]);
  return result.rows;
};

const getSubscriptionStatuses = async (appUserIds) => {
  if (!Array.isArray(appUserIds) || appUserIds.length === 0) {
    return [];
  }
  const query = `
    SELECT app_user_id, COUNT(*)::int AS count
    FROM push_subscriptions
    WHERE app_user_id = ANY($1) AND is_active = true
    GROUP BY app_user_id
  `;
  const result = await pool.query(query, [appUserIds]);
  return result.rows.map(row => ({
    app_user_id: row.app_user_id,
    enabled: (row.count || 0) > 0,
    count: row.count || 0
  }));
};

const deactivateByEndpoint = async (endpoint) => {
  if (!endpoint) return 0;
  const query = `
    UPDATE push_subscriptions
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
  getActiveSubscriptions,
  getSubscriptionStatus,
  getSubscriptionsByUser,
  getSubscriptionStatuses,
  deactivateByEndpoint
};
