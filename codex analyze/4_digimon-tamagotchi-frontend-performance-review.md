# Digimon Tamagotchi Frontend Performance Review

작성일: 2026-03-29

## 검토 범위

- lazy update 패턴 준수 여부
- 불필요한 렌더링
- 큰 컴포넌트/Hook의 과도한 상태 갱신
- Firestore write/read 비용 증가 가능성
- 중점 영역: 실시간 타이머, UI 업데이트, 상태 파생 계산, 저장 빈도

`performance-engineer` 스킬은 현재 세션에 없어 동일 기준으로 코드베이스를 직접 검토했다. 런타임 프로파일링이 아니라 정적 코드 리뷰 기준의 성능 리스크 분석이다.

## 빠른 결론

이 프로젝트는 “1초마다 Firestore에 쓰지 않는다”는 lazy update의 큰 원칙은 대체로 지키고 있다. 하지만 현재 구조는 그 대신 `Game.jsx` 루트에서 매우 넓은 리렌더링을 일으키고, 액션 저장 경로에서는 `read + write + addDoc`가 누적되며, `Canvas`와 모달 계층은 부모의 1초 단위 상태 변화에 과도하게 휘말린다.

가장 큰 리스크는 다음 네 가지다.

1. `Game.jsx` 루트에서 1초 타이머가 여러 개 돌아 전체 화면이 자주 리렌더된다.
2. `Canvas`가 안정적인 캐시를 쓰지 못하고 애니메이션/이미지를 자주 다시 초기화한다.
3. 저장 한 번에 Firestore `read + write + log addDoc`가 겹쳐 lazy update의 비용 절감 효과를 일부 상쇄한다.
4. 전체 슬롯 문서 구독과 대형 props 객체 전달 때문에 작은 상태 변화가 넓은 UI로 전파된다.

## 긍정적 관찰

- 메인 스탯 타이머는 원칙적으로 Firestore에 1초마다 쓰지 않도록 설계되어 있다.
  - `src/pages/Game.jsx:439-442`
- `backgroundSettings` 저장 함수는 `useCallback`으로 고정되어 있고, 과거의 “1초마다 background 저장” 문제를 피하려는 흔적이 있다.
  - `src/hooks/useGameData.js:620-642`
  - `src/pages/Game.jsx:357-367`
- 활동 로그와 배틀 로그를 서브컬렉션으로 빼서 슬롯 문서 자체를 과도하게 키우지 않으려는 방향은 맞다.
  - `src/hooks/useGameData.js:261-292`
  - `src/hooks/useGameData.js:648-688`

## 주요 Findings

### [P1] `Game.jsx` 루트에서 1초 타이머가 3개 돌고, 모두 큰 트리를 다시 그리게 만든다

- 현재 `Game.jsx`에는 서로 분리된 1초 interval이 최소 3개 있다.
  - 시계 업데이트: `src/pages/Game.jsx:431-437`
  - 메인 스탯/UI 타이머: `src/pages/Game.jsx:448-809`
  - 수면 상태 계산 타이머: `src/pages/Game.jsx:1299-1313`
- 이 컴포넌트는 1,978줄짜리 오케스트레이터이고, 매 렌더마다 `handlers`, `data`, `gameState`, `ui`, `flags` 같은 큰 객체를 새로 만든다.
  - `src/pages/Game.jsx:1475-1537`
  - `src/pages/Game.jsx:1934-1953`
- 그 결과 `GameScreen`, `ControlPanel`, `GameModals`가 루트 상태 변화에 반복적으로 같이 리렌더된다.
  - `src/pages/Game.jsx:1811-1855`
  - `src/pages/Game.jsx:1857-1866`
  - `src/pages/Game.jsx:1934-1953`
- 코드베이스 전반에서 `React.memo`나 유사한 메모이제이션 경계가 보이지 않는다.

왜 위험한가:

- 시계 1초 업데이트처럼 국소적인 변화가 페이지 전체 렌더 비용으로 번진다.
- 모바일, 저사양 디바이스, 광고/채팅/모달이 함께 떠 있는 상태에서 프레임 드랍 가능성이 크다.
- 타이머가 분리되어 있어 최악의 경우 초당 2~3회의 루트 렌더로 체감될 수 있다.

### [P1] `Canvas`가 거의 매 루트 리렌더마다 애니메이션과 이미지 로딩을 다시 초기화할 가능성이 크다

- `Game.jsx`는 렌더마다 `idleFrames`, `eatFramesArr`, `rejectFramesArr`를 새 배열로 생성한다.
  - `src/pages/Game.jsx:1072-1100`
- 이 배열들은 `GameScreen`을 거쳐 `Canvas`로 그대로 전달된다.
  - `src/pages/Game.jsx:1815-1819`
  - `src/components/GameScreen.jsx:469-503`
- `Canvas`는 이 배열들을 `useEffect` 의존성으로 보고, 값이 바뀌면 기존 `requestAnimationFrame`을 취소하고 `initImages()`를 다시 수행한다.
  - `src/components/Canvas.jsx:69-90`
