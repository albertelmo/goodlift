# 성능 최적화 계획서

## 📊 현재 상태 분석

### ✅ 이미 잘 구현된 부분
1. **데이터베이스 인덱스**: workout_records에 복합 인덱스 설정됨
2. **PWA 캐싱**: Service Worker로 정적 파일 캐싱 구현
3. **JOIN 활용**: N+1 문제 인식하고 일부 해결
4. **마이그레이션 추적**: 중복 실행 방지 시스템 구현

### ⚠️ 개선 필요 부분
프론트엔드, 백엔드, 데이터베이스 전 영역에 걸쳐 개선 포인트 존재

---

## 🎯 우선순위별 최적화 계획

---

## 1️⃣ 높은 우선순위 (즉시 적용)

### 1.1 데이터베이스 인덱스 추가

**문제점**: 대부분의 DB 테이블에 인덱스가 없어 Full Table Scan 발생

**해결책**:
```sql
-- diet_records (식단기록)
CREATE INDEX IF NOT EXISTS idx_diet_records_user_date 
ON diet_records(app_user_id, meal_date DESC);

-- consultation_records (상담기록)
CREATE INDEX IF NOT EXISTS idx_consultation_records_member_date 
ON consultation_records(member_name, consultation_date DESC);

CREATE INDEX IF NOT EXISTS idx_consultation_records_trainer_date 
ON consultation_records(trainer, consultation_date DESC);

-- members (회원)
CREATE INDEX IF NOT EXISTS idx_members_trainer 
ON members(trainer) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_members_name 
ON members(name);

-- expenses (지출)
CREATE INDEX IF NOT EXISTS idx_expenses_trainer_month 
ON expenses(trainer, month);

CREATE INDEX IF NOT EXISTS idx_expenses_center_month 
ON expenses(center, month);

-- trainer_ledger (트레이너 장부)
CREATE INDEX IF NOT EXISTS idx_trainer_ledger_username_month 
ON trainer_ledger(trainer_username, month DESC);

-- elmo_calendar_records (엘모 캘린더)
CREATE INDEX IF NOT EXISTS idx_elmo_calendar_user_date 
ON elmo_calendar_records(app_user_id, record_date DESC);
```

**예상 효과**: 쿼리 속도 10-100배 개선

---

### 1.2 프론트엔드 번들 최적화

**문제점**: 
- 모든 JS 파일이 개별 로드됨 (40개 이상)
- CSS 파일 5개 모두 로드
- 초기 로딩 시간 증가

**해결책**:
```javascript
// 1. 코드 스플리팅 (모듈별 동적 로드)
// main.js에서 필요한 모듈만 로드
async function loadModule(screen) {
    switch(screen) {
        case 'workout':
            const { workout } = await import('./js/app-user/workout/index.js');
            return workout;
        case 'diet':
            const { diet } = await import('./js/app-user/diet/index.js');
            return diet;
        // ...
    }
}

// 2. CSS 병합 (빌드 프로세스)
// style.css, adminDayCalendar.css, adminWeekCalendar.css 등을 하나로 병합
```

**추가 개선**:
```html
<!-- 현재 -->
<link rel="stylesheet" href="css/style.css">
<link rel="stylesheet" href="css/adminDayCalendar.css">
<link rel="stylesheet" href="css/adminWeekCalendar.css">
<link rel="stylesheet" href="css/app-user.css">
<link rel="stylesheet" href="css/consultation.css">

<!-- 개선 후 -->
<link rel="stylesheet" href="css/bundle.min.css">
```

**예상 효과**: 초기 로딩 시간 30-50% 단축

---

### 1.3 이미지 최적화

**문제점**: 
- 원본 이미지를 그대로 표시
- 썸네일이 있어도 원본을 먼저 로드하는 경우 발생
- Lazy loading 미구현

**해결책**:
```javascript
// 1. Intersection Observer로 Lazy Loading
const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src; // data-src → src
            img.classList.remove('lazy');
            observer.unobserve(img);
        }
    });
}, { rootMargin: '50px' }); // 50px 미리 로드

document.querySelectorAll('img.lazy').forEach(img => {
    imageObserver.observe(img);
});

// 2. 썸네일 → 원본 Progressive Loading
<img src="thumbnail_300x300.jpg" 
     data-full="original.jpg" 
     class="progressive-image" />
```

**백엔드 이미지 최적화**:
```javascript
// sharp로 업로드 시 자동 리사이징
const sharp = require('sharp');

// 원본 저장 전 최적화
await sharp(imageBuffer)
    .resize(1920, 1920, { 
        fit: 'inside',
        withoutEnlargement: true 
    })
    .jpeg({ quality: 85 })
    .toFile(originalPath);

// 썸네일 생성
await sharp(imageBuffer)
    .resize(300, 300, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toFile(thumbnailPath);
```

**예상 효과**: 
- 데이터 전송량 50-70% 감소
- 이미지 로딩 속도 3-5배 개선

---

### 1.4 API 페이지네이션 추가

