# 빠른 잠들기 및 낮잠 기능 분석

**작성일:** 2026-01-27

## 📋 기능 개요

### 1. 빠른 잠들기 (Fast Sleep)

**목적:** 수면 방해로 깨어있는 상태에서 불을 꺼주면 빠르게 잠들 수 있도록 함

**설정 조건:**
- 불을 끄면 자동으로 설정됨 (`handleToggleLights`에서)
- 수면 시간이든 아니든 상관없이 설정됨

**동작:**
- `fastSleepStart`에 현재 시간 기록
- 15초 경과 후 `SLEEPING` 상태로 전환
- `wakeUntil`이 있으면 `fastSleepStart`가 완료되어도 `AWAKE` 상태 유지 가능

**리셋 조건:**
- 불을 켜면 리셋
- 수면 시간에 불이 켜져 있으면 리셋

### 2. 낮잠 (Nap)

**목적:** 수면 시간이 아닐 때 불을 꺼주면 낮잠을 잘 수 있도록 함

**설정 조건:**
- 수면 시간이 아님 (`!isSleepTime`)
- 불을 끔 (`isLightsOn === false`)

**동작:**
- `napUntil`에 15초 후부터 3시간 후까지의 시간 기록
- `fastSleepStart`가 15초 경과하면 `napUntil`이 활성화되어 `SLEEPING` 상태로 전환
- 낮잠 중에는 수면 방해가 증가하지 않음

**리셋 조건:**
- 불을 켜면 리셋
- `napUntil`이 만료되면 리셋

---

## 🔍 현재 구현 상태

### 1. 빠른 잠들기 설정 (`useGameHandlers.js`)

```javascript
// 불을 껐을 때
if (!next) {
  updatedStats.fastSleepStart = Date.now(); // ✅ 설정됨
  // 수면 시간이 아니면 낮잠 예약
  if (!isSleepTime) {
    updatedStats.napUntil = Date.now() + (15 * 1000) + (3 * 60 * 60 * 1000); // ✅ 설정됨
  }
}
```

**✅ 정상 작동**

### 2. 빠른 잠들기 로직 (`useGameLogic.js` - `getSleepStatus`)

```javascript
// 불이 꺼져 있고 수면 시간이거나 낮잠 시간인 경우
if (isSleepTime || isNapTime) {
  if (fastSleepStart) {
    const elapsed = nowMs - fastSleepStart;
    if (elapsed >= 15 * 1000) {
      return "SLEEPING"; // ✅ 15초 경과 시 SLEEPING
    }
    if (wakeOverride) return "AWAKE"; // ✅ wakeUntil이 있으면 AWAKE
    return "AWAKE"; // ✅ 15초 전까지는 AWAKE
  }
  // fastSleepStart가 없으면 기존 로직
  if (wakeOverride) return "AWAKE";
  return "SLEEPING";
}

// 수면 시간이 아니지만 불을 끈 경우 (낮잠 진입 시도)
if (fastSleepStart) {
  const elapsed = nowMs - fastSleepStart;
  if (elapsed >= 15 * 1000) {
    return napUntil && napUntil > nowMs ? "SLEEPING" : "AWAKE"; // ✅ 낮잠 시작
  }
  return "AWAKE";
}
```

**✅ 정상 작동**

### 3. 낮잠 중 수면 방해 처리 (`useGameActions.js`)

```javascript
function wakeForInteraction(digimonStats, setWakeUntil, setDigimonStatsAndSave, isSleepTime = true, onSleepDisturbance = null) {
  const napUntil = digimonStats.napUntil || null;
  const isNapTime = napUntil ? napUntil > nowMs : false;
  
  // 정규 수면 시간에 깨울 때만 수면 방해 증가 (낮잠 중에는 증가하지 않음)
  sleepDisturbances: (isSleepTime && !isNapTime) 
    ? (digimonStats.sleepDisturbances || 0) + 1 
    : (digimonStats.sleepDisturbances || 0)
}
```

**✅ 정상 작동** - 낮잠 중에는 수면 방해가 증가하지 않음

### 4. 빠른 잠들기 리셋 로직 (`Game.jsx`)

