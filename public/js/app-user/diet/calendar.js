// 식단기록 캘린더 컴포넌트

import { formatDate } from '../utils.js';

let selectedDate = null;
let currentMonth = new Date();
let onDateSelectCallback = null;
let dietRecordsByDate = {}; // 날짜별 식단기록 데이터

/**
 * 캘린더 초기화
 */
export function init(container, onDateSelect, dietRecordsOrSummary = {}) {
    onDateSelectCallback = onDateSelect;
    selectedDate = new Date();
    selectedDate.setHours(0, 0, 0, 0);
    currentMonth = new Date(selectedDate);
    
    // 식단기록 데이터 업데이트 (summary 형식)
    updateDietRecords(dietRecordsOrSummary);
    
    render(container);
}

/**
 * 식단기록 데이터 업데이트 (경량 summary 형식)
 */
export function updateDietRecords(dietRecordsOrSummary) {
    // summary 형식: { '2024-01-01': { hasDiet: true, count: 3 }, ... }
    if (dietRecordsOrSummary && typeof dietRecordsOrSummary === 'object' && !Array.isArray(dietRecordsOrSummary)) {
        dietRecordsByDate = dietRecordsOrSummary;
    } else {
        dietRecordsByDate = {};
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
        <div class="app-calendar" id="app-calendar-swipe">
            <div class="app-calendar-weekdays">
                <div class="app-calendar-weekday">일</div>
                <div class="app-calendar-weekday">월</div>
                <div class="app-calendar-weekday">화</div>
                <div class="app-calendar-weekday">수</div>
                <div class="app-calendar-weekday">목</div>
                <div class="app-calendar-weekday">금</div>
                <div class="app-calendar-weekday">토</div>
            </div>
            <div class="app-calendar-days">
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
            const dietInfo = getDietInfoForDate(prevDateStr);
            const hasDiet = dietInfo.hasDiet;
            
            let dayClass = 'app-calendar-day app-calendar-day-empty';
            if (hasDiet) {
                dayClass += ' app-calendar-day-has-workout'; // 운동기록과 동일한 CSS 클래스 사용
            }
            
            html += `
                <div class="${dayClass}" data-date="${prevDateStr}" data-year="${prevYear}" data-month="${prevMonth}">
                    <span class="app-calendar-day-number">${prevDay}</span>
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
        const dietInfo = getDietInfoForDate(dateStr);
        const hasDiet = dietInfo.hasDiet;
        
        let dayClass = 'app-calendar-day';
        if (isToday) dayClass += ' app-calendar-day-today';
        if (isSelected) dayClass += ' app-calendar-day-selected';
        if (isSunday) dayClass += ' app-calendar-day-sunday';
        if (isSaturday) dayClass += ' app-calendar-day-saturday';
        if (hasDiet) {
            dayClass += ' app-calendar-day-has-workout'; // 운동기록과 동일한 CSS 클래스 사용
        }
        
        html += `
            <div class="${dayClass}" data-date="${dateStr}">
                <span class="app-calendar-day-number">${day}</span>
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
            const dietInfo = getDietInfoForDate(nextDateStr);
            const hasDiet = dietInfo.hasDiet;
            
            let dayClass = 'app-calendar-day app-calendar-day-empty';
            if (hasDiet) {
                dayClass += ' app-calendar-day-has-workout';
            }
            
            html += `
                <div class="${dayClass}" data-date="${nextDateStr}" data-year="${nextYear}" data-month="${nextMonth}">
                    <span class="app-calendar-day-number">${i}</span>
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
 * 날짜별 식단기록 정보 가져오기 (경량 summary 형식)
 */
function getDietInfoForDate(dateStr) {
    const data = dietRecordsByDate[dateStr];
    
    if (!data) {
        return { hasDiet: false, count: 0 };
    }
    
    // summary 형식: { hasDiet: true, count: 3 }
    if (typeof data === 'object' && 'hasDiet' in data) {
        return {
            hasDiet: data.hasDiet || false,
            count: data.count || 0
        };
    }
    
    return { hasDiet: false, count: 0 };
}

/**
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
    // 스와이프 제스처 설정
    setupSwipeGesture();
    
    // 날짜 클릭
    const dayElements = document.querySelectorAll('.app-calendar-day');
    dayElements.forEach(dayEl => {
        dayEl.addEventListener('click', () => {
            const isEmpty = dayEl.classList.contains('app-calendar-day-empty');
            
            if (isEmpty) {
                // 빈 날짜(이전달/다음달) 클릭 시 해당 월로 이동하고 날짜 선택
                const year = parseInt(dayEl.getAttribute('data-year'));
                const month = parseInt(dayEl.getAttribute('data-month'));
                const dateStr = dayEl.getAttribute('data-date');
                if (!isNaN(year) && !isNaN(month) && dateStr) {
                    selectedDate = new Date(dateStr);
                    selectedDate.setHours(0, 0, 0, 0);
                    currentMonth = new Date(year, month, 1);
                    const container = document.querySelector('.app-calendar')?.parentElement;
                    if (container) {
                        render(container);
                        const event = new CustomEvent('calendar-rendered');
                        document.dispatchEvent(event);
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
                    
                    const container = document.querySelector('.app-calendar')?.parentElement;
                    if (container) {
                        render(container);
                        const event = new CustomEvent('calendar-rendered');
                        document.dispatchEvent(event);
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
    const calendar = document.getElementById('app-calendar-swipe');
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
            const container = document.querySelector('.app-calendar').parentElement;
            render(container);
            const event = new CustomEvent('calendar-rendered');
            document.dispatchEvent(event);
        } else if (swipeDistance < -minSwipeDistance) {
            currentMonth.setMonth(currentMonth.getMonth() + 1);
            const container = document.querySelector('.app-calendar').parentElement;
            render(container);
            const event = new CustomEvent('calendar-rendered');
            document.dispatchEvent(event);
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
