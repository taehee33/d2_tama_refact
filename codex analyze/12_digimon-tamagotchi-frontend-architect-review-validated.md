# Digimon Tamagotchi Frontend 아키텍처 리뷰

작성일: 2026-03-29  
검토 기준: 전역 subagent 정의 `architect-reviewer.toml`의 리뷰 관점(경계 명확성, 결합도, 데이터 소유권, 장기 유지보수 리스크)

## 분석 범위

- 대상 프로젝트: `digimon-tamagotchi-frontend`
- 중점 파일:
  - `src/pages/Game.jsx`
  - `src/hooks/useGameState.js`
  - `src/hooks/useGameData.js`
  - `src/hooks/useGameActions.js`
  - `src/hooks/useGameLogic.js`
  - `src/hooks/useGameHandlers.js`
  - `src/hooks/useGameAnimations.js`
  - `src/hooks/useEvolution.js`
  - `src/hooks/useDeath.js`
  - `src/hooks/useArenaLogic.js`
  - `src/logic/*`
  - `src/repositories/*`
  - `src/contexts/AuthContext.jsx`
  - `src/pages/SelectScreen.jsx`

## 검증한 경로

### 정상 경로

`App.jsx -> SelectScreen.jsx -> Game.jsx -> useGameState -> useGameData -> 도메인 Hook들 -> GameScreen/ControlPanel/GameModals`

- `src/pages/Game.jsx:114-336`에서 상태, 저장, 도메인 Hook 조립이 한 페이지 안에서 수행된다.
- `src/hooks/useGameData.js:432-617`에서 슬롯 로드, 로그 로드, lazy update, hydrate가 한 번에 실행된다.

### 실패 경로

Firebase 또는 로그인 부재 시 localStorage 오프라인 모드로 자연스럽게 내려가는 구조가 아니라, 실제 페이지 흐름은 `/`로 리다이렉트된다.

- `src/contexts/AuthContext.jsx:81-85`는 Firebase 미설정 시 localStorage 모드를 암시한다.
- 하지만 `src/pages/SelectScreen.jsx:64-69`, `src/pages/Game.jsx:143-148`, `src/hooks/useGameData.js:435-440`은 모두 Firebase/로그인 없으면 진행을 멈춘다.

### 통합 경계 경로

온라인 조그레스, 아레나, 조명 토글, 사망 처리처럼 핵심 상태 변경 중 일부는 `useGameData`를 우회해 각 Hook 또는 `Game.jsx`에서 Firestore를 직접 갱신한다.

- `src/pages/Game.jsx:773-779`, `src/pages/Game.jsx:1048-1067`
- `src/hooks/useGameHandlers.js:273-326`
- `src/hooks/useGameActions.js:695-800`
- `src/hooks/useEvolution.js:308-558`
- `src/hooks/useArenaLogic.js:55-69`

## 우선순위 높은 구조 문제

### [P1] 실제 런타임 계약과 문서화된 저장소 아키텍처가 다르다

#### 확인된 증거

- `src/contexts/AuthContext.jsx:81-85`는 Firebase 미설정 시 localStorage 모드가 가능한 것처럼 동작한다.
- `src/pages/SelectScreen.jsx:64-69`와 `src/pages/Game.jsx:143-148`는 Firebase/로그인 없으면 즉시 `/`로 보낸다.
- `src/hooks/useGameData.js:256-301`, `src/hooks/useGameData.js:349-381`, `src/hooks/useGameData.js:432-617`는 실제 저장/로드가 Firestore 전제임을 보여준다.
- `src/repositories/README.md:5-85`는 여전히 `localStorage -> Firestore 전환 가능한 repository 패턴`을 공식 구조처럼 설명한다.
- `src/repositories/SlotRepository.js:5-10`은 반대로 "localStorage 모드 제거", "실제 코드는 useGameData에서 직접 Firebase 사용"이라고 적고 있다.

#### 유지보수 리스크

- 신규 기능 추가 시 개발자가 잘못된 전제를 잡기 쉽다.
- "이중 저장소 지원"을 믿고 수정하면 실제 런타임 실패 경로를 놓치게 된다.
- 문서, 코드, 남아 있는 repository 구현이 서로 다른 계약을 말하고 있어 회귀 위험이 커진다.

