# Database 탭 - 파싱 데이터 DB 저장 설계

## 1. 개요
Database 탭에서 파싱된 회원 정보를 PostgreSQL에 저장하고, 센터/연도/월별로 조회할 수 있도록 설계

## 2. 데이터 구조 분석

### 현재 파싱된 회원 정보 구조
```javascript
{
  name: string,              // 회원 이름 (필수)
  phone: string,             // 연락처
  status: string,            // 회원상태: "유효" | "만료"
  recentVisit: string,       // 최근방문일 (YYYY-MM-DD 형식)
  productNames: string[],    // 상품명 배열 (예: ["3개월", "6개월"])
  productPeriodMap: {        // 상품명별 기간 맵 (예: {"3개월": "3", "6개월": "6"})
    [productName]: string
  },
  totalPeriod: string        // 전체기간 (문자열, 예: "9")
}
```

## 3. 데이터베이스 설계

### 3.1 테이블: `parsed_member_snapshots`
파싱된 회원 정보 스냅샷을 저장하는 테이블

```sql
CREATE TABLE parsed_member_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center VARCHAR(100) NOT NULL,              -- 센터명
  year_month VARCHAR(7) NOT NULL,            -- 연도/월 (YYYY-MM 형식)
  member_name VARCHAR(100) NOT NULL,         -- 회원 이름
  phone VARCHAR(20),                         -- 연락처
  status VARCHAR(20),                        -- 회원상태: "유효" | "만료"
  recent_visit VARCHAR(20),                  -- 최근방문일 (YYYY-MM-DD)
  product_names TEXT[],                      -- 상품명 배열 (PostgreSQL 배열)
  product_period_map JSONB,                  -- 상품명별 기간 맵 (JSONB 타입)
  total_period VARCHAR(20),                  -- 전체기간 (문자열)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- UNIQUE 제약조건 추가 (동일 센터/연월/회원 중복 방지)
CREATE UNIQUE INDEX idx_parsed_snapshots_unique ON parsed_member_snapshots(center, year_month, member_name);

-- 인덱스 생성 (조회 최적화)
CREATE INDEX idx_parsed_snapshots_center_year_month ON parsed_member_snapshots(center, year_month);
CREATE INDEX idx_parsed_snapshots_year_month ON parsed_member_snapshots(year_month);
```

### 3.2 테이블 생성 및 마이그레이션 패턴

renewals 테이블과 동일한 패턴으로 구현:

1. **테이블 생성 함수 (`createParsedMemberSnapshotsTable`)**
   - `information_schema.tables`로 테이블 존재 여부 확인
   - 없으면 생성, 있으면 `migrateParsedMemberSnapshotsTable()` 호출

2. **마이그레이션 함수 (`migrateParsedMemberSnapshotsTable`)**
   - `information_schema.columns`로 컬럼 존재 여부 확인
   - 컬럼 타입 확인 및 필요시 변경
   - 인덱스 생성 (없으면 추가)
   - 기존 데이터 변환 (필요시)

3. **마이그레이션 고려사항**
   - JSONB 타입 컬럼은 문자열로 반환될 수 있으므로 JSON.parse() 처리
   - 배열 타입 컬럼도 안전하게 처리
   - 인덱스는 `CREATE INDEX IF NOT EXISTS` 사용 (또는 존재 확인 후 생성)

### 3.3 데이터 저장 규칙
- **센터 + 연도/월 조합**: 하나의 스냅샷 단위
- **동일 센터/연월/회원명 조합**: UNIQUE 제약으로 중복 방지
  - 같은 센터/연월에 동일 회원이 이미 있으면 업데이트 (또는 삭제 후 재생성)
  - 아니면 새로운 스냅샷으로 생성

## 4. API 설계

### 4.1 데이터 저장 API
**POST** `/api/database/snapshots`

**Request Body:**
```json
{
  "center": "1호점",
  "yearMonth": "2024-12",
  "members": [
    {
      "name": "홍길동",
      "phone": "010-1234-5678",
      "status": "유효",
      "recentVisit": "2024-12-01",
      "productNames": ["3개월", "6개월"],
      "productPeriodMap": {"3개월": "3", "6개월": "6"},
      "totalPeriod": "9"
    }
  ]
}
```

**Response:**
```json
{
  "message": "스냅샷이 저장되었습니다.",
  "savedCount": 150,
  "snapshotId": "uuid-here"
}
```

**동작:**
1. 기존 스냅샷 확인: 해당 `center` + `yearMonth` 조합이 이미 존재하는지 확인
2. 삭제 후 재생성: 기존 스냅샷이 있으면 모두 삭제 후 새로 저장
   - 또는 업데이트 모드: 기존 회원은 업데이트, 새 회원은 추가
3. 배치 저장: 트랜잭션으로 모든 회원 정보 저장
4. 결과 반환: 저장된 개수 반환

