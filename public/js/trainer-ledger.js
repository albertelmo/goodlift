// 트레이너 장부 모듈
export const trainerLedger = {
  render
};

// 세금 Type 옵션
const TAX_TYPE_OPTIONS = [
  { value: 'vat', label: '부가세' },
  { value: 'income_tax', label: '소득세' }
];

// 현재 날짜 (한국시간 기준)
let currentDate = new Date();
currentDate.setHours(0, 0, 0, 0);

function getCurrentYearMonth() {
  const now = new Date();
  const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  const year = koreanTime.getFullYear();
  const month = String(koreanTime.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getSelectedYearMonth() {
  if (!currentDate) {
    currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
  }
  const koreanTime = new Date(currentDate.getTime() + (9 * 60 * 60 * 1000));
  const year = koreanTime.getFullYear();
  const month = String(koreanTime.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function updateDateDisplay() {
  const dateElement = document.querySelector('#trainer-ledger-current-date');
  if (!dateElement) return;
  
  const koreanCurrentDate = new Date(currentDate);
  dateElement.textContent = koreanCurrentDate.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long'
  });
}

function navigateDate(delta) {
  const newDate = new Date(currentDate);
  newDate.setDate(1);
  newDate.setMonth(newDate.getMonth() + delta);
  currentDate = newDate;
  updateDateDisplay();
  loadLedgerData();
}

function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString('ko-KR');
}

function formatSignedAmount(num) {
  const n = Number(num) || 0;
  if (n < 0) return `-${formatNumber(Math.abs(n))}`;
  return formatNumber(n);
}

function getTaxTypeLabel(taxType) {
  if (!taxType) return '';
  if (taxType === 'vat') return '부가세';
  if (taxType === 'income_tax' || taxType === 'corporate_tax') return '소득세';
  return '소득세';
}

// 이전월 데이터를 이번달로 복사
async function copyPreviousMonthData() {
  const currentYearMonth = getSelectedYearMonth();
  const [year, month] = currentYearMonth.split('-').map(Number);
  
  // 이전월 계산
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }
  const prevYearMonth = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  
  try {
    const currentUser = localStorage.getItem('username');
    if (!currentUser) {
      throw new Error('로그인이 필요합니다.');
    }
    
    const response = await fetch('/api/trainer/copy-previous-month', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fromMonth: prevYearMonth,
        toMonth: currentYearMonth,
        currentUser
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '이전월 데이터 복사에 실패했습니다.');
    }
    
    const result = await response.json();
    alert(`이전월 데이터가 성공적으로 복사되었습니다.\n고정지출: ${result.results.fixed}개, 변동지출: ${result.results.variable}개, 급여: ${result.results.salary}개`);
    await loadLedgerData();
  } catch (error) {
    console.error('이전월 데이터 복사 오류:', error);
    alert(error.message || '이전월 데이터 복사에 실패했습니다.');
  }
}

// 장부 렌더링
async function render(container) {
  if (!container) return;
  
  // 현재 날짜 초기화
  currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  container.innerHTML = `
    <div id="trainer-ledger-content" style="padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <h3 id="trainer-ledger-title" style="margin:0;color:#1976d2;font-size:1.2rem;cursor:pointer;user-select:none;transition:opacity 0.2s;" title="클릭하여 새로고침" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">📖 장부</h3>
          <button id="trainer-ledger-copy-prev-month-btn" style="background:#ff9800;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">이전월 지출 불러오기</button>
        </div>
        <div style="display:flex;gap:12px;align-items:center;">
          <div class="date-navigation">
            <button id="trainer-ledger-prev-btn" class="nav-btn">◀</button>
            <span id="trainer-ledger-current-date" class="current-date"></span>
            <button id="trainer-ledger-next-btn" class="nav-btn">▶</button>
          </div>
        </div>
      </div>
      
      <div id="trainer-ledger-loading" style="text-align:center;padding:40px;color:#888;display:none;">데이터를 불러오는 중...</div>
      
      <!-- 계산식 표시 -->
      <div id="trainer-ledger-calculation" style="background:#f5f5f5;border:1px solid #e0e0e0;border-radius:6px;padding:16px;margin-bottom:16px;">
        <div style="font-size:0.9rem;line-height:1.8;color:#333;">
          <div>총 수입: <span id="trainer-ledger-calc-total-revenue" style="font-weight:600;color:#1976d2;">0원</span></div>
          <div>- 카드수수료: <span id="trainer-ledger-calc-card-fee" style="font-weight:600;color:#d32f2f;">0원</span> <span style="color:#666;font-size:0.8rem;">(매출의 1%)</span></div>
          <div>- 지출: <span id="trainer-ledger-calc-total-expense" style="font-weight:600;color:#d32f2f;">0원</span> <span style="color:#666;font-size:0.8rem;">(지출총합)</span></div>
          <div style="margin-top:8px;padding-top:8px;border-top:2px solid #ddd;font-size:1rem;font-weight:700;color:#1976d2;">
            = <span id="trainer-ledger-calc-result" style="font-size:1.1rem;">0원</span>
          </div>
        </div>
      </div>
      
      <!-- 매출 섹션 -->
      <div style="background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:12px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <h4 id="trainer-ledger-revenue-title" style="margin:0;color:#1976d2;font-size:0.9rem;">매출</h4>
          <button id="trainer-ledger-revenue-edit-btn" style="background:#4caf50;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;">수정</button>
        </div>
        <div id="trainer-ledger-revenue-amount" style="font-size:1rem;font-weight:600;color:#333;padding:8px 0;">0원</div>
      </div>
      
      <!-- 기타수입 섹션 -->
      <div style="background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:12px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <h4 id="trainer-ledger-other-revenue-title" style="margin:0;color:#1976d2;font-size:0.9rem;">기타수입</h4>
          <button id="trainer-ledger-other-revenue-add-btn" style="background:#4caf50;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;">추가</button>
        </div>
        <div id="trainer-ledger-other-revenue-list" style="background:#fff;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;min-height:100px;">
          <div style="text-align:center;padding:20px;color:#999;font-size:0.75rem;">데이터를 불러오는 중...</div>
        </div>
      </div>
      
      <!-- 총 수입 표시 -->
      <div style="background:#f5f5f5;border:1px solid #e0e0e0;border-radius:6px;padding:12px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h4 style="margin:0;color:#1976d2;font-size:0.9rem;">총 수입</h4>
          <span id="trainer-ledger-total-revenue" style="font-size:1.1rem;font-weight:600;color:#1976d2;">0원</span>
        </div>
      </div>
      
      <!-- 지출 종류별 합계 리스트 -->
      <div id="trainer-ledger-summary-list" style="background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:8px;margin-bottom:16px;">
        <h4 id="trainer-ledger-summary-title" style="margin:0 0 8px 0;color:#1976d2;font-size:0.85rem;font-weight:600;">지출 종류별 합계</h4>
        <div id="trainer-ledger-summary-content" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-size:0.75rem;">
          <div style="text-align:center;padding:6px;color:#999;">데이터를 불러오는 중...</div>
        </div>
      </div>
      
      <!-- 고정지출 / 변동지출 / 급여 섹션 -->
      <div style="display:flex;gap:12px;align-items:flex-start;">
        <!-- 고정지출 섹션 -->
        <div style="flex:1;min-width:0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h4 id="trainer-ledger-fixed-title" style="margin:0;color:#1976d2;font-size:0.9rem;">고정지출</h4>
            <button id="trainer-ledger-fixed-add-btn" style="background:#4caf50;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;">추가</button>
          </div>
          <div id="trainer-ledger-fixed-list" style="background:#fff;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;min-height:200px;">
            <div style="text-align:center;padding:20px;color:#999;font-size:0.75rem;">데이터를 불러오는 중...</div>
          </div>
        </div>
        
        <!-- 변동지출 섹션 -->
        <div style="flex:1;min-width:0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h4 id="trainer-ledger-variable-title" style="margin:0;color:#1976d2;font-size:0.9rem;">변동지출</h4>
            <button id="trainer-ledger-variable-add-btn" style="background:#4caf50;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;">추가</button>
          </div>
          <div id="trainer-ledger-variable-list" style="background:#fff;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;min-height:200px;">
            <div style="text-align:center;padding:20px;color:#999;font-size:0.75rem;">데이터를 불러오는 중...</div>
          </div>
        </div>
        
        <!-- 급여 섹션 -->
        <div style="flex:1;min-width:0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h4 id="trainer-ledger-salary-title" style="margin:0;color:#1976d2;font-size:0.9rem;">급여</h4>
            <button id="trainer-ledger-salary-add-btn" style="background:#4caf50;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;">추가</button>
          </div>
          <div id="trainer-ledger-salary-list" style="background:#fff;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;min-height:200px;">
            <div style="text-align:center;padding:20px;color:#999;font-size:0.75rem;">데이터를 불러오는 중...</div>
          </div>
        </div>
      </div>
      
      <!-- 통장잔고 섹션 -->
      <div id="trainer-ledger-settlement-section" style="background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:12px;margin-top:16px;">
        <h4 id="trainer-ledger-settlement-title" style="margin:0;color:#1976d2;font-size:0.95rem;font-weight:600;">통장잔고</h4>
      </div>
    </div>
  `;
  
  // 이벤트 리스너 설정
  setupEventListeners(container);
  
  // 초기 데이터 로드
  await loadLedgerData();
}

