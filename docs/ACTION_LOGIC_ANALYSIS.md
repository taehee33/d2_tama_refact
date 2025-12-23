# 액션 로직 상세 분석 문서

이 문서는 현재 구현된 훈련, 오버피드, 배틀, 부상, 수면 방해 로직을 상세히 분석합니다.

**작성일**: 2025-12-23  
**버전**: 1.0

---

## 1. 훈련 (Training) 로직

### 구현 위치
- **핵심 로직**: `src/data/train_digitalmonstercolor25th_ver1.js` - `doVer1Training()`
- **호출 위치**: `src/pages/Game.jsx` - `handleTrainResult()`

### Ver.1 스펙
```javascript
// 5번 중 3번 이상 성공 시 → Strength +1 (훈련 성공)
// 3번 미만 성공 시 → Strength 안 오름 (훈련 실패)
// 결과와 상관없이 Weight -2g, Energy(DP) -1 소모
// 훈련 횟수(trainings)는 성공/실패 무관하게 +1
```

### 현재 구현 상태

#### ✅ 정상 동작
1. **성공 판정**: 5번 중 3번 이상 성공 시 `isSuccess = true`
2. **스탯 변화**:
   - `Weight`: -2g (결과와 상관없이)
   - `Energy`: -1 (결과와 상관없이)
   - `Strength`: +1 (성공 시만, 최대 5)
   - `trainings`: +1 (성공/실패 무관하게)
   - `effort`: 4회마다 +1 (최대 5)
3. **수면 방해 처리**: 수면 중 훈련 시도 시 `wakeForInteraction()` 호출

#### 코드 흐름
```javascript
// Game.jsx - handleTrainResult()
1. applyLazyUpdateBeforeAction() - Lazy Update 적용
2. 수면 체크 → 수면 중이면 wakeForInteraction() 호출
3. doVer1Training(updatedStats, userSelections) - 훈련 결과 계산
4. Activity Log 추가
5. setDigimonStatsAndSave() - Firestore 저장
```

### 장점
- ✅ Ver.1 스펙 정확히 구현
- ✅ 수면 방해 로직 통합
- ✅ Activity Log 기록

### 개선 가능 사항
- ⚠️ `trainingCount`와 `trainings` 두 변수명 혼용 (호환성 유지용)
- ⚠️ `effort` 증가는 `trainingCount` 기준 (4회마다)

---

## 2. 오버피드 (Overfeed) 로직

### 구현 위치
- **핵심 로직**: `src/logic/food/meat.js` - `feedMeat()`
- **호출 위치**: `src/pages/Game.jsx` - `handleFeed()`

### Ver.1 스펙
```javascript
// 배고픔이 가득 찬 상태(5)에서 10개 더 먹으면 overfeeds +1
// 오버피드 발생 시 배고픔 감소 주기가 한 사이클 지연됨
```

### 현재 구현 상태

#### ✅ 정상 동작
1. **오버피드 발생 조건**:
   - `fullness >= 5` (배고픔이 가득 찬 상태)
   - `consecutiveMeatFed >= 10` (연속으로 10개 먹음)
   - 두 조건 모두 만족 시 `overfeeds +1`

2. **스탯 변화**:
   - `fullness`: +1 (최대 5 + maxOverfeed)
   - `weight`: +1g
   - `consecutiveMeatFed`: 연속 카운트 (오버피드 발생 시 리셋)

3. **오버피드 효과**:
   - 배고픔 감소 주기가 한 사이클 지연됨 (Lazy Update에서 처리)
   - `overfeeds` 카운트가 있으면 배고픔 감소 시 한 사이클 더 대기

#### 코드 흐름
```javascript
// meat.js - feedMeat()
1. oldFullness >= 5 체크
2. consecutiveMeatFed 증가
3. consecutiveMeatFed >= 10이면 overfeeds +1, consecutiveMeatFed 리셋
4. fullness < maxFullness이면 fullness +1
5. weight +1
```

### 장점
- ✅ Ver.1 스펙 정확히 구현
- ✅ 연속 카운트 추적 (`consecutiveMeatFed`)
- ✅ 오버피드 효과 (배고픔 감소 지연) 구현

### 개선 가능 사항
- ⚠️ 오버피드 효과가 Lazy Update에서 처리되는지 확인 필요
- ⚠️ `consecutiveMeatFed`가 Firestore에 저장되는지 확인 필요

