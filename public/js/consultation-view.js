// 공개 상담기록 조회 페이지

// URL에서 토큰 추출
function getTokenFromUrl() {
    const path = window.location.pathname;
    const parts = path.split('/');
    const tokenIndex = parts.indexOf('view');
    if (tokenIndex !== -1 && parts[tokenIndex + 1]) {
        return parts[tokenIndex + 1];
    }
    return null;
}

// 현재 링크 복사 함수
async function copyCurrentLink() {
    const currentUrl = window.location.href;
    const copyBtn = document.getElementById('copyLinkBtn');
    
    try {
        // 클립보드 API 사용 (모던 브라우저)
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(currentUrl);
            showCopySuccess(copyBtn);
        } 
        // 구형 브라우저 대체 방법
        else {
            const textArea = document.createElement('textarea');
            textArea.value = currentUrl;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            textArea.setSelectionRange(0, 99999); // 모바일용
            
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    showCopySuccess(copyBtn);
                } else {
                    showCopyFallback(currentUrl);
                }
            } catch (err) {
                showCopyFallback(currentUrl);
            }
            
            document.body.removeChild(textArea);
        }
    } catch (err) {
        console.error('링크 복사 실패:', err);
        showCopyFallback(currentUrl);
    }
}

// 복사 성공 시 버튼 상태 변경
function showCopySuccess(btn) {
    const originalText = btn.innerHTML;
    btn.innerHTML = '✓ 복사됨!';
    btn.classList.add('copied');
    
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.classList.remove('copied');
    }, 2000);
}

// 복사 실패 시 대체 방법 (링크 표시)
function showCopyFallback(url) {
    const copyBtn = document.getElementById('copyLinkBtn');
    const originalText = copyBtn.innerHTML;
    
    // 링크를 선택 가능한 텍스트로 표시
    const linkDisplay = document.createElement('div');
    linkDisplay.style.cssText = 'margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px; word-break: break-all; font-size: 12px; color: #333;';
    linkDisplay.innerHTML = `<strong>링크:</strong><br><span style="user-select: all; -webkit-user-select: all;">${url}</span>`;
    
    const header = document.querySelector('.consultation-view-header');
    if (header && !header.querySelector('.link-fallback')) {
        linkDisplay.className = 'link-fallback';
        header.appendChild(linkDisplay);
        
        // 5초 후 제거
        setTimeout(() => {
            if (linkDisplay.parentNode) {
                linkDisplay.parentNode.removeChild(linkDisplay);
            }
        }, 5000);
    }
    
    copyBtn.innerHTML = '📋 링크 표시됨';
    setTimeout(() => {
        copyBtn.innerHTML = originalText;
    }, 2000);
}

