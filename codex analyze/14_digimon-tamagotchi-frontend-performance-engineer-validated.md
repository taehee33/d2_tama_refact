# Digimon Tamagotchi Frontend Performance Review

작성일: 2026-03-29  
기준: `performance-engineer.toml` 관점  
범위: `digimon-tamagotchi-frontend`의 실시간 타이머, UI 업데이트, 상태 파생 계산, Firestore 저장/구독 경로, lazy update 패턴 준수 여부

## 리뷰 범위와 검증한 경로

- 정상 경로: 게임 화면을 켜 둔 상태에서 idle 유지
- 실패/비용 경로: call timeout, poop 증가, death transition, unload save, action 직전 lazy update
- 통합 경계: `saveStats -> Firestore updateDoc -> slot onSnapshot`, `Game -> GameScreen/ControlPanel/GameModals -> Canvas`

이번 리뷰는 정적 코드 분석이다. 실제 React Profiler 수치나 Firestore emulator write/read count는 아직 측정하지 않았다.

## 핵심 결론

- lazy update 원칙 자체는 메인 연속 스탯 저장 경로에서는 대체로 지켜지고 있다.
- 하지만 idle 상태에서도 루트가 최소 초당 여러 번 다시 렌더되고, 그 렌더가 `Canvas` 재초기화와 큰 트리 재렌더로 전파될 가능성이 높다.
- 또한 액션 1회당 `getDoc + updateDoc + addDoc(log)` 형태의 I/O가 누적되고, 일부 타이머 이벤트는 예외적으로 write를 발생시켜 Firestore 비용을 다시 올리고 있다.

## Findings

### [P1] 게임 페이지가 idle 상태에서도 최소 초당 3개의 루프에 의해 다시 갱신되고, 일부 하위 컴포넌트도 별도 1초 타이머를 가진다

**근거**
- 시계 갱신: `src/pages/Game.jsx:430-437`
- 메인 실시간 스탯 타이머: `src/pages/Game.jsx:448-809`
- 수면 상태 재계산 타이머: `src/pages/Game.jsx:1298-1313`
- 상태 배지 내부 타이머: `src/components/DigimonStatusBadges.jsx:36-45`
- StatsPopup 내부 타이머: `src/components/StatsPopup.jsx:326-335`

**왜 위험한가**
- `Game.jsx` 루트는 `customTime`, `digimonStats`, `sleepStatus`를 각각 별도 interval로 갱신한다.
- 이 세 상태는 모두 게임 화면 렌더 경로에 직접 연결되어 있어서, idle 상태에서도 페이지 전체가 지속적으로 다시 렌더될 수 있다.
- 여기에 `DigimonStatusBadges`와 `StatsPopup`까지 자체 타이머를 가지므로, 모달이 열릴수록 추가적인 초당 state update가 겹친다.

**가장 작은 완화책**
- 시간 표시용 state와 규칙 계산용 state를 분리하고, 동일한 “현재 시각” 소스를 여러 컴포넌트가 공유하도록 줄이는 것이 우선이다.
- 예상 효과는 idle 중 commit 횟수와 하위 트리 재렌더 횟수 감소다.

### [P1] `Canvas`는 routine render 때도 이미지 로딩과 animation loop를 다시 시작할 가능성이 높다

**근거**
- `Canvas` effect dependency와 재초기화: `src/components/Canvas.jsx:69-176`
- `Canvas`는 재초기화 때마다 `new Image()`를 다시 만들고, 로드 완료 후 `requestAnimationFrame` 루프를 재시작한다: `src/components/Canvas.jsx:152-176`
- `Game.jsx`는 렌더마다 `meatSprites`, `proteinSprites` 배열을 새로 만든다: `src/pages/Game.jsx:338-339`
- `Game.jsx`는 렌더 중 `idleFrames`, `eatFramesArr`, `rejectFramesArr`를 새 배열로 만든다: `src/pages/Game.jsx:1072-1100`
- 이 값들이 `GameScreen -> Canvas`로 그대로 전달된다: `src/components/GameScreen.jsx:468-503`, `src/pages/Game.jsx:1811-1855`

**왜 위험한가**
- `Canvas` effect는 배열/프롭 참조가 바뀌면 기존 `requestAnimationFrame`을 취소하고 다시 `initImages()`를 돈다.
- 그런데 `Game.jsx`가 프레임 배열과 food sprite 배열을 렌더 때마다 새로 만들고 있어, 1초마다 루트 리렌더가 일어나면 `Canvas`도 자주 초기화될 수 있다.
- 이 경로는 단순 DOM 리렌더보다 비싸다. 이미지 객체 생성, onload 핸들러, canvas clear/draw 루프 재시작이 함께 붙는다.

**가장 작은 완화책**
- 프레임 배열과 sprite 배열을 stable reference로 바꾸는 것만으로도 `Canvas` 재초기화 빈도를 크게 줄일 수 있다.
- 예상 효과는 메인 화면의 CPU 사용량과 모바일 발열 감소다.

