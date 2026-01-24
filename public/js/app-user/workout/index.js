// 운동기록 메인 화면

import { init as initList } from './list.js';
import { showWorkoutSelectModal, showTextRecordModal } from './add.js';
import { init as initCalendar, getSelectedDate, getCurrentMonth } from './calendar.js';

let currentAppUserId = null;
let isReadOnly = false;
let lastButtonClickTime = 0; // 버튼 클릭 중복 방지용
const BUTTON_CLICK_THROTTLE = 300; // 300ms 내 중복 클릭 방지

/**
 * 운동기록 화면 초기화
 */
export async function init(appUserId, readOnly = false) {
    currentAppUserId = appUserId;
    isReadOnly = readOnly;
    
    // 헤더 숨기기
    const header = document.querySelector('.app-header');
    if (header) {
        header.style.display = 'none';
    }
    
    // 버튼 이벤트 위임 리스너 설정 (render() 전에 설정하여 DOM 업데이트 후에도 작동)
    // setupBackButtonHandler는 setupButtonEventListeners에서 처리하므로 제거
    setupButtonEventListeners();
    
    await render();
}

/**
 * 뒤로가기 버튼 이벤트 핸들러 설정 (한 번만 설정)
 */
function setupBackButtonHandler() {
    const container = document.getElementById('app-user-content');
    if (!container) return;
    
    // 이미 설정되어 있으면 중복 설정 방지
    if (container._backButtonHandlerSetup) {
        return;
    }
    
    // 이벤트 위임을 container에 설정 (한 번만)
    const handler = async (e) => {
        // 뒤로가기 버튼 또는 그 자식 요소 클릭 확인
        const backBtn = e.target.closest('#workout-back-btn');
        if (backBtn) {
            e.preventDefault();
            e.stopPropagation();
            
            // 현재 읽기 전용 모드인지 확인
            const isReadOnlyMode = localStorage.getItem('isReadOnly') === 'true';
            const viewingTrainerName = localStorage.getItem('viewingTrainerName');
            
                if (isReadOnlyMode && viewingTrainerName) {
                    // localStorage에서 트레이너 관련 정보 제거
                    localStorage.removeItem('viewingTrainerAppUserId');
                    localStorage.removeItem('isReadOnly');
                    localStorage.removeItem('viewingTrainerName');
                    
                    // 탭 활성화 상태 업데이트 (layout.js의 함수 호출)
                    // layout.js에서 export된 함수가 없으므로 직접 DOM 업데이트
                    const disabledTabs = ['home', 'diet', 'profile'];
                    disabledTabs.forEach(screen => {
                        const bottomNavItem = document.querySelector(`.app-bottom-nav-item[data-screen="${screen}"]`);
                        if (bottomNavItem) {
                            bottomNavItem.style.pointerEvents = '';
                            bottomNavItem.style.opacity = '';
                            bottomNavItem.style.cursor = '';
                        }
                        const drawerItem = document.querySelector(`.app-drawer-item[data-screen="${screen}"]`);
                        if (drawerItem) {
                            drawerItem.style.pointerEvents = '';
                            drawerItem.style.opacity = '';
                            drawerItem.style.cursor = '';
                        }
                    });
                    
                    // 자신의 기록으로 다시 로드
                    const { navigateToScreen } = await import('../index.js');
                    navigateToScreen('workout');
                }
        }
    };
    
    container.addEventListener('click', handler);
    container._backButtonHandlerSetup = true; // 플래그 설정
}


/**
 * 버튼 이벤트 핸들러 설정 (이벤트 위임 사용, 한 번만 설정)
 */
