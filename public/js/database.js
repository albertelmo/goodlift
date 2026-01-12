// 데이터베이스 관리 모듈
export const database = {
  render
};

function render(container) {
  if (!container) return;
  
  // 탭 전환 시 모든 정보 초기화
  window.databaseAllMembers = null;
  window.databaseFilteredMembers = null;
  window.databaseAllProductNames = null;
  window.databaseAllSales = null;
  window.databaseFilteredSales = null;
  window.databaseAllSalesNames = null;
  
  container.innerHTML = `
    <div style="padding:20px;">
      <h3 style="margin-top:0;margin-bottom:20px;color:#1976d2;font-size:1.2rem;">🗄️ 데이터베이스 관리</h3>
      
      <!-- 파일 업로드 영역 -->
      <div style="background:#f5f5f5;padding:10px 12px;border-radius:8px;margin-bottom:12px;border:2px dashed #ddd;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div style="font-size:0.9rem;color:#666;font-weight:600;white-space:nowrap;">
            회원정보 엑셀 파일 업로드
          </div>
          <form id="database-upload-form" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex:1;min-width:0;">
            <div style="flex:1;min-width:200px;">
              <input type="file" id="database-file-input" accept=".xlsx,.xls" required
                     style="width:100%;padding:5px;border:1px solid #ddd;border-radius:4px;font-size:0.85rem;">
            </div>
            <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:5px 14px;border-radius:4px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">
              파일 업로드
            </button>
          </form>
        </div>
        <div id="database-upload-result" style="min-height:16px;margin-top:6px;font-size:0.85rem;"></div>
      </div>
      
      <!-- 매출정보 파일 업로드 영역 -->
      <div style="background:#f5f5f5;padding:10px 12px;border-radius:8px;margin-bottom:12px;border:2px dashed #ddd;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div style="font-size:0.9rem;color:#666;font-weight:600;white-space:nowrap;">
            매출정보 엑셀 파일 업로드
          </div>
          <form id="database-sales-upload-form" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex:1;min-width:0;">
            <div style="flex:1;min-width:200px;">
              <input type="file" id="database-sales-file-input" accept=".xlsx,.xls" required
                     style="width:100%;padding:5px;border:1px solid #ddd;border-radius:4px;font-size:0.85rem;">
            </div>
            <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:5px 14px;border-radius:4px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">
              파일 업로드
            </button>
          </form>
        </div>
        <div id="database-sales-upload-result" style="min-height:16px;margin-top:6px;font-size:0.85rem;"></div>
      </div>
      
      <!-- 저장된 정보 불러오기 영역 -->
      <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin-bottom:20px;border:2px dashed #ddd;">
        <!-- 헤더, 데이터 타입 선택, 연도 네비게이션 -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:12px;">
          <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
            <div style="font-size:0.95rem;color:#666;font-weight:600;">
              저장된 정보 불러오기
            </div>
            <button id="database-renewal-status-btn" style="background:#4caf50;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:0.9rem;white-space:nowrap;">
              등록 현황
            </button>
            <!-- 데이터 타입 선택 -->
            <div style="display:flex;gap:12px;align-items:center;">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.9rem;">
                <input type="radio" name="database-data-type" value="members" checked style="cursor:pointer;">
                <span>회원정보</span>
              </label>
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.9rem;">
                <input type="radio" name="database-data-type" value="sales" style="cursor:pointer;">
                <span>매출정보</span>
              </label>
            </div>
          </div>
          <!-- 연도 네비게이션 -->
          <div style="display:flex;align-items:center;gap:12px;">
            <button id="database-year-prev-btn" style="background:#fff;color:#1976d2;border:1px solid #1976d2;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:0.85rem;">◀</button>
            <span id="database-current-year" style="font-size:1rem;font-weight:600;color:#1976d2;min-width:60px;text-align:center;">2024</span>
            <button id="database-year-next-btn" style="background:#fff;color:#1976d2;border:1px solid #1976d2;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:0.85rem;">▶</button>
          </div>
        </div>
        
        <!-- 센터/월 목록 -->
        <div id="database-snapshots-list" style="display:none;">
          <!-- 센터별로 그룹화된 월 목록이 여기에 표시됩니다 -->
        </div>
        
        <div id="database-snapshots-loading" style="text-align:center;padding:16px;color:#888;font-size:0.85rem;">데이터를 불러오는 중...</div>
        <div id="database-snapshots-empty" style="display:none;text-align:center;padding:16px;color:#888;font-size:0.85rem;">해당 연도에 저장된 데이터가 없습니다.</div>
        <div id="database-load-result" style="min-height:20px;margin-top:8px;font-size:0.85rem;"></div>
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
      
      <!-- 매출 이름 선택 영역 -->
      <div id="database-sales-name-select-section" style="display:none;background:#f5f5f5;padding:20px;border-radius:8px;margin-bottom:20px;">
        <div style="margin-bottom:12px;font-size:0.95rem;color:#666;">
          <strong>표시할 매출 이름 선택</strong>
        </div>
        <div id="database-sales-name-checkboxes" style="display:flex;flex-wrap:wrap;gap:12px;">
          <!-- 매출 이름 체크박스가 여기에 동적으로 생성됩니다 -->
        </div>
        <div style="margin-top:12px;">
          <button id="database-apply-sales-filter-btn" style="background:#1976d2;color:#fff;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;font-size:0.95rem;">
            필터 적용
          </button>
          <button id="database-select-all-sales-btn" style="background:#fff;color:#1976d2;border:1px solid #1976d2;padding:8px 20px;border-radius:4px;cursor:pointer;font-size:0.95rem;margin-left:8px;">
            전체 선택
          </button>
          <button id="database-deselect-all-sales-btn" style="background:#fff;color:#1976d2;border:1px solid #1976d2;padding:8px 20px;border-radius:4px;cursor:pointer;font-size:0.95rem;margin-left:8px;">
            전체 해제
          </button>
        </div>
      </div>

      <!-- 신규등록 현황 결과 섹션 -->
      <div id="database-new-registration-results-section" style="display:none;background:#f5f5f5;padding:16px;border-radius:8px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
          <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
            <h4 style="margin:0;color:#333;font-size:1.1rem;">신규등록 현황</h4>
            <div id="database-new-registration-stats" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:0.85rem;color:#666;">
              <!-- 통계가 여기에 표시됩니다 -->
            </div>
          </div>
          <button id="database-new-registration-download-excel-btn" style="background:#4caf50;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:0.9rem;white-space:nowrap;">
            📥 엑셀 다운로드
          </button>
        </div>
        <div id="database-new-registration-results-table" style="overflow-x:auto;">
          <!-- 결과 테이블이 여기에 표시됩니다 -->
        </div>
      </div>
      
      <!-- 재등록 현황 결과 섹션 -->
      <div id="database-renewal-results-section" style="display:none;background:#f5f5f5;padding:16px;border-radius:8px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
          <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
            <h4 style="margin:0;color:#333;font-size:1.1rem;">재등록 현황</h4>
            <div id="database-renewal-stats" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:0.85rem;color:#666;">
              <!-- 통계가 여기에 표시됩니다 -->
            </div>
          </div>
          <button id="database-renewal-download-excel-btn" style="background:#4caf50;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:0.9rem;white-space:nowrap;">
            📥 엑셀 다운로드
          </button>
        </div>
        <div id="database-renewal-results-table" style="overflow-x:auto;">
          <!-- 결과 테이블이 여기에 표시됩니다 -->
        </div>
      </div>
      
      <!-- 매출 정보 목록 영역 -->
      <div id="database-sales-section" style="display:none;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h4 style="margin:0;color:#333;font-size:1.1rem;">파싱된 매출 정보</h4>
          <div style="display:flex;gap:12px;align-items:center;">
            <div id="database-sales-total-count" style="color:#666;font-size:0.95rem;"></div>
            <button id="database-sales-download-excel-btn" style="background:#4caf50;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:0.9rem;white-space:nowrap;">
              📥 엑셀 다운로드
            </button>
            <button id="database-sales-save-btn" style="display:none;background:#4caf50;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:0.9rem;white-space:nowrap;">
              💾 DB 저장
            </button>
          </div>
        </div>
        <div id="database-sales-loading" style="text-align:center;color:#888;padding:40px;">데이터를 불러오는 중...</div>
        <div id="database-sales-table-container" style="display:none;">
          <div style="overflow-x:auto;">
            <table id="database-sales-table" style="width:100%;border-collapse:collapse;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,0.1);min-width:600px;">
              <thead>
                <tr style="background:#f5f5f5;border-bottom:2px solid #ddd;">
                  <th class="sortable" data-sort="memberName" style="padding:12px 8px;text-align:left;font-weight:600;color:#333;font-size:0.9rem;white-space:nowrap;cursor:pointer;user-select:none;">
                    회원 이름 <span class="sort-icon">↕</span>
                  </th>
                  <th class="sortable" data-sort="phone" style="padding:12px 8px;text-align:left;font-weight:600;color:#333;font-size:0.9rem;white-space:nowrap;cursor:pointer;user-select:none;">
                    연락처 <span class="sort-icon">↕</span>
                  </th>
                  <th style="padding:12px 8px;text-align:left;font-weight:600;color:#333;font-size:0.9rem;white-space:nowrap;">매출 이름</th>
                </tr>
              </thead>
              <tbody id="database-sales-table-body">
              </tbody>
            </table>
          </div>
        </div>
        <div id="database-sales-empty" style="display:none;text-align:center;color:#888;padding:40px;background:#f9f9f9;border-radius:8px;">
          파싱된 데이터가 없습니다.
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
            <button id="database-save-btn" style="display:none;background:#4caf50;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:0.9rem;white-space:nowrap;">
              💾 DB 저장
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
      
      <!-- DB 저장 모달 -->
      <div id="database-save-modal-bg" style="display:none;position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
      <div id="database-save-modal" style="display:none;position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:14px;box-shadow:0 8px 32px #1976d240;min-width:400px;max-width:90vw;">
        <h3 style="margin-top:0;margin-bottom:18px;color:#1976d2;font-size:1.15rem;">💾 DB 저장</h3>
        <div class="form-row">
          <label for="database-save-center">센터 *</label>
          <select id="database-save-center" required style="flex:1;min-width:0;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.95rem;">
            <option value="">센터를 선택하세요</option>
          </select>
        </div>
        <div class="form-row">
          <label for="database-save-year-month">연도/월 *</label>
          <input type="month" id="database-save-year-month" required style="flex:1;min-width:0;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.95rem;">
        </div>
        <div id="database-save-result" style="min-height:20px;color:#d32f2f;margin-top:12px;font-size:0.9rem;"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
          <button type="button" id="database-save-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:0.95rem;">취소</button>
          <button type="button" id="database-save-submit-btn" style="background:#4caf50;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:0.95rem;">저장</button>
        </div>
      </div>
      
      <!-- 매출정보 DB 저장 모달 -->
      <div id="database-sales-save-modal-bg" style="display:none;position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
      <div id="database-sales-save-modal" style="display:none;position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:14px;box-shadow:0 8px 32px #1976d240;min-width:400px;max-width:90vw;">
        <h3 style="margin-top:0;margin-bottom:18px;color:#1976d2;font-size:1.15rem;">💾 매출정보 DB 저장</h3>
        <div class="form-row">
          <label for="database-sales-save-center">센터 *</label>
          <select id="database-sales-save-center" required style="flex:1;min-width:0;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.95rem;">
            <option value="">센터를 선택하세요</option>
          </select>
        </div>
        <div class="form-row">
          <label for="database-sales-save-year-month">연도/월 *</label>
          <input type="month" id="database-sales-save-year-month" required style="flex:1;min-width:0;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.95rem;">
        </div>
        <div id="database-sales-save-result" style="min-height:20px;color:#d32f2f;margin-top:12px;font-size:0.9rem;"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
          <button type="button" id="database-sales-save-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:0.95rem;">취소</button>
          <button type="button" id="database-sales-save-submit-btn" style="background:#4caf50;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:0.95rem;">저장</button>
        </div>
      </div>
      
      <!-- 재등록 현황 모달 -->
      <div id="database-renewal-status-modal-bg" style="display:none;position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
      <div id="database-renewal-status-modal" style="display:none;position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:16px;border-radius:10px;box-shadow:0 8px 32px #1976d240;min-width:600px;max-width:95vw;max-height:90vh;overflow-y:auto;">
        <h3 style="margin-top:0;margin-bottom:12px;color:#1976d2;font-size:1rem;">📊 재등록 현황</h3>
        
        <!-- 회원정보 선택 -->
        <div style="margin-bottom:12px;padding:10px;background:#f5f5f5;border-radius:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
            <div style="font-size:0.85rem;font-weight:600;color:#1976d2;">회원정보 선택</div>
            <div style="display:flex;align-items:center;gap:4px;">
              <button id="database-renewal-member-year-prev-btn" style="background:#fff;color:#1976d2;border:1px solid #1976d2;padding:3px 6px;border-radius:3px;cursor:pointer;font-size:0.75rem;">◀</button>
              <span id="database-renewal-member-current-year" style="font-size:0.8rem;font-weight:600;color:#1976d2;min-width:50px;text-align:center;">2024</span>
              <button id="database-renewal-member-year-next-btn" style="background:#fff;color:#1976d2;border:1px solid #1976d2;padding:3px 6px;border-radius:3px;cursor:pointer;font-size:0.75rem;">▶</button>
            </div>
          </div>
          <div id="database-renewal-member-selection" style="margin-bottom:6px;">
            <!-- 센터/월 선택 버튼들이 여기에 표시됩니다 -->
          </div>
          <div id="database-renewal-member-selected" style="font-size:0.75rem;color:#4caf50;font-weight:600;"></div>
        </div>
        
        <!-- 매출정보 선택 -->
        <div style="margin-bottom:12px;padding:10px;background:#f5f5f5;border-radius:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
            <div style="font-size:0.85rem;font-weight:600;color:#1976d2;">매출정보 선택</div>
            <div style="display:flex;align-items:center;gap:4px;">
              <button id="database-renewal-sales-year-prev-btn" style="background:#fff;color:#1976d2;border:1px solid #1976d2;padding:3px 6px;border-radius:3px;cursor:pointer;font-size:0.75rem;">◀</button>
              <span id="database-renewal-sales-current-year" style="font-size:0.8rem;font-weight:600;color:#1976d2;min-width:50px;text-align:center;">2024</span>
              <button id="database-renewal-sales-year-next-btn" style="background:#fff;color:#1976d2;border:1px solid #1976d2;padding:3px 6px;border-radius:3px;cursor:pointer;font-size:0.75rem;">▶</button>
            </div>
          </div>
          <div id="database-renewal-sales-selection" style="margin-bottom:6px;">
            <!-- 센터/월 선택 버튼들이 여기에 표시됩니다 -->
          </div>
          <div id="database-renewal-sales-selected" style="font-size:0.75rem;color:#4caf50;font-weight:600;"></div>
        </div>
        
        <!-- 비교 버튼 -->
        <div style="margin-bottom:12px;text-align:center;">
          <button id="database-renewal-compare-btn" style="background:#4caf50;color:#fff;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;font-size:0.9rem;font-weight:600;">재등록 현황 분석</button>
        </div>
        
        <div id="database-renewal-loading" style="display:none;text-align:center;padding:12px;color:#888;font-size:0.8rem;">분석 중...</div>
        <div id="database-renewal-empty" style="display:none;text-align:center;padding:12px;color:#888;font-size:0.8rem;">선택된 데이터가 없습니다.</div>
        
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
          <button type="button" id="database-renewal-close-btn" style="background:#eee;color:#1976d2;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;">닫기</button>
        </div>
      </div>
    </div>
  `;
  
  // 이벤트 리스너 설정
  setupEventListeners(container);
}

