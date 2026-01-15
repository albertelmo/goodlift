// 장부 모듈
export const ledger = {
  render
};

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

function updateDateDisplay() {
  const dateElement = document.querySelector('#ledger-current-date');
  if (!dateElement) return;
  
  const koreanCurrentDate = new Date(currentDate);
  dateElement.textContent = koreanCurrentDate.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long'
  });
}

function navigateDate(delta) {
  const newDate = new Date(currentDate);
  newDate.setMonth(newDate.getMonth() + delta);
  currentDate = newDate;
  updateDateDisplay();
  loadLedgerData();
}

function formatNumber(num) {
  return num ? num.toLocaleString('ko-KR') : '0';
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
    const response = await fetch('/api/ledger/copy-previous-month', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fromMonth: prevYearMonth,
        toMonth: currentYearMonth
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '이전월 데이터 복사에 실패했습니다.');
    }
    
    alert('이전월 데이터가 성공적으로 복사되었습니다.');
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
    <div id="ledger-content" style="padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <h3 id="ledger-title" style="margin:0;color:#1976d2;font-size:1.2rem;cursor:pointer;user-select:none;transition:opacity 0.2s;" title="클릭하여 새로고침" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">📖 장부</h3>
          <button id="ledger-copy-prev-month-btn" style="background:#ff9800;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">이전월 지출 불러오기</button>
        </div>
        <div style="display:flex;gap:12px;align-items:center;">
          <div class="date-navigation">
            <button id="ledger-prev-btn" class="nav-btn">◀</button>
            <span id="ledger-current-date" class="current-date"></span>
            <button id="ledger-next-btn" class="nav-btn">▶</button>
          </div>
        </div>
      </div>
      
      <div id="ledger-loading" style="text-align:center;padding:40px;color:#888;display:none;">데이터를 불러오는 중...</div>
      
      <!-- 고정지출 / 변동지출 / 급여 섹션 -->
      <div style="display:flex;gap:12px;align-items:flex-start;">
        <!-- 고정지출 섹션 -->
        <div style="flex:1;min-width:0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h4 style="margin:0;color:#1976d2;font-size:0.9rem;">고정지출</h4>
            <button id="ledger-fixed-add-btn" style="background:#4caf50;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;">추가</button>
          </div>
          <div id="ledger-fixed-list" style="background:#fff;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;min-height:200px;">
            <div style="text-align:center;padding:20px;color:#999;font-size:0.75rem;">데이터를 불러오는 중...</div>
          </div>
        </div>
        
        <!-- 변동지출 섹션 -->
        <div style="flex:1;min-width:0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h4 style="margin:0;color:#1976d2;font-size:0.9rem;">변동지출</h4>
            <button id="ledger-variable-add-btn" style="background:#4caf50;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;">추가</button>
          </div>
          <div id="ledger-variable-list" style="background:#fff;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;min-height:200px;">
            <div style="text-align:center;padding:20px;color:#999;font-size:0.75rem;">데이터를 불러오는 중...</div>
          </div>
        </div>
        
        <!-- 급여 섹션 -->
        <div style="flex:1;min-width:0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h4 style="margin:0;color:#1976d2;font-size:0.9rem;">급여</h4>
            <button id="ledger-salary-add-btn" style="background:#4caf50;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;">추가</button>
          </div>
          <div id="ledger-salary-list" style="background:#fff;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;min-height:200px;">
            <div style="text-align:center;padding:20px;color:#999;font-size:0.75rem;">데이터를 불러오는 중...</div>
          </div>
        </div>
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
  document.getElementById('ledger-title').addEventListener('click', async () => {
    await loadLedgerData();
  });
  
  // 날짜 네비게이션 버튼
  document.getElementById('ledger-prev-btn').addEventListener('click', () => {
    navigateDate(-1);
  });
  
  document.getElementById('ledger-next-btn').addEventListener('click', () => {
    navigateDate(1);
  });
  
  // 날짜 표시 업데이트
  updateDateDisplay();
  
  // 고정지출 추가 버튼
  document.getElementById('ledger-fixed-add-btn').addEventListener('click', () => {
    showFixedExpenseAddModal();
  });
  
  // 변동지출 추가 버튼
  document.getElementById('ledger-variable-add-btn').addEventListener('click', () => {
    showVariableExpenseAddModal();
  });
  
  // 급여 추가 버튼
  document.getElementById('ledger-salary-add-btn').addEventListener('click', () => {
    showSalaryAddModal();
  });
  
  // 이전월 지출 불러오기 버튼
  document.getElementById('ledger-copy-prev-month-btn').addEventListener('click', async () => {
    if (confirm('이전월의 고정지출, 변동지출, 급여 데이터를 이번달로 복사하시겠습니까?\n기존 이번달 데이터는 유지됩니다.')) {
      await copyPreviousMonthData();
    }
  });
}