function setupButtonEventListeners() {
    const container = document.getElementById('app-user-content');
    if (!container) {
        return;
    }
    
    // 이미 설정되어 있으면 중복 설정 방지
    if (container._buttonEventListenersSetup) {
        return;
    }
    
    // 이벤트 위임을 container에 설정 (한 번만)
    const handler = async (e) => {
        const target = e.target;
        const eventType = e.type;
        
        // 버튼 찾기
        let clickedBtn = null;
        if (target.tagName === 'BUTTON' && target.id) {
            clickedBtn = target;
        } else if (target.closest) {
            clickedBtn = target.closest('button[id]');
        }
        
        if (!clickedBtn || !clickedBtn.id) {
            return;
        }
        
        const btnId = clickedBtn.id;
        
        // touch 이벤트 처리
        if (eventType === 'touchstart') {
            e.preventDefault(); // 기본 동작 방지 (스크롤 등)
            return; // touchstart는 처리하지 않고 touchend에서 처리
        }
        
        if (eventType === 'touchend') {
            e.preventDefault(); // 기본 동작 방지 (스크롤 등)
            e.stopPropagation();
        }
        
        // 오늘 버튼 클릭
        if (btnId === 'workout-today-btn') {
            if (eventType === 'touchstart') {
                return; // touchstart는 무시
            }
            
            if (eventType !== 'touchend') {
                e.preventDefault();
            }
            e.stopPropagation();
            
            try {
                const { setSelectedDate, setCurrentMonth } = await import('./calendar.js');
                const { formatDate } = await import('../utils.js');
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                setSelectedDate(today);
                setCurrentMonth(today);
                await loadWorkoutRecordsForCalendar();
                await updateMonthDisplay();
                
                const todayStr = formatDate(today);
                const listModule = await import('./list.js');
                await listModule.filterByDate(todayStr);
            } catch (error) {
                console.error('[Workout] 오늘 버튼 클릭 오류:', error);
            }
            return;
        }
        
        // 메모 버튼 클릭
        if (btnId === 'workout-memo-btn') {
            if (eventType === 'touchstart') {
                return; // touchstart는 무시
            }
            
            if (eventType !== 'touchend') {
                e.preventDefault();
            }
            e.stopPropagation();
            
            try {
                await showMemoModal();
            } catch (error) {
                console.error('[Workout] 메모 버튼 클릭 오류:', error);
            }
            return;
        }
        
        // 내 기록으로 돌아가기 버튼 클릭
        if (btnId === 'workout-back-btn') {
            if (eventType === 'touchstart') {
                return; // touchstart는 무시
            }
            
            if (eventType !== 'touchend') {
                e.preventDefault();
            }
            e.stopPropagation();
            
            try {
                // 현재 읽기 전용 모드인지 확인
                const isReadOnlyMode = localStorage.getItem('isReadOnly') === 'true';
                const viewingTrainerName = localStorage.getItem('viewingTrainerName');
                
                if (isReadOnlyMode && viewingTrainerName) {
                    // localStorage에서 트레이너 관련 정보 제거
                    localStorage.removeItem('viewingTrainerAppUserId');
                    localStorage.removeItem('isReadOnly');
                    localStorage.removeItem('viewingTrainerName');
                    
                    // 탭 활성화 상태 업데이트 (layout.js의 함수 호출)
                    // layout.js에서 export된 함수가 없으므로 직접 DOM 업데이트
                    const disabledTabs = ['home', 'diet', 'profile'];
                    disabledTabs.forEach(screen => {
                        const bottomNavItem = document.querySelector(`.app-bottom-nav-item[data-screen="${screen}"]`);
                        if (bottomNavItem) {
                            bottomNavItem.style.pointerEvents = '';
                            bottomNavItem.style.opacity = '';
                            bottomNavItem.style.cursor = '';
                        }
                        const drawerItem = document.querySelector(`.app-drawer-item[data-screen="${screen}"]`);
                        if (drawerItem) {
                            drawerItem.style.pointerEvents = '';
                            drawerItem.style.opacity = '';
                            drawerItem.style.cursor = '';
                        }
                    });
                    
                    // 자신의 기록으로 다시 로드
                    const { navigateToScreen } = await import('../index.js');
                    navigateToScreen('workout');
                }
            } catch (error) {
                console.error('[Workout] 돌아가기 버튼 클릭 오류:', error);
            }
            return;
        }
        
        // 운동 추가하기 버튼 클릭
        if (btnId === 'workout-add-btn' && !isReadOnly) {
            // 중복 클릭 방지: touchstart는 건너뛰고, 다른 이벤트는 throttle 체크
            if (eventType === 'touchstart') {
                return; // touchstart는 무시 (touchend에서만 처리)
            }
            
            // 짧은 시간 내 중복 실행 방지
            const now = Date.now();
            if (now - lastButtonClickTime < BUTTON_CLICK_THROTTLE) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            lastButtonClickTime = now;
            
            if (eventType !== 'touchend') {
                e.preventDefault();
            }
            e.stopPropagation();
            
            try {
                const selectedDateStr = getSelectedDate();
                showWorkoutSelectModal(currentAppUserId, selectedDateStr, () => {
                    import('./list.js').then(module => {
                        module.refresh();
                    });
                });
            } catch (error) {
                console.error('[Workout] 운동 추가 버튼 클릭 오류:', error);
            }
            return;
        }
        
        // 텍스트로 기록 버튼 클릭
        if (btnId === 'workout-text-add-btn' && !isReadOnly) {
            // 중복 클릭 방지: touchstart는 건너뛰고, 다른 이벤트는 throttle 체크
            if (eventType === 'touchstart') {
                return; // touchstart는 무시 (touchend에서만 처리)
            }
            
            // 짧은 시간 내 중복 실행 방지
            const now = Date.now();
            if (now - lastButtonClickTime < BUTTON_CLICK_THROTTLE) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            lastButtonClickTime = now;
            
            if (eventType !== 'touchend') {
                e.preventDefault();
            }
            e.stopPropagation();
            
            try {
                const selectedDateStr = getSelectedDate();
                showTextRecordModal(currentAppUserId, selectedDateStr, () => {
                    import('./list.js').then(module => {
                        module.refresh();
                    });
                });
            } catch (error) {
                console.error('[Workout] 텍스트 기록 버튼 클릭 오류:', error);
            }
            return;
        }
    };
    
    // 여러 이벤트 타입 처리 (스와이프 직후 click 이벤트가 발생하지 않을 수 있음)
    // click 이벤트
    container.addEventListener('click', handler, true);
    container.addEventListener('click', handler, false);
    
    // touch 이벤트 (모바일 및 스와이프 후 첫 클릭 처리)
    container.addEventListener('touchstart', handler, true);
    container.addEventListener('touchend', handler, true);
    
    // pointer 이벤트 (마우스, 터치, 펜 통합)
    container.addEventListener('pointerdown', handler, true);
    
    container._buttonEventListenersSetup = true;
}

