# Digimon Tamagotchi Frontend 구조 분석 (code-mapper 재확인 기준)

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
- 참고:
  - `code-mapper` 정의 파일은 `/Users/hantaehee/Desktop/파일/개발/codex/subagents/categories/01-core-development/code-mapper.toml`에 존재함
  - 이번 문서는 그 정의의 탐색 기준에 맞춰 실제 호출 경로와 경계만 다시 정리한 구조 분석 메모임
  - 수정은 하지 않았고, 실제 소스 기준으로만 정리함

---

## 1. 실제 호출 흐름

### 1.1 앱 진입

실제 엔트리는 `src/App.jsx`다.

흐름:

1. `App`
2. `AuthProvider`
3. `AppContent`
4. `Router`
5. `/` -> `Login`
6. `/select` -> `SelectScreen`
7. `/game/:slotId` -> `Game`

즉 런타임의 핵심 진입 흐름은 다음이다.

`Login -> SelectScreen -> Game`

`App.jsx`는 주로 인증 컨텍스트, 라우팅, Ably 채팅 컨텍스트, GA 페이지뷰를 붙이는 조립 레이어다.

### 1.2 슬롯 진입 전 흐름

`SelectScreen.jsx`는 슬롯 목록과 생성/삭제/정렬을 직접 Firestore에서 처리한다.

실제 경로:

1. `useAuth()`로 `currentUser`, `isFirebaseAvailable` 확인
2. `users/{uid}/slots` 조회
3. 슬롯 메타데이터 로컬 상태화
4. 새 슬롯 생성 또는 기존 슬롯 선택
5. `/game/:slotId`로 이동

여기서 Repository 계층은 사용되지 않는다.

### 1.3 게임 진입 후 메인 흐름

`Game.jsx`가 실제 게임 런타임의 오케스트레이터다.

실제 배선 순서:

1. `slotId`, `currentUser`, `isFirebaseAvailable` 확인
2. `useGameState()`로 핵심 React 상태 생성
3. 슬롯 버전에 따라 데이터맵 선택
   - `digimonDataForSlot`: adapted 맵
   - `evolutionDataForSlot`: 원본 v1/v2 데이터 맵
4. `useGameData()`로 슬롯 로드/저장/lazy update 함수 주입
5. 1초 타이머 및 수면/진화 버튼/조그레스 구독 effect 설정
6. `useGameActions`, `useEvolution`, `useDeath`, `useGameAnimations`, `useFridge`, `useArenaLogic`, `useGameHandlers` 연결
7. `GameScreen`, `ControlPanel`, `GameModals`에 최종 props 전달

정리하면:

`Game -> useGameState -> useGameData -> domain hooks -> UI components`

### 1.4 사용자 액션의 표준 경로

대부분의 액션은 아래 흐름을 따른다.

1. UI 이벤트 (`ControlPanel`, `GameModals`)
2. 대응 Hook (`useGameActions`, `useEvolution`, `useGameHandlers` 등)
3. `applyLazyUpdateBeforeAction()`
4. 규칙 계산 및 로그 생성
5. `setDigimonStatsAndSave()`
6. Firestore 슬롯 문서 및 서브컬렉션 반영

즉 액션 기준의 실질 영속성 진입점은 `useGameData`가 제공하는 `saveStats`, `applyLazyUpdateForAction`이다.

---

## 2. 상태 관리 경계

### 2.1 `useGameState`가 소유하는 상태

`useGameState`는 현재 프로젝트의 주 상태 저장소다.

주요 상태 묶음:

- `gameState`
  - `selectedDigimon`
  - `digimonStats`
  - `activityLogs`
  - 슬롯 정보
  - 퀘스트/배틀/시즌 상태
- `modals`
  - 거의 모든 모달/팝업 플래그
- `flags`
  - 개발자 옵션
  - 진화 무시
  - 로딩 상태
  - 사망 팝업 여부
  - 수면 관련 플래그
- `ui`
  - 현재 애니메이션
  - 배경 설정
  - 스프라이트 크기
  - 먹이/청소/치료 단계
  - 수면/조명 표시

중요한 점은 `useGameState`가 상태 소유자이지 저장 경계는 아니라는 것이다.

### 2.2 `Game.jsx`가 직접 들고 있는 보조 상태

`Game.jsx`에는 페이지 전용 보조 상태가 남아 있다.

- 모바일 여부
- 프로필 메뉴
- 계정 설정 모달
- 테이머명
- 업적 목록
- 상태 상세 메시지
- 온라인 조그레스 상태

