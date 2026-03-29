# Digimon Tamagotchi Frontend Refactoring Specialist Roadmap

작성일: 2026-03-29

`refactoring-specialist` 정의를 확인한 뒤, behavior preserving 원칙으로 `/src/pages/Game.jsx`와 대형 Hook들을 어떤 순서로 나누는 것이 안전한지 다시 정리했다.

## 분석한 경계

- 대상 워크플로우: `App -> Game.jsx -> useGameState/useGameData -> domain hooks -> GameScreen/ControlPanel/GameModals`
- 중점 파일:
  - `src/pages/Game.jsx` (1978줄)
  - `src/hooks/useGameActions.js` (1113줄)
  - `src/hooks/useEvolution.js` (972줄)
  - `src/hooks/useGameLogic.js` (756줄)
  - `src/hooks/useGameData.js` (701줄)
  - `src/hooks/useGameState.js` (595줄)
  - `src/hooks/useGameHandlers.js` (354줄)
  - `src/hooks/useGameAnimations.js` (340줄)
  - `src/hooks/useDeath.js` (202줄)
  - `src/hooks/useArenaLogic.js` (135줄)

## 가장 큰 마찰 원인

현재 구조에서 리팩터링이 어려운 이유는 "파일이 큰 것" 자체보다 "분리 기준이 겹친다"는 점에 있다.

- `Game.jsx`는 page, controller, timer loop, Firestore subscriber, direct persistence caller 역할을 동시에 가진다.
- `useGameData`는 persistence hook처럼 보이지만 death popup과 UI side effect까지 건드린다.
- `useGameActions`와 `useEvolution`은 domain action coordinator이면서 Firestore writer 역할도 같이 가진다.
- `useGameLogic`과 `useGameHandlers`에는 순수 함수와 React/UI-adapter 코드가 함께 있다.

그래서 안전한 순서는 "규칙을 바꾸는 분해"가 아니라 "호출 경계를 먼저 드러내는 분해"여야 한다.

## 리팩터링 원칙

- 한 단계에서 하나의 seam만 만든다.
- 공개 API는 가능한 유지한다.
- 시간 규칙, lazy update, 진화 규칙, 저장 계약은 초반에 바꾸지 않는다.
- Firestore write 순서와 모달 전이 순서는 구조 변경 단계에서 손대지 않는다.
- 각 단계는 되돌리기 쉬운 작은 PR 단위로 유지한다.

## 단계별 로드맵

### 단계 0. Characterization 테스트로 현행 동작 고정

- 목표:
  - 구조를 바꾸기 전에 현재 동작을 테스트로 고정한다.
  - 특히 시간 기반 규칙, 저장 시점, 진화/배틀 결과, 모달 전이를 "현행 기준"으로 캡처한다.
- 영향 파일:
  - `src/data/stats.js`
  - `src/logic/evolution/checker.js`
  - `src/logic/battle/calculator.js`
  - `src/hooks/useGameActions.js`
  - `src/hooks/useEvolution.js`
  - `src/hooks/useDeath.js`
  - 새 테스트 파일들
- 기대 효과:
  - 이후 diff가 구조 변경인지 동작 변경인지 구분할 수 있다.
  - `Game.jsx` 분리 중 자신 있게 rollback 가능한 기준선이 생긴다.
- 주의할 회귀 위험:
  - 이 단계에서 "이상적인 규칙"으로 테스트를 쓰면 안 된다.
  - 먼저 현재 구현을 고정하고, 규칙 수정은 다음 작업으로 미뤄야 한다.

### 단계 1. `Game.jsx`의 props 조립 코드부터 추출

- 목표:
  - `Game.jsx`에서 hook 호출 결과를 `handlers`, `data`, `ui`로 조립하는 코드만 분리한다.
  - 로직은 그대로 두고 "전달 객체 생성"만 밖으로 빼는 단계다.
- 영향 파일:
  - `src/pages/Game.jsx`
  - 신규 예시:
    - `src/pages/game/buildGameHandlers.js`
    - `src/pages/game/buildGameData.js`
    - `src/pages/game/buildGameViewModel.js`
- 현재 seam 근거:
  - `src/pages/Game.jsx:1439-1523`
  - `src/pages/Game.jsx:1935-1966`
