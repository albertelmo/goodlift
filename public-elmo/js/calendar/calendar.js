// Elmo 캘린더 컴포넌트

let selectedDate = null;
let currentMonth = new Date();
let onDateSelectCallback = null;
let recordsByDate = {}; // 날짜별 기록 데이터

/**
 * 날짜 포맷팅 (YYYY-MM-DD)
 */
function formatDate(date) {
    if (!date) return null;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 캘린더 초기화
 */
export function init(container, onDateSelect, recordsOrSummary = {}) {
    onDateSelectCallback = onDateSelect;
    selectedDate = new Date();
    selectedDate.setHours(0, 0, 0, 0);
    currentMonth = new Date(selectedDate);
    
    // 기록 데이터 업데이트
    updateRecords(recordsOrSummary);
    
    render(container);
}

/**
 * 기록 데이터 업데이트
 */
export function updateRecords(recordsOrSummary) {
    if (recordsOrSummary && typeof recordsOrSummary === 'object' && !Array.isArray(recordsOrSummary)) {
        // 날짜 키를 정규화 (YYYY-MM-DD 형식으로)
        recordsByDate = {};
        Object.keys(recordsOrSummary).forEach(key => {
            const normalizedKey = key.split('T')[0]; // 시간 부분 제거
            recordsByDate[normalizedKey] = recordsOrSummary[key];
        });
    } else {
        recordsByDate = {};
    }
}

/**
 * 캘린더 렌더링
 */
export function render(container) {
    if (!container) {
        return;
    }
    
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // 해당 월의 첫 날과 마지막 날
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDay.getDay(); // 0 (일요일) ~ 6 (토요일)
    const daysInMonth = lastDay.getDate();
    
    // 오늘 날짜
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let html = `
        <div class="elmo-calendar" id="elmo-calendar-swipe">
            <div class="elmo-calendar-weekdays">
                <div class="elmo-calendar-weekday">일</div>
                <div class="elmo-calendar-weekday">월</div>
                <div class="elmo-calendar-weekday">화</div>
                <div class="elmo-calendar-weekday">수</div>
                <div class="elmo-calendar-weekday">목</div>
                <div class="elmo-calendar-weekday">금</div>
                <div class="elmo-calendar-weekday">토</div>
            </div>
            <div class="elmo-calendar-days">
    `;
    
    // 빈 칸 (첫 날 이전) - 이전달 날짜 표시
    if (firstDayOfWeek > 0) {
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        const prevMonthLastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
        
        for (let i = 0; i < firstDayOfWeek; i++) {
            const prevDay = prevMonthLastDay - firstDayOfWeek + i + 1;
            const prevDate = new Date(prevYear, prevMonth, prevDay);
            prevDate.setHours(0, 0, 0, 0);
            const prevDateStr = formatDate(prevDate);
            const recordInfo = getRecordInfoForDate(prevDateStr);
            const hasRecord = recordInfo.hasRecord;
            
            let dayClass = 'elmo-calendar-day elmo-calendar-day-empty';
            if (hasRecord) {
                dayClass += ' elmo-calendar-day-has-record';
            }
            
            html += `
                <div class="${dayClass}" data-date="${prevDateStr}" data-year="${prevYear}" data-month="${prevMonth}">
                    <span class="elmo-calendar-day-number">${prevDay}</span>
                </div>
            `;
        }
    }
    
    // 날짜들
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        date.setHours(0, 0, 0, 0);
        
        const isToday = date.getTime() === today.getTime();
        const isSelected = selectedDate && date.getTime() === selectedDate.getTime();
        const dayOfWeek = date.getDay();
        const isSunday = dayOfWeek === 0;
        const isSaturday = dayOfWeek === 6;
        const dateStr = formatDate(date);
        const recordInfo = getRecordInfoForDate(dateStr);
        const hasRecord = recordInfo.hasRecord;
        
        let dayClass = 'elmo-calendar-day';
        if (isToday) dayClass += ' elmo-calendar-day-today';
        if (isSelected) dayClass += ' elmo-calendar-day-selected';
        if (isSunday) dayClass += ' elmo-calendar-day-sunday';
        if (isSaturday) dayClass += ' elmo-calendar-day-saturday';
        if (hasRecord) {
            dayClass += ' elmo-calendar-day-has-record';
        }
        
        html += `
            <div class="${dayClass}" data-date="${dateStr}">
                <span class="elmo-calendar-day-number">${day}</span>
            </div>
        `;
    }
    
    // 빈 칸 (마지막 날 이후) - 다음달 날짜 표시
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const lastDayOfWeek = lastDay.getDay();
    
    if (lastDayOfWeek < 6) {
        const daysToAdd = 6 - lastDayOfWeek;
        for (let i = 1; i <= daysToAdd; i++) {
            const nextDate = new Date(nextYear, nextMonth, i);
            nextDate.setHours(0, 0, 0, 0);
            const nextDateStr = formatDate(nextDate);
            const recordInfo = getRecordInfoForDate(nextDateStr);
            const hasRecord = recordInfo.hasRecord;
            
            let dayClass = 'elmo-calendar-day elmo-calendar-day-empty';
            if (hasRecord) {
                dayClass += ' elmo-calendar-day-has-record';
            }
            
            html += `
                <div class="${dayClass}" data-date="${nextDateStr}" data-year="${nextYear}" data-month="${nextMonth}">
                    <span class="elmo-calendar-day-number">${i}</span>
                </div>
            `;
        }
    }
    
    html += `
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // 이벤트 리스너
    setupEventListeners();
}

/**
 * 날짜별 기록 정보 가져오기
 */
function getRecordInfoForDate(dateStr) {
    // 날짜 문자열 정규화 (YYYY-MM-DD 형식으로)
    const normalizedDate = dateStr ? dateStr.split('T')[0] : null;
    
    if (!normalizedDate) {
        return { hasRecord: false, count: 0 };
    }
    
    const data = recordsByDate[normalizedDate];
    
    if (!data) {
        return { hasRecord: false, count: 0 };
    }
    
    if (typeof data === 'object' && 'hasRecord' in data) {
        return {
            hasRecord: data.hasRecord || false,
            count: data.count || 0
        };
    }
    
    return { hasRecord: false, count: 0 };
}

/**
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
    // 스와이프 제스처 설정
    setupSwipeGesture();
    
    // 날짜 클릭
    const dayElements = document.querySelectorAll('.elmo-calendar-day');
    dayElements.forEach(dayEl => {
        dayEl.addEventListener('click', () => {
            const isEmpty = dayEl.classList.contains('elmo-calendar-day-empty');
            
            if (isEmpty) {
                // 빈 날짜(이전달/다음달) 클릭 시 해당 월로 이동하고 날짜 선택
                const year = parseInt(dayEl.getAttribute('data-year'));
                const month = parseInt(dayEl.getAttribute('data-month'));
                const dateStr = dayEl.getAttribute('data-date');
                if (!isNaN(year) && !isNaN(month) && dateStr) {
                    selectedDate = new Date(dateStr);
                    selectedDate.setHours(0, 0, 0, 0);
                    currentMonth = new Date(year, month, 1);
                    const container = document.querySelector('.elmo-calendar')?.parentElement;
                    if (container) {
                        render(container);
                    }
                    if (onDateSelectCallback) {
                        onDateSelectCallback(selectedDate);
                    }
                }
            } else {
                // 현재 달 날짜 클릭 시 선택
                const dateStr = dayEl.getAttribute('data-date');
                if (dateStr) {
                    selectedDate = new Date(dateStr);
                    selectedDate.setHours(0, 0, 0, 0);
                    
                    if (selectedDate.getMonth() !== currentMonth.getMonth() || 
                        selectedDate.getFullYear() !== currentMonth.getFullYear()) {
                        currentMonth = new Date(selectedDate);
                    }
                    
                    const container = document.querySelector('.elmo-calendar')?.parentElement;
                    if (container) {
                        render(container);
                    }
                    
                    if (onDateSelectCallback) {
                        onDateSelectCallback(selectedDate);
                    }
                }
            }
        });
    });
}

/**
 * 스와이프 제스처 설정
 */
function setupSwipeGesture() {
    const calendar = document.getElementById('elmo-calendar-swipe');
    if (!calendar) return;
    
    let touchStartX = 0;
    let touchEndX = 0;
    const minSwipeDistance = 50;
    
    calendar.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    calendar.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });
    
    function handleSwipe() {
        const swipeDistance = touchEndX - touchStartX;
        
        if (swipeDistance > minSwipeDistance) {
            currentMonth.setMonth(currentMonth.getMonth() - 1);
            const container = document.querySelector('.elmo-calendar').parentElement;
            // 월 변경 시 요약 다시 로드
            loadSummaryAndRender(container);
        } else if (swipeDistance < -minSwipeDistance) {
            currentMonth.setMonth(currentMonth.getMonth() + 1);
            const container = document.querySelector('.elmo-calendar').parentElement;
            // 월 변경 시 요약 다시 로드
            loadSummaryAndRender(container);
        }
    }
    
    async function loadSummaryAndRender(container) {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth() + 1;
        
        // 월 표시 업데이트
        const monthDisplay = document.getElementById('elmo-calendar-month-display');
        if (monthDisplay) {
            monthDisplay.textContent = `${year}년 ${month}월`;
        }
        
        // 요약 로드 (index.js에서 export된 함수 사용)
        try {
            const indexModule = await import('./index.js');
            const summary = await indexModule.loadCalendarSummary(year, month);
            updateRecords(summary);
            render(container);
        } catch (error) {
            console.error('요약 로드 오류:', error);
            render(container);
        }
    }
}

/**
 * 선택된 날짜 가져오기
 */
export function getSelectedDate() {
    return selectedDate ? formatDate(selectedDate) : null;
}

/**
 * 선택된 날짜 설정
 */
export function setSelectedDate(date) {
    if (date) {
        selectedDate = new Date(date);
        selectedDate.setHours(0, 0, 0, 0);
        currentMonth = new Date(selectedDate);
    }
}

/**
 * 현재 월 가져오기
 */
export function getCurrentMonth() {
    return new Date(currentMonth);
}

/**
 * 현재 월 설정
 */
export function setCurrentMonth(date) {
    if (date) {
        currentMonth = new Date(date);
        currentMonth.setDate(1);
        currentMonth.setHours(0, 0, 0, 0);
    }
}
