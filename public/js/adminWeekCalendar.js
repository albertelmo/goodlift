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
  
  // 고정된 시간대 설정 (30분 단위)
  const hours = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
  ];
  
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
  
  // 시간 라벨들을 먼저 생성 (정확한 위치에 배치)
  hours.forEach((hour, hourIndex) => {
    const gridRow = hourIndex + 2; // +2는 헤더 행 때문
    html += `<div class="awc-time-label" style="grid-row: ${gridRow}; grid-column: 1;">${hour}</div>`;
  });
  
  // 세션 카드들 생성
  hours.forEach((hour, hourIndex) => {
    const [h, m] = hour.split(':').map(Number);
    
    // 각 날짜별 셀
    weekDates.forEach((dateStr, dateIndex) => {
      // 현재 시간에 시작하는 세션들 찾기
      const currentSessions = sessions.filter(s => s.date === dateStr && s.time === hour);
      
      // 다음 30분에 시작하는 세션들도 찾기 (09:00 셀에 09:30 세션도 포함)
      const nextHour = hours[hourIndex + 1];
      const nextSessions = nextHour ? sessions.filter(s => s.date === dateStr && s.time === nextHour) : [];
      
      // 모든 세션 합치기 (현재 시간 + 다음 30분)
      const allSessions = [...currentSessions, ...nextSessions];
      
      if (allSessions.length > 0) {
        // 최대 6개까지만 표시
        const limitedSessions = allSessions.slice(0, 6);
        const hasMoreSessions = allSessions.length > 6;
        
        // 세션 카드들 생성 (최대 6개)
        limitedSessions.forEach((session, sessionIndex) => {
          const trainer = trainers.find(t => t.username === session.trainer);
          const trainerName = trainer ? trainer.name : session.trainer;
          
          // 상태를 영어 클래스명으로 변환
          let statusClass = 'reserved'; // 기본값
          if (session.status === '예정') statusClass = 'reserved';
          else if (session.status === '완료') statusClass = 'attend';
          
          // CSS Grid 위치 계산
          const gridRow = hourIndex + 2; // +2는 헤더 행 때문
          const gridColumn = dateIndex + 2; // +2는 시간 라벨 열 때문
          
          // 세션 카드를 개별적으로 배치하되, 가로로 나란히 배치
          html += `<div class="awc-session-card awc-status-${statusClass}" 
                        style="grid-row: ${gridRow} / ${gridRow + 2}; grid-column: ${gridColumn}; 
                               --session-index: ${sessionIndex};">
            <strong>${session.member}</strong>
            <div class="awc-trainer">${trainerName}</div>
            <div class="awc-status-label">${session.status}</div>
          </div>`;
        });
        
        // 6개 초과 시 추가 세션 표시
        if (hasMoreSessions) {
          const gridRow = hourIndex + 2;
          const gridColumn = dateIndex + 2;
          
          html += `<div class="awc-more-sessions" 
                        style="grid-row: ${gridRow} / ${gridRow + 2}; grid-column: ${gridColumn};">
            +${allSessions.length - 6}
          </div>`;
        }
      }
    });
  });
  
  html += '</div>';
  tableWrap.innerHTML = html;
}