- 기대 효과:
  - `Game.jsx`에서 가장 먼저 읽기 부담이 줄어든다.
  - 이후 렌더 분리와 controller 분리를 할 때 props shape를 재사용할 수 있다.
- 주의할 회귀 위험:
  - object shape를 조금이라도 바꾸면 `GameScreen`, `ControlPanel`, `GameModals`가 조용히 깨질 수 있다.
  - 이 단계에서는 memoization까지 같이 넣지 않는 편이 안전하다.

### 단계 2. `Game.jsx`를 컨테이너와 프리젠터로 분리

- 목표:
  - `Game.jsx`는 hook orchestration만 남기고, JSX 렌더 블록은 `GamePageView`로 이동한다.
  - 인증 가드, hook wiring, effect는 컨테이너에 남기고 화면 배치는 뷰로 뺀다.
- 영향 파일:
  - `src/pages/Game.jsx`
  - 신규 예시:
    - `src/pages/game/GamePageView.jsx`
    - `src/pages/game/GamePanels.jsx`
    - `src/pages/game/GameModalLayer.jsx`
- 현재 seam 근거:
  - `src/pages/Game.jsx:1811-1975`
- 기대 효과:
  - 가장 큰 파일에서 "render noise"가 빠져서 실제 결합 포인트가 더 잘 보인다.
  - 이후 타이머/구독 분리 시 화면 diff가 작아진다.
- 주의할 회귀 위험:
  - 조건 렌더링 순서, modal mount 타이밍, animation prop 누락이 흔한 회귀 포인트다.
  - `ControlPanel`과 `GameModals`가 받는 함수 참조가 바뀌어 이벤트 타이밍이 달라지지 않도록 주의해야 한다.

### 단계 3. 실시간 루프와 subscription effect를 전용 hook로 분리

- 목표:
  - `Game.jsx` 내부의 1초 타이머, death popup trigger, slot/jogress `onSnapshot` 구독을 별도 runtime hook로 옮긴다.
  - 규칙은 유지하고 위치만 바꾼다.
- 영향 파일:
  - `src/pages/Game.jsx`
  - 신규 예시:
    - `src/hooks/game-runtime/useGameRealtimeLoop.js`
    - `src/hooks/game-runtime/useSlotRealtimeSubscriptions.js`
    - `src/hooks/game-runtime/useJogressRealtimeSubscriptions.js`
- 현재 seam 근거:
  - 타이머/콜/사망 처리: `src/pages/Game.jsx:431-809`
  - slot/jogress 구독: `src/pages/Game.jsx:1321-1368`
  - direct save side effect: `src/pages/Game.jsx:774-779`
- 기대 효과:
  - `Game.jsx`가 "조립 파일"에 가까워진다.
  - 시간 기반 코드와 렌더링 코드가 분리되어 이후 테스트와 계측이 쉬워진다.
- 주의할 회귀 위험:
  - dependency array 변화로 interval 재설치 빈도가 달라지면 behavior가 바뀔 수 있다.
  - `latestStatsRef`, `prevSleepingRef`, `lastAddedCareMistakeKeysRef` 같은 ref의 수명 보존이 중요하다.
  - 이 단계에서는 타이머 통합이나 규칙 수정까지 같이 하면 안 된다.

### 단계 4. 페이지 바깥으로 direct Firestore 호출만 먼저 밀어낸다

- 목표:
  - repository 전면 도입이 아니라, 현재 흩어진 raw Firestore write/read를 얇은 persistence adapter로 감싼다.
  - "어디서 DB를 직접 만지는지"를 줄이는 단계다.
- 영향 파일:
  - `src/pages/Game.jsx`
  - `src/hooks/useGameActions.js`
  - `src/hooks/useGameHandlers.js`
  - `src/hooks/useEvolution.js`
  - 신규 예시:
    - `src/services/gameSlotWrites.js`
    - `src/services/arenaWrites.js`
    - `src/services/jogressWrites.js`
- 현재 seam 근거:
  - `Game.jsx` direct write: `src/pages/Game.jsx:774-779`, `src/pages/Game.jsx:1052-1059`
  - arena write: `src/hooks/useGameActions.js:696-800`
  - light toggle write: `src/hooks/useGameHandlers.js:318-326`
  - jogress room / slot write: `src/hooks/useEvolution.js:369-918`
- 기대 효과:
  - 이후 `useGameData` 정리나 repository 정책 정리가 훨씬 안전해진다.
  - hook와 page가 domain coordinator에 더 집중하게 된다.
