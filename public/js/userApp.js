// 유저앱 관리 모듈 (운동종류 관리 등)

export const userApp = {
  render
};

function render(container) {
  if (!container) return;
  
    container.innerHTML = `
    <div style="padding:12px;">
      <h3 id="user-app-title" style="margin-top:0;margin-bottom:12px;color:#1976d2;font-size:1rem;cursor:pointer;user-select:none;" title="클릭하여 새로고침" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">📱 유저앱 관리</h3>
      
      <!-- 활성 통계 섹션 -->
      <div style="background:#f5f5f5;padding:12px;border-radius:8px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;flex-wrap:wrap;">
          <h4 style="margin:0;color:#333;font-size:0.9rem;">활성 통계</h4>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <button class="user-app-activity-range-btn" data-range="7" style="background:#fff;color:#1976d2;border:1px solid #1976d2;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:0.7rem;">최근 7일</button>
            <button class="user-app-activity-range-btn" data-range="30" style="background:#fff;color:#1976d2;border:1px solid #1976d2;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:0.7rem;">최근 30일</button>
            <button class="user-app-activity-range-btn" data-range="90" style="background:#fff;color:#1976d2;border:1px solid #1976d2;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:0.7rem;">최근 90일</button>
            <input type="date" id="user-app-activity-start" style="padding:3px 6px;border:1px solid #ddd;border-radius:3px;font-size:0.7rem;">
            <span style="font-size:0.7rem;color:#666;">~</span>
            <input type="date" id="user-app-activity-end" style="padding:3px 6px;border:1px solid #ddd;border-radius:3px;font-size:0.7rem;">
            <button id="user-app-activity-refresh-btn" class="header-text-btn" style="background:#e3f2fd !important;color:#1976d2 !important;border:none;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:0.7rem;">
              조회
            </button>
          </div>
        </div>
        <div id="user-app-activity-stats" style="background:#fff;border-radius:4px;padding:8px;">
          <div style="text-align:center;padding:12px;color:#888;font-size:0.75rem;">불러오는 중...</div>
        </div>
      </div>
      
      <!-- 회원 관리 섹션 -->
      <div style="background:#f5f5f5;padding:12px;border-radius:8px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <h4 style="margin:0;color:#333;font-size:0.9rem;">회원 관리</h4>
          <button id="user-app-member-add-btn" class="header-text-btn" style="background:#e3f2fd !important;color:#1976d2 !important;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:0.75rem;">
            회원 추가
          </button>
        </div>
        <div id="user-app-members-list" style="background:#fff;border-radius:4px;padding:8px;">
          <div style="text-align:center;padding:12px;color:#888;font-size:0.75rem;">불러오는 중...</div>
        </div>
      </div>
      
      <!-- 운동종류 관리 섹션 -->
      <div style="background:#f5f5f5;padding:12px;border-radius:8px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <h4 style="margin:0;color:#333;font-size:0.9rem;">운동종류 관리</h4>
          <div style="display:flex;align-items:stretch;gap:8px;">
            <input type="text" id="user-app-workout-types-search" placeholder="운동 이름 검색..." style="width:200px;padding:4px 8px;border:1px solid #ddd;border-radius:3px;font-size:0.75rem;box-sizing:border-box;margin:0;font-family:inherit;">
            <button id="user-app-workout-type-add-btn" class="header-text-btn" style="background:#e3f2fd !important;color:#1976d2 !important;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:0.75rem;margin:0;font-family:inherit;white-space:nowrap;">
              운동종류 추가
            </button>
          </div>
        </div>
        <div id="user-app-workout-types-list" style="background:#fff;border-radius:4px;padding:8px;">
          <div style="text-align:center;padding:12px;color:#888;font-size:0.75rem;">불러오는 중...</div>
        </div>
      </div>
      
      <!-- 분류 관리 섹션 -->
      <div style="background:#f5f5f5;padding:12px;border-radius:8px;margin-bottom:12px;">
        <h4 style="margin:0 0 8px 0;color:#333;font-size:0.9rem;">분류 관리</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:8px;">
          <div id="user-app-category-1-section" style="background:#fff;padding:8px;border-radius:4px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <h5 style="margin:0;color:#666;font-size:0.8rem;">분류 1</h5>
              <button class="user-app-category-add-btn header-text-btn" data-category="1" style="background:#e3f2fd !important;color:#1976d2 !important;border:none;padding:2px 6px;border-radius:2px;cursor:pointer;font-size:0.7rem;">
                추가
              </button>
            </div>
            <div class="user-app-category-list" data-category="1"></div>
          </div>
          <div id="user-app-category-2-section" style="background:#fff;padding:8px;border-radius:4px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <h5 style="margin:0;color:#666;font-size:0.8rem;">분류 2</h5>
              <button class="user-app-category-add-btn header-text-btn" data-category="2" style="background:#e3f2fd !important;color:#1976d2 !important;border:none;padding:2px 6px;border-radius:2px;cursor:pointer;font-size:0.7rem;">
                추가
              </button>
            </div>
            <div class="user-app-category-list" data-category="2"></div>
          </div>
          <div id="user-app-category-3-section" style="background:#fff;padding:8px;border-radius:4px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <h5 style="margin:0;color:#666;font-size:0.8rem;">분류 3</h5>
              <button class="user-app-category-add-btn header-text-btn" data-category="3" style="background:#e3f2fd !important;color:#1976d2 !important;border:none;padding:2px 6px;border-radius:2px;cursor:pointer;font-size:0.7rem;">
                추가
              </button>
            </div>
            <div class="user-app-category-list" data-category="3"></div>
          </div>
          <div id="user-app-category-4-section" style="background:#fff;padding:8px;border-radius:4px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <h5 style="margin:0;color:#666;font-size:0.8rem;">분류 4</h5>
              <button class="user-app-category-add-btn header-text-btn" data-category="4" style="background:#e3f2fd !important;color:#1976d2 !important;border:none;padding:2px 6px;border-radius:2px;cursor:pointer;font-size:0.7rem;">
                추가
              </button>
            </div>
            <div class="user-app-category-list" data-category="4"></div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  setupEventListeners(container);
  loadData();
}

function setupEventListeners(container) {
  const title = container.querySelector('#user-app-title');
  if (title) {
    title.addEventListener('click', () => {
      loadData();
    });
  }

  // 회원 추가 버튼
  const addMemberBtn = container.querySelector('#user-app-member-add-btn');
  if (addMemberBtn) {
    addMemberBtn.addEventListener('click', () => {
      showMemberAddModal();
    });
  }
  
  // 운동종류 추가 버튼
  const addWorkoutTypeBtn = container.querySelector('#user-app-workout-type-add-btn');
  if (addWorkoutTypeBtn) {
    addWorkoutTypeBtn.addEventListener('click', () => {
      showWorkoutTypeAddModal();
    });
  }
  
  // 분류 추가 버튼들
  const categoryAddBtns = container.querySelectorAll('.user-app-category-add-btn');
  categoryAddBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const categoryNumber = btn.getAttribute('data-category');
      showCategoryAddModal(categoryNumber);
    });
  });
  
  // 운동종류 검색 입력창
  const workoutTypesSearchInput = container.querySelector('#user-app-workout-types-search');
  if (workoutTypesSearchInput) {
    workoutTypesSearchInput.addEventListener('input', () => {
      const searchTerm = workoutTypesSearchInput.value.trim().toLowerCase();
      // 전역 변수에 저장된 원본 데이터로 필터링 및 렌더링
      if (window.allWorkoutTypes) {
        const filtered = searchTerm === '' 
          ? window.allWorkoutTypes 
          : window.allWorkoutTypes.filter(type => 
              (type.name || '').toLowerCase().includes(searchTerm)
            );
        renderWorkoutTypesList(filtered);
      }
    });
  }
  
  const refreshBtn = container.querySelector('#user-app-activity-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      setActiveRangeButton(null);
      loadActivityStats();
    });
  }
  
  container.querySelectorAll('.user-app-activity-range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const range = parseInt(btn.getAttribute('data-range'), 10);
      setActivityDateRange(range);
      setActiveRangeButton(range);
      loadActivityStats();
    });
  });
}

async function loadData() {
  await Promise.all([
    loadActivityStats(),
    loadMembers(),
    loadWorkoutTypes(),
    loadCategories(1),
    loadCategories(2),
    loadCategories(3),
    loadCategories(4)
  ]);
}

function getDateString(date) {
  return date.toISOString().split('T')[0];
}

function setActivityDateRange(days) {
  const endInput = document.getElementById('user-app-activity-end');
  const startInput = document.getElementById('user-app-activity-start');
  if (!endInput || !startInput) return;
  
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  
  endInput.value = getDateString(endDate);
  startInput.value = getDateString(startDate);
}

function setActiveRangeButton(range) {
  document.querySelectorAll('.user-app-activity-range-btn').forEach(btn => {
    const isActive = range !== null && parseInt(btn.getAttribute('data-range'), 10) === range;
    if (isActive) {
      btn.style.background = '#e3f2fd';
      btn.style.borderColor = '#1976d2';
      btn.style.color = '#1976d2';
      btn.style.fontWeight = '600';
    } else {
      btn.style.background = '#fff';
      btn.style.borderColor = '#1976d2';
      btn.style.color = '#1976d2';
      btn.style.fontWeight = 'normal';
    }
  });
}

async function loadActivityStats() {
  const container = document.getElementById('user-app-activity-stats');
  const startInput = document.getElementById('user-app-activity-start');
  const endInput = document.getElementById('user-app-activity-end');
  if (!container || !startInput || !endInput) return;
  
  if (!startInput.value || !endInput.value) {
    setActivityDateRange(30);
    setActiveRangeButton(30);
  }
  
  const startDate = startInput.value;
  const endDate = endInput.value;
  
  container.innerHTML = '<div style="text-align:center;padding:12px;color:#888;font-size:0.75rem;">불러오는 중...</div>';
  
  try {
    const response = await fetch(`/api/app-user-activity-stats?startDate=${startDate}&endDate=${endDate}`);
    if (!response.ok) throw new Error('활성 통계 조회 실패');
    const data = await response.json();
    
    const members = data.summary?.members || {};
    const trainers = data.summary?.trainers || {};
    const counts = data.summary?.counts || {};
    
    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:8px;">
        <div style="border:1px solid #eee;border-radius:6px;padding:8px;">
          <div style="font-size:0.8rem;font-weight:600;color:#1976d2;margin-bottom:6px;">회원 활성</div>
          <div class="user-app-activity-item" data-label="회원 접속(앱오픈)" data-event-type="app_open" data-actor-role="member" data-source="self" style="font-size:0.75rem;color:#555;cursor:pointer;">접속(앱오픈): <strong>${members.appOpenUsers || 0}</strong></div>
          <div class="user-app-activity-item" data-label="회원 로그인" data-event-type="login" data-actor-role="member" data-source="self" style="font-size:0.75rem;color:#555;cursor:pointer;">로그인: <strong>${members.loginUsers || 0}</strong></div>
          <div class="user-app-activity-item" data-label="회원 운동(직접)" data-event-type="workout_create" data-actor-role="member" data-source="self" style="font-size:0.75rem;color:#555;cursor:pointer;">운동(직접): <strong>${members.workoutSelfUsers || 0}</strong></div>
          <div class="user-app-activity-item" data-label="회원 운동(대리)" data-event-type="workout_create" data-actor-role="trainer" data-source="trainer_proxy" style="font-size:0.75rem;color:#555;cursor:pointer;">운동(대리): <strong>${members.workoutProxyUsers || 0}</strong></div>
          <div class="user-app-activity-item" data-label="회원 식단(직접)" data-event-type="diet_create" data-actor-role="member" data-source="self" style="font-size:0.75rem;color:#555;cursor:pointer;">식단(직접): <strong>${members.dietSelfUsers || 0}</strong></div>
          <div class="user-app-activity-item" data-label="회원 식단(대리)" data-event-type="diet_create" data-actor-role="trainer" data-source="trainer_proxy" style="font-size:0.75rem;color:#555;cursor:pointer;">식단(대리): <strong>${members.dietProxyUsers || 0}</strong></div>
        </div>
        <div style="border:1px solid #eee;border-radius:6px;padding:8px;">
          <div style="font-size:0.8rem;font-weight:600;color:#1976d2;margin-bottom:6px;">트레이너 활성</div>
          <div class="user-app-activity-item" data-label="트레이너 접속(앱오픈)" data-event-type="app_open" data-actor-role="trainer" data-source="self" style="font-size:0.75rem;color:#555;cursor:pointer;">접속(앱오픈): <strong>${trainers.appOpenUsers || 0}</strong></div>
          <div class="user-app-activity-item" data-label="트레이너 로그인" data-event-type="login" data-actor-role="trainer" data-source="self" style="font-size:0.75rem;color:#555;cursor:pointer;">로그인: <strong>${trainers.loginUsers || 0}</strong></div>
          <div class="user-app-activity-item" data-label="트레이너 운동 대리 입력" data-event-type="workout_create" data-actor-role="trainer" data-source="trainer_proxy" style="font-size:0.75rem;color:#555;cursor:pointer;">운동 대리 입력자: <strong>${trainers.workoutProxyActors || 0}</strong></div>
          <div class="user-app-activity-item" data-label="트레이너 식단 대리 입력" data-event-type="diet_create" data-actor-role="trainer" data-source="trainer_proxy" style="font-size:0.75rem;color:#555;cursor:pointer;">식단 대리 입력자: <strong>${trainers.dietProxyActors || 0}</strong></div>
        </div>
        <div style="border:1px solid #eee;border-radius:6px;padding:8px;">
          <div style="font-size:0.8rem;font-weight:600;color:#1976d2;margin-bottom:6px;">기록 건수</div>
          <div class="user-app-activity-item" data-label="운동 건수(직접)" data-event-type="workout_create" data-actor-role="member" data-source="self" style="font-size:0.75rem;color:#555;cursor:pointer;">운동(직접): <strong>${counts.workoutSelf || 0}</strong></div>
          <div class="user-app-activity-item" data-label="운동 건수(대리)" data-event-type="workout_create" data-actor-role="trainer" data-source="trainer_proxy" style="font-size:0.75rem;color:#555;cursor:pointer;">운동(대리): <strong>${counts.workoutProxy || 0}</strong></div>
          <div class="user-app-activity-item" data-label="식단 건수(직접)" data-event-type="diet_create" data-actor-role="member" data-source="self" style="font-size:0.75rem;color:#555;cursor:pointer;">식단(직접): <strong>${counts.dietSelf || 0}</strong></div>
          <div class="user-app-activity-item" data-label="식단 건수(대리)" data-event-type="diet_create" data-actor-role="trainer" data-source="trainer_proxy" style="font-size:0.75rem;color:#555;cursor:pointer;">식단(대리): <strong>${counts.dietProxy || 0}</strong></div>
          <div class="user-app-activity-item" data-label="운동 코멘트" data-event-type="workout_comment_create" data-actor-role="trainer" data-source="trainer_proxy" style="font-size:0.75rem;color:#555;cursor:pointer;">운동 코멘트: <strong>${counts.workoutComments || 0}</strong></div>
          <div class="user-app-activity-item" data-label="식단 코멘트(회원)" data-event-type="diet_comment_create" data-actor-role="member" data-source="self" style="font-size:0.75rem;color:#555;cursor:pointer;">식단 코멘트(회원): <strong>${counts.dietCommentsMember || 0}</strong></div>
          <div class="user-app-activity-item" data-label="식단 코멘트(트레이너)" data-event-type="diet_comment_create" data-actor-role="trainer" data-source="trainer_proxy" style="font-size:0.75rem;color:#555;cursor:pointer;">식단 코멘트(트레이너): <strong>${counts.dietCommentsTrainer || 0}</strong></div>
        </div>
      </div>
    `;
    
    setupActivityStatClickHandlers();
  } catch (error) {
    console.error('활성 통계 조회 오류:', error);
    container.innerHTML = '<div style="text-align:center;padding:12px;color:#d32f2f;font-size:0.75rem;">활성 통계를 불러오지 못했습니다.</div>';
  }
}

