# 시간 기반 케어미스·사망·부상 판정 오류 분석

**작성일:** 2025-02-08  
**목적:** 케어미스 타임아웃(10분 vs 30분+ 표시), 사망/질병 카운터(12시간), 똥 8시간 부상, 부상 방치 시각, 이력 미기록 등 시간 관련 버그의 원인과 개선 방향 정리.

---

## 1. 요약: 공통 원인

- **“절대 시각”이 아닌 “확인/저장 시점”이 기록되는 경우**  
  앱을 열거나 액션을 할 때의 `Date.now()`로 시각을 덮어쓰면, 실제 조건 충족 시점과 불일치해 남은 시간·판정이 잘못됨.
- **호출/사망 타이머의 “시작 시각”**  
  `lastHungerZeroAt`, `lastStrengthZeroAt`, `injuredAt`, `callStatus.hunger.startedAt` 등은 **조건이 실제로 충족된 시각**으로만 설정되어야 하며, “지금 열었다”는 시각으로 덮어쓰면 안 됨.
- **UI 경과 시간 계산**  
  `getElapsedTimeExcludingFridge` 결과가 음수가 되면(시작 시각이 미래인 경우 등) “남은 시간”이 10분/12시간을 넘어서 보일 수 있음. 경과 시간은 `Math.max(0, elapsed)`로 한정하는 것이 안전함.

---

## 2. 케어미스: “10분 초과 시 케어미스”인데 “타임아웃까지 30분+ 남음”

### 현상

- 규칙: Hunger/Strength Call **10분** 무시 시 케어미스 +1.
- UI: “타임아웃까지 **30분 7초** 남음 (10분 초과 시 케어미스 +1)”처럼 10분을 넘는 남은 시간이 표시됨.

### 원인 후보

1. **`callStatus.hunger.startedAt`이 “미래”로 설정되는 경우**  
   - `data/stats.js`의 `applyLazyUpdate`에서 수면 구간을 반영할 때  
     `callStatus.hunger.startedAt = hungerStartedAt + (sleepDuringCall * 1000)`  
     로 “뒤로 밀어서 보존”함.  
   - `sleepDuringCall`이 충분히 크면 `startedAt > now`가 되어 **시작 시각이 미래**가 됨.  
   - UI에서 `elapsed = getElapsedTimeExcludingFridge(startedAt, now)` → **음수**  
     → `remaining = 10분 - elapsed`가 10분보다 훨씬 크게 나와 “30분+ 남음”처럼 보임.

2. **경과 시간 미한정**  
   - `StatsPopup.jsx`에서 `elapsed`가 음수일 때를 막지 않으면, “남은 시간” 상한이 없어짐.

### 개선 방향

- **절대 시각 고정**  
  - `startedAt`은 “배고픔/힘이 실제로 0이 된 시각”만 사용.  
  - “수면 시간만큼 밀어서 보존”할 때 **미래가 되지 않도록** 제한:  
    `startedAt = Math.min(nowMs, hungerStartedAt + sleepDuringCall * 1000)` 또는,  
    표시용으로는 `startedAt`을 그대로 두고 **타임아웃 판정만** “활동 시간(총 경과 − 수면)”으로 계산.
- **UI**  
  - `elapsed = Math.max(0, getElapsedTimeExcludingFridge(...))`  
  - `remaining = Math.min(10 * 60 * 1000, timeout - elapsed)`  
  → 10분 타임아웃이면 “남음”은 최대 10분까지만 표시.

---

## 3. 사망/질병 카운터: “12시간 초과 시 사망”인데 “12시간 21분 남음”

### 현상

- 규칙: 배고픔 0 또는 힘 0이 **12시간** 지속 시 사망.
- UI: “**12시간 19분 51초** 남음 (12시간 초과 시 사망)”처럼, 12시간을 넘는 “남음”이 표시됨.

### 원인

