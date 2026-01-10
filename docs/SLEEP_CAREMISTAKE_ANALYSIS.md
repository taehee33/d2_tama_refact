# 수면상태확인 케어미스 vs 수면호출 케어미스 분석

## 📋 개요

현재 시스템에는 수면 관련 케어미스가 **3가지** 존재합니다:
1. **수면상태확인 케어미스** (sleepLightOnStart 기반)
2. **TIRED 상태 케어미스** (tiredStartAt 기반)
3. **수면호출 케어미스** (Sleep Call, callStatus.sleep 기반)

이 문서는 이들의 차이점과 중복 여부를 분석합니다.

---

## 1. 수면상태확인 케어미스 (sleepLightOnStart)

### 구현 위치
- **파일**: `src/pages/Game.jsx` (385-396줄)
- **실행 시점**: 1초마다 실행되는 타이머 내부

### 발생 조건
```javascript
const sleepingNow = inSchedule && !wakeOverride; // 수면 시간 + 수면 방해 없음
if (sleepingNow && isLightsOn) {
  // 케어미스 체크
}
```

**조건 요약**:
- ✅ 수면 시간 내 (`inSchedule`)
- ✅ 수면 방해 중 아님 (`!wakeOverride`, 즉 `wakeUntil` 없음)
- ✅ 불이 켜져 있음 (`isLightsOn`)

### 로직
```javascript
if (sleepingNow && isLightsOn) {
  if (!updatedStats.sleepLightOnStart) {
    updatedStats.sleepLightOnStart = nowMs; // 시작 시간 기록
  } else {
    const elapsed = nowMs - updatedStats.sleepLightOnStart;
    if (elapsed >= 30 * 60 * 1000 && !dailySleepMistake && !updatedStats.dailySleepMistake) {
      updatedStats.careMistakes = (updatedStats.careMistakes || 0) + 1;
      updatedStats.dailySleepMistake = true;
      setDailySleepMistake(true);
      updatedStats.sleepLightOnStart = nowMs; // ⚠️ 리셋! (다시 카운트 시작)
    }
  }
}
```

### 특징
- **타임아웃**: 30분
- **제한**: 하루 1회 (`dailySleepMistake` 플래그)
- **리셋**: 케어미스 발생 후 `sleepLightOnStart`를 현재 시간으로 리셋 → **다시 30분 후 또 증가 가능**
- **UI 표시**: `StatsPopup.jsx`에서 "수면상태확인" 항목으로 표시

---

## 2. TIRED 상태 케어미스 (tiredStartAt)

### 구현 위치
- **파일**: `src/pages/Game.jsx` (358-383줄)
- **실행 시점**: 1초마다 실행되는 타이머 내부

### 발생 조건
```javascript
const currentSleepStatus = getSleepStatus({...});
if (currentSleepStatus === "TIRED") {
  // 케어미스 체크
}
```

**`getSleepStatus`에서 TIRED 반환 조건**:
```javascript
// useGameLogic.js
// 수면 시간 내
// 빠른 잠들기 중이 아님 (!fastSleepStart 또는 불이 켜져 있음)
// 수면 방해 중이 아님 (!wakeOverride)
// 불이 켜져 있음 (isLightsOn)
if (isLightsOn) return "TIRED";
```

**조건 요약**:
- ✅ 수면 시간 내
- ✅ 빠른 잠들기 중이 아님 (`fastSleepStart` 없거나 불이 켜져 있음)
- ✅ 수면 방해 중 아님 (`!wakeOverride`)
- ✅ 불이 켜져 있음 (`isLightsOn`)

### 로직
```javascript
if (currentSleepStatus === "TIRED") {
  if (!updatedStats.tiredStartAt) {
    updatedStats.tiredStartAt = nowMs;
    updatedStats.tiredCounted = false;
  } else {
    const elapsed = nowMs - updatedStats.tiredStartAt;
    const threshold = developerMode ? 60 * 1000 : 30 * 60 * 1000; // 30분
    if (!updatedStats.tiredCounted && elapsed >= threshold) {
      updatedStats.careMistakes = (updatedStats.careMistakes || 0) + 1;
      updatedStats.tiredCounted = true;
      // Activity Log 추가
    }
  }
} else {
  // TIRED 상태가 아니면 리셋
  updatedStats.tiredStartAt = null;
  updatedStats.tiredCounted = false;
}
```

### 특징
- **타임아웃**: 30분
- **제한**: 1회만 증가 (`tiredCounted` 플래그, 리셋되지 않음)
- **리셋**: TIRED 상태가 해제되면 리셋 → **TIRED 상태가 계속 유지되면 한 번만 증가**
- **UI 표시**: `StatsPopup.jsx`에서 "수면상태확인" 항목으로 표시 (같은 항목!)

