# ngrok 테스트 안내

## 1) ngrok 인증 키(authtoken) 등록
아래 명령어에서 `<YOUR_NGROK_AUTHTOKEN>`을 본인 토큰으로 교체합니다.

```
ngrok config add-authtoken <YOUR_NGROK_AUTHTOKEN>
```

## 2) HTTP 터널 실행

```
ngrok http 3000
```

## 3) 접속 도메인
ngrok 실행 후 출력되는 `Forwarding`의 HTTPS 주소로 접속합니다.

예시:

```
https://deanthropomorphic-hecticly-maureen.ngrok-free.dev
```

## 4) iOS 테스트 흐름
1. Safari에서 위 HTTPS 주소 접속
2. 공유 → 홈 화면에 추가
3. 홈 화면의 아이콘으로 앱 실행(PWA)
4. 내정보 → 알림받기 클릭
