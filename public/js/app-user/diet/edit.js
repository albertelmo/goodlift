// 식단기록 수정/삭제 모달

import { formatDate, escapeHtml } from '../utils.js';
import { updateDietRecord, deleteDietRecord } from '../api.js';

let selectedImageFile = null;
let imagePreviewUrl = null;

/**
 * 식단기록 수정 모달 표시
 */
export async function showDietEditModal(appUserId, record, onSuccess) {
    // 기존 모달이 있으면 제거
    const existingModals = document.querySelectorAll('.app-modal-bg');
    existingModals.forEach(modal => {
        if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    });
    
    // 초기화
    selectedImageFile = null;
    imagePreviewUrl = record.image_url || record.image_thumbnail_url || null;
    
    const mealDate = record.meal_date || '';
    const mealTime = record.meal_time || '';
    const mealType = record.meal_type || '';
    const notes = escapeHtml(record.notes || '');
    
    // meal_type을 한글로 변환
    const mealTypeLabels = {
        'breakfast': '아침',
        'lunch': '점심',
        'dinner': '저녁',
        'snack': '간식'
    };
    
    const modalHtml = `
        <div class="app-modal-bg" id="diet-edit-modal-bg">
            <div class="app-modal app-modal-large" id="diet-edit-modal">
                <div class="app-modal-header">
                    <h2>식단 수정</h2>
                    <button class="app-modal-close-btn" id="diet-edit-modal-close">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="app-modal-content">
                    <form id="diet-edit-form">
                        <div class="app-form-group">
                            <label for="diet-edit-meal-date">날짜</label>
                            <input type="date" id="diet-edit-meal-date" name="meal_date" value="${mealDate}" required>
                        </div>
                        
                        <div class="app-form-group">
                            <label for="diet-edit-meal-time">시간</label>
                            <input type="time" id="diet-edit-meal-time" name="meal_time" value="${mealTime}">
                        </div>
                        
                        <div class="app-form-group">
                            <label>식사 구분</label>
                            <div class="app-meal-type-checkboxes">
                                <label class="app-checkbox-label">
                                    <input type="radio" name="meal_type" value="breakfast" id="diet-edit-meal-type-breakfast" ${mealType === 'breakfast' ? 'checked' : ''}>
                                    <span>아침</span>
                                </label>
                                <label class="app-checkbox-label">
                                    <input type="radio" name="meal_type" value="lunch" id="diet-edit-meal-type-lunch" ${mealType === 'lunch' ? 'checked' : ''}>
                                    <span>점심</span>
                                </label>
                                <label class="app-checkbox-label">
                                    <input type="radio" name="meal_type" value="dinner" id="diet-edit-meal-type-dinner" ${mealType === 'dinner' ? 'checked' : ''}>
                                    <span>저녁</span>
                                </label>
                                <label class="app-checkbox-label">
                                    <input type="radio" name="meal_type" value="snack" id="diet-edit-meal-type-snack" ${mealType === 'snack' ? 'checked' : ''}>
                                    <span>간식</span>
                                </label>
                            </div>
                        </div>
                        
                        <div class="app-form-group">
                            <label for="diet-edit-image">사진</label>
                            <div class="app-image-upload-area" id="diet-edit-image-upload-area">
                                <input type="file" id="diet-edit-image" name="image" accept="image/*" style="display: none;">
                                <div class="app-image-upload-preview" id="diet-edit-image-preview">
                                    ${imagePreviewUrl ? `<img src="${imagePreviewUrl}" alt="미리보기" style="max-width: 100%; max-height: 300px; border-radius: 8px;">` : `
                                        <div class="app-image-upload-placeholder">
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                                <polyline points="21 15 16 10 5 21"></polyline>
                                            </svg>
                                        </div>
                                    `}
                                </div>
                                <button type="button" class="app-btn-secondary" id="diet-edit-image-select-btn">사진 변경</button>
                                <button type="button" class="app-btn-secondary" id="diet-edit-image-remove-btn">사진 제거</button>
                            </div>
                        </div>
                        
                        <div class="app-form-group">
                            <label for="diet-edit-notes">메모</label>
                            <textarea id="diet-edit-notes" name="notes" rows="3" placeholder="식단에 대한 메모를 입력하세요">${notes}</textarea>
                        </div>
                    </form>
                </div>
                <div class="app-modal-actions">
                    <button type="button" class="app-btn-danger" id="diet-edit-delete-btn">삭제</button>
                    <button type="button" class="app-btn-secondary" id="diet-edit-cancel-btn">취소</button>
                    <button type="submit" class="app-btn-primary" id="diet-edit-submit-btn" form="diet-edit-form">저장</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modalBg = document.getElementById('diet-edit-modal-bg');
    const modal = document.getElementById('diet-edit-modal');
    const form = document.getElementById('diet-edit-form');
    const imageInput = document.getElementById('diet-edit-image');
    const imageSelectBtn = document.getElementById('diet-edit-image-select-btn');
    const imageRemoveBtn = document.getElementById('diet-edit-image-remove-btn');
    const imagePreview = document.getElementById('diet-edit-image-preview');
    const imageUploadArea = document.getElementById('diet-edit-image-upload-area');
    const closeBtn = document.getElementById('diet-edit-modal-close');
    const cancelBtn = document.getElementById('diet-edit-cancel-btn');
    const deleteBtn = document.getElementById('diet-edit-delete-btn');
    
    
    // 모달 표시 애니메이션
    setTimeout(() => {
        modalBg.classList.add('app-modal-show');
        modal.classList.add('app-modal-show');
    }, 10);
    
    // 이미지 선택 버튼
    imageSelectBtn.addEventListener('click', () => {
        imageInput.click();
    });
    
    // 이미지 파일 선택
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleImageSelect(file);
        }
    });
    
    // 드래그 앤 드롭
    imageUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        imageUploadArea.classList.add('app-image-upload-dragover');
    });
    
    imageUploadArea.addEventListener('dragleave', () => {
        imageUploadArea.classList.remove('app-image-upload-dragover');
    });
    
    imageUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        imageUploadArea.classList.remove('app-image-upload-dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImageSelect(file);
        }
    });
    
    // 이미지 제거
    imageRemoveBtn.addEventListener('click', () => {
        if (confirm('사진을 제거하시겠습니까?')) {
            selectedImageFile = null;
            imagePreviewUrl = null;
            imageInput.value = '';
            updateImagePreview();
        }
    });
    
    // 이미지 선택 처리
    function handleImageSelect(file) {
        if (!file.type.startsWith('image/')) {
            alert('이미지 파일만 업로드 가능합니다.');
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            alert('이미지 파일 크기는 10MB 이하여야 합니다.');
            return;
        }
        
        selectedImageFile = file;
        
        // 미리보기 생성
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreviewUrl = e.target.result;
            updateImagePreview();
        };
        reader.readAsDataURL(file);
    }
    
    // 이미지 미리보기 업데이트
    function updateImagePreview() {
        if (imagePreviewUrl) {
            imagePreview.innerHTML = `<img src="${imagePreviewUrl}" alt="미리보기" style="max-width: 100%; max-height: 300px; border-radius: 8px;">`;
        } else {
            imagePreview.innerHTML = `
                <div class="app-image-upload-placeholder">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                </div>
            `;
        }
    }
    
    // 폼 제출
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = document.getElementById('diet-edit-submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = '저장 중...';
        
        try {
            const formData = new FormData();
            
            // 기본 필드 추가
            formData.append('app_user_id', appUserId);
            formData.append('meal_date', document.getElementById('diet-edit-meal-date').value);
            formData.append('meal_time', document.getElementById('diet-edit-meal-time').value || null);
            
            // 식사 구분 라디오 버튼 처리 (필수 항목)
            const mealTypeRadio = form.querySelector('input[name="meal_type"]:checked');
            if (!mealTypeRadio) {
                alert('식사 구분을 선택해주세요.');
                submitBtn.disabled = false;
                submitBtn.textContent = '저장';
                return;
            }
            formData.append('meal_type', mealTypeRadio.value);
            
            formData.append('notes', document.getElementById('diet-edit-notes').value || '');
            
            // 이미지 파일 추가 (새로 선택한 경우)
            if (selectedImageFile) {
                formData.append('image', selectedImageFile);
            }
            
            // 이미지 제거 요청
            if (!imagePreviewUrl && !selectedImageFile) {
                formData.append('remove_image', 'true');
            }
            
            await updateDietRecord(record.id, formData);
            
            closeModal();
            if (onSuccess) {
                onSuccess();
            }
        } catch (error) {
            console.error('식단기록 수정 오류:', error);
            alert(error.message || '식단기록 수정 중 오류가 발생했습니다.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '저장';
        }
    });
    
    // 삭제 버튼
    deleteBtn.addEventListener('click', async () => {
        if (!confirm('정말 삭제하시겠습니까?')) {
            return;
        }
        
        deleteBtn.disabled = true;
        deleteBtn.textContent = '삭제 중...';
        
        try {
            await deleteDietRecord(record.id, appUserId);
            closeModal();
            if (onSuccess) {
                onSuccess();
            }
        } catch (error) {
            console.error('식단기록 삭제 오류:', error);
            alert(error.message || '식단기록 삭제 중 오류가 발생했습니다.');
        } finally {
            deleteBtn.disabled = false;
            deleteBtn.textContent = '삭제';
        }
    });
    
    // 모달 닫기
    function closeModal() {
        modalBg.classList.remove('app-modal-show');
        modal.classList.remove('app-modal-show');
        setTimeout(() => {
            modalBg.remove();
        }, 300);
    }
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    // 배경 클릭 시 닫기
    modalBg.addEventListener('click', (e) => {
        if (e.target === modalBg) {
            closeModal();
        }
    });
    
    // 모달 닫기
    function closeModal() {
        modalBg.classList.remove('app-modal-show');
        modal.classList.remove('app-modal-show');
        setTimeout(() => {
            modalBg.remove();
        }, 300);
    }
    
    // ESC 키로 닫기
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    };
    document.addEventListener('keydown', escHandler);
    
    // 모달이 제거될 때 이벤트 리스너 제거
    setTimeout(() => {
        document.removeEventListener('keydown', escHandler);
    }, 10000);
}
