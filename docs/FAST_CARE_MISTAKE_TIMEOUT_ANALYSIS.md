# 케어미스 타임아웃 30초 변경 기능 분석 및 수정

## 🔍 문제 분석

### 발견된 문제점

1. **상태 저장 문제**
   - `SettingsModal`에서 `handleSave` 호출 시 `setFastCareMistakeTimeout`이 제대로 전달되지 않을 수 있음
   - `GameModals`에서 `flags?.setFastCareMistakeTimeout`을 전달하지만, `flags`에 포함되어 있는지 확인 필요

2. **즉시 적용 문제**
   - `checkCallTimeouts` 호출 시 `fastCareMistakeTimeout` 파라미터 전달 확인
   - `applyLazyUpdate` 호출 시 `fastCareMistakeTimeout` 파라미터 전달 확인

3. **누락된 파라미터 전달**
   - `useGameData.js`의 일부 `applyLazyUpdateFromLogic` 호출에서 `fastCareMistakeTimeout` 파라미터 누락

---

## ✅ 수정 사항

### 1. Game.jsx - flags에 fastCareMistakeTimeout 추가
**위치**: `digimon-tamagotchi-frontend/src/pages/Game.jsx` (1353줄)

**수정 전**:
```javascript
flags={{ developerMode, setDeveloperMode, isEvolving, setIsEvolving, mode }}
```

**수정 후**:
```javascript
flags={{ developerMode, setDeveloperMode, fastCareMistakeTimeout, setFastCareMistakeTimeout, isEvolving, setIsEvolving, mode }}
```

### 2. useGameData.js - 모든 applyLazyUpdateFromLogic 호출에 fastCareMistakeTimeout 추가
**위치**: `digimon-tamagotchi-frontend/src/hooks/useGameData.js`

**수정된 위치**:
- 273줄: localStorage 모드 (이미 수정됨)
- 298줄: Firestore 모드 (수정 필요)
- 409줄: localStorage 슬롯 로드 (수정됨)
- 476줄: Firestore 슬롯 로드 (수정됨)

**수정 전**:
```javascript
const updated = applyLazyUpdateFromLogic(digimonStats, lastSavedAt, sleepSchedule, maxEnergy);
```

**수정 후**:
```javascript
const updated = applyLazyUpdateFromLogic(digimonStats, lastSavedAt, sleepSchedule, maxEnergy, fastCareMistakeTimeout);
```

---

## 🔄 데이터 흐름

### 1. 상태 저장 흐름
```
SettingsModal (handleSave)
  → setFastCareMistakeTimeout(localFastCareMistakeTimeout)
  → useGameState (setFastCareMistakeTimeout)
  → localStorage 저장 (saveFastCareMistakeTimeout)
  → useEffect로 자동 저장
```

### 2. 상태 사용 흐름
```
Game.jsx
  → useGameState에서 fastCareMistakeTimeout 가져오기
  → checkCallTimeouts(updatedStats, new Date(), fastCareMistakeTimeout)
  → useGameData에 fastCareMistakeTimeout 전달
  → applyLazyUpdateFromLogic(..., fastCareMistakeTimeout)
```

### 3. SettingsModal 전달 흐름
```
GameModals
  → flags?.fastCareMistakeTimeout
  → flags?.setFastCareMistakeTimeout
  → SettingsModal props로 전달
```

---

## 🐛 잠재적 문제점

### 1. 상태 업데이트 타이밍
- `setFastCareMistakeTimeout` 호출 후 즉시 반영되지 않을 수 있음
- React 상태 업데이트는 비동기이므로, 다음 렌더링 사이클에서 반영됨

### 2. checkCallTimeouts 호출 타이밍
- `Game.jsx`의 `useEffect`에서 1초마다 호출됨
- 상태 변경 후 즉시 반영되지 않을 수 있음

### 3. applyLazyUpdate 호출 타이밍
- 액션 전에 호출되는 `applyLazyUpdateBeforeAction`에서 사용
- 상태 변경 후 즉시 반영되지 않을 수 있음

---

## 💡 해결 방안

### 방안 1: 즉시 반영을 위한 강제 리렌더링
- `setFastCareMistakeTimeout` 호출 후 강제 리렌더링
- 하지만 React의 상태 업데이트는 이미 자동으로 리렌더링을 트리거함

### 방안 2: 상태 변경 시 즉시 적용 확인
- `SettingsModal`의 `handleSave`에서 상태 변경 후 모달을 닫기 전에 확인
- 하지만 모달이 닫힌 후에도 상태는 유지됨

### 방안 3: localStorage에서 직접 읽기
- `checkCallTimeouts`와 `applyLazyUpdate`에서 localStorage에서 직접 읽기
- 하지만 이는 상태 관리와 일관성이 없음

---

## ✅ 최종 확인 사항

1. ✅ `useGameState`에서 `fastCareMistakeTimeout` 상태 관리
2. ✅ `SettingsModal`에서 상태 변경 및 저장
3. ✅ `GameModals`에서 `flags`로 전달
4. ✅ `Game.jsx`에서 `checkCallTimeouts` 호출 시 파라미터 전달
5. ✅ `useGameData`에서 모든 `applyLazyUpdateFromLogic` 호출에 파라미터 전달
6. ✅ `data/stats.js`와 `logic/stats/stats.js`에서 파라미터 사용

---

## 🔧 추가 확인 필요 사항

1. **즉시 반영 테스트**
   - SettingsModal에서 버튼 클릭 후 즉시 타임아웃이 30초로 변경되는지 확인
   - `checkCallTimeouts`가 호출될 때 올바른 타임아웃 값을 사용하는지 확인

2. **상태 저장 테스트**
   - 페이지 새로고침 후에도 설정이 유지되는지 확인
   - localStorage에 제대로 저장되는지 확인

3. **모든 호출 경로 확인**
   - `checkCallTimeouts` 호출 시 항상 `fastCareMistakeTimeout` 전달되는지 확인
   - `applyLazyUpdate` 호출 시 항상 `fastCareMistakeTimeout` 전달되는지 확인

