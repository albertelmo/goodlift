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
          <h4 id="user-app-members-title" style="margin:0;color:#333;font-size:0.9rem;">회원 관리</h4>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <button id="user-app-members-tab-btn" class="header-text-btn" style="background:#1976d2 !important;color:#fff !important;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:0.75rem;">
              회원 관리
            </button>
            <button id="user-app-activity-tab-btn" class="header-text-btn" style="background:#fff !important;color:#1976d2 !important;border:1px solid #1976d2 !important;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:0.75rem;">
              회원 활동관리
            </button>
            <button id="user-app-announcements-btn" class="header-text-btn" style="background:#fff !important;color:#1976d2 !important;border:1px solid #1976d2 !important;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:0.75rem;">
              공지사항
            </button>
            <button id="user-app-member-add-btn" class="header-text-btn" style="background:#e3f2fd !important;color:#1976d2 !important;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:0.75rem;">
              회원 추가
            </button>
          </div>
        </div>
        <div id="user-app-members-list" style="background:#fff;border-radius:4px;padding:8px;">
          <div style="text-align:center;padding:12px;color:#888;font-size:0.75rem;">불러오는 중...</div>
        </div>
        <div id="user-app-activity-list" style="background:#fff;border-radius:4px;padding:8px;display:none;">
          <div style="text-align:center;padding:12px;color:#888;font-size:0.75rem;">불러오는 중...</div>
        </div>
      </div>
      
      <!-- 운동 가이드 설정 섹션 -->
      <div style="background:#f5f5f5;padding:12px;border-radius:8px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;flex-wrap:wrap;">
          <h4 style="margin:0;color:#333;font-size:0.9rem;">운동 가이드 설정</h4>
          <div style="display:flex;align-items:stretch;gap:8px;">
            <input type="text" id="user-app-guide-search" placeholder="운동 이름 검색..." style="width:200px;padding:4px 8px;border:1px solid #ddd;border-radius:3px;font-size:0.75rem;box-sizing:border-box;margin:0;font-family:inherit;">
            <button id="user-app-guide-save-btn" class="header-text-btn" style="background:#1976d2 !important;color:#fff !important;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:0.75rem;margin:0;font-family:inherit;white-space:nowrap;">
              목록 저장
            </button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div style="background:#fff;border-radius:4px;padding:8px;min-height:220px;">
            <div style="font-size:0.75rem;color:#666;margin-bottom:6px;">전체 운동 목록</div>
            <div id="user-app-guide-available-list" style="max-height:280px;overflow-y:auto;"></div>
          </div>
          <div style="background:#fff;border-radius:4px;padding:8px;min-height:220px;">
            <div style="font-size:0.75rem;color:#666;margin-bottom:6px;">가이드에 표시될 목록</div>
            <div id="user-app-guide-selected-list" style="max-height:280px;overflow-y:auto;"></div>
          </div>
        </div>
        <div style="font-size:0.7rem;color:#888;margin-top:6px;">좌측에서 추가 → 우측에서 순서 변경 후 저장하세요.</div>
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

  const announcementsBtn = container.querySelector('#user-app-announcements-btn');
  if (announcementsBtn) {
    announcementsBtn.addEventListener('click', () => {
      showAnnouncementsAdminModal();
    });
  }

  const membersTabBtn = container.querySelector('#user-app-members-tab-btn');
  const activityTabBtn = container.querySelector('#user-app-activity-tab-btn');
  if (membersTabBtn && activityTabBtn) {
    membersTabBtn.addEventListener('click', () => {
      setMembersTab('members');
    });
    activityTabBtn.addEventListener('click', () => {
      setMembersTab('activity');
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

  // 운동 가이드 검색 입력창
  const workoutGuideSearchInput = container.querySelector('#user-app-guide-search');
  if (workoutGuideSearchInput) {
    workoutGuideSearchInput.addEventListener('input', () => {
      workoutGuideSearchTerm = workoutGuideSearchInput.value.trim().toLowerCase();
      updateWorkoutGuideUI();
    });
  }

  const workoutGuideSaveBtn = container.querySelector('#user-app-guide-save-btn');
  if (workoutGuideSaveBtn) {
    workoutGuideSaveBtn.addEventListener('click', async () => {
      await saveWorkoutGuideSettings();
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
    loadWorkoutGuideSettings(),
    loadCategories(1),
    loadCategories(2),
    loadCategories(3),
    loadCategories(4)
  ]);
}

function setMembersTab(tab) {
  membersActiveTab = tab;
  const membersList = document.getElementById('user-app-members-list');
  const activityList = document.getElementById('user-app-activity-list');
  const membersTabBtn = document.getElementById('user-app-members-tab-btn');
  const activityTabBtn = document.getElementById('user-app-activity-tab-btn');
  const addMemberBtn = document.getElementById('user-app-member-add-btn');
  if (membersList && activityList) {
    membersList.style.display = tab === 'members' ? 'block' : 'none';
    activityList.style.display = tab === 'activity' ? 'block' : 'none';
  }
  if (membersTabBtn && activityTabBtn) {
    if (tab === 'members') {
      membersTabBtn.style.background = '#1976d2';
      membersTabBtn.style.color = '#fff';
      membersTabBtn.style.border = 'none';
      activityTabBtn.style.background = '#fff';
      activityTabBtn.style.color = '#1976d2';
      activityTabBtn.style.border = '1px solid #1976d2';
    } else {
      activityTabBtn.style.background = '#1976d2';
      activityTabBtn.style.color = '#fff';
      activityTabBtn.style.border = 'none';
      membersTabBtn.style.background = '#fff';
      membersTabBtn.style.color = '#1976d2';
      membersTabBtn.style.border = '1px solid #1976d2';
    }
  }
  if (addMemberBtn) {
    addMemberBtn.style.display = tab === 'members' ? 'inline-block' : 'none';
  }
  if (tab === 'activity') {
    activityCurrentPage = 1;
    renderMemberActivityList(membersCached);
  }
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
          <div class="user-app-activity-item" data-label="회원 운동 코멘트" data-event-type="workout_comment_create" data-actor-role="member" data-source="self" style="font-size:0.75rem;color:#555;cursor:pointer;">운동 코멘트: <strong>${members.workoutCommentUsers || 0}</strong></div>
          <div class="user-app-activity-item" data-label="회원 식단 코멘트" data-event-type="diet_comment_create" data-actor-role="member" data-source="self" style="font-size:0.75rem;color:#555;cursor:pointer;">식단 코멘트: <strong>${members.dietCommentUsers || 0}</strong></div>
        </div>
        <div style="border:1px solid #eee;border-radius:6px;padding:8px;">
          <div style="font-size:0.8rem;font-weight:600;color:#1976d2;margin-bottom:6px;">기록 건수</div>
          <div class="user-app-activity-item" data-label="운동 건수(직접)" data-event-type="workout_create" data-actor-role="member" data-source="self" style="font-size:0.75rem;color:#555;cursor:pointer;">운동(직접): <strong>${counts.workoutSelf || 0}</strong></div>
          <div class="user-app-activity-item" data-label="운동 건수(대리)" data-event-type="workout_create" data-actor-role="trainer" data-source="trainer_proxy" style="font-size:0.75rem;color:#555;cursor:pointer;">운동(대리): <strong>${counts.workoutProxy || 0}</strong></div>
          <div class="user-app-activity-item" data-label="식단 건수(직접)" data-event-type="diet_create" data-actor-role="member" data-source="self" style="font-size:0.75rem;color:#555;cursor:pointer;">식단(직접): <strong>${counts.dietSelf || 0}</strong></div>
          <div class="user-app-activity-item" data-label="식단 건수(대리)" data-event-type="diet_create" data-actor-role="trainer" data-source="trainer_proxy" style="font-size:0.75rem;color:#555;cursor:pointer;">식단(대리): <strong>${counts.dietProxy || 0}</strong></div>
          <div class="user-app-activity-item" data-label="운동 코멘트(회원)" data-event-type="workout_comment_create" data-actor-role="member" data-source="self" style="font-size:0.75rem;color:#555;cursor:pointer;">운동 코멘트(회원): <strong>${counts.workoutCommentsMember || 0}</strong></div>
          <div class="user-app-activity-item" data-label="운동 코멘트(트레이너)" data-event-type="workout_comment_create" data-actor-role="trainer" data-source="trainer_proxy" style="font-size:0.75rem;color:#555;cursor:pointer;">운동 코멘트(트레이너): <strong>${counts.workoutCommentsTrainer || 0}</strong></div>
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
    pushStatusCache.clear();
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
          const centerMap = {};
          members.forEach(member => {
            if (memberNamesWithLink.includes(member.name)) {
              const trainerUsername = member.trainer || '';
              const trainerName = trainerUsername ? (trainerNameMap[trainerUsername] || trainerUsername) : '-';
              trainerMap[member.name] = trainerName;
              centerMap[member.name] = member.center || '미지정';
            }
          });
          // app_users에 trainer/center 정보 추가 (이름으로 변환됨)
          const membersWithTrainer = appUsers.map(user => ({
            ...user,
            trainer: user.member_name ? (trainerMap[user.member_name] || '-') : '-',
            center: user.member_name ? (centerMap[user.member_name] || '미지정') : '미지정'
          }));
          membersCached = membersWithTrainer;
          renderMembersList(membersCached);
          return;
        }
      } catch (error) {
        console.error('회원 트레이너 정보 조회 오류:', error);
      }
    }
    
    // app_users에 trainer/center 정보 추가 (이름으로 변환됨)
    const membersWithTrainer = appUsers.map(user => ({
      ...user,
      trainer: user.member_name ? (trainerMap[user.member_name] || '-') : '-',
      center: '미지정'
    }));
    membersCached = membersWithTrainer;
    renderMembersList(membersCached);
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
const membersPageSize = 10;
let membersCurrentPage = 1;
let membersCached = [];
let membersActiveTab = 'members';
let activityCurrentPage = 1;
let activitySortColumn = 'name';
let activitySortDirection = 'asc';
let workoutGuideSettings = { items: [] };
let workoutGuideLoaded = false;
let workoutTypesLoaded = false;
let workoutGuideSearchTerm = '';
let announcementsCached = [];
const announcementReadStats = new Map();
const pushStatusCache = new Map();

function setPushStatusBadge(element, state) {
  if (!element) return;
  const baseStyle = 'padding:2px 6px;border-radius:2px;font-size:0.7rem;color:#fff;display:inline-block;';
  if (state === 'on') {
    element.textContent = 'ON';
    element.style.cssText = `${baseStyle}background:#4caf50;`;
    return;
  }
  if (state === 'off') {
    element.textContent = 'OFF';
    element.style.cssText = `${baseStyle}background:#999;`;
    return;
  }
  if (state === 'error') {
    element.textContent = '확인불가';
    element.style.cssText = `${baseStyle}background:#d32f2f;`;
    return;
  }
  element.textContent = '확인중';
  element.style.cssText = `${baseStyle}background:#bdbdbd;`;
}

function getPushDeviceLabel(item) {
  const platform = (item.platform || '').toLowerCase();
  const ua = (item.user_agent || '').toLowerCase();
  if (platform.includes('ios') || ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) {
    return 'iPhone/iPad';
  }
  if (platform.includes('android') || ua.includes('android')) {
    return 'Android';
  }
  if (platform.includes('windows') || ua.includes('windows')) {
    return 'Windows';
  }
  if (platform.includes('mac') || ua.includes('mac os')) {
    return 'macOS';
  }
  return item.platform || '알수없음';
}

function formatPushDeviceDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function showPushDevicesModal(appUserId) {
  const member = (membersCached || []).find(item => item.id === appUserId);
  const titleText = member?.name ? `${member.name} (${member.username || '-'})` : '기기별 알림 설정';

  const modalBg = document.createElement('div');
  modalBg.className = 'modal-bg';
  modalBg.style.cssText = 'position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);';

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:10px;border-radius:6px;width:90vw;max-width:560px;max-height:70vh;overflow-y:auto;font-size:0.72rem;box-sizing:border-box;';
  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <h3 style="margin:0;color:#1976d2;font-size:0.85rem;">기기별 알림 설정</h3>
      <button class="push-devices-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:#666;">×</button>
    </div>
    <div style="color:#666;font-size:0.7rem;margin-bottom:8px;">${escapeHtml(titleText)}</div>
    <div class="push-devices-loading" style="text-align:center;padding:10px;color:#888;font-size:0.7rem;">불러오는 중...</div>
    <div class="push-devices-content"></div>
  `;

  document.body.appendChild(modalBg);
  document.body.appendChild(modal);

  const closeModal = () => {
    modalBg.remove();
    modal.remove();
  };
  modalBg.addEventListener('click', closeModal);
  modal.querySelector('.push-devices-close').addEventListener('click', closeModal);

  try {
    const response = await fetch(`/api/push/subscriptions?app_user_id=${encodeURIComponent(appUserId)}`);
    if (!response.ok) throw new Error('푸시 구독 목록 조회 실패');
    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];

    const content = modal.querySelector('.push-devices-content');
    const loading = modal.querySelector('.push-devices-loading');
    if (loading) loading.remove();

    if (items.length === 0) {
      content.innerHTML = '<div style="text-align:center;padding:12px;color:#888;">등록된 기기가 없습니다.</div>';
      return;
    }

    const rows = items.map(item => {
      const deviceLabel = getPushDeviceLabel(item);
      const statusText = item.is_active ? 'ON' : 'OFF';
      const statusColor = item.is_active ? '#4caf50' : '#999';
      return `
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:4px 6px;white-space:nowrap;">${escapeHtml(deviceLabel)}</td>
          <td style="padding:4px 6px;color:#666;">${escapeHtml(item.platform || '-')}</td>
          <td style="padding:4px 6px;color:#666;">${escapeHtml(formatPushDeviceDate(item.updated_at))}</td>
          <td style="padding:4px 6px;text-align:center;">
            <span style="padding:2px 6px;border-radius:2px;font-size:0.68rem;color:#fff;background:${statusColor};">${statusText}</span>
          </td>
        </tr>
      `;
    }).join('');

    content.innerHTML = `
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f5f5f5;border-bottom:1px solid #ddd;">
            <th style="padding:4px 6px;text-align:left;font-size:0.72rem;">기기</th>
            <th style="padding:4px 6px;text-align:left;font-size:0.72rem;">플랫폼</th>
            <th style="padding:4px 6px;text-align:left;font-size:0.72rem;">마지막 갱신</th>
            <th style="padding:4px 6px;text-align:center;font-size:0.72rem;">상태</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <div style="margin-top:6px;color:#999;font-size:0.64rem;">* 상태는 해당 기기의 알림 설정을 의미합니다.</div>
    `;
  } catch (error) {
    const content = modal.querySelector('.push-devices-content');
    const loading = modal.querySelector('.push-devices-loading');
    if (loading) loading.remove();
    content.innerHTML = '<div style="text-align:center;padding:12px;color:#d32f2f;">기기 목록을 불러오지 못했습니다.</div>';
    console.error('푸시 구독 목록 조회 오류:', error);
  }
}

function updatePushStatusBadges(appUserIds, fallbackState = null) {
  appUserIds.forEach(appUserId => {
    const badge = document.querySelector(`.push-status-badge[data-app-user-id="${appUserId}"]`);
    if (!badge) return;
    if (fallbackState) {
      setPushStatusBadge(badge, fallbackState);
      return;
    }
    const enabled = pushStatusCache.get(appUserId);
    if (enabled === undefined) {
      setPushStatusBadge(badge, 'loading');
    } else {
      setPushStatusBadge(badge, enabled ? 'on' : 'off');
    }
  });
}

async function loadPushStatusesForMembers(members) {
  if (!Array.isArray(members) || members.length === 0) return;
  const appUserIds = members.map(member => member.id).filter(Boolean);
  if (appUserIds.length === 0) return;

  const missingIds = appUserIds.filter(id => !pushStatusCache.has(id));
  updatePushStatusBadges(appUserIds);

  if (missingIds.length === 0) return;
  try {
    const response = await fetch(`/api/push/status-batch?app_user_ids=${encodeURIComponent(missingIds.join(','))}`);
    if (!response.ok) throw new Error('푸시 상태 조회 실패');
    const data = await response.json();
    const results = Array.isArray(data.results) ? data.results : [];
    const resultMap = new Map(results.map(item => [item.app_user_id, !!item.enabled]));
    missingIds.forEach(id => {
      pushStatusCache.set(id, resultMap.get(id) || false);
    });
    updatePushStatusBadges(appUserIds);
    if (membersSortColumn === 'push_status') {
      renderMembersList(membersCached);
    }
  } catch (error) {
    console.error('푸시 상태 조회 오류(일괄):', error);
    try {
      const responses = await Promise.all(missingIds.map(id =>
        fetch(`/api/push/status?app_user_id=${encodeURIComponent(id)}`)
      ));
      const results = await Promise.all(responses.map(res => res.ok ? res.json() : null));
      results.forEach((item, index) => {
        const id = missingIds[index];
        if (item && typeof item.enabled === 'boolean') {
          pushStatusCache.set(id, item.enabled);
        }
      });
      updatePushStatusBadges(appUserIds);
      if (membersSortColumn === 'push_status') {
        renderMembersList(membersCached);
      }
    } catch (fallbackError) {
      console.error('푸시 상태 조회 오류(개별):', fallbackError);
      updatePushStatusBadges(appUserIds, 'error');
    }
  }
}

function renderMembersList(members) {
  const listContainer = document.getElementById('user-app-members-list');
  if (!listContainer) return;

  if (membersSortColumn === 'push_status') {
    loadPushStatusesForMembers(members);
  }
  
  // 제목에 회원 수 표시
  const titleElement = document.getElementById('user-app-members-title');
  if (titleElement) {
    titleElement.textContent = `회원 관리 (${members.length}명)`;
  }
  
  if (members.length === 0) {
    listContainer.innerHTML = '<div style="text-align:center;padding:12px;color:#888;font-size:0.75rem;">등록된 회원이 없습니다.</div>';
    return;
  }
  
  // 정렬된 회원 목록 생성
  const getPushStatusValue = (member) => {
    const enabled = pushStatusCache.get(member.id);
    if (enabled === true) return 2;
    if (enabled === false) return 1;
    return 0;
  };

  const sortedMembers = [...members].sort((a, b) => {
    if (membersSortColumn === 'name') {
      const aValue = (a.name || '').trim();
      const bValue = (b.name || '').trim();
      const comparison = aValue.localeCompare(bValue, 'ko', { numeric: true });
      return membersSortDirection === 'asc' ? comparison : -comparison;
    } else if (membersSortColumn === 'push_status') {
      const aValue = getPushStatusValue(a);
      const bValue = getPushStatusValue(b);
      if (membersSortDirection === 'asc') {
        return aValue - bValue;
      }
      return bValue - aValue;
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
  
  const totalPages = Math.max(1, Math.ceil(sortedMembers.length / membersPageSize));
  if (membersCurrentPage > totalPages) {
    membersCurrentPage = totalPages;
  }
  const startIndex = (membersCurrentPage - 1) * membersPageSize;
  const pagedMembers = sortedMembers.slice(startIndex, startIndex + membersPageSize);
  
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
          <th class="members-sort-header" data-column="push_status" style="padding:4px 6px;text-align:center;font-weight:600;color:#333;font-size:0.75rem;cursor:pointer;user-select:none;position:relative;" onmouseover="this.style.backgroundColor='#e0e0e0'" onmouseout="this.style.backgroundColor='transparent'">
            알림${getSortIcon('push_status')}
          </th>
          <th style="padding:4px 6px;text-align:center;font-weight:600;color:#333;font-size:0.75rem;">상태</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  pagedMembers.forEach(member => {
    html += `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:4px 6px;">${escapeHtml(member.username)}</td>
        <td style="padding:4px 6px;">${escapeHtml(member.name)}</td>
        <td style="padding:4px 6px;color:#666;">${escapeHtml(member.phone || '-')}</td>
        <td style="padding:4px 6px;color:#666;">${member.member_name ? escapeHtml(member.member_name) : '-'}</td>
        <td style="padding:4px 6px;color:#666;">${member.trainer ? escapeHtml(member.trainer) : '-'}</td>
        <td style="padding:4px 6px;text-align:center;">
          <span class="push-status-badge" data-app-user-id="${member.id || ''}">확인중</span>
        </td>
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
    <div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 0;">
      <button data-page="prev" style="background:#fff;border:1px solid #ddd;color:#333;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:0.7rem;" ${membersCurrentPage === 1 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>이전</button>
      <span style="font-size:0.75rem;color:#666;">${membersCurrentPage} / ${totalPages}</span>
      <button data-page="next" style="background:#fff;border:1px solid #ddd;color:#333;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:0.7rem;" ${membersCurrentPage === totalPages ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>다음</button>
    </div>
  `;
  
  listContainer.innerHTML = html;
  
  // 정렬 헤더 클릭 이벤트
  listContainer.querySelectorAll('.members-sort-header').forEach(sortHeader => {
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
      membersCurrentPage = 1;
      renderMembersList(members);
    });
  });
  
  listContainer.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dir = btn.getAttribute('data-page');
      if (dir === 'prev' && membersCurrentPage > 1) {
        membersCurrentPage -= 1;
        renderMembersList(members);
      }
      if (dir === 'next') {
        const lastPage = Math.max(1, Math.ceil(sortedMembers.length / membersPageSize));
        if (membersCurrentPage < lastPage) {
          membersCurrentPage += 1;
          renderMembersList(members);
        }
      }
    });
  });
  
  // 테이블 행 클릭 이벤트 (수정 모달 열기)
  listContainer.querySelectorAll('tbody tr').forEach((row, index) => {
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => {
      const member = pagedMembers[index];
      if (member) {
        showMemberEditModal(member);
      }
    });
  });

  listContainer.querySelectorAll('.push-status-badge').forEach(badge => {
    badge.style.cursor = 'pointer';
    badge.addEventListener('click', (event) => {
      event.stopPropagation();
      const appUserId = badge.getAttribute('data-app-user-id');
      if (appUserId) {
        showPushDevicesModal(appUserId);
      }
    });
  });

  loadPushStatusesForMembers(pagedMembers);
}

function getWorkoutTierFromDays(days) {
  if (days >= 13) return 'diamond';
  if (days >= 9) return 'gold';
  if (days >= 5) return 'silver';
  if (days >= 1) return 'bronze';
  return 'none';
}

function getDietTierFromDays(days) {
  if (days >= 16) return 'diamond';
  if (days >= 11) return 'gold';
  if (days >= 6) return 'silver';
  if (days >= 1) return 'bronze';
  return 'none';
}

function getCommentTierFromCount(count) {
  if (count >= 16) return 'diamond';
  if (count >= 11) return 'gold';
  if (count >= 6) return 'silver';
  if (count >= 1) return 'bronze';
  return 'none';
}

async function loadAnnouncementsAdmin() {
  try {
    const response = await fetch('/api/announcements?include_inactive=true');
    if (!response.ok) throw new Error('공지사항 조회 실패');
    const data = await response.json();
    announcementsCached = data.items || [];
  } catch (error) {
    console.error('공지사항 조회 오류:', error);
    announcementsCached = [];
  }
}

async function loadAnnouncementReadStats(items) {
  if (!Array.isArray(items) || items.length === 0) {
    announcementReadStats.clear();
    return;
  }
  const ids = items.map(item => item.id).filter(Boolean);
  if (ids.length === 0) {
    announcementReadStats.clear();
    return;
  }
  try {
    const response = await fetch(`/api/announcements/read-stats?announcement_ids=${encodeURIComponent(ids.join(','))}`);
    if (!response.ok) throw new Error('읽음 통계 조회 실패');
    const data = await response.json();
    const results = Array.isArray(data.results) ? data.results : [];
    announcementReadStats.clear();
    results.forEach(row => {
      announcementReadStats.set(row.announcement_id, {
        total: parseInt(row.total_count || 0, 10),
        read: parseInt(row.read_count || 0, 10)
      });
    });
  } catch (error) {
    console.error('읽음 통계 조회 오류:', error);
  }
}

function formatAnnouncementReadStat(itemId) {
  const stats = announcementReadStats.get(itemId);
  if (!stats) return '읽음 -';
  return `읽음 ${stats.read}/${stats.total}`;
}

function formatAnnouncementUserLabel(item) {
  if (!item) return '-';
  const name = item.name || '회원';
  const username = item.username ? ` (${item.username})` : '';
  const memberName = item.member_name ? ` · ${item.member_name}` : '';
  const role = item.is_trainer ? '트레이너' : '회원';
  return `${name}${username} · ${role}${memberName}`;
}

function formatAnnouncementReadAt(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatAnnouncementDateOnly(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

async function showAnnouncementReadStatusModal(announcement) {
  const modalBg = document.createElement('div');
  modalBg.className = 'modal-bg';
  modalBg.style.cssText = 'position:fixed;z-index:1002;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);';

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;z-index:1003;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:12px;border-radius:8px;width:92vw;max-width:520px;max-height:80vh;overflow-y:auto;font-size:0.75rem;box-sizing:border-box;';
  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <h3 style="margin:0;color:#1976d2;font-size:0.9rem;">읽음 현황</h3>
      <button class="announcement-read-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:#666;">×</button>
    </div>
    <div style="font-weight:600;margin-bottom:6px;">${escapeHtml(announcement.title || '')}</div>
    <div class="announcement-read-summary" style="margin-bottom:8px;color:#666;font-size:0.72rem;">불러오는 중...</div>
    <div class="announcement-read-content" style="display:flex;flex-direction:column;gap:8px;"></div>
  `;

  document.body.appendChild(modalBg);
  document.body.appendChild(modal);

  const closeModal = () => {
    modalBg.remove();
    modal.remove();
  };
  modalBg.addEventListener('click', closeModal);
  modal.querySelector('.announcement-read-close').addEventListener('click', closeModal);

  try {
    const res = await fetch(`/api/announcements/${announcement.id}/read-status`);
    if (!res.ok) throw new Error('읽음 현황 조회 실패');
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    const readItems = items.filter(item => item.read_at);
    const unreadItems = items.filter(item => !item.read_at);

    const summaryEl = modal.querySelector('.announcement-read-summary');
    if (summaryEl) {
      summaryEl.textContent = `읽음 ${readItems.length} / 전체 ${items.length}`;
    }

    const contentEl = modal.querySelector('.announcement-read-content');
    if (!contentEl) return;
    if (items.length === 0) {
      contentEl.innerHTML = '<div style="text-align:center;padding:12px;color:#888;">수신 대상이 없습니다.</div>';
      return;
    }

    const renderList = (title, list, isRead) => `
      <div style="border:1px solid #eee;border-radius:6px;padding:8px;">
        <div style="font-weight:600;color:#333;margin-bottom:6px;">${title} (${list.length})</div>
        ${list.length === 0 ? '<div style="text-align:center;padding:8px;color:#888;">없음</div>' : `
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f5f5f5;border-bottom:1px solid #ddd;">
                <th style="padding:4px 6px;text-align:left;font-size:0.7rem;">회원</th>
                <th style="padding:4px 6px;text-align:left;font-size:0.7rem;">시간</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(item => `
                <tr style="border-bottom:1px solid #eee;">
                  <td style="padding:4px 6px;">${escapeHtml(formatAnnouncementUserLabel(item))}</td>
                  <td style="padding:4px 6px;color:#666;">${escapeHtml(isRead ? formatAnnouncementReadAt(item.read_at) : formatAnnouncementReadAt(item.delivered_at))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;

    contentEl.innerHTML = `
      ${renderList('읽음', readItems, true)}
      ${renderList('읽지않음', unreadItems, false)}
    `;
  } catch (error) {
    const summaryEl = modal.querySelector('.announcement-read-summary');
    const contentEl = modal.querySelector('.announcement-read-content');
    if (summaryEl) summaryEl.textContent = '읽음 현황을 불러오지 못했습니다.';
    if (contentEl) {
      contentEl.innerHTML = '<div style="text-align:center;padding:12px;color:#d32f2f;">데이터를 불러오지 못했습니다.</div>';
    }
    console.error('읽음 현황 조회 오류:', error);
  }
}

function showAnnouncementsAdminModal() {
  const modalBg = document.createElement('div');
  modalBg.className = 'modal-bg';
  modalBg.style.cssText = 'position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);';

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:12px;border-radius:8px;width:92vw;max-width:480px;max-height:80vh;overflow-y:auto;font-size:0.75rem;box-sizing:border-box;';
  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <h3 style="margin:0;color:#1976d2;font-size:0.9rem;">공지사항 관리</h3>
      <button class="announcement-admin-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:#666;">×</button>
    </div>
    <div style="background:#f5f5f5;border-radius:6px;padding:8px;margin-bottom:10px;">
      <div style="font-weight:600;color:#333;margin-bottom:6px;">공지사항 추가</div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <input type="text" id="announcement-title-input" placeholder="제목" style="padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:0.75rem;">
        <textarea id="announcement-content-input" placeholder="내용" rows="4" style="padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:0.75rem;resize:vertical;"></textarea>
        <div style="display:flex;justify-content:flex-end;">
          <button id="announcement-add-btn" class="header-text-btn" style="background:#1976d2 !important;color:#fff !important;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:0.75rem;">추가</button>
        </div>
      </div>
    </div>
    <div id="announcement-admin-list" style="display:flex;flex-direction:column;gap:8px;">
      <div style="text-align:center;padding:12px;color:#888;font-size:0.75rem;">불러오는 중...</div>
    </div>
  `;

  document.body.appendChild(modalBg);
  document.body.appendChild(modal);

  const closeModal = () => {
    modalBg.remove();
    modal.remove();
  };
  modalBg.addEventListener('click', closeModal);
  modal.querySelector('.announcement-admin-close').addEventListener('click', closeModal);

  const renderList = () => {
    const listEl = modal.querySelector('#announcement-admin-list');
    if (!listEl) return;
    if (announcementsCached.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;padding:12px;color:#888;">공지사항이 없습니다.</div>';
      return;
    }
    listEl.innerHTML = announcementsCached.map(item => {
      const statusText = item.is_active ? '사용중' : '삭제됨';
      const statusColor = item.is_active ? '#4caf50' : '#999';
      return `
        <div style="border:1px solid #eee;border-radius:6px;padding:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.title || '')}</div>
            <div style="font-size:0.7rem;color:#888;">${escapeHtml(formatAnnouncementDateOnly(item.created_at))}</div>
            <div style="font-size:0.7rem;color:#666;">${escapeHtml(formatAnnouncementReadStat(item.id))}</div>
          </div>
          <span style="font-size:0.7rem;color:#fff;background:${statusColor};padding:2px 6px;border-radius:10px;">${statusText}</span>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
            <button class="announcement-read-btn" data-id="${item.id}" style="background:#fff;color:#1976d2;border:1px solid #1976d2;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:0.7rem;">읽음현황</button>
            <button class="announcement-images-btn" data-id="${item.id}" style="background:#fff;color:#1976d2;border:1px solid #1976d2;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:0.7rem;">이미지</button>
            <button class="announcement-send-btn" data-id="${item.id}" style="background:#e3f2fd;color:#1976d2;border:none;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:0.7rem;">보내기</button>
            <button class="announcement-delete-btn" data-id="${item.id}" style="background:#fbe9e7;color:#d32f2f;border:none;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:0.7rem;">삭제</button>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.announcement-send-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = announcementsCached.find(a => a.id === id);
        if (item) showAnnouncementSendModal(item);
      });
    });
    listEl.querySelectorAll('.announcement-images-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = announcementsCached.find(a => a.id === id);
        if (item) showAnnouncementImagesModal(item);
      });
    });
    listEl.querySelectorAll('.announcement-read-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = announcementsCached.find(a => a.id === id);
        if (item) showAnnouncementReadStatusModal(item);
      });
    });
    listEl.querySelectorAll('.announcement-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!confirm('공지사항을 삭제하시겠습니까?')) return;
        try {
          const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('삭제 실패');
          await loadAnnouncementsAdmin();
          renderList();
        } catch (error) {
          alert('삭제 중 오류가 발생했습니다.');
        }
      });
    });
  };

  const addBtn = modal.querySelector('#announcement-add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const titleEl = modal.querySelector('#announcement-title-input');
      const contentEl = modal.querySelector('#announcement-content-input');
      const title = titleEl?.value?.trim();
      const content = contentEl?.value?.trim();
      if (!title || !content) {
        alert('제목과 내용을 입력해주세요.');
        return;
      }
      try {
        const createdBy = localStorage.getItem('username') || null;
        const res = await fetch('/api/announcements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content, created_by: createdBy })
        });
        if (!res.ok) throw new Error('추가 실패');
        if (titleEl) titleEl.value = '';
        if (contentEl) contentEl.value = '';
        await loadAnnouncementsAdmin();
        renderList();
      } catch (error) {
        alert('공지사항 추가 중 오류가 발생했습니다.');
      }
    });
  }

  (async () => {
    await loadAnnouncementsAdmin();
    await loadAnnouncementReadStats(announcementsCached);
    renderList();
  })();
}

function showAnnouncementSendModal(announcement) {
  const modalBg = document.createElement('div');
  modalBg.className = 'modal-bg';
  modalBg.style.cssText = 'position:fixed;z-index:1002;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);';

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;z-index:1003;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:12px;border-radius:8px;width:92vw;max-width:426px;max-height:80vh;overflow-y:auto;font-size:0.75rem;box-sizing:border-box;';

  const members = (membersCached || []).filter(m => !m.is_trainer);
  let trainersList = (membersCached || []).filter(m => m.is_trainer);
  const centerValues = Array.from(new Set(members.map(m => (m.center || '미지정'))));
  let centerFilter = 'all';
  const selectedIds = new Set();
  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <h3 style="margin:0;color:#1976d2;font-size:0.9rem;">공지사항 보내기</h3>
      <button class="announcement-send-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:#666;">×</button>
    </div>
    <div style="font-weight:600;margin-bottom:6px;">${escapeHtml(announcement.title || '')}</div>
    <div style="margin-bottom:8px;color:#666;font-size:0.72rem;">수신 회원을 선택하세요.</div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <label style="display:flex;align-items:center;gap:6px;font-size:0.72rem;color:#333;">
          <input type="checkbox" id="announcement-select-filtered" />
          필터된 회원 전체 선택
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:0.72rem;color:#333;">
          <input type="checkbox" id="announcement-include-trainers" />
          트레이너 포함
        </label>
        <span id="announcement-trainer-count" style="font-size:0.72rem;color:#666;"></span>
        <select id="announcement-center-filter" style="padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:0.72rem;">
          <option value="all">전체 센터</option>
          ${centerValues.map(center => `<option value="${escapeHtml(center)}">${escapeHtml(center)}</option>`).join('')}
        </select>
        <span id="announcement-filter-count" style="font-size:0.72rem;color:#666;"></span>
      </div>
      <button id="announcement-send-confirm" class="header-text-btn" style="background:#1976d2 !important;color:#fff !important;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:0.75rem;">보내기</button>
    </div>
    <div id="announcement-recipients" style="display:flex;flex-direction:column;gap:6px;">
      <div style="text-align:center;padding:12px;color:#888;">대상을 불러오는 중...</div>
    </div>
  `;

  document.body.appendChild(modalBg);
  document.body.appendChild(modal);

  const closeModal = () => {
    modalBg.remove();
    modal.remove();
  };
  modalBg.addEventListener('click', closeModal);
  modal.querySelector('.announcement-send-close').addEventListener('click', closeModal);

  const filterSelect = modal.querySelector('#announcement-center-filter');
  const selectFiltered = modal.querySelector('#announcement-select-filtered');
  const includeTrainersCheckbox = modal.querySelector('#announcement-include-trainers');
  const listContainer = modal.querySelector('#announcement-recipients');
  const countEl = modal.querySelector('#announcement-filter-count');
  const trainerCountEl = modal.querySelector('#announcement-trainer-count');
  const sendBtn = modal.querySelector('#announcement-send-confirm');

  const getMemberCenter = (member) => member.center || '미지정';
  const getTrainerIds = () => new Set((trainersList || []).map(t => t.id).filter(Boolean));

  const renderRecipients = () => {
    const filteredMembers = centerFilter === 'all'
      ? members
      : members.filter(m => getMemberCenter(m) === centerFilter);
    const trainerIds = getTrainerIds();
    if (includeTrainersCheckbox?.checked) {
      trainerIds.forEach(id => selectedIds.add(id));
    } else {
      trainerIds.forEach(id => selectedIds.delete(id));
    }
    if (countEl) {
      countEl.textContent = `필터된 회원 ${filteredMembers.length}명`;
    }
    if (!listContainer) return;
    if (members.length === 0 && trainers.length === 0) {
      listContainer.innerHTML = '<div style="text-align:center;padding:12px;color:#888;">대상이 없습니다.</div>';
      return;
    }
    listContainer.innerHTML = `
      ${members.length > 0 ? `
        <div style="font-weight:600;color:#333;margin:4px 0;">회원</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:4px;">
          ${filteredMembers.map(m => `
            <label style="display:flex;align-items:center;gap:4px;border:1px solid #eee;border-radius:4px;padding:2px 4px;font-size:0.64rem;line-height:1.1;">
              <input type="checkbox" class="announcement-recipient-checkbox" data-id="${m.id}" data-center="${escapeHtml(getMemberCenter(m))}" ${selectedIds.has(m.id) ? 'checked' : ''} />
              <span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${escapeHtml(m.name)} (${escapeHtml(m.username)}) · ${escapeHtml(getMemberCenter(m))}
              </span>
            </label>
          `).join('')}
        </div>
      ` : ''}
      ${(trainersList || []).length > 0 ? `
        <div style="font-weight:600;color:#333;margin:8px 0 4px;">트레이너</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:4px;">
          ${(trainersList || []).map(t => `
            <label style="display:flex;align-items:center;gap:4px;border:1px solid #eee;border-radius:4px;padding:2px 4px;font-size:0.64rem;line-height:1.1;">
              <input type="checkbox" class="announcement-recipient-checkbox" data-id="${t.id}" ${selectedIds.has(t.id) ? 'checked' : ''} />
              <span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${escapeHtml(t.name)} (${escapeHtml(t.username)})
              </span>
            </label>
          `).join('')}
        </div>
      ` : ''}
    `;

    listContainer.querySelectorAll('.announcement-recipient-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = cb.getAttribute('data-id');
        if (!id) return;
        if (cb.checked) {
          selectedIds.add(id);
        } else {
          selectedIds.delete(id);
        }
        updateSelectFilteredState();
        updateSendCount();
      });
    });
  };

  const updateSelectFilteredState = () => {
    if (!selectFiltered) return;
    const filteredIds = (centerFilter === 'all'
      ? members
      : members.filter(m => getMemberCenter(m) === centerFilter)).map(m => m.id);
    if (filteredIds.length === 0) {
      selectFiltered.checked = false;
      return;
    }
    selectFiltered.checked = filteredIds.every(id => selectedIds.has(id));
  };

  const updateSendCount = () => {
    if (!sendBtn) return;
    const trainerIds = getTrainerIds();
    let trainerSelected = 0;
    selectedIds.forEach(id => {
      if (trainerIds.has(id)) trainerSelected += 1;
    });
    const total = selectedIds.size;
    sendBtn.textContent = `보내기 (${total}명)`;
    if (trainerCountEl) {
      trainerCountEl.textContent = `트레이너 선택 ${trainerSelected}명`;
    }
  };

  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      centerFilter = filterSelect.value || 'all';
      renderRecipients();
      updateSelectFilteredState();
    });
  }

  if (selectFiltered) {
    selectFiltered.addEventListener('change', () => {
      const filteredIds = (centerFilter === 'all'
        ? members
        : members.filter(m => getMemberCenter(m) === centerFilter)).map(m => m.id);
      filteredIds.forEach(id => {
        if (selectFiltered.checked) {
          selectedIds.add(id);
        } else {
          selectedIds.delete(id);
        }
      });
      renderRecipients();
      updateSelectFilteredState();
      updateSendCount();
    });
  }

  if (includeTrainersCheckbox) {
    includeTrainersCheckbox.addEventListener('change', () => {
      renderRecipients();
      updateSelectFilteredState();
      updateSendCount();
    });
  }

  renderRecipients();
  updateSendCount();

  (async () => {
    try {
      const res = await fetch('/api/app-users?include_trainers=true&only_trainers=true');
      if (!res.ok) return;
      const trainerAppUsers = await res.json();
      trainersList = Array.isArray(trainerAppUsers) ? trainerAppUsers : [];
      renderRecipients();
      updateSelectFilteredState();
      updateSendCount();
    } catch (error) {
      // noop
    }
  })();

  if (sendBtn) {
    sendBtn.addEventListener('click', async () => {
      const selected = Array.from(selectedIds);
      if (selected.length === 0) {
        alert('보낼 회원을 선택해주세요.');
        return;
      }
      if (!confirm(`선택한 ${selected.length}명에게 공지사항을 보낼까요?`)) {
        return;
      }
      try {
        const res = await fetch(`/api/announcements/${announcement.id}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            app_user_ids: selected,
            send_to_all: false
          })
        });
        if (!res.ok) throw new Error('발송 실패');
        alert('공지사항을 발송했습니다.');
        closeModal();
      } catch (error) {
        alert('공지사항 발송 중 오류가 발생했습니다.');
      }
    });
  }
}

function showAnnouncementImagesModal(announcement) {
  const modalBg = document.createElement('div');
  modalBg.className = 'modal-bg';
  modalBg.style.cssText = 'position:fixed;z-index:1002;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);';

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;z-index:1003;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:12px;border-radius:8px;width:92vw;max-width:640px;max-height:80vh;overflow-y:auto;font-size:0.75rem;box-sizing:border-box;';

  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <h3 style="margin:0;color:#1976d2;font-size:0.9rem;">공지사항 이미지</h3>
      <button class="announcement-images-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:#666;">×</button>
    </div>
    <div style="font-weight:600;margin-bottom:6px;">${escapeHtml(announcement.title || '')}</div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px;flex-wrap:wrap;">
      <input type="file" id="announcement-images-input" accept="image/*" multiple style="font-size:0.72rem;">
      <span id="announcement-images-status" style="font-size:0.7rem;color:#666;"></span>
    </div>
    <div id="announcement-images-list" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(80px, 1fr));gap:8px;"></div>
  `;

  document.body.appendChild(modalBg);
  document.body.appendChild(modal);

  const closeModal = () => {
    modalBg.remove();
    modal.remove();
  };
  modalBg.addEventListener('click', closeModal);
  modal.querySelector('.announcement-images-close').addEventListener('click', closeModal);

  const statusEl = modal.querySelector('#announcement-images-status');
  const listEl = modal.querySelector('#announcement-images-list');

  const renderImages = (images) => {
    if (!listEl) return;
    if (!images || images.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;padding:12px;color:#888;">이미지가 없습니다.</div>';
      return;
    }
    listEl.innerHTML = images.map(img => `
      <div style="border:1px solid #eee;border-radius:6px;padding:6px;display:flex;flex-direction:column;gap:6px;">
        <img src="${escapeHtml(img.url || '')}" alt="공지 이미지" style="width:100%;height:120px;object-fit:contain;border-radius:4px;background:#f5f5f5;">
        <button class="announcement-image-delete-btn" data-id="${img.id}" style="background:#fbe9e7;color:#d32f2f;border:none;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:0.7rem;">삭제</button>
      </div>
    `).join('');

    listEl.querySelectorAll('.announcement-image-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const imageId = btn.getAttribute('data-id');
        if (!imageId) return;
        if (!confirm('이미지를 삭제하시겠습니까?')) return;
        try {
          const res = await fetch(`/api/announcements/${announcement.id}/images/${imageId}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('삭제 실패');
          const data = await res.json();
          updateAnnouncementCacheImages(announcement.id, data.images || []);
          renderImages(data.images || []);
        } catch (error) {
          alert('이미지 삭제 중 오류가 발생했습니다.');
        }
      });
    });
  };

  renderImages(announcement.image_urls || []);

  const input = modal.querySelector('#announcement-images-input');
  if (input) {
    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []);
      if (files.length === 0) return;
      statusEl.textContent = '업로드 중...';
      const currentUser = localStorage.getItem('username') || '';
      for (const file of files) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('currentUser', currentUser);
          const res = await fetch(`/api/announcements/${announcement.id}/images`, {
            method: 'POST',
            body: formData
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || '업로드 실패');
          }
          const data = await res.json();
          updateAnnouncementCacheImages(announcement.id, data.images || []);
          renderImages(data.images || []);
        } catch (error) {
          alert(error.message || '이미지 업로드 중 오류가 발생했습니다.');
          break;
        }
      }
      statusEl.textContent = '';
      input.value = '';
    });
  }
}

function updateAnnouncementCacheImages(id, images) {
  const index = announcementsCached.findIndex(item => item.id === id);
  if (index === -1) return;
  announcementsCached[index] = {
    ...announcementsCached[index],
    image_urls: images
  };
}

function renderTierBadge(label, tier) {
  const styles = {
    bronze: 'background:#fce8d8;color:#8d4f1b;',
    silver: 'background:#eef1f6;color:#546e7a;',
    gold: 'background:#fff3cd;color:#b7791f;',
    diamond: 'background:#e8f5ff;color:#1e88e5;',
    none: 'background:#f5f5f5;color:#666;'
  };
  const style = styles[tier] || styles.none;
  return `<span style="padding:2px 6px;border-radius:10px;font-size:0.7rem;font-weight:600;${style}">${label}</span>`;
}

async function fetchAchievementSummaries(appUserIds, startDate, endDate) {
  if (!appUserIds || appUserIds.length === 0) {
    return {};
  }
  const response = await fetch(`/api/app-users/achievement-summaries?app_user_ids=${encodeURIComponent(appUserIds.join(','))}&start_date=${startDate}&end_date=${endDate}`);
  if (!response.ok) {
    throw new Error('업적 요약 조회 실패');
  }
  const result = await response.json();
  const map = {};
  (result.results || []).forEach(item => {
    map[item.app_user_id] = item;
  });
  return map;
}

async function renderMemberActivityList(members) {
  const listContainer = document.getElementById('user-app-activity-list');
  if (!listContainer) return;
  
  if (!members || members.length === 0) {
    listContainer.innerHTML = '<div style="text-align:center;padding:12px;color:#888;font-size:0.75rem;">등록된 회원이 없습니다.</div>';
    return;
  }
  
  const titleElement = document.getElementById('user-app-members-title');
  if (titleElement) {
    titleElement.textContent = `회원 관리 (${members.length}명)`;
  }
  
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const startDate = getDateString(monthStart);
  const endDate = getDateString(monthEnd);
  
  let summaries = {};
  try {
    summaries = await fetchAchievementSummaries(members.map(m => m.id), startDate, endDate);
  } catch (error) {
    console.error('업적 요약 조회 오류:', error);
  }
  
  const getSummary = (memberId) => summaries[memberId] || {
    workoutDays: 0,
    dietDays: 0,
    workoutMemberCommentCount: 0,
    workoutTrainerCommentCount: 0,
    dietMemberCommentCount: 0,
    dietTrainerCommentCount: 0
  };
  
  const sortedMembers = [...members].sort((a, b) => {
    if (activitySortColumn === 'name') {
      const aValue = (a.name || '').trim();
      const bValue = (b.name || '').trim();
      const comparison = aValue.localeCompare(bValue, 'ko', { numeric: true });
      return activitySortDirection === 'asc' ? comparison : -comparison;
    }
    const aSummary = getSummary(a.id);
    const bSummary = getSummary(b.id);
    const getCommentTotal = (summary, type) => {
      if (type === 'member') {
        return (summary.workoutMemberCommentCount || 0) + (summary.dietMemberCommentCount || 0);
      }
      return (summary.workoutTrainerCommentCount || 0) + (summary.dietTrainerCommentCount || 0);
    };
    let aValue = 0;
    let bValue = 0;
    if (activitySortColumn === 'workout') {
      aValue = aSummary.workoutDays || 0;
      bValue = bSummary.workoutDays || 0;
    } else if (activitySortColumn === 'diet') {
      aValue = aSummary.dietDays || 0;
      bValue = bSummary.dietDays || 0;
    } else if (activitySortColumn === 'member_comments') {
      aValue = getCommentTotal(aSummary, 'member');
      bValue = getCommentTotal(bSummary, 'member');
    } else if (activitySortColumn === 'trainer_comments') {
      aValue = getCommentTotal(aSummary, 'trainer');
      bValue = getCommentTotal(bSummary, 'trainer');
    }
    if (aValue === bValue) {
      const aName = (a.name || '').trim();
      const bName = (b.name || '').trim();
      return aName.localeCompare(bName, 'ko', { numeric: true });
    }
    return activitySortDirection === 'asc' ? aValue - bValue : bValue - aValue;
  });
  
  const totalPages = Math.max(1, Math.ceil(sortedMembers.length / membersPageSize));
  if (activityCurrentPage > totalPages) {
    activityCurrentPage = totalPages;
  }
  const startIndex = (activityCurrentPage - 1) * membersPageSize;
  const pagedMembers = sortedMembers.slice(startIndex, startIndex + membersPageSize);
  
  const getSortIcon = (column) => {
    if (activitySortColumn !== column) {
      return '<span style="color:#999;font-size:0.7rem;margin-left:4px;">↕</span>';
    }
    return activitySortDirection === 'asc'
      ? '<span style="color:#1976d2;font-size:0.7rem;margin-left:4px;">↑</span>'
      : '<span style="color:#1976d2;font-size:0.7rem;margin-left:4px;">↓</span>';
  };
  
  let html = `
    <table style="width:100%;border-collapse:collapse;font-size:0.75rem;">
      <thead>
        <tr style="background:#f5f5f5;border-bottom:1px solid #ddd;">
          <th class="activity-sort-header" data-column="name" style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;cursor:pointer;user-select:none;">이름${getSortIcon('name')}</th>
          <th style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">회원명</th>
          <th class="activity-sort-header" data-column="workout" style="padding:4px 6px;text-align:center;font-weight:600;color:#333;font-size:0.75rem;cursor:pointer;user-select:none;">오운완${getSortIcon('workout')}</th>
          <th class="activity-sort-header" data-column="diet" style="padding:4px 6px;text-align:center;font-weight:600;color:#333;font-size:0.75rem;cursor:pointer;user-select:none;">식단${getSortIcon('diet')}</th>
          <th class="activity-sort-header" data-column="member_comments" style="padding:4px 6px;text-align:center;font-weight:600;color:#333;font-size:0.75rem;cursor:pointer;user-select:none;">회원 코멘트${getSortIcon('member_comments')}</th>
          <th class="activity-sort-header" data-column="trainer_comments" style="padding:4px 6px;text-align:center;font-weight:600;color:#333;font-size:0.75rem;cursor:pointer;user-select:none;">트레이너 코멘트${getSortIcon('trainer_comments')}</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  pagedMembers.forEach(member => {
    const summary = getSummary(member.id);
    const workoutTier = getWorkoutTierFromDays(summary.workoutDays || 0);
    const dietTier = getDietTierFromDays(summary.dietDays || 0);
    const memberCommentTotal = (summary.workoutMemberCommentCount || 0) + (summary.dietMemberCommentCount || 0);
    const trainerCommentTotal = (summary.workoutTrainerCommentCount || 0) + (summary.dietTrainerCommentCount || 0);
    const memberCommentTier = getCommentTierFromCount(memberCommentTotal);
    const trainerCommentTier = getCommentTierFromCount(trainerCommentTotal);
    
    html += `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:4px 6px;">${escapeHtml(member.name)}</td>
        <td style="padding:4px 6px;color:#666;">${member.member_name ? escapeHtml(member.member_name) : '-'}</td>
        <td style="padding:4px 6px;text-align:center;">${renderTierBadge(`오운완 ${summary.workoutDays || 0}일`, workoutTier)}</td>
        <td style="padding:4px 6px;text-align:center;">${renderTierBadge(`식단 ${summary.dietDays || 0}일`, dietTier)}</td>
        <td style="padding:4px 6px;text-align:center;">${renderTierBadge(`${memberCommentTotal}회`, memberCommentTier)}</td>
        <td style="padding:4px 6px;text-align:center;">${renderTierBadge(`${trainerCommentTotal}회`, trainerCommentTier)}</td>
      </tr>
    `;
  });
  
  html += `
      </tbody>
    </table>
    <div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 0;">
      <button data-page="prev" style="background:#fff;border:1px solid #ddd;color:#333;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:0.7rem;" ${activityCurrentPage === 1 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>이전</button>
      <span style="font-size:0.75rem;color:#666;">${activityCurrentPage} / ${totalPages}</span>
      <button data-page="next" style="background:#fff;border:1px solid #ddd;color:#333;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:0.7rem;" ${activityCurrentPage === totalPages ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>다음</button>
    </div>
  `;
  
  listContainer.innerHTML = html;
  
  listContainer.querySelectorAll('.activity-sort-header').forEach(th => {
    th.addEventListener('click', () => {
      const column = th.getAttribute('data-column');
      if (activitySortColumn === column) {
        activitySortDirection = activitySortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        activitySortColumn = column;
        activitySortDirection = 'asc';
      }
      activityCurrentPage = 1;
      renderMemberActivityList(members);
    });
  });
  
  listContainer.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dir = btn.getAttribute('data-page');
      if (dir === 'prev' && activityCurrentPage > 1) {
        activityCurrentPage -= 1;
        renderMemberActivityList(members);
      }
      if (dir === 'next') {
        const lastPage = Math.max(1, Math.ceil(sortedMembers.length / membersPageSize));
        if (activityCurrentPage < lastPage) {
          activityCurrentPage += 1;
          renderMemberActivityList(members);
        }
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
    workoutTypesLoaded = true;
    updateWorkoutGuideUI();
  } catch (error) {
    console.error('운동종류 조회 오류:', error);
    const listContainer = document.getElementById('user-app-workout-types-list');
    if (listContainer) {
      listContainer.innerHTML = '<div style="text-align:center;padding:12px;color:#d32f2f;font-size:0.75rem;">운동종류를 불러오는 중 오류가 발생했습니다.</div>';
    }
  }
}

async function loadWorkoutGuideSettings() {
  try {
    const response = await fetch('/api/app-settings/workout-guide');
    if (!response.ok) throw new Error('운동 가이드 설정 조회 실패');
    const data = await response.json();
    workoutGuideSettings.items = Array.isArray(data.items) ? data.items : [];
    workoutGuideLoaded = true;
    updateWorkoutGuideUI();
  } catch (error) {
    console.error('운동 가이드 설정 조회 오류:', error);
    workoutGuideLoaded = true;
    updateWorkoutGuideUI();
  }
}

function updateWorkoutGuideUI() {
  if (!workoutGuideLoaded || !workoutTypesLoaded) return;
  renderWorkoutGuideSelector(window.allWorkoutTypes || []);
}

function renderWorkoutGuideSelector(workoutTypes) {
  const availableList = document.getElementById('user-app-guide-available-list');
  const selectedList = document.getElementById('user-app-guide-selected-list');
  if (!availableList || !selectedList) return;

  const typesById = new Map(workoutTypes.map(type => [type.id, type]));
  const selectedIds = Array.isArray(workoutGuideSettings.items) ? workoutGuideSettings.items : [];
  const filteredSelectedIds = selectedIds.filter(id => typesById.has(id));
  if (filteredSelectedIds.length !== selectedIds.length) {
    workoutGuideSettings.items = filteredSelectedIds;
  }
  const selectedSet = new Set(workoutGuideSettings.items);

  const buildMeta = (type) => {
    const categories = [
      type.category_1_name,
      type.category_2_name,
      type.category_3_name,
      type.category_4_name
    ].filter(Boolean).join(' / ');
    const parts = [];
    if (categories) parts.push(categories);
    if (type.type) parts.push(type.type);
    return parts.join(' · ');
  };

  const availableItems = workoutTypes.filter(type => !selectedSet.has(type.id)).filter(type => {
    if (!workoutGuideSearchTerm) return true;
    return (type.name || '').toLowerCase().includes(workoutGuideSearchTerm);
  });
  const selectedItems = workoutGuideSettings.items.map(id => typesById.get(id)).filter(Boolean);

  availableList.innerHTML = availableItems.length === 0
    ? '<div style="text-align:center;padding:12px;color:#888;font-size:0.75rem;">표시할 운동이 없습니다.</div>'
    : availableItems.map(type => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px;border-bottom:1px solid #eee;gap:8px;">
        <div style="min-width:0;">
          <div style="font-size:0.78rem;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(type.name)}</div>
          <div style="font-size:0.7rem;color:#999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(buildMeta(type))}</div>
        </div>
        <button class="guide-add-btn" data-id="${type.id}" style="background:#e3f2fd;color:#1976d2;border:none;padding:2px 6px;border-radius:2px;cursor:pointer;font-size:0.7rem;white-space:nowrap;">
          추가
        </button>
      </div>
    `).join('');

  selectedList.innerHTML = selectedItems.length === 0
    ? '<div style="text-align:center;padding:12px;color:#888;font-size:0.75rem;">선택된 운동이 없습니다.</div>'
    : selectedItems.map((type, index) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px;border-bottom:1px solid #eee;gap:8px;">
        <div style="min-width:0;display:flex;align-items:center;gap:6px;">
          <span style="font-size:0.7rem;color:#999;">${index + 1}</span>
          <div style="min-width:0;">
            <div style="font-size:0.78rem;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(type.name)}</div>
            <div style="font-size:0.7rem;color:#999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(buildMeta(type))}</div>
          </div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;">
          <button class="guide-edit-btn" data-id="${type.id}" title="편집" aria-label="편집" style="background:#e3f2fd;color:#1976d2;border:none;padding:1px 6px;border-radius:2px;cursor:pointer;font-size:0.8rem;line-height:1;box-shadow:none;margin-top:0;">✎</button>
          <button class="guide-move-up-btn" data-index="${index}" title="위로" aria-label="위로" style="background:#fff;border:1px solid #ddd;color:#333;padding:1px 6px;border-radius:2px;cursor:pointer;font-size:0.8rem;line-height:1;box-shadow:none;margin-top:0;">▲</button>
          <button class="guide-move-down-btn" data-index="${index}" title="아래로" aria-label="아래로" style="background:#fff;border:1px solid #ddd;color:#333;padding:1px 6px;border-radius:2px;cursor:pointer;font-size:0.8rem;line-height:1;box-shadow:none;margin-top:0;">▼</button>
          <button class="guide-remove-btn" data-index="${index}" title="삭제" aria-label="삭제" style="background:#fbe9e7;color:#d32f2f;border:none;padding:1px 6px;border-radius:2px;cursor:pointer;font-size:0.8rem;line-height:1;box-shadow:none;margin-top:0;">✕</button>
        </div>
      </div>
    `).join('');

  availableList.querySelectorAll('.guide-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (!id || selectedSet.has(id)) return;
      workoutGuideSettings.items = [...workoutGuideSettings.items, id];
      updateWorkoutGuideUI();
    });
  });

  selectedList.querySelectorAll('.guide-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.getAttribute('data-index'), 10);
      if (Number.isNaN(index)) return;
      workoutGuideSettings.items = workoutGuideSettings.items.filter((_, i) => i !== index);
      updateWorkoutGuideUI();
    });
  });

  selectedList.querySelectorAll('.guide-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const workoutType = workoutTypes.find(type => type.id === id);
      if (workoutType) {
        showWorkoutGuideEditModal(workoutType);
      }
    });
  });

  selectedList.querySelectorAll('.guide-move-up-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.getAttribute('data-index'), 10);
      if (Number.isNaN(index) || index === 0) return;
      const items = [...workoutGuideSettings.items];
      [items[index - 1], items[index]] = [items[index], items[index - 1]];
      workoutGuideSettings.items = items;
      updateWorkoutGuideUI();
    });
  });

  selectedList.querySelectorAll('.guide-move-down-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.getAttribute('data-index'), 10);
      if (Number.isNaN(index) || index >= workoutGuideSettings.items.length - 1) return;
      const items = [...workoutGuideSettings.items];
      [items[index + 1], items[index]] = [items[index], items[index + 1]];
      workoutGuideSettings.items = items;
      updateWorkoutGuideUI();
    });
  });
}

