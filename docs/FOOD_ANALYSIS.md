# 고기(Meat)와 단백질(Protein) 시스템 분석

**작성일:** 2024-12-19

## 개요

이 문서는 디지몬 타마고치 게임의 고기와 단백질 먹이기 시스템에 대한 상세 분석입니다.

---

## 1. 고기(Meat) 시스템

### 1.1 기본 효과

**매뉴얼 규칙:**
> "Giving this to a Digimon will add one heart to the hunger meter, and add one gigabyte to their weight."

**스탯 변경:**
- `fullness` (배고픔): +1 (최대 `5 + maxOverfeed`)
- `weight` (체중): +1 Gigabyte

**구현 위치:** `src/logic/food/meat.js`

```javascript
// src/logic/food/meat.js
export function feedMeat(stats) {
  const s = { ...stats };
  const maxFullness = 5 + (s.maxOverfeed || 0);
  const oldFullness = s.fullness || 0;
  
  // 배고픔 하트 +1 (최대 5 + 오버피드 허용치)
  if (s.fullness < maxFullness) {
    s.fullness = (s.fullness || 0) + 1;
  }
  
  // 체중 +1 Gigabyte
  s.weight = (s.weight || 0) + 1;
  
  // 오버피드 체크...
}
```

### 1.2 거부 조건

**거부 조건:**
- `fullness >= (5 + maxOverfeed)` 일 때 거부

**구현:**
```javascript
// src/logic/food/meat.js
export function willRefuseMeat(stats) {
  const maxFullness = 5 + (stats.maxOverfeed || 0);
  return (stats.fullness || 0) >= maxFullness;
}
```

### 1.3 오버피드(Overfeed) 시스템

**매뉴얼 규칙:**
> "You can overfeed by feeding 10 more meat after having full hearts."
> "Overfeeding will give you one extra Hunger Loss cycle before one of your hearts drop."

**오버피드 발생 조건:**
1. 배고픔이 가득 찬 상태(`fullness >= 5`)에서 시작
2. 연속으로 고기를 10개 더 먹으면 오버피드 발생
3. `consecutiveMeatFed` 카운터로 추적

**오버피드 효과:**
- `overfeeds` 카운터 +1
- `hungerCountdown`에 한 주기 시간(`hungerTimer * 60초`) 추가
  - 배고픔 감소를 1회 지연시킴

**구현:**
```javascript
// src/logic/food/meat.js
let isOverfeed = false;
if (oldFullness >= 5) {
  s.consecutiveMeatFed = (s.consecutiveMeatFed || 0) + 1;
  if (s.consecutiveMeatFed >= 10) {
    s.overfeeds = (s.overfeeds || 0) + 1;
    s.consecutiveMeatFed = 0; // 리셋
    isOverfeed = true;
    
    // 오버피드 효과: hungerCountdown에 한 주기 시간 추가
    const hungerCycleSeconds = (s.hungerTimer || 0) * 60;
    s.hungerCountdown = (s.hungerCountdown || 0) + hungerCycleSeconds;
  }
} else {
  s.consecutiveMeatFed = 0; // 배고픔이 가득 차지 않았으면 리셋
}
```

**중요 사항:**
- 배고픔이 5 미만이면 `consecutiveMeatFed`가 리셋됨
- 오버피드는 배고픔이 가득 찬 상태에서만 카운트됨

---

## 2. 단백질(Protein) 시스템

### 2.1 기본 효과

**매뉴얼 규칙:**
> "Giving this to a Digimon will add one heart to the strength meter and two gigabytes to their weight."
> "Every four Protein will increase your Energy and Protein Overdose by 1 each."

**스탯 변경:**
- `strength` (힘): +1 (최대 5)
- `weight` (체중): +2 Gigabyte
- `proteinCount`: +1 (누적 카운터)

**구현 위치:** `src/logic/food/protein.js`

```javascript
// src/logic/food/protein.js
export function feedProtein(stats) {
  const s = { ...stats };
  const oldStrength = s.strength || 0;
  
  // 힘 하트 +1 (최대 5)
  if (s.strength < 5) {
    s.strength = s.strength + 1;
  }
  
  // 체중 +2 Gigabyte
  s.weight = (s.weight || 0) + 2;
  
  // 프로틴 카운트 증가
  const proteinCount = (s.proteinCount || 0) + 1;
  s.proteinCount = proteinCount;
  
  // 4개마다 Energy +1, Protein Overdose +1
  if (proteinCount % 4 === 0) {
    const maxEnergy = s.maxEnergy || s.maxStamina || 100;
    s.energy = Math.min(maxEnergy, (s.energy || 0) + 1);
    s.proteinOverdose = Math.min(7, (s.proteinOverdose || 0) + 1); // 최대 7
  }
}
```

