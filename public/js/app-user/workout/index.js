// 운동기록 메인 화면

import { init as initList } from './list.js';
import { showWorkoutSelectModal } from './add.js';
import { init as initCalendar, getSelectedDate, getCurrentMonth } from './calendar.js';

let currentAppUserId = null;

/**
 * 운동기록 화면 초기화
 */
export function init(appUserId) {
    currentAppUserId = appUserId;
    
    // 헤더 숨기기
    const header = document.querySelector('.app-header');
    if (header) {
        header.style.display = 'none';
    }
    
    render();
}

/**
 * 운동기록 화면 렌더링
 */
function render() {
    const container = document.getElementById('app-user-content');
    if (!container) return;
    
    // 현재 월 가져오기
    const currentMonth = getCurrentMonth();
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    
    container.innerHTML = `
        <div class="app-workout-screen">
            <div class="app-workout-top-bar">
                <div class="app-workout-month-display">${year}년 ${month}월</div>
                <button class="app-workout-today-btn" id="workout-today-btn" title="오늘로 이동">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                </button>
            </div>
            <div id="workout-calendar-container"></div>
            <div class="app-workout-add-section">
                <button class="app-btn-primary app-btn-full" id="workout-add-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    운동 추가하기
                </button>
            </div>
            <div id="workout-list-wrapper"></div>
        </div>
    `;
    
    // 월 변경 감지를 위한 인터벌 (캘린더 스와이프 시 업데이트)
    setupMonthUpdateObserver();
    
    // 오늘로 이동 버튼
    const todayBtn = document.getElementById('workout-today-btn');
    if (todayBtn) {
        todayBtn.addEventListener('click', async () => {
            const { getCurrentMonth, setSelectedDate, setCurrentMonth } = await import('./calendar.js');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // 캘린더에 오늘 날짜 설정
            setSelectedDate(today);
            setCurrentMonth(today);
            
            // 캘린더 다시 렌더링
            await loadWorkoutRecordsForCalendar();
            
            // 상단 연월 표시 업데이트
            updateMonthDisplay();
        });
    }
    
    // 캘린더용 운동기록 로드 (먼저 실행하여 캘린더에 데이터 전달)
    loadWorkoutRecordsForCalendar().then(() => {
        // 운동 목록 초기화 (선택된 날짜로 필터링)
        initList(currentAppUserId);
        const selectedDateStr = getSelectedDate();
        if (selectedDateStr) {
            import('./list.js').then(module => {
                module.filterByDate(selectedDateStr);
            });
        }
    });
    
    // 추가 버튼 이벤트
    const addBtn = document.getElementById('workout-add-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const selectedDateStr = getSelectedDate();
            showWorkoutSelectModal(currentAppUserId, selectedDateStr, () => {
                // 추가 성공 후 목록 새로고침
                import('./list.js').then(module => {
                    module.refresh();
                });
            });
        });
    }
}

/**
 * 상단 연월 표시 업데이트
 */
function updateMonthDisplay() {
    const currentMonth = getCurrentMonth();
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    
    const monthDisplay = document.querySelector('.app-workout-month-display');
    if (monthDisplay) {
        monthDisplay.textContent = `${year}년 ${month}월`;
    }
}

/**
 * 월 변경 감지 설정
 */
function setupMonthUpdateObserver() {
    // 캘린더가 다시 렌더링될 때마다 상단 연월 업데이트
    const observer = new MutationObserver(() => {
        updateMonthDisplay();
    });
    
    const calendarContainer = document.getElementById('workout-calendar-container');
    if (calendarContainer) {
        observer.observe(calendarContainer, { childList: true, subtree: true });
    }
    
    // 주기적으로도 체크 (스와이프 후 업데이트)
    setInterval(() => {
        updateMonthDisplay();
    }, 500);
}

/**
 * 캘린더용 운동기록 로드
 */
async function loadWorkoutRecordsForCalendar() {
    try {
        const { getWorkoutRecords } = await import('../api.js');
        const records = await getWorkoutRecords(currentAppUserId);
        
        // 캘린더 초기화
        const calendarContainer = document.getElementById('workout-calendar-container');
        if (calendarContainer) {
            const { init: initCalendar, updateWorkoutRecords, render: renderCalendar } = await import('./calendar.js');
            initCalendar(calendarContainer, async (selectedDate) => {
                // 날짜 선택 시 목록 필터링
                if (selectedDate) {
                    const { formatDate } = await import('../utils.js');
                    const selectedDateStr = formatDate(selectedDate);
                    import('./list.js').then(module => {
                        module.filterByDate(selectedDateStr);
                    });
                }
                // 월이 변경되면 상단 연월 표시 업데이트
                updateMonthDisplay();
            }, records);
            
            // 운동기록 업데이트 함수를 전역에 저장 (목록 새로고침 시 사용)
            window.updateCalendarWorkoutRecords = async () => {
                const updatedRecords = await getWorkoutRecords(currentAppUserId);
                updateWorkoutRecords(updatedRecords);
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
