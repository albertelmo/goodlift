// 관리자 지출 내역 조회 모듈
export const expense = {
  render
};

function render(container) {
  if (!container) return;
  
  container.innerHTML = `
    <div style="padding:20px;">
      <h3 style="margin-top:0;margin-bottom:20px;color:#1976d2;font-size:1.2rem;">💳 지출 내역 관리</h3>
      
      <!-- 필터 영역 -->
      <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin-bottom:20px;">
        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:end;">
          <div style="flex:1;min-width:200px;">
            <label style="display:block;margin-bottom:6px;font-size:0.9rem;color:#666;">조회 월</label>
            <input type="month" id="expense-filter-month" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.95rem;">
          </div>
          <div style="flex-shrink:0;">
            <button id="expense-filter-btn" style="background:#1976d2;color:#fff;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;font-size:0.95rem;white-space:nowrap;">조회</button>
          </div>
        </div>
      </div>
      
      <!-- 식대 요약 영역 -->
      <div id="expense-meal-summary" style="background:#e3f2fd;padding:16px;border-radius:8px;margin-bottom:20px;display:flex;gap:20px;flex-wrap:wrap;">
        <div>
          <div style="font-size:0.9rem;color:#666;margin-bottom:4px;">식대 건수</div>
          <div id="expense-meal-count" style="font-size:1.5rem;font-weight:bold;color:#1976d2;">0건</div>
        </div>
        <div>
          <div style="font-size:0.9rem;color:#666;margin-bottom:4px;">식대 금액</div>
          <div id="expense-meal-amount" style="font-size:1.5rem;font-weight:bold;color:#1976d2;">0원</div>
        </div>
      </div>
      
      <!-- 식대 지출 내역 테이블 -->
      <div style="margin-bottom:30px;">
        <h4 style="margin:0 0 12px 0;color:#1976d2;font-size:1.1rem;">🍽️ 식대 내역</h4>
        <div id="expense-meal-loading" style="text-align:center;color:#888;padding:40px;">식대 내역을 불러오는 중...</div>
        <div id="expense-meal-table-container" style="display:none;">
          <table id="expense-meal-table" style="width:100%;border-collapse:collapse;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
            <thead>
              <tr style="background:#f5f5f5;border-bottom:2px solid #ddd;">
                <th style="padding:12px 8px;text-align:left;font-weight:600;color:#333;font-size:0.9rem;">시각</th>
                <th style="padding:12px 8px;text-align:left;font-weight:600;color:#333;font-size:0.9rem;">지출자</th>
                <th style="padding:12px 8px;text-align:right;font-weight:600;color:#333;font-size:0.9rem;">금액</th>
                <th style="padding:12px 8px;text-align:left;font-weight:600;color:#333;font-size:0.9rem;">함께 지출한 트레이너</th>
                <th style="padding:12px 8px;text-align:center;font-weight:600;color:#333;font-size:0.9rem;">삭제</th>
              </tr>
            </thead>
            <tbody id="expense-meal-table-body">
            </tbody>
          </table>
        </div>
        <div id="expense-meal-empty" style="display:none;text-align:center;color:#888;padding:40px;background:#f9f9f9;border-radius:8px;">
          식대 내역이 없습니다.
        </div>
      </div>
      
      <!-- 구매 요약 영역 -->
      <div id="expense-purchase-summary" style="background:#e8f5e9;padding:16px;border-radius:8px;margin-bottom:20px;display:flex;gap:20px;flex-wrap:wrap;">
        <div>
          <div style="font-size:0.9rem;color:#666;margin-bottom:4px;">구매 건수</div>
          <div id="expense-purchase-count" style="font-size:1.5rem;font-weight:bold;color:#4caf50;">0건</div>
        </div>
        <div>
          <div style="font-size:0.9rem;color:#666;margin-bottom:4px;">구매 금액</div>
          <div id="expense-purchase-amount" style="font-size:1.5rem;font-weight:bold;color:#4caf50;">0원</div>
        </div>
      </div>
      
      <!-- 구매 지출 내역 테이블 -->
      <div>
        <h4 style="margin:0 0 12px 0;color:#4caf50;font-size:1.1rem;">🛒 구매 내역</h4>
        <div id="expense-purchase-loading" style="text-align:center;color:#888;padding:40px;">구매 내역을 불러오는 중...</div>
        <div id="expense-purchase-table-container" style="display:none;">
          <table id="expense-purchase-table" style="width:100%;border-collapse:collapse;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
            <thead>
              <tr style="background:#f5f5f5;border-bottom:2px solid #ddd;">
                <th style="padding:12px 8px;text-align:left;font-weight:600;color:#333;font-size:0.9rem;">시각</th>
                <th style="padding:12px 8px;text-align:left;font-weight:600;color:#333;font-size:0.9rem;">지출자</th>
                <th style="padding:12px 8px;text-align:right;font-weight:600;color:#333;font-size:0.9rem;">금액</th>
                <th style="padding:12px 8px;text-align:left;font-weight:600;color:#333;font-size:0.9rem;">구매물품</th>
                <th style="padding:12px 8px;text-align:left;font-weight:600;color:#333;font-size:0.9rem;">센터</th>
                <th style="padding:12px 8px;text-align:center;font-weight:600;color:#333;font-size:0.9rem;">삭제</th>
              </tr>
            </thead>
            <tbody id="expense-purchase-table-body">
            </tbody>
          </table>
        </div>
        <div id="expense-purchase-empty" style="display:none;text-align:center;color:#888;padding:40px;background:#f9f9f9;border-radius:8px;">
          구매 내역이 없습니다.
        </div>
      </div>
    </div>
  `;
  
  // 이벤트 리스너 설정
  setupEventListeners(container);
  
  // 초기 데이터 로드
  loadExpenses();
}

