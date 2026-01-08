# 케어미스 타임아웃 시스템 재설계 분석

## 📋 현재 시스템 분석

### 현재 구현 흐름

#### 1. 호출 트리거 (`checkCalls`)
- **위치**: `hooks/useGameLogic.js` (381-424줄)
- **실행 시점**: `Game.jsx`의 `useEffect`에서 매번 실행 (417줄)
- **로직**:
  ```javascript
  if (updatedStats.fullness === 0 && !callStatus.hunger.isActive && !callStatus.hunger.startedAt) {
    callStatus.hunger.isActive = true;
    callStatus.hunger.startedAt = now.getTime();
  }
  ```
- **문제점**:
  - 새로고침 후 Firestore에서 로드된 `callStatus`가 있으면 `startedAt`이 이미 있는데, `isActive`가 false일 수 있음
  - `isActive`가 false이면 조건을 통과하지 못해 `startedAt`이 재설정되지 않음
  - 하지만 `checkCalls`가 먼저 실행되면서 문제가 발생할 수 있음

#### 2. 타임아웃 체크 (`checkCallTimeouts`)
- **위치**: `hooks/useGameLogic.js` (457-512줄)
- **실행 시점**: `Game.jsx`의 `useEffect`에서 매번 실행 (438줄)
- **로직**:
  ```javascript
  if (callStatus.hunger.isActive && callStatus.hunger.startedAt) {
    const elapsed = now.getTime() - startedAt;
    if (elapsed > HUNGER_CALL_TIMEOUT) {
      updatedStats.careMistakes = (updatedStats.careMistakes || 0) + 1;
      callStatus.hunger.isActive = false;
      callStatus.hunger.startedAt = null;
    }
  }
  ```
- **문제점**:
  - `isActive`가 false이면 타임아웃을 체크하지 않음
  - 새로고침 후 `isActive`가 false로 초기화되면 타임아웃이 체크되지 않음

#### 3. Lazy Update (`applyLazyUpdate`)
- **위치**: `data/stats.js` (258-556줄)
- **실행 시점**: 
  - 액션 전에 `applyLazyUpdateForAction`에서 실행
  - 슬롯 로드 시 `applyLazyUpdateFromLogic`에서 실행
- **로직**:
  ```javascript
  // 호출 복원
  if (!callStatus.hunger.isActive && !callStatus.hunger.startedAt && updatedStats.lastHungerZeroAt) {
    callStatus.hunger.isActive = true;
    callStatus.hunger.startedAt = hungerZeroTime; // lastHungerZeroAt 사용
  }
  
  // 타임아웃 체크
  if (callStatus.hunger.isActive && callStatus.hunger.startedAt) {
    if (elapsed > HUNGER_CALL_TIMEOUT) {
      updatedStats.careMistakes = (updatedStats.careMistakes || 0) + 1;
      callStatus.hunger.isActive = false;
      callStatus.hunger.startedAt = null;
    }
  }
  ```
- **문제점**:
  - `lastHungerZeroAt`를 기반으로 호출을 복원하는데, 이미 `callStatus`에 `startedAt`이 있으면 무시됨
  - 새로고침 후 Firestore에서 로드된 `callStatus`가 있으면 `lastHungerZeroAt`를 사용하지 않음
  - 두 곳에서 타임아웃을 체크하고 있어서 중복 증가나 누락이 발생할 수 있음

### 데이터 저장/로드 흐름

#### 저장 (`saveStats`)
- **위치**: `hooks/useGameData.js` (75-218줄)
- **저장 내용**: `finalStats` 전체를 `digimonStats`로 저장
- **포함 필드**: `callStatus` 포함 (finalStats의 일부)
- **문제점**: 없음 (정상적으로 저장됨)

#### 로드 (`loadSlot`)
- **위치**: `hooks/useGameData.js` (429-502줄)
- **로드 내용**: `slotData.digimonStats`를 로드
- **처리**: `applyLazyUpdateFromLogic` 실행
- **문제점**:
  - `applyLazyUpdateFromLogic`에서 `callStatus`를 복원하는데, 이미 Firestore에 저장된 `callStatus`가 있으면 무시될 수 있음

---

## 🔍 근본 문제 분석

### 문제 1: 호출 상태 복원 로직의 불일치