- `initImages()`는 `spriteCache` ref가 있음에도 캐시 확인 없이 매번 `new Image()`를 생성한다.
  - `src/components/Canvas.jsx:159-176`

왜 위험한가:

- 프레임 배열 identity가 매 렌더 바뀌면 실제 애니메이션 상태가 안 바뀌어도 이미지 초기화가 다시 돈다.
- `Canvas`가 화면의 핵심 렌더링 경로인데, 여기에 이미지 생성과 RAF 재시작이 반복되면 성능 저하가 바로 체감된다.
- 캐시 구조가 있어 보이지만 현재 구현은 “보관만 하고 재사용은 거의 안 하는” 상태에 가깝다.

추가로 눈에 띄는 점:

- `Game.jsx` 렌더 경로에서 `setCurrentAnimation()`을 직접 호출하는 분기가 있다.
  - `src/pages/Game.jsx:1087-1089`
  - `src/pages/Game.jsx:1111-1113`
  - `src/pages/Game.jsx:1123-1125`
  - `src/pages/Game.jsx:1136-1142`
- 이 패턴은 조건 전환 시 추가 렌더를 유발하기 쉬워 `Canvas` 재초기화 비용과 겹치면 더 불리하다.

### [P1] lazy update 원칙은 유지되지만, 저장 경로는 여전히 Firestore 비용이 높은 편이다

- 메인 타이머는 1초 쓰기를 피하지만, 실제 저장 함수는 일반적으로 다음 흐름을 탄다.
  - `saveStats()` 진입
  - `applyLazyUpdateForAction()` 호출
  - Firestore `getDoc()`로 `lastSavedAt` 읽기
  - `applyLazyUpdate()`
  - Firestore `updateDoc()` 쓰기
  - 필요 시 `addDoc()`로 로그 추가
- 관련 코드:
  - `src/hooks/useGameData.js:144-185`
  - `src/hooks/useGameData.js:355-369`
  - `src/hooks/useGameData.js:289-292`
  - `src/hooks/useGameData.js:648-688`
- `setDigimonStatsAndSave(` 호출 지점도 최소 36개 이상 퍼져 있다.
  - `src/hooks/useGameActions.js`
  - `src/hooks/useEvolution.js`
  - `src/hooks/useGameAnimations.js`
  - `src/pages/Game.jsx`
  - `src/components/GameModals.jsx`

왜 위험한가:

- 액션당 Firestore 비용이 “쓰기 1회”로 끝나지 않고 “읽기 1회 + 쓰기 1회 + 로그 addDoc 1회 이상”이 되기 쉽다.
- lazy update가 per-second write를 줄여도, 액션이 많은 세션에서는 비용 절감 폭이 생각보다 작아질 수 있다.
- 저장 경로가 여러 Hook로 분산되어 있어 비용 추적이 어렵다.

### [P1] 타이머 기반 write 예외가 여러 군데 남아 있어 write 폭증 위험은 줄었지만 완전히 제거되지는 않았다

- 탭 숨김/이탈 시 무조건 저장 시도가 들어간다.
  - `src/pages/Game.jsx:404-428`
- 메인 타이머도 특정 경계 이벤트에서는 저장을 호출한다.
  - `src/pages/Game.jsx:788-799`
- 사망 전환 시에는 타이머 내부에서 직접 `updateDoc()`도 호출한다.
  - `src/pages/Game.jsx:767-779`

왜 위험한가:

- “UI 타이머는 절대 저장하지 않는다”는 규칙이 실질적으로는 “대부분 저장하지 않지만 예외는 여러 군데 있다”로 바뀌어 있다.
- 모바일 브라우저의 `visibilitychange`는 자주 발생할 수 있어 세션당 write 수를 끌어올릴 수 있다.
- write가 액션 경로 밖에서도 발생하면 비용과 디버깅 복잡도가 같이 올라간다.

### [P2] 전체 슬롯 문서 구독이 작은 상태 필드 하나 때문에 모든 슬롯 write에 반응한다

- `Game.jsx`는 `jogressStatus`만 필요하지만, 현재 슬롯 문서 전체를 `onSnapshot()`으로 구독한다.
  - `src/pages/Game.jsx:1315-1329`
- 반면 `saveStats()`는 액션마다 같은 슬롯 문서를 갱신한다.
  - `src/hooks/useGameData.js:263-292`

왜 위험한가:

- `jogressStatus`가 바뀌지 않아도 슬롯 문서가 갱신될 때마다 snapshot 콜백이 깨어난다.
- snapshot 데이터에서 새 객체를 받아 `setSlotJogressStatus()`를 호출하므로 불필요한 리렌더가 섞일 가능성이 크다.
- 저장 빈도가 많아질수록 구독 기반 리렌더도 같이 늘어난다.

### [P2] 슬롯 로드 시 lazy update가 재구성한 로그를 즉시 서브컬렉션에 다시 쓰기 때문에 장기 미접속 복귀에서 burst write가 생길 수 있다

- 슬롯 로드 후 `applyLazyUpdate()`를 수행하고, 그 과정에서 새로 생긴 로그를 `forEach + addDoc()`로 다시 저장한다.
  - `src/hooks/useGameData.js:553-559`

