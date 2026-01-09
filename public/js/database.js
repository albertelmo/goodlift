// 데이터베이스 관리 모듈
export const database = {
  render
};

function render(container) {
  if (!container) return;
  
  container.innerHTML = `
    <div style="padding:20px;">
      <h3 style="margin-top:0;margin-bottom:20px;color:#1976d2;font-size:1.2rem;">🗄️ 데이터베이스 관리</h3>
      
      <!-- 파일 업로드 영역 -->
      <div style="background:#f5f5f5;padding:20px;border-radius:8px;margin-bottom:20px;border:2px dashed #ddd;">
        <div style="margin-bottom:12px;font-size:0.95rem;color:#666;">
          <strong>회원정보 엑셀 파일 업로드</strong>
        </div>
        <form id="database-upload-form" style="display:flex;gap:12px;align-items:end;flex-wrap:wrap;">
          <div style="flex:1;min-width:200px;">
            <input type="file" id="database-file-input" accept=".xlsx,.xls" required 
                   style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.95rem;">
          </div>
          <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;font-size:0.95rem;white-space:nowrap;">
            파일 업로드
          </button>
        </form>
        <div id="database-upload-result" style="min-height:24px;margin-top:12px;font-size:0.9rem;"></div>
      </div>
      
      <!-- 상품명 선택 영역 -->
      <div id="database-product-select-section" style="display:none;background:#f5f5f5;padding:20px;border-radius:8px;margin-bottom:20px;">
        <div style="margin-bottom:12px;font-size:0.95rem;color:#666;">
          <strong>표시할 상품 선택</strong>
        </div>
        <div id="database-product-checkboxes" style="display:flex;flex-wrap:wrap;gap:12px;">
          <!-- 상품명 체크박스가 여기에 동적으로 생성됩니다 -->
        </div>
        <div style="margin-top:12px;">
          <button id="database-apply-filter-btn" style="background:#1976d2;color:#fff;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;font-size:0.95rem;">
            필터 적용
          </button>
          <button id="database-select-all-btn" style="background:#fff;color:#1976d2;border:1px solid #1976d2;padding:8px 20px;border-radius:4px;cursor:pointer;font-size:0.95rem;margin-left:8px;">
            전체 선택
          </button>
          <button id="database-deselect-all-btn" style="background:#fff;color:#1976d2;border:1px solid #1976d2;padding:8px 20px;border-radius:4px;cursor:pointer;font-size:0.95rem;margin-left:8px;">
            전체 해제
          </button>
        </div>
      </div>
      
      <!-- 방문일 기준 설정 영역 -->
      <div id="database-visit-criteria-section" style="display:none;background:#f5f5f5;padding:20px;border-radius:8px;margin-bottom:20px;">
        <div style="margin-bottom:12px;font-size:0.95rem;color:#666;">
          <strong>방문일 기준 설정</strong>
        </div>
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:8px;">
            <label style="font-size:0.9rem;color:#666;">Green 기준:</label>
            <input type="number" id="database-green-days" value="15" min="1" max="365" 
                   style="width:80px;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;">
            <span style="font-size:0.9rem;color:#666;">일 이내</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <label style="font-size:0.9rem;color:#666;">Yellow 기준:</label>
            <input type="number" id="database-yellow-days" value="30" min="1" max="365" 
                   style="width:80px;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;">
            <span style="font-size:0.9rem;color:#666;">일 이내</span>
          </div>
          <button id="database-apply-visit-criteria-btn" style="background:#1976d2;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:0.9rem;">
            적용
          </button>
        </div>
      </div>
      
      <!-- 필터링 영역 -->
      <div id="database-filter-section" style="display:none;background:#f5f5f5;padding:20px;border-radius:8px;margin-bottom:20px;">
        <div style="margin-bottom:12px;font-size:0.95rem;color:#666;">
          <strong>필터링</strong>
        </div>
        <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:end;">
          <div>
            <label style="display:block;margin-bottom:6px;font-size:0.9rem;color:#666;">성향</label>
            <select id="database-filter-tendency" style="padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;min-width:120px;">
              <option value="all">전체</option>
              <option value="green">Green</option>
              <option value="yellow">Yellow</option>
              <option value="red">Red</option>
            </select>
          </div>
          <div>
            <label style="display:block;margin-bottom:6px;font-size:0.9rem;color:#666;">회원상태</label>
            <select id="database-filter-status" style="padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;min-width:120px;">
              <option value="all">전체</option>
              <option value="유효">유효</option>
              <option value="만료">만료</option>
            </select>
          </div>
          <div>
            <button id="database-apply-filters-btn" style="background:#1976d2;color:#fff;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;font-size:0.9rem;">
              필터 적용
            </button>
            <button id="database-reset-filters-btn" style="background:#fff;color:#1976d2;border:1px solid #1976d2;padding:8px 20px;border-radius:4px;cursor:pointer;font-size:0.9rem;margin-left:8px;">
              초기화
            </button>
          </div>
        </div>
      </div>
      
      <!-- 회원 목록 영역 -->
      <div id="database-members-section" style="display:none;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h4 style="margin:0;color:#333;font-size:1.1rem;">파싱된 회원 정보</h4>
          <div style="display:flex;gap:12px;align-items:center;">
            <div id="database-total-count" style="color:#666;font-size:0.95rem;"></div>
            <button id="database-download-excel-btn" style="background:#4caf50;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:0.9rem;white-space:nowrap;">
              📥 엑셀 다운로드
            </button>
          </div>
        </div>
        <div id="database-loading" style="text-align:center;color:#888;padding:40px;">데이터를 불러오는 중...</div>
        <div id="database-table-container" style="display:none;">
          <div style="overflow-x:auto;">
            <table id="database-table" style="width:100%;border-collapse:collapse;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,0.1);min-width:800px;">
              <thead>
                <tr style="background:#f5f5f5;border-bottom:2px solid #ddd;">
                  <th class="sortable" data-sort="name" style="padding:12px 8px;text-align:left;font-weight:600;color:#333;font-size:0.9rem;white-space:nowrap;cursor:pointer;user-select:none;">
                    회원 이름 <span class="sort-icon">↕</span>
                  </th>
                  <th class="sortable" data-sort="phone" style="padding:12px 8px;text-align:left;font-weight:600;color:#333;font-size:0.9rem;white-space:nowrap;cursor:pointer;user-select:none;">
                    연락처 <span class="sort-icon">↕</span>
                  </th>
                  <th class="sortable" data-sort="tendency" style="padding:12px 8px;text-align:center;font-weight:600;color:#333;font-size:0.9rem;white-space:nowrap;cursor:pointer;user-select:none;">
                    성향 <span class="sort-icon">↕</span>
                  </th>
                  <th class="sortable" data-sort="status" style="padding:12px 8px;text-align:center;font-weight:600;color:#333;font-size:0.9rem;white-space:nowrap;cursor:pointer;user-select:none;">
                    회원상태 <span class="sort-icon">↕</span>
                  </th>
                  <th class="sortable" data-sort="recentVisit" style="padding:12px 8px;text-align:left;font-weight:600;color:#333;font-size:0.9rem;white-space:nowrap;cursor:pointer;user-select:none;">
                    최근방문일 <span class="sort-icon">↕</span>
                  </th>
                  <th style="padding:12px 8px;text-align:left;font-weight:600;color:#333;font-size:0.9rem;white-space:nowrap;">상품명</th>
                  <th class="sortable" data-sort="totalPeriod" style="padding:12px 8px;text-align:right;font-weight:600;color:#333;font-size:0.9rem;white-space:nowrap;cursor:pointer;user-select:none;">
                    전체기간 <span class="sort-icon">↕</span>
                  </th>
                </tr>
              </thead>
              <tbody id="database-table-body">
              </tbody>
            </table>
          </div>
        </div>
        <div id="database-empty" style="display:none;text-align:center;color:#888;padding:40px;background:#f9f9f9;border-radius:8px;">
          파싱된 데이터가 없습니다.
        </div>
      </div>
    </div>
  `;
  
  // 이벤트 리스너 설정
  setupEventListeners(container);
}

