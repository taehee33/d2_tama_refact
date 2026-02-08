# 리팩토링 로그

이 문서는 프로젝트의 주요 변경사항을 기록합니다.

---

## [2025-02-08] 케어미스 isLogged 'DB 망령' 보정 (10분 미만이면 무조건 false)

### 작업 유형
- 🐛 버그 수정 (새로고침 후에도 케어미스 이력·판정 카운터가 계속 증가하지 않던 현상)

### 목적 및 영향
- **원인:** 예전에 isLogged: true로 DB에 저장된 슬롯을 새로고침해 불러오면, 복원 시 `existingStartedAt`이 이미 있어서 `!existingStartedAt` 분기를 타지 않음. 그래서 isLogged가 DB의 true를 그대로 유지하고, checkCallTimeouts가 "이미 로그 찍혔다"고 판단해 카운트·로그 추가를 계속 스킵함.
- **해결:** "아직 10분이 안 지났다면" (호출이 타임아웃 전이면) **무조건 isLogged = false**로 보정. 판정 대기 상태에서는 로그를 안 찍은 것이 맞으므로, DB에 true가 남아 있어도 보정함.

### 변경 사항
- **hooks/useGameLogic.js** (checkCalls)
  - 복원 분기(existingStartedAt 있을 때): `hungerElapsed = now - existingStartedAt`, `hungerElapsed < HUNGER_CALL_TIMEOUT_MS`이면 `callStatus.hunger.isLogged = false`. Strength 동일.
- **data/stats.js** (applyLazyUpdate)
  - Hunger: `hungerStartedAt` 있을 때 `hungerElapsed < HUNGER_CALL_TIMEOUT`이면 `callStatus.hunger.isLogged = false`. Strength 동일.
  - loadSlot → applyLazyUpdate 경로에서도 동일 보정 적용되어, 로드 직후부터 올바른 상태로 시작.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `docs/REFACTORING_LOG.md`

---

## [2025-02-08] 케어미스 판정 카운터/이력 미증가 수정 (isLogged 새 호출 시 초기화)

### 작업 유형
- 🐛 버그 수정 (새로고침 후에도 케어미스 발생 이력·판정 카운터가 더 이상 증가하지 않던 현상)

### 목적 및 영향
- **원인:** `callStatus.hunger.isLogged` / `callStatus.strength.isLogged`를 타임아웃 시 true로 두어 중복 로그를 막았는데, **새 호출을 시작할 때** isLogged를 false로 초기화하지 않음. 그래서 한 번 타임아웃 후 DB에 isLogged=true가 저장되고, 다음에 배고픔/힘이 다시 0이 되어도 **이전 값이 그대로** 남아 `checkCallTimeouts`에서 `alreadyLogged === true`로 판단해 careMistakes 증가·로그 추가가 스킵됨.
- **해결:** `checkCalls`에서 **새 호출을 세팅하는 분기** (`!existingStartedAt`) 안에서 `callStatus.hunger.isLogged = false`, `callStatus.strength.isLogged = false` 명시적으로 설정. 호출 해제(fullness/strength > 0) 시에는 기존대로 isLogged = false 유지.

### 변경 사항
- **hooks/useGameLogic.js** (checkCalls)
  - Hunger: `if (!existingStartedAt)` 블록에 `callStatus.hunger.isLogged = false` 추가.
  - Strength: `if (!existingStartedAt)` 블록에 `callStatus.strength.isLogged = false` 추가.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `docs/REFACTORING_LOG.md`

---

## [2025-02-08] 케어미스 이력 틱 중복 방지 (ref 기반 1회 추가)

### 작업 유형
- 🐛 버그 수정 (케어미스 이력만 중복, 부상 이력은 중복 없음 → 원인 비교 후 케어미스 쪽만 보강)

### 목적 및 영향
- **원인:** 부상은 `poopCount > oldPoopCount`가 **한 틱만** true라 로그가 1번만 추가됨. 케어미스는 `careMistakes > oldCareMistakes`가 React 상태 갱신 전에 **연속 틱**에서 true가 되어 같은 이벤트 로그가 2~3번 쌓임. addActivityLog의 hasDuplicateCareMistakeLog는 “넘겨받은 배열”만 보므로, 이전 틱에서 넣은 로그가 아직 반영되지 않은 배열이 넘어오면 중복으로 인식하지 못함.
- **해결:** 틱에서 케어미스 로그를 넣기 전에 **ref(Set)** 로 “이미 이 이벤트(timeoutOccurredAt + hunger/strength/sleep) 로그를 넣었는지” 확인. 이미 넣었으면 추가 생략. 같은 타임아웃이 연속 틱에서 들어와도 1회만 로그 추가.

### 변경 사항
- **pages/Game.jsx**
  - `lastAddedCareMistakeKeysRef = useRef(new Set())` 추가.
  - 케어미스 로그 블록에서 `eventKey = \`${timeoutOccurredAt}-${callType}\``(callType: hunger/strength/sleep/other) 계산 후, `lastAddedCareMistakeKeysRef.current.has(eventKey)`이면 로그 추가·setActivityLogs·updatedStats 반영 생략. 추가할 때만 `lastAddedCareMistakeKeysRef.current.add(eventKey)`.
