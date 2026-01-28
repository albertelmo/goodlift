# 재등록 탭에서 회원 상태 "만료" 변경 시 회원 정보 자동 동기화 설계

## 📋 개요

재등록 탭에서 회원의 상태를 "만료"로 변경하면, 회원 정보(members 테이블)의 상태도 자동으로 "만료"로 변경하는 기능을 구현합니다.

## 🎯 목표

- 재등록 현황에서 회원 상태를 "만료"로 변경 시 회원 정보의 상태도 자동으로 "만료"로 업데이트
- 재등록 현황에서 회원 상태를 "만료"에서 다른 상태(예상, 완료, 이월)로 변경 시 회원 정보의 상태를 "유효"로 자동 업데이트
- 데이터 일관성 유지
- 사용자 편의성 향상 (수동 업데이트 불필요)

## 📊 현재 구조 분석

### 0. 사용자 흐름
1. **재등록 수정 모달 열기**: 재등록 현황에서 "수정" 버튼 클릭
2. **상태 변경**: 모달에서 회원별 상태를 드롭다운으로 선택 (예상/완료/이월/만료)
3. **저장 버튼 클릭**: 모달 하단의 "저장" 버튼 클릭
4. **API 호출**: `PATCH /api/renewals/:id` API 호출 (프론트엔드: `public/js/renew.js` 라인 774)
5. **회원 상태 자동 업데이트**: 백엔드 API에서 재등록 데이터 업데이트 후, 회원 상태도 자동 업데이트

**중요**: 회원 상태 변경은 **재등록 수정 모달에서 저장 버튼을 눌렀을 때** 일괄 처리됩니다.

### 1. 재등록 데이터 구조
- **테이블**: `renewals`
- **상태 필드**: `status` (JSONB 형식)
  - 형식: `{ "회원1": "완료", "회원2": "예상", "회원3": "만료" }`
- **상태 값**: "예상", "완료", "이월", "만료"

### 2. 회원 정보 데이터 구조
- **테이블**: `members`
- **상태 필드**: `status` (VARCHAR/TEXT)
- **가능한 값**: "유효", "만료", "휴회" 등

### 3. 현재 API 흐름
1. **재등록 수정 API**: `PATCH /api/renewals/:id`
   - 위치: `backend/server.js` (라인 4743-4785)
   - 기능: 재등록 현황 수정
   - 현재: 재등록 데이터만 업데이트

2. **회원 정보 수정 API**: `PATCH /api/members/:name`
   - 위치: `backend/server.js` (라인 3575-3646)
   - 기능: 회원 정보 수정
   - 현재: 개별 회원 정보 수정

## 🔧 구현 설계

### 1. 백엔드 수정 (`backend/server.js`)

#### 1.1 재등록 수정 API 수정
**위치**: `app.patch('/api/renewals/:id', ...)` (라인 4743-4785)

**트리거 시점**: 재등록 수정 모달에서 "저장" 버튼을 눌렀을 때

**수정 내용**:
- 재등록 상태 업데이트 후, 상태 변경을 감지하여
- "만료"로 변경된 회원: 회원 정보 상태를 "만료"로 자동 업데이트
- "만료"에서 다른 상태로 변경된 회원: 회원 정보 상태를 "유효"로 자동 업데이트

**로직**:
```javascript
// 1. 기존 재등록 데이터 조회 (변경 전 상태 확인)
const oldRenewal = await renewalsDB.getRenewalById(id);
const oldStatuses = oldRenewal.status || {};

// 2. 재등록 데이터 업데이트
const renewal = await renewalsDB.updateRenewal(id, updates);

// 3. 상태 변경 감지 및 회원 정보 업데이트
const newStatuses = updates.status || {};
const expiredMembers = []; // "만료"로 변경된 회원
const validMembers = [];    // "만료"에서 다른 상태로 변경된 회원

for (const memberName in newStatuses) {
  const oldStatus = oldStatuses[memberName] || '예상';
  const newStatus = newStatuses[memberName];
  
  // 케이스 1: 이전 상태가 "만료"가 아니고, 새 상태가 "만료"인 경우
  if (oldStatus !== '만료' && newStatus === '만료') {
    expiredMembers.push(memberName);
  }
  // 케이스 2: 이전 상태가 "만료"이고, 새 상태가 "만료"가 아닌 경우
  else if (oldStatus === '만료' && newStatus !== '만료') {
    validMembers.push(memberName);
  }
}

// 4-1. "만료"로 변경된 회원들의 상태를 "만료"로 업데이트
if (expiredMembers.length > 0) {
  for (const memberName of expiredMembers) {
    try {
      await membersDB.updateMember(memberName, { status: '만료' });
      console.log(`[Renewal] 회원 "${memberName}"의 상태를 "만료"로 자동 업데이트했습니다.`);
    } catch (error) {
      console.error(`[Renewal] 회원 "${memberName}" 상태 업데이트 실패:`, error);
      // 회원 정보 업데이트 실패해도 재등록 업데이트는 성공으로 처리
    }
  }
}

// 4-2. "만료"에서 다른 상태로 변경된 회원들의 상태를 "유효"로 업데이트
if (validMembers.length > 0) {
  for (const memberName of validMembers) {
    try {
      await membersDB.updateMember(memberName, { status: '유효' });
      console.log(`[Renewal] 회원 "${memberName}"의 상태를 "유효"로 자동 업데이트했습니다.`);
    } catch (error) {
      console.error(`[Renewal] 회원 "${memberName}" 상태 업데이트 실패:`, error);
      // 회원 정보 업데이트 실패해도 재등록 업데이트는 성공으로 처리
    }
  }
}
```