즉 상태가 완전히 `useGameState` 하나로 수렴한 구조는 아니다.

### 2.3 `useGameData`의 상태/영속성 경계

`useGameData`는 setter들을 주입받아 다음을 수행한다.

- 슬롯 로드
- Firestore 저장
- 로그 서브컬렉션 append
- 배경 설정 저장
- lazy update 적용
- death status 감지

즉 현재 구조에서 "React 상태"와 "영속화"의 실제 경계는 `useGameState`와 `useGameData` 사이에 있다.

### 2.4 여전히 `Game.jsx`에 남아 있는 제어 책임

중요한 구조 포인트는 `Game.jsx`가 아직도 아래를 직접 한다는 점이다.

- 1초 UI 타이머
- 수면 상태 재계산
- 진화 버튼 활성화 계산
- 일부 Firestore 직접 저장
- onSnapshot 구독
- props 조립

즉 Hook 분해는 되어 있지만 controller 책임은 페이지에 많이 남아 있다.

---

## 3. 저장소 경계 (Firebase / localStorage / repositories)

### 3.1 실제 슬롯 저장소는 Firebase

현재 실제 게임 경로는 Firebase 중심이다.

근거:

- `Game.jsx`: Firebase 사용 불가 또는 비로그인 시 `/`로 이동
- `SelectScreen.jsx`: 동일하게 로그인 전제
- `useGameData`: 슬롯 로드/저장 모두 Firestore 직접 호출

실제 경로:

- 슬롯 문서: `users/{uid}/slots/slot{slotId}`
- 활동 로그: `users/{uid}/slots/slot{slotId}/logs`
- 배틀 로그: `users/{uid}/slots/slot{slotId}/battleLogs`

### 3.2 localStorage가 남아 있는 실제 범위

현재 localStorage는 슬롯 영속성보다는 보조 UI 설정 저장소다.

남아 있는 대표 항목:

- 스프라이트 크기 설정
- developer mode
- encyclopedia question mark 설정
- ignore evolution time 설정
- `clearedQuestIndex`

즉 localStorage는 "보조 UI/개발자 설정 계층"으로 보는 것이 맞다.

### 3.3 AuthContext의 graceful degradation과 실제 page 경로의 차이

`AuthContext`는 Firebase가 없으면 로딩만 해제하는 graceful degradation 흔적이 있다.

하지만 실제 주요 페이지는 다음과 같다.

- `SelectScreen`: Firebase 없거나 사용자 없으면 `/`
- `Game`: Firebase 없거나 사용자 없으면 `/`

즉 문서상 dual-storage 설명과 달리, 실제 주 경로는 Firebase-only에 가깝다.

### 3.4 Repository 계층의 실제 위치

`src/repositories/SlotRepository.js`는 스스로 다음을 밝힌다.

- localStorage 모드 제거
- Firebase만 사용
- 실제 코드에서는 직접 사용하지 않음

즉 `repositories`는 현재 런타임의 실사용 경계가 아니라 보존된 추상화 흔적이다.

---

## 4. `src/data/v1`와 실제 소비 관계

### 4.1 원본 기준 데이터

`src/data/v1/digimons.js`는 구조화된 디지몬 원본 데이터다.

여기에는 다음이 들어 있다.

- 디지몬 ID / 이름 / stage / sprite
- `stats`
- `evolutionCriteria`
- `evolutions`

즉 "도메인 데이터의 기준 소스" 역할이다.

### 4.2 런타임 호환 데이터

`src/data/v1/adapter.js`는 새 구조를 옛 런타임 포맷으로 바꾼다.

`Game.jsx`는 두 맵을 함께 쓴다.

- `digimonDataForSlot`: adapted 맵
  - 스탯 엔진, UI, 일부 Hook용
- `evolutionDataForSlot`: 원본 맵
  - 진화/이름/도감/표시명 계산용

즉 현재 소비 구조는 "원본 + adapted 이중 데이터맵"이다.

---

## 5. lazy update 적용 지점

### 5.1 로드 시 적용

`useGameData.loadSlot()`에서 저장된 `digimonStats`를 읽은 뒤,

- `lastSavedAt` 계산
- `sleepSchedule`, `maxEnergy` 계산
- `applyLazyUpdate(savedStats, lastSavedAt, sleepSchedule, maxEnergy)`

를 적용한다.

즉 슬롯 입장 시 이미 한 번 lazy update가 들어간다.

### 5.2 액션 직전 적용

`useGameData.applyLazyUpdateForAction()`가 액션 전 표준 진입점이다.

흐름:

1. 슬롯 문서 재조회
2. `lastSavedAt` 확보
3. 메모리의 현재 `digimonStats`에 `applyLazyUpdate(...)`
4. 새 로그를 서브컬렉션 반영
5. 사망 상태 감지
6. 업데이트된 스탯 반환

이 함수가 `Game.jsx`에서 `applyLazyUpdateBeforeAction`으로 주입된다.

### 5.3 저장 직전 재적용

`useGameData.saveStats()`는 새 시작이 아닌 경우, 저장 직전에 다시 `applyLazyUpdateForAction()`를 호출한다.

즉 액션 Hook에서 이미 액션 전 lazy update를 호출하더라도, 최종 persist는 `useGameData`가 다시 방어적으로 맞춘다.

### 5.4 1초 타이머는 lazy update 본체가 아님

`Game.jsx`의 1초 타이머는 `applyLazyUpdate`를 직접 호출하지 않는다.

대신 아래 조합으로 메모리/UI 상태만 갱신한다.

- `updateLifespan`
- `handleHungerTick`
- `handleStrengthTick`
- `handleEnergyRecovery`

즉 이 타이머는 "실시간 UI 보정용 증분 엔진"이다.

### 5.5 타이머에서도 예외 저장은 있음

완전한 무저장은 아니다.

다음 경계 이벤트에서는 예외적으로 저장이 들어간다.

- 사망 발생
- `lastHungerZeroAt` / `lastStrengthZeroAt` 변경
- 케어미스 deadline 변경
- 케어미스 증가
- 똥 8개 부상 발생

즉 저장 원칙은 "연속 저장 금지 + 경계 상태만 예외 저장"이다.

---

## 6. 핵심 owning path 요약

### 6.1 진입과 페이지 소유

- `src/App.jsx`
  - 라우팅, 인증 컨텍스트, Ably, GA
- `src/pages/SelectScreen.jsx`
  - 슬롯 목록/생성/삭제/이동
- `src/pages/Game.jsx`
  - 전체 게임 오케스트레이션

### 6.2 상태 소유

- `src/hooks/useGameState.js`
  - 핵심 React 상태

### 6.3 영속성 소유

- `src/hooks/useGameData.js`
  - Firestore 로드/저장, subcollection append, lazy update 경계

### 6.4 규칙 소유

- `src/logic/*`
  - 순수 규칙 일부
- `src/data/stats.js`
  - 실제 lazy update 기준 구현 중 하나
- `src/data/v1/*`
  - 구조화된 기준 데이터

### 6.5 비활성/약한 경계

- `src/repositories/*`
  - 현재 실사용 저장소 경계 아님

---

## 7. 구조적으로 가장 중요한 분기점

### 7.1 버전 분기

`slotVersion`에 따라 다음이 갈린다.

- v1 / v2 adapted 맵
- v1 / v2 원본 진화 데이터
- 초기 디지타마 ID

즉 버전은 데이터 경로 전체에 영향을 주는 핵심 branch다.

### 7.2 저장소 모드 분기

문서상 존재하는 듯 보이지만, 실제 플레이 경로에서는 거의 사라진 분기다.

- AuthContext 레벨에는 흔적이 남음
- SelectScreen / Game / useGameData 경로는 Firebase 전제

### 7.3 규칙 엔진 분기

시간 기반 규칙은 완전히 한 파일에 수렴하지 않는다.

- `data/stats.js`
- `logic/stats/stats.js`
- `logic/stats/hunger.js`
- `logic/stats/strength.js`
- `Game.jsx`의 실시간 타이머 조합

즉 시간 기반 동작은 "단일 소스"보다 "분산 엔진"에 가깝다.

---

## 결론

현재 프로젝트의 실제 구조는 다음으로 요약하는 것이 가장 정확하다.

> `App -> SelectScreen -> Game` 경로 위에서, `Game.jsx`가 `useGameState`와 `useGameData`를 중심으로 여러 도메인 Hook를 조립하고, 실제 영속성은 Firestore 직접 호출에 의존하며, lazy update는 load / action 전 / save 직전 / 경계 이벤트 저장으로 분산 적용되는 구조다.

즉 문서상 설명과 달리 현재 런타임은:

- Firebase 중심
- Repository 비실사용
- localStorage는 보조 설정용
- `Game.jsx` 중심 오케스트레이션
- `data/v1 원본 + adapted 맵` 이중 데이터 소비
- `useGameData` 중심 영속성 경계
- `data/stats + logic/stats + timer` 혼합 시간 엔진

으로 이해하는 것이 가장 가깝다.