function setupEventListeners(container) {
  // 월 기본값 설정 (이번 달)
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  document.getElementById('expense-filter-month').value = `${year}-${month}`;
  
  // 조회 버튼 클릭
  document.getElementById('expense-filter-btn').onclick = loadExpenses;
  
  // Enter 키로 조회
  container.querySelectorAll('input[type="month"]').forEach(input => {
    input.onkeypress = (e) => {
      if (e.key === 'Enter') {
        loadExpenses();
      }
    };
  });
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
  
  mealLoading.style.display = 'block';
  mealTableContainer.style.display = 'none';
  mealEmpty.style.display = 'none';
  
  purchaseLoading.style.display = 'block';
  purchaseTableContainer.style.display = 'none';
  purchaseEmpty.style.display = 'none';
  
  try {
    const monthValue = document.getElementById('expense-filter-month').value;
    if (!monthValue) {
      alert('조회할 월을 선택해주세요.');
      return;
    }
    
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
    
    if (!data.expenses || data.expenses.length === 0) {
      mealEmpty.style.display = 'block';
      purchaseEmpty.style.display = 'block';
      mealCount.textContent = '0건';
      mealAmount.textContent = '0원';
      purchaseCount.textContent = '0건';
      purchaseAmount.textContent = '0원';
      return;
    }
    
    // 식대와 구매 분리
    const mealExpenses = data.expenses.filter(e => e.expenseType === 'meal');
    const purchaseExpenses = data.expenses.filter(e => e.expenseType === 'purchase');
    
    // 식대 요약 정보
    const mealTotalAmount = mealExpenses.reduce((sum, e) => sum + e.amount, 0);
    mealCount.textContent = `${mealExpenses.length}건`;
    mealAmount.textContent = `${mealTotalAmount.toLocaleString()}원`;
    
    // 구매 요약 정보
    const purchaseTotalAmount = purchaseExpenses.reduce((sum, e) => sum + e.amount, 0);
    purchaseCount.textContent = `${purchaseExpenses.length}건`;
    purchaseAmount.textContent = `${purchaseTotalAmount.toLocaleString()}원`;
    
    // 식대 테이블 렌더링
    mealTableBody.innerHTML = '';
    if (mealExpenses.length === 0) {
      mealEmpty.style.display = 'block';
    } else {
      mealTableContainer.style.display = 'block';
      mealExpenses.forEach(expense => {
        const row = createMealRow(expense);
        mealTableBody.appendChild(row);
      });
      setupDeleteButtons(mealTableBody);
    }
    
    // 구매 테이블 렌더링
    purchaseTableBody.innerHTML = '';
    if (purchaseExpenses.length === 0) {
      purchaseEmpty.style.display = 'block';
    } else {
      purchaseTableContainer.style.display = 'block';
      purchaseExpenses.forEach(expense => {
        const row = createPurchaseRow(expense);
        purchaseTableBody.appendChild(row);
      });
      setupDeleteButtons(purchaseTableBody);
    }
  } catch (error) {
    console.error('지출 내역 로드 오류:', error);
    mealLoading.style.display = 'none';
    purchaseLoading.style.display = 'none';
    mealEmpty.style.display = 'block';
    purchaseEmpty.style.display = 'block';
    mealEmpty.innerHTML = '<div style="color:#d32f2f;">지출 내역을 불러오지 못했습니다.</div>';
    purchaseEmpty.innerHTML = '<div style="color:#d32f2f;">지출 내역을 불러오지 못했습니다.</div>';
  }
}