#### 최소 권고

- 공식 계약을 하나로 고정해야 한다.
- 선택지는 둘 중 하나다.
  - Firebase-only를 공식 구조로 선언하고 stale 문서/코드를 정리한다.
  - 정말 dual-storage를 유지할 거면 진입 경로부터 repository 경계까지 실제로 복구한다.

### [P1] `Game.jsx`가 페이지를 넘어 애플리케이션 서비스 레이어 역할을 하고 있다

#### 확인된 증거

- 파일 크기 자체가 `1978`줄이다.
- `src/pages/Game.jsx:114-336`에서 상태, UI, 영속성 Hook를 모두 조립한다.
- `src/pages/Game.jsx:430-809`에서 실시간 타이머, 수면 판정, 케어미스, 호출, 사망, 로그, 저장 타이밍까지 처리한다.
- `src/pages/Game.jsx:811-1046`에서 거의 모든 도메인 Hook에 setter, modal adapter, persistence 함수를 직접 주입한다.
- `src/pages/Game.jsx:1048-1067`에서 `selectedDigimon` 저장을 별도 Firestore write로 직접 수행한다.
- `src/pages/Game.jsx:1262-1368`에서 진화 버튼 판정, 수면 상태 타이머, 조그레스용 snapshot subscription까지 직접 가진다.

#### 유지보수 리스크

- 기능 하나를 바꿀 때 `Game.jsx`와 여러 Hook를 동시에 건드리게 된다.
- page 수준 회귀가 비즈니스 로직 회귀와 직결된다.
- 테스트 가능한 경계가 약해지고, 작은 수정도 넓은 영역의 사이드이펙트로 퍼질 수 있다.

#### 최소 권고

- `Game.jsx`는 장기적으로 "페이지 + 조립"까지만 남아야 한다.
- 지금 당장은 전면 분해보다 먼저 다음 조합 책임을 분리하는 편이 안전하다.
  - 타이머/구독 오케스트레이션
  - modal adapter 묶음
  - persistence adapter 묶음

### [P1] Hook 분리는 되었지만 책임 분리는 아직 불완전하다

#### 확인된 증거

- `useGameData`는 persistence Hook인데 `useGameLogic`, `useGameHandlers` 유틸에 의존한다.
  - `src/hooks/useGameData.js:7-10`
- `useGameData`는 저장/로드뿐 아니라 사망 팝업까지 직접 건드린다.
  - `src/hooks/useGameData.js:388-426`
- `useGameHandlers`는 UI 메뉴 처리 Hook처럼 보이지만 Firestore 직접 쓰기까지 수행한다.
  - `src/hooks/useGameHandlers.js:273-326`
- `useEvolution`은 순수 진화 판정 외에 애니메이션 단계, encyclopedia 갱신, batch write, jogress room 관리까지 묶는다.
  - `src/hooks/useEvolution.js:51-178`
  - `src/hooks/useEvolution.js:308-558`
- `useGameAnimations`는 애니메이션 Hook처럼 보이지만 실제로 먹이/청소/치료의 도메인 로직과 저장을 수행한다.
  - `src/hooks/useGameAnimations.js:4-7`
  - `src/hooks/useGameAnimations.js:60-154`
  - `src/hooks/useGameAnimations.js:171-260`
- `useArenaLogic`는 아레나 설정과 모달 오픈만 다루고, 실제 아레나 결과 기록은 `useGameActions`에 있다.
  - `src/hooks/useArenaLogic.js:55-69`
  - `src/hooks/useGameActions.js:695-800`

#### 유지보수 리스크

- Hook 이름만 보고 책임을 추정하면 오판하기 쉽다.
- 한 Hook 변경이 UI, 저장, 게임 규칙을 동시에 깨뜨릴 수 있다.
- 모듈 경계가 모호해져 리팩터링 난도가 계속 올라간다.

#### 최소 권고

- Hook를 다시 쪼개기 전에 먼저 "책임표"를 고정하는 것이 맞다.
- 최소 기준은 다음이다.
  - state owner
  - persistence owner
  - pure domain owner
  - UI adapter owner