// 다른 타입의 정보 숨기기 및 초기화 함수
function clearOtherDataType(type) {
  if (type === 'renewal') {
    // 회원정보 관련 UI 숨기기 및 초기화
    const memberSection = document.getElementById('database-member-section');
    const productSelectSection = document.getElementById('database-product-select-section');
    const visitCriteriaSection = document.getElementById('database-visit-criteria-section');
    const filterSection = document.getElementById('database-filter-section');
    const saveBtn = document.getElementById('database-save-btn');
    const uploadResult = document.getElementById('database-upload-result');
    
    if (memberSection) memberSection.style.display = 'none';
    if (productSelectSection) productSelectSection.style.display = 'none';
    if (visitCriteriaSection) visitCriteriaSection.style.display = 'none';
    if (filterSection) filterSection.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'none';
    if (uploadResult) uploadResult.textContent = '';
    
    // 매출정보 관련 UI 숨기기 및 초기화
    const salesSection = document.getElementById('database-sales-section');
    const salesNameSection = document.getElementById('database-sales-name-select-section');
    const salesFilterSection = document.getElementById('database-sales-filter-section');
    const salesSaveBtn = document.getElementById('database-sales-save-btn');
    const salesUploadResult = document.getElementById('database-sales-upload-result');
    
    if (salesSection) salesSection.style.display = 'none';
    if (salesNameSection) salesNameSection.style.display = 'none';
    if (salesFilterSection) salesFilterSection.style.display = 'none';
    if (salesSaveBtn) salesSaveBtn.style.display = 'none';
    if (salesUploadResult) salesUploadResult.textContent = '';
    
    // 회원정보 데이터 초기화
    window.databaseAllMembers = null;
    window.databaseFilteredMembers = null;
    window.databaseAllProductNames = null;
    
    // 매출정보 데이터 초기화
    window.databaseAllSales = null;
    window.databaseFilteredSales = null;
    window.databaseAllSalesNames = null;
  } else if (type === 'members') {
    // 매출정보 관련 UI 숨기기 및 초기화
    const salesSection = document.getElementById('database-sales-section');
    const salesNameSection = document.getElementById('database-sales-name-select-section');
    const salesFilterSection = document.getElementById('database-sales-filter-section');
    const salesSaveBtn = document.getElementById('database-sales-save-btn');
    const salesUploadResult = document.getElementById('database-sales-upload-result');
    
    if (salesSection) salesSection.style.display = 'none';
    if (salesNameSection) salesNameSection.style.display = 'none';
    if (salesFilterSection) salesFilterSection.style.display = 'none';
    if (salesSaveBtn) salesSaveBtn.style.display = 'none';
    if (salesUploadResult) salesUploadResult.textContent = '';
    
    // 재등록 현황 결과 숨기기
    const renewalResultsSection = document.getElementById('database-renewal-results-section');
    if (renewalResultsSection) renewalResultsSection.style.display = 'none';
    
    // 신규등록 현황 결과 숨기기
    const newRegistrationResultsSection = document.getElementById('database-new-registration-results-section');
    if (newRegistrationResultsSection) newRegistrationResultsSection.style.display = 'none';
    
    // 매출정보 데이터 초기화
    window.databaseAllSales = null;
    window.databaseFilteredSales = null;
    window.databaseAllSalesNames = null;
  } else if (type === 'sales') {
    // 회원정보 관련 UI 숨기기 및 초기화
    const memberSection = document.getElementById('database-member-section');
    const productSelectSection = document.getElementById('database-product-select-section');
    const visitCriteriaSection = document.getElementById('database-visit-criteria-section');
    const filterSection = document.getElementById('database-filter-section');
    const saveBtn = document.getElementById('database-save-btn');
    const uploadResult = document.getElementById('database-upload-result');
    
    if (memberSection) memberSection.style.display = 'none';
    if (productSelectSection) productSelectSection.style.display = 'none';
    if (visitCriteriaSection) visitCriteriaSection.style.display = 'none';
    if (filterSection) filterSection.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'none';
    if (uploadResult) uploadResult.textContent = '';
    
    // 재등록 현황 결과 숨기기
    const renewalResultsSection = document.getElementById('database-renewal-results-section');
    if (renewalResultsSection) renewalResultsSection.style.display = 'none';
    
    // 신규등록 현황 결과 숨기기
    const newRegistrationResultsSection = document.getElementById('database-new-registration-results-section');
    if (newRegistrationResultsSection) newRegistrationResultsSection.style.display = 'none';
    
    // 회원정보 데이터 초기화
    window.databaseAllMembers = null;
    window.databaseFilteredMembers = null;
    window.databaseAllProductNames = null;
  }
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
    
    // 매출정보 숨기기 및 초기화
    clearOtherDataType('members');
    
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
        
        // DB 저장 버튼 표시
        const saveBtn = document.getElementById('database-save-btn');
        if (saveBtn) {
          saveBtn.style.display = 'inline-block';
        }
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
  
  // 매출정보 파일 업로드 폼
  const salesForm = document.getElementById('database-sales-upload-form');
  const salesFileInput = document.getElementById('database-sales-file-input');
  const salesResultDiv = document.getElementById('database-sales-upload-result');
  
  if (salesForm) {
    salesForm.onsubmit = async (e) => {
      e.preventDefault();
      
      if (!salesFileInput.files || salesFileInput.files.length === 0) {
        if (salesResultDiv) {
          salesResultDiv.textContent = '파일을 선택해주세요.';
          salesResultDiv.style.color = '#d32f2f';
        }
        return;
      }
      
      const formData = new FormData();
      formData.append('file', salesFileInput.files[0]);
      
      if (salesResultDiv) {
        salesResultDiv.textContent = '업로드 중...';
        salesResultDiv.style.color = '#1976d2';
      }
      
      // 회원정보 숨기기 및 초기화
      clearOtherDataType('sales');
      
      try {
        const res = await fetch('/api/database/parse-sales-excel', {
          method: 'POST',
          body: formData
        });
        
        const result = await res.json();
        
        if (res.ok) {
          if (salesResultDiv) {
            salesResultDiv.textContent = result.message || '매출정보 파일 업로드가 완료되었습니다.';
            salesResultDiv.style.color = '#4caf50';
          }
          
          // 원본 데이터 저장 (필터링 전)
          window.databaseAllSales = result.sales || [];
          window.databaseAllSalesNames = result.allSalesNames || [];
          
          // 매출 이름 선택 UI 표시
          displaySalesNameSelectors(result.allSalesNames || []);
          
          // 필터링 기능 초기화
          setupSalesFiltering();
          
          // 초기에는 모든 매출 이름 선택된 상태로 매출 목록 표시
          displaySales(window.databaseAllSales, []);
          
          // DB 저장 버튼 표시 및 이벤트 리스너 연결
          const salesSaveBtnEl = document.getElementById('database-sales-save-btn');
          if (salesSaveBtnEl) {
            salesSaveBtnEl.style.display = 'inline-block';
            // 이벤트 리스너 연결 (버튼이 표시될 때)
            if (typeof handleSalesSaveButtonClick === 'function') {
              salesSaveBtnEl.onclick = null;
              salesSaveBtnEl.removeEventListener('click', handleSalesSaveButtonClick);
              salesSaveBtnEl.addEventListener('click', handleSalesSaveButtonClick);
            }
          }
          
          if (salesFileInput) {
            salesFileInput.value = '';
          }
        } else {
          if (salesResultDiv) {
            salesResultDiv.textContent = result.message || result.error || '업로드에 실패했습니다.';
            salesResultDiv.style.color = '#d32f2f';
          }
        }
      } catch (error) {
        console.error('매출정보 파일 업로드 오류:', error);
        if (salesResultDiv) {
          salesResultDiv.textContent = '업로드 중 오류가 발생했습니다.';
          salesResultDiv.style.color = '#d32f2f';
        }
      }
    };
  }
  
  // DB 저장 버튼 클릭
  const saveBtn = document.getElementById('database-save-btn');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      // 필터링된 멤버 사용 (없으면 전체 멤버 사용)
      const membersToSave = window.databaseFilteredMembers || window.databaseAllMembers || [];
      
      if (membersToSave.length === 0) {
        alert('저장할 데이터가 없습니다. 먼저 파일을 업로드해주세요.');
        return;
      }
      
      // 센터 목록 로드
      await loadCentersForSave();
      
      // 모달 표시
      const modal = document.getElementById('database-save-modal');
      const modalBg = document.getElementById('database-save-modal-bg');
      if (modal && modalBg) {
        modal.style.display = 'block';
        modalBg.style.display = 'block';
        document.getElementById('database-save-result').textContent = '';
        document.getElementById('database-save-year-month').value = new Date().toISOString().slice(0, 7);
      }
    };
  }

  // 센터 목록 로드 (매출정보 저장용)
  async function loadCentersForSalesSave() {
    try {
      const res = await fetch('/api/centers');
      const centers = await res.json();
      const select = document.getElementById('database-sales-save-center');
      if (select) {
        select.innerHTML = '<option value="">센터를 선택하세요</option>';
        centers.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.name;
          opt.textContent = c.name;
          select.appendChild(opt);
        });
      }
    } catch (error) {
      console.error('센터 목록 로드 오류:', error);
    }
  }

  // 매출정보 DB 저장 버튼 클릭 핸들러 함수
  async function handleSalesSaveButtonClick() {
    // 필터링된 매출 사용 (없으면 전체 매출 사용)
    const salesToSave = window.databaseFilteredSales || window.databaseAllSales || [];
    
    if (salesToSave.length === 0) {
      alert('저장할 데이터가 없습니다. 먼저 파일을 업로드해주세요.');
      return;
    }
    
    // 센터 목록 로드
    await loadCentersForSalesSave();
    
    // 모달 표시
    const modal = document.getElementById('database-sales-save-modal');
    const modalBg = document.getElementById('database-sales-save-modal-bg');
    
    if (modal && modalBg) {
      modal.style.display = 'block';
      modalBg.style.display = 'block';
      const resultDiv = document.getElementById('database-sales-save-result');
      const yearMonthInput = document.getElementById('database-sales-save-year-month');
      if (resultDiv) resultDiv.textContent = '';
      if (yearMonthInput) yearMonthInput.value = new Date().toISOString().slice(0, 7);
    } else {
      alert('모달을 찾을 수 없습니다. 페이지를 새로고침해주세요.');
    }
  }

  // 매출정보 DB 저장 버튼 클릭 (이벤트 위임 사용)
  // 버튼이 동적으로 표시되므로 이벤트 위임 사용
  const salesSection = document.getElementById('database-sales-section');
  if (salesSection) {
    salesSection.addEventListener('click', async (e) => {
      // 클릭된 요소가 버튼이거나 버튼의 자식인지 확인
      const clickedBtn = e.target.closest('#database-sales-save-btn');
      if (clickedBtn) {
        e.preventDefault();
        e.stopPropagation();
        await handleSalesSaveButtonClick();
      }
    });
  }
  
  // 버튼이 표시될 때도 직접 이벤트 리스너 연결 (이중 보험)
  // 이벤트 위임과 함께 사용하여 확실하게 작동하도록 함

  // 매출정보 저장 모달 취소 버튼
  const salesSaveCancelBtn = document.getElementById('database-sales-save-cancel-btn');
  if (salesSaveCancelBtn) {
    salesSaveCancelBtn.onclick = () => {
      const modal = document.getElementById('database-sales-save-modal');
      const modalBg = document.getElementById('database-sales-save-modal-bg');
      if (modal && modalBg) {
        modal.style.display = 'none';
        modalBg.style.display = 'none';
      }
    };
  }

  // 매출정보 저장 모달 배경 클릭
  const salesSaveModalBg = document.getElementById('database-sales-save-modal-bg');
  if (salesSaveModalBg) {
    salesSaveModalBg.onclick = () => {
      const modal = document.getElementById('database-sales-save-modal');
      if (modal) {
        modal.style.display = 'none';
        salesSaveModalBg.style.display = 'none';
      }
    };
  }

  // 매출정보 저장 모달 저장 버튼
  const salesSaveSubmitBtn = document.getElementById('database-sales-save-submit-btn');
  if (salesSaveSubmitBtn) {
    salesSaveSubmitBtn.onclick = async () => {
      const center = document.getElementById('database-sales-save-center')?.value;
      const yearMonth = document.getElementById('database-sales-save-year-month')?.value;
      const resultDiv = document.getElementById('database-sales-save-result');
      
      if (!center || !yearMonth) {
        if (resultDiv) {
          resultDiv.textContent = '센터와 연도/월을 모두 선택해주세요.';
          resultDiv.style.color = '#d32f2f';
        }
        return;
      }
      
      // 필터링된 매출 사용 (없으면 전체 매출 사용)
      const salesToSave = window.databaseFilteredSales || window.databaseAllSales || [];
      
      if (salesToSave.length === 0) {
        if (resultDiv) {
          resultDiv.textContent = '저장할 데이터가 없습니다.';
          resultDiv.style.color = '#d32f2f';
        }
        return;
      }
      
      // 기존 데이터 덮어쓰기 확인
      if (!confirm(`해당 센터(${center})의 ${yearMonth} 매출정보가 이미 있다면 덮어쓰기 됩니다.\n현재 필터링된 ${salesToSave.length}건의 데이터가 저장됩니다. 계속하시겠습니까?`)) {
        return;
      }
      
      if (resultDiv) {
        resultDiv.textContent = '저장 중...';
        resultDiv.style.color = '#1976d2';
      }
      
      try {
        const res = await fetch('/api/database/sales-snapshots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            center,
            yearMonth,
            sales: salesToSave
          })
        });
        
        const result = await res.json();
        
        if (res.ok) {
          if (resultDiv) {
            resultDiv.textContent = result.message || `매출정보 스냅샷이 저장되었습니다. (${result.savedCount}건)`;
            resultDiv.style.color = '#4caf50';
          }
          
          // 2초 후 모달 닫기
          setTimeout(() => {
            const modal = document.getElementById('database-sales-save-modal');
            const modalBg = document.getElementById('database-sales-save-modal-bg');
            if (modal && modalBg) {
              modal.style.display = 'none';
              modalBg.style.display = 'none';
            }
          }, 2000);
        } else {
          if (resultDiv) {
            resultDiv.textContent = result.message || '저장에 실패했습니다.';
            resultDiv.style.color = '#d32f2f';
          }
        }
      } catch (error) {
        console.error('매출정보 스냅샷 저장 오류:', error);
        if (resultDiv) {
          resultDiv.textContent = '저장 중 오류가 발생했습니다.';
          resultDiv.style.color = '#d32f2f';
        }
      }
    };
  }
  
  // 저장 모달 취소 버튼
  const saveCancelBtn = document.getElementById('database-save-cancel-btn');
  if (saveCancelBtn) {
    saveCancelBtn.onclick = () => {
      const modal = document.getElementById('database-save-modal');
      const modalBg = document.getElementById('database-save-modal-bg');
      if (modal && modalBg) {
        modal.style.display = 'none';
        modalBg.style.display = 'none';
      }
    };
  }
  
  // 저장 모달 배경 클릭
  const saveModalBg = document.getElementById('database-save-modal-bg');
  if (saveModalBg) {
    saveModalBg.onclick = () => {
      const modal = document.getElementById('database-save-modal');
      if (modal) {
        modal.style.display = 'none';
        saveModalBg.style.display = 'none';
      }
    };
  }
  
  // 저장 모달 저장 버튼
  const saveSubmitBtn = document.getElementById('database-save-submit-btn');
  if (saveSubmitBtn) {
    saveSubmitBtn.onclick = async () => {
      const center = document.getElementById('database-save-center')?.value;
      const yearMonth = document.getElementById('database-save-year-month')?.value;
      const resultDiv = document.getElementById('database-save-result');
      
      if (!center || !yearMonth) {
        if (resultDiv) {
          resultDiv.textContent = '센터와 연도/월을 모두 선택해주세요.';
          resultDiv.style.color = '#d32f2f';
        }
        return;
      }
      
      // 필터링된 멤버 사용 (없으면 전체 멤버 사용)
      const membersToSave = window.databaseFilteredMembers || window.databaseAllMembers || [];
      
      if (membersToSave.length === 0) {
        if (resultDiv) {
          resultDiv.textContent = '저장할 데이터가 없습니다.';
          resultDiv.style.color = '#d32f2f';
        }
        return;
      }
      
      // 기존 데이터 덮어쓰기 확인
      if (!confirm(`해당 센터(${center})의 ${yearMonth} 데이터가 이미 있다면 덮어쓰기 됩니다.\n현재 필터링된 ${membersToSave.length}명의 데이터가 저장됩니다. 계속하시겠습니까?`)) {
        return;
      }
      
      if (resultDiv) {
        resultDiv.textContent = '저장 중...';
        resultDiv.style.color = '#1976d2';
      }
      
      try {
        const res = await fetch('/api/database/snapshots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            center,
            yearMonth,
            members: membersToSave
          })
        });
        
        const result = await res.json();
        
        if (res.ok) {
          if (resultDiv) {
            resultDiv.textContent = `저장 완료! ${result.savedCount}명의 데이터가 저장되었습니다.`;
            resultDiv.style.color = '#4caf50';
          }
          
          setTimeout(() => {
            const modal = document.getElementById('database-save-modal');
            const modalBg = document.getElementById('database-save-modal-bg');
            if (modal && modalBg) {
              modal.style.display = 'none';
              modalBg.style.display = 'none';
            }
          }, 1500);
        } else {
          if (resultDiv) {
            resultDiv.textContent = result.message || '저장에 실패했습니다.';
            resultDiv.style.color = '#d32f2f';
          }
        }
      } catch (error) {
        console.error('저장 오류:', error);
        if (resultDiv) {
          resultDiv.textContent = '저장 중 오류가 발생했습니다.';
          resultDiv.style.color = '#d32f2f';
        }
      }
    };
  }

  // 센터 목록 로드 (매출정보 저장용)
  async function loadCentersForSalesSave() {
    try {
      const res = await fetch('/api/centers');
      const centers = await res.json();
      const select = document.getElementById('database-sales-save-center');
      if (select) {
        select.innerHTML = '<option value="">센터를 선택하세요</option>';
        centers.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.name;
          opt.textContent = c.name;
          select.appendChild(opt);
        });
      }
    } catch (error) {
      console.error('센터 목록 로드 오류:', error);
    }
  }
  
  // 연도 네비게이션 변수
  let currentYear = new Date().getFullYear();
  let renewalMemberYear = new Date().getFullYear();
  let renewalSalesYear = new Date().getFullYear();
  let selectedMemberData = null; // { center, yearMonth }
  let selectedSalesData = null; // { center, yearMonth }
  
  // 재등록 현황 버튼 클릭
  const renewalStatusBtn = document.getElementById('database-renewal-status-btn');
  if (renewalStatusBtn) {
    renewalStatusBtn.onclick = () => {
      const modal = document.getElementById('database-renewal-status-modal');
      const modalBg = document.getElementById('database-renewal-status-modal-bg');
      if (modal && modalBg) {
        renewalMemberYear = new Date().getFullYear();
        renewalSalesYear = new Date().getFullYear();
        selectedMemberData = null;
        selectedSalesData = null;
        updateRenewalMemberYearDisplay();
        updateRenewalSalesYearDisplay();
        loadRenewalMemberSnapshotsList();
        loadRenewalSalesSnapshotsList();
        updateRenewalSelectedDisplay();
        modal.style.display = 'block';
        modalBg.style.display = 'block';
      }
    };
  }
  
  // 재등록 현황 모달 닫기
  const renewalCloseBtn = document.getElementById('database-renewal-close-btn');
  if (renewalCloseBtn) {
    renewalCloseBtn.onclick = () => {
      const modal = document.getElementById('database-renewal-status-modal');
      const modalBg = document.getElementById('database-renewal-status-modal-bg');
      if (modal && modalBg) {
        modal.style.display = 'none';
        modalBg.style.display = 'none';
      }
    };
  }
  
  // 재등록 현황 모달 배경 클릭
  const renewalModalBg = document.getElementById('database-renewal-status-modal-bg');
  if (renewalModalBg) {
    renewalModalBg.onclick = () => {
      const modal = document.getElementById('database-renewal-status-modal');
      if (modal) {
        modal.style.display = 'none';
        renewalModalBg.style.display = 'none';
      }
    };
  }
  
  // 회원정보 연도 네비게이션
  const renewalMemberYearPrevBtn = document.getElementById('database-renewal-member-year-prev-btn');
  if (renewalMemberYearPrevBtn) {
    renewalMemberYearPrevBtn.onclick = () => {
      renewalMemberYear--;
      updateRenewalMemberYearDisplay();
      loadRenewalMemberSnapshotsList();
    };
  }
  
  const renewalMemberYearNextBtn = document.getElementById('database-renewal-member-year-next-btn');
  if (renewalMemberYearNextBtn) {
    renewalMemberYearNextBtn.onclick = () => {
      renewalMemberYear++;
      updateRenewalMemberYearDisplay();
      loadRenewalMemberSnapshotsList();
    };
  }
  
  // 매출정보 연도 네비게이션
  const renewalSalesYearPrevBtn = document.getElementById('database-renewal-sales-year-prev-btn');
  if (renewalSalesYearPrevBtn) {
    renewalSalesYearPrevBtn.onclick = () => {
      renewalSalesYear--;
      updateRenewalSalesYearDisplay();
      loadRenewalSalesSnapshotsList();
    };
  }
  
  const renewalSalesYearNextBtn = document.getElementById('database-renewal-sales-year-next-btn');
  if (renewalSalesYearNextBtn) {
    renewalSalesYearNextBtn.onclick = () => {
      renewalSalesYear++;
      updateRenewalSalesYearDisplay();
      loadRenewalSalesSnapshotsList();
    };
  }
  
  // 회원정보 연도 표시 업데이트
  function updateRenewalMemberYearDisplay() {
    const yearElement = document.getElementById('database-renewal-member-current-year');
    if (yearElement) {
      yearElement.textContent = renewalMemberYear;
    }
  }
  
  // 매출정보 연도 표시 업데이트
  function updateRenewalSalesYearDisplay() {
    const yearElement = document.getElementById('database-renewal-sales-current-year');
    if (yearElement) {
      yearElement.textContent = renewalSalesYear;
    }
  }
  
  // 선택된 데이터 표시 업데이트
  function updateRenewalSelectedDisplay() {
    const memberSelected = document.getElementById('database-renewal-member-selected');
    const salesSelected = document.getElementById('database-renewal-sales-selected');
    
    if (memberSelected) {
      if (selectedMemberData) {
        memberSelected.textContent = `✓ ${selectedMemberData.center} - ${selectedMemberData.yearMonth}`;
      } else {
        memberSelected.textContent = '';
      }
    }
    
    if (salesSelected) {
      if (selectedSalesData) {
        salesSelected.textContent = `✓ ${selectedSalesData.center} - ${selectedSalesData.yearMonth}`;
      } else {
        salesSelected.textContent = '';
      }
    }
  }
  
  // 회원정보 스냅샷 목록 로드
  async function loadRenewalMemberSnapshotsList() {
    const selectionEl = document.getElementById('database-renewal-member-selection');
    if (!selectionEl) return;
    
    try {
      const res = await fetch(`/api/database/snapshots/list?year=${renewalMemberYear}`);
      const result = await res.json();
      
      if (result.snapshots && result.snapshots.length > 0) {
        const centerMap = {};
        result.snapshots.forEach(snapshot => {
          if (!centerMap[snapshot.center]) {
            centerMap[snapshot.center] = [];
          }
          centerMap[snapshot.center].push(snapshot);
        });
        
        const centers = Object.keys(centerMap).sort();
        selectionEl.innerHTML = '';
        
        centers.forEach(center => {
          const centerDiv = document.createElement('div');
          centerDiv.style.marginBottom = '6px';
          
          const centerTitle = document.createElement('div');
          centerTitle.style.fontSize = '0.75rem';
          centerTitle.style.fontWeight = '600';
          centerTitle.style.color = '#1976d2';
          centerTitle.style.marginBottom = '3px';
          centerTitle.textContent = center;
          centerDiv.appendChild(centerTitle);
          
          const monthsDiv = document.createElement('div');
          monthsDiv.style.display = 'flex';
          monthsDiv.style.flexWrap = 'wrap';
          monthsDiv.style.gap = '3px';
          
          const months = centerMap[center].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
          months.forEach(snapshot => {
            const monthBtn = document.createElement('button');
            const [year, month] = snapshot.yearMonth.split('-');
            monthBtn.textContent = `${month}월 (${snapshot.memberCount || 0}명)`;
            monthBtn.style.background = selectedMemberData && selectedMemberData.center === center && selectedMemberData.yearMonth === snapshot.yearMonth ? '#4caf50' : '#f5f5f5';
            monthBtn.style.color = selectedMemberData && selectedMemberData.center === center && selectedMemberData.yearMonth === snapshot.yearMonth ? '#fff' : '#333';
            monthBtn.style.border = '1px solid #ddd';
            monthBtn.style.padding = '3px 6px';
            monthBtn.style.borderRadius = '3px';
            monthBtn.style.cursor = 'pointer';
            monthBtn.style.fontSize = '0.7rem';
            
            monthBtn.onclick = () => {
              selectedMemberData = { center, yearMonth: snapshot.yearMonth };
              updateRenewalSelectedDisplay();
              loadRenewalMemberSnapshotsList();
            };
            
            monthsDiv.appendChild(monthBtn);
          });
          
          centerDiv.appendChild(monthsDiv);
          selectionEl.appendChild(centerDiv);
        });
      } else {
        selectionEl.innerHTML = '<div style="font-size:0.75rem;color:#888;">해당 연도에 데이터가 없습니다.</div>';
      }
    } catch (error) {
      console.error('회원정보 스냅샷 목록 로드 오류:', error);
      selectionEl.innerHTML = '<div style="font-size:0.75rem;color:#d32f2f;">데이터를 불러오는 중 오류가 발생했습니다.</div>';
    }
  }
  
  // 매출정보 스냅샷 목록 로드
  async function loadRenewalSalesSnapshotsList() {
    const selectionEl = document.getElementById('database-renewal-sales-selection');
    if (!selectionEl) return;
    
    try {
      const res = await fetch(`/api/database/sales-snapshots/list?year=${renewalSalesYear}`);
      const result = await res.json();
      
      if (result.snapshots && result.snapshots.length > 0) {
        const centerMap = {};
        result.snapshots.forEach(snapshot => {
          if (!centerMap[snapshot.center]) {
            centerMap[snapshot.center] = [];
          }
          centerMap[snapshot.center].push(snapshot);
        });
        
        const centers = Object.keys(centerMap).sort();
        selectionEl.innerHTML = '';
        
        centers.forEach(center => {
          const centerDiv = document.createElement('div');
          centerDiv.style.marginBottom = '6px';
          
          const centerTitle = document.createElement('div');
          centerTitle.style.fontSize = '0.75rem';
          centerTitle.style.fontWeight = '600';
          centerTitle.style.color = '#1976d2';
          centerTitle.style.marginBottom = '3px';
          centerTitle.textContent = center;
          centerDiv.appendChild(centerTitle);
          
          const monthsDiv = document.createElement('div');
          monthsDiv.style.display = 'flex';
          monthsDiv.style.flexWrap = 'wrap';
          monthsDiv.style.gap = '3px';
          
          const months = centerMap[center].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
          months.forEach(snapshot => {
            const monthBtn = document.createElement('button');
            const [year, month] = snapshot.yearMonth.split('-');
            monthBtn.textContent = `${month}월 (${snapshot.salesCount || 0}건)`;
            monthBtn.style.background = selectedSalesData && selectedSalesData.center === center && selectedSalesData.yearMonth === snapshot.yearMonth ? '#4caf50' : '#f5f5f5';
            monthBtn.style.color = selectedSalesData && selectedSalesData.center === center && selectedSalesData.yearMonth === snapshot.yearMonth ? '#fff' : '#333';
            monthBtn.style.border = '1px solid #ddd';
            monthBtn.style.padding = '3px 6px';
            monthBtn.style.borderRadius = '3px';
            monthBtn.style.cursor = 'pointer';
            monthBtn.style.fontSize = '0.7rem';
            
            monthBtn.onclick = () => {
              selectedSalesData = { center, yearMonth: snapshot.yearMonth };
              updateRenewalSelectedDisplay();
              loadRenewalSalesSnapshotsList();
            };
            
            monthsDiv.appendChild(monthBtn);
          });
          
          centerDiv.appendChild(monthsDiv);
          selectionEl.appendChild(centerDiv);
        });
      } else {
        selectionEl.innerHTML = '<div style="font-size:0.75rem;color:#888;">해당 연도에 데이터가 없습니다.</div>';
      }
    } catch (error) {
      console.error('매출정보 스냅샷 목록 로드 오류:', error);
      selectionEl.innerHTML = '<div style="font-size:0.75rem;color:#d32f2f;">데이터를 불러오는 중 오류가 발생했습니다.</div>';
    }
  }
  
  // 재등록 현황 비교 버튼
  const renewalCompareBtn = document.getElementById('database-renewal-compare-btn');
  if (renewalCompareBtn) {
    renewalCompareBtn.onclick = async () => {
      if (!selectedMemberData || !selectedSalesData) {
        alert('회원정보와 매출정보를 모두 선택해주세요.');
        return;
      }
      
      const loadingEl = document.getElementById('database-renewal-loading');
      const emptyEl = document.getElementById('database-renewal-empty');
      const modal = document.getElementById('database-renewal-status-modal');
      const modalBg = document.getElementById('database-renewal-status-modal-bg');
      
      if (loadingEl) loadingEl.style.display = 'block';
      if (emptyEl) emptyEl.style.display = 'none';
      
      try {
        // 회원정보 불러오기
        const memberRes = await fetch(`/api/database/snapshots?yearMonth=${selectedMemberData.yearMonth}&center=${encodeURIComponent(selectedMemberData.center)}`);
        const memberResult = await memberRes.json();
        
        // 매출정보 불러오기
        const salesRes = await fetch(`/api/database/sales-snapshots?yearMonth=${selectedSalesData.yearMonth}&center=${encodeURIComponent(selectedSalesData.center)}`);
        const salesResult = await salesRes.json();
        
        if (loadingEl) loadingEl.style.display = 'none';
        
        if (!memberResult.members || memberResult.members.length === 0) {
          if (emptyEl) {
            emptyEl.textContent = '회원정보가 없습니다.';
            emptyEl.style.display = 'block';
          }
          return;
        }
        
        // 재등록 현황 분석
        const analysisResults = analyzeRenewalStatus(memberResult.members, salesResult.sales || []);
        
        // 원본 회원 정보 저장 (회원 이름 클릭 시 사용)
        window.renewalMemberData = memberResult.members;
        
        // 모달 닫기
        if (modal && modalBg) {
          modal.style.display = 'none';
          modalBg.style.display = 'none';
        }
        
        // 다른 섹션 숨기기
        clearOtherDataType('renewal');
        
        // 신규등록 현황 표시
        if (analysisResults.newRegistrationResults.length > 0) {
          displayNewRegistrationResults(analysisResults.newRegistrationResults);
          const newRegistrationSection = document.getElementById('database-new-registration-results-section');
          if (newRegistrationSection) {
            newRegistrationSection.style.display = 'block';
          }
          setupNewRegistrationDownloadButton(analysisResults.newRegistrationResults);
        }
        
        // 재등록 현황 표시
        displayRenewalResults(analysisResults.renewalResults);
        const resultsSection = document.getElementById('database-renewal-results-section');
        if (resultsSection) {
          resultsSection.style.display = 'block';
        }
        
        // 다운로드 버튼 이벤트 리스너 설정
        setupRenewalDownloadButton(analysisResults.renewalResults);
      } catch (error) {
        console.error('재등록 현황 분석 오류:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) {
          emptyEl.textContent = '분석 중 오류가 발생했습니다.';
          emptyEl.style.display = 'block';
        }
      }
    };
  }
  
  // 재등록 현황 분석 함수
  function analyzeRenewalStatus(members, sales) {
    // 회원정보를 회원명+연락처로 인덱싱
    const membersMap = new Map();
    members.forEach(member => {
      const key = `${member.name || ''}_${member.phone || ''}`;
      membersMap.set(key, member);
    });
    
    // 매출정보를 회원명+연락처로 인덱싱
    const salesMap = new Map();
    sales.forEach(sale => {
      const key = `${sale.memberName || ''}_${sale.phone || ''}`;
      if (!salesMap.has(key)) {
        salesMap.set(key, []);
      }
      salesMap.get(key).push(sale);
    });
    
    // 회원정보를 순회하며 재등록 여부 확인
    const renewalResults = members.map(member => {
      const key = `${member.name || ''}_${member.phone || ''}`;
      const matchedSales = salesMap.get(key) || [];
      
      const isRenewal = matchedSales.length > 0;
      const salesNames = matchedSales.flatMap(sale => sale.salesNames || []).filter((v, i, a) => a.indexOf(v) === i);
      
      // 성향 계산 (기존 로직 사용)
      const greenDays = 15;
      const yellowDays = 30;
      let tendency = 'red';
      if (member.recentVisit) {
        const daysSinceVisit = Math.floor((new Date() - new Date(member.recentVisit)) / (1000 * 60 * 60 * 24));
        if (daysSinceVisit <= greenDays) {
          tendency = 'green';
        } else if (daysSinceVisit <= yellowDays) {
          tendency = 'yellow';
        }
      }
      
      // 최근 방문일 (일까지만)
      let recentVisitDate = '';
      if (member.recentVisit) {
        const date = new Date(member.recentVisit);
        recentVisitDate = date.toISOString().split('T')[0]; // YYYY-MM-DD 형식
      }
      
      return {
        name: member.name || '',
        phone: member.phone || '',
        tendency: tendency,
        recentVisit: recentVisitDate,
        totalPeriod: member.totalPeriod || '0',
        isRenewal: isRenewal,
        salesNames: salesNames,
        memberData: member // 원본 회원 정보 저장
      };
    });
    
    // 신규등록 회원 찾기 (매출정보에는 있지만 회원정보에는 없는 회원)
    const newRegistrationResults = [];
    sales.forEach(sale => {
      const key = `${sale.memberName || ''}_${sale.phone || ''}`;
      if (!membersMap.has(key)) {
        // 이미 추가된 회원인지 확인 (중복 방지)
        const existing = newRegistrationResults.find(r => r.name === sale.memberName && r.phone === sale.phone);
        if (!existing) {
          newRegistrationResults.push({
            name: sale.memberName || '',
            phone: sale.phone || '',
            salesNames: sale.salesNames || []
          });
        } else {
          // 이미 있는 경우 매출 이름 추가
          existing.salesNames = [...new Set([...existing.salesNames, ...(sale.salesNames || [])])];
        }
      }
    });
    
    return {
      renewalResults: renewalResults,
      newRegistrationResults: newRegistrationResults
    };
  }
  
  // 재등록 현황 결과 표시
  function displayRenewalResults(results) {
    const resultsTable = document.getElementById('database-renewal-results-table');
    const statsEl = document.getElementById('database-renewal-stats');
    if (!resultsTable) return;
    
    // 통계 계산
    const totalMembers = results.length;
    const renewalMembers = results.filter(r => r.isRenewal).length;
    
    // 성향별 통계
    const greenMembers = results.filter(r => r.tendency === 'green');
    const greenRenewal = greenMembers.filter(r => r.isRenewal).length;
    
    const yellowMembers = results.filter(r => r.tendency === 'yellow');
    const yellowRenewal = yellowMembers.filter(r => r.isRenewal).length;
    
    const redMembers = results.filter(r => r.tendency === 'red');
    const redRenewal = redMembers.filter(r => r.isRenewal).length;
    
    // 통계 표시
    if (statsEl) {
      statsEl.innerHTML = `
        <span style="font-weight:600;">전체: ${renewalMembers}/${totalMembers}</span>
        <span style="color:#4caf50;">Green: ${greenRenewal}/${greenMembers.length}</span>
        <span style="color:#ff9800;">Yellow: ${yellowRenewal}/${yellowMembers.length}</span>
        <span style="color:#d32f2f;">Red: ${redRenewal}/${redMembers.length}</span>
      `;
    }
    
    resultsTable.innerHTML = '';
    
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '0.75rem';
    table.style.lineHeight = '1.3';
    
    // 헤더
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.style.background = '#f5f5f5';
    headerRow.style.borderBottom = '1px solid #ddd';
    
    const headers = [
      { text: '회원명', sort: 'name', sortable: true },
      { text: '연락처', sort: 'phone', sortable: true },
      { text: '성향', sort: 'tendency', sortable: true },
      { text: '최근 방문일', sort: 'recentVisit', sortable: true },
      { text: '전체기간', sort: 'totalPeriod', sortable: true },
      { text: '재등록', sort: 'isRenewal', sortable: true },
      { text: '매출 이름', sort: null, sortable: false }
    ];
    
    headers.forEach(header => {
      const th = document.createElement('th');
      th.style.padding = '6px 4px';
      th.style.textAlign = 'left';
      th.style.fontWeight = '600';
      th.style.fontSize = '0.75rem';
      
      if (header.sortable) {
        th.className = 'sortable';
        th.setAttribute('data-sort', header.sort);
        th.style.cursor = 'pointer';
        th.style.userSelect = 'none';
        
        const textSpan = document.createElement('span');
        textSpan.textContent = header.text;
        th.appendChild(textSpan);
        
        const iconSpan = document.createElement('span');
        iconSpan.className = 'sort-icon';
        iconSpan.textContent = '↕';
        iconSpan.style.marginLeft = '4px';
        iconSpan.style.color = '#999';
        iconSpan.style.fontSize = '0.7rem';
        th.appendChild(iconSpan);
      } else {
        th.textContent = header.text;
      }
      
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // 본문
    const tbody = document.createElement('tbody');
    results.forEach(result => {
      const row = document.createElement('tr');
      row.style.borderBottom = '1px solid #eee';
      
      // 회원명 (클릭 가능)
      const nameCell = document.createElement('td');
      nameCell.textContent = result.name;
      nameCell.style.padding = '5px 4px';
      nameCell.style.fontSize = '0.75rem';
      nameCell.style.cursor = 'pointer';
      nameCell.style.color = '#1976d2';
      nameCell.style.textDecoration = 'underline';
      nameCell.onclick = () => {
        showMemberDetailModal(result.memberData);
      };
      row.appendChild(nameCell);
      
      // 연락처
      const phoneCell = document.createElement('td');
      phoneCell.textContent = result.phone;
      phoneCell.style.padding = '5px 4px';
      phoneCell.style.fontSize = '0.75rem';
      row.appendChild(phoneCell);
      
      // 성향
      const tendencyCell = document.createElement('td');
      tendencyCell.textContent = result.tendency === 'green' ? 'Green' : result.tendency === 'yellow' ? 'Yellow' : 'Red';
      tendencyCell.style.padding = '5px 4px';
      tendencyCell.style.fontSize = '0.75rem';
      tendencyCell.style.color = result.tendency === 'green' ? '#4caf50' : result.tendency === 'yellow' ? '#ff9800' : '#d32f2f';
      row.appendChild(tendencyCell);
      
      // 최근 방문일
      const recentVisitCell = document.createElement('td');
      recentVisitCell.textContent = result.recentVisit || '';
      recentVisitCell.style.padding = '5px 4px';
      recentVisitCell.style.fontSize = '0.75rem';
      row.appendChild(recentVisitCell);
      
      // 전체기간
      const periodCell = document.createElement('td');
      periodCell.textContent = result.totalPeriod;
      periodCell.style.padding = '5px 4px';
      periodCell.style.fontSize = '0.75rem';
      row.appendChild(periodCell);
      
      // 재등록
      const renewalCell = document.createElement('td');
      renewalCell.textContent = result.isRenewal ? '재등록' : '';
      renewalCell.style.padding = '5px 4px';
      renewalCell.style.fontSize = '0.75rem';
      renewalCell.style.color = result.isRenewal ? '#4caf50' : '#888';
      renewalCell.style.fontWeight = result.isRenewal ? '600' : 'normal';
      row.appendChild(renewalCell);
      
      // 매출 이름
      const salesNamesCell = document.createElement('td');
      salesNamesCell.textContent = result.salesNames.join(', ') || '';
      salesNamesCell.style.padding = '5px 4px';
      salesNamesCell.style.fontSize = '0.75rem';
      row.appendChild(salesNamesCell);
      
      tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    resultsTable.appendChild(table);
    
    // 테이블에 ID 추가 (정렬 기능을 위해)
    table.id = 'database-renewal-table';
    
    // 정렬 기능 설정
    setupRenewalSorting(table, results);
  }
  
  // 재등록 현황 정렬 상태
  let currentRenewalSort = { column: null, direction: 'asc' };
  
  // 재등록 현황 정렬 기능 설정
  function setupRenewalSorting(table, results) {
    if (!table) return;
    
    // 이벤트 위임: 테이블에 한 번만 이벤트 리스너 추가
    if (!table.dataset.renewalSortListenerAdded) {
      table.addEventListener('click', (e) => {
        const header = e.target.closest('.sortable');
        if (!header) return;
        
        const column = header.getAttribute('data-sort');
        if (!column) return;
        
        // 같은 컬럼 클릭 시 정렬 방향 전환
        if (currentRenewalSort.column === column) {
          currentRenewalSort.direction = currentRenewalSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
          currentRenewalSort.column = column;
          currentRenewalSort.direction = 'asc';
        }
        
        // 정렬 아이콘 업데이트
        const allHeaders = table.querySelectorAll('.sortable');
        allHeaders.forEach(h => {
          const icon = h.querySelector('.sort-icon');
          if (h === header) {
            icon.textContent = currentRenewalSort.direction === 'asc' ? '↑' : '↓';
            icon.style.color = '#1976d2';
          } else {
            icon.textContent = '↕';
            icon.style.color = '#999';
          }
        });
        
        // 정렬 적용
        applyRenewalSorting(table, results);
      });
      
      table.dataset.renewalSortListenerAdded = 'true';
    }
  }
  
  // 재등록 현황 정렬 적용
  function applyRenewalSorting(table, results) {
    if (!table || !results) return;
    
    const sortedResults = [...results].sort((a, b) => {
      let aVal, bVal;
      
      switch (currentRenewalSort.column) {
        case 'name':
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
          break;
        case 'phone':
          aVal = (a.phone || '').replace(/[^0-9]/g, '');
          bVal = (b.phone || '').replace(/[^0-9]/g, '');
          break;
        case 'tendency':
          const tendencyOrder = { 'green': 1, 'yellow': 2, 'red': 3 };
          aVal = tendencyOrder[a.tendency] || 3;
          bVal = tendencyOrder[b.tendency] || 3;
          break;
        case 'recentVisit':
          aVal = a.recentVisit ? new Date(a.recentVisit).getTime() : 0;
          bVal = b.recentVisit ? new Date(b.recentVisit).getTime() : 0;
          break;
        case 'totalPeriod':
          // 기간을 숫자로 변환 (예: "12개월" -> 12)
          const parsePeriod = (period) => {
            if (!period) return 0;
            const match = period.match(/(\d+)/);
            return match ? parseInt(match[1]) : 0;
          };
          aVal = parsePeriod(a.totalPeriod);
          bVal = parsePeriod(b.totalPeriod);
          break;
        case 'isRenewal':
          aVal = a.isRenewal ? 1 : 0;
          bVal = b.isRenewal ? 1 : 0;
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return currentRenewalSort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return currentRenewalSort.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    // 테이블 본문 다시 렌더링
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    sortedResults.forEach(result => {
      const row = document.createElement('tr');
      row.style.borderBottom = '1px solid #eee';
      
      // 회원명 (클릭 가능)
      const nameCell = document.createElement('td');
      nameCell.textContent = result.name;
      nameCell.style.padding = '5px 4px';
      nameCell.style.fontSize = '0.75rem';
      nameCell.style.cursor = 'pointer';
      nameCell.style.color = '#1976d2';
      nameCell.style.textDecoration = 'underline';
      nameCell.onclick = () => {
        showMemberDetailModal(result.memberData);
      };
      row.appendChild(nameCell);
      
      // 연락처
      const phoneCell = document.createElement('td');
      phoneCell.textContent = result.phone;
      phoneCell.style.padding = '5px 4px';
      phoneCell.style.fontSize = '0.75rem';
      row.appendChild(phoneCell);
      
      // 성향
      const tendencyCell = document.createElement('td');
      tendencyCell.textContent = result.tendency === 'green' ? 'Green' : result.tendency === 'yellow' ? 'Yellow' : 'Red';
      tendencyCell.style.padding = '5px 4px';
      tendencyCell.style.fontSize = '0.75rem';
      tendencyCell.style.color = result.tendency === 'green' ? '#4caf50' : result.tendency === 'yellow' ? '#ff9800' : '#d32f2f';
      row.appendChild(tendencyCell);
      
      // 최근 방문일
      const recentVisitCell = document.createElement('td');
      recentVisitCell.textContent = result.recentVisit || '';
      recentVisitCell.style.padding = '5px 4px';
      recentVisitCell.style.fontSize = '0.75rem';
      row.appendChild(recentVisitCell);
      
      // 전체기간
      const periodCell = document.createElement('td');
      periodCell.textContent = result.totalPeriod;
      periodCell.style.padding = '5px 4px';
      periodCell.style.fontSize = '0.75rem';
      row.appendChild(periodCell);
      
      // 재등록
      const renewalCell = document.createElement('td');
      renewalCell.textContent = result.isRenewal ? '재등록' : '';
      renewalCell.style.padding = '5px 4px';
      renewalCell.style.fontSize = '0.75rem';
      renewalCell.style.color = result.isRenewal ? '#4caf50' : '#888';
      renewalCell.style.fontWeight = result.isRenewal ? '600' : 'normal';
      row.appendChild(renewalCell);
      
      // 매출 이름
      const salesNamesCell = document.createElement('td');
      salesNamesCell.textContent = result.salesNames.join(', ') || '';
      salesNamesCell.style.padding = '5px 4px';
      salesNamesCell.style.fontSize = '0.75rem';
      row.appendChild(salesNamesCell);
      
      tbody.appendChild(row);
    });
  }
  
  // 신규등록 현황 결과 표시
  function displayNewRegistrationResults(results) {
    const resultsTable = document.getElementById('database-new-registration-results-table');
    const statsEl = document.getElementById('database-new-registration-stats');
    if (!resultsTable) return;
    
    // 매출 이름별 판매 개수 집계
    const salesNameCount = {};
    results.forEach(result => {
      if (result.salesNames && result.salesNames.length > 0) {
        result.salesNames.forEach(salesName => {
          if (salesName) {
            salesNameCount[salesName] = (salesNameCount[salesName] || 0) + 1;
          }
        });
      }
    });
    
    // 통계 표시
    if (statsEl) {
      let statsHTML = `<span style="font-weight:600;">총 ${results.length}명</span>`;
      
      // 매출 이름별 판매 개수 표시
      const salesNameEntries = Object.entries(salesNameCount).sort((a, b) => b[1] - a[1]);
      if (salesNameEntries.length > 0) {
        statsHTML += ' <span style="margin-left:12px;color:#1976d2;">|</span>';
        salesNameEntries.forEach(([salesName, count]) => {
          statsHTML += ` <span style="margin-left:8px;"><strong>${salesName}:</strong> ${count}개</span>`;
        });
      }
      
      statsEl.innerHTML = statsHTML;
    }
    
    resultsTable.innerHTML = '';
    
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '0.75rem';
    table.style.lineHeight = '1.3';
    
    // 헤더
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.style.background = '#f5f5f5';
    headerRow.style.borderBottom = '1px solid #ddd';
    
    const headers = [
      { text: '회원명', sort: 'name', sortable: true },
      { text: '연락처', sort: 'phone', sortable: true },
      { text: '매출 이름', sort: null, sortable: false }
    ];
    
    headers.forEach(header => {
      const th = document.createElement('th');
      th.style.padding = '6px 4px';
      th.style.textAlign = 'left';
      th.style.fontWeight = '600';
      th.style.fontSize = '0.75rem';
      
      if (header.sortable) {
        th.className = 'sortable';
        th.setAttribute('data-sort', header.sort);
        th.style.cursor = 'pointer';
        th.style.userSelect = 'none';
        
        const textSpan = document.createElement('span');
        textSpan.textContent = header.text;
        th.appendChild(textSpan);
        
        const iconSpan = document.createElement('span');
        iconSpan.className = 'sort-icon';
        iconSpan.textContent = '↕';
        iconSpan.style.marginLeft = '4px';
        iconSpan.style.color = '#999';
        iconSpan.style.fontSize = '0.7rem';
        th.appendChild(iconSpan);
      } else {
        th.textContent = header.text;
      }
      
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // 본문
    const tbody = document.createElement('tbody');
    results.forEach(result => {
      const row = document.createElement('tr');
      row.style.borderBottom = '1px solid #eee';
      
      // 회원명
      const nameCell = document.createElement('td');
      nameCell.textContent = result.name;
      nameCell.style.padding = '5px 4px';
      nameCell.style.fontSize = '0.75rem';
      row.appendChild(nameCell);
      
      // 연락처
      const phoneCell = document.createElement('td');
      phoneCell.textContent = result.phone;
      phoneCell.style.padding = '5px 4px';
      phoneCell.style.fontSize = '0.75rem';
      row.appendChild(phoneCell);
      
      // 매출 이름
      const salesNamesCell = document.createElement('td');
      salesNamesCell.textContent = result.salesNames.join(', ') || '';
      salesNamesCell.style.padding = '5px 4px';
      salesNamesCell.style.fontSize = '0.75rem';
      row.appendChild(salesNamesCell);
      
      tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    resultsTable.appendChild(table);
    
    // 테이블에 ID 추가 (정렬 기능을 위해)
    table.id = 'database-new-registration-table';
    
    // 정렬 기능 설정
    setupNewRegistrationSorting(table, results);
  }
  
  // 신규등록 현황 정렬 상태
  let currentNewRegistrationSort = { column: null, direction: 'asc' };
  
  // 신규등록 현황 정렬 기능 설정
  function setupNewRegistrationSorting(table, results) {
    if (!table) return;
    
    if (!table.dataset.newRegistrationSortListenerAdded) {
      table.addEventListener('click', (e) => {
        const header = e.target.closest('.sortable');
        if (!header) return;
        
        const column = header.getAttribute('data-sort');
        if (!column) return;
        
        if (currentNewRegistrationSort.column === column) {
          currentNewRegistrationSort.direction = currentNewRegistrationSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
          currentNewRegistrationSort.column = column;
          currentNewRegistrationSort.direction = 'asc';
        }
        
        const allHeaders = table.querySelectorAll('.sortable');
        allHeaders.forEach(h => {
          const icon = h.querySelector('.sort-icon');
          if (h === header) {
            icon.textContent = currentNewRegistrationSort.direction === 'asc' ? '↑' : '↓';
            icon.style.color = '#1976d2';
          } else {
            icon.textContent = '↕';
            icon.style.color = '#999';
          }
        });
        
        applyNewRegistrationSorting(table, results);
      });
      
      table.dataset.newRegistrationSortListenerAdded = 'true';
    }
  }
  
  // 신규등록 현황 정렬 적용
  function applyNewRegistrationSorting(table, results) {
    if (!table || !results) return;
    
    const sortedResults = [...results].sort((a, b) => {
      let aVal, bVal;
      
      switch (currentNewRegistrationSort.column) {
        case 'name':
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
          break;
        case 'phone':
          aVal = (a.phone || '').replace(/[^0-9]/g, '');
          bVal = (b.phone || '').replace(/[^0-9]/g, '');
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return currentNewRegistrationSort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return currentNewRegistrationSort.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    sortedResults.forEach(result => {
      const row = document.createElement('tr');
      row.style.borderBottom = '1px solid #eee';
      
      const nameCell = document.createElement('td');
      nameCell.textContent = result.name;
      nameCell.style.padding = '5px 4px';
      nameCell.style.fontSize = '0.75rem';
      row.appendChild(nameCell);
      
      const phoneCell = document.createElement('td');
      phoneCell.textContent = result.phone;
      phoneCell.style.padding = '5px 4px';
      phoneCell.style.fontSize = '0.75rem';
      row.appendChild(phoneCell);
      
      const salesNamesCell = document.createElement('td');
      salesNamesCell.textContent = result.salesNames.join(', ') || '';
      salesNamesCell.style.padding = '5px 4px';
      salesNamesCell.style.fontSize = '0.75rem';
      row.appendChild(salesNamesCell);
      
      tbody.appendChild(row);
    });
  }
  
  // 신규등록 현황 엑셀 다운로드 버튼 설정
  function setupNewRegistrationDownloadButton(results) {
    const downloadBtn = document.getElementById('database-new-registration-download-excel-btn');
    if (!downloadBtn) return;
    
    downloadBtn.onclick = null;
    
    downloadBtn.onclick = () => {
      if (!results || results.length === 0) {
        alert('다운로드할 데이터가 없습니다.');
        return;
      }
      
      let csv = '회원명,연락처,매출 이름\n';
      results.forEach(result => {
        const name = (result.name || '').replace(/,/g, '');
        const phone = (result.phone || '').replace(/,/g, '');
        const salesNames = (result.salesNames || []).join('; ').replace(/,/g, '');
        csv += `${name},${phone},${salesNames}\n`;
      });
      
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const filename = `신규등록현황_${dateStr}.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };
  }
  
  // 재등록 현황 엑셀 다운로드 버튼 설정
  function setupRenewalDownloadButton(results) {
    const downloadBtn = document.getElementById('database-renewal-download-excel-btn');
    if (!downloadBtn) return;
    
    // 기존 이벤트 리스너 제거
    downloadBtn.onclick = null;
    
    downloadBtn.onclick = () => {
      if (!results || results.length === 0) {
        alert('다운로드할 데이터가 없습니다.');
        return;
      }
      
      // CSV 생성
      let csv = '회원명,연락처,성향,최근 방문일,전체기간,재등록,매출 이름\n';
      results.forEach(result => {
        const name = (result.name || '').replace(/,/g, '');
        const phone = (result.phone || '').replace(/,/g, '');
        const tendency = result.tendency === 'green' ? 'Green' : result.tendency === 'yellow' ? 'Yellow' : 'Red';
        const recentVisit = (result.recentVisit || '').replace(/,/g, '');
        const totalPeriod = (result.totalPeriod || '').replace(/,/g, '');
        const isRenewal = result.isRenewal ? '재등록' : '';
        const salesNames = (result.salesNames || []).join('; ').replace(/,/g, '');
        csv += `${name},${phone},${tendency},${recentVisit},${totalPeriod},${isRenewal},${salesNames}\n`;
      });
      
      // Blob 생성 및 다운로드
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const filename = `재등록현황_${dateStr}.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };
  }
  
  // 회원 상세 정보 모달 표시
  function showMemberDetailModal(memberData) {
    if (!memberData) return;
    
    // 모달 HTML 생성
    const modalBg = document.createElement('div');
    modalBg.id = 'database-member-detail-modal-bg';
    modalBg.style.cssText = 'display:block;position:fixed;z-index:1002;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);';
    modalBg.onclick = () => {
      modalBg.remove();
      modal.remove();
    };
    
    const modal = document.createElement('div');
    modal.id = 'database-member-detail-modal';
    modal.style.cssText = 'display:block;position:fixed;z-index:1003;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:20px;border-radius:10px;box-shadow:0 8px 32px #1976d240;min-width:500px;max-width:90vw;max-height:85vh;overflow-y:auto;';
    modal.onclick = (e) => e.stopPropagation();
    
    // 회원 정보 표시
    const infoHtml = `
      <h3 style="margin-top:0;margin-bottom:16px;color:#1976d2;font-size:1rem;">회원 상세 정보</h3>
      <div style="display:grid;grid-template-columns:120px 1fr;gap:8px 12px;font-size:0.85rem;">
        <div style="font-weight:600;color:#666;">회원명:</div>
        <div>${memberData.name || ''}</div>
        
        <div style="font-weight:600;color:#666;">연락처:</div>
        <div>${memberData.phone || ''}</div>
        
        <div style="font-weight:600;color:#666;">최근 방문일:</div>
        <div>${memberData.recentVisit || ''}</div>
        
        <div style="font-weight:600;color:#666;">전체 기간:</div>
        <div>${memberData.totalPeriod || '0'}</div>
        
        <div style="font-weight:600;color:#666;">회원 상태:</div>
        <div>${memberData.status || ''}</div>
        
        <div style="font-weight:600;color:#666;">상품명:</div>
        <div>${(memberData.productNames || []).join(', ') || ''}</div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
        <button type="button" id="database-member-detail-close-btn" style="background:#eee;color:#1976d2;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;">닫기</button>
      </div>
    `;
    
    modal.innerHTML = infoHtml;
    
    document.body.appendChild(modalBg);
    document.body.appendChild(modal);
    
    // 닫기 버튼 이벤트
    const closeBtn = document.getElementById('database-member-detail-close-btn');
    if (closeBtn) {
      closeBtn.onclick = () => {
        modalBg.remove();
        modal.remove();
      };
    }
  }
  
  // 현재 선택된 데이터 타입 가져오기
  function getSelectedDataType() {
    const radio = document.querySelector('input[name="database-data-type"]:checked');
    return radio ? radio.value : 'members';
  }
  
  // 데이터 타입 변경 이벤트
  const dataTypeRadios = document.querySelectorAll('input[name="database-data-type"]');
  dataTypeRadios.forEach(radio => {
    radio.onchange = () => {
      loadSnapshotsList();
    };
  });
  
  // 연도 네비게이션 이전 버튼
  const yearPrevBtn = document.getElementById('database-year-prev-btn');
  if (yearPrevBtn) {
    yearPrevBtn.onclick = () => {
      currentYear--;
      updateYearDisplay();
      loadSnapshotsList();
    };
  }
  
  // 연도 네비게이션 다음 버튼
  const yearNextBtn = document.getElementById('database-year-next-btn');
  if (yearNextBtn) {
    yearNextBtn.onclick = () => {
      currentYear++;
      updateYearDisplay();
      loadSnapshotsList();
    };
  }
  
  // 연도 표시 업데이트
  function updateYearDisplay() {
    const yearElement = document.getElementById('database-current-year');
    if (yearElement) {
      yearElement.textContent = currentYear;
    }
  }
  
  // 스냅샷 목록 로드
  async function loadSnapshotsList() {
    const loadingEl = document.getElementById('database-snapshots-loading');
    const listEl = document.getElementById('database-snapshots-list');
    const emptyEl = document.getElementById('database-snapshots-empty');
    const dataType = getSelectedDataType();
    
    if (loadingEl) loadingEl.style.display = 'block';
    if (listEl) listEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'none';
    
    try {
      // 데이터 타입에 따라 다른 API 호출
      const apiUrl = dataType === 'sales' 
        ? `/api/database/sales-snapshots/list?year=${currentYear}`
        : `/api/database/snapshots/list?year=${currentYear}`;
      
      const res = await fetch(apiUrl);
      const result = await res.json();
      
      if (loadingEl) loadingEl.style.display = 'none';
      
      if (result.snapshots && result.snapshots.length > 0) {
        // 센터별로 그룹화
        const centerMap = {};
        result.snapshots.forEach(snapshot => {
          if (!centerMap[snapshot.center]) {
            centerMap[snapshot.center] = [];
          }
          centerMap[snapshot.center].push(snapshot);
        });
        
        // 센터별로 정렬 (센터명 순서대로)
        const centers = Object.keys(centerMap).sort();
        
        // UI 생성
        if (listEl) {
          listEl.innerHTML = '';
          
          centers.forEach(center => {
            const centerDiv = document.createElement('div');
            centerDiv.style.marginBottom = '12px';
            centerDiv.style.background = '#fff';
            centerDiv.style.padding = '10px 12px';
            centerDiv.style.borderRadius = '6px';
            centerDiv.style.border = '1px solid #ddd';
            
            const centerTitle = document.createElement('div');
            centerTitle.style.fontSize = '0.9rem';
            centerTitle.style.fontWeight = '600';
            centerTitle.style.color = '#1976d2';
            centerTitle.style.marginBottom = '8px';
            centerTitle.textContent = center;
            centerDiv.appendChild(centerTitle);
            
            const monthsDiv = document.createElement('div');
            monthsDiv.style.display = 'flex';
            monthsDiv.style.flexWrap = 'wrap';
            monthsDiv.style.gap = '6px';
            
            // 월별로 정렬 (최신순)
            const months = centerMap[center].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
            
            months.forEach(snapshot => {
              const monthBtn = document.createElement('button');
              const [year, month] = snapshot.yearMonth.split('-');
              // 데이터 타입에 따라 다른 카운트 표시
              const count = dataType === 'sales' 
                ? (snapshot.salesCount || 0)
                : (snapshot.memberCount || 0);
              const unit = dataType === 'sales' ? '건' : '명';
              const monthName = `${month}월 (${count}${unit})`;
              
              monthBtn.textContent = monthName;
              monthBtn.style.background = '#f5f5f5';
              monthBtn.style.color = '#333';
              monthBtn.style.border = '1px solid #ddd';
              monthBtn.style.padding = '5px 10px';
              monthBtn.style.borderRadius = '4px';
              monthBtn.style.cursor = 'pointer';
              monthBtn.style.fontSize = '0.8rem';
              monthBtn.style.transition = 'all 0.2s';
              
              monthBtn.onmouseover = () => {
                monthBtn.style.background = '#1976d2';
                monthBtn.style.color = '#fff';
                monthBtn.style.borderColor = '#1976d2';
              };
              
              monthBtn.onmouseout = () => {
                monthBtn.style.background = '#f5f5f5';
                monthBtn.style.color = '#333';
                monthBtn.style.borderColor = '#ddd';
              };
              
              monthBtn.onclick = () => {
                loadSnapshotData(center, snapshot.yearMonth, dataType);
              };
              
              monthsDiv.appendChild(monthBtn);
            });
            
            centerDiv.appendChild(monthsDiv);
            listEl.appendChild(centerDiv);
          });
          
          listEl.style.display = 'block';
        }
      } else {
        if (emptyEl) emptyEl.style.display = 'block';
      }
    } catch (error) {
      console.error('스냅샷 목록 로드 오류:', error);
      if (loadingEl) loadingEl.style.display = 'none';
      if (emptyEl) {
        emptyEl.textContent = '데이터를 불러오는 중 오류가 발생했습니다.';
        emptyEl.style.display = 'block';
      }
    }
  }
  
  // 스냅샷 데이터 불러오기
  async function loadSnapshotData(center, yearMonth, dataType = null) {
    const resultDiv = document.getElementById('database-load-result');
    
    // dataType이 전달되지 않으면 현재 선택된 타입 사용
    if (!dataType) {
      dataType = getSelectedDataType();
    }
    
    // 다른 타입의 정보 숨기기 및 초기화
    clearOtherDataType(dataType);
    
    if (resultDiv) {
      resultDiv.textContent = '불러오는 중...';
      resultDiv.style.color = '#1976d2';
    }
    
    try {
      if (dataType === 'sales') {
        // 매출정보 불러오기
        const url = `/api/database/sales-snapshots?yearMonth=${encodeURIComponent(yearMonth)}&center=${encodeURIComponent(center)}`;
        const res = await fetch(url);
        const result = await res.json();
        
        if (res.ok && result.sales && result.sales.length > 0) {
          // 데이터 저장
          window.databaseAllSales = result.sales;
          
          // 필터링 UI 숨기기
          const salesNameSection = document.getElementById('database-sales-name-select-section');
          const salesFilterSection = document.getElementById('database-sales-filter-section');
          if (salesNameSection) salesNameSection.style.display = 'none';
          if (salesFilterSection) salesFilterSection.style.display = 'none';
          
          // 데이터만 표시 (필터링 없이)
          displaySales(window.databaseAllSales, []);
          
          // DB 저장 버튼 표시 및 이벤트 리스너 연결
          const saveBtn = document.getElementById('database-sales-save-btn');
          if (saveBtn) {
            saveBtn.style.display = 'inline-block';
            // 이벤트 리스너 연결 (버튼이 표시될 때)
            saveBtn.onclick = null;
            saveBtn.addEventListener('click', handleSalesSaveButtonClick);
          }
          
          if (resultDiv) {
            resultDiv.textContent = `불러오기 완료! ${result.total}건의 매출정보를 불러왔습니다.`;
            resultDiv.style.color = '#4caf50';
          }
        } else {
          if (resultDiv) {
            resultDiv.textContent = '저장된 매출정보가 없습니다.';
            resultDiv.style.color = '#d32f2f';
          }
        }
      } else {
        // 회원정보 불러오기
        const url = `/api/database/snapshots?yearMonth=${encodeURIComponent(yearMonth)}&center=${encodeURIComponent(center)}`;
        const res = await fetch(url);
        const result = await res.json();
        
        if (res.ok && result.members && result.members.length > 0) {
          // 데이터 저장
          window.databaseAllMembers = result.members;
          
          // 필터링 UI 숨기기
          const productSelectSection = document.getElementById('database-product-select-section');
          const visitCriteriaSection = document.getElementById('database-visit-criteria-section');
          const filterSection = document.getElementById('database-filter-section');
          if (productSelectSection) productSelectSection.style.display = 'none';
          if (visitCriteriaSection) visitCriteriaSection.style.display = 'none';
          if (filterSection) filterSection.style.display = 'none';
          
          // 데이터만 표시 (필터링 없이)
          displayMembers(window.databaseAllMembers, [], false);
          
          // DB 저장 버튼 표시
          const saveBtn = document.getElementById('database-save-btn');
          if (saveBtn) {
            saveBtn.style.display = 'inline-block';
          }
          
          if (resultDiv) {
            resultDiv.textContent = `불러오기 완료! ${result.total}명의 데이터를 불러왔습니다.`;
            resultDiv.style.color = '#4caf50';
          }
        } else {
          if (resultDiv) {
            resultDiv.textContent = '저장된 데이터가 없습니다.';
            resultDiv.style.color = '#d32f2f';
          }
        }
      }
    } catch (error) {
      console.error('불러오기 오류:', error);
      if (resultDiv) {
        resultDiv.textContent = '불러오기 중 오류가 발생했습니다.';
        resultDiv.style.color = '#d32f2f';
      }
    }
  }
  
  // 센터 목록 로드 (저장용)
  async function loadCentersForSave() {
    try {
      const res = await fetch('/api/centers');
      const centers = await res.json();
      const select = document.getElementById('database-save-center');
      if (select) {
        select.innerHTML = '<option value="">센터를 선택하세요</option>';
        centers.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.name;
          opt.textContent = c.name;
          select.appendChild(opt);
        });
      }
    } catch (error) {
      console.error('센터 목록 로드 오류:', error);
    }
  }
  
  // 초기 연도 표시 및 스냅샷 목록 로드
  updateYearDisplay();
  loadSnapshotsList();
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
  // 매출정보 관련 UI 숨기기
  const salesSection = document.getElementById('database-sales-section');
  const salesNameSection = document.getElementById('database-sales-name-select-section');
  const salesFilterSection = document.getElementById('database-sales-filter-section');
  const salesSaveBtn = document.getElementById('database-sales-save-btn');
  if (salesSection) salesSection.style.display = 'none';
  if (salesNameSection) salesNameSection.style.display = 'none';
  if (salesFilterSection) salesFilterSection.style.display = 'none';
  if (salesSaveBtn) salesSaveBtn.style.display = 'none';
  
  // 재등록 현황 결과 숨기기
  const renewalResultsSection = document.getElementById('database-renewal-results-section');
  if (renewalResultsSection) renewalResultsSection.style.display = 'none';
  
  // 신규등록 현황 결과 숨기기
  const newRegistrationResultsSection = document.getElementById('database-new-registration-results-section');
  if (newRegistrationResultsSection) newRegistrationResultsSection.style.display = 'none';
  
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
  
  // 필터링된 멤버를 전역 변수에 저장 (DB 저장 시 사용)
  window.databaseFilteredMembers = filteredMembers;
  
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

// 매출 이름 선택 UI 생성
function displaySalesNameSelectors(salesNames) {
  const section = document.getElementById('database-sales-name-select-section');
  const checkboxesDiv = document.getElementById('database-sales-name-checkboxes');
  
  if (!salesNames || salesNames.length === 0) {
    if (section) section.style.display = 'none';
    return;
  }
  
  if (section) section.style.display = 'block';
  if (checkboxesDiv) {
    checkboxesDiv.innerHTML = '';
    
    salesNames.forEach(salesName => {
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
      checkbox.value = salesName;
      checkbox.checked = true; // 기본적으로 모두 선택
      checkbox.style.marginRight = '8px';
      checkbox.style.cursor = 'pointer';
      
      const span = document.createElement('span');
      span.textContent = salesName;
      
      label.appendChild(checkbox);
      label.appendChild(span);
      checkboxesDiv.appendChild(label);
    });
  }
}

// 선택된 매출 이름 가져오기
function getSelectedSalesNames() {
  const checkboxes = document.querySelectorAll('#database-sales-name-checkboxes input[type="checkbox"]:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

// 매출 정보 표시 (필터링 적용)
function displaySales(sales, selectedSalesNames = []) {
  // 회원정보 관련 UI 숨기기
  const memberSection = document.getElementById('database-members-section');
  const productSelectSection = document.getElementById('database-product-select-section');
  const visitCriteriaSection = document.getElementById('database-visit-criteria-section');
  const filterSection = document.getElementById('database-filter-section');
  const saveBtn = document.getElementById('database-save-btn');
  if (memberSection) memberSection.style.display = 'none';
  if (productSelectSection) productSelectSection.style.display = 'none';
  if (visitCriteriaSection) visitCriteriaSection.style.display = 'none';
  if (filterSection) filterSection.style.display = 'none';
  if (saveBtn) saveBtn.style.display = 'none';
  
  // 재등록 현황 결과 숨기기
  const renewalResultsSection = document.getElementById('database-renewal-results-section');
  if (renewalResultsSection) renewalResultsSection.style.display = 'none';
  
  // 신규등록 현황 결과 숨기기
  const newRegistrationResultsSection = document.getElementById('database-new-registration-results-section');
  if (newRegistrationResultsSection) newRegistrationResultsSection.style.display = 'none';
  
  const section = document.getElementById('database-sales-section');
  const loading = document.getElementById('database-sales-loading');
  const tableContainer = document.getElementById('database-sales-table-container');
  const emptyDiv = document.getElementById('database-sales-empty');
  const tableBody = document.getElementById('database-sales-table-body');
  const totalCount = document.getElementById('database-sales-total-count');
  
  if (section) section.style.display = 'block';
  if (loading) loading.style.display = 'none';
  
  if (!sales || sales.length === 0) {
    if (emptyDiv) emptyDiv.style.display = 'block';
    if (tableContainer) tableContainer.style.display = 'none';
    if (totalCount) totalCount.textContent = '';
    return;
  }
  
  // 필터링
  let filteredSales = sales;
  if (selectedSalesNames.length > 0) {
    filteredSales = sales.filter(sale => {
      if (!sale.salesNames || sale.salesNames.length === 0) return false;
      // 선택된 매출 이름 중 하나라도 포함되어 있으면 표시
      return sale.salesNames.some(salesName => selectedSalesNames.includes(salesName));
    });
  }
  
  // 필터링된 데이터 저장 (엑셀 다운로드용)
  window.databaseFilteredSales = filteredSales;
  
  if (totalCount) {
    totalCount.textContent = `총 ${filteredSales.length}건`;
  }
  
  if (filteredSales.length === 0) {
    if (emptyDiv) emptyDiv.style.display = 'block';
    if (tableContainer) tableContainer.style.display = 'none';
    return;
  }
  
  if (emptyDiv) emptyDiv.style.display = 'none';
  if (tableContainer) tableContainer.style.display = 'block';
  
  if (tableBody) {
    tableBody.innerHTML = '';
    
    filteredSales.forEach(sale => {
      const row = document.createElement('tr');
      row.style.borderBottom = '1px solid #eee';
      
      // 회원 이름
      const nameCell = document.createElement('td');
      nameCell.style.padding = '12px 8px';
      nameCell.textContent = sale.memberName || '';
      row.appendChild(nameCell);
      
      // 연락처
      const phoneCell = document.createElement('td');
      phoneCell.style.padding = '12px 8px';
      phoneCell.textContent = sale.phone || '';
      row.appendChild(phoneCell);
      
      // 매출 이름 (배열을 쉼표로 구분)
      const salesNamesCell = document.createElement('td');
      salesNamesCell.style.padding = '12px 8px';
      salesNamesCell.textContent = (sale.salesNames || []).join(', ');
      row.appendChild(salesNamesCell);
      
      tableBody.appendChild(row);
    });
  }
  
  // 정렬 기능 설정
  setupSalesSorting();
  
  // DB 저장 버튼 이벤트 리스너 연결 (버튼이 표시될 때마다)
  const salesSaveBtn = document.getElementById('database-sales-save-btn');
  if (salesSaveBtn && typeof handleSalesSaveButtonClick === 'function') {
    // 기존 이벤트 리스너 제거 후 새로 연결
    salesSaveBtn.onclick = null;
    salesSaveBtn.removeEventListener('click', handleSalesSaveButtonClick);
    salesSaveBtn.addEventListener('click', handleSalesSaveButtonClick);
  }
}

// 매출정보 정렬 상태
let currentSalesSort = { column: null, direction: 'asc' };

// 매출정보 정렬 기능 설정
function setupSalesSorting() {
  const table = document.getElementById('database-sales-table');
  if (!table) return;
  
  if (!table.dataset.salesSortListenerAdded) {
    table.addEventListener('click', (e) => {
      const header = e.target.closest('.sortable');
      if (!header) return;
      
      const column = header.getAttribute('data-sort');
      if (!column) return;
      
      // 같은 컬럼 클릭 시 정렬 방향 전환
      if (currentSalesSort.column === column) {
        currentSalesSort.direction = currentSalesSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSalesSort.column = column;
        currentSalesSort.direction = 'asc';
      }
      
      // 정렬 아이콘 업데이트
      const allHeaders = table.querySelectorAll('.sortable');
      allHeaders.forEach(h => {
        const icon = h.querySelector('.sort-icon');
        if (h === header) {
          icon.textContent = currentSalesSort.direction === 'asc' ? '↑' : '↓';
          icon.style.color = '#1976d2';
        } else {
          icon.textContent = '↕';
          icon.style.color = '#999';
        }
      });
      
      // 정렬 적용
      applySalesSorting();
    });
    
    table.dataset.salesSortListenerAdded = 'true';
  }
}

// 매출정보 정렬 적용
function applySalesSorting() {
  const sales = window.databaseFilteredSales || window.databaseAllSales || [];
  const selectedSalesNames = getSelectedSalesNames();
  
  let sortedSales = [...sales];
  
  if (currentSalesSort.column) {
    sortedSales.sort((a, b) => {
      let aVal = a[currentSalesSort.column] || '';
      let bVal = b[currentSalesSort.column] || '';
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (aVal < bVal) return currentSalesSort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return currentSalesSort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }
  
  displaySales(sortedSales, selectedSalesNames);
}

// 매출정보 필터링 기능 설정
function setupSalesFiltering() {
  const applyBtn = document.getElementById('database-apply-sales-filter-btn');
  const selectAllBtn = document.getElementById('database-select-all-sales-btn');
  const deselectAllBtn = document.getElementById('database-deselect-all-sales-btn');
  
  if (!applyBtn || !selectAllBtn || !deselectAllBtn) return;
  
  const refreshDisplay = () => {
    const selectedSalesNames = getSelectedSalesNames();
    displaySales(window.databaseAllSales, selectedSalesNames);
  };
  
  applyBtn.onclick = refreshDisplay;
  
  selectAllBtn.onclick = () => {
    const checkboxes = document.querySelectorAll('#database-sales-name-checkboxes input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
    refreshDisplay();
  };
  
  deselectAllBtn.onclick = () => {
    const checkboxes = document.querySelectorAll('#database-sales-name-checkboxes input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    refreshDisplay();
  };
  
  // 엑셀 다운로드 버튼
  const downloadBtn = document.getElementById('database-sales-download-excel-btn');
  if (downloadBtn) {
    downloadBtn.onclick = () => {
      const sales = window.databaseFilteredSales || window.databaseAllSales || [];
      if (sales.length === 0) {
        alert('다운로드할 데이터가 없습니다.');
        return;
      }
      
      // CSV 생성
      let csv = '회원 이름,연락처,매출 이름\n';
      sales.forEach(sale => {
        const name = (sale.memberName || '').replace(/,/g, '');
        const phone = (sale.phone || '').replace(/,/g, '');
        const salesNames = (sale.salesNames || []).join('; ').replace(/,/g, '');
        csv += `${name},${phone},${salesNames}\n`;
      });
      
      // Blob 생성 및 다운로드
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const filename = `매출정보_${dateStr}.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };
  }
}
