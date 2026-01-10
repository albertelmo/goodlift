// 관리자 통계 모듈
export const adminStats = {
  render
};

let currentPeriod = 'month'; // 'day', 'week', 'month'

// 한국시간 기준 현재 날짜 초기화
const getKoreanDate = () => {
  const now = new Date();
  // 브라우저는 이미 사용자의 로컬 시간대를 반환하므로 추가 변환 불필요
  return now;
};

// 한국시간 기준으로 현재 날짜의 시작점(00:00:00)을 설정
const getKoreanDateAsUTC = () => {
  const now = new Date();
  // 한국시간의 시작점(00:00:00)으로 설정
  now.setHours(0, 0, 0, 0);
  return now;
};

let currentDate = new Date(); // 한국시간 기준 현재 날짜
currentDate.setHours(0, 0, 0, 0); // 시간을 00:00:00으로 설정

function render(container) {
  if (!container) return;
  
  container.innerHTML = `
    <div class="stats-container">
      <div class="stats-header">
        <h3>세션 통계</h3>
        <div class="stats-controls">
          <div class="period-selector">
            <button class="period-btn ${currentPeriod === 'day' ? 'active' : ''}" data-period="day">일별</button>
            <button class="period-btn ${currentPeriod === 'week' ? 'active' : ''}" data-period="week">주별</button>
            <button class="period-btn ${currentPeriod === 'month' ? 'active' : ''}" data-period="month">월별</button>
          </div>
          <div class="date-navigation">
            <button id="prev-btn" class="nav-btn">◀</button>
            <span id="current-date" class="current-date"></span>
            <button id="next-btn" class="nav-btn">▶</button>
          </div>
        </div>
      </div>
      <div class="stats-content">
        <div id="stats-loading" style="text-align:center;color:#888;padding:40px;">통계를 불러오는 중...</div>
        <div id="stats-results"></div>
      </div>
    </div>
  `;

  // 이벤트 리스너 설정
  setupEventListeners(container);
  
  // 초기 데이터 로드
  loadStats();
}

function setupEventListeners(container) {
  // 기간 선택 버튼
  container.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      currentPeriod = this.dataset.period;
      container.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      loadStats();
    });
  });

  // 날짜 네비게이션
  container.querySelector('#prev-btn').addEventListener('click', () => {
    navigateDate(-1);
  });

  container.querySelector('#next-btn').addEventListener('click', () => {
    navigateDate(1);
  });
  
  // 트레이너 행 클릭 이벤트 설정
  setupTrainerRowEventListeners();
}

// 트레이너 행 클릭 이벤트 설정 함수
function setupTrainerRowEventListeners() {
  // 기존 이벤트 리스너 제거
  const existingRows = document.querySelectorAll('.trainer-row');
  existingRows.forEach(row => {
    row.removeEventListener('click', handleTrainerRowClick);
  });
  
  // 새로운 이벤트 리스너 추가
  setTimeout(() => {
    const trainerRows = document.querySelectorAll('.trainer-row');
    trainerRows.forEach(row => {
      row.addEventListener('click', handleTrainerRowClick);
    });
  }, 100);
}

// 트레이너 행 클릭 핸들러
function handleTrainerRowClick() {
  const trainer = this.getAttribute('data-trainer');
  const trainerName = this.getAttribute('data-name');
  // 통계 페이지의 설정된 월을 기준으로 함
  const selectedYearMonth = getSelectedYearMonth();
  showTrainerSessionsModal(trainer, trainerName, selectedYearMonth);
}

// 센터별 세션 데이터 생성 함수
function generateCenterSessionsContent(centerSessions, sessionType, title) {
  if (!centerSessions || !centerSessions[sessionType]) {
    return '센터별 데이터가 없습니다.';
  }
  
  const centerData = centerSessions[sessionType];
  
  // 센터별 데이터를 내림차순으로 정렬하여 HTML 생성
  const sortedCenters = Object.entries(centerData)
    .sort(([,a], [,b]) => b - a)
    .map(([center, count]) => `<div>${center}: ${count}개</div>`)
    .join('');
  
  return sortedCenters || '센터별 데이터가 없습니다.';
}

// 유효회원수 툴팁 이벤트 설정
function setupValidMembersTooltip() {
  const validMembersCard = document.getElementById('validMembersCard');
  if (!validMembersCard) return;
  
  const tooltip = validMembersCard.querySelector('.center-tooltip');
  if (!tooltip) return;
  
  setupTooltipEvents(validMembersCard, tooltip);
}

// 센터별 툴팁 이벤트 설정
function setupCenterTooltips() {
  const cardIds = ['totalSessionsCard', 'completedSessionsCard', 'scheduledSessionsCard', 'absentSessionsCard', 'remainingSessionsCard'];
  
  cardIds.forEach(cardId => {
    const card = document.getElementById(cardId);
    if (!card) return;
    
    const tooltip = card.querySelector('.center-tooltip');
    if (!tooltip) return;
    
    setupTooltipEvents(card, tooltip);
  });
}

