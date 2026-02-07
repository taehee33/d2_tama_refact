# Activity Logs 정리 및 서브컬렉션 분리 분석

## 1. 로그에 저장되는 항목 정리

### 1.1 로그 엔트리 구조

모든 활동 로그는 동일한 스키마를 사용합니다.

```js
{
  type: string,   // 로그 타입 (아래 표 참고)
  text: string,   // 사용자/디버깅용 메시지
  timestamp: number  // Date.now() (ms)
}
```

- **생성 방식**: `useGameLogic.addActivityLog(currentLogs, type, text)` 또는 수동 `{ type, text, timestamp: Date.now() }`.
- **보관 개수**: `useGameLogic`은 최대 **100개**, `useGameActions` 등 수동 추가 시 **50개**로 slice — 코드베이스 내 불일치 존재.

---

### 1.2 로그 타입 및 발생 위치

| 타입 | 발생 위치 | 용도 / 텍스트 예시 |
|------|-----------|---------------------|
| **FEED** | useGameActions (먹이 거절), useGameAnimations (먹이 성공) | 먹이 주기·거절·프로틴 과다 |
| **CARE_MISTAKE** / **CAREMISTAKE** | Game.jsx(1초 타이머), GameModals, useGameActions, useGameAnimations | 수면 방해, 수면 중 불 켜놓기, 케어 미스 (두 표기 혼용) |
| **CALL** | Game.jsx (1초 타이머) | Call: Hungry! / No Energy! / Sleepy! |
| **SLEEP_START** / **SLEEP_END** | Game.jsx (1초 타이머) | 잠들음 (HH:MM) / 깨어남 (HH:MM) |
| **POOP** | Game.jsx (1초 타이머) | 배변·부상 관련 (StatsPopup에서 POOP + 'Injury'로 부상 이력 필터) |
| **DEATH** | Game.jsx (사망 감지) | Death: Passed away (Reason: …) |
| **EVOLUTION** | useEvolution.js | Evolution: Evolved to {이름}! |
| **CLEAN** | useGameAnimations (청소) | 청소 완료 |
| **HEAL** | useGameAnimations (부상 치료) | 치료 완료 (수면 중이면 CARE_MISTAKE) |
| **ACTION** | useGameHandlers (조명 토글 등), StatsPopup (수동 로그) | 사용자 액션 설명 |
| **TRAIN** | useGameActions | 훈련 성공/실패 |
| **INJURY** | (필터만 사용) StatsPopup InjuryHistory | 부상 이력 탭 — type이 INJURY인 로그 표시 |
| **DIET** | GameModals | 다이어트(과식 감소) |
| **REST** | GameModals | 휴식 |
| **DETOX** | GameModals | 프로틴 디톡스 |
| **PLAY_OR_SNACK** | GameModals | 놀이/간식 |
| **FRIDGE** | useFridge.js | 냉장고 넣기/꺼내기 |
| **REINCARNATION** | useDeath.js (confirmDeath) | 오하카다몬(사망 폼)으로 환생 |
| **NEW_START** | Game.jsx (resetDigimon) | 새로운 시작(디지타마/디지타마V2로 초기화) |

**배틀 로그 (별도 관리)**  
배틀 관련 기록은 **activityLogs가 아닌 `digimonStats.battleLogs`** 배열로만 저장됩니다.  
- **위치**: `digimonStats.battleLogs` (최대 100개)  
- **형식**: `{ timestamp, mode: 'sparring'|'arena'|'quest'|'skip', text, win?, enemyName?, injury? }`  
- **추가**: useGameActions (스파링/아레나/퀘스트/에너지 부족 건너뜀)  
- **UI**: "추가 기능" → "⚔️ 배틀 기록" 모달, StatsPopup 부상 이력에서 배틀 부상은 battleLogs에서도 사용  

---

### 1.3 로그를 쓰는 코드 경로 요약

