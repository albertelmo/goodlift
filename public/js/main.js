import { center } from './center.js';
import { trainer } from './trainer.js';
import { member } from './member.js';
import { adminDayCalendar } from './adminDayCalendar.js';
import { adminWeekCalendar } from './adminWeekCalendar.js';
import { adminStats } from './adminStats.js';

// 회원가입 폼 표시 및 자동 로그인 처리
window.addEventListener('DOMContentLoaded', function() {
    // 자동 로그인: localStorage에 role, name이 있으면 바로 메인화면
    const savedRole = localStorage.getItem('role');
    const savedName = localStorage.getItem('name');
    if (savedRole && savedName) {
        showMainSection(savedRole, savedName);
        document.getElementById('logoutBtn').style.display = 'inline-block';
        document.getElementById('settingsBtn').style.display = 'inline-block';
    } else {
        document.getElementById('logoutBtn').style.display = 'none';
        document.getElementById('settingsBtn').style.display = 'none';
        // 로그인하지 않은 상태에서는 secretBtn 숨김
        const secretBtn = document.getElementById('secretBtn');
        if (secretBtn) {
            secretBtn.style.display = 'none';
        }
    }
    document.getElementById('showSignupBtn').onclick = async function() {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('signupSection').style.display = 'block';
        // 관리자 계정 존재 여부 확인
        const roleSelect = document.getElementById('signup-role');
        const centerRow = document.getElementById('signup-center-row');
        const centerSelect = document.getElementById('signup-center');
        const res = await fetch('/api/admin-exists');
        const data = await res.json();
        if (data.exists) {
            roleSelect.value = 'trainer';
            roleSelect.querySelector('option[value="admin"]').disabled = true;
            roleSelect.querySelector('option[value="trainer"]').disabled = false;
            roleSelect.querySelector('option[value="center"]').disabled = false;
        } else {
            roleSelect.value = 'admin';
            roleSelect.querySelector('option[value="admin"]').disabled = false;
            roleSelect.querySelector('option[value="trainer"]').disabled = false;
            roleSelect.querySelector('option[value="center"]').disabled = false;
        }

        // 센터 목록 로드 함수
        async function loadCentersIntoSelect() {
            try {
                const resp = await fetch('/api/centers');
                const centers = await resp.json();
                centerSelect.innerHTML = '<option value="">센터 선택</option>';
                centers.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.name;
                    opt.textContent = c.name;
                    centerSelect.appendChild(opt);
                });
            } catch (e) {
                // 실패 시 기본 옵션 유지
            }
        }

        // 역할 변경 시 센터 선택 표시/숨김
        const toggleCenterRow = async () => {
            if (roleSelect.value === 'center') {
                centerRow.style.display = 'block';
                await loadCentersIntoSelect();
            } else {
                centerRow.style.display = 'none';
                centerSelect.value = '';
            }
        };
        roleSelect.onchange = toggleCenterRow;
        // 초기 상태 반영
        toggleCenterRow();
    };
    document.getElementById('backToLoginBtn').onclick = function() {
        document.getElementById('signupSection').style.display = 'none';
        document.getElementById('loginSection').style.display = 'block';
        document.getElementById('signupForm').reset();
        document.getElementById('signup-result').innerText = '';
    };
    document.getElementById('mainLogo').onclick = function() { location.reload(); };
    // 로그인 폼 처리
    document.getElementById('loginForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const data = {
            username: document.getElementById('login-username').value,
            password: document.getElementById('login-password').value
        };
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (res.ok && result.role) {
            localStorage.setItem('role', result.role);
            localStorage.setItem('name', result.name);
            localStorage.setItem('username', data.username);
            if (result.center) {
                localStorage.setItem('center', result.center);
            }
            showMainSection(result.role, result.name);
            document.getElementById('logoutBtn').style.display = 'inline-block';
            document.getElementById('settingsBtn').style.display = 'inline-block';
        } else {
            document.getElementById('login-result').innerText = result.message;
        }
    });
    // 회원가입 폼 처리
    document.getElementById('signupForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const password = document.getElementById('signup-password').value;
        const password2 = document.getElementById('signup-password2').value;
        if (password !== password2) {
            document.getElementById('signup-result').innerText = '비밀번호가 일치하지 않습니다.';
            return;
        }
        const role = document.getElementById('signup-role').value;
        const centerValue = document.getElementById('signup-center') ? document.getElementById('signup-center').value : '';
        if (role === 'center' && !centerValue) {
            document.getElementById('signup-result').innerText = '센터관리자 등록 시 센터를 선택해주세요.';
            return;
        }
        const data = {
            username: document.getElementById('signup-username').value,
            password,
            name: document.getElementById('signup-name').value,
            role
        };
        if (role === 'center') {
            data.center = centerValue;
        }
        const res = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        document.getElementById('signup-result').innerText = result.message;
        // 회원가입 성공 시 로그인 폼으로 자동 전환
        if (res.ok) {
            setTimeout(() => {
                document.getElementById('signupSection').style.display = 'none';
                document.getElementById('loginSection').style.display = 'block';
                document.getElementById('signupForm').reset();
                document.getElementById('signup-result').innerText = '';
                document.getElementById('loginForm').reset(); // 로그인 폼도 초기화
                document.getElementById('login-result').innerText = '';
            }, 1200);
        }
    });
    // 로그아웃 처리
    document.getElementById('logoutBtn').innerText = '🚪';
    document.getElementById('logoutBtn').onclick = function() {
        // 로그아웃 확인 메시지
        if (!confirm('정말 로그아웃 하시겠습니까?')) {
            return; // 취소하면 로그아웃하지 않음
        }
        
        document.getElementById('mainSection').style.display = 'none';
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('loginForm').reset();
        document.getElementById('login-result').innerText = '';
        localStorage.removeItem('role');
        localStorage.removeItem('name');
        localStorage.removeItem('username');
        document.getElementById('logoutBtn').style.display = 'none';
        document.getElementById('settingsBtn').style.display = 'none';
    };
    document.getElementById('settingsBtn').onclick = function() {
        // 계정 정보 변경 모달 띄우기 (아래에서 구현)
        showAccountSettingsModal();
    };
});
// 역할별 탭 및 내용 정의
const adminTabs = [
    { label: 'Today', content: '<div id="admin-day-calendar-root"></div>' },
    { label: 'Week', content: '<div id="admin-week-calendar-root"></div>' },
    { label: 'Member', content: '<div class="member-flex-wrap"><div id="member-add"></div><div id="member-list"></div></div>' },
    { label: 'Center', content: `<div style='max-width:400px;margin:0 auto;'>
        <form id="center-add-form" style="display:flex;gap:8px;margin-bottom:18px;">
            <input type="text" id="center-name" placeholder="센터 이름" required style="flex:1;">
            <button type="submit">센터 추가</button>
        </form>
        <div id="center-add-result" style="min-height:24px;margin-bottom:10px;"></div>
        <div id="center-list-loading">센터 목록을 불러오는 중...</div>
        <div id="center-list"></div>
    </div>` },
    { label: 'Trainer', content: '<div id="trainer-list-loading">트레이너 목록을 불러오는 중...</div><div id="trainer-list"></div>' },
    { label: 'Stat', content: '<div id="admin-stats-root"></div>' }
];
const trainerTabs = [
    { label: '📅', content: '<div id="session-calendar"></div>' },
    { label: '👤', content: '<div id="my-member-list"></div>' }
];

