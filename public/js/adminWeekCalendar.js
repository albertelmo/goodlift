import { trainerWeekCalendar } from './trainerWeekCalendar.js';

export const adminWeekCalendar = { render };

let selectedTrainerUsername = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function render(root) {
  if (!root) return;
  root.innerHTML = '<div class="awc-loading">트레이너 목록을 불러오는 중...</div>';

  try {
    const response = await fetch('/api/trainers');
    if (!response.ok) throw new Error('트레이너 목록을 불러오지 못했습니다.');

    const trainers = (await response.json())
      .filter(item => (item.calendar_suspended || 'off') !== 'on')
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

    if (!trainers.length) {
      root.innerHTML = '<div class="awc-empty">표시할 트레이너가 없습니다.</div>';
      return;
    }

    if (!trainers.some(item => item.username === selectedTrainerUsername)) {
      selectedTrainerUsername = trainers[0].username;
    }

    root.innerHTML = `
      <section class="awc">
        <div class="awc-trainer-toolbar">
          <label for="awc-trainer-select">트레이너</label>
          <select id="awc-trainer-select" class="awc-trainer-select">
            ${trainers.map(item => `
              <option value="${escapeHtml(item.username)}"${item.username === selectedTrainerUsername ? ' selected' : ''}>
                ${escapeHtml(item.name)}
              </option>`).join('')}
          </select>
        </div>
        <div id="awc-trainer-week-root"></div>
      </section>`;

    const select = root.querySelector('#awc-trainer-select');
    const calendarRoot = root.querySelector('#awc-trainer-week-root');
    select.onchange = () => {
      selectedTrainerUsername = select.value;
      renderSelectedTrainer(calendarRoot);
    };
    await renderSelectedTrainer(calendarRoot);
  } catch (error) {
    console.error('[Admin Week Calendar] load failed:', error);
    root.innerHTML = `
      <div class="awc-empty">
        <p>주간 수업을 불러오지 못했습니다.</p>
        <button type="button" class="awc-retry-btn">다시 시도</button>
      </div>`;
    root.querySelector('.awc-retry-btn').onclick = () => render(root);
  }
}

async function renderSelectedTrainer(root) {
  await trainerWeekCalendar.render(root, undefined, {
    trainerUsername: selectedTrainerUsername,
    readOnly: true
  });
}
