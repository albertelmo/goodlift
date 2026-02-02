const { Pool } = require('pg');
const { runMigration } = require('./migrations-manager');

// PostgreSQL 연결 풀 생성 (기존 DB 모듈 패턴과 동일)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 트레이너 활동 로그 테이블 생성
const createTrainerActivityLogsTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'trainer_activity_logs'
    `;
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE trainer_activity_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          trainer_username VARCHAR(50) NOT NULL,
          member_name VARCHAR(100) NOT NULL,
          app_user_id UUID,
          activity_type VARCHAR(40) NOT NULL CHECK (activity_type IN ('diet_recorded', 'diet_edited', 'diet_deleted', 'diet_comment_added', 'diet_daily_comment_added', 'diet_badge_added', 'workout_recorded', 'workout_edited', 'workout_deleted', 'workout_comment_added')),
          activity_message TEXT NOT NULL,
          related_record_id UUID,
          record_date DATE,
          is_read BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // 인덱스 생성
      await createTrainerActivityLogsIndexes();
      
      console.log('[PostgreSQL] trainer_activity_logs 테이블이 생성되었습니다.');
    } else {
      // 기존 테이블 마이그레이션
      await runMigration(
        'migrate_trainer_activity_logs_20250131',
        '트레이너 활동 로그 테이블에 record_date, app_user_id 컬럼 추가 및 activity_type 길이 확장',
        migrateTrainerActivityLogsTable
      );
      await runMigration(
        'migrate_trainer_activity_logs_activity_type_20260202',
        '트레이너 활동 로그 activity_type에 diet_daily_comment_added 추가',
        migrateTrainerActivityLogsActivityType
      );
      await runMigration(
        'migrate_trainer_activity_logs_activity_type_20260202_badge',
        '트레이너 활동 로그 activity_type에 diet_badge_added 추가',
        migrateTrainerActivityLogsBadgeType
      );
    }
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 활동 로그 테이블 생성 오류:', error);
    throw error;
  }
};

// 기존 테이블 마이그레이션 (record_date 컬럼 추가, activity_type에 diet_comment_added/workout_comment_added 추가, app_user_id 컬럼 추가, activity_type 길이 확장)
const migrateTrainerActivityLogsTable = async () => {
  try {
    // activity_type 컬럼 길이 확장 (workout_comment_added 대비)
    const checkActivityTypeQuery = `
      SELECT character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'trainer_activity_logs'
        AND column_name = 'activity_type'
    `;
    const activityTypeResult = await pool.query(checkActivityTypeQuery);
    const currentLength = activityTypeResult.rows[0]?.character_maximum_length;
    if (currentLength && currentLength < 40) {
      await pool.query(`ALTER TABLE trainer_activity_logs ALTER COLUMN activity_type TYPE VARCHAR(40)`);
      console.log('[PostgreSQL] activity_type 컬럼 길이가 확장되었습니다.');
    }

    // record_date 컬럼 확인 및 추가
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'trainer_activity_logs' 
        AND column_name = 'record_date'
    `;
    const checkResult = await pool.query(checkColumnQuery);
    
    if (checkResult.rows.length === 0) {
      await pool.query(`ALTER TABLE trainer_activity_logs ADD COLUMN record_date DATE`);
      console.log('[PostgreSQL] record_date 컬럼이 추가되었습니다.');
    }
    
    // app_user_id 컬럼 확인 및 추가
    let appUserIdColumnAdded = false;
    const checkAppUserIdQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'trainer_activity_logs' 
        AND column_name = 'app_user_id'
    `;
    const checkAppUserIdResult = await pool.query(checkAppUserIdQuery);
    
    if (checkAppUserIdResult.rows.length === 0) {
      await pool.query(`ALTER TABLE trainer_activity_logs ADD COLUMN app_user_id UUID`);
      console.log('[PostgreSQL] app_user_id 컬럼이 추가되었습니다.');
      appUserIdColumnAdded = true;
    }
    
    // activity_type CHECK 제약조건 확인 및 업데이트 (diet_comment_added/workout_comment_added 추가)
    try {
      // 기존 제약조건 확인 (더 정확한 방법)
      const constraintQuery = `
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'trainer_activity_logs'
          AND constraint_type = 'CHECK'
      `;
      const constraintResult = await pool.query(constraintQuery);
      
      // activity_type 관련 제약조건 찾기
      let activityTypeConstraint = null;
      for (const row of constraintResult.rows) {
        const checkQuery = `
          SELECT check_clause
          FROM information_schema.check_constraints
          WHERE constraint_name = $1
        `;
        const checkResult = await pool.query(checkQuery, [row.constraint_name]);
        if (checkResult.rows.length > 0 && checkResult.rows[0].check_clause && checkResult.rows[0].check_clause.includes('activity_type')) {
          activityTypeConstraint = row.constraint_name;
          break;
        }
      }
      
      if (activityTypeConstraint) {
        // 기존 제약조건 삭제
        await pool.query(`ALTER TABLE trainer_activity_logs DROP CONSTRAINT IF EXISTS ${activityTypeConstraint}`);
        // 새로운 제약조건 추가 (diet_daily_comment_added 포함)
        await pool.query(`
          ALTER TABLE trainer_activity_logs 
          ADD CONSTRAINT trainer_activity_logs_activity_type_check 
          CHECK (activity_type IN ('diet_recorded', 'diet_edited', 'diet_deleted', 'diet_comment_added', 'diet_daily_comment_added', 'diet_badge_added', 'workout_recorded', 'workout_edited', 'workout_deleted', 'workout_comment_added'))
        `);
        console.log('[PostgreSQL] activity_type CHECK 제약조건이 업데이트되었습니다. (diet_badge_added 추가)');
      }
    } catch (constraintError) {
      // 제약조건이 없거나 이미 업데이트된 경우 무시
      console.log('[PostgreSQL] activity_type 제약조건 확인/업데이트:', constraintError.message);
    }
    
    // app_user_id 컬럼이 방금 추가된 경우에만 마이그레이션 실행
    if (appUserIdColumnAdded) {
      await migrateAppUserIdForExistingLogs();
    }
  } catch (error) {
    console.error('[PostgreSQL] trainer_activity_logs 테이블 마이그레이션 오류:', error);
    throw error;
  }
};

// activity_type 제약조건에 diet_daily_comment_added 추가 마이그레이션
const migrateTrainerActivityLogsActivityType = async () => {
  try {
    const constraintQuery = `
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'trainer_activity_logs'
        AND constraint_type = 'CHECK'
    `;
    const constraintResult = await pool.query(constraintQuery);
    
    let activityTypeConstraint = null;
    for (const row of constraintResult.rows) {
      const checkQuery = `
        SELECT check_clause
        FROM information_schema.check_constraints
        WHERE constraint_name = $1
      `;
      const checkResult = await pool.query(checkQuery, [row.constraint_name]);
      if (checkResult.rows.length > 0 && checkResult.rows[0].check_clause && checkResult.rows[0].check_clause.includes('activity_type')) {
        activityTypeConstraint = row.constraint_name;
        break;
      }
    }
    
    if (activityTypeConstraint) {
      const existingCheck = await pool.query(`
        SELECT check_clause
        FROM information_schema.check_constraints
        WHERE constraint_name = $1
      `, [activityTypeConstraint]);
      const checkClause = existingCheck.rows[0]?.check_clause || '';
      if (checkClause.includes('diet_daily_comment_added')) {
        return;
      }
      
      await pool.query(`ALTER TABLE trainer_activity_logs DROP CONSTRAINT IF EXISTS ${activityTypeConstraint}`);
    }
    
    await pool.query(`
      ALTER TABLE trainer_activity_logs 
      ADD CONSTRAINT trainer_activity_logs_activity_type_check 
      CHECK (activity_type IN ('diet_recorded', 'diet_edited', 'diet_deleted', 'diet_comment_added', 'diet_daily_comment_added', 'diet_badge_added', 'workout_recorded', 'workout_edited', 'workout_deleted', 'workout_comment_added'))
    `);
    console.log('[PostgreSQL] activity_type CHECK 제약조건이 업데이트되었습니다. (diet_badge_added 추가)');
  } catch (error) {
    console.error('[PostgreSQL] activity_type 제약조건 마이그레이션 오류:', error);
    throw error;
  }
};

// activity_type 제약조건에 diet_badge_added 추가 마이그레이션
const migrateTrainerActivityLogsBadgeType = async () => {
  try {
    const constraintQuery = `
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'trainer_activity_logs'
        AND constraint_type = 'CHECK'
    `;
    const constraintResult = await pool.query(constraintQuery);
    
    let activityTypeConstraint = null;
    for (const row of constraintResult.rows) {
      const checkQuery = `
        SELECT check_clause
        FROM information_schema.check_constraints
        WHERE constraint_name = $1
      `;
      const checkResult = await pool.query(checkQuery, [row.constraint_name]);
      if (checkResult.rows.length > 0 && checkResult.rows[0].check_clause && checkResult.rows[0].check_clause.includes('activity_type')) {
        activityTypeConstraint = row.constraint_name;
        break;
      }
    }
    
    if (activityTypeConstraint) {
      const existingCheck = await pool.query(`
        SELECT check_clause
        FROM information_schema.check_constraints
        WHERE constraint_name = $1
      `, [activityTypeConstraint]);
      const checkClause = existingCheck.rows[0]?.check_clause || '';
      if (checkClause.includes('diet_badge_added')) {
        return;
      }
      
      await pool.query(`ALTER TABLE trainer_activity_logs DROP CONSTRAINT IF EXISTS ${activityTypeConstraint}`);
    }
    
    await pool.query(`
      ALTER TABLE trainer_activity_logs 
      ADD CONSTRAINT trainer_activity_logs_activity_type_check 
      CHECK (activity_type IN ('diet_recorded', 'diet_edited', 'diet_deleted', 'diet_comment_added', 'diet_daily_comment_added', 'diet_badge_added', 'workout_recorded', 'workout_edited', 'workout_deleted', 'workout_comment_added'))
    `);
    console.log('[PostgreSQL] activity_type CHECK 제약조건이 업데이트되었습니다. (diet_badge_added 추가)');
  } catch (error) {
    console.error('[PostgreSQL] activity_type 제약조건 마이그레이션 오류:', error);
    throw error;
  }
};

// 기존 로그의 app_user_id 마이그레이션 (member_name으로 app_user_id 조회 후 업데이트)
const migrateAppUserIdForExistingLogs = async () => {
  try {
    // app_user_id가 NULL인 로그 조회
    const logsQuery = `
      SELECT DISTINCT member_name, trainer_username
      FROM trainer_activity_logs
      WHERE app_user_id IS NULL
    `;
    const logsResult = await pool.query(logsQuery);
    
    if (logsResult.rows.length === 0) {
      console.log('[PostgreSQL] 마이그레이션할 로그가 없습니다.');
      return;
    }
    
    let updatedCount = 0;
    
    for (const row of logsResult.rows) {
      const { member_name, trainer_username } = row;
      
      // member_name (appUser.name)으로 app_users 테이블에서 조회
      // trainer_username과 매칭되는 회원 찾기
      const appUserQuery = `
        SELECT au.id
        FROM app_users au
        INNER JOIN members m ON au.member_name = m.name
        WHERE au.name = $1
          AND m.trainer = $2
          AND au.member_name IS NOT NULL
        LIMIT 1
      `;
      const appUserResult = await pool.query(appUserQuery, [member_name, trainer_username]);
      
      if (appUserResult.rows.length > 0) {
        const appUserId = appUserResult.rows[0].id;
        
        // 해당 member_name과 trainer_username을 가진 모든 로그 업데이트
        const updateQuery = `
          UPDATE trainer_activity_logs
          SET app_user_id = $1
          WHERE member_name = $2
            AND trainer_username = $3
            AND app_user_id IS NULL
        `;
        const updateResult = await pool.query(updateQuery, [appUserId, member_name, trainer_username]);
        updatedCount += updateResult.rowCount || 0;
      }
    }
    
    if (updatedCount > 0) {
      console.log(`[PostgreSQL] ${updatedCount}개의 기존 로그에 app_user_id가 추가되었습니다.`);
    } else {
      console.log('[PostgreSQL] 마이그레이션할 로그가 없거나 매칭되는 회원을 찾을 수 없습니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] 기존 로그 app_user_id 마이그레이션 오류:', error);
    // 마이그레이션 실패해도 계속 진행
  }
};

// 인덱스 생성
const createTrainerActivityLogsIndexes = async () => {
  try {
    // 트레이너별 최신순 조회를 위한 인덱스
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_trainer_activity_logs_trainer_created 
      ON trainer_activity_logs(trainer_username, created_at DESC)
    `);
    
    // 읽지 않은 로그 조회를 위한 인덱스
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_trainer_activity_logs_trainer_unread 
      ON trainer_activity_logs(trainer_username, is_read, created_at DESC)
    `);
    
    console.log('[PostgreSQL] 트레이너 활동 로그 인덱스가 생성되었습니다.');
  } catch (error) {
    console.error('[PostgreSQL] 트레이너 활동 로그 인덱스 생성 오류:', error);
    throw error;
  }
};

// 활동 로그 추가 (운동기록과 식단기록 모두 매번 로그 생성)
const addActivityLog = async (logData) => {
  try {
    // 로그 추가
    const query = `
      INSERT INTO trainer_activity_logs (
        trainer_username,
        member_name,
        app_user_id,
        activity_type,
        activity_message,
        related_record_id,
        record_date,
        is_read,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() AT TIME ZONE 'Asia/Seoul')
      RETURNING 
        id, trainer_username, member_name, app_user_id, activity_type, activity_message, 
        related_record_id, record_date, is_read, created_at
    `;
    const values = [
      logData.trainer_username,
      logData.member_name,
      logData.app_user_id || null,
      logData.activity_type,
      logData.activity_message,
      logData.related_record_id || null,
      logData.record_date || null,
      false
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 활동 로그 추가 오류:', error);
    throw error;
  }
};

// 트레이너 활동 로그 조회
const getActivityLogs = async (trainerUsername, filters = {}) => {
  try {
    let query = `
      SELECT 
        id,
        trainer_username,
        member_name,
        app_user_id,
        activity_type,
        activity_message,
        related_record_id,
        record_date,
        is_read,
        created_at
      FROM trainer_activity_logs
      WHERE trainer_username = $1
    `;
    const params = [trainerUsername];
    let paramIndex = 2;
    
    // 읽지 않은 로그만 조회
    if (filters.unread_only === true) {
      query += ` AND is_read = false`;
    }
    
    // 날짜 필터
    if (filters.start_date) {
      query += ` AND created_at >= $${paramIndex++}`;
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      query += ` AND created_at <= $${paramIndex++}`;
      params.push(filters.end_date);
    }
    
    // 정렬 (최신순)
    query += ` ORDER BY created_at DESC`;
    
    // 제한
    if (filters.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(filters.limit);
    } else {
      // 기본값: 최신 50개
      query += ` LIMIT $${paramIndex++}`;
      params.push(50);
    }
    
    // 오프셋 (페이지네이션)
    if (filters.offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(filters.offset);
    }
    
    const result = await pool.query(query, params);
    
    // 날짜 정규화
    for (const log of result.rows) {
      if (log.created_at) {
        if (log.created_at instanceof Date) {
          // 이미 Date 객체면 그대로 사용 (Asia/Seoul 시간대로 저장됨)
          log.created_at = log.created_at.toISOString();
        }
      }
    }
    
    return result.rows;
  } catch (error) {
    console.error('[PostgreSQL] 활동 로그 조회 오류:', error);
    throw error;
  }
};

// 읽지 않은 로그 개수 조회
const getUnreadCount = async (trainerUsername) => {
  try {
    const query = `
      SELECT COUNT(*) as count
      FROM trainer_activity_logs
      WHERE trainer_username = $1 AND is_read = false
    `;
    const result = await pool.query(query, [trainerUsername]);
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('[PostgreSQL] 읽지 않은 로그 개수 조회 오류:', error);
    throw error;
  }
};

// 로그 읽음 처리
const markAsRead = async (logId, trainerUsername) => {
  try {
    const query = `
      UPDATE trainer_activity_logs
      SET is_read = true
      WHERE id = $1 AND trainer_username = $2
      RETURNING id, is_read
    `;
    const result = await pool.query(query, [logId, trainerUsername]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] 로그 읽음 처리 오류:', error);
    throw error;
  }
};

// 모든 로그 읽음 처리
const markAllAsRead = async (trainerUsername) => {
  try {
    const query = `
      UPDATE trainer_activity_logs
      SET is_read = true
      WHERE trainer_username = $1 AND is_read = false
    `;
    const result = await pool.query(query, [trainerUsername]);
    return { count: result.rowCount || 0 };
  } catch (error) {
    console.error('[PostgreSQL] 전체 로그 읽음 처리 오류:', error);
    throw error;
  }
};

// 오래된 로그 삭제 (30일 이상 된 읽은 로그)
const cleanOldLogs = async (daysOld = 30) => {
  try {
    const query = `
      DELETE FROM trainer_activity_logs
      WHERE is_read = true 
        AND created_at < NOW() AT TIME ZONE 'Asia/Seoul' - INTERVAL '${daysOld} days'
      RETURNING COUNT(*) as count
    `;
    const result = await pool.query(query);
    const deletedCount = parseInt(result.rows[0]?.count || 0);
    if (deletedCount > 0) {
      console.log(`[PostgreSQL] ${deletedCount}개의 오래된 활동 로그가 삭제되었습니다.`);
    }
    return { deletedCount };
  } catch (error) {
    console.error('[PostgreSQL] 오래된 로그 삭제 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  await createTrainerActivityLogsTable();
};

module.exports = {
  initializeDatabase,
  addActivityLog,
  getActivityLogs,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  cleanOldLogs
};
