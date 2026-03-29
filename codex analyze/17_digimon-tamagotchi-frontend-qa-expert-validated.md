# Digimon Tamagotchi Frontend QA Test Strategy Review

작성일: 2026-03-29  
검토 기준: 전역 subagent 정의 `qa-expert.toml`의 리스크 기반 테스트 전략 관점

## 분석 범위

- 대상 프로젝트: `digimon-tamagotchi-frontend`
- 중점 범위:
  - 현재 자동 테스트 커버리지 상태
  - `/src/logic`의 순수 함수 중 어떤 것부터 유닛 테스트를 추가해야 하는지
  - `/src/logic`만 테스트했을 때 남는 사각지점

## 확인한 사실

- 현재 소스 트리에서 확인되는 테스트 파일은 [App.test.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/src/App.test.js#L1) 하나뿐이다.
- 이 테스트는 여전히 CRA 기본 샘플인 `learn react` 텍스트를 찾는다.
- 소스 트리에서 `learn react` 문자열은 테스트 파일 자체에만 존재한다.
- 테스트 러너는 CRA 기본 `react-scripts test`이고, Jest/RTL 스택은 이미 설치되어 있다.

즉, 현재 상태는 "커버리지가 낮다"를 넘어서 "제품 동작을 보호하는 테스트가 사실상 없다"에 가깝다.

## 핵심 QA 발견사항

### 1. 가장 큰 리스크는 시간 기반 게임 규칙인데, 이를 보호하는 자동화가 전혀 없다

이 프로젝트의 사용자 체감 버그 대부분은 시간에서 나온다.

- 배고픔 감소
- 힘 감소
- 배변 누적
- lazy update
- 진화 대기 시간
- 콜 타임아웃
- 사망 조건

그런데 이 경계를 검증하는 유닛 테스트도, characterization 테스트도, 통합 테스트도 없다.

### 2. `/src/logic` 유닛 테스트만으로는 실제 런타임을 다 보호할 수 없다

이건 중요한 QA 함정이다.

- 시간 기반 핵심 엔진은 `src/data/stats.js`와 `src/logic/stats/stats.js`가 병존한다.
- 실제 훈련 런타임 경로는 `src/logic/training/train.js`가 아니라 별도 `src/data/train_digitalmonstercolor25th_ver1.js`를 따른다.
- 일부 전투/저장/진화 흐름은 Hook와 페이지 레벨에서 최종 결정된다.

즉 `/src/logic` 유닛 테스트는 반드시 필요하지만, 그것만으로 release confidence를 만들 수는 없다.

### 3. 현재 유일한 테스트는 제품 회귀 방지 가치가 거의 없다

- [App.test.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/src/App.test.js#L1)는 현재 앱의 한국어 UI나 라우팅, 인증 가드, 게임 진입 흐름과 아무 관련이 없다.
- 이 테스트가 통과하더라도 제품 품질 신호는 거의 없고, 실패하더라도 "앱이 망가졌다"보다 "샘플 테스트가 남아 있다"에 가깝다.

가장 작은 완화책은 이 테스트를 의미 있는 smoke test로 바꾸는 것이다.

## 가장 작은 추천 조치

### 추천 1. 테스트 스위트 신뢰도부터 복구

- [App.test.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/src/App.test.js#L1)를 실제 앱 smoke test로 교체
- 최소 smoke:
  - 앱이 크래시 없이 렌더되는지
  - 로그인/선택/게임 진입 중 적어도 하나의 안정적인 한국어 UI 텍스트가 보이는지

기대 효과:

- "테스트 돌리면 일단 기본 부팅은 확인된다"는 최소 신뢰를 확보한다.

### 추천 2. `/src/logic` 우선 테스트 1차 파동을 5개 파일로 제한

처음부터 광범위하게 늘리지 말고, 가장 회귀 방지 효율이 큰 순수 함수만 먼저 자동화하는 편이 좋다.

추천 1차 파동:

1. `src/logic/evolution/checker.js`
2. `src/logic/battle/calculator.js`
3. `src/logic/battle/hitrate.js`
4. `src/logic/stats/hunger.js`
5. `src/logic/stats/strength.js`

기대 효과:

- 진화, 전투, 시간 기반 실시간 감소라는 핵심 회귀 3축을 가장 적은 비용으로 잡을 수 있다.

### 추천 3. `/src/logic` 외 런타임 소스에는 characterization 테스트를 별도 배치

이건 순수 유닛 테스트와 다른 층이다.

우선 대상:

- `src/data/stats.js`
- `src/data/train_digitalmonstercolor25th_ver1.js`

기대 효과:

- `/src/logic` 테스트만으로 놓치는 실제 런타임 차이를 고정할 수 있다.

## `/src/logic` 유닛 테스트 우선순위

아래 우선순위는 세 기준으로 정했다.

- 사용자 영향이 큰가
- 분기와 경계값이 많은가
- 실제 런타임/리팩터링 안전망으로 얼마나 도움이 되는가

## Priority 1

### 1. `src/logic/evolution/checker.js`

가장 먼저 추가해야 한다.

이유:

- 진화 조건은 사용자 체감 영향이 매우 크다.
- `timeToEvolveSeconds`, `conditions`, `conditionGroups`, battle/winRatio, careMistakes 같은 경계값이 많다.
- data-driven 구조라 테스트 효율도 좋다.

최소 케이스:

- 시간 미충족이면 다른 조건이 맞아도 실패
- `conditions`의 min/max 경계
- `conditionGroups`에서 OR 그룹 중 하나만 만족하는 경우
- battle 수 0일 때 `winRatio` 처리
- 진화 데이터 없음/조건 없음/후보 없음 처리

### 2. `src/logic/battle/calculator.js`

이유:

- 실제 승패, 라운드 수, 부상 확률, 사용자 체감 전투 결과를 직접 만든다.
- 랜덤이 들어가지만 `Math.random` 고정으로 결정적으로 테스트할 수 있다.
- 리팩터링 시 회귀가 나도 눈으로 발견하기 어려운 종류다.

최소 케이스:

- 압도적 우세/열세 입력에서 결과 재현
- `calculateHitRate()`의 0/0 fallback
- `calculateInjuryChance()` 경계
- `simulateBattle()`가 최대 100라운드 guard를 지키는지

### 3. `src/logic/battle/hitrate.js`

이유:

- `calculatePower()`와 속성 상성은 배틀 밸런스의 뼈대다.
- basePower, strength bonus, traited egg, effort bonus 조합이 명확히 고정돼야 한다.
- `calculator.js`와 함께 테스트해야 전투 입력/출력 해석이 안정된다.

최소 케이스:

- `Vaccine > Virus > Data > Vaccine`
- `Free`와 동일 속성은 0 bonus
- strength 5 도달 시 stage별 보너스
- traited egg / effort 누적
- zero denominator 경계

### 4. `src/logic/stats/hunger.js`

이유:

- 실시간 타이머 경로의 핵심 단위다.
- countdown 직전/직후 경계와 `lastHungerZeroAt` 기록 시점은 사망/콜 시스템에 바로 연결된다.

최소 케이스:

- 1사이클 직전/직후
- 0 밑으로 내려가지 않는지
- `fullness`가 0이 되는 순간 timestamp가 한 번만 찍히는지
- sleeping/frozen/dead 상태에서 멈추는지

### 5. `src/logic/stats/strength.js`

이유:

- `hunger.js`와 같은 리스크 구조를 갖는다.
- strength 0은 콜, 케어미스, 사망과 연결되므로 회귀 영향이 크다.

최소 케이스:

- 1사이클 직전/직후
- 0 clamp
- `lastStrengthZeroAt` 기록
- sleeping/frozen/dead 경계

## Priority 2

### 6. `src/logic/evolution/jogress.js`

이유:

- 순수 함수이고, V1/V2 suffix 정규화 같은 엣지 케이스가 있어 테스트 ROI가 좋다.
- online jogress 전체를 다 막아주지는 않지만, 조합 판정 자체는 빨리 고정할 수 있다.

최소 케이스:

- `V1`/`V2` suffix 제거 후 매칭
- 직접 ID 일치 vs base ID 일치
- partner 불일치
- 데이터 없음/입력 없음 처리

### 7. `src/logic/food/meat.js`

이유:

- 작고 deterministic해서 빠르게 커버할 수 있다.
- 오버피드/거부/체중 증가 규칙은 진화 조건과도 연결될 수 있다.

최소 케이스:

- 정상 섭취
- 거부 상태
- `forceFeed` true/false
- `overfeeds` 증가
- `canEatMore` 계산

### 8. `src/logic/food/protein.js`

이유:

- strength/energy/proteinOverdose가 같이 얽혀 있어 경계값 테스트 가치가 높다.
- 특히 4, 9, 13, 17... 트리거 포인트는 버그가 숨어도 UI로 놓치기 쉽다.

최소 케이스:

- strength 4에서 energy +1
- 9/13/17...에서 overdose 증가
- `proteinOverdose` 상한 7
- `willRefuseProtein()` 경계

### 9. `src/logic/battle/questEngine.js`

이유:

- 순수 함수이긴 하지만 외부 data dependency가 커서 단위 테스트가 조금 더 무겁다.
- 그래도 area/round 진행과 invalid input 에러는 빨리 고정해두면 좋다.

최소 케이스:

- 유효한 area/round 플레이
- 마지막 라운드 승리 시 `isAreaClear`
- invalid area/round 예외
- Ver.1 / Ver.2 데이터 선택

### 10. `src/logic/stats/stats.js`

이유:

- 중요도 자체는 매우 높지만, 지금은 런타임 canonical source가 이 파일 하나가 아니다.
- 그래서 QA 관점 우선순위는 "핵심이지만 1순위는 아닌" 위치다.

권장 방식:

- 이 파일만 단독 유닛 테스트하지 말고, [data/stats.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/src/data/stats.js#L1) characterization 테스트와 짝으로 간다.

최소 케이스:

- `initializeStats()`
- `updateLifespan()` 경계
- `updateAgeWithLazyUpdate()`
- `applyLazyUpdate()` 장시간 경과, sleep/fridge 포함 케이스

## Priority 3

### 11. `src/logic/encyclopediaMaster.js`

이유:

- 순수하고 작아서 테스트는 쉽지만, 플레이 회귀 방지 효과는 낮다.
- 도감 완성 판정은 기능적으로 중요하지만 게임 핵심 루프보다는 뒤다.

### 12. `src/logic/training/train.js`

이유:

- 순수 함수로서 테스트하기 쉽지만, 현재 실제 런타임 주 경로는 이 파일이 아니다.
- QA ROI 관점에서는 "나중에"가 맞다.

주의:

- 이 파일을 먼저 테스트하면 "훈련 회귀를 보호했다"는 착시가 생길 수 있다.
- 실제 런타임은 별도 `src/data/train_digitalmonstercolor25th_ver1.js` characterization 테스트가 더 우선이다.

## 추천 테스트 인프라

### 1. 공통 fixture builder

필수 builder:

- `makeStats(overrides)`
- `makeDigimonData(overrides)`
- `makeEvolutionOption(overrides)`
- `makeBattleStats(overrides)`

효과:

- 테스트마다 거대한 객체를 직접 만들지 않아도 된다.

### 2. 시간 제어 헬퍼

필수:

- `jest.useFakeTimers()`
- `jest.setSystemTime()`
- `Date.now` 의존 함수에 대한 공통 helper

효과:

- hunger/strength/lazy update/age 경계 테스트가 안정적으로 반복된다.

### 3. 랜덤 제어 헬퍼

필수:

- `Math.random` sequence mock helper

효과:

- battle 시뮬레이션 테스트를 deterministic하게 만들 수 있다.

## `/src/logic`만 테스트하면 남는 사각지점

이건 꼭 같이 문서화해야 한다.

남는 사각지점:

- `src/data/stats.js` 실제 lazy update 경로
- `src/data/train_digitalmonstercolor25th_ver1.js` 실제 훈련 런타임 경로
- `Game.jsx`의 실시간 effect와 modal 전이
- `useGameData`의 load/save/hydration 순서
- Firestore write/read 경계

즉 QA 관점의 현실적인 순서는 이렇다.

1. `/src/logic`의 P1 유닛 테스트 추가
2. `src/data/stats.js` / `src/data/train_*` characterization 테스트 추가
3. 가장 얇은 페이지/Hook 통합 테스트 추가

## 이번 리뷰에서 확인한 경로

- 정상 경로: logic 순수 함수들은 대부분 deterministic하고 유닛 테스트 대상이 맞다.
- 실패 경로: 시간 기반 규칙과 battle randomness는 지금 그대로 두면 회귀가 숨어도 탐지 수단이 없다.
- 통합 경계: `/src/logic`와 실제 런타임 소스가 분리돼 있어 테스트 층을 분리해서 가져가야 한다.

## 남아 있는 런타임 검증

- 브라우저 background throttling 상태에서 시간 경과 parity
- Firebase mock 또는 staging에서 slot load/save/lazy update 실경로
- sleep schedule과 local timezone 경계
- arena snapshot power가 비어 있는 경우의 실제 battle 체감

## 결론

가장 작은 QA 개선은 두 가지다. 먼저 [App.test.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/src/App.test.js#L1)를 실제 smoke test로 바꾸고, 그 다음 `/src/logic`에서는 `evolution/checker -> battle/calculator + hitrate -> stats/hunger -> stats/strength -> evolution/jogress` 순서로 자동화를 넣는 것이다.

다만 release confidence를 진짜 올리려면 여기서 끝나면 안 된다. `/src/logic` 유닛 테스트는 첫 번째 층이고, 실제 제품 동작을 지키는 핵심은 이후 `src/data/stats.js`와 훈련 런타임 경로에 대한 characterization 테스트까지 이어지는지에 달려 있다.