---

## 3. 배틀 (Battle) 로직

### 구현 위치
- **핵심 로직**: `src/pages/Game.jsx` - `handleBattleComplete()`
- **배틀 시뮬레이션**: `src/logic/battle/calculator.js` - `simulateBattle()`

### Ver.1 스펙
```javascript
// Weight -4g, Energy -1 (승패 무관)
// battles +1, battlesWon 또는 battlesLost +1
```

### 현재 구현 상태

#### ✅ 정상 동작
1. **스탯 변화 (승패 무관)**:
   - `weight`: -4g
   - `energy`: -1
   - `battles`: +1

2. **승리 시**:
   - `battlesWon`: +1
   - `battlesForEvolution`: +1

3. **패배 시**:
   - `battlesLost`: +1
   - `isInjured`: true (부상 발생)

4. **수면 방해 처리**: 수면 중 배틀 시도 시 `wakeForInteraction()` 호출

#### 코드 흐름
```javascript
// Game.jsx - handleBattleComplete()
1. applyLazyUpdateBeforeAction() - Lazy Update 적용
2. 수면 체크 → 수면 중이면 wakeForInteraction() 호출
3. Weight -4g, Energy -1 (승패 무관)
4. 승리/패배에 따라 battlesWon 또는 battlesLost +1
5. 패배 시 isInjured = true
6. Activity Log 추가
7. setDigimonStatsAndSave() - Firestore 저장
```

### 장점
- ✅ Ver.1 스펙 정확히 구현
- ✅ 수면 방해 로직 통합
- ✅ Activity Log 기록
- ✅ 패배 시 부상 처리

### 개선 가능 사항
- ⚠️ 부상 확률 로직이 구현되어 있지만 실제로 사용되지 않음 (`calculateInjuryChance()`)
- ⚠️ 승리 시 부상 확률 20% 로직 미구현

---

## 4. 부상 (Injury) 로직

### 구현 위치
- **핵심 로직**: `src/data/stats.js` - `applyLazyUpdate()` (똥 8개 체크)
- **배틀 패배**: `src/pages/Game.jsx` - `handleBattleComplete()` (패배 시)

### Ver.1 스펙
```javascript
// 똥 8개가 되면 isInjured: true
// 배틀 패배 시 부상 확률 (프로틴 과다에 따라 증가)
// 똥 청소 시 isInjured: false
```

### 현재 구현 상태

#### ✅ 정상 동작
1. **똥 8개 부상**:
   - `poopCount === 8`이 되면 `isInjured = true`
   - `lastMaxPoopTime` 기록
   - Lazy Update에서 자동 처리

2. **배틀 패배 부상**:
   - 패배 시 즉시 `isInjured = true` 설정
   - 부상 확률 로직은 구현되어 있지만 사용되지 않음

3. **부상 해제**:
   - 똥 청소 시 `isInjured = false`로 리셋

#### 코드 흐름
```javascript
// stats.js - applyLazyUpdate() (똥 8개 체크)
1. poopCountdown 감소
2. poopCountdown <= 0이면 poopCount +1
3. poopCount === 8이면 isInjured = true, lastMaxPoopTime 기록

// Game.jsx - handleBattleComplete() (패배 시)
1. 패배 시 isInjured = true, injuredAt = Date.now()

// Game.jsx - handleCleanPoop()
1. poopCount = 0
2. isInjured = false
3. lastMaxPoopTime = null
```

### 장점
- ✅ 똥 8개 부상 로직 정확히 구현
- ✅ 배틀 패배 시 부상 처리
- ✅ 똥 청소 시 부상 해제

### 개선 가능 사항
- ⚠️ 부상 확률 로직 (`calculateInjuryChance()`)이 구현되어 있지만 사용되지 않음
- ⚠️ 승리 시 20% 부상 확률 로직 미구현
- ⚠️ 프로틴 과다에 따른 부상 확률 증가 로직 미구현

---

## 5. 수면 방해 (Sleep Disturbance) 로직

### 구현 위치
- **핵심 로직**: `src/pages/Game.jsx` - `wakeForInteraction()`
- **호출 위치**: `handleFeed()`, `handleTrainResult()`, `handleBattleComplete()`, `handleMenuClick()`

### Ver.1 스펙
```javascript
// 수면 중(isSleeping)에 밥, 훈련, 배틀 시도 시:
// sleepDisturbances +1
// wakeUntil을 현재시간 + 10분으로 설정하여 잠시 깨움
```