async function saveWorkoutGuideSettings() {
  const saveBtn = document.getElementById('user-app-guide-save-btn');
  const originalText = saveBtn ? saveBtn.textContent : '';
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중...';
  }
  try {
    const response = await fetch('/api/app-settings/workout-guide', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: workoutGuideSettings.items })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '저장 실패');
    }
    alert('운동 가이드 목록이 저장되었습니다.');
  } catch (error) {
    alert(error.message || '저장 중 오류가 발생했습니다.');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = originalText || '저장';
    }
  }
}

async function showWorkoutGuideEditModal(workoutType) {
  const modalBg = document.createElement('div');
  modalBg.className = 'modal-bg';
  modalBg.style.cssText = 'position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);';

  const modal = document.createElement('div');
  const isMobile = window.innerWidth < 600;
  const minWidthStyle = isMobile ? 'min-width:300px;' : 'min-width:420px;';
  modal.style.cssText = `position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:16px;border-radius:8px;${minWidthStyle}max-width:92vw;max-height:90vh;overflow-y:auto;font-size:0.85rem;box-sizing:border-box;`;

  modal.innerHTML = `
    <h3 style="margin:0 0 12px 0;color:#1976d2;font-size:1rem;">운동 가이드 편집</h3>
    <div style="font-size:0.85rem;color:#666;margin-bottom:12px;">${escapeHtml(workoutType.name)}</div>
    <div style="margin-bottom:10px;">
      <label style="display:block;margin-bottom:6px;font-weight:600;color:#333;">설명</label>
      <textarea id="guide-desc-input" rows="4" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:0.85rem;box-sizing:border-box;resize:vertical;"></textarea>
    </div>
    <div style="margin-bottom:10px;">
      <label style="display:block;margin-bottom:6px;font-weight:600;color:#333;">외부 링크</label>
      <input type="text" id="guide-external-link-input" placeholder="https://..." style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:0.85rem;box-sizing:border-box;">
    </div>
    <div style="margin-bottom:12px;">
      <label style="display:block;margin-bottom:6px;font-weight:600;color:#333;">영상</label>
      <div id="guide-video-preview" style="margin-bottom:6px;color:#888;font-size:0.8rem;">불러오는 중...</div>
      <input type="file" id="guide-video-file" accept="video/*" style="font-size:0.8rem;">
    </div>
    <div id="guide-edit-result" style="min-height:18px;color:#d32f2f;margin-bottom:10px;font-size:0.8rem;"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
      <button type="button" id="guide-video-delete-btn" style="background:#fbe9e7;color:#d32f2f;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:0.8rem;">영상 삭제</button>
      <button type="button" id="guide-video-upload-btn" style="background:#e3f2fd;color:#1976d2;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:0.8rem;">영상 업로드</button>
      <button type="button" id="guide-text-save-btn" style="background:#1976d2;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.8rem;">텍스트 저장</button>
      <button type="button" id="guide-edit-close-btn" style="background:#eee;color:#1976d2;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.8rem;">닫기</button>
    </div>
  `;

  document.body.appendChild(modalBg);
  document.body.appendChild(modal);

  const closeModal = () => {
    document.body.removeChild(modalBg);
    document.body.removeChild(modal);
  };
  modalBg.addEventListener('click', closeModal);
  modal.querySelector('#guide-edit-close-btn').addEventListener('click', closeModal);

  const descInput = modal.querySelector('#guide-desc-input');
  const externalLinkInput = modal.querySelector('#guide-external-link-input');
  const preview = modal.querySelector('#guide-video-preview');
  const resultDiv = modal.querySelector('#guide-edit-result');
  const videoDeleteBtn = modal.querySelector('#guide-video-delete-btn');

  const setResult = (msg, isError = true) => {
    resultDiv.style.color = isError ? '#d32f2f' : '#2e7d32';
    resultDiv.textContent = msg || '';
  };

  let guideData = null;
  try {
    const res = await fetch(`/api/workout-guides/${encodeURIComponent(workoutType.id)}`);
    const data = await res.json();
    guideData = data.guide || {};
  } catch (error) {
    guideData = {};
  }

  descInput.value = guideData.description || '';
  externalLinkInput.value = guideData.external_link || '';

  const renderVideoPreview = () => {
    if (guideData.video_url) {
      preview.innerHTML = `
        <video controls style="width:100%;max-height:220px;border-radius:6px;" src="${guideData.video_url}"></video>
        <div style="margin-top:4px;font-size:0.75rem;color:#666;">${escapeHtml(guideData.video_filename || '')}</div>
      `;
      videoDeleteBtn.style.display = 'inline-block';
    } else {
      preview.textContent = '등록된 영상이 없습니다.';
      videoDeleteBtn.style.display = 'none';
    }
  };
  renderVideoPreview();

  modal.querySelector('#guide-text-save-btn').addEventListener('click', async () => {
    setResult('저장 중...', false);
    try {
      const res = await fetch(`/api/workout-guides/${encodeURIComponent(workoutType.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: descInput.value.trim() || null,
          external_link: externalLinkInput.value.trim() || null
        })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || '저장 실패');
      }
      const data = await res.json();
      guideData = data.guide || guideData;
      setResult('저장 완료', false);
      updateWorkoutGuideUI();
    } catch (error) {
      setResult(error.message || '저장 중 오류가 발생했습니다.');
    }
  });

  modal.querySelector('#guide-video-upload-btn').addEventListener('click', async () => {
    const fileInput = modal.querySelector('#guide-video-file');
    const file = fileInput.files[0];
    if (!file) {
      setResult('업로드할 동영상을 선택해주세요.');
      return;
    }
    setResult('업로드 중...', false);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const currentUser = localStorage.getItem('username');
      if (currentUser) {
        formData.append('currentUser', currentUser);
      }
      const res = await fetch(`/api/workout-guides/${encodeURIComponent(workoutType.id)}/video`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || '업로드 실패');
      }
      const fresh = await fetch(`/api/workout-guides/${encodeURIComponent(workoutType.id)}`);
      const freshData = await fresh.json();
      guideData = freshData.guide || guideData;
      renderVideoPreview();
      setResult('업로드 완료', false);
      updateWorkoutGuideUI();
    } catch (error) {
      setResult(error.message || '업로드 중 오류가 발생했습니다.');
    }
  });

  videoDeleteBtn.addEventListener('click', async () => {
    if (!confirm('영상을 삭제하시겠습니까?')) return;
    setResult('삭제 중...', false);
    try {
      const res = await fetch(`/api/workout-guides/${encodeURIComponent(workoutType.id)}/video`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || '삭제 실패');
      }
      guideData.video_url = null;
      guideData.video_filename = null;
      renderVideoPreview();
      setResult('삭제 완료', false);
      updateWorkoutGuideUI();
    } catch (error) {
      setResult(error.message || '삭제 중 오류가 발생했습니다.');
    }
  });
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
        matchResult.innerHTML = `
          <span style="color:#4caf50;">✓ 연결됨: ${escapeHtml(exactMatch.name)}</span>
          <button type="button" class="member-select-alt-btn" style="margin-left:8px;background:#e3f2fd;color:#1976d2;border:none;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:0.7rem;">다른 회원 선택</button>
        `;
      } else {
        matchResult.innerHTML = `
          <span style="color:#1976d2;">✓ 동일 이름 자동 연결됨: ${escapeHtml(exactMatch.name)}</span>
          <button type="button" class="member-select-alt-btn" style="margin-left:8px;background:#e3f2fd;color:#1976d2;border:none;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:0.7rem;">다른 회원 선택</button>
        `;
        await linkMemberToAppUser(appUser.id, exactMatch.name, modal);
      }
      const altBtn = matchResult.querySelector('.member-select-alt-btn');
      if (altBtn) {
        altBtn.addEventListener('click', () => {
          showMemberSelectModal(members, appUser, modal);
        });
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
      // 동일 이름이면 자동 연결 후 선택 모달도 열 수 있게 함
      await linkMemberToAppUser(appUser.id, exactMatch.name, modal);
    }
    // 언제든 회원 목록에서 재선택 가능
    showMemberSelectModal(members, appUser, modal);
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
