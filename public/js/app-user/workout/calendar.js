// 운동기록 캘린더 컴포넌트

import { formatDate, formatDateShort } from '../utils.js';

let selectedDate = null;
let currentMonth = new Date();
let onDateSelectCallback = null;
let workoutRecordsByDate = {}; // 날짜별 운동기록 데이터
let sessionsByDate = {}; // 날짜별 세션 데이터

/**
 * 캘린더 초기화
 */
export function init(container, onDateSelect, workoutRecords = []) {
    onDateSelectCallback = onDateSelect;
    selectedDate = new Date();
    selectedDate.setHours(0, 0, 0, 0);
    currentMonth = new Date(selectedDate);
    
    // 운동기록을 날짜별로 그룹화
    workoutRecordsByDate = {};
    workoutRecords.forEach(record => {
        // workout_date가 Date 객체인 경우 문자열로 변환, 이미 문자열인 경우 그대로 사용
        let dateStr = record.workout_date;
        if (dateStr instanceof Date) {
            dateStr = formatDate(dateStr);
        } else if (typeof dateStr === 'string') {
            // PostgreSQL DATE 타입은 이미 YYYY-MM-DD 형식
            // YYYY-MM-DD 형식인지 확인 (정규식으로 체크)
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                // 이미 올바른 형식이면 그대로 사용
                // 타임존 문제를 피하기 위해 Date 객체로 변환하지 않음
            } else {
                // 다른 형식인 경우에만 변환 시도
                const dateObj = new Date(dateStr);
                if (!isNaN(dateObj.getTime())) {
                    dateStr = formatDate(dateObj);
                }
            }
        }
        
        if (dateStr) {
            if (!workoutRecordsByDate[dateStr]) {
                workoutRecordsByDate[dateStr] = [];
            }
            workoutRecordsByDate[dateStr].push(record);
        }
    });
    
    console.log('[Calendar] 운동기록 데이터:', workoutRecordsByDate);
    console.log('[Calendar] 운동기록 날짜 키들:', Object.keys(workoutRecordsByDate));
    
    render(container);
}

/**
 * 세션 데이터 업데이트
 */
export function updateSessions(sessions = []) {
    sessionsByDate = {};
    sessions.forEach(session => {
        const dateStr = session.date; // 이미 YYYY-MM-DD 형식
        if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            if (!sessionsByDate[dateStr]) {
                sessionsByDate[dateStr] = [];
            }
            sessionsByDate[dateStr].push(session);
        }
    });
}

/**
 * 운동기록 데이터 업데이트
 */
export function updateWorkoutRecords(workoutRecords) {
    workoutRecordsByDate = {};
    workoutRecords.forEach(record => {
        // workout_date가 Date 객체인 경우 문자열로 변환, 이미 문자열인 경우 그대로 사용
        let dateStr = record.workout_date;
        if (dateStr instanceof Date) {
            dateStr = formatDate(dateStr);
        } else if (typeof dateStr === 'string') {
            // PostgreSQL DATE 타입은 이미 YYYY-MM-DD 형식
            // YYYY-MM-DD 형식인지 확인 (정규식으로 체크)
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                // 이미 올바른 형식이면 그대로 사용
                // 타임존 문제를 피하기 위해 Date 객체로 변환하지 않음
            } else {
                // 다른 형식인 경우에만 변환 시도
                const dateObj = new Date(dateStr);
                if (!isNaN(dateObj.getTime())) {
                    dateStr = formatDate(dateObj);
                }
            }
        }
        
        if (dateStr) {
            if (!workoutRecordsByDate[dateStr]) {
                workoutRecordsByDate[dateStr] = [];
            }
            workoutRecordsByDate[dateStr].push(record);
        }
    });
    
    console.log('[Calendar] 운동기록 업데이트:', workoutRecordsByDate);
}

/**
 * 캘린더 렌더링
 */
