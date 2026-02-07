// 앱 유저 메인 진입점

import { init as initLayout } from './layout.js';
import { init as initDashboard } from './dashboard.js';
import { escapeHtml } from './utils.js';
import { updateAppUser, get, postAppUserPing, getUserSettings, updateUserSettings, getPushVapidPublicKey, getPushStatus, subscribePush, unsubscribePush, sendPushTest } from './api.js';

let currentUser = null;
let currentScreen = 'home';
let lastPingAt = 0;
const APP_USER_PING_INTERVAL = 5 * 60 * 1000;

// currentUser를 export하여 다른 모듈에서 사용할 수 있도록 함
export function getCurrentUser() {
    return currentUser;
}

/**
 * 앱 유저 화면 표시 (main.js에서 호출)
 */
export function showAppUserSection(appUserData) {
    currentUser = appUserData;
    
    // 인증 섹션 숨김
    document.getElementById('authSection').style.display = 'none';
    
    // 기존 메인 섹션 숨김
    document.getElementById('mainSection').style.display = 'none';
    
    // 기존 상단바 숨김 (로고/로그아웃 버튼이 있는 헤더)
    const oldHeader = document.getElementById('old-header');
    if (oldHeader) {
        oldHeader.style.display = 'none';
    }
    
    // 앱 유저 섹션 표시
    const appUserSection = document.getElementById('app-user-section');
    if (appUserSection) {
        appUserSection.style.display = 'block';
        // body에 클래스 추가하여 스타일 오버라이드
        document.body.classList.add('app-user-active');
    }
    
    // secretBtn 숨김 (앱 유저는 관리자 기능 없음)
    const secretBtn = document.getElementById('secretBtn');
    if (secretBtn) {
        secretBtn.style.display = 'none';
    }
    
    // 트레이너 전환 버튼 숨김 (앱 유저는 트레이너 전환 불가)
    const switchToAppUserBtn = document.getElementById('switchToAppUserBtn');
    if (switchToAppUserBtn) {
        switchToAppUserBtn.style.display = 'none';
    }
    
    // 로그아웃/설정 버튼 숨김 (앱 유저는 자체 헤더 사용)
    const logoutBtn = document.getElementById('logoutBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (settingsBtn) settingsBtn.style.display = 'none';
    
    // 레이아웃 초기화
    initLayout(appUserData);
    
    // 홈 화면 초기화
    initDashboard(appUserData);
    
    // 접속 핑 (활성 통계용)
    scheduleAppUserPing(true);
}

/**
 * 앱 유저 접속 핑 (주기 제한)
 */
function scheduleAppUserPing(force = false) {
    if (!currentUser?.id) return;
    const now = Date.now();
    if (!force && now - lastPingAt < APP_USER_PING_INTERVAL) {
        return;
    }
    lastPingAt = now;
    postAppUserPing(currentUser.id).catch(error => {
        console.error('[AppUser Ping] 오류:', error);
    });
}

// 화면 포커스/가시성 변화 시 핑
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        scheduleAppUserPing();
    }
});
window.addEventListener('focus', () => {
    scheduleAppUserPing();
});

/**
 * 화면 이동
 */
