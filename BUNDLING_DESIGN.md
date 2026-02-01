# 📦 번들링 설계 (Bundle Design)

> **프로젝트**: GoodLift FMS  
> **목적**: 역할별로 필요한 리소스만 로드하여 초기 로딩 속도 개선  
> **날짜**: 2026-02-01

---

## 🎯 현재 구조 분석

### 1️⃣ **관리자/트레이너 화면** (`public/index.html`)
**사용자**: SU, 관리자, 트레이너

**CSS 파일** (5개):
```
- css/style.css                  (공통 스타일)
- css/adminDayCalendar.css       (관리자 일간 캘린더)
- css/adminWeekCalendar.css      (관리자 주간 캘린더)
- css/app-user.css               (유저앱 스타일)
- css/consultation.css           (상담 기록)
```

**JS 파일** (20+개):
```
핵심 관리 기능:
- js/main.js                     (메인 진입점)
- js/member.js                   (회원 관리)
- js/trainer.js                  (트레이너 관리)
- js/center.js                   (센터 관리)
- js/sales.js                    (매출 관리)
- js/ledger.js                   (장부 관리)
- js/expense.js                  (지출 관리)
- js/renew.js                    (갱신 관리)
- js/trial.js                    (체험 관리)
- js/database.js                 (DB 관리)
- js/strategy.js                 (전략 관리)
- js/consultation.js             (상담 관리)
- js/secret.js                   (비밀 기능)

관리자 전용:
- js/adminDayCalendar.js         (일간 캘린더)
- js/adminWeekCalendar.js        (주간 캘린더)
- js/adminStats.js               (통계)

트레이너 전용:
- js/trainer-ledger.js           (트레이너 장부)

유저앱 진입점:
- js/userApp.js                  (유저앱 전환)
- js/app-user/index.js           (유저앱 메인)
```

---

### 2️⃣ **유저앱 화면** (`public/js/app-user/`)
**사용자**: 트레이너 (유저앱 모드), 일반 회원 (향후)

**CSS 파일** (1개):
```
- css/app-user.css               (유저앱 전용 스타일)
```

**JS 파일** (16개):
```
app-user/
├── index.js                     (메인 진입점)
├── layout.js                    (레이아웃)
├── api.js                       (API 헬퍼)
├── utils.js                     (유틸리티)
├── dashboard.js                 (대시보드)
├── diet/
│   ├── index.js                 (식단 메인)
│   ├── list.js                  (목록)
│   ├── calendar.js              (캘린더)
│   ├── detail.js                (상세)
│   ├── add.js                   (추가)
│   └── edit.js                  (수정)
└── workout/
    ├── index.js                 (운동 메인)
    ├── list.js                  (목록)
    ├── calendar.js              (캘린더)
    ├── comment.js               (코멘트)
    ├── add.js                   (추가)
    └── edit.js                  (수정)
```

---

### 3️⃣ **Elmo 앱** (`public-elmo/`)
**사용자**: Elmo 시스템 사용자

**CSS 파일** (1개):
```
- public-elmo/css/elmo.css       (Elmo 전용 스타일)
```

**JS 파일** (6개):
```
public-elmo/js/
├── elmo-index.js                (진입점)
├── elmo-main.js                 (메인 로직)
├── elmo-layout.js               (레이아웃)
├── account-management/
│   └── index.js                 (계정 관리)
└── calendar/
    ├── index.js                 (캘린더 메인)
    ├── calendar.js              (캘린더 로직)
    └── modals.js                (모달)
```

---

## 🎯 번들링 전략 (3-Bundle Strategy)

### Bundle 1: **Admin Bundle** (관리자/트레이너)
```
📦 admin.bundle.css (67KB → 33KB 압축)
   ├─ style.css
   ├─ adminDayCalendar.css
   ├─ adminWeekCalendar.css
   └─ consultation.css

📦 admin.bundle.js (320KB → 120KB 압축)
   ├─ main.js
   ├─ member.js
   ├─ trainer.js
   ├─ center.js
   ├─ sales.js
   ├─ ledger.js
   ├─ expense.js
   ├─ renew.js
   ├─ trial.js
   ├─ database.js
   ├─ strategy.js
   ├─ consultation.js
   ├─ secret.js
   ├─ adminDayCalendar.js
   ├─ adminWeekCalendar.js
   ├─ adminStats.js
   └─ trainer-ledger.js
```

