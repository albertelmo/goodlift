# 상담기록 공개 조회 기능 설계

## 1. 개요

상담회원에게 링크를 전송하면, 해당 회원이 본인의 상담 기록을 볼 수 있는 공개 웹페이지 기능을 구현합니다.

### 핵심 요구사항
- 상담회원이 본인의 상담기록만 조회 가능
- 링크 기반 접근 (별도 로그인 불필요)
- 보안: 토큰 기반 인증으로 무단 접근 방지
- 모바일 친화적 UI

---

## 2. 데이터베이스 설계

### 2.1 공유 토큰 테이블: `consultation_share_tokens`

상담기록에 대한 공유 링크를 생성하고 관리하는 테이블입니다.

```sql
CREATE TABLE consultation_share_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_record_id UUID NOT NULL REFERENCES consultation_records(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,  -- 공유 토큰 (URL에 사용)
  name VARCHAR(100) NOT NULL,         -- 회원 이름 (검증용)
  phone VARCHAR(50),                  -- 회원 연락처 (검증용, 선택)
  expires_at TIMESTAMP,               -- 만료 시간 (NULL이면 만료 없음)
  access_count INTEGER DEFAULT 0,     -- 접근 횟수
  last_accessed_at TIMESTAMP,         -- 마지막 접근 시간
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),            -- 토큰 생성자 (trainer_username)
  is_active BOOLEAN DEFAULT true      -- 활성화 여부
);

-- 인덱스
CREATE INDEX idx_share_tokens_token ON consultation_share_tokens(token);
CREATE INDEX idx_share_tokens_consultation_id ON consultation_share_tokens(consultation_record_id);
CREATE INDEX idx_share_tokens_expires_at ON consultation_share_tokens(expires_at);
```

### 2.2 토큰 생성 규칙

- **토큰 형식**: `[consultation_record_id의 첫 8자]-[랜덤 32자 hex]` (총 40자)
  - 예: `a1b2c3d4-5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1`
- **만료 시간**: 기본 90일 (설정 가능)
- **검증 정보**: `name` 필수, `phone` 선택 (둘 다 일치해야 접근 가능)

---

## 3. API 설계

### 3.1 공유 링크 생성 (관리자 전용)

**POST `/api/consultation-records/:id/share`**

관리자가 상담기록에 대한 공유 링크를 생성합니다.

**Request:**
```json
{
  "currentUser": "admin_username",
  "name": "홍길동",           // 필수: 회원 이름
  "phone": "010-1234-5678",  // 선택: 연락처 (없으면 null)
  "expiresInDays": 90        // 선택: 만료일 (기본 90일)
}
```

**Response:**
```json
{
  "token": "a1b2c3d4-5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1",
  "shareUrl": "https://goodlift.onrender.com/consultation/view/a1b2c3d4-5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1",
  "expiresAt": "2024-04-15T12:00:00+09:00"
}
```

**링크 생성 로직:**
1. 백엔드에서 토큰 생성: `crypto.randomBytes(32).toString('hex')` (64자 hex)
2. 토큰을 DB에 저장 (`consultation_share_tokens` 테이블)
3. 전체 URL 생성:
   ```javascript
   const baseUrl = process.env.PUBLIC_URL || `https://${req.get('host')}`;
   const shareUrl = `${baseUrl}/consultation/view/${token}`;
   ```
4. 환경 변수 `PUBLIC_URL`이 설정되어 있으면 사용, 없으면 요청의 호스트 정보 사용
   - Render 환경: `PUBLIC_URL=https://goodlift.onrender.com` (환경 변수로 설정 권장)
   - 로컬 개발: 자동으로 `http://localhost:포트번호` 사용

**권한:** `admin` / `su` / `trainer` (본인이 작성한 상담기록만)

---

### 3.2 공유 링크 조회 (공개)

**GET `/api/public/consultation/:token`**

토큰으로 상담기록을 조회합니다. 인증 없이 접근 가능하지만, 토큰 검증이 필요합니다.

**Request:**
- URL 파라미터: `token`

**Response (성공):**
```json
{
  "consultation": {
    "id": "uuid",
    "name": "홍길동",
    "created_at": "2024-01-15T10:30:00+09:00",
    "trainer_username": "trainer1",
    "center": "강남점",
    // ... 기타 상담기록 필드
  },
  "shareInfo": {
    "expiresAt": "2024-04-15T12:00:00+09:00",
    "accessCount": 3
  }
}
```

**Response (실패):**
```json
{
  "error": "INVALID_TOKEN" | "EXPIRED_TOKEN" | "TOKEN_DISABLED" | "NOT_FOUND"
}
```