/**
 * 운동기록 화면 렌더링
 */
async function render() {
    const container = document.getElementById('app-user-content');
    if (!container) {
        return;
    }
    
    // 현재 월 가져오기
    const currentMonth = getCurrentMonth();
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    
    // 연결된 회원 정보 확인 (트레이너가 회원을 선택한 경우)
    const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
    // 회원이 트레이너를 보는 경우 (읽기 전용)
    const viewingTrainerName = localStorage.getItem('viewingTrainerName');
    let memberDisplay = '';
    
    if (viewingTrainerName) {
        memberDisplay = ` (${viewingTrainerName} 트레이너의 운동기록)`;
    } else if (connectedMemberAppUserId) {
        // 유저앱 회원 정보 조회하여 이름 표시
        try {
            const appUserResponse = await fetch(`/api/app-users/${connectedMemberAppUserId}`);
            if (appUserResponse.ok) {
                const appUser = await appUserResponse.json();
                memberDisplay = ` (${appUser.name}님의 운동기록)`;
            }
        } catch (error) {
            console.error('앱 유저 정보 조회 오류:', error);
        }
    }
    
    // 뒤로가기 버튼 (트레이너 기록을 볼 때만 표시)
    const backButton = isReadOnly && viewingTrainerName ? `
        <div class="app-workout-add-section">
            <button class="app-btn-primary app-btn-full" id="workout-back-btn" title="내 기록으로 돌아가기">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                내 기록으로 돌아가기
            </button>
        </div>
    ` : '';
    
    container.innerHTML = `
        <div class="app-workout-screen">
            <div class="app-workout-top-bar">
                <div class="app-workout-month-display">${year}년 ${month}월${memberDisplay}</div>
                <div class="app-workout-top-buttons">
                    <button class="app-workout-today-btn" id="workout-today-btn" title="오늘로 이동">오늘</button>
                    <button class="app-workout-today-btn" id="workout-memo-btn" title="메모 보기">메모</button>
                </div>
            </div>
            <div id="workout-calendar-container"></div>
            ${backButton}
            ${!isReadOnly ? `
            <div class="app-workout-add-section">
                <div style="display: flex; gap: 8px;">
                    <button class="app-btn-primary app-btn-full" id="workout-add-btn" style="flex: 1;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        운동 선택하기
                    </button>
                    <button class="app-btn-secondary app-btn-full" id="workout-text-add-btn" style="flex: 1; white-space: nowrap;">
                        📝 직접 기록하기
                    </button>
                </div>
            </div>
            ` : ''}
            <div id="workout-list-wrapper"></div>
        </div>
    `;
    
    // 월 변경 감지를 위한 인터벌 (캘린더 스와이프 시 업데이트)
    setupMonthUpdateObserver();
    
    // 캘린더용 운동기록 로드 (먼저 실행하여 캘린더에 데이터 전달)
    loadWorkoutRecordsForCalendar().then(async () => {
        // 세션 데이터를 list.js에 전달
        // 연결된 회원이 있으면 해당 회원의 app_user_id로 조회, 없으면 현재 사용자
        const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
        const targetAppUserId = connectedMemberAppUserId || currentAppUserId;
        
        if (!targetAppUserId) {
            console.error('세션 데이터 조회 오류: app_user_id가 없습니다.');
            return;
        }
        
        let memberName = null;
        try {
            const appUserResponse = await fetch(`/api/app-users/${targetAppUserId}`);
            if (appUserResponse.ok) {
                const appUser = await appUserResponse.json();
                memberName = appUser.member_name;
            }
        } catch (error) {
            console.error('앱 유저 정보 조회 오류:', error);
        }
        
        let sessions = [];
        if (memberName) {
            try {
                const { getToday } = await import('../utils.js');
                const today = getToday();
                const todayDate = new Date(today);
                const startDate = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
                const endDate = new Date(todayDate.getFullYear(), todayDate.getMonth() + 2, 0);
                
                const params = new URLSearchParams({
                    startDate: startDate.toISOString().split('T')[0],
                    endDate: endDate.toISOString().split('T')[0],
                    member: memberName
                });
                
                const sessionsResponse = await fetch(`/api/sessions?${params.toString()}`);
                if (sessionsResponse.ok) {
                    sessions = await sessionsResponse.json();
                }
            } catch (error) {
                console.error('세션 데이터 조회 오류:', error);
            }
        }
        
        // 세션 데이터를 list.js에 전달 (트레이너 이름 매핑도 로드됨)
        const listModule = await import('./list.js');
        await listModule.updateSessions(sessions);
        
        // 운동 목록 초기화 (선택된 날짜로 필터링)
        if (currentAppUserId) {
            await initList(currentAppUserId, isReadOnly);
            const selectedDateStr = getSelectedDate();
            if (selectedDateStr) {
                await listModule.filterByDate(selectedDateStr);
            }
        } else {
            console.error('운동 목록 초기화 오류: currentAppUserId가 없습니다.');
        }
    }).catch(error => {
        console.error('운동기록 로드 중 오류:', error);
    });
    
    // 추가 버튼 이벤트는 init()에서 이벤트 위임으로 한 번만 설정되므로 여기서는 설정하지 않음
    
    // 트레이너 기록 조회 중인 경우 탭 비활성화
    if (isReadOnly && viewingTrainerName) {
        const disabledTabs = ['home', 'diet', 'profile'];
        disabledTabs.forEach(screen => {
            const bottomNavItem = document.querySelector(`.app-bottom-nav-item[data-screen="${screen}"]`);
            if (bottomNavItem) {
                bottomNavItem.style.pointerEvents = 'none';
                bottomNavItem.style.opacity = '0.5';
                bottomNavItem.style.cursor = 'not-allowed';
            }
            const drawerItem = document.querySelector(`.app-drawer-item[data-screen="${screen}"]`);
            if (drawerItem) {
                drawerItem.style.pointerEvents = 'none';
                drawerItem.style.opacity = '0.5';
                drawerItem.style.cursor = 'not-allowed';
            }
        });
    }
    
    // 오늘의 운동 카드에서 온 경우 자동으로 운동 추가 모달 열기
    const autoOpenWorkoutAdd = localStorage.getItem('autoOpenWorkoutAdd');
    if (autoOpenWorkoutAdd === 'true') {
        localStorage.removeItem('autoOpenWorkoutAdd');
        // 약간의 지연을 두어 화면 렌더링 완료 후 모달 열기
        setTimeout(() => {
            const selectedDateStr = getSelectedDate();
            showWorkoutSelectModal(currentAppUserId, selectedDateStr, () => {
                // 추가 성공 후 목록 새로고침
                import('./list.js').then(module => {
                    module.refresh();
                });
            });
        }, 100);
    }
}

