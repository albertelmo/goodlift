// 매출 탭 (햄버거 메뉴용) - DB 매출 데이터 월별 조회/표시
export const sales = {
  render
};

let state = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1, // 1-12
  yearMonth: null // 계산된 값 (YYYY-MM)
};

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNumber(num) {
  return String(num || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// 금액 입력 필드 포맷팅 함수 (천 단위 구분자 추가)
function formatAmountInput(input) {
  // 숫자만 추출
  const value = input.value.replace(/[^\d]/g, '');
  // 천 단위 구분자 추가
  if (value) {
    input.value = parseInt(value).toLocaleString('ko-KR');
  } else {
    input.value = '';
  }
}

// 금액 문자열을 숫자로 변환 (쉼표 제거)
function parseAmount(str) {
  return parseInt(str.replace(/[^\d]/g, '')) || 0;
}

function getYearMonth() {
  const monthStr = String(state.month).padStart(2, '0');
  return `${state.year}-${monthStr}`;
}

function render(root) {
  if (!root) return;
  
  state.yearMonth = getYearMonth();

  root.innerHTML = `
    <div style="padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
        <h3 style="margin:0;color:#1976d2;font-size:1.2rem;">💹 매출</h3>
        <div style="display:flex;align-items:center;gap:10px;position:relative;">
          <button id="sales-add-btn" style="background:#1976d2;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;font-weight:600;">추가</button>
          <button id="sales-month-prev" style="background:#fff;color:#1976d2;border:1px solid #1976d2;padding:4px 10px;border-radius:6px;cursor:pointer;">◀</button>
          <div id="sales-month-label" style="font-weight:700;color:#1976d2;min-width:100px;text-align:center;cursor:pointer;padding:4px 8px;border-radius:4px;user-select:none;" 
               onmouseover="this.style.background='#f0f0f0'" 
               onmouseout="this.style.background='transparent'">${state.yearMonth}</div>
          <button id="sales-month-next" style="background:#fff;color:#1976d2;border:1px solid #1976d2;padding:4px 10px;border-radius:6px;cursor:pointer;">▶</button>
          
          <!-- 연월 선택 드롭다운 -->
          <div id="sales-date-picker" style="display:none;position:absolute;top:100%;right:0;margin-top:8px;background:#fff;border:1px solid #ddd;border-radius:8px;padding:16px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:1000;min-width:280px;">
            <div style="margin-bottom:12px;">
              <label style="display:block;margin-bottom:6px;font-size:0.9rem;color:#666;font-weight:600;">연도</label>
              <select id="sales-year-select" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.95rem;">
                ${Array.from({length: 20}, (_, i) => {
                  const year = new Date().getFullYear() - 10 + i;
                  return `<option value="${year}" ${year === state.year ? 'selected' : ''}>${year}년</option>`;
                }).join('')}
              </select>
            </div>
            <div style="margin-bottom:12px;">
              <label style="display:block;margin-bottom:6px;font-size:0.9rem;color:#666;font-weight:600;">월</label>
              <select id="sales-month-select" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.95rem;">
                ${Array.from({length: 12}, (_, i) => {
                  const month = i + 1;
                  return `<option value="${month}" ${month === state.month ? 'selected' : ''}>${month}월</option>`;
                }).join('')}
              </select>
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
              <button id="sales-date-picker-cancel" style="background:#eee;color:#333;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:0.9rem;">취소</button>
              <button id="sales-date-picker-apply" style="background:#1976d2;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:0.9rem;">적용</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 엑셀 파일 업로드 영역 -->
      <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin-bottom:20px;border:2px dashed #ddd;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div style="font-size:0.95rem;color:#666;font-weight:600;">
            매출 엑셀 파일 업로드 (시트별 연월 자동 인식)
          </div>
          <form id="sales-upload-form" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex:1;min-width:0;">
            <div style="flex:1;min-width:200px;">
              <input type="file" id="sales-file-input" accept=".xlsx,.xls" required
                     style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;">
            </div>
            <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:0.9rem;white-space:nowrap;">
              파일 업로드
            </button>
          </form>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px;">
          <div id="sales-upload-result" style="min-height:20px;font-size:0.85rem;flex:1;"></div>
          <button id="sales-clear-all-btn" style="background:#d32f2f;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:0.9rem;white-space:nowrap;">
            🗑️ 전체 삭제
          </button>
        </div>
      </div>

      <div style="background:#fff;border:1px solid #eee;border-radius:8px;padding:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
          <div style="font-weight:600;color:#333;font-size:0.9rem;">매출 내역</div>
          <div style="display:flex;align-items:center;gap:8px;">
            <div id="sales-total" style="color:#666;font-size:0.8rem;"></div>
            <input id="sales-search" placeholder="회원명 검색" style="padding:5px 8px;border:1px solid #ddd;border-radius:6px;min-width:180px;font-size:0.85rem;" />
          </div>
        </div>
        <div id="sales-detail-loading" style="text-align:center;color:#888;padding:30px;font-size:0.85rem;">불러오는 중...</div>
        <div id="sales-detail-empty" style="display:none;text-align:center;color:#888;padding:30px;font-size:0.85rem;">해당 월에 매출 데이터가 없습니다.</div>
        <div id="sales-detail" style="display:none;">
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;min-width:700px;font-size:0.8rem;">
              <thead>
                <tr style="background:#f8f9fa;border-bottom:1px solid #dee2e6;">
                  <th style="padding:6px 6px;text-align:left;white-space:nowrap;font-weight:600;color:#495057;font-size:0.8rem;">날짜</th>
                  <th style="padding:6px 6px;text-align:left;white-space:nowrap;font-weight:600;color:#495057;font-size:0.8rem;">회원명</th>
                  <th style="padding:6px 6px;text-align:center;white-space:nowrap;font-weight:600;color:#495057;font-size:0.8rem;width:40px;">신규</th>
                  <th style="padding:6px 6px;text-align:left;font-weight:600;color:#495057;font-size:0.8rem;">회원권</th>
                  <th style="padding:6px 6px;text-align:left;white-space:nowrap;font-weight:600;color:#495057;font-size:0.8rem;">결제방법</th>
                  <th style="padding:6px 6px;text-align:right;white-space:nowrap;font-weight:600;color:#495057;font-size:0.8rem;">금액</th>
                  <th style="padding:6px 6px;text-align:left;font-weight:600;color:#495057;font-size:0.8rem;">비고</th>
                </tr>
              </thead>
              <tbody id="sales-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  root.querySelector('#sales-month-prev').onclick = () => {
    state.month -= 1;
    if (state.month < 1) {
      state.month = 12;
      state.year -= 1;
    }
    render(root);
  };
  root.querySelector('#sales-month-next').onclick = () => {
    state.month += 1;
    if (state.month > 12) {
      state.month = 1;
      state.year += 1;
    }
    render(root);
  };
  
  // 연월 레이블 클릭 시 드롭다운 표시
  const monthLabel = root.querySelector('#sales-month-label');
  const datePicker = root.querySelector('#sales-date-picker');
  const yearSelect = root.querySelector('#sales-year-select');
  const monthSelect = root.querySelector('#sales-month-select');
  const applyBtn = root.querySelector('#sales-date-picker-apply');
  const cancelBtn = root.querySelector('#sales-date-picker-cancel');
  
  monthLabel.onclick = (e) => {
    e.stopPropagation();
    datePicker.style.display = 'block';
  };
  
  applyBtn.onclick = () => {
    state.year = parseInt(yearSelect.value);
    state.month = parseInt(monthSelect.value);
    datePicker.style.display = 'none';
    render(root);
  };
  
  cancelBtn.onclick = () => {
    datePicker.style.display = 'none';
  };
  
  // 외부 클릭 시 드롭다운 닫기
  document.addEventListener('click', (e) => {
    if (!datePicker.contains(e.target) && e.target !== monthLabel) {
      datePicker.style.display = 'none';
    }
  });

  // 엑셀 파일 업로드 처리
  const uploadForm = root.querySelector('#sales-upload-form');
  const uploadResult = root.querySelector('#sales-upload-result');
  uploadForm.onsubmit = async (e) => {
    e.preventDefault();
    const fileInput = root.querySelector('#sales-file-input');
    const file = fileInput.files[0];
    
    if (!file) {
      uploadResult.textContent = '파일을 선택해주세요.';
      uploadResult.style.color = '#d32f2f';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    uploadResult.textContent = '업로드 중...';
    uploadResult.style.color = '#1976d2';

    try {
      const res = await fetch('/api/sales/upload-excel', {
        method: 'POST',
        body: formData
      });

      const result = await res.json();

      if (res.ok) {
        uploadResult.style.color = '#4caf50';
        const summary = result.summary || {};
        let message = `업로드 완료! 총 ${summary.totalSaved || 0}건 저장되었습니다.`;
        if (result.results && result.results.length > 0) {
          message += '\n\n처리된 시트:';
          result.results.forEach(r => {
            message += `\n- ${r.sheetName} (${r.yearMonth}): ${r.savedCount}건`;
          });
        }
        uploadResult.textContent = message;
        uploadResult.style.whiteSpace = 'pre-line';
        fileInput.value = '';
        // 상세 데이터 새로고침
        loadMonthDetail(root, state.yearMonth);
      } else {
        uploadResult.style.color = '#d32f2f';
        uploadResult.textContent = result.message || '업로드에 실패했습니다.';
      }
    } catch (error) {
      uploadResult.style.color = '#d32f2f';
      uploadResult.textContent = '업로드 중 오류가 발생했습니다.';
      console.error('[Sales] 업로드 오류:', error);
    }
  };

  // 전체 삭제 버튼 처리
  const clearAllBtn = root.querySelector('#sales-clear-all-btn');
  clearAllBtn.onclick = async () => {
    if (!confirm('⚠️ 정말로 모든 매출 데이터를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
      return;
    }
    
    // 한 번 더 확인
    if (!confirm('⚠️ 최종 확인: 모든 매출 데이터가 영구적으로 삭제됩니다.\n\n정말 삭제하시겠습니까?')) {
      return;
    }

    clearAllBtn.disabled = true;
    clearAllBtn.textContent = '삭제 중...';
    clearAllBtn.style.opacity = '0.6';

    try {
      const username = localStorage.getItem('username');
      const res = await fetch('/api/sales/all', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUser: username })
      });

      const result = await res.json();

      if (res.ok) {
        uploadResult.style.color = '#4caf50';
        uploadResult.textContent = `✅ 모든 매출 데이터가 삭제되었습니다. (${result.deletedCount || 0}건)`;
        // 상세 데이터 새로고침
        loadMonthDetail(root, state.yearMonth);
      } else {
        uploadResult.style.color = '#d32f2f';
        uploadResult.textContent = result.message || '삭제에 실패했습니다.';
      }
    } catch (error) {
      uploadResult.style.color = '#d32f2f';
      uploadResult.textContent = '삭제 중 오류가 발생했습니다.';
      console.error('[Sales] 전체 삭제 오류:', error);
    } finally {
      clearAllBtn.disabled = false;
      clearAllBtn.textContent = '🗑️ 전체 삭제';
      clearAllBtn.style.opacity = '1';
    }
  };

  // 추가 버튼 클릭 이벤트
  const addBtn = root.querySelector('#sales-add-btn');
  if (addBtn) {
    addBtn.onclick = () => {
      openSalesAddModal(root);
    };
  }

  loadMonthDetail(root, state.yearMonth);
}

async function loadMonthDetail(root, yearMonth) {
  const loadingEl = root.querySelector('#sales-detail-loading');
  const emptyEl = root.querySelector('#sales-detail-empty');
  const detailEl = root.querySelector('#sales-detail');
  const tbody = root.querySelector('#sales-tbody');
  const totalEl = root.querySelector('#sales-total');
  const searchEl = root.querySelector('#sales-search');

  loadingEl.style.display = 'block';
  emptyEl.style.display = 'none';
  detailEl.style.display = 'none';

  try {
    const resp = await fetch(`/api/sales?yearMonth=${encodeURIComponent(yearMonth)}`);
    const data = await resp.json();
    const rows = (data && data.sales) ? data.sales : [];
    const summary = data.summary || {};

    const renderRows = (filterText = '') => {
      const q = filterText.trim().toLowerCase();
      const filtered = q
        ? rows.filter(r =>
            String(r.memberName || '').toLowerCase().includes(q)
          )
        : rows;

      totalEl.textContent = `총 ${filtered.length}건 | 합계: ${formatNumber(summary.totalAmount)}원`;
      tbody.innerHTML = filtered.map((r, idx) => {
        // 날짜 처리: 타임존 변환 방지
        let dateStr = '';
        if (r.date) {
          if (typeof r.date === 'string' && r.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // 이미 YYYY-MM-DD 형식
            dateStr = r.date;
          } else {
            // Date 객체나 타임존 포함 문자열인 경우
            const date = new Date(r.date);
            if (!isNaN(date.getTime())) {
              // 로컬 시간 기준으로 날짜 추출 (UTC 변환 방지)
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              dateStr = `${year}-${month}-${day}`;
            }
          }
        }
        const isNewText = r.isNew ? 'O' : '';
        const rowBg = idx % 2 === 0 ? '#fff' : '#f8f9fa';
        // 데이터를 data 속성에 JSON으로 저장
        const rowData = JSON.stringify({
          id: r.id,
          date: dateStr,
          memberName: r.memberName || '',
          isNew: r.isNew,
          membership: r.membership || '',
          paymentMethod: r.paymentMethod || '',
          amount: r.amount,
          notes: r.notes || ''
        });
        return `
          <tr class="sales-row" style="border-bottom:1px solid #e9ecef;background:${rowBg};cursor:pointer;" 
              data-sale='${rowData.replace(/'/g, '&#39;')}'>
            <td style="padding:5px 6px;white-space:nowrap;color:#495057;font-size:0.8rem;">${escapeHtml(dateStr)}</td>
            <td style="padding:5px 6px;white-space:nowrap;color:#212529;font-weight:500;font-size:0.8rem;">${escapeHtml(r.memberName || '')}</td>
            <td style="padding:5px 6px;text-align:center;white-space:nowrap;color:#28a745;font-weight:600;font-size:0.8rem;">${escapeHtml(isNewText)}</td>
            <td style="padding:5px 6px;color:#495057;font-size:0.8rem;">${escapeHtml(r.membership || '')}</td>
            <td style="padding:5px 6px;white-space:nowrap;color:#495057;font-size:0.8rem;">${escapeHtml(r.paymentMethod || '')}</td>
            <td style="padding:5px 6px;text-align:right;white-space:nowrap;font-weight:600;color:${r.amount < 0 ? '#dc3545' : '#212529'};font-size:0.8rem;">
              ${r.amount < 0 ? '-' : ''}${formatNumber(Math.abs(r.amount))}원
            </td>
            <td style="padding:5px 6px;color:#6c757d;font-size:0.75rem;">${escapeHtml(r.notes || '')}</td>
          </tr>
        `;
      }).join('');
      
      // 행 클릭 이벤트 바인딩
      tbody.querySelectorAll('.sales-row').forEach(row => {
        row.onclick = (e) => {
          e.stopPropagation();
          try {
            const saleData = JSON.parse(row.getAttribute('data-sale'));
            openSalesEditModal(root, saleData);
          } catch (err) {
            console.error('[Sales] 행 데이터 파싱 오류:', err);
          }
        };
      });
    };

    renderRows(searchEl.value || '');
    searchEl.oninput = () => renderRows(searchEl.value || '');
    
    // 모달 이벤트 리스너 설정
    setupEditModal(root);

    loadingEl.style.display = 'none';
    if (rows.length === 0) {
      emptyEl.style.display = 'block';
    } else {
      detailEl.style.display = 'block';
    }
  } catch (e) {
    loadingEl.style.display = 'none';
    emptyEl.style.display = 'block';
    emptyEl.textContent = '데이터를 불러오지 못했습니다.';
    detailEl.style.display = 'none';
    console.error('[Sales] 월별 상세 로드 오류:', e);
  }
}

// 매출 수정 모달 열기
function openSalesEditModal(root, saleData) {
  const modal = document.getElementById('sales-edit-modal');
  const modalBg = document.getElementById('sales-edit-modal-bg');
  const form = document.getElementById('sales-edit-form');
  const resultEl = document.getElementById('sales-edit-result');
  
  if (!modal || !form) {
    console.error('[Sales] 모달 요소를 찾을 수 없습니다.');
    return;
  }
  
  // 데이터 설정
  // 날짜 처리: Date 객체나 타임존 포함 문자열을 YYYY-MM-DD 형식으로 변환
  let dateValue = saleData.date || '';
  if (dateValue) {
    // 이미 YYYY-MM-DD 형식이면 그대로 사용
    if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
      dateValue = dateValue;
    } else {
      // Date 객체나 다른 형식이면 변환
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        // 로컬 시간 기준으로 날짜 추출 (타임존 변환 방지)
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        dateValue = `${year}-${month}-${day}`;
      } else {
        dateValue = '';
      }
    }
  }
  document.getElementById('sales-edit-date').value = dateValue;
  document.getElementById('sales-edit-member-name').value = saleData.memberName || '';
  document.getElementById('sales-edit-is-new').checked = saleData.isNew || false;
  document.getElementById('sales-edit-membership').value = saleData.membership || '';
  document.getElementById('sales-edit-payment-method').value = saleData.paymentMethod || '';
  // 금액을 천 단위 포맷으로 표시
  const editAmountEl = document.getElementById('sales-edit-amount');
  editAmountEl.value = saleData.amount ? formatNumber(saleData.amount) : '';
  document.getElementById('sales-edit-notes').value = saleData.notes || '';
  
  // ID 저장
  form.dataset.saleId = saleData.id;
  
  resultEl.textContent = '';
  resultEl.style.color = '';
  modal.style.display = 'block';
  modalBg.style.display = 'block';
}

// 모달 이벤트 리스너 설정 (한 번만 실행)
let modalSetupDone = false;

function setupEditModal(root) {
  if (modalSetupDone) return; // 이미 설정되었으면 스킵
  modalSetupDone = true;
  
  const modal = document.getElementById('sales-edit-modal');
  const modalBg = document.getElementById('sales-edit-modal-bg');
  const form = document.getElementById('sales-edit-form');
  const cancelBtn = document.getElementById('sales-edit-cancel-btn');
  const deleteBtn = document.getElementById('sales-edit-delete-btn');
  const resultEl = document.getElementById('sales-edit-result');
  
  if (!modal || !form || !cancelBtn || !deleteBtn) {
    console.error('[Sales] 모달 요소를 찾을 수 없습니다.');
    return;
  }
  
  // 금액 입력 필드에 천 단위 포맷팅 이벤트 리스너 추가
  const editAmountInput = document.getElementById('sales-edit-amount');
  if (editAmountInput) {
    editAmountInput.addEventListener('input', function() {
      formatAmountInput(this);
    });
  }
  
  // 취소 버튼
  cancelBtn.onclick = () => {
    modal.style.display = 'none';
    modalBg.style.display = 'none';
    form.reset();
    resultEl.textContent = '';
  };
  
  // 배경 클릭 시 닫기
  modalBg.onclick = () => {
    modal.style.display = 'none';
    modalBg.style.display = 'none';
    form.reset();
    resultEl.textContent = '';
  };
  
  // 폼 제출 (수정)
  form.onsubmit = async (e) => {
    e.preventDefault();
    const saleId = parseInt(form.dataset.saleId);
    if (!saleId) return;
    
    const saleData = {
      date: document.getElementById('sales-edit-date').value,
      memberName: document.getElementById('sales-edit-member-name').value.trim(),
      isNew: document.getElementById('sales-edit-is-new').checked,
      membership: document.getElementById('sales-edit-membership').value.trim() || null,
      paymentMethod: document.getElementById('sales-edit-payment-method').value || null,
      amount: parseAmount(document.getElementById('sales-edit-amount').value),
      notes: document.getElementById('sales-edit-notes').value.trim() || null,
      currentUser: localStorage.getItem('username')
    };
    
    try {
      const res = await fetch(`/api/sales/${saleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(saleData)
      });
      
      const result = await res.json();
      
      if (res.ok) {
        resultEl.style.color = '#4caf50';
        resultEl.textContent = '매출 내역이 수정되었습니다.';
        setTimeout(() => {
          modal.style.display = 'none';
          modalBg.style.display = 'none';
          // 데이터 새로고침
          loadMonthDetail(root, state.yearMonth);
        }, 1000);
      } else {
        resultEl.style.color = '#dc3545';
        resultEl.textContent = result.message || '수정에 실패했습니다.';
      }
    } catch (error) {
      resultEl.style.color = '#dc3545';
      resultEl.textContent = '수정 중 오류가 발생했습니다.';
      console.error('[Sales] 수정 오류:', error);
    }
  };
  
  // 삭제 버튼
  deleteBtn.onclick = async () => {
    const saleId = parseInt(form.dataset.saleId);
    if (!saleId) return;
    
    if (!confirm('정말로 이 매출 내역을 삭제하시겠습니까?')) {
      return;
    }
    
    try {
      const res = await fetch(`/api/sales/${saleId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentUser: localStorage.getItem('username') })
      });
      
      const result = await res.json();
      
      if (res.ok) {
        resultEl.style.color = '#4caf50';
        resultEl.textContent = '매출 내역이 삭제되었습니다.';
        setTimeout(() => {
          modal.style.display = 'none';
          modalBg.style.display = 'none';
          // 데이터 새로고침
          loadMonthDetail(root, state.yearMonth);
        }, 1000);
      } else {
        resultEl.style.color = '#dc3545';
        resultEl.textContent = result.message || '삭제에 실패했습니다.';
      }
    } catch (error) {
      resultEl.style.color = '#dc3545';
      resultEl.textContent = '삭제 중 오류가 발생했습니다.';
      console.error('[Sales] 삭제 오류:', error);
    }
  };
}

// 매출 추가 모달 열기
function openSalesAddModal(root) {
  const modal = document.getElementById('sales-add-modal');
  const modalBg = document.getElementById('sales-add-modal-bg');
  const form = document.getElementById('sales-add-form');
  const resultEl = document.getElementById('sales-add-result');
  
  if (!modal || !form) {
    console.error('[Sales] 추가 모달 요소를 찾을 수 없습니다.');
    return;
  }
  
  // 폼 초기화
  form.reset();
  resultEl.textContent = '';
  resultEl.style.color = '';
  
  // 오늘 날짜로 기본값 설정
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  document.getElementById('sales-add-date').value = `${year}-${month}-${day}`;
  
  // 모달 표시
  modal.style.display = 'block';
  modalBg.style.display = 'block';
  
  // 모달 이벤트 리스너 설정 (한 번만)
  if (!form.dataset.setupDone) {
    setupAddModal(root);
    form.dataset.setupDone = 'true';
  }
}

// 추가 모달 이벤트 리스너 설정
function setupAddModal(root) {
  const modal = document.getElementById('sales-add-modal');
  const modalBg = document.getElementById('sales-add-modal-bg');
  const form = document.getElementById('sales-add-form');
  const resultEl = document.getElementById('sales-add-result');
  const cancelBtn = document.getElementById('sales-add-cancel-btn');
  
  if (!modal || !form) return;
  
  // 금액 입력 필드에 천 단위 포맷팅 이벤트 리스너 추가
  const addAmountInput = document.getElementById('sales-add-amount');
  if (addAmountInput) {
    addAmountInput.addEventListener('input', function() {
      formatAmountInput(this);
    });
  }
  
  // 취소 버튼 클릭 시 닫기
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      modal.style.display = 'none';
      modalBg.style.display = 'none';
      form.reset();
      resultEl.textContent = '';
    };
  }
  
  // 배경 클릭 시 닫기
  modalBg.onclick = () => {
    modal.style.display = 'none';
    modalBg.style.display = 'none';
    form.reset();
    resultEl.textContent = '';
  };
  
  // 폼 제출 (추가)
  form.onsubmit = async (e) => {
    e.preventDefault();
    
    const saleData = {
      date: document.getElementById('sales-add-date').value,
      memberName: document.getElementById('sales-add-member-name').value.trim(),
      isNew: document.getElementById('sales-add-is-new').checked,
      membership: document.getElementById('sales-add-membership').value.trim() || null,
      paymentMethod: document.getElementById('sales-add-payment-method').value || null,
      amount: parseAmount(document.getElementById('sales-add-amount').value),
      notes: document.getElementById('sales-add-notes').value.trim() || null,
      currentUser: localStorage.getItem('username')
    };
    
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(saleData)
      });
      
      const result = await res.json();
      
      if (res.ok) {
        resultEl.style.color = '#4caf50';
        resultEl.textContent = result.message || '매출 내역이 추가되었습니다.';
        
        // 1초 후 모달 닫고 데이터 새로고침
        setTimeout(() => {
          modal.style.display = 'none';
          modalBg.style.display = 'none';
          form.reset();
          resultEl.textContent = '';
          // 데이터 새로고침
          loadMonthDetail(root, state.yearMonth);
        }, 1000);
      } else {
        resultEl.style.color = '#dc3545';
        resultEl.textContent = result.message || '추가에 실패했습니다.';
      }
    } catch (error) {
      resultEl.style.color = '#dc3545';
      resultEl.textContent = '추가 중 오류가 발생했습니다.';
      console.error('[Sales] 추가 오류:', error);
    }
  };
}
