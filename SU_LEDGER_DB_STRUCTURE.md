# SU 장부 DB 구성

## 📊 데이터베이스 테이블 구조

SU의 장부 기능은 다음 6개의 PostgreSQL 테이블을 사용합니다:

---

## 1. `fixed_expenses` (고정지출)
**파일**: `backend/ledger-db.js`

### 테이블 구조
```sql
CREATE TABLE fixed_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center VARCHAR(100) NOT NULL,          -- 센터명
  month VARCHAR(7) NOT NULL,             -- 연월 (YYYY-MM)
  item VARCHAR(200) NOT NULL,             -- 항목명
  amount INTEGER NOT NULL DEFAULT 0,      -- 금액 (원)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### 인덱스
- `idx_fixed_expenses_center_month` ON (center, month)

### API 엔드포인트
- `GET /api/fixed-expenses?month=YYYY-MM&center=센터명`
- `POST /api/fixed-expenses`
- `PATCH /api/fixed-expenses/:id`
- `DELETE /api/fixed-expenses/:id`

---

## 2. `variable_expenses` (변동지출)
**파일**: `backend/ledger-db.js`

### 테이블 구조
```sql
CREATE TABLE variable_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center VARCHAR(100) NOT NULL,          -- 센터명
  month VARCHAR(7) NOT NULL,             -- 연월 (YYYY-MM)
  date DATE,                              -- 날짜 (선택사항)
  item VARCHAR(200) NOT NULL,             -- 항목명
  amount INTEGER NOT NULL DEFAULT 0,      -- 금액 (원)
  note VARCHAR(500),                      -- 비고
  tax_type VARCHAR(50),                   -- 세금 타입 ('vat', 'corporate_tax' 또는 NULL)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### 인덱스
- `idx_variable_expenses_center_month` ON (center, month)

### API 엔드포인트
- `GET /api/variable-expenses?month=YYYY-MM&center=센터명`
- `POST /api/variable-expenses`
- `PATCH /api/variable-expenses/:id`
- `DELETE /api/variable-expenses/:id`

---

## 3. `salaries` (급여)
**파일**: `backend/ledger-db.js`

### 테이블 구조
```sql
CREATE TABLE salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center VARCHAR(100) NOT NULL,          -- 센터명
  month VARCHAR(7) NOT NULL,             -- 연월 (YYYY-MM)
  item VARCHAR(200) NOT NULL,             -- 항목명 (예: "기본급여", "성과급" 등)
  amount INTEGER NOT NULL DEFAULT 0,      -- 금액 (원)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### 인덱스
- `idx_salaries_center_month` ON (center, month)

### API 엔드포인트
- `GET /api/salaries?month=YYYY-MM&center=센터명`
- `POST /api/salaries`
- `PATCH /api/salaries/:id`
- `DELETE /api/salaries/:id`

**⚠️ 주의**: 현재 급여 테이블에는 `trainer` 필드가 없습니다. 센터별 급여만 관리됩니다.

---

## 4. `settlements` (정산)
**파일**: `backend/ledger-db.js`

### 테이블 구조
```sql
CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month VARCHAR(7) NOT NULL UNIQUE,      -- 연월 (YYYY-MM), 유니크 제약조건
  profit_amount INTEGER NOT NULL,         -- 손익금액 (원, 음수 가능)
  settlement_amount INTEGER,              -- 정산금액 (원, NULL 가능)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### 인덱스
- `idx_settlements_month` ON (month)
- UNIQUE 제약조건: `settlements_month_unique` ON (month)

### API 엔드포인트
- `GET /api/settlements?month=YYYY-MM`
- `POST /api/settlements`
- `PATCH /api/settlements/:id`
- `DELETE /api/settlements/:id`

---

## 5. `expenses` (식대/구매/개인지출)
**파일**: `backend/expenses-db.js`

