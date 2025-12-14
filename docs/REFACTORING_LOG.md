# 리팩토링 및 아키텍처 변경 일지 (D2 Tamagotchi)

이 파일은 Cursor AI를 통해 수행된 주요 아키텍처 및 코드 변경 사항을 추적하기 위해 작성되었습니다.

---

## [2024-12-19] Ver.1 퀘스트 모드 전체 데이터(Area 1~F) 및 엔진 구현

### 작업 유형
- 퀘스트 데이터 구현
- 퀘스트 엔진 구현
- 배틀 시스템 통합

### 목적 및 영향
Digital Monster Color Ver.1 퀘스트 모드를 완전히 구현했습니다. Area 1부터 Area F까지 모든 퀘스트 데이터를 입력하고, 퀘스트 엔진을 구현하여 실제 게임에서 퀘스트 모드를 플레이할 수 있게 되었습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/data/v1/quests.js` (신규 생성)
  - **퀘스트 데이터 구조 정의**
    - `quests` 배열: Area 1 ~ Area 7, Area F (총 8개 Area)
    - 각 Area는 여러 적(Enemy)을 포함하며, 마지막 적은 Boss
    - 적 데이터 구조:
      - `enemyId`: 디지몬 ID (digimons.js 참조)
      - `name`: 디지몬 이름
      - `attribute`: 속성 (Vaccine, Data, Virus, Free)
      - `power`: 파워 (퀘스트 전용 값, 도감 값과 다를 수 있음)
      - `isBoss`: 보스 여부
    - `unlockCondition`: Area 언락 조건 (예: "The Grid", "DMC Logo", "Box Art")

  - **헬퍼 함수**
    - `getQuestArea(areaId)`: Area ID로 퀘스트 데이터 찾기
    - `getQuestEnemy(areaId, roundIndex)`: Area의 특정 Round(적) 데이터 가져오기

- `digimon-tamagotchi-frontend/src/logic/battle/questEngine.js` (신규 생성)
  - **퀘스트 엔진 구현**
    - `playQuestRound(userDigimon, userStats, areaId, roundIndex)` 함수
      - 지정된 Area와 Round의 적 데이터를 가져옴
      - `calculator.js`의 `simulateBattle`을 실행하여 배틀 수행
      - **중요**: 적의 `power`는 퀘스트 데이터의 값을 강제로 적용 (도감 값 무시)
      - 반환값:
        - `win`: 승리 여부 (boolean)
        - `logs`: 배틀 로그 배열
        - `enemy`: 적 정보 { name, power, attribute, isBoss }
        - `isAreaClear`: Area 클리어 여부
        - `reward`: 보상 (Area 클리어 시)
        - `rounds`, `userHits`, `enemyHits`: 추가 배틀 정보

    - `playQuestArea(userDigimon, userStats, areaId)` 함수
      - Area의 모든 라운드를 순차적으로 플레이
      - 한 번이라도 패배하면 중단
      - 전체 Area 플레이 결과 반환

- `digimon-tamagotchi-frontend/src/logic/battle/index.js` (수정)
  - 퀘스트 엔진 함수들 export 추가

### 퀘스트 데이터 상세

#### Area 1: The Grid (Unlock: "The Grid")
- Betamon (Virus, Power: 15)
- Agumon (Vaccine, Power: 19)
- Meramon (Boss, Data, Power: 23)

#### Area 2
- Numemon (Virus, Power: 19)
- Seadramon (Data, Power: 23)
- Devimon (Boss, Virus, Power: 28)

#### Area 3
- Tyrannomon (Data, Power: 28)
- Airdramon (Vaccine, Power: 37)
- Greymon (Boss, Vaccine, Power: 45)

#### Area 4: DMC Logo (Unlock: "DMC Logo")
- Seadramon (Data, Power: 45)
- Meramon (Data, Power: 55)
- Devimon (Virus, Power: 65)
- Mamemon (Boss, Data, Power: 80)

#### Area 5
- Airdramon (Vaccine, Power: 55)
- Tyrannomon (Data, Power: 70)
- Greymon (Vaccine, Power: 85)
- Metal Greymon (Virus) (Boss, Power: 105)

#### Area 6
- Meramon (Data, Power: 55)
- Mamemon (Data, Power: 80)
- Monzaemon (Vaccine, Power: 95)
- Bancho Mamemon (Boss, Data, Power: 120)

#### Area 7
- Numemon (Virus, Power: 75)
- Metal Greymon (Virus) (Power: 90)
- Monzaemon (Vaccine, Power: 110)
- Blitz Greymon (Virus, Power: 130)
- Shin Monzaemon (Boss, Vaccine, Power: 145)

#### Area F (Final): Box Art (Unlock: "Box Art")
- Metal Greymon (Virus) (Power: 85)
- Bancho Mamemon (Data, Power: 100)
- Shin Monzaemon (Vaccine, Power: 135)
- Blitz Greymon (Virus, Power: 160)
- Omegamon Alter-S (Boss, Virus, Power: 220)

### 주요 특징

1. **퀘스트 전용 파워 값**
   - 적의 파워는 도감 값이 아닌 퀘스트 데이터의 값을 사용
   - 같은 디지몬이라도 Area에 따라 다른 파워를 가질 수 있음

2. **Boss 시스템**
   - 각 Area의 마지막 적은 `isBoss: true`로 표시
   - Boss를 처치하면 Area 클리어

3. **언락 시스템**
   - 일부 Area는 특정 조건을 만족해야 언락됨
   - `unlockCondition` 필드로 관리

4. **배틀 로그**
   - 각 배틀의 상세 로그를 제공
   - 승패, 라운드 수, 명중 횟수 등 모든 정보 포함

### 사용 예시
```javascript
import { playQuestRound, playQuestArea } from '../logic/battle';
import { digimonDataVer1 } from '../data/v1/digimons';

// 단일 라운드 플레이
const result = playQuestRound(
  userDigimon,    // digimons.js의 디지몬 데이터
  userStats,      // 유저 스탯
  "area1",        // Area ID
  0               // Round 인덱스 (0부터 시작)
);

// 전체 Area 플레이
const areaResult = playQuestArea(
  userDigimon,
  userStats,
  "area1"
);
```

### 관련 파일
- `digimon-tamagotchi-frontend/src/data/v1/quests.js`
- `digimon-tamagotchi-frontend/src/logic/battle/questEngine.js`
- `digimon-tamagotchi-frontend/src/logic/battle/calculator.js`
- `digimon-tamagotchi-frontend/src/logic/battle/index.js`

---

## [2024-12-19] DMC 배틀 공식(HitRate + Type Advantage) 엔진 구현

### 작업 유형
- 배틀 시스템 구현
- 속성 상성 로직 구현
- 배틀 시뮬레이터 구현

### 목적 및 영향
Digital Monster Color 매뉴얼 기반 배틀 계산기를 구현했습니다. 속성 상성 시스템과 히트레이트 계산 공식을 정확히 반영하고, 턴제 배틀 시뮬레이터를 추가하여 실제 배틀 결과를 시뮬레이션할 수 있게 되었습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/logic/battle/types.js` (신규 생성)
  - **속성 상성 시스템 구현**
    - Vaccine > Virus > Data > Vaccine 삼각 상성 관계 정의
    - `getAttributeBonus(attackerAttr, defenderAttr)` 함수
      - 유리한 경우: +5 반환
      - 불리한 경우: -5 반환
      - 무관한 경우: 0 반환
      - Free 속성은 상성 없음

- `digimon-tamagotchi-frontend/src/logic/battle/calculator.js` (신규 생성)
  - **히트레이트 계산기**
    - `calculateHitRate(attackerPower, defenderPower, attrBonus)` 함수
      - 매뉴얼 공식: `((p1 * 100) / (p1 + p2)) + bonus`
      - 결과값을 0~100 사이로 클램핑
      - 분모가 0인 경우 기본값 50% 반환

  - **배틀 시뮬레이터**
    - `simulateBattle(userDigimon, userStats, enemyDigimon, enemyStats)` 함수
      - 턴제 시뮬레이션 수행
      - 라운드마다 서로 한 번씩 공격
      - 각 공격은 `Math.random() * 100 < hitRate` 여부로 명중 판정
      - 먼저 3번 명중(Hits)시킨 쪽이 승리
      - 반환값:
        - `won`: 승패 여부 (boolean)
        - `rounds`: 총 라운드 수 (number)
        - `log`: 배틀 로그 배열 (누가 때렸고 맞았는지 상세 정보)
        - `userHits`: 유저 명중 횟수
        - `enemyHits`: 적 명중 횟수
        - `userHitRate`, `enemyHitRate`: 각각의 히트레이트
        - `userAttrBonus`, `enemyAttrBonus`: 각각의 속성 보너스

- `digimon-tamagotchi-frontend/src/logic/battle/index.js` (수정)
  - 새로운 배틀 계산기 함수들 export 추가
  - 기존 `hitrate.js` 함수들과의 호환성 유지

### 배틀 시스템 상세

#### 속성 상성 관계
```
Vaccine > Virus > Data > Vaccine (삼각 상성)
Free: 상성 없음
```

#### 히트레이트 계산 공식
```
hitRate = ((attackerPower * 100) / (attackerPower + defenderPower)) + attrBonus
```
- `attrBonus`: 속성 보너스 (-5, 0, 또는 +5)
- 결과값은 0~100 사이로 클램핑

#### 배틀 규칙
1. **턴제 시스템**: 라운드마다 유저와 적이 각각 한 번씩 공격
2. **명중 판정**: `Math.random() * 100 < hitRate`로 결정
3. **승리 조건**: 먼저 상대에게 3번 명중시킨 쪽이 승리
4. **최대 라운드**: 무한 루프 방지를 위해 최대 100라운드로 제한

#### 배틀 로그 구조
```javascript
{
  round: 1,
  attacker: "user" | "enemy",
  defender: "user" | "enemy",
  hit: true | false,
  roll: "45.23", // 랜덤 값
  hitRate: "65.50", // 히트레이트
  message: "라운드 1: 유저 공격 성공! (1/3)"
}
```

### 사용 예시
```javascript
import { simulateBattle, calculateHitRate, getAttributeBonus } from '../logic/battle';

// 배틀 시뮬레이션
const result = simulateBattle(
  userDigimon,    // 유저 디지몬 데이터
  userStats,      // 유저 스탯
  enemyDigimon,   // 적 디지몬 데이터
  enemyStats      // 적 스탯
);

console.log(result.won);      // true/false
console.log(result.rounds);    // 총 라운드 수
console.log(result.log);       // 상세 로그 배열
```

### 관련 파일
- `digimon-tamagotchi-frontend/src/logic/battle/types.js`
- `digimon-tamagotchi-frontend/src/logic/battle/calculator.js`
- `digimon-tamagotchi-frontend/src/logic/battle/index.js`
- `digimon-tamagotchi-frontend/src/logic/battle/hitrate.js` (기존 파일, 호환성 유지)

---

## [2024-12-19] Ver.1 전체 진화 트리 데이터 입력 (Baby I ~ Super Ultimate)

### 작업 유형
- 데이터 전면 업데이트
- 완전한 진화 트리 구현
- 모든 스탯 값 정확 반영

