# 계정 역할 계층 구조 설계

## 📋 현재 상태 분석

### 현재 역할 구조
1. **SU (Super User)**: 슈퍼 관리자
   - `role: "su"`
   - admin의 모든 권한 + 향후 SU 전용 기능
   - 이미 구현됨 (`isAdminOrSu()` 함수 사용)

2. **Admin (관리자)**: 일반 관리자
   - `role: "admin"`
   - 전체 시스템 관리 권한
   - 모든 탭 접근 가능

3. **Center (센터 관리자)**: 센터별 관리자
   - `role: "center"`
   - 특정 센터만 관리
   - 제한된 탭 접근

4. **Trainer (트레이너)**: 트레이너
   - `role: "trainer"`
   - 트레이너 전용 기능
   - 세션 관리, 회원 관리

5. **App User (일반 유저)**: 앱 사용자
   - PostgreSQL `app_users` 테이블
   - `accounts.json`에 없음
   - 운동기록, 식단기록 등 개인 데이터 관리

## 🎯 제안하는 역할 계층 구조

### 옵션 1: 3단계 계층 (단순화)
```
SU (슈퍼 관리자)
  └─ Admin (관리자)
      └─ 일반 유저 (App User + Trainer)
```

**특징:**
- SU: 최고 권한, 시스템 전체 관리
- Admin: 일반 관리 권한, 일상 운영 관리
- 일반 유저: 개인 데이터 관리 (app_user, trainer)

### 옵션 2: 4단계 계층 (세분화)
```
SU (슈퍼 관리자)
  └─ Admin (관리자)
      └─ Center (센터 관리자)
          └─ 일반 유저 (App User + Trainer)
```

**특징:**
- SU: 최고 권한
- Admin: 전체 시스템 관리
- Center: 센터별 관리
- 일반 유저: 개인 데이터 관리

### 옵션 3: 역할 기반 접근 제어 (RBAC)
```
역할 그룹:
1. 시스템 관리자: SU, Admin
2. 센터 관리자: Center
3. 서비스 제공자: Trainer
4. 일반 사용자: App User
```

## 🔍 권한 비교표

| 기능 | SU | Admin | Center | Trainer | App User |
|------|----|----|--------|---------|----------|
| 시스템 설정 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 전체 통계 조회 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 센터별 통계 조회 | ✅ | ✅ | ✅ (본인 센터만) | ❌ | ❌ |
| 회원 관리 | ✅ | ✅ | ✅ (본인 센터만) | ✅ (본인 회원만) | ❌ |
| 트레이너 관리 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 세션 관리 | ✅ | ✅ | ✅ (본인 센터만) | ✅ (본인 세션만) | ❌ |
| 운동기록 조회 | ✅ | ✅ | ✅ | ✅ (본인 회원만) | ✅ (본인만) |
| 식단기록 조회 | ✅ | ✅ | ✅ | ✅ (본인 회원만) | ✅ (본인만) |
| 상담기록 조회 | ✅ | ✅ | ✅ | ✅ (본인 회원만) | ❌ |
| 데이터베이스 관리 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 백업/복원 | ✅ | ❌ | ❌ | ❌ | ❌ |

## 🛠️ 구현 방안

### 방안 1: 현재 구조 유지 + 권한 명확화 (추천)

**장점:**
- 기존 코드 수정 최소화
- 이미 SU/Admin 구분이 되어 있음
- App User는 별도 테이블로 관리 중

**구현 내용:**
1. 권한 체크 헬퍼 함수 확장
2. 각 API 엔드포인트에 권한 체크 추가
3. 프론트엔드에서 역할별 UI 제어

**코드 예시:**
```javascript
// 백엔드 권한 체크 헬퍼
function isSu(userAccount) {
    return userAccount && userAccount.role === 'su';
}

function isAdminOrSu(userAccount) {
    return userAccount && (userAccount.role === 'admin' || userAccount.role === 'su');
}

function isAdminOrCenter(userAccount) {
    return userAccount && (userAccount.role === 'admin' || userAccount.role === 'center' || userAccount.role === 'su');
}

function isTrainer(userAccount) {
    return userAccount && userAccount.role === 'trainer';
}

function isAppUser(appUserId) {
    // app_users 테이블에서 확인
    return appUserId !== null;
}
```

### 방안 2: 역할 그룹 시스템 도입

