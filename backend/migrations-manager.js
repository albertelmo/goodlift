const { Pool } = require('pg');

// PostgreSQL 연결 풀 생성
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * 마이그레이션 추적 테이블 생성
 */
const createMigrationsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        description TEXT,
        execution_time_ms INTEGER
      )
    `;
    await pool.query(query);
    
    // 인덱스 생성 (중복 체크 성능 향상)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_migrations_name 
      ON migrations(migration_name)
    `);
    
    console.log('[Migrations] 마이그레이션 추적 테이블이 준비되었습니다.');
  } catch (error) {
    console.error('[Migrations] 추적 테이블 생성 오류:', error);
    throw error;
  }
};

/**
 * 마이그레이션이 이미 실행되었는지 확인
 * @param {string} migrationName - 마이그레이션 고유 이름
 * @returns {Promise<boolean>} 실행 여부
 */
const checkMigrationExecuted = async (migrationName) => {
  try {
    const query = `
      SELECT EXISTS(
        SELECT 1 FROM migrations WHERE migration_name = $1
      ) as executed
    `;
    const result = await pool.query(query, [migrationName]);
    return result.rows[0].executed;
  } catch (error) {
    // 테이블이 아직 없는 경우 (최초 실행)
    if (error.code === '42P01') { // undefined_table
      await createMigrationsTable();
      return false;
    }
    console.error('[Migrations] 마이그레이션 확인 오류:', error);
    throw error;
  }
};

/**
 * 마이그레이션 실행 기록 저장
 * @param {string} migrationName - 마이그레이션 고유 이름
 * @param {string} description - 마이그레이션 설명
 * @param {number} executionTimeMs - 실행 시간 (밀리초)
 */
const recordMigration = async (migrationName, description = '', executionTimeMs = 0) => {
  try {
    const query = `
      INSERT INTO migrations (migration_name, description, execution_time_ms)
      VALUES ($1, $2, $3)
      ON CONFLICT (migration_name) DO NOTHING
    `;
    await pool.query(query, [migrationName, description, executionTimeMs]);
    console.log(`[Migrations] ✓ ${migrationName} 기록됨 (${executionTimeMs}ms)`);
  } catch (error) {
    console.error('[Migrations] 마이그레이션 기록 오류:', error);
    throw error;
  }
};

/**
 * 마이그레이션 실행 래퍼
 * @param {string} migrationName - 마이그레이션 고유 이름
 * @param {string} description - 마이그레이션 설명
 * @param {Function} migrationFunc - 실행할 마이그레이션 함수
 * @returns {Promise<boolean>} 실행 여부 (true: 실행됨, false: 스킵됨)
 */
const runMigration = async (migrationName, description, migrationFunc) => {
  try {
    // 이미 실행되었는지 확인
    const alreadyExecuted = await checkMigrationExecuted(migrationName);
    
    if (alreadyExecuted) {
      // 조용히 스킵 (로그 없음)
      return false;
    }
    
    console.log(`[Migrations] 실행 중: ${migrationName}`);
    const startTime = Date.now();
    
    // 마이그레이션 실행
    await migrationFunc();
    
    const executionTime = Date.now() - startTime;
    
    // 실행 기록 저장
    await recordMigration(migrationName, description, executionTime);
    
    return true;
  } catch (error) {
    console.error(`[Migrations] ${migrationName} 실행 오류:`, error);
    throw error;
  }
};

/**
 * 마이그레이션 이력 조회
 * @param {number} limit - 조회할 개수 (기본값: 50)
 * @returns {Promise<Array>} 마이그레이션 이력
 */
const getMigrationHistory = async (limit = 50) => {
  try {
    const query = `
      SELECT 
        id,
        migration_name,
        description,
        executed_at,
        execution_time_ms
      FROM migrations
      ORDER BY executed_at DESC
      LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    return result.rows;
  } catch (error) {
    console.error('[Migrations] 이력 조회 오류:', error);
    return [];
  }
};

/**
 * 모든 실행된 마이그레이션 이름 목록 조회
 * @returns {Promise<Array<string>>} 마이그레이션 이름 배열
 */
const getAllExecutedMigrations = async () => {
  try {
    const query = `
      SELECT migration_name
      FROM migrations
      ORDER BY executed_at ASC
    `;
    const result = await pool.query(query);
    return result.rows.map(row => row.migration_name);
  } catch (error) {
    console.error('[Migrations] 실행된 마이그레이션 조회 오류:', error);
    return [];
  }
};

/**
 * 초기화: 마이그레이션 추적 시스템 설정
 */
const initializeMigrationSystem = async () => {
  try {
    await createMigrationsTable();
  } catch (error) {
    console.error('[Migrations] 시스템 초기화 오류:', error);
  }
};

module.exports = {
  initializeMigrationSystem,
  runMigration,
  checkMigrationExecuted,
  recordMigration,
  getMigrationHistory,
  getAllExecutedMigrations
};
