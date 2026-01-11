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
        <h3 style="margin:0;color:#1976d2;font-size:1.2rem;">신규 상담 현황</h3>
        <div style="display:flex;gap:12px;align-items:center;">
          <button id="trial-add-btn" style="background:#1976d2;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:0.9rem;white-space:nowrap;">추가</button>
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
  
  // 초기 데이터 로드
  loadTrialData(container);
}

function navigateDate(delta, container) {
  const newDate = new Date(currentDate);
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

function loadTrialSessions(yearMonth, centerOrder) {
  const loadingEl = document.getElementById('trial-loading');
  const contentEl = document.getElementById('trial-content');
  
  loadingEl.style.display = 'block';
  contentEl.innerHTML = '';
  
  fetch(`/api/trials?yearMonth=${yearMonth}`)
    .then(r => r.json())
    .then(data => {
      loadingEl.style.display = 'none';
      renderTrialSessions(data, centerOrder);
    })
    .catch(err => {
      loadingEl.style.display = 'none';
      contentEl.innerHTML = `<div style="text-align:center;padding:40px;color:#d32f2f;">데이터를 불러오지 못했습니다.</div>`;
      console.error('신규 상담 조회 오류:', err);
    });
}

function renderTrialSessions(data, centerOrder) {
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
      <div style="margin-bottom:24px;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
        <div style="background:#1976d2;color:#fff;padding:12px 16px;font-weight:600;font-size:1rem;">
          ${center}
          <span style="margin-left:12px;font-size:0.85rem;font-weight:normal;opacity:0.9;">
            (${registeredCount}/${totalCount})
          </span>
        </div>
        <div style="padding:0;overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;min-width:800px;">
            <thead>
              <tr style="background:#f5f5f5;">
                <th style="padding:10px 8px;text-align:left;font-size:0.85rem;font-weight:600;color:#333;border-bottom:1px solid #ddd;white-space:nowrap;">날짜</th>
                <th style="padding:10px 8px;text-align:left;font-size:0.85rem;font-weight:600;color:#333;border-bottom:1px solid #ddd;white-space:nowrap;">시간</th>
                <th style="padding:10px 8px;text-align:left;font-size:0.85rem;font-weight:600;color:#333;border-bottom:1px solid #ddd;white-space:nowrap;">트레이너</th>
                <th style="padding:10px 8px;text-align:left;font-size:0.85rem;font-weight:600;color:#333;border-bottom:1px solid #ddd;white-space:nowrap;">회원명</th>
                <th style="padding:10px 8px;text-align:left;font-size:0.85rem;font-weight:600;color:#333;border-bottom:1px solid #ddd;white-space:nowrap;">성별</th>
                <th style="padding:10px 8px;text-align:left;font-size:0.85rem;font-weight:600;color:#333;border-bottom:1px solid #ddd;white-space:nowrap;">연락처</th>
                <th style="padding:10px 8px;text-align:left;font-size:0.85rem;font-weight:600;color:#333;border-bottom:1px solid #ddd;white-space:nowrap;">유입경로</th>
                <th style="padding:10px 8px;text-align:left;font-size:0.85rem;font-weight:600;color:#333;border-bottom:1px solid #ddd;white-space:nowrap;">운동목적</th>
                <th style="padding:10px 8px;text-align:left;font-size:0.85rem;font-weight:600;color:#333;border-bottom:1px solid #ddd;white-space:nowrap;">특이사항</th>
                <th style="padding:10px 8px;text-align:left;font-size:0.85rem;font-weight:600;color:#333;border-bottom:1px solid #ddd;white-space:nowrap;">결과</th>
                <th style="padding:10px 8px;text-align:left;font-size:0.85rem;font-weight:600;color:#333;border-bottom:1px solid #ddd;white-space:nowrap;">작업</th>
              </tr>
            </thead>
            <tbody>
              ${trials.map(trial => {
                const date = new Date(trial.date);
                const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                const resultValue = trial.result || '미등록';
                
                return `
                  <tr style="border-bottom:1px solid #f0f0f0;">
                    <td style="padding:10px 8px;font-size:0.9rem;">${dateStr}</td>
                    <td style="padding:10px 8px;font-size:0.9rem;">${trial.time}</td>
                    <td style="padding:10px 8px;font-size:0.9rem;">${trial.trainer || ''}</td>
                    <td style="padding:10px 8px;font-size:0.9rem;">${trial.member_name || '-'}</td>
                    <td style="padding:10px 8px;font-size:0.9rem;">${trial.gender || '-'}</td>
                    <td style="padding:10px 8px;font-size:0.9rem;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${trial.phone || ''}">${trial.phone || '-'}</td>
                    <td style="padding:10px 8px;font-size:0.9rem;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${trial.source || ''}">${trial.source || '-'}</td>
                    <td style="padding:10px 8px;font-size:0.9rem;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${trial.purpose || ''}">${trial.purpose || '-'}</td>
                    <td style="padding:10px 8px;font-size:0.9rem;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${trial.notes || ''}">${trial.notes || '-'}</td>
                    <td style="padding:10px 8px;font-size:0.9rem;">${resultValue}</td>
                    <td style="padding:10px 8px;font-size:0.9rem;">
                      <button class="trial-edit-btn" data-trial-id="${trial.id}" data-trial-data='${JSON.stringify(trial)}' style="background:#1976d2;color:#fff;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;">수정</button>
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
}

function setupTrialEditListeners() {
  // 수정 버튼 클릭 이벤트
  document.querySelectorAll('.trial-edit-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const trialData = JSON.parse(this.getAttribute('data-trial-data'));
      showTrialEditModal(trialData);
    });
  });
}

function showTrialEditModal(trial) {
  const date = new Date(trial.date);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  
  const modalHTML = `
    <div class="trial-edit-modal-overlay" style="position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);"></div>
    <div class="trial-edit-modal" style="position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:14px;box-shadow:0 8px 32px #1976d240;min-width:400px;max-width:90vw;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;color:#1976d2;font-size:1.2rem;">상담 정보 수정</h3>
        <button id="trial-edit-modal-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">×</button>
      </div>
      
      <form id="trial-edit-form" style="display:flex;flex-direction:column;gap:16px;">
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
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">유입경로</label>
          <input type="text" id="trial-edit-source" value="${trial.source || ''}" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">운동목적</label>
          <input type="text" id="trial-edit-purpose" value="${(trial.purpose || '').replace(/"/g, '&quot;')}" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">특이사항</label>
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
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">유입경로</label>
          <input type="text" id="trial-add-source" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">운동목적</label>
          <input type="text" id="trial-add-purpose" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
        </div>
        
        <div>
          <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">특이사항</label>
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
