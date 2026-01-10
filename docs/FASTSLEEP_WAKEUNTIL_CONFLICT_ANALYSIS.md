# 빠른 잠들기(fastSleepStart)와 수면 방해(wakeUntil) 충돌 분석

## 🐛 문제 상황

**현상:**
- 불이 꺼져 있음 (`isLightsOn === false`)
- `fastSleepStart` 카운트다운이 완료됨 (15초 경과)
- UI에 "잠들기: X초 후 잠들어요" 또는 "빠른 잠들기: X초 후 자동으로 잠듭니다" 표시
- 하지만 `sleepStatus`는 여전히 `"AWAKE"`로 유지됨
- "수면 방해 중: X분 X초 후 다시 잠들 예정" 메시지 표시

**사용자 기대:**
- `fastSleepStart` 카운트다운이 완료되면 디지몬이 `SLEEPING` 상태로 전환되어야 함

**실제 동작:**
- `wakeUntil`이 활성화되어 있으면 `fastSleepStart`가 완료되어도 `AWAKE` 상태 유지

## 📋 현재 코드 분석

### `getSleepStatus` 함수 (useGameLogic.js 56-72줄)

```javascript
// 불이 꺼져 있는 경우
if (!isLightsOn) {
  // A. 수면 시간 혹은 낮잠 시간인 경우
  if (isSleepTime || isNapTime) {
    if (wakeOverride) return "AWAKE"; // ⚠️ 여기서 먼저 체크!
    
    // 빠른 잠들기 체크 (15초)
    if (fastSleepStart) {
      const elapsed = nowMs - fastSleepStart;
      if (elapsed >= 15 * 1000) {
        return "SLEEPING"; // ⚠️ 이 코드는 실행되지 않음!
      }
      return "AWAKE";
    }
    
    return "SLEEPING";
  }
  // ...
}
```

### 문제점

**우선순위 문제:**
1. `wakeOverride` (즉, `wakeUntil`이 활성화되어 있으면) 체크가 **먼저** 실행됨 (60줄)
2. `wakeOverride === true`이면 무조건 `"AWAKE"` 반환하고 함수 종료
3. `fastSleepStart` 체크 (63-69줄)는 **실행되지 않음**

**결과:**
- `fastSleepStart`가 15초를 넘어도 `wakeUntil`이 활성화되어 있으면 `"AWAKE"` 상태 유지
- UI에서는 "잠들기 준비 중" 메시지가 표시되지만 실제로는 잠들 수 없음

## 🔍 UI 표시 로직 (StatsPopup.jsx)

### "잠들기" 필드 (572-584줄)

```javascript
<li>잠들기: {(() => {
  // fastSleepStart가 있고 불이 꺼져 있고 15초가 지나지 않았을 때
  if (fastSleepStart && !isLightsOn) {
    const elapsed = currentTime - fastSleepStart;
    const remainingSeconds = Math.max(0, 15 - Math.floor(elapsed / 1000));
    if (remainingSeconds > 0 && remainingSeconds <= 15) {
      return <span className="text-blue-500 font-semibold">{remainingSeconds}초 후 잠들어요</span>;
    }
  }
  // 조건이 아닐 때 수면 상태 값 그대로 표시
  const statusText = sleepStatus === 'AWAKE' ? 'AWAKE' : ...;
  return <span className="text-gray-500">{statusText}</span>;
})()}</li>
```

**문제:**
- `fastSleepStart`가 있고 15초가 지나지 않았으면 카운트다운 표시
- 하지만 15초가 지나도 `wakeUntil` 때문에 `sleepStatus`는 여전히 `"AWAKE"`
- 카운트다운이 0이 되면 `sleepStatus`를 그대로 표시하므로 `"AWAKE"` 표시

### "빠른 잠들기" 메시지 (624-635줄)

