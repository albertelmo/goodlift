# 로그 정리 가이드

## 📊 현재 상황

서버 시작 시 다음과 같은 로그가 대량으로 출력됩니다:
```
[PostgreSQL] diet_records 테이블이 이미 존재합니다.
[PostgreSQL] workout_records 테이블이 이미 존재합니다.
[PostgreSQL] app_users 테이블이 이미 존재합니다.
... (총 26개 파일에서 35개의 로그)
```

## 🎯 해결 방안

### 방법 1: 환경 변수로 제어 (권장) ⭐

`backend/logger.js` 모듈을 생성하여 DB 초기화 로그를 제어합니다.

#### 1-1. logger.js 사용 (이미 생성됨)

```javascript
// backend/logger.js 사용 예시
const logger = require('./logger');

// 기존 코드
console.log('[PostgreSQL] xxx 테이블이 이미 존재합니다.');

// 변경 후
logger.dbInit('[PostgreSQL] xxx 테이블이 이미 존재합니다.');
```

#### 1-2. 환경 변수 설정

```bash
# 개발 환경 - 로그 보기
ENABLE_DB_INIT_LOGS=true npm start

# 상용 환경 - 로그 숨기기 (기본값)
npm start
```

#### 1-3. .env 파일에 추가

```env
# DB 초기화 로그 표시 여부 (개발 시에만 true)
ENABLE_DB_INIT_LOGS=false

# 로그 레벨 (debug, info, warn, error)
LOG_LEVEL=info
```

---

### 방법 2: 조건부 로그 (간단한 방법)

각 DB 파일에서 직접 조건 추가:

```javascript
// 기존
console.log('[PostgreSQL] xxx 테이블이 이미 존재합니다.');

// 변경
if (process.env.ENABLE_DB_INIT_LOGS === 'true') {
  console.log('[PostgreSQL] xxx 테이블이 이미 존재합니다.');
}
```

---

### 방법 3: 완전 제거 (가장 간단)

개발이 안정화되었으므로 해당 로그를 완전히 제거:

```javascript
// 제거할 로그
console.log('[PostgreSQL] xxx 테이블이 이미 존재합니다.');

// 유지할 로그 (중요한 정보)
console.log('[PostgreSQL] xxx 테이블이 생성되었습니다.'); // 최초 생성 시
console.error('[PostgreSQL] xxx 테이블 생성 오류:', error); // 에러 발생 시
```

---

## 🔧 적용 대상 파일 (26개)

1. app-users-db.js
2. consultation-records-db.js
3. expenses-db.js
4. ledger-db.js (4개)
5. trainer-ledger-db.js (3개)
6. trainer-revenue-db.js (2개)
7. app-user-settings-db.js
8. parsed-member-snapshots-db.js
9. parsed-sales-snapshots-db.js
10. renewals-db.js
11. workout-types-db.js (2개)
12. elmo-users-db.js
13. member-activity-logs-db.js
14. diet-records-db.js (2개)
15. trainer-activity-logs-db.js
16. workout-comments-db.js
17. workout-trainer-comments-db.js
18. marketing-db.js
19. metrics-db.js
20. sales-db.js
21. trials-db.js
22. workout-records-db.js (2개)
23. consultation-shares-db.js
24. app-user-activity-events-db.js
25. app-user-favorite-workouts-db.js
26. sessions-db.js

---

## 💡 권장 사항

### 단계별 적용

**1단계: logger.js 생성 (완료)**
- `backend/logger.js` 파일 생성됨

**2단계: 주요 DB 파일에 적용 (5~10개)**
- consultation-records-db.js
- app-users-db.js
- workout-records-db.js
- diet-records-db.js
- trials-db.js

**3단계: 나머지 파일에 적용**
- 일괄 변경 스크립트 사용 가능

**4단계: 환경 변수 설정**
- 개발: `ENABLE_DB_INIT_LOGS=false` (기본값)
- 디버깅 필요 시: `ENABLE_DB_INIT_LOGS=true`

---

## 📝 변경 예시

### Before
```javascript
const createXxxTable = async () => {
  try {
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      await pool.query(createQuery);
      console.log('[PostgreSQL] xxx 테이블이 생성되었습니다.');
    } else {
      console.log('[PostgreSQL] xxx 테이블이 이미 존재합니다.'); // ← 제거 대상
      await runMigration(...);
    }
  } catch (error) {
    console.error('[PostgreSQL] xxx 테이블 생성 오류:', error);
  }
};
```

### After (방법 1: logger 사용)
```javascript
const logger = require('./logger');

const createXxxTable = async () => {
  try {
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      await pool.query(createQuery);
      console.log('[PostgreSQL] xxx 테이블이 생성되었습니다.');
    } else {
      logger.dbInit('[PostgreSQL] xxx 테이블이 이미 존재합니다.'); // ← 조건부 출력
      await runMigration(...);
    }
  } catch (error) {
    console.error('[PostgreSQL] xxx 테이블 생성 오류:', error);
  }
};
```

### After (방법 3: 완전 제거)
```javascript
const createXxxTable = async () => {
  try {
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      await pool.query(createQuery);
      console.log('[PostgreSQL] xxx 테이블이 생성되었습니다.');
    } else {
      // 로그 제거 - 마이그레이션만 실행
      await runMigration(...);
    }
  } catch (error) {
    console.error('[PostgreSQL] xxx 테이블 생성 오류:', error);
  }
};
```

---

## 🚀 빠른 적용 (방법 3 권장)

가장 간단한 방법은 **해당 로그 라인을 완전히 제거**하는 것입니다.

### 이유:
1. ✅ 테이블 존재 여부는 마이그레이션 시스템이 관리
2. ✅ 에러가 발생하면 에러 로그로 알 수 있음
3. ✅ 최초 생성 시에만 "생성되었습니다" 로그 출력
4. ✅ 로그가 깨끗해짐

### 제거해도 되는 로그:
- ❌ `console.log('[PostgreSQL] xxx 테이블이 이미 존재합니다.');`

### 유지해야 할 로그:
- ✅ `console.log('[PostgreSQL] xxx 테이블이 생성되었습니다.');`
- ✅ `console.error('[PostgreSQL] xxx 테이블 생성 오류:', error);`
- ✅ `console.log('[PostgreSQL] xxx 데이터베이스 초기화 완료');`

---

## 🎯 결론

**추천: 방법 3 (완전 제거)**

이유:
- 가장 간단하고 빠름
- 마이그레이션 시스템이 이미 구축되어 있음
- 필요한 정보는 마이그레이션 로그와 에러 로그로 충분
- 상용 환경에서 깨끗한 로그 유지

원하시면 제가 일괄 제거 작업을 진행해드릴 수 있습니다!
