# 트레이너 프로필 사진 등록 기능 설계 문서

## 📋 기능 개요
트레이너의 프로필 사진을 등록하고, 관리할 수 있는 기능입니다. 관리자와 su 유저는 모든 트레이너의 프로필 사진을 등록/수정/삭제할 수 있고, 트레이너 본인도 자신의 프로필 사진을 등록/수정/삭제할 수 있습니다.

---

## 🗄️ 데이터 구조 설계

### 1. accounts.json 필드 추가
**파일**: `data/accounts.json`

트레이너 계정 객체에 `profile_image_url` 필드를 추가합니다.

```json
{
  "username": "shk",
  "password": "123",
  "name": "김성현",
  "role": "trainer",
  "vip_member": false,
  "30min_session": "on",
  "profile_image_url": "/uploads/trainer-profiles/2025/01/uuid/image.jpg"
}
```

**필드 설명**:
- `profile_image_url` (선택): 프로필 사진 파일 경로 (상대 경로)
  - 형식: `/uploads/trainer-profiles/{year}/{month}/{uuid}/{filename}`
  - 없으면 기본 아바타 표시

---

## 📁 파일 저장 구조

### 디렉토리 구조
```
data/
  uploads/
    trainer-profiles/
      2025/
        01/
          {uuid}/
            image.jpg
```

**파일명 규칙**:
- UUID 기반 디렉토리: 각 트레이너마다 고유한 UUID 디렉토리 생성
- 파일명: 원본 파일명 유지 또는 `profile.{ext}` 형식
- 지원 형식: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- 최대 파일 크기: 5MB

---

## 🔌 백엔드 API 설계

### 1. 프로필 사진 업로드 API
**POST** `/api/trainers/:username/profile-image`

**권한**: 
- 관리자/SU: 모든 트레이너의 프로필 사진 업로드 가능
- 트레이너: 본인의 프로필 사진만 업로드 가능

**Request**:
- Content-Type: `multipart/form-data`
- Form Data:
  - `image`: 이미지 파일 (필수)

**Response (성공 - 200)**:
```json
{
  "message": "프로필 사진이 업로드되었습니다.",
  "profile_image_url": "/uploads/trainer-profiles/2025/01/uuid/image.jpg"
}
```

**Response (에러)**:
- 400: 파일이 없거나 잘못된 형식
- 403: 권한 없음
- 404: 트레이너를 찾을 수 없음
- 500: 서버 오류

**동작**:
1. 권한 확인 (관리자/SU 또는 본인)
2. 트레이너 존재 확인
3. 파일 유효성 검사 (형식, 크기)
4. 기존 프로필 사진이 있으면 삭제
5. 새 파일 저장 (UUID 디렉토리 생성)
6. accounts.json에 `profile_image_url` 업데이트
7. 업로드된 파일 URL 반환

---

### 2. 프로필 사진 삭제 API
**DELETE** `/api/trainers/:username/profile-image`

**권한**: 
- 관리자/SU: 모든 트레이너의 프로필 사진 삭제 가능
- 트레이너: 본인의 프로필 사진만 삭제 가능

**Request Body**:
```json
{
  "currentUser": "admin_username"
}
```

**Response (성공 - 200)**:
```json
{
  "message": "프로필 사진이 삭제되었습니다."
}
```

**동작**:
1. 권한 확인
2. 트레이너 존재 확인
3. 기존 프로필 사진 파일 삭제
4. accounts.json에서 `profile_image_url` 필드 제거 또는 null로 설정

---

### 3. 트레이너 목록 조회 API (기존 수정)
**GET** `/api/trainers`

**변경 사항**: 응답에 `profile_image_url` 필드 추가

**Response**:
```json
[
  {
    "username": "shk",
    "name": "김성현",
    "role": "trainer",
    "vip_member": false,
    "30min_session": "on",
    "profile_image_url": "/uploads/trainer-profiles/2025/01/uuid/image.jpg"
  }
]
```

---

## 🎨 프론트엔드 UI 설계

