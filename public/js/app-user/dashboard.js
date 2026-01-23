// 앱 유저 홈/대시보드 화면

import { formatDate, getToday, escapeHtml, getTimeAgo } from './utils.js';
import { getWorkoutRecords, getAppUsers, getTrainerActivityLogs, markActivityLogAsRead, markAllActivityLogsAsRead, getMemberActivityLogs, markMemberActivityLogAsRead, markAllMemberActivityLogsAsRead } from './api.js';

let currentUser = null;
let nextSession = null;
let trainerMembers = null; // 트레이너의 연결된 회원 목록
let memberTrainers = null; // 회원의 연결된 트레이너 목록
let todayWorkoutSummary = null; // 오늘의 운동 요약
let weeklyWorkoutSummary = null; // 주간 운동 요약
let connectedAppUserInfo = null; // 현재 연결된 유저앱 회원 정보
let activityLogs = null; // 트레이너 활동 로그
let activityLogsUnreadCount = 0; // 읽지 않은 로그 개수
let memberActivityLogs = null; // 회원 활동 로그
let memberActivityLogsUnreadCount = 0; // 회원 활동 로그 읽지 않은 개수

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
        loadWeeklyWorkoutSummary(),
        loadConnectedAppUserInfo(),
        loadActivityLogs(),
        loadMemberActivityLogs()
    ]);
    render();
    
    // 활동 로그 자동 업데이트 시작
    startActivityLogsAutoUpdate();
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
            if (isTrainer) {
                loadActivityLogs().then(() => {
                    // 읽지 않은 개수가 변경되었으면 UI 업데이트
                    updateActivityLogsUI();
                });
            } else {
                loadMemberActivityLogs().then(() => {
                    // 읽지 않은 개수가 변경되었으면 UI 업데이트
                    updateActivityLogsUI();
                });
            }
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
            // 읽지 않은 개수 뱃지 업데이트
            let badge = sectionTitle.querySelector('span');
            if (activityLogsUnreadCount > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.style.cssText = 'background: #ff4444; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; margin-left: 8px;';
                    sectionTitle.appendChild(badge);
                }
                badge.textContent = activityLogsUnreadCount;
            } else if (badge) {
                badge.remove();
            }
            
            // 로그 목록 업데이트 (전체 교체하지 않고 필요한 부분만)
            if (activityLogs && activityLogs.length > 0) {
                const newLogsHTML = activityLogs.map(log => {
                    const timeAgo = getTimeAgo(log.created_at);
                    const isUnread = !log.is_read;
                    
                    return `
                    <div class="app-activity-log-item ${isUnread ? 'app-activity-log-item-unread' : 'app-activity-log-item-read'}" 
                         data-log-id="${log.id}"
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
            // 읽지 않은 개수 뱃지 업데이트
            let badge = sectionTitle.querySelector('span');
            if (memberActivityLogsUnreadCount > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.style.cssText = 'background: #ff4444; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; margin-left: 8px;';
                    sectionTitle.appendChild(badge);
                }
                badge.textContent = memberActivityLogsUnreadCount;
            } else if (badge) {
                badge.remove();
            }
            
            // 로그 목록 업데이트
            if (memberActivityLogs && memberActivityLogs.length > 0) {
                const newLogsHTML = memberActivityLogs.map(log => {
                    const timeAgo = getTimeAgo(log.created_at);
                    const isUnread = !log.is_read;
                    
                    return `
                    <div class="app-activity-log-item ${isUnread ? 'app-activity-log-item-unread' : 'app-activity-log-item-read'}" 
                         data-log-id="${log.id}"
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
            
            // 트레이너 이름 조회
            let trainerName = null;
            if (selectedSession.trainer) {
                try {
                    const trainerResponse = await fetch(`/api/trainers?username=${encodeURIComponent(selectedSession.trainer)}`);
                    if (trainerResponse.ok) {
                        const trainers = await trainerResponse.json();
                        if (trainers && trainers.length > 0) {
                            trainerName = trainers[0].name || selectedSession.trainer;
                        }
                    }
                } catch (err) {
                    console.error('트레이너 이름 조회 오류:', err);
                }
            }
            
            nextSession = {
                ...selectedSession,
                trainerName: trainerName || selectedSession.trainer
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
 * 주간 운동 요약 조회
 */
async function loadWeeklyWorkoutSummary() {
    try {
        const today = getToday(); // YYYY-MM-DD 형식
        const todayDate = new Date(today);
        
        // 이번 주 월요일 계산 (월요일이 0번 인덱스이므로, getDay()가 0(일)이면 -6, 아니면 1-getDay())
        const dayOfWeek = todayDate.getDay(); // 0(일) ~ 6(토)
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const mondayDate = new Date(todayDate);
        mondayDate.setDate(todayDate.getDate() + mondayOffset);
        mondayDate.setHours(0, 0, 0, 0);
        
        // 이번 주 일요일 계산
        const sundayDate = new Date(mondayDate);
        sundayDate.setDate(mondayDate.getDate() + 6);
        sundayDate.setHours(23, 59, 59, 999);
        
        const startDate = formatDate(mondayDate); // YYYY-MM-DD
        const endDate = formatDate(sundayDate); // YYYY-MM-DD
        
        const appUserId = currentUser?.id;
        
        if (!appUserId) {
            weeklyWorkoutSummary = null;
            return;
        }
        
        // 주간 운동기록 조회
        const records = await getWorkoutRecords(appUserId, {
            startDate: startDate,
            endDate: endDate
        });
        
        if (!records || records.length === 0) {
            weeklyWorkoutSummary = null;
            return;
        }
        
        // 요약 정보 계산
        const workoutTypes = new Set();
        let totalSets = 0;
        let totalMinutes = 0;
        const aerobicWorkouts = new Set(); // 유산소 운동 이름 목록
        
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
                // 유산소 운동 이름 수집
                if (workoutTypeName) {
                    aerobicWorkouts.add(workoutTypeName);
                }
            }
        });
        
        weeklyWorkoutSummary = {
            workoutCount: workoutTypes.size,
            totalSets: totalSets,
            totalMinutes: totalMinutes,
            aerobicWorkoutNames: Array.from(aerobicWorkouts) // 유산소 운동 이름 배열
        };
    } catch (error) {
        console.error('주간 운동 요약 조회 오류:', error);
        weeklyWorkoutSummary = null;
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
                name: trainers[0].name || trainers[0].username
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
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
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
    if (!isTrainer && nextSession) {
        const sessionDate = formatShortDate(nextSession.date);
        const dayOfWeek = formatDayOfWeek(nextSession.date);
        const sessionTime = nextSession.time || '';
        trainerName = nextSession.trainerName || null;
        nextSessionText = `${sessionDate}(${dayOfWeek}) ${sessionTime}`;
    }
    
    // 오늘의 운동 요약 텍스트
    let todayWorkoutText = '운동을 추가해 주세요!';
    if (todayWorkoutSummary) {
        const parts = [];
        if (todayWorkoutSummary.workoutCount > 0) {
            parts.push(`${todayWorkoutSummary.workoutCount}개 운동`);
        }
        if (todayWorkoutSummary.totalSets > 0) {
            parts.push(`${todayWorkoutSummary.totalSets}세트`);
        }
        if (todayWorkoutSummary.totalMinutes > 0) {
            parts.push(`${todayWorkoutSummary.totalMinutes}분`);
        }
        todayWorkoutText = parts.length > 0 ? parts.join(' · ') : '운동을 추가해 주세요!';
    }
    
    // 주간 운동 요약 텍스트
    let weeklyWorkoutText = '기록 없음';
    if (weeklyWorkoutSummary) {
        const firstLineParts = [];
        if (weeklyWorkoutSummary.workoutCount > 0) {
            firstLineParts.push(`${weeklyWorkoutSummary.workoutCount}개 운동`);
        }
        if (weeklyWorkoutSummary.totalSets > 0) {
            firstLineParts.push(`${weeklyWorkoutSummary.totalSets}세트`);
        }
        
        // 첫 번째 줄: 운동 개수와 세트 수
        const firstLine = firstLineParts.length > 0 ? firstLineParts.join(' ') : '';
        
        // 두 번째 줄: 유산소 운동 시간 (시간이 있을 경우만)
        let secondLine = '';
        if (weeklyWorkoutSummary.totalMinutes > 0) {
            secondLine = `유산소 ${weeklyWorkoutSummary.totalMinutes}분`;
        }
        
        // 두 줄로 구성 (두 번째 줄이 있을 경우만 줄바꿈)
        if (firstLine && secondLine) {
            weeklyWorkoutText = `${firstLine}<br>${secondLine}`;
        } else if (firstLine) {
            weeklyWorkoutText = firstLine;
        } else if (secondLine) {
            weeklyWorkoutText = secondLine;
        } else {
            weeklyWorkoutText = '기록 없음';
        }
    }
    
    container.innerHTML = `
        <div class="app-dashboard">
            <div class="app-dashboard-header">
                <h1 class="app-dashboard-title">안녕하세요, ${escapeHtml(currentUser?.name || '회원')}님 👋</h1>
                <p class="app-dashboard-subtitle">${formatDate(new Date())}</p>
            </div>
            
            ${isTrainer ? `
            <!-- 활동 로그 섹션 (트레이너: 맨 위로 이동) -->
            <div class="app-dashboard-section">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                    <h2 class="app-section-title" style="margin: 0;">
                        📋 회원 활동 로그
                        ${activityLogsUnreadCount > 0 ? `<span style="background: #ff4444; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; margin-left: 8px;">${activityLogsUnreadCount}</span>` : ''}
                    </h2>
                    ${activityLogs && activityLogsUnreadCount > 0 ? `
                        <button id="mark-all-read-btn" class="app-btn-secondary" style="padding: 6px 12px; font-size: 0.875rem; white-space: nowrap;">
                            전체 읽음 처리
                        </button>
                    ` : ''}
                </div>
                <div class="app-activity-logs-list">
                    ${activityLogs && activityLogs.length > 0 ? activityLogs.map(log => {
                        // 상대 시간 계산
                        const timeAgo = getTimeAgo(log.created_at);
                        const isUnread = !log.is_read;
                        
                        return `
                        <div class="app-activity-log-item ${isUnread ? 'app-activity-log-item-unread' : 'app-activity-log-item-read'}" 
                             data-log-id="${log.id}"
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
                <div class="app-card app-card-info">
                    <div class="app-card-icon">🏋️</div>
                    <div class="app-card-content">
                        <h3>다음 수업</h3>
                        <p class="app-card-value" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span>${escapeHtml(hasMemberName ? nextSessionText : '연결된 회원 정보가 없습니다')}</span>
                            ${trainerName ? `<span style="font-size: 14px; color: var(--app-text-muted);">${escapeHtml(trainerName)} 트레이너</span>` : ''}
                        </p>
                    </div>
                </div>
                
                <div class="app-card app-card-primary" id="today-workout-card" ${!todayWorkoutSummary ? 'style="cursor: pointer;"' : ''}>
                    <div class="app-card-icon">💪</div>
                    <div class="app-card-content">
                        <h3>오늘의 운동</h3>
                        <p class="app-card-value">${escapeHtml(todayWorkoutText)}</p>
                    </div>
                </div>
                
                <div class="app-card app-card-secondary" id="weekly-workout-card" style="cursor: pointer;">
                    <div class="app-card-icon">📊</div>
                    <div class="app-card-content">
                        <h3>주간 운동</h3>
                        <p class="app-card-value">${weeklyWorkoutText}</p>
                    </div>
                </div>
            </div>
            `}
            
            <!-- 회원 활동 로그 섹션 (일반 회원) -->
            ${!isTrainer ? `
            <div class="app-dashboard-section">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                    <h2 class="app-section-title" style="margin: 0;">
                        🔔 트레이너 활동 알림
                        ${memberActivityLogsUnreadCount > 0 ? `<span style="background: #ff4444; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; margin-left: 8px;">${memberActivityLogsUnreadCount}</span>` : ''}
                    </h2>
                    ${memberActivityLogs && memberActivityLogsUnreadCount > 0 ? `
                        <button id="mark-all-member-read-btn" class="app-btn-secondary" style="padding: 6px 12px; font-size: 0.875rem; white-space: nowrap;">
                            전체 읽음 처리
                        </button>
                    ` : ''}
                </div>
                <div class="app-activity-logs-list">
                    ${memberActivityLogs && memberActivityLogs.length > 0 ? memberActivityLogs.map(log => {
                        const timeAgo = getTimeAgo(log.created_at);
                        const isUnread = !log.is_read;
                        
                        return `
                        <div class="app-activity-log-item ${isUnread ? 'app-activity-log-item-unread' : 'app-activity-log-item-read'}" 
                             data-log-id="${log.id}"
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
                    ${(() => {
                        const connectedAppUserId = localStorage.getItem('connectedMemberAppUserId');
                        if (connectedAppUserId && trainerMembers) {
                            const connectedMember = trainerMembers.find(m => m.app_user_id === connectedAppUserId);
                            if (connectedMember && connectedMember.name) {
                                return `<span style="font-size: 0.875rem; color: var(--app-primary); font-weight: 500;">${escapeHtml(connectedMember.name)} 회원과 연결중</span>`;
                            }
                        }
                        return '';
                    })()}
                </div>
                <div class="app-member-list">
                    ${trainerMembers && trainerMembers.length > 0 ? trainerMembers.map(member => {
                        const connectedAppUserId = localStorage.getItem('connectedMemberAppUserId');
                        const isConnected = connectedAppUserId === member.app_user_id;
                        return `
                        <div class="app-member-item ${isConnected ? 'app-member-item-connected' : ''}" 
                             data-app-user-id="${member.app_user_id}" 
                             data-member-name="${member.member_name ? escapeHtml(member.member_name) : ''}"
                             style="cursor:pointer;">
                            <div class="app-member-info">
                                <div style="display:flex;align-items:center;gap:8px;">
                                    <p class="app-member-name">${escapeHtml(member.name)}</p>
                                    ${isConnected ? '<span style="color:#4caf50;font-size:0.75rem;font-weight:600;">(연결됨)</span>' : ''}
                                    <span style="color:var(--app-text-muted);font-size:0.75rem;">(PT 회원)</span>
                                </div>
                                <p class="app-member-details">
                                    ${escapeHtml(member.phone || '-')} | 아이디: ${escapeHtml(member.username)}
                                    ${member.remainSessions !== undefined && member.remainSessions > 0 ? ` | 남은 세션: ${member.remainSessions}회` : ''}
                                </p>
                            </div>
                        </div>
                    `;
                    }).join('') : '<div style="padding: 20px; text-align: center; color: var(--app-text-muted);">연결된 회원이 없습니다</div>'}
                </div>
            </div>
            ` : ''}
            
            ${memberTrainers && memberTrainers.length > 0 ? `
            <div class="app-dashboard-section">
                <h2 class="app-section-title">담당 트레이너 (${memberTrainers.length}명)</h2>
                <div class="app-member-list">
                    ${memberTrainers.map(trainer => {
                        return `
                        <div class="app-member-item" data-trainer-username="${escapeHtml(trainer.username)}" style="cursor:pointer;">
                            <div class="app-member-info">
                                <div style="display:flex;align-items:center;gap:8px;">
                                    <p class="app-member-name">${escapeHtml(trainer.name)}</p>
                                </div>
                                <p class="app-member-details">트레이너</p>
                            </div>
                        </div>
                    `;
                    }).join('')}
                </div>
            </div>
            ` : ''}
        </div>
    `;
    
    // 회원 목록 클릭 이벤트 설정
    setupMemberClickEvents();
    
    // 트레이너 목록 클릭 이벤트 설정
    setupTrainerClickEvents();
    
    // 일반 회원만 카드 클릭 이벤트 설정
    if (!isTrainer) {
        // 오늘의 운동 카드 클릭 이벤트 설정
        setupTodayWorkoutCardClick();
        
        // 주간 운동 카드 클릭 이벤트 설정
        setupWeeklyWorkoutCardClick();
    }
    
    // 활동 로그 이벤트 설정
    if (isTrainer) {
        setupActivityLogEvents();
    } else {
        setupMemberActivityLogEvents();
    }
}

/**
 * 주간 운동 카드 클릭 이벤트 설정
 */
function setupWeeklyWorkoutCardClick() {
    const weeklyWorkoutCard = document.getElementById('weekly-workout-card');
    if (weeklyWorkoutCard) {
        weeklyWorkoutCard.addEventListener('click', () => {
            showWeeklyWorkoutModal();
        });
    }
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

/**
 * 오늘의 운동 카드 클릭 이벤트 설정
 */
function setupTodayWorkoutCardClick() {
    // 운동기록이 없는 경우에만 클릭 이벤트 추가
    if (!todayWorkoutSummary) {
        const todayWorkoutCard = document.getElementById('today-workout-card');
        if (todayWorkoutCard) {
            todayWorkoutCard.addEventListener('click', () => {
                // 자동으로 운동 추가 모달을 열기 위한 플래그 설정
                localStorage.setItem('autoOpenWorkoutAdd', 'true');
                
                // 하단 네비게이션의 운동 탭 버튼을 클릭
                const workoutNavBtn = document.querySelector('[data-screen="workout"]');
                if (workoutNavBtn) {
                    workoutNavBtn.click();
                }
            });
        }
    }
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
    const trainerItems = document.querySelectorAll('.app-member-item[data-trainer-username]');
    
    trainerItems.forEach(item => {
        item.addEventListener('click', async (e) => {
            e.stopPropagation();
            const trainerUsername = item.getAttribute('data-trainer-username');
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
                    placeholder="이름, 전화번호, 아이디로 검색"
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
                
                // PT 회원과 연결된 유저앱 회원만 필터링 (member_name이 있는 회원)
                const appUsersWithMemberName = appUsers.filter(user => 
                    user.member_name && user.member_name.trim() !== ''
                );
                
                // 검색어로 필터링 (이름, 전화번호, 아이디로 검색)
                const queryLower = query.toLowerCase();
                const filteredUsers = appUsersWithMemberName.filter(user => {
                    const name = (user.name || '').toLowerCase();
                    const phone = (user.phone || '').replace(/[^0-9]/g, '');
                    const username = (user.username || '').toLowerCase();
                    const queryNoHyphen = query.replace(/[^0-9]/g, '');
                    
                    return name.includes(queryLower) || 
                           phone.includes(queryNoHyphen) || 
                           username.includes(queryLower);
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
                                    ${user.member_name ? '<span style="color:var(--app-text-muted);font-size:0.75rem;">(PT 회원)</span>' : ''}
                                </div>
                                <p class="app-member-details">
                                    ${escapeHtml(user.phone || '-')} | 아이디: ${escapeHtml(user.username)}
                                    ${user.member_name ? ` | PT: ${escapeHtml(user.member_name)}` : ''}
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
 */
async function connectAppUser(appUserId, appUserName) {
    // 이미 연결된 회원인지 확인
    const connectedAppUserId = localStorage.getItem('connectedMemberAppUserId');
    if (connectedAppUserId === appUserId) {
        // 이미 연결된 회원이면 해제 여부 확인
        if (confirm(`"${appUserName}" 회원과의 연결을 해제하시겠습니까?`)) {
            localStorage.removeItem('connectedMemberName');
            localStorage.removeItem('connectedMemberAppUserId');
            await refresh();
        }
        return;
    }
    
    // 다른 회원이 연결되어 있으면 확인
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
        loadWeeklyWorkoutSummary(),
        loadConnectedAppUserInfo(),
        loadActivityLogs(),
        loadMemberActivityLogs()
    ]);
    render();
    
    // 활동 로그 자동 업데이트 재시작
    startActivityLogsAutoUpdate();
}

/**
 * 대시보드 정리 (화면 전환 시 호출)
 */
export function cleanup() {
    stopActivityLogsAutoUpdate();
}

/**
 * 회원 활동 로그 이벤트 설정
 */
function setupMemberActivityLogEvents() {
    const container = document.getElementById('app-user-content');
    if (!container) return;
    
    // 로그 카드 클릭 이벤트 (읽음 처리)
    const logItems = container.querySelectorAll('.app-activity-log-item');
    logItems.forEach(item => {
        item.addEventListener('click', async () => {
            const logId = item.getAttribute('data-log-id');
            const isUnread = item.classList.contains('app-activity-log-item-unread');
            
            if (!logId || !isUnread) return;
            
            const appUserId = currentUser?.id;
            if (!appUserId) return;
            
            try {
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
                    if (badge) {
                        if (memberActivityLogsUnreadCount > 0) {
                            badge.textContent = memberActivityLogsUnreadCount;
                        } else {
                            badge.remove();
                            // 전체 읽음 처리 버튼 숨김
                            const markAllBtn = document.getElementById('mark-all-member-read-btn');
                            if (markAllBtn) markAllBtn.style.display = 'none';
                        }
                    }
                }
                
                // 로그 데이터 업데이트 (is_read 상태 변경)
                if (memberActivityLogs) {
                    const log = memberActivityLogs.find(l => l.id === logId);
                    if (log) {
                        log.is_read = true;
                    }
                }
            } catch (error) {
                console.error('로그 읽음 처리 오류:', error);
                alert('로그 읽음 처리 중 오류가 발생했습니다.');
            }
        });
    });
    
    // 전체 읽음 처리 버튼 클릭 이벤트
    const markAllBtn = document.getElementById('mark-all-member-read-btn');
    if (markAllBtn) {
        markAllBtn.addEventListener('click', async () => {
            const appUserId = currentUser?.id;
            if (!appUserId) return;
            
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
                
                // 전체 읽음 처리 버튼 숨김 (제거하지 않음)
                markAllBtn.style.display = 'none';
                
                // 읽지 않은 개수 0으로 업데이트
                memberActivityLogsUnreadCount = 0;
                
                // 헤더의 읽지 않은 개수 뱃지 제거
                const sectionTitle = container.querySelector('.app-dashboard-section h2.app-section-title');
                if (sectionTitle) {
                    const badge = sectionTitle.querySelector('span');
                    if (badge) badge.remove();
                }
                
                // 로그 데이터 업데이트 (is_read 상태 변경)
                if (memberActivityLogs) {
                    memberActivityLogs.forEach(log => {
                        log.is_read = true;
                    });
                }
            } catch (error) {
                console.error('로그 읽음 처리 오류:', error);
                alert('로그 읽음 처리 중 오류가 발생했습니다.');
            }
        });
    }
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
    
    // 중복 이벤트 리스너 방지: 이미 설정되어 있으면 스킵
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
                    const sectionTitle = container.querySelector('.app-dashboard-section h2.app-section-title');
                    if (sectionTitle) {
                        const badge = sectionTitle.querySelector('span');
                        if (badge) badge.remove();
                    }
                    if (btn) btn.style.display = 'none';
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
        return;
    }
    
    // 로그 카드 클릭 이벤트 (읽음 처리)
    const logItems = container.querySelectorAll('.app-activity-log-item');
    logItems.forEach(item => {
        item.addEventListener('click', async () => {
            const logId = item.getAttribute('data-log-id');
            const isUnread = item.classList.contains('app-activity-log-item-unread');
            
            if (!logId || !isUnread) return;
            
            const trainerUsername = currentUser?.username;
            if (!trainerUsername) return;
            
            try {
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
                        // 전체 읽음 처리 버튼도 제거
                        const markAllBtn = document.getElementById('mark-all-read-btn');
                        if (markAllBtn) markAllBtn.parentElement.remove();
                    }
                }
                
                // 로그 데이터 업데이트
                const log = activityLogs.find(l => l.id === logId);
                if (log) {
                    log.is_read = true;
                }
            } catch (error) {
                console.error('로그 읽음 처리 오류:', error);
                alert('로그 읽음 처리 중 오류가 발생했습니다.');
            }
        });
    });
    
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
            
            // 버튼 비활성화 (제거하지 않고 숨김 처리)
            if (btn) {
                btn.style.display = 'none';
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
