const CATEGORY_LABELS = {
  member: '회원',
  sales: '매출',
  expense: '지출',
  consultation: '상담'
};

let panelOpen = false;
let initialized = false;

const KST_TIMEZONE = 'Asia/Seoul';

function formatLogTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const now = new Date();
  const dateOpts = { timeZone: KST_TIMEZONE };
  const todayKst = now.toLocaleDateString('ko-KR', dateOpts);
  const logDateKst = date.toLocaleDateString('ko-KR', dateOpts);
  const time = date.toLocaleTimeString('ko-KR', {
    timeZone: KST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit'
  });
  if (todayKst === logDateKst) return time;
  const monthDay = date.toLocaleDateString('ko-KR', {
    timeZone: KST_TIMEZONE,
    month: 'numeric',
    day: 'numeric'
  });
  return `${monthDay} ${time}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

export function setAdminNotificationsVisible(visible) {
  const btn = document.getElementById('adminNotificationsBtn');
  const panel = document.getElementById('adminNotificationsPanel');
  if (!btn) return;
  btn.style.display = visible ? 'flex' : 'none';
  if (!visible) {
    closeAdminNotificationsPanel();
    if (panel) panel.style.display = 'none';
  }
}

function closeAdminNotificationsPanel() {
  const panel = document.getElementById('adminNotificationsPanel');
  if (panel) panel.style.display = 'none';
  panelOpen = false;
}

async function loadAdminNotificationLogs() {
  const listEl = document.getElementById('adminNotificationsList');
  if (!listEl) return;

  const username = localStorage.getItem('username');
  if (!username) {
    listEl.innerHTML = '<div class="admin-notifications-empty">로그인 정보가 없습니다.</div>';
    return;
  }

  listEl.innerHTML = '<div class="admin-notifications-loading">불러오는 중...</div>';

  try {
    const res = await fetch(`/api/admin/push/logs?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || '알림 내역 조회 실패');
    }

    const logs = data.logs || [];
    if (logs.length === 0) {
      listEl.innerHTML = '<div class="admin-notifications-empty">최근 7일간 알림 내역이 없습니다.</div>';
      return;
    }

    listEl.innerHTML = logs.map(log => {
      const categoryLabel = CATEGORY_LABELS[log.category] || log.category || '알림';
      const timeLabel = formatLogTime(log.created_at);
      const title = log.title || categoryLabel;
      const body = log.body || '';
      return `
        <div class="admin-notifications-item">
          <div class="admin-notifications-item-head">
            <span class="admin-notifications-category">${escapeHtml(categoryLabel)}</span>
            <span class="admin-notifications-time">${escapeHtml(timeLabel)}</span>
          </div>
          <div class="admin-notifications-title">${escapeHtml(title)}</div>
          <div class="admin-notifications-body">${escapeHtml(body)}</div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('관리자 알림 내역 조회 오류:', error);
    listEl.innerHTML = `<div class="admin-notifications-empty">${escapeHtml(error.message || '조회 중 오류가 발생했습니다.')}</div>`;
  }
}

async function toggleAdminNotificationsPanel() {
  const panel = document.getElementById('adminNotificationsPanel');
  if (!panel) return;

  if (panelOpen) {
    closeAdminNotificationsPanel();
    return;
  }

  panel.style.display = 'flex';
  panelOpen = true;
  await loadAdminNotificationLogs();
}

export function initAdminNotifications() {
  if (initialized) return;
  initialized = true;

  const btn = document.getElementById('adminNotificationsBtn');
  const panel = document.getElementById('adminNotificationsPanel');
  if (!btn || !panel) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleAdminNotificationsPanel();
  });

  document.addEventListener('click', (e) => {
    if (!panelOpen) return;
    if (panel.contains(e.target) || btn.contains(e.target)) return;
    closeAdminNotificationsPanel();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panelOpen) {
      closeAdminNotificationsPanel();
    }
  });
}
