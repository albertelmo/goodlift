// 운동기록 추가 모달

import { formatDate, getToday, escapeHtml, formatWeight, parseWeight, parseWorkoutDurationInputs, formatWorkoutDuration } from '../utils.js';
import { addWorkoutRecord, addWorkoutRecordsBatch, getWorkoutTypes, getWorkoutRecords, isFavoriteWorkout, addFavoriteWorkout, removeFavoriteWorkout, getFavoriteWorkouts, getUserSettings, updateUserSettings } from '../api.js';
import { getCurrentUser } from '../index.js';

// ========== 캐시 변수 (모듈 레벨) ==========
let cachedWorkoutTypes = null;
let cachedCategories = null;
let preloadPromise = null;
let isPreloading = false;
const FAVORITES_ONLY_STORAGE_KEY = 'workout_show_favorites_only';

function getCachedShowFavoritesOnly() {
    try {
        const stored = localStorage.getItem(FAVORITES_ONLY_STORAGE_KEY);
        if (stored === null) {
            return null;
        }
        return stored === 'true';
    } catch (e) {
        // ignore
    }
    return null;
}

function setCachedShowFavoritesOnly(value) {
    try {
        localStorage.setItem(FAVORITES_ONLY_STORAGE_KEY, value ? 'true' : 'false');
    } catch (e) {
        // ignore
    }
}

/**
 * 백그라운드 프리로딩
 * 운동 탭 진입 시 호출되어 데이터를 미리 로드
 */
export async function preloadWorkoutData() {
    // 이미 캐시되어 있으면 즉시 반환
    if (cachedWorkoutTypes && cachedCategories) {
        return Promise.resolve();
    }
    
    // 이미 로딩 중이면 기존 Promise 반환
    if (isPreloading && preloadPromise) {
        return preloadPromise;
    }
    
    isPreloading = true;
    
    preloadPromise = (async () => {
        try {
            console.log('[Workout Preload] 백그라운드 로딩 시작...');
            const startTime = performance.now();
            
            // 병렬로 로딩
            const [workoutTypes, cat1, cat2, cat3, cat4] = await Promise.all([
                getWorkoutTypes(),
                fetch('/api/workout-categories/1').then(r => r.json()),
                fetch('/api/workout-categories/2').then(r => r.json()),
                fetch('/api/workout-categories/3').then(r => r.json()),
                fetch('/api/workout-categories/4').then(r => r.json())
            ]);
            
            cachedWorkoutTypes = workoutTypes;
            cachedCategories = { 1: cat1, 2: cat2, 3: cat3, 4: cat4 };
            
            const endTime = performance.now();
            console.log(`[Workout Preload] 완료! (${(endTime - startTime).toFixed(0)}ms, ${workoutTypes.length}개 운동)`);
        } catch (error) {
            console.error('[Workout Preload] 오류:', error);
            // 오류 발생 시 캐시 초기화하여 다음 시도 가능하게
            cachedWorkoutTypes = null;
            cachedCategories = null;
        } finally {
            isPreloading = false;
        }
    })();
    
    return preloadPromise;
}

/**
 * 캐시 초기화 (필요 시 수동 호출)
 */
export function clearWorkoutDataCache() {
    cachedWorkoutTypes = null;
    cachedCategories = null;
    preloadPromise = null;
    isPreloading = false;
    console.log('[Workout Cache] 캐시 초기화됨');
}

/**
 * 운동 선택 모달 표시 (1단계)
 */