**현재 상황**:
1. Firestore에 `callStatus`가 저장되고 로드됨
2. `applyLazyUpdate`에서 `lastHungerZeroAt`를 기반으로 호출을 복원하려고 함
3. `checkCalls`에서 `isActive`와 `startedAt`을 체크함

**문제**:
- Firestore에서 로드된 `callStatus`가 있으면, `applyLazyUpdate`에서 `lastHungerZeroAt`를 사용하지 않음
- 하지만 `checkCalls`가 먼저 실행되면서 `isActive`가 false이면 `startedAt`을 재설정하지 않음
- 결과적으로 새로고침 후 `callStatus`가 제대로 복원되지 않음

### 문제 2: 타임아웃 체크의 중복/누락

**현재 상황**:
1. `checkCallTimeouts`에서 실시간으로 타임아웃 체크
2. `applyLazyUpdate`에서도 타임아웃 체크

**문제**:
- 두 곳에서 체크하므로 중복 증가나 누락이 발생할 수 있음
- `isActive`가 false이면 `checkCallTimeouts`에서 체크하지 않음
- 새로고침 후 `isActive`가 false로 초기화되면 타임아웃이 체크되지 않음

### 문제 3: 호출 시작 시점의 불일치

**현재 상황**:
1. `checkCalls`에서 `now.getTime()`을 사용하여 호출 시작
2. `applyLazyUpdate`에서 `lastHungerZeroAt`를 사용하여 호출 복원

**문제**:
- 두 곳에서 다른 시점을 사용하므로 불일치 발생
- `lastHungerZeroAt`가 정확한 호출 시작 시점이 아닐 수 있음

---

## 💡 올바른 설계 방안

### 핵심 원칙

1. **단일 진실 공급원 (Single Source of Truth)**
   - 호출 시작 시점은 `callStatus.hunger.startedAt`에 저장
   - `lastHungerZeroAt`는 호출 시작 시점을 기록하는 용도로만 사용

2. **상태 복원 우선순위**
   - Firestore에서 로드된 `callStatus`가 있으면 우선 사용
   - `callStatus`가 없거나 불완전하면 `lastHungerZeroAt`를 기반으로 복원

3. **타임아웃 체크의 단일화**
   - 실시간: `checkCallTimeouts`에서만 체크
   - Lazy Update: `applyLazyUpdate`에서만 체크
   - 중복 방지를 위해 플래그 사용

### 설계 개요

#### 1. 호출 트리거 로직

```javascript
// checkCalls 함수
export function checkCalls(stats, isLightsOn, sleepSchedule, now = new Date()) {
  // callStatus가 없으면 초기화
  if (!stats.callStatus) {
    stats.callStatus = {
      hunger: { isActive: false, startedAt: null },
      strength: { isActive: false, startedAt: null },
      sleep: { isActive: false, startedAt: null }
    };
  }

  const callStatus = stats.callStatus;

  // Hunger 호출 트리거
  if (stats.fullness === 0) {
    // startedAt이 없으면 새로 시작
    if (!callStatus.hunger.startedAt) {
      callStatus.hunger.isActive = true;
      callStatus.hunger.startedAt = now.getTime();
      // lastHungerZeroAt도 업데이트 (호출 시작 시점 기록)
      stats.lastHungerZeroAt = now.getTime();
    } else {
      // startedAt이 있으면 isActive를 true로 설정 (복원)
      callStatus.hunger.isActive = true;
    }
  } else {
    // fullness가 0이 아니면 호출 리셋
    callStatus.hunger.isActive = false;
    callStatus.hunger.startedAt = null;
    stats.lastHungerZeroAt = null;
  }

  // Strength 호출도 동일한 로직
  // ...
}
```

#### 2. 타임아웃 체크 로직 (실시간)

```javascript
// checkCallTimeouts 함수
export function checkCallTimeouts(stats, now = new Date()) {
  if (!stats.callStatus) return stats;

  const callStatus = stats.callStatus;
  const HUNGER_CALL_TIMEOUT = 30 * 1000; // 30초 (테스트용)

  // Hunger 호출 타임아웃 체크
  if (callStatus.hunger.startedAt) {
    const startedAt = typeof callStatus.hunger.startedAt === 'number'
      ? callStatus.hunger.startedAt
      : new Date(callStatus.hunger.startedAt).getTime();
    const elapsed = now.getTime() - startedAt;

    if (elapsed > HUNGER_CALL_TIMEOUT) {
      // 타임아웃 발생
      stats.careMistakes = (stats.careMistakes || 0) + 1;
      callStatus.hunger.isActive = false;
      callStatus.hunger.startedAt = null;
      stats.lastHungerZeroAt = null;
    }
  }

  // Strength 호출도 동일한 로직
  // ...
}
```