**검증 로직:**
1. 토큰 존재 여부 확인
2. `is_active = true` 확인
3. `expires_at` 확인 (NULL이면 만료 없음)
4. `access_count` 증가, `last_accessed_at` 업데이트

---

### 3.3 공유 링크 목록 조회 (관리자 전용)

**GET `/api/consultation-records/:id/shares`**

특정 상담기록에 대한 모든 공유 링크 목록을 조회합니다.

**Request:**
- Query: `currentUser` (필수)

**Response:**
```json
{
  "shares": [
    {
      "id": "uuid",
      "token": "a1b2c3d4-...",
      "name": "홍길동",
      "phone": "010-1234-5678",
      "expiresAt": "2024-04-15T12:00:00+09:00",
      "accessCount": 3,
      "lastAccessedAt": "2024-01-20T14:30:00+09:00",
      "createdAt": "2024-01-15T10:30:00+09:00",
      "isActive": true
    }
  ]
}
```

---

### 3.4 공유 링크 비활성화 (관리자 전용)

**PATCH `/api/consultation-shares/:shareId`**

공유 링크를 비활성화합니다.

**Request:**
```json
{
  "currentUser": "admin_username",
  "isActive": false
}
```

**Response:**
```json
{
  "message": "공유 링크가 비활성화되었습니다."
}
```

---

### 3.5 공유 링크 삭제 (관리자 전용)

**DELETE `/api/consultation-shares/:shareId`**

공유 링크를 완전히 삭제합니다.

**Request:**
- Body: `{ "currentUser": "admin_username" }`

**Response:**
```json
{
  "message": "공유 링크가 삭제되었습니다."
}
```

---

## 4. 프론트엔드 설계

### 4.1 관리자 화면: 공유 링크 생성

**위치:** 상담기록 수정 모달 또는 상담기록 목록

**UI 구성:**
1. **공유 링크 생성 버튼**
   - 위치: 상담기록 수정 모달 하단 또는 목록의 각 행에 "공유" 버튼
   - 클릭 시: 공유 링크 생성 모달 오픈

2. **공유 링크 생성 모달**
   ```
   ┌─────────────────────────────────┐
   │ 상담기록 공유 링크 생성          │
   ├─────────────────────────────────┤
   │ 회원 이름: [홍길동] (자동 입력)  │
   │ 연락처: [010-1234-5678] (선택)  │
   │ 만료일: [90일 후] (드롭다운)     │
   │                                 │
   │ [취소] [생성]                   │
   └─────────────────────────────────┘
   ```

3. **생성 완료 모달**
   ```
   ┌─────────────────────────────────┐
   │ 공유 링크가 생성되었습니다        │
   ├─────────────────────────────────┤
   │ 링크:                            │
   │ https://.../consultation/view/...│
   │ [복사]                           │
   │                                 │
   │ 만료일: 2024-04-15               │
   │                                 │
   │ [닫기]                           │
   └─────────────────────────────────┘
   ```

4. **공유 링크 관리**
   - 상담기록 상세에서 "공유 링크 관리" 버튼
   - 생성된 링크 목록 표시 (토큰, 만료일, 접근 횟수)
   - 각 링크에 "비활성화", "삭제" 버튼

---

### 4.2 공개 조회 페이지: `/consultation/view/:token`

**파일:** `public/consultation-view.html` (또는 기존 `index.html`에 라우팅 추가)

**UI 구성:**

