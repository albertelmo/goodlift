// 연간 운동 요약 모달

import { getWorkoutYearSummary } from '../api.js';
import { escapeHtml, showLoading, showError } from '../utils.js';
import { getCurrentMonth } from './calendar.js';

/**
 * 연간 운동 요약 모달 표시
 * @param {string} appUserId
 * @param {number|null} year - null이면 캘린더 현재 연도
 */
export async function showWorkoutYearSummaryModal(appUserId, year = null) {
    const summaryYear = year || getCurrentMonth().getFullYear();

    const modalHtml = `
        <div class="app-modal-bg" id="workout-summary-modal-bg">
            <div class="app-modal" id="workout-summary-modal">
                <div class="app-modal-header">
                    <h2>${summaryYear}년 전체</h2>
                    <button class="app-modal-close-btn" id="workout-summary-modal-close" type="button" aria-label="닫기">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="app-modal-content workout-summary-modal-content">
                    <div id="workout-summary-container"></div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('workout-summary-modal-bg')?.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modalBg = document.getElementById('workout-summary-modal-bg');
    const modal = document.getElementById('workout-summary-modal');
    const closeBtn = document.getElementById('workout-summary-modal-close');
    const content = document.getElementById('workout-summary-container');

    setTimeout(() => {
        modalBg.classList.add('app-modal-show');
        modal.classList.add('app-modal-show');
    }, 10);

    const closeModal = () => {
        modalBg.classList.remove('app-modal-show');
        modal.classList.remove('app-modal-show');
        document.removeEventListener('keydown', escHandler);
        setTimeout(() => modalBg.remove(), 300);
    };

    closeBtn.addEventListener('click', closeModal);
    modalBg.addEventListener('click', (e) => {
        if (e.target === modalBg) closeModal();
    });

    const escHandler = (e) => {
        if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escHandler);

    if (content) showLoading(content);

    try {
        const summary = await getWorkoutYearSummary(appUserId, summaryYear);
        if (content) renderWorkoutYearSummary(content, summary);
    } catch (error) {
        console.error('연간 운동 요약 조회 오류:', error);
        if (content) showError(content, '운동 요약을 불러오는 중 오류가 발생했습니다.');
    }
}

function renderWorkoutYearSummary(container, summary) {
    if (!container) return;

    const year = summary?.year || '';
    const completedDays = summary?.workout_completed_days || 0;
    const totalRecords = summary?.total_records || 0;
    const items = Array.isArray(summary?.by_workout_type) ? summary.by_workout_type : [];

    let listHtml = '';
    if (items.length === 0) {
        listHtml = '<div class="workout-summary-empty">등록된 운동기록이 없습니다.</div>';
    } else {
        listHtml = items.map(item => `
            <div class="workout-summary-row">
                <span class="workout-summary-name">${escapeHtml(item.name || '기타')}</span>
                <span class="workout-summary-count">${item.count || 0}회</span>
            </div>
        `).join('');
    }

    container.innerHTML = `
        <div class="workout-summary-highlight">
            <span class="workout-summary-highlight-label">${year}년 오운완</span>
            <span class="workout-summary-highlight-value">${completedDays}일</span>
        </div>
        <div class="workout-summary-section">
            <div class="workout-summary-section-title">운동종류별 <span class="workout-summary-total">총 ${totalRecords}회</span></div>
            <div class="workout-summary-list">${listHtml}</div>
        </div>
    `;
}
