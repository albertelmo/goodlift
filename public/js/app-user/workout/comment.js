// 운동 코멘트 모달

import { formatDate, formatDateShort, escapeHtml } from '../utils.js';
import { getCurrentUser } from '../index.js';

/**
 * 운동 코멘트 모달 표시
 */
export async function showWorkoutCommentModal(appUserId, selectedDate = null, onSuccess) {
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
    const { getToday } = await import('../utils.js');
    const defaultDate = selectedDate || getToday();
    const dateObj = new Date(defaultDate);
    const dateDisplay = formatDateShort(dateObj);
    
    // 현재 로그인한 트레이너 정보 가져오기
    const currentUser = getCurrentUser();
    const trainer_username = currentUser?.username || '';
    const trainer_name = currentUser?.name || '';
    
    // 코멘트 목록 로드
    let comments = [];
    try {
        const response = await fetch(`/api/workout-records/${appUserId}/comments?date=${defaultDate}`);
        if (response.ok) {
            const data = await response.json();
            comments = data.comments || [];
            // 최신순 정렬
            comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        }
    } catch (error) {
        console.error('코멘트 조회 오류:', error);
    }
    
    // 모달 HTML 생성
    const commentsHtml = comments.length > 0 
        ? comments.map(comment => {
            // 한국시간 기준으로 시간 포맷팅 (식단과 동일)
            let commentTime = '';
            if (comment.created_at) {
                const date = new Date(comment.created_at);
                const hours = date.getHours();
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const ampm = hours >= 12 ? 'PM' : 'AM';
                const displayHours = hours % 12 || 12;
                commentTime = `${displayHours}:${minutes} ${ampm}`;
            }
            const isMyComment = comment.trainer_username === trainer_username;
            
            return `
                <div class="workout-comment-item" data-comment-id="${comment.id}">
                    <div class="workout-comment-header">
                        <span class="workout-comment-trainer">${escapeHtml(comment.trainer_name || comment.trainer_username)} 트레이너</span>
                        <span class="workout-comment-time">${commentTime}</span>
                    </div>
                    <div class="workout-comment-content">${escapeHtml(comment.comment)}</div>
                    ${isMyComment ? `
                    <div class="workout-comment-actions">
                        <button class="workout-comment-edit-btn" data-comment-id="${comment.id}">수정</button>
                        <button class="workout-comment-delete-btn" data-comment-id="${comment.id}">삭제</button>
                    </div>
                    ` : ''}
                </div>
            `;
        }).join('')
        : '<div class="workout-comment-empty">작성된 코멘트가 없습니다.</div>';
    
    modal.innerHTML = `
        <div class="app-modal-header">
            <h2>운동 코멘트 남기기</h2>
            <button class="app-modal-close-btn" id="workout-comment-modal-close">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
        <div class="app-modal-content" style="padding: 20px;">
            <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 14px; color: var(--app-text-muted); margin-bottom: 8px;">날짜</label>
                <input type="date" id="workout-comment-date" value="${defaultDate}" style="width: 100%; padding: 10px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); background: var(--app-surface); color: var(--app-text); font-size: 16px; box-sizing: border-box;">
            </div>
            
            <div style="margin-bottom: 20px;">
                <h3 style="font-size: 16px; font-weight: 600; color: var(--app-text); margin: 0 0 12px 0;">기존 코멘트</h3>
                <div id="workout-comment-list" style="max-height: 300px; overflow-y: auto; margin-bottom: 16px;">
                    ${commentsHtml}
                </div>
            </div>
            
            <div style="margin-bottom: 16px;">
                <h3 style="font-size: 16px; font-weight: 600; color: var(--app-text); margin: 0 0 12px 0;">새 코멘트 작성</h3>
                <textarea id="workout-comment-text" placeholder="코멘트를 입력하세요..." style="width: 100%; min-height: 100px; padding: 12px; border: 1px solid var(--app-border); border-radius: var(--app-radius-sm); background: var(--app-surface); color: var(--app-text); font-size: 16px; font-family: inherit; resize: vertical; box-sizing: border-box;"></textarea>
            </div>
            
            <div style="display: flex; gap: 8px;">
                <button class="app-btn-primary" id="workout-comment-save-btn" style="flex: 1;">
                    저장
                </button>
                <button class="app-btn-secondary" id="workout-comment-cancel-btn" style="flex: 1;">
                    취소
                </button>
            </div>
        </div>
    `;
    
    // 모달 표시 애니메이션
    setTimeout(() => {
        modalBg.classList.add('app-modal-show');
        modal.classList.add('app-modal-show');
    }, 10);
    
    // 이벤트 리스너 설정
    setupCommentModalEvents(modalBg, modal, appUserId, trainer_username, trainer_name, onSuccess);
}

