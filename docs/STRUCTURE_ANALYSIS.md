# 현재 프로젝트 구조 분석 보고서

**작성일:** 2026-03-24  
**대상 저장소:** `d2_tama_refact`  
**분석 기준:** 현재 소스코드 기준, 기존 `docs/*.md`는 참고자료로만 활용

## 1. 프로젝트 개요와 디렉토리 구조

이 저장소는 루트에 문서, 설정, 분석 자료가 모여 있고, 실제 실행 애플리케이션은 `digimon-tamagotchi-frontend` 아래에 있다. 따라서 구조를 이해할 때는 루트보다 프론트엔드 앱 디렉토리를 중심으로 봐야 한다.

### 루트 디렉토리의 역할

- `digimon-tamagotchi-frontend/`
  React SPA 본체. 실제 실행 코드, Firebase 연동, 게임 로직이 모두 여기에 있다.
- `docs/`
  기능 분석, 버그 분석, 설계 메모, 작업 로그가 모여 있는 참고 문서 영역이다.
- `README.md`, `FIRESTORE_RULES.md`, `TROUBLESHOOTING.md`, `QUICK_TEST.md`
  실행과 운영 참고자료다.
- 루트 `package.json`
  앱 실행용이 아니라 루트 워크스페이스용 최소 파일이다. 실제 앱 의존성과 스크립트는 프론트엔드 내부 `package.json`에 있다.

### 프론트엔드 디렉토리의 역할

`digimon-tamagotchi-frontend`는 Create React App 기반 단일 페이지 앱이다. 주요 의존성은 React 18, Firebase 12, React Router DOM 7, Ably, Supabase이며, 실행 스크립트는 다음과 같다.

- `npm start`
- `npm build`
- `npm test`

`NODE_OPTIONS=--openssl-legacy-provider`가 `start`/`build`에 포함되어 있어 현재 개발 환경 의존성이 스크립트에 직접 반영되어 있다.

### `src/` 하위 구조

- `components/`
  실제 화면 조각과 모달이 모여 있다. `GameScreen`, `ControlPanel`, `GameModals`처럼 게임 UI를 조합하는 컴포넌트와, 배틀/도감/설정/교감/아레나 관련 모달들이 함께 있다.
- `pages/`
  라우팅 단위의 화면이다. `Login`, `SelectScreen`, `Game`, `Home`가 있다.
- `hooks/`
  게임 상태, 저장, 액션, 진화, 사망, 애니메이션, 아레나 등 화면 로직을 분리한 커스텀 훅 계층이다.
- `logic/`
  배틀, 진화, 음식, 스탯, 훈련 같은 순수 함수 중심 도메인 로직 계층이다.
- `data/`
  디지몬 데이터와 기본 스탯, 배경, 퀘스트 데이터가 있다. `v1`, `v2modkor`, `nonuse`로 나뉜다.
- `contexts/`
  인증과 Ably 실시간 컨텍스트를 제공한다.
- `repositories/`
  저장소 추상화 흔적이 남아 있는 영역이다. 다만 현재 실제 저장은 이 계층보다 `useGameData`에서 직접 Firestore를 다루는 방식이 중심이다.
- `utils/`
  날짜 포맷, 배경, 수면, Firestore helper, 테이머명, 사용자 프로필 등 범용 유틸리티가 있다.
- `styles/`
  페이지/컴포넌트 보조 CSS가 있다.

### 현재 직접 실행 코드와 참고/레거시 코드 구분

현재 구조 이해에서 직접 우선순위를 둬야 할 코드는 다음이다.

- `src/index.js`
- `src/App.jsx`
- `src/pages/Login.jsx`
- `src/pages/SelectScreen.jsx`
- `src/pages/Game.jsx`
- `src/hooks/*`
- `src/logic/*`
- `src/data/v1/*`, `src/data/v2modkor/*`

참고 성격이 강하거나 현재 직접 실행의 중심이 아닌 코드는 다음이다.

- `src/data/nonuse/*`
- `src/repositories/SlotRepository.js`
  주석에도 나오듯 실제 코드에서는 직접 사용되지 않고 보존 중인 파일이다.
- 오래된 구조를 설명하는 일부 문서

## 2. 실행 흐름과 화면 구조

### 앱 시작 흐름