function setupActivityStatClickHandlers() {
  const container = document.getElementById('user-app-activity-stats');
  if (!container) return;
  
  container.querySelectorAll('.user-app-activity-item').forEach(item => {
    item.addEventListener('click', () => {
      const label = item.getAttribute('data-label') || '활동 상세';
      const eventType = item.getAttribute('data-event-type');
      const actorRole = item.getAttribute('data-actor-role');
      const source = item.getAttribute('data-source');
      showActivityEventsModal({ label, eventType, actorRole, source });
    });
  });
}

async function showActivityEventsModal({ label, eventType, actorRole, source }) {
  const startInput = document.getElementById('user-app-activity-start');
  const endInput = document.getElementById('user-app-activity-end');
  if (!startInput || !endInput) return;
  
  const startDate = startInput.value;
  const endDate = endInput.value;
  if (!startDate || !endDate) return;
  
  const modalBg = document.createElement('div');
  modalBg.className = 'modal-bg';
  modalBg.style.cssText = 'position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);';
  
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:9px;border-radius:6px;width:88vw;max-width:520px;max-height:70vh;overflow-y:auto;font-size:0.66rem;box-sizing:border-box;';
  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
      <h3 style="margin:0;color:#1976d2;font-size:0.83rem;">${escapeHtml(label)}</h3>
      <button class="activity-modal-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:#666;">×</button>
    </div>
    <div style="color:#666;font-size:0.68rem;margin-bottom:4px;">${escapeHtml(startDate)} ~ ${escapeHtml(endDate)}</div>
    <div id="activity-events-loading" style="text-align:center;padding:8px;color:#888;font-size:0.6rem;">불러오는 중...</div>
    <div id="activity-events-content"></div>
  `;
  
  document.body.appendChild(modalBg);
  document.body.appendChild(modal);
  
  const closeModal = () => {
    modalBg.remove();
    modal.remove();
  };
  modalBg.addEventListener('click', closeModal);
  modal.querySelector('.activity-modal-close').addEventListener('click', closeModal);
  
  try {
    const params = new URLSearchParams({
      startDate,
      endDate,
      eventType,
      actorRole,
      source,
      limit: '200'
    });
    const response = await fetch(`/api/app-user-activity-events?${params.toString()}`);
    if (!response.ok) throw new Error('활동 이벤트 조회 실패');
    const data = await response.json();
    const events = data.events || [];
    
    const content = modal.querySelector('#activity-events-content');
    const loading = modal.querySelector('#activity-events-loading');
    if (loading) loading.remove();
    
    if (events.length === 0) {
      content.innerHTML = '<div style="text-align:center;padding:16px;color:#888;">데이터가 없습니다.</div>';
      return;
    }
    
    const rowsHtml = events.map(ev => {
      const date = new Date(ev.event_at);
      const dateText = isNaN(date.getTime()) ? '-' : date.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      const actorText = ev.actor_name ? `${ev.actor_name} (${ev.actor_username || '-'})` : (ev.actor_username || '-');
      const subjectText = ev.subject_name ? `${ev.subject_name} (${ev.subject_username || '-'})` : (ev.subject_username || '-');
      return `
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:3px 4px;white-space:nowrap;font-size:0.64rem;">${escapeHtml(dateText)}</td>
          <td style="padding:3px 4px;font-size:0.64rem;">${escapeHtml(actorText)}</td>
          <td style="padding:3px 4px;font-size:0.64rem;">${escapeHtml(subjectText)}</td>
        </tr>
      `;
    }).join('');
    
    content.innerHTML = `
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f5f5f5;border-bottom:1px solid #ddd;">
            <th style="padding:3px 4px;text-align:left;white-space:nowrap;font-size:0.72rem;">시간</th>
            <th style="padding:3px 4px;text-align:left;font-size:0.72rem;">행위자</th>
            <th style="padding:3px 4px;text-align:left;font-size:0.72rem;">대상 회원</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
  } catch (error) {
    const content = modal.querySelector('#activity-events-content');
    const loading = modal.querySelector('#activity-events-loading');
    if (loading) loading.remove();
    content.innerHTML = '<div style="text-align:center;padding:16px;color:#d32f2f;">데이터를 불러오지 못했습니다.</div>';
    console.error('활동 이벤트 조회 오류:', error);
  }
}

