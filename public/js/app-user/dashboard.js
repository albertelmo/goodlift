// 앱 유저 홈/대시보드 화면

import { formatDate, getToday, escapeHtml, getTimeAgo } from './utils.js';
import { getUserSettings, updateUserSettings } from './api.js';
import { getWorkoutRecords, getWorkoutRecordsForCalendar, getDietRecordsForCalendar, getAppUsers, getTrainerActivityLogs, markActivityLogAsRead, markAllActivityLogsAsRead, getMemberActivityLogs, markMemberActivityLogAsRead, markAllMemberActivityLogsAsRead, getAnnouncementsInbox, getAnnouncementDetail, markAnnouncementAsRead } from './api.js';
import { showWorkoutGuideDetailModal } from './guide-modal.js';

let currentUser = null;
let nextSession = null;
let trainerMembers = null; // 트레이너의 연결된 회원 목록
let memberTrainers = null; // 회원의 연결된 트레이너 목록
let todayWorkoutSummary = null; // 오늘의 운동 요약
let monthlyWorkoutCompletionSummary = null; // 이번달 운동 완료 요약
let monthlyDietSummary = null; // 이번달 식단 요약
let monthlyAchievementSummary = null; // 이번달 업적 요약 (코멘트 포함)
let achievementMedalTotals = null; // 누적 메달 집계
let workoutGuideEnabled = false;
let workoutGuideItems = [];
let connectedAppUserInfo = null; // 현재 연결된 유저앱 회원 정보
let trainerMemberMedalStatus = {}; // 트레이너 회원 메달 현황 (app_user_id -> status)
let activityLogs = null; // 트레이너 활동 로그
let activityLogsUnreadCount = 0; // 읽지 않은 로그 개수
let memberActivityLogs = null; // 회원 활동 로그
let memberActivityLogsUnreadCount = 0; // 회원 활동 로그 읽지 않은 개수
let announcementsInbox = [];
let announcementsUnreadCount = 0;

// 활동 로그 자동 업데이트를 위한 인터벌 ID
let activityLogsUpdateInterval = null;
const ACTIVITY_LOGS_UPDATE_INTERVAL = 30000; // 30초마다 업데이트

/**
 * 대시보드 초기화
 */
export async function init(userData) {
    currentUser = userData;
    await Promise.all([
        loadNextSession(),
        loadTrainerMembers(),
        loadMemberTrainers(),
        loadTodayWorkoutSummary(),
        loadMonthlyWorkoutCompletionSummary(),
        loadMonthlyDietSummary(),
        loadMonthlyAchievementSummary(),
        loadAchievementMedalTotals(),
        loadWorkoutGuideSettings(),
        loadWorkoutGuideItems(),
        loadConnectedAppUserInfo(),
        loadActivityLogs(),
        loadMemberActivityLogs(),
        loadAnnouncementsInbox()
    ]);
    await loadTrainerMemberMedalStatus();
    render();
    
    // 활동 로그 자동 업데이트 시작
    startActivityLogsAutoUpdate();
}

async function loadWorkoutGuideSettings() {
    try {
        const appUserId = currentUser?.id;
        if (!appUserId) return;
        const settings = await getUserSettings(appUserId);
        if (settings && typeof settings.workout_guide_enabled !== 'undefined') {
            workoutGuideEnabled = settings.workout_guide_enabled === true || settings.workout_guide_enabled === 'true';
        }
    } catch (error) {
        console.error('운동 가이드 설정 조회 오류:', error);
    }
}

async function loadWorkoutGuideItems() {
    try {
        const response = await fetch('/api/workout-guide-items');
        if (!response.ok) {
            throw new Error('운동 가이드 목록 조회 실패');
        }
        const data = await response.json();
        workoutGuideItems = Array.isArray(data.items) ? data.items : [];
    } catch (error) {
        console.error('운동 가이드 목록 조회 오류:', error);
        workoutGuideItems = [];
    }
}

/**
 * 활동 로그 자동 업데이트 시작
 */
function startActivityLogsAutoUpdate() {
    // 기존 인터벌이 있으면 정리
    stopActivityLogsAutoUpdate();
    
    // 페이지가 포커스되어 있을 때만 업데이트
    const updateActivityLogs = () => {
        if (document.visibilityState === 'visible' && !document.hidden) {
            const isTrainer = currentUser?.isTrainer === true;
            const logsPromise = isTrainer
                ? loadActivityLogs().then(() => updateActivityLogsUI())
                : loadMemberActivityLogs().then(() => updateActivityLogsUI());
            Promise.all([logsPromise, loadAnnouncementsInbox().then(() => updateAnnouncementsUI())]).catch(() => {
                // noop
            });
        }
    };
    
    // 주기적으로 업데이트
    activityLogsUpdateInterval = setInterval(updateActivityLogs, ACTIVITY_LOGS_UPDATE_INTERVAL);
    
    // 페이지 포커스 시 즉시 업데이트
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            updateActivityLogs();
        }
    });
    
    // 윈도우 포커스 시 즉시 업데이트
    window.addEventListener('focus', updateActivityLogs);
}

/**
 * 활동 로그 자동 업데이트 중지
 */
function stopActivityLogsAutoUpdate() {
    if (activityLogsUpdateInterval) {
        clearInterval(activityLogsUpdateInterval);
        activityLogsUpdateInterval = null;
    }
}

/**
 * 활동 로그 UI만 업데이트 (전체 리렌더링 없이)
 */
function updateActivityLogsUI() {
    const container = document.getElementById('app-user-content');
    if (!container) return;
    
    const isTrainer = currentUser?.isTrainer === true;
    
    if (isTrainer) {
        // 트레이너 활동 로그 섹션 찾기
        const sectionTitle = container.querySelector('.app-section-title');
        const logsList = container.querySelector('.app-activity-logs-list');
        
        if (sectionTitle && logsList) {
            updateLogUnreadBadge(activityLogsUnreadCount, true);
            
            // 로그 목록 업데이트 (전체 교체하지 않고 필요한 부분만)
            if (activityLogs && activityLogs.length > 0) {
                const newLogsHTML = activityLogs.map(log => {
                    const timeAgo = getTimeAgo(log.created_at);
                    const isUnread = !log.is_read;
                    
                    return `
                    <div class="app-activity-log-item ${isUnread ? 'app-activity-log-item-unread' : 'app-activity-log-item-read'}" 
                         data-log-id="${log.id}"
                         data-app-user-id="${log.app_user_id || ''}"
                         data-member-name="${escapeHtml(log.member_name || '')}"
                         data-activity-type="${escapeHtml(log.activity_type || '')}"
                         data-record-date="${escapeHtml(log.record_date || '')}"
                         style="cursor:pointer;">
                        <div class="app-activity-log-content">
                            <p class="app-activity-log-message">${escapeHtml(log.activity_message)}</p>
                            <p class="app-activity-log-time">${timeAgo}</p>
                        </div>
                        ${isUnread ? '<div class="app-activity-log-indicator"></div>' : '<div style="width: 10px; flex-shrink: 0;"></div>'}
                    </div>
                    `;
                }).join('');
                logsList.innerHTML = newLogsHTML;
                
                // 이벤트 다시 연결
                setupActivityLogEvents();
            }
        }
    } else {
        // 회원 활동 로그 섹션 찾기
        const sectionTitle = container.querySelector('.app-section-title');
        const logsList = container.querySelector('.app-activity-logs-list');
        
        if (sectionTitle && logsList) {
            updateLogUnreadBadge(memberActivityLogsUnreadCount, false);
            
            // 로그 목록 업데이트
            if (memberActivityLogs && memberActivityLogs.length > 0) {
                const newLogsHTML = memberActivityLogs.map(log => {
                    const timeAgo = getTimeAgo(log.created_at);
                    const isUnread = !log.is_read;
                    
                    return `
                    <div class="app-activity-log-item ${isUnread ? 'app-activity-log-item-unread' : 'app-activity-log-item-read'}" 
                         data-log-id="${log.id}"
                         data-app-user-id="${log.app_user_id || ''}"
                         data-member-name="${escapeHtml(log.member_name || '')}"
                         data-activity-type="${escapeHtml(log.activity_type || '')}"
                         data-record-date="${escapeHtml(log.record_date || '')}"
                         style="cursor:pointer;">
                        <div class="app-activity-log-content">
                            <p class="app-activity-log-message">${escapeHtml(log.activity_message)}</p>
                            <p class="app-activity-log-time">${timeAgo}</p>
                        </div>
                        ${isUnread ? '<div class="app-activity-log-indicator"></div>' : '<div style="width: 10px; flex-shrink: 0;"></div>'}
                    </div>
                    `;
                }).join('');
                logsList.innerHTML = newLogsHTML;
                
                // 이벤트 다시 연결
                setupMemberActivityLogEvents();
            }
        }
    }
}

function updateAnnouncementsUI() {
    const buttons = document.querySelectorAll('.app-announcement-open-btn');
    buttons.forEach(btn => {
        const existingBadge = btn.querySelector('.app-announcement-badge');
        if (announcementsUnreadCount > 0) {
            if (existingBadge) {
                existingBadge.textContent = announcementsUnreadCount;
            } else {
                const badge = document.createElement('span');
                badge.className = 'app-announcement-badge';
                badge.textContent = announcementsUnreadCount;
                btn.appendChild(badge);
            }
        } else if (existingBadge) {
            existingBadge.remove();
        }
    });
}

function updateLogUnreadBadge(count, isTrainer) {
    const btnId = isTrainer ? 'mark-all-read-btn' : 'mark-all-member-read-btn';
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const existing = btn.querySelector('.app-log-unread-badge');
    if (count > 0) {
        if (existing) {
            existing.textContent = count;
        } else {
            const badge = document.createElement('span');
            badge.className = 'app-log-unread-badge';
            badge.textContent = count;
            btn.appendChild(badge);
        }
    } else if (existing) {
        existing.remove();
    }
}

/**
 * 다음 세션 조회
 */
async function loadNextSession() {
    // member_name 확인 (null, undefined, 빈 문자열 체크)
    const memberName = currentUser?.member_name;
    const hasMemberName = memberName && typeof memberName === 'string' && memberName.trim() !== '';
    
    if (!hasMemberName) {
        nextSession = null;
        return;
    }
    
    try {
        const today = getToday(); // YYYY-MM-DD 형식
        
        // 3개월 후까지 조회
        const todayDate = new Date(today);
        const endDate = new Date(todayDate);
        endDate.setMonth(endDate.getMonth() + 3);
        const endDateStr = endDate.toISOString().split('T')[0];
        
        // 세션 조회 API 호출
        const params = new URLSearchParams({
            startDate: today,
            endDate: endDateStr,
            member: currentUser.member_name
        });
        
        const response = await fetch(`/api/sessions?${params.toString()}`);
        if (!response.ok) {
            throw new Error('세션 조회 실패');
        }
        
        const sessions = await response.json();
        
        // 예정된 세션 필터링 (오늘 이후, 완료되지 않은 세션)
        const futureSessions = sessions.filter(session => {
            // 날짜 문자열 비교 (YYYY-MM-DD)
            const sessionDateStr = session.date;
            if (sessionDateStr < today) return false;
            
            // 상태 필터링 (결석, 취소 제외, 완료도 제외)
            const status = session.status || '';
            return status !== '결석' && status !== '취소' && status !== '완료';
        });
        
        // 날짜순 정렬 후 가장 가까운 세션 선택
        if (futureSessions.length > 0) {
            futureSessions.sort((a, b) => {
                const dateA = new Date(a.date + 'T' + a.time);
                const dateB = new Date(b.date + 'T' + b.time);
                return dateA - dateB;
            });
            
            const selectedSession = futureSessions[0];
            
            // 트레이너 정보 조회 (이름 및 프로필 사진)
            let trainerName = null;
            let trainerProfileImageUrl = null;
            if (selectedSession.trainer) {
                try {
                    const trainerResponse = await fetch(`/api/trainers?username=${encodeURIComponent(selectedSession.trainer)}`);
                    if (trainerResponse.ok) {
                        const trainers = await trainerResponse.json();
                        if (trainers && trainers.length > 0) {
                            trainerName = trainers[0].name || selectedSession.trainer;
                            trainerProfileImageUrl = trainers[0].profile_image_url || null;
                        }
                    }
                } catch (err) {
                    console.error('트레이너 정보 조회 오류:', err);
                }
            }
            
            nextSession = {
                ...selectedSession,
                trainerName: trainerName || selectedSession.trainer,
                trainerProfileImageUrl: trainerProfileImageUrl
            };
        } else {
            nextSession = null;
        }
    } catch (error) {
        console.error('다음 세션 조회 오류:', error);
        nextSession = null;
    }
}

/**
 * 오늘의 운동 요약 조회
 */
async function loadTodayWorkoutSummary() {
    try {
        const today = getToday(); // YYYY-MM-DD 형식
        const appUserId = currentUser?.id;
        
        if (!appUserId) {
            todayWorkoutSummary = null;
            return;
        }
        
        // 오늘의 운동기록 조회
        const records = await getWorkoutRecords(appUserId, {
            startDate: today,
            endDate: today
        });
        
        if (!records || records.length === 0) {
            todayWorkoutSummary = null;
            return;
        }
        
        // 요약 정보 계산
        const workoutTypes = new Set();
        let totalSets = 0;
        let totalMinutes = 0;
        
        records.forEach(record => {
            const workoutTypeName = record.workout_type_name;
            const workoutTypeType = record.workout_type_type;
            
            if (workoutTypeName) {
                workoutTypes.add(workoutTypeName);
            }
            
            if (workoutTypeType === '세트' && record.sets) {
                totalSets += record.sets.length;
            } else if (workoutTypeType === '시간' && record.duration_minutes) {
                totalMinutes += record.duration_minutes;
            }
        });
        
        todayWorkoutSummary = {
            workoutCount: workoutTypes.size,
            totalSets: totalSets,
            totalMinutes: totalMinutes
        };
    } catch (error) {
        console.error('오늘의 운동 요약 조회 오류:', error);
        todayWorkoutSummary = null;
    }
}

/**
 * 이번달 식단 요약 조회
 */
async function loadMonthlyDietSummary() {
    try {
        const appUserId = currentUser?.id;
        if (!appUserId) {
            monthlyDietSummary = null;
            return;
        }
        
        const today = new Date(getToday());
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        monthStart.setHours(0, 0, 0, 0);
        monthEnd.setHours(23, 59, 59, 999);
        
        const startDate = formatDate(monthStart);
        const endDate = formatDate(monthEnd);
        const daysInMonth = monthEnd.getDate();
        
        const dietSummary = await getDietRecordsForCalendar(appUserId, startDate, endDate);
        
        let dietDaysCount = 0;
        for (let day = 1; day <= daysInMonth; day += 1) {
            const date = new Date(today.getFullYear(), today.getMonth(), day);
            const dateKey = formatDate(date);
            if (dietSummary && dietSummary[dateKey] && dietSummary[dateKey].hasDiet) {
                dietDaysCount += 1;
            }
        }
        
        monthlyDietSummary = {
            dietDaysCount,
            daysInMonth
        };
    } catch (error) {
        console.error('이번달 식단 요약 조회 오류:', error);
        monthlyDietSummary = null;
    }
}

/**
 * 이번달 운동 완료 요약 조회 (오운완)
 */
async function loadMonthlyWorkoutCompletionSummary() {
    try {
        const appUserId = currentUser?.id;
        if (!appUserId) {
            monthlyWorkoutCompletionSummary = null;
            return;
        }
        
        const today = new Date(getToday());
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        monthStart.setHours(0, 0, 0, 0);
        monthEnd.setHours(23, 59, 59, 999);
        
        const startDate = formatDate(monthStart);
        const endDate = formatDate(monthEnd);
        const daysInMonth = monthEnd.getDate();
        
        const calendarSummary = await getWorkoutRecordsForCalendar(appUserId, startDate, endDate);
        const completedDates = new Set();
        
        if (calendarSummary && typeof calendarSummary === 'object') {
            Object.entries(calendarSummary).forEach(([dateKey, summary]) => {
                if (summary && summary.allCompleted === true) {
                    completedDates.add(dateKey);
                }
            });
        }
        
        const dailyCompletion = Array.from({ length: daysInMonth }, (_, idx) => {
            const day = idx + 1;
            const date = new Date(today.getFullYear(), today.getMonth(), day);
            const dateKey = formatDate(date);
            return completedDates.has(dateKey);
        });
        
        monthlyWorkoutCompletionSummary = {
            daysInMonth,
            completedCount: completedDates.size,
            dailyCompletion
        };
    } catch (error) {
        console.error('이번달 운동 완료 요약 조회 오류:', error);
        monthlyWorkoutCompletionSummary = null;
    }
}

