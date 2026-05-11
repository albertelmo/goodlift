import { center } from './center.js';
import { trainer } from './trainer.js';
import { member } from './member.js';
import { trial } from './trial.js';
import { renew } from './renew.js';
import { adminDayCalendar } from './adminDayCalendar.js';
import { adminWeekCalendar } from './adminWeekCalendar.js';
import { adminStats } from './adminStats.js';
import { expense } from './expense.js';
import { database } from './database.js';
import { sales } from './sales.js';
import { strategy } from './strategy.js';
import { ledger } from './ledger.js';
import { trainerLedger } from './trainer-ledger.js';
import { userApp } from './userApp.js';
import { web } from './web.js';
import { showAppUserSection } from './app-user/index.js';

// 권한 체크 헬퍼 함수 (SU 역할 추가)
function isAdminOrSu(role) {
    return role === 'admin' || role === 'su';
}

// 유저앱 화면으로 전환 (트레이너용)
async function switchToAppUserView() {
    // 현재 operator 정보 저장
    const originalRole = localStorage.getItem('role');
    const originalName = localStorage.getItem('name');
    const originalCenter = localStorage.getItem('center');
    const originalUserType = localStorage.getItem('userType');
    const originalUsername = localStorage.getItem('username');
    
    // 원본 정보 저장 (복귀용)
    localStorage.setItem('originalRole', originalRole);
    localStorage.setItem('originalName', originalName);
    localStorage.setItem('originalCenter', originalCenter || '');
    localStorage.setItem('originalUserType', originalUserType);
    localStorage.setItem('originalUsername', originalUsername || '');
    localStorage.setItem('viewMode', 'app_user');
    
    try {
        // 실제 app_user 조회 또는 생성
        const response = await fetch('/api/trainer-app-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: originalUsername,
                name: originalName
            })
        });
        
        if (response.ok) {
            const appUserData = await response.json();
            // 실제 app_user 데이터 사용
            showAppUserSection({
                id: appUserData.id,
                username: appUserData.username,
                name: appUserData.name,
                phone: appUserData.phone || '',
                member_name: appUserData.member_name || null,
                isTrainer: appUserData.isTrainer || false
            });
        } else {
            // API 실패 시 임시 데이터 사용 (하지만 이제는 발생하지 않아야 함)
            console.error('트레이너 app_user 조회 실패:', await response.text());
            const fakeAppUserData = {
                id: 'trainer-' + Date.now(), // 임시 ID
                username: originalUsername || 'trainer',
                name: originalName || '트레이너',
                phone: '',
                member_name: null,
                isTrainer: true
            };
            showAppUserSection(fakeAppUserData);
        }
    } catch (error) {
        console.error('트레이너 app_user 조회 오류:', error);
        // 에러 발생 시 임시 데이터 사용
        const fakeAppUserData = {
            id: 'trainer-' + Date.now(), // 임시 ID
            username: originalUsername || 'trainer',
            name: originalName || '트레이너',
            phone: '',
            member_name: null,
            isTrainer: true
        };
        showAppUserSection(fakeAppUserData);
    }
}

// 트레이너 화면으로 복귀
function switchBackToTrainerView() {
    // 저장된 원본 정보 복원
    const originalRole = localStorage.getItem('originalRole');
    const originalName = localStorage.getItem('originalName');
    const originalCenter = localStorage.getItem('originalCenter');
    const originalUserType = localStorage.getItem('originalUserType');
    const originalUsername = localStorage.getItem('originalUsername');
    
    if (originalRole && originalName) {
        // 앱 유저 섹션 숨기기
        const appUserSection = document.getElementById('app-user-section');
        if (appUserSection) {
            appUserSection.style.display = 'none';
        }
        
        // body 클래스에서 app-user-active 제거
        document.body.classList.remove('app-user-active');
        
        // viewMode 제거
        localStorage.removeItem('viewMode');
        localStorage.removeItem('originalRole');
        localStorage.removeItem('originalName');
        localStorage.removeItem('originalCenter');
        localStorage.removeItem('originalUserType');
        localStorage.removeItem('originalUsername');
        
        // 원래 화면 복원
        showMainSection(originalRole, originalName);
        
        // center 복원
        if (originalCenter) {
            localStorage.setItem('center', originalCenter);
        }
        if (originalUserType) {
            localStorage.setItem('userType', originalUserType);
        }
        if (originalUsername) {
            localStorage.setItem('username', originalUsername);
        }
    }
}

// 전역 함수로 export (다른 모듈에서 사용 가능하도록)
window.switchToAppUserView = switchToAppUserView;
window.switchBackToTrainerView = switchBackToTrainerView;

