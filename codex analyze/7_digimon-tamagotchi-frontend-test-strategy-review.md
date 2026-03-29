# Digimon Tamagotchi Frontend 테스트 전략 리뷰

작성일: 2026-03-29

## 목적

이 문서는 현재 `digimon-tamagotchi-frontend`의 테스트 전략을 QA 관점에서 점검하고, 특히 `/src/logic`의 순수 함수들 중 어떤 것부터 유닛 테스트를 추가해야 하는지 우선순위를 정리한다.

핵심 질문은 두 가지다.

1. 현재 테스트 커버리지는 어디가 비어 있는가?
2. 가장 적은 비용으로 가장 큰 회귀 방지 효과를 얻으려면 `/src/logic`에서 무엇부터 테스트해야 하는가?

---

## 현재 테스트 전략 진단

현재 테스트 상태는 사실상 "없음"에 가깝다.

- `src/App.test.js` 한 개만 존재한다.
- 내용은 CRA 기본 샘플 테스트(`learn react`) 수준이라 실제 제품 동작을 보호하지 못한다.
- 게임 규칙, 시간 기반 스탯 변화, 진화 조건, 배틀 계산, 저장소 경계, 모달 상태에 대한 테스트가 없다.
- 랜덤(`Math.random`), 시간(`Date.now`, fake timers), 저장소(Firebase/localStorage) 경계를 제어하는 테스트 인프라도 없다.

즉 지금 상태에서는 작은 리팩터링이나 규칙 수정이 들어가도 "무엇이 깨졌는지"를 코드로 확인할 방법이 거의 없다.

---

## 현재 커버리지의 구조적 약점

### 1. 시간 기반 규칙에 대한 회귀 방지 장치가 없다

이 프로젝트의 핵심 위험은 시간이다.

- 배고픔 감소
- 힘 감소
- 배변 증가
- 수명 증가
- 콜 타임아웃
- 사망 판정
- 진화 대기 시간 감소
- lazy update

이 로직들은 단순 CRUD보다 훨씬 회귀 가능성이 높다. 그런데 현재는 이를 보장하는 테스트가 없다.

### 2. 규칙 소스가 단일하지 않아 "테스트했다"는 착시가 생길 수 있다

`/src/logic`는 분명 좋은 유닛 테스트 타깃이지만, 현재 실제 런타임 규칙 소스가 완전히 `/src/logic`로 단일화되어 있지는 않다.

- 시간 기반 핵심 로직은 `src/data/stats.js`와 `src/logic/stats/stats.js`가 병존한다.
- 훈련 관련 실제 경로는 `src/logic/training/train.js` 외에도 데이터 기반 경로를 함께 본다.
- 따라서 `/src/logic`만 테스트하면 실제 제품 동작을 전부 커버했다고 오해할 수 있다.

즉 `/src/logic` 유닛 테스트는 반드시 필요하지만, 그것만으로는 충분하지 않다.

### 3. 랜덤/시간/저장소 경계 테스트가 비어 있다

현재 가장 중요한 테스트 대상은 순수 함수 그 자체만이 아니라, 다음 경계 조건이다.

- 시간이 많이 지난 상태에서 lazy update를 적용했을 때
- 랜덤 배틀 결과가 확률 모델과 맞는지
- 저장 직전/로드 직후에 규칙이 한 번 더 적용될 때 중복 반영이 없는지
- Firebase 경로와 localStorage 경로가 동일한 결과를 만드는지

이 경계는 대부분 테스트되지 않고 있다.

### 4. 리팩터링 안전망이 없다

현재 구조상 `Game.jsx`와 대형 Hook를 리팩터링하려면 테스트가 먼저 필요하다. 그런데 지금은 순수 로직 테스트조차 없어서, 구조를 정리하려고 손대는 순간 규칙 회귀를 눈으로만 검증해야 한다.

---

## 테스트 전략 권장 구조