### [P1] 저장 경계가 중앙집중형처럼 보이지만 실제로는 분산되어 있다

#### 확인된 증거

- 중심 저장 경계는 `useGameData.saveStats()`처럼 보인다.
  - `src/hooks/useGameData.js:144-302`
- 하지만 `Game.jsx`가 사망 시 직접 `updateDoc`를 호출한다.
  - `src/pages/Game.jsx:767-779`
- `Game.jsx`는 `selectedDigimon` 변경도 별도 `updateDoc`로 저장한다.
  - `src/pages/Game.jsx:1048-1067`
- `useGameHandlers`는 조명 토글 후 다시 Firestore를 직접 갱신한다.
  - `src/hooks/useGameHandlers.js:313-326`
- `useGameActions`는 아레나 엔트리/배틀 로그를 직접 갱신한다.
  - `src/hooks/useGameActions.js:695-800`
- `useEvolution`은 조그레스와 조그레스 방 상태를 자체 batch/addDoc/updateDoc으로 관리한다.
  - `src/hooks/useEvolution.js:308-558`

#### 유지보수 리스크

- 저장 시점과 저장 형식이 분산되면 데이터 정합성 버그가 생기기 쉽다.
- 같은 상태 변경이 어떤 경로에서는 `saveStats`를 타고, 어떤 경로에서는 raw Firestore write를 타게 된다.
- 저장 정책 변경 시 수정 지점이 여러 군데라 운영 리스크가 커진다.

#### 최소 권고

- "슬롯 문서 변경", "부가 컬렉션 변경", "외부 게임 시스템 변경(arena/jogress)"를 최소 3개 경계로 문서화해야 한다.
- 이후 리팩터링은 이 경계를 기준으로만 이동하는 편이 안전하다.

## 중간 우선순위 구조 문제

### [P2] `logic` 계층과 `hooks` 계층의 경계가 일관되지 않다

#### 확인된 증거

- 순수 로직 전용 디렉토리 `src/logic/`가 이미 존재한다.
  - 예: `src/logic/evolution/checker.js:19-304`
  - 예: `src/logic/battle/hitrate.js:12-151`
  - 예: `src/logic/stats/stats.js:48-583`
- 그런데 순수 함수 성격의 수면/콜/로그 유틸이 `src/hooks/useGameLogic.js`에 남아 있다.
  - `src/hooks/useGameLogic.js:32-109`
  - `src/hooks/useGameLogic.js:379-647`
- `useGameHandlers`는 순수 계산인 `getSleepSchedule`, `isWithinSleepSchedule`를 export한다.
  - `src/hooks/useGameHandlers.js:15-46`
- `useGameData`는 lazy update 기준 계산을 위해 `hooks` 계층 함수를 역으로 가져온다.
  - `src/hooks/useGameData.js:7-10`

#### 유지보수 리스크

- 순수 도메인 규칙 테스트를 어디에 걸어야 할지 경계가 흐려진다.
- UI Hook가 사실상 도메인 규칙의 canonical source처럼 굳어질 수 있다.
- TypeScript나 서비스 계층 도입 시 마이그레이션 비용이 올라간다.

#### 최소 권고

- 바로 파일 이동을 하기보다 먼저 "순수 규칙 함수 목록"을 정리하는 것이 좋다.
- 그 목록을 기준으로 `hooks`에는 React 의존 코드만 남도록 점진적으로 이동시키는 편이 안전하다.

### [P2] 시간 기반 규칙 엔진이 여러 위치에 분산되어 있다

#### 확인된 증거

- `useGameData`는 `../data/stats`의 `applyLazyUpdate`를 사용한다.
  - `src/hooks/useGameData.js:7`
- 하지만 `logic/stats/stats.js`에도 별도의 `applyLazyUpdate`, `initializeStats`, `updateLifespan`이 존재한다.
  - `src/logic/stats/stats.js:48-583`
- `Game.jsx` 타이머는 또 별도로 `updateLifespan`, `handleHungerTick`, `handleStrengthTick`, `handleEnergyRecovery`를 조합해 실시간 상태를 만든다.
  - `src/pages/Game.jsx:505-518`

#### 유지보수 리스크

