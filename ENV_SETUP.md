# 환경 변수 설정 가이드

이 프로젝트는 Local 개발 환경과 Render 배포 환경 두 가지를 지원합니다.

## 📋 사용 중인 환경 변수

### 필수 환경 변수
- `DATABASE_URL`: PostgreSQL 데이터베이스 연결 문자열
- `NODE_ENV`: 환경 구분 (`production` 또는 개발 환경)

### 선택적 환경 변수
- `DATA_DIR`: 데이터 파일 디렉토리 경로 (기본값: `../data`)
- `EMAIL_HOST`: 이메일 SMTP 호스트 (기본값: `smtp.gmail.com`)
- `EMAIL_PORT`: 이메일 SMTP 포트 (기본값: `587`)
- `EMAIL_USER`: 이메일 계정
- `EMAIL_PASS`: 이메일 비밀번호
- `ENABLE_QUERY_LOGGING`: 쿼리 로깅 활성화 (`true`/`false`, 기본값: production이 아니면 `true`)
- `SLOW_QUERY_THRESHOLD`: 느린 쿼리 기준 시간(ms) (기본값: `100`)
- `DEBUG_QUERIES`: 모든 쿼리 상세 로깅 (`true`/`false`)

## 🏠 Local 개발 환경 설정

### 1. `.env` 파일 생성
프로젝트 루트 디렉토리 또는 `backend/` 디렉토리에 `.env` 파일을 생성합니다:

```bash
# backend/.env
DATABASE_URL=postgresql://username:password@localhost:5432/dbname
NODE_ENV=development

# 선택적 설정
DATA_DIR=./data
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
ENABLE_QUERY_LOGGING=true
SLOW_QUERY_THRESHOLD=100
DEBUG_QUERIES=false
```

### 2. dotenv 패키지 사용
`backend/server.js`에서 이미 `dotenv`를 로드하고 있습니다:

```javascript
require('dotenv').config();
```

이 코드는 서버 시작 시 `.env` 파일을 자동으로 읽어 `process.env`에 환경 변수를 설정합니다.

### 3. .gitignore 설정
`.env` 파일은 민감한 정보를 포함하므로 `.gitignore`에 추가되어 있어 Git에 커밋되지 않습니다.

## ☁️ Render 배포 환경 설정

### 1. Render 대시보드에서 환경 변수 설정
1. Render 대시보드에서 서비스 선택
2. **Environment** 탭으로 이동
3. **Environment Variables** 섹션에서 환경 변수 추가

### 2. 필수 환경 변수 설정
Render 대시보드에서 다음 환경 변수를 설정합니다:

```
DATABASE_URL=postgresql://user:password@host:port/dbname
NODE_ENV=production
```

**참고**: Render에서 PostgreSQL 데이터베이스를 생성하면 `DATABASE_URL`이 자동으로 제공됩니다.

### 3. 선택적 환경 변수 설정
필요한 경우 추가 환경 변수를 설정합니다:

```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
ENABLE_QUERY_LOGGING=false
SLOW_QUERY_THRESHOLD=100
```

## 🔄 환경 변수 로드 순서

1. **Local 환경**:
   - `require('dotenv').config()`가 `.env` 파일을 읽어 `process.env`에 설정
   - `.env` 파일이 없으면 에러 없이 계속 진행 (환경 변수는 `undefined`)

2. **Render 환경**:
   - Render가 자동으로 설정한 환경 변수를 `process.env`에 제공
   - `dotenv`는 `.env` 파일이 없어도 에러 없이 계속 진행
   - Render의 환경 변수가 우선순위를 가짐

## 🔒 보안 주의사항

1. **`.env` 파일은 절대 Git에 커밋하지 마세요**
   - `.gitignore`에 이미 추가되어 있음
   - 민감한 정보(비밀번호, API 키 등)가 포함됨

2. **Render 환경 변수는 대시보드에서만 관리**
   - 코드에 하드코딩하지 않음
   - 환경 변수는 암호화되어 저장됨

3. **데이터베이스 연결**
   - Local: SSL 비활성화 (`ssl: false`)
   - Render: SSL 활성화 (`ssl: { rejectUnauthorized: false }`)
   - 자동으로 `NODE_ENV`로 구분됨

## 📝 환경 변수 사용 예시

### 데이터베이스 연결
```javascript
// backend/workout-records-db.js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
```

### 쿼리 로깅
```javascript
// backend/workout-records-db.js
const ENABLE_QUERY_LOGGING = process.env.ENABLE_QUERY_LOGGING === 'true' || process.env.NODE_ENV !== 'production';
const SLOW_QUERY_THRESHOLD = parseInt(process.env.SLOW_QUERY_THRESHOLD || '100', 10);
```

### 데이터 디렉토리
```javascript
// backend/server.js
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
```

## 🛠️ 문제 해결

### Local에서 환경 변수가 로드되지 않는 경우
1. `.env` 파일이 올바른 위치에 있는지 확인 (`backend/.env` 또는 프로젝트 루트)
2. `.env` 파일 형식이 올바른지 확인 (공백 없이 `KEY=value` 형식)
3. 서버를 재시작해보세요

### Render에서 환경 변수가 작동하지 않는 경우
1. Render 대시보드에서 환경 변수가 올바르게 설정되었는지 확인
2. 서비스를 재배포해보세요
3. Render 로그에서 환경 변수 관련 에러 확인

## 📚 참고 자료

- [dotenv 공식 문서](https://github.com/motdotla/dotenv)
- [Render 환경 변수 설정 가이드](https://render.com/docs/environment-variables)
