# 리팩토링 및 아키텍처 변경 일지 (D2 Tamagotchi)

이 파일은 Cursor AI를 통해 수행된 주요 아키텍처 및 코드 변경 사항을 추적하기 위해 작성되었습니다.

---

## [2024-12-19] 클라이언트 타이머 도입 및 실시간 UI 업데이트 구현

### 작업 유형
- 실시간 UI 업데이트
- 클라이언트 사이드 타이머 구현
- 사용자 경험 개선

### 목적 및 영향
사용자가 게임을 플레이하는 동안 Time to Evolve, Lifespan, Waste(똥) 등의 시간 관련 스탯이 실시간으로 업데이트되도록 클라이언트 타이머를 도입했습니다:
- 1초마다 UI가 실시간으로 업데이트되어 사용자가 시간 경과를 즉시 확인 가능
- 똥이 실시간으로 쌓이는 모습을 UI에 반영
- Firestore 쓰기 작업은 사용자 액션 시에만 실행하여 비용 절감

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - **updateLifespan import 추가**: `stats.js`에서 `updateLifespan` 함수 import
  - **클라이언트 타이머 구현**: `useEffect`와 `setInterval`을 사용하여 1초마다 UI 업데이트
  - **함수형 업데이트 사용**: `setDigimonStats`에 함수형 업데이트를 사용하여 최신 상태 참조
  - **사망 상태 체크**: 사망한 경우 타이머 중지
  - **메모리 누수 방지**: `useEffect` cleanup 함수에서 `clearInterval` 호출

### 주요 변경사항

#### Game.jsx - 클라이언트 타이머 구현
- **타이머 설정**: `useEffect` 내에서 `setInterval`로 1초마다 실행되는 타이머 생성
- **updateLifespan 호출**: 매초 `updateLifespan(prevStats, 1)` 호출하여 1초 경과 처리
- **실시간 UI 업데이트**: 
  - `lifespanSeconds` 증가
  - `timeToEvolveSeconds` 감소
  - `fullness` 감소 (hungerTimer에 따라)
  - `health` 감소 (strengthTimer에 따라)
  - `poopCount` 증가 (poopTimer에 따라)
- **사망 감지**: 사망 상태 변경 시 `setShowDeathConfirm(true)` 호출
- **메모리 상태만 업데이트**: Firestore 쓰기 작업 없이 메모리 상태만 업데이트

#### stats.js - updateLifespan 함수 활용
- 기존 `updateLifespan` 함수를 활용하여 1초 경과 처리
- 배고픔, 건강, 똥(poop) 누적 로직이 이미 구현되어 있음
- 사망 조건 처리 포함

### 타이머 동작 방식
1. **타이머 시작**: 컴포넌트 마운트 시 `useEffect` 실행
2. **1초마다 실행**: `setInterval`로 1초마다 콜백 함수 실행
3. **상태 업데이트**: `updateLifespan`으로 1초 경과 처리 후 `setDigimonStats` 호출
4. **UI 반영**: React가 상태 변경을 감지하여 UI 자동 업데이트
5. **타이머 정리**: 컴포넌트 언마운트 시 `clearInterval`로 타이머 제거

### 실시간 업데이트 항목
- **Time to Evolve**: 매초 1초씩 감소
- **Lifespan**: 매초 1초씩 증가
- **Fullness**: `hungerTimer`에 따라 주기적으로 감소
- **Health**: `strengthTimer`에 따라 주기적으로 감소
- **Poop Count**: `poopTimer`에 따라 주기적으로 증가 (최대 8개)
- **Care Mistakes**: 똥이 8개인 상태로 8시간 경과 시 증가

### Firestore 쓰기 전략
- **클라이언트 타이머**: 메모리 상태만 업데이트 (Firestore 쓰기 없음)
- **사용자 액션**: 먹이주기, 훈련하기, 진화하기, 청소하기 등 액션 시에만 Firestore에 저장
- **비용 절감**: 매초 Firestore 쓰기를 하지 않아 비용 절감 및 성능 향상

### 메모리 누수 방지
- **useEffect cleanup**: 컴포넌트 언마운트 시 `clearInterval(timer)` 호출
- **사망 시 중지**: `digimonStats.isDead`가 true일 때 타이머 중지
- **함수형 업데이트**: `setDigimonStats`에 함수형 업데이트를 사용하여 최신 상태 참조

