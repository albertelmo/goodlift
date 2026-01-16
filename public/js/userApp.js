// 유저앱 관리 모듈 (운동종류 관리 등)

export const userApp = {
  render
};

function render(container) {
  if (!container) return;
  
  container.innerHTML = `
    <div style="padding:20px;">
      <h3 style="margin-top:0;margin-bottom:20px;color:#1976d2;font-size:1.2rem;">📱 유저앱 관리</h3>
      
      <!-- 운동종류 관리 섹션 -->
      <div style="background:#f5f5f5;padding:20px;border-radius:8px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h4 style="margin:0;color:#333;font-size:1.1rem;">운동종류 관리</h4>
          <button id="user-app-workout-type-add-btn" style="background:#1976d2;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:0.9rem;">
            운동종류 추가
          </button>
        </div>
        <div id="user-app-workout-types-list" style="background:#fff;border-radius:4px;padding:16px;">
          <div style="text-align:center;padding:40px;color:#888;">불러오는 중...</div>
        </div>
      </div>
      
      <!-- 분류 관리 섹션 -->
      <div style="background:#f5f5f5;padding:20px;border-radius:8px;margin-bottom:20px;">
        <h4 style="margin:0 0 16px 0;color:#333;font-size:1.1rem;">분류 관리</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(250px, 1fr));gap:16px;">
          <div id="user-app-category-1-section" style="background:#fff;padding:16px;border-radius:4px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <h5 style="margin:0;color:#666;font-size:0.95rem;">분류 1</h5>
              <button class="user-app-category-add-btn" data-category="1" style="background:#4caf50;color:#fff;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;">
                추가
              </button>
            </div>
            <div class="user-app-category-list" data-category="1"></div>
          </div>
          <div id="user-app-category-2-section" style="background:#fff;padding:16px;border-radius:4px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <h5 style="margin:0;color:#666;font-size:0.95rem;">분류 2</h5>
              <button class="user-app-category-add-btn" data-category="2" style="background:#4caf50;color:#fff;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;">
                추가
              </button>
            </div>
            <div class="user-app-category-list" data-category="2"></div>
          </div>
          <div id="user-app-category-3-section" style="background:#fff;padding:16px;border-radius:4px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <h5 style="margin:0;color:#666;font-size:0.95rem;">분류 3</h5>
              <button class="user-app-category-add-btn" data-category="3" style="background:#4caf50;color:#fff;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;">
                추가
              </button>
            </div>
            <div class="user-app-category-list" data-category="3"></div>
          </div>
          <div id="user-app-category-4-section" style="background:#fff;padding:16px;border-radius:4px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <h5 style="margin:0;color:#666;font-size:0.95rem;">분류 4</h5>
              <button class="user-app-category-add-btn" data-category="4" style="background:#4caf50;color:#fff;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;">
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
    loadWorkoutTypes(),
    loadCategories(1),
    loadCategories(2),
    loadCategories(3),
    loadCategories(4)
  ]);
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
      listContainer.innerHTML = '<div style="text-align:center;padding:40px;color:#d32f2f;">운동종류를 불러오는 중 오류가 발생했습니다.</div>';
    }
  }
}

function renderWorkoutTypesList(workoutTypes) {
  const listContainer = document.getElementById('user-app-workout-types-list');
  if (!listContainer) return;
  
  if (workoutTypes.length === 0) {
    listContainer.innerHTML = '<div style="text-align:center;padding:40px;color:#888;">등록된 운동종류가 없습니다.</div>';
    return;
  }
  
  let html = `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f5f5f5;border-bottom:2px solid #ddd;">
          <th style="padding:12px;text-align:left;font-weight:600;color:#333;">운동 이름</th>
          <th style="padding:12px;text-align:left;font-weight:600;color:#333;">타입</th>
          <th style="padding:12px;text-align:left;font-weight:600;color:#333;">분류 1</th>
          <th style="padding:12px;text-align:left;font-weight:600;color:#333;">분류 2</th>
          <th style="padding:12px;text-align:left;font-weight:600;color:#333;">분류 3</th>
          <th style="padding:12px;text-align:left;font-weight:600;color:#333;">분류 4</th>
          <th style="padding:12px;text-align:center;font-weight:600;color:#333;">작업</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  workoutTypes.forEach(type => {
    html += `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:12px;">${escapeHtml(type.name)}</td>
        <td style="padding:12px;color:#666;">${escapeHtml(type.type || '세트')}</td>
        <td style="padding:12px;color:#666;">${type.category_1_name || '-'}</td>
        <td style="padding:12px;color:#666;">${type.category_2_name || '-'}</td>
        <td style="padding:12px;color:#666;">${type.category_3_name || '-'}</td>
        <td style="padding:12px;color:#666;">${type.category_4_name || '-'}</td>
        <td style="padding:12px;text-align:center;">
          <button class="user-app-workout-type-edit-btn" data-id="${type.id}" style="background:#1976d2;color:#fff;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;margin-right:4px;">
            수정
          </button>
          <button class="user-app-workout-type-delete-btn" data-id="${type.id}" style="background:#d32f2f;color:#fff;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;">
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
    listContainer.innerHTML = '<div style="text-align:center;padding:20px;color:#888;font-size:0.85rem;">등록된 분류가 없습니다.</div>';
    return;
  }
  
  let html = '<ul style="list-style:none;padding:0;margin:0;">';
  categories.forEach(category => {
    html += `
      <li style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid #eee;">
        <span style="font-size:0.9rem;">${escapeHtml(category.name)}</span>
        <div>
          <button class="user-app-category-edit-btn" data-category="${categoryNumber}" data-id="${category.id}" style="background:#1976d2;color:#fff;border:none;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:0.75rem;margin-right:4px;">
            수정
          </button>
          <button class="user-app-category-delete-btn" data-category="${categoryNumber}" data-id="${category.id}" style="background:#d32f2f;color:#fff;border:none;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:0.75rem;">
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
