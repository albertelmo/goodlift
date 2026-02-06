// 식단 평가 모달

import { getCurrentUser } from '../index.js';
import { updateDietRecordEvaluation } from '../api.js';

const evaluationOptions = [
    { value: 'verygood', label: 'Very Good!' },
    { value: 'good', label: 'Good' },
    { value: 'ok', label: 'OK' },
    { value: 'bad', label: 'Bad' },
    { value: 'verybad', label: 'Very Bad!' }
];

export async function showDietEvaluationModal(appUserId, record, onSuccess) {
    const existingModals = document.querySelectorAll('.app-modal-bg');
    existingModals.forEach(modal => {
        if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    });
    
    const modalBg = createModal();
    const modal = modalBg.querySelector('.app-modal');
    
    const currentUser = getCurrentUser();
    const trainerUsername = currentUser?.username || null;
    const trainerName = currentUser?.name || null;
    const trainerAppUserId = currentUser?.id || null;
    
    const optionsHtml = evaluationOptions.map(option => {
        const isSelected = record.trainer_evaluation === option.value;
        return `
            <button class="app-diet-evaluation-option ${isSelected ? 'is-selected' : ''}" data-value="${option.value}">
                ${option.label}
            </button>
        `;
    }).join('');
    
    modal.innerHTML = `
        <div class="app-modal-header">
            <h2>식단 평가</h2>
            <button class="app-modal-close-btn" id="diet-evaluation-modal-close">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
        <div class="app-modal-content" style="padding: 20px;">
            <div class="app-diet-evaluation-options">
                ${optionsHtml}
            </div>
        </div>
    `;
    
    setTimeout(() => {
        modalBg.classList.add('app-modal-show');
        modal.classList.add('app-modal-show');
    }, 10);
    
    const closeModal = () => {
        modalBg.classList.remove('app-modal-show');
        modal.classList.remove('app-modal-show');
        setTimeout(() => {
            modalBg.remove();
        }, 300);
    };
    
    modal.querySelector('#diet-evaluation-modal-close').addEventListener('click', closeModal);
    modalBg.addEventListener('click', (e) => {
        if (e.target === modalBg) {
            closeModal();
        }
    });
    
    modal.querySelectorAll('.app-diet-evaluation-option').forEach(btn => {
        btn.addEventListener('click', async () => {
            const value = btn.getAttribute('data-value');
            const nextValue = record.trainer_evaluation === value ? null : value;
            try {
                const updatedRecord = await updateDietRecordEvaluation(record.id, {
                    evaluation: nextValue,
                    trainer_username: trainerUsername,
                    trainer_name: trainerName,
                    trainer_app_user_id: trainerAppUserId
                });
                
                if (typeof onSuccess === 'function') {
                    await onSuccess(updatedRecord);
                }
                
                closeModal();
            } catch (error) {
                alert(error.message || '평가 저장 중 오류가 발생했습니다.');
            }
        });
    });
}

function createModal() {
    const modalBg = document.createElement('div');
    modalBg.className = 'app-modal-bg';
    modalBg.innerHTML = `
        <div class="app-modal">
        </div>
    `;
    
    document.body.appendChild(modalBg);
    return modalBg;
}
