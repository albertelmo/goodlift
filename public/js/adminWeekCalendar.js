// 주간 세션 캘린더 (관리자용)
export const adminWeekCalendar = {
  render
};

let state = {
  weekStart: null // 'YYYY-MM-DD' - 주의 시작일 (월요일)
};

function render(root, dateStr) {
  if (!root) return;
  
  // 주의 시작일 계산 (월요일)
  let today = new Date();
  let date = dateStr ? new Date(dateStr) : today;
  
  // 해당 주의 월요일 찾기
  let dayOfWeek = date.getDay();
  let daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 일요일이면 6일 전, 아니면 dayOfWeek-1일 전
  let monday = new Date(date);
  monday.setDate(date.getDate() - daysToMonday);
  
  state.weekStart = monday.toISOString().slice(0, 10);
  
  root.innerHTML = `<div class="awc-header"></div><div class="awc-table-wrap"></div>`;
  renderHeader(root.querySelector('.awc-header'));
  renderTable(root.querySelector('.awc-table-wrap'));
}

function renderHeader(headerEl) {
  if (!headerEl) return;
  
  const monday = new Date(state.weekStart);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  const formatDate = (date) => {
    return `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`;
  };
  
  headerEl.innerHTML = `
    <div class="awc-date-nav">
      <button id="awc-prev">&#60;</button>
      <span class="awc-date">${formatDate(monday)} ~ ${formatDate(sunday)}</span>
      <button id="awc-next">&#62;</button>
      <button id="awc-today">이번 주</button>
    </div>
  `;
  
  headerEl.querySelector('#awc-prev').onclick = () => moveWeek(-1);
  headerEl.querySelector('#awc-next').onclick = () => moveWeek(1);
  headerEl.querySelector('#awc-today').onclick = () => moveWeek(0);
}

function moveWeek(delta) {
  let monday = new Date(state.weekStart);
  
  if (delta === 0) {
    // 이번 주로 이동
    let today = new Date();
    let dayOfWeek = today.getDay();
    let daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    monday = new Date(today);
    monday.setDate(today.getDate() - daysToMonday);
  } else {
    // 이전/다음 주로 이동
    monday.setDate(monday.getDate() + (delta * 7));
  }
  
  state.weekStart = monday.toISOString().slice(0, 10);
  const root = document.getElementById('admin-week-calendar-root');
  if (root) render(root, state.weekStart);
}

async function renderTable(tableWrap) {
  if (!tableWrap) return;
  
  tableWrap.innerHTML = '<div style="color:#888;text-align:center;">불러오는 중...</div>';
  
  // 주간 날짜 배열 생성
  const weekDates = [];
  const monday = new Date(state.weekStart);
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    weekDates.push(date.toISOString().slice(0, 10));
  }
  
  // 트레이너, 세션 데이터 fetch
  const [trainers, sessions] = await Promise.all([
    fetch('/api/trainers').then(r => r.json()),
    fetch(`/api/sessions?week=${state.weekStart}`).then(r => r.json())
  ]);
  
  // 시간대 계산 (30분 단위, 최소 09:00~17:00)
  let minTime = 9 * 60, maxTime = 17 * 60; // 분 단위
  if (sessions.length) {
    const times = sessions.map(s => {
      const [h, m] = s.time.split(':').map(Number);
      return h * 60 + m;
    });
    minTime = Math.min(minTime, ...times);
    maxTime = Math.max(maxTime, ...times, minTime + 30);
    maxTime = Math.max(maxTime + 30, 17 * 60);
    minTime = Math.min(minTime, 9 * 60);
  }
  
  // 30분 단위 시간 배열 생성
  const hours = [];
  for (let t = minTime; t <= maxTime; t += 30) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    hours.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
  }
  
  // 표 렌더링
  let html = '<div class="awc-table-scroll"><table class="awc-table"><thead><tr><th>시간</th>';
  
  // 날짜별 헤더 생성
  weekDates.forEach((dateStr, index) => {
    const date = new Date(dateStr);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = dayNames[date.getDay()];
    const isToday = dateStr === new Date().toISOString().slice(0, 10);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    
    let className = '';
    if (isToday) className = 'awc-today';
    else if (isWeekend) className = 'awc-weekend';
    
    html += `<th class="${className}">${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}<br>(${dayName})</th>`;
  });
  
  html += '</tr></thead><tbody>';
  
  // 시간대별 행 생성, 세션은 rowspan=2로 표시
  for (let i = 0; i < hours.length; i++) {
    const hour = hours[i];
    const [h, m] = hour.split(':').map(Number);
    
    html += '<tr>';
    
    // 왼쪽 시간 칼럼: 1시간 단위만 텍스트, 30분 단위는 빈 칸
    if (m === 0) {
      html += `<td class="awc-time">${hour}</td>`;
    } else {
      html += '<td class="awc-time"></td>';
    }
    
    // 각 날짜별 셀 생성
    weekDates.forEach(dateStr => {
      // 세션이 이 시간에 시작하면 rowspan=2로 카드 표시
      const dateSessions = sessions.filter(s => s.date === dateStr && s.time === hour);
      
      // 이전 30분 셀에서 이미 rowspan=2로 표시된 경우, 이 셀은 display:none
      const prevIdx = i - 1;
      let prevSessions = [];
      if (prevIdx >= 0) {
        const prevHour = hours[prevIdx];
        prevSessions = sessions.filter(s => s.date === dateStr && s.time === prevHour);
      }
      
      if (dateSessions.length > 0) {
        html += '<td rowspan="2"><div class="awc-session-container">';
        dateSessions.forEach(session => {
          const trainer = trainers.find(t => t.username === session.trainer);
          const trainerName = trainer ? trainer.name : session.trainer;
          
          // 상태를 영어 클래스명으로 변환
          let statusClass = 'reserved'; // 기본값
          if (session.status === '예정') statusClass = 'reserved';
          else if (session.status === '완료') statusClass = 'attend';
          
          html += `<div class="awc-session awc-status-${statusClass}">
            <strong>${session.member}</strong>
            <div class="awc-trainer">${trainerName}</div>
            <div class="awc-status-label">${session.status}</div>
          </div>`;
        });
        html += '</div></td>';
      } else if (prevSessions.length > 0) {
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
