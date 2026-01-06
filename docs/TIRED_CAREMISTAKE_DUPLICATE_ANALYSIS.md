# TIRED 케어미스 중복 로직 분석

## 🔍 문제 제기

"수면 중 불 켜두기" 케어미스와 "TIRED 상태 지속" 케어미스가 사실상 같은 조건에서 발생하는 것으로 보입니다. 두 로직이 중복 실행되어 케어미스가 중복 증가할 가능성이 있습니다.

---

## 📊 두 로직 비교

### 1. "수면 중 불 켜두기" 케어미스

**위치**: `pages/Game.jsx` (344-364줄)

**조건**:
```javascript
const sleepingNow = inSchedule && !wakeOverride; // 309줄
if (sleepingNow && isLightsOn) { // 344줄
```

**의미**:
- `inSchedule`: 수면 시간 내 (`isWithinSleepSchedule()`)
- `!wakeOverride`: 수면 방해 중이 아님 (`wakeUntil` 없음)
- `isLightsOn`: 불이 켜져 있음

**로직**:
```javascript
if (sleepingNow && isLightsOn) {
  if (!updatedStats.sleepLightOnStart) {
    updatedStats.sleepLightOnStart = nowMs;
  } else {
    const elapsed = nowMs - updatedStats.sleepLightOnStart;
    if (elapsed >= 30 * 60 * 1000 && !dailySleepMistake && !updatedStats.dailySleepMistake) {
      updatedStats.careMistakes = (updatedStats.careMistakes || 0) + 1;
      updatedStats.dailySleepMistake = true;
      setDailySleepMistake(true);
      updatedStats.sleepLightOnStart = nowMs; // ⚠️ 리셋!
    }
  }
}
```

**특징**:
- `sleepLightOnStart`를 사용하여 30분 경과 체크
- `dailySleepMistake` 플래그로 하루 1회 제한
- 케어미스 증가 후 `sleepLightOnStart`를 현재 시간으로 리셋 (353줄)
- **리셋 후 다시 30분이 지나면 또 증가 가능**

**실행 시점**: 1초마다 실행되는 타이머 내부

---

### 2. "TIRED 상태 지속" 케어미스

**위치**: `pages/Game.jsx` (921-956줄)

**조건**:
```javascript
const status = getSleepStatus({
  sleepSchedule: getSleepSchedule(selectedDigimon, digimonDataVer1),
  isLightsOn,
  wakeUntil,
  fastSleepStart: digimonStats.fastSleepStart || null,
  now: new Date(),
});

if (status === "TIRED") { // 933줄
```

**의미** (`getSleepStatus` 함수 분석):
```javascript
// useGameLogic.js (13-53줄)
export function getSleepStatus({ sleepSchedule, isLightsOn, wakeUntil, fastSleepStart = null, now = new Date() }) {
  // 수면 시간이 아니면 AWAKE
  if (!isSleepTime) return "AWAKE";
  
  // 빠른 잠들기 중이면 SLEEPING
  if (!isLightsOn && fastSleepStart) {
    if (elapsedSinceFastSleepStart >= 10 * 1000) {
      return "SLEEPING";
    }
  }
  
  // 수면 방해 중이면 AWAKE
  if (wakeOverride) {
    return "AWAKE";
  }
  
  // 수면 시간이고 수면 방해가 없을 때
  if (isLightsOn) return "TIRED"; // 51줄
  return "SLEEPING";
}
```

**의미**:
- 수면 시간 내
- `fastSleepStart`가 없거나 불이 켜져 있음 (빠른 잠들기 중이 아님)
- `wakeOverride`가 없음 (수면 방해 중이 아님)
- `isLightsOn === true` (불이 켜져 있음)

**로직**:
```javascript
if (status === "TIRED") {
  if (!tiredStartRef.current) {
    tiredStartRef.current = Date.now();
    tiredCountedRef.current = false;
  }
  const threshold = developerMode ? 60 * 1000 : 30 * 60 * 1000;
  if (!tiredCountedRef.current && tiredStartRef.current && (Date.now() - tiredStartRef.current) >= threshold) {
    tiredCountedRef.current = true;
    // 케어미스 증가
    setDigimonStatsAndSave({
      ...digimonStats,
      careMistakes: (digimonStats.careMistakes || 0) + 1,
      activityLogs: updatedLogs,
    }, updatedLogs);
  }
} else {
  tiredStartRef.current = null;
  tiredCountedRef.current = false;
}
```

**특징**:
- `tiredStartRef.current`를 사용하여 30분 경과 체크
- `tiredCountedRef.current` 플래그로 1회만 증가
- TIRED 상태가 해제되면 리셋 (951-952줄)
- **TIRED 상태가 계속 유지되면 한 번만 증가**

**실행 시점**: 1초마다 실행되는 별도의 `useEffect` 내부

---

## 🔄 조건 비교

### "수면 중 불 켜두기" 조건
```
sleepingNow && isLightsOn
= (inSchedule && !wakeOverride) && isLightsOn
= 수면 시간 && !수면 방해 && 불 켜짐
```

### "TIRED 상태 지속" 조건
```
status === "TIRED"
= 수면 시간 && !빠른 잠들기 && !수면 방해 && 불 켜짐
```

### 차이점
- **빠른 잠들기 (`fastSleepStart`)**: TIRED 로직만 체크
  - 빠른 잠들기 중이면 `status === "SLEEPING"`이 되어 TIRED 케어미스는 발생하지 않음
  - 하지만 "수면 중 불 켜두기" 로직은 `fastSleepStart`를 체크하지 않음

### 거의 동일한 조건
대부분의 경우 두 조건은 **거의 동일**합니다:
- 수면 시간 내
- 불이 켜져 있음
- 수면 방해 중이 아님