// 상담기록 데이터 포맷팅
function formatConsultationData(data) {
    const consultation = data.consultation;
    if (!consultation) return '';
    
    let html = '';
    
    // 운동모습 (동영상 + 사진)
    const hasVideos = consultation.video_urls && Array.isArray(consultation.video_urls) && consultation.video_urls.length > 0;
    const hasImages = consultation.image_urls && Array.isArray(consultation.image_urls) && consultation.image_urls.length > 0;
    
    if (hasVideos || hasImages) {
        html += '<div class="consultation-view-section">';
        html += '<div class="consultation-view-section-title">운동모습</div>';
        
        // 동영상
        if (hasVideos) {
            html += '<div style="margin-bottom: 20px;">';
            consultation.video_urls.forEach((video, index) => {
                const videoUrl = escapeHtml(video.url);
                const mimeType = escapeHtml(video.mime_type || 'video/mp4');
                
                html += `<div class="consultation-view-field" style="margin-bottom: 16px;">`;
                html += `<div class="consultation-view-field-label">${escapeHtml(video.filename || `동영상 ${index + 1}`)}</div>`;
                html += `<video controls preload="metadata" style="width: 100%; max-width: 200px; border-radius: 4px; margin-top: 8px;" `;
                html += `onerror="console.error('[동영상 ${index + 1}] 로드 실패:', this.currentSrc || this.src, '에러:', this.error); const errorMsg = this.parentElement.querySelector('.video-error-message'); if(errorMsg) errorMsg.style.display='block';" `;
                html += `onloadedmetadata="const errorMsg = this.parentElement.querySelector('.video-error-message'); if(errorMsg) errorMsg.style.display='none';" `;
                html += `src="${videoUrl}" `;
                html += `type="${mimeType}">`;
                html += `브라우저가 동영상 재생을 지원하지 않습니다.`;
                html += `</video>`;
                html += `<div style="font-size: 11px; color: #e74c3c; margin-top: 4px; display:none;" class="video-error-message">동영상을 불러올 수 없습니다. (URL: ${videoUrl})</div>`;
                html += `</div>`;
            });
            html += '</div>';
        }
        
        // 사진
        if (hasImages) {
            html += '<div>';
            html += '<div class="consultation-view-image-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px;">';
            
            consultation.image_urls.forEach((image, index) => {
                const imageUrl = escapeHtml(image.url);
                const imageFilename = escapeHtml(image.filename || `사진 ${index + 1}`);
                
                html += `<div class="consultation-view-field" style="margin-bottom: 0;">`;
                html += `<div class="consultation-view-field-label" style="margin-bottom: 8px;">${imageFilename}</div>`;
                html += `<div style="position: relative; cursor: pointer;" onclick="window.open('${imageUrl}', '_blank');">`;
                html += `<img src="${imageUrl}" alt="${imageFilename}" style="width: 100%; height: auto; border-radius: 4px; border: 1px solid #ddd; object-fit: cover; aspect-ratio: 1;" `;
                html += `onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" `;
                html += `/>`;
                html += `<div style="display: none; padding: 20px; text-align: center; color: #999; border: 1px solid #ddd; border-radius: 4px;">이미지를 불러올 수 없습니다.</div>`;
                html += `</div>`;
                html += `</div>`;
            });
            
            html += '</div>';
            html += '</div>';
        }
        
        html += '</div>';
    }
    
    // 기본정보
    html += '<div class="consultation-view-section">';
    html += '<div class="consultation-view-section-title">기본정보</div>';
    html += '<div class="consultation-view-grid consultation-view-basic-info">';
    
    if (consultation.center) {
        html += `<div class="consultation-view-field"><div class="consultation-view-field-label">센터</div><div class="consultation-view-field-value">${escapeHtml(consultation.center)}</div></div>`;
    }
    
    if (consultation.trainer_name || consultation.trainer_username) {
        const trainerName = consultation.trainer_name || consultation.trainer_username;
        html += `<div class="consultation-view-field"><div class="consultation-view-field-label">담당 트레이너</div><div class="consultation-view-field-value">${escapeHtml(trainerName)}</div></div>`;
    }
    
    if (consultation.preferred_time) {
        html += `<div class="consultation-view-field"><div class="consultation-view-field-label">희망시간대</div><div class="consultation-view-field-value">${escapeHtml(consultation.preferred_time)}</div></div>`;
    }
    
    if (consultation.purpose) {
        let purposeText = escapeHtml(consultation.purpose);
        if (consultation.purpose === '기타' && consultation.purpose_other) {
            purposeText += ` (${escapeHtml(consultation.purpose_other)})`;
        }
        html += `<div class="consultation-view-field"><div class="consultation-view-field-label">상담목적</div><div class="consultation-view-field-value">${purposeText}</div></div>`;
    }
    
    if (consultation.requirements) {
        html += `<div class="consultation-view-field"><div class="consultation-view-field-label">요구사항</div><div class="consultation-view-field-value">${escapeHtml(consultation.requirements)}</div></div>`;
    }
    
    html += '</div></div>';
    
    // 운동이력/병력
    if (consultation.exercise_history || consultation.medical_history) {
        html += '<div class="consultation-view-section">';
        html += '<div class="consultation-view-section-title">이력</div>';
        
        if (consultation.exercise_history) {
            html += `<div class="consultation-view-field"><div class="consultation-view-field-label">운동이력</div><div class="consultation-view-field-value">${escapeHtml(consultation.exercise_history)}</div></div>`;
        }
        
        if (consultation.medical_history) {
            html += `<div class="consultation-view-field"><div class="consultation-view-field-label">병력</div><div class="consultation-view-field-value">${escapeHtml(consultation.medical_history)}</div></div>`;
        }
        
        html += '</div>';
    }
    
    // 기본검사
    if (consultation.inbody || consultation.overhead_squat) {
        html += '<div class="consultation-view-section">';
        html += '<div class="consultation-view-section-title">기본검사</div>';
        
        if (consultation.inbody) {
            html += `<div class="consultation-view-field"><div class="consultation-view-field-label">인바디</div><div class="consultation-view-field-value">${escapeHtml(consultation.inbody)}</div></div>`;
        }
        
        if (consultation.overhead_squat) {
            html += `<div class="consultation-view-field"><div class="consultation-view-field-label">오버헤드스쿼트</div><div class="consultation-view-field-value">${escapeHtml(consultation.overhead_squat)}</div></div>`;
        }
        
        html += '</div>';
    }
    
    // 상세검사
    if (consultation.slr_test || consultation.empty_can_test || consultation.rom || consultation.flexibility || consultation.static_posture) {
        html += '<div class="consultation-view-section">';
        html += '<div class="consultation-view-section-title">상세검사</div>';
        
        if (consultation.slr_test) {
            html += `<div class="consultation-view-field"><div class="consultation-view-field-label">SLR 테스트</div><div class="consultation-view-field-value">${escapeHtml(consultation.slr_test)}</div></div>`;
        }
        
        if (consultation.empty_can_test) {
            html += `<div class="consultation-view-field"><div class="consultation-view-field-label">Empty Can 테스트</div><div class="consultation-view-field-value">${escapeHtml(consultation.empty_can_test)}</div></div>`;
        }
        
        if (consultation.rom) {
            html += `<div class="consultation-view-field"><div class="consultation-view-field-label">가동범위</div><div class="consultation-view-field-value">${escapeHtml(consultation.rom)}</div></div>`;
        }
        
        if (consultation.flexibility) {
            html += `<div class="consultation-view-field"><div class="consultation-view-field-label">유연성</div><div class="consultation-view-field-value">${escapeHtml(consultation.flexibility)}</div></div>`;
        }
        
        if (consultation.static_posture) {
            html += `<div class="consultation-view-field"><div class="consultation-view-field-label">정적 자세평가</div><div class="consultation-view-field-value">${escapeHtml(consultation.static_posture)}</div></div>`;
        }
        
        html += '</div>';
    }
    
    // 수행운동
    if (consultation.exercise_performed) {
        html += '<div class="consultation-view-section">';
        html += '<div class="consultation-view-section-title">수행운동</div>';
        html += `<div class="consultation-view-field"><div class="consultation-view-field-value">${escapeHtml(consultation.exercise_performed)}</div></div>`;
        html += '</div>';
    }
    
    // 상담정리
    if (consultation.summary) {
        html += '<div class="consultation-view-section">';
        html += '<div class="consultation-view-section-title">상담정리</div>';
        html += `<div class="consultation-view-field"><div class="consultation-view-field-label">종합평가</div><div class="consultation-view-field-value">${escapeHtml(consultation.summary)}</div></div>`;
        html += '</div>';
    }
    
    // 하단 문구
    html += '<div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 14px; font-weight: 500;">Good Lift Good Life!</div>';
    
    return html;
}

