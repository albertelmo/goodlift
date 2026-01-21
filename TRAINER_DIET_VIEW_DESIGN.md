# 트레이너 식단 기록 조회 및 코멘트 기능 설계

## 📋 개요
트레이너가 자신이 담당한 회원(연결된 회원)의 식단 기록을 조회하고, 식단 카드에 코멘트를 달 수 있는 기능을 구현합니다. 운동기록 편집 기능과 유사하지만, 식단 기록은 **읽기 전용 + 코멘트만 가능**합니다.

---

## 🔍 기존 기능 분석

### 1. 운동기록 편집 기능 분석

#### 작동 방식
1. **트레이너 → 유저 연결 확인**
   - 트레이너가 대시보드에서 "트레이너 운동기록 보기" 버튼 클릭
   - `viewTrainerWorkouts(trainerUsername)` 함수 호출
   - 트레이너의 `app_user_id`를 찾아서 `localStorage`에 저장:
     ```javascript
     localStorage.setItem('viewingTrainerAppUserId', trainerAppUser.id);
     localStorage.setItem('isReadOnly', 'true');
     ```

2. **읽기 전용 모드 활성화**
   - `workout/list.js`의 `init()` 함수에서 `isReadOnly` 플래그 확인
   - 읽기 전용일 경우 편집 버튼 숨김 및 수정 기능 비활성화

3. **권한 체크**
   - API 호출 시 `app_user_id`로 식별
   - 트레이너는 자신이 연결한 회원의 데이터만 조회 가능

#### 핵심 파일
- `public/js/app-user/dashboard.js`: `viewTrainerWorkouts()` 함수
- `public/js/app-user/workout/list.js`: 읽기 전용 모드 처리
- `backend/server.js`: 운동기록 API (권한 체크 포함)

### 2. 회원 연결 구조 분석

#### 데이터 구조
- **`app_users` 테이블**:
  - `member_name`: 회원 이름 (members 테이블과 연결)
  - `trainer`: 트레이너 username
  - `app_user_id`: 앱 유저 고유 ID

- **`members` 테이블**:
  - `name`: 회원 이름
  - `trainer`: 담당 트레이너 username
  - `status`: 회원 상태 ('유효' 등)

#### 회원 목록 조회
- **백엔드**: `backend/app-users-db.js`의 `getTrainerMembers()` 함수
  ```sql
  SELECT au.*, m.remain_sessions
  FROM app_users au
  INNER JOIN members m ON au.member_name = m.name
  WHERE m.trainer = $1
    AND au.member_name IS NOT NULL
    AND au.is_active = true
  ```

- **프론트엔드**: `public/js/trainer.js`의 `renderMyMembers()` 함수
  - 트레이너의 유효한 회원 목록 표시

### 3. 식단 기록 코멘트 기능 (이미 구현됨)

#### API 엔드포인트
- **코멘트 추가**: `POST /api/diet-records/:id/comments`
  - `commenter_type`: 'user' 또는 'trainer'
  - `commenter_id`: 작성자 ID (app_user_id 또는 trainer username)
  - `commenter_name`: 작성자 이름
  - `comment_text`: 코멘트 내용

- **코멘트 수정**: `PATCH /api/diet-records/:id/comments/:comment_id`
- **코멘트 삭제**: `DELETE /api/diet-records/:id/comments/:comment_id`

#### 데이터베이스 구조
- **`diet_comments` 테이블**:
  - `id`: 코멘트 ID
  - `diet_record_id`: 식단 기록 ID
  - `commenter_type`: 'user' | 'trainer'
  - `commenter_id`: 작성자 ID
  - `commenter_name`: 작성자 이름
  - `comment_text`: 코멘트 내용
  - `created_at`, `updated_at`

---

## 🎯 구현 설계

### Phase 1: 백엔드 - 식단 기록 조회 권한 체크

#### 1.1 트레이너 권한 확인 로직 추가

**파일**: `backend/server.js`

**변경 사항**:
- 식단 기록 조회 API에 트레이너 권한 체크 추가
- 트레이너가 연결한 회원의 식단 기록만 조회 가능하도록 제한

