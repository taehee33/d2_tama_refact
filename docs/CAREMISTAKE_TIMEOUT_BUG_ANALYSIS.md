# 케어미스 타임아웃 시간 비정상 증가 버그 분석 및 수정

**날짜**: 2026-01-09

## 🐛 버그 증상

케어미스를 반복하다 보면 타임아웃 시간이 뜬금없이 증가하는 버그가 발생합니다.
- 예: `122612:00:23` 같은 말도 안 되는 숫자로 표시됨
- 이미지에서 확인된 경과 시간이 비정상적으로 큰 값으로 표시됨

## 🔍 근본 원인 분석

### 1. `new Date(null)` 계산 오류 (가장 유력한 원인)

**문제점**:
- JavaScript에서 `new Date(null).getTime()`을 실행하면 `0`을 반환합니다.
- 이는 1970년 1월 1일을 기준으로 시간을 계산하게 됩니다.
- 결과적으로 `Date.now() - 0` = 약 54년(1970년~2024년)치에 해당하는 수만 시간이 경과 시간으로 표시됩니다.

**버그 발생 흐름**:
1. 10분(또는 30초)이 지나서 케어미스가 증가합니다.
2. 로직에서 `callStatus.hunger.startedAt = null;`로 값을 비웁니다.
3. 이때 `StatsPopup`이나 UI에서 이 값을 참조하여 시간을 계산하려고 하면:
   ```javascript
   Date.now() - new Date(null).getTime() 
   // → 현재시간 - 0 = 약 54년치 시간
   ```
4. 결과적으로 수만 시간이 경과 시간으로 표시됩니다.

### 2. `lastHungerZeroAt`과 `startedAt`의 충돌

**문제점**:
- `stats.js`의 `applyLazyUpdate` 로직에서 배고픔이 0일 때 `lastHungerZeroAt`을 `startedAt`으로 복원하는 로직이 있습니다.
- 케어미스가 발생했을 때 `lastHungerZeroAt`을 `null`로 밀어버렸는데, 바로 직후에 다른 로직에서 `lastSavedAt` 같은 과거의 시간을 다시 `lastHungerZeroAt`에 집어넣고 있지 않은지 확인해야 합니다.
- 만약 `lastSavedAt`이 제대로 전달되지 않아 `0`이나 아주 작은 값이 들어가면, 새로고침 시 타임아웃 시간이 갑자기 수만 시간으로 튈 수 있습니다.

### 3. `checkCalls`와 `checkCallTimeouts`의 실행 순서

**문제점**:
- `Game.jsx`에서 `setInterval`이 돌아갈 때 두 함수의 순서가 중요합니다:
  1. `checkCallTimeouts`: 10분 지났으니 `startedAt`을 `null`로 만든다.
  2. **UI 렌더링**: (이 찰나에) `startedAt`이 `null`이므로 `now - 0` 계산 발생 → 수만 시간 표시
  3. `checkCalls`: "어? 배고픔이 0이네?" 하고 다시 새로운 `startedAt`을 현재 시간으로 채운다.

- 이 찰나의 순간(Step 2)에 UI가 갱신되면서 숫자가 튀어 보일 수 있습니다.

## ✅ 수정 사항

### 1. `StatsPopup.jsx` 수정

**변경 내용**:
- `ensureTimestamp` 유틸리티 함수 추가
- `new Date(null)` 대신 `ensureTimestamp`를 사용하여 안전하게 변환
- `startedAt`이 `null`이거나 유효하지 않은 경우(0 이하) 체크 추가

