# Digimon Tamagotchi Frontend Game Rules Review

작성일: 2026-03-29

## 검토 범위

- 진화 조건
- 케어미스
- 배틀 명중률/파워 계산
- 사망 조건
- 배고픔/힘/배변/수명 변화
- 훈련과 먹이주기 로직

`game-developer` 스킬은 현재 세션에 없어 동일 기준으로 실제 규칙 구현을 직접 검토했다. 초점은 “코드가 돌아가는가”보다 “게임 플레이 기준으로 같은 규칙이 같은 결과를 내는가”였다.

## 총평

규칙 자체는 꽤 잘 문서화되어 있고, 진화 데이터도 data-driven 구조로 읽기 좋다. 문제는 규칙이 여러 파일과 여러 경로에 흩어져 있어, `실시간 타이머`, `lazy update`, `액션 Hook`, `배틀 화면`이 항상 같은 규칙을 공유하지 않는다는 점이다.

즉, 현재 프로젝트의 가장 큰 도메인 리스크는 “룰이 틀렸다”기보다 “같은 룰이 경로에 따라 다르게 적용된다”는 것이다.

## 주요 Findings

### [P1] 시간 기반 핵심 규칙이 `실시간`과 `lazy update`에서 다르게 돌아가 실제 플레이 결과가 갈릴 수 있다

- 실시간 배고픔/힘 감소는 `deltaSec`가 커도 한 번만 감소시킨다.
  - `src/logic/stats/hunger.js:26-39`
  - `src/logic/stats/strength.js:26-39`
- 하지만 `Game.jsx`는 브라우저 throttling을 고려해 한 번에 최대 60초를 넘겨준다.
  - `src/pages/Game.jsx:457-468`
  - `src/pages/Game.jsx:513-514`
- 반면 lazy update는 `while`로 여러 cycle을 한 번에 처리한다.
  - `src/data/stats.js:534-920`

게임 플레이에서 왜 문제인가:

- 탭이 백그라운드에 있다가 돌아오면, 화면에서 보이는 배고픔/힘은 덜 줄었는데 저장/로드 직후 갑자기 더 많이 줄어든 상태로 보정될 수 있다.
- 케어미스 시작 시점, 콜 발생 시점, 사망 카운트 진입 시점이 온라인 상태와 복귀 상태에서 달라질 수 있다.
- 플레이어 입장에서는 “아까는 멀쩡했는데 새로고침하자마자 상태가 급변했다”로 느껴질 가능성이 높다.

### [P1] 사망 조건이 경로마다 달라서 냉장고 관련 상태에서 조기 사망/판정 불일치가 날 가능성이 크다

- lazy update 쪽 사망 판정은 `data/stats.js`에 있고, 여기서는 굶주림/탈진/부상 방치에서 냉장고 제외 시간이 일관되지 않다.
  - `src/data/stats.js:655-706`
- 반면 실시간/별도 사망 판정은 냉장고 시간을 제외하는 방향으로 구현돼 있다.
  - `src/hooks/useDeath.js:123-193`
  - `src/pages/Game.jsx:661-678`

게임 플레이에서 왜 문제인가:

- 냉장고에 넣어 둔 디지몬이 온라인 중엔 살았는데, 오프라인 복귀나 액션 직전 lazy update에서 갑자기 죽는 불일치가 생길 수 있다.
- 사망은 플레이 영향이 가장 큰 규칙이라, 이런 경로 차이는 체감 버그로 바로 이어진다.

### [P1] 배고픔/힘 콜의 케어미스 타이머가 수면 중에 “일시정지”가 아니라 사실상 “리셋 연장”되고 있다

- 실시간 `checkCallTimeouts()`는 수면 중이면 `startedAt`을 매 tick 현재 시각으로 덮어쓴다.
  - `src/hooks/useGameLogic.js:676-688`
- 이 방식은 “남은 시간을 보존한 채 멈춤”이 아니라 “깨고 나면 다시 10분을 주는” 결과가 된다.
- 같은 프로젝트의 lazy update는 수면 시간만큼만 `startedAt`을 뒤로 밀어 남은 시간을 보존하려고 한다.
  - `src/data/stats.js:786-790`
  - `src/data/stats.js:878-879`

