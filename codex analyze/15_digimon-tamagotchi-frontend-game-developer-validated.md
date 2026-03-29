# Digimon Tamagotchi Frontend Game Developer Review

작성일: 2026-03-29

`game-developer` 정의를 확인한 뒤, 게임플레이 루프와 규칙 일관성 중심으로 정적 리뷰를 진행했다.

## 분석한 도메인 경계와 워크플로우

- 정상 경로: 먹이주기 -> 훈련 -> 배틀 -> 진화
- 실패 경로: 배고픔/힘 0 -> 콜 -> 케어미스 -> 사망
- 통합 경계: 실시간 1초 타이머, lazy update, Firestore 저장/복구, 냉장고 시간 제외 처리

검토한 핵심 파일:

- `src/pages/Game.jsx`
- `src/hooks/useGameActions.js`
- `src/hooks/useEvolution.js`
- `src/hooks/useDeath.js`
- `src/data/stats.js`
- `src/logic/stats/*.js`
- `src/logic/evolution/checker.js`
- `src/logic/battle/*.js`
- `src/logic/food/*.js`
- `src/logic/training/train.js`
- `src/data/train_digitalmonstercolor25th_ver1.js`

## 총평

좋은 점부터 보면, 진화 조건을 `src/data/v1/digimons.js` 데이터로 선언하고 `src/logic/evolution/checker.js`가 해석하는 구조는 꽤 괜찮다. 또 `src/data/stats.js`의 lazy update는 수면 시간 제외, 콜 타임아웃 재구성, 과거 로그 backfill까지 고려해서 도메인 모델을 진지하게 반영하려고 한 흔적이 있다.

다만 현재 규칙 품질의 가장 큰 문제는 "같은 게임 규칙을 계산하는 엔진이 여러 개"라는 점이다. 실시간 타이머, 실제 런타임 lazy update, `logic/` 폴더의 순수 함수, 일부 `data/` 레거시 로직이 서로 다른 규칙을 갖고 있다. 이 구조에서는 플레이어가 "앱을 켜 두었는지", "배틀 상대가 어떤 snapshot으로 저장됐는지", "어느 구현을 테스트했는지"에 따라 체감 결과가 달라질 수 있다.

## 우선순위 높은 규칙 리스크

### 1. [P1] 실시간 타이머와 lazy update가 같은 시간 규칙을 적용하지 않는다

가장 큰 게임플레이 리스크다. 앱을 켜 둔 상태와 닫았다가 돌아온 상태가 같은 결과를 내지 않을 수 있다.

근거:

- 실시간 경로는 `handleHungerTick()`와 `handleStrengthTick()`가 countdown이 0 이하가 되어도 한 번만 감소시키고 카운트다운을 한 사이클 값으로 리셋한다.
  - `src/logic/stats/hunger.js:14-42`
  - `src/logic/stats/strength.js:14-42`
- `updateLifespan()`도 `poopCountdown <= 0`일 때 배변을 한 번만 증가시킨다.
  - `src/logic/stats/stats.js:128-173`
- 반면 실제 런타임 lazy update는 `while` 루프로 여러 사이클을 모두 소급 적용한다.
  - `src/data/stats.js:387-559`
- `Game.jsx`의 실시간 타이머는 `safeElapsedSeconds`를 넘겨 실제 경과 시간을 반영하려 하지만, 하위 함수가 여러 사이클을 소화하지 못하므로 결국 큰 delta에서 드리프트가 난다.
  - `src/pages/Game.jsx:505-514`

플레이어 기준 문제 시나리오:

- 브라우저 탭이 background throttling에 걸려 몇 분 뒤 깨어났을 때, 배고픔/힘/배변이 실제보다 덜 줄어들 수 있다.
- 같은 30분 경과라도 "앱을 켜 둔 경우"와 "앱을 닫고 돌아온 경우"의 스탯, 케어미스, 사망 판정 시점이 달라질 수 있다.