### 목적 및 영향
사용자가 제공한 18장의 상세 스탯 카드 및 진화 트리 이미지를 분석하여 `digimons.js`를 전면 업데이트했습니다. Baby I부터 Super Ultimate까지 모든 단계의 디지몬 데이터를 정확히 반영하고, 모든 수치(Hunger Loss, Strength Loss, Sleep Time, Power, Energy, Min Weight 등)를 이미지 분석 데이터에 맞춰 입력했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/data/v1/digimons.js` (전면 재작성)
  - **전체 디지몬 데이터 구조 재정의**
  - **sleepTime 필드 추가**: 수면 시간을 "HH:MM" 형식으로 저장
  - **진화 우선순위 적용**: 까다로운 진화 조건을 배열 앞쪽에, Numemon 같은 Fallback 진화를 맨 뒤에 배치

### 추가/업데이트된 디지몬 목록

#### Baby I (In-Training I)
1. **Botamon** (ID: 1, Free)
   - Power: 0, Min Weight: 5, Energy: 0
   - Hunger Loss: 3분, Strength Loss: 3분
   - Sleep: null
   - 진화: Koromon (Time 10분)

#### Baby II (In-Training II)
2. **Koromon** (ID: 2, Free)
   - Power: 0, Min Weight: 10, Energy: 0
   - Hunger Loss: 30분, Strength Loss: 30분
   - Sleep: 20:00
   - 진화: Agumon (Mistakes [0, 3]), Betamon (Mistakes [4, 99])

#### Child (Rookie)
3. **Agumon** (ID: 3, Vaccine)
   - Power: 30, Min Weight: 20, Energy: 20
   - Hunger Loss: 48분, Strength Loss: 48분
   - Sleep: 20:00
   - 진화: Greymon, Devimon, Tyranomon, Meramon, Numemon (Fallback)

4. **Betamon** (ID: 4, Virus)
   - Power: 25, Min Weight: 20, Energy: 20
   - Hunger Loss: 38분, Strength Loss: 38분
   - Sleep: 21:00
   - 진화: Devimon, Meramon, Airdramon, Seadramon, Numemon (Fallback)

#### Adult (Champion)
5. **Greymon** (ID: 5, Vaccine)
   - Power: 50, Min Weight: 30, Energy: 30
   - Hunger Loss: 59분, Strength Loss: 59분
   - Sleep: 21:00
   - 진화: Metal Greymon (Virus) (Battles 15+, WinRatio 80%+)

6. **Devimon** (ID: 6, Virus)
   - Power: 50, Min Weight: 40, Energy: 30
   - Hunger Loss: 48분, Strength Loss: 48분
   - Sleep: 23:00
   - 진화: Metal Greymon (Virus) (Battles 15+, WinRatio 80%+)

7. **Airdramon** (ID: 7, Vaccine)
   - Power: 50, Min Weight: 30, Energy: 30
   - Hunger Loss: 38분, Strength Loss: 38분
   - Sleep: 23:00
   - 진화: Metal Greymon (Virus) (Battles 15+, WinRatio 80%+)

8. **Numemon** (ID: 8, Virus)
   - Power: 40, Min Weight: 10, Energy: 30
   - Hunger Loss: 28분, Strength Loss: 28분
   - Sleep: 00:00
   - 진화: Monzaemon (Battles 15+, WinRatio 80%+)

9. **Tyranomon** (ID: 9, Data)
   - Power: 45, Min Weight: 20, Energy: 30
   - Hunger Loss: 59분, Strength Loss: 59분
   - Sleep: 22:00
   - 진화: Mamemon (Battles 15+, WinRatio 80%+)

10. **Meramon** (ID: 10, Data)
    - Power: 45, Min Weight: 30, Energy: 30
    - Hunger Loss: 48분, Strength Loss: 48분
    - Sleep: 00:00
    - 진화: Mamemon (Battles 15+, WinRatio 80%+)

11. **Seadramon** (ID: 11, Data)
    - Power: 45, Min Weight: 20, Energy: 30
    - Hunger Loss: 38분, Strength Loss: 38분
    - Sleep: 23:00
    - 진화: Mamemon (Battles 15+, WinRatio 80%+)

#### Perfect (Ultimate)
12. **Metal Greymon (Virus)** (ID: 12, Virus)
    - Power: 100, Min Weight: 40, Energy: 40
    - Hunger Loss: 59분, Strength Loss: 59분
    - Sleep: 20:00
    - 진화: Blitz Greymon (Mistakes [0, 1], Battles 15+, WinRatio 80%+)

13. **Monzaemon** (ID: 13, Vaccine)
    - Power: 100, Min Weight: 40, Energy: 40
    - Hunger Loss: 48분, Strength Loss: 48분
    - Sleep: 21:00
    - 진화: Shin Monzaemon (Mistakes [0, 1], Battles 15+, WinRatio 80%+)

14. **Mamemon** (ID: 14, Data)
    - Power: 85, Min Weight: 5, Energy: 40
    - Hunger Loss: 59분, Strength Loss: 59분
    - Sleep: 23:00
    - 진화: Bancho Mamemon (Mistakes [0, 1], Battles 15+, WinRatio 80%+)

#### Ultimate
15. **Blitz Greymon** (ID: 15, Virus)
    - Power: 170, Min Weight: 50, Energy: 50
    - Hunger Loss: 59분, Strength Loss: 59분
    - Sleep: 23:00
    - 진화: Omegamon Alter-S (Jogress with Cres Garurumon)

16. **Shin Monzaemon** (ID: 16, Vaccine)
    - Power: 170, Min Weight: 40, Energy: 50
    - Hunger Loss: 48분, Strength Loss: 48분
    - Sleep: 23:00
    - 진화: [] (최종 단계)

17. **Bancho Mamemon** (ID: 17, Data)
    - Power: 150, Min Weight: 5, Energy: 50
    - Hunger Loss: 59분, Strength Loss: 59분
    - Sleep: 23:00
    - 진화: [] (최종 단계)

#### Super Ultimate
18. **Omegamon Alter-S** (ID: 18, Virus)
    - Power: 200, Min Weight: 40, Energy: 50
    - Hunger Loss: 66분, Strength Loss: 66분
    - Sleep: 23:00
    - 진화: [] (최종 단계)

#### Jogress 파트너
19. **Cres Garurumon** (ID: 19, Ultimate)
    - Placeholder (Jogress 파트너용)
    - Blitz Greymon과 조그레스하여 Omegamon Alter-S 진화

### 주요 변경 사항

1. **스탯 필드 정확 반영**
   - 모든 Hunger Loss / Strength Loss 값을 분 단위 정수로 변환
   - Sleep Time을 "HH:MM" 형식으로 저장
   - Power, Energy, Min Weight 값 정확히 반영

2. **진화 조건 우선순위**
   - 까다로운 진화 조건(상위 루트)을 배열 앞쪽에 배치
   - Numemon 같은 Fallback 진화를 맨 뒤에 배치
   - 조건 체크 순서가 진화 결과에 영향을 주도록 설계

3. **Perfect 단계 진화 조건**
   - Mistakes [0, 1] 조건 추가
   - Battles 15+, WinRatio 80%+ 조건 유지

4. **Jogress 진화 구현**
   - Blitz Greymon → Omegamon Alter-S (Jogress with Cres Garurumon)
   - `jogress: true` 플래그 및 `partner` 필드 추가

5. **최종 단계 디지몬**
   - Shin Monzaemon, Bancho Mamemon, Omegamon Alter-S는 `evolutionCriteria: null`, `evolutions: []`로 설정

### 데이터 소스
- 18장의 상세 스탯 카드 이미지 (사용자 제공)
- Ver.1 진화 트리 이미지 (사용자 제공)

### 관련 파일
- `digimon-tamagotchi-frontend/src/data/v1/digimons.js`
- `digimon-tamagotchi-frontend/src/data/v1/evolution.js` (향후 업데이트 필요)

---

## [2024-12-19] Ver.1 성장기/성숙기 데이터 및 진화 조건 입력

### 작업 유형
- 데이터 대량 추가
- 진화 트리 구현
- 스탯 데이터 업데이트

### 목적 및 영향
Ver.1 진화 트리 이미지를 기반으로 성장기(Child)와 성숙기(Adult) 디지몬들의 데이터를 대량 추가했습니다. 이미지에서 확인한 스탯 값(Power, Min Weight, Energy, Hunger Loss, Strength Loss 등)을 반영하고, 복잡한 진화 조건을 구현했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/data/v1/digimons.js` (대폭 수정)
  - **Agumon (Child)**: 스탯 업데이트 및 진화 조건 추가
    - Power: 30, Min Weight: 20, Energy: 20
    - Hunger Loss: 48분, Strength Loss: 48분
    - 진화 대상: Greymon, Tyranomon, Devimon, Meramon, Numemon (5가지 경로)
  - **Betamon (Child)**: 스탯 업데이트 및 진화 조건 추가
    - Power: 25, Min Weight: 20, Energy: 20
    - Hunger Loss: 38분, Strength Loss: 38분
    - 진화 대상: Airdramon, Seadramon, Devimon, Meramon, Numemon (5가지 경로)
  - **Greymon (Adult)**: 스탯 업데이트
    - Power: 50, Min Weight: 30, Energy: 30
    - Hunger Loss: 59분, Strength Loss: 59분
    - 진화 대상: Metal Greymon (Virus) (15+ Battles, 80%+ Win Ratio)
  - **Tyranomon (Adult)**: 신규 추가
    - Power: 45, Min Weight: 20, Energy: 30
    - Hunger Loss: 59분, Strength Loss: 59분
    - 진화 대상: Mamemon (15+ Battles, 80%+ Win Ratio)
  - **Meramon (Adult)**: 신규 추가
    - 진화 대상: Metal Greymon (Virus) (15+ Battles, 80%+ Win Ratio)
  - **Seadramon (Adult)**: 신규 추가
    - 진화 대상: Metal Greymon (Virus) (15+ Battles, 80%+ Win Ratio)
  - **Numemon (Adult)**: 신규 추가
    - Power: 40, Min Weight: 10, Energy: 30
    - Hunger Loss: 28분, Strength Loss: 28분
    - 진화 대상: Monzaemon (15+ Battles, 80%+ Win Ratio)
  - **Devimon (Adult)**: 신규 추가
    - Power: 50, Min Weight: 40, Energy: 30
    - Hunger Loss: 48분, Strength Loss: 48분
    - 진화 대상: Metal Greymon (Virus) (15+ Battles, 80%+ Win Ratio)
  - **Airdramon (Adult)**: 신규 추가
    - Power: 50, Min Weight: 30, Energy: 30
    - Hunger Loss: 38분, Strength Loss: 38분
    - 진화 대상: Metal Greymon (Virus) (15+ Battles, 80%+ Win Ratio)
  - **Metal Greymon (Virus) (Perfect)**: 신규 추가
  - **Mamemon (Perfect)**: 신규 추가
  - **Monzaemon (Perfect)**: 신규 추가

- `digimon-tamagotchi-frontend/src/data/v1/evolution.js` (대폭 수정)
  - **Agumon 진화 조건**: 9가지 경로 구현
    - Greymon: 0-3 Care Mistakes, 32+ Training
    - Tyranomon: 4+ Care Mistakes, 5-15 Training, 3+ Overfeed, 4-5 Sleep Disturbances
    - Devimon: 0-3 Care Mistakes, 0-31 Training
    - Meramon: 4+ Care Mistakes, 16+ Training, 3+ Overfeed, 6+ Sleep Disturbances
    - Numemon: 5가지 조건 (Choose one)
  - **Betamon 진화 조건**: 8가지 경로 구현
    - Airdramon: 4+ Care Mistakes, 8-31 Training, 0-3 Overfeed, 9+ Sleep Disturbances
    - Seadramon: 4+ Care Mistakes, 8-31 Training, 4+ Overfeed, 0-8 Sleep Disturbances
    - Devimon: 0-3 Care Mistakes, 48+ Training
    - Meramon: 0-3 Care Mistakes, 0-47 Training
    - Numemon: 4가지 조건 (Choose one)
  - **Adult → Perfect 진화 조건**: 모든 성숙기 디지몬에 15+ Battles, 80%+ Win Ratio 조건 추가
    - Greymon → Metal Greymon (Virus)
    - Tyranomon → Mamemon
    - Meramon → Metal Greymon (Virus)
    - Seadramon → Metal Greymon (Virus)
    - Numemon → Monzaemon
    - Devimon → Metal Greymon (Virus)
    - Airdramon → Metal Greymon (Virus)

### 진화 트리 구조

#### Child → Adult 진화 경로
1. **Agumon → Adult**
   - Greymon: 0-3 실수, 32+ 훈련
   - Tyranomon: 4+ 실수, 5-15 훈련, 3+ 오버피드, 4-5 수면 방해
   - Devimon: 0-3 실수, 0-31 훈련
   - Meramon: 4+ 실수, 16+ 훈련, 3+ 오버피드, 6+ 수면 방해
   - Numemon: 5가지 조건 중 하나 (실패 진화)

