// 운동기록 목록 렌더링

import { formatDate, formatDateShort, formatNumber, showLoading, showError, showEmpty, escapeHtml, formatWeight, autoResizeText } from '../utils.js';
import { getWorkoutRecords, updateWorkoutRecordCompleted, updateWorkoutSetCompleted, getUserSettings, updateUserSettings, getAppUsers, reorderWorkoutRecords } from '../api.js';
import { getCurrentUser } from '../index.js';
import { showWorkoutGuideDetailModal } from '../guide-modal.js';

let currentAppUserId = null;
let currentRecords = [];
let sessionsByDate = {}; // 날짜별 세션 데이터
let trainerNameMap = {}; // 트레이너 username -> name 매핑
let cachedTimerSettings = null; // 타이머 설정 캐시
const TIMER_SETTINGS_STORAGE_KEY = 'workout_rest_timer_settings';
const FAVORITES_ONLY_STORAGE_KEY = 'workout_show_favorites_only';
let workoutGuideMap = new Map();
let calendarUpdateTimer = null;
let suppressControls = false;

function scheduleCalendarUpdate() {
    if (!window.updateCalendarWorkoutRecords) {
        return;
    }
    if (calendarUpdateTimer) {
        clearTimeout(calendarUpdateTimer);
    }
    calendarUpdateTimer = setTimeout(() => {
        calendarUpdateTimer = null;
        window.updateCalendarWorkoutRecords().catch(error => {
            console.error('캘린더 업데이트 오류:', error);
        });
    }, 400);
}

function getCachedTimerSettings() {
    if (cachedTimerSettings) {
        return cachedTimerSettings;
    }
    try {
        const stored = localStorage.getItem(TIMER_SETTINGS_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && typeof parsed === 'object') {
                cachedTimerSettings = parsed;
                return cachedTimerSettings;
            }
        }
    } catch (e) {
        // ignore
    }
    return null;
}