---

## 3. 수면호출 케어미스 (Sleep Call)

### 구현 위치
- **파일**: `src/hooks/useGameLogic.js` - `checkCalls()`, `checkCallTimeouts()`
- **실행 시점**: 1초마다 실행되는 타이머 내부 (`checkCallTimeouts`)

### 발생 조건
```javascript
// checkCalls()에서 호출 활성화
if (isSleepTime && isLightsOn && !callStatus.sleep.isActive) {
  callStatus.sleep.isActive = true;
  callStatus.sleep.startedAt = now.getTime();
}

// checkCallTimeouts()에서 타임아웃 체크
const sleepStartedAt = ensureTimestamp(callStatus.sleep.startedAt);
if (sleepStartedAt) {
  const elapsed = nowMs - sleepStartedAt;
  if (elapsed > SLEEP_CALL_TIMEOUT) { // 60분
    updatedStats.careMistakes = (updatedStats.careMistakes || 0) + 1;
    callStatus.sleep.isActive = false;
    callStatus.sleep.startedAt = null;
  }
}
```

**조건 요약**:
- ✅ 수면 시간 내 (`isSleepTime`)
- ✅ 불이 켜져 있음 (`isLightsOn`)
- ✅ 호출이 활성화되지 않았을 때만 활성화 (`!callStatus.sleep.isActive`)

### 특징
- **타임아웃**: 60분
- **제한**: 없음 (타임아웃마다 증가 가능)
- **리셋**: 타임아웃 발생 시 또는 불을 꺼면 리셋
- **UI 표시**: `StatsPopup.jsx`에서 "5. 케어미스 발생 조건" 섹션의 "Sleep Call" 항목으로 표시

---

## 🔄 조건 비교

### 수면상태확인 케어미스 조건
```
sleepingNow && isLightsOn
= (inSchedule && !wakeOverride) && isLightsOn
= 수면 시간 && !수면 방해 && 불 켜짐
```

### TIRED 상태 케어미스 조건
```
currentSleepStatus === "TIRED"
= 수면 시간 && !빠른 잠들기 && !수면 방해 && 불 켜짐
```

### 수면호출 케어미스 조건
```
isSleepTime && isLightsOn && callStatus.sleep.isActive
= 수면 시간 && 불 켜짐 && 호출 활성화됨
```

### 차이점 요약

| 항목 | 수면상태확인 | TIRED 상태 | 수면호출 |
|------|------------|-----------|---------|
| **타임아웃** | 30분 | 30분 | 60분 |
| **제한** | 하루 1회 | 1회 (상태 유지 중) | 없음 |
| **리셋 조건** | 케어미스 발생 후 | TIRED 상태 해제 시 | 타임아웃 발생 시 |
| **빠른 잠들기 체크** | ❌ 없음 | ✅ 있음 | ❌ 없음 |
| **수면 방해 체크** | ✅ 있음 | ✅ 있음 | ❌ 없음 |
| **UI 표시 위치** | 수면 정보 섹션 | 수면 정보 섹션 | 케어미스 발생 조건 섹션 |

---

## ⚠️ 중복 가능성 분석

### 1. 수면상태확인 vs TIRED 상태

**거의 동일한 조건**:
- 둘 다 수면 시간 + 불 켜짐 + 수면 방해 없음
- 둘 다 30분 타임아웃
- **차이점**: TIRED는 빠른 잠들기(`fastSleepStart`) 체크, 수면상태확인은 체크 안 함

**중복 시나리오**:
1. 수면 시간 시작, 불 켜짐
2. `sleepingNow && isLightsOn` = true → 수면상태확인 로직 시작
3. `currentSleepStatus === "TIRED"` = true → TIRED 상태 로직 시작
4. 30분 경과
5. **두 로직 모두 케어미스 증가 시도!** ⚠️

**중복 방지 메커니즘**:
- 수면상태확인: `dailySleepMistake` 플래그 (하루 1회)
- TIRED 상태: `tiredCounted` 플래그 (1회)
- **서로 다른 플래그이므로 중복 방지 안 됨!**

### 2. 수면상태확인 vs 수면호출

**다른 타임아웃**:
- 수면상태확인: 30분
- 수면호출: 60분

**중복 시나리오**:
1. 수면 시간 시작, 불 켜짐
2. 수면상태확인: 30분 후 케어미스 +1
3. 수면호출: 60분 후 케어미스 +1
4. **30분과 60분에 각각 증가 가능** (의도된 동작일 수 있음)

