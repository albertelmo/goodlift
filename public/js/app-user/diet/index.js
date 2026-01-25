// 식단기록 메인 화면

import { init as initList } from './list.js';
import { showDietAddModal } from './add.js';
import { init as initCalendar, getSelectedDate, getCurrentMonth } from './calendar.js';

let currentAppUserId = null;
let isReadOnly = false;
let lastButtonClickTime = 0; // 버튼 클릭 중복 방지용
const BUTTON_CLICK_THROTTLE = 300; // 300ms 내 중복 클릭 방지

/**
 * 식단기록 화면 초기화
 */
export async function init(appUserId, readOnly = false) {
    currentAppUserId = appUserId;
    isReadOnly = readOnly;
    
    // 헤더 숨기기
    const header = document.querySelector('.app-header');
    if (header) {
        header.style.display = 'none';
    }
    
    // 버튼 이벤트 위임 리스너 설정
    setupButtonEventListeners();
    
    await render();
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
    if (container._dietButtonEventListenersSetup) {
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
            e.preventDefault();
            return;
        }
        
        if (eventType === 'touchend') {
            e.preventDefault();
            e.stopPropagation();
        }
        
        // 오늘 버튼 클릭
        if (btnId === 'diet-today-btn') {
            if (eventType === 'touchstart') {
                return;
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
                await loadDietRecordsForCalendar();
                await updateMonthDisplay();
                
                const todayStr = formatDate(today);
                const listModule = await import('./list.js');
                await listModule.filterByDate(todayStr);
            } catch (error) {
                console.error('[Diet] 오늘 버튼 클릭 오류:', error);
            }
            return;
        }
        
        // 내 기록으로 돌아가기 버튼 클릭
        if (btnId === 'diet-back-btn') {
            if (eventType === 'touchstart') {
                return;
            }
            
            if (eventType !== 'touchend') {
                e.preventDefault();
            }
            e.stopPropagation();
            
            try {
                const isReadOnlyMode = localStorage.getItem('isReadOnly') === 'true';
                const viewingTrainerName = localStorage.getItem('viewingTrainerName');
                
                if (isReadOnlyMode && viewingTrainerName) {
                    localStorage.removeItem('viewingTrainerAppUserId');
                    localStorage.removeItem('isReadOnly');
                    localStorage.removeItem('viewingTrainerName');
                    
                    const { navigateToScreen } = await import('../index.js');
                    navigateToScreen('diet');
                }
            } catch (error) {
                console.error('[Diet] 돌아가기 버튼 클릭 오류:', error);
            }
            return;
        }
        
        // 식단 추가하기 버튼 클릭
        if (btnId === 'diet-add-btn' && !isReadOnly) {
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
                const selectedDateStr = getSelectedDate();
                showDietAddModal(currentAppUserId, selectedDateStr, () => {
                    import('./list.js').then(module => {
                        module.refresh();
                    });
                });
            } catch (error) {
                console.error('[Diet] 식단 추가 버튼 클릭 오류:', error);
            }
            return;
        }
    };
    
    // 여러 이벤트 타입 처리
    container.addEventListener('click', handler, true);
    container.addEventListener('click', handler, false);
    container.addEventListener('touchstart', handler, true);
    container.addEventListener('touchend', handler, true);
    container.addEventListener('pointerdown', handler, true);
    
    container._dietButtonEventListenersSetup = true;
}

/**
 * 식단기록 화면 렌더링
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
    
    // 연결된 회원 정보 확인
    const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
    const viewingTrainerName = localStorage.getItem('viewingTrainerName');
    let memberDisplay = '';
    
    if (viewingTrainerName) {
        memberDisplay = ` (${viewingTrainerName} 트레이너의 식단기록)`;
    }
    // connectedMemberAppUserId가 있는 경우는 병렬 호출에서 처리하므로 여기서는 처리하지 않음
    
    // 뒤로가기 버튼 (트레이너 기록을 볼 때만 표시)
    const backButton = isReadOnly && viewingTrainerName ? `
        <div class="app-diet-add-section">
            <button class="app-btn-primary app-btn-full" id="diet-back-btn" title="내 기록으로 돌아가기">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                내 기록으로 돌아가기
            </button>
        </div>
    ` : '';
    
    container.innerHTML = `
        <div class="app-diet-screen">
            <div class="app-diet-top-bar">
                <div class="app-diet-month-display">${year}년 ${month}월${memberDisplay}</div>
                <div class="app-diet-top-buttons">
                    <button class="app-diet-today-btn" id="diet-today-btn" title="오늘로 이동">오늘</button>
                </div>
            </div>
            <div id="diet-calendar-container"></div>
            ${backButton}
            ${!isReadOnly ? `
            <div class="app-diet-add-section">
                <button class="app-btn-primary app-btn-full" id="diet-add-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    식단 추가하기
                </button>
            </div>
            ` : ''}
            <div id="diet-list-wrapper"></div>
        </div>
    `;
    
    // 월 변경 감지 설정
    setupMonthUpdateObserver();
    
    // 병렬 API 호출로 성능 최적화
    // 1. 앱 유저 정보 조회 (한 번만)
    // 2. 캘린더 데이터와 목록 데이터를 병렬로 로드
    // connectedMemberAppUserId는 위에서 이미 선언됨
    const targetAppUserId = connectedMemberAppUserId || currentAppUserId;
    
    if (!targetAppUserId) {
        console.error('식단기록 로드 오류: app_user_id가 없습니다.');
        return;
    }
    
    // 앱 유저 정보 조회 (한 번만, 다른 작업과 병렬)
    const appUserPromise = fetch(`/api/app-users/${targetAppUserId}`)
        .then(response => response.ok ? response.json() : null)
        .catch(error => {
            console.error('앱 유저 정보 조회 오류:', error);
            return null;
        });
    
    // 1단계: 오늘 날짜 목록 데이터 + 캘린더 전체 summary를 병렬로 로드
    const { formatDate } = await import('../utils.js');
    const { getSelectedDate } = await import('./calendar.js');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateStr = getSelectedDate();
    const targetDate = selectedDateStr ? new Date(selectedDateStr) : today;
    const targetDateStr = formatDate(targetDate);
    
    // 캘린더 데이터와 목록 데이터를 병렬로 로드
    try {
        const [appUser, calendarData, listData] = await Promise.all([
            appUserPromise,
            // 캘린더 전체 summary 로드 (경량이므로 빠름)
            loadDietRecordsForCalendar(),
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
            })()
        ]);
        
        // memberDisplay 업데이트 (앱 유저 정보가 로드된 후)
        if (appUser && connectedMemberAppUserId && appUser.name) {
            memberDisplay = ` (${appUser.name}님의 식단기록)`;
            const monthDisplayEl = document.querySelector('.app-diet-month-display');
            if (monthDisplayEl) {
                monthDisplayEl.textContent = `${year}년 ${month}월${memberDisplay}`;
            }
        }
        
        // 선택된 날짜로 필터링
        const selectedDateStr = getSelectedDate();
        if (selectedDateStr && listData) {
            await listData.filterByDate(selectedDateStr);
        }
    } catch (error) {
        console.error('식단기록 로드 중 오류:', error);
    }
}

/**
 * 상단 연월 표시 업데이트
 */
