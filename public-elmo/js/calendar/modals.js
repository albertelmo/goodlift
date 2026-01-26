// Elmo 캘린더 모달 관리

let currentSessionId = null;
let currentUserId = null;

/**
 * 추가 모달 표시
 */
export async function showAddModal(selectedDate, onSuccess, sessionId, userId) {
    try {
        currentSessionId = sessionId;
        currentUserId = userId;
        
        // selectedDate가 문자열이면 Date 객체로 변환
        let dateObj = selectedDate;
        if (typeof selectedDate === 'string') {
            dateObj = new Date(selectedDate);
        }
        if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
            dateObj = new Date();
        }
        
        const dateStr = formatDate(dateObj);
        
        // 기존 모달 제거
        const existingModal = document.getElementById('elmo-add-modal');
        if (existingModal) {
            existingModal.remove();
        }
        const existingBg = document.getElementById('elmo-add-modal-bg');
        if (existingBg) {
            existingBg.remove();
        }
        
        // 모달 HTML 생성 (식단 모달 스타일 참고)
        const modalHtml = `
        <div class="elmo-modal-bg" id="elmo-add-modal-bg">
            <div class="elmo-modal elmo-modal-large" id="elmo-add-modal">
                <div class="elmo-modal-header">
                    <h2>기록 추가</h2>
                    <button class="elmo-modal-close-btn" id="elmo-add-modal-close">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="elmo-modal-content">
                    <form id="elmo-add-form">
                        <div class="elmo-form-group">
                            <label for="elmo-add-date">날짜</label>
                            <input type="date" id="elmo-add-date" name="record_date" value="${dateStr}" required>
                        </div>
                        
                        <div class="elmo-form-group">
                            <label>타입 *</label>
                            <div class="elmo-type-radio-group">
                                <label class="elmo-radio-label">
                                    <input type="radio" name="record_type" value="일정" id="elmo-type-schedule" required>
                                    <span>📅 일정</span>
                                </label>
                                <label class="elmo-radio-label">
                                    <input type="radio" name="record_type" value="ToDo" id="elmo-type-todo" required>
                                    <span>✅ ToDo</span>
                                </label>
                            </div>
                        </div>
                        
                        <div class="elmo-form-group">
                            <label for="elmo-add-text">내용</label>
                            <textarea id="elmo-add-text" name="text_content" rows="3" placeholder="내용을 입력하세요"></textarea>
                        </div>
                        
                        <div class="elmo-form-group" id="elmo-add-image-group">
                            <label>사진</label>
                            <div class="elmo-image-upload-area" id="elmo-image-upload-area">
                                <input type="file" id="elmo-add-image" name="image" accept="image/*" style="display: none;">
                                <div class="elmo-image-upload-preview" id="elmo-add-image-preview">
                                    <div class="elmo-image-upload-placeholder">
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                            <polyline points="21 15 16 10 5 21"></polyline>
                                        </svg>
                                    </div>
                                </div>
                                <button type="button" class="elmo-btn-secondary" id="elmo-image-select-btn">사진 선택</button>
                                <button type="button" class="elmo-btn-secondary" id="elmo-image-remove-btn" style="display: none;">사진 제거</button>
                            </div>
                        </div>
                        
                        <div class="elmo-form-group" id="elmo-add-video-group" style="display:none;">
                            <label>동영상</label>
                            <div class="elmo-video-upload-area" id="elmo-video-upload-area">
                                <input type="file" id="elmo-add-video" name="video" accept="video/*" style="display: none;">
                                <div class="elmo-video-upload-preview" id="elmo-add-video-preview">
                                    <div class="elmo-video-upload-placeholder">
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polygon points="23 7 16 12 23 17 23 7"></polygon>
                                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                                        </svg>
                                    </div>
                                </div>
                                <button type="button" class="elmo-btn-secondary" id="elmo-video-select-btn">동영상 선택</button>
                                <button type="button" class="elmo-btn-secondary" id="elmo-video-remove-btn" style="display:none;">동영상 제거</button>
                            </div>
                        </div>
                        
                        <div id="elmo-add-result" class="elmo-result"></div>
                    </form>
                </div>
                <div class="elmo-modal-actions">
                    <button type="button" class="elmo-btn-secondary" id="elmo-add-cancel">취소</button>
                    <button type="submit" class="elmo-btn-primary" id="elmo-add-submit-btn" form="elmo-add-form">저장</button>
                </div>
            </div>
        </div>
    `;
        
        // 모달 추가
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modalBg = document.getElementById('elmo-add-modal-bg');
        const modal = document.getElementById('elmo-add-modal');
        const form = document.getElementById('elmo-add-form');
        const imageInput = document.getElementById('elmo-add-image');
        const imageSelectBtn = document.getElementById('elmo-image-select-btn');
        const imageRemoveBtn = document.getElementById('elmo-image-remove-btn');
        const imagePreview = document.getElementById('elmo-add-image-preview');
        const imageUploadArea = document.getElementById('elmo-image-upload-area');
        const videoInput = document.getElementById('elmo-add-video');
        const videoSelectBtn = document.getElementById('elmo-video-select-btn');
        const videoRemoveBtn = document.getElementById('elmo-video-remove-btn');
        const videoPreview = document.getElementById('elmo-add-video-preview');
        const videoUploadArea = document.getElementById('elmo-video-upload-area');
        const videoGroup = document.getElementById('elmo-add-video-group');
        const closeBtn = document.getElementById('elmo-add-modal-close');
        const cancelBtn = document.getElementById('elmo-add-cancel');
        
        // 모달 표시 애니메이션
        setTimeout(() => {
            modalBg.classList.add('elmo-modal-show');
            modal.classList.add('elmo-modal-show');
        }, 10);
        
        // 타입 변경 시 동영상 필드 표시/숨김
        const typeRadios = form.querySelectorAll('input[name="record_type"]');
        typeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === '일정') {
                    videoGroup.style.display = 'block';
                } else {
                    videoGroup.style.display = 'none';
                    if (videoInput) videoInput.value = '';
                    if (videoPreview) videoPreview.innerHTML = `
                        <div class="elmo-video-upload-placeholder">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                            </svg>
                        </div>
                    `;
                    if (videoRemoveBtn) videoRemoveBtn.style.display = 'none';
                }
            });
        });
        
        // 이미지 선택 버튼
        if (imageSelectBtn) {
            imageSelectBtn.addEventListener('click', () => {
                if (imageInput) imageInput.click();
            });
        }
        
        // 이미지 파일 선택
        if (imageInput) {
            imageInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    handleImageSelect(file);
                }
            });
        }
        
        // 이미지 드래그 앤 드롭
        if (imageUploadArea) {
            imageUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                imageUploadArea.classList.add('elmo-upload-dragover');
            });
            
            imageUploadArea.addEventListener('dragleave', () => {
                imageUploadArea.classList.remove('elmo-upload-dragover');
            });
            
            imageUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                imageUploadArea.classList.remove('elmo-upload-dragover');
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    handleImageSelect(file);
                    if (imageInput) imageInput.files = e.dataTransfer.files;
                }
            });
        }
        
        // 이미지 제거
        if (imageRemoveBtn) {
            imageRemoveBtn.addEventListener('click', () => {
                selectedImageFile = null;
                imagePreviewUrl = null;
                if (imageInput) imageInput.value = '';
                if (imagePreview) {
                    imagePreview.innerHTML = `
                        <div class="elmo-image-upload-placeholder">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <polyline points="21 15 16 10 5 21"></polyline>
                            </svg>
                        </div>
                    `;
                }
                if (imageRemoveBtn) imageRemoveBtn.style.display = 'none';
            });
        }
        
        // 동영상 선택 버튼
        if (videoSelectBtn) {
            videoSelectBtn.addEventListener('click', () => {
                if (videoInput) videoInput.click();
            });
        }
        
        // 동영상 파일 선택
        if (videoInput) {
            videoInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    handleVideoSelect(file, videoPreview, videoRemoveBtn);
                }
            });
        }
        
        // 동영상 드래그 앤 드롭
        if (videoUploadArea) {
            videoUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                videoUploadArea.classList.add('elmo-upload-dragover');
            });
            
            videoUploadArea.addEventListener('dragleave', () => {
                videoUploadArea.classList.remove('elmo-upload-dragover');
            });
            
            videoUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                videoUploadArea.classList.remove('elmo-upload-dragover');
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('video/')) {
                    handleVideoSelect(file, videoPreview, videoRemoveBtn);
                    if (videoInput) videoInput.files = e.dataTransfer.files;
                }
            });
        }
        
        // 동영상 제거
        if (videoRemoveBtn) {
            videoRemoveBtn.addEventListener('click', () => {
                if (videoInput) videoInput.value = '';
                if (videoPreview) {
                    videoPreview.innerHTML = `
                        <div class="elmo-video-upload-placeholder">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                            </svg>
                        </div>
                    `;
                }
                if (videoRemoveBtn) videoRemoveBtn.style.display = 'none';
            });
        }
        
        // 클라이언트 측 이미지 압축 및 리사이징
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
        
        // 이미지 선택 처리
        let selectedImageFile = null;
        let imagePreviewUrl = null;
        
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
            const imageSelectBtn = document.getElementById('elmo-image-select-btn');
            const originalBtnText = imageSelectBtn ? imageSelectBtn.textContent : '';
            if (imageSelectBtn) {
                imageSelectBtn.disabled = true;
                imageSelectBtn.textContent = '압축 중...';
            }
            
            try {
                // 클라이언트 측에서 이미지 압축 (800x800, 품질 65%)
                const compressedFile = await compressImage(file, 800, 800, 0.65);
                selectedImageFile = compressedFile;
                
                // 미리보기 생성
                const reader = new FileReader();
                reader.onload = (e) => {
                    imagePreviewUrl = e.target.result;
                    if (imagePreview) {
                        imagePreview.innerHTML = `<img src="${imagePreviewUrl}" alt="미리보기" style="max-width: 100%; max-height: 300px; border-radius: 8px; object-fit: contain;">`;
                    }
                    if (imageRemoveBtn) imageRemoveBtn.style.display = 'inline-block';
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
                    if (imagePreview) {
                        imagePreview.innerHTML = `<img src="${imagePreviewUrl}" alt="미리보기" style="max-width: 100%; max-height: 300px; border-radius: 8px; object-fit: contain;">`;
                    }
                    if (imageRemoveBtn) imageRemoveBtn.style.display = 'inline-block';
                };
                reader.readAsDataURL(file);
            } finally {
                if (imageSelectBtn) {
                    imageSelectBtn.disabled = false;
                    imageSelectBtn.textContent = originalBtnText;
                }
            }
        }
        
        // 동영상 선택 처리
        function handleVideoSelect(file) {
            if (!file.type.startsWith('video/')) {
                alert('동영상 파일만 업로드 가능합니다.');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                if (videoPreview) {
                    videoPreview.innerHTML = `<video src="${e.target.result}" controls style="max-width: 100%; max-height: 300px; border-radius: 8px;"></video>`;
                }
                if (videoRemoveBtn) videoRemoveBtn.style.display = 'inline-block';
            };
            reader.readAsDataURL(file);
        }
        
        // 모달 닫기
        function closeModal() {
            modalBg.classList.remove('elmo-modal-show');
            modal.classList.remove('elmo-modal-show');
            setTimeout(() => {
                if (modalBg && modalBg.parentNode) modalBg.remove();
            }, 300);
        }
        
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
        if (modalBg) {
            modalBg.addEventListener('click', (e) => {
                if (e.target === modalBg) {
                    closeModal();
                }
            });
        }
        
        // ESC 키로 닫기
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // 폼 제출
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const submitBtn = document.getElementById('elmo-add-submit-btn');
                const resultDiv = document.getElementById('elmo-add-result');
                
                if (!resultDiv) return;
                
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = '저장 중...';
                }
                
                resultDiv.className = 'elmo-result';
                resultDiv.textContent = '저장 중...';
                
                try {
                    const recordDate = document.getElementById('elmo-add-date')?.value;
                    const typeRadio = form.querySelector('input[name="record_type"]:checked');
                    const type = typeRadio ? typeRadio.value : null;
                    const textContent = document.getElementById('elmo-add-text')?.value;
                    
                    if (!recordDate || !type) {
                        resultDiv.className = 'elmo-result elmo-result-error';
                        resultDiv.textContent = '날짜와 타입을 입력해주세요.';
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.textContent = '저장';
                        }
                        return;
                    }
                    
                    // FormData로 전송 (이미지 포함)
                    const formData = new FormData();
                    formData.append('record_date', recordDate);
                    formData.append('type', type);
                    if (textContent) {
                        formData.append('text_content', textContent);
                    }
                    
                    // 압축된 이미지 파일 추가
                    if (selectedImageFile) {
                        formData.append('image', selectedImageFile);
                    }
                    
                    // 동영상은 추후 구현
                    // if (selectedVideoFile) {
                    //     formData.append('video', selectedVideoFile);
                    // }
                    
                    const response = await fetch('/api/elmo/calendar/records', {
                        method: 'POST',
                        headers: {
                            'X-Elmo-Session': currentSessionId,
                            'X-Elmo-User-Id': currentUserId
                            // FormData 사용 시 Content-Type 헤더는 자동 설정됨
                        },
                        body: formData
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        resultDiv.className = 'elmo-result elmo-result-success';
                        resultDiv.textContent = '저장되었습니다.';
                        setTimeout(() => {
                            closeModal();
                            document.removeEventListener('keydown', escHandler);
                            if (onSuccess) onSuccess();
                        }, 500);
                    } else {
                        resultDiv.className = 'elmo-result elmo-result-error';
                        resultDiv.textContent = result.message || '저장에 실패했습니다.';
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.textContent = '저장';
                        }
                    }
                } catch (error) {
                    console.error('기록 추가 오류:', error);
                    if (resultDiv) {
                        resultDiv.className = 'elmo-result elmo-result-error';
                        resultDiv.textContent = '저장 중 오류가 발생했습니다.';
                    }
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = '저장';
                    }
                }
            });
        }
    } catch (error) {
        console.error('모달 표시 오류:', error);
        alert('모달을 여는 중 오류가 발생했습니다: ' + error.message);
    }
}

