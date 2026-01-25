// 앱 유저 레이아웃 관리 (헤더, 햄버거 메뉴, 하단 네비게이션)

import { escapeHtml } from './utils.js';

let currentUser = null;
let currentScreen = 'home';
let hamburgerMenuOpen = false;

const screens = {
    home: { label: '홈', icon: '🏠', id: 'home' },
    workout: { label: '운동', icon: '💪', id: 'workout' },
    diet: { label: '식단', icon: '🍎', id: 'diet' },
    profile: { label: '내정보', icon: '👤', id: 'profile' },
    settings: { label: '설정', icon: '⚙️', id: 'settings' }
};

/**
 * 레이아웃 초기화
 */
export function init(userData) {
    currentUser = userData;
    render();
    setupEventListeners();
    
    // 초기 탭 상태 업데이트
    updateTabsEnabledState();
}

/**
 * 레이아웃 렌더링
 */
function render() {
    const container = document.getElementById('app-user-section');
    if (!container) return;

    container.innerHTML = `
        <!-- 헤더 -->
        <header class="app-header">
            <button class="app-hamburger-btn" id="app-hamburger-btn" aria-label="메뉴">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
            </button>
            <div class="app-header-title">스탠다드 멤버스</div>
            <div style="width: 40px;"></div>
        </header>

        <!-- 햄버거 메뉴 (사이드 드로어) -->
        <div class="app-drawer-overlay" id="app-drawer-overlay"></div>
        <nav class="app-drawer" id="app-drawer">
            <div class="app-drawer-header">
                <div class="app-drawer-user">
                    <div class="app-drawer-avatar">${(currentUser?.name || 'U')[0]}</div>
                    <div class="app-drawer-user-info">
                        <p class="app-drawer-user-name">${escapeHtml(currentUser?.name || '회원')}</p>
                        <p class="app-drawer-user-id">${escapeHtml(currentUser?.username || '')}</p>
                    </div>
                </div>
                <button class="app-drawer-close" id="app-drawer-close" aria-label="메뉴 닫기">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="app-drawer-menu">
                <a href="#" class="app-drawer-item" data-screen="home">
                    <span class="app-drawer-icon">🏠</span>
                    <span>홈</span>
                </a>
                <a href="#" class="app-drawer-item" data-screen="workout">
                    <span class="app-drawer-icon">💪</span>
                    <span>운동기록</span>
                </a>
                <a href="#" class="app-drawer-item" data-screen="diet">
                    <span class="app-drawer-icon">🍎</span>
                    <span>식단기록</span>
                </a>
                <a href="#" class="app-drawer-item" data-screen="profile">
                    <span class="app-drawer-icon">👤</span>
                    <span>내정보</span>
                </a>
                <div class="app-drawer-divider"></div>
                <a href="#" class="app-drawer-item" id="app-drawer-switch-back" style="display:none;">
                    <span class="app-drawer-icon">🔄</span>
                    <span>트레이너 화면으로</span>
                </a>
                <a href="#" class="app-drawer-item app-drawer-item-danger" id="app-drawer-logout">
                    <span class="app-drawer-icon">🚪</span>
                    <span>로그아웃</span>
                </a>
            </div>
        </nav>

        <!-- 메인 컨텐츠 -->
        <main class="app-main">
            <div id="app-user-content"></div>
        </main>

        <!-- 하단 네비게이션 -->
        <nav class="app-bottom-nav">
            <a href="#" class="app-bottom-nav-item" data-screen="home">
                <span class="app-bottom-nav-icon">🏠</span>
                <span class="app-bottom-nav-label">홈</span>
            </a>
            <a href="#" class="app-bottom-nav-item" data-screen="workout">
                <span class="app-bottom-nav-icon">💪</span>
                <span class="app-bottom-nav-label">운동</span>
            </a>
            <a href="#" class="app-bottom-nav-item" data-screen="diet">
                <span class="app-bottom-nav-icon">🍎</span>
                <span class="app-bottom-nav-label">식단</span>
            </a>
            <a href="#" class="app-bottom-nav-item" data-screen="profile">
                <span class="app-bottom-nav-icon">👤</span>
                <span class="app-bottom-nav-label">내정보</span>
            </a>
        </nav>
    `;

    updateActiveScreen();
}