async function loadMembers() {
  try {
    const response = await fetch('/api/app-users');
    if (!response.ok) throw new Error('회원 조회 실패');
    
    const appUsers = await response.json();
    
    // 트레이너 정보 조회 (username -> name 매핑)
    let trainerNameMap = {};
    try {
      const trainersResponse = await fetch('/api/trainers');
      if (trainersResponse.ok) {
        const trainers = await trainersResponse.json();
        trainers.forEach(trainer => {
          trainerNameMap[trainer.username] = trainer.name;
        });
      }
    } catch (error) {
      console.error('트레이너 정보 조회 오류:', error);
    }
    
    // member_name이 있는 회원들의 트레이너 정보 조회
    const memberNamesWithLink = appUsers
      .filter(user => user.member_name)
      .map(user => user.member_name);
    
    let trainerMap = {};
    if (memberNamesWithLink.length > 0) {
      try {
        const membersResponse = await fetch('/api/members');
        if (membersResponse.ok) {
          const members = await membersResponse.json();
          members.forEach(member => {
            if (memberNamesWithLink.includes(member.name)) {
              const trainerUsername = member.trainer || '';
              // 트레이너 username을 name으로 변환
              const trainerName = trainerUsername ? (trainerNameMap[trainerUsername] || trainerUsername) : '-';
              trainerMap[member.name] = trainerName;
            }
          });
        }
      } catch (error) {
        console.error('회원 트레이너 정보 조회 오류:', error);
      }
    }
    
    // app_users에 trainer 정보 추가 (이름으로 변환됨)
    const membersWithTrainer = appUsers.map(user => ({
      ...user,
      trainer: user.member_name ? (trainerMap[user.member_name] || '-') : '-'
    }));
    
    renderMembersList(membersWithTrainer);
  } catch (error) {
    console.error('회원 조회 오류:', error);
    const listContainer = document.getElementById('user-app-members-list');
    if (listContainer) {
      listContainer.innerHTML = '<div style="text-align:center;padding:12px;color:#d32f2f;font-size:0.75rem;">회원을 불러오는 중 오류가 발생했습니다.</div>';
    }
  }
}

