# 디지몬 스탯 전체 분석 문서

## 📋 목차
1. [기본 정보](#기본-정보)
2. [표시 스탯 (UI에 표시)](#표시-스탯-ui에-표시)
3. [숨겨진 스탯 (진화 조건 등)](#숨겨진-스탯-진화-조건-등)
4. [시간 관련 스탯](#시간-관련-스탯)
5. [타이머 스탯](#타이머-스탯)
6. [진화 관련 스탯](#진화-관련-스탯)
7. [배틀 관련 스탯](#배틀-관련-스탯)
8. [상태 플래그](#상태-플래그)
9. [수면 관련 스탯](#수면-관련-스탯)
10. [똥 관련 스탯](#똥-관련-스탯)
11. [기타 스탯](#기타-스탯)
12. [스탯 초기화 규칙](#스탯-초기화-규칙)

---

## 기본 정보

| 스탯명 | 타입 | 설명 | 초기값 | 진화 시 |
|--------|------|------|--------|---------|
| `sprite` | number | 스프라이트 번호 | 133 | 변경됨 |
| `evolutionStage` | string | 진화 단계 (Digitama, Baby I, Baby II, Child, Adult, Perfect, Ultimate, Super Ultimate) | "Digitama" | 변경됨 |

---

## 표시 스탯 (UI에 표시)

| 스탯명 | 타입 | 범위 | 설명 | 표시 위치 |
|--------|------|------|------|-----------|
| `age` | number | 0+ | 나이 (일 단위, 자정마다 증가) | StatsPanel |
| `weight` | number | 0+ | 체중 (Gigabytes) | StatsPanel |
| `strength` | number | 0-5 | 힘 (하트 수, 0-5) | StatsPanel |
| `energy` | number | 0+ | 에너지/스태미나 (DP, Digital Points) | StatsPanel |
| `effort` | number | 0-5 | 노력치 (하트 수, 0-5, 훈련 4회당 +1) | StatsPanel |
| `winRate` | number | 0-100 | 승률 (%) | StatsPanel |
| `fullness` | number | 0-5+ | 배고픔 (하트 수, 0-5 기본, 오버피드 시 5 초과 가능) | StatsPanel (5(+2) 형식) |
| `health` | number | 0-5 | 건강 (하트 수, 0-5) | StatsPanel |
| `careMistakes` | number | 0+ | 케어 미스 횟수 | StatsPanel |

**참고:**
- `fullness`는 5를 초과할 수 있음 (오버피드)
- `StatsPanel`에서 `fullness`는 `5(+2)` 형식으로 표시 (기본 5, 오버피드 +2)

---

## 숨겨진 스탯 (진화 조건 등)

| 스탯명 | 타입 | 범위 | 설명 | 용도 |
|--------|------|------|------|------|
| `type` | string\|null | "Vaccine", "Data", "Virus", "Free", null | 속성 | 배틀 상성 계산 |
| `power` | number | 0+ | 파워 (Base Power + 보너스) | 배틀 히트레이트 계산 |
| `basePower` | number | 0+ | 기본 파워 (디지몬별 고정값) | 파워 계산의 기준값 |
| `proteinOverdose` | number | 0-7 | 프로틴 과다 (프로틴 4개당 +1, 최대 7) | 배틀 부상 확률 증가 |
| `injuries` | number | 0+ | 부상 횟수 (15회 시 사망) | 사망 조건 체크 |

**참고:**
- `power` = `basePower` + Strength Hearts 보너스 + Traited Egg 보너스
- `proteinOverdose`는 프로틴 4개 먹일 때마다 +1 증가
- `injuries`가 15에 도달하면 사망

---

## 시간 관련 스탯

| 스탯명 | 타입 | 단위 | 설명 | 업데이트 방식 |
|--------|------|------|------|---------------|
| `lifespanSeconds` | number | 초 | 수명 (총 생존 시간) | Lazy Update로 증가 |
| `timeToEvolveSeconds` | number | 초 | 진화까지 남은 시간 | Lazy Update로 감소, 0이 되면 진화 가능 |
| `lastSavedAt` | Date\|number\|string\|null | - | 마지막 저장 시간 (Lazy Update 기준점) | 저장 시 업데이트 |

**참고:**
- `lifespanSeconds`는 계속 증가하며, 최대 수명에 도달하면 사망
- `timeToEvolveSeconds`가 0이 되어야 진화 조건 체크 가능
- `lastSavedAt`은 Firestore Timestamp, Date, number, string 모두 지원

---

## 타이머 스탯

| 스탯명 | 타입 | 단위 | 설명 | 업데이트 방식 |
|--------|------|------|------|---------------|
| `hungerTimer` | number | 분 | 배고픔 감소 주기 (디지몬별로 다름) | 디지몬 데이터에서 설정 |
| `hungerCountdown` | number | 초 | 배고픔 타이머 카운트다운 | Lazy Update로 감소, 0이 되면 `fullness` -1 |
| `strengthTimer` | number | 분 | 힘 감소 주기 (디지몬별로 다름) | 디지몬 데이터에서 설정 |
| `strengthCountdown` | number | 초 | 힘 타이머 카운트다운 | Lazy Update로 감소, 0이 되면 `health` -1 |
| `poopTimer` | number | 분 | 똥 생성 주기 (Stage별로 다름: I=3분, II=60분, III+=120분) | 디지몬 데이터에서 설정 |
| `poopCountdown` | number | 초 | 똥 타이머 카운트다운 | Lazy Update로 감소, 0이 되면 `poopCount` +1 |

**참고:**
- 모든 타이머는 Lazy Update 방식으로 일괄 계산
- `hungerCountdown`이 0 이하가 되면 `fullness`가 1 감소하고 타이머 리셋
- `strengthCountdown`이 0 이하가 되면 `health`가 1 감소하고 타이머 리셋
- `poopCountdown`이 0 이하가 되면 `poopCount`가 1 증가하고 타이머 리셋

---

## 진화 관련 스탯

| 스탯명 | 타입 | 범위 | 설명 | 진화 시 |
|--------|------|------|------|---------|
| `trainings` | number | 0+ | 훈련 횟수 (진화 조건에 사용) | **리셋 (0으로)** |
| `trainingCount` | number | 0+ | 훈련 횟수 (별칭, `trainings`와 동일) | **리셋 (0으로)** |
| `overfeeds` | number | 0+ | 오버피드 횟수 (진화 조건에 사용) | **리셋 (0으로)** |
| `sleepDisturbances` | number | 0+ | 수면 방해 횟수 (진화 조건에 사용) | **리셋 (0으로)** |
| `careMistakes` | number | 0+ | 케어 미스 횟수 (진화 조건에 사용) | **리셋 (0으로)** |

**참고:**
- 모든 진화 관련 스탯은 진화 시 0으로 리셋됨
- `trainings`와 `trainingCount`는 동일한 값을 가리킴 (호환성 유지)
- 진화 조건에서 `trainings`, `overfeeds`, `sleepDisturbances`, `careMistakes`가 사용됨

---

## 배틀 관련 스탯

| 스탯명 | 타입 | 범위 | 설명 | 진화 시 |
|--------|------|------|------|---------|
| `battles` | number | 0+ | 총 배틀 횟수 (승리 + 패배) | **유지** |
| `battlesWon` | number | 0+ | 총 승리 횟수 | **유지** |
| `battlesLost` | number | 0+ | 총 패배 횟수 | **유지** |
| `battlesForEvolution` | number | 0+ | 진화를 위한 배틀 횟수 (별도 카운터) | **리셋 (0으로)** |
| `winRate` | number | 0-100 | 승률 (%) = (battlesWon / battles) * 100 | **유지** |

**참고:**
- `battles` = `battlesWon` + `battlesLost`
- `winRate`는 계산된 값이지만 저장되어 있음
- `battles`, `battlesWon`, `battlesLost`, `winRate`는 진화 시 유지됨 (누적)
- `battlesForEvolution`은 진화 시 리셋됨 (별도 카운터)

---

## 상태 플래그

| 스탯명 | 타입 | 설명 | 업데이트 시점 |
|--------|------|------|---------------|
| `isDead` | boolean | 사망 여부 | 사망 조건 충족 시 `true` |
| `lastHungerZeroAt` | number\|null | 배고픔이 0이 된 시간 (timestamp) | `fullness`가 0이 되면 기록, 12시간 경과 시 사망 |
| `lastStrengthZeroAt` | number\|null | 힘이 0이 된 시간 (timestamp) | `health`가 0이 되면 기록, 12시간 경과 시 사망 |
| `injuredAt` | number\|null | 부상 당한 시간 (timestamp) | 부상 발생 시 기록 |

**사망 조건:**
1. **굶주림**: `fullness === 0`이고 `lastHungerZeroAt`로부터 12시간(43200초) 경과
2. **부상 과다**: `health === 0`이고 `lastStrengthZeroAt`로부터 12시간(43200초) 경과
3. **수명 다함**: `lifespanSeconds`가 최대 수명에 도달
4. **부상 누적**: `injuries`가 15에 도달

---

## 수면 관련 스탯

| 스탯명 | 타입 | 설명 | 저장 위치 |
|--------|------|------|-----------|
| `isLightsOn` | boolean | 조명 상태 (true=켜짐, false=꺼짐) | Firestore 슬롯 데이터 |
| `wakeUntil` | number\|null | 강제 기상 유지 만료 시간 (timestamp) | Firestore 슬롯 데이터 |
| `sleepDisturbances` | number | 수면 방해 횟수 (진화 조건에 사용) | DigimonStats |

**참고:**
- `isLightsOn`과 `wakeUntil`은 슬롯별로 저장됨 (Firestore의 슬롯 데이터)
- `sleepDisturbances`는 DigimonStats에 저장됨
- 수면 중 인터랙션 시 `wakeUntil`이 10분 후로 설정되고 `sleepDisturbances` +1

---

## 똥 관련 스탯

| 스탯명 | 타입 | 범위 | 설명 | 업데이트 방식 |
|--------|------|------|------|---------------|
| `poopCount` | number | 0-8 | 똥 개수 (최대 8개) | `poopCountdown`이 0이 되면 +1 |
| `lastMaxPoopTime` | number\|null | - | 똥이 8개가 된 시간 (timestamp) | `poopCount`가 8이 되면 기록 |
| `poopTimer` | number | 분 | 똥 생성 주기 | 디지몬 데이터에서 설정 |
| `poopCountdown` | number | 초 | 똥 타이머 카운트다운 | Lazy Update로 감소 |

**케어 미스 로직:**
- `poopCount`가 8이 되면 `lastMaxPoopTime` 기록
- `poopCount`가 8 이상이고 `lastMaxPoopTime`으로부터 8시간(28800초) 경과 시:
  - `careMistakes` +1
  - `lastMaxPoopTime` 리셋

---

## 기타 스탯

| 스탯명 | 타입 | 설명 | 상태 |
|--------|------|------|------|
| `stamina` | number | 스태미나 (기존 필드, 호환성 유지) | `energy`와 동일한 값 사용 |
| `maxOverfeed` | number | 최대 오버피드 허용치 | 디지몬별로 다름 |
| `maxStamina` | number | 최대 스태미나 | 디지몬별로 다름 |
| `minWeight` | number | 최소 체중 | 디지몬별로 다름 |
| `healing` | number | 힐링 (미사용?) | 미사용 가능성 |
| `attribute` | number | 속성 (미사용?) | `type`으로 대체됨 |
| `attackSprite` | number | 공격 스프라이트 번호 | 디지몬 데이터에서 설정 |
| `altAttackSprite` | number | 대체 공격 스프라이트 (기본값: 65535) | 미사용 가능성 |

---

## 스탯 초기화 규칙

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

## 스탯 업데이트 방식

### Lazy Update (지연 업데이트)
- **목적**: 서버리스 환경에서 성능 최적화
- **방식**: 마지막 저장 시간(`lastSavedAt`)부터 현재까지 경과한 시간을 계산하여 한 번에 스탯 업데이트
- **적용 스탯**:
  - `lifespanSeconds` (증가)
  - `timeToEvolveSeconds` (감소)
  - `fullness` (감소, `hungerCountdown` 기반)
  - `health` (감소, `strengthCountdown` 기반)
  - `poopCount` (증가, `poopCountdown` 기반)
  - `careMistakes` (똥 8개 8시간 방치 시)
  - `isDead` (사망 조건 체크)

### 실시간 업데이트
- **적용 시점**: 사용자 액션 시 (먹이기, 훈련, 배틀 등)
- **방식**: 액션 전에 Lazy Update 적용 → 액션 처리 → 즉시 저장

---

## 스탯 저장 위치

### Firestore (슬롯 데이터)
- 경로: `/users/{uid}/slots/{slotId}`
- 저장 필드:
  - `digimonStats` (전체 DigimonStats 객체)
  - `selectedDigimon` (디지몬 이름)
  - `isLightsOn` (조명 상태)
  - `wakeUntil` (강제 기상 만료 시간)
  - `lastSavedAt` (마지막 저장 시간)
  - `updatedAt` (업데이트 시간)

### DigimonStats 객체 구조
```javascript
{
  // 기본 정보
  sprite: 133,
  evolutionStage: "Digitama",
  
  // 표시 스탯
  age: 0,
  weight: 0,
  strength: 0,
  energy: 0,
  effort: 0,
  winRate: 0,
  fullness: 0,
  health: 0,
  careMistakes: 0,
  
  // 시간 관련
  lifespanSeconds: 0,
  timeToEvolveSeconds: 0,
  lastSavedAt: null,
  
  // 타이머
  hungerTimer: 0,
  hungerCountdown: 0,
  strengthTimer: 0,
  strengthCountdown: 0,
  poopTimer: 0,
  poopCountdown: 0,
  
  // 진화 관련
  trainings: 0,
  overfeeds: 0,
  sleepDisturbances: 0,
  
  // 배틀 관련
  battles: 0,
  battlesWon: 0,
  battlesLost: 0,
  battlesForEvolution: 0,
  
  // 상태 플래그
  isDead: false,
  lastHungerZeroAt: null,
  lastStrengthZeroAt: null,
  injuredAt: null,
  
  // 똥 관련
  poopCount: 0,
  lastMaxPoopTime: null,
  
  // 기타
  proteinOverdose: 0,
  injuries: 0,
  power: 0,
  basePower: 0,
  type: null,
  // ... 기타 필드
}
```

---

## 스탯 사용 위치

### StatsPanel.jsx
표시되는 스탯:
- `age`
- `weight`
- `strength`
- `energy` (또는 `stamina`)
- `winRate`
- `effort`
- `careMistakes`
- `fullness` (5(+2) 형식)
- `health`
- `sleepStatus` (props로 전달)

개발자 정보:
- `proteinOverdose`
- `overfeeds`
- `battles`
- `battlesWon` / `battlesLost`

### 진화 조건 체크 (checker.js, useGameLogic.js)
사용되는 스탯:
- `timeToEvolveSeconds`
- `careMistakes`
- `trainings` / `trainingCount`
- `overfeeds`
- `sleepDisturbances`
- `battles` (battlesWon + battlesLost)
- `winRatio` (battlesWon / battles * 100)
- `weight`
- `strength`
- `power` / `basePower`

---

## 스탯 관련 파일

1. **정의 파일**:
   - `src/data/defaultStatsFile.js` - 기본 스탯 정의 (레거시)
   - `src/data/v1/defaultStats.js` - v1 기본 스탯 정의

2. **로직 파일**:
   - `src/data/stats.js` - 스탯 초기화 및 업데이트 로직
   - `src/logic/stats/stats.js` - v1 스탯 로직 (미사용?)

3. **표시 파일**:
   - `src/components/StatsPanel.jsx` - 스탯 패널 UI
   - `src/components/StatsPopup.jsx` - 스탯 팝업 UI

4. **사용 파일**:
   - `src/pages/Game.jsx` - 게임 로직에서 스탯 사용
   - `src/logic/evolution/checker.js` - 진화 조건 체크
   - `src/hooks/useGameLogic.js` - 진화 가용성 체크

---

## 주의사항

1. **스탯 이름 불일치**:
   - `hunger` vs `fullness`: 코드에서는 `fullness` 사용, 일부 문서에서는 `hunger`
   - `trainings` vs `trainingCount`: 둘 다 사용되지만 동일한 값

2. **레거시 필드**:
   - `stamina`: `energy`와 동일한 값 (호환성 유지)
   - `attribute`: `type`으로 대체됨
   - `healing`, `altAttackSprite`: 미사용 가능성

3. **타입 변환**:
   - Firestore Timestamp → Date 변환 필요
   - `lastSavedAt`은 Date, number, string, Firestore Timestamp 모두 지원

4. **Lazy Update 주의**:
   - 모든 시간 기반 스탯은 `lastSavedAt` 기준으로 계산
   - 액션 전에 반드시 Lazy Update 적용 필요

---

## 개선 제안

1. **스탯 이름 통일**: `hunger` → `fullness`로 완전 전환
2. **레거시 필드 정리**: 미사용 필드 제거 또는 명확한 표시
3. **타입 정의**: TypeScript로 전환 시 스탯 타입 명확히 정의
4. **문서화**: 각 스탯의 계산 공식과 업데이트 로직 문서화

---

**작성일**: 2025-12-22  
**버전**: 1.0



