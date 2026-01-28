# 티라노몬 수면 중 데블몬 스프라이트 표시 버그 분석

**작성일:** 2026년 1월 28일  
**문제:** 티라노몬이 수면 중일 때 데블몬 스프라이트가 표시됨

## 🐛 문제 상황

**현상:**
- UI에는 "슬롯 5 - 티라노몬"으로 표시됨
- 디지몬 상태: 수면 중 😴
- 실제 표시되는 스프라이트: 데블몬 (Sprite: 301.png)
- 예상 스프라이트: 티라노몬 수면 프레임 (290 + 11 = 301, 290 + 12 = 302)

## 📋 데이터 분석

### 현재 DB 상태 (사용자 제공 데이터)

```javascript
{
  selectedDigimon: "Botamon",  // ❌ 티라노몬이어야 함
  digimonStats: {
    sprite: 210,  // ❌ Botamon의 스프라이트 (티라노몬은 290이어야 함)
    // ...
  }
}
```

### 스프라이트 번호 참조

- **티라노몬 (Tyranomon):** `sprite: 290`
- **데블몬 (Devimon):** `sprite: 300`
- **Botamon:** `sprite: 210`

### 수면 프레임 계산 로직

**위치:** `Game.jsx` 971-972줄

```javascript
else if((sleepStatus === "SLEEPING" || sleepStatus === "TIRED") && selectedDigimon !== "Digitama"){
  idleFrames = [`${digimonStats.sprite + 11}`, `${digimonStats.sprite + 12}`];
  // ...
}
```

**현재 계산:**
- `digimonStats.sprite = 210` (Botamon)
- 수면 프레임: `210 + 11 = 221`, `210 + 12 = 222`

**예상 계산 (티라노몬인 경우):**
- `digimonStats.sprite = 290` (Tyranomon)
- 수면 프레임: `290 + 11 = 301`, `290 + 12 = 302`

## 🔍 원인 분석

### 문제 1: 데이터 불일치

**현상:**
- `selectedDigimon`이 "Botamon"으로 저장되어 있음
- `digimonStats.sprite`가 210 (Botamon)으로 저장되어 있음
- 하지만 UI에는 "티라노몬"으로 표시됨

**가능한 원인:**
1. 진화 시 `selectedDigimon` 업데이트 누락
2. 진화 시 `digimonStats.sprite` 업데이트 누락
3. 데이터 로드 시 동기화 문제

### 문제 2: 스프라이트 파일 매핑

**현재 상황:**
- 수면 프레임 301이 데블몬 스프라이트로 표시됨
- 티라노몬의 수면 프레임 301이 실제로는 데블몬 스프라이트 파일을 가리키고 있을 가능성

**확인 필요:**
- `/images/301.png` 파일이 실제로 어떤 디지몬 스프라이트인지
- 티라노몬의 수면 프레임 파일이 올바르게 존재하는지

## 💡 해결 방안

### 해결책 1: 데이터 동기화 확인

**수정 위치:** `useEvolution.js` - `evolve` 함수

**현재 코드:**
```javascript:209:digimon-tamagotchi-frontend/src/hooks/useEvolution.js
const nx = initializeStats(newName, resetStats, digimonDataVer1);
```

**확인 사항:**
1. `initializeStats`가 `sprite` 값을 올바르게 설정하는지
2. `setSelectedDigimon`이 진화 후 올바르게 호출되는지
3. `setDigimonStatsAndSave`가 올바른 스프라이트 값으로 저장하는지

**디버깅 코드 추가:**
```javascript
async function evolve(newName) {
  // ... 기존 코드 ...
  
  const nx = initializeStats(newName, resetStats, digimonDataVer1);
  
  // 디버깅: 스프라이트 값 확인
  console.log("[evolve] 진화 정보:", {
    oldName: selectedDigimon,
    newName: newName,
    oldSprite: digimonStats.sprite,
    newSprite: nx.sprite,
    expectedSprite: digimonDataVer1[newName]?.sprite,
  });
  
  // ... 나머지 코드 ...
}
```

### 해결책 2: 스프라이트 값 강제 동기화

**수정 위치:** `useEvolution.js` - `evolve` 함수

**추가 코드:**
```javascript
async function evolve(newName) {
  // ... 기존 코드 ...
  
  const nx = initializeStats(newName, resetStats, digimonDataVer1);
  
  // 스프라이트 값 강제 동기화 (데이터 소스에서 직접 가져오기)
  const newDigimonData = digimonDataVer1[newName];
  if (newDigimonData && newDigimonData.sprite !== undefined) {
    nx.sprite = newDigimonData.sprite;
    console.log("[evolve] 스프라이트 강제 동기화:", {
      from: nx.sprite,
      to: newDigimonData.sprite,
    });
  }
  
  // ... 나머지 코드 ...
}
```

### 해결책 3: 데이터 로드 시 동기화

