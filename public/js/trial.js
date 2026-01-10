export const trial = {
  render
};

// 현재 년월 가져오기 (YYYY-MM 형식)
function getCurrentYearMonth() {
  const now = new Date();
  const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  const year = koreanTime.getFullYear();
  const month = String(koreanTime.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function render(container) {
  if (!container) return;
  
  const currentYearMonth = getCurrentYearMonth();
  
  container.innerHTML = `
    <div style="max-width:1200px;margin:0 auto;padding:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
        <h3 style="margin:0;color:#1976d2;font-size:1.2rem;">신규 상담 현황</h3>
        <div style="display:flex;align-items:center;gap:8px;">
          <input type="month" id="trial-year-month" value="${currentYearMonth}" style="padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;">
          <button id="trial-load-btn" style="background:#1976d2;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:0.9rem;">조회</button>
        </div>
      </div>
      <div id="trial-loading" style="text-align:center;padding:40px;color:#888;display:none;">불러오는 중...</div>
      <div id="trial-content"></div>
    </div>
  `;
  
  // 센터 순서 가져오기
  fetch('/api/centers')
    .then(r => r.json())
    .then(centers => {
      const centerOrder = centers.map(c => c.name);
      loadTrialSessions(currentYearMonth, centerOrder);
    })
    .catch(err => {
      console.error('센터 목록 조회 오류:', err);
      loadTrialSessions(currentYearMonth, []);
    });
  
  // 조회 버튼 클릭 이벤트
  document.getElementById('trial-load-btn').addEventListener('click', () => {
    const yearMonth = document.getElementById('trial-year-month').value;
    if (!yearMonth) {
      alert('년월을 선택해주세요.');
      return;
    }
    fetch('/api/centers')
      .then(r => r.json())
      .then(centers => {
        const centerOrder = centers.map(c => c.name);
        loadTrialSessions(yearMonth, centerOrder);
      })
      .catch(err => {
        console.error('센터 목록 조회 오류:', err);
        loadTrialSessions(yearMonth, []);
      });
  });
}

function loadTrialSessions(yearMonth, centerOrder) {
  const loadingEl = document.getElementById('trial-loading');
  const contentEl = document.getElementById('trial-content');
  
  loadingEl.style.display = 'block';
  contentEl.innerHTML = '';
  
  fetch(`/api/trial-sessions?yearMonth=${yearMonth}`)
    .then(r => r.json())
    .then(data => {
      loadingEl.style.display = 'none';
      renderTrialSessions(data, centerOrder);
    })
    .catch(err => {
      loadingEl.style.display = 'none';
      contentEl.innerHTML = `<div style="text-align:center;padding:40px;color:#d32f2f;">데이터를 불러오지 못했습니다.</div>`;
      console.error('신규 상담 조회 오류:', err);
    });
}

function renderTrialSessions(data, centerOrder) {
  const contentEl = document.getElementById('trial-content');
  const centers = data.centers || {};
  
  if (Object.keys(centers).length === 0) {
    contentEl.innerHTML = `<div style="text-align:center;padding:40px;color:#888;">${data.yearMonth}에 신규 상담이 없습니다.</div>`;
    return;
  }
  
  // 센터 순서대로 정렬
  const sortedCenters = centerOrder.length > 0
    ? Object.keys(centers).sort((a, b) => {
        const indexA = centerOrder.indexOf(a);
        const indexB = centerOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b, 'ko');
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      })
    : Object.keys(centers).sort((a, b) => a.localeCompare(b, 'ko'));
  
  let html = '';
  
  sortedCenters.forEach(center => {
    const sessions = centers[center];
    const completedCount = sessions.filter(s => s.status === '완료').length;
    const scheduledCount = sessions.filter(s => s.status === '예정').length;
    const absentCount = sessions.filter(s => s.status !== '완료' && new Date(s.date) < new Date()).length;
    
    html += `
      <div style="margin-bottom:24px;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
        <div style="background:#1976d2;color:#fff;padding:12px 16px;font-weight:600;font-size:1rem;">
          ${center}
          <span style="margin-left:12px;font-size:0.85rem;font-weight:normal;opacity:0.9;">
            (총 ${sessions.length}개 - 완료: ${completedCount}, 예정: ${scheduledCount}, 결석: ${absentCount})
          </span>
        </div>
        <div style="padding:0;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f5f5f5;">
                <th style="padding:10px 8px;text-align:left;font-size:0.85rem;font-weight:600;color:#333;border-bottom:1px solid #ddd;">날짜</th>
                <th style="padding:10px 8px;text-align:left;font-size:0.85rem;font-weight:600;color:#333;border-bottom:1px solid #ddd;">시간</th>
                <th style="padding:10px 8px;text-align:left;font-size:0.85rem;font-weight:600;color:#333;border-bottom:1px solid #ddd;">회원명</th>
                <th style="padding:10px 8px;text-align:left;font-size:0.85rem;font-weight:600;color:#333;border-bottom:1px solid #ddd;">트레이너</th>
                <th style="padding:10px 8px;text-align:left;font-size:0.85rem;font-weight:600;color:#333;border-bottom:1px solid #ddd;">상태</th>
              </tr>
            </thead>
            <tbody>
              ${sessions.map(session => {
                const date = new Date(session.date);
                const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                let statusColor = '#666';
                if (session.status === '완료') statusColor = '#2e7d32';
                else if (session.status === '예정') statusColor = '#1976d2';
                else statusColor = '#d32f2f';
                
                return `
                  <tr style="border-bottom:1px solid #f0f0f0;">
                    <td style="padding:10px 8px;font-size:0.9rem;">${dateStr}</td>
                    <td style="padding:10px 8px;font-size:0.9rem;">${session.time}</td>
                    <td style="padding:10px 8px;font-size:0.9rem;">${session.member}</td>
                    <td style="padding:10px 8px;font-size:0.9rem;">${session.trainer}</td>
                    <td style="padding:10px 8px;font-size:0.9rem;color:${statusColor};font-weight:500;">${session.status}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  });
  
  contentEl.innerHTML = html;
}
