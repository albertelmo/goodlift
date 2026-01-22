# 상담 기록지 기능 설계

## 개요
회원이 상담을 방문했을 때 상담 내용을 기록하는 기능. **관리자(admin) / 슈퍼관리자(su) 화면에만** 상단바 오른쪽에 "상담" 버튼을 노출하고, 클릭 시 팝업으로 상담기록지를 띄워 입력·저장한다.

---

## 1. DB 설계

### 테이블: `consultation_records`

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | UUID | ✓ | PK, `gen_random_uuid()` |
| `created_at` | TIMESTAMP | ✓ | 기록 일시, DEFAULT CURRENT_TIMESTAMP |
| `trainer_username` | VARCHAR(100) | ✓ | 상담 담당 트레이너 (accounts.json `role=trainer`) |
| `name` | VARCHAR(100) | ✓ | 이름 |
| `phone` | VARCHAR(50) | ✓ | 연락처 |
| `gender` | VARCHAR(20) | | 성별 (M/F/기타/미입력) |
| `age_range` | VARCHAR(50) | | 연령대 |
| `exercise_history` | TEXT | | 운동이력 |
| `medical_history` | TEXT | | 병력 |
| `preferred_time` | VARCHAR(100) | | 희망시간대 |
| `visit_source` | VARCHAR(100) | | 방문경로 |
| `referrer` | VARCHAR(100) | | 추천인 |
| `purpose` | VARCHAR(50) | | 상담목적 (체력증진/근력강화/자세교정/재활/다이어트/선수지망/기타) |
| `purpose_other` | VARCHAR(200) | | 상담목적 '기타' 시 직접입력 |
| `inbody` | TEXT | | 기본검사: 인바디 |
| `overhead_squat` | TEXT | | 기본검사: 오버헤드스쿼트 |
| `slr_test` | TEXT | | 상세검사: SLR 테스트 |
| `empty_can_test` | TEXT | | 상세검사: Empty Can 테스트 |
| `rom` | TEXT | | 상세검사: 가동범위 |
| `flexibility` | TEXT | | 상세검사: 유연성 |
| `static_posture` | TEXT | | 상세검사: 정적 자세평가 |
| `exercise_performed` | TEXT | | 수행운동 |
| `summary` | TEXT | | 상담정리: 종합평가 |

### 인덱스
- `idx_consultation_records_created_at` ON `created_at`
- `idx_consultation_records_trainer` ON `trainer_username`

### 저장소
- PostgreSQL (기존 `*-db.js` 패턴과 동일, `DATABASE_URL` 사용)

### 마이그레이션 전략 (기존 패턴 준수)
- **최초 실행**: `information_schema.tables`로 테이블 존재 여부 확인 후, 없을 때만 `CREATE TABLE` 실행
- **이후 실행**: 테이블이 이미 있으면 생성 과정을 실행하지 않고, 별도 마이그레이션 함수(`migrateConsultationRecordsTable`) 호출
- **마이그레이션 함수**: `information_schema.columns`로 컬럼 존재 여부 확인 후, 누락된 컬럼만 `ALTER TABLE ADD COLUMN` 실행
- **인덱스**: 테이블 생성 시 함께 생성, 마이그레이션에서도 누락된 인덱스 확인 후 추가
- **구현 파일**: `backend/consultation-records-db.js`에 `createConsultationRecordsTable()`, `migrateConsultationRecordsTable()` 함수 구현

---

## 2. API 설계

**권한:** 모든 엔드포인트 **admin / su** 전용. `currentUser`(username)로 accounts.json에서 역할 확인 후 `isAdminOrSu` 체크.

### POST `/api/consultation-records`
- **Body:** `currentUser`(필수) + 상담기록 필드 전체
- **검증:** `name`, `phone`, `trainer_username` 필수
- **응답:** 생성된 상담기록 객체

### GET `/api/consultation-records`
- **Query:** `currentUser`(필수), `trainer`, `startDate`, `endDate` (선택)
- **응답:** `{ records: ConsultationRecord[] }`

### GET `/api/consultation-records/:id`
- **Query:** `currentUser`(필수)
- **응답:** 단건 상담기록

### PATCH `/api/consultation-records/:id`
- **Body:** `currentUser`(필수) + 수정할 필드만
- **응답:** 수정된 상담기록

### DELETE `/api/consultation-records/:id`
- **Body:** `{ currentUser }`
- **응답:** `{ message }`

---

## 3. UI 설계

### 상단바 버튼
- **위치:** 관리자 화면 **상단바 오른쪽** (`.header-btns` 내, 설정/로그아웃 버튼 왼쪽)
- **노출:** `role === 'admin'` 또는 `role === 'su'` 일 때만 표시
- **동작:** 클릭 시 상담기록지 팝업 오픈

### 상담기록지 팝업 (모달)
- **트레이너 선택:** `/api/trainers` 조회 후 드롭다운
- **기본정보**
  - 이름 *(필수)*, 연락처 *(필수)*
  - 성별, 연령대, 운동이력, 병력, 희망시간대, 방문경로, 추천인
- **상담목적**
  - 드롭다운: 체력증진 / 근력강화 / 자세교정 / 재활 / 다이어트 / 선수지망 / **기타**
  - "기타" 선택 시 직접입력 텍스트 필드 표시
- **신체검사**
  - **기본검사:** 인바디, 오버헤드스쿼트
  - **상세검사:** SLR 테스트, Empty Can 테스트, 가동범위, 유연성, 정적 자세평가
- **수행운동:** 텍스트(textarea)
- **상담정리:** 종합평가(textarea)
- **버튼:** 취소, 저장

1차 구현에서는 **새 기록 추가(POST)** 만 지원하고, 목록/상세/수정/삭제는 추후 확장 가능하도록 API·DB를 설계해 둔다.
