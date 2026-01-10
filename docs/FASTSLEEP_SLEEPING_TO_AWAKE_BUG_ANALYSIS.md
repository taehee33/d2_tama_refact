# 빠른 잠들기 완료 후 SLEEPING → AWAKE 전환 버그 분석

## 🐛 문제 상황

**현상:**
- 빠른 잠들기(`fastSleepStart`)가 완료됨 (15초 경과)
- `sleepStatus`가 `"SLEEPING"`으로 전환됨
- 하지만 바로 다음 사이클에서 `"AWAKE"`로 다시 전환됨
- "수면 방해 중: X분 X초 후 다시 잠들 예정" 메시지가 계속 표시됨

**예상 동작:**
- `fastSleepStart`가 완료되면 `wakeUntil`과 관계없이 `SLEEPING` 상태 유지

**실제 동작:**
- `SLEEPING` 상태가 되었다가 바로 `AWAKE`로 전환됨

## 📋 코드 분석

### 1. `getSleepStatus` 함수 (useGameLogic.js 59-75줄)

```javascript
if (isSleepTime || isNapTime) {
  // fastSleepStart가 완료되었으면 wakeUntil보다 우선순위가 높음 (즉시 잠듦)
  if (fastSleepStart) {
    const elapsed = nowMs - fastSleepStart;
    if (elapsed >= 15 * 1000) {
      return "SLEEPING"; // ✅ 15초 경과 시 wakeUntil과 관계없이 잠듦
    }
    // 15초 전까지는 wakeUntil이 있으면 깨어있음
    if (wakeOverride) return "AWAKE";
    return "AWAKE"; // 15초 전까지는 깨어있음
  }
  
  // fastSleepStart가 없으면 기존 로직대로
  if (wakeOverride) return "AWAKE"; // ⚠️ 여기서 문제 발생 가능
  return "SLEEPING";
}
```

**분석:**
- ✅ `fastSleepStart`가 있고 15초가 지나면 `"SLEEPING"` 반환
- ⚠️ 하지만 `fastSleepStart`가 `null`이면 `wakeOverride` 체크로 인해 `"AWAKE"` 반환

### 2. `Game.jsx` 타이머에서 `fastSleepStart` 리셋 로직 (399-416줄)

```javascript
} else {
  updatedStats.sleepLightOnStart = null;
  // wakeUntil이 만료되고 실제로 SLEEPING 상태가 되면 빠른 잠들기 시점 리셋
  // 단, fastSleepStart가 설정되어 있고 15초가 지나지 않았으면 유지
  if (!wakeUntil || nowMs >= wakeUntil) {
    // fastSleepStart가 완료되어 SLEEPING 상태가 되었는지 확인
    if (currentSleepStatus === 'SLEEPING' && updatedStats.fastSleepStart) {
      const elapsed = nowMs - updatedStats.fastSleepStart;
      if (elapsed >= 15 * 1000) {
        // 15초가 지나고 SLEEPING 상태가 되면 리셋
        updatedStats.fastSleepStart = null; // ⚠️ 여기서 리셋됨!
      }
    }
    // wakeUntil이 만료되었지만 아직 SLEEPING 상태가 아니면 fastSleepStart 유지
  }
  // wakeUntil이 활성화되어 있으면 fastSleepStart 유지 (리셋하지 않음)
}
```

**문제점:**
1. `wakeUntil`이 만료되지 않았어도 (`!wakeUntil || nowMs >= wakeUntil` 조건이 `false`여도)
2. 다른 로직에서 `fastSleepStart`가 리셋될 수 있음
3. `fastSleepStart`가 리셋되면 다음 `getSleepStatus` 호출에서 `fastSleepStart`가 `null`이 되어
4. `wakeOverride`가 `true`이면 `"AWAKE"` 반환

### 3. `fastSleepStart` 보존 로직 (Game.jsx 335-339줄)

```javascript
// fastSleepStart 보존 (타이머에서 업데이트 시 유지)
updatedStats.fastSleepStart = prevStats.fastSleepStart || null;

// napUntil 보존 (타이머에서 업데이트 시 유지)
updatedStats.napUntil = prevStats.napUntil || null;
```

