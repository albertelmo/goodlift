# 운동기록 텍스트 입력 기능 설계안

## 1. 개요

운동기록에 운동 종류나 세트를 선택하지 않고, 자유롭게 텍스트로만 입력할 수 있는 기능을 추가합니다.

### 1.1 목적
- 빠른 메모 입력: 운동 종류 선택 없이 간단히 기록
- 자유 형식 기록: 세트/시간 구조에 맞지 않는 운동 기록
- 사용자 편의성 향상: 복잡한 입력 과정 없이 빠르게 기록

### 1.2 사용 예시
- "오늘은 조깅 30분 했다"
- "스트레칭 10분"
- "등산 2시간"
- "요가 클래스 참여"

---

## 2. 데이터베이스 설계

### 2.1 테이블 구조 변경

#### `workout_records` 테이블에 컬럼 추가

```sql
-- 텍스트 기록 여부를 나타내는 플래그
ALTER TABLE workout_records 
ADD COLUMN is_text_record BOOLEAN DEFAULT FALSE;

-- 텍스트 내용 (운동 종류 선택 없이 입력한 텍스트)
ALTER TABLE workout_records 
ADD COLUMN text_content TEXT;

-- 인덱스 추가 (텍스트 기록 조회 최적화)
CREATE INDEX idx_workout_records_is_text_record 
ON workout_records(is_text_record) 
WHERE is_text_record = TRUE;
```

#### 데이터 구조

**기존 구조 (운동 종류 기반)**:
- `workout_type_id`: 운동 종류 ID (필수)
- `duration_minutes`: 시간 (시간 타입인 경우)
- `sets`: 세트 정보 (세트 타입인 경우)
- `notes`: 메모 (선택)

**새로운 구조 (텍스트 기록)**:
- `is_text_record`: `TRUE` (텍스트 기록임을 표시)
- `workout_type_id`: `NULL` (운동 종류 없음)
- `text_content`: 사용자가 입력한 텍스트 (예: "조깅 30분")
- `duration_minutes`: `NULL` (선택사항, 텍스트에서 파싱 가능하지만 필수 아님)
- `sets`: 빈 배열
- `notes`: `NULL` 또는 추가 메모

### 2.2 제약 조건

1. **상호 배타적 제약**:
   - `is_text_record = TRUE`인 경우: `workout_type_id`는 `NULL`이어야 함
   - `is_text_record = FALSE`인 경우: `workout_type_id`는 `NOT NULL`이어야 함 (기존 로직)

2. **데이터 무결성**:
   - `is_text_record = TRUE`이고 `text_content`가 `NULL`이면 안 됨
   - `is_text_record = TRUE`이면 `sets`는 빈 배열이어야 함

---

## 3. UI/UX 설계

### 3.1 운동기록 추가 흐름

#### 옵션 1: 별도 버튼 추가 (추천)
```
[운동 추가] 버튼 (기존)
[텍스트로 기록] 버튼 (신규) ← 새로 추가
```

**장점**:
- 기존 흐름과 명확히 구분
- 사용자가 의도를 명확히 선택 가능
- UI가 직관적

**단점**:
- 버튼이 하나 더 추가됨

#### 옵션 2: 기존 모달에 옵션 추가
```
운동 선택 모달에서:
- 운동 목록
- [텍스트로 기록하기] 옵션 (목록 맨 위 또는 맨 아래)
```

**장점**:
- 버튼 추가 없이 구현 가능
- 기존 UI 구조 유지

**단점**:
- 운동 선택 모달을 열어야 함 (단계가 하나 더)
- 텍스트 기록이 운동 목록과 혼동될 수 있음

### 3.2 텍스트 입력 모달

**모달 구조**:
```
┌─────────────────────────────┐
│ 텍스트로 운동 기록          │
│ 날짜: 2026.1.15            │
├─────────────────────────────┤
│                             │
│ 운동 내용을 입력하세요      │
│ ┌─────────────────────────┐ │
│ │ 조깅 30분                │ │
│ │                         │ │
│ └─────────────────────────┘ │
│                             │
│ [취소]        [등록]        │
└─────────────────────────────┘
```

**입력 필드**:
- 날짜 선택 (기본값: 오늘)
- 텍스트 입력 (textarea, 최대 길이 제한: 예: 500자)
- 플레이스홀더: "예: 조깅 30분, 스트레칭 10분"

### 3.3 운동기록 목록 표시

**기존 운동기록 카드**:
```
┌─────────────────────────────┐
│ 스쿼트              [수정]  │
│ 1세트: 100kg × 10회 [✓]     │
│ 2세트: 100kg × 10회 [✓]     │
└─────────────────────────────┘
```

**텍스트 기록 카드** (새로운 스타일):
```
┌─────────────────────────────┐
│ 📝 텍스트 기록      [수정]   │
│ 조깅 30분                    │
└─────────────────────────────┘
```