- **docs/CAREMISTAKE_VS_INJURY_LOG_DEDUPE.md** (신규): 케어미스 vs 부상 이력 중복 차이 비교 문서.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/docs/CAREMISTAKE_VS_INJURY_LOG_DEDUPE.md` (신규)
- `docs/REFACTORING_LOG.md`

---

## [2025-02-08] 부상 이력 새로고침 없이 즉시 표시

### 작업 유형
- 🐛 버그 수정 (부상 이력이 새로고침해야만 보이는 현상)

### 목적 및 영향
- **원인:** 부상(똥 8개 등) 발생 시 틱에서 로그를 `updatedStats.activityLogs`에 넣고 `setDigimonStats(updatedStats)`로 반영하지만, (1) 해당 시점에 DB 저장을 하지 않아 다른 저장이 덮어쓸 수 있고, (2) StatsPopup이 `stats.activityLogs`만 참조해 틱에서 `setActivityLogs`로만 갱신된 로그가 반영되기 전에 보이지 않을 수 있음.
- **해결:** (1) 틱에서 똥 8개 부상이 발생한 경우(`injuryJustHappened`)에도 `setDigimonStatsAndSave(updatedStats)` 호출 → activityLogs·isInjured 등이 DB에 함께 저장되어 단일 소스 유지. (2) StatsPopup에 `activityLogs` prop 다시 전달하고, `displayActivityLogs`를 "prop이 stats.activityLogs 이상 길이일 때 prop 사용"으로 설정해 틱에서 `setActivityLogs` 직후에도 부상/케어미스 이력이 즉시 표시되도록 함.

### 변경 사항
- **pages/Game.jsx** (1초 틱)
  - 저장 조건에 `injuryJustHappened` 추가: `(updatedStats.poopCount || 0) > (prevStats.poopCount || 0) && updatedStats.isInjured && (updatedStats.poopCount || 0) >= 8`일 때도 `setDigimonStatsAndSave(updatedStats)` 호출.
- **components/GameModals.jsx**
  - StatsPopup에 `activityLogs={activityLogs}` 전달.
- **components/StatsPopup.jsx**
  - `activityLogs` prop 추가. `displayActivityLogs = (activityLogsProp != null && activityLogsProp.length >= statsLogs.length) ? activityLogsProp : statsLogs` 로 설정해 틱에서 갱신된 로그를 즉시 반영.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/GameModals.jsx`
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx`
- `docs/REFACTORING_LOG.md`

---

## [2025-02-08] 케어미스 이력 중복 방지 (isLogged + addActivityLog 멱등성)

### 작업 유형
- 🐛 버그 수정 (케어미스 발생 이력 1건인데 2건으로 중복 표시)

### 목적 및 영향
- **원인:** 타임아웃이 10분 지난 뒤 10분 1초, 10분 2초… 매 틱마다 "10분 초과"가 참이 되어 로그/카운트가 중복될 수 있고, applyLazyUpdate가 로드·액션 시마다 "아직 로그 없네?"라고 판단해 "[과거 재구성]" 로그를 또 추가하던 문제.
- **1. callStatus.isLogged:** 해당 호출(배고픔/힘)에 대해 케어미스 로그를 **한 번만** 남기도록, `callStatus.hunger.isLogged` / `callStatus.strength.isLogged` 플래그 추가. 타임아웃 시 `isLogged = true`로 설정하고 careMistakes 증가·로그 추가는 `!isLogged`일 때만 수행. 호출 해제(밥/훈련 등) 시 `isLogged = false`로 초기화. DB에 저장되어 새로고침 후 applyLazyUpdate가 재추가하지 않음.
- **2. addActivityLog 멱등성:** 케어미스(CAREMISTAKE) 로그 추가 전에, 동일 사유(배고픔 콜/힘 콜/수면) 로그가 **기준 시각 ±2분** 안에 이미 있으면 추가하지 않고 기존 배열 반환. 실시간 틱과 과거 재구성 경로가 둘 다 로그를 넣어도 한 번만 쌓이도록 함.
- **3. applyLazyUpdate:** 과거 재구성으로 케어미스 로그를 넣기 전에 `callStatus.hunger.isLogged` / `callStatus.strength.isLogged` 확인. 이미 true면 로그·careMistakes 증가 생략, 호출 상태만 정리.

### 변경 사항
- **hooks/useGameLogic.js**
  - callStatus 초기 형태에 `isLogged: false` 추가 (hunger, strength). 냉장고/리셋 시 `isLogged: false`.
  - **checkCallTimeouts:** 타임아웃 시 `!callStatus.hunger.isLogged`일 때만 careMistakes 증가 및 `isLogged = true`. 이미 isLogged면 상태만 정리.
  - **addActivityLog:** `hasDuplicateCareMistakeLog()` 도입. type CAREMISTAKE이고 텍스트에 '배고픔 콜'/'힘 콜'/'수면' 포함 시, 기존 로그 중 동일 사유·±2분 내 존재하면 새 로그 추가 안 함.
  - **resetCallStatus:** hunger/strength 리셋 시 `isLogged = false` 설정.
- **data/stats.js**
  - callStatus 기본값 및 merge 시 `isLogged: false` 포함. applyLazyUpdate에서 타임아웃 처리 전 `callStatus.hunger.isLogged` / `callStatus.strength.isLogged` 확인, 이미 로그됐으면 로그·카운트 생략 후 상태만 정리. 호출 리셋 시 `isLogged = false`.
- **pages/Game.jsx**
  - 틱에서 케어미스가 **방금** 증가한 경우(`careMistakeJustIncreased`)에도 `setDigimonStatsAndSave(updatedStats)` 호출 → activityLogs와 callStatus.isLogged를 DB에 함께 저장해 새로고침 후 재추가 방지.
- **data/defaultStatsFile.js**, **hooks/useFridge.js**: callStatus 생성 시 `isLogged: false` 추가.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/data/defaultStatsFile.js`
- `digimon-tamagotchi-frontend/src/hooks/useFridge.js`
- `docs/REFACTORING_LOG.md`

---

## [2025-02-08] 케어미스 데드라인 DB 저장 및 UI 데드라인 우선 사용

### 작업 유형
- 🐛 버그 수정 (새로고침 시 타임아웃 시간 초기화의 근본 해결)

### 목적 및 영향
- **발생 시점/데드라인을 DB에 저장:** 케어미스 타임아웃의 "생존 신고"가 메모리(리액트 상태)에서만 일어나 새로고침 시 초기화되던 문제. `birthTime`처럼 **변하지 않는 절대 기준**을 DB에 두기 위해 `hungerMistakeDeadline`/`strengthMistakeDeadline`을 도입해, 배고픔·힘 0 발생 시 **값이 없을 때만** 데드라인을 설정하고 DB에 저장. 새로고침·브라우저 종료 후 재접속해도 "10분 타임아웃" 판정이 유지됨.
- **수면 중 데드라인 푸시:** 수면 중에는 타임아웃이 멈추므로 `checkCallTimeouts`에서 `startedAt`을 now로 밀 때 **데드라인도 now+10분**으로 갱신. StatsPopup에서 이 데드라인을 쓰면 수면 중에도 남은 시간이 일관되게 표시됨.
- **타임아웃·리셋 시 데드라인 제거:** 타임아웃 발생 시 또는 배고픔/힘이 0이 아닐 때 `hungerMistakeDeadline`/`strengthMistakeDeadline`을 null로 설정해 중복 판정 방지.

### 변경 사항
- **data/v1/defaultStats.js**
  - `hungerMistakeDeadline`, `strengthMistakeDeadline` (null) 추가. DB 저장·로드 대상.
- **hooks/useGameLogic.js**
  - **checkCalls:** 배고픔/힘 0으로 호출이 막 활성화될 때, `hungerMistakeDeadline`/`strengthMistakeDeadline`이 **없을 때만** `lastHungerZeroAt`/`lastStrengthZeroAt + 10분`으로 설정. 호출 리셋 시 두 데드라인 null.
  - **checkCallTimeouts:** 수면 중 `startedAt` 푸시 시 `hungerMistakeDeadline`/`strengthMistakeDeadline`을 now+10분으로 갱신. 타임아웃 발생 시 두 데드라인 null.
- **components/StatsPopup.jsx**
  - Hunger Call / Strength Call 섹션: 남은 시간·데드라인 표시 시 **DB 데드라인 우선.** `deadlineMs = hungerMistakeDeadline || (startedAt + 10분)`, `remaining = max(0, deadlineMs - currentTime)`. 수면 중이어도 동일 공식 사용(수면 시 데드라인이 틱마다 갱신되므로 새로고침 후에도 일치).
