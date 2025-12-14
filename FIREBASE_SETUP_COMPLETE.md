# Firebase 설정 완료 ✅

## 설정된 내용

### 1. `.env` 파일 생성
`digimon-tamagotchi-frontend/.env` 파일에 Firebase 설정이 추가되었습니다.

### 2. Firebase 프로젝트 정보
- **Project ID**: d2tamarefact
- **Auth Domain**: d2tamarefact.firebaseapp.com
- **Storage Type**: firestore

## 다음 단계

### 1. 개발 서버 재시작
환경변수 변경 후에는 **반드시 서버를 재시작**해야 합니다:

```bash
cd digimon-tamagotchi-frontend
# 현재 실행 중인 서버 중지 (Ctrl+C)
npm start
```

### 2. Firebase Console 설정 확인

#### Authentication 설정
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 `d2tamarefact` 선택
3. **Authentication** → **Sign-in method** 탭
4. **Google** 활성화
5. 프로젝트 지원 이메일 설정
6. **저장**

#### Firestore 설정
1. **Firestore Database** 메뉴
2. 데이터베이스 생성 (아직 없다면)
3. **보안 규칙** 설정:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      match /slots/{slotId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

### 3. 테스트

1. 개발 서버 실행: `npm start`
2. 브라우저에서 `http://localhost:3000` 접속
3. Google 로그인 버튼 클릭
4. 로그인 성공 확인
5. 새 다마고치 생성 테스트

## 문제 해결

### 여전히 "invalid-api-key" 에러가 발생하는 경우

1. **서버 재시작 확인**
   - 환경변수는 서버 시작 시에만 로드됩니다
   - 반드시 서버를 재시작하세요

2. **.env 파일 위치 확인**
   - `digimon-tamagotchi-frontend/.env` (프로젝트 루트)
   - `digimon-tamagotchi-frontend/src/.env` (X - 잘못된 위치)

3. **환경변수 확인**
   ```bash
   cd digimon-tamagotchi-frontend
   cat .env
   ```

4. **캐시 클리어**
   ```bash
   rm -rf node_modules/.cache
   npm start
   ```

### Firebase가 초기화되지 않는 경우

- 콘솔에서 경고 메시지 확인
- `REACT_APP_` 접두사 확인
- 환경변수 값에 공백이나 따옴표가 없는지 확인

## 보안 주의사항

⚠️ **중요**: `.env` 파일은 Git에 커밋하지 마세요!
- `.gitignore`에 이미 추가되어 있습니다
- Firebase API 키가 노출되지 않도록 주의하세요


