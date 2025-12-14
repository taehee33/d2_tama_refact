# 디지몬 진화 시스템 분석 보고서

## 📊 현재 프로젝트 데이터 구조 및 진화 로직 분석

### 1. 데이터 구조 분석 (digimondata_digitalmonstercolor25th_ver1.js)

#### 현재 포함된 정보
```javascript
{
  sprite: 240,                    // 스프라이트 번호
  evolutionStage: "Child",       // 진화 단계 (Digitama, Baby1, Baby2, Child, Adult, Ohakadamon)
  timeToEvolveSeconds: 600,      // 진화까지 남은 시간 (초)
  hungerTimer: 5,                 // 배고픔 감소 주기 (분)
  strengthTimer: 5,               // 건강 감소 주기 (분)
  poopTimer: 5,                   // 똥 생성 주기 (분)
  maxOverfeed: 4,                 // 최대 오버피드
  minWeight: 10,                  // 최소 체중 (일부 디지몬만)
  maxStamina: 100,                // 최대 스태미나 (일부 디지몬만)
}
```

#### 기본 스탯 (defaultStatsFile.js)
```javascript
{
  age: 0,                         // 나이
  weight: 0,                       // 체중
  strength: 0,                     // 힘
  stamina: 0,                      // 스태미나
  effort: 0,                       // 노력치
  health: 0,                       // 건강
  fullness: 0,                     // 배부름
  winRate: 0,                      // 승률
  careMistakes: 0,                 // 실수 횟수
  lifespanSeconds: 0,              // 수명 (초)
  timeToEvolveSeconds: 0,          // 진화까지 시간 (초)
  maxStamina: 0,                   // 최대 스태미나
  minWeight: 0,                    // 최소 체중
  healing: 0,                      // 힐링 (미사용?)
  attribute: 0,                    // 속성 (미사용?)
  power: 0,                        // 파워 (미사용?)
  attackSprite: 0,                 // 공격 스프라이트 (미사용?)
  altAttackSprite: 65535,          // 대체 공격 스프라이트 (미사용?)
}
```

#### 평가
- ✅ **기본 스탯 존재**: age, weight, strength, stamina, effort, health, fullness, winRate, careMistakes
- ✅ **타이머 시스템**: hungerTimer, strengthTimer, poopTimer
- ⚠️ **제한적인 데이터**: 각 디지몬별로 sprite, evolutionStage, timeToEvolveSeconds, 타이머 값만 정의
- ❌ **부족한 필드**: HP, 속성(attribute), 파워(power), 진화 조건 관련 상세 정보 없음

---

### 2. 진화 트리 구조 분석 (evolution_digitalmonstercolor25th_ver1.js)

#### 현재 구조
```javascript
{
  Koromon: {
    evolution: [
      {
        next: "Agumon",
        condition: {
          check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes < 4,
        },
      },
      {
        next: "Betamon",
        condition: {
          check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes >= 4,
        },
      },
    ],
  },
}
```

#### 평가
- ✅ **진화 분기 지원**: 배열로 여러 진화 경로 정의 가능
- ✅ **조건부 체크 함수**: `condition.check(stats)` 함수로 조건 검사
- ⚠️ **단순한 조건**: 현재는 `timeToEvolveSeconds`와 `careMistakes`만 체크
- ❌ **Graph 구조 없음**: 진화 트리가 명시적으로 연결되지 않음 (단순 배열 구조)
- ❌ **역방향 탐색 불가**: 특정 디지몬에서 어떤 디지몬으로 진화 가능한지만 정의, 역방향(어떤 디지몬에서 진화했는지) 정보 없음

---

### 3. 진화 로직 분석 (Game.jsx)

#### 현재 진화 조건
```javascript
// 예시: Koromon → Agumon 또는 Betamon
{
  next: "Agumon",
  condition: {
    check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes < 4,
  },
}
```