```javascript
{wakeUntil && currentTime < wakeUntil && !isLightsOn && stats.fastSleepStart && (() => {
  const elapsedSinceFastSleepStart = currentTime - stats.fastSleepStart;
  const remainingSeconds = Math.max(0, 10 - Math.floor(elapsedSinceFastSleepStart / 1000));
  if (remainingSeconds > 0 && remainingSeconds <= 10) {
    return (
      <li className="text-green-600 text-sm">
        💡 빠른 잠들기: {remainingSeconds}초 후 자동으로 잠듭니다
      </li>
    );
  }
  return null;
})()}
```

**문제:**
- `wakeUntil`이 활성화되어 있을 때만 표시됨
- 10초 카운트다운이 완료되어도 실제로는 잠들지 않음 (15초가 아니라 10초로 표시되는 것도 불일치)

## 💡 설계 의도 분석

### 현재 설계의 의도

1. **`wakeUntil`의 목적:**
   - 수면 방해 후 일정 시간(기본 10분) 동안 강제로 깨어있게 함
   - 수면 방해 페널티를 확실히 적용

2. **`fastSleepStart`의 목적:**
   - 불을 끄면 15초 후 빠르게 잠들 수 있게 함
   - 정규 수면 시간이 아니어도 낮잠 가능

### 충돌 상황

**시나리오:**
1. 디지몬이 잠자는 중
2. 사용자가 먹이를 줌 → `wakeUntil` 설정 (10분간 깨어있음)
3. 사용자가 불을 끔 → `fastSleepStart` 설정
4. 15초 후 → `fastSleepStart` 완료
5. 하지만 `wakeUntil`이 아직 활성화되어 있음

**현재 동작:**
- `wakeUntil` 우선 → `"AWAKE"` 상태 유지

**사용자 기대:**
- `fastSleepStart` 완료 → `"SLEEPING"` 상태로 전환

## 🎯 해결 방안

### 옵션 1: `wakeUntil` 우선 유지 (현재 동작)

**장점:**
- 수면 방해 페널티가 확실히 적용됨
- 로직이 단순하고 예측 가능함

**단점:**
- UI와 실제 동작이 불일치하여 혼란스러움
- 사용자가 불을 껐는데도 잠들지 않아서 이상하게 느낌

**개선:**
- UI에서 `wakeUntil`이 활성화되어 있으면 `fastSleepStart` 카운트다운을 표시하지 않음
- 또는 "수면 방해 회복 중이므로 잠들 수 없음" 메시지 표시

### 옵션 2: `fastSleepStart` 우선

**장점:**
- 사용자가 불을 끄면 빠르게 잠들 수 있어 직관적
- UI와 실제 동작이 일치

**단점:**
- 수면 방해 페널티가 약해짐
- `wakeUntil`의 의미가 약해짐

**구현:**
```javascript
if (isSleepTime || isNapTime) {
  // fastSleepStart가 완료되면 wakeUntil 무시하고 SLEEPING
  if (fastSleepStart) {
    const elapsed = nowMs - fastSleepStart;
    if (elapsed >= 15 * 1000) {
      return "SLEEPING";
    }
  }
  if (wakeOverride) return "AWAKE";
  // ...
}
```

### 옵션 3: `wakeUntil` 만료 시점에만 `fastSleepStart` 적용

**장점:**
- 수면 방해 페널티 유지
- `wakeUntil` 만료 후 즉시 잠들 수 있음

**단점:**
- 로직이 복잡해짐

**구현:**
```javascript
if (isSleepTime || isNapTime) {
  if (wakeOverride) {
    // wakeUntil이 곧 만료되고 fastSleepStart가 완료되었으면 SLEEPING
    const wakeUntilMs = new Date(wakeUntil).getTime();
    const timeUntilWakeExpires = wakeUntilMs - nowMs;
    if (fastSleepStart && timeUntilWakeExpires <= 0) {
      const elapsed = nowMs - fastSleepStart;
      if (elapsed >= 15 * 1000) {
        return "SLEEPING";
      }
    }
    return "AWAKE";
  }
  // ...
}
```

