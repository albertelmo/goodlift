# 상담기록 사진 업로드 기능 설계

## 개요
상담기록에 동영상과 동일한 방식으로 사진을 업로드할 수 있는 기능을 추가합니다.

## 데이터베이스 설계

### 1. 테이블 스키마 변경
- **테이블**: `consultation_records`
- **추가 필드**: `image_urls JSONB`
- **용도**: 사진 메타데이터를 JSON 배열로 저장
  ```json
  [
    {
      "id": "uuid",
      "url": "/uploads/consultation-images/2026/01/{consultation_id}/{image_id}.jpg",
      "filename": "사진이름.jpg",
      "file_size": 1234567,
      "mime_type": "image/jpeg",
      "uploaded_at": "2026-01-15T10:30:00.000Z",
      "uploaded_by": "trainer_username",
      "updated_at": "2026-01-15T10:30:00.000Z"
    }
  ]
  ```

### 2. 마이그레이션
- `consultation-records-db.js`의 `migrateConsultationRecordsTable()` 함수에 `image_urls` 컬럼 추가 로직 포함
- 기존 테이블에 컬럼이 없으면 자동으로 추가

## 파일 저장 구조

### 디렉토리 구조
```
data/uploads/consultation-images/
  └── {year}/
      └── {month}/
          └── {consultation_id}/
              └── {image_id}.{ext}
```

### 예시
```
data/uploads/consultation-images/2026/01/cdad40a0-a243-4345-ab57-5789a9b9d91b/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg
```

## 백엔드 API 설계

### 1. 사진 업로드 API
**엔드포인트**: `POST /api/consultation-records/:id/images`

**요청**:
- Content-Type: `multipart/form-data`
- Body:
  - `file`: 이미지 파일 (필수)
  - `currentUser`: 현재 사용자명 (필수)

**응답**:
```json
{
  "image": {
    "id": "uuid",
    "url": "/uploads/consultation-images/2026/01/{consultation_id}/{image_id}.jpg",
    "filename": "원본파일명.jpg",
    "file_size": 1234567,
    "mime_type": "image/jpeg",
    "uploaded_at": "2026-01-15T10:30:00.000Z",
    "uploaded_by": "trainer_username"
  }
}
```

**기능**:
- 최대 업로드 개수 제한 (환경변수: `CONSULTATION_IMAGE_MAX_COUNT`, 기본값: 10개)
- 권한 확인 (admin/su 또는 해당 상담기록의 담당 트레이너)
- 파일 저장 및 메타데이터 생성
- `image_urls` 배열에 추가

**에러 처리**:
- 400: 파일 미선택, 최대 개수 초과
- 401: 인증 실패
- 403: 권한 없음
- 404: 상담기록 없음
- 500: 서버 오류

### 2. 사진 이름 수정 API
**엔드포인트**: `PATCH /api/consultation-records/:id/images/:imageId`

**요청**:
```json
{
  "currentUser": "trainer_username",
  "filename": "새로운 사진 이름.jpg"
}
```

**응답**:
```json
{
  "message": "사진 이름이 업데이트되었습니다.",
  "image": {
    "id": "uuid",
    "url": "...",
    "filename": "새로운 사진 이름.jpg",
    ...
  }
}
```

**기능**:
- 권한 확인
- `image_urls` 배열에서 해당 이미지 찾기
- `filename` 및 `updated_at` 업데이트

### 3. 사진 삭제 API
**엔드포인트**: `DELETE /api/consultation-records/:id/images/:imageId`

**요청**:
```json
{
  "currentUser": "trainer_username"
}
```

**응답**:
```json
{
  "message": "사진이 삭제되었습니다."
}
```

**기능**:
- 권한 확인
- 파일 시스템에서 실제 파일 삭제
- `image_urls` 배열에서 해당 이미지 제거

## 프론트엔드 설계

### 1. UI 구성
**위치**: 상담기록 편집 모달 내 동영상 섹션 아래