- **pages/Game.jsx** (1초 틱)
  - `lastHungerZeroAt`/`lastStrengthZeroAt` 변경뿐 아니라 **hungerMistakeDeadline / strengthMistakeDeadline 변경 시**에도 `setDigimonStatsAndSave` 호출해 DB에 반영.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/v1/defaultStats.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `docs/REFACTORING_LOG.md`

---

## [2025-02-08] 케어미스 타임아웃 새로고침 유지 + 이력 중복 방지

### 작업 유형
- 🐛 버그 수정 (새로고침 시 데드라인 초기화, 케어미스 이력 중복)

### 목적 및 영향
- **새로고침 시 타임아웃/데드라인 초기화:** 호출(배고픔/힘 0)이 활성화되면 `lastHungerZeroAt`/`lastStrengthZeroAt`가 틱에서만 메모리에 반영되고, 사용자 액션 전까지 DB에 저장되지 않아 새로고침 시 "지금부터 10분"으로 리셋되던 문제. **호출이 막 활성화된 순간** DB에 한 번 저장하도록 해 새로고침 후에도 데드라인이 유지됨.
- **케어미스 [과거 재구성] 이력 중복:** applyLazyUpdate가 액션마다 호출될 때 같은 케어미스가 여러 번 쌓여 "16:22" 동일 시각 로그가 4건 나오던 문제. **alreadyHasLogInWindow**를 케어미스에만 재도입해, 같은 사유(배고픔 콜/힘 콜) 로그가 기준 시각 ±2분 안에 있으면 추가하지 않음. 진화 판정 카운터(careMistakes)는 기존대로 정상 연동.

### 변경 사항
- **pages/Game.jsx** (1초 틱)
  - `lastHungerZeroAt` 또는 `lastStrengthZeroAt`가 이전 틱 대비 새로 설정된 경우(호출 활성화) `setTimeout(..., 0)`으로 **setDigimonStatsAndSave(updatedStats)** 한 번 호출. Firestore에 저장되어 새로고침 후에도 데드라인 유지.
- **data/stats.js**
  - **alreadyHasLogInWindow(activityLogs, type, timeMs, textContains, windowMs = 120000)** 재추가. applyLazyUpdate에서 배고픔/힘 콜 타임아웃 케어미스 로그 추가 전에 **alreadyHasBackdatedLog**에 더해 **alreadyHasLogInWindow**로도 검사해 ±2분 안에 동일 사유 로그가 있으면 추가 생략.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/data/stats.js`

---

## [2025-02-08] 케어미스/부상 이력 중복 방지 및 실시간 이력 반영

### 작업 유형
- 🐛 버그 수정 (이력 중복, 실시간 미반영)

### 목적 및 영향
- **똥 부상/케어미스 중복:** 동일 이벤트가 "즉시 로그(1초 틱)"와 "과거 재구성(applyLazyUpdate)" 두 경로에서 각각 들어가 타임스탬프만 다르게 중복 쌓이던 문제. 동일 사유 로그가 기준 시각 ±2분 안에 있으면 추가하지 않도록 시간 윈도우 dedupe 적용.
- **실시간 이력 미반영:** 케어미스/부상 발생 시 StatsPopup이 `digimonStats.activityLogs`만 참조해, 1초 틱에서 `setActivityLogs`로만 추가된 로그는 새로고침 전까지 이력에 안 보이던 문제. 상위에서 `activityLogs` state를 넘기면 즉시 반영되도록 수정.

### 변경 사항
- **data/stats.js**
  - **alreadyHasLogInWindow(activityLogs, type, timeMs, textContains, windowMs = 120000)** 추가. 동일 타입·텍스트 패턴 로그가 기준 시각 ±2분 안에 있으면 true. 즉시 로그와 과거 재구성 로그가 서로 다른 시각으로 들어가는 중복 방지.
  - 똥 8개 부상(즉시/이미 8개/소급), 8시간 경과, 배고픔/힘 콜 타임아웃 케어미스: `alreadyHasBackdatedLog`에 더해 `alreadyHasLogInWindow`로도 검사 후 로그 추가.
- **hooks/useGameData.js** (applyLazyUpdateForAction)
  - 액션 전 Lazy Update 시 **현재 activityLogs state를 digimonStats와 병합**해 applyLazyUpdate에 전달. 1초 틱에서만 반영된 즉시 로그를 applyLazyUpdate 쪽에서도 보고, 이미 있으면 과거 재구성 로그를 추가하지 않음.
- **components/GameModals.jsx**
  - StatsPopup에 **activityLogs={gameState?.activityLogs}** 전달.
- **components/StatsPopup.jsx**
  - **activityLogs** prop 추가. 표시용으로 **displayActivityLogs = activityLogsProp ?? stats?.activityLogs ?? []** 사용. 케어미스/부상/수면 방해 이력 및 야행성 모드 토글 시 currentLogs에 displayActivityLogs 사용.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/components/GameModals.jsx`
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx`

---

## [2025-02-08] Game 화면 생성일 표시 및 슬롯 삭제 시 서브컬렉션 정리

### 작업 유형
- ✨ UX 개선 (생성일 포맷) / 🐛 버그 수정 (삭제 후 재생성 시 옛 로그 로드)

### 목적 및 영향
- **생성일:** Game 화면에서 생성일이 `1770523686372` 같은 숫자로만 보이던 것을 Select 화면처럼 사람이 읽기 쉬운 로케일 형식(예: `2026. 2. 8. 오후 1:30:16`)으로 표시.
- **슬롯 삭제:** Firestore에서 문서를 삭제해도 **서브컬렉션(logs, battleLogs)은 자동 삭제되지 않음**. 같은 슬롯 번호로 디지몬을 다시 만들면 옛 로그가 그대로 로드되어 "옛날거까지 불러오는 듯한" 현상이 발생. 슬롯 삭제 시 서브컬렉션을 먼저 비운 뒤 문서를 삭제하도록 변경.

### 변경 사항
- **utils/dateUtils.js**
  - **formatSlotCreatedAt(value)** 추가. 숫자(ms)는 `toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })`, 문자열(구 데이터)은 그대로 반환.
- **utils/firestoreHelpers.js** (신규)
  - **deleteSlotWithSubcollections(db, userId, slotId)** 추가. `logs`, `battleLogs` 서브컬렉션 내 모든 문서 삭제 후 슬롯 문서 삭제.
- **pages/Game.jsx**
  - `formatSlotCreatedAt` import 후 생성일 표시를 `{formatSlotCreatedAt(slotCreatedAt)}`로 변경.
- **pages/SelectScreen.jsx**
  - 로컬 `formatSlotCreatedAt` 제거, `dateUtils.formatSlotCreatedAt` 사용. 슬롯 삭제 시 `deleteDoc(slotRef)` 대신 `deleteSlotWithSubcollections(db, currentUser.uid, slotId)` 호출.
- **repositories/UserSlotRepository.js**
  - **deleteUserSlot**에서 `deleteDoc(slotRef)` 대신 `deleteSlotWithSubcollections(db, userId, slotId)` 사용.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/utils/dateUtils.js`