export function render(container) {
    if (!container) return;
    
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
    // 첫 날이 일요일(0)이면 이전주를 표시하지 않음
    if (firstDayOfWeek > 0) {
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        const prevMonthLastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
        
        for (let i = 0; i < firstDayOfWeek; i++) {
            const prevDay = prevMonthLastDay - firstDayOfWeek + i + 1;
            const prevDate = new Date(prevYear, prevMonth, prevDay);
            prevDate.setHours(0, 0, 0, 0);
            const prevDateStr = formatDate(prevDate);
            const hasWorkout = workoutRecordsByDate[prevDateStr] && workoutRecordsByDate[prevDateStr].length > 0;
            const allCompleted = hasWorkout ? checkAllWorkoutsCompleted(workoutRecordsByDate[prevDateStr]) : false;
            const hasSession = sessionsByDate[prevDateStr] && sessionsByDate[prevDateStr].length > 0;
            
            let dayClass = 'app-calendar-day app-calendar-day-empty';
            if (hasWorkout) {
                dayClass += allCompleted ? ' app-calendar-day-has-workout' : ' app-calendar-day-has-workout-incomplete';
            }
            if (hasSession) {
                dayClass += ' app-calendar-day-has-session';
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
        const hasWorkout = workoutRecordsByDate[dateStr] && workoutRecordsByDate[dateStr].length > 0;
        const allCompleted = hasWorkout ? checkAllWorkoutsCompleted(workoutRecordsByDate[dateStr]) : false;
        const hasSession = sessionsByDate[dateStr] && sessionsByDate[dateStr].length > 0;
        
        let dayClass = 'app-calendar-day';
        if (isToday) dayClass += ' app-calendar-day-today';
        if (isSelected) dayClass += ' app-calendar-day-selected';
        if (isSunday) dayClass += ' app-calendar-day-sunday';
        if (isSaturday) dayClass += ' app-calendar-day-saturday';
        if (hasWorkout) {
            dayClass += allCompleted ? ' app-calendar-day-has-workout' : ' app-calendar-day-has-workout-incomplete';
        }
        if (hasSession) {
            dayClass += ' app-calendar-day-has-session';
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
    const lastDayOfWeek = lastDay.getDay(); // 마지막 날의 요일 (0=일요일 ~ 6=토요일)
    const totalDays = firstDayOfWeek + daysInMonth;
    const remainingDays = 42 - totalDays; // 6주 * 7일 = 42일
    
    // 마지막 날이 토요일(6)이면 다음주가 필요 없음
    // 마지막 날이 일요일(0)이면 다음주 전체가 필요
    // 따라서 마지막 날 다음부터 토요일까지만 채우면 됨
    if (lastDayOfWeek < 6) {
        // 마지막 날이 토요일이 아니면 다음주 일부만 표시
        const daysToAdd = 6 - lastDayOfWeek; // 토요일까지 남은 일수
        for (let i = 1; i <= daysToAdd; i++) {
            const nextDate = new Date(nextYear, nextMonth, i);
            nextDate.setHours(0, 0, 0, 0);
            const nextDateStr = formatDate(nextDate);
            const hasWorkout = workoutRecordsByDate[nextDateStr] && workoutRecordsByDate[nextDateStr].length > 0;
            const allCompleted = hasWorkout ? checkAllWorkoutsCompleted(workoutRecordsByDate[nextDateStr]) : false;
            const hasSession = sessionsByDate[nextDateStr] && sessionsByDate[nextDateStr].length > 0;
            
            let dayClass = 'app-calendar-day app-calendar-day-empty';
            if (hasWorkout) {
                dayClass += allCompleted ? ' app-calendar-day-has-workout' : ' app-calendar-day-has-workout-incomplete';
            }
            if (hasSession) {
                dayClass += ' app-calendar-day-has-session';
            }
            
            html += `
                <div class="${dayClass}" data-date="${nextDateStr}" data-year="${nextYear}" data-month="${nextMonth}">
                    <span class="app-calendar-day-number">${i}</span>
                </div>
            `;
        }
    }
    // 마지막 날이 토요일이면 다음주를 표시하지 않음
    
    html += `
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // 이벤트 리스너
    setupEventListeners();
}

/**
 * 모든 운동이 완료되었는지 확인
 */
function checkAllWorkoutsCompleted(records) {
    if (!records || records.length === 0) return false;
    
    return records.every(record => {
        const workoutTypeType = record.workout_type_type || null;
        
        // 시간 운동의 경우
        if (workoutTypeType === '시간') {
            return record.is_completed === true;
        }
        // 세트 운동의 경우
        else if (workoutTypeType === '세트' && record.sets && record.sets.length > 0) {
            return record.sets.every(set => set.is_completed === true);
        }
        
        // 운동종류가 없거나 세트가 없는 경우 false
        return false;
    });
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
                    // 선택된 날짜 설정
                    selectedDate = new Date(dateStr);
                    selectedDate.setHours(0, 0, 0, 0);
                    // 해당 월로 이동
                    currentMonth = new Date(year, month, 1);
                    const container = document.querySelector('.app-calendar')?.parentElement;
                    if (container) {
                        render(container);
                    }
                    // 콜백 호출
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
                    
                    // 선택된 날짜가 현재 월이 아니면 해당 월로 이동
                    if (selectedDate.getMonth() !== currentMonth.getMonth() || 
                        selectedDate.getFullYear() !== currentMonth.getFullYear()) {
                        currentMonth = new Date(selectedDate);
                    }
                    
                    const container = document.querySelector('.app-calendar')?.parentElement;
                    if (container) {
                        render(container);
                    }
                    
                    // 콜백 호출
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
    const minSwipeDistance = 50; // 최소 스와이프 거리 (픽셀)
    
    calendar.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    calendar.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });
    
    function handleSwipe() {
        const swipeDistance = touchEndX - touchStartX;
        
        // 오른쪽으로 스와이프 (이전 달)
        if (swipeDistance > minSwipeDistance) {
            currentMonth.setMonth(currentMonth.getMonth() - 1);
            const container = document.querySelector('.app-calendar').parentElement;
            render(container);
        }
        // 왼쪽으로 스와이프 (다음 달)
        else if (swipeDistance < -minSwipeDistance) {
            currentMonth.setMonth(currentMonth.getMonth() + 1);
            const container = document.querySelector('.app-calendar').parentElement;
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
        currentMonth.setDate(1); // 월의 첫 날로 설정
        currentMonth.setHours(0, 0, 0, 0);
    }
}