export async function showWorkoutSelectModal(appUserId, selectedDate = null, onSuccess) {
    // 기존 모달이 있으면 제거
    const existingModals = document.querySelectorAll('.app-modal-bg');
    existingModals.forEach(modal => {
        if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    });
    
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
    
    // 프리로딩이 진행 중이면 대기
    if (preloadPromise) {
        console.log('[Workout Modal] 프리로딩 대기 중...');
        await preloadPromise;
    }
    
    // 캐시에서 데이터 가져오기 (없으면 로드)
    let allCategories = {};
    let allWorkoutTypes = [];
    
    try {
        if (!cachedCategories) {
            console.log('[Workout Modal] 분류 목록 로드 중...');
            const [cat1, cat2, cat3, cat4] = await Promise.all([
                fetch('/api/workout-categories/1').then(r => r.json()),
                fetch('/api/workout-categories/2').then(r => r.json()),
                fetch('/api/workout-categories/3').then(r => r.json()),
                fetch('/api/workout-categories/4').then(r => r.json())
            ]);
            cachedCategories = { 1: cat1, 2: cat2, 3: cat3, 4: cat4 };
        }
        allCategories = cachedCategories;
        console.log('[Workout Modal] 분류 목록: 캐시 사용');
    } catch (error) {
        console.error('분류 조회 오류:', error);
    }
    
    try {
        if (!cachedWorkoutTypes) {
            console.log('[Workout Modal] 운동종류 목록 로드 중...');
            cachedWorkoutTypes = await getWorkoutTypes();
        }
        allWorkoutTypes = cachedWorkoutTypes;
        console.log(`[Workout Modal] 운동종류 목록: 캐시 사용 (${allWorkoutTypes.length}개)`);
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
    
    // 선택된 분류 및 운동 상태 관리 (modal.innerHTML 위에서 선언)
    let selectedCategories = {
        category_1_id: null,
        category_2_id: null,
        category_3_id: null,
        category_4_id: null
    };
    // 다중 선택을 위한 Set (필터링 변경 시에도 유지)
    let selectedWorkoutIds = new Set(); // { workoutId: { id, type } }
    let selectedWorkoutMap = new Map(); // { workoutId: { id, type } }
    let searchQuery = '';
    let showFavoritesOnly = false;
    
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
        let html = '';
        for (let i = 1; i <= 4; i++) {
            const categories = allCategories[i] || [];
            if (categories.length > 0) {
                html += `<div class="workout-filter-group">
                    <div class="workout-filter-buttons">`;
                categories.forEach(cat => {
                    html += `<button type="button" class="workout-filter-btn" data-category="${i}" data-id="${cat.id}" tabindex="-1">${escapeHtml(cat.name)}</button>`;
                });
                html += `</div></div>`;
            }
        }
        return html;
    };
    
    // 운동 목록 HTML 생성
    const createWorkoutListHTML = (workoutTypes, selectedWorkoutIds = new Set()) => {
        if (workoutTypes.length === 0) {
            return '<div class="workout-list-empty">운동 종류가 없습니다</div>';
        }
        return workoutTypes.map(type => {
            const isFavorite = favoriteWorkoutIds.has(type.id);
            const isChecked = selectedWorkoutIds.has(type.id);
            return `
            <div class="workout-list-item" data-id="${type.id}" data-type="${type.type || '세트'}">
                <input type="checkbox" class="workout-list-checkbox" data-workout-id="${type.id}" ${isChecked ? 'checked' : ''}>
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
            <button class="app-modal-close" aria-label="닫기" tabindex="-1">×</button>
        </div>
        <form class="app-modal-form" id="workout-select-form">
            <div class="app-form-group workout-search-group">
                <button type="button" class="workout-favorite-filter-btn" id="workout-favorite-filter-btn" title="즐겨찾기만 보기" tabindex="-1">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                </button>
                <input type="text" id="workout-search" placeholder="운동 검색" autocomplete="off" tabindex="-1">
            </div>
            <div class="workout-filter-container">
                ${createCategoryFilterButtons()}
            </div>
            <div class="app-form-group">
                <div class="workout-list-container" id="workout-list">
                    ${createWorkoutListHTML(allWorkoutTypes, selectedWorkoutIds)}
                </div>
            </div>
            <div class="app-modal-actions" style="justify-content: flex-end;">
                <button type="button" class="app-btn-secondary" id="workout-select-cancel">취소</button>
                <button type="submit" class="app-btn-primary" id="workout-select-add" disabled>0개의 운동추가</button>
            </div>
        </form>
    `;
    
    document.body.appendChild(modalBg);
    
    // 이벤트 리스너 (모달 열기 애니메이션 전에 설정)
    const closeBtn = modal.querySelector('.app-modal-close');
    const cancelBtn = modal.querySelector('#workout-select-cancel');
    const form = modal.querySelector('#workout-select-form');
    const searchInput = modal.querySelector('#workout-search');
    
    // 모달 열기 애니메이션
    setTimeout(() => {
        modalBg.classList.add('app-modal-show');
        modal.classList.add('app-modal-show');
        
        // 포커스 방지: 버튼과 다른 요소만 포커스 방지 (input 필드는 키보드 입력을 위해 제외)
        const preventFocus = (e) => {
            const target = e.target;
            // input, textarea, select는 키보드 입력을 위해 포커스 허용
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
                return; // input 필드는 포커스 허용
            }
            e.preventDefault();
            e.stopPropagation();
            if (target && target.blur) {
                target.blur();
            }
        };
        
        // 모달 내 버튼과 다른 요소에만 포커스 방지 (input 필드는 제외)
        const allFocusableElements = modal.querySelectorAll('button, [tabindex]:not(input):not(textarea):not(select)');
        allFocusableElements.forEach(el => {
            // focus 이벤트 차단
            el.addEventListener('focus', preventFocus, { capture: true });
            // focusin 이벤트도 차단 (버블링 단계)
            el.addEventListener('focusin', preventFocus, { capture: true });
        });
        
        // 동적으로 추가되는 요소에도 적용하기 위해 모달에 이벤트 위임 (input 필드는 제외)
        modal.addEventListener('focusin', (e) => {
            const target = e.target;
            // input, textarea, select는 키보드 입력을 위해 포커스 허용
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
                return; // input 필드는 포커스 허용
            }
            if (modal.contains(target)) {
                e.preventDefault();
                e.stopPropagation();
                if (target && target.blur) {
                    target.blur();
                }
            }
        }, { capture: true });
        
        // 초기 포커스 제거 (input 필드는 제외)
        const removeFocus = () => {
            const activeEl = document.activeElement;
            // input 필드가 아닌 경우에만 blur
            if (activeEl && modal.contains(activeEl) && activeEl.blur && 
                activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA' && activeEl.tagName !== 'SELECT') {
                activeEl.blur();
            }
        };
        
        removeFocus();
        setTimeout(removeFocus, 50);
        setTimeout(removeFocus, 100);
    }, 10);
    const workoutList = modal.querySelector('#workout-list');
    const addBtn = modal.querySelector('#workout-select-add');
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
        
        // 운동 목록 HTML 업데이트 (선택 상태 유지)
        workoutList.innerHTML = createWorkoutListHTML(filteredTypes, selectedWorkoutIds);
        
        // 체크박스 변경 이벤트
        workoutList.querySelectorAll('.workout-list-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const workoutId = checkbox.getAttribute('data-workout-id');
                const workoutItem = checkbox.closest('.workout-list-item');
                const workoutType = workoutItem.getAttribute('data-type');
                
                if (checkbox.checked) {
                    selectedWorkoutIds.add(workoutId);
                    selectedWorkoutMap.set(workoutId, { id: workoutId, type: workoutType });
                } else {
                    selectedWorkoutIds.delete(workoutId);
                    selectedWorkoutMap.delete(workoutId);
                }
                
                // 버튼 텍스트 및 상태 업데이트
                updateAddButton();
            });
        });
        
        // 운동 목록 아이템 클릭 이벤트 (체크박스 제외)
        workoutList.querySelectorAll('.workout-list-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // 즐겨찾기 버튼이나 체크박스 클릭은 제외
                if (e.target.closest('.workout-list-favorite-btn') || e.target.closest('.workout-list-checkbox')) {
                    return;
                }
                
                // 체크박스 토글
                const checkbox = item.querySelector('.workout-list-checkbox');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
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
                setCachedShowFavoritesOnly(showFavoritesOnly);
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
        // 모달 닫기 애니메이션
        modalBg.classList.remove('app-modal-show');
        modal.classList.remove('app-modal-show');
        // 모달 DOM에서 제거
        setTimeout(() => {
            if (modalBg && modalBg.parentNode) {
                modalBg.parentNode.removeChild(modalBg);
            }
        }, 200);
    };
    
    closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
    });
    cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
    });
    
    // 선택된 운동 개수에 따라 버튼 업데이트
    const updateAddButton = () => {
        const count = selectedWorkoutIds.size;
        addBtn.textContent = `${count}개의 운동추가`;
        addBtn.disabled = count === 0;
    };
    
    // 폼 제출 시 입력 모달 열기 (한 번만 실행되도록 플래그 사용)
    let isSubmitting = false;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // 이미 제출 중이면 무시
        if (isSubmitting) {
            return;
        }
        
        if (selectedWorkoutIds.size === 0) {
            alert('운동 종류를 선택해주세요.');
            return;
        }
        
        isSubmitting = true;
        
        // 선택 모달 닫기
        closeModal();
        
        // 입력 모달 열기 (모달이 완전히 닫힌 후)
        setTimeout(() => {
            showWorkoutInputModal(appUserId, selectedDate, Array.from(selectedWorkoutIds), selectedWorkoutMap, allWorkoutTypes, onSuccess);
            isSubmitting = false;
        }, 250);
    });
    
    // 사용자 설정에서 즐겨찾기 필터 옵션 불러오기 후 초기 렌더링 (updateWorkoutList 정의 후)
    (async () => {
        try {
            const cachedShowFavoritesOnly = getCachedShowFavoritesOnly();
            if (cachedShowFavoritesOnly !== null) {
                showFavoritesOnly = cachedShowFavoritesOnly;
            } else {
            const settings = await getUserSettings(appUserId);
                showFavoritesOnly = settings.show_favorites_only === true;
                setCachedShowFavoritesOnly(showFavoritesOnly);
            }
            if (showFavoritesOnly) {
                favoriteFilterBtn.classList.add('active');
                const polygon = favoriteFilterBtn.querySelector('svg polygon');
                if (polygon) polygon.setAttribute('fill', 'currentColor');
            }
        } catch (error) {
            console.error('사용자 설정 조회 오류:', error);
        } finally {
            // 설정 로드 완료 후 (성공/실패 관계없이) 초기 운동 목록 렌더링
            updateWorkoutList();
            // 초기 버튼 상태 업데이트 (updateAddButton이 정의된 후 호출)
            const count = selectedWorkoutIds.size;
            addBtn.textContent = `${count}개의 운동추가`;
            addBtn.disabled = count === 0;
        }
    })();
}