- 주의할 회귀 위험:
  - write 순서, timestamp 생성 위치, 예외 처리 타이밍이 바뀌면 실동작이 달라질 수 있다.
  - adapter 내부 구현은 이동만 하고 semantics는 유지해야 한다.

### 단계 5. `useGameActions`를 내부 모듈로 분리하되 외부 API는 유지

- 목표:
  - `useGameActions()` 하나를 계속 export하면서, 내부를 feed/train/battle/clean/action-support 모듈로 나눈다.
  - `Game.jsx` 호출부는 그대로 둔다.
- 영향 파일:
  - `src/hooks/useGameActions.js`
  - 신규 예시:
    - `src/hooks/game-actions/useFeedActions.js`
    - `src/hooks/game-actions/useTrainActions.js`
    - `src/hooks/game-actions/useBattleActions.js`
    - `src/hooks/game-actions/useCleanActions.js`
    - `src/hooks/game-actions/actionUtils.js`
- 현재 seam 근거:
  - feed 계열: `src/hooks/useGameActions.js:203-429`
  - train 계열: `src/hooks/useGameActions.js:434-558`
  - clean 계열: `src/hooks/useGameActions.js:563-619`
  - battle 계열: `src/hooks/useGameActions.js:624-1113`
- 기대 효과:
  - 1100줄짜리 hook에서 행위별 수정 범위를 줄일 수 있다.
  - feed/train/battle 테스트를 더 좁은 단위로 붙이기 쉬워진다.
- 주의할 회귀 위험:
  - 공통 의존성이 많아서 param object를 너무 빨리 정리하려 들면 오히려 churn이 커진다.
  - 1차 단계에서는 "내부 분리 + 기존 반환 shape 유지"만 해야 안전하다.

### 단계 6. `useEvolution`을 일반 진화와 jogress coordinator로 분리

- 목표:
  - 일반 진화(`proceedEvolution`, `evolve`, reset semantics)와 online/offline jogress 흐름을 분리한다.
  - 다만 외부에서는 계속 `useEvolution()` 하나만 사용하게 둔다.
- 영향 파일:
  - `src/hooks/useEvolution.js`
  - 신규 예시:
    - `src/hooks/evolution/useNormalEvolution.js`
    - `src/hooks/evolution/useJogressFlow.js`
    - `src/hooks/evolution/evolutionPersistence.js`
- 현재 seam 근거:
  - 일반 진화: `src/hooks/useEvolution.js:84-277`
  - jogress 파트너/방 생성/완료/취소: `src/hooks/useEvolution.js:329-947`
- 기대 효과:
  - 진화 조건 변경과 jogress 네트워크 흐름 변경이 서로 덜 얽힌다.
  - 일반 진화 테스트와 jogress 통합 테스트를 अलग-अलग 관리할 수 있다.
- 주의할 회귀 위험:
  - `toggleModal`, `setEvolutionStage`, `setIsEvolving`, `setEvolutionCompleteJogressSummary` 전달 누락이 생기기 쉽다.
  - reset semantics를 이 단계에서 손보면 behavior preserving 원칙이 깨진다.

### 단계 7. `useGameData`를 hydration/save 경계로 좁히고 UI side effect를 밖으로 뺀다

- 목표:
  - `useGameData`는 slot load/save/lazy update/log append에 집중시키고, death popup 같은 UI side effect는 상위 controller로 밀어낸다.
  - persistence boundary를 더 선명하게 만든다.
- 영향 파일:
  - `src/hooks/useGameData.js`
  - `src/pages/Game.jsx`
  - 신규 예시:
    - `src/hooks/game-data/useSlotHydration.js`
    - `src/hooks/game-data/useSlotPersistence.js`
- 현재 seam 근거:
  - save path: `src/hooks/useGameData.js:144-302`
  - applyLazyUpdateForAction: `src/hooks/useGameData.js:308-381`
  - death popup side effect: `src/hooks/useGameData.js:388-426`
  - load/hydrate: `src/hooks/useGameData.js:430-617`
- 기대 효과:
  - 저장 경계와 UI 경계가 분리된다.
  - 이후 repository 전략을 정리할 때 변경 범위를 줄일 수 있다.
