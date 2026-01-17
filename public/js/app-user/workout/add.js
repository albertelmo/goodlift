// 운동기록 추가 모달

import { formatDate, getToday, escapeHtml } from '../utils.js';
import { addWorkoutRecord, getWorkoutTypes } from '../api.js';

/**
 * 운동 선택 모달 표시 (1단계)
 */
export async function showWorkoutSelectModal(appUserId, selectedDate = null, onSuccess) {
    const modalBg = createModal();
    const modal = modalBg.querySelector('.app-modal');
    
    // 선택된 날짜가 있으면 사용, 없으면 오늘 날짜
    const defaultDate = selectedDate || getToday();
    
    // 날짜를 "YY.M.D" 형식으로 변환
    const dateObj = new Date(defaultDate);
    const year = dateObj.getFullYear().toString().slice(-2);
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    const dateDisplay = `${year}.${month}.${day}`;
    
    // 운동종류 목록 가져오기
    let workoutTypes = [];
    try {
        workoutTypes = await getWorkoutTypes();
    } catch (error) {
        console.error('운동종류 조회 오류:', error);
    }
    
    modal.innerHTML = `
        <div class="app-modal-header">
            <h2>운동 선택 (${dateDisplay})</h2>
            <button class="app-modal-close" aria-label="닫기">×</button>
        </div>
        <form class="app-modal-form" id="workout-select-form">
            <div class="app-form-group">
                <label for="workout-select-type">💪 운동 종류</label>
                <select id="workout-select-type">
                    <option value="">선택하세요</option>
                    ${workoutTypes.map(type => `
                        <option value="${type.id}" data-type="${type.type || '세트'}">${escapeHtml(type.name)}</option>
                    `).join('')}
                </select>
            </div>
            <div class="app-modal-actions">
                <button type="button" class="app-btn-secondary" id="workout-select-cancel">취소</button>
                <button type="submit" class="app-btn-primary" id="workout-select-next">다음</button>
            </div>
        </form>
    `;
    
    document.body.appendChild(modalBg);
    
    // 모달 열기 애니메이션
    setTimeout(() => {
        modalBg.classList.add('app-modal-show');
        modal.classList.add('app-modal-show');
    }, 10);
    
    // 이벤트 리스너
    const closeBtn = modal.querySelector('.app-modal-close');
    const cancelBtn = modal.querySelector('#workout-select-cancel');
    const form = modal.querySelector('#workout-select-form');
    const typeSelect = modal.querySelector('#workout-select-type');
    
    const closeModal = () => {
        modalBg.classList.remove('app-modal-show');
        modal.classList.remove('app-modal-show');
        setTimeout(() => {
            if (modalBg.parentNode) {
                document.body.removeChild(modalBg);
            }
        }, 200);
    };
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modalBg.addEventListener('click', (e) => {
        if (e.target === modalBg) closeModal();
    });
    
    // 폼 제출 시 추가 모달 열기
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const selectedOption = typeSelect.options[typeSelect.selectedIndex];
        if (!selectedOption || !selectedOption.value) {
            alert('운동 종류를 선택해주세요.');
            return;
        }
        
        const workoutId = selectedOption.value;
        const workoutType = selectedOption.getAttribute('data-type');
        
        // 선택 모달 닫기
        closeModal();
        
        // 추가 모달 열기 (선택한 운동 종류 전달)
        setTimeout(() => {
            showAddModal(appUserId, selectedDate, workoutId, workoutType, onSuccess);
        }, 200);
    });
}

/**
 * 추가 모달 표시 (2단계)
 */
