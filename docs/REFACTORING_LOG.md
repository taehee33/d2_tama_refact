# 리팩토링 로그

이 문서는 프로젝트의 주요 변경사항을 기록합니다.

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
