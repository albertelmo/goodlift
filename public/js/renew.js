// Renew (재등록 현황) 탭 기능

let currentRenewalsData = {}; // 현재 재등록 현황 데이터를 저장

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
        <h3 id="renew-title" style="margin:0;color:#1976d2;font-size:1.2rem;cursor:pointer;user-select:none;transition:opacity 0.2s;" title="클릭하여 새로고침" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">재등록 현황</h3>
        <div style="display:flex;gap:12px;align-items:center;">
          <button id="renew-add-btn" class="header-text-btn" style="white-space:nowrap;font-size:15px !important;background:#e3f2fd !important;color:#1976d2 !important;">추가</button>
          <div class="date-navigation">
            <button id="renew-prev-btn" class="nav-btn">◀</button>
            <span id="renew-current-date" class="current-date"></span>
            <button id="renew-next-btn" class="nav-btn">▶</button>
          </div>
        </div>
      </div>
      <div id="renew-loading" style="text-align:center;padding:40px;color:#888;display:none;">불러오는 중...</div>
      <div id="renew-content"></div>
    </div>
  `;
  
  // 날짜 표시 업데이트
  updateDateDisplay();
  
  // 이벤트 리스너 설정
  container.querySelector('#renew-prev-btn').addEventListener('click', () => {
    navigateDate(-1, container);
  });
  
  container.querySelector('#renew-next-btn').addEventListener('click', () => {
    navigateDate(1, container);
  });
  
  container.querySelector('#renew-add-btn').addEventListener('click', () => {
    showRenewAddModal();
  });
  
  container.querySelector('#renew-title').addEventListener('click', () => {
    loadRenewData(container);
  });
  
  // 초기 데이터 로드
  loadRenewData(container);
}

function navigateDate(delta, container) {
  const newDate = new Date(currentDate);
  newDate.setMonth(newDate.getMonth() + delta);
  currentDate = newDate;
  updateDateDisplay();
  loadRenewData(container);
}

function updateDateDisplay() {
  const dateElement = document.querySelector('#renew-current-date');
  if (!dateElement) return;
  
  const koreanCurrentDate = new Date(currentDate);
  dateElement.textContent = koreanCurrentDate.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long'
  });
}

function loadRenewData(container) {
  const yearMonth = getSelectedYearMonth();
  fetch('/api/centers')
    .then(r => r.json())
    .then(centers => {
      const centerOrder = centers.map(c => c.name);
      loadRenewSessions(yearMonth, centerOrder);
    })
    .catch(err => {
      console.error('센터 목록 조회 오류:', err);
      loadRenewSessions(yearMonth, []);
    });
}

function loadRenewSessions(yearMonth, centerOrder) {
  const loadingEl = document.getElementById('renew-loading');
  const contentEl = document.getElementById('renew-content');
  
  loadingEl.style.display = 'block';
  contentEl.innerHTML = '';
  
  fetch(`/api/renewals?month=${yearMonth}`)
    .then(r => r.json())
    .then(data => {
      currentRenewalsData = data; // 현재 데이터 저장
      loadingEl.style.display = 'none';
      renderRenewSessions(data, centerOrder);
    })
    .catch(err => {
      loadingEl.style.display = 'none';
      contentEl.innerHTML = `<div style="text-align:center;padding:40px;color:#d32f2f;">데이터를 불러오지 못했습니다.</div>`;
      console.error('재등록 현황 조회 오류:', err);
    });
}

function renderRenewSessions(data, centerOrder) {
  const contentEl = document.getElementById('renew-content');
  
  if (!data || Object.keys(data).length === 0) {
    contentEl.innerHTML = `<div style="text-align:center;padding:40px;color:#888;">재등록 현황이 없습니다.</div>`;
    return;
  }
  
  // 센터 순서대로 정렬
  const sortedCenters = centerOrder.length > 0
    ? Object.keys(data).sort((a, b) => {
        const indexA = centerOrder.indexOf(a);
        const indexB = centerOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b, 'ko');
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      })
    : Object.keys(data).sort((a, b) => a.localeCompare(b, 'ko'));
  
  let html = '';
  sortedCenters.forEach(center => {
    const renewals = data[center] || [];
    if (renewals.length === 0) return;
    
    // 통계 계산 (이월 회원 제외, 만료 회원은 실제 수업수 0으로 처리)
    let totalExpectedSessions = 0;
    let totalActualSessions = 0;
    let totalMembers = 0;
    let completedMembers = 0;
    
    renewals.forEach(renewal => {
      const memberNames = renewal.member_names || [];
      const expectedSessions = renewal.expected_sessions || {};
      const actualSessions = renewal.actual_sessions || {};
      const statuses = renewal.status || {};
      
      memberNames.forEach(memberName => {
        const status = statuses[memberName] || '예상';
        // 이월 회원 제외
        if (status === '이월') return;
        
        totalMembers++;
        if (status === '완료') completedMembers++;
        
        const expected = expectedSessions[memberName] || 0;
        // 만료 회원은 실제 수업수를 0으로 처리
        const actual = (status === '만료') ? 0 : (actualSessions[memberName] || 0);
        
        totalExpectedSessions += expected;
        totalActualSessions += actual;
      });
    });
    
    const sessionRatio = totalExpectedSessions > 0 ? (totalActualSessions / totalExpectedSessions * 100).toFixed(1) : 0;
    const memberRatio = totalMembers > 0 ? ((completedMembers / totalMembers) * 100).toFixed(1) : 0;
    
    html += `
      <div style="margin-bottom:32px;">
        <h4 style="margin:0 0 16px 0;color:#1976d2;font-size:1.1rem;font-weight:600;">
          ${center}
          <span style="margin-left:12px;font-size:0.85rem;font-weight:normal;color:#666;">
            수업: ${totalActualSessions}/${totalExpectedSessions} (${sessionRatio}%), 회원: ${completedMembers}/${totalMembers} (${memberRatio}%)
          </span>
        </h4>
        <div style="display:flex;flex-wrap:wrap;gap:16px;">
          ${renewals.map(renewal => {
            const memberNames = renewal.member_names || [];
            const expectedSessions = renewal.expected_sessions || {};
            const actualSessions = renewal.actual_sessions || {};
            const statuses = renewal.status || {};
            
            // 회원 목록을 상태 순서대로 정렬 (예상 > 완료 > 이월 > 만료)
            const statusOrder = { '예상': 1, '완료': 2, '이월': 3, '만료': 4 };
            const sortedMemberNames = [...memberNames].sort((a, b) => {
              const statusA = statuses[a] || '예상';
              const statusB = statuses[b] || '예상';
              const orderA = statusOrder[statusA] || 5;
              const orderB = statusOrder[statusB] || 5;
              
              // 상태 순서가 같으면 이름순으로 정렬
              if (orderA === orderB) {
                return a.localeCompare(b, 'ko');
              }
              return orderA - orderB;
            });
            
            const tableRows = sortedMemberNames.map(memberName => {
              const expected = expectedSessions[memberName] || 0;
              const actual = actualSessions[memberName] !== undefined ? actualSessions[memberName] : null;
              const status = statuses[memberName] || '예상';
              const statusColor = status === '완료' ? '#2196f3' : status === '만료' ? '#f44336' : status === '이월' ? '#ff9800' : '#000000';
              
              return `
                <tr style="border-bottom:1px solid #f0f0f0;">
                  <td style="padding:4px 3px;font-size:0.75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60px;">
                    <span class="renew-member-name" data-member-name="${memberName}" style="cursor:pointer;color:#1976d2;text-decoration:underline;text-decoration-color:rgba(25,118,210,0.3);" onmouseover="this.style.textDecorationColor='#1976d2'" onmouseout="this.style.textDecorationColor='rgba(25,118,210,0.3)'">${memberName}</span>
                  </td>
                  <td style="padding:4px 3px;font-size:0.75rem;text-align:right;">${expected}</td>
                  <td style="padding:4px 3px;font-size:0.75rem;text-align:right;">
                    ${actual !== null && actual !== undefined && actual !== 0 ? actual : '-'}
                  </td>
                  <td style="padding:4px 3px;font-size:0.7rem;text-align:center;">
                    <span style="color:${statusColor};font-weight:600;">${status}</span>
                  </td>
                </tr>
              `;
            }).join('')
            
            return `
              <div class="renew-trainer-table" style="flex:0 0 calc(33.333% - 11px);min-width:200px;max-width:none;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,0.1);border-radius:8px;overflow:hidden;">
                <div style="background:#f5f5f5;border-bottom:2px solid #ddd;padding:8px 6px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
                    <div style="font-weight:600;color:#1976d2;font-size:0.85rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${renewal.trainer}</div>
                    <button class="renew-edit-btn header-text-btn" data-renewal-id="${renewal.id}" data-renewal-data='${JSON.stringify(renewal)}' style="background:#e3f2fd !important;color:#1976d2 !important;border:none;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:0.7rem;white-space:nowrap;flex-shrink:0;">수정</button>
                  </div>
                </div>
                <table style="width:100%;border-collapse:collapse;">
                  <thead>
                    <tr style="background:#fafafa;border-bottom:1px solid #e0e0e0;">
                      <th style="padding:4px 3px;text-align:left;font-size:0.7rem;font-weight:600;color:#666;white-space:nowrap;">회원명</th>
                      <th style="padding:4px 3px;text-align:right;font-size:0.7rem;font-weight:600;color:#666;white-space:nowrap;">예상</th>
                      <th style="padding:4px 3px;text-align:right;font-size:0.7rem;font-weight:600;color:#666;white-space:nowrap;">결과</th>
                      <th style="padding:4px 3px;text-align:center;font-size:0.7rem;font-weight:600;color:#666;white-space:nowrap;">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tableRows}
                  </tbody>
                </table>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });
  
  contentEl.innerHTML = html;
  
  // 모바일 환경에서 테이블 컬럼 너비 조정 및 카드 레이아웃 조정
  const isMobile = window.innerWidth <= 600;
  if (isMobile) {
    // 모바일에서 카드가 한 줄에 2개씩 나오도록 조정
    document.querySelectorAll('.renew-trainer-table').forEach(card => {
      card.style.flex = '0 0 calc(50% - 8px)';
      card.style.minWidth = '140px';
    });
    
    document.querySelectorAll('.renew-trainer-table table').forEach(table => {
      // 헤더 셀 조정
      const headers = table.querySelectorAll('thead th');
      headers.forEach((th, colIndex) => {
        if (colIndex === 0) {
          // 회원명 컬럼
          th.style.padding = '2px 1px';
          th.style.fontSize = '0.6rem';
          th.style.maxWidth = '35px';
        } else {
          // 예상, 결과, 상태 컬럼
          th.style.padding = '2px 1px';
          th.style.fontSize = '0.6rem';
          th.style.minWidth = '25px';
          th.style.maxWidth = '30px';
        }
      });
      
      // 본문 셀 조정
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        cells.forEach((td, colIndex) => {
          if (colIndex === 0) {
            // 회원명 컬럼
            td.style.padding = '2px 1px';
            td.style.fontSize = '0.6rem';
            td.style.maxWidth = '35px';
          } else {
            // 예상, 결과, 상태 컬럼
            td.style.padding = '2px 1px';
            td.style.fontSize = '0.6rem';
            td.style.minWidth = '25px';
            td.style.maxWidth = '30px';
          }
        });
      });
    });
  }
  
  // 수정 버튼 이벤트 리스너
  setupRenewEditListeners();
  
  // 회원명 클릭 이벤트 리스너
  setupMemberNameClickListeners();
}

function setupRenewEditListeners() {
  document.querySelectorAll('.renew-edit-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const renewalData = JSON.parse(this.getAttribute('data-renewal-data'));
      showRenewEditModal(renewalData);
    });
  });
}

async function setupMemberNameClickListeners() {
  document.querySelectorAll('.renew-member-name').forEach(element => {
    element.addEventListener('click', async function() {
      const memberName = this.getAttribute('data-member-name');
      await showMemberInfoPopup(memberName, this);
    });
  });
}

async function showMemberInfoPopup(memberName, triggerElement) {
  try {
    // 회원 정보 조회
    const response = await fetch(`/api/members?trainer=${encodeURIComponent('')}`);
    const members = await response.json();
    const member = members.find(m => m.name === memberName);
    
    if (!member) {
      alert('회원 정보를 찾을 수 없습니다.');
      return;
    }
    
    // 이번달 완료한 수업수 조회
    const yearMonth = getSelectedYearMonth();
    const [year, month] = yearMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    
    // 세션 조회 (이번달 날짜 범위로 조회)
    const sessionsResponse = await fetch(`/api/sessions?startDate=${startDate}&endDate=${endDate}&member=${encodeURIComponent(memberName)}`);
    const allSessions = await sessionsResponse.json();
    
    // 완료된 세션만 필터링
    const completedSessions = allSessions.filter(session => session.status === '완료');
    const completedCount = completedSessions.length;
    
    // 기존 팝업 제거
    const existingPopup = document.querySelector('.renew-member-info-popup');
    if (existingPopup) {
      existingPopup.remove();
    }
    
    // 팝업 생성
    const popup = document.createElement('div');
    popup.className = 'renew-member-info-popup';
    popup.style.cssText = `
      position: fixed;
      z-index: 1002;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding: 16px 20px;
      min-width: 200px;
      max-width: 300px;
      font-size: 0.9rem;
      border: 1px solid #e0e0e0;
    `;
    
    // 트리거 요소의 위치 계산 (뷰포트 기준)
    const rect = triggerElement.getBoundingClientRect();
    
    // 팝업 위치 설정 (트리거 요소 아래, 오른쪽)
    const popupWidth = 250;
    const popupHeight = 120;
    const margin = 8;
    
    let top = rect.bottom + margin;
    let left = rect.left;
    
    // 화면 밖으로 나가지 않도록 조정 (뷰포트 기준)
    if (left + popupWidth > window.innerWidth) {
      left = window.innerWidth - popupWidth - margin;
    }
    if (left < margin) {
      left = margin;
    }
    
    if (top + popupHeight > window.innerHeight) {
      // 아래 공간이 부족하면 위쪽에 표시
      top = rect.top - popupHeight - margin;
      if (top < margin) {
        // 위쪽도 부족하면 화면 중앙에 표시
        top = (window.innerHeight - popupHeight) / 2;
      }
    }
    
    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
    
    // 팝업 내용
    popup.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid #e0e0e0;padding-bottom:8px;">
        <h4 style="margin:0;color:#1976d2;font-size:1rem;font-weight:600;">회원 정보</h4>
        <button class="renew-member-info-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:#666;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#666;font-weight:500;">회원명:</span>
          <span style="color:#333;font-weight:600;">${member.name}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#666;font-weight:500;">이번달 완료:</span>
          <span style="color:#4caf50;font-weight:600;">${completedCount}회</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#666;font-weight:500;">잔여세션:</span>
          <span style="color:#1976d2;font-weight:600;">${member.remainSessions || 0}회</span>
        </div>
      </div>
    `;
    
    document.body.appendChild(popup);
    
    // 닫기 버튼 이벤트
    popup.querySelector('.renew-member-info-close').addEventListener('click', () => {
      popup.remove();
    });
    
    // 배경 클릭 시 닫기
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      z-index: 1001;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: transparent;
    `;
    document.body.appendChild(overlay);
    
    overlay.addEventListener('click', () => {
      popup.remove();
      overlay.remove();
    });
    
    // ESC 키로 닫기
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        popup.remove();
        overlay.remove();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
    
  } catch (error) {
    console.error('회원 정보 조회 오류:', error);
    alert('회원 정보를 불러오는 중 오류가 발생했습니다.');
  }
}

async function showRenewEditModal(renewal) {
  // 트레이너 username 확인 (데이터에 trainer_username이 있으면 사용, 없으면 trainer로 매핑)
  let trainerUsername = renewal.trainer_username;
  if (!trainerUsername) {
    // trainer 이름을 username으로 변환 필요 (API에서 제공하지 않으면 그대로 사용)
    const trainersResponse = await fetch('/api/trainers');
    const trainers = await trainersResponse.json();
    const trainer = trainers.find(t => t.name === renewal.trainer);
    trainerUsername = trainer ? trainer.username : renewal.trainer;
  }
  
  const memberNames = renewal.member_names || [];
  const expectedSessions = renewal.expected_sessions || {};
  const actualSessions = renewal.actual_sessions || {};
  const statuses = renewal.status || {};
  
  // 회원 목록 조회
  const membersResponse = await fetch(`/api/members-by-trainer-center?trainer=${trainerUsername}&center=${encodeURIComponent(renewal.center)}`);
  const allMembers = await membersResponse.json();
  
  // 기존 회원들 HTML
  const existingMembersHTML = memberNames.map(memberName => {
    const expected = expectedSessions[memberName] || 0;
    const actual = actualSessions[memberName] !== undefined && actualSessions[memberName] !== null ? actualSessions[memberName] : 0;
    const status = statuses[memberName] || '예상';
    return `
      <div class="renew-edit-member-item" data-member="${memberName}" style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #e0e0e0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <label style="display:flex;align-items:center;gap:8px;font-size:0.9rem;font-weight:600;color:#333;cursor:pointer;">
            <input type="checkbox" class="renew-edit-member-checkbox" checked style="width:18px;height:18px;cursor:pointer;">
            <span>${memberName}</span>
            <span style="font-size:0.85rem;color:#888;font-weight:normal;">(예상: ${expected})</span>
          </label>
        </div>
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-left:26px;padding:12px;background:#f9f9f9;border-radius:6px;">
          <div style="flex:1;min-width:100px;">
            <label style="display:block;font-size:0.8rem;color:#666;margin-bottom:4px;font-weight:600;">예상</label>
            <input type="number" class="renew-edit-expected-input" data-member="${memberName}" value="${expected}" min="1" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
          </div>
          <div style="flex:1;min-width:100px;">
            <label style="display:block;font-size:0.8rem;color:#666;margin-bottom:4px;font-weight:600;">결과</label>
            <input type="number" class="renew-edit-actual-sessions-input" data-member="${memberName}" value="${actual}" min="0" placeholder="결과 수업수" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
          </div>
          <div style="flex:1;min-width:100px;">
            <label style="display:block;font-size:0.8rem;color:#666;margin-bottom:4px;font-weight:600;">상태</label>
            <select class="renew-edit-status-select" data-member="${memberName}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
              <option value="예상" ${status === '예상' ? 'selected' : ''}>예상</option>
              <option value="완료" ${status === '완료' ? 'selected' : ''}>완료</option>
              <option value="이월" ${status === '이월' ? 'selected' : ''}>이월</option>
              <option value="만료" ${status === '만료' ? 'selected' : ''}>만료</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // 새로운 회원 추가 섹션 HTML
  const availableMembers = allMembers.filter(m => !memberNames.includes(m.name));
  const newMembersHTML = availableMembers.length > 0 ? `
    <div style="margin-top:24px;padding-top:24px;border-top:2px solid #ddd;">
      <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:12px;">회원 추가</label>
      <div id="renew-edit-new-members-list" style="max-height:200px;overflow-y:auto;border:1px solid #ddd;border-radius:6px;padding:10px;background:#f9f9f9;">
        ${availableMembers.map(member => `
          <label style="display:flex;align-items:center;padding:8px;cursor:pointer;border-radius:4px;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#e3f2fd'" onmouseout="this.style.backgroundColor='transparent'">
            <input type="checkbox" class="renew-edit-new-member-checkbox" value="${member.name}" style="margin-right:8px;width:18px;height:18px;cursor:pointer;">
            <span style="flex:1;font-size:0.9rem;">${member.name} (잔여: ${member.remainSessions})</span>
          </label>
        `).join('')}
      </div>
      <div id="renew-edit-new-members-inputs" style="margin-top:12px;display:none;">
        ${availableMembers.map(member => `
          <div class="renew-edit-new-member-input-item" data-member="${member.name}" style="margin-bottom:12px;padding:12px;background:#f0f7ff;border-radius:6px;display:none;">
            <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:4px;">${member.name}</label>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <input type="number" class="renew-edit-new-expected-input" data-member="${member.name}" min="1" placeholder="예상 수업수" style="width:120px;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
              <input type="number" class="renew-edit-new-actual-input" data-member="${member.name}" min="0" placeholder="실제 수업수" style="width:120px;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
                     <select class="renew-edit-new-status-select" data-member="${member.name}" style="min-width:100px;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;">
                       <option value="예상" selected>예상</option>
                       <option value="완료">완료</option>
                       <option value="이월">이월</option>
                       <option value="만료">만료</option>
                     </select>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';
  
  const modalHTML = `
    <div class="renew-edit-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="renew-edit-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:14px;box-shadow:0 8px 32px #1976d240;min-width:320px;max-width:95vw;width:auto;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;color:#1976d2;font-size:1.2rem;">재등록 수정</h3>
        <button id="renew-edit-modal-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      
      <form id="renew-edit-form" style="display:flex;flex-direction:column;gap:16px;">
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">센터</label>
          <input type="text" value="${renewal.center}" disabled style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;background:#f5f5f5;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">트레이너</label>
          <input type="text" value="${renewal.trainer}" disabled style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;background:#f5f5f5;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:12px;">회원별 재등록 정보 *</label>
          <div style="border:1px solid #ddd;border-radius:6px;padding:12px;background:#f9f9f9;">
            ${existingMembersHTML}
          </div>
        </div>
        
        ${newMembersHTML}
        
        <div id="renew-edit-result-message" style="min-height:24px;color:#d32f2f;font-size:0.85rem;"></div>
        
        <div style="display:flex;gap:10px;justify-content:space-between;align-items:center;margin-top:8px;">
          <button type="button" id="renew-edit-delete-btn" style="background:#d32f2f;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">삭제</button>
          <div style="display:flex;gap:10px;">
            <button type="button" id="renew-edit-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">취소</button>
            <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">저장</button>
          </div>
        </div>
      </form>
    </div>
  `;
  
  const existingOverlay = document.querySelector('.renew-edit-modal-overlay');
  const existingModal = document.querySelector('.renew-edit-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  document.getElementById('renew-edit-modal-close').addEventListener('click', closeRenewEditModal);
  document.getElementById('renew-edit-cancel-btn').addEventListener('click', closeRenewEditModal);
  document.querySelector('.renew-edit-modal-overlay').addEventListener('click', closeRenewEditModal);
  
  // 기존 회원 체크박스 이벤트 (체크 해제하면 삭제)
  document.querySelectorAll('.renew-edit-member-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      const memberItem = this.closest('.renew-edit-member-item');
      if (!this.checked) {
        memberItem.style.opacity = '0.5';
        memberItem.querySelectorAll('input, select').forEach(el => el.disabled = true);
      } else {
        memberItem.style.opacity = '1';
        memberItem.querySelectorAll('input, select').forEach(el => el.disabled = false);
      }
    });
  });
  
  // 새 회원 체크박스 이벤트
  if (availableMembers.length > 0) {
    document.querySelectorAll('.renew-edit-new-member-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', function() {
        const memberName = this.value;
        const inputItem = document.querySelector(`.renew-edit-new-member-input-item[data-member="${memberName}"]`);
        const inputsContainer = document.getElementById('renew-edit-new-members-inputs');
        
        if (this.checked) {
          inputItem.style.display = 'block';
          inputsContainer.style.display = 'block';
        } else {
          inputItem.style.display = 'none';
          const hasChecked = document.querySelectorAll('.renew-edit-new-member-checkbox:checked').length > 0;
          if (!hasChecked) {
            inputsContainer.style.display = 'none';
          }
        }
      });
    });
  }
  
  const renewalId = renewal.id; // 클로저 문제 방지를 위해 미리 저장
  
  // 삭제 버튼 클릭 이벤트
  document.getElementById('renew-edit-delete-btn').addEventListener('click', async function() {
    if (!confirm('정말로 이 재등록 현황을 삭제하시겠습니까?')) {
      return;
    }
    
    const deleteBtn = document.getElementById('renew-edit-delete-btn');
    deleteBtn.disabled = true;
    deleteBtn.textContent = '삭제 중...';
    
    try {
      const response = await fetch(`/api/renewals/${renewalId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '삭제에 실패했습니다.');
      }
      
      closeRenewEditModal();
      
      // 리스트 새로고침
      const container = document.querySelector('#renew-content')?.closest('[id^="tab-"]');
      if (container) {
        loadRenewData(container);
      }
    } catch (error) {
      console.error('재등록 현황 삭제 오류:', error);
      alert(error.message || '삭제에 실패했습니다.');
      deleteBtn.disabled = false;
      deleteBtn.textContent = '삭제';
    }
  });
  
  document.getElementById('renew-edit-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // 체크된 기존 회원들
    const checkedExistingBoxes = document.querySelectorAll('.renew-edit-member-checkbox:checked');
    const existingMemberNames = Array.from(checkedExistingBoxes).map(cb => {
      return cb.closest('.renew-edit-member-item').getAttribute('data-member');
    });
    
    // 체크된 새 회원들
    const checkedNewBoxes = document.querySelectorAll('.renew-edit-new-member-checkbox:checked');
    const newMemberNames = Array.from(checkedNewBoxes).map(cb => cb.value);
    
    // 최종 회원 목록
    const finalMemberNames = [...existingMemberNames, ...newMemberNames];
    
    if (finalMemberNames.length === 0) {
      document.getElementById('renew-edit-result-message').textContent = '최소 1명 이상의 회원을 선택해주세요.';
      return;
    }
    
    const expectedSessions = {};
    const actualSessions = {};
    const statuses = {};
    
    // 기존 회원 데이터 수집
    existingMemberNames.forEach(memberName => {
      const expectedInput = document.querySelector(`.renew-edit-expected-input[data-member="${memberName}"]`);
      const actualInput = document.querySelector(`.renew-edit-actual-sessions-input[data-member="${memberName}"]`);
      const statusSelect = document.querySelector(`.renew-edit-status-select[data-member="${memberName}"]`);
      
      if (expectedInput) expectedSessions[memberName] = Number(expectedInput.value) || 0;
      if (actualInput) actualSessions[memberName] = actualInput.value.trim() ? Number(actualInput.value) : 0;
      if (statusSelect) statuses[memberName] = statusSelect.value;
    });
    
    // 새 회원 데이터 수집
    newMemberNames.forEach(memberName => {
      const expectedInput = document.querySelector(`.renew-edit-new-expected-input[data-member="${memberName}"]`);
      const actualInput = document.querySelector(`.renew-edit-new-actual-input[data-member="${memberName}"]`);
      const statusSelect = document.querySelector(`.renew-edit-new-status-select[data-member="${memberName}"]`);
      
      if (expectedInput && expectedInput.value.trim()) {
        expectedSessions[memberName] = Number(expectedInput.value);
      } else {
        expectedSessions[memberName] = 0;
      }
      if (actualInput) {
        actualSessions[memberName] = actualInput.value.trim() ? Number(actualInput.value) : 0;
      }
      if (statusSelect) statuses[memberName] = statusSelect.value || '예상';
    });
    
    // 새 회원의 예상 수업수 검증
    const missingExpected = newMemberNames.filter(name => !expectedSessions[name] || expectedSessions[name] <= 0);
    if (missingExpected.length > 0) {
      document.getElementById('renew-edit-result-message').textContent = '새로 추가한 회원의 예상 수업수를 입력해주세요.';
      return;
    }
    
    const resultMsg = document.getElementById('renew-edit-result-message');
    resultMsg.textContent = '';
    
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '저장 중...';
    
    try {
      const response = await fetch(`/api/renewals/${renewalId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          member_names: finalMemberNames,
          expected_sessions: expectedSessions,
          actual_sessions: actualSessions,
          status: statuses
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '수정에 실패했습니다.');
      }
      
      closeRenewEditModal();
      // 데이터 다시 로드
      const yearMonth = getSelectedYearMonth();
      fetch('/api/centers')
        .then(r => r.json())
        .then(centers => {
          const centerOrder = centers.map(c => c.name);
          loadRenewSessions(yearMonth, centerOrder);
        })
        .catch(err => {
          console.error('센터 목록 조회 오류:', err);
          loadRenewSessions(yearMonth, []);
        });
    } catch (error) {
      console.error('Renewal 수정 오류:', error);
      resultMsg.textContent = '수정에 실패했습니다: ' + error.message;
      submitBtn.disabled = false;
      submitBtn.textContent = '저장';
    }
  });
}

