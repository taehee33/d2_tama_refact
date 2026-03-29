# digimon-tamagotchi-frontend 아키텍처 리뷰

작성일: 2026-03-29

## 리뷰 기준

- 대상 프로젝트: `digimon-tamagotchi-frontend`
- 중점 범위:
  - `/src/pages/Game.jsx` 비대화
  - `useGameState`, `useGameData`, `useGameActions`, `useGameLogic`, `useGameHandlers`, `useGameAnimations`, `useEvolution`, `useDeath`, `useArenaLogic` 책임 분리
  - `logic` 계층과 UI 계층의 경계
  - `repositories` 패턴의 일관성
  - Firebase와 localStorage 이중 저장소 지원 구조
- 참고:
  - `architect-reviewer` 전용 스킬은 이 세션에 없어, 실제 소스 추적으로 동일 목적의 구조 리뷰를 수행했다.

---

## 결론 요약

현재 구조는 "Hook를 많이 나눴지만 아키텍처 경계는 오히려 더 흐려진 상태"에 가깝다.

가장 큰 문제는 다음 네 가지다.

1. 문서상 아키텍처와 실제 런타임 아키텍처가 다르다.
2. `Game.jsx`가 여전히 실질적인 애플리케이션 서비스 레이어 역할을 한다.
3. Hook 분리는 책임 분리가 아니라 사이드이펙트 분산에 가까워졌다.
4. `logic` / `data` / `hooks` / Firestore 직접 접근이 섞이면서 규칙 수정 지점이 분산됐다.

---

## 우선순위 높은 구조 문제

### P1. 문서화된 `dual-storage + repository` 구조가 런타임에서 이미 깨져 있다

프로젝트 문서와 `AGENTS.md`는 Firebase와 localStorage를 모두 지원하는 저장소 추상화 구조를 전제로 설명한다. 하지만 실제 런타임은 거의 Firebase 로그인 필수 구조다.

- `AuthContext`는 Firebase 미설정 시 localStorage 모드를 암시한다.
- 그러나 `Game.jsx`, `SelectScreen.jsx`, `useGameData.js`는 Firebase 또는 로그인 사용자가 없으면 실제 게임 경로를 차단한다.
- `repositories` 문서는 저장소 전환 가능한 구조처럼 설명하지만, 실제 구현 파일은 "실제 코드는 repository를 직접 사용하지 않는다"고 명시한다.
- 코드 검색 기준으로 `slotRepository`, `userSlotRepository`는 실사용 경로에서 참조되지 않는다.

이 상태의 장기 리스크는 명확하다.

- 신규 기능 설계자가 "localStorage도 같이 지원된다"는 잘못된 전제를 믿게 된다.
- 저장소 관련 버그가 생겨도 실제 소유 경계를 바로 찾기 어렵다.
- 문서, 리포지토리, 런타임 구현이 서로 다른 아키텍처를 말하게 된다.

즉, 지금은 "이중 저장소를 지원하는 시스템"이 아니라 "Firebase 중심 시스템 + 일부 localStorage 캐시"에 더 가깝다.

---

### P1. `Game.jsx`가 여전히 비대한 오케스트레이터를 넘어서 실질적인 서비스 레이어다

`Game.jsx`는 단순 페이지 컴포넌트가 아니다. 실제로는 아래 역할을 한 파일에서 모두 수행한다.

- 핵심 상태 구조 분해
- `useGameData` 연결과 저장 함수 주입
- 1초 타이머 기반 실시간 상태 갱신
- 사망 판정, 케어미스, 콜, 수면 상태 처리
- 탭 이탈 저장
- Firestore 직접 쓰기
- 환생/초기화 흐름
- online jogress 실시간 구독
- 최종 handlers/data/ui 조합 후 하위 컴포넌트로 전달

Hook가 많아졌지만, 핵심 정책 결정은 여전히 `Game.jsx`에 남아 있다. 결과적으로 기능 추가 시 다음 패턴이 반복된다.

- `Game.jsx` 수정
- 관련 Hook 1~3개 수정
- 저장/로그/애니메이션 동기화 수정

이 구조는 기능이 늘수록 변경 포인트가 선형이 아니라 복합적으로 증가한다.

---

### P1. Hook 사이 책임 분리가 아니라 사이드이펙트가 분산되어 있다

Hook 이름만 보면 책임이 나뉘어 보이지만, 실제로는 경계가 많이 겹친다.

#### `useGameData`

- 저장/로딩 Hook이지만 sibling hook 유틸에 의존한다.
- `getSleepSchedule`을 `useGameHandlers`에서 가져온다.
- 사망 감지와 모달 제어까지 일부 포함한다.

즉, persistence 계층인데 UI/도메인 계산을 함께 안고 있다.

#### `useGameActions`