function setupEventListeners(container) {
  // 제목 클릭 시 새로고침
  const titleEl = document.getElementById('trainer-ledger-title');
  if (titleEl) {
    titleEl.addEventListener('click', async () => {
      await loadLedgerData();
    });
  }
  
  // 날짜 네비게이션 버튼
  const prevBtn = document.getElementById('trainer-ledger-prev-btn');
  const nextBtn = document.getElementById('trainer-ledger-next-btn');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      navigateDate(-1);
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      navigateDate(1);
    });
  }
  
  // 날짜 표시 업데이트
  updateDateDisplay();
  
  // 고정지출 추가 버튼
  const fixedAddBtn = document.getElementById('trainer-ledger-fixed-add-btn');
  if (fixedAddBtn) {
    fixedAddBtn.addEventListener('click', () => {
      showFixedExpenseAddModal();
    });
  }
  
  // 변동지출 추가 버튼
  const variableAddBtn = document.getElementById('trainer-ledger-variable-add-btn');
  if (variableAddBtn) {
    variableAddBtn.addEventListener('click', () => {
      showVariableExpenseAddModal();
    });
  }
  
  // 급여 추가 버튼
  const salaryAddBtn = document.getElementById('trainer-ledger-salary-add-btn');
  if (salaryAddBtn) {
    salaryAddBtn.addEventListener('click', () => {
      showSalaryAddModal();
    });
  }
  
  // 이전월 지출 불러오기 버튼
  const copyPrevMonthBtn = document.getElementById('trainer-ledger-copy-prev-month-btn');
  if (copyPrevMonthBtn) {
    copyPrevMonthBtn.addEventListener('click', async () => {
      if (confirm('이전월의 고정지출, 변동지출, 급여 데이터를 이번달로 복사하시겠습니까?\n기존 이번달 데이터는 유지됩니다.')) {
        await copyPreviousMonthData();
      }
    });
  }
  
  // 매출 수정 버튼
  const revenueEditBtn = document.getElementById('trainer-ledger-revenue-edit-btn');
  if (revenueEditBtn) {
    console.log('매출 수정 버튼 찾음');
    revenueEditBtn.onclick = () => {
      console.log('매출 수정 버튼 클릭됨');
      showRevenueEditModal();
    };
  } else {
    console.error('매출 수정 버튼을 찾을 수 없습니다.');
  }
  
  // 기타수입 추가 버튼
  const otherRevenueAddBtn = document.getElementById('trainer-ledger-other-revenue-add-btn');
  if (otherRevenueAddBtn) {
    console.log('기타수입 추가 버튼 찾음');
    otherRevenueAddBtn.onclick = () => {
      console.log('기타수입 추가 버튼 클릭됨');
      showOtherRevenueAddModal();
    };
  } else {
    console.error('기타수입 추가 버튼을 찾을 수 없습니다.');
  }
}

