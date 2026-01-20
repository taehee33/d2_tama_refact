# 로컬 저장소 모드 제거 분석

## 📋 현재 상태

현재 프로젝트는 **Firebase 모드**와 **localStorage 모드** 두 가지 저장소 모드를 지원하고 있습니다.

### 모드 결정 로직
- `location.state?.mode` 또는
- `(isFirebaseAvailable && currentUser) ? 'firebase' : 'local'`

---

## 🔍 localStorage 모드 사용 위치

### 1. **Login.jsx**
- **위치**: `src/pages/Login.jsx`
- **기능**: 
  - Firebase가 없을 때 localStorage 모드 버튼 표시
  - Firebase가 있을 때도 "로컬 저장소 모드 시작" 버튼 제공
- **제거 영향**: 
  - `handleLocalStorageMode` 함수 제거
  - localStorage 모드 버튼 UI 제거
  - Firebase가 없으면 에러 표시 또는 안내 메시지

### 2. **SelectScreen.jsx**
- **위치**: `src/pages/SelectScreen.jsx`
- **기능**:
  - `mode === 'local'` 체크로 localStorage에서 슬롯 로드
  - localStorage 모드로 새 슬롯 생성
  - `loadSlots` 함수에서 localStorage 분기
- **제거 영향**:
  - 모든 `mode === 'local'` 분기 제거
  - localStorage 슬롯 로드/저장 코드 제거
  - Firebase 로그인 필수로 변경

### 3. **Game.jsx**
- **위치**: `src/pages/Game.jsx`
- **기능**:
  - `mode` 결정 로직 (line 83)
  - `mode === 'local'` UI 분기 (line 1291, 1335)
- **제거 영향**:
  - `mode` 변수 제거 또는 항상 'firebase'로 고정
  - localStorage 관련 UI 제거

### 4. **useGameData.js**
- **위치**: `src/hooks/useGameData.js`
- **기능**:
  - `saveStats` 함수: `mode === 'local'`일 때 localStorage 저장 (line 219-239)
  - `loadSlotLocal` 함수: localStorage에서 슬롯 로드 (line 384-480)
  - `saveBackgroundSettings` 함수: localStorage 저장 (line 623-630)
- **제거 영향**:
  - `loadSlotLocal` 함수 전체 제거
  - `saveStats`의 localStorage 분기 제거
  - `saveBackgroundSettings`의 localStorage 분기 제거
  - Firebase만 사용하도록 단순화

### 5. **useEncyclopedia.js**
- **위치**: `src/hooks/useEncyclopedia.js`
- **기능**:
  - `loadEncyclopedia`: `mode === 'local'`일 때 localStorage에서 로드 (line 27-35)
  - `saveEncyclopedia`: `mode === 'local'`일 때 localStorage에 저장 (line 70-78)
- **제거 영향**:
  - localStorage 분기 제거
  - Firebase만 사용

### 6. **ArenaScreen.jsx**
- **위치**: `src/components/ArenaScreen.jsx`
- **기능**:
  - 여러 함수에서 `mode === 'local'` 체크로 early return
  - localStorage 모드일 때 Arena 기능 비활성화
- **제거 영향**:
  - 모든 `mode === 'local'` 체크 제거
  - Firebase 로그인 필수로 변경

### 7. **SparringModal.jsx**
- **위치**: `src/components/SparringModal.jsx`
- **기능**:
  - `loadSlots` 함수에서 localStorage 모드로 슬롯 로드 (line 56-78)
- **제거 영향**:
  - localStorage 분기 제거
  - Firebase만 사용

### 8. **useGameHandlers.js**
- **위치**: `src/hooks/useGameHandlers.js`
- **기능**:
  - `handleLightsToggle` 함수에서 localStorage 모드 체크 (line 311-322)
- **제거 영향**:
  - localStorage 분기 제거

### 9. **SlotRepository.js**
- **위치**: `src/repositories/SlotRepository.js`
- **기능**:
  - `REACT_APP_STORAGE_TYPE` 환경 변수로 저장소 타입 결정
  - `LocalStorageSlotRepository` 클래스 제공