왜 위험한가:

- 유저가 오래 비웠다가 돌아오면 접속 직후 write가 몰릴 수 있다.
- lazy update 자체는 비용 절감용인데, 복귀 시점에 로그 backfill이 한번에 쏠리면 비용이 스파이크처럼 튈 수 있다.
- 로그가 많을수록 첫 진입 체감 속도도 악화될 수 있다.

### [P2] 한 액션에서 로컬 상태 갱신과 저장이 중복으로 호출되는 패턴이 많아 렌더링 비용이 커진다

- 예를 들어 `handleFeed()`는 액션 시작 시 `setDigimonStats(updatedStats)`를 먼저 호출하고,
  이후 분기에서 다시 `setDigimonStats()`와 `setDigimonStatsAndSave()`를 함께 사용한다.
  - `src/hooks/useGameActions.js:201-255`
  - `src/hooks/useGameActions.js:227-240`
- 비슷한 패턴이 `useGameActions.js` 전반에 반복된다.
  - `src/hooks/useGameActions.js:284-300`
  - `src/hooks/useGameActions.js:389-395`
  - `src/hooks/useGameActions.js:644-648`
  - `src/hooks/useGameActions.js:887-891`

왜 위험한가:

- 한 번의 유저 액션이 “로컬 상태 반영”과 “save 내부 상태 반영”으로 두 번 이상 렌더를 만들 수 있다.
- 액션 체감은 빠를 수 있어도, 전체 프레임 안정성과 상호작용 지연에는 불리하다.

### [P2] 모달 계층도 1초 단위 루트 렌더의 영향을 그대로 받고 있다

- `GameModals`는 큰 `gameState`, `handlers`, `data`, `ui`, `flags` 묶음을 통째로 받는다.
  - `src/pages/Game.jsx:1934-1953`
- `GameModals` 자체는 많은 모달 컴포넌트를 관리하는 허브인데 memoization 경계가 없다.
  - `src/components/GameModals.jsx:58-205`

왜 위험한가:

- 모달이 닫혀 있어도 부모가 1초마다 리렌더되면 이 계층도 매번 다시 평가된다.
- 상태 파생 계산이 모달 바깥 UI와 묶여 있어 “필요할 때만 열고 계산한다”는 구조가 약하다.

### [P3] 파생 계산이 루트에 집중돼 있어 계산량 자체보다 계산 전파 범위가 넓다

- 수면 스케줄/수면 상태 계산이 타이머, 렌더, 모달 props에서 반복된다.
  - `src/pages/Game.jsx:486-503`
  - `src/pages/Game.jsx:682-684`
  - `src/pages/Game.jsx:1798`
  - `src/pages/Game.jsx:1947`
- 진화 가능 여부도 effect에서 주기적으로 다시 계산된다.
  - `src/pages/Game.jsx:1286-1296`
- `customTime`이 루트 상태로 있어 시계 표시용 갱신이 진화 체크, 배경 계산, 모달 props 전파와 얽힌다.
  - `src/hooks/useGameState.js:303-309`
  - `src/pages/Game.jsx:1768-1777`

왜 위험한가:

- 개별 계산이 아주 무겁지 않아도, 루트에서 반복되면 누적 비용이 커진다.
- 비용보다 더 큰 문제는 “작은 계산 변화가 큰 렌더 트리로 전파되는 구조”다.

## Lazy Update 준수 평가

전체 평가는 “부분적으로 잘 지켜지고 있지만, 저장 경로와 예외 write가 비용을 다시 키우는 구조”에 가깝다.

잘 지켜지는 부분:

- 메인 타이머에서 일반적인 1초 write를 하지 않는다.
- 슬롯 로드 시 Firestore 문서를 매초 갱신하지 않는다.

주의가 필요한 부분:

- `saveStats()`마다 `getDoc()`가 들어간다.
- 로그 append가 액션/타이머/load 경로에 넓게 퍼져 있다.
- 탭 이탈, 사망, call/deadline 경계에서 타이머 기반 write가 존재한다.

## 테스트/관측 공백

- 현재 테스트 파일은 사실상 `src/App.test.js`만 있다.
- 성능 회귀를 잡을 수 있는 단위 테스트나 프로파일링 가드가 없다.

특히 필요한 검증:

- `Game` 루트의 초당 렌더 횟수 측정
- `Canvas` 재초기화 횟수 측정
- 액션 1회당 Firestore `getDoc/updateDoc/addDoc` 호출 수 측정
- 장기 미접속 후 첫 진입 시 backfill write 수 측정
- `visibilitychange`가 잦은 모바일 환경에서 세션당 write 수 측정

## 우선순위 요약

1. `Game.jsx`의 루트 1초 타이머와 전역 리렌더 전파 구조
2. `Canvas`의 재초기화/이미지 재생성 패턴
3. `saveStats -> getDoc -> updateDoc -> addDoc` 경로의 Firestore 비용
4. 슬롯 전체 구독과 분산된 타이머 write 예외
5. 대형 props 객체와 비메모이즈드 모달/화면 계층