### 사용자 경험 개선
- **실시간 피드백**: 시간 경과를 즉시 확인 가능
- **시각적 효과**: 똥이 실시간으로 쌓이는 모습을 UI에 반영
- **반응성 향상**: 1초마다 UI가 업데이트되어 게임이 살아있는 느낌 제공

### 참고사항
- `updateLifespan` 함수는 `stats.js`에 이미 구현되어 있어 재사용
- Firestore 쓰기는 사용자 액션 시에만 실행되므로 비용 효율적
- 함수형 업데이트를 사용하여 타이머가 매초 재설정되지 않도록 최적화
- 사망한 디지몬은 타이머가 중지되어 불필요한 업데이트 방지

---

## [2024-12-19] 데이터 저장 완료 후 페이지 이동 및 로딩 상태 관리 개선

### 작업 유형
- 비동기 로직 개선
- 에러 처리 강화
- 사용자 경험 개선
- 로딩 상태 관리

### 목적 및 영향
데이터 저장이 완료된 후에만 페이지 이동하도록 보장하고, Game.jsx에서 데이터 로딩이 완료될 때까지 불필요한 리디렉션을 방지하도록 개선했습니다:
- 데이터 저장 실패 시 페이지 이동 방지
- 명확한 에러 메시지 제공
- 로딩 상태 표시로 사용자 경험 개선
- 데이터 로딩 완료 전 리디렉션 방지

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
  - **비동기 로직 개선**: `handleNewTama` 함수에서 데이터 저장 완료 후에만 `navigate` 호출
  - **저장 성공 확인**: `saveSuccess` 플래그를 사용하여 저장 성공 여부 확인
  - **에러 처리 강화**: localStorage 저장 시도/캐치 추가
  - **페이지 이동 조건**: `saveSuccess && slotId`가 모두 true일 때만 페이지 이동
  - **에러 발생 시 처리**: 에러 발생 시 알림 표시 후 `return`으로 페이지 이동 방지

- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - **로딩 상태 관리**: `isLoadingSlot` state 추가하여 슬롯 데이터 로딩 상태 추적
  - **로딩 표시**: 데이터 로딩 중일 때 로딩 스피너와 메시지 표시
  - **리디렉션 개선**: Firebase 모드에서 로그인 체크 시 로딩 상태를 false로 설정한 후 리디렉션
  - **에러 처리**: try/catch/finally 블록으로 에러 발생 시에도 로딩 상태 해제
  - **데이터 로딩 완료 보장**: `finally` 블록에서 항상 `setIsLoadingSlot(false)` 호출

### 주요 변경사항

#### SelectScreen.jsx - handleNewTama 함수
- **저장 성공 확인**: `saveSuccess` 플래그로 Firestore 또는 localStorage 저장 성공 여부 확인
- **localStorage 에러 처리**: localStorage 저장 시도/캐치로 저장 실패 시 에러 발생
- **조건부 페이지 이동**: `if (saveSuccess && slotId)` 조건으로 저장 성공 시에만 페이지 이동
- **에러 시 처리**: catch 블록에서 에러 메시지 표시 후 `return`으로 함수 종료

#### Game.jsx - 슬롯 로드 로직
- **로딩 상태 추가**: `const [isLoadingSlot, setIsLoadingSlot] = useState(true)` 추가
- **로딩 시작**: `loadSlot` 함수 시작 시 `setIsLoadingSlot(true)` 호출
- **로딩 완료**: `finally` 블록에서 `setIsLoadingSlot(false)` 호출
- **로딩 UI**: `isLoadingSlot`이 true일 때 로딩 스피너와 메시지 표시
- **리디렉션 개선**: Firebase 모드에서 로그인 체크 시 로딩 상태를 false로 설정한 후 리디렉션

### 데이터 저장 흐름
1. **SelectScreen**: "새 다마고치 시작" 버튼 클릭
2. **슬롯 찾기**: 빈 슬롯 찾기
3. **데이터 저장**: Firestore 또는 localStorage에 데이터 저장
4. **저장 성공 확인**: `saveSuccess` 플래그로 저장 성공 여부 확인
5. **페이지 이동**: 저장 성공 시에만 `/game/${slotId}`로 이동

### 데이터 로딩 흐름
1. **Game.jsx 마운트**: `isLoadingSlot = true`로 시작
2. **모드 확인**: Firebase 모드인지 localStorage 모드인지 확인
3. **데이터 로드**: Firestore 또는 localStorage에서 슬롯 데이터 로드
4. **로딩 완료**: `finally` 블록에서 `isLoadingSlot = false`로 설정
5. **UI 표시**: 로딩 중일 때는 로딩 UI, 완료 후 게임 화면 표시

