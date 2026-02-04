const { Pool } = require('pg');
const { runMigration } = require('./migrations-manager');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const createDailyStatsTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS app_user_daily_stats (
      app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      record_date DATE NOT NULL,
      workout_all_completed BOOLEAN DEFAULT false,
      diet_has_record BOOLEAN DEFAULT false,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (app_user_id, record_date)
    )
  `;
  await pool.query(query);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_app_user_daily_stats_user_date
    ON app_user_daily_stats(app_user_id, record_date)
  `);
};

const backfillDailyStats = async () => {
  const query = `
    WITH workout_records_with_completion AS (
      SELECT
        wr.app_user_id,
        wr.workout_date AS record_date,
        wr.id AS workout_record_id,
        CASE
          WHEN wr.is_text_record = true THEN wr.is_completed
          WHEN wt.type = '시간' THEN wr.is_completed
          WHEN wt.type = '세트' THEN (COUNT(wrs.*) > 0 AND BOOL_AND(wrs.is_completed))
          ELSE false
        END AS record_completed
      FROM workout_records wr
      LEFT JOIN workout_types wt ON wr.workout_type_id = wt.id
      LEFT JOIN workout_record_sets wrs ON wrs.workout_record_id = wr.id
      GROUP BY wr.app_user_id, wr.workout_date, wr.id, wr.is_text_record, wr.is_completed, wt.type
    ),
    workout_daily AS (
      SELECT
        app_user_id,
        record_date,
        COUNT(*) > 0 AS has_workout,
        BOOL_AND(record_completed) AS workout_all_completed
      FROM workout_records_with_completion
      GROUP BY app_user_id, record_date
    ),
    diet_daily AS (
      SELECT
        dr.app_user_id,
        dr.meal_date AS record_date,
        true AS diet_has_record
      FROM diet_records dr
      GROUP BY dr.app_user_id, dr.meal_date
    ),
    all_days AS (
      SELECT app_user_id, record_date FROM workout_daily
      UNION
      SELECT app_user_id, record_date FROM diet_daily
    )
    INSERT INTO app_user_daily_stats (
      app_user_id,
      record_date,
      workout_all_completed,
      diet_has_record,
      updated_at
    )
    SELECT
      d.app_user_id,
      d.record_date,
      COALESCE(w.workout_all_completed, false),
      COALESCE(di.diet_has_record, false),
      NOW()
    FROM all_days d
    LEFT JOIN workout_daily w ON w.app_user_id = d.app_user_id AND w.record_date = d.record_date
    LEFT JOIN diet_daily di ON di.app_user_id = d.app_user_id AND di.record_date = d.record_date
    ON CONFLICT (app_user_id, record_date) DO UPDATE
    SET workout_all_completed = EXCLUDED.workout_all_completed,
        diet_has_record = EXCLUDED.diet_has_record,
        updated_at = EXCLUDED.updated_at
  `;
  await pool.query(query);
};

const normalizeDate = (dateValue) => {
  if (!dateValue) return null;
  if (dateValue instanceof Date) {
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof dateValue === 'string') {
    return dateValue.split('T')[0];
  }
  return dateValue;
};

const getWorkoutDayStatus = async (appUserId, recordDate) => {
  const query = `
    WITH record_completion AS (
      SELECT
        wr.id,
        CASE
          WHEN wr.is_text_record = true THEN wr.is_completed
          WHEN wt.type = '시간' THEN wr.is_completed
          WHEN wt.type = '세트' THEN (COUNT(wrs.*) > 0 AND BOOL_AND(wrs.is_completed))
          ELSE false
        END AS record_completed
      FROM workout_records wr
      LEFT JOIN workout_types wt ON wr.workout_type_id = wt.id
      LEFT JOIN workout_record_sets wrs ON wrs.workout_record_id = wr.id
      WHERE wr.app_user_id = $1 AND wr.workout_date = $2
      GROUP BY wr.id, wr.is_text_record, wr.is_completed, wt.type
    )
    SELECT
      COUNT(*) AS total,
      BOOL_AND(record_completed) AS all_completed
    FROM record_completion
  `;
  const result = await pool.query(query, [appUserId, recordDate]);
  const row = result.rows[0] || { total: 0, all_completed: false };
  const total = parseInt(row.total || 0, 10);
  return {
    hasWorkout: total > 0,
    allCompleted: total > 0 && row.all_completed === true
  };
};

