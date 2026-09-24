// 체중 입력 모달 (하루 1회 upsert)

import { getToday } from '../utils.js';
import { getBodyWeightByDate, upsertBodyWeightRecord } from '../api.js';

/**
 * @param {string} appUserId
 * @param {string|null} selectedDate YYYY-MM-DD
 * @param {() => void} [onSuccess]
 */
export async function showBodyWeightInputModal(appUserId, selectedDate = null, onSuccess) {
    const existingModals = document.querySelectorAll('.app-modal-bg');
    existingModals.forEach(modal => {
        if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    });

    const defaultDate = selectedDate || getToday();

    const modalHtml = `
        <div class="app-modal-bg" id="diet-weight-input-modal-bg">
            <div class="app-modal app-modal-medium" id="diet-weight-input-modal">
                <div class="app-modal-header">
                    <h2>체중 입력</h2>
                    <button type="button" class="app-modal-close-btn" id="diet-weight-input-modal-close" aria-label="닫기">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="app-modal-content">
                    <form id="diet-weight-input-form">
                        <div class="app-form-group">
                            <label for="diet-weight-record-date">날짜</label>
                            <input type="date" id="diet-weight-record-date" name="record_date" value="${defaultDate}" required>
                        </div>
                        <div class="app-form-group">
                            <label for="diet-weight-kg">체중 (kg)</label>
                            <input type="number" id="diet-weight-kg" name="weight_kg" inputmode="decimal" step="0.1" min="20" max="300"
                                placeholder="예: 70.5" required>
                        </div>
                        <div class="app-form-actions">
                            <button type="submit" class="app-btn-primary app-btn-full" id="diet-weight-input-submit">저장</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const bg = document.getElementById('diet-weight-input-modal-bg');
    const modal = document.getElementById('diet-weight-input-modal');
    const closeBtn = document.getElementById('diet-weight-input-modal-close');
    const form = document.getElementById('diet-weight-input-form');
    const dateInput = document.getElementById('diet-weight-record-date');
    const weightInput = document.getElementById('diet-weight-kg');
    const submitBtn = document.getElementById('diet-weight-input-submit');

    setTimeout(() => {
        bg?.classList.add('app-modal-show');
        modal?.classList.add('app-modal-show');
    }, 10);

    try {
        const existing = await getBodyWeightByDate(appUserId, defaultDate);
        if (existing?.weight_kg != null && weightInput) {
            weightInput.value = String(existing.weight_kg);
        }
    } catch {
        // prefill optional
    }

    const close = () => {
        bg?.classList.remove('app-modal-show');
        modal?.classList.remove('app-modal-show');
        setTimeout(() => bg?.remove(), 300);
    };

    closeBtn?.addEventListener('click', close);
    bg?.addEventListener('click', (e) => {
        if (e.target === bg) close();
    });

    dateInput?.addEventListener('change', async () => {
        const date = dateInput.value;
        if (!date) return;
        weightInput.value = '';
        try {
            const existing = await getBodyWeightByDate(appUserId, date);
            if (existing?.weight_kg != null) {
                weightInput.value = String(existing.weight_kg);
            }
        } catch {
            // noop
        }
    });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const recordDate = dateInput.value;
        const weightKg = parseFloat(weightInput.value);
        if (!recordDate || !Number.isFinite(weightKg)) {
            alert('날짜와 체중을 입력해주세요.');
            return;
        }
        submitBtn.disabled = true;
        try {
            await upsertBodyWeightRecord(appUserId, recordDate, weightKg);
            close();
            if (typeof onSuccess === 'function') {
                onSuccess();
            }
        } catch (err) {
            alert(err.message || '체중 저장에 실패했습니다.');
        } finally {
            submitBtn.disabled = false;
        }
    });
}