**로드 대상**: SU, 관리자, 트레이너 (관리 화면)

---

### Bundle 2: **App-User Bundle** (유저앱)
```
📦 app-user.bundle.css (35KB → 17KB 압축)
   └─ app-user.css

📦 app-user.bundle.js (145KB → 55KB 압축)
   ├─ userApp.js
   ├─ app-user/index.js
   ├─ app-user/layout.js
   ├─ app-user/api.js
   ├─ app-user/utils.js
   ├─ app-user/dashboard.js
   ├─ app-user/diet/*.js (6개)
   └─ app-user/workout/*.js (6개)
```

**로드 대상**: 트레이너 (유저앱 모드), 일반 회원

---

### Bundle 3: **Elmo Bundle** (Elmo 앱)
```
📦 elmo.bundle.css (28KB → 14KB 압축)
   └─ elmo.css

📦 elmo.bundle.js (85KB → 32KB 압축)
   ├─ elmo-index.js
   ├─ elmo-main.js
   ├─ elmo-layout.js
   ├─ account-management/index.js
   └─ calendar/*.js (3개)
```

**로드 대상**: Elmo 시스템 사용자

---

## 📊 성능 개선 예상치

### Before (현재):
```
관리자 화면 첫 로드:
- HTTP 요청: 25개 (CSS 5개 + JS 20개)
- 총 데이터: ~400KB
- 로딩 시간: ~3-5초 (3G 환경)

유저앱 첫 로드:
- HTTP 요청: 18개 (CSS 1개 + JS 17개)
- 총 데이터: ~180KB
- 로딩 시간: ~2-3초 (3G 환경)

Elmo 앱 첫 로드:
- HTTP 요청: 7개 (CSS 1개 + JS 6개)
- 총 데이터: ~115KB
- 로딩 시간: ~1-2초 (3G 환경)
```

### After (번들링 후):
```
관리자 화면 첫 로드:
- HTTP 요청: 2개 (CSS 1개 + JS 1개)
- 총 데이터: ~153KB (62% 감소!)
- 로딩 시간: ~0.5-1초 (3G 환경) ⚡

유저앱 첫 로드:
- HTTP 요청: 2개 (CSS 1개 + JS 1개)
- 총 데이터: ~72KB (60% 감소!)
- 로딩 시간: ~0.4-0.8초 (3G 환경) ⚡

Elmo 앱 첫 로드:
- HTTP 요청: 2개 (CSS 1개 + JS 1개)
- 총 데이터: ~46KB (60% 감소!)
- 로딩 시간: ~0.3-0.6초 (3G 환경) ⚡

→ 요청 수: 87% 감소 (50개 → 6개)
→ 데이터: 60% 감소
→ 로딩 속도: 5-10배 빠름! 🚀
```

---

## 🛠️ 구현 방안 (Vite 사용 추천)

### 옵션 1: **Vite** (가장 간단, 추천 ⭐)

#### 장점:
- 설정 최소화 (거의 Zero-Config)
- 빠른 빌드 속도 (esbuild 기반)
- 개발 서버 HMR 지원 (Hot Module Replacement)
- 자동 코드 스플리팅
- 현대적인 도구 체인

#### 설치:
```bash
cd backend
npm install vite --save-dev
```

#### 폴더 구조:
```
backend/
├── vite.config.js              (Vite 설정)
├── package.json
└── (기존 파일들)

public/
├── src/                         (소스 코드 - 새로 생성)
│   ├── admin/
│   │   ├── main.js             (진입점)
│   │   └── (기존 js 파일 이동)
│   ├── app-user/
│   │   ├── main.js             (진입점)
│   │   └── (기존 app-user 폴더)
│   └── styles/
│       ├── admin.css           (관리자 CSS 통합)
│       └── app-user.css
├── dist/                        (빌드 결과물 - 자동 생성)
│   ├── admin.bundle.js
│   ├── admin.bundle.css
│   ├── app-user.bundle.js
│   └── app-user.bundle.css
└── index.html                   (수정 필요)

public-elmo/
├── src/
│   ├── main.js
│   └── (기존 js 파일 이동)
└── dist/
    ├── elmo.bundle.js
    └── elmo.bundle.css
```