가장 작은 안전한 다음 단계:

- 시간 기반 규칙의 canonical source를 하나로 정하고, 실시간 경로도 "여러 사이클 경과"를 같은 규칙으로 처리하도록 characterization 테스트부터 고정해야 한다.

### 2. [P1] 사망 조건이 timer / lazy update / death hook 사이에서 완전히 같은 규칙이 아니다

현재 사망 규칙은 한 곳에서만 결정되지 않는다. 이건 굶주림/탈진/부상 방치 같은 핵심 실패 조건에 직접 영향을 준다.

근거:

- `useDeath.checkDeathCondition()`은 냉장고 시간을 제외해서 굶주림/탈진/부상 방치를 판정한다.
  - `src/hooks/useDeath.js:123-192`
- `Game.jsx` 실시간 타이머 경로의 굶주림/탈진 사망 체크는 `Date.now() - lastHungerZeroAt` / `lastStrengthZeroAt`를 그대로 사용하고, 냉장고 시간 제외 로직을 적용하지 않는다.
  - `src/pages/Game.jsx:632-678`
- `useGameData.checkDeathStatus()`도 굶주림/탈진에는 냉장고 제외를 쓰지 않고, 부상 방치에만 `getElapsedTimeExcludingFridge()`를 사용한다.
  - `src/hooks/useGameData.js:388-426`

플레이어 기준 문제 시나리오:

- 배고픔 0 상태에서 냉장고에 넣은 시간이 경로에 따라 사망 타이머에서 제외되기도 하고, 제외되지 않기도 한다.
- 오프라인 복귀 후 death popup 이유와 라이브 플레이 중 사망 이유가 다르게 잡힐 수 있다.

가장 작은 안전한 다음 단계:

- 사망 판정 함수를 단일화하고, 굶주림/탈진/부상 방치 모두 냉장고 제외 규칙을 같은 함수에서 판정하게 해야 한다.

### 3. [P1] 훈련과 먹이 규칙의 소스가 중복되어 있고, 서로 내용도 다르다

이 프로젝트에서 가장 위험한 "규칙 드리프트" 지점이다. `logic/`을 읽고 테스트를 추가해도 실제 런타임 규칙을 보장하지 못한다.

근거:

- 실제 훈련 런타임은 `logic/training/train.js`가 아니라 `data/train_digitalmonstercolor25th_ver1.js`를 import해서 사용한다.
  - `src/hooks/useGameActions.js:4-8`
  - `src/data/train_digitalmonstercolor25th_ver1.js:13-58`
- 그런데 `logic/training/train.js`의 Ver.1 규칙은 런타임 훈련 규칙과 다르다.
  - `src/logic/training/train.js:15-63`
  - 차이 예시:
    - 런타임 훈련은 성공/실패와 무관하게 체중 -2, 에너지 -1, 성공 시 힘 +1
    - `logic/training/train.js`는 5히트 대성공 시 체중 -4, 힘 +3이라는 별도 규칙을 갖고 있다.
- Ver.2/3/5 훈련은 `logic/training/train.js`에 TODO placeholder로 남아 있다.
  - `src/logic/training/train.js:65-111`
- 고기 규칙도 두 군데에 존재하며 semantics가 다르다.
  - `src/logic/food/meat.js:12-74`
  - `src/logic/stats/hunger.js:53-97`
  - 한쪽은 "거절 상태에서 먹이면 즉시 overfeed", 다른 쪽은 "가득 찬 뒤 10개 더 먹여야 overfeed" 규칙이다.

플레이어 기준 문제 시나리오:

- 문서, 테스트, 향후 리팩터링이 어느 구현을 기준으로 하느냐에 따라 훈련/오버피드 결과가 달라질 수 있다.
- 훈련 minigame을 다른 버전으로 늘릴 때 placeholder 로직을 잘못 연결하면 실제 게임성이 갑자기 바뀔 수 있다.

