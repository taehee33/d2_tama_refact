# Digimon Tamagotchi Frontend Regression Test Automation Priority Plan

작성일: 2026-03-29  
검토 기준: 전역 subagent 정의 `test-automator.toml`의 회귀 자동화 우선순위 관점

## 분석 범위

- 대상 프로젝트: `digimon-tamagotchi-frontend`
- 비교 대상 로직:
  1. `applyLazyUpdate`
  2. 진화 조건
  3. 배틀 계산
  4. 사망 조건

이번 문서의 목적은 "무엇이 가장 중요한가"가 아니라, "무엇부터 자동화해야 가장 적은 테스트로 가장 큰 회귀 방지 효과를 얻는가"를 정하는 것이다.

## 핵심 결론

자동 테스트 추가 순서는 아래가 가장 안전하다.

1. `applyLazyUpdate`
2. 진화 조건
3. 배틀 계산
4. 사망 조건

이 순서가 맞는 이유는 다음과 같다.

- `applyLazyUpdate`는 시간 기반 상태를 만드는 upstream 엔진이라 나머지 규칙의 전제 상태를 만든다.
- 진화 조건은 deterministic하고 data-driven이라 작은 테스트 세트로 큰 회귀를 막을 수 있다.
- 배틀 계산은 랜덤이 있지만 제어 가능하고, 공식이 비교적 고정적이라 3순위 자동화 ROI가 높다.
- 사망 조건은 중요하지만 현재 코드베이스에서는 순수 로직 경계가 가장 덜 정리돼 있고, upstream 시간 상태에 강하게 의존하므로 마지막이 더 효율적이다.

## 각 후보별 자동화 우선순위 판단

## 1. `applyLazyUpdate`가 1순위인 이유

대상:

- [stats.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/src/data/stats.js#L377)
- 보조 비교 대상: [stats.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/src/logic/stats/stats.js#L247)

이유:

- 시간 경과 후 `fullness`, `strength`, `poopCount`, `lifespanSeconds`, `timeToEvolveSeconds`, `careMistakes`, `injuries`, `isDead`까지 같이 바뀐다.
- 후속 규칙인 진화 가능 여부, 콜 타임아웃, 굶주림/탈진 사망, 부상 방치, 오프라인 복귀 상태가 모두 여기에 의존한다.
- 수동 재현 비용이 매우 높다. 수 분, 수 시간, 수면 시간, 냉장고 시간, 오프라인 복귀를 전부 사람 손으로 검증하기 어렵다.
- deterministic 테스트로 만들기도 쉽다. `Date.now`/시스템 시간을 고정하면 된다.

테스트 자동화 가치:

- 가장 적은 테스트로 가장 넓은 회귀 면적을 덮는다.
- 이후 다른 테스트들의 fixture 기반 상태를 신뢰할 수 있게 만든다.

최소 권장 케이스:

- `lastSavedAt`이 없을 때 no-op + 현재 시각 갱신
- 경과 시간 0 또는 음수일 때 no-op
- hunger/strength countdown이 여러 cycle을 한 번에 넘는 경우 누적 감소
- `timeToEvolveSeconds`가 0 아래로 내려가지 않음
- 수면 시간 제외
- 냉장고 시간 제외
- `poopCount`가 8에 도달한 뒤 부상/사망 관련 시계가 어떻게 잡히는지
- 10분 call timeout 재구성과 12시간 starvation/exhaustion 결과

가장 작은 추천:

- 첫 번째 자동화 PR은 `src/data/stats.js`의 `applyLazyUpdate` characterization 테스트만 추가하는 것으로도 충분히 가치가 있다.

## 2. 진화 조건이 2순위인 이유

대상:

- [checker.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/src/logic/evolution/checker.js#L19)
- 보조 후보: [jogress.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/src/logic/evolution/jogress.js#L1)

이유:

- 진화는 사용자 체감 영향이 크고, data-driven이라 테스트가 상대적으로 싸다.
- `conditions`, `conditionGroups`, `battles`, `winRatio`, `careMistakes`, `timeToEvolveSeconds` 등 경계값이 많다.
- 진화 데이터가 늘어나더라도 테스트 패턴을 재사용하기 쉽다.

`applyLazyUpdate`보다 뒤인 이유:

- 진화 판정 함수 자체는 순수하고 잘 잘라져 있지만, 입력 상태의 신뢰성은 시간 기반 엔진에 달려 있다.
- 먼저 `applyLazyUpdate`를 고정해야 진화 테스트의 fixture도 의미가 있다.

최소 권장 케이스:

- 진화 시간 미도달
- `conditions` 단일 그룹의 min/max 경계
- `conditionGroups` OR 분기
- battle 수 0일 때 `winRatio` 처리
- 조건 없음 / 후보 없음 / 잘못된 데이터 처리
- jogress는 일반 진화 테스트와 분리해서 suffix normalization 확인

가장 작은 추천:

- 두 번째 자동화 PR은 `checker.js`의 경계값 테이블 테스트와 `jogress.js`의 소형 조합 테스트를 붙이는 것이다.

## 3. 배틀 계산이 3순위인 이유

대상:

- [calculator.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/src/logic/battle/calculator.js#L1)
- [hitrate.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/src/logic/battle/hitrate.js#L1)
- 보조 후보: [types.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/src/logic/battle/types.js#L1)

이유:

- 전투 공식은 deterministic한 부분과 랜덤 부분이 명확히 나뉘어 있어 테스트 설계가 쉽다.
- `Math.random` sequence만 고정하면 `simulateBattle()`도 안정적으로 검증할 수 있다.
- 속성 상성, 파워 계산, 부상 확률은 회귀가 나도 눈으로 발견하기 어려워 자동화 효율이 높다.

진화보다 뒤인 이유:

- 전투는 중요하지만, 프로젝트 전체 상태 흐름에서는 시간 기반 엔진과 진화 gating 쪽이 더 넓은 회귀 면적을 갖는다.
- 또한 배틀은 snapshot 입력 품질 문제까지 얽혀 있어, 순수 로직 테스트만으로는 일부 통합 리스크가 남는다.

최소 권장 케이스:

- `calculateHitRate()`의 0/0 fallback
- 속성 상성 보너스
- `calculatePower()`의 strength/traitedEgg/effort 반영
- 고정 random sequence 기반 `simulateBattle()`
- `calculateInjuryChance()` 경계

가장 작은 추천:

- 세 번째 PR은 `hitrate.js`와 `calculator.js`를 한 묶음으로 테스트하는 것이 가장 효율적이다.

## 4. 사망 조건이 4순위인 이유

대상:

- [useDeath.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/src/hooks/useDeath.js#L123)
- 보조 참조:
  - [Game.jsx](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/src/pages/Game.jsx#L632)
  - [useGameData.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/src/hooks/useGameData.js#L388)

이유:

- 도메인 중요도는 매우 높다.
- 하지만 테스트 자동화 우선순위는 마지막이 맞다.

왜 마지막인가:

- 현재 사망 판정은 하나의 순수 함수로 완전히 닫혀 있지 않다.
- 굶주림/탈진/부상 방치 판정이 `useDeath`, `Game.jsx`, `useGameData`, `applyLazyUpdate`에 분산돼 있다.
- 따라서 사망 테스트를 먼저 쓰면 "무엇을 정답으로 고정하는지"부터 모호해진다.
- upstream 시간 상태가 잘못 생성되면 death 테스트만 통과해도 실제 제품 회귀를 막지 못한다.

최소 권장 케이스:

- starvation 12시간
- exhaustion 12시간
- 부상 15회
- 부상 방치 6시간
- 냉장고 시간 제외
- 이미 `isDead` 상태의 fallback

가장 작은 추천:

- 사망 조건은 순수 유닛 테스트보다 characterization 테스트에 가깝게 시작하는 것이 안전하다.

## 최종 우선순위

테스트 자동화 순서는 아래가 가장 안전하다.

1. `applyLazyUpdate`
2. 진화 조건
3. 배틀 계산
4. 사망 조건

이 순서의 장점:

- upstream state generator부터 고정한다.
- deterministic data-driven rule을 두 번째로 고정한다.
- random 제어가 필요한 로직은 세 번째로 넘긴다.
- 가장 경계가 흐린 사망 판정은 마지막에 characterization으로 들어간다.

## 추천 자동화 단계

## Phase 1. 시간 기반 characterization

대상:

- `src/data/stats.js`

추천 방식:

- fake time
- fixture builder
- 긴 elapsed time table test

성공 기준:

- 오프라인 복귀 상태가 deterministic하게 재현된다.

## Phase 2. 순수 진화 유닛 테스트

대상:

- `src/logic/evolution/checker.js`
- `src/logic/evolution/jogress.js`

추천 방식:

- 경계값 테이블 테스트
- 작은 fixture map 재사용

성공 기준:

- 진화 후보 선택과 실패 reason이 안정적으로 고정된다.

## Phase 3. 전투 공식 유닛 테스트

대상:

- `src/logic/battle/hitrate.js`
- `src/logic/battle/calculator.js`
- 필요 시 `src/logic/battle/types.js`

추천 방식:

- `Math.random` sequence helper
- 공식 기반 assertion

성공 기준:

- 동일 입력에서 히트레이트/승패/부상 확률이 항상 같은 결과를 낸다.

## Phase 4. 사망 조건 characterization

대상:

- `src/hooks/useDeath.js`
- 필요 시 `src/data/stats.js`와 조합

추천 방식:

- 현재 분산된 death semantics를 먼저 고정
- 이후에야 pure helper 추출 검토

성공 기준:

- starvation/exhaustion/injury death의 현행 behavior가 먼저 캡처된다.

## 테스트 인프라 추천

- `makeStats(overrides)` 공통 fixture builder
- `makeDigimon(overrides)` / `makeEvolutionData(overrides)` builder
- `withFixedNow(timestamp)` helper
- `withRandomSequence([...])` helper

이렇게 해야 flakiness 없이 작은 테스트로 유지할 수 있다.

## 이번 리뷰에서 확인한 경로

- 정상 경로: `applyLazyUpdate -> 진화 가능 여부 -> 배틀 공식`은 비교적 deterministic하게 자동화 가능하다.
- 실패 경로: 사망 조건은 중요하지만 현재는 분산 구현이라 첫 번째 테스트 대상으로는 비효율적이다.
- 통합 경계: `/src/logic` 유닛 테스트만으로는 `src/data/stats.js`와 runtime death semantics를 보호하지 못한다.

## 남아 있는 런타임 검증

- background throttling 상태에서 실시간 타이머와 `applyLazyUpdate` parity
- 냉장고 진입/해제 후 starvation timer 실제 동작
- arena snapshot power 누락 시 실제 battle 흐름

## 결론

가장 작은 자동화 투자로 가장 큰 회귀 방지 효과를 얻으려면 `applyLazyUpdate`부터 고정해야 한다. 그 다음이 진화 조건이고, 그 다음이 배틀 계산이다. 사망 조건은 중요하지만 지금 구조에서는 upstream 시간 상태와 분산 구현에 기대므로, 가장 마지막에 characterization 테스트로 들어가는 편이 테스트 ROI가 가장 높다.