2. **Betamon → Adult**
   - Airdramon: 4+ 실수, 8-31 훈련, 0-3 오버피드, 9+ 수면 방해
   - Seadramon: 4+ 실수, 8-31 훈련, 4+ 오버피드, 0-8 수면 방해
   - Devimon: 0-3 실수, 48+ 훈련
   - Meramon: 0-3 실수, 0-47 훈련
   - Numemon: 4가지 조건 중 하나 (실패 진화)

#### Adult → Perfect 진화 조건
- 모든 성숙기 디지몬: 15+ 배틀, 80%+ 승률 필요

### 데이터 소스
- Ver.1 진화 트리 이미지 (사용자 제공)
- 각 디지몬의 상세 정보 카드 이미지 (Power, Min Weight, Energy, Hunger Loss, Strength Loss 등)

### 미완성 항목
- Perfect 단계 디지몬들의 스탯 값 (TODO 주석으로 표시)
- Ultimate, Super Ultimate 단계 디지몬 데이터 (향후 추가 예정)
- 일부 디지몬의 sprite 번호 (0으로 임시 설정, TODO 주석으로 표시)

### 관련 파일
- `digimon-tamagotchi-frontend/src/data/v1/digimons.js`
- `digimon-tamagotchi-frontend/src/data/v1/evolution.js`
- `digimon-tamagotchi-frontend/src/logic/evolution/checker.js` (기존 로직 활용)

---

## [2024-12-19] Botamon/Koromon 초기 진화 데이터 입력

### 작업 유형
- 데이터 입력
- 에러 핸들링 개선
- 버그 수정

### 목적 및 영향
Botamon과 Koromon의 진화 데이터를 추가하고, 진화 체커에서 디지몬 이름을 찾을 수 없을 때의 예외 처리를 개선했습니다. "N/A" 대신 정상적인 피드백이 표시되도록 수정했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/data/v1/digimons.js` (수정)
  - **Botamon**: `evolutions` 배열 추가
    - Koromon으로 진화 (10분 후, `timeToEvolveSeconds: 600`)
  - **Koromon**: `evolutions` 배열 추가
    - Agumon으로 진화 (실수 0~3회)
    - Betamon으로 진화 (실수 4회 이상)
  - **Agumon, Betamon**: 기본 데이터 확인 (이미 존재함)

- `digimon-tamagotchi-frontend/src/logic/evolution/checker.js` (수정)
  - `checkEvolution` 함수에 `digimonDataMap` 파라미터 추가 (5번째 인자)
  - `targetName` 찾기 로직에 예외 처리 추가:
    - `digimonDataMap`에서 디지몬 데이터 찾기
    - 찾을 수 없으면 `"Unknown Digimon (ID: ${targetName})"` 형식으로 표시
    - "N/A" 대신 구체적인 정보 제공

- `digimon-tamagotchi-frontend/src/pages/Game.jsx` (수정)
  - `checkEvolution` 호출 시 `digimonDataVer1`을 5번째 인자로 전달
  - 진화 성공 시 `targetName`을 올바르게 표시하도록 수정

### 진화 데이터 구조

#### Botamon → Koromon
```javascript
evolutions: [
  {
    targetId: "Koromon",
    targetName: "Koromon",
    condition: {
      type: "time",
      value: 600, // 10분 = 600초
    },
  },
]
```

#### Koromon → Agumon / Betamon
```javascript
evolutions: [
  {
    targetId: "Agumon",
    targetName: "Agumon",
    condition: {
      type: "mistakes",
      value: [0, 3], // 실수 0~3회
    },
  },
  {
    targetId: "Betamon",
    targetName: "Betamon",
    condition: {
      type: "mistakes",
      value: [4, 99], // 실수 4회 이상
    },
  },
]
```

### 에러 핸들링 개선

#### Before
- 디지몬 이름을 찾을 수 없을 때 "N/A" 표시
- 구체적인 정보 부족

#### After
- `digimonDataMap`에서 디지몬 데이터 찾기
- 찾을 수 없으면 `"Unknown Digimon (ID: ${targetId})"` 형식으로 표시
- 구체적인 ID 정보 제공

### 버그 수정

#### 문제
- 진화 버튼 클릭 시 "N/A" 표시
- 시간 부족 시 정상적인 피드백이 표시되지 않음

#### 해결
- `targetName` 찾기 로직에 예외 처리 추가
- `digimonDataMap`을 통해 디지몬 이름 정확히 찾기
- Fallback 처리로 항상 의미 있는 정보 제공

### 테스트 시나리오

1. **Botamon 진화 테스트**:
   - Botamon 선택 후 10분 대기
   - Evolution 버튼 클릭
   - "디지몬 진화~~~! 🎉 곧 Koromon으로 변신합니다!" 메시지 확인

2. **시간 부족 테스트**:
   - Botamon 선택 후 5분 대기
   - Evolution 버튼 클릭
   - "아직 진화할 준비가 안 됐어! 남은 시간: 5분 0초" 메시지 확인

3. **조건 부족 테스트**:
   - Koromon 선택 후 실수 5회 발생
   - Evolution 버튼 클릭
   - "진화 조건을 만족하지 못했어! [부족한 조건] ..." 메시지 확인

### 다음 단계
1. 모든 디지몬의 `evolutions` 배열 추가
2. 진화 조건 타입 확장 (time, mistakes 외 추가)
3. 진화 애니메이션 및 효과 추가

---

## [2024-12-19] 진화 상세 피드백 구현 및 Lifespan 버그 수정

### 작업 유형
- 진화 로직 고도화
- 사용자 피드백 시스템
- 버그 수정

### 목적 및 영향
진화 시도 시 사용자에게 상세한 피드백을 제공하고, Lifespan이 버튼 클릭에 의해 수정되지 않도록 보장했습니다. 진화 실패 시 구체적인 사유를 알려주어 사용자가 무엇이 부족한지 명확히 알 수 있게 했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/logic/evolution/checker.js` (수정)
  - `checkEvolution` 함수가 단순 ID 반환이 아닌 상세 결과 객체를 반환하도록 변경
  - 반환 형식:
    - 성공: `{ success: true, reason: "SUCCESS", targetId: "..." }`
    - 시간 부족: `{ success: false, reason: "NOT_READY", remainingTime: ... }`
    - 조건 불만족: `{ success: false, reason: "CONDITIONS_UNMET", details: [...] }`
  - 각 진화 후보별로 조건 체크 및 실패 사유 분석
  - `details` 배열에 각 후보별 부족한 조건 상세 정보 포함

- `digimon-tamagotchi-frontend/src/pages/Game.jsx` (수정)
  - `handleEvolutionButton`: 진화 결과 객체를 처리하여 상세 피드백 제공
    - 성공 시: `alert("디지몬 진화~~~! 🎉\n\n곧 ${targetName}으로 변신합니다!")`
    - 시간 부족 시: `alert("아직 진화할 준비가 안 됐어!\n\n남은 시간: ${mm}분 ${ss}초")`
    - 조건 부족 시: `alert("진화 조건을 만족하지 못했어!\n\n[부족한 조건]\n${detailsText}")`
  - Lifespan 버그 수정: `handleEvolutionButton` 내부에서 `lifespanSeconds`를 수정하는 로직이 없음을 확인 (이미 올바르게 구현됨)

### 진화 피드백 시스템

#### 결과 객체 구조
```javascript
// 성공
{
  success: true,
  reason: "SUCCESS",
  targetId: "Greymon"
}

// 시간 부족
{
  success: false,
  reason: "NOT_READY",
  remainingTime: 3600 // 초 단위
}

// 조건 불만족
{
  success: false,
  reason: "CONDITIONS_UNMET",
  details: [
    {
      target: "Greymon",
      missing: "배틀 (현재: 0, 필요: 15), 승률 (현재: 0%, 필요: 40%)"
    }
  ]
}
```

#### 체크하는 조건들
- 실수 (mistakes): 범위 체크
- 오버피드 (overfeeds): 범위 체크
- 배틀 (battles): 최소값 체크
- 승률 (winRatio): 최소값 체크
- 훈련 (trainings): 최소값 체크
- 체중 (minWeight): 최소값 체크
- 힘 (minStrength): 최소값 체크
- 노력치 (minEffort): 최소값 체크
- 속성 (requiredType): 필수 속성 체크

### 사용자 피드백

#### 성공 메시지
```
디지몬 진화~~~! 🎉

곧 Greymon으로 변신합니다!
```

#### 시간 부족 메시지
```
아직 진화할 준비가 안 됐어!

남은 시간: 60분 30초
```

#### 조건 부족 메시지
```
진화 조건을 만족하지 못했어!

[부족한 조건]
• Greymon: 배틀 (현재: 0, 필요: 15), 승률 (현재: 0%, 필요: 40%)
• Betamon: 실수 (현재: 2, 필요: 최대 3)
```

### Lifespan 버그 수정

#### 확인 사항
- `handleEvolutionButton` 내부에서 `lifespanSeconds`를 직접 수정하는 로직이 없음을 확인
- `lifespanSeconds`는 오직 `useEffect`의 `setInterval` 타이머에서만 증가
- `applyLazyUpdateBeforeAction`은 마지막 저장 시간부터 현재까지의 경과 시간을 계산하여 스탯을 업데이트하지만, `lifespanSeconds`는 정상적으로 증가함

#### 보장 사항
- 버튼 클릭이 `lifespanSeconds`에 직접적인 영향을 주지 않음
- `lifespanSeconds`는 시간 경과에 따라만 증가

### 장점
1. **사용자 경험 향상**: 진화 실패 시 구체적인 사유를 알 수 있어 다음 행동 계획 수립 가능
2. **디버깅 용이**: 개발자가 진화 조건을 쉽게 확인 가능
3. **명확한 피드백**: 시간 부족, 조건 부족 등 상황별로 명확한 메시지 제공
4. **버그 수정**: Lifespan이 버튼 클릭에 의해 수정되지 않음을 보장

### 다음 단계
1. 진화 애니메이션 추가
2. 진화 성공 시 특별 효과 추가
3. 진화 조건을 UI에 표시 (진화 가능 여부 미리 보기)

---

## [2024-12-19] DMC 스타일 진화 판정 엔진 구현

### 작업 유형
- 진화 로직 구현
- 매뉴얼 규칙 적용
- 코드 리팩토링