- 사용자 액션 처리 외에도 배틀 결과에 따라 Firestore를 직접 갱신한다.
- 수면 방해, 로그 생성, 애니메이션 단계, 경고 alert, 저장 호출이 하나의 흐름에 묶여 있다.

즉, action + domain + UI reaction + persistence가 한곳에 섞여 있다.

#### `useGameAnimations`

- 애니메이션 Hook이지만 실제 게임 상태 변경과 저장까지 수행한다.
- `wakeForInteraction`을 `useGameActions`에서 가져오고, 수면 유틸은 `useGameHandlers`에서 가져온다.

즉, animation 레이어가 다른 Hook의 도메인 함수를 재조합하고 있다.

#### `useGameHandlers`

- 이벤트 핸들러 Hook이지만 `setDigimonStatsAndSave` 이후 Firestore를 한 번 더 직접 갱신하는 경로가 있다.
- 조명 토글은 상태 변경, 로그, save, Firestore 직접 update를 모두 포함한다.

즉, orchestration이 아니라 저장 정책까지 중복 소유한다.

#### `useEvolution`

- 순수 진화 판정만 맡지 않는다.
- Firestore batch, jogress room 생성/취소, encyclopedia 갱신, alert, modal 제어, local state 갱신까지 같이 한다.

즉, evolution domain service라기보다 작은 애플리케이션 서브시스템에 가깝다.

#### `useDeath`

- 죽음 Hook이 존재하지만 실제 사망 판정은 `Game.jsx`, `useGameData`, `useDeath`에 나뉘어 있다.
- `useDeath`는 환생/사망 확정 쪽 비중이 크고, 사망 검출의 단일 진입점은 아니다.

이런 구조에서는 Hook를 개별적으로 교체하거나 테스트 더블로 대체하기가 어렵다.

---

### P1. `logic` 계층과 UI 계층의 경계가 일관되지 않다

이 프로젝트는 `/logic`에 순수 비즈니스 로직이 있어야 한다는 방향을 갖고 있다. 실제로 일부는 잘 지켜진다.

- 진화 판정은 `logic/evolution/checker.js`에 잘 위치한다.
- 배고픔/힘 틱 일부는 `logic/stats/hunger.js`, `logic/stats/strength.js`에 있다.

하지만 핵심 규칙 배치는 일관되지 않다.

- 수면 상태, 로그 생성, 호출 타임아웃 관련 유틸은 `hooks/useGameLogic.js`에 있다.
- `Game.jsx`는 hook utility를 직접 import해서 타이머 도메인 로직에 사용한다.
- Hook 내부에는 `alert`, `toggleModal`, `setTimeout`, Firestore write가 함께 섞여 있다.

결과적으로 현재 계층은 이렇게 느껴진다.

- `logic`: 일부 순수 규칙
- `hooks`: 순수 유틸 + orchestration + persistence + UI reaction 혼합
- `pages/Game.jsx`: 최종 서비스 레이어

이 구조에서는 "도메인 규칙 하나를 바꾸려면 어디를 봐야 하는가?"가 명확하지 않다.

---

### P2. 핵심 스탯 엔진이 중복되어 규칙 드리프트 위험이 크다

가장 눈에 띄는 구조 리스크 중 하나는 스탯 엔진 중복이다.

- `src/data/stats.js`
- `src/logic/stats/stats.js`

두 파일 모두 다음 개념을 가진다.

- `initializeStats`
- `applyLazyUpdate`
- `updateLifespan`
- 에너지 회복 관련 로직

실제 사용도 섞여 있다.

- `useGameData`는 `data/stats.js`의 `applyLazyUpdate`를 쓴다.
- `Game.jsx`는 `data/stats.js`의 `initializeStats`, `updateLifespan`을 쓰면서, `logic/stats/stats.js`의 `handleEnergyRecovery`를 같이 쓴다.

이 상태의 문제는 단순 중복보다 더 크다.

- 규칙 변경 시 두 엔진이 다르게 진화할 수 있다.
- lazy update와 realtime tick 사이 규칙 차이가 누적될 수 있다.
- 버그 수정이 "한쪽만 고쳐서 다른 쪽은 남는" 형태로 반복될 위험이 높다.

장기 유지보수 기준에서는 이 부분이 반드시 단일화 대상이다.

---

### P2. localStorage는 대체 저장소가 아니라 필드별 캐시로 흩어져 있다

현재 localStorage는 게임 저장소 대체 구현이라기보다 각종 UI/설정 캐시에 가깝다.

- sprite 크기
- developer mode
- encyclopedia question mark 표시
- ignoreEvolutionTime
- `clearedQuestIndex`
- 일부 컴포넌트 접힘 상태

반면 핵심 슬롯 로딩/저장은 Firebase 중심이다.

문제는 localStorage의 역할이 구조로 정의되지 않았다는 점이다.

