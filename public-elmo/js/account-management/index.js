// Elmo 계정관리 화면

let currentUser = null;
let currentSessionId = null;
let currentUserId = null;

/**
 * 계정관리 화면 초기화
 */
export async function init(userData) {
    currentUser = userData;
    
    // localStorage에서 세션 정보 가져오기
    const elmoSession = localStorage.getItem('elmo_session');
    if (elmoSession) {
        currentSessionId = elmoSession;
    }
    if (userData.id) {
        currentUserId = userData.id;
    }
    
    await render();
}

/**
 * 계정관리 화면 렌더링
 */
async function render() {
    const container = document.getElementById('elmo-content');
    if (!container) {
        return;
    }
    
    // SU 권한 확인
    if (currentUser.role !== 'su') {
        container.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:400px;padding:40px;text-align:center;">
                <div style="font-size:48px;margin-bottom:16px;">🔒</div>
                <h2 style="font-size:24px;font-weight:600;color:var(--elmo-text);margin:0 0 8px 0;">권한이 없습니다</h2>
                <p style="font-size:16px;color:var(--elmo-text-muted);margin:0;">SU 권한이 필요합니다.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="elmo-account-management-screen">
            <div class="elmo-account-management-header">
                <h2>계정관리</h2>
            </div>
            <div id="elmo-account-list-wrapper" class="elmo-account-list-wrapper">
                <div class="elmo-loading">로딩 중...</div>
            </div>
        </div>
    `;
    
    await loadAccountList();
    setupEventListeners();
}

/**
 * 계정 목록 로드
 */
async function loadAccountList() {
    const listWrapper = document.getElementById('elmo-account-list-wrapper');
    if (!listWrapper) return;
    
    try {
        const response = await fetch('/api/elmo/users', {
            headers: {
                'X-Elmo-Session': currentSessionId,
                'X-Elmo-User-Id': currentUserId
            }
        });
        
        if (response.ok) {
            const users = await response.json();
            renderAccountList(users);
        } else {
            const error = await response.json();
            listWrapper.innerHTML = `<div class="elmo-error">${error.message || '계정 목록을 불러오는 중 오류가 발생했습니다.'}</div>`;
        }
    } catch (error) {
        console.error('계정 목록 로드 오류:', error);
        listWrapper.innerHTML = '<div class="elmo-error">계정 목록을 불러오는 중 오류가 발생했습니다.</div>';
    }
}

/**
 * 계정 목록 렌더링
 */
function renderAccountList(users) {
    const listWrapper = document.getElementById('elmo-account-list-wrapper');
    if (!listWrapper) return;
    
    if (users.length === 0) {
        listWrapper.innerHTML = '<div class="elmo-empty">등록된 계정이 없습니다.</div>';
        return;
    }
    
    let html = '<div class="elmo-account-list">';
    
    users.forEach(user => {
        const roleLabels = {
            'su': '슈퍼 관리자',
            'admin': '관리자',
            'user': '일반 유저'
        };
        const roleColors = {
            'su': '#d32f2f',
            'admin': '#1976d2',
            'user': '#666'
        };
        const isCurrentUser = user.id === currentUserId;
        
        html += `
            <div class="elmo-account-item" data-user-id="${user.id}">
                <div class="elmo-account-info">
                    <div class="elmo-account-name-row">
                        <div class="elmo-account-name">${escapeHtml(user.name)}</div>
                        ${isCurrentUser ? '<span class="elmo-account-current-badge">(본인)</span>' : ''}
                    </div>
                    <div class="elmo-account-details">
                        <div class="elmo-account-username">@${escapeHtml(user.username)}</div>
                        ${user.email ? `<div class="elmo-account-email">${escapeHtml(user.email)}</div>` : ''}
                        <div class="elmo-account-meta">
                            <span class="elmo-account-created">가입일: ${formatDate(user.created_at)}</span>
                            ${user.last_login_at ? `<span class="elmo-account-last-login">최근 로그인: ${formatDate(user.last_login_at)}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="elmo-account-actions">
                    <div class="elmo-account-role-selector">
                        <label>권한:</label>
                        <select class="elmo-account-role-select" data-user-id="${user.id}" ${isCurrentUser ? 'disabled' : ''}>
                            ${user.role === 'su' ? '<option value="su" selected>슈퍼 관리자</option>' : ''}
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>관리자</option>
                            <option value="user" ${user.role === 'user' ? 'selected' : ''}>일반 유저</option>
                        </select>
                    </div>
                    ${!isCurrentUser ? `
                        <button class="elmo-account-delete-btn" data-user-id="${user.id}" title="계정 삭제">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    listWrapper.innerHTML = html;
    
    // 이벤트 리스너 설정
    setupAccountEventListeners();
}

/**
 * 계정 이벤트 리스너 설정
 */
function setupAccountEventListeners() {
    // 권한 변경
    const roleSelects = document.querySelectorAll('.elmo-account-role-select');
    roleSelects.forEach(select => {
        select.addEventListener('change', async (e) => {
            const userId = select.getAttribute('data-user-id');
            const newRole = select.value;
            
            if (!confirm(`권한을 "${getRoleLabel(newRole)}"로 변경하시겠습니까?`)) {
                // 원래 값으로 복원
                await loadAccountList();
                return;
            }
            
            try {
                const response = await fetch(`/api/elmo/users/${userId}/role`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Elmo-Session': currentSessionId,
                        'X-Elmo-User-Id': currentUserId
                    },
                    body: JSON.stringify({ role: newRole })
                });
                
                if (response.ok) {
                    alert('권한이 변경되었습니다.');
                    await loadAccountList();
                } else {
                    const error = await response.json();
                    alert(error.message || '권한 변경 중 오류가 발생했습니다.');
                    await loadAccountList();
                }
            } catch (error) {
                console.error('권한 변경 오류:', error);
                alert('권한 변경 중 오류가 발생했습니다.');
                await loadAccountList();
            }
        });
    });
    
    // 계정 삭제
    const deleteButtons = document.querySelectorAll('.elmo-account-delete-btn');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const userId = btn.getAttribute('data-user-id');
            const accountItem = btn.closest('.elmo-account-item');
            const accountName = accountItem.querySelector('.elmo-account-name').textContent;
            
            if (!confirm(`"${accountName}" 계정을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
                return;
            }
            
            try {
                const response = await fetch(`/api/elmo/users/${userId}`, {
                    method: 'DELETE',
                    headers: {
                        'X-Elmo-Session': currentSessionId,
                        'X-Elmo-User-Id': currentUserId
                    }
                });
                
                if (response.ok) {
                    alert('계정이 삭제되었습니다.');
                    await loadAccountList();
                } else {
                    const error = await response.json();
                    alert(error.message || '계정 삭제 중 오류가 발생했습니다.');
                }
            } catch (error) {
                console.error('계정 삭제 오류:', error);
                alert('계정 삭제 중 오류가 발생했습니다.');
            }
        });
    });
}

/**
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
    // 추가 이벤트 리스너가 필요하면 여기에 추가
}

/**
 * 역할 라벨 가져오기
 */
function getRoleLabel(role) {
    const labels = {
        'su': '슈퍼 관리자',
        'admin': '관리자',
        'user': '일반 유저'
    };
    return labels[role] || role;
}

/**
 * 날짜 포맷팅
 */
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * HTML 이스케이프
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
