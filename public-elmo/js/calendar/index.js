// Elmo 캘린더 메인 화면

import { init as initCalendar, getSelectedDate, setSelectedDate, getCurrentMonth, setCurrentMonth, updateRecords } from './calendar.js';
import { showAddModal, showDetailModal } from './modals.js';

let currentUserId = null;
let currentSessionId = null;
let currentMonth = new Date();

/**
 * 캘린더 화면 초기화
 */
export async function init(userId) {
    currentUserId = userId;
    
    // localStorage에서 세션 정보 가져오기
    const elmoSession = localStorage.getItem('elmo_session');
    if (elmoSession) {
        currentSessionId = elmoSession;
    }
    
    await render();
}

/**
 * 캘린더 화면 렌더링
 */
async function render() {
    const container = document.getElementById('elmo-content');
    if (!container) {
        return;
    }
    
    const today = new Date();
    currentMonth = new Date(today);
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    
    container.innerHTML = `
        <div class="elmo-calendar-screen">
            <div class="elmo-calendar-top-bar">
                <div class="elmo-calendar-month-display" id="elmo-calendar-month-display">${year}년 ${month}월</div>
                <div class="elmo-calendar-top-buttons">
                    <button class="elmo-calendar-today-btn" id="elmo-calendar-today-btn" title="오늘로 이동">오늘</button>
                </div>
            </div>
            <div id="elmo-calendar-container"></div>
            <div class="elmo-calendar-add-section">
                <button class="elmo-btn elmo-btn-primary elmo-btn-full" id="elmo-calendar-add-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    추가하기
                </button>
            </div>
            <div id="elmo-calendar-list-wrapper"></div>
        </div>
    `;
    
    // 캘린더 초기화
    const calendarContainer = document.getElementById('elmo-calendar-container');
    if (calendarContainer) {
        // 월별 요약 로드
        const summary = await loadCalendarSummary(year, month);
        
        initCalendar(calendarContainer, async (selectedDate) => {
            // 날짜 선택 시 해당 날짜의 기록 로드
            await loadRecordsForDate(selectedDate);
        }, summary);
    }
    
    // 이벤트 리스너 설정
    setupEventListeners();
}

/**
 * 월별 요약 로드 (export)
 */
export async function loadCalendarSummary(year, month) {
    try {
        const response = await fetch(`/api/elmo/calendar/summary?year=${year}&month=${month}`, {
            headers: {
                'X-Elmo-Session': currentSessionId,
                'X-Elmo-User-Id': currentUserId
            }
        });
        
        if (response.ok) {
            const summary = await response.json();
            return summary;
        }
        return {};
    } catch (error) {
        console.error('캘린더 요약 로드 오류:', error);
        return {};
    }
}

/**
 * 날짜별 기록 로드
 */
async function loadRecordsForDate(date) {
    const dateStr = formatDate(date);
    const listWrapper = document.getElementById('elmo-calendar-list-wrapper');
    if (!listWrapper) return;
    
    try {
        const response = await fetch(`/api/elmo/calendar/records?date=${dateStr}`, {
            headers: {
                'X-Elmo-Session': currentSessionId,
                'X-Elmo-User-Id': currentUserId
            }
        });
        
        if (response.ok) {
            const records = await response.json();
            renderRecordsList(records, dateStr);
        } else {
            listWrapper.innerHTML = '<div class="elmo-calendar-no-records">기록을 불러오는 중 오류가 발생했습니다.</div>';
        }
    } catch (error) {
        console.error('기록 로드 오류:', error);
        listWrapper.innerHTML = '<div class="elmo-calendar-no-records">기록을 불러오는 중 오류가 발생했습니다.</div>';
    }
}

/**
 * 기록 목록 렌더링
 */