### 목적 및 영향
Digital Monster Color 매뉴얼 규칙을 기반으로 한 진화 판정 엔진을 구현했습니다. 기존의 단순한 진화 로직을 매뉴얼의 복합 조건(mistakes, overfeeds, battles, winRatio, training 등)을 정확히 체크하는 시스템으로 교체했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/logic/evolution/checker.js` (신규)
  - `checkEvolution`: 매뉴얼 기반 진화 판정 함수
    - 1단계: 시간 체크 (`timeToEvolveSeconds`가 0 이하인지 확인)
    - 2단계: 조건 매칭 (mistakes, overfeeds, battles, winRatio, training, minWeight, minStrength, minEffort, requiredType)
    - 3단계: 진화 대상 반환 (조건을 만족하는 첫 번째 진화 대상의 ID 반환)
  - `findEvolutionTarget`: 진화 대상 찾기 함수 (기존 로직과의 호환성 유지)

- `digimon-tamagotchi-frontend/src/logic/evolution/index.js` (수정)
  - `checkEvolution`, `findEvolutionTarget` export 추가

- `digimon-tamagotchi-frontend/src/pages/Game.jsx` (수정)
  - `handleEvolutionButton`: `checkEvolution` 함수 사용하도록 변경
  - `handleEvolution`: 진화 성공 시 스탯 리셋 로직 추가
    - `careMistakes`, `overfeeds`, `battlesForEvolution`, `proteinOverdose`, `injuries`, `trainings`, `sleepDisturbances`, `trainingCount` 리셋

### 진화 판정 로직

#### 체크하는 조건들
1. **시간 체크**: `timeToEvolveSeconds`가 0 이하인지 확인
2. **mistakes**: 범위 체크 (min/max)
3. **overfeeds**: 범위 체크 (단일 값 또는 배열)
4. **battles**: 최소값 체크 (총 배틀 횟수)
5. **winRatio**: 최소값 체크 (승률 %)
6. **trainings**: 최소값 체크 (훈련 횟수)
7. **minWeight**: 최소 체중 체크
8. **minStrength**: 최소 힘 체크
9. **minEffort**: 최소 노력치 체크
10. **requiredType**: 필수 속성 체크

#### 진화 대상 결정
- 조건을 모두 만족하면 `evolutionConditionsVer1`에서 진화 대상을 찾음
- 조건을 만족하는 첫 번째 진화 대상의 ID를 반환
- 조건을 만족하는 대상이 없으면 `null` 반환

### 진화 시 스탯 리셋

매뉴얼 규칙에 따라 진화 시 다음 스탯이 리셋됩니다:
- `careMistakes`: 0
- `overfeeds`: 0
- `battlesForEvolution`: 0
- `proteinOverdose`: 0
- `injuries`: 0
- `trainings`: 0
- `sleepDisturbances`: 0
- `trainingCount`: 0

진화 시 유지되는 스탯:
- `energy`
- `battles`
- `battlesWon`
- `battlesLost`
- `winRate`

### 코드 구조 개선

#### Before (기존 로직)
```javascript
// 단순 조건 체크
for(let e of evo.evolution){
  if(e.condition.check(test)){
    await handleEvolution(e.next);
    return;
  }
}
```

#### After (매뉴얼 기반)
```javascript
// 매뉴얼 기반 복합 조건 체크
const evolutionTarget = checkEvolution(
  updatedStats, 
  currentDigimonData, 
  evolutionConditionsVer1, 
  selectedDigimon
);
if(evolutionTarget) {
  await handleEvolution(evolutionTarget);
}
```

### 장점
1. **매뉴얼 규칙 정확 반영**: 복합 조건을 정확히 체크
2. **코드 재사용성**: 순수 함수로 구현되어 테스트 및 재사용 용이
3. **유지보수성 향상**: 진화 조건이 명확하게 분리됨
4. **확장성**: 새로운 진화 조건 추가가 쉬움

### 다음 단계
1. 모든 디지몬의 진화 조건을 `digimons.js`에 추가
2. 진화 조건 테스트 코드 작성
3. 진화 애니메이션 및 효과 추가

---

## [2024-12-19] 스탯 데이터 구조 확장(Energy, Overdose 등) 및 UI 반영

### 작업 유형
- 데이터 구조 확장
- UI 업데이트
- 초기화 로직 수정

### 목적 및 영향
매뉴얼 기반 로직을 지원하기 위해 스탯 데이터 구조를 확장하고, 개발자가 확인할 수 있도록 UI에 반영했습니다. Energy(DP), Protein Overdose, Overfeed Count, Battles/Wins 등의 필드를 추가하여 매뉴얼 규칙을 정확히 구현할 수 있는 기반을 마련했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/data/defaultStatsFile.js` (수정)
  - `energy: 0` 추가 - 매뉴얼의 DP 개념 (기존 stamina와 병행)
  - `proteinOverdose: 0` 추가 - 프로틴 과다 복용 횟수 (최대 7)
  - `overfeeds: 0` 추가 - 오버피드 횟수 누적
  - `battles: 0` 추가 - 총 배틀 횟수 (진화 조건용)
  - `battlesWon: 0` 추가 - 총 승리 횟수 (진화 조건용)
  - `battlesLost: 0` 추가 - 총 패배 횟수 (진화 조건용)
  - `battlesForEvolution: 0` 추가 - 진화를 위한 배틀 횟수 (진화 시 리셋)

- `digimon-tamagotchi-frontend/src/components/StatsPanel.jsx` (수정)
  - `Stamina` 라벨을 `Energy (DP)`로 변경
  - `energy` 필드 표시 (stamina가 없으면 energy 사용)
  - 개발자용 정보 섹션 추가:
    - Protein Overdose
    - Overfeeds
    - Battles
    - Wins / Losses

- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx` (수정)
  - `Stamina` 라벨을 `Energy (DP)`로 변경
  - 매뉴얼 기반 필드 섹션 추가:
    - Protein Overdose
    - Overfeeds
    - Battles
    - Battles Won / Lost
    - Battles for Evolution

- `digimon-tamagotchi-frontend/src/data/stats.js` (수정)
  - `initializeStats` 함수에서 새 필드 초기화 로직 추가:
    - 진화 시 리셋되는 필드: `overfeeds`, `proteinOverdose`, `battlesForEvolution`, `careMistakes`
    - 진화 시 유지되는 필드: `energy`, `battles`, `battlesWon`, `battlesLost`, `winRate`

### 데이터 구조 확장

#### 추가된 필드
```javascript
{
  // 매뉴얼 기반 필드
  energy: 0,              // Energy/DP (기존 stamina와 병행)
  proteinOverdose: 0,     // 프로틴 과다 복용 횟수 (최대 7)
  overfeeds: 0,           // 오버피드 횟수 누적
  battles: 0,             // 총 배틀 횟수
  battlesWon: 0,          // 총 승리 횟수
  battlesLost: 0,         // 총 패배 횟수
  battlesForEvolution: 0, // 진화를 위한 배틀 횟수 (진화 시 리셋)
}
```

#### 초기화 로직
- **진화 시 리셋**: `overfeeds`, `proteinOverdose`, `battlesForEvolution`, `careMistakes`
- **진화 시 유지**: `energy`, `battles`, `battlesWon`, `battlesLost`, `winRate`

### UI 업데이트

#### StatsPanel.jsx
- Energy (DP) 표시 (stamina 대신 energy 우선 사용)
- 개발자용 정보 섹션 추가 (Protein Overdose, Overfeeds, Battles, Wins/Losses)

#### StatsPopup.jsx
- Energy (DP) 표시
- 매뉴얼 기반 필드 섹션 추가

### 호환성
- 기존 `stamina` 필드는 유지되어 하위 호환성 보장
- `energy`가 없으면 `stamina`를 사용하도록 fallback 처리

### 다음 단계
1. 배틀 시스템 구현 시 `battles`, `battlesWon`, `battlesLost` 필드 활용
2. 진화 조건 체크 시 `overfeeds`, `battlesForEvolution` 필드 활용
3. 프로틴 먹이기 로직에서 `proteinOverdose` 필드 활용 (이미 구현됨)
4. 오버피드 로직에서 `overfeeds` 필드 활용 (이미 구현됨)

---

## [2024-12-19] 스탯 로직(Hunger/Strength) 모듈화 및 매뉴얼 규칙 적용

### 작업 유형
- 로직 모듈화
- 매뉴얼 규칙 적용
- 코드 리팩토링

### 목적 및 영향
Game.jsx에 하드코딩되어 있던 배고픔/힘 감소 로직을 매뉴얼 기반 순수 함수로 모듈화했습니다. 오버피드, 프로틴 효과 등 매뉴얼 규칙을 정확히 반영하여 게임 로직의 정확성과 유지보수성을 향상시켰습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/logic/stats/hunger.js` (수정)
  - `handleHungerTick`: 시간 경과에 따른 배고픔 감소 처리
    - 오버피드 상태면 감소 지연 로직 포함 (매뉴얼: "Overfeeding will give you one extra Hunger Loss cycle")
    - 배고픔이 0이 되면 시간 기록
  - `feedMeat`: 고기 먹기 처리
    - Hunger +1, Weight +1 (매뉴얼 규칙)
    - 배고픔이 가득 찬 상태에서 10개 더 먹으면 오버피드 발생
    - 오버피드 카운트 추적
  - `willRefuseMeat`: 고기 거부 체크

- `digimon-tamagotchi-frontend/src/logic/stats/strength.js` (신규)
  - `handleStrengthTick`: 시간 경과에 따른 힘 감소 처리
    - 힘이 0이 되면 시간 기록
  - `feedProtein`: 프로틴 먹기 처리
    - Strength +1, Weight +2 (매뉴얼 규칙)
    - 4개마다 Energy +1, Protein Overdose +1 (매뉴얼 규칙)
  - `willRefuseProtein`: 프로틴 거부 체크

- `digimon-tamagotchi-frontend/src/logic/stats/index.js` (수정)
  - `handleHungerTick`, `feedMeat`, `willRefuseMeat` export 추가
  - `handleStrengthTick`, `feedProtein`, `willRefuseProtein` export 추가

- `digimon-tamagotchi-frontend/src/pages/Game.jsx` (수정)
  - 클라이언트 타이머에서 `handleHungerTick`, `handleStrengthTick` 사용
  - `handleFeed` 함수에서 `willRefuseMeat`, `willRefuseProtein` 사용
  - `applyEatResult` 함수를 `feedMeat`, `feedProtein` 사용하도록 변경
  - 배고픔/힘이 0이고 12시간 경과 시 사망 체크 로직 추가

- `digimon-tamagotchi-frontend/src/data/stats.js` (수정)
  - `updateLifespan` 함수에서 배고픔/힘 감소 로직 제거
  - 이제 `lifespanSeconds`, `timeToEvolveSeconds`, `poop`만 처리
  - 배고픔/힘 감소는 `handleHungerTick`, `handleStrengthTick`에서 처리

### 매뉴얼 규칙 적용

#### 배고픔 (Hunger)
- **고기 먹기**: Hunger +1, Weight +1
- **오버피드**: 배고픔이 가득 찬 상태(5)에서 10개 더 먹으면 오버피드 발생
- **오버피드 효과**: "Overfeeding will give you one extra Hunger Loss cycle before one of your hearts drop"
- **거부**: 배고픔이 최대치(5 + maxOverfeed)에 도달하면 거부

#### 힘 (Strength)
- **프로틴 먹기**: Strength +1, Weight +2
- **프로틴 효과**: 4개마다 Energy +1, Protein Overdose +1 (최대 7)
- **거부**: 힘과 배고픔이 모두 가득 찬 경우 거부

### 코드 구조 개선

#### Before (하드코딩)
```javascript
// Game.jsx 내부
function applyEatResult(old, type) {
  let s = {...old};
  const limit = 5 + (s.maxOverfeed || 0);
  if(type === "meat") {
    if(s.fullness < limit) {
      s.fullness++;
      s.weight++;
    }
  } else {
    // ...
  }
  return s;
}
```

#### After (모듈화)
```javascript
// logic/stats/hunger.js
export function feedMeat(currentStats) {
  // 매뉴얼 규칙 정확히 반영
  // 오버피드 로직 포함
}

// Game.jsx
function applyEatResult(old, type) {
  if(type === "meat") {
    const result = feedMeat(old);
    return result.updatedStats;
  } else {
    const result = feedProtein(old);
    return result.updatedStats;
  }
}
```

### 장점
1. **매뉴얼 규칙 정확 반영**: 오버피드, 프로틴 효과 등이 정확히 구현됨
2. **코드 재사용성**: 순수 함수로 구현되어 테스트 및 재사용 용이
3. **유지보수성 향상**: 로직이 모듈화되어 수정 및 확장이 쉬움
4. **일관성**: 모든 곳에서 동일한 로직 사용

### 주의사항
- `applyLazyUpdate` 함수는 아직 기존 로직을 사용 중 (별도 리팩토링 필요)
- `updateLifespan`에서 배고픔/힘 감소 로직을 제거했으므로, 다른 곳에서 사용 시 주의 필요

### 다음 단계
1. `applyLazyUpdate` 함수도 새 로직을 사용하도록 리팩토링
2. 배고픔/힘이 0이고 12시간 경과 시 사망 로직을 `handleHungerTick`, `handleStrengthTick` 내부로 이동
3. 테스트 코드 작성

---

## [2024-12-19] 데이터 소스 마이그레이션 (v1)

### 작업 유형
- 데이터 소스 변경
- 호환성 어댑터 구현
- 점진적 마이그레이션