/**
 * 코멘트 모달 이벤트 설정
 */
function setupCommentModalEvents(modalBg, modal, appUserId, trainer_username, trainer_name, onSuccess) {
    const closeBtn = modal.querySelector('#workout-comment-modal-close');
    const cancelBtn = modal.querySelector('#workout-comment-cancel-btn');
    const saveBtn = modal.querySelector('#workout-comment-save-btn');
    const dateInput = modal.querySelector('#workout-comment-date');
    const commentText = modal.querySelector('#workout-comment-text');
    const commentList = modal.querySelector('#workout-comment-list');
    
    let editingCommentId = null;
    
    // 닫기
    const closeModal = () => {
        modalBg.classList.remove('app-modal-show');
        modal.classList.remove('app-modal-show');
        setTimeout(() => {
            modalBg.remove();
        }, 300);
    };
    
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
    
    // 날짜 변경 시 코멘트 목록 새로고침
    dateInput.addEventListener('change', async () => {
        const selectedDate = dateInput.value;
        try {
            const response = await fetch(`/api/workout-records/${appUserId}/comments?date=${selectedDate}`);
            if (response.ok) {
                const data = await response.json();
                const comments = (data.comments || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                
                const commentsHtml = comments.length > 0 
                    ? comments.map(comment => {
                        // 한국시간 기준으로 시간 포맷팅 (UTC+9)
                        let commentTime = '';
                        if (comment.created_at) {
                            // UTC 시간을 한국시간(KST, UTC+9)으로 변환
                            const utcDate = new Date(comment.created_at);
                            // 한국시간으로 변환 (UTC+9)
                            const koreanTime = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));
                            // UTC 메서드를 사용하여 변환된 시간의 시/분 추출
                            const hours = koreanTime.getUTCHours();
                            const minutes = String(koreanTime.getUTCMinutes()).padStart(2, '0');
                            const ampm = hours >= 12 ? 'PM' : 'AM';
                            const displayHours = hours % 12 || 12;
                            commentTime = `${displayHours}:${minutes} ${ampm}`;
                        }
                        const isMyComment = comment.trainer_username === trainer_username;
                        
                        return `
                            <div class="workout-comment-item" data-comment-id="${comment.id}">
                                <div class="workout-comment-header">
                                    <span class="workout-comment-trainer">${escapeHtml(comment.trainer_name || comment.trainer_username)} 트레이너</span>
                                    <span class="workout-comment-time">${commentTime}</span>
                                </div>
                                <div class="workout-comment-content">${escapeHtml(comment.comment)}</div>
                                ${isMyComment ? `
                                <div class="workout-comment-actions">
                                    <button class="workout-comment-edit-btn" data-comment-id="${comment.id}">수정</button>
                                    <button class="workout-comment-delete-btn" data-comment-id="${comment.id}">삭제</button>
                                </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')
                    : '<div class="workout-comment-empty">작성된 코멘트가 없습니다.</div>';
                
                commentList.innerHTML = commentsHtml;
                setupCommentItemEvents(commentList, appUserId, trainer_username, dateInput, commentText, onSuccess, closeModal);
            }
        } catch (error) {
            console.error('코멘트 조회 오류:', error);
        }
    });
    
    // 저장 버튼
    saveBtn.addEventListener('click', async () => {
        const selectedDate = dateInput.value;
        const comment = commentText.value.trim();
        
        if (!comment) {
            alert('코멘트를 입력해주세요.');
            return;
        }
        
        try {
            saveBtn.disabled = true;
            saveBtn.textContent = '저장 중...';
            
            const editingCommentId = saveBtn._editingCommentId;
            
            if (editingCommentId) {
                // 수정
                const response = await fetch(`/api/workout-records/${appUserId}/comments/${editingCommentId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        comment,
                        trainer_username
                    })
                });
                
                if (!response.ok) {
                    throw new Error('코멘트 수정에 실패했습니다.');
                }
            } else {
                // 생성
                const response = await fetch(`/api/workout-records/${appUserId}/comments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        workout_date: selectedDate,
                        comment,
                        trainer_username,
                        trainer_name
                    })
                });
                
                if (!response.ok) {
                    throw new Error('코멘트 생성에 실패했습니다.');
                }
            }
            
            // 성공 시 목록 새로고침
            dateInput.dispatchEvent(new Event('change'));
            commentText.value = '';
            saveBtn._editingCommentId = null;
            saveBtn.textContent = '저장';
            
            if (onSuccess) {
                // 선택된 날짜를 전달하여 해당 날짜의 코멘트만 다시 로드
                onSuccess(selectedDate);
            }
            
            // 모달 닫기
            closeModal();
        } catch (error) {
            console.error('코멘트 저장 오류:', error);
            alert(error.message || '코멘트 저장 중 오류가 발생했습니다.');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = '저장';
        }
    });
    
    // 코멘트 아이템 이벤트 설정
    setupCommentItemEvents(commentList, appUserId, trainer_username, dateInput, commentText, onSuccess, closeModal);
}