게임 플레이에서 왜 문제인가:

- 배고픔 콜을 9분 50초 무시하고 잠들어도, 기상 후 다시 거의 10분을 더 벌 수 있다.
- 실시간 플레이와 오프라인 복귀의 케어미스 규칙이 서로 다르게 느껴질 가능성이 높다.
- 케어미스는 진화 분기 핵심 변수라서 이 차이는 결국 진화 결과까지 흔든다.

### [P1] 수면 콜 케어미스는 사실상 “실시간 플레이 중에만” 발생하고, 오프라인에서는 회피 가능성이 있다

- 수면 콜 타임아웃은 실시간 경로에서만 증가한다.
  - `src/hooks/useGameLogic.js:740-749`
- lazy update 쪽에는 수면 콜을 재구성하지 않는다고 명시돼 있다.
  - `src/data/stats.js:912-914`

게임 플레이에서 왜 문제인가:

- 수면 시간에 불을 켜 둔 채 앱을 닫거나 장시간 백그라운드로 보내면, 배고픔/힘 관련 케어미스는 복구되는데 수면 케어미스는 건너뛸 수 있다.
- 플레이어가 규칙을 이해하면 의도적으로 exploit할 수 있는 구조다.
- 진화 데이터가 `sleepDisturbances`를 조건으로 쓰고 있기 때문에, 진화 밸런스에도 직접 영향을 준다.

### [P1] 아레나 배틀이 스파링/퀘스트와 다른 규칙으로 상대를 해석해 명중률과 승패가 어긋날 수 있다

- 스파링은 상대 슬롯 버전에 따라 `v1/v2`를 모두 보고, 필요하면 `calculatePower()`로 파워를 다시 계산한다.
  - `src/components/BattleScreen.jsx:81-100`
- 아레나는 `newDigimonDataVer1`에서만 상대 데이터를 찾고, 파워도 `snapshotPower` 또는 `basePower` 위주로 처리한다.
  - `src/components/BattleScreen.jsx:156-166`
- 실제 배틀 시뮬레이터는 유저 쪽은 `calculatePower()`를 쓰지만, 적 쪽은 전달된 `enemyStats.power`를 그대로 신뢰한다.
  - `src/logic/battle/calculator.js:57-68`

게임 플레이에서 왜 문제인가:

- Ver.2 상대가 아레나에 들어오면 종족 데이터, 속성, 스프라이트, 파워가 부분적으로 틀릴 수 있다.
- Strength/Effort/Traited Egg 보너스가 반영된 상대와 반영되지 않은 상대가 모드별로 달라질 수 있다.
- 결국 “같은 상대인데 스파링과 아레나에서 체감 난이도가 다르다”는 문제로 보일 수 있다.

### [P2] 훈련 규칙이 두 군데에 중복되어 있고 내용도 다르다

- 실제 런타임은 `data/train_digitalmonstercolor25th_ver1.js`를 쓴다.
  - `src/hooks/useGameActions.js:7`
  - `src/components/TrainPopup.jsx:3`
  - `src/data/train_digitalmonstercolor25th_ver1.js:13-58`
- 그런데 별도로 `logic/training/train.js`에도 다른 규칙이 존재한다.
  - `src/logic/training/train.js:15-63`

차이점 예시:

- 실제 런타임 규칙:
  - 체중 -2, 에너지 -1, 성공 시 힘 +1
- 다른 구현 규칙:
  - 실패/성공/대성공에 따라 체중 -2/-2/-4, 힘 +0/+1/+3, 에너지 감소 없음

게임 플레이에서 왜 문제인가:

- 지금 당장은 호출 경로가 정해져 있어도, 앞으로 리팩터링이나 import 변경이 들어가면 훈련 결과가 통째로 바뀔 수 있다.
- 문서/분석/테스트를 작성하는 사람도 어느 규칙이 진짜인지 혼동하기 쉽다.

### [P2] 먹이/과식 규칙도 중복 구현이 있고 의미가 다르다

- 실제 액션은 `logic/food/meat.js`를 사용한다.
  - `src/hooks/useGameActions.js:5`
  - `src/hooks/useGameAnimations.js:6`
  - `src/logic/food/meat.js:12-49`