#### 3. Lazy Update 로직

```javascript
// applyLazyUpdate 함수
export function applyLazyUpdate(stats, lastSavedAt) {
  // ... 기존 Lazy Update 로직 ...

  // callStatus 초기화
  if (!updatedStats.callStatus) {
    updatedStats.callStatus = {
      hunger: { isActive: false, startedAt: null },
      strength: { isActive: false, startedAt: null },
      sleep: { isActive: false, startedAt: null }
    };
  }

  const callStatus = updatedStats.callStatus;
  const HUNGER_CALL_TIMEOUT = 30 * 1000; // 30초 (테스트용)

  // Hunger 호출 처리
  if (updatedStats.fullness === 0) {
    // startedAt이 없으면 lastHungerZeroAt를 기반으로 복원
    if (!callStatus.hunger.startedAt && updatedStats.lastHungerZeroAt) {
      const hungerZeroTime = typeof updatedStats.lastHungerZeroAt === 'number'
        ? updatedStats.lastHungerZeroAt
        : new Date(updatedStats.lastHungerZeroAt).getTime();
      callStatus.hunger.isActive = true;
      callStatus.hunger.startedAt = hungerZeroTime;
    } else if (callStatus.hunger.startedAt) {
      // startedAt이 있으면 isActive를 true로 설정 (복원)
      callStatus.hunger.isActive = true;
    }

    // 타임아웃 체크
    if (callStatus.hunger.startedAt) {
      const startedAt = typeof callStatus.hunger.startedAt === 'number'
        ? callStatus.hunger.startedAt
        : new Date(callStatus.hunger.startedAt).getTime();
      const elapsed = now.getTime() - startedAt;

      if (elapsed > HUNGER_CALL_TIMEOUT) {
        // 타임아웃 발생
        updatedStats.careMistakes = (updatedStats.careMistakes || 0) + 1;
        callStatus.hunger.isActive = false;
        callStatus.hunger.startedAt = null;
        updatedStats.lastHungerZeroAt = null;
      }
    }
  } else {
    // fullness가 0이 아니면 호출 리셋
    callStatus.hunger.isActive = false;
    callStatus.hunger.startedAt = null;
    updatedStats.lastHungerZeroAt = null;
  }

  // Strength 호출도 동일한 로직
  // ...
}
```

### 핵심 변경 사항

1. **호출 시작 시점 기록**
   - `checkCalls`에서 호출을 시작할 때 `lastHungerZeroAt`도 함께 업데이트
   - `startedAt`이 없으면 새로 시작, 있으면 복원

2. **타임아웃 체크 단순화**
   - `isActive` 대신 `startedAt`만 체크
   - `startedAt`이 있으면 항상 타임아웃 체크

3. **상태 복원 우선순위**
   - Firestore에서 로드된 `callStatus.startedAt`이 있으면 우선 사용
   - 없으면 `lastHungerZeroAt`를 기반으로 복원

4. **호출 리셋 시 일관성**
   - `fullness > 0`이 되면 `startedAt`과 `lastHungerZeroAt` 모두 null로 설정

---

## ✅ 구현 체크리스트

- [ ] `checkCalls` 함수 수정: `startedAt` 기반으로 호출 시작/복원
- [ ] `checkCallTimeouts` 함수 수정: `isActive` 대신 `startedAt`만 체크
- [ ] `applyLazyUpdate` 함수 수정: `startedAt` 우선 사용, 없으면 `lastHungerZeroAt`로 복원
- [ ] 호출 리셋 시 `lastHungerZeroAt`도 함께 null로 설정
- [ ] 테스트: 새로고침 후 타임아웃 시간 유지 확인
- [ ] 테스트: 타임아웃 후 케어미스 증가 확인

---

## 📝 참고 사항

- `callStatus`는 `digimonStats`의 일부로 Firestore에 저장되고 로드됨
- `lastHungerZeroAt`는 호출 시작 시점을 기록하는 용도로만 사용
- 타임아웃 시간은 현재 30초로 설정되어 있음 (테스트용)