#### vite.config.js:
```javascript
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    // 멀티 번들 설정
    rollupOptions: {
      input: {
        // 관리자 번들
        admin: resolve(__dirname, '../public/index.html'),
        // 유저앱 번들 (동적 로드)
        'app-user': resolve(__dirname, '../public/src/app-user/main.js'),
        // Elmo 번들
        elmo: resolve(__dirname, '../public-elmo/index.html'),
      },
      output: {
        // 파일명 패턴
        entryFileNames: '[name].bundle.js',
        chunkFileNames: '[name].[hash].js',
        assetFileNames: '[name].[ext]',
      }
    },
    outDir: '../public/dist',
    emptyOutDir: true,
    minify: 'esbuild', // 빠른 압축
  },
  // 개발 서버 설정
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000' // 백엔드 프록시
    }
  }
});
```

#### package.json에 스크립트 추가:
```json
{
  "scripts": {
    "bundle": "vite build",
    "bundle:watch": "vite build --watch",
    "dev:bundle": "vite"
  }
}
```

#### 사용법:
```bash
# 프로덕션 빌드
npm run bundle

# 개발 모드 (파일 변경 감지)
npm run bundle:watch

# 개발 서버 (HMR 포함)
npm run dev:bundle
```

---

### 옵션 2: **Rollup** (세밀한 제어 필요 시)

#### 장점:
- 트리 쉐이킹 최적화
- 플러그인 생태계
- 라이브러리 번들링에 강함

#### rollup.config.js:
```javascript
import { terser } from 'rollup-plugin-terser';
import resolve from '@rollup/plugin-node-resolve';
import postcss from 'rollup-plugin-postcss';

export default [
  // 관리자 번들
  {
    input: 'public/src/admin/main.js',
    output: {
      file: 'public/dist/admin.bundle.js',
      format: 'iife',
      name: 'AdminApp'
    },
    plugins: [
      resolve(),
      postcss({
        extract: 'admin.bundle.css',
        minimize: true
      }),
      terser()
    ]
  },
  // 유저앱 번들
  {
    input: 'public/src/app-user/main.js',
    output: {
      file: 'public/dist/app-user.bundle.js',
      format: 'iife',
      name: 'UserApp'
    },
    plugins: [
      resolve(),
      postcss({
        extract: 'app-user.bundle.css',
        minimize: true
      }),
      terser()
    ]
  },
  // Elmo 번들
  {
    input: 'public-elmo/src/main.js',
    output: {
      file: 'public-elmo/dist/elmo.bundle.js',
      format: 'iife',
      name: 'ElmoApp'
    },
    plugins: [
      resolve(),
      postcss({
        extract: 'elmo.bundle.css',
        minimize: true
      }),
      terser()
    ]
  }
];
```

---

## 📝 HTML 수정 사항

### public/index.html (Before):
```html
<!-- 현재: 여러 파일 로드 -->
<link rel="stylesheet" href="css/style.css">
<link rel="stylesheet" href="css/adminDayCalendar.css">
<link rel="stylesheet" href="css/adminWeekCalendar.css">
<link rel="stylesheet" href="css/app-user.css">
<link rel="stylesheet" href="css/consultation.css">

<script type="module" src="js/main.js"></script>
```

### public/index.html (After):
```html
<!-- 번들링 후: 한 파일만 로드 -->
<link rel="stylesheet" href="dist/admin.bundle.css">
<script src="dist/admin.bundle.js"></script>
```

### 유저앱 동적 로드 (트레이너가 유저앱 버튼 클릭 시):
```javascript
// public/dist/admin.bundle.js 내부
async function switchToAppUserView() {
  // 유저앱 번들 동적 로드
  if (!window.userAppLoaded) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/dist/app-user.bundle.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = '/dist/app-user.bundle.js';
    await new Promise(resolve => {
      script.onload = resolve;
      document.body.appendChild(script);
    });

    window.userAppLoaded = true;
  }

  // 유저앱 초기화
  window.UserApp.init();
}
```

