# FMS (Fitness Management System) - GoodLift

헬스장 회원관리 및 PT 세션 관리 시스템

## 📋 프로젝트 개요

GoodLift는 헬스장에서 회원과 트레이너가 효율적으로 PT 세션을 관리할 수 있는 웹 기반 관리 시스템입니다. 관리자와 트레이너 역할을 구분하여 각각의 업무에 최적화된 기능을 제공합니다.

## 🛠 기술 스택

- **백엔드**: Node.js + Express
- **프론트엔드**: 순수 HTML/CSS/JavaScript (모듈 시스템)
- **데이터 저장**: JSON 파일 기반
- **패키지 관리**: npm

## 📁 폴더 구조

```
C:\Project\fms\
├── backend/                 # 백엔드 서버
│   ├── server.js           # Express 서버 메인 파일
│   ├── package.json        # Node.js 의존성
│   └── node_modules/       # 설치된 패키지들
├── public/                 # 프론트엔드 정적 파일
│   ├── index.html          # 메인 HTML 페이지
│   ├── css/               # 스타일시트
│   │   ├── style.css      # 메인 스타일
│   │   ├── adminDayCalendar.css
│   │   └── adminWeekCalendar.css
│   ├── js/                # JavaScript 모듈들
│   │   ├── main.js        # 메인 로직
│   │   ├── trainer.js     # 트레이너 기능
│   │   ├── member.js      # 회원 관리
│   │   ├── center.js      # 센터 관리
│   │   ├── adminDayCalendar.js
│   │   └── adminWeekCalendar.js
│   └── img/               # 이미지 파일들
├── data/                  # JSON 데이터 파일들
│   ├── accounts.json      # 사용자 계정 정보
│   ├── members.json       # 회원 정보
│   ├── sessions.json      # PT 세션 정보
│   └── centers.json       # 센터 정보
└── .git/                  # Git 버전 관리
```

## 👥 사용자 역할 시스템

### 관리자 (Admin)
- 전체 시스템 관리
- 회원, 트레이너, 센터 관리
- 일별/주별 캘린더 뷰
- 전체 세션 현황 모니터링

### 트레이너 (Trainer)
- 담당 회원 관리
- PT 세션 스케줄링
- 출석 체크 및 세션 관리
- 모바일 친화적 캘린더 인터페이스

## 🚀 주요 기능

### 인증 시스템
- 로그인/회원가입
- 역할별 접근 제어
- 자동 로그인 (localStorage)
- 비밀번호 변경

### 회원 관리
- 회원 등록/수정/삭제
- 회원별 세션 수 관리
- 잔여 세션 추적
- 회원 상태 관리 (유효/만료)
- 성별, 연락처, 담당 트레이너 정보

### 세션 관리
- PT 세션 예약/변경/취소
- 출석 체크 (사인 기능 포함)
- 시간대별 스케줄링 (06:00~22:00, 30분 단위)
- 중복 예약 방지
- 세션 상태 추적 (예정/완료)

### 캘린더 시스템
- 트레이너용 모바일 캘린더
- 관리자용 일별/주별 캘린더
- 세션 상태 시각화
- 터치 스와이프 네비게이션

## 📊 데이터 구조

### 계정 정보 (accounts.json)
```json
{
  "username": "shk",
  "password": "123",
  "name": "김성현",
  "role": "trainer"
}
```

### 회원 정보 (members.json)
```json
{
  "name": "피석훈",
  "gender": "male",
  "phone": "01066406317",
  "trainer": "ssc",
  "center": "스탠다드PT 위례점",
  "regdate": "2025-07-24",
  "sessions": 45,
  "remainSessions": 40,
  "status": "유효"
}
```

### 세션 정보 (sessions.json)
```json
{
  "id": "8026a05a-8056-4ac4-853c-4e34cc688413",
  "member": "피석훈",
  "trainer": "shk",
  "date": "2025-07-24",
  "time": "06:00",
  "status": "예정"
}
```

## 🌐 API 엔드포인트

### 인증
- `POST /api/signup` - 회원가입
- `POST /api/login` - 로그인
- `GET /api/admin-exists` - 관리자 계정 존재 여부 확인

### 사용자 관리
- `GET /api/trainers` - 트레이너 목록 조회

### 회원 관리
- `GET /api/members` - 회원 목록 조회
- `POST /api/members` - 회원 등록
- `PATCH /api/members/:id` - 회원 정보 수정
- `DELETE /api/members/:id` - 회원 삭제

### 세션 관리
- `GET /api/sessions` - 세션 목록 조회 (필터링 가능)
- `POST /api/sessions` - 세션 생성
- `PATCH /api/sessions/:id` - 세션 수정
- `DELETE /api/sessions/:id` - 세션 삭제
- `PATCH /api/sessions/:id/attend` - 출석 체크

### 센터 관리
- `GET /api/centers` - 센터 목록 조회
- `POST /api/centers` - 센터 등록
- `PATCH /api/centers/:id` - 센터 정보 수정
- `DELETE /api/centers/:id` - 센터 삭제

## 🎯 주요 특징

### 모바일 친화적
- 터치 스와이프 네비게이션
- 반응형 디자인
- 터치 최적화된 UI

### 실시간 데이터
- JSON 파일 기반 간단한 데이터 저장
- 즉시 반영되는 변경사항

### 모듈화된 구조
- 역할별 JavaScript 모듈 분리
- 재사용 가능한 컴포넌트

### 사용자 경험
- 직관적인 UI/UX
- 로딩 상태 표시
- 에러 처리 및 피드백

### 데이터 무결성
- 중복 예약 방지
- 유효성 검사
- 상태 관리

## 🚀 설치 및 실행

### 1. 의존성 설치
```bash
cd backend
npm install
```

### 2. 서버 실행
```bash
npm start
```

### 3. 브라우저 접속
```
http://localhost:3000
```

## 📱 사용법

### 관리자 로그인
- 첫 번째 관리자 계정 생성 시 자동으로 관리자 권한 부여
- 이후 관리자 계정은 추가 생성 불가

### 트레이너 기능
- 담당 회원 목록 확인
- 세션 예약 및 관리
- 출석 체크 (사인 기능)
- 모바일 캘린더 뷰

### 회원 관리
- 회원 정보 등록/수정
- 세션 수 및 잔여 세션 관리
- 회원 상태 관리

## 🔧 개발 환경

- Node.js 18+
- npm 9+
- 모던 브라우저 (Chrome, Firefox, Safari, Edge)

## 📝 라이선스

이 프로젝트는 내부 사용을 위한 헬스장 관리 시스템입니다.
