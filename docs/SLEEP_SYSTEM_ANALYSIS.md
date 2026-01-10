# 수면 시스템 분석 및 개선 방안

## 📋 현재 수면 시스템 구조

### 1. 수면 스케줄 (Sleep Schedule)
- **위치**: `digimonDataVer1[digimonName].stats.sleepSchedule` 또는 `sleepSchedule`
- **형식**: `{ start: 22, end: 6 }` (24시간 형식)
- **기본값**: `{ start: 22, end: 6 }` (오후 10시 ~ 오전 6시)
- **Stage별 기본 스케줄**:
  - Digitama/Baby1/Baby2: `{ start: 20, end: 8 }` (오후 8시 ~ 오전 8시)
  - Child: `{ start: 21, end: 7 }` (오후 9시 ~ 오전 7시)
  - Adult/Perfect: `{ start: 22, end: 6 }` (오후 10시 ~ 오전 6시)
  - Ultimate/SuperUltimate: `{ start: 23, end: 7 }` (오후 11시 ~ 오전 7시)

### 2. 수면 상태 (Sleep Status)
- **위치**: `useGameLogic.js` - `getSleepStatus()`
- **상태 종류**:
  - `'AWAKE'`: 수면 시간이 아님 OR `wakeUntil`이 현재 시간보다 미래임
  - `'TIRED'`: 수면 시간임 AND `isLightsOn`이 true임 (불이 켜져 괴로워하는 상태)
  - `'SLEEPING'`: 수면 시간임 AND `isLightsOn`이 false임 (편안하게 자는 상태)

### 3. 수면 방해 (Sleep Disturbance)
- **위치**: `useGameHandlers.js` - `wakeForInteraction()`
- **발생 조건**: 수면 중(`isWithinSleepSchedule() && !wakeUntil`)에 다음 액션 시도 시
  - 밥 먹이기 (`handleFeed`)
  - 훈련 (`handleTrainResult`)
  - 배틀 (`handleBattleComplete`)
  - 교감 (`handleMenuClick` - `communication`)
  - 화장실 (`handleMenuClick` - `bathroom`)
  - 치료 (`handleMenuClick` - `heal`)
- **수면방해 제외 메뉴**:
  - 스탯 (`status`)
  - 호출 (`callSign`)
  - 전기 (`electric`)
- **효과**:
  - `sleepDisturbances`: +1
  - `wakeUntil`: 현재시간 + 10분 (600,000ms)
  - 10분 동안 깨어있음
- **현재 알림**: Activity Log에만 기록됨 (`'Disturbed Sleep! (Wake +10m, Mistake +1)'`)

### 4. 불 켜짐/꺼짐 (Lights On/Off)
- **위치**: `Game.jsx` - `handleToggleLights()`
- **수면 중 불 켜짐 효과**:
  - 상태가 `TIRED`로 변경됨
  - `sleepLightOnStart` 기록 시작
  - 30분 지속 시 `careMistakes` +1 (하루 1회만)
  - `dailySleepMistake` 플래그로 중복 방지

### 5. 수면 호출 (Sleep Call)
- **위치**: `useGameLogic.js` - `checkCalls()`
- **발생 조건**: 수면 시간이고 불이 켜져있을 때
- **효과**: `callStatus.sleep.isActive = true`
- **현재 표시**: `DigimonStatusBadges`에서 "수면 호출 😴" 배지 표시

---

## 🔍 현재 구현 상태

### ✅ 잘 구현된 부분
1. **수면 스케줄 체크**: `isWithinSleepSchedule()` 함수로 정확히 체크
2. **수면 상태 계산**: `getSleepStatus()` 함수로 AWAKE/TIRED/SLEEPING 정확히 계산
3. **수면 방해 카운트**: `sleepDisturbances` 정확히 증가
4. **10분 깨우기**: `wakeUntil`로 10분 동안 깨어있음
5. **불 켜짐 케어 미스**: 30분 지속 시 케어 미스 증가
6. **수면 호출**: 수면 시간에 불 켜져 있으면 호출 표시

### ⚠️ 개선이 필요한 부분

#### 1. 수면 방해 알림 부족
- **현재**: Activity Log에만 기록됨
- **문제**: 사용자가 수면 중 깨웠을 때 즉시 알림이 없음
- **개선 필요**: 토스트 알림 또는 상태 배지 추가

#### 2. 수면 시간 정보 표시 부족
- **현재**: StatsPopup에서만 Sleep Time 표시
- **문제**: 
  - 몇 분 후에 잠드는지 알 수 없음
  - 현재 수면 시간인지 알 수 없음
  - 수면까지 남은 시간을 실시간으로 볼 수 없음
- **개선 필요**: 
  - 수면까지 남은 시간 계산 및 표시
  - 수면 시간 정보를 더 접근하기 쉽게 표시

