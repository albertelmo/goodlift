// Elmo 서비스 메인 JavaScript

// 이벤트 위임을 사용한 회원가입 버튼 핸들러 (가장 확실한 방법)
function setupRegisterButtonWithDelegation() {
    // document에 이벤트 위임 (버튼이 언제 나타나든 작동)
    document.addEventListener('click', function(e) {
        // 회원가입 버튼 클릭 확인
        if (e.target && e.target.id === 'elmo-register-btn') {
            e.preventDefault();
            e.stopPropagation();
            
            const modal = document.getElementById('elmo-register-modal');
            if (modal) {
                modal.style.display = 'flex';
                const form = document.getElementById('elmo-register-form');
                const resultDiv = document.getElementById('elmo-register-result');
                if (form) form.reset();
                if (resultDiv) {
                    resultDiv.textContent = '';
                    resultDiv.className = 'elmo-result';
                }
            }
        }
    });
}

// 로그인 상태 확인 (기존 서비스와 동일한 방식)
function checkElmoLoginStatus() {
    const elmoSession = localStorage.getItem('elmo_session');
    const elmoUser = localStorage.getItem('elmo_user');
    
    if (elmoSession && elmoUser) {
        showElmoMainSection();
    } else {
        showElmoLoginSection();
    }
}

// 로그인 화면 표시
function showElmoLoginSection() {
    const loginSection = document.getElementById('elmo-login-section');
    const mainSection = document.getElementById('elmo-main-section');
    
    if (loginSection) {
        loginSection.style.display = 'flex';
    }
    if (mainSection) {
        mainSection.style.display = 'none';
    }
    
    // 로그인 섹션이 표시된 후 이벤트 리스너 설정
    // DOM이 완전히 렌더링될 때까지 충분한 시간 대기
    setTimeout(() => {
        setupEventListeners();
    }, 100);
    
    // localStorage는 삭제하지 않음 (로그아웃 시에만 삭제)
    // showElmoLoginSection은 초기화 시에도 호출되므로 여기서 삭제하면 안됨
}

// 메인 화면 표시
function showElmoMainSection() {
    const loginSection = document.getElementById('elmo-login-section');
    const mainSection = document.getElementById('elmo-main-section');
    
    if (!loginSection || !mainSection) {
        // DOM이 아직 준비되지 않았으면 잠시 후 다시 시도
        setTimeout(showElmoMainSection, 100);
        return;
    }
    
    loginSection.style.display = 'none';
    mainSection.style.display = 'flex';
    
    const elmoUser = localStorage.getItem('elmo_user');
    if (elmoUser) {
        try {
            const user = JSON.parse(elmoUser);
            // Elmo 섹션 표시
            import('./elmo-index.js').then(module => {
                module.showElmoSection(user);
            }).catch(error => {
                console.error('[Elmo] 모듈 로드 오류:', error);
                // 모듈 로드 실패 시 재시도
                setTimeout(() => {
                    import('./elmo-index.js').then(module => {
                        module.showElmoSection(user);
                    });
                }, 500);
            });
        } catch (e) {
            console.error('[Elmo] 사용자 정보 파싱 오류:', e);
            // 파싱 오류 시 localStorage 정리
            localStorage.removeItem('elmo_session');
            localStorage.removeItem('elmo_user');
            showElmoLoginSection();
        }
    } else {
        // 사용자 정보가 없으면 로그인 화면으로
        showElmoLoginSection();
    }
}

// 회원가입 모달 닫기 함수
function closeElmoRegisterModal() {
    const modal = document.getElementById('elmo-register-modal');
    const form = document.getElementById('elmo-register-form');
    const resultDiv = document.getElementById('elmo-register-result');
    if (modal) modal.style.display = 'none';
    if (form) form.reset();
    if (resultDiv) {
        resultDiv.textContent = '';
        resultDiv.className = 'elmo-result';
    }
}

// 회원가입 기능 초기화 (새로 작성)
function initRegisterFeature() {
    // 회원가입 버튼 클릭 (form 밖으로 이동했으므로 간단하게 처리)
    const registerBtn = document.getElementById('elmo-register-btn');
    
    if (registerBtn) {
        // 직접 이벤트 리스너 추가 (이벤트 위임과 함께 사용)
        if (!registerBtn.hasAttribute('data-listener-attached')) {
            registerBtn.setAttribute('data-listener-attached', 'true');
            registerBtn.addEventListener('click', handleRegisterButtonClick);
        }
    }
    
    // 회원가입 모달 관련 이벤트 리스너 설정
    setupRegisterModalListeners();
}

// 회원가입 버튼 클릭 핸들러 (별도 함수로 분리)
function handleRegisterButtonClick(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const modal = document.getElementById('elmo-register-modal');
    if (modal) {
        modal.style.display = 'flex';
        const form = document.getElementById('elmo-register-form');
        const resultDiv = document.getElementById('elmo-register-result');
        if (form) form.reset();
        if (resultDiv) {
            resultDiv.textContent = '';
            resultDiv.className = 'elmo-result';
        }
    }
}

