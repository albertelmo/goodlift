# 데이터베이스 마이그레이션 현황 분석

## 📊 현재 상황

### 문제점
**모든 마이그레이션 함수가 서버 시작 시마다 반복 실행됩니다.**

- 각 DB의 `initializeDatabase()`가 호출될 때마다 마이그레이션 함수도 함께 실행
- 이미 완료된 마이그레이션도 매번 컬럼 존재 여부를 DB에 쿼리하여 확인
- 마이그레이션 실행 이력을 추적하는 중앙 메커니즘이 없음
- 서버 시작 시 불필요한 DB 조회가 대량 발생

### 현재 마이그레이션 패턴

```javascript
// 각 DB 파일의 일반적인 패턴
const createXxxTable = async () => {
  // 테이블 존재 여부 확인
  if (테이블이_없으면) {
    // 테이블 생성
  } else {
    console.log('테이블이 이미 존재합니다.');
    await migrateXxxTable(); // ⚠️ 매번 실행됨
  }
};

const migrateXxxTable = async () => {
  // 컬럼 존재 여부 확인 (매번 DB 쿼리)
  const checkColumnQuery = `SELECT column_name FROM information_schema.columns ...`;
  
  // 없는 컬럼만 추가
  if (!existingColumns.includes(columnName)) {
    await pool.query(`ALTER TABLE xxx ADD COLUMN ...`);
  }
};
```

---

## 📋 마이그레이션이 있는 DB 목록 (21개)

### 1. **trials-db.js**
- `migrateTrialsTable()` - session_id, center, created_at, updated_at 컬럼 추가

### 2. **consultation-records-db.js** ✅ 방금 수정
- `migrateConsultationRecordsTable()` - 19개 컬럼 추가 (image_urls, video_urls 등)

### 3. **app-users-db.js**
- `migrateAppUsersTable()` - member_name, is_active, last_login_at, last_seen_at, trainer 컬럼 추가

### 4. **sales-db.js**
- `addSalesColumnsIfNotExists()` - is_new, membership 컬럼 추가, amount CHECK 제약조건 제거

### 5. **metrics-db.js**
- `migrateMetricsTable()` - 15개 지표 컬럼 추가, UNIQUE 제약조건 추가

### 6. **marketing-db.js**
- `migrateMarketingTable()` - type, expenses, notes, target, result, updated_at 컬럼 추가

### 7. **ledger-db.js**
- `migrateFixedExpenseTable()` - tax_type, start_date, end_date 컬럼 추가
- `migrateVariableExpenseTable()` - tax_type, updated_at 컬럼 추가
- `migrateSalaryTable()` - updated_at 컬럼 추가

### 8. **trainer-ledger-db.js**
- `migrateTrainerFixedExpenseTable()` - tax_type, start_date, end_date 컬럼 추가
- `migrateTrainerVariableExpenseTable()` - tax_type, updated_at 컬럼 추가
- `migrateTrainerSalaryTable()` - updated_at 컬럼 추가

### 9. **trainer-revenue-db.js**
- `migrateTrainerRevenueTable()` - year_month, total_sessions, revenue_per_session 등 7개 컬럼 추가
- `migrateTrainerOtherRevenueTable()` - year_month, updated_at 컬럼 추가

### 10. **diet-records-db.js**
- `migrateDietRecordsTable()` - comment_text, comment_updated_at, center 컬럼 추가

### 11. **workout-records-db.js**
- `migrateWorkoutRecordsTable()` - sets, reps, weight, rest_time 등 데이터 구조 변경

### 12. **expenses-db.js**
- `migrateExpensesTable()` - tax_type 컬럼 추가

### 13. **workout-comments-db.js**
- `migrateWorkoutCommentsTable()` - center 컬럼 추가

### 14. **workout-trainer-comments-db.js**
- `migrateWorkoutTrainerCommentsTable()` - center, username_alias 컬럼 추가