### 4.2 데이터 조회 API
**GET** `/api/database/snapshots?center=1호점&yearMonth=2024-12`

**Query Parameters:**
- `center` (선택): 센터명 (없으면 전체)
- `yearMonth` (필수): 연도/월 (YYYY-MM)

**Response:**
```json
{
  "center": "1호점",
  "yearMonth": "2024-12",
  "members": [
    {
      "name": "홍길동",
      "phone": "010-1234-5678",
      "status": "유효",
      "recentVisit": "2024-12-01",
      "productNames": ["3개월", "6개월"],
      "productPeriodMap": {"3개월": "3", "6개월": "6"},
      "totalPeriod": "9"
    }
  ],
  "total": 150
}
```

### 4.3 스냅샷 목록 조회 API (센터/연월별 목록)
**GET** `/api/database/snapshots/list`

**Query Parameters:**
- `center` (선택): 센터명 필터링
- `yearMonth` (선택): 연도/월 필터링

**Response:**
```json
{
  "snapshots": [
    {
      "center": "1호점",
      "yearMonth": "2024-12",
      "memberCount": 150,
      "createdAt": "2024-12-15T10:30:00Z"
    },
    {
      "center": "2호점",
      "yearMonth": "2024-12",
      "memberCount": 120,
      "createdAt": "2024-12-15T11:00:00Z"
    }
  ]
}
```

### 4.4 스냅샷 삭제 API
**DELETE** `/api/database/snapshots?center=1호점&yearMonth=2024-12`

**Query Parameters:**
- `center` (필수)
- `yearMonth` (필수)

**Response:**
```json
{
  "message": "스냅샷이 삭제되었습니다.",
  "deletedCount": 150
}
```

## 5. 프론트엔드 설계

### 5.1 UI 변경사항

#### 5.1.1 파일 업로드 영역에 저장 기능 추가
```
[파일 업로드] 버튼 옆에
[DB 저장] 버튼 추가
```

#### 5.1.2 저장 모달 추가
파일 업로드 후 파싱된 데이터가 있을 때:
- **[DB 저장]** 버튼 클릭 시 모달 표시
- 모달 내용:
  - 센터 선택 (드롭다운)
  - 연도/월 선택 (YYYY-MM 형식, date input type="month")
  - 저장 버튼
  - 취소 버튼

#### 5.1.3 스냅샷 불러오기 영역 추가
파일 업로드 영역 아래에 새로운 섹션 추가:
```
### 저장된 스냅샷 불러오기
[센터 선택] [연도/월 선택] [불러오기] 버튼
```

#### 5.1.4 데이터 표시 영역
- 기존 파싱된 데이터 표시와 동일한 형태
- 다만 데이터 소스가 "파일 업로드" vs "DB 불러오기" 구분

### 5.2 플로우

#### 5.2.1 저장 플로우
1. 사용자가 엑셀 파일 업로드
2. 파싱 완료 후 데이터 표시
3. **[DB 저장]** 버튼 클릭
4. 모달에서 센터/연도월 선택
5. 저장 API 호출
6. 저장 성공 메시지 표시

#### 5.2.2 불러오기 플로우
1. "저장된 스냅샷 불러오기" 섹션에서 센터/연도월 선택
2. **[불러오기]** 버튼 클릭
3. 조회 API 호출
4. 파싱된 데이터와 동일한 형태로 표시
5. 필터링/정렬 기능 동일하게 적용

## 6. 구현 파일

### 6.1 백엔드
- `backend/parsed-member-snapshots-db.js` (신규 생성)
  - 테이블 생성 함수
  - CRUD 함수들 (create, read, delete, list)
- `backend/server.js`
  - `/api/database/snapshots` POST, GET, DELETE 엔드포인트 추가
  - `/api/database/snapshots/list` GET 엔드포인트 추가

### 6.2 프론트엔드
- `public/js/database.js`
  - 저장 모달 UI 추가
  - 저장 기능 구현
  - 불러오기 섹션 UI 추가
  - 불러오기 기능 구현

## 7. 고려사항

### 7.1 데이터 일관성
- 동일 센터/연월에 여러 번 저장하면 기존 데이터 삭제 후 재생성
- 트랜잭션 사용하여 원자성 보장

### 7.2 성능
- 대량 데이터 저장 시 배치 처리 고려
- 인덱스 최적화 (center + year_month 조합)

### 7.3 데이터 크기
- JSONB 타입 사용으로 유연한 스키마 관리
- 배열 타입으로 productNames 효율적 저장

### 7.4 사용자 경험
- 저장 전 확인 메시지 (기존 데이터 덮어쓰기 경고)
- 불러오기 시 로딩 표시
- 저장/불러오기 성공/실패 메시지

## 8. 구현 상세 (마이그레이션 패턴)