/**
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
    // 햄버거 메뉴 열기
    const hamburgerBtn = document.getElementById('app-hamburger-btn');
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', openHamburgerMenu);
    }

    // 햄버거 메뉴 닫기
    const drawerClose = document.getElementById('app-drawer-close');
    const drawerOverlay = document.getElementById('app-drawer-overlay');
    if (drawerClose) {
        drawerClose.addEventListener('click', closeHamburgerMenu);
    }
    if (drawerOverlay) {
        drawerOverlay.addEventListener('click', closeHamburgerMenu);
    }

    // 햄버거 메뉴 항목 클릭
    const drawerItems = document.querySelectorAll('.app-drawer-item[data-screen]');
    drawerItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // 트레이너 기록 조회 중인지 확인
            const isViewingTrainer = localStorage.getItem('isReadOnly') === 'true' && 
                                     localStorage.getItem('viewingTrainerName');
            const screen = item.getAttribute('data-screen');
            
            // 비활성화된 탭 클릭 방지
            if (isViewingTrainer && ['home', 'diet', 'profile'].includes(screen)) {
                return;
            }
            
            navigateToScreen(screen);
            closeHamburgerMenu();
        });
    });

    // 하단 네비게이션 클릭
    const bottomNavItems = document.querySelectorAll('.app-bottom-nav-item');
    bottomNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // 트레이너 기록 조회 중인지 확인
            const isViewingTrainer = localStorage.getItem('isReadOnly') === 'true' && 
                                     localStorage.getItem('viewingTrainerName');
            const screen = item.getAttribute('data-screen');
            
            // 비활성화된 탭 클릭 방지
            if (isViewingTrainer && ['home', 'diet', 'profile'].includes(screen)) {
                return;
            }
            
            navigateToScreen(screen);
        });
    });

    // 트레이너 화면으로 복귀 버튼 (viewMode가 app_user일 때만 표시)
    const viewMode = localStorage.getItem('viewMode');
    const switchBackBtn = document.getElementById('app-drawer-switch-back');
    if (switchBackBtn) {
        if (viewMode === 'app_user') {
            switchBackBtn.style.display = 'flex';
            switchBackBtn.addEventListener('click', (e) => {
                e.preventDefault();
                closeHamburgerMenu();
                // 트레이너 화면으로 복귀
                if (window.switchBackToTrainerView) {
                    window.switchBackToTrainerView();
                }
            });
        } else {
            switchBackBtn.style.display = 'none';
        }
    }
    
    // 햄버거 메뉴의 로그아웃
    const drawerLogout = document.getElementById('app-drawer-logout');
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
    const drawer = document.getElementById('app-drawer');
    const overlay = document.getElementById('app-drawer-overlay');
    if (drawer) drawer.classList.add('app-drawer-open');
    if (overlay) overlay.classList.add('app-drawer-overlay-visible');
    document.body.style.overflow = 'hidden';
}

/**
 * 햄버거 메뉴 닫기
 */
function closeHamburgerMenu() {
    hamburgerMenuOpen = false;
    const drawer = document.getElementById('app-drawer');
    const overlay = document.getElementById('app-drawer-overlay');
    if (drawer) drawer.classList.remove('app-drawer-open');
    if (overlay) overlay.classList.remove('app-drawer-overlay-visible');
    document.body.style.overflow = '';
}

/**
 * 화면 이동
 */