- **`lastHungerZeroAt` / `lastStrengthZeroAt`이 “확인 시점”으로 덮어쓰기됨.**  
  - `useGameLogic.js`의 `syncCallStatus`에서,  
    `fullness === 0`이고 `callStatus.hunger.startedAt`이 없을 때  
    `lastHungerZeroAt = now.getTime()`, `callStatus.hunger.startedAt = now.getTime()` 설정.  
  - 슬롯을 **불러온 직후**에는 `callStatus`가 비어 있거나 `startedAt`이 null인 경우가 많음.  
  - 그때 `syncCallStatus`가 먼저 돌면, **이미 저장돼 있던 “실제 0이 된 시각”**을 `now`로 덮어씀.  
  - 결과: “배고픔 0 발생 시각”이 앱을 연 시각으로 바뀌어, 경과 시간이 거의 0이 되고  
    `remaining = 12*3600 - elapsed`가 12시간에 가깝게 나옴(또는 경과가 음수면 12시간을 넘김).

### 개선 방향

- **`syncCallStatus`에서 `lastHungerZeroAt`/`lastStrengthZeroAt` 덮어쓰지 않기**  
  - 이미 `lastHungerZeroAt`(또는 `lastStrengthZeroAt`)가 있으면:  
    `callStatus.hunger.startedAt`만 그 값으로 복원하고, `lastHungerZeroAt`는 수정하지 않음.  
  - `startedAt`이 없고 `lastHungerZeroAt`도 없을 때만 `now`로 설정 (실시간으로 막 0이 된 경우).
- **로드 후 실행 순서**  
  - 슬롯 로드 후 **반드시** `applyLazyUpdate`(또는 동일한 “절대 시각”을 쓰는 로직)가  
    `lastHungerZeroAt`/`lastStrengthZeroAt`/`callStatus.*.startedAt`을 복원한 뒤에  
    `syncCallStatus`가 실행되도록 하여, “확인 시점”으로 덮어쓰지 않게 함.
- **UI**  
  - `elapsed = Math.max(0, getElapsedTimeExcludingFridge(...))`  
  - `remaining = Math.min(43200, 43200 - elapsed)`  
  → “12시간 남음”이 12시간을 넘지 않도록 한정.

---

## 4. 똥 8개: “8시간 지나면 부상”인데 “12시간 남음”

### 현상

- 규칙: 똥 8개 유지 시 **8시간**마다 추가 부상.
- UI: “다음 추가 부상까지 **12시간 11분 51초**”처럼 8시간을 넘는 값이 나옴.

### 원인

- **`elapsed`가 음수**인 경우.  
  - `nextInjuryIn = threshold - (elapsed % threshold)` (threshold = 8*3600).  
  - `lastMaxPoopTime`(또는 부상 시각)이 잘못되어 “미래”로 들어가면  
    `getElapsedTimeExcludingFridge(pooFullTime, currentTime, ...)`가 음수 →  
    `elapsed % 28800`이 음수 → `nextInjuryIn = 28800 - (음수)`로 8시간보다 커짐(예: 12시간대).
- 똥 8개·부상 시각이 **저장/적용 시점**으로만 찍히면, 오프라인 구간이 길수록 같은 유형의 오류 가능.

### 개선 방향

- **부상/똥 만료 시각을 “실제 시뮬레이션 시각”으로만 설정**  
  - `applyLazyUpdate` 등에서 `lastMaxPoopTime` / 부상 발생 시각을  
    `timeToMax` 또는 “마지막 저장 시점 + 시뮬레이션 경과”로 설정하고,  
    “지금 열었을 때의 now”로만 덮어쓰지 않기.
- **UI**  
  - `elapsed = Math.max(0, getElapsedTimeExcludingFridge(...))`  
  - `nextInjuryIn = threshold - (elapsed % threshold)`  
  - 필요 시 `nextInjuryIn`을 `[0, threshold]` 범위로 클램프.

---

## 5. 부상 방치: “부상 발생 시간”이 확인한 순간에 찍힘 → 확인 안 하면 사망 안 함

### 현상

- 부상 발생 시각(`injuredAt`)이 **실제 부상 시점**이 아니라 **유저가 화면을 열어 확인한 시점**으로 기록됨.
- 그 결과 “6시간 부상 방치 시 사망” 타이머가 **확인한 시점부터** 시작되어,  
  확인을 안 하면 6시간이 거의 흐르지 않은 것처럼 되어 사망이 발생하지 않음.