/**
 * 이번달 업적 요약 조회 (코멘트 포함)
 */
async function loadMonthlyAchievementSummary() {
    try {
        const appUserId = currentUser?.id;
        if (!appUserId) {
            monthlyAchievementSummary = null;
            return;
        }
        
        const today = new Date(getToday());
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        monthStart.setHours(0, 0, 0, 0);
        monthEnd.setHours(23, 59, 59, 999);
        
        const startDate = formatDate(monthStart);
        const endDate = formatDate(monthEnd);
        
        const response = await fetch(`/api/app-users/${encodeURIComponent(appUserId)}/achievement-summary?start_date=${startDate}&end_date=${endDate}`);
        if (!response.ok) {
            throw new Error('업적 요약 조회 실패');
        }
        monthlyAchievementSummary = await response.json();
    } catch (error) {
        console.error('이번달 업적 요약 조회 오류:', error);
        monthlyAchievementSummary = null;
    }
}

/**
 * 누적 메달 집계 조회
 */
async function loadAchievementMedalTotals() {
    try {
        const appUserId = currentUser?.id;
        if (!appUserId) {
            achievementMedalTotals = null;
            return;
        }
        const response = await fetch(`/api/app-users/${encodeURIComponent(appUserId)}/achievement-medal-totals`);
        if (!response.ok) {
            throw new Error('누적 메달 집계 조회 실패');
        }
        achievementMedalTotals = await response.json();
    } catch (error) {
        console.error('누적 메달 집계 조회 오류:', error);
        achievementMedalTotals = null;
    }
}

/**
 * 트레이너의 연결된 회원 목록 조회
 * 
 * 로직:
 * 1. app_users에서 member_name이 있는 회원들 조회 (PT 회원과 연결된 유저앱 회원)
 * 2. 각 회원의 member_name으로 members 테이블 조회
 * 3. members.trainer가 현재 트레이너와 일치하는 것만 필터링
 * 4. 유저앱 회원 정보를 표시 (이름, 전화번호 등은 app_users 기준)
 */
async function loadTrainerMembers() {
    // 트레이너 여부 확인 (currentUser의 isTrainer 필드로 확인)
    const isTrainer = currentUser?.isTrainer === true;
    
    if (!isTrainer) {
        trainerMembers = null;
        return;
    }
    
    try {
        const trainerUsername = currentUser?.username;
        
        // 최적화된 API 사용: 트레이너별 연결된 회원을 한 번에 조회
        const response = await fetch(`/api/trainer-members?trainer_username=${encodeURIComponent(trainerUsername)}`);
        if (!response.ok) {
            throw new Error('트레이너 회원 목록 조회 실패');
        }
        
        const members = await response.json();
        
        // 응답 데이터를 기존 형식에 맞게 변환
        trainerMembers = members.map(member => ({
            app_user_id: member.app_user_id,
            name: member.name,
            phone: member.phone || '-',
            username: member.username,
            member_name: member.member_name,
            remainSessions: member.remainSessions || 0
        }));
        
    } catch (error) {
        console.error('트레이너 회원 목록 조회 오류:', error);
        trainerMembers = null;
    }
}

/**
 * 현재 연결된 유저앱 회원 정보 조회
 */
async function loadConnectedAppUserInfo() {
    const isTrainer = currentUser?.isTrainer === true;
    if (!isTrainer) {
        connectedAppUserInfo = null;
        return;
    }
    
    const connectedAppUserId = localStorage.getItem('connectedMemberAppUserId');
    if (!connectedAppUserId) {
        connectedAppUserInfo = null;
        return;
    }
    
    try {
        const response = await fetch(`/api/app-users/${connectedAppUserId}`);
        if (!response.ok) {
            connectedAppUserInfo = null;
            return;
        }
        
        connectedAppUserInfo = await response.json();
    } catch (error) {
        console.error('연결된 회원 정보 조회 오류:', error);
        connectedAppUserInfo = null;
    }
}

/**
 * 트레이너 회원 메달 현황 조회
 */
async function loadTrainerMemberMedalStatus() {
    const isTrainer = currentUser?.isTrainer === true;
    if (!isTrainer) {
        trainerMemberMedalStatus = {};
        return;
    }
    
    const memberIds = new Set();
    if (trainerMembers && trainerMembers.length > 0) {
        trainerMembers.forEach(member => {
            if (member.app_user_id) {
                memberIds.add(member.app_user_id);
            }
        });
    }
    if (connectedAppUserInfo && connectedAppUserInfo.id) {
        memberIds.add(connectedAppUserInfo.id);
    }
    
    if (memberIds.size === 0) {
        trainerMemberMedalStatus = {};
        return;
    }
    
    const today = new Date(getToday());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    monthStart.setHours(0, 0, 0, 0);
    monthEnd.setHours(23, 59, 59, 999);
    
    const startDate = formatDate(monthStart);
    const endDate = formatDate(monthEnd);
    
    try {
        const idsParam = Array.from(memberIds).join(',');
        const response = await fetch(`/api/app-users/medal-status?app_user_ids=${encodeURIComponent(idsParam)}&start_date=${startDate}&end_date=${endDate}`);
        if (!response.ok) {
            throw new Error('메달 현황 조회 실패');
        }
        const data = await response.json();
        const statusMap = {};
        (data.results || []).forEach(item => {
            if (item && item.app_user_id) {
                statusMap[item.app_user_id] = item;
            }
        });
        trainerMemberMedalStatus = statusMap;
    } catch (error) {
        console.error('트레이너 회원 메달 현황 조회 오류:', error);
        trainerMemberMedalStatus = {};
    }
}

/**
 * 트레이너 활동 로그 조회
 */
async function loadActivityLogs() {
    const isTrainer = currentUser?.isTrainer === true;
    
    if (!isTrainer) {
        activityLogs = null;
        activityLogsUnreadCount = 0;
        return;
    }
    
    try {
        const trainerUsername = currentUser?.username;
        if (!trainerUsername) {
            activityLogs = null;
            activityLogsUnreadCount = 0;
            return;
        }
        
        const result = await getTrainerActivityLogs(trainerUsername, {
            limit: 20 // 최신 20개만 조회
        });
        
        activityLogs = result.logs || [];
        activityLogsUnreadCount = result.unreadCount || 0;
    } catch (error) {
        console.error('활동 로그 조회 오류:', error);
        activityLogs = null;
        activityLogsUnreadCount = 0;
    }
}

/**
 * 회원 활동 로그 조회
 */
async function loadMemberActivityLogs() {
    const isTrainer = currentUser?.isTrainer === true;
    
    if (isTrainer) {
        memberActivityLogs = null;
        memberActivityLogsUnreadCount = 0;
        return;
    }
    
    try {
        const appUserId = currentUser?.id;
        if (!appUserId) {
            memberActivityLogs = null;
            memberActivityLogsUnreadCount = 0;
            return;
        }
        
        const result = await getMemberActivityLogs(appUserId, {
            limit: 20 // 최신 20개만 조회
        });
        
        memberActivityLogs = result.logs || [];
        memberActivityLogsUnreadCount = result.unreadCount || 0;
    } catch (error) {
        console.error('회원 활동 로그 조회 오류:', error);
        memberActivityLogs = null;
        memberActivityLogsUnreadCount = 0;
    }
}

/**
 * 공지사항 수신함 조회
 */
async function loadAnnouncementsInbox() {
    const appUserId = currentUser?.id;
    if (!appUserId) {
        announcementsInbox = [];
        announcementsUnreadCount = 0;
        return;
    }
    
    try {
        const result = await getAnnouncementsInbox(appUserId, { limit: 50 });
        announcementsInbox = result.items || [];
        announcementsUnreadCount = result.unreadCount || 0;
    } catch (error) {
        console.error('공지사항 조회 오류:', error);
        announcementsInbox = [];
        announcementsUnreadCount = 0;
    }
}

/**
 * 회원의 연결된 트레이너 목록 조회
 */
async function loadMemberTrainers() {
    // 트레이너가 아닌 경우만 (회원인 경우)
    const isTrainer = currentUser?.isTrainer === true;
    
    if (isTrainer) {
        memberTrainers = null;
        return;
    }
    
    // member_name 확인
    const memberName = currentUser?.member_name;
    if (!memberName || typeof memberName !== 'string' || memberName.trim() === '') {
        memberTrainers = null;
        return;
    }
    
    try {
        // 회원 정보 조회
        const membersResponse = await fetch(`/api/members?name=${encodeURIComponent(memberName)}`);
        if (!membersResponse.ok) {
            throw new Error('회원 정보 조회 실패');
        }
        
        const members = await membersResponse.json();
        const member = members.length > 0 ? members[0] : null;
        
        if (!member || !member.trainer) {
            memberTrainers = null;
            return;
        }
        
        // 트레이너 정보 조회
        const trainersResponse = await fetch(`/api/trainers?username=${encodeURIComponent(member.trainer)}`);
        if (!trainersResponse.ok) {
            throw new Error('트레이너 정보 조회 실패');
        }
        
        const trainers = await trainersResponse.json();
        if (trainers.length > 0) {
            memberTrainers = [{
                username: trainers[0].username,
                name: trainers[0].name || trainers[0].username,
                profile_image_url: trainers[0].profile_image_url || null
            }];
        } else {
            memberTrainers = null;
        }
    } catch (error) {
        console.error('회원 트레이너 목록 조회 오류:', error);
        memberTrainers = null;
    }
}

/**
 * 날짜 형식 변환 (YYYY-MM-DD -> MM/DD)
 */
function formatShortDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1);
    const day = String(date.getDate());
    return `${month}/${day}`;
}

/**
 * 요일 형식 변환
 */
function formatDayOfWeek(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[date.getDay()];
}

/**
 * 시간 형식 변환 (HH:MM -> H:MM)
 */
function formatShortTime(timeStr) {
    if (!timeStr) return '';
    const [hour, minute] = timeStr.split(':');
    if (!hour || !minute) return timeStr;
    return `${parseInt(hour, 10)}:${minute}`;
}

/**
 * 메달 티어 라벨/스타일
 */
function getWorkoutMedalLabel(tier) {
    switch (tier) {
        case 'bronze': return '브론즈';
        case 'silver': return '실버';
        case 'gold': return '골드';
        case 'diamond': return '다이아';
        default: return '기록없음';
    }
}

function getDietMedalLabel(tier) {
    switch (tier) {
        case 'bronze': return '브론즈';
        case 'silver': return '실버';
        case 'gold': return '골드';
        case 'diamond': return '다이아';
        default: return '기록없음';
    }
}

function getMedalTierStyle(tier) {
    switch (tier) {
        case 'bronze':
            return 'background:#fce8d8;color:#8d4f1b;';
        case 'silver':
            return 'background:#eef1f6;color:#546e7a;';
        case 'gold':
            return 'background:#fff3cd;color:#b7791f;';
        case 'diamond':
            return 'background:#e8f5ff;color:#1e88e5;';
        default:
            return 'background:#f5f5f5;color:#666;';
    }
}

function renderMemberMedalBadges(appUserId) {
    const status = trainerMemberMedalStatus[appUserId];
    if (!status) return '';
    const workoutTier = status.workout?.tier || 'none';
    const dietTier = status.diet?.tier || 'none';
    const workoutLabel = getWorkoutMedalLabel(workoutTier);
    const dietLabel = getDietMedalLabel(dietTier);
    return `
        <span style="font-size:0.72rem;color:var(--app-text-muted);">
            🏋️ ${workoutLabel} · 🥗 ${dietLabel}
        </span>
    `;
}

/**
 * 활동 로그 타입에 따른 이동 화면 결정
 */
function getActivityLogTarget(item) {
    if (!item) return null;
    const activityType = item.getAttribute('data-activity-type') || '';
    const recordDate = item.getAttribute('data-record-date') || '';
    if (!activityType || !recordDate) return null;
    
    if (activityType.startsWith('workout')) {
        return { screen: 'workout', recordDate };
    }
    if (activityType.startsWith('diet')) {
        return { screen: 'diet', recordDate };
    }
    return null;
}

/**
 * 활동 로그 클릭 시 해당 화면으로 이동 (날짜 포함)
 */
async function navigateFromActivityLog(item) {
    const activityType = item?.getAttribute('data-activity-type') || '';
    if (activityType === 'announcement') {
        showAnnouncementsModal();
        return;
    }
    const target = getActivityLogTarget(item);
    if (!target) return;
    localStorage.setItem('pendingNavScreen', target.screen);
    localStorage.setItem('pendingNavDate', target.recordDate);
    const { navigateToScreen } = await import('./index.js');
    navigateToScreen(target.screen);
}

/**
 * 대시보드 렌더링
 */
