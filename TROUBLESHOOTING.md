# 문제 해결 가이드

## "새 다마고치 시작" 버튼이 작동하지 않는 경우

### 1. 브라우저 콘솔 확인
브라우저 개발자 도구 (F12) → Console 탭에서 에러 메시지 확인

### 2. 가능한 원인 및 해결 방법

#### A. Firestore 권한 오류
**증상**: 콘솔에 "Missing or insufficient permissions" 에러

**해결 방법**:
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 `d2tamarefact` 선택
3. **Firestore Database** → **Rules** 탭
4. 루트 [firestore.rules](./firestore.rules) 내용을 기준으로 규칙을 반영:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    match /users/{userId} {
      allow read, write: if isOwner(userId);

      match /slots/{slotId} {
        allow read, write: if isOwner(userId);
      }

      match /slots/{slotId}/logs/{logId} {
        allow read, write: if isOwner(userId);
      }

      match /slots/{slotId}/battleLogs/{logId} {
        allow read, write: if isOwner(userId);
      }
    }
  }
}
```

5. **게시** 버튼 클릭 또는 루트 npm script로 아래 명령 실행:
   ```bash
   npm install
   npm run firebase:login
   npm run firestore:deploy
   ```

#### B. Firebase 초기화 오류
**증상**: 콘솔에 "Firestore가 초기화되지 않았습니다" 에러

**해결 방법**:
1. `.env` 파일 확인:
   ```bash
   cd digimon-tamagotchi-frontend
   cat .env
   ```
2. 모든 `REACT_APP_FIREBASE_*` 환경변수가 설정되어 있는지 확인
3. **서버 재시작** (중요!):
   ```bash
   # 서버 중지 (Ctrl+C)
   npm start
   ```

#### C. 로그인 상태 문제
**증상**: "로그인이 필요합니다" 알림

**해결 방법**:
1. 로그인 페이지로 이동
2. Google 로그인 버튼 클릭
3. 로그인 성공 후 다시 시도

#### D. localStorage 관련 혼동
현재 공식 플레이 흐름은 Firebase Auth + Firestore 기준입니다.

- `localStorage`는 현재 공식 슬롯 저장 모드가 아닙니다.
- 브라우저 UI 설정, 개발자 옵션, 일부 보조 값 저장 용도로 남아 있습니다.
- Firebase 설정이 없으면 플레이 허브와 슬롯 기능은 정상 계약대로 동작하지 않습니다.

### 3. 디버깅 정보 확인

코드에 디버깅 로그가 추가되었습니다. 브라우저 콘솔에서 다음 정보를 확인하세요:

- `새 다마고치 시작 버튼 클릭`
- `isFirebaseAvailable: true/false`
- `currentUser: {...}` 또는 `null`
- `Firestore 모드로 슬롯 생성 시도`
- 에러 메시지

### 4. 빠른 테스트

1. 브라우저 콘솔 열기 (F12)
2. "새 다마고치 시작" 버튼 클릭
3. 콘솔에 나타나는 메시지 확인
4. 에러 메시지를 복사하여 확인

### 5. 일반적인 해결 순서

1. ✅ 서버 재시작 (환경변수 반영)
2. ✅ Firebase Console에서 Authentication 활성화
3. ✅ `firestore.rules` 기준으로 Firestore 보안 규칙 설정
4. ✅ 브라우저 콘솔에서 에러 확인
5. ✅ 로그인 상태 확인