### 1. 트레이너 목록 화면 (관리자)
**파일**: `public/js/trainer.js`

**변경 사항**:
- 테이블에 "프로필 사진" 컬럼 추가
- 각 행에 프로필 사진 썸네일 표시 (50x50px)
- 프로필 사진 클릭 시 업로드 모달 열기

**UI 구조**:
```
┌─────────────────────────────────────────────────────────┐
│ 아이디 │ 이름 │ VIP 기능 │ 30분 세션 │ 프로필 사진 │ 삭제 │
├─────────────────────────────────────────────────────────┤
│ shk    │ 김성현│   ON    │    ON     │  [사진]     │ 삭제 │
└─────────────────────────────────────────────────────────┘
```

---

### 2. 프로필 사진 업로드 모달 (이미지 크롭 기능 포함)
**위치**: 트레이너 목록 화면 또는 트레이너 상세 화면

**모달 구조**:
```
┌─────────────────────────────────────┐
│ 📷 프로필 사진 업로드                 │
├─────────────────────────────────────┤
│ 트레이너: 김성현 (shk)               │
│                                     │
│ [파일 선택] 버튼                     │
│                                     │
│ ┌─────────────────────────────┐   │
│ │                             │   │
│ │   [이미지 크롭 영역]          │   │
│ │   (원형 선택 영역 표시)       │   │
│ │                             │   │
│ └─────────────────────────────┘   │
│                                     │
│ [크롭된 미리보기] (원형)            │
│                                     │
│ [업로드] [취소]                     │
└─────────────────────────────────────┘
```

**기능**:
- 파일 선택 버튼 클릭 시 파일 선택 다이얼로그 열기
- 선택된 이미지를 캔버스에 표시
- 원형 크롭 영역을 드래그하여 이동 가능
- 마우스 휠 또는 핀치 제스처로 크롭 영역 크기 조절
- 크롭된 결과를 원형으로 미리보기 표시
- 업로드 버튼 클릭 시 크롭된 이미지를 원형으로 변환하여 API 호출
- 업로드 성공 시 목록 새로고침

**크롭 기능 상세**:
- 원형 크롭 영역: 최소 크기 100px, 최대 크기 이미지 크기
- 드래그: 마우스로 원형 영역 이동
- 크기 조절: 마우스 휠 또는 핀치 제스처로 확대/축소
- 실시간 미리보기: 크롭 영역 변경 시 즉시 원형 미리보기 업데이트

---

### 3. 트레이너 앱 화면 (선택사항)
**파일**: `public/js/app-user/dashboard.js` 또는 관련 파일

트레이너가 자신의 프로필 사진을 업로드할 수 있는 기능 추가 (향후 확장)

---

## 🛠️ 구현 계획

### Phase 1: 백엔드 구현

#### 1.1 디렉토리 설정
**파일**: `backend/server.js`

```javascript
const TRAINER_PROFILES_DIR = path.join(UPLOADS_DIR, 'trainer-profiles');

// ensureDirectories() 함수에 추가
if (!fs.existsSync(TRAINER_PROFILES_DIR)) {
    fs.mkdirSync(TRAINER_PROFILES_DIR, { recursive: true });
    console.log(`[Trainer Profiles] 프로필 사진 디렉토리 생성: ${TRAINER_PROFILES_DIR}`);
}
```

#### 1.2 Multer 설정
**파일**: `backend/server.js`

```javascript
const trainerProfileUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const uuid = require('crypto').randomUUID();
            const dir = path.join(TRAINER_PROFILES_DIR, String(year), month, uuid);
            fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            if (!allowedExts.includes(ext)) {
                return cb(new Error('지원하지 않는 이미지 형식입니다.'));
            }
            cb(null, `profile${ext}`);
        }
    }),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        if (allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('지원하지 않는 이미지 형식입니다.'));
        }
    }
});
```

#### 1.3 프로필 사진 업로드 API
**파일**: `backend/server.js`