// 식대 행 생성
function createMealRow(expense) {
  const row = document.createElement('tr');
  row.style.borderBottom = '1px solid #eee';
  
  // 백엔드에서 이미 한국 시간(Asia/Seoul)으로 변환되어 반환되므로, 그대로 사용
  const datetime = new Date(expense.datetime);
  const year = datetime.getFullYear();
  const month = String(datetime.getMonth() + 1).padStart(2, '0');
  const day = String(datetime.getDate()).padStart(2, '0');
  const hours = String(datetime.getHours()).padStart(2, '0');
  const minutes = String(datetime.getMinutes()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hours}:${minutes}`;
  
  const participantNames = expense.participantTrainerNames || expense.participantTrainers || [];
  const participantStr = participantNames.join(', ');
  
  row.innerHTML = `
    <td style="padding:12px 8px;font-size:0.9rem;">
      <div style="font-weight:500;">${dateStr}</div>
      <div style="color:#666;font-size:0.85rem;">${timeStr}</div>
    </td>
    <td style="padding:12px 8px;font-size:0.9rem;">${expense.trainerName || expense.trainer}</td>
    <td style="padding:12px 8px;text-align:right;font-size:0.95rem;font-weight:500;color:#1976d2;">${expense.amount.toLocaleString()}원</td>
    <td style="padding:12px 8px;font-size:0.9rem;color:#666;">${participantStr || '-'}</td>
    <td style="padding:12px 8px;text-align:center;">
      <button class="delete-expense-btn" data-id="${expense.id}" 
              style="background:#d32f2f;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;">
        삭제
      </button>
    </td>
  `;
  
  return row;
}

// 구매 행 생성
function createPurchaseRow(expense) {
  const row = document.createElement('tr');
  row.style.borderBottom = '1px solid #eee';
  
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
    <td style="padding:12px 8px;font-size:0.9rem;">
      <div style="font-weight:500;">${dateStr}</div>
      <div style="color:#666;font-size:0.85rem;">${timeStr}</div>
    </td>
    <td style="padding:12px 8px;font-size:0.9rem;">${expense.trainerName || expense.trainer}</td>
    <td style="padding:12px 8px;text-align:right;font-size:0.95rem;font-weight:500;color:#4caf50;">${expense.amount.toLocaleString()}원</td>
    <td style="padding:12px 8px;font-size:0.9rem;color:#666;">${expense.purchaseItem || '-'}</td>
    <td style="padding:12px 8px;font-size:0.9rem;color:#666;">${expense.center || '-'}</td>
    <td style="padding:12px 8px;text-align:center;">
      <button class="delete-expense-btn" data-id="${expense.id}" 
              style="background:#d32f2f;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;">
        삭제
      </button>
    </td>
  `;
  
  return row;
}

// 삭제 버튼 이벤트 설정
function setupDeleteButtons(tableBody) {
  tableBody.querySelectorAll('.delete-expense-btn').forEach(btn => {
    btn.onclick = async function() {
      const id = this.getAttribute('data-id');
      if (!confirm('정말 삭제하시겠습니까?')) {
        return;
      }
      
      try {
        const res = await fetch(`/api/expenses/${id}`, {
          method: 'DELETE'
        });
        
        const result = await res.json();
        
        if (res.ok) {
          alert('지출 내역이 삭제되었습니다.');
          loadExpenses(); // 목록 새로고침
        } else {
          alert(result.message || '삭제에 실패했습니다.');
        }
      } catch (error) {
        console.error('지출 내역 삭제 오류:', error);
        alert('삭제 중 오류가 발생했습니다.');
      }
    };
  });
}

