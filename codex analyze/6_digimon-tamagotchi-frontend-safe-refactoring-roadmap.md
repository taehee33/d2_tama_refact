# Digimon Tamagotchi Frontend Safe Refactoring Roadmap

작성일: 2026-03-29

## 목적

이 문서는 현재 구조 분석 결과를 바탕으로, `behavior preserving` 원칙을 지키면서 `/src/pages/Game.jsx`와 대형 Hook들을 안전하게 분리하는 단계별 로드맵을 제안한다.

핵심 전제는 다음과 같다.

- 한 PR에서 “파일 이동/구조 분리”와 “도메인 규칙 수정”을 같이 하지 않는다.
- 먼저 현재 동작을 고정하고, 그 다음 의존성 방향을 정리한다.
- 가장 먼저 건드릴 대상은 “순수 이동이 가능한 코드”와 “렌더링 조립 코드”다.
- 가장 나중에 건드릴 대상은 “시간 기반 규칙”, “lazy update”, “저장소 계약”이다.

## 현재 구조에서 리팩터링 우선순위를 결정한 근거

- `Game.jsx`가 1,978줄로 라우팅, 인증 가드, 타이머, 저장, 구독, 화면 조립을 함께 가진다.
  - `src/pages/Game.jsx:123`
  - `src/pages/Game.jsx:302`
  - `src/pages/Game.jsx:818`
  - `src/pages/Game.jsx:877`
  - `src/pages/Game.jsx:911`
  - `src/pages/Game.jsx:929`
  - `src/pages/Game.jsx:977`
  - `src/pages/Game.jsx:1008`
- 렌더 직전에 `handlers`, `data` 같은 거대한 조립 객체를 새로 만든다.
  - `src/pages/Game.jsx:1475`
  - `src/pages/Game.jsx:1523`
- `GameModals`에는 `gameState`, `handlers`, `data`, `ui`, `flags`를 한 번에 전달한다.
  - `src/pages/Game.jsx:1934-1953`
- 대형 Hook들도 이미 각각 수백 줄이다.
  - `useGameActions.js`: 1,113줄
  - `useEvolution.js`: 972줄
  - `useGameLogic.js`: 756줄
  - `useGameData.js`: 701줄
  - `useGameState.js`: 595줄

즉, 안전한 순서는 “대형 Hook를 더 쪼개기 전에 Game.jsx가 조립자 역할만 하도록 만들고, 그 다음 Hook 내부 책임을 서서히 분리”하는 방향이 맞다.

## 리팩터링 원칙

### 1. 구조 변경과 규칙 변경 분리

- 시간 계산, 진화, 배틀, 케어미스, 사망 규칙은 후반 단계까지 수정하지 않는다.
- 초기 단계는 이름 변경, 파일 이동, props 조립 분리, Hook façade 추가에만 집중한다.

### 2. 공개 계약 유지

- `Game.jsx`가 자식 컴포넌트에 넘기는 props 이름은 가능한 유지한다.
- 기존 Hook export 이름과 반환 shape는 중간 단계에서 유지한다.
- 내부에서 새 Hook/서비스를 도입하더라도 바깥 호출 코드는 최대한 그대로 둔다.

### 3. 작은 PR 전략

- 각 단계는 “1개 축만 바꾼다”.
- 이상적인 단위는 “파일 이동 + import 변경 + 테스트/문서 보강” 수준이다.
- 한 단계에서 5개 이상의 책임을 동시에 재배치하지 않는다.

## 단계별 로드맵

## 단계 0. 현재 동작 고정용 Characterization 테스트 추가

목표:

- 리팩터링 전에 현재 동작을 테스트로 고정한다.
- 특히 버그가 있어 보여도 지금 단계에서는 “현행 동작을 스냅샷처럼 기록”하는 것이 목적이다.

영향 파일:

- `src/logic/stats/*`
- `src/logic/evolution/checker.js`
- `src/logic/battle/calculator.js`
- `src/hooks/useGameLogic.js`
- `src/hooks/useGameData.js`
- `src/hooks/useGameActions.js`
- 새 테스트 파일들