function closeRenewEditModal() {
  const overlay = document.querySelector('.renew-edit-modal-overlay');
  const modal = document.querySelector('.renew-edit-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

async function showRenewAddModal() {
  // 센터 목록 조회
  const centersResponse = await fetch('/api/centers');
  const centers = await centersResponse.json();
  
  const modalHTML = `
    <div class="renew-edit-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="renew-edit-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:14px;box-shadow:0 8px 32px #1976d240;min-width:320px;max-width:95vw;width:auto;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;color:#1976d2;font-size:1.2rem;">재등록 추가</h3>
        <button id="renew-add-modal-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      
      <form id="renew-add-form" style="display:flex;flex-direction:column;gap:16px;">
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">센터 *</label>
          <select id="renew-add-center" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
            <option value="">선택</option>
            ${centers.map(center => `<option value="${center.name}">${center.name}</option>`).join('')}
          </select>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">트레이너 *</label>
          <select id="renew-add-trainer" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
            <option value="">센터를 먼저 선택하세요</option>
          </select>
          <div id="renew-add-trainer-warning" style="margin-top:6px;color:#d32f2f;font-size:0.85rem;display:none;"></div>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">회원 선택 *</label>
          <div id="renew-add-members-list" style="max-height:200px;overflow-y:auto;border:1px solid #ddd;border-radius:6px;padding:10px;background:#f9f9f9;">
            <div style="text-align:center;color:#888;padding:20px;">트레이너를 먼저 선택하세요</div>
          </div>
        </div>
        
        <div id="renew-add-expected-sessions-container" style="display:none;">
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:12px;">회원별 예상 재등록 수업수 *</label>
          <div id="renew-add-expected-sessions-list" style="border:1px solid #ddd;border-radius:6px;padding:12px;background:#f9f9f9;">
          </div>
        </div>
        
        <div id="renew-add-result-message" style="min-height:24px;color:#d32f2f;font-size:0.85rem;"></div>
        
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px;">
          <button type="button" id="renew-add-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">취소</button>
          <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">저장</button>
        </div>
      </form>
    </div>
  `;
  
  const existingOverlay = document.querySelector('.renew-edit-modal-overlay');
  const existingModal = document.querySelector('.renew-edit-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  document.getElementById('renew-add-modal-close').addEventListener('click', closeRenewAddModal);
  document.getElementById('renew-add-cancel-btn').addEventListener('click', closeRenewAddModal);
  document.querySelector('.renew-edit-modal-overlay').addEventListener('click', closeRenewAddModal);
  
  // 센터 선택 시 트레이너 목록 로드
  document.getElementById('renew-add-center').addEventListener('change', async function() {
    const center = this.value;
    const trainerSelect = document.getElementById('renew-add-trainer');
    const membersList = document.getElementById('renew-add-members-list');
    const expectedContainer = document.getElementById('renew-add-expected-sessions-container');
    const warningDiv = document.getElementById('renew-add-trainer-warning');
    
    if (!center) {
      trainerSelect.innerHTML = '<option value="">센터를 먼저 선택하세요</option>';
      membersList.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">트레이너를 먼저 선택하세요</div>';
      expectedContainer.style.display = 'none';
      warningDiv.style.display = 'none';
      return;
    }
    
    try {
      const trainersResponse = await fetch('/api/trainers');
      const trainers = await trainersResponse.json();
      
      trainerSelect.innerHTML = '<option value="">선택</option>';
      trainers.forEach(trainer => {
        const option = document.createElement('option');
        option.value = trainer.username;
        option.textContent = trainer.name;
        trainerSelect.appendChild(option);
      });
      
      membersList.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">트레이너를 선택하세요</div>';
      expectedContainer.style.display = 'none';
      warningDiv.style.display = 'none';
    } catch (error) {
      console.error('트레이너 목록 조회 오류:', error);
    }
  });
  
  // 트레이너 선택 시 회원 목록 로드 및 중복 체크
  document.getElementById('renew-add-trainer').addEventListener('change', async function() {
    const center = document.getElementById('renew-add-center').value;
    const trainer = this.value;
    const trainerName = this.options[this.selectedIndex].textContent;
    const membersList = document.getElementById('renew-add-members-list');
    const expectedContainer = document.getElementById('renew-add-expected-sessions-container');
    const expectedList = document.getElementById('renew-add-expected-sessions-list');
    const warningDiv = document.getElementById('renew-add-trainer-warning');
    
    if (!center || !trainer) {
      membersList.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">트레이너를 선택하세요</div>';
      expectedContainer.style.display = 'none';
      warningDiv.style.display = 'none';
      return;
    }
    
    // 중복 체크 (월별로 체크)
    const yearMonth = getSelectedYearMonth();
    const centerRenewals = currentRenewalsData[center] || [];
    const existingRenewal = centerRenewals.find(r => (r.trainer_username === trainer || r.trainer === trainerName));
    
    if (existingRenewal) {
      warningDiv.textContent = '이미 해당 센터/트레이너/월에 대한 재등록 현황이 존재합니다. 수정 기능을 사용해주세요.';
      warningDiv.style.display = 'block';
      membersList.innerHTML = '<div style="text-align:center;color:#d32f2f;padding:20px;">이미 등록된 트레이너입니다</div>';
      expectedContainer.style.display = 'none';
      this.disabled = true;
      return;
    } else {
      warningDiv.style.display = 'none';
      this.disabled = false;
    }
    
    try {
      const membersResponse = await fetch(`/api/members-by-trainer-center?trainer=${trainer}&center=${encodeURIComponent(center)}`);
      const members = await membersResponse.json();
      
      if (members.length === 0) {
        membersList.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">회원이 없습니다</div>';
        expectedContainer.style.display = 'none';
        return;
      }
      
      let html = '';
      members.forEach(member => {
        html += `
          <label style="display:flex;align-items:center;padding:8px;cursor:pointer;border-radius:4px;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#e3f2fd'" onmouseout="this.style.backgroundColor='transparent'">
            <input type="checkbox" class="renew-member-checkbox" value="${member.name}" style="margin-right:8px;width:18px;height:18px;cursor:pointer;">
            <span style="flex:1;font-size:0.9rem;">${member.name} (잔여: ${member.remainSessions})</span>
          </label>
        `;
      });
      
      membersList.innerHTML = html;
      expectedContainer.style.display = 'none';
      
      // 회원 체크박스 변경 시 예상 수업수 입력 필드 업데이트
      membersList.querySelectorAll('.renew-member-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
          updateExpectedSessionsInputs();
        });
      });
    } catch (error) {
      console.error('회원 목록 조회 오류:', error);
      membersList.innerHTML = '<div style="text-align:center;color:#d32f2f;padding:20px;">회원 목록을 불러오지 못했습니다</div>';
      expectedContainer.style.display = 'none';
    }
  });
  
  function updateExpectedSessionsInputs() {
    const checkedBoxes = document.querySelectorAll('.renew-member-checkbox:checked');
    const expectedContainer = document.getElementById('renew-add-expected-sessions-container');
    const expectedList = document.getElementById('renew-add-expected-sessions-list');
    
    if (checkedBoxes.length === 0) {
      expectedContainer.style.display = 'none';
      return;
    }
    
    const memberNames = Array.from(checkedBoxes).map(cb => cb.value);
    let html = '';
    memberNames.forEach(memberName => {
      html += `
        <div style="margin-bottom:12px;">
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:4px;">${memberName}</label>
          <input type="number" class="renew-add-expected-sessions-input" data-member="${memberName}" min="1" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;box-sizing:border-box;" placeholder="예상 수업수">
        </div>
      `;
    });
    
    expectedList.innerHTML = html;
    expectedContainer.style.display = 'block';
  }
  
  // 폼 제출 이벤트
  document.getElementById('renew-add-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const center = document.getElementById('renew-add-center').value;
    const trainer = document.getElementById('renew-add-trainer').value;
    const yearMonth = getSelectedYearMonth();
    
    // 중복 체크 (한번 더 확인)
    const centerRenewals = currentRenewalsData[center] || [];
    const trainerSelect = document.getElementById('renew-add-trainer');
    const trainerName = trainerSelect.options[trainerSelect.selectedIndex].textContent;
    const existingRenewal = centerRenewals.find(r => (r.trainer_username === trainer || r.trainer === trainerName));
    
    if (existingRenewal) {
      document.getElementById('renew-add-result-message').textContent = '이미 해당 센터/트레이너/월에 대한 재등록 현황이 존재합니다. 수정 기능을 사용해주세요.';
      return;
    }
    
    const checkedBoxes = document.querySelectorAll('.renew-member-checkbox:checked');
    const memberNames = Array.from(checkedBoxes).map(cb => cb.value);
    
    if (memberNames.length === 0) {
      document.getElementById('renew-add-result-message').textContent = '회원을 최소 1명 이상 선택해주세요.';
      return;
    }
    
    const expectedInputs = document.querySelectorAll('.renew-add-expected-sessions-input');
    const expectedSessions = {};
    let hasError = false;
    
    expectedInputs.forEach(input => {
      const memberName = input.getAttribute('data-member');
      const value = input.value.trim();
      if (!value || Number(value) <= 0) {
        hasError = true;
        return;
      }
      expectedSessions[memberName] = Number(value);
    });
    
    if (hasError || Object.keys(expectedSessions).length !== memberNames.length) {
      document.getElementById('renew-add-result-message').textContent = '모든 회원의 예상 수업수를 입력해주세요.';
      return;
    }
    
    const resultMsg = document.getElementById('renew-add-result-message');
    resultMsg.textContent = '';
    
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '저장 중...';
    
    try {
      const response = await fetch('/api/renewals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          center,
          trainer,
          month: yearMonth,
          member_names: memberNames,
          expected_sessions: expectedSessions
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '추가에 실패했습니다.');
      }
      
      closeRenewAddModal();
      // 데이터 다시 로드
      const reloadYearMonth = getSelectedYearMonth();
      fetch('/api/centers')
        .then(r => r.json())
        .then(centers => {
          const centerOrder = centers.map(c => c.name);
          loadRenewSessions(reloadYearMonth, centerOrder);
        })
        .catch(err => {
          console.error('센터 목록 조회 오류:', err);
          loadRenewSessions(reloadYearMonth, []);
        });
    } catch (error) {
      console.error('Renewal 추가 오류:', error);
      resultMsg.textContent = '추가에 실패했습니다: ' + error.message;
      submitBtn.disabled = false;
      submitBtn.textContent = '저장';
    }
  });
}

function closeRenewAddModal() {
  const overlay = document.querySelector('.renew-edit-modal-overlay');
  const modal = document.querySelector('.renew-edit-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

export const renew = {
  render
};