| 파일 | 역할 |
|------|------|
| **useGameLogic.js** | `addActivityLog()`, `initializeActivityLogs()` — 최대 100개 유지 |
| **useGameData.js** | 저장 시 `finalStats.activityLogs`를 `digimonStats`에 포함해 Firestore에 기록. 로드 시 `savedStats.activityLogs \|\| slotData.activityLogs` 사용 |
| **Game.jsx** | 1초 타이머: CALL, SLEEP_START, SLEEP_END, CAREMISTAKE, CARE_MISTAKE, POOP, DEATH |
| **useGameActions.js** | FEED, CARE_MISTAKE, TRAIN, CLEAN, BATTLE — 수동 `newLog` + `slice(0, 50)` |
| **useGameAnimations.js** | FEED, CLEAN, CARE_MISTAKE, HEAL — addActivityLog 사용 |
| **useGameHandlers.js** | ACTION (조명 등) |
| **useEvolution.js** | EVOLUTION |
| **useFridge.js** | FRIDGE |
| **GameModals.jsx** | DIET, REST, DETOX, PLAY_OR_SNACK, CAREMISTAKE |
| **StatsPopup.jsx** | ACTION (수동 입력 로그) |

---

### 1.4 로그를 읽는 UI

| 컴포넌트 | 용도 |
|----------|------|
| **ActivityLogModal** | 전체 로그를 `timestamp` 기준 최신순으로 목록 표시 |
| **StatsPopup** | SleepDisturbanceHistory(CARE_MISTAKE + '수면 방해'), CareMistakeHistory(CARE_MISTAKE/CAREMISTAKE), InjuryHistory(POOP+BATTLE+INJURY 필터) |
| **DigimonInfoModal** | activityLogs prop 전달 (표시 방식은 내부 구현에 따름) |
| **GameModals** | activityLogs 전달 |

---

## 1.5 로그 누락 검토 (검증 결과)

다음 이벤트에 대해 “로그가 있어야 하는데 빠진 곳이 없는지” 검토함.

| 이벤트 | 로그 여부 | 비고 |
|--------|-----------|------|
| 사망 감지 | ✅ DEATH (Game.jsx 1초 타이머) | 정상 |
| 오하카다몬으로 환생 (사망 확인) | ❌ **누락** | confirmDeath 시 “Reincarnation: …” 로그 없음 → **추가 권장** |
| 새로운 시작 (디지타마/디지타마V2 초기화) | ❌ **누락** | resetDigimon 시 “New start: …” 로그 없음 → **추가 권장** |
| 수면 중 불 30분 케어미스 | ✅ CARE_MISTAKE | TIRED 30분 경과와 동일 경로로 로그 추가됨 (sleepLightOnStart는 UI용) |
| 훈련 (일반 경로) | ✅ TRAIN | useGameActions.doTraining에서 로그 추가 후 setDigimonStatsAndSave 호출 |
| 훈련 (TrainPopup fallback) | ⚠️ 주의 | onTrainResult 없을 때 doVer1Training만 쓰고 저장하면 **TRAIN 로그 없음**. Game.jsx는 onTrainResult를 넘기므로 실제로는 fallback 미사용. |
| 배틀·먹이·청소·진화·냉장고·조명 등 | ✅ 해당 타입 존재 | 위 표 참고 |

**조치 완료**: 오하카다몬 환생(confirmDeath)에는 `REINCARNATION`, 새로운 시작(resetDigimon)에는 `NEW_START` 로그를 추가해 반영함.

---

## 2. 서브컬렉션 분리 분석

### 2.1 현재 구조의 한계

- **위치**: `users/{uid}/slots/slot{N}` 문서의 `digimonStats.activityLogs` 배열.
- **문제**: 로그가 슬롯 문서 크기를 키움. Firestore 문서 최대 1MB 제한에 근접할 수 있음.
- **저장 트리거**: 스탯 저장할 때마다 `activityLogs` 배열 전체를 `updateDoc(digimonStats)` 로 함께 전송 — 로그만 추가해도 전체 스탯 문서 쓰기 발생.

### 2.2 목표 구조 (서브컬렉션)

- **경로**: `users/{uid}/slots/slot{N}/logs/{logId}`
- **문서 필드 예시**:
  - `type` (string)
  - `text` (string)
  - `timestamp` (number, ms) — 쿼리·정렬용
- **문서 ID**: `timestamp` 기반 고유 ID (예: `ts_1738012345678_0` 또는 Firestore 자동 ID) — 같은 ms에 여러 로그 가능성 대비.

이렇게 하면:

- 슬롯 문서는 스탯·메타만 유지하고 크기 제한 부담이 줄어듦.
- 로그 추가는 서브컬렉션에 `addDoc` 한 번으로 가능 (부분 쓰기).
- 로그만 조회·페이징 가능 (예: `orderBy('timestamp', 'desc').limit(100)`).

### 2.3 영향받는 계층

