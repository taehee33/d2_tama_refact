# Digimon Tamagotchi Frontend 구조 분석 (code-mapper 기준)

작성일: 2026-03-29

## 분석 범위

- 대상 경로: `digimon-tamagotchi-frontend`
- 중점 파일:
  - `src/App.jsx`
  - `src/pages/Game.jsx`
  - `src/hooks`
  - `src/logic`
  - `src/repositories`
  - `src/data/v1`
- 목적:
  - 실제 호출 흐름 정리
  - 상태 관리 경계 정리
  - Firebase/localStorage 경계 정리
  - lazy update 적용 지점 정리
  - 구조상 위험 분기와 문서-코드 간 차이 식별

## 핵심 요약

- 런타임 중심축은 `App.jsx -> Game.jsx -> useGameState/useGameData -> 도메인 Hook -> UI 컴포넌트`다.
- `Game.jsx`는 단순 페이지가 아니라 실제 게임 런타임 오케스트레이터다.
- 상태의 소유권은 주로 `useGameState`에 있지만, 저장과 lazy update의 실질 경계는 `useGameData`가 잡고 있다.
- 문서상 이중 저장소 구조 설명이 남아 있지만, 현재 메인 경로는 사실상 Firebase 중심이다.
- `localStorage`는 핵심 슬롯 영속성보다 UI 설정과 일부 보조 상태에 더 많이 남아 있다.
- `Repository` 계층은 보존되어 있지만 현재 런타임 핵심 경로는 아니다.
- `applyLazyUpdate`의 실제 중심 구현은 `src/data/stats.js`에 있고, 이 함수가 `useGameData`를 통해 액션 전 공통 진입점으로 주입된다.

---

## 1. 실제 호출 흐름

### 1.1 앱 진입

실제 엔트리는 `src/App.jsx`다.

- `App.jsx:92-103`에서 `AuthProvider`로 전체 앱을 감싼다.
- `App.jsx:52-88`의 `AppContent`가 Router와 Ably 컨텍스트를 조립한다.
- 실제 라우트는 다음 세 개다.
  - `/` -> `Login`
  - `/select` -> `SelectScreen`
  - `/game/:slotId` -> `Game`

즉 앱 진입 흐름은 다음으로 요약된다.

`App -> AuthProvider -> AppContent -> Router -> Login/SelectScreen/Game`

### 1.2 게임 진입 후 메인 오케스트레이션

`src/pages/Game.jsx`가 실제 메인 컨트롤러다.

- `Game.jsx:114-127`에서 `useGameState()`로 핵심 상태를 생성한다.
- `Game.jsx:225-227`에서 슬롯 버전에 따라 `adaptedV1/adaptedV2`와 원본 진화 데이터맵을 나눈다.
- `Game.jsx:295-336`에서 `useGameData()`를 연결해 슬롯 로드, 저장, lazy update, 로그 append 함수를 주입받는다.
- `Game.jsx:811-1045`에서 `useGameActions`, `useEvolution`, `useDeath`, `useGameAnimations`, `useFridge`, `useArenaLogic`, `useGameHandlers`를 순서대로 조립한다.
- 최종 UI는 `GameScreen`, `ControlPanel`, `GameModals`로 분배된다.

즉 메인 흐름은 다음이다.

`Game -> useGameState -> useGameData -> feature hooks -> GameScreen/ControlPanel/GameModals`

### 1.3 사용자 액션의 표준 경로

대부분의 액션은 아래 흐름을 따른다.

1. 사용자 입력이 `ControlPanel` 또는 모달 계열 UI에서 발생한다.
2. 이벤트는 `useGameActions` 또는 다른 도메인 Hook으로 전달된다.
3. Hook은 먼저 `applyLazyUpdateBeforeAction()`을 호출한다.
4. 현재 시점 기준 스탯을 보정한 뒤 규칙 계산과 로그 생성을 수행한다.
5. `setDigimonStatsAndSave()`를 통해 Firestore 슬롯 문서를 갱신한다.
6. 활동 로그와 배틀 로그는 서브컬렉션에 추가된다.