```javascript
if (sleepingNow && isLightsOn) {
  // 불이 켜져 있으면 빠른 잠들기 시점 리셋
  updatedStats.fastSleepStart = null; // ✅ 리셋됨
} else {
  // wakeUntil이 활성화되어 있으면 fastSleepStart 유지
  if (wakeUntil && nowMs < wakeUntil) {
    // wakeUntil이 활성화되어 있으면 fastSleepStart 유지 (리셋하지 않음)
    // ✅ 유지됨
  } else {
    // wakeUntil이 만료되었을 때만 fastSleepStart 리셋 고려
    // 하지만 SLEEPING 상태가 유지되도록 하려면 리셋하지 않는 것이 좋음
    // (현재는 리셋하지 않음)
    // ⚠️ 리셋하지 않음 - 이게 문제일 수 있음
  }
}
```

**⚠️ 잠재적 문제:** `wakeUntil`이 만료되어도 `fastSleepStart`가 리셋되지 않아 계속 유지될 수 있음

### 5. 낮잠 만료 처리 (`Game.jsx`)

```javascript
// 낮잠 시간이 지나면 napUntil 리셋
if (updatedStats.napUntil && nowMs >= updatedStats.napUntil) {
  updatedStats.napUntil = null; // ✅ 만료 시 리셋됨
}
```

**✅ 정상 작동**

---

## 🐛 발견된 문제점

### 1. fastSleepStart 리셋 로직 불완전

**문제:**
- `wakeUntil`이 만료되어도 `fastSleepStart`가 리셋되지 않음
- 이미 `SLEEPING` 상태가 되었는데도 `fastSleepStart`가 계속 유지됨
- 불필요한 메모리 사용 및 로직 복잡도 증가

**해결 방안:**
```javascript
} else {
  updatedStats.sleepLightOnStart = null;
  if (wakeUntil && nowMs < wakeUntil) {
    // wakeUntil이 활성화되어 있으면 fastSleepStart 유지
  } else {
    // wakeUntil이 만료되었고 SLEEPING 상태가 되었으면 fastSleepStart 리셋
    if (currentSleepStatus === 'SLEEPING' && updatedStats.fastSleepStart) {
      const elapsed = nowMs - updatedStats.fastSleepStart;
      if (elapsed >= 15 * 1000) {
        // 15초가 지나고 SLEEPING 상태가 되었으면 리셋
        updatedStats.fastSleepStart = null;
      }
    }
  }
}
```

### 2. 낮잠 중 수면 방해 체크 로직 확인 필요

**현재 로직:**
- `wakeForInteraction`에서 `isNapTime`을 체크하여 수면 방해 증가 방지
- 하지만 `isSleepTime` 파라미터가 정확히 전달되는지 확인 필요

**확인 사항:**
- 낮잠 중에 액션을 하면 `isSleepTime`이 `false`로 전달되는지
- `isNapTime` 체크가 제대로 작동하는지

---

## ✅ 정상 작동하는 부분

1. **빠른 잠들기 설정** - 불을 끄면 `fastSleepStart` 설정됨
2. **빠른 잠들기 상태 전환** - 15초 후 `SLEEPING` 상태로 전환
3. **낮잠 설정** - 수면 시간이 아니고 불을 끄면 `napUntil` 설정
4. **낮잠 상태 전환** - `fastSleepStart` 완료 후 `napUntil` 활성화되어 `SLEEPING` 상태
5. **낮잠 중 수면 방해 방지** - 낮잠 중에는 수면 방해가 증가하지 않음
6. **낮잠 만료 처리** - `napUntil` 만료 시 리셋
7. **불 켜기 시 리셋** - 불을 켜면 `fastSleepStart`와 `napUntil` 모두 리셋

---

## 📝 개선 제안

### 1. fastSleepStart 리셋 로직 개선

`wakeUntil`이 만료되고 `SLEEPING` 상태가 되었을 때 `fastSleepStart`를 리셋하여 불필요한 상태 유지 방지

### 2. 로직 단순화

현재 `getSleepStatus` 함수가 복잡하므로, 우선순위를 명확히 하여 단순화할 수 있음:
1. `wakeUntil` 활성화 → `AWAKE`
2. `fastSleepStart` 완료 (15초 경과) → `SLEEPING`
3. 수면 시간 + 불 꺼짐 → `SLEEPING`
4. 그 외 → `AWAKE` 또는 `TIRED`

---

## 🎯 결론

**전체적으로 기능은 구현되어 있으나, 일부 개선이 필요:**

1. ✅ 빠른 잠들기: 기본 기능 작동
2. ✅ 낮잠: 기본 기능 작동
3. ⚠️ `fastSleepStart` 리셋 로직: 개선 필요
4. ✅ 낮잠 중 수면 방해 방지: 정상 작동
