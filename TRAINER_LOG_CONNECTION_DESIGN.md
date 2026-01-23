# 트레이너 활동 로그에서 회원 연결 기능 설계

## 목표
트레이너가 활동 로그를 클릭하여 해당 회원과 연결할 수 있도록 기능 추가

## 현재 상황

### 데이터 구조
- `trainer_activity_logs` 테이블:
  - `id`: UUID
  - `trainer_username`: 트레이너 username
  - `member_name`: 회원 이름 (앱 유저 이름)
  - `activity_type`: 활동 유형
  - `activity_message`: 활동 메시지
  - `related_record_id`: 관련 레코드 ID
  - `record_date`: 기록 날짜
  - `is_read`: 읽음 여부
  - `created_at`: 생성 시간
  - **`app_user_id`: 없음 (추가 필요)**

### 로그 생성
- `createActivityLogForTrainer(appUserId, ...)` 함수에서 로그 생성
- 현재는 `appUserId`를 받지만 DB에 저장하지 않음
- `member_name`만 저장 (앱 유저 이름)

### 로그 클릭 동작
- 현재: 읽음 처리만 수행
- 읽지 않은 로그만 클릭 가능

### 회원 연결 기능
- `connectAppUser(appUserId, appUserName)`: app_user_id로 연결
- `localStorage`에 `connectedMemberAppUserId` 저장
- 이미 연결된 회원이 있으면 확인 후 교체

## 설계: 상황별 동작

### 상황 1: 로그에 `app_user_id`가 있는 경우 (신규 로그)

#### 1-1. 현재 연결된 회원이 없는 경우
**동작:**
1. 로그 클릭 → 읽음 처리
2. `app_user_id` 확인
3. 연결 확인 다이얼로그: `"${memberName} 회원의 정보를 불러오시겠습니까?"`
4. 확인 시 → `connectAppUser(log.app_user_id, log.member_name)` 호출
5. 취소 시 → 읽음 처리만 유지

#### 1-2. 현재 연결된 회원이 있는 경우

##### 1-2-1. 연결된 회원의 로그를 클릭한 경우
**동작:**
1. 로그 클릭 → 읽음 처리
2. `app_user_id` 확인 → 현재 연결된 회원과 동일
3. **연결 확인 다이얼로그 없음** (이미 연결되어 있으므로)
4. 읽음 처리만 수행

**이유:** 이미 연결된 회원이므로 추가 연결 작업 불필요

##### 1-2-2. 다른 회원의 로그를 클릭한 경우
**동작:**
1. 로그 클릭 → 읽음 처리
2. `app_user_id` 확인 → 현재 연결된 회원과 다름
3. 연결 확인 다이얼로그: `"현재 연결된 회원과의 연결을 해제하고 "${memberName}" 회원의 정보를 불러오시겠습니까?"`
4. 확인 시 → `connectAppUser(log.app_user_id, log.member_name)` 호출
5. 취소 시 → 읽음 처리만 유지

**참고:** `connectAppUser()` 내부에서 이미 연결 확인 로직이 있으므로, 여기서는 단순히 호출만 하면 됨

### 상황 2: 로그에 `app_user_id`가 없는 경우 (기존 로그)

#### 2-1. 현재 연결된 회원이 없는 경우
**동작:**
1. 로그 클릭 → 읽음 처리
2. `app_user_id` 확인 → 없음
3. **연결 옵션 제공 안 함** (데이터 부족)
4. 읽음 처리만 수행

**이유:** `app_user_id`가 없으면 연결할 수 없음

#### 2-2. 현재 연결된 회원이 있는 경우
**동작:**
1. 로그 클릭 → 읽음 처리
2. `app_user_id` 확인 → 없음
3. **연결 옵션 제공 안 함** (데이터 부족)
4. 읽음 처리만 수행

**참고:** 기존 로그는 `member_name`만 있으므로, 필요시 `member_name`으로 `app_user_id`를 조회할 수 있지만, 이는 추가 API 호출이 필요하므로 우선 제외

## 구현 단계

### Phase 1: DB 스키마 변경
1. `trainer_activity_logs` 테이블에 `app_user_id UUID` 컬럼 추가 (NULL 허용)
2. 인덱스 추가: `idx_trainer_activity_logs_app_user_id` (선택사항)

### Phase 2: 로그 생성 수정
1. `createActivityLogForTrainer()` 함수 수정
   - `addActivityLog()` 호출 시 `app_user_id` 포함