**문제점**: 모든 데이터를 한 번에 로드 (특히 식단기록, 운동기록, 회원 목록)

**해결책**:
```javascript
// GET /api/workout-records?app_user_id=xxx&page=1&limit=20
const getWorkoutRecords = async (appUserId, filters = {}) => {
    const page = parseInt(filters.page || 1);
    const limit = parseInt(filters.limit || 20);
    const offset = (page - 1) * limit;
    
    // COUNT 쿼리 (총 개수)
    const countQuery = `SELECT COUNT(*) FROM workout_records WHERE app_user_id = $1`;
    const countResult = await pool.query(countQuery, [appUserId]);
    const total = parseInt(countResult.rows[0].count);
    
    // 데이터 쿼리
    let query = `
        SELECT wr.*, wt.name as workout_type_name
        FROM workout_records wr
        LEFT JOIN workout_types wt ON wr.workout_type_id = wt.id
        WHERE wr.app_user_id = $1
        ORDER BY wr.workout_date DESC
        LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [appUserId, limit, offset]);
    
    return {
        data: result.rows,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasMore: page < Math.ceil(total / limit)
        }
    };
};
```

**프론트엔드 무한 스크롤**:
```javascript
let currentPage = 1;
let isLoading = false;
let hasMore = true;

window.addEventListener('scroll', async () => {
    if (isLoading || !hasMore) return;
    
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    if (scrollTop + clientHeight >= scrollHeight - 200) {
        isLoading = true;
        currentPage++;
        const { data, pagination } = await fetchWorkouts(currentPage);
        appendWorkouts(data);
        hasMore = pagination.hasMore;
        isLoading = false;
    }
});
```

**예상 효과**: 
- 초기 로딩 시간 70-90% 단축
- 메모리 사용량 대폭 감소

---

## 2️⃣ 중간 우선순위 (1-2주 내 적용)

### 2.1 N+1 쿼리 문제 해결

**문제점**: 리스트 조회 후 각 항목마다 추가 쿼리 실행

**해결책**:
```javascript
// ❌ 나쁜 예: N+1 문제
const records = await getWorkoutRecords(userId);
for (const record of records) {
    // 각 record마다 DB 쿼리 실행!
    const sets = await getWorkoutSets(record.id);
    record.sets = sets;
}

// ✅ 좋은 예: JOIN 또는 일괄 조회
const records = await pool.query(`
    SELECT 
        wr.*,
        json_agg(
            json_build_object(
                'id', ws.id,
                'set_number', ws.set_number,
                'weight_kg', ws.weight_kg,
                'reps', ws.reps
            ) ORDER BY ws.set_number
        ) FILTER (WHERE ws.id IS NOT NULL) as sets
    FROM workout_records wr
    LEFT JOIN workout_sets ws ON wr.id = ws.workout_record_id
    WHERE wr.app_user_id = $1
    GROUP BY wr.id
    ORDER BY wr.workout_date DESC
`);
```

**적용 대상**:
- workout_records + workout_sets
- diet_records + diet_comments
- consultation_records + consultation_images
- members + trainers

**예상 효과**: API 응답 시간 5-10배 개선

---

### 2.2 캐싱 전략 구현

**해결책**:
```javascript
// 1. 서버 메모리 캐싱 (node-cache)
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 }); // 10분

app.get('/api/trainers', async (req, res) => {
    const cacheKey = 'trainers-list';
    const cached = cache.get(cacheKey);
    if (cached) {
        return res.json(cached);
    }
    
    const trainers = await getTrainers();
    cache.set(cacheKey, trainers);
    res.json(trainers);
});

// 2. HTTP 캐싱 헤더
app.get('/api/workout-types', async (req, res) => {
    res.set('Cache-Control', 'public, max-age=3600'); // 1시간
    const types = await getWorkoutTypes();
    res.json(types);
});

// 3. Service Worker 캐싱 강화
// sw.js
const CACHE_STRATEGY = {
    '/api/workout-types': 'cache-first',  // 거의 안 바뀜
    '/api/trainers': 'stale-while-revalidate', // 가끔 바뀜
    '/api/workout-records': 'network-first' // 자주 바뀜
};
```

**캐싱 적용 대상**:
- workout_types (운동 종류): 거의 변경 안 됨
- trainers (트레이너 목록): 가끔 변경
- centers (센터 목록): 거의 변경 안 됨

**예상 효과**: 반복 요청 응답 시간 90% 단축

---

### 2.3 데이터베이스 Connection Pool 최적화

**현재 상태 확인 필요**:
```javascript
// backend/*-db.js 파일들에서 각각 Pool 생성 중
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
```

**문제점**: 21개 DB 파일마다 별도의 Pool 생성 → 연결 낭비

**해결책**:
```javascript
// backend/db-pool.js (새 파일 생성)
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,                  // 최대 연결 수
  idleTimeoutMillis: 30000, // 유휴 연결 제거 시간
  connectionTimeoutMillis: 2000, // 연결 타임아웃
});