```javascript
app.post('/api/trainers/:username/profile-image', trainerProfileUpload.single('image'), async (req, res) => {
    try {
        const username = req.params.username;
        const currentUser = req.body.currentUser || req.session?.username;
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const currentUserAccount = accounts.find(acc => acc.username === currentUser);
        const trainerAccount = accounts.find(acc => acc.username === username && acc.role === 'trainer');
        
        if (!trainerAccount) {
            // 업로드된 파일이 있으면 삭제
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(404).json({ message: '트레이너를 찾을 수 없습니다.' });
        }
        
        // 권한 확인: 관리자/SU 또는 본인
        if (!isAdminOrSu(currentUserAccount) && currentUser !== username) {
            // 업로드된 파일이 있으면 삭제
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        // 파일 확인
        if (!req.file) {
            return res.status(400).json({ message: '이미지 파일을 선택해주세요.' });
        }
        
        // 기존 프로필 사진 삭제
        if (trainerAccount.profile_image_url) {
            const oldImagePath = path.join(__dirname, '..', trainerAccount.profile_image_url);
            if (fs.existsSync(oldImagePath)) {
                // 디렉토리 전체 삭제
                const oldDir = path.dirname(oldImagePath);
                fs.rmSync(oldDir, { recursive: true, force: true });
            }
        }
        
        // 상대 경로 생성
        const relativePath = req.file.path.replace(path.join(__dirname, '..'), '').replace(/\\/g, '/');
        
        // accounts.json 업데이트
        const trainerIndex = accounts.findIndex(acc => acc.username === username && acc.role === 'trainer');
        accounts[trainerIndex].profile_image_url = relativePath;
        fs.writeFileSync(DATA_PATH, JSON.stringify(accounts, null, 2));
        
        res.json({
            message: '프로필 사진이 업로드되었습니다.',
            profile_image_url: relativePath
        });
    } catch (error) {
        console.error('[API] 프로필 사진 업로드 오류:', error);
        // 업로드된 파일이 있으면 삭제
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) {
                console.error('[API] 파일 삭제 오류:', e);
            }
        }
        res.status(500).json({ message: '프로필 사진 업로드에 실패했습니다.' });
    }
});
```

#### 1.4 프로필 사진 삭제 API
**파일**: `backend/server.js`

```javascript
app.delete('/api/trainers/:username/profile-image', async (req, res) => {
    try {
        const username = req.params.username;
        const { currentUser } = req.body;
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const currentUserAccount = accounts.find(acc => acc.username === currentUser);
        const trainerAccount = accounts.find(acc => acc.username === username && acc.role === 'trainer');
        
        if (!trainerAccount) {
            return res.status(404).json({ message: '트레이너를 찾을 수 없습니다.' });
        }
        
        // 권한 확인: 관리자/SU 또는 본인
        if (!isAdminOrSu(currentUserAccount) && currentUser !== username) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        // 기존 프로필 사진 삭제
        if (trainerAccount.profile_image_url) {
            const oldImagePath = path.join(__dirname, '..', trainerAccount.profile_image_url);
            if (fs.existsSync(oldImagePath)) {
                // 디렉토리 전체 삭제
                const oldDir = path.dirname(oldImagePath);
                fs.rmSync(oldDir, { recursive: true, force: true });
            }
        }
        
        // accounts.json에서 profile_image_url 제거
        const trainerIndex = accounts.findIndex(acc => acc.username === username && acc.role === 'trainer');
        delete accounts[trainerIndex].profile_image_url;
        fs.writeFileSync(DATA_PATH, JSON.stringify(accounts, null, 2));
        
        res.json({ message: '프로필 사진이 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 프로필 사진 삭제 오류:', error);
        res.status(500).json({ message: '프로필 사진 삭제에 실패했습니다.' });
    }
});
```

#### 1.5 트레이너 목록 조회 API 수정
**파일**: `backend/server.js`

`/api/trainers` 엔드포인트에서 `profile_image_url` 필드를 포함하도록 수정:

```javascript
const trainers = accounts.filter(acc => acc.role === 'trainer')
    .map(({ username, name, role, vip_member, '30min_session': thirtyMinSession, profile_image_url }) => ({ 
        username, 
        name, 
        role, 
        vip_member: vip_member || false,
        '30min_session': thirtyMinSession || 'off',
        profile_image_url: profile_image_url || null
    }));
```

---

### Phase 2: 프론트엔드 구현

#### 2.1 트레이너 목록 화면 수정
**파일**: `public/js/trainer.js`

**변경 사항**:
1. 테이블 헤더에 "프로필 사진" 컬럼 추가
2. 각 행에 프로필 사진 썸네일 표시
3. 프로필 사진 클릭 시 업로드 모달 열기

```javascript
// loadList() 함수 수정
html += '<th style="text-align:center;padding:8px 4px;border-bottom:1.5px solid #b6c6e3;">프로필 사진</th>';

// 각 행에 프로필 사진 추가
const profileImageUrl = tr.profile_image_url || '';
const profileImageHtml = profileImageUrl 
    ? `<img src="${profileImageUrl}" alt="프로필" style="width:50px;height:50px;object-fit:cover;border-radius:50%;cursor:pointer;" 
         onclick="openProfileImageModal('${tr.username}', '${tr.name}')" />`
    : `<div style="width:50px;height:50px;border-radius:50%;background:#e0e0e0;display:flex;align-items:center;justify-content:center;cursor:pointer;"
         onclick="openProfileImageModal('${tr.username}', '${tr.name}')">
         <span style="font-size:20px;">👤</span>
       </div>`;

html += `<td style="padding:8px 4px;border-bottom:1px solid #e3eaf5;text-align:center;">
    ${profileImageHtml}
</td>`;
```

#### 2.2 프로필 사진 업로드 모달 (이미지 크롭 기능 포함)
**파일**: `public/index.html` 또는 `public/js/trainer.js`

**HTML 구조**:
```html
<div id="trainerProfileImageModal" class="modal" style="display:none;">
    <div class="modal-content" style="max-width:600px;">
        <div class="modal-header">
            <h3>📷 프로필 사진 업로드</h3>
            <button class="modal-close" onclick="closeProfileImageModal()">×</button>
        </div>
        <div class="modal-body">
            <div style="margin-bottom:16px;">
                <strong>트레이너:</strong> <span id="profileImageTrainerName"></span>
            </div>
            
            <!-- 파일 선택 영역 -->
            <div id="profileImageFileSelectArea" style="margin-bottom:16px;text-align:center;">
                <input type="file" id="profileImageFileInput" accept="image/*" style="display:none;" />
                <button onclick="document.getElementById('profileImageFileInput').click()" class="btn-primary">
                    파일 선택
                </button>
            </div>
            
            <!-- 이미지 크롭 영역 -->
            <div id="profileImageCropArea" style="display:none;margin-bottom:16px;">
                <div style="position:relative;max-width:100%;overflow:hidden;background:#f0f0f0;border:2px solid #ddd;">
                    <canvas id="profileImageCropCanvas" style="display:block;max-width:100%;cursor:move;"></canvas>
                    <div id="profileImageCropCircle" style="position:absolute;border:3px solid #2196f3;border-radius:50%;pointer-events:none;box-shadow:0 0 0 9999px rgba(0,0,0,0.5);"></div>
                </div>
                <div style="margin-top:8px;text-align:center;font-size:12px;color:#666;">
                    드래그하여 이동 · 휠로 크기 조절
                </div>
            </div>
            
            <!-- 크롭된 미리보기 영역 -->
            <div id="profileImagePreviewArea" style="display:none;margin-bottom:16px;text-align:center;">
                <div style="margin-bottom:8px;font-weight:600;">미리보기</div>
                <canvas id="profileImagePreviewCanvas" style="width:150px;height:150px;border-radius:50%;border:2px solid #ddd;"></canvas>
            </div>
            
            <!-- 현재 프로필 사진 표시 (파일 선택 전) -->
            <div id="profileImageCurrentPreview" style="margin-bottom:16px;text-align:center;">
                <img id="profileImageCurrentImg" src="" alt="현재 프로필" style="width:150px;height:150px;object-fit:cover;border-radius:50%;border:2px solid #ddd;display:none;" />
                <div id="profileImageCurrentPlaceholder" style="width:150px;height:150px;background:#e0e0e0;border-radius:50%;margin:0 auto;display:flex;align-items:center;justify-content:center;">
                    <span style="font-size:48px;">👤</span>
                </div>
            </div>
            
            <div id="profileImageResult" style="margin-bottom:16px;"></div>
        </div>
        <div class="modal-actions">
            <button onclick="uploadProfileImage()" class="btn-primary" id="uploadProfileImageBtn" style="display:none;">업로드</button>
            <button onclick="deleteProfileImage()" class="btn-danger" id="deleteProfileImageBtn" style="display:none;">삭제</button>
            <button onclick="closeProfileImageModal()" class="btn-secondary">취소</button>
        </div>
    </div>
</div>
```