- **제거 영향**:
  - `LocalStorageSlotRepository` 클래스 제거
  - `REACT_APP_STORAGE_TYPE` 환경 변수 제거
  - `UserSlotRepository`만 사용

---

## 📊 제거 시 영향도 분석

### ✅ 장점
1. **코드 단순화**: 분기 로직 제거로 코드 복잡도 감소
2. **유지보수 용이**: 단일 저장소만 관리
3. **버그 감소**: 모드 분기로 인한 버그 가능성 제거
4. **일관성**: 모든 사용자가 동일한 저장소 사용

### ⚠️ 단점
1. **Firebase 필수**: 로그인 없이는 사용 불가
2. **오프라인 불가**: 인터넷 연결 필수
3. **기존 localStorage 데이터**: 마이그레이션 필요 (선택사항)

---

## 🔧 제거 작업 체크리스트

### 1단계: 모드 결정 로직 제거
- [ ] `Game.jsx`: `mode` 변수 완전 제거 (항상 'firebase'로 고정하지 말고 아예 제거)
- [ ] `SelectScreen.jsx`: `mode` 변수 완전 제거
- [ ] `location.state?.mode` 제거
- [ ] 모든 컴포넌트에서 `mode` prop 전달 제거

### 2단계: Login.jsx 수정
- [ ] `handleLocalStorageMode` 함수 제거
- [ ] localStorage 모드 버튼 UI 제거
- [ ] Firebase 없을 때 에러 처리 추가
- [ ] Firebase 없으면 로그인 불가 안내 메시지 표시

### 3단계: 커스텀 훅 파라미터 정리 (핵심!)
- [ ] `useGameData.js`: `mode` 파라미터 완전 제거
- [ ] `useEncyclopedia.js`: `mode` 파라미터 완전 제거
- [ ] `useGameHandlers.js`: `mode` 파라미터 완전 제거
- [ ] 모든 훅 호출부에서 `mode` 전달 코드 제거
- [ ] 훅 내부 로직을 Firebase 전용으로 고정
- [ ] `currentUser`가 없으면 에러 throw 또는 리디렉션

### 4단계: useGameData.js 수정
- [ ] `loadSlotLocal` 함수 전체 제거
- [ ] `saveStats`의 localStorage 분기 제거
- [ ] `saveBackgroundSettings`의 localStorage 분기 제거
- [ ] Firebase만 사용하도록 단순화

### 5단계: useEncyclopedia.js 수정
- [ ] `loadEncyclopedia`의 localStorage 분기 제거
- [ ] `saveEncyclopedia`의 localStorage 분기 제거
- [ ] Firebase만 사용하도록 단순화

### 6단계: 컴포넌트 수정 및 인증 체크 강화 (핵심!)
- [ ] `ArenaScreen.jsx`: 
  - 모든 `mode === 'local'` early return 제거
  - 최상단에서 인증 체크 강화
  - 로그인하지 않은 경우 명확한 에러 메시지 표시
- [ ] `SparringModal.jsx`: localStorage 분기 제거
- [ ] `useGameHandlers.js`: localStorage 분기 제거
- [ ] `Game.jsx`: `mode === 'local'` 조건부 렌더링 제거
- [ ] `SelectScreen.jsx`: `mode === 'local'` 조건부 렌더링 제거
- [ ] `AuthContext.jsx`: 인증 상태 체크 로직 강화
- [ ] 모든 컴포넌트 최상단에서 인증 체크 추가

### 7단계: Repository 수정 및 단일화 (핵심!)
- [ ] `SlotRepository.js`: 
  - `LocalStorageSlotRepository` 클래스 완전 제거
  - `REACT_APP_STORAGE_TYPE` 환경 변수 체크 제거
  - `UserSlotRepository`만 export하도록 변경
  - 또는 파일 자체를 제거하고 `UserSlotRepository.js`를 직접 사용
- [ ] 모든 `slotRepository` import 위치 확인 및 수정
- [ ] 인터페이스 추상화 레이어 제거

