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
      workout_has_record BOOLEAN DEFAULT false,
      workout_all_completed BOOLEAN DEFAULT false,
      diet_has_record BOOLEAN DEFAULT false,
      workout_member_comment_count INT DEFAULT 0,
      workout_trainer_comment_count INT DEFAULT 0,
      diet_member_comment_count INT DEFAULT 0,
      diet_trainer_comment_count INT DEFAULT 0,
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
        COUNT(*) > 0 AS workout_has_record,
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
    workout_comments_daily AS (
      SELECT
        wc.app_user_id,
        wc.workout_date AS record_date,
        COUNT(*) FILTER (WHERE wc.commenter_type = 'member' AND wc.commenter_app_user_id = wc.app_user_id) AS workout_member_comment_count,
        COUNT(*) FILTER (WHERE wc.commenter_type = 'trainer') AS workout_trainer_comment_count
      FROM workout_comments wc
      GROUP BY wc.app_user_id, wc.workout_date
    ),
    diet_daily_comments_daily AS (
      SELECT
        dc.app_user_id,
        dc.diet_date AS record_date,
        COUNT(*) FILTER (WHERE dc.commenter_type = 'member' AND dc.commenter_app_user_id = dc.app_user_id) AS diet_member_comment_count,
        COUNT(*) FILTER (WHERE dc.commenter_type = 'trainer') AS diet_trainer_comment_count
      FROM diet_daily_comments dc
      GROUP BY dc.app_user_id, dc.diet_date
    ),
    diet_record_comments_daily AS (
      SELECT
        dr.app_user_id,
        dr.meal_date AS record_date,
        COUNT(*) FILTER (WHERE dc.commenter_type = 'user' AND dc.commenter_id = dr.app_user_id::text) AS diet_member_comment_count,
        COUNT(*) FILTER (WHERE dc.commenter_type = 'trainer') AS diet_trainer_comment_count
      FROM diet_comments dc
      JOIN diet_records dr ON dr.id = dc.diet_record_id
      GROUP BY dr.app_user_id, dr.meal_date
    ),
    all_days AS (
      SELECT app_user_id, record_date FROM workout_daily
      UNION
      SELECT app_user_id, record_date FROM diet_daily
      UNION
      SELECT app_user_id, record_date FROM workout_comments_daily
      UNION
      SELECT app_user_id, record_date FROM diet_daily_comments_daily
      UNION
      SELECT app_user_id, record_date FROM diet_record_comments_daily
    )
    INSERT INTO app_user_daily_stats (
      app_user_id,
      record_date,
      workout_has_record,
      workout_all_completed,
      diet_has_record,
      workout_member_comment_count,
      workout_trainer_comment_count,
      diet_member_comment_count,
      diet_trainer_comment_count,
      updated_at
    )
    SELECT
      d.app_user_id,
      d.record_date,
      COALESCE(w.workout_has_record, false),
      COALESCE(w.workout_all_completed, false),
      COALESCE(di.diet_has_record, false),
      COALESCE(wc.workout_member_comment_count, 0),
      COALESCE(wc.workout_trainer_comment_count, 0),
      COALESCE(ddc.diet_member_comment_count, 0) + COALESCE(drc.diet_member_comment_count, 0),
      COALESCE(ddc.diet_trainer_comment_count, 0) + COALESCE(drc.diet_trainer_comment_count, 0),
      NOW()
    FROM all_days d
    LEFT JOIN workout_daily w ON w.app_user_id = d.app_user_id AND w.record_date = d.record_date
    LEFT JOIN diet_daily di ON di.app_user_id = d.app_user_id AND di.record_date = d.record_date
    LEFT JOIN workout_comments_daily wc ON wc.app_user_id = d.app_user_id AND wc.record_date = d.record_date
    LEFT JOIN diet_daily_comments_daily ddc ON ddc.app_user_id = d.app_user_id AND ddc.record_date = d.record_date
    LEFT JOIN diet_record_comments_daily drc ON drc.app_user_id = d.app_user_id AND drc.record_date = d.record_date
    ON CONFLICT (app_user_id, record_date) DO UPDATE
    SET workout_has_record = EXCLUDED.workout_has_record,
        workout_all_completed = EXCLUDED.workout_all_completed,
        diet_has_record = EXCLUDED.diet_has_record,
        workout_member_comment_count = EXCLUDED.workout_member_comment_count,
        workout_trainer_comment_count = EXCLUDED.workout_trainer_comment_count,
        diet_member_comment_count = EXCLUDED.diet_member_comment_count,
        diet_trainer_comment_count = EXCLUDED.diet_trainer_comment_count,
        updated_at = EXCLUDED.updated_at
  `;
  await pool.query(query);
};

const backfillWorkoutHasRecord = async () => {
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
        COUNT(*) > 0 AS workout_has_record,
        BOOL_AND(record_completed) AS workout_all_completed
      FROM workout_records_with_completion
      GROUP BY app_user_id, record_date
    )
    INSERT INTO app_user_daily_stats (
      app_user_id,
      record_date,
      workout_has_record,
      workout_all_completed,
      updated_at
    )
    SELECT
      app_user_id,
      record_date,
      workout_has_record,
      workout_all_completed,
      NOW()
    FROM workout_daily
    ON CONFLICT (app_user_id, record_date) DO UPDATE
    SET workout_has_record = EXCLUDED.workout_has_record,
        workout_all_completed = EXCLUDED.workout_all_completed,
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

const getWorkoutCommentCounts = async (appUserId, recordDate) => {
  const query = `
    SELECT
      COUNT(*) FILTER (WHERE commenter_type = 'member' AND commenter_app_user_id = $1) AS member_count,
      COUNT(*) FILTER (WHERE commenter_type = 'trainer') AS trainer_count
    FROM workout_comments
    WHERE app_user_id = $1 AND workout_date = $2
  `;
  const result = await pool.query(query, [appUserId, recordDate]);
  const row = result.rows[0] || { member_count: 0, trainer_count: 0 };
  return {
    memberCount: parseInt(row.member_count || 0, 10),
    trainerCount: parseInt(row.trainer_count || 0, 10)
  };
};

const getDietCommentCounts = async (appUserId, recordDate) => {
  const query = `
    SELECT
      COALESCE(daily.member_count, 0) + COALESCE(record.member_count, 0) AS member_count,
      COALESCE(daily.trainer_count, 0) + COALESCE(record.trainer_count, 0) AS trainer_count
    FROM (
      SELECT
        COUNT(*) FILTER (WHERE commenter_type = 'member' AND commenter_app_user_id = $1) AS member_count,
        COUNT(*) FILTER (WHERE commenter_type = 'trainer') AS trainer_count
      FROM diet_daily_comments
      WHERE app_user_id = $1 AND diet_date = $2
    ) daily
    CROSS JOIN (
      SELECT
        COUNT(*) FILTER (WHERE commenter_type = 'user' AND commenter_id = $1::text) AS member_count,
        COUNT(*) FILTER (WHERE commenter_type = 'trainer') AS trainer_count
      FROM diet_comments dc
      JOIN diet_records dr ON dr.id = dc.diet_record_id
      WHERE dr.app_user_id = $1 AND dr.meal_date = $2
    ) record
  `;
  const result = await pool.query(query, [appUserId, recordDate]);
  const row = result.rows[0] || { member_count: 0, trainer_count: 0 };
  return {
    memberCount: parseInt(row.member_count || 0, 10),
    trainerCount: parseInt(row.trainer_count || 0, 10)
  };
};

const refreshDailyStats = async (appUserId, recordDateRaw) => {
  const recordDate = normalizeDate(recordDateRaw);
  if (!appUserId || !recordDate) return;
  const [workoutStatus, dietHasRecord, workoutCommentCounts, dietCommentCounts] = await Promise.all([
    getWorkoutDayStatus(appUserId, recordDate),
    getDietDayStatus(appUserId, recordDate),
    getWorkoutCommentCounts(appUserId, recordDate),
    getDietCommentCounts(appUserId, recordDate)
  ]);
  if (!workoutStatus.hasWorkout
      && !dietHasRecord
      && workoutCommentCounts.memberCount === 0
      && workoutCommentCounts.trainerCount === 0
      && dietCommentCounts.memberCount === 0
      && dietCommentCounts.trainerCount === 0) {
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
        workout_has_record,
        workout_all_completed,
        diet_has_record,
        workout_member_comment_count,
        workout_trainer_comment_count,
        diet_member_comment_count,
        diet_trainer_comment_count,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (app_user_id, record_date) DO UPDATE
      SET workout_has_record = EXCLUDED.workout_has_record,
          workout_all_completed = EXCLUDED.workout_all_completed,
          diet_has_record = EXCLUDED.diet_has_record,
          workout_member_comment_count = EXCLUDED.workout_member_comment_count,
          workout_trainer_comment_count = EXCLUDED.workout_trainer_comment_count,
          diet_member_comment_count = EXCLUDED.diet_member_comment_count,
          diet_trainer_comment_count = EXCLUDED.diet_trainer_comment_count,
          updated_at = EXCLUDED.updated_at
    `,
    [
      appUserId,
      recordDate,
      workoutStatus.hasWorkout,
      workoutStatus.allCompleted,
      dietHasRecord,
      workoutCommentCounts.memberCount,
      workoutCommentCounts.trainerCount,
      dietCommentCounts.memberCount,
      dietCommentCounts.trainerCount
    ]
  );
};