---

## ⚠️ 중복 실행 가능성

### 시나리오 1: 정상적인 경우
1. 수면 시간 시작, 불 켜짐
2. `sleepingNow && isLightsOn` = true → "수면 중 불 켜두기" 로직 시작
3. `status === "TIRED"` = true → "TIRED 상태 지속" 로직 시작
4. 30분 경과
5. **두 로직 모두 케어미스 증가 시도!**

### 시나리오 2: 빠른 잠들기 중
1. 수면 시간 시작, 불 켜짐
2. `sleepingNow && isLightsOn` = true → "수면 중 불 켜두기" 로직 시작
3. 불을 꺼서 `fastSleepStart` 설정
4. `status === "SLEEPING"` → "TIRED 상태 지속" 로직은 실행 안 됨
5. 하지만 "수면 중 불 켜두기" 로직은 `sleepLightOnStart`를 리셋하지 않음 (불이 꺼지면 359줄에서 리셋)
6. **중복 없음**

### 시나리오 3: 케어미스 증가 후
1. "수면 중 불 켜두기" 로직: `sleepLightOnStart`를 현재 시간으로 리셋 (353줄)
2. "TIRED 상태 지속" 로직: `tiredCountedRef.current = true`로 설정 (940줄)
3. 30분 후:
   - "수면 중 불 켜두기": `dailySleepMistake`가 true이므로 증가 안 함
   - "TIRED 상태 지속": `tiredCountedRef.current`가 true이므로 증가 안 함
4. **하지만 첫 30분 동안은 중복 가능!**

---

## 🐛 실제 문제점

### 1. 첫 30분 동안 중복 증가 가능
- 두 로직이 **독립적으로** 실행됨
- 같은 조건에서 **동시에** 케어미스 증가 시도
- `dailySleepMistake`와 `tiredCountedRef.current`가 **서로 다른 플래그**이므로 중복 방지 안 됨

### 2. 리셋 로직의 차이
- "수면 중 불 켜두기": 케어미스 증가 후 `sleepLightOnStart`를 현재 시간으로 리셋 → **다시 30분 후 또 증가 가능**
- "TIRED 상태 지속": TIRED 상태가 해제되면 리셋 → **TIRED 상태가 계속 유지되면 한 번만 증가**

### 3. 실행 타이밍 차이
- "수면 중 불 켜두기": 타이머 내부에서 실행 (1초마다)
- "TIRED 상태 지속": 별도의 `useEffect`에서 실행 (1초마다)
- **거의 동시에 실행**되지만 완전히 동일한 타이밍은 아님

---

## 💡 해결 방안

### 방안 1: 하나의 로직만 사용 (권장)

**"수면 중 불 켜두기" 로직 제거**
- TIRED 상태 지속 로직만 사용
- `dailySleepMistake` 플래그는 유지 (하루 1회 제한)

**장점**:
- 중복 제거
- 로직 단순화
- `getSleepStatus()` 함수를 사용하므로 일관성 유지

**단점**:
- 기존 코드 수정 필요

### 방안 2: 공통 플래그 사용

두 로직이 같은 플래그를 공유하도록 수정:
```javascript
// 두 로직 모두 dailySleepMistake를 체크
if (elapsed >= 30 * 60 * 1000 && !dailySleepMistake && !updatedStats.dailySleepMistake) {
  // 케어미스 증가
}
```

**장점**:
- 최소한의 수정
- 하루 1회 제한 유지

**단점**:
- 두 로직이 여전히 독립적으로 실행됨
- 리셋 로직의 차이로 인한 혼란 가능

### 방안 3: 조건 통합

"수면 중 불 켜두기" 로직에 `fastSleepStart` 체크 추가:
```javascript
if (sleepingNow && isLightsOn && !fastSleepStart) {
  // 케어미스 증가
}
```

**장점**:
- 조건 일치
- 빠른 잠들기 중에는 케어미스 발생 안 함

**단점**:
- 여전히 두 로직이 독립적으로 실행됨
- 중복 가능성은 여전히 존재

---

## 📝 권장 사항

**방안 1을 권장합니다.**

1. "수면 중 불 켜두기" 로직 제거 (344-364줄)
2. "TIRED 상태 지속" 로직에 `dailySleepMistake` 체크 추가
3. `sleepLightOnStart`는 UI 표시용으로만 사용

**수정 예시**:
```javascript
// TIRED 상태 지속 로직 수정
if (status === "TIRED") {
  if (!tiredStartRef.current) {
    tiredStartRef.current = Date.now();
    tiredCountedRef.current = false;
  }
  const threshold = developerMode ? 60 * 1000 : 30 * 60 * 1000;
  if (!tiredCountedRef.current && 
      !dailySleepMistake && 
      !digimonStats.dailySleepMistake &&
      tiredStartRef.current && 
      (Date.now() - tiredStartRef.current) >= threshold) {
    tiredCountedRef.current = true;
    // 케어미스 증가
    setDigimonStatsAndSave({
      ...digimonStats,
      careMistakes: (digimonStats.careMistakes || 0) + 1,
      dailySleepMistake: true,
      activityLogs: updatedLogs,
    }, updatedLogs);
  }
}
```

---

## ✅ 결론

**두 로직은 사실상 같은 조건에서 실행되며, 중복으로 케어미스가 증가할 가능성이 있습니다.**

- 조건이 거의 동일함 (빠른 잠들기 체크 차이만 있음)
- 독립적으로 실행되어 중복 증가 가능
- 서로 다른 플래그를 사용하여 중복 방지 안 됨

**해결책**: 하나의 로직만 사용하거나, 공통 플래그를 사용하여 중복을 방지해야 합니다.

