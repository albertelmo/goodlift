// 앱 유저 홈/대시보드 화면

import { formatDate, getToday, escapeHtml } from './utils.js';

let currentUser = null;

/**
 * 대시보드 초기화
 */
export function init(userData) {
    currentUser = userData;
    render();
}

/**
 * 대시보드 렌더링
 */
function render() {
    const container = document.getElementById('app-user-content');
    if (!container) return;

    const today = getToday();
    
    container.innerHTML = `
        <div class="app-dashboard">
            <div class="app-dashboard-header">
                <h1 class="app-dashboard-title">안녕하세요, ${escapeHtml(currentUser?.name || '회원')}님 👋</h1>
                <p class="app-dashboard-subtitle">${formatDate(new Date())}</p>
            </div>
            
            <div class="app-dashboard-cards">
                <div class="app-card app-card-primary">
                    <div class="app-card-icon">💪</div>
                    <div class="app-card-content">
                        <h3>오늘의 운동</h3>
                        <p class="app-card-value">준비 중입니다</p>
                    </div>
                </div>
                
                <div class="app-card app-card-secondary">
                    <div class="app-card-icon">🍎</div>
                    <div class="app-card-content">
                        <h3>오늘의 식단</h3>
                        <p class="app-card-value">준비 중입니다</p>
                    </div>
                </div>
            </div>
            
            <div class="app-dashboard-stats">
                <div class="app-stat-item">
                    <p class="app-stat-label">주간 운동 시간</p>
                    <p class="app-stat-value">0분</p>
                </div>
                <div class="app-stat-item">
                    <p class="app-stat-label">주간 소모 칼로리</p>
                    <p class="app-stat-value">0kcal</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * 대시보드 새로고침
 */
export function refresh() {
    render();
}
