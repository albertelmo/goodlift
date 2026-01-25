// 관리자 지출 내역 조회 모듈
export const expense = {
  render
};

// 현재 날짜 (한국시간 기준)
let expenseCurrentDate = new Date();
expenseCurrentDate.setHours(0, 0, 0, 0);

// 페이지네이션 상태
let mealCurrentPage = 1;
let purchaseCurrentPage = 1;
let personalCurrentPage = 1;
const itemsPerPage = 5;

// 선택된 년월 가져오기 (YYYY-MM 형식)
function getExpenseSelectedYearMonth() {
  if (!expenseCurrentDate) {
    expenseCurrentDate = new Date();
    expenseCurrentDate.setHours(0, 0, 0, 0);
  }
  const koreanTime = new Date(expenseCurrentDate.getTime() + (9 * 60 * 60 * 1000));
  const year = koreanTime.getFullYear();
  const month = String(koreanTime.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// 날짜 표시 업데이트
function updateExpenseDateDisplay() {
  const dateElement = document.getElementById('expense-current-date');
  if (!dateElement) return;
  
  const koreanCurrentDate = new Date(expenseCurrentDate);
  dateElement.textContent = koreanCurrentDate.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long'
  });
}

// 날짜 네비게이션
function navigateExpenseDate(delta) {
  const newDate = new Date(expenseCurrentDate);
  newDate.setMonth(newDate.getMonth() + delta);
  expenseCurrentDate = newDate;
  updateExpenseDateDisplay();
  loadExpenses();
}

function render(container) {
  if (!container) return;
  
  container.innerHTML = `
    <div style="padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
        <h3 id="expense-title" style="margin:0;color:#1976d2;font-size:1.2rem;cursor:pointer;user-select:none;transition:opacity 0.2s;" title="클릭하여 새로고침" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">💳 지출 내역 관리 <span id="expense-total-amount" style="color:#666;font-size:0.85rem;font-weight:normal;">(합계: 계산 중...)</span></h3>
        <div class="date-navigation">
          <button id="expense-prev-btn" class="nav-btn">◀</button>
          <span id="expense-current-date" class="current-date"></span>
          <button id="expense-next-btn" class="nav-btn">▶</button>
        </div>
      </div>
      
      <!-- 식대 요약 영역 -->
      <div id="expense-meal-summary" style="background:#e3f2fd;padding:6px 10px;border-radius:4px;margin-bottom:8px;display:flex;gap:20px;flex-wrap:wrap;align-items:center;">
        <div>
          <div style="font-size:0.65rem;color:#666;margin-bottom:1px;">식대 건수</div>
          <div id="expense-meal-count" style="font-size:0.9rem;font-weight:bold;color:#1976d2;">0건</div>
        </div>
        <div>
          <div style="font-size:0.65rem;color:#666;margin-bottom:1px;">식대 금액</div>
          <div id="expense-meal-amount" style="font-size:0.9rem;font-weight:bold;color:#1976d2;">0원</div>
        </div>
        <div id="expense-meal-by-trainer" style="display:none;flex:1;min-width:0;">
          <div style="font-size:0.65rem;color:#666;margin-bottom:4px;">트레이너별 식대 합계</div>
          <div id="expense-meal-trainer-list" style="display:flex;flex-wrap:nowrap;gap:8px;font-size:0.7rem;overflow-x:auto;"></div>
        </div>
      </div>
      
      <!-- 식대 지출 내역 테이블 -->
      <div style="margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <h4 style="margin:0;color:#1976d2;font-size:0.95rem;font-weight:600;">🍽️ 식대 내역</h4>
          <button id="expense-meal-add-btn" class="header-text-btn" style="background:#e3f2fd !important;color:#1976d2 !important;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">추가</button>
        </div>
        <div id="expense-meal-loading" style="text-align:center;color:#888;padding:20px;font-size:0.85rem;">식대 내역을 불러오는 중...</div>
        <div id="expense-meal-table-container" style="display:none;">
          <table id="expense-meal-table" style="width:100%;border-collapse:collapse;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.1);font-size:0.8rem;">
            <thead>
              <tr style="background:#f5f5f5;border-bottom:1.5px solid #ddd;">
                <th style="padding:6px 4px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">시각</th>
                <th style="padding:6px 4px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">지출자</th>
                <th style="padding:6px 4px;text-align:right;font-weight:600;color:#333;font-size:0.75rem;">금액</th>
                <th style="padding:6px 4px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">함께한 트레이너</th>
              </tr>
            </thead>
            <tbody id="expense-meal-table-body">
            </tbody>
          </table>
          <div id="expense-meal-pagination" style="display:none;margin-top:8px;text-align:center;font-size:0.75rem;"></div>
        </div>
        <div id="expense-meal-empty" style="display:none;text-align:center;color:#888;padding:20px;background:#f9f9f9;border-radius:6px;font-size:0.85rem;">
          식대 내역이 없습니다.
        </div>
      </div>
      
      <!-- 구매 요약 영역 -->
      <div id="expense-purchase-summary" style="background:#e8f5e9;padding:6px 10px;border-radius:4px;margin-bottom:8px;display:flex;gap:20px;flex-wrap:wrap;">
        <div>
          <div style="font-size:0.65rem;color:#666;margin-bottom:1px;">구매 건수</div>
          <div id="expense-purchase-count" style="font-size:0.9rem;font-weight:bold;color:#4caf50;">0건</div>
        </div>
        <div>
          <div style="font-size:0.65rem;color:#666;margin-bottom:1px;">구매 금액</div>
          <div id="expense-purchase-amount" style="font-size:0.9rem;font-weight:bold;color:#4caf50;">0원</div>
        </div>
      </div>
      
      <!-- 구매 지출 내역 테이블 -->
      <div style="margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <h4 style="margin:0;color:#4caf50;font-size:0.95rem;font-weight:600;">🛒 구매 내역</h4>
          <button id="expense-purchase-add-btn" class="header-text-btn" style="background:#e3f2fd !important;color:#1976d2 !important;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">추가</button>
        </div>
        <div id="expense-purchase-loading" style="text-align:center;color:#888;padding:20px;font-size:0.85rem;">구매 내역을 불러오는 중...</div>
        <div id="expense-purchase-table-container" style="display:none;">
          <table id="expense-purchase-table" style="width:100%;border-collapse:collapse;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.1);font-size:0.8rem;">
            <thead>
              <tr style="background:#f5f5f5;border-bottom:1.5px solid #ddd;">
                <th style="padding:6px 4px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">시각</th>
                <th style="padding:6px 4px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">지출자</th>
                <th style="padding:6px 4px;text-align:right;font-weight:600;color:#333;font-size:0.75rem;">금액</th>
                <th style="padding:6px 4px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">구매물품</th>
                <th style="padding:6px 4px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">센터</th>
              </tr>
            </thead>
            <tbody id="expense-purchase-table-body">
            </tbody>
          </table>
          <div id="expense-purchase-pagination" style="display:none;margin-top:8px;text-align:center;font-size:0.75rem;"></div>
        </div>
        <div id="expense-purchase-empty" style="display:none;text-align:center;color:#888;padding:20px;background:#f9f9f9;border-radius:6px;font-size:0.85rem;">
          구매 내역이 없습니다.
        </div>
      </div>
      
      <!-- 개인지출 요약 영역 -->
      <div id="expense-personal-summary" style="background:#fff3e0;padding:6px 10px;border-radius:4px;margin-bottom:8px;display:flex;gap:20px;flex-wrap:wrap;align-items:center;">
        <div>
          <div style="font-size:0.65rem;color:#666;margin-bottom:1px;">개인지출 건수</div>
          <div id="expense-personal-count" style="font-size:0.9rem;font-weight:bold;color:#ff9800;">0건</div>
        </div>
        <div>
          <div style="font-size:0.65rem;color:#666;margin-bottom:1px;">개인지출 금액</div>
          <div id="expense-personal-amount" style="font-size:0.9rem;font-weight:bold;color:#ff9800;">0원</div>
        </div>
        <div id="expense-personal-by-trainer" style="display:none;flex:1;min-width:0;">
          <div style="font-size:0.65rem;color:#666;margin-bottom:4px;">개인별 지출 합계</div>
          <div id="expense-personal-trainer-list" style="display:flex;flex-wrap:nowrap;gap:8px;font-size:0.7rem;overflow-x:auto;"></div>
        </div>
      </div>
      
      <!-- 개인지출 지출 내역 테이블 -->
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <h4 style="margin:0;color:#ff9800;font-size:0.95rem;font-weight:600;">👤 개인지출 내역</h4>
          <button id="expense-personal-add-btn" class="header-text-btn" style="background:#e3f2fd !important;color:#1976d2 !important;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">추가</button>
        </div>
        <div id="expense-personal-loading" style="text-align:center;color:#888;padding:20px;font-size:0.85rem;">개인지출 내역을 불러오는 중...</div>
        <div id="expense-personal-table-container" style="display:none;">
          <table id="expense-personal-table" style="width:100%;border-collapse:collapse;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.1);font-size:0.8rem;">
            <thead>
              <tr style="background:#f5f5f5;border-bottom:1.5px solid #ddd;">
                <th style="padding:6px 4px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">시각</th>
                <th style="padding:6px 4px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">지출자</th>
                <th style="padding:6px 4px;text-align:right;font-weight:600;color:#333;font-size:0.75rem;">금액</th>
                <th style="padding:6px 4px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">지출내역</th>
                <th style="padding:6px 4px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">센터</th>
              </tr>
            </thead>
            <tbody id="expense-personal-table-body">
            </tbody>
          </table>
          <div id="expense-personal-pagination" style="display:none;margin-top:8px;text-align:center;font-size:0.75rem;"></div>
        </div>
        <div id="expense-personal-empty" style="display:none;text-align:center;color:#888;padding:20px;background:#f9f9f9;border-radius:6px;font-size:0.85rem;">
          개인지출 내역이 없습니다.
        </div>
      </div>
    </div>
  `;
  
  // 현재 날짜 초기화
  expenseCurrentDate = new Date();
  expenseCurrentDate.setHours(0, 0, 0, 0);
  
  // 날짜 표시 업데이트
  updateExpenseDateDisplay();
  
  // 이벤트 리스너 설정
  setupEventListeners(container);
  
  // 초기 데이터 로드
  loadExpenses();
}