#### 3. 수면 방해 정보 표시 부족
- **현재**: `sleepDisturbances` 값만 StatsPanel에 표시
- **문제**: 수면 방해가 얼마나 발생했는지 한눈에 보기 어려움
- **개선 필요**: 상태 배지나 명확한 표시 추가

---

## 💡 개선 방안

### 1. 수면 방해 알림 개선

#### 방안 A: 토스트 알림 (추천)
```javascript
// wakeForInteraction() 호출 시
// 토스트 알림 표시
showToast({
  message: "수면 방해! 😴 (10분 동안 깨어있음)",
  type: "warning",
  duration: 3000
});
```

#### 방안 B: 상태 배지 추가
```javascript
// DigimonStatusBadges에 추가
if (sleepDisturbances > 0 && sleepStatus === "AWAKE" && wakeUntil) {
  const remainingMinutes = Math.ceil((wakeUntil - Date.now()) / 60000);
  if (remainingMinutes > 0) {
    messages.push({ 
      text: `수면 방해! (${remainingMinutes}분 깨어있음) 😴`, 
      priority: 3.5 
    });
  }
}
```

#### 방안 C: 모달 알림
```javascript
// 수면 방해 발생 시 간단한 모달 표시
toggleModal('sleepDisturbance', true);
```

**추천**: 방안 A (토스트 알림) + 방안 B (상태 배지) 조합

### 2. 수면 시간 정보 표시 개선

#### 방안 A: StatsPanel에 수면 정보 추가
```javascript
// StatsPanel에 추가
<div className="border-t pt-2 mt-2">
  <p>수면 시간: {sleepTime}</p>
  <p>수면까지: {timeUntilSleep}</p>
  <p>수면 상태: {sleepStatus}</p>
</div>
```

#### 방안 B: DigimonStatusBadges에 수면 정보 배지 추가
```javascript
// 수면 시간까지 남은 시간 계산
const getTimeUntilSleep = (sleepSchedule, now) => {
  const hour = now.getHours();
  const { start } = sleepSchedule;
  
  if (hour < start) {
    // 오늘 수면 시간까지
    const hoursUntil = start - hour;
    const minutesUntil = 60 - now.getMinutes();
    return `${hoursUntil}시간 ${minutesUntil}분 후`;
  } else {
    // 내일 수면 시간까지
    const hoursUntil = 24 - hour + start;
    const minutesUntil = 60 - now.getMinutes();
    return `${hoursUntil}시간 ${minutesUntil}분 후`;
  }
};

// 배지 추가
if (sleepStatus === "AWAKE" && !wakeUntil) {
  const timeUntil = getTimeUntilSleep(sleepSchedule, new Date());
  messages.push({ 
    text: `수면까지 ${timeUntil} 😴`, 
    priority: 4.5 
  });
}
```

#### 방안 C: StatsPopup에 상세 정보 추가
```javascript
// StatsPopup에 수면 정보 섹션 추가
<div className="border-b pb-2">
  <h3 className="font-bold text-base mb-2">수면 정보</h3>
  <ul className="space-y-1">
    <li>수면 시간: {sleepTime}</li>
    <li>수면까지: {timeUntilSleep}</li>
    <li>수면 상태: {sleepStatus}</li>
    <li>수면 방해: {sleepDisturbances}회</li>
    <li>깨어있기: {wakeUntil ? `${remainingMinutes}분 남음` : '없음'}</li>
  </ul>
</div>
```

**추천**: 방안 B (상태 배지) + 방안 C (StatsPopup 상세 정보) 조합

### 3. 수면 방해 정보 표시 개선

#### 방안 A: 상태 배지에 수면 방해 정보 추가
```javascript
// DigimonStatusBadges에 추가
if (sleepDisturbances > 0) {
  messages.push({ 
    text: `수면 방해 ${sleepDisturbances}회 ⚠️`, 
    priority: 3.5,
    category: "warning"
  });
}
```

#### 방안 B: StatsPanel에 수면 방해 정보 강조
```javascript
// StatsPanel의 Dev Info 섹션에 추가
<p className={sleepDisturbances > 0 ? "text-orange-600 font-bold" : ""}>
  수면 방해: {sleepDisturbances}회
</p>
```

**추천**: 방안 A (상태 배지) - 사용자가 쉽게 확인 가능

---

## 🎯 구현 우선순위

### 1순위: 수면 방해 알림 (토스트 + 상태 배지)
- 사용자가 수면 중 깨웠을 때 즉시 알림
- 깨어있는 시간 표시

### 2순위: 수면 시간 정보 표시 (상태 배지)
- 수면까지 남은 시간 표시
- 현재 수면 상태 명확히 표시

### 3순위: 수면 방해 정보 표시 (상태 배지)
- 수면 방해 횟수 표시
- StatsPopup에 상세 정보 추가

---

## 📝 구현 예시 코드

