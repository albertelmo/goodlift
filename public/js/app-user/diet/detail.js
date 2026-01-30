// 식단기록 상세 보기 모달 (코멘트 포함)

import { formatDate, formatDateShort, escapeHtml } from '../utils.js';
import { getDietRecordById, addDietComment, updateDietComment, deleteDietComment } from '../api.js';

/**
 * 식단기록 상세 보기 모달 표시
 */
export async function showDietDetailModal(appUserId, record, isReadOnly = false, onSuccess) {
    // 기존 모달이 있으면 제거
    const existingModals = document.querySelectorAll('.app-modal-bg');
    existingModals.forEach(modal => {
        if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    });
    
    // 최신 데이터 로드 (코멘트 포함)
    let fullRecord;
    try {
        fullRecord = await getDietRecordById(record.id, appUserId);
    } catch (error) {
        console.error('식단기록 상세 조회 오류:', error);
        fullRecord = record; // 오류 시 기존 데이터 사용
    }
    
    const mealDate = fullRecord.meal_date || '';
    const mealTime = fullRecord.meal_time || '';
    const mealType = fullRecord.meal_type || '';
    const notes = escapeHtml(fullRecord.notes || '');
    
    // 식사 구분 한글 변환
    const mealTypeLabels = {
        'breakfast': '아침',
        'lunch': '점심',
        'dinner': '저녁',
        'snack': '간식'
    };
    const mealTypeLabel = mealType ? mealTypeLabels[mealType] || mealType : '';
    const imageUrl = fullRecord.image_url || fullRecord.image_thumbnail_url || null;
    const comments = fullRecord.comments || [];
    
    // 날짜 표시
    const dateObj = new Date(mealDate + 'T00:00:00');
    const dateDisplay = formatDateShort(dateObj);
    
    // 시간 표시 (HH:mm 형식)
    let timeDisplay = '';
    if (mealTime) {
        const timeMatch = mealTime.match(/^(\d{1,2}):(\d{2})/);
        if (timeMatch) {
            const hours = String(parseInt(timeMatch[1], 10)).padStart(2, '0');
            const minutes = timeMatch[2];
            timeDisplay = `${hours}:${minutes}`;
        } else {
            timeDisplay = mealTime;
        }
    }
    
    // 코멘트 HTML 생성 (카드와 동일한 말풍선 스타일)
    const commentsHtml = comments.map(comment => {
        const commentText = escapeHtml(comment.comment_text).replace(/\r?\n/g, '<br>');
        // 시간을 "11:11 AM" 형식으로 변환 (이미 한국 시간으로 저장됨)
        let commentTime = '';
        if (comment.created_at) {
            const date = new Date(comment.created_at);
            const hours = date.getHours();
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours % 12 || 12;
            commentTime = `${displayHours}:${minutes} ${ampm}`;
        }
        
        // 코멘트 정렬 결정:
        // - 트레이너 코멘트: 항상 왼쪽 정렬 (기본)
        // - 유저 코멘트: 현재 사용자가 작성한 경우만 오른쪽 정렬
        const isTrainerComment = comment.commenter_type === 'trainer';
        const isMyComment = !isTrainerComment && appUserId && comment.commenter_id === appUserId;
        const trainerName = isTrainerComment && comment.commenter_name ? escapeHtml(comment.commenter_name) : '';
        
        return `
            <div class="app-diet-card-comment-wrapper ${isTrainerComment ? 'app-diet-card-comment-wrapper-trainer' : ''} ${isMyComment ? 'app-diet-card-comment-wrapper-mine' : ''}">
                ${isTrainerComment && trainerName ? `
                    <div class="app-diet-card-comment-trainer-name">${trainerName}</div>
                ` : ''}
                ${isMyComment ? `
                    <div class="app-diet-card-comment-user-name">나</div>
                ` : ''}
                <div class="app-diet-card-comment-bubble ${isMyComment ? 'app-diet-card-comment-bubble-mine' : ''} ${isTrainerComment ? 'app-diet-card-comment-bubble-trainer' : ''}">
                    <div class="app-diet-card-comment-content">
                        <div class="app-diet-card-comment-text">${commentText}</div>
                        ${commentTime ? `<div class="app-diet-card-comment-time">${commentTime}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // diet/add.js와 동일한 HTML 구조 사용
    const modalHtml = `
        <div class="app-modal-bg" id="diet-detail-modal-bg">
            <div class="app-modal app-modal-large" id="diet-detail-modal">
                <div class="app-modal-header">
                    <h2>식단 상세</h2>
                    <button class="app-modal-close-btn" id="diet-detail-modal-close">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="app-modal-content">
                    <div class="app-diet-detail">
                        <div class="app-diet-detail-header">
                            <div class="app-diet-detail-time-group">
                                ${dateDisplay ? `<span class="app-diet-detail-date">${dateDisplay}</span>` : ''}
                                ${timeDisplay ? `<span class="app-diet-detail-time">${timeDisplay}</span>` : ''}
                                ${mealTypeLabel ? `<span class="app-diet-detail-meal-type">${mealTypeLabel}</span>` : ''}
                            </div>
                        </div>
                        
                        ${imageUrl ? `
                            <div class="app-diet-detail-image">
                                <img src="${imageUrl}" alt="식단 사진" 
                                     loading="lazy"
                                     class="diet-detail-image-clickable"
                                     data-full-image-url="${fullRecord.image_url || imageUrl}"
                                     style="cursor: pointer; max-width: 100%; border-radius: 8px;">
                            </div>
                        ` : ''}
                        
                        <div class="app-diet-detail-content">
                            ${notes ? `<div class="app-diet-detail-notes">${notes}</div>` : ''}
                        </div>
                        
                        <div class="app-diet-comments-section">
                            ${comments.length > 0 ? `
                                <div class="app-diet-card-comments-section" id="diet-detail-comments-list">
                                    ${commentsHtml}
                                </div>
                            ` : ''}
                            
                            ${!isReadOnly ? `
                                <div class="app-diet-comment-input">
                                    <textarea id="diet-detail-comment-input" 
                                           placeholder="코멘트를 입력하세요..." 
                                           class="app-diet-comment-input-field" rows="2"></textarea>
                                    <button type="button" class="app-btn-primary" id="diet-detail-comment-submit">전송</button>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // diet/add.js와 동일한 방식으로 HTML 삽입
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // diet/add.js와 동일한 방식으로 요소 가져오기
    const modalBg = document.getElementById('diet-detail-modal-bg');
    const modal = document.getElementById('diet-detail-modal');
    const closeBtn = document.getElementById('diet-detail-modal-close');
    const commentInput = document.getElementById('diet-detail-comment-input');
    const commentSubmitBtn = document.getElementById('diet-detail-comment-submit');
    const dietImage = modal?.querySelector('.diet-detail-image-clickable');
    
    // 필수 요소 확인
    if (!modalBg || !modal || !closeBtn) {
        console.error('식단 상세 모달 요소를 찾을 수 없습니다.');
        return;
    }
    
    // diet/add.js와 동일한 모달 표시 애니메이션
    setTimeout(() => {
        modalBg.classList.add('app-modal-show');
        modal.classList.add('app-modal-show');
    }, 10);
    
    // 이미지 전체 화면 뷰어 함수
    function showImageFullscreen(imageUrl) {
        const fullscreenHtml = `
            <div class="app-modal-bg app-image-fullscreen-bg" id="diet-image-fullscreen-bg">
                <button class="app-image-fullscreen-close" id="diet-image-fullscreen-close" aria-label="닫기">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                <img src="${imageUrl}" alt="전체 화면 이미지" class="diet-fullscreen-image">
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', fullscreenHtml);
        
        const fullscreenBg = document.getElementById('diet-image-fullscreen-bg');
        const fullscreenClose = document.getElementById('diet-image-fullscreen-close');
        const fullscreenImage = fullscreenBg?.querySelector('.diet-fullscreen-image');
        
        setTimeout(() => {
            if (fullscreenBg) {
                fullscreenBg.classList.add('app-modal-show');
            }
        }, 10);
        
        // ESC 핸들러 먼저 정의
        const fullscreenEscHandler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                closeFullscreen();
            }
        };
        
        function closeFullscreen() {
            if (fullscreenBg) {
                fullscreenBg.classList.remove('app-modal-show');
                setTimeout(() => {
                    if (fullscreenBg && fullscreenBg.parentNode) {
                        fullscreenBg.remove();
                    }
                    // ESC 키 이벤트 리스너 제거
                    document.removeEventListener('keydown', fullscreenEscHandler);
                }, 200);
            }
        }
        
        if (fullscreenClose) {
            fullscreenClose.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeFullscreen();
            });
        }
        
        if (fullscreenBg) {
            fullscreenBg.addEventListener('click', (e) => {
                if (e.target === fullscreenBg || e.target === fullscreenImage) {
                    e.preventDefault();
                    e.stopPropagation();
                    closeFullscreen();
                }
            });
        }
        
        document.addEventListener('keydown', fullscreenEscHandler);
    }
    
    // 이미지 클릭 이벤트
    if (dietImage) {
        dietImage.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const fullImageUrl = dietImage.getAttribute('data-full-image-url');
            if (fullImageUrl) {
                showImageFullscreen(fullImageUrl);
            }
        });
    }
    
    // diet/add.js와 동일한 closeModal 함수
    function closeModal() {
        modalBg.classList.remove('app-modal-show');
        modal.classList.remove('app-modal-show');
        setTimeout(() => {
            if (modalBg && modalBg.parentNode) {
                modalBg.remove();
            }
            // ESC 키 이벤트 리스너 제거
            document.removeEventListener('keydown', escHandler);
        }, 300);
    }
    
    // diet/add.js와 동일한 순서로 이벤트 리스너 등록
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeModal();
        });
    }
    
    // 배경 클릭 시 닫기
    if (modalBg) {
        modalBg.addEventListener('click', (e) => {
            if (e.target === modalBg) {
                e.preventDefault();
                e.stopPropagation();
                closeModal();
            }
        });
    }
    
    // ESC 키로 닫기
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            closeModal();
        }
    };
    document.addEventListener('keydown', escHandler);
    
    // 코멘트 전송
    if (!isReadOnly && commentSubmitBtn) {
        const sendComment = async () => {
            const commentText = commentInput.value.trim();
            if (!commentText) {
                return;
            }
            
            commentSubmitBtn.disabled = true;
            commentSubmitBtn.textContent = '전송 중...';
            
            try {
                // 트레이너 여부 확인 (연결된 회원을 보고 있는 경우 트레이너일 가능성)
                const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
                const trainerUsername = localStorage.getItem('username');
                let isTrainer = false;
                let trainerName = null;
                
                // 연결된 회원이 있고, 현재 사용자와 다른 경우 트레이너일 가능성
                if (connectedMemberAppUserId && connectedMemberAppUserId === appUserId) {
                    // 트레이너 목록에서 현재 사용자가 트레이너인지 확인
                    try {
                        const trainersResponse = await fetch(`/api/trainers?username=${encodeURIComponent(trainerUsername)}`);
                        if (trainersResponse.ok) {
                            const trainers = await trainersResponse.json();
                            const trainer = trainers.find(t => t.username === trainerUsername);
                            if (trainer) {
                                isTrainer = true;
                                trainerName = trainer.name;
                            }
                        }
                    } catch (error) {
                        console.error('트레이너 확인 오류:', error);
                    }
                }
                
                let commentData;
                
                if (isTrainer) {
                    // 트레이너 코멘트
                    commentData = {
                        commenter_type: 'trainer',
                        commenter_id: trainerUsername,
                        commenter_name: trainerName,
                        comment_text: commentText
                    };
                } else {
                    // 일반 유저 코멘트
                    const userResponse = await fetch(`/api/app-users/${appUserId}`);
                    const user = await userResponse.json();
                    
                    commentData = {
                        commenter_type: 'user',
                        commenter_id: appUserId,
                        commenter_name: user.name,
                        comment_text: commentText
                    };
                }
                
                // app_user_id는 식단기록 소유자이므로 별도로 전달
                await addDietComment(fullRecord.id, commentData, appUserId);
                
                // 코멘트 입력창 초기화
                commentInput.value = '';
                
                // 모달 닫기
                closeModal();
                if (onSuccess) {
                    onSuccess();
                }
            } catch (error) {
                console.error('코멘트 추가 오류:', error);
                alert(error.message || '코멘트 추가 중 오류가 발생했습니다.');
            } finally {
                commentSubmitBtn.disabled = false;
                commentSubmitBtn.textContent = '전송';
            }
        };
        
        commentSubmitBtn.addEventListener('click', sendComment);
    }
}
