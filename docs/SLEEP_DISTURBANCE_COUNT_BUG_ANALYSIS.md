# 수면 방해 카운트 버그 분석

**작성일:** 2026-01-27

## 문제

수면 중에 수면 방해를 했는데 수면 방해 카운트(`sleepDisturbances`)가 올라가지 않는 것 같다는 문제가 보고되었습니다.

## 원인 분석

### 문제가 발생한 코드 위치

`src/hooks/useGameActions.js`의 다음 함수들:
- `eatCycle()` - 먹이 주기 시 수면 방해 처리
- `handleTrainResult()` - 훈련 시 수면 방해 처리
- `handleBattleComplete()` - 배틀 시 수면 방해 처리

### 문제의 핵심

1. **`wakeForInteraction()` 함수의 동작**:
   - `sleepDisturbances`를 증가시킵니다 (65-67줄)
   - `setDigimonStatsAndSave(updated)`를 호출하여 저장합니다 (69줄)

2. **호출하는 쪽의 문제**:
   ```javascript
   wakeForInteraction(currentStats, setWakeUntil, setDigimonStatsAndSave, isSleepTime, onSleepDisturbance);
   setDigimonStats((prevStats) => {
     const statsWithLogs = {
       ...currentStats,  // ❌ 문제: wakeForInteraction 호출 전의 상태를 사용
       sleepDisturbances: (currentStats.sleepDisturbances || 0) + 1,  // ❌ 중복 증가
       activityLogs: updatedLogs
     };
     setDigimonStatsAndSave(statsWithLogs, updatedLogs);  // ❌ 중복 저장
   });
   ```

3. **문제점**:
   - `wakeForInteraction()`에서 이미 `sleepDisturbances`를 증가시켰지만
   - `setDigimonStats()`에서 `currentStats`(이전 상태)를 사용하여 다시 증가시킴
   - 비동기 상태 업데이트로 인해 `wakeForInteraction()`에서 증가시킨 값이 반영되지 않을 수 있음
   - 두 번 저장하는 것도 문제 (중복 저장)

## 해결 방법

### 수정 내용

1. **`wakeForInteraction()` 함수 수정**:
   - 업데이트된 스탯을 반환하도록 변경
   - 내부에서 `setDigimonStatsAndSave()` 호출 제거 (중복 저장 방지)
   - 호출하는 쪽에서 통합하여 저장하도록 변경

2. **호출하는 쪽 수정**:
   - `wakeForInteraction()`의 반환값을 사용
   - 반환된 스탯에 이미 증가된 `sleepDisturbances`가 포함되어 있으므로 중복 증가 제거

### 수정된 코드

```javascript
// wakeForInteraction 함수
function wakeForInteraction(digimonStats, setWakeUntil, setDigimonStatsAndSave, isSleepTime = true, onSleepDisturbance = null) {
  const until = Date.now() + 10 * 60 * 1000; // 10분
  setWakeUntil(until);
  
  const nowMs = Date.now();
  const napUntil = digimonStats.napUntil || null;
  const isNapTime = napUntil ? napUntil > nowMs : false;
  
  const updated = {
    ...digimonStats,
    wakeUntil: until,
    sleepDisturbances: (isSleepTime && !isNapTime) 
      ? (digimonStats.sleepDisturbances || 0) + 1 
      : (digimonStats.sleepDisturbances || 0)
  };
  // 저장은 호출하는 쪽에서 통합하여 처리하도록 변경
  // setDigimonStatsAndSave(updated);
  
  if (onSleepDisturbance && isSleepTime && !isNapTime) {
    onSleepDisturbance();
  }
  
  return updated; // ✅ 업데이트된 스탯 반환
}

// 호출하는 쪽
if (nowSleeping) {
  // ✅ wakeForInteraction에서 이미 sleepDisturbances가 증가된 스탯을 반환받음
  const statsAfterWake = wakeForInteraction(currentStats, setWakeUntil, setDigimonStatsAndSave, isSleepTime, onSleepDisturbance);
  setDigimonStats((prevStats) => {
    const statsWithLogs = {
      ...statsAfterWake,  // ✅ 증가된 sleepDisturbances가 포함된 스탯 사용
      activityLogs: updatedLogs
    };
    setDigimonStatsAndSave(statsWithLogs, updatedLogs);
    return statsWithLogs;
  });
}
```

## 영향받은 함수

1. `eatCycle()` - 먹이 주기 시 수면 방해 처리
2. `handleTrainResult()` - 훈련 시 수면 방해 처리
3. `handleBattleComplete()` - 배틀 시 수면 방해 처리

## 참고 사항

- 청소(`useGameAnimations.js`의 `handleCleanPoop`)와 치료(`useGameAnimations.js`의 `handleHeal`)는 `wakeForInteraction()` 함수를 사용하지 않고 직접 처리하므로 문제가 없습니다.
- 이 함수들도 일관성을 위해 `wakeForInteraction()` 함수를 사용하도록 리팩토링할 수 있지만, 현재는 정상 작동하므로 우선순위가 낮습니다.

## 테스트 방법

1. 수면 시간에 디지몬에게 먹이를 주기
2. 수면 시간에 훈련하기
3. 수면 시간에 배틀하기
4. 각 액션 후 `sleepDisturbances` 카운트가 정확히 1씩 증가하는지 확인

## 변경 파일

- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
