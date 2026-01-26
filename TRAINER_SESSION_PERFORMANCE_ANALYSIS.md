# 트레이너 세션 로딩 성능 개선 분석

## 🔍 발견된 성능 문제점

### 1. **중복 API 호출 문제**

#### 문제 1-1: `renderCalUI` 함수 내 중복 호출
- **위치**: `public/js/trainer.js` 477줄, 1077줄
- **문제**: 
  - 477줄에서 전체 세션을 가져옴: `/api/sessions?trainer=${username}`
  - 1077줄에서 같은 함수 내에서 특정 날짜의 세션을 또 가져옴: `/api/sessions?trainer=${username}&date=${dateParam}`
- **영향**: 같은 렌더링 사이클에서 불필요한 중복 요청 발생

#### 문제 1-2: `updateTimeDropdowns` 함수의 중복 호출
- **위치**: `public/js/trainer.js` 968줄
- **문제**: 
  - `renderCalUI`에서 이미 특정 날짜의 세션을 가져왔는데, `updateTimeDropdowns`에서 같은 날짜의 세션을 다시 가져옴
- **영향**: 시간 드롭다운 업데이트 시마다 불필요한 API 호출

#### 문제 1-3: 모달에서의 중복 호출
- **위치**: `public/js/trainer.js` 2650줄, 2776줄, 2783줄
- **문제**:
  - `renderSignBody`: 전체 세션을 가져옴 (2650줄) - 특정 세션 하나만 필요한데 전체 조회
  - `renderChangeBody`: 전체 세션을 가져온 후 (2776줄), 또 특정 날짜의 세션을 가져옴 (2783줄)
- **영향**: 모달 열 때마다 불필요한 전체 세션 조회

#### 문제 1-4: 날짜 변경 시 중복 호출
- **위치**: `public/js/trainer.js` 2858줄
- **문제**: 날짜 변경 시마다 특정 날짜의 세션을 다시 가져옴
- **영향**: 사용자가 날짜를 변경할 때마다 API 호출 발생

### 2. **캐싱 부재**

#### 문제 2-1: 세션 데이터 캐싱 없음
- **현재 상태**: `calState` 객체에 세션 데이터를 저장하지 않음
- **위치**: `public/js/trainer.js` 343줄
- **문제**: 
  - `renderCalUI`가 호출될 때마다 전체 세션을 서버에서 다시 가져옴
  - 같은 데이터를 반복적으로 요청
- **영향**: 네트워크 트래픽 증가, 응답 시간 지연

#### 문제 2-2: 날짜별 세션 캐싱 없음
- **문제**: 특정 날짜의 세션을 여러 번 요청해도 캐싱하지 않음
- **영향**: 같은 날짜의 세션을 여러 함수에서 각각 요청

### 3. **불필요한 전체 세션 조회**

#### 문제 3-1: 단일 세션 조회 시 전체 조회
- **위치**: `public/js/trainer.js` 2650줄, 2654줄
- **문제**: 
  ```javascript
  fetch(`/api/sessions?trainer=${username}`).then(r=>r.json())
  .then(allSessions => {
    const session = allSessions.find(s => s.id === sessionId);
  ```
  - 특정 세션 하나만 필요한데 전체 세션을 가져와서 클라이언트에서 필터링
- **영향**: 불필요한 데이터 전송, 메모리 사용량 증가

#### 문제 3-2: 백엔드 API 최적화 부족
- **위치**: `backend/server.js` 3445줄
- **현재**: 단일 세션 조회 API가 없음 (`/api/sessions/:id`)
- **영향**: 단일 세션 조회 시에도 전체 조회 후 필터링 필요

### 4. **렌더링 최적화 부족**

#### 문제 4-1: `renderCalUI` 호출 빈도
- **위치**: `public/js/trainer.js` (다수 위치)
- **문제**: 
  - 세션 추가/수정/삭제 시마다 `renderCalUI` 호출
  - `renderCalUI` 호출 시마다 전체 세션 재조회
- **영향**: 불필요한 렌더링과 API 호출

#### 문제 4-2: 배치 처리 부재
- **문제**: 여러 세션을 동시에 업데이트할 때 각각 API 호출
- **영향**: 네트워크 요청 수 증가

## 📊 성능 개선 방안

### 개선 방안 1: 세션 데이터 캐싱 구현

```javascript
// calState에 세션 캐시 추가
let calState = {
  year: null,
  month: null,
  today: null,
  viewMode: 'month',
  weekStartDate: null,
  initialWeekScroll: false,
  savedScrollPosition: null,
  scrollToDate: null,
  // 추가
  sessionsCache: {
    allSessions: null,        // 전체 세션 캐시
    lastFetchTime: null,      // 마지막 조회 시간
    dateCache: {}             // 날짜별 세션 캐시 { '2026-01-26': [...], ... }
  }
};

// 캐시 유효성 검사 (예: 5분)
const CACHE_TTL = 5 * 60 * 1000; // 5분

function getCachedSessions(date = null) {
  const now = Date.now();
  const cache = calState.sessionsCache;
  
  if (date) {
    // 날짜별 캐시 확인
    if (cache.dateCache[date] && 
        (now - cache.dateCache[date].timestamp) < CACHE_TTL) {
      return cache.dateCache[date].sessions;
    }
  } else {
    // 전체 세션 캐시 확인
    if (cache.allSessions && 
        cache.lastFetchTime && 
        (now - cache.lastFetchTime) < CACHE_TTL) {
      return cache.allSessions;
    }
  }
  
  return null;
}

function setCachedSessions(sessions, date = null) {
  const cache = calState.sessionsCache;
  const now = Date.now();
  
  if (date) {
    cache.dateCache[date] = {
      sessions: sessions,
      timestamp: now
    };
  } else {
    cache.allSessions = sessions;
    cache.lastFetchTime = now;
  }
}

function invalidateSessionsCache() {
  calState.sessionsCache.allSessions = null;
  calState.sessionsCache.lastFetchTime = null;
  calState.sessionsCache.dateCache = {};
}
```

