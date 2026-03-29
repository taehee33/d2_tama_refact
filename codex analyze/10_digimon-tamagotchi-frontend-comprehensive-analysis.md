# Digimon Tamagotchi Frontend 종합 분석

작성일: 2026-03-29

대상 프로젝트: `/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend`

이 문서는 다음 관점을 통합해 현재 프로젝트를 종합 정리한다.

- 구조 분석
- 아키텍처 리뷰
- PR 리뷰 관점의 correctness / regression risk
- 성능 리뷰
- 게임 규칙 구현 품질 리뷰
- 안전한 리팩터링 로드맵

---

## 1. 현재 구조 요약

현재 프로젝트는 React SPA 위에 게임 로직을 올린 구조이며, 실제 중심축은 `App.jsx -> SelectScreen.jsx -> Game.jsx` 흐름이다.

### 엔트리와 화면 흐름

- `App.jsx`가 `AuthProvider`, 라우팅, 전역 컨텍스트를 묶는다.
- 주요 흐름은 `Login -> SelectScreen -> Game`이다.
- 실질적인 메인 오케스트레이션은 `src/pages/Game.jsx`에 집중되어 있다.

### 상태와 로직 배선

- `Game.jsx`는 단순 page가 아니라 컨테이너이자 조립 허브다.
- `useGameState`가 게임 상태, 플래그, 모달 상태를 생성한다.
- `useGameData`가 슬롯 로드/저장, lazy update 적용, Firestore 경계를 맡는다.
- `useGameActions`, `useGameHandlers`, `useGameAnimations`, `useEvolution`, `useDeath`, `useArenaLogic`, `useFridge`가 도메인별 행동을 나눠 갖는다.
- 최종적으로 `GameScreen`, `ControlPanel`, `GameModals`가 렌더를 담당한다.

즉 겉보기에는 Hook가 많이 분리되어 있지만, 실제 제어권은 여전히 `Game.jsx`에 강하게 남아 있다.

### 도메인 계층과 데이터 계층

- `src/logic/`에는 battle, evolution, food, stats, training 순수 함수가 있다.
- `src/data/v1/*`는 구조화된 디지몬 데이터의 기준 소스 역할을 한다.
- `src/data/v1/adapter.js`가 기존 소비 포맷과의 호환 계층을 제공한다.

하지만 현재는 "순수 로직 계층이 완전히 canonical source인가"라는 질문에 명확히 예라고 답하기 어렵다.

- `src/data/stats.js`와 `src/logic/stats/stats.js`가 병존한다.
- 훈련/먹이/시간 기반 규칙도 일부가 `logic` 밖에서 실질 기준 역할을 한다.

### 저장소 경계

문서상으로는 Firebase/localStorage 이중 저장소와 repository 패턴이 강조되어 있다. 하지만 실제 런타임은 다르다.

- 핵심 저장 흐름은 `useGameData`의 직접 Firestore 접근에 가깝다.
- `src/repositories/*`는 실사용 경계라기보다 보존된 추상화 흔적에 가깝다.
- 인증과 화면 흐름도 Firebase 사용자 존재를 사실상 전제로 둔다.

즉 현재 구조를 한 줄로 요약하면 다음과 같다.

> "기능은 풍부하고 Hook 분해도 진행되었지만, 실제 아키텍처 중심은 여전히 `Game.jsx + useGameData + 분산된 규칙 파일` 조합이다."

---

## 2. 현재 개발 상태와 강점

이 프로젝트는 구조 문제가 분명히 있지만, 동시에 꽤 많은 강점도 갖고 있다.

### 1. 기능 성숙도가 높다

이미 다음 기능들이 하나의 앱 안에서 유기적으로 동작한다.

- 디지몬 육성
- 진화 / 조그레스
- 배틀 / 퀘스트 / 아레나
- 냉장고 / 수면 / 케어미스 / 사망
- 도감 / 계정 설정 / 슬롯 관리

즉 "초기 프로토타입" 수준은 이미 넘었고, 실제 운영/확장 단계의 고민이 필요한 코드베이스다.

### 2. 규칙 분리를 하려는 방향성 자체는 좋다

`logic`, `hooks`, `pages`, `components`, `data`로 나누려는 시도는 분명하다.

- battle / evolution / food / training 규칙이 순수 함수로 일부 분리되어 있다.
- `useGameState`, `useGameData` 같은 중심 Hook가 생겨 상태와 저장 책임을 나누려는 방향이 보인다.
- `modals`를 객체로 묶는 패턴도 난립하는 boolean 상태를 줄이려는 노력으로 볼 수 있다.