앱 시작점은 `src/index.js`다. 여기서 `App`을 `React.StrictMode`로 렌더링하고 `reportWebVitals()`를 호출한다. 전역 Provider는 `App.jsx`에서 붙는다.

### `App.jsx`의 역할

`App.jsx`는 라우팅과 전역 컨텍스트의 허브다.

- `AuthProvider`로 전체 앱을 감싼다.
- 내부에서 `BrowserRouter`를 구성한다.
- `AblyContextProvider`를 붙여 채팅/실시간 기능을 게임 화면 주변에 공급한다.
- `PageViewTracker`를 통해 GA4 페이지뷰를 보낸다.
- 라우트는 다음 세 개가 핵심이다.
  - `/` → `Login`
  - `/select` → `SelectScreen`
  - `/game/:slotId` → `Game`

즉, 전체 앱 흐름은 로그인 페이지에서 시작해 슬롯 선택 화면을 거쳐 특정 슬롯의 게임 화면으로 들어가는 구조다.

### 인증과 전역 상태 부착 시점

인증은 `AuthContext.jsx`가 담당한다.

- Firebase Auth 기반이다.
- `signInWithGoogle`, `signInAnonymously`, `logout`, `currentUser`, `loading`, `isFirebaseAvailable`를 제공한다.
- `onAuthStateChanged`로 로그인 상태를 추적한다.

현재 구조상 문서에는 localStorage 모드 설명이 많이 남아 있지만, 실제 주요 페이지인 `Login`, `SelectScreen`, `Game`는 모두 Firebase 사용자 존재를 전제로 이동 제어를 하고 있다. 즉, 현재 화면 동작 기준의 주 경로는 Firebase 인증 기반이다.

### 로그인에서 게임 진입까지의 경로

1. 사용자가 `/`에서 `Login.jsx`를 본다.
2. Google 또는 익명 로그인을 시도한다.
3. 로그인 성공 시 `users/{uid}` 문서를 생성 또는 병합 저장하고, 테이머명을 초기화한다.
4. `/select`로 이동한다.
5. `SelectScreen.jsx`가 현재 사용자 기준으로 `users/{uid}/slots`를 조회한다.
6. 슬롯을 새로 만들거나 기존 슬롯을 고른다.
7. `/game/:slotId`로 이동한다.
8. `Game.jsx`가 슬롯 데이터, 훅, 모달, 게임 로직을 조합해 실제 플레이 화면을 구성한다.

### 페이지별 책임

- `Login.jsx`
  로그인 방식 선택, 사용자 문서 생성, 최초 진입 라우팅 담당
- `SelectScreen.jsx`
  슬롯 목록 조회, 슬롯 생성/삭제/정렬/별명 관련 관리, 계정 설정 진입 담당
- `Game.jsx`
  게임 플레이의 컨테이너. 상태 훅, 데이터 훅, 게임 액션 훅, 도메인 로직, UI 컴포넌트를 모두 연결한다.

## 3. 상태 관리와 커스텀 훅 구조

현재 프로젝트 구조의 핵심은 `Game.jsx`와 그 주변 훅 계층이다. `Game.jsx`는 단순 화면이 아니라 여러 훅을 조합해 게임 전체를 오케스트레이션하는 컨테이너 역할을 한다.

### `Game.jsx`의 구조적 역할

`Game.jsx`는 현재 약 1,978줄 규모의 대형 파일이며 다음 책임을 가진다.

- URL의 `slotId` 해석
- 인증 사용자 확인 및 비로그인 리다이렉션
- 모바일 여부, 프로필 드롭다운, 계정 설정 등 로컬 UI 상태 관리
- `useGameState`로 핵심 상태 묶음 생성
- `useGameData`로 저장/로드 및 lazy update 경로 연결
- `useGameActions`, `useGameHandlers`, `useEvolution`, `useDeath`, `useGameAnimations`, `useArenaLogic`, `useFridge`를 연결
- 최종적으로 `GameScreen`, `ControlPanel`, `GameModals`, 각종 상태 표시 컴포넌트에 값과 핸들러를 전달

즉, 이 파일은 “비즈니스 로직이 없는 페이지”는 아니지만, 각 영역의 로직을 훅과 순수 함수로 분리한 뒤 이를 한곳에서 연결하는 허브에 가깝다.

### 훅별 책임 정리