#### 진화 처리 흐름
1. 사용자가 "Evolution" 버튼 클릭
2. `handleEvolutionButton()` 호출
3. `evolutionConditionsVer1[selectedDigimon]`에서 진화 조건 배열 가져오기
4. 배열을 순회하며 `e.condition.check(stats)` 호출
5. 첫 번째로 `true`를 반환하는 조건의 `next` 디지몬으로 진화

#### 평가
- ✅ **분기 로직 구현**: 여러 진화 경로 중 조건에 맞는 첫 번째 경로 선택
- ✅ **조건 체크 함수**: 유연한 조건 검사 가능
- ⚠️ **단순한 조건**: 현재는 시간과 careMistakes만 체크
- ❌ **복잡한 조건 부재**: weight, strength, effort, winRate, attribute 등 고려 안 됨
- ❌ **자동 진화 없음**: 사용자가 버튼을 눌러야만 진화 (Humulos는 조건 만족 시 자동 진화)

---

### 4. 훈련 시스템 분석 (train_digitalmonstercolor25th_ver1.js)

#### 현재 훈련 로직
- 5라운드 훈련 진행
- hits(성공 횟수)에 따라 결과 결정:
  - 0~2 hits: "꽝" (체중 -2)
  - 3~4 hits: "좋음!" (체중 -2, strength+1)
  - 5 hits: "대성공!!!" (체중 -4, strength+3)
- 4회 훈련마다 effort+1

#### 평가
- ✅ **훈련 시스템 존재**: strength, effort 증가 가능
- ⚠️ **제한적인 영향**: 진화 조건에 strength, effort가 반영되지 않음

---

## 🎯 Humulos 스타일 복잡한 육성 시스템 구현을 위해 부족한 부분

### 1. 데이터 필드 부족

#### 디지몬 데이터에 추가 필요:
```javascript
{
  // 기본 정보
  name: "Agumon",
  attribute: "Vaccine",           // 속성 (Vaccine, Data, Virus, Free)
  type: "Reptile",                // 타입
  stage: "Child",                  // 진화 단계
  
  // 스탯 범위
  minHP: 20,                       // 최소 HP
  maxHP: 30,                       // 최대 HP
  minWeight: 10,                   // 최소 체중
  maxWeight: 20,                   // 최대 체중
  minStrength: 5,                  // 최소 힘
  maxStrength: 15,                 // 최대 힘
  
  // 진화 조건 (디지몬별로 다를 수 있음)
  evolutionRequirements: {
    minWeight: 15,                 // 최소 체중 필요
    minStrength: 10,                // 최소 힘 필요
    minEffort: 5,                  // 최소 노력치 필요
    maxCareMistakes: 3,            // 최대 실수 횟수
    minWinRate: 50,                // 최소 승률 (%)
    attribute: "Vaccine",          // 특정 속성 필요
  },
}
```

#### 스탯에 추가 필요:
```javascript
{
  hp: 0,                           // 현재 HP
  maxHP: 0,                        // 최대 HP
  attribute: "Vaccine",            // 속성
  type: "Reptile",                 // 타입
  battlesWon: 0,                   // 승리 횟수
  battlesLost: 0,                  // 패배 횟수
  // winRate는 계산 가능: battlesWon / (battlesWon + battlesLost) * 100
}
```

### 2. 진화 조건 로직 부족

#### 현재 체크 항목:
- ✅ `timeToEvolveSeconds <= 0` (시간 경과)
- ✅ `careMistakes < 4` 또는 `>= 4` (실수 횟수)

#### 추가 필요:
- ❌ **체중 조건**: `stats.weight >= minWeight && stats.weight <= maxWeight`
- ❌ **힘 조건**: `stats.strength >= minStrength`
- ❌ **노력치 조건**: `stats.effort >= minEffort`
- ❌ **승률 조건**: `stats.winRate >= minWinRate`
- ❌ **HP 조건**: `stats.hp >= minHP`
- ❌ **속성 조건**: `stats.attribute === requiredAttribute`
- ❌ **복합 조건**: 여러 조건을 AND/OR로 조합

### 3. 진화 트리 구조 개선 필요

