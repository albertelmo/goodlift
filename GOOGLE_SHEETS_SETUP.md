# 구글 시트 자동 데이터 가져오기 설정 가이드

## 1. Google Cloud Console 설정

### 1.1 프로젝트 생성
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 (또는 기존 프로젝트 선택)

### 1.2 Google Sheets API 활성화
1. "API 및 서비스" > "라이브러리" 메뉴로 이동
2. "Google Sheets API" 검색 후 활성화

### 1.3 서비스 계정 생성
1. "API 및 서비스" > "사용자 인증 정보" 메뉴로 이동
2. "+ 사용자 인증 정보 만들기" > "서비스 계정" 선택
3. 서비스 계정 이름 입력 (예: `fms-sheets-reader`)
4. 역할은 기본값 또는 "편집자" 선택
5. "완료" 클릭

### 1.4 인증 키 다운로드
1. 생성된 서비스 계정 클릭
2. "키" 탭으로 이동
3. "키 추가" > "새 키 만들기" 선택
4. 키 유형: JSON 선택
5. "만들기" 클릭 → JSON 파일이 자동 다운로드됨

### 1.5 구글 시트 공유 설정
1. 구글 시트 열기
2. "공유" 버튼 클릭
3. 서비스 계정 이메일 주소 입력 (JSON 파일의 `client_email` 필드 값)
4. 권한: "편집자" 또는 "뷰어" 선택
5. "완료" 클릭

## 2. 프로젝트 설정

### 2.1 JSON 키 파일 배치
- 다운로드한 JSON 파일을 `backend/` 폴더에 배치
- 파일명: `google-sheets-credentials.json` (또는 원하는 이름)
- ⚠️ **보안 주의**: 이 파일은 `.gitignore`에 추가해야 함!

### 2.2 환경 변수 설정
`.env` 파일에 다음 추가:
```
GOOGLE_SHEETS_CREDENTIALS_PATH=./google-sheets-credentials.json
```

또는 JSON 파일의 내용을 환경 변수로 설정:
```
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account",...}
```

## 3. 사용 방법

### 시트 ID 확인
구글 시트 URL에서 확인:
```
https://docs.google.com/spreadsheets/d/[시트ID]/edit
```

### API 엔드포인트 호출
```
POST /api/sheets/import
Body: {
  "sheetId": "시트ID",
  "sheetName": "시트이름" (선택사항, 기본값: 첫 번째 시트)
}
```

## 4. 주의사항

1. **보안**: JSON 키 파일은 절대 공개 저장소에 업로드하지 마세요
2. **권한**: 서비스 계정에 시트 접근 권한을 부여해야 합니다
3. **한도**: Google Sheets API는 일일 사용량 제한이 있습니다
4. **비용**: 무료 할당량 내에서는 비용이 발생하지 않습니다
