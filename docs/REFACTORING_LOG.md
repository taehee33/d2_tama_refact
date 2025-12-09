# 리팩토링 및 아키텍처 변경 일지 (D2 Tamagotchi)

이 파일은 Cursor AI를 통해 수행된 주요 아키텍처 및 코드 변경 사항을 추적하기 위해 작성되었습니다.

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