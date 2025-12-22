# Digimon Game Mechanics & Logic

이 문서는 D2 Tamagotchi 프로젝트의 게임 메커니즘과 로직을 상세히 설명합니다.

---

## 1. Lazy Update (지연 업데이트) 알고리즘

서버 부하를 줄이기 위해, 실시간 타이머 대신 '마지막 저장 시점과의 차이'를 계산하여 접속 시 한 번에 상태를 반영합니다.

$$\Delta t = \text{CurrentTime} - \text{LastSavedAt}$$

### 적용 스탯

- **배고픔(Fullness)**: $\Delta t$가 `hungerTimer`(분)를 넘을 때마다 -1
- **힘(Strength)**: $\Delta t$가 `strengthTimer`(분)를 넘을 때마다 -1
- **배변(Poop)**: 각 디지몬 변수마다 +1 (8개가 되면 부상 발생)
- **수명(Lifespan)**: $\Delta t$만큼 증가
- **진화 시간(Time to Evolve)**: $\Delta t$만큼 감소

### 사망 조건 체크

- **굶주림**: `fullness === 0`이고 `lastHungerZeroAt`로부터 12시간(43200초) 경과
- **부상 과다**: `strength === 0`이고 `lastStrengthZeroAt`로부터 12시간(43200초) 경과
- **수명 다함**: `lifespanSeconds`가 최대 수명에 도달

---

## 2. 배틀 승률 계산 (Hit Rate Logic)

오리지널의 랜덤성을 유지하되, 스탯에 따른 가중치를 부여합니다.

$$\text{HitRate}(\%) = \left( \frac{\text{MyPower}}{\text{MyPower} + \text{EnemyPower}} \right) \times 100 + \text{AttributeBonus}$$

### 파워 계산

- **MyPower** = BasePower (종족값) + Strength 보너스 + TraitedEgg 보너스

### 속성 상성 (AttributeBonus)

- **Vaccine > Virus**: +5%
- **Virus > Data**: +5%
- **Data > Vaccine**: +5%
- **Free**: 상성 없음 (0%)

---

## 3. 진화 카운터 리셋 규칙

진화(Evolution)가 발생하는 순간, 다음 스탯들은 0으로 초기화됩니다.

- `careMistakes` (케어 미스)
- `trainings` (훈련 횟수)
- `overfeeds` (과식 횟수)
- `sleepDisturbances` (수면 방해)
- `injuries` (부상 횟수)
- `proteinOverdose` (프로틴 과다)
- `battlesForEvolution` (진화를 위한 배틀 횟수)

**주의**: 승률(`winRate`)과 총 배틀 수(`battles`, `battlesWon`, `battlesLost`)는 유지됩니다.

---

## 4. 액션별 수치 변화 (Ver.1 스펙)

### Food (Meat)
- **Weight**: +1g
- **Fullness**: +1 (최대 5 + 오버피드 허용치)
- **오버피드**: 배고픔이 가득 찬 상태(5)에서 10개 더 먹으면 `overfeeds` +1

### Protein
- **Weight**: +2g
- **Strength**: +1 (최대 5)
- **Energy(DP)**: 4개당 +1 회복
- **Protein Overdose**: 4개당 +1 (최대 7)

### Train
- **Weight**: -2g (결과와 상관없이)
- **Energy(DP)**: -1 (결과와 상관없이)
- **Strength**: +1 (5번 중 3번 이상 성공 시만)
- **trainings**: +1 (성공/실패 무관하게)
- **Effort**: 4회마다 +1 (최대 5)

**훈련 성공 판정**:
- 5번 중 3번 이상 성공 → 훈련 성공 (Strength +1)
- 3번 미만 성공 → 훈련 실패 (Strength 안 오름)

### Battle
- **Weight**: -4g (승패 무관)
- **Energy(DP)**: -1 (승패 무관)
- **battles**: +1
- **battlesWon** 또는 **battlesLost**: +1

---

## 5. 수면 방해 (Sleep Disturbance)

수면 중(`isSleeping`)에 밥, 훈련, 배틀 시도 시:

- `sleepDisturbances` +1
- `wakeUntil`을 현재시간 + 10분으로 설정하여 잠시 깨움

**수면 상태**:
- `'AWAKE'`: 수면 시간이 아님 OR (`wakeUntil`이 현재 시간보다 미래임)
- `'TIRED'`: 수면 시간임 AND `isLightsOn`이 true임 (불이 켜져 괴로워하는 상태)
- `'SLEEPING'`: 수면 시간임 AND `isLightsOn`이 false임 (편안하게 자는 상태)

**케어 미스**: `'TIRED'` 상태로 30분 지속 시 `careMistakes` +1

---

## 6. 부상(Injury) 시스템

### 부상 발생 조건
- 똥 8개가 되면 `isInjured: true` 설정
- 배틀 패배 시 부상 확률 (프로틴 과다에 따라 증가)

### 부상 해제
- 똥 청소 시 `isInjured: false`로 리셋

**주의**: 기존의 똥 8개 8시간 방치 시 `careMistakes++` 로직은 제거되었습니다.

