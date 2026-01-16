// 운동기록 목록 렌더링

import { formatDate, formatDateShort, formatNumber, showLoading, showError, showEmpty, escapeHtml } from '../utils.js';
import { getWorkoutRecords } from '../api.js';

let currentAppUserId = null;
let currentRecords = [];

/**
 * 운동기록 목록 초기화
 */
export function init(appUserId) {
    currentAppUserId = appUserId;
    loadRecords();
}

/**
 * 운동기록 목록 로드
 */
async function loadRecords(filters = {}) {
    // workout-list-wrapper 또는 app-user-content 찾기
    let container = document.getElementById('workout-list-wrapper');
    if (!container) {
        container = document.getElementById('app-user-content');
    }
    if (!container) return;
    
    showLoading(container);
    
    try {
        const records = await getWorkoutRecords(currentAppUserId, filters);
        currentRecords = records;
        render(records);
    } catch (error) {
        console.error('운동기록 로드 오류:', error);
        showError(container, '운동기록을 불러오는 중 오류가 발생했습니다.');
    }
}

/**
 * 운동기록 목록 렌더링
 */
function render(records) {
    // workout-list-wrapper 또는 app-user-content 찾기
    let container = document.getElementById('workout-list-wrapper');
    if (!container) {
        container = document.getElementById('app-user-content');
    }
    if (!container) return;
    
    if (records.length === 0) {
        showEmpty(container, '등록된 운동기록이 없습니다.');
        return;
    }
    
    // 날짜별 그룹화
    const groupedByDate = {};
    records.forEach(record => {
        const date = record.workout_date;
        if (!groupedByDate[date]) {
            groupedByDate[date] = [];
        }
        groupedByDate[date].push(record);
    });
    
    // 날짜별로 정렬 (최신순)
    const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));
    
    let html = '<div class="app-workout-list">';
    
    sortedDates.forEach(date => {
        const dateRecords = groupedByDate[date];
        const dateObj = new Date(date);
        
        html += `
            <div class="app-workout-date-section">
                <div class="app-workout-date-header">
                    <h3 class="app-workout-date-title">${formatDateShort(dateObj)}</h3>
                    <span class="app-workout-date-count">${dateRecords.length}건</span>
                </div>
                <div class="app-workout-items">
        `;
        
        dateRecords.forEach(record => {
            html += renderWorkoutItem(record);
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
    // 클릭 이벤트 리스너 추가
    setupClickListeners();
}

/**
 * 운동기록 아이템 렌더링
 */
function renderWorkoutItem(record) {
    const workoutType = record.workout_type || '미지정';
    const duration = record.duration_minutes ? `${record.duration_minutes}분` : '-';
    const calories = record.calories_burned ? `${formatNumber(record.calories_burned)}kcal` : '-';
    const notes = record.notes ? escapeHtml(record.notes) : '';
    
    return `
        <div class="app-workout-item" data-record-id="${record.id}">
            <div class="app-workout-item-main">
                <div class="app-workout-item-type">${escapeHtml(workoutType)}</div>
                <div class="app-workout-item-info">
                    <span class="app-workout-item-duration">⏱ ${duration}</span>
                    <span class="app-workout-item-calories">🔥 ${calories}</span>
                </div>
            </div>
            ${notes ? `<div class="app-workout-item-notes">${notes}</div>` : ''}
        </div>
    `;
}

/**
 * 클릭 이벤트 리스너 설정
 */
function setupClickListeners() {
    const items = document.querySelectorAll('.app-workout-item');
    items.forEach(item => {
        item.addEventListener('click', () => {
            const recordId = item.getAttribute('data-record-id');
            const record = currentRecords.find(r => r.id === recordId);
            if (record) {
                // 수정 모달 열기
                import('./edit.js').then(module => {
                    module.showEditModal(record, currentAppUserId, () => {
                        loadRecords();
                    });
                });
            }
        });
    });
}

/**
 * 새로고침
 */
export function refresh() {
    loadRecords();
    
    // 캘린더 운동기록 업데이트
    if (window.updateCalendarWorkoutRecords) {
        window.updateCalendarWorkoutRecords();
    }
}