export function navigateToScreen(screen) {
    // 다른 화면으로 이동할 때 남아있는 오버레이 모달 제거
    document.querySelectorAll('.app-modal-bg, .modal-bg, .app-achievement-modal, .app-guide-modal').forEach(el => {
        try {
            el.remove();
        } catch (e) {
            // ignore
        }
    });

    currentScreen = screen;
    const achievementBtn = document.getElementById('app-achievement-btn');
    if (achievementBtn) {
        const isTrainer = currentUser?.isTrainer === true || currentUser?.is_trainer === true;
        achievementBtn.style.display = screen === 'home' && !isTrainer ? 'inline-flex' : 'none';
    }
    
    // 화면별 모듈 로드
    switch (screen) {
        case 'home':
            import('./dashboard.js').then(module => {
                module.init(currentUser);
            });
            break;
        case 'workout':
            // 헤더 숨기기
            const header = document.querySelector('.app-header');
            if (header) {
                header.style.display = 'none';
            }
            import('./workout/index.js').then(async module => {
                // 회원이 트레이너를 보는 경우 (읽기 전용)
                const viewingTrainerAppUserId = localStorage.getItem('viewingTrainerAppUserId');
                if (viewingTrainerAppUserId) {
                    await module.init(viewingTrainerAppUserId, true); // readOnly = true
                    return;
                }
                // 트레이너가 회원을 선택한 경우 연결된 회원의 app_user_id 사용
                const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
                const appUserId = connectedMemberAppUserId || currentUser?.id;
                
                if (!appUserId) {
                    console.error('운동기록 화면 로드 오류: app_user_id가 없습니다.');
                    alert('사용자 정보를 불러올 수 없습니다. 다시 로그인해주세요.');
                    return;
                }
                
                await module.init(appUserId, false); // readOnly = false
            }).catch(error => {
                console.error('운동기록 화면 로드 오류:', error);
                alert('운동기록 화면을 불러오는 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
            });
            break;
        case 'diet':
            // 헤더 숨기기
            const dietHeader = document.querySelector('.app-header');
            if (dietHeader) {
                dietHeader.style.display = 'none';
            }
            import('./diet/index.js').then(async module => {
                // 회원이 트레이너를 보는 경우 (읽기 전용)
                const viewingTrainerAppUserId = localStorage.getItem('viewingTrainerAppUserId');
                if (viewingTrainerAppUserId) {
                    await module.init(viewingTrainerAppUserId, true); // readOnly = true
                    return;
                }
                // 트레이너가 회원을 선택한 경우 연결된 회원의 app_user_id 사용
                const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
                const appUserId = connectedMemberAppUserId || currentUser?.id;
                
                if (!appUserId) {
                    console.error('식단기록 화면 로드 오류: app_user_id가 없습니다.');
                    alert('사용자 정보를 불러올 수 없습니다. 다시 로그인해주세요.');
                    return;
                }
                
                await module.init(appUserId, false); // readOnly = false
            }).catch(error => {
                console.error('식단기록 화면 로드 오류:', error);
                alert('식단기록 화면을 불러오는 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
            });
            break;
        case 'settings':
            // 헤더 표시
            const settingsHeader = document.querySelector('.app-header');
            if (settingsHeader) {
                settingsHeader.style.display = 'block';
            }
            // 개발 중 메시지 표시
            const settingsContainer = document.getElementById('app-user-content');
            if (settingsContainer) {
                settingsContainer.innerHTML = `
                    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:400px;padding:40px;text-align:center;">
                        <div style="font-size:64px;margin-bottom:16px;">⚙️</div>
                        <h2 style="font-size:24px;font-weight:600;color:var(--app-text);margin:0 0 8px 0;">설정</h2>
                        <p style="font-size:16px;color:var(--app-text-muted);margin:0;">개발 중</p>
                    </div>
                `;
            }
            break;
        case 'profile':
            // 헤더는 기본적으로 표시되므로 명시적으로 설정하지 않음 (홈과 동일)
            // 내정보 화면 표시
            const profileContainer = document.getElementById('app-user-content');
            if (profileContainer && currentUser) {
                const userName = currentUser.name || '이름 없음';
                const userPhone = currentUser.phone || '전화번호 없음';
                const memberName = currentUser.member_name || null;
                const username = currentUser.username || '';
                
                // 화면을 먼저 렌더링 (성능 최적화: API 호출 전에 화면 표시)
                profileContainer.innerHTML = `
                    <div class="app-profile-screen" style="padding: 20px;">
                        
                        <form id="profile-form" style="margin-bottom: 16px;">
                            <div class="app-profile-info" style="background: var(--app-surface); border-radius: var(--app-radius); padding: 20px; margin-bottom: 16px;">
                                <div class="app-profile-info-item" style="padding: 12px 0; border-bottom: 1px solid var(--app-border);">
                                    <div style="font-size: 12px; color: var(--app-text-muted); margin-bottom: 4px;">아이디</div>
                                    <div style="font-size: 16px; color: var(--app-text); font-weight: 500;">${escapeHtml(username)}</div>
                                </div>
                                <div class="app-profile-info-item" style="padding: 12px 0; border-bottom: 1px solid var(--app-border);">
                                    <div style="display: flex; align-items: flex-end; gap: 8px;">
                                        <div style="flex: 1;">
                                            <label style="display: block; font-size: 12px; color: var(--app-text-muted); margin-bottom: 8px;">전화번호</label>
                                            <input type="tel" id="profile-phone" value="${escapeHtml(userPhone)}" style="width: 100%; padding: 10px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); background: var(--app-surface); color: var(--app-text); font-size: 16px; font-weight: 500; box-sizing: border-box;">
                                        </div>
                                        <button type="button" id="profile-phone-save-btn" class="app-btn-primary" style="padding: 10px 16px; border-radius: var(--app-radius-sm); border: none; font-weight: 600; cursor: pointer; white-space: nowrap;">
                                            변경
                                        </button>
                                    </div>
                                </div>
                                <div class="app-profile-info-item" id="profile-trainer-item" style="display: none; padding: 12px 0; border-bottom: 1px solid var(--app-border);">
                                    <div style="font-size: 12px; color: var(--app-text-muted); margin-bottom: 4px;">담당 트레이너</div>
                                    <div style="font-size: 16px; color: var(--app-text); font-weight: 500;" id="profile-trainer-name"></div>
                                </div>
                                ${currentUser.created_at ? `
                                <div class="app-profile-info-item" style="padding: 12px 0; border-bottom: 1px solid var(--app-border);">
                                    <label style="display: block; font-size: 12px; color: var(--app-text-muted); margin-bottom: 8px;">가입일</label>
                                    <input type="text" value="${new Date(currentUser.created_at).toLocaleDateString('ko-KR')}" disabled style="width: 100%; padding: 10px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); background: var(--app-bg); color: var(--app-text-muted); font-size: 16px; font-weight: 500; box-sizing: border-box;">
                                </div>
                                ` : ''}
                                <div class="app-profile-info-item" style="padding: 12px 0;">
                                    <div style="font-size: 12px; color: var(--app-text-muted); margin-bottom: 4px;">버전</div>
                                    <div style="font-size: 14px; color: var(--app-text-muted); font-family: monospace;" id="app-version-display">불러오는 중...</div>
                                </div>
                            </div>

                                <div class="app-profile-info" style="background: var(--app-surface); border-radius: var(--app-radius); padding: 20px; margin-bottom: 16px;">
                                <div class="app-profile-info-item" style="padding: 12px 0; border-bottom: 1px solid var(--app-border);">
                                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                                        <div style="font-size: 12px; color: var(--app-text-muted);">운동 가이드</div>
                                        <button type="button" id="workout-guide-toggle" class="app-toggle-btn">
                                            <span class="app-toggle-text">OFF</span>
                                            <span class="app-toggle-knob"></span>
                                        </button>
                                    </div>
                                </div>
                                <div class="app-profile-info-item" style="padding: 12px 0;">
                                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                                        <div style="font-size: 12px; color: var(--app-text-muted);">알림 받기</div>
                                        <button type="button" id="push-notification-toggle" class="app-toggle-btn">
                                            <span class="app-toggle-text">OFF</span>
                                            <span class="app-toggle-knob"></span>
                                        </button>
                                    </div>
                                    <div id="push-notification-status" style="font-size: 11px; color: var(--app-text-muted); margin-top: 6px; display: none;"></div>
                                </div>
                            </div>
                            
                            <div class="app-profile-password" style="background: var(--app-surface); border-radius: var(--app-radius); padding: 20px; margin-bottom: 16px;">
                                <h3 style="font-size: 16px; font-weight: 600; color: var(--app-text); margin: 0 0 16px;">비밀번호 변경</h3>
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; font-size: 12px; color: var(--app-text-muted); margin-bottom: 8px;">기존 비밀번호</label>
                                    <input type="password" id="profile-current-password" placeholder="기존 비밀번호를 입력하세요" style="width: 100%; padding: 10px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); background: var(--app-surface); color: var(--app-text); font-size: 16px; box-sizing: border-box;">
                                </div>
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; font-size: 12px; color: var(--app-text-muted); margin-bottom: 8px;">새 비밀번호</label>
                                    <input type="password" id="profile-password" placeholder="새 비밀번호를 입력하세요" style="width: 100%; padding: 10px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); background: var(--app-surface); color: var(--app-text); font-size: 16px; box-sizing: border-box;">
                                </div>
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; font-size: 12px; color: var(--app-text-muted); margin-bottom: 8px;">새 비밀번호 확인</label>
                                    <input type="password" id="profile-password-confirm" placeholder="새 비밀번호를 다시 입력하세요" style="width: 100%; padding: 10px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); background: var(--app-surface); color: var(--app-text); font-size: 16px; box-sizing: border-box;">
                                </div>
                                <button type="button" id="profile-password-save-btn" class="app-btn-primary" style="width: 100%; padding: 12px; border-radius: var(--app-radius-sm); border: none; font-weight: 600; cursor: pointer;">
                                    비밀번호 변경
                                </button>
                            </div>
                        </form>
                    </div>
                `;
                
                // 전화번호 저장 버튼 클릭 이벤트
                const phoneSaveBtn = profileContainer.querySelector('#profile-phone-save-btn');
                if (phoneSaveBtn) {
                    phoneSaveBtn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        
                        const phoneInput = profileContainer.querySelector('#profile-phone');
                        const phone = phoneInput.value.trim();
                        
                        if (phone === userPhone) {
                            alert('변경할 전화번호가 없습니다.');
                            return;
                        }
                        
                        // 전화번호 유효성 검사
                        if (!phone) {
                            alert('전화번호를 입력해주세요.');
                            phoneInput.focus();
                            return;
                        }
                        
                        // 숫자만 추출
                        const phoneDigits = phone.replace(/[^0-9]/g, '');
                        
                        // 10자리 또는 11자리 숫자인지 확인
                        if (phoneDigits.length < 10 || phoneDigits.length > 11) {
                            alert('전화번호는 10자리 또는 11자리 숫자여야 합니다.');
                            phoneInput.focus();
                            return;
                        }
                        
                        // 010으로 시작하는 경우 11자리 확인
                        if (phoneDigits.startsWith('010') || phoneDigits.startsWith('011') || phoneDigits.startsWith('016') || 
                            phoneDigits.startsWith('017') || phoneDigits.startsWith('018') || phoneDigits.startsWith('019')) {
                            if (phoneDigits.length !== 11) {
                                alert('모바일 번호는 11자리 숫자여야 합니다. 예: 010-1234-5678');
                                phoneInput.focus();
                                return;
                            }
                        }
                        
                        try {
                            // 저장 버튼 비활성화
                            phoneSaveBtn.disabled = true;
                            const originalText = phoneSaveBtn.textContent;
                            phoneSaveBtn.textContent = '변경 중...';
                            
                            await updateAppUser(currentUser.id, { phone });
                            
                            // 성공 메시지
                            alert('전화번호가 성공적으로 업데이트되었습니다.');
                            
                            // currentUser 업데이트
                            currentUser.phone = phone;
                            
                            // 저장 버튼 활성화
                            phoneSaveBtn.disabled = false;
                            phoneSaveBtn.textContent = originalText;
                        } catch (error) {
                            console.error('전화번호 업데이트 오류:', error);
                            alert(error.message || '전화번호 업데이트 중 오류가 발생했습니다.');
                            
                            // 저장 버튼 활성화
                            phoneSaveBtn.disabled = false;
                            phoneSaveBtn.textContent = '변경';
                        }
                    });
                }
                
                // 운동 가이드 토글 로드
                (async () => {
                    const toggleBtn = profileContainer.querySelector('#workout-guide-toggle');
                    if (!toggleBtn) return;

                    const toggleText = toggleBtn.querySelector('.app-toggle-text');
                    const setToggleState = (enabled) => {
                        toggleBtn.dataset.enabled = enabled ? 'true' : 'false';
                        toggleBtn.classList.toggle('is-on', enabled);
                        if (toggleText) {
                            toggleText.textContent = enabled ? 'ON' : 'OFF';
                        }
                    };

                    // 초기 상태를 먼저 세팅하고 클릭 이벤트를 바로 연결
                    const initialEnabled = toggleBtn.dataset.enabled === 'true' || toggleBtn.classList.contains('is-on');
                    setToggleState(initialEnabled);

                    toggleBtn.addEventListener('click', async () => {
                        const nextEnabled = toggleBtn.dataset.enabled !== 'true';
                        setToggleState(nextEnabled);
                        await updateUserSettings(currentUser.id, { workout_guide_enabled: nextEnabled });
                    });
                    toggleBtn.addEventListener('touchstart', async (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const nextEnabled = toggleBtn.dataset.enabled !== 'true';
                        setToggleState(nextEnabled);
                        await updateUserSettings(currentUser.id, { workout_guide_enabled: nextEnabled });
                    }, { passive: false });

                    try {
                        const settings = await getUserSettings(currentUser.id);
                        const enabled = settings?.workout_guide_enabled === true ? true : false;
                        setToggleState(enabled);
                    } catch (error) {
                        console.error('운동 가이드 설정 로드 오류:', error);
                    }
                })();

                // 푸시 알림 토글 로드
                (async () => {
                    const pushToggleBtn = profileContainer.querySelector('#push-notification-toggle');
                    const statusEl = profileContainer.querySelector('#push-notification-status');
                    if (!pushToggleBtn || !statusEl) return;

                    const toggleText = pushToggleBtn.querySelector('.app-toggle-text');
                    const setToggleState = (enabled) => {
                        pushToggleBtn.dataset.enabled = enabled ? 'true' : 'false';
                        pushToggleBtn.classList.toggle('is-on', enabled);
                        if (toggleText) {
                            toggleText.textContent = enabled ? 'ON' : 'OFF';
                        }
                    };

                    const showStatus = (message, isError = false) => {
                        statusEl.textContent = message || '';
                        statusEl.style.display = message ? 'block' : 'none';
                        statusEl.style.color = isError ? '#d32f2f' : 'var(--app-text-muted)';
                    };

                    const isPushSupported = () => (
                        'serviceWorker' in navigator &&
                        'PushManager' in window &&
                        'Notification' in window
                    );
                    const isIOS = () => /iP(ad|hone|od)/.test(navigator.userAgent);
                    const isStandalone = () => (
                        window.matchMedia && window.matchMedia('(display-mode: standalone)').matches
                    ) || window.navigator.standalone === true;

                    const urlBase64ToUint8Array = (base64String) => {
                        const padding = '='.repeat((4 - base64String.length % 4) % 4);
                        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
                        const rawData = window.atob(base64);
                        const outputArray = new Uint8Array(rawData.length);
                        for (let i = 0; i < rawData.length; ++i) {
                            outputArray[i] = rawData.charCodeAt(i);
                        }
                        return outputArray;
                    };

                    const getRegistration = async () => {
                        if (!isPushSupported()) return null;
                        const existing = await navigator.serviceWorker.getRegistration('/');
                        return existing || navigator.serviceWorker.register('/sw.js');
                    };

                    if (!isPushSupported()) {
                        setToggleState(false);
                        pushToggleBtn.disabled = true;
                        if (isIOS() && !isStandalone()) {
                            showStatus('아이폰은 홈 화면에 추가한 뒤 푸시 알림을 사용할 수 있습니다.');
                        } else if (isIOS()) {
                            showStatus('아이폰은 iOS 16.4 이상에서만 푸시 알림을 지원합니다.');
                        } else {
                            showStatus('이 기기에서는 푸시 알림을 지원하지 않습니다.');
                        }
                        return;
                    }

                    try {
                        const status = await getPushStatus(currentUser.id);
                        setToggleState(status?.enabled === true);
                    } catch (error) {
                        console.error('푸시 상태 조회 오류:', error);
                    }

                    pushToggleBtn.addEventListener('click', async () => {
                        const nextEnabled = pushToggleBtn.dataset.enabled !== 'true';
                        showStatus('');

                        if (nextEnabled) {
                            if (Notification.permission === 'denied') {
                                setToggleState(false);
                                showStatus('알림 권한이 차단되어 있습니다. 설정에서 허용해주세요.', true);
                                return;
                            }

                            if (Notification.permission !== 'granted') {
                                const permission = await Notification.requestPermission();
                                if (permission !== 'granted') {
                                    setToggleState(false);
                                    showStatus('알림 권한이 허용되지 않았습니다.', true);
                                    return;
                                }
                            }

                            try {
                                const registration = await getRegistration();
                                if (!registration) {
                                    setToggleState(false);
                                    showStatus('서비스 워커 등록에 실패했습니다.', true);
                                    return;
                                }

                                let subscription = await registration.pushManager.getSubscription();
                                if (!subscription) {
                                    const { publicKey } = await getPushVapidPublicKey();
                                    if (!publicKey) {
                                        setToggleState(false);
                                        showStatus('푸시 키를 불러오지 못했습니다.', true);
                                        return;
                                    }
                                    subscription = await registration.pushManager.subscribe({
                                        userVisibleOnly: true,
                                        applicationServerKey: urlBase64ToUint8Array(publicKey)
                                    });
                                }

                                await subscribePush(currentUser.id, subscription, {
                                    userAgent: navigator.userAgent,
                                    platform: navigator.platform
                                });

                                setToggleState(true);
                                showStatus('알림 받기가 활성화되었습니다.');

                                try {
                                    await sendPushTest(currentUser.id);
                                } catch (error) {
                                    console.error('푸시 테스트 전송 오류:', error);
                                }
                            } catch (error) {
                                console.error('푸시 구독 오류:', error);
                                setToggleState(false);
                                showStatus(error.message || '푸시 구독 중 오류가 발생했습니다.', true);
                            }
                            return;
                        }

                        try {
                            const registration = await getRegistration();
                            const subscription = registration
                                ? await registration.pushManager.getSubscription()
                                : null;

                            if (subscription) {
                                await unsubscribePush(currentUser.id, subscription.endpoint);
                                await subscription.unsubscribe();
                            } else {
                                await unsubscribePush(currentUser.id);
                            }

                            setToggleState(false);
                            showStatus('알림 받기가 해제되었습니다.');
                        } catch (error) {
                            console.error('푸시 해제 오류:', error);
                            showStatus(error.message || '푸시 해제 중 오류가 발생했습니다.', true);
                        }
                    });
                })();
                
                // 비밀번호 변경 버튼 클릭 이벤트
                const passwordSaveBtn = profileContainer.querySelector('#profile-password-save-btn');
                if (passwordSaveBtn) {
                    passwordSaveBtn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        
                        const currentPasswordInput = profileContainer.querySelector('#profile-current-password');
                        const passwordInput = profileContainer.querySelector('#profile-password');
                        const passwordConfirmInput = profileContainer.querySelector('#profile-password-confirm');
                        
                        const currentPassword = currentPasswordInput.value;
                        const password = passwordInput.value;
                        const passwordConfirm = passwordConfirmInput.value;
                        
                        if (!currentPassword) {
                            alert('기존 비밀번호를 입력해주세요.');
                            currentPasswordInput.focus();
                            return;
                        }
                        
                        if (!password) {
                            alert('새 비밀번호를 입력해주세요.');
                            passwordInput.focus();
                            return;
                        }
                        
                        // 비밀번호 확인
                        if (password !== passwordConfirm) {
                            alert('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
                            passwordConfirmInput.focus();
                            return;
                        }
                        
                        // 비밀번호 길이 확인
                        if (password.length < 4) {
                            alert('비밀번호는 최소 4자 이상이어야 합니다.');
                            passwordInput.focus();
                            return;
                        }
                        
                        try {
                            // 저장 버튼 비활성화
                            passwordSaveBtn.disabled = true;
                            const originalText = passwordSaveBtn.textContent;
                            passwordSaveBtn.textContent = '변경 중...';
                            
                            await updateAppUser(currentUser.id, { password, currentPassword });
                            
                            // 성공 메시지
                            alert('비밀번호가 성공적으로 변경되었습니다.');
                            
                            // 비밀번호 필드 초기화
                            currentPasswordInput.value = '';
                            passwordInput.value = '';
                            passwordConfirmInput.value = '';
                            
                            // 저장 버튼 활성화
                            passwordSaveBtn.disabled = false;
                            passwordSaveBtn.textContent = originalText;
                        } catch (error) {
                            console.error('비밀번호 변경 오류:', error);
                            alert(error.message || '비밀번호 변경 중 오류가 발생했습니다.');
                            
                            // 저장 버튼 활성화
                            passwordSaveBtn.disabled = false;
                            passwordSaveBtn.textContent = '비밀번호 변경';
                        }
                    });
                }
                
                // 회원 정보 및 트레이너 정보 가져오기 (백그라운드에서 처리 - 성능 최적화)
                if (memberName) {
                    (async () => {
                        try {
                            // 특정 회원만 조회 (성능 최적화)
                            const members = await get(`/members?name=${encodeURIComponent(memberName)}`);
                            const member = members.length > 0 ? members[0] : null;
                            if (member && member.trainer) {
                                // 특정 트레이너만 조회 (성능 최적화)
                                const trainers = await get(`/trainers?username=${encodeURIComponent(member.trainer)}`);
                                const trainer = trainers.length > 0 ? trainers[0] : null;
                                if (trainer) {
                                    // 트레이너 정보 표시
                                    const trainerItem = profileContainer.querySelector('#profile-trainer-item');
                                    const trainerNameEl = profileContainer.querySelector('#profile-trainer-name');
                                    if (trainerItem && trainerNameEl) {
                                        trainerNameEl.textContent = trainer.name;
                                        trainerItem.style.display = 'block';
                                    }
                                }
                            }
                        } catch (error) {
                            console.error('회원/트레이너 정보 조회 오류:', error);
                        }
                    })();
                }
                
                // PWA 버전 정보 가져오기
                (async () => {
                    try {
                        const response = await fetch('/api/pwa/version');
                        const data = await response.json();
                        const versionEl = profileContainer.querySelector('#app-version-display');
                        if (versionEl && data.version) {
                            versionEl.textContent = data.version;
                        }
                    } catch (error) {
                        console.error('버전 정보 조회 오류:', error);
                        const versionEl = profileContainer.querySelector('#app-version-display');
                        if (versionEl) {
                            versionEl.textContent = '알 수 없음';
                        }
                    }
                })();
            }
            break;
        default:
            console.warn('알 수 없는 화면:', screen);
    }
}