// 회원가입 폼 표시 및 자동 로그인 처리
window.addEventListener('DOMContentLoaded', function() {
    const savedUserType = localStorage.getItem('userType');
    
    if (savedUserType === 'operator') {
        // 기존 운영자 자동 로그인
    const savedRole = localStorage.getItem('role');
    const savedName = localStorage.getItem('name');
        const viewMode = localStorage.getItem('viewMode');
        
    if (savedRole && savedName) {
            // viewMode가 app_user면 유저앱 화면으로
            if (viewMode === 'app_user') {
                switchToAppUserView();
            } else {
        showMainSection(savedRole, savedName);
        document.getElementById('logoutBtn').style.display = 'inline-block';
        document.getElementById('settingsBtn').style.display = 'inline-block';
            }
        } else {
            document.getElementById('logoutBtn').style.display = 'none';
            document.getElementById('settingsBtn').style.display = 'none';
        }
    } else if (savedUserType === 'app_user') {
        // 앱 유저 자동 로그인
        const appUserId = localStorage.getItem('appUserId');
        const appUserName = localStorage.getItem('appUserName');
        if (appUserId && appUserName) {
            // API를 통해 최신 사용자 정보 가져오기 (isTrainer 포함)
            fetch(`/api/app-users/${appUserId}`)
                .then(response => response.json())
                .then(appUserData => {
                    showAppUserSection({
                        id: appUserData.id,
                        name: appUserData.name,
                        username: appUserData.username,
                        phone: appUserData.phone || '',
                        member_name: appUserData.member_name || null,
                        isTrainer: appUserData.is_trainer === true || appUserData.isTrainer === true
                    });
                    document.getElementById('logoutBtn').style.display = 'inline-block';
                    document.getElementById('settingsBtn').style.display = 'inline-block';
                })
                .catch(error => {
                    console.error('자동 로그인 사용자 정보 조회 오류:', error);
                    // API 실패 시 localStorage 데이터 사용
                    showAppUserSection({
                        id: appUserId,
                        name: appUserName,
                        username: localStorage.getItem('appUsername'),
                        phone: localStorage.getItem('appUserPhone'),
                        member_name: localStorage.getItem('appUserMemberName'),
                        isTrainer: false
                    });
                    document.getElementById('logoutBtn').style.display = 'inline-block';
                    document.getElementById('settingsBtn').style.display = 'inline-block';
                });
            return;
        }
        // 기존 코드 (사용하지 않지만 호환성을 위해 유지)
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
        } else {
            document.getElementById('logoutBtn').style.display = 'none';
            document.getElementById('settingsBtn').style.display = 'none';
        }
    } else {
        // 로그인하지 않은 상태
        document.getElementById('logoutBtn').style.display = 'none';
        document.getElementById('settingsBtn').style.display = 'none';
    }
    
        // 로그인하지 않은 상태에서는 secretBtn 숨김
        const secretBtn = document.getElementById('secretBtn');
        if (secretBtn) {
            secretBtn.style.display = 'none';
        }
    document.getElementById('showSignupBtn').onclick = function() {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('signupSection').style.display = 'block';
        // 아이디 중복 체크 결과 초기화
        const usernameCheckResult = document.getElementById('username-check-result');
        if (usernameCheckResult) {
            usernameCheckResult.textContent = '';
            usernameCheckResult.className = 'username-check-result';
        }
        isUsernameAvailable = false;
    };
    document.getElementById('backToLoginBtn').onclick = function() {
        document.getElementById('signupSection').style.display = 'none';
        document.getElementById('loginSection').style.display = 'block';
        // div로 변경되어 reset() 메서드가 없으므로 수동 초기화
        document.getElementById('signup-username').value = '';
        document.getElementById('signup-password').value = '';
        document.getElementById('signup-password2').value = '';
        document.getElementById('signup-name').value = '';
        document.getElementById('signup-phone').value = '';
        document.getElementById('signup-result').innerText = '';
        // 아이디 중복 체크 결과 초기화
        const usernameCheckResult = document.getElementById('username-check-result');
        if (usernameCheckResult) {
            usernameCheckResult.textContent = '';
            usernameCheckResult.className = 'username-check-result';
        }
        isUsernameAvailable = false;
    };
    document.getElementById('mainLogo').onclick = function() { location.reload(); };
    // 로그인 폼 처리
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
            localStorage.setItem('username', data.username);
                localStorage.setItem('userType', 'operator');
            if (result.center) {
                localStorage.setItem('center', result.center);
            }
            showMainSection(result.role, result.name);
            } else if (result.userType === 'app_user') {
                // 앱 유저 화면
                // 기존 operator 관련 localStorage 항목 제거
                localStorage.removeItem('role');
                localStorage.removeItem('name');
                localStorage.removeItem('username');
                localStorage.removeItem('center');
                
                // 트레이너 전환 관련 localStorage 항목 제거
                localStorage.removeItem('viewMode');
                localStorage.removeItem('originalRole');
                localStorage.removeItem('originalName');
                localStorage.removeItem('originalCenter');
                localStorage.removeItem('originalUserType');
                localStorage.removeItem('originalUsername');
                localStorage.removeItem('connectedMemberName');
                localStorage.removeItem('connectedMemberAppUserId');
                
                localStorage.setItem('userType', 'app_user');
                localStorage.setItem('appUserId', result.id);
                localStorage.setItem('appUsername', result.username);
                localStorage.setItem('appUserName', result.name);
                localStorage.setItem('appUserPhone', result.phone || '');
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

    // 아이디/비밀번호 찾기 모달
    const recoverBtn = document.getElementById('recover-account-btn');
    const recoverModalBg = document.getElementById('recoverAccountModalBg');
    const recoverModal = document.getElementById('recoverAccountModal');
    const recoverCloseBtn = document.getElementById('recoverAccountCloseBtn');
    const recoverUsernameTab = document.getElementById('recoverUsernameTab');
    const recoverPasswordTab = document.getElementById('recoverPasswordTab');
    const recoverSubmitBtn = document.getElementById('recover-submit-btn');
    const recoverResult = document.getElementById('recover-result');
    let recoverMode = 'username';

    const setRecoverTab = (mode) => {
        recoverMode = mode;
        if (recoverUsernameTab && recoverPasswordTab) {
            if (mode === 'username') {
                recoverUsernameTab.style.background = '#1976d2';
                recoverUsernameTab.style.color = '#fff';
                recoverUsernameTab.style.border = 'none';
                recoverPasswordTab.style.background = '#fff';
                recoverPasswordTab.style.color = '#1976d2';
                recoverPasswordTab.style.border = '1px solid #1976d2';
            } else {
                recoverPasswordTab.style.background = '#1976d2';
                recoverPasswordTab.style.color = '#fff';
                recoverPasswordTab.style.border = 'none';
                recoverUsernameTab.style.background = '#fff';
                recoverUsernameTab.style.color = '#1976d2';
                recoverUsernameTab.style.border = '1px solid #1976d2';
            }
        }
        if (recoverResult) {
            recoverResult.textContent = '';
            recoverResult.style.color = '#d32f2f';
        }
    };

    if (recoverBtn && recoverModalBg && recoverModal) {
        recoverBtn.addEventListener('click', () => {
            recoverModalBg.style.display = 'block';
            recoverModal.style.display = 'block';
            setRecoverTab('username');
        });
    }
    if (recoverCloseBtn && recoverModalBg && recoverModal) {
        recoverCloseBtn.addEventListener('click', () => {
            recoverModalBg.style.display = 'none';
            recoverModal.style.display = 'none';
        });
        recoverModalBg.addEventListener('click', (e) => {
            if (e.target === recoverModalBg) {
                recoverModalBg.style.display = 'none';
                recoverModal.style.display = 'none';
            }
        });
    }
    if (recoverUsernameTab) {
        recoverUsernameTab.addEventListener('click', () => setRecoverTab('username'));
    }
    if (recoverPasswordTab) {
        recoverPasswordTab.addEventListener('click', () => setRecoverTab('password'));
    }
    if (recoverSubmitBtn) {
        recoverSubmitBtn.addEventListener('click', async () => {
            const name = document.getElementById('recover-name')?.value.trim();
            const phone = document.getElementById('recover-phone')?.value.trim();
            const email = document.getElementById('recover-email')?.value.trim();
            if (!name || !phone || !email) {
                if (recoverResult) {
                    recoverResult.textContent = '이름, 전화번호, 이메일을 모두 입력해주세요.';
                    recoverResult.style.color = '#d32f2f';
                }
                return;
            }
            recoverSubmitBtn.disabled = true;
            const originalText = recoverSubmitBtn.textContent;
            recoverSubmitBtn.textContent = '처리 중...';
            try {
                const res = await fetch('/api/auth/recover', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, phone, email, type: recoverMode })
                });
                const result = await res.json();
                if (res.ok) {
                    if (recoverResult) {
                        recoverResult.textContent = result.message || '요청이 완료되었습니다.';
                        recoverResult.style.color = '#2e7d32';
                    }
                } else {
                    if (recoverResult) {
                        recoverResult.textContent = result.message || '요청 처리 중 오류가 발생했습니다.';
                        recoverResult.style.color = '#d32f2f';
                    }
                }
            } catch (error) {
                if (recoverResult) {
                    recoverResult.textContent = '요청 처리 중 오류가 발생했습니다.';
                    recoverResult.style.color = '#d32f2f';
                }
            } finally {
                recoverSubmitBtn.disabled = false;
                recoverSubmitBtn.textContent = originalText;
            }
        });
    }
    // 아이디 중복 체크 (debounce 적용)
    let usernameCheckTimeout = null;
    const usernameInput = document.getElementById('signup-username');
    const usernameCheckResult = document.getElementById('username-check-result');
    let isUsernameAvailable = false;
    
    if (usernameInput && usernameCheckResult) {
        usernameInput.addEventListener('input', function() {
            const username = this.value.trim();
            
            // 이전 타이머 취소
            if (usernameCheckTimeout) {
                clearTimeout(usernameCheckTimeout);
            }
            
            // 빈 값이면 결과 숨김
            if (!username) {
                usernameCheckResult.textContent = '';
                usernameCheckResult.className = 'username-check-result';
                isUsernameAvailable = false;
                return;
            }
            
            // 최소 길이 체크
            if (username.length < 3) {
                usernameCheckResult.textContent = '아이디는 최소 3자 이상이어야 합니다.';
                usernameCheckResult.className = 'username-check-result error';
                isUsernameAvailable = false;
                return;
            }
            
            // 로딩 표시
            usernameCheckResult.textContent = '확인 중...';
            usernameCheckResult.className = 'username-check-result checking';
            
            // 500ms 후 중복 체크 (debounce)
            usernameCheckTimeout = setTimeout(async () => {
                try {
                    const res = await fetch(`/api/check-username?username=${encodeURIComponent(username)}`);
                    
                    if (!res.ok) {
                        // HTTP 오류 응답 처리
                        const errorData = await res.json().catch(() => ({ message: '서버 오류가 발생했습니다.' }));
                        usernameCheckResult.textContent = errorData.message || '확인 중 오류가 발생했습니다.';
                        usernameCheckResult.className = 'username-check-result error';
                        isUsernameAvailable = false;
                        return;
                    }
                    
                    const result = await res.json();
                    
                    if (result && typeof result.available !== 'undefined') {
                        if (result.available) {
                            usernameCheckResult.textContent = result.message || '사용 가능한 아이디입니다.';
                            usernameCheckResult.className = 'username-check-result success';
                            isUsernameAvailable = true;
                        } else {
                            usernameCheckResult.textContent = result.message || '이미 사용 중인 아이디입니다.';
                            usernameCheckResult.className = 'username-check-result error';
                            isUsernameAvailable = false;
                        }
                    } else {
                        // 응답 형식이 올바르지 않은 경우
                        usernameCheckResult.textContent = '응답 형식 오류가 발생했습니다.';
                        usernameCheckResult.className = 'username-check-result error';
                        isUsernameAvailable = false;
                    }
                } catch (error) {
                    console.error('아이디 중복 체크 오류:', error);
                    usernameCheckResult.textContent = '네트워크 오류가 발생했습니다. 다시 시도해주세요.';
                    usernameCheckResult.className = 'username-check-result error';
                    isUsernameAvailable = false;
                }
            }, 500);
        });
    }
    
    // 회원가입 폼 처리 (앱 유저 전용) - form 태그를 div로 변경하여 브라우저가 폼으로 인식하지 않도록 함
    document.getElementById('signup-submit-btn').addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const pwd1 = document.getElementById('signup-password');
        const pwd2 = document.getElementById('signup-password2');
        const password = pwd1.value;
        const password2 = pwd2.value;
        
        if (password !== password2) {
            document.getElementById('signup-result').innerText = '비밀번호가 일치하지 않습니다.';
            return;
        }
        
        const username = document.getElementById('signup-username').value.trim();
        
        // 아이디 중복 체크
        if (!isUsernameAvailable) {
            document.getElementById('signup-result').innerText = '사용 가능한 아이디를 입력해주세요.';
            return;
        }
        
        const data = {
            username: username,
            password: password,
            name: document.getElementById('signup-name').value.trim(),
            phone: document.getElementById('signup-phone').value.trim()
        };
        
        // 유효성 검사
        if (!data.username || !data.password || !data.name || !data.phone) {
            document.getElementById('signup-result').innerText = '모든 필수 항목을 입력해주세요.';
            return;
        }
        
        // 전화번호 형식 간단 검증 (선택사항)
        const phoneRegex = /^[0-9-]+$/;
        if (!phoneRegex.test(data.phone)) {
            document.getElementById('signup-result').innerText = '전화번호 형식이 올바르지 않습니다.';
            return;
        }
        
        const res = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        document.getElementById('signup-result').innerText = result.message;
        
        // 회원가입 성공 시 즉시 폼 숨김 및 초기화
        if (res.ok) {
            // 비밀번호 필드 즉시 초기화
            pwd1.value = '';
            pwd2.value = '';
            
            // 회원가입 섹션을 즉시 숨김
                document.getElementById('signupSection').style.display = 'none';
                document.getElementById('loginSection').style.display = 'block';
            
            // 모든 입력 필드 초기화
            document.getElementById('signup-username').value = '';
            document.getElementById('signup-name').value = '';
            document.getElementById('signup-phone').value = '';
                document.getElementById('signup-result').innerText = '';
            // 아이디 중복 체크 결과 초기화
            if (usernameCheckResult) {
                usernameCheckResult.textContent = '';
                usernameCheckResult.className = 'username-check-result';
            }
            isUsernameAvailable = false;
            document.getElementById('loginForm').reset();
                document.getElementById('login-result').innerText = '';
        }
    });
    // 유저앱 전환 버튼 이벤트
    const switchToAppUserBtn = document.getElementById('switchToAppUserBtn');
    if (switchToAppUserBtn) {
        switchToAppUserBtn.addEventListener('click', function() {
            switchToAppUserView();
        });
    }
    
    // 로그아웃 처리
    document.getElementById('logoutBtn').innerText = '로그아웃';
    document.getElementById('logoutBtn').onclick = function() {
        // 로그아웃 확인 메시지
        if (!confirm('정말 로그아웃 하시겠습니까?')) {
            return; // 취소하면 로그아웃하지 않음
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
        localStorage.removeItem('viewMode');
        localStorage.removeItem('originalRole');
        localStorage.removeItem('originalName');
        localStorage.removeItem('originalCenter');
        localStorage.removeItem('originalUserType');
        localStorage.removeItem('originalUsername');
        // 연결된 회원 정보 삭제
        localStorage.removeItem('connectedMemberName');
        localStorage.removeItem('connectedMemberAppUserId');
        // 트레이너 뷰 모드 관련 정보 삭제
        localStorage.removeItem('viewingTrainerAppUserId');
        localStorage.removeItem('isReadOnly');
        localStorage.removeItem('viewingTrainerName');
        localStorage.removeItem('autoOpenWorkoutAdd');
        
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
    document.getElementById('settingsBtn').onclick = function() {
        // 계정 정보 변경 모달 띄우기 (아래에서 구현)
        showAccountSettingsModal();
    };
});
// 역할별 탭 및 내용 정의
const adminTabs = [
    { label: '📅 오늘', id: 'Today', content: '<div id="admin-day-calendar-root"></div>' },
    { label: '🎯 상담', id: 'Trial', content: '<div id="trial-root"></div>' },
    { label: '🔄 재등록', id: 'Renew', content: '<div id="renew-root"></div>' },
    { label: '💵 매출', id: 'Sales', content: '<div id="sales-root"></div>' },
    { label: '📈 전략', id: 'Strategy', content: '<div id="strategy-root"></div>' }
];

