export const member = {
  renderAddForm,
  renderList
};

let trainerMap = {};

function renderAddForm(container) {
  if (!container) return;
  container.innerHTML = `
    <form id="member-add-form" class="form-box" style="max-width:420px;margin:0 auto;">
      <h3>회원 추가</h3>
      <label>이름 <input type="text" name="name" required></label>
      <label>성별
        <select name="gender" required>
          <option value="">선택</option>
          <option value="male">남성</option>
          <option value="female">여성</option>
        </select>
      </label>
      <label>전화번호 <input type="tel" name="phone" required pattern="[0-9\-]+" placeholder="010-1234-5678"></label>
      <label>담당 트레이너
        <select name="trainer" required id="member-trainer-select"><option value="">불러오는 중...</option></select>
      </label>
      <label>센터
        <select name="center" required id="member-center-select"><option value="">불러오는 중...</option></select>
      </label>
      <label>등록일 <input type="date" name="regdate" required id="member-regdate"></label>
      <label>세션 수 <input type="number" name="sessions" min="0" required value="0"></label>
      <button type="submit">회원 추가</button>
      <div id="member-add-result" style="min-height:24px;margin-top:8px;"></div>
    </form>
  `;
  // 오늘 날짜 기본값
  document.getElementById('member-regdate').value = new Date().toISOString().slice(0, 10);
  // 트레이너/센터 드롭다운 동적 로딩
  fetch('/api/trainers').then(r=>r.json()).then(trs=>{
    const sel = document.getElementById('member-trainer-select');
    trainerMap = {};
    sel.innerHTML = '<option value="">선택</option>' + trs.map(t=>{
      trainerMap[t.username] = t.name;
      return `<option value="${t.username}">${t.name}</option>`;
    }).join('');
  });
  fetch('/api/centers').then(r=>r.json()).then(cs=>{
    const sel = document.getElementById('member-center-select');
    sel.innerHTML = '<option value="">선택</option>' + cs.map(c=>`<option value="${c.name}">${c.name}</option>`).join('');
  });
  // 폼 제출 이벤트(API 연동)
  document.getElementById('member-add-form').onsubmit = async function(e) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    data.sessions = Number(data.sessions);
    const resultDiv = document.getElementById('member-add-result');
    resultDiv.style.color = '#1976d2';
    resultDiv.innerText = '처리 중...';
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (res.ok) {
        resultDiv.style.color = '#1976d2';
        resultDiv.innerText = result.message;
        form.reset();
        document.getElementById('member-regdate').value = new Date().toISOString().slice(0, 10);
        member.renderList(document.getElementById('member-list'));
      } else {
        resultDiv.style.color = '#d32f2f';
        resultDiv.innerText = result.message;
      }
    } catch {
      resultDiv.style.color = '#d32f2f';
      resultDiv.innerText = '회원 추가에 실패했습니다.';
    }
  };
}

function renderList(container) {
  if (!container) return;
  container.innerHTML = '<div style="color:#888;text-align:center;">불러오는 중...</div>';
  Promise.all([
    fetch('/api/members').then(r=>r.json()),
    fetch('/api/trainers').then(r=>r.json())
  ]).then(([members, trainers]) => {
    const tMap = {};
    trainers.forEach(t => { tMap[t.username] = t.name; });
    if (!members.length) {
      container.innerHTML = '<div style="color:#888;text-align:center;">등록된 회원이 없습니다.</div>';
      return;
    }
    let html = `<table style="width:100%;border-collapse:collapse;margin-top:18px;">
      <thead><tr>
        <th>이름</th><th>성별</th><th>전화번호</th><th>담당 트레이너</th><th>센터</th><th>등록일</th><th>세션 수</th><th>잔여세션</th><th>상태</th>
      </tr></thead><tbody>`;
    members.forEach(m => {
      html += `<tr>
        <td>${m.name}</td>
        <td>${m.gender === 'male' ? '남' : m.gender === 'female' ? '여' : ''}</td>
        <td>${m.phone}</td>
        <td>${tMap[m.trainer] || m.trainer}</td>
        <td>${m.center}</td>
        <td>${m.regdate}</td>
        <td>${m.sessions}</td>
        <td>${m.remainSessions !== undefined ? m.remainSessions : ''}</td>
        <td>${m.status || ''}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }).catch(()=>{
    container.innerHTML = '<div style="color:#d32f2f;text-align:center;">회원 목록을 불러오지 못했습니다.</div>';
  });
} 