추천 테스트 우선순위:

- lazy update 입력/출력 테스트
- 실시간 hunger/strength tick 테스트
- call timeout과 sleep 중 pause 처리 테스트
- evolution target 선택 테스트
- arena/sparring/quest battle 계산 테스트
- `Game` 페이지에서 최소한의 smoke test

기대 효과:

- 이후 단계에서 “구조만 바뀌었는지, 동작도 바뀌었는지”를 구분할 수 있다.
- 후반의 규칙 통합 작업을 더 안전하게 시작할 수 있다.

주의할 회귀 위험:

- 테스트를 “이상적인 규칙” 기준으로 작성하면 안 된다.
- 먼저 현재 구현 기준으로 고정하고, 규칙 수정은 별도 단계로 분리해야 한다.

## 단계 1. `Game.jsx`에서 “조립 코드”만 먼저 추출

목표:

- `Game.jsx`에서 화면용 조립 객체와 파생 props 생성을 별도 파일로 뺀다.
- 아직 로직은 그대로 두고, JSX 직전의 `handlers`, `data`, `ui/gameState props build`만 추출한다.

영향 파일:

- `src/pages/Game.jsx`
- 신규 예시:
  - `src/pages/game/buildGameHandlers.js`
  - `src/pages/game/buildGameData.js`
  - `src/pages/game/buildGameModalProps.js`

대상 코드:

- `src/pages/Game.jsx:1475-1537`
- `src/pages/Game.jsx:1934-1953`

기대 효과:

- `Game.jsx`의 “읽기 난이도”가 가장 먼저 줄어든다.
- 이후 단계에서 어떤 값이 진짜 로직이고 어떤 값이 단순 조립인지 구분이 쉬워진다.

주의할 회귀 위험:

- object shape를 바꾸지 말고 그대로 이동해야 한다.
- 이 단계에서는 memoization까지 같이 넣지 않는 편이 안전하다.

## 단계 2. `Game.jsx`의 렌더 블록을 Presenter 계층으로 분리

목표:

- `Game.jsx`를 “컨테이너”로 만들고, 실제 렌더 블록은 `GamePageView` 같은 프리젠터 컴포넌트로 분리한다.
- 인증/데이터 로딩/Hook 호출은 컨테이너에 남기고 JSX 마크업만 이동한다.

영향 파일:

- `src/pages/Game.jsx`
- 신규 예시:
  - `src/pages/game/GamePageView.jsx`
  - `src/pages/game/GameHeader.jsx`
  - `src/pages/game/GameActionBar.jsx`

대상 코드:

- `src/pages/Game.jsx:1544-1975`

기대 효과:

- `Game.jsx`가 “Hook orchestration 파일”로 역할이 선명해진다.
- 이후 단계에서 타이머/구독 로직을 분리해도 화면 diff가 작아진다.

주의할 회귀 위험:

- JSX 이동 중 조건 렌더링 순서가 바뀌지 않도록 주의해야 한다.
- `toggleModal`, `statusDetailMessages`, `slotJogressStatus` 같은 지역 상태 전달 누락이 흔한 회귀 포인트다.

## 단계 3. 실시간 타이머를 전용 Hook로 분리

목표:

- `Game.jsx` 안의 1초 타이머들을 전용 Hook로 뺀다.
- 아직 내부 규칙은 바꾸지 않고 “그대로 옮기는 것”이 목적이다.

영향 파일:

- `src/pages/Game.jsx`
- 신규 예시:
  - `src/hooks/game-runtime/useGameRealtimeLoop.js`
  - `src/hooks/game-runtime/useSleepStatusLoop.js`
  - `src/hooks/game-runtime/useVisibilitySave.js`

대상 코드:

- `src/pages/Game.jsx:404-428`
- `src/pages/Game.jsx:431-809`
- `src/pages/Game.jsx:1299-1313`