// 장부 데이터 로드
async function loadLedgerData() {
  const yearMonth = getSelectedYearMonth();
  const loadingEl = document.getElementById('ledger-loading');
  const fixedListEl = document.getElementById('ledger-fixed-list');
  const variableListEl = document.getElementById('ledger-variable-list');
  const salaryListEl = document.getElementById('ledger-salary-list');
  
  loadingEl.style.display = 'block';
  
  try {
    // 센터 목록 가져오기
    const centersResponse = await fetch('/api/centers');
    const centers = centersResponse.ok ? await centersResponse.json() : [];
    const centerOrder = centers.map(c => c.name);
    
    // 고정지출, 변동지출, 급여 데이터 가져오기
    const [fixedResponse, variableResponse, salaryResponse] = await Promise.all([
      fetch(`/api/fixed-expenses?month=${yearMonth}`),
      fetch(`/api/variable-expenses?month=${yearMonth}`),
      fetch(`/api/salaries?month=${yearMonth}`)
    ]);
    
    const fixedExpenses = fixedResponse.ok ? await fixedResponse.json() : [];
    const variableExpenses = variableResponse.ok ? await variableResponse.json() : [];
    const salaries = salaryResponse.ok ? await salaryResponse.json() : [];
    
    // 센터별로 그룹화
    const fixedByCenter = {};
    fixedExpenses.forEach(expense => {
      if (!fixedByCenter[expense.center]) {
        fixedByCenter[expense.center] = [];
      }
      fixedByCenter[expense.center].push(expense);
    });
    
    const variableByCenter = {};
    variableExpenses.forEach(expense => {
      if (!variableByCenter[expense.center]) {
        variableByCenter[expense.center] = [];
      }
      variableByCenter[expense.center].push(expense);
    });
    
    const salaryByCenter = {};
    salaries.forEach(salary => {
      if (!salaryByCenter[salary.center]) {
        salaryByCenter[salary.center] = [];
      }
      salaryByCenter[salary.center].push(salary);
    });
    
    // 고정지출 렌더링
    renderFixedExpenses(fixedByCenter, centerOrder);
    
    // 변동지출 렌더링
    renderVariableExpenses(variableByCenter, centerOrder);
    
    // 급여 렌더링
    renderSalaries(salaryByCenter, centerOrder);
    
  } catch (error) {
    console.error('장부 데이터 로드 오류:', error);
    fixedListEl.innerHTML = '<div style="text-align:center;padding:20px;color:#d32f2f;font-size:0.75rem;">데이터를 불러오는데 실패했습니다.</div>';
    variableListEl.innerHTML = '<div style="text-align:center;padding:20px;color:#d32f2f;font-size:0.75rem;">데이터를 불러오는데 실패했습니다.</div>';
    salaryListEl.innerHTML = '<div style="text-align:center;padding:20px;color:#d32f2f;font-size:0.75rem;">데이터를 불러오는데 실패했습니다.</div>';
  } finally {
    loadingEl.style.display = 'none';
  }
}

// 고정지출 렌더링
function renderFixedExpenses(expensesByCenter, centerOrder) {
  const listEl = document.getElementById('ledger-fixed-list');
  
  if (Object.keys(expensesByCenter).length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#999;font-size:0.75rem;">등록된 고정지출이 없습니다.</div>';
    return;
  }
  
  let html = '';
  centerOrder.forEach(center => {
    const expenses = expensesByCenter[center] || [];
    if (expenses.length === 0) return;
    
    const total = expenses.reduce((sum, e) => sum + (parseInt(e.amount) || 0), 0);
    
    html += `
      <div style="margin-bottom:8px;border-bottom:1px solid #e0e0e0;padding-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;padding:4px 6px;background:#f5f5f5;">
          <h5 style="margin:0;color:#1976d2;font-size:0.85rem;font-weight:600;">${center}</h5>
          <div style="color:#666;font-size:0.75rem;">합계: <strong>${formatNumber(total)}원</strong></div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:0.75rem;">
          <thead>
            <tr style="background:#f9f9f9;border-bottom:1px solid #ddd;">
              <th style="padding:4px;text-align:left;font-weight:600;color:#666;font-size:0.7rem;">항목</th>
              <th style="padding:4px;text-align:right;font-weight:600;color:#666;font-size:0.7rem;">금액</th>
            </tr>
          </thead>
          <tbody>
            ${expenses.map(expense => `
              <tr class="ledger-fixed-row" data-expense-id="${expense.id}" style="border-bottom:1px solid #eee;cursor:pointer;" onmouseover="this.style.backgroundColor='#f5f5f5'" onmouseout="this.style.backgroundColor='transparent'">
                <td style="padding:4px;">${expense.item || '-'}</td>
                <td style="padding:4px;text-align:right;">${formatNumber(expense.amount || 0)}원</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  });
  
  listEl.innerHTML = html;
  
  // 이벤트 리스너 설정 - 행 클릭 시 수정 모달 열기
  document.querySelectorAll('.ledger-fixed-row').forEach(row => {
    row.addEventListener('click', async () => {
      const expenseId = row.getAttribute('data-expense-id');
      const expense = await fetch(`/api/fixed-expenses?month=${getSelectedYearMonth()}`)
        .then(r => r.json())
        .then(expenses => expenses.find(e => e.id === expenseId));
      if (expense) {
        showFixedExpenseEditModal(expense);
      }
    });
  });
}

