// 주간 세션 캘린더 (관리자용) - 시간 경계를 넘는 세션 구조
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
  
  // 시간대 생성 (06:00 ~ 22:00, 1시간 단위)
  const hours = [];
  for (let h = 6; h <= 22; h++) {
    hours.push(`${String(h).padStart(2, '0')}:00`);
  }
  
  // CSS Grid 기반 캘린더 생성
  let html = '<div class="awc-calendar-grid">';
  
  // 시간 라벨 행 (첫 번째 행)
  html += '<div class="awc-time-header">시간</div>';
  weekDates.forEach((dateStr, index) => {
    const date = new Date(dateStr);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = dayNames[date.getDay()];
    const isToday = dateStr === new Date().toISOString().slice(0, 10);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    
    let className = 'awc-date-header';
    if (isToday) className += ' awc-today';
    else if (isWeekend) className += ' awc-weekend';
    
    html += `<div class="${className}">${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}<br>(${dayName})</div>`;
  });
  
  // 시간별 행 생성 (시간 라벨만)
  hours.forEach((hour, hourIndex) => {
    const gridRow = hourIndex + 2; // +2는 헤더 행 때문
    html += `<div class="awc-time-label" style="grid-row: ${gridRow}; grid-column: 1;">${hour}</div>`;
  });
  
  // 각 날짜별로 세션들을 시간대별로 그룹화하여 배치
  weekDates.forEach((dateStr, dateIndex) => {
    const gridColumn = dateIndex + 2; // +2는 시간 라벨 열 때문
    
    // 해당 날짜의 세션들만 필터링
    const dateSessions = sessions.filter(s => s.date === dateStr);
    
    // 각 시간대별로 세션 컨테이너 생성
    hours.forEach((hour, hourIndex) => {
      const startHour = parseInt(hour.split(':')[0]);
      const startRow = startHour - 6 + 2; // 06:00이 첫 번째 행이므로 -6, +2는 헤더 행 때문
      const endRow = startHour - 6 + 3; // 1시간 세션
      
      // 현재 시간대에 표시될 세션들 찾기
      const currentHourSessions = [];
      const spanningSessions = [];
      
      dateSessions.forEach(session => {
        const [sessionHour, sessionMinute] = session.time.split(':').map(Number);
        
        // 정각 시작 세션 (예: 9:00 시작 → 9:00~10:00에 표시)
        if (sessionHour === startHour && sessionMinute === 0) {
          currentHourSessions.push({ ...session, position: 'full' });
        }
        // 30분 시작 세션 (예: 9:30 시작 → 9:00~10:00에 하단에 표시)
        else if (sessionHour === startHour && sessionMinute === 30) {
          spanningSessions.push({ ...session, position: 'bottom' });
        }
        // 이전 시간대 30분 시작 세션 (예: 8:30 시작 → 9:00~10:00에 상단에 표시)
        else if (sessionHour === startHour - 1 && sessionMinute === 30) {
          spanningSessions.push({ ...session, position: 'top' });
        }
      });
      
      // 세션 컨테이너 생성
      html += `<div class="awc-session-container" style="grid-row: ${startRow} / ${endRow}; grid-column: ${gridColumn};">
        ${renderSessions(currentHourSessions, trainers)}
        ${renderSpanningSessions(spanningSessions, trainers)}
      </div>`;
    });
  });
  
  html += '</div>';
  tableWrap.innerHTML = html;
}

function renderSessions(sessions, trainers) {
  if (sessions.length === 0) return '';
  
  // 세션 개수에 따라 카드 너비 계산
  const cardWidth = Math.max(100 / sessions.length, 20); // 최소 20% 너비
  
  return sessions.map((session, index) => {
    const trainer = trainers.find(t => t.username === session.trainer);
    const trainerName = trainer ? trainer.name : session.trainer;
    
    // 상태를 영어 클래스명으로 변환
    let statusClass = 'reserved'; // 기본값
    if (session.status === '예정') statusClass = 'reserved';
    else if (session.status === '완료') statusClass = 'attend';
    
    return `<div class="awc-session-card awc-status-${statusClass}" 
                  style="width: ${cardWidth}%; left: ${index * cardWidth}%; top: 0%;">
      <div class="awc-session-time">${session.time}</div>
      <div class="awc-session-member">${session.member}</div>
      <div class="awc-session-trainer">${trainerName}</div>
      <div class="awc-session-status">${session.status}</div>
    </div>`;
  }).join('');
}

function renderSpanningSessions(sessions, trainers) {
  if (sessions.length === 0) return '';
  
  // 세션 개수에 따라 카드 너비 계산
  const cardWidth = Math.max(100 / sessions.length, 20); // 최소 20% 너비
  
  return sessions.map((session, index) => {
    const trainer = trainers.find(t => t.username === session.trainer);
    const trainerName = trainer ? trainer.name : session.trainer;
    
    // 상태를 영어 클래스명으로 변환
    let statusClass = 'reserved'; // 기본값
    if (session.status === '예정') statusClass = 'reserved';
    else if (session.status === '완료') statusClass = 'attend';
    
    // 위치에 따른 top 값 설정
    let topValue = 0;
    if (session.position === 'bottom') {
      topValue = 50; // 하단에 배치
    } else if (session.position === 'top') {
      topValue = 0; // 상단에 배치
    }
    
    return `<div class="awc-session-card awc-status-${statusClass} awc-spanning" 
                  style="width: ${cardWidth}%; left: ${index * cardWidth}%; top: ${topValue}%;">
      <div class="awc-session-time">${session.time}</div>
      <div class="awc-session-member">${session.member}</div>
      <div class="awc-session-trainer">${trainerName}</div>
      <div class="awc-session-status">${session.status}</div>
    </div>`;
  }).join('');
}
