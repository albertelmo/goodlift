export const member = {
  renderAddForm,
  renderList
};

let trainerMap = {};

function renderAddForm(container) {
  if (!container) return;
  container.innerHTML = `
    <form id="member-add-form" class="form-box" style="margin:0 auto;">
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
        setTimeout(() => { resultDiv.innerText = ''; }, 1500);
        form.reset();
        document.getElementById('member-regdate').value = new Date().toISOString().slice(0, 10);
        member.renderList(document.getElementById('member-list'));
      } else {
        resultDiv.style.color = '#d32f2f';
        resultDiv.innerText = result.message;
        setTimeout(() => { resultDiv.innerText = ''; }, 1500);
      }
    } catch {
      resultDiv.style.color = '#d32f2f';
      resultDiv.innerText = '회원 추가에 실패했습니다.';
      setTimeout(() => { resultDiv.innerText = ''; }, 1500);
    }
  };
}

function renderList(container) {
  if (!container) return;
  container.innerHTML = `
    <div style="margin-bottom:10px;text-align:right;">
      <input id="member-search-input" type="text" placeholder="이름 검색" style="padding:6px 10px;font-size:0.97rem;border:1.2px solid #bbb;border-radius:6px;width:160px;">
    </div>
    <div id="member-table-wrap"></div>
    <div id="member-edit-modal-bg" style="display:none;"></div>
  `;
  const tableWrap = container.querySelector('#member-table-wrap');
  let allMembers = [];
  let trainers = [];
  // 데이터 불러오기
  Promise.all([
    fetch('/api/members').then(r=>r.json()),
    fetch('/api/trainers').then(r=>r.json())
  ]).then(([members, trs]) => {
    allMembers = members;
    trainers = trs;
    renderTable(allMembers);
  }).catch(()=>{
    tableWrap.innerHTML = '<div style="color:#d32f2f;text-align:center;">회원 목록을 불러오지 못했습니다.</div>';
  });
  // 테이블 렌더링 함수
  function renderTable(members) {
    const tMap = {};
    trainers.forEach(t => { tMap[t.username] = t.name; });
    if (!members.length) {
      tableWrap.innerHTML = '<div style="color:#888;text-align:center;">등록된 회원이 없습니다.</div>';
      return;
    }
    let html = `<table style="width:100%;border-collapse:collapse;margin-top:18px;">
      <thead><tr>
        <th style="text-align:center;">이름</th><th style="text-align:center;">성별</th><th style="text-align:center;">전화번호</th><th style="text-align:center;">담당 트레이너</th><th style="text-align:center;">센터</th><th style="text-align:center;">등록일</th><th style="text-align:center;">세션 수</th><th style="text-align:center;">잔여세션</th><th style="text-align:center;">상태</th>
      </tr></thead><tbody>`;
    members.forEach((m, idx) => {
      html += `<tr class="member-row" data-idx="${idx}" style="cursor:pointer;">
        <td style="text-align:center;">${m.name}</td>
        <td style="text-align:center;">${m.gender === 'male' ? '👨' : m.gender === 'female' ? '👩' : ''}</td>
        <td style="text-align:center;">${m.phone}</td>
        <td style="text-align:center;">${tMap[m.trainer] || m.trainer}</td>
        <td style="text-align:center;">${m.center}</td>
        <td style="text-align:center;">${m.regdate}</td>
        <td style="text-align:center;">${m.sessions}</td>
        <td style="text-align:center;">${m.remainSessions !== undefined ? m.remainSessions : ''}</td>
        <td style="text-align:center;">${m.status || ''}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    tableWrap.innerHTML = html;
    // 행 클릭 이벤트(모달)
    tableWrap.querySelectorAll('.member-row').forEach(row => {
      row.addEventListener('click', function() {
        const idx = this.getAttribute('data-idx');
        showEditModal(members[idx]);
      });
    });
  }
  // 검색 이벤트
  container.querySelector('#member-search-input').addEventListener('input', function() {
    const keyword = this.value.trim();
    if (!keyword) {
      renderTable(allMembers);
    } else {
      const filtered = allMembers.filter(m => m.name.includes(keyword));
      renderTable(filtered);
    }
  });
  // 회원 정보 수정 모달
  function showEditModal(member) {
    const modalBg = document.getElementById('member-edit-modal-bg');
    modalBg.style.display = 'block';
    modalBg.innerHTML = `
      <div id="member-edit-modal" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;border-radius:14px;box-shadow:0 4px 32px #1976d240;padding:32px 24px;z-index:1002;min-width:260px;max-width:96vw;min-height:120px;">
        <h3 style="color:var(--primary);margin-top:0;margin-bottom:18px;">회원 정보 수정</h3>
        <div style="margin-bottom:14px;"><b>이름</b><br><input type="text" value="${member.name}" readonly style="width:100%;background:#f4f8fd;color:#888;border:1.2px solid #eee;border-radius:6px;padding:7px 10px;margin-top:2px;"></div>
        <div style="margin-bottom:14px;"><b>상태</b><br>
          <select id="edit-status" style="width:100%;padding:7px 10px;border-radius:6px;margin-top:2px;">
            <option value="유효"${member.status==='유효'?' selected':''}>유효</option>
            <option value="정지"${member.status==='정지'?' selected':''}>정지</option>
            <option value="만료"${member.status==='만료'?' selected':''}>만료</option>
          </select>
        </div>
        <div style="margin-bottom:14px;"><b>담당 트레이너</b><br>
          <select id="edit-trainer" style="width:100%;padding:7px 10px;border-radius:6px;margin-top:2px;">
            ${trainers.map(t=>`<option value="${t.username}"${member.trainer===t.username?' selected':''}>${t.name}</option>`).join('')}
          </select>
        </div>
        <div style="margin-bottom:14px;"><b>추가 세션</b><br><input id="edit-add-sessions" type="number" min="0" value="0" style="width:100%;border-radius:6px;padding:7px 10px;margin-top:2px;"></div>
        <div id="edit-modal-result" style="min-height:22px;margin-bottom:8px;color:#1976d2;"></div>
        <div style="display:flex;gap:12px;justify-content:flex-end;">
          <button id="edit-modal-save" style="flex:1 1 0;background:var(--primary);color:#fff;">저장</button>
          <button id="edit-modal-cancel" style="flex:1 1 0;background:#eee;color:#1976d2;">닫기</button>
        </div>
      </div>
    `;
    // 닫기 버튼
    document.getElementById('edit-modal-cancel').onclick = function() {
      modalBg.style.display = 'none';
      modalBg.innerHTML = '';
    };
    // 저장 버튼
    document.getElementById('edit-modal-save').onclick = async function() {
      const status = document.getElementById('edit-status').value;
      const trainer = document.getElementById('edit-trainer').value;
      const addSessions = Number(document.getElementById('edit-add-sessions').value)||0;
      const resultDiv = document.getElementById('edit-modal-result');
      resultDiv.style.color = '#1976d2';
      resultDiv.innerText = '처리 중...';
      try {
        const res = await fetch(`/api/members/${encodeURIComponent(member.name)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, trainer, addSessions })
        });
        const result = await res.json();
        if (res.ok) {
          resultDiv.innerText = '저장되었습니다.';
          setTimeout(() => {
            modalBg.style.display = 'none';
            modalBg.innerHTML = '';
            // 회원 관리 탭을 강제로 다시 렌더링
            const tabBar = document.getElementById('tabBar');
            const memberTabBtn = Array.from(tabBar.children).find(btn => btn.textContent === '회원 관리');
            if (memberTabBtn) memberTabBtn.click();
          }, 900);
        } else {
          resultDiv.style.color = '#d32f2f';
          resultDiv.innerText = result.message;
        }
      } catch {
        resultDiv.style.color = '#d32f2f';
        resultDiv.innerText = '수정에 실패했습니다.';
      }
    };
    // 바깥 클릭 시 닫기
    modalBg.onclick = function(e) {
      if (e.target === modalBg) {
        modalBg.style.display = 'none';
        modalBg.innerHTML = '';
      }
    };
  }
} 