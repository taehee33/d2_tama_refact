# Digimon Tamagotchi Frontend PR Review

작성일: 2026-03-29

## 검토 범위

- correctness
- regression risk
- missing tests
- 중점 영역: 시간 기반 스탯 변경, lazy update, 진화 조건, 배틀 계산, 저장 시점, 모달 상태 관리

`reviewer` 스킬은 현재 세션에 없어 동일 기준으로 코드베이스를 직접 검토했다. 코드 수정은 하지 않았고, 위험도가 높은 구조/동작 문제를 우선순위대로 정리했다.

## 주요 Findings

### [P1] Lazy update 사망 판정이 냉장고 시간을 제외하지 않아 오프라인 복귀 시 조기 사망 가능성이 크다

- `src/data/stats.js:655-706`의 `applyLazyUpdate()`는 `lastHungerZeroAt`, `lastStrengthZeroAt`, `injuredAt` 기준 사망 판정을 할 때 단순 wall-clock 경과시간을 사용한다.
- 같은 프로젝트의 다른 사망 경로는 냉장고 보관 시간을 제외하려고 별도 계산을 하고 있다.
  - `src/hooks/useDeath.js:123-193`
  - `src/hooks/useGameData.js:388-426`
  - `src/pages/Game.jsx:661-678`
- 즉, 실시간 경로와 lazy update 경로의 사망 규칙이 서로 다르다. 사용자가 냉장고에 넣어둔 뒤 복귀했을 때, UI 타이머 경로에서는 살아 있는데 lazy update 복구 시점에 즉시 죽는 식의 불일치가 생길 수 있다.

왜 위험한가:

- 시간 기반 핵심 규칙이 경로마다 달라서 재현이 어려운 버그가 된다.
- 오프라인 복귀, 탭 백그라운드 복귀, 저장 직전 액션 같은 실제 사용자 흐름에서 발생할 가능성이 높다.

필요한 테스트:

- 냉장고 진입 전 `hunger=0` 또는 `strength=0` 상태에서 12시간 경계 테스트
- 부상 방치 6시간 판정 시 냉장고 시간이 제외되는지 테스트
- `applyLazyUpdate()`와 실시간 사망 판정의 결과 일치성 테스트

### [P1] 실시간 타이머가 지연된 시간을 한 번에 따라잡지 못해 배고픔/힘 감소가 누락된다

- `src/pages/Game.jsx:457-468`에서 타이머 지연분을 `safeElapsedSeconds`로 계산하고, 최대 60초까지 한 번에 반영한다.
- 하지만 실제 감소 함수는 다중 사이클을 처리하지 않는다.
  - `src/logic/stats/hunger.js:26-39`
  - `src/logic/stats/strength.js:26-39`
- 두 함수 모두 countdown이 0 이하가 되어도 한 번만 감소시키고 전체 사이클로 리셋한다. 예를 들어 60초 동안 여러 hunger/strength cycle이 지나도 1회 감소만 적용될 수 있다.

왜 위험한가:

- 포그라운드 상태와 lazy update 후 상태가 달라진다.
- call 발생 시점, care mistake, 사망 카운트 진입 시점이 달라질 수 있다.
- 브라우저 throttling, 모바일 백그라운드 복귀, 저사양 환경에서 재현될 가능성이 있다.

필요한 테스트:

- `deltaSec`가 1 cycle보다 큰 경우 누적 감소 횟수 검증
- 30초, 60초, 여러 cycle을 넘는 경우 실시간 업데이트와 lazy update 결과 비교
- 탭 백그라운드 복귀 시 `callStatus`와 countdown 복원 테스트

### [P1] Ver.2 재시작/환생 경로가 “새 시작”으로 인식되지 않아 저장 시 lazy update가 잘못 끼어들 수 있다

- `src/hooks/useGameData.js:145-148`의 `saveStats()`는 `newStats.evolutionStage === "Digitama"`일 때만 새 시작으로 보고 lazy update를 건너뛴다.
- 그런데 `src/pages/Game.jsx:1208-1210`의 Ver.2 리셋 경로는 `initializeStats(..., "DigitamaV2")`를 사용한다.
- 즉 Ver.2는 새로 시작한 직후에도 save 단계에서 일반 슬롯처럼 다시 lazy update 경로를 탈 수 있다.

왜 위험한가:

- 초기 countdown, lifespan, timeToEvolve, death 관련 타임스탬프가 잘못 재계산될 수 있다.
- Ver.1과 Ver.2 동작 차이가 숨은 회귀로 남는다.
- 리셋/환생 직후 상태가 즉시 변질되면 사용자가 가장 먼저 체감하는 버그가 된다.

필요한 테스트:

- Ver.1/Ver.2 각각 환생 직후 첫 저장에서 `lastSavedAt`, countdown, lifespan이 의도대로 유지되는지 비교
- `Digitama`와 `DigitamaV2` 초기화 후 `saveStats()` 결과 스냅샷 테스트

### [P1] 아레나 배틀이 상대 데이터/파워를 잘못 해석할 가능성이 있어 Ver.2 및 파생 파워 계산에서 오판정 위험이 있다

- `src/components/BattleScreen.jsx:156-160`은 아레나 상대 디지몬 데이터를 `newDigimonDataVer1`에서만 찾는다.
- 반면 스파링 경로는 `v1/v2`를 모두 본다 (`src/components/BattleScreen.jsx:81-100`).
- 또한 아레나 경로는 `snapshotPower` 또는 `basePower` 중심으로 상대 파워를 결정한다 (`src/components/BattleScreen.jsx:162-166`).
- 이 방식은 스냅샷에 파생 파워가 완전히 들어있지 않으면 strength 보너스, traited egg 보정 같은 런타임 계산과 어긋날 수 있다.

