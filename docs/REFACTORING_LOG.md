# 리팩토링 로그

이 문서는 프로젝트의 주요 변경사항을 기록합니다.

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