// 센터관리자용 탭 (Center, Trainer 탭 제외)
const centerTabs = [
    { label: 'Today', content: '<div id="admin-day-calendar-root"></div>' },
    { label: 'Week', content: '<div id="admin-week-calendar-root"></div>' },
    { label: 'Member', content: '<div class="member-flex-wrap"><div id="member-add"></div><div id="member-list"></div></div>' },
    { label: 'Stat', content: '<div id="admin-stats-root"></div>' }
];
function showMainSection(role, name) {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('mainSection').style.display = 'block';
    document.getElementById('logoutBtn').style.display = 'inline-block';
    
    // 관리자일 때만 secretBtn 표시 (센터관리자는 제외)
    const secretBtn = document.getElementById('secretBtn');
    if (secretBtn) {
        secretBtn.style.display = role === 'admin' ? 'inline-block' : 'none';
    }
    
    let tabs;
    if (role === 'admin') {
        tabs = adminTabs;
    } else if (role === 'center') {
        tabs = centerTabs;
    } else {
        tabs = trainerTabs;
    }
    renderTabs(tabs);
}
function renderTabs(tabs) {
    const tabBar = document.getElementById('tabBar');
    const tabContent = document.getElementById('tabContent');
    tabBar.innerHTML = '';
    tabContent.innerHTML = tabs[0].content;
    tabs.forEach((tab, idx) => {
        const btn = document.createElement('button');
        btn.textContent = tab.label;
        btn.className = idx === 0 ? 'active' : '';
        btn.onclick = function() {
            Array.from(tabBar.children).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            tabContent.innerHTML = tab.content;
            if (tab.label === 'Trainer') {
                trainer.loadList();
            }
            if (tab.label === 'Center') {
                center.setupTab();
            }
            if (tab.label === 'Today') {
                adminDayCalendar.render(document.getElementById('admin-day-calendar-root'));
            }
            if (tab.label === 'Week') {
                adminWeekCalendar.render(document.getElementById('admin-week-calendar-root'));
            }
            if (tab.label === 'Member') {
                member.renderAddForm(document.getElementById('member-add'));
                member.renderList(document.getElementById('member-list'));
            }
            if (tab.label === '내 회원 리스트' || tab.label === '👤') {
                const username = localStorage.getItem('username');
                trainer.renderMyMembers(tabContent.querySelector('#my-member-list') || tabContent, username);
            }
            if (tab.label === '📅') {
                trainer.renderSessionCalendar(tabContent.querySelector('#session-calendar') || tabContent);
            }
            if (tab.label === 'Stat') {
                adminStats.render(tabContent.querySelector('#admin-stats-root') || tabContent);
            }
        };
        tabBar.appendChild(btn);
    });
    if (tabs[0].label === 'Trainer') {
        trainer.loadList();
    }
    if (tabs[0].label === 'Center') {
        center.setupTab();
    }
    if (tabs[0].label === 'Today') {
        adminDayCalendar.render(document.getElementById('admin-day-calendar-root'));
    }
    if (tabs[0].label === 'Week') {
        adminWeekCalendar.render(document.getElementById('admin-week-calendar-root'));
    }
    if (tabs[0].label === 'Member') {
        member.renderAddForm(document.getElementById('member-add'));
        member.renderList(document.getElementById('member-list'));
    }
    if (tabs[0].label === '내 회원 리스트' || tabs[0].label === '👤') {
        const username = localStorage.getItem('username');
        trainer.renderMyMembers(tabContent.querySelector('#my-member-list') || tabContent, username);
    }
    if (tabs[0].label === '📅') {
        trainer.renderSessionCalendar(tabContent.querySelector('#session-calendar') || tabContent);
    }
    if (tabs[0].label === 'Stat') {
        adminStats.render(tabContent.querySelector('#admin-stats-root') || tabContent);
    }
}