- `useGameState`
  게임 핵심 상태 보관소다. 선택된 디지몬, 스탯, 활동 로그, 슬롯 정보, 퀘스트/배틀 상태, 시즌 정보, 모달 객체, 개발자 옵션, UI 상태를 한곳에 모은다.
- `useGameData`
  슬롯 데이터 로드, Firestore 저장, 배경 설정 로드, lazy update 적용, 로그 저장까지 포함하는 데이터 영속성 계층이다. 현재 저장 흐름의 실질 중심이다.
- `useGameActions`
  먹이, 훈련, 배틀, 청소 같은 플레이 액션을 처리한다. 액션 직전 lazy update를 거쳐 최신 스탯을 만든 뒤 행동 결과를 저장하는 구조다.
- `useGameLogic`
  수면 상태 계산, 호출 상태, 케어미스 관련 보조 계산, 활동 로그 생성 같은 공통 게임 계산 함수 모음이다. 훅처럼 이름이 붙어 있지만 React state를 직접 관리하는 훅이라기보다 도메인 보조 함수 성격이 강하다.
- `useGameHandlers`
  메뉴 클릭, 퀘스트 시작, 통신 진입, 치료 진입, 조명/수면 관련 이벤트를 정리한다. UI 이벤트와 게임 액션을 이어 주는 계층이다.
- `useGameAnimations`
  먹이, 청소, 치료 등 애니메이션 시퀀스를 제어한다.
- `useEvolution`
  진화 가능 여부 판단, 진화 버튼 처리, 실제 진화 수행, 조그레스 진화 경로를 담당한다.
- `useDeath`
  사망 조건 확인과 오하카다몬 전환, 환생 처리, 사망 전 도감 반영을 담당한다.
- `useArenaLogic`
  아레나 설정 로드, 시즌 정보 반영, 아레나 배틀 시작 흐름을 담당한다.
- `useFridge`
  냉장고 보관/해제와 시간 정지 상태 저장을 담당한다.
- `useEncyclopedia`
  도감 저장 및 도감 마스터 관련 업데이트를 담당한다.

### 상태 구성 방식

상태는 크게 네 덩어리로 나뉜다.

- 게임 데이터
  `selectedDigimon`, `digimonStats`, `activityLogs`, 슬롯 정보, 배틀/퀘스트 정보
- 모달 상태
  `modals` 객체에 20개 이상 플래그를 모아 관리
- 플래그 상태
  개발자 모드, 진화 가능 여부, 수면 여부, 로딩 상태 등
- UI 상태
  현재 메뉴, 애니메이션, 배경, 스프라이트 크기, 먹이 타입 등

이 구조 덕분에 `Game.jsx` 내부에서 상태 출처는 많지만, 대부분이 `useGameState` 하나를 통해 집중적으로 생성된다.

### 화면 컴포넌트 조합 방식

실제 게임 화면은 다음 세 축으로 나뉜다.

- `GameScreen`
  메인 디지몬 화면과 배경, 스프라이트, 상태 표시
- `ControlPanel`
  사용자 입력 인터페이스
- `GameModals`
  배틀, 도감, 설정, 냉장고, 교감, 치료, 진화, 추가 메뉴 등 각종 모달 묶음

즉, 화면 렌더링 자체는 컴포넌트로 나뉘어 있지만, 상태와 의존성 배선은 여전히 `Game.jsx`가 중심이다.

## 4. 데이터 구조와 게임 로직 계층

### 데이터 계층

디지몬 데이터는 단일 파일이 아니라 버전별과 호환 계층으로 나뉜다.

- `src/data/v1/digimons.js`
  구조화된 v1 디지몬 데이터
- `src/data/v2modkor/digimons.js`
  구조화된 v2 디지몬 데이터
- `src/data/v1/adapter.js`
  새 구조를 옛 형식으로 변환하는 어댑터
- `src/data/stats.js`
  초기 스탯 생성, 시간 경과 반영, lazy update 관련 핵심 로직 보유

현재 소비 방식의 핵심은 “구조화된 데이터 + 어댑터 호환”이다.

1. 원본 데이터는 `v1`/`v2modkor`에 구조화되어 있다.
2. 일부 기존 화면/로직은 여전히 옛 포맷을 기대한다.
3. 그래서 `adaptDataMapToOldFormat()`으로 호환용 맵을 만들고 사용한다.