### 7단계: 환경 변수 정리
- [ ] `.env` 파일에서 `REACT_APP_STORAGE_TYPE` 제거
- [ ] `firebase.js`의 localStorage 모드 안내 메시지 제거

### 8단계: 문서 업데이트
- [ ] `README.md` 업데이트
- [ ] `MIGRATION_GUIDE.md` 업데이트
- [ ] 관련 문서에서 localStorage 모드 언급 제거

---

## 🚨 주의사항

1. **기존 사용자 데이터**: localStorage에 저장된 데이터가 있다면 마이그레이션 도구 제공 고려
2. **테스트**: Firebase 로그인 필수로 변경되므로 모든 기능 테스트 필요
3. **에러 처리**: Firebase가 없거나 로그인하지 않은 경우 명확한 에러 메시지 필요
4. **점진적 제거**: 한 번에 제거하지 말고 단계적으로 진행 권장

---

## ⚠️ 핵심 주의 포인트

### 1. 전역 상태(mode)의 완벽한 정리

**문제점**: 
- `mode` 변수가 여러 파일에서 결정되고 전역적으로 전달됨
- 단순히 `mode`를 'firebase'로 고정하는 것만으로는 부족
- 커스텀 훅의 파라미터에서 `mode`를 완전히 제거해야 함

**주의사항**:
- `useGameData`, `useEncyclopedia`, `useGameHandlers` 등 모든 커스텀 훅에서 `mode` 파라미터 제거
- 훅 호출부에서 `mode` 전달 코드 제거
- 내부 로직을 Firebase 전용으로 고정

**변경 예시**:
```javascript
// ❌ Before: 인자에 mode가 섞여 있어 복잡함
export function useGameData({
  slotId,
  currentUser,
  mode,  // 제거 필요
  digimonStats,
  // ...
}) {
  if (mode === 'local') {
    // localStorage 로직
  } else if (mode === 'firebase') {
    // Firebase 로직
  }
}

// ✅ After: 인자가 단순해지고 내부 로직도 Firebase 전용으로 고정
export function useGameData({
  slotId,
  currentUser,  // 필수로 변경
  digimonStats,
  // ...
}) {
  if (!currentUser || !isFirebaseAvailable) {
    throw new Error("Firebase 로그인이 필요합니다.");
  }
  // Firebase 로직만 실행
}
```

**수정 대상 파일**:
- `useGameData.js`: `mode` 파라미터 제거
- `useEncyclopedia.js`: `mode` 파라미터 제거
- `useGameHandlers.js`: `mode` 파라미터 제거
- `Game.jsx`: `mode` 변수 제거, 훅 호출 시 `mode` 전달 제거
- `SelectScreen.jsx`: `mode` 변수 제거, 훅 호출 시 `mode` 전달 제거

---

### 2. 컴포넌트 내 조건부 렌더링 제거

**문제점**:
- `ArenaScreen.jsx`, `Game.jsx` 등에 `if (mode === 'local') return null;` 같은 early return 코드가 많음
- 이 코드들을 제거하면 이전에 숨겨졌던 UI들이 항상 보이게 됨
- 로그인하지 않은 상태에서 해당 UI들이 에러를 발생시킬 수 있음

**주의사항**:
- Early return 코드 제거 전에 최상위(Login.jsx 이후)에서 사용자 인증 체크를 강화해야 함
- `AuthContext`에서 인증 상태를 확실히 체크
- 인증되지 않은 사용자는 `/`로 리디렉션

**변경 예시**:
```javascript
// ❌ Before: Early return으로 UI 숨김
function ArenaScreen({ mode, currentUser }) {
  if (mode === 'local') return null;  // 제거 필요
  if (!currentUser) return null;  // 제거 필요
  
  // Arena UI 렌더링
}

// ✅ After: 최상위에서 인증 체크 후 렌더링
function ArenaScreen({ currentUser, isFirebaseAvailable }) {
  // 인증 체크는 상위 컴포넌트에서 처리
  // 여기서는 항상 Firebase 모드로 동작
  if (!isFirebaseAvailable || !currentUser) {
    return <div>로그인이 필요합니다.</div>;
  }
  
  // Arena UI 렌더링
}
```

