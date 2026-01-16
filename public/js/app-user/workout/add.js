// 운동기록 추가 모달

import { formatDate, getToday, escapeHtml } from '../utils.js';
import { addWorkoutRecord } from '../api.js';

/**
 * 추가 모달 표시
 */
export function showAddModal(appUserId, selectedDate = null, onSuccess) {
    const modalBg = createModal();
    const modal = modalBg.querySelector('.app-modal');
    
    // 선택된 날짜가 있으면 사용, 없으면 오늘 날짜
    const defaultDate = selectedDate || getToday();
    
    modal.innerHTML = `
        <div class="app-modal-header">
            <h2>운동기록 추가</h2>
            <button class="app-modal-close" aria-label="닫기">×</button>
        </div>
        <form class="app-modal-form" id="workout-add-form">
            <div class="app-form-group">
                <label for="workout-add-date">운동 날짜</label>
                <input type="date" id="workout-add-date" required value="${defaultDate}">
            </div>
            <div class="app-form-group">
                <label for="workout-add-type">운동 종류</label>
                <select id="workout-add-type">
                    <option value="">선택하세요</option>
                    <option value="유산소">유산소</option>
                    <option value="근력운동">근력운동</option>
                    <option value="스트레칭">스트레칭</option>
                    <option value="요가">요가</option>
                    <option value="필라테스">필라테스</option>
                    <option value="기타">기타</option>
                </select>
            </div>
            <div class="app-form-group">
                <label for="workout-add-duration">운동 시간 (분)</label>
                <input type="number" id="workout-add-duration" min="0" placeholder="예: 30">
            </div>
            <div class="app-form-group">
                <label for="workout-add-calories">소모 칼로리 (kcal)</label>
                <input type="number" id="workout-add-calories" min="0" placeholder="예: 300">
            </div>
            <div class="app-form-group">
                <label for="workout-add-notes">메모</label>
                <textarea id="workout-add-notes" rows="3" placeholder="운동 내용, 느낀 점 등을 기록하세요"></textarea>
            </div>
            <div class="app-modal-actions">
                <button type="button" class="app-btn-secondary" id="workout-add-cancel">취소</button>
                <button type="submit" class="app-btn-primary">등록</button>
            </div>
        </form>
    `;
    
    document.body.appendChild(modalBg);
    
    // 이벤트 리스너
    const closeBtn = modal.querySelector('.app-modal-close');
    const cancelBtn = modal.querySelector('#workout-add-cancel');
    const form = modal.querySelector('#workout-add-form');
    
    const closeModal = () => {
        document.body.removeChild(modalBg);
    };
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modalBg.addEventListener('click', (e) => {
        if (e.target === modalBg) closeModal();
    });
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const workoutDate = document.getElementById('workout-add-date').value;
        const workoutType = document.getElementById('workout-add-type').value;
        const durationMinutes = document.getElementById('workout-add-duration').value;
        const caloriesBurned = document.getElementById('workout-add-calories').value;
        const notes = document.getElementById('workout-add-notes').value;
        
        try {
            await addWorkoutRecord({
                app_user_id: appUserId,
                workout_date: workoutDate,
                workout_type: workoutType || null,
                duration_minutes: durationMinutes ? parseInt(durationMinutes) : null,
                calories_burned: caloriesBurned ? parseInt(caloriesBurned) : null,
                notes: notes.trim() || null
            });
            
            closeModal();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('운동기록 추가 오류:', error);
            const errorMessage = error.message || '운동기록 추가 중 오류가 발생했습니다.';
            alert(errorMessage);
        }
    });
}

/**
 * 모달 생성
 */
function createModal() {
    const modalBg = document.createElement('div');
    modalBg.className = 'app-modal-bg';
    modalBg.innerHTML = '<div class="app-modal"></div>';
    return modalBg;
}
