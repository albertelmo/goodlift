# Elmo 서비스 설계 문서

## 1. 개요

Elmo는 기존 Goodlift 서비스와 완전히 분리된 독립적인 서브 애플리케이션입니다. 별도의 사용자 인증, PWA, 프론트엔드를 가지며, PostgreSQL 데이터베이스는 공유합니다.

### 1.1 목적
- 개인 일정 관리 및 ToDo 관리
- 메모, 사진, 동영상 기록 기능
- 기존 서비스와의 완전한 분리

### 1.2 접근 경로
- URL: `https://goodlift.onrender.com/elmo`
- 로컬: `http://localhost:3000/elmo`

## 2. 아키텍처 설계

### 2.1 서비스 분리 원칙
- **완전 분리**: 로그인, PWA, 프론트엔드 모두 독립적
- **DB 공유**: PostgreSQL 데이터베이스는 기존 서비스와 공유 (선택적 활용 가능)
- **파일 분리**: 백엔드 코드는 별도 모듈로 분리하여 유지보수성 향상

### 2.2 파일 구조

```
backend/
├── elmo-api-router.js          # Elmo API 라우터 (모든 엔드포인트)
├── elmo-middleware.js          # Elmo 미들웨어 (세션 검증)
├── elmo-utils.js               # Elmo 유틸리티 (이미지 저장, multer 설정)
├── elmo-users-db.js            # Elmo 사용자 DB 모듈
└── elmo-calendar-records-db.js # Elmo 캘린더 기록 DB 모듈

public-elmo/
├── index.html                  # Elmo 메인 HTML
├── manifest.json               # PWA 매니페스트
├── sw.js                       # Service Worker
├── css/
│   └── elmo.css                # Elmo 전용 스타일
└── js/
    ├── elmo-main.js            # 메인 진입점 (로그인/회원가입)
    ├── elmo-layout.js          # 레이아웃 관리 (헤더, 네비게이션)
    ├── elmo-index.js           # 화면 라우팅
    └── calendar/
        ├── index.js             # 캘린더 화면 초기화
        ├── calendar.js          # 캘린더 컴포넌트
        └── modals.js            # 모달 관리 (추가/상세보기)
```

## 3. 데이터베이스 설계

### 3.1 Elmo 사용자 테이블 (`elmo_users`)

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| id | UUID (PK) | 사용자 고유 ID |
| username | VARCHAR(50) (UNIQUE) | 로그인 아이디 |
| password_hash | VARCHAR(255) | bcrypt 해시된 비밀번호 |
| name | VARCHAR(100) | 사용자 이름 |
| email | VARCHAR(255) | 이메일 (선택) |
| is_active | BOOLEAN | 계정 활성화 여부 (기본값: true) |
| created_at | TIMESTAMP | 생성일시 |
| updated_at | TIMESTAMP | 수정일시 |
| last_login_at | TIMESTAMP | 마지막 로그인 시간 |

**주요 함수:**
- `addElmoUser()`: 회원가입 (비밀번호 해싱 포함)
- `verifyPassword()`: 로그인 인증
- `getElmoUserByUsername()`: 아이디로 사용자 조회
- `getElmoUserById()`: ID로 사용자 조회
- `updateLastLogin()`: 마지막 로그인 시간 업데이트

### 3.2 Elmo 캘린더 기록 테이블 (`elmo_calendar_records`)

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| id | UUID (PK) | 기록 고유 ID |
| user_id | UUID (FK) | 사용자 ID (elmo_users.id 참조) |
| record_date | DATE | 기록 날짜 (YYYY-MM-DD) |
| type | VARCHAR(20) | 기록 타입 ('일정' 또는 'ToDo') |
| text_content | TEXT | 텍스트 내용 |
| image_url | VARCHAR(500) | 이미지 URL (단일 이미지) |
| video_url | VARCHAR(500) | 동영상 URL (단일 동영상, '일정'만 가능) |
| created_at | TIMESTAMP | 생성일시 |
| updated_at | TIMESTAMP | 수정일시 |

**제약사항:**
- `type`이 'ToDo'인 경우 `video_url`은 NULL이어야 함
- `image_url`과 `video_url`은 각각 단일 파일만 저장

