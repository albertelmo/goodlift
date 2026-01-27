# SU 장부에서 트레이너 장부 보기/편집 기능 설계

## 📋 개요
SU 장부 화면에서 트레이너 장부의 전체 내용을 보고 편집할 수 있는 기능을 추가합니다.

## 🎯 목표
- SU가 모든 트레이너의 장부 데이터를 조회/편집 가능
- 트레이너 선택 기능 추가
- 선택한 트레이너의 장부 데이터를 SU 장부 화면 하단에 표시
- 트레이너 장부의 모든 기능(추가/수정/삭제) 지원

## 📊 기능 범위

### 1. 트레이너 선택 기능
- SU 장부 화면 상단에 트레이너 선택 드롭다운 추가
- 장부 기능이 'on'인 트레이너만 표시
- "전체 보기" 옵션 (모든 트레이너 장부 통합 보기)

### 2. 트레이너 장부 표시 영역
- SU 장부 화면 하단에 트레이너 장부 섹션 추가
- 선택한 트레이너의 장부 데이터 표시
- 트레이너 장부와 동일한 UI 구조

### 3. 데이터 표시 항목
- 계산식 (총 수입 - 카드수수료 - 지출 = 결과)
- 매출
- 기타수입
- 고정지출
- 변동지출
- 급여

## 🗂️ 파일 구조

### 수정할 파일
- `public/js/ledger.js` - SU 장부에 트레이너 선택 및 트레이너 장부 섹션 추가
- `backend/server.js` - 트레이너 장부 API에 SU 권한 체크 추가

### 새로 생성할 파일 (선택사항)
- `public/js/su-trainer-ledger.js` - SU용 트레이너 장부 렌더링 모듈 (선택사항)

## 🔧 구현 상세

### 1. 백엔드 - API 권한 체크 수정 (`backend/server.js`)

#### 1.1 트레이너 장부 API 권한 체크 수정
현재는 `currentUser`와 `trainer`가 일치해야만 접근 가능하지만, SU는 모든 트레이너 데이터에 접근 가능하도록 수정:

**수정할 API 엔드포인트:**
- `GET /api/trainer/fixed-expenses`
- `GET /api/trainer/variable-expenses`
- `GET /api/trainer/salaries`
- `GET /api/trainer/revenues`
- `GET /api/trainer/other-revenues`
- `POST /api/trainer/fixed-expenses`
- `POST /api/trainer/variable-expenses`
- `POST /api/trainer/salaries`
- `POST /api/trainer/revenues`
- `POST /api/trainer/other-revenues`
- `PATCH /api/trainer/fixed-expenses/:id`
- `PATCH /api/trainer/variable-expenses/:id`
- `PATCH /api/trainer/salaries/:id`
- `PATCH /api/trainer/revenues/:id`
- `PATCH /api/trainer/other-revenues/:id`
- `DELETE /api/trainer/fixed-expenses/:id`
- `DELETE /api/trainer/variable-expenses/:id`
- `DELETE /api/trainer/salaries/:id`
- `DELETE /api/trainer/revenues/:id`
- `DELETE /api/trainer/other-revenues/:id`

**권한 체크 로직:**
```javascript
// 현재 로그인한 사용자가 SU인지 확인
const currentUserAccount = accounts.find(acc => acc.username === currentUser);
const isSU = currentUserAccount && currentUserAccount.role === 'su';

// SU이거나 본인 데이터인 경우만 접근 허용
if (!isSU && currentUser !== trainer) {
  return res.status(403).json({ message: '권한이 없습니다.' });
}
```

#### 1.2 트레이너 목록 조회 API 활용
- 기존 `/api/trainers` API 사용
- `ledger === 'on'`인 트레이너만 필터링 (프론트엔드에서)

### 2. 프론트엔드 - SU 장부 UI 수정 (`public/js/ledger.js`)

#### 2.1 트레이너 선택 UI 추가
```javascript
// SU 장부 화면 상단에 트레이너 선택 드롭다운 추가
<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
  <label style="font-size:0.9rem;font-weight:600;color:#333;">트레이너 선택:</label>
  <select id="ledger-trainer-select" style="padding:6px 12px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;">
    <option value="">전체 보기</option>
    <!-- 트레이너 목록 동적 로드 -->
  </select>
</div>
```