가장 작은 안전한 다음 단계:

- 현재 런타임 기준 규칙을 먼저 "정답"으로 선언하고, 중복 구현 중 나머지는 deprecated 문서화 또는 테스트 fixture 용도로만 남겨야 한다.

### 4. [P2] 케어미스는 hunger/strength는 오프라인 재구성이 되지만 sleep은 실시간 전용이라 규칙이 비대칭이다

이건 진화 경로에 영향을 줄 수 있는 조용한 리스크다.

근거:

- lazy update는 배고픔/힘 콜 10분 무시를 과거 재구성해서 `careMistakes`와 backdated 로그를 추가한다.
  - `src/data/stats.js:724-909`
- 하지만 수면 콜은 lazy update에서 처리하지 않는다고 명시돼 있다.
  - `src/data/stats.js:912-914`
- 실제 수면 케어미스 증가는 `Game.jsx` 실시간 타이머에서 `TIRED` 상태를 보고 처리한다.
  - `src/pages/Game.jsx:550-560`
  - `src/pages/Game.jsx:702-747`

플레이어 기준 문제 시나리오:

- 앱을 켜 둔 상태로 수면 시간을 넘기면 sleep 관련 케어미스가 쌓이는데, 앱을 닫아 둔 상태로 같은 시간을 넘기면 같은 방식으로 재구성되지 않을 수 있다.
- 결과적으로 진화 조건용 `careMistakes`와 `sleepDisturbances`가 플레이 스타일이 아니라 세션 상태에 따라 달라질 수 있다.

가장 작은 안전한 다음 단계:

- sleep 콜/수면 방해를 오프라인 복귀에서도 어떻게 판정할지 명시적으로 결정하고, 지금처럼 "실시간만 처리"가 의도라면 문서와 테스트에 그 제약을 박아야 한다.

### 5. [P2] 아레나 배틀은 상대 power가 snapshot/basePower fallback에 의존해 실제 육성 상태를 반영하지 못할 수 있다

배틀 수식 자체보다 "상대 파워 입력값"의 품질이 더 위험하다.

근거:

- 유저 측은 `calculatePower()`로 basePower + strength bonus + traited egg bonus + effort bonus를 계산한다.
  - `src/logic/battle/hitrate.js:84-140`
  - `src/logic/battle/calculator.js:57-66`
- 반면 적 측은 `enemyStats.power || basePower`만 사용한다.
  - `src/logic/battle/calculator.js:67-85`
- `BattleScreen`도 arena challenger의 snapshot power가 없으면 basePower로만 적을 세팅한다.
  - `src/components/BattleScreen.jsx:162-180`
- `calculateHitrate()` helper와 `calculateHitRate()` calculator도 미세하게 다르다. 후자는 0/0일 때 50을 반환하지만, 전자는 zero denominator guard가 없다.
  - `src/logic/battle/hitrate.js:12-29`
  - `src/logic/battle/calculator.js:16-31`

플레이어 기준 문제 시나리오:

- 상대 슬롯 snapshot에 `power`가 없거나 오래된 값이면, 실제로는 강한 상대가 basePower만 가진 약한 적처럼 계산될 수 있다.
- 배틀 결과가 "육성 결과"보다 "저장된 snapshot 형식"에 더 크게 흔들릴 수 있다.

가장 작은 안전한 다음 단계:

- arena entry snapshot에 무엇을 canonical combat state로 저장할지 먼저 고정하고, user/enemy 모두 같은 power 계산 정책을 쓰게 맞춰야 한다.

### 6. [P2] 진화 판정 자체는 꽤 좋지만, jogress와 진화 후 리셋 규칙이 다른 계층에 흩어져 있다

진화 시스템은 이 프로젝트의 강한 부분이지만, edge case reasoning은 아직 어렵다.

근거:

- 일반 진화 조건 해석기는 data-driven 구조로 잘 되어 있다.
  - `src/logic/evolution/checker.js:19-156`
