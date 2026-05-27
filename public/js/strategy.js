// 전략 모듈
export const strategy = {
  render
};

// HTML 이스케이프 함수
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 지표 섹션별 추이 차트 설정
const METRIC_SECTIONS = {
  marketing: {
    title: '마케팅',
    series: [
      { key: 'naver_clicks', label: '네이버 클릭', color: '#03c75a' },
      { key: 'karrot_clicks', label: '당근 클릭', color: '#ff6f0f' }
    ]
  },
  pt: {
    title: 'PT',
    series: [
      { key: 'pt_new', label: 'PT 신규', color: '#1976d2' },
      { key: 'pt_consultation', label: 'PT 상담', color: '#64b5f6' },
      { key: 'pt_renewal', label: 'PT 재등록', color: '#4caf50' },
      { key: 'pt_expiring', label: 'PT 만료대상', color: '#ff9800' }
    ]
  },
  membership: {
    title: '회원권',
    hideForPTSpecialty: true,
    series: [
      { key: 'membership_new', label: '회원권 신규', color: '#1976d2' },
      { key: 'membership_renewal', label: '회원권 재등록', color: '#4caf50' },
      { key: 'membership_expiring', label: '회원권 만료대상', color: '#ff9800' }
    ]
  },
  members: {
    title: '회원 수',
    series: [
      { key: 'pt_total_members', label: 'PT 회원', color: '#4caf50', hideForPTSpecialty: true },
      { key: 'total_members', label: '전체 회원', color: '#1976d2' }
    ]
  },
  sales: {
    title: '매출',
    unit: 'manwon',
    series: [
      { key: 'pt_sales', label: 'PT 매출', color: '#4caf50', hideForPTSpecialty: true },
      { key: 'membership_sales', label: '회원권 매출', color: '#ff9800', hideForPTSpecialty: true },
      { key: 'total_sales', label: '전체 매출', color: '#1976d2' }
    ]
  }
};

const METRIC_TREND_CHART_COLORS = ['#1976d2', '#4caf50', '#ff9800', '#9c27b0', '#03c75a', '#ff6f0f', '#64b5f6'];

let metricTrendCharts = [];

function wrapMetricSection(center, sectionId, titleHtml, innerHtml, { bordered = false, marginBottom = true } = {}) {
  const borderStyle = bordered ? 'border-top:1px solid #e0e0e0;padding-top:6px;' : '';
  const mbStyle = marginBottom ? 'margin-bottom:6px;' : '';
  return `
    <div class="metric-section metric-section--clickable"
         data-center="${escapeHtml(center)}"
         data-section="${sectionId}"
         role="button"
         tabindex="0"
         title="최근 12개월 추이 보기"
         style="border-radius:6px;padding:4px 6px;margin-left:-6px;margin-right:-6px;${borderStyle}${mbStyle}cursor:pointer;transition:background 0.15s;">
      <h5 style="margin:0 0 4px 0;color:#666;font-size:0.75rem;font-weight:600;">${titleHtml}</h5>
      ${innerHtml}
    </div>
  `;
}

function formatTrendMonthLabel(monthStr) {
  const [year, month] = monthStr.split('-');
  return `${year.slice(2)}.${parseInt(month, 10)}`;
}

function renderAnnualSalesYtdFooter(center, yearMonth, annualByCenter, isPTSpecialty) {
  const [year, monthStr] = yearMonth.split('-');
  const monthInt = parseInt(monthStr, 10);
  const ytd = annualByCenter?.[center];
  const rangeLabel = monthInt === 1 ? '1월' : `1~${monthInt}월`;

  if (!ytd || ytd.month_count === 0) {
    return `
      <div class="metric-annual-sales" style="border-top:1px dashed #e0e0e0;margin-top:6px;padding-top:6px;font-size:0.7rem;color:#999;">
        ${escapeHtml(year)}년 누적: 데이터 없음
      </div>
    `;
  }

  let rows = '';
  if (!isPTSpecialty) {
    rows += `
      <div style="display:grid;grid-template-columns:1fr auto;gap:3px 4px;font-size:0.75rem;line-height:1.3;">
        <div style="color:#666;">PT:</div>
        <div style="text-align:right;font-weight:600;color:#4caf50;">${formatSalesInManwon(ytd.pt_sales)}</div>
        <div style="color:#666;">회원권:</div>
        <div style="text-align:right;font-weight:600;color:#ff9800;">${formatSalesInManwon(ytd.membership_sales)}</div>
      </div>
    `;
  }
  const monthlyAvgTotal = ytd.month_count > 0
    ? Math.round(ytd.total_sales / ytd.month_count)
    : 0;

  rows += `
    <div style="display:grid;grid-template-columns:1fr auto;gap:3px 4px;font-size:0.75rem;line-height:1.3;${!isPTSpecialty ? 'margin-top:3px;' : ''}">
      <div style="color:#666;">전체:</div>
      <div style="text-align:right;font-weight:700;color:#1976d2;">${formatSalesInManwon(ytd.total_sales)}</div>
      <div style="color:#666;">월평균:</div>
      <div style="text-align:right;font-weight:600;color:#666;">${formatSalesInManwon(monthlyAvgTotal)}</div>
    </div>
  `;

  return `
    <div class="metric-annual-sales" style="border-top:1px dashed #e0e0e0;margin-top:6px;padding-top:6px;">
      <div style="font-size:0.7rem;color:#888;margin-bottom:4px;">${escapeHtml(year)}년 누적 (${rangeLabel})</div>
      ${rows}
    </div>
  `;
}

function aggregateOverallSales(annualByCenter, centers) {
  let total = 0;
  for (const center of centers) {
    const ytd = annualByCenter?.[center];
    if (ytd) total += ytd.total_sales || 0;
  }
  return total;
}

function renderOverallSalesSummary(yearMonth, annualByCenter, centers) {
  const [year, monthStr] = yearMonth.split('-');
  const monthInt = parseInt(monthStr, 10);
  const rangeLabel = monthInt === 1 ? '1월' : `1~${monthInt}월`;
  const totalYtd = aggregateOverallSales(annualByCenter, centers);
  const monthlyAvg = monthInt > 0 ? Math.round(totalYtd / monthInt) : 0;

  const periodLabel = `${escapeHtml(year)}년 (${rangeLabel}) · 만`;
  const summaryBaseStyle = 'margin-bottom:10px;background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:6px 10px;box-shadow:0 1px 2px rgba(0,0,0,0.06);';

  if (totalYtd === 0) {
    return `
      <div id="overall-sales-summary" style="${summaryBaseStyle}">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:0.75rem;line-height:1.3;">
          <span style="font-weight:600;color:#1976d2;">전체 매출</span>
          <span style="color:#888;">${periodLabel}</span>
          <span style="color:#999;">데이터 없음</span>
        </div>
      </div>
    `;
  }

  return `
    <div id="overall-sales-summary" style="${summaryBaseStyle}">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:0.75rem;line-height:1.3;">
        <span style="font-weight:600;color:#1976d2;white-space:nowrap;">전체 매출</span>
        <span style="color:#888;white-space:nowrap;">${periodLabel}</span>
        <div style="display:flex;align-items:baseline;gap:12px;margin-left:auto;">
          <span style="white-space:nowrap;">
            <span style="color:#666;">연간</span>
            <strong style="color:#1976d2;font-size:0.9rem;margin-left:4px;">${formatSalesInManwon(totalYtd)}</strong>
          </span>
          <span style="color:#ddd;">|</span>
          <span style="white-space:nowrap;">
            <span style="color:#666;">월평균</span>
            <strong style="color:#424242;font-size:0.9rem;margin-left:4px;">${formatSalesInManwon(monthlyAvg)}</strong>
          </span>
        </div>
      </div>
    </div>
  `;
}

// 현재 날짜 (한국시간 기준)
let currentDate = new Date();
currentDate.setHours(0, 0, 0, 0);