- 시간 규칙 수정 시 한 군데만 바꾸면 behavior drift가 난다.
- online/offline, load/action/timer 경로에서 서로 다른 규칙이 적용될 수 있다.

#### 최소 권고

- canonical source를 하나로 정하기 전까지는 "같은 규칙의 구현 위치"를 문서화해야 한다.
- 테스트 우선순위도 시간 엔진에 가장 먼저 배치하는 것이 맞다.

### [P2] repository 패턴은 존재하지만 실제로는 죽은 추상화에 가깝다

#### 확인된 증거

- `src/repositories/SlotRepository.js:5-10`은 실사용되지 않는다고 명시한다.
- `src/repositories/SlotRepository.js:35-103`은 루트 `slots/slot{n}` 구조를 가정한다.
- 반면 실제 런타임은 `users/{uid}/slots/{slotId}`를 사용한다.
  - `src/hooks/useGameData.js:259`
  - `src/pages/SelectScreen.jsx:110`
- `src/repositories/UserSlotRepository.js:22-223`는 현 구조와 맞는 repository를 갖고 있지만, 코드 검색상 실제 런타임 import는 없다.
- `src/repositories/README.md:5-109`는 여전히 repository가 현재 사용 중인 것처럼 설명한다.

#### 유지보수 리스크

- 추상화가 있다고 믿고 작업했다가 실제 저장 경로 차이로 장애를 만들 수 있다.
- dead abstraction이 남아 있으면 설계 의도가 아니라 설계 잔재를 따라가게 된다.

#### 최소 권고

- repository를 공식 경계로 살릴지, 아니면 문서/코드에서 완전히 보조 자료로 격하시킬지 결정해야 한다.

## 현재 구조의 강점

- 게임 규칙의 일부 핵심은 이미 순수 함수로 분리되어 있다.
  - 진화: `src/logic/evolution/checker.js`
  - 배틀: `src/logic/battle/*`
  - 스탯 tick: `src/logic/stats/*`
- `useGameState`가 상태 초기화와 modal object 패턴을 한곳에서 소유하고 있는 점 자체는 나쁘지 않다.
  - `src/hooks/useGameState.js`
- `useGameData`가 load/action/save에서 lazy update를 방어적으로 적용하고 있는 점은 비용 관점에서 일관된 방향이다.
  - `src/hooks/useGameData.js:179-185`
  - `src/hooks/useGameData.js:308-381`
  - `src/hooks/useGameData.js:553-559`

## 가장 작은 구조적 완화책 순서

1. 저장소 계약을 문서와 코드에서 하나로 맞춘다.
   - Firebase-only인지 dual-storage인지 먼저 고정
2. `Game.jsx`의 책임을 문서 수준에서 먼저 분류한다.
   - 타이머
   - 구독
   - persistence adapter
   - modal adapter
3. Hook별 책임표를 만든다.
   - 각 Hook가 UI, 규칙, 저장 중 무엇을 소유하는지 명시
4. 시간 기반 규칙의 canonical source를 결정한다.
   - `data/stats`와 `logic/stats` 중 기준 하나 명시
5. repository 패턴을 살릴지 폐기할지 결정한다.

## 런타임 검증이 더 필요한 부분

- 실제 브라우저에서 Firebase 미설정 시 localStorage 경로가 어디까지 살아 있는지
- 온라인 조그레스와 아레나 write 경로가 저장 경합 없이 동작하는지
- `saveStats`와 direct Firestore write가 같은 틱에서 충돌하지 않는지

## 최종 판단

현재 구조는 "Hook로 쪼개진 대형 페이지"이지, 아직 "경계가 명확한 아키텍처"까지는 아니다.

가장 큰 장기 리스크는 다음 두 가지다.

1. 저장소 계약이 문서/코드/남아 있는 추상화 사이에서 서로 다르게 설명되고 있다.
2. `Game.jsx`와 주요 Hook들이 UI, 규칙, 저장을 동시에 소유하면서 변경 비용을 계속 증폭시키고 있다.

따라서 다음 리팩터링의 출발점은 기능 분해보다 계약 정리여야 한다. 계약이 정리되지 않은 상태에서 Hook나 파일만 더 나누면, 구조는 더 많아져도 유지보수성은 좋아지지 않을 가능성이 높다.