왜 위험한가:

- Ver.2 상대가 추가될수록 특정 배틀만 판정이 틀어지는 형태의 회귀가 생길 수 있다.
- 스파링과 아레나가 같은 규칙을 쓴다고 기대하는데 실제 계산 계약이 달라진다.
- 밸런스 문제처럼 보여도 실질적으로는 correctness 이슈가 된다.

필요한 테스트:

- v1/v2 상대 각각에 대한 아레나 배틀 파워 계산 테스트
- `snapshotPower`가 없을 때와 있을 때 결과 일관성 테스트
- 스파링/아레나 동일 상대에 대한 판정 차이 회귀 테스트

### [P2] 저장 시점이 여러 군데로 분산되어 있어 실패/중단 시 슬롯 상태와 부가 데이터가 쉽게 어긋날 수 있다

- 아레나 결과 저장은 원격 랭킹/배틀 로그 갱신과 로컬 슬롯 스탯 저장이 분리되어 있다.
  - `src/hooks/useGameActions.js:665-800`
  - `src/hooks/useGameActions.js:814-895`
- `selectedDigimon` 저장도 `Game.jsx`에서 스탯 저장과 분리된 별도 write를 한다.
  - `src/pages/Game.jsx:1048-1067`
- 조명 토글은 `setDigimonStatsAndSave()` 후 Firestore에 `isLightsOn`를 한 번 더 직접 갱신한다.
  - `src/hooks/useGameHandlers.js:308-323`

왜 위험한가:

- 한 write만 성공하고 다른 write가 실패하면 battle stats, logs, selectedDigimon, UI 상태가 서로 어긋난다.
- 탭 종료, 네트워크 불안정, 다중 디바이스 환경에서 상태 일관성이 깨질 수 있다.
- 회귀가 나도 “가끔 저장이 이상하다” 수준으로 보여 추적이 어렵다.

필요한 테스트:

- 저장 중간 실패를 가정한 부분 성공/부분 실패 시나리오 테스트
- 아레나 결과 반영 직후 slot 문서와 ranking 문서 일관성 테스트
- 조명 토글 후 새로고침 시 `isLightsOn`와 `digimonStats`가 일치하는지 테스트

### [P2] 모달 상태 관리가 커진 상태에서 충돌 방지가 약하고 close/reset 정의도 드리프트 조짐이 있다

- `src/hooks/useGameState.js:160-224`에서 20개 이상의 모달을 단일 boolean map으로 관리한다.
- `src/hooks/useGameState.js:377-420`의 `closeAllModals()`에는 중복 key가 보이고, 전체적으로 “어떤 모달은 동시에 열리면 안 된다”는 제약이 코드로 강제되지 않는다.

왜 위험한가:

- 새 모달 추가 시 `initial state`, `closeAllModals`, open flow, escape/backdrop 동작이 쉽게 어긋난다.
- 액션 도중 다른 모달을 열었을 때 저장/애니메이션/포커스가 꼬일 수 있다.
- 지금은 UI 문제처럼 보여도 상태 플래그가 게임 흐름과 연결되어 있어 회귀 파급 범위가 넓다.

필요한 테스트:

- 주요 모달 조합에 대한 열기/닫기 전이 테스트
- 배틀/진화/수면방해 같은 흐름에서 금지되어야 하는 동시 모달 조합 테스트

## Missing Tests

현재 테스트 파일은 사실상 `src/App.test.js`만 있다. 위험도가 높은 규칙이 대부분 무테스트 상태다. 최소한 아래 테스트 세트가 필요하다.

- `applyLazyUpdate()` 단위 테스트
  - 냉장고 시간 제외
  - 수면 시간 제외
  - hunger/strength/poop 누적 재구성
  - death/callStatus 경계 시간
- 실시간 타이머 단위 테스트
  - `handleHungerTick()`
  - `handleStrengthTick()`
  - 긴 `deltaSec` 입력에서 누적 처리 검증
- 진화 조건 테스트
  - 조건 경계값
  - battle/winRatio 기준
  - stage별 진화 후보 선택
- 배틀 계산 테스트
  - v1/v2 상대 데이터
  - 아레나/스파링 규칙 일관성
  - 파워 계산 fallback 경로
- 저장 일관성 테스트
  - 부분 실패
  - 연속 save 호출
  - 로컬 상태와 Firestore 문서 동기화
- 모달 상태 전이 테스트
  - `closeAllModals()`
  - 동시 open 금지 시나리오
  - 장시간 애니메이션 중 모달 전환

## 총평

현재 코드베이스에서 가장 위험한 부분은 “시간 기반 규칙이 경로마다 다르게 구현되어 있다”는 점이다. 실시간 타이머, lazy update, save 직전 보정, 사망 판정이 완전히 같은 계약을 공유하지 않아 장시간 플레이나 복귀 시나리오에서 상태가 갈라질 가능성이 높다.

우선순위는 다음 순서로 보는 것이 적절하다.

1. lazy update와 실시간 사망/감소 규칙의 일치성 검증
2. Ver.2 초기화/환생 저장 경로 검증
3. 아레나 배틀 데이터 해석 일관성 검증
4. 분산 저장 시점에 대한 회귀 테스트 추가
5. 모달 상태 전이 규칙 명시 및 테스트 추가
