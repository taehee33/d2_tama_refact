# digimon-tamagotchi-frontend 구조 분석

작성일: 2026-03-29

## 분석 기준

- 대상 경로: `digimon-tamagotchi-frontend`
- 중점 파일:
  - `src/App.jsx`
  - `src/pages/Game.jsx`
  - `src/hooks`
  - `src/logic`
  - `src/repositories`
  - `src/data/v1`
- 주의:
  - 요청은 `code-mapper` 기반 분석이었지만, 현재 워크스페이스에는 `code-mapper` 실행 파일이 존재하지 않았습니다.
  - 따라서 실제 소스 코드의 import/호출 흐름과 상태 전달 구조를 직접 추적하는 방식으로 분석했습니다.

---

## 1. 전체 진입 흐름

애플리케이션의 실제 라우팅 진입점은 `src/App.jsx`입니다.

흐름은 아래와 같습니다.

1. `App`
2. `AuthProvider`
3. `AppContent`
4. `Router`
5. `/` -> `Login`
6. `/select` -> `SelectScreen`
7. `/game/:slotId` -> `Game`

즉, 런타임의 실제 게임 진입 흐름은 다음으로 보는 것이 가장 정확합니다.

`Login -> SelectScreen -> Game`

`App.jsx`는 직접 게임 로직을 갖고 있지 않고, 인증 컨텍스트와 라우팅, Ably 채팅 컨텍스트를 연결하는 얇은 조립 계층입니다.

---

## 2. 상위 페이지별 역할

### 2.1 `App.jsx`

- 인증 컨텍스트 제공
- 라우팅 분기
- Ably 채팅 래핑
- GA 페이지뷰 추적

핵심 포인트는 `App.jsx`가 비즈니스 로직을 거의 갖고 있지 않고, 페이지 단위 진입 제어만 담당한다는 점입니다.

### 2.2 `Login.jsx`

- Firebase Auth 로그인
- 로그인 성공 시 `users/{uid}` 문서 저장 또는 갱신

즉, 계정 루트 문서 생성의 시작점입니다.

### 2.3 `SelectScreen.jsx`

- `users/{uid}/slots` 컬렉션에서 슬롯 목록 직접 조회
- 새 슬롯 생성
- 슬롯 메타데이터 수정
- 슬롯 삭제 및 정렬
- `/game/:slotId`로 이동

중요한 점은 이 페이지가 Repository 계층을 쓰지 않고 Firestore를 직접 다룬다는 것입니다.

### 2.4 `Game.jsx`

이 파일이 사실상 전체 게임 런타임의 오케스트레이터입니다.

역할은 다음과 같습니다.

- 슬롯별 게임 상태 주입
- 데이터 로드/저장 연결
- 실시간 UI 타이머 운영
- 도메인 Hook 연결
- 화면 컴포넌트에 props 전달
- 일부 Firestore 직접 저장 처리

---

## 3. `Game.jsx` 중심 실제 호출 흐름

`Game.jsx`에서의 실제 흐름은 아래 순서로 이해하면 됩니다.

1. URL에서 `slotId` 획득
2. `useAuth()`로 `currentUser`, `isFirebaseAvailable` 확인
3. `useGameState()`로 모든 React 상태 생성
4. 슬롯 버전에 따라 두 종류의 데이터맵 구성
   - `digimonDataForSlot`: 어댑터를 거친 호환 맵
   - `evolutionDataForSlot`: 원본 구조화 데이터 맵
5. `useGameData()`로 슬롯 로드/저장/lazy update 함수 주입
6. 나머지 도메인 Hook들에 상태와 저장 함수를 주입
7. `GameScreen`, `ControlPanel`, `GameModals`로 렌더링 데이터 전달

정리하면 다음과 같습니다.

`Game -> useGameState -> useGameData -> domain hooks -> UI components`

---

## 4. 상태 관리 경계

### 4.1 `useGameState`

