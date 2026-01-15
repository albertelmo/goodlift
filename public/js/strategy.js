// 전략 모듈
export const strategy = {
  render
};

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
          <button id="strategy-add-btn" style="background:#1976d2;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:0.9rem;white-space:nowrap;">추가</button>
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
  
  // 이번달과 지난달 데이터를 동시에 가져오기
  Promise.all([
    fetch(`/api/metrics?month=${yearMonth}`).then(r => r.json()),
    fetch(`/api/metrics?month=${lastYearMonth}`).then(r => r.json())
  ])
    .then(([currentMetrics, lastMetrics]) => {
      loadingEl.style.display = 'none';
      renderMetrics(currentMetrics, lastMetrics, centerOrder, yearMonth);
    })
    .catch(err => {
      loadingEl.style.display = 'none';
      contentEl.innerHTML = `<div style="text-align:center;padding:40px;color:#d32f2f;">데이터를 불러오지 못했습니다.</div>`;
      console.error('지표 조회 오류:', err);
    });
}

function renderMetrics(currentMetrics, lastMetrics, centerOrder, yearMonth) {
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
  
  // 한 줄에 3개씩 배치
  let html = '<div style="display:flex;flex-wrap:wrap;gap:12px;">';
  
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
            <button class="metric-edit-btn" data-metric-id="${currentMetric.id}" data-metric-data='${JSON.stringify(currentMetric)}' style="background:#1976d2;color:#fff;border:none;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:0.75rem;white-space:nowrap;flex-shrink:0;">수정</button>
          </div>
        </div>
        <div style="padding:8px 10px;">
          <div style="margin-bottom:6px;">
            <h5 style="margin:0 0 4px 0;color:#666;font-size:0.75rem;font-weight:600;">마케팅</h5>
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
          </div>
          
          <div style="margin-bottom:6px;border-top:1px solid #e0e0e0;padding-top:6px;">
            <h5 style="margin:0 0 4px 0;color:#666;font-size:0.75rem;font-weight:600;">PT</h5>
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
          </div>
          
          ${!isPTSpecialty ? `
          <div style="margin-bottom:6px;border-top:1px solid #e0e0e0;padding-top:6px;">
            <h5 style="margin:0 0 4px 0;color:#666;font-size:0.75rem;font-weight:600;">회원권</h5>
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
          </div>
          ` : ''}
          
          <div style="margin-bottom:6px;border-top:1px solid #e0e0e0;padding-top:6px;">
            <h5 style="margin:0 0 4px 0;color:#666;font-size:0.75rem;font-weight:600;">회원 수</h5>
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
          </div>
          
          <div style="border-top:1px solid #e0e0e0;padding-top:6px;">
            <h5 style="margin:0 0 4px 0;color:#666;font-size:0.75rem;font-weight:600;">매출 <span style="color:#999;font-weight:normal;font-size:0.7rem;">(단위:만)</span></h5>
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
    btn.addEventListener('click', function() {
      const metricData = JSON.parse(this.getAttribute('data-metric-data'));
      showMetricEditModal(metricData);
    });
  });
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
            <button type="button" id="metric-edit-load-pt-btn" style="background:#4caf50;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">불러오기</button>
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
          <h4 style="margin:0 0 12px 0;color:#1976d2;font-size:1rem;">회원 수 지표</h4>
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
            <button type="button" id="metric-edit-load-sales-btn" style="background:#4caf50;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">불러오기</button>
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
          <h4 style="margin:0 0 12px 0;color:#1976d2;font-size:1rem;">회원 수 지표</h4>
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
  
  // 매출 불러오기 버튼 이벤트 (이벤트 위임 사용)
  const metricAddModal = document.querySelector('.metric-add-modal');
  if (metricAddModal) {
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
