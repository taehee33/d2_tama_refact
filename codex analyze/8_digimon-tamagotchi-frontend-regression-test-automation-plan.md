# Digimon Tamagotchi Frontend 회귀 테스트 자동화 우선순위 계획

작성일: 2026-03-29

## 목적

이 문서는 회귀 위험이 큰 순수 로직 후보를 기준으로, 자동 테스트를 어떤 순서로 추가해야 하는지 정리한다.

이번 우선순위 비교 대상은 다음 네 가지다.

1. `applyLazyUpdate`
2. 진화 조건
3. 배틀 계산
4. 사망 조건

핵심 결론은 다음과 같다.

- **1순위:** `applyLazyUpdate`
- **2순위:** 진화 조건
- **3순위:** 배틀 계산
- **4순위:** 사망 조건

사망 조건이 도메인상 중요하지 않아서 뒤로 미루는 것이 아니다. 현재 코드 구조에서 사망 판정은 순수 로직으로 단일화되어 있지 않고, 시간 경과 처리 결과에 강하게 의존하므로 `applyLazyUpdate` 검증 없이 먼저 테스트해도 회귀 방지 효율이 낮기 때문이다.

---

## 후보별 테스트 우선순위 판단

## 1. `applyLazyUpdate`를 가장 먼저 자동화해야 하는 이유

대상 후보:

- `src/logic/stats/stats.js`의 `applyLazyUpdate`

이 함수가 가장 먼저인 이유는 세 가지다.

### 1) 다른 규칙의 전제 상태를 만든다

이 함수는 단순히 시간을 깎는 유틸이 아니다.

- 배고픔 감소
- 힘 감소
- 배변 누적
- 수명 증가
- 진화 시간 감소
- 냉장고 시간 제외
- 0 스탯 도달 시점 기록
- 최대 배변 상태 장기 방치 시 부상 처리
- 12시간 starvation / exhaustion 사망 처리

즉 이 함수가 틀리면 진화, 사망, 케어미스, 저장 후 상태 복원까지 같이 틀어진다.

### 2) 회귀가 눈에 잘 안 띈다

시간 기반 로직은 수동 테스트로 재현 비용이 높다.

- 5분 후
- 30분 후
- 8시간 후
- 12시간 후
- 냉장고 사용 전후
- 수면 포함/제외

같은 케이스는 수동 확인이 어렵다. 자동 테스트 ROI가 가장 높다.

### 3) 사망 조건의 실질적 선행 조건이다

현재 사망 판정은 독립 규칙처럼 보이지만, 실제로는 `lastHungerZeroAt`, `lastStrengthZeroAt`, `lastMaxPoopTime`, `injuredAt` 같은 시간 축 상태가 먼저 정확히 생성되어야 맞게 동작한다.

즉 `applyLazyUpdate` 검증이 먼저다.

### 우선 추가할 테스트

- `lastSavedAt`이 없을 때 현재 시각만 갱신하고 부작용이 없는지
- 경과 시간이 0 이하일 때 변화가 없는지
- hunger/strength cycle을 여러 번 넘긴 경우 누적 감소가 반복 적용되는지
- `timeToEvolveSeconds`가 0 아래로 내려가지 않는지
- `isFrozen`, `frozenAt`, `takeOutAt` 조합에서 냉장고 시간이 제외되는지
- `poopCount`가 8에 도달한 뒤 8시간 방치 시 부상이 증가하는지
- `fullness === 0`, `strength === 0`이 12시간 지속되면 사망 처리되는지
- 이미 `isDead`인 경우 추가 계산을 멈추는지

---

## 2. 진화 조건을 두 번째로 자동화해야 하는 이유

대상 후보:

- `src/logic/evolution/checker.js`의 `checkEvolution`
- 내부 조건 판정 흐름

진화 조건이 2순위인 이유는 분기 수가 매우 많고, UI 표시와 실제 진화 실행에 모두 영향을 주기 때문이다.

### 진화 조건 테스트의 가치

