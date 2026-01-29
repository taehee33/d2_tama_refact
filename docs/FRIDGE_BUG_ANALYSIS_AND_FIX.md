# 냉장고 기능 버그 분석 및 수정

**작성일:** 2026년 1월 28일  
**문제:** 냉장고 상태임에도 불구하고 디지몬이 배고픔을 느끼고, 똥을 싸고, 결국 사망까지 이르는 버그

## 🐛 문제 상황

**현상:**
- 냉장고 상태(`isFrozen: true`)임에도 불구하고:
  - 배고픔이 감소함 (배고픔 0 상태)
  - 똥이 계속 생성됨 (똥 8개까지 차오름)
  - 수명이 증가함 (사망까지 이어짐)
  - 부상 방치 타이머가 진행됨

**이미지 증거:**
- 냉장고 상태인데도 "치료필요! 🏥 (똥 8개)" 배지 표시
- "배고픔 0 🍗", "힘 0 💪" 경고 표시
- "사망 💀 (부상 방치)" 긴급 상태 표시

## 🔍 원인 분석

### 문제 1: `applyLazyUpdate`에서 냉장고 시간 제외 로직 부족

**현재 코드:**
```javascript:277:282:digimon-tamagotchi-frontend/src/logic/stats/stats.js
// 냉장고 상태 체크: 냉장고에 넣은 경우 모든 수치 고정 (시간 정지)
if (stats.isFrozen) {
  // 냉장고 상태에서는 모든 수치 고정 (경과 시간 0으로 처리)
  // lastSavedAt만 업데이트하여 다음 lazy update가 정상 작동하도록 함
  return { ...stats, lastSavedAt: now };
}
```

**문제점:**
1. **냉장고에 넣은 이후의 시간만 제외해야 하는데, 현재는 `isFrozen === true`면 무조건 경과 시간을 0으로 처리**
2. **하지만 `lastSavedAt`이 `frozenAt`보다 이전일 수 있음** (냉장고에 넣기 전에 저장했을 수 있음)
3. **냉장고에 넣은 시간(`frozenAt`) 이후의 시간만 제외해야 함**

**시나리오:**
- `lastSavedAt = 10:00` (냉장고에 넣기 전 마지막 저장)
- `frozenAt = 11:00` (냉장고에 넣은 시간)
- `now = 12:00` (현재 시간)
- **현재 로직:** `isFrozen === true`이므로 경과 시간 = 0 (❌ 잘못됨)
- **올바른 로직:** `frozenAt` 이후의 시간만 제외해야 하므로, `10:00 ~ 11:00` 사이의 1시간은 경과 시간에 포함되어야 함

**하지만 실제 문제는:**
- 냉장고에 넣은 **이후**에도 `lastSavedAt`이 업데이트될 수 있음
- 예: `lastSavedAt = 11:00` (냉장고에 넣은 후 저장), `frozenAt = 11:00`, `now = 12:00`
- **현재 로직:** `isFrozen === true`이므로 경과 시간 = 0 (✅ 올바름)
- **하지만:** 냉장고에 넣은 후에도 스탯이 변경될 수 있음 (다른 액션으로 인해)

### 문제 2: 냉장고에 넣은 시간 이후의 시간이 제외되지 않음

**핵심 문제:**
- `applyLazyUpdate`에서 `isFrozen === true`일 때 경과 시간을 0으로 처리하지만
- **냉장고에 넣은 시간(`frozenAt`) 이후의 시간만 제외해야 함**
- `lastSavedAt`이 `frozenAt`보다 이후일 수 있음 (냉장고에 넣은 후 저장했을 수 있음)

**올바른 로직:**
```javascript
// 냉장고 시간을 제외한 경과 시간 계산
const elapsedSeconds = getElapsedTimeExcludingFridge(
  lastSaved.getTime(),
  now.getTime(),
  stats.frozenAt,
  stats.takeOutAt
) / 1000;
```

### 문제 3: `updateLifespan`, `handleHungerTick`, `handleStrengthTick`에서 냉장고 체크는 있지만

**현재 코드:**
- `updateLifespan`: `if (stats.isFrozen) return stats;` ✅
- `handleHungerTick`: `if (currentStats.isFrozen) return currentStats;` ✅
- `handleStrengthTick`: `if (currentStats.isFrozen) return currentStats;` ✅

**하지만 문제는:**
- `applyLazyUpdate`에서 이미 경과 시간을 계산할 때 냉장고 시간을 제외하지 않아서
- `updateLifespan`, `handleHungerTick`, `handleStrengthTick`에 전달되는 `elapsedSeconds`가 잘못됨

## 💡 해결 방안

### 해결책 1: `applyLazyUpdate`에서 냉장고 시간 제외 계산

**수정 위치:** `src/logic/stats/stats.js` - `applyLazyUpdate` 함수

**변경 내용:**
1. `isFrozen === true`일 때 단순히 경과 시간을 0으로 처리하는 대신
2. `frozenAt` 이후의 시간만 제외하도록 수정
3. `getElapsedTimeExcludingFridge` 함수 사용