---

## 🚀 구현 단계 (Step-by-Step)

### Phase 1: **준비 및 테스트** (1일)
1. ✅ Vite 설치
2. ✅ 관리자 번들 1개만 테스트 빌드
3. ✅ 로컬에서 번들 동작 확인
4. ✅ 기존 기능 정상 작동 검증

### Phase 2: **전체 번들링 적용** (1-2일)
1. ✅ 3개 번들 모두 설정
2. ✅ HTML 파일 수정 (번들 참조)
3. ✅ 동적 로드 로직 구현
4. ✅ Service Worker 캐시 전략 업데이트
5. ✅ 로컬 테스트

### Phase 3: **배포 및 모니터링** (1일)
1. ✅ 스테이징 서버 테스트
2. ✅ 프로덕션 배포
3. ✅ 성능 측정 (로딩 시간, 번들 크기)
4. ✅ 사용자 피드백 수집

---

## ⚠️ 주의사항 및 리스크

### 1. **Service Worker 캐시 업데이트**
- 번들 파일명에 해시 추가 권장 (예: `admin.abc123.js`)
- PWA 버전 업데이트 시 새 번들 강제 로드 필요

```javascript
// public/sw.js 수정 필요
const CACHE_NAME = `goodlift-v${VERSION}`;
const urlsToCache = [
  '/dist/admin.bundle.css',
  '/dist/admin.bundle.js',
  // 해시 포함된 파일명 고려
];
```

### 2. **Import 경로 변경**
- 현재: `import { center } from './center.js';`
- 번들링 후: 경로가 상대적으로 변경될 수 있음
- Vite가 자동으로 해결하지만, 빌드 후 테스트 필수

### 3. **동적 로드 순서**
- 트레이너가 "유저앱" 전환 시 번들 로딩 완료 전까지 UI 대기 필요
- 로딩 인디케이터 추가 권장

### 4. **기존 기능 호환성**
- 현재 `type="module"` 사용 중
- 번들링 후 일반 `<script>` 태그로 변경
- 전역 스코프 충돌 가능성 체크

---

## 📈 성능 모니터링 지표

### 측정 항목:
1. **First Contentful Paint (FCP)**: 첫 콘텐츠 표시 시간
2. **Time to Interactive (TTI)**: 상호작용 가능 시간
3. **Total Bundle Size**: 총 번들 크기
4. **Cache Hit Rate**: PWA 캐시 적중률

### 목표:
- FCP: 1초 이내
- TTI: 2초 이내
- 번들 크기: 각 150KB 이하 (gzip)
- 캐시 적중률: 95% 이상

---

## 🎯 결론 및 추천 사항

### ✅ **추천: Vite 사용**
- 이유:
  1. 설정 간단 (Zero-Config에 가까움)
  2. 빠른 빌드 속도
  3. 개발 경험 우수 (HMR)
  4. 프로덕션 최적화 자동

### 📅 **적용 시기**
- **지금 바로**: ❌ 인덱스, 레이지로딩 먼저 적용 후 안정화
- **1-2주 후**: ✅ 현재 최적화 배포 후, 사용자 피드백 받은 뒤 적용
- **장기적으로**: ✅✅ React 마이그레이션 시 자동으로 번들링 적용됨

### 🎯 **우선순위**
1. **높음** (지금): DB 인덱스, 이미지 레이지로딩 → **체감 성능 개선**
2. **중간** (1-2주 후): 번들링 → **로딩 속도 개선**
3. **낮음** (향후): API 페이지네이션, Connection Pool → **확장성 개선**

---

## 📞 다음 단계

1. **지금**: 인덱스 + 레이지로딩 배포 및 모니터링
2. **1-2주 후**: 번들링 도입 여부 결정
3. **필요 시**: 이 문서 기반으로 Vite 설정 구현

---

**작성자**: AI Assistant  
**검토 필요**: 개발자 승인 후 적용  
**업데이트**: 2026-02-01
