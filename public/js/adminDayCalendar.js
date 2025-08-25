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
  
  // CSS Grid 기반 캘린더 생성
  const trainerCount = sortedTrainers.length;
  const isMobile = window.innerWidth <= 768;
  const timeColumnWidth = isMobile ? '50px' : 'auto';
  let html = `<div class="adc-calendar-grid" style="grid-template-columns: ${timeColumnWidth} repeat(${trainerCount}, 1fr);">`;
  
  // 시간 라벨 행 (첫 번째 행)
  html += '<div class="adc-time-header">시간</div>';
  sortedTrainers.forEach(t => { 
    html += `<div class="adc-trainer-header">${t.name}</div>`; 
  });
  
  // 동적 시간 라벨 생성
  hours.forEach((hour, hourIndex) => {
    const gridRow = hourIndex + 2; // +2는 헤더 행 때문
    html += `<div class="adc-time-label" data-time="${hour}" style="grid-row: ${gridRow}; grid-column: 1;">${hour}</div>`;
  });
  
  // 각 트레이너별로 세션들을 30분 단위로 배치
  sortedTrainers.forEach((trainer, trainerIndex) => {
    const gridColumn = trainerIndex + 2; // +2는 시간 라벨 열 때문
    
    // 해당 트레이너의 세션들만 필터링
    const trainerSessions = processedSessions.filter(s => s.trainer === trainer.username);
    
    // 각 30분 단위별로 세션 컨테이너 생성
    hours.forEach((hour, hourIndex) => {
      const [slotHour, slotMinute] = hour.split(':').map(Number);
      const startRow = hourIndex + 2; // +2는 헤더 행 때문
      
      // 현재 슬롯에서 시작하는 세션들 찾기
      const currentSlotSessions = trainerSessions.filter(session => {
        const [sessionHour, sessionMinute] = session.time.split(':').map(Number);
        return sessionHour === slotHour && sessionMinute === slotMinute;
      });
      
      // 세션 컨테이너 생성
      const rowSpan = currentSlotSessions.length > 0 ? 2 : 1; // 세션이 있으면 2개 행
      
      // 1시간 단위(정각)인지 확인하여 구분선 추가
      const isHourDivider = slotMinute === 0;
      const hourDividerClass = isHourDivider ? 'hour-divider' : '';
      
      html += `<div class="adc-session-container ${hourDividerClass}" data-time="${hour}" style="grid-row: ${startRow} / ${startRow + rowSpan}; grid-column: ${gridColumn};">
        ${renderSessions(currentSlotSessions, trainer)}
      </div>`;
    });
  });
  
  html += '</div>';
  tableWrap.innerHTML = html;
  
  // 그리드 행 수 동적 업데이트
  updateCalendarGrid(hours);
}

// 세션 렌더링 함수
function renderSessions(sessions, trainer) {
  if (sessions.length === 0) return '';
  
  return sessions.map((session) => {
    // 상태를 영어 클래스명으로 변환
    let statusClass = 'reserved'; // 기본값
    if (session.displayStatus === '예정') statusClass = 'reserved';
    else if (session.displayStatus === '완료') statusClass = 'attend';
    else if (session.displayStatus === '사전') statusClass = 'pre';
    else if (session.displayStatus === '결석') statusClass = 'absent';
    else if (session.displayStatus === '취소') statusClass = 'cancel';
    else if (session.displayStatus === '전체취소') statusClass = 'allcancel';
    else if (session.displayStatus === '잔여세션 부족') statusClass = 'no-remaining';
    
    // 30분 세션용 클래스 추가
    const is30min = session['30min'] === true;
    
    let cardClass = `adc-session-card adc-status-${statusClass}`;
    if (is30min) {
      cardClass += ' adc-session-card-30min';
    }
    if (session.hasNoRemainingSessions && session.status !== '완료') {
      cardClass += ' adc-no-remaining';
    }
    
    return `<div class="${cardClass}">
      <div class="adc-session-member">${session.member} (${session.remainSessions})</div>
      <div class="adc-session-status">${session.displayStatus}</div>
      ${session.hasNoRemainingSessions && session.status !== '완료' ? '<div style="color:#d32f2f;font-size:0.7em;">⚠️</div>' : ''}
    </div>`;
  }).join('');
}

// 캘린더 그리드 업데이트 함수
function updateCalendarGrid(timeSlots) {
  const calendarGrid = document.querySelector('.adc-calendar-grid');
  if (!calendarGrid) return;
  
  const gridRows = 1 + timeSlots.length; // 헤더 1개 + 시간 슬롯들
  
  // 반응형 행 높이 설정
  const isMobile = window.innerWidth <= 768;
  const isSmallMobile = window.innerWidth <= 480;
  
  let headerHeight, rowHeight;
  if (isSmallMobile) {
    headerHeight = '30px';
    rowHeight = '14px';
  } else if (isMobile) {
    headerHeight = '35px';
    rowHeight = '16px';
  } else {
    headerHeight = '50px';
    rowHeight = '24px';
  }
  
  // 그리드 행 수 업데이트
  calendarGrid.style.gridTemplateRows = `${headerHeight} repeat(${timeSlots.length}, ${rowHeight})`;
} 