// 변동지출 렌더링
function renderVariableExpenses(expensesByCenter, centerOrder) {
  const listEl = document.getElementById('ledger-variable-list');
  
  if (Object.keys(expensesByCenter).length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#999;font-size:0.75rem;">등록된 변동지출이 없습니다.</div>';
    return;
  }
  
  let html = '';
  centerOrder.forEach(center => {
    const expenses = expensesByCenter[center] || [];
    if (expenses.length === 0) return;
    
    const total = expenses.reduce((sum, e) => sum + (parseInt(e.amount) || 0), 0);
    
    html += `
      <div style="margin-bottom:8px;border-bottom:1px solid #e0e0e0;padding-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;padding:4px 6px;background:#f5f5f5;">
          <h5 style="margin:0;color:#1976d2;font-size:0.85rem;font-weight:600;">${center}</h5>
          <div style="color:#666;font-size:0.75rem;">합계: <strong>${formatNumber(total)}원</strong></div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:0.75rem;">
          <thead>
            <tr style="background:#f9f9f9;border-bottom:1px solid #ddd;">
              <th style="padding:4px;text-align:left;font-weight:600;color:#666;font-size:0.7rem;">날짜</th>
              <th style="padding:4px;text-align:left;font-weight:600;color:#666;font-size:0.7rem;">항목</th>
              <th style="padding:4px;text-align:right;font-weight:600;color:#666;font-size:0.7rem;">금액</th>
              <th style="padding:4px;text-align:left;font-weight:600;color:#666;font-size:0.7rem;">비고</th>
            </tr>
          </thead>
          <tbody>
            ${expenses.map(expense => `
              <tr class="ledger-variable-row" data-expense-id="${expense.id}" style="border-bottom:1px solid #eee;cursor:pointer;" onmouseover="this.style.backgroundColor='#f5f5f5'" onmouseout="this.style.backgroundColor='transparent'">
                <td style="padding:4px;">${expense.date || '-'}</td>
                <td style="padding:4px;">${expense.item || '-'}</td>
                <td style="padding:4px;text-align:right;">${formatNumber(expense.amount || 0)}원</td>
                <td style="padding:4px;">${expense.note || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  });
  
  listEl.innerHTML = html;
  
  // 이벤트 리스너 설정 - 행 클릭 시 수정 모달 열기
  document.querySelectorAll('.ledger-variable-row').forEach(row => {
    row.addEventListener('click', async () => {
      const expenseId = row.getAttribute('data-expense-id');
      const expense = await fetch(`/api/variable-expenses?month=${getSelectedYearMonth()}`)
        .then(r => r.json())
        .then(expenses => expenses.find(e => e.id === expenseId));
      if (expense) {
        showVariableExpenseEditModal(expense);
      }
    });
  });
}

// 고정지출 추가 모달
function showFixedExpenseAddModal() {
  const yearMonth = getSelectedYearMonth();
  const modalHTML = `
    <div class="ledger-fixed-add-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="ledger-fixed-add-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:14px;box-shadow:0 8px 32px #1976d240;min-width:500px;max-width:95vw;width:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;color:#1976d2;font-size:1.2rem;">고정지출 추가</h3>
        <button id="ledger-fixed-add-modal-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      
      <form id="ledger-fixed-add-form" style="display:flex;flex-direction:column;gap:16px;">
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">센터 *</label>
          <select id="ledger-fixed-add-center" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;"></select>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">연월 *</label>
          <input type="month" id="ledger-fixed-add-month" value="${yearMonth}" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">항목 *</label>
          <input type="text" id="ledger-fixed-add-item" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">금액 *</label>
          <input type="text" id="ledger-fixed-add-amount" value="0" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;" inputmode="numeric">
        </div>
        
        <div id="ledger-fixed-add-result-message" style="min-height:24px;color:#d32f2f;font-size:0.85rem;"></div>
        
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px;">
          <button type="button" id="ledger-fixed-add-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">취소</button>
          <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">저장</button>
        </div>
      </form>
    </div>
  `;
  
  const existingOverlay = document.querySelector('.ledger-fixed-add-modal-overlay');
  const existingModal = document.querySelector('.ledger-fixed-add-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // 센터 목록 로드
  loadCentersIntoSelect('ledger-fixed-add-center');
  
  // 금액 천단위 구분자
  document.getElementById('ledger-fixed-add-amount').addEventListener('input', function(e) {
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
  
  document.getElementById('ledger-fixed-add-modal-close').addEventListener('click', closeFixedExpenseAddModal);
  document.getElementById('ledger-fixed-add-cancel-btn').addEventListener('click', closeFixedExpenseAddModal);
  document.querySelector('.ledger-fixed-add-modal-overlay').addEventListener('click', closeFixedExpenseAddModal);
  
  document.getElementById('ledger-fixed-add-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const expense = {
      center: document.getElementById('ledger-fixed-add-center').value,
      month: document.getElementById('ledger-fixed-add-month').value,
      item: document.getElementById('ledger-fixed-add-item').value,
      amount: parseInt(document.getElementById('ledger-fixed-add-amount').value.replace(/,/g, '')) || 0
    };
    
    if (!expense.center || !expense.month || !expense.item) {
      document.getElementById('ledger-fixed-add-result-message').textContent = '센터, 연월, 항목은 필수입니다.';
      return;
    }
    
    const resultMsg = document.getElementById('ledger-fixed-add-result-message');
    resultMsg.textContent = '';
    
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '저장 중...';
    
    try {
      const response = await fetch('/api/fixed-expenses', {
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

// 고정지출 수정 모달
function showFixedExpenseEditModal(expense) {
  const modalHTML = `
    <div class="ledger-fixed-edit-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="ledger-fixed-edit-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:14px;box-shadow:0 8px 32px #1976d240;min-width:500px;max-width:95vw;width:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;color:#1976d2;font-size:1.2rem;">고정지출 수정</h3>
        <button id="ledger-fixed-edit-modal-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      
      <form id="ledger-fixed-edit-form" style="display:flex;flex-direction:column;gap:16px;">
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">센터 *</label>
          <select id="ledger-fixed-edit-center" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;"></select>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">연월 *</label>
          <input type="month" id="ledger-fixed-edit-month" value="${expense.month || ''}" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">항목 *</label>
          <input type="text" id="ledger-fixed-edit-item" value="${(expense.item || '').replace(/"/g, '&quot;')}" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">금액 *</label>
          <input type="text" id="ledger-fixed-edit-amount" value="${formatNumber(expense.amount || 0)}" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;" inputmode="numeric">
        </div>
        
        <div id="ledger-fixed-edit-result-message" style="min-height:24px;color:#d32f2f;font-size:0.85rem;"></div>
        
        <div style="display:flex;gap:10px;justify-content:space-between;margin-top:8px;">
          <button type="button" id="ledger-fixed-edit-delete-btn" style="background:#d32f2f;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">삭제</button>
          <div style="display:flex;gap:10px;">
            <button type="button" id="ledger-fixed-edit-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">취소</button>
            <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">저장</button>
          </div>
        </div>
      </form>
    </div>
  `;
  
  const existingOverlay = document.querySelector('.ledger-fixed-edit-modal-overlay');
  const existingModal = document.querySelector('.ledger-fixed-edit-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // 센터 목록 로드 및 선택
  loadCentersIntoSelect('ledger-fixed-edit-center', expense.center);
  
  // 금액 천단위 구분자
  document.getElementById('ledger-fixed-edit-amount').addEventListener('input', function(e) {
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
  
  document.getElementById('ledger-fixed-edit-modal-close').addEventListener('click', closeFixedExpenseEditModal);
  document.getElementById('ledger-fixed-edit-cancel-btn').addEventListener('click', closeFixedExpenseEditModal);
  document.querySelector('.ledger-fixed-edit-modal-overlay').addEventListener('click', closeFixedExpenseEditModal);
  
  // 삭제 버튼
  document.getElementById('ledger-fixed-edit-delete-btn').addEventListener('click', async function() {
    if (confirm('정말 삭제하시겠습니까?')) {
      try {
        const response = await fetch(`/api/fixed-expenses/${expense.id}`, {
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
  
  document.getElementById('ledger-fixed-edit-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const updates = {
      center: document.getElementById('ledger-fixed-edit-center').value,
      month: document.getElementById('ledger-fixed-edit-month').value,
      item: document.getElementById('ledger-fixed-edit-item').value,
      amount: parseInt(document.getElementById('ledger-fixed-edit-amount').value.replace(/,/g, '')) || 0
    };
    
    if (!updates.center || !updates.month || !updates.item) {
      document.getElementById('ledger-fixed-edit-result-message').textContent = '센터, 연월, 항목은 필수입니다.';
      return;
    }
    
    const resultMsg = document.getElementById('ledger-fixed-edit-result-message');
    resultMsg.textContent = '';
    
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '저장 중...';
    
    try {
      const response = await fetch(`/api/fixed-expenses/${expense.id}`, {
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

// 변동지출 추가 모달
function showVariableExpenseAddModal() {
  const yearMonth = getSelectedYearMonth();
  const today = new Date().toISOString().split('T')[0];
  const modalHTML = `
    <div class="ledger-variable-add-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="ledger-variable-add-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:14px;box-shadow:0 8px 32px #1976d240;min-width:500px;max-width:95vw;width:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;color:#1976d2;font-size:1.2rem;">변동지출 추가</h3>
        <button id="ledger-variable-add-modal-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      
      <form id="ledger-variable-add-form" style="display:flex;flex-direction:column;gap:16px;">
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">센터 *</label>
          <select id="ledger-variable-add-center" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;"></select>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">연월 *</label>
          <input type="month" id="ledger-variable-add-month" value="${yearMonth}" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">날짜 *</label>
          <input type="date" id="ledger-variable-add-date" value="${today}" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">항목 *</label>
          <input type="text" id="ledger-variable-add-item" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">금액 *</label>
          <input type="text" id="ledger-variable-add-amount" value="0" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;" inputmode="numeric">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">비고</label>
          <textarea id="ledger-variable-add-note" rows="3" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;resize:vertical;"></textarea>
        </div>
        
        <div id="ledger-variable-add-result-message" style="min-height:24px;color:#d32f2f;font-size:0.85rem;"></div>
        
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px;">
          <button type="button" id="ledger-variable-add-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">취소</button>
          <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">저장</button>
        </div>
      </form>
    </div>
  `;
  
  const existingOverlay = document.querySelector('.ledger-variable-add-modal-overlay');
  const existingModal = document.querySelector('.ledger-variable-add-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // 센터 목록 로드
  loadCentersIntoSelect('ledger-variable-add-center');
  
  // 금액 천단위 구분자
  document.getElementById('ledger-variable-add-amount').addEventListener('input', function(e) {
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
  
  document.getElementById('ledger-variable-add-modal-close').addEventListener('click', closeVariableExpenseAddModal);
  document.getElementById('ledger-variable-add-cancel-btn').addEventListener('click', closeVariableExpenseAddModal);
  document.querySelector('.ledger-variable-add-modal-overlay').addEventListener('click', closeVariableExpenseAddModal);
  
  document.getElementById('ledger-variable-add-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const expense = {
      center: document.getElementById('ledger-variable-add-center').value,
      month: document.getElementById('ledger-variable-add-month').value,
      date: document.getElementById('ledger-variable-add-date').value,
      item: document.getElementById('ledger-variable-add-item').value,
      amount: parseInt(document.getElementById('ledger-variable-add-amount').value.replace(/,/g, '')) || 0,
      note: document.getElementById('ledger-variable-add-note').value || null
    };
    
    if (!expense.center || !expense.month || !expense.date || !expense.item) {
      document.getElementById('ledger-variable-add-result-message').textContent = '센터, 연월, 날짜, 항목은 필수입니다.';
      return;
    }
    
    const resultMsg = document.getElementById('ledger-variable-add-result-message');
    resultMsg.textContent = '';
    
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '저장 중...';
    
    try {
      const response = await fetch('/api/variable-expenses', {
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
      submitBtn.disabled = false;
      submitBtn.textContent = '저장';
    }
  });
}

// 변동지출 수정 모달
function showVariableExpenseEditModal(expense) {
  const modalHTML = `
    <div class="ledger-variable-edit-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="ledger-variable-edit-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:14px;box-shadow:0 8px 32px #1976d240;min-width:500px;max-width:95vw;width:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;color:#1976d2;font-size:1.2rem;">변동지출 수정</h3>
        <button id="ledger-variable-edit-modal-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      
      <form id="ledger-variable-edit-form" style="display:flex;flex-direction:column;gap:16px;">
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">센터 *</label>
          <select id="ledger-variable-edit-center" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;"></select>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">연월 *</label>
          <input type="month" id="ledger-variable-edit-month" value="${expense.month || ''}" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">날짜 *</label>
          <input type="date" id="ledger-variable-edit-date" value="${expense.date || ''}" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">항목 *</label>
          <input type="text" id="ledger-variable-edit-item" value="${(expense.item || '').replace(/"/g, '&quot;')}" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">금액 *</label>
          <input type="text" id="ledger-variable-edit-amount" value="${formatNumber(expense.amount || 0)}" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;" inputmode="numeric">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">비고</label>
          <textarea id="ledger-variable-edit-note" rows="3" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;resize:vertical;">${(expense.note || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
        </div>
        
        <div id="ledger-variable-edit-result-message" style="min-height:24px;color:#d32f2f;font-size:0.85rem;"></div>
        
        <div style="display:flex;gap:10px;justify-content:space-between;margin-top:8px;">
          <button type="button" id="ledger-variable-edit-delete-btn" style="background:#d32f2f;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">삭제</button>
          <div style="display:flex;gap:10px;">
            <button type="button" id="ledger-variable-edit-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">취소</button>
            <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">저장</button>
          </div>
        </div>
      </form>
    </div>
  `;
  
  const existingOverlay = document.querySelector('.ledger-variable-edit-modal-overlay');
  const existingModal = document.querySelector('.ledger-variable-edit-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // 센터 목록 로드 및 선택
  loadCentersIntoSelect('ledger-variable-edit-center', expense.center);
  
  // 금액 천단위 구분자
  document.getElementById('ledger-variable-edit-amount').addEventListener('input', function(e) {
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
  
  document.getElementById('ledger-variable-edit-modal-close').addEventListener('click', closeVariableExpenseEditModal);
  document.getElementById('ledger-variable-edit-cancel-btn').addEventListener('click', closeVariableExpenseEditModal);
  document.querySelector('.ledger-variable-edit-modal-overlay').addEventListener('click', closeVariableExpenseEditModal);
  
  // 삭제 버튼
  document.getElementById('ledger-variable-edit-delete-btn').addEventListener('click', async function() {
    if (confirm('정말 삭제하시겠습니까?')) {
      try {
        const response = await fetch(`/api/variable-expenses/${expense.id}`, {
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
  
  document.getElementById('ledger-variable-edit-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const updates = {
      center: document.getElementById('ledger-variable-edit-center').value,
      month: document.getElementById('ledger-variable-edit-month').value,
      date: document.getElementById('ledger-variable-edit-date').value,
      item: document.getElementById('ledger-variable-edit-item').value,
      amount: parseInt(document.getElementById('ledger-variable-edit-amount').value.replace(/,/g, '')) || 0,
      note: document.getElementById('ledger-variable-edit-note').value || null
    };
    
    if (!updates.center || !updates.month || !updates.date || !updates.item) {
      document.getElementById('ledger-variable-edit-result-message').textContent = '센터, 연월, 날짜, 항목은 필수입니다.';
      return;
    }
    
    const resultMsg = document.getElementById('ledger-variable-edit-result-message');
    resultMsg.textContent = '';
    
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '저장 중...';
    
    try {
      const response = await fetch(`/api/variable-expenses/${expense.id}`, {
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
      submitBtn.disabled = false;
      submitBtn.textContent = '저장';
    }
  });
}

// 센터 목록을 select에 로드
async function loadCentersIntoSelect(selectId, selectedCenter = null) {
  try {
    const response = await fetch('/api/centers');
    if (response.ok) {
      const centers = await response.json();
      const select = document.getElementById(selectId);
      select.innerHTML = '<option value="">센터 선택</option>';
      centers.forEach(center => {
        const option = document.createElement('option');
        option.value = center.name;
        option.textContent = center.name;
        if (selectedCenter && center.name === selectedCenter) {
          option.selected = true;
        }
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('센터 목록 로드 오류:', error);
  }
}

// 모달 닫기 함수들
function closeFixedExpenseAddModal() {
  const overlay = document.querySelector('.ledger-fixed-add-modal-overlay');
  const modal = document.querySelector('.ledger-fixed-add-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

function closeFixedExpenseEditModal() {
  const overlay = document.querySelector('.ledger-fixed-edit-modal-overlay');
  const modal = document.querySelector('.ledger-fixed-edit-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

function closeVariableExpenseAddModal() {
  const overlay = document.querySelector('.ledger-variable-add-modal-overlay');
  const modal = document.querySelector('.ledger-variable-add-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

function closeVariableExpenseEditModal() {
  const overlay = document.querySelector('.ledger-variable-edit-modal-overlay');
  const modal = document.querySelector('.ledger-variable-edit-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

// 급여 렌더링
function renderSalaries(salariesByCenter, centerOrder) {
  const listEl = document.getElementById('ledger-salary-list');
  
  if (Object.keys(salariesByCenter).length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#999;font-size:0.75rem;">등록된 급여가 없습니다.</div>';
    return;
  }
  
  let html = '';
  centerOrder.forEach(center => {
    const salaries = salariesByCenter[center] || [];
    if (salaries.length === 0) return;
    
    const total = salaries.reduce((sum, s) => sum + (parseInt(s.amount) || 0), 0);
    
    html += `
      <div style="margin-bottom:8px;border-bottom:1px solid #e0e0e0;padding-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;padding:4px 6px;background:#f5f5f5;">
          <h5 style="margin:0;color:#1976d2;font-size:0.85rem;font-weight:600;">${center}</h5>
          <div style="color:#666;font-size:0.75rem;">합계: <strong>${formatNumber(total)}원</strong></div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:0.75rem;">
          <thead>
            <tr style="background:#f9f9f9;border-bottom:1px solid #ddd;">
              <th style="padding:4px;text-align:left;font-weight:600;color:#666;font-size:0.7rem;">항목</th>
              <th style="padding:4px;text-align:right;font-weight:600;color:#666;font-size:0.7rem;">금액</th>
            </tr>
          </thead>
          <tbody>
            ${salaries.map(salary => `
              <tr class="ledger-salary-row" data-salary-id="${salary.id}" style="border-bottom:1px solid #eee;cursor:pointer;" onmouseover="this.style.backgroundColor='#f5f5f5'" onmouseout="this.style.backgroundColor='transparent'">
                <td style="padding:4px;">${salary.item || '-'}</td>
                <td style="padding:4px;text-align:right;">${formatNumber(salary.amount || 0)}원</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  });
  
  listEl.innerHTML = html;
  
  // 이벤트 리스너 설정 - 행 클릭 시 수정 모달 열기
  document.querySelectorAll('.ledger-salary-row').forEach(row => {
    row.addEventListener('click', async () => {
      const salaryId = row.getAttribute('data-salary-id');
      const salary = await fetch(`/api/salaries?month=${getSelectedYearMonth()}`)
        .then(r => r.json())
        .then(salaries => salaries.find(s => s.id === salaryId));
      if (salary) {
        showSalaryEditModal(salary);
      }
    });
  });
}

// 급여 추가 모달
function showSalaryAddModal() {
  const yearMonth = getSelectedYearMonth();
  const modalHTML = `
    <div class="ledger-salary-add-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="ledger-salary-add-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:14px;box-shadow:0 8px 32px #1976d240;min-width:500px;max-width:95vw;width:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;color:#1976d2;font-size:1.2rem;">급여 추가</h3>
        <button id="ledger-salary-add-modal-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      
      <form id="ledger-salary-add-form" style="display:flex;flex-direction:column;gap:16px;">
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">센터 *</label>
          <select id="ledger-salary-add-center" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;"></select>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">연월 *</label>
          <input type="month" id="ledger-salary-add-month" value="${yearMonth}" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">항목 *</label>
          <input type="text" id="ledger-salary-add-item" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">금액 *</label>
          <input type="text" id="ledger-salary-add-amount" value="0" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;" inputmode="numeric">
        </div>
        
        <div id="ledger-salary-add-result-message" style="min-height:24px;color:#d32f2f;font-size:0.85rem;"></div>
        
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px;">
          <button type="button" id="ledger-salary-add-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">취소</button>
          <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">저장</button>
        </div>
      </form>
    </div>
  `;
  
  const existingOverlay = document.querySelector('.ledger-salary-add-modal-overlay');
  const existingModal = document.querySelector('.ledger-salary-add-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // 센터 목록 로드
  loadCentersIntoSelect('ledger-salary-add-center');
  
  // 금액 천단위 구분자
  document.getElementById('ledger-salary-add-amount').addEventListener('input', function(e) {
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
  
  document.getElementById('ledger-salary-add-modal-close').addEventListener('click', closeSalaryAddModal);
  document.getElementById('ledger-salary-add-cancel-btn').addEventListener('click', closeSalaryAddModal);
  document.querySelector('.ledger-salary-add-modal-overlay').addEventListener('click', closeSalaryAddModal);
  
  document.getElementById('ledger-salary-add-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const salary = {
      center: document.getElementById('ledger-salary-add-center').value,
      month: document.getElementById('ledger-salary-add-month').value,
      item: document.getElementById('ledger-salary-add-item').value,
      amount: parseInt(document.getElementById('ledger-salary-add-amount').value.replace(/,/g, '')) || 0
    };
    
    if (!salary.center || !salary.month || !salary.item) {
      document.getElementById('ledger-salary-add-result-message').textContent = '센터, 연월, 항목은 필수입니다.';
      return;
    }
    
    const resultMsg = document.getElementById('ledger-salary-add-result-message');
    resultMsg.textContent = '';
    
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '저장 중...';
    
    try {
      const response = await fetch('/api/salaries', {
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

// 급여 수정 모달
function showSalaryEditModal(salary) {
  const modalHTML = `
    <div class="ledger-salary-edit-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="ledger-salary-edit-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:14px;box-shadow:0 8px 32px #1976d240;min-width:500px;max-width:95vw;width:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;color:#1976d2;font-size:1.2rem;">급여 수정</h3>
        <button id="ledger-salary-edit-modal-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      
      <form id="ledger-salary-edit-form" style="display:flex;flex-direction:column;gap:16px;">
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">센터 *</label>
          <select id="ledger-salary-edit-center" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;"></select>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">연월 *</label>
          <input type="month" id="ledger-salary-edit-month" value="${salary.month || ''}" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">항목 *</label>
          <input type="text" id="ledger-salary-edit-item" value="${(salary.item || '').replace(/"/g, '&quot;')}" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">금액 *</label>
          <input type="text" id="ledger-salary-edit-amount" value="${formatNumber(salary.amount || 0)}" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;" inputmode="numeric">
        </div>
        
        <div id="ledger-salary-edit-result-message" style="min-height:24px;color:#d32f2f;font-size:0.85rem;"></div>
        
        <div style="display:flex;gap:10px;justify-content:space-between;margin-top:8px;">
          <button type="button" id="ledger-salary-edit-delete-btn" style="background:#d32f2f;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">삭제</button>
          <div style="display:flex;gap:10px;">
            <button type="button" id="ledger-salary-edit-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">취소</button>
            <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">저장</button>
          </div>
        </div>
      </form>
    </div>
  `;
  
  const existingOverlay = document.querySelector('.ledger-salary-edit-modal-overlay');
  const existingModal = document.querySelector('.ledger-salary-edit-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // 센터 목록 로드 및 선택
  loadCentersIntoSelect('ledger-salary-edit-center', salary.center);
  
  // 금액 천단위 구분자
  document.getElementById('ledger-salary-edit-amount').addEventListener('input', function(e) {
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
  
  document.getElementById('ledger-salary-edit-modal-close').addEventListener('click', closeSalaryEditModal);
  document.getElementById('ledger-salary-edit-cancel-btn').addEventListener('click', closeSalaryEditModal);
  document.querySelector('.ledger-salary-edit-modal-overlay').addEventListener('click', closeSalaryEditModal);
  
  // 삭제 버튼
  document.getElementById('ledger-salary-edit-delete-btn').addEventListener('click', async function() {
    if (confirm('정말 삭제하시겠습니까?')) {
      try {
        const response = await fetch(`/api/salaries/${salary.id}`, {
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
  
  document.getElementById('ledger-salary-edit-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const updates = {
      center: document.getElementById('ledger-salary-edit-center').value,
      month: document.getElementById('ledger-salary-edit-month').value,
      item: document.getElementById('ledger-salary-edit-item').value,
      amount: parseInt(document.getElementById('ledger-salary-edit-amount').value.replace(/,/g, '')) || 0
    };
    
    if (!updates.center || !updates.month || !updates.item) {
      document.getElementById('ledger-salary-edit-result-message').textContent = '센터, 연월, 항목은 필수입니다.';
      return;
    }
    
    const resultMsg = document.getElementById('ledger-salary-edit-result-message');
    resultMsg.textContent = '';
    
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '저장 중...';
    
    try {
      const response = await fetch(`/api/salaries/${salary.id}`, {
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

function closeSalaryAddModal() {
  const overlay = document.querySelector('.ledger-salary-add-modal-overlay');
  const modal = document.querySelector('.ledger-salary-add-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

function closeSalaryEditModal() {
  const overlay = document.querySelector('.ledger-salary-edit-modal-overlay');
  const modal = document.querySelector('.ledger-salary-edit-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}
