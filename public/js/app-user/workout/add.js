// 운동기록 추가 모달

import { formatDate, getToday, escapeHtml } from '../utils.js';
import { addWorkoutRecord, getWorkoutTypes, isFavoriteWorkout, addFavoriteWorkout, removeFavoriteWorkout, getFavoriteWorkouts, getUserSettings, updateUserSettings } from '../api.js';

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
    
    // 분류 목록 가져오기 (1~4번 분류)
    let allCategories = {};
    try {
        const [cat1, cat2, cat3, cat4] = await Promise.all([
            fetch('/api/workout-categories/1').then(r => r.json()),
            fetch('/api/workout-categories/2').then(r => r.json()),
            fetch('/api/workout-categories/3').then(r => r.json()),
            fetch('/api/workout-categories/4').then(r => r.json())
        ]);
        allCategories = { 1: cat1, 2: cat2, 3: cat3, 4: cat4 };
    } catch (error) {
        console.error('분류 조회 오류:', error);
    }
    
    // 운동종류 목록 가져오기
    let allWorkoutTypes = [];
    try {
        allWorkoutTypes = await getWorkoutTypes();
    } catch (error) {
        console.error('운동종류 조회 오류:', error);
    }
    
    // 즐겨찾기 운동 목록 가져오기
    let favoriteWorkoutIds = new Set();
    try {
        const favorites = await getFavoriteWorkouts(appUserId);
        favoriteWorkoutIds = new Set(favorites.map(f => f.workout_type_id));
    } catch (error) {
        console.error('즐겨찾기 운동 조회 오류:', error);
    }
    
    // 각 분류 선택 옵션 생성
    const getCategoryOptions = (categoryLevel) => {
        let options = '<option value="">선택안함</option>';
        (allCategories[categoryLevel] || []).forEach(cat => {
            options += `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`;
        });
        return options;
    };
    
    // 필터링 함수: 선택된 분류들로 운동 종류 필터링
    const filterWorkoutTypes = (selectedCategories) => {
        let filtered = allWorkoutTypes;
        
        // 분류1로 필터링
        if (selectedCategories.category_1_id) {
            filtered = filtered.filter(type => 
                type.category_1_id === selectedCategories.category_1_id
            );
        }
        
        // 분류2로 필터링
        if (selectedCategories.category_2_id) {
            filtered = filtered.filter(type => 
                type.category_2_id === selectedCategories.category_2_id
            );
        }
        
        // 분류3으로 필터링
        if (selectedCategories.category_3_id) {
            filtered = filtered.filter(type => 
                type.category_3_id === selectedCategories.category_3_id
            );
        }
        
        // 분류4로 필터링
        if (selectedCategories.category_4_id) {
            filtered = filtered.filter(type => 
                type.category_4_id === selectedCategories.category_4_id
            );
        }
        
        return filtered;
    };
    
    // 분류 필터 버튼 HTML 생성
    const createCategoryFilterButtons = () => {
        const categoryLabels = {
            1: '장비',
            2: '부위',
            3: '도구',
            4: '분류4'
        };
        
        let html = '';
        for (let i = 1; i <= 4; i++) {
            const categories = allCategories[i] || [];
            if (categories.length > 0) {
                html += `<div class="workout-filter-group">
                    <div class="workout-filter-label">${categoryLabels[i] || `분류${i}`}</div>
                    <div class="workout-filter-buttons">`;
                categories.forEach(cat => {
                    html += `<button type="button" class="workout-filter-btn" data-category="${i}" data-id="${cat.id}">${escapeHtml(cat.name)}</button>`;
                });
                html += `</div></div>`;
            }
        }
        return html;
    };
    
    // 운동 목록 HTML 생성
    const createWorkoutListHTML = (workoutTypes) => {
        if (workoutTypes.length === 0) {
            return '<div class="workout-list-empty">운동 종류가 없습니다</div>';
        }
        return workoutTypes.map(type => {
            const isFavorite = favoriteWorkoutIds.has(type.id);
            return `
            <div class="workout-list-item" data-id="${type.id}" data-type="${type.type || '세트'}">
                <div class="workout-list-name">${escapeHtml(type.name)}</div>
                <button type="button" class="workout-list-favorite-btn" data-workout-id="${type.id}" title="${isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                </button>
            </div>
        `;
        }).join('');
    };
    
    modal.innerHTML = `
        <div class="app-modal-header">
            <h2>운동 선택 (${dateDisplay})</h2>
            <button class="app-modal-close" aria-label="닫기">×</button>
        </div>
        <form class="app-modal-form" id="workout-select-form">
            <div class="app-form-group workout-search-group">
                <button type="button" class="workout-favorite-filter-btn" id="workout-favorite-filter-btn" title="즐겨찾기만 보기">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                </button>
                <input type="text" id="workout-search" placeholder="운동 검색" autocomplete="off">
            </div>
            <div class="workout-filter-container">
                ${createCategoryFilterButtons()}
            </div>
            <div class="app-form-group">
                <div class="workout-list-container" id="workout-list">
                    ${createWorkoutListHTML(allWorkoutTypes)}
                </div>
            </div>
            <div class="app-modal-actions">
                <button type="button" class="app-btn-secondary" id="workout-select-cancel">취소</button>
                <button type="submit" class="app-btn-primary" id="workout-select-next" disabled>다음</button>
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
    const searchInput = modal.querySelector('#workout-search');
    const workoutList = modal.querySelector('#workout-list');
    const nextBtn = modal.querySelector('#workout-select-next');
    
    // 선택된 분류 및 운동 상태 관리
    let selectedCategories = {
        category_1_id: null,
        category_2_id: null,
        category_3_id: null,
        category_4_id: null
    };
    let selectedWorkoutId = null;
    let selectedWorkoutType = null;
    let searchQuery = '';
    let showFavoritesOnly = false;
    
    const favoriteFilterBtn = modal.querySelector('#workout-favorite-filter-btn');
    
    // 운동 목록 업데이트 함수 (분류 필터 + 검색 + 즐겨찾기)
    const updateWorkoutList = () => {
        // 분류로 필터링
        let filteredTypes = filterWorkoutTypes(selectedCategories);
        
        // 즐겨찾기 필터링
        if (showFavoritesOnly) {
            filteredTypes = filteredTypes.filter(type => 
                favoriteWorkoutIds.has(type.id)
            );
        }
        
        // 검색어로 필터링
        if (searchQuery.trim()) {
            const query = searchQuery.trim().toLowerCase();
            filteredTypes = filteredTypes.filter(type => 
                type.name.toLowerCase().includes(query)
            );
        }
        
        // 운동 목록 HTML 업데이트
        workoutList.innerHTML = createWorkoutListHTML(filteredTypes);
        
        // 운동 목록 아이템 클릭 이벤트
        workoutList.querySelectorAll('.workout-list-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // 즐겨찾기 버튼 클릭은 제외
                if (e.target.closest('.workout-list-favorite-btn')) {
                    return;
                }
                
                const itemId = item.getAttribute('data-id');
                
                // 같은 항목을 다시 클릭한 경우 선택 해제
                if (item.classList.contains('selected') && selectedWorkoutId === itemId) {
                    item.classList.remove('selected');
                    selectedWorkoutId = null;
                    selectedWorkoutType = null;
                    nextBtn.disabled = true;
                } else {
                    // 이전 선택 제거
                    workoutList.querySelectorAll('.workout-list-item').forEach(i => {
                        i.classList.remove('selected');
                    });
                    
                    // 현재 선택 추가
                    item.classList.add('selected');
                    selectedWorkoutId = itemId;
                    selectedWorkoutType = item.getAttribute('data-type');
                    nextBtn.disabled = false;
                }
            });
        });
        
        // 즐겨찾기 버튼 클릭 이벤트
        workoutList.querySelectorAll('.workout-list-favorite-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation(); // 아이템 클릭 이벤트 방지
                
                const workoutId = btn.getAttribute('data-workout-id');
                const isFavorite = favoriteWorkoutIds.has(workoutId);
                const svg = btn.querySelector('svg');
                
                try {
                    if (isFavorite) {
                        // 즐겨찾기 해제
                        await removeFavoriteWorkout(appUserId, workoutId);
                        favoriteWorkoutIds.delete(workoutId);
                        if (svg) svg.setAttribute('fill', 'none');
                        btn.setAttribute('title', '즐겨찾기 추가');
                    } else {
                        // 즐겨찾기 추가
                        await addFavoriteWorkout(appUserId, workoutId);
                        favoriteWorkoutIds.add(workoutId);
                        if (svg) svg.setAttribute('fill', 'currentColor');
                        btn.setAttribute('title', '즐겨찾기 해제');
                    }
                } catch (error) {
                    console.error('즐겨찾기 업데이트 오류:', error);
                }
            });
        });
    };
    
    // 즐겨찾기 필터 버튼 클릭 이벤트
    if (favoriteFilterBtn) {
        favoriteFilterBtn.addEventListener('click', async () => {
            showFavoritesOnly = !showFavoritesOnly;
            if (showFavoritesOnly) {
                favoriteFilterBtn.classList.add('active');
                const polygon = favoriteFilterBtn.querySelector('svg polygon');
                if (polygon) polygon.setAttribute('fill', 'currentColor');
            } else {
                favoriteFilterBtn.classList.remove('active');
                const polygon = favoriteFilterBtn.querySelector('svg polygon');
                if (polygon) polygon.removeAttribute('fill');
            }
            updateWorkoutList();
            
            // 사용자 설정에 즉시 저장
            try {
                await updateUserSettings(appUserId, {
                    show_favorites_only: showFavoritesOnly
                });
            } catch (error) {
                console.error('사용자 설정 저장 오류:', error);
            }
        });
    }
    
    // 검색어 입력 이벤트
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        updateWorkoutList();
    });
    
    // 분류 필터 버튼 클릭 이벤트
    const filterButtons = modal.querySelectorAll('.workout-filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const categoryNum = parseInt(btn.getAttribute('data-category'));
            const categoryId = btn.getAttribute('data-id');
            const categoryField = `category_${categoryNum}_id`;
            
            // 토글: 같은 분류 내에서는 하나만 선택 가능
            if (selectedCategories[categoryField] === categoryId) {
                // 이미 선택된 경우 해제
                selectedCategories[categoryField] = null;
                btn.classList.remove('active');
            } else {
                // 같은 분류의 다른 버튼들 비활성화
                filterButtons.forEach(b => {
                    if (b.getAttribute('data-category') === categoryNum.toString()) {
                        b.classList.remove('active');
                    }
                });
                // 현재 버튼 선택
                selectedCategories[categoryField] = categoryId;
                btn.classList.add('active');
            }
            
            updateWorkoutList();
        });
    });
    
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
        
        if (!selectedWorkoutId) {
            alert('운동 종류를 선택해주세요.');
            return;
        }
        
        // 선택 모달 닫기
        closeModal();
        
        // 추가 모달 열기 (선택한 운동 종류 전달)
        setTimeout(() => {
            showAddModal(appUserId, selectedDate, selectedWorkoutId, selectedWorkoutType, onSuccess);
        }, 200);
    });
    
    // 사용자 설정에서 즐겨찾기 필터 옵션 불러오기 후 초기 렌더링 (updateWorkoutList 정의 후)
    (async () => {
        try {
            const settings = await getUserSettings(appUserId);
            if (settings.show_favorites_only === true) {
                showFavoritesOnly = true;
                favoriteFilterBtn.classList.add('active');
                const polygon = favoriteFilterBtn.querySelector('svg polygon');
                if (polygon) polygon.setAttribute('fill', 'currentColor');
            }
        } catch (error) {
            console.error('사용자 설정 조회 오류:', error);
        } finally {
            // 설정 로드 완료 후 (성공/실패 관계없이) 초기 운동 목록 렌더링
            updateWorkoutList();
        }
    })();
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
    
    // 선택된 운동 종류 정보 가져오기
    let selectedWorkoutTypeInfo = null;
    let isFavorite = false;
    
    if (preselectedWorkoutTypeId) {
        // 운동종류 목록 가져오기
        let workoutTypes = [];
        try {
            workoutTypes = await getWorkoutTypes();
            selectedWorkoutTypeInfo = workoutTypes.find(type => type.id === preselectedWorkoutTypeId);
            
            // 즐겨찾기 여부 확인
            try {
                const favoriteCheck = await isFavoriteWorkout(appUserId, preselectedWorkoutTypeId);
                isFavorite = favoriteCheck.isFavorite || false;
            } catch (error) {
                console.error('즐겨찾기 여부 확인 오류:', error);
            }
        } catch (error) {
            console.error('운동종류 조회 오류:', error);
        }
    }
    
    modal.innerHTML = `
        <div class="app-modal-header">
            <h2>운동기록 추가 (${dateDisplay})</h2>
            <button class="app-modal-close" aria-label="닫기">×</button>
        </div>
        <form class="app-modal-form" id="workout-add-form">
            <input type="hidden" id="workout-add-date" value="${defaultDate}">
            <input type="hidden" id="workout-add-type" value="${preselectedWorkoutTypeId || ''}">
            <input type="hidden" id="workout-add-type-type" value="${preselectedWorkoutType || ''}">
            ${preselectedWorkoutTypeId && selectedWorkoutTypeInfo ? `
            <div class="app-form-group">
                <label>💪 운동 종류</label>
                <div class="workout-type-display">
                    <span class="workout-type-name">${escapeHtml(selectedWorkoutTypeInfo.name)}</span>
                    <button type="button" class="workout-favorite-btn ${isFavorite ? 'active' : ''}" id="workout-favorite-btn" data-workout-type-id="${preselectedWorkoutTypeId}">
                        ${isFavorite ? `
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor"/>
                            </svg>
                        ` : `
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                            </svg>
                        `}
                    </button>
                </div>
            </div>
            ` : `
            <div class="app-form-group">
                <label>운동을 먼저 선택해주세요</label>
            </div>
            `}
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
    const typeSelectInput = modal.querySelector('#workout-add-type');
    const durationGroup = modal.querySelector('#workout-add-duration-group');
    const setsGroup = modal.querySelector('#workout-add-sets-group');
    const setsContainer = modal.querySelector('#workout-add-sets-container');
    const addSetBtn = modal.querySelector('#workout-add-set-btn');
    const favoriteBtn = modal.querySelector('#workout-favorite-btn');
    
    let sets = [];
    let currentIsFavorite = isFavorite;
    
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
    
    // 즐겨찾기 버튼 클릭 이벤트
    if (favoriteBtn) {
        favoriteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const workoutTypeId = favoriteBtn.getAttribute('data-workout-type-id');
            if (!workoutTypeId) return;
            
            try {
                if (currentIsFavorite) {
                    // 즐겨찾기 삭제
                    await removeFavoriteWorkout(appUserId, workoutTypeId);
                    currentIsFavorite = false;
                    favoriteBtn.classList.remove('active');
                    favoriteBtn.innerHTML = `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                    `;
                } else {
                    // 즐겨찾기 추가
                    await addFavoriteWorkout(appUserId, workoutTypeId);
                    currentIsFavorite = true;
                    favoriteBtn.classList.add('active');
                    favoriteBtn.innerHTML = `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor"/>
                        </svg>
                    `;
                }
            } catch (error) {
                console.error('즐겨찾기 토글 오류:', error);
                alert(error.message || '즐겨찾기 처리 중 오류가 발생했습니다.');
            }
        });
    }
    
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
                        <input type="number" class="workout-set-weight" data-index="${index}" step="1" min="0" placeholder="0" value="${set.weight !== null && set.weight !== undefined ? Math.round(set.weight) : ''}" inputmode="numeric">
                    </div>
                    <div class="workout-set-input-group">
                        <label>횟수</label>
                        <input type="number" class="workout-set-reps" data-index="${index}" min="0" placeholder="0" value="${set.reps !== null && set.reps !== undefined ? set.reps : ''}" inputmode="numeric">
                    </div>
                </div>
            </div>
        `).join('');
        
        // 세트 입력값 변경 이벤트
        setsContainer.querySelectorAll('.workout-set-weight').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.getAttribute('data-index'));
                const value = e.target.value.trim();
                // 빈 문자열이면 null, 그 외에는 숫자로 변환 (0도 유효한 값)
                sets[index].weight = value === '' ? null : (isNaN(parseInt(value)) ? null : parseInt(value));
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
                const value = e.target.value.trim();
                // 빈 문자열이면 null, 그 외에는 숫자로 변환 (0도 유효한 값)
                sets[index].reps = value === '' ? null : (isNaN(parseInt(value)) ? null : parseInt(value));
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
        const workoutType = document.getElementById('workout-add-type-type').value || preselectedWorkoutType;
        const durationMinutes = document.getElementById('workout-add-duration').value;
        
        // 시간 타입인 경우: 입력값이 없으면 30분으로 설정
        let finalDurationMinutes = null;
        if (workoutType === '시간') {
            finalDurationMinutes = durationMinutes ? parseInt(durationMinutes) : 30;
        }
        
        // 세트 타입인 경우: 입력값이 없으면 weight: 0, reps: 0인 세트 하나 추가
        let finalSets = [];
        if (workoutType === '세트') {
            // 모든 세트를 포함 (0도 유효한 값이므로 필터링하지 않음)
            if (sets.length === 0) {
                // 입력된 세트가 없으면 기본 세트 하나 추가 (weight: 0, reps: 0)
                finalSets = [{ set_number: 1, weight: 0, reps: 0 }];
            } else {
                // 입력된 세트가 있으면, weight나 reps가 null인 경우 0으로 설정
                // 0도 유효한 값이므로 그대로 유지
                finalSets = sets.map(set => ({
                    set_number: set.set_number,
                    weight: set.weight !== null && set.weight !== undefined ? set.weight : 0,
                    reps: set.reps !== null && set.reps !== undefined ? set.reps : 0
                }));
            }
        }
        
        const workoutData = {
            app_user_id: appUserId,
            workout_date: workoutDate,
            workout_type_id: workoutTypeId || null,
            duration_minutes: finalDurationMinutes,
            sets: finalSets,
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
