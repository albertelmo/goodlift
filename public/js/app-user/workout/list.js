// 운동기록 목록 렌더링

import { formatDate, formatDateShort, formatNumber, showLoading, showError, showEmpty, escapeHtml } from '../utils.js';
import { getWorkoutRecords, updateWorkoutRecordCompleted, updateWorkoutSetCompleted } from '../api.js';

let currentAppUserId = null;
let currentRecords = [];

/**
 * 운동기록 목록 초기화
 */
export function init(appUserId) {
    currentAppUserId = appUserId;
    loadRecords();
}

let currentFilterDate = null;

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
 * 날짜로 필터링
 */
export function filterByDate(dateStr) {
    currentFilterDate = dateStr;
    // 전체 레코드를 다시 렌더링 (필터링은 render에서 수행)
    render(currentRecords);
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
    
    // 선택된 날짜로 필터링
    let filteredRecords = records;
    if (currentFilterDate) {
        filteredRecords = records.filter(record => {
            // workout_date가 이미 YYYY-MM-DD 형식의 문자열이어야 함 (서버에서 정규화됨)
            // 만약 Date 객체로 변환되었을 경우를 대비해 문자열로 변환
            let recordDateStr = record.workout_date;
            if (recordDateStr instanceof Date) {
                recordDateStr = formatDate(recordDateStr);
            } else if (typeof recordDateStr === 'string') {
                // ISO 형식 문자열인 경우 날짜 부분만 추출
                recordDateStr = recordDateStr.split('T')[0];
            }
            // 날짜 비교 (YYYY-MM-DD 형식)
            return recordDateStr === currentFilterDate;
        });
    }
    
    if (filteredRecords.length === 0) {
        const message = currentFilterDate ? '선택한 날짜에 등록된 운동기록이 없습니다.' : '등록된 운동기록이 없습니다.';
        showEmpty(container, message);
        return;
    }
    
    records = filteredRecords;
    
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
    const workoutTypeName = record.workout_type_name || '미지정';
    const workoutTypeType = record.workout_type_type || null;
    const duration = record.duration_minutes ? `${record.duration_minutes}분` : null;
    const notes = record.notes ? escapeHtml(record.notes) : '';
    const sets = record.sets || [];
    
    let infoHtml = '';
    
    if (workoutTypeType === '시간' && duration) {
        infoHtml = `<span class="app-workout-item-duration">⏱ ${duration}</span>`;
    } else if (workoutTypeType === '세트' && sets.length > 0) {
        const setsInfo = sets.map(set => {
            const weight = set.weight ? `${Math.round(set.weight)}kg` : '-';
            const reps = set.reps ? `${set.reps}회` : '-';
            return `${set.set_number}세트: ${weight} × ${reps}`;
        }).join('<br>');
        infoHtml = `<span class="app-workout-item-sets">${setsInfo}</span>`;
    }
    
    return `
        <div class="app-workout-item" data-record-id="${record.id}">
            <div class="app-workout-item-main">
                <div class="app-workout-item-type">${escapeHtml(workoutTypeName)}</div>
                ${infoHtml ? `<div class="app-workout-item-info">${infoHtml}</div>` : ''}
            </div>
            ${notes ? `<div class="app-workout-item-notes">${notes}</div>` : ''}
        </div>
    `;
}

/**
 * 운동 완료 체크 모달 표시
 */
