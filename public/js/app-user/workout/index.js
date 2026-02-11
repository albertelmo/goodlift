// 운동기록 메인 화면

import { showWorkoutSelectModal, showTextRecordModal, preloadWorkoutData } from './add.js';
import { getCurrentUser } from '../index.js';
import { init as initCalendar, getSelectedDate, getCurrentMonth } from './calendar.js';

let currentAppUserId = null;
let isReadOnly = false;
let lastButtonClickTime = 0; // 버튼 클릭 중복 방지용
const BUTTON_CLICK_THROTTLE = 300; // 300ms 내 중복 클릭 방지
const trainerNameCache = new Map();

async function resolveTrainerName(trainerUsername) {
    if (!trainerUsername) return null;
    if (trainerNameCache.has(trainerUsername)) {
        return trainerNameCache.get(trainerUsername);
    }
    try {
        const response = await fetch(`/api/trainers?username=${encodeURIComponent(trainerUsername)}`);
        if (response.ok) {
            const trainers = await response.json();
            const trainer = Array.isArray(trainers)
                ? trainers.find(t => t.username === trainerUsername)
                : trainers;
            if (trainer?.name) {
                trainerNameCache.set(trainerUsername, trainer.name);
                return trainer.name;
            }
        }
    } catch (error) {
        // noop
    }
    trainerNameCache.set(trainerUsername, null);
    return null;
}

