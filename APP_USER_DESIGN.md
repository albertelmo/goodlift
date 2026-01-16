# 앱 유저 테이블 설계 문서

## 📋 개요
회원 중 앱을 사용하는 사람들을 위한 앱 유저 테이블을 생성합니다. 향후 운동기록, 식단기록 등의 테이블과 매핑 관계를 고려하여 설계합니다.

---

## 🗄️ 데이터베이스 설계

### 1. 테이블: `app_users`

#### 1.1 기본 구조
PostgreSQL 데이터베이스에 새로운 테이블을 생성합니다.
기존 DB 모듈 패턴(`members-db.js`, `sessions-db.js`, `expenses-db.js` 등)을 따라 구현합니다.

#### 1.2 필드 구조

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PRIMARY KEY | 앱 유저 고유 ID (기본값: gen_random_uuid()) |
| username | VARCHAR(50) | UNIQUE NOT NULL | 로그인 아이디 (앱에서 사용) |
| password_hash | VARCHAR(255) | NOT NULL | 비밀번호 해시값 (bcrypt 등) |
| name | VARCHAR(100) | NOT NULL | 사용자 이름 |
| phone | VARCHAR(20) | NOT NULL | 전화번호 |
| member_name | VARCHAR(100) | NULL | 회원 테이블과의 매핑 (members.name 참조) |
| is_active | BOOLEAN | DEFAULT true | 계정 활성화 여부 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 계정 생성 시각 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 계정 수정 시각 |
| last_login_at | TIMESTAMP | NULL | 마지막 로그인 시각 |

#### 1.3 테이블 생성 SQL

```sql
CREATE TABLE app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  member_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX idx_app_users_username ON app_users(username);
CREATE INDEX idx_app_users_member_name ON app_users(member_name);
CREATE INDEX idx_app_users_phone ON app_users(phone);
```

#### 1.4 회원 테이블과의 관계
- `app_users.member_name` → `members.name` (외래키는 설정하지 않음, 유연성을 위해)
- 앱 유저는 회원 중 일부일 수 있지만, 반드시 회원일 필요는 없음 (향후 확장 고려)
- `member_name`이 NULL이면 회원과 매핑되지 않은 독립적인 앱 유저

---

### 2. 향후 확장 테이블 설계

#### 2.1 운동기록 테이블 (`workout_records`)

```sql
CREATE TABLE workout_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  workout_date DATE NOT NULL,
  workout_type VARCHAR(50),  -- 운동 종류 (예: "유산소", "근력운동", "스트레칭")
  duration_minutes INTEGER,  -- 운동 시간 (분)
  calories_burned INTEGER,   -- 소모 칼로리
  notes TEXT,                 -- 메모
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_workout_records_user_id ON workout_records(app_user_id);
CREATE INDEX idx_workout_records_date ON workout_records(workout_date);
```

#### 2.2 식단기록 테이블 (`diet_records`)

```sql
CREATE TABLE diet_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  meal_date DATE NOT NULL,
  meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name VARCHAR(200),     -- 음식명
  calories INTEGER,           -- 칼로리
  protein DECIMAL(5,2),       -- 단백질 (g)
  carbs DECIMAL(5,2),         -- 탄수화물 (g)
  fat DECIMAL(5,2),           -- 지방 (g)
  notes TEXT,                 -- 메모
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_diet_records_user_id ON diet_records(app_user_id);
CREATE INDEX idx_diet_records_date ON diet_records(meal_date);
```

---

## 🔧 구현 계획

### 1. 백엔드 모듈 생성
**파일**: `backend/app-users-db.js`

#### 주요 함수
- `createAppUsersTable()`: 테이블 생성
- `getAppUsers(filters)`: 앱 유저 목록 조회
- `getAppUserById(id)`: ID로 조회
- `getAppUserByUsername(username)`: 아이디로 조회
- `addAppUser(userData)`: 앱 유저 추가
- `updateAppUser(id, updates)`: 앱 유저 정보 수정
- `deleteAppUser(id)`: 앱 유저 삭제
- `updateLastLogin(username)`: 마지막 로그인 시각 업데이트
- `initializeDatabase()`: 데이터베이스 초기화

#### 비밀번호 처리
- 비밀번호는 해시화하여 저장 (bcrypt 사용 권장)
- `bcrypt` 패키지 필요: `npm install bcrypt`

### 2. API 엔드포인트 추가
**파일**: `backend/server.js`

#### 엔드포인트 목록
- `POST /api/app-users`: 앱 유저 등록
- `GET /api/app-users`: 앱 유저 목록 조회 (관리자용)
- `GET /api/app-users/:id`: 특정 앱 유저 조회
- `PATCH /api/app-users/:id`: 앱 유저 정보 수정
- `DELETE /api/app-users/:id`: 앱 유저 삭제
- `POST /api/app-users/login`: 앱 유저 로그인 (향후 구현)
- `PATCH /api/app-users/:id/password`: 비밀번호 변경 (향후 구현)

### 3. 테이블 생성 전략
기존 패턴 준수:
1. 테이블 존재 여부 확인 (`information_schema.tables`)
2. 테이블이 없을 때만 생성
3. UTF8 인코딩 설정
4. 인덱스 생성

---

## 🔐 보안 고려사항

### 1. 비밀번호 해싱
- 평문 비밀번호 저장 금지
- `bcrypt`를 사용한 해싱 (salt rounds: 10)
- 로그인 시 해시 비교

### 2. 아이디 중복 방지
- `username`에 UNIQUE 제약조건
- 회원가입 시 중복 체크

### 3. 전화번호 형식 검증
- 프론트엔드/백엔드에서 형식 검증 (선택사항)

---

## 📊 데이터 흐름

### 앱 유저 등록
1. 관리자가 앱 유저 등록 (회원 이름 선택 가능)
2. 아이디, 비밀번호, 이름, 전화번호 입력
3. 비밀번호 해싱 후 저장
4. `member_name`이 있으면 회원과 매핑

### 향후 운동기록/식단기록 추가
1. 앱 유저가 로그인
2. 운동기록/식단기록 등록 시 `app_user_id`로 매핑
3. `app_user_id`를 외래키로 사용하여 관계 설정

---

## 🎯 설계 원칙

1. **확장성**: 향후 운동기록, 식단기록 등 추가 테이블과의 관계 고려
2. **유연성**: 회원과의 매핑은 선택적 (NULL 허용)
3. **보안**: 비밀번호 해싱 필수
4. **일관성**: 기존 DB 모듈 패턴 준수
5. **성능**: 조회용 인덱스 적절히 생성

---

## 📝 참고사항

- 회원 테이블(`members`)과의 관계는 외래키로 강제하지 않음 (유연성을 위해)
- 향후 앱 인증 토큰(JWT 등) 추가 시 `app_users` 테이블에 관련 필드 추가 가능
- 운동기록/식단기록 테이블은 별도 모듈로 구현 예정