// 회원 목록 정렬 상태 관리 (기본값: 생성순 내림차순 - 최신순)
let membersSortColumn = 'created_at';
let membersSortDirection = 'desc'; // 'asc' or 'desc'

function renderMembersList(members) {
  const listContainer = document.getElementById('user-app-members-list');
  if (!listContainer) return;
  
  if (members.length === 0) {
    listContainer.innerHTML = '<div style="text-align:center;padding:12px;color:#888;font-size:0.75rem;">등록된 회원이 없습니다.</div>';
    return;
  }
  
  // 정렬된 회원 목록 생성
  const sortedMembers = [...members].sort((a, b) => {
    if (membersSortColumn === 'name') {
      const aValue = (a.name || '').trim();
      const bValue = (b.name || '').trim();
      const comparison = aValue.localeCompare(bValue, 'ko', { numeric: true });
      return membersSortDirection === 'asc' ? comparison : -comparison;
    } else if (membersSortColumn === 'created_at') {
      // 생성일 기준 정렬
      const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (membersSortDirection === 'asc') {
        return aDate - bDate; // 오름차순: 오래된 것부터
      } else {
        return bDate - aDate; // 내림차순: 최신 것부터
      }
    } else {
      return 0;
    }
  });
  
  // 정렬 아이콘 생성 함수 (운동종류와 동일한 스타일)
  const getSortIcon = (column) => {
    if (membersSortColumn !== column) {
      return '<span style="color:#999;font-size:0.7rem;margin-left:4px;">↕</span>';
    }
    return membersSortDirection === 'asc' 
      ? '<span style="color:#1976d2;font-size:0.7rem;margin-left:4px;">↑</span>'
      : '<span style="color:#1976d2;font-size:0.7rem;margin-left:4px;">↓</span>';
  };
  
  let html = `
    <table style="width:100%;border-collapse:collapse;font-size:0.75rem;">
      <thead>
        <tr style="background:#f5f5f5;border-bottom:1px solid #ddd;">
          <th style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">아이디</th>
          <th class="members-sort-header" data-column="name" style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;cursor:pointer;user-select:none;position:relative;" onmouseover="this.style.backgroundColor='#e0e0e0'" onmouseout="this.style.backgroundColor='transparent'">
            이름${getSortIcon('name')}
          </th>
          <th style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">전화번호</th>
          <th style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">회원명</th>
          <th style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">트레이너</th>
          <th style="padding:4px 6px;text-align:center;font-weight:600;color:#333;font-size:0.75rem;">상태</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  sortedMembers.forEach(member => {
    html += `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:4px 6px;">${escapeHtml(member.username)}</td>
        <td style="padding:4px 6px;">${escapeHtml(member.name)}</td>
        <td style="padding:4px 6px;color:#666;">${escapeHtml(member.phone || '-')}</td>
        <td style="padding:4px 6px;color:#666;">${member.member_name ? escapeHtml(member.member_name) : '-'}</td>
        <td style="padding:4px 6px;color:#666;">${member.trainer ? escapeHtml(member.trainer) : '-'}</td>
        <td style="padding:4px 6px;text-align:center;">
          <span style="padding:2px 6px;border-radius:2px;font-size:0.7rem;background:${member.is_active ? '#4caf50' : '#999'};color:#fff;">
            ${member.is_active ? '활성' : '비활성'}
          </span>
        </td>
      </tr>
    `;
  });
  
  html += `
      </tbody>
    </table>
  `;
  
  listContainer.innerHTML = html;
  
  // 정렬 헤더 클릭 이벤트
  const sortHeader = listContainer.querySelector('.members-sort-header');
  if (sortHeader) {
    sortHeader.addEventListener('click', () => {
      const column = sortHeader.getAttribute('data-column');
      if (membersSortColumn === column) {
        // 같은 컬럼 클릭 시 정렬 방향 토글
        membersSortDirection = membersSortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        // 다른 컬럼 클릭 시 해당 컬럼으로 변경하고 오름차순으로 설정
        membersSortColumn = column;
        membersSortDirection = 'asc';
      }
      renderMembersList(members);
    });
  }
  
  // 테이블 행 클릭 이벤트 (수정 모달 열기)
  listContainer.querySelectorAll('tbody tr').forEach((row, index) => {
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => {
      const member = sortedMembers[index];
      if (member) {
        showMemberEditModal(member);
      }
    });
  });
}

async function loadWorkoutTypes() {
  try {
    const response = await fetch('/api/workout-types');
    if (!response.ok) throw new Error('운동종류 조회 실패');
    
    const workoutTypes = await response.json();
    // 원본 데이터를 전역 변수에 저장 (검색 필터링용)
    window.allWorkoutTypes = workoutTypes;
    renderWorkoutTypesList(workoutTypes);
  } catch (error) {
    console.error('운동종류 조회 오류:', error);
    const listContainer = document.getElementById('user-app-workout-types-list');
    if (listContainer) {
      listContainer.innerHTML = '<div style="text-align:center;padding:12px;color:#d32f2f;font-size:0.75rem;">운동종류를 불러오는 중 오류가 발생했습니다.</div>';
    }
  }
}

// 정렬 상태 관리 (기본값: 이름순 오름차순)
let workoutTypesSortColumn = 'name';
let workoutTypesSortDirection = 'asc'; // 'asc' or 'desc'

function renderWorkoutTypesList(workoutTypes) {
  const listContainer = document.getElementById('user-app-workout-types-list');
  if (!listContainer) return;
  
  if (workoutTypes.length === 0) {
    listContainer.innerHTML = '<div style="text-align:center;padding:12px;color:#888;font-size:0.75rem;">등록된 운동종류가 없습니다.</div>';
    return;
  }
  
  // 정렬된 데이터 생성
  const sortedTypes = [...workoutTypes];
  if (workoutTypesSortColumn) {
    sortedTypes.sort((a, b) => {
      let aVal, bVal;
      
      switch (workoutTypesSortColumn) {
        case 'name':
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
          break;
        case 'type':
          aVal = (a.type || '세트').toLowerCase();
          bVal = (b.type || '세트').toLowerCase();
          break;
        case 'category_1':
          aVal = (a.category_1_name || '').toLowerCase();
          bVal = (b.category_1_name || '').toLowerCase();
          break;
        case 'category_2':
          aVal = (a.category_2_name || '').toLowerCase();
          bVal = (b.category_2_name || '').toLowerCase();
          break;
        case 'category_3':
          aVal = (a.category_3_name || '').toLowerCase();
          bVal = (b.category_3_name || '').toLowerCase();
          break;
        case 'category_4':
          aVal = (a.category_4_name || '').toLowerCase();
          bVal = (b.category_4_name || '').toLowerCase();
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return workoutTypesSortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return workoutTypesSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }
  
  // 정렬 아이콘 생성 함수
  const getSortIcon = (column) => {
    if (workoutTypesSortColumn !== column) {
      return '<span style="color:#999;font-size:0.7rem;margin-left:4px;">↕</span>';
    }
    return workoutTypesSortDirection === 'asc' 
      ? '<span style="color:#1976d2;font-size:0.7rem;margin-left:4px;">↑</span>'
      : '<span style="color:#1976d2;font-size:0.7rem;margin-left:4px;">↓</span>';
  };
  
  let html = `
    <table style="width:100%;border-collapse:collapse;font-size:0.75rem;">
      <thead>
        <tr style="background:#f5f5f5;border-bottom:1px solid #ddd;">
          <th class="workout-types-sortable" data-column="name" style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;cursor:pointer;user-select:none;">운동 이름${getSortIcon('name')}</th>
          <th class="workout-types-sortable" data-column="type" style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;cursor:pointer;user-select:none;">타입${getSortIcon('type')}</th>
          <th class="workout-types-sortable" data-column="category_1" style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;cursor:pointer;user-select:none;">분류 1${getSortIcon('category_1')}</th>
          <th class="workout-types-sortable" data-column="category_2" style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;cursor:pointer;user-select:none;">분류 2${getSortIcon('category_2')}</th>
          <th class="workout-types-sortable" data-column="category_3" style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;cursor:pointer;user-select:none;">분류 3${getSortIcon('category_3')}</th>
          <th class="workout-types-sortable" data-column="category_4" style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;cursor:pointer;user-select:none;">분류 4${getSortIcon('category_4')}</th>
          <th style="padding:4px 6px;text-align:center;font-weight:600;color:#333;font-size:0.75rem;">작업</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  sortedTypes.forEach(type => {
    html += `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:4px 6px;">${escapeHtml(type.name)}</td>
        <td style="padding:4px 6px;color:#666;">${escapeHtml(type.type || '세트')}</td>
        <td style="padding:4px 6px;color:#666;">${type.category_1_name || '-'}</td>
        <td style="padding:4px 6px;color:#666;">${type.category_2_name || '-'}</td>
        <td style="padding:4px 6px;color:#666;">${type.category_3_name || '-'}</td>
        <td style="padding:4px 6px;color:#666;">${type.category_4_name || '-'}</td>
        <td style="padding:4px 6px;text-align:center;">
          <button class="user-app-workout-type-edit-btn" data-id="${type.id}" style="background:#1976d2;color:#fff;border:none;padding:2px 6px;border-radius:2px;cursor:pointer;font-size:0.7rem;margin-right:2px;">
            수정
          </button>
          <button class="user-app-workout-type-delete-btn" data-id="${type.id}" style="background:#d32f2f;color:#fff;border:none;padding:2px 6px;border-radius:2px;cursor:pointer;font-size:0.7rem;">
            삭제
          </button>
        </td>
      </tr>
    `;
  });
  
  html += `
      </tbody>
    </table>
  `;
  
  listContainer.innerHTML = html;
  
  // 정렬 헤더 클릭 이벤트
  listContainer.querySelectorAll('.workout-types-sortable').forEach(th => {
    th.addEventListener('click', () => {
      const column = th.getAttribute('data-column');
      if (workoutTypesSortColumn === column) {
        // 같은 컬럼 클릭 시 방향 전환
        workoutTypesSortDirection = workoutTypesSortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        // 다른 컬럼 클릭 시 오름차순으로 설정
        workoutTypesSortColumn = column;
        workoutTypesSortDirection = 'asc';
      }
      renderWorkoutTypesList(workoutTypes);
    });
    
    // 호버 효과
    th.addEventListener('mouseenter', () => {
      th.style.backgroundColor = '#e0e0e0';
    });
    th.addEventListener('mouseleave', () => {
      th.style.backgroundColor = '';
    });
  });
  
  // 수정/삭제 버튼 이벤트
  listContainer.querySelectorAll('.user-app-workout-type-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const workoutType = workoutTypes.find(t => t.id === id);
      if (workoutType) {
        showWorkoutTypeEditModal(workoutType);
      }
    });
  });
  
  listContainer.querySelectorAll('.user-app-workout-type-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      deleteWorkoutType(id);
    });
  });
}

