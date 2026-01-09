# 트레이너 법인카드 지출 관리 기능 설계 문서

## 📋 기능 개요
트레이너가 법인카드로 지출한 내역을 등록하고, 관리자가 전체 지출 내역을 조회할 수 있는 기능입니다.

---

## 🗄️ 데이터베이스 설계

### 테이블: `expenses`
**⚠️ 중요: Render 운영 환경을 고려한 안전한 테이블 생성**

PostgreSQL 데이터베이스 (Render 운영 환경)에 새로운 테이블을 생성합니다.
기존 DB 모듈 패턴(`members-db.js`, `sessions-db.js`, `registration-logs-db.js` 등)을 따라 구현합니다.

#### 필드 구조
| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | SERIAL | PRIMARY KEY | 지출 내역 고유 ID |
| trainer | VARCHAR(100) | NOT NULL | 지출한 트레이너 username |
| amount | INTEGER | NOT NULL, CHECK >= 0 | 지출 금액 (원 단위) |
| datetime | TIMESTAMP | NOT NULL | 지출 시각 (한국시간 기준, UTC+9) |
| participant_trainers | TEXT[] | NOT NULL | 함께 지출한 트레이너 username 배열 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 등록 시각 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 수정 시각 |

#### 테이블 생성 전략 (기존 패턴 준수)
**⚠️ 중요: 최초 실행 시에만 테이블 생성, 이후에는 생성 과정 생략**

`CREATE TABLE IF NOT EXISTS` 대신, **테이블 존재 여부를 먼저 확인** 후 생성하는 방식 사용 (기존 `migrateVipSessionField` 패턴 준수)

**테이블 생성 SQL:**
```sql
-- 1단계: 테이블 존재 여부 확인
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'expenses';

-- 2단계: 테이블이 없을 때만 실행
CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  trainer VARCHAR(100) NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  datetime TIMESTAMP NOT NULL,
  participant_trainers TEXT[] NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- UTF-8 인코딩 설정 (기존 패턴과 동일)
SET client_encoding TO 'UTF8';

-- 3단계: 인덱스 존재 여부 확인 후 생성
-- 조회 성능 향상을 위한 인덱스
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_expenses_trainer';
CREATE INDEX idx_expenses_trainer ON expenses(trainer);

SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_expenses_datetime';
CREATE INDEX idx_expenses_datetime ON expenses(datetime);
```

#### Render 운영 환경 고려사항
1. **안전한 테이블 생성**
   - `CREATE TABLE IF NOT EXISTS` 사용 → 기존 테이블이 있어도 에러 없이 진행
   - 서버 재시작 시에도 안전하게 동작

2. **인덱스 생성**
   - PostgreSQL 9.5+ 버전에서 `CREATE INDEX IF NOT EXISTS` 지원
   - Render PostgreSQL은 보통 최신 버전이지만, 안전을 위해 별도 체크 로직 추가 가능

3. **마이그레이션 전략 (기존 패턴 준수)** ⚠️ **중요**
   - **최초 실행**: 테이블이 없으면 생성
   - **이후 실행**: 테이블이 이미 있으면 생성 과정을 실행하지 않음 (불필요한 쿼리 방지)
   - **구현 방법**: `information_schema.tables`로 테이블 존재 여부를 먼저 확인 후, 없을 때만 `CREATE TABLE` 실행
   - **기존 패턴**: `members-db.js`의 `migrateVipSessionField`처럼 `information_schema` 사용
   - 컬럼 추가/변경이 필요하면 별도 마이그레이션 함수로 처리 (예: `migrateVipSessionField` 패턴)
   
   **테이블 생성 함수 예시:**
   ```javascript
   const createExpensesTable = async () => {
     try {
       // 테이블 존재 여부 확인 (기존 패턴 준수)
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
   ```
   
   **인덱스 생성도 동일한 패턴:**
   ```javascript
   const createExpensesIndexes = async () => {
     try {
       // 인덱스 존재 여부 확인
       const checkIndexQuery = `
         SELECT indexname 
         FROM pg_indexes 
         WHERE schemaname = 'public' AND indexname = 'idx_expenses_trainer'
       `;
       const checkResult = await pool.query(checkIndexQuery);
       
       if (checkResult.rows.length === 0) {
         await pool.query('CREATE INDEX idx_expenses_trainer ON expenses(trainer)');
         console.log('[PostgreSQL] idx_expenses_trainer 인덱스가 생성되었습니다.');
       }
       
       // datetime 인덱스도 동일하게 처리
       // ...
     } catch (error) {
       console.error('[PostgreSQL] 인덱스 생성 오류:', error);
     }
   };
   ```

