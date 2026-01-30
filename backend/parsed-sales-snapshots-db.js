const { Pool } = require('pg');
const { runMigration } = require('./migrations-manager');

// PostgreSQL 연결 풀 생성
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 테이블 생성 및 마이그레이션
const createParsedSalesSnapshotsTable = async () => {
  try {
    // 테이블 존재 여부 확인
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'parsed_sales_snapshots'
    `;
    const checkResult = await pool.query(checkQuery);
    
    // 테이블이 없을 때만 생성
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE parsed_sales_snapshots (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          center VARCHAR(100) NOT NULL,
          year_month VARCHAR(7) NOT NULL,
          member_name VARCHAR(100) NOT NULL,
          phone VARCHAR(20) NOT NULL,
          sales_names TEXT[],
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // UNIQUE 인덱스 생성 (센터, 연월, 회원 이름, 연락처 조합)
      await pool.query(`
        CREATE UNIQUE INDEX idx_parsed_sales_snapshots_unique 
        ON parsed_sales_snapshots(center, year_month, member_name, phone)
      `);
      
      // 조회용 인덱스 생성
      await pool.query(`
        CREATE INDEX idx_parsed_sales_snapshots_center_year_month 
        ON parsed_sales_snapshots(center, year_month)
      `);
      await pool.query(`
        CREATE INDEX idx_parsed_sales_snapshots_year_month 
        ON parsed_sales_snapshots(year_month)
      `);
      
      console.log('[PostgreSQL] Parsed Sales Snapshots 테이블이 생성되었습니다.');
    } else {
      // 기존 테이블 마이그레이션
      await runMigration(
        'migrate_parsed_sales_snapshots_20250131',
        'Parsed Sales Snapshots 테이블 마이그레이션',
        migrateParsedSalesSnapshotsTable
      );
    }
  } catch (error) {
    console.error('[PostgreSQL] Parsed Sales Snapshots 테이블 생성 오류:', error);
  }
};

// 마이그레이션 함수
const migrateParsedSalesSnapshotsTable = async () => {
  try {
    // UNIQUE 인덱스 존재 여부 확인 및 생성
    const checkUniqueIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'parsed_sales_snapshots' 
      AND indexname = 'idx_parsed_sales_snapshots_unique'
    `;
    const uniqueIndexResult = await pool.query(checkUniqueIndexQuery);
    
    if (uniqueIndexResult.rows.length === 0) {
      // UNIQUE 인덱스 생성
      await pool.query(`
        CREATE UNIQUE INDEX idx_parsed_sales_snapshots_unique 
        ON parsed_sales_snapshots(center, year_month, member_name, phone)
      `);
      console.log('[PostgreSQL] Parsed Sales Snapshots 테이블에 UNIQUE 인덱스가 추가되었습니다.');
    }
    
    // 조회용 인덱스 확인 및 생성
    const checkCenterYearMonthIndex = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'parsed_sales_snapshots' 
      AND indexname = 'idx_parsed_sales_snapshots_center_year_month'
    `);
    if (checkCenterYearMonthIndex.rows.length === 0) {
      await pool.query(`
        CREATE INDEX idx_parsed_sales_snapshots_center_year_month 
        ON parsed_sales_snapshots(center, year_month)
      `);
      console.log('[PostgreSQL] Parsed Sales Snapshots 테이블에 center_year_month 인덱스가 추가되었습니다.');
    }
    
    const checkYearMonthIndex = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'parsed_sales_snapshots' 
      AND indexname = 'idx_parsed_sales_snapshots_year_month'
    `);
    if (checkYearMonthIndex.rows.length === 0) {
      await pool.query(`
        CREATE INDEX idx_parsed_sales_snapshots_year_month 
        ON parsed_sales_snapshots(year_month)
      `);
      console.log('[PostgreSQL] Parsed Sales Snapshots 테이블에 year_month 인덱스가 추가되었습니다.');
    }
    
  } catch (error) {
    console.error('[PostgreSQL] Parsed Sales Snapshots 테이블 마이그레이션 오류:', error);
  }
};