function setupEventListeners(container) {
  // 이전 월 버튼
  const prevBtn = document.getElementById('expense-prev-btn');
  if (prevBtn) {
    prevBtn.onclick = () => navigateExpenseDate(-1);
  }
  
  // 다음 월 버튼
  const nextBtn = document.getElementById('expense-next-btn');
  if (nextBtn) {
    nextBtn.onclick = () => navigateExpenseDate(1);
  }
  
  // 제목 클릭 시 새로고침
  const expenseTitle = document.getElementById('expense-title');
  if (expenseTitle) {
    expenseTitle.onclick = () => {
      loadExpenses();
    };
  }
  
  // 추가 버튼 이벤트 리스너
  const mealAddBtn = document.getElementById('expense-meal-add-btn');
  if (mealAddBtn) {
    mealAddBtn.onclick = () => showExpenseAddModal('meal');
  }
  
  const purchaseAddBtn = document.getElementById('expense-purchase-add-btn');
  if (purchaseAddBtn) {
    purchaseAddBtn.onclick = () => showExpenseAddModal('purchase');
  }
  
  const personalAddBtn = document.getElementById('expense-personal-add-btn');
  if (personalAddBtn) {
    personalAddBtn.onclick = () => showExpenseAddModal('personal');
  }
}

// 지출 내역 로드
async function loadExpenses() {
  const mealLoading = document.getElementById('expense-meal-loading');
  const mealTableContainer = document.getElementById('expense-meal-table-container');
  const mealEmpty = document.getElementById('expense-meal-empty');
  const mealTableBody = document.getElementById('expense-meal-table-body');
  const mealCount = document.getElementById('expense-meal-count');
  const mealAmount = document.getElementById('expense-meal-amount');
  
  const purchaseLoading = document.getElementById('expense-purchase-loading');
  const purchaseTableContainer = document.getElementById('expense-purchase-table-container');
  const purchaseEmpty = document.getElementById('expense-purchase-empty');
  const purchaseTableBody = document.getElementById('expense-purchase-table-body');
  const purchaseCount = document.getElementById('expense-purchase-count');
  const purchaseAmount = document.getElementById('expense-purchase-amount');
  
  const personalLoading = document.getElementById('expense-personal-loading');
  const personalTableContainer = document.getElementById('expense-personal-table-container');
  const personalEmpty = document.getElementById('expense-personal-empty');
  const personalTableBody = document.getElementById('expense-personal-table-body');
  const personalCount = document.getElementById('expense-personal-count');
  const personalAmount = document.getElementById('expense-personal-amount');
  
  mealLoading.style.display = 'block';
  mealTableContainer.style.display = 'none';
  mealEmpty.style.display = 'none';
  
  purchaseLoading.style.display = 'block';
  purchaseTableContainer.style.display = 'none';
  purchaseEmpty.style.display = 'none';
  
  personalLoading.style.display = 'block';
  personalTableContainer.style.display = 'none';
  personalEmpty.style.display = 'none';
  
  try {
    const monthValue = getExpenseSelectedYearMonth();
    
    // 월의 첫날과 마지막날 계산
    const [year, month] = monthValue.split('-');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    
    const url = `/api/expenses?startDate=${startDate}&endDate=${endDate}`;
    const res = await fetch(url);
    const data = await res.json();
    
    mealLoading.style.display = 'none';
    purchaseLoading.style.display = 'none';
    personalLoading.style.display = 'none';
    
    if (!data.expenses || data.expenses.length === 0) {
      mealEmpty.style.display = 'block';
      purchaseEmpty.style.display = 'block';
      personalEmpty.style.display = 'block';
      mealCount.textContent = '0건';
      mealAmount.textContent = '0원';
      purchaseCount.textContent = '0건';
      purchaseAmount.textContent = '0원';
      personalCount.textContent = '0건';
      personalAmount.textContent = '0원';
      const totalAmountEl = document.getElementById('expense-total-amount');
      if (totalAmountEl) {
        totalAmountEl.textContent = '(합계: 0원)';
      }
      // 식대 트레이너별 합계 영역 숨김
      const mealByTrainer = document.getElementById('expense-meal-by-trainer');
      if (mealByTrainer) {
        mealByTrainer.style.display = 'none';
      }
      return;
    }
    
    // 식대, 구매, 개인지출 분리
    const mealExpenses = data.expenses.filter(e => e.expenseType === 'meal');
    const purchaseExpenses = data.expenses.filter(e => e.expenseType === 'purchase');
    const personalExpenses = data.expenses.filter(e => e.expenseType === 'personal');
    
    // 전체 데이터를 전역 변수에 저장 (페이지네이션을 위해)
    window.expenseMealData = mealExpenses;
    window.expensePurchaseData = purchaseExpenses;
    window.expensePersonalData = personalExpenses;
    
    // 식대 요약 정보
    const mealTotalAmount = mealExpenses.reduce((sum, e) => sum + e.amount, 0);
    mealCount.textContent = `${mealExpenses.length}건`;
    mealAmount.textContent = `${mealTotalAmount.toLocaleString()}원`;
    
    // su 유저인지 확인
    const role = localStorage.getItem('role');
    const isSu = role === 'su';
    
    // 트레이너별 식대 합계 계산 및 표시 (su 유저만)
    const mealByTrainer = document.getElementById('expense-meal-by-trainer');
    const mealTrainerList = document.getElementById('expense-meal-trainer-list');
    if (isSu && mealExpenses.length > 0 && mealByTrainer && mealTrainerList) {
      // 트레이너별로 그룹화
      const trainerMap = {};
      mealExpenses.forEach(expense => {
        // participantTrainerNames 또는 participantTrainers 사용
        const participants = expense.participantTrainerNames || expense.participantTrainers || [];
        if (participants.length > 0) {
          // 금액을 참여자 수로 나눔
          const amountPerPerson = Math.floor(expense.amount / participants.length);
          participants.forEach(trainerName => {
            // 이름에서 "(아이디)" 형식 제거
            const nameOnly = trainerName ? trainerName.replace(/\s*\([^)]*\)\s*$/, '').trim() : trainerName;
            if (!trainerMap[nameOnly]) {
              trainerMap[nameOnly] = 0;
            }
            trainerMap[nameOnly] += amountPerPerson;
          });
        }
      });
      
      // 트레이너별 합계 표시
      mealTrainerList.innerHTML = '';
      Object.entries(trainerMap)
        .sort((a, b) => b[1] - a[1]) // 금액 순으로 정렬
        .forEach(([trainerName, amount]) => {
          const item = document.createElement('div');
          item.style.cssText = 'display:flex;align-items:center;gap:3px;padding:3px 6px;background:#fff;border-radius:3px;border:1px solid #90caf9;white-space:nowrap;flex-shrink:0;';
          item.innerHTML = `
            <span style="color:#333;font-weight:500;font-size:0.7rem;">${trainerName}:</span>
            <span style="color:#1976d2;font-weight:bold;font-size:0.7rem;">${amount.toLocaleString()}원</span>
          `;
          mealTrainerList.appendChild(item);
        });
      mealByTrainer.style.display = 'block';
    } else if (mealByTrainer) {
      mealByTrainer.style.display = 'none';
    }
    
    // 구매 요약 정보
    const purchaseTotalAmount = purchaseExpenses.reduce((sum, e) => sum + e.amount, 0);
    purchaseCount.textContent = `${purchaseExpenses.length}건`;
    purchaseAmount.textContent = `${purchaseTotalAmount.toLocaleString()}원`;
    
    // 개인지출 요약 정보
    const personalTotalAmount = personalExpenses.reduce((sum, e) => sum + e.amount, 0);
    personalCount.textContent = `${personalExpenses.length}건`;
    personalAmount.textContent = `${personalTotalAmount.toLocaleString()}원`;
    
    // 세 가지 지출 총합 계산 및 표시
    const totalAmount = mealTotalAmount + purchaseTotalAmount + personalTotalAmount;
    const totalAmountEl = document.getElementById('expense-total-amount');
    if (totalAmountEl) {
      totalAmountEl.textContent = `(합계: ${totalAmount.toLocaleString()}원)`;
    }
    
    // 개인별 지출 합계 계산 및 표시
    const personalByTrainer = document.getElementById('expense-personal-by-trainer');
    const personalTrainerList = document.getElementById('expense-personal-trainer-list');
    if (personalExpenses.length > 0 && personalByTrainer && personalTrainerList) {
      // 트레이너별로 그룹화
      const trainerMap = {};
      personalExpenses.forEach(expense => {
        const trainerName = expense.trainerName || expense.trainer;
        if (!trainerMap[trainerName]) {
          trainerMap[trainerName] = 0;
        }
        trainerMap[trainerName] += expense.amount;
      });
      
      // 트레이너별 합계 표시
      personalTrainerList.innerHTML = '';
      Object.entries(trainerMap)
        .sort((a, b) => b[1] - a[1]) // 금액 순으로 정렬
        .forEach(([trainerName, amount]) => {
          const item = document.createElement('div');
          item.style.cssText = 'display:flex;align-items:center;gap:3px;padding:3px 6px;background:#fff;border-radius:3px;border:1px solid #ffcc80;white-space:nowrap;flex-shrink:0;';
          item.innerHTML = `
            <span style="color:#333;font-weight:500;font-size:0.7rem;">${trainerName}:</span>
            <span style="color:#ff9800;font-weight:bold;font-size:0.7rem;">${amount.toLocaleString()}원</span>
          `;
          personalTrainerList.appendChild(item);
        });
      personalByTrainer.style.display = 'block';
    } else if (personalByTrainer) {
      personalByTrainer.style.display = 'none';
    }
    
    // 식대 테이블 렌더링
    if (!window.expenseMealData || window.expenseMealData.length !== mealExpenses.length) {
      mealCurrentPage = 1; // 데이터가 변경된 경우에만 첫 페이지로 리셋
    }
    renderMealTable(mealExpenses);
    
    // 구매 테이블 렌더링
    if (!window.expensePurchaseData || window.expensePurchaseData.length !== purchaseExpenses.length) {
      purchaseCurrentPage = 1; // 데이터가 변경된 경우에만 첫 페이지로 리셋
    }
    renderPurchaseTable(purchaseExpenses);
    
    // 개인지출 테이블 렌더링
    if (!window.expensePersonalData || window.expensePersonalData.length !== personalExpenses.length) {
      personalCurrentPage = 1; // 데이터가 변경된 경우에만 첫 페이지로 리셋
    }
    renderPersonalTable(personalExpenses);
  } catch (error) {
    console.error('지출 내역 로드 오류:', error);
    mealLoading.style.display = 'none';
    purchaseLoading.style.display = 'none';
    personalLoading.style.display = 'none';
    mealEmpty.style.display = 'block';
    purchaseEmpty.style.display = 'block';
    personalEmpty.style.display = 'block';
    mealEmpty.innerHTML = '<div style="color:#d32f2f;">지출 내역을 불러오지 못했습니다.</div>';
    purchaseEmpty.innerHTML = '<div style="color:#d32f2f;">지출 내역을 불러오지 못했습니다.</div>';
    personalEmpty.innerHTML = '<div style="color:#d32f2f;">개인지출 내역을 불러오지 못했습니다.</div>';
  }
}