- `digimon-tamagotchi-frontend/src/utils/firestoreHelpers.js` (신규)
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
- `digimon-tamagotchi-frontend/src/repositories/UserSlotRepository.js`

---

## [2025-02-08] 로드 시 케어미스 발생 이력이 사라져 보이던 문제 수정

### 작업 유형
- 🐛 버그 수정 (케어미스 이력 표시)

### 목적 및 영향
- **목적:** 슬롯 로드 후 **케어미스 발생 이력**이 0건으로 보이거나 이전 이력이 사라진 것처럼 보이던 현상 수정. 진화 판정 카운터(Care Mistakes: N)는 1인데 이력은 0건으로 나오는 불일치 제거.
- **원인:** activityLogs는 서브컬렉션(logs)에만 저장되고, 로드 시 `setActivityLogs(logs)`로 state만 채워졌음. `setDigimonStats(savedStats)`에 넘기는 `savedStats`에는 서브컬렉션에서 읽은 로그가 들어가지 않아 `digimonStats.activityLogs`가 비어 있었고, StatsPopup은 `stats?.activityLogs`만 참조해 이력이 비어 보임.
- **영향:** 로드 시 서브컬렉션에서 읽은 로그를 `savedStats.activityLogs`에 넣은 뒤 `applyLazyUpdate` → `setDigimonStats` 하므로, StatsPopup에 케어미스 이력이 정상 표시됨. 서브컬렉션은 timestamp desc로 가져오므로, 이력 표시용으로 오래된 순으로 뒤집어 저장.

### 변경 사항
- **hooks/useGameData.js** (loadSlot)
  - Activity Logs 로드 시 `loadedActivityLogs` 변수에 담고, `setActivityLogs(loadedActivityLogs)` 호출 후 **`savedStats.activityLogs = [...loadedActivityLogs].reverse()`** 추가. 이후 `applyLazyUpdate(savedStats, ...)`가 전체 이력을 기준으로 동작하고, `setDigimonStats(savedStats)` 시 `digimonStats.activityLogs`에 전체 이력이 들어감.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`

---

## [2025-02-08] 케어미스/부상 이력 중복 및 진화 판정 카운터 보정

### 작업 유형
- 🐛 버그 수정 (이력 중복, 카운터 일치)

### 목적 및 영향
- **목적:** applyLazyUpdate가 액션/로드마다 호출될 때 같은 타임아웃·같은 부상 이벤트에 대해 **로그와 careMistakes가 반복 적용**되던 문제 수정. 이력은 중복 쌓이고 진화 판정용 careMistakes는 한 번만 증가해야 함.
- **영향:** 동일 이벤트(타입 + 타임스탬프 + 텍스트 패턴) 로그가 이미 있으면 **해당 호출에서는 로그 추가 및 careMistakes 증가를 하지 않음**. 호출 타임아웃 후에는 startedAt/null 처리만 하고, 로그·카운터는 한 번만 반영.

### 변경 사항
- **data/stats.js**
  - **alreadyHasBackdatedLog(activityLogs, type, timestampMs, textContains)** 헬퍼 추가. 기존 로그 배열에 동일 타입·타임스탬프·텍스트 패턴이 있으면 true 반환.
  - **호출 타임아웃(배고픔/힘 10분):** 타임아웃 시 `timeoutOccurredAt` 기준으로 이미 해당 케어미스 로그가 있으면 `careMistakes` 증가와 pushBackdatedActivityLog 호출을 생략. startedAt/null 리셋은 항상 수행.
  - **부상(똥 8개 즉시·소급·8시간 경과):** 해당 이벤트 시각으로 이미 "Too much poop" / "8시간 경과" 로그가 있으면 pushBackdatedActivityLog만 생략. isInjured/injuries 등 스탯 갱신은 기존대로 수행.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/stats.js`

### 참고
- 진화 판정 카운터(Care Mistakes: N)는 `stats.careMistakes`를 그대로 표시. 중복 적용이 제거되면 액션/저장 후 동일 값이 유지되어 이력 건수와 일치하기 쉬움.

---

## [2025-02-08] 똥 8개 8시간 방치 시 추가 부상 + 케어미스 동시 적용

### 작업 유형
- ✨ 기능 추가 (게임 규칙)

### 목적 및 영향
- **목적:** 똥 8개 유지 시 8시간마다 **추가 부상(injuries++)** 과 **케어미스(careMistakes++)** 를 둘 다 적용하도록 통일.
- **영향:** 기존에는 1초 틱(updateLifespan)에서 8시간 경과 시 케어미스만 증가했고, applyLazyUpdate에는 8시간 추가 부상 로직이 없었음. 이제 두 경로 모두에서 8시간마다 부상·케어미스 동시 적용.

### 변경 사항
- **data/stats.js**
  - **updateLifespan**: 8시간(28800초) 경과 시 `careMistakes++` 유지하고, `injuries++`, `injuredAt = Date.now()`, `isInjured = true`, `healedDosesCurrent = 0`, `lastMaxPoopTime` 리셋 추가.
  - **applyLazyUpdate**: 로컬 헬퍼 `getElapsedTimeExcludingFridge` 추가. "이미 8개였고" 분기에서 `lastMaxPoopTime` 기준 냉장고 제외 경과로 8시간 단위 개수(`periods`) 계산 후, `careMistakes`·`injuries`에 periods만큼 가산, `injuredAt`·`lastMaxPoopTime = now`, 과거 재구성 시 activityLog 1건 추가.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `digimon-tamagotchi-frontend/docs/TIME_BASED_CARE_AND_DEATH_ANALYSIS.md` (§10 정리)

---

## [2025-02-08] 똥 8개 도달 시 부상 "즉시" 적용

### 작업 유형
- ✨ 동작 변경 (게임 규칙)

### 목적 및 영향
- **목적:** 똥이 8개가 되는 **그 턴**에서 바로 부상 적용(기존: 다음 applyLazyUpdate 호출 시 소급).
- **영향:** 1초 틱에서 8이 되면 약 1초 이내 화면에 부상 반영. 액션 없이도 UI와 로직 일치.

### 변경 사항
- **data/stats.js**
  - **applyLazyUpdate**: `poopCount === 8 && !lastMaxPoopTime` 블록에서 `lastMaxPoopTime` 설정 직후, 동일 턴에 `isInjured`/`injuredAt`/`injuries`/`healedDosesCurrent`/`injuryReason`/activityLog 설정.
  - **updateLifespan**: `poopCount === 8 && !lastMaxPoopTime` 블록에서 `lastMaxPoopTime` 설정 직후 `isInjured`/`injuredAt`/`injuries`/`healedDosesCurrent`/`injuryReason` 설정(1초 틱에서는 activityLog 미추가).