function showCompletedCheckModal(record) {
    const workoutTypeName = record.workout_type_name || '미지정';
    const workoutTypeType = record.workout_type_type || null;
    const duration = record.duration_minutes ? `${record.duration_minutes}분` : null;
    const notes = record.notes ? escapeHtml(record.notes) : '';
    const sets = record.sets || [];
    const isCompleted = record.is_completed || false;
    
    let contentHtml = '';
    
    if (workoutTypeType === '시간' && duration) {
        const checked = isCompleted ? 'checked' : '';
        contentHtml = `
            <div class="app-completed-modal-content-item">
                <span class="app-completed-modal-label">⏱ 운동 시간</span>
                <div class="app-completed-modal-checkbox-container">
                    <span>${duration}</span>
                    <input type="checkbox" class="app-completed-modal-checkbox" 
                           data-type="record" ${checked}>
                </div>
            </div>
        `;
    } else if (workoutTypeType === '세트' && sets.length > 0) {
        contentHtml = '<div class="app-completed-modal-sets">';
        sets.forEach(set => {
            const weight = set.weight ? `${Math.round(set.weight)}kg` : '-';
            const reps = set.reps ? `${set.reps}회` : '-';
            const checked = set.is_completed ? 'checked' : '';
            contentHtml += `
                <div class="app-completed-modal-content-item">
                    <span class="app-completed-modal-label">${set.set_number}세트</span>
                    <div class="app-completed-modal-checkbox-container">
                        <span>${weight} × ${reps}</span>
                        <input type="checkbox" class="app-completed-modal-checkbox" 
                               data-type="set" data-set-id="${set.id}" ${checked}>
                    </div>
                </div>
            `;
        });
        contentHtml += '</div>';
    }
    
    const modalHtml = `
        <div class="app-modal-bg" id="completed-check-modal-bg">
            <div class="app-modal" id="completed-check-modal">
                <div class="app-modal-header">
                    <h3>${escapeHtml(workoutTypeName)}</h3>
                    <button class="app-modal-close-btn" id="completed-check-modal-close">×</button>
                </div>
                <div class="app-modal-content" id="completed-check-modal-content">
                    ${contentHtml}
                    ${notes ? `<div class="app-completed-modal-notes">${notes}</div>` : ''}
                </div>
                <div class="app-modal-actions">
                    <button class="app-modal-btn app-modal-btn-secondary" id="completed-check-edit-btn">수정</button>
                </div>
            </div>
        </div>
    `;
    
    // 기존 모달이 있으면 제거
    const existingModal = document.getElementById('completed-check-modal-bg');
    if (existingModal) {
        existingModal.remove();
    }
    
    // 모달 추가
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modalBg = document.getElementById('completed-check-modal-bg');
    const modal = document.getElementById('completed-check-modal');
    const closeBtn = document.getElementById('completed-check-modal-close');
    const editBtn = document.getElementById('completed-check-edit-btn');
    const checkboxes = modal.querySelectorAll('.app-completed-modal-checkbox');
    
    // 체크박스 클릭 이벤트
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            const isChecked = checkbox.checked;
            const type = checkbox.getAttribute('data-type');
            
            try {
                if (type === 'record') {
                    await updateWorkoutRecordCompleted(record.id, currentAppUserId, isChecked);
                    record.is_completed = isChecked;
                } else if (type === 'set') {
                    const setId = checkbox.getAttribute('data-set-id');
                    await updateWorkoutSetCompleted(record.id, setId, currentAppUserId, isChecked);
                    const set = record.sets.find(s => s.id === setId);
                    if (set) {
                        set.is_completed = isChecked;
                    }
                }
            } catch (error) {
                console.error('완료 상태 업데이트 오류:', error);
                checkbox.checked = !isChecked; // 롤백
                alert('완료 상태를 업데이트하는 중 오류가 발생했습니다.');
            }
        });
    });
    
    // 수정 버튼 클릭 이벤트
    if (editBtn) {
        editBtn.addEventListener('click', async (e) => {
            e.stopPropagation(); // 이벤트 전파 방지
            
            // 완료 체크 모달 닫기 (애니메이션 완료 후 제거)
            modalBg.classList.remove('app-modal-show');
            modal.classList.remove('app-modal-show');
            
            // 모달이 완전히 닫힌 후 수정 모달 열기
            setTimeout(async () => {
                modalBg.remove();
                try {
                    const editModule = await import('./edit.js');
                    // 최신 record 데이터 다시 가져오기
                    const { getWorkoutRecordById } = await import('../api.js');
                    const latestRecord = await getWorkoutRecordById(record.id, currentAppUserId);
                    const recordToEdit = latestRecord || record;
                    await editModule.showEditModal(recordToEdit, currentAppUserId, () => {
                        loadRecords();
                    });
                } catch (error) {
                    console.error('수정 모달 열기 오류:', error);
                    alert('수정 모달을 열 수 없습니다.');
                }
            }, 200); // 애니메이션 시간에 맞춰 지연
        });
    }
    
    // 닫기 버튼 클릭 이벤트
    closeBtn.addEventListener('click', () => {
        modalBg.remove();
    });
    
    // 배경 클릭 시 닫기
    modalBg.addEventListener('click', (e) => {
        if (e.target === modalBg) {
            modalBg.remove();
        }
    });
    
    // 모달 열기 애니메이션
    setTimeout(() => {
        modalBg.classList.add('app-modal-show');
        modal.classList.add('app-modal-show');
    }, 10);
}

/**
 * 클릭 이벤트 리스너 설정
 */
function setupClickListeners() {
    const items = document.querySelectorAll('.app-workout-item');
    items.forEach(item => {
        const recordId = item.getAttribute('data-record-id');
        const record = currentRecords.find(r => r.id === recordId);
        if (!record) return;
        
        // 카드 클릭 시 완료 체크 모달 열기
        item.addEventListener('click', () => {
            showCompletedCheckModal(record);
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
