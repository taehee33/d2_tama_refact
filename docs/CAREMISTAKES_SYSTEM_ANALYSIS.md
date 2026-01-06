# 케어미스(Care Mistakes) 시스템 분석

## 📋 개요

케어미스(Care Mistakes)는 디지몬이 플레이어의 부주의로 인해 발생하는 실수 횟수를 추적하는 시스템입니다. 이 값은 진화 경로에 직접적인 영향을 미치며, 디지몬의 성장 방향을 결정하는 핵심 요소입니다.

---

## 🎯 케어미스 발생 조건

### 1. **호출(Call) 타임아웃**

디지몬이 특정 상태에 도달하면 호출(Call)이 시작되며, 일정 시간 내에 응답하지 않으면 케어미스가 증가합니다.

#### 1.1. **Hunger Call (배고픔 호출)**
- **트리거 조건**: `fullness === 0`
- **타임아웃**: 10분 (600,000ms)
- **케어미스 증가**: 타임아웃 시 `careMistakes +1`
- **호출 리셋**: `fullness > 0`이 되면 즉시 리셋

**구현 위치**:
- 호출 트리거: `hooks/useGameLogic.js` - `checkCalls()` (396-399줄)
- 타임아웃 체크: `hooks/useGameLogic.js` - `checkCallTimeouts()` (467-478줄)
- Lazy Update 처리: `data/stats.js` - `applyLazyUpdate()` (460-498줄)

#### 1.2. **Strength Call (힘 호출)**
- **트리거 조건**: `strength === 0`
- **타임아웃**: 10분 (600,000ms)
- **케어미스 증가**: 타임아웃 시 `careMistakes +1`
- **호출 리셋**: `strength > 0`이 되면 즉시 리셋

**구현 위치**:
- 호출 트리거: `hooks/useGameLogic.js` - `checkCalls()` (401-405줄)
- 타임아웃 체크: `hooks/useGameLogic.js` - `checkCallTimeouts()` (481-492줄)
- Lazy Update 처리: `data/stats.js` - `applyLazyUpdate()` (500-533줄)

#### 1.3. **Sleep Call (수면 호출)**
- **트리거 조건**: 수면 시간(`sleepSchedule`)이고 `isLightsOn === true`
- **타임아웃**: 60분 (3,600,000ms)
- **케어미스 증가**: 타임아웃 시 `careMistakes +1`
- **호출 리셋**: `isLightsOn === false`가 되면 즉시 리셋

**구현 위치**:
- 호출 트리거: `hooks/useGameLogic.js` - `checkCalls()` (407-419줄)
- 타임아웃 체크: `hooks/useGameLogic.js` - `checkCallTimeouts()` (495-506줄)
- Lazy Update 처리: 수면 호출은 실시간으로만 처리 (Lazy Update에서는 처리하지 않음)

### 2. **수면 중 불 켜두기 (Sleep Light On)**

수면 중에 불을 30분 이상 켜두면 케어미스가 증가합니다.

- **트리거 조건**: 
  - 수면 중 (`sleepingNow === true`)
  - 불이 켜져 있음 (`isLightsOn === true`)
- **타임아웃**: 30분 (1,800,000ms)
- **케어미스 증가**: 30분 경과 시 `careMistakes +1`
- **일일 제한**: 하루에 1회만 증가 (`dailySleepMistake` 플래그로 관리)
- **리셋**: 날짜가 변경되면 `dailySleepMistake` 리셋

**구현 위치**:
- `pages/Game.jsx` - `useEffect` (336-359줄)
- `hooks/useGameState.js` - `dailySleepMistake` 상태 관리

### 3. **TIRED 상태 지속**

디지몬이 TIRED 상태로 30분 이상 지속되면 케어미스가 증가합니다.

- **트리거 조건**: `sleepStatus === "TIRED"`
- **타임아웃**: 30분 (1,800,000ms, 개발자 모드에서는 1분)
- **케어미스 증가**: 30분 경과 시 `careMistakes +1`
- **리셋**: TIRED 상태가 해제되면 리셋

**구현 위치**:
- `pages/Game.jsx` - `useEffect` (921-956줄)

### 4. **수면 방해 (Sleep Disturbance)**

수면 중에 특정 액션(먹이기, 훈련, 배틀, 치료)을 수행하면 수면 방해가 발생합니다.

- **트리거 조건**: 
  - 수면 중 (`isWithinSleepSchedule()`)
  - 수면 방해 액션 수행 (먹이기, 훈련, 배틀, 치료)
- **케어미스 증가**: 수면 방해 발생 시 `careMistakes +1`
- **추가 효과**: 
  - `sleepDisturbances +1` (진화 조건에 사용)
  - `wakeUntil` 설정 (10분 동안 깨어있음)