### 목적 및 영향
Game.jsx에서 옛날 데이터 파일(`digimondata_digitalmonstercolor25th_ver1.js`) 대신 새로 만든 데이터 파일(`data/v1/digimons.js`)을 사용하도록 변경했습니다. 기존 코드와의 호환성을 위해 어댑터 패턴을 적용하여 필드명 차이를 해결했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/data/v1/adapter.js` (신규)
  - 새 데이터 구조를 옛날 구조로 변환하는 호환성 어댑터
  - `adaptNewDataToOldFormat`: 단일 디지몬 데이터 변환
  - `adaptDataMapToOldFormat`: 전체 데이터 맵 변환
  - 필드 매핑:
    - `sprite` → `sprite` (동일)
    - `stage` → `evolutionStage`
    - `evolutionCriteria.timeToEvolveSeconds` → `timeToEvolveSeconds`
    - `stats.hungerCycle` → `hungerTimer`
    - `stats.strengthCycle` → `strengthTimer`
    - `stats.poopCycle` → `poopTimer`
    - `stats.maxOverfeed` → `maxOverfeed`
    - `stats.minWeight` → `minWeight`
    - `stats.maxEnergy` → `maxStamina`

- `digimon-tamagotchi-frontend/src/pages/Game.jsx` (수정)
  - 옛날 데이터 import 제거: `import { digimonDataVer1 } from "../data/digimondata_digitalmonstercolor25th_ver1"`
  - 새 데이터 import 추가: `import { digimonDataVer1 as newDigimonDataVer1 } from "../data/v1/digimons"`
  - 어댑터 import: `import { adaptDataMapToOldFormat } from "../data/v1/adapter"`
  - 어댑터를 통해 변환된 데이터 사용: `const digimonDataVer1 = adaptDataMapToOldFormat(newDigimonDataVer1)`

### 호환성 전략
- **어댑터 패턴 적용**: 새 데이터 구조를 옛날 구조로 변환하여 기존 코드 수정 최소화
- **점진적 마이그레이션**: Game.jsx의 다른 부분은 수정하지 않고, 데이터 소스만 변경
- **필드 매핑**: 새 구조의 중첩된 객체(`stats`, `evolutionCriteria`)를 옛날 구조의 평면 필드로 변환

### 장점
1. **코드 수정 최소화**: Game.jsx의 대부분 코드를 수정하지 않고 데이터 소스만 변경
2. **기존 기능 유지**: 어댑터를 통해 기존 로직이 그대로 작동
3. **점진적 마이그레이션**: 나중에 Game.jsx를 새 구조에 맞게 리팩토링 가능
4. **데이터 소스 통일**: 새로 만든 매뉴얼 기반 데이터 구조 사용

### 단점
1. **중간 변환 단계**: 어댑터를 통해 변환하므로 약간의 성능 오버헤드 (무시 가능한 수준)
2. **임시 해결책**: 어댑터는 임시 해결책이며, 장기적으로는 Game.jsx를 새 구조에 맞게 리팩토링 필요
3. **필드 매핑 복잡도**: 새 구조와 옛날 구조의 차이로 인한 매핑 로직 필요

### 예상 문제점 및 해결 방안
1. **누락된 필드**: 새 데이터에 없는 필드가 옛날 코드에서 사용될 경우
   - 해결: 어댑터에서 기본값(0 또는 null) 반환
2. **타입 불일치**: 새 데이터의 타입이 옛날 코드와 다를 경우
   - 해결: 어댑터에서 타입 변환 처리
3. **데이터 불완전성**: 새 데이터에 일부 디지몬이 아직 추가되지 않은 경우
   - 해결: 어댑터에서 null 체크 및 fallback 처리
4. **진화 조건 차이**: 새 구조의 `evolutionCriteria`가 옛날 구조와 다를 경우
   - 해결: `evolutionConditionsVer1`은 여전히 옛날 파일 사용 (별도 마이그레이션 필요)

### 테스트 필요 사항
- [ ] 게임 화면에서 디지몬이 정상적으로 표시되는지 확인
- [ ] 진화 기능이 정상 작동하는지 확인
- [ ] 스탯 업데이트가 정상 작동하는지 확인
- [ ] 먹이기, 훈련 등 모든 기능이 정상 작동하는지 확인

### 다음 단계
1. Game.jsx를 새 데이터 구조에 맞게 전면 리팩토링 (어댑터 제거)
2. `evolutionConditionsVer1`도 새 구조로 마이그레이션
3. 다른 컴포넌트들도 새 데이터 구조 사용하도록 변경

---

## [2024-12-19] 폴더 구조 재설계 및 매뉴얼 기반 데이터 스키마 정의

### 작업 유형
- 프로젝트 구조 재설계
- 데이터 스키마 정의
- 로직 모듈화
- 문서화

### 목적 및 영향
Digital Monster Color 매뉴얼을 기반으로 프로젝트 구조를 재설계하고, 상세한 데이터 스키마와 로직 모듈을 정의했습니다:
- 버전별/기능별 폴더 구조로 코드 조직화
- 매뉴얼 기반 상세 데이터 스키마 정의
- 로직 모듈화로 유지보수성 향상
- Humulos 스타일 복잡한 육성 시스템 구현을 위한 기반 마련

### 변경된 파일
- **새 폴더 구조 생성**:
  - `src/data/v1/` - Ver.1 데이터 파일들
  - `src/logic/stats/` - 스탯 관리 로직
  - `src/logic/food/` - 음식 관련 로직
  - `src/logic/training/` - 훈련 관련 로직
  - `src/logic/battle/` - 배틀 관련 로직
  - `src/logic/evolution/` - 진화 관련 로직

- `docs/DIGITAL_MONSTER_COLOR_MANUAL.md` (신규)
  - Digital Monster Color 공식 매뉴얼을 마크다운 형식으로 저장
  - 모든 게임 메커니즘 문서화

- `src/data/v1/defaultStats.js` (신규)
  - 매뉴얼 기반 기본 스탯 정의
  - 표시되는 스탯: age, weight, hunger, strength, effort, energy, winRatio
  - 숨겨진 스탯: type, power, basePower, careMistakes, proteinOverdose, injuries 등
  - 진화 시 리셋되는 스탯: trainings, overfeeds, sleepDisturbances, battlesForEvolution 등

- `src/data/v1/digimons.js` (신규)
  - 매뉴얼 기반 상세 디지몬 데이터 스키마
  - 필수 필드: id, name, stage, sprite
  - stats 객체: hungerCycle, strengthCycle, poopCycle, maxOverfeed, basePower, maxEnergy, minWeight, type
  - evolutionCriteria 객체: mistakes, trainings, overfeeds, battles, winRatio, minWeight, minStrength, minEffort, requiredType

- `src/data/v1/evolution.js` (신규)
  - 매뉴얼 기반 진화 조건 정의
  - 복합 조건 체크 함수 구조

- `src/logic/stats/stats.js` (신규)
  - 스탯 초기화 및 업데이트 로직
  - initializeStats, updateLifespan, updateAge, applyLazyUpdate 함수

- `src/logic/stats/hunger.js` (신규)
  - 배고픔 관리 로직
  - feedMeat, checkOverfeed, decreaseHunger 함수

- `src/logic/food/meat.js` (신규)
  - 고기 먹이기 로직
  - 매뉴얼: "add one heart to the hunger meter, and add one gigabyte to their weight"
  - 오버피드 체크: "feeding 10 more meat after having full hearts"

- `src/logic/food/protein.js` (신규)
  - 프로틴 먹이기 로직
  - 매뉴얼: "add one heart to the strength meter and two gigabytes to their weight"
  - "Every four Protein will increase your Energy and Protein Overdose by 1 each"

- `src/logic/training/train.js` (신규)
  - 훈련 로직 (Ver.1-Ver.5)
  - 매뉴얼: "Every four trainings will add one Effort Heart"
  - "Your Digimon will also lose 1 gigabyte of weight every time they train"
  - "If training is successful, you will also gain a strength heart"

- `src/logic/battle/hitrate.js` (신규)
  - 배틀 히트레이트 계산 로직
  - 매뉴얼 공식: `hitrate = ((playerPower * 100)/(playerPower + opponentPower)) + attributeAdvantage`
  - 속성 상성 계산: Vaccine > Virus > Data > Vaccine
  - 파워 계산: Base Power + Strength Hearts 보너스 + Traited Egg 보너스
  - 부상 확률 계산: 승리 20%, 패배 10% + (프로틴 과다 * 10%)

- `src/logic/evolution/index.js` (신규)
  - 진화 조건 체크 로직
  - 매뉴얼 기반 복합 조건 체크: mistakes, trainings, overfeeds, battles, winRatio, minWeight, minStrength, minEffort, requiredType

- 각 폴더의 `index.js` 파일들 (신규)
  - 통합 export를 위한 인덱스 파일

### 새로운 폴더 구조
```
src/
  data/
    v1/
      defaultStats.js      # 기본 스탯 정의
      digimons.js          # 디지몬 데이터 스키마
      evolution.js         # 진화 조건 정의
      index.js             # 통합 export
    # 기존 파일들은 호환성을 위해 유지
  
  logic/
    stats/
      stats.js             # 스탯 관리 로직
      hunger.js            # 배고픔 관리 로직
      index.js             # 통합 export
    food/
      meat.js              # 고기 먹이기 로직
      protein.js           # 프로틴 먹이기 로직
      index.js             # 통합 export
    training/
      train.js             # 훈련 로직 (Ver.1-Ver.5)
      index.js             # 통합 export
    battle/
      hitrate.js           # 배틀 히트레이트 계산
      index.js             # 통합 export
    evolution/
      index.js             # 진화 조건 체크 로직
