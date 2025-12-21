# 빠른 테스트 가이드

## 1단계: 빌드 테스트 (문법/타입 에러 확인)

```bash
cd digimon-tamagotchi-frontend
npm run build
```

**확인 사항:**
- ✅ 빌드가 성공하는가?
- ❌ 에러가 있으면 에러 메시지 확인

---

## 2단계: 개발 서버 실행

```bash
cd digimon-tamagotchi-frontend
npm start
```

브라우저에서 `http://localhost:3000` 접속

**확인 사항:**
- ✅ 페이지가 로드되는가?
- ✅ 콘솔에 에러가 없는가? (F12 → Console 탭)

---

## 3단계: 기본 기능 테스트

### A. 로그인
1. Google 로그인 버튼 클릭
2. Google 계정 선택
3. ✅ SelectScreen으로 이동하는가?

### B. 슬롯 생성
1. "새 다마고치 시작" 버튼 클릭
2. ✅ 게임 화면으로 이동하는가?
3. ✅ 디지몬이 표시되는가?

### C. 게임 플레이
1. 먹이 주기 버튼 클릭
2. ✅ 먹이 팝업이 표시되는가?
3. 고기 선택
4. ✅ 먹이 주기가 작동하는가?
5. ✅ 스탯이 업데이트되는가?

---

## 4단계: Lazy Update 테스트

### 간단한 테스트
1. 게임 시작
2. 브라우저 개발자 도구 열기 (F12)
3. Console 탭에서 다음 명령 실행:
   ```javascript
   // 현재 스탯 확인
   console.log("현재 배고픔:", /* Game 컴포넌트의 digimonStats.fullness */);
   ```
4. 브라우저를 닫고 1분 대기
5. 다시 접속
6. ✅ 배고픔이 감소했는지 확인

### Firestore 확인
1. Firebase Console 접속
2. Firestore Database 열기
3. `users/{userId}/slots/slot1` 확인
4. ✅ `lastSavedAt` 필드가 있는가?
5. ✅ `digimonStats` 객체가 저장되어 있는가?

---

## 5단계: 에러 확인

### 브라우저 콘솔
- F12 → Console 탭
- ❌ 빨간색 에러가 있는가?

### 네트워크
- F12 → Network 탭
- Firestore 요청이 실패하는가?

### Firebase Console
- Firestore 보안 규칙 확인
- 인증 설정 확인

---

## 🚨 문제 해결

### 빌드 실패
```bash
# node_modules 재설치
rm -rf node_modules package-lock.json
npm install
```

### Firebase 연결 실패
- `.env` 파일 확인
- Firebase Console에서 프로젝트 설정 확인

### Firestore 권한 에러
- Firebase Console → Firestore → Rules 확인
- 인증된 사용자만 접근 가능하도록 설정

---

## 📋 체크리스트 요약

- [ ] 빌드 성공
- [ ] 개발 서버 실행
- [ ] 로그인 작동
- [ ] 슬롯 생성 작동
- [ ] 게임 화면 로드
- [ ] 먹이 주기 작동
- [ ] Firestore 저장 확인
- [ ] Lazy Update 작동
- [ ] 콘솔 에러 없음




