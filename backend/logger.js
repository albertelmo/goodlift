/**
 * 로깅 유틸리티
 * 환경 변수로 로그 레벨 제어
 */

const LOG_LEVEL = process.env.LOG_LEVEL || 'info'; // debug, info, warn, error
const ENABLE_DB_INIT_LOGS = process.env.ENABLE_DB_INIT_LOGS === 'true'; // 기본값: false

const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const currentLevel = LEVELS[LOG_LEVEL] || LEVELS.info;

/**
 * DB 초기화 관련 로그 (테이블 생성/존재 확인)
 * 기본적으로 출력하지 않음 (ENABLE_DB_INIT_LOGS=true 일 때만)
 */
const dbInit = (message) => {
  if (ENABLE_DB_INIT_LOGS) {
    console.log(message);
  }
};

/**
 * 디버그 로그
 */
const debug = (message) => {
  if (currentLevel <= LEVELS.debug) {
    console.log(`[DEBUG] ${message}`);
  }
};

/**
 * 정보 로그
 */
const info = (message) => {
  if (currentLevel <= LEVELS.info) {
    console.log(message);
  }
};

/**
 * 경고 로그
 */
const warn = (message) => {
  if (currentLevel <= LEVELS.warn) {
    console.warn(message);
  }
};

/**
 * 에러 로그 (항상 출력)
 */
const error = (message, err) => {
  if (err) {
    console.error(message, err);
  } else {
    console.error(message);
  }
};

module.exports = {
  dbInit,
  debug,
  info,
  warn,
  error
};