function setCachedTimerSettings(settings) {
    cachedTimerSettings = settings;
    try {
        localStorage.setItem(TIMER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
        // ignore
    }
}

function getCachedShowFavoritesOnly() {
    try {
        const stored = localStorage.getItem(FAVORITES_ONLY_STORAGE_KEY);
        if (stored === null) {
            return null;
        }
        return stored === 'true';
    } catch (e) {
        // ignore
    }
    return null;
}

function setCachedShowFavoritesOnly(value) {
    try {
        localStorage.setItem(FAVORITES_ONLY_STORAGE_KEY, value ? 'true' : 'false');
    } catch (e) {
        // ignore
    }
}
let commentsByDate = {}; // 날짜별 코멘트 데이터

let isReadOnly = false;
const pendingRecordSaves = new Map();
const recordSaveVersions = new Map();
const RECORD_SAVE_DEBOUNCE_MS = 300;

function queueRecordSave(recordId, recordSnapshot, prevRecord) {
    const existing = pendingRecordSaves.get(recordId);
    const nextVersion = (recordSaveVersions.get(recordId) || 0) + 1;
    recordSaveVersions.set(recordId, nextVersion);
    
    const entry = existing || { timerId: null, pendingRecord: null, prevRecord: null, version: 0 };
    entry.version = nextVersion;
    entry.pendingRecord = JSON.parse(JSON.stringify(recordSnapshot));
    if (!entry.prevRecord && prevRecord) {
        entry.prevRecord = prevRecord;
    }
    
    if (entry.timerId) {
        clearTimeout(entry.timerId);
    }
    entry.timerId = setTimeout(() => {
        flushRecordSave(recordId).catch(error => {
            console.error('레코드 저장 처리 오류:', error);
        });
    }, RECORD_SAVE_DEBOUNCE_MS);
    
    pendingRecordSaves.set(recordId, entry);
}

async function flushRecordSave(recordId) {
    const entry = pendingRecordSaves.get(recordId);
    if (!entry) {
        return;
    }
    pendingRecordSaves.delete(recordId);
    
    const version = entry.version;
    const recordSnapshot = entry.pendingRecord;
    if (!recordSnapshot) {
        return;
    }
    
    const recordIndex = currentRecords.findIndex(r => r.id === recordId);
    if (recordIndex === -1) {
        return;
    }
    
    try {
        const { updateWorkoutRecord } = await import('../api.js');
        const updatedRecord = await updateWorkoutRecord(recordId, {
            app_user_id: currentAppUserId,
            workout_date: recordSnapshot.workout_date,
            workout_type_id: recordSnapshot.workout_type_id,
            duration_minutes: recordSnapshot.duration_minutes,
            sets: (recordSnapshot.sets || []).map(set => ({
                id: set.id,
                set_number: set.set_number,
                weight: set.weight,
                reps: set.reps,
                is_completed: set.is_completed || false
            })),
            notes: recordSnapshot.notes
        });
        
        if (!updatedRecord) {
            throw new Error('업데이트된 레코드를 받지 못했습니다.');
        }
        
        if ((recordSaveVersions.get(recordId) || 0) !== version) {
            return;
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
        
        scheduleCalendarUpdate();
    } catch (error) {
        if ((recordSaveVersions.get(recordId) || 0) !== version) {
            return;
        }
        
        console.error('세트 업데이트 오류:', error);
        if (recordIndex !== -1 && entry.prevRecord) {
            currentRecords[recordIndex] = entry.prevRecord;
            await render(currentRecords);
            scheduleCalendarUpdate();
        }
        alert('세트 업데이트 중 오류가 발생했습니다.');
    }
}

/**
 * 운동기록 목록 초기화
 */
export async function init(appUserId, readOnly = false, immediateFilters = null) {
    currentAppUserId = appUserId;
    isReadOnly = readOnly;
    
    const { formatDate } = await import('../utils.js');
    const { getSelectedDate } = await import('./calendar.js');

    // 초기 로딩 시 타이머/즐겨찾기 설정을 로컬에 캐시
    preloadWorkoutUserSettings().catch(error => {
        console.error('운동 설정 사전 로드 오류:', error);
    });

    await loadWorkoutGuideItems();
    
    // 1단계: 선택된 날짜(또는 오늘) 데이터만 즉시 로드
    const selectedDateStr = immediateFilters ? null : getSelectedDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = immediateFilters 
        ? new Date(immediateFilters.startDate)
        : (selectedDateStr ? new Date(selectedDateStr) : today);
    const targetDateStr = formatDate(targetDate);
    
    // 선택된 날짜(또는 오늘) 데이터만 먼저 로드
    await loadRecords({
        startDate: targetDateStr,
        endDate: targetDateStr
    });
    
    // 2단계: 백그라운드에서 나머지 데이터 로드
    loadRemainingDataInBackground();
}

/**
 * 운동 관련 사용자 설정 사전 로드
 */
async function preloadWorkoutUserSettings() {
    const hasTimerSettings = Boolean(getCachedTimerSettings());
    const showFavoritesOnly = getCachedShowFavoritesOnly();
    const hasFavoriteSettings = showFavoritesOnly !== null;
    
    if (hasTimerSettings && hasFavoriteSettings) {
        return;
    }
    if (!currentAppUserId) {
        return;
    }
    
    const settings = await getUserSettings(currentAppUserId);
    if (!hasTimerSettings) {
        const restTimerEnabled = settings.rest_timer_enabled !== undefined ? settings.rest_timer_enabled : true;
        const restMinutes = settings.rest_timer_minutes !== undefined ? settings.rest_timer_minutes : 0;
        const restSeconds = settings.rest_timer_seconds !== undefined ? settings.rest_timer_seconds : 30;
        setCachedTimerSettings({
            restTimerEnabled,
            restMinutes,
            restSeconds
        });
    }
    if (!hasFavoriteSettings) {
        setCachedShowFavoritesOnly(settings.show_favorites_only === true);
    }
}

async function loadWorkoutGuideItems() {
    try {
        const response = await fetch('/api/workout-guide-items');
        if (!response.ok) {
            throw new Error('운동 가이드 목록 조회 실패');
        }
        const data = await response.json();
        const items = Array.isArray(data.items) ? data.items : [];
        const activeItems = items.filter(item => item.guide_is_active !== false);
        workoutGuideMap = new Map(activeItems.map(item => [String(item.id), buildGuideItem(item)]));
    } catch (error) {
        console.error('운동 가이드 목록 조회 오류:', error);
        workoutGuideMap = new Map();
    }
}

function buildGuideItem(item) {
    const categories = [
        item.category_1_name,
        item.category_2_name,
        item.category_3_name,
        item.category_4_name
    ].filter(Boolean).join(' / ');
    const descriptionParts = [];
    if (item.guide_description) {
        descriptionParts.push(item.guide_description);
    } else if (categories) {
        descriptionParts.push(categories);
    }
    return {
        id: item.id,
        title: item.guide_title || item.name,
        description: descriptionParts.join(' · '),
        videoUrl: item.guide_video_url || '',
        externalLink: item.guide_external_link || ''
    };
}

function formatVolumeKg(total) {
    if (!isFinite(total) || total <= 0) {
        return '0kg';
    }
    const rounded = Math.round(total * 10) / 10;
    const hasDecimal = !Number.isInteger(rounded);
    const formatted = rounded.toLocaleString('en-US', {
        minimumFractionDigits: hasDecimal ? 1 : 0,
        maximumFractionDigits: hasDecimal ? 1 : 0
    });
    return `${formatted}kg`;
}

function calculateVolumeForRecords(records = []) {
    let total = 0;
    let hasVolume = false;
    records.forEach(record => {
        let sets = [];
        if (Array.isArray(record.sets)) {
            sets = record.sets;
        } else if (typeof record.sets === 'string') {
            try {
                const parsed = JSON.parse(record.sets);
                if (Array.isArray(parsed)) {
                    sets = parsed;
                }
            } catch (error) {
                // ignore parse errors
            }
        }
        if (sets.length > 0) {
            hasVolume = true;
        }
        sets.forEach(set => {
            const weight = parseFloat(set.weight);
            const reps = parseFloat(set.reps);
            if (isFinite(weight) && isFinite(reps)) {
                total += weight * reps;
                hasVolume = true;
            }
        });
    });
    return { hasVolume, total };
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
        const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
        
        // 나머지 데이터 로드
        const additionalRecords = await getWorkoutRecords(currentAppUserId, {
            startDate: formatDate(currentMonthStart),
            endDate: formatDate(nextMonthEnd)
        });
        
        // 기존 데이터와 병합 (중복 제거)
        const existingIds = new Set(currentRecords.map(r => r.id));
        const newRecords = additionalRecords.filter(r => !existingIds.has(r.id));
        
        // 새 데이터 추가
        currentRecords = [...currentRecords, ...newRecords];
        
        // 현재 필터가 적용되어 있지 않으면 전체 목록 업데이트
        if (!currentFilterDate) {
            await render(currentRecords);
        }
    } catch (error) {
        console.error('백그라운드 데이터 로드 오류:', error);
    }
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
    
    // 트레이너 이름 매핑 로드는 병렬로 처리 (렌더링과 병렬)
    // await를 제거하여 비동기로 처리하되, 필요시 await loadTrainerNameMap() 호출 가능
    loadTrainerNameMap().catch(error => {
        console.error('트레이너 이름 매핑 로드 오류:', error);
    });
}

/**
 * 날짜별 코멘트 로드
 */
async function loadCommentsForDates(dates, additionalDates = []) {
    // dates와 additionalDates를 합쳐서 모든 날짜 포함
    const allDates = [...new Set([...dates, ...additionalDates])];
    if (allDates.length === 0) {
        return;
    }
    
    try {
        // 트레이너 모드인 경우 실제 회원의 app_user_id 사용
        const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
        const targetAppUserId = connectedMemberAppUserId || currentAppUserId;
        
        if (!targetAppUserId) {
            return;
        }
        
        // 날짜 범위 계산
        const sortedDates = [...allDates].sort();
        const startDate = sortedDates[0];
        const endDate = sortedDates[sortedDates.length - 1];
        
        // 코멘트 조회
        const response = await fetch(`/api/workout-records/${targetAppUserId}/comments?startDate=${startDate}&endDate=${endDate}`);
        if (response.ok) {
            const data = await response.json();
            const comments = data.comments || [];
            
            // 날짜별로 그룹화 (기존 데이터에 추가, 중복 제거)
            // formatDate 함수는 이미 상단에서 import되어 있음
            
            // 특정 날짜만 다시 로드하는 경우, 해당 날짜의 기존 코멘트를 먼저 제거 (삭제된 코멘트 반영을 위해)
            if (allDates.length === 1) {
                const targetDate = allDates[0];
                // 날짜 정규화 (한국시간 기준)
                let normalizedTargetDate = targetDate;
                if (normalizedTargetDate instanceof Date) {
                    const koreanTime = new Date(normalizedTargetDate.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
                    normalizedTargetDate = formatDate(koreanTime);
                } else if (typeof normalizedTargetDate === 'string') {
                    normalizedTargetDate = normalizedTargetDate.split('T')[0];
                }
                // 해당 날짜의 기존 코멘트 제거
                delete commentsByDate[normalizedTargetDate];
            }
            
            const dateMapping = {};
            comments.forEach(comment => {
                // 날짜 형식 정규화 (YYYY-MM-DD) - 한국시간 기준
                let date = comment.workout_date;
                const originalDate = date;
                
                // 한국시간 기준으로 날짜 변환
                if (date instanceof Date) {
                    // Date 객체인 경우 한국시간으로 변환
                    const koreanTime = new Date(date.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
                    date = formatDate(koreanTime);
                } else if (typeof date === 'string') {
                    // ISO 형식 문자열인 경우 한국시간으로 변환
                    const dateObj = new Date(date);
                    // UTC 시간이면 한국시간으로 변환
                    if (date.includes('Z') || date.includes('+') || date.includes('-') && date.length > 10) {
                        const koreanTime = new Date(dateObj.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
                        date = formatDate(koreanTime);
                    } else {
                        // 이미 YYYY-MM-DD 형식이면 그대로 사용
                        date = date.split('T')[0];
                    }
                }
                
                if (originalDate !== date) {
                    if (!dateMapping[date]) {
                        dateMapping[date] = [];
                    }
                    dateMapping[date].push({ original: originalDate, normalized: date });
                }
                
                if (!commentsByDate[date]) {
                    commentsByDate[date] = [];
                }
                // 중복 체크 (같은 ID의 코멘트가 이미 있으면 추가하지 않음)
                const existingIds = new Set(commentsByDate[date].map(c => c.id));
                if (!existingIds.has(comment.id)) {
                    commentsByDate[date].push(comment);
                }
            });
            
            
            // 날짜별로 시간순 정렬 (오래된 것부터, 최신이 아래)
            Object.keys(commentsByDate).forEach(date => {
                commentsByDate[date].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            });
        }
    } catch (error) {
        console.error('코멘트 로드 오류:', error);
    }
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
        // 트레이너 모드인 경우 실제 회원의 app_user_id 사용
        const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
        const targetAppUserId = connectedMemberAppUserId || currentAppUserId;
        
        const records = await getWorkoutRecords(targetAppUserId, filters);
        
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
    
    // 해당 날짜의 데이터가 이미 로드되어 있는지 확인
    const hasData = currentRecords.some(r => {
        let recordDateStr = r.workout_date;
        if (recordDateStr instanceof Date) {
            recordDateStr = formatDate(recordDateStr);
        } else if (typeof recordDateStr === 'string') {
            recordDateStr = recordDateStr.split('T')[0];
        }
        return recordDateStr === dateStr;
    });
    
    if (!hasData) {
        // 데이터가 없으면 해당 날짜 데이터 로드
        try {
            const { getWorkoutRecords } = await import('../api.js');
            const newRecords = await getWorkoutRecords(currentAppUserId, {
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
    await render(currentRecords);
}

export async function renderRecordsToContainer(records, container, options = {}) {
    const {
        appUserId = null,
        readOnly = true,
        hideControls = true
    } = options;
    const prevState = {
        appUserId: currentAppUserId,
        isReadOnly,
        filterDate: currentFilterDate,
        records: currentRecords,
        suppressControls
    };
    if (appUserId) {
        currentAppUserId = appUserId;
    }
    isReadOnly = readOnly;
    suppressControls = Boolean(hideControls);
    currentFilterDate = null;
    currentRecords = Array.isArray(records) ? records : [];
    
    await render(currentRecords, { containerOverride: container, skipListeners: true });
    
    currentAppUserId = prevState.appUserId;
    isReadOnly = prevState.isReadOnly;
    currentFilterDate = prevState.filterDate;
    currentRecords = prevState.records;
    suppressControls = prevState.suppressControls;
}

/**
 * 운동기록 목록 렌더링
 */
async function render(records, options = {}) {
    const { containerOverride = null, skipListeners = false } = options;
    // workout-list-wrapper 또는 app-user-content 찾기
    let container = containerOverride || document.getElementById('workout-list-wrapper');
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
    
    // 1단계: 운동기록을 날짜별로 그룹화
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
            groupedByDate[currentFilterDate] = [];
        }
    }
    
    // 2단계: 코멘트 데이터 로드 (필요한 날짜만 로드)
    const workoutDates = Object.keys(groupedByDate);
    let targetDatesForComments = [];
    if (currentFilterDate) {
        targetDatesForComments = [currentFilterDate];
    } else if (workoutDates.length > 0) {
        targetDatesForComments = workoutDates;
    }
    
    // 현재 필터링된 날짜의 코멘트만 로드
    if (targetDatesForComments.length > 0) {
        await loadCommentsForDates(targetDatesForComments, []);
    }
    
    // 3단계: 렌더링할 날짜 수집
    // 운동기록이 있는 날짜 + 코멘트만 있는 날짜 모두 포함
    const allDatesSet = new Set();
    workoutDates.forEach(date => allDatesSet.add(date));
    
    // 현재 필터링된 날짜 범위 내의 코멘트가 있는 날짜도 추가
    if (currentFilterDate) {
        // 필터링된 날짜의 코멘트가 있으면 추가
        if (commentsByDate[currentFilterDate] && commentsByDate[currentFilterDate].length > 0) {
            allDatesSet.add(currentFilterDate);
        }
    } else {
        // 필터링이 없으면 코멘트가 있는 모든 날짜 추가
        Object.keys(commentsByDate).forEach(date => {
            if (commentsByDate[date] && commentsByDate[date].length > 0) {
                allDatesSet.add(date);
            }
        });
    }
    
    const allDates = Array.from(allDatesSet).sort((a, b) => new Date(b) - new Date(a));
    
    
        // 운동기록, 세션, 코멘트가 모두 없는 경우에만 빈 메시지 표시
        if (allDates.length === 0) {
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
    
    // 타이머 설정 불러오기 (캐시가 없거나 만료된 경우) - 병렬로 처리
    // 렌더링 시점에는 캐시된 값 또는 기본값 사용, 로드 완료 후 업데이트
    let timerDisplayText = '-';
    const storedSettings = getCachedTimerSettings();
    if (storedSettings) {
        if (!storedSettings.restTimerEnabled) {
            timerDisplayText = 'off';
        } else {
            timerDisplayText = formatTime(storedSettings.restMinutes * 60 + storedSettings.restSeconds);
        }
    } else {
        // 캐시가 없으면 병렬로 로드하고, 로드 완료 후 업데이트
        loadTimerSettings().then(settings => {
            if (settings) {
                let updatedText = '-';
                if (!settings.restTimerEnabled) {
                    updatedText = 'off';
                } else {
                    updatedText = formatTime(settings.restMinutes * 60 + settings.restSeconds);
                }
                // 타이머 표시 업데이트 (렌더링 후)
                requestAnimationFrame(() => {
                    const timerTexts = document.querySelectorAll('.app-workout-timer-text');
                    timerTexts.forEach(el => {
                        if (el) el.textContent = updatedText;
                    });
                });
            }
        }).catch(error => {
            console.error('타이머 설정 로드 오류:', error);
        });
    }
    
    const hasAnyComments = allDates.some(date => (commentsByDate[date] || []).length > 0);
    const overallVolumeInfo = calculateVolumeForRecords(records);
    const overallSummaryText = overallVolumeInfo.hasVolume
        ? `전체 볼륨 : ${formatVolumeKg(overallVolumeInfo.total)}`
        : `전체 ${records.length}건`;
    let html = `
        ${hasAnyComments ? '' : `
        <div style="display:flex;justify-content:flex-end;align-items:center;margin:4px 0 8px;color:var(--app-text-muted);font-size:12px;">
            ${overallSummaryText}
        </div>
        `}
        <div class="app-workout-list">
    `;
    
    // 렌더링 로직
    // 운동기록이 있는 날짜만 렌더링
    // 1. 코멘트 렌더링 (해당 날짜의 코멘트만, 있는 경우)
    // 2. 날짜 섹션 생성 (운동기록이 있는 경우만)
    // 3. 운동기록카드 렌더링
    allDates.forEach(date => {
        // 날짜 형식 정규화 (YYYY-MM-DD)
        let normalizedDate = date;
        if (normalizedDate instanceof Date) {
            normalizedDate = formatDate(normalizedDate);
        } else if (typeof normalizedDate === 'string') {
            // ISO 형식 문자열인 경우 날짜 부분만 추출
            normalizedDate = normalizedDate.split('T')[0];
        }
        
        const dateObj = new Date(normalizedDate);
        const dateRecords = (groupedByDate[normalizedDate] || groupedByDate[date] || []).sort((a, b) => {
            const orderA = (a.display_order !== null && a.display_order !== undefined) ? a.display_order : 999999;
            const orderB = (b.display_order !== null && b.display_order !== undefined) ? b.display_order : 999999;
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
            const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
            return dateA - dateB;
        });
        
        // 현재 날짜의 코멘트만 가져오기 (정규화된 날짜로 조회)
        // commentsByDate는 정규화된 날짜(YYYY-MM-DD)로 저장되어 있음
        const dateComments = commentsByDate[normalizedDate] || commentsByDate[date] || [];
        
        
        // 1. 날짜 섹션 위에 코멘트 렌더링 (있는 경우만)
        if (dateComments.length > 0) {
            const currentUser = getCurrentUser();
            const isTrainerViewer = currentUser?.is_trainer === true || currentUser?.isTrainer === true;
            const isViewingMember = Boolean(localStorage.getItem('connectedMemberAppUserId'));
            html += `<div class="app-workout-card-comments-section" style="margin-bottom: 3px;">`;
            dateComments.forEach(comment => {
                let commentTime = '';
                if (comment.created_at) {
                    // 시간을 "11:11 AM" 형식으로 변환 (식단과 동일)
                    const date = new Date(comment.created_at);
                    const hours = date.getHours();
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    const ampm = hours >= 12 ? 'PM' : 'AM';
                    const displayHours = hours % 12 || 12;
                    commentTime = `${displayHours}:${minutes} ${ampm}`;
                }
                
                // 줄바꿈을 <br>로 변환 (XSS 방지를 위해 escapeHtml 먼저 적용)
                const commentText = escapeHtml(comment.comment).replace(/\n/g, '<br>');
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
        
        // 2. 날짜 섹션 생성 (운동기록이 있는 경우만 표시)
        // dateRecords.length > 0 조건은 allDates가 이미 운동기록이 있는 날짜만 포함하므로 항상 true
        if (dateRecords.length > 0) {
            const volumeInfo = calculateVolumeForRecords(dateRecords);
            const dateSummaryText = volumeInfo.hasVolume
                ? `볼륨 : ${formatVolumeKg(volumeInfo.total)}`
                : `${dateRecords.length}건`;
            html += `
                <div class="app-workout-date-section">
                    <div class="app-workout-date-header">
                        <div class="app-workout-date-left">
                            <h3 class="app-workout-date-title">${formatDateShort(dateObj)}</h3>
                            <span class="app-workout-date-count">${dateSummaryText}</span>
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            ${!isReadOnly && !suppressControls ? `
                            <button class="app-workout-timer-btn" data-date="${normalizedDate}" aria-label="복사" style="padding: 6px 12px; font-size: 13px; white-space: nowrap;">
                                복사
                            </button>
                            ` : ''}
                            ${!suppressControls ? `
                            <button class="app-workout-timer-btn" data-date="${normalizedDate}" aria-label="타이머" ${isReadOnly ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                                타이머<span class="app-workout-timer-text">${timerDisplayText}</span>
                            </button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="app-workout-items">
            `;
            
            // 3. 운동기록카드 렌더링
            dateRecords.forEach(record => {
                html += renderWorkoutItem(record);
            });
            html += `</div></div>`;
        }
    });
    
    html += '</div>';
    
    // 기존 내용 완전히 제거 후 새로 렌더링 (중복 방지)
    container.innerHTML = '';
    container.innerHTML = html;
    
    // 무게 표시 영역 자동 크기 조정
    requestAnimationFrame(() => {
        container.querySelectorAll('.app-workout-item-set-info').forEach(element => {
            autoResizeText(element, 10, 15);
        });
        container.querySelectorAll('.workout-history-set-value').forEach(element => {
            autoResizeText(element, 10, 15);
        });
    });
    
    if (!skipListeners) {
        // 클릭 이벤트 리스너 추가
        setupClickListeners();
        
        // 드래그 앤 드롭 초기화
        if (!isReadOnly) {
            initializeSortable();
        }
    }
}

/**
 * 운동기록 아이템 렌더링
 */
function renderWorkoutLevelBadges(record) {
    const levelLabels = {
        high: '상',
        medium: '중',
        low: '하'
    };
    const badges = [];
    if (record.condition_level) {
        const label = levelLabels[record.condition_level] || record.condition_level;
        badges.push({ text: `컨디션 ${label}`, level: record.condition_level });
    }
    if (record.intensity_level) {
        const label = levelLabels[record.intensity_level] || record.intensity_level;
        badges.push({ text: `운동강도 ${label}`, level: record.intensity_level });
    }
    if (record.fatigue_level) {
        const label = levelLabels[record.fatigue_level] || record.fatigue_level;
        badges.push({ text: `피로도 ${label}`, level: record.fatigue_level, reverse: true });
    }
    
    if (badges.length === 0) {
        return '';
    }
    
    return `
        <div class="app-workout-level-badges">
            ${badges.map(badge => {
                const level = badge.level || 'medium';
                const dataLevel = badge.reverse ? `${level}-reverse` : level;
                return `<span class="app-workout-level-badge" data-level="${dataLevel}">${badge.text}</span>`;
            }).join('')}
        </div>
    `;
}

function renderWorkoutItem(record) {
    // 텍스트 기록인 경우
    if (record.is_text_record) {
        const textContent = record.text_content ? escapeHtml(record.text_content) : '';
        const isCompleted = record.is_completed || false;
        const cardClass = isCompleted ? 'app-workout-item app-workout-item-all-completed app-workout-item-text' : 'app-workout-item app-workout-item-text';
        const completedClass = isCompleted ? 'app-workout-item-completed' : 'app-workout-item-incomplete';
        const checked = isCompleted ? 'checked' : '';
        const badgesHtml = renderWorkoutLevelBadges(record);
        
        return `
            <div class="${cardClass}" data-record-id="${record.id}" data-workout-date="${record.workout_date}" style="position: relative;">
                <div class="app-workout-item-main app-workout-item-main-text">
                    <div class="app-workout-item-type-container app-workout-item-type-container-text" style="flex-direction: column; align-items: flex-start; gap: 8px; flex: 1;">
                        ${(!suppressControls || badgesHtml) ? `
                        <div style="position: absolute; top: 6px; left: 6px; display: flex; align-items: center; gap: 6px;">
                            ${suppressControls ? '' : `
                            <div class="app-workout-item-drag-handle" style="cursor: grab; padding: 4px; opacity: 0.5; transition: opacity 0.2s; flex-shrink: 0;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.5'">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="4" y1="7" x2="20" y2="7"></line>
                                    <line x1="4" y1="12" x2="20" y2="12"></line>
                                    <line x1="4" y1="17" x2="20" y2="17"></line>
                                </svg>
                            </div>
                            ` : ''}
                            ${badgesHtml}
                        </div>
                        ` : ''}
                        ${!isReadOnly && !suppressControls ? `
                        <div style="position: absolute; top: 6px; right: 12px; display: flex; align-items: center; gap: 6px;">
                            <button class="app-workout-item-edit-btn" data-record-id="${record.id}" aria-label="수정" style="flex-shrink: 0;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <div class="app-workout-item-duration-container" style="flex-shrink: 0;">
                                <input type="checkbox" class="app-workout-item-checkbox" 
                                       data-record-id="${record.id}" 
                                       data-type="record" 
                                       ${checked}>
                            </div>
                        </div>
                        ` : ''}
                        <div style="display: flex; flex-direction: column; gap: 6px; width: 100%; padding-top: 28px;">
                            <div class="app-workout-item-text-content" style="white-space: pre-line; word-wrap: break-word; word-break: break-word;">${textContent}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // 일반 기록 (기존 로직)
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
                ${!isReadOnly && !suppressControls ? `
                <input type="checkbox" class="app-workout-item-checkbox" 
                       data-record-id="${record.id}" 
                       data-type="record" 
                       ${checked}>
                ` : ''}
            </div>
        `;
    } else if (workoutTypeType === '세트' && sets.length > 0) {
        const canRemove = sets.length > 1;
        // 모든 세트가 완료되었는지 확인
        const allSetsCompleted = sets.every(set => set.is_completed === true) && sets.length > 0;
        const setsInfo = sets.map((set, setIndex) => {
            const weight = formatWeight(set.weight);
            const reps = set.reps !== null && set.reps !== undefined ? `${set.reps}회` : '-';
            const isCompleted = set.is_completed || false;
            const completedClass = isCompleted ? 'app-workout-item-completed' : 'app-workout-item-incomplete';
            const checked = isCompleted ? 'checked' : '';
            return `
                <div class="app-workout-item-set-row" style="display: flex; align-items: center; gap: 8px;">
                    <span class="app-workout-item-set-number ${completedClass}">${set.set_number}</span>
                    <span class="app-workout-item-set-info ${completedClass}">${weight} × ${reps}</span>
                    ${!isReadOnly && !suppressControls ? `
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
                ${!isReadOnly && !suppressControls ? `
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
        <div class="${cardClass}" data-record-id="${record.id}" data-workout-date="${record.workout_date}" style="position: relative;">
            <div class="app-workout-item-main">
                <div class="app-workout-item-type-container" style="flex-direction: column; align-items: flex-start; gap: 6px;">
                    ${suppressControls ? '' : `
                    <div class="app-workout-item-drag-handle" style="cursor: grab; padding: 4px; opacity: 0.5; transition: opacity 0.2s; position: absolute; top: 6px; left: 6px;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.5'">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="4" y1="7" x2="20" y2="7"></line>
                            <line x1="4" y1="12" x2="20" y2="12"></line>
                            <line x1="4" y1="17" x2="20" y2="17"></line>
                        </svg>
                    </div>
                    `}
                    <div style="display: flex; align-items: center; gap: 6px; width: 100%;">
                        ${(() => {
                            const guideItem = workoutGuideMap.get(String(record.workout_type_id || ''));
                            if (!guideItem) {
                                return `<div class="app-workout-item-type">${escapeHtml(workoutTypeName)}</div>`;
                            }
                            return `
                                <button type="button" class="app-workout-item-type-btn" data-guide-id="${guideItem.id}">
                                    ${escapeHtml(workoutTypeName)}
                                </button>
                            `;
                        })()}
                        ${!isReadOnly && !suppressControls ? `
                        <button class="app-workout-item-edit-btn" data-record-id="${record.id}" aria-label="수정">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        ` : ''}
                        ${renderWorkoutLevelBadges(record)}
                    </div>
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
            const weight = formatWeight(set.weight);
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
            let prevRecordCompleted = null;
            let prevSetCompleted = null;
            let setId = null;
            let prevRecordSnapshot = null;
            
            try {
                prevRecordSnapshot = JSON.parse(JSON.stringify(record));
                
                if (type === 'record') {
                    prevRecordCompleted = record.is_completed || false;
                    record.is_completed = isChecked;
                } else if (type === 'set') {
                    setId = checkbox.getAttribute('data-set-id');
                    const normalizedSetId = setId === 'null' ? null : setId;
                    const set = record.sets.find(s => s.id === normalizedSetId);
                    if (set) {
                        prevSetCompleted = set.is_completed || false;
                        set.is_completed = isChecked;
                    }
                }
                
                // 카드 목록 업데이트 (낙관적 UI)
                const recordIndex = currentRecords.findIndex(r => r.id === record.id);
                if (recordIndex !== -1) {
                    currentRecords[recordIndex] = { ...record };
                    await render(currentRecords);
                }
                
                scheduleCalendarUpdate();
                
                if (type === 'record') {
                    await updateWorkoutRecordCompleted(record.id, currentAppUserId, isChecked);
                } else if (type === 'set') {
                    const normalizedSetId = setId === 'null' ? null : setId;
                    if (!normalizedSetId) {
                        queueRecordSave(record.id, record, prevRecordSnapshot);
                        return;
                    }
                    await updateWorkoutSetCompleted(record.id, normalizedSetId, currentAppUserId, isChecked);
                }
            } catch (error) {
                console.error('완료 상태 업데이트 오류:', error);
                // 롤백
                if (type === 'record') {
                    record.is_completed = prevRecordCompleted;
                } else if (type === 'set') {
                    const set = record.sets.find(s => s.id === setId);
                    if (set) {
                        set.is_completed = prevSetCompleted;
                    }
                }
                checkbox.checked = !isChecked;
                const recordIndex = currentRecords.findIndex(r => r.id === record.id);
                if (recordIndex !== -1) {
                    currentRecords[recordIndex] = { ...record };
                    await render(currentRecords);
                }
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
    const storedSettings = getCachedTimerSettings();
    if (storedSettings) {
        useRestTimer = storedSettings.restTimerEnabled;
        restMinutes = storedSettings.restMinutes;
        restSeconds = storedSettings.restSeconds;
    } else {
    try {
        if (currentAppUserId) {
            const settings = await getUserSettings(currentAppUserId);
            useRestTimer = settings.rest_timer_enabled !== undefined ? settings.rest_timer_enabled : true;
            restMinutes = settings.rest_timer_minutes !== undefined ? settings.rest_timer_minutes : 0;
            restSeconds = settings.rest_timer_seconds !== undefined ? settings.rest_timer_seconds : 30;
                setCachedTimerSettings({
                    restTimerEnabled: useRestTimer,
                    restMinutes,
                    restSeconds
                });
        }
    } catch (e) {
        console.error('타이머 설정 불러오기 오류:', e);
        }
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
                
                // 타이머 설정 캐시 업데이트
                setCachedTimerSettings({
                    restTimerEnabled: useRest,
                    restMinutes: minutes,
                    restSeconds: seconds
                });
                
                // 목록 다시 렌더링하여 변경된 타이머 설정 표시
                await render(currentRecords);
                
                // TODO: 타이머 시작 기능 구현
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
    
    const storedSettings = getCachedTimerSettings();
    if (storedSettings) {
        restTimerEnabled = storedSettings.restTimerEnabled;
        restMinutes = storedSettings.restMinutes;
        restSeconds = storedSettings.restSeconds;
    } else {
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
                setCachedTimerSettings({
                    restTimerEnabled,
                    restMinutes,
                    restSeconds
                });
        }
    } catch (e) {
        console.error('휴식 타이머 설정 불러오기 오류:', e);
        // 에러 발생 시 기본값 사용
        }
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
 * 특정 날짜의 모든 운동이 완료되었는지 확인
 */
function checkAllWorkoutsCompletedForDate(dateStr) {
    if (!dateStr || !currentRecords || currentRecords.length === 0) {
        return false;
    }
    
    // 해당 날짜의 모든 운동기록 필터링
    const dateRecords = currentRecords.filter(record => {
        let recordDateStr = record.workout_date;
        if (recordDateStr instanceof Date) {
            recordDateStr = formatDate(recordDateStr);
        } else if (typeof recordDateStr === 'string') {
            recordDateStr = recordDateStr.split('T')[0];
        }
        return recordDateStr === dateStr;
    });
    
    if (dateRecords.length === 0) {
        return false;
    }
    
    // 모든 운동이 완료되었는지 확인
    return dateRecords.every(record => {
        // 텍스트 기록의 경우
        if (record.is_text_record === true) {
            return record.is_completed === true;
        }
        
        const workoutTypeType = record.workout_type_type || null;
        
        // 시간 운동의 경우
        if (workoutTypeType === '시간') {
            return record.is_completed === true;
        }
        // 세트 운동의 경우
        else if (workoutTypeType === '세트' && record.sets && record.sets.length > 0) {
            return record.sets.every(set => set.is_completed === true) && record.sets.length > 0;
        }
        
        // 운동종류가 없거나 세트가 없는 경우 false
        return false;
    });
}

/**
 * 축하 메시지 모달 표시
 */
async function showCelebrationModal() {
    // 읽기 전용 모드에서는 표시하지 않음
    if (isReadOnly) {
        return;
    }
    
    // 기존 모달이 있으면 제거 (타이머 모달, 축하 메시지 모달 모두)
    const existingTimerModal = document.getElementById('rest-timer-modal-bg');
    if (existingTimerModal) {
        existingTimerModal.remove();
    }
    const existingCelebrationModal = document.getElementById('celebration-modal-bg');
    if (existingCelebrationModal) {
        existingCelebrationModal.remove();
    }
    
    const modalHtml = `
        <div class="app-modal-bg" id="celebration-modal-bg" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); z-index: 10000; display: flex; align-items: center; justify-content: center; margin: 0; padding: 0; box-sizing: border-box;">
            <div class="celebration-modal" id="celebration-modal" style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: clamp(20px, 5vw, 40px) clamp(16px, 4vw, 20px); box-sizing: border-box; margin: 0;">
                <div style="font-size: clamp(80px, 18vw, 150px); margin: 0 0 clamp(20px, 5vw, 40px) 0; padding: 0; animation: bounce 1s ease-in-out infinite; text-align: center; display: block; width: auto;">🎉</div>
                <h2 style="margin: 0 0 clamp(12px, 3vw, 20px) 0; padding: 0; font-size: clamp(32px, 7vw, 56px); font-weight: 700; color: #fff; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); text-align: center; width: 100%; max-width: 100%; box-sizing: border-box; display: block;">
                    축하합니다!
                </h2>
                <div style="font-size: clamp(50px, 12vw, 100px); margin: 0 0 clamp(16px, 4vw, 30px) 0; padding: 0; text-align: center; display: block; width: auto;">💪</div>
                <div style="font-size: clamp(42px, 10.5vw, 84px); font-weight: 700; color: #fff; margin: 0 0 clamp(12px, 3vw, 20px) 0; padding: 0 clamp(16px, 4vw, 32px); text-align: center; width: 100%; max-width: 100%; box-sizing: border-box; display: block; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">
                    오운완!
                </div>
                <div style="font-size: clamp(18px, 4.5vw, 28px); color: rgba(255, 255, 255, 0.9); line-height: 1.8; margin: 0 0 clamp(30px, 7vw, 50px) 0; padding: 0 clamp(16px, 4vw, 32px); text-align: center; width: 100%; max-width: 100%; box-sizing: border-box; display: block;">
                    정말 수고하셨습니다!<br>
                    내일도 화이팅! 🔥
                </div>
                <button type="button" id="celebration-modal-close" class="app-btn app-btn-primary" style="padding: clamp(14px, 3.5vw, 18px) clamp(36px, 9vw, 56px); font-size: clamp(18px, 4.5vw, 22px); font-weight: 600; border-radius: 50px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); margin: 0; display: block; width: auto; min-width: auto;">
                    확인
                </button>
                <style>
                    @keyframes bounce {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(clamp(-10px, -2vw, -20px)); }
                    }
                    #celebration-modal-bg,
                    #celebration-modal-bg * {
                        box-sizing: border-box;
                    }
                    #celebration-modal {
                        margin: 0 !important;
                        padding: clamp(20px, 5vw, 40px) clamp(16px, 4vw, 20px) !important;
                    }
                    #celebration-modal > * {
                        margin-left: auto !important;
                        margin-right: auto !important;
                        text-align: center !important;
                    }
                    #celebration-modal-close {
                        margin-left: auto !important;
                        margin-right: auto !important;
                    }
                    @media (max-width: 480px) {
                        #celebration-modal {
                            padding: 20px 16px !important;
                        }
                    }
                </style>
            </div>
        </div>
    `;
    
    // 모달 추가
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modalBg = document.getElementById('celebration-modal-bg');
    const modal = document.getElementById('celebration-modal');
    const closeBtn = document.getElementById('celebration-modal-close');
    
    // 닫기 버튼 클릭 이벤트
    closeBtn.addEventListener('click', () => {
        modalBg.style.opacity = '0';
        modal.style.opacity = '0';
        modal.style.transform = 'scale(0.9)';
        setTimeout(() => {
            if (modalBg.parentNode) {
                modalBg.remove();
            }
        }, 300);
    });
    
    // 배경 클릭 시 닫기 (전체 화면이므로 비활성화)
    // modalBg.addEventListener('click', (e) => {
    //     if (e.target === modalBg) {
    //         modalBg.classList.remove('app-modal-show');
    //         modal.classList.remove('app-modal-show');
    //         setTimeout(() => {
    //             if (modalBg.parentNode) {
    //                 modalBg.remove();
    //             }
    //         }, 300);
    //     }
    // });
    
    // ESC 키로 닫기
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            modalBg.style.opacity = '0';
            modal.style.opacity = '0';
            modal.style.transform = 'scale(0.9)';
            document.removeEventListener('keydown', escHandler);
            setTimeout(() => {
                if (modalBg.parentNode) {
                    modalBg.remove();
                }
            }, 300);
        }
    };
    document.addEventListener('keydown', escHandler);
    
    // 모달 열기 애니메이션 (전체 화면이므로 즉시 표시)
    setTimeout(() => {
        modalBg.style.opacity = '0';
        modalBg.style.transition = 'opacity 0.3s ease-in-out';
        modal.style.opacity = '0';
        modal.style.transform = 'scale(0.9)';
        modal.style.transition = 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out';
        
        requestAnimationFrame(() => {
            modalBg.style.opacity = '1';
            modal.style.opacity = '1';
            modal.style.transform = 'scale(1)';
        });
    }, 10);
    
    // 5초 후 자동 닫기 (선택사항)
    setTimeout(() => {
        if (document.body.contains(modalBg)) {
            modalBg.style.opacity = '0';
            modal.style.opacity = '0';
            modal.style.transform = 'scale(0.9)';
            document.removeEventListener('keydown', escHandler);
            setTimeout(() => {
                if (modalBg.parentNode) {
                    modalBg.remove();
                }
            }, 300);
        }
    }, 5000);
}

/**
 * 타이머 설정 불러오기 (캐시)
 */
async function loadTimerSettings(forceRefresh = false) {
    const existing = getCachedTimerSettings();
    if (existing && !forceRefresh) {
        return existing;
    }
    
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
    
    setCachedTimerSettings({
        restTimerEnabled,
        restMinutes,
        restSeconds
    });
    
    return getCachedTimerSettings();
}

/**
 * 클릭 이벤트 리스너 설정
 */
function setupClickListeners() {
    // 복사 버튼 클릭 이벤트 (읽기 전용 모드가 아닌 경우만)
    if (!isReadOnly) {
        const copyButtons = document.querySelectorAll('.app-workout-timer-btn[aria-label="복사"]');
        copyButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const date = btn.getAttribute('data-date');
                showCopyDateModal(date);
            });
        });
    }
    
    // 타이머 버튼 클릭 이벤트 (읽기 전용 모드가 아닌 경우만)
    if (!isReadOnly) {
        const timerButtons = document.querySelectorAll('.app-workout-timer-btn[aria-label="타이머"]');
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

        const guideButton = item.querySelector('.app-workout-item-type-btn');
        if (guideButton) {
            guideButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const guideId = guideButton.getAttribute('data-guide-id');
                const guideItem = workoutGuideMap.get(String(guideId));
                if (guideItem) {
                    showWorkoutGuideDetailModal(guideItem);
                }
            });
        }
        
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
                        
                        let latestRecord;
                        try {
                            latestRecord = await getWorkoutRecordById(record.id, currentAppUserId);
                        } catch (fetchError) {
                            // 조회 실패 시 원본 레코드 사용
                            latestRecord = null;
                        }
                        
                        const recordToEdit = latestRecord || record;
                        
                        // 텍스트 기록인 경우 전용 모달 사용
                        if (recordToEdit.is_text_record === true) {
                            await editModule.showTextRecordEditModal(recordToEdit, currentAppUserId, () => {
                                loadRecords();
                            });
                        } else {
                            // 일반 기록인 경우 기존 모달 사용
                            await editModule.showEditModal(recordToEdit, currentAppUserId, () => {
                                loadRecords();
                            });
                        }
                    } catch (error) {
                        console.error('수정 모달 열기 오류:', error);
                        alert('수정 모달을 열 수 없습니다: ' + (error.message || '알 수 없는 오류'));
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
                
                // 날짜 확인용
                const workoutDate = record.workout_date;
                let dateStr = workoutDate;
                if (dateStr instanceof Date) {
                    dateStr = formatDate(dateStr);
                } else if (typeof dateStr === 'string') {
                    dateStr = dateStr.split('T')[0];
                }
                
                const previousStates = record.sets.map(set => ({
                    id: set.id,
                    is_completed: set.is_completed || false
                }));
                const prevRecordSnapshot = JSON.parse(JSON.stringify(record));
                
                // 낙관적 UI 업데이트
                record.sets.forEach(set => {
                    set.is_completed = isChecked;
                });
                await render(currentRecords);
                scheduleCalendarUpdate();
                
                try {
                    const hasPendingSetId = record.sets.some(set => !set.id);
                    if (hasPendingSetId) {
                        queueRecordSave(recordId, record, prevRecordSnapshot);
                    } else {
                        // 모든 세트의 완료 상태 업데이트
                        const { updateWorkoutSetCompleted } = await import('../api.js');
                        const updatePromises = record.sets.map(set => 
                            updateWorkoutSetCompleted(recordId, set.id, currentAppUserId, isChecked)
                        );
                        await Promise.all(updatePromises);
                    }
                    
                    // 체크된 경우에만 모달 처리 (체크 해제 시에는 모달 표시 안 함)
                    if (isChecked) {
                        // 해당 날짜의 모든 운동 완료 여부 확인
                        const allCompleted = checkAllWorkoutsCompletedForDate(dateStr);
                        
                        if (allCompleted) {
                            // 하루 운동이 모두 완료된 경우 축하 메시지 표시
                            await showCelebrationModal();
                        } else {
                            // 완료되지 않은 경우 타이머 모달 표시
                            await showRestTimerModal();
                        }
                    }
                } catch (error) {
                    console.error('전체 세트 완료 상태 업데이트 오류:', error);
                    // 실패 시 체크박스 상태 원복
                    allSetsCheckbox.checked = !isChecked;
                    record.sets.forEach(set => {
                        const prev = previousStates.find(state => state.id === set.id);
                        if (prev) {
                            set.is_completed = prev.is_completed;
                        }
                    });
                    await render(currentRecords);
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
                let prevRecordCompleted = null;
                let prevSetCompleted = null;
                let setId = null;
                let prevRecordSnapshot = null;
                
                // currentAppUserId 확인
                if (!currentAppUserId) {
                    console.error('currentAppUserId가 설정되지 않았습니다.');
                    checkbox.checked = !isChecked;
                    alert('사용자 정보를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
                    return;
                }
                
                try {
                    // 해당 레코드 찾기 (날짜 확인용)
                    const record = currentRecords.find(r => r.id === recordId);
                    if (!record) {
                        checkbox.checked = !isChecked;
                        alert('운동기록을 찾을 수 없습니다.');
                        return;
                    }
                    
                    const workoutDate = record.workout_date;
                    let dateStr = workoutDate;
                    if (dateStr instanceof Date) {
                        dateStr = formatDate(dateStr);
                    } else if (typeof dateStr === 'string') {
                        dateStr = dateStr.split('T')[0];
                    }
                    
                    prevRecordSnapshot = JSON.parse(JSON.stringify(record));
                    
                    if (type === 'record') {
                        prevRecordCompleted = record.is_completed || false;
                        record.is_completed = isChecked;
                    } else if (type === 'set') {
                        setId = checkbox.getAttribute('data-set-id');
                        if (!setId) {
                            console.error('setId가 없습니다.');
                            checkbox.checked = !isChecked;
                            alert('세트 정보를 찾을 수 없습니다.');
                            return;
                        }
                        const normalizedSetId = setId === 'null' ? null : setId;
                        const set = record.sets?.find(s => s.id === normalizedSetId);
                        if (set) {
                            prevSetCompleted = set.is_completed || false;
                            set.is_completed = isChecked;
                        }
                    }
                    
                    // 전체 세트 체크박스 상태 업데이트 (세트 타입인 경우)
                    if (type === 'set') {
                        const allSetsCheckbox = item.querySelector('.app-workout-item-all-sets-checkbox');
                        if (allSetsCheckbox && record.sets) {
                            const allCompleted = record.sets.every(set => set.is_completed === true) && record.sets.length > 0;
                            allSetsCheckbox.checked = allCompleted;
                        }
                    }
                    
                    // 카드 다시 렌더링 (낙관적 UI)
                    await render(currentRecords);
                    scheduleCalendarUpdate();
                    
                    if (type === 'record') {
                        // 운동기록 완료 상태 업데이트
                        const { updateWorkoutRecordCompleted } = await import('../api.js');
                        await updateWorkoutRecordCompleted(recordId, currentAppUserId, isChecked);
                    } else if (type === 'set') {
                        // 세트 완료 상태 업데이트
                        const normalizedSetId = setId === 'null' ? null : setId;
                        if (!normalizedSetId) {
                            queueRecordSave(recordId, record, prevRecordSnapshot);
                        } else {
                            const { updateWorkoutSetCompleted } = await import('../api.js');
                            await updateWorkoutSetCompleted(recordId, normalizedSetId, currentAppUserId, isChecked);
                        }
                    }
                    
                    // 체크된 경우에만 모달 처리 (체크 해제 시에는 모달 표시 안 함)
                    if (isChecked) {
                        // 해당 날짜의 모든 운동 완료 여부 확인
                        const allCompleted = checkAllWorkoutsCompletedForDate(dateStr);
                        
                        if (allCompleted) {
                            // 하루 운동이 모두 완료된 경우 축하 메시지 표시
                            await showCelebrationModal();
                        } else {
                            // 완료되지 않은 경우 타이머 모달 표시 (세트 타입인 경우만)
                            if (type === 'set') {
                                await showRestTimerModal();
                            }
                        }
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
                    if (type === 'record') {
                        record.is_completed = prevRecordCompleted;
                    } else if (type === 'set') {
                        const set = record.sets?.find(s => s.id === setId);
                        if (set) {
                            set.is_completed = prevSetCompleted;
                        }
                    }
                    checkbox.checked = !isChecked;
                    await render(currentRecords);
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
                const recordIndex = currentRecords.findIndex(r => r.id === recordId);
                if (recordIndex === -1) return;
                const record = currentRecords[recordIndex];
                if (!record || !record.sets || record.sets.length <= 1) return;
                
                let prevRecord = null;
                try {
                    prevRecord = JSON.parse(JSON.stringify(record));
                    
                    // 마지막 세트 삭제
                    const updatedSets = record.sets.slice(0, -1);
                    // 세트 번호 재정렬
                    updatedSets.forEach((set, i) => {
                        set.set_number = i + 1;
                    });
                    
                    // 낙관적 UI 업데이트
                    currentRecords[recordIndex] = {
                        ...record,
                        sets: updatedSets
                    };
                    await render(currentRecords);
                    
                    scheduleCalendarUpdate();
                    queueRecordSave(recordId, { ...record, sets: updatedSets }, prevRecord);
                } catch (error) {
                    console.error('세트 삭제 오류:', error);
                    // 실패 시 롤백
                    if (recordIndex !== -1 && prevRecord) {
                        currentRecords[recordIndex] = prevRecord;
                        await render(currentRecords);
                        scheduleCalendarUpdate();
                    }
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
                    const recordIndex = currentRecords.findIndex(r => r.id === recordId);
                    if (recordIndex === -1) return;
                    const record = currentRecords[recordIndex];
                    if (!record || !record.sets) return;
                    
                    let prevRecord = null;
                    try {
                        prevRecord = JSON.parse(JSON.stringify(record));
                        
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
                    
                    // 낙관적 UI 업데이트
                    currentRecords[recordIndex] = {
                        ...record,
                        sets: updatedSets
                    };
                    await render(currentRecords);
                    
                    scheduleCalendarUpdate();
                    queueRecordSave(recordId, { ...record, sets: updatedSets }, prevRecord);
                } catch (error) {
                    console.error('세트 추가 오류:', error);
                    // 실패 시 롤백
                    const recordIndex = currentRecords.findIndex(r => r.id === recordId);
                    if (recordIndex !== -1 && prevRecord) {
                        currentRecords[recordIndex] = prevRecord;
                        await render(currentRecords);
                        scheduleCalendarUpdate();
                    }
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
/**
 * 새로고침
 * @param {string|null} commentDate - 코멘트를 다시 로드할 날짜 (YYYY-MM-DD 형식, null이면 모든 날짜)
 */
export async function refresh(commentDate = null) {
    await loadRecords();
    
    // 코멘트도 다시 로드
    let datesToReload = [];
    if (commentDate) {
        // 특정 날짜의 코멘트만 다시 로드
        datesToReload = [commentDate];
    } else {
        // 모든 날짜의 코멘트 다시 로드
        const sortedDates = Object.keys(
            currentRecords.reduce((acc, record) => {
                const date = record.workout_date;
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
        // 코멘트만 있고 운동기록이 없는 날짜도 처리
        if (commentDate) {
            await loadCommentsForDates([commentDate]);
            await render(currentRecords);
        } else {
            await render(currentRecords);
        }
    }
    
    // 캘린더 운동기록 업데이트
    if (window.updateCalendarWorkoutRecords) {
        window.updateCalendarWorkoutRecords();
    }
}

/**
 * 복사 모달용 날짜 포맷팅 (M/D 형식)
 */
function formatDateForCopy(date) {
    if (!date) return '';
    const d = new Date(date);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${month}/${day}`;
}

/**
 * 운동기록 복사 날짜 선택 모달 표시
 */
async function showCopyDateModal(sourceDate) {
    // 해당 날짜의 운동기록 가져오기
    const dateRecords = currentRecords.filter(record => {
        let recordDateStr = record.workout_date;
        if (recordDateStr instanceof Date) {
            recordDateStr = formatDate(recordDateStr);
        } else if (typeof recordDateStr === 'string') {
            recordDateStr = recordDateStr.split('T')[0];
        }
        return recordDateStr === sourceDate;
    });
    
    // 원래 순서대로 정렬 (created_at 기준 오름차순)
    dateRecords.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
        const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
        return dateA - dateB; // 오름차순 (먼저 생성된 것이 앞에)
    });
    
    if (dateRecords.length === 0) {
        alert('복사할 운동기록이 없습니다.');
        return;
    }
    
    // 트레이너의 연결된 회원 목록 가져오기
    let trainerMembersList = [];
    let isTrainer = false;
    
    try {
        // 사용자 ID 확인
        let originalAppUserId = localStorage.getItem('appUserId');
        const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
        
        // 연결된 회원을 보고 있는 경우, 원래 트레이너 ID 찾기
        if (connectedMemberAppUserId && currentAppUserId === connectedMemberAppUserId) {
            // 방법 1: 연결된 회원의 member_name으로 members 테이블 조회하여 trainer 찾기
            const connectedUserResponse = await fetch(`/api/app-users/${connectedMemberAppUserId}`);
            if (connectedUserResponse.ok) {
                const connectedUser = await connectedUserResponse.json();
                
                if (connectedUser.member_name) {
                    // members 테이블에서 트레이너 찾기
                    const membersResponse = await fetch(`/api/members?name=${encodeURIComponent(connectedUser.member_name)}`);
                    if (membersResponse.ok) {
                        const members = await membersResponse.json();
                        const member = members.find(m => m.name === connectedUser.member_name);
                        
                        if (member && member.trainer) {
                            // 트레이너의 app_user 찾기 (username으로 조회, 캐싱 사용)
                            const trainerUsers = await getAppUsers({ username: member.trainer });
                            const trainerUser = trainerUsers.find(u => u.username === member.trainer);
                            
                            if (trainerUser) {
                                originalAppUserId = trainerUser.id;
                            } else {
                                // /api/trainer-app-user 엔드포인트 사용
                                try {
                                    const trainerAppUserResponse = await fetch('/api/trainer-app-user', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ 
                                            username: member.trainer,
                                            name: member.trainer 
                                        })
                                    });
                                    
                                    if (trainerAppUserResponse.ok) {
                                        const trainerAppUser = await trainerAppUserResponse.json();
                                        originalAppUserId = trainerAppUser.id;
                                    }
                                } catch (error) {
                                    console.error('트레이너 app_user 생성/조회 오류:', error);
                                }
                            }
                        }
                    }
                }
            }
            
            // 방법 2: 여전히 없으면 모든 사용자에서 트레이너 찾기 (캐싱 사용)
            if (!originalAppUserId) {
                try {
                    const allUsers = await getAppUsers();
                    const trainerUsers = allUsers.filter(u => u.is_trainer === true || u.isTrainer === true);
                    
                    if (trainerUsers.length > 0) {
                        // 첫 번째 트레이너 사용
                        originalAppUserId = trainerUsers[0].id;
                    }
                } catch (error) {
                    console.error('트레이너 조회 오류:', error);
                }
            }
        }
        
        // 여전히 없으면 currentAppUserId 사용
        if (!originalAppUserId) {
            originalAppUserId = currentAppUserId;
        }
        
        if (originalAppUserId) {
            const userResponse = await fetch(`/api/app-users/${originalAppUserId}`);
            
            if (userResponse.ok) {
                const user = await userResponse.json();
                
                // is_trainer 필드 확인 (DB 필드명)
                isTrainer = user.is_trainer === true || user.isTrainer === true;
                
                if (isTrainer) {
                    const trainerUsername = user.username;
                    
                    // 최적화된 API 사용: 트레이너별 연결된 회원을 한 번에 조회
                    try {
                        const response = await fetch(`/api/trainer-members?trainer_username=${encodeURIComponent(trainerUsername)}`);
                        if (response.ok) {
                            const members = await response.json();
                            trainerMembersList = members.map(member => ({
                                app_user_id: member.app_user_id,
                                name: member.name
                            }));
                            
                            // 이름순 정렬
                            trainerMembersList.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
                        }
                    } catch (error) {
                        console.error('트레이너 회원 목록 조회 오류:', error);
                    }
                }
            }
        }
    } catch (error) {
        console.error('트레이너 회원 목록 조회 오류:', error);
    }
    
    // 현재 연결된 회원 ID
    const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
    const currentTargetUserId = connectedMemberAppUserId || currentAppUserId;
    
    const modalHtml = `
        <div class="app-modal-bg" id="copy-date-modal-bg">
            <div class="app-modal" id="copy-date-modal">
                <div class="app-modal-header">
                    <h3>운동기록 복사</h3>
                    <button class="app-modal-close-btn" id="copy-date-modal-close">×</button>
                </div>
                <div class="app-modal-content" style="padding: 20px;">
                    <p style="margin-bottom: 16px; color: var(--app-text-muted); text-align: center;">
                        ${formatDateForCopy(new Date(sourceDate))} ${dateRecords.length}건 복사할 날짜를 선택하세요.
                    </p>
                    ${isTrainer && trainerMembersList.length > 0 ? `
                    <div style="margin-bottom: 16px; display: flex; flex-direction: column; align-items: center;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--app-text);">
                            복사할 회원
                        </label>
                        <select id="copy-target-member" style="width: 100%; max-width: 200px; padding: 10px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); font-size: 16px; box-sizing: border-box; background: var(--app-surface); color: var(--app-text);">
                            <option value="${currentTargetUserId}">현재 회원</option>
                            ${trainerMembersList.map(member => `
                                <option value="${member.app_user_id}" ${member.app_user_id === currentTargetUserId ? 'selected' : ''}>${escapeHtml(member.name)}</option>
                            `).join('')}
                        </select>
                    </div>
                    ` : ''}
                    <div style="margin-bottom: 16px; display: flex; flex-direction: column; align-items: center;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--app-text);">
                            복사할 날짜
                        </label>
                        <input type="date" id="copy-target-date" style="width: 100%; max-width: 200px; padding: 10px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); font-size: 16px; box-sizing: border-box;">
                    </div>
                    <div style="display: flex; gap: 8px; justify-content: flex-end;">
                        <button class="app-btn-secondary" id="copy-date-cancel-btn" style="padding: 10px 20px;">취소</button>
                        <button class="app-btn-primary" id="copy-date-confirm-btn" style="padding: 10px 20px;">복사</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 기존 모달이 있으면 제거
    const existingModal = document.getElementById('copy-date-modal-bg');
    if (existingModal) {
        existingModal.remove();
    }
    
    // 모달 추가
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modalBg = document.getElementById('copy-date-modal-bg');
    const modal = document.getElementById('copy-date-modal');
    const closeBtn = document.getElementById('copy-date-modal-close');
    const cancelBtn = document.getElementById('copy-date-cancel-btn');
    const confirmBtn = document.getElementById('copy-date-confirm-btn');
    const targetDateInput = document.getElementById('copy-target-date');
    const targetMemberSelect = document.getElementById('copy-target-member');
    
    // 오늘 날짜를 기본값으로 설정
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    targetDateInput.value = formatDate(today);
    targetDateInput.min = formatDate(today); // 오늘 이후만 선택 가능
    
    // 모달 열기 애니메이션
    setTimeout(() => {
        modalBg.classList.add('app-modal-show');
        modal.classList.add('app-modal-show');
    }, 10);
    
    // 닫기 함수
    const closeModal = () => {
        modalBg.classList.remove('app-modal-show');
        modal.classList.remove('app-modal-show');
        setTimeout(() => {
            if (modalBg.parentNode) {
                modalBg.remove();
            }
        }, 200);
    };
    
    // 취소 버튼
    cancelBtn.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    modalBg.addEventListener('click', (e) => {
        if (e.target === modalBg) {
            closeModal();
        }
    });
    
    // ESC 키로 닫기
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    
    // 복사 확인 버튼
    confirmBtn.addEventListener('click', async () => {
        const targetDate = targetDateInput.value;
        
        if (!targetDate) {
            alert('날짜를 선택해주세요.');
            return;
        }
        
        // 같은 날짜로 복사하는 경우 확인
        if (targetDate === sourceDate) {
            if (!confirm('같은 날짜로 복사하시겠습니까?')) {
                return;
            }
        }
        
        // 복사할 회원 ID 확인
        let targetMemberId = currentTargetUserId;
        if (targetMemberSelect) {
            targetMemberId = targetMemberSelect.value;
        }
        
        if (!targetMemberId) {
            alert('회원을 선택해주세요.');
            return;
        }
        
        // 복사 버튼 비활성화
        confirmBtn.disabled = true;
        confirmBtn.textContent = '복사 중...';
        
        try {
            await copyWorkoutRecords(dateRecords, targetDate, targetMemberId);
            closeModal();
            document.removeEventListener('keydown', escHandler);
            
            // 목록 새로고침
            await loadRecords();
            
            // 캘린더 업데이트
            if (window.updateCalendarWorkoutRecords) {
                await window.updateCalendarWorkoutRecords();
            }
            
            alert('운동기록이 복사되었습니다.');
        } catch (error) {
            console.error('운동기록 복사 오류:', error);
            alert(error.message || '운동기록 복사 중 오류가 발생했습니다.');
            confirmBtn.disabled = false;
            confirmBtn.textContent = '복사';
        }
    });
}

/**
 * 운동기록 복사
 */
async function copyWorkoutRecords(records, targetDate, targetAppUserId = null) {
    const { addWorkoutRecord } = await import('../api.js');
    
    // targetAppUserId가 제공되지 않으면 연결된 회원 또는 현재 사용자 사용
    if (!targetAppUserId) {
        const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
        targetAppUserId = connectedMemberAppUserId || currentAppUserId;
    }
    
    if (!targetAppUserId) {
        throw new Error('사용자 ID가 없습니다.');
    }
    
    const copyPromises = records.map(async (record) => {
        // 텍스트 기록인 경우
        if (record.is_text_record === true) {
            const workoutData = {
                app_user_id: targetAppUserId,
                workout_date: targetDate,
                is_text_record: true,
                text_content: record.text_content || '',
                workout_type_id: null,
                duration_minutes: null,
                sets: [],
                notes: null,
                is_completed: false // 복사된 기록은 완료 상태 초기화
            };
            return addWorkoutRecord(workoutData);
        }
        
        // 일반 기록인 경우
        const workoutData = {
            app_user_id: targetAppUserId,
            workout_date: targetDate,
            workout_type_id: record.workout_type_id,
            notes: record.notes || null,
            is_completed: false // 복사된 기록은 완료 상태 초기화
        };
        
        // 시간 운동인 경우
        if (record.workout_type_type === '시간' && record.duration_minutes) {
            workoutData.duration_minutes = record.duration_minutes;
            workoutData.sets = [];
        } 
        // 세트 운동인 경우
        else if (record.workout_type_type === '세트' && record.sets && record.sets.length > 0) {
            workoutData.duration_minutes = null;
            workoutData.sets = record.sets.map(set => ({
                set_number: set.set_number,
                weight: set.weight !== null && set.weight !== undefined ? set.weight : 0,
                reps: set.reps !== null && set.reps !== undefined ? set.reps : 0
            }));
        } else {
            // 세트 정보가 없는 경우 기본 세트 추가
            workoutData.duration_minutes = null;
            workoutData.sets = [{ set_number: 1, weight: 0, reps: 0 }];
        }
        
        return addWorkoutRecord(workoutData);
    });
    
    await Promise.all(copyPromises);
}

/**
 * SortableJS 초기화 - 드래그 앤 드롭으로 운동 카드 순서 변경
 */
let sortableInstances = [];
let reorderInProgress = new Map(); // 날짜별로 순서 변경 진행 중 플래그

function initializeSortable() {
    // 기존 인스턴스 정리
    sortableInstances.forEach(instance => {
        if (instance && instance.destroy) {
            instance.destroy();
        }
    });
    sortableInstances = [];
    reorderInProgress.clear();
    
    // 각 날짜별로 Sortable 인스턴스 생성
    const dateSections = document.querySelectorAll('.app-workout-date-section');
    
    dateSections.forEach(section => {
        const itemsContainer = section.querySelector('.app-workout-items');
        if (!itemsContainer) return;
        
        // 날짜 추출
        const workoutItems = itemsContainer.querySelectorAll('.app-workout-item');
        if (workoutItems.length === 0) return;
        
        const firstItem = workoutItems[0];
        const workoutDate = firstItem.getAttribute('data-workout-date');
        if (!workoutDate) return;
        
        // 트레이너 모드인 경우 실제 회원의 app_user_id 사용
        const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
        const targetAppUserId = connectedMemberAppUserId || currentAppUserId;
        
        // 원래 위치 저장용 맵 (아이템별로 저장)
        const originalPositions = new Map();
        // 드래그 시작 시점의 원래 순서 저장
        let originalOrder = null;
        
        const sortable = new Sortable(itemsContainer, {
            handle: '.app-workout-item-drag-handle',
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            onStart: function(evt) {
                // 드래그 시작 시 원래 위치 저장
                const item = evt.item;
                const itemId = item.getAttribute('data-record-id');
                // itemsContainer의 직접 자식 요소만 읽기 (중복 방지)
                const allItems = Array.from(itemsContainer.children).filter(el => el.classList.contains('app-workout-item'));
                const originalIndex = allItems.indexOf(item);
                
                // 원래 위치의 다음 형제 요소 저장 (복원용)
                originalPositions.set(itemId, {
                    nextSibling: item.nextElementSibling,
                    parent: item.parentNode
                });
                
                // 드래그 시작 시점의 원래 순서 저장 (oldIndex/newIndex 계산용)
                // 중복 제거: Set을 사용하여 고유한 ID만 저장
                const allIds = allItems.map(el => el.getAttribute('data-record-id')).filter(id => id);
                const uniqueIds = [];
                const seenIds = new Set();
                for (const id of allIds) {
                    if (!seenIds.has(id)) {
                        seenIds.add(id);
                        uniqueIds.push(id);
                    }
                }
                originalOrder = uniqueIds;
            },
            onUpdate: async function(evt) {
                // onUpdate는 DOM이 실제로 변경된 후에 발생하므로 더 정확함
                const { oldIndex, newIndex, item } = evt;
                
                // 위치가 변경되지 않았으면 무시
                if (oldIndex === newIndex || oldIndex === -1 || newIndex === -1) {
                    return;
                }
                
                // 이미 순서 변경이 진행 중이면 무시 (중복 요청 방지)
                const progressKey = `${targetAppUserId}_${workoutDate}`;
                if (reorderInProgress.has(progressKey)) {
                    return;
                }
                
                // 순서 변경 진행 중 플래그 설정
                reorderInProgress.set(progressKey, true);
                
                // oldIndex와 newIndex를 사용하여 원래 순서에서 새로운 순서 계산
                // originalOrder는 onStart에서 저장된 드래그 시작 시점의 순서
                if (!originalOrder || originalOrder.length === 0) {
                    console.error('[Workout Reorder] 원래 순서가 저장되지 않았습니다.', { originalOrder, oldIndex, newIndex });
                    reorderInProgress.delete(progressKey);
                    return;
                }
                
                // 원래 순서를 복사하여 새로운 순서 생성
                const reorderedIds = [...originalOrder];
                const [movedId] = reorderedIds.splice(oldIndex, 1);
                reorderedIds.splice(newIndex, 0, movedId);
                
                // 순서 배열 생성
                const order = reorderedIds.map((id, index) => ({
                    id: id,
                    order: index + 1
                }));
                
                if (order.length !== originalOrder.length) {
                    console.error('[Workout Reorder] 순서 계산 오류 - 일부 항목의 ID가 없습니다:', {
                        originalCount: originalOrder.length,
                        orderCount: order.length
                    });
                }
                
                // 원래 위치 정보 가져오기
                const itemId = item.getAttribute('data-record-id');
                const originalPos = originalPositions.get(itemId);
                
                try {
                    const result = await reorderWorkoutRecords(targetAppUserId, workoutDate, order);
                    
                    // API 응답 확인
                    if (!result || !result.success) {
                        throw new Error('순서 변경 API 응답이 올바르지 않습니다.');
                    }
                    
                    // 성공 시 원래 위치 정보 삭제 및 캐시 무효화
                    originalPositions.delete(itemId);
                    const { invalidateWorkoutRecordsCache } = await import('../api.js');
                    invalidateWorkoutRecordsCache(targetAppUserId);
                    
                    // 저장 확인: 캐시 무효화 후 즉시 재조회하여 실제 저장된 순서 확인 (캐시 우회)
                    try {
                        // 캐시를 우회하여 직접 API 호출
                        const params = new URLSearchParams({ 
                            app_user_id: targetAppUserId,
                            start_date: workoutDate,
                            end_date: workoutDate
                        });
                        const verifyResponse = await fetch(`/api/workout-records?${params.toString()}`, {
                            method: 'GET',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' }
                        });
                        const verifyRecords = await verifyResponse.json();
                        
                        const verifyOrder = verifyRecords
                            .filter(r => r.workout_date === workoutDate)
                            .map(r => ({ id: r.id, display_order: r.display_order }));
                        
                        // 순서가 일치하는지 확인
                        const orderMap = new Map(order.map(item => [item.id, item.order]));
                        const verifyMap = new Map(verifyOrder.map(item => [item.id, item.display_order]));
                        
                        const mismatches = [];
                        for (const [id, expectedOrder] of orderMap.entries()) {
                            const actualOrder = verifyMap.get(id);
                            if (actualOrder !== expectedOrder) {
                                mismatches.push({ id, expected: expectedOrder, actual: actualOrder });
                            }
                        }
                        
                        if (mismatches.length > 0) {
                            console.error('[Workout Reorder] 저장 확인 실패 - 순서 불일치:', mismatches);
                        }
                    } catch (verifyError) {
                        console.error('[Workout Reorder] 저장 확인 중 오류:', verifyError);
                    }
                } catch (error) {
                    console.error('[Workout Reorder] 순서 변경 실패:', error);
                    console.error('[Workout Reorder] 에러 상세:', {
                        message: error.message,
                        stack: error.stack,
                        response: error.response,
                        appUserId: currentAppUserId,
                        workoutDate,
                        order,
                        oldIndex,
                        newIndex
                    });
                    
                    // 실패 시 원래 위치로 정확히 복원
                    if (originalPos) {
                        if (originalPos.nextSibling) {
                            originalPos.parent.insertBefore(item, originalPos.nextSibling);
                        } else {
                            originalPos.parent.appendChild(item);
                        }
                        originalPositions.delete(itemId);
                    }
                    showError('순서 변경에 실패했습니다.');
                } finally {
                    // 순서 변경 완료 후 플래그 해제
                    reorderInProgress.delete(progressKey);
                }
            },
            onEnd: function(evt) {
                // onEnd는 드래그가 끝났을 때 발생 (원래 위치 복원용)
                const { oldIndex, newIndex, item } = evt;
                
                // 다음 드래그를 위해 원래 순서 초기화
                originalOrder = null;
                
                // 위치가 변경되지 않았으면 원래 위치 정보 삭제
                if (oldIndex === newIndex || oldIndex === -1 || newIndex === -1) {
                    originalPositions.delete(item.getAttribute('data-record-id'));
                }
            }
        });
        
        sortableInstances.push(sortable);
    });
}