- 진화 버튼의 `⭕ / ❌` 표시와 연결된다.
- 후보가 여러 개인 진화 트리에서 우선순위와 OR 조건이 섞인다.
- care mistake, training, battle count, win ratio, time gating이 같이 얽힌다.
- 데이터 구조가 `conditions`, `conditionGroups`, `jogress`로 나뉘어 있어 실수 여지가 많다.

### `applyLazyUpdate`보다 뒤인 이유

진화 조건은 중요하지만, 시간 기반 전제 상태가 틀어지면 진화 테스트도 허상일 수 있다.

예를 들어:

- `timeToEvolveSeconds`
- `careMistakes`
- `battleCount`
- `winRatio`

같은 입력값이 저장/로드 또는 lazy update 경로에서 잘못 만들어지면, 진화 체크 함수만 테스트해도 실제 회귀를 놓칠 수 있다.

### 우선 추가할 테스트

- 진화 시간이 1초라도 남아 있으면 실패
- 조건이 하나도 없는 경우 처리
- `conditions` 단일 조건 세트 만족/불만족
- `conditionGroups` 중 한 그룹만 만족해도 성공하는지
- `careMistakes.min`, `careMistakes.max` 경계값
- `battles`는 충족했지만 `winRatio`가 부족한 경우 실패
- 잘못된 디지몬 데이터나 다음 진화가 없는 경우 안전하게 실패하는지
- 조그레스 후보가 있는 경우 일반 조건과 충돌하지 않는지

---

## 3. 배틀 계산을 세 번째로 자동화해야 하는 이유

대상 후보:

- `src/logic/battle/hitrate.js`
- `src/logic/battle/calculator.js`

배틀 계산은 플레이 체감이 매우 크고, 공식 기반 규칙이라 기대치가 명확하다. 그래서 테스트 자동화 가치가 높다.

### 테스트 자동화 포인트

- 히트레이트 공식은 deterministic 하다.
- 파워 계산은 strength, effort, 속성 상성, 기본 파워가 섞인다.
- 전투 시뮬레이터는 `Math.random`만 고정하면 재현 가능하다.
- 부상 확률은 승패와 protein overdose에 따라 명확한 수식이 있다.

### 진화보다 뒤인 이유

배틀은 중요하지만, 현재 프로젝트의 전체 상태 흐름에서 시간 기반 스탯과 진화 gating이 더 광범위한 회귀를 만든다. 배틀 계산은 상대적으로 범위가 좁고, 랜덤 제어만 해두면 이후 추가가 쉽다.

### 우선 추가할 테스트

- `calculateHitRate`가 power 0/0일 때 50을 반환하는지
- 속성 상성 보너스가 정확히 더해지는지
- `calculatePower`에서 strength/effort/traitedEgg 보너스가 정확히 반영되는지
- `simulateBattle`에서 고정된 random sequence로 승패가 재현되는지
- 최대 100라운드 제한이 무한 루프를 막는지
- `calculateInjuryChance`가 승리/패배와 protein overdose에 맞게 계산되는지

---

## 4. 사망 조건은 네 번째로 자동화하는 것이 맞는 이유

관련 구현 위치:

- `src/hooks/useDeath.js`의 `checkDeathCondition`
- `src/logic/stats/stats.js`의 `applyLazyUpdate` 내부 사망 처리 일부

사망 조건은 도메인상 매우 중요하지만, 지금 구조에서는 **첫 번째 순수 유닛 테스트 후보가 아니다**.

### 이유 1) 순수 로직 경계가 깔끔하지 않다

사망 판정은 한 곳에 완전히 모여 있지 않다.

- hunger/strength 12시간 사망은 `applyLazyUpdate`에서도 반영된다.
- 부상 방치, 부상 과다, 냉장고 제외 시간 계산은 `useDeath.js` 안에 있다.
- `useDeath.js`는 Hook 파일이며 `Date.now()`와 UI 흐름에 더 가깝다.

즉 지금은 "사망 조건만 딱 떼서 테스트"하기보다, 먼저 시간 경과 처리와 상태 생성 경로를 고정해야 한다.

### 이유 2) 입력 상태의 신뢰성이 선행되어야 한다

사망 여부는 결국 아래 필드가 맞아야 의미가 있다.

- `lastHungerZeroAt`
- `lastStrengthZeroAt`
- `injuredAt`
- `isInjured`
- `injuries`
- `frozenAt`
- `takeOutAt`