const getDietDayStatus = async (appUserId, recordDate) => {
  const query = `
    SELECT COUNT(*) AS total
    FROM diet_records
    WHERE app_user_id = $1 AND meal_date = $2
  `;
  const result = await pool.query(query, [appUserId, recordDate]);
  const total = parseInt(result.rows[0]?.total || 0, 10);
  return total > 0;
};

const refreshDailyStats = async (appUserId, recordDateRaw) => {
  const recordDate = normalizeDate(recordDateRaw);
  if (!appUserId || !recordDate) return;
  const [workoutStatus, dietHasRecord] = await Promise.all([
    getWorkoutDayStatus(appUserId, recordDate),
    getDietDayStatus(appUserId, recordDate)
  ]);
  if (!workoutStatus.hasWorkout && !dietHasRecord) {
    await pool.query(
      `DELETE FROM app_user_daily_stats WHERE app_user_id = $1 AND record_date = $2`,
      [appUserId, recordDate]
    );
    return;
  }
  await pool.query(
    `
      INSERT INTO app_user_daily_stats (
        app_user_id,
        record_date,
        workout_all_completed,
        diet_has_record,
        updated_at
      ) VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (app_user_id, record_date) DO UPDATE
      SET workout_all_completed = EXCLUDED.workout_all_completed,
          diet_has_record = EXCLUDED.diet_has_record,
          updated_at = EXCLUDED.updated_at
    `,
    [appUserId, recordDate, workoutStatus.allCompleted, dietHasRecord]
  );
};

const getMedalStatus = async (appUserIds, startDate, endDate) => {
  if (!appUserIds || appUserIds.length === 0) {
    return [];
  }
  const getWorkoutTier = (days) => {
    if (days >= 13) return 'diamond';
    if (days >= 9) return 'gold';
    if (days >= 5) return 'silver';
    if (days >= 1) return 'bronze';
    return 'none';
  };
  const getDietTier = (days) => {
    if (days >= 16) return 'diamond';
    if (days >= 11) return 'gold';
    if (days >= 6) return 'silver';
    if (days >= 1) return 'bronze';
    return 'none';
  };
  const query = `
    SELECT
      app_user_id,
      COUNT(*) FILTER (WHERE workout_all_completed) AS workout_days,
      COUNT(*) FILTER (WHERE diet_has_record) AS diet_days
    FROM app_user_daily_stats
    WHERE app_user_id = ANY($1::uuid[])
      AND record_date >= $2
      AND record_date <= $3
    GROUP BY app_user_id
  `;
  const result = await pool.query(query, [appUserIds, startDate, endDate]);
  const countsMap = new Map();
  result.rows.forEach(row => {
    countsMap.set(row.app_user_id, {
      workoutDays: parseInt(row.workout_days || 0, 10),
      dietDays: parseInt(row.diet_days || 0, 10)
    });
  });
  return appUserIds.map(appUserId => {
    const counts = countsMap.get(appUserId) || { workoutDays: 0, dietDays: 0 };
    return {
      app_user_id: appUserId,
      workout: { days: counts.workoutDays, tier: getWorkoutTier(counts.workoutDays) },
      diet: { days: counts.dietDays, tier: getDietTier(counts.dietDays) }
    };
  });
};

const initializeDatabase = async () => {
  await runMigration(
    'create_app_user_daily_stats_20260205',
    '앱 유저 일별 업적 집계 테이블 생성',
    createDailyStatsTable
  );
  await runMigration(
    'backfill_app_user_daily_stats_20260205',
    '앱 유저 일별 업적 집계 초기 백필',
    backfillDailyStats
  );
};

module.exports = {
  pool,
  initializeDatabase,
  refreshDailyStats,
  getMedalStatus
};