**주요 함수:**
- `addCalendarRecord()`: 기록 추가
- `getRecordsByDate()`: 특정 날짜의 기록 조회
- `getRecordsSummaryByMonth()`: 월별 요약 조회 (캘린더 점 표시용)
- `getRecordById()`: ID로 기록 조회
- `updateCalendarRecord()`: 기록 수정 (이미지 URL 업데이트 등)
- `deleteRecord()`: 기록 삭제

## 4. API 엔드포인트

### 4.1 인증 관련

#### POST `/api/elmo/register`
회원가입

**Request Body:**
```json
{
  "username": "string",
  "password": "string",
  "name": "string",
  "email": "string (optional)"
}
```

**Response:**
```json
{
  "message": "회원가입이 완료되었습니다.",
  "user": {
    "id": "uuid",
    "username": "string",
    "name": "string",
    "email": "string"
  }
}
```

#### POST `/api/elmo/login`
로그인

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "message": "로그인 성공",
  "sessionId": "uuid",
  "user": {
    "id": "uuid",
    "username": "string",
    "name": "string",
    "email": "string"
  }
}
```

### 4.2 캘린더 기록 관련

모든 캘린더 기록 API는 `verifyElmoSession` 미들웨어를 통해 인증이 필요합니다.

**인증 헤더:**
- `x-elmo-session`: 세션 ID
- `x-elmo-user-id`: 사용자 ID

#### GET `/api/elmo/calendar/summary`
월별 기록 요약 조회 (캘린더 점 표시용)

**Query Parameters:**
- `year`: 년도 (예: 2025)
- `month`: 월 (예: 1)

**Response:**
```json
{
  "2025-01-15": 2,
  "2025-01-20": 1,
  ...
}
```

#### GET `/api/elmo/calendar/records`
특정 날짜의 기록 목록 조회

**Query Parameters:**
- `date`: 날짜 (YYYY-MM-DD)

**Response:**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "record_date": "2025-01-15",
    "type": "일정",
    "text_content": "회의",
    "image_url": "/uploads/elmo-images/2025/01/{uuid}/original.jpg",
    "video_url": null,
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-15T10:00:00Z"
  }
]
```

#### POST `/api/elmo/calendar/records`
기록 추가 (FormData 지원)

**Request (FormData):**
- `record_date`: 날짜 (YYYY-MM-DD)
- `type`: 타입 ('일정' 또는 'ToDo')
- `text_content`: 텍스트 내용 (선택)
- `image`: 이미지 파일 (선택, 단일 파일)
- `video`: 동영상 파일 (선택, 단일 파일, '일정'만 가능)

**Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "record_date": "2025-01-15",
  "type": "일정",
  "text_content": "회의",
  "image_url": "/uploads/elmo-images/2025/01/{uuid}/original.jpg",
  "video_url": null,
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-15T10:00:00Z"
}
```

#### GET `/api/elmo/calendar/records/:id`
기록 상세 조회

**Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "record_date": "2025-01-15",
  "type": "일정",
  "text_content": "회의",
  "image_url": "/uploads/elmo-images/2025/01/{uuid}/original.jpg",
  "video_url": null,
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-15T10:00:00Z"
}
```

#### DELETE `/api/elmo/calendar/records/:id`
기록 삭제 (이미지 파일도 함께 삭제)

**Response:**
```json
{
  "message": "기록이 삭제되었습니다.",
  "record": { ... }
}
```

## 5. 주요 기능

### 5.1 사용자 인증
- 별도의 `elmo_users` 테이블 사용
- bcrypt를 사용한 비밀번호 해싱
- 세션 기반 인증 (UUID 세션 ID)
- 로그인 상태 localStorage에 저장 (PWA 호환)

### 5.2 캘린더 기능
- 월별 캘린더 뷰
- 날짜별 기록 표시 (점 표시)
- 기록 타입: '일정' 또는 'ToDo'
- 텍스트, 이미지, 동영상 지원
- ToDo는 동영상 불가

### 5.3 이미지 처리
- **클라이언트 사이드 압축**: `createImageBitmap` + `canvas.toBlob` 사용
- **서버 사이드 처리**: Sharp 라이브러리 사용
  - 원본: 최대 800x800px, JPEG 품질 65%, Progressive JPEG
  - 썸네일: 300x300px, JPEG 품질 60%, Progressive JPEG
