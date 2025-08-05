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
    <div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <button id="send-contract-btn" style="background:transparent;color:#1976d2;border:none;padding:6px;border-radius:6px;cursor:pointer;font-size:0.9rem;width:32px;height:36px;display:flex;align-items:center;justify-content:center;margin-top:0;" title="계약서 전송">
          📄
        </button>
        <button id="import-excel-btn" style="background:transparent;color:#1976d2;border:none;padding:6px;border-radius:6px;cursor:pointer;font-size:0.9rem;width:32px;height:36px;display:flex;align-items:center;justify-content:center;margin-top:0;" title="엑셀 파일 업로드">
          📊
        </button>

      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <button id="export-members-btn" style="background:transparent;color:#1976d2;border:none;padding:6px;border-radius:6px;cursor:pointer;font-size:1.2rem;width:32px;height:36px;display:flex;align-items:center;justify-content:center;margin-top:0;" title="엑셀 다운로드">
          ⬇️
        </button>
        <select id="search-type" style="padding:6px 6px;font-size:0.9rem;border:1.2px solid #bbb;border-radius:6px;width:90px;">
          <option value="name">이름</option>
          <option value="trainer">트레이너</option>
          <option value="center">센터</option>
        </select>
        <input id="member-search-input" type="text" placeholder="검색어 입력" style="padding:6px 10px;font-size:0.97rem;border:1.2px solid #bbb;border-radius:6px;width:160px;">
      </div>
    </div>
    <div id="member-table-wrap"></div>
    <div id="member-edit-modal-bg" style="display:none;"></div>
  `;
  const tableWrap = container.querySelector('#member-table-wrap');
  let allMembers = [];
  let trainers = [];
  let sortColumn = null;
  let sortDirection = 'asc'; // 'asc' 또는 'desc'
  let currentDisplayedMembers = []; // 현재 표시된 회원 목록 추적
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
    
    // 정렬 적용
    if (sortColumn) {
      members.sort((a, b) => {
        let aVal = a[sortColumn];
        let bVal = b[sortColumn];
        
        // 특별한 처리
        if (sortColumn === 'trainer') {
          aVal = tMap[a.trainer] || a.trainer;
          bVal = tMap[b.trainer] || b.trainer;
        } else if (sortColumn === 'gender') {
          aVal = a.gender === 'male' ? '남성' : a.gender === 'female' ? '여성' : '';
          bVal = b.gender === 'male' ? '남성' : b.gender === 'female' ? '여성' : '';
        } else if (sortColumn === 'remainSessions') {
          aVal = a.remainSessions !== undefined ? a.remainSessions : -1;
          bVal = b.remainSessions !== undefined ? b.remainSessions : -1;
        }
        
        // 숫자 정렬
        if (['sessions', 'remainSessions'].includes(sortColumn)) {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        // 문자열 정렬
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        
        return 0;
      });
    }
    
    let html = `<table style="width:100%;border-collapse:collapse;margin-top:18px;">
      <thead><tr>
        <th class="sortable-header" data-column="name" style="text-align:center;cursor:pointer;padding:8px 4px;border-bottom:1.5px solid #b6c6e3;">
          이름 ${getSortIcon('name')}
        </th>
        <th class="sortable-header" data-column="gender" style="text-align:center;cursor:pointer;padding:8px 4px;border-bottom:1.5px solid #b6c6e3;">
          성별 ${getSortIcon('gender')}
        </th>
        <th class="sortable-header" data-column="phone" style="text-align:center;cursor:pointer;padding:8px 4px;border-bottom:1.5px solid #b6c6e3;">
          전화번호 ${getSortIcon('phone')}
        </th>
        <th class="sortable-header" data-column="trainer" style="text-align:center;cursor:pointer;padding:8px 4px;border-bottom:1.5px solid #b6c6e3;">
          담당 트레이너 ${getSortIcon('trainer')}
        </th>
        <th class="sortable-header" data-column="center" style="text-align:center;cursor:pointer;padding:8px 4px;border-bottom:1.5px solid #b6c6e3;">
          센터 ${getSortIcon('center')}
        </th>
        <th class="sortable-header" data-column="regdate" style="text-align:center;cursor:pointer;padding:8px 4px;border-bottom:1.5px solid #b6c6e3;">
          등록일 ${getSortIcon('regdate')}
        </th>
        <th class="sortable-header" data-column="sessions" style="text-align:center;cursor:pointer;padding:8px 4px;border-bottom:1.5px solid #b6c6e3;">
          세션 수 ${getSortIcon('sessions')}
        </th>
        <th class="sortable-header" data-column="remainSessions" style="text-align:center;cursor:pointer;padding:8px 4px;border-bottom:1.5px solid #b6c6e3;">
          잔여세션 ${getSortIcon('remainSessions')}
        </th>
        <th class="sortable-header" data-column="status" style="text-align:center;cursor:pointer;padding:8px 4px;border-bottom:1.5px solid #b6c6e3;">
          상태 ${getSortIcon('status')}
        </th>
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
    
    // 현재 표시된 회원 목록 업데이트
    currentDisplayedMembers = members;
    
    // 헤더 클릭 이벤트 (정렬)
    tableWrap.querySelectorAll('.sortable-header').forEach(header => {
      header.addEventListener('click', function() {
        const column = this.getAttribute('data-column');
        if (sortColumn === column) {
          // 같은 칼럼 클릭 시 방향 전환
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          // 다른 칼럼 클릭 시 오름차순으로 설정
          sortColumn = column;
          sortDirection = 'asc';
        }
        renderTable(members);
      });
    });
    
    // 행 클릭 이벤트(모달)
    tableWrap.querySelectorAll('.member-row').forEach(row => {
      row.addEventListener('click', function() {
        const idx = this.getAttribute('data-idx');
        showEditModal(members[idx]);
      });
    });
  }
  
  // 정렬 아이콘 생성 함수
  function getSortIcon(column) {
    if (sortColumn !== column) {
      return '<span style="color:#ccc;font-size:0.8em;">↕</span>';
    }
    return sortDirection === 'asc' 
      ? '<span style="color:#1976d2;font-size:0.8em;">↑</span>' 
      : '<span style="color:#1976d2;font-size:0.8em;">↓</span>';
  }
  // 검색 이벤트
  container.querySelector('#member-search-input').addEventListener('input', function() {
    const keyword = this.value.trim();
    const searchType = container.querySelector('#search-type').value;
    
    if (!keyword) {
      renderTable(allMembers);
    } else {
      const filtered = allMembers.filter(m => {
        switch (searchType) {
          case 'name':
            return m.name.includes(keyword);
          case 'trainer':
            const trainerName = trainers.find(t => t.username === m.trainer)?.name || m.trainer;
            return trainerName.includes(keyword);
          case 'center':
            return m.center.includes(keyword);
          default:
            return m.name.includes(keyword);
        }
      });
      renderTable(filtered);
    }
  });
  
  // 검색 타입 변경 이벤트
  container.querySelector('#search-type').addEventListener('change', function() {
    const searchInput = container.querySelector('#member-search-input');
    const keyword = searchInput.value.trim();
    
    if (keyword) {
      // 검색어가 있으면 즉시 재검색
      const searchType = this.value;
      const filtered = allMembers.filter(m => {
        switch (searchType) {
          case 'name':
            return m.name.includes(keyword);
          case 'trainer':
            const trainerName = trainers.find(t => t.username === m.trainer)?.name || m.trainer;
            return trainerName.includes(keyword);
          case 'center':
            return m.center.includes(keyword);
          default:
            return m.name.includes(keyword);
        }
      });
      renderTable(filtered);
    }
  });
  
  // 엑셀 다운로드 버튼 이벤트
  container.querySelector('#export-members-btn').addEventListener('click', async function() {
    if (currentDisplayedMembers.length === 0) {
      alert('다운로드할 회원이 없습니다.');
      return;
    }
    
    // 확인 메시지 추가
    const confirmDownload = confirm(`현재 표시된 ${currentDisplayedMembers.length}명의 회원 정보를 다운로드하시겠습니까?`);
    if (!confirmDownload) {
      return;
    }
    
    try {
      const res = await fetch('/api/members/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members: currentDisplayedMembers })
      });
      
      if (res.ok) {
        // CSV 파일 다운로드
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '회원목록.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const result = await res.json();
        alert(result.message || '다운로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('다운로드 오류:', error);
      alert('다운로드에 실패했습니다.');
    }
  });
  // 회원 정보 수정 모달
  function showEditModal(member) {
    const modalBg = document.getElementById('member-edit-modal-bg');
    modalBg.style.display = 'block';
    modalBg.innerHTML = `
      <div id="member-edit-modal" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;border-radius:14px;box-shadow:0 4px 32px #1976d240;padding:24px 20px;z-index:1002;min-width:260px;max-width:96vw;max-height:80vh;overflow-y:auto;">
        <h3 style="color:var(--primary);margin-top:0;margin-bottom:18px;">회원 정보 수정</h3>
        <div style="margin-bottom:10px;"><b>이름</b><br><input type="text" value="${member.name}" readonly style="width:100%;background:#f4f8fd;color:#888;border:1.2px solid #eee;border-radius:6px;padding:6px 8px;margin-top:2px;"></div>
        <div style="margin-bottom:10px;"><b>전화번호</b><br><input id="edit-phone" type="tel" value="${member.phone || ''}" pattern="[0-9\-]+" placeholder="010-1234-5678" style="width:100%;border-radius:6px;padding:6px 8px;margin-top:2px;"></div>
        <div style="margin-bottom:10px;"><b>성별</b><br>
          <select id="edit-gender" style="width:100%;padding:6px 8px;border-radius:6px;margin-top:2px;">
            <option value="male"${member.gender==='male'?' selected':''}>남성</option>
            <option value="female"${member.gender==='female'?' selected':''}>여성</option>
          </select>
        </div>
        <div style="margin-bottom:10px;"><b>센터</b><br>
          <select id="edit-center" style="width:100%;padding:6px 8px;border-radius:6px;margin-top:2px;">
            <option value="">불러오는 중...</option>
          </select>
        </div>
        <div style="margin-bottom:10px;"><b>상태</b><br>
          <select id="edit-status" style="width:100%;padding:6px 8px;border-radius:6px;margin-top:2px;">
            <option value="유효"${member.status==='유효'?' selected':''}>유효</option>
            <option value="정지"${member.status==='정지'?' selected':''}>정지</option>
            <option value="만료"${member.status==='만료'?' selected':''}>만료</option>
          </select>
        </div>
        <div style="margin-bottom:10px;"><b>담당 트레이너</b><br>
          <select id="edit-trainer" style="width:100%;padding:6px 8px;border-radius:6px;margin-top:2px;">
            ${trainers.map(t=>`<option value="${t.username}"${member.trainer===t.username?' selected':''}>${t.name}</option>`).join('')}
          </select>
        </div>
        <div style="margin-bottom:10px;"><b>추가 세션</b><br><input id="edit-add-sessions" type="number" min="0" value="0" style="width:100%;border-radius:6px;padding:6px 8px;margin-top:2px;"></div>
        <div id="edit-modal-result" style="min-height:22px;margin-bottom:8px;color:#1976d2;"></div>
        <div style="display:flex;gap:12px;justify-content:flex-end;">
          <button id="edit-modal-save" style="flex:1 1 0;background:var(--primary);color:#fff;">저장</button>
          <button id="edit-modal-cancel" style="flex:1 1 0;background:#eee;color:#1976d2;">닫기</button>
        </div>
      </div>
    `;

    // 센터 드롭다운 로딩
    fetch('/api/centers').then(r=>r.json()).then(centers=>{
      const centerSel = document.getElementById('edit-center');
      centerSel.innerHTML = '<option value="">선택</option>' + centers.map(c=>`<option value="${c.name}"${member.center===c.name?' selected':''}>${c.name}</option>`).join('');
    });

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
      const gender = document.getElementById('edit-gender').value;
      const center = document.getElementById('edit-center').value;
      const phone = document.getElementById('edit-phone').value;
      const resultDiv = document.getElementById('edit-modal-result');
      resultDiv.style.color = '#1976d2';
      resultDiv.innerText = '처리 중...';
      try {
        const res = await fetch(`/api/members/${encodeURIComponent(member.name)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, trainer, addSessions, gender, center, phone })
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

  // 계약서 전송 버튼 이벤트
  document.getElementById('send-contract-btn').onclick = function() {
    showContractModal();
  };

  // 엑셀 업로드 버튼 이벤트
  document.getElementById('import-excel-btn').onclick = function() {
    showExcelImportModal();
  };



  // 계약서 미리보기 모달
  function showContractModal() {
    const modalBg = document.getElementById('member-edit-modal-bg');
    modalBg.style.display = 'block';
    modalBg.innerHTML = `
      <div id="contract-modal" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;border-radius:14px;box-shadow:0 4px 32px #1976d240;padding:32px 24px;z-index:1002;min-width:600px;max-width:90vw;max-height:80vh;overflow-y:auto;">
        <h3 style="color:var(--primary);margin-top:0;margin-bottom:18px;">📄 계약서</h3>
        <div style="margin-bottom:20px;border:1px solid #ddd;border-radius:8px;padding:16px;background:#f9f9f9;">
          <h4 style="margin-top:0;color:#333;">피트니스 계약서</h4>
          <div id="contract-content" style="line-height:1.2;color:#555;font-size:12px;">
            계약서를 불러오는 중...
          </div>
        </div>
        <div id="contract-modal-result" style="min-height:22px;margin-bottom:8px;color:#1976d2;"></div>
        <div style="display:flex;gap:12px;justify-content:flex-end;">
          <button id="contract-modal-send" style="flex:1 1 0;background:var(--primary);color:#fff;">이메일로 전송</button>
          <button id="contract-modal-cancel" style="flex:1 1 0;background:#eee;color:#1976d2;">닫기</button>
        </div>
      </div>
    `;

    // 계약서 내용 로드
    loadContractContent();

    // 닫기 버튼
    document.getElementById('contract-modal-cancel').onclick = function() {
      modalBg.style.display = 'none';
      modalBg.innerHTML = '';
    };

    // 이메일 전송 버튼
    document.getElementById('contract-modal-send').onclick = function() {
      showEmailInputModal();
    };

    // 바깥 클릭 시 닫기
    modalBg.onclick = function(e) {
      if (e.target === modalBg) {
        modalBg.style.display = 'none';
        modalBg.innerHTML = '';
      }
    };
  }

  // 계약서 내용 로드 함수
  async function loadContractContent() {
    const contentDiv = document.getElementById('contract-content');
    
    try {
      const res = await fetch('/api/contract/content');
      const result = await res.json();
      
      if (res.ok) {
        contentDiv.innerHTML = result.content || '계약서 내용을 불러올 수 없습니다.';
      } else {
        contentDiv.innerHTML = '계약서 내용을 불러오는데 실패했습니다.';
      }
    } catch (error) {
      console.error('계약서 내용 로드 오류:', error);
      contentDiv.innerHTML = '계약서 내용을 불러오는데 실패했습니다.';
    }
  }

  // 이메일 입력 모달
  function showEmailInputModal() {
    const modalBg = document.getElementById('member-edit-modal-bg');
    modalBg.innerHTML = `
      <div id="email-modal" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;border-radius:14px;box-shadow:0 4px 32px #1976d240;padding:32px 24px;z-index:1002;min-width:300px;max-width:96vw;">
        <h3 style="color:var(--primary);margin-top:0;margin-bottom:18px;">📧 이메일 전송</h3>
        <div style="margin-bottom:14px;">
          <b>이메일 주소</b><br>
          <input type="email" id="contract-email" placeholder="example@email.com" style="width:100%;border-radius:6px;padding:7px 10px;margin-top:2px;border:1.2px solid #ddd;">
        </div>
        <div id="email-modal-result" style="min-height:22px;margin-bottom:8px;color:#1976d2;"></div>
        <div style="display:flex;gap:12px;justify-content:flex-end;">
          <button id="email-modal-send" style="flex:1 1 0;background:var(--primary);color:#fff;">전송</button>
          <button id="email-modal-cancel" style="flex:1 1 0;background:#eee;color:#1976d2;">취소</button>
        </div>
      </div>
    `;

    // 취소 버튼
    document.getElementById('email-modal-cancel').onclick = function() {
      modalBg.style.display = 'none';
      modalBg.innerHTML = '';
    };

    // 전송 버튼
    document.getElementById('email-modal-send').onclick = async function() {
      const email = document.getElementById('contract-email').value.trim();
      const resultDiv = document.getElementById('email-modal-result');
      
      if (!email) {
        resultDiv.style.color = '#d32f2f';
        resultDiv.innerText = '이메일 주소를 입력해주세요.';
        return;
      }

      if (!email.includes('@')) {
        resultDiv.style.color = '#d32f2f';
        resultDiv.innerText = '올바른 이메일 주소를 입력해주세요.';
        return;
      }

      resultDiv.style.color = '#1976d2';
      resultDiv.innerText = '계약서를 전송 중입니다...';

      try {
        const res = await fetch('/api/email/contract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipientEmail: email })
        });
        
        const result = await res.json();
        
        if (res.ok) {
          resultDiv.style.color = '#2e7d32';
          resultDiv.innerText = '계약서가 성공적으로 전송되었습니다!';
          setTimeout(() => {
            modalBg.style.display = 'none';
            modalBg.innerHTML = '';
          }, 2000);
        } else {
          resultDiv.style.color = '#d32f2f';
          resultDiv.innerText = result.message || '계약서 전송에 실패했습니다.';
        }
      } catch (error) {
        console.error('계약서 전송 오류:', error);
        resultDiv.style.color = '#d32f2f';
        resultDiv.innerText = '계약서 전송에 실패했습니다.';
      }
    };

    // 바깥 클릭 시 닫기
    modalBg.onclick = function(e) {
      if (e.target === modalBg) {
        modalBg.style.display = 'none';
        modalBg.innerHTML = '';
      }
    };

    // Enter 키로 전송
    document.getElementById('contract-email').onkeypress = function(e) {
      if (e.key === 'Enter') {
        document.getElementById('email-modal-send').click();
      }
    };
  }

  // 엑셀 파일 업로드 모달
  function showExcelImportModal() {
    const modalBg = document.getElementById('member-edit-modal-bg');
    modalBg.style.display = 'block';
    modalBg.innerHTML = `
      <div id="excel-import-modal" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;border-radius:14px;box-shadow:0 4px 32px #1976d240;padding:32px 24px;z-index:1002;min-width:400px;max-width:96vw;">
        <h3 style="color:var(--primary);margin-top:0;margin-bottom:18px;">📊 엑셀 파일 업로드</h3>
        <div style="margin-bottom:14px;">
          <p style="margin:0 0 10px 0;font-size:0.9rem;color:#666;"><strong>필수 컬럼:</strong> 이름, 전화번호, 담당트레이너, 세션수</p>
          <p style="margin:0 0 10px 0;font-size:0.9rem;color:#666;"><strong>선택 컬럼:</strong> 성별, 센터, 등록일</p>
          <p style="margin:0 0 10px 0;font-size:0.9rem;color:#666;"><strong>기본값:</strong> 성별(여성), 센터(첫번째센터), 등록일(오늘)</p>
          <p style="margin:0 0 10px 0;font-size:0.9rem;color:#666;">성별: 남성/여성 또는 male/female</p>
          <p style="margin:0 0 10px 0;font-size:0.9rem;color:#666;">등록일: YYYY-MM-DD 형식</p>
          <p style="margin:0 0 10px 0;font-size:0.9rem;color:#666;"><strong>주의:</strong> 담당트레이너는 시스템에 등록된 트레이너명과 정확히 일치해야 합니다.</p>
        </div>
        <div style="margin-bottom:14px;">
          <input type="file" id="excel-file" accept=".xlsx,.xls" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;">
        </div>
        <div id="excel-import-result" style="min-height:22px;margin-bottom:8px;color:#1976d2;"></div>
        <div style="display:flex;gap:12px;justify-content:flex-end;">
          <button id="excel-import-upload" style="flex:1 1 0;background:var(--primary);color:#fff;">업로드</button>
          <button id="excel-import-cancel" style="flex:1 1 0;background:#eee;color:#1976d2;">취소</button>
        </div>
      </div>
    `;

    // 취소 버튼
    document.getElementById('excel-import-cancel').onclick = function() {
      modalBg.style.display = 'none';
      modalBg.innerHTML = '';
    };

    // 업로드 버튼
    document.getElementById('excel-import-upload').onclick = async function() {
      const fileInput = document.getElementById('excel-file');
      const resultDiv = document.getElementById('excel-import-result');
      
      if (!fileInput.files[0]) {
        resultDiv.style.color = '#d32f2f';
        resultDiv.innerText = '파일을 선택해주세요.';
        return;
      }

      const file = fileInput.files[0];
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        resultDiv.style.color = '#d32f2f';
        resultDiv.innerText = '엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.';
        return;
      }

      resultDiv.style.color = '#1976d2';
      resultDiv.innerText = '파일을 업로드 중입니다...';

      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/members/import', {
          method: 'POST',
          body: formData
        });
        
        const result = await res.json();
        
        if (res.ok) {
          resultDiv.style.color = '#2e7d32';
          resultDiv.innerHTML = `
            <div>✅ ${result.message}</div>
            <div style="font-size:0.9rem;margin-top:5px;">
              총 ${result.summary.total}개 중 ${result.summary.success}개 성공, ${result.summary.failed}개 실패
            </div>
          `;
          
          setTimeout(() => {
            modalBg.style.display = 'none';
            modalBg.innerHTML = '';
            // 회원 목록 새로고침
            member.renderList(document.getElementById('member-list'));
          }, 3000);
        } else {
          resultDiv.style.color = '#d32f2f';
          if (result.failedMembers && result.failedMembers.length > 0) {
            // 중복 회원명 등 실패한 회원들 표시
            const errorMessages = result.failedMembers.map(failed => 
              `❌ ${failed.error}`
            );
            resultDiv.innerHTML = `
              <div>❌ ${result.message}</div>
              <div style="font-size:0.8rem;margin-top:5px;max-height:150px;overflow-y:auto;border:1px solid #ffcdd2;padding:8px;background:#ffebee;border-radius:4px;">
                <strong>실패한 회원들:</strong><br>
                ${errorMessages.slice(0, 10).join('<br>')}
                ${errorMessages.length > 10 ? `<br>... 외 ${errorMessages.length - 10}개 실패` : ''}
              </div>
            `;
          } else if (result.errors && result.errors.length > 0) {
            // 기존 데이터 검증 에러들 표시
            resultDiv.innerHTML = `
              <div>❌ ${result.message}</div>
              <div style="font-size:0.8rem;margin-top:5px;max-height:100px;overflow-y:auto;">
                ${result.errors.slice(0, 5).join('<br>')}
                ${result.errors.length > 5 ? `<br>... 외 ${result.errors.length - 5}개 오류` : ''}
              </div>
            `;
          } else {
            resultDiv.innerText = result.message || '업로드에 실패했습니다.';
          }
        }
      } catch (error) {
        console.error('엑셀 업로드 오류:', error);
        resultDiv.style.color = '#d32f2f';
        resultDiv.innerText = '업로드에 실패했습니다.';
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