**분석:**
- ✅ 타이머 시작 부분에서 `fastSleepStart`를 보존
- ⚠️ 하지만 이후 로직에서 리셋될 수 있음

## 🔍 문제 원인

### 원인 1: `fastSleepStart`가 너무 빨리 리셋됨

**시나리오:**
1. `fastSleepStart`가 15초를 넘어서 `SLEEPING` 상태가 됨
2. `Game.jsx` 타이머에서 `currentSleepStatus === 'SLEEPING'`이고 `elapsed >= 15 * 1000`이면
3. `updatedStats.fastSleepStart = null`로 리셋
4. 다음 타이머 사이클에서 `getSleepStatus` 호출 시 `fastSleepStart`가 `null`
5. `wakeUntil`이 아직 활성화되어 있으면 `wakeOverride === true`
6. `getSleepStatus`에서 `fastSleepStart`가 없으므로 `wakeOverride` 체크로 `"AWAKE"` 반환

**문제:**
- `wakeUntil`이 아직 활성화되어 있는데 `fastSleepStart`를 리셋하면 안 됨
- `fastSleepStart`가 리셋되면 `wakeUntil` 때문에 다시 `AWAKE`로 전환됨

### 원인 2: `wakeUntil`이 만료되지 않았는데 리셋 조건 체크

**현재 코드:**
```javascript
if (!wakeUntil || nowMs >= wakeUntil) {
  // fastSleepStart 리셋 로직
}
```

**문제:**
- `wakeUntil`이 활성화되어 있으면 (`nowMs < wakeUntil`) 이 블록이 실행되지 않음
- 하지만 다른 곳에서 리셋될 수 있음

### 원인 3: `fastSleepStart` 보존 로직의 순서 문제

**현재 순서:**
1. `fastSleepStart` 보존 (335줄)
2. 다른 로직 실행
3. `fastSleepStart` 리셋 (409줄)

**문제:**
- 보존 후 리셋되면 의미가 없음

## 💡 해결 방안

### 해결책 1: `wakeUntil`이 활성화되어 있으면 `fastSleepStart`를 리셋하지 않음

**수정 위치:** `Game.jsx` 399-416줄

```javascript
} else {
  updatedStats.sleepLightOnStart = null;
  // wakeUntil이 활성화되어 있으면 fastSleepStart를 리셋하지 않음
  // (fastSleepStart가 완료되어 SLEEPING 상태가 되어도 wakeUntil이 있으면 유지)
  if (wakeUntil && nowMs < wakeUntil) {
    // wakeUntil이 활성화되어 있으면 fastSleepStart 유지
    // (리셋하지 않음)
  } else {
    // wakeUntil이 만료되었을 때만 fastSleepStart 리셋
    if (currentSleepStatus === 'SLEEPING' && updatedStats.fastSleepStart) {
      const elapsed = nowMs - updatedStats.fastSleepStart;
      if (elapsed >= 15 * 1000) {
        // 15초가 지나고 SLEEPING 상태가 되면 리셋
        updatedStats.fastSleepStart = null;
      }
    }
  }
}
```

### 해결책 2: `fastSleepStart`가 완료되어 `SLEEPING` 상태가 되면 `wakeUntil` 무시

**수정 위치:** `useGameLogic.js` 59-75줄

```javascript
if (isSleepTime || isNapTime) {
  // fastSleepStart가 완료되었으면 wakeUntil보다 우선순위가 높음 (즉시 잠듦)
  if (fastSleepStart) {
    const elapsed = nowMs - fastSleepStart;
    if (elapsed >= 15 * 1000) {
      // 15초 경과 시 wakeUntil과 관계없이 SLEEPING 유지
      // fastSleepStart가 리셋되어도 SLEEPING 상태 유지
      return "SLEEPING";
    }
    // 15초 전까지는 wakeUntil이 있으면 깨어있음
    if (wakeOverride) return "AWAKE";
    return "AWAKE";
  }
  
  // fastSleepStart가 없으면 기존 로직대로
  if (wakeOverride) return "AWAKE";
  return "SLEEPING";
}
```

