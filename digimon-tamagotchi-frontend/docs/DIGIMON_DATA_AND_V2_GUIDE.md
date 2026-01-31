# 디지몬 데이터 구조 및 v2 디지몬 추가 가이드

## 1. 현재 디지몬 관련 정보 구조

### 1.1 단일 소스: `src/data/v1/digimons.js`

- **실제 사용되는 디지몬 데이터**는 `src/data/v1/digimons.js` 한 곳에서 관리됩니다.
- `digimonDataVer1` 객체로 export하며, **새 구조(스키마)** 를 사용합니다.

**스키마 (JSDoc 기준):**

| 필드 | 설명 |
|------|------|
| `id` | 디지몬 고유 ID |
| `name` | 표시 이름 (한국어) |
| `stage` | 진화 단계 (Digitama, Baby I, Baby II, Child, Adult, Perfect, Ultimate, Super Ultimate) |
| `sprite` | 스프라이트 번호 (이미지 파일명) |
| `stats` | hungerCycle, strengthCycle, poopCycle, maxOverfeed, basePower, maxEnergy, minWeight, healDoses, type, sleepTime, attackSprite |
| `evolutionCriteria` | 진화 조건 (timeToEvolveSeconds 등) |
| `evolutions` | 진화 경로 배열 (targetId, targetName, conditions) |

### 1.2 데이터 흐름

1. **Game.jsx**
   - `v1/digimons.js`에서 `digimonDataVer1`(새 구조) import
   - `v1/adapter.js`의 `adaptDataMapToOldFormat()`으로 **구형 필드명** 맵 생성
   - 이 맵을 `digimonDataVer1`라는 이름으로 훅/로직에 전달 (evolutionStage, hungerTimer, strengthTimer 등)

2. **adapter 역할** (`src/data/v1/adapter.js`)
   - 새 구조 → 구 구조 필드 매핑:
     - `stage` → `evolutionStage`
     - `stats.hungerCycle` → `hungerTimer`
     - `stats.strengthCycle` → `strengthTimer`
     - `stats.poopCycle` → `poopTimer`
     - `stats.maxEnergy` → `maxStamina`
   - 훅/로직은 이 구형 필드명을 사용하고, UI/도감 등은 새 구조(id, name, stage, evolutions)를 그대로 사용

3. **직접 v1/digimons 사용**
   - EncyclopediaModal, SelectScreen, ArenaScreen, SparringModal, BattleScreen, QuestSelectionModal, questEngine 등은 `../data/v1/digimons`에서 `digimonDataVer1`를 직접 import해 **이름·단계·진화·스탯** 표시에 사용

### 1.3 관련 파일 요약

| 파일 | 역할 |
|------|------|
| `src/data/v1/digimons.js` | 디지몬 마스터 데이터 (단일 소스) |
| `src/data/v1/adapter.js` | 새 구조 → 구 구조 변환 (Game에서만 사용) |
| `src/data/v1/quests.js` | 퀘스트/적 디지몬 ID 참조 |
| `src/data/v1/evolution.js` | deprecated, 진화는 digimons.js의 evolutions 사용 |
| `src/data/stats.js` | initializeStats, applyLazyUpdate 등 (디지몬 ID/데이터 참조) |
| `src/data/train_digitalmonstercolor25th_ver1.js` | 훈련 로직(doVer1Training) — **사용 중** |

---

## 2. 미사용·레거시 파일 (nonuse 아래로 이동됨)

다음 파일들은 **앱에서 사용되지 않으며** `src/data/nonuse/` 아래에 두었습니다.

