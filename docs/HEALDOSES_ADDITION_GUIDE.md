# Heal Doses 필드 추가 가이드

## 📋 현재 상황

- **문제**: `healDoses` 필드가 디지몬 데이터에 정의되어 있지 않음
- **현재 동작**: 모든 디지몬이 기본값 1을 사용 (`stats?.healDoses || 1`)
- **영향**: 디지몬별로 다른 치료 횟수를 설정할 수 없음

## 🔧 추가 방법

### 방법 1: 스키마 주석 업데이트 + 각 디지몬에 필드 추가 (권장)

#### 1단계: 스키마 주석 업데이트

`digimon-tamagotchi-frontend/src/data/v1/digimons.js` 파일의 주석에 `healDoses` 필드 추가:

```javascript
/**
 * 디지몬 데이터 스키마
 * 
 * @typedef {Object} DigimonData
 * @property {string} id - 디지몬 고유 ID
 * @property {string} name - 디지몬 이름
 * @property {string} stage - 진화 단계
 * @property {number} sprite - 스프라이트 번호
 * @property {Object} stats - 스탯 정보
 * @property {number} stats.hungerCycle - 배고픔 감소 주기 (분)
 * @property {number} stats.strengthCycle - 힘 감소 주기 (분)
 * @property {number} stats.poopCycle - 똥 생성 주기 (분)
 * @property {number} stats.maxOverfeed - 최대 오버피드 허용치
 * @property {number} stats.basePower - 기본 파워
 * @property {number} stats.maxEnergy - 최대 에너지 (DP)
 * @property {number} stats.minWeight - 최소 체중
 * @property {number} stats.healDoses - 치료 필요 횟수 (기본값 1) // 🔥 추가
 * @property {string} stats.type - 속성 ("Vaccine", "Data", "Virus", "Free" 또는 null)
 * @property {string} stats.sleepTime - 수면 시간 (HH:MM 형식)
 * @property {number} stats.attackSprite - 공격 스프라이트 번호
 * @property {Object} evolutionCriteria - 진화 조건
 * @property {Array} evolutions - 진화 경로 배열
 */
```

#### 2단계: 각 디지몬 데이터에 필드 추가

각 디지몬의 `stats` 객체에 `healDoses` 필드를 추가합니다.

**예시 1: Agumon (기본값 1)**
```javascript
Agumon: {
  id: "Agumon",
  name: "Agumon",
  stage: "Child",
  sprite: 240,
  stats: {
    hungerCycle: 48,
    strengthCycle: 48,
    poopCycle: 120,
    maxOverfeed: 4,
    basePower: 30,
    maxEnergy: 20,
    minWeight: 20,
    type: "Vaccine",
    sleepTime: "20:00",
    attackSprite: 4,
    healDoses: 1, // 🔥 추가 (기본값)
  },
  // ...
}
```

**예시 2: Greymon (2회 필요)**
```javascript
Greymon: {
  id: "Greymon",
  name: "Greymon",
  stage: "Adult",
  sprite: 270,
  stats: {
    hungerCycle: 59,
    strengthCycle: 59,
    poopCycle: 120,
    maxOverfeed: 2,
    basePower: 50,
    maxEnergy: 30,
    minWeight: 30,
    type: "Vaccine",
    sleepTime: "21:00",
    attackSprite: null,
    healDoses: 2, // 🔥 추가 (2회 필요)
  },
  // ...
}
```

**예시 3: Botamon (Baby I, 기본값 1)**
```javascript
Botamon: {
  id: "Botamon",
  name: "Botamon",
  stage: "Baby I",
  sprite: 210,
  stats: {
    hungerCycle: 3,
    strengthCycle: 3,
    poopCycle: 3,
    maxOverfeed: 3,
    basePower: 0,
    maxEnergy: 0,
    minWeight: 5,
    type: "Free",
    sleepTime: null,
    attackSprite: 1,
    healDoses: 1, // 🔥 추가 (기본값)
  },
  // ...
}
```

### 방법 2: 일괄 추가 스크립트 (선택사항)

모든 디지몬에 기본값 1을 일괄 추가하려면 다음 스크립트를 사용할 수 있습니다:

```javascript
// 일괄 추가 스크립트 (참고용)
// 실제로는 수동으로 추가하는 것을 권장합니다.

const digimonDataVer1 = { /* ... */ };

// 모든 디지몬에 healDoses 추가 (없는 경우만)
Object.keys(digimonDataVer1).forEach(key => {
  const digimon = digimonDataVer1[key];
  if (digimon.stats && !digimon.stats.healDoses) {
    digimon.stats.healDoses = 1; // 기본값 1
  }
});
```

## 📝 권장 설정 값

매뉴얼이나 게임 밸런스를 고려하여 다음처럼 설정할 수 있습니다:

- **Baby I, Baby II**: `healDoses: 1` (기본값)
- **Child (Rookie)**: `healDoses: 1` 또는 `2` (디지몬별로 다를 수 있음)
- **Adult (Champion)**: `healDoses: 2` (더 강한 디지몬은 치료가 더 필요)
- **Perfect, Ultimate**: `healDoses: 2` 또는 `3` (고급 단계는 더 많은 치료 필요)

## ✅ 검증 방법

추가 후 다음을 확인하세요:

1. **StatsPopup**: "1. 종(Species) 고정 파라미터" 섹션에서 "Heal Doses" 값 확인
2. **치료 기능**: 부상 상태에서 치료 시 필요한 횟수가 올바르게 표시되는지 확인
3. **HealModal**: 현재 투여 횟수와 필요 횟수가 올바르게 표시되는지 확인

## 🔍 관련 파일

- `digimon-tamagotchi-frontend/src/data/v1/digimons.js` - 디지몬 데이터 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameAnimations.js` - 치료 로직 (line 228)
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx` - 스탯 표시 (line 153)
- `digimon-tamagotchi-frontend/src/components/GameModals.jsx` - 치료 모달 (line 358)

## 📌 참고사항

- 기본값이 1이므로, 모든 디지몬에 명시적으로 추가하지 않아도 현재 동작은 유지됩니다.
- 하지만 명시적으로 추가하면:
  - 코드 가독성 향상
  - 디지몬별로 다른 값을 쉽게 설정 가능
  - 데이터 구조가 명확해짐

---

**작성일**: 2026-01-03