async function loadCategories(categoryNumber) {
  try {
    const response = await fetch(`/api/workout-categories/${categoryNumber}`);
    if (!response.ok) throw new Error('분류 조회 실패');
    
    const categories = await response.json();
    renderCategoryList(categoryNumber, categories);
  } catch (error) {
    console.error(`분류 ${categoryNumber} 조회 오류:`, error);
  }
}

function renderCategoryList(categoryNumber, categories) {
  const listContainer = document.querySelector(`.user-app-category-list[data-category="${categoryNumber}"]`);
  if (!listContainer) return;
  
  if (categories.length === 0) {
    listContainer.innerHTML = '<div style="text-align:center;padding:8px;color:#888;font-size:0.75rem;">등록된 분류가 없습니다.</div>';
    return;
  }
  
  let html = '<ul style="list-style:none;padding:0;margin:0;">';
  categories.forEach(category => {
    html += `
      <li style="display:flex;justify-content:space-between;align-items:center;padding:3px 4px;border-bottom:1px solid #eee;">
        <span style="font-size:0.75rem;">${escapeHtml(category.name)}</span>
        <div>
          <button class="user-app-category-edit-btn" data-category="${categoryNumber}" data-id="${category.id}" style="background:#1976d2;color:#fff;border:none;padding:1px 5px;border-radius:2px;cursor:pointer;font-size:0.65rem;margin-right:2px;">
            수정
          </button>
          <button class="user-app-category-delete-btn" data-category="${categoryNumber}" data-id="${category.id}" style="background:#d32f2f;color:#fff;border:none;padding:1px 5px;border-radius:2px;cursor:pointer;font-size:0.65rem;">
            삭제
          </button>
        </div>
      </li>
    `;
  });
  html += '</ul>';
  
  listContainer.innerHTML = html;
  
  // 수정/삭제 버튼 이벤트
  listContainer.querySelectorAll('.user-app-category-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const categoryNumber = btn.getAttribute('data-category');
      const id = btn.getAttribute('data-id');
      const category = categories.find(c => c.id === id);
      if (category) {
        showCategoryEditModal(categoryNumber, category);
      }
    });
  });
  
  listContainer.querySelectorAll('.user-app-category-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const categoryNumber = btn.getAttribute('data-category');
      const id = btn.getAttribute('data-id');
      deleteCategory(categoryNumber, id);
    });
  });
}

function showMemberAddModal() {
  showMemberModal(null);
}

function showMemberEditModal(member) {
  showMemberModal(member);
}

