async function loadList() {
    const loading = document.getElementById('trainer-list-loading');
    const listDiv = document.getElementById('trainer-list');
    if (loading) loading.style.display = 'block';
    if (listDiv) listDiv.innerHTML = '';
    
    try {
        const res = await fetch('/api/trainers');
        const trainers = await res.json();
        if (loading) loading.style.display = 'none';
        
        // 현재 사용자 role 확인
        const currentRole = localStorage.getItem('role');
        const isSu = currentRole === 'su';
        
        if (trainers.length === 0) {
            if (listDiv) listDiv.innerHTML = '<div style="color:#888;">등록된 트레이너가 없습니다.</div>';
        } else {
            let html = '<table style="width:100%;border-collapse:collapse;margin-top:10px;">';
            html += '<thead><tr>';
            html += '<th style="text-align:left;padding:8px 4px;border-bottom:1.5px solid #b6c6e3;">아이디</th>';
            html += '<th style="text-align:left;padding:8px 4px;border-bottom:1.5px solid #b6c6e3;">이름</th>';
            html += '<th style="text-align:center;padding:8px 4px;border-bottom:1.5px solid #b6c6e3;">VIP 기능</th>';
            html += '<th style="text-align:center;padding:8px 4px;border-bottom:1.5px solid #b6c6e3;">30분 세션</th>';
            html += '<th style="text-align:center;padding:8px 4px;border-bottom:1.5px solid #b6c6e3;">프로필 사진</th>';
            if (isSu) {
                html += '<th style="text-align:center;padding:8px 4px;border-bottom:1.5px solid #b6c6e3;">삭제</th>';
            }
            html += '</tr></thead><tbody>';
            
            trainers.forEach(tr => {
                const vipStatus = tr.vip_member ? 'ON' : 'OFF';
                const vipColor = tr.vip_member ? '#2196f3' : '#666';
                const vipBgColor = tr.vip_member ? '#e3f2fd' : '#f5f5f5';
                
                const thirtyMinStatus = tr['30min_session'] === 'on' ? 'ON' : 'OFF';
                const thirtyMinColor = tr['30min_session'] === 'on' ? '#2196f3' : '#666';
                const thirtyMinBgColor = tr['30min_session'] === 'on' ? '#e3f2fd' : '#f5f5f5';
                
                const profileImageUrl = tr.profile_image_url || null;
                const profileImageHtml = profileImageUrl 
                    ? `<img src="${profileImageUrl}" alt="프로필" style="width:50px;height:50px;object-fit:cover;border-radius:50%;cursor:pointer;border:2px solid #ddd;" 
                         onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
                         onclick="openProfileImageModal('${tr.username}', '${tr.name}')" />
                       <div style="width:50px;height:50px;border-radius:50%;background:#e0e0e0;display:none;align-items:center;justify-content:center;cursor:pointer;border:2px solid #ddd;margin:0 auto;"
                         onclick="openProfileImageModal('${tr.username}', '${tr.name}')">
                         <span style="font-size:20px;">👤</span>
                       </div>`
                    : `<div style="width:50px;height:50px;border-radius:50%;background:#e0e0e0;display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px solid #ddd;margin:0 auto;"
                         onclick="openProfileImageModal('${tr.username}', '${tr.name}')">
                         <span style="font-size:20px;">👤</span>
                       </div>`;
                
                html += `<tr>
                    <td style="padding:8px 4px;border-bottom:1px solid #e3eaf5;">${tr.username}</td>
                    <td style="padding:8px 4px;border-bottom:1px solid #e3eaf5;">${tr.name}</td>
                    <td style="padding:8px 4px;border-bottom:1px solid #e3eaf5;text-align:center;">
                        <button class="vip-toggle-btn" data-username="${tr.username}" data-name="${tr.name}" data-vip="${tr.vip_member}" 
                                style="background:${vipBgColor};color:${vipColor};border:1px solid ${vipColor};padding:4px 12px;border-radius:4px;cursor:pointer;font-size:0.9rem;min-width:60px;text-align:center;display:inline-block;width:60px;">
                            ${vipStatus}
                        </button>
                    </td>
                    <td style="padding:8px 4px;border-bottom:1px solid #e3eaf5;text-align:center;">
                        <button class="thirty-min-toggle-btn" data-username="${tr.username}" data-name="${tr.name}" data-thirty-min="${tr['30min_session']}" 
                                style="background:${thirtyMinBgColor};color:${thirtyMinColor};border:1px solid ${thirtyMinColor};padding:4px 12px;border-radius:4px;cursor:pointer;font-size:0.9rem;min-width:60px;text-align:center;display:inline-block;width:60px;">
                            ${thirtyMinStatus}
                        </button>
                    </td>
                    <td style="padding:8px 4px;border-bottom:1px solid #e3eaf5;text-align:center;">
                        ${profileImageHtml}
                    </td>`;
                if (isSu) {
                    html += `<td style="padding:8px 4px;border-bottom:1px solid #e3eaf5;text-align:center;">
                        <button class="delete-trainer-btn" data-username="${tr.username}" data-name="${tr.name}" 
                                style="background:#d32f2f;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:0.9rem;">삭제</button>
                    </td>`;
                }
                html += `</tr>`;
            });
            
            html += '</tbody></table>';
            if (listDiv) listDiv.innerHTML = html;
            
            // VIP 기능 토글 버튼 이벤트 리스너 추가
            setupVipToggleListeners();
            
            // 30분 세션 토글 버튼 이벤트 리스너 추가
            setupThirtyMinToggleListeners();
            
            // su 유저인 경우에만 삭제 버튼 이벤트 리스너 추가
            if (isSu) {
                setupDeleteTrainerListeners();
            }
        }
    } catch (e) {
        if (loading) loading.style.display = 'none';
        if (listDiv) listDiv.innerHTML = '<div style="color:#d32f2f;">트레이너 목록을 불러오지 못했습니다.</div>';
    }
}

// VIP 기능 토글 버튼 이벤트 리스너 설정
function setupVipToggleListeners() {
    const listDiv = document.getElementById('trainer-list');
    if (!listDiv) return;
    
    listDiv.querySelectorAll('.vip-toggle-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const username = this.getAttribute('data-username');
            const name = this.getAttribute('data-name');
            const currentVip = this.getAttribute('data-vip') === 'true';
            const newVip = !currentVip;
            
            const action = newVip ? '활성화' : '비활성화';
            if (!confirm(`트레이너 "${name}"의 VIP 회원 기능을 ${action}하시겠습니까?`)) {
                return;
            }
            
            try {
                const currentUser = localStorage.getItem('username');
                const res = await fetch(`/api/trainers/${encodeURIComponent(username)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        vip_member: newVip,
                        currentUser 
                    })
                });
                const result = await res.json();
                
                if (res.ok) {
                    alert(`VIP 회원 기능이 ${action}되었습니다.`);
                    loadList(); // 목록 새로고침
                } else {
                    alert(result.message || 'VIP 기능 설정 변경에 실패했습니다.');
                }
            } catch (error) {
                console.error('VIP 기능 설정 변경 오류:', error);
                alert('VIP 기능 설정 변경에 실패했습니다.');
            }
        });
    });
}

// 30분 세션 토글 버튼 이벤트 리스너 설정
function setupThirtyMinToggleListeners() {
    const listDiv = document.getElementById('trainer-list');
    if (!listDiv) return;
    
    listDiv.querySelectorAll('.thirty-min-toggle-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const username = this.getAttribute('data-username');
            const name = this.getAttribute('data-name');
            const currentThirtyMin = this.getAttribute('data-thirty-min') === 'on';
            const newThirtyMin = !currentThirtyMin;
            
            const action = newThirtyMin ? '활성화' : '비활성화';
            if (!confirm(`트레이너 "${name}"의 30분 세션 기능을 ${action}하시겠습니까?`)) {
                return;
            }
            
            try {
                const currentUser = localStorage.getItem('username');
                const res = await fetch(`/api/trainers/${encodeURIComponent(username)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        '30min_session': newThirtyMin ? 'on' : 'off',
                        currentUser 
                    })
                });
                const result = await res.json();
                
                if (res.ok) {
                    alert(`30분 세션 기능이 ${action}되었습니다.`);
                    loadList(); // 목록 새로고침
                } else {
                    alert(result.message || '30분 세션 기능 설정 변경에 실패했습니다.');
                }
            } catch (error) {
                console.error('30분 세션 기능 설정 변경 오류:', error);
                alert('30분 세션 기능 설정 변경에 실패했습니다.');
            }
        });
    });
}

