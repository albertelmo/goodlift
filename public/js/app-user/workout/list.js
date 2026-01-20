// 운동기록 목록 렌더링

import { formatDate, formatDateShort, formatNumber, showLoading, showError, showEmpty, escapeHtml } from '../utils.js';
import { getWorkoutRecords, updateWorkoutRecordCompleted, updateWorkoutSetCompleted, getUserSettings, updateUserSettings } from '../api.js';

let currentAppUserId = null;
let currentRecords = [];
let sessionsByDate = {}; // 날짜별 세션 데이터
let trainerNameMap = {}; // 트레이너 username -> name 매핑
let cachedTimerSettings = null; // 타이머 설정 캐시

let isReadOnly = false;

/**
 * 운동기록 목록 초기화
 */
export function init(appUserId, readOnly = false) {
    currentAppUserId = appUserId;
    isReadOnly = readOnly;
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
        await render(records);
    } catch (error) {
        console.error('운동기록 로드 오류:', error);
        showError(container, '운동기록을 불러오는 중 오류가 발생했습니다.');
    }
}

/**
 * 날짜로 필터링
 */
export async function filterByDate(dateStr) {
    currentFilterDate = dateStr;
    // 전체 레코드를 다시 렌더링 (필터링은 render에서 수행)
    await render(currentRecords);
}

/**
 * 운동기록 목록 렌더링
 */