const adminHamburgerItems = [
    { label: '📆 주간', id: 'Week', content: '<div id="admin-week-calendar-root"></div>' },
    { label: '👤 회원', id: 'Member', content: '<div class="member-container"><div class="member-mobile-tabs"><button class="member-tab-btn active" data-tab="list">📋 목록</button><button class="member-tab-btn" data-tab="search">🔍 검색</button><button class="member-tab-btn" data-tab="add">➕ 추가</button></div><div class="member-flex-wrap"><div id="member-search" class="member-tab-content"></div><div id="member-add" class="member-tab-content"></div><div id="member-list" class="member-tab-content active"></div></div></div>' },
    { label: '💰 지출', id: 'Expense', content: '<div id="expense-root"></div>' },
    { label: '📊 통계', id: 'Stat', content: '<div id="admin-stats-root"></div>' },
    { label: '🌐 웹', id: 'Web', content: '<div id="web-root"></div>' },
    { label: '💾 DB', id: 'Database', content: '<div id="database-root"></div>' },
    { label: '👥 트레이너', id: 'Trainer', content: '<div id="trainer-list-loading" style="text-align:center;padding:20px;color:#888;display:none;">불러오는 중...</div><div id="trainer-list"></div>' },
    { label: '📱 유저앱', id: 'UserApp', content: '<div id="user-app-root"></div>' },
    { label: '📖 장부', id: 'Ledger', content: '<div id="ledger-root"></div>', suOnly: true }
];
const trainerTabs = [
    { label: '나의 수업', id: '📅', content: '<div id="session-calendar"></div>' },
    { label: '전체 수업', id: 'Today', content: '<div id="admin-day-calendar-root"></div>' },
    { label: '나의 회원', id: '👤', content: '<div id="my-member-list"></div>' },
    { label: '장부', id: '📖', content: '<div id="trainer-ledger-root"></div>' }
];