- 주의할 회귀 위험:
  - death modal 오픈 타이밍이 달라지면 사용자 체감이 바로 바뀐다.
  - `applyLazyUpdateBeforeAction()`과 `saveStats()`의 현재 방어 로직 순서를 유지해야 한다.

### 단계 8. `useGameLogic` / `useGameHandlers`에서 순수 함수만 분리

- 목표:
  - React 의존이 없는 함수만 `logic/` 또는 `utils/`로 이동하고, hook 파일에는 React adapter 코드만 남긴다.
  - 이 단계는 구조 정리이지 규칙 재설계가 아니다.
- 영향 파일:
  - `src/hooks/useGameLogic.js`
  - `src/hooks/useGameHandlers.js`
  - `src/logic/*` 또는 `src/utils/*`
- 현재 seam 예시:
  - sleep/call 계산 유틸: `src/hooks/useGameLogic.js`
  - sleep schedule 판정 유틸: `src/hooks/useGameHandlers.js`
- 기대 효과:
  - `logic/` 테스트와 hook 테스트의 경계가 선명해진다.
  - TypeScript 마이그레이션이나 service extraction을 준비하기 쉬워진다.
- 주의할 회귀 위험:
  - 순수 함수처럼 보여도 실제로는 setter나 modal state 전제에 기대는 함수가 섞여 있을 수 있다.
  - import 경로만 바꾸는 단계와 signature 정리 단계를 분리해야 한다.

### 단계 9. 마지막에만 repository/localStorage 문서와 실제 계약을 맞춘다

- 목표:
  - 초반 구조 분리가 끝난 뒤에야 repository 패턴과 dual-storage 문서를 현실에 맞게 정리한다.
  - behavior preserving 리팩터링과 저장 전략 재설계를 섞지 않는다.
- 영향 파일:
  - `src/repositories/*`
  - `src/contexts/AuthContext.jsx`
  - `src/pages/SelectScreen.jsx`
  - `docs/*`
- 기대 효과:
  - 앞선 단계에서 드러난 실제 persistence boundary를 기준으로 문서와 구현을 맞출 수 있다.
  - 불필요한 "추상화 복원" 작업을 피할 수 있다.
- 주의할 회귀 위험:
  - 이 단계를 너무 앞당기면 localStorage 지원 복구 같은 큰 구조 변경으로 번질 수 있다.
  - 현재 요청 범위에서는 defer가 맞다.

## 이 순서가 안전한 이유

- 먼저 옮기는 것은 조립 코드와 렌더 코드다.
- 그 다음에만 runtime effect와 direct persistence를 분리한다.
- 실제 규칙 엔진과 저장 정책은 후반으로 미룬다.

즉 초반 1~4단계는 "보이는 결합"을 줄이는 작업이고, 5~8단계는 "대형 hook 내부 책임"을 줄이는 작업이다. 이 순서를 뒤집으면 규칙 변경과 구조 변경이 한 PR에 섞일 가능성이 높다.

## 단계별 테스트 게이트 권장안

- 1단계 통과 기준:
  - `GameScreen`, `ControlPanel`, `GameModals` props shape snapshot 유지
- 2단계 통과 기준:
  - 페이지 smoke test와 주요 modal open/close 경로 유지
- 3단계 통과 기준:
  - 1초 타이머, death popup, slot/jogress 구독이 이전과 같은 시점에 동작
- 4단계 통과 기준:
  - Firestore write payload와 호출 순서가 동일
- 5~8단계 통과 기준:
  - feed/train/battle/evolution/death의 characterization 테스트 유지

## 지금 당장 하지 말아야 할 것

- `Game.jsx`와 대형 Hook를 한 번에 여러 파일로 대분해하는 작업
- `logic/stats`와 `data/stats`를 초반에 바로 통합하는 작업
- repository 패턴 복원과 Firebase/localStorage 지원 복구를 동시에 시도하는 작업
- 시간 규칙 수정과 구조 분리를 같은 PR에 넣는 작업

## 결론

가장 작은 안전한 시작점은 `Game.jsx`의 조립 코드와 렌더 블록을 먼저 빼는 것이다. 그 다음 실시간 루프와 direct Firestore 호출을 분리하고, 마지막에 대형 Hook 내부를 쪼개야 한다. 지금 구조에서는 "규칙을 먼저 정리하려는 리팩터링"보다 "호출 경계와 저장 경계를 먼저 드러내는 리팩터링"이 훨씬 안전하다.
