// 운동기록 수정/삭제 모달

import { formatDate, escapeHtml, formatWeight, parseWeight, parseWorkoutDurationInputs } from '../utils.js';
import { updateWorkoutRecord, deleteWorkoutRecord, getWorkoutTypes } from '../api.js';

/**
 * 수정 모달 표시 (일반 운동기록용)
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
    
    // 운동종류 이름 가나다순 정렬 (표시용)
    workoutTypes = Array.isArray(workoutTypes)
        ? workoutTypes.slice().sort((a, b) =>
            String(a?.name || '').localeCompare(String(b?.name || ''), 'ko', { sensitivity: 'base' })
        )
        : [];
    
    const currentWorkoutType = workoutTypes.find(t => t.id === record.workout_type_id);
    const workoutTypeType = currentWorkoutType ? (currentWorkoutType.type || '세트') : null;
    
    // 날짜를 YYYY-MM-DD 형식으로 확실히 변환 (타임존 이슈 방지)
    const workoutDateStr = formatDate(record.workout_date);
    
    // 날짜를 "YY.M.D" 형식으로 변환 (표시용)
    const dateParts = workoutDateStr.split('-');
    const year = dateParts[0].slice(-2);
    const month = parseInt(dateParts[1]);
    const day = parseInt(dateParts[2]);
    const dateDisplay = `${year}.${month}.${day}`;
    
    modal.innerHTML = `
        <div class="app-modal-header">
            <h2>운동기록 수정 (${dateDisplay})</h2>
            <button class="app-modal-close" aria-label="닫기">×</button>
        </div>
        <form class="app-modal-form" id="workout-edit-form">
            <input type="hidden" id="workout-edit-date" value="${workoutDateStr}">
            <div class="app-form-group">
                <label for="workout-edit-type">💪 운동 종류</label>
                <select id="workout-edit-type">
                    <option value="">선택하세요</option>
                    ${workoutTypes.map(type => `
                        <option value="${type.id}" data-type="${type.type || '세트'}" ${record.workout_type_id === type.id ? 'selected' : ''}>${escapeHtml(type.name)}</option>
                    `).join('')}
                </select>
            </div>
            <div class="app-form-group" id="workout-edit-duration-group" style="display: ${workoutTypeType === '시간' ? 'block' : 'none'};">
                <label>⏱ 시간 (분 · 초)</label>
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <input type="number" id="workout-edit-duration-m" min="0" placeholder="0" value="${record.duration_minutes != null ? record.duration_minutes : ''}" inputmode="numeric" style="width: 72px;">
                    <span style="color: #666;">분</span>
                    <input type="number" id="workout-edit-duration-s" min="0" max="59" placeholder="0" value="${record.duration_seconds != null ? record.duration_seconds : ''}" inputmode="numeric" style="width: 72px;">
                    <span style="color: #666;">초</span>
                </div>
            </div>
            <div class="app-form-group" id="workout-edit-sets-group" style="display: ${workoutTypeType === '세트' ? 'block' : 'none'};">
                <label>⚖️ 세트</label>
                <div id="workout-edit-sets-container" class="workout-sets-container"></div>
                <div class="workout-set-controls" style="display: flex; gap: 12px; align-items: center; justify-content: center; margin-top: 12px;">
                    <button type="button" class="workout-remove-set-btn" id="workout-edit-remove-set-btn" style="width: 32px; height: 32px; border: 1px solid #ddd; background: #fff; color: #333; border-radius: 4px; cursor: pointer; font-size: 20px; font-weight: bold; line-height: 1; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0; box-sizing: border-box;">−</button>
                    <span style="font-size: 14px; color: #333; display: flex; align-items: center; line-height: 1; height: 32px; margin: 0; padding: 0;">세트</span>
                    <button type="button" class="workout-add-set-btn" id="workout-edit-set-btn" style="width: 32px; height: 32px; border: 1px solid #1976d2; background: #1976d2; color: #fff; border-radius: 4px; cursor: pointer; font-size: 20px; font-weight: bold; line-height: 1; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0; box-sizing: border-box;">+</button>
                </div>
            </div>
            <div class="app-form-group">
                <label for="workout-edit-notes">📝 메모</label>
                <textarea id="workout-edit-notes" rows="2" placeholder="운동 내용, 느낀 점 등을 기록하세요">${escapeHtml(record.notes || '')}</textarea>
            </div>
        </form>
        <div class="app-modal-actions">
            <button type="button" class="app-btn-danger" id="workout-edit-delete">삭제</button>
            <div style="flex: 1;"></div>
            <button type="button" class="app-btn-secondary" id="workout-edit-cancel">취소</button>
            <button type="submit" form="workout-edit-form" class="app-btn-primary">수정</button>
        </div>
    `;
    
    document.body.appendChild(modalBg);
    
    // 모달 열기 애니메이션
    setTimeout(() => {
        modalBg.classList.add('app-modal-show');
        modal.classList.add('app-modal-show');
    }, 10);
    
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
    const removeSetBtn = modal.querySelector('#workout-edit-remove-set-btn');
    
    // 기존 세트 데이터 로드 (무게는 소수점 두자리까지 유지, 완료 상태 보존)
    let sets = (record.sets || []).map(set => ({
        id: set.id, // 기존 세트 ID 보존
        set_number: set.set_number,
        weight: set.weight !== null && set.weight !== undefined ? parseFloat(set.weight) : null,
        reps: set.reps,
        is_completed: set.is_completed || false // 완료 상태 보존
    }));
    
    if (sets.length === 0 && workoutTypeType === '세트') {
        addSet();
    } else {
        renderSets();
        // 모달이 열릴 때 마지막 세트로 스크롤
        setTimeout(() => {
            // 세트 컨테이너가 스크롤 가능한 경우
            if (setsContainer && setsContainer.scrollHeight > setsContainer.clientHeight) {
                setsContainer.scrollTop = setsContainer.scrollHeight;
            }
            // 또는 모달 자체를 스크롤
            if (modal.scrollHeight > modal.clientHeight) {
                modal.scrollTop = modal.scrollHeight;
            }
            // 마지막 세트 카드로 스크롤
            if (setsContainer) {
                const lastSetCard = setsContainer.lastElementChild;
                if (lastSetCard) {
                    lastSetCard.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }
            }
        }, 100);
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
    if (addSetBtn) {
        addSetBtn.addEventListener('click', () => {
            addSet();
        });
    }
    
    // 세트 삭제 버튼
    if (removeSetBtn) {
        removeSetBtn.addEventListener('click', () => {
            // 세트가 1개 이상일 때만 삭제 가능 (최소 1개는 유지)
            if (sets.length > 1) {
                removeSet(sets.length - 1);
            }
        });
    }
    
    // 세트 추가 함수
    function addSet() {
        const setNumber = sets.length + 1;
        // 이전 세트의 무게와 횟수를 가져오기
        const lastSet = sets.length > 0 ? sets[sets.length - 1] : null;
        const newWeight = lastSet ? lastSet.weight : null;
        const newReps = lastSet ? lastSet.reps : null;
        sets.push({ 
            id: null, // 새 세트는 ID 없음
            set_number: setNumber, 
            weight: newWeight, 
            reps: newReps,
            is_completed: false // 새 세트는 미완료
        });
        renderSets();
        
        // 세트 삭제 버튼 상태 업데이트
        if (removeSetBtn) {
            const canRemove = sets.length > 1;
            removeSetBtn.disabled = !canRemove;
            removeSetBtn.style.opacity = canRemove ? '1' : '0.5';
            removeSetBtn.style.cursor = canRemove ? 'pointer' : 'not-allowed';
        }
        
        // 세트 추가 후 스크롤을 맨 아래로 이동
        setTimeout(() => {
            // 세트 컨테이너가 스크롤 가능한 경우
            if (setsContainer.scrollHeight > setsContainer.clientHeight) {
                setsContainer.scrollTop = setsContainer.scrollHeight;
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
        
        // 세트 삭제 버튼 상태 업데이트
        if (removeSetBtn) {
            const canRemove = sets.length > 1;
            removeSetBtn.disabled = !canRemove;
            removeSetBtn.style.opacity = canRemove ? '1' : '0.5';
            removeSetBtn.style.cursor = canRemove ? 'pointer' : 'not-allowed';
        }
    }
    
    // 세트 렌더링 함수
    function renderSets() {
        setsContainer.innerHTML = sets.map((set, index) => `
            <div class="workout-set-card">
                <div class="workout-set-header">
                    <span class="workout-set-number">${set.set_number}세트</span>
                </div>
                <div class="workout-set-inputs">
                    <div class="workout-set-input-group">
                        <label>무게 (kg)</label>
                        <input type="number" class="workout-set-weight" data-index="${index}" step="0.01" min="0" max="999.99" placeholder="0" value="${set.weight !== null && set.weight !== undefined ? parseFloat(set.weight) : ''}" inputmode="decimal">
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
                sets[index].weight = parseWeight(e.target.value);
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
        
        // 세트 삭제 버튼 상태 업데이트 (세트가 1개일 때 비활성화)
        if (removeSetBtn) {
            const canRemove = sets.length > 1;
            removeSetBtn.disabled = !canRemove;
            removeSetBtn.style.opacity = canRemove ? '1' : '0.5';
            removeSetBtn.style.cursor = canRemove ? 'pointer' : 'not-allowed';
        }
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
        const durationM = document.getElementById('workout-edit-duration-m')?.value ?? '';
        const durationS = document.getElementById('workout-edit-duration-s')?.value ?? '';
        const notes = document.getElementById('workout-edit-notes').value;
        
        const selectedOption = typeSelect.options[typeSelect.selectedIndex];
        const workoutType = selectedOption ? selectedOption.getAttribute('data-type') : null;
        
        // 수정 시 완료 상태 보존을 위해 기존 세트의 is_completed 정보 포함
        const updatedSets = workoutType === '세트' 
            ? sets.filter(s => s.weight !== null || s.reps !== null).map(set => ({
                id: set.id, // 기존 세트 ID 보존
                set_number: set.set_number,
                weight: set.weight,
                reps: set.reps,
                is_completed: set.is_completed !== undefined ? set.is_completed : false
            }))
            : [];
        
        let durationPayload = { duration_minutes: null, duration_seconds: null };
        if (workoutType === '시간') {
            const parsed = parseWorkoutDurationInputs(String(durationM), String(durationS));
            if (!parsed.ok) {
                alert(parsed.message);
                return;
            }
            durationPayload = { duration_minutes: parsed.minutes, duration_seconds: parsed.seconds };
        }
        
        const updates = {
            app_user_id: appUserId,
            workout_date: workoutDate,
            workout_type_id: workoutTypeId || null,
            duration_minutes: durationPayload.duration_minutes,
            duration_seconds: durationPayload.duration_seconds,
            sets: updatedSets,
            notes: notes.trim() || null
        };
        
        try {
            await updateWorkoutRecord(record.id, updates);
            
            closeModal();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('운동기록 수정 오류:', error);
            alert(error.message || '운동기록 수정 중 오류가 발생했습니다.');
        }
    });
}

/**
 * 텍스트 기록 수정 모달 표시
 */