이 구조 때문에 “현재 데이터 모델”과 “실제 소비 포맷”이 완전히 동일하지는 않다. 구조 이해 시에는 원본 맵과 adapted 맵을 구분해서 봐야 한다.

### 로직 계층

도메인 로직은 `src/logic` 아래에 모여 있다.

- `logic/stats`
  초기화, 시간 경과, lazy update, hunger/strength 감소, 에너지 회복
- `logic/evolution`
  진화 조건 판정, 진화 대상 탐색, 조그레스 계산
- `logic/battle`
  명중률, 파워 계산, 전투 시뮬레이션, 퀘스트 라운드 처리
- `logic/food`
  고기/프로틴 섭취, 거부 판정
- `logic/training`
  훈련 결과 계산

핵심 특징은 “순수 계산을 최대한 `logic/`으로 내리고, Firestore 저장/화면 반응은 `hooks/`에서 처리한다”는 점이다.

### 저장 계층의 실제 구조

문서상 저장소 추상화 패턴이 설명되어 있지만, 현재 실제 구조의 중심은 `repositories`보다 `useGameData`다.

- `useGameData`
  `users/{uid}/slots/{slotId}`에 직접 접근하며 저장/로드를 수행한다.
- `UserSlotRepository.js`
  사용자별 슬롯 저장소 유틸리티로 남아 있으며 일부 화면에서 참고 가능한 구조다.
- `SlotRepository.js`
  과거 추상화 흔적이며, 주석에서도 현재 직접 사용하지 않는다고 밝히고 있다.

즉, 구조 이해 관점에서 저장 흐름은 다음처럼 보는 것이 정확하다.

1. 페이지나 훅이 저장 요청을 만든다.
2. `useGameData`가 최신 스탯과 로그를 합친다.
3. Firestore `users/{uid}/slots/slot{n}` 문서와 로그 서브컬렉션에 반영한다.

### 테스트 구조

테스트 체계는 현재 매우 얕다.

- `package.json`에는 `react-scripts test` 스크립트가 있다.
- 실제 테스트 파일은 기본 CRA 형태의 `src/App.test.js`가 남아 있다.
- 현재 게임 구조 이해를 위해서는 `logic/` 계층이 향후 테스트 확대의 가장 좋은 진입점이다.

## 5. 현재 구조를 이해할 때 먼저 봐야 할 핵심 파일 순서

현재 코드를 빠르게 이해하려면 다음 순서가 효율적이다.

1. `digimon-tamagotchi-frontend/src/App.jsx`
   앱의 전체 라우팅과 전역 컨텍스트를 먼저 파악한다.
2. `digimon-tamagotchi-frontend/src/contexts/AuthContext.jsx`
   인증 전제와 화면 접근 조건을 이해한다.
3. `digimon-tamagotchi-frontend/src/pages/Login.jsx`
   최초 진입과 사용자 문서 생성 방식을 본다.
4. `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
   슬롯 문서 구조와 게임 진입 전 상태를 이해한다.
5. `digimon-tamagotchi-frontend/src/pages/Game.jsx`
   실제 게임 오케스트레이션을 본다.
6. `digimon-tamagotchi-frontend/src/hooks/useGameState.js`
   상태가 무엇인지 파악한다.
7. `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
   저장/로드와 lazy update 흐름을 본다.
8. `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
   사용자 행동이 스탯에 어떻게 반영되는지 본다.
9. `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`, `useDeath.js`
   게임의 큰 상태 전환을 본다.
10. `digimon-tamagotchi-frontend/src/data/stats.js`와 `src/logic/*`
   순수 계산 규칙을 마지막에 정리한다.

이 순서는 “화면에서 시작해서 상태와 저장으로 내려간 뒤, 마지막에 순수 규칙을 보는” 흐름이다. 현재 구조 이해 목적에는 이 순서가 가장 부담이 적다.

## 구조 이해 후 다음 분석 대상

구조 파악이 끝난 뒤 다음 단계로 이어지기 좋은 주제는 아래 세 가지다.

- `Game.jsx`와 주요 훅 사이의 책임 경계 재정의
- `useGameData`와 `repositories` 사이의 저장 계층 정리
- `logic/` 중심 테스트 추가 전략 수립