즉 지금 구조는 "무질서"라기보다 "리팩터링이 진행되다 만 상태"에 가깝다.

### 3. lazy update라는 핵심 성능 아이디어는 맞다

시간 기반 게임에서 Firestore write를 실시간 타이머로 밀지 않고, 마지막 저장 시점 기준 누적 계산으로 처리하려는 방향은 맞다.

- 비용 관점에서 합리적이다.
- 오프라인/재접속 시나리오를 다루기 위한 핵심 전제다.
- 이 패턴 자체는 계속 유지할 가치가 있다.

### 4. 데이터 구조 현대화가 진행 중이다

`src/data/v1/digimons.js`와 adapter 구조는 장기적으로 좋은 방향이다.

- 구조화된 데이터
- adapter를 통한 하위 호환
- 데이터 주도형 진화/스탯 소비

이 부분은 무너뜨리기보다, 실제 runtime 소비 경로를 여기에 더 가깝게 맞추는 것이 바람직하다.

### 5. 문서화 문화가 있다

문서가 완벽하진 않지만, 다음은 강점이다.

- `docs/REFACTORING_LOG.md`를 꾸준히 남기는 문화가 있다.
- 기능/버그/분석 메모가 많이 축적돼 있다.
- 구조, 규칙, 버그 원인에 대한 탐구 흔적이 충분하다.

즉 문서 기반 협업으로 발전시킬 수 있는 토양은 이미 있다.

---

## 3. 핵심 리스크

## P1. 아키텍처의 "공식 설명"과 실제 코드가 다르다

가장 큰 구조 리스크다.

- 문서는 dual storage / repository 패턴 / localStorage 지원을 말한다.
- 실제 실행 경로는 Firebase 중심이다.
- repository 파일은 존재하지만 핵심 흐름에서는 사용되지 않는다.

이 불일치는 신규 작업자에게 잘못된 전제를 심고, 리팩터링 방향도 흐리게 만든다.

## P1. `Game.jsx`와 대형 Hook들이 여전히 너무 많은 책임을 가진다

현재 `Game.jsx`는 page, controller, service 조립, 타이머 오케스트레이션, 저장 흐름, 상태 파생, UI 배선을 동시에 한다.

주요 Hook들도 비슷한 문제를 가진다.

- `useGameActions`: 액션 계산 + 저장 + 일부 Firestore 직접 호출
- `useEvolution`: 판정 + 실행 + 저장 + UI 사이드이펙트
- `useGameHandlers`: UI 이벤트 + 도메인 트리거 + 저장 후 보정
- `useDeath`: 사망 판정 + 환생 플로우 + 도감 갱신

결과적으로 기능 하나를 바꿀 때 여러 파일을 동시에 이해해야 하고, 회귀 위험이 크다.

## P1. 규칙의 canonical source가 하나가 아니다

이 프로젝트의 가장 위험한 correctness 리스크다.

- `data/stats.js`와 `logic/stats/stats.js` 병존
- 훈련 규칙이 둘 이상 존재
- 먹이/과식 규칙도 중복
- 사망 조건이 `applyLazyUpdate`와 `useDeath`에 분산
- 문서의 규칙 설명과 현재 코드가 또 다를 수 있음

이 상태에서는 "규칙을 수정했다"가 아니라 "규칙 후보 중 하나를 수정했다"가 되기 쉽다.

## P1. 시간 기반 상태 변화가 실시간 경로와 lazy update 경로에서 다를 수 있다

게임 플레이 품질과 회귀 위험이 가장 큰 부분이다.

- 배고픔/힘 감소 누적
- 수면 중 콜 타이머 처리
- 냉장고 시간 제외
- starvation / exhaustion 사망
- 배변 누적과 방치 부상
- 진화 대기 시간 감소

이 부분이 경로마다 다르면 플레이 결과가 세션 상태에 따라 달라질 수 있다.

## P1. 자동 테스트가 거의 없다

현재 테스트는 사실상 없는 상태다.

- 시간 기반 규칙
- 진화 조건
- 배틀 계산
- 저장 시점
- 모달 플로우

모두 고위험인데 자동 검증이 없다. 그래서 현재 구조에서는 리팩터링이 곧 회귀 위험이다.

## P2. 저장 시점과 Firestore write 경계가 분산돼 있다

