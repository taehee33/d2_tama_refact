# Game.jsx 분리 전 리스크·가능사항 분석 메모

- 작성일: 2026-04-09
- 작성 목적: `Game.jsx` 후속 분리 라운드를 구현하기 전에, 각 단계가 현재 구조에서 얼마나 안전하게 분리 가능한지 판정하기 위한 실행 전 메모
- 분석 기준 파일:
  - `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
  - `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
  - `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- 이번 문서의 범위:
  - 리스크 분석
  - 분리 가능 여부 판정
  - 선행 조건과 회귀 포인트 정리
  - characterization test 후보 정리
- 이번 문서의 비범위:
  - 실제 코드 리팩터링
  - 저장 계약 변경
  - lazy update 규칙 변경
  - Firestore 경로 변경
  - 모달 key 이름 변경

---

## 0. 목적과 가드레일

이번 라운드의 목적은 구현이 아니라 `Game.jsx` 분리 순서를 실제로 진행해도 되는지 사전에 판정하는 것이다. 따라서 분석 단계에서는 현재 컴포넌트 공개 prop shape와 Hook 반환 shape를 유지하는 것을 기본 가정으로 둔다.

이번 분석에서 지켜야 할 가드레일은 아래와 같다.

- `useGameData`가 사용 중인 저장 계약과 Firestore 문서 경로는 바꾸지 않는다.
- lazy update 규칙과 `applyLazyUpdate()` 호출 타이밍은 바꾸지 않는다.
- `toggleModal(name, isOpen)`의 key 이름은 바꾸지 않는다.
- `GameScreen`, `ControlPanel`, `GameModals`의 공개 prop 이름은 유지한다.
- 새 인터페이스 제안은 `GamePageView props`, `ImmersiveGameView props`, `useImmersiveGameLayout return shape` 초안까지만 허용한다.
- 실제 구현은 각 단계의 선행 테스트가 확보된 뒤에만 진행한다.

## 1. 현재 기준선

### 1-1. 파일 크기 기준선

| 파일 | 현재 줄 수 | 관찰 포인트 |
| --- | ---: | --- |
| `digimon-tamagotchi-frontend/src/pages/Game.jsx` | 1997 | 페이지 조립, 몰입형 상태, 잔여 액션, 모달 바인딩, 최종 렌더 분기까지 모두 포함 |
| `digimon-tamagotchi-frontend/src/hooks/useGameActions.js` | 1155 | 액션 계층이 크고 페이지 잔여 핸들러와 경계가 일부 겹침 |
| `digimon-tamagotchi-frontend/src/hooks/useEvolution.js` | 1033 | 일반 진화와 온라인 조그레스, Firestore write, 로그/도감 갱신이 한 훅에 공존 |
| `digimon-tamagotchi-frontend/src/hooks/useGameData.js` | 984 | 로드, save, lazy update, death popup, UI setter가 섞여 있음 |
| `digimon-tamagotchi-frontend/src/components/GameModals.jsx` | 966 | 이미 큰 컴포넌트이므로 페이지에서 props 누락 시 회귀 폭이 큼 |
| `digimon-tamagotchi-frontend/src/components/layout/ImmersiveGameTopBar.jsx` | 160 | 자체는 작지만 `Game.jsx`와 상태 결합도가 높음 |

### 1-2. 현재 `Game.jsx`에 남아 있는 주요 책임

현재 `Game.jsx`는 1차 리팩터링 이후에도 아래 책임을 직접 들고 있다.

- `pageViewModel`과 `sharedGameScreenProps` 조립
- `immersiveSettings` 정규화와 몰입형 레이아웃 파생 상태 계산
- 방향 잠금 가능 여부, 전체화면 진입/이탈, 스킨 선택, 채팅 토글 처리
- 과식 확인/취소, `resetDigimon`, 진화 버튼 활성화 effect 같은 페이지 잔여 액션
- `modalBindings` 대형 memo 조립
- 모바일 헤더, 기본 화면, 몰입형 세로/가로 뷰, `GameModals`까지 포함하는 최종 렌더 분기

즉, 현재 상태는 “페이지가 얇아진 상태”보다는 “일부 조립과 effect를 뺀 뒤에도 렌더와 상위 오케스트레이션이 다시 커진 상태”에 가깝다.

### 1-3. 현재 테스트 안전망

분리 작업 전에 이미 존재하는 관련 테스트는 아래와 같다.

- 렌더/컴포넌트 계층
  - `digimon-tamagotchi-frontend/src/components/GameScreen.test.jsx`
  - `digimon-tamagotchi-frontend/src/components/ControlPanel.test.jsx`
  - `digimon-tamagotchi-frontend/src/components/GameModals.test.jsx`
  - `digimon-tamagotchi-frontend/src/components/layout/ImmersiveGameTopBar.test.jsx`
  - `digimon-tamagotchi-frontend/src/components/layout/ImmersiveDeviceShell.test.jsx`
  - `digimon-tamagotchi-frontend/src/components/layout/ImmersiveLandscapeControls.test.jsx`
  - `digimon-tamagotchi-frontend/src/components/layout/ImmersiveSkinPicker.test.jsx`
  - `digimon-tamagotchi-frontend/src/components/layout/ImmersiveLandscapeFrameStage.test.jsx`
  - `digimon-tamagotchi-frontend/src/components/chat/PlayChatDrawer.test.jsx`
  - `digimon-tamagotchi-frontend/src/components/chat/ImmersiveChatOverlay.test.jsx`
- Hook/helper 계층
  - `digimon-tamagotchi-frontend/src/hooks/useGameData.test.js`
  - `digimon-tamagotchi-frontend/src/hooks/useEvolution.test.js`
  - `digimon-tamagotchi-frontend/src/hooks/useGameActions.test.js`
  - `digimon-tamagotchi-frontend/src/hooks/game-runtime/buildGamePageViewModel.test.js`
  - `digimon-tamagotchi-frontend/src/hooks/game-runtime/buildGameModalBindings.test.js`

현재 안전망은 “기초가 아예 없는 상태”는 아니지만, 페이지 잔여 액션과 온라인 조그레스 흐름에 대한 characterization test는 아직 부족하다.

## 2. 라운드별 요약 판정

| 단계 | 대상 | 현재 판정 | 근거 | 구현 시작 조건 |
| --- | --- | --- | --- | --- |
| 1 | `GamePageView` / `ImmersiveGameView` 분리 | `분리 가능` | JSX 이동 중심이며 저장 계약을 건드리지 않음 | 기존 렌더 테스트 고정 + 모바일 헤더 분기 test 보강 |
| 2 | `useImmersiveGameLayout` 분리 | `분리 가능` | 대부분 화면 상태와 파생값이며 도메인 규칙과 직접 결합되지 않음 | 몰입형 orientation/skin/chat 동작 test 보강 |
| 3 | 페이지 잔여 액션 분리 | `선행 테스트 필요` | `resetDigimon`과 과식 흐름이 저장, 로그, UI를 동시에 건드림 | 액션 흐름 characterization test 먼저 확보 |
| 4 | `useEvolution` 온라인 조그레스 분리 | `선행 테스트 필요` | room 상태 전이, Firestore write, archive/log/encyclopedia 연쇄 호출 위험이 큼 | host/guest 시나리오 테스트 확보 |
| 5 | `useGameData` 경계 축소 | `지금은 보류` | load/hydration/save/UI side effect가 강하게 얽혀 있어 먼저 건드리기 위험 | 상위 단계 정리 후 회귀 기준 확보 |

## 3. 1단계 분석: presenter 분리 가능성

### 3-1. 분리 대상 블록

현재 `Game.jsx`에서 presenter로 분리 가능한 블록은 아래와 같다.

- 모바일 헤더
- 기본 화면 상단 헤더
- 기본 화면의 `GameScreen` + 액션/보조 버튼 묶음
- 몰입형 상단 바
- 몰입형 세로 레이아웃
- 몰입형 가로 레이아웃
- `GameModals` 렌더 지점

이 단계는 “상태와 로직을 다른 곳으로 옮긴다”기보다 “이미 계산된 값과 핸들러를 presenter에 전달해 JSX만 이동한다”는 관점으로 접근하는 것이 안전하다.

### 3-2. 블록별 입력 prop 목록 초안

| 블록 | 필요한 입력 |
| --- | --- |
| 모바일 헤더 | `isMobile`, `showProfileMenu`, `setShowProfileMenu`, 계정 메뉴 액션, 헤더 표시용 현재 슬롯/디지몬 정보 |
| 기본 화면 헤더 | 슬롯 이름, 버전, 닉네임, 상태 배지, 계정 액션 |
| 기본 화면 본문 | `sharedGameScreenProps`, `supportActionButtons`, 보조 패널/액션 관련 플래그 |
| 몰입형 상단 바 | layout mode, orientation 상태, chat open 상태, skin picker open 상태, 관련 핸들러 |
| 몰입형 세로/가로 뷰 | `sharedGameScreenProps`, `immersiveSkin`, `effectiveLandscapeSide`, 채팅/스킨 picker 제어 props |
| 모달 렌더 | `modalBindings` 전체 |

### 3-3. 제안 인터페이스 초안

```jsx
function GamePageView({
  isMobile,
  isImmersive,
  mobileHeaderProps,
  defaultHeaderProps,
  defaultGameProps,
  immersiveGameProps,
  modalBindings,
})
```

```jsx
function ImmersiveGameView({
  topBarProps,
  portraitViewProps,
  landscapeViewProps,
  orientationStatusMessage,
  orientationStatusTone,
  isLandscapeImmersive,
  shouldShowRotateHint,
})
```

이 초안의 핵심은 presenter가 저장이나 상태 변이를 직접 알지 못하고, 이미 계산된 props만 받아 렌더 책임만 갖도록 제한하는 것이다.

### 3-4. 리스크

- 조건 렌더 순서가 바뀌면서 모바일/몰입형 분기 결과가 달라질 수 있다.
- `toggleModal`이나 계정 메뉴 액션이 presenter 전달 과정에서 빠질 수 있다.
- 모바일 헤더와 `GameModals`가 바라보는 현재 상태 표시가 어긋날 수 있다.
- 같은 `sharedGameScreenProps`를 기본/몰입형 두 경로에서 쓰는 구조라 props 이름이 조금만 틀어져도 회귀 범위가 넓다.

### 3-5. 변경 허용 범위

이 단계에서 허용할 변경은 아래까지다.

- JSX 블록 이동
- presenter 컴포넌트 추가
- render helper 정리
- `Game.jsx` 내부에서 계산된 props를 presenter에 전달하는 조립 코드 추가

이 단계에서 하지 말아야 할 변경은 아래와 같다.

- `GameScreen`, `ControlPanel`, `GameModals` 공개 prop 계약 변경
- `toggleModal` 체계 변경
- 페이지 state 추가
- 액션 로직 재작성

### 3-6. 선행 조건

- `GameScreen`, `GameModals`, 몰입형 layout 관련 테스트를 먼저 녹색 상태로 고정한다.
- 모바일 헤더와 프로필 메뉴 분기에 대한 characterization test를 추가한다.
- presenter 분리 전후 DOM 구조 차이를 최소화한다.

### 3-7. 회귀 포인트

- 모바일 헤더의 계정 메뉴 열기/닫기
- 기본 화면과 몰입형 화면 전환
- `GameModals`에 전달되는 이벤트 핸들러 누락 여부
- 몰입형 top bar의 채팅/스킨 picker 버튼 상태 표시

### 3-8. 판정

`분리 가능`

presenter 분리는 현재 순서에서 가장 먼저 진행해도 되는 작업이다. 저장 경계나 lazy update를 건드리지 않고 `Game.jsx`를 눈에 띄게 얇게 만들 수 있으며, 리스크는 대부분 렌더 누락과 props 누락으로 수렴한다.

## 4. 2단계 분석: `useImmersiveGameLayout` 분리 가능성

### 4-1. 현재 몰입형 상태 의존성 표

| 상태 또는 파생값 | 현재 출처 | 의존성 | 저장과의 관계 | 권장 이동 위치 |
| --- | --- | --- | --- | --- |
| `immersiveSettings` | 슬롯/페이지 상태 | 슬롯 저장값 | 저장 대상 자체 | 상위에서 주입 유지 |
| `normalizedImmersiveSettings` | `Game.jsx` | `immersiveSettings` | 없음 | 전용 훅 내부 |
| `immersiveLayoutMode` | `Game.jsx` | normalized settings | `saveImmersiveSettings`와 간접 연결 | 전용 훅 내부 |
| `immersiveSkinId` / `immersiveSkin` | `Game.jsx` | normalized settings | skin 설정 저장과 간접 연결 | 전용 훅 내부 |
| `landscapeSidePreference` | `Game.jsx` | normalized settings | landscape side 저장과 간접 연결 | 전용 훅 내부 |
| `effectiveLandscapeSide` | `Game.jsx` | side preference + viewport 감지 | 없음 | 전용 훅 내부 |
| `isMobile` / `isViewportPortrait` | 로컬 state | viewport 이벤트 | 없음 | 전용 훅 내부 |
| `detectedLandscapeSide` | 로컬 state | orientation/viewport 감지 | 없음 | 전용 훅 내부 |
| `showSkinPicker` | 로컬 state | immersive on/off | 없음 | 전용 훅 내부 |
| `isChatOpen` | Presence context | top bar, overlay | 없음 | 주입받아 훅 내부에서 조합 |
| `isImmersiveFullscreen` | 로컬 state | fullscreen/orientation API | 없음 | 전용 훅 내부 |
| `orientationLockSupported` | 로컬 state | 브라우저 capability | 없음 | 전용 훅 내부 |
| `orientationLockError` | 로컬 state | lock 시도 결과 | 없음 | 전용 훅 내부 |
| `immersiveExperienceRef` | ref | fullscreen 대상 엘리먼트 | 없음 | 전용 훅 내부 |

### 4-2. 제안 return shape 초안

```jsx
const immersiveLayout = useImmersiveGameLayout({
  isImmersive,
  immersiveSettings,
  setImmersiveSettings,
  isChatOpen,
  setIsChatOpen,
});
```

```jsx
{
  immersiveExperienceRef,
  isMobile,
  isViewportPortrait,
  detectedLandscapeSide,
  showSkinPicker,
  setShowSkinPicker,
  isImmersiveFullscreen,
  orientationLockSupported,
  orientationLockError,
  immersiveLayoutMode,
  immersiveSkinId,
  immersiveSkin,
  landscapeSidePreference,
  effectiveLandscapeSide,
  isLandscapeImmersive,
  shouldShowRotateHint,
  orientationStatusMessage,
  orientationStatusTone,
  handleLayoutModeChange,
  handleCycleLandscapeSide,
  handleToggleImmersiveChat,
  handleCloseImmersiveChat,
  handleSkinSelect,
}
```

핵심 포인트는 `saveImmersiveSettings` 자체를 이 훅으로 옮기는 것이 아니라, 현재 페이지에 흩어진 “정규화, 파생값, UI 핸들러”를 한 묶음으로 만드는 것이다.

### 4-3. 리스크

- viewport 감지와 orientation 지원 감지 effect의 실행 타이밍이 달라질 수 있다.
- `isImmersive`가 꺼질 때 `showSkinPicker`를 닫는 cleanup 순서가 달라질 수 있다.
- top bar와 shell이 서로 다른 파생값을 보게 되면 상태 표시가 어긋날 수 있다.
- 훅 안에서 저장까지 직접 처리하려고 확장하면 경계가 다시 흐려진다.

### 4-4. 변경 허용 범위

- 몰입형 관련 로컬 state와 파생값을 전용 훅으로 이동
- orientation/fullscreen helper 호출을 전용 훅 안으로 이동
- 페이지에서는 전용 훅의 반환값만 소비

이 단계에서 하지 말아야 할 변경은 아래와 같다.

- `immersiveSettings` 저장 계약 변경
- `saveImmersiveSettings` 호출 타이밍 변경
- 채팅 상태의 source of truth 변경

### 4-5. 선행 조건

- `ImmersiveGameTopBar`, `ImmersiveDeviceShell`, `ImmersiveLandscapeControls`, `ImmersiveSkinPicker`, `ImmersiveChatOverlay` 테스트를 유지한다.
- orientation lock 성공/실패 메시지 표시 규칙을 characterization test로 고정한다.
- `isImmersive`가 false가 될 때 skin picker가 닫히는 동작을 테스트로 묶는다.

### 4-6. 회귀 포인트

- 몰입형 세로/가로 전환 버튼
- 스킨 선택 후 picker 닫힘
- 채팅 열기/닫기
- rotate hint와 orientation status message 표시

### 4-7. 판정

`분리 가능`

이 단계는 화면 책임을 분리하는 작업이라 도메인 리스크가 낮다. presenter 분리 직후 바로 이어서 진행해도 되는 단계다.

## 5. 3단계 분석: 페이지 잔여 액션 분리 가능성

### 5-1. 분리 대상

현재 페이지에 남아 있는 잔여 액션 중 우선 분석 대상은 아래 네 개다.

- `handleOverfeedConfirm`
- `handleOverfeedCancel`
- `resetDigimon`
- 진화 버튼 활성화 계산 effect

### 5-2. 책임 분해 표

| 대상 | 순수 계산 | 비동기 저장 | 모달/UI 제어 | 관찰 |
| --- | --- | --- | --- | --- |
| `handleOverfeedConfirm` | 거의 없음 | lazy update 전처리 의존 | 모달 닫기, feed 모달 열기, 애니메이션 시작 | 액션 helper로 분리 가능하나 animation 순서 test 필요 |
| `handleOverfeedCancel` | 거의 없음 | lazy update 전처리 의존 | 모달 닫기, reject 애니메이션, food 모달 닫기 | confirm과 짝을 맞춘 flow helper 필요 |
| `resetDigimon` | 환생 카운터, 스타터 ID, 초기 스탯 구성 | `setDigimonStatsAndSave`, `setSelectedDigimonAndSave`, 로그 추가 | confirm, death modal 닫기, popup flag 초기화 | 가장 위험한 대상 |
| 진화 버튼 활성화 effect | 조건 계산 | 없음 또는 간접 의존 | 버튼 상태 변경 | 순수 selector/helper로 승격 가능 |

### 5-3. 핵심 리스크

- `resetDigimon`은 최신 스탯 조회, 환생 카운터 계산, 스타터 디지몬 초기화, 활동 로그 추가, Firestore 저장, death modal 정리까지 한 함수에 섞여 있다.
- 저장 순서가 바뀌면 `selectedDigimon`, `digimonStats`, `activityLogs`, death popup 상태가 어긋날 수 있다.
- 버전별 스타터 ID(`Ver.1`, `Ver.2`, `Ver.3`)와 로그 메시지 생성 규칙이 helper 분리 과정에서 깨질 수 있다.
- 과식 확인/취소 흐름은 애니메이션과 모달 상태 전환 타이밍이 있어 단순 분리보다 characterization이 우선이다.

### 5-4. 권장 분리 방향

`resetDigimon`은 한 번에 훅으로 뽑기보다 아래 순서가 안전하다.

1. 순수 helper 분리
2. 저장 orchestration helper 분리
3. 페이지에서는 confirm과 후처리만 담당

초안 예시는 아래와 같다.

```jsx
buildResetDigimonPayload(...)
performResetDigimonPersistence(...)
resolveEvolutionButtonAvailability(...)
runOverfeedResolutionFlow(...)
```

### 5-5. 선행 테스트 필요 항목

- `resetDigimon`이 버전별 스타터 ID를 올바르게 선택하는지
- 환생 횟수와 perfect/normal 환생 카운터가 올바르게 누적되는지
- `NEW_START` 로그가 추가되는지
- `deathModal`이 닫히고 `hasSeenDeathPopup`이 초기화되는지
- 과식 confirm/cancel이 각각 올바른 애니메이션과 모달 상태를 만드는지
- 진화 버튼 활성화 조건이 사망, developer mode, jogress 상태에 따라 유지되는지

### 5-6. 판정

`선행 테스트 필요`

이 단계는 분리 자체는 가능하지만, characterization test 없이 바로 손대면 저장 순서와 부수효과 회귀가 발생할 가능성이 높다.

## 6. 4단계 분석: `useEvolution` 온라인 조그레스 분리 가능성

### 6-1. 현재 `useEvolution`이 맡는 책임

현재 `useEvolution`은 아래 책임을 동시에 가진다.

- 일반 진화 가능 여부 확인
- 일반 진화 실행
- 로컬 조그레스 실행
- 온라인 조그레스 방 생성
- 온라인 조그레스 방 취소
- 게스트 참가 처리
- 호스트 상태 반영
- 호스트 진화 실행
- Firestore room/slot write
- encyclopedia 갱신
- activity log 및 archive log 기록
- alert, modal, evolving state, completion UI 상태 제어

즉, “진화 규칙 훅”이라기보다 “진화 규칙 + 온라인 조그레스 애플리케이션 서비스”에 가깝다.

### 6-2. Firestore write와 UI side effect 맵

| 흐름 | 주요 Firestore write | 주요 UI side effect |
| --- | --- | --- |
| `createJogressRoom` | `jogress_rooms` 생성, host slot `jogressStatus` 갱신 | alert |
| `createJogressRoomForSlot` | 지정 슬롯에 대해 room 생성, slot 상태 갱신 | alert |
| `cancelJogressRoom` | room `cancelled`, host slot 상태 초기화 | alert |
| `proceedJogressOnlineAsGuest` | room `paired`, guest slot digimon/stats 갱신, 추가 room 취소 | alert, 현재 슬롯이면 로컬 상태 즉시 반영 |
| `applyHostJogressStatusFromRoom` | host slot `canEvolve` 반영 | 없음 |
| `proceedJogressOnlineAsHost` | host slot 최종 진화 저장, room `completed` | modal close, evolving state, local state, encyclopedia, archive log, completion UI |
| `proceedJogressOnlineAsHostForRoom` | 특정 host slot 최종 진화 저장, room `completed` | 현재 슬롯이면 로컬 상태 반영, encyclopedia, archive log |

### 6-3. 안전한 내부 분해 방향

외부 API는 유지하고 내부만 쪼개는 방향이 가장 안전하다.

```jsx
useEvolution()
  -> evolution-core.js
  -> local-jogress.js
  -> online-jogress-persistence.js
  -> useOnlineJogressActions.js