// 공통 툴팁 이벤트 설정 함수
function setupTooltipEvents(card, tooltip) {
  let tooltipTimeout;
  
  // 마우스 진입 시 툴팁 표시
  card.addEventListener('mouseenter', () => {
    clearTimeout(tooltipTimeout);
    tooltip.style.display = 'block';
  });
  
  // 마우스 이탈 시 툴팁 숨김
  card.addEventListener('mouseleave', () => {
    tooltipTimeout = setTimeout(() => {
      tooltip.style.display = 'none';
    }, 200);
  });
  
  // 툴팁에 마우스 진입 시 유지
  tooltip.addEventListener('mouseenter', () => {
    clearTimeout(tooltipTimeout);
  });
  
  // 툴팁에서 마우스 이탈 시 숨김
  tooltip.addEventListener('mouseleave', () => {
    tooltipTimeout = setTimeout(() => {
      tooltip.style.display = 'none';
    }, 200);
  });
}

// 등록 로그 모달 표시
async function showRegistrationLogsModal(yearMonth) {
  try {
    const response = await fetch(`/api/registration-logs/${yearMonth}`);
    const data = await response.json();
    
    if (response.ok) {
      const displayMonth = `${yearMonth.split('-')[0]}년 ${yearMonth.split('-')[1]}월`;
      
      // 트레이너 정보 가져오기
      const trainerResponse = await fetch('/api/trainers');
      const trainers = await trainerResponse.json();
      
      // 트레이너 ID를 이름으로 매핑
      const trainerMap = {};
      trainers.forEach(trainer => {
        trainerMap[trainer.username] = trainer.name;
      });
      
      const modalContent = renderRegistrationLogsModal(data.logs, displayMonth, trainerMap);
      showModal(modalContent);
    } else {
      alert(`등록 로그 조회 실패: ${data.message}`);
    }
  } catch (error) {
    console.error('등록 로그 조회 오류:', error);
    alert('등록 로그를 불러오는데 실패했습니다.');
  }
}

// 등록 로그 모달 렌더링 - 한국시간 기준
function renderRegistrationLogsModal(logs, displayMonth, trainerMap) {
  if (!logs || logs.length === 0) {
    return `
      <div style="text-align:center;padding:40px;">
        <h3 style="color:#1976d2;margin-bottom:20px;">${displayMonth} 등록 로그</h3>
        <div style="color:#888;">해당 월의 등록 로그가 없습니다.</div>
      </div>
    `;
  }
  
  const logsHTML = logs.map(log => {
    const sessionCountText = formatSessionCount(log.session_count);
    const sessionCountColor = getSessionCountColor(log.session_count);
    const registrationDate = log.registration_date ? log.registration_date.split('-').slice(1).join('-') : '';
    const trainerName = trainerMap[log.trainer] || log.trainer; // 트레이너 ID를 이름으로 변환
    
    return `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:6px 4px;text-align:center;font-size:0.75rem;">${registrationDate}</td>
        <td style="padding:6px 4px;text-align:center;font-size:0.75rem;">${log.member_name}</td>
        <td style="padding:6px 4px;text-align:center;font-size:0.75rem;">${log.registration_type}</td>
        <td style="padding:6px 4px;text-align:center;font-weight:600;color:${sessionCountColor};font-size:0.75rem;">${sessionCountText}</td>
        <td style="padding:6px 4px;text-align:center;font-size:0.75rem;">${trainerName}</td>
        <td style="padding:6px 4px;text-align:center;font-size:0.75rem;">${log.center}</td>
      </tr>
    `;
  }).join('');
  
  return `
    <div style="max-width:900px;max-height:700px;overflow-y:auto;position:relative;">
      <button id="modal-close-btn" style="position:absolute;top:8px;right:8px;background:none;border:none;font-size:18px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      <h3 style="color:#1976d2;margin-bottom:16px;text-align:center;padding-right:35px;font-size:1.1rem;">${displayMonth} 등록 로그</h3>
      <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="padding:8px 6px;text-align:center;border-bottom:2px solid #ddd;color:#1976d2;font-size:0.8rem;">날짜</th>
            <th style="padding:8px 6px;text-align:center;border-bottom:2px solid #ddd;color:#1976d2;font-size:0.8rem;">회원명</th>
            <th style="padding:8px 6px;text-align:center;border-bottom:2px solid #ddd;color:#1976d2;font-size:0.8rem;">유형</th>
            <th style="padding:8px 6px;text-align:center;border-bottom:2px solid #ddd;color:#1976d2;font-size:0.8rem;">세션</th>
            <th style="padding:8px 6px;text-align:center;border-bottom:2px solid #ddd;color:#1976d2;font-size:0.8rem;">트레이너</th>
            <th style="padding:8px 6px;text-align:center;border-bottom:2px solid #ddd;color:#1976d2;font-size:0.8rem;">센터명</th>
          </tr>
        </thead>
        <tbody>
          ${logsHTML}
        </tbody>
      </table>
    </div>
  `;
}

// 세션 수 포맷팅
function formatSessionCount(count) {
  if (count > 0) {
    return `${count}회`;
  } else if (count < 0) {
    return `${count}회`;
  } else {
    return '0회';
  }
}