### 원인

- **`injuredAt`이 “지금”으로 설정되는 경로가 많음.**  
  - `data/stats.js` `applyLazyUpdate`:  
    - 똥 8개가 **이미 있었고** “계속 8개 이상”인 분기에서  
      `updatedStats.injuredAt = now.getTime()` 사용 (라인 458, 467 부근).  
    - 이 시점은 “유저가 앱을 열어 lazy update가 돌았을 때”이므로,  
      실제 부상이 발생한 시각이 아니라 **첫 적용(확인) 시각**이 됨.  
  - `useGameActions.js`: 부상 추가 시 `Date.now()` 사용 (998, 1065 등).  
  - `StatsPopup.jsx`: 관리자 토글로 `isInjured === true` 시 `injuredAt = Date.now()` (385–386).  
- 똥 8개로 인한 부상은 `applyLazyUpdate`에서 “처음 8개가 된 시점”을 `timeToMax`로 계산해 둔 분기에서는 `injuredAt = timeToMax`로 두고 있으나,  
  “이미 8개였고 아직 부상 플래그만 없던” 경우 등에는 `now`가 들어감.

### 개선 방향

- **부상 발생 시각은 “시뮬레이션 상 부상이 난 시각”만 사용**  
  - `applyLazyUpdate`에서 똥 8개 → 부상으로 바꾸는 **모든** 분기에서  
    `injuredAt = timeToMax`(또는 동일한 “과거 시점”)로 통일하고,  
    `injuredAt = now.getTime()` 제거 또는 “이미 injuredAt이 있으면 덮어쓰지 않기”로 변경.
- **실시간 타이머/액션**  
  - 부상이 새로 발생하는 순간만 `Date.now()`로 두고,  
    “이미 부상 상태인데 저장만 늦어진” 경우에는 기존 `injuredAt` 유지.
- **관리자 토글**  
  - 테스트용으로 `isInjured`만 켤 때는 `injuredAt`을 “현재”로 두는 것이 맞다면,  
    “6시간 부상 방치” 판정과 혼동되지 않도록,  
    실제 게임 플로우에서는 **반드시** applyLazyUpdate/액션 경로에서만 `injuredAt`이 설정되게 함.

---

## 6. 부상 이력·케어미스 이력이 제대로 안 남음

### 현상

- 부상 1회가 있는데 “부상 이력 (0건)”, 케어미스가 발생했는데 “케어미스 발생 이력 (0건)”으로 표시됨.

### 원인

- **이력은 `activityLogs`에 추가되지만, 저장되는 `digimonStats`에는 반영되지 않는 경우.**  
  - `Game.jsx` 1초 타이머 안에서:  
    - `checkCallTimeouts`로 케어미스 증가 후  
    - `setActivityLogs(prev => addActivityLog(..., "CARE_MISTAKE", logText))`로 로그만 **React state**에 추가.  
    - 같은 콜백에서 `return updatedStats`로 넘기는 `updatedStats`에는  
      **방금 추가한 케어미스 로그가 포함되지 않음** (`updatedStats.activityLogs`는 이전 값 또는 `prevLogs` 기준).  
  - 그 상태로 `setDigimonStats(updatedStats)` 또는 `setDigimonStatsAndSave`가 호출되면,  
    새로 추가된 로그가 빠진 `activityLogs`가 저장됨.  
  - 다음 로드 시 서버/로컬에서 읽는 `activityLogs`에 해당 항목이 없어 “0건”으로 보임.
- 부상 이력도 유사: 부상 발생 시 `activityLogs`에 INJURY/POOP+Injury를 넣는 경로가  
  **최종 저장되는 `digimonStats`에 병합되지 않는** 경우가 있으면 이력이 사라짐.

### 개선 방향

- **케어미스/부상 발생 시, 반드시 `updatedStats.activityLogs`에 반영한 뒤 그 객체를 저장**  
  - `setActivityLogs`만 호출하지 말고,  
    `updatedStats.activityLogs = addActivityLog(updatedStats.activityLogs || [], "CARE_MISTAKE", logText)`  
    등으로 **같은 턴에서** `updatedStats`에 넣고,  
    이 `updatedStats`를 `setDigimonStats`/저장 함수에 넘기기.  
  - 필요 시 `setActivityLogs(updatedStats.activityLogs)`로 state 동기화.
