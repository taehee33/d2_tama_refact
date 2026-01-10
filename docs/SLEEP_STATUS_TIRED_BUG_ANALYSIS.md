# 수면 방해 중 TIRED 상태 버그 분석

## 🐛 문제 상황

**현상:**
- 수면 방해 중 (`wakeUntil`이 있고 아직 만료되지 않음)
- 불이 켜져 있음 (`isLightsOn === true`)
- 수면 시간임 (`isSleepTime === true`)
- **예상:** `sleepStatus === 'AWAKE'`
- **실제:** `sleepStatus === 'TIRED'`

## 📋 현재 코드 분석

### `getSleepStatus` 함수 (useGameLogic.js 32-84줄)

```javascript
export function getSleepStatus({ sleepSchedule, isLightsOn, wakeUntil, fastSleepStart = null, napUntil = null, now = new Date() }) {
  const hour = now.getHours();
  const { start = 22, end = 6 } = sleepSchedule || { start: 22, end: 6 };
  const nowMs = now.getTime();

  const wakeOverride = wakeUntil ? new Date(wakeUntil).getTime() > nowMs : false;

  const isSleepTime = (() => {
    if (start === end) return false;
    if (start < end) return hour >= start && hour < end;
    return hour >= start || hour < end;
  })();

  const isNapTime = napUntil ? napUntil > nowMs : false;

  // ⚠️ 문제: 불이 켜져 있을 때 wakeOverride 체크를 하지 않음!
  if (isLightsOn) {
    return isSleepTime ? "TIRED" : "AWAKE";
  }

  // 불이 꺼져 있는 경우
  if (!isLightsOn) {
    // A. 수면 시간 혹은 낮잠 시간인 경우
    if (isSleepTime || isNapTime) {
      if (wakeOverride) return "AWAKE"; // ✅ 여기서는 체크함
      // ...
    }
    // ...
  }

  return "AWAKE";
}
```

## 🔍 문제점

### 1. 불이 켜져 있을 때 로직 (48-51줄)

**현재 코드:**
```javascript
if (isLightsOn) {
  return isSleepTime ? "TIRED" : "AWAKE";
}
```

**문제:**
- `wakeOverride` (수면 방해 중) 체크를 하지 않음
- 수면 시간이고 불이 켜져 있으면 무조건 `"TIRED"` 반환
- 수면 방해 중이어도 `"TIRED"` 반환됨

### 2. 불이 꺼져 있을 때 로직 (54-69줄)

**현재 코드:**
```javascript
if (!isLightsOn) {
  if (isSleepTime || isNapTime) {
    if (wakeOverride) return "AWAKE"; // ✅ 수면 방해 중 체크
    // ...
  }
}
```

**정상 동작:**
- `wakeOverride`가 있으면 `"AWAKE"` 반환
- 수면 방해 중일 때 올바르게 처리됨

## 💡 해결 방안

### 수정 방법

불이 켜져 있을 때도 `wakeOverride`를 체크해야 합니다:

```javascript
// 불이 켜져 있으면 무조건 깨어있거나 피곤한 상태
if (isLightsOn) {
  // 수면 방해 중이면 AWAKE
  if (wakeOverride) return "AWAKE";
  // 수면 시간이면 TIRED
  return isSleepTime ? "TIRED" : "AWAKE";
}
```

## 📊 수정 전/후 비교

### 수정 전

| 조건 | isLightsOn | isSleepTime | wakeOverride | 반환값 |
|------|-----------|-------------|-------------|--------|
| 수면 방해 중 | true | true | true | ❌ TIRED (버그) |
| 정상 수면 시간 | true | true | false | ✅ TIRED |
| 낮 시간 | true | false | false | ✅ AWAKE |

### 수정 후

| 조건 | isLightsOn | isSleepTime | wakeOverride | 반환값 |
|------|-----------|-------------|-------------|--------|
| 수면 방해 중 | true | true | true | ✅ AWAKE |
| 정상 수면 시간 | true | true | false | ✅ TIRED |
| 낮 시간 | true | false | false | ✅ AWAKE |

## 🎯 예상 동작

### 시나리오: 수면 방해 중

1. 수면 시간 시작 (22:00)
2. 불이 켜져 있음 → `"TIRED"` 상태 (정상)
3. 사용자가 디지몬과 상호작용 (먹이, 훈련 등)
4. `wakeUntil` 설정 (현재 시간 + 10분)
5. **현재:** `"TIRED"` 상태 유지 (버그)
6. **수정 후:** `"AWAKE"` 상태로 변경 (정상)

## ✅ 결론

**원인:** `getSleepStatus` 함수에서 불이 켜져 있을 때 `wakeOverride` (수면 방해 중) 체크를 하지 않아서 발생하는 버그입니다.

**해결:** 불이 켜져 있을 때도 `wakeOverride`를 먼저 체크하여 수면 방해 중이면 `"AWAKE"`를 반환하도록 수정해야 합니다.