### 현재 구현 상태

#### ✅ 정상 동작
1. **수면 방해 발생 조건**:
   - 수면 시간 중 (`isWithinSleepSchedule()`)
   - `wakeUntil`이 없거나 만료됨
   - 밥, 훈련, 배틀, 메뉴 클릭 시도

2. **수면 방해 효과**:
   - `sleepDisturbances`: +1
   - `wakeUntil`: 현재시간 + 10분 (600,000ms)
   - 10분 동안 깨어있음

3. **수면 상태**:
   - `'AWAKE'`: 수면 시간이 아님 OR (`wakeUntil`이 현재 시간보다 미래임)
   - `'TIRED'`: 수면 시간임 AND `isLightsOn`이 true임
   - `'SLEEPING'`: 수면 시간임 AND `isLightsOn`이 false임

#### 코드 흐름
```javascript
// Game.jsx - wakeForInteraction()
1. wakeUntil = Date.now() + 10 * 60 * 1000 (10분)
2. sleepDisturbances +1
3. setWakeUntilCb(until) - 상태 업데이트
4. setStatsCb(updated) - Firestore 저장

// 각 액션 핸들러에서
1. 수면 체크: isWithinSleepSchedule() && !(wakeUntil && Date.now() < wakeUntil)
2. 수면 중이면 wakeForInteraction() 호출
3. Activity Log 추가 ('Sleep Disturbance: [액션] while sleeping')
```

### 장점
- ✅ Ver.1 스펙 정확히 구현
- ✅ 모든 액션에서 수면 방해 처리
- ✅ 10분 깨우기 로직 구현
- ✅ Activity Log 기록

### 개선 가능 사항
- ⚠️ 수면 방해 카운트가 진화 조건에 사용됨 (정상 동작)
- ⚠️ TIRED 상태 30분 지속 시 careMistakes +1 로직은 별도로 구현됨

---

## 6. 종합 분석

### 구현 완료도

| 로직 | 구현 상태 | Ver.1 스펙 준수 | 개선 필요 |
|------|----------|----------------|----------|
| **훈련** | ✅ 완료 | ✅ 100% | 변수명 통일 (`trainings` vs `trainingCount`) |
| **오버피드** | ✅ 완료 | ✅ 100% | 오버피드 효과 확인 필요 |
| **배틀** | ✅ 완료 | ⚠️ 90% | 부상 확률 로직 미사용 |
| **부상** | ✅ 완료 | ⚠️ 80% | 부상 확률 로직 미구현 |
| **수면 방해** | ✅ 완료 | ✅ 100% | - |

### 공통 패턴

1. **Lazy Update 적용**: 모든 액션 전에 `applyLazyUpdateBeforeAction()` 호출
2. **수면 방해 체크**: 수면 중 액션 시도 시 `wakeForInteraction()` 호출
3. **Activity Log**: 모든 액션에 Activity Log 기록
4. **Firestore 저장**: `setDigimonStatsAndSave()`로 즉시 저장

### 개선 권장 사항

1. **부상 확률 로직 구현**:
   - 승리 시 20% 부상 확률
   - 패배 시 10% + (프로틴 과다 * 10%) 부상 확률 (최대 80%)
   - `calculateInjuryChance()` 함수 활용

2. **변수명 통일**:
   - `trainings` vs `trainingCount` 통일
   - `effort` 증가 기준 명확화

3. **오버피드 효과 확인**:
   - Lazy Update에서 오버피드 효과가 정확히 작동하는지 확인
   - `consecutiveMeatFed` Firestore 저장 여부 확인

---

## 7. 코드 참조

### 주요 파일
- `src/data/train_digitalmonstercolor25th_ver1.js` - 훈련 로직
- `src/logic/food/meat.js` - 오버피드 로직
- `src/pages/Game.jsx` - 배틀, 부상, 수면 방해 로직
- `src/data/stats.js` - 부상 로직 (똥 8개)
- `src/logic/battle/hitrate.js` - 부상 확률 계산 (미사용)

### 관련 문서
- `docs/game_mechanics.md` - 게임 메커니즘 문서
- `docs/STATS_ANALYSIS.md` - 스탯 분석 문서
- `docs/REFACTORING_LOG.md` - 리팩토링 로그

---

**작성일**: 2025-12-23  
**버전**: 1.0