/**
 * 상단 연월 표시 업데이트
 */
async function updateMonthDisplay() {
    const currentMonth = getCurrentMonth();
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    
    // 연결된 회원 정보 확인 (트레이너가 회원을 선택한 경우)
    const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
    // 회원이 트레이너를 보는 경우 (읽기 전용)
    const viewingTrainerName = localStorage.getItem('viewingTrainerName');
    let memberDisplay = '';
    
    if (viewingTrainerName) {
        memberDisplay = ` (${viewingTrainerName} 트레이너의 운동기록)`;
    } else if (connectedMemberAppUserId) {
        // 유저앱 회원 정보 조회하여 이름 표시
        try {
            const appUserResponse = await fetch(`/api/app-users/${connectedMemberAppUserId}`);
            if (appUserResponse.ok) {
                const appUser = await appUserResponse.json();
                memberDisplay = ` (${appUser.name}님의 운동기록)`;
            }
        } catch (error) {
            console.error('앱 유저 정보 조회 오류:', error);
        }
    }
    
    const monthDisplay = document.querySelector('.app-workout-month-display');
    if (monthDisplay) {
        monthDisplay.textContent = `${year}년 ${month}월${memberDisplay}`;
    }
}

/**
 * 월 변경 감지 설정
 */
function setupMonthUpdateObserver() {
    // 캘린더가 다시 렌더링될 때마다 상단 연월 업데이트
    const observer = new MutationObserver(async () => {
        await updateMonthDisplay();
    });
    
    const calendarContainer = document.getElementById('workout-calendar-container');
    if (calendarContainer) {
        observer.observe(calendarContainer, { childList: true, subtree: true });
    }
    
    // 주기적으로도 체크 (스와이프 후 업데이트)
    setInterval(async () => {
        await updateMonthDisplay();
    }, 500);
}