// 세션 수 색상
function getSessionCountColor(count) {
  if (count > 0) return '#1976d2'; // 파란색 (증가)
  if (count < 0) return '#d32f2f'; // 빨간색 (감소)
  return '#666'; // 회색 (변화 없음)
}

// 월별 통계 행 클릭 이벤트 설정
function setupMonthlyStatsRowEventListeners() {
  // 즉시 실행하되, DOM이 준비될 때까지 재시도
  const setupEventListeners = () => {
    const monthlyStatRows = document.querySelectorAll('.monthly-stat-row');
    
    if (monthlyStatRows.length === 0) {
      // 행이 없으면 50ms 후 다시 시도
      setTimeout(setupEventListeners, 50);
      return;
    }
    
    monthlyStatRows.forEach((row) => {
      // 기존 이벤트 리스너 제거 (중복 방지)
      row.removeEventListener('click', handleMonthlyStatRowClick);
      row.addEventListener('click', handleMonthlyStatRowClick);
    });
  };
  
  setupEventListeners();
}

// 월별 통계 행 클릭 핸들러
function handleMonthlyStatRowClick() {
  const yearMonth = this.getAttribute('data-year-month');
  if (yearMonth) {
    showRegistrationLogsModal(yearMonth);
  }
}

function navigateDate(delta) {
  // 한국시간 기준으로 날짜 계산 (UTC 변환 없이)
  const newDate = new Date(currentDate);
  
  switch (currentPeriod) {
    case 'day':
      newDate.setDate(newDate.getDate() + delta);
      break;
    case 'week':
      newDate.setDate(newDate.getDate() + (delta * 7));
      break;
    case 'month':
      newDate.setMonth(newDate.getMonth() + delta);
      break;
  }
  
  currentDate = newDate;
  loadStats();
}

function updateDateDisplay() {
  const dateElement = document.querySelector('#current-date');
  if (!dateElement) return;

  // currentDate는 이미 한국시간으로 저장되어 있음
  const koreanCurrentDate = new Date(currentDate);

  switch (currentPeriod) {
    case 'day':
      const dayOfWeek = koreanCurrentDate.toLocaleDateString('ko-KR', { weekday: 'short' });
      dateElement.textContent = `${koreanCurrentDate.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })} (${dayOfWeek})`;
      break;
    case 'week':
      const weekStart = new Date(koreanCurrentDate);
      // 월요일(1)을 시작으로 하는 주간 계산
      const currentDayOfWeek = koreanCurrentDate.getDay();
      const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1; // 일요일이면 6일 전, 아니면 (요일-1)일 전
      weekStart.setDate(koreanCurrentDate.getDate() - daysToMonday);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      dateElement.textContent = `${weekStart.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`;
      break;
    case 'month':
      dateElement.textContent = koreanCurrentDate.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long'
      });
      break;
  }
}

async function loadStats() {
  const loadingElement = document.querySelector('#stats-loading');
  const resultsElement = document.querySelector('#stats-results');
  
  if (loadingElement) loadingElement.style.display = 'block';
  if (resultsElement) resultsElement.innerHTML = '';

  try {
    // 날짜 범위 계산
    const { startDate, endDate } = calculateDateRange();
    
    // API 호출
    const response = await fetch(`/api/stats?period=${currentPeriod}&startDate=${startDate}&endDate=${endDate}`);
    const stats = await response.json();
    
    if (loadingElement) loadingElement.style.display = 'none';
    if (resultsElement) {
      resultsElement.innerHTML = renderStatsResults(stats);
      // 트레이너 행 이벤트 리스너 다시 설정
      setupTrainerRowEventListeners();
      // 상세통계 버튼 이벤트 리스너 설정
      setupDetailStatsButton(stats.trainerStats || []);
      // 툴팁 이벤트 설정
      setupValidMembersTooltip();
      setupCenterTooltips();
      // 월별 통계 로드 (완료 후 이벤트 리스너 설정)
      loadMonthlyStats().then(() => {
        // 월별 통계 행 클릭 이벤트 설정
        setupMonthlyStatsRowEventListeners();
      });
    }
    
    updateDateDisplay();
  } catch (error) {
    console.error('통계 로드 오류:', error);
    if (loadingElement) loadingElement.style.display = 'none';
    if (resultsElement) {
      resultsElement.innerHTML = '<div style="color:#d32f2f;text-align:center;padding:40px;">통계를 불러오지 못했습니다.</div>';
    }
  }
}

function calculateDateRange() {
  // currentDate는 이미 한국시간으로 저장되어 있음
  const koreanCurrentDate = new Date(currentDate);
  const startDate = new Date(koreanCurrentDate);
  let endDate = new Date(koreanCurrentDate);
  
  switch (currentPeriod) {
    case 'day':
      // 같은 날
      break;
    case 'week':
      // 주의 시작 (월요일)과 끝 (일요일)
      const dayOfWeek = koreanCurrentDate.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 일요일이면 6일 전, 아니면 (요일-1)일 전
      startDate.setDate(koreanCurrentDate.getDate() - daysToMonday);
      endDate = new Date(startDate); // startDate의 복사본으로 설정
      endDate.setDate(startDate.getDate() + 6);
      break;
    case 'month':
      // 월의 시작과 끝
      startDate.setDate(1);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);
      break;
  }
  
  // 한국시간 기준으로 날짜 문자열 생성
  const getKoreanDateString = (date) => {
    // 한국시간 기준으로 날짜 문자열 생성 (UTC 변환 없이)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  return {
    startDate: getKoreanDateString(startDate),
    endDate: getKoreanDateString(endDate)
  };
}

