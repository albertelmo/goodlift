import { trainer } from './trainer.js';

export const trainerWeekCalendar = { render };

const DAY_COUNT = 7;
const SLOT_MINUTES = 30;
const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 21;
const CENTER_COLORS = ['#4797dc', '#9274cf', '#68b83e', '#df7087', '#35a89a', '#6574c7'];
const UNKNOWN_CENTER_COLOR = '#9aa0a6';

const state = {
  root: null,
  weekStart: null,
  sessions: [],
  members: [],
  centers: [],
  trainers: [],
  trainerInfo: null
};

function toDateString(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function parseDate(dateString) {
  return new Date(`${dateString}T00:00:00`);
}

function getMonday(date = new Date()) {
  const monday = new Date(date);
  const day = monday.getDay();
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeSessionDate(session) {
  return String(session.date || '').split('T')[0];
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getWeekDates() {
  const monday = parseDate(state.weekStart);
  return Array.from({ length: DAY_COUNT }, (_, index) => toDateString(addDays(monday, index)));
}

function formatRangeDate(dateString) {
  const date = parseDate(dateString);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function getTimeRange() {
  const minutes = state.sessions.map(session => {
    const [hour, minute] = String(session.time).split(':').map(Number);
    return hour * 60 + minute;
  }).filter(Number.isFinite);

  const earliest = minutes.length ? Math.min(...minutes) : DEFAULT_START_HOUR * 60;
  const latestEnd = minutes.length
    ? Math.max(...state.sessions.map(session => {
      const [hour, minute] = String(session.time).split(':').map(Number);
      return hour * 60 + minute + (session['30min'] === true ? 30 : 60);
    }))
    : DEFAULT_END_HOUR * 60;

  const startMinutes = Math.max(6 * 60, Math.min(DEFAULT_START_HOUR * 60, Math.floor(earliest / 60) * 60));
  const endMinutes = Math.min(22 * 60 + 30, Math.max(DEFAULT_END_HOUR * 60, Math.ceil(latestEnd / 60) * 60));
  return { startMinutes, endMinutes };
}

async function render(root, dateString) {
  if (!root) return;

  state.root = root;
  const baseDate = dateString ? parseDate(dateString) : new Date();
  state.weekStart = toDateString(getMonday(baseDate));
  root.innerHTML = '<div class="twc-loading">주간 수업을 불러오는 중...</div>';
  await loadAndRender();
}

async function loadAndRender() {
  if (!state.root) return;

  const username = localStorage.getItem('username');
  if (!username) {
    state.root.innerHTML = '<div class="twc-empty">로그인 정보를 확인할 수 없습니다.</div>';
    return;
  }

  try {
    const [sessionsResponse, membersResponse, trainersResponse, centersResponse] = await Promise.all([
      fetch(`/api/sessions?trainer=${encodeURIComponent(username)}&week=${state.weekStart}`),
      fetch('/api/members'),
      fetch('/api/trainers'),
      fetch('/api/centers')
    ]);

    if (!sessionsResponse.ok || !membersResponse.ok || !trainersResponse.ok || !centersResponse.ok) {
      throw new Error('주간 수업 데이터를 불러오지 못했습니다.');
    }

    const [sessions, members, trainers, centers] = await Promise.all([
      sessionsResponse.json(),
      membersResponse.json(),
      trainersResponse.json(),
      centersResponse.json()
    ]);

    const weekDateSet = new Set(getWeekDates());
    state.sessions = sessions
      .filter(session => weekDateSet.has(normalizeSessionDate(session)))
      .map(session => ({ ...session, date: normalizeSessionDate(session) }));
    state.members = members;
    state.centers = centers;
    state.trainers = trainers;
    state.trainerInfo = trainers.find(item => item.username === username) || null;
    renderLayout();
  } catch (error) {
    console.error('[Trainer Week Calendar] load failed:', error);
    state.root.innerHTML = `
      <div class="twc-empty">
        <p>주간 수업을 불러오지 못했습니다.</p>
        <button type="button" class="twc-retry-btn">다시 시도</button>
      </div>`;
    state.root.querySelector('.twc-retry-btn').onclick = loadAndRender;
  }
}

function renderLayout() {
  const weekDates = getWeekDates();
  const sunday = weekDates[weekDates.length - 1];

  state.root.innerHTML = `
    <section class="twc">
      <header class="twc-header">
        <button type="button" class="twc-nav-btn" id="twc-prev" aria-label="이전 주">‹</button>
        <button type="button" class="twc-range" id="twc-today" title="이번 주로 이동">
          ${formatRangeDate(state.weekStart)} ~ ${formatRangeDate(sunday)}
        </button>
        <button type="button" class="twc-nav-btn" id="twc-next" aria-label="다음 주">›</button>
      </header>
      <div class="twc-calendar-wrap">
        ${renderCalendar(weekDates)}
      </div>
      <button type="button" class="tmc-fab twc-add-btn" id="twc-add-btn" aria-label="수업 추가">+</button>
      <button type="button" class="tmc-fab twc-add-30min-btn" id="twc-add-30min-btn"
              aria-label="30분 수업 추가"
              style="display:${state.trainerInfo?.['30min_session'] === 'on' ? 'flex' : 'none'};">30min</button>
      ${renderAddModals()}
    </section>`;

  state.root.querySelector('#twc-prev').onclick = () => moveWeek(-1);
  state.root.querySelector('#twc-next').onclick = () => moveWeek(1);
  state.root.querySelector('#twc-today').onclick = () => {
    state.weekStart = toDateString(getMonday(new Date()));
    loadAndRender();
  };
  setupAddModal();
}

function renderCalendar(weekDates) {
  const { startMinutes, endMinutes } = getTimeRange();
  const slotCount = Math.ceil((endMinutes - startMinutes) / SLOT_MINUTES);
  const dayNames = ['월', '화', '수', '목', '금', '토', '일'];
  const today = toDateString(new Date());

  let html = `<div class="twc-grid" style="--twc-slot-count:${slotCount};">`;
  html += '<div class="twc-corner"></div>';

  weekDates.forEach((dateString, index) => {
    const date = parseDate(dateString);
    const todayClass = dateString === today ? ' is-today' : '';
    html += `
      <div class="twc-day-header${todayClass}" style="grid-column:${index + 2};grid-row:1;">
        <span>${dayNames[index]}</span>
        <strong>${date.getDate()}</strong>
      </div>`;
  });

  for (let slot = 0; slot < slotCount; slot += 1) {
    const minutes = startMinutes + slot * SLOT_MINUTES;
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const row = slot + 2;
    // 각 슬롯의 아래쪽 테두리이므로 30분 슬롯 아래가 다음 정시 경계다.
    const hourClass = minute === 30 ? ' is-hour' : '';

    html += `<div class="twc-time${hourClass}" style="grid-column:1;grid-row:${row};">${minute === 0 ? (hour % 12 || 12) : ''}</div>`;
    weekDates.forEach((_, dayIndex) => {
      html += `<div class="twc-cell${hourClass}" style="grid-column:${dayIndex + 2};grid-row:${row};"></div>`;
    });
  }

  state.sessions.forEach(session => {
    const dayIndex = weekDates.indexOf(session.date);
    const [hour, minute] = String(session.time).split(':').map(Number);
    const sessionMinutes = hour * 60 + minute;
    const rowOffset = Math.floor((sessionMinutes - startMinutes) / SLOT_MINUTES);
    if (dayIndex < 0 || rowOffset < 0 || rowOffset >= slotCount) return;

    const durationSlots = session['30min'] === true ? 1 : 2;
    const centerName = getSessionCenter(session);
    const centerColor = getCenterColor(centerName);
    const statusClass = session.status === '완료' ? ' is-complete' : '';
    html += `
      <div class="twc-session${statusClass}"
           style="grid-column:${dayIndex + 2};grid-row:${rowOffset + 2} / span ${durationSlots};--twc-center-color:${centerColor};"
           title="${escapeHtml(session.time)} ${escapeHtml(session.member)} · ${escapeHtml(centerName || '센터 미지정')}">
        <span class="twc-session-name">${escapeHtml(session.member)}</span>
      </div>`;
  });

  html += '</div>';
  return html;
}

function getSessionCenter(session) {
  return state.members.find(member => member.name === session.member)?.center || '';
}

function getCenterColor(centerName) {
  if (!centerName) return UNKNOWN_CENTER_COLOR;
  const centerIndex = state.centers.findIndex(center => center.name === centerName);
  return centerIndex >= 0 ? CENTER_COLORS[centerIndex % CENTER_COLORS.length] : UNKNOWN_CENTER_COLOR;
}

function getTrainerOptions() {
  const username = localStorage.getItem('username');
  return state.trainers.map(item =>
    `<option value="${escapeHtml(item.username)}"${item.username === username ? ' selected' : ''}>${escapeHtml(item.name)}</option>`
  ).join('');
}

function getMemberOptions(trainerUsername) {
  const assignedMembers = state.members.filter(member =>
    member.trainer === trainerUsername &&
    Number(member.remainSessions) > 0 &&
    member.status === '유효'
  );
  return assignedMembers.length
    ? assignedMembers.map(member => `<option value="${escapeHtml(member.name)}">${escapeHtml(member.name)}</option>`).join('')
    : '<option value="">담당 회원 없음</option>';
}

function renderSessionModal({ prefix, title }) {
  const username = localStorage.getItem('username');
  return `
    <div class="tmc-modal" id="${prefix}-modal" style="display:none;">
      <div class="tmc-modal-content">
        <div class="tmc-modal-header">
          <h3>${title}</h3>
          <button type="button" class="tmc-modal-close-btn" id="${prefix}-modal-close" aria-label="닫기">×</button>
        </div>
        <form id="${prefix}-session-add-form" class="tmc-modal-form">
          <div class="tmc-form-group">
            <label for="${prefix}-trainer-select">트레이너</label>
            <select name="trainer" id="${prefix}-trainer-select" required>${getTrainerOptions()}</select>
          </div>
          <div class="tmc-form-group">
            <label for="${prefix}-member-select">회원</label>
            <select name="member" id="${prefix}-member-select" required>${getMemberOptions(username)}</select>
          </div>
          <div class="tmc-form-group">
            <label for="${prefix}-date-input">날짜</label>
            <input type="date" name="date" id="${prefix}-date-input" required>
          </div>
          <div class="tmc-form-group">
            <label for="${prefix}-time-input">시간</label>
            <select name="time" id="${prefix}-time-input" required></select>
          </div>
          <div class="tmc-checkbox-group">
            <input type="checkbox" name="repeat" id="${prefix}-repeat-checkbox">
            <label for="${prefix}-repeat-checkbox">반복하기</label>
          </div>
          <div class="tmc-form-group twc-repeat-count" id="${prefix}-repeat-count-group">
            <label for="${prefix}-repeat-count-input">반복횟수</label>
            <select name="repeatCount" id="${prefix}-repeat-count-input">
              <option value="5">5회</option>
              <option value="10">10회</option>
              <option value="15">15회</option>
              <option value="20">20회</option>
            </select>
          </div>
          <div id="${prefix}-session-add-result" class="tmc-modal-result"></div>
        </form>
        <div class="tmc-modal-actions">
          <button type="submit" form="${prefix}-session-add-form" class="tmc-modal-submit-btn">등록</button>
        </div>
      </div>
    </div>`;
}

function renderAddModals() {
  return `
    <div class="tmc-modal-bg" id="twc-modal-bg" style="display:none;"></div>
    ${renderSessionModal({ prefix: 'twc', title: '세션 추가' })}
    ${renderSessionModal({ prefix: 'twc-30min', title: '30분 세션 추가' })}`;
}

function getDefaultAddDate() {
  const today = toDateString(new Date());
  return getWeekDates().includes(today) ? today : state.weekStart;
}

function setupAddModal() {
  const backdrop = state.root.querySelector('#twc-modal-bg');

  const closeModal = () => {
    backdrop.style.display = 'none';
    state.root.querySelectorAll('#twc-modal, #twc-30min-modal').forEach(modal => {
      modal.style.display = 'none';
    });
    document.body.style.overflow = '';
  };

  backdrop.onclick = event => {
    if (event.target === backdrop) closeModal();
  };

  [
    { prefix: 'twc', buttonId: 'twc-add-btn', is30min: false },
    { prefix: 'twc-30min', buttonId: 'twc-add-30min-btn', is30min: true }
  ].forEach(config => setupSessionForm(config, backdrop, closeModal));
}

function setupSessionForm({ prefix, buttonId, is30min }, backdrop, closeModal) {
  const button = state.root.querySelector(`#${buttonId}`);
  const modal = state.root.querySelector(`#${prefix}-modal`);
  const closeButton = state.root.querySelector(`#${prefix}-modal-close`);
  const trainerSelect = state.root.querySelector(`#${prefix}-trainer-select`);
  const memberSelect = state.root.querySelector(`#${prefix}-member-select`);
  const dateInput = state.root.querySelector(`#${prefix}-date-input`);
  const repeatCheckbox = state.root.querySelector(`#${prefix}-repeat-checkbox`);
  const repeatCountGroup = state.root.querySelector(`#${prefix}-repeat-count-group`);
  const form = state.root.querySelector(`#${prefix}-session-add-form`);

  trainerSelect.onchange = () => {
    memberSelect.innerHTML = getMemberOptions(trainerSelect.value);
  };
  dateInput.onchange = () => updateTimeOptions(dateInput.value, is30min, prefix);
  repeatCheckbox.onchange = () => {
    repeatCountGroup.classList.toggle('is-visible', repeatCheckbox.checked);
  };
  closeButton.onclick = closeModal;

  button.onclick = async () => {
    dateInput.value = getDefaultAddDate();
    await updateTimeOptions(dateInput.value, is30min, prefix);
    backdrop.style.display = 'block';
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
  };

  form.onsubmit = async event => {
    event.preventDefault();
    const resultElement = state.root.querySelector(`#${prefix}-session-add-result`);
    const submitButton = state.root.querySelector(`[form="${prefix}-session-add-form"]`);
    const data = Object.fromEntries(new FormData(form));
    // 기존 나의 수업과 동일하게 세션은 로그인한 트레이너 명의로 등록한다.
    data.trainer = localStorage.getItem('username');
    if (is30min) data['30min'] = true;
    if (!repeatCheckbox.checked) {
      delete data.repeat;
      delete data.repeatCount;
    }

    resultElement.className = 'tmc-modal-result';
    resultElement.textContent = '처리 중...';
    submitButton.disabled = true;

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `${is30min ? '30분 ' : ''}세션 추가에 실패했습니다.`);

      trainer.invalidateSessionsCache();
      resultElement.className = 'tmc-modal-result success';
      resultElement.textContent = result.message || '세션이 추가되었습니다.';
      setTimeout(async () => {
        closeModal();
        await loadAndRender();
      }, 700);
    } catch (error) {
      resultElement.className = 'tmc-modal-result error';
      resultElement.textContent = error.message || `${is30min ? '30분 ' : ''}세션 추가에 실패했습니다.`;
      submitButton.disabled = false;
    }
  };
}

async function updateTimeOptions(dateString, is30min, prefix) {
  const select = state.root.querySelector(`#${prefix}-time-input`);
  if (!select || !dateString) return;

  select.innerHTML = '<option value="">불러오는 중...</option>';
  const username = localStorage.getItem('username');
  let daySessions = state.sessions.filter(session => session.date === dateString);

  if (!getWeekDates().includes(dateString)) {
    try {
      const response = await fetch(`/api/sessions?trainer=${encodeURIComponent(username)}&date=${dateString}`);
      if (response.ok) daySessions = await response.json();
    } catch (error) {
      console.error('[Trainer Week Calendar] time check failed:', error);
    }
  }

  const disabledTimes = getDisabledTimes(daySessions, is30min);
  let options = '';
  for (let hour = 6; hour <= 22; hour += 1) {
    for (let minute = 0; minute < 60; minute += 30) {
      if (hour === 22 && minute > 0) break;
      const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      const disabled = disabledTimes.has(time);
      options += `<option value="${time}"${disabled ? ' disabled' : ''}>${time}${disabled ? ' (예약불가)' : ''}</option>`;
    }
  }
  select.innerHTML = options;
}

function getDisabledTimes(sessions, is30min) {
  const occupiedSlots = new Set();
  sessions.forEach(session => {
    const [hour, minute] = String(session.time).split(':').map(Number);
    const start = hour * 60 + minute;
    occupiedSlots.add(start);
    if (session['30min'] !== true) occupiedSlots.add(start + 30);
  });

  const disabled = new Set();
  for (let start = 6 * 60; start <= 22 * 60; start += 30) {
    const hasConflict = is30min
      ? occupiedSlots.has(start)
      : occupiedSlots.has(start) || occupiedSlots.has(start + 30);
    if (hasConflict) {
      const hour = Math.floor(start / 60);
      const minute = start % 60;
      disabled.add(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    }
  }
  return disabled;
}

function moveWeek(direction) {
  const monday = parseDate(state.weekStart);
  monday.setDate(monday.getDate() + direction * 7);
  state.weekStart = toDateString(monday);
  loadAndRender();
}