async function updateMonthDisplay() {
    const currentMonth = getCurrentMonth();
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    
    const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
    const viewingTrainerName = localStorage.getItem('viewingTrainerName');
    let memberDisplay = '';
    
    if (viewingTrainerName) {
        memberDisplay = ` (${viewingTrainerName} 트레이너의 식단기록)`;
    } else if (connectedMemberAppUserId) {
        try {
            const appUserResponse = await fetch(`/api/app-users/${connectedMemberAppUserId}`);
            if (appUserResponse.ok) {
                const appUser = await appUserResponse.json();
                memberDisplay = ` (${appUser.name}님의 식단기록)`;
            }
        } catch (error) {
            console.error('앱 유저 정보 조회 오류:', error);
        }
    }
    
    const monthDisplay = document.querySelector('.app-diet-month-display');
    if (monthDisplay) {
        monthDisplay.textContent = `${year}년 ${month}월${memberDisplay}`;
    }
}

/**
 * 월 변경 감지 설정
 */
function setupMonthUpdateObserver() {
    const observer = new MutationObserver(async () => {
        await updateMonthDisplay();
    });
    
    const calendarContainer = document.getElementById('diet-calendar-container');
    if (calendarContainer) {
        observer.observe(calendarContainer, { childList: true, subtree: true });
    }
    
    setInterval(async () => {
        await updateMonthDisplay();
    }, 500);
}

/**
 * 캘린더용 식단기록 로드
 */
async function loadDietRecordsForCalendar() {
    try {
        const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
        const targetAppUserId = connectedMemberAppUserId || currentAppUserId;
        
        if (!targetAppUserId) {
            console.error('식단기록 로드 오류: app_user_id가 없습니다.');
            throw new Error('사용자 ID가 없습니다.');
        }
        
        const { getDietRecordsForCalendar } = await import('../api.js');
        const { getToday } = await import('../utils.js');
        const today = getToday();
        const todayDate = new Date(today);
        const startDate = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
        const endDate = new Date(todayDate.getFullYear(), todayDate.getMonth() + 2, 0);
        
        const summary = await getDietRecordsForCalendar(
            targetAppUserId,
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
        );
        
        // 캘린더 초기화
        const calendarContainer = document.getElementById('diet-calendar-container');
        if (calendarContainer) {
            const { init: initCalendar, updateDietRecords, render: renderCalendar } = await import('./calendar.js');
            initCalendar(calendarContainer, async (selectedDate) => {
                if (selectedDate) {
                    const { formatDate } = await import('../utils.js');
                    const selectedDateStr = formatDate(selectedDate);
                    const listModule = await import('./list.js');
                    await listModule.filterByDate(selectedDateStr);
                }
                await updateMonthDisplay();
            }, summary);
            
            renderCalendar(calendarContainer);
            
            // 식단기록 업데이트 함수를 전역에 저장
            window.updateCalendarDietRecords = async () => {
                const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
                const targetAppUserId = connectedMemberAppUserId || currentAppUserId;
                if (!targetAppUserId) {
                    return;
                }
                const { getDietRecordsForCalendar } = await import('../api.js');
                const { getToday } = await import('../utils.js');
                const today = getToday();
                const todayDate = new Date(today);
                const startDate = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
                const endDate = new Date(todayDate.getFullYear(), todayDate.getMonth() + 2, 0);
                
                const updatedSummary = await getDietRecordsForCalendar(
                    targetAppUserId,
                    startDate.toISOString().split('T')[0],
                    endDate.toISOString().split('T')[0]
                );
                updateDietRecords(updatedSummary);
                renderCalendar(calendarContainer);
            };
        }
    } catch (error) {
        console.error('식단기록 로드 오류:', error);
        const calendarContainer = document.getElementById('diet-calendar-container');
        if (calendarContainer) {
            const { init: initCalendar } = await import('./calendar.js');
            initCalendar(calendarContainer, (selectedDate) => {
                updateMonthDisplay();
            }, {});
        }
    }
}