// 회원가입 모달 관련 이벤트 리스너 설정
function setupRegisterModalListeners() {
    // 회원가입 모달 닫기 버튼들
    const registerClose = document.getElementById('elmo-register-close');
    if (registerClose) {
        registerClose.addEventListener('click', function(e) {
            e.preventDefault();
            closeElmoRegisterModal();
        });
    }
    
    const registerCancel = document.getElementById('elmo-register-cancel');
    if (registerCancel) {
        registerCancel.addEventListener('click', function(e) {
            e.preventDefault();
            closeElmoRegisterModal();
        });
    }
    
    // 모달 배경 클릭 시 닫기
    const registerModal = document.getElementById('elmo-register-modal');
    if (registerModal) {
        registerModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeElmoRegisterModal();
            }
        });
    }
    
    // 회원가입 폼 제출
    const registerForm = document.getElementById('elmo-register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('elmo-register-username').value.trim();
            const password = document.getElementById('elmo-register-password').value;
            const name = document.getElementById('elmo-register-name').value.trim();
            const email = document.getElementById('elmo-register-email').value.trim();
            const resultDiv = document.getElementById('elmo-register-result');
            
            if (!username || !password || !name) {
                resultDiv.className = 'elmo-result error';
                resultDiv.textContent = '필수 항목을 모두 입력해주세요.';
                return;
            }
            
            resultDiv.className = 'elmo-result';
            resultDiv.textContent = '가입 중...';
            
            try {
                const res = await fetch('/api/elmo/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        username, 
                        password, 
                        name, 
                        email: email || null 
                    })
                });
                
                const result = await res.json();
                
                if (res.ok) {
                    resultDiv.className = 'elmo-result success';
                    resultDiv.textContent = result.message || '회원가입이 완료되었습니다!';
                    
                    setTimeout(() => {
                        closeElmoRegisterModal();
                        const usernameInput = document.getElementById('elmo-username');
                        const passwordInput = document.getElementById('elmo-password');
                        if (usernameInput) usernameInput.value = username;
                        if (passwordInput) passwordInput.focus();
                    }, 1500);
                } else {
                    resultDiv.className = 'elmo-result error';
                    resultDiv.textContent = result.message || '회원가입에 실패했습니다.';
                }
            } catch (error) {
                console.error('회원가입 오류:', error);
                resultDiv.className = 'elmo-result error';
                resultDiv.textContent = '회원가입 중 오류가 발생했습니다.';
            }
        });
    }
}

// 이벤트 리스너 설정 함수
function setupEventListeners() {
    // 로그인 폼 제출
    const loginForm = document.getElementById('elmo-login-form');
    if (loginForm) {
        // 기존 리스너 제거 후 재등록 방지
        if (!loginForm.hasAttribute('data-listener-attached')) {
            loginForm.setAttribute('data-listener-attached', 'true');
            loginForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const username = document.getElementById('elmo-username').value;
                const password = document.getElementById('elmo-password').value;
                const resultDiv = document.getElementById('elmo-login-result');
                
                resultDiv.className = 'elmo-result';
                resultDiv.textContent = '로그인 중...';
                
                try {
                    const res = await fetch('/api/elmo/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ username, password })
                    });
                    
                    const result = await res.json();
                    
                    if (res.ok) {
                        // 로그인 성공
                        const sessionId = result.sessionId || 'elmo_' + Date.now();
                        const userData = {
                            ...(result.user || { username, name: username }),
                            role: result.user?.role || 'user'  // role 포함
                        };
                        
                        // localStorage에 저장
                        try {
                            localStorage.setItem('elmo_session', sessionId);
                            localStorage.setItem('elmo_user', JSON.stringify(userData));
                            
                            // 저장 확인
                            const savedSession = localStorage.getItem('elmo_session');
                            const savedUser = localStorage.getItem('elmo_user');
                            
                            if (!savedSession || !savedUser) {
                                throw new Error('localStorage 저장 실패');
                            }
                        } catch (e) {
                            resultDiv.className = 'elmo-result error';
                            resultDiv.textContent = '로그인 정보 저장에 실패했습니다. 브라우저 설정을 확인해주세요.';
                            return;
                        }
                        
                        resultDiv.className = 'elmo-result success';
                        resultDiv.textContent = '로그인 성공!';
                        
                        setTimeout(() => {
                            showElmoMainSection();
                        }, 500);
                    } else {
                        // 로그인 실패
                        resultDiv.className = 'elmo-result error';
                        resultDiv.textContent = result.message || '로그인에 실패했습니다.';
                    }
                } catch (error) {
                    console.error('로그인 오류:', error);
                    resultDiv.className = 'elmo-result error';
                    resultDiv.textContent = '로그인 중 오류가 발생했습니다.';
                }
            });
        }
    }
    
    // 회원가입 기능 초기화 (새로 작성)
    initRegisterFeature();
}

// 초기화 함수 (기존 서비스와 동일한 방식)
function initializeElmo() {
    // 이벤트 위임으로 회원가입 버튼 설정 (가장 먼저 실행)
    setupRegisterButtonWithDelegation();
    
    const elmoSession = localStorage.getItem('elmo_session');
    const elmoUser = localStorage.getItem('elmo_user');
    
    if (elmoSession && elmoUser) {
        // 로그인 상태가 있으면 메인 화면으로 전환
        showElmoMainSection();
    } else {
        // 로그인 상태가 없으면 로그인 화면 표시
        // showElmoLoginSection 내부에서 setupEventListeners 호출
        showElmoLoginSection();
    }
    
    // Service Worker 등록
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/elmo/sw.js')
            .catch(error => {
                console.error('[Elmo SW] 등록 실패:', error);
            });
    }
}

// 즉시 이벤트 위임 설정 (스크립트 로드 즉시 실행)
setupRegisterButtonWithDelegation();

// DOMContentLoaded에서 초기화 (기존 서비스와 동일한 방식)
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initializeElmo);
} else {
    // DOM이 이미 로드된 경우
    initializeElmo();
}
