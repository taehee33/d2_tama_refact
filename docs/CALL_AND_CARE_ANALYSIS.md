# 디지몬 호출·케어 필요 사항 분석

현재 코드베이스 기준으로 **호출(Call)** 이 무엇인지, **어떤 케어가 필요한지**, **무시 시 어떤 일이 일어나는지**를 정리한 문서입니다.

---

## 1. 요약 (사용자 관점)

| 케어 종류 | 언제 필요해지나요? | 어떻게 케어하나요? | 제때 안 하면? |
|-----------|-------------------|---------------------|----------------|
| **배고픔 호출** | 배고픔이 0이 됨 | 고기/프로틴으로 먹이 주기 | 10분 지나면 케어미스 +1 |
| **힘 호출** | 힘이 0이 됨 | 프로틴 먹이 or 훈련 | 10분 지나면 케어미스 +1 |
| **수면 호출** | 수면 시간인데 불이 켜져 있음 | 조명 끄기 | 60분 지나면 케어미스 +1 |
| **TIRED 방치** | 수면 시간에 불 켜둔 채로 피곤 상태 지속 | 불 끄기 | 30분 지나면 케어미스 +1 (하루 1회) |
| **수면 방해** | 자는 동안 먹이/훈련/배틀/치료 함 | 수면 시간에는 불 끄고 놔두기 | 즉시 케어미스 +1, 10분 깨어 있음 |

**케어미스**가 쌓이면 진화 경로가 바뀝니다 (예: 0~3이면 일반 경로, 4 이상이면 누몬 등 특수 경로).

---

## 2. 호출(Call) 시스템 상세

### 2.1 호출이란?

디지몬이 **특정 상태**에 들어가면 “호출”이 **시작**됩니다.  
호출이 시작된 뒤 **일정 시간 안에** 플레이어가 적절한 액션(먹이 주기, 훈련, 불 끄기 등)을 하지 않으면 **케어미스(Care Mistake) +1**이 됩니다.

### 2.2 호출 3종류

| 호출 타입 | 트리거 조건 | 타임아웃 | 케어 방법 | 호출 해제 조건 |
|-----------|-------------|----------|-----------|----------------|
| **Hunger (배고픔)** | `fullness === 0` | **10분** | 고기 또는 프로틴으로 먹이 주기 | `fullness > 0` (먹이 주면 자동 해제) |
| **Strength (힘)** | `strength === 0` | **10분** | 프로틴 먹이 or 훈련 | `strength > 0` (프로틴/훈련 후 자동 해제) |
| **Sleep (수면)** | 수면 시간 + `isLightsOn === true` (그런데 아직 안 잠든 상태) | **60분** | 조명 끄기 | `isLightsOn === false` (불 끄면 해제) |

- **수면 호출 보충**: 실제로 **잠들어 있으면**(SLEEPING) 수면 호출은 **비활성화**됩니다. “수면 시간인데 불은 켜져 있고, 아직 깨어 있는 상태”일 때만 수면 호출이 켜집니다.
- **냉장고(냉동)** 중에는 모든 호출이 무시되며, 타임아웃으로 인한 케어미스도 발생하지 않습니다.

### 2.3 데이터 구조 (callStatus)

```javascript
// digimonStats.callStatus (defaultStatsFile.js, useGameLogic.js)
callStatus: {
  hunger: { isActive: boolean, startedAt: number|null, isLogged: boolean },  // 10분 타임아웃
  strength: { isActive: boolean, startedAt: number|null, isLogged: boolean },
  sleep: { isActive: boolean, startedAt: number|null }   // 60분 타임아웃
}
```

- `startedAt`: 호출이 시작된 시각(ms). 타임아웃 계산에 사용.
- `isLogged`: hunger/strength만 사용. 타임아웃으로 케어미스 1회 올렸으면 true로 두어 **중복 케어미스** 방지.

### 2.4 호출 로직 위치

| 역할 | 파일 | 함수/내용 |
|------|------|-----------|
| 호출 **시작/유지/해제** 판정 | `hooks/useGameLogic.js` | `checkCalls(stats, isLightsOn, sleepSchedule, now, isActuallySleeping)` |
| 호출 **타임아웃** → 케어미스 +1 | `hooks/useGameLogic.js` | `checkCallTimeouts(stats, now, isActuallySleeping)` |
| 호출 **수동 리셋** | `hooks/useGameLogic.js` | `resetCallStatus(stats, callType)` |
| 1초마다 호출/타임아웃 체크 | `pages/Game.jsx` | 1초 틱 useEffect 안에서 `checkCalls` → `checkCallTimeouts` 호출 |
| Lazy Update 시 호출 복원·타임아웃 | `data/stats.js` | `applyLazyUpdate()` 내부 |

---

## 3. 케어 방법과 호출 해제가 일어나는 곳

### 3.1 배고픔 호출 해제

- **조건**: `fullness > 0` 이 되면 hunger 호출 리셋.
- **구현**:  
  - **먹이 주기** 후 스탯 반영 시 `fullness > 0` 이면 `resetCallStatus(updatedStats, 'hunger')` 호출.  
  - `useGameActions.js` (먹이 처리), `useGameAnimations.js` (먹이 애니메이션 후 스탯 반영) 양쪽에서 처리.

### 3.2 힘 호출 해제

- **조건**: `strength > 0` 이 되면 strength 호출 리셋.
- **구현**:  
  - **프로틴** 먹이: `useGameActions.js` / `useGameAnimations.js` 에서 `type === "protein" && updatedStats.strength > 0` 일 때 `resetCallStatus(..., 'strength')`.  
  - **훈련**: `useGameActions.js` 의 `handleTrainResult` 에서 `finalStats.strength > 0` 이면 `resetCallStatus(finalStats, 'strength')`.

