# 로그인 시스템 통합 설계 문서

## 📋 개요
기존 운영자(su, admin, 트레이너)와 새로운 앱 유저를 구분하여 로그인하고, 각각에 맞는 화면을 표시하는 통합 로그인 시스템을 설계합니다.

---

## 🎯 설계 원칙

1. **하위 호환성**: 기존 운영자 로그인 방식 유지
2. **확장성**: 앱 유저 로그인 추가
3. **명확한 구분**: 운영자와 앱 유저를 명확히 구분
4. **보안**: 앱 유저 비밀번호는 bcrypt 해싱 사용

---

## 🔐 로그인 플로우

### 1. 로그인 시도 순서
```
1. accounts.json에서 운영자 계정 확인
   ├─ 성공 → 운영자 화면 (기존 방식)
   └─ 실패 → 2단계로 진행

2. app_users 테이블에서 앱 유저 계정 확인
   ├─ 성공 → 앱 유저 화면
   └─ 실패 → 로그인 실패
```

### 2. 로그인 응답 구조

#### 운영자 로그인 성공
```json
{
  "message": "로그인 성공!",
  "userType": "operator",
  "role": "admin" | "su" | "trainer" | "center",
  "name": "사용자 이름",
  "center": "센터명" // center 역할일 경우만
}
```

#### 앱 유저 로그인 성공
```json
{
  "message": "로그인 성공!",
  "userType": "app_user",
  "id": "uuid",
  "username": "아이디",
  "name": "사용자 이름",
  "phone": "전화번호",
  "member_name": "회원명" // 매핑된 회원이 있을 경우
}
```

---

## 🗄️ 백엔드 구현

### 1. 로그인 API 수정 (`/api/login`)

**파일**: `backend/server.js`

#### 변경 사항
- `accounts.json` 먼저 확인 (기존 로직)
- 없으면 `app_users` 테이블 확인
- 앱 유저인 경우 bcrypt로 비밀번호 검증
- 로그인 성공 시 `last_login_at` 업데이트
- 응답에 `userType` 필드 추가

#### 의존성 추가
```bash
npm install bcrypt
```

#### 코드 구조
```javascript
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  // 1단계: 운영자 계정 확인 (accounts.json)
  let accounts = [];
  if (fs.existsSync(DATA_PATH)) {
    const raw = fs.readFileSync(DATA_PATH, 'utf-8');
    if (raw) accounts = JSON.parse(raw);
  }
  const operator = accounts.find(acc => 
    acc.username === username && acc.password === password
  );
  
  if (operator) {
    // 운영자 로그인 성공
    const response = {
      message: '로그인 성공!',
      userType: 'operator',
      role: operator.role,
      name: operator.name
    };
    if (operator.role === 'center' && operator.center) {
      response.center = operator.center;
    }
    return res.json(response);
  }
  
  // 2단계: 앱 유저 계정 확인 (app_users 테이블)
  try {
    const appUser = await appUsersDB.getAppUserByUsername(username);
    
    if (!appUser) {
      return res.status(401).json({ 
        message: '아이디 또는 비밀번호가 올바르지 않습니다.' 
      });
    }
    
    // 계정 비활성화 체크
    if (!appUser.is_active) {
      return res.status(403).json({ 
        message: '비활성화된 계정입니다.' 
      });
    }
    
    // 비밀번호 검증 (bcrypt)
    const bcrypt = require('bcrypt');
    const isValidPassword = await bcrypt.compare(password, appUser.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        message: '아이디 또는 비밀번호가 올바르지 않습니다.' 
      });
    }
    
    // 마지막 로그인 시각 업데이트
    await appUsersDB.updateLastLogin(username);
    
    // 앱 유저 로그인 성공
    res.json({
      message: '로그인 성공!',
      userType: 'app_user',
      id: appUser.id,
      username: appUser.username,
      name: appUser.name,
      phone: appUser.phone,
      member_name: appUser.member_name
    });
  } catch (error) {
    console.error('[API] 앱 유저 로그인 오류:', error);
    res.status(500).json({ message: '로그인 처리 중 오류가 발생했습니다.' });
  }
});
```

---

## 🖥️ 프론트엔드 구현

### 1. 로그인 처리 수정

**파일**: `public/js/main.js`