// 삭제 버튼 이벤트 리스너 설정
function setupDeleteTrainerListeners() {
    const listDiv = document.getElementById('trainer-list');
    if (!listDiv) return;
    
    listDiv.querySelectorAll('.delete-trainer-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const username = this.getAttribute('data-username');
            const name = this.getAttribute('data-name');
            
            if (!confirm(`정말 트레이너 "${name}"을(를) 삭제하시겠습니까?`)) {
                return;
            }
            
            try {
                const currentUser = localStorage.getItem('username');
                const res = await fetch(`/api/trainers/${encodeURIComponent(username)}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ currentUser })
                });
                const result = await res.json();
                
                if (res.ok) {
                    alert('트레이너가 삭제되었습니다.');
                    loadList(); // 목록 새로고침
                } else {
                    alert(result.message || '트레이너 삭제에 실패했습니다.');
                }
            } catch (error) {
                console.error('트레이너 삭제 오류:', error);
                alert('트레이너 삭제에 실패했습니다.');
            }
        });
    });
}

export async function renderMyMembers(container, username) {
    if (!container) return;
    container.innerHTML = '<div style="color:#888;text-align:center;">불러오는 중...</div>';
    try {
        const res = await fetch('/api/members');
        const members = await res.json();
        const myMembers = members.filter(m => 
            m.trainer === username && 
            m.status === '유효'
        ).sort((a, b) => {
            // 잔여세션이 없는 경우를 맨 뒤로
            const aRemain = a.remainSessions !== undefined ? a.remainSessions : -1;
            const bRemain = b.remainSessions !== undefined ? b.remainSessions : -1;
            return aRemain - bRemain; // 오름차순 (잔여세션 적은 순)
        });
        
        let html = '';
        
        if (!myMembers.length) {
            html += '<div style="color:#888;text-align:center;">담당 회원이 없습니다.</div>';
            container.innerHTML = html;
            return;
        }
        html += `<table style="width:100%;border-collapse:collapse;margin-top:18px;">
          <thead><tr>
            <th style="text-align:center;">이름</th><th style="text-align:center;">세션 수</th><th style="text-align:center;">잔여세션</th><th style="text-align:center;">상태</th>
          </tr></thead><tbody>`;
        myMembers.forEach(m => {
            html += `<tr>
                <td style="text-align:center;">${m.name}</td>
                <td style="text-align:center;">${m.sessions}</td>
                <td style="text-align:center;">${m.remainSessions !== undefined ? m.remainSessions : ''}</td>
                <td style="text-align:center;">${m.status || ''}</td>
            </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch {
        container.innerHTML = '<div style="color:#d32f2f;text-align:center;">회원 목록을 불러오지 못했습니다.</div>';
    }
}

let calState = { year: null, month: null, today: null };

// 월 변경 시 날짜 유효성 검사 및 조정 함수
function adjustDateForMonthChange() {
    const currentYear = calState.year;
    const currentMonth = calState.month;
    const currentDay = calState.today;
    
    // 새로운 월의 마지막 날짜 계산
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();
    
    // 현재 선택된 날짜가 새로운 월에서 유효하지 않은 경우 조정
    if (currentDay > lastDayOfMonth) {
        calState.today = lastDayOfMonth;
    }
}

export function renderSessionCalendar(container) {
    if (!container) return;
    // 상태 초기화(최초 진입 시 오늘로)
    if (!calState.year) {
        const today = new Date();
        calState.year = today.getFullYear();
        calState.month = today.getMonth() + 1;
        calState.today = today.getDate();
    }
    
    // 초기 상태 유효성 검사
    validateAndAdjustCalendarState();
    
    renderCalUI(container);
}

// 캘린더 상태 유효성 검사 및 조정 함수
function validateAndAdjustCalendarState() {
    // 월 범위 검사
    if (calState.month < 1 || calState.month > 12) {
        console.error(`Invalid month state: ${calState.month}, resetting to current month`);
        const today = new Date();
        calState.month = today.getMonth() + 1;
        calState.year = today.getFullYear();
    }
    
    // 연도 범위 검사 (합리적인 범위)
    if (calState.year < 2000 || calState.year > 2100) {
        console.error(`Invalid year state: ${calState.year}, resetting to current year`);
        const today = new Date();
        calState.year = today.getFullYear();
        calState.month = today.getMonth() + 1;
    }
    
    // 날짜 유효성 검사
    const lastDayOfMonth = new Date(calState.year, calState.month, 0).getDate();
    if (calState.today < 1 || calState.today > lastDayOfMonth) {
        console.error(`Invalid day state: ${calState.today}, adjusting to last day of month: ${lastDayOfMonth}`);
        calState.today = lastDayOfMonth;
    }
}

async function renderCalUI(container, forceDate) {
    const yyyy = calState.year;
    const mm = String(calState.month).padStart(2, '0');
    let dd = String(calState.today).padStart(2, '0');
    if (forceDate) dd = forceDate;
    
    // 날짜 유효성 검사 및 조정
    const currentMonth = calState.month;
    const lastDayOfMonth = new Date(yyyy, currentMonth, 0).getDate();
    const currentDay = parseInt(dd);
    
    if (currentDay > lastDayOfMonth) {
        dd = String(lastDayOfMonth).padStart(2, '0');
        calState.today = lastDayOfMonth;
    }
    
    const selectedDate = `${yyyy}-${mm}-${dd}`;
    const username = localStorage.getItem('username');
    
    try {
        // 세션 정보 가져오기
        const sessionsRes = await fetch(`/api/sessions?trainer=${encodeURIComponent(username)}`);
        const allSessions = await sessionsRes.json();
        
        // 회원 정보 가져오기
        const membersRes = await fetch('/api/members');
        const members = await membersRes.json();
        
        // 세션이 있는 날짜와 결석 여부 정보 수집
        const sessionDayInfo = {};
        allSessions.filter(s => s.date && s.date.startsWith(`${yyyy}-${mm}`)).forEach(s => {
          const day = s.date.split('T')[0].split('-')[2];
          const member = members.find(m => m.name === s.member);
          const remainSessions = member ? member.remainSessions : 0;
          const hasNoRemainingSessions = remainSessions <= 0;
          
          // 현재 날짜와 세션 날짜 비교
          const today = new Date();
          const sessionDate = new Date(s.date);
          const isPastDate = sessionDate < today && sessionDate.toDateString() !== today.toDateString();
          
          // 결석 여부 확인
          const isAbsent = s.status !== '완료' && !hasNoRemainingSessions && isPastDate;
          
          // 해당 날짜에 결석이 있는지 표시
          if (!sessionDayInfo[day]) {
            sessionDayInfo[day] = { hasSession: true, hasAbsent: false };
          }
          if (isAbsent) {
            sessionDayInfo[day].hasAbsent = true;
          }
        });
        
        const sessionDays = new Set(Object.keys(sessionDayInfo));
        
        // 선택 날짜의 세션만 추출 (시간순 정렬)
        const sessions = allSessions.filter(s => {
          const sessionDate = s.date.split('T')[0]; // ISO 날짜에서 날짜 부분만 추출
          return sessionDate === selectedDate;
        }).sort((a, b) => a.time.localeCompare(b.time));
        
        // 세션별로 회원 정보 매핑
        const sessionsWithMemberInfo = sessions.map(s => {
          const member = members.find(m => m.name === s.member);
          const remainSessions = member ? member.remainSessions : 0;
          const hasNoRemainingSessions = remainSessions <= 0;
          
          // 현재 날짜와 세션 날짜 비교
          const today = new Date();
          const sessionDate = new Date(s.date);
          const isPastDate = sessionDate < today && sessionDate.toDateString() !== today.toDateString();
          
          // 상태 우선순위: 완료 > 잔여세션부족 > 결석 > 예정
          let displayStatus = s.status;
          
          if (s.status === '완료') {
            // 완료된 세션은 그대로 유지
            displayStatus = '완료';
          } else if (hasNoRemainingSessions) {
            // 잔여세션이 부족한 경우 우선 표시
            displayStatus = '잔여세션 부족';
          } else if (isPastDate) {
            // 날짜가 지난 미완료 세션은 "결석"으로 표시
            displayStatus = '결석';
          } else {
            // 그 외는 원래 상태 유지
            displayStatus = s.status;
          }
          
          return {
            ...s,
            remainSessions,
            hasNoRemainingSessions,
            displayStatus,
            isPastDate
          };
        });
        
        let html = `<div class="trainer-mobile-cal-wrap">
            <div class="tmc-header"></div>
            <div class="tmc-calendar">
                <div class="tmc-month-nav">
                    <span class="tmc-month">${mm}월</span>
                </div>
                <table class="tmc-cal-table">
                    <thead><tr>${['일','월','화','수','목','금','토'].map(d=>`<th>${d}</th>`).join('')}</tr></thead>
                    <tbody>${renderSimpleMonthWithDots(yyyy, mm, dd, sessionDayInfo)}</tbody>
                </table>
            </div>
            <div class="tmc-session-list">`;
        
        if (sessionsWithMemberInfo.length) {
          sessionsWithMemberInfo.forEach(s => {
            let itemClass = 'tmc-session-item';
            if (s.status === '완료') itemClass += ' done';
            // 완료되지 않은 세션에만 잔여세션 부족 스타일 적용
            if (s.hasNoRemainingSessions && s.status !== '완료') itemClass += ' no-remaining';
            
            let itemStyle = '';
            if (s.status === '완료') itemStyle = 'style="pointer-events:none;opacity:0.6;"';
            else if (s.displayStatus === '결석') itemStyle = 'style="opacity:0.7;"';
            
            let statusClass = '';
            if (s.displayStatus === '완료') statusClass = 'attend';
            else if (s.displayStatus === '예정') statusClass = 'scheduled';
            else if (s.displayStatus === '결석') statusClass = 'absent';
            // 완료되지 않은 세션에만 잔여세션 부족 스타일 적용
            if (s.hasNoRemainingSessions && s.status !== '완료') statusClass += ' no-remaining';
            
            const is30min = s['30min'] === true;
            const timeStyle = is30min ? 'style="color:#f57c00;"' : '';
            const typeStyle = is30min ? 'style="color:#ff9800;"' : '';
            
            html += `<div class="${itemClass}" data-id="${s.id}" data-no-remaining="${s.hasNoRemainingSessions && s.status !== '완료'}" ${itemStyle}>
                <span class="tmc-session-time" ${timeStyle}>${s.time}</span>
                <span class="tmc-session-type" ${typeStyle}>${is30min ? '30분' : 'PT'}</span>
                <span class="tmc-session-member">${s.member}</span>
                <span class="tmc-session-status ${statusClass}">${s.displayStatus}</span>
                ${s.hasNoRemainingSessions && s.status !== '완료' ? '<span style="color:#d32f2f;font-size:1.2em;margin-left:4px;">⚠️</span>' : ''}
            </div>`;
          });
        } else {
          html += '<div class="tmc-no-session">세션이 없습니다.</div>';
        }
        html += `</div>
            <button class="tmc-fab" id="tmc-add-btn">+</button>
            <button class="tmc-fab" id="tmc-add-30min-btn" style="display:none; bottom: 96px;">30min</button>
            <button class="tmc-fab" id="tmc-add-expense-btn" style="bottom: 32px; left: 24px; right: auto; background: #1976d2; font-size: 1.5rem; width: 48px; height: 48px; box-shadow: 0 4px 16px #1976d240; z-index: 1002;">💳</button>
            <div class="tmc-modal-bg" id="tmc-modal-bg" style="display:none;"></div>
            <div class="tmc-modal" id="tmc-modal" style="display:none;">
                <div class="tmc-modal-content">
                    <div class="tmc-modal-header">
                    <h3>세션 추가</h3>
                        <button class="tmc-modal-close-btn" id="tmc-modal-close-x" aria-label="닫기">×</button>
                    </div>
                    <form id="tmc-session-add-form" class="tmc-modal-form">
                        <div class="tmc-form-group">
                            <label for="tmc-trainer-select">트레이너</label>
                            <select name="trainer" id="tmc-trainer-select" required></select>
                        </div>
                        <div class="tmc-form-group">
                            <label for="tmc-member-select">회원</label>
                            <select name="member" id="tmc-member-select" required></select>
                        </div>
                        <div class="tmc-form-group">
                            <label for="tmc-date-input">날짜</label>
                            <input type="date" name="date" id="tmc-date-input" required>
                        </div>
                        <div class="tmc-form-group">
                            <label for="tmc-time-input">시간</label>
                            <select name="time" id="tmc-time-input" required></select>
                        </div>
                        <div class="tmc-checkbox-group">
                            <input type="checkbox" name="repeat" id="tmc-repeat-checkbox">
                            <label for="tmc-repeat-checkbox">반복하기</label>
                        </div>
                        <div class="tmc-form-group" id="tmc-repeat-count-label" style="opacity:0;height:0;overflow:hidden;transition:all 0.3s ease;margin:0;">
                            <label for="tmc-repeat-count-input">반복횟수</label>
                            <select name="repeatCount" id="tmc-repeat-count-input">
                          <option value="5">5회</option>
                          <option value="10">10회</option>
                          <option value="15">15회</option>
                          <option value="20">20회</option>
                        </select>
                        </div>
                        <div id="tmc-session-add-result" class="tmc-modal-result"></div>
                    </form>
                    <div class="tmc-modal-actions">
                        <button type="submit" form="tmc-session-add-form" class="tmc-modal-submit-btn">등록</button>
                    </div>
                </div>
            </div>
            <div class="tmc-modal" id="tmc-30min-modal" style="display:none;">
                <div class="tmc-modal-content">
                    <div class="tmc-modal-header">
                    <h3>30분 세션 추가</h3>
                        <button class="tmc-modal-close-btn" id="tmc-30min-modal-close-x" aria-label="닫기">×</button>
                    </div>
                    <form id="tmc-30min-session-add-form" class="tmc-modal-form">
                        <div class="tmc-form-group">
                            <label for="tmc-30min-trainer-select">트레이너</label>
                            <select name="trainer" id="tmc-30min-trainer-select" required></select>
                        </div>
                        <div class="tmc-form-group">
                            <label for="tmc-30min-member-select">회원</label>
                            <select name="member" id="tmc-30min-member-select" required></select>
                        </div>
                        <div class="tmc-form-group">
                            <label for="tmc-30min-date-input">날짜</label>
                            <input type="date" name="date" id="tmc-30min-date-input" required>
                        </div>
                        <div class="tmc-form-group">
                            <label for="tmc-30min-time-input">시간</label>
                            <select name="time" id="tmc-30min-time-input" required></select>
                        </div>
                        <div class="tmc-checkbox-group">
                            <input type="checkbox" name="repeat" id="tmc-30min-repeat-checkbox">
                            <label for="tmc-30min-repeat-checkbox">반복하기</label>
                        </div>
                        <div class="tmc-form-group" id="tmc-30min-repeat-count-label" style="opacity:0;height:0;overflow:hidden;transition:all 0.3s ease;margin:0;">
                            <label for="tmc-30min-repeat-count-input">반복횟수</label>
                            <select name="repeatCount" id="tmc-30min-repeat-count-input">
                          <option value="5">5회</option>
                          <option value="10">10회</option>
                          <option value="15">15회</option>
                          <option value="20">20회</option>
                        </select>
                        </div>
                        <div id="tmc-30min-session-add-result" class="tmc-modal-result"></div>
                    </form>
                    <div class="tmc-modal-actions">
                        <button type="submit" form="tmc-30min-session-add-form" class="tmc-modal-submit-btn">등록</button>
                    </div>
                </div>
            </div>
        </div>`;
        container.innerHTML = html;
        
        // 지출 내역 추가 버튼 이벤트 설정
        setupExpenseAddButton(username);
        
        // 세션 추가 모달: 트레이너 드롭다운 로딩
        const trainersRes = await fetch('/api/trainers');
        const allTrainers = await trainersRes.json();
        const trainerSel = document.getElementById('tmc-trainer-select');
        trainerSel.innerHTML = allTrainers.map(t => `<option value="${t.username}"${t.username === username ? ' selected' : ''}>${t.name}</option>`).join('');
        
        // 30분 세션 모달: 트레이너 드롭다운 로딩
        const trainer30minSel = document.getElementById('tmc-30min-trainer-select');
        trainer30minSel.innerHTML = allTrainers.map(t => `<option value="${t.username}"${t.username === username ? ' selected' : ''}>${t.name}</option>`).join('');
        
        // 트레이너 변경 시 회원 목록 업데이트 함수 (일반 세션)
        async function updateMemberDropdown(selectedTrainer) {
            const memberSel = document.getElementById('tmc-member-select');
            const filteredMembers = members.filter(m => 
                m.trainer === selectedTrainer && 
                m.remainSessions > 0 && 
                m.status === '유효'
            );
            memberSel.innerHTML = filteredMembers.length ? 
                filteredMembers.map(m => `<option value="${m.name}">${m.name}</option>`).join('') : 
                '<option value="">담당 회원 없음</option>';
        }
        
        // 트레이너 변경 시 회원 목록 업데이트 함수 (30분 세션)
        async function update30minMemberDropdown(selectedTrainer) {
            const memberSel = document.getElementById('tmc-30min-member-select');
            const filteredMembers = members.filter(m => 
                m.trainer === selectedTrainer && 
                m.remainSessions > 0 && 
                m.status === '유효'
            );
            memberSel.innerHTML = filteredMembers.length ? 
                filteredMembers.map(m => `<option value="${m.name}">${m.name}</option>`).join('') : 
                '<option value="">담당 회원 없음</option>';
        }
        
        // 초기 회원 드롭다운 로딩 (현재 트레이너)
        await updateMemberDropdown(username);
        await update30minMemberDropdown(username);
        
        // 시간 드롭다운 업데이트 함수 (현재 로그인한 트레이너 기준)
        async function updateTimeDropdowns() {
            const daySessionsRes = await fetch(`/api/sessions?trainer=${encodeURIComponent(username)}&date=${yyyy}-${mm}-${dd}`);
            const daySessions = await daySessionsRes.json();
            
            // 1시간 세션 모달 시간 드롭다운 업데이트 (1시간 세션만 고려)
            const disabledTimes1Hour = getDisabledTimes(daySessions, false);
            const timeSel = document.getElementById('tmc-time-input');
            let timeOpts = '';
            for(let h=6; h<=22; h++) {
                for(let m=0; m<60; m+=30) {
                    if(h===22 && m>0) break;
                    const hh = String(h).padStart(2,'0');
                    const mm = String(m).padStart(2,'0');
                    const val = `${hh}:${mm}`;
                    timeOpts += `<option value="${val}"${disabledTimes1Hour.has(val)?' disabled':''}>${val}${disabledTimes1Hour.has(val)?' (예약불가)':''}</option>`;
                }
            }
            timeSel.innerHTML = timeOpts;
            
            // 30분 세션 모달 시간 드롭다운 업데이트 (30분 세션만 고려)
            const disabledTimes30Min = getDisabledTimes(daySessions, true);
            const time30minSel = document.getElementById('tmc-30min-time-input');
            let time30minOpts = '';
            for(let h=6; h<=22; h++) {
                for(let m=0; m<60; m+=30) {
                    if(h===22 && m>0) break;
                    const hh = String(h).padStart(2,'0');
                    const mm = String(m).padStart(2,'0');
                    const val = `${hh}:${mm}`;
                    time30minOpts += `<option value="${val}"${disabledTimes30Min.has(val)?' disabled':''}>${val}${disabledTimes30Min.has(val)?' (예약불가)':''}</option>`;
                }
            }
            time30minSel.innerHTML = time30minOpts;
        }
        
        // 트레이너 변경 이벤트 리스너 (일반 세션)
        trainerSel.addEventListener('change', async function() {
            const selectedTrainer = this.value;
            await updateMemberDropdown(selectedTrainer);
        });
        
        // 트레이너 변경 이벤트 리스너 (30분 세션)
        trainer30minSel.addEventListener('change', async function() {
            const selectedTrainer = this.value;
            await update30minMemberDropdown(selectedTrainer);
        });
        
        // 시간 충돌 체크 함수 (모달 타입에 따라 다르게 처리)
        function getDisabledTimes(sessions, is30minModal = false) {
            const disabledTimes = new Set();
            
            sessions.forEach(s => {
                const [h, m] = s.time.split(':').map(Number);
                const is30min = s['30min'] === true;
                
                if (is30minModal) {
                    // 30분 세션 모달
                    if (is30min) {
                        // 30분 세션: 해당 시간만 제외
                        disabledTimes.add(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
                    } else {
                        // 1시간 세션: 해당 시간과 해당 세션 이후 30분 제외
                        disabledTimes.add(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
                        
                        // 이후 30분 (22:00 초과하지 않는 경우)
                        if (!(h === 22 && m === 0)) {
                            let nextH = h, nextM = m + 30;
                            if (nextM >= 60) { nextH++; nextM = 0; }
                            if (nextH <= 22) {
                                disabledTimes.add(`${String(nextH).padStart(2,'0')}:${String(nextM).padStart(2,'0')}`);
                            }
                        }
                    }
                } else {
                    // 1시간 세션 모달
                    if (is30min) {
                        // 30분 세션: 해당 시간만 제외
                        disabledTimes.add(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
                    } else {
                        // 1시간 세션: 해당 시간과 이전 30분, 이후 30분 제외
                        // 이전 30분 (6:00 미만이 아닌 경우)
                        if (!(h === 6 && m === 0)) {
                            let prevH = h, prevM = m - 30;
                            if (prevM < 0) { prevH--; prevM = 30; }
                            if (prevH >= 6) {
                                disabledTimes.add(`${String(prevH).padStart(2,'0')}:${String(prevM).padStart(2,'0')}`);
                            }
                        }
                        
                        // 해당 시간
                        disabledTimes.add(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
                        
                        // 이후 30분 (22:00 초과하지 않는 경우)
                        if (!(h === 22 && m === 0)) {
                            let nextH = h, nextM = m + 30;
                            if (nextM >= 60) { nextH++; nextM = 0; }
                            if (nextH <= 22) {
                                disabledTimes.add(`${String(nextH).padStart(2,'0')}:${String(nextM).padStart(2,'0')}`);
                            }
                        }
                    }
                }
            });
            
            return disabledTimes;
        }
        
        // 해당 날짜의 세션 데이터 가져오기
        const daySessionsRes = await fetch(`/api/sessions?trainer=${encodeURIComponent(username)}&date=${yyyy}-${mm}-${dd}`);
        const daySessions = await daySessionsRes.json();
        
        // 1시간 세션 모달 시간 드롭다운 초기화 (1시간 세션만 고려)
        const disabledTimes1Hour = getDisabledTimes(daySessions, false);
        const timeSel = document.getElementById('tmc-time-input');
        let timeOpts = '';
        for(let h=6; h<=22; h++) {
            for(let m=0; m<60; m+=30) {
                if(h===22 && m>0) break;
                const hh = String(h).padStart(2,'0');
                const mm = String(m).padStart(2,'0');
                const val = `${hh}:${mm}`;
                timeOpts += `<option value="${val}"${disabledTimes1Hour.has(val)?' disabled':''}>${val}${disabledTimes1Hour.has(val)?' (예약불가)':''}</option>`;
            }
        }
        timeSel.innerHTML = timeOpts;
        
        // 30분 세션 모달 시간 드롭다운 초기화 (30분 세션만 고려)
        const disabledTimes30Min = getDisabledTimes(daySessions, true);
        const time30minSel = document.getElementById('tmc-30min-time-input');
        let time30minOpts = '';
        for(let h=6; h<=22; h++) {
            for(let m=0; m<60; m+=30) {
                if(h===22 && m>0) break;
                const hh = String(h).padStart(2,'0');
                const mm = String(m).padStart(2,'0');
                const val = `${hh}:${mm}`;
                time30minOpts += `<option value="${val}"${disabledTimes30Min.has(val)?' disabled':''}>${val}${disabledTimes30Min.has(val)?' (예약불가)':''}</option>`;
            }
        }
        time30minSel.innerHTML = time30minOpts;
        
        document.getElementById('tmc-date-input').value = `${yyyy}-${mm}-${dd}`;
        document.getElementById('tmc-30min-date-input').value = `${yyyy}-${mm}-${dd}`;
        
        // 트레이너 30분 세션 권한 확인 및 30min 버튼 표시
        const currentTrainer = allTrainers.find(t => t.username === username);
        const has30minPermission = currentTrainer && currentTrainer['30min_session'] === 'on';
        
        if (has30minPermission) {
            document.getElementById('tmc-add-30min-btn').style.display = 'block';
        }
        
        document.getElementById('tmc-add-btn').onclick = function() {
            document.getElementById('tmc-modal-bg').style.display = 'block';
            document.getElementById('tmc-modal').style.display = 'block';
        };
        
        document.getElementById('tmc-add-30min-btn').onclick = function() {
            document.getElementById('tmc-modal-bg').style.display = 'block';
            document.getElementById('tmc-30min-modal').style.display = 'block';
        };

        // 모달 닫기 함수
        function closeSessionModal() {
            document.getElementById('tmc-modal-bg').style.display = 'none';
            document.getElementById('tmc-modal').style.display = 'none';
            document.getElementById('tmc-30min-modal').style.display = 'none';
        }
        
        document.getElementById('tmc-modal-bg').onclick = function(e) {
            if (e.target === this) {
                closeSessionModal();
            }
        };
        
        // 모달 닫기 버튼 이벤트
        const modalCloseX = document.getElementById('tmc-modal-close-x');
        const modal30minCloseX = document.getElementById('tmc-30min-modal-close-x');
        if (modalCloseX) {
            modalCloseX.onclick = closeSessionModal;
        }
        if (modal30minCloseX) {
            modal30minCloseX.onclick = closeSessionModal;
        }
        
        // 반복 체크박스 이벤트
        document.getElementById('tmc-repeat-checkbox').onchange = function() {
            const repeatCountLabel = document.getElementById('tmc-repeat-count-label');
            if (this.checked) {
                repeatCountLabel.style.opacity = '1';
                repeatCountLabel.style.height = 'auto';
            } else {
                repeatCountLabel.style.opacity = '0';
                repeatCountLabel.style.height = '0';
            }
        };
        
        // 30분 세션 반복 체크박스 이벤트
        document.getElementById('tmc-30min-repeat-checkbox').onchange = function() {
            const repeatCountLabel = document.getElementById('tmc-30min-repeat-count-label');
            if (this.checked) {
                repeatCountLabel.style.opacity = '1';
                repeatCountLabel.style.height = 'auto';
            } else {
                repeatCountLabel.style.opacity = '0';
                repeatCountLabel.style.height = '0';
            }
        };
        document.getElementById('tmc-session-add-form').onsubmit = async function(e) {
          e.preventDefault();
          const form = e.target;
          const data = Object.fromEntries(new FormData(form));
          // 세션은 항상 현재 로그인한 트레이너로 등록
          data.trainer = username;
          const resultDiv = document.getElementById('tmc-session-add-result');
          resultDiv.className = 'tmc-modal-result';
          resultDiv.innerText = '처리 중...';
          try {
            const res = await fetch('/api/sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            const result = await res.json();
            if (res.ok) {
              resultDiv.className = 'tmc-modal-result success';
              resultDiv.innerText = result.message;
              
              // 반복 세션 추가 시 상세 정보 표시
              if (result.total && result.total > 1) {
                resultDiv.innerHTML += `<br><small style="color:#666;">총 ${result.total}회 중 ${result.added}회 추가됨${result.skipped > 0 ? ` (${result.skipped}회는 시간 중복으로 제외)` : ''}</small>`;
              }
              
              form.reset();
              document.getElementById('tmc-date-input').value = `${yyyy}-${mm}-${dd}`;
              document.getElementById('tmc-repeat-checkbox').checked = false;
              document.getElementById('tmc-repeat-count-label').style.opacity = '0';
              document.getElementById('tmc-repeat-count-label').style.height = '0';
              renderCalUI(container, dd); // 세션 추가 후 갱신
              setTimeout(() => {
                closeSessionModal();
              }, 1500);
            } else {
              resultDiv.className = 'tmc-modal-result error';
              resultDiv.innerText = result.message;
            }
          } catch {
            resultDiv.className = 'tmc-modal-result error';
            resultDiv.innerText = '세션 추가에 실패했습니다.';
          }
        };
        
        // 30분 세션 폼 제출 이벤트 리스너
        document.getElementById('tmc-30min-session-add-form').onsubmit = async function(e) {
          e.preventDefault();
          const form = e.target;
          const data = Object.fromEntries(new FormData(form));
          // 세션은 항상 현재 로그인한 트레이너로 등록
          data.trainer = username;
          data['30min'] = true; // 30분 세션 표시
          const resultDiv = document.getElementById('tmc-30min-session-add-result');
          resultDiv.className = 'tmc-modal-result';
          resultDiv.innerText = '처리 중...';
          try {
            const res = await fetch('/api/sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            const result = await res.json();
            if (res.ok) {
              resultDiv.className = 'tmc-modal-result success';
              resultDiv.innerText = result.message;
              
              // 반복 세션 추가 시 상세 정보 표시
              if (result.total && result.total > 1) {
                resultDiv.innerHTML += `<br><small style="color:#666;">총 ${result.total}회 중 ${result.added}회 추가됨${result.skipped > 0 ? ` (${result.skipped}회는 시간 중복으로 제외)` : ''}</small>`;
              }
              
              form.reset();
              document.getElementById('tmc-30min-date-input').value = `${yyyy}-${mm}-${dd}`;
              document.getElementById('tmc-30min-repeat-checkbox').checked = false;
              document.getElementById('tmc-30min-repeat-count-label').style.opacity = '0';
              document.getElementById('tmc-30min-repeat-count-label').style.height = '0';
              renderCalUI(container, dd); // 세션 추가 후 갱신
              setTimeout(() => {
                closeSessionModal();
              }, 1500);
            } else {
              resultDiv.className = 'tmc-modal-result error';
              resultDiv.innerText = result.message;
            }
          } catch {
            resultDiv.className = 'tmc-modal-result error';
            resultDiv.innerText = '30분 세션 추가에 실패했습니다.';
          }
        };
        // 날짜 클릭 시 해당 날짜로 이동
        container.querySelectorAll('.tmc-cal-table td[data-day]').forEach(td => {
          td.onclick = function() {
            if (td.textContent) {
              calState.today = Number(td.getAttribute('data-day'));
              renderCalUI(container, td.getAttribute('data-day').padStart(2, '0'));
            }
          };
        });
        // 모바일 스와이프 이벤트(좌우) - 세션카드 영역 제외
        let startX = null;
        const calWrap = container.querySelector('.trainer-mobile-cal-wrap');
        const sessionList = container.querySelector('.tmc-session-list');
        calWrap.addEventListener('touchstart', e => {
            if (sessionList.contains(e.target)) return;
            if (e.touches.length === 1) startX = e.touches[0].clientX;
        });
        calWrap.addEventListener('touchend', e => {
            if (sessionList.contains(e.target)) return;
            if (startX === null) return;
            const endX = e.changedTouches[0].clientX;
            const dx = endX - startX;
            if (Math.abs(dx) > 40) {
                if (dx < 0) {
                    // 다음달로 이동 (안전한 월 변경)
                    if (calState.month === 12) {
                        calState.month = 1;
                        calState.year++;
                    } else {
                        calState.month++;
                    }
                    // 날짜 유효성 검사 및 조정
                    adjustDateForMonthChange();
                    renderCalUI(container);
                } else {
                    // 이전달로 이동 (안전한 월 변경)
                    if (calState.month === 1) {
                        calState.month = 12;
                        calState.year--;
                    } else {
                        calState.month--;
                    }
                    // 날짜 유효성 검사 및 조정
                    adjustDateForMonthChange();
                    renderCalUI(container);
                }
            }
            startX = null;
        });
        // 세션카드 클릭 시 출석체크 모달
        container.querySelectorAll('.tmc-session-item').forEach(card => {
          if(card.classList.contains('done')) return;
          card.onclick = function() {
            const sessionId = card.getAttribute('data-id');
            const hasNoRemaining = card.getAttribute('data-no-remaining') === 'true';
            showAttendModal(sessionId, container, hasNoRemaining);
          };
        });
      } catch (e) {
        console.error("Error rendering calendar UI:", e);
        if (container) container.innerHTML = '<div style="color:#d32f2f;">달력을 불러오지 못했습니다.</div>';
      }
}

function renderSimpleMonth(year, month, today) {
    // month: '06' 형태
    const m = Number(month);
    
    // 날짜 유효성 검사
    if (m < 1 || m > 12) {
        console.error(`Invalid month: ${m}`);
        return '';
    }
    
    const first = new Date(year, m-1, 1);
    const last = new Date(year, m, 0);
    
    // 날짜 객체 유효성 검사
    if (isNaN(first.getTime()) || isNaN(last.getTime())) {
        console.error(`Invalid date range for year: ${year}, month: ${m}`);
        return '';
    }
    
    let html = '';
    let day = 1 - first.getDay();
    for (let w=0; w<6; w++) {
        html += '<tr>';
        for (let d=0; d<7; d++, day++) {
            if (day < 1 || day > last.getDate()) {
                html += '<td></td>';
            } else {
                const isToday = String(day).padStart(2,'0') === today;
                html += `<td${isToday ? ' class="tmc-today"' : ''}>${day}</td>`;
            }
        }
        html += '</tr>';
        if (day > last.getDate()) break;
    }
    return html;
}

function renderSimpleMonthWithDots(year, month, today, sessionDayInfo) {
    const m = Number(month);
    
    // 날짜 유효성 검사
    if (m < 1 || m > 12) {
        console.error(`Invalid month: ${m}`);
        return '';
    }
    
    const first = new Date(year, m-1, 1);
    const last = new Date(year, m, 0);
    
    // 날짜 객체 유효성 검사
    if (isNaN(first.getTime()) || isNaN(last.getTime())) {
        console.error(`Invalid date range for year: ${year}, month: ${m}`);
        return '';
    }
    
    let html = '';
    let day = 1 - first.getDay();
    for (let w=0; w<6; w++) {
        html += '<tr>';
        for (let d=0; d<7; d++, day++) {
            if (day < 1 || day > last.getDate()) {
                html += '<td></td>';
            } else {
                const dayStr = String(day).padStart(2,'0');
                const isToday = dayStr === today;
                const dayInfo = sessionDayInfo[dayStr];
                
                let dotHtml = '<div style="height:1.1em;"></div>';
                if (dayInfo && dayInfo.hasSession) {
                    const dotColor = dayInfo.hasAbsent ? '#ff6b6b' : '#1de9b6'; // 결석이 있으면 연한 빨간색, 없으면 초록색
                    dotHtml = `<div style="margin-top:2px;font-size:1.1em;color:${dotColor};line-height:1;">●</div>`;
                }
                
                html += `<td data-day="${dayStr}"${isToday ? ' class="tmc-today"' : ''}><div>${day}</div>${dotHtml}</td>`;
            }
        }
        html += '</tr>';
        if (day > last.getDate()) break;
    }
    return html;
}

// 지출 내역 추가 버튼 설정 (캘린더 화면용)
function setupExpenseAddButton(username) {
    const addExpenseBtn = document.getElementById('tmc-add-expense-btn');
    if (!addExpenseBtn) return;
    
    addExpenseBtn.onclick = () => {
        showExpenseAddModal(username);
    };
}

// 지출 내역 추가 모달 표시
async function showExpenseAddModal(username) {
    const modalBg = document.getElementById('expenseAddModalBg');
    const modal = document.getElementById('expenseAddModal');
    const form = document.getElementById('expenseAddForm');
    const resultDiv = document.getElementById('expenseAddResult');
    const trainersListDiv = document.getElementById('expense-trainers-list');
    const datetimeInput = document.getElementById('expense-datetime');
    const expenseTypeMeal = document.getElementById('expense-type-meal');
    const expenseTypePurchase = document.getElementById('expense-type-purchase');
    const expenseTypePersonal = document.getElementById('expense-type-personal');
    const purchaseItemRow = document.getElementById('expense-purchase-item-row');
    const personalItemRow = document.getElementById('expense-personal-item-row');
    const trainersRow = document.getElementById('expense-trainers-row');
    const centerRow = document.getElementById('expense-center-row');
    const personalCenterRow = document.getElementById('expense-personal-center-row');
    const centerSelect = document.getElementById('expense-center');
    const personalCenterSelect = document.getElementById('expense-personal-center');
    
    // 세션 추가 버튼들 숨기기 (모달이 열렸을 때)
    const sessionAddBtn = document.getElementById('tmc-add-btn');
    const session30minBtn = document.getElementById('tmc-add-30min-btn');
    if (sessionAddBtn) sessionAddBtn.style.display = 'none';
    if (session30minBtn && session30minBtn.style.display !== 'none') {
        session30minBtn.dataset.wasVisible = 'true';
        session30minBtn.style.display = 'none';
    }
    
    // 모달 표시
    modalBg.style.display = 'block';
    modal.style.display = 'block';
    
    // 결과 메시지 초기화
    resultDiv.textContent = '';
    
    // 지출 유형 기본값: 식대
    expenseTypeMeal.checked = true;
    expenseTypePurchase.checked = false;
    updateExpenseTypeFields();
    
    // 현재 시간을 기본값으로 설정 (datetime-local 형식)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    datetimeInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    // 입력 필드 초기화
    document.getElementById('expense-amount').value = '';
    document.getElementById('expense-purchase-item').value = '';
    document.getElementById('expense-personal-item').value = '';
    centerSelect.value = '';
    personalCenterSelect.value = '';
    
    // 금액 입력 필드에 콤마 포맷팅 추가
    const amountInput = document.getElementById('expense-amount');
    // input 타입을 text로 변경 (number 타입은 콤마를 허용하지 않음)
    amountInput.type = 'text';
    amountInput.setAttribute('inputmode', 'numeric'); // 모바일에서 숫자 키패드 표시
    
    amountInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/,/g, ''); // 기존 콤마 제거
        if (value === '') {
            e.target.value = '';
            return;
        }
        // 숫자만 허용 (문자 제거)
        value = value.replace(/\D/g, '');
        
        if (value === '') {
            e.target.value = '';
            return;
        }
        
        // 천 단위 콤마 추가
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue)) {
            e.target.value = numValue.toLocaleString('ko-KR');
        } else {
            e.target.value = '';
        }
    });
    
    // 지출 유형 변경 이벤트
    expenseTypeMeal.onchange = updateExpenseTypeFields;
    expenseTypePurchase.onchange = updateExpenseTypeFields;
    expenseTypePersonal.onchange = updateExpenseTypeFields;
    
    // 지출 유형에 따른 필드 표시/숨김
    function updateExpenseTypeFields() {
        const isMeal = expenseTypeMeal.checked;
        const isPurchase = expenseTypePurchase.checked;
        const isPersonal = expenseTypePersonal.checked;
        
        if (isMeal) {
            // 식대: 트레이너 목록 표시, 구매물품/센터/본인지출 필드 숨김
            purchaseItemRow.style.display = 'none';
            personalItemRow.style.display = 'none';
            trainersRow.style.display = 'block';
            centerRow.style.display = 'none';
            personalCenterRow.style.display = 'none';
            document.getElementById('expense-purchase-item').removeAttribute('required');
            document.getElementById('expense-personal-item').removeAttribute('required');
            centerSelect.removeAttribute('required');
            personalCenterSelect.removeAttribute('required');
        } else if (isPurchase) {
            // 구매: 구매물품/센터 표시, 트레이너 목록/본인지출 필드 숨김
            purchaseItemRow.style.display = 'block';
            personalItemRow.style.display = 'none';
            trainersRow.style.display = 'none';
            centerRow.style.display = 'block';
            personalCenterRow.style.display = 'none';
            document.getElementById('expense-purchase-item').setAttribute('required', 'required');
            document.getElementById('expense-personal-item').removeAttribute('required');
            centerSelect.setAttribute('required', 'required');
            personalCenterSelect.removeAttribute('required');
        } else if (isPersonal) {
            // 개인지출: 지출내역/센터 표시, 다른 필드 숨김
            purchaseItemRow.style.display = 'none';
            personalItemRow.style.display = 'block';
            trainersRow.style.display = 'none';
            centerRow.style.display = 'none';
            personalCenterRow.style.display = 'block';
            document.getElementById('expense-purchase-item').removeAttribute('required');
            document.getElementById('expense-personal-item').setAttribute('required', 'required');
            centerSelect.removeAttribute('required');
            personalCenterSelect.setAttribute('required', 'required');
        }
    }
    
    // 트레이너 목록 로드 및 체크박스 생성
    try {
        const res = await fetch('/api/trainers');
        const trainers = await res.json();
        
        if (trainers.length === 0) {
            trainersListDiv.innerHTML = '<div class="tmc-no-trainers">트레이너가 없습니다.</div>';
        } else {
            let html = '';
            trainers.forEach(trainer => {
                const isCurrentUser = trainer.username === username;
                // 이름에서 "(아이디)" 형식 제거하여 이름만 표시
                const nameOnly = trainer.name ? trainer.name.replace(/\s*\([^)]*\)\s*$/, '').trim() : trainer.username;
                html += `<label class="tmc-trainer-checkbox">
                    <input type="checkbox" name="participantTrainers" value="${trainer.username}" 
                           ${isCurrentUser ? 'checked disabled' : ''}>
                    <span>${nameOnly}</span>
                    ${isCurrentUser ? '<span class="tmc-current-user">(본인)</span>' : ''}
                </label>`;
            });
            trainersListDiv.innerHTML = html;
        }
    } catch (error) {
        console.error('트레이너 목록 로드 오류:', error);
            trainersListDiv.innerHTML = '<div class="tmc-modal-result error">트레이너 목록을 불러오지 못했습니다.</div>';
    }
    
    // 센터 목록 로드 (구매용)
    try {
        const res = await fetch('/api/centers');
        const centers = await res.json();
        
        centerSelect.innerHTML = '<option value="">센터를 선택하세요</option>';
        centers.forEach(center => {
            const option = document.createElement('option');
            option.value = center.name;
            option.textContent = center.name;
            centerSelect.appendChild(option);
        });
    } catch (error) {
        console.error('센터 목록 로드 오류:', error);
        centerSelect.innerHTML = '<option value="">센터 목록을 불러오지 못했습니다.</option>';
    }
    
    // 센터 목록 로드 (본인지출용)
    try {
        const res = await fetch('/api/centers');
        const centers = await res.json();
        
        personalCenterSelect.innerHTML = '<option value="">센터를 선택하세요</option>';
        centers.forEach(center => {
            const option = document.createElement('option');
            option.value = center.name;
            option.textContent = center.name;
            personalCenterSelect.appendChild(option);
        });
    } catch (error) {
        console.error('센터 목록 로드 오류:', error);
        personalCenterSelect.innerHTML = '<option value="">센터 목록을 불러오지 못했습니다.</option>';
    }
    
    // 폼 제출 이벤트
    form.onsubmit = async (e) => {
        e.preventDefault();
        
        let expenseType;
        if (expenseTypeMeal.checked) {
            expenseType = 'meal';
        } else if (expenseTypePurchase.checked) {
            expenseType = 'purchase';
        } else if (expenseTypePersonal.checked) {
            expenseType = 'personal';
        } else {
            resultDiv.className = 'tmc-modal-result error';
            resultDiv.textContent = '지출 유형을 선택해주세요.';
            return;
        }
        const datetime = datetimeInput.value;
        // 금액에서 콤마 제거 후 숫자로 변환
        const amountValue = document.getElementById('expense-amount').value.replace(/,/g, '');
        const amount = parseInt(amountValue);
        
        // 유효성 검사
        if (!datetime) {
            resultDiv.className = 'tmc-modal-result error';
            resultDiv.textContent = '시각을 입력해주세요.';
            return;
        }
        
        if (isNaN(amount) || amount < 0) {
            resultDiv.className = 'tmc-modal-result error';
            resultDiv.textContent = '올바른 금액을 입력해주세요.';
            return;
        }
        
        let requestBody = {
            trainer: username,
            expenseType: expenseType,
            amount: amount,
            datetime: datetime
        };
        
        if (expenseType === 'meal') {
            // 식대: 함께한 트레이너 필수
            const checkboxes = form.querySelectorAll('input[name="participantTrainers"]:checked');
            if (checkboxes.length === 0) {
                resultDiv.className = 'tmc-modal-result error';
                resultDiv.textContent = '함께한 트레이너를 최소 1명 이상 선택해주세요.';
                return;
            }
            const participantTrainers = Array.from(checkboxes).map(cb => cb.value);
            requestBody.participantTrainers = participantTrainers;
        } else if (expenseType === 'purchase') {
            // 구매: 구매물품, 센터 필수
            const purchaseItem = document.getElementById('expense-purchase-item').value.trim();
            const center = centerSelect.value;
            
            if (!purchaseItem) {
                resultDiv.className = 'tmc-modal-result error';
                resultDiv.textContent = '구매물품을 입력해주세요.';
                return;
            }
            
            if (!center) {
                resultDiv.className = 'tmc-modal-result error';
                resultDiv.textContent = '센터를 선택해주세요.';
                return;
            }
            
            requestBody.purchaseItem = purchaseItem;
            requestBody.center = center;
        } else if (expenseType === 'personal') {
            // 개인지출: 지출내역, 센터 필수
            const personalItem = document.getElementById('expense-personal-item').value.trim();
            const personalCenter = personalCenterSelect.value;
            
            if (!personalItem) {
                resultDiv.className = 'tmc-modal-result error';
                resultDiv.textContent = '지출내역을 입력해주세요.';
                return;
            }
            
            if (!personalCenter) {
                resultDiv.className = 'tmc-modal-result error';
                resultDiv.textContent = '센터를 선택해주세요.';
                return;
            }
            
            requestBody.personalItem = personalItem;
            requestBody.center = personalCenter;
        }
        
        // API 호출
        try {
            const res = await fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            
            const result = await res.json();
            
            if (res.ok) {
                resultDiv.className = 'tmc-modal-result success';
                resultDiv.textContent = '지출 내역이 등록되었습니다.';
                
                // 1.5초 후 모달 닫기
                setTimeout(() => {
                    closeExpenseAddModal();
                }, 1500);
            } else {
                resultDiv.className = 'tmc-modal-result error';
                resultDiv.textContent = result.message || '지출 내역 등록에 실패했습니다.';
            }
        } catch (error) {
            console.error('지출 내역 등록 오류:', error);
            resultDiv.className = 'tmc-modal-result error';
            resultDiv.textContent = '지출 내역 등록 중 오류가 발생했습니다.';
        }
    };
    
    // 닫기 버튼 (X) 이벤트
    const closeXBtn = document.getElementById('expenseAddModalCloseX');
    if (closeXBtn) closeXBtn.onclick = closeExpenseAddModal;
    
    // 모달 배경 클릭 시 닫기
    modalBg.onclick = (e) => {
        if (e.target === modalBg) {
            closeExpenseAddModal();
        }
    };
}

// 지출 내역 추가 모달 닫기
function closeExpenseAddModal() {
    const modalBg = document.getElementById('expenseAddModalBg');
    const modal = document.getElementById('expenseAddModal');
    const form = document.getElementById('expenseAddForm');
    const resultDiv = document.getElementById('expenseAddResult');
    
    modalBg.style.display = 'none';
    modal.style.display = 'none';
    form.reset();
    resultDiv.textContent = '';
    
    // 지출 유형 기본값으로 리셋
    document.getElementById('expense-type-meal').checked = true;
    document.getElementById('expense-type-purchase').checked = false;
    document.getElementById('expense-type-personal').checked = false;
    document.getElementById('expense-purchase-item-row').style.display = 'none';
    document.getElementById('expense-personal-item-row').style.display = 'none';
    document.getElementById('expense-trainers-row').style.display = 'block';
    document.getElementById('expense-center-row').style.display = 'none';
    document.getElementById('expense-personal-center-row').style.display = 'none';
    
    // 세션 추가 버튼들 다시 표시 (모달이 닫혔을 때)
    const sessionAddBtn = document.getElementById('tmc-add-btn');
    const session30minBtn = document.getElementById('tmc-add-30min-btn');
    if (sessionAddBtn) sessionAddBtn.style.display = 'flex';
    // 30분 버튼은 원래 표시되어 있었으면 다시 표시
    if (session30minBtn && session30minBtn.dataset.wasVisible === 'true') {
        session30minBtn.style.display = 'block';
        delete session30minBtn.dataset.wasVisible;
    }
}

// 프로필 사진 업로드 관련 변수
let currentProfileImageUsername = null;
let currentProfileImageUrl = null;
let cropImage = null; // 원본 이미지 객체
let cropCanvas = null;
let cropCtx = null;
let previewCanvas = null;
let previewCtx = null;
let cropCircle = null;
let cropRadius = 100; // 크롭 원의 반지름
let cropX = 0; // 크롭 원의 중심 X
let cropY = 0; // 크롭 원의 중심 Y
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

// 프로필 사진 모달 열기
function openProfileImageModal(username, name) {
    currentProfileImageUsername = username;
    document.getElementById('profileImageTrainerName').textContent = `${name} (${username})`;
    
    // 초기화
    cropImage = null;
    cropRadius = 100;
    cropX = 0;
    cropY = 0;
    
    // 캔버스 초기화
    cropCanvas = document.getElementById('profileImageCropCanvas');
    cropCtx = cropCanvas.getContext('2d');
    previewCanvas = document.getElementById('profileImagePreviewCanvas');
    previewCtx = previewCanvas.getContext('2d');
    cropCircle = document.getElementById('profileImageCropCircle');
    
    // 현재 프로필 사진 로드
    fetch(`/api/trainers?username=${encodeURIComponent(username)}`)
        .then(res => res.json())
        .then(trainers => {
            const trainer = trainers[0];
            if (trainer && trainer.profile_image_url) {
                currentProfileImageUrl = trainer.profile_image_url;
                document.getElementById('profileImageCurrentImg').src = trainer.profile_image_url;
                document.getElementById('profileImageCurrentImg').style.display = 'block';
                document.getElementById('profileImageCurrentPlaceholder').style.display = 'none';
                document.getElementById('deleteProfileImageBtn').style.display = 'inline-block';
            } else {
                currentProfileImageUrl = null;
                document.getElementById('profileImageCurrentImg').style.display = 'none';
                document.getElementById('profileImageCurrentPlaceholder').style.display = 'flex';
                document.getElementById('deleteProfileImageBtn').style.display = 'none';
            }
        });
    
    // 파일 선택 시 이미지 크롭 영역 표시
    document.getElementById('profileImageFileInput').onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    cropImage = img;
                    setupCropArea();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    };
    
    // 모달 배경 클릭 시 닫기
    document.getElementById('trainerProfileImageModalBg').onclick = function(e) {
        if (e.target === this) {
            closeProfileImageModal();
        }
    };
    
    document.getElementById('trainerProfileImageModalBg').style.display = 'block';
    document.getElementById('trainerProfileImageModal').style.display = 'block';
}

function setupCropArea() {
    if (!cropImage) return;
    
    // 캔버스 크기 설정 (이미지 비율 유지)
    const maxWidth = 500;
    const maxHeight = 400;
    let canvasWidth = cropImage.width;
    let canvasHeight = cropImage.height;
    
    if (canvasWidth > maxWidth) {
        canvasHeight = (canvasHeight * maxWidth) / canvasWidth;
        canvasWidth = maxWidth;
    }
    if (canvasHeight > maxHeight) {
        canvasWidth = (canvasWidth * maxHeight) / canvasHeight;
        canvasHeight = maxHeight;
    }
    
    cropCanvas.width = canvasWidth;
    cropCanvas.height = canvasHeight;
    
    // 이미지 그리기
    cropCtx.drawImage(cropImage, 0, 0, canvasWidth, canvasHeight);
    
    // 크롭 원 초기 위치 설정 (중앙)
    cropX = canvasWidth / 2;
    cropY = canvasHeight / 2;
    cropRadius = Math.min(canvasWidth, canvasHeight) * 0.3; // 이미지 크기의 30%
    
    // 크롭 영역 표시
    document.getElementById('profileImageCropArea').style.display = 'block';
    document.getElementById('profileImagePreviewArea').style.display = 'block';
    document.getElementById('profileImageFileSelectArea').style.display = 'none';
    document.getElementById('profileImageCurrentPreview').style.display = 'none';
    document.getElementById('uploadProfileImageBtn').style.display = 'inline-block';
    
    updateCropCircle();
    updatePreview();
    setupCropEvents();
}

function updateCropCircle() {
    if (!cropCircle) return;
    cropCircle.style.width = (cropRadius * 2) + 'px';
    cropCircle.style.height = (cropRadius * 2) + 'px';
    cropCircle.style.left = (cropX - cropRadius) + 'px';
    cropCircle.style.top = (cropY - cropRadius) + 'px';
}

function updatePreview() {
    if (!cropImage || !previewCanvas || !previewCtx) return;
    
    // 원본 이미지에서 크롭 영역 추출
    const sourceX = (cropX - cropRadius) * (cropImage.width / cropCanvas.width);
    const sourceY = (cropY - cropRadius) * (cropImage.height / cropCanvas.height);
    const sourceSize = (cropRadius * 2) * (cropImage.width / cropCanvas.width);
    
    // 미리보기 캔버스에 원형으로 그리기
    previewCanvas.width = 150;
    previewCanvas.height = 150;
    
    previewCtx.save();
    previewCtx.beginPath();
    previewCtx.arc(75, 75, 75, 0, Math.PI * 2);
    previewCtx.clip();
    previewCtx.drawImage(
        cropImage,
        sourceX, sourceY, sourceSize, sourceSize,
        0, 0, 150, 150
    );
    previewCtx.restore();
}

function setupCropEvents() {
    // 드래그 시작
    cropCanvas.addEventListener('mousedown', function(e) {
        const rect = cropCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // 크롭 원 내부인지 확인
        const dx = x - cropX;
        const dy = y - cropY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= cropRadius) {
            isDragging = true;
            dragStartX = x - cropX;
            dragStartY = y - cropY;
        }
    });
    
    // 드래그 중
    cropCanvas.addEventListener('mousemove', function(e) {
        if (isDragging) {
            const rect = cropCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            cropX = x - dragStartX;
            cropY = y - dragStartY;
            
            // 경계 체크
            cropX = Math.max(cropRadius, Math.min(cropCanvas.width - cropRadius, cropX));
            cropY = Math.max(cropRadius, Math.min(cropCanvas.height - cropRadius, cropY));
            
            updateCropCircle();
            updatePreview();
        }
    });
    
    // 드래그 종료
    cropCanvas.addEventListener('mouseup', function() {
        isDragging = false;
    });
    
    cropCanvas.addEventListener('mouseleave', function() {
        isDragging = false;
    });
    
    // 휠로 크기 조절
    cropCanvas.addEventListener('wheel', function(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -10 : 10;
        const minRadius = 50;
        const maxRadius = Math.min(cropCanvas.width, cropCanvas.height) / 2;
        
        cropRadius = Math.max(minRadius, Math.min(maxRadius, cropRadius + delta));
        
        // 크기 변경 시 위치 조정 (경계 내에 유지)
        cropX = Math.max(cropRadius, Math.min(cropCanvas.width - cropRadius, cropX));
        cropY = Math.max(cropRadius, Math.min(cropCanvas.height - cropRadius, cropY));
        
        updateCropCircle();
        updatePreview();
    });
    
    // 터치 이벤트 (모바일)
    let touchStartDistance = 0;
    cropCanvas.addEventListener('touchstart', function(e) {
        if (e.touches.length === 1) {
            const rect = cropCanvas.getBoundingClientRect();
            const x = e.touches[0].clientX - rect.left;
            const y = e.touches[0].clientY - rect.top;
            
            const dx = x - cropX;
            const dy = y - cropY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= cropRadius) {
                isDragging = true;
                dragStartX = x - cropX;
                dragStartY = y - cropY;
            }
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            touchStartDistance = Math.sqrt(dx * dx + dy * dy);
        }
    });
    
    cropCanvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        if (e.touches.length === 1 && isDragging) {
            const rect = cropCanvas.getBoundingClientRect();
            const x = e.touches[0].clientX - rect.left;
            const y = e.touches[0].clientY - rect.top;
            
            cropX = x - dragStartX;
            cropY = y - dragStartY;
            
            cropX = Math.max(cropRadius, Math.min(cropCanvas.width - cropRadius, cropX));
            cropY = Math.max(cropRadius, Math.min(cropCanvas.height - cropRadius, cropY));
            
            updateCropCircle();
            updatePreview();
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            const delta = distance - touchStartDistance;
            const minRadius = 50;
            const maxRadius = Math.min(cropCanvas.width, cropCanvas.height) / 2;
            
            cropRadius = Math.max(minRadius, Math.min(maxRadius, cropRadius + delta * 0.1));
            cropX = Math.max(cropRadius, Math.min(cropCanvas.width - cropRadius, cropX));
            cropY = Math.max(cropRadius, Math.min(cropCanvas.height - cropRadius, cropY));
            
            touchStartDistance = distance;
            updateCropCircle();
            updatePreview();
        }
    });
    
    cropCanvas.addEventListener('touchend', function() {
        isDragging = false;
    });
}