| 계층 | 현재 | 서브컬렉션 전환 시 |
|------|------|---------------------|
| **저장소** | useGameData에서 `updateDoc(slotRef, { digimonStats })` 로 배열 전체 포함 | (1) 슬롯 문서에서는 `digimonStats`에서 `activityLogs` 제거 (2) 로그 추가 시 `collection(slotRef, 'logs')` 에 `addDoc` |
| **로드** | `slotData.digimonStats.activityLogs` 또는 `slotData.activityLogs` 한 번에 로드 | 슬롯 로드 후 별도 `getDocs(collection(slotRef, 'logs'), orderBy('timestamp', 'desc'), limit(100))` 로 최근 N개 로드 |
| **상태** | `activityLogs` 배열을 useGameState 등에서 보관 | 초기에는 서브컬렉션에서 로드한 배열로 설정. 새 로그 추가 시 로컬에 append + 서브컬렉션에 addDoc |
| **추가 시점** | setDigimonStats({ ...stats, activityLogs: updatedLogs }) 후 saveStats 호출 | (1) 로컬 setState로 activityLogs만 갱신 (2) 서브컬렉션에 addDoc (선택: saveStats는 digimonStats만 저장하고 activityLogs 제외) |

### 2.4 구체적 변경 포인트

1. **useGameData.js**
   - **saveStats**: Firestore에 보낼 `digimonStats`에서 `activityLogs` 제거 (이미 루트 중복 제거했던 것처럼).
   - **loadSlot**: `digimonStats` 로드 후 `logs` 서브컬렉션에서 최근 100(또는 50)개 쿼리해 `setActivityLogs`에 넣기. 기존 필드 fallback 유지: `savedStats.activityLogs || slotData.activityLogs` (마이그레이션 기간).
   - **새 함수**: `appendLogToSubcollection(slotId, logEntry)` — `collection(doc(db, 'users', uid, 'slots', 'slot'+slotId), 'logs')` 에 `addDoc` (type, text, timestamp).

2. **로그를 추가하는 모든 호출부**
   - 현재: `addActivityLog(currentLogs, type, text)` → `setDigimonStats(..., activityLogs: updatedLogs)` 또는 수동 배열 조작 후 `setDigimonStatsAndSave(statsWithLogs, updatedLogs)`.
   - 변경: (1) 로컬 `activityLogs`는 기존처럼 유지 (addActivityLog 또는 수동 push). (2) Firebase 사용 시 `appendLogToSubcollection(slotId, { type, text, timestamp })` 호출. (3) `saveStats`에 넘기던 `updatedLogs`는 로컬 상태 동기화용으로만 사용하고, Firestore 슬롯 문서에는 더 이상 포함하지 않음.

3. **Repository**
   - `UserSlotRepository`에 `getLogs(userId, slotId, { limit, orderBy })?`, `addLog(userId, slotId, logEntry)` 추가. useGameData는 이 메서드를 사용하거나, useGameData 내부에서 직접 Firestore 호출해도 됨.

4. **localStorage / 오프라인**
   - 현재 프로젝트는 Firebase 전용이라고 가정하면, 오프라인 시 로그는 메모리만 사용하고 복구 시 서브컬렉션에 재전송할지 정책 결정 필요. 또는 서브컬렉션 미지원 모드에서는 기존처럼 `digimonStats.activityLogs`에 유지하는 분기 가능.

### 2.5 UI 변경

- **ActivityLogModal, StatsPopup 등**: 데이터 소스만 “서브컬렉션에서 로드한 배열 + 로컬에서 방금 추가한 로그”로 바꾸면 됨. props는 그대로 `activityLogs` 배열.
- **필터링**: 기존과 동일 — type, text 기준 클라이언트 필터 (SleepDisturbanceHistory, CareMistakeHistory, InjuryHistory).

### 2.6 마이그레이션 전략

1. **이중 기록 기간 (선택)**  
   - 새 로그는 (1) 기존처럼 `digimonStats.activityLogs`에 append하고 (2) 동시에 `logs` 서브컬렉션에 `addDoc`.  
   - 로드 시: 서브컬렉션에 문서가 있으면 서브컬렉션 기준, 없으면 `digimonStats.activityLogs` 사용.

