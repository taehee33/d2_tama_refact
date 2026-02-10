# 케어미스 이력 vs 카운터 불일치 · 중복 로그 점검 및 개선

## 1. 현재 코드 vs 제안안 비교

### 1.1 로그–카운트 동기화 (Single Source of Truth)

| 구분 | 제안 | 현재 코드 |
|------|------|-----------|
| 원칙 | "로그가 추가될 때만 숫자 올리기" / 또는 카운트를 로그 개수로 표시 | **이원화**: `careMistakes`는 `applyLazyUpdate`·`checkCallTimeouts`·`GameModals`(놀아주기/괴롭히기) 등 여러 곳에서 직접 증감 |
| 실시간 | addActivityLog와 한 몸으로 | **Game.jsx**: `checkCallTimeouts()`가 먼저 `careMistakes +1` → 그 다음 `addActivityLog()`로 로그 추가. `lastAddedCareMistakeKeysRef`로 같은 틱 내 중복 로그만 방지 |
| 과거 재구성 | 로그 추가 시에만 +1 | **data/stats.js applyLazyUpdate**: `careMistakes +1`과 `pushBackdatedActivityLog()`가 같은 if 블록 안에서 함께 수행됨 (동기화는 되어 있음) |

**불일치 원인 후보**

- **진화 리셋**: `careMistakes`는 진화 시 0으로 리셋(`logic/stats/stats.js`, `data/stats.js`)하지만, **activityLogs는 비우지 않음** → 이력 건수(25)는 누적, 카운터(17)는 진화 후 누적.
- **중복 로그만 쌓임**: 아래 타임스탬프 버그로 과거 재구성 시 로그가 중복 추가되면, 로그 수만 늘고 카운트는 가드에 의해 덜 올라갈 수 있음.

---

### 1.2 과거 재구성 · 동일 사유 중복 방지

| 구분 | 제안 | 현재 코드 |
|------|------|-----------|
| 시간 범위 | (추가 로그 시각) - (기존 로그 시각) < 10~15분이면 동일 사건으로 간주하고 무시 | **alreadyHasLogInWindow**: `timeMs ± 120000` (2분) 사용. 2분보다 넓은 “같은 사건”이면 중복 허용됨 |
| 타임스탬프 비교 | 기준 시각으로 비교 | **alreadyHasBackdatedLog**: `log.timestamp === timestampMs` **숫자만** 비교. Firestore에서 `timestamp`가 `{ seconds, nanoseconds }` 형태로 오면 **항상 false** → 중복 체크 실패, **[과거 재구성] 로그가 매번 추가되는 버그** |
| isLogged | 과거 재구성 시 이미 isLogged면 로그 추가 안 함 | **적용됨**: `alreadyLogged === true`이면 로그/카운트 모두 추가하지 않음. 다만 **isLogged가 DB에 제때 저장되지 않거나** 새로고침 시 초기화되면 중복 가능 |

**결론**: `alreadyHasBackdatedLog`에서 **타임스탬프를 ms 숫자로 정규화해 비교**해야 함. `alreadyHasLogInWindow`는 2분 → 10~15분으로 넓히면 “같은 케어미스” 판단이 안정적.

---

### 1.3 isLogged 생명주기

| 구분 | 제안 | 현재 코드 |
|------|------|-----------|
| 리셋 시점 | 배고픔/힘을 채우면 `isLogged = false` | **data/stats.js**: `fullness > 0` 또는 `strength > 0`이면 `callStatus.hunger/strength` 전체 리셋 시 `isLogged: false` 설정됨 |
| 새 호출 시작 | startedAt 생성 시 `isLogged = false` | **미설정**: `startedAt`만 세팅하고 `isLogged`는 별도 초기화 없음. 다만 위 리셋 시 false가 되므로 실질적으로는 새 호출 시 false |
| 과거 재구성 | 이미 isLogged면 로그 추가 안 함 | **적용됨**: `!alreadyLogged`일 때만 로그+카운트 추가 |

---

### 1.4 addLogWithGuard / addCareMistakeLog

| 구분 | 제안 | 현재 코드 |
|------|------|-----------|
| 통합 유틸 | `addCareMistakeLog(currentStats, callType, occurredAt)`로 로그+카운트+플래그 일괄 처리 | **분산**: applyLazyUpdate 내부에서 `alreadyLogged`·`alreadyHasBackdatedLog`·`alreadyHasLogInWindow` 체크 후 `careMistakes +1`, `pushBackdatedActivityLog`, `isLogged = true` 수행. useGameLogic의 `addActivityLog`는 `hasDuplicateCareMistakeLog`(2분)로 중복 방지 |
| 시간 창 | 15분 내 동일 타입 로그 있으면 중복 | **alreadyHasLogInWindow**: 2분. **hasDuplicateCareMistakeLog**: 2분 |