/**
 * 운동 입력 모달 표시 (선택한 여러 운동의 세트/시간 입력)
 */
async function showWorkoutInputModal(appUserId, selectedDate, workoutIds, workoutMap, allWorkoutTypes, onSuccess) {
    const modalBg = createModal();
    const modal = modalBg.querySelector('.app-modal');
    
    // 모달에 클래스 추가 (CSS에서 반응형 처리)
    modal.classList.add('workout-input-modal');
    
    // 선택된 날짜가 있으면 사용, 없으면 오늘 날짜
    const defaultDate = selectedDate || getToday();
    
    // 날짜를 "YY.M.D" 형식으로 변환
    const dateObj = new Date(defaultDate);
    const year = dateObj.getFullYear().toString().slice(-2);
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    const dateDisplay = `${year}.${month}.${day}`;
    
    // 선택한 운동들의 정보 가져오기
    const selectedWorkouts = workoutIds.map(id => {
        const workoutInfo = workoutMap.get(id);
        const workoutType = allWorkoutTypes.find(w => w.id === id);
        return {
            id: id,
            name: workoutType?.name || '',
            type: workoutInfo?.type || workoutType?.type || '세트',
            durationMinutes: null,
            durationSeconds: null,
            sets: []
        };
    });
    
    // 각 운동의 입력 HTML 생성
    const createWorkoutInputHTML = (workout, index) => {
        if (workout.type === '시간') {
            return `
                <div class="workout-input-card" data-workout-index="${index}">
                    <div class="workout-input-header">
                        <h4 class="workout-input-name">${escapeHtml(workout.name)}</h4>
                        <button type="button" class="workout-input-history-btn" data-workout-id="${workout.id}" data-workout-name="${escapeHtml(workout.name)}">최근 기록</button>
                    </div>
                    <div class="workout-input-body">
                        <div class="app-form-group" style="margin-bottom: 0;">
                            <label>시간 (분 · 초)</label>
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <input type="number" id="workout-input-duration-m-${index}" class="workout-input-duration-m" data-workout-index="${index}" min="0" placeholder="0" value="${workout.durationMinutes != null ? workout.durationMinutes : ''}" inputmode="numeric" style="width: 72px;">
                                <span style="color: #666;">분</span>
                                <input type="number" id="workout-input-duration-s-${index}" class="workout-input-duration-s" data-workout-index="${index}" min="0" max="59" placeholder="0" value="${workout.durationSeconds != null ? workout.durationSeconds : ''}" inputmode="numeric" style="width: 72px;">
                                <span style="color: #666;">초</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            const setsHTML = workout.sets.length > 0 
                ? workout.sets.map((set, setIndex) => `
                    <div class="workout-input-set-item" data-set-index="${setIndex}">
                        <div class="workout-input-set-header">
                            <span class="workout-input-set-number">${set.set_number} 세트</span>
                        </div>
                        <div class="workout-input-set-inputs">
                            <div class="workout-set-input-group">
                                <label>무게 (kg)</label>
                                <input type="number" class="workout-input-set-weight" data-workout-index="${index}" data-set-index="${setIndex}" step="0.01" min="0" max="999.99" placeholder="0" value="${set.weight !== null && set.weight !== undefined ? parseFloat(set.weight) : ''}" inputmode="decimal">
                            </div>
                            <div class="workout-set-input-group">
                                <label>횟수</label>
                                <input type="number" class="workout-input-set-reps" data-workout-index="${index}" data-set-index="${setIndex}" min="0" placeholder="0" value="${set.reps !== null && set.reps !== undefined ? set.reps : ''}" inputmode="numeric">
                            </div>
                        </div>
                    </div>
                `).join('')
                : '';
            
            return `
                <div class="workout-input-card" data-workout-index="${index}">
                    <div class="workout-input-header">
                        <h4 class="workout-input-name">${escapeHtml(workout.name)}</h4>
                        <button type="button" class="workout-input-history-btn" data-workout-id="${workout.id}" data-workout-name="${escapeHtml(workout.name)}">최근 기록</button>
                    </div>
                    <div class="workout-input-body">
                        <div class="workout-input-sets-container" id="workout-input-sets-${index}">
                            ${setsHTML}
                        </div>
                        <div class="workout-input-set-controls" style="display: flex; gap: 12px; align-items: center; justify-content: center; margin-top: 12px;">
                            <button type="button" class="workout-input-remove-set-btn" data-workout-index="${index}" style="width: 32px; height: 32px; border: 1px solid #ddd; background: #fff; color: #333; border-radius: 4px; cursor: pointer; font-size: 20px; font-weight: bold; line-height: 1; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0; box-sizing: border-box;">−</button>
                            <span style="font-size: 14px; color: #333; display: flex; align-items: center; line-height: 1; height: 32px; margin: 0; padding: 0;">세트</span>
                            <button type="button" class="workout-input-add-set-btn" data-workout-index="${index}" style="width: 32px; height: 32px; border: 1px solid #1976d2; background: #1976d2; color: #fff; border-radius: 4px; cursor: pointer; font-size: 20px; font-weight: bold; line-height: 1; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0; box-sizing: border-box;">+</button>
                        </div>
                    </div>
                </div>
            `;
        }
    };
    
    modal.innerHTML = `
        <div class="app-modal-header">
            <h2>운동 추가 (${dateDisplay})</h2>
            <button class="app-modal-close" aria-label="닫기">×</button>
        </div>
        <form class="app-modal-form" id="workout-input-form">
            <input type="hidden" id="workout-input-date" value="${defaultDate}">
            <div class="workout-input-list">
                ${selectedWorkouts.map((workout, index) => createWorkoutInputHTML(workout, index)).join('')}
            </div>
        </form>
        <div class="app-modal-actions" style="justify-content: flex-end;">
            <button type="button" class="app-btn-secondary" id="workout-input-cancel">취소</button>
            <button type="submit" form="workout-input-form" class="app-btn-primary">등록</button>
        </div>
    `;
    
    document.body.appendChild(modalBg);
    
    // 모달 열기 애니메이션
    setTimeout(() => {
        modalBg.classList.add('app-modal-show');
        modal.classList.add('app-modal-show');
    }, 10);
    
    // 초기값 설정: 세트 타입인 경우 기본 세트 1개 추가
    selectedWorkouts.forEach((workout, index) => {
        if (workout.type === '세트' && workout.sets.length === 0) {
            workout.sets.push({ set_number: 1, weight: null, reps: null });
        }
    });
    
    // 세트 추가 버튼 이벤트
    modal.querySelectorAll('.workout-input-add-set-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const workoutIndex = parseInt(btn.getAttribute('data-workout-index'));
            const workout = selectedWorkouts[workoutIndex];
            if (!workout || workout.type !== '세트') return;
            
            const setNumber = workout.sets.length + 1;
            const lastSet = workout.sets.length > 0 ? workout.sets[workout.sets.length - 1] : null;
            const newWeight = lastSet ? lastSet.weight : null;
            const newReps = lastSet ? lastSet.reps : null;
            
            workout.sets.push({ set_number: setNumber, weight: newWeight, reps: newReps });
            const newSetIndex = workout.sets.length - 1;
            renderWorkoutSets(workoutIndex, selectedWorkouts, newSetIndex);
            
            // 세트 추가 후 스크롤을 맨 아래로 이동하고 새로 추가된 세트의 첫 번째 입력 필드에 포커스
            setTimeout(() => {
                const setsContainer = modal.querySelector(`#workout-input-sets-${workoutIndex}`);
                if (setsContainer) {
                    // 세트 컨테이너만 스크롤 (모달 폼 전체는 스크롤하지 않음)
                    setsContainer.scrollTop = setsContainer.scrollHeight;
                }
                // 새로 추가된 세트의 무게 입력 필드에 포커스
                const newWeightInput = modal.querySelector(`.workout-input-set-weight[data-workout-index="${workoutIndex}"][data-set-index="${newSetIndex}"]`);
                if (newWeightInput) {
                    newWeightInput.focus();
                }
            }, 50);
        });
    });
    
    // 세트 삭제 버튼 이벤트
    modal.querySelectorAll('.workout-input-remove-set-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const workoutIndex = parseInt(btn.getAttribute('data-workout-index'));
            const workout = selectedWorkouts[workoutIndex];
            if (!workout || workout.type !== '세트') return;
            
            // 세트가 1개 이상일 때만 삭제 가능 (최소 1개는 유지)
            if (workout.sets.length > 1) {
                workout.sets.pop();
                // 세트 번호 재정렬
                workout.sets.forEach((set, i) => {
                    set.set_number = i + 1;
                });
                renderWorkoutSets(workoutIndex, selectedWorkouts, -1);
            }
        });
    });
    
    // 세트 렌더링 함수
    function renderWorkoutSets(workoutIndex, workouts, newSetIndex = -1) {
        const workout = workouts[workoutIndex];
        if (!workout || workout.type !== '세트') return;
        
        const setsContainer = modal.querySelector(`#workout-input-sets-${workoutIndex}`);
        if (!setsContainer) return;
        
        setsContainer.innerHTML = workout.sets.map((set, setIndex) => {
            const isNew = setIndex === newSetIndex;
            return `
            <div class="workout-input-set-item ${isNew ? 'workout-input-set-item-new' : ''}" data-set-index="${setIndex}">
                <div class="workout-input-set-header">
                    <span class="workout-input-set-number">${set.set_number} 세트</span>
                </div>
                <div class="workout-input-set-inputs">
                    <div class="workout-set-input-group">
                        <label>무게 (kg)</label>
                        <input type="number" class="workout-input-set-weight" data-workout-index="${workoutIndex}" data-set-index="${setIndex}" step="0.01" min="0" max="999.99" placeholder="0" value="${set.weight !== null && set.weight !== undefined ? parseFloat(set.weight) : ''}" inputmode="decimal">
                    </div>
                    <div class="workout-set-input-group">
                        <label>횟수</label>
                        <input type="number" class="workout-input-set-reps" data-workout-index="${workoutIndex}" data-set-index="${setIndex}" min="0" placeholder="0" value="${set.reps !== null && set.reps !== undefined ? set.reps : ''}" inputmode="numeric">
                    </div>
                </div>
            </div>
            `;
        }).join('');
        
        // 새로 추가된 세트 하이라이트 제거 (3초 후 또는 입력 시작 시)
        if (newSetIndex >= 0) {
            const newSetItem = setsContainer.querySelector(`.workout-input-set-item-new[data-set-index="${newSetIndex}"]`);
            if (newSetItem) {
                // 3초 후 자동으로 클래스 제거
                setTimeout(() => {
                    newSetItem.classList.remove('workout-input-set-item-new');
                }, 3000);
            }
        }
        
        // 세트 삭제 버튼 상태 업데이트 (세트가 1개일 때 비활성화)
        const removeBtn = modal.querySelector(`.workout-input-remove-set-btn[data-workout-index="${workoutIndex}"]`);
        if (removeBtn) {
            const canRemove = workout.sets.length > 1;
            removeBtn.disabled = !canRemove;
            removeBtn.style.opacity = canRemove ? '1' : '0.5';
            removeBtn.style.cursor = canRemove ? 'pointer' : 'not-allowed';
        }
        
        // 세트 입력 이벤트
        setsContainer.querySelectorAll('.workout-input-set-weight').forEach(input => {
            // 포커스 시 값 선택
            input.addEventListener('focus', (e) => {
                e.target.select();
                // 입력 시작 시 하이라이트 제거
                const setItem = e.target.closest('.workout-input-set-item');
                if (setItem) {
                    setItem.classList.remove('workout-input-set-item-new');
                }
            });
            // 입력 이벤트
            input.addEventListener('input', (e) => {
                const wIndex = parseInt(e.target.getAttribute('data-workout-index'));
                const sIndex = parseInt(e.target.getAttribute('data-set-index'));
                const value = e.target.value.trim();
                selectedWorkouts[wIndex].sets[sIndex].weight = parseWeight(value);
            });
        });
        
        setsContainer.querySelectorAll('.workout-input-set-reps').forEach(input => {
            // 포커스 시 값 선택
            input.addEventListener('focus', (e) => {
                e.target.select();
                // 입력 시작 시 하이라이트 제거
                const setItem = e.target.closest('.workout-input-set-item');
                if (setItem) {
                    setItem.classList.remove('workout-input-set-item-new');
                }
            });
            // 입력 이벤트
            input.addEventListener('input', (e) => {
                const wIndex = parseInt(e.target.getAttribute('data-workout-index'));
                const sIndex = parseInt(e.target.getAttribute('data-set-index'));
                const value = e.target.value.trim();
                selectedWorkouts[wIndex].sets[sIndex].reps = value === '' ? null : (isNaN(parseInt(value)) ? null : parseInt(value));
            });
        });
        
    }
    
    // 시간 입력 이벤트 (분 / 초)
    modal.querySelectorAll('.workout-input-duration-m').forEach(input => {
        input.addEventListener('input', (e) => {
            const workoutIndex = parseInt(e.target.closest('.workout-input-card').getAttribute('data-workout-index'), 10);
            const value = e.target.value.trim();
            selectedWorkouts[workoutIndex].durationMinutes = value === '' ? null : (isNaN(parseInt(value, 10)) ? null : parseInt(value, 10));
        });
    });
    modal.querySelectorAll('.workout-input-duration-s').forEach(input => {
        input.addEventListener('input', (e) => {
            const workoutIndex = parseInt(e.target.closest('.workout-input-card').getAttribute('data-workout-index'), 10);
            const value = e.target.value.trim();
            selectedWorkouts[workoutIndex].durationSeconds = value === '' ? null : (isNaN(parseInt(value, 10)) ? null : parseInt(value, 10));
        });
    });
    
    // 초기 렌더링
    selectedWorkouts.forEach((workout, index) => {
        if (workout.type === '세트') {
            renderWorkoutSets(index, selectedWorkouts);
        }
    });
    
    // 모달 닫기
    const closeBtn = modal.querySelector('.app-modal-close');
    const cancelBtn = modal.querySelector('#workout-input-cancel');
    const form = modal.querySelector('#workout-input-form');
    
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
    
    // 최근 기록 버튼 클릭 이벤트
    modal.querySelectorAll('.workout-input-history-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const workoutId = btn.getAttribute('data-workout-id');
            const workoutName = btn.getAttribute('data-workout-name');
            const workoutIndex = parseInt(btn.closest('.workout-input-card').getAttribute('data-workout-index'));
            
            // 불러오기 콜백 함수
            const onLoadRecord = (record) => {
                if (record) {
                    const workout = selectedWorkouts[workoutIndex];
                    if (workout) {
                        if (workout.type === '시간') {
                            const totalSec = (Number(record.duration_minutes) || 0) * 60 + (Number(record.duration_seconds) || 0);
                            if (totalSec > 0) {
                                workout.durationMinutes = record.duration_minutes != null ? Number(record.duration_minutes) : 0;
                                workout.durationSeconds = record.duration_seconds != null ? Number(record.duration_seconds) : 0;
                                const mInput = modal.querySelector(`#workout-input-duration-m-${workoutIndex}`);
                                const sInput = modal.querySelector(`#workout-input-duration-s-${workoutIndex}`);
                                if (mInput) mInput.value = workout.durationMinutes;
                                if (sInput) sInput.value = workout.durationSeconds;
                            }
                        } else if (workout.type === '세트' && record.sets && record.sets.length > 0) {
                            // 세트 정보를 불러오기 (체크 상태는 제외)
                            workout.sets = record.sets.map((set, idx) => ({
                                set_number: idx + 1,
                                weight: set.weight,
                                reps: set.reps
                            }));
                            renderWorkoutSets(workoutIndex, selectedWorkouts);
                        }
                    }
                }
            };
            
            const workout = selectedWorkouts[workoutIndex];
            const workoutType = workout?.type || null;
            await showWorkoutHistoryModal(appUserId, workoutId, workoutName, workoutType, onLoadRecord);
        });
    });
    
    // 폼 제출
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const workoutDate = document.getElementById('workout-input-date').value;
        const workoutRecordsArray = [];
        
        for (const workout of selectedWorkouts) {
            let workoutData = {
                workout_date: workoutDate,
                workout_type_id: workout.id,
                notes: null
            };
            
            if (workout.type === '시간') {
                const mStr = workout.durationMinutes != null ? String(workout.durationMinutes) : '';
                const sStr = workout.durationSeconds != null ? String(workout.durationSeconds) : '';
                const parsed = parseWorkoutDurationInputs(mStr, sStr);
                if (!parsed.ok) {
                    alert(parsed.message);
                    return;
                }
                workoutData.duration_minutes = parsed.minutes;
                workoutData.duration_seconds = parsed.seconds;
                workoutData.sets = [];
            } else if (workout.type === '세트') {
                workoutData.duration_minutes = null;
                workoutData.duration_seconds = null;
                if (workout.sets.length === 0) {
                    workoutData.sets = [{ set_number: 1, weight: 0, reps: 0 }];
                } else {
                    workoutData.sets = workout.sets.map(set => ({
                        set_number: set.set_number,
                        weight: set.weight !== null && set.weight !== undefined ? set.weight : 0,
                        reps: set.reps !== null && set.reps !== undefined ? set.reps : 0
                    }));
                }
            }
            
            workoutRecordsArray.push(workoutData);
        }
        
        try {
            // 트레이너 정보 확인은 서버에서 자동으로 처리하므로
            // 프론트엔드에서는 별도 조회 없이 바로 요청
            // (성능 최적화: 서버에서 한 번에 처리)
            
            // 일괄 추가 (한 번의 요청으로 모든 기록 추가)
            // 현재 로그인한 사용자 정보 전달 (트레이너 정보 확인용)
            const currentUser = getCurrentUser();
            await addWorkoutRecordsBatch(appUserId, workoutRecordsArray, currentUser);
            closeModal();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('운동기록 추가 오류:', error);
            alert(error.message || '운동기록 추가 중 오류가 발생했습니다.');
        }
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
            <button class="app-modal-close" aria-label="닫기" tabindex="-1">×</button>
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
                    <button type="button" class="workout-favorite-btn ${isFavorite ? 'active' : ''}" id="workout-favorite-btn" data-workout-type-id="${preselectedWorkoutTypeId}" tabindex="-1">
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
                <label>⏱ 시간 (분 · 초)</label>
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <input type="number" id="workout-add-duration-m" min="0" placeholder="0" inputmode="numeric" style="width: 72px;">
                    <span style="color: #666;">분</span>
                    <input type="number" id="workout-add-duration-s" min="0" max="59" placeholder="0" inputmode="numeric" style="width: 72px;">
                    <span style="color: #666;">초</span>
                </div>
            </div>
            <div class="app-form-group" id="workout-add-sets-group" style="display: none;">
                <label>⚖️ 세트</label>
                <div id="workout-add-sets-container" class="workout-sets-container"></div>
                <div class="workout-set-controls" style="display: flex; gap: 12px; align-items: center; justify-content: center; margin-top: 12px;">
                    <button type="button" class="workout-remove-set-btn" id="workout-remove-set-btn" tabindex="-1" style="width: 32px; height: 32px; border: 1px solid #ddd; background: #fff; color: #333; border-radius: 4px; cursor: pointer; font-size: 20px; font-weight: bold; line-height: 1; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0; box-sizing: border-box;">−</button>
                    <span style="font-size: 14px; color: #333; display: flex; align-items: center; line-height: 1; height: 32px; margin: 0; padding: 0;">세트</span>
                    <button type="button" class="workout-add-set-btn" id="workout-add-set-btn" tabindex="-1" style="width: 32px; height: 32px; border: 1px solid #1976d2; background: #1976d2; color: #fff; border-radius: 4px; cursor: pointer; font-size: 20px; font-weight: bold; line-height: 1; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0; box-sizing: border-box;">+</button>
                </div>
            </div>
        </form>
        <div class="app-modal-actions">
            <button type="button" class="app-btn-secondary" id="workout-add-cancel" tabindex="-1">취소</button>
            <button type="submit" form="workout-add-form" class="app-btn-primary" tabindex="-1">등록</button>
        </div>
    `;
    
    document.body.appendChild(modalBg);
    
    // 모달 열기 애니메이션
    setTimeout(() => {
        modalBg.classList.add('app-modal-show');
        modal.classList.add('app-modal-show');
        
        // 포커스 방지: 버튼과 다른 요소만 포커스 방지 (input 필드는 키보드 입력을 위해 제외)
        const preventFocus = (e) => {
            const target = e.target;
            // input, textarea, select는 키보드 입력을 위해 포커스 허용
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
                return; // input 필드는 포커스 허용
            }
            e.preventDefault();
            e.stopPropagation();
            if (target && target.blur) {
                target.blur();
            }
        };
        
        // 모달 내 버튼과 다른 요소에만 포커스 방지 (input 필드는 제외)
        const allFocusableElements = modal.querySelectorAll('button, [tabindex]:not(input):not(textarea):not(select)');
        allFocusableElements.forEach(el => {
            // focus 이벤트 차단
            el.addEventListener('focus', preventFocus, { capture: true });
            // focusin 이벤트도 차단 (버블링 단계)
            el.addEventListener('focusin', preventFocus, { capture: true });
        });
        
        // 동적으로 추가되는 요소에도 적용하기 위해 모달에 이벤트 위임 (input 필드는 제외)
        modal.addEventListener('focusin', (e) => {
            const target = e.target;
            // input, textarea, select는 키보드 입력을 위해 포커스 허용
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
                return; // input 필드는 포커스 허용
            }
            if (modal.contains(target)) {
                e.preventDefault();
                e.stopPropagation();
                if (target && target.blur) {
                    target.blur();
                }
            }
        }, { capture: true });
        
        // 초기 포커스 제거 (input 필드는 제외)
        setTimeout(() => {
            const activeEl = document.activeElement;
            // input 필드가 아닌 경우에만 blur
            if (activeEl && modal.contains(activeEl) && activeEl.blur && 
                activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA' && activeEl.tagName !== 'SELECT') {
                activeEl.blur();
            }
        }, 50);
        
        // 사용자가 명시적으로 클릭했을 때는 tabindex 제거하여 정상 작동
        const restoreTabIndex = (e) => {
            if (e.target && e.target.hasAttribute('tabindex')) {
                e.target.removeAttribute('tabindex');
            }
        };
        
        modal.addEventListener('mousedown', restoreTabIndex, { capture: true });
        modal.addEventListener('touchstart', restoreTabIndex, { capture: true });
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
    
    // 세트 삭제 버튼
    const removeSetBtn = modal.querySelector('#workout-remove-set-btn');
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
                    <span class="workout-set-number">${set.set_number} 세트</span>
                </div>
                <div class="workout-set-inputs">
                    <div class="workout-set-input-group">
                        <label>무게 (kg)</label>
                        <input type="number" class="workout-set-weight" data-index="${index}" step="0.01" min="0" max="999.99" placeholder="0" value="${set.weight !== null && set.weight !== undefined ? parseFloat(set.weight) : ''}" inputmode="decimal">
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
                sets[index].weight = parseWeight(value);
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
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const workoutDate = document.getElementById('workout-add-date').value;
        const workoutTypeId = document.getElementById('workout-add-type').value;
        const workoutType = document.getElementById('workout-add-type-type').value || preselectedWorkoutType;
        const durationM = document.getElementById('workout-add-duration-m')?.value ?? '';
        const durationS = document.getElementById('workout-add-duration-s')?.value ?? '';
        
        let finalDurationMinutes = null;
        let finalDurationSeconds = null;
        if (workoutType === '시간') {
            const parsed = parseWorkoutDurationInputs(String(durationM), String(durationS));
            if (!parsed.ok) {
                alert(parsed.message);
                return;
            }
            finalDurationMinutes = parsed.minutes;
            finalDurationSeconds = parsed.seconds;
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
            duration_seconds: finalDurationSeconds,
            sets: finalSets,
            notes: null
        };
        
        try {
            // 트레이너 정보는 서버에서 자동으로 확인하여 처리 (성능 최적화)
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
 * 운동 이력 모달 표시
 */
async function showWorkoutHistoryModal(appUserId, workoutId, workoutName, workoutType = null, onLoadRecord = null) {
    const modalBg = createModal();
    const modal = modalBg.querySelector('.app-modal');
    
    // 모달에 클래스 추가 (CSS에서 반응형 처리)
    modal.classList.add('workout-history-modal');
    
    modal.innerHTML = `
        <div class="app-modal-header">
            <h2>${escapeHtml(workoutName)} 최근 기록</h2>
            <button class="app-modal-close" aria-label="닫기">×</button>
        </div>
        <div class="app-modal-form workout-history-form">
            <div id="workout-history-pr-row" class="workout-history-pr-row" style="display: none;">
                <div id="workout-history-pr" class="workout-history-pr"></div>
            </div>
            <div id="workout-history-navigation" class="workout-history-navigation">
                <button type="button" class="workout-history-nav-btn" id="workout-history-prev" aria-label="이전 날짜">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                <div id="workout-history-date" class="workout-history-date">
                    로딩 중...
                </div>
                <button type="button" class="workout-history-nav-btn" id="workout-history-next" aria-label="다음 날짜">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </button>
            </div>
            <div id="workout-history-content" class="workout-history-content">
                <div class="workout-history-loading">
                    로딩 중...
                </div>
            </div>
        </div>
        <div class="app-modal-actions workout-history-actions">
            <button type="button" class="app-btn-secondary" id="workout-history-close">닫기</button>
            <button type="button" class="app-btn-primary" id="workout-history-load" disabled>불러오기</button>
        </div>
    `;
    
    document.body.appendChild(modalBg);
    
    // 모달 열기 애니메이션
    setTimeout(() => {
        modalBg.classList.add('app-modal-show');
        modal.classList.add('app-modal-show');
    }, 10);
    
    // 이력 데이터 로드 및 상태 관리
    let sortedDates = [];
    let recordsByDate = {};
    let currentDateIndex = 0;
    let prWeight = null;
    
    const renderCurrentDate = () => {
        const prRowEl = modal.querySelector('#workout-history-pr-row');
        const prEl = modal.querySelector('#workout-history-pr');
        const dateEl = modal.querySelector('#workout-history-date');
        const contentEl = modal.querySelector('#workout-history-content');
        const prevBtn = modal.querySelector('#workout-history-prev');
        const nextBtn = modal.querySelector('#workout-history-next');
        const loadBtn = modal.querySelector('#workout-history-load');
        const isSetWorkout = workoutType === '세트';
        
        if (prEl) {
            if (isSetWorkout) {
                const prText = prWeight !== null && prWeight > 0
                    ? formatWeight(prWeight)
                    : '-';
                prEl.textContent = `PR : ${prText}`;
                if (prRowEl) {
                    prRowEl.style.display = 'flex';
                }
            } else {
                prEl.textContent = '';
                if (prRowEl) {
                    prRowEl.style.display = 'none';
                }
            }
        }
        
        if (sortedDates.length === 0) {
            dateEl.textContent = '';
            contentEl.innerHTML = `
                <div class="workout-history-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3; margin-bottom: 12px;">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    <p>아직 기록이 없습니다</p>
                </div>
            `;
            prevBtn.style.opacity = '0.3';
            prevBtn.style.pointerEvents = 'none';
            nextBtn.style.opacity = '0.3';
            nextBtn.style.pointerEvents = 'none';
            return;
        }
        
        const currentDateStr = sortedDates[currentDateIndex];
        const dateDisplay = formatDate(currentDateStr);
        const dateRecords = recordsByDate[currentDateStr] || [];
        
        dateEl.textContent = dateDisplay;
        
        // 이전/다음 버튼 상태 업데이트
        // prevBtn (왼쪽): 더 오래된 날짜로 이동 (currentDateIndex++)
        const canGoPrev = currentDateIndex < sortedDates.length - 1;
        prevBtn.style.opacity = canGoPrev ? '1' : '0.3';
        prevBtn.style.pointerEvents = canGoPrev ? 'auto' : 'none';
        prevBtn.classList.toggle('disabled', !canGoPrev);
        // nextBtn (오른쪽): 더 최근 날짜로 이동 (currentDateIndex--)
        const canGoNext = currentDateIndex > 0;
        nextBtn.style.opacity = canGoNext ? '1' : '0.3';
        nextBtn.style.pointerEvents = canGoNext ? 'auto' : 'none';
        nextBtn.classList.toggle('disabled', !canGoNext);
        
        // 불러오기 버튼 상태 업데이트 (기록이 있는 경우에만 활성화)
        if (loadBtn) {
            const hasRecords = dateRecords.length > 0;
            loadBtn.disabled = !hasRecords;
            loadBtn.style.opacity = hasRecords ? '1' : '0.5';
            loadBtn.style.cursor = hasRecords ? 'pointer' : 'not-allowed';
        }
        
        // 현재 날짜의 기록 렌더링
        let historyHTML = '';
        dateRecords.forEach(record => {
            const workoutTypeType = record.workout_type_type || '세트';
            let recordHTML = '';
            
            if (workoutTypeType === '시간') {
                const durLabel = formatWorkoutDuration(record.duration_minutes, record.duration_seconds);
                if (durLabel) {
                    recordHTML = `
                    <div class="workout-history-item">
                        <div class="workout-history-item-header">
                            <div class="workout-history-item-icon">⏱</div>
                            <div class="workout-history-item-content">
                                <span class="workout-history-item-value">${durLabel}</span>
                            </div>
                            ${record.is_completed ? '<span class="workout-history-item-badge">완료</span>' : ''}
                        </div>
                    </div>
                `;
                }
            } else if (workoutTypeType === '세트' && record.sets && record.sets.length > 0) {
                const setsHTML = record.sets.map(set => {
                    const weight = formatWeight(set.weight);
                    const reps = set.reps !== null && set.reps !== undefined ? `${set.reps}회` : '-';
                    const isCompleted = set.is_completed;
                    return `
                        <div class="workout-history-set-item ${isCompleted ? 'completed' : ''}">
                            <span class="workout-history-set-number">${set.set_number} 세트</span>
                            <span class="workout-history-set-value">${weight} × ${reps}</span>
                            ${isCompleted ? '<span class="workout-history-set-check">✓</span>' : ''}
                        </div>
                    `;
                }).join('');
                
                recordHTML = `
                    <div class="workout-history-item">
                        <div class="workout-history-sets">
                            ${setsHTML}
                        </div>
                    </div>
                `;
            }
            
            historyHTML += recordHTML;
        });
        
        if (historyHTML === '') {
            contentEl.innerHTML = `
                <div class="workout-history-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3; margin-bottom: 12px;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <p>이 날짜에는 기록이 없습니다</p>
                </div>
            `;
        } else {
            contentEl.innerHTML = historyHTML;
        }
    };
    
    try {
        const allRecords = await getWorkoutRecords(appUserId);
        // workoutId와 workout_type_id는 모두 UUID 문자열이므로 문자열로 비교
        const workoutRecords = allRecords.filter(record => {
            const recordWorkoutTypeId = String(record.workout_type_id || '');
            const workoutIdStr = String(workoutId || '');
            return recordWorkoutTypeId === workoutIdStr;
        });
        
        if (workoutRecords.length > 0) {
            if (workoutType === '세트') {
                workoutRecords.forEach(record => {
                    if (!record?.sets || !Array.isArray(record.sets)) return;
                    record.sets.forEach(set => {
                        const weight = Number(set?.weight);
                        const reps = Number(set?.reps);
                        if (!Number.isFinite(reps) || reps <= 0) return;
                        if (!Number.isFinite(weight)) return;
                        if (prWeight === null || weight > prWeight) {
                            prWeight = weight;
                        }
                    });
                });
            }
            
            // 날짜별로 그룹화
            workoutRecords.forEach(record => {
                const dateStr = record.workout_date;
                if (!recordsByDate[dateStr]) {
                    recordsByDate[dateStr] = [];
                }
                recordsByDate[dateStr].push(record);
            });
            
            // 날짜별로 정렬 (최신순)
            sortedDates = Object.keys(recordsByDate).sort((a, b) => {
                return new Date(b) - new Date(a);
            });
            
            currentDateIndex = 0; // 가장 최근 날짜부터 시작
        }
        
        renderCurrentDate();
        
        // 네비게이션 버튼 이벤트
        const prevBtn = modal.querySelector('#workout-history-prev');
        const nextBtn = modal.querySelector('#workout-history-next');
        
        prevBtn.addEventListener('click', () => {
            if (currentDateIndex < sortedDates.length - 1) {
                currentDateIndex++;
                renderCurrentDate();
            }
        });
        
        nextBtn.addEventListener('click', () => {
            if (currentDateIndex > 0) {
                currentDateIndex--;
                renderCurrentDate();
            }
        });
    } catch (error) {
        console.error('운동 이력 조회 오류:', error);
        const contentEl = modal.querySelector('#workout-history-content');
        const dateEl = modal.querySelector('#workout-history-date');
        dateEl.textContent = '';
        contentEl.innerHTML = `
            <div class="workout-history-empty error">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3; margin-bottom: 12px;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p>이력을 불러오는 중 오류가 발생했습니다</p>
            </div>
        `;
    }
    
    // 모달 닫기
    const closeModal = () => {
        modalBg.classList.remove('app-modal-show');
        modal.classList.remove('app-modal-show');
        setTimeout(() => {
            if (modalBg.parentNode) {
                document.body.removeChild(modalBg);
            }
        }, 200);
    };
    
    const closeBtn = modal.querySelector('.app-modal-close');
    const closeBtn2 = modal.querySelector('#workout-history-close');
    const loadBtn = modal.querySelector('#workout-history-load');
    
    closeBtn.addEventListener('click', closeModal);
    closeBtn2.addEventListener('click', closeModal);
    modalBg.addEventListener('click', (e) => {
        if (e.target === modalBg) closeModal();
    });
    
    // 불러오기 버튼 클릭 이벤트
    loadBtn.addEventListener('click', () => {
        if (sortedDates.length > 0 && currentDateIndex >= 0 && currentDateIndex < sortedDates.length) {
            const currentDateStr = sortedDates[currentDateIndex];
            const dateRecords = recordsByDate[currentDateStr] || [];
            
            // 해당 날짜의 첫 번째 기록을 불러오기 (같은 날짜에 여러 기록이 있을 수 있음)
            if (dateRecords.length > 0 && onLoadRecord) {
                const record = dateRecords[0]; // 첫 번째 기록 사용
                onLoadRecord(record);
            }
        }
        closeModal();
    });
}

/**
 * 텍스트 기록 모달 표시
 */
export async function showTextRecordModal(appUserId, selectedDate = null, onSuccess) {
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
    
    modal.innerHTML = `
        <div class="app-modal-header">
            <h2>간편 기록 (${dateDisplay})</h2>
            <button class="app-modal-close" aria-label="닫기" tabindex="-1">×</button>
        </div>
        <form class="app-modal-form" id="text-record-form">
            <input type="hidden" id="text-record-date" value="${defaultDate}">
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
                <label for="text-record-content">운동 내용</label>
                <textarea 
                    id="text-record-content" 
                    placeholder="예: 조깅 30분, 스트레칭 10분" 
                    rows="6" 
                    maxlength="500"
                    style="width: 100%; padding: 10px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); font-size: 16px; font-family: inherit; resize: vertical; box-sizing: border-box;"
                ></textarea>
                <div style="text-align: right; margin-top: 4px; font-size: 12px; color: var(--app-text-muted);">
                    <span id="text-record-char-count">0</span>/500
                </div>
            </div>
        </form>
        <div class="app-modal-actions" style="justify-content: flex-end;">
            <button type="button" class="app-btn-secondary" id="text-record-cancel" tabindex="-1">취소</button>
            <button type="submit" form="text-record-form" class="app-btn-primary" tabindex="-1">등록</button>
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
    const cancelBtn = modal.querySelector('#text-record-cancel');
    const form = modal.querySelector('#text-record-form');
    const contentTextarea = modal.querySelector('#text-record-content');
    const charCount = modal.querySelector('#text-record-char-count');
    const levelButtons = modal.querySelectorAll('.app-workout-level-btn');
    const selectedLevels = {
        condition: null,
        intensity: null,
        fatigue: null
    };
    
    // 글자 수 카운터
    contentTextarea.addEventListener('input', (e) => {
        const length = e.target.value.length;
        charCount.textContent = length;
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
    
    // 폼 제출
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const workoutDate = document.getElementById('text-record-date').value;
        const textContent = contentTextarea.value.trim();
        const hasLevels = Boolean(selectedLevels.condition || selectedLevels.intensity || selectedLevels.fatigue);
        
        if (!textContent && !hasLevels) {
            alert('운동 내용을 입력하거나 상태를 선택해주세요.');
            return;
        }
        
        const workoutData = {
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
            await addWorkoutRecord(workoutData);
            closeModal();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('텍스트 기록 추가 오류:', error);
            alert(error.message || '텍스트 기록 추가 중 오류가 발생했습니다.');
        }
    });
    
    // 포커스
    setTimeout(() => {
        contentTextarea.focus();
    }, 100);
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