2. **기존 데이터 이전**  
   - 한 번성 스크립트 또는 관리자 기능: 기존 슬롯 문서의 `digimonStats.activityLogs`를 읽어, 각 항목을 `logs` 서브컬렉션에 문서로 추가.  
   - 이전 후 슬롯 문서에서 `activityLogs` 필드 제거 (필요 시).

3. **상수 통일**  
   - 최대 로그 개수 100 vs 50 통일. 서브컬렉션 조회 시 `limit(100)` 등으로 동일하게 맞추면 됨.

---

## 3. 서브컬렉션 분리 방안 3종 검토

아래는 **activityLogs**를 슬롯 문서에서 분리하는 방식에 대한 3가지 구체안입니다.  
(battleLogs는 이미 별도 배열로 관리 중이므로, 필요 시 동일 원리로 `battleLogs` 서브컬렉션을 둘 수 있음.)

---

### 방안 A: 전면 서브컬렉션 (기존 §2 제안)

**구조**
- 모든 활동 로그를 `users/{uid}/slots/slot{N}/logs/{logId}` 에만 저장.
- 슬롯 문서의 `digimonStats`에서는 `activityLogs` 필드 제거.
- 로드: 슬롯 문서 로드 후 `logs` 서브컬렉션에서 `orderBy('timestamp','desc').limit(100)` 쿼리로 최근 N개 로드.
- 추가: 로그 발생 시마다 로컬 `activityLogs` 갱신 + 서브컬렉션에 `addDoc` 1회.

| 구분 | 내용 |
|------|------|
| **장점** | 슬롯 문서 크기 최소화·1MB 한도 여유, 로그 추가 시 슬롯 문서 쓰기 없음(비용·충돌 감소), 로그만 페이징/재조회 가능, 구조가 단순하고 일관됨. |
| **단점** | 슬롯 진입 시 읽기 2회(슬롯 + logs), 로그를 추가하는 **모든 호출부**에서 서브컬렉션 `addDoc` 호출 추가 필요, 기존 데이터 마이그레이션(이중 기록 또는 일괄 이전) 필요. |
| **적합** | 로그가 많아질 가능성이 있는 슬롯, 장기적으로 문서 크기·쓰기 비용을 줄이고 싶을 때. |

---

### 방안 B: 하이브리드(최근 N개는 문서, 나머지는 서브컬렉션)

**구조**
- 슬롯 문서에는 **최근 20~30개**만 `digimonStats.activityLogs`로 유지.
- 그 이상 쌓이면 오래된 항목을 `logs` 서브컬렉션에 batch 쓰기 후 문서에서는 제거(trim).
- 로드: 슬롯 문서만 읽어서 `activityLogs` 사용. (선택) 서브컬렉션에서 추가 분량을 가져와 병합.

| 구분 | 내용 |
|------|------|
| **장점** | 슬롯 진입 시 읽기 1회로 최근 로그 즉시 표시, 기존 클라이언트와 호환 가능(필드 유지), 문서는 “최근 N개”로 제한되어 비대화 완화. |
| **단점** | “언제 서브컬렉션으로 넘길지” 규칙·trim 로직 필요, 로드 시 문서+서브컬렉션 병합 시 정렬·중복 제거 등 구현 복잡, 두 저장 위치를 함께 다뤄야 함. |
| **적합** | 진입 시 읽기 1회를 유지하면서, 로그가 매우 많아진 슬롯만 점진적으로 서브컬렉션을 쓰고 싶을 때. |

---

### 방안 C: 조건부 서브컬렉션(크기/모드 기준 전환)

**구조**
- 기본은 현재처럼 `digimonStats.activityLogs`에만 저장.
- **조건** 충족 시 서브컬렉션 모드로 전환:  
  예) `activityLogs.length >= 50` 이거나, 슬롯 메타에 `useLogSubcollection: true` 설정된 경우.
- 전환 후에는 로그 추가 시 서브컬렉션에만 `addDoc`, 로드 시에는 서브컬렉션에서만 조회. (문서 내 `activityLogs`는 비우거나 무시.)

| 구분 | 내용 |
|------|------|
| **장점** | 로그가 적은 슬롯은 코드·동작 변경 없이 기존 방식 유지, 마이그레이션을 “큰 슬롯만” 또는 “새 슬롯만” 선택 적용 가능. |
| **단점** | “문서 저장” vs “서브컬렉션 저장” 두 경로를 모두 유지해야 해서 코드 분기·테스트 부담, 조건/플래그 관리 필요, 동작 방식이 슬롯마다 달라져 이해 비용 증가. |
| **적합** | 당장은 전면 전환 없이, 로그가 폭증하는 일부 슬롯만 서브컬렉션으로 옮기고 싶을 때. |