### [P1] 액션 1회당 Firestore I/O가 `getDoc + updateDoc + addDoc(log)` 형태로 쉽게 증폭되고, 일부 타이머 이벤트도 write를 발생시킨다

**근거**
- 액션 전 lazy update에서 `getDoc`: `src/hooks/useGameData.js:308-368`
- 저장 시 슬롯 문서 `updateDoc`: `src/hooks/useGameData.js:256-292`
- 활동 로그/배틀 로그 서브컬렉션 `addDoc`: `src/hooks/useGameData.js:648-687`
- 타이머 중 로그 append와 경계 이벤트 저장: `src/pages/Game.jsx:608-798`
- 액션 중 로그 저장 + save 호출이 반복되는 패턴: `src/hooks/useGameActions.js:201-340`, `src/hooks/useGameActions.js:640-820`

**왜 위험한가**
- 예를 들어 먹이/훈련/배틀 같은 액션은 보통:
  1. `applyLazyUpdateForAction()`에서 슬롯 `getDoc`
  2. 상태 저장 시 슬롯 `updateDoc`
  3. 로그가 있으면 서브컬렉션 `addDoc`
  로 이어진다.
- 메인 타이머는 연속 스탯을 저장하지는 않지만, call 시작/timeout, poop 증가, death, deadline/care mistake 경계에서는 로그 append나 예외 save를 수행한다.
- 결과적으로 “continuous stat writes는 없다”는 목표는 지키고 있어도, 사용자 액션과 타이머 경계 이벤트를 합치면 Firestore 비용이 생각보다 빨리 커질 수 있다.

**가장 작은 완화책**
- `lastSavedAt`가 이미 메모리에서 신뢰 가능할 때 매 액션 `getDoc`를 생략할 수 있는지부터 검토하는 것이 ROI가 높다.
- 다음으로 로그 write를 반드시 실시간으로 분리 저장해야 하는지, 일부는 슬롯 저장과 함께 지연 가능한지 기준을 세우는 편이 낫다.

### [P2] `jogressStatus`만 필요하지만 슬롯 전체 문서 `onSnapshot`을 구독해서, 자기 write에도 read와 rerender가 발생한다

**근거**
- 슬롯 문서 구독: `src/pages/Game.jsx:1315-1329`
- 슬롯 문서는 `saveStats`가 광범위하게 갱신한다: `src/hooks/useGameData.js:256-292`

**왜 위험한가**
- `onSnapshot(slotRef)`는 `jogressStatus`만 보려고 달려 있지만, 같은 문서의 `digimonStats`, `updatedAt`, `backgroundSettings`, `selectedDigimon` 등 어떤 필드가 바뀌어도 listener가 다시 돈다.
- 이 프로젝트는 액션마다 슬롯 문서를 자주 갱신하므로, 조그레스 상태와 무관한 write도 listener read와 state update를 유발한다.

**가장 작은 완화책**
- 조그레스 상태를 별도 문서/경로로 분리하거나, 최소한 이 listener가 실제로 필요한 화면 구간에서만 살아 있게 줄이는 것이 좋다.

### [P2] `GameModals`, `GameScreen`, `ControlPanel`이 큰 props를 매초 새 객체로 받아서, 하위 트리 전체가 쉽게 다시 렌더된다

**근거**
- `GameScreen`과 `ControlPanel`에 큰 상태 객체 전달: `src/pages/Game.jsx:1811-1867`
- `GameModals`에 spread로 새 `gameState`, `ui`, `flags` 객체 전달: `src/pages/Game.jsx:1934-1952`
- `toggleModal`은 stable memoized callback이 아니다: `src/hooks/useGameState.js:367-372`
- 코드 검색상 `React.memo` / `memo(` 사용이 없다.

**왜 위험한가**
- 루트에서 1초마다 상태가 바뀌면, 이 하위 컴포넌트들은 거의 모두 새 객체 참조를 받는다.
- 특히 `GameModals`는 모달이 열려 있지 않아도 항상 마운트된 상태로 큰 props 묶음을 받는다.
- 이 구조에서는 “시계 1초 갱신” 같은 작은 state 변화도 큰 UI 트리 리렌더로 전파되기 쉽다.

**가장 작은 완화책**
- 현재 상태에서 가장 효과가 큰 건 큰 spread props를 줄이고, 자주 바뀌지 않는 영역을 memoization 가능한 단위로 자르는 것이다.

### [P2] 렌더 단계에서 `setCurrentAnimation()`을 직접 호출하는 경로가 있어 추가 렌더를 유발할 수 있다

**근거**
- `src/pages/Game.jsx:1087-1089`
- `src/pages/Game.jsx:1111-1113`
- `src/pages/Game.jsx:1123-1125`
- `src/pages/Game.jsx:1136-1142`