| 파일 | 설명 |
|------|------|
| `src/data/nonuse/digimondata_digitalmonstercolor25th_ver1.js` | 구형 디지몬 데이터. v1/digimons로 대체됨. |
| `src/data/nonuse/digimondata_digitalmonstercolor25th_ver2.js` | 구 Ver.2 스텁. v2는 **src/data/v2modkor/** 사용. |
| `src/data/nonuse/evolution_digitalmonstercolor25th_ver1.js` | 구형 진화 조건. @deprecated. |
| `src/data/nonuse/digimonData.js` | version/stage 등 다른 스키마. **미사용.** |
| `src/data/nonuse/evolutionConditions.js` | **미사용.** |
| `src/components/EvolutionSelector.jsx` | `../data/digimonData` import(해당 파일 없음). 사용처 없음 → dead code 가능성. |

---

## 3. v2 디지몬 추가 방법

v2 디지몬은 **버전 관리를 위해 `src/data/v2modkor/`** 에 두고, 스키마는 v1과 동일하게 유지합니다.

- **v2 전용 데이터:** `src/data/v2modkor/digimons.js` — `digimonDataVer2` export
- **앱에서 사용:** v1과 merge하여 사용하거나, Game/훅에서 v2를 합친 맵을 쓸 수 있음

### 3.1 v2 데이터 추가 위치: `src/data/v2modkor/digimons.js`

Ver.2 라인(푸니몬→쯔노몬 등)은 **v2modkor/digimons.js**의 `digimonDataVer2` 객체에 추가합니다.  
(v1에 통합해서 쓸 경우에는 `src/data/v1/digimons.js`에 추가해도 됨.)

1. **진입점 추가**  
   - Ver.2 알 라인을 쓰려면 `digimonDataVer2`에 **DigitamaVer2**를 두거나, 기존 Digitama의 `evolutions`에 Ver.2 1단계(Baby I)를 넣을 수 있음.  
   - “알 선택(Ver.1 / Ver.2)”이 있으면 Ver.2 전용 Digitama(예: `DigitamaVer2`)를 두고, 그 `evolutions`에 푸니몬 등을 넣으면 됨.

2. **각 디지몬 엔트리** (v2modkor/digimons.js 또는 v1/digimons.js에 동일 스키마로)  
   - 기존 Ver.1과 같은 형태로 한 개씩 추가:

```javascript
Punimon: {
  id: "Punimon",
  name: "푸니몬",
  stage: "Baby I",
  sprite: 211,  // 실제 스프라이트 번호로 교체
  stats: {
    hungerCycle: 3,
    strengthCycle: 3,
    poopCycle: 3,
    maxOverfeed: 3,
    basePower: 0,
    maxEnergy: 5,
    minWeight: 5,
    healDoses: 0,
    type: "Free",
    sleepTime: null,
    attackSprite: null,
  },
  evolutionCriteria: {
    timeToEvolveSeconds: 600,
  },
  evolutions: [
    { targetId: "Tsunomon", targetName: "쯔노몬" },
  ],
},
Tsunomon: {
  id: "Tsunomon",
  name: "쯔노몬",
  stage: "Baby II",
  // ... 동일 패턴
  evolutions: [
    { targetId: "Gabumon", targetName: "가브몬", conditions: { careMistakes: { max: 3 } } },
    { targetId: "Elecmon", targetName: "엘레키몬", conditions: { careMistakes: { min: 4 } } },
  ],
},
// 이후 성장기, 성숙기 등도 동일하게...
```

3. **진화 조건**  
   - `evolutionCriteria`: 주로 `timeToEvolveSeconds`  
   - `evolutions[].conditions`: 케어미스·훈련 등은 기존과 동일 (예: `careMistakes: { max: 3 }`, `trainings: { min: 32 }`).  
   - `logic/evolution/checker.js`가 `digimons.js`의 이 구조를 그대로 사용하므로, v1과 같은 형식이면 추가 코드 없이 동작합니다.

4. **스프라이트**  
   - `sprite`, `stats.attackSprite`를 실제 에셋 번호에 맞게 설정.  
   - `/public/images/<sprite>.png` 등 기존 규칙과 동일하게 두면 됨.

### 3.2 게임에서 Ver.2 라인을 쓰이게 하려면

- **알 선택 화면**에서 Ver.2 알을 선택하면 `DigitamaVer2`(또는 Ver.2 전용 ID)로 시작하도록 초기 `selectedDigimon` / 슬롯 데이터만 설정해 주면 됩니다.  
- 나머지(진화, 배틀, 도감, 수면 등)는 이미 `digimonDataVer1`와 adapter에 의존하므로, **v1/digimons.js에만 추가하면 자동으로 반영**됩니다.

### 3.3 v2 전용 폴더 사용 (버전 관리)

- **v2 데이터 위치:** `src/data/v2modkor/`
  - `digimons.js`: `digimonDataVer2` export (v1과 동일 스키마)
  - `index.js`: re-export
- 앱에서 v2를 쓰려면: Game.jsx 등에서 `digimonDataVer1`와 `digimonDataVer2`를 **merge**한 맵을 만들어 adapter에 넘기거나, v1/digimons.js에서 v2modkor를 import해 merge한 뒤 한 맵으로 사용하면 됨.

---

## 4. 체크리스트 (v2 디지몬 추가 시)

- [ ] **v2 전용:** `src/data/v2modkor/digimons.js`의 `digimonDataVer2`에 엔트리 추가 (id, name, stage, sprite, stats, evolutionCriteria, evolutions)
- [ ] 스프라이트 번호와 이미지 파일(`/public/images/`) 일치 확인
- [ ] 진화 경로가 서로 가리키도록(예: Punimon → Tsunomon) evolutions 배열 연결
- [ ] (선택) Game 등에서 v1+v2 merge 후 adapter에 넘기도록 수정
- [ ] (선택) Ver.2 알 선택 시 해당 Digitama/ID로 시작하도록 선택 화면·초기화 로직 수정
- [ ] 필요 시 `docs/REFACTORING_LOG.md`에 변경 사항 기록

---

**폴더 구조 요약**

- **사용 중:** `src/data/v1/` (digimons, adapter, quests 등), `src/data/v2modkor/` (v2 버전 관리)
- **미사용:** `src/data/nonuse/` (구 ver1/ver2/evolution 데이터 등)

이 가이드는 2025년 1월 기준 코드베이스 구조를 바탕으로 작성되었습니다.