- 기존 "이미 8개 이상"·"이미 8개였고" 소급 분기는 로드/과거 재구성용으로 유지.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `digimon-tamagotchi-frontend/docs/TIME_BASED_CARE_AND_DEATH_ANALYSIS.md` (§10)

---

## [2025-02-08] 절대 시각/데드라인 기반 시간 판정 1차 적용

### 작업 유형
- 🐛 버그 수정 + 리팩터링 (시간 판정)

### 목적 및 영향
- **목적:** 카운터 기반이 아닌 **절대 시각(데드라인)** 기반으로 전환. `T_rem = max(0, T_deadline - T_now)` 일관성 확보. 부상 발생 시각 소급 적용, syncCallStatus 덮어쓰기 방지, UI 경과/남은 시간 클램프.
- **영향:** applyLazyUpdate에서 부상 시각을 시뮬레이션 시각으로만 설정, callStatus startedAt 미래 방지, syncCallStatus에서 lastHungerZeroAt/lastStrengthZeroAt 복원 시 now 덮어쓰기 제거, StatsPopup에서 모든 경과/남은 시간에 Math.max(0, ...) 적용.

### 변경 사항
- **data/stats.js**: (1) "이미 8개였고 부상 없음" 분기에서 `injuredAt`을 `lastMaxPoopTime` 기반 소급 시각으로 설정. (2) Hunger/Strength 호출 수면 보정 시 `startedAt = Math.min(now.getTime(), pushedStart)`.
- **useGameLogic.js**: syncCallStatus에서 `lastHungerZeroAt`/`lastStrengthZeroAt`이 있으면 `startedAt` 및 해당 필드를 그대로 복원, 없을 때만 `now` 사용.
- **StatsPopup.jsx**: getElapsedTimeExcludingFridge 모든 반환에 Math.max(0, ...). 케어미스/사망/똥/부상 방치 남은 시간에 `remaining = Math.max(0, threshold - elapsed)` 적용.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx`

### 후속 (동일일)
- **과거 재구성 시 이력 생성**: applyLazyUpdate에서 부상(똥 8개) 또는 케어미스(호출 타임아웃)가 발생한 것으로 재구성될 때, 해당 **시뮬레이션 시각**으로 activityLogs에 로그 추가. `pushBackdatedActivityLog` 헬퍼 추가, POOP(부상)/CAREMISTAKE 로그 4곳 적용. 부상 이력·케어미스 이력이 0건으로 나오던 문제 완화.
- **호출부에서 서브컬렉션 반영**: useGameData에서 applyLazyUpdate 호출 후 추가된 로그만 `slice`해 `appendLogToSubcollection(log)` 호출. `applyLazyUpdateForAction`·`loadSlot` 두 곳 적용. 로그가 서브컬렉션에만 저장되는 구조에서도 과거 재구성 로그가 유지되도록 함.

### 참고
- `digimon-tamagotchi-frontend/docs/TIME_BASED_CARE_AND_DEATH_ANALYSIS.md` (§9 적용 완료)

---

## [2026-01-28] Refactor: 배틀 로그 서브컬렉션(battleLogs) 분리

### 작업 유형
- ♻️ 리팩토링 (Firestore 저장 구조)

### 목적 및 영향
- **목적:** `battleLogs`를 슬롯 문서가 아닌 서브컬렉션 `users/{uid}/slots/slot{N}/battleLogs`에 저장하여 활동 로그와 동일한 패턴으로 통일, 슬롯 문서 크기·쓰기 비용 절감.
- **영향:** 저장 시 슬롯 문서에서 `battleLogs` 제외. 배틀 발생 시 `appendBattleLogToSubcollection(entry)`로 서브컬렉션에만 추가. 로드 시 `battleLogs` 서브컬렉션 쿼리(또는 fallback으로 기존 문서의 `battleLogs`).

### 변경 사항
- **useGameData.js**: saveStats에서 `battleLogs` 제외, loadSlot에서 `battleLogs` 서브컬렉션 쿼리(orderBy timestamp desc, limit 100), `appendBattleLogToSubcollection(entry)` 추가·반환.
- **useGameActions.js**: 파라미터에 `appendBattleLogToSubcollection` 추가. 스파링·아레나·에너지 부족 스킵·퀘스트 승/패 시 동일 entry로 `appendBattleLogToSubcollection(entry).catch(() => {})` 호출(5곳).
- **Game.jsx**: useGameData에서 `appendBattleLogToSubcollection` destructure, useGameActions에 전달.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/docs/ACTIVITY_VS_BATTLE_LOGS_SUBCOLLECTION.md`

### 참고
- Firestore에서 `battleLogs` 서브컬렉션에 `orderBy("timestamp","desc")` 쿼리 사용 시 복합 인덱스 필요할 수 있음. 에러 링크 따라 인덱스 생성하면 됨.

---

## [2026-01-28] Refactor: Activity Logs 전면 서브컬렉션(방안 A) 적용

### 작업 유형
- ♻️ 리팩토링 (Firestore 저장 구조)

### 목적 및 영향
- **목적:** `activityLogs`를 슬롯 문서가 아닌 서브컬렉션 `users/{uid}/slots/slot{N}/logs`에만 저장하여 문서 크기·쓰기 비용 절감.
- **영향:** 저장 시 슬롯 문서에서 `activityLogs` 제외, 로그 추가 시마다 `logs` 서브컬렉션에만 `addDoc`. 로드 시 `logs` 쿼리(또는 fallback으로 기존 문서의 `activityLogs`).

### 변경 사항
- **useGameData.js**: saveStats에서 `activityLogs` 제외, loadSlot에서 `logs` 서브컬렉션 쿼리, `appendLogToSubcollection(logEntry)` 추가·반환.
- **Game.jsx**: 1초 타이머(CALL, CARE_MISTAKE, POOP, DEATH), resetDigimon(NEW_START), handlers에 `appendLogToSubcollection` 포함.
- **useGameActions, useGameAnimations, useGameHandlers, useEvolution, useDeath, useFridge**: 파라미터에 `appendLogToSubcollection` 추가, 로그 추가 직후 `appendLogToSubcollection(마지막 로그).catch(() => {})` 호출.
- **GameModals.jsx**: handlers에서 `appendLogToSubcollection` 사용, DIET/REST/DETOX/PLAY_OR_SNACK/CAREMISTAKE 및 수면방해 처리 시 서브컬렉션 기록, StatsPopup에 prop 전달.
- **StatsPopup.jsx**: `appendLogToSubcollection` prop 추가, 야행성 모드 ACTION 로그 추가 시 호출.
- **docs/ACTIVITY_LOGS_AND_SUBCOLLECTION.md**: §5 방안 A 적용 완료 및 기존 슬롯 마이그레이션 안내 추가.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameAnimations.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameHandlers.js`
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
- `digimon-tamagotchi-frontend/src/hooks/useDeath.js`
- `digimon-tamagotchi-frontend/src/hooks/useFridge.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/GameModals.jsx`
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx`
- `digimon-tamagotchi-frontend/docs/ACTIVITY_LOGS_AND_SUBCOLLECTION.md`