#### 변경 사항
- 로그인 응답의 `userType` 확인
- `userType === 'operator'` → 기존 `showMainSection` 호출
- `userType === 'app_user'` → 새로운 `showAppUserSection` 호출
- localStorage에 `userType` 저장

#### 코드 구조
```javascript
document.getElementById('loginForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const data = {
    username: document.getElementById('login-username').value,
    password: document.getElementById('login-password').value
  };
  
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  const result = await res.json();
  
  if (res.ok) {
    // userType에 따라 분기
    if (result.userType === 'operator') {
      // 기존 운영자 화면
      localStorage.setItem('role', result.role);
      localStorage.setItem('name', result.name);
      localStorage.setItem('userType', 'operator');
      if (result.center) {
        localStorage.setItem('center', result.center);
      }
      showMainSection(result.role, result.name);
    } else if (result.userType === 'app_user') {
      // 앱 유저 화면
      localStorage.setItem('userType', 'app_user');
      localStorage.setItem('appUserId', result.id);
      localStorage.setItem('appUsername', result.username);
      localStorage.setItem('appUserName', result.name);
      if (result.member_name) {
        localStorage.setItem('appUserMemberName', result.member_name);
      }
      showAppUserSection(result);
    }
    
    document.getElementById('logoutBtn').style.display = 'inline-block';
    document.getElementById('settingsBtn').style.display = 'inline-block';
  } else {
    document.getElementById('login-result').innerText = result.message;
  }
});
```

### 2. 자동 로그인 처리 수정

**파일**: `public/js/main.js`

#### 변경 사항
- localStorage의 `userType` 확인
- `userType === 'operator'` → 기존 방식
- `userType === 'app_user'` → 앱 유저 화면 표시

#### 코드 구조
```javascript
window.addEventListener('DOMContentLoaded', function() {
  const savedUserType = localStorage.getItem('userType');
  
  if (savedUserType === 'operator') {
    // 기존 운영자 자동 로그인
    const savedRole = localStorage.getItem('role');
    const savedName = localStorage.getItem('name');
    if (savedRole && savedName) {
      showMainSection(savedRole, savedName);
      document.getElementById('logoutBtn').style.display = 'inline-block';
      document.getElementById('settingsBtn').style.display = 'inline-block';
    }
  } else if (savedUserType === 'app_user') {
    // 앱 유저 자동 로그인
    const appUserId = localStorage.getItem('appUserId');
    const appUserName = localStorage.getItem('appUserName');
    if (appUserId && appUserName) {
      showAppUserSection({
        id: appUserId,
        name: appUserName,
        username: localStorage.getItem('appUsername'),
        phone: localStorage.getItem('appUserPhone'),
        member_name: localStorage.getItem('appUserMemberName')
      });
      document.getElementById('logoutBtn').style.display = 'inline-block';
      document.getElementById('settingsBtn').style.display = 'inline-block';
    }
  } else {
    // 로그인하지 않은 상태
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('settingsBtn').style.display = 'none';
  }
});
```

### 3. 앱 유저 화면 함수 추가

**파일**: `public/js/main.js` 또는 `public/js/app-user.js` (새 파일)

#### 함수 구조
```javascript
function showAppUserSection(appUserData) {
  // 인증 섹션 숨김
  document.getElementById('authSection').style.display = 'none';
  
  // 메인 섹션 표시
  document.getElementById('mainSection').style.display = 'block';
  
  // 운영자용 탭 숨김
  const operatorTabs = document.querySelectorAll('.operator-tab');
  operatorTabs.forEach(tab => tab.style.display = 'none');
  
  // 앱 유저용 탭 표시
  const appUserTabs = document.querySelectorAll('.app-user-tab');
  appUserTabs.forEach(tab => tab.style.display = 'block');
  
  // 앱 유저용 초기 화면 로드
  loadAppUserDashboard(appUserData);
}
```

### 4. 로그아웃 처리 수정

**파일**: `public/js/main.js`

#### 변경 사항
- `userType`에 관계없이 모든 localStorage 항목 삭제
- 앱 유저 관련 항목도 삭제

