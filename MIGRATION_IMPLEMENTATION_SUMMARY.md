# 마이그레이션 추적 시스템 구현 완료

## ✅ 구현 완료 사항

### 1. 마이그레이션 관리 모듈 생성
**파일:** `backend/migrations-manager.js`

**기능:**
- `migrations` 테이블 자동 생성
- 마이그레이션 실행 이력 추적
- 중복 실행 방지
- 실행 시간 측정 및 기록
- 조용한 스킵 (이미 실행된 마이그레이션은 로그 없이 건너뜀)

**주요 함수:**
- `initializeMigrationSystem()` - 시스템 초기화
- `runMigration(name, description, func)` - 마이그레이션 실행 래퍼
- `checkMigrationExecuted(name)` - 실행 여부 확인
- `recordMigration(name, desc, time)` - 실행 기록 저장
- `getMigrationHistory(limit)` - 이력 조회
- `getAllExecutedMigrations()` - 모든 실행된 마이그레이션 조회

### 2. 적용된 DB 파일 (21개)

#### 주요 DB 파일 (8개)
1. ✅ `consultation-records-db.js` - 상담기록 (19개 컬럼)
2. ✅ `app-users-db.js` - 앱 유저 (5개 컬럼)
3. ✅ `workout-records-db.js` - 운동 기록 (구조 변경)
4. ✅ `trials-db.js` - Trial (4개 컬럼)
5. ✅ `sales-db.js` - 매출 (2개 컬럼 + 제약조건)
6. ✅ `metrics-db.js` - 지표 (15개 컬럼)
7. ✅ `marketing-db.js` - 마케팅 (6개 컬럼)
8. ✅ `diet-records-db.js` - 식단 기록 (2개 마이그레이션)

#### 나머지 DB 파일 (13개)
9. ✅ `workout-comments-db.js` - 운동 코멘트
10. ✅ `workout-trainer-comments-db.js` - 트레이너 운동 코멘트
11. ✅ `trainer-activity-logs-db.js` - 트레이너 활동 로그
12. ✅ `member-activity-logs-db.js` - 회원 활동 로그
13. ✅ `elmo-users-db.js` - Elmo 사용자
14. ✅ `app-user-settings-db.js` - 앱 유저 설정
15. ✅ `workout-types-db.js` - 운동 타입
16. ✅ `renewals-db.js` - 갱신
17. ✅ `parsed-member-snapshots-db.js` - 회원 스냅샷
18. ✅ `parsed-sales-snapshots-db.js` - 매출 스냅샷
19. ✅ `expenses-db.js` - 지출
20. ✅ `ledger-db.js` - 장부 (4개 마이그레이션)
21. ✅ `trainer-ledger-db.js` - 트레이너 장부 (3개 마이그레이션)
22. ✅ `trainer-revenue-db.js` - 트레이너 매출 (2개 마이그레이션)

### 3. server.js 통합
- `migrations-manager` 모듈 import 추가
- 서버 시작 시 `initializeMigrationSystem()` 최우선 실행
- 모든 DB 초기화 전에 마이그레이션 시스템 준비

---

## 📊 마이그레이션 명명 규칙

모든 마이그레이션은 다음 형식을 따릅니다:
```
{동작}_{테이블명}_{날짜}
```

**예시:**
- `add_columns_to_consultation_records_20250131`
- `migrate_workout_records_structure_20250131`
- `add_tax_type_to_expenses_20250131`

---

## 🔄 작동 방식

### 최초 실행 (마이그레이션 테이블 없음)
1. `migrations` 테이블 자동 생성
2. 모든 마이그레이션 실행
3. 각 마이그레이션 실행 후 `migrations` 테이블에 기록

### 이후 실행 (마이그레이션 테이블 존재)
1. 각 마이그레이션 실행 전 `migrations` 테이블 확인
2. 이미 실행된 마이그레이션은 **조용히 스킵** (로그 없음)
3. 새로운 마이그레이션만 실행 및 기록

---

## 📈 성능 개선 효과

### Before (이전)
- 서버 시작 시마다 21개 마이그레이션 함수 실행
- 각 함수당 5~10개의 컬럼 확인 쿼리
- **총 약 100~200개의 불필요한 DB 쿼리**
- 로그 출력 과다

### After (개선 후)
- 최초 실행: 21개 마이그레이션 실행 + 기록
- 이후 실행: **0개의 마이그레이션 쿼리** (조용히 스킵)
- 로그 출력 최소화 (새 마이그레이션만 출력)
- **서버 시작 시간 단축**