- 하지만 `logic/stats/hunger.js`에도 다른 `feedMeat()`가 있다.
  - `src/logic/stats/hunger.js:53-85`

차이점 예시:

- 실제 액션 규칙:
  - 거절 상태에서 먹이면 즉시 `overfeeds + 1`
- 다른 구현 규칙:
  - 꽉 찬 뒤 10번 더 먹여야 `overfeeds + 1`

게임 플레이에서 왜 문제인가:

- 현재 호출 경로와 별개로, 같은 “고기 먹이기” 규칙이 코드베이스 안에서 서로 다른 뜻을 갖고 있다.
- 향후 유지보수 시 과식 조건, 진화 조건, UI 설명이 쉽게 어긋날 수 있다.

### [P2] 스탯 엔진도 `data/`와 `logic/`에 중복되어 있어 같은 규칙의 의미가 파일마다 다르다

- `Game.jsx`는 `initializeStats`, `updateLifespan`을 `data/stats.js`에서 가져오고,
  `handleEnergyRecovery`는 `logic/stats/stats.js`에서 가져온다.
  - `src/pages/Game.jsx:36-42`
- 두 파일은 같은 도메인 규칙을 다루지만 구현 내용이 다르다.
  - `src/data/stats.js:157-220`
  - `src/data/stats.js:520-920`
  - `src/logic/stats/stats.js:128-172`
  - `src/logic/stats/stats.js:255-572`

차이점 예시:

- `data/stats.js`는 똥 8개 도달 시 즉시 부상까지 처리한다.
- `logic/stats/stats.js`는 같은 상황에서 `lastMaxPoopTime`만 기록하고 즉시 부상은 다르게 다룬다.
- `data/stats.js`와 `logic/stats/stats.js`의 사망/케어미스 처리도 완전히 동일하지 않다.

게임 플레이에서 왜 문제인가:

- 현재는 특정 경로만 실제로 쓰더라도, 규칙 수정 시 한쪽만 고치면 다른 경로와 도메인이 어긋난다.
- 특히 시간 기반 규칙은 실시간과 lazy update가 맞물려야 하므로, 이런 중복은 치명적이다.

## 서브시스템별 평가

### 진화 조건

좋은 점:

- `evolutions` + `conditions/conditionGroups` 구조는 명확하고, 우선순위가 데이터 순서로 드러난다.
  - `src/logic/evolution/checker.js:67-149`
  - `src/data/v1/digimons.js:201-257`

주의점:

- 케어미스/수면방해/배틀 수처럼 시간·행동 기반 누적값이 경로별로 다르게 쌓이면 진화 판정 자체는 맞아도 입력값이 틀어질 수 있다.
- 결국 진화 로직의 약점보다 “진화 입력 데이터의 일관성”이 더 큰 리스크다.

### 케어미스

좋은 점:

- 배고픔, 힘, 수면방해, 수면콜 무시를 분리해서 추적하려는 의도는 분명하다.

주의점:

- 수면 중 콜 타이머 연장 방식, offline 수면콜 누락, poop 8개 방치 처리 등이 경로마다 다르면 케어미스가 가장 쉽게 드리프트한다.

### 배틀

좋은 점:

- 기본 히트레이트 공식과 속성 상성 구조는 읽기 쉽다.
  - `src/logic/battle/calculator.js:16-31`
  - `src/logic/battle/types.js:32-56`

주의점:

- 실제 플레이 공정성은 공식 자체보다 “상대 파워/속성/종족 데이터를 어디서 가져오느냐”에 달려 있다.
- 현재는 아레나 경로가 가장 취약하다.

### 먹이/훈련

좋은 점:

- 액션 수행 전에 lazy update를 적용하고, 로그까지 남기는 흐름은 일관적이다.

주의점:

- 중복 구현이 많아 규칙 자체보다 “어느 구현이 실제인지”가 더 큰 문제다.

## 우선순위 요약

1. 시간 기반 규칙의 실시간/lazy update 불일치
2. 냉장고 포함 사망 판정의 경로 차이
3. 수면 중 콜 타이머 리셋 연장과 offline 수면 케어미스 누락
4. 아레나 상대 데이터/파워 계산 불일치
5. 훈련/먹이/스탯 엔진의 중복 규칙 파일 정리 필요
