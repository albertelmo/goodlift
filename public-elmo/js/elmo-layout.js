// Elmo 레이아웃 관리 (헤더, 햄버거 메뉴, 하단 네비게이션)

let currentUser = null;
let currentScreen = 'home';
let hamburgerMenuOpen = false;

const screens = {
    home: { label: '홈', icon: '🏠', id: 'home' },
    calendar: { label: '캘린더', icon: '📅', id: 'calendar' },
    goodlift: { label: '굿리프트', icon: '💪', id: 'goodlift' },
    profile: { label: '내정보', icon: '👤', id: 'profile' },
    'account-management': { label: '계정관리', icon: '⚙️', id: 'account-management' }
};

/**
 * 레이아웃 초기화
 */
export function init(userData) {
    currentUser = userData;
    updateUserInfo();
    setupEventListeners();
    updateActiveScreen();
}

/**
 * 사용자 정보 업데이트
 */
function updateUserInfo() {
    if (!currentUser) return;
    
    const avatarEl = document.getElementById('elmo-drawer-avatar');
    const nameEl = document.getElementById('elmo-drawer-user-name');
    const idEl = document.getElementById('elmo-drawer-user-id');
    const accountManagementEl = document.getElementById('elmo-drawer-account-management');
    
    if (avatarEl) {
        avatarEl.textContent = (currentUser.name || 'U')[0].toUpperCase();
    }
    if (nameEl) {
        nameEl.textContent = currentUser.name || '사용자';
    }
    if (idEl) {
        idEl.textContent = currentUser.username || '';
    }
    
    // SU 권한이 있으면 계정관리 메뉴 표시
    if (accountManagementEl) {
        console.log('[Elmo Layout] 현재 사용자 role:', currentUser.role);
        if (currentUser.role === 'su') {
            accountManagementEl.style.display = 'flex';
            console.log('[Elmo Layout] 계정관리 메뉴 표시');
        } else {
            accountManagementEl.style.display = 'none';
            console.log('[Elmo Layout] 계정관리 메뉴 숨김 (role:', currentUser.role, ')');
        }
    } else {
        console.warn('[Elmo Layout] 계정관리 메뉴 요소를 찾을 수 없습니다.');
    }
}

/**
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
    // 햄버거 메뉴 열기
    const hamburgerBtn = document.getElementById('elmo-hamburger-btn');
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', openHamburgerMenu);
    }

    // 햄버거 메뉴 닫기
    const drawerClose = document.getElementById('elmo-drawer-close');
    const drawerOverlay = document.getElementById('elmo-drawer-overlay');
    if (drawerClose) {
        drawerClose.addEventListener('click', closeHamburgerMenu);
    }
    if (drawerOverlay) {
        drawerOverlay.addEventListener('click', closeHamburgerMenu);
    }

    // 햄버거 메뉴 항목 클릭
    const drawerItems = document.querySelectorAll('.elmo-drawer-item[data-screen]');
    drawerItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const screen = item.getAttribute('data-screen');
            navigateToScreen(screen);
            closeHamburgerMenu();
        });
    });

    // 하단 네비게이션 클릭
    const bottomNavItems = document.querySelectorAll('.elmo-bottom-nav-item');
    bottomNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const screen = item.getAttribute('data-screen');
            navigateToScreen(screen);
        });
    });
    
    // 햄버거 메뉴의 로그아웃
    const drawerLogout = document.getElementById('elmo-drawer-logout');
    if (drawerLogout) {
        drawerLogout.addEventListener('click', (e) => {
            e.preventDefault();
            closeHamburgerMenu();
            handleLogout();
        });
    }
}

/**
 * 햄버거 메뉴 열기
 */
function openHamburgerMenu() {
    hamburgerMenuOpen = true;
    const drawer = document.getElementById('elmo-drawer');
    const overlay = document.getElementById('elmo-drawer-overlay');
    if (drawer) drawer.classList.add('elmo-drawer-open');
    if (overlay) overlay.classList.add('elmo-drawer-overlay-visible');
    document.body.style.overflow = 'hidden';
}

/**
 * 햄버거 메뉴 닫기
 */
function closeHamburgerMenu() {
    hamburgerMenuOpen = false;
    const drawer = document.getElementById('elmo-drawer');
    const overlay = document.getElementById('elmo-drawer-overlay');
    if (drawer) drawer.classList.remove('elmo-drawer-open');
    if (overlay) overlay.classList.remove('elmo-drawer-overlay-visible');
    document.body.style.overflow = '';
}

/**
 * 화면 이동
 */
function navigateToScreen(screen) {
    if (!screens[screen]) return;
    
    currentScreen = screen;
    updateActiveScreen();
    
    // 화면별 모듈 로드
    import('./elmo-index.js').then(module => {
        module.navigateToScreen(screen);
    });
}

/**
 * 활성 화면 업데이트
 */
function updateActiveScreen() {
    // 하단 네비게이션 활성화
    const bottomNavItems = document.querySelectorAll('.elmo-bottom-nav-item');
    bottomNavItems.forEach(item => {
        const screen = item.getAttribute('data-screen');
        if (screen === currentScreen) {
            item.classList.add('elmo-bottom-nav-item-active');
        } else {
            item.classList.remove('elmo-bottom-nav-item-active');
        }
    });
    
    // 햄버거 메뉴 항목 활성화
    const drawerItems = document.querySelectorAll('.elmo-drawer-item[data-screen]');
    drawerItems.forEach(item => {
        const screen = item.getAttribute('data-screen');
        if (screen === currentScreen) {
            item.classList.add('elmo-drawer-item-active');
        } else {
            item.classList.remove('elmo-drawer-item-active');
        }
    });
}

/**
 * 로그아웃 처리
 */
function handleLogout() {
    if (!confirm('정말 로그아웃 하시겠습니까?')) {
        return;
    }

    // localStorage 정리
    try {
        localStorage.removeItem('elmo_session');
        localStorage.removeItem('elmo_user');
        console.log('[Elmo] 로그아웃 - localStorage 정리 완료');
    } catch (e) {
        console.error('[Elmo] localStorage 삭제 오류:', e);
    }

    // 화면 전환
    const mainSection = document.getElementById('elmo-main-section');
    const loginSection = document.getElementById('elmo-login-section');
    const loginForm = document.getElementById('elmo-login-form');
    const loginResult = document.getElementById('elmo-login-result');
    
    if (mainSection) {
        mainSection.style.display = 'none';
    }
    if (loginSection) {
        loginSection.style.display = 'flex';
    }
    if (loginForm) {
        loginForm.reset();
    }
    if (loginResult) {
        loginResult.textContent = '';
    }
}