// 센터관리자용 탭 (Center, Trainer 탭 제외)
const centerTabs = [
    { label: '📅 오늘', id: 'Today', content: '<div id="admin-day-calendar-root"></div>' },
    { label: '📆 주간', id: 'Week', content: '<div id="admin-week-calendar-root"></div>' },
    { label: '👤 회원', id: 'Member', content: '<div class="member-container"><div class="member-mobile-tabs"><button class="member-tab-btn active" data-tab="list">📋 목록</button><button class="member-tab-btn" data-tab="search">🔍 검색</button><button class="member-tab-btn" data-tab="add">➕ 추가</button></div><div class="member-flex-wrap"><div id="member-search" class="member-tab-content"></div><div id="member-add" class="member-tab-content"></div><div id="member-list" class="member-tab-content active"></div></div></div>' },
    { label: '💹 매출', id: 'Sales', content: '<div id="sales-root"></div>' }
];

const centerHamburgerItems = [
    { label: '🎯 상담', id: 'Trial', content: '<div id="trial-root"></div>' }
];
function showMainSection(role, name) {
    // 로그인 시 세션 캐시 초기화 (다른 트레이너의 캐시 방지)
    if (role === 'trainer') {
        trainer.invalidateSessionsCache();
    }
    
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('mainSection').style.display = 'block';
    
    // 상단바 다시 표시
    const oldHeader = document.getElementById('old-header');
    if (oldHeader) {
        oldHeader.style.display = 'flex';
    }
    
    document.getElementById('logoutBtn').style.display = 'inline-block';
    document.getElementById('settingsBtn').style.display = 'inline-block';
    
    // su 계정일 때만 secretBtn 표시 (admin·트레이너·센터관리자 등 제외)
    const secretBtn = document.getElementById('secretBtn');
    if (secretBtn) {
        secretBtn.style.display = role === 'su' ? 'inline-block' : 'none';
    }
    
    // 관리자일 때만 상담 버튼 표시 (트레이너는 제외)
    const consultationBtn = document.getElementById('consultationBtn');
    if (consultationBtn) {
        if (role === 'trainer') {
            consultationBtn.style.display = 'none';
        } else {
            consultationBtn.style.display = isAdminOrSu(role) ? 'flex' : 'none';
        }
    }
    
    // 트레이너일 때만 유저앱 전환 버튼 표시
    const switchToAppUserBtn = document.getElementById('switchToAppUserBtn');
    if (switchToAppUserBtn) {
        if (role === 'trainer') {
            switchToAppUserBtn.style.setProperty('display', 'flex', 'important');
        } else {
            switchToAppUserBtn.style.setProperty('display', 'none', 'important');
        }
    }
    
    let tabs;
    if (isAdminOrSu(role)) {
        tabs = adminTabs;
        renderTabs(tabs);
    } else if (role === 'center') {
        tabs = centerTabs;
        renderTabs(tabs);
    } else if (role === 'trainer') {
        // 트레이너 정보 조회하여 수습 여부 및 장부 여부 확인
        const username = localStorage.getItem('username');
        if (username) {
            fetch(`/api/trainers?username=${encodeURIComponent(username)}`)
                .then(res => res.json())
                .then(trainers => {
                    if (trainers && trainers.length > 0) {
                        const trainer = trainers[0];
                        tabs = [...trainerTabs];
                        
                        // 수습 트레이너(probation === 'on')인 경우 '전체 수업' 탭 제외
                        if (trainer.probation === 'on') {
                            tabs = tabs.filter(tab => tab.id !== 'Today');
                        }
                        
                        // 장부 기능이 'off'인 경우 장부 탭 제외
                        if (trainer.ledger !== 'on') {
                            tabs = tabs.filter(tab => tab.id !== '📖');
                        }
                    } else {
                        tabs = trainerTabs.filter(tab => tab.id !== '📖'); // 장부 탭 제외
                    }
                    renderTabs(tabs);
                })
                .catch(error => {
                    console.error('트레이너 정보 조회 오류:', error);
                    tabs = trainerTabs.filter(tab => tab.id !== '📖'); // 장부 탭 제외
                    renderTabs(tabs);
                });
        } else {
            tabs = trainerTabs.filter(tab => tab.id !== '📖'); // 장부 탭 제외
            renderTabs(tabs);
        }
    } else {
        tabs = trainerTabs;
        renderTabs(tabs);
    }
}