### 15. **trainer-activity-logs-db.js**
- `migrateTrainerActivityLogsTable()` - record_date, app_user_id 컬럼 추가, activity_type 길이 확장

### 16. **member-activity-logs-db.js**
- `migrateMemberActivityLogsTable()` - activity_type 길이 확장 (VARCHAR(20) → VARCHAR(50))

### 17. **elmo-users-db.js**
- `migrateElmoUsersTable()` - role 컬럼 추가

### 18. **app-user-settings-db.js**
- `migrateAppUserSettingsTable()` - show_trainer_comment_on_workout_tab 컬럼 추가

### 19. **renewals-db.js**
- `migrateRenewalsTable()` - 컬럼 확인 (자세한 내용 미확인)

### 20. **parsed-member-snapshots-db.js**
- `migrateParsedMemberSnapshotsTable()` - 컬럼 확인 (자세한 내용 미확인)

### 21. **parsed-sales-snapshots-db.js**
- `migrateParsedSalesSnapshotsTable()` - 컬럼 확인 (자세한 내용 미확인)

---

## ⚠️ 특이사항

### Trial 마이그레이션의 특별 처리 (파일 기반 플래그)

`backend/server.js`의 `runTrialMigration()` 함수는:
- `.trial-migration-done` 파일을 사용하여 마이그레이션 완료 여부 추적
- 파일이 존재하면 마이그레이션을 건너뜀
- **현재 주석 처리되어 실행되지 않음** (548줄)

```javascript
// 서버 시작 시 마이그레이션 실행 (마이그레이션 완료 - 주석 처리)
// runTrialMigration();
```

**그러나 이 방식도 다른 DB들에는 적용되지 않음**

---

## 🎯 성능 영향

### 서버 시작 시마다 발생하는 작업
1. **21개 마이그레이션 함수 실행**
2. **각 함수당 평균 5~10개의 컬럼 확인 쿼리**
3. **총 약 100~200개의 불필요한 DB 쿼리**

### 예시: consultation-records-db.js
```javascript
// 19개 컬럼 각각에 대해 매번 확인
for (const [columnName, columnType] of Object.entries(requiredColumns)) {
  if (!existingColumns.includes(columnName)) {
    // 이미 존재하는 컬럼이면 스킵하지만, 
    // 쿼리 자체는 매번 실행됨
  }
}
```

---

## 💡 권장 해결 방안

### 1. 마이그레이션 추적 테이블 생성
```sql
CREATE TABLE migrations (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) UNIQUE NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  description TEXT
);
```

### 2. 각 마이그레이션에 고유 이름 부여
```javascript
// 예시
const MIGRATION_NAME = 'add_consultation_records_image_urls_20250131';

const migrateConsultationRecordsTable = async () => {
  // 이미 실행되었는지 확인
  const alreadyExecuted = await checkMigrationExecuted(MIGRATION_NAME);
  if (alreadyExecuted) {
    return; // 건너뜀
  }
  
  // 마이그레이션 실행
  // ...
  
  // 실행 기록 저장
  await recordMigration(MIGRATION_NAME, '상담기록 테이블 컬럼 추가');
};
```

### 3. 마이그레이션 관리 모듈 생성
```javascript
// backend/migrations-manager.js
module.exports = {
  checkMigrationExecuted,
  recordMigration,
  getMigrationHistory
};
```

---

## 📊 우선순위

### 즉시 해결 필요 (High)
- 마이그레이션 추적 시스템 구축
- 가장 복잡한 마이그레이션부터 적용 (consultation-records, workout-records 등)

### 단계적 개선 (Medium)
- 기존 21개 마이그레이션에 추적 시스템 적용
- 로깅 개선 (실행된 마이그레이션만 로그 출력)

### 장기 개선 (Low)
- 마이그레이션 롤백 기능
- 마이그레이션 버전 관리
- 마이그레이션 실행 순서 의존성 관리