### 사용자 경험 개선
- **명확한 피드백**: 데이터 저장 실패 시 명확한 에러 메시지 표시
- **로딩 표시**: 데이터 로딩 중 로딩 스피너로 진행 상황 표시
- **안정성 향상**: 데이터 저장 완료 전 페이지 이동 방지로 데이터 손실 방지
- **에러 처리**: 모든 에러 케이스에 대한 적절한 처리

### 참고사항
- localStorage 저장은 동기 작업이지만, 에러 발생 가능성을 고려하여 try/catch로 감쌈
- Firestore 저장은 비동기 작업이므로 `await`로 완료 대기
- 로딩 상태는 `finally` 블록에서 항상 해제하여 무한 로딩 방지
- Firebase 모드에서 로그인 체크 실패 시에도 로딩 상태를 해제한 후 리디렉션

---

## [2024-12-19] 전역 인증 상태 관리 개선 및 리디렉션 로직 정리

### 작업 유형
- 인증 상태 관리 개선
- 사용자 경험 개선
- 코드 정리

### 목적 및 영향
AuthContext의 `onAuthStateChanged` 리스너를 활용하여 전역 인증 상태를 관리하고, SelectScreen에서 자동으로 인증 상태를 감지하여 리디렉션하도록 개선했습니다:
- 전역 인증 상태 구독을 통한 자동 리디렉션
- 불필요한 팝업 제거로 사용자 경험 개선
- 로그인 성공 후 단순한 리디렉션으로 코드 단순화

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
  - **전역 인증 상태 구독**: AuthContext의 `currentUser`를 구독하여 자동으로 인증 상태 감지
  - **자동 리디렉션**: Firebase 모드에서 `currentUser`가 null일 경우 자동으로 로그인 페이지로 리디렉션
  - **팝업 제거**: "로그인이 필요합니다" alert 제거, 대신 자동 리디렉션 사용
  - **handleNewTama 함수**: 버튼 클릭 시에도 인증 체크하되 팝업 없이 리디렉션

- `digimon-tamagotchi-frontend/src/pages/Login.jsx`
  - **로그인 성공 리디렉션**: 로그인 성공 시 단순히 `/select`로 이동
  - **state 전달 제거**: `navigate("/select", { state: { mode: 'firebase' } })` → `navigate("/select")`
  - **로컬 모드 리디렉션**: localStorage 모드로 이동할 때도 state 전달 제거

### 주요 변경사항

#### SelectScreen.jsx
- **전역 인증 상태 구독**: `useAuth()` 훅으로 `currentUser`를 구독
- **자동 리디렉션 로직**: `useEffect`에서 `currentUser`가 null이고 Firebase 모드일 경우 자동으로 `/`로 리디렉션
- **팝업 제거**: `alert("로그인이 필요합니다.")` 제거
- **handleNewTama 함수**: 버튼 클릭 시에도 인증 체크하되 팝업 없이 리디렉션

#### Login.jsx
- **로그인 성공 처리**: Firestore에 유저 정보 저장 후 단순히 `/select`로 이동
- **state 전달 제거**: AuthContext의 `onAuthStateChanged` 리스너가 자동으로 `currentUser`를 업데이트하므로 별도 state 전달 불필요
- **로컬 모드 리디렉션**: localStorage 모드로 이동할 때도 state 전달 제거

### 인증 상태 관리 흐름
1. **AuthContext**: `onAuthStateChanged` 리스너가 Firebase 인증 상태 변경을 감지
2. **전역 상태 업데이트**: 인증 상태 변경 시 `currentUser` 상태 자동 업데이트
3. **SelectScreen 구독**: `useAuth()` 훅으로 `currentUser` 구독
4. **자동 리디렉션**: `currentUser`가 null이고 Firebase 모드일 경우 자동으로 로그인 페이지로 리디렉션

### 사용자 경험 개선
- **자동 리디렉션**: 로그인하지 않은 상태에서 SelectScreen 접근 시 자동으로 로그인 페이지로 이동
- **팝업 제거**: 불필요한 "로그인이 필요합니다" 팝업 제거로 더 부드러운 사용자 경험
- **상태 동기화**: AuthContext의 전역 상태를 통해 모든 컴포넌트에서 일관된 인증 상태 유지