**JavaScript 함수 (이미지 크롭 기능 포함)**:
```javascript
let currentProfileImageUsername = null;
let currentProfileImageUrl = null;
let cropImage = null; // 원본 이미지 객체
let cropCanvas = null;
let cropCtx = null;
let previewCanvas = null;
let previewCtx = null;
let cropCircle = null;
let cropRadius = 100; // 크롭 원의 반지름
let cropX = 0; // 크롭 원의 중심 X
let cropY = 0; // 크롭 원의 중심 Y
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

function openProfileImageModal(username, name) {
    currentProfileImageUsername = username;
    document.getElementById('profileImageTrainerName').textContent = `${name} (${username})`;
    
    // 초기화
    cropImage = null;
    cropRadius = 100;
    cropX = 0;
    cropY = 0;
    
    // 캔버스 초기화
    cropCanvas = document.getElementById('profileImageCropCanvas');
    cropCtx = cropCanvas.getContext('2d');
    previewCanvas = document.getElementById('profileImagePreviewCanvas');
    previewCtx = previewCanvas.getContext('2d');
    cropCircle = document.getElementById('profileImageCropCircle');
    
    // 현재 프로필 사진 로드
    fetch(`/api/trainers?username=${encodeURIComponent(username)}`)
        .then(res => res.json())
        .then(trainers => {
            const trainer = trainers[0];
            if (trainer && trainer.profile_image_url) {
                currentProfileImageUrl = trainer.profile_image_url;
                document.getElementById('profileImageCurrentImg').src = trainer.profile_image_url;
                document.getElementById('profileImageCurrentImg').style.display = 'block';
                document.getElementById('profileImageCurrentPlaceholder').style.display = 'none';
                document.getElementById('deleteProfileImageBtn').style.display = 'inline-block';
            } else {
                currentProfileImageUrl = null;
                document.getElementById('profileImageCurrentImg').style.display = 'none';
                document.getElementById('profileImageCurrentPlaceholder').style.display = 'flex';
                document.getElementById('deleteProfileImageBtn').style.display = 'none';
            }
        });
    
    // 파일 선택 시 이미지 크롭 영역 표시
    document.getElementById('profileImageFileInput').onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    cropImage = img;
                    setupCropArea();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    };
    
    document.getElementById('trainerProfileImageModal').style.display = 'block';
}

function setupCropArea() {
    if (!cropImage) return;
    
    // 캔버스 크기 설정 (이미지 비율 유지)
    const maxWidth = 500;
    const maxHeight = 400;
    let canvasWidth = cropImage.width;
    let canvasHeight = cropImage.height;
    
    if (canvasWidth > maxWidth) {
        canvasHeight = (canvasHeight * maxWidth) / canvasWidth;
        canvasWidth = maxWidth;
    }
    if (canvasHeight > maxHeight) {
        canvasWidth = (canvasWidth * maxHeight) / canvasHeight;
        canvasHeight = maxHeight;
    }
    
    cropCanvas.width = canvasWidth;
    cropCanvas.height = canvasHeight;
    
    // 이미지 그리기
    cropCtx.drawImage(cropImage, 0, 0, canvasWidth, canvasHeight);
    
    // 크롭 원 초기 위치 설정 (중앙)
    cropX = canvasWidth / 2;
    cropY = canvasHeight / 2;
    cropRadius = Math.min(canvasWidth, canvasHeight) * 0.3; // 이미지 크기의 30%
    
    // 크롭 영역 표시
    document.getElementById('profileImageCropArea').style.display = 'block';
    document.getElementById('profileImagePreviewArea').style.display = 'block';
    document.getElementById('profileImageFileSelectArea').style.display = 'none';
    document.getElementById('uploadProfileImageBtn').style.display = 'inline-block';
    
    updateCropCircle();
    updatePreview();
    setupCropEvents();
}

function updateCropCircle() {
    if (!cropCircle) return;
    cropCircle.style.width = (cropRadius * 2) + 'px';
    cropCircle.style.height = (cropRadius * 2) + 'px';
    cropCircle.style.left = (cropX - cropRadius) + 'px';
    cropCircle.style.top = (cropY - cropRadius) + 'px';
}

function updatePreview() {
    if (!cropImage || !previewCanvas || !previewCtx) return;
    
    // 원본 이미지에서 크롭 영역 추출
    const sourceX = (cropX - cropRadius) * (cropImage.width / cropCanvas.width);
    const sourceY = (cropY - cropRadius) * (cropImage.height / cropCanvas.height);
    const sourceSize = (cropRadius * 2) * (cropImage.width / cropCanvas.width);
    
    // 미리보기 캔버스에 원형으로 그리기
    previewCanvas.width = 150;
    previewCanvas.height = 150;
    
    previewCtx.save();
    previewCtx.beginPath();
    previewCtx.arc(75, 75, 75, 0, Math.PI * 2);
    previewCtx.clip();
    previewCtx.drawImage(
        cropImage,
        sourceX, sourceY, sourceSize, sourceSize,
        0, 0, 150, 150
    );
    previewCtx.restore();
}

function setupCropEvents() {
    // 드래그 시작
    cropCanvas.addEventListener('mousedown', function(e) {
        const rect = cropCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // 크롭 원 내부인지 확인
        const dx = x - cropX;
        const dy = y - cropY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= cropRadius) {
            isDragging = true;
            dragStartX = x - cropX;
            dragStartY = y - cropY;
        }
    });
    
    // 드래그 중
    cropCanvas.addEventListener('mousemove', function(e) {
        if (isDragging) {
            const rect = cropCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            cropX = x - dragStartX;
            cropY = y - dragStartY;
            
            // 경계 체크
            cropX = Math.max(cropRadius, Math.min(cropCanvas.width - cropRadius, cropX));
            cropY = Math.max(cropRadius, Math.min(cropCanvas.height - cropRadius, cropY));
            
            updateCropCircle();
            updatePreview();
        }
    });
    
    // 드래그 종료
    cropCanvas.addEventListener('mouseup', function() {
        isDragging = false;
    });
    
    cropCanvas.addEventListener('mouseleave', function() {
        isDragging = false;
    });
    
    // 휠로 크기 조절
    cropCanvas.addEventListener('wheel', function(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -10 : 10;
        const minRadius = 50;
        const maxRadius = Math.min(cropCanvas.width, cropCanvas.height) / 2;
        
        cropRadius = Math.max(minRadius, Math.min(maxRadius, cropRadius + delta));
        
        // 크기 변경 시 위치 조정 (경계 내에 유지)
        cropX = Math.max(cropRadius, Math.min(cropCanvas.width - cropRadius, cropX));
        cropY = Math.max(cropRadius, Math.min(cropCanvas.height - cropRadius, cropY));
        
        updateCropCircle();
        updatePreview();
    });
    
    // 터치 이벤트 (모바일)
    let touchStartDistance = 0;
    cropCanvas.addEventListener('touchstart', function(e) {
        if (e.touches.length === 1) {
            const rect = cropCanvas.getBoundingClientRect();
            const x = e.touches[0].clientX - rect.left;
            const y = e.touches[0].clientY - rect.top;
            
            const dx = x - cropX;
            const dy = y - cropY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= cropRadius) {
                isDragging = true;
                dragStartX = x - cropX;
                dragStartY = y - cropY;
            }
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            touchStartDistance = Math.sqrt(dx * dx + dy * dy);
        }
    });
    
    cropCanvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        if (e.touches.length === 1 && isDragging) {
            const rect = cropCanvas.getBoundingClientRect();
            const x = e.touches[0].clientX - rect.left;
            const y = e.touches[0].clientY - rect.top;
            
            cropX = x - dragStartX;
            cropY = y - dragStartY;
            
            cropX = Math.max(cropRadius, Math.min(cropCanvas.width - cropRadius, cropX));
            cropY = Math.max(cropRadius, Math.min(cropCanvas.height - cropRadius, cropY));
            
            updateCropCircle();
            updatePreview();
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            const delta = distance - touchStartDistance;
            const minRadius = 50;
            const maxRadius = Math.min(cropCanvas.width, cropCanvas.height) / 2;
            
            cropRadius = Math.max(minRadius, Math.min(maxRadius, cropRadius + delta * 0.1));
            cropX = Math.max(cropRadius, Math.min(cropCanvas.width - cropRadius, cropX));
            cropY = Math.max(cropRadius, Math.min(cropCanvas.height - cropRadius, cropY));
            
            touchStartDistance = distance;
            updateCropCircle();
            updatePreview();
        }
    });
    
    cropCanvas.addEventListener('touchend', function() {
        isDragging = false;
    });
}

function closeProfileImageModal() {
    document.getElementById('trainerProfileImageModal').style.display = 'none';
    document.getElementById('profileImageFileInput').value = '';
    document.getElementById('profileImageResult').innerHTML = '';
    document.getElementById('profileImageCropArea').style.display = 'none';
    document.getElementById('profileImagePreviewArea').style.display = 'none';
    document.getElementById('profileImageFileSelectArea').style.display = 'block';
    document.getElementById('uploadProfileImageBtn').style.display = 'none';
    
    // 상태 초기화
    currentProfileImageUsername = null;
    currentProfileImageUrl = null;
    cropImage = null;
    cropRadius = 100;
    cropX = 0;
    cropY = 0;
    isDragging = false;
}

function uploadProfileImage() {
    if (!cropImage) {
        alert('이미지를 선택해주세요.');
        return;
    }
    
    // 크롭된 이미지를 원형으로 변환하여 Blob 생성
    const croppedImageBlob = getCroppedImageBlob();
    
    if (!croppedImageBlob) {
        alert('이미지 처리 중 오류가 발생했습니다.');
        return;
    }
    
    const formData = new FormData();
    formData.append('image', croppedImageBlob, 'profile.jpg');
    formData.append('currentUser', localStorage.getItem('username'));
    
    const resultDiv = document.getElementById('profileImageResult');
    resultDiv.innerHTML = '업로드 중...';
    resultDiv.className = 'result';
    
    fetch(`/api/trainers/${encodeURIComponent(currentProfileImageUsername)}/profile-image`, {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.message) {
            resultDiv.innerHTML = data.message;
            resultDiv.className = 'result success';
            setTimeout(() => {
                closeProfileImageModal();
                loadList(); // 목록 새로고침
            }, 1000);
        } else {
            resultDiv.innerHTML = data.message || '업로드에 실패했습니다.';
            resultDiv.className = 'result error';
        }
    })
    .catch(error => {
        console.error('프로필 사진 업로드 오류:', error);
        resultDiv.innerHTML = '업로드 중 오류가 발생했습니다.';
        resultDiv.className = 'result error';
    });
}

function getCroppedImageBlob() {
    if (!cropImage || !cropCanvas) return null;
    
    // 원본 이미지에서 크롭 영역 추출
    const sourceX = (cropX - cropRadius) * (cropImage.width / cropCanvas.width);
    const sourceY = (cropY - cropRadius) * (cropImage.height / cropCanvas.height);
    const sourceSize = (cropRadius * 2) * (cropImage.width / cropCanvas.width);
    
    // 임시 캔버스에 원형으로 그리기
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 400; // 최종 이미지 크기
    tempCanvas.height = 400;
    const tempCtx = tempCanvas.getContext('2d');
    
    // 원형 클리핑
    tempCtx.save();
    tempCtx.beginPath();
    tempCtx.arc(200, 200, 200, 0, Math.PI * 2);
    tempCtx.clip();
    tempCtx.drawImage(
        cropImage,
        sourceX, sourceY, sourceSize, sourceSize,
        0, 0, 400, 400
    );
    tempCtx.restore();
    
    // Blob으로 변환
    return new Promise((resolve) => {
        tempCanvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/jpeg', 0.9);
    });
}

function deleteProfileImage() {
    if (!confirm('프로필 사진을 삭제하시겠습니까?')) {
        return;
    }
    
    const resultDiv = document.getElementById('profileImageResult');
    resultDiv.innerHTML = '삭제 중...';
    resultDiv.className = 'result';
    
    fetch(`/api/trainers/${encodeURIComponent(currentProfileImageUsername)}/profile-image`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            currentUser: localStorage.getItem('username')
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.message) {
            resultDiv.innerHTML = data.message;
            resultDiv.className = 'result success';
            setTimeout(() => {
                closeProfileImageModal();
                loadList(); // 목록 새로고침
            }, 1000);
        } else {
            resultDiv.innerHTML = data.message || '삭제에 실패했습니다.';
            resultDiv.className = 'result error';
        }
    })
    .catch(error => {
        console.error('프로필 사진 삭제 오류:', error);
        resultDiv.innerHTML = '삭제 중 오류가 발생했습니다.';
        resultDiv.className = 'result error';
    });
}
```