**수정 코드:**
```javascript
export function applyLazyUpdate(stats, lastSavedAt, sleepSchedule = null, maxEnergy = null) {
  // ... 기존 코드 ...
  
  const now = new Date();
  
  // 냉장고 시간을 제외한 경과 시간 계산
  let elapsedSeconds;
  if (stats.isFrozen && stats.frozenAt) {
    // 냉장고 상태: 냉장고에 넣은 시간 이후의 시간만 제외
    const frozenTime = typeof stats.frozenAt === 'number' 
      ? stats.frozenAt 
      : new Date(stats.frozenAt).getTime();
    const takeOutTime = stats.takeOutAt 
      ? (typeof stats.takeOutAt === 'number' ? stats.takeOutAt : new Date(stats.takeOutAt).getTime())
      : now.getTime();
    
    // lastSavedAt과 frozenAt 중 더 늦은 시간부터 계산
    const effectiveStartTime = Math.max(lastSaved.getTime(), frozenTime);
    
    // 냉장고에 넣은 시간 이후의 시간은 제외
    if (effectiveStartTime >= frozenTime) {
      // 냉장고에 넣은 이후부터는 시간이 흐르지 않음
      elapsedSeconds = 0;
    } else {
      // 냉장고에 넣기 전의 시간만 계산
      elapsedSeconds = Math.floor((frozenTime - lastSaved.getTime()) / 1000);
    }
    
    // lastSavedAt을 현재 시간으로 업데이트 (냉장고 상태 유지)
    return { ...stats, lastSavedAt: now };
  }
  
  // 냉장고 상태가 아니면 일반 경과 시간 계산
  elapsedSeconds = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);
  
  // ... 나머지 로직 ...
}
```

**더 나은 방법:**
- `getElapsedTimeExcludingFridge` 함수를 `applyLazyUpdate`에서도 사용
- 냉장고 시간을 제외한 경과 시간 계산

### 해결책 2: `getElapsedTimeExcludingFridge` 함수를 `applyLazyUpdate`에서 사용

**수정 위치:** `src/logic/stats/stats.js`

**변경 내용:**
1. `getElapsedTimeExcludingFridge` 함수를 `stats.js`에 추가 또는 import
2. `applyLazyUpdate`에서 냉장고 시간을 제외한 경과 시간 계산

## 🔧 수정 완료

### ✅ 수정 1: `logic/stats/stats.js`의 `applyLazyUpdate` 수정

**수정 내용:**
- 냉장고 상태일 때 냉장고에 넣은 시간(`frozenAt`) 이후의 시간만 제외하도록 수정
- `frozenAt`이 `lastSavedAt`보다 이후인 경우, 냉장고에 넣기 전의 시간만 계산
- `frozenAt`이 `lastSavedAt`보다 이전이거나 같은 경우, 경과 시간 = 0 (냉장고에 넣은 이후의 시간만 있었음)

**수정 코드:**
```javascript:277:303:digimon-tamagotchi-frontend/src/logic/stats/stats.js
// 냉장고 시간을 제외한 경과 시간 계산
let elapsedSeconds;
if (stats.isFrozen && stats.frozenAt) {
  // 냉장고 상태: 냉장고에 넣은 시간 이후의 시간만 제외
  const frozenTime = typeof stats.frozenAt === 'number' 
    ? stats.frozenAt 
    : new Date(stats.frozenAt).getTime();
  const lastSavedTime = lastSaved.getTime();
  
  // 냉장고에 넣은 시간이 마지막 저장 시간보다 이후인 경우
  if (frozenTime > lastSavedTime) {
    // 냉장고에 넣기 전의 시간만 계산 (냉장고에 넣은 이후의 시간은 제외)
    elapsedSeconds = Math.floor((frozenTime - lastSavedTime) / 1000);
  } else {
    // 냉장고에 넣은 시간이 마지막 저장 시간보다 이전이거나 같은 경우
    // (냉장고에 넣은 후 저장했을 수 있음)
    // 냉장고에 넣은 이후의 시간은 모두 제외하므로 경과 시간 = 0
    elapsedSeconds = 0;
  }
  
  // 경과 시간이 0이면 스탯 변경 없음
  if (elapsedSeconds <= 0) {
    return { ...stats, lastSavedAt: now };
  }
} else {
  // 냉장고 상태가 아니면 일반 경과 시간 계산
  elapsedSeconds = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);
}
```

### ✅ 수정 2: `data/stats.js`의 `applyLazyUpdate` 수정

**수정 내용:**
- `useGameData.js`에서 사용하는 `applyLazyUpdate` 함수도 동일하게 수정
- 냉장고 시간을 제외한 경과 시간 계산

**중요:** 두 파일 모두 수정 필요 (`logic/stats/stats.js`와 `data/stats.js`)

### ✅ 수정 3: 냉장고 해제 시 시간 보정 (이미 구현됨)

**현재 구현:**
- `takeOutFromFridge` 함수에서 `lastSavedAt`을 현재 시간으로 업데이트
- `lastHungerZeroAt`, `lastStrengthZeroAt` 리셋 (0이었던 시간 타이머 재시작)

**추가 개선 가능:**
- 진화 시간(`timeToEvolveSeconds`) 보정은 현재 필요 없음 (냉장고 상태에서는 이미 증가하지 않음)

---

## 📝 수정 완료 체크리스트

- [x] `logic/stats/stats.js`의 `applyLazyUpdate` 수정
- [x] `data/stats.js`의 `applyLazyUpdate` 수정
- [x] 냉장고 해제 시 시간 보정 확인
- [ ] 테스트: 냉장고 상태에서 스탯 변경 없음 확인
- [ ] 테스트: 냉장고에 넣은 후 오프라인 후 복귀 시 스탯 변경 없음 확인

---

**다음 단계:** 테스트 및 검증