### 2.2 거부 조건

**거부 조건:**
- `strength >= 5` 일 때 거부

**구현:**
```javascript
// src/logic/food/protein.js
export function willRefuseProtein(stats) {
  return stats.strength >= 5;
}
```

### 2.3 단백질 과다 복용(Protein Overdose) 시스템

**매뉴얼 규칙:**
> "Every four Protein will increase your Energy and Protein Overdose by 1 each."

**단백질 과다 복용 발생 조건:**
- 단백질을 4개 먹을 때마다 `proteinOverdose` +1
- 최대 7까지 증가

**단백질 과다 복용 효과:**
- 배틀 패배 시 부상 확률 증가
  - 기본 부상 확률: 10%
  - 단백질 과다 복용당 +10% (최대 80%)
  - 공식: `부상 확률 = 10 + (proteinOverdose * 10)%`

**구현:**
```javascript
// src/logic/food/protein.js
// 4개마다 Energy +1, Protein Overdose +1
if (proteinCount % 4 === 0) {
  const maxEnergy = s.maxEnergy || s.maxStamina || 100;
  s.energy = Math.min(maxEnergy, (s.energy || 0) + 1);
  s.proteinOverdose = Math.min(7, (s.proteinOverdose || 0) + 1); // 최대 7
}
```

**배틀 부상 확률 계산:**
```javascript
// 배틀 패배 시 부상 확률
const baseInjuryChance = 10; // 기본 10%
const proteinOverdoseBonus = (stats.proteinOverdose || 0) * 10;
const injuryChance = Math.min(80, baseInjuryChance + proteinOverdoseBonus);
```

---

## 3. 호출(Call) 시스템 연동

### 3.1 고기 먹이기 후 호출 해제

**조건:**
- `fullness > 0` 이 되면 `hunger` 호출 리셋

**구현:**
```javascript
// src/hooks/useGameActions.js
// 호출 해제: fullness > 0이 되면 hunger 호출 리셋
if (updatedStats.fullness > 0) {
  updatedStats = resetCallStatus(updatedStats, 'hunger');
}
```

### 3.2 단백질 먹이기 후 호출 해제

**조건:**
- `strength > 0` 이 되면 `strength` 호출 리셋

**구현:**
```javascript
// src/hooks/useGameActions.js
// 단백질을 먹었고 strength > 0이 되면 strength 호출 리셋
if (type === "protein" && updatedStats.strength > 0) {
  updatedStats = resetCallStatus(updatedStats, 'strength');
}
```

---

## 4. Activity Log 시스템

### 4.1 고기 먹이기 로그

**로그 형식:**
- 일반: `Feed: Meat (Wt +${weightDelta}g, Hun +${fullnessDelta}) => (Wt ${oldWeight}→${newWeight}g, Hun ${oldFullness}→${newFullness})`
- 오버피드 발생: `Overfeed! Hunger drop delayed (Wt +${weightDelta}g, HungerCycle +${hungerCycleMinutes}min)`
- 오버피드 누적: `Overfeed: Stuffed! (Wt +${weightDelta}g, Hun +${fullnessDelta}, Overfeed +${overfeedsDelta}) => ...`

**구현 위치:** `src/hooks/useGameAnimations.js`, `src/hooks/useGameActions.js`

### 4.2 단백질 먹이기 로그

**로그 형식:**
- 일반: `Feed: Protein (Wt +${weightDelta}g, Str +${strengthDelta}) => (Wt ${oldWeight}→${newWeight}g, Str ${oldStrength}→${newStrength})`
- 4회 보너스: `Feed: Protein (Wt +${weightDelta}g, Str +${strengthDelta}, En +${energyDelta}) - Protein Bonus! (En +1, Overdose +1) => ...`

---

## 5. 애니메이션 시스템

### 5.1 고기 애니메이션

- 프레임 수: 4개
- 스프라이트: `/images/526.png`, `/images/527.png`, `/images/528.png`, `/images/529.png`
- 프레임 간격: 500ms

### 5.2 단백질 애니메이션

- 프레임 수: 3개
- 스프라이트: `/images/530.png`, `/images/531.png`, `/images/532.png`
- 프레임 간격: 500ms

---

## 6. 데이터 흐름

