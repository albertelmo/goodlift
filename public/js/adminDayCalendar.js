// 날짜별 세션 캘린더 (관리자용)
export const adminDayCalendar = {
  render
};

let state = {
  date: null // 'YYYY-MM-DD'
};

function render(root, dateStr) {
  if (!root) return;
  // 날짜 상태 초기화
  let today = new Date();
  let date = dateStr ? new Date(dateStr) : today;
  state.date = date.toISOString().slice(0, 10);
  root.innerHTML = `<div class="adc-header"></div><div class="adc-table-wrap"></div>`;
  renderHeader(root.querySelector('.adc-header'));
  renderTable(root.querySelector('.adc-table-wrap'));
}

function renderHeader(headerEl) {
  if (!headerEl) return;
  const d = new Date(state.date);
  headerEl.innerHTML = `
    <div class="adc-date-nav">
      <button id="adc-prev" class="adc-nav-btn adc-prev-btn"></button>
      <span class="adc-date">${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} (${['일','월','화','수','목','금','토'][d.getDay()]})</span>
      <button id="adc-next" class="adc-nav-btn adc-next-btn"></button>
    </div>
  `;
  headerEl.querySelector('#adc-prev').onclick = () => moveDate(-1);
  headerEl.querySelector('#adc-next').onclick = () => moveDate(1);
}

function moveDate(delta) {
  let d = new Date(state.date);
  if (delta === 0) d = new Date();
  else d.setDate(d.getDate() + delta);
  state.date = d.toISOString().slice(0, 10);
  const root = document.getElementById('admin-day-calendar-root');
  if (root) render(root, state.date);
}

async function renderTable(tableWrap) {
  if (!tableWrap) return;
  tableWrap.innerHTML = '<div style="color:#888;text-align:center;">불러오는 중...</div>';
  // 트레이너, 세션 데이터 fetch
  const [trainers, sessions] = await Promise.all([
    fetch('/api/trainers').then(r=>r.json()),
    fetch(`/api/sessions?date=${state.date}`).then(r=>r.json())
  ]);
  // === 동적으로 시간대 계산 (30분 단위, 최소 09:00~17:00) ===
  let minTime = 9 * 60, maxTime = 17 * 60; // 분 단위
  if (sessions.length) {
    const times = sessions.map(s => {
      const [h, m] = s.time.split(':').map(Number);
      return h * 60 + m;
    });
    minTime = Math.min(minTime, ...times);
    maxTime = Math.max(maxTime, ...times, minTime + 30);
    // 마지막 세션 종료 후 30분까지 표시
    maxTime = Math.max(maxTime + 30, 17 * 60);
    minTime = Math.min(minTime, 9 * 60);
  }
  // 30분 단위 시간 배열 생성
  const hours = [];
  for(let t = minTime; t <= maxTime; t += 30) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    hours.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
  }
  // 표 렌더링
  let html = '<div class="adc-table-scroll"><table class="adc-table"><thead><tr><th>시간</th>';
  trainers.forEach(t => { html += `<th>${t.name}</th>`; });
  html += '</tr></thead><tbody>';
  // 30분 단위 행 생성, 세션은 rowspan=2로 표시
  for (let i = 0; i < hours.length; i++) {
    const hour = hours[i];
    const [h, m] = hour.split(':').map(Number);
    html += '<tr>';
    // 왼쪽 시간 칼럼: 1시간 단위만 텍스트, 30분 단위는 빈 칸
    if (m === 0) {
      html += `<td class="adc-time">${hour}</td>`;
    } else {
      html += '<td class="adc-time"></td>';
    }
    trainers.forEach(t => {
      // 세션이 이 시간에 시작하면 rowspan=2로 카드 표시
      const session = sessions.find(s => s.trainer === t.username && s.time === hour);
      // 이전 30분 셀에서 이미 rowspan=2로 표시된 경우, 이 셀은 display:none
      const prevIdx = i - 1;
      let prevSession = null;
      if (prevIdx >= 0) {
        const prevHour = hours[prevIdx];
        prevSession = sessions.find(s => s.trainer === t.username && s.time === prevHour);
      }
      if (session) {
        // 상태를 영어 클래스명으로 변환
        let statusClass = 'reserved'; // 기본값
        if (session.status === '예정') statusClass = 'reserved';
        else if (session.status === '완료') statusClass = 'attend';
        else if (session.status === '사전') statusClass = 'pre';
        else if (session.status === '결석') statusClass = 'absent';
        else if (session.status === '취소') statusClass = 'cancel';
        else if (session.status === '전체취소') statusClass = 'allcancel';
        
        html += `<td rowspan="2"><div class="adc-session adc-status-${statusClass}">
          <strong>${session.member}</strong>
          <div class="adc-status-label">${session.status}</div>
        </div></td>`;
      } else if (prevSession) {
        html += '<td style="display:none"></td>';
      } else {
        html += '<td></td>';
      }
    });
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  tableWrap.innerHTML = html;
} 