// 현재 년월 가져오기 (YYYY-MM 형식)
function getCurrentYearMonth() {
  const now = new Date();
  const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  const year = koreanTime.getFullYear();
  const month = String(koreanTime.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// 선택된 년월 가져오기 (YYYY-MM 형식)
function getSelectedYearMonth() {
  // currentDate가 초기화되지 않았으면 현재 날짜 사용
  if (!currentDate) {
    currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
  }
  const koreanTime = new Date(currentDate.getTime() + (9 * 60 * 60 * 1000));
  const year = koreanTime.getFullYear();
  const month = String(koreanTime.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function render(container) {
  if (!container) return;
  
  // 현재 날짜 초기화
  currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  container.innerHTML = `
    <div style="max-width:1200px;margin:0 auto;padding:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
        <h3 id="strategy-title" style="margin:0;color:#1976d2;font-size:1.2rem;cursor:pointer;user-select:none;transition:opacity 0.2s;" title="클릭하여 새로고침" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">📈 전략</h3>
        <div style="display:flex;gap:12px;align-items:center;">
          <button id="strategy-add-btn" class="header-text-btn" style="white-space:nowrap;font-size:15px !important;background:#e3f2fd !important;color:#1976d2 !important;">추가</button>
          <div class="date-navigation">
            <button id="strategy-prev-btn" class="nav-btn">◀</button>
            <span id="strategy-current-date" class="current-date"></span>
            <button id="strategy-next-btn" class="nav-btn">▶</button>
          </div>
        </div>
      </div>
      <div id="strategy-loading" style="text-align:center;padding:40px;color:#888;display:none;">불러오는 중...</div>
      <div id="strategy-content"></div>
    </div>
  `;
  
  // 날짜 표시 업데이트
  updateDateDisplay();
  
  // 이벤트 리스너 설정
  container.querySelector('#strategy-prev-btn').addEventListener('click', () => {
    navigateDate(-1, container);
  });
  
  container.querySelector('#strategy-next-btn').addEventListener('click', () => {
    navigateDate(1, container);
  });
  
  container.querySelector('#strategy-title').addEventListener('click', () => {
    loadStrategyData(container);
  });
  
  container.querySelector('#strategy-add-btn').addEventListener('click', () => {
    showMetricAddModal();
  });
  
  // 초기 데이터 로드
  loadStrategyData(container);
}

function navigateDate(delta, container) {
  const newDate = new Date(currentDate);
  newDate.setDate(1);
  newDate.setMonth(newDate.getMonth() + delta);
  currentDate = newDate;
  updateDateDisplay();
  loadStrategyData(container);
}

function updateDateDisplay() {
  const dateElement = document.querySelector('#strategy-current-date');
  if (!dateElement) return;
  
  const koreanCurrentDate = new Date(currentDate);
  dateElement.textContent = koreanCurrentDate.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long'
  });
}

function loadStrategyData(container) {
  const yearMonth = getSelectedYearMonth();
  fetch('/api/centers')
    .then(r => r.json())
    .then(centers => {
      const centerOrder = centers.map(c => c.name);
      loadMetrics(yearMonth, centerOrder);
    })
    .catch(err => {
      console.error('센터 목록 조회 오류:', err);
      loadMetrics(yearMonth, []);
    });
}

function loadMetrics(yearMonth, centerOrder) {
  const loadingEl = document.getElementById('strategy-loading');
  const contentEl = document.getElementById('strategy-content');
  
  loadingEl.style.display = 'block';
  contentEl.innerHTML = '';
  
  // 지난달 계산
  const [year, month] = yearMonth.split('-');
  const lastMonthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastYear = lastMonthDate.getFullYear();
  const lastMonth = String(lastMonthDate.getMonth() + 1).padStart(2, '0');
  const lastYearMonth = `${lastYear}-${lastMonth}`;
  
  // 이번달, 지난달, YTD 매출 합계를 동시에 가져오기
  Promise.all([
    fetch(`/api/metrics?month=${yearMonth}`).then(r => r.json()),
    fetch(`/api/metrics?month=${lastYearMonth}`).then(r => r.json()),
    fetch(`/api/metrics/annual-sales?throughMonth=${encodeURIComponent(yearMonth)}`)
      .then(r => (r.ok ? r.json() : { byCenter: {} }))
      .catch(() => ({ byCenter: {} }))
  ])
    .then(([currentMetrics, lastMetrics, annualSales]) => {
      loadingEl.style.display = 'none';
      renderMetrics(currentMetrics, lastMetrics, centerOrder, yearMonth, annualSales.byCenter || {});
    })
    .catch(err => {
      loadingEl.style.display = 'none';
      contentEl.innerHTML = `<div style="text-align:center;padding:40px;color:#d32f2f;">데이터를 불러오지 못했습니다.</div>`;
      console.error('지표 조회 오류:', err);
    });
}

function renderMetrics(currentMetrics, lastMetrics, centerOrder, yearMonth, annualSalesByCenter = {}) {
  const contentEl = document.getElementById('strategy-content');
  
  if (!currentMetrics || currentMetrics.length === 0) {
    contentEl.innerHTML = `<div style="text-align:center;padding:40px;color:#888;">지표 데이터가 없습니다.</div>`;
    return;
  }
  
  // 센터별로 그룹화 (이번달)
  const currentCenterGroups = {};
  currentMetrics.forEach(metric => {
    if (!currentCenterGroups[metric.center]) {
      currentCenterGroups[metric.center] = metric;
    }
  });
  
  // 센터별로 그룹화 (지난달)
  const lastCenterGroups = {};
  if (lastMetrics && lastMetrics.length > 0) {
    lastMetrics.forEach(metric => {
      if (!lastCenterGroups[metric.center]) {
        lastCenterGroups[metric.center] = metric;
      }
    });
  }
  
  // 센터 순서대로 정렬
  const sortedCenters = centerOrder.length > 0
    ? centerOrder.filter(center => currentCenterGroups[center])
    : Object.keys(currentCenterGroups).sort((a, b) => a.localeCompare(b, 'ko'));
  
  if (sortedCenters.length === 0) {
    contentEl.innerHTML = `<div style="text-align:center;padding:40px;color:#888;">지표 데이터가 없습니다.</div>`;
    return;
  }
  
  // 증감 계산 함수
  const getChange = (current, last, isSales = false) => {
    const currentVal = current || 0;
    const lastVal = last || 0;
    const diff = currentVal - lastVal;
    if (diff === 0) {
      if (isSales) return { text: '0', color: '#666', rawDiff: 0 };
      return { text: '0', color: '#666', rawDiff: 0 };
    }
    if (diff > 0) {
      if (isSales) {
        const manwon = Math.round(diff / 10000);
        return { text: `+${formatNumber(manwon)}`, color: '#4caf50', rawDiff: diff };
      }
      return { text: `+${formatNumber(diff)}`, color: '#4caf50', rawDiff: diff };
    }
    if (isSales) {
      const manwon = Math.round(Math.abs(diff) / 10000);
      return { text: `-${formatNumber(manwon)}`, color: '#d32f2f', rawDiff: diff };
    }
    return { text: formatNumber(diff), color: '#d32f2f', rawDiff: diff };
  };
  
  let html = renderOverallSalesSummary(yearMonth, annualSalesByCenter, sortedCenters);
  html += '<div style="display:flex;flex-wrap:wrap;gap:12px;">';
  
  sortedCenters.forEach(center => {
    const currentMetric = currentCenterGroups[center];
    const lastMetric = lastCenterGroups[center] || {};
    
    // PT 전문샵 여부 확인 (센터 이름에 "PT" 포함)
    const isPTSpecialty = center.includes('PT');
    
    // 각 지표의 증감 계산
    const naverClicksChange = getChange(currentMetric.naver_clicks, lastMetric.naver_clicks);
    const karrotClicksChange = getChange(currentMetric.karrot_clicks, lastMetric.karrot_clicks);
    const ptNewChange = getChange(currentMetric.pt_new, lastMetric.pt_new);
    const ptConsultationChange = getChange(currentMetric.pt_consultation, lastMetric.pt_consultation);
    const ptRenewalChange = getChange(currentMetric.pt_renewal, lastMetric.pt_renewal);
    const ptExpiringChange = getChange(currentMetric.pt_expiring, lastMetric.pt_expiring);
    const membershipNewChange = getChange(currentMetric.membership_new, lastMetric.membership_new);
    const membershipRenewalChange = getChange(currentMetric.membership_renewal, lastMetric.membership_renewal);
    const membershipExpiringChange = getChange(currentMetric.membership_expiring, lastMetric.membership_expiring);
    const totalMembersChange = getChange(currentMetric.total_members, lastMetric.total_members);
    const ptTotalMembersChange = getChange(currentMetric.pt_total_members, lastMetric.pt_total_members);
    const totalSalesChange = getChange(currentMetric.total_sales, lastMetric.total_sales, true);
    const ptSalesChange = getChange(currentMetric.pt_sales, lastMetric.pt_sales, true);
    const membershipSalesChange = getChange(currentMetric.membership_sales, lastMetric.membership_sales, true);
    
    html += `
      <div class="metric-card" style="flex:0 0 calc(33.333% - 8px);min-width:240px;max-width:none;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,0.1);border-radius:8px;overflow:hidden;">
        <div style="background:#f5f5f5;border-bottom:2px solid #ddd;padding:8px 10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <h4 style="margin:0;color:#1976d2;font-size:0.95rem;font-weight:600;flex:1;">${center}</h4>
            <button class="metric-edit-btn header-text-btn" data-metric-id="${currentMetric.id}" data-metric-data='${JSON.stringify(currentMetric)}' style="background:#e3f2fd !important;color:#1976d2 !important;border:none;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:0.75rem;white-space:nowrap;flex-shrink:0;">수정</button>
          </div>
        </div>
        <div style="padding:8px 10px;">
          ${wrapMetricSection(center, 'marketing', '마케팅', `
            <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:3px 4px;font-size:0.75rem;line-height:1.3;">
              <div style="color:#666;">네이버 클릭:</div>
              <div style="text-align:right;font-weight:600;color:#999;">${formatNumber(lastMetric.naver_clicks || 0)}</div>
              <div style="text-align:right;font-weight:600;">${formatNumber(currentMetric.naver_clicks || 0)}</div>
              <div style="text-align:right;font-weight:600;color:${naverClicksChange.color};">${naverClicksChange.text}</div>
              <div style="color:#666;">당근 클릭:</div>
              <div style="text-align:right;font-weight:600;color:#999;">${formatNumber(lastMetric.karrot_clicks || 0)}</div>
              <div style="text-align:right;font-weight:600;">${formatNumber(currentMetric.karrot_clicks || 0)}</div>
              <div style="text-align:right;font-weight:600;color:${karrotClicksChange.color};">${karrotClicksChange.text}</div>
            </div>
          `)}
          
          ${wrapMetricSection(center, 'pt', 'PT', `
            ${(() => {
              const lastNew = lastMetric.pt_new || 0;
              const lastConsultation = lastMetric.pt_consultation || 0;
              const newCount = currentMetric.pt_new || 0;
              const consultation = currentMetric.pt_consultation || 0;
              const lastPercent = lastConsultation > 0 ? Math.round((lastNew / lastConsultation) * 100) : 0;
              const percent = consultation > 0 ? Math.round((newCount / consultation) * 100) : 0;
              return `
                <div style="display:grid;grid-template-columns:1fr auto auto;gap:3px 4px;font-size:0.75rem;line-height:1.3;">
                  <div style="color:#666;">신규 / 상담:</div>
                  <div style="text-align:right;font-weight:600;color:#999;">${formatNumber(lastNew)} / ${formatNumber(lastConsultation)}${lastConsultation > 0 ? ` <span style="font-size:0.65rem;">(${lastPercent}%)</span>` : ''}</div>
                  <div style="text-align:right;font-weight:600;">${formatNumber(newCount)} / ${formatNumber(consultation)}${consultation > 0 ? ` <span style="font-size:0.65rem;">(${percent}%)</span>` : ''}</div>
                </div>
              `;
            })()}
            ${(() => {
              const lastRenewal = lastMetric.pt_renewal || 0;
              const lastExpiring = lastMetric.pt_expiring || 0;
              const renewal = currentMetric.pt_renewal || 0;
              const expiring = currentMetric.pt_expiring || 0;
              const lastPercent = lastExpiring > 0 ? Math.round((lastRenewal / lastExpiring) * 100) : 0;
              const percent = expiring > 0 ? Math.round((renewal / expiring) * 100) : 0;
              return `
                <div style="display:grid;grid-template-columns:1fr auto auto;gap:3px 4px;font-size:0.75rem;line-height:1.3;margin-top:3px;">
                  <div style="color:#666;">재등록 / 만료:</div>
                  <div style="text-align:right;font-weight:600;color:#999;">${formatNumber(lastRenewal)} / ${formatNumber(lastExpiring)}${lastExpiring > 0 ? ` <span style="font-size:0.65rem;">(${lastPercent}%)</span>` : ''}</div>
                  <div style="text-align:right;font-weight:600;">${formatNumber(renewal)} / ${formatNumber(expiring)}${expiring > 0 ? ` <span style="font-size:0.65rem;">(${percent}%)</span>` : ''}</div>
                </div>
              `;
            })()}
          `, { bordered: true })}
          
          ${!isPTSpecialty ? wrapMetricSection(center, 'membership', '회원권', `
            <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:3px 4px;font-size:0.75rem;line-height:1.3;">
              <div style="color:#666;">신규:</div>
              <div style="text-align:right;font-weight:600;color:#999;">${formatNumber(lastMetric.membership_new || 0)}</div>
              <div style="text-align:right;font-weight:600;">${formatNumber(currentMetric.membership_new || 0)}</div>
              <div style="text-align:right;font-weight:600;color:${membershipNewChange.color};">${membershipNewChange.text}</div>
            </div>
            ${(() => {
              const lastRenewal = lastMetric.membership_renewal || 0;
              const lastExpiring = lastMetric.membership_expiring || 0;
              const renewal = currentMetric.membership_renewal || 0;
              const expiring = currentMetric.membership_expiring || 0;
              const lastPercent = lastExpiring > 0 ? Math.round((lastRenewal / lastExpiring) * 100) : 0;
              const percent = expiring > 0 ? Math.round((renewal / expiring) * 100) : 0;
              return `
                <div style="display:grid;grid-template-columns:1fr auto auto;gap:3px 4px;font-size:0.75rem;line-height:1.3;margin-top:3px;">
                  <div style="color:#666;">재등록 / 만료:</div>
                  <div style="text-align:right;font-weight:600;color:#999;">${formatNumber(lastRenewal)} / ${formatNumber(lastExpiring)}${lastExpiring > 0 ? ` <span style="font-size:0.65rem;">(${lastPercent}%)</span>` : ''}</div>
                  <div style="text-align:right;font-weight:600;">${formatNumber(renewal)} / ${formatNumber(expiring)}${expiring > 0 ? ` <span style="font-size:0.65rem;">(${percent}%)</span>` : ''}</div>
                </div>
              `;
            })()}
          `, { bordered: true }) : ''}
          
          ${wrapMetricSection(center, 'members', '회원 수', `
            <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:3px 4px;font-size:0.75rem;line-height:1.3;">
              ${!isPTSpecialty ? `
              <div style="color:#666;">PT:</div>
              <div style="text-align:right;font-weight:600;color:#999;">${formatNumber(lastMetric.pt_total_members || 0)}</div>
              <div style="text-align:right;font-weight:600;">${formatNumber(currentMetric.pt_total_members || 0)}</div>
              <div style="text-align:right;font-weight:600;color:${ptTotalMembersChange.color};">${ptTotalMembersChange.text}</div>
              ` : ''}
              <div style="color:#666;">전체:</div>
              <div style="text-align:right;font-weight:600;color:#999;">${formatNumber(lastMetric.total_members || 0)}</div>
              <div style="text-align:right;font-weight:600;">${formatNumber(currentMetric.total_members || 0)}</div>
              <div style="text-align:right;font-weight:600;color:${totalMembersChange.color};">${totalMembersChange.text}</div>
            </div>
          `, { bordered: true })}
          
          <div class="metric-sales-block" style="border-top:1px solid #e0e0e0;padding-top:6px;">
            ${wrapMetricSection(center, 'sales', '매출 <span style="color:#999;font-weight:normal;font-size:0.7rem;">(단위:만)</span>', `
              <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:3px 4px;font-size:0.75rem;line-height:1.3;">
                ${!isPTSpecialty ? `
                <div style="color:#666;">PT:</div>
                <div style="text-align:right;font-weight:600;color:#999;">${formatSalesInManwon(lastMetric.pt_sales || 0)}</div>
                <div style="text-align:right;font-weight:600;color:#4caf50;">${formatSalesInManwon(currentMetric.pt_sales || 0)}</div>
                <div style="text-align:right;font-weight:600;color:${ptSalesChange.color};">${ptSalesChange.text}</div>
                <div style="color:#666;">회원권:</div>
                <div style="text-align:right;font-weight:600;color:#999;">${formatSalesInManwon(lastMetric.membership_sales || 0)}</div>
                <div style="text-align:right;font-weight:600;color:#ff9800;">${formatSalesInManwon(currentMetric.membership_sales || 0)}</div>
                <div style="text-align:right;font-weight:600;color:${membershipSalesChange.color};">${membershipSalesChange.text}</div>
                ` : ''}
                <div style="color:#666;">전체:</div>
                <div style="text-align:right;font-weight:600;color:#999;">${formatSalesInManwon(lastMetric.total_sales || 0)}</div>
                <div style="text-align:right;font-weight:600;color:#1976d2;">${formatSalesInManwon(currentMetric.total_sales || 0)}</div>
                <div style="text-align:right;font-weight:600;color:${totalSalesChange.color};">${totalSalesChange.text}</div>
              </div>
            `, { bordered: false, marginBottom: false })}
            ${renderAnnualSalesYtdFooter(center, yearMonth, annualSalesByCenter, isPTSpecialty)}
          </div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  contentEl.innerHTML = html;
  
  // 모바일 환경에서 카드 레이아웃 조정
  const isMobile = window.innerWidth <= 600;
  if (isMobile) {
    document.querySelectorAll('.metric-card').forEach(card => {
      card.style.flex = '0 0 calc(50% - 8px)';
      card.style.minWidth = '200px';
    });
  }
  
  // 수정 버튼 이벤트 리스너
  setupMetricEditListeners();
  setupMetricTrendListeners();
  
  // 마케팅 데이터 로드 및 표시
  loadMarketingData(contentEl, centerOrder, yearMonth);
}

// 마케팅 섹션만 새로고침
async function refreshMarketingSection() {
  const contentEl = document.getElementById('strategy-content');
  if (!contentEl) return;
  
  // 기존 마케팅 섹션 제거
  const existingMarketingSection = contentEl.querySelector('#marketing-section');
  if (existingMarketingSection) {
    existingMarketingSection.remove();
  }
  
  // 센터 목록 가져오기
  let centerOrder = [];
  try {
    const centersResponse = await fetch('/api/centers');
    if (centersResponse.ok) {
      const centers = await centersResponse.json();
      centerOrder = centers.map(c => c.name);
    }
  } catch (err) {
    console.error('센터 목록 조회 오류:', err);
  }
  
  const yearMonth = getSelectedYearMonth();
  await loadMarketingData(contentEl, centerOrder, yearMonth);
}

// 마케팅 데이터 로드
async function loadMarketingData(contentEl, centerOrder, yearMonth) {
  try {
    // 센터 목록이 없으면 가져오기
    let allCenters = centerOrder;
    if (!allCenters || allCenters.length === 0) {
      try {
        const centersResponse = await fetch('/api/centers');
        if (centersResponse.ok) {
          const centers = await centersResponse.json();
          allCenters = centers.map(c => c.name);
        }
      } catch (err) {
        console.error('센터 목록 조회 오류:', err);
      }
    }
    
    // 지난달 계산
    const [year, month] = yearMonth.split('-');
    const lastMonthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastYear = lastMonthDate.getFullYear();
    const lastMonth = String(lastMonthDate.getMonth() + 1).padStart(2, '0');
    const lastYearMonth = `${lastYear}-${lastMonth}`;
    
    // 마케팅 데이터와 지표 데이터를 동시에 가져오기
    const [marketingResponse, currentMetricsResponse, lastMetricsResponse] = await Promise.all([
      fetch(`/api/marketing?month=${yearMonth}`),
      fetch(`/api/metrics?month=${yearMonth}`),
      fetch(`/api/metrics?month=${lastYearMonth}`)
    ]);
    
    if (!marketingResponse.ok) {
      throw new Error('마케팅 데이터를 불러오는데 실패했습니다.');
    }
    
    const marketingData = await marketingResponse.json();
    const currentMetrics = await currentMetricsResponse.json();
    const lastMetrics = await lastMetricsResponse.json();
    
    // 지표를 센터별로 그룹화
    const currentMetricsByCenter = {};
    currentMetrics.forEach(metric => {
      currentMetricsByCenter[metric.center] = metric;
    });
    
    const lastMetricsByCenter = {};
    lastMetrics.forEach(metric => {
      lastMetricsByCenter[metric.center] = metric;
    });
    
    // 증감 계산 함수
    const getChange = (current, last) => {
      const currentVal = current || 0;
      const lastVal = last || 0;
      const diff = currentVal - lastVal;
      if (diff === 0) {
        return { text: '0', color: '#666' };
      }
      if (diff > 0) {
        return { text: `+${formatNumber(diff)}`, color: '#4caf50' };
      }
      return { text: formatNumber(diff), color: '#d32f2f' };
    };
    
    // 지표 표시 함수
    const getMetricDisplay = (center, targetResult) => {
      const currentMetric = currentMetricsByCenter[center] || {};
      const lastMetric = lastMetricsByCenter[center] || {};
      
      if (!targetResult) return '-';
      
      switch (targetResult) {
        case '네이버클릭': {
          const change = getChange(currentMetric.naver_clicks || 0, lastMetric.naver_clicks || 0);
          return `<span style="color:#999;">${formatNumber(lastMetric.naver_clicks || 0)}</span> ${formatNumber(currentMetric.naver_clicks || 0)} <span style="color:${change.color};">${change.text}</span>`;
        }
        case '당근클릭': {
          const change = getChange(currentMetric.karrot_clicks || 0, lastMetric.karrot_clicks || 0);
          return `<span style="color:#999;">${formatNumber(lastMetric.karrot_clicks || 0)}</span> ${formatNumber(currentMetric.karrot_clicks || 0)} <span style="color:${change.color};">${change.text}</span>`;
        }
        case 'PT신규유입': {
          const lastNew = lastMetric.pt_new || 0;
          const lastConsultation = lastMetric.pt_consultation || 0;
          const newCount = currentMetric.pt_new || 0;
          const consultation = currentMetric.pt_consultation || 0;
          const lastPercent = lastConsultation > 0 ? Math.round((lastNew / lastConsultation) * 100) : 0;
          const percent = consultation > 0 ? Math.round((newCount / consultation) * 100) : 0;
          return `<span style="color:#999;">${formatNumber(lastNew)} / ${formatNumber(lastConsultation)}${lastConsultation > 0 ? ` <span style="font-size:0.65rem;">(${lastPercent}%)</span>` : ''}</span> ${formatNumber(newCount)} / ${formatNumber(consultation)}${consultation > 0 ? ` <span style="font-size:0.65rem;">(${percent}%)</span>` : ''}`;
        }
        case 'PT재등록': {
          const lastRenewal = lastMetric.pt_renewal || 0;
          const lastExpiring = lastMetric.pt_expiring || 0;
          const renewal = currentMetric.pt_renewal || 0;
          const expiring = currentMetric.pt_expiring || 0;
          const lastRenewalPercent = lastExpiring > 0 ? Math.round((lastRenewal / lastExpiring) * 100) : 0;
          const renewalPercent = expiring > 0 ? Math.round((renewal / expiring) * 100) : 0;
          return `<span style="color:#999;">${formatNumber(lastRenewal)} / ${formatNumber(lastExpiring)}${lastExpiring > 0 ? ` <span style="font-size:0.65rem;">(${lastRenewalPercent}%)</span>` : ''}</span> ${formatNumber(renewal)} / ${formatNumber(expiring)}${expiring > 0 ? ` <span style="font-size:0.65rem;">(${renewalPercent}%)</span>` : ''}`;
        }
        case '회원권신규': {
          const change = getChange(currentMetric.membership_new || 0, lastMetric.membership_new || 0);
          return `<span style="color:#999;">${formatNumber(lastMetric.membership_new || 0)}</span> ${formatNumber(currentMetric.membership_new || 0)} <span style="color:${change.color};">${change.text}</span>`;
        }
        case '회원권재등록': {
          const lastMemRenewal = lastMetric.membership_renewal || 0;
          const lastMemExpiring = lastMetric.membership_expiring || 0;
          const memRenewal = currentMetric.membership_renewal || 0;
          const memExpiring = currentMetric.membership_expiring || 0;
          const lastMemPercent = lastMemExpiring > 0 ? Math.round((lastMemRenewal / lastMemExpiring) * 100) : 0;
          const memPercent = memExpiring > 0 ? Math.round((memRenewal / memExpiring) * 100) : 0;
          return `<span style="color:#999;">${formatNumber(lastMemRenewal)} / ${formatNumber(lastMemExpiring)}${lastMemExpiring > 0 ? ` <span style="font-size:0.65rem;">(${lastMemPercent}%)</span>` : ''}</span> ${formatNumber(memRenewal)} / ${formatNumber(memExpiring)}${memExpiring > 0 ? ` <span style="font-size:0.65rem;">(${memPercent}%)</span>` : ''}`;
        }
        case '전체회원': {
          const change = getChange(currentMetric.total_members || 0, lastMetric.total_members || 0);
          return `<span style="color:#999;">${formatNumber(lastMetric.total_members || 0)}</span> ${formatNumber(currentMetric.total_members || 0)} <span style="color:${change.color};">${change.text}</span>`;
        }
        default:
          return '-';
      }
    };
    
    // 센터별로 그룹화
    const marketingByCenter = {};
    marketingData.forEach(item => {
      if (!marketingByCenter[item.center]) {
        marketingByCenter[item.center] = [];
      }
      marketingByCenter[item.center].push(item);
    });
    
    // 각 센터별로 타입별 정렬 (On 먼저, 그 다음 Off), 같은 타입 내에서는 늦게 추가된 것이 밑에
    Object.keys(marketingByCenter).forEach(center => {
      marketingByCenter[center].sort((a, b) => {
        // On 타입이 먼저 오도록 정렬
        if (a.type === 'online' && b.type === 'offline') return -1;
        if (a.type === 'offline' && b.type === 'online') return 1;
        // 같은 타입이면 created_at 기준 오름차순 정렬 (늦게 추가된 것이 밑에)
        if (a.type === b.type) {
          const aTime = new Date(a.created_at || 0).getTime();
          const bTime = new Date(b.created_at || 0).getTime();
          return aTime - bTime;
        }
        return 0;
      });
    });
    
    // 각 센터별 비용 합계 계산
    const centerCosts = {};
    let totalCost = 0;
    
    Object.keys(marketingByCenter).forEach(center => {
      const items = marketingByCenter[center] || [];
      let centerCost = 0;
      items.forEach(item => {
        if (item.cost && item.cost !== '완료') {
          const costValue = parseInt(item.cost) || 0;
          centerCost += costValue;
        }
      });
      centerCosts[center] = centerCost;
      totalCost += centerCost;
    });
    
    // 마케팅 섹션 HTML 생성
    let marketingHTML = '<div id="marketing-section" style="margin-top:24px;border-top:2px solid #ddd;padding-top:20px;">';
    marketingHTML += `<h3 style="margin:0 0 16px 0;color:#1976d2;font-size:1.1rem;">마케팅 <span style="color:#666;font-weight:normal;font-size:0.9rem;">(비용 : ${formatNumber(totalCost)}원)</span></h3>`;
    
    // 모든 센터 표시 (데이터가 있는 센터 + 데이터가 없는 센터)
    if (!allCenters || allCenters.length === 0) {
      // 센터 목록도 없고 마케팅 데이터도 없으면
      if (marketingData.length === 0) {
        marketingHTML += '<div style="text-align:center;color:#999;padding:20px;">등록된 마케팅 데이터가 없습니다.</div>';
      } else {
        // 마케팅 데이터만 있으면 해당 센터만 표시
        allCenters = Object.keys(marketingByCenter).sort();
      }
    }
    
    if (allCenters && allCenters.length > 0) {
      allCenters.forEach(center => {
        const items = marketingByCenter[center] || [];
        const centerCost = centerCosts[center] || 0;
        marketingHTML += `
          <div style="margin-bottom:16px;background:#fff;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;">
            <div style="background:#f5f5f5;border-bottom:1px solid #ddd;padding:6px 8px;display:flex;justify-content:space-between;align-items:center;">
              <h4 style="margin:0;color:#1976d2;font-size:0.85rem;font-weight:600;">${center} <span style="color:#666;font-weight:normal;">(비용 : ${formatNumber(centerCost)}원)</span></h4>
              <button class="marketing-add-btn header-text-btn" data-center="${center}" style="background:#e3f2fd !important;color:#1976d2 !important;border:none;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:0.7rem;">추가</button>
            </div>
            <div style="padding:8px;">
              ${items.length === 0 ? '<div style="text-align:center;color:#999;padding:8px;font-size:0.75rem;">등록된 데이터가 없습니다.</div>' : `
                <table style="width:100%;border-collapse:collapse;font-size:0.75rem;">
                  <thead>
                    <tr style="background:#f9f9f9;border-bottom:1px solid #ddd;">
                      <th style="padding:4px 4px;text-align:left;font-weight:600;color:#666;font-size:0.7rem;">타입</th>
                      <th style="padding:4px 4px;text-align:left;font-weight:600;color:#666;font-size:0.7rem;">아이템</th>
                      <th style="padding:4px 4px;text-align:left;font-weight:600;color:#666;font-size:0.7rem;">방향</th>
                      <th style="padding:4px 4px;text-align:left;font-weight:600;color:#666;font-size:0.7rem;">대상</th>
                      <th style="padding:4px 4px;text-align:right;font-weight:600;color:#666;font-size:0.7rem;">비용</th>
                      <th style="padding:4px 4px;text-align:left;font-weight:600;color:#666;font-size:0.7rem;">Action result</th>
                      <th style="padding:4px 4px;text-align:left;font-weight:600;color:#666;font-size:0.7rem;">Target result</th>
                      <th style="padding:4px 4px;text-align:left;font-weight:600;color:#666;font-size:0.7rem;">지표</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items.map(item => `
                      <tr class="marketing-row" data-marketing-id="${item.id}" data-marketing-data='${JSON.stringify(item).replace(/'/g, "&#39;")}' style="border-bottom:1px solid #eee;cursor:pointer;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f5f5f5'" onmouseout="this.style.backgroundColor='transparent'">
                        <td style="padding:4px 4px;">${item.type === 'online' ? 'On' : 'Off'}</td>
                        <td style="padding:4px 4px;">${item.item || '-'}</td>
                        <td style="padding:4px 4px;">${item.direction || '-'}</td>
                        <td style="padding:4px 4px;">${item.target || '-'}</td>
                        <td style="padding:4px 4px;text-align:right;">${item.cost === '완료' ? '완료' : `${formatNumber(item.cost || 0)}원`}</td>
                        <td style="padding:4px 4px;white-space:pre-line;">${escapeHtml(item.action_result || '-')}</td>
                        <td style="padding:4px 4px;">${item.target_result || '-'}</td>
                        <td style="padding:4px 4px;font-size:0.7rem;">${getMetricDisplay(center, item.target_result)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `}
            </div>
          </div>
        `;
      });
    }
    
    marketingHTML += '</div>';
    
    // 기존 콘텐츠에 마케팅 섹션 추가
    contentEl.insertAdjacentHTML('beforeend', marketingHTML);
    
    // 이벤트 리스너 설정
    setupMarketingListeners();
  } catch (error) {
    console.error('마케팅 데이터 로드 오류:', error);
  }
}