### 3. TIRED 상태 vs 수면호출

**다른 타임아웃**:
- TIRED 상태: 30분
- 수면호출: 60분

**중복 시나리오**:
1. 수면 시간 시작, 불 켜짐
2. TIRED 상태: 30분 후 케어미스 +1
3. 수면호출: 60분 후 케어미스 +1
4. **30분과 60분에 각각 증가 가능** (의도된 동작일 수 있음)

---

## 🎯 실제 동작 분석

### 시나리오 1: 수면 시간 시작, 불 켜둠

**0분**:
- 수면상태확인: `sleepLightOnStart` 기록 시작
- TIRED 상태: `tiredStartAt` 기록 시작
- 수면호출: `callStatus.sleep.startedAt` 기록 시작

**30분**:
- 수면상태확인: 케어미스 +1, `dailySleepMistake = true`, `sleepLightOnStart` 리셋
- TIRED 상태: 케어미스 +1, `tiredCounted = true`
- 수면호출: 아직 타임아웃 안 됨 (60분)

**결과**: **케어미스가 2회 증가!** ⚠️ (수면상태확인 + TIRED 상태)

**60분**:
- 수면상태확인: `dailySleepMistake`가 true이므로 증가 안 함
- TIRED 상태: `tiredCounted`가 true이므로 증가 안 함
- 수면호출: 케어미스 +1

**결과**: 케어미스 1회 추가 증가 (총 3회)

### 시나리오 2: 빠른 잠들기 중

**0분**: 수면 시간 시작, 불 켜짐
- 수면상태확인: `sleepLightOnStart` 기록 시작
- TIRED 상태: `tiredStartAt` 기록 시작
- 수면호출: `callStatus.sleep.startedAt` 기록 시작

**5분**: 불을 꺼서 빠른 잠들기 시작
- 수면상태확인: `sleepLightOnStart` 리셋 (불이 꺼짐)
- TIRED 상태: `tiredStartAt` 리셋 (상태가 SLEEPING으로 변경)
- 수면호출: `callStatus.sleep.startedAt` 유지 (리셋 안 됨)

**결과**: 케어미스 증가 없음 (의도된 동작)

---

## 💡 결론 및 권장사항

### 현재 문제점

1. **수면상태확인과 TIRED 상태가 중복 실행됨**
   - 같은 조건에서 동시에 케어미스 증가
   - 30분에 케어미스가 2회 증가할 수 있음

2. **UI에서 혼란스러움**
   - "수면상태확인" 항목이 두 로직을 모두 표시
   - 사용자가 어떤 케어미스가 발생했는지 구분하기 어려움

3. **로직의 목적이 불명확**
   - 수면상태확인: 하루 1회 제한, 리셋 후 다시 카운트
   - TIRED 상태: 1회만 증가, 상태 해제 시 리셋
   - 수면호출: 60분마다 증가 가능

### 권장 해결 방안

**방안 1: TIRED 상태 케어미스만 사용 (권장)**

1. **수면상태확인 케어미스 로직 제거** (385-396줄)
2. **TIRED 상태 케어미스에 `dailySleepMistake` 체크 추가**
3. **`sleepLightOnStart`는 UI 표시용으로만 사용**

**장점**:
- 중복 제거
- 로직 단순화
- `getSleepStatus()` 함수를 사용하므로 일관성 유지
- 빠른 잠들기 체크 포함

**방안 2: 수면상태확인 케어미스만 사용**

1. **TIRED 상태 케어미스 로직 제거** (358-383줄)
2. **수면상태확인 케어미스에 빠른 잠들기 체크 추가**

**장점**:
- 하루 1회 제한 유지
- 리셋 후 다시 카운트 가능

**단점**:
- 빠른 잠들기 체크 로직 추가 필요

### 수면호출 케어미스는 유지

- **60분 타임아웃**은 별도의 장기 경고로 유지하는 것이 합리적
- 30분 케어미스와 60분 케어미스는 **다른 목적** (단기 경고 vs 장기 경고)

---

## 📝 요약

| 케어미스 종류 | 타임아웃 | 제한 | 중복 여부 |
|-------------|---------|------|----------|
| 수면상태확인 | 30분 | 하루 1회 | ⚠️ TIRED와 중복 |
| TIRED 상태 | 30분 | 1회 | ⚠️ 수면상태확인과 중복 |
| 수면호출 | 60분 | 없음 | ✅ 독립적 (의도된 동작) |

**결론**: 수면상태확인과 TIRED 상태 케어미스는 **중복**이며, 하나만 사용하는 것을 권장합니다.
