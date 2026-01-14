# SU (Super User) 역할 추가 설계

## 📋 개요
기존 `admin` 역할의 모든 권한을 포함하면서, 향후 `su`만을 위한 추가 기능을 구현할 수 있도록 새로운 역할 `su`를 추가합니다.

## 🎯 설계 원칙
1. **하위 호환성**: `su`는 `admin`의 모든 권한을 포함
2. **확장성**: 향후 `su` 전용 기능 추가 가능
3. **명확성**: 권한 체크 로직을 헬퍼 함수로 통일

## 📊 현재 역할 시스템 분석

### 기존 역할
- `admin`: 전체 시스템 관리 권한
- `center`: 센터 관리자 권한
- `trainer`: 트레이너 권한

### 역할별 접근 권한
- **admin**: 모든 탭 접근 (Today, Week, Member, Stat, Database, Trial, Renew, Expense, Trainer)
- **center**: 제한된 탭 접근 (Today, Week, Member, Stat, Trial)
- **trainer**: 트레이너 전용 탭 (SessionCalendar, MyMemberList)

## 🔍 변경 범위 분석

### 1. 데이터 레이어
**파일**: `data/accounts.json`
- **변경 내용**: `su` 역할 계정 추가 (예시)
- **영향도**: 낮음 (데이터만 추가)

### 2. 백엔드 (Backend)
**파일**: `backend/server.js`

#### 2.1 회원가입 API (`/api/signup`)
- **위치**: 라인 386-388
- **현재**: `allowedRoles = ['admin', 'center', 'trainer']`
- **변경**: `allowedRoles = ['admin', 'center', 'trainer', 'su']`
- **영향도**: 낮음

#### 2.2 트레이너 설정 수정 API (`/api/trainers/:username`)
- **위치**: 라인 480, 521
- **현재**: `currentUserAccount.role !== 'admin'`
- **변경**: `!isAdminOrSu(currentUserAccount)`
- **영향도**: 중간

#### 2.3 관리자 계정 존재 확인 API (`/api/admin-exists`)
- **위치**: 라인 568
- **현재**: `accounts.some(acc => acc.role === 'admin')`
- **변경**: `accounts.some(acc => acc.role === 'admin' || acc.role === 'su')`
- **영향도**: 낮음

### 3. 프론트엔드 (Frontend)
**파일**: `public/js/main.js`

#### 3.1 메인 섹션 표시 (`showMainSection`)
- **위치**: 라인 221, 225, 269
- **현재**: `role === 'admin'`
- **변경**: `role === 'admin' || role === 'su'`
- **영향도**: 중간

#### 3.2 탭 렌더링 (`renderTabs`)
- **위치**: 라인 269
- **현재**: `role === 'admin'`
- **변경**: `role === 'admin' || role === 'su'`
- **영향도**: 중간

### 4. 기타 파일
- **README.md**: 문서 업데이트 (선택사항)
- **기타 JS 파일**: admin 권한 체크가 있는 경우 확인 필요

## 🛠️ 구현 계획

### Phase 1: 권한 체크 헬퍼 함수 추가
**목적**: 권한 체크 로직을 중앙화하여 유지보수성 향상

**백엔드 (`backend/server.js`)**
```javascript
// 권한 체크 헬퍼 함수
function isAdminOrSu(userAccount) {
    return userAccount && (userAccount.role === 'admin' || userAccount.role === 'su');
}

function isAdmin(userAccount) {
    return userAccount && userAccount.role === 'admin';
}

function isSu(userAccount) {
    return userAccount && userAccount.role === 'su';
}
```

**프론트엔드 (`public/js/main.js`)**
```javascript
// 권한 체크 헬퍼 함수
function isAdminOrSu(role) {
    return role === 'admin' || role === 'su';
}

function isAdmin(role) {
    return role === 'admin';
}

function isSu(role) {
    return role === 'su';
}
```

### Phase 2: 백엔드 권한 체크 업데이트
1. 회원가입 API: `allowedRoles`에 `'su'` 추가
2. 트레이너 설정 수정 API: `isAdminOrSu()` 사용
3. 관리자 계정 존재 확인 API: `admin || su` 체크

### Phase 3: 프론트엔드 권한 체크 업데이트
1. `showMainSection`: `isAdminOrSu(role)` 사용
2. `renderTabs`: `isAdminOrSu(role)` 사용
3. 기타 admin 권한 체크 위치 확인 및 업데이트

### Phase 4: 테스트 및 검증
1. `su` 계정으로 로그인 테스트
2. 모든 admin 기능 접근 가능 여부 확인
3. 향후 su 전용 기능 추가 가능 여부 확인

## 📝 변경 파일 목록

### 필수 변경 파일
1. ✅ `data/accounts.json` - su 계정 추가
2. ✅ `backend/server.js` - 권한 체크 로직 업데이트
3. ✅ `public/js/main.js` - UI 권한 체크 업데이트

### 선택적 변경 파일
4. ⚠️ `README.md` - 문서 업데이트
5. ⚠️ 기타 JS 파일 - admin 권한 체크가 있는 경우

## 🔢 변경 통계 (예상)

### 코드 변경량
- **백엔드**: 약 5-10줄 수정 + 헬퍼 함수 추가 (~15줄)
- **프론트엔드**: 약 3-5줄 수정 + 헬퍼 함수 추가 (~10줄)
- **데이터**: 1개 계정 추가
- **총 변경**: 약 30-40줄

### 영향받는 API 엔드포인트
- `POST /api/signup` - 1곳
- `PUT /api/trainers/:username` - 2곳
- `GET /api/admin-exists` - 1곳

### 영향받는 UI 컴포넌트
- 메인 섹션 표시 로직 - 3곳
- 탭 렌더링 로직 - 1곳

## ⚠️ 주의사항

1. **하위 호환성**: 기존 `admin` 계정은 계속 정상 작동해야 함
2. **데이터 마이그레이션**: 기존 데이터에 영향 없음
3. **보안**: `su` 역할도 `admin`과 동일한 보안 수준 유지
4. **확장성**: 향후 `su` 전용 기능 추가 시 `isSu()` 함수 활용

## 🚀 향후 확장 계획

### su 전용 기능 예시
- 시스템 설정 관리
- 모든 센터 통합 통계
- 고급 로그 조회
- 백업/복원 기능

### 구현 방법
```javascript
// su 전용 기능 예시
if (isSu(userAccount)) {
    // su 전용 기능
}
```

## ✅ 체크리스트

- [ ] 백엔드 헬퍼 함수 추가
- [ ] 프론트엔드 헬퍼 함수 추가
- [ ] 회원가입 API 업데이트
- [ ] 트레이너 설정 수정 API 업데이트
- [ ] 관리자 계정 존재 확인 API 업데이트
- [ ] 메인 섹션 표시 로직 업데이트
- [ ] 탭 렌더링 로직 업데이트
- [ ] su 계정 추가 (accounts.json)
- [ ] 테스트 및 검증
- [ ] 문서 업데이트 (선택사항)