```
┌─────────────────────────────────────┐
│  [로고] 상담기록 조회                │
├─────────────────────────────────────┤
│                                     │
│  상담일시: 2024년 1월 15일 10:30    │
│  센터: 강남점                        │
│  담당 트레이너: 김트레이너           │
│                                     │
│  ┌─ 기본정보 ───────────────────┐   │
│  │ 이름: 홍길동                  │   │
│  │ 연락처: 010-1234-5678        │   │
│  │ 성별: 남성                    │   │
│  │ 연령대: 30대                  │   │
│  └──────────────────────────────┘   │
│                                     │
│  ┌─ 상담목적 ───────────────────┐   │
│  │ 체력증진                       │   │
│  └──────────────────────────────┘   │
│                                     │
│  ┌─ 신체검사 ───────────────────┐   │
│  │ 인바디: ...                   │   │
│  │ 오버헤드스쿼트: ...           │   │
│  └──────────────────────────────┘   │
│                                     │
│  ┌─ 상담정리 ───────────────────┐   │
│  │ 종합평가: ...                 │   │
│  └──────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

**특징:**
- 반응형 디자인 (모바일 최적화)
- 인쇄 가능한 레이아웃
- 민감한 정보는 마스킹 처리 (선택사항)

---

### 4.3 JavaScript 파일

**파일:** `public/js/consultation-share.js`

**주요 함수:**
- `generateShareLink(consultationId, name, phone, expiresInDays)` - 공유 링크 생성
- `copyToClipboard(text)` - 링크 복사
- `loadPublicConsultation(token)` - 공개 상담기록 로드
- `formatConsultationData(data)` - 상담기록 데이터 포맷팅

---

## 5. 보안 고려사항

### 5.1 토큰 보안
- **토큰 길이**: 최소 40자 (충분한 엔트로피)
- **토큰 생성**: `crypto.randomBytes(32).toString('hex')` 사용
- **토큰 검증**: DB에서 직접 조회하여 검증 (SQL Injection 방지)

### 5.2 접근 제어
- **만료 시간**: 기본 90일, 관리자가 설정 가능
- **비활성화**: 관리자가 언제든지 링크 비활성화 가능
- **접근 로그**: `access_count`, `last_accessed_at` 기록

### 5.3 데이터 보호
- **읽기 전용**: 공개 페이지는 조회만 가능 (수정/삭제 불가)
- **개인정보**: 필요시 연락처 마스킹 처리 가능
- **HTTPS**: 프로덕션 환경에서는 HTTPS 필수

---

## 6. 구현 단계

### Phase 1: 데이터베이스 및 백엔드
1. `consultation_share_tokens` 테이블 생성
2. `consultation-shares-db.js` 모듈 생성
3. 공유 링크 생성/조회/비활성화/삭제 API 구현
4. 공개 조회 API 구현 (`/api/public/consultation/:token`)

### Phase 2: 관리자 프론트엔드
1. 상담기록 수정 모달에 "공유 링크 생성" 버튼 추가
2. 공유 링크 생성 모달 구현
3. 공유 링크 관리 UI 구현
4. 링크 복사 기능 구현

### Phase 3: 공개 조회 페이지
1. `public/consultation-view.html` 생성
2. `public/js/consultation-view.js` 생성
3. `public/css/consultation-view.css` 생성
4. 반응형 디자인 적용

### Phase 4: 테스트 및 최적화
1. 보안 테스트
2. 모바일 테스트
3. 성능 최적화
4. 문서화

---

## 7. 파일 구조

```
backend/
  ├── consultation-shares-db.js      # 공유 토큰 DB 모듈
  └── server.js                      # API 엔드포인트 추가

public/
  ├── consultation-view.html         # 공개 조회 페이지
  ├── js/
  │   ├── consultation-share.js     # 공유 링크 관리 (관리자)
  │   └── consultation-view.js      # 공개 조회 페이지 로직
  └── css/
      └── consultation-view.css     # 공개 조회 페이지 스타일
```

---

## 8. 추가 고려사항

### 8.1 이메일/SMS 전송
- 공유 링크 생성 시 자동으로 회원에게 전송 (선택사항)
- 이메일 템플릿 또는 SMS 템플릿 필요

### 8.2 다중 상담기록 공유
- 한 회원의 모든 상담기록을 하나의 링크로 공유 (향후 확장)

### 8.3 접근 통계
- 공유 링크별 접근 통계 대시보드 (관리자용)

### 8.4 만료 알림
- 만료 예정 링크에 대한 알림 (관리자용)

---

## 9. 예시 사용 시나리오

1. **관리자가 상담기록 공유 링크 생성**
   - 상담기록 수정 모달에서 "공유 링크 생성" 클릭
   - 회원 이름 입력 (자동 완성)
   - 연락처 입력 (선택)
   - 만료일 선택 (기본 90일)
   - "생성" 클릭 → 링크 생성 완료

2. **링크 복사 및 전송**
   - 생성된 링크를 복사
   - 카카오톡/이메일/SMS로 회원에게 전송

3. **회원이 링크 접근**
   - 링크 클릭 → 공개 조회 페이지 로드
   - 상담기록 내용 확인
   - 인쇄 또는 스크린샷 저장 가능

4. **관리자가 링크 관리**
   - 상담기록 상세에서 "공유 링크 관리" 클릭
   - 생성된 링크 목록 확인
   - 필요시 비활성화 또는 삭제

---

## 10. 보안 체크리스트

- [ ] 토큰은 충분히 길고 랜덤하게 생성
- [ ] 토큰은 DB에 해시로 저장하지 않음 (URL에 노출되므로)
- [ ] 만료 시간 검증 구현
- [ ] 비활성화 토큰 접근 차단
- [ ] SQL Injection 방지 (파라미터화된 쿼리)
- [ ] XSS 방지 (출력 데이터 이스케이프)
- [ ] HTTPS 사용 (프로덕션)
- [ ] 접근 로그 기록
- [ ] Rate Limiting 고려 (선택사항)
