// 식단기록 목록 렌더링

import { formatDate, formatDateShort, showLoading, showError, showEmpty, escapeHtml } from '../utils.js';
import { getDietRecords, getBodyWeightByDate } from '../api.js';
import { getCurrentUser } from '../index.js';

let currentAppUserId = null;
let currentRecords = [];
let isReadOnly = false;
let currentFilters = {}; // 현재 필터 상태 저장
let commentsByDate = {}; // 날짜별 하루 코멘트 데이터
/** @type {Record<string, number|null|undefined>} */
let weightByDate = {};

const evaluationConfig = {
    verygood: { label: 'Very Good!', image: '/img/foodbadge/verygood.png' },
    good: { label: 'Good', image: '/img/foodbadge/good.png' },
    ok: { label: 'OK', image: '/img/foodbadge/ok.png' },
    bad: { label: 'Bad', image: '/img/foodbadge/bad.png' },
    verybad: { label: 'Very Bad!', image: '/img/foodbadge/verybad.png' }
};

/**
 * 식단기록 목록 초기화
 */
export async function init(appUserId, readOnly = false, immediateFilters = null) {
    currentAppUserId = appUserId;
    isReadOnly = readOnly;
    
    const { formatDate } = await import('../utils.js');
    const { getSelectedDate } = await import('./calendar.js');
    
    // 1단계: 선택된 날짜(또는 오늘) 데이터만 즉시 로드
    const selectedDateStr = immediateFilters ? null : getSelectedDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = immediateFilters 
        ? new Date(immediateFilters.startDate)
        : (selectedDateStr ? new Date(selectedDateStr) : today);
    const targetDateStr = formatDate(targetDate);
    
    const filters = {
        startDate: targetDateStr,
        endDate: targetDateStr
    };
    currentFilters = { ...filters }; // 필터 상태 저장
    currentFilterDate = targetDateStr; // 필터 날짜 설정
    await loadRecords(filters);
    
    // 2단계: 백그라운드에서 나머지 데이터 로드
    loadRemainingDataInBackground();
}

/**
 * 백그라운드에서 나머지 데이터 로드
 */
function loadRemainingDataInBackground() {
    // 브라우저가 여유가 있을 때 실행
    if ('requestIdleCallback' in window) {
        requestIdleCallback(async () => {
            await loadRemainingData();
        }, { timeout: 1000 }); // 최대 1초 후에는 실행
    } else {
        // requestIdleCallback을 지원하지 않으면 setTimeout 사용
        setTimeout(async () => {
            await loadRemainingData();
        }, 100);
    }
}

/**
 * 나머지 데이터 로드
 */
async function loadRemainingData() {
    try {
        const { formatDate } = await import('../utils.js');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const twoMonthsAgo = new Date(today);
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        twoMonthsAgo.setDate(1);
        
        const twoMonthsLater = new Date(today);
        twoMonthsLater.setMonth(twoMonthsLater.getMonth() + 2);
        twoMonthsLater.setDate(0);
        
        // 나머지 데이터 로드
        const additionalRecords = await getDietRecords(currentAppUserId, {
            startDate: formatDate(twoMonthsAgo),
            endDate: formatDate(twoMonthsLater)
        });
        
        // 기존 데이터와 병합 (중복 제거)
        const existingIds = new Set(currentRecords.map(r => r.id));
        const newRecords = additionalRecords.filter(r => !existingIds.has(r.id));
        
        // 새 데이터 추가
        currentRecords = [...currentRecords, ...newRecords];
        
        // 현재 필터가 적용되어 있으면 필터링된 상태 유지
        // render() 함수 내부에서 currentFilterDate로 필터링하므로 그대로 호출
        await render(currentRecords);
        
        // 필터 상태 업데이트 (전체 범위로 확장)
        currentFilters = {
            startDate: formatDate(twoMonthsAgo),
            endDate: formatDate(twoMonthsLater)
        };
    } catch (error) {
        console.error('백그라운드 데이터 로드 오류:', error);
    }
}