4. **에러 처리**
   - 테이블 생성 실패 시에도 서버가 중단되지 않도록 try-catch 처리
   - 로그만 출력하고 계속 진행

5. **환경변수 구분 (Local vs Render)** ⚠️ **중요**
   - **기존 DB 모듈 패턴과 동일하게 구현** (`sessions-db.js`, `members-db.js` 등)
   - `process.env.DATABASE_URL` 사용
     - Local: `.env` 파일에서 `dotenv` 패키지로 읽음 (`server.js`에서 `require('dotenv').config()` 호출)
     - Render: 환경변수로 자동 설정됨 (Render 대시보드에서 설정)
   - `process.env.NODE_ENV === 'production'`로 SSL 설정 구분
     - Local: `NODE_ENV !== 'production'` → SSL 비활성화
     - Render: `NODE_ENV === 'production'` → SSL 활성화 (`rejectUnauthorized: false`)

   **Pool 생성 코드 (기존 패턴과 동일):**
   ```javascript
   const { Pool } = require('pg');
   
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
   });
   ```

#### 예시 데이터
```sql
INSERT INTO expenses (trainer, amount, datetime, participant_trainers)
VALUES 
  ('shk', 15000, '2025-01-15 12:30:00+09:00', ARRAY['shk', 'ssc']),
  ('ssc', 8500, '2025-01-15 18:00:00+09:00', ARRAY['ssc']);
```

#### 초기화 순서 (server.js)
```javascript
// 기존 패턴과 동일하게 초기화
const expensesDB = require('./expenses-db');
expensesDB.initializeDatabase();
```

---

## 🔌 백엔드 API 설계

### 1. 지출 내역 추가 API
**POST** `/api/expenses`

**권한:** 트레이너만 가능 (현재 로그인한 사용자 확인)

**Request Body:**
```json
{
  "trainer": "shk",
  "amount": 15000,
  "datetime": "2025-01-15T12:30:00",
  "participantTrainers": ["shk", "ssc"]
}
```

**시간 처리:**
- 프론트엔드에서 `datetime-local` 입력값은 로컬 시간 (예: `2025-01-15T12:30`)
- 백엔드에서 한국시간(UTC+9)으로 해석하여 TIMESTAMP로 저장
- 저장 시 PostgreSQL이 자동으로 UTC로 변환하여 저장
- 조회 시 한국시간으로 변환하여 반환

**Response (성공):**
```json
{
  "message": "지출 내역이 추가되었습니다.",
  "expense": {
    "id": 1,
    "trainer": "shk",
    "amount": 15000,
    "datetime": "2025-01-15T03:30:00.000Z",
    "participantTrainers": ["shk", "ssc"],
    "createdAt": "2025-01-15T04:00:00.000Z"
  }
}
```

**에러 처리:**
- 400: 필수 필드 누락 또는 유효하지 않은 데이터
- 401: 로그인하지 않은 사용자
- 403: 트레이너 권한이 아닌 사용자
- 500: 서버 오류 (Render DB 연결 실패 등)

---

### 2. 지출 내역 조회 API
**GET** `/api/expenses`

**Query Parameters:**
- `trainer` (선택): 특정 트레이너의 지출 내역만 조회
- `startDate` (선택): 시작 날짜 (YYYY-MM-DD)
- `endDate` (선택): 종료 날짜 (YYYY-MM-DD)
- `limit` (선택): 조회 개수 제한 (기본값: 1000)
- `offset` (선택): 페이지네이션 offset (기본값: 0)

**Response:**
```json
{
  "expenses": [
    {
      "id": 1,
      "trainer": "shk",
      "trainerName": "김성현",
      "amount": 15000,
      "datetime": "2025-01-15T12:30:00.000Z",
      "participantTrainers": ["shk", "ssc"],
      "participantTrainerNames": ["김성현", "천성식"],
      "createdAt": "2025-01-15T13:00:00.000Z"
    }
  ],
  "total": 1,
  "summary": {
    "totalAmount": 15000,
    "count": 1
  }
}
```

---

### 3. 지출 내역 삭제 API (선택 사항)
**DELETE** `/api/expenses/:id`

**권한:** 관리자만 삭제 가능

**Response (성공):**
```json
{
  "message": "지출 내역이 삭제되었습니다."
}
```

