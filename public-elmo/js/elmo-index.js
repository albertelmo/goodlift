// Elmo 메인 진입점

import { init as initLayout } from './elmo-layout.js';

let currentUser = null;
let currentScreen = 'home';

/**
 * Elmo 화면 표시 (elmo-main.js에서 호출)
 */
export function showElmoSection(userData) {
    currentUser = userData;
    
    // 로그인 섹션 숨김
    document.getElementById('elmo-login-section').style.display = 'none';
    
    // 메인 섹션 표시
    const mainSection = document.getElementById('elmo-main-section');
    if (mainSection) {
        mainSection.style.display = 'flex';
    }
    
    // 레이아웃 초기화
    initLayout(userData);
    
    // 홈 화면 초기화
    navigateToScreen('home');
}

/**
 * 화면 이동
 */
export function navigateToScreen(screen) {
    currentScreen = screen;
    
    // 화면별 모듈 로드
    switch (screen) {
        case 'home':
            showDevelopmentScreen('홈', '🏠');
            break;
        case 'calendar':
            import('./calendar/index.js').then(async module => {
                await module.init(currentUser?.id);
            }).catch(error => {
                console.error('캘린더 화면 로드 오류:', error);
                alert('캘린더 화면을 불러오는 중 오류가 발생했습니다.');
            });
            break;
        case 'goodlift':
            showDevelopmentScreen('굿리프트', '💪');
            break;
        case 'profile':
            showDevelopmentScreen('내정보', '👤');
            break;
        case 'account-management':
            import('./account-management/index.js').then(async module => {
                await module.init(currentUser);
            }).catch(error => {
                console.error('계정관리 화면 로드 오류:', error);
                alert('계정관리 화면을 불러오는 중 오류가 발생했습니다.');
            });
            break;
        default:
            console.warn('알 수 없는 화면:', screen);
    }
}

/**
 * 개발 중 화면 표시
 */
function showDevelopmentScreen(title, icon) {
    const container = document.getElementById('elmo-content');
    if (container) {
        container.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:400px;padding:40px;text-align:center;">
                <div style="font-size:64px;margin-bottom:16px;">${icon}</div>
                <h2 style="font-size:24px;font-weight:600;color:var(--elmo-text);margin:0 0 8px 0;">${title}</h2>
                <p style="font-size:16px;color:var(--elmo-text-muted);margin:0;">개발중</p>
            </div>
        `;
    }
}