// 식대 행 생성
function createMealRow(expense) {
  const row = document.createElement('tr');
  row.className = 'expense-row';
  row.setAttribute('data-expense-data', JSON.stringify(expense));
  row.style.borderBottom = '1px solid #eee';
  row.style.cursor = 'pointer';
  row.onmouseover = function() { this.style.backgroundColor = '#f5f5f5'; };
  row.onmouseout = function() { this.style.backgroundColor = 'transparent'; };
  
  // 백엔드에서 이미 한국 시간(Asia/Seoul)으로 변환되어 반환되므로, 그대로 사용
  const datetime = new Date(expense.datetime);
  const year = datetime.getFullYear();
  const month = String(datetime.getMonth() + 1).padStart(2, '0');
  const day = String(datetime.getDate()).padStart(2, '0');
  const hours = String(datetime.getHours()).padStart(2, '0');
  const minutes = String(datetime.getMinutes()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hours}:${minutes}`;
  
  // 백엔드에서 이미 이름으로 변환되어 전달되므로 participantTrainerNames만 사용
  const participantNames = expense.participantTrainerNames || [];
  const participantStr = participantNames.join(', ');
  
  row.innerHTML = `
    <td style="padding:4px 3px;font-size:0.7rem;white-space:nowrap;">${dateStr} ${timeStr}</td>
    <td style="padding:4px 3px;font-size:0.7rem;">${expense.trainerName || expense.trainer}</td>
    <td style="padding:4px 3px;text-align:right;font-size:0.75rem;font-weight:500;color:#1976d2;">${expense.amount.toLocaleString()}원</td>
    <td style="padding:4px 3px;font-size:0.7rem;color:#666;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${participantStr || '-'}">${participantStr || '-'}</td>
  `;
  
  return row;
}

// 개인지출 행 생성
function createPersonalRow(expense) {
  const row = document.createElement('tr');
  row.className = 'expense-row';
  row.setAttribute('data-expense-data', JSON.stringify(expense));
  row.style.borderBottom = '1px solid #eee';
  row.style.cursor = 'pointer';
  row.onmouseover = function() { this.style.backgroundColor = '#f5f5f5'; };
  row.onmouseout = function() { this.style.backgroundColor = 'transparent'; };
  
  // 백엔드에서 이미 한국 시간(Asia/Seoul)으로 변환되어 반환되므로, 그대로 사용
  const datetime = new Date(expense.datetime);
  const year = datetime.getFullYear();
  const month = String(datetime.getMonth() + 1).padStart(2, '0');
  const day = String(datetime.getDate()).padStart(2, '0');
  const hours = String(datetime.getHours()).padStart(2, '0');
  const minutes = String(datetime.getMinutes()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hours}:${minutes}`;
  
  row.innerHTML = `
    <td style="padding:4px 3px;font-size:0.7rem;white-space:nowrap;">${dateStr} ${timeStr}</td>
    <td style="padding:4px 3px;font-size:0.7rem;">${expense.trainerName || expense.trainer}</td>
    <td style="padding:4px 3px;text-align:right;font-size:0.75rem;font-weight:500;color:#ff9800;">${expense.amount.toLocaleString()}원</td>
    <td style="padding:4px 3px;font-size:0.7rem;color:#666;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${expense.purchaseItem || '-'}">${expense.purchaseItem || '-'}</td>
    <td style="padding:4px 3px;font-size:0.7rem;color:#666;">${expense.center || '-'}</td>
  `;
  
  return row;
}

