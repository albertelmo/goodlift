// 성능 최적화를 위한 인덱스 생성 마이그레이션
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const createPerformanceIndexes = async () => {
  const indexes = [
    {
      name: 'idx_workout_records_user_date',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workout_records_user_date 
            ON workout_records(app_user_id, workout_date DESC)`
    },
    {
      name: 'idx_diet_records_user_date',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_diet_records_user_date 
            ON diet_records(app_user_id, meal_date DESC)`
    },
    {
      name: 'idx_members_trainer',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_trainer 
            ON members(trainer)`
    },
    {
      name: 'idx_members_name',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_name 
            ON members(name)`
    },
    {
      name: 'idx_consultation_records_name_date',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consultation_records_name_date 
            ON consultation_records(name, created_at DESC)`
    },
    {
      name: 'idx_workout_record_sets_record_id',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workout_record_sets_record_id
            ON workout_record_sets(workout_record_id)`
    },
    {
      name: 'idx_diet_comments_record_id',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_diet_comments_record_id
            ON diet_comments(diet_record_id)`
    },
    {
      name: 'idx_app_users_username',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_users_username
            ON app_users(username)`
    },
    {
      name: 'idx_app_users_phone',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_users_phone
            ON app_users(phone)`
    },
    {
      name: 'idx_app_users_member_name',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_users_member_name
            ON app_users(member_name)`
    },
    {
      name: 'idx_trainer_activity_logs_trainer_created',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trainer_activity_logs_trainer_created
            ON trainer_activity_logs(trainer_username, created_at DESC)`
    },
    {
      name: 'idx_member_activity_logs_trainer_created',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_member_activity_logs_trainer_created
            ON member_activity_logs(trainer_username, created_at DESC)`
    },
    {
      name: 'idx_consultation_share_tokens_record_id',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consultation_share_tokens_record_id
            ON consultation_share_tokens(consultation_record_id)`
    }
  ];

  console.log('📊 [인덱스] 성능 최적화 인덱스 생성 시작...');
  
  for (const index of indexes) {
    try {
      await pool.query(index.sql);
      console.log(`   ✓ ${index.name}`);
    } catch (error) {
      // 이미 존재하는 인덱스는 조용히 스킵
      if (error.code === '42P07') {
        // console.log(`   - ${index.name} (이미 존재)`);
      } else {
        console.error(`   ✗ ${index.name} 오류:`, error.message);
      }
    }
  }

  // 통계 정보 업데이트
  const tables = [
    'workout_records', 'diet_records', 'members', 'consultation_records',
    'workout_record_sets', 'diet_comments', 'app_users',
    'trainer_activity_logs', 'member_activity_logs', 'consultation_share_tokens'
  ];

  console.log('📊 [인덱스] 통계 정보 업데이트 중...');
  for (const table of tables) {
    try {
      await pool.query(`ANALYZE ${table}`);
    } catch (error) {
      // 테이블이 없으면 조용히 스킵
      if (error.code !== '42P01') {
        console.error(`   ✗ ${table} ANALYZE 오류:`, error.message);
      }
    }
  }

  console.log('✅ [인덱스] 성능 최적화 인덱스 생성 완료');
};

module.exports = {
  createPerformanceIndexes
};