async function resolveTrainerNameForMember(currentUser) {
    if (!currentUser) return null;
    if (currentUser.trainer) {
        return resolveTrainerName(currentUser.trainer);
    }

    const memberName = currentUser.member_name || currentUser.name;
    if (!memberName) return null;

    try {
        const membersResponse = await fetch(`/api/members?name=${encodeURIComponent(memberName)}`);
        if (membersResponse.ok) {
            const members = await membersResponse.json();
            const member = members.find(m => m.name === memberName);
            if (member?.trainer) {
                return resolveTrainerName(member.trainer);
            }
        }
    } catch (error) {
        // noop
    }

    return null;
}

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
    
    // 백그라운드 프리로딩 시작 (await 하지 않음!)
    // 사용자가 캘린더를 보는 동안 데이터를 미리 로드
    preloadWorkoutData().catch(err => {
        console.error('[Workout] 프리로딩 실패:', err);
    });
    
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
        
        // 목록보기 버튼 클릭
        if (btnId === 'workout-list-btn') {
            if (eventType === 'touchstart') {
                return;
            }
            
            if (eventType !== 'touchend') {
                e.preventDefault();
            }
            e.stopPropagation();
            
            try {
                await showRecentListModal();
            } catch (error) {
                console.error('[Workout] 목록보기 버튼 클릭 오류:', error);
            }
            return;
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

        // 노트 버튼 클릭 (트레이너-회원)
        if (btnId === 'workout-note-btn') {
            if (eventType === 'touchstart') {
                return;
            }
            
            if (eventType !== 'touchend') {
                e.preventDefault();
            }
            e.stopPropagation();
            
            try {
                await showTrainerMemberNoteModal();
            } catch (error) {
                console.error('[Workout] 노트 버튼 클릭 오류:', error);
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
        
        // 운동 코멘트 버튼 클릭
        if (btnId === 'workout-comment-btn' && !isReadOnly) {
            if (eventType === 'touchstart') {
                return;
            }
            
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
                const { showWorkoutCommentModal } = await import('./comment.js');
                const selectedDateStr = getSelectedDate();
                const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
                const targetAppUserId = connectedMemberAppUserId || currentAppUserId;
                await showWorkoutCommentModal(targetAppUserId, selectedDateStr, (commentDate) => {
                    import('./list.js').then(module => {
                        module.refresh(commentDate);
                    });
                });
            } catch (error) {
                console.error('[Workout] 코멘트 버튼 클릭 오류:', error);
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
        memberDisplay = ` (${viewingTrainerName}님)`;
    }
    // connectedMemberAppUserId가 있는 경우는 병렬 호출에서 처리하므로 여기서는 처리하지 않음
    
    const currentUser = getCurrentUser();
    const isTrainer = currentUser?.is_trainer === true || currentUser?.isTrainer === true;
    const canLeaveComment = !isReadOnly && (connectedMemberAppUserId || !isTrainer);
    const trainerUsername = currentUser?.trainer;
    const isMemberView = !isTrainer && !connectedMemberAppUserId;
    const showMemberNoteButton = Boolean(isTrainer && connectedMemberAppUserId);
    let commentButtonLabel = '💬 운동 코멘트 남기기';
    if (canLeaveComment && isMemberView) {
        commentButtonLabel = '💬 트레이너에게 말걸기';
        if (trainerUsername) {
            const cachedTrainerName = trainerNameCache.get(trainerUsername);
            const displayName = cachedTrainerName || trainerUsername;
            commentButtonLabel = `💬 ${displayName} 트레이너에게 말걸기`;
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
                    ${showMemberNoteButton ? `<button class="app-workout-today-btn" id="workout-note-btn" title="회원 노트">노트</button>` : ''}
                    <button class="app-workout-today-btn" id="workout-list-btn" title="최근 30일 목록">목록</button>
                    <button class="app-workout-today-btn" id="workout-memo-btn" title="메모 보기">메모</button>
                </div>
            </div>
            <div id="workout-calendar-container"></div>
            <div class="app-workout-actions">
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
                            📝 간편 기록하기
                        </button>
                    </div>
                </div>
                ` : ''}
            ${canLeaveComment ? `
                <div class="app-workout-add-section">
                <button class="app-btn-secondary app-btn-full" id="workout-comment-btn">
                    ${commentButtonLabel}
                </button>
                </div>
                ` : ''}
            </div>
            <div id="workout-list-wrapper"></div>
        </div>
    `;
    
    if (canLeaveComment && isMemberView) {
        const commentBtn = document.getElementById('workout-comment-btn');
        if (commentBtn) {
            const resolvePromise = trainerUsername
                ? resolveTrainerName(trainerUsername)
                : resolveTrainerNameForMember(currentUser);
            resolvePromise.then(trainerName => {
                if (trainerName) {
                    commentBtn.textContent = `💬 ${trainerName} 트레이너에게 말걸기`;
                }
            });
        }
    }

    // 월 변경 감지를 위한 인터벌 (캘린더 스와이프 시 업데이트)
    setupMonthUpdateObserver();
    
    // 병렬 API 호출로 성능 최적화
    // 1. 앱 유저 정보 조회 (한 번만)
    // 2. 캘린더 데이터와 목록 데이터를 병렬로 로드
    // connectedMemberAppUserId는 위에서 이미 선언됨
    const targetAppUserId = connectedMemberAppUserId || currentAppUserId;
    
    if (!targetAppUserId) {
        console.error('운동기록 로드 오류: app_user_id가 없습니다.');
        return;
    }
    
    // 앱 유저 정보 조회 (한 번만, 다른 작업과 병렬)
    const appUserPromise = fetch(`/api/app-users/${targetAppUserId}`)
        .then(response => response.ok ? response.json() : null)
        .catch(error => {
            console.error('앱 유저 정보 조회 오류:', error);
            return null;
        });
    
    // 세션 데이터 로드 Promise 생성 (appUser가 필요하지만 병렬 처리 가능)
    const sessionsPromise = appUserPromise.then(async (appUser) => {
        if (!appUser || !appUser.member_name) {
            return [];
        }
        try {
            const { getToday } = await import('../utils.js');
            const today = getToday();
            const todayDate = new Date(today);
            const startDate = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
            const endDate = new Date(todayDate.getFullYear(), todayDate.getMonth() + 2, 0);
            
            const params = new URLSearchParams({
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                member: appUser.member_name
            });
            
            const sessionsResponse = await fetch(`/api/sessions?${params.toString()}`);
            if (sessionsResponse.ok) {
                return await sessionsResponse.json();
            }
            return [];
        } catch (error) {
            console.error('세션 데이터 조회 오류:', error);
            return [];
        }
    });
    
    // 1단계: 오늘 날짜 목록 데이터 + 캘린더 전체 summary를 병렬로 로드
    const { formatDate } = await import('../utils.js');
    const { getSelectedDate } = await import('./calendar.js');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pendingScreen = localStorage.getItem('pendingNavScreen');
    const pendingDate = localStorage.getItem('pendingNavDate');
    const selectedDateStr = (pendingScreen === 'workout' && pendingDate) ? pendingDate : getSelectedDate();
    const targetDate = selectedDateStr ? new Date(selectedDateStr) : today;
    const targetDateStr = formatDate(targetDate);
    
    try {
        const [appUser, calendarData, listData, sessions] = await Promise.all([
            appUserPromise,
            // 캘린더 전체 summary 로드 (경량이므로 빠름)
            loadWorkoutRecordsForCalendar(),
            // 오늘 날짜 목록 데이터만 먼저 로드
            (async () => {
                const listModule = await import('./list.js');
                if (currentAppUserId) {
                    await listModule.init(currentAppUserId, isReadOnly, {
                        startDate: targetDateStr,
                        endDate: targetDateStr
                    });
                }
                return listModule;
            })(),
            sessionsPromise
        ]);
        
        // memberDisplay 업데이트 (앱 유저 정보가 로드된 후)
        if (appUser && connectedMemberAppUserId && appUser.name) {
            memberDisplay = ` (${appUser.name}님)`;
            const monthDisplayEl = document.querySelector('.app-workout-month-display');
            if (monthDisplayEl) {
                monthDisplayEl.textContent = `${year}년 ${month}월${memberDisplay}`;
            }
        }
        
        // 세션 데이터를 list.js와 calendar.js에 전달 (트레이너 이름 매핑도 로드됨)
        await listData.updateSessions(sessions);
        
        // 캘린더에도 세션 데이터 업데이트
        const calendarContainer = document.getElementById('workout-calendar-container');
        if (calendarContainer) {
            const { updateSessions: updateCalendarSessions, render: renderCalendar } = await import('./calendar.js');
            updateCalendarSessions(sessions);
            renderCalendar(calendarContainer);
        }
        
        // 선택된 날짜로 필터링
        const selectedDateStr = getSelectedDate();
        if (selectedDateStr) {
            await listData.filterByDate(selectedDateStr);
        }
        if (pendingScreen === 'workout' && pendingDate) {
            localStorage.removeItem('pendingNavScreen');
            localStorage.removeItem('pendingNavDate');
        }
    } catch (error) {
        console.error('운동기록 로드 중 오류:', error);
    }
    
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
        memberDisplay = ` (${viewingTrainerName}님)`;
    } else if (connectedMemberAppUserId) {
        // 유저앱 회원 정보 조회하여 이름 표시
        try {
            const appUserResponse = await fetch(`/api/app-users/${connectedMemberAppUserId}`);
            if (appUserResponse.ok) {
                const appUser = await appUserResponse.json();
                memberDisplay = ` (${appUser.name}님)`;
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
 * 캘린더용 운동기록 로드 (병렬 호출을 위해 앱 유저 정보 조회 제거)
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
        
        // 캘린더 초기화
        const calendarContainer = document.getElementById('workout-calendar-container');
        if (calendarContainer) {
            const { init: initCalendar, updateWorkoutRecords, updateSessions, render: renderCalendar, setSelectedDate } = await import('./calendar.js');
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
            
            // 세션 데이터는 render()에서 로드 후 전달
            renderCalendar(calendarContainer);
            
            const pendingScreen = localStorage.getItem('pendingNavScreen');
            const pendingDate = localStorage.getItem('pendingNavDate');
            if (pendingScreen === 'workout' && pendingDate) {
                setSelectedDate(pendingDate);
                renderCalendar(calendarContainer);
            }
            
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
        
        return summary;
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
        return {};
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

async function showTrainerMemberNoteModal() {
    const currentUser = getCurrentUser();
    const trainerUsername = currentUser?.username || currentUser?.trainer || '';
    const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
    if (!trainerUsername || !connectedMemberAppUserId) {
        alert('회원 노트를 열 수 없습니다.');
        return;
    }
    
    const modalHtml = `
        <div class="app-modal-bg" id="workout-note-modal-bg">
            <div class="app-modal" id="workout-note-modal">
                <div class="app-modal-header">
                    <h2>회원 노트</h2>
                    <button class="app-modal-close-btn" id="workout-note-modal-close">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="app-modal-content" style="max-height: 70vh; overflow-y: auto; padding: 16px;">
                    <textarea id="workout-note-textarea" style="width: 100%; max-width: 100%; min-height: 210px; padding: 12px; border: 1px solid #ddd; border-radius: 8px; resize: vertical; font-size: 14px; line-height: 1.5; box-sizing: border-box;" placeholder="회원에 대한 노트를 입력하세요."></textarea>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 12px;">
                        <div id="workout-note-status" style="font-size: 12px; color: var(--app-text-muted);"></div>
                        <button class="app-btn-primary" id="workout-note-save-btn" style="padding: 8px 14px;">저장</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const existingModal = document.getElementById('workout-note-modal-bg');
    if (existingModal) {
        existingModal.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalBg = document.getElementById('workout-note-modal-bg');
    const modal = document.getElementById('workout-note-modal');
    const closeBtn = document.getElementById('workout-note-modal-close');
    const textarea = document.getElementById('workout-note-textarea');
    const saveBtn = document.getElementById('workout-note-save-btn');
    const statusEl = document.getElementById('workout-note-status');
    
    setTimeout(() => {
        modalBg.classList.add('app-modal-show');
        modal.classList.add('app-modal-show');
    }, 10);
    
    const closeModal = () => {
        modalBg.classList.remove('app-modal-show');
        modal.classList.remove('app-modal-show');
        document.removeEventListener('keydown', escHandler);
        setTimeout(() => {
            modalBg.remove();
        }, 300);
    };
    
    closeBtn.addEventListener('click', closeModal);
    modalBg.addEventListener('click', (e) => {
        if (e.target === modalBg) {
            closeModal();
        }
    });
    
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    };
    document.addEventListener('keydown', escHandler);
    
    try {
        const { getTrainerMemberNote, saveTrainerMemberNote } = await import('../api.js');
        const note = await getTrainerMemberNote(trainerUsername, connectedMemberAppUserId);
        if (textarea) {
            textarea.value = note?.content || '';
        }
        
        saveBtn.addEventListener('click', async () => {
            const content = textarea ? textarea.value : '';
            saveBtn.disabled = true;
            saveBtn.textContent = '저장중...';
            try {
                await saveTrainerMemberNote(trainerUsername, connectedMemberAppUserId, content);
                if (statusEl) {
                    statusEl.textContent = '저장됨';
                }
                closeModal();
            } catch (error) {
                console.error('[Workout] 노트 저장 오류:', error);
                if (statusEl) {
                    statusEl.textContent = '저장 실패';
                }
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = '저장';
            }
        });
    } catch (error) {
        console.error('[Workout] 노트 로드 오류:', error);
        if (statusEl) {
            statusEl.textContent = '노트를 불러오지 못했습니다.';
        }
    }
}

async function showRecentListModal() {
    let showErrorFn = null;
    try {
        const { getWorkoutRecords } = await import('../api.js');
        const { formatDate, getToday, showLoading, showError, formatDateShort, escapeHtml, formatWeight } = await import('../utils.js');
        showErrorFn = showError;
        
        const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
        const targetAppUserId = connectedMemberAppUserId || currentAppUserId;
        if (!targetAppUserId) {
            alert('사용자 정보를 찾을 수 없습니다.');
            return;
        }
        
        const todayStr = getToday();
        const today = new Date(todayStr);
        today.setHours(0, 0, 0, 0);
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 29);
        const startDateStr = formatDate(startDate);
        
        const modalHtml = `
            <div class="app-modal-bg" id="workout-list-modal-bg">
                <div class="app-modal" id="workout-list-modal">
                    <div class="app-modal-header">
                        <h2>최근 30일 운동기록</h2>
                        <button class="app-modal-close-btn" id="workout-list-modal-close">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="app-modal-content" style="max-height: 70vh; overflow-y: auto; padding: 16px;">
                        <div id="workout-recent-list-container"></div>
                    </div>
                </div>
            </div>
        `;
        
        const existingModal = document.getElementById('workout-list-modal-bg');
        if (existingModal) {
            existingModal.remove();
        }
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modalBg = document.getElementById('workout-list-modal-bg');
        const modal = document.getElementById('workout-list-modal');
        const closeBtn = document.getElementById('workout-list-modal-close');
        const content = document.getElementById('workout-recent-list-container');
        
        setTimeout(() => {
            modalBg.classList.add('app-modal-show');
            modal.classList.add('app-modal-show');
        }, 10);
        
        const closeModal = () => {
            modalBg.classList.remove('app-modal-show');
            modal.classList.remove('app-modal-show');
            document.removeEventListener('keydown', escHandler);
            setTimeout(() => {
                modalBg.remove();
            }, 300);
        };
        
        closeBtn.addEventListener('click', closeModal);
        modalBg.addEventListener('click', (e) => {
            if (e.target === modalBg) {
                closeModal();
            }
        });
        
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        };
        document.addEventListener('keydown', escHandler);
        
        if (content) {
            showLoading(content);
        }
        
        const records = await getWorkoutRecords(targetAppUserId, {
            startDate: startDateStr,
            endDate: todayStr
        });
        
        if (content) {
            renderRecentList(records, content, {
                formatDateShort,
                escapeHtml,
                formatWeight
            });
        }
    } catch (error) {
        console.error('최근 운동기록 모달 표시 오류:', error);
        const content = document.getElementById('workout-recent-list-container');
        if (content && showErrorFn) {
            showErrorFn(content, '운동기록을 불러오는 중 오류가 발생했습니다.');
        } else {
            alert('운동기록을 불러오는 중 오류가 발생했습니다.');
        }
    }
}

function renderRecentList(records, container, utils) {
    const { formatDateShort, escapeHtml, formatWeight } = utils;
    const safeRecords = Array.isArray(records) ? records : [];
    if (!container) return;
    if (safeRecords.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px 20px; color: var(--app-text-muted);">등록된 운동기록이 없습니다.</div>';
        return;
    }
    
    const groupedByDate = {};
    safeRecords.forEach(record => {
        let dateStr = record.workout_date;
        if (dateStr instanceof Date) {
            dateStr = dateStr.toISOString().split('T')[0];
        } else if (typeof dateStr === 'string') {
            dateStr = dateStr.split('T')[0];
        }
        if (!groupedByDate[dateStr]) {
            groupedByDate[dateStr] = [];
        }
        groupedByDate[dateStr].push(record);
    });
    
    const dates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));
    let html = '<div class="app-workout-list">';
    dates.forEach(dateStr => {
        const dateObj = new Date(dateStr);
        const dateRecords = groupedByDate[dateStr] || [];
        const volumeInfo = calculateRecentListVolume(dateRecords);
        const summaryText = volumeInfo.hasVolume
            ? `볼륨 : ${formatRecentListVolume(volumeInfo.total)}`
            : `${dateRecords.length}건`;
        html += `
            <div class="app-workout-date-section">
                <div class="app-workout-date-header">
                    <div class="app-workout-date-left">
                        <h3 class="app-workout-date-title">${formatDateShort(dateObj)}</h3>
                        <span class="app-workout-date-count">${summaryText}</span>
                    </div>
                </div>
                <div class="app-workout-items">
        `;
        dateRecords.forEach(record => {
            html += renderRecentListItem(record, { escapeHtml, formatWeight });
        });
        html += '</div></div>';
    });
    html += '</div>';
    container.innerHTML = html;
}

function formatRecentListVolume(total) {
    if (!isFinite(total) || total <= 0) {
        return '0kg';
    }
    const rounded = Math.round(total * 10) / 10;
    const hasDecimal = !Number.isInteger(rounded);
    const formatted = rounded.toLocaleString('en-US', {
        minimumFractionDigits: hasDecimal ? 1 : 0,
        maximumFractionDigits: hasDecimal ? 1 : 0
    });
    return `${formatted}kg`;
}

function calculateRecentListVolume(records = []) {
    let total = 0;
    let hasVolume = false;
    records.forEach(record => {
        let sets = [];
        if (Array.isArray(record.sets)) {
            sets = record.sets;
        } else if (typeof record.sets === 'string') {
            try {
                const parsed = JSON.parse(record.sets);
                if (Array.isArray(parsed)) {
                    sets = parsed;
                }
            } catch (error) {
                // ignore parse errors
            }
        }
        if (sets.length > 0) {
            hasVolume = true;
        }
        sets.forEach(set => {
            const weight = parseFloat(set.weight);
            const reps = parseFloat(set.reps);
            if (isFinite(weight) && isFinite(reps)) {
                total += weight * reps;
                hasVolume = true;
            }
        });
    });
    return { hasVolume, total };
}

function renderRecentListItem(record, utils) {
    const { escapeHtml, formatWeight } = utils;
    const workoutTypeName = escapeHtml(record.workout_type_name || record.text_content || '미지정');
    const workoutTypeType = record.workout_type_type || null;
    const notes = record.notes ? escapeHtml(record.notes) : '';
    const sets = record.sets || [];
    const duration = record.duration_minutes ? `${record.duration_minutes}분` : null;
    
    if (record.is_text_record) {
        const textContent = record.text_content ? escapeHtml(record.text_content) : '';
        return `
            <div class="app-workout-item app-workout-item-text" data-record-id="${record.id}">
                <div class="app-workout-item-main app-workout-item-main-text">
                    <div class="app-workout-item-type-container app-workout-item-type-container-text" style="flex-direction: column; align-items: flex-start; gap: 4px;">
                        <div class="app-workout-item-text-content" style="white-space: pre-line; word-wrap: break-word; word-break: break-word;">${textContent}</div>
                    </div>
                </div>
                ${notes ? `<div class="app-workout-item-notes">${notes}</div>` : ''}
            </div>
        `;
    }
    
    let infoHtml = '';
    if (workoutTypeType === '시간' && duration) {
        infoHtml = `<div class="app-workout-item-duration-container"><span class="app-workout-item-duration">⏱ ${duration}</span></div>`;
    } else if (workoutTypeType === '세트' && sets.length > 0) {
        const setsInfo = sets.map(set => {
            const weight = formatWeight(set.weight);
            const reps = set.reps !== null && set.reps !== undefined ? `${set.reps}회` : '-';
            return `
                <div class="app-workout-item-set-row" style="display: flex; align-items: center; gap: 8px;">
                    <span class="app-workout-item-set-number">${set.set_number}</span>
                    <span class="app-workout-item-set-info">${weight} × ${reps}</span>
                </div>
            `;
        }).join('');
        infoHtml = `<div class="app-workout-item-sets">${setsInfo}</div>`;
    }
    
    return `
        <div class="app-workout-item" data-record-id="${record.id}">
            <div class="app-workout-item-main">
                <div class="app-workout-item-type-container" style="flex-direction: column; align-items: flex-start; gap: 4px;">
                    <div class="app-workout-item-type">${workoutTypeName}</div>
                </div>
                ${infoHtml ? `<div class="app-workout-item-info">${infoHtml}</div>` : ''}
            </div>
            ${notes ? `<div class="app-workout-item-notes">${notes}</div>` : ''}
        </div>
    `;
}
