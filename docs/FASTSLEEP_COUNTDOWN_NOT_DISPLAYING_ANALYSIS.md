# 빠른 잠들기 카운트다운 미표시 문제 분석

## 🐛 문제 상황

**현상:**
- 조명 상태: 꺼짐 (`isLightsOn === false`)
- 수면 방해 중: 활성화 (`wakeUntil` 활성)
- **예상:** "잠들기" 필드에 카운트다운 표시 (예: "15초 후 잠들어요")
- **실제:** "잠들기: AWAKE"만 표시되고 카운트다운이 표시되지 않음

## 📋 코드 분석

### 1. `handleToggleLights` 함수 (useGameHandlers.js 249-284줄)

```javascript
const handleToggleLights = async () => {
  const next = !isLightsOn;
  setIsLightsOn(next);
  
  let updatedStats = { ...digimonStats };
  if (!next) {
    // 불을 껐을 때
    updatedStats = resetCallStatus(updatedStats, 'sleep');
    // 불을 껐을 때 빠른 잠들기 시작 시점 기록 (수면 방해 중이든 아니든)
    updatedStats.fastSleepStart = Date.now(); // ✅ 여기서 설정됨
    
    // 수면 시간이 아니면 낮잠 예약
    const schedule = getSleepSchedule(selectedDigimon, digimonDataVer1);
    const isSleepTime = isWithinSleepSchedule(schedule, new Date());
    
    if (!isSleepTime) {
      updatedStats.napUntil = Date.now() + (15 * 1000) + (3 * 60 * 60 * 1000);
    } else {
      updatedStats.napUntil = null;
    }
  } else {
    // 불을 켰을 때
    updatedStats.fastSleepStart = null;
    updatedStats.napUntil = null;
  }
  
  await setDigimonStatsAndSave(updatedStats, updatedLogs);
};
```

**분석:**
- ✅ 불을 끌 때 `fastSleepStart`가 `Date.now()`로 설정됨
- ✅ 수면 방해 중이든 아니든 관계없이 설정됨

### 2. `StatsPopup.jsx` 카운트다운 표시 로직 (572-587줄)

```javascript
<li>잠들기: {(() => {
  // fastSleepStart가 있고 불이 꺼져 있을 때 (wakeUntil과 관계없이 표시)
  if (fastSleepStart && !isLightsOn) {
    const elapsed = currentTime - fastSleepStart;
    const remainingSeconds = Math.max(0, 15 - Math.floor(elapsed / 1000));
    if (remainingSeconds > 0 && remainingSeconds <= 15) {
      return <span className="text-blue-500 font-semibold">{remainingSeconds}초 후 잠들어요</span>;
    } else if (remainingSeconds <= 0) {
      return <span className="text-green-500 font-semibold">즉시 잠들 수 있음</span>;
    }
  }
  // 조건이 아닐 때 수면 상태 값 그대로 표시
  const statusText = sleepStatus === 'AWAKE' ? 'AWAKE' : ...;
  return <span className="text-gray-500">{statusText}</span>;
})()}</li>
```

**분석:**
- ✅ 조건: `fastSleepStart && !isLightsOn`
- ✅ `wakeUntil`과 관계없이 표시하도록 수정됨
- ⚠️ **문제:** `fastSleepStart`가 `null`이거나 전달되지 않으면 표시 안 됨

### 3. `Game.jsx` 타이머에서 `fastSleepStart` 리셋 로직 (392-405줄)

```javascript
if (sleepingNow && isLightsOn) {
  // 불이 켜져 있으면 빠른 잠들기 시점 리셋
  updatedStats.fastSleepStart = null;
} else {
  updatedStats.sleepLightOnStart = null;
  // wakeUntil이 만료되면 빠른 잠들기 시점도 리셋
  if (!wakeUntil || nowMs >= wakeUntil) {
    updatedStats.fastSleepStart = null; // ⚠️ 여기서 리셋됨
  }
}
```

**분석:**
- ✅ `wakeUntil`이 만료되면 `fastSleepStart`를 리셋
- ⚠️ **문제:** `wakeUntil`이 활성화되어 있는 동안에는 리셋하지 않음 (정상)
- ⚠️ **문제:** 하지만 `fastSleepStart`가 제대로 저장/전달되지 않을 수 있음

### 4. `StatsPopup`에 `fastSleepStart` 전달 확인

