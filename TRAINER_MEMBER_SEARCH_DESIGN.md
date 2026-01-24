# 트레이너 회원 검색 및 연결 기능 설계

## 1. 개요

트레이너가 "나의 회원"이 아닌 모든 유저앱 회원을 검색하여 연결할 수 있는 기능을 추가합니다.

## 2. 현재 상태 분석

### 2.1 기존 기능
- ✅ `showConnectUserModal()` 함수 존재
- ✅ `connectAppUser()` 함수 존재
- ✅ 회원 연결 시 `localStorage`에 저장
- ✅ 연결된 회원의 기록 수정 가능

### 2.2 제한사항
- ❌ 현재는 PT 회원과 연결된 유저앱 회원만 검색 가능 (`member_name`이 있는 회원만)
- ❌ UI에 "회원 검색" 버튼이 없음
- ❌ "나의 회원"이 아닌 회원도 검색할 수 없음

## 3. 요구사항

### 3.1 기능 요구사항
1. 트레이너 홈 화면의 "나의 회원" 섹션에 "회원 검색" 버튼 추가
2. 모든 유저앱 회원 검색 가능 (PT 회원 연결 여부와 관계없이)
3. 검색 결과에 다음 정보 표시:
   - 이름, 전화번호, 아이디
   - PT 회원 여부 (member_name 존재 여부)
   - 내 회원 여부 (현재 트레이너의 회원인지)
   - 현재 연결 상태
4. 검색 결과에서 회원 선택 시 연결 가능
5. 연결 후 운동/식단 탭에서 해당 회원의 기록 수정 가능

### 3.2 UI/UX 요구사항
- 검색 버튼은 "나의 회원" 섹션 헤더에 배치
- 검색 모달은 기존 `showConnectUserModal` 재사용
- 검색 결과는 스크롤 가능한 리스트로 표시
- 검색어는 이름, 전화번호, 아이디로 검색 가능
- 실시간 검색 (디바운싱 적용)

## 4. 상세 설계

### 4.1 UI 변경사항

#### 4.1.1 "나의 회원" 섹션 헤더 수정
```javascript
// 위치: dashboard.js의 render() 함수 내
<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
    <h2 class="app-section-title" style="margin: 0;">
        👥 ${trainerMembers && trainerMembers.length > 0 ? `나의 회원 (${trainerMembers.length}명)` : '나의 회원'}
    </h2>
    <div style="display: flex; align-items: center; gap: 8px;">
        ${(() => {
            const connectedAppUserId = localStorage.getItem('connectedMemberAppUserId');
            if (connectedAppUserId && trainerMembers) {
                const connectedMember = trainerMembers.find(m => m.app_user_id === connectedAppUserId);
                if (connectedMember && connectedMember.name) {
                    return `<span style="font-size: 0.875rem; color: var(--app-primary); font-weight: 500;">${escapeHtml(connectedMember.name)} 회원과 연결중</span>`;
                }
            }
            return '';
        })()}
        <button id="search-member-btn" class="app-btn-secondary" style="padding: 6px 12px; font-size: 0.875rem; white-space: nowrap;">
            🔍 회원 검색
        </button>
    </div>
</div>
```

### 4.2 검색 로직 수정

#### 4.2.1 `showConnectUserModal()` 함수 수정
**현재 코드 (line 1347-1350):**
```javascript
// PT 회원과 연결된 유저앱 회원만 필터링 (member_name이 있는 회원)
const appUsersWithMemberName = appUsers.filter(user => 
    user.member_name && user.member_name.trim() !== ''
);
```

**수정 후:**
```javascript
// 모든 유저앱 회원 검색 가능 (PT 회원 연결 여부와 관계없이)
// 필터링 제거 - 모든 회원 검색 가능
```

#### 4.2.2 검색 결과 표시 개선
**추가 정보:**
1. **PT 회원 여부**: `member_name`이 있으면 "(PT 회원)" 표시
2. **내 회원 여부**: 현재 트레이너의 회원인지 확인하여 "(내 회원)" 표시
3. **연결 상태**: 현재 연결된 회원이면 "(연결됨)" 표시