let currentFilterDate = null;

function formatWeightDisplay(kg) {
    if (!Number.isFinite(kg)) return '';
    const hasDecimal = !Number.isInteger(kg);
    return kg.toLocaleString('en-US', {
        minimumFractionDigits: hasDecimal ? 1 : 0,
        maximumFractionDigits: hasDecimal ? 1 : 0
    });
}

async function ensureWeightsLoaded(dates) {
    const unique = [...new Set(dates.filter(Boolean))];
    const missing = unique.filter(d => !Object.prototype.hasOwnProperty.call(weightByDate, d));
    if (missing.length === 0) return;

    await Promise.all(missing.map(async (dateStr) => {
        try {
            const record = await getBodyWeightByDate(currentAppUserId, dateStr);
            weightByDate[dateStr] = record?.weight_kg != null ? record.weight_kg : null;
        } catch {
            weightByDate[dateStr] = null;
        }
    }));
}

export function invalidateWeightForDate(dateStr) {
    if (dateStr) {
        delete weightByDate[dateStr];
    }
}

/**
 * 날짜별 하루 코멘트 로드
 */
async function loadCommentsForDates(dates, additionalDates = []) {
    const allDates = [...new Set([...dates, ...additionalDates])];
    if (allDates.length === 0) {
        return;
    }
    
    try {
        const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
        const targetAppUserId = connectedMemberAppUserId || currentAppUserId;
        
        if (!targetAppUserId) {
            return;
        }
        
        const sortedDates = [...allDates].sort();
        const startDate = sortedDates[0];
        const endDate = sortedDates[sortedDates.length - 1];
        
        const response = await fetch(`/api/diet-records/${targetAppUserId}/daily-comments?startDate=${startDate}&endDate=${endDate}`);
        if (response.ok) {
            const data = await response.json();
            const comments = data.comments || [];
            
            if (allDates.length === 1) {
                const targetDate = allDates[0];
                let normalizedTargetDate = targetDate;
                if (normalizedTargetDate instanceof Date) {
                    normalizedTargetDate = formatDate(normalizedTargetDate);
                } else if (typeof normalizedTargetDate === 'string') {
                    normalizedTargetDate = normalizedTargetDate.split('T')[0];
                }
                delete commentsByDate[normalizedTargetDate];
            }
            
            comments.forEach(comment => {
                let date = comment.diet_date;
                
                // 한국시간 기준으로 날짜 변환
                if (date instanceof Date) {
                    const koreanTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
                    date = formatDate(koreanTime);
                } else if (typeof date === 'string') {
                    const dateObj = new Date(date);
                    if (date.includes('Z') || (date.includes('+') || date.includes('-')) && date.length > 10) {
                        const koreanTime = new Date(dateObj.getTime() + (9 * 60 * 60 * 1000));
                        date = formatDate(koreanTime);
                    } else {
                        date = date.split('T')[0];
                    }
                }
                
                if (!commentsByDate[date]) {
                    commentsByDate[date] = [];
                }
                const existingIds = new Set(commentsByDate[date].map(c => c.id));
                if (!existingIds.has(comment.id)) {
                    commentsByDate[date].push(comment);
                }
            });
            
            Object.keys(commentsByDate).forEach(date => {
                commentsByDate[date].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            });
        }
    } catch (error) {
        console.error('코멘트 로드 오류:', error);
    }
}

/**
 * 식단기록 목록 로드
 */