---

## [2026-01-28] Refactor: 시간 필드 숫자(ms) 통일 및 null 필드 정리

### 작업 유형
- ♻️ 리팩토링 (데이터 정밀도·용량 개선)

### 목적 및 영향
- **목적:** Firestore 저장 데이터의 정렬·비교 효율 향상 및 불필요 필드 누적 방지. 기존 문자열 날짜 데이터는 하위 호환 유지.
- **영향:** 새 슬롯은 `createdAt` 숫자(ms), 일일 수면 케어 미스는 `sleepMistakeDate` 해당일 0시 ms. 표시 시에만 포맷. 저장 시 null/undefined 제거(cleanObject)로 문서 크기·가독성 개선.

### 변경 사항

#### 1. `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
- 슬롯 생성 시 `createdAt: now.getTime()` (숫자 ms) 저장. `createdAtStr` 제거.
- `formatSlotCreatedAt(value)` 추가: 숫자면 `new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })`, 문자열(구 데이터)이면 그대로 표시.
- 슬롯 카드·순서변경 모달에서 생성일 표시를 `formatSlotCreatedAt(slot.createdAt)` 사용.

#### 2. `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- 1초 타이머 내 일자 변경 감지: `todayStartMs = new Date(y,m,d).getTime()`, `sleepMistakeDate` 비교 시 숫자면 `!== todayStartMs`, 문자열이면 `!== toDateString()` 호환.
- 새 날이면 `sleepMistakeDate = todayStartMs`, `dailySleepMistake = false`.
- 수면 케어 미스 발생 시 `sleepMistakeDate = todayStartMs`로 기록 (저장 시 새 형식으로 유지).

#### 3. `digimon-tamagotchi-frontend/docs/FIREBASE_SLOT_STORAGE.md`
- §6.1 적용 완료: cleanObject, createdAt 숫자(ms), sleepMistakeDate 해당일 0시 ms 정리.
- §8 다음 단계: 3·4번에 적용 완료 사항 반영.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/docs/FIREBASE_SLOT_STORAGE.md`

---

## [2026-01-28] Fix: BlitzGreymon·CresGarurumon 등 v1·v2 공통 ID 버전별 데이터 사용

### 작업 유형
- 🐛 버그 수정

### 목적 및 영향
- **목적:** v2에서 BlitzGreymon, CresGarurumon으로 ID 변경 후, merge 시 v2가 v1을 덮어써 Ver.1 슬롯에서 잘못된 스프라이트/스탯이 나오던 문제 수정
- **영향:** 슬롯 버전(Ver.1/Ver.2)에 따라 올바른 디지몬 데이터 사용. Ver.1 슬롯은 v1 전용 맵, Ver.2 슬롯은 v2 우선(공통 ID 시 v2) 맵 사용

### 변경 사항

#### 1. `src/pages/Game.jsx`
- `adaptedV1` = adaptDataMapToOldFormat(v1만), `mergedAdapted` = adaptDataMapToOldFormat(v1+v2 merge) 추가
- `digimonDataForSlot` = slotVersion === "Ver.2" ? mergedAdapted : adaptedV1
- `evolutionDataForSlot` = slotVersion === "Ver.2" ? mergedDigimonData : newDigimonDataVer1
- useGameData, useEvolution, useDeath, useGameHandlers, useGameAnimations, GameModals에 `digimonDataVer1` 대신 `digimonDataForSlot` 전달
- evolution·이름 lookup에 `evolutionDataForSlot` 사용. 스프라이트/수면/초기화 등에 `digimonDataForSlot` 사용
- useGameState에는 초기 상태용으로 `adaptedV1` 전달

#### 2. `src/pages/SelectScreen.jsx`
- `mergedDigimonData` 제거, `getDigimonDataForSlot(digimonId, slotVersion)` 도입
- 슬롯별 디지몬 이름/placeholder는 `getDigimonDataForSlot(slot.selectedDigimon, slot.version)` 사용

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`

---

## [2026-01-28] Refactor: v2 digimons.js를 v1과 동일 구조로 구성 (사망/알 Ver.2 전용 ID)

### 작업 유형
- ♻️ 리팩토링

### 목적 및 영향
- **목적:** v2 디지몬 데이터를 v1/digimons.js와 동일한 스키마·항목 구성으로 통일. 오하카다몬V2·디지타마V2는 공통으로 쓰지 않고 Ver.2 전용 ID 사용
- **영향:** Ver.2 전용 사망 폼(Ohakadamon1V2/Ohakadamon2V2), 알(DigitamaV2), Baby I/II(Punimon, Tsunomon) 및 Child~Super Ultimate 라인까지 v1과 동일 구조. 디지몬 이름(name)은 사용자가 직접 수정

### 변경 사항

#### 1. `src/data/v2modkor/digimons.js`
- v1과 동일한 JSDoc 스키마 + `spriteBasePath`, `V2_SPRITE_BASE` 유지
- 사망: `Ohakadamon1V2`, `Ohakadamon2V2` (이름 placeholder: "사망(일반)", "사망(perfect)")
- 알: `DigitamaV2` (이름 placeholder: "알") → 8초 후 Punimon
- Baby I: Punimon → Tsunomon
- Baby II: Tsunomon → GabumonV2, BetamonV2 (v1 Koromon과 동일 조건 구조)
- Child~Super Ultimate: GabumonV2, BetamonV2, GreymonV2, … OmegamonAlterSV2, CresGarurumonV2 (v1과 동일 진화/스탯 구조, sprite 번호·이름은 placeholder)

#### 2. Ver.2 사망/알/진화 연동
- **useDeath.js:** Ver.2일 때 `Ohakadamon1V2`/`Ohakadamon2V2` 사용. 도감 업데이트 시 `DigitamaV2` 제외
- **Game.jsx:** `DEATH_FORM_IDS`에 Ohakadamon1V2, Ohakadamon2V2 추가. resetDigimon 시 Ver.2면 `DigitamaV2`로 초기화. DigitamaV2 수면/idle 처리. 진화·이름 lookup에 `mergedDigimonData` 사용
- **DeathPopup.jsx:** 사망 폼 판별에 Ohakadamon1V2, Ohakadamon2V2 포함
- **EncyclopediaModal.jsx:** 사망 폼 제외를 `stage !== "Ohakadamon"`만 사용

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/v2modkor/digimons.js`
- `digimon-tamagotchi-frontend/src/hooks/useDeath.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/DeathPopup.jsx`
- `digimon-tamagotchi-frontend/src/components/EncyclopediaModal.jsx`

---

## [2026-01-28] Fix: Ver.2 슬롯 로드 시 초기 디지몬 푸니몬(Punimon) 유지

### 작업 유형
- 🐛 버그 수정

### 목적 및 영향
- **목적:** Ver.2 슬롯을 열었을 때 저장된 `selectedDigimon`(Punimon)이 깜몬(Digitama/Botamon)으로 덮어씌워지던 문제 수정
- **영향:** Ver.2 슬롯 로드 시 푸니몬이 올바르게 표시됨. 빈 스탯인 새 Ver.2 슬롯도 Punimon으로 초기화

### 변경 사항

#### `src/hooks/useGameData.js`
- `savedName`: `slotData.selectedDigimon`이 없을 때 Ver.2면 `"Punimon"`, Ver.1이면 `"Digitama"`로 기본값 설정
- `savedStats`가 비어 있을 때(새 디지몬): `initializeStats("Digitama", ...)` / `setSelectedDigimon("Digitama")` 대신 **저장된 이름(`savedName`)** 으로 초기화하여 Ver.2 슬롯의 Punimon 유지

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`