---

### 비교 요약 및 권장

| 항목 | 방안 A (전면 서브컬렉션) | 방안 B (하이브리드) | 방안 C (조건부 전환) |
|------|--------------------------|----------------------|----------------------|
| 구현 난이도 | 중 (로드/저장/호출부 수정) | 높음 (trim·병합·규칙) | 중~높 (분기·플래그) |
| 슬롯 문서 크기 | 최소 | 제한적 감소 | 전환 전 슬롯은 그대로 |
| 읽기 비용(진입 시) | +1회 (logs 쿼리) | 1회 유지 | 전환 시 +1회 |
| 쓰기 비용(로그 추가) | 1 doc (서브컬렉션만) | 문서 또는 서브컬렉션 | 문서 또는 서브컬렉션 |
| 기존 데이터 | 마이그레이션 필요 | 점진적 이전 가능 | 선택적 마이그레이션 |
| 일관성 | 한 가지 방식으로 통일 | 문서+서브컬렉션 병합 | 슬롯별로 방식 상이 |

**권장**:  
- **단기·단순함 우선**: 지금 로그 수가 적다면 현 구조 유지 후, 로그가 실제로 많아지는 시점에 **방안 A**로 일괄 전환하는 것이 유지보수에 유리함.  
- **진입 읽기 1회를 반드시 유지해야 한다면**: **방안 B**를 검토할 수 있으나, trim/병합 로직과 규칙 설계 비용이 큼.  
- **방안 C**는 “예외 케이스용”으로만 쓰고, 장기적으로는 A로 통일하는 것을 권장.

---

## 4. 요약

- **저장 항목**: 위 표의 타입대로 `type`, `text`, `timestamp` 가 모든 로그에 공통으로 저장됨. 배틀은 `battleLogs` 배열로 별도 관리.
- **서브컬렉션 분리**: `users/{uid}/slots/slot{N}/logs` 로 로그만 분리하면 문서 크기·쓰기 비용을 줄일 수 있음. 변경 집약 지점은 **useGameData (로드/저장)** 와 **로그를 추가하는 모든 호출부에서 서브컬렉션 addDoc 호출 추가** 이며, UI는 기존 `activityLogs` 배열을 그대로 사용 가능함.
- **방안 선택**: 전면 서브컬렉션(A), 하이브리드(B), 조건부 전환(C) 중 팀 정책과 로그 증가 추이에 맞춰 선택하면 됨.

이 문서는 로그 항목 정리와 서브컬렉션 전환 시 분석·설계 참고용입니다. 실제 구현 시 `docs/REFACTORING_LOG.md` 에 단계별로 기록하는 것을 권장합니다.

---

## 5. 방안 A 적용 완료 (전면 서브컬렉션)

**적용 일자**: 2025-01-28

- **저장**: 슬롯 문서(`users/{uid}/slots/slot{N}`)에는 `activityLogs` 필드를 저장하지 않음. 로그는 **서브컬렉션** `users/{uid}/slots/slot{N}/logs` 에만 `addDoc`으로 추가됨.
- **로드**: `loadSlot` 시 `logs` 서브컬렉션을 `orderBy('timestamp','desc'), limit(100)` 으로 쿼리해 `activityLogs`로 사용. 실패/빈 결과면 기존 슬롯 문서의 `activityLogs`(또는 `savedStats.activityLogs`)를 fallback으로 사용.
- **호출부**: 모든 `addActivityLog` 후 저장하는 지점에서 `appendLogToSubcollection(마지막 로그 한 건)` 호출 (Game.jsx, useGameActions, useGameAnimations, useGameHandlers, useEvolution, useDeath, useFridge, GameModals, StatsPopup).

**기존 슬롯 마이그레이션**  
- 기존 데이터는 문서에 `activityLogs` 배열이 있어도 **로드 시 fallback**으로 읽히므로 별도 마이그레이션 없이 동작함.  
- 선택적 마이그레이션: 기존 슬롯 문서의 `activityLogs` 배열을 순회하며 `logs` 서브컬렉션에 `addDoc`으로 넣은 뒤, 문서에서 `activityLogs` 필드를 제거하는 스크립트/Cloud Function을 운영할 수 있음.