function showMemberModal(member = null) {
  const modalBg = document.createElement('div');
  modalBg.className = 'modal-bg';
  modalBg.style.cssText = 'position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);';
  
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:16px;border-radius:8px;width:90vw;max-width:400px;max-height:90vh;overflow-y:auto;font-size:0.85rem;box-sizing:border-box;';
  
  modal.innerHTML = `
    <h3 style="margin:0 0 12px 0;color:#1976d2;font-size:1rem;">${member ? '회원 수정' : '회원 추가'}</h3>
    <form id="member-form">
      <div style="margin-bottom:10px;">
        <label style="display:block;margin-bottom:4px;font-weight:600;color:#333;font-size:0.85rem;">아이디 ${member ? '' : '*'}</label>
        <input type="text" id="member-username" ${member ? 'readonly' : 'required'} value="${member ? escapeHtml(member.username) : ''}" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:0.85rem;background:${member ? '#f5f5f5' : '#fff'};box-sizing:border-box;">
      </div>
      ${member ? `
      <div style="margin-bottom:10px;">
        <label style="display:block;margin-bottom:4px;font-weight:600;color:#333;font-size:0.85rem;">비밀번호 변경 (변경 안함: 비우기)</label>
        <input type="password" id="member-password" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:0.85rem;box-sizing:border-box;">
      </div>
      ` : `
      <div style="margin-bottom:10px;">
        <label style="display:block;margin-bottom:4px;font-weight:600;color:#333;font-size:0.85rem;">비밀번호 *</label>
        <input type="password" id="member-password" required style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:0.85rem;">
      </div>
      `}
      <div style="margin-bottom:10px;">
        <label style="display:block;margin-bottom:4px;font-weight:600;color:#333;font-size:0.85rem;">이름 *</label>
        <input type="text" id="member-name" required value="${member ? escapeHtml(member.name) : ''}" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:0.85rem;box-sizing:border-box;">
      </div>
      <div style="margin-bottom:10px;">
        <label style="display:block;margin-bottom:4px;font-weight:600;color:#333;font-size:0.85rem;">전화번호 *</label>
        <input type="tel" id="member-phone" required value="${member ? escapeHtml(member.phone || '') : ''}" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:0.85rem;box-sizing:border-box;">
      </div>
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <label style="font-weight:600;color:#333;font-size:0.85rem;">회원명 (선택)</label>
          ${member ? `<button type="button" class="member-search-btn header-text-btn" style="background:#e3f2fd !important;color:#1976d2 !important;border:none;padding:4px 8px;border-radius:3px;cursor:pointer;font-size:0.75rem;">검색/연결</button>` : ''}
        </div>
        <input type="text" id="member-member-name" readonly value="${member ? escapeHtml(member.member_name || '') : ''}" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:0.85rem;box-sizing:border-box;background:#f5f5f5;">
        ${member ? `<div id="member-match-result" style="margin-top:6px;font-size:0.75rem;color:#666;"></div>` : ''}
      </div>
      <div style="margin-bottom:10px;">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" id="member-is-active" ${member && member.is_active ? 'checked' : ''} style="cursor:pointer;width:16px;height:16px;">
          <span style="font-weight:600;color:#333;font-size:0.85rem;">계정 활성화</span>
        </label>
      </div>
      <div id="member-result" style="min-height:18px;color:#d32f2f;margin-top:8px;font-size:0.8rem;"></div>
      <div style="display:flex;gap:8px;justify-content:space-between;margin-top:12px;">
        ${member ? `
        <button type="button" class="member-delete-btn" data-id="${member.id}" style="background:#d32f2f;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;">삭제</button>
        ` : '<div></div>'}
        <div style="display:flex;gap:8px;">
          <button type="button" class="member-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;">취소</button>
          <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;">${member ? '수정' : '추가'}</button>
        </div>
      </div>
    </form>
  `;
  
  document.body.appendChild(modalBg);
  document.body.appendChild(modal);
  
  const closeModal = () => {
    document.body.removeChild(modalBg);
    document.body.removeChild(modal);
  };
  
  modalBg.addEventListener('click', closeModal);
  modal.querySelector('.member-cancel-btn').addEventListener('click', closeModal);
  
  // 회원 검색/연결 버튼 이벤트 (수정 모달에만 표시)
  if (member) {
    const searchBtn = modal.querySelector('.member-search-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', async () => {
        await searchAndLinkMember(modal, member);
      });
    }
    
    // 페이지 로드 시 자동 매칭 검색
    setTimeout(async () => {
      await autoMatchMember(modal, member);
    }, 100);
  }
  
  // 삭제 버튼 이벤트 (수정 모달에만 표시)
  if (member) {
    const deleteBtn = modal.querySelector('.member-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (confirm('정말 삭제하시겠습니까?')) {
          try {
            const response = await fetch(`/api/app-users/${member.id}`, {
              method: 'DELETE'
            });
            
            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.message || '삭제 실패');
            }
            
            closeModal();
            await loadMembers();
          } catch (error) {
            alert(error.message || '삭제 중 오류가 발생했습니다.');
          }
        }
      });
    }
  }
  
  modal.querySelector('#member-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultDiv = modal.querySelector('#member-result');
    resultDiv.textContent = '';
    
    const username = modal.querySelector('#member-username').value.trim();
    const password = modal.querySelector('#member-password').value;
    const name = modal.querySelector('#member-name').value.trim();
    const phone = modal.querySelector('#member-phone').value.trim();
    const memberName = modal.querySelector('#member-member-name').value.trim() || null;
    const isActive = modal.querySelector('#member-is-active').checked;
    
    if (!member && !password) {
      resultDiv.textContent = '비밀번호를 입력해주세요.';
      return;
    }
    
    if (!name || !phone) {
      resultDiv.textContent = '이름과 전화번호를 입력해주세요.';
      return;
    }
    
    try {
      if (member) {
        // 수정
        const updates = {
          name,
          phone,
          member_name: memberName,
          is_active: isActive
        };
        if (password) {
          updates.password = password;
        }
        
        const response = await fetch(`/api/app-users/${member.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || '수정 실패');
        }
      } else {
        // 추가
        const response = await fetch('/api/app-users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            password,
            name,
            phone,
            member_name: memberName,
            is_active: isActive
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || '추가 실패');
        }
      }
      
      closeModal();
      await loadMembers();
    } catch (error) {
      resultDiv.textContent = error.message || '오류가 발생했습니다.';
    }
  });
}

// 회원 자동 매칭 검색
async function autoMatchMember(modal, appUser) {
  if (!appUser || !appUser.name) return;
  
  try {
    const response = await fetch('/api/members');
    if (!response.ok) return;
    
    const members = await response.json();
    const matchResult = modal.querySelector('#member-match-result');
    if (!matchResult) return;
    
    // 이름으로 정확히 매칭되는 회원 찾기
    const exactMatch = members.find(m => m.name === appUser.name);
    
    if (exactMatch) {
      // 이미 연결되어 있는지 확인
      if (appUser.member_name === exactMatch.name) {
        matchResult.innerHTML = `<span style="color:#4caf50;">✓ 연결됨: ${escapeHtml(exactMatch.name)}</span>`;
      } else {
        matchResult.innerHTML = `<span style="color:#1976d2;">💡 동일 이름 발견: ${escapeHtml(exactMatch.name)} - 연결 버튼을 클릭하세요</span>`;
      }
    }
  } catch (error) {
    console.error('회원 자동 매칭 오류:', error);
  }
}

// 회원 검색 및 연결
async function searchAndLinkMember(modal, appUser) {
  try {
    // 회원 목록 조회
    const response = await fetch('/api/members');
    if (!response.ok) throw new Error('회원 목록 조회 실패');
    
    const members = await response.json();
    const matchResult = modal.querySelector('#member-match-result');
    
    // 이름으로 정확히 매칭되는 회원 찾기
    const exactMatch = members.find(m => m.name === appUser.name);
    
    if (exactMatch) {
      // 동일 이름이 있으면 바로 연결 제안
      if (confirm(`"${exactMatch.name}" 회원으로 연결하시겠습니까?`)) {
        await linkMemberToAppUser(appUser.id, exactMatch.name, modal);
      }
    } else {
      // 동일 이름이 없으면 회원 목록 선택 모달 표시
      showMemberSelectModal(members, appUser, modal);
    }
  } catch (error) {
    console.error('회원 검색 오류:', error);
    const matchResult = modal.querySelector('#member-match-result');
    if (matchResult) {
      matchResult.innerHTML = '<span style="color:#d32f2f;">회원 목록 조회 실패</span>';
    }
  }
}

// 회원 선택 모달 표시
function showMemberSelectModal(members, appUser, parentModal) {
  const selectModalBg = document.createElement('div');
  selectModalBg.className = 'modal-bg';
  selectModalBg.style.cssText = 'position:fixed;z-index:1002;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.6);';
  
  const selectModal = document.createElement('div');
  selectModal.style.cssText = 'position:fixed;z-index:1003;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:16px;border-radius:8px;width:90vw;max-width:500px;max-height:80vh;overflow-y:auto;font-size:0.85rem;box-sizing:border-box;';
  
  selectModal.innerHTML = `
    <h3 style="margin:0 0 12px 0;color:#1976d2;font-size:1rem;">회원 연결</h3>
    <div style="margin-bottom:12px;font-size:0.85rem;color:#666;">연결할 회원을 선택하세요</div>
    <div style="margin-bottom:12px;">
      <input type="text" id="member-search-input" placeholder="회원명 검색" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:0.85rem;box-sizing:border-box;">
    </div>
    <div style="max-height:400px;overflow-y:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
        <thead>
          <tr style="background:#f5f5f5;border-bottom:1px solid #ddd;">
            <th style="padding:6px 8px;text-align:left;font-weight:600;color:#333;font-size:0.8rem;">이름</th>
            <th style="padding:6px 8px;text-align:left;font-weight:600;color:#333;font-size:0.8rem;">전화번호</th>
            <th style="padding:6px 8px;text-align:center;font-weight:600;color:#333;font-size:0.8rem;">작업</th>
          </tr>
        </thead>
        <tbody id="member-select-tbody">
          ${members.length === 0 ? `
          <tr>
            <td colspan="3" style="padding:20px;text-align:center;color:#888;">등록된 회원이 없습니다.</td>
          </tr>
          ` : members.map(m => `
          <tr class="member-select-row" data-member-name="${escapeHtml(m.name)}" style="border-bottom:1px solid #eee;">
            <td style="padding:6px 8px;">${escapeHtml(m.name)}</td>
            <td style="padding:6px 8px;color:#666;">${escapeHtml(m.phone || '-')}</td>
            <td style="padding:6px 8px;text-align:center;">
              <button class="member-link-btn header-text-btn" data-member-name="${escapeHtml(m.name)}" style="background:#e3f2fd !important;color:#1976d2 !important;border:none;padding:4px 8px;border-radius:3px;cursor:pointer;font-size:0.75rem;">연결</button>
            </td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
      <button type="button" class="member-select-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;">취소</button>
    </div>
  `;
  
  document.body.appendChild(selectModalBg);
  document.body.appendChild(selectModal);
  
  const tbody = selectModal.querySelector('#member-select-tbody');
  const searchInput = selectModal.querySelector('#member-search-input');
  
  // 회원 목록 필터링 및 렌더링 함수
  const filterAndRenderMembers = (searchTerm) => {
    const filtered = searchTerm.trim() === '' 
      ? members 
      : members.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" style="padding:20px;text-align:center;color:#888;">검색 결과가 없습니다.</td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filtered.map(m => `
        <tr class="member-select-row" data-member-name="${escapeHtml(m.name)}" style="border-bottom:1px solid #eee;">
          <td style="padding:6px 8px;">${escapeHtml(m.name)}</td>
          <td style="padding:6px 8px;color:#666;">${escapeHtml(m.phone || '-')}</td>
          <td style="padding:6px 8px;text-align:center;">
            <button class="member-link-btn" data-member-name="${escapeHtml(m.name)}" style="background:#1976d2;color:#fff;border:none;padding:4px 8px;border-radius:3px;cursor:pointer;font-size:0.75rem;">연결</button>
          </td>
        </tr>
      `).join('');
      
      // 연결 버튼 이벤트 재등록
      tbody.querySelectorAll('.member-link-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const memberName = btn.getAttribute('data-member-name');
          closeSelectModal();
          await linkMemberToAppUser(appUser.id, memberName, parentModal);
        });
      });
    }
  };
  
  // 검색 입력 이벤트
  searchInput.addEventListener('input', (e) => {
    filterAndRenderMembers(e.target.value);
  });
  
  const closeSelectModal = () => {
    document.body.removeChild(selectModalBg);
    document.body.removeChild(selectModal);
  };
  
  selectModalBg.addEventListener('click', closeSelectModal);
  selectModal.querySelector('.member-select-cancel-btn').addEventListener('click', closeSelectModal);
  
  // 초기 연결 버튼 이벤트
  tbody.querySelectorAll('.member-link-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const memberName = btn.getAttribute('data-member-name');
      closeSelectModal();
      await linkMemberToAppUser(appUser.id, memberName, parentModal);
    });
  });
}

// 회원 연결 처리
async function linkMemberToAppUser(appUserId, memberName, modal) {
  try {
    const response = await fetch(`/api/app-users/${appUserId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_name: memberName
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '연결 실패');
    }
    
    // 모달의 회원명 필드 업데이트
    const memberNameInput = modal.querySelector('#member-member-name');
    if (memberNameInput) {
      memberNameInput.value = memberName;
    }
    
    // 매칭 결과 업데이트
    const matchResult = modal.querySelector('#member-match-result');
    if (matchResult) {
      matchResult.innerHTML = `<span style="color:#4caf50;">✓ 연결됨: ${escapeHtml(memberName)}</span>`;
    }
    
    // 목록 새로고침
    await loadMembers();
  } catch (error) {
    console.error('회원 연결 오류:', error);
    const matchResult = modal.querySelector('#member-match-result');
    if (matchResult) {
      matchResult.innerHTML = `<span style="color:#d32f2f;">연결 실패: ${error.message}</span>`;
    }
  }
}

async function deleteMember(id) {
  if (!confirm('정말 삭제하시겠습니까?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/app-users/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '삭제 실패');
    }
    
    await loadMembers();
  } catch (error) {
    alert(error.message || '삭제 중 오류가 발생했습니다.');
  }
}

function showWorkoutTypeAddModal() {
  showWorkoutTypeModal(null);
}

function showWorkoutTypeEditModal(workoutType) {
  showWorkoutTypeModal(workoutType);
}

async function showWorkoutTypeModal(workoutType = null) {
  // 분류 목록 로드
  const [categories1, categories2, categories3, categories4] = await Promise.all([
    fetch('/api/workout-categories/1').then(r => r.json()),
    fetch('/api/workout-categories/2').then(r => r.json()),
    fetch('/api/workout-categories/3').then(r => r.json()),
    fetch('/api/workout-categories/4').then(r => r.json())
  ]);
  
  const modalBg = document.createElement('div');
  modalBg.className = 'modal-bg';
  modalBg.style.cssText = 'position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);';
  
  const modal = document.createElement('div');
  // 모바일에서는 더 작은 min-width 사용 (뷰포트 너비가 600px 미만일 때)
  const isMobile = window.innerWidth < 600;
  const minWidthStyle = isMobile ? 'min-width:300px;' : 'min-width:500px;';
  modal.style.cssText = `position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:8px;${minWidthStyle}max-width:90vw;max-height:90vh;overflow-y:auto;`;
  
  modal.innerHTML = `
    <h3 style="margin-top:0;margin-bottom:20px;color:#1976d2;">${workoutType ? '운동종류 수정' : '운동종류 추가'}</h3>
    <form id="workout-type-form">
      <div style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:8px;font-weight:600;color:#333;">운동 이름 *</label>
        <input type="text" id="workout-type-name" required value="${workoutType ? escapeHtml(workoutType.name) : ''}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.95rem;">
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:8px;font-weight:600;color:#333;">타입 *</label>
        <select id="workout-type-type" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.95rem;">
          <option value="세트" ${workoutType && workoutType.type === '세트' ? 'selected' : (!workoutType ? 'selected' : '')}>세트</option>
          <option value="시간" ${workoutType && workoutType.type === '시간' ? 'selected' : ''}>시간</option>
        </select>
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:8px;font-weight:600;color:#333;">분류 1</label>
        <select id="workout-type-category-1" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.95rem;">
          <option value="">선택 안함</option>
          ${categories1.map(c => `<option value="${c.id}" ${workoutType && workoutType.category_1_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:8px;font-weight:600;color:#333;">분류 2</label>
        <select id="workout-type-category-2" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.95rem;">
          <option value="">선택 안함</option>
          ${categories2.map(c => `<option value="${c.id}" ${workoutType && workoutType.category_2_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:8px;font-weight:600;color:#333;">분류 3</label>
        <select id="workout-type-category-3" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.95rem;">
          <option value="">선택 안함</option>
          ${categories3.map(c => `<option value="${c.id}" ${workoutType && workoutType.category_3_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:8px;font-weight:600;color:#333;">분류 4</label>
        <select id="workout-type-category-4" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.95rem;">
          <option value="">선택 안함</option>
          ${categories4.map(c => `<option value="${c.id}" ${workoutType && workoutType.category_4_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div id="workout-type-result" style="min-height:20px;color:#d32f2f;margin-top:12px;font-size:0.9rem;"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;">
        <button type="button" class="workout-type-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:0.95rem;">취소</button>
        <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:0.95rem;">${workoutType ? '수정' : '추가'}</button>
      </div>
    </form>
  `;
  
  document.body.appendChild(modalBg);
  document.body.appendChild(modal);
  
  const closeModal = () => {
    document.body.removeChild(modalBg);
    document.body.removeChild(modal);
  };
  
  modalBg.addEventListener('click', closeModal);
  modal.querySelector('.workout-type-cancel-btn').addEventListener('click', closeModal);
  
  modal.querySelector('#workout-type-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultDiv = modal.querySelector('#workout-type-result');
    resultDiv.textContent = '';
    
    const name = modal.querySelector('#workout-type-name').value.trim();
    const type = modal.querySelector('#workout-type-type').value;
    const category1Id = modal.querySelector('#workout-type-category-1').value || null;
    const category2Id = modal.querySelector('#workout-type-category-2').value || null;
    const category3Id = modal.querySelector('#workout-type-category-3').value || null;
    const category4Id = modal.querySelector('#workout-type-category-4').value || null;
    
    if (!name) {
      resultDiv.textContent = '운동 이름을 입력해주세요.';
      return;
    }
    
    if (!type) {
      resultDiv.textContent = '타입을 선택해주세요.';
      return;
    }
    
    try {
      if (workoutType) {
        // 수정
        const response = await fetch(`/api/workout-types/${workoutType.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            type,
            category_1_id: category1Id,
            category_2_id: category2Id,
            category_3_id: category3Id,
            category_4_id: category4Id
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || '수정 실패');
        }
      } else {
        // 추가
        const response = await fetch('/api/workout-types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            type,
            category_1_id: category1Id,
            category_2_id: category2Id,
            category_3_id: category3Id,
            category_4_id: category4Id
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || '추가 실패');
        }
      }
      
      closeModal();
      await loadWorkoutTypes();
    } catch (error) {
      resultDiv.textContent = error.message || '오류가 발생했습니다.';
    }
  });
}

function showCategoryAddModal(categoryNumber) {
  showCategoryModal(categoryNumber, null);
}

function showCategoryEditModal(categoryNumber, category) {
  showCategoryModal(categoryNumber, category);
}

function showCategoryModal(categoryNumber, category = null) {
  const modalBg = document.createElement('div');
  modalBg.className = 'modal-bg';
  modalBg.style.cssText = 'position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);';
  
  const modal = document.createElement('div');
  // 모바일에서는 더 작은 min-width 사용 (뷰포트 너비가 600px 미만일 때)
  const isMobile = window.innerWidth < 600;
  const minWidthStyle = isMobile ? 'min-width:300px;' : 'min-width:400px;';
  modal.style.cssText = `position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:8px;${minWidthStyle}max-width:90vw;`;
  
  modal.innerHTML = `
    <h3 style="margin-top:0;margin-bottom:20px;color:#1976d2;">분류 ${categoryNumber} ${category ? '수정' : '추가'}</h3>
    <form id="category-form">
      <div style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:8px;font-weight:600;color:#333;">분류 이름 *</label>
        <input type="text" id="category-name" required value="${category ? escapeHtml(category.name) : ''}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.95rem;">
      </div>
      <div id="category-result" style="min-height:20px;color:#d32f2f;margin-top:12px;font-size:0.9rem;"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;">
        <button type="button" class="category-cancel-btn" style="background:#eee;color:#1976d2;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:0.95rem;">취소</button>
        <button type="submit" style="background:#1976d2;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:0.95rem;">${category ? '수정' : '추가'}</button>
      </div>
    </form>
  `;
  
  document.body.appendChild(modalBg);
  document.body.appendChild(modal);
  
  const closeModal = () => {
    document.body.removeChild(modalBg);
    document.body.removeChild(modal);
  };
  
  modalBg.addEventListener('click', closeModal);
  modal.querySelector('.category-cancel-btn').addEventListener('click', closeModal);
  
  modal.querySelector('#category-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultDiv = modal.querySelector('#category-result');
    resultDiv.textContent = '';
    
    const name = modal.querySelector('#category-name').value.trim();
    
    if (!name) {
      resultDiv.textContent = '분류 이름을 입력해주세요.';
      return;
    }
    
    try {
      if (category) {
        // 수정
        const response = await fetch(`/api/workout-categories/${categoryNumber}/${category.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || '수정 실패');
        }
      } else {
        // 추가
        const response = await fetch(`/api/workout-categories/${categoryNumber}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || '추가 실패');
        }
      }
      
      closeModal();
      await loadCategories(categoryNumber);
      // 운동종류 목록도 새로고침 (분류가 변경되었을 수 있음)
      await loadWorkoutTypes();
    } catch (error) {
      resultDiv.textContent = error.message || '오류가 발생했습니다.';
    }
  });
}

async function deleteWorkoutType(id) {
  if (!confirm('정말 삭제하시겠습니까?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/workout-types/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '삭제 실패');
    }
    
    await loadWorkoutTypes();
  } catch (error) {
    alert(error.message || '삭제 중 오류가 발생했습니다.');
  }
}

async function deleteCategory(categoryNumber, id) {
  if (!confirm('정말 삭제하시겠습니까? 이 분류를 사용하는 운동종류의 분류가 제거됩니다.')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/workout-categories/${categoryNumber}/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '삭제 실패');
    }
    
    await loadCategories(categoryNumber);
    await loadWorkoutTypes();
  } catch (error) {
    alert(error.message || '삭제 중 오류가 발생했습니다.');
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