// HTML 이스케이프
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 상담기록 로드
async function loadConsultation() {
    const token = getTokenFromUrl();
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const contentDiv = document.getElementById('content');
    const dataDiv = document.getElementById('consultationData');
    
    if (!token) {
        loadingDiv.style.display = 'none';
        errorDiv.style.display = 'block';
        errorDiv.textContent = '유효하지 않은 링크입니다.';
        return;
    }
    
    try {
        const response = await fetch(`/api/public/consultation/${token}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            loadingDiv.style.display = 'none';
            errorDiv.style.display = 'block';
            
            if (errorData.error === 'NOT_FOUND') {
                errorDiv.textContent = '링크를 찾을 수 없습니다.';
            } else if (errorData.error === 'EXPIRED_TOKEN') {
                errorDiv.textContent = '만료된 링크입니다.';
            } else if (errorData.error === 'TOKEN_DISABLED') {
                errorDiv.textContent = '비활성화된 링크입니다.';
            } else {
                errorDiv.textContent = errorData.message || '상담기록을 불러올 수 없습니다.';
            }
            return;
        }
        
        const data = await response.json();
        const html = formatConsultationData(data);
        
        loadingDiv.style.display = 'none';
        contentDiv.style.display = 'block';
        dataDiv.innerHTML = html;
        
        // 제목 업데이트
        const consultation = data.consultation;
        const titleElement = document.querySelector('.consultation-view-header h1');
        if (titleElement && consultation && consultation.name) {
            titleElement.textContent = `${consultation.name}님의 상담기록`;
        }
        
    } catch (error) {
        console.error('상담기록 로드 오류:', error);
        loadingDiv.style.display = 'none';
        errorDiv.style.display = 'block';
        errorDiv.textContent = '상담기록을 불러오는 중 오류가 발생했습니다.';
    }
}

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', loadConsultation);