// showAppUserSection은 app-user/index.js로 이동됨
function renderTabs(tabs) {
    const tabBar = document.getElementById('tabBar');
    const tabContent = document.getElementById('tabContent');
    tabBar.innerHTML = '';
    
    // 첫 번째 탭의 컨텐츠 표시
    const firstTab = tabs[0];
    tabContent.innerHTML = firstTab.content;
    const firstTabId = firstTab.id || firstTab.label;
    renderTabContent(firstTabId, tabContent);
    
    // 일반 탭 생성
    tabs.forEach((tab, idx) => {
        const btn = document.createElement('button');
        btn.textContent = tab.label;
        btn.className = idx === 0 ? 'active' : '';
        btn.onclick = function() {
            // 사이드 패널 닫기
            closeHamburgerMenu();
            Array.from(tabBar.querySelectorAll('button')).forEach(b => {
                if (!b.classList.contains('tab-hamburger-btn')) {
                    b.classList.remove('active');
                }
            });
            btn.classList.add('active');
            tabContent.innerHTML = tab.content;
            const tabId = tab.id || tab.label;
            renderTabContent(tabId, tabContent);
        };
        tabBar.appendChild(btn);
    });
    
    // 햄버거 메뉴 버튼 추가
    const role = localStorage.getItem('role');
    let hamburgerItems = null;
    if (isAdminOrSu(role) && adminHamburgerItems && adminHamburgerItems.length > 0) {
        hamburgerItems = adminHamburgerItems;
    } else if (role === 'center' && centerHamburgerItems && centerHamburgerItems.length > 0) {
        hamburgerItems = centerHamburgerItems;
    }
    
    if (hamburgerItems) {
        const hamburgerBtn = document.createElement('button');
        hamburgerBtn.innerHTML = '☰';
        hamburgerBtn.className = 'tab-hamburger-btn';
        hamburgerBtn.onclick = function(e) {
            e.stopPropagation();
            toggleHamburgerMenu(hamburgerItems);
        };
        tabBar.appendChild(hamburgerBtn);
        
        // 사이드 패널 생성
        createHamburgerSidePanel(hamburgerItems);
    }
    
    // 첫 번째 탭 렌더링
    renderTabContent(firstTab.id, tabContent);
}

// 햄버거 메뉴 사이드 패널 생성
function createHamburgerSidePanel(items) {
    // 기존 패널이 있으면 제거
    const existingPanel = document.getElementById('hamburger-side-panel');
    const existingBg = document.getElementById('hamburger-side-panel-bg');
    if (existingPanel) existingPanel.remove();
    if (existingBg) existingBg.remove();
    
    // 배경 오버레이
    const bg = document.createElement('div');
    bg.id = 'hamburger-side-panel-bg';
    bg.className = 'hamburger-side-panel-bg';
    bg.onclick = closeHamburgerMenu;
    document.body.appendChild(bg);
    
    // 사이드 패널
    const panel = document.createElement('div');
    panel.id = 'hamburger-side-panel';
    panel.className = 'hamburger-side-panel';
    
    const header = document.createElement('div');
    header.className = 'hamburger-side-panel-header';
    header.innerHTML = '<h3>⚙️ 운영</h3><button class="hamburger-close-btn">×</button>';
    header.querySelector('.hamburger-close-btn').onclick = closeHamburgerMenu;
    panel.appendChild(header);
    
    const menuList = document.createElement('div');
    menuList.className = 'hamburger-side-panel-menu';
    
    const role = localStorage.getItem('role');
    items.forEach((item) => {
        // suOnly가 true인 경우 su 유저에게만 표시
        if (item.suOnly && role !== 'su') {
            return;
        }
        const menuItem = document.createElement('button');
        menuItem.className = 'hamburger-menu-item';
        menuItem.textContent = item.label;
        menuItem.onclick = function() {
            closeHamburgerMenu();
            const tabContent = document.getElementById('tabContent');
            tabContent.innerHTML = item.content;
            renderTabContent(item.id, tabContent);
            // 모든 탭 버튼 비활성화
            Array.from(document.getElementById('tabBar').querySelectorAll('button')).forEach(b => {
                if (!b.classList.contains('tab-hamburger-btn')) {
                    b.classList.remove('active');
                }
            });
        };
        menuList.appendChild(menuItem);
    });
    
    panel.appendChild(menuList);
    document.body.appendChild(panel);
}

// 햄버거 메뉴 열기/닫기
function toggleHamburgerMenu(items) {
    const panel = document.getElementById('hamburger-side-panel');
    const bg = document.getElementById('hamburger-side-panel-bg');
    if (panel && bg) {
        const isOpen = panel.classList.contains('open');
        if (isOpen) {
            closeHamburgerMenu();
        } else {
            openHamburgerMenu();
        }
    } else if (items) {
        createHamburgerSidePanel(items);
        openHamburgerMenu();
    }
}