- 다만 `conditionGroups`는 첫 번째 실패 그룹만 detail에 남기고, jogress는 여기서 아예 skip된다.
  - `src/logic/evolution/checker.js:97-117`
- 진화 후 reset 규칙은 checker가 아니라 `useEvolution.evolve()` 안에 있다.
  - `src/hooks/useEvolution.js:225-260`

플레이어 기준 문제 시나리오:

- OR 조건이 많은 성숙기/완전체 분기에서 "왜 진화가 안 됐는지" 설명이 실제 부족 조건과 다르게 보일 수 있다.
- jogress는 별도 규칙이라 일반 진화 테스트만으로는 전체 진화 시스템의 회귀를 잡지 못한다.

가장 작은 안전한 다음 단계:

- 일반 진화, jogress, 진화 후 reset을 각각 독립 테스트 대상으로 나누고, 문서상으로도 "한 함수가 모든 진화를 판정하지 않는다"는 점을 분명히 해야 한다.

## 도메인적으로 비교적 안정적인 부분

- 진화 조건 자체는 `src/data/v1/digimons.js` 데이터와 `src/logic/evolution/checker.js` 해석기 조합이 잘 맞물린다.
- 프로틴 규칙은 구현 자체만 놓고 보면 self-consistent하다. strength 누적, energy 회복 트리거, protein overdose 상한이 명확하다.
  - `src/logic/food/protein.js:12-66`
- hunger/strength 콜 timeout의 오프라인 재구성은 일반적인 SPA 게임보다 훨씬 신경 써서 구현돼 있다.
  - `src/data/stats.js:724-909`

## 가장 작은 안전한 개선 순서

1. 시간 기반 규칙 characterization 테스트 추가
   - 대상: "실시간 30분 경과"와 "lazy update 30분 경과"가 같은 결과를 내는지
2. 사망 판정 함수 단일화
   - 대상: 굶주림, 탈진, 부상 방치, 냉장고 시간 제외
3. 훈련/먹이 canonical runtime source 확정
   - 대상: `data/train_*`, `logic/training/*`, `logic/food/meat.js`, `logic/stats/hunger.js`
4. arena 상대 power 계약 고정
   - 대상: snapshot schema와 `simulateBattle()` 입력값
5. sleep care mistake의 오프라인 정책 명문화
   - 대상: "실시간 only"인지 "복귀 시 재구성"인지 결정

## 이번 리뷰에서 확인한 경로

- 정상 경로 확인: 먹이/훈련/배틀/진화 흐름과 각 규칙 소스 연결
- 실패 경로 확인: 배고픔 0/힘 0/부상 방치 -> 케어미스/사망 판정 경로
- 통합 엣지 확인: 실시간 타이머와 lazy update가 같은 결과를 내는지 여부, 냉장고/오프라인 복귀 예외

## 남아 있는 환경 수준 검증

- 실제 브라우저 background throttling 상태에서 20~40분 방치 후 hunger/strength/poop parity 확인
- 냉장고 진입/해제 후 굶주림 사망 타이머가 어느 경로에서 어떻게 계산되는지 수동 검증
- 야간 수면 시간에 앱을 켜 둔 경우 vs 닫아 둔 경우의 sleep care mistake 비교
- arena challenger snapshot에 `power`가 없는 경우와 있는 경우의 승률 차이 수동 검증

## 결론

현재 프로젝트의 게임 규칙 구현은 "아이디어와 데이터 설계는 좋지만, 실제 규칙 집행 엔진이 여러 갈래로 나뉜 상태"에 가깝다. 가장 큰 리스크는 시간 기반 스탯과 사망 조건의 경로별 불일치다. 플레이어가 시스템을 잘 이해해서 육성한 결과보다, 앱을 켜 뒀는지 닫았는지 같은 세션 형태가 결과를 바꿀 가능성이 현재는 더 크게 보인다.
