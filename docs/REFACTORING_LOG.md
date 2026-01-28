# 리팩토링 로그

이 문서는 프로젝트의 주요 변경사항을 기록합니다.

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