async function render(records) {
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
    
    // 타이머 설정 불러오기 (캐시가 없거나 만료된 경우)
    if (!cachedTimerSettings) {
        await loadTimerSettings();
    }
    
    // 타이머 표시 텍스트 생성
    let timerDisplayText = '-';
    if (cachedTimerSettings) {
        if (!cachedTimerSettings.restTimerEnabled) {
            timerDisplayText = 'off';
        } else {
            timerDisplayText = formatTime(cachedTimerSettings.restMinutes * 60 + cachedTimerSettings.restSeconds);
        }
    }
    
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
                    <div class="app-workout-date-left">
                        <h3 class="app-workout-date-title">${formatDateShort(dateObj)}</h3>
                        <span class="app-workout-date-count">${dateRecords.length}건</span>
                    </div>
                    <button class="app-workout-timer-btn" data-date="${date}" aria-label="타이머" ${isReadOnly ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                        타이머<span class="app-workout-timer-text">${timerDisplayText}</span>
                    </button>
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
        const canRemove = sets.length > 1;
        // 모든 세트가 완료되었는지 확인
        const allSetsCompleted = sets.every(set => set.is_completed === true) && sets.length > 0;
        const setsInfo = sets.map((set, setIndex) => {
            const weight = set.weight !== null && set.weight !== undefined ? `${Math.round(set.weight)}kg` : '-';
            const reps = set.reps !== null && set.reps !== undefined ? `${set.reps}회` : '-';
            const isCompleted = set.is_completed || false;
            const completedClass = isCompleted ? 'app-workout-item-completed' : 'app-workout-item-incomplete';
            const checked = isCompleted ? 'checked' : '';
            return `
                <div class="app-workout-item-set-row" style="display: flex; align-items: center; gap: 8px;">
                    <span class="app-workout-item-set-number ${completedClass}">${set.set_number}</span>
                    <span class="app-workout-item-set-info ${completedClass}">${weight} × ${reps}</span>
                    ${!isReadOnly ? `
                    <input type="checkbox" class="app-workout-item-checkbox" 
                           data-record-id="${record.id}" 
                           data-set-id="${set.id}" 
                           data-type="set" 
                           ${checked}>
                    ` : ''}
                </div>
            `;
        }).join('');
        infoHtml = `
            <div class="app-workout-item-sets">
                ${!isReadOnly ? `
                <div class="app-workout-item-set-controls" style="display: flex; gap: 16px; align-items: center; justify-content: flex-start; margin-bottom: 8px; height: 24px;">
                    <button type="button" class="app-workout-item-remove-set-btn" data-record-id="${record.id}" style="width: 24px; height: 24px; flex-shrink: 0; border: 1px solid #ddd; background: #fff; color: #333; border-radius: 4px; cursor: ${canRemove ? 'pointer' : 'not-allowed'}; font-size: 18px; font-weight: bold; line-height: 24px; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0; box-sizing: border-box; opacity: ${canRemove ? '1' : '0.5'};" ${!canRemove ? 'disabled' : ''}>−</button>
                    <span style="font-size: 14px; color: #333; line-height: 24px; height: 24px; display: inline-flex; align-items: center; margin: 0; padding: 0;">세트</span>
                    <button type="button" class="app-workout-item-add-set-btn" data-record-id="${record.id}" style="width: 24px; height: 24px; flex-shrink: 0; border: 1px solid #1976d2; background: #1976d2; color: #fff; border-radius: 4px; cursor: pointer; font-size: 18px; font-weight: bold; line-height: 24px; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0; box-sizing: border-box;">+</button>
                    <input type="checkbox" class="app-workout-item-all-sets-checkbox" 
                           data-record-id="${record.id}" 
                           data-type="all-sets" 
                           ${allSetsCompleted ? 'checked' : ''}
                           style="margin-left: 18px; width: 24px; height: 24px; flex-shrink: 0;">
                </div>
                ` : ''}
                ${setsInfo}
            </div>
        `;
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
                    await render(currentRecords);
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
 * 타이머 모달 표시
 */
async function showTimerModal(date) {
    // 기본값: 30초 (0분 30초)
    let useRestTimer = true;
    let restMinutes = 0;
    let restSeconds = 30;
    
    // DB에서 저장된 설정 불러오기
    try {
        if (currentAppUserId) {
            const settings = await getUserSettings(currentAppUserId);
            useRestTimer = settings.rest_timer_enabled !== undefined ? settings.rest_timer_enabled : true;
            restMinutes = settings.rest_timer_minutes !== undefined ? settings.rest_timer_minutes : 0;
            restSeconds = settings.rest_timer_seconds !== undefined ? settings.rest_timer_seconds : 30;
        }
    } catch (e) {
        console.error('타이머 설정 불러오기 오류:', e);
    }
    
    const modalHtml = `
        <div class="app-modal-bg" id="timer-modal-bg">
            <div class="app-modal timer-modal" id="timer-modal">
                <div class="app-modal-header">
                    <h3>타이머 설정</h3>
                    <button class="app-modal-close-btn" id="timer-modal-close">×</button>
                </div>
                <div class="app-modal-content" id="timer-modal-content">
                    <div class="app-form-group" style="margin-bottom: 20px;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="timer-use-rest" ${useRestTimer ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
                            <span style="font-size: 16px; color: var(--app-text);">타이머 사용</span>
                        </label>
                    </div>
                    <div id="timer-settings-container" style="${useRestTimer ? '' : 'opacity: 0.5; pointer-events: none;'}">
                        <div class="app-form-group" style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-size: 14px; color: var(--app-text-muted);">분</label>
                            <select id="timer-rest-minutes" style="width: 100%; padding: 10px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); font-size: 16px; background: var(--app-surface); color: var(--app-text);">
                                ${Array.from({ length: 11 }, (_, i) => i).map(min => 
                                    `<option value="${min}" ${min === restMinutes ? 'selected' : ''}>${min}분</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="app-form-group" style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-size: 14px; color: var(--app-text-muted);">초</label>
                            <select id="timer-rest-seconds" style="width: 100%; padding: 10px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); font-size: 16px; background: var(--app-surface); color: var(--app-text);">
                                ${[0, 10, 20, 30, 40, 50].map(sec => 
                                    `<option value="${sec}" ${sec === restSeconds ? 'selected' : ''}>${sec}초</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                </div>
                <div class="app-modal-actions">
                    <button type="button" id="timer-modal-save" class="app-btn app-btn-primary" style="flex: 1;">저장</button>
                    <button type="button" id="timer-modal-cancel" class="app-btn app-btn-secondary" style="flex: 1;">취소</button>
                </div>
            </div>
        </div>
    `;
    
    // 기존 모달이 있으면 제거
    const existingModal = document.getElementById('timer-modal-bg');
    if (existingModal) {
        existingModal.remove();
    }
    
    // 모달 추가
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modalBg = document.getElementById('timer-modal-bg');
    const modal = document.getElementById('timer-modal');
    const closeBtn = document.getElementById('timer-modal-close');
    const cancelBtn = document.getElementById('timer-modal-cancel');
    const saveBtn = document.getElementById('timer-modal-save');
    const useRestCheckbox = document.getElementById('timer-use-rest');
    const settingsContainer = document.getElementById('timer-settings-container');
    const minutesSelect = document.getElementById('timer-rest-minutes');
    const secondsSelect = document.getElementById('timer-rest-seconds');
    
    // 휴식시간 사용 체크박스 이벤트
    useRestCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        if (isChecked) {
            settingsContainer.style.opacity = '1';
            settingsContainer.style.pointerEvents = 'auto';
        } else {
            settingsContainer.style.opacity = '0.5';
            settingsContainer.style.pointerEvents = 'none';
        }
    });
    
    // 저장 버튼 클릭 이벤트
    saveBtn.addEventListener('click', async () => {
        const useRest = useRestCheckbox.checked;
        const minutes = parseInt(minutesSelect.value);
        const seconds = parseInt(secondsSelect.value);
        
        // 0분 0초 체크
        if (useRest && minutes === 0 && seconds === 0) {
            alert('휴식시간은 0분 0초일 수 없습니다.');
            return;
        }
        
        // DB에 저장
        try {
            if (currentAppUserId) {
                await updateUserSettings(currentAppUserId, {
                    rest_timer_enabled: useRest,
                    rest_timer_minutes: minutes,
                    rest_timer_seconds: seconds
                });
                
                // 모달 닫기
                modalBg.remove();
                
                // 타이머 설정 캐시 무효화 (다음 렌더링 시 다시 불러오기)
                cachedTimerSettings = null;
                
                // 목록 다시 렌더링하여 변경된 타이머 설정 표시
                await render(currentRecords);
                
                // TODO: 타이머 시작 기능 구현
                console.log('타이머 설정 저장 완료:', { useRest, minutes, seconds });
            } else {
                alert('사용자 정보를 찾을 수 없습니다.');
            }
        } catch (error) {
            console.error('타이머 설정 저장 오류:', error);
            alert('설정 저장 중 오류가 발생했습니다.');
        }
    });
    
    // 취소 버튼 클릭 이벤트
    cancelBtn.addEventListener('click', () => {
        modalBg.remove();
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
 * 휴식 타이머 모달 표시
 */
async function showRestTimerModal() {
    // 읽기 전용 모드에서는 표시하지 않음
    if (isReadOnly) {
        return;
    }
    
    // 기존 타이머 모달이 있으면 제거
    const existingModal = document.getElementById('rest-timer-modal-bg');
    if (existingModal) {
        existingModal.remove();
    }
    
    // DB에서 휴식 타이머 설정 불러오기 (기본값: 30초)
    let restTimerEnabled = true;
    let restMinutes = 0;
    let restSeconds = 30;
    
    try {
        if (currentAppUserId) {
            const settings = await getUserSettings(currentAppUserId);
            // 설정이 있으면 저장된 값 사용, 없으면 기본값 사용
            if ('rest_timer_enabled' in settings) {
                restTimerEnabled = settings.rest_timer_enabled;
            }
            if ('rest_timer_minutes' in settings) {
                restMinutes = settings.rest_timer_minutes;
            }
            if ('rest_timer_seconds' in settings) {
                restSeconds = settings.rest_timer_seconds;
            }
        }
    } catch (e) {
        console.error('휴식 타이머 설정 불러오기 오류:', e);
        // 에러 발생 시 기본값 사용
    }
    
    // 휴식 타이머가 비활성화되어 있거나 시간이 0이면 모달을 띄우지 않음
    if (!restTimerEnabled || (restMinutes === 0 && restSeconds === 0)) {
        return;
    }
    
    // 총 초 계산
    let totalSeconds = restMinutes * 60 + restSeconds;
    
    const modalHtml = `
        <div class="app-modal-bg" id="rest-timer-modal-bg">
            <div class="app-modal rest-timer-modal" id="rest-timer-modal">
                <div class="app-modal-header">
                    <h3>숨고르기</h3>
                    <button class="app-modal-close-btn" id="rest-timer-modal-close">×</button>
                </div>
                <div class="app-modal-content" id="rest-timer-modal-content" style="text-align: center; padding: 40px 20px;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 24px; margin-bottom: 8px;">
                        <button id="rest-timer-decrease-btn" style="width: 40px; height: 40px; border: none; background: transparent; color: #000000; border-radius: var(--app-radius-sm); cursor: pointer; font-size: 24px; font-weight: bold; line-height: 1; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0; box-sizing: border-box;">−</button>
                        <div id="rest-timer-display" style="font-size: 48px; font-weight: bold; color: #000000; min-width: 120px;">
                            ${formatTime(totalSeconds)}
                        </div>
                        <button id="rest-timer-increase-btn" style="width: 40px; height: 40px; border: none; background: transparent; color: #000000; border-radius: var(--app-radius-sm); cursor: pointer; font-size: 24px; font-weight: bold; line-height: 1; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0; box-sizing: border-box;">+</button>
                    </div>
                    <div id="rest-timer-set-time" style="font-size: 18px; color: #000000; margin-bottom: 20px;">
                        ${formatTime(totalSeconds)}
                    </div>
                    <div style="font-size: 22px; font-weight: bold; margin-top: 20px;">
                        <span style="background: linear-gradient(135deg, #ff6b6b 0%, #ff4444 50%, #ff8e53 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                            가보즈아아~!! 🔥
                        </span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 모달 추가
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modalBg = document.getElementById('rest-timer-modal-bg');
    const modal = document.getElementById('rest-timer-modal');
    const timerDisplay = document.getElementById('rest-timer-display');
    const closeBtn = document.getElementById('rest-timer-modal-close');
    const decreaseBtn = document.getElementById('rest-timer-decrease-btn');
    const increaseBtn = document.getElementById('rest-timer-increase-btn');
    
    // 타이머 시작
    let remainingSeconds = totalSeconds;
    let timerInterval = setInterval(() => {
        remainingSeconds--;
        
        if (remainingSeconds <= 0) {
            clearInterval(timerInterval);
            // 타이머가 끝나면 모달 닫기
            modalBg.remove();
        } else {
            // 시간 표시 업데이트
            timerDisplay.textContent = formatTime(remainingSeconds);
        }
    }, 1000);
    
    // - 버튼 클릭 이벤트 (10초 감소)
    decreaseBtn.addEventListener('click', () => {
        if (remainingSeconds > 10) {
            remainingSeconds -= 10;
            timerDisplay.textContent = formatTime(remainingSeconds);
        } else {
            // 10초 이하면 0으로 설정
            remainingSeconds = 0;
            timerDisplay.textContent = formatTime(remainingSeconds);
            clearInterval(timerInterval);
            // 타이머가 끝나면 모달 닫기
            setTimeout(() => {
                modalBg.remove();
            }, 100);
        }
    });
    
    // + 버튼 클릭 이벤트 (10초 증가)
    increaseBtn.addEventListener('click', () => {
        remainingSeconds += 10;
        timerDisplay.textContent = formatTime(remainingSeconds);
    });
    
    // 닫기 버튼 클릭 이벤트
    closeBtn.addEventListener('click', () => {
        clearInterval(timerInterval);
        modalBg.remove();
    });
    
    // 모달 열기 애니메이션
    setTimeout(() => {
        modalBg.classList.add('app-modal-show');
        modal.classList.add('app-modal-show');
    }, 10);
    
    // 모달이 제거될 때 타이머 정리
    const observer = new MutationObserver(() => {
        if (!document.body.contains(modalBg)) {
            clearInterval(timerInterval);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * 초를 분:초 형식으로 변환
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * 타이머 설정 불러오기 (캐시)
 */
async function loadTimerSettings() {
    // 타이머 설정 불러오기 (기본값: 30초)
    let restTimerEnabled = true;
    let restMinutes = 0;
    let restSeconds = 30;
    
    try {
        if (currentAppUserId) {
            const settings = await getUserSettings(currentAppUserId);
            // 설정이 있으면 저장된 값 사용, 없으면 기본값 사용
            if ('rest_timer_enabled' in settings) {
                restTimerEnabled = settings.rest_timer_enabled;
            }
            if ('rest_timer_minutes' in settings) {
                restMinutes = settings.rest_timer_minutes;
            }
            if ('rest_timer_seconds' in settings) {
                restSeconds = settings.rest_timer_seconds;
            }
        }
    } catch (e) {
        console.error('타이머 설정 불러오기 오류:', e);
        // 에러 발생 시 기본값 사용
    }
    
    cachedTimerSettings = {
        restTimerEnabled,
        restMinutes,
        restSeconds
    };
}

/**
 * 클릭 이벤트 리스너 설정
 */
function setupClickListeners() {
    // 타이머 버튼 클릭 이벤트 (읽기 전용 모드가 아닌 경우만)
    if (!isReadOnly) {
        const timerButtons = document.querySelectorAll('.app-workout-timer-btn');
        timerButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const date = btn.getAttribute('data-date');
                showTimerModal(date);
            });
        });
    }
    
    const items = document.querySelectorAll('.app-workout-item');
    items.forEach(item => {
        const recordId = item.getAttribute('data-record-id');
        const record = currentRecords.find(r => r.id === recordId);
        if (!record) return;
        
        // 수정 버튼 클릭 시 수정 모달 열기 (읽기 전용 모드가 아닌 경우만)
        if (!isReadOnly) {
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
        }
        
        // 전체 세트 체크박스 이벤트 (읽기 전용 모드가 아닌 경우만)
        if (!isReadOnly) {
            const allSetsCheckbox = item.querySelector('.app-workout-item-all-sets-checkbox');
            if (allSetsCheckbox) {
                allSetsCheckbox.addEventListener('click', (e) => {
                    e.stopPropagation(); // 카드 클릭 이벤트 방지
                });
                
                allSetsCheckbox.addEventListener('change', async (e) => {
                const isChecked = allSetsCheckbox.checked;
                const recordId = allSetsCheckbox.getAttribute('data-record-id');
                const record = currentRecords.find(r => r.id === recordId);
                if (!record || !record.sets) return;
                
                try {
                    // 모든 세트의 완료 상태 업데이트
                    const { updateWorkoutSetCompleted } = await import('../api.js');
                    const updatePromises = record.sets.map(set => 
                        updateWorkoutSetCompleted(recordId, set.id, currentAppUserId, isChecked)
                    );
                    await Promise.all(updatePromises);
                    
                    // 현재 레코드 데이터 업데이트
                    if (record.sets) {
                        record.sets.forEach(set => {
                            set.is_completed = isChecked;
                        });
                    }
                    
                    // 카드 다시 렌더링
                    await render(currentRecords);
                    
                    // 캘린더 업데이트
                    if (window.updateCalendarWorkoutRecords) {
                        window.updateCalendarWorkoutRecords();
                    }
                } catch (error) {
                    console.error('전체 세트 완료 상태 업데이트 오류:', error);
                    // 실패 시 체크박스 상태 원복
                    allSetsCheckbox.checked = !isChecked;
                    alert('완료 상태 업데이트에 실패했습니다.');
                }
                });
            }
        }
        
        // 체크박스 클릭 이벤트 - 즉시 완료 상태 업데이트 (읽기 전용 모드가 아닌 경우만)
        if (!isReadOnly) {
            const checkboxes = item.querySelectorAll('.app-workout-item-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('click', (e) => {
                    e.stopPropagation(); // 카드 클릭 이벤트 방지
                });
                
                checkbox.addEventListener('change', async (e) => {
                const isChecked = checkbox.checked;
                const type = checkbox.getAttribute('data-type');
                const recordId = checkbox.getAttribute('data-record-id');
                
                // currentAppUserId 확인
                if (!currentAppUserId) {
                    console.error('currentAppUserId가 설정되지 않았습니다.');
                    checkbox.checked = !isChecked;
                    alert('사용자 정보를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
                    return;
                }
                
                try {
                    if (type === 'record') {
                        // 운동기록 완료 상태 업데이트
                        const { updateWorkoutRecordCompleted } = await import('../api.js');
                        await updateWorkoutRecordCompleted(recordId, currentAppUserId, isChecked);
                    } else if (type === 'set') {
                        // 세트 완료 상태 업데이트
                        const setId = checkbox.getAttribute('data-set-id');
                        if (!setId) {
                            console.error('setId가 없습니다.');
                            checkbox.checked = !isChecked;
                            alert('세트 정보를 찾을 수 없습니다.');
                            return;
                        }
                        const { updateWorkoutSetCompleted } = await import('../api.js');
                        await updateWorkoutSetCompleted(recordId, setId, currentAppUserId, isChecked);
                        
                        // 세트가 체크될 때만 휴식 타이머 모달 띄우기
                        if (isChecked) {
                            await showRestTimerModal();
                        }
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
                    
                    // 전체 세트 체크박스 상태 업데이트 (세트 타입인 경우)
                    if (type === 'set') {
                        const allSetsCheckbox = item.querySelector('.app-workout-item-all-sets-checkbox');
                        if (allSetsCheckbox) {
                            const record = currentRecords.find(r => r.id === recordId);
                            if (record && record.sets) {
                                const allCompleted = record.sets.every(set => set.is_completed === true) && record.sets.length > 0;
                                allSetsCheckbox.checked = allCompleted;
                            }
                        }
                    }
                    
                    // 카드 다시 렌더링
                    await render(currentRecords);
                    
                    // 캘린더 업데이트
                    if (window.updateCalendarWorkoutRecords) {
                        window.updateCalendarWorkoutRecords();
                    }
                } catch (error) {
                    console.error('완료 상태 업데이트 오류:', error);
                    console.error('에러 상세:', {
                        type,
                        recordId,
                        currentAppUserId,
                        errorMessage: error.message,
                        errorStack: error.stack
                    });
                    // 실패 시 체크박스 상태 원복
                    checkbox.checked = !isChecked;
                    const errorMessage = error.message || '알 수 없는 오류';
                    alert(`완료 상태 업데이트에 실패했습니다: ${errorMessage}`);
                }
            });
        });
        }
        
        // 세트 삭제 버튼 이벤트 (세트 목록 상단의 하나의 버튼) (읽기 전용 모드가 아닌 경우만)
        if (!isReadOnly) {
            const removeSetBtn = item.querySelector('.app-workout-item-remove-set-btn');
            if (removeSetBtn) {
                removeSetBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (removeSetBtn.disabled) return;
                
                const recordId = removeSetBtn.getAttribute('data-record-id');
                const record = currentRecords.find(r => r.id === recordId);
                if (!record || !record.sets || record.sets.length <= 1) return;
                
                try {
                    // 마지막 세트 삭제
                    const updatedSets = record.sets.slice(0, -1);
                    // 세트 번호 재정렬
                    updatedSets.forEach((set, i) => {
                        set.set_number = i + 1;
                    });
                    
                    const { updateWorkoutRecord } = await import('../api.js');
                    const updatedRecord = await updateWorkoutRecord(recordId, {
                        app_user_id: currentAppUserId,
                        workout_date: record.workout_date,
                        workout_type_id: record.workout_type_id,
                        duration_minutes: record.duration_minutes,
                        sets: updatedSets.map(set => ({
                            id: set.id,
                            set_number: set.set_number,
                            weight: set.weight,
                            reps: set.reps,
                            is_completed: set.is_completed || false
                        })),
                        notes: record.notes
                    });
                    
                    if (!updatedRecord) {
                        throw new Error('업데이트된 레코드를 받지 못했습니다.');
                    }
                    
                    // 날짜 정규화 (YYYY-MM-DD 형식으로 변환)
                    if (updatedRecord.workout_date) {
                        if (updatedRecord.workout_date instanceof Date) {
                            const year = updatedRecord.workout_date.getFullYear();
                            const month = String(updatedRecord.workout_date.getMonth() + 1).padStart(2, '0');
                            const day = String(updatedRecord.workout_date.getDate()).padStart(2, '0');
                            updatedRecord.workout_date = `${year}-${month}-${day}`;
                        } else if (typeof updatedRecord.workout_date === 'string') {
                            updatedRecord.workout_date = updatedRecord.workout_date.split('T')[0];
                        }
                    }
                    
                    // 해당 카드만 업데이트
                    const recordIndex = currentRecords.findIndex(r => r.id === recordId);
                    if (recordIndex !== -1) {
                        // 기존 레코드의 날짜를 보존 (필터링을 위해)
                        const originalDate = currentRecords[recordIndex].workout_date;
                        currentRecords[recordIndex] = updatedRecord;
                        // 날짜가 변경되지 않았는지 확인
                        if (originalDate && updatedRecord.workout_date !== originalDate) {
                            updatedRecord.workout_date = originalDate;
                        }
                        // 현재 필터 날짜로 다시 렌더링 (전체 목록은 유지)
                        await render(currentRecords);
                    }
                    
                    // 캘린더 업데이트
                    if (window.updateCalendarWorkoutRecords) {
                        window.updateCalendarWorkoutRecords();
                    }
                } catch (error) {
                    console.error('세트 삭제 오류:', error);
                    alert('세트 삭제 중 오류가 발생했습니다.');
                }
                });
            }
        }
        
        // 세트 추가 버튼 이벤트 (세트 목록 상단의 하나의 버튼) (읽기 전용 모드가 아닌 경우만)
        if (!isReadOnly) {
            const addSetBtn = item.querySelector('.app-workout-item-add-set-btn');
            if (addSetBtn) {
                addSetBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    
                    const recordId = addSetBtn.getAttribute('data-record-id');
                    const record = currentRecords.find(r => r.id === recordId);
                    if (!record || !record.sets) return;
                    
                    try {
                        // 마지막 세트의 정보를 복사하여 새 세트 추가
                        const lastSet = record.sets[record.sets.length - 1];
                        const newSet = {
                        id: null, // 새 세트는 ID 없음
                        set_number: record.sets.length + 1,
                        weight: lastSet.weight,
                        reps: lastSet.reps,
                        is_completed: false
                    };
                    
                    const updatedSets = [...record.sets, newSet];
                    
                    const { updateWorkoutRecord } = await import('../api.js');
                    const updatedRecord = await updateWorkoutRecord(recordId, {
                        app_user_id: currentAppUserId,
                        workout_date: record.workout_date,
                        workout_type_id: record.workout_type_id,
                        duration_minutes: record.duration_minutes,
                        sets: updatedSets.map(set => ({
                            id: set.id,
                            set_number: set.set_number,
                            weight: set.weight,
                            reps: set.reps,
                            is_completed: set.is_completed || false
                        })),
                        notes: record.notes
                    });
                    
                    if (!updatedRecord) {
                        throw new Error('업데이트된 레코드를 받지 못했습니다.');
                    }
                    
                    // 날짜 정규화 (YYYY-MM-DD 형식으로 변환)
                    if (updatedRecord.workout_date) {
                        if (updatedRecord.workout_date instanceof Date) {
                            const year = updatedRecord.workout_date.getFullYear();
                            const month = String(updatedRecord.workout_date.getMonth() + 1).padStart(2, '0');
                            const day = String(updatedRecord.workout_date.getDate()).padStart(2, '0');
                            updatedRecord.workout_date = `${year}-${month}-${day}`;
                        } else if (typeof updatedRecord.workout_date === 'string') {
                            updatedRecord.workout_date = updatedRecord.workout_date.split('T')[0];
                        }
                    }
                    
                    // 해당 카드만 업데이트
                    const recordIndex = currentRecords.findIndex(r => r.id === recordId);
                    if (recordIndex !== -1) {
                        // 기존 레코드의 날짜를 보존 (필터링을 위해)
                        const originalDate = currentRecords[recordIndex].workout_date;
                        currentRecords[recordIndex] = updatedRecord;
                        // 날짜가 변경되지 않았는지 확인
                        if (originalDate && updatedRecord.workout_date !== originalDate) {
                            updatedRecord.workout_date = originalDate;
                        }
                        // 현재 필터 날짜로 다시 렌더링 (전체 목록은 유지)
                        await render(currentRecords);
                    }
                    
                    // 캘린더 업데이트
                    if (window.updateCalendarWorkoutRecords) {
                        window.updateCalendarWorkoutRecords();
                    }
                } catch (error) {
                    console.error('세트 추가 오류:', error);
                    alert('세트 추가 중 오류가 발생했습니다.');
                }
            });
        }
        }
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