**수정된 코드**:
```javascript
/**
 * Firestore Timestamp를 안전하게 변환하는 유틸 함수
 * @param {any} val - 변환할 값 (number, Date, Firestore Timestamp, string 등)
 * @returns {number|null} - timestamp (milliseconds) 또는 null
 */
function ensureTimestamp(val) {
  if (!val) return null;
  if (typeof val === 'number') return val;
  // Firestore Timestamp 객체 처리
  if (val && typeof val === 'object' && 'seconds' in val) {
    return val.seconds * 1000 + (val.nanoseconds || 0) / 1000000;
  }
  // Date 객체나 문자열 처리
  const date = new Date(val);
  return isNaN(date.getTime()) ? null : date.getTime();
}

// Hunger Call 타임아웃 표시
{fullness === 0 ? (
  callStatus?.hunger?.isActive && callStatus?.hunger?.startedAt ? (() => {
    // ensureTimestamp를 사용하여 안전하게 변환 (null 체크 포함)
    const startedAt = ensureTimestamp(callStatus.hunger.startedAt);
    if (!startedAt || startedAt <= 0) {
      return <div className="text-yellow-600 ml-2">호출 대기 중...</div>;
    }
    const elapsed = currentTime - startedAt;
    // ... 나머지 로직
  })() : (
    <div className="text-yellow-600 ml-2">호출 대기 중...</div>
  )
) : (
  <div className="text-green-600 ml-2">✓ 조건 미충족 (Fullness: {fullness})</div>
)}
```

**적용 범위**:
- Hunger Call 타임아웃 표시
- Strength Call 타임아웃 표시
- Sleep Call 타임아웃 표시

### 2. 추가 점검 사항

#### 2.1. `checkCalls`와 `checkCallTimeouts` 실행 순서

**현재 순서** (`Game.jsx` 417-438줄):
```javascript
updatedStats = checkCalls(updatedStats, isLightsOn, sleepSchedule, new Date());
// ... 로그 추가 ...
updatedStats = checkCallTimeouts(updatedStats, new Date());
```

**분석**:
- `checkCalls`가 먼저 실행되어 `startedAt`을 설정합니다.
- 그 다음 `checkCallTimeouts`가 실행되어 타임아웃을 체크하고 `startedAt`을 `null`로 설정합니다.
- 이 순서는 올바릅니다. 다만, `checkCallTimeouts`에서 `startedAt`을 `null`로 설정한 직후 UI가 렌더링되면 문제가 발생할 수 있습니다.

**권장 사항**:
- `checkCallTimeouts`에서 `startedAt`을 `null`로 설정한 후, 다음 틱에서 `checkCalls`가 다시 `startedAt`을 설정하기 전까지 UI에서 `null` 체크를 확실히 해야 합니다.
- ✅ 이미 `StatsPopup.jsx`에서 `ensureTimestamp`와 `null` 체크를 추가했으므로 해결되었습니다.

#### 2.2. `lastHungerZeroAt`과 `startedAt` 동기화 로직

**현재 로직** (`data/stats.js` 478-510줄):
```javascript
// Hunger 호출 처리
if (updatedStats.fullness === 0) {
  // startedAt이 없으면 lastHungerZeroAt를 기반으로 복원
  if (!callStatus.hunger.startedAt && updatedStats.lastHungerZeroAt) {
    const hungerZeroTime = ensureTimestamp(updatedStats.lastHungerZeroAt);
    if (hungerZeroTime) {
      callStatus.hunger.isActive = true;
      callStatus.hunger.startedAt = hungerZeroTime;
    }
  } else if (callStatus.hunger.startedAt) {
    // startedAt이 있으면 isActive를 true로 설정 (복원)
    callStatus.hunger.isActive = true;
  }
  
  // 타임아웃 체크 (isActive 대신 startedAt만 체크)
  const hungerStartedAt = ensureTimestamp(callStatus.hunger.startedAt);
  if (hungerStartedAt) {
    const elapsed = now.getTime() - hungerStartedAt;
    
    if (elapsed > HUNGER_CALL_TIMEOUT) {
      // 타임아웃 발생
      updatedStats.careMistakes = (updatedStats.careMistakes || 0) + 1;
      callStatus.hunger.isActive = false;
      callStatus.hunger.startedAt = null;
      updatedStats.lastHungerZeroAt = null;
    }
  }
}
```

**분석**:
- `ensureTimestamp`를 사용하여 `lastHungerZeroAt`을 안전하게 변환하고 있습니다.
- 타임아웃 발생 시 `lastHungerZeroAt`도 `null`로 설정하여 동기화를 유지하고 있습니다.
- ✅ 로직이 올바르게 구현되어 있습니다.

#### 2.3. `checkCalls`에서 `lastHungerZeroAt` 설정