function openHamburgerMenu() {
    const panel = document.getElementById('hamburger-side-panel');
    const bg = document.getElementById('hamburger-side-panel-bg');
    if (panel && bg) {
        panel.classList.add('open');
        bg.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
}

function closeHamburgerMenu() {
    const panel = document.getElementById('hamburger-side-panel');
    const bg = document.getElementById('hamburger-side-panel-bg');
    if (panel && bg) {
        panel.classList.remove('open');
        bg.classList.remove('open');
        document.body.style.overflow = '';
    }
}

// 탭 컨텐츠 렌더링 함수
function renderTabContent(tabId, tabContent) {
    if (tabId === 'Today') {
        adminDayCalendar.render(document.getElementById('admin-day-calendar-root'));
    } else if (tabId === 'Week') {
        adminWeekCalendar.render(document.getElementById('admin-week-calendar-root'));
    } else if (tabId === 'Member') {
        member.renderAddForm(document.getElementById('member-add'));
        member.renderList(document.getElementById('member-list'));
        member.renderSearch(document.getElementById('member-search'));
        initMemberMobileTabs(); // 모바일 탭 초기화
    } else if (tabId === 'Trial') {
        trial.render(document.getElementById('trial-root'));
    } else if (tabId === 'Renew') {
        renew.render(document.getElementById('renew-root'));
    } else if (tabId === 'Stat') {
        adminStats.render(tabContent.querySelector('#admin-stats-root') || tabContent);
    } else if (tabId === 'Expense') {
        expense.render(tabContent.querySelector('#expense-root') || tabContent);
    } else if (tabId === 'Strategy') {
        strategy.render(tabContent.querySelector('#strategy-root') || tabContent);
    } else if (tabId === 'Database') {
        database.render(tabContent.querySelector('#database-root') || tabContent);
    } else if (tabId === 'Sales') {
        sales.render(tabContent.querySelector('#sales-root') || tabContent);
    } else if (tabId === 'Trainer') {
        trainer.loadList();
    } else if (tabId === 'Web') {
        web.render(tabContent.querySelector('#web-root') || tabContent);
    } else if (tabId === 'Ledger') {
        ledger.render(tabContent.querySelector('#ledger-root') || tabContent);
    } else if (tabId === 'UserApp') {
        userApp.render(tabContent.querySelector('#user-app-root') || tabContent);
    } else if (tabId === '내 회원 리스트' || tabId === '👤') {
        const username = localStorage.getItem('username');
        trainer.renderMyMembers(tabContent.querySelector('#my-member-list') || tabContent, username);
    } else if (tabId === '📅') {
        trainer.renderSessionCalendar(tabContent.querySelector('#session-calendar') || tabContent);
    } else if (tabId === '📖') {
        trainerLedger.render(tabContent.querySelector('#trainer-ledger-root') || tabContent);
    } else if (tabId === 'Today') {
        adminDayCalendar.render(document.getElementById('admin-day-calendar-root'));
    }
}

// 회원 탭 모바일 탭 초기화
function initMemberMobileTabs() {
    const tabButtons = document.querySelectorAll('.member-tab-btn');
    
    if (tabButtons.length === 0) {
        return; // PC 환경이거나 탭이 없으면 종료
    }
    
    tabButtons.forEach(btn => {
        // 기존 이벤트 리스너 제거 (중복 방지)
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = newBtn.dataset.tab;
            
            // 모든 탭 버튼 비활성화
            document.querySelectorAll('.member-tab-btn').forEach(b => b.classList.remove('active'));
            // 클릭한 버튼 활성화
            newBtn.classList.add('active');
            
            // 컨텐츠 전환
            const addContent = document.getElementById('member-add');
            const listContent = document.getElementById('member-list');
            const searchContent = document.getElementById('member-search');
            
            if (!addContent || !listContent || !searchContent) {
                return;
            }
            
            // 모든 컨텐츠 숨기기
            addContent.classList.remove('active');
            listContent.classList.remove('active');
            searchContent.classList.remove('active');
            
            // 선택된 탭만 표시
            if (targetTab === 'add') {
                addContent.classList.add('active');
            } else if (targetTab === 'search') {
                searchContent.classList.add('active');
            } else {
                listContent.classList.add('active');
            }
        });
    });
}

function renderSampleScheduler() {
    const root = document.getElementById('scheduler-root');
    if (!root) return;
    // 샘플이 아닌 빈 캘린더 UI만 표시
    const trainers = [];
    const times = [];
    // 상단 헤더
    let html = `<div class="scheduler-wrap">
        <div class="scheduler-header">
            <div class="date-nav">
                <button>&lt;</button>
                <span style="font-size:1.15rem;font-weight:700;">날짜를 선택하세요</span>
                <button>&gt;</button>
            </div>
            <div class="scheduler-legend">
                <span class="legend"><span class="dot dot-reserved"></span>예약</span>
                <span class="legend"><span class="dot dot-pre"></span>미예약</span>
                <span class="legend"><span class="dot dot-attend"></span>출석</span>
                <span class="legend"><span class="dot dot-absent"></span>결석</span>
                <span class="legend"><span class="dot dot-cancel"></span>취소</span>
                <span class="legend"><span class="dot dot-allcancel"></span>전체취소</span>
            </div>
            <div style="margin-left:auto;display:flex;gap:8px;">
                <button style="background:var(--primary);color:#fff;">전체보기</button>
                <button style="background:var(--accent);color:#fff;">현재</button>
            </div>
        </div>
        <div class="scheduler-table-wrap">
            <table class="scheduler-table">
                <thead><tr><th class="time-col"></th></tr></thead><tbody></tbody></table></div></div>`;
    root.innerHTML = html;
}

async function showAccountSettingsModal() {
    const modal = document.getElementById('accountSettingsModal');
    const bg = document.getElementById('accountSettingsModalBg');
    const trainerOptionsSection = document.getElementById('trainerOptionsSection');
    const adminPushSection = document.getElementById('adminPushSection');
    const role = localStorage.getItem('role');
    
    modal.style.display = 'block';
    bg.style.display = 'block';
    document.getElementById('changePwForm').reset();
    document.getElementById('changePwResult').innerText = '';
    document.getElementById('trainerOptionsResult').innerText = '';
    
    // 트레이너인 경우 옵션 섹션 표시 및 정보 로드
    if (role === 'trainer') {
        trainerOptionsSection.style.display = 'block';
        await loadTrainerOptions();
    } else {
        trainerOptionsSection.style.display = 'none';
    }

    if (isAdminOrSu(role)) {
        if (adminPushSection) {
            adminPushSection.style.display = 'block';
            await loadAdminPushSettings();
        }
    } else if (adminPushSection) {
        adminPushSection.style.display = 'none';
    }
}

