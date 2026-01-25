// 식단기록 추가 모달

import { formatDate, getToday, escapeHtml } from '../utils.js';
import { addDietRecord } from '../api.js';

let selectedImageFile = null;
let imagePreviewUrl = null;

/**
 * 클라이언트 측 이미지 압축 및 리사이징
 * @param {File} file - 원본 이미지 파일
 * @param {number} maxWidth - 최대 너비 (기본값: 800)
 * @param {number} maxHeight - 최대 높이 (기본값: 800)
 * @param {number} quality - JPEG 품질 (0-1, 기본값: 0.65)
 * @returns {Promise<File>} - 압축된 이미지 파일
 */
async function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.65) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // 캔버스 생성
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // 비율 유지하며 리사이징
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // 이미지 그리기 (메타데이터 제거됨)
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // JPEG로 변환 (Blob)
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('이미지 압축에 실패했습니다.'));
                            return;
                        }
                        
                        // File 객체로 변환 (원본 파일명 유지)
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        resolve(compressedFile);
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = () => reject(new Error('이미지를 로드할 수 없습니다.'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));
        reader.readAsDataURL(file);
    });
}

/**
 * 식단기록 추가 모달 표시
 */
export async function showDietAddModal(appUserId, selectedDate = null, onSuccess) {
    // 기존 모달이 있으면 제거
    const existingModals = document.querySelectorAll('.app-modal-bg');
    existingModals.forEach(modal => {
        if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    });
    
    // 선택된 날짜가 있으면 사용, 없으면 오늘 날짜
    const defaultDate = selectedDate || getToday();
    
    // 현재 시간 (HH:MM 형식)
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const defaultTime = `${hours}:${minutes}`;
    
    // 초기화
    selectedImageFile = null;
    imagePreviewUrl = null;
    
    const modalHtml = `
        <div class="app-modal-bg" id="diet-add-modal-bg">
            <div class="app-modal app-modal-large" id="diet-add-modal">
                <div class="app-modal-header">
                    <h2>식단 추가</h2>
                    <button class="app-modal-close-btn" id="diet-add-modal-close">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="app-modal-content">
                    <form id="diet-add-form">
                        <div class="app-form-group">
                            <label for="diet-meal-date">날짜</label>
                            <input type="date" id="diet-meal-date" name="meal_date" value="${defaultDate}" required>
                        </div>
                        
                        <div class="app-form-group">
                            <label for="diet-meal-time">시간</label>
                            <input type="time" id="diet-meal-time" name="meal_time" value="${defaultTime}">
                        </div>
                        
                        <div class="app-form-group">
                            <label>식사 구분</label>
                            <div class="app-meal-type-checkboxes">
                                <label class="app-checkbox-label">
                                    <input type="radio" name="meal_type" value="breakfast" id="diet-meal-type-breakfast">
                                    <span>아침</span>
                                </label>
                                <label class="app-checkbox-label">
                                    <input type="radio" name="meal_type" value="lunch" id="diet-meal-type-lunch">
                                    <span>점심</span>
                                </label>
                                <label class="app-checkbox-label">
                                    <input type="radio" name="meal_type" value="dinner" id="diet-meal-type-dinner">
                                    <span>저녁</span>
                                </label>
                                <label class="app-checkbox-label">
                                    <input type="radio" name="meal_type" value="snack" id="diet-meal-type-snack">
                                    <span>간식</span>
                                </label>
                            </div>
                        </div>
                        
                        <div class="app-form-group">
                            <label for="diet-image">사진</label>
                            <div class="app-image-upload-area" id="diet-image-upload-area">
                                <input type="file" id="diet-image" name="image" accept="image/*" style="display: none;">
                                <div class="app-image-upload-preview" id="diet-image-preview">
                                    <div class="app-image-upload-placeholder">
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                            <polyline points="21 15 16 10 5 21"></polyline>
                                        </svg>
                                    </div>
                                </div>
                                <button type="button" class="app-btn-secondary" id="diet-image-select-btn">사진 선택</button>
                                <button type="button" class="app-btn-secondary" id="diet-image-remove-btn" style="display: none;">사진 제거</button>
                            </div>
                        </div>
                        
                        <div class="app-form-group">
                            <label for="diet-notes">메모</label>
                            <textarea id="diet-notes" name="notes" rows="3" placeholder="식단에 대한 메모를 입력하세요"></textarea>
                        </div>
                    </form>
                </div>
                <div class="app-modal-actions">
                    <button type="button" class="app-btn-secondary" id="diet-add-cancel-btn">취소</button>
                    <button type="submit" class="app-btn-primary" id="diet-add-submit-btn" form="diet-add-form">추가</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modalBg = document.getElementById('diet-add-modal-bg');
    const modal = document.getElementById('diet-add-modal');
    const form = document.getElementById('diet-add-form');
    const imageInput = document.getElementById('diet-image');
    const imageSelectBtn = document.getElementById('diet-image-select-btn');
    const imageRemoveBtn = document.getElementById('diet-image-remove-btn');
    const imagePreview = document.getElementById('diet-image-preview');
    const imageUploadArea = document.getElementById('diet-image-upload-area');
    const closeBtn = document.getElementById('diet-add-modal-close');
    const cancelBtn = document.getElementById('diet-add-cancel-btn');
    
    
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
        selectedImageFile = null;
        imagePreviewUrl = null;
        imageInput.value = '';
        updateImagePreview();
    });
    
    // 이미지 선택 처리
    async function handleImageSelect(file) {
        if (!file.type.startsWith('image/')) {
            alert('이미지 파일만 업로드 가능합니다.');
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            alert('이미지 파일 크기는 10MB 이하여야 합니다.');
            return;
        }
        
        // 압축 중 표시
        const imageSelectBtn = document.getElementById('diet-image-select-btn');
        const originalBtnText = imageSelectBtn.textContent;
        imageSelectBtn.disabled = true;
        imageSelectBtn.textContent = '압축 중...';
        
        try {
            // 클라이언트 측에서 이미지 압축 (800x800, 품질 65%)
            const compressedFile = await compressImage(file, 800, 800, 0.65);
            selectedImageFile = compressedFile;
            
            // 압축률 표시 (디버깅용, 필요시 제거 가능)
            const compressionRatio = ((1 - compressedFile.size / file.size) * 100).toFixed(1);
            console.log(`이미지 압축 완료: ${(file.size / 1024).toFixed(1)}KB → ${(compressedFile.size / 1024).toFixed(1)}KB (${compressionRatio}% 감소)`);
            
            // 미리보기 생성
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreviewUrl = e.target.result;
                updateImagePreview();
            };
            reader.readAsDataURL(compressedFile);
        } catch (error) {
            console.error('이미지 압축 오류:', error);
            alert('이미지 처리 중 오류가 발생했습니다. 원본 파일을 사용합니다.');
            // 압축 실패 시 원본 사용
            selectedImageFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreviewUrl = e.target.result;
                updateImagePreview();
            };
            reader.readAsDataURL(file);
        } finally {
            imageSelectBtn.disabled = false;
            imageSelectBtn.textContent = originalBtnText;
        }
    }
    
    // 이미지 미리보기 업데이트
    function updateImagePreview() {
        if (imagePreviewUrl) {
            imagePreview.innerHTML = `<img src="${imagePreviewUrl}" alt="미리보기" style="max-width: 100%; max-height: 300px; border-radius: 8px;">`;
            imageRemoveBtn.style.display = 'inline-block';
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
            imageRemoveBtn.style.display = 'none';
        }
    }
    
    // 폼 제출
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = document.getElementById('diet-add-submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = '저장 중...';
        
        try {
            const formData = new FormData();
            
            // 기본 필드 추가
            formData.append('app_user_id', appUserId);
            formData.append('meal_date', document.getElementById('diet-meal-date').value);
            formData.append('meal_time', document.getElementById('diet-meal-time').value || null);
            
            // 식사 구분 라디오 버튼 처리 (필수 항목)
            const mealTypeRadio = form.querySelector('input[name="meal_type"]:checked');
            if (!mealTypeRadio) {
                alert('식사 구분을 선택해주세요.');
                submitBtn.disabled = false;
                submitBtn.textContent = '추가';
                return;
            }
            formData.append('meal_type', mealTypeRadio.value);
            
            formData.append('notes', document.getElementById('diet-notes').value || '');
            
            // 이미지 파일 추가 (있는 경우만)
            if (selectedImageFile) {
                formData.append('image', selectedImageFile);
            }
            
            await addDietRecord(formData);
            
            closeModal();
            if (onSuccess) {
                onSuccess();
            }
        } catch (error) {
            console.error('식단기록 추가 오류:', error);
            alert(error.message || '식단기록 추가 중 오류가 발생했습니다.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '추가';
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
