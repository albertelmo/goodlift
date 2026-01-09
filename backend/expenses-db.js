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
          expense_type VARCHAR(20) NOT NULL CHECK (expense_type IN ('meal', 'purchase')),
          amount INTEGER NOT NULL CHECK (amount >= 0),
          datetime TIMESTAMP NOT NULL,
          participant_trainers TEXT[],
          purchase_item VARCHAR(200),
          center VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      console.log('[PostgreSQL] 지출 내역 테이블이 생성되었습니다.');
    } else {
      console.log('[PostgreSQL] 지출 내역 테이블이 이미 존재합니다.');
      // 기존 테이블에 컬럼 추가 (마이그레이션)
      await addExpenseColumnsIfNotExists();
    }
  } catch (error) {
    console.error('[PostgreSQL] 지출 내역 테이블 생성 오류:', error);
  }
};

// 기존 테이블에 컬럼 추가 (마이그레이션)
const addExpenseColumnsIfNotExists = async () => {
  try {
    // expense_type 컬럼 확인 및 추가
    const checkExpenseTypeQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'expense_type'
    `;
    const checkExpenseTypeResult = await pool.query(checkExpenseTypeQuery);
    
    if (checkExpenseTypeResult.rows.length === 0) {
      await pool.query(`
        ALTER TABLE expenses 
        ADD COLUMN expense_type VARCHAR(20) CHECK (expense_type IN ('meal', 'purchase'))
      `);
      // 기존 데이터는 모두 'meal'로 설정
      await pool.query(`UPDATE expenses SET expense_type = 'meal' WHERE expense_type IS NULL`);
      // NOT NULL 제약조건 추가
      await pool.query(`ALTER TABLE expenses ALTER COLUMN expense_type SET NOT NULL`);
      console.log('[PostgreSQL] expense_type 컬럼이 추가되었습니다.');
    }
    
    // purchase_item 컬럼 확인 및 추가
    const checkPurchaseItemQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'purchase_item'
    `;
    const checkPurchaseItemResult = await pool.query(checkPurchaseItemQuery);
    
    if (checkPurchaseItemResult.rows.length === 0) {
      await pool.query(`ALTER TABLE expenses ADD COLUMN purchase_item VARCHAR(200)`);
      console.log('[PostgreSQL] purchase_item 컬럼이 추가되었습니다.');
    }
    
    // center 컬럼 확인 및 추가
    const checkCenterQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'center'
    `;
    const checkCenterResult = await pool.query(checkCenterQuery);
    
    if (checkCenterResult.rows.length === 0) {
      await pool.query(`ALTER TABLE expenses ADD COLUMN center VARCHAR(100)`);
      console.log('[PostgreSQL] center 컬럼이 추가되었습니다.');
    }
    
    // participant_trainers를 NULL 허용으로 변경 (구매일 때는 NULL)
    const checkParticipantTrainersQuery = `
      SELECT is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'participant_trainers'
    `;
    const checkParticipantTrainersResult = await pool.query(checkParticipantTrainersQuery);
    
    if (checkParticipantTrainersResult.rows.length > 0 && checkParticipantTrainersResult.rows[0].is_nullable === 'NO') {
      await pool.query(`ALTER TABLE expenses ALTER COLUMN participant_trainers DROP NOT NULL`);
      console.log('[PostgreSQL] participant_trainers 컬럼이 NULL 허용으로 변경되었습니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] 컬럼 추가 오류:', error);
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
    const expenseType = expenseData.expenseType || 'meal'; // 기본값: meal
    
    let query, values;
    
    if (expenseType === 'meal') {
      // 식대: participant_trainers 필수
      query = `
        INSERT INTO expenses (trainer, expense_type, amount, datetime, participant_trainers)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, trainer, expense_type, amount, datetime, participant_trainers, purchase_item, center, created_at, updated_at
      `;
      values = [
        expenseData.trainer,
        expenseType,
        expenseData.amount,
        expenseData.datetime,
        expenseData.participantTrainers || []
      ];
    } else {
      // 구매: purchase_item, center 필수
      query = `
        INSERT INTO expenses (trainer, expense_type, amount, datetime, purchase_item, center)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, trainer, expense_type, amount, datetime, participant_trainers, purchase_item, center, created_at, updated_at
      `;
      values = [
        expenseData.trainer,
        expenseType,
        expenseData.amount,
        expenseData.datetime,
        expenseData.purchaseItem,
        expenseData.center
      ];
    }
    
    const result = await pool.query(query, values);
    
    const row = result.rows[0];
    return {
      id: row.id,
      trainer: row.trainer,
      expenseType: row.expense_type,
      amount: row.amount,
      datetime: row.datetime,
      participantTrainers: row.participant_trainers || [],
      purchaseItem: row.purchase_item || null,
      center: row.center || null,
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
      SELECT id, trainer, expense_type, amount, datetime, participant_trainers, purchase_item, center, created_at, updated_at
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
      expenseType: row.expense_type,
      amount: row.amount,
      datetime: row.datetime,
      participantTrainers: row.participant_trainers || [],
      purchaseItem: row.purchase_item || null,
      center: row.center || null,
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
      SELECT id, trainer, expense_type, amount, datetime, participant_trainers, purchase_item, center, created_at, updated_at
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
      expenseType: row.expense_type,
      amount: row.amount,
      datetime: row.datetime,
      participantTrainers: row.participant_trainers || [],
      purchaseItem: row.purchase_item || null,
      center: row.center || null,
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