---

## 🎨 프론트엔드 설계

### 1. 트레이너 화면 - 지출 내역 추가 버튼

**위치:** 트레이너 탭 중 하나에 버튼 추가 (예: '👤' 탭 상단 또는 별도 탭)

**UI:**
- 버튼 스타일: 기존 버튼과 일관성 있는 스타일 (파란색 배경, 흰색 텍스트)
- 버튼 텍스트: "💳 지출 내역 추가" 또는 "지출 등록"

**버튼 클릭 시:**
- 지출 내역 추가 모달 표시

---

### 2. 지출 내역 추가 모달

**모달 구조:**
```
┌─────────────────────────────────────┐
│ 💳 지출 내역 등록                    │
├─────────────────────────────────────┤
│ 시각 *                               │
│ [datetime-local input]              │
│                                     │
│ 금액 *                               │
│ [number input] (원)                 │
│                                     │
│ 함께 지출한 트레이너 *               │
│ [checkbox list]                     │
│ ☑ 김성현 (shk)                      │
│ ☐ 천성식 (ssc)                      │
│ ☐ 윤승환 (shy)                      │
│ ...                                 │
│                                     │
│ [취소]  [등록]                      │
└─────────────────────────────────────┘
```

**입력 필드 상세:**
1. **시각 (datetime-local)**
   - 기본값: 현재 한국시간
   - 형식: `YYYY-MM-DDTHH:mm` (예: 2025-01-15T12:30)
   - 필수 입력
   - 한국시간 기준으로 변환하여 저장

2. **금액 (number)**
   - 기본값: 빈 값
   - 단위: 원
   - 최소값: 0
   - 필수 입력
   - 천 단위 구분자 표시 (선택 사항)

3. **함께 지출한 트레이너 (checkbox)**
   - 모든 트레이너 목록을 체크박스로 표시
   - 현재 로그인한 트레이너는 자동 체크 (비활성화)
   - 최소 1명 이상 선택 필수 (자기 자신 포함)

**유효성 검사:**
- 모든 필수 필드 입력 확인
- 금액이 0 이상인지 확인
- 최소 1명 이상의 트레이너 선택 확인

**제출 시:**
- API 호출: `POST /api/expenses`
- 성공 시: 모달 닫기, 성공 메시지 표시
- 실패 시: 에러 메시지 표시

---

### 3. 관리자 화면 - 지출 내역 조회 탭

**위치:** 관리자 탭에 "지출" 또는 "Expense" 탭 추가

**탭 순서:**
```
Today | Week | Member | Center | Trainer | Stat | Expense
```

**화면 구성:**
```
┌─────────────────────────────────────────────────┐
│ [필터 영역]                                     │
│ 트레이너: [전체 ▼]                              │
│ 기간: [2025-01-01] ~ [2025-01-31] [조회]       │
├─────────────────────────────────────────────────┤
│ [요약 영역]                                     │
│ 총 지출 건수: 15건                              │
│ 총 지출 금액: 235,000원                         │
├─────────────────────────────────────────────────┤
│ [지출 내역 테이블]                              │
│ 시각      │ 지출자  │ 금액   │ 함께 지출한 트레이너 │
├─────────────────────────────────────────────────┤
│ 2025-01-15│ 김성현  │ 15,000 │ 김성현, 천성식    │
│ 12:30     │         │        │                   │
│ ...       │ ...     │ ...    │ ...               │
└─────────────────────────────────────────────────┘
```

**기능:**
1. **필터링**
   - 트레이너별 필터 (전체/특정 트레이너)
   - 기간별 필터 (시작일 ~ 종료일)

2. **요약 정보**
   - 총 지출 건수
   - 총 지출 금액 (천 단위 구분자 표시)

3. **지출 내역 테이블**
   - 최신순 정렬 (기본)
   - 컬럼: 시각, 지출자, 금액, 함께 지출한 트레이너
   - 페이지네이션 (선택 사항, 많은 데이터일 경우)

4. **CSV 내보내기 (선택 사항)**
   - 버튼: "CSV 내보내기"
   - 현재 필터링된 결과를 CSV로 다운로드

---

## 📁 파일 구조

### 새로 생성할 파일
```
backend/
  ├── expenses-db.js          # 지출 내역 DB 모듈 (기존 패턴 준수)
  └── (server.js 수정)        # API 엔드포인트 추가 및 초기화

public/js/
  ├── expense.js              # 지출 관리 프론트엔드 모듈 (관리자 화면)
  └── (main.js 수정)          # 탭 추가 및 모달 HTML 추가
```