이 구조에서 공통 영속성 진입점은 `useGameData`가 반환하는 `saveStats`와 `applyLazyUpdateForAction`이다.

---

## 2. 상태 관리 경계

### 2.1 `useGameState`가 소유하는 상태

`src/hooks/useGameState.js:121-340`는 상태를 네 묶음으로 나눈다.

- `gameState`
  - `selectedDigimon`
  - `digimonStats`
  - `activityLogs`
  - 슬롯 메타데이터
  - 퀘스트/배틀/시즌 상태
- `modals`
  - 게임 내 거의 모든 모달과 팝업 상태
- `flags`
  - developer mode
  - ignore evolution time
  - loading/evolution/sleep 관련 플래그
- `ui`
  - 현재 애니메이션
  - 배경 설정
  - 스프라이트 크기
  - 먹이/청소/치료 단계
  - 조명, 수면, 토스트 상태

즉 `useGameState`는 "상태 저장소" 역할을 명확하게 가진다.

### 2.2 `Game.jsx`에 남아 있는 페이지 전용 상태

`Game.jsx`는 Hook으로 분리된 뒤에도 페이지 전용 보조 상태를 직접 가진다.

- 모바일 감지
- 프로필 메뉴
- 계정 설정 모달
- 테이머명
- 업적 목록
- 상태 상세 메시지
- 온라인 조그레스 상태

즉 상태가 완전히 Hook 하나로 수렴한 구조는 아니고, 페이지 계층이 여전히 일부 화면 제어 책임을 유지한다.

### 2.3 영속성 경계는 `useGameData`

`src/hooks/useGameData.js`는 setter들을 주입받아 아래 책임을 가진다.

- 슬롯 로드 (`useGameData.js:432-617`)
- Firestore 저장 (`useGameData.js:144-302`)
- lazy update 적용 (`useGameData.js:308-382`)
- 배경 설정 저장 (`useGameData.js:623-642`)
- 활동 로그/배틀 로그 서브컬렉션 append (`useGameData.js:648-689`)

즉 현재 구조의 실제 경계는 다음처럼 정리할 수 있다.

- 상태 소유: `useGameState`
- 저장/로드/lazy update: `useGameData`
- 규칙 실행: 각 feature Hook + `logic/*`
- 화면 조립: `Game.jsx`

### 2.4 `Game.jsx`의 잔존 controller 책임

다음 책임은 아직 `Game.jsx`에 많이 남아 있다.

- 1초 UI 타이머 (`Game.jsx:800-809`)
- 배경 저장 트리거 (`Game.jsx:357-367`)
- 탭 이탈/숨김 시 저장 (`Game.jsx:404-420`)
- 진화 버튼 활성화 계산 (`Game.jsx:1262-1296`)
- 수면 상태 주기 계산 (`Game.jsx:1298-1313`)
- 온라인 조그레스 Firestore 구독 (`Game.jsx:1315-1368`)

Hook 분리는 진행되었지만 최종 조립과 타이머/구독 제어는 페이지에 많이 남아 있는 구조다.

---

## 3. 저장소 경계 (Firebase / localStorage / repositories)

### 3.1 현재 핵심 슬롯 영속성은 Firebase 중심

현재 메인 경로는 사실상 Firebase 중심이다.

- `AuthContext.jsx:81-103`은 Firebase가 없을 때 로딩만 해제하는 graceful degradation 흔적을 유지한다.
- 하지만 `Game.jsx:143-148`은 Firebase 사용 불가 또는 비로그인 시 바로 `/`로 보낸다.
- `useGameData.js:435-440`도 동일하게 Firebase 전제를 둔다.
- 실제 슬롯 로드/저장은 `users/{uid}/slots/slot{slotId}` 경로를 직접 사용한다 (`useGameData.js:259`, `useGameData.js:448`).

즉 현재 런타임 핵심 경로는 "이중 저장소"보다 "Firebase 필수 + 일부 localStorage 보조 사용"에 가깝다.

### 3.2 localStorage가 남아 있는 실제 범위

`localStorage`는 완전히 사라지지 않았지만 역할이 바뀌었다.

대표 잔존 영역:

- 스프라이트 크기 설정 (`useGameState.js:267-273`, `Game.jsx:374-388`)
- developer mode, encyclopedia 표시, ignore evolution time (`useGameState.js:275-288`)
- `clearedQuestIndex` (`Game.jsx:390-402`)
- 일부 컴포넌트 보조 상태 (`StatsPanel`, `ArenaScreen`)

즉 localStorage는 핵심 슬롯 저장소라기보다 "UI/개발자 설정 + 일부 보조 상태 캐시" 성격이 강하다.

### 3.3 Repository 계층의 현재 위치

`src/repositories/SlotRepository.js`는 스스로 다음을 밝힌다.

- localStorage 모드 제거
- Firebase만 사용
- 실제 코드에서는 Repository를 직접 사용하지 않음

즉 Repository 계층은 현재 런타임 중심 경로가 아니라, 보존된 추상화 또는 향후 사용 후보에 가깝다.

실제 저장 경계는 현재 `useGameData`와 Firestore 직접 호출에 있다.

---

## 4. 데이터 계층과 도메인 로직 경계

### 4.1 `src/data/v1`는 원본 도메인 데이터 소스

`src/data/v1/digimons.js:29-220`는 다음 정보를 가진 구조화된 원본 데이터맵이다.

- 디지몬 ID / 이름 / stage / sprite
- `stats`
- `evolutionCriteria`
- `evolutions`

즉 이 파일은 "진화와 스탯 규칙의 기준 데이터 원본"이다.

### 4.2 `adapter.js`는 구 런타임과의 호환 계층

`src/data/v1/adapter.js:11-64`는 새 구조를 구 포맷으로 바꾼다.

- `Game.jsx:225-227`은 adapted 데이터맵과 원본 데이터맵을 동시에 유지한다.
- adapted 맵은 기존 런타임 계산 로직과 Hook들이 요구하는 필드에 맞춘다.
- 원본 맵은 진화와 한글명, 구조화된 데이터 참조에 사용된다.

즉 현재 데이터 경계는 "원본 v1/v2 데이터 + adapter 기반 호환 레이어" 구조다.

### 4.3 스탯 로직의 경계는 완전히 한 곳에 모여 있지 않음

현재 스탯 관련 로직은 한 파일에 완전히 모여 있지 않다.

- `Game.jsx`는 `initializeStats`, `updateLifespan`을 `src/data/stats.js`에서 가져온다.
- 동시에 `handleEnergyRecovery`는 `src/logic/stats/stats`에서 가져오고,
- `handleHungerTick`, `handleStrengthTick`은 `src/logic/stats/hunger`, `src/logic/stats/strength`에서 가져온다.

즉 "data"와 "logic" 사이에 stat 관련 책임이 혼재해 있다.

이 점은 문서상 구조와 실제 코드의 차이를 만든다.

---

## 5. lazy update 적용 지점

### 5.1 실제 구현 위치

실제 `applyLazyUpdate` 구현은 `src/data/stats.js:377-920`에 있다.

이 함수는 다음을 한 번에 처리한다.

- 경과 시간 계산
- 냉장고 시간 제외 처리
- 수면 시간 제외 처리
- 배고픔 감소
- 힘 감소
- 배변 증가와 부상/케어미스 소급 처리
- 수명 증가
- 진화까지 남은 시간 감소
- `lastSavedAt` 갱신

### 5.2 액션 전 공통 진입점

`useGameData.js:308-382`의 `applyLazyUpdateForAction()`이 런타임 공통 래퍼 역할을 한다.

여기서 수행하는 일:

- 현재 디지몬 기준 `sleepSchedule`, `maxEnergy` 계산
- Firestore 슬롯 문서에서 `lastSavedAt` 조회
- `applyLazyUpdate()` 호출
- 과거 재구성으로 추가된 로그를 서브컬렉션에 반영
- 사망 상태 변화 감지

즉 런타임에서 lazy update의 실제 진입점은 `applyLazyUpdate()` 자체보다 `useGameData`의 래퍼 함수다.

### 5.3 로드 시점 lazy update

슬롯 로드 시에도 lazy update가 적용된다.