```

권장 원칙은 아래와 같다.

- Firestore 접근은 `online-jogress-persistence` 계층으로 모은다.
- 순수 진화 계산은 `evolution-core` 계층으로 모은다.
- alert, modal, evolving state, completion UI는 `useEvolution` 최상단 orchestration에 남긴다.

### 6-4. 리스크

- room 상태 전이 순서가 바뀌면 host/guest 동기화가 깨질 수 있다.
- `selectedDigimon`, `digimonStats`, `archive log`, `encyclopedia` 호출 순서가 달라지면 데이터 정합성이 흔들릴 수 있다.
- 현재 슬롯일 때만 로컬 상태를 즉시 반영하는 조건이 누락될 수 있다.
- alert와 modal close 타이밍이 빠지면 UX 회귀가 발생한다.

### 6-5. 선행 테스트 필요 항목

- host가 room을 생성하면 slot의 `jogressStatus.isWaiting`이 설정되는지
- host가 취소하면 room과 slot 상태가 함께 정리되는지
- guest 참가 시 room이 `paired`로 바뀌고 guest slot이 결과 디지몬으로 진화하는지
- host 완료 시 room이 `completed`로 바뀌고 slot 상태와 encyclopedia/log archive가 함께 갱신되는지
- 현재 플레이 슬롯과 다른 슬롯을 대상으로 실행했을 때 로컬 상태 반영 범위가 올바른지

### 6-6. 판정

`선행 테스트 필요`

내부 분해 방향은 보이지만, 이 단계는 room 상태 전이와 데이터 정합성 회귀 위험이 높아 선행 테스트 없이 바로 착수하면 안 된다.

## 7. 5단계 분석: `useGameData` 경계 축소 가능성

### 7-1. 현재 역할 재분류

| 역할 | 현재 포함 여부 | 관찰 |
| --- | --- | --- |
| hydration/load | 포함 | slot 문서와 subcollection logs/battleLogs 로드 |
| lazy update 적용 | 포함 | 로드 직후 메모리 보정과 과거 로그 복원 |
| save | 포함 | 일반 저장, 배경 저장, 몰입형 저장, death snapshot 저장 |
| log append | 포함 | subcollection 로그 추가 |
| death popup | 포함 | `checkDeathStatus`에서 직접 modal open |
| loading state | 포함 | `setIsLoadingSlot`, `setIsLoading` 직접 호출 |
| UI setter | 포함 | `setIsLightsOn`, `setWakeUntil`, `setBackgroundSettings`, `setImmersiveSettings`, `setDeathReason` 사용 |

현재 `useGameData`는 persistence 훅이면서 동시에 페이지 hydration coordinator 역할도 같이 맡고 있다.

### 7-2. 왜 지금 바로 손대면 위험한가

`useGameData`는 아래 이유로 마지막 순서가 맞다.

- 로드 직후 Firestore write를 하지 않도록 조심스럽게 설계된 구간이 있다.
- death popup은 단순 UI가 아니라 lazy update 결과와 연결된 상태 전이의 일부다.
- `backgroundSettings`, `immersiveSettings`, `isLightsOn`, `wakeUntil`은 root slot field 복원과 함께 움직인다.
- 로드 실패 fallback, 문서 없음 fallback, migration 보정이 섞여 있어 책임 경계를 성급히 나누면 회귀가 넓어진다.

### 7-3. 장기 목표 경계

장기적으로는 아래 경계가 바람직하다.

- `useGameData`에 남길 것
  - `loadSlotData`
  - `saveStats`
  - `saveBackgroundSettings`
  - `saveImmersiveSettings`
  - lazy update 기반 저장 보조
  - activity/battle log append
  - `persistDeathSnapshot`
- 상위로 올릴 것
  - death popup open/close 결정
  - death reason UI 표시 책임
  - page-level loading spinner 상태
  - hydration 결과를 각 setter에 흘려보내는 orchestration

### 7-4. 선행 테스트 필요 항목

- 로드 후 `selectedDigimon`, `digimonStats`, lights/wake, background, immersive 설정이 올바르게 복원되는지
- death 상태 진입 시 `deathReason`과 `deathModal` 표시가 맞는지
- background/immersive 설정 저장이 로그인/slot 조건을 지키는지
- lazy update 입력과 출력 병합 규칙이 로드 시점에 보존되는지
- 문서 없음 fallback과 에러 fallback이 스타터 디지몬과 기본 설정으로 복구되는지

### 7-5. 판정

`지금은 보류`

`useGameData`는 현재 구조에서 가장 넓은 회귀 면적을 가진다. presenter 분리, 몰입형 레이아웃 훅 분리, 잔여 액션 테스트 보강, `useEvolution` 내부 분해 방향이 정리된 뒤 마지막에 접근하는 것이 안전하다.

## 8. 추천 실행 순서와 중단 조건

권장 실행 순서는 아래와 같다.

1. `GamePageView` / `ImmersiveGameView` 분리
2. `useImmersiveGameLayout` 분리
3. 페이지 잔여 액션 분리
4. `useEvolution` 온라인 조그레스 내부 분해
5. `useGameData` 경계 축소

각 단계의 중단 조건은 아래와 같다.

- 1단계 중단 조건: presenter props가 지나치게 비대해져 `Game.jsx`와 복잡도가 거의 같아질 때
- 2단계 중단 조건: 훅 안으로 저장 책임이 유입되기 시작할 때
- 3단계 중단 조건: `resetDigimon` 저장 순서를 유지하는 테스트가 없을 때
- 4단계 중단 조건: room 상태 전이 test 없이 persistence 계층을 분리하려 할 때
- 5단계 중단 조건: 로드/복원/death popup 회귀 기준이 부족할 때

## 9. 라운드별 필수 characterization test 목록

| 단계 | 유지해야 할 기존 테스트 | 추가 권장 테스트 |
| --- | --- | --- |
| presenter 분리 | `GameScreen.test.jsx`, `GameModals.test.jsx`, `ImmersiveGameTopBar.test.jsx`, `ImmersiveDeviceShell.test.jsx` | 모바일 헤더 분기, 프로필 메뉴 열기/닫기, 몰입형/기본 화면 전환 |
| immersive layout 훅 분리 | `ImmersiveLandscapeControls.test.jsx`, `ImmersiveSkinPicker.test.jsx`, `ImmersiveChatOverlay.test.jsx` | orientation status 메시지, skin picker cleanup, chat toggle |
| 페이지 액션 분리 | `useGameActions.test.js` 일부 재활용 가능 | `resetDigimon`, overfeed confirm/cancel, 진화 버튼 활성화 selector |
| `useEvolution` 분리 | `useEvolution.test.js` | room 생성, 취소, guest 참가, host 완료, 현재 슬롯 즉시 반영 |
| `useGameData` 경계 축소 | `useGameData.test.js` | load restore, death popup trigger, save gate, fallback 경로 |

## 10. 결론

현재 기준에서 가장 안전한 다음 단계는 아래 두 가지다.

- `Game.jsx`의 JSX를 `GamePageView`와 `ImmersiveGameView`로 먼저 분리한다.
- 몰입형 상태와 파생 로직을 `useImmersiveGameLayout`으로 묶어 페이지에서 제거한다.

그 다음부터는 테스트가 작업의 선행 조건이 된다.

- `resetDigimon`과 과식 흐름은 characterization test 없이 바로 분리하지 않는다.
- `useEvolution`은 외부 API를 유지한 채 내부 모듈 분해 방향으로만 접근한다.
- `useGameData`는 마지막에 다룬다.

요약하면, 현재 구조에서 “바로 분리 가능한 것”은 presenter와 몰입형 layout이고, “테스트를 먼저 깔아야 하는 것”은 페이지 잔여 액션과 온라인 조그레스이며, “지금은 보류해야 하는 것”은 `useGameData` 경계 축소다.