**구현 위치**:
- `hooks/useGameHandlers.js` - `handleHeal()` (162-168줄)
- `hooks/useGameActions.js` - `handleFeed()`, `handleTrain()`, `handleBattle()` (157-177줄, 392-411줄, 936-955줄)
- `hooks/useGameActions.js` - `wakeForInteraction()` (37-50줄)

---

## 🔄 케어미스 처리 흐름

### 실시간 처리 (게임 실행 중)

1. **호출 트리거**: `checkCalls()` 함수가 주기적으로 호출되어 호출 상태를 체크
2. **타임아웃 체크**: `checkCallTimeouts()` 함수가 주기적으로 호출되어 타임아웃 체크
3. **케어미스 증가**: 타임아웃 발생 시 `careMistakes +1` 및 호출 리셋

**호출 위치**:
- `pages/Game.jsx` - `useEffect` (438줄): `checkCallTimeouts()` 호출

### Lazy Update 처리 (오프라인 후 복귀)

1. **오프라인 시간 계산**: `applyLazyUpdate()` 함수가 마지막 저장 시간부터 현재까지의 경과 시간 계산
2. **호출 상태 복원**: `lastHungerZeroAt`, `lastStrengthZeroAt`를 기반으로 호출 시작 시간 복원
3. **타임아웃 체크**: 경과 시간이 타임아웃을 초과하면 `careMistakes +1`
4. **중복 방지**: `checkCallTimeouts()`에서만 케어미스를 증가시키고, `applyLazyUpdate()`에서는 호출 리셋만 수행

**구현 위치**:
- `data/stats.js` - `applyLazyUpdate()` (460-533줄)

---

## 📊 케어미스 관련 스탯

### `careMistakes`
- **타입**: `number`
- **기본값**: `0`
- **초기화**: 진화 시 `0`으로 리셋
- **용도**: 진화 조건 체크에 사용

### `callStatus`
- **타입**: `Object`
- **구조**:
  ```javascript
  {
    hunger: { isActive: boolean, startedAt: number | null },
    strength: { isActive: boolean, startedAt: number | null },
    sleep: { isActive: boolean, startedAt: number | null }
  }
  ```
- **용도**: 호출 상태 추적

### `dailySleepMistake`
- **타입**: `boolean`
- **기본값**: `false`
- **초기화**: 날짜 변경 시 `false`로 리셋
- **용도**: 수면 중 불 켜두기 케어미스의 일일 제한 관리

### `sleepLightOnStart`
- **타입**: `number | null`
- **기본값**: `null`
- **용도**: 수면 중 불이 켜진 시점 추적

### `sleepMistakeDate`
- **타입**: `string`
- **기본값**: `null`
- **용도**: 날짜 변경 감지 (일일 수면 케어미스 리셋용)

### `sleepDisturbances`
- **타입**: `number`
- **기본값**: `0`
- **초기화**: 진화 시 `0`으로 리셋
- **용도**: 진화 조건 체크에 사용 (케어미스와 별개)

---

## 🎮 진화 조건에서의 케어미스

케어미스는 진화 경로를 결정하는 핵심 요소입니다.

### 진화 조건 체크

**구현 위치**: `logic/evolution/index.js` - `checkEvolutionConditions()` (30-38줄)

```javascript
if (evolutionCriteria.mistakes) {
  if (evolutionCriteria.mistakes.min !== undefined && stats.careMistakes < evolutionCriteria.mistakes.min) {
    return false;
  }
  if (evolutionCriteria.mistakes.max !== undefined && stats.careMistakes > evolutionCriteria.mistakes.max) {
    return false;
  }
}
```

### 진화 조건 예시

**구현 위치**: `data/v1/digimons.js`, `data/v1/evolution.js`

- **0-3 케어미스**: 일반 진화 경로
- **4+ 케어미스**: 특수 진화 경로 (예: Numemon, Sukamon 등)
- **최대 1 케어미스**: 특정 디지몬 (예: Stage VI, VI+)

---

## 🔧 주요 함수 및 로직

### `checkCalls(stats, isLightsOn, sleepSchedule, now)`
- **위치**: `hooks/useGameLogic.js` (381-422줄)
- **기능**: 호출 상태를 체크하고 필요시 활성화
- **호출 시점**: `applyLazyUpdate()` 내부

### `checkCallTimeouts(stats, now)`
- **위치**: `hooks/useGameLogic.js` (455-510줄)
- **기능**: 호출 타임아웃을 체크하고 케어미스 증가
- **호출 시점**: 
  - 실시간: `pages/Game.jsx` - `useEffect` (438줄)
  - Lazy Update: `data/stats.js` - `applyLazyUpdate()` (주석 처리됨, 중복 방지)

### `resetCallStatus(stats, callType)`
- **위치**: `hooks/useGameLogic.js` (430-447줄)
- **기능**: 특정 호출 상태를 리셋
- **호출 시점**: 액션 수행 시 (먹이기, 훈련, 배틀 등)

