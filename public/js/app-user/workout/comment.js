// 운동 코멘트 모달

import { escapeHtml } from '../utils.js';
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
    
    // 날짜를 "YY.M.D" 형식으로 변환 (운동 선택과 동일)
    const dateObj = new Date(defaultDate);
    const year = dateObj.getFullYear().toString().slice(-2);
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    const dateDisplay = `${year}.${month}.${day}`;
    
    // 현재 로그인한 사용자 정보 (트레이너/회원)
    const currentUser = getCurrentUser();
    const isTrainer = currentUser?.is_trainer === true || currentUser?.isTrainer === true;
    const isViewingMember = Boolean(localStorage.getItem('connectedMemberAppUserId'));
    const commenter_type = isTrainer ? 'trainer' : 'member';
    const commenter_app_user_id = currentUser?.id || null;
    const commenter_username = currentUser?.username || '';
    const commenter_name = currentUser?.name || '';
    
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
            const isTrainerComment = comment.commenter_type === 'trainer';
            const isMemberComment = !isTrainerComment;
            const isMyComment = comment.commenter_type === commenter_type && (
                (commenter_app_user_id && comment.commenter_app_user_id === commenter_app_user_id) ||
                (isTrainerComment && commenter_username && comment.commenter_username === commenter_username)
            );
            const commenterLabel = isTrainerComment
                ? `${escapeHtml(comment.commenter_name || comment.commenter_username || '트레이너')} 트레이너`
                : (isTrainer && isViewingMember
                    ? `${escapeHtml(comment.commenter_name || comment.commenter_username || '회원')} 회원님`
                    : '나');
            
            return `
                <div class="workout-comment-item ${isMemberComment ? 'workout-comment-item-mine' : ''}" data-comment-id="${comment.id}">
                    <div class="workout-comment-header">
                        <span class="workout-comment-trainer">${commenterLabel}</span>
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
            <h2>운동 코멘트 (${dateDisplay})</h2>
            <button class="app-modal-close-btn" id="workout-comment-modal-close">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
        <div class="app-modal-content" style="padding: 20px;">
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
                <button class="app-btn-secondary" id="workout-comment-cancel-btn" style="flex: 1;">
                    취소
                </button>
                <button class="app-btn-primary" id="workout-comment-save-btn" style="flex: 1;">
                    저장
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
    setupCommentModalEvents(
        modalBg,
        modal,
        appUserId,
        defaultDate,
        {
            commenter_type,
            commenter_app_user_id,
            commenter_username,
            commenter_name,
            isTrainer,
            isViewingMember
        },
        onSuccess
    );
}

/**
 * 코멘트 모달 이벤트 설정
 */
function setupCommentModalEvents(modalBg, modal, appUserId, selectedDate, commenterInfo, onSuccess) {
    const closeBtn = modal.querySelector('#workout-comment-modal-close');
    const cancelBtn = modal.querySelector('#workout-comment-cancel-btn');
    const saveBtn = modal.querySelector('#workout-comment-save-btn');
    const commentText = modal.querySelector('#workout-comment-text');
    const commentList = modal.querySelector('#workout-comment-list');
    const {
        commenter_type,
        commenter_app_user_id,
        commenter_username,
        commenter_name,
        isTrainer,
        isViewingMember
    } = commenterInfo;
    
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
    
    // 저장 버튼
    saveBtn.addEventListener('click', async () => {
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
                        commenter_type,
                        commenter_app_user_id,
                        commenter_username,
                        commenter_name
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
                        commenter_type,
                        commenter_app_user_id,
                        commenter_username,
                        commenter_name
                    })
                });
                
                if (!response.ok) {
                    throw new Error('코멘트 생성에 실패했습니다.');
                }
            }
            
            // 성공 시 텍스트 초기화
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
    setupCommentItemEvents(
        commentList,
        appUserId,
        selectedDate,
        { commenter_type, commenter_app_user_id, commenter_username },
        commentText,
        saveBtn,
        onSuccess,
        closeModal
    );
}

/**
 * 코멘트 아이템 이벤트 설정
 */
function setupCommentItemEvents(commentList, appUserId, selectedDate, commenterInfo, commentText, saveBtn, onSuccess, closeModal) {
    const { commenter_type, commenter_app_user_id, commenter_username } = commenterInfo;
    // 수정 버튼
    commentList.querySelectorAll('.workout-comment-edit-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const commentId = btn.getAttribute('data-comment-id');
            try {
                const response = await fetch(`/api/workout-records/${appUserId}/comments?date=${selectedDate}`);
                if (response.ok) {
                    const data = await response.json();
                    const comment = data.comments.find(c => c.id === commentId);
                    if (comment) {
                        commentText.value = comment.comment;
                        commentText.focus();
                        // 수정 모드로 전환
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
                    body: JSON.stringify({
                        commenter_type,
                        commenter_app_user_id,
                        commenter_username
                    })
                });
                
                if (!response.ok) {
                    throw new Error('코멘트 삭제에 실패했습니다.');
                }
                
                if (onSuccess) {
                    // 선택된 날짜를 전달하여 해당 날짜의 코멘트만 다시 로드
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