#### 코드 구조
```javascript
document.getElementById('logoutBtn').onclick = function() {
  if (!confirm('정말 로그아웃 하시겠습니까?')) {
    return;
  }
  
  // 모든 localStorage 항목 삭제
  localStorage.removeItem('role');
  localStorage.removeItem('name');
  localStorage.removeItem('username');
  localStorage.removeItem('userType');
  localStorage.removeItem('center');
  localStorage.removeItem('appUserId');
  localStorage.removeItem('appUsername');
  localStorage.removeItem('appUserName');
  localStorage.removeItem('appUserPhone');
  localStorage.removeItem('appUserMemberName');
  
  // 화면 전환
  document.getElementById('mainSection').style.display = 'none';
  document.getElementById('authSection').style.display = 'block';
  document.getElementById('loginSection').style.display = 'block';
  document.getElementById('signupSection').style.display = 'none';
  document.getElementById('loginForm').reset();
  document.getElementById('login-result').innerText = '';
  document.getElementById('logoutBtn').style.display = 'none';
  document.getElementById('settingsBtn').style.display = 'none';
};
```

---

## 🎨 앱 유저 화면 구조 (향후 구현)

### 1. 기본 레이아웃
- 헤더: 로고, 설정 버튼, 로그아웃 버튼
- 메인 컨텐츠: 탭 기반 네비게이션
- 하단 네비게이션: 운동기록, 식단기록, 마이페이지 등

### 2. 탭 구성 (예정)
- **홈**: 대시보드 (운동/식단 요약)
- **운동기록**: 운동 내역 등록 및 조회
- **식단기록**: 식단 내역 등록 및 조회
- **마이페이지**: 프로필, 설정

### 3. HTML 구조 (향후 추가)
```html
<!-- 앱 유저용 탭 (기본적으로 숨김) -->
<div id="appUserTabs" class="app-user-tab" style="display:none;">
  <div class="tab-nav">
    <button class="tab-btn active" data-tab="dashboard">홈</button>
    <button class="tab-btn" data-tab="workout">운동기록</button>
    <button class="tab-btn" data-tab="diet">식단기록</button>
    <button class="tab-btn" data-tab="profile">마이페이지</button>
  </div>
  
  <div id="appUserContent">
    <!-- 탭별 컨텐츠 -->
  </div>
</div>
```

---

## 📊 데이터 흐름도

```
[사용자 로그인 시도]
        ↓
[accounts.json 확인]
        ↓
    [성공?]
    ├─ YES → 운영자 화면 (기존)
    └─ NO  → app_users 테이블 확인
              ↓
          [성공?]
          ├─ YES → 앱 유저 화면 (신규)
          └─ NO  → 로그인 실패
```

---

## 🔒 보안 고려사항

### 1. 비밀번호 해싱
- 앱 유저 비밀번호는 bcrypt로 해싱 (salt rounds: 10)
- 운영자 비밀번호는 기존 방식 유지 (평문, 향후 개선 가능)

### 2. 계정 비활성화
- `is_active = false`인 앱 유저는 로그인 불가

### 3. 로그인 시도 제한
- 향후 구현: 로그인 실패 횟수 제한 (선택사항)

---

## 📝 구현 체크리스트

### 백엔드
- [ ] bcrypt 패키지 설치
- [ ] `/api/login` 엔드포인트 수정
- [ ] 앱 유저 비밀번호 검증 로직 추가
- [ ] `last_login_at` 업데이트 로직 추가

### 프론트엔드
- [ ] 로그인 폼 submit 핸들러 수정
- [ ] `showAppUserSection` 함수 추가
- [ ] 자동 로그인 로직 수정
- [ ] 로그아웃 로직 수정
- [ ] localStorage 관리 개선

### 향후 작업
- [ ] 앱 유저 화면 UI 구현
- [ ] 운동기록 기능 구현
- [ ] 식단기록 기능 구현
- [ ] 마이페이지 구현

---

## 🎯 참고사항

1. **운영자와 앱 유저 아이디 중복**: 
   - 운영자 아이디와 앱 유저 아이디가 중복될 수 있음
   - 운영자 계정이 우선순위가 높음 (accounts.json 먼저 확인)

2. **설정 버튼**:
   - 운영자: 기존 설정 모달 (비밀번호 변경 등)
   - 앱 유저: 앱 유저용 설정 모달 (향후 구현)

3. **확장성**:
   - 향후 다른 유저 타입 추가 시 `userType` 필드로 확장 가능