### 1. 수면까지 남은 시간 계산 함수
```javascript
// utils/sleepUtils.js
export function getTimeUntilSleep(sleepSchedule, now = new Date()) {
  const hour = now.getHours();
  const minute = now.getMinutes();
  const { start } = sleepSchedule || { start: 22, end: 6 };
  
  if (hour < start) {
    // 오늘 수면 시간까지
    const hoursUntil = start - hour - 1;
    const minutesUntil = 60 - minute;
    if (hoursUntil > 0) {
      return `${hoursUntil}시간 ${minutesUntil}분 후`;
    } else {
      return `${minutesUntil}분 후`;
    }
  } else {
    // 내일 수면 시간까지
    const hoursUntil = 24 - hour - 1 + start;
    const minutesUntil = 60 - minute;
    if (hoursUntil > 0) {
      return `${hoursUntil}시간 ${minutesUntil}분 후`;
    } else {
      return `${minutesUntil}분 후`;
    }
  }
}

export function getTimeUntilWake(sleepSchedule, now = new Date()) {
  const hour = now.getHours();
  const minute = now.getMinutes();
  const { end } = sleepSchedule || { start: 22, end: 6 };
  
  if (hour < end) {
    // 오늘 기상 시간까지
    const hoursUntil = end - hour - 1;
    const minutesUntil = 60 - minute;
    if (hoursUntil > 0) {
      return `${hoursUntil}시간 ${minutesUntil}분 후`;
    } else {
      return `${minutesUntil}분 후`;
    }
  } else {
    // 내일 기상 시간까지
    const hoursUntil = 24 - hour - 1 + end;
    const minutesUntil = 60 - minute;
    if (hoursUntil > 0) {
      return `${hoursUntil}시간 ${minutesUntil}분 후`;
    } else {
      return `${minutesUntil}분 후`;
    }
  }
}
```

### 2. 수면 방해 알림 추가
```javascript
// useGameHandlers.js - wakeForInteraction() 수정
function wakeForInteraction(digimonStats, setWakeUntilCb, setStatsCb, showToast) {
  const until = Date.now() + 10 * 60 * 1000; // 10분
  setWakeUntilCb(until);
  const updated = {
    ...digimonStats,
    wakeUntil: until,
    sleepDisturbances: (digimonStats.sleepDisturbances || 0) + 1,
  };
  setStatsCb(updated);
  
  // 토스트 알림 표시
  if (showToast) {
    showToast({
      message: "수면 방해! 😴 (10분 동안 깨어있음)",
      type: "warning",
      duration: 3000
    });
  }
}
```

### 3. DigimonStatusBadges에 수면 정보 추가
```javascript
// DigimonStatusBadges.jsx
import { getTimeUntilSleep, getTimeUntilWake } from "../utils/sleepUtils";

// getAllStatusMessages() 함수 내부에 추가
const sleepSchedule = digimonData?.stats?.sleepSchedule || { start: 22, end: 6 };

// 수면까지 남은 시간 표시 (AWAKE 상태일 때)
if (sleepStatus === "AWAKE" && !wakeUntil) {
  const timeUntil = getTimeUntilSleep(sleepSchedule, new Date());
  messages.push({ 
    text: `수면까지 ${timeUntil} 😴`, 
    color: "text-blue-500", 
    bgColor: "bg-blue-100", 
    priority: 4.5, 
    category: "info" 
  });
}

// 수면 중 깨어있는 시간 표시 (wakeUntil이 있을 때)
if (wakeUntil && Date.now() < wakeUntil) {
  const remainingMinutes = Math.ceil((wakeUntil - Date.now()) / 60000);
  messages.push({ 
    text: `수면 방해! (${remainingMinutes}분 깨어있음) 😴`, 
    color: "text-orange-500", 
    bgColor: "bg-orange-100", 
    priority: 3.5, 
    category: "warning" 
  });
}

// 수면 방해 횟수 표시 (1회 이상일 때)
if (sleepDisturbances > 0) {
  messages.push({ 
    text: `수면 방해 ${sleepDisturbances}회 ⚠️`, 
    color: "text-yellow-600", 
    bgColor: "bg-yellow-100", 
    priority: 3.6, 
    category: "warning" 
  });
}
```

---

## 📌 결론

현재 수면 시스템은 기본적인 로직은 잘 구현되어 있지만, **사용자에게 정보를 제공하는 부분이 부족**합니다. 

**즉시 구현 권장 사항**:
1. ✅ 수면 방해 발생 시 토스트 알림
2. ✅ 수면까지 남은 시간을 상태 배지로 표시
3. ✅ 수면 방해 횟수를 상태 배지로 표시
4. ✅ StatsPopup에 수면 정보 섹션 추가

이러한 개선을 통해 사용자가 수면 시스템을 더 잘 이해하고 관리할 수 있게 됩니다.