function renderStatsResults(stats) {
  // 센터별 유효회원수 툴팁 내용 생성
  const centerTooltipContent = stats.centerValidMembers ? 
    Object.entries(stats.centerValidMembers)
      .map(([center, count]) => `<div>${center}: ${count}명</div>`)
      .join('') : '센터별 데이터가 없습니다.';
  
  // 센터별 총 세션 툴팁 내용 생성
  const centerTotalSessionsContent = generateCenterSessionsContent(stats.centerSessions, 'total', '총 세션');
  
  // 센터별 완료 세션 툴팁 내용 생성
  const centerCompletedSessionsContent = generateCenterSessionsContent(stats.centerSessions, 'completed', '완료 세션');
  
  // 센터별 예정 세션 툴팁 내용 생성
  const centerScheduledSessionsContent = generateCenterSessionsContent(stats.centerSessions, 'scheduled', '예정 세션');
  
  // 센터별 결석 세션 툴팁 내용 생성
  const centerAbsentSessionsContent = generateCenterSessionsContent(stats.centerSessions, 'absent', '결석 세션');
  
  // 센터별 잔여세션수 툴팁 내용 생성
  const centerRemainingSessionsContent = stats.centerRemainingSessions ? 
    Object.entries(stats.centerRemainingSessions)
      .sort(([,a], [,b]) => b - a)
      .map(([center, count]) => `<div>${center}: ${count}회</div>`)
      .join('') : '센터별 데이터가 없습니다.';
  
  return `
    <div class="stats-grid">
      <div class="stats-card" id="validMembersCard" style="position:relative;cursor:help;">
        <div class="stats-card-title">유효 회원수</div>
        <div class="stats-card-value">${stats.totalValidMembers || 0}</div>
        <div class="center-tooltip" style="display:none;position:absolute;top:100%;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:8px 12px;border-radius:6px;font-size:0.8rem;white-space:nowrap;z-index:1000;margin-top:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
          <div style="font-weight:600;margin-bottom:4px;text-align:center;">센터별 유효회원수</div>
          ${centerTooltipContent}
        </div>
      </div>
      <div class="stats-card" id="totalSessionsCard" style="position:relative;cursor:help;">
        <div class="stats-card-title">총 세션 수</div>
        <div class="stats-card-value">${stats.totalSessions || 0}</div>
        <div class="center-tooltip" style="display:none;position:absolute;top:100%;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:8px 12px;border-radius:6px;font-size:0.8rem;white-space:nowrap;z-index:1000;margin-top:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
          <div style="font-weight:600;margin-bottom:4px;text-align:center;">센터별 총 세션</div>
          ${centerTotalSessionsContent}
        </div>
      </div>
      <div class="stats-card" id="completedSessionsCard" style="position:relative;cursor:help;">
        <div class="stats-card-title">완료된 세션</div>
        <div class="stats-card-value">${stats.completedSessions || 0}${stats.completedTrialOrAnonymous > 0 ? `(${stats.completedTrialOrAnonymous})` : ''}</div>
        <div class="center-tooltip" style="display:none;position:absolute;top:100%;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:8px 12px;border-radius:6px;font-size:0.8rem;white-space:nowrap;z-index:1000;margin-top:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
          <div style="font-weight:600;margin-bottom:4px;text-align:center;">센터별 완료 세션</div>
          ${centerCompletedSessionsContent}
        </div>
      </div>
      <div class="stats-card" id="scheduledSessionsCard" style="position:relative;cursor:help;">
        <div class="stats-card-title">예정된 세션</div>
        <div class="stats-card-value">${stats.scheduledSessions || 0}</div>
        <div class="center-tooltip" style="display:none;position:absolute;top:100%;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:8px 12px;border-radius:6px;font-size:0.8rem;white-space:nowrap;z-index:1000;margin-top:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
          <div style="font-weight:600;margin-bottom:4px;text-align:center;">센터별 예정 세션</div>
          ${centerScheduledSessionsContent}
        </div>
      </div>
      <div class="stats-card" id="absentSessionsCard" style="position:relative;cursor:help;">
        <div class="stats-card-title">결석 세션</div>
        <div class="stats-card-value">${stats.absentSessions || 0}</div>
        <div class="center-tooltip" style="display:none;position:absolute;top:100%;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:8px 12px;border-radius:6px;font-size:0.8rem;white-space:nowrap;z-index:1000;margin-top:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
          <div style="font-weight:600;margin-bottom:4px;text-align:center;">센터별 결석 세션</div>
          ${centerAbsentSessionsContent}
        </div>
      </div>
      <div class="stats-card" id="remainingSessionsCard" style="position:relative;cursor:help;">
        <div class="stats-card-title">잔여 세션수</div>
        <div class="stats-card-value">${stats.totalRemainingSessions || 0}</div>
        <div class="center-tooltip" style="display:none;position:absolute;top:100%;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:8px 12px;border-radius:6px;font-size:0.8rem;white-space:nowrap;z-index:1000;margin-top:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
          <div style="font-weight:600;margin-bottom:4px;text-align:center;">센터별 잔여세션수</div>
          ${centerRemainingSessionsContent}
        </div>
      </div>
    </div>
    <div class="stats-details">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h4 style="margin:0;">트레이너별 통계</h4>
        <button id="trainer-detail-stats-btn" 
                style="background:#1976d2;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:0.9rem;white-space:nowrap;transition:background-color 0.2s;" 
                onmouseover="this.style.backgroundColor='#1565c0'" 
                onmouseout="this.style.backgroundColor='#1976d2'">
          상세통계
        </button>
      </div>
      <div class="trainer-stats">
        ${renderTrainerStats(stats.trainerStats || [])}
      </div>
    </div>
    <div class="stats-details">
      <h4>월별 등록 세션</h4>
      <div id="monthly-stats-container">
        <div style="text-align:center;color:#888;padding:20px;">월별 통계를 불러오는 중...</div>
      </div>
    </div>
  `;
}