// 스냅샷 저장 (센터/연월별로 기존 데이터 삭제 후 재생성)
const saveSnapshot = async (center, yearMonth, sales) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 기존 스냅샷 삭제
    await client.query(
      'DELETE FROM parsed_sales_snapshots WHERE center = $1 AND year_month = $2',
      [center, yearMonth]
    );
    
    // 새 스냅샷 저장
    let savedCount = 0;
    for (const sale of sales) {
      const query = `
        INSERT INTO parsed_sales_snapshots (
          center, year_month, member_name, phone, sales_names
        )
        VALUES ($1, $2, $3, $4, $5)
      `;
      const values = [
        center,
        yearMonth,
        sale.memberName || '',
        sale.phone || '',
        sale.salesNames || []
      ];
      
      await client.query(query, values);
      savedCount++;
    }
    
    // 같은 달의 회원정보에서 이름/연락처가 일치하는 회원의 상태를 "재등록"으로 업데이트
    for (const sale of sales) {
      const memberName = sale.memberName || '';
      const phone = sale.phone || '';
      
      if (memberName && phone) {
        // 같은 센터, 같은 연월, 같은 이름, 같은 연락처를 가진 회원 찾아서 상태 업데이트
        await client.query(
          `UPDATE parsed_member_snapshots 
           SET status = '재등록', updated_at = CURRENT_TIMESTAMP
           WHERE center = $1 
           AND year_month = $2 
           AND member_name = $3 
           AND phone = $4`,
          [center, yearMonth, memberName, phone]
        );
      }
    }
    
    await client.query('COMMIT');
    return { savedCount };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[PostgreSQL] 매출정보 스냅샷 저장 오류:', error);
    throw error;
  } finally {
    client.release();
  }
};

// 스냅샷 조회
const getSnapshot = async (center, yearMonth) => {
  try {
    let query = `
      SELECT 
        center, year_month, member_name, phone, sales_names,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        updated_at AT TIME ZONE 'Asia/Seoul' as updated_at
      FROM parsed_sales_snapshots
      WHERE year_month = $1
    `;
    const params = [yearMonth];
    
    if (center) {
      query += ' AND center = $2';
      params.push(center);
    }
    
    query += ' ORDER BY member_name';
    
    const result = await pool.query(query, params);
    
    const sales = result.rows.map(row => ({
      memberName: row.member_name,
      phone: row.phone || '',
      salesNames: row.sales_names || []
    }));
    
    return {
      center: center || null,
      yearMonth,
      sales,
      total: sales.length
    };
  } catch (error) {
    console.error('[PostgreSQL] 매출정보 스냅샷 조회 오류:', error);
    throw error;
  }
};

// 스냅샷 목록 조회
const getSnapshotList = async (filters = {}) => {
  try {
    let query = `
      SELECT 
        center, year_month, COUNT(*) as sales_count,
        MIN(created_at AT TIME ZONE 'Asia/Seoul') as created_at
      FROM parsed_sales_snapshots
    `;
    const params = [];
    let paramIndex = 1;
    const conditions = [];
    
    if (filters.center) {
      conditions.push(`center = $${paramIndex++}`);
      params.push(filters.center);
    }
    if (filters.yearMonth) {
      conditions.push(`year_month = $${paramIndex++}`);
      params.push(filters.yearMonth);
    }
    if (filters.year) {
      // 연도별 필터링 (year_month가 해당 연도로 시작)
      conditions.push(`year_month LIKE $${paramIndex++}`);
      params.push(`${filters.year}-%`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' GROUP BY center, year_month ORDER BY year_month DESC, center';
    
    const result = await pool.query(query, params);
    
    return result.rows.map(row => ({
      center: row.center,
      yearMonth: row.year_month,
      salesCount: parseInt(row.sales_count) || 0,
      createdAt: row.created_at
    }));
  } catch (error) {
    console.error('[PostgreSQL] 매출정보 스냅샷 목록 조회 오류:', error);
    throw error;
  }
};

// 스냅샷 삭제
const deleteSnapshot = async (center, yearMonth) => {
  try {
    const query = `
      DELETE FROM parsed_sales_snapshots 
      WHERE center = $1 AND year_month = $2
      RETURNING id
    `;
    const result = await pool.query(query, [center, yearMonth]);
    
    return { deletedCount: result.rows.length };
  } catch (error) {
    console.error('[PostgreSQL] 매출정보 스냅샷 삭제 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  await createParsedSalesSnapshotsTable();
};

module.exports = {
  initializeDatabase,
  saveSnapshot,
  getSnapshot,
  getSnapshotList,
  deleteSnapshot
};