export async function showAddModal(appUserId, selectedDate = null, preselectedWorkoutTypeId = null, preselectedWorkoutType = null, onSuccess) {
    const modalBg = createModal();
    const modal = modalBg.querySelector('.app-modal');
    
    // 선택된 날짜가 있으면 사용, 없으면 오늘 날짜
    const defaultDate = selectedDate || getToday();
    
    // 날짜를 "YY.M.D" 형식으로 변환
    const dateObj = new Date(defaultDate);
    const year = dateObj.getFullYear().toString().slice(-2);
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    const dateDisplay = `${year}.${month}.${day}`;
    
    // 운동종류 목록 가져오기
    let workoutTypes = [];
    try {
        workoutTypes = await getWorkoutTypes();
    } catch (error) {
        console.error('운동종류 조회 오류:', error);
    }
    
    modal.innerHTML = `
        <div class="app-modal-header">
            <h2>운동기록 추가 (${dateDisplay})</h2>
            <button class="app-modal-close" aria-label="닫기">×</button>
        </div>
        <form class="app-modal-form" id="workout-add-form">
            <input type="hidden" id="workout-add-date" value="${defaultDate}">
            <div class="app-form-group">
                <label for="workout-add-type">💪 운동 종류</label>
                <select id="workout-add-type" ${preselectedWorkoutTypeId ? 'disabled' : ''}>
                    <option value="">선택하세요</option>
                    ${workoutTypes.map(type => `
                        <option value="${type.id}" data-type="${type.type || '세트'}" ${preselectedWorkoutTypeId === type.id ? 'selected' : ''}>${escapeHtml(type.name)}</option>
                    `).join('')}
                </select>
            </div>
            <div class="app-form-group" id="workout-add-duration-group" style="display: none;">
                <label for="workout-add-duration">⏱ 시간 (분)</label>
                <input type="number" id="workout-add-duration" min="0" placeholder="30" inputmode="numeric">
            </div>
            <div class="app-form-group" id="workout-add-sets-group" style="display: none;">
                <label>⚖️ 세트</label>
                <div id="workout-add-sets-container" class="workout-sets-container"></div>
                <button type="button" class="workout-add-set-btn" id="workout-add-set-btn">
                    <span>+</span> 세트 추가
                </button>
            </div>
            <div class="app-modal-actions">
                <button type="button" class="app-btn-secondary" id="workout-add-cancel">취소</button>
                <button type="submit" class="app-btn-primary">등록</button>
            </div>
        </form>
    `;
    
    document.body.appendChild(modalBg);
    
    // 모달 열기 애니메이션
    setTimeout(() => {
        modalBg.classList.add('app-modal-show');
        modal.classList.add('app-modal-show');
    }, 10);
    
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
    
    // 이미 선택된 운동 종류가 있으면 해당 UI 표시
    if (preselectedWorkoutTypeId && preselectedWorkoutType) {
        if (preselectedWorkoutType === '시간') {
            durationGroup.style.display = 'block';
            setsGroup.style.display = 'none';
            sets = [];
        } else if (preselectedWorkoutType === '세트') {
            durationGroup.style.display = 'none';
            setsGroup.style.display = 'block';
            if (sets.length === 0) {
                addSet();
            }
        }
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
        // 이전 세트의 무게와 횟수를 가져오기
        const lastSet = sets.length > 0 ? sets[sets.length - 1] : null;
        const newWeight = lastSet ? lastSet.weight : null;
        const newReps = lastSet ? lastSet.reps : null;
        sets.push({ set_number: setNumber, weight: newWeight, reps: newReps });
        renderSets();
        
        // 세트 추가 후 스크롤을 맨 아래로 이동
        setTimeout(() => {
            // 모달 내부의 폼이나 스크롤 가능한 컨테이너 찾기
            const scrollContainer = modal.querySelector('.app-modal-form') || modal;
            if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
            // 또는 모달 자체를 스크롤
            if (modal.scrollHeight > modal.clientHeight) {
                modal.scrollTop = modal.scrollHeight;
            }
            // 마지막 세트 카드로 스크롤
            const lastSetCard = setsContainer.lastElementChild;
            if (lastSetCard) {
                lastSetCard.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
        }, 50);
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
            <div class="workout-set-card">
                <div class="workout-set-header">
                    <span class="workout-set-number">${set.set_number}세트</span>
                    <button type="button" class="workout-set-remove" data-index="${index}" aria-label="삭제">×</button>
                </div>
                <div class="workout-set-inputs">
                    <div class="workout-set-input-group">
                        <label>무게 (kg)</label>
                        <input type="number" class="workout-set-weight" data-index="${index}" step="1" min="0" placeholder="0" value="${set.weight ? Math.round(set.weight) : ''}" inputmode="numeric">
                    </div>
                    <div class="workout-set-input-group">
                        <label>횟수</label>
                        <input type="number" class="workout-set-reps" data-index="${index}" min="0" placeholder="0" value="${set.reps || ''}" inputmode="numeric">
                    </div>
                </div>
            </div>
        `).join('');
        
        // 세트 입력값 변경 이벤트
        setsContainer.querySelectorAll('.workout-set-weight').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.getAttribute('data-index'));
                sets[index].weight = e.target.value ? parseInt(e.target.value) : null;
            });
            
            // Enter 키 입력 시 해당 세트의 횟수 입력 필드로 포커스 이동
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const index = parseInt(e.target.getAttribute('data-index'));
                    const repsInput = setsContainer.querySelector(`.workout-set-reps[data-index="${index}"]`);
                    if (repsInput) {
                        repsInput.focus();
                        repsInput.select();
                    }
                }
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
        // 모달 닫기 애니메이션
        modalBg.classList.remove('app-modal-show');
        modal.classList.remove('app-modal-show');
        setTimeout(() => {
            if (modalBg.parentNode) {
                document.body.removeChild(modalBg);
            }
        }, 200); // 애니메이션 시간에 맞춰 지연
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
        
        const selectedOption = typeSelect.options[typeSelect.selectedIndex];
        const workoutType = selectedOption ? selectedOption.getAttribute('data-type') : null;
        
        const workoutData = {
            app_user_id: appUserId,
            workout_date: workoutDate,
            workout_type_id: workoutTypeId || null,
            duration_minutes: workoutType === '시간' && durationMinutes ? parseInt(durationMinutes) : null,
            sets: workoutType === '세트' ? sets.filter(s => s.weight !== null || s.reps !== null) : [],
            notes: null
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
