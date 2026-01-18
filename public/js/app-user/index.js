// 앱 유저 메인 진입점

import { init as initLayout } from './layout.js';
import { init as initDashboard } from './dashboard.js';

let currentUser = null;
let currentScreen = 'home';

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
}

/**
 * 화면 이동
 */
export function navigateToScreen(screen) {
    currentScreen = screen;
    
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
            import('./workout/index.js').then(module => {
                // 트레이너가 회원을 선택한 경우 연결된 회원의 app_user_id 사용
                const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
                const appUserId = connectedMemberAppUserId || currentUser.id;
                module.init(appUserId);
            });
            break;
        case 'diet':
            // 헤더 표시
            const dietHeader = document.querySelector('.app-header');
            if (dietHeader) {
                dietHeader.style.display = 'block';
            }
            // 개발 중 메시지 표시
            const dietContainer = document.getElementById('app-user-content');
            if (dietContainer) {
                dietContainer.innerHTML = `
                    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:400px;padding:40px;text-align:center;">
                        <div style="font-size:64px;margin-bottom:16px;">🍎</div>
                        <h2 style="font-size:24px;font-weight:600;color:var(--app-text);margin:0 0 8px 0;">식단기록</h2>
                        <p style="font-size:16px;color:var(--app-text-muted);margin:0;">개발 중</p>
                    </div>
                `;
            }
            break;
        case 'profile':
            // 향후 구현
            console.log('마이페이지 화면 (준비 중)');
            break;
        default:
            console.warn('알 수 없는 화면:', screen);
    }
}