/**
 * 코멘트 아이템 이벤트 설정
 */
function setupCommentItemEvents(commentList, appUserId, trainer_username, dateInput, commentText, onSuccess, closeModal) {
    // 수정 버튼
    commentList.querySelectorAll('.workout-comment-edit-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const commentId = btn.getAttribute('data-comment-id');
            try {
                const selectedDate = dateInput.value;
                const response = await fetch(`/api/workout-records/${appUserId}/comments?date=${selectedDate}`);
                if (response.ok) {
                    const data = await response.json();
                    const comment = data.comments.find(c => c.id === commentId);
                    if (comment) {
                        commentText.value = comment.comment;
                        commentText.focus();
                        // 수정 모드로 전환
                        const saveBtn = document.querySelector('#workout-comment-save-btn');
                        if (saveBtn) {
                            saveBtn.textContent = '수정';
                            saveBtn._editingCommentId = commentId;
                        }
                    }
                }
            } catch (error) {
                console.error('코멘트 조회 오류:', error);
            }
        });
    });
    
    // 삭제 버튼
    commentList.querySelectorAll('.workout-comment-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const commentId = btn.getAttribute('data-comment-id');
            if (!confirm('정말 삭제하시겠습니까?')) {
                return;
            }
            
            try {
                const response = await fetch(`/api/workout-records/${appUserId}/comments/${commentId}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ trainer_username })
                });
                
                if (!response.ok) {
                    throw new Error('코멘트 삭제에 실패했습니다.');
                }
                
                // 목록 새로고침
                dateInput.dispatchEvent(new Event('change'));
                
                if (onSuccess) {
                    // 선택된 날짜를 전달하여 해당 날짜의 코멘트만 다시 로드
                    const selectedDate = dateInput.value;
                    onSuccess(selectedDate);
                }
                
                // 모달 닫기
                if (closeModal) {
                    closeModal();
                }
            } catch (error) {
                console.error('코멘트 삭제 오류:', error);
                alert(error.message || '코멘트 삭제 중 오류가 발생했습니다.');
            }
        });
    });
}

/**
 * 코멘트 시간 포맷팅
 */
function formatCommentTime(date) {
    // 한국시간 기준으로 시간 포맷팅 (식단과 동일)
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${ampm}`;
}

/**
 * 모달 생성
 */
function createModal() {
    const modalBg = document.createElement('div');
    modalBg.className = 'app-modal-bg';
    modalBg.innerHTML = '<div class="app-modal"></div>';
    document.body.appendChild(modalBg);
    return modalBg;
}
