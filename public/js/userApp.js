// 유저앱 관리 모듈 (운동종류 관리 등)

export const userApp = {
  render
};

function render(container) {
  if (!container) return;
  
  container.innerHTML = `
    <div style="padding:12px;">
      <h3 style="margin-top:0;margin-bottom:12px;color:#1976d2;font-size:1rem;">📱 유저앱 관리</h3>
      
      <!-- 회원 관리 섹션 -->
      <div style="background:#f5f5f5;padding:12px;border-radius:8px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <h4 style="margin:0;color:#333;font-size:0.9rem;">회원 관리</h4>
          <button id="user-app-member-add-btn" style="background:#1976d2;color:#fff;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:0.75rem;">
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
          <button id="user-app-workout-type-add-btn" style="background:#1976d2;color:#fff;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:0.75rem;">
            운동종류 추가
          </button>
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
              <button class="user-app-category-add-btn" data-category="1" style="background:#4caf50;color:#fff;border:none;padding:2px 6px;border-radius:2px;cursor:pointer;font-size:0.7rem;">
                추가
              </button>
            </div>
            <div class="user-app-category-list" data-category="1"></div>
          </div>
          <div id="user-app-category-2-section" style="background:#fff;padding:8px;border-radius:4px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <h5 style="margin:0;color:#666;font-size:0.8rem;">분류 2</h5>
              <button class="user-app-category-add-btn" data-category="2" style="background:#4caf50;color:#fff;border:none;padding:2px 6px;border-radius:2px;cursor:pointer;font-size:0.7rem;">
                추가
              </button>
            </div>
            <div class="user-app-category-list" data-category="2"></div>
          </div>
          <div id="user-app-category-3-section" style="background:#fff;padding:8px;border-radius:4px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <h5 style="margin:0;color:#666;font-size:0.8rem;">분류 3</h5>
              <button class="user-app-category-add-btn" data-category="3" style="background:#4caf50;color:#fff;border:none;padding:2px 6px;border-radius:2px;cursor:pointer;font-size:0.7rem;">
                추가
              </button>
            </div>
            <div class="user-app-category-list" data-category="3"></div>
          </div>
          <div id="user-app-category-4-section" style="background:#fff;padding:8px;border-radius:4px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <h5 style="margin:0;color:#666;font-size:0.8rem;">분류 4</h5>
              <button class="user-app-category-add-btn" data-category="4" style="background:#4caf50;color:#fff;border:none;padding:2px 6px;border-radius:2px;cursor:pointer;font-size:0.7rem;">
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
}

async function loadData() {
  await Promise.all([
    loadMembers(),
    loadWorkoutTypes(),
    loadCategories(1),
    loadCategories(2),
    loadCategories(3),
    loadCategories(4)
  ]);
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

function renderMembersList(members) {
  const listContainer = document.getElementById('user-app-members-list');
  if (!listContainer) return;
  
  if (members.length === 0) {
    listContainer.innerHTML = '<div style="text-align:center;padding:12px;color:#888;font-size:0.75rem;">등록된 회원이 없습니다.</div>';
    return;
  }
  
  let html = `
    <table style="width:100%;border-collapse:collapse;font-size:0.75rem;">
      <thead>
        <tr style="background:#f5f5f5;border-bottom:1px solid #ddd;">
          <th style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">아이디</th>
          <th style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">이름</th>
          <th style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">전화번호</th>
          <th style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">회원명</th>
          <th style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">트레이너</th>
          <th style="padding:4px 6px;text-align:center;font-weight:600;color:#333;font-size:0.75rem;">상태</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  members.forEach(member => {
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
  
  // 테이블 행 클릭 이벤트 (수정 모달 열기)
  listContainer.querySelectorAll('tbody tr').forEach((row, index) => {
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => {
      const member = members[index];
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
    renderWorkoutTypesList(workoutTypes);
  } catch (error) {
    console.error('운동종류 조회 오류:', error);
    const listContainer = document.getElementById('user-app-workout-types-list');
    if (listContainer) {
      listContainer.innerHTML = '<div style="text-align:center;padding:12px;color:#d32f2f;font-size:0.75rem;">운동종류를 불러오는 중 오류가 발생했습니다.</div>';
    }
  }
}

function renderWorkoutTypesList(workoutTypes) {
  const listContainer = document.getElementById('user-app-workout-types-list');
  if (!listContainer) return;
  
  if (workoutTypes.length === 0) {
    listContainer.innerHTML = '<div style="text-align:center;padding:12px;color:#888;font-size:0.75rem;">등록된 운동종류가 없습니다.</div>';
    return;
  }
  
  let html = `
    <table style="width:100%;border-collapse:collapse;font-size:0.75rem;">
      <thead>
        <tr style="background:#f5f5f5;border-bottom:1px solid #ddd;">
          <th style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">운동 이름</th>
          <th style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">타입</th>
          <th style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">분류 1</th>
          <th style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">분류 2</th>
          <th style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">분류 3</th>
          <th style="padding:4px 6px;text-align:left;font-weight:600;color:#333;font-size:0.75rem;">분류 4</th>
          <th style="padding:4px 6px;text-align:center;font-weight:600;color:#333;font-size:0.75rem;">작업</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  workoutTypes.forEach(type => {
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
  
  // 수정/삭제 버튼 이벤트
  listContainer.querySelectorAll('.user-app-workout-type-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const workoutType = workoutTypes.find(t => t.id === id);
      if (workoutType) {
        showWorkoutTypeEditModal(workoutType);
      }
    });
  });
  
  listContainer.querySelectorAll('.user-app-workout-type-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
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
          ${member ? `<button type="button" class="member-search-btn" style="background:#4caf50;color:#fff;border:none;padding:4px 8px;border-radius:3px;cursor:pointer;font-size:0.75rem;">검색/연결</button>` : ''}
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
              <button class="member-link-btn" data-member-name="${escapeHtml(m.name)}" style="background:#1976d2;color:#fff;border:none;padding:4px 8px;border-radius:3px;cursor:pointer;font-size:0.75rem;">연결</button>
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
  modal.style.cssText = 'position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:8px;min-width:500px;max-width:90vw;max-height:90vh;overflow-y:auto;';
  
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
  modal.style.cssText = 'position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:8px;min-width:400px;max-width:90vw;';
  
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