### `wakeForInteraction(digimonStats, setWakeUntilCb, setStatsCb, onSleepDisturbance)`
- **위치**: `hooks/useGameActions.js` (37-50줄), `hooks/useGameHandlers.js` (42-55줄)
- **기능**: 수면 중 인터랙션 시 깨우기 및 수면 방해 처리
- **효과**: 
  - `sleepDisturbances +1`
  - `wakeUntil` 설정 (10분)
  - 수면 방해 토스트 표시

---

## 📝 Activity Log

케어미스 발생 시 Activity Log에 기록됩니다.

### 로그 타입
- `'CARE_MISTAKE'`: 일반 케어미스
- `'CAREMISTAKE'`: TIRED 상태 케어미스 (대소문자 차이)

### 로그 메시지 예시
- `"Care Mistake: Ignored Hunger Call (1 mistake)"`
- `"Care Mistake: Ignored Strength Call (1 mistake)"`
- `"Care Mistake: Lights left on (1 mistake)"`
- `"Care Mistake: Tired for too long"`
- `"Sleep Disturbance: Healed while sleeping"`

**구현 위치**:
- `pages/Game.jsx` - `useEffect` (440-455줄, 943줄)
- `hooks/useGameHandlers.js` - `handleHeal()` (167줄)

---

## ⚠️ 주의사항

### 1. 중복 증가 방지
- `checkCallTimeouts()`에서만 케어미스를 증가시키고, `applyLazyUpdate()`에서는 호출 리셋만 수행
- 이는 오프라인 후 복귀 시 중복 증가를 방지하기 위함

### 2. 일일 수면 케어미스 제한
- 수면 중 불 켜두기 케어미스는 하루에 1회만 증가
- `dailySleepMistake` 플래그로 관리

### 3. 호출 리셋 타이밍
- 호출이 응답되면 즉시 리셋 (예: `fullness > 0`이 되면 `hunger` 호출 리셋)
- 타임아웃 발생 시에도 호출 리셋

### 4. 진화 시 리셋
- 진화 시 `careMistakes`는 `0`으로 리셋
- `sleepDisturbances`도 `0`으로 리셋

**구현 위치**:
- `logic/stats/stats.js` - `initializeStats()` (36줄)
- `data/stats.js` - `initializeStats()` (56줄)
- `hooks/useEvolution.js` - 진화 처리 (174줄)

---

## 🔍 디버깅 및 테스트

### StatsPopup에서 확인
- **위치**: `components/StatsPopup.jsx`
- **OLD 탭**: `CareMistakes` 값 확인 및 수동 수정 가능 (336-339줄)
- **NEW 탭**: `Care Mistakes` 값 표시 (565줄)

### Activity Log 확인
- 케어미스 발생 시 Activity Log에 기록됨
- 로그 타입: `'CARE_MISTAKE'` 또는 `'CAREMISTAKE'`

### 개발자 모드
- TIRED 상태 케어미스의 타임아웃이 1분으로 단축됨 (테스트 용이)

---

## 📚 관련 파일

### 핵심 로직
- `hooks/useGameLogic.js`: 호출 트리거, 타임아웃 체크, 호출 리셋
- `data/stats.js`: Lazy Update에서의 호출 처리
- `pages/Game.jsx`: 실시간 타임아웃 체크, 수면 케어미스 처리, TIRED 케어미스 처리

### 액션 핸들러
- `hooks/useGameActions.js`: 먹이기, 훈련, 배틀 시 수면 방해 처리
- `hooks/useGameHandlers.js`: 치료 시 수면 방해 처리

### 진화 시스템
- `logic/evolution/index.js`: 진화 조건 체크
- `data/v1/digimons.js`: 진화 조건 정의
- `data/v1/evolution.js`: 진화 조건 정의

### UI
- `components/StatsPopup.jsx`: 케어미스 값 표시 및 수정
- `components/DigimonStatusBadges.jsx`: 케어미스 관련 상태 표시
- `components/DigimonInfoModal.jsx`: 케어미스 설명

---

## 📌 요약

케어미스 시스템은 다음과 같이 구성되어 있습니다:

1. **4가지 케어미스 발생 조건**:
   - Hunger Call 타임아웃 (10분)
   - Strength Call 타임아웃 (10분)
   - Sleep Call 타임아웃 (60분)
   - 수면 중 불 켜두기 (30분, 일일 1회)
   - TIRED 상태 지속 (30분)
   - 수면 방해 (즉시)

2. **실시간 및 Lazy Update 처리**: 오프라인 후 복귀 시에도 정확한 케어미스 계산

3. **진화 조건**: 케어미스 값에 따라 진화 경로 결정

4. **중복 방지**: `checkCallTimeouts()`에서만 케어미스 증가

5. **진화 시 리셋**: 진화할 때마다 `careMistakes`는 `0`으로 리셋