// 트레이너 옵션 정보 로드 및 버튼 상태 설정
async function loadTrainerOptions() {
    const username = localStorage.getItem('username');
    if (!username) return;
    
    try {
        const res = await fetch(`/api/trainers?username=${encodeURIComponent(username)}`);
        const trainers = await res.json();
        
        if (trainers.length > 0) {
            const trainer = trainers[0];
            
            // VIP 버튼 상태 설정
            const vipBtn = document.getElementById('trainerVipToggle');
            const vipStatus = trainer.vip_member || false;
            updateToggleButton(vipBtn, vipStatus, 'VIP');
            
            // 30분 세션 버튼 상태 설정
            const thirtyMinBtn = document.getElementById('trainer30minToggle');
            const thirtyMinStatus = trainer['30min_session'] === 'on';
            updateToggleButton(thirtyMinBtn, thirtyMinStatus, '30분');
            
            // 월간보기 버튼 상태 설정
            const monthlyViewBtn = document.getElementById('trainerMonthlyViewToggle');
            const monthlyViewStatus = (trainer.default_view_mode || 'week') === 'month';
            updateToggleButton(monthlyViewBtn, monthlyViewStatus, '월간보기');
        }
    } catch (error) {
        console.error('트레이너 옵션 로드 오류:', error);
    }
}

// 토글 버튼 상태 업데이트
function updateToggleButton(btn, isOn, label) {
    if (isOn) {
        btn.style.background = '#e3f2fd';
        btn.style.color = '#1976d2';
        btn.style.borderColor = '#1976d2';
        btn.textContent = 'ON';
    } else {
        btn.style.background = '#f5f5f5';
        btn.style.color = '#666';
        btn.style.borderColor = '#666';
        btn.textContent = 'OFF';
    }
}

function isPushSupported() {
    return (
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
    );
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function getAdminPushRegistration() {
    if (!isPushSupported()) return null;
    const existing = await navigator.serviceWorker.getRegistration('/');
    return existing || navigator.serviceWorker.register('/sw.js');
}

function getAdminPushElements() {
    return {
        toggleBtn: document.getElementById('adminPushToggle'),
        registerBtn: document.getElementById('adminPushRegisterBtn'),
        deviceLabelInput: document.getElementById('adminPushDeviceLabel'),
        devicesContainer: document.getElementById('adminPushDevices'),
        resultEl: document.getElementById('adminPushResult')
    };
}

function setAdminPushResult(message, isError = false) {
    const { resultEl } = getAdminPushElements();
    if (!resultEl) return;
    resultEl.style.color = isError ? '#d32f2f' : '#2e7d32';
    resultEl.textContent = message || '';
}

async function loadAdminPushSettings() {
    const username = localStorage.getItem('username');
    if (!username) return;
    const { toggleBtn, devicesContainer } = getAdminPushElements();
    try {
        const statusRes = await fetch(`/api/admin/push/status?username=${encodeURIComponent(username)}`);
        const status = await statusRes.json();
        if (toggleBtn) {
            updateToggleButton(toggleBtn, status.enabled === true, '푸쉬');
        }
        await loadAdminPushDevices();
    } catch (error) {
        console.error('관리자 푸쉬 상태 조회 오류:', error);
        if (devicesContainer) {
            devicesContainer.textContent = '푸쉬 상태를 불러오지 못했습니다.';
        }
    }
}

async function loadAdminPushDevices() {
    const username = localStorage.getItem('username');
    if (!username) return;
    const { devicesContainer } = getAdminPushElements();
    if (!devicesContainer) return;
    devicesContainer.textContent = '불러오는 중...';
    try {
        const res = await fetch(`/api/admin/push/subscriptions?username=${encodeURIComponent(username)}`);
        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];
        if (items.length === 0) {
            devicesContainer.textContent = '등록된 기기가 없습니다.';
            return;
        }
        devicesContainer.innerHTML = items.map(item => {
            const label = item.device_label || item.platform || '알 수 없음';
            const status = item.is_active ? 'ON' : 'OFF';
            return `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 4px;border-bottom:1px solid #f0f0f0;gap:8px;">
                    <div style="min-width:0;">
                        <div style="font-weight:600;color:#333;font-size:0.85rem;">${label}</div>
                        <div style="font-size:0.75rem;color:#888;">${status}</div>
                    </div>
                    <button type="button" class="admin-push-device-remove" data-endpoint="${item.endpoint}" style="background:#f5f5f5;color:#666;border:1px solid #ddd;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:0.75rem;white-space:nowrap;">해제</button>
                </div>
            `;
        }).join('');

        devicesContainer.querySelectorAll('.admin-push-device-remove').forEach(btn => {
            btn.addEventListener('click', async () => {
                const endpoint = btn.getAttribute('data-endpoint');
                if (!endpoint) return;
                await unsubscribeAdminPush(endpoint);
            });
        });
    } catch (error) {
        console.error('관리자 푸쉬 기기 목록 조회 오류:', error);
        devicesContainer.textContent = '기기 목록을 불러오지 못했습니다.';
    }
}

async function updateAdminPushSetting(enabled) {
    const username = localStorage.getItem('username');
    const currentUser = localStorage.getItem('username');
    if (!username || !currentUser) return;
    setAdminPushResult('처리 중...', false);
    try {
        const res = await fetch('/api/admin/push/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, enabled, currentUser })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || '설정 변경 실패');
        }
        setAdminPushResult('✅ 설정이 변경되었습니다.', false);
        setTimeout(() => setAdminPushResult(''), 1500);
    } catch (error) {
        console.error('관리자 푸쉬 설정 변경 오류:', error);
        setAdminPushResult(error.message || '설정 변경 중 오류가 발생했습니다.', true);
        throw error;
    }
}

async function ensureAdminPushSubscription() {
    const username = localStorage.getItem('username');
    const currentUser = localStorage.getItem('username');
    if (!username || !currentUser) return;
    if (!isPushSupported()) {
        throw new Error('이 기기에서는 푸쉬 알림을 지원하지 않습니다.');
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        throw new Error('알림 권한이 필요합니다.');
    }
    const reg = await getAdminPushRegistration();
    if (!reg) {
        throw new Error('서비스워커 등록에 실패했습니다.');
    }
    const keyRes = await fetch('/api/push/vapid-public-key');
    const keyData = await keyRes.json();
    if (!keyRes.ok || !keyData.publicKey) {
        throw new Error(keyData.message || 'VAPID 키를 불러오지 못했습니다.');
    }
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
        subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
        });
    }
    const { deviceLabelInput } = getAdminPushElements();
    const deviceLabel = deviceLabelInput?.value?.trim() || null;
    const payload = {
        username,
        currentUser,
        subscription,
        user_agent: navigator.userAgent,
        platform: navigator.platform || null,
        device_label: deviceLabel
    };
    const res = await fetch('/api/admin/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || '구독 등록 실패');
    }
    await loadAdminPushDevices();
}

