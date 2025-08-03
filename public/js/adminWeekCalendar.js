// 주간 세션 캘린더 (관리자용) - 기본 9~17시 + 동적 확장
export const adminWeekCalendar = {
  render
};

// 기본 시간대 설정
const DEFAULT_TIME_RANGE = {
  start: '09:00',
  end: '17:00'
};

const DEFAULT_TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00'
]; // 17개 슬롯

let state = {
  weekStart: null,        // 'YYYY-MM-DD' - 주의 시작일 (월요일)
  searchMember: null,     // 검색할 회원명
  isSearchActive: false   // 검색 모드 활성화 여부
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
    <div class="awc-left-spacer"></div>
    <div class="awc-date-nav">
      <button id="awc-prev" class="awc-nav-btn awc-prev-btn"></button>
      <span class="awc-date">${formatDate(monday)} ~ ${formatDate(sunday)}</span>
      <button id="awc-next" class="awc-nav-btn awc-next-btn"></button>
    </div>
    <div class="awc-search-area">
      <input type="text" id="awc-search-input" placeholder="🔍 회원명 검색..." class="awc-search-input" value="${state.searchMember || ''}">
      <button id="awc-search-clear" class="awc-search-clear" style="display:${state.searchMember ? 'block' : 'none'};">×</button>
    </div>
  `;
  
  // 이벤트 리스너 설정
  setupSearchEventListeners(headerEl);
  headerEl.querySelector('#awc-prev').onclick = () => moveWeek(-1);
  headerEl.querySelector('#awc-next').onclick = () => moveWeek(1);
}

function setupSearchEventListeners(headerEl) {
  const searchInput = headerEl.querySelector('#awc-search-input');
  const clearBtn = headerEl.querySelector('#awc-search-clear');
  
  // 검색 입력 이벤트
  searchInput.addEventListener('input', function() {
    const searchTerm = this.value.trim();
    state.searchMember = searchTerm;
    state.isSearchActive = searchTerm.length > 0;
    
    // 초기화 버튼 표시/숨김
    clearBtn.style.display = searchTerm ? 'block' : 'none';
    
    // 테이블 다시 렌더링
    const tableWrap = document.querySelector('.awc-table-wrap');
    if (tableWrap) renderTable(tableWrap);
  });
  
  // 검색 초기화 버튼
  clearBtn.addEventListener('click', function() {
    searchInput.value = '';
    state.searchMember = null;
    state.isSearchActive = false;
    this.style.display = 'none';
    
    // 테이블 다시 렌더링
    const tableWrap = document.querySelector('.awc-table-wrap');
    if (tableWrap) renderTable(tableWrap);
  });
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
  
  // 트레이너, 세션, 회원 데이터 fetch
  const [trainers, sessions, members] = await Promise.all([
    fetch('/api/trainers').then(r => r.json()),
    fetch(`/api/sessions?week=${state.weekStart}`).then(r => r.json()),
    fetch('/api/members').then(r => r.json())
  ]);
  
  // 세션별로 회원 정보 매핑
  let processedSessions = sessions.map(s => {
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
      remainSessions,
      hasNoRemainingSessions,
      displayStatus
    };
  });
  
  // 검색 필터링 적용
  if (state.searchMember && state.searchMember.trim()) {
    const searchTerm = state.searchMember.trim().toLowerCase();
    processedSessions = processedSessions.filter(session => 
      session.member.toLowerCase().includes(searchTerm)
    );
  }
  
  // 검색 결과가 없을 때 처리
  if (state.isSearchActive && processedSessions.length === 0) {
    tableWrap.innerHTML = `
      <div style="color:#888;text-align:center;padding:40px;">
        <div style="margin-bottom:8px;">"${state.searchMember}" 회원의 세션을 찾을 수 없습니다.</div>
        <div style="font-size:0.9em;color:#666;">다른 주를 확인하거나 검색어를 변경해보세요.</div>
      </div>
    `;
    return;
  }
  
  // 세션 시간대 분석 및 동적 시간 슬롯 생성
  const sessionAnalysis = analyzeSessionTimeRange(processedSessions);
  const timeSlots = generateTimeSlots(sessionAnalysis);
  
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
  
  // 동적 시간 라벨 생성
  timeSlots.forEach((timeSlot, slotIndex) => {
    const gridRow = slotIndex + 2; // +2는 헤더 행 때문
    html += `<div class="awc-time-label" data-time="${timeSlot}" style="grid-row: ${gridRow}; grid-column: 1;">${timeSlot}</div>`;
  });
  
  // 각 날짜별로 세션들을 30분 단위로 그룹화하여 배치
  weekDates.forEach((dateStr, dateIndex) => {
    const gridColumn = dateIndex + 2; // +2는 시간 라벨 열 때문
    
    // 해당 날짜의 세션들만 필터링
    const dateSessions = processedSessions.filter(s => s.date === dateStr);
    
    // 각 30분 단위별로 세션 컨테이너 생성
    timeSlots.forEach((timeSlot, slotIndex) => {
      const [slotHour, slotMinute] = timeSlot.split(':').map(Number);
      const startRow = slotIndex + 2; // +2는 헤더 행 때문
      
      // 현재 슬롯에서 시작하는 1시간 세션들 찾기
      const currentSlotSessions = [];
      
      dateSessions.forEach(session => {
        const [sessionHour, sessionMinute] = session.time.split(':').map(Number);
        
        // 현재 슬롯에서 시작하는 1시간 세션만 표시
        if (sessionHour === slotHour && sessionMinute === slotMinute) {
          currentSlotSessions.push(session);
        }
      });
      
      // 이전 30분과 이후 30분의 세션 수 계산
      const prevSlotSessions = [];
      const nextSlotSessions = [];
      
      // 이전 30분 계산
      let prevSlotHour = slotHour;
      let prevSlotMinute = slotMinute - 30;
      if (prevSlotMinute < 0) {
        prevSlotHour = slotHour - 1;
        prevSlotMinute = 30;
      }
      
      // 이후 30분 계산
      let nextSlotHour = slotHour;
      let nextSlotMinute = slotMinute + 30;
      if (nextSlotMinute >= 60) {
        nextSlotHour = slotHour + 1;
        nextSlotMinute = 0;
      }
      
      // 이전 30분과 이후 30분의 세션들 찾기
      dateSessions.forEach(session => {
        const [sessionHour, sessionMinute] = session.time.split(':').map(Number);
        
        // 이전 30분 세션들
        if (sessionHour === prevSlotHour && sessionMinute === prevSlotMinute) {
          prevSlotSessions.push(session);
        }
        
        // 이후 30분 세션들
        if (sessionHour === nextSlotHour && sessionMinute === nextSlotMinute) {
          nextSlotSessions.push(session);
        }
      });
      
      // 가로 크기 계산: max(이전 30분, 이후 30분) + 현재 세션 수
      const maxAdjacentSessions = Math.max(prevSlotSessions.length, nextSlotSessions.length);
      const totalSessionsForWidth = maxAdjacentSessions + currentSlotSessions.length;
      
      // 30분 단위로 번갈아가며 왼쪽/오른쪽 배치
      // 짝수 슬롯(0, 2, 4...)은 왼쪽부터, 홀수 슬롯(1, 3, 5...)은 오른쪽부터
      const isEvenSlot = slotIndex % 2 === 0;
      let offsetFromPrev = 0;
      
      if (isEvenSlot) {
        // 짝수 슬롯: 왼쪽부터 배치 (오프셋 없음)
        offsetFromPrev = 0;
      } else {
        // 홀수 슬롯: 이전 30분의 세션 수만큼 오프셋해서 오른쪽에 배치
        offsetFromPrev = prevSlotSessions.length;
      }
      
      // 세션 컨테이너 생성 (1시간 세션은 2개 행에 걸쳐 표시)
      const rowSpan = currentSlotSessions.length > 0 ? 2 : 1; // 1시간 세션은 2개 행
      
      // 1시간 단위(정각)인지 확인하여 구분선 추가
      const isHourDivider = slotMinute === 0;
      const hourDividerClass = isHourDivider ? 'hour-divider' : '';
      
      html += `<div class="awc-session-container ${hourDividerClass}" data-time="${timeSlot}" style="grid-row: ${startRow} / ${startRow + rowSpan}; grid-column: ${gridColumn};">
        ${renderSessions(currentSlotSessions, trainers, totalSessionsForWidth, offsetFromPrev)}
      </div>`;
    });
  });
  
  html += '</div>';
  tableWrap.innerHTML = html;
  
  // 그리드 행 수 동적 업데이트
  updateCalendarGrid(timeSlots, sessionAnalysis);
}

// 세션 시간대 분석 함수
function analyzeSessionTimeRange(sessions) {
  if (sessions.length === 0) {
    return { timeSlots: DEFAULT_TIME_SLOTS, hasExtendedHours: false };
  }
  
  // 세션 시간들을 분 단위로 변환
  const sessionMinutes = sessions.map(session => {
    const [hour, minute] = session.time.split(':').map(Number);
    return hour * 60 + minute;
  });
  
  const minMinutes = Math.min(...sessionMinutes);
  const maxMinutes = Math.max(...sessionMinutes);
  
  // 기본 범위 (9:00~17:00 = 540~1020분)
  const defaultStart = 9 * 60;  // 540분
  const defaultEnd = 17 * 60;   // 1020분
  
  // 확장이 필요한지 확인
  const needsEarlyExtension = minMinutes < defaultStart;
  const needsLateExtension = maxMinutes > defaultEnd;
  
  return {
    minMinutes,
    maxMinutes,
    needsEarlyExtension,
    needsLateExtension,
    hasExtendedHours: needsEarlyExtension || needsLateExtension
  };
}

// 동적 시간 슬롯 생성 함수
function generateTimeSlots(sessionAnalysis) {
  let timeSlots = [...DEFAULT_TIME_SLOTS]; // 기본 9~17시
  
  if (!sessionAnalysis.hasExtendedHours) {
    return timeSlots;
  }
  
  // 이른 시간 확장 (6:00~9:00)
  if (sessionAnalysis.needsEarlyExtension) {
    const earlySlots = [];
    const startHour = Math.max(6, Math.floor(sessionAnalysis.minMinutes / 60));
    const startMinute = sessionAnalysis.minMinutes % 60;
    
    // 30분 단위로 이른 시간 슬롯 생성
    for (let h = startHour; h < 9; h++) {
      for (let m = 0; m < 60; m += 30) {
        if (h === startHour && m < startMinute) continue;
        earlySlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    timeSlots = [...earlySlots, ...timeSlots];
  }
  
  // 늦은 시간 확장 (17:00~22:00)
  if (sessionAnalysis.needsLateExtension) {
    const lateSlots = [];
    const endHour = Math.min(22, Math.ceil(sessionAnalysis.maxMinutes / 60));
    const endMinute = sessionAnalysis.maxMinutes % 60;
    
    // 30분 단위로 늦은 시간 슬롯 생성
    for (let h = 17; h <= endHour; h++) {
      for (let m = 0; m < 60; m += 30) {
        if (h === endHour && m > endMinute) break;
        lateSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    timeSlots = [...timeSlots, ...lateSlots];
  }
  
  return timeSlots;
}



// 캘린더 그리드 업데이트 함수
function updateCalendarGrid(timeSlots, sessionAnalysis) {
  const calendarGrid = document.querySelector('.awc-calendar-grid');
  if (!calendarGrid) return;
  
  const gridRows = 1 + timeSlots.length; // 헤더 1개 + 시간 슬롯들
  
  // 그리드 행 수 업데이트
  calendarGrid.style.gridTemplateRows = `50px repeat(${timeSlots.length}, 30px)`;
  
  // 확장된 시간대 표시 여부에 따른 클래스 추가
  if (sessionAnalysis.hasExtendedHours) {
    calendarGrid.classList.add('extended-hours');
  } else {
    calendarGrid.classList.remove('extended-hours');
  }
}

function renderSessions(sessions, trainers, totalSessionsForWidth, offsetFromPrev) {
  if (sessions.length === 0) return '';
  
  // 겹치는 세션들의 총 개수로 카드 너비 계산
  const cardWidth = Math.max(100 / totalSessionsForWidth, 20); // 최소 20% 너비
  
  return sessions.map((session, index) => {
    const trainer = trainers.find(t => t.username === session.trainer);
    const trainerName = trainer ? trainer.name : session.trainer;
    
    // 상태를 영어 클래스명으로 변환
    let statusClass = 'reserved'; // 기본값
    if (session.displayStatus === '예정') statusClass = 'reserved';
    else if (session.displayStatus === '완료') statusClass = 'attend';
    else if (session.displayStatus === '잔여세션 부족') statusClass = 'no-remaining';
    
    // 현재 세션들의 순서에 따른 left 위치 계산
    const leftPosition = index * cardWidth + offsetFromPrev * cardWidth;
    
    // 카드 크기에 따라 레이아웃 결정
    const isNarrow = cardWidth < 25; // 25% 미만이면 좁은 카드로 판단
    const layoutClass = isNarrow ? 'narrow' : '';
    
    let cardClass = `awc-session-card awc-status-${statusClass} ${layoutClass}`;
    if (session.hasNoRemainingSessions && session.status !== '완료') {
      cardClass += ' awc-no-remaining';
    }
    
    return `<div class="${cardClass}" 
                  style="width: ${cardWidth}%; left: ${leftPosition}%; top: 0%;">
      <div class="awc-session-member">${session.member}</div>
      <div class="awc-session-trainer">${trainerName}</div>
      ${session.hasNoRemainingSessions && session.status !== '완료' ? '<div style="color:#d32f2f;font-size:0.7em;">⚠️</div>' : ''}
    </div>`;
  }).join('');
}