```javascript
// GET /api/diet-records (수정)
app.get('/api/diet-records', async (req, res) => {
    const { app_user_id, start_date, end_date } = req.query;
    
    // 트레이너 모드 체크
    const isTrainerMode = app_user_id && app_user_id.includes('trainer-');
    if (isTrainerMode) {
        // 트레이너의 실제 app_user_id 추출
        const actualAppUserId = app_user_id.replace('trainer-', '');
        // 트레이너가 해당 회원의 담당자인지 확인
        const hasAccess = await checkTrainerMemberAccess(
            req.session.username, // 트레이너 username
            actualAppUserId
        );
        if (!hasAccess) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
    }
    
    // 기존 로직...
});
```

**새 함수**: `backend/app-users-db.js`
```javascript
// 트레이너가 특정 app_user_id의 담당자인지 확인
const checkTrainerMemberAccess = async (trainerUsername, appUserId) => {
    const query = `
        SELECT 1
        FROM app_users au
        INNER JOIN members m ON au.member_name = m.name
        WHERE au.id = $1
          AND m.trainer = $2
          AND au.member_name IS NOT NULL
          AND au.is_active = true
    `;
    const result = await pool.query(query, [appUserId, trainerUsername]);
    return result.rows.length > 0;
};
```

#### 1.2 식단 기록 단일 조회 권한 체크

**파일**: `backend/server.js` - `GET /api/diet-records/:id`

트레이너 모드일 경우에도 권한 체크 추가

---

### Phase 2: 프론트엔드 - 트레이너 식단 기록 보기 기능

#### 2.1 대시보드에 식단 기록 보기 버튼 추가

**파일**: `public/js/app-user/dashboard.js`

**변경 사항**:
- `viewTrainerWorkouts()` 함수와 유사하게 `viewTrainerDiets()` 함수 추가
- 트레이너의 회원 목록에서 각 회원마다 "식단 보기" 버튼 추가

```javascript
/**
 * 트레이너가 회원의 식단 기록 보기
 */
async function viewTrainerDiets(appUserId, memberName) {
    try {
        // 확인 메시지
        if (!confirm(`${memberName} 회원의 식단 기록을 보시겠습니까?`)) {
            return;
        }
        
        // 트레이너 모드 설정
        localStorage.setItem('viewingTrainerAppUserId', appUserId);
        localStorage.setItem('isTrainerDietMode', 'true');
        localStorage.setItem('viewingMemberName', memberName);
        
        // 식단 기록 화면으로 이동
        const { navigateToScreen } = await import('./index.js');
        navigateToScreen('diet');
    } catch (error) {
        console.error('트레이너 식단 기록 조회 오류:', error);
        alert('식단 기록을 불러오는 중 오류가 발생했습니다.');
    }
}
```

#### 2.2 회원 목록에 식단 보기 버튼 추가

**파일**: `public/js/app-user/dashboard.js` - `loadTrainerMembers()` 함수

트레이너 회원 목록에 "식단 보기" 버튼 추가:

```javascript
// 회원 목록 렌더링 시
members.forEach(member => {
    html += `
        <div class="app-member-item">
            <div class="app-member-info">
                <h3 class="app-member-name">${member.name}</h3>
                <p class="app-member-details">...</p>
            </div>
            <button onclick="viewTrainerDiets('${member.app_user_id}', '${member.name}')"
                    class="app-btn-secondary">
                식단 보기
            </button>
        </div>
    `;
});
```

---

### Phase 3: 식단 기록 화면 읽기 전용 모드

#### 3.1 식단 목록 읽기 전용 처리

**파일**: `public/js/app-user/diet/list.js`

**변경 사항**:
- `init()` 함수에서 `isTrainerDietMode` 확인
- 트레이너 모드일 경우:
  1. 추가 버튼 숨김
  2. 편집 버튼 숨김
  3. 식단 카드 클릭 시 상세 모달에서 코멘트만 가능하도록 설정

