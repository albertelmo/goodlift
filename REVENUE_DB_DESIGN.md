# 트레이너 매출 DB 설계 문서

## 📋 개요
트레이너 장부 전용 매출 데이터를 관리하는 데이터베이스 구조입니다. 지출 구조와 유사하게 설계하여 일관성을 유지합니다.

## 🎯 목표
- 트레이너별 월별 매출 데이터 관리
- 기타수입은 여러 개 입력 가능 (고정지출과 유사)
- 총 수입 자동 계산
- SU와 무관한 독립적인 시스템

## 📊 데이터베이스 구조

### 1. 매출 테이블 (`trainer_revenues`)
트레이너별 월별 매출을 저장합니다. (월별 1건)

```sql
CREATE TABLE trainer_revenues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer VARCHAR(100) NOT NULL,          -- 트레이너 username (자동 입력)
  month VARCHAR(7) NOT NULL,               -- 연월 (YYYY-MM)
  amount INTEGER NOT NULL DEFAULT 0,      -- 매출 금액 (원)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(trainer, month)                  -- 트레이너별 월별 유니크 제약조건
)
```

**인덱스**: `idx_trainer_revenues_trainer_month` ON (trainer, month)

### 2. 기타수입 테이블 (`trainer_other_revenues`)
기타수입은 여러 개 입력 가능하므로 별도 테이블로 관리합니다. (고정지출과 유사한 구조)

```sql
CREATE TABLE trainer_other_revenues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer VARCHAR(100) NOT NULL,          -- 트레이너 username (자동 입력)
  month VARCHAR(7) NOT NULL,              -- 연월 (YYYY-MM)
  item VARCHAR(200) NOT NULL,             -- 항목명
  amount INTEGER NOT NULL DEFAULT 0,      -- 금액 (원)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

**인덱스**: `idx_trainer_other_revenues_trainer_month` ON (trainer, month)

## 📊 총 수입 계산

총 수입은 다음과 같이 계산됩니다:

```
총 수입 = 매출 + 기타수입 합계
```

## 🗂️ 파일 구조

### 새로 생성할 파일
- `backend/trainer-revenue-db.js` - 트레이너 매출 DB 모듈

### 수정할 파일
- `backend/server.js` - 트레이너 매출 API 엔드포인트 추가
- `public/js/trainer-ledger.js` - 트레이너 장부에 매출 섹션 추가

## 🔧 구현 상세

### 1. 백엔드 - DB 모듈 (`backend/trainer-revenue-db.js`)

#### 1.1 테이블 생성 함수
- `createTrainerRevenueTable()` - 매출 테이블 생성
- `createTrainerOtherRevenueTable()` - 기타수입 테이블 생성
- `initializeDatabase()` - 모든 테이블 초기화

#### 1.2 CRUD 함수

**매출**:
- `getTrainerRevenues(filters)` - 조회
- `addTrainerRevenue(revenue)` - 추가/수정 (UNIQUE 제약조건으로 자동 처리)
- `updateTrainerRevenue(id, updates)` - 수정
- `deleteTrainerRevenue(id)` - 삭제

**기타수입**:
- `getTrainerOtherRevenues(filters)` - 조회
- `addTrainerOtherRevenue(revenue)` - 추가
- `updateTrainerOtherRevenue(id, updates)` - 수정
- `deleteTrainerOtherRevenue(id)` - 삭제

### 2. 백엔드 - API 엔드포인트 (`backend/server.js`)

#### 2.1 매출 API
- `GET /api/trainer/revenues?month=YYYY-MM` - 조회 (현재 로그인한 트레이너만)
- `POST /api/trainer/revenues` - 추가/수정 (UNIQUE 제약조건으로 자동 처리)
- `PATCH /api/trainer/revenues/:id` - 수정
- `DELETE /api/trainer/revenues/:id` - 삭제

#### 2.2 기타수입 API
- `GET /api/trainer/other-revenues?month=YYYY-MM` - 조회 (현재 로그인한 트레이너만)
- `POST /api/trainer/other-revenues` - 추가
- `PATCH /api/trainer/other-revenues/:id` - 수정
- `DELETE /api/trainer/other-revenues/:id` - 삭제

#### 2.3 권한 체크
- 모든 API에서 현재 로그인한 트레이너의 username 확인
- 본인 데이터만 조회/수정/삭제 가능하도록 제한

### 3. 프론트엔드 - UI 구성

#### 3.1 트레이너 장부 매출 섹션
```
┌─────────────────────────────────────────┐
│ 매출                                    │
├─────────────────────────────────────────┤
│ 매출: [입력]                             │
│ 기타수입: [추가] [목록]                  │
│   - 항목1: 금액1                         │
│   - 항목2: 금액2                         │
│ ─────────────────────────────────────  │
│ 총 수입: [자동 계산]                      │
└─────────────────────────────────────────┘
```

## 🔍 데이터 필터링 로직

### 트레이너 장부
- 매출: `trainer_revenues` 테이블에서 `trainer` 필드로 필터링 (현재 로그인한 트레이너)
- 기타수입: `trainer_other_revenues` 테이블에서 `trainer` 필드로 필터링 (현재 로그인한 트레이너)

## ⚠️ 주의사항

1. **UNIQUE 제약조건**: 매출은 트레이너별 월별로 하나만 존재
2. **기타수입**: 여러 개 입력 가능 (고정지출과 유사한 구조)
3. **트레이너 자동 입력**: 모든 데이터에 현재 로그인한 트레이너 username 자동 입력
4. **권한 체크**: 트레이너는 본인 데이터만 조회/수정/삭제 가능
5. **데이터 보안**: 다른 트레이너의 데이터 접근 방지
6. **총 수입 계산**: 프론트엔드에서 실시간 계산 (매출 + 기타수입 합계)
7. **SU와 무관**: 트레이너 장부 전용 독립적인 시스템

## 📝 구현 순서

1. ✅ 설계 문서 작성 (현재 단계)
2. ⬜ `trainer-revenue-db.js` 모듈 생성 (테이블 생성 및 CRUD 함수)
3. ⬜ `backend/server.js`에 트레이너 매출 API 엔드포인트 추가
4. ⬜ `trainer-ledger.js`에 매출 섹션 추가
5. ⬜ 매출 추가/수정/삭제 기능
6. ⬜ 기타수입 추가/수정/삭제 기능
7. ⬜ 총 수입 계산 및 표시
8. ⬜ 테스트 및 검증

## 🎨 UI/UX 고려사항

1. **지출 구조와 유사한 디자인** 유지
2. **반응형 디자인** 적용
3. **로딩 상태** 표시
4. **에러 처리** 및 사용자 피드백
5. **날짜 네비게이션** (이전월/다음월, 기존 장부와 동일)
6. **모달을 통한 추가/수정** (지출과 동일한 패턴)
7. **총 수입 자동 계산** 및 실시간 업데이트
8. **기타수입은 고정지출과 동일한 UI** (항목, 금액만 입력)

## 🔄 향후 확장 가능성

1. 이전월 데이터 복사 기능
2. 월별 비교 기능
3. 연간 통계 기능
4. 엑셀 내보내기 기능
5. 매출 그래프/차트 표시