/**
 * 상세보기 모달 표시
 */
export function showDetailModal(record, onDelete, sessionId, userId) {
    // 세션 및 사용자 ID 설정
    if (sessionId) currentSessionId = sessionId;
    if (userId) currentUserId = userId;
    // 기존 모달 제거
    const existingModal = document.getElementById('elmo-detail-modal');
    if (existingModal) {
        existingModal.remove();
    }
    const existingBg = document.getElementById('elmo-detail-modal-bg');
    if (existingBg) {
        existingBg.remove();
    }
    
    const modalHtml = `
        <div class="elmo-modal-bg" id="elmo-detail-modal-bg">
            <div class="elmo-modal elmo-modal-large" id="elmo-detail-modal">
                <div class="elmo-modal-header">
                    <h2>기록 상세</h2>
                    <button class="elmo-modal-close-btn" id="elmo-detail-modal-close">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="elmo-modal-content">
                    <div class="elmo-detail-group">
                        <div class="elmo-detail-label">날짜</div>
                        <div class="elmo-detail-value">${formatDateDisplay(record.record_date)}</div>
                    </div>
                    <div class="elmo-detail-group">
                        <div class="elmo-detail-label">타입</div>
                        <div class="elmo-detail-value">${record.type === '일정' ? '📅 일정' : '✅ ToDo'}</div>
                    </div>
                    ${record.text_content ? `
                    <div class="elmo-detail-group">
                        <div class="elmo-detail-label">내용</div>
                        <div class="elmo-detail-value elmo-detail-text">${escapeHtml(record.text_content)}</div>
                    </div>
                    ` : ''}
                    ${record.image_url ? `
                    <div class="elmo-detail-group">
                        <div class="elmo-detail-label">사진</div>
                        <div class="elmo-detail-image">
                            <img src="/${record.image_url}" alt="사진" style="max-width: 100%; border-radius: 8px;">
                        </div>
                    </div>
                    ` : ''}
                    ${record.video_url ? `
                    <div class="elmo-detail-group">
                        <div class="elmo-detail-label">동영상</div>
                        <div class="elmo-detail-video">
                            <video src="${record.video_url}" controls style="max-width: 100%; border-radius: 8px;"></video>
                        </div>
                    </div>
                    ` : ''}
                    <div id="elmo-detail-result" class="elmo-result"></div>
                </div>
                <div class="elmo-modal-actions">
                    <button type="button" class="elmo-btn-danger" id="elmo-detail-delete">삭제</button>
                    <button type="button" class="elmo-btn-secondary" id="elmo-detail-close">닫기</button>
                </div>
            </div>
        </div>
    `;
    
    // 모달 추가
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modalBg = document.getElementById('elmo-detail-modal-bg');
    const modal = document.getElementById('elmo-detail-modal');
    
    // 모달 표시 애니메이션
    setTimeout(() => {
        modalBg.classList.add('elmo-modal-show');
        modal.classList.add('elmo-modal-show');
    }, 10);
    
    // 모달 닫기
    function closeModal() {
        modalBg.classList.remove('elmo-modal-show');
        modal.classList.remove('elmo-modal-show');
        setTimeout(() => {
            if (modalBg && modalBg.parentNode) modalBg.remove();
        }, 300);
    }
    
    const closeBtn = document.getElementById('elmo-detail-modal-close');
    const detailCloseBtn = document.getElementById('elmo-detail-close');
    
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (detailCloseBtn) detailCloseBtn.addEventListener('click', closeModal);
    if (modalBg) {
        modalBg.addEventListener('click', (e) => {
            if (e.target === modalBg) {
                closeModal();
            }
        });
    }
    
    // ESC 키로 닫기
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    };
    document.addEventListener('keydown', escHandler);
    
    // 삭제 버튼
    const deleteBtn = document.getElementById('elmo-detail-delete');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (!confirm('정말 삭제하시겠습니까?')) {
                return;
            }
            
            const resultDiv = document.getElementById('elmo-detail-result');
            if (resultDiv) {
                resultDiv.className = 'elmo-result';
                resultDiv.textContent = '삭제 중...';
            }
            
            if (deleteBtn) {
                deleteBtn.disabled = true;
                deleteBtn.textContent = '삭제 중...';
            }
            
            try {
                const response = await fetch(`/api/elmo/calendar/records/${record.id}`, {
                    method: 'DELETE',
                    headers: {
                        'X-Elmo-Session': currentSessionId,
                        'X-Elmo-User-Id': currentUserId
                    }
                });
                
                if (response.ok) {
                    if (resultDiv) {
                        resultDiv.className = 'elmo-result elmo-result-success';
                        resultDiv.textContent = '삭제되었습니다.';
                    }
                    setTimeout(() => {
                        closeModal();
                        document.removeEventListener('keydown', escHandler);
                        if (onDelete) onDelete();
                    }, 500);
                } else {
                    const result = await response.json();
                    if (resultDiv) {
                        resultDiv.className = 'elmo-result elmo-result-error';
                        resultDiv.textContent = result.message || '삭제에 실패했습니다.';
                    }
                    if (deleteBtn) {
                        deleteBtn.disabled = false;
                        deleteBtn.textContent = '삭제';
                    }
                }
            } catch (error) {
                console.error('기록 삭제 오류:', error);
                if (resultDiv) {
                    resultDiv.className = 'elmo-result elmo-result-error';
                    resultDiv.textContent = '삭제 중 오류가 발생했습니다.';
                }
                if (deleteBtn) {
                    deleteBtn.disabled = false;
                    deleteBtn.textContent = '삭제';
                }
            }
        });
    }
}

/**
 * 날짜 포맷팅 (YYYY-MM-DD)
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 날짜 표시 포맷팅
 */
function formatDateDisplay(dateStr) {
    const date = new Date(dateStr);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * HTML 이스케이프
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