/**
 * 캘린더용 운동기록 로드
 */
async function loadWorkoutRecordsForCalendar() {
    try {
        // 연결된 회원이 있으면 해당 회원의 app_user_id로 조회, 없으면 현재 사용자
        const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
        const targetAppUserId = connectedMemberAppUserId || currentAppUserId;
        
        // app_user_id가 없으면 오류
        if (!targetAppUserId) {
            console.error('운동기록 로드 오류: app_user_id가 없습니다.');
            throw new Error('사용자 ID가 없습니다.');
        }
        
        // 캘린더용 경량 API 사용 (날짜별 완료 여부만)
        const { getWorkoutRecordsForCalendar } = await import('../api.js');
        const { getToday } = await import('../utils.js');
        const today = getToday();
        const todayDate = new Date(today);
        const startDate = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
        const endDate = new Date(todayDate.getFullYear(), todayDate.getMonth() + 2, 0);
        
        const summary = await getWorkoutRecordsForCalendar(
            targetAppUserId,
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
        );
        
        // 앱 유저 정보 가져오기 (member_name 확인용)
        let memberName = null;
        try {
            const appUserResponse = await fetch(`/api/app-users/${targetAppUserId}`);
            if (appUserResponse.ok) {
                const appUser = await appUserResponse.json();
                memberName = appUser.member_name;
            }
        } catch (error) {
            console.error('앱 유저 정보 조회 오류:', error);
        }
        
        // 세션 데이터 가져오기 (member_name이 있는 경우만)
        let sessions = [];
        if (memberName) {
            try {
                const { getToday } = await import('../utils.js');
                const today = getToday();
                const todayDate = new Date(today);
                const startDate = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
                const endDate = new Date(todayDate.getFullYear(), todayDate.getMonth() + 2, 0);
                
                const params = new URLSearchParams({
                    startDate: startDate.toISOString().split('T')[0],
                    endDate: endDate.toISOString().split('T')[0],
                    member: memberName
                });
                
                const sessionsResponse = await fetch(`/api/sessions?${params.toString()}`);
                if (sessionsResponse.ok) {
                    sessions = await sessionsResponse.json();
                }
            } catch (error) {
                console.error('세션 데이터 조회 오류:', error);
            }
        }
        
        // 캘린더 초기화
        const calendarContainer = document.getElementById('workout-calendar-container');
        if (calendarContainer) {
            const { init: initCalendar, updateWorkoutRecords, updateSessions, render: renderCalendar } = await import('./calendar.js');
            initCalendar(calendarContainer, async (selectedDate) => {
                // 날짜 선택 시 목록 필터링
                if (selectedDate) {
                    const { formatDate } = await import('../utils.js');
                    const selectedDateStr = formatDate(selectedDate);
                    const listModule = await import('./list.js');
                    await listModule.filterByDate(selectedDateStr);
                }
                // 월이 변경되면 상단 연월 표시 업데이트
                await updateMonthDisplay();
            }, summary);
            
            // 세션 데이터 업데이트
            updateSessions(sessions);
            renderCalendar(calendarContainer);
            
            // 운동기록 업데이트 함수를 전역에 저장 (목록 새로고침 시 사용)
            window.updateCalendarWorkoutRecords = async () => {
                const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
                const targetAppUserId = connectedMemberAppUserId || currentAppUserId;
                if (!targetAppUserId) {
                    console.error('운동기록 업데이트 오류: app_user_id가 없습니다.');
                    return;
                }
                const { getWorkoutRecordsForCalendar } = await import('../api.js');
                const { getToday } = await import('../utils.js');
                const today = getToday();
                const todayDate = new Date(today);
                const startDate = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
                const endDate = new Date(todayDate.getFullYear(), todayDate.getMonth() + 2, 0);
                
                const updatedSummary = await getWorkoutRecordsForCalendar(
                    targetAppUserId,
                    startDate.toISOString().split('T')[0],
                    endDate.toISOString().split('T')[0]
                );
                updateWorkoutRecords(updatedSummary);
                renderCalendar(calendarContainer);
            };
        }
    } catch (error) {
        console.error('운동기록 로드 오류:', error);
        // 오류 발생 시에도 캘린더는 표시
        const calendarContainer = document.getElementById('workout-calendar-container');
        if (calendarContainer) {
            const { init: initCalendar } = await import('./calendar.js');
            initCalendar(calendarContainer, (selectedDate) => {
                updateMonthDisplay();
            }, []);
        }
    }
}