### 참고사항
- AuthContext는 이미 `onAuthStateChanged` 리스너를 사용하여 전역 인증 상태를 관리하고 있음
- SelectScreen은 이 전역 상태를 구독하여 자동으로 인증 상태를 감지
- 로그인 성공 후 별도의 state 전달 없이도 SelectScreen에서 자동으로 인증 상태를 인식
- 로컬 모드(`mode === 'local'`)로 온 경우는 인증 체크를 건너뜀

---

## [2024-12-19] Backend 폴더 제거 및 프로젝트 정리

### 작업 유형
- 프로젝트 구조 정리
- 불필요한 파일 제거
- 아키텍처 단순화

### 목적 및 영향
프로젝트가 Firebase/Vercel 서버리스 아키텍처로 완전히 전환되었으므로, 더 이상 필요하지 않은 Express 기반 백엔드 폴더를 제거했습니다:
- Express 서버 및 관련 의존성 제거
- 프로젝트 구조 단순화
- 순수한 React + Firebase 클라이언트 앱으로 정리

### 변경된 파일
- **backend/** 폴더 전체 삭제
  - `server.js` (Express 서버 파일)
  - `package.json` (백엔드 의존성)
  - `node_modules/` (백엔드 의존성 패키지)
  - `build/` (빌드 결과물)

- `digimon-tamagotchi-frontend/package.json`
  - 확인 결과: 백엔드 관련 스크립트 없음 (이미 정리되어 있음)
  - 현재 스크립트: `start`, `build`, `test`, `eject` (순수 React 앱 스크립트만 유지)
  - `concurrently`, `server`, `start-dev` 등의 백엔드 관련 스크립트 없음

### 제거된 내용
- Express 서버 (`server.js`)
- node-cron (서버 사이드 스케줄링)
- cross-fetch (서버 사이드 HTTP 요청)
- Express 관련 의존성 및 설정

### 프로젝트 구조 변화
**Before:**
```
d2_tama_refact/
  ├── backend/          # Express 서버 (제거됨)
  │   ├── server.js
  │   ├── package.json
  │   └── node_modules/
  └── digimon-tamagotchi-frontend/
      └── package.json
```

**After:**
```
d2_tama_refact/
  └── digimon-tamagotchi-frontend/
      └── package.json  # 순수 React 앱만 유지
```

### 주요 변경사항

#### Backend 폴더 삭제
- Express 기반 백엔드 서버 전체 제거
- 서버 사이드 의존성 제거 (node-cron, express, cross-fetch)
- 빌드 결과물 및 node_modules 제거

#### Package.json 확인
- 백엔드 관련 스크립트 없음 확인
- 순수 React 앱 스크립트만 유지:
  - `start`: React 개발 서버 시작
  - `build`: React 앱 빌드
  - `test`: 테스트 실행
  - `eject`: Create React App eject

### 아키텍처 정리
프로젝트가 완전히 서버리스 아키텍처로 전환되었습니다:
- **클라이언트**: React 앱 (Firebase SDK 사용)
- **백엔드**: Firebase (Firestore + Authentication + Serverless Functions)
- **호스팅**: Vercel (프론트엔드) + Firebase (백엔드)

### 참고사항
- Express 서버는 더 이상 필요하지 않음 (Firebase로 완전 전환)
- 모든 데이터 저장/인증은 Firebase를 통해 처리
- Lazy Update 패턴으로 서버 사이드 스케줄링 불필요
- 프로젝트가 순수한 클라이언트 앱으로 단순화됨

---

## [2024-12-19] Google 로그인 계정 선택 강제 및 로그아웃 기능 추가

### 작업 유형
- 기능 개선
- 테스트 환경 개선
- 사용자 경험 향상

### 목적 및 영향
테스트 환경 개선을 위해 Google 로그인 시 매번 계정 선택 창이 뜨도록 하고, 게임 내에서 로그아웃할 수 있는 기능을 추가했습니다:
- Google 로그인 시 `prompt: 'select_account'` 옵션을 강제하여 매번 계정 선택 창 표시
- SettingsModal에 로그아웃 버튼 추가로 게임 중간에 계정 전환 가능
- 로그아웃 후 자동으로 로그인 페이지로 리디렉션

### 변경된 파일
- `digimon-tamagotchi-frontend/src/contexts/AuthContext.jsx`
  - **Google 로그인 개선**: `GoogleAuthProvider`에 `setCustomParameters({ prompt: 'select_account' })` 추가
  - 매번 로그인 시 계정 선택 창이 표시되어 테스트 시 여러 계정 전환 용이

- `digimon-tamagotchi-frontend/src/components/SettingsModal.jsx`
  - **로그아웃 기능 추가**: `useAuth` 훅으로 `logout`, `isFirebaseAvailable`, `currentUser` 가져오기
  - **로그아웃 버튼**: Firebase 모드에서만 표시되는 로그아웃 버튼 추가
  - **리디렉션**: 로그아웃 성공 시 `navigate("/")`로 로그인 페이지로 이동
  - **에러 처리**: 로그아웃 실패 시 에러 메시지 표시

### 주요 변경사항

#### AuthContext.jsx
- `signInWithGoogle()` 함수에서 `provider.setCustomParameters({ prompt: 'select_account' })` 추가
- 매번 로그인 시 Google 계정 선택 창이 표시되어 테스트 환경 개선

#### SettingsModal.jsx
- `useNavigate()` 훅 추가로 페이지 이동 기능 구현
- `useAuth()` 훅으로 인증 관련 함수 및 상태 가져오기
- Firebase 모드에서만 로그아웃 버튼 표시 (조건부 렌더링)
- 로그아웃 버튼 클릭 시 `logout()` 호출 후 로그인 페이지로 리디렉션
- 로그아웃 실패 시 사용자에게 알림 표시

### 사용자 경험 개선
- **계정 전환 용이**: 매번 계정 선택 창이 표시되어 여러 계정으로 테스트 가능
- **게임 중 로그아웃**: Settings 모달에서 바로 로그아웃하여 계정 전환 가능
- **테스트 효율성**: 개발 및 테스트 시 계정 전환이 간편해짐

### 참고사항
- `prompt: 'select_account'` 옵션은 Google OAuth의 표준 파라미터로, 매번 계정 선택 창을 강제로 표시
- 로그아웃 버튼은 Firebase 모드에서만 표시되며, localStorage 모드에서는 표시되지 않음
- 로그아웃 후 자동으로 로그인 페이지로 이동하여 새로운 계정으로 로그인 가능

---

## [2024-12-19] Firebase/LocalStorage 이중 모드 지원 구현

### 작업 유형
- 기능 추가
- 데이터 저장소 분기 처리
- 라우팅 상태 관리

### 목적 및 영향
사용자가 Firebase 인증 없이도 로컬 저장소 모드로 게임을 시작할 수 있도록 지원했습니다:
- SelectScreen에서 "로컬 저장소 모드 시작" 버튼 추가로 Firebase Auth 없이 게임 시작 가능
- Login.jsx는 Firebase 로그인만 전담하되, 로그인 후 mode: 'firebase' 상태 전달
- Game.jsx에서 mode 값(firebase/local)을 기반으로 데이터 저장 로직 분기 처리
- React Router의 location.state를 활용하여 페이지 간 mode 상태 전달

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
  - **로컬 모드 시작 버튼**: `handleNewTamaLocal()` 함수 추가
  - **로컬 모드 슬롯 생성**: localStorage에 초기 데이터 저장 후 Game.jsx로 이동 (mode: 'local')
  - **Firebase 모드 슬롯 생성**: 기존 로직 유지하되 Game.jsx로 이동 시 mode: 'firebase' 전달
  - **이어하기 기능**: 현재 모드에 따라 state에 mode 값 전달

- `digimon-tamagotchi-frontend/src/pages/Login.jsx`
  - **Firebase 로그인 후**: SelectScreen으로 이동 시 `navigate("/select", { state: { mode: 'firebase' } })` 전달
  - **로컬 모드 시작**: Firebase 미설정 시 SelectScreen으로 이동 시 mode: 'local' 전달

- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - **mode 상태 관리**: `useLocation()` 훅으로 location.state에서 mode 값 가져오기
  - **슬롯 로드 분기**: mode에 따라 Firestore 또는 localStorage에서 데이터 로드
  - **스탯 저장 분기**: `setDigimonStatsAndSave()` 함수에서 mode에 따라 Firestore 또는 localStorage 저장
  - **Lazy Update 분기**: `applyLazyUpdateBeforeAction()` 함수에서 mode에 따라 데이터 소스 선택
  - **디지몬 이름 저장 분기**: `setSelectedDigimonAndSave()` 함수에서 mode에 따라 저장 방식 분기
  - **청소 기능 분기**: `cleanCycle()` 함수에서 mode에 따라 저장 방식 분기

### 데이터 저장 로직 분기
Game.jsx의 모든 저장 작업이 mode 값에 따라 분기 처리됩니다:
- **mode === 'firebase'**: Firestore의 `users/{uid}/slots/{slotId}` 경로에 저장
- **mode === 'local'**: localStorage의 `slot{slotId}_*` 키에 저장

### 주요 변경사항

#### SelectScreen.jsx
- `handleNewTamaLocal()`: 로컬 모드로 새 다마고치 시작 (Firebase Auth 불필요)
- `handleNewTama()`: Firebase 모드로 새 다마고치 시작 (기존 로직 유지)
- `handleContinue()`: 현재 모드에 따라 state에 mode 값 전달
- UI에 "로컬 저장소 모드 시작" 버튼 추가

#### Login.jsx
- Firebase 로그인 성공 시 SelectScreen으로 이동할 때 mode: 'firebase' 전달
- localStorage 모드 시작 시 SelectScreen으로 이동할 때 mode: 'local' 전달

#### Game.jsx
- `mode` 변수: location.state에서 가져오거나, 기본값은 현재 인증 상태 기반
- 모든 데이터 저장/로드 작업이 mode 값에 따라 Firestore 또는 localStorage로 분기
- Lazy Update 로직도 mode에 따라 적절한 데이터 소스에서 마지막 저장 시간 조회

### 참고사항
- React Router v6의 `navigate(path, { state })`를 사용하여 페이지 간 상태 전달
- `useLocation()` 훅으로 전달받은 state 접근
- mode 값이 없을 경우 현재 인증 상태를 기반으로 자동 판단 (firebase 또는 local)
- Firebase 모드에서는 인증이 필수이며, 미인증 시 Login 페이지로 리디렉션

---

## [2024-12-19] localStorage 완전 제거 및 Firestore 전용 전환

### 작업 유형
- 코드 리팩토링
- 데이터 저장소 통합
- Lazy Update 최적화

### 목적 및 영향
Game.jsx에서 모든 localStorage 관련 코드를 제거하고 Firestore 전용으로 전환했습니다:
- Firebase 인증이 필수 조건이 되었으며, localStorage fallback 제거
- 모든 데이터 저장/로드가 Firestore의 `users/{uid}/slots/{slotId}` 경로로 통일
- 데이터 저장 시점 명확화: 로그인/슬롯 선택 시 로드, 먹이/훈련/진화/청소 시 저장
- Lazy Update 로직이 모든 액션 전에 적용되어 정확한 스탯 계산 보장

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - **슬롯 로드**: localStorage 분기 완전 제거, Firestore 전용으로 변경
  - **스탯 저장**: `setDigimonStatsAndSave()` 함수에서 localStorage 분기 제거
  - **Lazy Update**: `applyLazyUpdateBeforeAction()` 함수에서 localStorage 분기 제거
  - **디지몬 이름 저장**: `setSelectedDigimonAndSave()` 함수에서 localStorage 분기 제거
  - **청소 기능**: `cleanCycle()` 함수에서 `lastSavedAt` 필드 업데이트 추가
  - **먹이 기능**: `handleFeed()` 함수에서 업데이트된 스탯 기준으로 검증 로직 수정

### 데이터 저장 시점
다음 액션 시점에 Firestore에 자동 저장됩니다:
1. **슬롯 로드 시**: Lazy Update 적용 후 업데이트된 스탯 저장
2. **먹이 주기**: `setDigimonStatsAndSave()` 호출 시 저장
3. **훈련하기**: `setDigimonStatsAndSave()` 호출 시 저장
4. **진화하기**: `setDigimonStatsAndSave()` 호출 시 저장
5. **청소하기**: `cleanCycle()` 함수에서 직접 저장

### Lazy Update 적용
모든 액션 전에 `applyLazyUpdateBeforeAction()` 함수가 호출되어:
- Firestore에서 마지막 저장 시간(`lastSavedAt`) 조회
- 현재 시간과의 차이 계산
- `stats.js`의 `applyLazyUpdate()` 함수로 경과 시간만큼 스탯 차감
- 사망 상태 변경 감지 및 알림

### Firestore 데이터 구조
```
users/{uid}/slots/{slotId}
  - selectedDigimon: string
  - digimonStats: {
      ... (모든 스탯 필드)
      lastSavedAt: Date  // Lazy Update용 마지막 저장 시간
    }
  - slotName: string
  - createdAt: string
  - device: string
  - version: string
  - updatedAt: Timestamp
  - lastSavedAt: Timestamp  // 문서 레벨 마지막 저장 시간
```

### 주요 변경사항

#### Game.jsx
- **슬롯 로드**: Firebase 인증 필수, localStorage fallback 제거
- **스탯 저장**: 모든 저장 작업이 Firestore로 통일
- **액션 전 Lazy Update**: 모든 사용자 액션(먹이, 훈련, 진화, 청소) 전에 경과 시간 반영
- **에러 처리**: Firestore 작업 실패 시 콘솔 에러 로그만 출력 (사용자 경험 유지)

#### stats.js
- localStorage 관련 코드 없음 (변경 없음)
- `applyLazyUpdate()` 함수가 이미 Lazy Update 로직 구현
- `updateLifespan()` 함수는 유지 (필요 시 사용 가능)

### 성능 개선
- **Before**: localStorage와 Firestore 이중 분기 처리
- **After**: Firestore 단일 경로로 코드 단순화 및 유지보수성 향상
- 모든 액션 시점에만 저장하여 Firestore 쓰기 횟수 최소화

### 참고사항
- Firebase 인증이 필수 조건이 되었으므로, 로그인하지 않은 사용자는 SelectScreen으로 리디렉션
- `isFirebaseAvailable` 체크는 유지하여 Firebase 초기화 실패 시 안전하게 처리
- 모든 Firestore 작업은 비동기로 처리되어 UI 블로킹 방지

---

## [2024-12-19] Firebase Google 로그인 및 Firestore 직접 연동 구현

### 작업 유형
- 인증 시스템 구현
- Firestore 직접 연동
- 사용자별 데이터 분리

### 목적 및 영향
Firebase Authentication과 Firestore를 사용하여 사용자별 슬롯 데이터를 관리하도록 구현했습니다:
- Google 로그인을 통한 사용자 인증
- 로그인된 유저의 UID 기반으로 Firestore `/users/{uid}/slots` 컬렉션에서 데이터 관리
- Repository 패턴에서 Firestore 직접 호출로 전환하여 코드 명확성 향상

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/Login.jsx`
  - Firebase `signInWithPopup(GoogleAuthProvider)`를 사용한 Google 로그인 구현
  - `userSlotRepository` 제거, Firestore 직접 호출로 변경
  - `doc(db, 'users', user.uid)` + `setDoc`으로 유저 정보 저장
  - 로그인 성공 시 유저 UID를 사용하여 SelectScreen으로 리디렉션

- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
  - `userSlotRepository` 제거, Firestore 직접 호출로 변경
  - Firestore의 `collection(db, 'users', currentUser.uid, 'slots')`에서 슬롯 목록 가져오기
  - `doc(db, 'users', currentUser.uid, 'slots', 'slot{slotId}')`로 슬롯 CRUD 작업
  - `getDocs`, `setDoc`, `updateDoc`, `deleteDoc` 직접 사용

### Firestore 데이터 구조
```
users/
  {uid}/                    # 유저 UID
    email: string
    displayName: string
    photoURL: string
    createdAt: Timestamp
    updatedAt: Timestamp
    slots/                   # 서브컬렉션
      slot1/
        selectedDigimon: string
        digimonStats: {...}
        slotName: string
        createdAt: string
        device: string
        version: string
        updatedAt: Timestamp
        lastSavedAt: Timestamp
      slot2/
        ...
```

### 주요 변경사항

#### Login.jsx
- `signInWithPopup(auth, GoogleAuthProvider)` 사용
- 로그인 성공 후 `user.uid`를 사용하여 SelectScreen으로 리디렉션
- Firestore에 유저 정보 자동 저장

#### SelectScreen.jsx
- **슬롯 목록 로드**: `collection(db, 'users', uid, 'slots')` + `getDocs(query(...))`
- **슬롯 생성**: `doc(db, 'users', uid, 'slots', 'slot{id}')` + `setDoc`
- **슬롯 삭제**: `doc(...)` + `deleteDoc`
- **슬롯 이름 수정**: `doc(...)` + `updateDoc`

### 관련 파일
- `digimon-tamagotchi-frontend/src/contexts/AuthContext.jsx` - 인증 상태 관리
- `digimon-tamagotchi-frontend/src/firebase.js` - Firebase 초기화

### 참고사항
- 모든 Firestore 작업은 유저 UID 기반으로 수행
- Firestore 보안 규칙으로 유저별 데이터 접근 제어 필요
- localStorage 모드는 Firebase가 설정되지 않았을 때 fallback으로 동작

---

## [2024-12-19] localStorage → Firestore 직접 호출 리팩토링

### 작업 유형
- 데이터 저장소 마이그레이션
- 코드 리팩토링

### 목적 및 영향
Game.jsx에서 userSlotRepository를 사용하던 부분을 Firestore의 doc, getDoc, setDoc, updateDoc을 직접 사용하도록 변경했습니다. 이를 통해:
- Repository 추상화 레이어를 제거하고 Firestore를 직접 사용
- DigimonStats JSON 구조를 그대로 Firestore 문서에 저장
- 코드의 명확성과 직접성 향상

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - userSlotRepository import 제거
  - Firestore doc, getDoc, setDoc, updateDoc 직접 import
  - 슬롯 로드: getDoc 사용
  - 스탯 저장: updateDoc 사용 (매초 자동 저장 및 수동 저장)
  - 디지몬 이름 저장: updateDoc 사용
  - 청소 기능: updateDoc 사용

### Firestore 데이터 구조
```
users/{userId}/slots/{slotId}
  - selectedDigimon: string
  - digimonStats: DigimonStats (JSON 객체 전체)
  - slotName: string
  - createdAt: string
  - device: string
  - version: string
  - updatedAt: Timestamp
```

### 참고사항
- stats.js는 localStorage를 사용하지 않으므로 변경 없음
- 모든 Firestore 호출은 에러 처리를 포함
- 비동기 저장 작업은 사용자 경험에 영향을 주지 않도록 처리

---

## [2024-12-19] Lazy Update 로직 구현 (node-cron 제거)

### 작업 유형
- 아키텍처 변경
- 성능 최적화
- 서버리스 환경 대응

### 목적 및 영향
Vercel/Firebase 환경에서 node-cron의 비효율성을 해결하기 위해 Lazy Update 패턴을 도입했습니다:
- 매초 실행되던 타이머 제거 → 서버 리소스 절약
- 유저 접속/액션 시점에만 시간 경과 계산 및 스탯 업데이트
- 마지막 저장 시간(`lastSavedAt`) 기반으로 경과 시간 계산
- 서버리스 환경에 최적화된 구조

### 변경된 파일
- `digimon-tamagotchi-frontend/src/data/stats.js`
  - `applyLazyUpdate()` 함수 추가
  - 마지막 저장 시간부터 현재까지 경과 시간 계산
  - 배고픔, 건강, 배변, 수명 등을 한 번에 업데이트
  - 사망 조건 처리 (배고픔 0 상태 12시간 경과)

- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - 매초 실행되던 `setInterval` 타이머 제거
  - `updateLifespan`, `updateAge` import 제거
  - `applyLazyUpdate` import 추가
  - 슬롯 로드 시 Lazy Update 적용
  - 모든 액션(먹이, 훈련, 진화, 청소 등) 전에 Lazy Update 적용
  - `applyLazyUpdateBeforeAction()` 헬퍼 함수 추가
  - Firestore에 `lastSavedAt` 필드 저장

### Lazy Update 로직
```javascript
// 마지막 저장 시간과 현재 시간의 차이 계산
const elapsedSeconds = (현재 시간 - 마지막 저장 시간) / 1000

// 경과 시간만큼 스탯 업데이트
- lifespanSeconds += elapsedSeconds
- timeToEvolveSeconds -= elapsedSeconds
- 배고픔/건강 타이머 감소 및 상태 업데이트
- 배변 카운트 증가
- 사망 조건 확인
```

### Firestore 데이터 구조 변경
```
users/{userId}/slots/{slotId}
  ...
  + lastSavedAt: Timestamp  // 마지막 저장 시간 (Lazy Update용)
```

### 성능 개선
- **Before**: 매초 Firestore 업데이트 (60회/분)
- **After**: 액션 시점에만 업데이트 (필요 시에만)
- 서버리스 환경에서 비용 및 리소스 절약

### 참고사항
- 기존 `updateLifespan()` 함수는 유지 (필요 시 사용 가능)
- `lastSavedAt`이 없으면 현재 시간으로 초기화
- Firestore Timestamp, Date, number, string 모두 지원
- 사망한 디지몬은 더 이상 업데이트하지 않음

---