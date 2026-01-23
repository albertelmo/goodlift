// 상담기록지 모달 관리

let trainersList = [];
let centersList = [];

// 센터 목록 로드 (입력 모달용)
async function loadCenters() {
    try {
        const response = await fetch('/api/centers');
        if (response.ok) {
            centersList = await response.json();
            const centerSelect = document.getElementById('consultation-center');
            if (centerSelect) {
                centerSelect.innerHTML = '<option value="">센터를 선택하세요</option>';
                centersList.forEach(center => {
                    const option = document.createElement('option');
                    option.value = center.name;
                    option.textContent = center.name;
                    centerSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('센터 목록 로드 오류:', error);
    }
}

// 센터 목록 로드 (목록 모달 필터용)
async function loadCentersForFilter() {
    try {
        const response = await fetch('/api/centers');
        if (response.ok) {
            const centers = await response.json();
            const centerSelect = document.getElementById('consultation-list-filter-center');
            if (centerSelect) {
                centerSelect.innerHTML = '<option value="">전체</option>';
                centers.forEach(center => {
                    const option = document.createElement('option');
                    option.value = center.name;
                    option.textContent = center.name;
                    centerSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('센터 목록 로드 오류:', error);
    }
}

// 트레이너 목록 로드 (입력 모달용)
async function loadTrainers() {
    try {
        const response = await fetch('/api/trainers');
        if (response.ok) {
            trainersList = await response.json();
            const trainerSelect = document.getElementById('consultation-trainer');
            if (trainerSelect) {
                trainerSelect.innerHTML = '<option value="">트레이너를 선택하세요</option>';
                trainersList.forEach(trainer => {
                    const option = document.createElement('option');
                    option.value = trainer.username;
                    option.textContent = trainer.name || trainer.username;
                    trainerSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('트레이너 목록 로드 오류:', error);
    }
}

// 트레이너 목록 로드 (목록 모달 필터용)
async function loadTrainersForFilter() {
    try {
        const response = await fetch('/api/trainers');
        if (response.ok) {
            const trainers = await response.json();
            trainersList = trainers; // 전역 변수에 저장 (목록 조회 시 사용)
            const trainerSelect = document.getElementById('consultation-list-filter-trainer');
            if (trainerSelect) {
                trainerSelect.innerHTML = '<option value="">전체</option>';
                trainers.forEach(trainer => {
                    const option = document.createElement('option');
                    option.value = trainer.username;
                    option.textContent = trainer.name || trainer.username;
                    trainerSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('트레이너 목록 로드 오류:', error);
    }
}

// 상담기록 목록 모달 열기
async function openConsultationListModal() {
    const modal = document.getElementById('consultationListModal');
    const modalBg = document.getElementById('consultationListModalBg');
    
    if (modal && modalBg) {
        modal.style.display = 'block';
        modalBg.style.display = 'block';
        
        // 센터 및 트레이너 목록 로드 (필터용)
        await loadCentersForFilter();
        await loadTrainersForFilter();
        
        // 필터 초기화
        document.getElementById('consultation-list-filter-center').value = '';
        document.getElementById('consultation-list-filter-trainer').value = '';
        
        // 현재월로 설정 (YYYY-MM 형식)
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        document.getElementById('consultation-list-filter-month').value = currentMonth;
        
        // 현재월 기준 전체 목록 자동 조회
        await loadConsultationList();
    }
}

// 전역에서 접근 가능하도록 window 객체에 할당
window.openConsultationListModal = openConsultationListModal;

// 상담기록 목록 모달 닫기
function closeConsultationListModal() {
    const modal = document.getElementById('consultationListModal');
    const modalBg = document.getElementById('consultationListModalBg');
    
    if (modal && modalBg) {
        modal.style.display = 'none';
        modalBg.style.display = 'none';
    }
}

// 상담기록지 입력 모달 열기
function openConsultationModal() {
    currentEditRecordId = null; // 새로 추가 모드
    
    const modal = document.getElementById('consultationModal');
    const modalBg = document.getElementById('consultationModalBg');
    
    if (modal && modalBg) {
        modal.style.display = 'block';
        modalBg.style.display = 'block';
        
        // 센터 및 트레이너 목록 로드
        loadCenters();
        loadTrainers();
        
        // 폼 초기화
        document.getElementById('consultationForm').reset();
        document.getElementById('consultationResult').textContent = '';
        document.getElementById('consultation-purpose-other-row').style.display = 'none';
        
        // 삭제 버튼 숨김
        const deleteBtn = document.getElementById('consultationDeleteBtn');
        if (deleteBtn) {
            deleteBtn.style.display = 'none';
        }
        
        // 상담지 제작 버튼 숨김
        const createShareBtn = document.getElementById('consultationCreateShareBtn');
        if (createShareBtn) {
            createShareBtn.style.display = 'none';
        }
        
        // 모달 제목 변경
        const modalTitle = modal.querySelector('h3');
        if (modalTitle) {
            modalTitle.textContent = '📝 상담기록 입력';
        }
    }
}

// 모달 닫기
function closeConsultationModal() {
    currentEditRecordId = null; // 수정 모드 초기화
    
    const modal = document.getElementById('consultationModal');
    const modalBg = document.getElementById('consultationModalBg');
    
    if (modal && modalBg) {
        modal.style.display = 'none';
        modalBg.style.display = 'none';
        
        // 폼 초기화
        document.getElementById('consultationForm').reset();
        document.getElementById('consultationResult').textContent = '';
        document.getElementById('consultation-purpose-other-row').style.display = 'none';
        
        // 삭제 버튼 상태 초기화
        const deleteBtn = document.getElementById('consultationDeleteBtn');
        if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.textContent = '삭제';
            deleteBtn.style.display = 'none';
        }
        
        // 상담지 제작 버튼 숨김
        const createShareBtn = document.getElementById('consultationCreateShareBtn');
        if (createShareBtn) {
            createShareBtn.style.display = 'none';
        }
    }
}

// 상담목적 변경 시 기타 입력 필드 표시/숨김
function handlePurposeChange() {
    const purposeSelect = document.getElementById('consultation-purpose');
    const purposeOtherRow = document.getElementById('consultation-purpose-other-row');
    
    if (purposeSelect && purposeOtherRow) {
        purposeSelect.addEventListener('change', function() {
            if (this.value === '기타') {
                purposeOtherRow.style.display = 'block';
            } else {
                purposeOtherRow.style.display = 'none';
                document.getElementById('consultation-purpose-other').value = '';
            }
        });
    }
}

// 폼 제출
async function handleConsultationSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const resultDiv = document.getElementById('consultationResult');
    const submitBtn = form.querySelector('button[type="submit"]');
    
    // 현재 사용자 정보 가져오기
    const currentUser = localStorage.getItem('username');
    if (!currentUser) {
        resultDiv.textContent = '로그인이 필요합니다.';
        resultDiv.style.color = 'red';
        return;
    }
    
    // 폼 데이터 수집
    const formData = new FormData(form);
    const data = {
        currentUser: currentUser,
        center: formData.get('center'),
        trainer_username: formData.get('trainer_username'),
        name: formData.get('name'),
        phone: formData.get('phone'),
        gender: formData.get('gender') || null,
        age_range: formData.get('age_range') || null,
        exercise_history: formData.get('exercise_history') || null,
        medical_history: formData.get('medical_history') || null,
        preferred_time: formData.get('preferred_time') || null,
        visit_source: formData.get('visit_source') || null,
        visit_reason: formData.get('visit_reason') || null,
        referrer: formData.get('referrer') || null,
        purpose: formData.get('purpose') || null,
        purpose_other: formData.get('purpose_other') || null,
        inbody: formData.get('inbody') || null,
        overhead_squat: formData.get('overhead_squat') || null,
        slr_test: formData.get('slr_test') || null,
        empty_can_test: formData.get('empty_can_test') || null,
        rom: formData.get('rom') || null,
        flexibility: formData.get('flexibility') || null,
        static_posture: formData.get('static_posture') || null,
        exercise_performed: formData.get('exercise_performed') || null,
        summary: formData.get('summary') || null,
        requirements: formData.get('requirements') || null
    };
    
    // 필수 필드 검증
    if (!data.name || !data.trainer_username || !data.center) {
        resultDiv.textContent = '이름, 센터, 담당 트레이너는 필수 항목입니다.';
        resultDiv.style.color = 'red';
        return;
    }
    
    // 제출 버튼 비활성화
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '저장 중...';
    }
    
    try {
        let response;
        
        // 수정 모드인지 확인
        if (currentEditRecordId) {
            // 수정 모드: PATCH 요청
            response = await fetch(`/api/consultation-records/${currentEditRecordId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        } else {
            // 추가 모드: POST 요청
            response = await fetch('/api/consultation-records', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        }
        
        if (response.ok) {
            resultDiv.textContent = currentEditRecordId ? '상담기록이 수정되었습니다.' : '상담기록이 저장되었습니다.';
            resultDiv.style.color = 'green';
            
            // 1.5초 후 모달 닫기 및 목록 새로고침
            setTimeout(() => {
                closeConsultationModal();
                // 목록 모달이 열려있으면 목록 새로고침
                const listModal = document.getElementById('consultationListModal');
                if (listModal && listModal.style.display === 'block') {
                    loadConsultationList();
                }
            }, 1500);
        } else {
            const errorData = await response.json();
            resultDiv.textContent = errorData.message || (currentEditRecordId ? '상담기록 수정에 실패했습니다.' : '상담기록 저장에 실패했습니다.');
            resultDiv.style.color = 'red';
        }
    } catch (error) {
        console.error('상담기록 저장 오류:', error);
        resultDiv.textContent = currentEditRecordId ? '상담기록 수정 중 오류가 발생했습니다.' : '상담기록 저장 중 오류가 발생했습니다.';
        resultDiv.style.color = 'red';
    } finally {
        // 제출 버튼 활성화
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '저장';
        }
    }
}

// 상담기록 목록 조회
async function loadConsultationList() {
    const tbody = document.getElementById('consultation-list-tbody');
    if (!tbody) return;
    
    const currentUser = localStorage.getItem('username');
    if (!currentUser) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--trainer-text-muted);">로그인이 필요합니다.</td></tr>';
        return;
    }
    
    // 필터 값 가져오기
    const center = document.getElementById('consultation-list-filter-center')?.value || '';
    const trainer = document.getElementById('consultation-list-filter-trainer')?.value || '';
    const month = document.getElementById('consultation-list-filter-month')?.value || '';
    
    // 로딩 표시
    tbody.innerHTML = '<tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--trainer-text-muted);">조회 중...</td></tr>';
    
    try {
        const params = new URLSearchParams({ currentUser });
        if (center) params.append('center', center);
        if (trainer) params.append('trainer', trainer);
        
        // 월 선택 시 해당 월의 시작일과 종료일 계산
        let startDate = '';
        let endDate = '';
        if (month) {
            const [year, monthNum] = month.split('-');
            // 해당 월의 첫 날
            startDate = `${year}-${monthNum}-01`;
            // 해당 월의 마지막 날 계산
            const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
            endDate = `${year}-${monthNum}-${String(lastDay).padStart(2, '0')}`;
            params.append('startDate', startDate);
            params.append('endDate', endDate);
        }
        
        const response = await fetch(`/api/consultation-records?${params.toString()}`);
        
        if (response.ok) {
            const data = await response.json();
            const records = data.records || [];
            
            if (records.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--trainer-text-muted);">상담기록이 없습니다.</td></tr>';
                return;
            }
            
            // 트레이너 이름 매핑
            const trainerNameMap = {};
            trainersList.forEach(t => {
                trainerNameMap[t.username] = t.name || t.username;
            });
            
            // 목록 렌더링
            tbody.innerHTML = records.map(record => {
                // 백엔드에서 한국 시간대 ISO 문자열로 반환되므로 직접 파싱
                const date = new Date(record.created_at);
                const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                const dateTimeStr = `${dateStr} ${timeStr}`;
                const trainerName = trainerNameMap[record.trainer_username] || record.trainer_username;
                
                return `
                    <tr class="consultation-list-row" data-id="${record.id}" style="border-bottom: 1px solid var(--trainer-border); cursor: pointer;">
                        <td style="padding: 8px;">${dateTimeStr}</td>
                        <td style="padding: 8px;">${record.center || '-'}</td>
                        <td style="padding: 8px;">${trainerName}</td>
                        <td style="padding: 8px;">${record.name || '-'}</td>
                        <td style="padding: 8px;">${record.phone || '-'}</td>
                        <td style="padding: 8px;">${record.purpose || '-'}</td>
                    </tr>
                `;
            }).join('');
            
            // 목록 행 클릭 이벤트 추가
            document.querySelectorAll('.consultation-list-row').forEach(row => {
                row.addEventListener('click', function() {
                    const recordId = this.getAttribute('data-id');
                    openConsultationEditModal(recordId);
                });
                
                // 호버 효과
                row.addEventListener('mouseenter', function() {
                    this.style.backgroundColor = 'var(--trainer-surface-hover, rgba(102, 126, 234, 0.05))';
                });
                row.addEventListener('mouseleave', function() {
                    this.style.backgroundColor = '';
                });
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: red;">상담기록 조회에 실패했습니다.</td></tr>';
        }
    } catch (error) {
        console.error('상담기록 목록 조회 오류:', error);
        tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: red;">상담기록 조회 중 오류가 발생했습니다.</td></tr>';
    }
}

// 상담기록 수정 모달 열기
let currentEditRecordId = null;

async function openConsultationEditModal(recordId) {
    currentEditRecordId = recordId;
    
    const modal = document.getElementById('consultationModal');
    const modalBg = document.getElementById('consultationModalBg');
    
    if (!modal || !modalBg) return;
    
    // 모달 열기
    modal.style.display = 'block';
    modalBg.style.display = 'block';
    
    // 센터 및 트레이너 목록 로드
    await loadCenters();
    await loadTrainers();
    
    // 기존 데이터 로드
    try {
        const currentUser = localStorage.getItem('username');
        if (!currentUser) {
            alert('로그인이 필요합니다.');
            closeConsultationModal();
            return;
        }
        
        const response = await fetch(`/api/consultation-records/${recordId}?currentUser=${encodeURIComponent(currentUser)}`);
        if (!response.ok) {
            if (response.status === 403) {
                alert('관리자 권한이 필요합니다.');
            } else {
                alert('상담기록을 불러오는데 실패했습니다.');
            }
            closeConsultationModal();
            return;
        }
        
        const record = await response.json();
        
        // 폼에 데이터 채우기
        document.getElementById('consultation-center').value = record.center || '';
        document.getElementById('consultation-trainer').value = record.trainer_username || '';
        document.getElementById('consultation-name').value = record.name || '';
        document.getElementById('consultation-phone').value = record.phone || '';
        document.getElementById('consultation-gender').value = record.gender || '';
        document.getElementById('consultation-age-range').value = record.age_range || '';
        document.getElementById('consultation-exercise-history').value = record.exercise_history || '';
        document.getElementById('consultation-medical-history').value = record.medical_history || '';
        document.getElementById('consultation-preferred-time').value = record.preferred_time || '';
        document.getElementById('consultation-visit-source').value = record.visit_source || '';
        document.getElementById('consultation-visit-reason').value = record.visit_reason || '';
        document.getElementById('consultation-referrer').value = record.referrer || '';
        document.getElementById('consultation-purpose').value = record.purpose || '';
        
        // 상담목적이 "기타"인 경우
        if (record.purpose === '기타') {
            document.getElementById('consultation-purpose-other-row').style.display = 'block';
            document.getElementById('consultation-purpose-other').value = record.purpose_other || '';
        } else {
            document.getElementById('consultation-purpose-other-row').style.display = 'none';
            document.getElementById('consultation-purpose-other').value = '';
        }
        
        document.getElementById('consultation-inbody').value = record.inbody || '';
        document.getElementById('consultation-overhead-squat').value = record.overhead_squat || '';
        document.getElementById('consultation-slr-test').value = record.slr_test || '';
        document.getElementById('consultation-empty-can-test').value = record.empty_can_test || '';
        document.getElementById('consultation-rom').value = record.rom || '';
        document.getElementById('consultation-flexibility').value = record.flexibility || '';
        document.getElementById('consultation-static-posture').value = record.static_posture || '';
        document.getElementById('consultation-exercise-performed').value = record.exercise_performed || '';
        document.getElementById('consultation-summary').value = record.summary || '';
        document.getElementById('consultation-requirements').value = record.requirements || '';
        
        // 동영상 섹션 표시 및 동영상 목록 로드
        const videoSection = document.getElementById('consultation-video-section');
        if (videoSection) {
            videoSection.style.display = 'block';
            loadConsultationVideos(recordId);
        }
        
        // 결과 메시지 초기화
        document.getElementById('consultationResult').textContent = '';
        
        // 모달 제목 변경 (선택사항)
        const modalTitle = modal.querySelector('h3');
        if (modalTitle) {
            modalTitle.textContent = '📝 상담기록 수정';
        }
        
        // 삭제 버튼 표시 및 상태 초기화
        const deleteBtn = document.getElementById('consultationDeleteBtn');
        if (deleteBtn) {
            deleteBtn.style.display = 'block';
            deleteBtn.disabled = false;
            deleteBtn.textContent = '삭제';
        }
        
        // 상담지 제작 버튼 표시
        const createShareBtn = document.getElementById('consultationCreateShareBtn');
        if (createShareBtn) {
            createShareBtn.style.display = 'block';
        }
        
        // 동영상 섹션은 이미 위에서 표시했으므로 여기서는 처리하지 않음
    } catch (error) {
        console.error('상담기록 로드 오류:', error);
        alert('상담기록을 불러오는 중 오류가 발생했습니다.');
        closeConsultationModal();
    }
}

// 상담지 제작 (공유 링크 생성)
async function handleCreateConsultationShare() {
    if (!currentEditRecordId) {
        alert('상담기록이 없습니다.');
        return;
    }
    
    const nameInput = document.getElementById('consultation-name');
    const phoneInput = document.getElementById('consultation-phone');
    
    if (!nameInput || !nameInput.value) {
        alert('회원 이름을 입력해주세요.');
        return;
    }
    
    const name = nameInput.value.trim();
    const phone = phoneInput ? phoneInput.value.trim() : '';
    
    // 만료일 선택 (기본 90일)
    const expiresInDays = prompt('링크 만료일을 입력하세요 (일 단위, 기본값: 90일):', '90');
    if (expiresInDays === null) {
        return; // 취소
    }
    
    const expiresIn = parseInt(expiresInDays) || 90;
    
    try {
        const currentUser = localStorage.getItem('username');
        if (!currentUser) {
            alert('로그인이 필요합니다.');
            return;
        }
        
        const createShareBtn = document.getElementById('consultationCreateShareBtn');
        if (createShareBtn) {
            createShareBtn.disabled = true;
            createShareBtn.textContent = '생성 중...';
        }
        
        const response = await fetch(`/api/consultation-records/${currentEditRecordId}/share`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                currentUser: currentUser,
                name: name,
                phone: phone || null,
                expiresInDays: expiresIn
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: '공유 링크 생성에 실패했습니다.' }));
            throw new Error(errorData.message || '공유 링크 생성에 실패했습니다.');
        }
        
        const result = await response.json();
        
        // 링크 표시 모달
        const linkText = result.shareUrl;
        const linkDisplay = `
상담지 링크가 생성되었습니다.

링크:
${linkText}

만료일: ${result.expiresAt ? new Date(result.expiresAt).toLocaleDateString('ko-KR') : '없음'}

링크를 복사하시겠습니까?`;
        
        if (confirm(linkDisplay)) {
            // 클립보드에 복사
            try {
                await navigator.clipboard.writeText(linkText);
                alert('링크가 클립보드에 복사되었습니다.');
            } catch (err) {
                // 클립보드 복사 실패 시 수동 선택 가능하도록
                const textarea = document.createElement('textarea');
                textarea.value = linkText;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                try {
                    document.execCommand('copy');
                    alert('링크가 클립보드에 복사되었습니다.');
                } catch (e) {
                    alert('링크 복사에 실패했습니다. 아래 링크를 수동으로 복사해주세요:\n\n' + linkText);
                }
                document.body.removeChild(textarea);
            }
        }
        
    } catch (error) {
        console.error('공유 링크 생성 오류:', error);
        alert('공유 링크 생성 중 오류가 발생했습니다: ' + error.message);
    } finally {
        const createShareBtn = document.getElementById('consultationCreateShareBtn');
        if (createShareBtn) {
            createShareBtn.disabled = false;
            createShareBtn.textContent = '상담지 제작';
        }
    }
}

// 상담기록 삭제
async function handleConsultationDelete() {
    if (!currentEditRecordId) {
        alert('삭제할 상담기록이 없습니다.');
        return;
    }
    
    if (!confirm('정말로 이 상담기록을 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        const currentUser = localStorage.getItem('username');
        if (!currentUser) {
            alert('로그인이 필요합니다.');
            return;
        }
        
        const deleteBtn = document.getElementById('consultationDeleteBtn');
        if (deleteBtn) {
            deleteBtn.disabled = true;
            deleteBtn.textContent = '삭제 중...';
        }
        
        const response = await fetch(`/api/consultation-records/${currentEditRecordId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ currentUser: currentUser })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: '상담기록 삭제에 실패했습니다.' }));
            throw new Error(errorData.message || '상담기록 삭제에 실패했습니다.');
        }
        
        const result = await response.json();
        
        // 성공 메시지 표시
        alert('상담기록이 삭제되었습니다.');
        
        // 모달 닫기
        closeConsultationModal();
        
        // 목록 새로고침 (목록 모달이 열려있는 경우)
        const listModal = document.getElementById('consultationListModal');
        if (listModal && listModal.style.display === 'block') {
            await loadConsultationList();
        }
        
    } catch (error) {
        console.error('상담기록 삭제 오류:', error);
        alert('상담기록 삭제 중 오류가 발생했습니다: ' + error.message);
        
        // 버튼 복원
        const deleteBtn = document.getElementById('consultationDeleteBtn');
        if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.textContent = '삭제';
        }
    }
}

// 초기화
document.addEventListener('DOMContentLoaded', function() {
    // 상담 버튼 클릭 이벤트 - 목록 모달 열기
    const consultationBtn = document.getElementById('consultationBtn');
    if (consultationBtn) {
        consultationBtn.addEventListener('click', openConsultationListModal);
    }
    
    // 목록 모달 닫기 버튼
    const listCloseX = document.getElementById('consultationListModalCloseX');
    const listModalBg = document.getElementById('consultationListModalBg');
    
    if (listCloseX) {
        listCloseX.addEventListener('click', closeConsultationListModal);
    }
    
    if (listModalBg) {
        listModalBg.addEventListener('click', closeConsultationListModal);
    }
    
    // 필터 자동 조회 (센터/트레이너/월 변경 시)
    const filterCenter = document.getElementById('consultation-list-filter-center');
    const filterTrainer = document.getElementById('consultation-list-filter-trainer');
    const filterMonth = document.getElementById('consultation-list-filter-month');
    
    if (filterCenter) {
        filterCenter.addEventListener('change', loadConsultationList);
    }
    if (filterTrainer) {
        filterTrainer.addEventListener('change', loadConsultationList);
    }
    if (filterMonth) {
        filterMonth.addEventListener('change', loadConsultationList);
    }
    
    // 추가 버튼 - 입력 모달 열기
    const addBtn = document.getElementById('consultation-list-add-btn');
    if (addBtn) {
        addBtn.addEventListener('click', function() {
            closeConsultationListModal();
            setTimeout(() => {
                openConsultationModal();
            }, 100);
        });
    }
    
    // 모달 닫기 버튼들
    const closeX = document.getElementById('consultationModalCloseX');
    const cancelBtn = document.getElementById('consultationCancelBtn');
    const modalBg = document.getElementById('consultationModalBg');
    
    if (closeX) {
        closeX.addEventListener('click', closeConsultationModal);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeConsultationModal);
    }
    
    if (modalBg) {
        modalBg.addEventListener('click', closeConsultationModal);
    }
    
    // 삭제 버튼 이벤트
    const deleteBtn = document.getElementById('consultationDeleteBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', handleConsultationDelete);
    }
    
    // 상담지 제작 버튼 이벤트
    const createShareBtn = document.getElementById('consultationCreateShareBtn');
    if (createShareBtn) {
        createShareBtn.addEventListener('click', handleCreateConsultationShare);
    }
    
    // 상담목적 변경 이벤트
    handlePurposeChange();
    
    // 폼 제출 이벤트
    const form = document.getElementById('consultationForm');
    if (form) {
        form.addEventListener('submit', handleConsultationSubmit);
    }
    
    // 동영상 선택 버튼 이벤트
    const videoSelectBtn = document.getElementById('consultation-video-select-btn');
    const videoUploadInput = document.getElementById('consultation-video-upload');
    if (videoSelectBtn && videoUploadInput) {
        videoSelectBtn.addEventListener('click', () => {
            videoUploadInput.click();
        });
        videoUploadInput.addEventListener('change', handleVideoUpload);
    }
});

// 동영상 업로드 처리
async function handleVideoUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    if (!currentEditRecordId) {
        alert('상담기록을 먼저 저장해주세요.');
        return;
    }
    
    const currentUser = localStorage.getItem('username');
    if (!currentUser) {
        alert('로그인이 필요합니다.');
        return;
    }
    
    for (const file of files) {
        // 파일 크기 확인 (100MB)
        const maxSize = 100 * 1024 * 1024;
        if (file.size > maxSize) {
            alert(`${file.name}: 파일 크기가 너무 큽니다. (최대 100MB)`);
            continue;
        }
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('currentUser', currentUser);
            
            const response = await fetch(`/api/consultation-records/${currentEditRecordId}/videos`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: '동영상 업로드에 실패했습니다.' }));
                throw new Error(errorData.message || '동영상 업로드에 실패했습니다.');
            }
            
            // 동영상 목록 새로고침
            await loadConsultationVideos(currentEditRecordId);
        } catch (error) {
            console.error('동영상 업로드 오류:', error);
            alert(`${file.name} 업로드 실패: ${error.message}`);
        }
    }
    
    // input 초기화
    e.target.value = '';
}

// 동영상 목록 로드
async function loadConsultationVideos(consultationId) {
    const videoList = document.getElementById('consultation-video-list');
    if (!videoList) return;
    
    try {
        const currentUser = localStorage.getItem('username');
        if (!currentUser) return;
        
        const response = await fetch(`/api/consultation-records/${consultationId}?currentUser=${encodeURIComponent(currentUser)}`);
        if (!response.ok) return;
        
        const record = await response.json();
        const videos = record.video_urls || [];
        
        if (videos.length === 0) {
            videoList.innerHTML = '<div style="color: #999; font-size: 12px;">업로드된 동영상이 없습니다.</div>';
            return;
        }
        
        videoList.innerHTML = videos.map(video => {
            const fileSizeMB = (video.file_size / (1024 * 1024)).toFixed(2);
            const uploadDate = new Date(video.uploaded_at).toLocaleDateString('ko-KR');
            return `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; border: 1px solid #e0e0e0; border-radius: 4px; margin-bottom: 8px; background: #f9f9f9;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 13px;">📹 ${escapeHtml(video.filename)}</div>
                        <div style="font-size: 11px; color: #666; margin-top: 4px;">
                            ${fileSizeMB}MB · ${uploadDate}
                        </div>
                    </div>
                    <button type="button" class="tmc-btn-danger" onclick="deleteConsultationVideo('${consultationId}', '${video.id}')" style="padding: 4px 12px; font-size: 11px;">삭제</button>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('동영상 목록 로드 오류:', error);
    }
}

// 동영상 삭제
async function deleteConsultationVideo(consultationId, videoId) {
    if (!confirm('이 동영상을 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        const currentUser = localStorage.getItem('username');
        if (!currentUser) {
            alert('로그인이 필요합니다.');
            return;
        }
        
        const response = await fetch(`/api/consultation-records/${consultationId}/videos/${videoId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ currentUser: currentUser })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: '동영상 삭제에 실패했습니다.' }));
            throw new Error(errorData.message || '동영상 삭제에 실패했습니다.');
        }
        
        // 동영상 목록 새로고침
        await loadConsultationVideos(consultationId);
    } catch (error) {
        console.error('동영상 삭제 오류:', error);
        alert('동영상 삭제 중 오류가 발생했습니다: ' + error.message);
    }
}

// HTML 이스케이프
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
