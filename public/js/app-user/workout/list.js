// 운동기록 목록 렌더링

import { formatDate, formatDateShort, formatNumber, showLoading, showError, showEmpty, escapeHtml } from '../utils.js';
import { getWorkoutRecords, updateWorkoutRecordCompleted, updateWorkoutSetCompleted } from '../api.js';

let currentAppUserId = null;
let currentRecords = [];
let sessionsByDate = {}; // 날짜별 세션 데이터
let trainerNameMap = {}; // 트레이너 username -> name 매핑

/**
 * 운동기록 목록 초기화
 */
export function init(appUserId) {
    currentAppUserId = appUserId;
    loadRecords();
}

/**
 * 세션 데이터 업데이트
 */
export async function updateSessions(sessions = []) {
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
    
    // 트레이너 이름 매핑 로드
    await loadTrainerNameMap();
}

/**
 * 트레이너 이름 매핑 로드
 */
async function loadTrainerNameMap() {
    try {
        const response = await fetch('/api/trainers');
        if (response.ok) {
            const trainers = await response.json();
            trainerNameMap = {};
            trainers.forEach(trainer => {
                trainerNameMap[trainer.username] = trainer.name;
            });
        }
    } catch (error) {
        console.error('트레이너 이름 매핑 로드 오류:', error);
    }
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
    
    // 세션이 있지만 운동기록이 없는 날짜도 포함
    if (currentFilterDate) {
        const hasSessionOnDate = sessionsByDate[currentFilterDate] && sessionsByDate[currentFilterDate].length > 0;
        const hasRecordsOnDate = groupedByDate[currentFilterDate] && groupedByDate[currentFilterDate].length > 0;
        
        if (hasSessionOnDate && !hasRecordsOnDate) {
            // 세션은 있지만 운동기록이 없는 경우 날짜 그룹에 빈 배열 추가
            groupedByDate[currentFilterDate] = [];
        }
    }
    
    // 운동기록과 세션이 모두 없는 경우에만 빈 메시지 표시
    if (Object.keys(groupedByDate).length === 0) {
        // 선택된 날짜가 있고, 그 날짜에 세션도 없는 경우
        if (currentFilterDate) {
            const hasSessionOnDate = sessionsByDate[currentFilterDate] && sessionsByDate[currentFilterDate].length > 0;
            if (!hasSessionOnDate) {
                const message = '선택한 날짜에 등록된 운동기록이 없습니다.';
                showEmpty(container, message);
                return;
            }
        } else {
            const message = '등록된 운동기록이 없습니다.';
            showEmpty(container, message);
            return;
        }
    }
    
    // 날짜별로 정렬 (최신순)
    const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));
    
    let html = '<div class="app-workout-list">';
    
    sortedDates.forEach(date => {
        let dateRecords = groupedByDate[date];
        // 각 날짜 내에서 created_at 기준 오름차순 정렬 (최근 추가된 것이 아래로)
        dateRecords = dateRecords.sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
            const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
            return dateA - dateB; // 오름차순
        });
        const dateObj = new Date(date);
        
        // 해당 날짜의 세션 정보
        const dateSessions = sessionsByDate[date] || [];
        
        html += `
            <div class="app-workout-date-section">
                <div class="app-workout-date-header">
                    <h3 class="app-workout-date-title">${formatDateShort(dateObj)}</h3>
                    <span class="app-workout-date-count">${dateRecords.length}건</span>
                </div>
        `;
        
        // 세션 정보 카드 (세션이 있는 경우만) - 방법 2
        if (dateSessions.length > 0) {
            // 세션별로 시간과 트레이너 정보 수집
            const sessionInfoList = dateSessions
                .sort((a, b) => a.time.localeCompare(b.time))
                .map(session => {
                    const trainerName = trainerNameMap[session.trainer] || session.trainer;
                    return {
                        time: session.time,
                        trainer: trainerName
                    };
                });
            
            // 트레이너가 동일한 경우와 다른 경우를 구분하여 표시
            const uniqueTrainers = [...new Set(sessionInfoList.map(s => s.trainer))];
            const sameTrainer = uniqueTrainers.length === 1;
            
            html += `
                <div class="app-workout-session-card">
                    <div class="app-workout-session-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                    </div>
                    <div class="app-workout-session-info">
                        <div class="app-workout-session-time">${escapeHtml(sessionInfoList.map(s => s.time).join(', '))}</div>
                        ${sameTrainer ? `<div class="app-workout-session-trainer">${escapeHtml(sessionInfoList[0].trainer)}</div>` : ''}
                        ${dateSessions.length > 1 ? `<div class="app-workout-session-count">${dateSessions.length}회</div>` : ''}
                    </div>
                </div>
            `;
        }
        
        html += `
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
    
    // 모든 세트/시간이 완료되었는지 확인
    let allCompleted = false;
    if (workoutTypeType === '시간') {
        allCompleted = record.is_completed || false;
    } else if (workoutTypeType === '세트' && sets.length > 0) {
        // 모든 세트가 완료되었는지 확인
        allCompleted = sets.every(set => set.is_completed === true) && sets.length > 0;
    }
    
    const cardClass = allCompleted ? 'app-workout-item app-workout-item-all-completed' : 'app-workout-item';
    
    let infoHtml = '';
    
    if (workoutTypeType === '시간' && duration) {
        const isCompleted = record.is_completed || false;
        const completedClass = isCompleted ? 'app-workout-item-completed' : 'app-workout-item-incomplete';
        const checked = isCompleted ? 'checked' : '';
        infoHtml = `
            <div class="app-workout-item-duration-container">
                <span class="app-workout-item-duration ${completedClass}">⏱ ${duration}</span>
                <input type="checkbox" class="app-workout-item-checkbox" 
                       data-record-id="${record.id}" 
                       data-type="record" 
                       ${checked}>
            </div>
        `;
    } else if (workoutTypeType === '세트' && sets.length > 0) {
        const setsInfo = sets.map(set => {
            const weight = set.weight !== null && set.weight !== undefined ? `${Math.round(set.weight)}kg` : '-';
            const reps = set.reps !== null && set.reps !== undefined ? `${set.reps}회` : '-';
            const isCompleted = set.is_completed || false;
            const completedClass = isCompleted ? 'app-workout-item-completed' : 'app-workout-item-incomplete';
            const checked = isCompleted ? 'checked' : '';
            return `
                <div class="app-workout-item-set-row">
                    <span class="${completedClass}">${set.set_number} 세트: ${weight} × ${reps}</span>
                    <input type="checkbox" class="app-workout-item-checkbox" 
                           data-record-id="${record.id}" 
                           data-set-id="${set.id}" 
                           data-type="set" 
                           ${checked}>
                </div>
            `;
        }).join('');
        infoHtml = `<div class="app-workout-item-sets">${setsInfo}</div>`;
    }
    
    return `
        <div class="${cardClass}" data-record-id="${record.id}">
            <div class="app-workout-item-main">
                <div class="app-workout-item-type-container">
                    <div class="app-workout-item-type">${escapeHtml(workoutTypeName)}</div>
                    <button class="app-workout-item-edit-btn" data-record-id="${record.id}" aria-label="수정">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                </div>
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
            const weight = set.weight !== null && set.weight !== undefined ? `${Math.round(set.weight)}kg` : '-';
            const reps = set.reps !== null && set.reps !== undefined ? `${set.reps}회` : '-';
            const checked = set.is_completed ? 'checked' : '';
            contentHtml += `
                <div class="app-completed-modal-content-item">
                    <span class="app-completed-modal-label">${set.set_number} 세트</span>
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
                
                // 카드 목록 업데이트
                const recordIndex = currentRecords.findIndex(r => r.id === record.id);
                if (recordIndex !== -1) {
                    // currentRecords 업데이트
                    currentRecords[recordIndex] = { ...record };
                    // 현재 필터 날짜로 다시 렌더링
                    render(currentRecords);
                }
                
                // 캘린더 업데이트
                if (window.updateCalendarWorkoutRecords) {
                    await window.updateCalendarWorkoutRecords();
                }
            } catch (error) {
                console.error('완료 상태 업데이트 오류:', error);
                checkbox.checked = !isChecked; // 롤백
                alert('완료 상태를 업데이트하는 중 오류가 발생했습니다.');
            }
        });
    });
    
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
        
        // 수정 버튼 클릭 시 수정 모달 열기
        const editBtn = item.querySelector('.app-workout-item-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', async (e) => {
                e.stopPropagation(); // 카드 클릭 이벤트 방지
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
            });
        }
        
        // 체크박스 클릭 이벤트 - 즉시 완료 상태 업데이트
        const checkboxes = item.querySelectorAll('.app-workout-item-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation(); // 카드 클릭 이벤트 방지
            });
            
            checkbox.addEventListener('change', async (e) => {
                const isChecked = checkbox.checked;
                const type = checkbox.getAttribute('data-type');
                const recordId = checkbox.getAttribute('data-record-id');
                
                try {
                    if (type === 'record') {
                        // 운동기록 완료 상태 업데이트
                        const { updateWorkoutRecordCompleted } = await import('../api.js');
                        await updateWorkoutRecordCompleted(recordId, currentAppUserId, isChecked);
                    } else if (type === 'set') {
                        // 세트 완료 상태 업데이트
                        const setId = checkbox.getAttribute('data-set-id');
                        const { updateWorkoutSetCompleted } = await import('../api.js');
                        await updateWorkoutSetCompleted(recordId, setId, currentAppUserId, isChecked);
                    }
                    
                    // 현재 레코드 데이터 업데이트
                    const updatedRecord = currentRecords.find(r => r.id === recordId);
                    if (updatedRecord) {
                        if (type === 'record') {
                            updatedRecord.is_completed = isChecked;
                        } else if (type === 'set') {
                            const setId = checkbox.getAttribute('data-set-id');
                            const set = updatedRecord.sets?.find(s => s.id === setId);
                            if (set) {
                                set.is_completed = isChecked;
                            }
                        }
                    }
                    
                    // 카드 다시 렌더링
                    render(currentRecords);
                    
                    // 캘린더 업데이트
                    if (window.updateCalendarWorkoutRecords) {
                        window.updateCalendarWorkoutRecords();
                    }
                } catch (error) {
                    console.error('완료 상태 업데이트 오류:', error);
                    // 실패 시 체크박스 상태 원복
                    checkbox.checked = !isChecked;
                    alert('완료 상태 업데이트에 실패했습니다.');
                }
            });
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