### 옵션 4: UI 개선 (권장)

**현재 동작 유지하되 UI만 개선:**

1. `wakeUntil`이 활성화되어 있으면 `fastSleepStart` 카운트다운을 표시하지 않음
2. 대신 "수면 방해 회복 중: X분 X초 후 잠들 수 있음" 메시지 표시
3. `wakeUntil` 만료 후 `fastSleepStart`가 완료되어 있으면 즉시 `SLEEPING` 상태로 전환

**구현 예시:**
```javascript
// StatsPopup.jsx - "잠들기" 필드
<li>잠들기: {(() => {
  // wakeUntil이 활성화되어 있으면 fastSleepStart 카운트다운 표시 안 함
  if (wakeUntil && currentTime < wakeUntil) {
    return <span className="text-orange-500">수면 방해 회복 중 (잠들 수 없음)</span>;
  }
  
  // wakeUntil이 없을 때만 fastSleepStart 카운트다운 표시
  if (fastSleepStart && !isLightsOn) {
    const elapsed = currentTime - fastSleepStart;
    const remainingSeconds = Math.max(0, 15 - Math.floor(elapsed / 1000));
    if (remainingSeconds > 0 && remainingSeconds <= 15) {
      return <span className="text-blue-500 font-semibold">{remainingSeconds}초 후 잠들어요</span>;
    }
  }
  // ...
})()}</li>
```

## ✅ 권장 해결책

**옵션 4 (UI 개선) + 옵션 3 (wakeUntil 만료 시 fastSleepStart 적용) 조합:**

1. **UI 개선:**
   - `wakeUntil`이 활성화되어 있으면 `fastSleepStart` 카운트다운을 표시하지 않음
   - "수면 방해 회복 중" 메시지로 대체

2. **로직 개선:**
   - `wakeUntil` 만료 시점에 `fastSleepStart`가 완료되어 있으면 즉시 `SLEEPING` 상태로 전환
   - 이렇게 하면 수면 방해 페널티는 유지하면서도 사용자가 불을 껐을 때의 기대를 만족시킬 수 있음

## 📊 수정 전/후 비교

### 수정 전

| 조건 | wakeUntil | fastSleepStart | sleepStatus | UI 표시 |
|------|-----------|----------------|-------------|---------|
| 수면 방해 중 | 활성 | 15초 미완료 | AWAKE | "잠들기: X초 후 잠들어요" |
| 수면 방해 중 | 활성 | 15초 완료 | AWAKE ❌ | "잠들기: AWAKE" (혼란) |

### 수정 후 (옵션 4)

| 조건 | wakeUntil | fastSleepStart | sleepStatus | UI 표시 |
|------|-----------|----------------|-------------|---------|
| 수면 방해 중 | 활성 | 15초 미완료 | AWAKE | "잠들기: 수면 방해 회복 중" |
| 수면 방해 중 | 활성 | 15초 완료 | AWAKE | "잠들기: 수면 방해 회복 중" |
| 수면 방해 만료 | 비활성 | 15초 완료 | SLEEPING ✅ | "잠들기: SLEEPING" |

## 🎯 결론

**현재 문제는 `wakeUntil`과 `fastSleepStart`의 우선순위 충돌입니다.**

**원인:**
- `getSleepStatus`에서 `wakeOverride` 체크가 `fastSleepStart` 체크보다 먼저 실행됨
- UI에서는 `fastSleepStart` 카운트다운을 표시하지만 실제로는 `wakeUntil` 때문에 잠들 수 없음

**해결:**
1. UI에서 `wakeUntil`이 활성화되어 있으면 `fastSleepStart` 카운트다운을 표시하지 않음
2. `wakeUntil` 만료 시점에 `fastSleepStart`가 완료되어 있으면 즉시 `SLEEPING` 상태로 전환

이렇게 하면 수면 방해 페널티는 유지하면서도 사용자 경험을 개선할 수 있습니다.