#### 2.2 트레이너 장부 섹션 추가
```javascript
// SU 장부 화면 하단에 트레이너 장부 섹션 추가
<div id="ledger-trainer-section" style="margin-top:32px;padding-top:32px;border-top:2px solid #e0e0e0;">
  <h3 style="margin:0 0 16px 0;color:#1976d2;font-size:1.1rem;">트레이너 장부</h3>
  <!-- 트레이너 장부 내용 -->
</div>
```

#### 2.3 트레이너 장부 렌더링 함수
- `renderTrainerLedger(trainerUsername, month)` - 선택한 트레이너의 장부 렌더링
- 트레이너 장부와 동일한 UI 구조 사용
- SU 권한으로 API 호출 (currentUser 대신 trainer 파라미터 사용)

## 📐 UI 구성

### SU 장부 화면 구조
```
┌─────────────────────────────────────────┐
│ 📖 장부  [이전월 지출 불러오기]           │
│        [◀ 2025년 1월 ▶]                 │
├─────────────────────────────────────────┤
│ 트레이너 선택: [드롭다운 ▼]               │
├─────────────────────────────────────────┤
│ 센터별 전체 매출                          │
│ 지출 종류별 합계                          │
│ 고정지출 / 변동지출 / 급여                │
│ 월별 정산                                │
├─────────────────────────────────────────┤
│ ──── 트레이너 장부 ────                  │
│ [선택한 트레이너명]의 장부                │
│                                          │
│ 계산식: 총 수입 - 카드수수료 - 지출 = 결과│
│ 매출                                    │
│ 기타수입                                 │
│ 고정지출 / 변동지출 / 급여                │
└─────────────────────────────────────────┘
```

## 🔍 데이터 필터링 로직

### 트레이너 선택 시
- 선택한 트레이너의 데이터만 표시
- API 호출 시 `trainer` 파라미터로 필터링

### "전체 보기" 선택 시
- 모든 트레이너의 데이터를 통합하여 표시
- 트레이너별로 그룹화하여 표시 (선택사항)
- 또는 통합 합계만 표시 (선택사항)

## ⚠️ 주의사항

1. **권한 체크**: SU만 트레이너 장부 조회/편집 가능
2. **데이터 보안**: 트레이너는 본인 데이터만 접근 가능 (기존 유지)
3. **UI 일관성**: 트레이너 장부와 동일한 UI 구조 유지
4. **성능**: 트레이너 목록이 많을 경우 성능 고려

## 📝 구현 순서

1. ⬜ 백엔드 API 권한 체크 수정 (SU 접근 허용)
2. ⬜ 프론트엔드에 트레이너 선택 UI 추가
3. ⬜ 트레이너 목록 로드 (ledger='on'인 트레이너만)
4. ⬜ 트레이너 장부 섹션 UI 추가
5. ⬜ 트레이너 장부 데이터 로드 함수 구현
6. ⬜ 트레이너 장부 렌더링 함수 구현
7. ⬜ 트레이너 장부 추가/수정/삭제 기능 구현
8. ⬜ 트레이너 선택 변경 시 데이터 리로드
9. ⬜ 테스트 및 검증

## 🎨 UI/UX 고려사항

1. **트레이너 선택**: 드롭다운 또는 검색 가능한 선택 UI
2. **로딩 상태**: 트레이너 장부 데이터 로드 중 표시
3. **에러 처리**: 트레이너 데이터 로드 실패 시 사용자 피드백
4. **반응형 디자인**: 모바일에서도 사용 가능하도록
5. **시각적 구분**: SU 장부와 트레이너 장부를 명확히 구분

## 🔄 향후 확장 가능성

1. 트레이너별 비교 기능
2. 트레이너별 통계 그래프
3. 여러 트레이너 동시 선택 및 비교
4. 트레이너 장부 일괄 편집 기능
5. 트레이너 장부 엑셀 내보내기