async function loadRecords(filters = {}) {
    let container = document.getElementById('diet-list-wrapper');
    if (!container) {
        container = document.getElementById('app-user-content');
    }
    if (!container) return;
    
    // 필터 상태 저장 (초기화 필터 유지)
    if (filters.startDate || filters.endDate) {
        currentFilters = { ...currentFilters, ...filters };
    }
    
    showLoading(container);
    
    try {
        // 저장된 필터 사용 (빈 필터인 경우 기본 필터 사용)
        const filtersToUse = Object.keys(filters).length > 0 ? filters : currentFilters;
        const records = await getDietRecords(currentAppUserId, filtersToUse);
        currentRecords = records;
        await render(records);
    } catch (error) {
        console.error('식단기록 로드 오류:', error);
        showError(container, '식단기록을 불러오는 중 오류가 발생했습니다.');
    }
}

/**
 * 식단기록 목록 렌더링
 */
async function render(records) {
    let container = document.getElementById('diet-list-wrapper');
    if (!container) {
        container = document.getElementById('app-user-content');
    }
    if (!container) return;
    
    // 선택된 날짜로 필터링
    let filteredRecords = records;
    if (currentFilterDate) {
        filteredRecords = records.filter(record => {
            return record.meal_date === currentFilterDate;
        });
    }
    
    records = filteredRecords;
    
    // 날짜별로 그룹화
    const recordsByDate = {};
    records.forEach(record => {
        const dateStr = record.meal_date;
        if (!recordsByDate[dateStr]) {
            recordsByDate[dateStr] = [];
        }
        recordsByDate[dateStr].push(record);
    });
    
    // 코멘트 데이터 로드 (필요한 날짜만 로드)
    const dietDates = Object.keys(recordsByDate);
    let targetDatesForComments = [];
    if (currentFilterDate) {
        targetDatesForComments = [currentFilterDate];
    } else if (dietDates.length > 0) {
        targetDatesForComments = dietDates;
    }
    
    if (targetDatesForComments.length > 0) {
        await loadCommentsForDates(targetDatesForComments, []);
    }
    
    const allDatesSet = new Set();
    dietDates.forEach(date => allDatesSet.add(date));

    const weightCandidateDates = new Set(dietDates);
    if (currentFilterDate) {
        weightCandidateDates.add(currentFilterDate);
    }
    Object.keys(commentsByDate).forEach(date => weightCandidateDates.add(date));

    await ensureWeightsLoaded(Array.from(weightCandidateDates));
    
    if (currentFilterDate) {
        if (commentsByDate[currentFilterDate] && commentsByDate[currentFilterDate].length > 0) {
            allDatesSet.add(currentFilterDate);
        }
        if (weightByDate[currentFilterDate] != null) {
            allDatesSet.add(currentFilterDate);
        }
    } else {
        Object.keys(commentsByDate).forEach(date => {
            if (commentsByDate[date] && commentsByDate[date].length > 0) {
                allDatesSet.add(date);
            }
        });
        weightCandidateDates.forEach(date => {
            if (weightByDate[date] != null) {
                allDatesSet.add(date);
            }
        });
    }
    
    const sortedDates = Array.from(allDatesSet).sort((a, b) => new Date(b) - new Date(a));
    
    if (sortedDates.length === 0) {
        showEmpty(container, '식단기록이 없습니다.');
        return;
    }
    
    let html = '<div class="app-diet-list">';
    
    for (const dateStr of sortedDates) {
        const dateRecords = recordsByDate[dateStr] || [];
        // 각 날짜 내에서 meal_time 순으로 정렬 (시간이 없는 것은 마지막에)
        dateRecords.sort((a, b) => {
            if (!a.meal_time && !b.meal_time) return 0;
            if (!a.meal_time) return 1; // a가 시간 없으면 뒤로
            if (!b.meal_time) return -1; // b가 시간 없으면 뒤로
            return a.meal_time.localeCompare(b.meal_time);
        });
        
        const dateObj = new Date(dateStr + 'T00:00:00');
        const dateDisplay = formatDateShort(dateObj);
        
        const dateComments = commentsByDate[dateStr] || [];
        
        if (dateComments.length > 0) {
            const currentUser = getCurrentUser();
            const isTrainerViewer = currentUser?.is_trainer === true || currentUser?.isTrainer === true;
            const isViewingMember = Boolean(localStorage.getItem('connectedMemberAppUserId'));
            html += `<div class="app-diet-daily-comments-section">`;
            dateComments.forEach(comment => {
                let commentTime = '';
                if (comment.created_at) {
                    const date = new Date(comment.created_at);
                    const hours = date.getHours();
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    const ampm = hours >= 12 ? 'PM' : 'AM';
                    const displayHours = hours % 12 || 12;
                    commentTime = `${displayHours}:${minutes} ${ampm}`;
                }
                
                const commentBody = comment.comment ?? comment.comment_text ?? '';
                const commentText = escapeHtml(commentBody).replace(/\n/g, '<br>');
                const isTrainerComment = comment.commenter_type === 'trainer';
                const isMemberComment = !isTrainerComment;
                const displayName = isTrainerComment
                    ? `${escapeHtml(comment.commenter_name || comment.commenter_username || '트레이너')} 트레이너`
                    : (isTrainerViewer && isViewingMember
                        ? `${escapeHtml(comment.commenter_name || comment.commenter_username || '회원')} 회원님`
                        : '나');
                const wrapperClass = isMemberComment
                    ? 'app-diet-card-comment-wrapper-mine'
                    : 'app-diet-card-comment-wrapper-trainer';
                const bubbleClass = isMemberComment
                    ? 'app-diet-card-comment-bubble-mine'
                    : 'app-diet-card-comment-bubble-trainer';
                
                html += `
                    <div class="app-diet-card-comment-wrapper ${wrapperClass}">
                        ${isMemberComment
                            ? `<div class="app-diet-card-comment-user-name">${displayName}</div>`
                            : `<div class="app-diet-card-comment-trainer-name">${displayName}</div>`}
                        <div class="app-diet-card-comment-bubble ${bubbleClass}">
                            <div class="app-diet-card-comment-content">
                                <div class="app-diet-card-comment-text">${commentText}</div>
                                ${commentTime ? `<div class="app-diet-card-comment-time">${commentTime}</div>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }
        
        const weightKg = weightByDate[dateStr];
        const hasWeight = weightKg != null && Number.isFinite(weightKg);

        if (dateRecords.length > 0 || hasWeight) {
            html += `
                <div class="app-diet-date-section" data-date="${dateStr}">
                    <div class="app-diet-date-header">
                        <div class="app-diet-date-title">${dateDisplay}</div>
                        ${dateRecords.length > 0 ? `<div class="app-diet-date-count">${dateRecords.length}건</div>` : ''}
                    </div>
                    ${hasWeight ? `
                    <div class="app-diet-weight-banner" aria-label="체중">
                        <span class="app-diet-weight-banner-label">체중</span>
                        <span class="app-diet-weight-banner-value">${formatWeightDisplay(weightKg)} kg</span>
                    </div>
                    ` : ''}
                    ${dateRecords.length > 0 ? `<div class="app-diet-items">` : ''}
            `;
            
            for (const record of dateRecords) {
            // 시간 포맷팅 (HH:mm 형식으로 분 단위까지만)
            let timeDisplay = '';
            if (record.meal_time) {
                // "HH:mm" 또는 "HH:mm:ss" 형식 처리
                const timeMatch = record.meal_time.match(/^(\d{1,2}):(\d{2})/);
                if (timeMatch) {
                    const hours = String(parseInt(timeMatch[1], 10)).padStart(2, '0');
                    const minutes = timeMatch[2];
                    timeDisplay = `${hours}:${minutes}`;
                } else {
                    timeDisplay = record.meal_time;
                }
            }
            
            // 메모에 줄바꿈이 있으면 <br>로 변환
            const notesRaw = record.notes || '';
            const notes = notesRaw ? escapeHtml(notesRaw).replace(/\n/g, '<br>') : '-';
            
            // 식사 구분 한글 변환
            const mealTypeLabels = {
                'breakfast': '아침',
                'lunch': '점심',
                'dinner': '저녁',
                'snack': '간식'
            };
            const mealTypeLabel = record.meal_type ? mealTypeLabels[record.meal_type] || record.meal_type : '';
            const hasImage = record.image_thumbnail_url || record.image_url;
            // 코멘트는 배열이거나 undefined일 수 있음
            const comments = Array.isArray(record.comments) ? record.comments : [];
            // 모든 코멘트 표시 (유저 + 트레이너) - 필터링 없이 모두 표시
            const allComments = comments.filter(c => {
                if (!c) return false;
                // commenter_type이 있으면 그대로 사용, 없으면 기본값으로 처리
                const commenterType = c.commenter_type || 'user';
                return commenterType === 'user' || commenterType === 'trainer';
            });
            
            const evaluationInfo = record.trainer_evaluation ? evaluationConfig[record.trainer_evaluation] : null;
            const evaluationBadge = evaluationInfo
                ? `<div class="app-diet-evaluation-badge" data-evaluation="${record.trainer_evaluation}">
                        <img src="${evaluationInfo.image}" alt="${evaluationInfo.label}">
                   </div>`
                : '';
            
            html += `
                <div class="app-diet-item-card" data-id="${record.id}">
                    ${evaluationBadge}
                    <div class="app-diet-card-content">
                        ${hasImage ? `
                            <div class="app-diet-card-image">
                                <img src="${record.image_thumbnail_url || record.image_url}" 
                                     alt="식단 사진" 
                                     loading="lazy"
                                     onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 100\\'%3E%3Ctext y=\\'.9em\\' font-size=\\'90\\'%3E🍽%3C/text%3E%3C/svg%3E'">
                            </div>
                        ` : `
                            <div class="app-diet-card-image app-diet-card-image-placeholder">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                    <polyline points="21 15 16 10 5 21"></polyline>
                                </svg>
                            </div>
                        `}
                        <div class="app-diet-card-info">
                            <div class="app-diet-card-header">
                                <div class="app-diet-card-title-row">
                                    <div class="app-diet-card-time-group">
                                        ${timeDisplay ? `<span class="app-diet-card-time">${timeDisplay}</span>` : ''}
                                        ${mealTypeLabel ? `<span class="app-diet-card-meal-type">${mealTypeLabel}</span>` : ''}
                                    </div>
                                    ${!isReadOnly ? `
                                        <button class="app-diet-card-edit-btn" data-id="${record.id}" title="수정/삭제">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <circle cx="5" cy="12" r="1"></circle>
                                                <circle cx="12" cy="12" r="1"></circle>
                                                <circle cx="19" cy="12" r="1"></circle>
                                            </svg>
                                        </button>
                                    ` : ''}
                                </div>
                                <div class="app-diet-card-notes">${notes}</div>
                                ${allComments.length > 0 ? `
                                    <div class="app-diet-card-comments-section">
                                        ${allComments.map(comment => {
                                            const commentText = escapeHtml(comment.comment_text).replace(/\r?\n/g, '<br>');
                                            // 시간을 "11:11 AM" 형식으로 변환 (이미 한국 시간으로 저장됨)
                                            let commentTime = '';
                                            if (comment.created_at) {
                                                const date = new Date(comment.created_at);
                                                const hours = date.getHours();
                                                const minutes = String(date.getMinutes()).padStart(2, '0');
                                                const ampm = hours >= 12 ? 'PM' : 'AM';
                                                const displayHours = hours % 12 || 12;
                                                commentTime = `${displayHours}:${minutes} ${ampm}`;
                                            }
                                            // 코멘트 정렬 결정:
                                            // - 트레이너 코멘트: 항상 왼쪽 정렬
                                            // - 유저 코멘트: 현재 사용자가 작성한 경우만 오른쪽 정렬
                                            const isTrainerComment = comment.commenter_type === 'trainer';
                                            const isMyComment = !isTrainerComment && currentAppUserId && comment.commenter_id === currentAppUserId;
                                            const trainerName = isTrainerComment && comment.commenter_name ? escapeHtml(comment.commenter_name) : '';
                                            
                                            return `
                                                <div class="app-diet-card-comment-wrapper ${isTrainerComment ? 'app-diet-card-comment-wrapper-trainer' : ''} ${isMyComment ? 'app-diet-card-comment-wrapper-mine' : ''}">
                                                    ${isTrainerComment && trainerName ? `
                                                        <div class="app-diet-card-comment-trainer-name">${trainerName}</div>
                                                    ` : ''}
                                                    ${isMyComment ? `
                                                        <div class="app-diet-card-comment-user-name">나</div>
                                                    ` : ''}
                                                    <div class="app-diet-card-comment-bubble ${isMyComment ? 'app-diet-card-comment-bubble-mine' : ''} ${isTrainerComment ? 'app-diet-card-comment-bubble-trainer' : ''}">
                                                        <div class="app-diet-card-comment-content">
                                                            <div class="app-diet-card-comment-text">${commentText}</div>
                                                            ${commentTime ? `<div class="app-diet-card-comment-time">${commentTime}</div>` : ''}
                                                        </div>
                                                    </div>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            }
            
            html += dateRecords.length > 0 ? `
                    </div>
                </div>
            ` : `
                </div>
            `;
        }
    }
    
    html += '</div>';
    container.innerHTML = html;
    
    // 이벤트 리스너 설정
    setupEventListeners();
}

/**
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
    const container = document.getElementById('diet-list-wrapper');
    if (!container) return;
    
    // 이미 이벤트 리스너가 등록되어 있으면 중복 등록 방지
    if (container._dietListEventListenersSetup) {
        return;
    }
    
    const currentUser = getCurrentUser();
    const isTrainerViewer = currentUser?.is_trainer === true || currentUser?.isTrainer === true;
    const isTrainerProxy = Boolean(localStorage.getItem('connectedMemberAppUserId'));
    const canEvaluate = !isReadOnly && isTrainerViewer && isTrainerProxy;
    
    let longPressTimer = null;
    let startX = 0;
    let startY = 0;
    
    const clearLongPress = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    };
    
    if (canEvaluate) {
        container.addEventListener('pointerdown', (e) => {
            const dietItem = e.target.closest('.app-diet-item-card');
            if (!dietItem) return;
            if (e.target.closest('.app-diet-card-edit-btn')) return;
            e.preventDefault();
            
            startX = e.clientX;
            startY = e.clientY;
            clearLongPress();
            
            longPressTimer = setTimeout(async () => {
                container._dietLongPressTriggered = true;
                const recordId = dietItem.getAttribute('data-id');
                const record = currentRecords.find(r => r.id === recordId);
                if (record) {
                    const { showDietEvaluationModal } = await import('./evaluation.js');
                    showDietEvaluationModal(currentAppUserId, record, async (updatedRecord) => {
                        if (updatedRecord) {
                            const index = currentRecords.findIndex(r => r.id === updatedRecord.id);
                            if (index !== -1) {
                                currentRecords[index] = { ...currentRecords[index], ...updatedRecord };
                                await render(currentRecords);
                                return;
                            }
                        }
                        await refresh();
                    });
                }
            }, 650);
        });
        
        container.addEventListener('pointermove', (e) => {
            if (!longPressTimer) return;
            const deltaX = Math.abs(e.clientX - startX);
            const deltaY = Math.abs(e.clientY - startY);
            if (deltaX > 8 || deltaY > 8) {
                clearLongPress();
            }
        });
        
        container.addEventListener('pointerup', clearLongPress);
        container.addEventListener('pointercancel', clearLongPress);
        container.addEventListener('pointerleave', clearLongPress);
    }
    
    // 수정/삭제 버튼 클릭
    container.addEventListener('click', async (e) => {
        if (container._dietLongPressTriggered) {
            container._dietLongPressTriggered = false;
            return;
        }
        const editBtn = e.target.closest('.app-diet-card-edit-btn');
        if (editBtn) {
            e.stopPropagation(); // 카드 클릭 이벤트 방지
            const recordId = editBtn.getAttribute('data-id');
            if (recordId) {
                const { showDietEditModal } = await import('./edit.js');
                const record = currentRecords.find(r => r.id === recordId);
                if (record) {
                    showDietEditModal(currentAppUserId, record, () => {
                        refresh();
                    });
                }
            }
            return;
        }
        
        // 식단기록 아이템 클릭 (상세 보기)
        const dietItem = e.target.closest('.app-diet-item-card');
        if (dietItem) {
            const recordId = dietItem.getAttribute('data-id');
            if (recordId) {
                const { showDietDetailModal } = await import('./detail.js');
                const record = currentRecords.find(r => r.id === recordId);
                if (record) {
                    showDietDetailModal(currentAppUserId, record, isReadOnly, () => {
                        refresh();
                    });
                }
            }
        }
    });
    
    container._dietListEventListenersSetup = true;
}

/**
 * 날짜로 필터링
 */
export async function filterByDate(dateStr) {
    currentFilterDate = dateStr;
    
    // 해당 날짜의 데이터가 이미 로드되어 있는지 확인
    const hasData = currentRecords.some(r => r.meal_date === dateStr);
    
    if (!hasData) {
        // 데이터가 없으면 해당 날짜 데이터 로드
        try {
            const { getDietRecords } = await import('../api.js');
            const newRecords = await getDietRecords(currentAppUserId, {
                startDate: dateStr,
                endDate: dateStr
            });
            
            // 기존 데이터에 추가 (중복 제거)
            const existingIds = new Set(currentRecords.map(r => r.id));
            const uniqueNewRecords = newRecords.filter(r => !existingIds.has(r.id));
            currentRecords = [...currentRecords, ...uniqueNewRecords];
        } catch (error) {
            console.error('날짜별 데이터 로드 오류:', error);
        }
    }

    // 코멘트도 함께 로드
    await loadCommentsForDates([dateStr], []);
    
    // 필터링하여 렌더링
    const filters = {
        startDate: dateStr,
        endDate: dateStr
    };
    currentFilters = filters; // 필터 상태 업데이트
    await render(currentRecords);
}

/**
 * 목록 새로고침
 */
export async function refresh(commentDate = null) {
    // 현재 선택된 날짜가 있으면 그 날짜로 필터링, 없으면 저장된 필터 사용
    let filtersToUse = currentFilters;
    if (currentFilterDate) {
        filtersToUse = {
            startDate: currentFilterDate,
            endDate: currentFilterDate
        };
        currentFilters = filtersToUse; // 필터 상태 업데이트
    }
    
    await loadRecords(filtersToUse);

    let datesToReload = [];
    if (commentDate) {
        datesToReload = [commentDate];
    } else {
        const sortedDates = Object.keys(
            currentRecords.reduce((acc, record) => {
                const date = record.meal_date;
                if (date) {
                    acc[date] = true;
                }
                return acc;
            }, {})
        );
        datesToReload = sortedDates;
    }
    
    if (datesToReload.length > 0) {
        await loadCommentsForDates(datesToReload);
        await render(currentRecords);
    } else {
        if (commentDate) {
            await loadCommentsForDates([commentDate]);
            await render(currentRecords);
        } else {
            await render(currentRecords);
        }
    }
    
    // 캘린더도 업데이트
    if (window.updateCalendarDietRecords) {
        await window.updateCalendarDietRecords();
    }
}