저장은 `useGameData`로 모이려는 흔적이 있지만, 실제로는 여러 Hook가 Firestore를 직접 만진다.

문제점:

- 실패 시 partial update 가능성
- 슬롯 데이터와 부가 로그/도감/배경 설정이 어긋날 가능성
- write 비용 증가
- 저장 정책 추적 어려움

## P2. 성능상 리렌더와 write 비용이 커질 여지가 있다

특히 다음 조합이 부담 포인트다.

- `Game.jsx` 루트에서 1초 타이머 여러 개 운용
- 대형 state 덩어리와 광범위한 props 전달
- `Canvas` / 이미지 갱신과 전체 리렌더 전파
- `saveStats -> Firestore read/write -> snapshot 재수신` 패턴

지금 당장 망가지는 수준은 아니어도, 기능이 늘수록 체감과 비용이 같이 나빠질 수 있다.

## P2. 문서가 많지만 기준 문서가 없다

문서 부족이 아니라 문서 드리프트가 리스크다.

- 중복 구조 문서
- 오래된 README
- 실제 코드와 어긋난 repository 문서
- "공식 규칙"인지 "현재 구현"인지 구분 없는 메커니즘 문서

이 상태는 코드보다 문서가 먼저 잘못된 결론을 퍼뜨릴 수 있다.

---

## 4. 개선이 필요한 부분

현재 프로젝트는 "전면 재작성"보다 아래 다섯 축을 정리하는 것이 더 효과적이다.

## 1. 저장 계약을 먼저 명확히 해야 한다

가장 먼저 결정할 질문:

- 이 프로젝트는 Firebase-only인가
- 아니면 localStorage를 공식 지원할 것인가

이 결정이 선행되지 않으면 repository 패턴도, 문서도, 테스트 전략도 흔들린다.

## 2. 규칙 소스를 하나로 모아야 한다

특히 아래는 canonical source를 정해야 한다.

- lazy update
- 사망 조건
- 훈련 규칙
- 먹이/과식 규칙
- 배틀 파워 / 상대 해석 규칙

지금은 같은 규칙이 여러 파일에 있어 "정답 파일"이 모호하다.

## 3. `Game.jsx`를 "조립 허브" 이상으로 두지 않도록 줄여야 한다

목표는 `Game.jsx`를 없애는 것이 아니라, 책임을 아래처럼 정리하는 것이다.

- page: route / auth gate / top-level composition
- controller hook: orchestration
- service/persistence: Firestore / repository
- domain: 순수 규칙
- presenter/UI: 렌더링

## 4. 저장 시점과 write 정책을 일원화해야 한다

최소한 다음 질문에 답할 수 있어야 한다.

- 어떤 액션이 언제 저장되는가
- lazy update는 어디서 몇 번 적용되는가
- 부가 데이터는 메인 슬롯 저장과 원자적으로 묶이는가
- Firestore snapshot은 저장 후 어떤 흐름으로 상태를 다시 덮는가

## 5. 테스트와 문서화를 리팩터링 선행 작업으로 취급해야 한다

이 프로젝트에서 테스트/문서는 나중 일이 아니다.

- 테스트는 구조 변경의 안전망이다.
- 문서는 잘못된 가정이 새 코드로 퍼지는 것을 막는다.

즉 리팩터링 전에 테스트와 기준 문서를 먼저 고정해야 한다.

---

## 5. 우선순위별 리팩터링 / 테스트 / 문서화 제안

아래 순서는 "가장 적은 리스크로 가장 큰 효과" 기준이다.

## Priority 0. 현재 계약을 먼저 고정

### 리팩터링

- 코드 변경은 최소화한다.
- Firebase-only인지 dual-storage 유지인지 먼저 결정한다.

### 테스트

- 아직 구조 분해 전에 current behavior characterization 범위를 정한다.
- 최소한 아래 시나리오를 목록화한다.
  - 오래된 슬롯 로드
  - 먹이/훈련/배틀 액션
  - 진화 가능/불가
  - 냉장고 진입/해제
  - 사망/환생

### 문서화

- `README.md`를 현재 상태에 맞게 교체
- `src/repositories/README.md`를 현실에 맞게 수정 또는 deprecated 표기
- 구조 기준 문서를 하나로 지정
- `REFACTORING_LOG`에 행동 변화/저장 영향/검증 여부 필드 도입

## Priority 1. 테스트 안전망부터 만든다

### 리팩터링

- 아직 큰 구조 변경은 하지 않는다.
- 테스트 가능한 순수 함수 경계부터 정리한다.