**예상 효과**:
- API 호출 수 70-80% 감소
- 렌더링 속도 50% 이상 개선

### 개선 방안 2: 중복 호출 제거

```javascript
// renderCalUI 함수 개선
async function renderCalUI(container, forceDate) {
  const username = localStorage.getItem('username');
  
  // 전체 세션 가져오기 (캐시 확인)
  let allSessions = getCachedSessions();
  if (!allSessions) {
    const sessionsRes = await fetch(`/api/sessions?trainer=${encodeURIComponent(username)}`);
    allSessions = await sessionsRes.json();
    setCachedSessions(allSessions);
  }
  
  // ... 기존 로직 ...
  
  // 특정 날짜의 세션은 전체 세션에서 필터링 (별도 API 호출 제거)
  const dateParam = calState.viewMode === 'week' ? targetDate : `${yyyy}-${mm}-${dd}`;
  const daySessions = allSessions.filter(s => s.date === dateParam);
  
  // updateTimeDropdowns에도 daySessions 전달
  updateTimeDropdowns(daySessions);
}
```

**예상 효과**:
- `renderCalUI` 호출 시 API 호출 수 50% 감소

### 개선 방안 3: 단일 세션 조회 API 추가

**백엔드** (`backend/server.js`):
```javascript
// 단일 세션 조회 API 추가
app.get('/api/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const session = await sessionsDB.getSessionById(id);
    if (!session) {
      return res.status(404).json({ message: '세션을 찾을 수 없습니다.' });
    }
    res.json(session);
  } catch (error) {
    console.error('[API] 세션 조회 오류:', error);
    res.status(500).json({ message: '세션 조회 중 오류가 발생했습니다.' });
  }
});
```

**프론트엔드** (`public/js/trainer.js`):
```javascript
// renderSignBody 개선
function renderSignBody(sessionId, hasNoRemaining) {
  // 전체 세션 대신 단일 세션만 조회
  Promise.all([
    fetch(`/api/sessions/${sessionId}`).then(r=>r.json()),
    fetch('/api/members').then(r=>r.json()),
    fetch('/api/trainers').then(r=>r.json())
  ]).then(([session, members, trainers]) => {
    // ... 기존 로직 ...
  });
}
```

**예상 효과**:
- 모달 열 때 데이터 전송량 90% 이상 감소

### 개선 방안 4: 배치 업데이트 및 캐시 무효화

```javascript
// 세션 추가/수정/삭제 후 캐시 무효화
async function addSession(data) {
  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (res.ok) {
    // 캐시 무효화
    invalidateSessionsCache();
    // 특정 날짜 캐시만 무효화할 수도 있음
    // delete calState.sessionsCache.dateCache[data.date];
    
    renderCalUI(container);
  }
}
```

**예상 효과**:
- 데이터 일관성 보장
- 불필요한 캐시 사용 방지

### 개선 방안 5: 주간보기 최적화

```javascript
// 주간보기 시 주간 범위의 세션만 조회
if (calState.viewMode === 'week') {
  const weekStart = new Date(calState.weekStartDate + 'T00:00:00');
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  
  // 주간 범위로 API 호출 (백엔드에 week 파라미터 지원)
  const sessionsRes = await fetch(
    `/api/sessions?trainer=${encodeURIComponent(username)}&week=${calState.weekStartDate}`
  );
  const weekSessions = await sessionsRes.json();
  
  // 주간 세션만 캐시
  setCachedSessions(weekSessions, `week-${calState.weekStartDate}`);
}
```

**예상 효과**:
- 주간보기 시 데이터 전송량 80% 감소

## 📈 예상 성능 개선 효과

| 항목 | 현재 | 개선 후 | 개선율 |
|------|------|---------|--------|
| `renderCalUI` 호출 시 API 요청 수 | 2-3회 | 0-1회 | 70-100% 감소 |
| 모달 열 때 데이터 전송량 | 전체 세션 | 단일 세션 | 90% 이상 감소 |
| 날짜 변경 시 API 호출 | 매번 호출 | 캐시 사용 | 100% 감소 (캐시 유효 시) |
| 전체 페이지 로드 시간 | 기준 | 50-70% 단축 | - |

## 🎯 우선순위

1. **높음**: 세션 데이터 캐싱 구현 (개선 방안 1)
2. **높음**: 중복 호출 제거 (개선 방안 2)
3. **중간**: 단일 세션 조회 API 추가 (개선 방안 3)
4. **중간**: 배치 업데이트 및 캐시 무효화 (개선 방안 4)
5. **낮음**: 주간보기 최적화 (개선 방안 5)

## ⚠️ 주의사항

1. **캐시 무효화 타이밍**: 세션 추가/수정/삭제 시 반드시 캐시 무효화
2. **캐시 TTL 설정**: 너무 길면 데이터 불일치, 너무 짧으면 효과 감소
3. **메모리 관리**: 날짜별 캐시가 무한정 증가하지 않도록 LRU 캐시 고려
4. **동시성**: 여러 탭에서 동일한 데이터를 수정할 경우 캐시 일관성 문제 가능