---

## 7. 마스터 데이터 구조 (Master Schema)

### 1) 종(Species) 고정 파라미터 (Static Data)

`src/data/v1/digimons.js`에 저장되는 불변 데이터입니다.

```javascript
// Example: Agumon (Ver.1 Spec)
{
  id: 'agumon',
  name: 'Agumon',
  stage: 'Child', // Growth Stage (III)
  type: 'Vaccine', // Attribute
  
  // Ver.1 Specific Specs
  stats: {
    sleepSchedule: { start: 19, end: 7 },
    maxDP: 20,
    minWeight: 20,
    stomachCapacity: 24,
    lifespan: 72,      // Hours
    basePower: 30,
    
    // Digimon Specific Cycles (Seconds)
    hungerCycle: 3600,   // 배고픔 감소 주기 (1시간)
    strengthCycle: 3600, // 힘 감소 주기 (1시간)
    poopCycle: 7200,     // 똥 생성 주기 (2시간)
    healDoses: 1         // 치료 필요 횟수
  },

  // Evolution Requirements (Data-Driven)
  evolutions: [
    { targetId: 'greymon', conditions: { careMistakes: { max: 3 }, trainings: { min: 32 } } },
    { targetId: 'tyranomon', conditions: { careMistakes: { min: 4 }, overfeeds: { min: 3 }, sleepDisturbances: { max: 4 } } }
    // ... others
  ]
}
```

### 2) 개체(Instance) 상태값 (Dynamic Data)

Firestore `slots`에 저장되는 유저의 디지몬 데이터입니다.

```javascript
{
  // 2-1. 표시 상태값 (Visible)
  age: 3,             // Days
  weight: 24,         // Gigabytes
  fullness: 4,        // Hunger Hearts (0-5+)
  strength: 3,        // Strength Hearts (0-5)
  energy: 15,         // Current DP
  winRate: 65,        // % (Derived from battles)
  
  // 2-2. 상태 플래그 (Flags)
  isSleeping: false,
  isLightsOn: true,
  isInjured: false,   // 똥 8개 or 배틀 패배 시
  isDead: false,
  
  // 시간 기록 (Timers)
  lastSavedAt: Timestamp,
  wakeUntil: null,     // Timestamp (수면 방해 시 10분 뒤 설정)
  
  // 타이머 카운트다운 (Countdown)
  fullnessCountdown: 3599, 
  strengthCountdown: 3599,
  poopCountdown: 7199,
  
  // 진화 관련 카운터 (진화 시 리셋)
  careMistakes: 0,
  trainings: 0,
  overfeeds: 0,
  sleepDisturbances: 0,
  
  // 배틀 관련 (진화 시 유지)
  battles: 0,
  battlesWon: 0,
  battlesLost: 0,
  winRate: 0,
}
```

### 3) 행동(Action) 델타 (Game Rules)

각 액션 실행 시 적용되는 수치 변화표입니다.

| Action | Weight | Fullness | Strength | Energy (DP) | 비고 |
|--------|--------|----------|----------|-------------|------|
| Feed (Meat) | +1g | +1 | - | - | 허기 해소 |
| Protein | +2g | - | +1 | +? (Rec.) | 부상 확률 증가(Overdose) |
| Train | -2g | - | +1 (Success) | -1 (Cost) | 실패 시 스탯 미상승 |
| Battle | -4g | - | - | -1 (Cost) | 승패 무관 체중 감소 |

### 4) 진화 판정용 카운터 (Evolution Counters)

진화 시 리셋(0) 되는 누적 값들입니다.

```javascript
{
  careMistakes: 0,       // 호출 무시, 수면 등 켜둠
  trainings: 0,          // 훈련 횟수 (성공/실패 포함)
  overfeeds: 0,          // '더 못 먹음' 상태 도달 횟수
  sleepDisturbances: 0,  // 자는 중 깨움
  proteinOverdose: 0,    // (Hidden) 배틀 부상 확률용
  battlesForEvolution: 0 // (성숙기->완전체 조건용)
}
```

### 5) 배틀/컨디션 내부 카운터 (Hidden Stats)

유저에게는 보이지 않지만 게임의 깊이를 더하는 변수들입니다.

```javascript
{
  // 똥 관련
  poopCount: 0,          // 화면에 쌓인 똥 개수 (Max 8 -> Injury)
  lastMaxPoopTime: null, // 똥 8개가 된 시간
  
  // 배틀 관련
  totalBattles: 0,       // 누적 배틀 (리셋 X)
  totalWins: 0,          // 누적 승리 (리셋 X)
  totalLosses: 0,        // 누적 패배 (리셋 X)
  
  // 시간 관련
  lifespanSeconds: 0,    // 수명 (초)
  timeToEvolveSeconds: 0, // 진화까지 시간 (초)
  lastSavedAt: null,     // 마지막 저장 시간 (Lazy Update 기준점)
}
```

---

## 8. 스탯 초기화 규칙

