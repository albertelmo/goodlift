// 비밀 관리자 기능 모듈
class SecretManager {
    constructor() {
        this.adminPassword = 'su0801!'; // 관리자 비밀번호
        this.attemptCount = 0;
        this.maxAttempts = 3;
        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        // 비밀 버튼 클릭 이벤트
        const secretBtn = document.getElementById('secretBtn');
        if (secretBtn) {
            secretBtn.addEventListener('click', () => this.showPasswordModal());
        }

        // 비밀번호 입력 폼 이벤트
        const secretPasswordForm = document.getElementById('secretPasswordForm');
        if (secretPasswordForm) {
            secretPasswordForm.addEventListener('submit', (e) => this.handlePasswordSubmit(e));
        }

        // 모달 닫기 버튼들
        const closeSecretPasswordBtn = document.getElementById('closeSecretPasswordBtn');
        if (closeSecretPasswordBtn) {
            closeSecretPasswordBtn.addEventListener('click', () => this.closePasswordModal());
        }

        const closeMemberDeleteBtn = document.getElementById('closeMemberDeleteBtn');
        if (closeMemberDeleteBtn) {
            closeMemberDeleteBtn.addEventListener('click', () => this.closeMemberDeleteModal());
        }

        const closeMonthlyStatsResetBtn = document.getElementById('closeMonthlyStatsResetBtn');
        if (closeMonthlyStatsResetBtn) {
            closeMonthlyStatsResetBtn.addEventListener('click', () => this.closeMonthlyStatsResetModal());
        }

        // 세션 삭제 모달 닫기 버튼
        const closeSessionDeleteBtn = document.getElementById('closeSessionDeleteBtn');
        if (closeSessionDeleteBtn) {
            closeSessionDeleteBtn.addEventListener('click', () => this.closeSessionDeleteModal());
        }

        // 회원 검색 버튼
        const searchMemberBtn = document.getElementById('searchMemberBtn');
        if (searchMemberBtn) {
            searchMemberBtn.addEventListener('click', () => this.searchMember());
        }

        // 세션 검색 버튼
        const searchSessionBtn = document.getElementById('searchSessionBtn');
        if (searchSessionBtn) {
            searchSessionBtn.addEventListener('click', () => this.searchSession());
        }

        // 회원 삭제 확인 버튼
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', () => this.confirmDeleteMember());
        }

        // 세션 삭제 확인 버튼
        const confirmSessionDeleteBtn = document.getElementById('confirmSessionDeleteBtn');
        if (confirmSessionDeleteBtn) {
            confirmSessionDeleteBtn.addEventListener('click', () => this.confirmDeleteSession());
        }

        // 월별 통계 초기화 버튼
        const resetMonthlyStatsBtn = document.getElementById('resetMonthlyStatsBtn');
        if (resetMonthlyStatsBtn) {
            resetMonthlyStatsBtn.addEventListener('click', () => this.resetMonthlyStats());
        }

        // 취소 버튼
        const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
        if (cancelDeleteBtn) {
            cancelDeleteBtn.addEventListener('click', () => this.closeMemberDeleteModal());
        }

        // 세션 삭제 취소 버튼
        const cancelSessionDeleteBtn = document.getElementById('cancelSessionDeleteBtn');
        if (cancelSessionDeleteBtn) {
            cancelSessionDeleteBtn.addEventListener('click', () => this.closeSessionDeleteModal());
        }

        // 모달 배경 클릭 시 닫기
        const secretPasswordModalBg = document.getElementById('secretPasswordModalBg');
        if (secretPasswordModalBg) {
            secretPasswordModalBg.addEventListener('click', () => this.closePasswordModal());
        }

        const memberDeleteModalBg = document.getElementById('memberDeleteModalBg');
        if (memberDeleteModalBg) {
            memberDeleteModalBg.addEventListener('click', () => this.closeMemberDeleteModal());
        }

        const monthlyStatsResetModalBg = document.getElementById('monthlyStatsResetModalBg');
        if (monthlyStatsResetModalBg) {
            monthlyStatsResetModalBg.addEventListener('click', () => this.closeMonthlyStatsResetModal());
        }

        const sessionDeleteModalBg = document.getElementById('sessionDeleteModalBg');
        if (sessionDeleteModalBg) {
            sessionDeleteModalBg.addEventListener('click', () => this.closeSessionDeleteModal());
        }