```

### 데이터 스키마 정의

#### 디지몬 데이터 스키마 (digimons.js)
```javascript
{
  id: "Agumon",
  name: "Agumon",
  stage: "Child",
  sprite: 240,
  stats: {
    hungerCycle: 5,        // 배고픔 감소 주기 (분)
    strengthCycle: 5,      // 힘 감소 주기 (분)
    poopCycle: 120,        // 똥 생성 주기 (분, Stage별로 다름)
    maxOverfeed: 4,        // 최대 오버피드 허용치
    basePower: 0,          // 기본 파워
    maxEnergy: 100,        // 최대 에너지 (DP)
    minWeight: 10,         // 최소 체중
    type: "Vaccine",       // 속성
  },
  evolutionCriteria: {
    timeToEvolveSeconds: 86400,  // 24시간
    mistakes: { max: 3 },          // 실수 3개 이하
    battles: 15,                  // 최소 15번 배틀
    winRatio: 40,                 // 최소 40% 승률
    // ... 기타 조건
  },
}
```

#### 기본 스탯 스키마 (defaultStats.js)
- **표시되는 스탯**: age, weight, hunger, strength, effort, energy, winRatio
- **숨겨진 스탯**: type, power, basePower, careMistakes, proteinOverdose, injuries, battlesWon, battlesLost
- **진화 시 리셋**: trainings, overfeeds, sleepDisturbances, battlesForEvolution, careMistakes, proteinOverdose, injuries

### 로직 모듈화

#### Stats 로직 (logic/stats/)
- `stats.js`: 스탯 초기화 및 시간 경과 처리
- `hunger.js`: 배고픔 관리 (고기 먹기, 오버피드 체크)

#### Food 로직 (logic/food/)
- `meat.js`: 고기 먹이기 (배고픔 +1, 체중 +1, 오버피드 체크)
- `protein.js`: 프로틴 먹이기 (힘 +1, 체중 +2, 4개당 Energy +1, Protein Overdose +1)

#### Training 로직 (logic/training/)
- `train.js`: Ver.1-Ver.5 훈련 로직
- Ver.1: 5라운드 중 3회 이상 성공 시 훈련 성공
- 4회 훈련마다 effort +1
- 훈련 시 체중 -1 (성공 시 힘 +1/+3)

#### Battle 로직 (logic/battle/)
- `hitrate.js`: 히트레이트 계산, 속성 상성, 파워 계산, 부상 확률

#### Evolution 로직 (logic/evolution/)
- `index.js`: 복합 진화 조건 체크 (mistakes, trainings, overfeeds, battles, winRatio 등)

### 매뉴얼 반영 사항

#### Status 섹션
- Age, Weight, Hunger, Strength, Effort, Energy, Win Ratio 구현
- Type (속성), Power, Care Mistakes, Protein Overdose 구현

#### Food 섹션
- Meat: 배고픔 +1, 체중 +1, 오버피드 로직
- Protein: 힘 +1, 체중 +2, 4개당 Energy +1, Protein Overdose +1

#### Training 섹션
- Ver.1 훈련 로직 구현
- 4회 훈련마다 effort +1
- 훈련 시 체중 감소, 성공 시 힘 증가

#### Battles 섹션
- 히트레이트 공식 구현
- 속성 상성 계산 (Vaccine > Virus > Data > Vaccine)
- 파워 보너스 계산 (Strength Hearts, Traited Egg)
- 부상 확률 계산

#### Evolution 섹션
- 진화 시간표 반영 (8초, 10분, 12시간, 24시간, 36시간, 48시간)
- 복합 진화 조건 구조 정의 (mistakes, trainings, overfeeds, battles, winRatio 등)

### 호환성 유지
- 기존 파일들은 호환성을 위해 유지
- 새 구조와 기존 구조를 병행 사용 가능
- 점진적 마이그레이션 가능

### 다음 단계
1. 기존 코드의 import 경로를 새 구조로 점진적 변경
2. 매뉴얼의 모든 디지몬 데이터 추가
3. 진화 조건 로직 완전 구현
4. 배틀 시스템 구현
5. 자동 진화 시스템 구현

### 참고사항
- 매뉴얼은 `docs/DIGITAL_MONSTER_COLOR_MANUAL.md`에 저장
- 새 스키마는 매뉴얼의 모든 규칙을 반영하도록 설계
- 로직 모듈은 매뉴얼의 각 섹션(Status, Food, Training, Battles)을 기반으로 구성
- 기존 코드와의 호환성을 위해 기존 파일 유지

---

## [2024-12-19] 클라이언트 타이머 도입 및 실시간 UI 업데이트 구현

### 작업 유형
- 실시간 UI 업데이트
- 클라이언트 사이드 타이머 구현
- 사용자 경험 개선

### 목적 및 영향
사용자가 게임을 플레이하는 동안 Time to Evolve, Lifespan, Waste(똥) 등의 시간 관련 스탯이 실시간으로 업데이트되도록 클라이언트 타이머를 도입했습니다:
- 1초마다 UI가 실시간으로 업데이트되어 사용자가 시간 경과를 즉시 확인 가능
- 똥이 실시간으로 쌓이는 모습을 UI에 반영
- Firestore 쓰기 작업은 사용자 액션 시에만 실행하여 비용 절감

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - **updateLifespan import 추가**: `stats.js`에서 `updateLifespan` 함수 import
  - **클라이언트 타이머 구현**: `useEffect`와 `setInterval`을 사용하여 1초마다 UI 업데이트
  - **함수형 업데이트 사용**: `setDigimonStats`에 함수형 업데이트를 사용하여 최신 상태 참조
  - **사망 상태 체크**: 사망한 경우 타이머 중지
  - **메모리 누수 방지**: `useEffect` cleanup 함수에서 `clearInterval` 호출

### 주요 변경사항

#### Game.jsx - 클라이언트 타이머 구현
- **타이머 설정**: `useEffect` 내에서 `setInterval`로 1초마다 실행되는 타이머 생성
- **updateLifespan 호출**: 매초 `updateLifespan(prevStats, 1)` 호출하여 1초 경과 처리
- **실시간 UI 업데이트**: 
  - `lifespanSeconds` 증가
  - `timeToEvolveSeconds` 감소
  - `fullness` 감소 (hungerTimer에 따라)
  - `health` 감소 (strengthTimer에 따라)
  - `poopCount` 증가 (poopTimer에 따라)
- **사망 감지**: 사망 상태 변경 시 `setShowDeathConfirm(true)` 호출
- **메모리 상태만 업데이트**: Firestore 쓰기 작업 없이 메모리 상태만 업데이트

#### stats.js - updateLifespan 함수 활용
- 기존 `updateLifespan` 함수를 활용하여 1초 경과 처리
- 배고픔, 건강, 똥(poop) 누적 로직이 이미 구현되어 있음
- 사망 조건 처리 포함

### 타이머 동작 방식
1. **타이머 시작**: 컴포넌트 마운트 시 `useEffect` 실행
2. **1초마다 실행**: `setInterval`로 1초마다 콜백 함수 실행
3. **상태 업데이트**: `updateLifespan`으로 1초 경과 처리 후 `setDigimonStats` 호출
4. **UI 반영**: React가 상태 변경을 감지하여 UI 자동 업데이트
5. **타이머 정리**: 컴포넌트 언마운트 시 `clearInterval`로 타이머 제거

### 실시간 업데이트 항목
- **Time to Evolve**: 매초 1초씩 감소
- **Lifespan**: 매초 1초씩 증가
- **Fullness**: `hungerTimer`에 따라 주기적으로 감소
- **Health**: `strengthTimer`에 따라 주기적으로 감소
- **Poop Count**: `poopTimer`에 따라 주기적으로 증가 (최대 8개)
- **Care Mistakes**: 똥이 8개인 상태로 8시간 경과 시 증가

### Firestore 쓰기 전략
- **클라이언트 타이머**: 메모리 상태만 업데이트 (Firestore 쓰기 없음)
- **사용자 액션**: 먹이주기, 훈련하기, 진화하기, 청소하기 등 액션 시에만 Firestore에 저장
- **비용 절감**: 매초 Firestore 쓰기를 하지 않아 비용 절감 및 성능 향상

### 메모리 누수 방지
- **useEffect cleanup**: 컴포넌트 언마운트 시 `clearInterval(timer)` 호출
- **사망 시 중지**: `digimonStats.isDead`가 true일 때 타이머 중지
- **함수형 업데이트**: `setDigimonStats`에 함수형 업데이트를 사용하여 최신 상태 참조

### 사용자 경험 개선
- **실시간 피드백**: 시간 경과를 즉시 확인 가능
- **시각적 효과**: 똥이 실시간으로 쌓이는 모습을 UI에 반영
- **반응성 향상**: 1초마다 UI가 업데이트되어 게임이 살아있는 느낌 제공

### 참고사항
- `updateLifespan` 함수는 `stats.js`에 이미 구현되어 있어 재사용
- Firestore 쓰기는 사용자 액션 시에만 실행되므로 비용 효율적
- 함수형 업데이트를 사용하여 타이머가 매초 재설정되지 않도록 최적화
- 사망한 디지몬은 타이머가 중지되어 불필요한 업데이트 방지

---

## [2024-12-19] 데이터 저장 완료 후 페이지 이동 및 로딩 상태 관리 개선

### 작업 유형
- 비동기 로직 개선
- 에러 처리 강화
- 사용자 경험 개선
- 로딩 상태 관리

### 목적 및 영향
데이터 저장이 완료된 후에만 페이지 이동하도록 보장하고, Game.jsx에서 데이터 로딩이 완료될 때까지 불필요한 리디렉션을 방지하도록 개선했습니다:
- 데이터 저장 실패 시 페이지 이동 방지
- 명확한 에러 메시지 제공
- 로딩 상태 표시로 사용자 경험 개선
- 데이터 로딩 완료 전 리디렉션 방지

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
  - **비동기 로직 개선**: `handleNewTama` 함수에서 데이터 저장 완료 후에만 `navigate` 호출
  - **저장 성공 확인**: `saveSuccess` 플래그를 사용하여 저장 성공 여부 확인
  - **에러 처리 강화**: localStorage 저장 시도/캐치 추가
  - **페이지 이동 조건**: `saveSuccess && slotId`가 모두 true일 때만 페이지 이동
  - **에러 발생 시 처리**: 에러 발생 시 알림 표시 후 `return`으로 페이지 이동 방지

- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - **로딩 상태 관리**: `isLoadingSlot` state 추가하여 슬롯 데이터 로딩 상태 추적
  - **로딩 표시**: 데이터 로딩 중일 때 로딩 스피너와 메시지 표시
  - **리디렉션 개선**: Firebase 모드에서 로그인 체크 시 로딩 상태를 false로 설정한 후 리디렉션
  - **에러 처리**: try/catch/finally 블록으로 에러 발생 시에도 로딩 상태 해제
  - **데이터 로딩 완료 보장**: `finally` 블록에서 항상 `setIsLoadingSlot(false)` 호출

### 주요 변경사항

#### SelectScreen.jsx - handleNewTama 함수
- **저장 성공 확인**: `saveSuccess` 플래그로 Firestore 또는 localStorage 저장 성공 여부 확인
- **localStorage 에러 처리**: localStorage 저장 시도/캐치로 저장 실패 시 에러 발생
- **조건부 페이지 이동**: `if (saveSuccess && slotId)` 조건으로 저장 성공 시에만 페이지 이동
- **에러 시 처리**: catch 블록에서 에러 메시지 표시 후 `return`으로 함수 종료

#### Game.jsx - 슬롯 로드 로직
- **로딩 상태 추가**: `const [isLoadingSlot, setIsLoadingSlot] = useState(true)` 추가
- **로딩 시작**: `loadSlot` 함수 시작 시 `setIsLoadingSlot(true)` 호출
- **로딩 완료**: `finally` 블록에서 `setIsLoadingSlot(false)` 호출
- **로딩 UI**: `isLoadingSlot`이 true일 때 로딩 스피너와 메시지 표시
- **리디렉션 개선**: Firebase 모드에서 로그인 체크 시 로딩 상태를 false로 설정한 후 리디렉션

### 데이터 저장 흐름
1. **SelectScreen**: "새 다마고치 시작" 버튼 클릭
2. **슬롯 찾기**: 빈 슬롯 찾기
3. **데이터 저장**: Firestore 또는 localStorage에 데이터 저장
4. **저장 성공 확인**: `saveSuccess` 플래그로 저장 성공 여부 확인
5. **페이지 이동**: 저장 성공 시에만 `/game/${slotId}`로 이동

### 데이터 로딩 흐름
1. **Game.jsx 마운트**: `isLoadingSlot = true`로 시작
2. **모드 확인**: Firebase 모드인지 localStorage 모드인지 확인
3. **데이터 로드**: Firestore 또는 localStorage에서 슬롯 데이터 로드
4. **로딩 완료**: `finally` 블록에서 `isLoadingSlot = false`로 설정
5. **UI 표시**: 로딩 중일 때는 로딩 UI, 완료 후 게임 화면 표시

### 사용자 경험 개선
- **명확한 피드백**: 데이터 저장 실패 시 명확한 에러 메시지 표시
- **로딩 표시**: 데이터 로딩 중 로딩 스피너로 진행 상황 표시
- **안정성 향상**: 데이터 저장 완료 전 페이지 이동 방지로 데이터 손실 방지
- **에러 처리**: 모든 에러 케이스에 대한 적절한 처리

### 참고사항
- localStorage 저장은 동기 작업이지만, 에러 발생 가능성을 고려하여 try/catch로 감쌈
- Firestore 저장은 비동기 작업이므로 `await`로 완료 대기
- 로딩 상태는 `finally` 블록에서 항상 해제하여 무한 로딩 방지
- Firebase 모드에서 로그인 체크 실패 시에도 로딩 상태를 해제한 후 리디렉션

---

## [2024-12-19] 전역 인증 상태 관리 개선 및 리디렉션 로직 정리

### 작업 유형
- 인증 상태 관리 개선
- 사용자 경험 개선
- 코드 정리

### 목적 및 영향
AuthContext의 `onAuthStateChanged` 리스너를 활용하여 전역 인증 상태를 관리하고, SelectScreen에서 자동으로 인증 상태를 감지하여 리디렉션하도록 개선했습니다:
- 전역 인증 상태 구독을 통한 자동 리디렉션
- 불필요한 팝업 제거로 사용자 경험 개선
- 로그인 성공 후 단순한 리디렉션으로 코드 단순화

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
  - **전역 인증 상태 구독**: AuthContext의 `currentUser`를 구독하여 자동으로 인증 상태 감지
  - **자동 리디렉션**: Firebase 모드에서 `currentUser`가 null일 경우 자동으로 로그인 페이지로 리디렉션
  - **팝업 제거**: "로그인이 필요합니다" alert 제거, 대신 자동 리디렉션 사용
  - **handleNewTama 함수**: 버튼 클릭 시에도 인증 체크하되 팝업 없이 리디렉션

- `digimon-tamagotchi-frontend/src/pages/Login.jsx`
  - **로그인 성공 리디렉션**: 로그인 성공 시 단순히 `/select`로 이동
  - **state 전달 제거**: `navigate("/select", { state: { mode: 'firebase' } })` → `navigate("/select")`
  - **로컬 모드 리디렉션**: localStorage 모드로 이동할 때도 state 전달 제거

### 주요 변경사항

#### SelectScreen.jsx
- **전역 인증 상태 구독**: `useAuth()` 훅으로 `currentUser`를 구독
- **자동 리디렉션 로직**: `useEffect`에서 `currentUser`가 null이고 Firebase 모드일 경우 자동으로 `/`로 리디렉션
- **팝업 제거**: `alert("로그인이 필요합니다.")` 제거
- **handleNewTama 함수**: 버튼 클릭 시에도 인증 체크하되 팝업 없이 리디렉션

#### Login.jsx
- **로그인 성공 처리**: Firestore에 유저 정보 저장 후 단순히 `/select`로 이동
- **state 전달 제거**: AuthContext의 `onAuthStateChanged` 리스너가 자동으로 `currentUser`를 업데이트하므로 별도 state 전달 불필요
- **로컬 모드 리디렉션**: localStorage 모드로 이동할 때도 state 전달 제거

### 인증 상태 관리 흐름
1. **AuthContext**: `onAuthStateChanged` 리스너가 Firebase 인증 상태 변경을 감지
2. **전역 상태 업데이트**: 인증 상태 변경 시 `currentUser` 상태 자동 업데이트
3. **SelectScreen 구독**: `useAuth()` 훅으로 `currentUser` 구독
4. **자동 리디렉션**: `currentUser`가 null이고 Firebase 모드일 경우 자동으로 로그인 페이지로 리디렉션

### 사용자 경험 개선
- **자동 리디렉션**: 로그인하지 않은 상태에서 SelectScreen 접근 시 자동으로 로그인 페이지로 이동
- **팝업 제거**: 불필요한 "로그인이 필요합니다" 팝업 제거로 더 부드러운 사용자 경험
- **상태 동기화**: AuthContext의 전역 상태를 통해 모든 컴포넌트에서 일관된 인증 상태 유지

### 참고사항
- AuthContext는 이미 `onAuthStateChanged` 리스너를 사용하여 전역 인증 상태를 관리하고 있음
- SelectScreen은 이 전역 상태를 구독하여 자동으로 인증 상태를 감지
- 로그인 성공 후 별도의 state 전달 없이도 SelectScreen에서 자동으로 인증 상태를 인식
- 로컬 모드(`mode === 'local'`)로 온 경우는 인증 체크를 건너뜀

---

## [2024-12-19] Backend 폴더 제거 및 프로젝트 정리

### 작업 유형
- 프로젝트 구조 정리
- 불필요한 파일 제거
- 아키텍처 단순화

### 목적 및 영향
프로젝트가 Firebase/Vercel 서버리스 아키텍처로 완전히 전환되었으므로, 더 이상 필요하지 않은 Express 기반 백엔드 폴더를 제거했습니다:
- Express 서버 및 관련 의존성 제거
- 프로젝트 구조 단순화
- 순수한 React + Firebase 클라이언트 앱으로 정리

### 변경된 파일
- **backend/** 폴더 전체 삭제
  - `server.js` (Express 서버 파일)
  - `package.json` (백엔드 의존성)
  - `node_modules/` (백엔드 의존성 패키지)
  - `build/` (빌드 결과물)

- `digimon-tamagotchi-frontend/package.json`
  - 확인 결과: 백엔드 관련 스크립트 없음 (이미 정리되어 있음)
  - 현재 스크립트: `start`, `build`, `test`, `eject` (순수 React 앱 스크립트만 유지)
  - `concurrently`, `server`, `start-dev` 등의 백엔드 관련 스크립트 없음

### 제거된 내용
- Express 서버 (`server.js`)
- node-cron (서버 사이드 스케줄링)
- cross-fetch (서버 사이드 HTTP 요청)
- Express 관련 의존성 및 설정

### 프로젝트 구조 변화
**Before:**
```
d2_tama_refact/
  ├── backend/          # Express 서버 (제거됨)
  │   ├── server.js
  │   ├── package.json
  │   └── node_modules/
  └── digimon-tamagotchi-frontend/
      └── package.json