또는 아이콘 없이:
```
┌─────────────────────────────┐
│ 📝 조깅 30분        [수정]   │
└─────────────────────────────┘
```

**차이점**:
- 운동 종류 이름 대신 텍스트 내용 표시
- 세트/시간 정보 없음
- 아이콘으로 텍스트 기록임을 표시 (선택사항)

### 3.4 수정 모달

**텍스트 기록 수정 시**:
- 기존 운동 수정 모달과 동일하지만
- 운동 종류 선택 없이 텍스트만 수정
- 날짜 변경 가능

---

## 4. API 설계

### 4.1 운동기록 추가 API

**기존 엔드포인트 재사용**: `POST /api/workout-records`

**요청 본문** (텍스트 기록):
```json
{
  "app_user_id": "uuid",
  "workout_date": "2026-01-15",
  "is_text_record": true,
  "text_content": "조깅 30분",
  "workout_type_id": null,
  "duration_minutes": null,
  "sets": [],
  "notes": null
}
```

**응답**: 기존과 동일

### 4.2 운동기록 조회 API

**기존 엔드포인트 재사용**: `GET /api/workout-records`

**응답에 추가 필드**:
```json
{
  "id": "uuid",
  "app_user_id": "uuid",
  "workout_date": "2026-01-15",
  "is_text_record": true,
  "text_content": "조깅 30분",
  "workout_type_id": null,
  "workout_type_name": null,
  "workout_type_type": null,
  "duration_minutes": null,
  "sets": [],
  "notes": null,
  "is_completed": false,
  "display_order": 1,
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-15T10:00:00Z"
}
```

### 4.3 운동기록 수정 API

**기존 엔드포인트 재사용**: `PATCH /api/workout-records/:id`

**요청 본문** (텍스트 기록 수정):
```json
{
  "app_user_id": "uuid",
  "workout_date": "2026-01-15",
  "is_text_record": true,
  "text_content": "조깅 40분",
  "workout_type_id": null,
  "duration_minutes": null,
  "sets": [],
  "notes": null
}
```

---

## 5. 백엔드 구현

### 5.1 데이터베이스 마이그레이션

**파일**: `backend/workout-records-db.js`