**위치:** `GameModals.jsx` (214-228줄)

```javascript
<StatsPopup
  stats={digimonStats}
  digimonData={currentDigimonData}
  onClose={() => toggleModal?.('stats', false) || (() => {})}
  devMode={developerMode}
  onChangeStats={(ns) => setDigimonStatsAndSave?.(ns) || (() => {})}
  sleepSchedule={ui?.sleepSchedule || null}
  sleepStatus={ui?.sleepStatus || "AWAKE"}
  wakeUntil={ui?.wakeUntil || null}
  sleepLightOnStart={ui?.sleepLightOnStart || null}
  isLightsOn={gameState?.isLightsOn || false}
  callStatus={digimonStats?.callStatus || null}
/>
```

**분석:**
- ✅ `stats={digimonStats}`로 전달됨
- ✅ `StatsPopup` 내부에서 `fastSleepStart`를 `stats`에서 구조 분해 (188줄)
- ⚠️ **문제:** `digimonStats`에 `fastSleepStart`가 없거나 `null`이면 표시 안 됨

## 🔍 가능한 원인

### 원인 1: `fastSleepStart`가 저장되지 않음

**시나리오:**
1. 사용자가 불을 끔 → `handleToggleLights`에서 `fastSleepStart = Date.now()` 설정
2. `setDigimonStatsAndSave` 호출
3. 하지만 저장소에 제대로 저장되지 않음
4. 다음 렌더링 시 `digimonStats.fastSleepStart`가 `null` 또는 `undefined`

**확인 방법:**
- 브라우저 개발자 도구에서 `digimonStats.fastSleepStart` 값 확인
- `handleToggleLights` 실행 후 저장소 확인

### 원인 2: `fastSleepStart`가 리셋됨

**시나리오:**
1. 사용자가 불을 끔 → `fastSleepStart` 설정
2. `Game.jsx` 타이머가 실행됨
3. 어떤 조건에서 `fastSleepStart`가 리셋됨
4. `StatsPopup` 렌더링 시 `fastSleepStart`가 `null`

**확인 방법:**
- `Game.jsx`의 리셋 로직 확인
- `wakeUntil`이 만료되기 전에 리셋되는지 확인

### 원인 3: `fastSleepStart` 타임스탬프 형식 문제

**시나리오:**
1. `fastSleepStart`가 저장됨
2. 하지만 타임스탬프 형식이 다름 (예: 문자열 vs 숫자)
3. `currentTime - fastSleepStart` 계산이 잘못됨
4. `remainingSeconds` 계산이 잘못되어 조건 불만족

**확인 방법:**
- `fastSleepStart`의 타입 확인
- `currentTime`과 `fastSleepStart`의 형식 일치 확인

### 원인 4: 조건문 로직 문제

**시나리오:**
1. `fastSleepStart`가 있고 `!isLightsOn`이지만
2. `remainingSeconds` 계산 결과가 예상과 다름
3. 조건문을 통과하지 못함

**확인 방법:**
- `elapsed` 값 확인
- `remainingSeconds` 계산 결과 확인
- 조건문 (`remainingSeconds > 0 && remainingSeconds <= 15`) 확인

## 💡 해결 방안

### 해결책 1: `fastSleepStart` 저장 확인

**수정 위치:** `useGameHandlers.js` - `handleToggleLights`

```javascript
const handleToggleLights = async () => {
  const next = !isLightsOn;
  setIsLightsOn(next);
  
  let updatedStats = { ...digimonStats };
  if (!next) {
    updatedStats = resetCallStatus(updatedStats, 'sleep');
    updatedStats.fastSleepStart = Date.now();
    
    // 디버깅: 콘솔에 출력
    console.log('[handleToggleLights] fastSleepStart 설정:', updatedStats.fastSleepStart);
    
    // ... 나머지 코드
  }
  
  // 저장 후 확인
  await setDigimonStatsAndSave(updatedStats, updatedLogs);
  console.log('[handleToggleLights] 저장 후 fastSleepStart:', updatedStats.fastSleepStart);
};
```

### 해결책 2: `StatsPopup`에서 디버깅 추가

**수정 위치:** `StatsPopup.jsx` - "잠들기" 필드