function navigateToScreen(screen) {
    if (!screens[screen]) return;
    
    // 트레이너 기록 조회 중인지 확인
    const isViewingTrainer = localStorage.getItem('isReadOnly') === 'true' && 
                             localStorage.getItem('viewingTrainerName');
    
    // 비활성화된 탭으로 이동 시도 방지
    if (isViewingTrainer && ['home', 'diet', 'profile'].includes(screen)) {
        return;
    }
    
    currentScreen = screen;
    updateActiveScreen();
    
    // workout 화면이 아니면 헤더 표시
    const header = document.querySelector('.app-header');
    if (header) {
        if (screen === 'workout') {
            header.style.display = 'none';
        } else {
            header.style.display = 'flex';
        }
    }
    
    // 화면별 모듈 로드 (향후 구현)
    import('./index.js').then(module => {
        module.navigateToScreen(screen);
    });
}

/**
 * 활성 화면 업데이트
 */
function updateActiveScreen() {
    // 하단 네비게이션 활성화
    const bottomNavItems = document.querySelectorAll('.app-bottom-nav-item');
    bottomNavItems.forEach(item => {
        const screen = item.getAttribute('data-screen');
        if (screen === currentScreen) {
            item.classList.add('app-bottom-nav-item-active');
        } else {
            item.classList.remove('app-bottom-nav-item-active');
        }
    });
    
    // 트레이너 기록 조회 중인지 확인하여 탭 비활성화/활성화
    updateTabsEnabledState();
}

/**
 * 탭 활성화/비활성화 상태 업데이트
 */
function updateTabsEnabledState() {
    const isViewingTrainer = localStorage.getItem('isReadOnly') === 'true' && 
                             localStorage.getItem('viewingTrainerName');
    
    // 비활성화할 탭 목록
    const disabledTabs = ['home', 'diet', 'profile'];
    
    // 하단 네비게이션 탭 비활성화/활성화
    disabledTabs.forEach(screen => {
        const bottomNavItem = document.querySelector(`.app-bottom-nav-item[data-screen="${screen}"]`);
        if (bottomNavItem) {
            if (isViewingTrainer) {
                bottomNavItem.style.pointerEvents = 'none';
                bottomNavItem.style.opacity = '0.5';
                bottomNavItem.style.cursor = 'not-allowed';
            } else {
                bottomNavItem.style.pointerEvents = '';
                bottomNavItem.style.opacity = '';
                bottomNavItem.style.cursor = '';
            }
        }
    });
    
    // 햄버거 메뉴 탭 비활성화/활성화
    disabledTabs.forEach(screen => {
        const drawerItem = document.querySelector(`.app-drawer-item[data-screen="${screen}"]`);
        if (drawerItem) {
            if (isViewingTrainer) {
                drawerItem.style.pointerEvents = 'none';
                drawerItem.style.opacity = '0.5';
                drawerItem.style.cursor = 'not-allowed';
            } else {
                drawerItem.style.pointerEvents = '';
                drawerItem.style.opacity = '';
                drawerItem.style.cursor = '';
            }
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
    localStorage.removeItem('userType');
    localStorage.removeItem('appUserId');
    localStorage.removeItem('appUsername');
    localStorage.removeItem('appUserName');
    localStorage.removeItem('appUserPhone');
    localStorage.removeItem('appUserMemberName');
    // 연결된 회원 정보 삭제
    localStorage.removeItem('connectedMemberName');
    localStorage.removeItem('connectedMemberAppUserId');
    // 트레이너 뷰 모드 관련 정보 삭제
    localStorage.removeItem('viewingTrainerAppUserId');
    localStorage.removeItem('isReadOnly');
    localStorage.removeItem('viewingTrainerName');
    localStorage.removeItem('viewMode');
    localStorage.removeItem('autoOpenWorkoutAdd');

    // 화면 전환
    document.getElementById('app-user-section').style.display = 'none';
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('signupSection').style.display = 'none';
    document.getElementById('loginForm').reset();
    document.getElementById('login-result').innerText = '';
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('settingsBtn').style.display = 'none';
    
    // body 클래스 제거
    document.body.classList.remove('app-user-active');
    
    // 기존 상단바 다시 표시
    const oldHeader = document.getElementById('old-header');
    if (oldHeader) {
        oldHeader.style.display = 'flex';
    }
}
