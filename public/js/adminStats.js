// 관리자 통계 모듈
export const adminStats = {
  render
};

let currentPeriod = 'day'; // 'day', 'week', 'month'
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
        <div class="stats-card-value">${stats.completedSessions || 0}</div>
      </div>
      <div class="stats-card">
        <div class="stats-card-title">예정된 세션</div>
        <div class="stats-card-value">${stats.scheduledSessions || 0}</div>
      </div>
    </div>
    <div class="stats-details">
      <h4>트레이너별 통계</h4>
      <div class="trainer-stats">
        ${renderTrainerStats(stats.trainerStats || [])}
      </div>
    </div>
    <div class="stats-details">
      <h4>월별 세션 통계</h4>
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
  
  return `
    <table class="trainer-stats-table">
      <thead>
        <tr>
          <th>트레이너</th>
          <th>총 세션</th>
          <th>완료</th>
          <th>예정</th>
        </tr>
      </thead>
      <tbody>
        ${trainerStats.map(trainer => `
          <tr>
            <td>${trainer.name}</td>
            <td>${trainer.total}</td>
            <td>${trainer.completed}</td>
            <td>${trainer.scheduled}</td>
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