---

## [2026-01-28] Feat: SelectScreen Ver.2 선택 기능 및 도감 Ver.2 별도 관리

### 작업 유형
- ✨ 기능 추가

### 목적 및 영향
- **목적:** 선택 화면에서 Ver.2 선택 가능, Ver.2 선택 시 Punimon으로 시작. 도감에서 Ver.1과 Ver.2를 별도로 관리
- **영향:** 사용자가 Ver.2를 선택하면 Punimon으로 시작하며, 도감에서 Ver.1/Ver.2 탭으로 분리하여 관리

### 변경 사항

#### 1. `src/pages/SelectScreen.jsx`
- Ver.2 옵션 활성화 (disabled 제거)
- Ver.2 선택 시 `selectedDigimon: "Punimon"`으로 시작 (Ver.1은 "Digitama")
- v1+v2 merge된 데이터로 디지몬 이름 표시

#### 2. `src/hooks/useEncyclopedia.js`
- `updateEncyclopedia`에 `version` 파라미터 추가 (기본값 "Ver.1")
- Ver.2 도감 데이터를 `encyclopedia["Ver.2"]`에 별도 저장

#### 3. `src/hooks/useEvolution.js`, `src/hooks/useDeath.js`
- `version` 파라미터 추가 (기본값 "Ver.1")
- `updateEncyclopedia` 호출 시 `version` 전달

#### 4. `src/pages/Game.jsx`
- `useEvolution`, `useDeath` 호출 시 `slotVersion || "Ver.1"` 전달

#### 5. `src/components/EncyclopediaModal.jsx`
- Ver.2 탭 추가 (Ver.1과 별도 표시)
- `selectedVersion`에 따라 v1/v2 디지몬 목록 표시
- v2 디지몬 스프라이트 경로 (`spriteBasePath`) 처리
- 도감 강제 업데이트 시 v2 디지몬도 처리

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
- `digimon-tamagotchi-frontend/src/hooks/useEncyclopedia.js`
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
- `digimon-tamagotchi-frontend/src/hooks/useDeath.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/EncyclopediaModal.jsx`

---

## [2026-01-28] Feat: Ver.2 푸니몬 테스트 추가 및 v2 스프라이트 경로(Ver2_Mod_Kor) 반영

### 작업 유형
- ✨ 기능 추가

### 목적 및 영향
- **목적:** v2 디지몬 테스트로 푸니몬 추가, v2 스프라이트를 `public/Ver2_Mod_Kor` 경로에서 로드하도록 반영
- **영향:** Game.jsx에서 v1+v2 merge 후 adapter 적용. Punimon 선택 시 Canvas가 `/Ver2_Mod_Kor/210.png` 등으로 이미지 로드

### 변경 사항

#### 1. `src/data/v2modkor/digimons.js`
- 푸니몬(Punimon) 엔트리 추가: Baby I, sprite 210, `spriteBasePath: '/Ver2_Mod_Kor'`
- `V2_SPRITE_BASE` export 추가

#### 2. `src/data/v1/adapter.js`
- `adaptNewDataToOldFormat`에 `spriteBasePath` 전달 추가 (v2 UI 경로용)

#### 3. `src/pages/Game.jsx`
- `digimonDataVer2` import, v1+v2 merge 후 `adaptDataMapToOldFormat(mergedDigimonData)` 적용
- `digimonImageBase = digimonData?.spriteBasePath || "/images"` 계산 후 GameScreen에 `digimonImageBase` prop 전달

#### 4. `src/components/GameScreen.jsx`
- `digimonImageBase` prop 추가 (기본값 `/images`), Canvas에 전달

#### 5. `src/components/Canvas.jsx`
- `digimonImageBase` prop 추가 (기본값 `/images`)
- 디지몬 프레임 이미지 경로: `/images/${fn}.png` → `${digimonImageBase}/${fn}.png`

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/v2modkor/digimons.js`
- `digimon-tamagotchi-frontend/src/data/v2modkor/index.js`
- `digimon-tamagotchi-frontend/src/data/v1/adapter.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/GameScreen.jsx`
- `digimon-tamagotchi-frontend/src/components/Canvas.jsx`

---

## [2026-01-28] Refactor: 미사용 데이터 nonuse 이동 및 v2 버전 관리 폴더(v2modkor) 추가

### 작업 유형
- ♻️ 리팩토링

### 목적 및 영향
- **목적:** 미사용 데이터 파일을 `data/nonuse/` 아래로 정리하고, v2 디지몬 버전 관리를 위해 `src/data/v2modkor/` 구조 추가
- **영향:** 기존 앱 동작 변경 없음. 데이터 참조는 모두 v1/digimons.js만 사용 중이므로 이동한 파일은 미사용 상태 유지

### 변경 사항

#### 1. 미사용 파일 → `src/data/nonuse/` 이동
- `digimondata_digitalmonstercolor25th_ver1.js` → `nonuse/digimondata_digitalmonstercolor25th_ver1.js`
- `digimondata_digitalmonstercolor25th_ver2.js` → `nonuse/digimondata_digitalmonstercolor25th_ver2.js`
- `evolution_digitalmonstercolor25th_ver1.js` → `nonuse/evolution_digitalmonstercolor25th_ver1.js`  
- 원본 파일은 삭제 (내용은 nonuse 아래에 보존)

#### 2. v2 버전 관리 폴더 추가: `src/data/v2modkor/`
- `v2modkor/digimons.js`: `digimonDataVer2` export (v1과 동일 스키마, 현재 빈 객체)
- `v2modkor/index.js`: re-export  
- Ver.2 라인(푸니몬, 쯔노몬 등) 추가 시 이 폴더에 정의하여 버전별로 관리

#### 3. 문서 수정
- `digimon-tamagotchi-frontend/docs/DIGIMON_DATA_AND_V2_GUIDE.md`: 미사용 파일 경로를 nonuse 기준으로 수정, v2 추가 방법을 v2modkor 기준으로 수정

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/nonuse/` (신규 3개 파일)
- `digimon-tamagotchi-frontend/src/data/v2modkor/digimons.js` (신규)
- `digimon-tamagotchi-frontend/src/data/v2modkor/index.js` (신규)
- `digimon-tamagotchi-frontend/src/data/digimondata_digitalmonstercolor25th_ver1.js` (삭제)
- `digimon-tamagotchi-frontend/src/data/digimondata_digitalmonstercolor25th_ver2.js` (삭제)
- `digimon-tamagotchi-frontend/src/data/evolution_digitalmonstercolor25th_ver1.js` (삭제)
- `digimon-tamagotchi-frontend/docs/DIGIMON_DATA_AND_V2_GUIDE.md`