이 값들이 upstream 로직에서 잘못 만들어지면, 사망 테스트만 통과해도 실제 제품 회귀를 막지 못한다.

### 이유 3) 현재 구조에서는 characterization 테스트가 더 적합하다

사망 조건은 지금 당장 "순수 함수 유닛 테스트"보다 다음 둘 중 하나가 더 효과적이다.

- `applyLazyUpdate`의 사망 관련 결과를 검증하는 테스트
- `useDeath.checkDeathCondition`을 현재 동작 기준으로 고정하는 characterization 테스트

### 우선 추가할 테스트

- `fullness === 0` 상태가 12시간 지속되면 starvation 사망
- `strength === 0` 상태가 12시간 지속되면 exhaustion 사망
- `injuries >= 15`면 즉시 사망
- `isInjured && injuredAt` 기준 6시간 방치 시 사망
- 냉장고 상태에서는 사망하지 않는지
- 이미 `isDead`인 경우 fallback reason 처리

---

## 최종 우선순위

테스트 자동화 순서는 아래가 가장 안전하다.

1. `applyLazyUpdate`
2. 진화 조건
3. 배틀 계산
4. 사망 조건

이 순서가 좋은 이유는 "핵심 상태 생성 -> 분기 판정 -> 확률 계산 -> 구조상 덜 순수한 규칙" 순으로 간다는 점이다.

---

## 추천 테스트 구현 단위

## Phase 1. 순수 유닛 테스트

가장 먼저 추가할 파일:

- `src/logic/stats/stats.js`
- `src/logic/evolution/checker.js`
- `src/logic/battle/hitrate.js`
- `src/logic/battle/calculator.js`

이 단계 목표:

- 랜덤과 시간을 통제한 deterministic 테스트 기반 만들기
- 회귀 발생 확률이 가장 높은 계산 로직을 고정하기

## Phase 2. 사망 규칙 characterization 테스트

그 다음 대상:

- `src/hooks/useDeath.js`의 `checkDeathCondition`

이 단계 목표:

- 현재 사망 판정 동작을 먼저 고정
- 이후 사망 로직을 순수 함수로 추출해도 행동 보존이 가능하도록 안전망 확보

## Phase 3. 얇은 통합 테스트

마지막으로 필요한 흐름:

- 오래된 슬롯 로드 -> lazy update 적용 -> 사망/진화 상태 반영
- 배틀 후 결과 저장
- 진화 가능 상태에서 버튼/모달 흐름 반영

이 단계 목표:

- 순수 계산이 실제 UI/저장 플로우와 연결될 때 깨지지 않는지 확인

---

## 가장 현실적인 첫 테스트 PR 범위

첫 PR은 너무 넓히지 않는 것이 좋다. 아래 범위가 가장 효율적이다.

### 포함

- `applyLazyUpdate`
- `checkEvolution`
- `calculateHitRate`
- `calculatePower`
- `simulateBattle`
- `calculateInjuryChance`

### 제외

- `useDeath` 전체 Hook 테스트
- Firebase/localStorage 통합 테스트
- 모달 상태 테스트

이유는 첫 PR의 목표가 "회귀 위험이 큰 순수 계산식을 빠르게 고정"하는 것이기 때문이다.

---

## 결론

테스트 자동화는 사망 조건부터가 아니라 `applyLazyUpdate`부터 시작하는 것이 맞다. 이유는 간단하다. 사망, 진화, 배틀 전후 상태 모두가 시간 기반 누적 계산에 기대고 있기 때문이다.

테스트 관점에서 가장 좋은 순서는 다음과 같다.

1. `applyLazyUpdate`
2. 진화 조건
3. 배틀 계산
4. 사망 조건

사망 조건은 중요하지만 현재 구조상 순수 로직으로 완전히 격리되어 있지 않으므로, 1차 유닛 테스트 대상이라기보다 2차 characterization 대상에 가깝다. 먼저 시간 기반 상태 생성과 핵심 계산식을 고정한 뒤, 그 위에서 사망 규칙을 고정하는 편이 더 안전하고 유지보수 비용도 낮다.