function setupEventListeners(container) {
  const form = document.getElementById('database-upload-form');
  const fileInput = document.getElementById('database-file-input');
  const resultDiv = document.getElementById('database-upload-result');
  
  form.onsubmit = async (e) => {
    e.preventDefault();
    
    if (!fileInput.files || fileInput.files.length === 0) {
      resultDiv.textContent = '파일을 선택해주세요.';
      resultDiv.style.color = '#d32f2f';
      return;
    }
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    
    resultDiv.textContent = '파일을 업로드하는 중...';
    resultDiv.style.color = '#1976d2';
    
    try {
      const res = await fetch('/api/database/parse-excel', {
        method: 'POST',
        body: formData
      });
      
      const result = await res.json();
      
      if (res.ok) {
        resultDiv.textContent = result.message || '파일 업로드가 완료되었습니다.';
        resultDiv.style.color = '#1976d2';
        
        // 원본 데이터 저장 (필터링 전)
        window.databaseAllMembers = result.members || [];
        window.databaseAllProductNames = result.allProductNames || [];
        
        // 상품명 선택 UI 표시
        displayProductSelectors(result.allProductNames || []);
        
        // 방문일 기준 설정 UI 표시
        const visitCriteriaSection = document.getElementById('database-visit-criteria-section');
        if (visitCriteriaSection) {
          visitCriteriaSection.style.display = 'block';
        }
        
        // 필터링 UI 표시
        const filterSection = document.getElementById('database-filter-section');
        if (filterSection) {
          filterSection.style.display = 'block';
        }
        
        // 필터링 기능 초기화
        setupFiltering();
        
        // 초기에는 모든 상품 선택된 상태로 회원 목록 표시
        displayMembers(window.databaseAllMembers, []);
      } else {
        resultDiv.textContent = result.message || '파일 업로드에 실패했습니다.';
        resultDiv.style.color = '#d32f2f';
      }
    } catch (error) {
      console.error('파일 업로드 오류:', error);
      resultDiv.textContent = '파일 업로드 중 오류가 발생했습니다.';
      resultDiv.style.color = '#d32f2f';
    }
  };
}