### 8.1 백엔드 파일 구조 (`backend/parsed-member-snapshots-db.js`)

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 테이블 생성 및 마이그레이션
const createParsedMemberSnapshotsTable = async () => {
  try {
    // 테이블 존재 여부 확인
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'parsed_member_snapshots'
    `;
    const checkResult = await pool.query(checkQuery);
    
    // 테이블이 없을 때만 생성
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE parsed_member_snapshots (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          center VARCHAR(100) NOT NULL,
          year_month VARCHAR(7) NOT NULL,
          member_name VARCHAR(100) NOT NULL,
          phone VARCHAR(20),
          status VARCHAR(20),
          recent_visit VARCHAR(20),
          product_names TEXT[],
          product_period_map JSONB,
          total_period VARCHAR(20),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // UNIQUE 인덱스 생성
      await pool.query(`
        CREATE UNIQUE INDEX idx_parsed_snapshots_unique 
        ON parsed_member_snapshots(center, year_month, member_name)
      `);
      
      // 조회용 인덱스 생성
      await pool.query(`
        CREATE INDEX idx_parsed_snapshots_center_year_month 
        ON parsed_member_snapshots(center, year_month)
      `);
      await pool.query(`
        CREATE INDEX idx_parsed_snapshots_year_month 
        ON parsed_member_snapshots(year_month)
      `);
      
      console.log('[PostgreSQL] Parsed Member Snapshots 테이블이 생성되었습니다.');
    } else {
      console.log('[PostgreSQL] Parsed Member Snapshots 테이블이 이미 존재합니다.');
      // 기존 테이블 마이그레이션
      await migrateParsedMemberSnapshotsTable();
    }
  } catch (error) {
    console.error('[PostgreSQL] Parsed Member Snapshots 테이블 생성 오류:', error);
  }
};

// 마이그레이션 함수
const migrateParsedMemberSnapshotsTable = async () => {
  try {
    // 인덱스 존재 여부 확인 및 생성
    const checkIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'parsed_member_snapshots' 
      AND indexname = 'idx_parsed_snapshots_unique'
    `;
    const indexResult = await pool.query(checkIndexQuery);
    
    if (indexResult.rows.length === 0) {
      // UNIQUE 인덱스 생성
      await pool.query(`
        CREATE UNIQUE INDEX idx_parsed_snapshots_unique 
        ON parsed_member_snapshots(center, year_month, member_name)
      `);
      console.log('[PostgreSQL] Parsed Member Snapshots 테이블에 UNIQUE 인덱스가 추가되었습니다.');
    }
    
    // 조회용 인덱스 확인 및 생성
    const checkCenterYearMonthIndex = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'parsed_member_snapshots' 
      AND indexname = 'idx_parsed_snapshots_center_year_month'
    `);
    if (checkCenterYearMonthIndex.rows.length === 0) {
      await pool.query(`
        CREATE INDEX idx_parsed_snapshots_center_year_month 
        ON parsed_member_snapshots(center, year_month)
      `);
      console.log('[PostgreSQL] Parsed Member Snapshots 테이블에 center_year_month 인덱스가 추가되었습니다.');
    }
    
    const checkYearMonthIndex = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'parsed_member_snapshots' 
      AND indexname = 'idx_parsed_snapshots_year_month'
    `);
    if (checkYearMonthIndex.rows.length === 0) {
      await pool.query(`
        CREATE INDEX idx_parsed_snapshots_year_month 
        ON parsed_member_snapshots(year_month)
      `);
      console.log('[PostgreSQL] Parsed Member Snapshots 테이블에 year_month 인덱스가 추가되었습니다.');
    }
    
    // 컬럼 존재 여부 확인 및 추가 (향후 확장 대비)
    // 예: 컬럼 추가가 필요할 때 여기서 처리
    
  } catch (error) {
    console.error('[PostgreSQL] Parsed Member Snapshots 테이블 마이그레이션 오류:', error);
  }
};

// 초기화 함수
const initializeDatabase = async () => {
  await createParsedMemberSnapshotsTable();
};

module.exports = {
  initializeDatabase,
  // CRUD 함수들...
};
```

### 8.2 JSONB 타입 처리 패턴
renewals 테이블과 동일하게, JSONB 타입이 문자열로 반환될 수 있으므로:

```javascript
// 조회 시 JSONB 파싱
product_period_map: (() => {
  if (row.product_period_map === null || row.product_period_map === undefined) return null;
  if (typeof row.product_period_map === 'string') {
    try {
      return JSON.parse(row.product_period_map);
    } catch (e) {
      return null;
    }
  }
  return typeof row.product_period_map === 'object' ? row.product_period_map : null;
})()
```

### 8.3 마이그레이션 전략
1. `parsed-member-snapshots-db.js` 파일 생성
2. 테이블 생성 함수 작성 (renewals 패턴 참고)
3. 마이그레이션 함수 작성 (인덱스, 컬럼 추가 대비)
4. `server.js`에서 초기화 시 `initializeDatabase()` 호출
5. API 엔드포인트 추가
6. 프론트엔드 UI 및 기능 구현
7. 테스트