// 구매 행 생성
function createPurchaseRow(expense) {
  const row = document.createElement('tr');
  row.className = 'expense-row';
  row.setAttribute('data-expense-data', JSON.stringify(expense));
  row.style.borderBottom = '1px solid #eee';
  row.style.cursor = 'pointer';
  row.onmouseover = function() { this.style.backgroundColor = '#f5f5f5'; };
  row.onmouseout = function() { this.style.backgroundColor = 'transparent'; };
  
  // 백엔드에서 이미 한국 시간(Asia/Seoul)으로 변환되어 반환되므로, 그대로 사용
  const datetime = new Date(expense.datetime);
  const year = datetime.getFullYear();
  const month = String(datetime.getMonth() + 1).padStart(2, '0');
  const day = String(datetime.getDate()).padStart(2, '0');
  const hours = String(datetime.getHours()).padStart(2, '0');
  const minutes = String(datetime.getMinutes()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hours}:${minutes}`;
  
  row.innerHTML = `
    <td style="padding:4px 3px;font-size:0.7rem;white-space:nowrap;">${dateStr} ${timeStr}</td>
    <td style="padding:4px 3px;font-size:0.7rem;">${expense.trainerName || expense.trainer}</td>
    <td style="padding:4px 3px;text-align:right;font-size:0.75rem;font-weight:500;color:#4caf50;">${expense.amount.toLocaleString()}원</td>
    <td style="padding:4px 3px;font-size:0.7rem;color:#666;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${expense.purchaseItem || '-'}">${expense.purchaseItem || '-'}</td>
    <td style="padding:4px 3px;font-size:0.7rem;color:#666;">${expense.center || '-'}</td>
  `;
  
  return row;
}

// 식대 테이블 렌더링 (페이지네이션 포함)
function renderMealTable(mealExpenses) {
  const mealTableBody = document.getElementById('expense-meal-table-body');
  const mealTableContainer = document.getElementById('expense-meal-table-container');
  const mealEmpty = document.getElementById('expense-meal-empty');
  const mealPagination = document.getElementById('expense-meal-pagination');
  
  mealTableBody.innerHTML = '';
  
  if (mealExpenses.length === 0) {
    mealTableContainer.style.display = 'none';
    mealPagination.style.display = 'none';
    mealEmpty.style.display = 'block';
    return;
  }
  
  mealTableContainer.style.display = 'block';
  mealEmpty.style.display = 'none';
  
  const totalPages = Math.ceil(mealExpenses.length / itemsPerPage);
  const startIndex = (mealCurrentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageExpenses = mealExpenses.slice(startIndex, endIndex);
  
  pageExpenses.forEach(expense => {
    const row = createMealRow(expense);
    mealTableBody.appendChild(row);
  });
  
  setupExpenseRowClickListeners(mealTableBody);
  renderPagination('meal', mealCurrentPage, totalPages, mealExpenses.length);
}

// 구매 테이블 렌더링 (페이지네이션 포함)
function renderPurchaseTable(purchaseExpenses) {
  const purchaseTableBody = document.getElementById('expense-purchase-table-body');
  const purchaseTableContainer = document.getElementById('expense-purchase-table-container');
  const purchaseEmpty = document.getElementById('expense-purchase-empty');
  const purchasePagination = document.getElementById('expense-purchase-pagination');
  
  purchaseTableBody.innerHTML = '';
  
  if (purchaseExpenses.length === 0) {
    purchaseTableContainer.style.display = 'none';
    purchasePagination.style.display = 'none';
    purchaseEmpty.style.display = 'block';
    return;
  }
  
  purchaseTableContainer.style.display = 'block';
  purchaseEmpty.style.display = 'none';
  
  const totalPages = Math.ceil(purchaseExpenses.length / itemsPerPage);
  const startIndex = (purchaseCurrentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageExpenses = purchaseExpenses.slice(startIndex, endIndex);
  
  pageExpenses.forEach(expense => {
    const row = createPurchaseRow(expense);
    purchaseTableBody.appendChild(row);
  });
  
  setupExpenseRowClickListeners(purchaseTableBody);
  renderPagination('purchase', purchaseCurrentPage, totalPages, purchaseExpenses.length);
}

// 개인지출 테이블 렌더링 (페이지네이션 포함)
function renderPersonalTable(personalExpenses) {
  const personalTableBody = document.getElementById('expense-personal-table-body');
  const personalTableContainer = document.getElementById('expense-personal-table-container');
  const personalEmpty = document.getElementById('expense-personal-empty');
  const personalPagination = document.getElementById('expense-personal-pagination');
  
  personalTableBody.innerHTML = '';
  
  if (personalExpenses.length === 0) {
    personalTableContainer.style.display = 'none';
    personalPagination.style.display = 'none';
    personalEmpty.style.display = 'block';
    return;
  }
  
  personalTableContainer.style.display = 'block';
  personalEmpty.style.display = 'none';
  
  const totalPages = Math.ceil(personalExpenses.length / itemsPerPage);
  const startIndex = (personalCurrentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageExpenses = personalExpenses.slice(startIndex, endIndex);
  
  pageExpenses.forEach(expense => {
    const row = createPersonalRow(expense);
    personalTableBody.appendChild(row);
  });
  
  setupExpenseRowClickListeners(personalTableBody);
  renderPagination('personal', personalCurrentPage, totalPages, personalExpenses.length);
}

// 페이지네이션 렌더링
function renderPagination(type, currentPage, totalPages, totalItems) {
  const paginationDiv = document.getElementById(`expense-${type}-pagination`);
  if (!paginationDiv) {
    console.error(`페이지네이션 div를 찾을 수 없습니다: expense-${type}-pagination`);
    return;
  }
  
  if (totalPages <= 1) {
    paginationDiv.style.display = 'none';
    return;
  }
  
  paginationDiv.style.display = 'block';
  
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  
  let html = `<div style="display:flex;justify-content:center;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 0;">`;
  html += `<span style="color:#666;margin-right:4px;font-size:0.7rem;">${startItem}-${endItem} / ${totalItems}건</span>`;
  
  // 이전 버튼
  if (currentPage > 1) {
    html += `<button onclick="changeExpensePage('${type}', ${currentPage - 1})" style="background:#fff;color:#1976d2;border:1px solid #1976d2;padding:4px 8px;border-radius:3px;cursor:pointer;font-size:0.7rem;">◀ 이전</button>`;
  } else {
    html += `<button disabled style="background:#f5f5f5;color:#999;border:1px solid #ddd;padding:4px 8px;border-radius:3px;font-size:0.7rem;cursor:not-allowed;">◀ 이전</button>`;
  }
  
  // 페이지 번호
  html += `<span style="color:#333;font-weight:500;font-size:0.7rem;">${currentPage} / ${totalPages}</span>`;
  
  // 다음 버튼
  if (currentPage < totalPages) {
    html += `<button onclick="changeExpensePage('${type}', ${currentPage + 1})" style="background:#fff;color:#1976d2;border:1px solid #1976d2;padding:4px 8px;border-radius:3px;cursor:pointer;font-size:0.7rem;">다음 ▶</button>`;
  } else {
    html += `<button disabled style="background:#f5f5f5;color:#999;border:1px solid #ddd;padding:4px 8px;border-radius:3px;font-size:0.7rem;cursor:not-allowed;">다음 ▶</button>`;
  }
  
  html += `</div>`;
  paginationDiv.innerHTML = html;
}

// 페이지 변경 함수 (전역으로 노출)
window.changeExpensePage = function(type, page) {
  if (type === 'meal') {
    mealCurrentPage = page;
    // 저장된 데이터로 테이블만 다시 렌더링
    if (window.expenseMealData) {
      renderMealTable(window.expenseMealData);
    }
  } else if (type === 'purchase') {
    purchaseCurrentPage = page;
    if (window.expensePurchaseData) {
      renderPurchaseTable(window.expensePurchaseData);
    }
  } else if (type === 'personal') {
    personalCurrentPage = page;
    if (window.expensePersonalData) {
      renderPersonalTable(window.expensePersonalData);
    }
  }
};

// 행 클릭 이벤트 설정
function setupExpenseRowClickListeners(tableBody) {
  tableBody.querySelectorAll('.expense-row').forEach(row => {
    row.addEventListener('click', function() {
      const expenseData = JSON.parse(this.getAttribute('data-expense-data'));
      showExpenseEditModal(expenseData);
    });
  });
}

// 지출 내역 수정 모달 표시
async function showExpenseEditModal(expense) {
  // 트레이너 목록과 센터 목록 조회
  const [trainersResponse, centersResponse] = await Promise.all([
    fetch('/api/trainers'),
    fetch('/api/centers')
  ]);
  const trainers = await trainersResponse.json();
  const centers = await centersResponse.json();
  
  // datetime을 입력 가능한 형식으로 변환
  const datetime = new Date(expense.datetime);
  const year = datetime.getFullYear();
  const month = String(datetime.getMonth() + 1).padStart(2, '0');
  const day = String(datetime.getDate()).padStart(2, '0');
  const hours = String(datetime.getHours()).padStart(2, '0');
  const minutes = String(datetime.getMinutes()).padStart(2, '0');
  const datetimeStr = `${year}-${month}-${day}T${hours}:${minutes}`;
  
  const expenseType = expense.expenseType || 'meal';
  
  // expense_type에 따라 다른 필드 표시
  let typeSpecificFields = '';
  if (expenseType === 'meal') {
    // 식대: participantTrainers 필드
    const participantNames = expense.participantTrainerNames || [];
    const participantOptions = trainers.map(trainer => 
      `<option value="${trainer.username}" ${participantNames.includes(trainer.name) ? 'selected' : ''}>${trainer.name}</option>`
    ).join('');
    
    typeSpecificFields = `
      <div>
        <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">함께한 트레이너</label>
        <select id="expense-edit-participant-trainers" multiple size="5" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
          ${participantOptions}
        </select>
        <div style="font-size:0.75rem;color:#666;margin-top:4px;">※ Ctrl(또는 Cmd) 키를 누른 채로 클릭하여 여러 명 선택</div>
      </div>
    `;
  } else if (expenseType === 'purchase') {
    // 구매: purchaseItem, center 필드
    const centerOptions = centers.map(center => 
      `<option value="${center.name}" ${expense.center === center.name ? 'selected' : ''}>${center.name}</option>`
    ).join('');
    
    typeSpecificFields = `
      <div>
        <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">구매물품 *</label>
        <input type="text" id="expense-edit-purchase-item" value="${expense.purchaseItem || ''}" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
      </div>
      <div>
        <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">센터 *</label>
        <select id="expense-edit-center" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
          <option value="">선택</option>
          ${centerOptions}
        </select>
      </div>
    `;
  } else if (expenseType === 'personal') {
    // 개인지출: purchaseItem (지출내역), center 필드
    const centerOptions = centers.map(center => 
      `<option value="${center.name}" ${expense.center === center.name ? 'selected' : ''}>${center.name}</option>`
    ).join('');
    
    typeSpecificFields = `
      <div>
        <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">지출내역</label>
        <input type="text" id="expense-edit-purchase-item" value="${expense.purchaseItem || ''}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
      </div>
      <div>
        <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">센터</label>
        <select id="expense-edit-center" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
          <option value="">선택</option>
          ${centerOptions}
        </select>
      </div>
    `;
  }
  
  const trainerOptions = trainers.map(trainer => 
    `<option value="${trainer.username}" ${expense.trainer === trainer.username || expense.trainerName === trainer.name ? 'selected' : ''}>${trainer.name}</option>`
  ).join('');
  
  // "공용" 옵션 추가
  const commonOption = `<option value="공용" ${expense.trainer === '공용' || expense.trainerName === '공용' ? 'selected' : ''}>공용</option>`;
  const trainerOptionsWithCommon = commonOption + trainerOptions;
  
  const modalHTML = `
    <div class="expense-edit-modal-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;">
      <div class="expense-edit-modal" style="background:#fff;border-radius:6px;padding:16px;max-width:340px;width:90%;max-height:90vh;overflow-y:auto;box-shadow:0 4px 20px rgba(0,0,0,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="margin:0;color:#1976d2;font-size:1rem;font-weight:600;">지출 내역 수정</h3>
          <button id="expense-edit-modal-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:#666;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
        </div>
        
        <form id="expense-edit-form" style="display:flex;flex-direction:column;gap:10px;">
          <div>
            <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">지출자 *</label>
            <select id="expense-edit-trainer" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
              <option value="">선택</option>
              ${trainerOptionsWithCommon}
            </select>
          </div>
          
          <div>
            <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">지출 금액 *</label>
            <input type="number" id="expense-edit-amount" value="${expense.amount}" min="0" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
          </div>
          
          <div>
            <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">지출 시각 *</label>
            <input type="datetime-local" id="expense-edit-datetime" value="${datetimeStr}" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
          </div>
          
          ${typeSpecificFields}
          
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;padding-top:12px;border-top:1px solid #eee;">
            <button type="button" id="expense-edit-delete-btn" style="background:#d32f2f;color:#fff;border:none;padding:8px 14px;border-radius:4px;cursor:pointer;font-size:0.85rem;">삭제</button>
            <div style="display:flex;gap:8px;">
              <button type="button" id="expense-edit-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:8px 14px;border-radius:4px;cursor:pointer;font-size:0.85rem;">취소</button>
              <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:8px 14px;border-radius:4px;cursor:pointer;font-size:0.85rem;">저장</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
  
  // 기존 모달이 있으면 제거
  const existingOverlay = document.querySelector('.expense-edit-modal-overlay');
  const existingModal = document.querySelector('.expense-edit-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  // 모달 추가
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // 이벤트 리스너 설정
  const closeBtn = document.getElementById('expense-edit-modal-close');
  const cancelBtn = document.getElementById('expense-edit-cancel-btn');
  const deleteBtn = document.getElementById('expense-edit-delete-btn');
  const form = document.getElementById('expense-edit-form');
  const overlay = document.querySelector('.expense-edit-modal-overlay');
  
  const closeModal = () => {
    if (overlay) overlay.remove();
  };
  
  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;
  if (overlay) {
    overlay.onclick = (e) => {
      if (e.target === overlay) closeModal();
    };
  }
  
  // 삭제 버튼
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      if (!confirm('정말 삭제하시겠습니까?')) {
        return;
      }
      
      try {
        const res = await fetch(`/api/expenses/${expense.id}`, {
          method: 'DELETE'
        });
        
        const result = await res.json();
        
        if (res.ok) {
          alert('지출 내역이 삭제되었습니다.');
          closeModal();
          loadExpenses();
        } else {
          alert(result.message || '삭제에 실패했습니다.');
        }
      } catch (error) {
        console.error('지출 내역 삭제 오류:', error);
        alert('삭제 중 오류가 발생했습니다.');
      }
    };
  }
  
  // 폼 제출
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      
      const trainerEl = document.getElementById('expense-edit-trainer');
      const amountEl = document.getElementById('expense-edit-amount');
      const datetimeEl = document.getElementById('expense-edit-datetime');
      
      if (!trainerEl || !amountEl || !datetimeEl) {
        alert('필수 필드를 입력해주세요.');
        return;
      }
      
      // datetime-local input의 값을 직접 사용 (타임존 변환 없이)
      // 형식: "YYYY-MM-DDTHH:mm" -> "YYYY-MM-DDTHH:mm:ss" (초 추가)
      const datetimeValue = datetimeEl.value;
      const datetimeStr = datetimeValue + ':00'; // 초 추가
      
      const updateData = {
        trainer: trainerEl.value,
        amount: parseInt(amountEl.value),
        datetime: datetimeStr
      };
      
      // expense_type에 따라 다른 필드 추가
      if (expenseType === 'meal') {
        const participantTrainersEl = document.getElementById('expense-edit-participant-trainers');
        if (participantTrainersEl) {
          const selectedTrainers = Array.from(participantTrainersEl.selectedOptions).map(opt => opt.value);
          updateData.participantTrainers = selectedTrainers;
        }
      } else if (expenseType === 'purchase' || expenseType === 'personal') {
        const purchaseItemEl = document.getElementById('expense-edit-purchase-item');
        const centerEl = document.getElementById('expense-edit-center');
        if (purchaseItemEl) {
          updateData.purchaseItem = purchaseItemEl.value || null;
        }
        if (centerEl) {
          updateData.center = centerEl.value || null;
        }
      }
      
      try {
        const res = await fetch(`/api/expenses/${expense.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        });
        
        const result = await res.json();
        
        if (res.ok) {
          alert('지출 내역이 수정되었습니다.');
          closeModal();
          loadExpenses();
        } else {
          alert(result.message || '수정에 실패했습니다.');
        }
      } catch (error) {
        console.error('지출 내역 수정 오류:', error);
        alert('수정 중 오류가 발생했습니다.');
      }
    };
  }
}

// 지출 내역 추가 모달 표시
async function showExpenseAddModal(expenseType) {
  // 트레이너 목록과 센터 목록 조회
  const [trainersResponse, centersResponse] = await Promise.all([
    fetch('/api/trainers'),
    fetch('/api/centers')
  ]);
  const trainers = await trainersResponse.json();
  const centers = await centersResponse.json();
  
  // 현재 시간을 기본값으로 설정
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const datetimeStr = `${year}-${month}-${day}T${hours}:${minutes}`;
  
  // expense_type에 따라 다른 필드 표시
  let typeSpecificFields = '';
  if (expenseType === 'meal') {
    // 식대: participantTrainers 필드
    const participantOptions = trainers.map(trainer => 
      `<option value="${trainer.username}">${trainer.name}</option>`
    ).join('');
    
    typeSpecificFields = `
      <div>
        <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">함께한 트레이너 *</label>
        <select id="expense-add-participant-trainers" multiple size="4" required style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:0.85rem;box-sizing:border-box;">
          ${participantOptions}
        </select>
        <div style="font-size:0.7rem;color:#666;margin-top:3px;">※ Ctrl(또는 Cmd) 키를 누른 채로 클릭하여 여러 명 선택</div>
      </div>
    `;
  } else if (expenseType === 'purchase') {
    // 구매: purchaseItem, center 필드
    const centerOptions = centers.map(center => 
      `<option value="${center.name}">${center.name}</option>`
    ).join('');
    
    typeSpecificFields = `
      <div>
        <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">구매물품 *</label>
        <input type="text" id="expense-add-purchase-item" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
      </div>
      <div>
        <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">센터 *</label>
        <select id="expense-add-center" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
          <option value="">선택</option>
          ${centerOptions}
        </select>
      </div>
    `;
  } else if (expenseType === 'personal') {
    // 개인지출: purchaseItem (지출내역), center 필드
    const centerOptions = centers.map(center => 
      `<option value="${center.name}">${center.name}</option>`
    ).join('');
    
    typeSpecificFields = `
      <div>
        <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">지출내역</label>
        <input type="text" id="expense-add-purchase-item" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
      </div>
      <div>
        <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">센터</label>
        <select id="expense-add-center" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
          <option value="">선택</option>
          ${centerOptions}
        </select>
      </div>
    `;
  }
  
  const trainerOptions = trainers.map(trainer => 
    `<option value="${trainer.username}">${trainer.name}</option>`
  ).join('');
  
  // "공용" 옵션 추가
  const commonOption = `<option value="공용">공용</option>`;
  const trainerOptionsWithCommon = commonOption + trainerOptions;
  
  const modalHTML = `
    <div class="expense-add-modal-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;">
      <div class="expense-add-modal" style="background:#fff;border-radius:6px;padding:16px;max-width:340px;width:90%;max-height:90vh;overflow-y:auto;box-shadow:0 4px 20px rgba(0,0,0,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="margin:0;color:#1976d2;font-size:1rem;font-weight:600;">지출 내역 추가</h3>
          <button id="expense-add-modal-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:#666;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
        </div>
        
        <form id="expense-add-form" style="display:flex;flex-direction:column;gap:10px;">
          <div>
            <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">지출자 *</label>
            <select id="expense-add-trainer" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
              <option value="">선택</option>
              ${trainerOptionsWithCommon}
            </select>
          </div>
          
          <div>
            <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">지출 금액 *</label>
            <input type="number" id="expense-add-amount" min="0" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
          </div>
          
          <div>
            <label style="display:block;font-size:0.85rem;font-weight:600;color:#333;margin-bottom:4px;">지출 시각 *</label>
            <input type="datetime-local" id="expense-add-datetime" value="${datetimeStr}" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
          </div>
          
          ${typeSpecificFields}
          
          <div id="expense-add-result" style="min-height:20px;color:#d32f2f;font-size:0.8rem;"></div>
          
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;">
            <button type="button" id="expense-add-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:8px 14px;border-radius:4px;cursor:pointer;font-size:0.85rem;">취소</button>
            <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:8px 14px;border-radius:4px;cursor:pointer;font-size:0.85rem;">저장</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  // 기존 모달이 있으면 제거
  const existingOverlay = document.querySelector('.expense-add-modal-overlay');
  const existingModal = document.querySelector('.expense-add-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  // 모달 추가
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // 이벤트 리스너 설정
  const closeBtn = document.getElementById('expense-add-modal-close');
  const cancelBtn = document.getElementById('expense-add-cancel-btn');
  const form = document.getElementById('expense-add-form');
  const overlay = document.querySelector('.expense-add-modal-overlay');
  
  const closeModal = () => {
    if (overlay) overlay.remove();
  };
  
  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;
  if (overlay) {
    overlay.onclick = (e) => {
      if (e.target === overlay) closeModal();
    };
  }
  
  // 폼 제출
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      
      const resultDiv = document.getElementById('expense-add-result');
      const trainerEl = document.getElementById('expense-add-trainer');
      const amountEl = document.getElementById('expense-add-amount');
      const datetimeEl = document.getElementById('expense-add-datetime');
      
      if (!trainerEl || !amountEl || !datetimeEl) {
        resultDiv.textContent = '필수 필드를 입력해주세요.';
        return;
      }
      
      // datetime-local input의 값을 직접 사용 (타임존 변환 없이)
      const datetimeValue = datetimeEl.value;
      // 이미 초가 있으면 추가하지 않음
      const datetimeStr = datetimeValue.includes(':00') && datetimeValue.split(':').length === 3 
        ? datetimeValue 
        : datetimeValue + ':00'; // 초 추가
      
      const expenseData = {
        trainer: trainerEl.value,
        expenseType: expenseType,
        amount: parseInt(amountEl.value),
        datetime: datetimeStr
      };
      
      // expense_type에 따라 다른 필드 추가
      if (expenseType === 'meal') {
        const participantTrainersEl = document.getElementById('expense-add-participant-trainers');
        if (participantTrainersEl) {
          const selectedTrainers = Array.from(participantTrainersEl.selectedOptions).map(opt => opt.value);
          if (selectedTrainers.length === 0) {
            resultDiv.textContent = '함께한 트레이너를 최소 1명 이상 선택해주세요.';
            return;
          }
          expenseData.participantTrainers = selectedTrainers;
        }
      } else if (expenseType === 'purchase') {
        const purchaseItemEl = document.getElementById('expense-add-purchase-item');
        const centerEl = document.getElementById('expense-add-center');
        if (purchaseItemEl && purchaseItemEl.value.trim()) {
          expenseData.purchaseItem = purchaseItemEl.value.trim();
        } else {
          resultDiv.textContent = '구매물품을 입력해주세요.';
          return;
        }
        if (centerEl && centerEl.value) {
          expenseData.center = centerEl.value;
        } else {
          resultDiv.textContent = '센터를 선택해주세요.';
          return;
        }
      } else if (expenseType === 'personal') {
        const purchaseItemEl = document.getElementById('expense-add-purchase-item');
        const centerEl = document.getElementById('expense-add-center');
        if (purchaseItemEl) {
          expenseData.personalItem = purchaseItemEl.value || null;
        }
        if (centerEl) {
          expenseData.center = centerEl.value || null;
        }
      }
      
      try {
        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(expenseData)
        });
        
        const result = await res.json();
        
        if (res.ok) {
          alert('지출 내역이 추가되었습니다.');
          closeModal();
          loadExpenses();
        } else {
          resultDiv.textContent = result.message || '추가에 실패했습니다.';
        }
      } catch (error) {
        console.error('지출 내역 추가 오류:', error);
        resultDiv.textContent = '추가 중 오류가 발생했습니다.';
      }
    };
  }
}