- **서브컬렉션**  
  - `appendLogToSubcollection`으로 이미 남기고 있다면,  
    표시 시에는 **서브컬렉션 + 현재 슬롯의 activityLogs**를 합쳐서 보여주는 방식으로 하면,  
    저장 타이밍 이슈를 줄일 수 있음.

---

## 7. 절대 시각 기준 정리 (개선 시 권장)

| 항목 | 저장/사용해야 할 시각 | 덮어쓰면 안 되는 경우 |
|------|----------------------|------------------------|
| 배고픔 0 시작 | `lastHungerZeroAt` = fullness가 **실제로** 0이 된 시각 | 슬롯 로드·화면 열었을 때의 `now`로 덮어쓰기 금지 |
| 힘 0 시작 | `lastStrengthZeroAt` = strength가 **실제로** 0이 된 시각 | 동일 |
| 호출 타임아웃 시작 | `callStatus.hunger.startedAt` = 배고픔 0이 된 시각과 동일하게 유지 | “수면 보정” 시 미래 시각으로 밀지 않기 |
| 똥 8개 도달 | `lastMaxPoopTime` = 시뮬레이션 상 8개가 된 시각 | `now`로만 설정하지 않기 |
| 부상 발생 | `injuredAt` = 시뮬레이션/액션 상 부상이 난 시각 | lazy update “첫 적용 시점”의 `now`로 덮어쓰지 않기 |

- **경과 시간 계산**  
  - 모든 UI·판정에서 `elapsed = Math.max(0, getElapsedTimeExcludingFridge(...))` 사용.  
- **남은 시간 표시**  
  - “10분 타임아웃”이면 남은 시간 상한 10분, “12시간 사망”이면 12시간 등, 규칙과 일치하도록 상한 클램프.

이렇게 하면 “절대적인 시간을 설정하고 그에 맞춰” 판정과 UI가 일치하도록 개선할 수 있습니다.

---

## 8. 영향받는 파일 (참고)

- `src/hooks/useGameLogic.js` — `syncCallStatus`, `checkCallTimeouts`
- `src/data/stats.js` — `applyLazyUpdate` (callStatus 복원, 수면 보정, injuredAt/lastMaxPoopTime)
- `src/logic/stats/stats.js` — `getElapsedTimeExcludingFridge`, 동일 로직 사용처
- `src/pages/Game.jsx` — 1초 타이머, 케어미스 로그 추가 및 `updatedStats` 반환
- `src/components/StatsPopup.jsx` — 남은 시간 표시, 경과 시간 계산, 관리자 `injuredAt` 설정
- `src/hooks/useGameActions.js` — 부상 시 `injuredAt` 설정
- `src/hooks/useDeath.js` — 사망 조건에서 `lastHungerZeroAt`/`lastStrengthZeroAt`/`injuredAt` 사용

---

## 9. 적용 완료 (2025-02-08, 절대 시각/데드라인 기반 1차 적용)

