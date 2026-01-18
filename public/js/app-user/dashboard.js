// 앱 유저 홈/대시보드 화면

import { formatDate, getToday, escapeHtml } from './utils.js';

let currentUser = null;
let nextSession = null;
let trainerMembers = null; // 트레이너의 연결된 회원 목록

/**
 * 대시보드 초기화
 */
export async function init(userData) {
    currentUser = userData;
    await Promise.all([
        loadNextSession(),
        loadTrainerMembers()
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
            
            nextSession = futureSessions[0];
        } else {
            nextSession = null;
        }
    } catch (error) {
        console.error('다음 세션 조회 오류:', error);
        nextSession = null;
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
    if (!isTrainer && nextSession) {
        const sessionDate = formatShortDate(nextSession.date);
        const dayOfWeek = formatDayOfWeek(nextSession.date);
        const sessionTime = nextSession.time || '';
        nextSessionText = `${sessionDate}(${dayOfWeek}) ${sessionTime}`;
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
                    <div class="app-card-icon">📅</div>
                    <div class="app-card-content">
                        <h3>다음 세션</h3>
                        <p class="app-card-value">${escapeHtml(hasMemberName ? nextSessionText : '연결된 회원 정보가 없습니다')}</p>
                    </div>
                </div>
                ` : ''}
                
                <div class="app-card app-card-primary">
                    <div class="app-card-icon">💪</div>
                    <div class="app-card-content">
                        <h3>오늘의 운동</h3>
                        <p class="app-card-value">준비 중입니다</p>
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
                <div class="app-stat-item">
                    <p class="app-stat-label">주간 운동 시간</p>
                    <p class="app-stat-value">0분</p>
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
        </div>
    `;
    
    // 회원 목록 클릭 이벤트 설정
    setupMemberClickEvents();
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
 * 대시보드 새로고침
 */
export async function refresh() {
    await Promise.all([
        loadNextSession(),
        loadTrainerMembers()
    ]);
    render();
}
