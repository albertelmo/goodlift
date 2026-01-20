// 앱 유저 홈/대시보드 화면

import { formatDate, getToday, escapeHtml } from './utils.js';
import { getWorkoutRecords } from './api.js';

let currentUser = null;
let nextSession = null;
let trainerMembers = null; // 트레이너의 연결된 회원 목록
let memberTrainers = null; // 회원의 연결된 트레이너 목록
let todayWorkoutSummary = null; // 오늘의 운동 요약
let weeklyWorkoutSummary = null; // 주간 운동 요약

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
        loadWeeklyWorkoutSummary()
    ]);
    render();
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
 */
async function loadTrainerMembers() {
    // 트레이너 여부 확인 (currentUser의 isTrainer 필드로 확인)
    const isTrainer = currentUser?.isTrainer === true;
    
    if (!isTrainer) {
        trainerMembers = null;
        return;
    }
    
    try {
        // 트레이너의 회원 목록 조회 (trainer는 username)
        const trainerUsername = currentUser?.username;
        const membersResponse = await fetch(`/api/members?trainer=${encodeURIComponent(trainerUsername)}`);
        
        if (!membersResponse.ok) {
            throw new Error('회원 목록 조회 실패');
        }
        
        const members = await membersResponse.json();
        
        // 유효한 회원만 필터링 (무기명/체험 제외)
        const validMembers = members.filter(member => 
            member.status === '유효' && 
            !member.name.startsWith('무기명') && 
            !member.name.startsWith('체험')
        );
        
        // 유저앱 회원 목록 조회 (회원 연결이 완료된 회원들만 - member_name이 있는 것들)
        const appUsersResponse = await fetch('/api/app-users');
        if (!appUsersResponse.ok) {
            throw new Error('유저앱 회원 목록 조회 실패');
        }
        
        const appUsers = await appUsersResponse.json();
        
        // 회원 연결이 완료된 유저앱 회원의 member_name 목록 생성
        const appUserMemberNames = new Set(
            appUsers
                .filter(user => user.member_name && user.member_name.trim() !== '')
                .map(user => user.member_name)
        );
        
        // 트레이너의 회원 중 회원 연결이 완료된 유저앱 회원만 필터링
        trainerMembers = validMembers.filter(member => 
            appUserMemberNames.has(member.name)
        );
    } catch (error) {
        console.error('트레이너 회원 목록 조회 오류:', error);
        trainerMembers = null;
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
            
            <div class="app-dashboard-cards">
                ${!isTrainer ? `
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
                ` : ''}
                
                <div class="app-card app-card-primary" id="today-workout-card" ${!todayWorkoutSummary ? 'style="cursor: pointer;"' : ''}>
                    <div class="app-card-icon">💪</div>
                    <div class="app-card-content">
                        <h3>오늘의 운동</h3>
                        <p class="app-card-value">${escapeHtml(todayWorkoutText)}</p>
                    </div>
                </div>
                
                <div class="app-card app-card-secondary">
                    <div class="app-card-icon">🍎</div>
                    <div class="app-card-content">
                        <h3>오늘의 식단</h3>
                        <p class="app-card-value">준비 중입니다</p>
                    </div>
                </div>
            </div>
            
            <div class="app-dashboard-stats">
                <div class="app-stat-item" id="weekly-workout-stat-item" style="cursor: pointer;">
                    <p class="app-stat-label">주간 운동</p>
                    <p class="app-stat-value">${weeklyWorkoutText}</p>
                </div>
                <div class="app-stat-item">
                    <p class="app-stat-label">주간 소모 칼로리</p>
                    <p class="app-stat-value">0kcal</p>
                </div>
            </div>
            
            ${trainerMembers && trainerMembers.length > 0 ? `
            <div class="app-dashboard-section">
                <h2 class="app-section-title">연결된 회원 (${trainerMembers.length}명)</h2>
                <div class="app-member-list">
                    ${trainerMembers.map(member => {
                        const connectedMemberName = localStorage.getItem('connectedMemberName');
                        const isConnected = connectedMemberName === member.name;
                        return `
                        <div class="app-member-item ${isConnected ? 'app-member-item-connected' : ''}" data-member-name="${escapeHtml(member.name)}" style="cursor:pointer;">
                            <div class="app-member-info">
                                <div style="display:flex;align-items:center;gap:8px;">
                                    <p class="app-member-name">${escapeHtml(member.name)}</p>
                                    ${isConnected ? '<span style="color:#4caf50;font-size:0.75rem;font-weight:600;">(연결됨)</span>' : ''}
                                </div>
                                <p class="app-member-details">${escapeHtml(member.phone || '-')} | 남은 세션: ${member.remainSessions || 0}회</p>
                            </div>
                        </div>
                    `;
                    }).join('')}
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
    
    // 오늘의 운동 카드 클릭 이벤트 설정
    setupTodayWorkoutCardClick();
    
    // 주간 운동 카드 클릭 이벤트 설정
    setupWeeklyWorkoutClick();
}

/**
 * 주간 운동 카드 클릭 이벤트 설정
 */
function setupWeeklyWorkoutClick() {
    const weeklyWorkoutStatItem = document.getElementById('weekly-workout-stat-item');
    if (weeklyWorkoutStatItem) {
        weeklyWorkoutStatItem.addEventListener('click', () => {
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
    const memberItems = document.querySelectorAll('.app-member-item[data-member-name]');
    
    memberItems.forEach(item => {
        item.addEventListener('click', async () => {
            const memberName = item.getAttribute('data-member-name');
            await connectMember(memberName);
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
 * 회원 연결
 */
async function connectMember(memberName) {
    // 이미 연결된 회원인지 확인
    const connectedMemberName = localStorage.getItem('connectedMemberName');
    if (connectedMemberName === memberName) {
        // 이미 연결된 회원이면 해제 여부 확인
        if (confirm(`"${memberName}" 회원과의 연결을 해제하시겠습니까?`)) {
            localStorage.removeItem('connectedMemberName');
            localStorage.removeItem('connectedMemberAppUserId');
            await refresh();
        }
        return;
    }
    
    // 다른 회원이 연결되어 있으면 확인
    if (connectedMemberName) {
        if (!confirm(`"${connectedMemberName}" 회원과의 연결을 해제하고 "${memberName}" 회원의 정보를 불러오시겠습니까?`)) {
            return;
        }
    } else {
        // 연결 확인
        if (!confirm(`"${memberName}" 회원의 정보를 불러오시겠습니까?`)) {
            return;
        }
    }
    
    try {
        // 해당 회원의 app_user_id 조회
        const appUsersResponse = await fetch('/api/app-users');
        if (!appUsersResponse.ok) {
            throw new Error('유저앱 회원 목록 조회 실패');
        }
        
        const appUsers = await appUsersResponse.json();
        const appUser = appUsers.find(user => user.member_name === memberName);
        
        if (!appUser) {
            alert('해당 회원의 유저앱 계정을 찾을 수 없습니다.');
            return;
        }
        
        // 연결 정보 저장
        localStorage.setItem('connectedMemberName', memberName);
        localStorage.setItem('connectedMemberAppUserId', appUser.id);
        
        // 대시보드 새로고침
        await refresh();
        
        alert(`"${memberName}" 회원과 연결되었습니다. 이제 운동/식단 탭에서 해당 회원의 정보를 확인하고 편집할 수 있습니다.`);
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
        // 트레이너의 app_user_id 찾기
        const appUsersResponse = await fetch(`/api/app-users?username=${encodeURIComponent(trainerUsername)}`);
        if (!appUsersResponse.ok) {
            throw new Error('트레이너 정보 조회 실패');
        }
        
        const appUsers = await appUsersResponse.json();
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
        loadWeeklyWorkoutSummary()
    ]);
    render();
}