// 마케팅 이벤트 리스너 설정
function setupMarketingListeners() {
  // 추가 버튼
  document.querySelectorAll('.marketing-add-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const center = this.getAttribute('data-center');
      showMarketingAddModal(center);
    });
  });
  
  // 행 클릭 이벤트 (수정 모달 열기)
  document.querySelectorAll('.marketing-row').forEach(row => {
    row.addEventListener('click', function() {
      const marketingData = JSON.parse(this.getAttribute('data-marketing-data'));
      showMarketingEditModal(marketingData);
    });
  });
}

// 마케팅 추가 모달
function showMarketingAddModal(center) {
  const yearMonth = getSelectedYearMonth();
  const modalHTML = `
    <div class="marketing-add-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="marketing-add-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:14px;box-shadow:0 8px 32px #1976d240;min-width:500px;max-width:95vw;width:auto;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;color:#1976d2;font-size:1.2rem;">마케팅 추가</h3>
        <button id="marketing-add-modal-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      
      <form id="marketing-add-form" style="display:flex;flex-direction:column;gap:16px;">
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">센터 *</label>
          <input type="text" id="marketing-add-center" value="${center}" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">연월 *</label>
          <input type="month" id="marketing-add-month" value="${yearMonth}" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">타입 *</label>
          <select id="marketing-add-type" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
            <option value="">선택</option>
            <option value="online">On</option>
            <option value="offline">Off</option>
          </select>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">아이템 *</label>
          <select id="marketing-add-item" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
            <option value="">선택</option>
            <option value="직접입력">직접입력</option>
            <option value="N플레이스">N플레이스</option>
            <option value="당근">당근</option>
            <option value="블로그">블로그</option>
            <option value="문자">문자</option>
            <option value="물티슈">물티슈</option>
            <option value="배너">배너</option>
            <option value="전단지">전단지</option>
            <option value="단지게시판">단지게시판</option>
          </select>
          <input type="text" id="marketing-add-item-custom" placeholder="직접입력" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;display:none;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">방향</label>
          <input type="text" id="marketing-add-direction" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">대상</label>
          <select id="marketing-add-target" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
            <option value="">선택</option>
            <option value="신규">신규</option>
            <option value="기존">기존</option>
            <option value="전체">전체</option>
            <option value="만료">만료</option>
          </select>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">비용</label>
          <div style="display:flex;gap:16px;align-items:center;margin-bottom:8px;">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.9rem;">
              <input type="radio" name="marketing-add-cost-type" value="amount" id="marketing-add-cost-amount" checked style="cursor:pointer;">
              <span>금액</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.9rem;">
              <input type="radio" name="marketing-add-cost-type" value="completed" id="marketing-add-cost-completed" style="cursor:pointer;">
              <span>완료</span>
            </label>
          </div>
          <input type="text" id="marketing-add-cost" value="0" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;" inputmode="numeric">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">Action result</label>
          <textarea id="marketing-add-action-result" rows="3" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;resize:vertical;"></textarea>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">Target result</label>
          <select id="marketing-add-target-result" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
            <option value="">선택</option>
            <option value="네이버클릭">네이버클릭</option>
            <option value="당근클릭">당근클릭</option>
            <option value="PT신규유입">PT신규유입</option>
            <option value="PT재등록">PT재등록</option>
            <option value="회원권신규">회원권신규</option>
            <option value="회원권재등록">회원권재등록</option>
            <option value="전체회원">전체회원</option>
          </select>
        </div>
        
        <div id="marketing-add-result-message" style="min-height:24px;color:#d32f2f;font-size:0.85rem;"></div>
        
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px;">
          <button type="button" id="marketing-add-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">취소</button>
          <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">저장</button>
        </div>
      </form>
    </div>
  `;
  
  const existingOverlay = document.querySelector('.marketing-add-modal-overlay');
  const existingModal = document.querySelector('.marketing-add-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  document.getElementById('marketing-add-modal-close').addEventListener('click', closeMarketingAddModal);
  document.getElementById('marketing-add-cancel-btn').addEventListener('click', closeMarketingAddModal);
  document.querySelector('.marketing-add-modal-overlay').addEventListener('click', closeMarketingAddModal);
  
  // PT전문샵인 경우 회원권 관련 target result 옵션 비활성화
  const isPTSpecialty = center && center.includes('PT');
  const targetResultSelect = document.getElementById('marketing-add-target-result');
  if (isPTSpecialty) {
    const membershipNewOption = targetResultSelect.querySelector('option[value="회원권신규"]');
    const membershipRenewalOption = targetResultSelect.querySelector('option[value="회원권재등록"]');
    if (membershipNewOption) membershipNewOption.disabled = true;
    if (membershipRenewalOption) membershipRenewalOption.disabled = true;
  }
  
  // 아이템 드롭다운 변경 이벤트
  document.getElementById('marketing-add-item').addEventListener('change', function() {
    const customInput = document.getElementById('marketing-add-item-custom');
    if (this.value === '직접입력') {
      this.style.display = 'none';
      customInput.style.display = 'block';
      customInput.required = true;
      customInput.setAttribute('required', 'required');
      customInput.value = '';
      customInput.focus();
    } else {
      this.style.display = 'block';
      customInput.style.display = 'none';
      customInput.required = false;
      customInput.removeAttribute('required');
      customInput.value = '';
    }
  });
  
  // 직접입력 텍스트 필드에서 드롭다운으로 돌아가기
  document.getElementById('marketing-add-item-custom').addEventListener('blur', function() {
    if (this.value.trim() === '') {
      const select = document.getElementById('marketing-add-item');
      select.style.display = 'block';
      this.style.display = 'none';
      select.value = '';
    }
  });
  
  // 비용 라디오 버튼 변경 이벤트
  document.querySelectorAll('input[name="marketing-add-cost-type"]').forEach(radio => {
    radio.addEventListener('change', function() {
      const costInput = document.getElementById('marketing-add-cost');
      if (this.value === 'completed') {
        costInput.style.display = 'none';
      } else {
        costInput.style.display = 'block';
      }
    });
  });
  
  // 비용 입력 필드 천단위 구분자 추가
  document.getElementById('marketing-add-cost').addEventListener('input', function(e) {
    let value = e.target.value.replace(/,/g, '');
    if (value === '') {
      e.target.value = '';
      return;
    }
    if (!/^\d+$/.test(value)) {
      value = value.replace(/\D/g, '');
    }
    if (value) {
      e.target.value = formatNumber(parseInt(value));
    } else {
      e.target.value = '';
    }
  });
  
  // 폼 제출 이벤트
  document.getElementById('marketing-add-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const month = document.getElementById('marketing-add-month').value;
    const itemSelect = document.getElementById('marketing-add-item');
    const itemCustom = document.getElementById('marketing-add-item-custom');
    const itemValue = itemSelect.value === '직접입력' ? itemCustom.value : itemSelect.value;
    
    const costAmountChecked = document.getElementById('marketing-add-cost-amount').checked;
    const costValue = document.getElementById('marketing-add-cost').value.replace(/,/g, '');
    const cost = costAmountChecked ? (costValue ? String(parseInt(costValue) || 0) : '0') : '완료';
    
    const marketing = {
      center: document.getElementById('marketing-add-center').value,
      month: month,
      type: document.getElementById('marketing-add-type').value,
      item: itemValue,
      direction: document.getElementById('marketing-add-direction').value || null,
      target: document.getElementById('marketing-add-target').value || null,
      cost: cost,
      action_result: document.getElementById('marketing-add-action-result').value || null,
      target_result: document.getElementById('marketing-add-target-result').value || null
    };
    
    if (!marketing.center || !marketing.month || !marketing.type || !marketing.item) {
      document.getElementById('marketing-add-result-message').textContent = '센터, 연월, 타입, 아이템은 필수입니다.';
      return;
    }
    
    const resultMsg = document.getElementById('marketing-add-result-message');
    resultMsg.textContent = '';
    
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '저장 중...';
    
    try {
      const response = await fetch('/api/marketing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(marketing)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '추가에 실패했습니다.');
      }
      
      closeMarketingAddModal();
      
      // 데이터 다시 로드
      await refreshMarketingSection();
    } catch (error) {
      console.error('마케팅 추가 오류:', error);
      resultMsg.textContent = '추가에 실패했습니다: ' + error.message;
      submitBtn.disabled = false;
      submitBtn.textContent = '저장';
    }
  });
}

