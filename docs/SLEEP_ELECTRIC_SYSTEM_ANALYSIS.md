# 수면 및 전기 시스템 종합 분석

**작성일:** 2025-01-XX

## 📋 목차

1. [수면 스케줄 시스템](#1-수면-스케줄-시스템)
2. [수면 상태 계산](#2-수면-상태-계산)
3. [전기(불) 시스템](#3-전기불-시스템)
4. [수면 방해 시스템](#4-수면-방해-시스템)
5. [빠른 잠들기 시스템](#5-빠른-잠들기-시스템)
6. [수면 호출 시스템](#6-수면-호출-시스템)
7. [케어미스 관련 로직](#7-케어미스-관련-로직)
8. [타이머 및 Lazy Update](#8-타이머-및-lazy-update)
9. [UI 표시 및 애니메이션](#9-ui-표시-및-애니메이션)

---

## 1. 수면 스케줄 시스템

### 1.1 스케줄 정의

**위치:** `digimonDataVer1[digimonName].stats.sleepSchedule` 또는 `sleepSchedule`

**형식:** `{ start: number, end: number }` (24시간 형식, 시 단위)

**기본값:** `{ start: 22, end: 6 }` (오후 10시 ~ 오전 6시)

**Stage별 기본 스케줄:**
- **Digitama/Baby1/Baby2**: `{ start: 20, end: 8 }` (오후 8시 ~ 오전 8시)
- **Child**: `{ start: 21, end: 7 }` (오후 9시 ~ 오전 7시)
- **Adult/Perfect**: `{ start: 22, end: 6 }` (오후 10시 ~ 오전 6시)
- **Ultimate/SuperUltimate**: `{ start: 23, end: 7 }` (오후 11시 ~ 오전 7시)

### 1.2 스케줄 체크 함수

**위치:** `src/hooks/useGameHandlers.js` - `getSleepSchedule()`, `isWithinSleepSchedule()`

```javascript
// 수면 스케줄 가져오기
export const getSleepSchedule = (name, digimonDataVer1) => {
  const data = digimonDataVer1[name] || {};
  return data.sleepSchedule || { start: 22, end: 6 };
};

// 현재 시간이 수면 스케줄 내에 있는지 확인
export const isWithinSleepSchedule = (schedule, nowDate = new Date()) => {
  const hour = nowDate.getHours();
  const { start, end } = schedule;
  if (start === end) return false;
  if (start < end) {
    return hour >= start && hour < end;
  }
  // 자정 넘김 케이스 (예: 22시~08시)
  return hour >= start || hour < end;
};
```

**특징:**
- 자정을 넘기는 수면 시간도 정확히 처리 (예: 22시~08시)
- `start === end`인 경우는 수면 시간이 아님으로 처리

---

## 2. 수면 상태 계산

### 2.1 상태 종류

**위치:** `src/hooks/useGameLogic.js` - `getSleepStatus()`

**상태 종류:**
- **`'AWAKE'`**: 수면 시간이 아님 OR `wakeUntil`이 현재 시간보다 미래임
- **`'TIRED'`**: 수면 시간임 AND `isLightsOn`이 true임 (불이 켜져 괴로워하는 상태)
- **`'SLEEPING'`**: 수면 시간임 AND `isLightsOn`이 false임 (편안하게 자는 상태)

### 2.2 상태 계산 로직

```javascript
export function getSleepStatus({ 
  sleepSchedule, 
  isLightsOn, 
  wakeUntil, 
  fastSleepStart = null, 
  now = new Date() 
}) {
  const hour = now.getHours();
  const { start = 22, end = 6 } = sleepSchedule || { start: 22, end: 6 };
  
  const wakeOverride = wakeUntil ? new Date(wakeUntil).getTime() > now.getTime() : false;
  
  const isSleepTime = (() => {
    if (start === end) return false;
    if (start < end) return hour >= start && hour < end;
    // 자정 넘김 케이스 (예: 22시~08시)
    return hour >= start || hour < end;
  })();
  
  // 수면 시간이 아니면 무조건 AWAKE
  if (!isSleepTime) return "AWAKE";
  
  // 수면 시간인 경우
  // 빠른 잠들기 우선 체크 (수면 방해 중보다 우선)
  // 불이 꺼져 있고 fastSleepStart가 있으면 10초 후 SLEEPING 상태로 전환
  if (!isLightsOn && fastSleepStart) {
    const nowTime = now.getTime();
    const elapsedSinceFastSleepStart = nowTime - fastSleepStart;
    // 불을 꺼준 시점으로부터 10초가 지났으면 SLEEPING 상태로 전환
    if (elapsedSinceFastSleepStart >= 10 * 1000) {
      return "SLEEPING";
    }
    // 아직 10초가 지나지 않았으면 AWAKE 유지 (수면 방해 중)
    if (wakeOverride) {
      return "AWAKE";
    }
  }
  
  // 수면 방해로 깨어있을 때(wakeOverride)는 AWAKE
  if (wakeOverride) {
    return "AWAKE";
  }
  
  // 수면 시간이고 수면 방해가 없을 때
  if (isLightsOn) return "TIRED";
  return "SLEEPING";
}
```

**우선순위:**
1. 수면 시간이 아니면 → `AWAKE`
2. 빠른 잠들기 중 (불 꺼짐 + `fastSleepStart` + 10초 경과) → `SLEEPING`
3. 수면 방해 중 (`wakeUntil` 미래) → `AWAKE`
4. 수면 시간 + 불 켜짐 → `TIRED`
5. 수면 시간 + 불 꺼짐 → `SLEEPING`

---

## 3. 전기(불) 시스템

### 3.1 전기 버튼

**위치:** `src/components/MenuIconButtons.jsx`

**메뉴 ID:** `"electric"`

**기능:** 조명(불) 켜짐/꺼짐 토글

**특징:**
- 수면 중에도 전기 버튼 클릭 시 **수면 방해가 발생하지 않음**
- 다른 메뉴와 달리 수면 방해 로직에서 제외됨

### 3.2 불 토글 핸들러

**위치:** `src/hooks/useGameHandlers.js` - `handleToggleLights()`

```javascript
const handleToggleLights = async () => {
  const next = !isLightsOn;
  setIsLightsOn(next);
  
  let updatedStats = { ...digimonStats };
  
  if (!next) {
    // 불을 껐을 때
    updatedStats = resetCallStatus(updatedStats, 'sleep'); // Sleep 호출 리셋
    
    // 수면 방해 중(wakeUntil이 있을 때) 불을 꺼주면 빠른 잠들기 시작 시점 기록
    if (wakeUntil && Date.now() < wakeUntil) {
      updatedStats.fastSleepStart = Date.now();
    } else {
      updatedStats.fastSleepStart = null;
    }
  } else {
    // 불을 켰을 때
    updatedStats.fastSleepStart = null; // 빠른 잠들기 시점 리셋
  }
  
  setDigimonStatsAndSave(updatedStats);
  // Activity Log 추가
  const logText = next ? 'Lights: ON' : 'Lights: OFF';
  setActivityLogs((prevLogs) => {
    const currentLogs = updatedStats.activityLogs || prevLogs || [];
    const updatedLogs = addActivityLog(currentLogs, 'ACTION', logText);
    // Firestore에도 저장
    if(slotId && currentUser){
      const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
      updateDoc(slotRef, {
        isLightsOn: next,
        digimonStats: { ...updatedStats, activityLogs: updatedLogs },
        activityLogs: updatedLogs,
        updatedAt: new Date(),
      });
    }
    return updatedLogs;
  });
};
```

**주요 동작:**
1. **불 끄기:**
   - Sleep 호출 리셋
   - 수면 방해 중이면 `fastSleepStart` 기록 (빠른 잠들기 시작)
   - 그 외에는 `fastSleepStart` 리셋

2. **불 켜기:**
   - `fastSleepStart` 리셋 (빠른 잠들기 중단)

### 3.3 상태 저장

**위치:** `src/hooks/useGameState.js`, `src/hooks/useGameData.js`

**상태 변수:** `isLightsOn` (boolean)

**저장 위치:**
- Firestore: `users/{uid}/slots/slot{slotId}.isLightsOn`
- localStorage: `slot{slotId}_isLightsOn`

---

## 4. 수면 방해 시스템

### 4.1 수면 방해 발생 조건

**위치:** `src/hooks/useGameHandlers.js` - `wakeForInteraction()`

**발생 조건:**
- 수면 중 (`isWithinSleepSchedule() && !wakeUntil`)에 다음 액션 시도 시:
  - 밥 먹이기 (`handleFeed`)
  - 훈련 (`handleTrainResult`)
  - 배틀 (`handleBattleComplete`)
  - 치료 (`handleHeal`)
  - 메뉴 클릭 (`handleMenuClick`, **단 `electric` 제외**)

### 4.2 수면 방해 효과

```javascript
function wakeForInteraction(digimonStats, setWakeUntilCb, setStatsCb, onSleepDisturbance = null) {
  const until = Date.now() + 10 * 60 * 1000; // 10분
  setWakeUntilCb(until);
  const updated = {
    ...digimonStats,
    wakeUntil: until,
    sleepDisturbances: (digimonStats.sleepDisturbances || 0) + 1,
  };
  setStatsCb(updated);
  
  // 수면 방해 콜백 호출 (토스트 알림 등)
  if (onSleepDisturbance) {
    onSleepDisturbance();
  }
}
```

**효과:**
- `sleepDisturbances`: +1 (진화 조건에 사용)
- `wakeUntil`: 현재시간 + 10분 (600,000ms)
- 10분 동안 깨어있음 (`wakeUntil`이 만료될 때까지 `AWAKE` 상태 유지)

### 4.3 수면 방해 알림

**위치:** `src/pages/Game.jsx`

**토스트 알림:**
- 수면 방해 발생 시 토스트 표시: "수면 방해! 😴 (10분 동안 깨어있음)"
- 3초 후 자동 사라짐

**Activity Log:**
- `'Sleep Disturbance: [액션] while sleeping'` 형식으로 기록

---

## 5. 빠른 잠들기 시스템

### 5.1 빠른 잠들기 개념

**목적:** 수면 방해로 깨어있는 상태에서 불을 꺼주면 10초 후 바로 잠들 수 있도록 함

**위치:** `src/hooks/useGameHandlers.js`, `src/hooks/useGameLogic.js`

### 5.2 fastSleepStart 설정

**설정 조건:**
- 수면 방해 중 (`wakeUntil`이 미래)
- 불을 꺼줌 (`isLightsOn`이 false가 됨)

**설정 시점:**
```javascript
// handleToggleLights()에서
if (!next) { // 불을 껐을 때
  if (wakeUntil && Date.now() < wakeUntil) {
    updatedStats.fastSleepStart = Date.now(); // 현재 시간 기록
  }
}
```

### 5.3 빠른 잠들기 로직

**위치:** `src/hooks/useGameLogic.js` - `getSleepStatus()`

```javascript
// 불이 꺼져 있고 fastSleepStart가 있으면 10초 후 SLEEPING 상태로 전환
if (!isLightsOn && fastSleepStart) {
  const nowTime = now.getTime();
  const elapsedSinceFastSleepStart = nowTime - fastSleepStart;
  // 불을 꺼준 시점으로부터 10초가 지났으면 SLEEPING 상태로 전환
  if (elapsedSinceFastSleepStart >= 10 * 1000) {
    return "SLEEPING";
  }
  // 아직 10초가 지나지 않았으면 AWAKE 유지 (수면 방해 중)
  if (wakeOverride) {
    return "AWAKE";
  }
}
```

**동작:**
1. 불을 꺼주면 `fastSleepStart` 기록
2. 10초 경과 후 `SLEEPING` 상태로 전환
3. 불을 다시 켜면 `fastSleepStart` 리셋 (빠른 잠들기 중단)

### 5.4 fastSleepStart 리셋 조건

**위치:** `src/pages/Game.jsx` (타이머 useEffect)

```javascript
if (sleepingNow && isLightsOn) {
  // 불이 켜져 있으면 빠른 잠들기 시점 리셋
  updatedStats.fastSleepStart = null;
} else {
  // wakeUntil이 만료되면 빠른 잠들기 시점도 리셋
  if (!wakeUntil || nowMs >= wakeUntil) {
    updatedStats.fastSleepStart = null;
  }
}
```

**리셋 조건:**
1. 불을 켜면 → 리셋
2. `wakeUntil` 만료되면 → 리셋
3. 수면 시간이 아니면 → 리셋

---

## 6. 수면 호출 시스템

### 6.1 수면 호출 발생 조건

**위치:** `src/hooks/useGameLogic.js` - `checkCalls()`

**발생 조건:**
- 수면 시간임 (`isSleepTime === true`)
- 불이 켜져 있음 (`isLightsOn === true`)
- 아직 호출이 활성화되지 않음 (`!callStatus.sleep.isActive`)

```javascript
// Sleep 호출 트리거
const isSleepTime = (() => {
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
})();

if (isSleepTime && isLightsOn && !callStatus.sleep.isActive) {
  callStatus.sleep.isActive = true;
  callStatus.sleep.startedAt = now.getTime();
}
```

### 6.2 수면 호출 리셋

**리셋 조건:**
1. **불을 꺼면** → 즉시 리셋 (`handleToggleLights()`에서)
2. **수면 시간이 아니면** → 리셋 (`checkCalls()`에서)

```javascript
// handleToggleLights()에서
if (!next) { // 불을 꺼면
  updatedStats = resetCallStatus(updatedStats, 'sleep');
}
```

### 6.3 수면 호출 타임아웃

**위치:** `src/hooks/useGameLogic.js` - `checkCallTimeouts()`

**타임아웃 시간:** 60분 (3,600,000ms)

**효과:**
- 60분 경과 시 `careMistakes +1`
- 호출 상태 리셋

```javascript
const SLEEP_CALL_TIMEOUT = 60 * 60 * 1000; // 60분

const sleepStartedAt = ensureTimestamp(callStatus.sleep.startedAt);
if (sleepStartedAt) {
  const elapsed = nowMs - sleepStartedAt;
  
  if (elapsed > SLEEP_CALL_TIMEOUT) {
    updatedStats.careMistakes = (updatedStats.careMistakes || 0) + 1;
    callStatus.sleep.isActive = false;
    callStatus.sleep.startedAt = null;
  }
}
```

### 6.4 UI 표시

**위치:** `src/components/DigimonStatusBadges.jsx`

**표시 조건:**
- `callStatus.sleep.isActive === true`일 때
- 배지 텍스트: "Sleepy! 😴"

---

## 7. 케어미스 관련 로직

### 7.1 수면 중 불 켜두기 케어미스

**위치:** `src/pages/Game.jsx` (타이머 useEffect, 344-355줄)

**발생 조건:**
- 수면 중 (`sleepingNow === true`)
- 불이 켜져 있음 (`isLightsOn === true`)
- 30분 지속 (`elapsed >= 30 * 60 * 1000`)
- 하루 1회만 (`!dailySleepMistake`)

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
      updatedStats.sleepLightOnStart = nowMs; // 리셋 (다음 30분 카운트 시작)
    }
  }
}
```

**특징:**
- 하루에 1회만 증가 (`dailySleepMistake` 플래그)
- 날짜 변경 시 리셋 (`sleepMistakeDate` 체크)

### 7.2 TIRED 상태 케어미스

**위치:** `src/pages/Game.jsx` (useEffect, 940-975줄)

**발생 조건:**
- `sleepStatus === "TIRED"` 상태
- 30분 지속 (개발자 모드에서는 1분)

```javascript
useEffect(() => {
  const timer = setInterval(() => {
    const status = getSleepStatus({...});
    setSleepStatus(status);
    
    if (status === "TIRED") {
      if (!tiredStartRef.current) {
        tiredStartRef.current = Date.now();
        tiredCountedRef.current = false;
      }
      const threshold = developerMode ? 60 * 1000 : 30 * 60 * 1000;
      if (!tiredCountedRef.current && tiredStartRef.current && 
          (Date.now() - tiredStartRef.current) >= threshold) {
        tiredCountedRef.current = true;
        // careMistakes +1
        setDigimonStatsAndSave({
          ...digimonStats,
          careMistakes: (digimonStats.careMistakes || 0) + 1,
          activityLogs: updatedLogs,
        }, updatedLogs);
      }
    } else {
      // TIRED 상태가 아니면 리셋
      tiredStartRef.current = null;
      tiredCountedRef.current = false;
    }
  }, 1000);
  return () => clearInterval(timer);
}, [selectedDigimon, isLightsOn, wakeUntil, developerMode, digimonStats]);
```

**특징:**
- TIRED 상태가 해제되면 리셋
- 개발자 모드에서는 1분으로 단축 (테스트용)

### 7.3 수면 호출 타임아웃 케어미스

**위치:** `src/hooks/useGameLogic.js` - `checkCallTimeouts()`

**발생 조건:**
- Sleep 호출이 활성화됨 (`callStatus.sleep.isActive === true`)
- 60분 경과 (`elapsed > 60 * 60 * 1000`)

**효과:**
- `careMistakes +1`
- 호출 상태 리셋

---

## 8. 타이머 및 Lazy Update

### 8.1 실시간 타이머 (1초)

**위치:** `src/pages/Game.jsx` (useEffect, 276-423줄)

**주요 동작:**
1. **수면 상태 계산**
   - `getSleepStatus()` 호출
   - `isActuallySleeping` 판단 (SLEEPING 상태일 때만 타이머 정지)

2. **타이머 감소 처리**
   - `updateLifespan()`: 수명 증가 (SLEEPING일 때 정지)
   - `handleHungerTick()`: 배고픔 감소 (SLEEPING일 때 정지)
   - `handleStrengthTick()`: 힘 감소 (SLEEPING일 때 정지)

3. **수면 관련 스탯 업데이트**
   - `sleepDisturbances` 유지
   - `fastSleepStart` 보존
   - `sleepLightOnStart` 관리 (불 켜두기 케어미스용)

**핵심 규칙:**
- **SLEEPING 상태일 때만 타이머 정지**
- AWAKE, TIRED 상태에서는 정상적으로 타이머 감소

### 8.2 Lazy Update

**위치:** `src/logic/stats/stats.js` - `applyLazyUpdate()`

**수면 관련 처리:**
- 수면 시간 체크는 하지만, **수면 호출은 Lazy Update에서 처리하지 않음**
- 이유: 수면 호출은 수면 시간이 시작될 때 한 번만 발생해야 하므로 실시간으로만 처리

**기상 시 Energy 회복:**
```javascript
// 수면 시간이 끝나고 기상 시간이 되면 maxEnergy까지 회복
if (sleepSchedule && maxEnergy) {
  const { start = 22, end = 6 } = sleepSchedule;
  const wasInSleepTime = /* 마지막 저장 시간이 수면 시간 내에 있었는지 확인 */;
  const isNowWakeTime = /* 현재가 기상 시간인지 확인 */;
  
  if (wasInSleepTime && isNowWakeTime) {
    updatedStats.energy = maxEnergy; // Energy 최대치로 회복
  }
}
```

---

## 9. UI 표시 및 애니메이션

### 9.1 수면 상태 표시

**위치:** `src/components/StatsPanel.jsx`, `src/components/StatsPopup.jsx`

**표시 정보:**
- 수면 상태: `AWAKE` / `TIRED` / `SLEEPING`
- 수면 시간: `formatSleepSchedule(sleepSchedule)`
- 수면까지 남은 시간: `getTimeUntilSleep()`
- 기상까지 남은 시간: `getTimeUntilWake()`
- 수면 방해 횟수: `sleepDisturbances`

### 9.2 수면 애니메이션

**위치:** `src/components/Canvas.jsx`, `src/pages/Game.jsx`

**애니메이션:**
- **SLEEPING/TIRED 상태**: `sleep` 모션 사용 (프레임 11, 12)
- **Zzz 스프라이트**: 수면 상태일 때 표시 (디지타마 제외)

```javascript
// 수면 상태에서는 sleep 모션 사용
if((sleepStatus === "SLEEPING" || sleepStatus === "TIRED") && 
   selectedDigimon !== "Digitama"){
  if(currentAnimation !== "sleep"){
    setCurrentAnimation("sleep");
  }
}
```

### 9.3 수면 방해 토스트

**위치:** `src/pages/Game.jsx`

**표시 조건:**
- 수면 방해 발생 시 (`onSleepDisturbance` 콜백)

**표시 내용:**
- 메시지: "수면 방해! 😴 (10분 동안 깨어있음)"
- 지속 시간: 3초

### 9.4 수면 호출 배지

**위치:** `src/components/DigimonStatusBadges.jsx`

**표시 조건:**
- `callStatus.sleep.isActive === true`

**표시 내용:**
- 배지 텍스트: "Sleepy! 😴"
- 우선순위: 높음

---

## 📊 상태 전이 다이어그램

```
[수면 시간 아님]
    ↓
  AWAKE
    ↓
[수면 시간 시작]
    ↓
[불 켜짐?]
    ├─ Yes → TIRED (30분 지속 시 케어미스)
    └─ No → SLEEPING (타이머 정지)
         ↓
    [수면 방해 발생]
         ↓
    AWAKE (10분 동안)
         ↓
    [불 꺼짐]
         ↓
    [10초 경과]
         ↓
    SLEEPING
```

---

## 🔍 주요 파일 목록

### 핵심 로직
- `src/hooks/useGameLogic.js` - 수면 상태 계산, 호출 체크
- `src/hooks/useGameHandlers.js` - 수면 방해, 불 토글
- `src/pages/Game.jsx` - 타이머, 케어미스 처리

### 유틸리티
- `src/utils/sleepUtils.js` - 수면 시간 계산 함수

### UI 컴포넌트
- `src/components/StatsPopup.jsx` - 수면 정보 표시
- `src/components/DigimonStatusBadges.jsx` - 수면 호출 배지
- `src/components/Canvas.jsx` - 수면 애니메이션

### 데이터
- `src/data/v1/digimons.js` - 수면 스케줄 정의

---

## ⚠️ 주의사항

1. **전기 버튼은 수면 방해를 일으키지 않음**
   - `handleMenuClick()`에서 `menu !== "electric"` 조건으로 제외

2. **SLEEPING 상태일 때만 타이머 정지**
   - AWAKE, TIRED 상태에서는 정상적으로 타이머 감소

3. **수면 호출은 Lazy Update에서 처리하지 않음**
   - 실시간으로만 처리 (수면 시간 시작 시 한 번만 발생)

4. **빠른 잠들기는 수면 방해 중에만 작동**
   - `wakeUntil`이 있을 때만 `fastSleepStart` 설정

5. **수면 중 불 켜두기 케어미스는 하루 1회만**
   - `dailySleepMistake` 플래그로 중복 방지

---

## 📝 참고 문서

- `docs/SLEEP_SYSTEM_ANALYSIS.md` - 수면 시스템 분석 및 개선 방안
- `docs/CAREMISTAKES_SYSTEM_ANALYSIS.md` - 케어미스 시스템 분석
- `docs/TIRED_CAREMISTAKE_DUPLICATE_ANALYSIS.md` - TIRED 케어미스 중복 분석