`useGameState`는 순수하게 React 상태를 생성하고 묶는 역할입니다.

상태는 크게 네 묶음입니다.

- `gameState`
  - `selectedDigimon`
  - `digimonStats`
  - `activityLogs`
  - 슬롯 정보
  - 퀘스트/배틀/시즌 상태
- `modals`
  - 모든 모달 open/close 상태를 객체 하나로 관리
- `flags`
  - 개발자 모드
  - 진화 무시 옵션
  - 로딩 상태
  - 사망 팝업 상태
  - 수면 관련 플래그
- `ui`
  - 현재 애니메이션
  - 배경 설정
  - 화면 크기
  - 먹이/청소/치료 단계
  - 진화 연출 상태
  - 조명/수면 표시 상태

중요한 점은 `useGameState`가 슬롯 저장을 직접 하지 않는다는 것입니다.

`useGameState`는 상태 소유자이고, 저장 경계는 아닙니다.

### 4.2 `Game.jsx`의 보조 상태

`Game.jsx` 자체에도 일부 로컬 상태가 있습니다.

- 모바일 여부
- 프로필 메뉴
- 계정 설정 모달
- 테이머명
- 업적
- 상태 상세 메시지
- 온라인 조그레스 상태

즉, `useGameState`가 모든 상태를 다 갖는 구조는 아니고, 페이지 전용 UI 상태는 `Game.jsx`에 남아 있습니다.

---

## 5. 저장소 경계(Firebase/localStorage)

### 5.1 실제 런타임 기준 저장소

문서와 주석에는 Firebase/localStorage 이중 모드 설명이 많이 남아 있지만, 현재 실제 게임 경로는 Firebase 중심입니다.

그 근거는 아래와 같습니다.

- `Game.jsx`에서 Firebase가 없거나 로그인 사용자가 없으면 `/`로 이동
- `SelectScreen.jsx`도 동일하게 Firebase 로그인 전제를 가짐
- `useGameData`는 저장/로드 모두 Firestore 직접 호출

즉, 현재 게임 슬롯의 실제 영속성 경계는 다음 Firestore 구조입니다.

- 슬롯 문서: `users/{uid}/slots/slot{slotId}`
- 활동 로그: `users/{uid}/slots/slot{slotId}/logs`
- 배틀 로그: `users/{uid}/slots/slot{slotId}/battleLogs`

### 5.2 localStorage가 실제로 남아 있는 범위

현재 localStorage는 게임 슬롯 저장소라기보다 보조 UI 설정 저장소로 남아 있습니다.

남아 있는 항목은 대체로 아래입니다.

- 스프라이트 크기 설정
- developer mode
- encyclopedia question mark 설정
- ignore evolution time 설정
- clearedQuestIndex

즉, localStorage는 현재 "슬롯 데이터 저장소"가 아니라 "UI/편의 설정 저장소"에 가깝습니다.

### 5.3 Repository 계층의 실제 상태

`src/repositories`에는 `SlotRepository.js`, `UserSlotRepository.js`가 존재하지만, 현재 런타임에서 핵심 경로로 사용되지 않습니다.

실제 코드 흐름은 Repository를 거치지 않고 아래처럼 직접 Firebase를 호출합니다.

- `SelectScreen.jsx`
- `useGameData.js`
- `useGameActions.js`
- `useGameHandlers.js`
- `useEvolution.js`
- `useEncyclopedia.js`

즉, 현재 저장소 경계는 "Repository 패턴"이 아니라 "Hook/Page 내부의 직접 Firestore 호출"입니다.

---

## 6. `useGameData`가 담당하는 실제 경계

`useGameData`는 현재 코드베이스에서 가장 중요한 데이터 영속성 Hook입니다.

역할은 크게 네 가지입니다.

1. 슬롯 로드
2. 스탯 저장
3. 액션 전 lazy update 적용
4. 로그 서브컬렉션 append