### 수정할 파일
```
backend/
  └── server.js               # 지출 내역 API 엔드포인트 추가, initializeDatabase() 호출 추가

public/
  ├── index.html              # 지출 내역 추가 모달 HTML 추가
  └── js/
      ├── main.js             # 관리자 탭에 "Expense" 추가
      └── trainer.js          # 지출 내역 추가 버튼 및 모달 로직 추가
```

### 파일 구조 패턴 (기존과 동일)
- **backend/expenses-db.js**: 
  - `Pool` 생성 (DATABASE_URL 사용, Render 환경 자동 감지)
  - `createExpensesTable()` 함수
  - `initializeDatabase()` 함수
  - CRUD 함수들
  - 에러 처리 및 로깅

---

## 🔄 구현 순서

### Phase 1: 데이터베이스 및 백엔드
1. ✅ `backend/expenses-db.js` 생성
   - **Render 환경 고려**: `Pool` 생성 시 `process.env.DATABASE_URL` 사용
   - **SSL 설정**: `NODE_ENV === 'production'`일 때 `rejectUnauthorized: false` (Render 필요)
   - **테이블 생성 함수**: `information_schema.tables`로 존재 여부 확인 후, 없을 때만 생성
     - 최초 실행: 테이블 생성
     - 이후 실행: 테이블이 있으면 생성 과정 생략 (불필요한 쿼리 방지)
   - **인덱스 생성 함수**: `pg_indexes`로 존재 여부 확인 후, 없을 때만 생성
   - 지출 내역 추가 함수 (`INSERT` with `RETURNING`)
   - 지출 내역 조회 함수 (필터링 지원, `WHERE` 조건 동적 생성)
   - 초기화 함수 (`initializeDatabase`)
   - **에러 처리**: try-catch로 감싸서 서버 중단 방지

2. ✅ `backend/server.js` 수정
   - `expensesDB.initializeDatabase()` 호출 추가 (기존 패턴과 동일한 위치)
   - `POST /api/expenses` 엔드포인트 추가
     - 권한 확인: 트레이너만 가능
     - 한국시간 처리: `getKoreanDateTime()` 또는 직접 변환
   - `GET /api/expenses` 엔드포인트 추가
     - 권한 확인: 관리자만 가능
     - 필터링: trainer, startDate, endDate
     - 트레이너 이름 매핑 포함
   - `DELETE /api/expenses/:id` 엔드포인트 추가 (선택 사항)

### Phase 2: 프론트엔드 - 트레이너 화면
3. ✅ `public/index.html` 수정
   - 지출 내역 추가 모달 HTML 추가

4. ✅ `public/js/trainer.js` 수정
   - 지출 내역 추가 버튼 추가
   - 모달 열기/닫기 로직
   - 트레이너 목록 로드 및 체크박스 생성
   - 폼 제출 로직

### Phase 3: 프론트엔드 - 관리자 화면
5. ✅ `public/js/expense.js` 생성
   - 관리자 지출 내역 조회 화면 렌더링
   - 필터링 로직
   - 테이블 렌더링

6. ✅ `public/js/main.js` 수정
   - 관리자 탭에 "Expense" 추가
   - 탭 클릭 시 expense.js의 render 함수 호출

---

## 🎯 주요 고려사항

### 1. Render 운영 환경 고려사항 ⚠️
- **데이터베이스 연결 (기존 DB 모듈 패턴과 동일)**
  - `process.env.DATABASE_URL` 사용
    - **Local**: `.env` 파일에서 읽음 (`server.js`에서 `require('dotenv').config()` 호출)
    - **Render**: Render 대시보드에서 설정한 환경변수 자동 사용
  - SSL 연결 구분: `process.env.NODE_ENV === 'production'` 체크
    - **Local**: `NODE_ENV !== 'production'` → SSL 비활성화 (`ssl: false`)
    - **Render**: `NODE_ENV === 'production'` → SSL 활성화 (`ssl: { rejectUnauthorized: false }`)
  - 연결 풀 관리: 기존 패턴과 동일하게 `Pool` 사용
  
  **✅ 기존 패턴 준수:**
  ```javascript
  // backend/expenses-db.js
  const { Pool } = require('pg');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  ```
  
  이 패턴은 `sessions-db.js`, `members-db.js`, `monthly-stats-db.js`, `registration-logs-db.js`와 동일합니다.