async function unsubscribeAdminPush(endpoint) {
    const username = localStorage.getItem('username');
    const currentUser = localStorage.getItem('username');
    if (!username || !currentUser) return;
    const res = await fetch('/api/admin/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, endpoint, currentUser })
    });
    const data = await res.json();
    if (!res.ok) {
        alert(data.message || '구독 해제 실패');
        return;
    }
    await loadAdminPushDevices();
}

// 트레이너 옵션 업데이트
async function updateTrainerOption(optionType, newValue) {
    const username = localStorage.getItem('username');
    if (!username) return;
    
    const resultDiv = document.getElementById('trainerOptionsResult');
    resultDiv.style.color = '#666';
    resultDiv.innerText = '처리 중...';
    
    try {
        const currentUser = localStorage.getItem('username');
        const body = { currentUser };
        
        if (optionType === 'vip') {
            body.vip_member = newValue;
        } else if (optionType === '30min') {
            body['30min_session'] = newValue ? 'on' : 'off';
        } else if (optionType === 'monthlyView') {
            body.default_view_mode = newValue ? 'month' : 'week';
        }
        
        const res = await fetch(`/api/trainers/${encodeURIComponent(username)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        const result = await res.json();
        
        if (res.ok) {
            resultDiv.style.color = '#2e7d32';
            resultDiv.innerText = '✅ 설정이 변경되었습니다.';
            setTimeout(() => {
                resultDiv.innerText = '';
            }, 1500);
        } else {
            resultDiv.style.color = '#d32f2f';
            resultDiv.innerText = result.message || '설정 변경에 실패했습니다.';
        }
    } catch (error) {
        console.error('트레이너 옵션 업데이트 오류:', error);
        resultDiv.style.color = '#d32f2f';
        resultDiv.innerText = '설정 변경 중 오류가 발생했습니다.';
    }
}

// 트레이너 옵션 토글 버튼 이벤트 리스너 설정
document.addEventListener('DOMContentLoaded', function() {
    // VIP 토글
    const vipBtn = document.getElementById('trainerVipToggle');
    if (vipBtn) {
        vipBtn.onclick = async function() {
            const currentStatus = this.textContent === 'ON';
            const newStatus = !currentStatus;
            updateToggleButton(this, newStatus, 'VIP');
            await updateTrainerOption('vip', newStatus);
            // 실패 시 원래 상태로 복원
            if (document.getElementById('trainerOptionsResult').style.color === '#d32f2f') {
                updateToggleButton(this, currentStatus, 'VIP');
            }
        };
    }
    
    // 30분 세션 토글
    const thirtyMinBtn = document.getElementById('trainer30minToggle');
    if (thirtyMinBtn) {
        thirtyMinBtn.onclick = async function() {
            const currentStatus = this.textContent === 'ON';
            const newStatus = !currentStatus;
            updateToggleButton(this, newStatus, '30분');
            await updateTrainerOption('30min', newStatus);
            // 실패 시 원래 상태로 복원
            if (document.getElementById('trainerOptionsResult').style.color === '#d32f2f') {
                updateToggleButton(this, currentStatus, '30분');
            }
        };
    }
    
    // 월간보기 토글
    const monthlyViewBtn = document.getElementById('trainerMonthlyViewToggle');
    if (monthlyViewBtn) {
        monthlyViewBtn.onclick = async function() {
            const currentStatus = this.textContent === 'ON';
            const newStatus = !currentStatus;
            updateToggleButton(this, newStatus, '월간보기');
            await updateTrainerOption('monthlyView', newStatus);
            // 실패 시 원래 상태로 복원
            if (document.getElementById('trainerOptionsResult').style.color === '#d32f2f') {
                updateToggleButton(this, currentStatus, '월간보기');
            }
        };
    }

    // 관리자 푸쉬 토글/등록 버튼
    const adminPushToggle = document.getElementById('adminPushToggle');
    if (adminPushToggle) {
        adminPushToggle.onclick = async function() {
            const currentStatus = this.textContent === 'ON';
            const newStatus = !currentStatus;
            updateToggleButton(this, newStatus, '푸쉬');
            try {
                await updateAdminPushSetting(newStatus);
            } catch (error) {
                updateToggleButton(this, currentStatus, '푸쉬');
            }
        };
    }

    const adminPushRegisterBtn = document.getElementById('adminPushRegisterBtn');
    if (adminPushRegisterBtn) {
        adminPushRegisterBtn.onclick = async function() {
            setAdminPushResult('등록 중...', false);
            try {
                await ensureAdminPushSubscription();
                setAdminPushResult('✅ 이 기기가 등록되었습니다.', false);
                setTimeout(() => setAdminPushResult(''), 1500);
            } catch (error) {
                console.error('관리자 푸쉬 구독 등록 오류:', error);
                setAdminPushResult(error.message || '등록 중 오류가 발생했습니다.', true);
            }
        };
    }
});
function closeAccountSettingsModal() {
    document.getElementById('accountSettingsModal').style.display = 'none';
    document.getElementById('accountSettingsModalBg').style.display = 'none';
}
document.getElementById('closeAccountSettingsBtn').onclick = closeAccountSettingsModal;
const closeAccountSettingsBtn2 = document.getElementById('closeAccountSettingsBtn2');
if (closeAccountSettingsBtn2) {
    closeAccountSettingsBtn2.onclick = closeAccountSettingsModal;
}
document.getElementById('accountSettingsModalBg').onclick = function(e) {
    if (e.target === this) {
        closeAccountSettingsModal();
    }
};
document.getElementById('changePwForm').onsubmit = async function(e) {
    e.preventDefault();
    const currentPw = document.getElementById('currentPw').value;
    const newPw = document.getElementById('newPw').value;
    const newPw2 = document.getElementById('newPw2').value;
    if (!currentPw || !newPw || !newPw2) {
        document.getElementById('changePwResult').innerText = '모든 항목을 입력하세요.';
        return;
    }
    if (newPw !== newPw2) {
        document.getElementById('changePwResult').innerText = '새 비밀번호가 일치하지 않습니다.';
        return;
    }
    // 서버에 비밀번호 변경 요청 (API는 추후 구현 필요)
    const username = localStorage.getItem('username');
    const res = await fetch('/api/change-password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, currentPw, newPw })
    });
    const result = await res.json();
    if (res.ok) {
        document.getElementById('changePwResult').style.color = '#2e7d32';
        document.getElementById('changePwResult').innerText = '✅ 비밀번호가 변경되었습니다.';
        setTimeout(() => {
            closeAccountSettingsModal();
        }, 1200);
    } else {
        document.getElementById('changePwResult').style.color = '#d32f2f';
        document.getElementById('changePwResult').innerText = result.message || '비밀번호 변경에 실패했습니다.';
    }
}; 