const { Pool } = require('pg');

// PostgreSQL 연결 풀 생성 (기존 DB 모듈 패턴과 동일)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 매출 테이블 생성
const createSalesTable = async () => {
  try {
    // 테이블 존재 여부 확인
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'sales'
    `;
    const checkResult = await pool.query(checkQuery);
    
    // 테이블이 없을 때만 생성
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE sales (
          id SERIAL PRIMARY KEY,
          date DATE NOT NULL,
          member_name VARCHAR(100) NOT NULL,
          is_new BOOLEAN NOT NULL DEFAULT false,
          membership VARCHAR(200),
          payment_method VARCHAR(50),
          amount INTEGER NOT NULL,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      console.log('[PostgreSQL] 매출 테이블이 생성되었습니다.');
    } else {
      console.log('[PostgreSQL] 매출 테이블이 이미 존재합니다.');
      // 기존 테이블에 컬럼 추가 (마이그레이션)
      await addSalesColumnsIfNotExists();
    }
  } catch (error) {
    console.error('[PostgreSQL] 매출 테이블 생성 오류:', error);
  }
};

// 기존 테이블에 컬럼 추가 (마이그레이션)
const addSalesColumnsIfNotExists = async () => {
  try {
    // amount 컬럼의 CHECK 제약조건 제거 (음수 허용)
    try {
      const checkConstraintQuery = `
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'sales' 
          AND constraint_type = 'CHECK'
          AND constraint_name LIKE '%amount%'
      `;
      const constraintResult = await pool.query(checkConstraintQuery);
      
      if (constraintResult.rows.length > 0) {
        const constraintName = constraintResult.rows[0].constraint_name;
        await pool.query(`ALTER TABLE sales DROP CONSTRAINT IF EXISTS ${constraintName}`);
        console.log('[PostgreSQL] amount CHECK 제약조건이 제거되었습니다. (음수 허용)');
      }
    } catch (error) {
      console.log('[PostgreSQL] amount CHECK 제약조건 제거 시도 (이미 없을 수 있음):', error.message);
    }
    
    // is_new 컬럼 확인 및 추가
    const checkIsNewQuery = `
      SELECT column_name 
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'is_new'
    `;
    const checkIsNewResult = await pool.query(checkIsNewQuery);
    
    if (checkIsNewResult.rows.length === 0) {
      await pool.query(`
        ALTER TABLE sales 
        ADD COLUMN is_new BOOLEAN NOT NULL DEFAULT false
      `);
      console.log('[PostgreSQL] is_new 컬럼이 추가되었습니다.');
    }
    
    // membership 컬럼 확인 및 추가
    const checkMembershipQuery = `
      SELECT column_name 
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'membership'
    `;
    const checkMembershipResult = await pool.query(checkMembershipQuery);
    
    if (checkMembershipResult.rows.length === 0) {
      await pool.query(`ALTER TABLE sales ADD COLUMN membership VARCHAR(200)`);
      console.log('[PostgreSQL] membership 컬럼이 추가되었습니다.');
    }
    
    // payment_method 컬럼 확인 및 추가
    const checkPaymentMethodQuery = `
      SELECT column_name 
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'payment_method'
    `;
    const checkPaymentMethodResult = await pool.query(checkPaymentMethodQuery);
    
    if (checkPaymentMethodResult.rows.length === 0) {
      await pool.query(`ALTER TABLE sales ADD COLUMN payment_method VARCHAR(50)`);
      console.log('[PostgreSQL] payment_method 컬럼이 추가되었습니다.');
    }
    
    // notes 컬럼 확인 및 추가
    const checkNotesQuery = `
      SELECT column_name 
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'notes'
    `;
    const checkNotesResult = await pool.query(checkNotesQuery);
    
    if (checkNotesResult.rows.length === 0) {
      await pool.query(`ALTER TABLE sales ADD COLUMN notes TEXT`);
      console.log('[PostgreSQL] notes 컬럼이 추가되었습니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] 컬럼 추가 오류:', error);
  }
};

// 인덱스 생성
const createSalesIndexes = async () => {
  try {
    // date 인덱스 확인 및 생성
    const checkDateIndexQuery = `
      SELECT indexname 
      FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'idx_sales_date'
    `;
    const checkDateResult = await pool.query(checkDateIndexQuery);
    
    if (checkDateResult.rows.length === 0) {
      await pool.query('CREATE INDEX idx_sales_date ON sales(date)');
      console.log('[PostgreSQL] idx_sales_date 인덱스가 생성되었습니다.');
    }
    
    // member_name 인덱스 확인 및 생성
    const checkMemberNameIndexQuery = `
      SELECT indexname 
      FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'idx_sales_member_name'
    `;
    const checkMemberNameResult = await pool.query(checkMemberNameIndexQuery);
    
    if (checkMemberNameResult.rows.length === 0) {
      await pool.query('CREATE INDEX idx_sales_member_name ON sales(member_name)');
      console.log('[PostgreSQL] idx_sales_member_name 인덱스가 생성되었습니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] 인덱스 생성 오류:', error);
  }
};

// 매출 내역 추가
const addSale = async (saleData) => {
  try {
    const query = `
      INSERT INTO sales (date, member_name, is_new, membership, payment_method, amount, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, date, member_name, is_new, membership, payment_method, amount, notes, created_at, updated_at
    `;
    const values = [
      saleData.date,
      saleData.memberName,
      saleData.isNew !== undefined ? saleData.isNew : false,
      saleData.membership || null,
      saleData.paymentMethod || null,
      saleData.amount,
      saleData.notes || null
    ];
    
    const result = await pool.query(query, values);
    
    const row = result.rows[0];
    // 날짜를 문자열로 변환 (YYYY-MM-DD 형식, 타임존 변환 방지)
    let dateStr = '';
    if (row.date) {
      if (typeof row.date === 'string') {
        dateStr = row.date.split('T')[0];
      } else {
        const date = new Date(row.date);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      }
    }
    
    return {
      id: row.id,
      date: dateStr,
      memberName: row.member_name,
      isNew: row.is_new,
      membership: row.membership || null,
      paymentMethod: row.payment_method || null,
      amount: row.amount,
      notes: row.notes || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } catch (error) {
    console.error('[PostgreSQL] 매출 내역 추가 오류:', error);
    throw error;
  }
};

// 매출 내역 조회 (필터링 지원)
const getSales = async (filters = {}) => {
  try {
    let query = `
      SELECT id, date, member_name, is_new, membership, payment_method, amount, notes, created_at, updated_at
      FROM sales
    `;
    const params = [];
    let paramIndex = 1;
    const conditions = [];
    
    // 필터 조건 추가
    if (filters.startDate) {
      conditions.push(`date >= $${paramIndex++}`);
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      conditions.push(`date <= $${paramIndex++}`);
      params.push(filters.endDate);
    }
    
    if (filters.memberName) {
      conditions.push(`member_name ILIKE $${paramIndex++}`);
      params.push(`%${filters.memberName}%`);
    }
    
    if (filters.isNew !== undefined) {
      conditions.push(`is_new = $${paramIndex++}`);
      params.push(filters.isNew);
    }
    
    if (filters.membership) {
      conditions.push(`membership ILIKE $${paramIndex++}`);
      params.push(`%${filters.membership}%`);
    }
    
    if (filters.paymentMethod) {
      conditions.push(`payment_method = $${paramIndex++}`);
      params.push(filters.paymentMethod);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    // 정렬: 날짜 내림차순 (최신순)
    query += ' ORDER BY date DESC, id DESC';
    
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
    return result.rows.map(row => {
      // 날짜를 문자열로 변환 (YYYY-MM-DD 형식, 타임존 변환 방지)
      let dateStr = '';
      if (row.date) {
        if (typeof row.date === 'string') {
          dateStr = row.date.split('T')[0]; // ISO 형식에서 날짜 부분만 추출
        } else {
          // Date 객체인 경우 로컬 시간 기준으로 변환
          const date = new Date(row.date);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          dateStr = `${year}-${month}-${day}`;
        }
      }
      
      return {
        id: row.id,
        date: dateStr,
        memberName: row.member_name,
        isNew: row.is_new,
        membership: row.membership || null,
        paymentMethod: row.payment_method || null,
        amount: row.amount,
        notes: row.notes || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    });
  } catch (error) {
    console.error('[PostgreSQL] 매출 내역 조회 오류:', error);
    throw error;
  }
};

// 매출 내역 수정
const updateSale = async (id, saleData) => {
  try {
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (saleData.date !== undefined) {
      updates.push(`date = $${paramIndex++}`);
      values.push(saleData.date);
    }
    if (saleData.memberName !== undefined) {
      updates.push(`member_name = $${paramIndex++}`);
      values.push(saleData.memberName);
    }
    if (saleData.isNew !== undefined) {
      updates.push(`is_new = $${paramIndex++}`);
      values.push(saleData.isNew);
    }
    if (saleData.membership !== undefined) {
      updates.push(`membership = $${paramIndex++}`);
      values.push(saleData.membership || null);
    }
    if (saleData.paymentMethod !== undefined) {
      updates.push(`payment_method = $${paramIndex++}`);
      values.push(saleData.paymentMethod || null);
    }
    if (saleData.amount !== undefined) {
      updates.push(`amount = $${paramIndex++}`);
      values.push(saleData.amount);
    }
    if (saleData.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(saleData.notes || null);
    }
    
    if (updates.length === 0) {
      throw new Error('수정할 필드가 없습니다.');
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    
    const query = `
      UPDATE sales 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, date, member_name, is_new, membership, payment_method, amount, notes, created_at, updated_at
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('매출 내역을 찾을 수 없습니다.');
    }
    
    const row = result.rows[0];
    // 날짜를 문자열로 변환 (YYYY-MM-DD 형식, 타임존 변환 방지)
    let dateStr = '';
    if (row.date) {
      if (typeof row.date === 'string') {
        dateStr = row.date.split('T')[0];
      } else {
        const date = new Date(row.date);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      }
    }
    
    return {
      id: row.id,
      date: dateStr,
      memberName: row.member_name,
      isNew: row.is_new,
      membership: row.membership || null,
      paymentMethod: row.payment_method || null,
      amount: row.amount,
      notes: row.notes || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } catch (error) {
    console.error('[PostgreSQL] 매출 내역 수정 오류:', error);
    throw error;
  }
};

// 매출 내역 삭제
const deleteSale = async (id) => {
  try {
    const query = 'DELETE FROM sales WHERE id = $1 RETURNING id, member_name, amount';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('매출 내역을 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[PostgreSQL] 매출 내역 삭제 오류:', error);
    throw error;
  }
};

// 매출 내역 전체 삭제
const deleteAllSales = async () => {
  try {
    const query = 'DELETE FROM sales RETURNING id';
    const result = await pool.query(query);
    
    return {
      deletedCount: result.rows.length
    };
  } catch (error) {
    console.error('[PostgreSQL] 매출 내역 전체 삭제 오류:', error);
    throw error;
  }
};

// 매출 내역 ID로 조회
const getSaleById = async (id) => {
  try {
    const query = `
      SELECT id, date, member_name, is_new, membership, payment_method, amount, notes, created_at, updated_at
      FROM sales 
      WHERE id = $1
    `;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      date: row.date,
      memberName: row.member_name,
      isNew: row.is_new,
      membership: row.membership || null,
      paymentMethod: row.payment_method || null,
      amount: row.amount,
      notes: row.notes || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } catch (error) {
    console.error('[PostgreSQL] 매출 내역 ID 조회 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  try {
    await createSalesTable();
    await createSalesIndexes();
    console.log('[PostgreSQL] 매출 데이터베이스 초기화 완료');
  } catch (error) {
    console.error('[PostgreSQL] 매출 데이터베이스 초기화 오류:', error);
  }
};

// 월별 매출 목록 조회 (연도별)
const getSalesByMonth = async (year) => {
  try {
    const query = `
      SELECT 
        TO_CHAR(date, 'YYYY-MM') as year_month,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM sales
      WHERE EXTRACT(YEAR FROM date) = $1
      GROUP BY TO_CHAR(date, 'YYYY-MM')
      ORDER BY year_month DESC
    `;
    const result = await pool.query(query, [year]);
    
    return result.rows.map(row => ({
      yearMonth: row.year_month,
      count: parseInt(row.count) || 0,
      totalAmount: parseInt(row.total_amount) || 0
    }));
  } catch (error) {
    console.error('[PostgreSQL] 월별 매출 목록 조회 오류:', error);
    throw error;
  }
};

module.exports = {
  initializeDatabase,
  addSale,
  getSales,
  getSalesByMonth,
  updateSale,
  deleteSale,
  deleteAllSales,
  getSaleById
};