---

## [2026-01-28] Fix: 티라노몬 수면 중 데블몬 스프라이트 표시 버그 수정 (2차 수정)

### 작업 유형
- 🐛 버그 수정

### 목적 및 영향
- **문제:** 티라노몬이 수면 중일 때 데블몬 스프라이트가 표시되고, 수면 중인데도 수면 호출 배지가 표시되는 버그
- **원인:** 
  1. 모든 프레임 계산에서 `digimonStats.sprite`를 사용하여 데이터 불일치 발생
  2. 수면 중일 때 수면 호출을 비활성화하는 로직 누락
- **해결:** 모든 프레임 계산을 `selectedDigimon`에서 직접 스프라이트를 가져오도록 수정, 수면 중 수면 호출 비활성화 로직 추가

### 변경 사항

#### 1. `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- **위치:** 920-983줄
- **변경 내용:**
  - 모든 프레임 계산(일반, 죽음, 부상, 수면)에서 `selectedDigimon`에서 직접 스프라이트 가져오기
  - `baseSprite` 변수를 한 번만 계산하여 모든 프레임 계산에 사용
  - 데이터 일관성 보장

```javascript
// 변경 전: 각 프레임 계산마다 digimonStats.sprite 사용
idleFrames= idleOff.map(n=> `${digimonStats.sprite + n}`);
idleFrames= [ `${digimonStats.sprite+14}` ];
idleFrames = [`${digimonStats.sprite + 13}`, `${digimonStats.sprite + 14}`];

// 변경 후: baseSprite를 한 번만 계산하여 모든 곳에서 사용
const digimonData = digimonDataVer1[selectedDigimon];
const baseSprite = digimonData?.sprite ?? digimonStats.sprite;
idleFrames= idleOff.map(n=> `${baseSprite + n}`);
idleFrames= [ `${baseSprite+14}` ];
idleFrames = [`${baseSprite + 13}`, `${baseSprite + 14}`];
```

#### 2. `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- **위치:** 520-533줄
- **변경 내용:**
  - 수면 중일 때 수면 호출 비활성화 로직 추가
  - `isActuallySleeping`이 true일 때 수면 호출 즉시 비활성화

```javascript
// 변경 전
if (isSleepTime && isLightsOn && !callStatus.sleep.isActive) {
  callStatus.sleep.isActive = true;
  callStatus.sleep.startedAt = now.getTime();
}

// 변경 후
if (isActuallySleeping) {
  // 실제로 잠들었으면 수면 호출 비활성화
  callStatus.sleep.isActive = false;
  callStatus.sleep.startedAt = null;
} else {
  // 잠들지 않았을 때만 수면 호출 체크
  // ... 기존 로직 ...
}
```

### 해결된 문제
1. ✅ 티라노몬 수면 중 올바른 스프라이트(301, 302) 표시
2. ✅ 모든 상태(일반, 죽음, 부상, 수면)에서 올바른 스프라이트 표시
3. ✅ 수면 중일 때 수면 호출 배지 비활성화
4. ✅ 데이터 일관성 보장

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`

### 관련 문서
- `docs/TYRANOMON_SLEEP_SPRITE_BUG_ANALYSIS.md` - 상세 분석 문서

---

## [2026-01-28] Fix: 티라노몬 수면 중 데블몬 스프라이트 표시 버그 수정 (1차 수정)

### 작업 유형
- 🐛 버그 수정

### 목적 및 영향
- **문제:** 티라노몬이 수면 중일 때 데블몬 스프라이트가 표시되는 버그
- **원인:** `selectedDigimon`과 `digimonStats.sprite` 값이 불일치하여 수면 프레임 계산이 잘못됨
- **해결:** 수면 프레임 계산 시 `selectedDigimon`에서 직접 스프라이트를 가져오도록 수정

### 변경 사항

#### 1. `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- **위치:** 971-979줄
- **변경 내용:**
  - 수면 프레임 계산 시 `digimonStats.sprite` 대신 `selectedDigimon`에서 직접 스프라이트 가져오기
  - 데이터 일관성 보장을 위해 `digimonDataVer1[selectedDigimon]?.sprite` 우선 사용
  - `digimonStats.sprite`는 fallback으로만 사용

```javascript
// 변경 전
idleFrames = [`${digimonStats.sprite + 11}`, `${digimonStats.sprite + 12}`];

// 변경 후
const digimonData = digimonDataVer1[selectedDigimon];
const baseSprite = digimonData?.sprite ?? digimonStats.sprite;
idleFrames = [`${baseSprite + 11}`, `${baseSprite + 12}`];
```

#### 2. `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
- **위치:** 209줄 근처
- **변경 내용:**
  - 진화 시 스프라이트 값 강제 동기화 추가
  - `initializeStats` 후 `digimonDataVer1`에서 직접 스프라이트 가져와서 덮어쓰기

```javascript
const nx = initializeStats(newName, resetStats, digimonDataVer1);

// 스프라이트 값 강제 동기화 (데이터 일관성 보장)
if (newDigimonData?.sprite !== undefined) {
  nx.sprite = newDigimonData.sprite;
}
```

#### 3. `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- **위치:** 461줄 근처
- **변경 내용:**
  - 슬롯 로드 시 `selectedDigimon`과 `digimonStats.sprite` 일치 여부 확인
  - 불일치 시 자동으로 올바른 스프라이트 값으로 수정

```javascript
// 스프라이트 값 동기화 확인 (데이터 일관성 보장)
if (digimonDataVer1 && savedName && digimonDataVer1[savedName]) {
  const expectedSprite = digimonDataVer1[savedName].sprite;
  if (expectedSprite !== undefined && savedStats.sprite !== expectedSprite) {
    console.warn("[loadSlot] 스프라이트 불일치 감지 및 수정:", {
      selectedDigimon: savedName,
      savedSprite: savedStats.sprite,
      expectedSprite: expectedSprite,
    });
    savedStats.sprite = expectedSprite;
  }
}
```

### 해결된 문제
1. ✅ 티라노몬 수면 중 올바른 스프라이트 표시
2. ✅ 진화 후 스프라이트 값 자동 동기화
3. ✅ 기존 불일치 데이터 자동 수정

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`

### 관련 문서
- `docs/TYRANOMON_SLEEP_SPRITE_BUG_ANALYSIS.md` - 상세 분석 문서

---