```javascript
export async function init(appUserId, readOnly = false) {
    currentAppUserId = appUserId;
    isReadOnly = readOnly;
    
    // 트레이너 식단 모드 체크
    const isTrainerMode = localStorage.getItem('isTrainerDietMode') === 'true';
    if (isTrainerMode) {
        isReadOnly = true;
        // 트레이너 모드에서는 실제 app_user_id 사용
        // (viewingTrainerAppUserId에서 가져옴)
    }
    
    // 기존 로직...
}
```

#### 3.2 식단 상세 모달 - 트레이너 코멘트 기능

**파일**: `public/js/app-user/diet/detail.js`

**변경 사항**:
- `showDietDetailModal()` 함수에서 트레이너 모드 체크
- 트레이너 모드일 경우:
  1. 편집 기능 비활성화 (`isReadOnly = true`)
  2. 코멘트 입력창 활성화 (트레이너용)
  3. 트레이너 정보로 코멘트 작성

```javascript
export async function showDietDetailModal(appUserId, record, isReadOnly = false, onSuccess) {
    // 트레이너 모드 체크
    const isTrainerMode = localStorage.getItem('isTrainerDietMode') === 'true';
    const trainerUsername = localStorage.getItem('username');
    
    if (isTrainerMode) {
        isReadOnly = true; // 편집 불가
        // 트레이너 정보 가져오기
        const trainerRes = await fetch(`/api/trainers`);
        const trainers = await trainerRes.json();
        const trainer = trainers.find(t => t.username === trainerUsername);
    }
    
    // 코멘트 전송 로직 수정
    if (!isReadOnly && commentSubmitBtn) {
        const sendComment = async () => {
            const commentText = commentInput.value.trim();
            
            if (isTrainerMode) {
                // 트레이너 코멘트
                const commentData = {
                    commenter_type: 'trainer',
                    commenter_id: trainerUsername,
                    commenter_name: trainer.name,
                    comment_text: commentText
                };
                await addDietComment(fullRecord.id, commentData);
            } else {
                // 기존 유저 코멘트 로직
                // ...
            }
        };
    }
}
```

---

### Phase 4: API 함수 추가

#### 4.1 식단 코멘트 API 함수 추가

**파일**: `public/js/app-user/api.js`

```javascript
/**
 * 식단 기록에 코멘트 추가
 */
export async function addDietComment(dietRecordId, commentData, appUserId = null) {
    const queryParams = appUserId ? `?app_user_id=${appUserId}` : '';
    const response = await fetch(`/api/diet-records/${dietRecordId}/comments${queryParams}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commentData)
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '코멘트 추가에 실패했습니다.');
    }
    
    return await response.json();
}
```

---

## 📊 데이터 흐름

### 트레이너 식단 기록 조회 플로우

```
1. 트레이너 대시보드
   └─> 회원 목록에서 "식단 보기" 버튼 클릭
       └─> viewTrainerDiets(appUserId, memberName) 호출
           └─> localStorage에 모드 정보 저장
               └─> 식단 기록 화면으로 이동

2. 식단 기록 화면 (diet/list.js)
   └─> isTrainerDietMode 체크
       └─> 트레이너 모드일 경우:
           ├─> 추가 버튼 숨김
           ├─> 편집 버튼 숨김
           └─> 식단 카드 클릭 → 상세 모달 (읽기 전용)

3. 식단 상세 모달 (diet/detail.js)
   └─> 트레이너 모드일 경우:
       ├─> 편집 불가 (isReadOnly = true)
       └─> 코멘트 입력 가능
           └─> 코멘트 전송 시:
               ├─> commenter_type: 'trainer'
               ├─> commenter_id: trainerUsername
               └─> POST /api/diet-records/:id/comments