**구성 요소**:
- 사진 업로드 버튼 (파일 선택)
- 사진 목록 표시 영역
- 각 사진 항목:
  - 사진 썸네일 (작은 크기)
  - 사진 이름 (클릭 시 수정 가능)
  - 파일 크기 및 업로드 날짜
  - 삭제 버튼

### 2. JavaScript 함수

#### `handleImageUpload(e, consultationId)`
- 파일 선택 시 호출
- FormData 생성 및 업로드
- 업로드 성공 시 목록 새로고침

#### `loadConsultationImages(consultationId)`
- 상담기록의 사진 목록 조회
- UI에 사진 목록 렌더링
- 사진 이름 클릭 이벤트 바인딩

#### `updateConsultationImageName(consultationId, imageId, newName)`
- 사진 이름 수정 API 호출
- 성공 시 목록 새로고침

#### `deleteConsultationImage(consultationId, imageId)`
- 삭제 확인 후 API 호출
- 성공 시 목록 새로고침
- `window.deleteConsultationImage`로 전역 등록

### 3. HTML 구조
```html
<!-- 사진 섹션 -->
<div class="consultation-section">
    <div class="consultation-section-title">사진</div>
    <input type="file" id="consultation-image-input" accept="image/*" multiple style="display: none;">
    <button type="button" class="tmc-btn-secondary" onclick="document.getElementById('consultation-image-input').click();">
        사진 추가
    </button>
    <div id="consultation-image-list" style="margin-top: 12px;"></div>
</div>
```

### 4. 스타일링
- 동영상 섹션과 동일한 스타일 적용
- 사진 썸네일: 최대 너비 100px, 높이 자동
- 사진 목록 항목: 동영상과 동일한 레이아웃

## 공개상담지 페이지 설계

### 1. 사진 표시
**위치**: 동영상 섹션 아래 또는 별도 섹션

**표시 방식**:
- 썸네일 그리드 레이아웃
- 클릭 시 원본 크기로 확대 (모달 또는 새 창)
- 각 사진 아래 이름 표시

### 2. 모바일 최적화
- 그리드: 데스크탑 3열, 모바일 2열
- 썸네일 크기: 최대 너비 150px (모바일)

## 환경변수

### `CONSULTATION_IMAGE_MAX_COUNT`
- 기본값: `4`
- 상담기록당 최대 업로드 가능한 사진 개수

## 구현 순서

1. **데이터베이스 마이그레이션**
   - `consultation-records-db.js`에 `image_urls` 컬럼 추가 로직 구현

2. **백엔드 API 구현**
   - `CONSULTATION_IMAGES_DIR` 상수 정의
   - 사진 업로드 API (`POST /api/consultation-records/:id/images`)
   - 사진 이름 수정 API (`PATCH /api/consultation-records/:id/images/:imageId`)
   - 사진 삭제 API (`DELETE /api/consultation-records/:id/images/:imageId`)

3. **프론트엔드 UI 구현**
   - 상담기록 편집 모달에 사진 섹션 추가
   - 사진 업로드 및 목록 표시 함수 구현
   - 사진 이름 수정 및 삭제 기능 구현

4. **공개상담지 페이지 구현**
   - `consultation-view.js`에 사진 표시 로직 추가
   - `consultation-view.html`에 사진 섹션 스타일 추가

5. **테스트**
   - 사진 업로드/수정/삭제 기능 테스트
   - 권한 확인 테스트
   - 공개상담지 페이지 사진 표시 테스트

## 참고사항

- 동영상 업로드 기능과 완전히 동일한 패턴으로 구현
- 파일 크기 제한은 서버 설정에 따름 (multer 설정)
- 지원 이미지 형식: jpg, jpeg, png, gif, webp 등 (브라우저 지원 형식)
- 사진은 썸네일로 표시하되, 클릭 시 원본 보기 가능하도록 구현 권장