### 3.3 수면 호출 해제

- **조건**: 불을 끄면 sleep 호출 리셋.
- **구현**: `useGameHandlers.js` 의 `handleToggleLights`. `next === false` (불 끔)일 때 `resetCallStatus(updatedStats, 'sleep')` 호출.

---

## 4. 호출 외 “케어가 필요한” 것들 (케어미스 관련)

### 4.1 TIRED 상태 방치 (수면 시간 + 불 켜둔 채 30분)

- **의미**: 수면 시간인데 불을 켜둔 채로 두면 디지몬이 **TIRED** 상태가 되고, 이 상태를 30분 방치하면 케어미스 +1.
- **현재 구현**:  
  - `Game.jsx` 1초 틱에서 `currentSleepStatus === "TIRED"` 일 때 `tiredStartAt` 기준 30분 경과 시 `careMistakes +1`, `tiredCounted = true`, `dailySleepMistake = true`.  
  - **하루 1회만** 증가 (`dailySleepMistake` / `sleepMistakeDate` 로 제한).  
  - 개발자 모드에서는 1분으로 단축.
- **케어**: 수면 시간에는 **조명 끄기** → TIRED가 해제되면 `tiredStartAt` 등 리셋.

문서상으로는 “수면 중 불 켜두기”와 “TIRED 방치”가 하나로 통합되어 있고, 로그 메시지는  
`"케어미스(사유: 수면 시간에 불 켜둔 채 30분 경과 - 피곤 방치)"` 입니다.

### 4.2 수면 방해 (Sleep Disturbance)

- **의미**: 디지몬이 **수면 시간에 잠든 상태**인데, 플레이어가 먹이/훈련/배틀/치료를 하면 “수면 방해”로 간주.
- **결과**:  
  - **케어미스 +1**  
  - **sleepDisturbances +1** (진화 조건에 별도 사용)  
  - **10분 동안 깨 있음** (`wakeUntil` 설정)
- **구현**:  
  - `useGameActions.js`: 먹이(`handleFeed`), 훈련(`handleTrainResult`), 배틀 관련.  
  - `useGameHandlers.js`: 치료(`handleHeal`).  
  - 수면 시간 + 실제로 잠든 상태일 때만 해당 액션 시 `wakeForInteraction` 호출 및 케어미스/로그 처리.
- **케어**: 수면 시간에는 **불 끄고**, 자는 동안에는 먹이/훈련/배틀/치료를 하지 않기.

---

## 5. 케어미스(careMistakes) 요약

| 발생 경로 | 타임아웃/조건 | 비고 |
|-----------|----------------|------|
| Hunger 호출 무시 | 10분 | callStatus.hunger.isLogged 로 1회만 |
| Strength 호출 무시 | 10분 | callStatus.strength.isLogged 로 1회만 |
| Sleep 호출 무시 | 60분 | 1회 타임아웃당 +1 |
| TIRED 방치 (수면 시간 + 불 켜둔 채 30분) | 30분 | 하루 1회만, dailySleepMistake |
| 수면 방해 | 즉시 | 먹이/훈련/배틀/치료 시 1회 |

- **진화 시**: `careMistakes`는 **0으로 리셋** (`useEvolution.js`, `initializeStats` 등).
- **진화 조건**: `logic/evolution/checker.js`, `data/v1/digimons.js` 등에서 `careMistakes` min/max 로 경로 분기 (예: 0~3 일반, 4+ 특수).

---

## 6. UI에서 “호출·케어 필요”가 보이는 곳

- **호출 아이콘/상태**:  
  - `GameScreen.jsx`: 호출 중일 때 아이콘·토스트, 호출(callSign) 버튼 클릭 시 상세 팝업.  
  - `DigimonStatusBadges.jsx`, `DigimonStatusText.jsx`: 배고픔/힘/수면 호출 문구.  
  - `StatsPopup.jsx`: callStatus 각 타입별 시작 시각·경과 시간·타임아웃.  
  - `DigimonInfoModal.jsx`: 호출 시스템 설명 (Hunger 10분, Strength 10분, Sleep 60분).
- **케어미스**:  
  - `StatsPopup.jsx`: Care Mistakes 값 표시/수정(OLD 탭).  
  - `EvolutionGuideModal.jsx`: 진화 조건에서 careMistakes min/max 표시.

---

## 7. 관련 파일 인덱스

| 구분 | 파일 |
|------|------|
| 호출·타임아웃·리셋 로직 | `hooks/useGameLogic.js` |
| 1초 틱·TIRED 케어미스 | `pages/Game.jsx` |
| Lazy Update 시 호출 복원 | `data/stats.js` |
| 먹이/훈련 시 호출 리셋 | `hooks/useGameActions.js`, `hooks/useGameAnimations.js` |
| 조명 끄기 시 수면 호출 리셋 | `hooks/useGameHandlers.js` (handleToggleLights) |
| 기본 스탯/ callStatus 구조 | `data/defaultStatsFile.js` |
| 진화 조건 (careMistakes) | `logic/evolution/checker.js`, `data/v1/digimons.js` |
| 기존 케어미스 시스템 문서 | `docs/CAREMISTAKES_SYSTEM_ANALYSIS.md` |

---

이 문서는 **현재 구현 기준**으로 “디지몬 호출”과 “케어가 필요한 내용”을 사용자·개발자 관점에서 정리한 것입니다.  
추가로 필요한 항목(예: 디스코드 알림 연동 시 푸시할 이벤트 종류)은 위 표를 기준으로 “호출 시작 / 호출 해제 / 케어미스 발생” 세 가지로 나누어 설계하면 됩니다.