function closeMarketingAddModal() {
  const overlay = document.querySelector('.marketing-add-modal-overlay');
  const modal = document.querySelector('.marketing-add-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

// 마케팅 수정 모달
function showMarketingEditModal(marketing) {
  const modalHTML = `
    <div class="marketing-edit-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="marketing-edit-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:14px;box-shadow:0 8px 32px #1976d240;min-width:500px;max-width:95vw;width:auto;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;color:#1976d2;font-size:1.2rem;">마케팅 수정</h3>
        <button id="marketing-edit-modal-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      
      <form id="marketing-edit-form" style="display:flex;flex-direction:column;gap:16px;">
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">센터 *</label>
          <input type="text" id="marketing-edit-center" value="${(marketing.center || '').replace(/"/g, '&quot;')}" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">연월 *</label>
          <input type="month" id="marketing-edit-month" value="${marketing.month || ''}" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">타입 *</label>
          <select id="marketing-edit-type" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
            <option value="online" ${marketing.type === 'online' ? 'selected' : ''}>On</option>
            <option value="offline" ${marketing.type === 'offline' ? 'selected' : ''}>Off</option>
          </select>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">아이템 *</label>
          <select id="marketing-edit-item" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;${!['N플레이스', '당근', '블로그', '문자', '물티슈', '배너', '전단지', '단지게시판'].includes(marketing.item) ? 'display:none;' : ''}">
            <option value="">선택</option>
            <option value="직접입력" ${!['N플레이스', '당근', '블로그', '문자', '물티슈', '배너', '전단지', '단지게시판'].includes(marketing.item) ? 'selected' : ''}>직접입력</option>
            <option value="N플레이스" ${marketing.item === 'N플레이스' ? 'selected' : ''}>N플레이스</option>
            <option value="당근" ${marketing.item === '당근' ? 'selected' : ''}>당근</option>
            <option value="블로그" ${marketing.item === '블로그' ? 'selected' : ''}>블로그</option>
            <option value="문자" ${marketing.item === '문자' ? 'selected' : ''}>문자</option>
            <option value="물티슈" ${marketing.item === '물티슈' ? 'selected' : ''}>물티슈</option>
            <option value="배너" ${marketing.item === '배너' ? 'selected' : ''}>배너</option>
            <option value="전단지" ${marketing.item === '전단지' ? 'selected' : ''}>전단지</option>
            <option value="단지게시판" ${marketing.item === '단지게시판' ? 'selected' : ''}>단지게시판</option>
          </select>
          <input type="text" id="marketing-edit-item-custom" placeholder="직접입력" value="${!['N플레이스', '당근', '블로그', '문자', '물티슈', '배너', '전단지', '단지게시판'].includes(marketing.item) ? (marketing.item || '').replace(/"/g, '&quot;') : ''}" ${!['N플레이스', '당근', '블로그', '문자', '물티슈', '배너', '전단지', '단지게시판'].includes(marketing.item) ? 'required' : ''} style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;display:${!['N플레이스', '당근', '블로그', '문자', '물티슈', '배너', '전단지', '단지게시판'].includes(marketing.item) ? 'block' : 'none'};">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">방향</label>
          <input type="text" id="marketing-edit-direction" value="${(marketing.direction || '').replace(/"/g, '&quot;')}" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">대상</label>
          <select id="marketing-edit-target" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
            <option value="">선택</option>
            <option value="신규" ${marketing.target === '신규' ? 'selected' : ''}>신규</option>
            <option value="기존" ${marketing.target === '기존' ? 'selected' : ''}>기존</option>
            <option value="전체" ${marketing.target === '전체' ? 'selected' : ''}>전체</option>
            <option value="만료" ${marketing.target === '만료' ? 'selected' : ''}>만료</option>
          </select>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">비용</label>
          <div style="display:flex;gap:16px;align-items:center;margin-bottom:8px;">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.9rem;">
              <input type="radio" name="marketing-edit-cost-type" value="amount" id="marketing-edit-cost-amount" ${marketing.cost !== '완료' ? 'checked' : ''} style="cursor:pointer;">
              <span>금액</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.9rem;">
              <input type="radio" name="marketing-edit-cost-type" value="completed" id="marketing-edit-cost-completed" ${marketing.cost === '완료' ? 'checked' : ''} style="cursor:pointer;">
              <span>완료</span>
            </label>
          </div>
          <input type="text" id="marketing-edit-cost" value="${marketing.cost === '완료' ? '0' : (marketing.cost ? formatNumber(parseInt(marketing.cost) || 0) : '0')}" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;${marketing.cost === '완료' ? 'display:none;' : ''}" inputmode="numeric">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">Action result</label>
          <textarea id="marketing-edit-action-result" rows="3" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;resize:vertical;">${(marketing.action_result || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">Target result</label>
          <select id="marketing-edit-target-result" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
            <option value="">선택</option>
            <option value="네이버클릭" ${marketing.target_result === '네이버클릭' ? 'selected' : ''}>네이버클릭</option>
            <option value="당근클릭" ${marketing.target_result === '당근클릭' ? 'selected' : ''}>당근클릭</option>
            <option value="PT신규유입" ${marketing.target_result === 'PT신규유입' ? 'selected' : ''}>PT신규유입</option>
            <option value="PT재등록" ${marketing.target_result === 'PT재등록' ? 'selected' : ''}>PT재등록</option>
            <option value="회원권신규" ${marketing.target_result === '회원권신규' ? 'selected' : ''}>회원권신규</option>
            <option value="회원권재등록" ${marketing.target_result === '회원권재등록' ? 'selected' : ''}>회원권재등록</option>
            <option value="전체회원" ${marketing.target_result === '전체회원' ? 'selected' : ''}>전체회원</option>
          </select>
        </div>
        
        <div id="marketing-edit-result-message" style="min-height:24px;color:#d32f2f;font-size:0.85rem;"></div>
        
        <div style="display:flex;gap:10px;justify-content:space-between;margin-top:8px;">
          <button type="button" id="marketing-edit-delete-btn" style="background:#d32f2f;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">삭제</button>
          <div style="display:flex;gap:10px;">
            <button type="button" id="marketing-edit-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">취소</button>
            <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">저장</button>
          </div>
        </div>
      </form>
    </div>
  `;
  
  const existingOverlay = document.querySelector('.marketing-edit-modal-overlay');
  const existingModal = document.querySelector('.marketing-edit-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  document.getElementById('marketing-edit-modal-close').addEventListener('click', closeMarketingEditModal);
  document.getElementById('marketing-edit-cancel-btn').addEventListener('click', closeMarketingEditModal);
  document.querySelector('.marketing-edit-modal-overlay').addEventListener('click', closeMarketingEditModal);
  
  // PT전문샵인 경우 회원권 관련 target result 옵션 비활성화
  const isPTSpecialty = marketing.center && marketing.center.includes('PT');
  const targetResultSelect = document.getElementById('marketing-edit-target-result');
  if (isPTSpecialty) {
    const membershipNewOption = targetResultSelect.querySelector('option[value="회원권신규"]');
    const membershipRenewalOption = targetResultSelect.querySelector('option[value="회원권재등록"]');
    if (membershipNewOption) {
      membershipNewOption.disabled = true;
      // 현재 선택된 값이 회원권신규인 경우 빈 값으로 변경
      if (targetResultSelect.value === '회원권신규') {
        targetResultSelect.value = '';
      }
    }
    if (membershipRenewalOption) {
      membershipRenewalOption.disabled = true;
      // 현재 선택된 값이 회원권재등록인 경우 빈 값으로 변경
      if (targetResultSelect.value === '회원권재등록') {
        targetResultSelect.value = '';
      }
    }
  }
  
  // 삭제 버튼 이벤트
  document.getElementById('marketing-edit-delete-btn').addEventListener('click', async function() {
    if (confirm('정말 삭제하시겠습니까?')) {
      try {
        const response = await fetch(`/api/marketing/${marketing.id}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          throw new Error('삭제에 실패했습니다.');
        }
        
        closeMarketingEditModal();
        await refreshMarketingSection();
      } catch (error) {
        console.error('마케팅 삭제 오류:', error);
        alert('삭제에 실패했습니다.');
      }
    }
  });
  
  // 아이템 드롭다운 변경 이벤트
  document.getElementById('marketing-edit-item').addEventListener('change', function() {
    const customInput = document.getElementById('marketing-edit-item-custom');
    if (this.value === '직접입력') {
      this.style.display = 'none';
      customInput.style.display = 'block';
      customInput.required = true;
      if (!customInput.value) {
        customInput.value = '';
      }
      customInput.focus();
    } else {
      this.style.display = 'block';
      customInput.style.display = 'none';
      customInput.required = false;
      customInput.removeAttribute('required');
    }
  });
  
  // 초기 상태에서 직접입력이 선택되지 않은 경우 required 제거
  const initialItemSelect = document.getElementById('marketing-edit-item');
  const initialCustomInput = document.getElementById('marketing-edit-item-custom');
  if (initialItemSelect.value !== '직접입력') {
    initialCustomInput.removeAttribute('required');
  }
  
  // 직접입력 텍스트 필드에서 드롭다운으로 돌아가기
  document.getElementById('marketing-edit-item-custom').addEventListener('blur', function() {
    if (this.value.trim() === '') {
      const select = document.getElementById('marketing-edit-item');
      select.style.display = 'block';
      this.style.display = 'none';
      select.value = '';
    }
  });
  
  // 비용 라디오 버튼 변경 이벤트
  document.querySelectorAll('input[name="marketing-edit-cost-type"]').forEach(radio => {
    radio.addEventListener('change', function() {
      const costInput = document.getElementById('marketing-edit-cost');
      if (this.value === 'completed') {
        costInput.style.display = 'none';
      } else {
        costInput.style.display = 'block';
      }
    });
  });
  
  // 비용 입력 필드 천단위 구분자 추가
  document.getElementById('marketing-edit-cost').addEventListener('input', function(e) {
    let value = e.target.value.replace(/,/g, '');
    if (value === '') {
      e.target.value = '';
      return;
    }
    if (!/^\d+$/.test(value)) {
      value = value.replace(/\D/g, '');
    }
    if (value) {
      e.target.value = formatNumber(parseInt(value));
    } else {
      e.target.value = '';
    }
  });
  
  // 폼 제출 이벤트
  document.getElementById('marketing-edit-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const itemSelect = document.getElementById('marketing-edit-item');
    const itemCustom = document.getElementById('marketing-edit-item-custom');
    const itemValue = itemSelect.value === '직접입력' ? itemCustom.value : itemSelect.value;
    
    const costAmountChecked = document.getElementById('marketing-edit-cost-amount').checked;
    const costValue = document.getElementById('marketing-edit-cost').value.replace(/,/g, '');
    const cost = costAmountChecked ? (costValue ? String(parseInt(costValue) || 0) : '0') : '완료';
    
    const updates = {
      center: document.getElementById('marketing-edit-center').value,
      month: document.getElementById('marketing-edit-month').value,
      type: document.getElementById('marketing-edit-type').value,
      item: itemValue,
      direction: document.getElementById('marketing-edit-direction').value || null,
      target: document.getElementById('marketing-edit-target').value || null,
      cost: cost,
      action_result: document.getElementById('marketing-edit-action-result').value || null,
      target_result: document.getElementById('marketing-edit-target-result').value || null
    };
    
    if (!updates.center || !updates.month || !updates.type || !updates.item) {
      document.getElementById('marketing-edit-result-message').textContent = '센터, 연월, 타입, 아이템은 필수입니다.';
      return;
    }
    
    const resultMsg = document.getElementById('marketing-edit-result-message');
    resultMsg.textContent = '';
    
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '저장 중...';
    
    try {
      const response = await fetch(`/api/marketing/${marketing.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '수정에 실패했습니다.');
      }
      
      closeMarketingEditModal();
      
      // 데이터 다시 로드
      await refreshMarketingSection();
    } catch (error) {
      console.error('마케팅 수정 오류:', error);
      resultMsg.textContent = '수정에 실패했습니다: ' + error.message;
      submitBtn.disabled = false;
      submitBtn.textContent = '저장';
    }
  });
}

function closeMarketingEditModal() {
  const overlay = document.querySelector('.marketing-edit-modal-overlay');
  const modal = document.querySelector('.marketing-edit-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

function formatNumber(num) {
  return String(num || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatSalesInManwon(amount) {
  const manwon = Math.round((amount || 0) / 10000);
  return formatNumber(manwon);
}

// PT 지표 불러오기 함수
async function loadPTMetrics(center, yearMonth, mode) {
  // 상담 데이터 조회 (PT 신규/상담)
  const trialsResponse = await fetch(`/api/trials?yearMonth=${yearMonth}`);
  const trialsData = await trialsResponse.json();
  
  // 재등록 데이터 조회 (PT 재등록/만료대상)
  const renewalsResponse = await fetch(`/api/renewals?month=${yearMonth}`);
  const renewalsData = await renewalsResponse.json();
  
  // 해당 센터의 상담 데이터 계산
  const centerTrials = trialsData.centers?.[center] || [];
  const ptNew = centerTrials.filter(trial => trial.result === '등록').length;
  const ptConsultation = centerTrials.length;
  
  // 해당 센터의 재등록 데이터 계산
  const centerRenewals = renewalsData[center] || [];
  let ptRenewal = 0;
  let ptExpiring = 0;
  
  centerRenewals.forEach(renewal => {
    const memberNames = renewal.member_names || [];
    const statuses = renewal.status || {};
    
    memberNames.forEach(memberName => {
      const status = statuses[memberName] || '예상';
      // 이월 회원은 제외
      if (status === '이월') return;
      
      if (status === '완료') {
        ptRenewal++;
      }
      // PT만료대상은 이월을 제외한 모든 회원 수
      ptExpiring++;
    });
  });
  
  // 필드에 값 입력
  if (mode === 'add') {
    document.getElementById('metric-add-pt-new').value = ptNew;
    document.getElementById('metric-add-pt-consultation').value = ptConsultation;
    document.getElementById('metric-add-pt-renewal').value = ptRenewal;
    document.getElementById('metric-add-pt-expiring').value = ptExpiring;
  } else if (mode === 'edit') {
    document.getElementById('metric-edit-pt-new').value = ptNew;
    document.getElementById('metric-edit-pt-consultation').value = ptConsultation;
    document.getElementById('metric-edit-pt-renewal').value = ptRenewal;
    document.getElementById('metric-edit-pt-expiring').value = ptExpiring;
  }
}

function setupMetricEditListeners() {
  document.querySelectorAll('.metric-edit-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const metricData = JSON.parse(this.getAttribute('data-metric-data'));
      showMetricEditModal(metricData);
    });
  });
}

function setupMetricTrendListeners() {
  const contentEl = document.getElementById('strategy-content');
  if (!contentEl || contentEl._metricTrendListenerAttached) return;
  contentEl._metricTrendListenerAttached = true;

  contentEl.addEventListener('click', (e) => {
    if (e.target.closest('.metric-edit-btn')) return;
    const section = e.target.closest('.metric-section--clickable');
    if (!section) return;
    const { center, section: sectionId } = section.dataset;
    if (center && sectionId) {
      showMetricTrendModal(center, sectionId);
    }
  });

  contentEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const section = e.target.closest('.metric-section--clickable');
    if (!section) return;
    e.preventDefault();
    const { center, section: sectionId } = section.dataset;
    if (center && sectionId) {
      showMetricTrendModal(center, sectionId);
    }
  });
}

function destroyMetricTrendCharts() {
  metricTrendCharts.forEach(chart => chart.destroy());
  metricTrendCharts = [];
}

function buildTrendChartSeries(trendData, sectionConfig, isPTSpecialty) {
  if (!trendData || trendData.length === 0) return [];

  const labels = trendData.map(row => formatTrendMonthLabel(row.month));
  const seriesList = sectionConfig.series.filter(s => !s.hideForPTSpecialty || !isPTSpecialty);
  const isManwon = sectionConfig.unit === 'manwon';

  return seriesList
    .map((series, index) => {
      const values = trendData.map(row => {
        const raw = row[series.key] ?? 0;
        return isManwon ? Math.round(raw / 10000) : raw;
      });
      const hasData = values.some(v => v !== 0);
      if (!hasData) return null;

      return {
        label: series.label,
        labels,
        values,
        color: series.color || METRIC_TREND_CHART_COLORS[index % METRIC_TREND_CHART_COLORS.length],
        isManwon
      };
    })
    .filter(Boolean);
}

// 차트 데이터 포인트 위에 수치 표시
const metricTrendPointLabelsPlugin = {
  id: 'metricTrendPointLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    if (!meta?.data?.length) return;

    const values = chart.data.datasets[0]?.data || [];
    const color = chart.data.datasets[0]?.borderColor || '#333';

    ctx.save();
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    meta.data.forEach((point, index) => {
      if (point.x == null || point.y == null) return;
      const value = values[index];
      const label = formatNumber(value);
      ctx.fillStyle = color;
      ctx.fillText(label, point.x, point.y - 8);
    });
    ctx.restore();
  }
};

function renderMetricTrendCharts(container, chartSeries) {
  destroyMetricTrendCharts();
  if (!window.Chart) {
    container.innerHTML = '<div style="text-align:center;padding:24px;color:#d32f2f;">차트 라이브러리를 불러오지 못했습니다. 페이지를 새로고침해주세요.</div>';
    return;
  }

  container.innerHTML = chartSeries.map((series, index) => `
    <div style="margin-bottom:${index < chartSeries.length - 1 ? '20px' : '0'};">
      <div style="font-size:0.9rem;font-weight:600;color:#333;margin-bottom:8px;">${escapeHtml(series.label)}${series.isManwon ? ' <span style="color:#999;font-weight:normal;font-size:0.75rem;">(만원)</span>' : ''}</div>
      <div style="position:relative;height:240px;">
        <canvas id="metric-trend-chart-${index}"></canvas>
      </div>
    </div>
  `).join('');

  chartSeries.forEach((series, index) => {
    const canvas = container.querySelector(`#metric-trend-chart-${index}`);
    if (!canvas) return;

    const chart = new window.Chart(canvas, {
      type: 'line',
      data: {
        labels: series.labels,
        datasets: [{
          label: series.label,
          data: series.values,
          borderColor: series.color,
          backgroundColor: series.color + '22',
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.25,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 18 }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed.y;
                return series.isManwon
                  ? `${series.label}: ${formatNumber(val)}만원`
                  : `${series.label}: ${formatNumber(val)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, maxRotation: 45, minRotation: 0 }
          },
          y: {
            beginAtZero: true,
            grace: '10%',
            ticks: {
              font: { size: 11 },
              callback: (v) => formatNumber(v)
            }
          }
        }
      },
      plugins: [metricTrendPointLabelsPlugin]
    });
    metricTrendCharts.push(chart);
  });
}

async function showMetricTrendModal(center, sectionId) {
  const sectionConfig = METRIC_SECTIONS[sectionId];
  if (!sectionConfig) return;

  const isPTSpecialty = center.includes('PT');
  if (sectionConfig.hideForPTSpecialty && isPTSpecialty) return;

  const endMonth = getSelectedYearMonth();

  closeMetricTrendModal();

  const modalHTML = `
    <div class="metric-trend-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="metric-trend-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:14px;box-shadow:0 8px 32px #1976d240;min-width:320px;max-width:95vw;width:640px;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;gap:12px;">
        <div>
          <h3 style="margin:0 0 4px 0;color:#1976d2;font-size:1.1rem;">${escapeHtml(center)} · ${escapeHtml(sectionConfig.title)}</h3>
          <p style="margin:0;color:#888;font-size:0.8rem;">최근 12개월 추이</p>
        </div>
        <button id="metric-trend-modal-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;flex-shrink:0;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      <div id="metric-trend-charts-container" style="text-align:center;padding:24px;color:#888;">불러오는 중...</div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  document.getElementById('metric-trend-modal-close').addEventListener('click', closeMetricTrendModal);
  document.querySelector('.metric-trend-modal-overlay').addEventListener('click', closeMetricTrendModal);

  const chartsContainer = document.getElementById('metric-trend-charts-container');

  try {
    const response = await fetch(`/api/metrics/trend?center=${encodeURIComponent(center)}&endMonth=${encodeURIComponent(endMonth)}&months=12`);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || '데이터를 불러오지 못했습니다.');
    }

    const result = await response.json();
    const trendData = result.data || [];

    if (trendData.length === 0) {
      chartsContainer.innerHTML = '<div style="text-align:center;padding:24px;color:#888;">최근 12개월간 데이터가 없습니다.</div>';
      return;
    }

    const chartSeries = buildTrendChartSeries(trendData, sectionConfig, isPTSpecialty);

    if (chartSeries.length === 0) {
      chartsContainer.innerHTML = '<div style="text-align:center;padding:24px;color:#888;">표시할 지표 데이터가 없습니다.</div>';
      return;
    }

    const rangeText = `${formatTrendMonthLabel(trendData[0].month)} ~ ${formatTrendMonthLabel(trendData[trendData.length - 1].month)}`;
    chartsContainer.innerHTML = `<p style="margin:0 0 16px 0;color:#666;font-size:0.8rem;text-align:left;">기간: ${rangeText} (${trendData.length}개월)</p><div id="metric-trend-charts-inner"></div>`;

    renderMetricTrendCharts(document.getElementById('metric-trend-charts-inner'), chartSeries);
  } catch (error) {
    console.error('지표 추이 조회 오류:', error);
    chartsContainer.innerHTML = `<div style="text-align:center;padding:24px;color:#d32f2f;">${escapeHtml(error.message)}</div>`;
  }
}

function closeMetricTrendModal() {
  destroyMetricTrendCharts();
  const overlay = document.querySelector('.metric-trend-modal-overlay');
  const modal = document.querySelector('.metric-trend-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

async function showMetricEditModal(metric) {
  // PT 전문샵 여부 확인
  const isPTSpecialty = metric.center.includes('PT');
  
  const modalHTML = `
    <div class="metric-edit-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="metric-edit-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:14px;box-shadow:0 8px 32px #1976d240;min-width:400px;max-width:95vw;width:auto;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;color:#1976d2;font-size:1.2rem;">지표 수정</h3>
        <button id="metric-edit-modal-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      
      <form id="metric-edit-form" style="display:flex;flex-direction:column;gap:16px;">
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">센터</label>
          <input type="text" id="metric-edit-center" value="${metric.center}" disabled style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;background:#f5f5f5;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">연월</label>
          <input type="text" id="metric-edit-month" value="${metric.month}" disabled style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;background:#f5f5f5;">
        </div>
        
        <div style="border-top:2px solid #ddd;padding-top:16px;margin-top:8px;">
          <h4 style="margin:0 0 12px 0;color:#1976d2;font-size:1rem;">마케팅 지표</h4>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">네이버 클릭수</label>
              <input type="number" id="metric-edit-naver-clicks" min="0" value="${metric.naver_clicks || 0}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">당근 클릭수</label>
              <input type="number" id="metric-edit-karrot-clicks" min="0" value="${metric.karrot_clicks || 0}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
          </div>
        </div>
        
        <div style="border-top:2px solid #ddd;padding-top:16px;margin-top:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h4 style="margin:0;color:#1976d2;font-size:1rem;">PT 지표</h4>
            <button type="button" id="metric-edit-load-pt-btn" class="header-text-btn" style="background:#e3f2fd !important;color:#1976d2 !important;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">불러오기</button>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">PT 신규</label>
              <input type="number" id="metric-edit-pt-new" min="0" value="${metric.pt_new || 0}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">PT 상담</label>
              <input type="number" id="metric-edit-pt-consultation" min="0" value="${metric.pt_consultation || 0}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">PT 재등록</label>
              <input type="number" id="metric-edit-pt-renewal" min="0" value="${metric.pt_renewal || 0}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">PT 만료대상</label>
              <input type="number" id="metric-edit-pt-expiring" min="0" value="${metric.pt_expiring || 0}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
          </div>
        </div>
        
        ${!isPTSpecialty ? `
        <div style="border-top:2px solid #ddd;padding-top:16px;margin-top:8px;">
          <h4 style="margin:0 0 12px 0;color:#1976d2;font-size:1rem;">회원권 지표</h4>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">회원권 신규</label>
              <input type="number" id="metric-edit-membership-new" min="0" value="${metric.membership_new || 0}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">회원권 재등록</label>
              <input type="number" id="metric-edit-membership-renewal" min="0" value="${metric.membership_renewal || 0}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">회원권 만료대상</label>
              <input type="number" id="metric-edit-membership-expiring" min="0" value="${metric.membership_expiring || 0}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
          </div>
        </div>
        ` : ''}
        
        <div style="border-top:2px solid #ddd;padding-top:16px;margin-top:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h4 style="margin:0;color:#1976d2;font-size:1rem;">회원 수 지표</h4>
            <button type="button" id="metric-edit-load-members-btn" class="header-text-btn" style="background:#e3f2fd !important;color:#1976d2 !important;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">불러오기</button>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">전체 회원수</label>
              <input type="number" id="metric-edit-total-members" min="0" value="${metric.total_members || 0}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
            ${!isPTSpecialty ? `
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">PT 전체 회원수</label>
              <input type="number" id="metric-edit-pt-total-members" min="0" value="${metric.pt_total_members || 0}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
            ` : `
            <div style="display:none;">
              <input type="number" id="metric-edit-pt-total-members" min="0" value="${metric.total_members || 0}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
            `}
          </div>
        </div>
        
        <div style="border-top:2px solid #ddd;padding-top:16px;margin-top:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h4 style="margin:0;color:#1976d2;font-size:1rem;">매출 지표</h4>
            ${isPTSpecialty ? `
            <button type="button" id="metric-edit-load-sales-btn" class="header-text-btn" style="background:#e3f2fd !important;color:#1976d2 !important;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">불러오기</button>
            ` : ''}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">전체 매출</label>
              <input type="number" id="metric-edit-total-sales" min="0" value="${metric.total_sales || 0}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
            ${!isPTSpecialty ? `
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">PT 매출</label>
              <input type="number" id="metric-edit-pt-sales" min="0" value="${metric.pt_sales || 0}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">회원권 매출</label>
              <input type="number" id="metric-edit-membership-sales" min="0" value="${metric.membership_sales || 0}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
            ` : `
            <div style="display:none;">
              <input type="number" id="metric-edit-pt-sales" min="0" value="${metric.total_sales || 0}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
            `}
          </div>
        </div>
        
        <div id="metric-edit-result-message" style="min-height:24px;color:#d32f2f;font-size:0.85rem;"></div>
        
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px;">
          <button type="button" id="metric-edit-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">취소</button>
          <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">저장</button>
        </div>
      </form>
    </div>
  `;
  
  const existingOverlay = document.querySelector('.metric-edit-modal-overlay');
  const existingModal = document.querySelector('.metric-edit-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  document.getElementById('metric-edit-modal-close').addEventListener('click', closeMetricEditModal);
  document.getElementById('metric-edit-cancel-btn').addEventListener('click', closeMetricEditModal);
  document.querySelector('.metric-edit-modal-overlay').addEventListener('click', closeMetricEditModal);
  
  // PT 전문샵의 경우 전체 회원수/매출 변경 시 PT 전체 회원수/매출에도 동일 값 반영
  if (isPTSpecialty) {
    const totalMembersInput = document.getElementById('metric-edit-total-members');
    const totalSalesInput = document.getElementById('metric-edit-total-sales');
    
    if (totalMembersInput) {
      totalMembersInput.addEventListener('input', function() {
        const ptTotalMembersInput = document.getElementById('metric-edit-pt-total-members');
        if (ptTotalMembersInput) {
          ptTotalMembersInput.value = this.value;
        }
      });
    }
    
    if (totalSalesInput) {
      totalSalesInput.addEventListener('input', function() {
        const ptSalesInput = document.getElementById('metric-edit-pt-sales');
        if (ptSalesInput) {
          ptSalesInput.value = this.value;
        }
      });
    }
    
    // 매출 불러오기 버튼 이벤트
    const loadSalesBtn = document.getElementById('metric-edit-load-sales-btn');
    if (loadSalesBtn) {
      loadSalesBtn.addEventListener('click', async function() {
        const month = document.getElementById('metric-edit-month').value;
        
        if (!month) {
          alert('연월 정보가 없습니다.');
          return;
        }
        
        const btn = this;
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '불러오는 중...';
        
        try {
          // YYYY-MM 형식으로 변환
          const yearMonth = month.includes('-') ? month : `${month.substring(0, 4)}-${month.substring(4)}`;
          
          // 매출 API 호출
          const response = await fetch(`/api/sales?yearMonth=${encodeURIComponent(yearMonth)}`);
          if (!response.ok) {
            throw new Error('매출 데이터를 불러오는데 실패했습니다.');
          }
          
          const data = await response.json();
          const totalSales = data.summary?.totalAmount || 0;
          
          // 전체 매출 필드에 값 입력 (동기화 로직에 의해 PT 매출에도 자동 반영됨)
          if (totalSalesInput) {
            totalSalesInput.value = totalSales;
            // input 이벤트 트리거하여 동기화
            totalSalesInput.dispatchEvent(new Event('input'));
          }
        } catch (error) {
          console.error('매출 불러오기 오류:', error);
          alert('매출 데이터를 불러오는 중 오류가 발생했습니다.');
        } finally {
          btn.disabled = false;
          btn.textContent = originalText;
        }
      });
    }
  }
  
  // 회원수 불러오기 버튼 이벤트
  document.getElementById('metric-edit-load-members-btn').addEventListener('click', async function() {
    const center = document.getElementById('metric-edit-center').value;
    
    if (!center) {
      alert('센터 정보가 없습니다.');
      return;
    }
    
    const btn = this;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '불러오는 중...';
    
    try {
      // 오늘 날짜를 기준으로 통계 API 호출
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      // 통계 API 호출 (period, startDate, endDate 필요)
      const response = await fetch(`/api/stats?period=day&startDate=${todayStr}&endDate=${todayStr}`);
      if (!response.ok) {
        throw new Error('회원수 데이터를 불러오는데 실패했습니다.');
      }
      
      const data = await response.json();
      const validMembersCount = data.centerValidMembers?.[center] || 0;
      
      // PT 전문샵인 경우 전체 회원수에, 일반샵인 경우 PT 전체 회원수에 입력
      if (isPTSpecialty) {
        const totalMembersInput = document.getElementById('metric-edit-total-members');
        if (totalMembersInput) {
          totalMembersInput.value = validMembersCount;
          // input 이벤트 트리거하여 동기화
          totalMembersInput.dispatchEvent(new Event('input'));
        }
      } else {
        const ptTotalMembersInput = document.getElementById('metric-edit-pt-total-members');
        if (ptTotalMembersInput) {
          ptTotalMembersInput.value = validMembersCount;
        }
      }
    } catch (error) {
      console.error('회원수 불러오기 오류:', error);
      alert('회원수 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
  
  // PT 지표 불러오기 버튼 이벤트
  document.getElementById('metric-edit-load-pt-btn').addEventListener('click', async function() {
    const center = document.getElementById('metric-edit-center').value;
    const month = document.getElementById('metric-edit-month').value;
    
    if (!center || !month) {
      alert('센터와 연월을 먼저 선택해주세요.');
      return;
    }
    
    const btn = this;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '불러오는 중...';
    
    try {
      await loadPTMetrics(center, month, 'edit');
    } catch (error) {
      console.error('PT 지표 불러오기 오류:', error);
      alert('PT 지표를 불러오는 중 오류가 발생했습니다.');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
  
  // 폼 제출 이벤트
  document.getElementById('metric-edit-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const isPTSpecialty = metric.center.includes('PT');
    
    const updates = {
      naver_clicks: parseInt(document.getElementById('metric-edit-naver-clicks').value) || 0,
      karrot_clicks: parseInt(document.getElementById('metric-edit-karrot-clicks').value) || 0,
      pt_new: parseInt(document.getElementById('metric-edit-pt-new').value) || 0,
      pt_consultation: parseInt(document.getElementById('metric-edit-pt-consultation').value) || 0,
      pt_renewal: parseInt(document.getElementById('metric-edit-pt-renewal').value) || 0,
      pt_expiring: parseInt(document.getElementById('metric-edit-pt-expiring').value) || 0,
      membership_new: isPTSpecialty ? 0 : (parseInt(document.getElementById('metric-edit-membership-new')?.value) || 0),
      membership_renewal: isPTSpecialty ? 0 : (parseInt(document.getElementById('metric-edit-membership-renewal')?.value) || 0),
      membership_expiring: isPTSpecialty ? 0 : (parseInt(document.getElementById('metric-edit-membership-expiring')?.value) || 0),
      total_members: parseInt(document.getElementById('metric-edit-total-members').value) || 0,
      pt_total_members: isPTSpecialty ? 0 : (parseInt(document.getElementById('metric-edit-pt-total-members')?.value) || 0),
      total_sales: parseInt(document.getElementById('metric-edit-total-sales').value) || 0,
      pt_sales: isPTSpecialty ? 0 : (parseInt(document.getElementById('metric-edit-pt-sales')?.value) || 0),
      membership_sales: isPTSpecialty ? 0 : (parseInt(document.getElementById('metric-edit-membership-sales')?.value) || 0)
    };
    
    const resultMsg = document.getElementById('metric-edit-result-message');
    resultMsg.textContent = '';
    
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '저장 중...';
    
    try {
      const response = await fetch(`/api/metrics/${metric.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '수정에 실패했습니다.');
      }
      
      closeMetricEditModal();
      
      // 데이터 다시 로드
      const container = document.querySelector('#strategy-content')?.closest('[id^="tab-"]') || document.querySelector('#strategy-root')?.closest('div');
      if (container) {
        loadStrategyData(container);
      }
    } catch (error) {
      console.error('Metric 수정 오류:', error);
      resultMsg.textContent = '수정에 실패했습니다: ' + error.message;
      submitBtn.disabled = false;
      submitBtn.textContent = '저장';
    }
  });
}

function closeMetricEditModal() {
  const overlay = document.querySelector('.metric-edit-modal-overlay');
  const modal = document.querySelector('.metric-edit-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

async function showMetricAddModal() {
  // 센터 목록 조회
  const centersResponse = await fetch('/api/centers');
  const centers = await centersResponse.json();
  const yearMonth = getSelectedYearMonth();
  
  // 현재 선택된 월의 기존 지표 조회
  let existingMetrics = [];
  try {
    const metricsResponse = await fetch(`/api/metrics?month=${yearMonth}`);
    existingMetrics = await metricsResponse.json();
  } catch (err) {
    console.error('기존 지표 조회 오류:', err);
  }
  
  // 이미 데이터가 있는 센터 목록
  const existingCenters = new Set(existingMetrics.map(m => m.center));
  
  const modalHTML = `
    <div class="metric-add-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="metric-add-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:14px;box-shadow:0 8px 32px #1976d240;min-width:400px;max-width:95vw;width:auto;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;color:#1976d2;font-size:1.2rem;">지표 추가</h3>
        <button id="metric-add-modal-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      
      <form id="metric-add-form" style="display:flex;flex-direction:column;gap:16px;">
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">센터 *</label>
          <select id="metric-add-center" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
            <option value="">선택</option>
            ${centers.map(center => {
              const isDisabled = existingCenters.has(center.name);
              return `<option value="${center.name}" ${isDisabled ? 'disabled style="color:#999;background:#f5f5f5;"' : ''}>${center.name}${isDisabled ? ' (이미 등록됨)' : ''}</option>`;
            }).join('')}
          </select>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">연월 *</label>
          <input type="month" id="metric-add-month" value="${yearMonth}" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div style="border-top:2px solid #ddd;padding-top:16px;margin-top:8px;">
          <h4 style="margin:0 0 12px 0;color:#1976d2;font-size:1rem;">마케팅 지표</h4>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">네이버 클릭수</label>
              <input type="number" id="metric-add-naver-clicks" min="0" value="0" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">당근 클릭수</label>
              <input type="number" id="metric-add-karrot-clicks" min="0" value="0" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
          </div>
        </div>
        
        <div style="border-top:2px solid #ddd;padding-top:16px;margin-top:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h4 style="margin:0;color:#1976d2;font-size:1rem;">PT 지표</h4>
            <button type="button" id="metric-add-load-pt-btn" style="background:#4caf50;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">불러오기</button>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">PT 신규</label>
              <input type="number" id="metric-add-pt-new" min="0" value="0" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">PT 상담</label>
              <input type="number" id="metric-add-pt-consultation" min="0" value="0" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">PT 재등록</label>
              <input type="number" id="metric-add-pt-renewal" min="0" value="0" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">PT 만료대상</label>
              <input type="number" id="metric-add-pt-expiring" min="0" value="0" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
          </div>
        </div>
        
        <div id="metric-add-membership-section" style="border-top:2px solid #ddd;padding-top:16px;margin-top:8px;">
          <h4 style="margin:0 0 12px 0;color:#1976d2;font-size:1rem;">회원권 지표</h4>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">회원권 신규</label>
              <input type="number" id="metric-add-membership-new" min="0" value="0" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">회원권 재등록</label>
              <input type="number" id="metric-add-membership-renewal" min="0" value="0" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">회원권 만료대상</label>
              <input type="number" id="metric-add-membership-expiring" min="0" value="0" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
          </div>
        </div>
        
        <div style="border-top:2px solid #ddd;padding-top:16px;margin-top:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h4 style="margin:0;color:#1976d2;font-size:1rem;">회원 수 지표</h4>
            <button type="button" id="metric-add-load-members-btn" style="background:#4caf50;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">불러오기</button>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">전체 회원수</label>
              <input type="number" id="metric-add-total-members" min="0" value="0" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
            <div id="metric-add-pt-total-members-wrapper">
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">PT 전체 회원수</label>
              <input type="number" id="metric-add-pt-total-members" min="0" value="0" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
          </div>
        </div>
        
        <div style="border-top:2px solid #ddd;padding-top:16px;margin-top:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h4 style="margin:0;color:#1976d2;font-size:1rem;">매출 지표</h4>
            <div id="metric-add-load-sales-btn-wrapper" style="display:none;">
              <button type="button" id="metric-add-load-sales-btn" style="background:#4caf50;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">불러오기</button>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">전체 매출</label>
              <input type="number" id="metric-add-total-sales" min="0" value="0" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
            <div id="metric-add-pt-sales-wrapper">
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">PT 매출</label>
              <input type="number" id="metric-add-pt-sales" min="0" value="0" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
            <div id="metric-add-membership-sales-wrapper">
              <label style="display:block;font-size:0.85rem;color:#666;margin-bottom:4px;">회원권 매출</label>
              <input type="number" id="metric-add-membership-sales" min="0" value="0" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
            </div>
          </div>
        </div>
        
        <div id="metric-add-result-message" style="min-height:24px;color:#d32f2f;font-size:0.85rem;"></div>
        
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px;">
          <button type="button" id="metric-add-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">취소</button>
          <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">저장</button>
        </div>
      </form>
    </div>
  `;
  
  const existingOverlay = document.querySelector('.metric-add-modal-overlay');
  const existingModal = document.querySelector('.metric-add-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  document.getElementById('metric-add-modal-close').addEventListener('click', closeMetricAddModal);
  document.getElementById('metric-add-cancel-btn').addEventListener('click', closeMetricAddModal);
  document.querySelector('.metric-add-modal-overlay').addEventListener('click', closeMetricAddModal);
  
  // 센터 선택 시 PT 전문샵 여부에 따라 항목 표시/숨김
  function togglePTSpecialtyFields() {
    const center = document.getElementById('metric-add-center').value;
    const isPTSpecialty = center.includes('PT');
    
    const membershipSection = document.getElementById('metric-add-membership-section');
    const ptTotalMembersWrapper = document.getElementById('metric-add-pt-total-members-wrapper');
    const ptSalesWrapper = document.getElementById('metric-add-pt-sales-wrapper');
    const membershipSalesWrapper = document.getElementById('metric-add-membership-sales-wrapper');
    const loadSalesBtnWrapper = document.getElementById('metric-add-load-sales-btn-wrapper');
    
    if (membershipSection) {
      membershipSection.style.display = isPTSpecialty ? 'none' : 'block';
    }
    if (ptTotalMembersWrapper) {
      ptTotalMembersWrapper.style.display = isPTSpecialty ? 'none' : 'block';
    }
    if (ptSalesWrapper) {
      ptSalesWrapper.style.display = isPTSpecialty ? 'none' : 'block';
    }
    if (membershipSalesWrapper) {
      membershipSalesWrapper.style.display = isPTSpecialty ? 'none' : 'block';
    }
    if (loadSalesBtnWrapper) {
      loadSalesBtnWrapper.style.display = isPTSpecialty ? 'block' : 'none';
    }
    
    // PT 전문샵의 경우 전체 회원수/매출 변경 시 PT 전체 회원수/매출에도 동일 값 반영
    if (isPTSpecialty) {
      const totalMembersInput = document.getElementById('metric-add-total-members');
      const totalSalesInput = document.getElementById('metric-add-total-sales');
      const ptTotalMembersInput = document.getElementById('metric-add-pt-total-members');
      const ptSalesInput = document.getElementById('metric-add-pt-sales');
      
      // 기존 이벤트 리스너 제거를 위해 새로운 함수로 교체
      if (totalMembersInput) {
        const newTotalMembersInput = totalMembersInput.cloneNode(true);
        totalMembersInput.parentNode.replaceChild(newTotalMembersInput, totalMembersInput);
        
        newTotalMembersInput.addEventListener('input', function() {
          if (ptTotalMembersInput) {
            ptTotalMembersInput.value = this.value;
          }
        });
      }
      
      if (totalSalesInput) {
        const newTotalSalesInput = totalSalesInput.cloneNode(true);
        totalSalesInput.parentNode.replaceChild(newTotalSalesInput, totalSalesInput);
        
        newTotalSalesInput.addEventListener('input', function() {
          if (ptSalesInput) {
            ptSalesInput.value = this.value;
          }
        });
      }
    }
  }
  
  document.getElementById('metric-add-center').addEventListener('change', togglePTSpecialtyFields);
  
  // 초기 로드 시에도 적용
  togglePTSpecialtyFields();
  
  // 회원수 불러오기 버튼 이벤트 (이벤트 위임 사용)
  const metricAddModal = document.querySelector('.metric-add-modal');
  if (metricAddModal) {
    metricAddModal.addEventListener('click', async function(e) {
      if (e.target && e.target.id === 'metric-add-load-members-btn') {
        const center = document.getElementById('metric-add-center').value;
        
        if (!center) {
          alert('센터를 먼저 선택해주세요.');
          return;
        }
        
        const btn = e.target;
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '불러오는 중...';
        
        try {
          // 오늘 날짜를 기준으로 통계 API 호출
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          
          // 통계 API 호출 (period, startDate, endDate 필요)
          const response = await fetch(`/api/stats?period=day&startDate=${todayStr}&endDate=${todayStr}`);
          if (!response.ok) {
            throw new Error('회원수 데이터를 불러오는데 실패했습니다.');
          }
          
          const data = await response.json();
          const validMembersCount = data.centerValidMembers?.[center] || 0;
          
          // PT 전문샵인 경우 전체 회원수에, 일반샵인 경우 PT 전체 회원수에 입력
          const isPTSpecialty = center.includes('PT');
          if (isPTSpecialty) {
            const totalMembersInput = document.getElementById('metric-add-total-members');
            if (totalMembersInput) {
              totalMembersInput.value = validMembersCount;
              // input 이벤트 트리거하여 동기화
              totalMembersInput.dispatchEvent(new Event('input'));
            }
          } else {
            const ptTotalMembersInput = document.getElementById('metric-add-pt-total-members');
            if (ptTotalMembersInput) {
              ptTotalMembersInput.value = validMembersCount;
            }
          }
        } catch (error) {
          console.error('회원수 불러오기 오류:', error);
          alert('회원수 데이터를 불러오는 중 오류가 발생했습니다.');
        } finally {
          btn.disabled = false;
          btn.textContent = originalText;
        }
      }
    });
    
    // 매출 불러오기 버튼 이벤트 (이벤트 위임 사용)
    metricAddModal.addEventListener('click', async function(e) {
      if (e.target && e.target.id === 'metric-add-load-sales-btn') {
        const center = document.getElementById('metric-add-center').value;
        const month = document.getElementById('metric-add-month').value;
        
        if (!center || !month) {
          alert('센터와 연월을 먼저 선택해주세요.');
          return;
        }
        
        const btn = e.target;
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '불러오는 중...';
        
        try {
          // YYYY-MM 형식으로 변환
          const yearMonth = month.includes('-') ? month : `${month.substring(0, 4)}-${month.substring(4)}`;
          
          // 매출 API 호출
          const response = await fetch(`/api/sales?yearMonth=${encodeURIComponent(yearMonth)}`);
          if (!response.ok) {
            throw new Error('매출 데이터를 불러오는데 실패했습니다.');
          }
          
          const data = await response.json();
          const totalSales = data.summary?.totalAmount || 0;
          
          // 전체 매출 필드에 값 입력 (동기화 로직에 의해 PT 매출에도 자동 반영됨)
          const totalSalesInput = document.getElementById('metric-add-total-sales');
          if (totalSalesInput) {
            totalSalesInput.value = totalSales;
            // input 이벤트 트리거하여 동기화
            totalSalesInput.dispatchEvent(new Event('input'));
          }
        } catch (error) {
          console.error('매출 불러오기 오류:', error);
          alert('매출 데이터를 불러오는 중 오류가 발생했습니다.');
        } finally {
          btn.disabled = false;
          btn.textContent = originalText;
        }
      }
    });
  }
  
  // PT 지표 불러오기 버튼 이벤트
  document.getElementById('metric-add-load-pt-btn').addEventListener('click', async function() {
    const center = document.getElementById('metric-add-center').value;
    const month = document.getElementById('metric-add-month').value;
    
    if (!center || !month) {
      alert('센터와 연월을 먼저 선택해주세요.');
      return;
    }
    
    const btn = this;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '불러오는 중...';
    
    try {
      await loadPTMetrics(center, month, 'add');
    } catch (error) {
      console.error('PT 지표 불러오기 오류:', error);
      alert('PT 지표를 불러오는 중 오류가 발생했습니다.');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
  
  // 폼 제출 이벤트
  document.getElementById('metric-add-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const center = document.getElementById('metric-add-center').value;
    const month = document.getElementById('metric-add-month').value;
    
    if (!center || !month) {
      document.getElementById('metric-add-result-message').textContent = '센터와 연월을 입력해주세요.';
      return;
    }
    
    // YYYY-MM 형식으로 변환
    const yearMonth = month;
    
    // 해당 센터와 월의 지표가 이미 있는지 확인
    try {
      const checkResponse = await fetch(`/api/metrics?center=${encodeURIComponent(center)}&month=${yearMonth}`);
      const existingMetrics = await checkResponse.json();
      if (existingMetrics && existingMetrics.length > 0) {
        document.getElementById('metric-add-result-message').textContent = '해당 월에 이미 등록된 지표가 있습니다.';
        return;
      }
    } catch (err) {
      console.error('지표 확인 오류:', err);
    }
    
    const isPTSpecialty = center.includes('PT');
    
    const metricData = {
      center,
      month: yearMonth,
      naver_clicks: parseInt(document.getElementById('metric-add-naver-clicks').value) || 0,
      karrot_clicks: parseInt(document.getElementById('metric-add-karrot-clicks').value) || 0,
      pt_new: parseInt(document.getElementById('metric-add-pt-new').value) || 0,
      pt_consultation: parseInt(document.getElementById('metric-add-pt-consultation').value) || 0,
      pt_renewal: parseInt(document.getElementById('metric-add-pt-renewal').value) || 0,
      pt_expiring: parseInt(document.getElementById('metric-add-pt-expiring').value) || 0,
      membership_new: isPTSpecialty ? 0 : (parseInt(document.getElementById('metric-add-membership-new')?.value) || 0),
      membership_renewal: isPTSpecialty ? 0 : (parseInt(document.getElementById('metric-add-membership-renewal')?.value) || 0),
      membership_expiring: isPTSpecialty ? 0 : (parseInt(document.getElementById('metric-add-membership-expiring')?.value) || 0),
      total_members: parseInt(document.getElementById('metric-add-total-members').value) || 0,
      pt_total_members: isPTSpecialty ? 0 : (parseInt(document.getElementById('metric-add-pt-total-members')?.value) || 0),
      total_sales: parseInt(document.getElementById('metric-add-total-sales').value) || 0,
      pt_sales: isPTSpecialty ? 0 : (parseInt(document.getElementById('metric-add-pt-sales')?.value) || 0),
      membership_sales: isPTSpecialty ? 0 : (parseInt(document.getElementById('metric-add-membership-sales')?.value) || 0)
    };
    
    const resultMsg = document.getElementById('metric-add-result-message');
    resultMsg.textContent = '';
    
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '저장 중...';
    
    try {
      const response = await fetch('/api/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metricData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '추가에 실패했습니다.');
      }
      
      closeMetricAddModal();
      
      // 데이터 다시 로드
      const container = document.querySelector('#strategy-content')?.closest('[id^="tab-"]') || document.querySelector('#strategy-root')?.closest('div');
      if (container) {
        loadStrategyData(container);
      }
    } catch (error) {
      console.error('Metric 추가 오류:', error);
      resultMsg.textContent = '추가에 실패했습니다: ' + error.message;
      submitBtn.disabled = false;
      submitBtn.textContent = '저장';
    }
  });
}

function closeMetricAddModal() {
  const overlay = document.querySelector('.metric-add-modal-overlay');
  const modal = document.querySelector('.metric-add-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}