가장 안전한 방향은 테스트를 3개 층으로 나누는 것이다.

### 1단계. `/src/logic` 순수 함수 유닛 테스트

가장 먼저 추가해야 할 층이다.

- 빠르다.
- Firebase 의존성이 없다.
- 규칙 회귀를 가장 저렴하게 막을 수 있다.
- 대형 Hook 리팩터링 전에 안전망 역할을 한다.

### 2단계. 현재 런타임 규칙 소스에 대한 characterization 테스트

다음 파일들은 `/src/logic`와 별도로 실제 제품 동작을 좌우하므로 별도 테스트가 필요하다.

- `src/data/stats.js`
- 실제 훈련/먹이/액션 흐름에서 사용하는 데이터 기반 로직

이 테스트는 "좋은 설계"를 검증하는 게 아니라 "현재 동작을 그대로 고정"하는 역할이다.

### 3단계. 얇은 통합 테스트

최소한 다음 정도는 필요하다.

- 슬롯 로드 후 lazy update 적용
- 먹이/훈련/배틀 버튼 액션 후 저장 호출
- 진화 가능/불가 상태에 따른 UI 변화
- 대표 모달 열기/닫기 상태 전파

여기서는 Firebase를 실제로 쓰기보다 mock repository 또는 Firestore mock으로 경계를 고정하는 편이 안전하다.

---

## `/src/logic` 유닛 테스트 우선순위

아래 우선순위는 세 기준으로 정했다.

- 회귀 시 플레이 영향이 큰가
- 분기 수가 많고 실수 가능성이 큰가
- 현재 실제 코드베이스에서 재사용 가치가 높은가

## Priority 1

### `src/logic/evolution/checker.js`

가장 먼저 테스트해야 한다.

- 진화 조건은 분기 수가 많고 조합이 복잡하다.
- stage, care mistakes, training, battle count, win ratio, time gating, 특수 조건이 섞여 있다.
- 버튼 표시와 실제 진화 가능 여부가 여기와 강하게 연결된다.

반드시 넣어야 할 케이스:

- 시간 미충족이면 다른 조건이 맞아도 진화 불가
- care mistake 범위 경계값
- battle/win ratio 최소 조건 경계값
- OR 조건, AND 조건, 다중 후보 중 하나만 만족하는 경우
- 조건 없음/다음 진화 없음/잘못된 데이터 처리

### `src/logic/battle/hitrate.js`

전투 품질의 핵심 공식이다.

- 파워 계산
- 속성 상성 보너스
- 트레이티드 에그 보너스
- effort/strength 반영
- 최종 명중률 계산

반드시 넣어야 할 케이스:

- Vaccine/Virus/Data/Free 상성 보너스
- 파워 차이가 클 때/같을 때
- strength 또는 effort가 0일 때
- 버전 suffix가 붙은 이름 정규화

### `src/logic/battle/calculator.js`

배틀 결과와 데미지/부상/승패를 직접 결정하므로 중요도가 높다.

- `simulateBattle`
- `simulateBattleWithQuestStage`
- `calculateInjuryChance`

반드시 넣어야 할 케이스:

- `Math.random`을 고정한 결정적 테스트
- 압도적 우세/열세 상황
- 무승부 가능성 여부
- 부상 확률 경계
- stage multiplier, booster, item 적용

### `src/logic/stats/hunger.js`

실시간 타이머와 lazy update 검증의 기초 단위다.

- 배고픔 감소 주기
- 콜 시작 시점
- zero 상태 추적

반드시 넣어야 할 케이스:

- 감소 주기 직전/직후
- 한 사이클 경계값
- 여러 사이클이 한 번에 지난 경우
- 0 미만으로 내려가지 않는지
- call 발생 시점이 올바른지

### `src/logic/stats/strength.js`

`hunger.js`와 동일한 이유로 우선순위가 높다.

반드시 넣어야 할 케이스:

- 감소 주기 직전/직후
- 여러 사이클 경과
- 0 고정 여부
- call 상태 시작 시점

---

## Priority 2

### `src/logic/stats/stats.js`

중요도 자체는 매우 높지만, 현재 프로젝트는 `src/data/stats.js`와 책임이 겹쳐 있다. 그래서 이 파일만 테스트하면 실제 런타임 회귀를 다 막는 것은 아니다.

그래도 다음 이유로 빠르게 테스트를 붙일 가치가 있다.

- `applyLazyUpdate`
- `initializeStats`
- lifespan / poop / sleep / evolution time 관련 종합 규칙이 모여 있다
- 이후 규칙 소스 통합 시 기준 테스트로 재사용 가능하다

단, 권장 방식은 이 파일 테스트를 **단독**으로 두지 말고 `src/data/stats.js` characterization 테스트와 짝으로 가는 것이다.

반드시 넣어야 할 케이스:

- 장시간 offline 후 lazy update 누적 적용
- 수면 시간 포함/제외
- 냉장고 상태 포함/제외
- poop 누적과 cap 처리
- timeToEvolve 감소

### `src/logic/battle/questEngine.js`

배틀 퀘스트 상대 생성과 stage 진행 규칙이 여기 모여 있다.

- stage별 난이도 변화
- 적 파워 생성
- 보상 또는 진행 조건 계산

실제 게임 플레이 밸런스 회귀를 잡는 데 유용하다.

### `src/logic/food/meat.js`

작지만 플레이 체감에 직접 연결된다.

- 고기 섭취 가능 여부
- 과식 조건
- 배고픔 회복

작고 deterministic 해서 초반 테스트 세트에 넣기 좋다.

### `src/logic/food/protein.js`

`meat.js`와 같은 이유다.

- 프로틴 제한
- 과다 복용
- 힘/체중/부작용 처리

### `src/logic/evolution/jogress.js`

파일은 작지만 조그레스는 실패 시 체감 버그가 큰 기능이다.

- V1/V2 suffix 정규화
- 조합 순서가 바뀌어도 같은 결과가 나오는지
- 매칭 실패 시 null 반환

---

## Priority 3

### `src/logic/encyclopediaMaster.js`

순수 함수라 테스트 비용이 매우 낮다. 다만 게임의 핵심 루프보다는 부가 진행 요소에 가깝기 때문에 우선순위는 한 단계 낮다.

### `src/logic/training/train.js`

이 파일도 순수 함수라 테스트는 쉽다. 하지만 현재 실제 런타임 로직이 이 파일 하나만을 canonical source로 쓰는 구조가 아니라서, 제품 회귀 방지 효과는 상대적으로 낮다.

즉 테스트 자체는 권장하지만, "가장 먼저"는 아니다.

---

## 가장 먼저 추가할 테스트 묶음

첫 번째 테스트 PR은 아래 범위면 충분하다.

1. `logic/evolution/checker.js`
2. `logic/battle/hitrate.js`
3. `logic/battle/calculator.js`
4. `logic/stats/hunger.js`
5. `logic/stats/strength.js`
6. `logic/food/meat.js`
7. `logic/food/protein.js`

이 조합이 좋은 이유:

- 시간 기반 핵심 규칙
- 진화 분기
- 배틀 공식
- 먹이 액션 기본 규칙

을 한 번에 덮을 수 있기 때문이다.

---

## 추천 테스트 케이스 예시

### 진화

- 남은 진화 시간이 1초라도 있으면 진화 불가
- `careMistakes`가 최소/최대 경계값에 걸릴 때 결과 유지
- battle 수는 충족하지만 win ratio가 부족하면 실패
- 여러 진화 후보 중 첫 번째만 실패하고 두 번째가 성공하는 경우

### 배틀