```

---

## 🔐 권한 체크

### 백엔드 권한 체크

1. **식단 기록 조회**:
   - 트레이너가 해당 회원의 담당자인지 확인
   - `members.trainer = 트레이너.username` AND `app_users.member_name = members.name`

2. **코멘트 작성**:
   - 식단 기록에 접근 권한이 있는 트레이너만 코멘트 작성 가능
   - 코멘트 추가 시 권한 체크 포함

### 프론트엔드 제한

1. **UI 제한**:
   - 추가 버튼 숨김
   - 편집 버튼 숨김
   - 식단 카드 클릭 시 상세 모달만 표시 (읽기 전용)

2. **모드 구분**:
   - `isTrainerDietMode`: 트레이너 식단 모드 플래그
   - `viewingTrainerAppUserId`: 조회 중인 회원의 app_user_id
   - `viewingMemberName`: 조회 중인 회원 이름

---

## 🎨 UI/UX 설계

### 1. 트레이너 대시보드 - 회원 목록

```
┌─────────────────────────────────┐
│ 담당 회원                        │
├─────────────────────────────────┤
│ 김철수                           │
│ 세션: 10회 / 잔여: 5회          │
│ [식단 보기] [운동기록 보기]     │ ← 새로 추가
├─────────────────────────────────┤
│ 이영희                           │
│ 세션: 20회 / 잔여: 10회         │
│ [식단 보기] [운동기록 보기]     │
└─────────────────────────────────┘
```

### 2. 식단 기록 화면 (트레이너 모드)

- **헤더**: "이영희 회원의 식단 기록" (또는 "식단 기록 - 읽기 전용")
- **추가 버튼**: 숨김
- **식단 카드**: 편집 버튼 숨김
- **카드 클릭**: 상세 모달 (읽기 전용 + 코멘트 입력 가능)

### 3. 식단 상세 모달 (트레이너 모드)

- **편집 버튼**: 없음
- **삭제 버튼**: 없음
- **코멘트 섹션**:
  - 기존 코멘트 목록 (트레이너/유저 모두 표시)
  - 코멘트 입력창 (트레이너용)
  - 전송 버튼

---

## 📝 구현 체크리스트

### 백엔드
- [ ] `checkTrainerMemberAccess()` 함수 구현
- [ ] 식단 기록 조회 API에 트레이너 권한 체크 추가
- [ ] 식단 기록 단일 조회 API에 트레이너 권한 체크 추가
- [ ] 코멘트 추가 API에 트레이너 권한 체크 추가

### 프론트엔드
- [ ] `viewTrainerDiets()` 함수 구현
- [ ] 대시보드에 "식단 보기" 버튼 추가
- [ ] 식단 목록 화면에서 트레이너 모드 처리
- [ ] 식단 상세 모달에서 트레이너 코멘트 기능 추가
- [ ] `addDietComment()` API 함수 추가/수정

### 테스트
- [ ] 트레이너가 연결된 회원의 식단 기록 조회 테스트
- [ ] 트레이너가 연결되지 않은 회원의 식단 기록 접근 차단 테스트
- [ ] 트레이너 코멘트 작성/수정/삭제 테스트
- [ ] 읽기 전용 모드에서 편집 기능 차단 확인

---

## 🔄 기존 코드와의 호환성

### 운동기록 편집 기능과의 일관성
- 운동기록 편집 기능과 동일한 패턴 사용
- `localStorage` 기반 모드 관리
- `isReadOnly` 플래그 활용

### 식단 기록 코멘트 기능
- 기존 코멘트 API 활용
- `commenter_type`으로 'user'와 'trainer' 구분
- 코멘트 표시는 기존 UI 재사용

---

## 🚀 향후 확장 가능성

1. **코멘트 알림 기능**: 트레이너가 코멘트를 달면 유저에게 알림
2. **식단 통계 조회**: 트레이너가 회원의 식단 통계 보기
3. **식단 평가**: 트레이너가 식단에 별점/평가 추가

---

## 📚 참고 파일

- `public/js/app-user/dashboard.js`: 대시보드 및 트레이너 운동기록 보기
- `public/js/app-user/workout/list.js`: 운동기록 읽기 전용 모드 구현
- `public/js/app-user/diet/list.js`: 식단 기록 목록
- `public/js/app-user/diet/detail.js`: 식단 상세 모달
- `backend/server.js`: 식단 기록 및 코멘트 API
- `backend/app-users-db.js`: 회원 연결 관련 DB 함수