export async function showTextRecordEditModal(record, appUserId, onSuccess) {
    const modalBg = createModal();
    const modal = modalBg.querySelector('.app-modal');
    
    // 날짜를 YYYY-MM-DD 형식으로 확실히 변환 (타임존 이슈 방지)
    const workoutDateStr = formatDate(record.workout_date);
    
    // 날짜를 "YY.M.D" 형식으로 변환 (표시용)
    const dateParts = workoutDateStr.split('-');
    const year = dateParts[0].slice(-2);
    const month = parseInt(dateParts[1]);
    const day = parseInt(dateParts[2]);
    const dateDisplay = `${year}.${month}.${day}`;
    
    modal.innerHTML = `
        <div class="app-modal-header">
            <h2>간편 기록 수정 (${dateDisplay})</h2>
            <button class="app-modal-close" aria-label="닫기">×</button>
        </div>
        <form class="app-modal-form" id="text-record-edit-form">
            <input type="hidden" id="text-record-edit-date" value="${workoutDateStr}">
            <div class="app-form-group">
                <div class="app-workout-level-group">
                    <div class="app-workout-level-title">컨디션</div>
                    <div class="app-workout-level-options">
                        <button type="button" class="app-workout-level-btn" data-level="condition" data-value="high">상</button>
                        <button type="button" class="app-workout-level-btn" data-level="condition" data-value="medium">중</button>
                        <button type="button" class="app-workout-level-btn" data-level="condition" data-value="low">하</button>
                    </div>
                </div>
                <div class="app-workout-level-group">
                    <div class="app-workout-level-title">운동강도</div>
                    <div class="app-workout-level-options">
                        <button type="button" class="app-workout-level-btn" data-level="intensity" data-value="high">상</button>
                        <button type="button" class="app-workout-level-btn" data-level="intensity" data-value="medium">중</button>
                        <button type="button" class="app-workout-level-btn" data-level="intensity" data-value="low">하</button>
                    </div>
                </div>
                <div class="app-workout-level-group">
                    <div class="app-workout-level-title">피로도</div>
                    <div class="app-workout-level-options">
                        <button type="button" class="app-workout-level-btn" data-level="fatigue" data-value="high">상</button>
                        <button type="button" class="app-workout-level-btn" data-level="fatigue" data-value="medium">중</button>
                        <button type="button" class="app-workout-level-btn" data-level="fatigue" data-value="low">하</button>
                    </div>
                </div>
            </div>
            <div class="app-form-group">
                <label for="text-record-edit-content">운동 내용</label>
                <textarea 
                    id="text-record-edit-content" 
                    placeholder="예: 조깅 30분, 스트레칭 10분" 
                    rows="6" 
                    maxlength="500"
                    style="width: 100%; padding: 10px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); font-size: 16px; font-family: inherit; resize: vertical; box-sizing: border-box;"
                >${escapeHtml(record.text_content || '')}</textarea>
                <div style="text-align: right; margin-top: 4px; font-size: 12px; color: var(--app-text-muted);">
                    <span id="text-record-edit-char-count">${(record.text_content || '').length}</span>/500
                </div>
            </div>
        </form>
        <div class="app-modal-actions">
            <button type="button" class="app-btn-danger" id="text-record-edit-delete">삭제</button>
            <div style="flex: 1;"></div>
            <button type="button" class="app-btn-secondary" id="text-record-edit-cancel">취소</button>
            <button type="submit" form="text-record-edit-form" class="app-btn-primary">수정</button>
        </div>
    `;
    
    document.body.appendChild(modalBg);
    
    // 모달 열기 애니메이션
    setTimeout(() => {
        modalBg.classList.add('app-modal-show');
        modal.classList.add('app-modal-show');
    }, 10);
    
    // 이벤트 리스너
    const closeBtn = modal.querySelector('.app-modal-close');
    const cancelBtn = modal.querySelector('#text-record-edit-cancel');
    const deleteBtn = modal.querySelector('#text-record-edit-delete');
    const form = modal.querySelector('#text-record-edit-form');
    const textContentTextarea = modal.querySelector('#text-record-edit-content');
    const charCount = modal.querySelector('#text-record-edit-char-count');
    const levelButtons = modal.querySelectorAll('.app-workout-level-btn');
    const selectedLevels = {
        condition: record.condition_level || null,
        intensity: record.intensity_level || null,
        fatigue: record.fatigue_level || null
    };
    
    // 글자 수 카운터
    if (textContentTextarea && charCount) {
        textContentTextarea.addEventListener('input', (e) => {
            const length = e.target.value.length;
            charCount.textContent = length;
        });
    }

    // 초기 선택 상태 반영
    levelButtons.forEach(btn => {
        const level = btn.getAttribute('data-level');
        const value = btn.getAttribute('data-value');
        if (level && value && selectedLevels[level] === value) {
            btn.classList.add('is-selected');
        }
    });

    levelButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const level = btn.getAttribute('data-level');
            const value = btn.getAttribute('data-value');
            if (!level || !value) return;

            if (selectedLevels[level] === value) {
                selectedLevels[level] = null;
            } else {
                selectedLevels[level] = value;
            }

            levelButtons.forEach(other => {
                if (other.getAttribute('data-level') === level) {
                    const otherValue = other.getAttribute('data-value');
                    if (selectedLevels[level] === otherValue) {
                        other.classList.add('is-selected');
                    } else {
                        other.classList.remove('is-selected');
                    }
                }
            });
        });
    });
    
    const closeModal = () => {
        // 모달 닫기 애니메이션
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
            console.error('텍스트 기록 삭제 오류:', error);
            alert('텍스트 기록 삭제 중 오류가 발생했습니다.');
        }
    });
    
    // 수정 폼 제출
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const workoutDate = document.getElementById('text-record-edit-date').value;
        const textContent = document.getElementById('text-record-edit-content').value.trim();
        
        const hasLevels = Boolean(selectedLevels.condition || selectedLevels.intensity || selectedLevels.fatigue);
        if (!textContent && !hasLevels) {
            alert('운동 내용을 입력하거나 상태를 선택해주세요.');
            return;
        }
        
        const updates = {
            app_user_id: appUserId,
            workout_date: workoutDate,
            is_text_record: true,
            text_content: textContent,
            workout_type_id: null,
            duration_minutes: null,
            duration_seconds: null,
            condition_level: selectedLevels.condition,
            intensity_level: selectedLevels.intensity,
            fatigue_level: selectedLevels.fatigue,
            sets: [],
            notes: null
        };
        
        try {
            await updateWorkoutRecord(record.id, updates);
            
            closeModal();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('텍스트 기록 수정 오류:', error);
            alert(error.message || '텍스트 기록 수정 중 오류가 발생했습니다.');
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