- 같은 파워면 명중률이 50% 근처로 계산되는지
- 속성 우위가 있을 때 보너스가 정확히 들어가는지
- booster/item 적용 시 기대한 파워 차이가 나는지
- 고정된 random seed에서 승패와 부상 결과가 재현되는지

### 배고픔/힘

- 정확히 cycle 직전에는 감소하지 않음
- cycle을 넘는 순간 1 감소
- 여러 cycle이 지났을 때 누적 감소가 의도대로 반영되는지
- 이미 0이면 더 내려가지 않음

### 먹이

- 이미 가득 찬 상태에서 고기/프로틴이 거부되는지
- 과식 카운트 증가 조건이 정확한지
- 프로틴 과다 조건이 경계값에서만 발생하는지

### 조그레스

- `Agumon`/`Agumon_V2` 같은 suffix 차이를 normalize 하는지
- 파트너 순서가 바뀌어도 결과가 같은지
- 잘못된 조합이면 null이 반환되는지

---

## 빠진 테스트 유형

`/src/logic` 유닛 테스트만으로는 아래 위험을 막기 어렵다.

### 1. 실제 lazy update 경로 검증

현재 제품에서는 `src/data/stats.js`가 중요한 실제 경로 중 하나다. 따라서 최소한 아래 characterization 테스트가 필요하다.

- 저장된 과거 시점으로부터 load 시 누적 변화 적용
- 냉장고 시간 제외 처리
- 수면 시간 제외 처리
- hunger/strength zero timestamp 복원
- call timeout과 care mistake 계산

### 2. 저장 타이밍 검증

대형 Hook 구조상 실제 위험은 계산 자체보다도 "언제 저장되느냐"에 있다.

- 액션 전 lazy update
- 저장 직전 lazy update
- 스냅샷 재수신 후 상태 재동기화

이건 순수 함수 테스트만으로는 보장되지 않는다.

### 3. 모달/이벤트 플로우 검증

규칙 계산은 맞아도 UI 상태가 어긋나면 실제 버그가 된다.

- 먹이 모달 열기/닫기
- 진화 모달 진입
- 배틀 결과 모달 표시
- 사망/환생 모달 전환

이 부분은 React Testing Library 기반의 얇은 통합 테스트가 필요하다.

---

## 추천 실행 순서

### 1차

`/src/logic`의 핵심 규칙 테스트부터 추가한다.

- evolution
- battle
- hunger
- strength
- food

### 2차

현재 런타임에서 실제로 쓰는 시간 기반 경로를 characterization 테스트로 고정한다.

- `src/data/stats.js`
- 실제 액션 저장 경로

### 3차

대표 사용자 시나리오 통합 테스트를 추가한다.

- 슬롯 로드
- 먹이
- 훈련
- 배틀
- 진화

---

## 결론

현재 프로젝트의 가장 큰 테스트 약점은 "게임의 핵심 규칙이 거의 무방비 상태"라는 점이다. 특히 시간 기반 변화, 진화 조건, 배틀 계산, 저장 타이밍은 회귀 위험이 매우 높지만 자동 검증이 없다.

`/src/logic` 기준으로 가장 먼저 테스트해야 할 파일은 다음 순서가 적절하다.

1. `src/logic/evolution/checker.js`
2. `src/logic/battle/hitrate.js`
3. `src/logic/battle/calculator.js`
4. `src/logic/stats/hunger.js`
5. `src/logic/stats/strength.js`
6. `src/logic/stats/stats.js` (`src/data/stats.js` characterization 테스트와 병행)
7. `src/logic/food/meat.js`
8. `src/logic/food/protein.js`
9. `src/logic/battle/questEngine.js`
10. `src/logic/evolution/jogress.js`

가장 현실적인 첫 목표는 "전투 + 진화 + 시간 기반 감소 + 먹이"를 묶은 첫 테스트 PR 하나를 만드는 것이다. 이 한 번의 투자만으로도 이후 리팩터링과 규칙 수정의 안전성이 크게 올라간다.