**문제:**
- `fastSleepStart`가 리셋되면 이 로직이 작동하지 않음

### 해결책 3: `fastSleepStart`를 리셋하지 않고 유지 (권장)

**수정 위치:** `Game.jsx` 399-416줄

```javascript
} else {
  updatedStats.sleepLightOnStart = null;
  // wakeUntil이 활성화되어 있으면 fastSleepStart를 절대 리셋하지 않음
  // fastSleepStart가 완료되어 SLEEPING 상태가 되어도 wakeUntil이 있으면 유지
  // (wakeUntil이 만료되면 자연스럽게 SLEEPING 상태 유지)
  if (!wakeUntil || nowMs >= wakeUntil) {
    // wakeUntil이 만료되었을 때만 fastSleepStart 리셋 고려
    // 하지만 SLEEPING 상태가 유지되도록 하려면 리셋하지 않는 것이 좋음
    // fastSleepStart는 불을 켜거나 명시적으로 리셋할 때만 리셋
  }
  // wakeUntil이 활성화되어 있으면 fastSleepStart 유지 (리셋하지 않음)
}
```

**핵심:**
- `wakeUntil`이 활성화되어 있으면 `fastSleepStart`를 리셋하지 않음
- `fastSleepStart`가 완료되어 `SLEEPING` 상태가 되면, `wakeUntil`이 있어도 `SLEEPING` 유지
- `wakeUntil`이 만료되면 자연스럽게 `SLEEPING` 상태 유지

## 🎯 권장 해결책

**해결책 3 (fastSleepStart 유지) + 해결책 1 (wakeUntil 체크)**

1. `wakeUntil`이 활성화되어 있으면 `fastSleepStart`를 절대 리셋하지 않음
2. `fastSleepStart`가 완료되어 `SLEEPING` 상태가 되면, `wakeUntil`이 있어도 `SLEEPING` 유지
3. `fastSleepStart`는 불을 켜거나 명시적으로 리셋할 때만 리셋

이렇게 하면:
- 빠른 잠들기가 완료되면 `SLEEPING` 상태 유지
- `wakeUntil`이 활성화되어 있어도 `SLEEPING` 상태 유지
- `wakeUntil`이 만료되면 자연스럽게 `SLEEPING` 상태 유지

## 📊 수정 전/후 비교

### 수정 전

| 단계 | fastSleepStart | wakeUntil | sleepStatus | 문제 |
|------|----------------|-----------|-------------|------|
| 1. 불 끄기 | 설정됨 | 활성 | AWAKE | 정상 |
| 2. 15초 경과 | 설정됨 | 활성 | SLEEPING | 정상 |
| 3. 타이머 실행 | **리셋됨** | 활성 | **AWAKE** | ❌ 버그 |

### 수정 후

| 단계 | fastSleepStart | wakeUntil | sleepStatus | 결과 |
|------|----------------|-----------|-------------|------|
| 1. 불 끄기 | 설정됨 | 활성 | AWAKE | 정상 |
| 2. 15초 경과 | 설정됨 | 활성 | SLEEPING | 정상 |
| 3. 타이머 실행 | **유지됨** | 활성 | **SLEEPING** | ✅ 정상 |
| 4. wakeUntil 만료 | 유지됨 | 만료 | SLEEPING | 정상 |

## ✅ 결론

**문제 원인:**
- `Game.jsx` 타이머에서 `fastSleepStart`가 완료되어 `SLEEPING` 상태가 되면 리셋
- `fastSleepStart`가 리셋되면 다음 `getSleepStatus` 호출에서 `wakeUntil` 때문에 `AWAKE` 반환

**해결 방법:**
- `wakeUntil`이 활성화되어 있으면 `fastSleepStart`를 리셋하지 않음
- `fastSleepStart`가 완료되어 `SLEEPING` 상태가 되면, `wakeUntil`이 있어도 `SLEEPING` 유지
