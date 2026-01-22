// 앱 유저 공통 유틸리티 함수

/**
 * 날짜 포맷팅 (YYYY-MM-DD)
 */
export function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 날짜 포맷팅 (MM월 DD일)
 */
export function formatDateShort(date) {
    if (!date) return '';
    const d = new Date(date);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${month}월 ${day}일`;
}

/**
 * 시간 포맷팅 (HH:mm)
 */
export function formatTime(date) {
    if (!date) return '';
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * 날짜+시간 포맷팅 (YYYY-MM-DD HH:mm)
 */
export function formatDateTime(date) {
    if (!date) return '';
    return `${formatDate(date)} ${formatTime(date)}`;
}

/**
 * 오늘 날짜 반환 (YYYY-MM-DD)
 */
export function getToday() {
    return formatDate(new Date());
}

/**
 * 상대 시간 계산 (예: "2시간 전", "방금 전")
 */
export function getTimeAgo(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSeconds < 60) {
        return '방금 전';
    } else if (diffMinutes < 60) {
        return `${diffMinutes}분 전`;
    } else if (diffHours < 24) {
        return `${diffHours}시간 전`;
    } else if (diffDays < 7) {
        return `${diffDays}일 전`;
    } else {
        // 7일 이상이면 날짜 표시
        return formatDateShort(date);
    }
}

/**
 * 서버 터미널에 디버깅 로그 전송
 */
export function debugLog(level, message, data = null) {
    // 브라우저 콘솔에도 출력
    if (data) {
        console.log(`[${level}]`, message, data);
    } else {
        console.log(`[${level}]`, message);
    }
    
    // 서버로 로그 전송 (비동기, 에러 무시)
    fetch('/api/debug-log', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ level, message, data })
    }).catch(() => {
        // 서버 전송 실패는 무시
    });
}

/**
 * HTML 이스케이프
 */
export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 숫자 포맷팅 (천 단위 콤마)
 */
export function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return Number(num).toLocaleString('ko-KR');
}

/**
 * 로딩 상태 표시
 */
export function showLoading(container) {
    if (!container) return;
    container.innerHTML = '<div class="app-loading"><div class="app-spinner"></div><p>불러오는 중...</p></div>';
}

/**
 * 에러 메시지 표시
 */
export function showError(container, message) {
    if (!container) return;
    container.innerHTML = `<div class="app-error"><p>${escapeHtml(message)}</p></div>`;
}

/**
 * 빈 상태 표시
 */
export function showEmpty(container, message = '데이터가 없습니다.') {
    if (!container) return;
    container.innerHTML = `<div class="app-empty"><p>${escapeHtml(message)}</p></div>`;
}

/**
 * 무게 포맷팅 (소수점 두자리까지, 예: "10.25kg", "10kg")
 */
export function formatWeight(weight) {
    if (weight === null || weight === undefined) return '-';
    const num = parseFloat(weight);
    if (isNaN(num)) return '-';
    // 소수점 두자리까지 표시, 불필요한 .00 제거
    const formatted = num.toFixed(2).replace(/\.?0+$/, '');
    return `${formatted}kg`;
}

/**
 * 무게 파싱 및 검증 (소수점 두자리까지 허용)
 */
export function parseWeight(value) {
    if (!value || value === '') return null;
    const trimmed = String(value).trim();
    if (trimmed === '') return null;
    
    const num = parseFloat(trimmed);
    if (isNaN(num)) return null;
    if (num < 0) return null;
    
    // 소수점 두자리로 제한
    return Math.round(num * 100) / 100;
}

/**
 * 텍스트가 컨테이너를 넘치면 폰트 크기를 자동으로 줄이는 함수
 * @param {HTMLElement} element - 조정할 요소
 * @param {number} minFontSize - 최소 폰트 크기 (기본값: 10px)
 * @param {number} maxFontSize - 최대 폰트 크기 (기본값: 15px)
 */
export function autoResizeText(element, minFontSize = 10, maxFontSize = 15) {
    if (!element) return;
    
    // 초기 폰트 크기 설정
    element.style.fontSize = `${maxFontSize}px`;
    
    // 요소가 보이는지 확인
    if (element.offsetWidth === 0 && element.offsetHeight === 0) {
        // 요소가 아직 렌더링되지 않았으면 다음 프레임에 다시 시도
        requestAnimationFrame(() => autoResizeText(element, minFontSize, maxFontSize));
        return;
    }
    
    // 스크롤 너비와 실제 너비 비교
    const scrollWidth = element.scrollWidth;
    const clientWidth = element.clientWidth;
    
    // 텍스트가 넘치면 폰트 크기 줄이기
    if (scrollWidth > clientWidth && maxFontSize > minFontSize) {
        const newFontSize = Math.max(minFontSize, maxFontSize - 1);
        element.style.fontSize = `${newFontSize}px`;
        // 재귀적으로 다시 확인
        requestAnimationFrame(() => autoResizeText(element, minFontSize, newFontSize));
    }
}