- **부상 발생 시각 소급 적용** (`data/stats.js`): "이미 8개였고 부상 플래그 없음" 분기에서 `injuredAt = now` 제거, `lastMaxPoopTime` 기반 `backdatedInjuryTime`으로 설정.
- **수면 보정 시 startedAt 미래 방지** (`data/stats.js`): Hunger/Strength 호출의 `startedAt`을 `Math.min(now.getTime(), pushedStart)`로 제한.
- **syncCallStatus 덮어쓰기 방지** (`useGameLogic.js`): `lastHungerZeroAt`/`lastStrengthZeroAt`이 이미 있으면 복원만 하고 `now`로 덮어쓰지 않음. `startedAt`도 기존 절대 시각 사용.
- **UI 경과/남은 시간 클램프** (`StatsPopup.jsx`): `getElapsedTimeExcludingFridge` 모든 반환값 `Math.max(0, ...)`. 케어미스 10분/60분, 사망 12시간, 똥 8시간, 부상 방치 6시간 남은 시간에 `remaining = Math.max(0, threshold - elapsed)` 적용.
- **과거 재구성 시 이력 생성** (`data/stats.js`): applyLazyUpdate 내에서 부상·케어미스가 발생한 것으로 판단될 때, **그 시뮬레이션 시각(timestamp)**으로 activityLogs에 한 줄 추가. `pushBackdatedActivityLog(activityLogs, type, text, timestampMs)` 사용. 적용 위치: (1) 똥 8개 → 부상 첫 설정 시 (timeToMax 또는 backdatedInjuryTime), (2) Hunger/Strength 호출 타임아웃으로 careMistakes 증가 시 (타임아웃 발생 시각 = startedAt + 10분).
- **호출부에서 서브컬렉션 반영** (`useGameData.js`): applyLazyUpdate 호출 직후, **추가된 로그만** 골라 `appendLogToSubcollection(log)` 호출. 적용 위치: (1) `applyLazyUpdateForAction`(액션 전 Lazy Update), (2) `loadSlot` 내 applyLazyUpdate 후. `prevLogs.length` / `prevLogCount` 기준으로 `slice`해 새 로그만 서브컬렉션에 저장.

---

## 10. 똥 8개 즉시 부상 알고리즘 (확인 요약)

### 현재 동작

- **즉시 부상 적용 위치**  
  - **`src/data/stats.js`의 `applyLazyUpdate`** (액션 전/로드 시 호출)에서만 처리됨.  
  - 루프 `while (poopCountdown <= 0)` 내부:  
    - **poopCount < 8** → 8이 되면 `lastMaxPoopTime = timeToMax`만 설정. **그 턴에서는 `isInjured`/`injuries` 미적용.**  
    - **이미 8개 이상 (else)**  
      - `!lastMaxPoopTime`: `timeToMax` 설정 후 **즉시** `isInjured = true`, `injuredAt = timeToMax`, `injuries += 1`, activityLog 추가.  
      - `lastMaxPoopTime` 있음: "이미 8개였고" 분기에서 `!isInjured`이면 `backdatedInjuryTime`으로 소급 적용.  
  - 따라서 **똥이 7→8이 된 그 while 턴**에서는 부상이 붙지 않고, **다음 번 applyLazyUpdate 호출 시** "이미 8개였고"로 소급 적용됨. (즉시 부상은 한 템포 늦게 적용되는 구조.)

- **1초 틱 (`updateLifespan`, `data/stats.js`)**  
  - 8이 되면 `lastMaxPoopTime = Date.now()`만 설정. **`isInjured`/`injuredAt`/`injuries`는 설정하지 않음.**  
  - 8개 유지 중 8시간(28800초) 경과 시: **`careMistakes++`** 및 `lastMaxPoopTime` 리셋. **`injuries++`가 아님.**

- **UI (StatsPopup)**  
  - "즉시 부상 발생 시간"은 `lastMaxPoopTime`으로 표시.  
  - "다음 추가 부상까지"는 8시간(28800초) 기준 `elapsed % 28800`으로 카운트다운.  
  - 실제 **8시간마다 추가 부상(injuries++)** 은 **`applyLazyUpdate`에 구현되어 있지 않음.** 1초 틱에서는 8시간마다 **케어미스**만 증가함.

### 정리

| 구분 | 적용 시점 | 즉시 부상 (8개 도달) | 8시간마다 추가 |
|------|-----------|----------------------|----------------|
| **applyLazyUpdate** | 액션 전 / 로드 시 | ✅ (이미 8개 이상 또는 소급) | ❌ 없음 |
| **updateLifespan** (1초 틱) | 매 1초 | ❌ lastMaxPoopTime만 | careMistakes++ (부상 아님) |

- 즉시 부상 알고리즘은 **동작함** (액션/로드 시 applyLazyUpdate에서 부상 적용 또는 소급).  
- **적용 완료 (2025-02-08):** 8시간마다 **추가 부상(injuries++) + 케어미스(careMistakes++)** 둘 다 적용.  
  - `updateLifespan`: 8시간 경과 시 `careMistakes++`, `injuries++`, `injuredAt = now`, `isInjured = true`, `lastMaxPoopTime` 리셋.  
  - `applyLazyUpdate`: 냉장고 제외 경과(`getElapsedTimeExcludingFridge`)로 8시간 단위 개수 계산 후, 동일하게 `careMistakes`·`injuries` 증가, `injuredAt`·`lastMaxPoopTime` 갱신, 과거 재구성 시 activityLog 1건 추가.