```javascript
<li>잠들기: {(() => {
  // 디버깅: 값 확인
  console.log('[StatsPopup] fastSleepStart:', fastSleepStart);
  console.log('[StatsPopup] isLightsOn:', isLightsOn);
  console.log('[StatsPopup] currentTime:', currentTime);
  
  if (fastSleepStart && !isLightsOn) {
    const elapsed = currentTime - fastSleepStart;
    const remainingSeconds = Math.max(0, 15 - Math.floor(elapsed / 1000));
    
    console.log('[StatsPopup] elapsed:', elapsed);
    console.log('[StatsPopup] remainingSeconds:', remainingSeconds);
    
    if (remainingSeconds > 0 && remainingSeconds <= 15) {
      return <span className="text-blue-500 font-semibold">{remainingSeconds}초 후 잠들어요</span>;
    } else if (remainingSeconds <= 0) {
      return <span className="text-green-500 font-semibold">즉시 잠들 수 있음</span>;
    }
  }
  
  // 조건이 아닐 때
  const statusText = sleepStatus === 'AWAKE' ? 'AWAKE' : ...;
  return <span className="text-gray-500">{statusText}</span>;
})()}</li>
```

### 해결책 3: `Game.jsx` 리셋 로직 수정

**현재 문제:**
- `wakeUntil`이 만료되면 `fastSleepStart`를 리셋하는데, 이게 너무 빨리 리셋될 수 있음

**수정 방안:**
- `wakeUntil`이 만료되고 실제로 `SLEEPING` 상태가 된 후에만 리셋

```javascript
// Game.jsx
if (sleepingNow && isLightsOn) {
  updatedStats.fastSleepStart = null;
} else {
  updatedStats.sleepLightOnStart = null;
  // wakeUntil이 만료되고 실제로 SLEEPING 상태가 되면 리셋
  if (!wakeUntil || nowMs >= wakeUntil) {
    // fastSleepStart가 완료되어 SLEEPING 상태가 되었는지 확인
    if (currentSleepStatus === 'SLEEPING' && fastSleepStart) {
      const elapsed = nowMs - fastSleepStart;
      if (elapsed >= 15 * 1000) {
        // 15초가 지나고 SLEEPING 상태가 되면 리셋
        updatedStats.fastSleepStart = null;
      }
    }
  }
}
```

### 해결책 4: 조건문 개선

**현재 문제:**
- `remainingSeconds <= 0`일 때도 표시해야 하는데 조건이 복잡함

**수정 방안:**
```javascript
if (fastSleepStart && !isLightsOn) {
  const elapsed = currentTime - fastSleepStart;
  const remainingSeconds = Math.max(0, 15 - Math.floor(elapsed / 1000));
  
  // 15초 이내면 카운트다운 표시
  if (remainingSeconds > 0 && remainingSeconds <= 15) {
    return <span className="text-blue-500 font-semibold">{remainingSeconds}초 후 잠들어요</span>;
  }
  // 15초가 지났으면 즉시 잠들 수 있음 표시
  if (remainingSeconds <= 0) {
    return <span className="text-green-500 font-semibold">즉시 잠들 수 있음</span>;
  }
}
```

## 🎯 권장 디버깅 절차

1. **브라우저 콘솔 확인:**
   - `handleToggleLights` 실행 시 `fastSleepStart` 값 확인
   - `StatsPopup` 렌더링 시 `fastSleepStart` 값 확인

2. **React DevTools 확인:**
   - `digimonStats.fastSleepStart` 값 확인
   - `isLightsOn` 값 확인
   - `currentTime` 값 확인

3. **저장소 확인:**
   - localStorage 또는 Firestore에서 `fastSleepStart` 값 확인
   - 저장/로드 과정에서 값이 유지되는지 확인

4. **타이밍 확인:**
   - `fastSleepStart` 설정 시점과 `StatsPopup` 렌더링 시점 확인
   - `Game.jsx` 타이머가 `fastSleepStart`를 리셋하는지 확인

## ✅ 결론

**가장 가능성 높은 원인:**
1. `fastSleepStart`가 저장소에 제대로 저장되지 않음
2. `Game.jsx` 타이머에서 예상치 못한 시점에 리셋됨
3. `StatsPopup`에 `fastSleepStart`가 전달되지 않음

**즉시 확인할 사항:**
- 브라우저 콘솔에서 `digimonStats.fastSleepStart` 값 확인
- 불을 끈 직후와 `StatsPopup` 렌더링 시점의 값 비교
- `handleToggleLights` 실행 후 저장소에 값이 저장되는지 확인