function renderRecordsList(records, dateStr) {
    const listWrapper = document.getElementById('elmo-calendar-list-wrapper');
    if (!listWrapper) return;
    
    if (records.length === 0) {
        listWrapper.innerHTML = '<div class="elmo-calendar-no-records">이 날짜에 기록이 없습니다.</div>';
        return;
    }
    
    const date = new Date(dateStr);
    const dateText = `${date.getMonth() + 1}월 ${date.getDate()}일`;
    
    let html = `<div class="elmo-calendar-list-header">${dateText} 기록</div>`;
    html += '<div class="elmo-calendar-records-list">';
    
    records.forEach(record => {
        const typeIcon = record.type === '일정' ? '📅' : '✅';
        const hasImage = record.image_url;
        const imageUrl = record.image_url ? (record.image_url.startsWith('/') ? record.image_url : `/${record.image_url}`) : null;
        const thumbnailUrl = imageUrl ? imageUrl.replace('/original.jpg', '/thumbnail_300x300.jpg') : null;
        
        html += `
            <div class="elmo-calendar-record-item" data-record-id="${record.id}">
                <div class="elmo-calendar-card-content">
                    ${hasImage ? `
                        <div class="elmo-calendar-card-image">
                            <img src="${thumbnailUrl || imageUrl}" 
                                 alt="기록 이미지" 
                                 loading="lazy"
                                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 100\\'%3E%3Ctext y=\\'.9em\\' font-size=\\'90\\'%3E📷%3C/text%3E%3C/svg%3E'">
                        </div>
                    ` : ''}
                    <div class="elmo-calendar-card-info">
                        <div class="elmo-calendar-card-header">
                            <div class="elmo-calendar-card-title-row">
                                <div class="elmo-calendar-card-type">${typeIcon} ${record.type}</div>
                                <button class="elmo-calendar-card-edit-btn" data-id="${record.id}" title="수정/삭제">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="5" cy="12" r="1"></circle>
                                        <circle cx="12" cy="12" r="1"></circle>
                                        <circle cx="19" cy="12" r="1"></circle>
                                    </svg>
                                </button>
                            </div>
                            ${record.text_content ? `<div class="elmo-calendar-card-text">${escapeHtml(record.text_content).replace(/\n/g, '<br>')}</div>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    listWrapper.innerHTML = html;
    
    // 기록 클릭 이벤트 (카드 전체 클릭)
    listWrapper.querySelectorAll('.elmo-calendar-record-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // 수정 버튼 클릭은 제외
            if (e.target.closest('.elmo-calendar-card-edit-btn')) {
                return;
            }
            
            const recordId = item.getAttribute('data-record-id');
            const record = records.find(r => r.id === recordId);
            if (record) {
                showDetailModal(record, async () => {
                    // 삭제 후 목록 새로고침
                    await loadRecordsForDate(new Date(dateStr));
                    // 캘린더 요약도 새로고침
                    const month = new Date(dateStr);
                    const summary = await loadCalendarSummary(month.getFullYear(), month.getMonth() + 1);
                    updateRecords(summary);
                }, currentSessionId, currentUserId);
            }
        });
    });
    
    // 수정 버튼 클릭 이벤트
    listWrapper.querySelectorAll('.elmo-calendar-card-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // 카드 클릭 이벤트 방지
            const recordId = btn.getAttribute('data-id');
            const record = records.find(r => r.id === recordId);
            if (record) {
                showDetailModal(record, async () => {
                    // 삭제 후 목록 새로고침
                    await loadRecordsForDate(new Date(dateStr));
                    // 캘린더 요약도 새로고침
                    const month = new Date(dateStr);
                    const summary = await loadCalendarSummary(month.getFullYear(), month.getMonth() + 1);
                    updateRecords(summary);
                }, currentSessionId, currentUserId);
            }
        });
    });
}

/**
 * 날짜 포맷팅
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * HTML 이스케이프
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
    // 오늘 버튼 클릭
    const todayBtn = document.getElementById('elmo-calendar-today-btn');
    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            const today = new Date();
            setSelectedDate(today);
            setCurrentMonth(today);
            const container = document.getElementById('elmo-calendar-container');
            if (container) {
                const year = today.getFullYear();
                const month = today.getMonth() + 1;
                loadCalendarSummary(year, month).then(async summary => {
                    updateRecords(summary);
                    const { render } = await import('./calendar.js');
                    render(container);
                });
                loadRecordsForDate(today);
            }
        });
    }
    
    // 추가하기 버튼 클릭
    const addBtn = document.getElementById('elmo-calendar-add-btn');
    if (addBtn) {
        addBtn.addEventListener('click', async () => {
            try {
                const selectedDateStr = getSelectedDate();
                let selectedDate = new Date();
                
                // 선택된 날짜가 있으면 사용
                if (selectedDateStr) {
                    selectedDate = new Date(selectedDateStr);
                }
                
                // 날짜 유효성 확인
                if (isNaN(selectedDate.getTime())) {
                    selectedDate = new Date();
                }
                
                await showAddModal(selectedDate, async () => {
                    // 추가 후 목록 새로고침
                    await loadRecordsForDate(selectedDate);
                    // 캘린더 요약도 새로고침
                    const month = new Date(selectedDate);
                    const year = month.getFullYear();
                    const monthNum = month.getMonth() + 1;
                    const summary = await loadCalendarSummary(year, monthNum);
                    updateRecords(summary);
                    
                    // 캘린더 다시 렌더링
                    const container = document.getElementById('elmo-calendar-container');
                    if (container) {
                        // calendar.js의 render 함수를 직접 호출
                        const { render } = await import('./calendar.js');
                        render(container);
                    }
                }, currentSessionId, currentUserId);
            } catch (error) {
                console.error('추가 모달 열기 오류:', error);
                alert('모달을 여는 중 오류가 발생했습니다: ' + error.message);
            }
        });
    } else {
        console.error('추가하기 버튼을 찾을 수 없습니다.');
    }
}
