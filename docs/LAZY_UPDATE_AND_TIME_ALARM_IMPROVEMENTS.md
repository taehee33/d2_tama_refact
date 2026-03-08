# Lazy Update와 시간·알람 관련 오류 및 개선

**작성일:** 2026-03-08  
**목적:** Lazy Update 구조에서 시간/알람(call) 관련 오류가 발생하는 원인 정리와 개선 방향.

---

## 1. Lazy Update가 “원인”인지 여부

- **Lazy Update 자체가 버그의 직접 원인은 아님.**  
  다만 “시간 경과”를 다루는 코드가 **두 갈래**로 나뉘어 있어, 둘 사이 **불일치**가 있으면 오류처럼 보일 수 있음.

### 두 갈래 구조

| 구분 | 시점 | 사용처 | 역할 |
|------|------|--------|------|
| **A. Lazy 경로** | 슬롯 로드 시, 액션 전 | `data/stats.js` `applyLazyUpdate`, `useGameData` 로드/`applyLazyUpdateForAction` | `lastSavedAt` 기준으로 경과 시간을 한 번에 반영. 배고픔/힘/수명/똥/에너지/나이 + **callStatus 복원 및 과거 케어미스 판정** |
| **B. 실시간 틱** | 1초마다 (게임 화면 열려 있을 때) | `Game.jsx` 1초 타이머, `updateLifespan`, `handleHungerTick`, `handleStrengthTick`, `useGameLogic` `checkCalls` / `checkCallTimeouts` | 메모리 상태만 갱신(저장 없음). 배고픔/힘/수명/똥/에너지 + **call 활성화/타임아웃(케어미스)** |

- 로드/액션 시: **A**만 실행 → 스탯·callStatus가 “저장 시점 ~ 현재” 기준으로 맞게 맞춰짐.
- 게임 화면을 연 채로 있을 때: **B**만 실행 → A와 동일한 규칙(수면 제외, 냉장고 제외 등)을 쓰지 않으면 **규칙 불일치**로 오류 가능.

---

## 2. 시간/알람 오류로 이어질 수 있는 지점

### 2.1 절대 시각 vs “지금” 덮어쓰기

- `lastHungerZeroAt`, `lastStrengthZeroAt`, `callStatus.*.startedAt`, `injuredAt` 등은 **조건이 실제로 충족된 시각**으로만 설정되어야 함.
- 로드 직후나 `checkCalls` 등에서 “값이 없을 때만 `now` 사용”이 아니라 “있는데 `now`로 덮어쓰기”가 들어가면, 12시간/10분 경과 판정이 틀어짐.
- **현재:** `applyLazyUpdate`(data/stats.js)와 `checkCalls`(useGameLogic.js) 모두 “이미 있으면 덮어쓰지 않음”으로 정리된 상태.

### 2.2 callStatus.startedAt “미래”로 밀림

- `applyLazyUpdate`에서 수면 구간을 반영할 때 `startedAt`을 “수면 시간만큼 뒤로” 밀어서 UI용 남은 시간을 맞추는 로직이 있음.
- 밀린 값이 `now`보다 크면 **시작 시각이 미래**가 되어, 경과가 음수로 나오고 “타임아웃까지 30분+ 남음”처럼 잘못 보일 수 있음.
- **현재:** `data/stats.js`에서 `callStatus.hunger.startedAt = Math.min(now.getTime(), pushedStart)` 로 상한 적용됨.

### 2.3 1초 틱의 사망/부상 판정과 Lazy 경로 불일치

- **12시간 굶주림/힘 소진 사망:**  
  - `applyLazyUpdate`(data/stats.js)는 `getElapsedTimeExcludingFridge(lastHungerZeroAt, now, ...)` 로 **냉장고 구간 제외** 후 12시간과 비교.
  - 1초 틱(Game.jsx)에서는 `Date.now() - lastHungerZeroAt` 만 쓰면 **냉장고에 있던 시간까지** 12시간에 포함됨 → 냉장고 사용 시 잘못된 사망 가능.
- **개선:** 1초 틱에서도 12시간 사망/부상 판정 시 `getElapsedTimeExcludingFridge` 사용해 Lazy 경로와 동일한 기준 적용.

### 2.4 UI “남은 시간” 상한

- 10분 타임아웃인데 “타임아웃까지 30분 남음”처럼 나오는 경우:  
  - `elapsed`가 음수이거나, `deadline`이 잘못되어 `remaining = deadline - now`가 10분을 넘김.
- **개선:**  
  - 경과: `elapsed = Math.max(0, getElapsedTimeExcludingFridge(...))`  
  - 남은 시간: `remaining = Math.min(10 * 60 * 1000, Math.max(0, deadlineMs - currentTime))`  
  → 10분 타임아웃이면 표시되는 “남음”은 최대 10분으로 한정.

---

## 3. 적용한/권장 개선 사항

### 적용함

1. **1초 틱 12시간 사망 판정에 냉장고 제외**  
   - `Game.jsx` 1초 타이머 내 굶주림/힘 소진 12시간 사망 체크에 `getElapsedTimeExcludingFridge(lastHungerZeroAt|lastStrengthZeroAt, Date.now(), frozenAt, takeOutAt)` 사용.
2. **호출 타임아웃 UI 남은 시간 상한**  
   - StatsPopup 등에서 10분(또는 60분) 타임아웃일 때 “남은 시간”을 `Math.min(타임아웃ms, Math.max(0, deadline - now))` 로 제한.

### 추가 권장

- **시간/경과 계산 공통화:**  
  `getElapsedTimeExcludingFridge`, `ensureTimestamp`, “남은 시간” 상한 로직을 한 곳(예: `utils/dateUtils.js` 또는 `logic/stats`)에 두고, Lazy 경로와 1초 틱·UI가 동일 함수를 쓰도록 정리.
- **callStatus 복원 일원화:**  
  “과거 재구성” 시 callStatus는 `applyLazyUpdate`에서만 세팅하고, 1초 틱의 `checkCalls`는 “현재 스탯 기준 활성/비활성”만 담당하도록 역할 분리하면 디버깅과 동작 일관성이 좋아짐.
- **단위 테스트:**  
  `applyLazyUpdate`, `checkCalls`, `checkCallTimeouts`에 “lastSavedAt N시간 전”, “수면 구간 포함”, “냉장고 구간 포함” 시나리오 테스트를 두면 회귀 방지에 유리함.

---

## 4. 관련 파일

- `digimon-tamagotchi-frontend/src/data/stats.js` — `applyLazyUpdate`, callStatus 복원 및 과거 케어미스
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js` — `checkCalls`, `checkCallTimeouts`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js` — 로드 시 `applyLazyUpdate`, `applyLazyUpdateForAction`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx` — 1초 타이머, 사망/부상 체크
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx` — 호출/사망/부상 “남은 시간” 표시
- `digimon-tamagotchi-frontend/docs/TIME_BASED_CARE_AND_DEATH_ANALYSIS.md` — 상세 시간 기반 오류 분석