#### 현재 문제점:
- 진화 경로가 단방향만 정의됨 (어떤 디지몬에서 진화했는지 알 수 없음)
- Graph 구조가 아니어서 진화 트리 전체를 탐색하기 어려움

#### 개선 방안:
```javascript
// 진화 트리 Graph 구조
const evolutionTree = {
  Agumon: {
    from: ["Koromon"],              // 진화 전 디지몬
    to: [                           // 진화 후 디지몬
      {
        name: "Greymon",
        conditions: { ... },
        probability: 0.7,           // 확률 (선택적)
      },
      {
        name: "Tyrannomon",
        conditions: { ... },
        probability: 0.3,
      },
    ],
  },
};
```

### 4. 자동 진화 시스템 부재

#### 현재:
- 사용자가 "Evolution" 버튼을 눌러야만 진화

#### Humulos 스타일:
- 조건 만족 시 자동으로 진화 (또는 진화 가능 상태로 변경)
- 진화 가능 시 알림 표시

### 5. 복잡한 진화 분기 로직 부족

#### 현재:
- 단순히 배열의 첫 번째로 조건을 만족하는 진화 경로 선택

#### 필요:
- **확률 기반 진화**: 여러 조건을 만족하는 경우 확률에 따라 선택
- **가중치 기반 진화**: 각 조건의 가중치를 계산하여 가장 높은 점수의 진화 경로 선택
- **조건 우선순위**: 조건의 우선순위에 따라 진화 경로 결정

### 6. 배틀 시스템 부재

#### 현재:
- `winRate` 필드는 있지만 실제 배틀 시스템 없음
- 훈련만 존재 (배틀 아님)

#### 필요:
- 배틀 시스템 구현
- 승리/패배 기록
- winRate 계산 및 진화 조건에 반영

---

## 📋 요약: Humulos 스타일 구현을 위해 필요한 작업

### 즉시 필요한 데이터 필드
1. ✅ **HP 시스템**: `hp`, `maxHP` 추가
2. ✅ **속성 시스템**: `attribute` (Vaccine, Data, Virus, Free)
3. ✅ **타입 시스템**: `type` (Reptile, Mammal, 등)
4. ✅ **배틀 기록**: `battlesWon`, `battlesLost` 추가
5. ✅ **디지몬별 진화 조건**: 각 디지몬 데이터에 `evolutionRequirements` 추가

### 즉시 필요한 로직
1. ✅ **복합 진화 조건**: weight, strength, effort, winRate, HP, attribute 등을 모두 체크
2. ✅ **자동 진화**: 조건 만족 시 자동 진화 또는 진화 가능 알림
3. ✅ **확률/가중치 기반 진화**: 여러 경로 중 확률 또는 가중치로 선택
4. ✅ **배틀 시스템**: winRate 계산을 위한 실제 배틀 구현

### 개선이 필요한 구조
1. ✅ **진화 트리 Graph 구조**: 양방향 연결 및 탐색 가능한 구조
2. ✅ **조건 체크 시스템**: AND/OR 연산자 지원, 복잡한 조건 조합
3. ✅ **진화 조건 우선순위**: 조건의 우선순위에 따른 진화 경로 결정

---

## 🎮 현재 시스템의 장점

1. ✅ **기본 구조는 잘 갖춰짐**: 진화 분기 로직의 기본 틀은 존재
2. ✅ **유연한 조건 체크**: 함수형 조건 체크로 확장 가능
3. ✅ **훈련 시스템**: strength, effort 증가 메커니즘 존재
4. ✅ **실수 시스템**: careMistakes를 통한 진화 분기 구현

---

## 🚀 다음 단계 권장사항

1. **1단계**: HP, attribute, type 필드 추가 및 기본 데이터 확장
2. **2단계**: 복합 진화 조건 로직 구현 (weight, strength, effort, winRate 등)
3. **3단계**: 배틀 시스템 구현 및 winRate 계산
4. **4단계**: 자동 진화 시스템 구현
5. **5단계**: 진화 트리 Graph 구조로 전환