**검색 결과 렌더링 수정:**
```javascript
const resultsHTML = filteredUsers.map(user => {
    const isConnected = connectedAppUserId === user.id;
    const isMyMember = trainerMembers && trainerMembers.some(m => m.app_user_id === user.id);
    const isPTMember = user.member_name && user.member_name.trim() !== '';
    
    return `
        <div 
            class="app-member-item ${isConnected ? 'app-member-item-connected' : ''}" 
            data-app-user-id="${user.id}"
            data-app-user-name="${escapeHtml(user.name)}"
            style="cursor: pointer; padding: 12px 16px; border-bottom: 1px solid var(--app-border);"
        >
            <div class="app-member-info">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <p class="app-member-name">${escapeHtml(user.name)}</p>
                    ${isConnected ? '<span style="color:#4caf50;font-size:0.75rem;font-weight:600;">(연결됨)</span>' : ''}
                    ${isMyMember ? '<span style="color:#1976d2;font-size:0.75rem;font-weight:600;">(내 회원)</span>' : ''}
                    ${isPTMember ? '<span style="color:var(--app-text-muted);font-size:0.75rem;">(PT 회원)</span>' : ''}
                </div>
                <p class="app-member-details">
                    ${escapeHtml(user.phone || '-')} | 아이디: ${escapeHtml(user.username)}
                    ${isPTMember ? ` | PT: ${escapeHtml(user.member_name)}` : ''}
                </p>
            </div>
        </div>
    `;
}).join('');
```

### 4.3 이벤트 리스너 추가

#### 4.3.1 검색 버튼 클릭 이벤트
```javascript
// render() 함수 내에서 setupSearchMemberButton() 호출 추가
setupSearchMemberButton();

// 새 함수 추가
function setupSearchMemberButton() {
    const searchBtn = document.getElementById('search-member-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            showConnectUserModal();
        });
    }
}
```

### 4.4 데이터 흐름

```
1. 트레이너 홈 화면 로드
   ↓
2. "회원 검색" 버튼 클릭
   ↓
3. showConnectUserModal() 호출
   ↓
4. 검색어 입력 (디바운싱 300ms)
   ↓
5. getAppUsers()로 모든 유저앱 회원 조회
   ↓
6. 검색어로 필터링 (이름, 전화번호, 아이디)
   ↓
7. 검색 결과 표시
   - PT 회원 여부
   - 내 회원 여부
   - 연결 상태
   ↓
8. 회원 선택
   ↓
9. connectAppUser() 호출
   ↓
10. localStorage에 저장
   ↓
11. 대시보드 새로고침
   ↓
12. 운동/식단 탭에서 연결된 회원의 기록 수정 가능
```

## 5. 구현 단계

### 5.1 1단계: UI 버튼 추가
- [ ] "나의 회원" 섹션 헤더에 "회원 검색" 버튼 추가
- [ ] 버튼 클릭 이벤트 리스너 추가

### 5.2 2단계: 검색 로직 수정
- [ ] `showConnectUserModal()` 함수에서 PT 회원 필터링 제거
- [ ] 모든 유저앱 회원 검색 가능하도록 수정

### 5.3 3단계: 검색 결과 개선
- [ ] 검색 결과에 "내 회원" 여부 표시
- [ ] 검색 결과에 "PT 회원" 여부 표시
- [ ] 검색 결과에 "연결됨" 상태 표시

### 5.4 4단계: 테스트
- [ ] 내 회원 검색 테스트
- [ ] 내 회원이 아닌 회원 검색 테스트
- [ ] PT 회원이 아닌 회원 검색 테스트
- [ ] 연결 기능 테스트
- [ ] 연결 후 기록 수정 기능 테스트

## 6. 주의사항

### 6.1 보안
- 트레이너는 모든 유저앱 회원을 검색할 수 있지만, 이는 의도된 동작입니다.
- 실제 데이터 수정 권한은 백엔드에서 별도로 확인해야 합니다.

### 6.2 성능
- `getAppUsers()`는 캐싱을 사용하므로 성능 문제는 없습니다.
- 검색 결과가 많을 경우를 대비해 스크롤 가능한 리스트로 표시합니다.

### 6.3 사용자 경험
- 검색어 입력 시 디바운싱을 적용하여 불필요한 API 호출을 방지합니다.
- 검색 결과에 명확한 표시를 통해 사용자가 쉽게 구분할 수 있도록 합니다.

## 7. 예상 결과

### 7.1 사용자 시나리오
1. 트레이너가 홈 화면에서 "회원 검색" 버튼 클릭
2. 검색 모달에서 회원 이름/전화번호/아이디로 검색
3. 검색 결과에서 원하는 회원 선택
4. 연결 확인 후 연결 완료
5. 운동/식단 탭에서 해당 회원의 기록 확인 및 수정 가능

### 7.2 검색 결과 예시
```
[검색 결과]
- 홍길동 (연결됨) (내 회원) (PT 회원)
  010-1234-5678 | 아이디: hong123 | PT: 홍길동

- 김철수 (내 회원) (PT 회원)
  010-2345-6789 | 아이디: kim456 | PT: 김철수

- 이영희
  010-3456-7890 | 아이디: lee789
```

## 8. 추가 개선 사항 (선택사항)

### 8.1 필터 기능
- "내 회원만 보기" 필터
- "PT 회원만 보기" 필터

### 8.2 정렬 기능
- 이름순 정렬
- 최근 연결순 정렬

### 8.3 검색 히스토리
- 최근 검색한 회원 목록 표시