function renderSampleScheduler() {
    const root = document.getElementById('scheduler-root');
    if (!root) return;
    // 샘플이 아닌 빈 캘린더 UI만 표시
    const trainers = [];
    const times = [];
    // 상단 헤더
    let html = `<div class="scheduler-wrap">
        <div class="scheduler-header">
            <div class="date-nav">
                <button>&lt;</button>
                <span style="font-size:1.15rem;font-weight:700;">날짜를 선택하세요</span>
                <button>&gt;</button>
            </div>
            <div class="scheduler-legend">
                <span class="legend"><span class="dot dot-reserved"></span>예약</span>
                <span class="legend"><span class="dot dot-pre"></span>미예약</span>
                <span class="legend"><span class="dot dot-attend"></span>출석</span>
                <span class="legend"><span class="dot dot-absent"></span>결석</span>
                <span class="legend"><span class="dot dot-cancel"></span>취소</span>
                <span class="legend"><span class="dot dot-allcancel"></span>전체취소</span>
            </div>
            <div style="margin-left:auto;display:flex;gap:8px;">
                <button style="background:var(--primary);color:#fff;">전체보기</button>
                <button style="background:var(--accent);color:#fff;">현재</button>
            </div>
        </div>
        <div class="scheduler-table-wrap">
            <table class="scheduler-table">
                <thead><tr><th class="time-col"></th></tr></thead><tbody></tbody></table></div></div>`;
    root.innerHTML = html;
}

function showAccountSettingsModal() {
    const modal = document.getElementById('accountSettingsModal');
    const bg = document.getElementById('accountSettingsModalBg');
    modal.style.display = 'block';
    bg.style.display = 'block';
    document.getElementById('changePwForm').reset();
    document.getElementById('changePwResult').innerText = '';
}
document.getElementById('closeAccountSettingsBtn').onclick = function() {
    document.getElementById('accountSettingsModal').style.display = 'none';
    document.getElementById('accountSettingsModalBg').style.display = 'none';
};
document.getElementById('accountSettingsModalBg').onclick = function() {
    document.getElementById('accountSettingsModal').style.display = 'none';
    document.getElementById('accountSettingsModalBg').style.display = 'none';
};
document.getElementById('changePwForm').onsubmit = async function(e) {
    e.preventDefault();
    const currentPw = document.getElementById('currentPw').value;
    const newPw = document.getElementById('newPw').value;
    const newPw2 = document.getElementById('newPw2').value;
    if (!currentPw || !newPw || !newPw2) {
        document.getElementById('changePwResult').innerText = '모든 항목을 입력하세요.';
        return;
    }
    if (newPw !== newPw2) {
        document.getElementById('changePwResult').innerText = '새 비밀번호가 일치하지 않습니다.';
        return;
    }
    // 서버에 비밀번호 변경 요청 (API는 추후 구현 필요)
    const username = localStorage.getItem('username');
    const res = await fetch('/api/change-password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, currentPw, newPw })
    });
    const result = await res.json();
    if (res.ok) {
        document.getElementById('changePwResult').style.color = '#1976d2';
        document.getElementById('changePwResult').innerText = '비밀번호가 변경되었습니다.';
        setTimeout(() => {
            document.getElementById('accountSettingsModal').style.display = 'none';
            document.getElementById('accountSettingsModalBg').style.display = 'none';
        }, 1200);
    } else {
        document.getElementById('changePwResult').style.color = '#d32f2f';
        document.getElementById('changePwResult').innerText = result.message || '비밀번호 변경에 실패했습니다.';
    }
}; 