2. `trainer-activity-logs-db.js`의 `addActivityLog()` 수정
   - `app_user_id` 파라미터 추가
   - INSERT 쿼리에 `app_user_id` 포함

### Phase 3: 로그 조회 수정
1. `getActivityLogs()` 함수 수정
   - SELECT 쿼리에 `app_user_id` 포함
2. API 응답에 `app_user_id` 포함

### Phase 4: 기존 로그 마이그레이션 (선택사항)
1. 기존 로그의 `member_name`으로 `app_users` 테이블 조회
2. `app_user_id` 업데이트
3. 매칭 실패한 로그는 `app_user_id`를 NULL로 유지

### Phase 5: 프론트엔드 로직 추가
1. 로그 렌더링 시 `data-app-user-id` 속성 추가
2. 로그 클릭 이벤트 수정:
   - 읽음 처리 (기존 로직)
   - `app_user_id` 확인
   - 현재 연결된 회원 확인 (`localStorage.getItem('connectedMemberAppUserId')`)
   - 상황별 동작 수행 (위의 설계 참고)

## 상세 구현 로직

### 프론트엔드 로그 클릭 핸들러

```javascript
// 로그 클릭 이벤트
logItem.addEventListener('click', async () => {
    const logId = item.getAttribute('data-log-id');
    const appUserId = item.getAttribute('data-app-user-id'); // 새로 추가
    const memberName = item.getAttribute('data-member-name'); // 새로 추가
    const isUnread = item.classList.contains('app-activity-log-item-unread');
    
    if (!logId || !isUnread) return;
    
    const trainerUsername = currentUser?.username;
    if (!trainerUsername) return;
    
    // 1. 읽음 처리 (기존 로직)
    try {
        await markActivityLogAsRead(logId, trainerUsername);
        // UI 업데이트...
        
        // 2. app_user_id 확인 및 연결 로직
        if (appUserId && appUserId !== 'null' && appUserId !== '') {
            const connectedAppUserId = localStorage.getItem('connectedMemberAppUserId');
            
            // 상황 1-2-1: 이미 연결된 회원의 로그
            if (connectedAppUserId === appUserId) {
                // 연결 확인 없이 읽음 처리만 완료
                return;
            }
            
            // 상황 1-1, 1-2-2: 연결되지 않은 회원의 로그
            // connectAppUser() 내부에서 확인 다이얼로그 처리
            // 하지만 여기서는 읽음 처리 후 연결 확인을 해야 하므로
            // 직접 확인 다이얼로그를 띄우는 것이 좋음
            
            if (connectedAppUserId) {
                // 상황 1-2-2: 다른 회원이 연결되어 있음
                if (confirm(`현재 연결된 회원과의 연결을 해제하고 "${memberName}" 회원의 정보를 불러오시겠습니까?`)) {
                    await connectAppUser(appUserId, memberName);
                }
            } else {
                // 상황 1-1: 연결된 회원이 없음
                if (confirm(`"${memberName}" 회원의 정보를 불러오시겠습니까?`)) {
                    await connectAppUser(appUserId, memberName);
                }
            }
        }
        // 상황 2: app_user_id가 없으면 연결 옵션 제공 안 함
    } catch (error) {
        console.error('로그 읽음 처리 오류:', error);
        alert('로그 읽음 처리 중 오류가 발생했습니다.');
    }
});
```

## 주의사항

1. **기존 로그 호환성**: `app_user_id`가 NULL인 기존 로그도 정상 동작해야 함
2. **에러 처리**: `app_user_id` 조회 실패 시에도 읽음 처리는 정상 동작해야 함
3. **UX 일관성**: 기존 회원 연결 기능과 동일한 확인 다이얼로그 사용
4. **성능**: 로그 클릭 시 추가 API 호출 최소화

## 테스트 시나리오

1. **신규 로그 (app_user_id 있음)**
   - 연결된 회원 없음 → 로그 클릭 → 연결 확인 → 연결 성공
   - 연결된 회원 있음 → 같은 회원 로그 클릭 → 읽음 처리만
   - 연결된 회원 있음 → 다른 회원 로그 클릭 → 연결 교체 확인 → 연결 성공

2. **기존 로그 (app_user_id 없음)**
   - 로그 클릭 → 읽음 처리만 (연결 옵션 없음)

3. **에러 케이스**
   - `app_user_id`가 유효하지 않은 경우
   - `connectAppUser()` 호출 실패 시