### 진화 시 리셋되는 스탯 (0으로 초기화)
- `trainings` / `trainingCount`
- `overfeeds`
- `sleepDisturbances`
- `careMistakes`
- `proteinOverdose`
- `injuries`
- `battlesForEvolution`

### 진화 시 유지되는 스탯 (이어받기)
- `age`
- `weight`
- `lifespanSeconds`
- `strength`
- `effort`
- `energy`
- `battles`
- `battlesWon`
- `battlesLost`
- `winRate`

### 진화 시 변경되는 스탯
- `sprite` → 새 디지몬의 스프라이트
- `evolutionStage` → 새 디지몬의 단계
- `basePower` → 새 디지몬의 기본 파워
- `hungerTimer` → 새 디지몬의 배고픔 주기
- `strengthTimer` → 새 디지몬의 힘 주기
- `poopTimer` → 새 디지몬의 똥 주기
- `maxOverfeed` → 새 디지몬의 최대 오버피드
- `maxEnergy` → 새 디지몬의 최대 에너지
- `minWeight` → 새 디지몬의 최소 체중
- `type` → 새 디지몬의 속성

---

## 9. UI 표시 스탯

### StatsPanel에 표시되는 스탯
- `age` (나이)
- `weight` (체중)
- `strength` (힘, 하트 0-5)
- `energy` (DP/Energy)
- `winRate` (승률 %)
- `effort` (노력치, 하트 0-5)
- `careMistakes` (케어 미스)
- `fullness` (배고픔, 하트 0-5+, 오버피드 표시)
- `sleepStatus` (수면 상태: AWAKE/TIRED/SLEEPING)

**주의**: `health`는 제거되었고, `strength`로 통일되었습니다.

---

## 10. 참고 자료

- [STATS_ANALYSIS.md](./STATS_ANALYSIS.md) - 전체 스탯 분석 문서
- [REFACTORING_LOG.md](./REFACTORING_LOG.md) - 리팩토링 로그
- [DIGITAL_MONSTER_COLOR_MANUAL.md](./DIGITAL_MONSTER_COLOR_MANUAL.md) - 오리지널 매뉴얼

---

## 5. Ver.1 오리지널 스펙 상세 (Reference)

### 1) 종(Species) 고정 파라미터
Ver.1의 각 디지몬 종은 다음과 같은 고유 스펙을 가집니다.

| Digimon | Sleep | Max DP | Min Wt | Stomach | Lifespan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Botamon** | n/a | 0 | 5g | 4 | 1h |
| **Koromon** | 19:00 | 0 | 10g | 16 | 40-48h |
| **Agumon** | 19:00 | 20 | 20g | 24 | 72-80h |
| **Betamon** | 20:00 | 20 | 20g | 24 | 72-80h |
| **Greymon** | 20:00 | 30 | 30g | 28 | 120-128h |
| **Tyranomon** | 20:00 | 30 | 20g | 28 | 72-80h |
| **Devimon** | 21:00 | 40 | 40g | 32 | 104-112h |
| **Meramon** | 21:00 | 30 | 30g | 32 | 72-80h |
| **Airdramon** | 21:00 | 30 | 30g | 24 | 104-112h |
| **Seadramon** | 22:00 | 20 | 20g | 28 | 72-80h |
| **Numemon** | 20:00 | 10 | 10g | 16 | 35-48h |
| **MetalGreymon**| 21:00 | 40 | 40g | 36 | 104-112h |
| **Mamemon** | 19:00 | 45 | 5g | 32 | 72-80h |
| **Monzaemon** | 19:00 | 50 | 40g | 32 | 104-112h |

### 2) 개체(Instance) 상태값
* **Visible:** Age(24h=1yr), Weight, Hunger, Strength, Energy(DP), Win Ratio
* **Flags:** Sleeping, Call(Alert), PoopCount(Max 8 -> Sick/Injury), Injured, Dead

### 3) 행동(Action) 델타 규칙
| Action | Weight | Effect | Cost |
| :--- | :--- | :--- | :--- |
| **Food** | +1g | Hunger +1 | - |
| **Protein** | +2g | Strength +1, Energy +1 | - |
| **Training** | -2g | Strength +1 (성공 시) | Energy -1 |
| **Battle** | -4g | - | Energy -1 |

### 4) 진화 판정용 누적 카운터 (Hidden)
* **Care Mistakes:** 호출(Hunger/Strength 0) 20분 방치, 수면 등 방치 시 +1. 진화 시 리셋.
* **Training Count:** 훈련 시도 횟수. 진화 시 리셋.
* **Overfeed Count:** 한계까지 먹인 횟수. 진화 시 리셋.
* **Sleep Disturbances:** 수면 중 깨움. 진화 시 리셋.
* **Battle Count/Win Ratio:** 완전체 이상 진화 조건.

### 5) 배틀/컨디션 내부 로직
* **Energy (DP):** 8시간 연속 수면 시 Full 회복.
* **Injury:** 배틀 패배 또는 똥 8개 방치 시 발생.
* **Sick:** 똥 누적 방치 시 발생 가능.

---

**작성일**: 2025-12-23  
**버전**: 1.1

