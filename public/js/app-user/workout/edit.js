// 운동기록 수정/삭제 모달

import { formatDate, escapeHtml } from '../utils.js';
import { updateWorkoutRecord, deleteWorkoutRecord, getWorkoutTypes } from '../api.js';

/**
 * 수정 모달 표시
 */
export async function showEditModal(record, appUserId, onSuccess) {
    const modalBg = createModal();
    const modal = modalBg.querySelector('.app-modal');
    
    // 운동종류 목록 가져오기
    let workoutTypes = [];
    try {
        workoutTypes = await getWorkoutTypes();
    } catch (error) {
        console.error('운동종류 조회 오류:', error);
    }
    
    const currentWorkoutType = workoutTypes.find(t => t.id === record.workout_type_id);
    const workoutTypeType = currentWorkoutType ? (currentWorkoutType.type || '세트') : null;
    
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
                    ${workoutTypes.map(type => `
                        <option value="${type.id}" data-type="${type.type || '세트'}" ${record.workout_type_id === type.id ? 'selected' : ''}>${escapeHtml(type.name)}</option>
                    `).join('')}
                </select>
            </div>
            <div class="app-form-group" id="workout-edit-duration-group" style="display: ${workoutTypeType === '시간' ? 'block' : 'none'};">
                <label for="workout-edit-duration">운동 시간 (분)</label>
                <input type="number" id="workout-edit-duration" min="0" value="${record.duration_minutes || ''}" placeholder="예: 30">
            </div>
            <div class="app-form-group" id="workout-edit-sets-group" style="display: ${workoutTypeType === '세트' ? 'block' : 'none'};">
                <label>세트</label>
                <div id="workout-edit-sets-container"></div>
                <button type="button" class="app-btn-secondary" id="workout-edit-set-btn" style="margin-top: 8px; width: 100%;">세트 추가</button>
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
    const typeSelect = modal.querySelector('#workout-edit-type');
    const durationGroup = modal.querySelector('#workout-edit-duration-group');
    const setsGroup = modal.querySelector('#workout-edit-sets-group');
    const setsContainer = modal.querySelector('#workout-edit-sets-container');
    const addSetBtn = modal.querySelector('#workout-edit-set-btn');
    
    // 기존 세트 데이터 로드
    let sets = (record.sets || []).map(set => ({
        set_number: set.set_number,
        weight: set.weight,
        reps: set.reps
    }));
    
    if (sets.length === 0 && workoutTypeType === '세트') {
        addSet();
    } else {
        renderSets();
    }
    
    // 운동종류 선택 시 타입에 따라 UI 변경
    typeSelect.addEventListener('change', () => {
        const selectedOption = typeSelect.options[typeSelect.selectedIndex];
        const workoutType = selectedOption ? selectedOption.getAttribute('data-type') : null;
        
        if (workoutType === '시간') {
            durationGroup.style.display = 'block';
            setsGroup.style.display = 'none';
            sets = [];
        } else if (workoutType === '세트') {
            durationGroup.style.display = 'none';
            setsGroup.style.display = 'block';
            if (sets.length === 0) {
                addSet();
            } else {
                renderSets();
            }
        } else {
            durationGroup.style.display = 'none';
            setsGroup.style.display = 'none';
            sets = [];
        }
    });
    
    // 세트 추가 버튼
    addSetBtn.addEventListener('click', () => {
        addSet();
    });
    
    // 세트 추가 함수
    function addSet() {
        const setNumber = sets.length + 1;
        sets.push({ set_number: setNumber, weight: null, reps: null });
        renderSets();
    }
    
    // 세트 삭제 함수
    function removeSet(index) {
        sets.splice(index, 1);
        // 세트 번호 재정렬
        sets.forEach((set, i) => {
            set.set_number = i + 1;
        });
        renderSets();
    }
    
    // 세트 렌더링 함수
    function renderSets() {
        setsContainer.innerHTML = sets.map((set, index) => `
            <div class="workout-set-item" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
                <span style="min-width: 40px; font-weight: 600;">${set.set_number}세트</span>
                <input type="number" class="workout-set-weight" data-index="${index}" step="0.1" min="0" placeholder="무게(kg)" value="${set.weight || ''}" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                <input type="number" class="workout-set-reps" data-index="${index}" min="0" placeholder="횟수" value="${set.reps || ''}" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                <button type="button" class="workout-set-remove" data-index="${index}" style="background: #d32f2f; color: #fff; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">삭제</button>
            </div>
        `).join('');
        
        // 세트 입력값 변경 이벤트
        setsContainer.querySelectorAll('.workout-set-weight').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.getAttribute('data-index'));
                sets[index].weight = e.target.value ? parseFloat(e.target.value) : null;
            });
        });
        
        setsContainer.querySelectorAll('.workout-set-reps').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.getAttribute('data-index'));
                sets[index].reps = e.target.value ? parseInt(e.target.value) : null;
            });
        });
        
        // 세트 삭제 버튼
        setsContainer.querySelectorAll('.workout-set-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.getAttribute('data-index'));
                removeSet(index);
            });
        });
    }
    
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
        const workoutTypeId = document.getElementById('workout-edit-type').value;
        const durationMinutes = document.getElementById('workout-edit-duration').value;
        const notes = document.getElementById('workout-edit-notes').value;
        
        const selectedOption = typeSelect.options[typeSelect.selectedIndex];
        const workoutType = selectedOption ? selectedOption.getAttribute('data-type') : null;
        
        const updates = {
            app_user_id: appUserId,
            workout_date: workoutDate,
            workout_type_id: workoutTypeId || null,
            duration_minutes: workoutType === '시간' && durationMinutes ? parseInt(durationMinutes) : null,
            sets: workoutType === '세트' ? sets.filter(s => s.weight !== null || s.reps !== null) : [],
            notes: notes.trim() || null
        };
        
        try {
            await updateWorkoutRecord(record.id, updates);
            
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
