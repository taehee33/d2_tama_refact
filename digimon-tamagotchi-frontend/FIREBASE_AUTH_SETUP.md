# Firebase Google 로그인 설정 가이드

## ✅ 완료된 작업

### 1. 인증 Context 생성
- `src/contexts/AuthContext.jsx` 생성
- Google 로그인, 로그아웃 기능 구현
- 인증 상태 관리

### 2. 유저별 슬롯 Repository
- `src/repositories/UserSlotRepository.js` 생성
- Firestore 구조: `users/{userId}/slots/{slotId}`
- 유저별 슬롯 CRUD 기능 구현

### 3. Login.jsx 수정
- Google 로그인 버튼 추가
- 로그인 성공 시 Firestore에 유저 정보 저장
- 로그인 상태에 따른 리다이렉트

### 4. SelectScreen.jsx 수정
- Firestore에서 유저의 슬롯 목록 가져오기
- 새 슬롯 생성 시 Firestore에 저장
- 슬롯 삭제/수정 기능 Firestore 연동

### 5. Game.jsx 수정
- Firestore에서 슬롯 데이터 로드
- 스탯 저장 시 Firestore에 업데이트

### 6. App.jsx 수정
- AuthProvider로 전체 앱 감싸기

## 🔧 Firebase Console 설정

### 1. Authentication 활성화
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 선택
3. **Authentication** 메뉴 클릭
4. **시작하기** 클릭
5. **Sign-in method** 탭에서 **Google** 활성화
6. 프로젝트 지원 이메일 설정
7. **저장** 클릭

### 2. Firestore 보안 규칙 설정
Firestore Database > Rules에서 다음 규칙 설정:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // users 컬렉션
    match /users/{userId} {
      // 인증된 사용자만 자신의 데이터에 접근
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // 서브컬렉션: slots
      match /slots/{slotId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

## 📊 Firestore 데이터 구조

```
users/
  {userId}/
    email: "user@example.com"
    displayName: "사용자 이름"
    photoURL: "https://..."
    createdAt: Timestamp
    updatedAt: Timestamp
    slots/
      slot1/
        selectedDigimon: "Agumon"
        digimonStats: { ... }
        slotName: "내 디지몬"
        createdAt: "2024-01-01T00:00:00Z"
        device: "Digital Monster Color 25th"
        version: "Ver.1"
        updatedAt: Timestamp
      slot2/
        ...
```

## 🚀 사용 방법

### 1. 로그인
1. 앱 실행 시 Login 페이지 표시
2. "Google로 로그인" 버튼 클릭
3. Google 계정 선택
4. 로그인 성공 시 SelectScreen으로 이동

### 2. 슬롯 관리
- **새 다마고치 시작**: Firestore에 새 슬롯 생성
- **이어하기**: Firestore에서 슬롯 데이터 로드
- **삭제**: Firestore에서 슬롯 삭제
- **이름 수정**: Firestore에서 슬롯 이름 업데이트

### 3. 게임 플레이
- 게임 시작 시 Firestore에서 슬롯 데이터 로드
- 스탯 변경 시 자동으로 Firestore에 저장
- 진화 시 Firestore에 업데이트

## 🔍 주요 변경사항

### Login.jsx
- Google 로그인 버튼 추가
- 로그인 성공 시 유저 정보 Firestore 저장
- 로그인 상태 확인 및 리다이렉트

### SelectScreen.jsx
- `localStorage` → `userSlotRepository` 변경
- Firestore에서 슬롯 목록 가져오기
- 로그아웃 기능 추가
- 유저 프로필 표시

### Game.jsx
- `localStorage` → `userSlotRepository` 변경
- Firestore에서 슬롯 데이터 로드
- 스탯 저장 시 Firestore 업데이트

## ⚠️ 주의사항

1. **인증 필수**: 모든 슬롯 작업은 로그인된 유저만 가능
2. **데이터 보안**: Firestore 보안 규칙으로 유저별 데이터 분리
3. **에러 처리**: 네트워크 오류 시 적절한 에러 메시지 표시

## 🐛 문제 해결

### Google 로그인이 작동하지 않는 경우
- Firebase Console에서 Google Sign-in 활성화 확인
- 환경변수 설정 확인
- 브라우저 콘솔에서 에러 메시지 확인

### Firestore 권한 오류
- 보안 규칙 확인
- 인증 상태 확인 (`currentUser`가 null이 아닌지)

### 슬롯 데이터가 로드되지 않는 경우
- Firestore에 데이터가 있는지 확인
- 네트워크 연결 확인
- 브라우저 콘솔에서 에러 메시지 확인