### 테이블 구조
```sql
CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  trainer VARCHAR(100) NOT NULL,          -- 등록한 트레이너 username
  expense_type VARCHAR(20) NOT NULL       -- 지출 타입: 'meal', 'purchase', 'personal'
    CHECK (expense_type IN ('meal', 'purchase', 'personal')),
  amount INTEGER NOT NULL CHECK (amount >= 0),  -- 금액 (원)
  datetime TIMESTAMP NOT NULL,            -- 지출 시각
  participant_trainers TEXT[],            -- 함께 지출한 트레이너 배열 (식대용)
  purchase_item VARCHAR(200),             -- 구매물품명 (구매/개인지출용)
  center VARCHAR(100),                    -- 센터명 (구매/개인지출용)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### 인덱스
- `idx_expenses_trainer` ON (trainer)
- `idx_expenses_datetime` ON (datetime)

### 지출 타입별 필드 사용
- **식대 (meal)**: `trainer`, `participant_trainers` 필수
- **구매 (purchase)**: `trainer`, `purchase_item`, `center` 필수
- **개인지출 (personal)**: `trainer`, `purchase_item`(지출내역), `center` 필수

### API 엔드포인트
- `GET /api/expenses?trainer=username&startDate=...&endDate=...`
- `POST /api/expenses`
- `PATCH /api/expenses/:id`
- `DELETE /api/expenses/:id`

---

## 6. `metrics` (매출 지표)
**파일**: `backend/metrics-db.js`

### 테이블 구조
```sql
CREATE TABLE metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center VARCHAR(100) NOT NULL,          -- 센터명
  month VARCHAR(7) NOT NULL,             -- 연월 (YYYY-MM)
  naver_clicks INTEGER DEFAULT 0,
  naver_leads INTEGER DEFAULT 0,
  karrot_clicks INTEGER DEFAULT 0,
  karrot_leads INTEGER DEFAULT 0,
  pt_new INTEGER DEFAULT 0,
  pt_consultation INTEGER DEFAULT 0,
  pt_renewal INTEGER DEFAULT 0,
  pt_expiring INTEGER DEFAULT 0,
  membership_new INTEGER DEFAULT 0,
  membership_renewal INTEGER DEFAULT 0,
  membership_expiring INTEGER DEFAULT 0,
  total_members INTEGER DEFAULT 0,
  pt_total_members INTEGER DEFAULT 0,
  total_sales INTEGER DEFAULT 0,        -- 전체 매출 (원)
  pt_sales INTEGER DEFAULT 0,           -- PT 매출 (원)
  membership_sales INTEGER DEFAULT 0,    -- 멤버십 매출 (원)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(center, month)                  -- 센터별 월별 유니크 제약조건
)
```

### 인덱스
- `idx_metrics_center_month` ON (center, month)
- `idx_metrics_month` ON (month)

### API 엔드포인트
- `GET /api/metrics?month=YYYY-MM&center=센터명`
- `POST /api/metrics`
- `PATCH /api/metrics/:id`

**⚠️ 주의**: 매출 데이터는 센터별로만 관리되며, 트레이너별 매출 정보는 별도로 저장되지 않습니다.

---

## 📋 데이터 흐름

### SU 장부 화면에서 사용하는 데이터

1. **센터별 전체 매출**
   - `metrics` 테이블의 `total_sales` 필드 사용
   - 센터별로 그룹화하여 표시

2. **지출 종류별 합계**
   - 고정지출: `fixed_expenses` 테이블
   - 변동지출: `variable_expenses` 테이블
   - 급여: `salaries` 테이블
   - 식대: `expenses` 테이블 (expense_type = 'meal')
   - 구매: `expenses` 테이블 (expense_type = 'purchase')
   - 개인지출: `expenses` 테이블 (expense_type = 'personal')

3. **월순익 계산**
   - 월순익 = 매출 합계 - 지출 합계

4. **연간순익 계산**
   - 올해 1월부터 현재 월까지의 누적 매출 - 누적 지출

5. **월별 정산**
   - `settlements` 테이블에서 조회
   - 누적 손익액과 누적 정산액 계산

---

## 🔍 트레이너 장부에서 사용할 수 있는 데이터

### ✅ 사용 가능한 테이블
1. **`expenses`** - 트레이너 본인이 등록한 지출만 조회 가능
   - `trainer` 필드로 필터링
   - 식대의 경우 `participant_trainers` 배열에 포함된 경우도 포함

2. **`salaries`** - ⚠️ 현재는 센터별 급여만 저장 (트레이너별 필드 없음)
   - 트레이너별 급여를 표시하려면 테이블 구조 변경 필요

### ❌ 사용 불가능한 테이블 (SU 전용)
1. **`fixed_expenses`** - 고정지출 (SU만 관리)
2. **`variable_expenses`** - 변동지출 (SU만 관리)
3. **`settlements`** - 월별 정산 (SU만 관리)

### ⚠️ 매출 데이터 문제
- **`metrics`** 테이블에는 트레이너별 매출 정보가 없음
- 트레이너별 매출을 계산하려면:
  - `sessions` 테이블에서 트레이너별 완료된 세션 조회
  - 회원 정보에서 세션 가격 계산
  - 또는 새로운 트레이너별 매출 테이블 생성 필요

---

## 💡 트레이너 장부 구현 방안

### 옵션 1: 기존 테이블 활용 (권장)
- **지출**: `expenses` 테이블에서 `trainer` 필드로 필터링 ✅
- **급여**: `salaries` 테이블에 `trainer` 필드 추가 필요 ⚠️
- **매출**: `sessions` 테이블에서 트레이너별 세션 조회 후 계산 필요 ⚠️

### 옵션 2: 트레이너별 매출 테이블 생성
- 새로운 `trainer_metrics` 테이블 생성
- 트레이너별 월별 매출 저장
- 기존 `metrics` 테이블과 별도 관리

### 옵션 3: 하이브리드
- 지출: 기존 `expenses` 테이블 활용 ✅
- 급여: `salaries` 테이블에 `trainer` 필드 추가
- 매출: `sessions` 테이블에서 실시간 계산

---

## 📝 요약

| 테이블 | 트레이너 장부 사용 | 비고 |
|--------|------------------|------|
| `expenses` | ✅ 가능 | `trainer` 필드로 필터링 |
| `salaries` | ⚠️ 제한적 | `trainer` 필드 추가 필요 |
| `metrics` | ❌ 불가능 | 트레이너별 데이터 없음 |
| `fixed_expenses` | ❌ SU 전용 | 트레이너는 사용 불가 |
| `variable_expenses` | ❌ SU 전용 | 트레이너는 사용 불가 |
| `settlements` | ❌ SU 전용 | 트레이너는 사용 불가 |