/**
 * 메모 모달 표시
 */
async function showMemoModal() {
    try {
        const { getCurrentMonth } = await import('./calendar.js');
        const { getWorkoutRecords } = await import('../api.js');
        const { formatDate, formatDateShort, escapeHtml } = await import('../utils.js');
        
        // 현재 달 가져오기
        const currentMonth = getCurrentMonth();
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth() + 1;
        
        // 달의 시작일과 마지막일 계산
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        
        const startDateStr = formatDate(startDate);
        const endDateStr = formatDate(endDate);
        
        // 연결된 회원이 있으면 해당 회원의 app_user_id로 조회, 없으면 현재 사용자
        const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
        const targetAppUserId = connectedMemberAppUserId || currentAppUserId;
        
        // app_user_id가 없으면 오류
        if (!targetAppUserId) {
            throw new Error('사용자 ID가 없습니다.');
        }
        
        // 현재 달의 운동기록 가져오기
        const records = await getWorkoutRecords(targetAppUserId, {
            startDate: startDateStr,
            endDate: endDateStr
        });
        
        // 메모가 있는 기록 필터링
        const recordsWithMemo = records.filter(record => 
            record.notes && record.notes.trim().length > 0
        );
        
        // 메모 모달 HTML 생성
        let memoCardsHtml = '';
        if (recordsWithMemo.length === 0) {
            memoCardsHtml = '<div style="text-align: center; padding: 40px 20px; color: var(--app-text-muted);">메모가 있는 운동기록이 없습니다.</div>';
        } else {
            memoCardsHtml = recordsWithMemo.map(record => {
                const dateObj = new Date(record.workout_date + 'T00:00:00');
                const dateStr = formatDateShort(dateObj);
                const workoutName = escapeHtml(record.workout_type_name || '운동');
                const memo = escapeHtml(record.notes || '');
                
                return `<div class="app-memo-card">
                    <div class="app-memo-card-header">
                        <span class="app-memo-card-date">${dateStr}</span>
                        <span class="app-memo-card-workout">${workoutName}</span>
                    </div>
                    <div class="app-memo-card-content">${memo}</div>
                </div>`;
            }).join('');
        }
        
        // 모달 HTML 생성
        const modalHtml = `
            <div class="app-modal-bg" id="memo-modal-bg">
                <div class="app-modal" id="memo-modal">
                    <div class="app-modal-header">
                        <h2>${year}년 ${month}월 메모</h2>
                        <button class="app-modal-close-btn" id="memo-modal-close">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="app-modal-content" style="max-height: 60vh; overflow-y: auto; padding: 16px;">
                        <div class="app-memo-cards-container">
                            ${memoCardsHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 기존 모달이 있으면 제거
        const existingModal = document.getElementById('memo-modal-bg');
        if (existingModal) {
            existingModal.remove();
        }
        
        // 모달 추가
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modalBg = document.getElementById('memo-modal-bg');
        const modal = document.getElementById('memo-modal');
        const closeBtn = document.getElementById('memo-modal-close');
        
        // 모달 표시 애니메이션
        setTimeout(() => {
            modalBg.classList.add('app-modal-show');
            modal.classList.add('app-modal-show');
        }, 10);
        
        // 닫기 버튼 클릭
        closeBtn.addEventListener('click', closeMemoModal);
        
        // 배경 클릭 시 닫기
        modalBg.addEventListener('click', (e) => {
            if (e.target === modalBg) {
                closeMemoModal();
            }
        });
        
        // ESC 키로 닫기
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeMemoModal();
            }
        };
        document.addEventListener('keydown', escHandler);
        
        function closeMemoModal() {
            modalBg.classList.remove('app-modal-show');
            modal.classList.remove('app-modal-show');
            document.removeEventListener('keydown', escHandler);
            setTimeout(() => {
                modalBg.remove();
            }, 300);
        }
    } catch (error) {
        console.error('메모 모달 표시 오류:', error);
        alert('메모를 불러오는 중 오류가 발생했습니다.');
    }
}