// 장부 데이터 로드
async function loadLedgerData() {
  const yearMonth = getSelectedYearMonth();
  const loadingEl = document.getElementById('trainer-ledger-loading');
  const fixedListEl = document.getElementById('trainer-ledger-fixed-list');
  const variableListEl = document.getElementById('trainer-ledger-variable-list');
  const salaryListEl = document.getElementById('trainer-ledger-salary-list');
  
  if (loadingEl) loadingEl.style.display = 'block';
  
  try {
    const currentUser = localStorage.getItem('username');
    if (!currentUser) {
      throw new Error('로그인이 필요합니다.');
    }
    
    // 고정지출, 변동지출, 급여, 매출, 기타수입, 월별정산 데이터 가져오기
    const [fixedResponse, variableResponse, salaryResponse, revenueResponse, otherRevenueResponse, allSettlementsResponse] = await Promise.all([
      fetch(`/api/trainer/fixed-expenses?month=${yearMonth}&currentUser=${encodeURIComponent(currentUser)}`),
      fetch(`/api/trainer/variable-expenses?month=${yearMonth}&currentUser=${encodeURIComponent(currentUser)}`),
      fetch(`/api/trainer/salaries?month=${yearMonth}&currentUser=${encodeURIComponent(currentUser)}`),
      fetch(`/api/trainer/revenues?month=${yearMonth}&currentUser=${encodeURIComponent(currentUser)}`),
      fetch(`/api/trainer/other-revenues?month=${yearMonth}&currentUser=${encodeURIComponent(currentUser)}`),
      fetch(`/api/settlements`) // 모든 정산 데이터 (누적 계산용)
    ]);
    
    const fixedExpenses = fixedResponse.ok ? await fixedResponse.json() : [];
    const variableExpenses = variableResponse.ok ? await variableResponse.json() : [];
    const salaries = salaryResponse.ok ? await salaryResponse.json() : [];
    const revenues = revenueResponse.ok ? await revenueResponse.json() : [];
    const otherRevenues = otherRevenueResponse.ok ? await otherRevenueResponse.json() : [];
    const allSettlements = allSettlementsResponse.ok ? await allSettlementsResponse.json() : [];
    
    // 지출 종류별 합계 계산 및 표시
    renderExpenseSummary(fixedExpenses, variableExpenses, salaries);
    
    // 매출 렌더링
    renderRevenue(revenues);
    
    // 기타수입 렌더링
    renderOtherRevenues(otherRevenues);
    
    // 총 수입 계산 및 표시
    renderTotalRevenue(revenues, otherRevenues);
    
    // 계산식 렌더링
    renderCalculation(revenues, otherRevenues, fixedExpenses, variableExpenses, salaries);
    
    // 고정지출 렌더링
    renderFixedExpenses(fixedExpenses);
    
    // 변동지출 렌더링
    renderVariableExpenses(variableExpenses);
    
    // 급여 렌더링
    renderSalaries(salaries);
    
    // 월별정산 렌더링
    renderSettlement(allSettlements);
    
  } catch (error) {
    console.error('트레이너 장부 데이터 로드 오류:', error);
    if (fixedListEl) fixedListEl.innerHTML = '<div style="text-align:center;padding:20px;color:#d32f2f;font-size:0.75rem;">데이터를 불러오는데 실패했습니다.</div>';
    if (variableListEl) variableListEl.innerHTML = '<div style="text-align:center;padding:20px;color:#d32f2f;font-size:0.75rem;">데이터를 불러오는데 실패했습니다.</div>';
    if (salaryListEl) salaryListEl.innerHTML = '<div style="text-align:center;padding:20px;color:#d32f2f;font-size:0.75rem;">데이터를 불러오는데 실패했습니다.</div>';
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

// 지출 종류별 합계 렌더링
function renderExpenseSummary(fixedExpenses, variableExpenses, salaries) {
  const summaryEl = document.getElementById('trainer-ledger-summary-content');
  if (!summaryEl) return;
  
  // 각 지출 종류별 합계 계산
  const fixedTotal = fixedExpenses.reduce((sum, e) => sum + (parseInt(e.amount) || 0), 0);
  const variableTotal = variableExpenses.reduce((sum, e) => sum + (parseInt(e.amount) || 0), 0);
  const salaryTotal = salaries.reduce((sum, s) => sum + (parseInt(s.amount) || 0), 0);
  
  // 전체 합계 계산
  const grandTotal = fixedTotal + variableTotal + salaryTotal;
  
  // 제목 업데이트
  const titleEl = document.getElementById('trainer-ledger-summary-title');
  if (titleEl) {
    titleEl.innerHTML = `지출 종류별 합계 <span style="color:#666;font-size:0.75rem;font-weight:normal;">(합계: ${formatNumber(grandTotal)}원)</span>`;
  }
  
  // 합계 리스트 HTML 생성
  const summaryItems = [
    { label: '고정지출', amount: fixedTotal, color: '#1976d2' },
    { label: '변동지출', amount: variableTotal, color: '#1976d2' },
    { label: '급여', amount: salaryTotal, color: '#1976d2' }
  ];
  
  summaryEl.innerHTML = summaryItems.map(item => `
    <div style="display:flex;flex-direction:column;align-items:center;padding:6px 4px;background:#f5f5f5;border-radius:4px;border-left:3px solid ${item.color};">
      <span style="font-weight:500;color:#333;font-size:0.7rem;margin-bottom:2px;">${item.label}</span>
      <span style="font-weight:600;color:${item.color};font-size:0.75rem;">${formatNumber(item.amount)}원</span>
    </div>
  `).join('');
}

// 고정지출 렌더링
function renderFixedExpenses(expenses) {
  const listEl = document.getElementById('trainer-ledger-fixed-list');
  if (!listEl) return;
  
  if (expenses.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#999;font-size:0.75rem;">등록된 고정지출이 없습니다.</div>';
    return;
  }
  
  let html = `
    <table style="width:100%;border-collapse:collapse;font-size:0.75rem;">
      <thead>
        <tr style="background:#f9f9f9;border-bottom:1px solid #ddd;">
          <th style="padding:4px;text-align:left;font-weight:600;color:#666;font-size:0.7rem;">항목</th>
          <th style="padding:4px;text-align:right;font-weight:600;color:#666;font-size:0.7rem;">금액</th>
        </tr>
      </thead>
      <tbody>
        ${expenses.map(expense => `
          <tr class="trainer-ledger-fixed-row" data-expense-id="${expense.id}" style="border-bottom:1px solid #eee;cursor:pointer;" onmouseover="this.style.backgroundColor='#f5f5f5'" onmouseout="this.style.backgroundColor='transparent'">
            <td style="padding:4px;">${expense.item || '-'}</td>
            <td style="padding:4px;text-align:right;">${formatNumber(expense.amount || 0)}원</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  listEl.innerHTML = html;
  
  // 이벤트 리스너 설정 - 행 클릭 시 수정 모달 열기
  document.querySelectorAll('.trainer-ledger-fixed-row').forEach(row => {
    row.addEventListener('click', async () => {
      const expenseId = row.getAttribute('data-expense-id');
      const currentUser = localStorage.getItem('username');
      const expense = await fetch(`/api/trainer/fixed-expenses?month=${getSelectedYearMonth()}&currentUser=${encodeURIComponent(currentUser)}`)
        .then(r => r.json())
        .then(expenses => expenses.find(e => e.id === expenseId));
      if (expense) {
        showFixedExpenseEditModal(expense);
      }
    });
  });
}

// 변동지출 렌더링
function renderVariableExpenses(expenses) {
  const listEl = document.getElementById('trainer-ledger-variable-list');
  if (!listEl) return;
  
  if (expenses.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#999;font-size:0.75rem;">등록된 변동지출이 없습니다.</div>';
    return;
  }
  
  let html = `
    <table style="width:100%;border-collapse:collapse;font-size:0.75rem;">
      <thead>
        <tr style="background:#f9f9f9;border-bottom:1px solid #ddd;">
          <th style="padding:4px;text-align:left;font-weight:600;color:#666;font-size:0.7rem;">항목</th>
          <th style="padding:4px;text-align:right;font-weight:600;color:#666;font-size:0.7rem;">금액</th>
        </tr>
      </thead>
      <tbody>
        ${expenses.map(expense => `
          <tr class="trainer-ledger-variable-row" data-expense-id="${expense.id}" style="border-bottom:1px solid #eee;cursor:pointer;" onmouseover="this.style.backgroundColor='#f5f5f5'" onmouseout="this.style.backgroundColor='transparent'">
            <td style="padding:4px;">${expense.item || '-'}${expense.tax_type ? ` <span style="color:#999;font-size:0.7rem;">(${getTaxTypeLabel(expense.tax_type)})</span>` : ''}</td>
            <td style="padding:4px;text-align:right;">${formatNumber(expense.amount || 0)}원</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  listEl.innerHTML = html;
  
  // 이벤트 리스너 설정 - 행 클릭 시 수정 모달 열기
  document.querySelectorAll('.trainer-ledger-variable-row').forEach(row => {
    row.addEventListener('click', async () => {
      const expenseId = row.getAttribute('data-expense-id');
      const currentUser = localStorage.getItem('username');
      const expense = await fetch(`/api/trainer/variable-expenses?month=${getSelectedYearMonth()}&currentUser=${encodeURIComponent(currentUser)}`)
        .then(r => r.json())
        .then(expenses => expenses.find(e => e.id === expenseId));
      if (expense) {
        showVariableExpenseEditModal(expense);
      }
    });
  });
}

// 급여 렌더링
function renderSalaries(salaries) {
  const listEl = document.getElementById('trainer-ledger-salary-list');
  if (!listEl) return;
  
  if (salaries.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#999;font-size:0.75rem;">등록된 급여가 없습니다.</div>';
    return;
  }
  
  let html = `
    <table style="width:100%;border-collapse:collapse;font-size:0.75rem;">
      <thead>
        <tr style="background:#f9f9f9;border-bottom:1px solid #ddd;">
          <th style="padding:4px;text-align:left;font-weight:600;color:#666;font-size:0.7rem;">항목</th>
          <th style="padding:4px;text-align:right;font-weight:600;color:#666;font-size:0.7rem;">금액</th>
        </tr>
      </thead>
      <tbody>
        ${salaries.map(salary => `
          <tr class="trainer-ledger-salary-row" data-salary-id="${salary.id}" style="border-bottom:1px solid #eee;cursor:pointer;" onmouseover="this.style.backgroundColor='#f5f5f5'" onmouseout="this.style.backgroundColor='transparent'">
            <td style="padding:4px;">${salary.item || '-'}</td>
            <td style="padding:4px;text-align:right;">${formatNumber(salary.amount || 0)}원</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  listEl.innerHTML = html;
  
  // 이벤트 리스너 설정 - 행 클릭 시 수정 모달 열기
  document.querySelectorAll('.trainer-ledger-salary-row').forEach(row => {
    row.addEventListener('click', async () => {
      const salaryId = row.getAttribute('data-salary-id');
      const currentUser = localStorage.getItem('username');
      const salary = await fetch(`/api/trainer/salaries?month=${getSelectedYearMonth()}&currentUser=${encodeURIComponent(currentUser)}`)
        .then(r => r.json())
        .then(salaries => salaries.find(s => s.id === salaryId));
      if (salary) {
        showSalaryEditModal(salary);
      }
    });
  });
}

// 고정지출 추가 모달
function showFixedExpenseAddModal() {
  const yearMonth = getSelectedYearMonth();
  const modalHTML = `
    <div class="trainer-ledger-fixed-add-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="trainer-ledger-fixed-add-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:16px;border-radius:12px;box-shadow:0 8px 32px #1976d240;width:85vw;max-width:350px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;color:#1976d2;font-size:1.1rem;">고정지출 추가</h3>
        <button id="trainer-ledger-fixed-add-modal-close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      
      <form id="trainer-ledger-fixed-add-form" style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">연월 *</label>
          <input type="month" id="trainer-ledger-fixed-add-month" value="${yearMonth}" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;appearance:none;-webkit-appearance:none;-moz-appearance:textfield;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">항목 *</label>
          <input type="text" id="trainer-ledger-fixed-add-item" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">금액 *</label>
          <input type="text" id="trainer-ledger-fixed-add-amount" value="0" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;" inputmode="numeric">
        </div>
        
        <div id="trainer-ledger-fixed-add-result-message" style="min-height:20px;color:#d32f2f;font-size:0.8rem;"></div>
        
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
          <button type="button" id="trainer-ledger-fixed-add-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;">취소</button>
          <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;">저장</button>
        </div>
      </form>
    </div>
  `;
  
  const existingOverlay = document.querySelector('.trainer-ledger-fixed-add-modal-overlay');
  const existingModal = document.querySelector('.trainer-ledger-fixed-add-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // 금액 천단위 구분자
  const amountInput = document.getElementById('trainer-ledger-fixed-add-amount');
  if (amountInput) {
    amountInput.addEventListener('input', function(e) {
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
  }
  
  const closeBtn = document.getElementById('trainer-ledger-fixed-add-modal-close');
  const cancelBtn = document.getElementById('trainer-ledger-fixed-add-cancel-btn');
  const overlay = document.querySelector('.trainer-ledger-fixed-add-modal-overlay');
  
  if (closeBtn) closeBtn.addEventListener('click', closeFixedExpenseAddModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeFixedExpenseAddModal);
  if (overlay) overlay.addEventListener('click', closeFixedExpenseAddModal);
  
  const form = document.getElementById('trainer-ledger-fixed-add-form');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const currentUser = localStorage.getItem('username');
      if (!currentUser) {
        alert('로그인이 필요합니다.');
        return;
      }
      
      const expense = {
        month: document.getElementById('trainer-ledger-fixed-add-month').value,
        item: document.getElementById('trainer-ledger-fixed-add-item').value,
        amount: parseInt(document.getElementById('trainer-ledger-fixed-add-amount').value.replace(/,/g, '')) || 0,
        currentUser
      };
      
      if (!expense.month || !expense.item) {
        document.getElementById('trainer-ledger-fixed-add-result-message').textContent = '연월, 항목은 필수입니다.';
        return;
      }
      
      const resultMsg = document.getElementById('trainer-ledger-fixed-add-result-message');
      resultMsg.textContent = '';
      
      const submitBtn = this.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = '저장 중...';
      
      try {
        const response = await fetch('/api/trainer/fixed-expenses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(expense)
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || '추가에 실패했습니다.');
        }
        
        closeFixedExpenseAddModal();
        await loadLedgerData();
      } catch (error) {
        resultMsg.textContent = error.message || '추가에 실패했습니다.';
        submitBtn.disabled = false;
        submitBtn.textContent = '저장';
      }
    });
  }
}

// 고정지출 수정 모달
function showFixedExpenseEditModal(expense) {
  const modalHTML = `
    <div class="trainer-ledger-fixed-edit-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="trainer-ledger-fixed-edit-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:16px;border-radius:12px;box-shadow:0 8px 32px #1976d240;width:85vw;max-width:350px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;color:#1976d2;font-size:1.1rem;">고정지출 수정</h3>
        <button id="trainer-ledger-fixed-edit-modal-close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      
      <form id="trainer-ledger-fixed-edit-form" style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">연월 *</label>
          <input type="month" id="trainer-ledger-fixed-edit-month" value="${expense.month || ''}" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;appearance:none;-webkit-appearance:none;-moz-appearance:textfield;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">항목 *</label>
          <input type="text" id="trainer-ledger-fixed-edit-item" value="${(expense.item || '').replace(/"/g, '&quot;')}" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">금액 *</label>
          <input type="text" id="trainer-ledger-fixed-edit-amount" value="${formatNumber(expense.amount || 0)}" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;" inputmode="numeric">
        </div>
        
        <div id="trainer-ledger-fixed-edit-result-message" style="min-height:20px;color:#d32f2f;font-size:0.8rem;"></div>
        
        <div style="display:flex;gap:8px;justify-content:space-between;margin-top:8px;">
          <button type="button" id="trainer-ledger-fixed-edit-delete-btn" style="background:#d32f2f;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;">삭제</button>
          <div style="display:flex;gap:8px;">
            <button type="button" id="trainer-ledger-fixed-edit-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;">취소</button>
            <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;">저장</button>
          </div>
        </div>
      </form>
    </div>
  `;
  
  const existingOverlay = document.querySelector('.trainer-ledger-fixed-edit-modal-overlay');
  const existingModal = document.querySelector('.trainer-ledger-fixed-edit-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // 금액 천단위 구분자
  const amountInput = document.getElementById('trainer-ledger-fixed-edit-amount');
  if (amountInput) {
    amountInput.addEventListener('input', function(e) {
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
  }
  
  const closeBtn = document.getElementById('trainer-ledger-fixed-edit-modal-close');
  const cancelBtn = document.getElementById('trainer-ledger-fixed-edit-cancel-btn');
  const overlay = document.querySelector('.trainer-ledger-fixed-edit-modal-overlay');
  
  if (closeBtn) closeBtn.addEventListener('click', closeFixedExpenseEditModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeFixedExpenseEditModal);
  if (overlay) overlay.addEventListener('click', closeFixedExpenseEditModal);
  
  // 삭제 버튼
  const deleteBtn = document.getElementById('trainer-ledger-fixed-edit-delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async function() {
      if (confirm('정말 삭제하시겠습니까?')) {
        try {
          const currentUser = localStorage.getItem('username');
          const response = await fetch(`/api/trainer/fixed-expenses/${expense.id}?currentUser=${encodeURIComponent(currentUser)}`, {
            method: 'DELETE'
          });
          
          if (!response.ok) {
            throw new Error('삭제에 실패했습니다.');
          }
          
          closeFixedExpenseEditModal();
          await loadLedgerData();
        } catch (error) {
          console.error('고정지출 삭제 오류:', error);
          alert('삭제에 실패했습니다.');
        }
      }
    });
  }
  
  const form = document.getElementById('trainer-ledger-fixed-edit-form');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const currentUser = localStorage.getItem('username');
      if (!currentUser) {
        alert('로그인이 필요합니다.');
        return;
      }
      
      const updates = {
        month: document.getElementById('trainer-ledger-fixed-edit-month').value,
        item: document.getElementById('trainer-ledger-fixed-edit-item').value,
        amount: parseInt(document.getElementById('trainer-ledger-fixed-edit-amount').value.replace(/,/g, '')) || 0,
        currentUser
      };
      
      if (!updates.month || !updates.item) {
        document.getElementById('trainer-ledger-fixed-edit-result-message').textContent = '연월, 항목은 필수입니다.';
        return;
      }
      
      const resultMsg = document.getElementById('trainer-ledger-fixed-edit-result-message');
      resultMsg.textContent = '';
      
      const submitBtn = this.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = '저장 중...';
      
      try {
        const response = await fetch(`/api/trainer/fixed-expenses/${expense.id}`, {
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
        
        closeFixedExpenseEditModal();
        await loadLedgerData();
      } catch (error) {
        resultMsg.textContent = error.message || '수정에 실패했습니다.';
        submitBtn.disabled = false;
        submitBtn.textContent = '저장';
      }
    });
  }
}

// 변동지출 추가 모달
function showVariableExpenseAddModal() {
  const yearMonth = getSelectedYearMonth();
  const today = new Date().toISOString().split('T')[0];
  const modalHTML = `
    <div class="trainer-ledger-variable-add-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="trainer-ledger-variable-add-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border-radius:12px;box-shadow:0 8px 32px #1976d240;width:85vw;max-width:350px;max-height:85vh;display:flex;flex-direction:column;">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #eee;flex-shrink:0;">
        <h3 style="margin:0;color:#1976d2;font-size:1.1rem;">변동지출 추가</h3>
        <button id="trainer-ledger-variable-add-modal-close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      
      <div style="overflow-y:auto;flex:1;padding:12px 16px;">
        <form id="trainer-ledger-variable-add-form" style="display:flex;flex-direction:column;gap:10px;">
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">연월 *</label>
          <input type="month" id="trainer-ledger-variable-add-month" value="${yearMonth}" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;appearance:none;-webkit-appearance:none;-moz-appearance:textfield;">
        </div>
        
        <div style="display:none;">
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">날짜</label>
          <input type="date" id="trainer-ledger-variable-add-date" value="${today}" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">항목 *</label>
          <input type="text" id="trainer-ledger-variable-add-item" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">금액 *</label>
          <input type="text" id="trainer-ledger-variable-add-amount" value="0" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;" inputmode="numeric">
        </div>
        
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">세금 Type</label>
          <select id="trainer-ledger-variable-add-tax-type" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;">
            <option value="">선택 안함</option>
            ${TAX_TYPE_OPTIONS.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
          </select>
        </div>
        
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">비고</label>
          <textarea id="trainer-ledger-variable-add-note" rows="3" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;resize:vertical;"></textarea>
        </div>
        
        <div id="trainer-ledger-variable-add-result-message" style="min-height:20px;color:#d32f2f;font-size:0.8rem;"></div>
        </form>
      </div>
      
      <div style="display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid #eee;flex-shrink:0;">
        <button type="button" id="trainer-ledger-variable-add-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;">취소</button>
        <button type="submit" form="trainer-ledger-variable-add-form" style="background:#1976d2;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;">저장</button>
      </div>
    </div>
  `;
  
  const existingOverlay = document.querySelector('.trainer-ledger-variable-add-modal-overlay');
  const existingModal = document.querySelector('.trainer-ledger-variable-add-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // 금액 천단위 구분자
  const amountInput = document.getElementById('trainer-ledger-variable-add-amount');
  if (amountInput) {
    amountInput.addEventListener('input', function(e) {
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
  }
  
  const closeBtn = document.getElementById('trainer-ledger-variable-add-modal-close');
  const cancelBtn = document.getElementById('trainer-ledger-variable-add-cancel-btn');
  const overlay = document.querySelector('.trainer-ledger-variable-add-modal-overlay');
  
  if (closeBtn) closeBtn.addEventListener('click', closeVariableExpenseAddModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeVariableExpenseAddModal);
  if (overlay) overlay.addEventListener('click', closeVariableExpenseAddModal);
  
  const form = document.getElementById('trainer-ledger-variable-add-form');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const currentUser = localStorage.getItem('username');
      if (!currentUser) {
        alert('로그인이 필요합니다.');
        return;
      }
      
      const expense = {
        month: document.getElementById('trainer-ledger-variable-add-month').value,
        date: document.getElementById('trainer-ledger-variable-add-date').value || null,
        item: document.getElementById('trainer-ledger-variable-add-item').value,
        amount: parseInt(document.getElementById('trainer-ledger-variable-add-amount').value.replace(/,/g, '')) || 0,
        note: document.getElementById('trainer-ledger-variable-add-note').value || null,
        taxType: document.getElementById('trainer-ledger-variable-add-tax-type').value || null,
        currentUser
      };
      
      if (!expense.month || !expense.item) {
        document.getElementById('trainer-ledger-variable-add-result-message').textContent = '연월, 항목은 필수입니다.';
        return;
      }
      
      const resultMsg = document.getElementById('trainer-ledger-variable-add-result-message');
      resultMsg.textContent = '';
      
      const submitBtn = document.querySelector('button[form="trainer-ledger-variable-add-form"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '저장 중...';
      }
      
      try {
        const response = await fetch('/api/trainer/variable-expenses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(expense)
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || '추가에 실패했습니다.');
        }
        
        closeVariableExpenseAddModal();
        await loadLedgerData();
      } catch (error) {
        resultMsg.textContent = error.message || '추가에 실패했습니다.';
        const submitBtn = document.querySelector('button[form="trainer-ledger-variable-add-form"]');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '저장';
        }
      }
    });
  }
}