// 연결 상태 모니터링
pool.on('connect', () => {
  console.log('[DB Pool] 새 연결 생성');
});

pool.on('error', (err) => {
  console.error('[DB Pool] 에러:', err);
});

module.exports = pool;

// 모든 *-db.js 파일에서 사용
const pool = require('./db-pool');
```

**예상 효과**: 
- DB 연결 수 90% 감소
- 연결 오류 감소
- 메모리 사용량 감소

---

## 3️⃣ 낮은 우선순위 (장기 계획)

### 3.1 프론트엔드 프레임워크 도입

**현재**: Vanilla JS (약 50개 파일)
**문제**: 
- 코드 중복 많음
- 상태 관리 어려움
- 번들링/최적화 어려움

**옵션**:
1. **React** (가장 대중적)
2. **Vue.js** (학습 곡선 낮음)
3. **Svelte** (번들 크기 작음)

**예상 효과**: 개발 속도 2-3배, 유지보수성 향상

---

### 3.2 CDN 도입

**현재**: 모든 정적 파일을 서버에서 직접 제공
**해결**: Cloudflare CDN / AWS CloudFront

**예상 효과**: 
- 전세계 어디서든 빠른 로딩
- 서버 부하 50-70% 감소

---

### 3.3 데이터베이스 읽기 전용 복제본

**프로덕션 환경에서 고려**:
- Master: 쓰기 작업
- Replica: 읽기 작업 (리포트, 통계 등)

---

## 📊 예상 성능 개선 효과

| 항목 | 현재 | 개선 후 | 개선율 |
|------|------|---------|--------|
| 초기 로딩 시간 | 3-5초 | 1-2초 | 50-60% ↓ |
| API 응답 시간 | 500-2000ms | 50-200ms | 75-90% ↓ |
| 이미지 로딩 | 5-10초 | 1-2초 | 70-80% ↓ |
| DB 쿼리 시간 | 100-500ms | 10-50ms | 80-90% ↓ |
| 서버 메모리 | 500MB+ | 200-300MB | 40-60% ↓ |

---

## 🔧 구현 순서 제안

### Week 1-2: 즉시 적용 가능한 개선
1. ✅ 데이터베이스 인덱스 추가 (1일)
2. ✅ 이미지 Lazy Loading 구현 (2일)
3. ✅ API 페이지네이션 추가 (3일)
4. ✅ DB Connection Pool 통합 (1일)

### Week 3-4: 구조적 개선
5. ✅ N+1 쿼리 문제 해결 (5일)
6. ✅ 캐싱 시스템 구현 (3일)
7. ✅ CSS/JS 번들링 설정 (2일)

### Month 2-3: 고도화
8. ✅ 이미지 최적화 (sharp 도입)
9. ✅ 무한 스크롤 구현
10. ✅ 성능 모니터링 시스템

---

## 🎯 성능 측정 도구

### 1. 프론트엔드
```javascript
// Performance API 활용
window.addEventListener('load', () => {
    const perfData = window.performance.timing;
    const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
    console.log('[Performance] 페이지 로딩 시간:', pageLoadTime, 'ms');
});
```

### 2. 백엔드
```javascript
// 쿼리 실행 시간 측정 (이미 구현됨)
const SLOW_QUERY_THRESHOLD = process.env.SLOW_QUERY_THRESHOLD || 100;

async function query(text, params) {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (duration > SLOW_QUERY_THRESHOLD) {
        console.log('[Slow Query]', duration, 'ms:', text);
    }
    return res;
}
```

### 3. 모니터링 도구
- **Lighthouse**: 프론트엔드 성능 점수
- **pg-stat-statements**: PostgreSQL 쿼리 통계
- **New Relic / Datadog**: 프로덕션 모니터링

---

## 📝 다음 단계

1. **우선순위 결정**: 어떤 개선부터 시작할지 결정
2. **성능 베이스라인 측정**: 현재 성능 기록
3. **단계별 구현**: 위 계획대로 진행
4. **성능 재측정**: 개선 효과 검증
5. **반복**: 지속적인 최적화

---

## 💡 즉시 적용 가능한 Quick Wins

```sql
-- 1. 인덱스 추가 (5분)
CREATE INDEX CONCURRENTLY idx_workout_records_user_date 
ON workout_records(app_user_id, workout_date DESC);

CREATE INDEX CONCURRENTLY idx_diet_records_user_date 
ON diet_records(app_user_id, meal_date DESC);

CREATE INDEX CONCURRENTLY idx_members_trainer 
ON members(trainer);
```

```javascript
// 2. 이미지 Lazy Loading (10분)
document.addEventListener('DOMContentLoaded', () => {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                imageObserver.unobserve(img);
            }
        });
    });
    images.forEach(img => imageObserver.observe(img));
});
```

```javascript
// 3. HTTP 캐싱 헤더 추가 (5분)
app.use('/uploads', express.static('data/uploads', {
    maxAge: '1y', // 1년 캐싱
    immutable: true
}));
```

**이 3가지만 적용해도 체감 성능이 크게 개선됩니다!** 🚀
