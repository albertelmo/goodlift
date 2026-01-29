export const trial = {
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
        <div style="display:flex;align-items:center;gap:12px;">
          <h3 id="trial-title" style="margin:0;color:#1976d2;font-size:1.2rem;cursor:pointer;user-select:none;transition:opacity 0.2s;" title="클릭하여 새로고침" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">신규 상담 현황</h3>
          <button id="trial-consultation-list-btn" class="header-text-btn" style="white-space:nowrap;font-size:15px !important;background:#e3f2fd !important;color:#1976d2 !important;">상세상담 목록</button>
          <button id="trial-public-consultation-list-btn" class="header-text-btn" style="white-space:nowrap;font-size:15px !important;background:#e3f2fd !important;color:#1976d2 !important;">공개상담 링크 목록</button>
        </div>
        <div style="display:flex;gap:12px;align-items:center;">
          <button id="trial-add-btn" class="header-text-btn" style="white-space:nowrap;font-size:15px !important;background:#e3f2fd !important;color:#1976d2 !important;">추가</button>
          <div class="date-navigation">
            <button id="trial-prev-btn" class="nav-btn">◀</button>
            <span id="trial-current-date" class="current-date"></span>
            <button id="trial-next-btn" class="nav-btn">▶</button>
          </div>
        </div>
      </div>
      <div id="trial-loading" style="text-align:center;padding:40px;color:#888;display:none;">불러오는 중...</div>
      <div id="trial-content"></div>
    </div>
  `;
  
  // 날짜 표시 업데이트
  updateDateDisplay();
  
  // 이벤트 리스너 설정
  container.querySelector('#trial-prev-btn').addEventListener('click', () => {
    navigateDate(-1, container);
  });
  
  container.querySelector('#trial-next-btn').addEventListener('click', () => {
    navigateDate(1, container);
  });
  
  container.querySelector('#trial-add-btn').addEventListener('click', () => {
    showTrialAddModal();
  });
  
  const consultationListBtn = container.querySelector('#trial-consultation-list-btn');
  if (consultationListBtn) {
    consultationListBtn.addEventListener('click', () => {
      // 이미 구현된 상담목록 모달 열기 함수 호출
      // 함수가 로드될 때까지 대기
      const tryOpen = () => {
        if (typeof window.openConsultationListModal === 'function') {
          window.openConsultationListModal();
        } else {
          // 함수가 아직 로드되지 않았으면 잠시 후 다시 시도
          setTimeout(tryOpen, 100);
        }
      };
      tryOpen();
    });
  }
  
  const publicConsultationListBtn = container.querySelector('#trial-public-consultation-list-btn');
  if (publicConsultationListBtn) {
    publicConsultationListBtn.addEventListener('click', () => {
      showPublicConsultationListModal();
    });
  }
  
  container.querySelector('#trial-title').addEventListener('click', () => {
    loadTrialData(container);
  });
  
  // 초기 데이터 로드
  loadTrialData(container);
}

function navigateDate(delta, container) {
  const newDate = new Date(currentDate);
  newDate.setDate(1);
  newDate.setMonth(newDate.getMonth() + delta);
  currentDate = newDate;
  updateDateDisplay();
  loadTrialData(container);
}

function updateDateDisplay() {
  const dateElement = document.querySelector('#trial-current-date');
  if (!dateElement) return;
  
  const koreanCurrentDate = new Date(currentDate);
  dateElement.textContent = koreanCurrentDate.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long'
  });
}

function loadTrialData(container) {
  const yearMonth = getSelectedYearMonth();
  fetch('/api/centers')
    .then(r => r.json())
    .then(centers => {
      const centerOrder = centers.map(c => c.name);
      loadTrialSessions(yearMonth, centerOrder);
    })
    .catch(err => {
      console.error('센터 목록 조회 오류:', err);
      loadTrialSessions(yearMonth, []);
    });
}

async function loadTrialSessions(yearMonth, centerOrder) {
  const loadingEl = document.getElementById('trial-loading');
  const contentEl = document.getElementById('trial-content');
  
  loadingEl.style.display = 'block';
  contentEl.innerHTML = '';
  
  try {
    // 상담현황 데이터와 상세상담 목록을 동시에 가져오기
    const [trialsResponse, consultationsResponse, trainersResponse] = await Promise.all([
      fetch(`/api/trials?yearMonth=${yearMonth}`),
      fetch(`/api/consultation-records?currentUser=${encodeURIComponent(localStorage.getItem('username') || '')}`),
      fetch('/api/trainers')
    ]);
    
    const trialsData = await trialsResponse.json();
    const consultationsData = await consultationsResponse.json();
    const trainers = await trainersResponse.json();
    
    loadingEl.style.display = 'none';
    
    // 트레이너 이름 -> username 매핑 생성
    const trainerNameToUsernameMap = {};
    trainers.forEach(trainer => {
      if (trainer.name) {
        trainerNameToUsernameMap[trainer.name] = trainer.username;
      }
    });
    
    // 상세상담 목록
    const consultations = consultationsData.records || [];
    
    renderTrialSessions(trialsData, centerOrder, consultations, trainerNameToUsernameMap);
  } catch (err) {
    loadingEl.style.display = 'none';
    contentEl.innerHTML = `<div style="text-align:center;padding:40px;color:#d32f2f;">데이터를 불러오지 못했습니다.</div>`;
    console.error('신규 상담 조회 오류:', err);
  }
}

function renderTrialSessions(data, centerOrder, consultations = [], trainerNameToUsernameMap = {}) {
  const contentEl = document.getElementById('trial-content');
  const centers = data.centers || {};
  
  if (Object.keys(centers).length === 0) {
    contentEl.innerHTML = `<div style="text-align:center;padding:40px;color:#888;">${data.yearMonth}에 신규 상담이 없습니다.</div>`;
    return;
  }
  
  // 센터 순서대로 정렬
  const sortedCenters = centerOrder.length > 0
    ? Object.keys(centers).sort((a, b) => {
        const indexA = centerOrder.indexOf(a);
        const indexB = centerOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b, 'ko');
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      })
    : Object.keys(centers).sort((a, b) => a.localeCompare(b, 'ko'));
  
  let html = '';
  
  sortedCenters.forEach(center => {
    const trials = centers[center];
    const registeredCount = trials.filter(trial => trial.result === '등록').length;
    const totalCount = trials.length;
    
    html += `
      <div style="margin-bottom:32px;border:1px solid #e3eaf5;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <div style="background:#f8f9fa;color:#333;padding:10px 20px;font-weight:600;font-size:0.9rem;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e3eaf5;">
          <span style="font-size:0.95rem;letter-spacing:0.3px;color:#1976d2;">${center}</span>
          <span style="font-size:0.8rem;font-weight:500;background:#e3f2fd;color:#1976d2;padding:4px 12px;border-radius:14px;">
            등록 ${registeredCount} / 전체 ${totalCount}
          </span>
        </div>
        <div style="padding:0;overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f8f9fa;">
                <th style="padding:8px 6px;text-align:left;font-size:0.75rem;font-weight:700;color:#333;border-bottom:2px solid #e3eaf5;white-space:nowrap;letter-spacing:0.2px;">날짜</th>
                <th style="padding:8px 6px;text-align:left;font-size:0.75rem;font-weight:700;color:#333;border-bottom:2px solid #e3eaf5;white-space:nowrap;letter-spacing:0.2px;">시간</th>
                <th style="padding:8px 6px;text-align:left;font-size:0.75rem;font-weight:700;color:#333;border-bottom:2px solid #e3eaf5;white-space:nowrap;letter-spacing:0.2px;">트레이너</th>
                <th style="padding:8px 6px;text-align:left;font-size:0.75rem;font-weight:700;color:#333;border-bottom:2px solid #e3eaf5;white-space:nowrap;letter-spacing:0.2px;">회원명</th>
                <th style="padding:8px 6px;text-align:left;font-size:0.75rem;font-weight:700;color:#333;border-bottom:2px solid #e3eaf5;white-space:nowrap;letter-spacing:0.2px;">성별</th>
                <th style="padding:8px 6px;text-align:left;font-size:0.75rem;font-weight:700;color:#333;border-bottom:2px solid #e3eaf5;white-space:nowrap;letter-spacing:0.2px;">연락처</th>
                <th style="padding:8px 6px;text-align:left;font-size:0.75rem;font-weight:700;color:#333;border-bottom:2px solid #e3eaf5;white-space:nowrap;letter-spacing:0.2px;">방문경로</th>
                <th style="padding:8px 6px;text-align:left;font-size:0.75rem;font-weight:700;color:#333;border-bottom:2px solid #e3eaf5;white-space:nowrap;letter-spacing:0.2px;">상담목적</th>
                <th style="padding:8px 6px;text-align:left;font-size:0.75rem;font-weight:700;color:#333;border-bottom:2px solid #e3eaf5;white-space:nowrap;letter-spacing:0.2px;">요구사항</th>
                <th style="padding:8px 6px;text-align:center;font-size:0.75rem;font-weight:700;color:#333;border-bottom:2px solid #e3eaf5;white-space:nowrap;letter-spacing:0.2px;">결과</th>
                <th style="padding:8px 6px;text-align:center;font-size:0.75rem;font-weight:700;color:#333;border-bottom:2px solid #e3eaf5;white-space:nowrap;letter-spacing:0.2px;">상세상담</th>
              </tr>
            </thead>
            <tbody>
              ${trials.map((trial, index) => {
                const date = new Date(trial.date);
                const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
                const resultValue = trial.result || '미등록';
                const resultColor = resultValue === '등록' ? '#4caf50' : '#666';
                const resultBgColor = resultValue === '등록' ? '#e8f5e9' : '#f5f5f5';
                const isEven = index % 2 === 0;
                
                // 상세상담 매칭 확인
                const trialCenter = (center || '').trim();
                const trialTrainerName = (trial.trainer || '').trim();
                const trialMemberName = (trial.member_name || '').trim();
                const trialTrainerUsername = trainerNameToUsernameMap[trialTrainerName] || '';
                
                const matchingConsultation = consultations.find(consultation => {
                  const consultationCenter = (consultation.center || '').trim();
                  const consultationTrainer = (consultation.trainer_username || '').trim();
                  const consultationName = (consultation.name || '').trim();
                  
                  return consultationCenter === trialCenter &&
                         consultationTrainer === trialTrainerUsername &&
                         consultationName === trialMemberName;
                });
                
                const consultationId = matchingConsultation ? matchingConsultation.id : null;
                const hasConsultation = !!matchingConsultation;
                
                return `
                  <tr class="trial-row" data-trial-data='${JSON.stringify(trial)}' style="border-bottom:1px solid #f0f4f8;cursor:pointer;background:${isEven ? '#fff' : '#fafbfc'};transition:all 0.2s ease;" onmouseover="this.style.backgroundColor='#e3f2fd';this.style.transform='scale(1.001)'" onmouseout="this.style.backgroundColor='${isEven ? '#fff' : '#fafbfc'}';this.style.transform='scale(1)'">
                    <td style="padding:10px 6px;font-size:0.8rem;color:#333;font-weight:500;">${dateStr}</td>
                    <td style="padding:10px 6px;font-size:0.8rem;color:#333;">${trial.time || '-'}</td>
                    <td style="padding:10px 6px;font-size:0.8rem;color:#333;font-weight:500;">${trial.trainer || '-'}</td>
                    <td style="padding:10px 6px;font-size:0.8rem;color:#1976d2;font-weight:600;">${trial.member_name || '-'}</td>
                    <td style="padding:10px 6px;font-size:0.8rem;color:#666;">${trial.gender || '-'}</td>
                    <td style="padding:10px 6px;font-size:0.8rem;color:#666;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${trial.phone || ''}">${trial.phone || '-'}</td>
                    <td style="padding:10px 6px;font-size:0.8rem;color:#666;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${trial.source || ''}">${trial.source || '-'}</td>
                    <td style="padding:10px 6px;font-size:0.8rem;color:#666;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${trial.purpose || ''}">${trial.purpose || '-'}</td>
                    <td style="padding:10px 6px;font-size:0.8rem;color:#666;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${trial.notes || ''}">${trial.notes || '-'}</td>
                    <td style="padding:10px 6px;font-size:0.8rem;text-align:center;">
                      <span style="display:inline-block;padding:3px 8px;border-radius:12px;background:${resultBgColor};color:${resultColor};font-weight:${resultValue === '등록' ? '700' : '500'};font-size:0.75rem;">
                        ${resultValue}
                      </span>
                    </td>
                    <td style="padding:10px 6px;font-size:0.8rem;text-align:center;" onclick="event.stopPropagation();">
                      ${hasConsultation ? `
                        <span class="consultation-badge" data-consultation-id="${consultationId}" style="display:inline-block;padding:3px 8px;border-radius:12px;background:#e8f5e9;color:#2e7d32;font-weight:700;font-size:0.75rem;cursor:pointer;" title="상세상담 보기">
                          상세
                        </span>
                      ` : `
                        <span style="display:inline-block;padding:3px 8px;border-radius:12px;background:#f5f5f5;color:#999;font-weight:400;font-size:0.75rem;">
                          -
                        </span>
                      `}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  });
  
  contentEl.innerHTML = html;
  
  // 수정 버튼 이벤트 리스너 추가
  setupTrialEditListeners();
  
  // 상세상담 배지 클릭 이벤트 추가
  setupConsultationBadgeListeners();
}

function setupTrialEditListeners() {
  // 행 클릭 이벤트 (수정 모달 열기)
  document.querySelectorAll('.trial-row').forEach(row => {
    row.addEventListener('click', function(e) {
      // 상세상담 배지 클릭 시에는 행 클릭 이벤트 무시
      if (e.target.closest('.consultation-badge')) {
        return;
      }
      const trialData = JSON.parse(this.getAttribute('data-trial-data'));
      showTrialEditModal(trialData);
    });
  });
}

function setupConsultationBadgeListeners() {
  // 상세상담 배지 클릭 이벤트
  document.querySelectorAll('.consultation-badge').forEach(badge => {
    badge.addEventListener('click', function(e) {
      e.stopPropagation();
      const consultationId = this.getAttribute('data-consultation-id');
      if (consultationId && typeof window.openConsultationEditModal === 'function') {
        window.openConsultationEditModal(consultationId);
      } else if (consultationId) {
        // 함수가 아직 로드되지 않았으면 잠시 후 다시 시도
        const tryOpen = () => {
          if (typeof window.openConsultationEditModal === 'function') {
            window.openConsultationEditModal(consultationId);
          } else {
            setTimeout(tryOpen, 100);
          }
        };
        tryOpen();
      }
    });
  });
}

async function showTrialEditModal(trial) {
  // 센터 목록 조회
  const centersResponse = await fetch('/api/centers');
  const centers = await centersResponse.json();
  
  // 트레이너 목록 조회
  const trainersResponse = await fetch('/api/trainers');
  const trainers = await trainersResponse.json();
  
  const date = new Date(trial.date);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  
  const modalHTML = `
    <div class="trial-edit-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="trial-edit-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:14px;box-shadow:0 8px 32px #1976d240;min-width:400px;max-width:90vw;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <h3 style="margin:0;color:#1976d2;font-size:1.2rem;">상담 정보 수정</h3>
          <button type="button" id="trial-create-consultation-btn" style="background:#e3f2fd !important;color:#1976d2 !important;border:none;padding:6px 12px !important;border-radius:20px !important;cursor:pointer;font-size:15px !important;white-space:nowrap;font-weight:500;">상세 상담 생성</button>
        </div>
        <button id="trial-edit-modal-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      
      <form id="trial-edit-form" style="display:flex;flex-direction:column;gap:16px;">
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">센터 *</label>
          <select id="trial-edit-center" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
            <option value="">선택</option>
            ${centers.map(center => `<option value="${center.name}" ${trial.center === center.name ? 'selected' : ''}>${center.name}</option>`).join('')}
          </select>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">트레이너 *</label>
          <select id="trial-edit-trainer" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
            <option value="">선택</option>
            ${trainers.map(trainer => `<option value="${trainer.username}" ${trial.trainer === trainer.name ? 'selected' : ''}>${trainer.name}</option>`).join('')}
          </select>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">회원명</label>
          <input type="text" id="trial-edit-member-name" value="${trial.member_name || ''}" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">성별</label>
          <select id="trial-edit-gender" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
            <option value="">선택</option>
            <option value="남" ${trial.gender === '남' ? 'selected' : ''}>남</option>
            <option value="여" ${trial.gender === '여' ? 'selected' : ''}>여</option>
          </select>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">연락처</label>
          <input type="tel" id="trial-edit-phone" value="${trial.phone || ''}" pattern="[0-9\-]+" placeholder="010-1234-5678" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">방문경로</label>
          <select id="trial-edit-source" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
            <option value="">선택</option>
            <option value="워크인" ${trial.source === '워크인' ? 'selected' : ''}>워크인</option>
            <option value="지인소개" ${trial.source === '지인소개' ? 'selected' : ''}>지인소개</option>
            <option value="네이버지도" ${trial.source === '네이버지도' ? 'selected' : ''}>네이버지도</option>
            <option value="네이버블로그" ${trial.source === '네이버블로그' ? 'selected' : ''}>네이버블로그</option>
            <option value="당근" ${trial.source === '당근' ? 'selected' : ''}>당근</option>
            <option value="홍보물" ${trial.source === '홍보물' ? 'selected' : ''}>홍보물</option>
            <option value="배너" ${trial.source === '배너' ? 'selected' : ''}>배너</option>
            <option value="간판" ${trial.source === '간판' ? 'selected' : ''}>간판</option>
            <option value="모름" ${trial.source === '모름' ? 'selected' : ''}>모름</option>
          </select>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">상담목적</label>
          <input type="text" id="trial-edit-purpose" value="${(trial.purpose || '').replace(/"/g, '&quot;')}" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">요구사항</label>
          <textarea id="trial-edit-notes" rows="4" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;resize:vertical;font-family:inherit;">${(trial.notes || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">결과</label>
          <select id="trial-edit-result" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
            <option value="미등록" ${(trial.result || '미등록') === '미등록' ? 'selected' : ''}>미등록</option>
            <option value="등록" ${trial.result === '등록' ? 'selected' : ''}>등록</option>
          </select>
        </div>
        
        <div id="trial-edit-result-message" style="min-height:24px;color:#d32f2f;font-size:0.85rem;"></div>
        
        <div style="display:flex;gap:10px;justify-content:space-between;margin-top:8px;">
          <button type="button" id="trial-edit-delete-btn" style="background:#d32f2f;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">삭제</button>
          <div style="display:flex;gap:10px;">
            <button type="button" id="trial-edit-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">취소</button>
            <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">저장</button>
          </div>
        </div>
      </form>
    </div>
  `;
  
  // 기존 모달이 있으면 제거
  const existingOverlay = document.querySelector('.trial-edit-modal-overlay');
  const existingModal = document.querySelector('.trial-edit-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  // 모달 추가
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // 모달 닫기 이벤트
  document.getElementById('trial-edit-modal-close').addEventListener('click', closeTrialEditModal);
  document.getElementById('trial-edit-cancel-btn').addEventListener('click', closeTrialEditModal);
  document.querySelector('.trial-edit-modal-overlay').addEventListener('click', closeTrialEditModal);
  
  // 상세 상담 생성 버튼 클릭 이벤트
  document.getElementById('trial-create-consultation-btn').addEventListener('click', async function() {
    await createConsultationFromTrial();
  });
  
  // 삭제 버튼 클릭 이벤트
  document.getElementById('trial-edit-delete-btn').addEventListener('click', async function() {
    if (!confirm('정말로 이 상담 정보를 삭제하시겠습니까?')) {
      return;
    }
    
    // 로딩 표시
    this.disabled = true;
    this.textContent = '삭제 중...';
    
    try {
      const response = await fetch(`/api/trials/${trial.id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '삭제에 실패했습니다.');
      }
      
      // 모달 닫기
      closeTrialEditModal();
      
      // 데이터 다시 로드
      const yearMonth = getSelectedYearMonth();
      fetch('/api/centers')
        .then(r => r.json())
        .then(centers => {
          const centerOrder = centers.map(c => c.name);
          loadTrialSessions(yearMonth, centerOrder);
        })
        .catch(err => {
          console.error('센터 목록 조회 오류:', err);
          loadTrialSessions(yearMonth, []);
        });
    } catch (error) {
      console.error('Trial 삭제 오류:', error);
      alert('삭제에 실패했습니다: ' + error.message);
      this.disabled = false;
      this.textContent = '삭제';
    }
  });
  
  // 폼 제출 이벤트
  document.getElementById('trial-edit-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const center = document.getElementById('trial-edit-center').value;
    const trainer = document.getElementById('trial-edit-trainer').value;
    const memberName = document.getElementById('trial-edit-member-name').value.trim();
    const gender = document.getElementById('trial-edit-gender').value || null;
    const phone = document.getElementById('trial-edit-phone').value.trim() || null;
    const source = document.getElementById('trial-edit-source').value.trim() || null;
    const purpose = document.getElementById('trial-edit-purpose').value.trim() || null;
    const notes = document.getElementById('trial-edit-notes').value.trim() || null;
    const result = document.getElementById('trial-edit-result').value || '미등록';
    
    const resultMsg = document.getElementById('trial-edit-result-message');
    resultMsg.textContent = '';
    
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '저장 중...';
    
    try {
      const response = await fetch(`/api/trials/${trial.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          center: center,
          trainer: trainer,
          member_name: memberName || null,
          gender: gender,
          phone: phone,
          source: source,
          purpose: purpose,
          notes: notes,
          result: result
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '수정에 실패했습니다.');
      }
      
      // 모달 닫기
      closeTrialEditModal();
      
      // 데이터 다시 로드
      const yearMonth = getSelectedYearMonth();
      fetch('/api/centers')
        .then(r => r.json())
        .then(centers => {
          const centerOrder = centers.map(c => c.name);
          loadTrialSessions(yearMonth, centerOrder);
        })
        .catch(err => {
          console.error('센터 목록 조회 오류:', err);
          loadTrialSessions(yearMonth, []);
        });
    } catch (error) {
      console.error('Trial 수정 오류:', error);
      resultMsg.textContent = '수정에 실패했습니다: ' + error.message;
      submitBtn.disabled = false;
      submitBtn.textContent = '저장';
    }
  });
}

function closeTrialEditModal() {
  const overlay = document.querySelector('.trial-edit-modal-overlay');
  const modal = document.querySelector('.trial-edit-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

async function showTrialAddModal() {
  // 센터 목록 조회
  const centersResponse = await fetch('/api/centers');
  const centers = await centersResponse.json();
  
  // 트레이너 목록 조회
  const trainersResponse = await fetch('/api/trainers');
  const trainers = await trainersResponse.json();
  
  // 현재 날짜와 시간 설정 (시간은 30분 단위로 반올림)
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];
  
  // 시간을 30분 단위로 반올림
  let minutes = now.getMinutes();
  const roundedMinutes = Math.round(minutes / 30) * 30;
  let hours = now.getHours();
  
  if (roundedMinutes >= 60) {
    hours = (hours + 1) % 24;
    minutes = 0;
  } else {
    minutes = roundedMinutes;
  }
  
  const currentTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  
  const modalHTML = `
    <div class="trial-edit-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="trial-edit-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:14px;box-shadow:0 8px 32px #1976d240;min-width:400px;max-width:90vw;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;color:#1976d2;font-size:1.2rem;">상담 정보 추가</h3>
        <button id="trial-add-modal-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      
      <form id="trial-add-form" style="display:flex;flex-direction:column;gap:16px;">
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">센터 *</label>
          <select id="trial-add-center" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
            <option value="">선택</option>
            ${centers.map(center => `<option value="${center.name}">${center.name}</option>`).join('')}
          </select>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">날짜 *</label>
          <input type="date" id="trial-add-date" value="${currentDate}" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">시간 *</label>
          <input type="time" id="trial-add-time" value="${currentTime}" step="1800" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">트레이너 *</label>
          <select id="trial-add-trainer" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
            <option value="">선택</option>
            ${trainers.map(trainer => `<option value="${trainer.username}">${trainer.name}</option>`).join('')}
          </select>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">회원명</label>
          <input type="text" id="trial-add-member-name" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">성별</label>
          <select id="trial-add-gender" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
            <option value="">선택</option>
            <option value="남">남</option>
            <option value="여">여</option>
          </select>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">연락처</label>
          <input type="tel" id="trial-add-phone" pattern="[0-9\-]+" placeholder="010-1234-5678" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">방문경로</label>
          <select id="trial-add-source" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
            <option value="">선택</option>
            <option value="워크인">워크인</option>
            <option value="지인소개">지인소개</option>
            <option value="네이버지도">네이버지도</option>
            <option value="네이버블로그">네이버블로그</option>
            <option value="당근">당근</option>
            <option value="홍보물">홍보물</option>
            <option value="배너">배너</option>
            <option value="간판">간판</option>
            <option value="모름">모름</option>
          </select>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">상담목적</label>
          <input type="text" id="trial-add-purpose" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">요구사항</label>
          <textarea id="trial-add-notes" rows="4" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;resize:vertical;font-family:inherit;"></textarea>
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">결과</label>
          <select id="trial-add-result" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
            <option value="미등록">미등록</option>
            <option value="등록">등록</option>
          </select>
        </div>
        
        <div id="trial-add-result-message" style="min-height:24px;color:#d32f2f;font-size:0.85rem;"></div>
        
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px;">
          <button type="button" id="trial-add-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">취소</button>
          <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:0.95rem;">저장</button>
        </div>
      </form>
    </div>
  `;
  
  // 기존 모달이 있으면 제거
  const existingOverlay = document.querySelector('.trial-edit-modal-overlay');
  const existingModal = document.querySelector('.trial-edit-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  // 모달 추가
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // 모달 닫기 이벤트
  document.getElementById('trial-add-modal-close').addEventListener('click', closeTrialAddModal);
  document.getElementById('trial-add-cancel-btn').addEventListener('click', closeTrialAddModal);
  document.querySelector('.trial-edit-modal-overlay').addEventListener('click', closeTrialAddModal);
  
  // 폼 제출 이벤트
  document.getElementById('trial-add-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const center = document.getElementById('trial-add-center').value.trim();
    const date = document.getElementById('trial-add-date').value;
    const time = document.getElementById('trial-add-time').value;
    const trainer = document.getElementById('trial-add-trainer').value;
    const memberName = document.getElementById('trial-add-member-name').value.trim();
    const gender = document.getElementById('trial-add-gender').value || null;
    const phone = document.getElementById('trial-add-phone').value.trim() || null;
    const source = document.getElementById('trial-add-source').value.trim() || null;
    const purpose = document.getElementById('trial-add-purpose').value.trim() || null;
    const notes = document.getElementById('trial-add-notes').value.trim() || null;
    const result = document.getElementById('trial-add-result').value || '미등록';
    
    const resultMsg = document.getElementById('trial-add-result-message');
    resultMsg.textContent = '';
    
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '저장 중...';
    
    try {
      const response = await fetch('/api/trials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          center: center,
          date: date,
          time: time,
          trainer: trainer,
          member_name: memberName || null,
          gender: gender,
          phone: phone,
          source: source,
          purpose: purpose,
          notes: notes,
          result: result
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '추가에 실패했습니다.');
      }
      
      // 모달 닫기
      closeTrialAddModal();
      
      // 데이터 다시 로드
      const yearMonth = getSelectedYearMonth();
      fetch('/api/centers')
        .then(r => r.json())
        .then(centers => {
          const centerOrder = centers.map(c => c.name);
          loadTrialSessions(yearMonth, centerOrder);
        })
        .catch(err => {
          console.error('센터 목록 조회 오류:', err);
          loadTrialSessions(yearMonth, []);
        });
    } catch (error) {
      console.error('Trial 추가 오류:', error);
      resultMsg.textContent = '추가에 실패했습니다: ' + error.message;
      submitBtn.disabled = false;
      submitBtn.textContent = '저장';
    }
  });
}

function closeTrialAddModal() {
  const overlay = document.querySelector('.trial-edit-modal-overlay');
  const modal = document.querySelector('.trial-edit-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

// 신규상담현황에서 상담기록 생성
async function createConsultationFromTrial() {
  try {
    // 현재 모달의 모든 필드 값 가져오기 (결과 필드 제외)
    const center = document.getElementById('trial-edit-center').value;
    const trainer = document.getElementById('trial-edit-trainer').value;
    const memberName = document.getElementById('trial-edit-member-name').value.trim();
    const gender = document.getElementById('trial-edit-gender').value || null;
    const phone = document.getElementById('trial-edit-phone').value.trim() || null;
    const source = document.getElementById('trial-edit-source').value.trim() || null;
    const purpose = document.getElementById('trial-edit-purpose').value.trim() || null;
    const notes = document.getElementById('trial-edit-notes').value.trim() || null;
    
    // 필수 필드 검증
    if (!center || !trainer) {
      alert('센터와 트레이너는 필수 항목입니다.');
      return;
    }
    
    // 이름이 없으면 회원명 사용, 둘 다 없으면 기본값
    const name = (memberName || '상담자').trim();
    const centerTrimmed = center.trim();
    const trainerTrimmed = trainer.trim();
    
    // 현재 사용자 정보 가져오기 (API 호출에 필요)
    const currentUser = localStorage.getItem('username');
    if (!currentUser) {
      alert('로그인이 필요합니다.');
      return;
    }
    
    // 기존 상세상담 목록에서 중복 확인
    const consultationsResponse = await fetch(`/api/consultation-records?currentUser=${encodeURIComponent(currentUser)}`);
    if (!consultationsResponse.ok) {
      console.error('상담기록 조회 실패:', consultationsResponse.status);
      // 조회 실패 시에도 계속 진행 (중복 검사는 스킵)
    } else {
      const consultationsData = await consultationsResponse.json();
      const existingConsultations = consultationsData.records || [];
      
      // 센터/트레이너/회원이름이 모두 같은 상담기록이 있는지 확인 (공백 제거 후 비교)
      const isDuplicate = existingConsultations.some(consultation => {
        const existingCenter = (consultation.center || '').trim();
        const existingTrainer = (consultation.trainer_username || '').trim();
        const existingName = (consultation.name || '').trim();
        
        return existingCenter === centerTrimmed &&
               existingTrainer === trainerTrimmed &&
               existingName === name;
      });
      
      if (isDuplicate) {
        alert('이미 동일한 센터/트레이너/회원이름 조합의 상세상담이 존재합니다.');
        return;
      }
    }
    
    // 상담목적 드롭다운 옵션 목록
    const validPurposes = ['체력증진', '근력강화', '자세교정', '재활', '다이어트', '선수지망', '기타'];
    
    // 상담목적이 드롭다운 옵션에 있는지 확인
    let finalPurpose = purpose;
    let purposeOther = null;
    
    if (purpose && !validPurposes.includes(purpose)) {
      // 드롭다운에 없는 경우 "기타"로 설정하고 원래 값을 purpose_other에 저장
      finalPurpose = '기타';
      purposeOther = purpose;
    }
    
    // 상담기록 데이터 구성
    const consultationData = {
      currentUser: currentUser,
      center: centerTrimmed,
      trainer_username: trainerTrimmed,
      name: name,
      phone: phone,
      gender: gender === '남' ? 'M' : (gender === '여' ? 'F' : null),
      visit_source: source,
      purpose: finalPurpose,
      purpose_other: purposeOther,
      requirements: notes, // 요구사항을 requirements 필드에 저장
      // 나머지 필드는 null로 설정
      age_range: null,
      exercise_history: null,
      medical_history: null,
      preferred_time: null,
      visit_reason: null,
      referrer: null,
      inbody: null,
      overhead_squat: null,
      slr_test: null,
      empty_can_test: null,
      rom: null,
      flexibility: null,
      static_posture: null,
      exercise_performed: null,
      summary: null
    };
    
    // 버튼 비활성화 및 로딩 표시
    const createBtn = document.getElementById('trial-create-consultation-btn');
    const originalText = createBtn.textContent;
    createBtn.disabled = true;
    createBtn.textContent = '생성 중...';
    
    // 상담기록 생성 API 호출
    const response = await fetch('/api/consultation-records', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(consultationData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: '상담기록 생성에 실패했습니다.' }));
      throw new Error(errorData.message || '상담기록 생성에 실패했습니다.');
    }
    
    const result = await response.json();
    
    // 성공 메시지 표시
    alert('상담기록이 성공적으로 생성되었습니다.');
    
    // 버튼 복원
    createBtn.disabled = false;
    createBtn.textContent = originalText;
    
  } catch (error) {
    console.error('상담기록 생성 오류:', error);
    alert('상담기록 생성 중 오류가 발생했습니다: ' + error.message);
    
    // 버튼 복원
    const createBtn = document.getElementById('trial-create-consultation-btn');
    if (createBtn) {
      createBtn.disabled = false;
      createBtn.textContent = '상세 상담 생성';
    }
  }
}

// 공개상담 목록 모달 표시
async function showPublicConsultationListModal() {
  try {
    const currentUser = localStorage.getItem('username');
    if (!currentUser) {
      alert('로그인이 필요합니다.');
      return;
    }
    
    // 기존 모달이 있으면 제거
    const existingOverlay = document.querySelector('.public-consultation-list-modal-overlay');
    const existingModal = document.querySelector('.public-consultation-list-modal');
    if (existingOverlay) existingOverlay.remove();
    if (existingModal) existingModal.remove();
    
    // 모달 HTML 생성
    const modalHTML = `
      <div class="public-consultation-list-modal-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;">
        <div class="public-consultation-list-modal" style="background:#fff;border-radius:8px;max-width:900px;width:100%;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 4px 20px rgba(0,0,0,0.3);">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid #eee;">
            <h2 style="margin:0;color:#333;font-size:1.2rem;">공개상담 링크 목록</h2>
            <button id="public-consultation-list-modal-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
          </div>
          <div id="public-consultation-list-content" style="flex:1;overflow-y:auto;padding:16px;">
            <div style="text-align:center;padding:40px;color:#888;">불러오는 중...</div>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // 모달 닫기 이벤트
    const closeBtn = document.getElementById('public-consultation-list-modal-close');
    const overlay = document.querySelector('.public-consultation-list-modal-overlay');
    
    const closeModal = () => {
      if (overlay) overlay.remove();
    };
    
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    
    // 공개상담 목록 로드
    await loadPublicConsultationList();
    
  } catch (error) {
    console.error('공개상담 목록 모달 표시 오류:', error);
    alert('공개상담 목록을 불러오는 중 오류가 발생했습니다.');
  }
}

// 링크 복사 모달 표시
function showLinkCopyModal(url) {
  // 기존 모달이 있으면 제거
  const existingModal = document.querySelector('.link-copy-modal-overlay');
  if (existingModal) {
    existingModal.remove();
  }
  
  // URL 이스케이프 처리
  const escapedUrl = url.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  
  const modalHTML = `
    <div class="link-copy-modal-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:3000;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div class="link-copy-modal" style="background:#fff;border-radius:8px;max-width:500px;width:100%;padding:24px;box-shadow:0 4px 20px rgba(0,0,0,0.3);">
        <h3 style="margin:0 0 16px 0;color:#333;font-size:1.1rem;">링크 복사</h3>
        <p style="margin:0 0 12px 0;color:#666;font-size:0.9rem;">아래 링크를 선택하여 복사하세요:</p>
        <input type="text" id="link-copy-input" value="${escapedUrl}" readonly style="width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;background:#f5f5f5;user-select:all;-webkit-user-select:all;" onclick="this.select();this.setSelectionRange(0,99999);">
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
          <button id="link-copy-close-btn" style="background:#eee;color:#333;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:0.9rem;">닫기</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  const overlay = document.querySelector('.link-copy-modal-overlay');
  const input = document.getElementById('link-copy-input');
  const closeBtn = document.getElementById('link-copy-close-btn');
  
  // 입력 필드 자동 선택
  setTimeout(() => {
    if (input) {
      input.select();
      input.setSelectionRange(0, 99999);
    }
  }, 100);
  
  const closeModal = () => {
    if (overlay) overlay.remove();
  };
  
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }
  
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }
}

// 공개상담 목록 로드
async function loadPublicConsultationList() {
  try {
    const currentUser = localStorage.getItem('username');
    if (!currentUser) return;
    
    const response = await fetch(`/api/consultation-shares/active?currentUser=${encodeURIComponent(currentUser)}`);
    
    if (!response.ok) {
      throw new Error('공개상담 목록을 불러오는데 실패했습니다.');
    }
    
    const data = await response.json();
    const shares = data.shares || [];
    
    const contentDiv = document.getElementById('public-consultation-list-content');
    
    if (shares.length === 0) {
      contentDiv.innerHTML = '<div style="text-align:center;padding:40px;color:#888;">공개상담이 없습니다.</div>';
      return;
    }
    
    // 목록 HTML 생성
    let html = '<div style="display:flex;flex-direction:column;gap:12px;">';
    
    shares.forEach(share => {
      const createdDate = share.created_at ? new Date(share.created_at).toLocaleDateString('ko-KR') : '-';
      const expiresDate = share.expires_at ? new Date(share.expires_at).toLocaleDateString('ko-KR') : '만료일 없음';
      const accessCount = share.access_count || 0;
      
      // baseUrl 생성
      const protocol = window.location.protocol;
      const host = window.location.host;
      const baseUrl = `${protocol}//${host}`;
      const shareUrl = `${baseUrl}/consultation/view/${share.token}`;
      
      html += `
        <div style="border:1px solid #ddd;border-radius:6px;padding:16px;background:#fff;">
          <div style="display:flex;justify-content:space-between;align-items:start;gap:12px;margin-bottom:8px;">
            <div style="flex:1;">
              <div style="font-weight:600;color:#333;margin-bottom:4px;">${share.consultation_name || '이름 없음'}</div>
              <div style="font-size:0.85rem;color:#666;margin-bottom:4px;">센터: ${share.center || '-'} | 트레이너: ${share.trainer_name || share.trainer_username || '-'}</div>
              <div style="font-size:0.85rem;color:#666;margin-bottom:4px;">수신자: ${share.name || '-'} ${share.phone ? `(${share.phone})` : ''}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <button class="copy-share-url-btn" data-url="${shareUrl}" style="background:#1976d2;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">링크 복사</button>
              <button class="open-share-url-btn" data-url="${shareUrl}" style="background:#4caf50;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">열기</button>
              <button class="delete-share-btn" data-share-id="${share.id}" style="background:#d32f2f;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">삭제</button>
            </div>
          </div>
          <div style="display:flex;gap:16px;font-size:0.8rem;color:#888;padding-top:8px;border-top:1px solid #eee;">
            <span>생성일: ${createdDate}</span>
            <span>만료일: ${expiresDate}</span>
            <span>조회수: ${accessCount}회</span>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    contentDiv.innerHTML = html;
    
    contentDiv.querySelectorAll('.copy-share-url-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        showLinkCopyModal(url);
      });
    });
    
    
    // 링크 열기 버튼 이벤트
    contentDiv.querySelectorAll('.open-share-url-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        window.open(url, '_blank');
      });
    });
    
    // 삭제 버튼 이벤트
    contentDiv.querySelectorAll('.delete-share-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const shareId = btn.getAttribute('data-share-id');
        
        if (!confirm('정말로 이 공개상담을 삭제하시겠습니까?')) {
          return;
        }
        
        // 버튼 비활성화 및 로딩 표시
        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = '삭제 중...';
        
        try {
          const currentUser = localStorage.getItem('username');
          if (!currentUser) {
            throw new Error('로그인이 필요합니다.');
          }
          
          const response = await fetch(`/api/consultation-shares/${shareId}?currentUser=${encodeURIComponent(currentUser)}`, {
            method: 'DELETE'
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '삭제에 실패했습니다.');
          }
          
          // 목록 다시 로드
          await loadPublicConsultationList();
        } catch (error) {
          console.error('공개상담 삭제 오류:', error);
          alert('삭제에 실패했습니다: ' + error.message);
          btn.disabled = false;
          btn.textContent = originalText;
        }
      });
    });
    
  } catch (error) {
    console.error('공개상담 목록 로드 오류:', error);
    const contentDiv = document.getElementById('public-consultation-list-content');
    if (contentDiv) {
      contentDiv.innerHTML = '<div style="text-align:center;padding:40px;color:#d32f2f;">공개상담 목록을 불러오는 중 오류가 발생했습니다.</div>';
    }
  }
}