        // Enter 키 이벤트
        const memberNameInput = document.getElementById('memberNameInput');
        if (memberNameInput) {
            memberNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.searchMember();
                }
            });
        }

        const yearMonthInput = document.getElementById('yearMonthInput');
        if (yearMonthInput) {
            yearMonthInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.resetMonthlyStats();
                }
            });
        }

        // 세션 삭제 모달의 Enter 키 이벤트
        const sessionMemberNameInput = document.getElementById('sessionMemberNameInput');
        if (sessionMemberNameInput) {
            sessionMemberNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.searchSession();
                }
            });
        }
    }

    // 비밀번호 입력 모달 표시
    showPasswordModal() {
        const modalBg = document.getElementById('secretPasswordModalBg');
        const modal = document.getElementById('secretPasswordModal');
        const passwordInput = document.getElementById('secretPassword');
        const resultDiv = document.getElementById('secretPasswordResult');

        if (modalBg && modal && passwordInput && resultDiv) {
            modalBg.style.display = 'block';
            modal.style.display = 'block';
            passwordInput.value = '';
            resultDiv.textContent = '';
            passwordInput.focus();
        }
    }

    // 비밀번호 입력 모달 닫기
    closePasswordModal() {
        const modalBg = document.getElementById('secretPasswordModalBg');
        const modal = document.getElementById('secretPasswordModal');
        const resultDiv = document.getElementById('secretPasswordResult');

        if (modalBg && modal && resultDiv) {
            modalBg.style.display = 'none';
            modal.style.display = 'none';
            resultDiv.textContent = '';
            this.attemptCount = 0;
        }
    }

    // 비밀번호 제출 처리
    handlePasswordSubmit(e) {
        e.preventDefault();
        const passwordInput = document.getElementById('secretPassword');
        const resultDiv = document.getElementById('secretPasswordResult');

        if (!passwordInput || !resultDiv) return;

        const password = passwordInput.value.trim();

        if (password === this.adminPassword) {
            this.closePasswordModal();
            this.showAdminMenuModal();
        } else {
            this.attemptCount++;
            const remainingAttempts = this.maxAttempts - this.attemptCount;
            
            if (remainingAttempts > 0) {
                resultDiv.textContent = `비밀번호가 틀렸습니다. 남은 시도 횟수: ${remainingAttempts}`;
                resultDiv.style.color = '#d32f2f';
            } else {
                resultDiv.textContent = '시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.';
                resultDiv.style.color = '#d32f2f';
                setTimeout(() => this.closePasswordModal(), 2000);
            }
            
            passwordInput.value = '';
            passwordInput.focus();
        }
    }

    // 관리자 메뉴 모달 표시
    showAdminMenuModal() {
        // 간단한 메뉴 표시
        const menuItems = [
            { id: 'memberDelete', title: '회원 삭제', description: '회원 정보 및 세션 삭제' },
            { id: 'sessionDelete', title: '세션 삭제', description: '특정 회원의 특정 세션 삭제' },
            { id: 'monthlyStatsReset', title: '월별 통계 초기화', description: '특정 월의 세션 통계를 0으로 초기화' }
        ];

        let menuHTML = '<div style="text-align:center;margin-bottom:20px;"><h3 style="color:#d32f2f;margin-bottom:16px;">관리자 기능</h3>';
        menuHTML += '<div style="display:flex;flex-direction:column;gap:12px;">';
        
        menuItems.forEach(item => {
            menuHTML += `
                <button type="button" id="${item.id}Btn" style="background:#1976d2;color:#fff;border:none;padding:12px 16px;border-radius:8px;cursor:pointer;text-align:left;transition:background 0.2s;" onmouseover="this.style.background='#1565c0'" onmouseout="this.style.background='#1976d2'">
                    <div style="font-weight:600;margin-bottom:4px;">${item.title}</div>
                    <div style="font-size:0.85rem;opacity:0.9;">${item.description}</div>
                </button>
            `;
        });
        
        menuHTML += '</div></div>';

        // 모달 생성 및 표시
        const modalBg = document.createElement('div');
        modalBg.id = 'adminMenuModalBg';
        modalBg.style.cssText = 'position:fixed;z-index:1000;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);';
        
        const modal = document.createElement('div');
        modal.id = 'adminMenuModal';
        modal.style.cssText = 'position:fixed;z-index:1001;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:14px;box-shadow:0 8px 32px #1976d240;min-width:400px;max-width:90vw;';
        modal.innerHTML = menuHTML;

        document.body.appendChild(modalBg);
        document.body.appendChild(modal);

        // 이벤트 리스너 추가
        modalBg.addEventListener('click', () => this.closeAdminMenuModal());
        
        const memberDeleteBtn = document.getElementById('memberDeleteBtn');
        if (memberDeleteBtn) {
            memberDeleteBtn.addEventListener('click', () => {
                this.closeAdminMenuModal();
                this.showMemberDeleteModal();
            });
        }

        const sessionDeleteBtn = document.getElementById('sessionDeleteBtn');
        if (sessionDeleteBtn) {
            sessionDeleteBtn.addEventListener('click', () => {
                this.closeAdminMenuModal();
                this.showSessionDeleteModal();
            });
        }

        const monthlyStatsResetBtn = document.getElementById('monthlyStatsResetBtn');
        if (monthlyStatsResetBtn) {
            monthlyStatsResetBtn.addEventListener('click', () => {
                this.closeAdminMenuModal();
                this.showMonthlyStatsResetModal();
            });
        }
    }

    // 관리자 메뉴 모달 닫기
    closeAdminMenuModal() {
        const modalBg = document.getElementById('adminMenuModalBg');
        const modal = document.getElementById('adminMenuModal');
        
        if (modalBg && modal) {
            document.body.removeChild(modalBg);
            document.body.removeChild(modal);
        }
    }

    // 회원 삭제 모달 표시
    showMemberDeleteModal() {
        const modalBg = document.getElementById('memberDeleteModalBg');
        const modal = document.getElementById('memberDeleteModal');
        const memberNameInput = document.getElementById('memberNameInput');
        const memberSearchSection = document.getElementById('memberSearchSection');
        const memberInfoSection = document.getElementById('memberInfoSection');

        if (modalBg && modal && memberNameInput && memberSearchSection && memberInfoSection) {
            modalBg.style.display = 'block';
            modal.style.display = 'block';
            memberNameInput.value = '';
            memberSearchSection.style.display = 'block';
            memberInfoSection.style.display = 'none';
            memberNameInput.focus();
        }
    }

    // 회원 삭제 모달 닫기
    closeMemberDeleteModal() {
        const modalBg = document.getElementById('memberDeleteModalBg');
        const modal = document.getElementById('memberDeleteModal');
        const memberNameInput = document.getElementById('memberNameInput');
        const memberSearchSection = document.getElementById('memberSearchSection');
        const memberInfoSection = document.getElementById('memberInfoSection');

        if (modalBg && modal && memberNameInput && memberSearchSection && memberInfoSection) {
            modalBg.style.display = 'none';
            modal.style.display = 'none';
            memberNameInput.value = '';
            memberSearchSection.style.display = 'block';
            memberInfoSection.style.display = 'none';
        }
    }

    // 회원 검색
    async searchMember() {
        const memberNameInput = document.getElementById('memberNameInput');
        const memberInfoContent = document.getElementById('memberInfoContent');
        const sessionInfoContent = document.getElementById('sessionInfoContent');
        const memberSearchSection = document.getElementById('memberSearchSection');
        const memberInfoSection = document.getElementById('memberInfoSection');

        if (!memberNameInput || !memberInfoContent || !sessionInfoContent || !memberSearchSection || !memberInfoSection) return;

        const memberName = memberNameInput.value.trim();
        if (!memberName) {
            alert('회원 이름을 입력해주세요.');
            return;
        }

        try {
            // 회원 정보 가져오기
            const membersResponse = await fetch('/api/members');
            const members = await membersResponse.json();
            
            // 세션 정보 가져오기
            const sessionsResponse = await fetch('/api/sessions');
            const sessions = await sessionsResponse.json();

            // 회원 검색 (정확한 일치 우선, 부분 일치 후순위)
            let foundMember = members.find(member => member.name === memberName);
            
            // 정확한 일치가 없으면 부분 일치 검색
            if (!foundMember) {
                const partialMatches = members.filter(member => 
                    member.name.includes(memberName) || memberName.includes(member.name)
                );
                
                if (partialMatches.length === 0) {
                    alert('해당 이름의 회원을 찾을 수 없습니다.');
                    return;
                } else if (partialMatches.length === 1) {
                    foundMember = partialMatches[0];
                } else {
                    // 여러 개의 부분 일치가 있을 경우 사용자에게 선택하도록 함
                    const memberNames = partialMatches.map(m => m.name).join(', ');
                    alert(`여러 회원이 검색되었습니다: ${memberNames}\n\n정확한 회원 이름을 입력해주세요.`);
                    return;
                }
            }

            // 해당 회원의 세션들 필터링
            const memberSessions = sessions.filter(session => session.member === foundMember.name);
            
            // 세션 통계 계산
            const totalSessions = memberSessions.length;
            const scheduledSessions = memberSessions.filter(s => s.status === '예정').length;
            const completedSessions = memberSessions.filter(s => s.status === '완료').length;
            const absentSessions = memberSessions.filter(s => s.status === '결석').length;
            const cancelledSessions = memberSessions.filter(s => s.status === '취소').length;

            // 회원 정보 표시
            memberInfoContent.innerHTML = `
                <div><strong>이름:</strong> ${foundMember.name}</div>
                <div><strong>성별:</strong> ${foundMember.gender === 'male' ? '남성' : '여성'}</div>
                <div><strong>연락처:</strong> ${foundMember.phone}</div>
                <div><strong>담당 트레이너:</strong> ${foundMember.trainer}</div>
                <div><strong>센터:</strong> ${foundMember.center}</div>
                <div><strong>등록일:</strong> ${foundMember.regdate}</div>
                <div><strong>상태:</strong> ${foundMember.status}</div>
                <div><strong>총 세션:</strong> ${foundMember.sessions}개</div>
                <div><strong>잔여 세션:</strong> ${foundMember.remainSessions}개</div>
            `;

            // 세션 정보 표시
            const memberSessionInfoContent = document.getElementById('memberSessionInfoContent');
            if (memberSessionInfoContent) {
                memberSessionInfoContent.innerHTML = `
                    <div><strong>총 세션:</strong> ${totalSessions}개</div>
                    <div><strong>예정 세션:</strong> ${scheduledSessions}개</div>
                    <div><strong>완료 세션:</strong> ${completedSessions}개</div>
                    <div><strong>결석 세션:</strong> ${absentSessions}개</div>
                    <div><strong>취소 세션:</strong> ${cancelledSessions}개</div>
                `;
            }

            // 검색 섹션 숨기고 정보 섹션 표시
            memberSearchSection.style.display = 'none';
            memberInfoSection.style.display = 'block';

            // 삭제 확인 버튼에 회원 정보 저장
            const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
            if (confirmDeleteBtn) {
                confirmDeleteBtn.dataset.memberName = foundMember.name;
            }

        } catch (error) {
            console.error('회원 검색 중 오류:', error);
            alert('회원 검색 중 오류가 발생했습니다.');
        }
    }

    // 회원 삭제 확인
    async confirmDeleteMember() {
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        if (!confirmDeleteBtn) return;

        const memberName = confirmDeleteBtn.dataset.memberName;
        if (!memberName) {
            alert('삭제할 회원 정보를 찾을 수 없습니다.');
            return;
        }

        const confirmed = confirm(`정말로 "${memberName}" 회원을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 해당 회원의 모든 세션 정보도 함께 삭제됩니다.`);
        
        if (confirmed) {
            await this.deleteMember(memberName);
        }
    }

    // 회원 삭제 실행
    async deleteMember(memberName) {
        try {
            // 회원 삭제
            const deleteResponse = await fetch(`/api/members/${encodeURIComponent(memberName)}`, {
                method: 'DELETE'
            });

            if (deleteResponse.ok) {
                alert(`"${memberName}" 회원이 성공적으로 삭제되었습니다.`);
                this.closeMemberDeleteModal();
                
                // 페이지 새로고침 (데이터 업데이트를 위해)
                location.reload();
            } else {
                const errorData = await deleteResponse.json();
                alert(`회원 삭제 실패: ${errorData.message || '알 수 없는 오류'}`);
            }
        } catch (error) {
            console.error('회원 삭제 중 오류:', error);
            alert('회원 삭제 중 오류가 발생했습니다.');
        }
    }

    // 세션 삭제 모달 표시
    showSessionDeleteModal() {
        const modalBg = document.getElementById('sessionDeleteModalBg');
        const modal = document.getElementById('sessionDeleteModal');
        const sessionMemberNameInput = document.getElementById('sessionMemberNameInput');
        const sessionDateInput = document.getElementById('sessionDateInput');
        const sessionTimeInput = document.getElementById('sessionTimeInput');
        const sessionSearchSection = document.getElementById('sessionSearchSection');
        const sessionInfoSection = document.getElementById('sessionInfoSection');

        if (modalBg && modal && sessionMemberNameInput && sessionDateInput && sessionTimeInput && sessionSearchSection && sessionInfoSection) {
            modalBg.style.display = 'block';
            modal.style.display = 'block';
            sessionMemberNameInput.value = '';
            sessionDateInput.value = '';
            sessionTimeInput.value = '';
            sessionSearchSection.style.display = 'block';
            sessionInfoSection.style.display = 'none';
            sessionMemberNameInput.focus();
        }
    }

    // 세션 삭제 모달 닫기
    closeSessionDeleteModal() {
        const modalBg = document.getElementById('sessionDeleteModalBg');
        const modal = document.getElementById('sessionDeleteModal');
        const sessionMemberNameInput = document.getElementById('sessionMemberNameInput');
        const sessionDateInput = document.getElementById('sessionDateInput');
        const sessionTimeInput = document.getElementById('sessionTimeInput');
        const sessionSearchSection = document.getElementById('sessionSearchSection');
        const sessionInfoSection = document.getElementById('sessionInfoSection');

        if (modalBg && modal && sessionMemberNameInput && sessionDateInput && sessionTimeInput && sessionSearchSection && sessionInfoSection) {
            modalBg.style.display = 'none';
            modal.style.display = 'none';
            sessionMemberNameInput.value = '';
            sessionDateInput.value = '';
            sessionTimeInput.value = '';
            sessionSearchSection.style.display = 'block';
            sessionInfoSection.style.display = 'none';
        }
    }

    // 세션 검색
    async searchSession() {
        const sessionMemberNameInput = document.getElementById('sessionMemberNameInput');
        const sessionDateInput = document.getElementById('sessionDateInput');
        const sessionTimeInput = document.getElementById('sessionTimeInput');
        const sessionInfoContent = document.getElementById('sessionInfoContent');
        const sessionSearchSection = document.getElementById('sessionSearchSection');
        const sessionInfoSection = document.getElementById('sessionInfoSection');

        if (!sessionMemberNameInput || !sessionDateInput || !sessionTimeInput || !sessionInfoContent || !sessionSearchSection || !sessionInfoSection) return;

        const memberName = sessionMemberNameInput.value.trim();
        const date = sessionDateInput.value;
        const time = sessionTimeInput.value;

        if (!memberName || !date || !time) {
            alert('회원 이름, 날짜, 시간을 모두 입력해주세요.');
            return;
        }

        try {
            // 세션 정보 가져오기
            const sessionsResponse = await fetch('/api/sessions');
            const sessions = await sessionsResponse.json();

            // 해당 세션 찾기
            const foundSession = sessions.find(session => 
                session.member === memberName && 
                session.date === date && 
                session.time === time
            );

            if (!foundSession) {
                alert('해당 조건의 세션을 찾을 수 없습니다.\n\n회원 이름, 날짜, 시간을 다시 확인해주세요.');
                return;
            }

            // 세션 정보 표시
            // 세션 정보 표시
            sessionInfoContent.innerHTML = `
                <div><strong>회원:</strong> ${foundSession.member || 'N/A'}</div>
                <div><strong>트레이너:</strong> ${foundSession.trainer || 'N/A'}</div>
                <div><strong>날짜:</strong> ${foundSession.date || 'N/A'}</div>
                <div><strong>시간:</strong> ${foundSession.time || 'N/A'}</div>
                <div><strong>상태:</strong> ${foundSession.status || 'N/A'}</div>
            `;

            // 검색 섹션 숨기고 정보 섹션 표시
            sessionSearchSection.style.display = 'none';
            sessionInfoSection.style.display = 'block';

            // 삭제 확인 버튼에 세션 정보 저장
            const confirmSessionDeleteBtn = document.getElementById('confirmSessionDeleteBtn');
            if (confirmSessionDeleteBtn) {
                confirmSessionDeleteBtn.dataset.sessionId = foundSession.id;
                confirmSessionDeleteBtn.dataset.memberName = foundSession.member;
                confirmSessionDeleteBtn.dataset.date = foundSession.date;
                confirmSessionDeleteBtn.dataset.time = foundSession.time;
            }

        } catch (error) {
            console.error('세션 검색 중 오류:', error);
            alert('세션 검색 중 오류가 발생했습니다.');
        }
    }

    // 세션 삭제 확인
    async confirmDeleteSession() {
        const confirmSessionDeleteBtn = document.getElementById('confirmSessionDeleteBtn');
        if (!confirmSessionDeleteBtn) return;

        const sessionId = confirmSessionDeleteBtn.dataset.sessionId;
        const memberName = confirmSessionDeleteBtn.dataset.memberName;
        const date = confirmSessionDeleteBtn.dataset.date;
        const time = confirmSessionDeleteBtn.dataset.time;

        if (!sessionId || !memberName || !date || !time) {
            alert('삭제할 세션 정보를 찾을 수 없습니다.');
            return;
        }

        const confirmed = confirm(`정말로 "${memberName}" 회원의 ${date} ${time} 세션을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`);
        
        if (confirmed) {
            await this.deleteSession(sessionId);
        }
    }

    // 세션 삭제 실행
    async deleteSession(sessionId) {
        try {
            // 세션 삭제
            const deleteResponse = await fetch(`/api/sessions/${sessionId}`, {
                method: 'DELETE'
            });

            if (deleteResponse.ok) {
                alert('세션이 성공적으로 삭제되었습니다.');
                this.closeSessionDeleteModal();
                
                // 페이지 새로고침 (데이터 업데이트를 위해)
                location.reload();
            } else {
                const errorData = await deleteResponse.json();
                alert(`세션 삭제 실패: ${errorData.message || '알 수 없는 오류'}`);
            }
        } catch (error) {
            console.error('세션 삭제 중 오류:', error);
            alert('세션 삭제 중 오류가 발생했습니다.');
        }
    }

    // 월별 통계 초기화 모달 표시
    showMonthlyStatsResetModal() {
        const modalBg = document.getElementById('monthlyStatsResetModalBg');
        const modal = document.getElementById('monthlyStatsResetModal');
        const yearMonthInput = document.getElementById('yearMonthInput');

        if (modalBg && modal && yearMonthInput) {
            modalBg.style.display = 'block';
            modal.style.display = 'block';
            yearMonthInput.value = '';
            yearMonthInput.focus();
        }
    }

    // 월별 통계 초기화 모달 닫기
    closeMonthlyStatsResetModal() {
        const modalBg = document.getElementById('monthlyStatsResetModalBg');
        const modal = document.getElementById('monthlyStatsResetModal');
        const yearMonthInput = document.getElementById('yearMonthInput');

        if (modalBg && modal && yearMonthInput) {
            modalBg.style.display = 'none';
            modal.style.display = 'none';
            yearMonthInput.value = '';
        }
    }

    // 월별 통계 초기화 실행
    async resetMonthlyStats() {
        const yearMonthInput = document.getElementById('yearMonthInput');
        if (!yearMonthInput) return;

        const yearMonth = yearMonthInput.value.trim();
        if (!yearMonth) {
            alert('연도-월을 입력해주세요. (예: 2025-01)');
            return;
        }

        // YYYY-MM 형식 검증
        const yearMonthRegex = /^\d{4}-\d{2}$/;
        if (!yearMonthRegex.test(yearMonth)) {
            alert('올바른 연도-월 형식을 입력해주세요. (예: 2025-01)');
            return;
        }

        const confirmed = confirm(`정말로 ${yearMonth} 월의 세션 통계를 0으로 초기화하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`);
        
        if (confirmed) {
            try {
                const response = await fetch('/api/monthly-stats/reset', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ yearMonth })
                });

                if (response.ok) {
                    const result = await response.json();
                    alert(`${yearMonth} 월별 통계가 성공적으로 초기화되었습니다.`);
                    this.closeMonthlyStatsResetModal();
                    
                    // 페이지 새로고침 (통계 업데이트를 위해)
                    location.reload();
                } else {
                    const errorData = await response.json();
                    alert(`월별 통계 초기화 실패: ${errorData.message || '알 수 없는 오류'}`);
                }
            } catch (error) {
                console.error('월별 통계 초기화 중 오류:', error);
                alert('월별 통계 초기화 중 오류가 발생했습니다.');
            }
        }
    }
}

// 모듈 초기화
document.addEventListener('DOMContentLoaded', () => {
    new SecretManager();
});

export default SecretManager; 