### 6.1 고기 먹이기 흐름

```
handleFeed("meat")
  ↓
willRefuseMeat() 체크
  ↓ (거부되지 않으면)
eatCycle(0, "meat") 시작
  ↓
애니메이션 (4 프레임, 500ms 간격)
  ↓
feedMeat() 실행
  ↓
스탯 업데이트 (fullness +1, weight +1)
  ↓
오버피드 체크 (consecutiveMeatFed >= 10)
  ↓
Activity Log 추가
  ↓
Firestore/localStorage 저장
```

### 6.2 단백질 먹이기 흐름

```
handleFeed("protein")
  ↓
willRefuseProtein() 체크
  ↓ (거부되지 않으면)
eatCycle(0, "protein") 시작
  ↓
애니메이션 (3 프레임, 500ms 간격)
  ↓
feedProtein() 실행
  ↓
스탯 업데이트 (strength +1, weight +2, proteinCount +1)
  ↓
4개마다 보너스 체크 (energy +1, proteinOverdose +1)
  ↓
Activity Log 추가
  ↓
Firestore/localStorage 저장
```

---

## 7. 관련 상태 변수

### 7.1 고기 관련

- `fullness`: 배고픔 하트 (0~5+maxOverfeed)
- `maxOverfeed`: 오버피드 허용치 (종족별 고정값)
- `consecutiveMeatFed`: 연속으로 먹은 고기 개수 (오버피드 체크용)
- `overfeeds`: 오버피드 누적 횟수
- `hungerCountdown`: 배고픔 감소까지 남은 시간 (초)
- `hungerTimer`: 배고픔 감소 주기 (분)

### 7.2 단백질 관련

- `strength`: 힘 하트 (0~5)
- `proteinCount`: 먹인 단백질 누적 개수
- `proteinOverdose`: 단백질 과다 복용 수치 (0~7)
- `energy`: 현재 에너지 (DP)
- `maxEnergy`: 최대 에너지 (종족별 고정값)
- `strengthCountdown`: 힘 감소까지 남은 시간 (초)
- `strengthTimer`: 힘 감소 주기 (분)

---

## 8. 잠재적 문제점 및 개선 사항

### 8.1 발견된 문제점

1. **중복 로직:**
   - `src/logic/food/meat.js`와 `src/logic/stats/hunger.js`에 `feedMeat` 함수가 중복 존재
   - 일관성을 위해 하나로 통합 필요

2. **오버피드 카운터 리셋:**
   - `consecutiveMeatFed`가 `fullness < 5`일 때 리셋되는데, 이는 의도된 동작인지 확인 필요
   - 매뉴얼에 명시되지 않은 동작일 수 있음

3. **단백질 과다 복용 최대값:**
   - `proteinOverdose` 최대값이 7로 하드코딩되어 있음
   - 매뉴얼에 명시된 최대값인지 확인 필요

### 8.2 개선 제안

1. **로직 통합:**
   - `src/logic/food/meat.js`를 메인으로 사용하고, `src/logic/stats/hunger.js`의 `feedMeat`는 제거 또는 deprecated 처리

2. **오버피드 로직 명확화:**
   - 매뉴얼 재확인 후 `consecutiveMeatFed` 리셋 조건 명확화

3. **단백질 과다 복용 문서화:**
   - `proteinOverdose` 최대값 7의 근거 문서화

---

## 9. 관련 파일 목록

### 9.1 핵심 로직 파일

- `src/logic/food/meat.js`: 고기 먹이기 로직
- `src/logic/food/protein.js`: 단백질 먹이기 로직
- `src/hooks/useGameActions.js`: 먹이기 액션 핸들러
- `src/hooks/useGameAnimations.js`: 먹이기 애니메이션 사이클

### 9.2 유틸리티 파일

- `src/logic/food/index.js`: Food 로직 export
- `src/data/defaultStatsFile.js`: 기본 스탯 정의 (proteinCount, proteinOverdose, consecutiveMeatFed, overfeeds)

### 9.3 UI 컴포넌트

- `src/components/FeedPopup.jsx`: 먹이 선택 팝업
- `src/components/GameScreen.jsx`: 먹이 애니메이션 표시
- `src/components/Canvas.jsx`: 먹이 스프라이트 렌더링

---

## 10. 참고 자료

- Digital Monster Color 매뉴얼
- `docs/REFACTORING_LOG.md`: 리팩토링 이력
- `docs/DIGITAL_MONSTER_COLOR_MANUAL.md`: 매뉴얼 번역본

