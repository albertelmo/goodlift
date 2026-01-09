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
          <div style="flex:1;min-width:150px;">
            <label style="display:block;margin-bottom:6px;font-size:0.9rem;color:#666;">트레이너</label>
            <select id="expense-filter-trainer" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.95rem;">
              <option value="">전체</option>
            </select>
          </div>
          <div style="flex:1;min-width:150px;">
            <label style="display:block;margin-bottom:6px;font-size:0.9rem;color:#666;">시작일</label>
            <input type="date" id="expense-filter-start-date" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.95rem;">
          </div>
          <div style="flex:1;min-width:150px;">
            <label style="display:block;margin-bottom:6px;font-size:0.9rem;color:#666;">종료일</label>
            <input type="date" id="expense-filter-end-date" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.95rem;">
          </div>
          <div style="flex-shrink:0;">
            <button id="expense-filter-btn" style="background:#1976d2;color:#fff;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;font-size:0.95rem;white-space:nowrap;">조회</button>
          </div>
        </div>
      </div>
      
      <!-- 요약 영역 -->
      <div id="expense-summary" style="background:#e3f2fd;padding:16px;border-radius:8px;margin-bottom:20px;display:flex;gap:20px;flex-wrap:wrap;">
        <div>
          <div style="font-size:0.9rem;color:#666;margin-bottom:4px;">총 지출 건수</div>
          <div id="expense-total-count" style="font-size:1.5rem;font-weight:bold;color:#1976d2;">0건</div>
        </div>
        <div>
          <div style="font-size:0.9rem;color:#666;margin-bottom:4px;">총 지출 금액</div>
          <div id="expense-total-amount" style="font-size:1.5rem;font-weight:bold;color:#1976d2;">0원</div>
        </div>
      </div>
      
      <!-- 지출 내역 테이블 -->
      <div id="expense-loading" style="text-align:center;color:#888;padding:40px;">지출 내역을 불러오는 중...</div>
      <div id="expense-table-container" style="display:none;">
        <table id="expense-table" style="width:100%;border-collapse:collapse;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
          <thead>
            <tr style="background:#f5f5f5;border-bottom:2px solid #ddd;">
              <th style="padding:12px 8px;text-align:left;font-weight:600;color:#333;font-size:0.9rem;">시각</th>
              <th style="padding:12px 8px;text-align:left;font-weight:600;color:#333;font-size:0.9rem;">지출자</th>
              <th style="padding:12px 8px;text-align:right;font-weight:600;color:#333;font-size:0.9rem;">금액</th>
              <th style="padding:12px 8px;text-align:left;font-weight:600;color:#333;font-size:0.9rem;">함께 지출한 트레이너</th>
              <th style="padding:12px 8px;text-align:center;font-weight:600;color:#333;font-size:0.9rem;">삭제</th>
            </tr>
          </thead>
          <tbody id="expense-table-body">
          </tbody>
        </table>
      </div>
      <div id="expense-empty" style="display:none;text-align:center;color:#888;padding:40px;background:#f9f9f9;border-radius:8px;">
        지출 내역이 없습니다.
      </div>
    </div>
  `;
  
  // 이벤트 리스너 설정
  setupEventListeners(container);
  
  // 초기 데이터 로드
  loadExpenses();
}

function setupEventListeners(container) {
  // 트레이너 목록 로드
  loadTrainers();
  
  // 날짜 기본값 설정 (이번 달 첫날 ~ 오늘)
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  document.getElementById('expense-filter-start-date').value = firstDay.toISOString().split('T')[0];
  document.getElementById('expense-filter-end-date').value = today.toISOString().split('T')[0];
  
  // 조회 버튼 클릭
  document.getElementById('expense-filter-btn').onclick = loadExpenses;
  
  // Enter 키로 조회
  container.querySelectorAll('input[type="date"], select').forEach(input => {
    input.onkeypress = (e) => {
      if (e.key === 'Enter') {
        loadExpenses();
      }
    };
  });
}

// 트레이너 목록 로드
async function loadTrainers() {
  try {
    const res = await fetch('/api/trainers');
    const trainers = await res.json();
    const select = document.getElementById('expense-filter-trainer');
    
    select.innerHTML = '<option value="">전체</option>';
    trainers.forEach(trainer => {
      const option = document.createElement('option');
      option.value = trainer.username;
      option.textContent = trainer.name;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('트레이너 목록 로드 오류:', error);
  }
}

// 지출 내역 로드
async function loadExpenses() {
  const loading = document.getElementById('expense-loading');
  const tableContainer = document.getElementById('expense-table-container');
  const emptyDiv = document.getElementById('expense-empty');
  const tableBody = document.getElementById('expense-table-body');
  const totalCount = document.getElementById('expense-total-count');
  const totalAmount = document.getElementById('expense-total-amount');
  
  loading.style.display = 'block';
  tableContainer.style.display = 'none';
  emptyDiv.style.display = 'none';
  
  try {
    const trainer = document.getElementById('expense-filter-trainer').value;
    const startDate = document.getElementById('expense-filter-start-date').value;
    const endDate = document.getElementById('expense-filter-end-date').value;
    
    let url = '/api/expenses?';
    const params = [];
    if (trainer) params.push(`trainer=${encodeURIComponent(trainer)}`);
    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);
    url += params.join('&');
    
    const res = await fetch(url);
    const data = await res.json();
    
    loading.style.display = 'none';
    
    if (!data.expenses || data.expenses.length === 0) {
      emptyDiv.style.display = 'block';
      totalCount.textContent = '0건';
      totalAmount.textContent = '0원';
      return;
    }
    
    // 요약 정보 업데이트
    totalCount.textContent = `${data.summary.count}건`;
    totalAmount.textContent = `${data.summary.totalAmount.toLocaleString()}원`;
    
    // 테이블 렌더링
    tableBody.innerHTML = '';
    data.expenses.forEach(expense => {
      const row = document.createElement('tr');
      row.style.borderBottom = '1px solid #eee';
      
      // 시각 포맷팅 (한국시간)
      const datetime = new Date(expense.datetime);
      const year = datetime.getFullYear();
      const month = String(datetime.getMonth() + 1).padStart(2, '0');
      const day = String(datetime.getDate()).padStart(2, '0');
      const hours = String(datetime.getHours()).padStart(2, '0');
      const minutes = String(datetime.getMinutes()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const timeStr = `${hours}:${minutes}`;
      
      // 함께 지출한 트레이너 목록
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
      
      tableBody.appendChild(row);
    });
    
    // 삭제 버튼 이벤트 설정
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
    
    tableContainer.style.display = 'block';
  } catch (error) {
    console.error('지출 내역 로드 오류:', error);
    loading.style.display = 'none';
    emptyDiv.style.display = 'block';
    emptyDiv.innerHTML = '<div style="color:#d32f2f;">지출 내역을 불러오지 못했습니다.</div>';
  }
}