### 테스트

첫 유닛 테스트 대상:

1. `logic/stats/stats.js`의 `applyLazyUpdate`
2. `logic/evolution/checker.js`
3. `logic/battle/hitrate.js`
4. `logic/battle/calculator.js`
5. `logic/stats/hunger.js`
6. `logic/stats/strength.js`

그 다음 characterization 대상:

- `data/stats.js`
- `useDeath.checkDeathCondition`
- 저장 직전/로드 직후 lazy update 경로

### 문서화

- 테스트 전략 문서를 기준 문서와 연결
- "현재 구현 기준"과 "의도한 스펙" 차이를 문서로 분리

## Priority 2. `Game.jsx`의 조립 코드부터 안전하게 분리

### 리팩터링

- `Game.jsx`에서 presenter 렌더 블록 분리
- 1초 타이머 로직 전용 Hook 분리
- 조립용 `useGamePageController` 또는 유사 controller hook 도입

핵심 원칙:

- behavior preserving
- prop 계약 유지
- 저장 규칙은 아직 건드리지 않음

### 테스트

- 페이지 레벨 얇은 통합 테스트 추가
- 대표 플로우:
  - 슬롯 로드
  - 진화 가능 버튼 상태
  - 먹이/훈련/배틀 action dispatch
  - 대표 모달 열기/닫기

### 문서화

- `CURRENT_PROJECT_STRUCTURE_ANALYSIS`를 새 구조에 맞게 갱신
- page/controller/presenter 경계를 다이어그램 수준으로 남김

## Priority 3. Firestore 경계와 저장 정책을 정리

### 리팩터링

- `useGameData`를 persistence service 성격으로 더 명확히 만든다.
- 다른 Hook의 직접 Firestore 접근을 단계적으로 수용/이관한다.
- 저장 API를 "slot save / aux save / transactional save"로 구분한다.

### 테스트

- save timing 테스트
- partial failure 시나리오 테스트
- snapshot 재수신 후 상태 일관성 테스트

### 문서화

- 저장 경계 문서 신설
- Firebase 경로, 부가 데이터, write 정책, lazy update 적용 지점 표준화

## Priority 4. 규칙 소스 단일화

### 리팩터링

- `data/stats.js`와 `logic/stats/stats.js`의 관계 정리
- 훈련/먹이/사망 규칙 중복 제거
- "이 파일이 공식 구현"이라는 기준을 세운다

### 테스트

- 기존 characterization 테스트가 깨지지 않도록 유지
- 규칙 통합 후 중복 테스트 정리

### 문서화

- `game_mechanics.md`를 "스펙"과 "현재 구현"으로 분리
- known divergences 섹션 추가

## Priority 5. 문서 체계를 운영 가능한 수준으로 정리

### 리팩터링

- 코드가 아니라 문서 구조 정리 단계다.

### 테스트

- 별도 코드 테스트는 필요 없지만, 문서-코드 불일치 체크리스트를 운영한다.

### 문서화

- `docs/INDEX.md` 신설
- 구조/메커니즘/분석/런북/아카이브 분류
- 중복 문서에 `superseded` 또는 `archive` 표기
- 신규 변경 시 갱신해야 할 기준 문서 목록 정의

---

## 최종 요약

현재 프로젝트는 "망가진 코드베이스"가 아니라, **기능은 충분히 성숙했지만 구조적 설명과 실제 구현이 어긋난 채 확장된 코드베이스**에 가깝다.

강점은 분명하다.

- 기능 범위가 넓고 실제 게임 루프가 살아 있다.
- lazy update, structured data, Hook 분리 같은 좋은 방향성이 있다.
- 문서와 분석 문화도 이미 존재한다.

하지만 지금 가장 큰 위험은 새 기능 부족이 아니라 다음 세 가지다.

1. 실제 아키텍처 계약이 모호하다.
2. 시간 기반 규칙과 저장 경계가 여러 파일로 분산돼 있다.
3. 테스트 안전망이 거의 없다.

따라서 가장 좋은 다음 단계는 "대규모 리팩터링"이 아니다.

1. 계약과 기준 문서를 먼저 고정하고
2. 시간 기반 / 진화 / 배틀 테스트를 먼저 추가하고
3. 그 위에서 `Game.jsx`와 저장 경계를 작은 단계로 분리하는 것

이 순서가 현재 프로젝트를 가장 안전하게 다음 단계로 옮기는 방법이다.