```

**After:**
```
d2_tama_refact/
  └── digimon-tamagotchi-frontend/
      └── package.json  # 순수 React 앱만 유지
```

### 주요 변경사항

#### Backend 폴더 삭제
- Express 기반 백엔드 서버 전체 제거
- 서버 사이드 의존성 제거 (node-cron, express, cross-fetch)
- 빌드 결과물 및 node_modules 제거

#### Package.json 확인
- 백엔드 관련 스크립트 없음 확인
- 순수 React 앱 스크립트만 유지:
  - `start`: React 개발 서버 시작
  - `build`: React 앱 빌드
  - `test`: 테스트 실행
  - `eject`: Create React App eject

### 아키텍처 정리
프로젝트가 완전히 서버리스 아키텍처로 전환되었습니다:
- **클라이언트**: React 앱 (Firebase SDK 사용)
- **백엔드**: Firebase (Firestore + Authentication + Serverless Functions)
- **호스팅**: Vercel (프론트엔드) + Firebase (백엔드)

### 참고사항
- Express 서버는 더 이상 필요하지 않음 (Firebase로 완전 전환)
- 모든 데이터 저장/인증은 Firebase를 통해 처리
- Lazy Update 패턴으로 서버 사이드 스케줄링 불필요
- 프로젝트가 순수한 클라이언트 앱으로 단순화됨

---

## [2024-12-19] Google 로그인 계정 선택 강제 및 로그아웃 기능 추가

### 작업 유형
- 기능 개선
- 테스트 환경 개선
- 사용자 경험 향상

### 목적 및 영향
테스트 환경 개선을 위해 Google 로그인 시 매번 계정 선택 창이 뜨도록 하고, 게임 내에서 로그아웃할 수 있는 기능을 추가했습니다:
- Google 로그인 시 `prompt: 'select_account'` 옵션을 강제하여 매번 계정 선택 창 표시
- SettingsModal에 로그아웃 버튼 추가로 게임 중간에 계정 전환 가능
- 로그아웃 후 자동으로 로그인 페이지로 리디렉션

### 변경된 파일
- `digimon-tamagotchi-frontend/src/contexts/AuthContext.jsx`
  - **Google 로그인 개선**: `GoogleAuthProvider`에 `setCustomParameters({ prompt: 'select_account' })` 추가
  - 매번 로그인 시 계정 선택 창이 표시되어 테스트 시 여러 계정 전환 용이

- `digimon-tamagotchi-frontend/src/components/SettingsModal.jsx`
  - **로그아웃 기능 추가**: `useAuth` 훅으로 `logout`, `isFirebaseAvailable`, `currentUser` 가져오기
  - **로그아웃 버튼**: Firebase 모드에서만 표시되는 로그아웃 버튼 추가
  - **리디렉션**: 로그아웃 성공 시 `navigate("/")`로 로그인 페이지로 이동
  - **에러 처리**: 로그아웃 실패 시 에러 메시지 표시

### 주요 변경사항

#### AuthContext.jsx
- `signInWithGoogle()` 함수에서 `provider.setCustomParameters({ prompt: 'select_account' })` 추가
- 매번 로그인 시 Google 계정 선택 창이 표시되어 테스트 환경 개선

#### SettingsModal.jsx
- `useNavigate()` 훅 추가로 페이지 이동 기능 구현
- `useAuth()` 훅으로 인증 관련 함수 및 상태 가져오기
- Firebase 모드에서만 로그아웃 버튼 표시 (조건부 렌더링)
- 로그아웃 버튼 클릭 시 `logout()` 호출 후 로그인 페이지로 리디렉션
- 로그아웃 실패 시 사용자에게 알림 표시

### 사용자 경험 개선
- **계정 전환 용이**: 매번 계정 선택 창이 표시되어 여러 계정으로 테스트 가능
- **게임 중 로그아웃**: Settings 모달에서 바로 로그아웃하여 계정 전환 가능
- **테스트 효율성**: 개발 및 테스트 시 계정 전환이 간편해짐

### 참고사항
- `prompt: 'select_account'` 옵션은 Google OAuth의 표준 파라미터로, 매번 계정 선택 창을 강제로 표시
- 로그아웃 버튼은 Firebase 모드에서만 표시되며, localStorage 모드에서는 표시되지 않음
- 로그아웃 후 자동으로 로그인 페이지로 이동하여 새로운 계정으로 로그인 가능

---

## [2024-12-19] Firebase/LocalStorage 이중 모드 지원 구현

### 작업 유형
- 기능 추가
- 데이터 저장소 분기 처리
- 라우팅 상태 관리

### 목적 및 영향
사용자가 Firebase 인증 없이도 로컬 저장소 모드로 게임을 시작할 수 있도록 지원했습니다:
- SelectScreen에서 "로컬 저장소 모드 시작" 버튼 추가로 Firebase Auth 없이 게임 시작 가능
- Login.jsx는 Firebase 로그인만 전담하되, 로그인 후 mode: 'firebase' 상태 전달
- Game.jsx에서 mode 값(firebase/local)을 기반으로 데이터 저장 로직 분기 처리
- React Router의 location.state를 활용하여 페이지 간 mode 상태 전달

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
  - **로컬 모드 시작 버튼**: `handleNewTamaLocal()` 함수 추가
  - **로컬 모드 슬롯 생성**: localStorage에 초기 데이터 저장 후 Game.jsx로 이동 (mode: 'local')
  - **Firebase 모드 슬롯 생성**: 기존 로직 유지하되 Game.jsx로 이동 시 mode: 'firebase' 전달
  - **이어하기 기능**: 현재 모드에 따라 state에 mode 값 전달

- `digimon-tamagotchi-frontend/src/pages/Login.jsx`
  - **Firebase 로그인 후**: SelectScreen으로 이동 시 `navigate("/select", { state: { mode: 'firebase' } })` 전달
  - **로컬 모드 시작**: Firebase 미설정 시 SelectScreen으로 이동 시 mode: 'local' 전달

- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - **mode 상태 관리**: `useLocation()` 훅으로 location.state에서 mode 값 가져오기
  - **슬롯 로드 분기**: mode에 따라 Firestore 또는 localStorage에서 데이터 로드
  - **스탯 저장 분기**: `setDigimonStatsAndSave()` 함수에서 mode에 따라 Firestore 또는 localStorage 저장
  - **Lazy Update 분기**: `applyLazyUpdateBeforeAction()` 함수에서 mode에 따라 데이터 소스 선택
  - **디지몬 이름 저장 분기**: `setSelectedDigimonAndSave()` 함수에서 mode에 따라 저장 방식 분기
  - **청소 기능 분기**: `cleanCycle()` 함수에서 mode에 따라 저장 방식 분기

### 데이터 저장 로직 분기
Game.jsx의 모든 저장 작업이 mode 값에 따라 분기 처리됩니다:
- **mode === 'firebase'**: Firestore의 `users/{uid}/slots/{slotId}` 경로에 저장
- **mode === 'local'**: localStorage의 `slot{slotId}_*` 키에 저장

### 주요 변경사항

#### SelectScreen.jsx
- `handleNewTamaLocal()`: 로컬 모드로 새 다마고치 시작 (Firebase Auth 불필요)
- `handleNewTama()`: Firebase 모드로 새 다마고치 시작 (기존 로직 유지)
- `handleContinue()`: 현재 모드에 따라 state에 mode 값 전달
- UI에 "로컬 저장소 모드 시작" 버튼 추가

#### Login.jsx
- Firebase 로그인 성공 시 SelectScreen으로 이동할 때 mode: 'firebase' 전달
- localStorage 모드 시작 시 SelectScreen으로 이동할 때 mode: 'local' 전달

#### Game.jsx
- `mode` 변수: location.state에서 가져오거나, 기본값은 현재 인증 상태 기반
- 모든 데이터 저장/로드 작업이 mode 값에 따라 Firestore 또는 localStorage로 분기
- Lazy Update 로직도 mode에 따라 적절한 데이터 소스에서 마지막 저장 시간 조회

### 참고사항
- React Router v6의 `navigate(path, { state })`를 사용하여 페이지 간 상태 전달
- `useLocation()` 훅으로 전달받은 state 접근
- mode 값이 없을 경우 현재 인증 상태를 기반으로 자동 판단 (firebase 또는 local)
- Firebase 모드에서는 인증이 필수이며, 미인증 시 Login 페이지로 리디렉션

---

## [2024-12-19] localStorage 완전 제거 및 Firestore 전용 전환

### 작업 유형
- 코드 리팩토링
- 데이터 저장소 통합
- Lazy Update 최적화

### 목적 및 영향
Game.jsx에서 모든 localStorage 관련 코드를 제거하고 Firestore 전용으로 전환했습니다:
- Firebase 인증이 필수 조건이 되었으며, localStorage fallback 제거
- 모든 데이터 저장/로드가 Firestore의 `users/{uid}/slots/{slotId}` 경로로 통일
- 데이터 저장 시점 명확화: 로그인/슬롯 선택 시 로드, 먹이/훈련/진화/청소 시 저장
- Lazy Update 로직이 모든 액션 전에 적용되어 정확한 스탯 계산 보장

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - **슬롯 로드**: localStorage 분기 완전 제거, Firestore 전용으로 변경
  - **스탯 저장**: `setDigimonStatsAndSave()` 함수에서 localStorage 분기 제거
  - **Lazy Update**: `applyLazyUpdateBeforeAction()` 함수에서 localStorage 분기 제거
  - **디지몬 이름 저장**: `setSelectedDigimonAndSave()` 함수에서 localStorage 분기 제거
  - **청소 기능**: `cleanCycle()` 함수에서 `lastSavedAt` 필드 업데이트 추가
  - **먹이 기능**: `handleFeed()` 함수에서 업데이트된 스탯 기준으로 검증 로직 수정

### 데이터 저장 시점
다음 액션 시점에 Firestore에 자동 저장됩니다:
1. **슬롯 로드 시**: Lazy Update 적용 후 업데이트된 스탯 저장
2. **먹이 주기**: `setDigimonStatsAndSave()` 호출 시 저장
3. **훈련하기**: `setDigimonStatsAndSave()` 호출 시 저장
4. **진화하기**: `setDigimonStatsAndSave()` 호출 시 저장
5. **청소하기**: `cleanCycle()` 함수에서 직접 저장

### Lazy Update 적용
모든 액션 전에 `applyLazyUpdateBeforeAction()` 함수가 호출되어:
- Firestore에서 마지막 저장 시간(`lastSavedAt`) 조회
- 현재 시간과의 차이 계산
- `stats.js`의 `applyLazyUpdate()` 함수로 경과 시간만큼 스탯 차감
- 사망 상태 변경 감지 및 알림

### Firestore 데이터 구조
```
users/{uid}/slots/{slotId}
  - selectedDigimon: string
  - digimonStats: {
      ... (모든 스탯 필드)
      lastSavedAt: Date  // Lazy Update용 마지막 저장 시간
    }
  - slotName: string
  - createdAt: string
  - device: string
  - version: string
  - updatedAt: Timestamp
  - lastSavedAt: Timestamp  // 문서 레벨 마지막 저장 시간
