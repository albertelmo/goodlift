const { Pool } = require('pg');

// PostgreSQL 연결 풀 생성 (기존 DB 모듈 패턴과 동일)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 지출 내역 테이블 생성
const createExpensesTable = async () => {
  try {
    // 테이블 존재 여부 확인 (최초에는 생성, 이후에는 생성 과정 생략)
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'expenses'
    `;
    const checkResult = await pool.query(checkQuery);
    
    // 테이블이 없을 때만 생성
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE expenses (
          id SERIAL PRIMARY KEY,
          trainer VARCHAR(100) NOT NULL,
          amount INTEGER NOT NULL CHECK (amount >= 0),
          datetime TIMESTAMP NOT NULL,
          participant_trainers TEXT[] NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      console.log('[PostgreSQL] 지출 내역 테이블이 생성되었습니다.');
    } else {
      console.log('[PostgreSQL] 지출 내역 테이블이 이미 존재합니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] 지출 내역 테이블 생성 오류:', error);
  }
};

// 인덱스 생성
const createExpensesIndexes = async () => {
  try {
    // trainer 인덱스 확인 및 생성
    const checkTrainerIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND indexname = 'idx_expenses_trainer'
    `;
    const checkTrainerResult = await pool.query(checkTrainerIndexQuery);
    
    if (checkTrainerResult.rows.length === 0) {
      await pool.query('CREATE INDEX idx_expenses_trainer ON expenses(trainer)');
      console.log('[PostgreSQL] idx_expenses_trainer 인덱스가 생성되었습니다.');
    }
    
    // datetime 인덱스 확인 및 생성
    const checkDateTimeIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND indexname = 'idx_expenses_datetime'
    `;
    const checkDateTimeResult = await pool.query(checkDateTimeIndexQuery);
    
    if (checkDateTimeResult.rows.length === 0) {
      await pool.query('CREATE INDEX idx_expenses_datetime ON expenses(datetime)');
      console.log('[PostgreSQL] idx_expenses_datetime 인덱스가 생성되었습니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] 인덱스 생성 오류:', error);
  }
};

// 지출 내역 추가
const addExpense = async (expenseData) => {
  try {
    const query = `
      INSERT INTO expenses (trainer, amount, datetime, participant_trainers)
      VALUES ($1, $2, $3, $4)
      RETURNING id, trainer, amount, datetime, participant_trainers, created_at, updated_at
    `;
    const values = [
      expenseData.trainer,
      expenseData.amount,
      expenseData.datetime, // TIMESTAMP 형식 (YYYY-MM-DD HH:mm:ss)
      expenseData.participantTrainers // TEXT[] 배열
    ];
    const result = await pool.query(query, values);
    
    const row = result.rows[0];
    return {
      id: row.id,
      trainer: row.trainer,
      amount: row.amount,
      datetime: row.datetime,
      participantTrainers: row.participant_trainers,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } catch (error) {
    console.error('[PostgreSQL] 지출 내역 추가 오류:', error);
    throw error;
  }
};

// 지출 내역 조회 (필터링 지원)
const getExpenses = async (filters = {}) => {
  try {
    let query = `
      SELECT id, trainer, amount, datetime, participant_trainers, created_at, updated_at
      FROM expenses
    `;
    const params = [];
    let paramIndex = 1;
    const conditions = [];
    
    // 필터 조건 추가
    if (filters.trainer) {
      conditions.push(`trainer = $${paramIndex++}`);
      params.push(filters.trainer);
    }
    
    if (filters.startDate) {
      conditions.push(`datetime >= $${paramIndex++}`);
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      conditions.push(`datetime <= $${paramIndex++}`);
      // 종료일은 하루 끝까지 포함 (23:59:59)
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      params.push(endDate.toISOString());
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    // 정렬: 최신순 (datetime DESC)
    query += ' ORDER BY datetime DESC';
    
    // 페이지네이션 (선택 사항)
    if (filters.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(filters.limit);
    }
    
    if (filters.offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(filters.offset);
    }
    
    const result = await pool.query(query, params);
    
    // camelCase로 변환
    return result.rows.map(row => ({
      id: row.id,
      trainer: row.trainer,
      amount: row.amount,
      datetime: row.datetime,
      participantTrainers: row.participant_trainers,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  } catch (error) {
    console.error('[PostgreSQL] 지출 내역 조회 오류:', error);
    throw error;
  }
};

// 지출 내역 삭제 (관리자용)
const deleteExpense = async (id) => {
  try {
    const query = 'DELETE FROM expenses WHERE id = $1 RETURNING id, trainer, amount';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('지출 내역을 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 지출 내역 삭제 오류:', error);
    throw error;
  }
};

// 지출 내역 ID로 조회
const getExpenseById = async (id) => {
  try {
    const query = `
      SELECT id, trainer, amount, datetime, participant_trainers, created_at, updated_at
      FROM expenses 
      WHERE id = $1
    `;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      trainer: row.trainer,
      amount: row.amount,
      datetime: row.datetime,
      participantTrainers: row.participant_trainers,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } catch (error) {
    console.error('[PostgreSQL] 지출 내역 ID 조회 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  try {
    await createExpensesTable();
    await createExpensesIndexes();
    console.log('[PostgreSQL] 지출 내역 데이터베이스 초기화 완료');
  } catch (error) {
    console.error('[PostgreSQL] 지출 내역 데이터베이스 초기화 오류:', error);
  }
};

module.exports = {
  initializeDatabase,
  addExpense,
  getExpenses,
  deleteExpense,
  getExpenseById
};