// 변동지출 수정 모달
function showVariableExpenseEditModal(expense) {
  const modalHTML = `
    <div class="trainer-ledger-variable-edit-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="trainer-ledger-variable-edit-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border-radius:12px;box-shadow:0 8px 32px #1976d240;width:85vw;max-width:350px;max-height:85vh;display:flex;flex-direction:column;">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #eee;flex-shrink:0;">
        <h3 style="margin:0;color:#1976d2;font-size:1.1rem;">변동지출 수정</h3>
        <button id="trainer-ledger-variable-edit-modal-close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      
      <div style="overflow-y:auto;flex:1;padding:12px 16px;">
        <form id="trainer-ledger-variable-edit-form" style="display:flex;flex-direction:column;gap:10px;">
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">연월 *</label>
          <input type="month" id="trainer-ledger-variable-edit-month" value="${expense.month || ''}" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;appearance:none;-webkit-appearance:none;-moz-appearance:textfield;">
        </div>
        
        <div style="display:none;">
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">날짜</label>
          <input type="date" id="trainer-ledger-variable-edit-date" value="${expense.date || ''}" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">항목 *</label>
          <input type="text" id="trainer-ledger-variable-edit-item" value="${(expense.item || '').replace(/"/g, '&quot;')}" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">금액 *</label>
          <input type="text" id="trainer-ledger-variable-edit-amount" value="${formatNumber(expense.amount || 0)}" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;" inputmode="numeric">
        </div>
        
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">세금 Type</label>
          <select id="trainer-ledger-variable-edit-tax-type" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;">
            <option value="">선택 안함</option>
            ${TAX_TYPE_OPTIONS.map(opt => `<option value="${opt.value}" ${expense.tax_type === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
          </select>
        </div>
        
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">비고</label>
          <textarea id="trainer-ledger-variable-edit-note" rows="3" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;resize:vertical;">${(expense.note || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
        </div>
        
        <div id="trainer-ledger-variable-edit-result-message" style="min-height:20px;color:#d32f2f;font-size:0.8rem;"></div>
        </form>
      </div>
      
      <div style="display:flex;gap:8px;justify-content:space-between;padding:12px 16px;border-top:1px solid #eee;flex-shrink:0;">
        <button type="button" id="trainer-ledger-variable-edit-delete-btn" style="background:#d32f2f;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;">삭제</button>
        <div style="display:flex;gap:8px;">
          <button type="button" id="trainer-ledger-variable-edit-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;">취소</button>
          <button type="submit" form="trainer-ledger-variable-edit-form" style="background:#1976d2;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;">저장</button>
        </div>
      </div>
    </div>
  `;
  
  const existingOverlay = document.querySelector('.trainer-ledger-variable-edit-modal-overlay');
  const existingModal = document.querySelector('.trainer-ledger-variable-edit-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // 금액 천단위 구분자
  const amountInput = document.getElementById('trainer-ledger-variable-edit-amount');
  if (amountInput) {
    amountInput.addEventListener('input', function(e) {
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
  }
  
  const closeBtn = document.getElementById('trainer-ledger-variable-edit-modal-close');
  const cancelBtn = document.getElementById('trainer-ledger-variable-edit-cancel-btn');
  const overlay = document.querySelector('.trainer-ledger-variable-edit-modal-overlay');
  
  if (closeBtn) closeBtn.addEventListener('click', closeVariableExpenseEditModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeVariableExpenseEditModal);
  if (overlay) overlay.addEventListener('click', closeVariableExpenseEditModal);
  
  // 삭제 버튼
  const deleteBtn = document.getElementById('trainer-ledger-variable-edit-delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async function() {
      if (confirm('정말 삭제하시겠습니까?')) {
        try {
          const currentUser = localStorage.getItem('username');
          const response = await fetch(`/api/trainer/variable-expenses/${expense.id}?currentUser=${encodeURIComponent(currentUser)}`, {
            method: 'DELETE'
          });
          
          if (!response.ok) {
            throw new Error('삭제에 실패했습니다.');
          }
          
          closeVariableExpenseEditModal();
          await loadLedgerData();
        } catch (error) {
          console.error('변동지출 삭제 오류:', error);
          alert('삭제에 실패했습니다.');
        }
      }
    });
  }
  
  const form = document.getElementById('trainer-ledger-variable-edit-form');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const currentUser = localStorage.getItem('username');
      if (!currentUser) {
        alert('로그인이 필요합니다.');
        return;
      }
      
      const updates = {
        month: document.getElementById('trainer-ledger-variable-edit-month').value,
        date: document.getElementById('trainer-ledger-variable-edit-date').value || null,
        item: document.getElementById('trainer-ledger-variable-edit-item').value,
        amount: parseInt(document.getElementById('trainer-ledger-variable-edit-amount').value.replace(/,/g, '')) || 0,
        note: document.getElementById('trainer-ledger-variable-edit-note').value || null,
        taxType: document.getElementById('trainer-ledger-variable-edit-tax-type').value || null,
        currentUser
      };
      
      if (!updates.month || !updates.item) {
        document.getElementById('trainer-ledger-variable-edit-result-message').textContent = '연월, 항목은 필수입니다.';
        return;
      }
      
      const resultMsg = document.getElementById('trainer-ledger-variable-edit-result-message');
      resultMsg.textContent = '';
      
      const submitBtn = document.querySelector('button[form="trainer-ledger-variable-edit-form"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '저장 중...';
      }
      
      try {
        const response = await fetch(`/api/trainer/variable-expenses/${expense.id}`, {
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
        
        closeVariableExpenseEditModal();
        await loadLedgerData();
      } catch (error) {
        resultMsg.textContent = error.message || '수정에 실패했습니다.';
        const submitBtn = document.querySelector('button[form="trainer-ledger-variable-edit-form"]');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '저장';
        }
      }
    });
  }
}

// 급여 추가 모달
function showSalaryAddModal() {
  const yearMonth = getSelectedYearMonth();
  const modalHTML = `
    <div class="trainer-ledger-salary-add-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="trainer-ledger-salary-add-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:16px;border-radius:12px;box-shadow:0 8px 32px #1976d240;width:85vw;max-width:350px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;color:#1976d2;font-size:1.1rem;">급여 추가</h3>
        <button id="trainer-ledger-salary-add-modal-close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      
      <form id="trainer-ledger-salary-add-form" style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">연월 *</label>
          <input type="month" id="trainer-ledger-salary-add-month" value="${yearMonth}" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;appearance:none;-webkit-appearance:none;-moz-appearance:textfield;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">항목 *</label>
          <input type="text" id="trainer-ledger-salary-add-item" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">금액 *</label>
          <input type="text" id="trainer-ledger-salary-add-amount" value="0" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;" inputmode="numeric">
        </div>
        
        <div id="trainer-ledger-salary-add-result-message" style="min-height:20px;color:#d32f2f;font-size:0.8rem;"></div>
        
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
          <button type="button" id="trainer-ledger-salary-add-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;">취소</button>
          <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;">저장</button>
        </div>
      </form>
    </div>
  `;
  
  const existingOverlay = document.querySelector('.trainer-ledger-salary-add-modal-overlay');
  const existingModal = document.querySelector('.trainer-ledger-salary-add-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // 금액 천단위 구분자
  const amountInput = document.getElementById('trainer-ledger-salary-add-amount');
  if (amountInput) {
    amountInput.addEventListener('input', function(e) {
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
  }
  
  const closeBtn = document.getElementById('trainer-ledger-salary-add-modal-close');
  const cancelBtn = document.getElementById('trainer-ledger-salary-add-cancel-btn');
  const overlay = document.querySelector('.trainer-ledger-salary-add-modal-overlay');
  
  if (closeBtn) closeBtn.addEventListener('click', closeSalaryAddModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeSalaryAddModal);
  if (overlay) overlay.addEventListener('click', closeSalaryAddModal);
  
  const form = document.getElementById('trainer-ledger-salary-add-form');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const currentUser = localStorage.getItem('username');
      if (!currentUser) {
        alert('로그인이 필요합니다.');
        return;
      }
      
      const salary = {
        month: document.getElementById('trainer-ledger-salary-add-month').value,
        item: document.getElementById('trainer-ledger-salary-add-item').value,
        amount: parseInt(document.getElementById('trainer-ledger-salary-add-amount').value.replace(/,/g, '')) || 0,
        currentUser
      };
      
      if (!salary.month || !salary.item) {
        document.getElementById('trainer-ledger-salary-add-result-message').textContent = '연월, 항목은 필수입니다.';
        return;
      }
      
      const resultMsg = document.getElementById('trainer-ledger-salary-add-result-message');
      resultMsg.textContent = '';
      
      const submitBtn = this.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = '저장 중...';
      
      try {
        const response = await fetch('/api/trainer/salaries', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(salary)
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || '추가에 실패했습니다.');
        }
        
        closeSalaryAddModal();
        await loadLedgerData();
      } catch (error) {
        resultMsg.textContent = error.message || '추가에 실패했습니다.';
        submitBtn.disabled = false;
        submitBtn.textContent = '저장';
      }
    });
  }
}

// 급여 수정 모달
function showSalaryEditModal(salary) {
  const modalHTML = `
    <div class="trainer-ledger-salary-edit-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="trainer-ledger-salary-edit-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:16px;border-radius:12px;box-shadow:0 8px 32px #1976d240;width:85vw;max-width:350px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;color:#1976d2;font-size:1.1rem;">급여 수정</h3>
        <button id="trainer-ledger-salary-edit-modal-close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      
      <form id="trainer-ledger-salary-edit-form" style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">연월 *</label>
          <input type="month" id="trainer-ledger-salary-edit-month" value="${salary.month || ''}" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;appearance:none;-webkit-appearance:none;-moz-appearance:textfield;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">항목 *</label>
          <input type="text" id="trainer-ledger-salary-edit-item" value="${(salary.item || '').replace(/"/g, '&quot;')}" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">금액 *</label>
          <input type="text" id="trainer-ledger-salary-edit-amount" value="${formatNumber(salary.amount || 0)}" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;" inputmode="numeric">
        </div>
        
        <div id="trainer-ledger-salary-edit-result-message" style="min-height:20px;color:#d32f2f;font-size:0.8rem;"></div>
        
        <div style="display:flex;gap:8px;justify-content:space-between;margin-top:8px;">
          <button type="button" id="trainer-ledger-salary-edit-delete-btn" style="background:#d32f2f;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;">삭제</button>
          <div style="display:flex;gap:8px;">
            <button type="button" id="trainer-ledger-salary-edit-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;">취소</button>
            <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;">저장</button>
          </div>
        </div>
      </form>
    </div>
  `;
  
  const existingOverlay = document.querySelector('.trainer-ledger-salary-edit-modal-overlay');
  const existingModal = document.querySelector('.trainer-ledger-salary-edit-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // 금액 천단위 구분자
  const amountInput = document.getElementById('trainer-ledger-salary-edit-amount');
  if (amountInput) {
    amountInput.addEventListener('input', function(e) {
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
  }
  
  const closeBtn = document.getElementById('trainer-ledger-salary-edit-modal-close');
  const cancelBtn = document.getElementById('trainer-ledger-salary-edit-cancel-btn');
  const overlay = document.querySelector('.trainer-ledger-salary-edit-modal-overlay');
  
  if (closeBtn) closeBtn.addEventListener('click', closeSalaryEditModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeSalaryEditModal);
  if (overlay) overlay.addEventListener('click', closeSalaryEditModal);
  
  // 삭제 버튼
  const deleteBtn = document.getElementById('trainer-ledger-salary-edit-delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async function() {
      if (confirm('정말 삭제하시겠습니까?')) {
        try {
          const currentUser = localStorage.getItem('username');
          const response = await fetch(`/api/trainer/salaries/${salary.id}?currentUser=${encodeURIComponent(currentUser)}`, {
            method: 'DELETE'
          });
          
          if (!response.ok) {
            throw new Error('삭제에 실패했습니다.');
          }
          
          closeSalaryEditModal();
          await loadLedgerData();
        } catch (error) {
          console.error('급여 삭제 오류:', error);
          alert('삭제에 실패했습니다.');
        }
      }
    });
  }
  
  const form = document.getElementById('trainer-ledger-salary-edit-form');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const currentUser = localStorage.getItem('username');
      if (!currentUser) {
        alert('로그인이 필요합니다.');
        return;
      }
      
      const updates = {
        month: document.getElementById('trainer-ledger-salary-edit-month').value,
        item: document.getElementById('trainer-ledger-salary-edit-item').value,
        amount: parseInt(document.getElementById('trainer-ledger-salary-edit-amount').value.replace(/,/g, '')) || 0,
        currentUser
      };
      
      if (!updates.month || !updates.item) {
        document.getElementById('trainer-ledger-salary-edit-result-message').textContent = '연월, 항목은 필수입니다.';
        return;
      }
      
      const resultMsg = document.getElementById('trainer-ledger-salary-edit-result-message');
      resultMsg.textContent = '';
      
      const submitBtn = this.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = '저장 중...';
      
      try {
        const response = await fetch(`/api/trainer/salaries/${salary.id}`, {
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
        
        closeSalaryEditModal();
        await loadLedgerData();
      } catch (error) {
        resultMsg.textContent = error.message || '수정에 실패했습니다.';
        submitBtn.disabled = false;
        submitBtn.textContent = '저장';
      }
    });
  }
}

// 모달 닫기 함수들
function closeFixedExpenseAddModal() {
  const overlay = document.querySelector('.trainer-ledger-fixed-add-modal-overlay');
  const modal = document.querySelector('.trainer-ledger-fixed-add-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

function closeFixedExpenseEditModal() {
  const overlay = document.querySelector('.trainer-ledger-fixed-edit-modal-overlay');
  const modal = document.querySelector('.trainer-ledger-fixed-edit-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

function closeVariableExpenseAddModal() {
  const overlay = document.querySelector('.trainer-ledger-variable-add-modal-overlay');
  const modal = document.querySelector('.trainer-ledger-variable-add-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

function closeVariableExpenseEditModal() {
  const overlay = document.querySelector('.trainer-ledger-variable-edit-modal-overlay');
  const modal = document.querySelector('.trainer-ledger-variable-edit-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

function closeSalaryAddModal() {
  const overlay = document.querySelector('.trainer-ledger-salary-add-modal-overlay');
  const modal = document.querySelector('.trainer-ledger-salary-add-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

function closeSalaryEditModal() {
  const overlay = document.querySelector('.trainer-ledger-salary-edit-modal-overlay');
  const modal = document.querySelector('.trainer-ledger-salary-edit-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

// 매출 렌더링
function renderRevenue(revenues) {
  const amountEl = document.getElementById('trainer-ledger-revenue-amount');
  if (!amountEl) return;
  
  const revenue = revenues.length > 0 ? revenues[0] : null;
  const amount = revenue ? (revenue.amount || 0) : 0;
  
  amountEl.textContent = `${formatNumber(amount)}원`;
}

// 기타수입 렌더링
function renderOtherRevenues(revenues) {
  const listEl = document.getElementById('trainer-ledger-other-revenue-list');
  if (!listEl) return;
  
  const grandTotal = revenues.reduce((sum, r) => sum + (parseInt(r.amount) || 0), 0);
  
  const titleEl = document.getElementById('trainer-ledger-other-revenue-title');
  if (titleEl) {
    titleEl.innerHTML = `기타수입 <span style="color:#666;font-size:0.85rem;font-weight:normal;">(합계: ${formatNumber(grandTotal)}원)</span>`;
  }
  
  if (revenues.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#999;font-size:0.75rem;">등록된 기타수입이 없습니다.</div>';
    if (titleEl) {
      titleEl.innerHTML = `기타수입 <span style="color:#666;font-size:0.85rem;font-weight:normal;">(합계: 0원)</span>`;
    }
    return;
  }
  
  let html = `
    <table style="width:100%;border-collapse:collapse;font-size:0.75rem;">
      <thead>
        <tr style="background:#f9f9f9;border-bottom:1px solid #ddd;">
          <th style="padding:4px;text-align:left;font-weight:600;color:#666;font-size:0.7rem;">항목</th>
          <th style="padding:4px;text-align:right;font-weight:600;color:#666;font-size:0.7rem;">금액</th>
        </tr>
      </thead>
      <tbody>
        ${revenues.map(revenue => `
          <tr class="trainer-ledger-other-revenue-row" data-revenue-id="${revenue.id}" style="border-bottom:1px solid #eee;cursor:pointer;" onmouseover="this.style.backgroundColor='#f5f5f5'" onmouseout="this.style.backgroundColor='transparent'">
            <td style="padding:4px;">${revenue.item || '-'}</td>
            <td style="padding:4px;text-align:right;">${formatNumber(revenue.amount || 0)}원</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  listEl.innerHTML = html;
  
  // 이벤트 리스너 설정 - 행 클릭 시 수정 모달 열기
  document.querySelectorAll('.trainer-ledger-other-revenue-row').forEach(row => {
    row.addEventListener('click', async () => {
      const revenueId = row.getAttribute('data-revenue-id');
      const currentUser = localStorage.getItem('username');
      const revenue = await fetch(`/api/trainer/other-revenues?month=${getSelectedYearMonth()}&currentUser=${encodeURIComponent(currentUser)}`)
        .then(r => r.json())
        .then(revenues => revenues.find(r => r.id === revenueId));
      if (revenue) {
        showOtherRevenueEditModal(revenue);
      }
    });
  });
}

// 총 수입 계산 및 표시
function renderTotalRevenue(revenues, otherRevenues) {
  const totalEl = document.getElementById('trainer-ledger-total-revenue');
  if (!totalEl) return;
  
  const revenueAmount = revenues.length > 0 ? (revenues[0].amount || 0) : 0;
  const otherRevenueTotal = otherRevenues.reduce((sum, r) => sum + (parseInt(r.amount) || 0), 0);
  const total = revenueAmount + otherRevenueTotal;
  
  totalEl.textContent = `${formatNumber(total)}원`;
}

// 계산식 렌더링
function renderCalculation(revenues, otherRevenues, fixedExpenses, variableExpenses, salaries) {
  // 총 수입 계산
  const revenueAmount = revenues.length > 0 ? (revenues[0].amount || 0) : 0;
  const otherRevenueTotal = otherRevenues.reduce((sum, r) => sum + (parseInt(r.amount) || 0), 0);
  const totalRevenue = revenueAmount + otherRevenueTotal;
  
  // 카드수수료 계산 (매출의 1%)
  const cardFee = Math.floor(revenueAmount * 0.01);
  
  // 지출 총합 계산
  const fixedTotal = fixedExpenses.reduce((sum, e) => sum + (parseInt(e.amount) || 0), 0);
  const variableTotal = variableExpenses.reduce((sum, e) => sum + (parseInt(e.amount) || 0), 0);
  const salaryTotal = salaries.reduce((sum, s) => sum + (parseInt(s.amount) || 0), 0);
  const totalExpense = fixedTotal + variableTotal + salaryTotal;
  
  // 최종 결과 계산
  const result = totalRevenue - cardFee - totalExpense;
  
  // 표시
  const totalRevenueEl = document.getElementById('trainer-ledger-calc-total-revenue');
  const cardFeeEl = document.getElementById('trainer-ledger-calc-card-fee');
  const totalExpenseEl = document.getElementById('trainer-ledger-calc-total-expense');
  const resultEl = document.getElementById('trainer-ledger-calc-result');
  
  if (totalRevenueEl) totalRevenueEl.textContent = `${formatNumber(totalRevenue)}원`;
  if (cardFeeEl) cardFeeEl.textContent = `${formatNumber(cardFee)}원`;
  if (totalExpenseEl) totalExpenseEl.textContent = `${formatNumber(totalExpense)}원`;
  if (resultEl) {
    resultEl.textContent = `${formatNumber(result)}원`;
    // 결과가 음수면 빨간색, 양수면 파란색
    resultEl.style.color = result < 0 ? '#d32f2f' : '#1976d2';
  }
}

// 매출 수정 모달
function showRevenueEditModal() {
  console.log('showRevenueEditModal 호출됨');
  const yearMonth = getSelectedYearMonth();
  const currentUser = localStorage.getItem('username');
  
  if (!currentUser) {
    alert('로그인이 필요합니다.');
    return;
  }
  
  // 현재 매출 조회
  fetch(`/api/trainer/revenues?month=${yearMonth}&currentUser=${encodeURIComponent(currentUser)}`)
    .then(r => r.json())
    .then(revenues => {
      const revenue = revenues.length > 0 ? revenues[0] : null;
      const currentAmount = revenue ? (revenue.amount || 0) : 0;
      
      const modalHTML = `
        <div class="trainer-ledger-revenue-edit-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
        <div class="trainer-ledger-revenue-edit-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:16px;border-radius:12px;box-shadow:0 8px 32px #1976d240;width:85vw;max-width:350px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h3 style="margin:0;color:#1976d2;font-size:1.1rem;">매출 ${revenue ? '수정' : '입력'}</h3>
            <button id="trainer-ledger-revenue-edit-modal-close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
          </div>
          
          <form id="trainer-ledger-revenue-edit-form" style="display:flex;flex-direction:column;gap:12px;">
            <div>
              <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">연월 *</label>
              <input type="month" id="trainer-ledger-revenue-edit-month" value="${yearMonth}" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;appearance:none;-webkit-appearance:none;-moz-appearance:textfield;">
            </div>
            
            <div>
              <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">금액 *</label>
              <input type="text" id="trainer-ledger-revenue-edit-amount" value="${formatNumber(currentAmount)}" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;" inputmode="numeric">
            </div>
            
            <div id="trainer-ledger-revenue-edit-result-message" style="min-height:20px;color:#d32f2f;font-size:0.8rem;"></div>
            
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
              <button type="button" id="trainer-ledger-revenue-edit-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;">취소</button>
              <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;">저장</button>
            </div>
          </form>
        </div>
      `;
      
      const existingOverlay = document.querySelector('.trainer-ledger-revenue-edit-modal-overlay');
      const existingModal = document.querySelector('.trainer-ledger-revenue-edit-modal');
      if (existingOverlay) existingOverlay.remove();
      if (existingModal) existingModal.remove();
      
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      
      // 금액 천단위 구분자
      const amountInput = document.getElementById('trainer-ledger-revenue-edit-amount');
      if (amountInput) {
        amountInput.addEventListener('input', function(e) {
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
      }
      
      const closeBtn = document.getElementById('trainer-ledger-revenue-edit-modal-close');
      const cancelBtn = document.getElementById('trainer-ledger-revenue-edit-cancel-btn');
      const overlay = document.querySelector('.trainer-ledger-revenue-edit-modal-overlay');
      
      if (closeBtn) closeBtn.addEventListener('click', closeRevenueEditModal);
      if (cancelBtn) cancelBtn.addEventListener('click', closeRevenueEditModal);
      if (overlay) overlay.addEventListener('click', closeRevenueEditModal);
      
      const form = document.getElementById('trainer-ledger-revenue-edit-form');
      if (form) {
        form.addEventListener('submit', async function(e) {
          e.preventDefault();
          
          const currentUser = localStorage.getItem('username');
          if (!currentUser) {
            alert('로그인이 필요합니다.');
            return;
          }
          
          const revenueData = {
            month: document.getElementById('trainer-ledger-revenue-edit-month').value,
            amount: parseInt(document.getElementById('trainer-ledger-revenue-edit-amount').value.replace(/,/g, '')) || 0,
            currentUser
          };
          
          if (!revenueData.month) {
            document.getElementById('trainer-ledger-revenue-edit-result-message').textContent = '연월은 필수입니다.';
            return;
          }
          
          const resultMsg = document.getElementById('trainer-ledger-revenue-edit-result-message');
          resultMsg.textContent = '';
          
          const submitBtn = this.querySelector('button[type="submit"]');
          submitBtn.disabled = true;
          submitBtn.textContent = '저장 중...';
          
          try {
            const response = await fetch('/api/trainer/revenues', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(revenueData)
            });
            
            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.message || '저장에 실패했습니다.');
            }
            
            closeRevenueEditModal();
            await loadLedgerData();
          } catch (error) {
            resultMsg.textContent = error.message || '저장에 실패했습니다.';
            submitBtn.disabled = false;
            submitBtn.textContent = '저장';
          }
        });
      }
    })
    .catch(error => {
      console.error('매출 조회 오류:', error);
      alert('매출 데이터를 불러오는데 실패했습니다.');
    });
}

// 기타수입 추가 모달
function showOtherRevenueAddModal() {
  console.log('showOtherRevenueAddModal 호출됨');
  const yearMonth = getSelectedYearMonth();
  const modalHTML = `
    <div class="trainer-ledger-other-revenue-add-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="trainer-ledger-other-revenue-add-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:16px;border-radius:12px;box-shadow:0 8px 32px #1976d240;width:85vw;max-width:350px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;color:#1976d2;font-size:1.1rem;">기타수입 추가</h3>
        <button id="trainer-ledger-other-revenue-add-modal-close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      
      <form id="trainer-ledger-other-revenue-add-form" style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">연월 *</label>
          <input type="month" id="trainer-ledger-other-revenue-add-month" value="${yearMonth}" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;appearance:none;-webkit-appearance:none;-moz-appearance:textfield;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">항목 *</label>
          <input type="text" id="trainer-ledger-other-revenue-add-item" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">금액 *</label>
          <input type="text" id="trainer-ledger-other-revenue-add-amount" value="0" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;" inputmode="numeric">
        </div>
        
        <div id="trainer-ledger-other-revenue-add-result-message" style="min-height:20px;color:#d32f2f;font-size:0.8rem;"></div>
        
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
          <button type="button" id="trainer-ledger-other-revenue-add-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;">취소</button>
          <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;">저장</button>
        </div>
      </form>
    </div>
  `;
  
  const existingOverlay = document.querySelector('.trainer-ledger-other-revenue-add-modal-overlay');
  const existingModal = document.querySelector('.trainer-ledger-other-revenue-add-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // 금액 천단위 구분자
  const amountInput = document.getElementById('trainer-ledger-other-revenue-add-amount');
  if (amountInput) {
    amountInput.addEventListener('input', function(e) {
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
  }
  
  const closeBtn = document.getElementById('trainer-ledger-other-revenue-add-modal-close');
  const cancelBtn = document.getElementById('trainer-ledger-other-revenue-add-cancel-btn');
  const overlay = document.querySelector('.trainer-ledger-other-revenue-add-modal-overlay');
  
  if (closeBtn) closeBtn.addEventListener('click', closeOtherRevenueAddModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeOtherRevenueAddModal);
  if (overlay) overlay.addEventListener('click', closeOtherRevenueAddModal);
  
  const form = document.getElementById('trainer-ledger-other-revenue-add-form');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const currentUser = localStorage.getItem('username');
      if (!currentUser) {
        alert('로그인이 필요합니다.');
        return;
      }
      
      const revenue = {
        month: document.getElementById('trainer-ledger-other-revenue-add-month').value,
        item: document.getElementById('trainer-ledger-other-revenue-add-item').value,
        amount: parseInt(document.getElementById('trainer-ledger-other-revenue-add-amount').value.replace(/,/g, '')) || 0,
        currentUser
      };
      
      if (!revenue.month || !revenue.item) {
        document.getElementById('trainer-ledger-other-revenue-add-result-message').textContent = '연월, 항목은 필수입니다.';
        return;
      }
      
      const resultMsg = document.getElementById('trainer-ledger-other-revenue-add-result-message');
      resultMsg.textContent = '';
      
      const submitBtn = this.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = '저장 중...';
      
      try {
        const response = await fetch('/api/trainer/other-revenues', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(revenue)
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || '추가에 실패했습니다.');
        }
        
        closeOtherRevenueAddModal();
        await loadLedgerData();
      } catch (error) {
        resultMsg.textContent = error.message || '추가에 실패했습니다.';
        submitBtn.disabled = false;
        submitBtn.textContent = '저장';
      }
    });
  }
}

// 기타수입 수정 모달
function showOtherRevenueEditModal(revenue) {
  const modalHTML = `
    <div class="trainer-ledger-other-revenue-edit-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="trainer-ledger-other-revenue-edit-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:16px;border-radius:12px;box-shadow:0 8px 32px #1976d240;width:85vw;max-width:350px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;color:#1976d2;font-size:1.1rem;">기타수입 수정</h3>
        <button id="trainer-ledger-other-revenue-edit-modal-close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      
      <form id="trainer-ledger-other-revenue-edit-form" style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">연월 *</label>
          <input type="month" id="trainer-ledger-other-revenue-edit-month" value="${revenue.month || ''}" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;appearance:none;-webkit-appearance:none;-moz-appearance:textfield;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">항목 *</label>
          <input type="text" id="trainer-ledger-other-revenue-edit-item" value="${(revenue.item || '').replace(/"/g, '&quot;')}" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">금액 *</label>
          <input type="text" id="trainer-ledger-other-revenue-edit-amount" value="${formatNumber(revenue.amount || 0)}" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;box-sizing:border-box;" inputmode="numeric">
        </div>
        
        <div id="trainer-ledger-other-revenue-edit-result-message" style="min-height:20px;color:#d32f2f;font-size:0.8rem;"></div>
        
        <div style="display:flex;gap:8px;justify-content:space-between;margin-top:8px;">
          <button type="button" id="trainer-ledger-other-revenue-edit-delete-btn" style="background:#d32f2f;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;">삭제</button>
          <div style="display:flex;gap:8px;">
            <button type="button" id="trainer-ledger-other-revenue-edit-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;">취소</button>
            <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;">저장</button>
          </div>
        </div>
      </form>
    </div>
  `;
  
  const existingOverlay = document.querySelector('.trainer-ledger-other-revenue-edit-modal-overlay');
  const existingModal = document.querySelector('.trainer-ledger-other-revenue-edit-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // 금액 천단위 구분자
  const amountInput = document.getElementById('trainer-ledger-other-revenue-edit-amount');
  if (amountInput) {
    amountInput.addEventListener('input', function(e) {
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
  }
  
  const closeBtn = document.getElementById('trainer-ledger-other-revenue-edit-modal-close');
  const cancelBtn = document.getElementById('trainer-ledger-other-revenue-edit-cancel-btn');
  const overlay = document.querySelector('.trainer-ledger-other-revenue-edit-modal-overlay');
  
  if (closeBtn) closeBtn.addEventListener('click', closeOtherRevenueEditModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeOtherRevenueEditModal);
  if (overlay) overlay.addEventListener('click', closeOtherRevenueEditModal);
  
  // 삭제 버튼
  const deleteBtn = document.getElementById('trainer-ledger-other-revenue-edit-delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async function() {
      if (confirm('정말 삭제하시겠습니까?')) {
        try {
          const currentUser = localStorage.getItem('username');
          const response = await fetch(`/api/trainer/other-revenues/${revenue.id}?currentUser=${encodeURIComponent(currentUser)}`, {
            method: 'DELETE'
          });
          
          if (!response.ok) {
            throw new Error('삭제에 실패했습니다.');
          }
          
          closeOtherRevenueEditModal();
          await loadLedgerData();
        } catch (error) {
          console.error('기타수입 삭제 오류:', error);
          alert('삭제에 실패했습니다.');
        }
      }
    });
  }
  
  const form = document.getElementById('trainer-ledger-other-revenue-edit-form');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const currentUser = localStorage.getItem('username');
      if (!currentUser) {
        alert('로그인이 필요합니다.');
        return;
      }
      
      const updates = {
        month: document.getElementById('trainer-ledger-other-revenue-edit-month').value,
        item: document.getElementById('trainer-ledger-other-revenue-edit-item').value,
        amount: parseInt(document.getElementById('trainer-ledger-other-revenue-edit-amount').value.replace(/,/g, '')) || 0,
        currentUser
      };
      
      if (!updates.month || !updates.item) {
        document.getElementById('trainer-ledger-other-revenue-edit-result-message').textContent = '연월, 항목은 필수입니다.';
        return;
      }
      
      const resultMsg = document.getElementById('trainer-ledger-other-revenue-edit-result-message');
      resultMsg.textContent = '';
      
      const submitBtn = this.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = '저장 중...';
      
      try {
        const response = await fetch(`/api/trainer/other-revenues/${revenue.id}`, {
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
        
        closeOtherRevenueEditModal();
        await loadLedgerData();
      } catch (error) {
        resultMsg.textContent = error.message || '수정에 실패했습니다.';
        submitBtn.disabled = false;
        submitBtn.textContent = '저장';
      }
    });
  }
}

// 모달 닫기 함수들
function closeRevenueEditModal() {
  const overlay = document.querySelector('.trainer-ledger-revenue-edit-modal-overlay');
  const modal = document.querySelector('.trainer-ledger-revenue-edit-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

function closeOtherRevenueAddModal() {
  const overlay = document.querySelector('.trainer-ledger-other-revenue-add-modal-overlay');
  const modal = document.querySelector('.trainer-ledger-other-revenue-add-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

function closeOtherRevenueEditModal() {
  const overlay = document.querySelector('.trainer-ledger-other-revenue-edit-modal-overlay');
  const modal = document.querySelector('.trainer-ledger-other-revenue-edit-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

// 월별정산 렌더링
function renderSettlement(allSettlements) {
  const titleEl = document.getElementById('trainer-ledger-settlement-title');
  if (!titleEl) return;
  
  // 누적 손익액과 누적 정산액 계산
  const cumulativeProfit = allSettlements.reduce((sum, s) => sum + (parseInt(s.profitAmount) || 0), 0);
  const cumulativeSettlement = allSettlements.reduce((sum, s) => sum + (s.settlementAmount !== null ? parseInt(s.settlementAmount) || 0 : 0), 0);
  const difference = cumulativeProfit - cumulativeSettlement;
  
  const differenceFormatted = difference < 0 ? `-${formatNumber(Math.abs(difference))}` : formatNumber(difference);
  const differenceColor = difference < 0 ? '#d32f2f' : '#1976d2';
  
  titleEl.innerHTML = `통장잔고 <span style="color:#666;font-size:0.75rem;font-weight:normal;">(누적 손익액 ${formatSignedAmount(cumulativeProfit)}원 - 누적 정산액 ${formatSignedAmount(cumulativeSettlement)}원 = <span style="color:${differenceColor};">${differenceFormatted}원</span>)</span>`;
}
