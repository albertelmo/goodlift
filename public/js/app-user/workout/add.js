// 운동기록 추가 모달

import { formatDate, getToday, escapeHtml } from '../utils.js';
import { addWorkoutRecord, getWorkoutTypes } from '../api.js';

/**
 * 추가 모달 표시
 */
export async function showAddModal(appUserId, selectedDate = null, onSuccess) {
    const modalBg = createModal();
    const modal = modalBg.querySelector('.app-modal');
    
    // 선택된 날짜가 있으면 사용, 없으면 오늘 날짜
    const defaultDate = selectedDate || getToday();
    
    // 운동종류 목록 가져오기
    let workoutTypes = [];
    try {
        workoutTypes = await getWorkoutTypes();
    } catch (error) {
        console.error('운동종류 조회 오류:', error);
    }
    
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
                    ${workoutTypes.map(type => `
                        <option value="${type.id}" data-type="${type.type || '세트'}">${escapeHtml(type.name)}</option>
                    `).join('')}
                </select>
            </div>
            <div class="app-form-group" id="workout-add-duration-group" style="display: none;">
                <label for="workout-add-duration">운동 시간 (분)</label>
                <input type="number" id="workout-add-duration" min="0" placeholder="예: 30">
            </div>
            <div class="app-form-group" id="workout-add-sets-group" style="display: none;">
                <label>세트</label>
                <div id="workout-add-sets-container"></div>
                <button type="button" class="app-btn-secondary" id="workout-add-set-btn" style="margin-top: 8px; width: 100%;">세트 추가</button>
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
    const typeSelect = modal.querySelector('#workout-add-type');
    const durationGroup = modal.querySelector('#workout-add-duration-group');
    const setsGroup = modal.querySelector('#workout-add-sets-group');
    const setsContainer = modal.querySelector('#workout-add-sets-container');
    const addSetBtn = modal.querySelector('#workout-add-set-btn');
    
    let sets = [];
    
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
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const workoutDate = document.getElementById('workout-add-date').value;
        const workoutTypeId = document.getElementById('workout-add-type').value;
        const durationMinutes = document.getElementById('workout-add-duration').value;
        const notes = document.getElementById('workout-add-notes').value;
        
        const selectedOption = typeSelect.options[typeSelect.selectedIndex];
        const workoutType = selectedOption ? selectedOption.getAttribute('data-type') : null;
        
        const workoutData = {
            app_user_id: appUserId,
            workout_date: workoutDate,
            workout_type_id: workoutTypeId || null,
            duration_minutes: workoutType === '시간' && durationMinutes ? parseInt(durationMinutes) : null,
            sets: workoutType === '세트' ? sets.filter(s => s.weight !== null || s.reps !== null) : [],
            notes: notes.trim() || null
        };
        
        try {
            await addWorkoutRecord(workoutData);
            
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