### 똥 8개 도달 시 "즉시" 부상으로 변경 시 (선택 사항)

| 구분 | 현재 (한 템포 늦게/소급) | 즉시 적용으로 변경 시 |
|------|--------------------------|-------------------------|
| **적용 시점** | 7→8이 된 그 while 턴에서는 부상 미적용. 다음 `applyLazyUpdate` 호출(다음 액션/로드) 시 "이미 8개였고" 분기에서 소급. | 7→8이 된 **그 턴**에서 바로 `isInjured`/`injuredAt`/`injuries` 적용. |
| **1초 틱** | 8이 되어도 `lastMaxPoopTime`만 설정 → 화면에 부상으로 안 보일 수 있음(다음 액션 전까지). | 8이 되는 순간 같은 틱에서 부상 설정 → 약 1초 이내 화면에 부상 반영. |
| **장점** | 부상 적용 로직이 "이미 8개 이상/이미 8개였고" 한 곳에만 있어 단순. | "즉시 부상"이라는 이름과 동작 일치. 액션 없이도 UI·로직이 즉시 일치. |
| **단점** | 액션 전까지 부상 미표시 가능. | 부상 설정이 "7→8 순간"과 "이미 8개였고 소급" 두 경로에 있음(기존 소급은 로드 시 과거 재구성용으로 유지). |

**코드 변경 (적용 완료):** (1) `applyLazyUpdate`: `poopCount === 8 && !lastMaxPoopTime` 블록 안에서 `lastMaxPoopTime` 설정 직후 동일하게 `isInjured`/`injuredAt`/`injuries`/activityLog 설정. (2) `updateLifespan`: `poopCount === 8 && !lastMaxPoopTime` 블록 안에서 `lastMaxPoopTime` 설정 직후 `isInjured`/`injuredAt`/`injuries` 등 설정. 기존 "이미 8개 이상"/"이미 8개였고" 소급 분기는 로드·과거 재구성 시 그대로 유지.

**이중 적용 방지:** 세 경로(7→8 즉시, 이미 8개 이상 !lastMaxPoopTime, 이미 8개였고 소급) 모두 **부상 적용 전에 `if (!updatedStats.isInjured)`** 를 검사함. 한 경로에서 부상 적용 시 `isInjured = true`가 되어 같은 while 루프의 다음 반복이나 다른 분기에서 다시 적용되지 않음. 따라서 `injuries`가 한 번에 2 이상 오르는 일은 없음.

---

## 11. 새로고침 후 케어미스 타임아웃/데드라인이 바뀌는 현상

### 원인

- 1초 틱에서 배고픔/힘 0이 되면 **메모리에서만** `lastHungerZeroAt`, `callStatus.hunger.startedAt` 설정. 저장은 **액션 시에만** 발생.
- **액션 없이 새로고침**하면 해당 시각은 디스크에 없음. 로드 시 `applyLazyUpdate`에서 배고픔 0인데 `lastHungerZeroAt` 없으면 `lastHungerZeroAt = fromStartedAt || lastSaved.getTime()` 로 복원했음.
- `callStatus.hunger.startedAt`도 없으면 **lastHungerZeroAt = lastSaved.getTime()** 이 되어, "0이 된 시각"이 **마지막 저장 시각**으로 덮어씌워짐 → 데드라인 = lastSaved + 10분, 타임아웃까지 = 10분 − (now − lastSaved). 새로고침 전 값과 완전히 달라짐.

### 적용 (2025-02-08)

- 저장된 시각이 없을 때 `lastSaved.getTime()` 대신 **`now.getTime()`** 사용. (배고픔/힘 복원 분기 모두)
- 새로고침 후에는 "타임아웃까지 10분 남음", "데드라인 = 새로고침 시각 + 10분"으로 일관되게 표시됨.