**수정 위치:** `useGameData.js` - `loadSlot` 함수

**추가 코드:**
```javascript
// 슬롯 로드 후 데이터 일관성 확인
if (savedName && digimonDataVer1[savedName]) {
  const expectedSprite = digimonDataVer1[savedName].sprite;
  if (savedStats.sprite !== expectedSprite) {
    console.warn("[loadSlot] 스프라이트 불일치 감지:", {
      selectedDigimon: savedName,
      savedSprite: savedStats.sprite,
      expectedSprite: expectedSprite,
    });
    // 스프라이트 값 수정
    savedStats.sprite = expectedSprite;
  }
}
```

### 해결책 4: 수면 프레임 계산 개선

**현재 문제:**
- `digimonStats.sprite`가 잘못된 값일 때 수면 프레임도 잘못 계산됨

**개선 방안:**
```javascript
// Game.jsx 971-972줄
else if((sleepStatus === "SLEEPING" || sleepStatus === "TIRED") && selectedDigimon !== "Digitama"){
  // selectedDigimon에서 직접 스프라이트 가져오기 (digimonStats.sprite 대신)
  const digimonData = digimonDataVer1[selectedDigimon];
  const baseSprite = digimonData?.sprite || digimonStats.sprite;
  idleFrames = [`${baseSprite + 11}`, `${baseSprite + 12}`];
  eatFramesArr = idleFrames;
  rejectFramesArr = idleFrames;
  // ...
}
```

## 🔧 즉시 수정 가능한 해결책

### 우선순위 1: 수면 프레임 계산 개선

**수정 파일:** `digimon-tamagotchi-frontend/src/pages/Game.jsx`

**변경 내용:**
```javascript
// 971줄 근처
else if((sleepStatus === "SLEEPING" || sleepStatus === "TIRED") && selectedDigimon !== "Digitama"){
  // digimonStats.sprite 대신 selectedDigimon에서 직접 스프라이트 가져오기
  const digimonData = digimonDataVer1[selectedDigimon];
  const baseSprite = digimonData?.sprite ?? digimonStats.sprite;
  
  idleFrames = [`${baseSprite + 11}`, `${baseSprite + 12}`];
  eatFramesArr = idleFrames;
  rejectFramesArr = idleFrames;
  
  if(currentAnimation !== "sleep"){
    setCurrentAnimation("sleep");
  }
}
```

**이유:**
- `digimonStats.sprite`가 잘못된 값이어도 `selectedDigimon`에서 올바른 스프라이트를 가져올 수 있음
- 다른 애니메이션 프레임 계산에도 동일한 패턴 적용 가능

### 우선순위 2: 진화 시 스프라이트 동기화 강화

**수정 파일:** `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`

**변경 내용:**
```javascript
// 209줄 근처
const nx = initializeStats(newName, resetStats, digimonDataVer1);

// 스프라이트 값 강제 동기화
const newDigimonData = digimonDataVer1[newName];
if (newDigimonData?.sprite !== undefined) {
  nx.sprite = newDigimonData.sprite;
}
```

## 📊 테스트 계획

1. **데이터 일관성 확인:**
   - Firestore에서 `selectedDigimon`과 `digimonStats.sprite` 값 확인
   - 티라노몬인 경우 `sprite`가 290인지 확인

2. **수면 프레임 확인:**
   - 티라노몬이 수면 중일 때 올바른 프레임 (301, 302)이 표시되는지 확인
   - `/images/301.png`와 `/images/302.png` 파일이 티라노몬 수면 프레임인지 확인

3. **진화 후 데이터 확인:**
   - 진화 후 `selectedDigimon`과 `digimonStats.sprite`가 올바르게 업데이트되는지 확인

## ✅ 체크리스트

- [ ] `Game.jsx`에서 수면 프레임 계산 시 `selectedDigimon`에서 스프라이트 가져오기
- [ ] `useEvolution.js`에서 진화 시 스프라이트 강제 동기화
- [ ] `useGameData.js`에서 로드 시 데이터 일관성 확인
- [ ] Firestore 데이터 수동 수정 (기존 불일치 데이터 정리)
- [ ] 테스트: 티라노몬 수면 중 올바른 스프라이트 표시 확인
- [ ] `REFACTORING_LOG.md` 업데이트

## 📝 참고

- **티라노몬 스프라이트:** 290
- **데블몬 스프라이트:** 300
- **수면 프레임 오프셋:** +11, +12
- **티라노몬 수면 프레임:** 301, 302
- **데블몬 기본 스프라이트:** 300 (수면 프레임: 311, 312)

**주의:** 티라노몬의 수면 프레임 301이 데블몬의 기본 스프라이트 300과 매우 가까워서 혼동될 수 있습니다. 실제 스프라이트 파일을 확인해야 합니다.

---

**다음 단계:** 우선순위 1 (수면 프레임 계산 개선)부터 수정 진행
