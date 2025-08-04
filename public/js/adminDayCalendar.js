// 날짜별 세션 캘린더 (관리자용)
export const adminDayCalendar = {
  render
};

let state = {
  date: null // 'YYYY-MM-DD'
};

// KST(로컬) 기준 YYYY-MM-DD 문자열 반환 함수
function getLocalDateStr(date = new Date()) {
  return date.getFullYear() + '-' +
    String(date.getMonth()+1).padStart(2,'0') + '-' +
    String(date.getDate()).padStart(2,'0');
}

function render(root, dateStr) {
  if (!root) return;
  // 날짜 상태 초기화
  let today = new Date();
  let date = dateStr ? new Date(dateStr) : today;
  state.date = getLocalDateStr(date);
  root.innerHTML = `<div class="adc-header"></div><div class="adc-table-wrap"></div>`;
  renderHeader(root.querySelector('.adc-header'));
  renderTable(root.querySelector('.adc-table-wrap'));
}

function renderHeader(headerEl) {
  if (!headerEl) return;
  const d = new Date(state.date);
  headerEl.innerHTML = `
    <div class="adc-date-nav">
      <button id="adc-prev" class="adc-nav-btn adc-prev-btn"></button>
      <span class="adc-date">${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} (${['일','월','화','수','목','금','토'][d.getDay()]})</span>
      <button id="adc-next" class="adc-nav-btn adc-next-btn"></button>
    </div>
  `;
  headerEl.querySelector('#adc-prev').onclick = () => moveDate(-1);
  headerEl.querySelector('#adc-next').onclick = () => moveDate(1);
}

function moveDate(delta) {
  let d = new Date(state.date);
  if (delta === 0) d = new Date();
  else d.setDate(d.getDate() + delta);
  state.date = getLocalDateStr(d);
  const root = document.getElementById('admin-day-calendar-root');
  if (root) render(root, state.date);
}

async function renderTable(tableWrap) {
  if (!tableWrap) return;
  tableWrap.innerHTML = '<div style="color:#888;text-align:center;">불러오는 중...</div>';
  // 트레이너, 세션, 회원 데이터 fetch
  const [trainers, sessions, members] = await Promise.all([
    fetch('/api/trainers').then(r=>r.json()),
    fetch(`/api/sessions?date=${state.date}`).then(r=>r.json()),
    fetch('/api/members').then(r=>r.json())
  ]);
  
  // PostgreSQL에서 반환되는 날짜 형식 처리 (ISO 날짜에서 날짜 부분만 추출)
  const processedSessions = sessions.map(s => {
    const member = members.find(m => m.name === s.member);
    const remainSessions = member ? member.remainSessions : 0;
    const hasNoRemainingSessions = remainSessions <= 0;
    
    // 완료된 세션은 잔여세션과 관계없이 원래 상태 유지
    let displayStatus = s.status;
    if (s.status !== '완료' && hasNoRemainingSessions) {
      displayStatus = '잔여세션 부족';
    }
    
    return {
      ...s,
      date: s.date.split('T')[0], // ISO 날짜에서 날짜 부분만 추출
      remainSessions,
      hasNoRemainingSessions,
      displayStatus
    };
  });
  // === 동적으로 시간대 계산 (30분 단위, 최소 09:00~17:00) ===
  let minTime = 9 * 60, maxTime = 17 * 60; // 분 단위
  if (processedSessions.length) {
    const times = processedSessions.map(s => {
      const [h, m] = s.time.split(':').map(Number);
      return h * 60 + m;
    });
    minTime = Math.min(minTime, ...times);
    maxTime = Math.max(maxTime, ...times, minTime + 30);
    // 마지막 세션 종료 후 30분까지 표시
    maxTime = Math.max(maxTime + 30, 17 * 60);
    minTime = Math.min(minTime, 9 * 60);
  }
  // 30분 단위 시간 배열 생성
  const hours = [];
  for(let t = minTime; t <= maxTime; t += 30) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    hours.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
  }
  // 트레이너를 가나다순으로 정렬
  const sortedTrainers = trainers.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  
  // 표 렌더링
  let html = '<div class="adc-table-scroll"><table class="adc-table"><thead><tr><th>시간</th>';
  sortedTrainers.forEach(t => { html += `<th>${t.name}</th>`; });
  html += '</tr></thead><tbody>';
  // 30분 단위 행 생성, 세션은 rowspan=2로 표시
  for (let i = 0; i < hours.length; i++) {
    const hour = hours[i];
    const [h, m] = hour.split(':').map(Number);
    html += `<tr data-time="${hour}">`;
    // 왼쪽 시간 칼럼: 30분 단위로 모든 시간 표시
    html += `<td class="adc-time">${hour}</td>`;
    sortedTrainers.forEach(t => {
      // 세션이 이 시간에 시작하면 rowspan=2로 카드 표시
      const session = processedSessions.find(s => s.trainer === t.username && s.time === hour);
      
      // 이전 30분 셀에서 이미 rowspan=2로 표시된 경우, 이 셀은 display:none
      const prevIdx = i - 1;
      let prevSession = null;
      if (prevIdx >= 0) {
        const prevHour = hours[prevIdx];
        prevSession = processedSessions.find(s => s.trainer === t.username && s.time === prevHour);
      }
      if (session) {
        // 상태를 영어 클래스명으로 변환
        let statusClass = 'reserved'; // 기본값
        if (session.displayStatus === '예정') statusClass = 'reserved';
        else if (session.displayStatus === '완료') statusClass = 'attend';
        else if (session.displayStatus === '사전') statusClass = 'pre';
        else if (session.displayStatus === '결석') statusClass = 'absent';
        else if (session.displayStatus === '취소') statusClass = 'cancel';
        else if (session.displayStatus === '전체취소') statusClass = 'allcancel';
        else if (session.displayStatus === '잔여세션 부족') statusClass = 'no-remaining';
        
        let sessionClass = `adc-session adc-status-${statusClass}`;
        if (session.hasNoRemainingSessions && session.status !== '완료') {
          sessionClass += ' adc-no-remaining';
        }
        
        html += `<td rowspan="2"><div class="${sessionClass}">
          <strong>${session.member} (${session.remainSessions})</strong>
          <div class="adc-status-label">${session.displayStatus}</div>
          ${session.hasNoRemainingSessions && session.status !== '완료' ? '<div style="color:#d32f2f;font-size:0.8em;">⚠️</div>' : ''}
        </div></td>`;
      } else if (prevSession) {
        html += '<td style="display:none"></td>';
      } else {
        html += '<td></td>';
      }
    });
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  tableWrap.innerHTML = html;
} 