**수정 대상 파일**:
- `ArenaScreen.jsx`: 모든 `mode === 'local'` early return 제거
- `Game.jsx`: `mode === 'local'` 조건부 렌더링 제거
- `SelectScreen.jsx`: `mode === 'local'` 조건부 렌더링 제거
- `Login.jsx`: Firebase 없을 때 에러 처리 강화

**인증 체크 강화 위치**:
- `AuthContext.jsx`: 인증 상태 체크 로직 강화
- `Game.jsx`: 컴포넌트 최상단에서 인증 체크
- `SelectScreen.jsx`: 컴포넌트 최상단에서 인증 체크

---

### 3. 리포지토리 패턴의 단일화

**문제점**:
- `SlotRepository.js`에서 `REACT_APP_STORAGE_TYPE` 환경 변수에 따라 클래스를 교체
- `LocalStorageSlotRepository`와 `FirestoreSlotRepository` 두 가지 구현 존재
- 인터페이스 역할을 하던 추상화 레이어가 불필요해짐
- **참고**: 실제 코드에서는 `slotRepository`를 직접 import해서 사용하는 곳이 거의 없을 수 있음 (직접 Firebase 사용)

**주의사항**:
- `LocalStorageSlotRepository` 클래스 완전 제거
- `FirestoreSlotRepository` 클래스도 제거 (실제로는 사용되지 않을 수 있음)
- `REACT_APP_STORAGE_TYPE` 환경 변수 제거
- `UserSlotRepository`만 직접 호출하도록 수정 (또는 파일 자체 제거)
- 파일 구조 단순화

**변경 예시**:
```javascript
// ❌ Before: 환경 변수로 저장소 타입 선택
const STORAGE_TYPE = process.env.REACT_APP_STORAGE_TYPE || 'localStorage';

let slotRepository;
if (STORAGE_TYPE === 'firestore') {
  slotRepository = new FirestoreSlotRepository(firestoreDb);
} else {
  slotRepository = new LocalStorageSlotRepository();
}

export { slotRepository };

// ✅ After: UserSlotRepository만 직접 사용 (또는 파일 제거)
import { userSlotRepository } from './UserSlotRepository';

// 또는 SlotRepository.js 파일 자체를 제거하고
// useGameData.js 등에서 직접 Firebase 사용 (현재 구조와 유사)
```

**수정 대상 파일**:
- `SlotRepository.js`: 
  - `LocalStorageSlotRepository` 클래스 완전 제거
  - `FirestoreSlotRepository` 클래스 제거 (사용되지 않으면)
  - `REACT_APP_STORAGE_TYPE` 환경 변수 체크 제거
  - 파일 자체를 제거하거나 `UserSlotRepository`만 export
- `UserSlotRepository.js`: 
  - 실제로 사용되는지 확인
  - 사용되지 않으면 제거 고려
- 모든 `slotRepository` import 위치 확인 및 수정 (실제로 사용되는 곳이 거의 없을 수 있음)

**실제 사용 확인 필요**:
- `slotRepository`를 실제로 import해서 사용하는 파일이 있는지 확인
- 대부분의 코드는 `useGameData.js`에서 직접 Firebase를 사용하는 것으로 보임
- Repository 패턴이 실제로 사용되지 않는다면 관련 파일 전체 제거 가능

---

## 📝 예상 작업량

- **파일 수정**: 약 10개 파일
- **코드 라인**: 약 500-800줄 제거
- **작업 시간**: 약 2-3시간
- **테스트 시간**: 약 1-2시간

---

## ✅ 제거 후 예상 구조

```javascript
// Before
const mode = location.state?.mode || ((isFirebaseAvailable && currentUser) ? 'firebase' : 'local');
if (mode === 'local') {
  // localStorage 로직
} else if (mode === 'firebase') {
  // Firebase 로직
}

// After
if (!isFirebaseAvailable || !currentUser) {
  navigate("/"); // 로그인 페이지로 리디렉션
}
// Firebase 로직만 실행
```