```

### 주요 변경사항

#### Game.jsx
- **슬롯 로드**: Firebase 인증 필수, localStorage fallback 제거
- **스탯 저장**: 모든 저장 작업이 Firestore로 통일
- **액션 전 Lazy Update**: 모든 사용자 액션(먹이, 훈련, 진화, 청소) 전에 경과 시간 반영
- **에러 처리**: Firestore 작업 실패 시 콘솔 에러 로그만 출력 (사용자 경험 유지)

#### stats.js
- localStorage 관련 코드 없음 (변경 없음)
- `applyLazyUpdate()` 함수가 이미 Lazy Update 로직 구현
- `updateLifespan()` 함수는 유지 (필요 시 사용 가능)

### 성능 개선
- **Before**: localStorage와 Firestore 이중 분기 처리
- **After**: Firestore 단일 경로로 코드 단순화 및 유지보수성 향상
- 모든 액션 시점에만 저장하여 Firestore 쓰기 횟수 최소화

### 참고사항
- Firebase 인증이 필수 조건이 되었으므로, 로그인하지 않은 사용자는 SelectScreen으로 리디렉션
- `isFirebaseAvailable` 체크는 유지하여 Firebase 초기화 실패 시 안전하게 처리
- 모든 Firestore 작업은 비동기로 처리되어 UI 블로킹 방지

---

## [2024-12-19] Firebase Google 로그인 및 Firestore 직접 연동 구현

### 작업 유형
- 인증 시스템 구현
- Firestore 직접 연동
- 사용자별 데이터 분리

### 목적 및 영향
Firebase Authentication과 Firestore를 사용하여 사용자별 슬롯 데이터를 관리하도록 구현했습니다:
- Google 로그인을 통한 사용자 인증
- 로그인된 유저의 UID 기반으로 Firestore `/users/{uid}/slots` 컬렉션에서 데이터 관리
- Repository 패턴에서 Firestore 직접 호출로 전환하여 코드 명확성 향상

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/Login.jsx`
  - Firebase `signInWithPopup(GoogleAuthProvider)`를 사용한 Google 로그인 구현
  - `userSlotRepository` 제거, Firestore 직접 호출로 변경
  - `doc(db, 'users', user.uid)` + `setDoc`으로 유저 정보 저장
  - 로그인 성공 시 유저 UID를 사용하여 SelectScreen으로 리디렉션

- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
  - `userSlotRepository` 제거, Firestore 직접 호출로 변경
  - Firestore의 `collection(db, 'users', currentUser.uid, 'slots')`에서 슬롯 목록 가져오기
  - `doc(db, 'users', currentUser.uid, 'slots', 'slot{slotId}')`로 슬롯 CRUD 작업
  - `getDocs`, `setDoc`, `updateDoc`, `deleteDoc` 직접 사용

### Firestore 데이터 구조
```
users/
  {uid}/                    # 유저 UID
    email: string
    displayName: string
    photoURL: string
    createdAt: Timestamp
    updatedAt: Timestamp
    slots/                   # 서브컬렉션
      slot1/
        selectedDigimon: string
        digimonStats: {...}
        slotName: string
        createdAt: string
        device: string
        version: string
        updatedAt: Timestamp
        lastSavedAt: Timestamp
      slot2/
        ...
```

### 주요 변경사항

#### Login.jsx
- `signInWithPopup(auth, GoogleAuthProvider)` 사용
- 로그인 성공 후 `user.uid`를 사용하여 SelectScreen으로 리디렉션
- Firestore에 유저 정보 자동 저장

#### SelectScreen.jsx
- **슬롯 목록 로드**: `collection(db, 'users', uid, 'slots')` + `getDocs(query(...))`
- **슬롯 생성**: `doc(db, 'users', uid, 'slots', 'slot{id}')` + `setDoc`
- **슬롯 삭제**: `doc(...)` + `deleteDoc`
- **슬롯 이름 수정**: `doc(...)` + `updateDoc`

### 관련 파일
- `digimon-tamagotchi-frontend/src/contexts/AuthContext.jsx` - 인증 상태 관리
- `digimon-tamagotchi-frontend/src/firebase.js` - Firebase 초기화

### 참고사항
- 모든 Firestore 작업은 유저 UID 기반으로 수행
- Firestore 보안 규칙으로 유저별 데이터 접근 제어 필요
- localStorage 모드는 Firebase가 설정되지 않았을 때 fallback으로 동작

---

## [2024-12-19] localStorage → Firestore 직접 호출 리팩토링

### 작업 유형
- 데이터 저장소 마이그레이션
- 코드 리팩토링

### 목적 및 영향
Game.jsx에서 userSlotRepository를 사용하던 부분을 Firestore의 doc, getDoc, setDoc, updateDoc을 직접 사용하도록 변경했습니다. 이를 통해:
- Repository 추상화 레이어를 제거하고 Firestore를 직접 사용
- DigimonStats JSON 구조를 그대로 Firestore 문서에 저장
- 코드의 명확성과 직접성 향상

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - userSlotRepository import 제거
  - Firestore doc, getDoc, setDoc, updateDoc 직접 import
  - 슬롯 로드: getDoc 사용
  - 스탯 저장: updateDoc 사용 (매초 자동 저장 및 수동 저장)
  - 디지몬 이름 저장: updateDoc 사용
  - 청소 기능: updateDoc 사용

### Firestore 데이터 구조
```
users/{userId}/slots/{slotId}
  - selectedDigimon: string
  - digimonStats: DigimonStats (JSON 객체 전체)
  - slotName: string
  - createdAt: string
  - device: string
  - version: string
  - updatedAt: Timestamp
```

### 참고사항
- stats.js는 localStorage를 사용하지 않으므로 변경 없음
- 모든 Firestore 호출은 에러 처리를 포함
- 비동기 저장 작업은 사용자 경험에 영향을 주지 않도록 처리

---

## [2024-12-19] Lazy Update 로직 구현 (node-cron 제거)

### 작업 유형
- 아키텍처 변경
- 성능 최적화
- 서버리스 환경 대응

### 목적 및 영향
Vercel/Firebase 환경에서 node-cron의 비효율성을 해결하기 위해 Lazy Update 패턴을 도입했습니다:
- 매초 실행되던 타이머 제거 → 서버 리소스 절약
- 유저 접속/액션 시점에만 시간 경과 계산 및 스탯 업데이트
- 마지막 저장 시간(`lastSavedAt`) 기반으로 경과 시간 계산
- 서버리스 환경에 최적화된 구조

### 변경된 파일
- `digimon-tamagotchi-frontend/src/data/stats.js`
  - `applyLazyUpdate()` 함수 추가
  - 마지막 저장 시간부터 현재까지 경과 시간 계산
  - 배고픔, 건강, 배변, 수명 등을 한 번에 업데이트
  - 사망 조건 처리 (배고픔 0 상태 12시간 경과)

- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - 매초 실행되던 `setInterval` 타이머 제거
  - `updateLifespan`, `updateAge` import 제거
  - `applyLazyUpdate` import 추가
  - 슬롯 로드 시 Lazy Update 적용
  - 모든 액션(먹이, 훈련, 진화, 청소 등) 전에 Lazy Update 적용
  - `applyLazyUpdateBeforeAction()` 헬퍼 함수 추가
  - Firestore에 `lastSavedAt` 필드 저장

### Lazy Update 로직
```javascript
// 마지막 저장 시간과 현재 시간의 차이 계산
const elapsedSeconds = (현재 시간 - 마지막 저장 시간) / 1000

// 경과 시간만큼 스탯 업데이트
- lifespanSeconds += elapsedSeconds
- timeToEvolveSeconds -= elapsedSeconds
- 배고픔/건강 타이머 감소 및 상태 업데이트
- 배변 카운트 증가
- 사망 조건 확인
```

### Firestore 데이터 구조 변경
```
users/{userId}/slots/{slotId}
  ...
  + lastSavedAt: Timestamp  // 마지막 저장 시간 (Lazy Update용)
```

### 성능 개선
- **Before**: 매초 Firestore 업데이트 (60회/분)
- **After**: 액션 시점에만 업데이트 (필요 시에만)
- 서버리스 환경에서 비용 및 리소스 절약

### 참고사항
- 기존 `updateLifespan()` 함수는 유지 (필요 시 사용 가능)
- `lastSavedAt`이 없으면 현재 시간으로 초기화
- Firestore Timestamp, Date, number, string 모두 지원
- 사망한 디지몬은 더 이상 업데이트하지 않음

---