// 상품명 선택 UI 표시
function displayProductSelectors(productNames) {
  const section = document.getElementById('database-product-select-section');
  const checkboxesDiv = document.getElementById('database-product-checkboxes');
  
  if (!productNames || productNames.length === 0) {
    section.style.display = 'none';
    return;
  }
  
  section.style.display = 'block';
  checkboxesDiv.innerHTML = '';
  
  productNames.forEach(productName => {
    const label = document.createElement('label');
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.cursor = 'pointer';
    label.style.padding = '6px 12px';
    label.style.background = '#fff';
    label.style.border = '1px solid #ddd';
    label.style.borderRadius = '4px';
    label.style.fontSize = '0.9rem';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = productName;
    checkbox.checked = true; // 기본적으로 모두 선택
    checkbox.style.marginRight = '8px';
    checkbox.style.cursor = 'pointer';
    
    const span = document.createElement('span');
    span.textContent = productName;
    
    label.appendChild(checkbox);
    label.appendChild(span);
    checkboxesDiv.appendChild(label);
  });
  
  // 이벤트 리스너 설정
  setupProductFilterListeners();
}

// 상품 필터 이벤트 리스너 설정
function setupProductFilterListeners() {
  const applyBtn = document.getElementById('database-apply-filter-btn');
  const selectAllBtn = document.getElementById('database-select-all-btn');
  const deselectAllBtn = document.getElementById('database-deselect-all-btn');
  const applyVisitCriteriaBtn = document.getElementById('database-apply-visit-criteria-btn');
  
  const refreshDisplay = () => {
    if (window.refreshDisplayWithSortAndFilter) {
      window.refreshDisplayWithSortAndFilter();
    } else {
      const selectedProducts = getSelectedProducts();
      displayMembers(window.databaseAllMembers, selectedProducts);
    }
  };
  
  applyBtn.onclick = refreshDisplay;
  
  selectAllBtn.onclick = () => {
    const checkboxes = document.querySelectorAll('#database-product-checkboxes input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
    refreshDisplay();
  };
  
  deselectAllBtn.onclick = () => {
    const checkboxes = document.querySelectorAll('#database-product-checkboxes input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    refreshDisplay();
  };
  
  applyVisitCriteriaBtn.onclick = refreshDisplay;
}

// 정렬 상태 전역 변수
let currentSort = { column: null, direction: 'asc' };

// 정렬 기능 설정 (이벤트 위임 사용)
function setupSorting() {
  const table = document.getElementById('database-table');
  if (!table) return;
  
  // 이벤트 위임: 테이블에 한 번만 이벤트 리스너 추가
  if (!table.dataset.sortListenerAdded) {
    table.addEventListener('click', (e) => {
      const header = e.target.closest('.sortable');
      if (!header) return;
      
      const column = header.getAttribute('data-sort');
      if (!column) return;
      
      // 같은 컬럼 클릭 시 정렬 방향 전환
      if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
      }
      
      // 정렬 아이콘 업데이트
      const allHeaders = document.querySelectorAll('.sortable');
      allHeaders.forEach(h => {
        const icon = h.querySelector('.sort-icon');
        if (h === header) {
          icon.textContent = currentSort.direction === 'asc' ? '↑' : '↓';
          icon.style.color = '#1976d2';
        } else {
          icon.textContent = '↕';
          icon.style.color = '#999';
        }
      });
      
      // 목록 다시 표시 (정렬 적용)
      if (window.refreshDisplayWithSortAndFilter) {
        window.refreshDisplayWithSortAndFilter();
      }
    });
    
    table.dataset.sortListenerAdded = 'true';
  }
  
  // 정렬 및 필터 적용하여 목록 표시 함수
  if (!window.refreshDisplayWithSortAndFilter) {
    window.refreshDisplayWithSortAndFilter = () => {
      const selectedProducts = getSelectedProducts();
      const filteredMembers = applyFilters(window.databaseAllMembers, selectedProducts);
      const sortedMembers = applySorting(filteredMembers, currentSort.column, currentSort.direction);
      displayMembers(sortedMembers, selectedProducts, false); // false = 필터링/정렬 이미 적용됨
    };
  }
}

// 필터링 기능 설정
function setupFiltering() {
  const applyFiltersBtn = document.getElementById('database-apply-filters-btn');
  const resetFiltersBtn = document.getElementById('database-reset-filters-btn');
  const tendencySelect = document.getElementById('database-filter-tendency');
  const statusSelect = document.getElementById('database-filter-status');
  
  // 필터 적용 버튼
  if (applyFiltersBtn) {
    applyFiltersBtn.onclick = () => {
      if (window.refreshDisplayWithSortAndFilter) {
        window.refreshDisplayWithSortAndFilter();
      }
    };
  }
  
  // 드롭다운 변경 시 자동 적용
  if (tendencySelect) {
    tendencySelect.onchange = () => {
      if (window.refreshDisplayWithSortAndFilter) {
        window.refreshDisplayWithSortAndFilter();
      }
    };
  }
  
  if (statusSelect) {
    statusSelect.onchange = () => {
      if (window.refreshDisplayWithSortAndFilter) {
        window.refreshDisplayWithSortAndFilter();
      }
    };
  }
  
  // 초기화 버튼
  if (resetFiltersBtn) {
    resetFiltersBtn.onclick = () => {
      if (tendencySelect) tendencySelect.value = 'all';
      if (statusSelect) statusSelect.value = 'all';
      if (window.refreshDisplayWithSortAndFilter) {
        window.refreshDisplayWithSortAndFilter();
      }
    };
  }
}

// 필터 적용 함수
function applyFilters(members, selectedProducts) {
  let filtered = members;
  
  // 상품 필터링
  if (selectedProducts && selectedProducts.length > 0) {
    filtered = members.map(member => {
      const filteredProductNames = member.productNames.filter(pn => selectedProducts.includes(pn));
      
      if (filteredProductNames.length === 0) {
        return null;
      }
      
      let filteredTotalPeriod = 0;
      if (member.productPeriodMap) {
        selectedProducts.forEach(productName => {
          if (member.productPeriodMap[productName]) {
            const period = parsePeriodToNumber(member.productPeriodMap[productName]);
            filteredTotalPeriod += period;
          }
        });
      }
      
      return {
        ...member,
        productNames: filteredProductNames,
        totalPeriod: String(filteredTotalPeriod)
      };
    }).filter(m => m !== null);
  }
  
  // 성향 필터링
  const tendencyFilter = document.getElementById('database-filter-tendency')?.value;
  if (tendencyFilter && tendencyFilter !== 'all') {
    const greenDays = parseInt(document.getElementById('database-green-days')?.value || '15', 10);
    const yellowDays = parseInt(document.getElementById('database-yellow-days')?.value || '30', 10);
    
    filtered = filtered.filter(member => {
      const tendency = calculateTendency(member.recentVisit, greenDays, yellowDays);
      return tendency === tendencyFilter;
    });
  }
  
  // 회원상태 필터링
  const statusFilter = document.getElementById('database-filter-status')?.value;
  if (statusFilter && statusFilter !== 'all') {
    filtered = filtered.filter(member => member.status === statusFilter);
  }
  
  return filtered;
}

// 정렬 적용 함수
function applySorting(members, column, direction) {
  if (!column) return members;
  
  const sorted = [...members].sort((a, b) => {
    let aVal, bVal;
    
    switch (column) {
      case 'name':
        aVal = (a.name || '').toLowerCase();
        bVal = (b.name || '').toLowerCase();
        break;
      case 'phone':
        aVal = (a.phone || '').replace(/[^0-9]/g, '');
        bVal = (b.phone || '').replace(/[^0-9]/g, '');
        break;
      case 'tendency':
        const greenDays = parseInt(document.getElementById('database-green-days')?.value || '15', 10);
        const yellowDays = parseInt(document.getElementById('database-yellow-days')?.value || '30', 10);
        const aTendency = calculateTendency(a.recentVisit, greenDays, yellowDays);
        const bTendency = calculateTendency(b.recentVisit, greenDays, yellowDays);
        const tendencyOrder = { 'green': 1, 'yellow': 2, 'red': 3 };
        aVal = tendencyOrder[aTendency] || 3;
        bVal = tendencyOrder[bTendency] || 3;
        break;
      case 'status':
        aVal = (a.status || '').toLowerCase();
        bVal = (b.status || '').toLowerCase();
        break;
      case 'recentVisit':
        aVal = parseDateToTimestamp(a.recentVisit);
        bVal = parseDateToTimestamp(b.recentVisit);
        break;
      case 'totalPeriod':
        aVal = parsePeriodToNumber(a.totalPeriod || '0');
        bVal = parsePeriodToNumber(b.totalPeriod || '0');
        break;
      default:
        return 0;
    }
    
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
  
  return sorted;
}

// 날짜를 타임스탬프로 변환하는 헬퍼 함수
function parseDateToTimestamp(dateStr) {
  if (!dateStr) return 0;
  
  const str = String(dateStr).trim();
  let date = null;
  
  if (str.match(/^\d{4}\.\d{2}\.\d{2}$/)) {
    const [year, month, day] = str.split('.').map(Number);
    date = new Date(year, month - 1, day);
  } else if (str.match(/^\d{4}-\d{2}-\d{2}/)) {
    date = new Date(str.split(' ')[0]);
  } else if (str.match(/^\d{4}\/\d{2}\/\d{2}/)) {
    date = new Date(str.split(' ')[0].replace(/\//g, '-'));
  }
  
  return date && !isNaN(date.getTime()) ? date.getTime() : 0;
}

// 선택된 상품명 가져오기
function getSelectedProducts() {
  const checkboxes = document.querySelectorAll('#database-product-checkboxes input[type="checkbox"]:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

// 회원 목록 표시 (필터링 적용)
function displayMembers(members, selectedProducts, applyFiltersAndSort = true) {
  const section = document.getElementById('database-members-section');
  const loading = document.getElementById('database-loading');
  const tableContainer = document.getElementById('database-table-container');
  const emptyDiv = document.getElementById('database-empty');
  const tableBody = document.getElementById('database-table-body');
  const totalCount = document.getElementById('database-total-count');
  
  section.style.display = 'block';
  loading.style.display = 'none';
  
  if (!members || members.length === 0) {
    emptyDiv.style.display = 'block';
    tableContainer.style.display = 'none';
    totalCount.textContent = '';
    return;
  }
  
  // 필터링 및 정렬 적용
  let filteredMembers = members;
  if (applyFiltersAndSort) {
    filteredMembers = applyFilters(members, selectedProducts);
    
    // 현재 정렬 상태 가져오기
    const sortableHeaders = document.querySelectorAll('.sortable');
    let currentSort = { column: null, direction: 'asc' };
    sortableHeaders.forEach(header => {
      const icon = header.querySelector('.sort-icon');
      if (icon && (icon.textContent === '↑' || icon.textContent === '↓')) {
        currentSort.column = header.getAttribute('data-sort');
        currentSort.direction = icon.textContent === '↑' ? 'asc' : 'desc';
      }
    });
    
    filteredMembers = applySorting(filteredMembers, currentSort.column, currentSort.direction);
  }
  
  if (filteredMembers.length === 0) {
    emptyDiv.style.display = 'block';
    tableContainer.style.display = 'none';
    totalCount.textContent = '';
    return;
  }
  
  totalCount.textContent = `총 ${filteredMembers.length}명`;
  emptyDiv.style.display = 'none';
  tableContainer.style.display = 'block';
  
  // 방문일 기준 가져오기
  const greenDays = parseInt(document.getElementById('database-green-days')?.value || '15', 10);
  const yellowDays = parseInt(document.getElementById('database-yellow-days')?.value || '30', 10);
  
  // 테이블 렌더링
  tableBody.innerHTML = '';
  filteredMembers.forEach(member => {
    const row = document.createElement('tr');
    row.style.borderBottom = '1px solid #eee';
    
    // 회원상태 색상
    const statusColor = member.status === '유효' ? '#1976d2' : '#d32f2f';
    const statusBg = member.status === '유효' ? '#e3f2fd' : '#ffebee';
    
    // 성향 계산 (최근 방문일 기준)
    const tendency = calculateTendency(member.recentVisit, greenDays, yellowDays);
    const tendencyColor = tendency === 'green' ? '#4caf50' : tendency === 'yellow' ? '#ffc107' : '#f44336';
    const tendencyBg = tendency === 'green' ? '#e8f5e9' : tendency === 'yellow' ? '#fff9c4' : '#ffebee';
    const tendencyText = tendency === 'green' ? 'Green' : tendency === 'yellow' ? 'Yellow' : 'Red';
    
    // 상품명 (여러 개인 경우 줄바꿈으로 구분)
    const productNamesHtml = member.productNames && member.productNames.length > 0 
      ? member.productNames.map(pn => `<div>${pn}</div>`).join('') 
      : '-';
    
    // 전체기간 (숫자로 표시)
    const totalPeriodStr = member.totalPeriod || '0';
    
    row.innerHTML = `
      <td style="padding:12px 8px;font-size:0.9rem;font-weight:500;">${member.name || '-'}</td>
      <td style="padding:12px 8px;font-size:0.9rem;">${member.phone || '-'}</td>
      <td style="padding:12px 8px;text-align:center;">
        <span style="display:inline-block;padding:4px 12px;border-radius:4px;font-size:0.85rem;font-weight:500;background:${tendencyBg};color:${tendencyColor};">
          ${tendencyText}
        </span>
      </td>
      <td style="padding:12px 8px;text-align:center;">
        <span style="display:inline-block;padding:4px 12px;border-radius:4px;font-size:0.85rem;font-weight:500;background:${statusBg};color:${statusColor};">
          ${member.status || '-'}
        </span>
      </td>
      <td style="padding:12px 8px;font-size:0.9rem;color:#666;">${member.recentVisit || '-'}</td>
      <td style="padding:12px 8px;font-size:0.9rem;color:#666;max-width:300px;line-height:1.6;">${productNamesHtml}</td>
      <td style="padding:12px 8px;text-align:right;font-size:0.9rem;font-weight:500;color:#1976d2;">${totalPeriodStr}</td>
    `;
    
    tableBody.appendChild(row);
  });
  
  // 다운로드 버튼 이벤트 설정
  setupDownloadButton(filteredMembers);
  
  // 테이블이 렌더링된 후 정렬 기능 설정
  setTimeout(() => {
    setupSorting();
  }, 100);
}

// 엑셀 다운로드 버튼 설정
function setupDownloadButton(members) {
  const downloadBtn = document.getElementById('database-download-excel-btn');
  if (!downloadBtn) return;
  
  // 기존 이벤트 제거 후 새로 추가
  const newBtn = downloadBtn.cloneNode(true);
  downloadBtn.parentNode.replaceChild(newBtn, downloadBtn);
  
  newBtn.onclick = () => {
    downloadToExcel(members);
  };
}

// 엑셀 파일 다운로드 함수
function downloadToExcel(members) {
  if (!members || members.length === 0) {
    alert('다운로드할 데이터가 없습니다.');
    return;
  }
  
  // 방문일 기준 가져오기
  const greenDays = parseInt(document.getElementById('database-green-days')?.value || '15', 10);
  const yellowDays = parseInt(document.getElementById('database-yellow-days')?.value || '30', 10);
  
  // CSV 형식으로 변환
  const headers = ['회원 이름', '연락처', '성향', '회원상태', '최근방문일', '상품명', '전체기간'];
  let csv = '\uFEFF'; // UTF-8 BOM 추가 (한글 깨짐 방지)
  csv += headers.join(',') + '\n';
  
  members.forEach(member => {
    // 성향 계산
    const tendency = calculateTendency(member.recentVisit, greenDays, yellowDays);
    const tendencyText = tendency === 'green' ? 'Green' : tendency === 'yellow' ? 'Yellow' : 'Red';
    
    // 상품명 (여러 개인 경우 줄바꿈 대신 쉼표로 구분)
    const productNamesStr = member.productNames && member.productNames.length > 0 
      ? member.productNames.join(' / ') 
      : '-';
    
    // 전체기간
    const totalPeriodStr = member.totalPeriod || '0';
    
    // CSV 행 생성 (쉼표나 따옴표가 포함된 경우 처리)
    const row = [
      `"${(member.name || '').replace(/"/g, '""')}"`,
      `"${(member.phone || '').replace(/"/g, '""')}"`,
      `"${tendencyText}"`,
      `"${(member.status || '').replace(/"/g, '""')}"`,
      `"${(member.recentVisit || '').replace(/"/g, '""')}"`,
      `"${productNamesStr.replace(/"/g, '""')}"`,
      `"${totalPeriodStr.replace(/"/g, '""')}"`
    ];
    
    csv += row.join(',') + '\n';
  });
  
  // Blob 생성 및 다운로드
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  // 파일명 생성 (현재 날짜 포함)
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const filename = `회원정보_${dateStr}.csv`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 성향 계산 함수 (최근 방문일 기준)
function calculateTendency(recentVisit, greenDays, yellowDays) {
  if (!recentVisit) {
    return 'red'; // 방문일이 없으면 red
  }
  
  // 날짜 파싱 (다양한 형식 지원)
  let visitDate = null;
  const dateStr = String(recentVisit).trim();
  
  // YYYY.MM.DD 형식
  if (dateStr.match(/^\d{4}\.\d{2}\.\d{2}$/)) {
    const [year, month, day] = dateStr.split('.').map(Number);
    visitDate = new Date(year, month - 1, day);
  }
  // YYYY-MM-DD 형식
  else if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    visitDate = new Date(dateStr.split(' ')[0]);
  }
  // YYYY/MM/DD 형식
  else if (dateStr.match(/^\d{4}\/\d{2}\/\d{2}/)) {
    visitDate = new Date(dateStr.split(' ')[0].replace(/\//g, '-'));
  }
  
  if (!visitDate || isNaN(visitDate.getTime())) {
    return 'red'; // 날짜 파싱 실패 시 red
  }
  
  // 오늘 날짜 (한국 시간 기준)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  visitDate.setHours(0, 0, 0, 0);
  
  // 경과 일수 계산
  const diffTime = today.getTime() - visitDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= greenDays) {
    return 'green';
  } else if (diffDays <= yellowDays) {
    return 'yellow';
  } else {
    return 'red';
  }
}

// 기간 문자열을 숫자로 변환하는 헬퍼 함수
function parsePeriodToNumber(periodStr) {
  if (!periodStr) return 0;
  const str = String(periodStr).trim();
  const match = str.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
}