---

## 🗄️ migrations 테이블 구조

```sql
CREATE TABLE migrations (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) UNIQUE NOT NULL,
  executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  description TEXT,
  execution_time_ms INTEGER
);

CREATE INDEX idx_migrations_name ON migrations(migration_name);
```

**컬럼 설명:**
- `id` - 자동 증가 ID
- `migration_name` - 마이그레이션 고유 이름 (중복 불가)
- `executed_at` - 실행 시각
- `description` - 마이그레이션 설명
- `execution_time_ms` - 실행 시간 (밀리초)

---

## 🔍 마이그레이션 이력 조회

### API 추가 가능 (선택사항)
```javascript
// GET /api/migrations/history
app.get('/api/migrations/history', async (req, res) => {
  const { getAllExecutedMigrations } = require('./migrations-manager');
  const migrations = await getAllExecutedMigrations();
  res.json({ migrations });
});
```

### 직접 DB 쿼리
```sql
-- 모든 마이그레이션 이력
SELECT * FROM migrations ORDER BY executed_at DESC;

-- 최근 10개
SELECT * FROM migrations ORDER BY executed_at DESC LIMIT 10;

-- 특정 마이그레이션 확인
SELECT * FROM migrations WHERE migration_name LIKE '%consultation%';
```

---

## 🚀 배포 시 주의사항

### 1. 최초 배포 (상용 환경)
- 서버 시작 시 모든 마이그레이션이 자동 실행됨
- 로그에서 실행된 마이그레이션 확인
- `migrations` 테이블 생성 확인

### 2. 이후 배포
- 새로운 마이그레이션만 실행됨
- 기존 마이그레이션은 조용히 스킵
- 로그가 깨끗함

### 3. 롤백이 필요한 경우
```sql
-- 특정 마이그레이션 기록 삭제 (재실행 가능하도록)
DELETE FROM migrations WHERE migration_name = 'migration_name_here';

-- 모든 마이그레이션 기록 삭제 (전체 재실행)
-- ⚠️ 주의: 실제 테이블 구조는 변경되지 않음
TRUNCATE TABLE migrations;
```

---

## 📝 새로운 마이그레이션 추가 방법

### 1. 마이그레이션 함수 작성
```javascript
const migrateNewTable = async () => {
  // 컬럼 추가 로직
  const checkQuery = `SELECT column_name FROM information_schema.columns ...`;
  // ...
};
```

### 2. runMigration으로 래핑
```javascript
await runMigration(
  'add_new_column_to_table_20250201',  // 고유 이름
  '테이블에 새 컬럼 추가',              // 설명
  migrateNewTable                       // 함수
);
```

### 3. 배포
- 서버 재시작 시 자동 실행
- 실행 후 `migrations` 테이블에 기록
- 다음 재시작부터는 스킵

---

## ✅ 검증 체크리스트

- [x] `migrations-manager.js` 생성
- [x] 21개 DB 파일에 `runMigration` 적용
- [x] `server.js`에 초기화 코드 추가
- [x] 모든 마이그레이션에 고유 이름 부여
- [x] 날짜 형식 통일 (YYYYMMDD)
- [x] 설명 추가
- [ ] 로컬 환경 테스트
- [ ] 상용 환경 배포 및 검증

---

## 🎯 다음 단계

1. **로컬 테스트**
   - 서버 재시작 후 로그 확인
   - `migrations` 테이블 확인
   - 두 번째 재시작 시 스킵 확인

2. **상용 환경 배포**
   - 배포 후 로그 모니터링
   - 마이그레이션 실행 확인
   - 성능 개선 확인

3. **모니터링**
   - 서버 시작 시간 측정
   - 마이그레이션 실행 시간 확인
   - 에러 로그 확인

---

## 📞 문제 발생 시

### 마이그레이션이 실행되지 않음
```sql
-- migrations 테이블 확인
SELECT * FROM migrations WHERE migration_name = '문제의_마이그레이션_이름';

-- 기록 삭제 후 재시도
DELETE FROM migrations WHERE migration_name = '문제의_마이그레이션_이름';
```

### migrations 테이블이 생성되지 않음
- `initializeMigrationSystem()` 호출 확인
- PostgreSQL 연결 확인
- 권한 확인

### 성능 개선이 없음
- 로그에서 "실행 중:" 메시지 확인
- 두 번째 재시작에서도 나타나면 문제
- `migrations` 테이블 데이터 확인