### 6.1 슬롯 로드 흐름

`loadSlot`의 실제 흐름은 아래와 같습니다.

1. `users/{uid}/slots/slot{slotId}` 조회
2. 슬롯 메타데이터를 각 상태 setter로 반영
3. `logs`, `battleLogs` 서브컬렉션 로드
4. 저장된 `digimonStats`를 메모리로 가져옴
5. `applyLazyUpdate(...)` 적용
6. 최종 스탯을 `setDigimonStats`로 hydrate

즉, 슬롯에 들어올 때 이미 lazy update가 한 번 적용됩니다.

### 6.2 `saveStats`

`saveStats`는 저장 직전에 다음을 수행합니다.

- 필요 시 다시 `applyLazyUpdateForAction()` 호출
- 로그 배열 정리
- `lastSavedAt` 갱신
- `digimonStats`와 루트 필드(`isLightsOn`, `wakeUntil`, `updatedAt`) 분리 저장
- `proteinCount` 제거 마이그레이션 처리

즉, 저장 함수가 단순 persist가 아니라 "최종 정합성 조정 + persist" 역할을 합니다.

### 6.3 `applyLazyUpdateForAction`

이 함수는 각 액션 전에 호출되는 표준 진입점입니다.

흐름은 다음과 같습니다.

1. 현재 슬롯 문서 조회
2. `lastSavedAt` 확보
3. 현재 메모리의 `digimonStats`에 `applyLazyUpdate(...)` 적용
4. 과거 재구성 과정에서 생긴 새 로그를 서브컬렉션에 반영
5. 사망 상태 변경 감지
6. 업데이트된 스탯 반환

즉, "액션을 수행하기 전 현재 시간을 따라잡는 함수"입니다.

---

## 7. 도메인 Hook별 책임

### 7.1 `useGameActions`

사용자 액션의 중심입니다.

담당 기능:

- 먹이
- 훈련
- 똥 청소
- 배틀 결과 처리

공통 패턴은 거의 동일합니다.

1. `applyLazyUpdateBeforeAction()`
2. 필요 시 수면 방해 처리
3. 순수 로직 실행
4. 로그 추가
5. `setDigimonStatsAndSave(...)`

순수 로직 의존성은 다음과 같습니다.

- `logic/food/meat`
- `logic/food/protein`
- `logic/battle/calculator`
- 훈련 데이터

하지만 아레나 결과 저장은 이 Hook이 Firestore를 직접 업데이트합니다.

즉, "도메인 계산 + 일부 외부 저장"이 섞여 있습니다.

### 7.2 `useEvolution`

담당 기능:

- 진화 버튼 처리
- 진화 조건 판정
- 진화 실행
- 로컬 조그레스
- 온라인 조그레스 방 생성/취소/완료
- 도감 업데이트

핵심 흐름은 다음과 같습니다.

1. `applyLazyUpdateBeforeAction()`
2. `logic/evolution/checker`로 진화 가능 여부 판단
3. `initializeStats(...)`로 다음 폼 스탯 초기화
4. 로그 추가
5. `updateEncyclopedia(...)`
6. `setDigimonStatsAndSave(...)`
7. `setSelectedDigimonAndSave(...)`

이 Hook은 조그레스 관련 Firestore 컬렉션도 직접 다룹니다.

- `jogress_rooms`
- `jogress_logs`
- 상대 슬롯 문서

### 7.3 `useDeath`

담당 기능:

- 사망 확정
- 오하카다몬 전환
- 환생/새로운 시작 이전의 사망 처리

흐름은 단순합니다.

1. `applyLazyUpdateBeforeAction()`
2. 사망 폼 결정
3. `initializeStats(...)`
4. 로그 추가
5. 도감 업데이트
6. `setDigimonStatsAndSave(...)`
7. `setSelectedDigimonAndSave(...)`

### 7.4 `useGameHandlers`

