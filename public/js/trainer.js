async function loadList() {
    const loading = document.getElementById('trainer-list-loading');
    const listDiv = document.getElementById('trainer-list');
    if (loading) loading.style.display = 'block';
    if (listDiv) listDiv.innerHTML = '';
    try {
        const res = await fetch('/api/trainers');
        const trainers = await res.json();
        if (loading) loading.style.display = 'none';
        if (trainers.length === 0) {
            if (listDiv) listDiv.innerHTML = '<div style="color:#888;">등록된 트레이너가 없습니다.</div>';
        } else {
            let html = '<table style="width:100%;border-collapse:collapse;margin-top:10px;">';
            html += '<thead><tr><th style="text-align:left;padding:8px 4px;border-bottom:1.5px solid #b6c6e3;">아이디</th><th style="text-align:left;padding:8px 4px;border-bottom:1.5px solid #b6c6e3;">이름</th><th style="text-align:center;padding:8px 4px;border-bottom:1.5px solid #b6c6e3;">삭제</th></tr></thead><tbody>';
            trainers.forEach(tr => {
                html += `<tr>
                    <td style="padding:8px 4px;border-bottom:1px solid #e3eaf5;">${tr.username}</td>
                    <td style="padding:8px 4px;border-bottom:1px solid #e3eaf5;">${tr.name}</td>
                    <td style="padding:8px 4px;border-bottom:1px solid #e3eaf5;text-align:center;">
                        <button class="delete-trainer-btn" data-username="${tr.username}" data-name="${tr.name}" style="background:#d32f2f;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:0.9rem;">삭제</button>
                    </td>
                </tr>`;
            });
            html += '</tbody></table>';
            if (listDiv) listDiv.innerHTML = html;
            
            // 삭제 버튼 이벤트 리스너 추가
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
    } catch (e) {
        if (loading) loading.style.display = 'none';
        if (listDiv) listDiv.innerHTML = '<div style="color:#d32f2f;">트레이너 목록을 불러오지 못했습니다.</div>';
    }
}

export async function renderMyMembers(container, username) {
    if (!container) return;
    container.innerHTML = '<div style="color:#888;text-align:center;">불러오는 중...</div>';
    try {
        const res = await fetch('/api/members');
        const members = await res.json();
        const myMembers = members.filter(m => m.trainer === username)
            .sort((a, b) => {
                // 잔여세션이 없는 경우를 맨 뒤로
                const aRemain = a.remainSessions !== undefined ? a.remainSessions : -1;
                const bRemain = b.remainSessions !== undefined ? b.remainSessions : -1;
                return aRemain - bRemain; // 오름차순 (잔여세션 적은 순)
            });
        if (!myMembers.length) {
            container.innerHTML = '<div style="color:#888;text-align:center;">담당 회원이 없습니다.</div>';
            return;
        }
        let html = `<table style="width:100%;border-collapse:collapse;margin-top:18px;">
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

export function renderSessionCalendar(container) {
    if (!container) return;
    // 상태 초기화(최초 진입 시 오늘로)
    if (!calState.year) {
        const today = new Date();
        calState.year = today.getFullYear();
        calState.month = today.getMonth() + 1;
        calState.today = today.getDate();
    }
    renderCalUI(container);
}

async function renderCalUI(container, forceDate) {
    const yyyy = calState.year;
    const mm = String(calState.month).padStart(2, '0');
    let dd = String(calState.today).padStart(2, '0');
    if (forceDate) dd = forceDate;
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
            
            html += `<div class="${itemClass}" data-id="${s.id}" data-no-remaining="${s.hasNoRemainingSessions && s.status !== '완료'}" ${itemStyle}>
                <span class="tmc-session-time">${s.time}</span>
                <span class="tmc-session-type">PT</span>
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
            <div class="tmc-modal-bg" id="tmc-modal-bg" style="display:none;"></div>
            <div class="tmc-modal" id="tmc-modal" style="display:none;">
                <div class="tmc-modal-content">
                    <h3>세션 추가</h3>
                    <form id="tmc-session-add-form" style="display:flex;flex-direction:column;gap:12px;align-items:center;">
                      <label style="width:100%;text-align:left;">회원
                        <select name="member" id="tmc-member-select" required style="width:180px;"></select>
                      </label>
                      <label style="width:100%;text-align:left;">날짜
                        <input type="date" name="date" id="tmc-date-input" required style="width:180px;">
                      </label>
                      <label style="width:100%;text-align:left;">시간
                        <select name="time" id="tmc-time-input" required style="width:180px;"></select>
                      </label>
                      <label style="width:100%;text-align:left;display:flex;align-items:center;gap:8px;">
                        <input type="checkbox" name="repeat" id="tmc-repeat-checkbox" style="width:auto;">
                        <span>반복하기</span>
                      </label>
                      <label style="width:100%;text-align:left;opacity:0;height:0;overflow:hidden;transition:all 0.3s ease;" id="tmc-repeat-count-label">
                        반복횟수
                        <select name="repeatCount" id="tmc-repeat-count-input" style="width:180px;">
                          <option value="1">1회</option>
                          <option value="2">2회</option>
                          <option value="3">3회</option>
                          <option value="4">4회</option>
                          <option value="5">5회</option>
                          <option value="6">6회</option>
                          <option value="7">7회</option>
                          <option value="8">8회</option>
                          <option value="9">9회</option>
                          <option value="10">10회</option>
                        </select>
                      </label>
                      <button type="submit" style="width:180px;">등록</button>
                      <div id="tmc-session-add-result" style="min-height:20px;font-size:0.97rem;"></div>
                    </form>
                </div>
            </div>
        </div>`;
        container.innerHTML = html;
        
        // 세션 추가 모달: 회원 드롭다운 로딩
        const myMembers = members.filter(m=>m.trainer===username && m.remainSessions > 0 && m.status === '유효');
        const sel = document.getElementById('tmc-member-select');
        sel.innerHTML = myMembers.length ? myMembers.map(m=>`<option value=\"${m.name}\">${m.name}</option>`).join('') : '<option value=\"\">담당 회원 없음</option>';
        
        // 시간 드롭다운 06:00~22:00 30분 단위 생성 (중복 방지, 1시간 단위)
        const timeSel = document.getElementById('tmc-time-input');
        const daySessionsRes = await fetch(`/api/sessions?trainer=${encodeURIComponent(username)}&date=${yyyy}-${mm}-${dd}`);
        const daySessions = await daySessionsRes.json();
        
        // 예약된 시간대(이전 30분, 해당, 다음 30분) 모두 disabled 처리
        const disabledTimes = new Set();
        daySessions.forEach(s => {
          const [h, m] = s.time.split(':').map(Number);
          // 이전 30분
          if (!(h === 6 && m === 0)) {
            let prevH = h, prevM = m - 30;
            if (prevM < 0) { prevH--; prevM = 30; }
            if (prevH >= 6) disabledTimes.add(`${String(prevH).padStart(2,'0')}:${String(prevM).padStart(2,'0')}`);
          }
          // 해당 시간
          disabledTimes.add(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
          // 다음 30분
          if (!(h === 22 && m === 0)) {
            let nextH = h, nextM = m + 30;
            if (nextM >= 60) { nextH++; nextM = 0; }
            if (nextH <= 22) disabledTimes.add(`${String(nextH).padStart(2,'0')}:${String(nextM).padStart(2,'0')}`);
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
        timeSel.innerHTML = timeOpts;
        
        document.getElementById('tmc-date-input').value = `${yyyy}-${mm}-${dd}`;
        document.getElementById('tmc-add-btn').onclick = function() {
            document.getElementById('tmc-modal-bg').style.display = 'block';
            document.getElementById('tmc-modal').style.display = 'block';
        };

        document.getElementById('tmc-modal-bg').onclick = function() {
            document.getElementById('tmc-modal-bg').style.display = 'none';
            document.getElementById('tmc-modal').style.display = 'none';
        };
        
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
        document.getElementById('tmc-session-add-form').onsubmit = async function(e) {
          e.preventDefault();
          const form = e.target;
          const data = Object.fromEntries(new FormData(form));
          data.trainer = username;
          const resultDiv = document.getElementById('tmc-session-add-result');
          resultDiv.style.color = '#1976d2';
          resultDiv.innerText = '처리 중...';
          try {
            const res = await fetch('/api/sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            const result = await res.json();
            if (res.ok) {
              resultDiv.style.color = '#1976d2';
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
            } else {
              resultDiv.style.color = '#d32f2f';
              resultDiv.innerText = result.message;
            }
          } catch {
            resultDiv.style.color = '#d32f2f';
            resultDiv.innerText = '세션 추가에 실패했습니다.';
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
                    calState.month++;
                    if (calState.month > 12) {
                        calState.month = 1;
                        calState.year++;
                    }
                    renderCalUI(container);
                } else {
                    calState.month--;
                    if (calState.month < 1) {
                        calState.month = 12;
                        calState.year--;
                    }
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
    const first = new Date(year, m-1, 1);
    const last = new Date(year, m, 0);
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
    const first = new Date(year, m-1, 1);
    const last = new Date(year, m, 0);
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

export const trainer = { loadList, renderMyMembers, renderSessionCalendar };

function showAttendModal(sessionId, container, hasNoRemaining = false) {
  let modalBg = document.createElement('div');
  modalBg.className = 'tmc-modal-bg';
  modalBg.style.display = 'block';
  let modal = document.createElement('div');
  modal.className = 'tmc-modal';
  modal.style.display = 'block';
  
  // 버튼 disabled 속성 설정
  const attendDisabled = hasNoRemaining ? 'disabled' : '';
  const changeDisabled = hasNoRemaining ? 'disabled' : '';
  
  modal.innerHTML = `
    <div class="tmc-modal-content" id="attend-modal-content">
      <h3>세션 관리</h3>
      ${hasNoRemaining ? '<div style="color:#d32f2f;font-size:0.9rem;margin-bottom:12px;text-align:center;">⚠️ 잔여세션이 부족하여 출석/변경이 불가능합니다.</div>' : ''}
      <div class="tmc-modal-btn-row" id="attend-btn-row">
        <button id="attend-btn" ${attendDisabled}>출석</button>
        <button id="change-btn" ${changeDisabled}>변경</button>
        <button id="delete-btn">취소</button>
      </div>
      <div id="attend-modal-body"></div>
      <button id="attend-modal-close" style="margin-top:18px;">닫기</button>
    </div>
  `;
  document.body.appendChild(modalBg);
  document.body.appendChild(modal);
  // 닫기 버튼
  document.getElementById('attend-modal-close').onclick = close;
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
    fetch(`/api/sessions?trainer=${encodeURIComponent(localStorage.getItem('username'))}`)
      .then(r=>r.json())
      .then(allSessions => {
        const session = allSessions.find(s => s.id === sessionId);
        if (!session) return;
        fetch('/api/members').then(r=>r.json()).then(members => {
          const member = members.find(m => m.name === session.member);
          const remain = member && member.remainSessions !== undefined ? member.remainSessions : '?';
          document.getElementById('attend-modal-body').innerHTML = `
            <div style=\"margin-bottom:8px;display:flex;align-items:center;gap:12px;justify-content:center;\">
              <span style=\"font-weight:600;color:#1976d2;\">수고하셨습니다!</span>
              <span style=\"color:#388e3c;font-size:1.08em;\">잔여세션 ${remain}회</span>
            </div>
            <canvas id=\"attend-sign-canvas\" width=\"240\" height=\"140\" style=\"border:1.5px solid #e3eaf5;border-radius:8px;background:#fff;\"></canvas><br>
            <button id=\"attend-sign-ok\" style=\"margin:8px 0 0 0;\">확인</button>
            <div id=\"attend-result\" style=\"min-height:20px;margin-top:8px;font-size:0.97rem;\"></div>
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
            resultDiv.style.color = '#1976d2';
            resultDiv.innerText = '처리 중...';
            try {
              const res = await fetch(`/api/sessions/${sessionId}/attend`, { method: 'PATCH' });
              const result = await res.json();
              if (res.ok) {
                resultDiv.innerText = result.message;
                setTimeout(() => { close(); renderCalUI(container); }, 700);
              } else {
                resultDiv.style.color = '#d32f2f';
                resultDiv.innerText = result.message;
              }
            } catch {
              resultDiv.style.color = '#d32f2f';
              resultDiv.innerText = '출석 처리에 실패했습니다.';
            }
          };
        });
      });
  }
  // 변경 화면
  function renderChangeBody(sessionId) {
    document.getElementById('attend-modal-body').innerHTML = `
      <form id="change-session-form" style="display:flex;flex-direction:column;gap:12px;align-items:center;">
        <label style="width:100%;text-align:left;">날짜
          <input type="date" name="date" id="change-date-input" required style="width:180px;">
        </label>
        <label style="width:100%;text-align:left;">시간
          <select name="time" id="change-time-input" required style="width:180px;"></select>
        </label>
        <button type="submit" style="width:180px;">변경</button>
        <div id="change-session-result" style="min-height:20px;font-size:0.97rem;"></div>
      </form>
    `;
    // 기존 세션 정보 불러오기
    fetch(`/api/sessions?trainer=${encodeURIComponent(localStorage.getItem('username'))}`)
      .then(r=>r.json())
      .then(allSessions => {
        const session = allSessions.find(s => s.id === sessionId);
        if (!session) return;
        document.getElementById('change-date-input').value = session.date;
        // 시간 드롭다운 생성(중복 방지, 1시간 단위)
        fetch(`/api/sessions?trainer=${encodeURIComponent(localStorage.getItem('username'))}&date=${session.date}`)
          .then(r=>r.json())
          .then(daySessions => {
            const disabledTimes = new Set();
            daySessions.filter(s=>s.id!==sessionId).forEach(s => {
              const [h, m] = s.time.split(':').map(Number);
              if (!(h === 6 && m === 0)) {
                let prevH = h, prevM = m - 30;
                if (prevM < 0) { prevH--; prevM = 30; }
                if (prevH >= 6) disabledTimes.add(`${String(prevH).padStart(2,'0')}:${String(prevM).padStart(2,'0')}`);
              }
              disabledTimes.add(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
              if (!(h === 22 && m === 0)) {
                let nextH = h, nextM = m + 30;
                if (nextM >= 60) { nextH++; nextM = 0; }
                if (nextH <= 22) disabledTimes.add(`${String(nextH).padStart(2,'0')}:${String(nextM).padStart(2,'0')}`);
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
              const disabledTimes = new Set();
              daySessions.filter(s=>s.id!==sessionId).forEach(s => {
                const [h, m] = s.time.split(':').map(Number);
                if (!(h === 6 && m === 0)) {
                  let prevH = h, prevM = m - 30;
                  if (prevM < 0) { prevH--; prevM = 30; }
                  if (prevH >= 6) disabledTimes.add(`${String(prevH).padStart(2,'0')}:${String(prevM).padStart(2,'0')}`);
                }
                disabledTimes.add(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
                if (!(h === 22 && m === 0)) {
                  let nextH = h, nextM = m + 30;
                  if (nextM >= 60) { nextH++; nextM = 0; }
                  if (nextH <= 22) disabledTimes.add(`${String(nextH).padStart(2,'0')}:${String(nextM).padStart(2,'0')}`);
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
          resultDiv.style.color = '#1976d2';
          resultDiv.innerText = '처리 중...';
          try {
            const res = await fetch(`/api/sessions/${sessionId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            const result = await res.json();
            if (res.ok) {
              resultDiv.innerText = result.message;
              setTimeout(() => { close(); renderCalUI(container); }, 700);
            } else {
              resultDiv.style.color = '#d32f2f';
              resultDiv.innerText = result.message;
            }
          } catch {
            resultDiv.style.color = '#d32f2f';
            resultDiv.innerText = '세션 변경에 실패했습니다.';
          }
        };
      });
  }
  // 삭제 화면
  function renderDeleteBody(sessionId) {
    document.getElementById('attend-modal-body').innerHTML = `
      <div style="margin-bottom:12px;">정말 이 세션을 삭제하시겠습니까?</div>
      <button id="delete-session-ok" style="background:#d32f2f;color:#fff;">삭제</button>
      <div id="delete-session-result" style="min-height:20px;margin-top:8px;font-size:0.97rem;"></div>
    `;
    document.getElementById('delete-session-ok').onclick = async function() {
      const resultDiv = document.getElementById('delete-session-result');
      resultDiv.style.color = '#1976d2';
      resultDiv.innerText = '처리 중...';
      try {
        const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
        const result = await res.json();
        if (res.ok) {
          resultDiv.innerText = result.message;
          setTimeout(() => { close(); renderCalUI(container); }, 700);
        } else {
          resultDiv.style.color = '#d32f2f';
          resultDiv.innerText = result.message;
        }
      } catch {
        resultDiv.style.color = '#d32f2f';
        resultDiv.innerText = '세션 삭제에 실패했습니다.';
      }
    };
  }
  function close() {
    document.body.removeChild(modalBg);
    document.body.removeChild(modal);
  }
}