function closeProfileImageModal() {
    document.getElementById('trainerProfileImageModalBg').style.display = 'none';
    document.getElementById('trainerProfileImageModal').style.display = 'none';
    document.getElementById('profileImageFileInput').value = '';
    document.getElementById('profileImageResult').innerHTML = '';
    document.getElementById('profileImageCropArea').style.display = 'none';
    document.getElementById('profileImagePreviewArea').style.display = 'none';
    document.getElementById('profileImageFileSelectArea').style.display = 'block';
    document.getElementById('profileImageCurrentPreview').style.display = 'block';
    document.getElementById('uploadProfileImageBtn').style.display = 'none';
    
    // 상태 초기화
    currentProfileImageUsername = null;
    currentProfileImageUrl = null;
    cropImage = null;
    cropRadius = 100;
    cropX = 0;
    cropY = 0;
    isDragging = false;
}

async function uploadProfileImage() {
    if (!cropImage) {
        alert('이미지를 선택해주세요.');
        return;
    }
    
    // 크롭된 이미지를 원형으로 변환하여 Blob 생성
    const croppedImageBlob = await getCroppedImageBlob();
    
    if (!croppedImageBlob) {
        alert('이미지 처리 중 오류가 발생했습니다.');
        return;
    }
    
    const formData = new FormData();
    formData.append('image', croppedImageBlob, 'profile.jpg');
    formData.append('currentUser', localStorage.getItem('username'));
    
    const resultDiv = document.getElementById('profileImageResult');
    resultDiv.innerHTML = '업로드 중...';
    resultDiv.style.color = '#666';
    resultDiv.style.fontSize = '14px';
    
    try {
        const res = await fetch(`/api/trainers/${encodeURIComponent(currentProfileImageUsername)}/profile-image`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        
        if (res.ok && data.message) {
            resultDiv.innerHTML = data.message;
            resultDiv.style.color = '#4caf50';
            setTimeout(() => {
                closeProfileImageModal();
                loadList(); // 목록 새로고침
            }, 1000);
        } else {
            resultDiv.innerHTML = data.message || '업로드에 실패했습니다.';
            resultDiv.style.color = '#d32f2f';
        }
    } catch (error) {
        console.error('프로필 사진 업로드 오류:', error);
        resultDiv.innerHTML = '업로드 중 오류가 발생했습니다.';
        resultDiv.style.color = '#d32f2f';
    }
}

function getCroppedImageBlob() {
    if (!cropImage || !cropCanvas) return Promise.resolve(null);
    
    // 원본 이미지에서 크롭 영역 추출
    const sourceX = (cropX - cropRadius) * (cropImage.width / cropCanvas.width);
    const sourceY = (cropY - cropRadius) * (cropImage.height / cropCanvas.height);
    const sourceSize = (cropRadius * 2) * (cropImage.width / cropCanvas.width);
    
    // 임시 캔버스에 원형으로 그리기
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 400; // 최종 이미지 크기
    tempCanvas.height = 400;
    const tempCtx = tempCanvas.getContext('2d');
    
    // 원형 클리핑
    tempCtx.save();
    tempCtx.beginPath();
    tempCtx.arc(200, 200, 200, 0, Math.PI * 2);
    tempCtx.clip();
    tempCtx.drawImage(
        cropImage,
        sourceX, sourceY, sourceSize, sourceSize,
        0, 0, 400, 400
    );
    tempCtx.restore();
    
    // Blob으로 변환
    return new Promise((resolve) => {
        tempCanvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/jpeg', 0.9);
    });
}

async function deleteProfileImage() {
    if (!confirm('프로필 사진을 삭제하시겠습니까?')) {
        return;
    }
    
    const resultDiv = document.getElementById('profileImageResult');
    resultDiv.innerHTML = '삭제 중...';
    resultDiv.style.color = '#666';
    resultDiv.style.fontSize = '14px';
    
    try {
        const res = await fetch(`/api/trainers/${encodeURIComponent(currentProfileImageUsername)}/profile-image`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                currentUser: localStorage.getItem('username')
            })
        });
        const data = await res.json();
        
        if (res.ok && data.message) {
            resultDiv.innerHTML = data.message;
            resultDiv.style.color = '#4caf50';
            setTimeout(() => {
                closeProfileImageModal();
                loadList(); // 목록 새로고침
            }, 1000);
        } else {
            resultDiv.innerHTML = data.message || '삭제에 실패했습니다.';
            resultDiv.style.color = '#d32f2f';
        }
    } catch (error) {
        console.error('프로필 사진 삭제 오류:', error);
        resultDiv.innerHTML = '삭제 중 오류가 발생했습니다.';
        resultDiv.style.color = '#d32f2f';
    }
}