이 Hook은 "도메인 계산"보다 "UI 이벤트 연결"에 가깝습니다.

담당 기능:

- 메뉴 클릭
- 퀘스트 시작
- 스파링 선택
- 치료 모달 열기
- 조명 토글
- 로그아웃

다만 `handleToggleLights`는 단순 UI가 아니라 Firestore에 조명 상태를 직접 저장합니다.

### 7.5 `useGameAnimations`

애니메이션 주기를 관리하지만, 실제로는 일부 상태 변경도 여기서 수행합니다.

예를 들어 치료와 청소는 애니메이션 종료 지점에서 상태를 확정하고 저장합니다.

즉, 완전한 뷰 계층은 아니고 "애니메이션 완료 시점의 상태 확정 로직"을 갖는 Hook입니다.

### 7.6 `useArenaLogic`

역할은 비교적 단순합니다.

- 아레나 설정 로드
- 아레나 배틀 시작 상태 세팅
- Admin 설정 반영

실제 승패 기록 반영은 `useArenaLogic`이 아니라 `useGameActions.handleBattleComplete`에서 처리됩니다.

### 7.7 `useFridge`

냉장고 상태 전용 Hook입니다.

공통 패턴은 동일합니다.

1. `applyLazyUpdateBeforeAction()`
2. `isFrozen`, `frozenAt`, `takeOutAt` 변경
3. 로그 추가
4. `setDigimonStatsAndSave(...)`

---

## 8. 순수 로직 계층(`src/logic`)의 실제 위치

### 8.1 실제 사용되는 순수 로직

현재 호출 흐름에서 실제로 핵심적으로 사용되는 순수 로직은 다음입니다.

- `logic/evolution/checker.js`
  - 진화 판정 인터프리터
- `logic/stats/hunger.js`
  - 실시간 타이머에서 배고픔 감소
- `logic/stats/strength.js`
  - 실시간 타이머에서 힘 감소
- `logic/stats/stats.js`
  - `handleEnergyRecovery` 사용
- `logic/food/meat.js`
  - 먹이 계산
- `logic/food/protein.js`
  - 프로틴 계산

### 8.2 중요한 구조적 포인트

`stats` 엔진이 한 군데에만 있지 않습니다.

현재는 두 계층이 공존합니다.

- `src/data/stats.js`
- `src/logic/stats/stats.js`

그리고 실제 사용이 분리되어 있습니다.

- 슬롯 로드/액션 전 lazy update: `src/data/stats.js`
- 실시간 타이머의 에너지 회복: `src/logic/stats/stats.js`

즉, 스탯 엔진이 완전히 단일화되어 있지 않습니다.

이건 현재 구조에서 가장 중요한 관찰 포인트 중 하나입니다.

---

## 9. `src/data/v1`의 실제 역할

### 9.1 `digimons.js`

원본 구조화 데이터입니다.

형태는 아래와 같습니다.

- `id`
- `name`
- `stage`
- `stats`
- `evolutionCriteria`
- `evolutions`

이 데이터는 주로 아래 용도로 쓰입니다.

- 진화 조건 판정
- 한글명 표시
- 도감 기록
- 조그레스 결과 판단

### 9.2 `adapter.js`

기존 런타임과의 호환 레이어입니다.

즉, 원본 v1 데이터는 구조화되어 있지만, 런타임 일부는 아직 옛 필드 구조를 기대합니다.

그래서 아래처럼 변환합니다.

- `stats.hungerCycle` -> `hungerTimer`
- `stats.strengthCycle` -> `strengthTimer`
- `stats.poopCycle` -> `poopTimer`
- `stage` -> `evolutionStage`
- `stats.maxEnergy` -> `maxStamina`

결론적으로 현재 프로젝트는 v1 데이터를 "원본 구조"와 "호환 구조" 두 형태로 동시에 사용합니다.

### 9.3 `defaultStats.js`

