// 관리자 오늘 / 트레이너 전체 수업에서 공유하는 일간 세션 캘린더
export const adminDayCalendar = { render };

const SLOT_MINUTES = 30;
const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 17;

const state = {
  root: null,
  date: null
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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(dateString) {
  const date = parseDate(dateString);
  const dayName = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} (${dayName})`;
}

function render(root, dateString) {
  if (!root) return;

  state.root = root;
  state.date = dateString ? toDateString(parseDate(dateString)) : toDateString(new Date());
  root.innerHTML = `
    <section class="adc">
      <header class="adc-header">
        <button type="button" class="adc-nav-btn" id="adc-prev" aria-label="이전 날">‹</button>
        <button type="button" class="adc-date" id="adc-today" title="오늘로 이동">${formatDate(state.date)}</button>
        <button type="button" class="adc-nav-btn" id="adc-next" aria-label="다음 날">›</button>
      </header>
      <div class="adc-calendar-wrap">
        <div class="adc-loading">수업을 불러오는 중...</div>
      </div>
    </section>`;

  root.querySelector('#adc-prev').onclick = () => moveDate(-1);
  root.querySelector('#adc-next').onclick = () => moveDate(1);
  root.querySelector('#adc-today').onclick = () => {
    state.date = toDateString(new Date());
    render(state.root, state.date);
  };
  renderCalendar();
}

function moveDate(direction) {
  const date = parseDate(state.date);
  date.setDate(date.getDate() + direction);
  render(state.root, toDateString(date));
}

async function renderCalendar() {
  const calendarWrap = state.root?.querySelector('.adc-calendar-wrap');
  if (!calendarWrap) return;

  try {
    const [trainersResponse, sessionsResponse, membersResponse] = await Promise.all([
      fetch('/api/trainers'),
      fetch(`/api/sessions?date=${state.date}`),
      fetch('/api/members')
    ]);
    if (!trainersResponse.ok || !sessionsResponse.ok || !membersResponse.ok) {
      throw new Error('일간 수업 데이터를 불러오지 못했습니다.');
    }

    const [trainers, sessions, members] = await Promise.all([
      trainersResponse.json(),
      sessionsResponse.json(),
      membersResponse.json()
    ]);

    const suspendedUsernames = new Set(
      trainers
        .filter(item => (item.calendar_suspended || 'off') === 'on')
        .map(item => item.username)
    );
    const activeTrainers = trainers
      .filter(item => !suspendedUsernames.has(item.username))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    const processedSessions = sessions
      .filter(session => !suspendedUsernames.has(session.trainer))
      .map(session => processSession(session, members));

    calendarWrap.innerHTML = renderGrid(activeTrainers, processedSessions);
  } catch (error) {
    console.error('[Admin Day Calendar] load failed:', error);
    calendarWrap.innerHTML = `
      <div class="adc-empty">
        <p>수업을 불러오지 못했습니다.</p>
        <button type="button" class="adc-retry-btn">다시 시도</button>
      </div>`;
    calendarWrap.querySelector('.adc-retry-btn').onclick = renderCalendar;
  }
}

function processSession(session, members) {
  const member = members.find(item => item.name === session.member);
  const remainSessions = member ? Number(member.remainSessions) : 0;
  const hasNoRemainingSessions = remainSessions <= 0;
  const displayStatus = session.status !== '완료' && hasNoRemainingSessions
    ? '잔여세션 부족'
    : session.status;

  return {
    ...session,
    date: String(session.date || '').split('T')[0],
    remainSessions,
    hasNoRemainingSessions,
    displayStatus
  };
}

function getTimeRange(sessions) {
  const starts = sessions.map(session => {
    const [hour, minute] = String(session.time).split(':').map(Number);
    return hour * 60 + minute;
  }).filter(Number.isFinite);

  if (!starts.length) {
    return {
      startMinutes: DEFAULT_START_HOUR * 60,
      endMinutes: DEFAULT_END_HOUR * 60
    };
  }

  const ends = sessions.map(session => {
    const [hour, minute] = String(session.time).split(':').map(Number);
    return hour * 60 + minute + (session['30min'] === true ? 30 : 60);
  });
  const startMinutes = Math.max(6 * 60, Math.min(DEFAULT_START_HOUR * 60, Math.floor(Math.min(...starts) / 60) * 60));
  const endMinutes = Math.min(23 * 60, Math.max(DEFAULT_END_HOUR * 60, Math.ceil(Math.max(...ends) / 60) * 60));
  return { startMinutes, endMinutes };
}

function renderGrid(trainers, sessions) {
  if (!trainers.length) {
    return '<div class="adc-empty">표시할 트레이너가 없습니다.</div>';
  }

  const { startMinutes, endMinutes } = getTimeRange(sessions);
  const slotCount = Math.ceil((endMinutes - startMinutes) / SLOT_MINUTES);
  const isMobile = window.innerWidth <= 600;
  const sizeStyle = isMobile ? 'width:100%;' : `min-width:${24 + trainers.length * 70}px;`;
  let html = `
    <div class="adc-grid"
         style="--adc-trainer-count:${trainers.length};--adc-slot-count:${slotCount};${sizeStyle}">`;
  html += '<div class="adc-corner"></div>';

  trainers.forEach((item, index) => {
    html += `
      <div class="adc-trainer-header" style="grid-column:${index + 2};grid-row:1;"
           title="${escapeHtml(item.name)}">
        ${escapeHtml(item.name)}
      </div>`;
  });

  for (let slot = 0; slot < slotCount; slot += 1) {
    const minutes = startMinutes + slot * SLOT_MINUTES;
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const row = slot + 2;
    const hourClass = minute === 30 ? ' is-hour' : '';

    html += `
      <div class="adc-time${hourClass}" style="grid-column:1;grid-row:${row};">
        ${minute === 0 ? (hour % 12 || 12) : ''}
      </div>`;
    trainers.forEach((_, trainerIndex) => {
      html += `
        <div class="adc-cell${hourClass}"
             style="grid-column:${trainerIndex + 2};grid-row:${row};"></div>`;
    });
  }

  sessions.forEach(session => {
    const trainerIndex = trainers.findIndex(item => item.username === session.trainer);
    const [hour, minute] = String(session.time).split(':').map(Number);
    const sessionMinutes = hour * 60 + minute;
    const rowOffset = Math.floor((sessionMinutes - startMinutes) / SLOT_MINUTES);
    if (trainerIndex < 0 || rowOffset < 0 || rowOffset >= slotCount) return;

    const durationSlots = session['30min'] === true ? 1 : 2;
    html += renderSessionCard(session, trainerIndex + 2, rowOffset + 2, durationSlots);
  });

  html += '</div>';
  return html;
}

function getStatusClass(displayStatus) {
  const statusClasses = {
    '예정': 'reserved',
    '완료': 'attend',
    '사전': 'pre',
    '결석': 'absent',
    '취소': 'cancel',
    '전체취소': 'allcancel',
    '잔여세션 부족': 'no-remaining'
  };
  return statusClasses[displayStatus] || 'reserved';
}

function renderSessionCard(session, gridColumn, gridRow, durationSlots) {
  const is30min = session['30min'] === true;
  const noRemainingClass = session.hasNoRemainingSessions && session.status !== '완료'
    ? ' adc-no-remaining'
    : '';
  const cardClass = `adc-session-card adc-status-${getStatusClass(session.displayStatus)}${is30min ? ' adc-session-card-30min' : ''}${noRemainingClass}`;

  return `
    <div class="${cardClass}"
         style="grid-column:${gridColumn};grid-row:${gridRow} / span ${durationSlots};"
         title="${escapeHtml(session.member)} (${session.remainSessions}) · ${escapeHtml(session.displayStatus)}">
      <div class="adc-session-member">${escapeHtml(session.member)} (${session.remainSessions})</div>
      <div class="adc-session-status">${escapeHtml(session.displayStatus)}</div>
    </div>`;
}