const getWorkoutCalendarSummary = async (appUserId, startDate, endDate) => {
  const query = `
    SELECT record_date, workout_has_record, workout_all_completed
    FROM app_user_daily_stats
    WHERE app_user_id = $1
      AND record_date >= $2
      AND record_date <= $3
  `;
  const result = await pool.query(query, [appUserId, startDate, endDate]);
  const summary = {};
  result.rows.forEach(row => {
    const dateStr = normalizeDate(row.record_date);
    summary[dateStr] = {
      hasWorkout: row.workout_has_record === true,
      allCompleted: row.workout_all_completed === true
    };
  });
  return summary;
};

const getDietCalendarSummary = async (appUserId, startDate, endDate) => {
  const query = `
    SELECT record_date, diet_has_record
    FROM app_user_daily_stats
    WHERE app_user_id = $1
      AND record_date >= $2
      AND record_date <= $3
  `;
  const result = await pool.query(query, [appUserId, startDate, endDate]);
  const summary = {};
  result.rows.forEach(row => {
    const dateStr = normalizeDate(row.record_date);
    summary[dateStr] = {
      hasDiet: row.diet_has_record === true,
      count: row.diet_has_record ? 1 : 0
    };
  });
  return summary;
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

const getAchievementSummary = async (appUserId, startDate, endDate) => {
  const query = `
    SELECT
      COUNT(*) FILTER (WHERE workout_all_completed) AS workout_days,
      COUNT(*) FILTER (WHERE diet_has_record) AS diet_days,
      COALESCE(SUM(workout_member_comment_count), 0) AS workout_member_comment_count,
      COALESCE(SUM(workout_trainer_comment_count), 0) AS workout_trainer_comment_count,
      COALESCE(SUM(diet_member_comment_count), 0) AS diet_member_comment_count,
      COALESCE(SUM(diet_trainer_comment_count), 0) AS diet_trainer_comment_count
    FROM app_user_daily_stats
    WHERE app_user_id = $1
      AND record_date >= $2
      AND record_date <= $3
  `;
  const result = await pool.query(query, [appUserId, startDate, endDate]);
  const row = result.rows[0] || {};
  return {
    workoutDays: parseInt(row.workout_days || 0, 10),
    dietDays: parseInt(row.diet_days || 0, 10),
    workoutMemberCommentCount: parseInt(row.workout_member_comment_count || 0, 10),
    workoutTrainerCommentCount: parseInt(row.workout_trainer_comment_count || 0, 10),
    dietMemberCommentCount: parseInt(row.diet_member_comment_count || 0, 10),
    dietTrainerCommentCount: parseInt(row.diet_trainer_comment_count || 0, 10)
  };
};

const getAchievementSummaries = async (appUserIds, startDate, endDate) => {
  if (!appUserIds || appUserIds.length === 0) {
    return [];
  }
  const query = `
    SELECT
      app_user_id,
      COUNT(*) FILTER (WHERE workout_all_completed) AS workout_days,
      COUNT(*) FILTER (WHERE diet_has_record) AS diet_days,
      COALESCE(SUM(workout_member_comment_count), 0) AS workout_member_comment_count,
      COALESCE(SUM(workout_trainer_comment_count), 0) AS workout_trainer_comment_count,
      COALESCE(SUM(diet_member_comment_count), 0) AS diet_member_comment_count,
      COALESCE(SUM(diet_trainer_comment_count), 0) AS diet_trainer_comment_count
    FROM app_user_daily_stats
    WHERE app_user_id = ANY($1::uuid[])
      AND record_date >= $2
      AND record_date <= $3
    GROUP BY app_user_id
  `;
  const result = await pool.query(query, [appUserIds, startDate, endDate]);
  return result.rows.map(row => ({
    app_user_id: row.app_user_id,
    workoutDays: parseInt(row.workout_days || 0, 10),
    dietDays: parseInt(row.diet_days || 0, 10),
    workoutMemberCommentCount: parseInt(row.workout_member_comment_count || 0, 10),
    workoutTrainerCommentCount: parseInt(row.workout_trainer_comment_count || 0, 10),
    dietMemberCommentCount: parseInt(row.diet_member_comment_count || 0, 10),
    dietTrainerCommentCount: parseInt(row.diet_trainer_comment_count || 0, 10)
  }));
};

const getAchievementMedalTotals = async (appUserId) => {
  const query = `
    SELECT
      date_trunc('month', record_date) AS month,
      COUNT(*) FILTER (WHERE workout_all_completed) AS workout_days,
      COUNT(*) FILTER (WHERE diet_has_record) AS diet_days,
      COALESCE(SUM(workout_member_comment_count + diet_member_comment_count), 0) AS member_comment_count,
      COALESCE(SUM(workout_trainer_comment_count + diet_trainer_comment_count), 0) AS trainer_comment_count
    FROM app_user_daily_stats
    WHERE app_user_id = $1
      AND record_date < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')
    GROUP BY date_trunc('month', record_date)
    ORDER BY date_trunc('month', record_date)
  `;
  const result = await pool.query(query, [appUserId]);

  const getWorkoutTier = (count) => {
    if (count >= 13) return 'diamond';
    if (count >= 9) return 'gold';
    if (count >= 5) return 'silver';
    if (count >= 1) return 'bronze';
    return 'none';
  };
  const getDietTier = (count) => {
    if (count >= 16) return 'diamond';
    if (count >= 11) return 'gold';
    if (count >= 6) return 'silver';
    if (count >= 1) return 'bronze';
    return 'none';
  };
  const getCommentTier = (count) => {
    if (count >= 16) return 'diamond';
    if (count >= 11) return 'gold';
    if (count >= 6) return 'silver';
    if (count >= 1) return 'bronze';
    return 'none';
  };

  const emptyTotals = {
    bronze: 0,
    silver: 0,
    gold: 0,
    diamond: 0
  };
  const totals = {
    workout: { ...emptyTotals },
    diet: { ...emptyTotals },
    memberComment: { ...emptyTotals },
    trainerComment: { ...emptyTotals }
  };

  result.rows.forEach(row => {
    const workoutTier = getWorkoutTier(parseInt(row.workout_days || 0, 10));
    const dietTier = getDietTier(parseInt(row.diet_days || 0, 10));
    const memberTier = getCommentTier(parseInt(row.member_comment_count || 0, 10));
    const trainerTier = getCommentTier(parseInt(row.trainer_comment_count || 0, 10));

    if (workoutTier !== 'none') totals.workout[workoutTier] += 1;
    if (dietTier !== 'none') totals.diet[dietTier] += 1;
    if (memberTier !== 'none') totals.memberComment[memberTier] += 1;
    if (trainerTier !== 'none') totals.trainerComment[trainerTier] += 1;
  });

  return totals;
};

const initializeDatabase = async () => {
  await runMigration(
    'create_app_user_daily_stats_20260205',
    '앱 유저 일별 업적 집계 테이블 생성',
    createDailyStatsTable
  );
  await runMigration(
    'add_workout_has_record_to_daily_stats_20260205',
    '앱 유저 일별 업적 집계에 workout_has_record 컬럼 추가',
    async () => {
      const checkQuery = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'app_user_daily_stats'
          AND column_name = 'workout_has_record'
      `;
      const checkResult = await pool.query(checkQuery);
      if (checkResult.rows.length === 0) {
        await pool.query(`ALTER TABLE app_user_daily_stats ADD COLUMN workout_has_record BOOLEAN DEFAULT false`);
      }
    }
  );
  await runMigration(
    'add_comment_counts_to_daily_stats_20260206',
    '앱 유저 일별 업적 집계에 코멘트 카운트 컬럼 추가',
    async () => {
      const checkQuery = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'app_user_daily_stats'
      `;
      const checkResult = await pool.query(checkQuery);
      const existingColumns = checkResult.rows.map(row => row.column_name);
      const addColumnIfMissing = async (columnName) => {
        if (!existingColumns.includes(columnName)) {
          await pool.query(`ALTER TABLE app_user_daily_stats ADD COLUMN ${columnName} INT DEFAULT 0`);
        }
      };
      await addColumnIfMissing('workout_member_comment_count');
      await addColumnIfMissing('workout_trainer_comment_count');
      await addColumnIfMissing('diet_member_comment_count');
      await addColumnIfMissing('diet_trainer_comment_count');
    }
  );
  await runMigration(
    'backfill_workout_has_record_20260205',
    '기존 운동 기록 기반 workout_has_record 재계산',
    backfillWorkoutHasRecord
  );
  await runMigration(
    'backfill_app_user_daily_stats_20260205',
    '앱 유저 일별 업적 집계 초기 백필',
    backfillDailyStats
  );
  await runMigration(
    'backfill_app_user_daily_stats_comment_counts_20260206',
    '앱 유저 일별 업적 집계 코멘트 카운트 백필',
    backfillDailyStats
  );
};

module.exports = {
  pool,
  initializeDatabase,
  refreshDailyStats,
  getMedalStatus,
  getWorkoutCalendarSummary,
  getDietCalendarSummary,
  getAchievementSummary,
  getAchievementSummaries,
  getAchievementMedalTotals
};