**왜 위험한가**
- 프레임 계산 분기 안에서 현재 상태를 보고 `setCurrentAnimation()`을 바로 호출하고 있다.
- 이 방식은 상태 불일치가 있는 프레임마다 추가 렌더를 만들 수 있고, 렌더 비용과 디버깅 복잡도를 함께 올린다.

**가장 작은 완화책**
- 애니메이션 상태 전환은 effect나 action handler로 옮기고, render는 계산만 하게 두는 편이 안정적이다.

### [P3] lazy update 패턴은 핵심 원칙은 유지하지만, “완전한 write 절감 구조”까지는 아니다

**근거**
- 메인 타이머는 기본적으로 메모리 state만 갱신한다고 명시: `src/pages/Game.jsx:439-442`
- 실제로는 death/zeroAt/deadline/care mistake/injury 경계에서 저장 발생: `src/pages/Game.jsx:767-798`
- 로그는 별도 `addDoc`로 계속 쌓인다: `src/hooks/useGameData.js:648-687`

**의미**
- “1초마다 Firestore write”는 잘 피하고 있다.
- 다만 이벤트성 write와 로그 write가 많아서, 운영 비용 관점에서는 lazy update의 이점이 일부 상쇄될 수 있다.

## 추가 관찰

### [P3] 진화 가능 여부를 매초 다시 계산하는 경로가 있다

**근거**
- `src/pages/Game.jsx:1262-1296`
- `customTime`이 dependency에 포함되어 있고, `customTime`은 1초마다 갱신된다: `src/pages/Game.jsx:430-437`

**의미**
- `checkEvolution()` 자체가 지금 당장 가장 무거운 계산은 아닐 수 있다.
- 하지만 현재 구조에서는 루트 1초 tick마다 진화 가능 여부를 다시 판정하고 있어, 다른 렌더 비용과 합쳐지면 불필요한 반복 계산으로 작동한다.

## Lazy Update 준수 평가

### 지켜지는 부분

- 연속적인 hunger/strength/poop/lifespan 누적은 메인 타이머에서 Firestore로 직접 쓰지 않는다.
- 슬롯 로드 시와 액션 직전/저장 직전에 lazy update를 적용하는 큰 방향은 유지되고 있다.

### 약해지는 부분

- 액션 직전 `getDoc`가 반복되어 read 비용이 높다.
- 로그와 경계 이벤트 저장이 타이머/액션 여러 곳으로 퍼져 있어 write 수가 다시 늘어난다.
- 따라서 “시간 기반 스탯 저장 최적화”는 살아 있지만, “전체 Firestore 비용 최적화”까지는 아직 닫히지 않았다.

## 권장 계측 순서

1. React Profiler로 idle 30초 동안 `Game`, `GameScreen`, `Canvas`, `GameModals` commit 횟수 측정
2. `Canvas`에 간단한 init counter를 붙여 30초 동안 `initImages()` 호출 횟수 확인
3. Firebase emulator 또는 로깅으로 액션 1회당 `getDoc/updateDoc/addDoc` 횟수 측정
4. 조그레스 listener가 자기 write에도 몇 번씩 다시 들어오는지 snapshot count 확인

## 이번 리뷰에서 확인한 것 / 런타임 확인이 필요한 것

### 코드상 확인한 것

- 루트 및 하위 컴포넌트의 다중 1초 타이머 존재
- `Canvas`의 광범위한 dependency와 `new Image()` 기반 재초기화 구조
- 액션당 `getDoc -> updateDoc -> addDoc`로 이어질 수 있는 저장 패턴
- 슬롯 전체 문서 `onSnapshot` 구독
- render-phase `setCurrentAnimation()` 호출
- `GameModals`/`GameScreen`/`ControlPanel`로의 큰 props 전달 구조

### 런타임 검증이 필요한 것

- 실제 모바일 기기에서 `Canvas` 재초기화가 프레임 드롭으로 이어지는 정도
- action 1회당 실제 Firestore read/write 수
- idle 상태에서 초당 실제 React commit 수

## 결론

이 프로젝트의 가장 큰 성능 리스크는 “복잡한 게임 로직” 그 자체보다, 매초 루트가 다시 돌고 그 결과가 큰 UI 트리와 `Canvas` 재초기화로 전파되는 구조다. Firestore 쪽도 lazy update 방향은 맞지만, 액션 read-before-write와 서브컬렉션 로그 append 때문에 비용이 다시 커질 여지가 있다.

우선순위는 다음 순서가 가장 적절하다.

1. 루트 1초 타이머와 하위 타이머를 줄여 idle 렌더 빈도부터 낮추기
2. `Canvas` prop 참조를 안정화해서 재초기화 빈도 줄이기
3. `applyLazyUpdateForAction()`의 `getDoc`와 로그 write 패턴을 계측 후 줄이기
4. 슬롯 전체 `onSnapshot`과 큰 spread props 구조를 축소하기