- 무엇이 계정 동기화 대상인지
- 무엇이 디바이스 로컬 설정인지
- 무엇이 슬롯별 캐시인지
- 무엇이 legacy 흔적인지

이 경계가 문서가 아니라 구현 세부에 숨어 있다. 그래서 향후 설정 하나를 추가할 때도 "이건 Firebase에 넣어야 하나, localStorage에 넣어야 하나"가 매번 새로 판단된다.

---

## 세부 관찰

### `useGameState`의 위치

`useGameState`는 그나마 역할이 비교적 분명하다.

- React state 보관
- modal 상태 관리
- 일부 localStorage 기반 UI 설정 관리

하지만 `width/height` 저장이 `useGameState`와 `Game.jsx` 양쪽에 나타나고, background 설정 주석은 localStorage/Firebase 이중 모드를 전제로 남아 있어 실제 구조와 설명 사이에 틈이 있다.

### `repositories` 패턴

가장 일관성이 낮은 부분 중 하나다.

- 폴더는 존재한다.
- 문서도 있다.
- 구현체도 있다.
- 하지만 실제 핵심 경로에서는 쓰지 않는다.

즉, repository는 "아키텍처 자산"이 아니라 "남아 있는 설계 흔적"에 가깝다. 유지할 거면 실제 진입점에서 써야 하고, 유지하지 않을 거면 문서와 코드에서 정리해야 한다.

### `useArenaLogic`의 분리 수준

이 Hook은 이름상 아레나 로직 전담처럼 보이지만 실제로는 아레나 설정 로드와 UI 진입 제어만 담당한다. 실제 아레나 결과 반영, 전적 갱신, 로그 적재는 `useGameActions`에 있다. 이름 대비 책임이 너무 얇고, 실제 도메인 경계와도 맞지 않는다.

### `useDeath`의 분리 수준

죽음 관련 Hook가 존재하지만, 사망 상태 검출이 단일화되어 있지 않다. 실시간 타이머, lazy update 후 체크, death hook 내부 조건 함수가 모두 존재하므로 장기적으로는 death rule 변경 시 누락 위험이 있다.

---

## 장기 유지보수 관점의 핵심 리스크

### 1. 변경 포인트가 너무 많다

기능 하나를 바꾸면 페이지, Hook, 저장 경계, 로그 경계, 애니메이션 경계가 같이 움직인다.

### 2. 구조가 이름과 다르게 동작한다

`repository`, `localStorage mode`, `logic layer`, `arena logic` 같은 이름이 실제 책임과 맞지 않는 경우가 많다.

### 3. 규칙이 중복되어 일관성 유지가 어렵다

특히 stats/lazy update/death/sleep 계산이 분산되어 있다.

### 4. 테스트 가능한 순수 경계가 적다

도메인 규칙이 Hook와 UI reaction 안으로 들어와 있어서 단위 테스트 범위를 잡기 어렵다.

### 5. 문서와 런타임이 다르다

새 기여자가 가장 먼저 잘못 이해할 가능성이 높다.

---

## 가장 먼저 정리해야 할 구조 결정

이 프로젝트는 우선 아래 두 가지를 먼저 확정해야 한다.

### 1. 저장소 전략 확정

둘 중 하나를 명확히 골라야 한다.

- 진짜 dual-storage를 유지한다.
- 공식적으로 Firebase-only로 전환한다.

지금처럼 "문서상 dual-storage, 런타임상 Firebase-only" 상태가 가장 유지보수 비용이 크다.

### 2. `Game.jsx`를 더 쪼개기 전에 경계부터 재정의

단순히 Hook를 더 늘리는 식으로는 같은 문제가 반복될 가능성이 높다. 다음 단계는 파일 분할보다 경계 재정의가 먼저다.

예시로는 이런 식의 방향이 더 적절하다.

- `GameSession`: 화면이 쓰는 application service
- `GamePersistence` 또는 `StoragePort`: 저장/로드/로그 append 경계
- `GameRules`: 순수 도메인 규칙
- `RealtimeRuntime`: 1초 타이머와 UI 반영 전용 경계

즉, "무엇을 하는 파일인가"보다 "어느 계층 책임을 가지는가"를 먼저 정해야 한다.

---

## 최종 요약

현재 프로젝트는 컴포넌트 분해는 많이 진행됐지만, 아키텍처 분해는 아직 미완성 상태다.

특히 장기 리스크가 큰 부분은 다음 순서다.

1. 문서와 실제 런타임 저장소 구조 불일치
2. `Game.jsx` 비대화와 서비스 레이어 집중
3. Hook 간 책임 중복과 직접 Firestore 접근 분산
4. `logic` 계층과 UI/orchestration 계층의 경계 혼합
5. stats/lazy update 규칙 중복

한 줄로 압축하면, 이 코드는 "Hook가 많은 구조"이지 아직 "경계가 선명한 구조"는 아니다.
