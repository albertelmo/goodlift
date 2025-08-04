// 관리자 통계 모듈
export const adminStats = {
  render
};

let currentPeriod = 'month'; // 'day', 'week', 'month'
let currentDate = new Date();

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

function navigateDate(delta) {
  switch (currentPeriod) {
    case 'day':
      currentDate.setDate(currentDate.getDate() + delta);
      break;
    case 'week':
      currentDate.setDate(currentDate.getDate() + (delta * 7));
      break;
    case 'month':
      currentDate.setMonth(currentDate.getMonth() + delta);
      break;
  }
  loadStats();
}

function updateDateDisplay() {
  const dateElement = document.querySelector('#current-date');
  if (!dateElement) return;

  switch (currentPeriod) {
    case 'day':
      dateElement.textContent = currentDate.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      break;
    case 'week':
      const weekStart = new Date(currentDate);
      weekStart.setDate(currentDate.getDate() - currentDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      dateElement.textContent = `${weekStart.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`;
      break;
    case 'month':
      dateElement.textContent = currentDate.toLocaleDateString('ko-KR', {
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
      // 월별 통계 로드
      loadMonthlyStats();
      // 트레이너 행 이벤트 리스너 다시 설정
      setupTrainerRowEventListeners();
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
  const startDate = new Date(currentDate);
  const endDate = new Date(currentDate);
  
  switch (currentPeriod) {
    case 'day':
      // 같은 날
      break;
    case 'week':
      // 주의 시작 (일요일)과 끝 (토요일)
      startDate.setDate(currentDate.getDate() - currentDate.getDay());
      endDate.setDate(startDate.getDate() + 6);
      break;
    case 'month':
      // 월의 시작과 끝
      startDate.setDate(1);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);
      break;
  }
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}

function renderStatsResults(stats) {
  return `
    <div class="stats-grid">
      <div class="stats-card">
        <div class="stats-card-title">총 세션 수</div>
        <div class="stats-card-value">${stats.totalSessions || 0}</div>
      </div>
      <div class="stats-card">
        <div class="stats-card-title">완료된 세션</div>
        <div class="stats-card-value">${stats.completedSessions || 0}${stats.completedTrialOrAnonymous > 0 ? `(${stats.completedTrialOrAnonymous})` : ''}</div>
      </div>
      <div class="stats-card">
        <div class="stats-card-title">예정된 세션</div>
        <div class="stats-card-value">${stats.scheduledSessions || 0}</div>
      </div>
      <div class="stats-card">
        <div class="stats-card-title">결석 세션</div>
        <div class="stats-card-value">${stats.absentSessions || 0}</div>
      </div>
    </div>
    <div class="stats-details">
      <h4>트레이너별 통계</h4>
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
          <th>담당 회원수</th>
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
      container.innerHTML = renderMonthlyStats(monthlyStats);
    }
  } catch (error) {
    console.error('월별 통계 로드 오류:', error);
    const container = document.querySelector('#monthly-stats-container');
    if (container) {
      container.innerHTML = '<div style="color:#d32f2f;text-align:center;padding:20px;">월별 통계를 불러오지 못했습니다.</div>';
    }
  }
}

// 월별 통계 렌더링
function renderMonthlyStats(monthlyStats) {
  if (!monthlyStats.length) {
    return '<div style="color:#888;text-align:center;padding:20px;">월별 데이터가 없습니다.</div>';
  }
  
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
        ${monthlyStats.map(stat => {
          const yearMonth = stat.year_month;
          const displayMonth = yearMonth ? `${yearMonth.split('-')[0]}년 ${yearMonth.split('-')[1]}월` : '';
          return `
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:12px;text-align:left;">${displayMonth}</td>
              <td style="padding:12px;text-align:center;">${stat.new_sessions || 0}</td>
              <td style="padding:12px;text-align:center;">${stat.re_registration_sessions || 0}</td>
              <td style="padding:12px;text-align:center;font-weight:bold;">${stat.total_sessions || 0}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
} 

// 현재 년월 반환 함수
function getCurrentYearMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// 통계 페이지에서 선택된 년월 반환 함수
function getSelectedYearMonth() {
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
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

// 트레이너 세션 모달 렌더링
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

// 날짜 포맷 함수
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ko-KR', {
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