기대 효과:

- `Game.jsx`에서 가장 위험한 시간 기반 로직이 시각적으로 분리된다.
- 실시간 루프와 렌더링 조립이 분리되어 후속 리팩터링 난이도가 낮아진다.

주의할 회귀 위험:

- dependency array 변화로 타이머 재설치 빈도가 달라지지 않게 해야 한다.
- `latestStatsRef`, `prevSleepingRef`, `lastAddedCareMistakeKeysRef`의 생명주기를 유지해야 한다.
- 이 단계에서는 타이머 개수 통합까지 하지 말고 “위치 이동만” 하는 것이 안전하다.

## 단계 4. Firestore 직접 호출을 “페이지 외부”로 밀어낸다

목표:

- `Game.jsx`, `useGameHandlers`, `useGameActions`, `useEvolution` 안에 흩어진 `updateDoc/addDoc/onSnapshot`을 얇은 persistence helper로 감싼다.
- repository 전면 도입이 아니라, 먼저 “직접 DB 호출 위치를 한 곳으로 모으는 것”이 목적이다.

영향 파일:

- `src/pages/Game.jsx`
- `src/hooks/useGameHandlers.js`
- `src/hooks/useGameActions.js`
- `src/hooks/useEvolution.js`
- 신규 예시:
  - `src/services/gameSlotPersistence.js`
  - `src/services/arenaPersistence.js`
  - `src/services/jogressPersistence.js`

대상 예시:

- `src/pages/Game.jsx:776`
- `src/pages/Game.jsx:1057`
- `src/hooks/useGameHandlers.js`
- `src/hooks/useGameActions.js:665-800`
- `src/hooks/useEvolution.js` 전반

기대 효과:

- 이후 repository 패턴 정리나 localStorage 지원 정리 전에 “DB access map”이 생긴다.
- 큰 Hook들이 도메인 조합 역할에 집중할 수 있다.

주의할 회귀 위험:

- write 순서가 바뀌면 실제 동작이 달라질 수 있다.
- 이 단계에서는 `Promise` 순서와 예외 처리 흐름을 유지해야 한다.
- helper 이름만 생기고 transaction semantics가 바뀌면 안 된다.

## 단계 5. `useGameActions`를 행위별 Hook로 쪼개되, 공개 API는 유지

목표:

- `useGameActions`를 내부적으로 분해하되, `Game.jsx`는 당분간 같은 `useGameActions()` 하나만 호출하게 둔다.
- 즉 외부 계약은 유지하고 내부만 분할한다.

영향 파일:

- `src/hooks/useGameActions.js`
- 신규 예시:
  - `src/hooks/game-actions/useFeedActions.js`
  - `src/hooks/game-actions/useTrainActions.js`
  - `src/hooks/game-actions/useBattleActions.js`
  - `src/hooks/game-actions/useCleanActions.js`

분리 기준:

- Feed 계열
- Train 계열
- Battle result 계열
- Poop clean 계열
- Sleep disturbance helper 계열

기대 효과:

- 현재 1,113줄짜리 Hook를 “액션 도메인 묶음”으로 읽을 수 있게 된다.
- 각 액션 경로별로 characterization test를 붙이기 쉬워진다.

주의할 회귀 위험:

- `setDigimonStats`와 `setDigimonStatsAndSave`를 함께 쓰는 순서가 바뀌지 않게 해야 한다.
- `appendLogToSubcollection` 호출 시점이 바뀌면 로그 중복/누락이 발생할 수 있다.

## 단계 6. `useEvolution`을 일반 진화와 조그레스 흐름으로 분리

목표:

- `useEvolution` 안에서 정상 진화와 온라인 조그레스/로컬 조그레스를 분리한다.
- 일반 진화는 도메인 로직 중심, 조그레스는 room/pairing/persistence 중심으로 나눈다.

영향 파일:

- `src/hooks/useEvolution.js`
- 신규 예시:
  - `src/hooks/game-evolution/useNormalEvolution.js`
  - `src/hooks/game-evolution/useJogressFlow.js`
  - `src/hooks/game-evolution/useJogressRealtime.js`

대상 코드:

- 일반 진화
- 로컬 파트너 선택
- 온라인 방 생성/취소/paired/completed 처리

기대 효과:

- 진화 버튼 흐름과 실시간 매칭 흐름이 분리된다.
- 가장 길고 복잡한 Hook 중 하나가 “도메인 규칙”과 “실시간 협업 상태”를 분리하게 된다.

주의할 회귀 위험:

- 조그레스는 Firestore room 상태와 slot 상태가 얽혀 있어 작은 순서 변화로도 회귀가 날 수 있다.
- 일반 진화 분리와 조그레스 분리를 같은 PR로 하지 않는 편이 안전하다.

## 단계 7. `useGameHandlers`를 UI navigation handler와 domain trigger로 분리

목표:

- 메뉴 클릭/모달 열기/로그아웃 같은 UI event와, quest/sparring/lights toggle처럼 실제 게임 상태를 건드리는 handler를 나눈다.

영향 파일:

- `src/hooks/useGameHandlers.js`
- 신규 예시:
  - `src/hooks/game-ui/useMenuHandlers.js`
  - `src/hooks/game-ui/useQuestNavigationHandlers.js`
  - `src/hooks/game-ui/useDeviceToggleHandlers.js`

기대 효과:

- 어떤 함수가 “화면 전환”인지, 어떤 함수가 “게임 규칙 액션 시작”인지 구분된다.
- UI만 바꾸는 변경과 도메인을 건드는 변경을 분리해서 리뷰할 수 있다.

주의할 회귀 위험:

- `handleMenuClick`는 수면방해, 모달 상태, 액티브 메뉴를 함께 건드릴 수 있으므로 묶음을 잘못 쪼개면 부작용 순서가 바뀐다.

## 단계 8. `Game.jsx` 전체 오케스트레이션을 `useGamePageController`로 감싼다

목표:

- 앞 단계까지 분리된 Hook들을 다시 한곳에서 조합하는 “페이지 전용 컨트롤러 Hook”를 만든다.
- 최종적으로 `Game.jsx`는 아래 두 줄 수준을 목표로 한다.
  - `const controller = useGamePageController(...)`
  - `<GamePageView {...controller.viewProps} />`

영향 파일:

- `src/pages/Game.jsx`
- 신규 예시:
  - `src/pages/game/useGamePageController.js`

기대 효과:

- 페이지 오케스트레이션이 한 Hook로 캡슐화되어 `Game.jsx`가 매우 얇아진다.
- 이후 코드 소유권과 테스트 대상을 `GamePageController`에 집중시킬 수 있다.

주의할 회귀 위험:

- 너무 이른 단계에서 이 작업을 하면 “거대한 파일을 거대한 Hook로 옮기는 것”이 되어 이득이 작다.
- 반드시 단계 1~7 이후에 수행하는 것이 안전하다.

## 단계 9. canonical domain 규칙 소스를 하나로 정리

목표:

- 중복된 규칙 구현을 하나의 canonical source로 모은다.
- 단, 이 단계는 구조 리팩터링 이후의 “룰 엔진 정리” 단계로 본다.

우선 정리 대상:

- `data/stats.js` vs `logic/stats/stats.js`
- `logic/food/meat.js` vs `logic/stats/hunger.js`의 `feedMeat`
- `data/train_digitalmonstercolor25th_ver1.js` vs `logic/training/train.js`

영향 파일:

- `src/data/stats.js`
- `src/logic/stats/*`
- `src/data/train_digitalmonstercolor25th_ver1.js`
- `src/logic/training/train.js`
- `src/logic/food/*`

기대 효과:

- “어느 파일이 진짜 규칙인지”가 명확해진다.
- 이후 규칙 수정이 behavior preserving 테스트 위에서 가능해진다.

주의할 회귀 위험:

- 이 단계는 구조 리팩터링이 아니라 실제 규칙 통합이므로, behavior preserving이 깨질 가능성이 가장 높다.
- 반드시 단계 0의 characterization test가 준비된 뒤 진행해야 한다.

## 단계 10. 저장소 계약 정리: Firebase-only 명시 또는 이중 저장소 복원

목표:

- 현재 문서상 계약과 실제 런타임 계약의 차이를 해소한다.
- 둘 중 하나를 명확히 선택한다.

선택지 A:

- Firebase-only를 공식화하고 `repositories`를 정리

선택지 B:

- 실제 localStorage repository를 다시 살려서 문서와 구현을 맞춤

영향 파일:

- `src/repositories/*`
- `src/contexts/AuthContext.jsx`
- `src/pages/Game.jsx`
- `src/pages/SelectScreen.jsx`
- `src/hooks/useGameData.js`

기대 효과:

- 장기 유지보수에서 가장 큰 혼동 포인트 중 하나가 사라진다.
- persistence 계층 리팩터링이 의미 있는 구조가 된다.

주의할 회귀 위험:

- 이 단계는 구조보다 제품 정책 결정에 가깝다.
- behavior preserving을 유지하려면 먼저 “현재는 Firebase-only에 가깝다”는 현실을 인정하고 문서부터 맞추는 것이 더 안전하다.

## 추천 PR 묶음 순서

가장 안전한 순서는 아래와 같다.

1. 단계 0
2. 단계 1
3. 단계 2
4. 단계 3
5. 단계 4
6. 단계 5
7. 단계 6
8. 단계 7
9. 단계 8
10. 단계 9
11. 단계 10

이 순서가 좋은 이유:

- 초반은 “순수 이동” 위주라 회귀 위험이 낮다.
- 중반부터 Hook 내부 책임을 나누고, 후반에야 규칙과 저장소 계약을 건드린다.
- 가장 위험한 “시간 규칙 정리”와 “이중 저장소 정리”를 맨 뒤로 미룬다.

## 작은 단계로 쪼개는 구체 기준

각 PR은 아래 중 1개만 만족하도록 만드는 것이 좋다.

- JSX 블록만 이동
- Hook 내부 함수 묶음만 별도 파일로 이동
- Firestore 호출 wrapper만 추가
- props builder만 분리
- 테스트만 추가

한 PR에서 피해야 할 조합:

- 타이머 분리 + 규칙 수정
- Hook 분해 + Firestore write 순서 변경
- repository 도입 + 인증 흐름 수정
- evolution/jogress 동시 분해

## 최종 목표 구조 예시

### pages

- `src/pages/Game.jsx`
- `src/pages/game/useGamePageController.js`
- `src/pages/game/GamePageView.jsx`

### hooks

- `src/hooks/game-runtime/*`
- `src/hooks/game-actions/*`
- `src/hooks/game-evolution/*`
- `src/hooks/game-ui/*`
- `src/hooks/game-persistence/*`

### services

- `src/services/gameSlotPersistence.js`
- `src/services/arenaPersistence.js`
- `src/services/jogressPersistence.js`

### logic

- `src/logic/stats/*`
- `src/logic/food/*`
- `src/logic/training/*`
- `src/logic/evolution/*`
- `src/logic/battle/*`

## 결론

이 프로젝트에서 가장 안전한 리팩터링 전략은 “큰 파일을 한 번에 찢는 것”이 아니라, 먼저 `Game.jsx`를 `조립자`와 `화면`으로 분리하고, 그 다음 타이머와 Firestore 호출을 밖으로 밀어낸 뒤, 마지막에야 도메인 규칙 소스를 통합하는 방식이다.

특히 `Game.jsx`와 대형 Hook들을 바로 새 아키텍처로 옮기려 하면 behavior preserving이 깨질 가능성이 높다. 반대로 위 순서대로 가면, 초반에는 거의 구조만 바꾸고도 코드 가독성과 변경 안전성을 크게 올릴 수 있다.