function renderTrainerStats(trainerStats) {
  if (!trainerStats.length) {
    return '<div style="color:#888;text-align:center;padding:20px;">트레이너별 데이터가 없습니다.</div>';
  }
  
  // 트레이너를 가나다순으로 정렬
  const sortedTrainerStats = trainerStats.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  
  return `
    <table class="trainer-stats-table">
      <thead>
        <tr>
          <th>트레이너</th>
          <th>유효 회원수</th>
          <th>총 세션</th>
          <th>완료</th>
          <th>예정</th>
          <th>결석</th>
        </tr>
      </thead>
      <tbody>
        ${sortedTrainerStats.map(trainer => `
          <tr class="trainer-row" data-trainer="${trainer.username}" data-name="${trainer.name}" style="cursor:pointer;transition:background-color 0.2s;">
            <td style="color:#1976d2;font-weight:600;">${trainer.name}</td>
            <td>${trainer.memberCount || 0}</td>
            <td>${trainer.total}</td>
            <td>${trainer.completed}${trainer.completedTrialOrAnonymous > 0 ? `(${trainer.completedTrialOrAnonymous})` : ''}</td>
            <td>${trainer.scheduled}</td>
            <td>${trainer.absent || 0}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// 월별 통계 로드
async function loadMonthlyStats() {
  try {
    const response = await fetch('/api/monthly-stats/all');
    const monthlyStats = await response.json();
    
    const container = document.querySelector('#monthly-stats-container');
    
    if (container) {
      const renderedContent = renderMonthlyStats(monthlyStats);
      container.innerHTML = renderedContent;
    }
  } catch (error) {
    console.error('월별 통계 로드 오류:', error);
    const container = document.querySelector('#monthly-stats-container');
    if (container) {
      container.innerHTML = '<div style="color:#d32f2f;text-align:center;padding:20px;">월별 통계를 불러오지 못했습니다.</div>';
    }
  }
}

// 월별 통계 렌더링 - 한국시간 기준
function renderMonthlyStats(monthlyStats) {
  if (!monthlyStats || !monthlyStats.length) {
    return '<div style="color:#888;text-align:center;padding:20px;">월별 데이터가 없습니다.</div>';
  }
  
  const tableRows = monthlyStats.map((stat) => {
    const yearMonth = stat.year_month;
    const displayMonth = yearMonth ? `${yearMonth.split('-')[0]}년 ${yearMonth.split('-')[1]}월` : '';
    
    return `
      <tr class="monthly-stat-row" data-year-month="${yearMonth}" style="border-bottom:1px solid #eee;cursor:pointer;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f8ff'" onmouseout="this.style.backgroundColor=''">
        <td style="padding:12px;text-align:left;">${displayMonth}</td>
        <td style="padding:12px;text-align:center;">${stat.new_sessions || 0}</td>
        <td style="padding:12px;text-align:center;">${stat.re_registration_sessions || 0}</td>
        <td style="padding:12px;text-align:center;font-weight:bold;">${stat.total_sessions || 0}</td>
      </tr>
    `;
  }).join('');
  
  return `
    <table class="monthly-stats-table" style="width:100%;border-collapse:collapse;margin-top:10px;">
      <thead>
        <tr style="background:#f5f5f5;">
          <th style="padding:12px;text-align:left;border-bottom:2px solid #ddd;color:#1976d2;">월</th>
          <th style="padding:12px;text-align:center;border-bottom:2px solid #ddd;color:#1976d2;">신규 세션</th>
          <th style="padding:12px;text-align:center;border-bottom:2px solid #ddd;color:#1976d2;">재등록 세션</th>
          <th style="padding:12px;text-align:center;border-bottom:2px solid #ddd;color:#1976d2;">총 세션</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  `;
} 

// 현재 년월 반환 함수 - 한국시간 기준
function getCurrentYearMonth() {
  const koreanTime = getKoreanDate();
  const year = koreanTime.getFullYear();
  const month = String(koreanTime.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// 통계 페이지에서 선택된 년월 반환 함수 - 한국시간 기준
function getSelectedYearMonth() {
  // currentDate는 UTC로 저장되어 있으므로 한국시간으로 변환
  const koreanTime = new Date(currentDate.getTime() + (9 * 60 * 60 * 1000));
  const year = koreanTime.getFullYear();
  const month = String(koreanTime.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// 트레이너 세션 모달 표시 함수
async function showTrainerSessionsModal(trainer, trainerName, yearMonth) {
  try {
    // 로딩 모달 표시
    showModal(`
      <div style="text-align:center;padding:40px;">
        <div>${trainerName} 트레이너의 세션을 불러오는 중...</div>
      </div>
    `);
    
    // API 호출
    const response = await fetch(`/api/trainer-sessions?trainer=${encodeURIComponent(trainer)}&yearMonth=${yearMonth}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || '세션 조회에 실패했습니다.');
    }
    
    // 모달 내용 렌더링
    const modalContent = renderTrainerSessionsModal(data, trainerName, yearMonth);
    showModal(modalContent);
    
  } catch (error) {
    console.error('트레이너 세션 조회 오류:', error);
    showModal(`
      <div style="text-align:center;padding:40px;color:#d32f2f;">
        <div>세션 조회에 실패했습니다.</div>
        <div style="font-size:0.9em;margin-top:10px;">${error.message}</div>
      </div>
    `);
  }
}

// 트레이너 세션 모달 렌더링 - 한국시간 기준
function renderTrainerSessionsModal(data, trainerName, yearMonth) {
  const { sessions, summary } = data;
  const displayYearMonth = yearMonth ? `${yearMonth.split('-')[0]}년 ${yearMonth.split('-')[1]}월` : '';
  
  return `
    <div class="trainer-sessions-modal">
      <div class="modal-header" style="padding:8px 15px;border-bottom:1px solid #ddd;">
        <h3 style="margin:0;font-size:1.1em;">${trainerName} - ${displayYearMonth}</h3>
        <button class="modal-close-btn" id="modal-close-btn">×</button>
      </div>
      
      <div class="modal-body">
        <div class="sessions-summary" style="display:flex;justify-content:space-around;margin-bottom:8px;padding:6px;background:#f8f9fa;border-radius:3px;font-size:0.8em;">
          <span style="color:#666;">총: <strong>${summary.totalSessions}</strong></span>
          <span style="color:#4caf50;">완료: <strong>${summary.completedSessions}${summary.completedTrialOrAnonymous > 0 ? `(${summary.completedTrialOrAnonymous})` : ''}</strong></span>
          <span style="color:#2196f3;">예정: <strong>${summary.pendingSessions}</strong></span>
          <span style="color:#f44336;">결석: <strong>${summary.absentSessions}</strong></span>
        </div>
        
        <div class="sessions-table-container">
          ${sessions.length > 0 ? `
            <table class="trainer-sessions-table" style="width:100%;border-collapse:separate;border-spacing:0;font-size:0.85em;">
              <thead>
                <tr style="background:#f5f5f5;">
                  <th style="text-align:center;padding:8px 8px;border-bottom:2px solid #ddd;font-size:0.9em;min-width:80px;">날짜</th>
                  <th style="text-align:center;padding:8px 8px;border-bottom:2px solid #ddd;font-size:0.9em;min-width:60px;">시간</th>
                  <th style="text-align:center;padding:8px 8px;border-bottom:2px solid #ddd;font-size:0.9em;min-width:100px;">회원명</th>
                  <th style="text-align:center;padding:8px 8px;border-bottom:2px solid #ddd;font-size:0.9em;min-width:80px;">상태</th>
                </tr>
              </thead>
              <tbody>
                ${sessions.map(session => `
                  <tr style="border-bottom:1px solid #eee;">
                    <td style="text-align:center;padding:6px 8px;">${formatDate(session.date)}</td>
                    <td style="text-align:center;padding:6px 8px;">${session.time.substring(0, 5)}</td>
                    <td style="text-align:center;padding:6px 8px;">${session.member}</td>
                    <td style="text-align:center;padding:6px 8px;">
                      <span class="session-status status-${getStatusClass(session.displayStatus)}" style="padding:2px 8px;border-radius:4px;font-size:0.8em;">
                        ${session.displayStatus}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <div style="text-align:center;padding:40px;color:#888;">
              <div>이번 달에는 세션이 없습니다.</div>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

// 모달 표시 함수
function showModal(content) {
  // 기존 모달 제거
  const existingModal = document.querySelector('.modal-overlay');
  if (existingModal) {
    existingModal.remove();
  }
  
  // 새 모달 생성
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.innerHTML = content;
  
  document.body.appendChild(modalOverlay);
  
  // 모달 표시 애니메이션
  setTimeout(() => {
    modalOverlay.style.opacity = '1';
  }, 10);
  
  // 모달 이벤트 리스너 설정
  setupModalEventListeners();
}

// 모달 닫기 함수
function closeModal() {
  const modalOverlay = document.querySelector('.modal-overlay');
  if (modalOverlay) {
    modalOverlay.style.opacity = '0';
    setTimeout(() => {
      modalOverlay.remove();
    }, 300);
  }
}

// 모달 이벤트 리스너 설정
function setupModalEventListeners() {
  const modalOverlay = document.querySelector('.modal-overlay');
  if (modalOverlay) {
    // 배경 클릭 시 닫기
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        closeModal();
      }
    });
    
    // X 버튼 클릭 시 닫기
    const closeBtn = modalOverlay.querySelector('#modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        closeModal();
      });
    }
  }
}

// 날짜 포맷 함수 - 한국시간 기준
function formatDate(dateStr) {
  // 서버에서 받은 날짜는 UTC 형식이므로 한국시간으로 변환
  const date = new Date(dateStr);
  // UTC 날짜를 한국시간으로 변환 (9시간 추가)
  const koreanDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
  return koreanDate.toLocaleDateString('ko-KR', {
    month: '2-digit',
    day: '2-digit'
  });
}

// 상태 클래스 반환 함수
function getStatusClass(status) {
  switch (status) {
    case '완료': return 'completed';
    case '예정': return 'pending';
    case '결석': return 'absent';
    case '잔여세션 부족': return 'no-remaining';
    default: return 'pending';
  }
}

// 전체 트레이너 상세통계 모달 표시 함수
async function showAllTrainersDetailStatsModal(trainerStats) {
  try {
    // 센터 목록 가져오기 (DB 순서 유지)
    const centersResponse = await fetch('/api/centers');
    const centersData = await centersResponse.json();
    const centerOrder = centersData.map(c => c.name); // 센터 순서 배열
    
    const modalContent = renderAllTrainersDetailStatsModal(trainerStats, centerOrder);
    showModal(modalContent);
  } catch (error) {
    console.error('센터 목록 조회 오류:', error);
    // 에러 발생 시 가나다순 정렬로 대체
    const modalContent = renderAllTrainersDetailStatsModal(trainerStats, []);
    showModal(modalContent);
  }
}

// 전체 트레이너 상세통계 모달 렌더링 함수
function renderAllTrainersDetailStatsModal(trainerStats, centerOrder = []) {
  const selectedYearMonth = getSelectedYearMonth();
  const displayYearMonth = selectedYearMonth ? `${selectedYearMonth.split('-')[0]}년 ${selectedYearMonth.split('-')[1]}월` : '';
  
  // 트레이너가 없는 경우
  if (!trainerStats || trainerStats.length === 0) {
    return `
      <div style="max-width:1440px;width:81vw;max-height:90vh;overflow-y:auto;position:relative;padding:16px;">
        <button id="modal-close-btn" style="position:absolute;top:8px;right:8px;background:none;border:none;font-size:18px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
        <h3 style="color:#1976d2;margin-bottom:12px;text-align:center;padding-right:35px;font-size:1.1rem;">전체 트레이너 상세통계 - ${displayYearMonth}</h3>
        <div style="color:#888;text-align:center;padding:40px;font-size:0.85rem;">트레이너 데이터가 없습니다.</div>
      </div>
    `;
  }
  
  // 트레이너별 통계 HTML 생성 (가나다순 정렬)
  const sortedTrainerStats = [...trainerStats].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  
  const trainerStatsHTML = sortedTrainerStats.map(trainer => {
    // 센터별 통계가 없는 트레이너 처리
    if (!trainer.centerStats || Object.keys(trainer.centerStats).length === 0) {
      return `
        <div class="trainer-detail-section" style="margin-bottom:12px;padding:10px 12px;background:#fff;border-radius:6px;border:1px solid #e0e0e0;">
          <h3 style="margin:0 0 8px 0;color:#1976d2;font-size:0.9rem;display:flex;align-items:center;font-weight:600;">
            👤 ${trainer.name}
          </h3>
          <div style="color:#888;text-align:center;padding:12px;font-size:0.75rem;">센터별 데이터가 없습니다.</div>
        </div>
      `;
    }
    
    // 센터별 통계 HTML 생성 (DB 배열 순서대로)
    const centerEntries = Object.entries(trainer.centerStats || {});
    
    // 센터 순서가 있으면 그 순서대로 정렬, 없으면 가나다순 정렬
    const sortedCenterEntries = centerOrder.length > 0
      ? centerEntries.sort(([centerA], [centerB]) => {
          const indexA = centerOrder.indexOf(centerA);
          const indexB = centerOrder.indexOf(centerB);
          // 순서 배열에 없는 경우 맨 뒤로
          if (indexA === -1 && indexB === -1) return centerA.localeCompare(centerB, 'ko');
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        })
      : centerEntries.sort(([centerA], [centerB]) => centerA.localeCompare(centerB, 'ko'));
    
    const centerStatsHTML = sortedCenterEntries
      .map(([center, stats]) => `
        <div class="center-stat-card" style="padding:8px 10px;background:#f8f9fa;border-radius:6px;border-left:3px solid #1976d2;flex:1;min-width:220px;max-width:320px;">
          <h4 style="margin:0 0 6px 0;color:#1976d2;font-size:0.75rem;display:flex;align-items:center;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            📍 ${center}
          </h4>
          <div class="center-stat-grid" style="display:grid;grid-template-columns:repeat(5, 1fr);gap:6px;">
            <div class="stat-item" style="padding:4px 6px;background:#fff;border-radius:4px;">
              <div style="font-size:0.65rem;color:#666;margin-bottom:1px;line-height:1.1;">회원수</div>
              <div style="font-size:0.9rem;font-weight:bold;color:#1976d2;line-height:1.2;">${stats.memberCount || 0}명</div>
            </div>
            <div class="stat-item" style="padding:4px 6px;background:#fff;border-radius:4px;">
              <div style="font-size:0.65rem;color:#666;margin-bottom:1px;line-height:1.1;">총 세션</div>
              <div style="font-size:0.9rem;font-weight:bold;color:#333;line-height:1.2;">${stats.total || 0}개</div>
            </div>
            <div class="stat-item" style="padding:4px 6px;background:#fff;border-radius:4px;">
              <div style="font-size:0.65rem;color:#666;margin-bottom:1px;line-height:1.1;">완료</div>
              <div style="font-size:0.9rem;font-weight:bold;color:#4caf50;line-height:1.2;">
                ${stats.completed || 0}개
                ${stats.completedTrialOrAnonymous > 0 ? `<span style="font-size:0.6rem;color:#888;display:block;margin-top:1px;">(${stats.completedTrialOrAnonymous})</span>` : ''}
              </div>
            </div>
            <div class="stat-item" style="padding:4px 6px;background:#fff;border-radius:4px;">
              <div style="font-size:0.65rem;color:#666;margin-bottom:1px;line-height:1.1;">예정</div>
              <div style="font-size:0.9rem;font-weight:bold;color:#2196f3;line-height:1.2;">${stats.scheduled || 0}개</div>
            </div>
            <div class="stat-item" style="padding:4px 6px;background:#fff;border-radius:4px;">
              <div style="font-size:0.65rem;color:#666;margin-bottom:1px;line-height:1.1;">결석</div>
              <div style="font-size:0.9rem;font-weight:bold;color:#f44336;line-height:1.2;">${stats.absent || 0}개</div>
            </div>
          </div>
        </div>
      `).join('');
    
    return `
      <div class="trainer-detail-section" style="margin-bottom:12px;padding:10px 12px;background:#fff;border-radius:6px;border:1px solid #e0e0e0;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
        <h3 style="margin:0 0 8px 0;color:#1976d2;font-size:0.85rem;display:flex;align-items:center;padding-bottom:6px;border-bottom:1px solid #e0e0e0;font-weight:600;">
          👤 ${trainer.name}
          <span style="margin-left:8px;font-size:0.7rem;color:#888;font-weight:normal;">
            (전체: 회원 ${trainer.memberCount || 0}명, 완료 ${trainer.completed || 0}개)
          </span>
        </h3>
        <div class="trainer-centers-container" style="display:flex;gap:8px;flex-wrap:wrap;">
          ${centerStatsHTML || '<div style="color:#888;font-size:0.7rem;padding:8px;">센터별 데이터가 없습니다.</div>'}
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <div style="max-width:1440px;width:81vw;max-height:90vh;overflow-y:auto;position:relative;padding:16px;background:#f5f5f5;">
      <button id="modal-close-btn" 
              style="position:fixed;top:16px;right:16px;background:#fff;border:2px solid #ddd;font-size:18px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:all 0.2s;z-index:1001;box-shadow:0 2px 4px rgba(0,0,0,0.1);" 
              onmouseover="this.style.backgroundColor='#f0f0f0';this.style.borderColor='#999';" 
              onmouseout="this.style.backgroundColor='#fff';this.style.borderColor='#ddd';">
        ×
      </button>
      <h2 style="color:#1976d2;margin:0 0 6px 0;text-align:center;padding-right:40px;font-size:1.1rem;font-weight:600;">
        전체 트레이너 상세통계
      </h2>
      <div style="text-align:center;color:#888;font-size:0.8rem;margin-bottom:16px;">
        ${displayYearMonth}
      </div>
      <div class="all-trainers-detail-stats-container" style="background:#fff;padding:14px;border-radius:6px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
        ${trainerStatsHTML}
      </div>
    </div>
  `;
}

// 상세통계 버튼 이벤트 리스너 설정 함수
function setupDetailStatsButton(trainerStats) {
  const detailStatsBtn = document.getElementById('trainer-detail-stats-btn');
  if (detailStatsBtn) {
    // 기존 이벤트 리스너 제거 (중복 방지)
    const newBtn = detailStatsBtn.cloneNode(true);
    detailStatsBtn.parentNode.replaceChild(newBtn, detailStatsBtn);
    
    // 새 이벤트 리스너 추가
    newBtn.addEventListener('click', () => {
      showAllTrainersDetailStatsModal(trainerStats);
    });
  }
} 