- `useGameData.js:532-589`에서 `lastSavedAt`을 기준으로 로드 직후 메모리 상태를 보정한다.
- 이때 즉시 Firestore에 다시 쓰지 않고 메모리 상태만 업데이트한다.

이 설계는 불필요한 write를 줄이려는 의도가 분명하다.

### 5.4 실제 호출 지점

`applyLazyUpdateBeforeAction`은 다음 Hook들에 주입된다.

- `useGameActions` (`Game.jsx:818-863`)
- `useEvolution` (`Game.jsx:877-906`)
- `useDeath` (`Game.jsx:911-925`)
- `useGameAnimations` (`Game.jsx:929-957`)
- `useFridge` (`Game.jsx:963-970`)
- `useGameHandlers` (`Game.jsx:1008-1045`)

즉 액션성 기능은 거의 모두 공통 lazy update 경계를 통과한다.

---

## 6. 최고 위험 분기와 구조상 주의점

### 6.1 문서 설명과 실제 구현의 차이

현재 가장 큰 구조 리스크는 문서와 실제 구현의 차이다.

- AGENTS/문서에서는 dual storage와 repository 패턴이 강조된다.
- 실제 메인 경로는 Firebase-only에 가깝다.
- 문서상 lazy update 핵심 파일 설명과 실제 구현 위치도 다르다.

이 차이는 신규 작업자가 잘못된 저장 경계나 수정 지점을 선택하게 만들 수 있다.

### 6.2 `Game.jsx` controller 비대화

Hook가 나뉘었지만 `Game.jsx`는 여전히 다음을 모두 가진다.

- 데이터 선택
- 저장 함수 주입
- 1초 타이머
- UI effect
- Firestore 구독
- feature Hook 조립
- 최종 렌더 조립

즉 페이지가 구조적으로 얇아지지 않았고, controller 역할이 여전히 두껍다.

### 6.3 저장 경계의 혼합

슬롯 핵심 데이터는 Firebase로 가지만, UI/보조 상태는 localStorage가 계속 섞여 있다.

이 구조는 합리적일 수 있지만, 아래를 항상 분리해서 봐야 한다.

- 핵심 게임 상태
- UI/개발자 설정
- 로그 서브컬렉션
- 도감/프로필/채팅 같은 별도 기능 데이터

경계가 불명확하면 저장 전략 변경 시 회귀가 나기 쉽다.

### 6.4 데이터/로직 책임 혼합

`src/data/stats.js`와 `src/logic/stats/*`에 스탯 책임이 나뉘어 있어, "어디가 진짜 기준 구현인가"가 작업자 입장에서 즉시 명확하지 않다.

특히 시간 기반 누적 처리와 즉시 액션 처리의 경계가 파일 단위로 깔끔하게 정리돼 있지 않다.

---

## 7. 확인된 미해결/추가 확인 지점

- `SelectScreen`의 슬롯 생성/정렬/삭제 흐름은 이번 문서에서 메인 분석 축으로 깊게 추적하지 않았다.
- 채팅/Ably/Supabase 경계는 메인 게임 루프 분석 범위 밖으로 두었다.
- `repositories` 디렉터리는 현재 런타임 비중이 낮아 구조 메모 수준으로만 반영했다.

즉 이번 문서는 "게임 런타임 구조와 저장 경계"를 우선 정리한 구조 분석 문서다.

---

## 결론

현재 구조는 "상태 분리 자체는 진행됐지만 최종 조립과 영속성 제어는 여전히 `Game.jsx`와 `useGameData`에 강하게 집중된 구조"다.

가장 중요한 구조 포인트는 다음 셋이다.

1. `useGameState`가 상태를 소유한다.
2. `useGameData`가 저장과 lazy update 경계를 소유한다.
3. `Game.jsx`가 모든 것을 연결하는 controller로 남아 있다.

따라서 이후 개선 방향을 잡을 때도 먼저 아래 순서로 보는 것이 맞다.

1. `Game.jsx`의 controller 책임 축소
2. `useGameData`와 나머지 Hook 사이의 저장 경계 명확화
3. 문서와 실제 구현 간 저장소/lazy update 설명 동기화
