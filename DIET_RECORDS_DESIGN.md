# 식단기록 기능 설계 문서

## 📋 목차
1. [개요](#개요)
2. [데이터베이스 설계](#데이터베이스-설계)
3. [이미지 저장 전략](#이미지-저장-전략)
4. [PWA 로컬 저장 전략](#pwa-로컬-저장-전략)
5. [성능 최적화](#성능-최적화)
6. [API 설계](#api-설계)
7. [프론트엔드 설계](#프론트엔드-설계)
8. [구현 단계](#구현-단계)

---

## 개요

### 기능 요구사항
1. **음식 등록**: 유저가 음식 사진이나 이름을 시간을 포함해서 등록
2. **코멘트 기능**: 담당 트레이너와 유저가 채팅창처럼 코멘트 가능
3. **캘린더 뷰**: 운동기록처럼 캘린더 화면 제공, 기록일 선택 가능

### 기술 스택
- **백엔드**: Node.js + Express + PostgreSQL
- **프론트엔드**: 순수 HTML/CSS/JavaScript (PWA)
- **이미지 저장**: 서버 파일시스템 + CDN/클라우드 스토리지 (향후 확장)

---

## 데이터베이스 설계

### 1. 식단기록 테이블 (`diet_records`)

#### 기본 스키마
```sql
CREATE TABLE diet_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  meal_date DATE NOT NULL,
  meal_time TIME,                    -- 식사 시간 (HH:MM:SS)
  food_name VARCHAR(200),            -- 음식명 (사진만 있을 수 있음)
  image_url VARCHAR(500),            -- 이미지 파일 경로 (상대 경로)
  image_thumbnail_url VARCHAR(500),  -- 썸네일 경로 (성능 최적화용)
  notes TEXT,                         -- 유저가 작성한 메모
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 마이그레이션 패턴 (기존 DB 모듈 패턴 준수) ⚠️ **중요**

**테이블 생성 로직:**
```javascript
const createDietRecordsTable = async () => {
  try {
    // 1. 테이블 존재 여부 확인 (기존 패턴: information_schema.tables 사용)
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'diet_records'
    `;
    const checkResult = await pool.query(checkQuery);
    
    // 2. 테이블이 없을 때만 생성
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE diet_records (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          meal_date DATE NOT NULL,
          meal_time TIME,
          food_name VARCHAR(200),
          image_url VARCHAR(500),
          image_thumbnail_url VARCHAR(500),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await pool.query(createQuery);
      await pool.query("SET client_encoding TO 'UTF8'");
      
      // 인덱스 생성
      await createDietRecordsIndexes();
      
      console.log('[PostgreSQL] diet_records 테이블이 생성되었습니다.');
    } else {
      console.log('[PostgreSQL] diet_records 테이블이 이미 존재합니다.');
      // 기존 테이블 마이그레이션 실행
      await migrateDietRecordsTable();
    }
  } catch (error) {
    console.error('[PostgreSQL] 식단기록 테이블 생성 오류:', error);
    throw error;
  }
};
```

**마이그레이션 함수 (컬럼 추가/변경용):**
```javascript
const migrateDietRecordsTable = async () => {
  try {
    // 기존 컬럼 확인
    const columnsQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'diet_records'
      ORDER BY ordinal_position
    `;
    const columnsResult = await pool.query(columnsQuery);
    const existingColumns = columnsResult.rows.map(row => row.column_name);
    
    // 필요한 컬럼이 없으면 추가
    if (!existingColumns.includes('meal_time')) {
      await pool.query(`
        ALTER TABLE diet_records 
        ADD COLUMN meal_time TIME
      `);
      console.log('[PostgreSQL] meal_time 컬럼이 추가되었습니다.');
    }
    
    if (!existingColumns.includes('image_thumbnail_url')) {
      await pool.query(`
        ALTER TABLE diet_records 
        ADD COLUMN image_thumbnail_url VARCHAR(500)
      `);
      console.log('[PostgreSQL] image_thumbnail_url 컬럼이 추가되었습니다.');
    }
    
    // 인덱스 업데이트 (필요시)
    await createDietRecordsIndexes();
  } catch (error) {
    console.error('[PostgreSQL] diet_records 테이블 마이그레이션 오류:', error);
    throw error;
  }
};
```

**인덱스 생성 (IF NOT EXISTS 패턴):**
```javascript
const createDietRecordsIndexes = async () => {
  try {
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_diet_records_user_id ON diet_records(app_user_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_diet_records_date ON diet_records(meal_date)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_diet_records_user_date 
      ON diet_records(app_user_id, meal_date DESC)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_diet_records_user_date_created 
      ON diet_records(app_user_id, meal_date DESC, created_at DESC)
    `);
    
    console.log('[PostgreSQL] 식단기록 인덱스가 생성되었습니다.');
    
    // 인덱스 변경 후 통계 정보 업데이트
    await pool.query(`ANALYZE diet_records`);
  } catch (error) {
    console.error('[PostgreSQL] 식단기록 인덱스 생성 오류:', error);
  }
};
```

**데이터베이스 연결 (환경변수 기반):**
```javascript
const { Pool } = require('pg');

// PostgreSQL 연결 풀 생성 (기존 DB 모듈 패턴과 동일)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Local: NODE_ENV !== 'production' → SSL 비활성화
  // Render: NODE_ENV === 'production' → SSL 활성화
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
```

### 2. 식단 코멘트 테이블 (`diet_comments`)

#### 기본 스키마
```sql
CREATE TABLE diet_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diet_record_id UUID NOT NULL REFERENCES diet_records(id) ON DELETE CASCADE,
  commenter_type VARCHAR(20) NOT NULL CHECK (commenter_type IN ('user', 'trainer')),
  commenter_id UUID NOT NULL,         -- app_user_id 또는 trainer_id
  commenter_name VARCHAR(100),        -- 표시용 이름 (캐시)
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 마이그레이션 패턴 (동일하게 적용)
- `createDietCommentsTable()`: 테이블 존재 확인 후 생성
- `migrateDietCommentsTable()`: 기존 테이블에 컬럼 추가/변경
- `createDietCommentsIndexes()`: 인덱스 생성 (IF NOT EXISTS)

### 3. 트레이너-유저 매핑 확인

트레이너가 코멘트할 수 있는 유저인지 확인하려면:
- `app_users.member_name` → `members.name` 매핑 확인
- `members.trainer` 필드로 담당 트레이너 확인
- 또는 별도 `user_trainer_mappings` 테이블 사용 (향후 확장)

---

## 이미지 저장 전략

### 추천 방식: 하이브리드 접근법

#### 1. 서버 파일시스템 저장 (초기 구현)

**장점:**
- 구현이 간단하고 빠름
- 추가 인프라 비용 없음
- 개발/테스트 환경에 적합

**환경변수 기반 저장 경로 (로컬/Render 구분)** ⚠️ **중요**

```javascript
// server.js 또는 diet-records-db.js
const path = require('path');
const fs = require('fs');

// 기존 패턴: DATA_DIR 환경변수 사용 (기본값: ../data)
// 이미지 저장도 동일한 패턴으로 data 폴더 안에 uploads 생성
const getUploadsDir = () => {
  // DATA_DIR 환경변수 사용 (기존 패턴과 일관성 유지)
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
  
  // Render 환경 확인: NODE_ENV === 'production' 또는 RENDER 환경변수 존재
  const isRender = process.env.NODE_ENV === 'production' || process.env.RENDER;
  
  if (isRender) {
    // Render: /data/uploads 사용 (영구 디스크)
    // DATA_DIR이 /data이므로 그 안에 uploads 생성
    return process.env.UPLOADS_DIR || path.join(DATA_DIR, 'uploads');
  } else {
    // Local: data 폴더 안에 uploads 생성 (기존 DATA_DIR 패턴과 일관성)
    return process.env.UPLOADS_DIR || path.join(DATA_DIR, 'uploads');
  }
};

const UPLOADS_DIR = getUploadsDir();
const DIET_IMAGES_DIR = path.join(UPLOADS_DIR, 'diet-images');

// 디렉토리가 없으면 생성 (recursive: true로 하위 디렉토리까지 자동 생성)
const ensureDirectories = () => {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      console.log(`[Diet Records] 업로드 디렉토리 생성: ${UPLOADS_DIR}`);
    }
    if (!fs.existsSync(DIET_IMAGES_DIR)) {
      fs.mkdirSync(DIET_IMAGES_DIR, { recursive: true });
      console.log(`[Diet Records] 식단 이미지 디렉토리 생성: ${DIET_IMAGES_DIR}`);
    }
  } catch (error) {
    console.error(`[Diet Records] 디렉토리 생성 오류: ${error.message}`);
    throw error;
  }
};

// 서버 시작 시 디렉토리 생성
ensureDirectories();
```

**환경변수 설정:**
- **Local (개발)**: 
  - 기본값: `./data/uploads` (프로젝트 폴더 내 data/uploads)
  - DATA_DIR 환경변수로 data 폴더 위치 변경 가능 (기본값: `../data`)
  - 선택사항: `.env` 파일에 `UPLOADS_DIR=./custom-uploads` 설정 가능
- **Render (운영)**: 
  - 기본값: `/data/uploads` (Render의 영구 디스크, DATA_DIR이 /data이므로)
  - 선택사항: Render 대시보드에서 환경변수 `UPLOADS_DIR` 설정 가능

**주의사항:**
- ✅ Render의 `/data` 경로는 영구 디스크이므로 재배포 후에도 데이터 유지
- ⚠️ Render의 임시 디스크(`/tmp`)는 재배포 시 초기화되므로 사용하지 않음
- 🔄 향후 클라우드 스토리지(S3, Cloudflare R2 등) 전환 시 이 로직은 사용하지 않음

**구조:**
```
uploads/  (또는 환경변수로 지정한 경로)
  diet-images/
    2025/
      01/
        {diet_record_id}/
          original.jpg          # 원본 이미지
          thumbnail_300x300.jpg # 썸네일 (300x300)
```

**파일명 규칙:**
- UUID 기반: `{diet_record_id}.{확장자}`
- 타임스탬프 추가: `{diet_record_id}_{timestamp}.{확장자}` (중복 방지)

**DB 저장 형식:**
- `image_url`: `/uploads/diet-images/2025/01/{diet_record_id}/original.jpg`
- `image_thumbnail_url`: `/uploads/diet-images/2025/01/{diet_record_id}/thumbnail_300x300.jpg`

**로컬/Render 경로 구조:**

**로컬 (개발 환경):**
```
프로젝트 루트/
  data/                    # DATA_DIR (기본값: ../data)
    accounts.json
    centers.json
    uploads/              # UPLOADS_DIR (기본값: data/uploads)
      diet-images/
        2025/
          01/
            {diet_record_id}/
              original.jpg
              thumbnail_300x300.jpg
```

**Render (운영 환경):**
```
/data/                    # DATA_DIR (Render 영구 디스크)
  uploads/                # UPLOADS_DIR (기본값: /data/uploads)
    diet-images/
      2025/
        01/
          {diet_record_id}/
            original.jpg
            thumbnail_300x300.jpg
```

**일관성:**
- Local과 Render 모두 `DATA_DIR/uploads` 구조 사용
- 기존 `DATA_DIR` 패턴과 일관성 유지
- 환경변수로 경로 커스터마이징 가능

**향후 전환 계획:**
- 현재: 파일시스템 저장 (`/data/uploads`) - 임시 테스트용
- 향후: 클라우드 스토리지(S3, Cloudflare R2 등)로 전환 예정
- 전환 시: 이미지 저장 로직만 교체, DB 스키마와 API는 동일하게 유지

#### 2. 향후 확장: 클라우드 스토리지 (AWS S3, Google Cloud Storage, Cloudflare R2)

**이점:**
- 서버 디스크 부하 감소
- CDN 연동으로 전송 속도 향상
- 자동 백업 및 버전 관리
- 무한 확장성

**마이그레이션 전략:**
- 환경변수로 저장소 타입 선택 (`STORAGE_TYPE=local|s3|gcs`)
- 추상화 레이어 구현하여 코드 변경 최소화

#### 3. 이미지 최적화 전략

**업로드 시 처리:**
1. **압축**: JPEG 품질 85% (고품질 유지하면서 용량 절감)
2. **리사이징**: 
   - 원본: 최대 1920x1920px
   - 썸네일: 300x300px (비율 유지)
3. **형식 변환**: 모든 이미지를 JPEG로 통일 (투명도 불필요)

**라이브러리 선택:**
- **sharp** (추천): Node.js용 고성능 이미지 처리
- **jimp**: 순수 JavaScript, 느리지만 의존성 없음

---

## PWA 로컬 저장 전략

### 1. IndexedDB 활용

**용도:**
- 오프라인 시 업로드 대기 이미지 임시 저장
- 캘린더 뷰용 썸네일 캐싱
- 빠른 초기 로딩을 위한 최근 식단기록 캐싱

**저장 구조:**
```javascript
// IndexedDB 스키마
{
  dietRecords: {
    keyPath: 'id',
    indexes: ['meal_date', 'app_user_id']
  },
  dietImages: {
    keyPath: 'diet_record_id',
    indexes: ['url']
  },
  pendingUploads: {
    keyPath: 'id',
    indexes: ['status', 'created_at']
  }
}
```

### 2. Service Worker 캐싱

**이미지 캐싱 전략:**
```javascript
// sw.js에 추가
const CACHE_NAME = 'goodlift-diet-v1';

// 썸네일은 캐시, 원본은 네트워크 우선
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // 썸네일은 캐시 우선
  if (url.pathname.includes('/thumbnail_')) {
    event.respondWith(
      caches.match(event.request)
        .then(response => response || fetch(event.request))
    );
  }
  
  // 원본은 네트워크 우선, 실패 시 캐시
  if (url.pathname.includes('/uploads/diet-images/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
```

### 3. 오프라인 업로드 큐

**동작 방식:**
1. 오프라인 시 이미지를 IndexedDB에 저장
2. 업로드 대기 목록에 추가
3. 온라인 복귀 시 자동 업로드
4. 업로드 성공 후 IndexedDB에서 삭제

**구현 예시:**
```javascript
// pendingUploads에 저장
{
  id: 'uuid',
  diet_record_id: null, // 업로드 후 생성
  image_file: File,     // Blob으로 저장
  meal_date: '2025-01-15',
  meal_time: '12:30:00',
  food_name: '치킨',
  status: 'pending',
  created_at: '2025-01-15T12:30:00Z'
}
```

### 4. 로컬 저장 한계 고려

**주의사항:**
- IndexedDB 용량: 브라우저마다 다름 (일반적으로 50MB~1GB)
- 이미지는 서버 저장이 필수 (로컬만 저장하지 않음)
- 로컬은 임시 저장용으로만 사용

**정리 전략:**
- 최근 30일 썸네일만 캐싱
- 오래된 캐시 자동 삭제
- 사용자 수동 캐시 삭제 기능 제공

---

## 성능 최적화

### 1. 이미지 최적화

#### 업로드 시
- **프론트엔드**: 클라이언트에서 리사이징 후 업로드 (Canvas API)
- **백엔드**: 서버에서 추가 최적화 (sharp)
- **결과**: 업로드 용량 50-70% 감소

#### 조회 시
- **썸네일 우선**: 리스트 뷰는 썸네일만 로드
- **지연 로딩 (Lazy Loading)**: 화면에 보이는 이미지만 로드
- **Progressive JPEG**: 점진적 이미지 로딩

### 2. 데이터베이스 최적화

#### 인덱스 전략
```sql
-- 자주 사용되는 쿼리 패턴
-- 1. 유저별 날짜 범위 조회
CREATE INDEX idx_diet_records_user_date ON diet_records(app_user_id, meal_date DESC);

-- 2. 코멘트 조회 (시간순)
CREATE INDEX idx_diet_comments_created ON diet_comments(diet_record_id, created_at ASC);
```

#### 쿼리 최적화
- **N+1 문제 해결**: JOIN으로 코멘트 일괄 조회
- **페이지네이션**: LIMIT/OFFSET 또는 커서 기반
- **캘린더용 경량 조회**: 날짜별 존재 여부만 반환

### 3. API 최적화

#### 캘린더 뷰 API
```javascript
// 경량 데이터만 반환 (이미지 URL 제외)
GET /api/diet-records/calendar?app_user_id=xxx&start_date=2025-01-01&end_date=2025-01-31

Response:
{
  "2025-01-15": {
    "hasDiet": true,
    "count": 3
  },
  "2025-01-16": {
    "hasDiet": false,
    "count": 0
  }
}
```

#### 리스트 뷰 API
```javascript
// 썸네일 URL만 포함, 페이지네이션
GET /api/diet-records?app_user_id=xxx&start_date=2025-01-01&end_date=2025-01-31&page=1&limit=20

Response:
{
  "records": [
    {
      "id": "...",
      "meal_date": "2025-01-15",
      "meal_time": "12:30:00",
      "food_name": "치킨",
      "image_thumbnail_url": "/uploads/.../thumbnail_300x300.jpg",
      "comment_count": 2
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20
}
```

#### 상세 조회 API
```javascript
// 원본 이미지 URL 포함, 코멘트 포함
GET /api/diet-records/:id

Response:
{
  "id": "...",
  "meal_date": "2025-01-15",
  "meal_time": "12:30:00",
  "food_name": "치킨",
  "image_url": "/uploads/.../original.jpg",
  "notes": "점심 식사",
  "comments": [
    {
      "id": "...",
      "commenter_type": "trainer",
      "commenter_name": "김트레이너",
      "comment_text": "단백질 보충 좋습니다!",
      "created_at": "2025-01-15T13:00:00Z"
    }
  ]
}
```

### 4. 프론트엔드 최적화

#### 이미지 로딩
- **Intersection Observer API**: 뷰포트 진입 시만 로드
- **Placeholder**: 로딩 중 썸네일 블러 효과
- **에러 처리**: 이미지 로드 실패 시 기본 이미지

#### 렌더링 최적화
- **가상 스크롤**: 긴 리스트에서 DOM 노드 최소화
- **디바운싱**: 검색/필터 입력 디바운스
- **메모이제이션**: 캘린더 렌더링 결과 캐싱

---

## API 설계

### 1. 식단기록 CRUD

#### 식단기록 목록 조회
```
GET /api/diet-records?app_user_id=xxx&start_date=2025-01-01&end_date=2025-01-31&page=1&limit=20
```

#### 식단기록 단일 조회
```
GET /api/diet-records/:id
```

#### 식단기록 추가
```
POST /api/diet-records
Content-Type: multipart/form-data

{
  app_user_id: UUID,
  meal_date: '2025-01-15',
  meal_time: '12:30:00',
  food_name: '치킨',
  notes: '점심 식사',
  image: File (optional)
}
```

#### 식단기록 수정
```
PATCH /api/diet-records/:id
Content-Type: multipart/form-data

{
  meal_date: '2025-01-15',
  meal_time: '12:30:00',
  food_name: '치킨',
  notes: '점심 식사',
  image: File (optional, 새로 업로드할 경우)
}
```

#### 식단기록 삭제
```
DELETE /api/diet-records/:id
```

### 2. 캘린더 조회

#### 캘린더용 경량 데이터
```
GET /api/diet-records/calendar?app_user_id=xxx&start_date=2025-01-01&end_date=2025-01-31
```

### 3. 코멘트 CRUD

#### 코멘트 목록 조회
```
GET /api/diet-records/:id/comments
```

#### 코멘트 추가
```
POST /api/diet-records/:id/comments

{
  commenter_type: 'user' | 'trainer',
  commenter_id: UUID,
  comment_text: '코멘트 내용'
}
```

#### 코멘트 수정
```
PATCH /api/diet-records/:id/comments/:comment_id

{
  comment_text: '수정된 코멘트 내용'
}
```

#### 코멘트 삭제
```
DELETE /api/diet-records/:id/comments/:comment_id
```

### 4. 이미지 업로드 (별도 엔드포인트)

#### 이미지 단독 업로드
```
POST /api/diet-records/image

Content-Type: multipart/form-data

{
  image: File
}

Response:
{
  image_url: '/uploads/diet-images/2025/01/uuid/original.jpg',
  image_thumbnail_url: '/uploads/diet-images/2025/01/uuid/thumbnail_300x300.jpg'
}
```

---

## 프론트엔드 설계

### 파일 구조
```
public/js/app-user/
  diet/
    index.js       # 식단기록 메인 화면
    list.js        # 식단기록 리스트
    calendar.js    # 캘린더 컴포넌트 (workout/calendar.js 참고)
    add.js         # 식단기록 추가
    edit.js        # 식단기록 수정
    detail.js      # 식단기록 상세 (코멘트 포함)
    comments.js    # 코멘트 컴포넌트
```

### 주요 컴포넌트

#### 1. 식단기록 추가 폼 (`add.js`)
- 날짜/시간 선택
- 음식명 입력
- 사진 업로드 (드래그 앤 드롭 지원)
- 이미지 미리보기
- 오프라인 업로드 큐 지원

#### 2. 캘린더 컴포넌트 (`calendar.js`)
- 운동기록 캘린더와 동일한 구조
- 날짜별 식단 존재 여부 표시
- 날짜 클릭 시 해당 날짜 식단 목록 표시

#### 3. 코멘트 컴포넌트 (`comments.js`)
- 채팅창 스타일 UI
- 트레이너/유저 구분 표시
- 실시간 업데이트 (폴링 또는 WebSocket)

#### 4. 이미지 갤러리
- 리스트 뷰: 썸네일 그리드
- 상세 뷰: 원본 이미지 확대
- 스와이프 네비게이션

---

## 구현 단계

### Phase 1: 기본 CRUD (1-2주)

#### 1.1 데이터베이스 모듈 생성 (`backend/diet-records-db.js`)

**구조 (기존 패턴 준수):**
```javascript
const { Pool } = require('pg');

// 환경변수 기반 연결 풀
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 테이블 생성 (마이그레이션 포함)
const createDietRecordsTable = async () => {
  // information_schema.tables로 존재 확인
  // 없으면 생성, 있으면 migrateDietRecordsTable() 호출
};

const migrateDietRecordsTable = async () => {
  // information_schema.columns로 컬럼 확인
  // 필요한 컬럼 추가
};

const createDietRecordsIndexes = async () => {
  // CREATE INDEX IF NOT EXISTS 패턴
};

// CRUD 함수들
const getDietRecords = async (appUserId, filters) => { /* ... */ };
const addDietRecord = async (dietData) => { /* ... */ };
const updateDietRecord = async (id, appUserId, updates) => { /* ... */ };
const deleteDietRecord = async (id, appUserId) => { /* ... */ };
const getDietRecordsForCalendar = async (appUserId, startDate, endDate) => { /* ... */ };

// 초기화
const initializeDatabase = async () => {
  await createDietRecordsTable();
  await createDietCommentsTable(); // 코멘트 테이블도 함께
};

module.exports = {
  initializeDatabase,
  getDietRecords,
  addDietRecord,
  updateDietRecord,
  deleteDietRecord,
  getDietRecordsForCalendar
};
```

**server.js에 초기화 추가:**
```javascript
// server.js
const dietRecordsDB = require('./diet-records-db');

// PostgreSQL 데이터베이스 초기화
sessionsDB.initializeDatabase();
membersDB.initializeDatabase();
dietRecordsDB.initializeDatabase(); // 추가
```

#### 1.2 백엔드 API 구현 (이미지 업로드 제외)
- GET `/api/diet-records` - 목록 조회
- GET `/api/diet-records/:id` - 단일 조회
- POST `/api/diet-records` - 추가 (이미지 제외)
- PATCH `/api/diet-records/:id` - 수정
- DELETE `/api/diet-records/:id` - 삭제
- GET `/api/diet-records/calendar` - 캘린더용 경량 조회

#### 1.3 프론트엔드 기본 UI
- 식단기록 메인 화면
- 리스트 뷰
- 추가/수정 폼 (이미지 제외)

#### 1.4 캘린더 뷰
- 운동기록 캘린더와 동일한 구조
- 날짜별 식단 존재 여부 표시

### Phase 2: 이미지 업로드 (1주)

#### 2.1 이미지 업로드 엔드포인트
**multer 설정 (기존 패턴 참고):**
```javascript
// server.js
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// 업로드 디렉토리 설정 (기존 DATA_DIR 패턴과 일관성 유지)
const getUploadsDir = () => {
  // 기존 패턴: DATA_DIR 환경변수 사용 (기본값: ../data)
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
  
  // Local과 Render 모두 data 폴더 안에 uploads 생성
  return process.env.UPLOADS_DIR || path.join(DATA_DIR, 'uploads');
};

const UPLOADS_DIR = getUploadsDir();
const DIET_IMAGES_DIR = path.join(UPLOADS_DIR, 'diet-images');

// 디렉토리 생성 (서버 시작 시 실행)
const ensureDirectories = () => {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      console.log(`[Diet Records] 업로드 디렉토리 생성: ${UPLOADS_DIR}`);
    }
    if (!fs.existsSync(DIET_IMAGES_DIR)) {
      fs.mkdirSync(DIET_IMAGES_DIR, { recursive: true });
      console.log(`[Diet Records] 식단 이미지 디렉토리 생성: ${DIET_IMAGES_DIR}`);
    }
  } catch (error) {
    console.error(`[Diet Records] 디렉토리 생성 오류: ${error.message}`);
    throw error;
  }
};

ensureDirectories();

// multer 설정 (memoryStorage 사용, 기존 패턴과 동일)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    // 이미지 파일만 허용
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  }
});
```

**이미지 처리 및 저장 함수:**
```javascript
const saveDietImage = async (dietRecordId, imageBuffer, mealDate) => {
  // 날짜별 디렉토리 구조: 2025/01/{diet_record_id}/
  const date = new Date(mealDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const recordDir = path.join(DIET_IMAGES_DIR, String(year), month, dietRecordId);
  
  // 디렉토리 생성 (recursive: true로 하위 디렉토리까지 자동 생성)
  if (!fs.existsSync(recordDir)) {
    fs.mkdirSync(recordDir, { recursive: true });
  }
  
  // 원본 저장 (최대 1920x1920, JPEG 품질 85%)
  const originalPath = path.join(recordDir, 'original.jpg');
  await sharp(imageBuffer)
    .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(originalPath);
  
  // 썸네일 저장 (300x300, JPEG 품질 80%)
  const thumbnailPath = path.join(recordDir, 'thumbnail_300x300.jpg');
  await sharp(imageBuffer)
    .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(thumbnailPath);
  
  // 상대 경로 반환 (DB 저장용)
  // Local: /uploads/diet-images/2025/01/{uuid}/original.jpg
  // Render: /uploads/diet-images/2025/01/{uuid}/original.jpg (동일)
  const relativeDir = path.join('uploads', 'diet-images', String(year), month, dietRecordId);
  return {
    image_url: path.join(relativeDir, 'original.jpg').replace(/\\/g, '/'),
    image_thumbnail_url: path.join(relativeDir, 'thumbnail_300x300.jpg').replace(/\\/g, '/')
  };
};
```

**Express 정적 파일 서빙 설정:**
```javascript
// server.js
// uploads 폴더를 정적 파일로 서빙
// Local: ./uploads -> /uploads
// Render: /data/uploads -> /uploads
app.use('/uploads', express.static(UPLOADS_DIR));

// 예시: /uploads/diet-images/2025/01/{uuid}/original.jpg로 접근 가능
```

**주의사항:**
- Render 환경에서 `/data/uploads` 경로는 영구 디스크이므로 재배포 후에도 유지됨
- 이미지 URL은 상대 경로(`/uploads/...`)로 저장하여 환경과 무관하게 동작
- 향후 클라우드 스토리지 전환 시 이 함수만 수정하면 됨 (DB 스키마 불변)

#### 2.2 프론트엔드 이미지 업로드 UI
- 파일 선택
- 이미지 미리보기
- 드래그 앤 드롭 지원

### Phase 3: 코멘트 기능 (1주)
1. 코멘트 테이블 생성
2. 코멘트 API 구현
3. 채팅 스타일 UI
4. 권한 검증 (트레이너만 해당 유저 코멘트 가능)

### Phase 4: 성능 최적화 (1주)
1. 이미지 지연 로딩
2. 캘린더 경량 API
3. 인덱스 최적화
4. 프론트엔드 캐싱

### Phase 5: PWA 오프라인 지원 (1주)
1. IndexedDB 구조 설계
2. 오프라인 업로드 큐
3. Service Worker 이미지 캐싱
4. 오프라인 UI 표시

---

## 보안 고려사항

### 1. 파일 업로드 보안
- 파일 타입 검증 (MIME 타입, 확장자)
- 파일 크기 제한 (최대 10MB)
- 파일명 안전화 (경로 순회 공격 방지)
- 이미지 파일만 허용 (헤더 검증)
- sharp로 이미지 재처리하여 악성 코드 제거

### 2. 권한 검증
- 유저는 자신의 식단기록만 수정/삭제 가능
- 트레이너는 담당 유저의 식단기록만 코멘트 가능
- 관리자(su 포함)는 모든 식단기록 접근 가능 [[memory:13349140]]

### 3. 이미지 접근 제어
- 직접 URL 접근 방지 (인증 필요)
- 또는 정적 파일 서빙 시 권한 체크 미들웨어
- Express 정적 파일 서빙: `/uploads` 경로는 미들웨어로 보호

### 4. 환경변수 보안
- `.env` 파일은 `.gitignore`에 포함
- Render 환경변수는 대시보드에서 안전하게 관리
- 민감한 정보는 환경변수로 관리

---

## 확장 가능성

### 1. 음식 인식 AI
- 이미지에서 자동으로 음식명 추출
- 칼로리 자동 계산

### 2. 식단 분석
- 일일/주간 영양소 통계
- 목표 대비 달성률

### 3. 알림 기능
- 식단 기록 리마인더
- 트레이너 코멘트 알림

### 4. 소셜 기능
- 다른 유저와 식단 공유
- 좋아요/북마크

---

## 성능 목표

### 응답 시간
- 이미지 업로드: < 3초 (1MB 이미지 기준)
- 리스트 조회: < 500ms
- 캘린더 조회: < 300ms
- 코멘트 로드: < 200ms

### 용량 관리
- 썸네일 크기: 평균 30-50KB
- 원본 이미지: 평균 200-500KB (최적화 후)
- 한 유저당 월 50개 식단 기준: 약 10-25MB

---

## 환경변수 정리

### 개발 환경 (Local)
```env
# .env 파일
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
NODE_ENV=development
DATA_DIR=./data              # 기본값: ../data (프로젝트 폴더 내 data)
UPLOADS_DIR=./data/uploads  # 기본값: DATA_DIR/uploads (선택사항)
```

**로컬 폴더 구조:**
```
프로젝트 루트/
  backend/
  public/
  data/                    # DATA_DIR
    accounts.json
    centers.json
    uploads/              # UPLOADS_DIR (자동 생성)
      diet-images/
```

### 운영 환경 (Render)
Render 대시보드에서 환경변수 설정:
- `DATABASE_URL`: Render PostgreSQL 자동 제공
- `NODE_ENV`: `production` (자동 설정)
- `DATA_DIR`: `/data` (영구 디스크, 필요시)
- `UPLOADS_DIR`: `/data/uploads` (기본값, 이미지 저장용) ⚠️ **임시 테스트용**

**경로 구조:**
```
Render 영구 디스크:
/data/                   # DATA_DIR (Render 기본값)
  uploads/              # UPLOADS_DIR (이미지 저장, 임시 테스트용)
    diet-images/
      2025/
        01/
          {uuid}/
            original.jpg
            thumbnail_300x300.jpg
```

**로컬과 Render 일관성:**
- 둘 다 `DATA_DIR/uploads` 구조 사용
- Local: `./data/uploads`
- Render: `/data/uploads` (DATA_DIR이 /data이므로)

**주의사항:**
- ✅ Render의 `/data` 경로는 영구 디스크이므로 재배포 후에도 데이터 유지
- ⚠️ 현재는 테스트 목적으로 파일시스템 사용 (향후 클라우드 스토리지로 전환 예정)
- 🔄 클라우드 스토리지(S3, Cloudflare R2 등) 전환 시 `UPLOADS_DIR` 환경변수는 사용하지 않음

---

## 결론

이 설계는 다음과 같은 장점을 제공합니다:

1. **기존 패턴 준수**: 마이그레이션, 환경변수, 파일 저장 등 모든 패턴 일관성 유지
2. **단계적 구현**: 핵심 기능부터 시작하여 점진적으로 확장
3. **성능 최적화**: 이미지 압축, 썸네일, 지연 로딩으로 빠른 로딩
4. **오프라인 지원**: PWA를 활용한 오프라인 업로드 및 캐싱
5. **확장성**: 클라우드 스토리지로 쉽게 마이그레이션 가능
6. **운동기록과의 일관성**: 동일한 패턴으로 개발 및 유지보수 용이
7. **환경 구분**: 로컬/Render 환경 자동 구분으로 배포 안정성 확보

필요에 따라 단계별로 구현하시면 됩니다!