- **테이블 생성 안전성**
  - `CREATE TABLE IF NOT EXISTS` 사용 → 중복 생성 방지
  - 서버 재시작 시에도 안전하게 동작
  - 에러 발생 시에도 서버 중단 방지 (로그만 출력)

- **마이그레이션 전략**
  - 기존 테이블이 있으면 건너뛰기
  - 컬럼 추가/변경은 별도 마이그레이션 함수로 처리
  - 운영 중인 데이터에 영향 없도록 안전하게 처리

- **인덱스 관리**
  - `CREATE INDEX IF NOT EXISTS` 사용 (PostgreSQL 9.5+)
  - 인덱스 중복 생성 방지
  - 성능 최적화를 위한 인덱스 전략

### 2. 시간 처리
- 프론트엔드에서 `datetime-local` 입력은 로컬 시간대로 전송됨 (예: `2025-01-15T12:30`)
- 백엔드에서 한국시간(UTC+9)으로 해석하여 TIMESTAMP로 저장
  - PostgreSQL은 UTC로 저장하므로 시간대 변환 필요
  - `getKoreanDateTime()` 유틸 함수 활용 또는 직접 변환
- 조회 시 한국시간으로 변환하여 반환 (`AT TIME ZONE 'Asia/Seoul'` 또는 JavaScript 변환)

### 3. 권한 관리
- 지출 내역 추가: 트레이너만 가능 (`localStorage.getItem('role') === 'trainer'`)
- 지출 내역 조회: 관리자만 가능 (`role === 'admin'`)
- 트레이너는 자신의 지출 내역만 조회 가능 (선택 사항 - 미구현)

### 4. 데이터 무결성
- 금액은 0 이상만 허용 (CHECK 제약조건)
- 함께 지출한 트레이너 목록은 최소 1명 이상 (자기 자신 포함)
- 트레이너 username이 유효한지 검증 (accounts.json 또는 DB 조회)

### 5. 성능
- 대량 데이터 조회 시 페이지네이션 고려 (limit, offset)
- 인덱스 활용으로 조회 성능 최적화
- Render DB 성능 최적화를 위한 쿼리 최적화

### 6. 에러 처리
- Render DB 연결 실패 시 안전하게 처리
- 네트워크 오류, 타임아웃 등 고려
- 사용자에게 명확한 에러 메시지 제공

### 7. UI/UX
- 기존 디자인과 일관성 유지
- 모바일 친화적 레이아웃
- 로딩 상태 표시
- 에러 메시지 명확하게 표시

---

## 📝 API 예시

### 지출 내역 추가
```javascript
// Request
POST /api/expenses
Content-Type: application/json

{
  "trainer": "shk",
  "amount": 15000,
  "datetime": "2025-01-15T12:30:00",
  "participantTrainers": ["shk", "ssc"]
}

// Response
{
  "message": "지출 내역이 추가되었습니다.",
  "expense": {
    "id": 1,
    "trainer": "shk",
    "amount": 15000,
    "datetime": "2025-01-15T12:30:00.000Z",
    "participantTrainers": ["shk", "ssc"],
    "createdAt": "2025-01-15T13:00:00.000Z"
  }
}
```

### 지출 내역 조회
```javascript
// Request
GET /api/expenses?trainer=shk&startDate=2025-01-01&endDate=2025-01-31

// Response
{
  "expenses": [
    {
      "id": 1,
      "trainer": "shk",
      "trainerName": "김성현",
      "amount": 15000,
      "datetime": "2025-01-15T12:30:00.000Z",
      "participantTrainers": ["shk", "ssc"],
      "participantTrainerNames": ["김성현", "천성식"],
      "createdAt": "2025-01-15T13:00:00.000Z"
    }
  ],
  "total": 1,
  "summary": {
    "totalAmount": 15000,
    "count": 1
  }
}
```

---

## ✅ 검증 항목

- [ ] 트레이너 로그인 시 지출 내역 추가 버튼 표시
- [ ] 모달에서 시각, 금액, 함께 지출한 트레이너 입력 가능
- [ ] 입력 데이터 유효성 검사
- [ ] 지출 내역 DB에 정상 저장
- [ ] 관리자 로그인 시 지출 내역 조회 탭 표시
- [ ] 필터링 기능 정상 동작
- [ ] 요약 정보 정상 표시
- [ ] 테이블에 지출 내역 정상 표시

---

이 설계 문서를 바탕으로 구현을 진행하시겠습니까?