---

## 📝 변경 파일 목록

### 백엔드
1. ✅ `backend/server.js`
   - 디렉토리 설정 추가
   - Multer 설정 추가
   - 프로필 사진 업로드 API 추가
   - 프로필 사진 삭제 API 추가
   - 트레이너 목록 조회 API 수정

### 프론트엔드
2. ✅ `public/js/trainer.js`
   - 트레이너 목록에 프로필 사진 컬럼 추가
   - 프로필 사진 업로드 모달 함수 추가

3. ✅ `public/index.html` (또는 별도 모달 파일)
   - 프로필 사진 업로드 모달 HTML 추가

---

## 🔒 보안 고려사항

1. **파일 형식 검증**: 서버에서 이미지 파일만 허용
2. **파일 크기 제한**: 5MB 이하만 허용
3. **권한 확인**: 관리자/SU 또는 본인만 업로드/삭제 가능
4. **파일 경로 검증**: 상대 경로만 저장하여 디렉토리 탐색 공격 방지
5. **기존 파일 삭제**: 새 파일 업로드 시 기존 파일 완전 삭제

---

## 🎯 향후 확장 계획

1. ✅ **이미지 크롭**: 원형 크롭 영역 선택 기능 (구현 완료)
2. **이미지 리사이징**: 업로드 시 자동으로 썸네일 생성
3. **트레이너 앱 연동**: 트레이너가 앱에서 자신의 프로필 사진 업로드
4. **다중 이미지**: 프로필 사진 여러 장 등록 (갤러리 형식)
5. **이미지 필터**: 밝기, 대비, 채도 조절 기능

---

## ✅ 체크리스트

- [ ] 백엔드 디렉토리 설정
- [ ] Multer 설정 추가
- [ ] 프로필 사진 업로드 API 구현
- [ ] 프로필 사진 삭제 API 구현
- [ ] 트레이너 목록 조회 API 수정
- [ ] 프론트엔드 트레이너 목록 UI 수정
- [ ] 프로필 사진 업로드 모달 구현
- [ ] 파일 업로드/삭제 기능 테스트
- [ ] 권한 확인 테스트
- [ ] 에러 처리 테스트
