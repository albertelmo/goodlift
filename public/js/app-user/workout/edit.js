// 운동기록 수정/삭제 모달

import { formatDate, escapeHtml } from '../utils.js';
import { updateWorkoutRecord, deleteWorkoutRecord } from '../api.js';

/**
 * 수정 모달 표시
 */
export function showEditModal(record, appUserId, onSuccess) {
    const modalBg = createModal();
    const modal = modalBg.querySelector('.app-modal');
    
    modal.innerHTML = `
        <div class="app-modal-header">
            <h2>운동기록 수정</h2>
            <button class="app-modal-close" aria-label="닫기">×</button>
        </div>
        <form class="app-modal-form" id="workout-edit-form">
            <div class="app-form-group">
                <label for="workout-edit-date">운동 날짜</label>
                <input type="date" id="workout-edit-date" required value="${record.workout_date}">
            </div>
            <div class="app-form-group">
                <label for="workout-edit-type">운동 종류</label>
                <select id="workout-edit-type">
                    <option value="">선택하세요</option>
                    <option value="유산소" ${record.workout_type === '유산소' ? 'selected' : ''}>유산소</option>
                    <option value="근력운동" ${record.workout_type === '근력운동' ? 'selected' : ''}>근력운동</option>
                    <option value="스트레칭" ${record.workout_type === '스트레칭' ? 'selected' : ''}>스트레칭</option>
                    <option value="요가" ${record.workout_type === '요가' ? 'selected' : ''}>요가</option>
                    <option value="필라테스" ${record.workout_type === '필라테스' ? 'selected' : ''}>필라테스</option>
                    <option value="기타" ${record.workout_type === '기타' ? 'selected' : ''}>기타</option>
                </select>
            </div>
            <div class="app-form-group">
                <label for="workout-edit-duration">운동 시간 (분)</label>
                <input type="number" id="workout-edit-duration" min="0" value="${record.duration_minutes || ''}" placeholder="예: 30">
            </div>
            <div class="app-form-group">
                <label for="workout-edit-calories">소모 칼로리 (kcal)</label>
                <input type="number" id="workout-edit-calories" min="0" value="${record.calories_burned || ''}" placeholder="예: 300">
            </div>
            <div class="app-form-group">
                <label for="workout-edit-notes">메모</label>
                <textarea id="workout-edit-notes" rows="3" placeholder="운동 내용, 느낀 점 등을 기록하세요">${escapeHtml(record.notes || '')}</textarea>
            </div>
            <div class="app-modal-actions">
                <button type="button" class="app-btn-danger" id="workout-edit-delete">삭제</button>
                <div style="flex: 1;"></div>
                <button type="button" class="app-btn-secondary" id="workout-edit-cancel">취소</button>
                <button type="submit" class="app-btn-primary">수정</button>
            </div>
        </form>
    `;
    
    document.body.appendChild(modalBg);
    
    // 이벤트 리스너
    const closeBtn = modal.querySelector('.app-modal-close');
    const cancelBtn = modal.querySelector('#workout-edit-cancel');
    const deleteBtn = modal.querySelector('#workout-edit-delete');
    const form = modal.querySelector('#workout-edit-form');
    
    const closeModal = () => {
        document.body.removeChild(modalBg);
    };
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modalBg.addEventListener('click', (e) => {
        if (e.target === modalBg) closeModal();
    });
    
    // 삭제 버튼
    deleteBtn.addEventListener('click', async () => {
        if (!confirm('정말 삭제하시겠습니까?')) {
            return;
        }
        
        try {
            await deleteWorkoutRecord(record.id, appUserId);
            closeModal();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('운동기록 삭제 오류:', error);
            alert('운동기록 삭제 중 오류가 발생했습니다.');
        }
    });
    
    // 수정 폼 제출
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const workoutDate = document.getElementById('workout-edit-date').value;
        const workoutType = document.getElementById('workout-edit-type').value;
        const durationMinutes = document.getElementById('workout-edit-duration').value;
        const caloriesBurned = document.getElementById('workout-edit-calories').value;
        const notes = document.getElementById('workout-edit-notes').value;
        
        try {
            await updateWorkoutRecord(record.id, {
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
            console.error('운동기록 수정 오류:', error);
            alert('운동기록 수정 중 오류가 발생했습니다.');
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