#### 1.2 주의사항
- **에러 처리**: 회원 정보 업데이트가 실패해도 재등록 업데이트는 성공으로 처리
- **중복 업데이트 방지**: 이미 "만료" 상태인 회원은 다시 업데이트하지 않음
- **트랜잭션**: 재등록 업데이트와 회원 정보 업데이트는 별도 트랜잭션으로 처리 (재등록 업데이트 우선)

### 2. 데이터베이스 함수 확인

#### 2.1 필요한 함수
- `renewalsDB.getRenewalById(id)` - 재등록 데이터 조회 (변경 전 상태 확인용)
  - ✅ 이미 존재함 (`backend/renewals-db.js` 라인 494-537)

#### 2.2 회원 정보 업데이트
- `membersDB.updateMember(name, { status: '만료' })` - 이미 존재하는 함수 사용

## 📝 구현 순서

1. ✅ `renewals-db.js`에 `getRenewalById()` 함수 확인 완료 (이미 존재)
2. ⬜ `backend/server.js`의 재등록 수정 API 수정
   - 기존 재등록 데이터 조회 로직 추가
   - 상태 변경 감지 로직 추가
   - 회원 정보 자동 업데이트 로직 추가
3. ⬜ 에러 처리 및 로깅 추가
4. ⬜ 테스트 및 검증

## ⚠️ 주의사항

1. **상태 변경 감지**: 
   - 케이스 1: 이전 상태가 "만료"가 아니고, 새 상태가 "만료"인 경우 → 회원 상태를 "만료"로 업데이트
   - 케이스 2: 이전 상태가 "만료"이고, 새 상태가 "만료"가 아닌 경우 → 회원 상태를 "유효"로 업데이트
   - 이미 동일한 상태인 회원은 다시 업데이트하지 않음

2. **에러 처리**:
   - 회원 정보 업데이트 실패 시에도 재등록 업데이트는 성공으로 처리
   - 에러는 로그로 기록

3. **성능**:
   - 여러 회원을 한 번에 업데이트하는 경우 순차 처리
   - 대량 업데이트 시 성능 고려 필요

4. **데이터 일관성**:
   - 재등록 상태와 회원 정보 상태가 일치하도록 보장
   - "만료" ↔ 다른 상태 간 변경 시에만 자동 동기화
   - 재등록 상태 변경 규칙:
     * "만료"가 아닌 상태 → "만료": 회원 상태를 "만료"로 업데이트
     * "만료" → "만료"가 아닌 상태: 회원 상태를 "유효"로 업데이트
   - 다른 상태 간 변경(예상 ↔ 완료, 예상 ↔ 이월 등)은 동기화하지 않음

## 🔄 향후 확장 가능성

1. **양방향 동기화**: 회원 정보에서 상태 변경 시 재등록 상태도 업데이트 (선택사항)
2. **상태 변경 히스토리**: 상태 변경 이력을 기록하는 기능
3. **일괄 업데이트**: 여러 회원을 한 번에 업데이트하는 최적화

## 📌 구현 세부사항

### API 수정 위치
- **파일**: `backend/server.js`
- **함수**: `app.patch('/api/renewals/:id', ...)`
- **라인**: 약 4743-4785

### DB 모듈 확인 필요
- `backend/renewals-db.js`에 `getRenewalById()` 함수 존재 여부 확인
- 없으면 추가 필요