- **병렬 처리**: 원본과 썸네일을 `Promise.all`로 동시 생성
- **저장 구조**: `uploads/elmo-images/{year}/{month}/{record_id}/`

### 5.4 PWA 지원
- 별도의 manifest.json (`/elmo/manifest.json`)
- 별도의 Service Worker (`/elmo/sw.js`)
- 캐시 전략: HTML은 항상 네트워크에서 가져오기
- 로그인 상태 유지 (localStorage 기반)

## 6. 기술 스택 및 구현 세부사항

### 6.1 백엔드
- **Express.js**: 웹 서버 프레임워크
- **PostgreSQL**: 데이터베이스
- **Multer**: 파일 업로드 처리
- **Sharp**: 이미지 리사이징 및 최적화
- **bcrypt**: 비밀번호 해싱
- **UUID**: 고유 ID 생성

### 6.2 프론트엔드
- **Vanilla JavaScript**: 프레임워크 없이 순수 JS 사용
- **ES6 Modules**: 모듈 시스템
- **Service Worker**: PWA 오프라인 지원
- **localStorage**: 로그인 상태 저장

### 6.3 파일 분리 전략

기존 `server.js`에 모든 코드를 작성하면 파일이 너무 커지고 유지보수가 어려워지는 문제를 해결하기 위해 다음과 같이 분리했습니다:

1. **`elmo-api-router.js`**: 모든 API 엔드포인트 정의
2. **`elmo-middleware.js`**: 세션 검증 미들웨어
3. **`elmo-utils.js`**: 이미지 저장, multer 설정 등 유틸리티 함수

이를 통해:
- 기존 기능에 영향 없음
- Elmo 기능만 독립적으로 관리 가능
- `server.js` 파일 크기 감소
- 유지보수성 향상

## 7. 개발 이력

### 7.1 초기 구조 구축
- Elmo 서비스 기본 틀 생성
- `/elmo` 경로 라우팅 설정
- PWA manifest 및 Service Worker 설정

### 7.2 사용자 인증 시스템
- `elmo_users` 테이블 생성
- 회원가입/로그인 API 구현
- 로그인 상태 유지 기능 (localStorage)

### 7.3 캘린더 기능
- 캘린더 UI 구현 (월별 뷰)
- 기록 추가/조회/삭제 기능
- 타입별 필드 제어 (ToDo는 동영상 불가)

### 7.4 이미지 업로드
- 클라이언트 사이드 이미지 압축
- 서버 사이드 이미지 처리 (Sharp)
- 썸네일 생성 및 병렬 처리
- 이미지 삭제 기능 (기록 삭제 시)

### 7.5 파일 분리
- API 라우터 분리 (`elmo-api-router.js`)
- 미들웨어 분리 (`elmo-middleware.js`)
- 유틸리티 분리 (`elmo-utils.js`)
- `server.js`에서 약 360줄 코드 제거

## 8. 향후 개발 계획

### 8.1 동영상 업로드
- 현재 이미지만 지원, 동영상 업로드 기능 추가 예정
- '일정' 타입만 동영상 허용

### 8.2 기록 수정 기능
- 현재 추가/삭제만 가능, 수정 기능 추가 예정

### 8.3 추가 탭 기능
- 현재 Calendar 탭만 구현됨
- Home, Goodlift, My Info 탭은 "개발중" 상태

## 9. 주의사항

### 9.1 시간대 처리
- 날짜는 한국 시간대(KST) 기준으로 처리
- PostgreSQL의 `TO_CHAR(record_date, 'YYYY-MM-DD')` 사용하여 UTC 변환 문제 방지

### 9.2 세션 검증
- 현재는 간단한 UUID 기반 세션 검증
- 향후 세션 테이블 도입 고려 가능

### 9.3 이미지 저장 경로
- `ELMO_IMAGES_DIR` 환경변수로 설정 가능
- 기본값: `{DATA_DIR}/uploads/elmo-images`

## 10. 참고사항

- 기존 Goodlift 서비스와 완전히 분리되어 있음
- PostgreSQL 데이터베이스는 공유하지만, 테이블은 완전히 분리됨
- 기존 서비스의 DB 모듈(`membersDB`, `sessionsDB` 등)을 선택적으로 활용 가능
- 모든 변경사항은 기존 기능에 영향을 주지 않도록 설계됨