**현재 로직** (`hooks/useGameLogic.js` 412-432줄):
```javascript
// Hunger 호출 트리거
if (updatedStats.fullness === 0) {
  // startedAt이 없거나 유효하지 않으면 새로 시작
  const existingStartedAt = ensureTimestamp(callStatus.hunger.startedAt);
  if (!existingStartedAt) {
    callStatus.hunger.isActive = true;
    callStatus.hunger.startedAt = now.getTime();
    // lastHungerZeroAt도 업데이트 (호출 시작 시점 기록)
    updatedStats.lastHungerZeroAt = now.getTime();
  } else {
    // startedAt이 있으면 isActive를 true로 설정 (복원)
    callStatus.hunger.isActive = true;
    callStatus.hunger.startedAt = existingStartedAt;
  }
} else {
  // fullness가 0이 아니면 호출 리셋
  callStatus.hunger.isActive = false;
  callStatus.hunger.startedAt = null;
  updatedStats.lastHungerZeroAt = null;
}
```

**분석**:
- `ensureTimestamp`를 사용하여 `startedAt`을 안전하게 변환하고 있습니다.
- `startedAt`이 없을 때만 `lastHungerZeroAt`을 현재 시간으로 설정합니다.
- ✅ 로직이 올바르게 구현되어 있습니다.

## 🛠 추가 점검 권장 사항

### 1. `lastHungerZeroAt`이 잘못된 값으로 설정되는 경우

**점검 항목**:
- `lastSavedAt`이 `0`이나 `null`로 전달되는 경우
- `lastHungerZeroAt`이 Firestore에서 로드될 때 잘못된 형식으로 저장된 경우
- `ensureTimestamp`가 `0`을 반환하는 경우

**권장 사항**:
- `applyLazyUpdate`에서 `lastHungerZeroAt`을 복원할 때 `ensureTimestamp`의 결과가 유효한지 확인 (0보다 큰지 체크)
- `checkCalls`에서 `lastHungerZeroAt`을 설정할 때도 현재 시간보다 과거인지 확인

### 2. `checkCallTimeouts`에서 `startedAt`을 `null`로 설정한 후 UI 렌더링

**점검 항목**:
- `checkCallTimeouts`에서 `startedAt`을 `null`로 설정한 직후 UI가 렌더링되는 경우
- `checkCalls`가 다음 틱에서 `startedAt`을 다시 설정하기 전까지의 시간

**권장 사항**:
- ✅ 이미 `StatsPopup.jsx`에서 `ensureTimestamp`와 `null` 체크를 추가했으므로 해결되었습니다.

### 3. Firestore Timestamp 변환

**점검 항목**:
- Firestore에서 로드된 `startedAt`이 `{seconds, nanoseconds}` 형식인 경우
- `ensureTimestamp`가 모든 형식을 올바르게 변환하는지 확인

**권장 사항**:
- ✅ `ensureTimestamp` 함수가 Firestore Timestamp 객체를 올바르게 처리하도록 구현되어 있습니다.

## 📋 수정 완료 항목

- ✅ `StatsPopup.jsx`에 `ensureTimestamp` 함수 추가
- ✅ `StatsPopup.jsx`에서 `new Date(null)` 대신 `ensureTimestamp` 사용
- ✅ `StatsPopup.jsx`에서 `startedAt`이 `null`이거나 유효하지 않은 경우 체크 추가
- ✅ Hunger Call, Strength Call, Sleep Call 모두에 동일한 로직 적용

## 📝 관련 파일

- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx` (수정됨)
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js` (점검 완료)
- `digimon-tamagotchi-frontend/src/data/stats.js` (점검 완료)
- `digimon-tamagotchi-frontend/src/pages/Game.jsx` (점검 완료)

## 🧪 테스트 권장 사항

1. **케어미스 발생 후 UI 확인**:
   - 배고픔/힘이 0이 된 후 10분 이상 방치
   - 케어미스 발생 후 `StatsPopup`에서 타임아웃 시간이 비정상적으로 증가하지 않는지 확인

2. **새로고침 후 타임아웃 시간 확인**:
   - 케어미스 발생 후 새로고침
   - `StatsPopup`에서 타임아웃 시간이 올바르게 표시되는지 확인

3. **Firestore Timestamp 변환 확인**:
   - Firestore 모드에서 게임을 플레이하고 새로고침
   - `StatsPopup`에서 타임아웃 시간이 올바르게 표시되는지 확인