function render() {
    const container = document.getElementById('app-user-content');
    if (!container) return;

    const today = getToday();
    
    // 트레이너 여부 확인 (currentUser의 isTrainer 필드로 확인)
    const isTrainer = currentUser?.isTrainer === true;
    
    // member_name 확인 (null, undefined, 빈 문자열 체크)
    const memberName = currentUser?.member_name;
    const hasMemberName = memberName && typeof memberName === 'string' && memberName.trim() !== '';
    
    // 다음 세션 표시 텍스트 (트레이너가 아닌 경우에만)
    let nextSessionText = '예정된 세션이 없습니다';
    let trainerName = null;
    let trainerProfileImageUrl = null;
    if (!isTrainer && nextSession) {
        const sessionDate = formatShortDate(nextSession.date);
        const dayOfWeek = formatDayOfWeek(nextSession.date);
        const sessionTime = formatShortTime(nextSession.time || '');
        trainerName = nextSession.trainerName || null;
        trainerProfileImageUrl = nextSession.trainerProfileImageUrl || null;
        nextSessionText = `${sessionDate}(${dayOfWeek}) ${sessionTime}`;
    }
    
    // 이번달 오운완 요약 텍스트
    const todayDate = new Date(getToday());
    const todayLabel = `${formatShortDate(today)}(${formatDayOfWeek(today)})`;
    let monthlyCompletionText = '기록 없음';
    let monthlyCompletionGraph = '<div style="font-size: 0.85rem; color: var(--app-text-muted);">기록 없음</div>';
    
    let medalImageSrc = '';
    let medalAlt = '';
    let badgeLabel = '시작~!';
    let badgeStyle = 'background:#f5f5f5;color:#666;';
    let badgeRemainingText = '';
    let workoutCardStyle = '';
    if (monthlyWorkoutCompletionSummary) {
        const completedCount = monthlyWorkoutCompletionSummary.completedCount || 0;
        const daysInMonth = monthlyWorkoutCompletionSummary.daysInMonth || 0;
        monthlyCompletionText = `오운완 ${completedCount}일`;
        
        const effectiveDays = Math.max(1, daysInMonth - 15);
        const ratio = completedCount > 0 ? completedCount / effectiveDays : 0;
        const maxBars = 8;
        const rawBars = Math.round(ratio * maxBars);
        const filledBars = completedCount > 0
            ? Math.max(1, Math.min(maxBars, rawBars))
            : Math.max(0, Math.min(maxBars, rawBars));
        const barHeights = [6, 8, 10, 12, 14, 16, 18, 20];
        
        const bars = barHeights.map((height, index) => {
            const isFilled = index < filledBars;
            const background = isFilled ? '#4caf50' : '#e0e0e0';
            return `<div style="width: 4px; height: ${height}px; border-radius: 2px; background: ${background};"></div>`;
        }).join('');

        if (completedCount >= 1 && completedCount <= 4) {
            medalImageSrc = '/img/medal/bronze.png';
            medalAlt = 'BRONZE';
            badgeLabel = '브론즈';
            badgeStyle = 'background:#fce8d8;color:#8d4f1b;';
            badgeRemainingText = `실버까지<br>${5 - completedCount}일!`;
        } else if (completedCount >= 5 && completedCount <= 8) {
            medalImageSrc = '/img/medal/silver.png';
            medalAlt = 'SILVER';
            badgeLabel = '실버';
            badgeStyle = 'background:#eef1f6;color:#546e7a;';
            badgeRemainingText = `골드까지<br>${9 - completedCount}일!`;
        } else if (completedCount >= 9 && completedCount <= 12) {
            medalImageSrc = '/img/medal/gold.png';
            medalAlt = 'GOLD';
            badgeLabel = '골드';
            badgeStyle = 'background:#fff3cd;color:#b7791f;';
            badgeRemainingText = `다이아까지<br>${13 - completedCount}일!`;
        } else if (completedCount >= 13) {
            medalImageSrc = '/img/medal/diamond.png';
            medalAlt = 'DIAMOND';
            badgeLabel = '다이아';
            badgeStyle = 'background:#e8f5ff;color:#1e88e5;';
            badgeRemainingText = '';
            workoutCardStyle = 'background:#e8f5ff;border:2px solid #64b5f6;box-shadow:0 6px 16px rgba(30,136,229,0.18);';
        } else {
            badgeLabel = '시작~!';
            badgeStyle = 'background:#f5f5f5;color:#666;';
            badgeRemainingText = '';
        }
        
        monthlyCompletionGraph = `
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 0; margin-left: 2px; transform: translateY(-4px);">
                <div style="display: flex; align-items: flex-end; gap: 2px;">
                    ${bars}
                </div>
            </div>
        `;
    }
    
    // 이번달 식단 요약 텍스트
    let monthlyDietText = '식단 0일';
    let monthlyDietGraph = '<div style="font-size: 0.85rem; color: var(--app-text-muted);">기록 없음</div>';
    
    let dietMedalImageSrc = '';
    let dietMedalAlt = '';
    let dietBadgeLabel = '시작~!';
    let dietBadgeStyle = 'background:#f5f5f5;color:#666;';
    let dietBadgeRemainingText = '';
    let dietCardStyle = '';
    if (monthlyDietSummary) {
        const dietDaysCount = monthlyDietSummary.dietDaysCount || 0;
        const daysInMonth = monthlyDietSummary.daysInMonth || 0;
        monthlyDietText = `식단 ${dietDaysCount}일`;
        
        const effectiveDays = Math.max(1, daysInMonth - 10);
        const ratio = dietDaysCount > 0 ? dietDaysCount / effectiveDays : 0;
        const maxBars = 8;
        const rawBars = Math.round(ratio * maxBars);
        const filledBars = dietDaysCount > 0
            ? Math.max(1, Math.min(maxBars, rawBars))
            : Math.max(0, Math.min(maxBars, rawBars));
        const barHeights = [6, 8, 10, 12, 14, 16, 18, 20];
        
        const bars = barHeights.map((height, index) => {
            const isFilled = index < filledBars;
            const background = isFilled ? '#4caf50' : '#e0e0e0';
            return `<div style="width: 4px; height: ${height}px; border-radius: 2px; background: ${background};"></div>`;
        }).join('');
        
        if (dietDaysCount >= 1 && dietDaysCount <= 5) {
            dietMedalImageSrc = '/img/medal/bronze.png';
            dietMedalAlt = 'BRONZE';
            dietBadgeLabel = '브론즈';
            dietBadgeStyle = 'background:#fce8d8;color:#8d4f1b;';
            dietBadgeRemainingText = `실버까지<br>${6 - dietDaysCount}일!`;
        } else if (dietDaysCount >= 6 && dietDaysCount <= 10) {
            dietMedalImageSrc = '/img/medal/silver.png';
            dietMedalAlt = 'SILVER';
            dietBadgeLabel = '실버';
            dietBadgeStyle = 'background:#eef1f6;color:#546e7a;';
            dietBadgeRemainingText = `골드까지<br>${11 - dietDaysCount}일!`;
        } else if (dietDaysCount >= 11 && dietDaysCount <= 15) {
            dietMedalImageSrc = '/img/medal/gold.png';
            dietMedalAlt = 'GOLD';
            dietBadgeLabel = '골드';
            dietBadgeStyle = 'background:#fff3cd;color:#b7791f;';
            dietBadgeRemainingText = `다이아까지<br>${16 - dietDaysCount}일!`;
        } else if (dietDaysCount >= 16) {
            dietMedalImageSrc = '/img/medal/diamond.png';
            dietMedalAlt = 'DIAMOND';
            dietBadgeLabel = '다이아';
            dietBadgeStyle = 'background:#e8f5ff;color:#1e88e5;';
            dietBadgeRemainingText = '';
            dietCardStyle = 'background:#e8f5ff;border:2px solid #64b5f6;box-shadow:0 6px 16px rgba(30,136,229,0.18);';
        } else {
            dietBadgeLabel = '시작~!';
            dietBadgeStyle = 'background:#f5f5f5;color:#666;';
            dietBadgeRemainingText = '';
        }
        
        monthlyDietGraph = `
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 0; margin-left: 2px; transform: translateY(-4px);">
                <div style="display: flex; align-items: flex-end; gap: 2px;">
                    ${bars}
                </div>
            </div>
        `;
    }

    const workoutMemberComments = monthlyAchievementSummary?.workoutMemberCommentCount || 0;
    const workoutTrainerComments = monthlyAchievementSummary?.workoutTrainerCommentCount || 0;
    const dietMemberComments = monthlyAchievementSummary?.dietMemberCommentCount || 0;
    const dietTrainerComments = monthlyAchievementSummary?.dietTrainerCommentCount || 0;
    const memberCommentTotal = workoutMemberComments + dietMemberComments;
    const trainerCommentTotal = workoutTrainerComments + dietTrainerComments;

    const getCommentTier = (count) => {
        if (count >= 16) return { tier: 'diamond', label: '다이아', medal: '/img/medal/diamond.png' };
        if (count >= 11) return { tier: 'gold', label: '골드', medal: '/img/medal/gold.png' };
        if (count >= 6) return { tier: 'silver', label: '실버', medal: '/img/medal/silver.png' };
        if (count >= 1) return { tier: 'bronze', label: '브론즈', medal: '/img/medal/bronze.png' };
        return { tier: 'none', label: '미취득', medal: null };
    };

    const memberCommentTier = getCommentTier(memberCommentTotal);
    const trainerCommentTier = getCommentTier(trainerCommentTotal);

    const getWorkoutTier = (count) => {
        if (count >= 13) return 'diamond';
        if (count >= 9) return 'gold';
        if (count >= 5) return 'silver';
        if (count >= 1) return 'bronze';
        return 'none';
    };

    const getDietTier = (count) => {
        if (count >= 16) return 'diamond';
        if (count >= 11) return 'gold';
        if (count >= 6) return 'silver';
        if (count >= 1) return 'bronze';
        return 'none';
    };

    const tierLabels = {
        none: '시작~!',
        bronze: '브론즈',
        silver: '실버',
        gold: '골드',
        diamond: '다이아'
    };

    const tierStyles = {
        bronze: 'background:#fce8d8;color:#8d4f1b;',
        silver: 'background:#eef1f6;color:#546e7a;',
        gold: 'background:#fff3cd;color:#b7791f;',
        diamond: 'background:#e8f5ff;color:#1e88e5;'
    };

    const medalTotals = achievementMedalTotals || {
        workout: { bronze: 0, silver: 0, gold: 0, diamond: 0 },
        diet: { bronze: 0, silver: 0, gold: 0, diamond: 0 },
        memberComment: { bronze: 0, silver: 0, gold: 0, diamond: 0 },
        trainerComment: { bronze: 0, silver: 0, gold: 0, diamond: 0 }
    };
    const medalTierOrder = ['bronze', 'silver', 'gold', 'diamond'];
    const renderTotalsRow = (label, totals) => `
        <div class="app-achievement-totals-row">
            <div class="app-achievement-totals-label">${label}</div>
            <div class="app-achievement-totals-badges">
                ${medalTierOrder.map(tier => `
                    <span class="app-achievement-totals-badge" style="${tierStyles[tier]}">
                        ${tierLabels[tier]} ${totals?.[tier] ?? 0}
                    </span>
                `).join('')}
            </div>
        </div>
    `;
    const renderTotalsMedalRow = (totals) => {
        return medalLevels.map(level => {
            const count = totals?.[level.tier] ?? 0;
            return `
                <div class="app-achievement-medal-wrap">
                    <img src="${level.src}" alt="${level.label}" class="${count > 0 ? 'is-earned' : 'is-locked'}">
                    ${count > 0 ? `<span class="app-achievement-medal-count">x${count}</span>` : ''}
                </div>
            `;
        }).join('');
    };

    const tierRank = {
        none: 0,
        bronze: 1,
        silver: 2,
        gold: 3,
        diamond: 4
    };

    const medalLevels = [
        { tier: 'bronze', label: '브론즈', src: '/img/medal/bronze.png' },
        { tier: 'silver', label: '실버', src: '/img/medal/silver.png' },
        { tier: 'gold', label: '골드', src: '/img/medal/gold.png' },
        { tier: 'diamond', label: '다이아', src: '/img/medal/diamond.png' }
    ];

    const renderMedalRow = (currentTier, remainingText = null) => {
        const rank = tierRank[currentTier] || 0;
        const nextTier = medalLevels.find(level => tierRank[level.tier] === rank + 1);
        const overlayText = remainingText ? `${remainingText}<br>남음` : '';
        return medalLevels.map(level => {
            const isEarned = tierRank[level.tier] <= rank;
            const overlay = !isEarned && nextTier && nextTier.tier === level.tier && overlayText
                ? `<span class="app-achievement-medal-overlay">${overlayText}</span>`
                : '';
            return `
                <div class="app-achievement-medal-wrap">
                    <img src="${level.src}" alt="${level.label}" class="${isEarned ? 'is-earned' : 'is-locked'}">
                    ${overlay}
                </div>
            `;
        }).join('');
    };

    const workoutDays = monthlyWorkoutCompletionSummary?.completedCount || 0;
    const dietDays = monthlyDietSummary?.dietDaysCount || 0;
    const workoutTier = getWorkoutTier(workoutDays);
    const dietTier = getDietTier(dietDays);
    const workoutTitle = `오운완 ${workoutDays}일`;
    const dietTitle = `식단 ${dietDays}일`;
    const memberCommentTitle = `회원 코멘트 ${memberCommentTotal}회`;
    const trainerCommentTitle = `트레이너 코멘트 ${trainerCommentTotal}회`;
    const shouldShowGuideButton = !isTrainer && workoutGuideEnabled;

    const guideItems = (Array.isArray(workoutGuideItems) ? workoutGuideItems : []).filter(item => item.guide_is_active !== false).map(item => {
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
    });

    const getRemainingText = (count, thresholds, unit) => {
        for (const threshold of thresholds) {
            if (count < threshold) {
                return `${threshold - count}${unit}`;
            }
        }
        return null;
    };

    const workoutRemaining = getRemainingText(workoutDays, [1, 5, 9, 13], '일');
    const dietRemaining = getRemainingText(dietDays, [1, 6, 11, 16], '일');
    const memberCommentRemaining = getRemainingText(memberCommentTotal, [1, 6, 11, 16], '회');
    const trainerCommentRemaining = getRemainingText(trainerCommentTotal, [1, 6, 11, 16], '회');
    
    const primaryTrainer = Array.isArray(memberTrainers) && memberTrainers.length > 0 ? memberTrainers[0] : null;
    const trainerDisplayName = primaryTrainer?.name || null;
    const trainerDisplayImage = primaryTrainer?.profile_image_url || null;

    container.innerHTML = `
        <div class="app-dashboard">
            <div class="app-dashboard-header" style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                <div style="min-width: 0;">
                    <h1 class="app-dashboard-title">안녕하세요, ${escapeHtml(currentUser?.name || '회원')}님 👋</h1>
                </div>
                ${!isTrainer && trainerDisplayName ? `
                    <div class="app-trainer-header-link" style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; cursor: pointer;" data-trainer-username="${escapeHtml(primaryTrainer?.username || '')}">
                        <div style="display: flex; flex-direction: column; align-items: flex-end; line-height: 1.2;">
                            <div style="font-size: 0.85rem; color: var(--app-text); white-space: nowrap;">${escapeHtml(trainerDisplayName)}</div>
                            <div style="font-size: 0.75rem; color: var(--app-text-muted); white-space: nowrap;">트레이너</div>
                        </div>
                        
                    </div>
                ` : ''}
            </div>
            
            ${isTrainer ? `
            <!-- 활동 로그 섹션 (트레이너: 맨 위로 이동) -->
            <div class="app-dashboard-section">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 12px;">
                    <h2 class="app-section-title" style="margin: 0;">
                        🔔 알림
                    </h2>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <button type="button" class="app-btn-secondary app-announcement-open-btn" style="padding: 6px 12px; font-size: 0.875rem; white-space: nowrap;">
                            공지사항
                            ${announcementsUnreadCount > 0 ? `<span class="app-announcement-badge">${announcementsUnreadCount}</span>` : ''}
                        </button>
                        <button id="mark-all-read-btn" class="app-btn-secondary" style="padding: 6px 12px; font-size: 0.875rem; white-space: nowrap;">
                            전체 읽음
                            ${activityLogsUnreadCount > 0 ? `<span class="app-log-unread-badge">${activityLogsUnreadCount}</span>` : ''}
                        </button>
                    </div>
                </div>
                <div class="app-activity-logs-list">
                    ${activityLogs && activityLogs.length > 0 ? activityLogs.map(log => {
                        // 상대 시간 계산
                        const timeAgo = getTimeAgo(log.created_at);
                        const isUnread = !log.is_read;
                        
                        return `
                        <div class="app-activity-log-item ${isUnread ? 'app-activity-log-item-unread' : 'app-activity-log-item-read'}" 
                             data-log-id="${log.id}"
                             data-app-user-id="${log.app_user_id || ''}"
                             data-member-name="${escapeHtml(log.member_name || '')}"
                             data-activity-type="${escapeHtml(log.activity_type || '')}"
                             data-record-date="${escapeHtml(log.record_date || '')}"
                             style="cursor:pointer;">
                            <div class="app-activity-log-content">
                                <p class="app-activity-log-message">${escapeHtml(log.activity_message)}</p>
                                <p class="app-activity-log-time">${timeAgo}</p>
                            </div>
                            ${isUnread ? '<div class="app-activity-log-indicator"></div>' : '<div style="width: 10px; flex-shrink: 0;"></div>'}
                        </div>
                        `;
                    }).join('') : '<div style="padding: 20px; text-align: center; color: var(--app-text-muted);">활동 로그가 없습니다</div>'}
                </div>
            </div>
            
            ` : `
            <!-- 일반 회원용 카드 및 통계 -->
            <div class="app-dashboard-cards">
                <div class="app-card app-card-info" id="next-session-card" style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                    <div class="app-card-icon">🏋️</div>
                    <div class="app-card-content" style="flex: 1; min-width: 0;">
                        <h3>다음 수업</h3>
                        <p class="app-card-value">
                            ${escapeHtml(hasMemberName ? nextSessionText : '연결된 회원 정보가 없습니다')}
                        </p>
                    </div>
                    ${trainerProfileImageUrl 
                        ? `<div style="flex-shrink: 0; margin: -8px 0;">
                            <img src="${escapeHtml(trainerProfileImageUrl)}" alt="트레이너 프로필" class="trainer-profile-image" data-profile-image-url="${escapeHtml(trainerProfileImageUrl)}" data-trainer-name="${escapeHtml(trainerName || '트레이너')}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 50%; border: 2px solid var(--app-border); cursor: pointer; display: block;" onerror="this.style.display='none';" />
                          </div>`
                        : trainerName 
                            ? `<div style="flex-shrink: 0; text-align: right; font-size: 14px; color: var(--app-text-muted);">
                                ${escapeHtml(trainerName)} 트레이너
                              </div>` 
                            : ''}
                </div>
                
                <div class="app-card app-card-primary" id="today-workout-card" style="cursor: pointer; ${workoutCardStyle}">
                    <div class="app-card-icon">💪</div>
                    <div class="app-card-content" style="display: flex; align-items: stretch; gap: 12px;">
                        <div style="flex: 1; min-width: 0;">
                            <h3>
                                <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:0.8rem;font-weight:700;${badgeStyle}">${badgeLabel}</span>
                            </h3>
                            <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                                <p class="app-card-value app-card-value-compact" style="margin: 0;">${escapeHtml(monthlyCompletionText)}</p>
                                ${monthlyCompletionGraph}
                            </div>
                        </div>
                        ${monthlyWorkoutCompletionSummary ? `
                            <div class="app-achievement-trigger" style="display: flex; align-items: center; justify-content: center; gap: 8px; height: 100%; align-self: stretch; padding-left: 6px; margin: -8px 0;">
                                ${monthlyWorkoutCompletionSummary.completedCount > 0 && badgeRemainingText ? `
                                    <span style="font-size:0.75rem;color:var(--app-text-muted);white-space:nowrap;text-align:right;">${badgeRemainingText}</span>
                                ` : ''}
                                ${medalImageSrc && monthlyWorkoutCompletionSummary.completedCount > 0 ? `
                                    <img src="${medalImageSrc}" alt="${medalAlt}" style="width: 60px; height: 60px; object-fit: cover; flex-shrink: 0; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.2);" />
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="app-card app-card-secondary" id="diet-summary-card" style="cursor: pointer; ${dietCardStyle}">
                    <div class="app-card-icon">🥗</div>
                    <div class="app-card-content" style="display: flex; align-items: stretch; gap: 12px;">
                        <div style="flex: 1; min-width: 0;">
                            <h3>
                                <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:0.8rem;font-weight:700;${dietBadgeStyle}">${dietBadgeLabel}</span>
                            </h3>
                            <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                                <p class="app-card-value app-card-value-compact" style="margin: 0;">${escapeHtml(monthlyDietText)}</p>
                                ${monthlyDietGraph}
                            </div>
                        </div>
                        ${monthlyDietSummary ? `
                            <div class="app-achievement-trigger" style="display: flex; align-items: center; justify-content: center; gap: 8px; height: 100%; align-self: stretch; padding-left: 6px; margin: -8px 0;">
                                ${monthlyDietSummary.dietDaysCount > 0 && dietBadgeRemainingText ? `
                                    <span style="font-size:0.75rem;color:var(--app-text-muted);white-space:nowrap;text-align:right;">${dietBadgeRemainingText}</span>
                                ` : ''}
                                ${dietMedalImageSrc && monthlyDietSummary.dietDaysCount > 0 ? `
                                    <img src="${dietMedalImageSrc}" alt="${dietMedalAlt}" style="width: 60px; height: 60px; object-fit: cover; flex-shrink: 0; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.2);" />
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            `}
            
            <!-- 회원 활동 로그 섹션 (일반 회원) -->
            ${!isTrainer ? `
            <div class="app-dashboard-section">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 12px;">
                    <h2 class="app-section-title" style="margin: 0;">
                        🔔 알림
                    </h2>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <button type="button" class="app-btn-secondary app-announcement-open-btn" style="padding: 6px 12px; font-size: 0.875rem; white-space: nowrap;">
                            공지사항
                            ${announcementsUnreadCount > 0 ? `<span class="app-announcement-badge">${announcementsUnreadCount}</span>` : ''}
                        </button>
                        <button id="mark-all-member-read-btn" class="app-btn-secondary" style="padding: 6px 12px; font-size: 0.875rem; white-space: nowrap;">
                            전체 읽음
                            ${memberActivityLogsUnreadCount > 0 ? `<span class="app-log-unread-badge">${memberActivityLogsUnreadCount}</span>` : ''}
                        </button>
                    </div>
                </div>
                <div class="app-activity-logs-list app-activity-logs-list-member">
                    ${memberActivityLogs && memberActivityLogs.length > 0 ? memberActivityLogs.map(log => {
                        const timeAgo = getTimeAgo(log.created_at);
                        const isUnread = !log.is_read;
                        
                        return `
                        <div class="app-activity-log-item ${isUnread ? 'app-activity-log-item-unread' : 'app-activity-log-item-read'}" 
                             data-log-id="${log.id}"
                             data-app-user-id="${log.app_user_id || ''}"
                             data-member-name="${escapeHtml(log.member_name || '')}"
                             data-activity-type="${escapeHtml(log.activity_type || '')}"
                             data-record-date="${escapeHtml(log.record_date || '')}"
                             style="cursor:pointer;">
                            <div class="app-activity-log-content">
                                <p class="app-activity-log-message">${escapeHtml(log.activity_message)}</p>
                                <p class="app-activity-log-time">${timeAgo}</p>
                            </div>
                            ${isUnread ? '<div class="app-activity-log-indicator"></div>' : '<div style="width: 10px; flex-shrink: 0;"></div>'}
                        </div>
                        `;
                    }).join('') : '<div style="padding: 20px; text-align: center; color: var(--app-text-muted);">활동 로그가 없습니다</div>'}
                </div>
            </div>
            ` : ''}
            
            ${isTrainer ? `
            <div class="app-dashboard-section">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                    <h2 class="app-section-title" style="margin: 0;">
                        👥 ${trainerMembers && trainerMembers.length > 0 ? `나의 회원 (${trainerMembers.length}명)` : '나의 회원'}
                    </h2>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${(() => {
                            const connectedAppUserId = localStorage.getItem('connectedMemberAppUserId');
                            if (connectedAppUserId && connectedAppUserInfo) {
                                return `<span style="font-size: 0.875rem; color: var(--app-primary); font-weight: 500;">${escapeHtml(connectedAppUserInfo.name || '회원')} 회원과 연결중</span>`;
                            }
                            return '';
                        })()}
                        <button id="search-member-btn" class="app-btn-secondary" style="padding: 6px 12px; font-size: 0.875rem; white-space: nowrap;">
                            🔍 회원 검색
                        </button>
                    </div>
                </div>
                <div class="app-member-list">
                    ${(() => {
                        const connectedAppUserId = localStorage.getItem('connectedMemberAppUserId');
                        let html = '';
                        
                        // 연결된 회원이 내 회원 목록에 없으면 맨 위에 표시
                        if (connectedAppUserId && connectedAppUserInfo) {
                            const isInMyMembers = trainerMembers && trainerMembers.some(m => m.app_user_id === connectedAppUserId);
                            
                            if (!isInMyMembers) {
                                // 연결된 회원이 내 회원 목록에 없으면 맨 위에 표시
                                html += `
                                <div class="app-member-item app-member-item-connected" 
                                     data-app-user-id="${connectedAppUserInfo.id}" 
                                     data-member-name="${connectedAppUserInfo.member_name ? escapeHtml(connectedAppUserInfo.member_name) : ''}"
                                     style="cursor:pointer;">
                                    <div class="app-member-info">
                                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                            <p class="app-member-name">${escapeHtml(connectedAppUserInfo.name || '회원')}</p>
                                            ${renderMemberMedalBadges(connectedAppUserInfo.id)}
                                            <span style="color:#4caf50;font-size:0.75rem;font-weight:600;">(연결됨)</span>
                                        </div>
                                        ${connectedAppUserInfo.remainSessions !== undefined && connectedAppUserInfo.remainSessions > 0 ? `
                                            <p class="app-member-details">
                                                남은 세션: ${connectedAppUserInfo.remainSessions}회
                                            </p>
                                        ` : ''}
                                    </div>
                                </div>
                                `;
                            }
                        }
                        
                        // 내 회원 목록 표시
                        if (trainerMembers && trainerMembers.length > 0) {
                            html += trainerMembers.map(member => {
                                const isConnected = connectedAppUserId === member.app_user_id;
                                return `
                                <div class="app-member-item ${isConnected ? 'app-member-item-connected' : ''}" 
                                     data-app-user-id="${member.app_user_id}" 
                                     data-member-name="${member.member_name ? escapeHtml(member.member_name) : ''}"
                                     style="cursor:pointer;">
                                    <div class="app-member-info">
                                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                            <p class="app-member-name">${escapeHtml(member.name)}</p>
                                            ${renderMemberMedalBadges(member.app_user_id)}
                                            ${isConnected ? '<span style="color:#4caf50;font-size:0.75rem;font-weight:600;">(연결됨)</span>' : ''}
                                        </div>
                                        ${member.remainSessions !== undefined && member.remainSessions > 0 ? `
                                            <p class="app-member-details">
                                                남은 세션: ${member.remainSessions}회
                                            </p>
                                        ` : ''}
                                    </div>
                                </div>
                            `;
                            }).join('');
                        } else if (!connectedAppUserId || !connectedAppUserInfo) {
                            // 연결된 회원도 없고 내 회원도 없으면
                            html += '<div style="padding: 20px; text-align: center; color: var(--app-text-muted);">연결된 회원이 없습니다</div>';
                        }
                        
                        return html;
                    })()}
                </div>
            </div>
            ` : ''}
            
            ${!isTrainer ? `
            <div class="app-achievement-modal" id="app-achievement-modal">
                <div class="app-achievement-modal-content">
                    <div class="app-achievement-modal-header">
                        <div class="app-achievement-header-row">
                            <h3 class="app-achievement-modal-title">이번달 업적</h3>
                            <button type="button" class="app-achievement-totals-btn" id="app-achievement-totals-open">전체 수집 메달</button>
                        </div>
                        <button type="button" class="app-achievement-modal-close" id="app-achievement-modal-close" aria-label="닫기">×</button>
                    </div>
                    <div class="app-achievement-grid">
                        <div class="app-achievement-card">
                            <div class="app-achievement-card-title">
                                ${workoutTitle}
                                ${workoutTier !== 'none' ? `<span class="app-achievement-badge" style="${tierStyles[workoutTier]}">${tierLabels[workoutTier]}</span>` : ''}
                            </div>
                            <div class="app-achievement-medal-row">
                                ${renderMedalRow(workoutTier, workoutRemaining)}
                            </div>
                        </div>
                        <div class="app-achievement-card">
                            <div class="app-achievement-card-title">
                                ${dietTitle}
                                ${dietTier !== 'none' ? `<span class="app-achievement-badge" style="${tierStyles[dietTier]}">${tierLabels[dietTier]}</span>` : ''}
                            </div>
                            <div class="app-achievement-medal-row">
                                ${renderMedalRow(dietTier, dietRemaining)}
                            </div>
                        </div>
                        <div class="app-achievement-card">
                            <div class="app-achievement-card-title">
                                ${memberCommentTitle}
                                ${memberCommentTier.tier !== 'none' ? `<span class="app-achievement-badge" style="${tierStyles[memberCommentTier.tier]}">${tierLabels[memberCommentTier.tier]}</span>` : ''}
                            </div>
                            <div class="app-achievement-medal-row">
                                ${renderMedalRow(memberCommentTier.tier, memberCommentRemaining)}
                            </div>
                        </div>
                        <div class="app-achievement-card">
                            <div class="app-achievement-card-title">
                                ${trainerCommentTitle}
                                ${trainerCommentTier.tier !== 'none' ? `<span class="app-achievement-badge" style="${tierStyles[trainerCommentTier.tier]}">${tierLabels[trainerCommentTier.tier]}</span>` : ''}
                            </div>
                            <div class="app-achievement-medal-row">
                                ${renderMedalRow(trainerCommentTier.tier, trainerCommentRemaining)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="app-achievement-modal" id="app-achievement-totals-modal" style="display:none;">
                <div class="app-achievement-modal-content">
                    <div class="app-achievement-modal-header">
                        <h3 class="app-achievement-modal-title">전체 수집 메달</h3>
                        <button type="button" class="app-achievement-modal-close" id="app-achievement-totals-close" aria-label="닫기">×</button>
                    </div>
                    <div class="app-achievement-grid">
                        <div class="app-achievement-card">
                            <div class="app-achievement-card-title">오운완</div>
                            <div class="app-achievement-medal-row">
                                ${renderTotalsMedalRow(medalTotals.workout)}
                            </div>
                        </div>
                        <div class="app-achievement-card">
                            <div class="app-achievement-card-title">식단</div>
                            <div class="app-achievement-medal-row">
                                ${renderTotalsMedalRow(medalTotals.diet)}
                            </div>
                        </div>
                        <div class="app-achievement-card">
                            <div class="app-achievement-card-title">회원 코멘트</div>
                            <div class="app-achievement-medal-row">
                                ${renderTotalsMedalRow(medalTotals.memberComment)}
                            </div>
                        </div>
                        <div class="app-achievement-card">
                            <div class="app-achievement-card-title">트레이너 코멘트</div>
                            <div class="app-achievement-medal-row">
                                ${renderTotalsMedalRow(medalTotals.trainerComment)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            ` : ''}
        </div>
    `;
    
    // 회원 목록 클릭 이벤트 설정
    if (!isTrainer) {
        const guideHtml = `
            <button type="button" class="app-guide-fab" id="app-guide-fab" style="${shouldShowGuideButton ? '' : 'display:none;'}">
                <span>운동</span>
                <span>가이드</span>
            </button>
            <div class="app-guide-modal" id="app-guide-modal">
                <div class="app-guide-modal-content">
                    <div class="app-guide-modal-header">
                        <h3>운동 가이드</h3>
                        <button class="app-guide-modal-close" id="app-guide-modal-close">×</button>
                    </div>
                    <div class="app-guide-modal-body">
                        <div class="app-guide-list" id="app-guide-list">
                            ${guideItems.length === 0
                                ? '<div class="app-guide-empty">준비중입니다.</div>'
                                : guideItems.map((item, index) => `
                                    <button class="app-guide-list-item" data-guide-id="${item.id}">
                                        ${escapeHtml(item.title)}
                                    </button>
                                `).join('')}
                        </div>
                    </div>
                    <label class="app-guide-dismiss">
                        <input type="checkbox" id="app-guide-dismiss-checkbox" ${workoutGuideEnabled ? '' : 'checked'}>
                        운동가이드 버튼 숨기기
                    </label>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', guideHtml);

        const guideFab = container.querySelector('#app-guide-fab');
        const guideModal = container.querySelector('#app-guide-modal');
        const guideCloseBtn = container.querySelector('#app-guide-modal-close');
        const guideList = container.querySelector('#app-guide-list');
        const guideDismissCheckbox = container.querySelector('#app-guide-dismiss-checkbox');

        if (guideFab && guideModal) {
            guideFab.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                guideModal.style.display = 'flex';
            });
            guideFab.addEventListener('touchstart', (event) => {
                event.preventDefault();
                event.stopPropagation();
                guideModal.style.display = 'flex';
            }, { passive: false });
        }
        if (guideCloseBtn && guideModal) {
            guideCloseBtn.addEventListener('click', () => {
                guideModal.style.display = 'none';
            });
            guideModal.addEventListener('click', (e) => {
                if (e.target === guideModal) {
                    guideModal.style.display = 'none';
                }
            });
        }
        if (guideList) {
            guideList.querySelectorAll('.app-guide-list-item').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-guide-id');
                    const item = guideItems.find(i => i.id === id);
                    showWorkoutGuideDetailModal(item);
                });
            });
        }
        if (guideDismissCheckbox) {
            guideDismissCheckbox.addEventListener('change', async () => {
                const dismissed = guideDismissCheckbox.checked;
                workoutGuideEnabled = !dismissed;
                try {
                    await updateUserSettings(currentUser.id, { workout_guide_enabled: workoutGuideEnabled });
                } catch (error) {
                    console.error('운동 가이드 설정 업데이트 오류:', error);
                }
                if (dismissed) {
                    alert('내정보에서 버튼보기 설정이 가능합니다.');
                }
                if (dismissed && guideFab) {
                    guideFab.style.display = 'none';
                    guideModal.style.display = 'none';
                }
            });
        }
    }

    const achievementModal = container.querySelector('#app-achievement-modal');
    const achievementTotalsModal = container.querySelector('#app-achievement-totals-modal');
    const achievementTotalsOpen = container.querySelector('#app-achievement-totals-open');
    const achievementTotalsClose = container.querySelector('#app-achievement-totals-close');
    if (achievementTotalsOpen && achievementTotalsModal) {
        achievementTotalsOpen.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            achievementTotalsModal.style.display = 'flex';
        });
        achievementTotalsOpen.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            achievementTotalsModal.style.display = 'flex';
        }, { passive: false });
    }
    if (achievementTotalsClose && achievementTotalsModal) {
        achievementTotalsClose.addEventListener('click', () => {
            achievementTotalsModal.style.display = 'none';
        });
        achievementTotalsClose.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            achievementTotalsModal.style.display = 'none';
        }, { passive: false });
        achievementTotalsModal.addEventListener('click', (e) => {
            if (e.target === achievementTotalsModal) {
                achievementTotalsModal.style.display = 'none';
            }
        });
    }

    setupMemberClickEvents();
    
    // 트레이너 목록 클릭 이벤트 설정
    setupTrainerClickEvents();
    
    // 회원 검색 버튼 클릭 이벤트 설정
    if (isTrainer) {
        setupSearchMemberButton();
    }
    
    // 일반 회원만 카드 클릭 이벤트 설정
    if (!isTrainer) {
        // 오늘의 운동 카드 클릭 이벤트 설정
        setupTodayWorkoutCardClick();
        
        // 다음 수업 카드 클릭 이벤트 설정
        setupNextSessionCardClick();
        
        // 식단 카드 클릭 이벤트 설정
        setupDietSummaryCardClick();
        
        // 트레이너 프로필 사진 클릭 이벤트 설정
        setupTrainerProfileImageClick();
    }
    
    // 활동 로그 이벤트 설정
    if (isTrainer) {
        setupActivityLogEvents();
    } else {
        setupMemberActivityLogEvents();
    }

    setupAnnouncementButtons();

    if (!isTrainer) {
        const achievementBtn = document.getElementById('app-achievement-btn');
        if (achievementBtn) {
            achievementBtn.style.display = 'inline-flex';
            achievementBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const modal = document.getElementById('app-achievement-modal');
                if (modal) modal.style.display = 'flex';
            });
            achievementBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const modal = document.getElementById('app-achievement-modal');
                if (modal) modal.style.display = 'flex';
            }, { passive: false });
        }

        const modal = document.getElementById('app-achievement-modal');
        const modalCloseBtn = document.getElementById('app-achievement-modal-close');
        if (modal && modalCloseBtn) {
            modalCloseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                modal.style.display = 'none';
            });
            modalCloseBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                modal.style.display = 'none';
            }, { passive: false });
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }

        const achievementTriggers = document.querySelectorAll('.app-achievement-trigger');
        achievementTriggers.forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (modal) {
                    modal.style.display = 'flex';
                }
            });
        });
    }
}

function setupAnnouncementButtons() {
    const buttons = document.querySelectorAll('.app-announcement-open-btn');
    buttons.forEach(btn => {
        if (btn._announcementBtnSetup) return;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showAnnouncementsModal();
        });
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showAnnouncementsModal();
        }, { passive: false });
        btn._announcementBtnSetup = true;
    });
}

/**
 * 식단 카드 클릭 이벤트 설정
 */
function setupDietSummaryCardClick() {
    const dietSummaryCard = document.getElementById('diet-summary-card');
    if (dietSummaryCard) {
        dietSummaryCard.addEventListener('click', async () => {
            const { navigateToScreen } = await import('./index.js');
            navigateToScreen('diet');
        });
    }
}

/**
 * 다음 수업 카드 클릭 이벤트 설정
 */
function setupNextSessionCardClick() {
    const nextSessionCard = document.getElementById('next-session-card');
    if (!nextSessionCard || !nextSession || !nextSession.date) {
        return;
    }
    nextSessionCard.addEventListener('click', async () => {
        localStorage.setItem('pendingNavScreen', 'workout');
        localStorage.setItem('pendingNavDate', nextSession.date);
        const { navigateToScreen } = await import('./index.js');
        navigateToScreen('workout');
    });
}

/**
 * 주간 운동 모달 표시
 */
async function showWeeklyWorkoutModal() {
    const modalBg = createModal();
    const modal = modalBg.querySelector('.app-modal');
    
    // 모달에 클래스 추가 (CSS에서 반응형 처리)
    modal.classList.add('weekly-workout-modal');
    
    // 현재 주차 계산 (오늘 기준)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0(일) ~ 6(토)
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() + mondayOffset);
    currentMonday.setHours(0, 0, 0, 0);
    
    let weekOffset = 0; // 현재 주가 0
    
    // 날짜 표시 형식 (YYYY년 M월 D일 ~ M월 D일)
    const formatWeekDate = (monday) => {
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const mondayMonth = monday.getMonth() + 1;
        const mondayDay = monday.getDate();
        const sundayMonth = sunday.getMonth() + 1;
        const sundayDay = sunday.getDate();
        const year = monday.getFullYear();
        return `${year}년 ${mondayMonth}월 ${mondayDay}일 ~ ${sundayMonth}월 ${sundayDay}일`;
    };
    
    modal.innerHTML = `
        <div class="app-modal-header">
            <h2>주간 운동 기록</h2>
            <button class="app-modal-close" aria-label="닫기">×</button>
        </div>
        <div class="app-modal-form workout-history-form">
            <div id="weekly-workout-navigation" class="workout-history-navigation">
                <button type="button" class="workout-history-nav-btn" id="weekly-workout-prev" aria-label="이전 주">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                <div id="weekly-workout-date" class="workout-history-date">
                    로딩 중...
                </div>
                <button type="button" class="workout-history-nav-btn" id="weekly-workout-next" aria-label="다음 주">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </button>
            </div>
            <div id="weekly-workout-content" class="workout-history-content">
                <div class="workout-history-loading">
                    로딩 중...
                </div>
            </div>
        </div>
        <div class="app-modal-actions workout-history-actions">
            <button type="button" class="app-btn-secondary" id="weekly-workout-close">닫기</button>
        </div>
    `;
    
    document.body.appendChild(modalBg);
    
    // 모달 열기 애니메이션
    setTimeout(() => {
        modalBg.classList.add('app-modal-show');
        modal.classList.add('app-modal-show');
    }, 10);
    
    // 주간 운동기록 로드 및 렌더링
    const loadWeekRecords = async (monday) => {
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        
        const startDate = formatDate(monday);
        const endDate = formatDate(sunday);
        
        const appUserId = currentUser?.id;
        if (!appUserId) {
            return null;
        }
        
        try {
            const records = await getWorkoutRecords(appUserId, {
                startDate: startDate,
                endDate: endDate
            });
            
            // 날짜별로 그룹화
            const recordsByDate = {};
            records.forEach(record => {
                const dateStr = record.workout_date;
                if (!recordsByDate[dateStr]) {
                    recordsByDate[dateStr] = [];
                }
                recordsByDate[dateStr].push(record);
            });
            
            return recordsByDate;
        } catch (error) {
            console.error('주간 운동기록 조회 오류:', error);
            return null;
        }
    };
    
    const renderCurrentWeek = async () => {
        const dateEl = modal.querySelector('#weekly-workout-date');
        const contentEl = modal.querySelector('#weekly-workout-content');
        const prevBtn = modal.querySelector('#weekly-workout-prev');
        const nextBtn = modal.querySelector('#weekly-workout-next');
        
        // 현재 주의 월요일 계산
        const weekMonday = new Date(currentMonday);
        weekMonday.setDate(currentMonday.getDate() + (weekOffset * 7));
        
        dateEl.textContent = formatWeekDate(weekMonday);
        
        // 이전 주/다음 주 버튼 상태 (현재 주 기준으로 제한)
        const canGoPrev = weekOffset > -4; // 최대 4주 이전까지
        const canGoNext = weekOffset < 4; // 최대 4주 이후까지
        
        prevBtn.style.opacity = canGoPrev ? '1' : '0.3';
        prevBtn.style.pointerEvents = canGoPrev ? 'auto' : 'none';
        prevBtn.classList.toggle('disabled', !canGoPrev);
        
        nextBtn.style.opacity = canGoNext ? '1' : '0.3';
        nextBtn.style.pointerEvents = canGoNext ? 'auto' : 'none';
        nextBtn.classList.toggle('disabled', !canGoNext);
        
        // 주간 운동기록 로드
        const recordsByDate = await loadWeekRecords(weekMonday);
        
        if (!recordsByDate || Object.keys(recordsByDate).length === 0) {
            contentEl.innerHTML = `
                <div class="workout-history-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3; margin-bottom: 12px;">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    <p>이 주에는 기록이 없습니다</p>
                </div>
            `;
            return;
        }
        
        // 날짜순 정렬 (월요일부터 일요일)
        const sortedDates = Object.keys(recordsByDate).sort((a, b) => new Date(a) - new Date(b));
        
        // 주간 기록 렌더링
        let historyHTML = '';
        sortedDates.forEach(dateStr => {
            const dateRecords = recordsByDate[dateStr];
            const date = new Date(dateStr);
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const days = ['일', '월', '화', '수', '목', '금', '토'];
            const dayOfWeek = days[date.getDay()];
            
            // 날짜별 헤더
            historyHTML += `
                <div class="weekly-workout-date-section">
                    <div class="weekly-workout-date-header">
                        <span class="weekly-workout-date-label">${month}/${day} (${dayOfWeek})</span>
                        <span class="weekly-workout-date-count">${dateRecords.length}개</span>
                    </div>
                    <div class="weekly-workout-date-records">
            `;
            
            dateRecords.forEach(record => {
                const workoutTypeType = record.workout_type_type || '세트';
                const workoutTypeName = escapeHtml(record.workout_type_name || '');
                
                if (workoutTypeType === '시간' && record.duration_minutes) {
                    historyHTML += `
                        <div class="workout-history-item">
                            <div class="workout-history-item-header">
                                <div class="workout-history-item-content">
                                    <div class="workout-history-item-name">${workoutTypeName}</div>
                                    <span class="workout-history-item-value">⏱ ${record.duration_minutes}분</span>
                                </div>
                                ${record.is_completed ? '<span class="workout-history-item-badge">완료</span>' : ''}
                            </div>
                        </div>
                    `;
                } else if (workoutTypeType === '세트' && record.sets && record.sets.length > 0) {
                    const setsHTML = record.sets.map(set => {
                        const weight = set.weight !== null && set.weight !== undefined ? `${Math.round(set.weight)}kg` : '-';
                        const reps = set.reps !== null && set.reps !== undefined ? `${set.reps}회` : '-';
                        const isCompleted = set.is_completed;
                        return `
                            <div class="workout-history-set-item ${isCompleted ? 'completed' : ''}">
                                <span class="workout-history-set-number">${set.set_number} 세트</span>
                                <span class="workout-history-set-value">${weight} × ${reps}</span>
                                ${isCompleted ? '<span class="workout-history-set-check">✓</span>' : ''}
                            </div>
                        `;
                    }).join('');
                    
                    historyHTML += `
                        <div class="workout-history-item">
                            <div class="workout-history-item-header">
                                <div class="workout-history-item-content">
                                    <div class="workout-history-item-name">${workoutTypeName}</div>
                                </div>
                            </div>
                            <div class="workout-history-sets">
                                ${setsHTML}
                            </div>
                        </div>
                    `;
                }
            });
            
            historyHTML += `
                    </div>
                </div>
            `;
        });
        
        contentEl.innerHTML = historyHTML;
    };
    
    // 초기 렌더링
    await renderCurrentWeek();
    
    // 네비게이션 버튼 이벤트
    const prevBtn = modal.querySelector('#weekly-workout-prev');
    const nextBtn = modal.querySelector('#weekly-workout-next');
    
    prevBtn.addEventListener('click', () => {
        if (weekOffset > -4) {
            weekOffset--;
            renderCurrentWeek();
        }
    });
    
    nextBtn.addEventListener('click', () => {
        if (weekOffset < 4) {
            weekOffset++;
            renderCurrentWeek();
        }
    });
    
    // 모달 닫기
    const closeModal = () => {
        modalBg.classList.remove('app-modal-show');
        modal.classList.remove('app-modal-show');
        setTimeout(() => {
            if (modalBg.parentNode) {
                document.body.removeChild(modalBg);
            }
        }, 200);
    };
    
    const closeBtn = modal.querySelector('.app-modal-close');
    const closeBtn2 = modal.querySelector('#weekly-workout-close');
    
    closeBtn.addEventListener('click', closeModal);
    closeBtn2.addEventListener('click', closeModal);
    modalBg.addEventListener('click', (e) => {
        if (e.target === modalBg) closeModal();
    });
}

/**
 * 모달 생성
 */
function createModal() {
    const modalBg = document.createElement('div');
    modalBg.className = 'app-modal-bg';
    modalBg.innerHTML = '<div class="app-modal"></div>';
    return modalBg;
}

function renderAnnouncementsListHtml() {
    if (!announcementsInbox || announcementsInbox.length === 0) {
        return '<div style="padding: 16px; text-align: center; color: var(--app-text-muted);">공지사항이 없습니다.</div>';
    }
    return announcementsInbox.map(item => {
        const timeAgo = getTimeAgo(item.created_at || item.delivered_at);
        const isUnread = !item.read_at;
        return `
            <div class="app-announcement-item ${isUnread ? 'app-announcement-item-unread' : 'app-announcement-item-read'}"
                 data-delivery-id="${item.delivery_id}">
                <div class="app-announcement-item-content">
                    <div class="app-announcement-item-title">${escapeHtml(item.title || '공지사항')}</div>
                    <div class="app-announcement-item-meta">${timeAgo}</div>
                </div>
                ${isUnread ? '<div class="app-announcement-indicator"></div>' : '<div style="width: 10px; flex-shrink: 0;"></div>'}
            </div>
        `;
    }).join('');
}

function showAnnouncementsModal() {
    const modalBg = createModal();
    const modal = modalBg.querySelector('.app-modal');
    modal.classList.add('app-announcement-modal');

    modal.innerHTML = `
        <div class="app-modal-header">
            <h2>공지사항</h2>
            <button class="app-modal-close" aria-label="닫기">×</button>
        </div>
        <div class="app-modal-form">
            <div class="app-announcement-list">
                ${renderAnnouncementsListHtml()}
            </div>
        </div>
        <div class="app-modal-actions">
            <button type="button" class="app-btn-secondary app-announcement-close-btn">닫기</button>
        </div>
    `;

    document.body.appendChild(modalBg);
    setTimeout(() => {
        modalBg.classList.add('app-modal-show');
        modal.classList.add('app-modal-show');
    }, 10);

    const closeModal = () => {
        modalBg.classList.remove('app-modal-show');
        modal.classList.remove('app-modal-show');
        setTimeout(() => {
            if (modalBg.parentNode) {
                document.body.removeChild(modalBg);
            }
        }, 200);
    };

    const closeBtn = modal.querySelector('.app-modal-close');
    const closeBtn2 = modal.querySelector('.app-announcement-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (closeBtn2) closeBtn2.addEventListener('click', closeModal);
    modalBg.addEventListener('click', (e) => {
        if (e.target === modalBg) closeModal();
    });

    modal.querySelectorAll('.app-announcement-item').forEach(item => {
        item.addEventListener('click', async () => {
            const deliveryId = item.getAttribute('data-delivery-id');
            await handleAnnouncementItemClick(deliveryId, item);
        });
        item.addEventListener('touchstart', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const deliveryId = item.getAttribute('data-delivery-id');
            await handleAnnouncementItemClick(deliveryId, item);
        }, { passive: false });
    });
}

async function handleAnnouncementItemClick(deliveryId, itemEl) {
    if (!deliveryId) return;
    const appUserId = currentUser?.id;
    if (!appUserId) return;

    const existing = announcementsInbox.find(item => item.delivery_id === deliveryId);
    const isUnread = existing && !existing.read_at;
    if (isUnread) {
        try {
            await markAnnouncementAsRead(deliveryId, appUserId);
            existing.read_at = new Date().toISOString();
            announcementsUnreadCount = Math.max(0, announcementsUnreadCount - 1);
            updateAnnouncementsUI();
            if (itemEl) {
                itemEl.classList.remove('app-announcement-item-unread');
                itemEl.classList.add('app-announcement-item-read');
                const indicator = itemEl.querySelector('.app-announcement-indicator');
                if (indicator) indicator.remove();
            }
        } catch (error) {
            console.error('공지사항 읽음 처리 오류:', error);
        }
    }

    try {
        const detailRes = await getAnnouncementDetail(deliveryId, appUserId);
        const detail = detailRes?.item || existing;
        if (detail) {
            showAnnouncementDetailModal(detail);
        }
    } catch (error) {
        console.error('공지사항 상세 조회 오류:', error);
        if (existing) {
            showAnnouncementDetailModal(existing);
        }
    }
}

function showAnnouncementDetailModal(detail) {
    const modalBg = createModal();
    const modal = modalBg.querySelector('.app-modal');
    modal.classList.add('app-announcement-modal');
    const formattedDate = formatAnnouncementDate(detail.created_at || detail.delivered_at);
    const images = normalizeAnnouncementImages(detail.image_urls);

    modal.innerHTML = `
        <div class="app-modal-header">
            <h2>${escapeHtml(detail.title || '공지사항')}</h2>
            <button class="app-modal-close" aria-label="닫기">×</button>
        </div>
        <div class="app-modal-form">
            <div class="app-announcement-detail-date">${escapeHtml(formattedDate)}</div>
            ${images.length > 0 ? `
                <div class="app-announcement-detail-images">
                    ${images.map(img => `
                        <img src="${escapeHtml(img.url || '')}" alt="공지 이미지" class="app-announcement-detail-image">
                    `).join('')}
                </div>
            ` : ''}
            <div class="app-announcement-detail-content">${escapeHtml(detail.content || '')}</div>
        </div>
        <div class="app-modal-actions">
            <button type="button" class="app-btn-secondary app-announcement-close-btn">닫기</button>
        </div>
    `;

    document.body.appendChild(modalBg);
    setTimeout(() => {
        modalBg.classList.add('app-modal-show');
        modal.classList.add('app-modal-show');
    }, 10);

    const closeModal = () => {
        modalBg.classList.remove('app-modal-show');
        modal.classList.remove('app-modal-show');
        setTimeout(() => {
            if (modalBg.parentNode) {
                document.body.removeChild(modalBg);
            }
        }, 200);
    };
    const closeBtn = modal.querySelector('.app-modal-close');
    const closeBtn2 = modal.querySelector('.app-announcement-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (closeBtn2) closeBtn2.addEventListener('click', closeModal);
    modalBg.addEventListener('click', (e) => {
        if (e.target === modalBg) closeModal();
    });
}

function formatAnnouncementDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function normalizeAnnouncementImages(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

/**
 * 오늘의 운동 카드 클릭 이벤트 설정
 */
function setupTodayWorkoutCardClick() {
    const todayWorkoutCard = document.getElementById('today-workout-card');
    if (!todayWorkoutCard) return;
    
    todayWorkoutCard.addEventListener('click', () => {
        // 완료 기록이 없을 때는 자동으로 운동 추가 모달 열기
        if (!monthlyWorkoutCompletionSummary || monthlyWorkoutCompletionSummary.completedCount === 0) {
            localStorage.setItem('autoOpenWorkoutAdd', 'true');
        }
        
        // 하단 네비게이션의 운동 탭 버튼을 클릭
        const workoutNavBtn = document.querySelector('[data-screen="workout"]');
        if (workoutNavBtn) {
            workoutNavBtn.click();
        }
    });
}

/**
 * 회원 목록 클릭 이벤트 설정
 */
function setupMemberClickEvents() {
    const memberItems = document.querySelectorAll('.app-member-item[data-app-user-id]');
    
    memberItems.forEach(item => {
        item.addEventListener('click', async () => {
            const appUserId = item.getAttribute('data-app-user-id');
            const appUserName = item.querySelector('.app-member-name')?.textContent || '회원';
            
            // app_user_id를 직접 사용하여 연결 (member_name으로 찾으면 같은 이름의 다른 유저가 선택될 수 있음)
            if (appUserId) {
                await connectAppUser(appUserId, appUserName);
            } else {
                alert('회원 정보를 불러올 수 없습니다.');
            }
        });
    });
}

/**
 * 트레이너 목록 클릭 이벤트 설정
 */
function setupTrainerClickEvents() {
    const trainerItems = document.querySelectorAll('.app-member-item[data-trainer-username], .app-trainer-header-link[data-trainer-username]');
    
    trainerItems.forEach(item => {
        item.addEventListener('click', async (e) => {
            e.stopPropagation();
            const trainerUsername = item.getAttribute('data-trainer-username');
            if (!trainerUsername) {
                return;
            }
            await viewTrainerWorkouts(trainerUsername);
        });
    });
}

/**
 * 회원 연결 버튼 클릭 이벤트 설정
 */
function setupConnectUserButton() {
    const connectUserBtn = document.getElementById('connect-user-btn');
    if (connectUserBtn) {
        connectUserBtn.addEventListener('click', () => {
            showConnectUserModal();
        });
    }
}

/**
 * 회원 검색 버튼 클릭 이벤트 설정
 */
function setupSearchMemberButton() {
    const container = document.getElementById('app-user-content');
    if (!container) return;
    
    // 버튼 설정 함수
    const setupSearchButton = (btn) => {
        if (!btn || btn._searchButtonSetup) return;
        
        // click 이벤트
        btn.addEventListener('click', () => {
            showConnectUserModal();
        });
        
        // PWA 환경 대비: touchstart 이벤트에서 직접 처리
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault(); // 기본 동작 방지
            e.stopPropagation();
            showConnectUserModal();
        }, { passive: false });
        
        btn._searchButtonSetup = true;
    };
    
    // 현재 존재하는 버튼에 이벤트 리스너 등록
    const searchBtn = document.getElementById('search-member-btn');
    if (searchBtn) {
        setupSearchButton(searchBtn);
    }
    
    // 버튼이 나중에 생성될 수 있으므로 MutationObserver 사용
    // 기존 observer가 있으면 정리
    if (container._searchButtonObserver) {
        container._searchButtonObserver.disconnect();
        container._searchButtonObserver = null;
    }
    
    const observer = new MutationObserver((mutations) => {
        const btn = document.getElementById('search-member-btn');
        if (btn && !btn._searchButtonSetup) {
            setupSearchButton(btn);
        }
    });
    observer.observe(container, { childList: true, subtree: true });
    container._searchButtonObserver = observer;
}

/**
 * 회원 연결 모달 표시
 */
async function showConnectUserModal() {
    const modalBg = createModal();
    const modal = modalBg.querySelector('.app-modal');
    
    modal.innerHTML = `
        <div class="app-modal-header">
            <h2>회원 연결</h2>
            <button class="app-modal-close-btn" aria-label="닫기">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
        <div class="app-modal-content" style="padding: 16px;">
            <div class="app-form-group" style="margin-bottom: 16px;">
                <label style="display: block; font-size: 14px; font-weight: 600; color: var(--app-text); margin-bottom: 8px;">
                    회원 검색
                </label>
                <input 
                    type="text" 
                    id="user-search-input" 
                    placeholder="이름으로 검색"
                    style="width: 100%; padding: 10px 12px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); font-size: 16px; box-sizing: border-box;"
                    autocomplete="off"
                >
            </div>
            <div id="user-search-results" style="max-height: 400px; overflow-y: auto; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); background: var(--app-surface);">
                <div style="padding: 40px 20px; text-align: center; color: var(--app-text-muted);">
                    검색어를 입력하세요
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalBg);
    
    // 모달 열기 애니메이션
    setTimeout(() => {
        modalBg.classList.add('app-modal-show');
        modal.classList.add('app-modal-show');
    }, 10);
    
    // 검색 입력 이벤트
    const searchInput = modal.querySelector('#user-search-input');
    const resultsContainer = modal.querySelector('#user-search-results');
    let searchTimeout = null;
    
    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        
        // 디바운싱
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            if (query.length === 0) {
                resultsContainer.innerHTML = `
                    <div style="padding: 40px 20px; text-align: center; color: var(--app-text-muted);">
                        검색어를 입력하세요
                    </div>
                `;
                return;
            }
            
            // 검색 중 표시
            resultsContainer.innerHTML = `
                <div style="padding: 40px 20px; text-align: center; color: var(--app-text-muted);">
                    검색 중...
                </div>
            `;
            
            try {
                // 유저앱 전체 회원 조회 (캐싱 사용)
                const appUsers = await getAppUsers();
                
                // 모든 유저앱 회원 검색 가능 (PT 회원 연결 여부와 관계없이)
                // 필터링 제거 - 모든 회원 검색 가능
                
                // 검색어로 필터링 (이름만 검색)
                const queryLower = query.toLowerCase().trim();
                
                // 검색어가 실제로 있는지 확인 (공백만 있으면 필터링 안함)
                if (queryLower.length === 0) {
                    resultsContainer.innerHTML = `
                        <div style="padding: 40px 20px; text-align: center; color: var(--app-text-muted);">
                            검색어를 입력하세요
                        </div>
                    `;
                    return;
                }
                
                const filteredUsers = appUsers.filter(user => {
                    const name = (user.name || '').toLowerCase();
                    
                    // 이름으로만 검색
                    if (name && name.includes(queryLower)) {
                        return true;
                    }
                    
                    return false;
                });
                
                if (filteredUsers.length === 0) {
                    resultsContainer.innerHTML = `
                        <div style="padding: 40px 20px; text-align: center; color: var(--app-text-muted);">
                            검색 결과가 없습니다
                        </div>
                    `;
                    return;
                }
                
                // 결과 목록 렌더링
                const connectedAppUserId = localStorage.getItem('connectedMemberAppUserId');
                const resultsHTML = filteredUsers.map(user => {
                    const isConnected = connectedAppUserId === user.id;
                    const isMyMember = trainerMembers && trainerMembers.some(m => m.app_user_id === user.id);
                    const isPTMember = user.member_name && user.member_name.trim() !== '';
                    
                    return `
                        <div 
                            class="app-member-item ${isConnected ? 'app-member-item-connected' : ''}" 
                            data-app-user-id="${user.id}"
                            data-app-user-name="${escapeHtml(user.name)}"
                            style="cursor: pointer; padding: 12px 16px; border-bottom: 1px solid var(--app-border);"
                        >
                            <div class="app-member-info">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <p class="app-member-name">${escapeHtml(user.name)}</p>
                                    ${isConnected ? '<span style="color:#4caf50;font-size:0.75rem;font-weight:600;">(연결됨)</span>' : ''}
                                    ${isMyMember ? '<span style="color:#1976d2;font-size:0.75rem;font-weight:600;">(내 회원)</span>' : ''}
                                    ${isPTMember ? '<span style="color:var(--app-text-muted);font-size:0.75rem;">(PT 회원)</span>' : ''}
                                </div>
                                <p class="app-member-details">
                                    ${escapeHtml(user.phone || '-')} | 아이디: ${escapeHtml(user.username)}
                                    ${isPTMember ? ` | PT: ${escapeHtml(user.member_name)}` : ''}
                                </p>
                            </div>
                        </div>
                    `;
                }).join('');
                
                resultsContainer.innerHTML = resultsHTML;
                
                // 결과 항목 클릭 이벤트
                resultsContainer.querySelectorAll('.app-member-item[data-app-user-id]').forEach(item => {
                    item.addEventListener('click', async () => {
                        const appUserId = item.getAttribute('data-app-user-id');
                        const appUserName = item.getAttribute('data-app-user-name');
                        await connectAppUser(appUserId, appUserName);
                        closeModal();
                    });
                });
                
            } catch (error) {
                console.error('회원 검색 오류:', error);
                resultsContainer.innerHTML = `
                    <div style="padding: 40px 20px; text-align: center; color: var(--app-danger);">
                        검색 중 오류가 발생했습니다
                    </div>
                `;
            }
        }, 300);
    });
    
    // 검색 입력 포커스
    setTimeout(() => {
        searchInput.focus();
    }, 100);
    
    // 모달 닫기
    const closeModal = () => {
        modalBg.classList.remove('app-modal-show');
        modal.classList.remove('app-modal-show');
        setTimeout(() => {
            if (modalBg.parentNode) {
                document.body.removeChild(modalBg);
            }
        }, 200);
    };
    
    const closeBtn = modal.querySelector('.app-modal-close-btn');
    closeBtn.addEventListener('click', closeModal);
    modalBg.addEventListener('click', (e) => {
        if (e.target === modalBg) closeModal();
    });
    
    // ESC 키로 닫기
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

/**
 * 유저앱 회원 연결 (app_user_id로 직접 연결)
 * 
 * 주의: 이 함수는 단순히 현재 세션에서 선택한 회원을 localStorage에 저장하는 것입니다.
 * 실제 연결 여부는 member_name → members.trainer 매칭으로 확인됩니다.
 * 
 * @param {string} appUserId - 연결할 앱 유저 ID
 * @param {string} appUserName - 연결할 앱 유저 이름
 * @param {boolean} skipConfirm - 확인 다이얼로그를 스킵할지 여부 (기본값: false)
 */
async function connectAppUser(appUserId, appUserName, skipConfirm = false) {
    // 이미 연결된 회원인지 확인
    const connectedAppUserId = localStorage.getItem('connectedMemberAppUserId');
    if (connectedAppUserId === appUserId) {
        // 이미 연결된 회원이면 해제 여부 확인
        if (!skipConfirm) {
            if (confirm(`"${appUserName}" 회원과의 연결을 해제하시겠습니까?`)) {
                localStorage.removeItem('connectedMemberName');
                localStorage.removeItem('connectedMemberAppUserId');
                await refresh();
            }
        } else {
            // skipConfirm이 true면 해제하지 않고 그냥 리턴
            return;
        }
        return;
    }
    
    // 다른 회원이 연결되어 있으면 확인
    if (!skipConfirm) {
        if (connectedAppUserId) {
            if (!confirm(`현재 연결된 회원과의 연결을 해제하고 "${appUserName}" 회원의 정보를 불러오시겠습니까?`)) {
                return;
            }
        } else {
            // 연결 확인
            if (!confirm(`"${appUserName}" 회원의 정보를 불러오시겠습니까?`)) {
                return;
            }
        }
    }
    
    try {
        // 연결 정보 저장 (localStorage에만 저장, DB는 수정하지 않음)
        localStorage.setItem('connectedMemberAppUserId', appUserId);
        
        // member_name이 있으면 connectedMemberName도 저장 (PT 회원인 경우)
        try {
            const appUserResponse = await fetch(`/api/app-users/${appUserId}`);
            if (appUserResponse.ok) {
                const appUser = await appUserResponse.json();
                if (appUser.member_name) {
                    localStorage.setItem('connectedMemberName', appUser.member_name);
                } else {
                    localStorage.removeItem('connectedMemberName');
                }
            }
        } catch (error) {
            console.error('앱 유저 정보 조회 오류:', error);
        }
        
        // 대시보드 새로고침
        await refresh();
        
        alert(`"${appUserName}" 회원과 연결되었습니다. 이제 운동/식단 탭에서 해당 회원의 정보를 확인하고 편집할 수 있습니다.`);
    } catch (error) {
        console.error('회원 연결 오류:', error);
        alert('회원 연결 중 오류가 발생했습니다.');
    }
}

/**
 * 회원 연결 (PT 회원용 - member_name으로 연결)
 */
async function connectMember(memberName) {
    // 이미 연결된 회원인지 확인
    const connectedMemberName = localStorage.getItem('connectedMemberName');
    if (connectedMemberName === memberName) {
        // 이미 연결된 회원이면 해제 여부 확인
        // 유저앱 회원 이름 조회
        let appUserName = memberName;
        try {
            const appUsers = await getAppUsers();
            const appUser = appUsers.find(user => user.member_name === memberName);
            if (appUser) {
                appUserName = appUser.name;
            }
        } catch (error) {
            console.error('유저앱 회원 정보 조회 오류:', error);
        }
        
        if (confirm(`"${appUserName}" 회원과의 연결을 해제하시겠습니까?`)) {
            localStorage.removeItem('connectedMemberName');
            localStorage.removeItem('connectedMemberAppUserId');
            await refresh();
        }
        return;
    }
    
    try {
        // 해당 회원의 app_user_id 조회 (먼저 조회하여 유저앱 회원 이름 확인, 캐싱 사용)
        const appUsers = await getAppUsers();
        const appUser = appUsers.find(user => user.member_name === memberName);
        
        if (!appUser) {
            alert('해당 회원의 유저앱 계정을 찾을 수 없습니다.');
            return;
        }
        
        // 유저앱 회원 이름 사용
        const appUserName = appUser.name;
        
        // 다른 회원이 연결되어 있으면 확인
        if (connectedMemberName) {
            // 현재 연결된 회원의 유저앱 이름도 조회 (캐싱 사용)
            let currentAppUserName = connectedMemberName;
            try {
                const currentAppUsers = await getAppUsers();
                const currentAppUser = currentAppUsers.find(user => user.member_name === connectedMemberName);
                if (currentAppUser) {
                    currentAppUserName = currentAppUser.name;
                }
            } catch (error) {
                console.error('현재 연결된 회원 정보 조회 오류:', error);
            }
            
            if (!confirm(`"${currentAppUserName}" 회원과의 연결을 해제하고 "${appUserName}" 회원의 정보를 불러오시겠습니까?`)) {
                return;
            }
        } else {
            // 연결 확인
            if (!confirm(`"${appUserName}" 회원의 정보를 불러오시겠습니까?`)) {
                return;
            }
        }
        
        // 연결 정보 저장 (localStorage에만 저장, DB는 수정하지 않음)
        localStorage.setItem('connectedMemberName', memberName);
        localStorage.setItem('connectedMemberAppUserId', appUser.id);
        
        // 대시보드 새로고침
        await refresh();
        
        alert(`"${appUserName}" 회원과 연결되었습니다. 이제 운동/식단 탭에서 해당 회원의 정보를 확인하고 편집할 수 있습니다.`);
    } catch (error) {
        console.error('회원 연결 오류:', error);
        alert('회원 연결 중 오류가 발생했습니다.');
    }
}

/**
 * 트레이너 운동기록 보기
 */
async function viewTrainerWorkouts(trainerUsername) {
    try {
        // 트레이너의 app_user_id 찾기 (캐싱 사용)
        const appUsers = await getAppUsers({ username: trainerUsername });
        const trainerAppUser = appUsers.find(user => user.username === trainerUsername);
        
        if (!trainerAppUser) {
            alert('트레이너의 유저앱 계정을 찾을 수 없습니다.');
            return;
        }
        
        // 트레이너 이름 가져오기
        const trainerName = trainerAppUser.name || trainerUsername;
        
        // 확인 메시지 표시
        if (!confirm(`${trainerName} 트레이너의 운동기록을 보시겠습니까?`)) {
            return;
        }
        
        // 읽기 전용 모드로 설정
        localStorage.setItem('viewingTrainerAppUserId', trainerAppUser.id);
        localStorage.setItem('isReadOnly', 'true');
        localStorage.setItem('viewingTrainerName', trainerName);
        
        // 운동기록 화면으로 이동
        const { navigateToScreen } = await import('./index.js');
        navigateToScreen('workout');
    } catch (error) {
        console.error('트레이너 운동기록 조회 오류:', error);
        alert('트레이너 운동기록을 불러오는 중 오류가 발생했습니다.');
    }
}

/**
 * 대시보드 새로고침
 */
export async function refresh() {
    await Promise.all([
        loadNextSession(),
        loadTrainerMembers(),
        loadMemberTrainers(),
        loadTodayWorkoutSummary(),
        loadMonthlyWorkoutCompletionSummary(),
        loadMonthlyDietSummary(),
        loadConnectedAppUserInfo(),
        loadActivityLogs(),
        loadMemberActivityLogs(),
        loadAnnouncementsInbox()
    ]);
    await loadTrainerMemberMedalStatus();
    render();
    
    // 활동 로그 자동 업데이트 재시작
    startActivityLogsAutoUpdate();
}

/**
 * 대시보드 정리 (화면 전환 시 호출)
 */
export function cleanup() {
    stopActivityLogsAutoUpdate();
    
    // 회원 검색 버튼 observer 정리
    const container = document.getElementById('app-user-content');
    if (container && container._searchButtonObserver) {
        container._searchButtonObserver.disconnect();
        container._searchButtonObserver = null;
    }
}

/**
 * 활동 로그 아이템 터치/클릭 이벤트 설정
 * - 스크롤 제스처는 무시하고, 탭일 때만 클릭 처리
 */
function bindActivityLogItemEvents(item, handleLogClick, setupFlagName) {
    if (!item || item[setupFlagName]) return;
    
    let touchStartX = 0;
    let touchStartY = 0;
    let touchMoved = false;
    const touchMoveThreshold = 8;
    
    item.addEventListener('click', () => {
        if (item._lastTouchClickAt && Date.now() - item._lastTouchClickAt < 500) {
            return;
        }
        handleLogClick(item);
    });
    
    item.addEventListener('touchstart', (e) => {
        const isUnread = item.classList.contains('app-activity-log-item-unread');
        if (!isUnread) return;
        const touch = e.touches[0];
        if (!touch) return;
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchMoved = false;
    }, { passive: true });
    
    item.addEventListener('touchmove', (e) => {
        if (touchMoved) return;
        const touch = e.touches[0];
        if (!touch) return;
        const dx = Math.abs(touch.clientX - touchStartX);
        const dy = Math.abs(touch.clientY - touchStartY);
        if (dx > touchMoveThreshold || dy > touchMoveThreshold) {
            touchMoved = true;
        }
    }, { passive: true });
    
    item.addEventListener('touchend', async (e) => {
        const isUnread = item.classList.contains('app-activity-log-item-unread');
        if (!isUnread || touchMoved) return;
        item._lastTouchClickAt = Date.now();
        e.preventDefault();
        e.stopPropagation();
        await handleLogClick(item);
    }, { passive: false });
    
    item[setupFlagName] = true;
}

/**
 * 회원 활동 로그 이벤트 설정
 */
function setupMemberActivityLogEvents() {
    const container = document.getElementById('app-user-content');
    if (!container) return;
    
    // 기존 observer 정리
    if (container._memberMarkAllReadObserver) {
        container._memberMarkAllReadObserver.disconnect();
        container._memberMarkAllReadObserver = null;
    }
    
    // 중복 이벤트 리스너 방지: 이미 설정되어 있으면 기존 로그 아이템만 다시 확인
    if (container._memberActivityLogEventsSetup) {
        // 버튼이 나중에 생성되었을 수 있으므로 버튼만 다시 확인
        const markAllBtn = document.getElementById('mark-all-member-read-btn');
        if (markAllBtn && !markAllBtn._memberMarkAllReadSetup) {
            const handleMarkAllRead = async (btn) => {
                const appUserId = currentUser?.id;
                if (!appUserId) return;
                if (btn.disabled) return;
                btn.disabled = true;
                
                try {
                    const result = await markAllMemberActivityLogsAsRead(appUserId);
                    const logItems = container.querySelectorAll('.app-activity-log-item-unread');
                    logItems.forEach(item => {
                        item.classList.remove('app-activity-log-item-unread');
                        item.classList.add('app-activity-log-item-read');
                        const indicator = item.querySelector('.app-activity-log-indicator');
                        if (indicator) indicator.remove();
                    });
                    memberActivityLogsUnreadCount = 0;
                    updateLogUnreadBadge(0, false);
                    if (memberActivityLogs) {
                        memberActivityLogs.forEach(log => { log.is_read = true; });
                    }
                    alert(`${result.readCount || 0}개의 로그가 읽음 처리되었습니다.`);
                } catch (error) {
                    console.error('전체 로그 읽음 처리 오류:', error);
                    alert(`전체 로그 읽음 처리 중 오류가 발생했습니다: ${error.message}`);
                    btn.disabled = false;
                }
            };
            
            markAllBtn.addEventListener('click', () => handleMarkAllRead(markAllBtn));
            markAllBtn.addEventListener('touchstart', async (e) => {
                if (markAllBtn.disabled) return;
                e.preventDefault();
                e.stopPropagation();
                await handleMarkAllRead(markAllBtn);
            }, { passive: false });
            markAllBtn._memberMarkAllReadSetup = true;
        }
        
        // 로그 아이템이 나중에 생성되었을 수 있으므로 로그 아이템도 다시 확인
        const existingLogItems = container.querySelectorAll('.app-activity-log-item');
        existingLogItems.forEach(item => {
            if (!item._memberLogClickSetup) {
                const handleLogClick = async (item) => {
                    const logId = item.getAttribute('data-log-id');
                    const isUnread = item.classList.contains('app-activity-log-item-unread');
                    
                    if (!logId) return;
                    
                    const appUserId = currentUser?.id;
                    if (!appUserId) return;
                    
                    try {
                        if (isUnread) {
                            await markMemberActivityLogAsRead(logId, appUserId);
                            item.classList.remove('app-activity-log-item-unread');
                            item.classList.add('app-activity-log-item-read');
                            const indicator = item.querySelector('.app-activity-log-indicator');
                            if (indicator) indicator.remove();
                            memberActivityLogsUnreadCount = Math.max(0, memberActivityLogsUnreadCount - 1);
                            updateLogUnreadBadge(memberActivityLogsUnreadCount, false);
                            const log = memberActivityLogs.find(l => l.id === logId);
                            if (log) log.is_read = true;
                        }
                        await navigateFromActivityLog(item);
                    } catch (error) {
                        console.error('로그 읽음 처리 오류:', error);
                        alert(`로그 읽음 처리 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
                    }
                };
                
                bindActivityLogItemEvents(item, handleLogClick, '_memberLogClickSetup');
            }
        });
        
        return;
    }
    
    // 로그 카드 클릭 이벤트 (읽음 처리)
    const logItems = container.querySelectorAll('.app-activity-log-item');
    
    // 로그 클릭 핸들러 함수
    const handleLogClick = async (item) => {
        const logId = item.getAttribute('data-log-id');
        const isUnread = item.classList.contains('app-activity-log-item-unread');
        
        if (!logId) return;
        
        const appUserId = currentUser?.id;
        if (!appUserId) return;
        
        try {
            if (isUnread) {
                await markMemberActivityLogAsRead(logId, appUserId);
                
                // UI 업데이트
                item.classList.remove('app-activity-log-item-unread');
                item.classList.add('app-activity-log-item-read');
                
                // 읽음 표시 제거
                const indicator = item.querySelector('.app-activity-log-indicator');
                if (indicator) {
                    indicator.remove();
                }
                
                // 읽지 않은 개수 업데이트
                memberActivityLogsUnreadCount = Math.max(0, memberActivityLogsUnreadCount - 1);
                
                // 헤더의 읽지 않은 개수 뱃지 업데이트
                const sectionTitle = container.querySelector('.app-dashboard-section h2.app-section-title');
                if (sectionTitle) {
                    const badge = sectionTitle.querySelector('span');
                    if (memberActivityLogsUnreadCount > 0) {
                        if (badge) {
                            badge.textContent = memberActivityLogsUnreadCount;
                        } else {
                            sectionTitle.innerHTML += ` <span style="background: #ff4444; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; margin-left: 8px;">${memberActivityLogsUnreadCount}</span>`;
                        }
                    } else {
                        if (badge) badge.remove();
                    }
                }
                
                // 로그 데이터 업데이트 (is_read 상태 변경)
                if (memberActivityLogs) {
                    const log = memberActivityLogs.find(l => l.id === logId);
                    if (log) {
                        log.is_read = true;
                    }
                }
            }
            await navigateFromActivityLog(item);
        } catch (error) {
            console.error('로그 읽음 처리 오류:', error);
            alert(`로그 읽음 처리 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
        }
    };
    
    // 로그 아이템에 이벤트 리스너 등록 함수
    const setupLogItemEvents = (item) => {
        bindActivityLogItemEvents(item, handleLogClick, '_memberLogClickSetup');
    };
    
    // 현재 존재하는 로그 아이템에 이벤트 리스너 등록
    logItems.forEach(item => {
        setupLogItemEvents(item);
    });
    
    // 로그 아이템이 나중에 생성될 수 있으므로 MutationObserver 사용
    const logObserver = new MutationObserver((mutations) => {
        const newLogItems = container.querySelectorAll('.app-activity-log-item');
        newLogItems.forEach(item => {
            if (!item._memberLogClickSetup) {
                setupLogItemEvents(item);
            }
        });
    });
    logObserver.observe(container, { childList: true, subtree: true });
    container._memberLogItemsObserver = logObserver;
    
    // 전체 읽음 처리 버튼 클릭 이벤트 핸들러
    const handleMarkAllRead = async (btn) => {
        const appUserId = currentUser?.id;
        if (!appUserId) return;
        
        // 중복 클릭 방지
        if (btn.disabled) return;
        btn.disabled = true;
        
        try {
            const result = await markAllMemberActivityLogsAsRead(appUserId);
            
            // UI 업데이트
            const logItems = container.querySelectorAll('.app-activity-log-item-unread');
            logItems.forEach(item => {
                item.classList.remove('app-activity-log-item-unread');
                item.classList.add('app-activity-log-item-read');
                const indicator = item.querySelector('.app-activity-log-indicator');
                if (indicator) indicator.remove();
            });
            
            // 읽지 않은 개수 0으로 업데이트
            memberActivityLogsUnreadCount = 0;
            
            // 헤더의 읽지 않은 개수 뱃지 제거
            const sectionTitle = container.querySelector('.app-dashboard-section h2.app-section-title');
            if (sectionTitle) {
                const badge = sectionTitle.querySelector('span');
                if (badge) badge.remove();
            }
            
            if (btn) {
                btn.disabled = false;
            }
            
            // 로그 데이터 업데이트
            if (memberActivityLogs) {
                memberActivityLogs.forEach(log => {
                    log.is_read = true;
                });
            }
            
            alert(`${result.readCount || 0}개의 로그가 읽음 처리되었습니다.`);
        } catch (error) {
            console.error('전체 로그 읽음 처리 오류:', error);
            console.error('전체 로그 읽음 처리 오류 상세:', {
                message: error.message,
                stack: error.stack,
                appUserId
            });
            alert(`전체 로그 읽음 처리 중 오류가 발생했습니다: ${error.message}`);
            btn.disabled = false; // 에러 시 버튼 다시 활성화
        }
    };
    
    // 버튼에 이벤트 리스너 등록 함수
    const setupMarkAllReadButton = (btn) => {
        if (!btn || btn._memberMarkAllReadSetup) return;
        
        // click 이벤트
        btn.addEventListener('click', () => handleMarkAllRead(btn));
        
        // PWA 환경 대비: touchstart 이벤트에서 직접 처리
        btn.addEventListener('touchstart', async (e) => {
            if (btn.disabled) return;
            e.preventDefault(); // 기본 동작 방지
            e.stopPropagation();
            await handleMarkAllRead(btn);
        }, { passive: false });
        
        btn._memberMarkAllReadSetup = true;
    };
    
    // 현재 존재하는 버튼에 이벤트 리스너 등록
    const markAllBtn = document.getElementById('mark-all-member-read-btn');
    if (markAllBtn) {
        setupMarkAllReadButton(markAllBtn);
    }
    
    // 버튼이 나중에 생성될 수 있으므로 MutationObserver 사용
    const observer = new MutationObserver((mutations) => {
        const btn = document.getElementById('mark-all-member-read-btn');
        if (btn && !btn._memberMarkAllReadSetup) {
            setupMarkAllReadButton(btn);
        }
    });
    observer.observe(container, { childList: true, subtree: true });
    container._memberMarkAllReadObserver = observer;
    
    // 설정 완료 플래그 설정
    container._memberActivityLogEventsSetup = true;
}

/**
 * 트레이너 활동 로그 이벤트 설정
 */
function setupActivityLogEvents() {
    const container = document.getElementById('app-user-content');
    if (!container) return;
    
    // 기존 MutationObserver 정리
    if (container._markAllReadObserver) {
        container._markAllReadObserver.disconnect();
        container._markAllReadObserver = null;
    }
    if (container._logItemsObserver) {
        container._logItemsObserver.disconnect();
        container._logItemsObserver = null;
    }
    
    // 중복 이벤트 리스너 방지: 이미 설정되어 있으면 기존 로그 아이템만 다시 확인
    if (container._activityLogEventsSetup) {
        // 버튼이 나중에 생성되었을 수 있으므로 버튼만 다시 확인
        const markAllBtn = document.getElementById('mark-all-read-btn');
        if (markAllBtn && !markAllBtn._markAllReadSetup) {
            // handleMarkAllRead와 setupMarkAllReadButton 함수는 아래에 정의되어 있으므로
            // 여기서는 직접 등록
            const handleMarkAllRead = async (btn) => {
                const trainerUsername = currentUser?.username;
                if (!trainerUsername) return;
                if (btn.disabled) return;
                btn.disabled = true;
                
                try {
                    const result = await markAllActivityLogsAsRead(trainerUsername);
                    const logItems = container.querySelectorAll('.app-activity-log-item-unread');
                    logItems.forEach(item => {
                        item.classList.remove('app-activity-log-item-unread');
                        item.classList.add('app-activity-log-item-read');
                        const indicator = item.querySelector('.app-activity-log-indicator');
                        if (indicator) indicator.remove();
                    });
                    activityLogsUnreadCount = 0;
                    updateLogUnreadBadge(0, true);
                    if (activityLogs) {
                        activityLogs.forEach(log => { log.is_read = true; });
                    }
                    alert(`${result.readCount || 0}개의 로그가 읽음 처리되었습니다.`);
                } catch (error) {
                    console.error('전체 로그 읽음 처리 오류:', error);
                    console.error('전체 로그 읽음 처리 오류 상세:', {
                        message: error.message,
                        stack: error.stack,
                        trainerUsername
                    });
                    alert(`전체 로그 읽음 처리 중 오류가 발생했습니다: ${error.message}`);
                    btn.disabled = false;
                }
            };
            
            markAllBtn.addEventListener('click', () => handleMarkAllRead(markAllBtn));
            markAllBtn.addEventListener('touchstart', async (e) => {
                if (markAllBtn.disabled) return;
                e.preventDefault();
                e.stopPropagation();
                await handleMarkAllRead(markAllBtn);
            }, { passive: false });
            markAllBtn._markAllReadSetup = true;
        }
        
        // 로그 아이템이 나중에 생성되었을 수 있으므로 로그 아이템도 다시 확인
        const existingLogItems = container.querySelectorAll('.app-activity-log-item');
        existingLogItems.forEach(item => {
            if (!item._logClickSetup) {
                // handleLogClick 함수는 아래에 정의되어 있으므로 여기서는 직접 등록
                const handleLogClick = async (item) => {
                    const logId = item.getAttribute('data-log-id');
                    const appUserId = item.getAttribute('data-app-user-id');
                    const memberName = item.getAttribute('data-member-name');
                    const activityType = item.getAttribute('data-activity-type') || '';
                    const isUnread = item.classList.contains('app-activity-log-item-unread');
                    
                    if (!logId) return;
                    
                    const trainerUsername = currentUser?.username;
                    if (!trainerUsername) return;
                    
                    try {
                        if (isUnread) {
                            await markActivityLogAsRead(logId, trainerUsername);
                            
                            item.classList.remove('app-activity-log-item-unread');
                            item.classList.add('app-activity-log-item-read');
                            
                            const indicator = item.querySelector('.app-activity-log-indicator');
                            if (indicator) indicator.remove();
                            
                            activityLogsUnreadCount = Math.max(0, activityLogsUnreadCount - 1);
                            
                            const sectionTitle = container.querySelector('.app-dashboard-section h2.app-section-title');
                            if (sectionTitle) {
                                const badge = sectionTitle.querySelector('span');
                                if (activityLogsUnreadCount > 0) {
                                    if (badge) {
                                        badge.textContent = activityLogsUnreadCount;
                                    } else {
                                        sectionTitle.innerHTML += ` <span style="background: #ff4444; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; margin-left: 8px;">${activityLogsUnreadCount}</span>`;
                                    }
                                } else {
                                    if (badge) badge.remove();
                                }
                            }
                            
                            const log = activityLogs.find(l => l.id === logId);
                            if (log) {
                                log.is_read = true;
                            }
                        }
                        
                        if (activityType === 'announcement') {
                            showAnnouncementsModal();
                            return;
                        }
                        
                        // 회원 연결 로직
                        const hasValidAppUserId = appUserId && appUserId !== 'null' && appUserId !== '' && appUserId !== 'undefined';
                        const hasValidMemberName = memberName && memberName !== '' && memberName !== 'undefined';
                        
                        if (hasValidAppUserId && hasValidMemberName) {
                            const connectedAppUserId = localStorage.getItem('connectedMemberAppUserId');
                            
                            if (connectedAppUserId === appUserId) {
                                await navigateFromActivityLog(item);
                                return;
                            }
                            
                            if (connectedAppUserId) {
                                if (confirm(`현재 연결된 회원과의 연결을 해제하고 "${memberName}" 회원의 정보를 불러오시겠습니까?`)) {
                                    await connectAppUser(appUserId, memberName, true); // skipConfirm: true (이미 확인 받았으므로)
                                    await navigateFromActivityLog(item);
                                }
                            } else {
                                if (confirm(`"${memberName}" 회원의 정보를 불러오시겠습니까?`)) {
                                    await connectAppUser(appUserId, memberName, true); // skipConfirm: true (이미 확인 받았으므로)
                                    await navigateFromActivityLog(item);
                                }
                            }
                        }
                    } catch (error) {
                        console.error('로그 읽음 처리 오류:', error);
                        alert(`로그 읽음 처리 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
                    }
                };
                
                bindActivityLogItemEvents(item, handleLogClick, '_logClickSetup');
            }
        });
        
        return;
    }
    
    // 로그 카드 클릭 이벤트 (읽음 처리 + 회원 연결)
    const logItems = container.querySelectorAll('.app-activity-log-item');
    console.log('[로그 이벤트] 로그 아이템 개수:', logItems.length);
    
    // 로그 클릭 핸들러 함수
            const handleLogClick = async (item) => {
                const logId = item.getAttribute('data-log-id');
                const appUserId = item.getAttribute('data-app-user-id');
                const memberName = item.getAttribute('data-member-name');
                const activityType = item.getAttribute('data-activity-type') || '';
                const isUnread = item.classList.contains('app-activity-log-item-unread');
        
        console.log('[로그 클릭]', { logId, appUserId, memberName, isUnread });
        
        if (!logId) {
            console.log('[로그 클릭] logId 없음');
            return;
        }
        
        const trainerUsername = currentUser?.username;
        if (!trainerUsername) {
            console.log('[로그 클릭] trainerUsername 없음');
            return;
        }
        
        console.log('[로그 클릭] 읽음 처리 시작');
        
        try {
                // 1. 읽음 처리 (기존 로직)
                if (isUnread) {
                    await markActivityLogAsRead(logId, trainerUsername);
                    
                    // UI 업데이트
                    item.classList.remove('app-activity-log-item-unread');
                    item.classList.add('app-activity-log-item-read');
                    
                    // 읽음 표시 제거
                    const indicator = item.querySelector('.app-activity-log-indicator');
                    if (indicator) {
                        indicator.remove();
                    }
                    
                    // 읽지 않은 개수 업데이트
                    activityLogsUnreadCount = Math.max(0, activityLogsUnreadCount - 1);
                    
                    // 헤더의 읽지 않은 개수 업데이트
                    updateLogUnreadBadge(activityLogsUnreadCount, true);
                    
                    // 로그 데이터 업데이트
                    const log = activityLogs.find(l => l.id === logId);
                    if (log) {
                        log.is_read = true;
                    }
                }
                
                        if (activityType === 'announcement') {
                            showAnnouncementsModal();
                            return;
                        }
                        
                        // 2. app_user_id 확인 및 회원 연결 로직
                // app_user_id가 유효하고 memberName이 있는 경우에만 연결 옵션 제공
                // 기존 로그는 app_user_id가 null일 수 있으므로 안전하게 처리
                const hasValidAppUserId = appUserId && appUserId !== 'null' && appUserId !== '' && appUserId !== 'undefined';
                const hasValidMemberName = memberName && memberName !== '' && memberName !== 'undefined';
                
                if (hasValidAppUserId && hasValidMemberName) {
                    const connectedAppUserId = localStorage.getItem('connectedMemberAppUserId');
                    
                    // 상황 1-2-1: 이미 연결된 회원의 로그
                    if (connectedAppUserId === appUserId) {
                        await navigateFromActivityLog(item);
                        return;
                    }
                    
                    // 상황 1-1, 1-2-2: 연결되지 않은 회원의 로그
                    if (connectedAppUserId) {
                        // 상황 1-2-2: 다른 회원이 연결되어 있음
                        if (confirm(`현재 연결된 회원과의 연결을 해제하고 "${memberName}" 회원의 정보를 불러오시겠습니까?`)) {
                            await connectAppUser(appUserId, memberName, true); // skipConfirm: true (이미 확인 받았으므로)
                            await navigateFromActivityLog(item);
                        }
                    } else {
                        // 상황 1-1: 연결된 회원이 없음
                        if (confirm(`"${memberName}" 회원의 정보를 불러오시겠습니까?`)) {
                            await connectAppUser(appUserId, memberName, true); // skipConfirm: true (이미 확인 받았으므로)
                            await navigateFromActivityLog(item);
                        }
                    }
                }
                // 상황 2: app_user_id가 없거나 memberName이 없으면 연결 옵션 제공 안 함
            } catch (error) {
                console.error('로그 읽음 처리 오류:', error);
                console.error('오류 상세:', {
                    message: error.message,
                    stack: error.stack,
                    logId,
                    appUserId,
                    memberName,
                    trainerUsername
                });
                alert(`로그 읽음 처리 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
            }
    };
    
    // 로그 아이템에 이벤트 리스너 등록 함수
    const setupLogItemEvents = (item) => {
        bindActivityLogItemEvents(item, handleLogClick, '_logClickSetup');
    };
    
    // 현재 존재하는 로그 아이템에 이벤트 리스너 등록
    logItems.forEach(item => {
        setupLogItemEvents(item);
    });
    
    // 로그 아이템이 나중에 생성될 수 있으므로 MutationObserver 사용
    const logObserver = new MutationObserver((mutations) => {
        const newLogItems = container.querySelectorAll('.app-activity-log-item');
        newLogItems.forEach(item => {
            if (!item._logClickSetup) {
                setupLogItemEvents(item);
            }
        });
    });
    logObserver.observe(container, { childList: true, subtree: true });
    container._logItemsObserver = logObserver;
    
    // 전체 읽음 처리 버튼 클릭 이벤트 핸들러
    const handleMarkAllRead = async (btn) => {
        const trainerUsername = currentUser?.username;
        if (!trainerUsername) return;
        
        // 중복 클릭 방지
        if (btn.disabled) return;
        btn.disabled = true;
        
        try {
            const result = await markAllActivityLogsAsRead(trainerUsername);
            
            // UI 업데이트
            const logItems = container.querySelectorAll('.app-activity-log-item-unread');
            logItems.forEach(item => {
                item.classList.remove('app-activity-log-item-unread');
                item.classList.add('app-activity-log-item-read');
                const indicator = item.querySelector('.app-activity-log-indicator');
                if (indicator) indicator.remove();
            });
            
            // 읽지 않은 개수 0으로 업데이트
            activityLogsUnreadCount = 0;
            
            // 헤더의 읽지 않은 개수 뱃지만 제거 (제목과 버튼은 유지)
            const sectionTitle = container.querySelector('.app-dashboard-section h2.app-section-title');
            if (sectionTitle) {
                const badge = sectionTitle.querySelector('span');
                if (badge) badge.remove();
            }
            
            if (btn) {
                btn.disabled = false;
            }
            
            // 로그 데이터 업데이트
            if (activityLogs) {
                activityLogs.forEach(log => {
                    log.is_read = true;
                });
            }
            
            alert(`${result.readCount || 0}개의 로그가 읽음 처리되었습니다.`);
        } catch (error) {
            console.error('전체 로그 읽음 처리 오류:', error);
            console.error('전체 로그 읽음 처리 오류 상세:', {
                message: error.message,
                stack: error.stack,
                trainerUsername
            });
            alert(`전체 로그 읽음 처리 중 오류가 발생했습니다: ${error.message}`);
            btn.disabled = false; // 에러 시 버튼 다시 활성화
        }
    };
    
    // 버튼에 이벤트 리스너 등록 함수
    const setupMarkAllReadButton = (btn) => {
        if (!btn || btn._markAllReadSetup) return;
        
        // click 이벤트
        btn.addEventListener('click', () => handleMarkAllRead(btn));
        
        // PWA 환경 대비: touchstart 이벤트에서 직접 처리
        btn.addEventListener('touchstart', async (e) => {
            if (btn.disabled) return;
            e.preventDefault(); // 기본 동작 방지
            e.stopPropagation();
            await handleMarkAllRead(btn);
        }, { passive: false });
        
        btn._markAllReadSetup = true;
    };
    
    // 현재 존재하는 버튼에 이벤트 리스너 등록
    const markAllBtn = document.getElementById('mark-all-read-btn');
    if (markAllBtn) {
        setupMarkAllReadButton(markAllBtn);
    }
    
    // 버튼이 나중에 생성될 수 있으므로 MutationObserver 사용
    const observer = new MutationObserver((mutations) => {
        const btn = document.getElementById('mark-all-read-btn');
        if (btn && !btn._markAllReadSetup) {
            setupMarkAllReadButton(btn);
        }
    });
    observer.observe(container, { childList: true, subtree: true });
    container._markAllReadObserver = observer;
    
    // 설정 완료 플래그 설정
    container._activityLogEventsSetup = true;
}

/**
 * 트레이너 프로필 사진 클릭 이벤트 설정
 */
function setupTrainerProfileImageClick() {
    const container = document.getElementById('app-user-content');
    if (!container) return;
    
    // 프로필 사진 클릭 핸들러
    const handleProfileImageClick = (img) => {
        const imageUrl = img.getAttribute('data-profile-image-url');
        const trainerName = img.getAttribute('data-trainer-name') || '트레이너';
        
        if (!imageUrl) return;
        
        // 모달 생성
        showProfileImageModal(imageUrl, trainerName);
    };
    
    // 현재 존재하는 프로필 사진에 이벤트 리스너 등록
    const profileImages = container.querySelectorAll('.trainer-profile-image');
    profileImages.forEach(img => {
        if (!img._profileImageClickSetup) {
            img.addEventListener('click', () => handleProfileImageClick(img));
            img.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleProfileImageClick(img);
            }, { passive: false });
            img._profileImageClickSetup = true;
        }
    });
    
    // 프로필 사진이 나중에 생성될 수 있으므로 MutationObserver 사용
    if (container._profileImageObserver) {
        container._profileImageObserver.disconnect();
    }
    
    const observer = new MutationObserver((mutations) => {
        const newProfileImages = container.querySelectorAll('.trainer-profile-image');
        newProfileImages.forEach(img => {
            if (!img._profileImageClickSetup) {
                img.addEventListener('click', () => handleProfileImageClick(img));
                img.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleProfileImageClick(img);
                }, { passive: false });
                img._profileImageClickSetup = true;
            }
        });
    });
    
    observer.observe(container, { childList: true, subtree: true });
    container._profileImageObserver = observer;
}

/**
 * 프로필 사진 모달 표시
 */
function showProfileImageModal(imageUrl, trainerName) {
    const modalBg = createModal();
    const modal = modalBg.querySelector('.app-modal');
    
    modal.innerHTML = `
        <div class="app-modal-header">
            <h2>${escapeHtml(trainerName)} 트레이너</h2>
            <button class="app-modal-close" aria-label="닫기">×</button>
        </div>
        <div class="app-modal-content" style="padding: 24px; text-align: center; background: var(--app-bg);">
            <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(trainerName)} 트레이너 프로필" 
                 style="max-width: 100%; max-height: 70vh; width: auto; height: auto; border-radius: 50%; border: 4px solid var(--app-border); box-shadow: 0 4px 12px rgba(0,0,0,0.1);"
                 onerror="this.parentElement.innerHTML='<p style=\'color: var(--app-text-muted); padding: 40px;\'>이미지를 불러올 수 없습니다.</p>';">
        </div>
        <div class="app-modal-actions" style="display: flex; justify-content: flex-end;">
            <button type="button" class="app-btn-secondary" id="profile-image-modal-close">닫기</button>
        </div>
    `;
    
    document.body.appendChild(modalBg);
    
    // 모달 열기 애니메이션
    setTimeout(() => {
        modalBg.classList.add('app-modal-show');
        modal.classList.add('app-modal-show');
    }, 10);
    
    // 모달 닫기
    const closeModal = () => {
        modalBg.classList.remove('app-modal-show');
        modal.classList.remove('app-modal-show');
        setTimeout(() => {
            if (modalBg.parentNode) {
                document.body.removeChild(modalBg);
            }
        }, 200);
    };
    
    const closeBtn = modal.querySelector('.app-modal-close');
    const closeBtn2 = modal.querySelector('#profile-image-modal-close');
    
    closeBtn.addEventListener('click', closeModal);
    closeBtn2.addEventListener('click', closeModal);
    modalBg.addEventListener('click', (e) => {
        if (e.target === modalBg) closeModal();
    });
    
    // ESC 키로 닫기
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}