v1 기준 기본 스탯 정의입니다.

하지만 실제 런타임 초기화는 `src/data/defaultStatsFile.js`를 사용하는 `src/data/stats.js` 경로도 남아 있습니다.

즉, 기본 스탯 정의도 단일화되어 있지 않습니다.

### 9.4 `quests.js`

퀘스트용 정적 콘텐츠입니다.

이는 `Game.jsx -> useGameHandlers/useGameActions -> BattleScreen` 흐름에서 사용되는 배틀 콘텐츠 데이터입니다.

---

## 10. Lazy Update 적용 지점 정리

현재 lazy update는 아래 지점에서 적용됩니다.

### 10.1 슬롯 로드 시

`useGameData.loadSlot`에서 저장된 슬롯을 메모리로 올리기 전에 적용합니다.

용도:

- 오프라인 경과 시간 보정
- 수면 시간 제외 처리
- 냉장고 시간 제외 처리
- 과거 케어미스/부상/똥 로그 재구성

### 10.2 액션 직전

`useGameData.applyLazyUpdateForAction`가 표준 액션 진입점으로 사용됩니다.

이 함수는 아래 경로에서 재사용됩니다.

- `useGameActions`
- `useEvolution`
- `useDeath`
- `useGameAnimations`
- `useFridge`
- `useGameHandlers.handleHeal`
- `Game.jsx` 내부 `resetDigimon`
- `Game.jsx` 내부 과식 확인/취소

즉, 유저 상호작용 직전에는 거의 항상 lazy update가 먼저 들어갑니다.

### 10.3 저장 직전

`saveStats` 내부에서도 다시 한 번 lazy update를 적용합니다.

따라서 구조적으로는 아래 순서가 됩니다.

`액션 Hook -> applyLazyUpdateBeforeAction -> 상태 변경 -> saveStats -> 내부에서 다시 최종 정합성 보정`

### 10.4 실시간 1초 타이머는 별도

중요:

실시간 타이머는 `applyLazyUpdate`를 쓰지 않습니다.

대신 아래 증분 함수들을 사용합니다.

- `updateLifespan`
- `handleHungerTick`
- `handleStrengthTick`
- `handleEnergyRecovery`
- `checkCalls`
- `checkCallTimeouts`

즉, 현재 구조는 다음처럼 이원화되어 있습니다.

- 경과 시간 따라잡기: lazy update
- 현재 화면의 1초 단위 표시: 실시간 증분 업데이트

### 10.5 완전한 무저장 타이머는 아님

주석상으로는 1초 타이머가 Firestore를 쓰지 않는다고 설명하지만, 실제 구현은 경계 이벤트에서 제한적으로 저장합니다.

예외 저장 지점:

- 사망 발생
- hunger/strength zero timestamp 변화
- 케어미스 데드라인 변화
- 케어미스 증가
- 똥 8개 부상 발생

즉, "연속적인 실시간 저장"은 하지 않지만, "중요 경계 상태 저장"은 합니다.

---

## 11. 실제 아키텍처를 한 줄로 요약하면

현재 `digimon-tamagotchi-frontend`는 아래 구조로 보는 것이 가장 정확합니다.

`App/Route 계층 -> Firebase 인증/슬롯 선택 -> Game 오케스트레이터 -> useGameState(상태 소유) + useGameData(핵심 영속성) -> 도메인 Hook들(액션/진화/죽음/조그레스/아레나/조명/냉장고) -> GameScreen/ControlPanel/GameModals 렌더링`

그리고 데이터는 아래처럼 이중 표현을 사용합니다.

- 원본 구조화 데이터: `src/data/v1/digimons.js`
- 호환 런타임 데이터: `src/data/v1/adapter.js` 결과

마지막으로 저장소 경계는 현재 명목상 Repository 패턴이 아니라, 실제로는 Hook/Page 단의 직접 Firestore 호출 중심 구조입니다.