**장점:**
- 확장성 높음
- 권한 관리가 체계적
- 새로운 역할 추가 용이

**단점:**
- 기존 코드 대폭 수정 필요
- 복잡도 증가

**구현 내용:**
1. 역할 그룹 테이블 생성
2. 권한 매트릭스 정의
3. 동적 권한 체크 시스템 구축

### 방안 3: App User를 accounts.json에 통합

**장점:**
- 모든 계정을 한 곳에서 관리
- 역할 체크가 일관성 있음

**단점:**
- 기존 app_users 테이블과 중복
- 마이그레이션 필요
- 보안 고려사항 증가

## 📝 권장 구현 계획

### Phase 1: 권한 체크 헬퍼 함수 확장
```javascript
// backend/server.js
function isSu(userAccount) {
    return userAccount && userAccount.role === 'su';
}

function isAdmin(userAccount) {
    return userAccount && userAccount.role === 'admin';
}

function isAdminOrSu(userAccount) {
    return isSu(userAccount) || isAdmin(userAccount);
}

function isCenter(userAccount) {
    return userAccount && userAccount.role === 'center';
}

function isTrainer(userAccount) {
    return userAccount && userAccount.role === 'trainer';
}

function isAppUser(appUserId) {
    return appUserId !== null && appUserId !== undefined;
}

// 권한 레벨 체크
function hasPermission(userAccount, requiredLevel) {
    const levels = {
        'su': 4,
        'admin': 3,
        'center': 2,
        'trainer': 1,
        'app_user': 0
    };
    
    const userLevel = levels[userAccount?.role] || 0;
    const required = levels[requiredLevel] || 0;
    
    return userLevel >= required;
}
```

### Phase 2: API 엔드포인트 권한 체크 추가
```javascript
// 예시: 회원 관리 API
app.get('/api/members', async (req, res) => {
    const currentUser = req.session?.user;
    const currentUserAccount = getAccountByUsername(currentUser);
    
    // SU, Admin: 모든 회원 조회
    if (isAdminOrSu(currentUserAccount)) {
        const members = await membersDB.getMembers();
        return res.json(members);
    }
    
    // Center: 본인 센터 회원만
    if (isCenter(currentUserAccount)) {
        const members = await membersDB.getMembersByCenter(currentUserAccount.center);
        return res.json(members);
    }
    
    // Trainer: 본인 담당 회원만
    if (isTrainer(currentUserAccount)) {
        const members = await membersDB.getMembersByTrainer(currentUserAccount.username);
        return res.json(members);
    }
    
    return res.status(403).json({ message: '권한이 없습니다.' });
});
```

### Phase 3: 프론트엔드 권한 체크
```javascript
// public/js/main.js
function isSu(role) {
    return role === 'su';
}

function isAdminOrSu(role) {
    return role === 'admin' || role === 'su';
}

function canAccessTab(role, tabId) {
    const permissions = {
        'su': ['all'], // 모든 탭
        'admin': ['Today', 'Week', 'Member', 'Stat', 'Database', 'Trial', 'Renew', 'Expense', 'Trainer'],
        'center': ['Today', 'Week', 'Member', 'Stat', 'Trial'],
        'trainer': ['SessionCalendar', 'MyMemberList']
    };
    
    if (role === 'su') return true;
    return permissions[role]?.includes(tabId) || false;
}
```

## 🔐 보안 고려사항

1. **최소 권한 원칙**: 필요한 최소한의 권한만 부여
2. **역할 기반 접근 제어**: 모든 API에 권한 체크 필수
3. **세션 관리**: 역할 정보를 세션에 안전하게 저장
4. **감사 로그**: 권한 변경 및 중요 작업 로깅

## 📊 마이그레이션 계획

1. **기존 계정 유지**: 현재 accounts.json 구조 유지
2. **점진적 적용**: 새로운 권한 체크를 단계적으로 적용
3. **하위 호환성**: 기존 기능은 계속 작동하도록 보장
4. **테스트**: 각 역할별로 충분한 테스트 수행

## ✅ 체크리스트

- [ ] 권한 체크 헬퍼 함수 확장
- [ ] API 엔드포인트 권한 체크 추가
- [ ] 프론트엔드 권한 체크 추가
- [ ] 역할별 UI 제어
- [ ] 테스트 및 검증
- [ ] 문서 업데이트