---

## 2. 점검 요약

| 점검 항목 | 해결 방법 |
|-----------|-----------|
| 로그 vs 숫자 불일치 | (1) **표시용**: 진화 판정 카운터 옆에 “(이번 진화 구간)” 주석 또는, 이력 건수는 “전체”, 카운터는 “현재 구간”으로 명확히 구분. (2) **근본**: careMistakes 증감을 **한 곳**(예: 로그 추가 함수)에서만 하거나, 표시 시 `activityLogs`에서 `CAREMISTAKE` 개수를 세어 사용 |
| 과거 재구성 중복 | **alreadyHasBackdatedLog**에서 `log.timestamp`를 Firestore Timestamp/숫자 모두 ms로 정규화 후 비교. **alreadyHasLogInWindow** 윈도우를 2분 → 10~15분으로 확대 |
| 새로고침 시 isLogged | callStatus(및 isLogged)를 Firestore에 **반드시 저장**하도록 saveStats/영속화 경로 확인 |
| 판정 “증발” | fullness > 0 / strength > 0이 되는 순간 isLogged를 false로 리셋하는지 확인 → **현재 코드에서 이미 수행 중** |

---

## 3. 적용 권장 수정 (우선순위)

1. **✅ 적용함**: `data/stats.js`의 **alreadyHasBackdatedLog**에서 `log.timestamp`를 ms 숫자로 정규화해 비교 (Firestore `{ seconds, nanoseconds }` 지원). → 과거 재구성 시 **[과거 재구성]** 로그 중복 방지.
2. **✅ 적용함**: **alreadyHasLogInWindow**의 windowMs를 `120000`(2분) → `15 * 60 * 1000`(15분)으로 변경. 동일 사유·비슷한 시각 로그를 같은 사건으로 간주.
3. **선택**: UI에서 “Care Mistakes: 17” 옆에 “(진화 구간 기준)” 또는 이력과 동일한 정의(로그 개수)로 표시해 불일치가 자연스럽게 설명되도록 안내.

---

## 4. 보조 정리

### 4.1 logTimestampToMs 안전성

- **null/undefined**: `log` 또는 `log.timestamp`가 null/undefined면 **예외 없이 null 반환**.
- **파싱 실패**: 숫자/ Firestore Timestamp/ Date 호환 외 값은 `new Date(t)` 후 `isNaN(d.getTime())`이면 null. `try/catch`로 비정상 값도 예외 없이 null 반환.
- **의도**: “현재 시간 대체”가 아니라 **“알 수 없으면 null”**로 두고, 호출부(alreadyHasBackdatedLog, alreadyHasLogInWindow)에서 null을 “매칭 안 됨”으로 처리.

### 4.2 이번 진화 시작 시각 기록 (lastEvolvedAt 역할)

- **필드명**: `evolutionStageStartedAt` (이번 진화 구간 시작 시각, lastEvolvedAt과 동일 목적).
- **기록 시점**: `data/stats.js`의 `initializeStats()`에서
  - **새 시작**(디지타마/디지타마V2): `evolutionStageStartedAt = birthTime || Date.now()`
  - **진화로 단계 변경**: `evolutionStageStartedAt = Date.now()`
- **사용처**: StatsPopup 케어미스 이력 필터 — `log.timestamp >= evolutionStageStartedAt`인 로그만 표시 → Care Mistakes 카운터와 일치.
- 진화 시 `careMistakes`를 0으로 리셋할 때 같은 `initializeStats` 호출에서 `evolutionStageStartedAt`이 설정되므로, **다음 단계 케어미스만** 이력/카운터에 반영됨.

---

## 5. 영향 파일

- `digimon-tamagotchi-frontend/src/data/stats.js` — logTimestampToMs, alreadyHasBackdatedLog, alreadyHasLogInWindow, applyLazyUpdate, initializeStats(evolutionStageStartedAt)
- `digimon-tamagotchi-frontend/src/pages/Game.jsx` — 1초 타이머, checkCallTimeouts 후 로그 추가
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js` — checkCallTimeouts, addActivityLog, hasDuplicateCareMistakeLog
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx` — 케어미스 이력 건수 표시, Care Mistakes 표시(진화 구간 기준 문구·툴팁)