**함수 추가**:
```javascript
const migrateWorkoutRecordsTableForTextRecords = async () => {
  try {
    // is_text_record 컬럼 추가
    const checkIsTextRecord = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'workout_records' 
        AND column_name = 'is_text_record'
    `);
    
    if (checkIsTextRecord.rows.length === 0) {
      await pool.query(`
        ALTER TABLE workout_records 
        ADD COLUMN is_text_record BOOLEAN DEFAULT FALSE
      `);
      console.log('[PostgreSQL] is_text_record 컬럼이 추가되었습니다.');
    }
    
    // text_content 컬럼 추가
    const checkTextContent = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'workout_records' 
        AND column_name = 'text_content'
    `);
    
    if (checkTextContent.rows.length === 0) {
      await pool.query(`
        ALTER TABLE workout_records 
        ADD COLUMN text_content TEXT
      `);
      console.log('[PostgreSQL] text_content 컬럼이 추가되었습니다.');
    }
    
    // 인덱스 추가
    const checkIndex = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'workout_records' 
        AND indexname = 'idx_workout_records_is_text_record'
    `);
    
    if (checkIndex.rows.length === 0) {
      await pool.query(`
        CREATE INDEX idx_workout_records_is_text_record 
        ON workout_records(is_text_record) 
        WHERE is_text_record = TRUE
      `);
      console.log('[PostgreSQL] is_text_record 인덱스가 추가되었습니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] 텍스트 기록 마이그레이션 오류:', error);
    throw error;
  }
};
```

### 5.2 데이터 검증 로직

**추가 함수**: `validateWorkoutRecord`

```javascript
const validateWorkoutRecord = (record) => {
  const { is_text_record, text_content, workout_type_id } = record;
  
  // 텍스트 기록인 경우
  if (is_text_record === true) {
    if (!text_content || text_content.trim() === '') {
      throw new Error('텍스트 기록은 내용이 필수입니다.');
    }
    if (workout_type_id !== null && workout_type_id !== undefined) {
      throw new Error('텍스트 기록은 운동 종류를 가질 수 없습니다.');
    }
  } else {
    // 일반 기록인 경우
    if (!workout_type_id) {
      throw new Error('운동 종류는 필수입니다.');
    }
    if (text_content) {
      throw new Error('일반 기록은 텍스트 내용을 가질 수 없습니다.');
    }
  }
};
```

### 5.3 CRUD 함수 수정

**`addWorkoutRecord` 함수**:
- `is_text_record`, `text_content` 필드 처리 추가
- 검증 로직 추가

**`updateWorkoutRecord` 함수**:
- 텍스트 기록 수정 지원
- 텍스트 기록에서 일반 기록으로 변경 시 검증

**`getWorkoutRecords` 함수**:
- `is_text_record`, `text_content` 필드 포함하여 반환

---

## 6. 프론트엔드 구현

### 6.1 텍스트 기록 추가 모달

**파일**: `public/js/app-user/workout/add.js`

**새 함수 추가**:
```javascript
export async function showTextRecordModal(appUserId, selectedDate = null, onSuccess) {
  // 모달 생성 및 표시
  // 날짜 선택
  // 텍스트 입력 (textarea)
  // 등록 버튼
}
```

**버튼 추가 위치**:
- `public/js/app-user/workout/index.js` 또는
- `public/js/app-user/dashboard.js`의 운동기록 추가 버튼 옆

### 6.2 운동기록 목록 렌더링 수정

**파일**: `public/js/app-user/workout/list.js`

**`renderWorkoutItem` 함수 수정**:
```javascript
function renderWorkoutItem(record) {
  // 텍스트 기록인 경우
  if (record.is_text_record) {
    return `
      <div class="app-workout-item app-workout-item-text">
        <div class="app-workout-item-main">
          <div class="app-workout-item-type-container">
            <div class="app-workout-item-drag-handle">...</div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <div class="app-workout-item-type">📝 ${escapeHtml(record.text_content)}</div>
              <button class="app-workout-item-edit-btn">...</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  // 기존 로직 (운동 종류 기반)
  // ...
}
```

### 6.3 수정 모달 수정

**파일**: `public/js/app-user/workout/edit.js`

**텍스트 기록 수정 지원**:
- 텍스트 기록인 경우 운동 종류 선택 UI 숨김
- 텍스트 입력 필드만 표시

---

## 7. 구현 우선순위

### Phase 1: 기본 기능
1. 데이터베이스 마이그레이션 (컬럼 추가)
2. 백엔드 API 수정 (추가/수정/조회)
3. 텍스트 기록 추가 모달
4. 운동기록 목록에 텍스트 기록 표시

### Phase 2: 개선
1. 텍스트 기록 수정 기능
2. 텍스트 기록 삭제 기능
3. 텍스트 기록 완료 체크 (선택사항)
4. UI/UX 개선 (아이콘, 스타일)

---

## 8. 고려사항

### 8.1 기존 데이터 호환성
- 기존 운동기록은 `is_text_record = FALSE`로 설정
- 기존 API 응답에 `is_text_record`, `text_content` 필드 추가 (기존 기록은 `null`)

### 8.2 검색 기능 (향후 확장)
- 텍스트 기록도 검색 가능하도록 `text_content` 필드 인덱싱 고려

### 8.3 통계 기능 (향후 확장)
- 텍스트 기록은 통계에서 제외하거나 별도 카테고리로 분류

### 8.4 완료 체크 기능
- 텍스트 기록도 완료 체크 가능하게 할지 결정
- 기본적으로는 완료 체크 없이 기록만 남기는 용도

---

## 9. 예상 이슈 및 해결 방안

### 9.1 텍스트 기록과 일반 기록 혼용
- **이슈**: 같은 날짜에 텍스트 기록과 일반 기록이 섞여 있을 때 정렬
- **해결**: `display_order`로 통일 관리, 생성 시간 순서로 정렬

### 9.2 텍스트 기록 수정 시 운동 종류로 변경
- **이슈**: 텍스트 기록을 수정할 때 운동 종류를 선택하고 싶은 경우
- **해결**: 수정 모달에서 "운동 종류로 변환" 옵션 제공 (Phase 2)

---

## 10. 테스트 시나리오

1. **텍스트 기록 추가**
   - 텍스트 기록 모달 열기
   - 텍스트 입력 후 등록
   - 목록에 텍스트 기록 표시 확인

2. **텍스트 기록 수정**
   - 텍스트 기록 수정 버튼 클릭
   - 텍스트 수정 후 저장
   - 변경사항 반영 확인

3. **텍스트 기록 삭제**
   - 텍스트 기록 삭제
   - 목록에서 제거 확인

4. **혼합 표시**
   - 같은 날짜에 텍스트 기록과 일반 기록 추가
   - 정렬 순서 확인

---

## 11. UI 스타일 가이드

### 11.1 텍스트 기록 카드 스타일

```css
.app-workout-item-text {
  /* 텍스트 기록 전용 스타일 */
  border-left: 3px solid #4CAF50; /* 구분을 위한 색상 */
}

.app-workout-item-text .app-workout-item-type {
  /* 텍스트 내용 스타일 */
  font-style: italic; /* 선택사항 */
}
```

---

## 12. 마이그레이션 체크리스트

- [ ] 데이터베이스 마이그레이션 스크립트 작성
- [ ] 백엔드 검증 로직 추가
- [ ] 백엔드 CRUD 함수 수정
- [ ] 프론트엔드 텍스트 기록 추가 모달
- [ ] 프론트엔드 목록 렌더링 수정
- [ ] 프론트엔드 수정 모달 수정
- [ ] 테스트 및 버그 수정