// 전역 함수로 등록 (HTML에서 onclick으로 호출하기 위해)
window.openProfileImageModal = openProfileImageModal;
window.closeProfileImageModal = closeProfileImageModal;
window.uploadProfileImage = uploadProfileImage;
window.deleteProfileImage = deleteProfileImage;

export const trainer = { loadList, renderMyMembers, renderSessionCalendar };

function showAttendModal(sessionId, container, hasNoRemaining = false) {
  // 스크롤 방지
  document.body.style.overflow = 'hidden';
  
  let modalBg = document.createElement('div');
  modalBg.className = 'tmc-modal-bg';
  // 인라인 스타일은 최소화하고 CSS 클래스 사용
  
  let modal = document.createElement('div');
  modal.className = 'tmc-modal';
  // 인라인 스타일은 최소화하고 CSS 클래스 사용
  
  // 버튼 disabled 속성 설정
  const attendDisabled = hasNoRemaining ? 'disabled' : '';
  const changeDisabled = hasNoRemaining ? 'disabled' : '';
  
  modal.innerHTML = `
    <div class="tmc-modal-content" id="attend-modal-content">
      <div class="tmc-modal-header">
      <h3>세션 관리</h3>
        <button class="tmc-modal-close-btn" id="attend-modal-close-x" aria-label="닫기">×</button>
      </div>
      ${hasNoRemaining ? '<div class="tmc-warning-message">⚠️ 잔여세션이 부족하여 출석/변경이 불가능합니다.</div>' : ''}
      <div class="tmc-modal-form">
      <div class="tmc-modal-btn-row" id="attend-btn-row">
        <button id="attend-btn" ${attendDisabled}>출석</button>
        <button id="change-btn" ${changeDisabled}>변경</button>
        <button id="delete-btn">취소</button>
      </div>
      <div id="attend-modal-body"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modalBg);
  document.body.appendChild(modal);
  
  // 배경 클릭 시 닫기
  modalBg.onclick = close;
  
  // ESC 키로 닫기
  const escHandler = function(e) {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', escHandler);
  
  // 닫기 버튼
  const closeXBtn = document.getElementById('attend-modal-close-x');
  if (closeXBtn) closeXBtn.onclick = close;
  // 출석 버튼
  document.getElementById('attend-btn').onclick = function() {
    if (hasNoRemaining) return;
    document.getElementById('attend-btn-row').style.display = 'none';
    renderSignBody(sessionId, hasNoRemaining);
  };
  // 변경 버튼
  document.getElementById('change-btn').onclick = function() {
    if (hasNoRemaining) return;
    document.getElementById('attend-btn-row').style.display = 'none';
    renderChangeBody(sessionId);
  };
  // 삭제 버튼
  document.getElementById('delete-btn').onclick = function() {
    document.getElementById('attend-btn-row').style.display = 'none';
    renderDeleteBody(sessionId);
  };
  // 출석(사인) 화면
  function renderSignBody(sessionId, hasNoRemaining) {
    // 잔여세션 표시를 위해 세션 정보와 회원 정보 불러오기
    Promise.all([
      fetch(`/api/sessions?trainer=${encodeURIComponent(localStorage.getItem('username'))}`).then(r=>r.json()),
      fetch('/api/members').then(r=>r.json()),
      fetch('/api/trainers').then(r=>r.json())
    ]).then(([allSessions, members, trainers]) => {
      const session = allSessions.find(s => s.id === sessionId);
      if (!session) return;
      
      const member = members.find(m => m.name === session.member);
      const remain = member && member.remainSessions !== undefined ? member.remainSessions : '?';
      
      // VIP 표시 로직
      const currentTrainer = trainers.find(t => t.username === localStorage.getItem('username'));
      const trainerHasVip = currentTrainer && currentTrainer.vip_member;
      const memberHasVip = member && member.vip_session > 0;
      
      let vipDisplay = '';
      if (trainerHasVip && memberHasVip) {
        vipDisplay = `<span class="tmc-vip-badge">VIP ${member.vip_session}회</span>`;
      }
      
      document.getElementById('attend-modal-body').innerHTML = `
        <div class="tmc-session-info-row">
          <div>${vipDisplay}</div>
          <span class="tmc-remain-sessions">잔여세션 ${remain}회</span>
        </div>
        <div class="tmc-session-member-greeting">
          <span>${session.member} 회원님! 수고하셨습니다!</span>
        </div>
        <div class="tmc-canvas-container">
          <canvas id="attend-sign-canvas" width="240" height="140"></canvas>
        </div>
        <div class="tmc-modal-actions">
          <button id="attend-sign-ok" class="tmc-modal-submit-btn">확인</button>
        </div>
        <div id="attend-result" class="tmc-modal-result"></div>
      `;
      
      // 사인 캔버스 (마우스+터치)
      const canvas = document.getElementById('attend-sign-canvas');
      let drawing = false, lastX = 0, lastY = 0;
      canvas.onmousedown = e => { drawing = true; lastX = e.offsetX; lastY = e.offsetY; canvas.getContext('2d').moveTo(e.offsetX, e.offsetY); };
      canvas.onmouseup = e => { drawing = false; };
      canvas.onmouseleave = e => { drawing = false; };
      canvas.onmousemove = e => {
        if (drawing) {
          const ctx = canvas.getContext('2d');
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#1976d2';
          ctx.lineTo(e.offsetX, e.offsetY);
          ctx.stroke();
          lastX = e.offsetX; lastY = e.offsetY;
        }
      };
      canvas.ontouchstart = function(e) {
        if (e.touches.length === 1) {
          const rect = canvas.getBoundingClientRect();
          const x = e.touches[0].clientX - rect.left;
          const y = e.touches[0].clientY - rect.top;
          drawing = true;
          lastX = x; lastY = y;
          canvas.getContext('2d').moveTo(x, y);
        }
      };
      canvas.ontouchend = function(e) { drawing = false; };
      canvas.ontouchcancel = function(e) { drawing = false; };
      canvas.ontouchmove = function(e) {
        if (drawing && e.touches.length === 1) {
          const rect = canvas.getBoundingClientRect();
          const x = e.touches[0].clientX - rect.left;
          const y = e.touches[0].clientY - rect.top;
          const ctx = canvas.getContext('2d');
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#1976d2';
          ctx.lineTo(x, y);
          ctx.stroke();
          lastX = x; lastY = y;
        }
        e.preventDefault();
      };
      
      document.getElementById('attend-sign-ok').onclick = async function() {
        const resultDiv = document.getElementById('attend-result');
        resultDiv.className = 'tmc-modal-result';
        resultDiv.innerText = '처리 중...';
        try {
          const res = await fetch(`/api/sessions/${sessionId}/attend`, { method: 'PATCH' });
          const result = await res.json();
          if (res.ok) {
            resultDiv.className = 'tmc-modal-result success';
            resultDiv.innerText = result.message;
            setTimeout(() => { close(); renderCalUI(container); }, 700);
          } else {
            resultDiv.className = 'tmc-modal-result error';
            resultDiv.innerText = result.message;
          }
        } catch {
          resultDiv.className = 'tmc-modal-result error';
          resultDiv.innerText = '출석 처리에 실패했습니다.';
        }
      };
    });
  }
  // 변경 화면
  function renderChangeBody(sessionId) {
    document.getElementById('attend-modal-body').innerHTML = `
      <form id="change-session-form">
        <div class="tmc-form-group">
          <label for="change-date-input">날짜</label>
          <input type="date" name="date" id="change-date-input" required>
        </div>
        <div class="tmc-form-group">
          <label for="change-time-input">시간</label>
          <select name="time" id="change-time-input" required></select>
        </div>
        <div id="change-session-result" class="tmc-modal-result"></div>
      </form>
      <div class="tmc-modal-actions">
        <button type="submit" form="change-session-form" class="tmc-modal-submit-btn">변경</button>
      </div>
    `;
    // 기존 세션 정보 불러오기
    fetch(`/api/sessions?trainer=${encodeURIComponent(localStorage.getItem('username'))}`)
      .then(r=>r.json())
      .then(allSessions => {
        const session = allSessions.find(s => s.id === sessionId);
        if (!session) return;
        document.getElementById('change-date-input').value = session.date;
        // 시간 드롭다운 생성(세션 타입에 따른 중복 방지)
        fetch(`/api/sessions?trainer=${encodeURIComponent(localStorage.getItem('username'))}&date=${session.date}`)
          .then(r=>r.json())
          .then(daySessions => {
            const isCurrentSession30min = session['30min'] === true;
            const disabledTimes = new Set();
            
            daySessions.filter(s=>s.id!==sessionId).forEach(s => {
              const [h, m] = s.time.split(':').map(Number);
              const is30min = s['30min'] === true;
              
              if (isCurrentSession30min) {
                // 현재 세션이 30분 세션인 경우: 30분 세션 모달 로직 적용
                if (is30min) {
                  // 30분 세션: 해당 시간만 제외
                  disabledTimes.add(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
                } else {
                  // 1시간 세션: 해당 시간과 해당 세션 이후 30분 제외
                  disabledTimes.add(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
                  
                  // 이후 30분 (22:00 초과하지 않는 경우)
                  if (!(h === 22 && m === 0)) {
                    let nextH = h, nextM = m + 30;
                    if (nextM >= 60) { nextH++; nextM = 0; }
                    if (nextH <= 22) {
                      disabledTimes.add(`${String(nextH).padStart(2,'0')}:${String(nextM).padStart(2,'0')}`);
                    }
                  }
                }
              } else {
                // 현재 세션이 1시간 세션인 경우: 1시간 세션 모달 로직 적용
                if (is30min) {
                  // 30분 세션: 해당 시간만 제외
                  disabledTimes.add(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
                } else {
                  // 1시간 세션: 해당 시간과 이전 30분, 이후 30분 제외
                  // 이전 30분 (6:00 미만이 아닌 경우)
                  if (!(h === 6 && m === 0)) {
                    let prevH = h, prevM = m - 30;
                    if (prevM < 0) { prevH--; prevM = 30; }
                    if (prevH >= 6) {
                      disabledTimes.add(`${String(prevH).padStart(2,'0')}:${String(prevM).padStart(2,'0')}`);
                    }
                  }
                  
                  // 해당 시간
                  disabledTimes.add(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
                  
                  // 이후 30분 (22:00 초과하지 않는 경우)
                  if (!(h === 22 && m === 0)) {
                    let nextH = h, nextM = m + 30;
                    if (nextM >= 60) { nextH++; nextM = 0; }
                    if (nextH <= 22) {
                      disabledTimes.add(`${String(nextH).padStart(2,'0')}:${String(nextM).padStart(2,'0')}`);
                    }
                  }
                }
              }
            });
            let timeOpts = '';
            for(let h=6; h<=22; h++) {
              for(let m=0; m<60; m+=30) {
                if(h===22 && m>0) break;
                const hh = String(h).padStart(2,'0');
                const mm = String(m).padStart(2,'0');
                const val = `${hh}:${mm}`;
                timeOpts += `<option value="${val}"${disabledTimes.has(val)?' disabled':''}>${val}${disabledTimes.has(val)?' (예약불가)':''}</option>`;
              }
            }
            const timeSel = document.getElementById('change-time-input');
            timeSel.innerHTML = timeOpts;
            timeSel.value = session.time;
          });
        // 날짜 변경 시 시간 드롭다운 갱신
        document.getElementById('change-date-input').onchange = function() {
          const date = this.value;
          fetch(`/api/sessions?trainer=${encodeURIComponent(localStorage.getItem('username'))}&date=${date}`)
            .then(r=>r.json())
            .then(daySessions => {
              const isCurrentSession30min = session['30min'] === true;
              const disabledTimes = new Set();
              
              daySessions.filter(s=>s.id!==sessionId).forEach(s => {
                const [h, m] = s.time.split(':').map(Number);
                const is30min = s['30min'] === true;
                
                if (isCurrentSession30min) {
                  // 현재 세션이 30분 세션인 경우: 30분 세션 모달 로직 적용
                  if (is30min) {
                    // 30분 세션: 해당 시간만 제외
                    disabledTimes.add(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
                  } else {
                    // 1시간 세션: 해당 시간과 해당 세션 이후 30분 제외
                    disabledTimes.add(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
                    
                    // 이후 30분 (22:00 초과하지 않는 경우)
                    if (!(h === 22 && m === 0)) {
                      let nextH = h, nextM = m + 30;
                      if (nextM >= 60) { nextH++; nextM = 0; }
                      if (nextH <= 22) {
                        disabledTimes.add(`${String(nextH).padStart(2,'0')}:${String(nextM).padStart(2,'0')}`);
                      }
                    }
                  }
                } else {
                  // 현재 세션이 1시간 세션인 경우: 1시간 세션 모달 로직 적용
                  if (is30min) {
                    // 30분 세션: 해당 시간만 제외
                    disabledTimes.add(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
                  } else {
                    // 1시간 세션: 해당 시간과 이전 30분, 이후 30분 제외
                    // 이전 30분 (6:00 미만이 아닌 경우)
                    if (!(h === 6 && m === 0)) {
                      let prevH = h, prevM = m - 30;
                      if (prevM < 0) { prevH--; prevM = 30; }
                      if (prevH >= 6) {
                        disabledTimes.add(`${String(prevH).padStart(2,'0')}:${String(prevM).padStart(2,'0')}`);
                      }
                    }
                    
                    // 해당 시간
                    disabledTimes.add(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
                    
                    // 이후 30분 (22:00 초과하지 않는 경우)
                    if (!(h === 22 && m === 0)) {
                      let nextH = h, nextM = m + 30;
                      if (nextM >= 60) { nextH++; nextM = 0; }
                      if (nextH <= 22) {
                        disabledTimes.add(`${String(nextH).padStart(2,'0')}:${String(nextM).padStart(2,'0')}`);
                      }
                    }
                  }
                }
              });
              let timeOpts = '';
              for(let h=6; h<=22; h++) {
                for(let m=0; m<60; m+=30) {
                  if(h===22 && m>0) break;
                  const hh = String(h).padStart(2,'0');
                  const mm = String(m).padStart(2,'0');
                  const val = `${hh}:${mm}`;
                  timeOpts += `<option value="${val}"${disabledTimes.has(val)?' disabled':''}>${val}${disabledTimes.has(val)?' (예약불가)':''}</option>`;
                }
              }
              const timeSel = document.getElementById('change-time-input');
              timeSel.innerHTML = timeOpts;
            });
        };
        // 변경 폼 제출
        document.getElementById('change-session-form').onsubmit = async function(e) {
          e.preventDefault();
          const form = e.target;
          const data = Object.fromEntries(new FormData(form));
          const resultDiv = document.getElementById('change-session-result');
          resultDiv.className = 'tmc-modal-result';
          resultDiv.innerText = '처리 중...';
          try {
            const res = await fetch(`/api/sessions/${sessionId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            const result = await res.json();
            if (res.ok) {
              resultDiv.className = 'tmc-modal-result success';
              resultDiv.innerText = result.message;
              setTimeout(() => { close(); renderCalUI(container); }, 700);
            } else {
              resultDiv.className = 'tmc-modal-result error';
              resultDiv.innerText = result.message;
            }
          } catch {
            resultDiv.className = 'tmc-modal-result error';
            resultDiv.innerText = '세션 변경에 실패했습니다.';
          }
        };
      });
  }
  // 삭제 화면
  function renderDeleteBody(sessionId) {
    document.getElementById('attend-modal-body').innerHTML = `
      <div class="tmc-delete-confirm-message">정말 이 세션을 삭제하시겠습니까?</div>
      <div id="delete-session-result" class="tmc-modal-result"></div>
    `;
    const modalActions = document.createElement('div');
    modalActions.className = 'tmc-modal-actions';
    modalActions.innerHTML = '<button id="delete-session-ok" class="tmc-modal-submit-btn tmc-btn-danger">삭제</button>';
    document.getElementById('attend-modal-body').appendChild(modalActions);
    document.getElementById('delete-session-ok').onclick = async function() {
      const resultDiv = document.getElementById('delete-session-result');
      resultDiv.className = 'tmc-modal-result';
      resultDiv.innerText = '처리 중...';
      try {
        const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
        const result = await res.json();
        if (res.ok) {
          resultDiv.className = 'tmc-modal-result success';
          resultDiv.innerText = result.message;
          setTimeout(() => { close(); renderCalUI(container); }, 700);
        } else {
          resultDiv.className = 'tmc-modal-result error';
          resultDiv.innerText = result.message;
        }
      } catch {
        resultDiv.className = 'tmc-modal-result error';
        resultDiv.innerText = '세션 삭제에 실패했습니다.';
      }
    };
  }
  function close() {
    document.body.style.overflow = '';
    document.removeEventListener('keydown', escHandler);
    document.body.removeChild(modalBg);
    document.body.removeChild(modal);
  }
}