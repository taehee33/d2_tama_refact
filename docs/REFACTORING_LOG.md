# 리팩토링 로그

이 문서는 프로젝트의 주요 변경사항을 기록합니다.

---

## [2026-03-29] Idle 이동 타임라인을 Canvas 렌더링 경로에 연결

### 작업 유형
- ✨ 기능 추가
- 🎞️ 애니메이션 렌더링 확장
- 🧪 순수 데이터 테스트 추가
- 🐛 idle 타임라인 리셋 안정화

### 목적 및 영향
- **목적:** 외부 스프라이트 편집기에서 추출한 `F:1~32` idle 이동 시퀀스를 현재 `baseSprite + offset` 구조에 맞춰 실제 게임 Canvas에 붙이기.
- **범위:** 일반 디지몬의 `idle` 상태에서만 이동/반전 타임라인이 적용되며, 먹이주기/거절/수면/부상/사망/냉장고 애니메이션 경로는 기존 동작을 유지한다. 디지타마와 사망 폼은 기존 고정/단순 idle 렌더링을 계속 사용한다.
- **내용:** `src/data/idleMotionTimeline.js`에 `idle_1 -> 0`, `idle_2 -> 1`, `attack_2 -> 7` 매핑과 `F:1~32` 타임라인 상수를 추가하고, `resolveIdleMotionTimeline(baseSprite)` 헬퍼로 현재 스프라이트 번호 체계에 맞게 해석하도록 했다. `Game.jsx`에서는 선택된 디지몬의 `baseSprite` 기준으로 idle 타임라인을 계산해 `GameScreen -> Canvas`로 전달한다. `Canvas.jsx`는 idle 상태에서 타임라인의 `spriteNumber/x/y/flip`을 직접 적용하도록 확장해, 기존 중앙 고정 렌더 대신 이동형 idle 모션을 그릴 수 있게 했다. 추가로 `Canvas` effect 의존성을 배열 identity가 아닌 문자열 key 기준으로 안정화해, `Game.jsx`의 1초 UI 타이머 리렌더 때문에 idle 애니메이션이 매초 `F:1` 근처로 리셋되던 현상을 줄였다. idle 타임라인의 `F` 진행은 `requestAnimationFrame` 횟수 대신 실제 경과 시간 기준으로 바꿔, 주사율과 무관하게 정확히 `0.7초`마다 다음 `F`로 넘어가도록 조정했다. 또한 순수 데이터 테스트를 추가해 slot offset과 baseSprite 해석 결과를 고정했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/components/Canvas.jsx`
- `digimon-tamagotchi-frontend/src/components/GameScreen.jsx`
- `digimon-tamagotchi-frontend/src/data/idleMotionTimeline.js` (신규)
- `digimon-tamagotchi-frontend/src/data/idleMotionTimeline.test.js` (신규)
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `docs/REFACTORING_LOG.md`

### 아키텍처 메모
- 기존 `digimonAnimations.js`의 offset 기반 프레임 정의를 버리지 않고, idle 이동 타임라인만 별도 데이터 계층으로 분리해 현재 sprite sheet 체계와 자연스럽게 결합했다.
- 외부 편집기의 좌표계는 `Canvas` 내부에서 80 기준 가상 스테이지로 환산해 현재 반응형 Canvas 크기에 맞게 적용했다.

---

## [2026-03-29] 디지몬 마스터 데이터 관리자 탭 및 런타임 오버라이드 계층 추가

### 작업 유형
- ✨ 기능 추가
- 🛠️ 데이터 관리 도구 추가
- 🧪 테스트 정리

### 목적 및 영향
- **목적:** 스크린샷 형태의 디지몬 종 데이터 표/편집 화면을 시스템 안에서 직접 열고 수정할 수 있게 만들기.
- **범위:** 개발자 모드에서 `관리자 도구 > 디지몬 마스터` 탭으로 접근 가능. 변경값은 Firestore `game_settings/digimon_master_data` 문서와 브라우저 캐시에 저장되며, 현재 게임 세션의 디지몬 데이터에도 즉시 반영된다.
- **내용:** `MasterDataContext`와 `masterDataUtils`를 추가해 정적 `digimonDataVer1`, `digimonDataVer2` 객체에 오버라이드 값을 덮어쓰는 전역 계층을 만들었다. `AdminModal`에는 검색 가능한 다크 테이블 형태의 `DigimonMasterDataPanel`을 추가해 종별 스프라이트, 공격 스프라이트, 진화 시간, 배고픔/힘/배변 주기, 치료 횟수, 체중, 에너지, 파워, 수면 시간, 속성을 직접 수정할 수 있게 했다. `Game.jsx`에서는 오버라이드 변경 시 현재 선택된 디지몬의 species-derived stats를 동기화해 플레이 중인 개체에도 바로 반영되도록 보정했다. 또한 오래된 CRA 기본 테스트를 현재 구조에 맞는 smoke test로 교체했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/App.jsx`
- `digimon-tamagotchi-frontend/src/App.test.js`
- `digimon-tamagotchi-frontend/src/components/AdminModal.jsx`
- `digimon-tamagotchi-frontend/src/components/DigimonMasterDataPanel.jsx` (신규)
- `digimon-tamagotchi-frontend/src/contexts/MasterDataContext.jsx` (신규)
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/utils/masterDataUtils.js` (신규)
- `docs/REFACTORING_LOG.md`

### 아키텍처 메모
- 정적 데이터 파일을 직접 수정하는 대신 런타임 오버라이드 계층을 두어, 기존 코드의 direct import 패턴을 대규모로 뜯지 않고도 전역 반영이 가능하게 했다.
- `adaptedV1`, `adaptedV2`는 모듈 상수 대신 런타임 재계산으로 바꿔 오버라이드 값이 lazy update/진화/전투 로직에도 반영되도록 연결했다.

---

## [2026-03-29] 로그아웃 시 Ably detached runtime error 방지

### 작업 유형
- 🐛 버그 수정

### 목적 및 영향
- **목적:** 로그아웃 시 `Channel operation failed as channel state is detached` 런타임 에러가 터지는 문제를 줄이기.
- **범위:** 사용자 동작 변화 없음, 저장 데이터 영향 없음, Firebase 영향 없음, Ably 연결 lifecycle 정리.
- **내용:** `App.jsx`에서 로그아웃 상태일 때 `AblyContextProvider`에 이전 테이머명을 넘기지 않도록 변경했다. 동시에 `AblyContext.jsx`에서 `tamerName`이 없을 때 guest client를 새로 만들지 않고 Ably를 비활성화하도록 조정했다. 이로써 로그아웃 시 `ChatRoom/ChannelProvider` 언마운트와 Ably client 재생성/채널 detach가 충돌하던 경로를 완화했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/App.jsx`
- `digimon-tamagotchi-frontend/src/contexts/AblyContext.jsx`
- `docs/REFACTORING_LOG.md`

---

## [2026-03-29] 로그인/상태 표시 UI 문구를 현재 인증 계약에 맞게 정리

### 작업 유형
- ✨ UI 문구 수정
- 📝 문서 갱신

### 목적 및 영향
- **목적:** 로그인 화면과 게임 화면에 남아 있던 오래된 저장소/로그인 표현을 현재 운영 계약과 맞추기.
- **범위:** 사용자 동작 변화 없음, 저장 데이터 영향 없음, Firebase 영향 없음, localStorage 영향 없음.
- **내용:** `Login.jsx`에서 익명 로그인 버튼 문구를 `게스트로 시작`으로 바꾸고, 안내 문구를 `Google 로그인은 여러 기기에서 이어서 플레이하기 쉬움`, `게스트 로그인은 로그아웃/기기 변경 시 이어서 플레이가 어려울 수 있음`으로 수정. `Game.jsx`에서는 `localStorage 모드` 상태 표시를 `Firebase 미설정`으로 변경해, 현재 공식 계약인 `Firebase-first` 구조와 맞추었다. 관련 계약 문서에서도 더 이상 stale하지 않은 설명으로 정리했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/Login.jsx`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `docs/CURRENT_AUTH_STORAGE_CONTRACT.md`
- `docs/REFACTORING_LOG.md`

---

## [2026-03-29] 인증/저장 계약 기준 문서 정비

### 작업 유형
- 📝 문서 갱신 (저장소 계약, 로그인 정책, repositories 현재 상태 설명 정리)

### 목적 및 영향
- **목적:** 현재 코드 구조와 문서 사이에서 가장 혼동이 큰 영역인 `로그인 방식`, `Firestore/localStorage 역할`, `repositories 실사용 여부`를 기준 문서에 맞춰 다시 정리.
- **내용:** 루트 `README.md`를 현재 운영 계약 중심으로 전면 재작성하고, `docs/CURRENT_AUTH_STORAGE_CONTRACT.md`를 새로 추가해 "게스트 로그인도 Firebase 기반인가", "슬롯은 어디에 저장되는가", "localStorage는 지금 무엇에 써도 되는가", "repositories는 현재 어떤 의미인가", "Firebase + Oracle Cloud를 같이 쓸 경우 구조가 어떻게 달라질 수 있는가"를 자세히 설명. 또한 `docs/CURRENT_PROJECT_STRUCTURE_ANALYSIS.md`에 현재 운영 계약 요약을 추가하고, `docs/STRUCTURE_ANALYSIS.md`는 상세 문서로 안내하는 요약 문서로 정리했으며, `src/repositories/README.md`는 과거 localStorage 중심 설명 대신 현재 실사용 여부를 기준으로 다시 작성.
- **문서 계약 관찰:**
  - 현재 운영 계약을 가장 정확하게 설명하는 문장은 `로그인 필수 + 게스트 로그인 허용 + 슬롯 저장은 Firestore + localStorage는 보조 저장`이다.
  - 게스트 로그인은 현재 구현상 Firebase Auth의 익명 로그인이지, 완전한 비로그인 localStorage 모드가 아니다.
  - repositories 폴더는 남아 있지만 현재 메인 런타임 저장 경계로 설명하면 오해가 생긴다.

### 영향받은 파일
- `README.md`
- `docs/CURRENT_AUTH_STORAGE_CONTRACT.md` (신규)
- `docs/CURRENT_PROJECT_STRUCTURE_ANALYSIS.md`
- `docs/STRUCTURE_ANALYSIS.md`
- `digimon-tamagotchi-frontend/src/repositories/README.md`
- `docs/REFACTORING_LOG.md`

---

## [2026-03-29] Codex 다중 관점 종합 분석 문서 추가

### 작업 유형
- 📝 문서 추가 (code-mapper, architect-reviewer, reviewer, performance-engineer, game-developer, refactoring-specialist 통합 종합 분석)

### 목적 및 영향
- **목적:** `digimon-tamagotchi-frontend`를 여러 전문 관점에서 다시 교차 검토하고, 현재 구조 요약, 개발 상태와 강점, 핵심 리스크, 개선 필요 지점, 우선순위별 리팩터링/테스트/문서화 제안을 하나의 기준 문서로 통합.
- **내용:** 기존 개별 분석 문서들을 다시 묶어 `App.jsx -> SelectScreen.jsx -> Game.jsx` 중심 실제 구조, Hook 책임 경계, Firebase/localStorage/repository 계약 드리프트, lazy update와 실시간 타이머의 긴장 관계, 규칙 canonical source 분산, 테스트 부재, Firestore write 비용, `Game.jsx` 비대화 문제를 우선순위 순으로 재정리. 마지막에는 `계약 정리 -> 테스트 기준선 확보 -> Game.jsx 조립 분리 -> 저장 경계 일원화 -> 규칙 엔진 단일화 -> 성능 최적화` 순서의 실행 계획을 제안.
- **종합 관찰:**
  - 현재 프로젝트는 기능 성숙도는 높지만, 구조 경계는 아직 `Game.jsx + useGameData + 분산된 규칙 파일` 중심으로 남아 있다.
  - 가장 큰 리스크는 문서상의 아키텍처와 실제 런타임 계약이 다르고, 시간 기반 규칙의 canonical source가 하나가 아니라는 점이다.
  - 가장 안전한 개선 순서는 대규모 재작성보다 테스트/문서/경계 정리를 선행하는 단계적 리팩터링이다.

### 영향받은 파일
- `codex analyze/20_digimon-tamagotchi-frontend-comprehensive-multi-review-validated.md` (신규)
- `docs/REFACTORING_LOG.md`

---

## [2026-03-29] Codex documentation-engineer 기준 문서 정책/구조 정합성 리뷰 문서 추가

### 작업 유형
- 📝 문서 추가 (documentation-engineer 정의 기준 문서 정책 비교 및 개선 제안)

### 목적 및 영향
- **목적:** `digimon-tamagotchi-frontend`의 현재 코드 구조와 프로젝트 문서 정책이 얼마나 일치하는지 `documentation-engineer` 관점으로 다시 정리하고, 특히 `docs/REFACTORING_LOG.md`에 앞으로 어떤 형식으로 변경 기록을 남기면 좋은지 기준안을 제시.
- **내용:** 루트 `README.md`, `docs/REFACTORING_LOG.md`, `docs/CURRENT_PROJECT_STRUCTURE_ANALYSIS.md`, `docs/game_mechanics.md`, `src/repositories/README.md`를 대조해 문서의 역할 구분, 구조 설명의 최신성, 저장소/Firebase-localStorage 설명의 일치 여부, 구조 문서의 canonical 여부를 점검. `REFACTORING_LOG`에 대해 코드 변경용/문서 전용 변경용 템플릿을 분리 제안하고, 현재 구조 설명 문서에 부족한 지점으로 문서 인덱스 부재, 상태 메타데이터 부재, 기준 문서와 참고 문서의 경계 불명확성을 정리.
- **문서 정책 관찰:**
  - 현재 문제는 문서 수량 부족보다 "기준 문서와 참고 문서가 섞여 있는 상태"에 더 가깝다.
  - `docs/REFACTORING_LOG.md`는 이미 좋은 습관을 갖고 있지만, 사용자 동작 변화/저장 영향/검증 여부를 더 명확히 남기면 가치가 커진다.
  - 루트 `README.md`와 `src/repositories/README.md`는 실제 코드 기준으로 우선 정리해야 할 문서다.

### 영향받은 파일
- `codex analyze/19_digimon-tamagotchi-frontend-documentation-engineer-validated.md` (신규)
- `docs/REFACTORING_LOG.md`

---

## [2026-03-29] Codex test-automator 기준 회귀 테스트 자동화 우선순위 문서 추가

### 작업 유형
- 📝 문서 추가 (test-automator 정의 기준 고위험 회귀 자동화 계획)

### 목적 및 영향
- **목적:** `digimon-tamagotchi-frontend`에서 `applyLazyUpdate`, 진화 조건, 배틀 계산, 사망 조건 중 무엇부터 자동 테스트를 추가해야 가장 큰 회귀 방지 효과를 얻는지 `test-automator` 관점으로 다시 정리.
- **내용:** 비교 대상 네 축을 테스트 ROI 기준으로 재평가. `applyLazyUpdate -> 진화 조건 -> 배틀 계산 -> 사망 조건` 순서를 공식 우선순위로 정하고, 각 후보에 대해 왜 그 순서가 맞는지, 어떤 테스트 타입이 맞는지, 어떤 fixture/time/random 제어가 필요한지, 무엇이 characterization 테스트 대상인지 문서화.
- **테스트 자동화 관찰:**
  - `applyLazyUpdate`는 upstream state generator라 나머지 규칙보다 먼저 고정해야 함.
  - 진화와 배틀은 순수 함수 경계가 비교적 명확해 적은 테스트로 큰 회귀 면적을 덮을 수 있음.
  - 사망 조건은 도메인 중요도는 높지만 구현 경계가 가장 흐려서 마지막에 characterization 테스트로 다루는 편이 효율적임.

### 영향받은 파일
- `codex analyze/18_digimon-tamagotchi-frontend-test-automator-validated.md` (신규)
- `docs/REFACTORING_LOG.md`

---

## [2026-03-29] Codex qa-expert 기준 테스트 전략 리뷰 문서 추가

### 작업 유형
- 📝 문서 추가 (qa-expert 정의 기준 리스크 기반 테스트 전략 정리)

### 목적 및 영향
- **목적:** `digimon-tamagotchi-frontend`의 현재 테스트 전략을 QA 관점에서 다시 정리하고, 특히 `/src/logic` 순수 함수 중 어떤 것부터 유닛 테스트를 추가해야 하는지 우선순위를 명확히 함.
- **내용:** 현재 자동 테스트가 사실상 [App.test.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/src/App.test.js#L1) 하나뿐이고, 그것도 CRA 샘플 수준이라는 점을 확인. `/src/logic` 내에서는 `evolution/checker`, `battle/calculator`, `battle/hitrate`, `stats/hunger`, `stats/strength`, `evolution/jogress`를 1차 자동화 대상으로 잡고, `/src/logic`만 테스트했을 때 남는 런타임 사각지점으로 `src/data/stats.js`, `src/data/train_*`, 페이지/Hook 통합 경계를 별도로 문서화.
- **QA 관찰:**
  - 가장 큰 품질 리스크는 시간 기반 게임 규칙인데, 이를 보호하는 자동화가 전무함.
  - `/src/logic` 테스트는 필수지만 충분조건은 아니며, runtime source characterization 테스트가 이어져야 실제 회귀 방지 효과가 큼.
  - 가장 작은 즉시 조치는 stale한 `App.test.js`를 의미 있는 smoke test로 바꾸는 것임.

### 영향받은 파일
- `codex analyze/17_digimon-tamagotchi-frontend-qa-expert-validated.md` (신규)
- `docs/REFACTORING_LOG.md`

---

## [2026-03-29] Codex refactoring-specialist 기준 안전한 리팩터링 로드맵 문서 추가

### 작업 유형
- 📝 문서 추가 (refactoring-specialist 정의 기준 behavior preserving 리팩터링 로드맵)

### 목적 및 영향
- **목적:** `digimon-tamagotchi-frontend`에서 `/src/pages/Game.jsx`와 대형 Hook들을 어떤 순서로 분해해야 안전한지, `behavior preserving` 원칙으로 작은 단계의 리팩터링 계획을 재정리.
- **내용:** `Game.jsx`의 조립 코드, 렌더 블록, 실시간 타이머/구독, direct Firestore 호출, `useGameActions`, `useEvolution`, `useGameData`, `useGameLogic`, `useGameHandlers`의 책임 분해 순서를 단계별로 정리. 각 단계마다 목표, 영향 파일, 기대 효과, 주의할 회귀 위험, 테스트 게이트를 함께 명시.
- **리팩터링 관찰:**
  - 가장 큰 마찰 원인은 파일 길이보다도 page/controller/runtime/persistence/domain/UI 책임이 같은 경계에 섞여 있다는 점임.
  - 가장 안전한 시작점은 규칙 엔진 수정이 아니라 `Game.jsx`의 props 조립과 렌더 블록 추출임.
  - direct Firestore 호출 정리와 대형 Hook 내부 분해는 그 다음 순서여야 하며, repository/localStorage 계약 정리는 마지막으로 미루는 편이 안전함.

### 영향받은 파일
- `codex analyze/16_digimon-tamagotchi-frontend-refactoring-specialist-validated.md` (신규)
- `docs/REFACTORING_LOG.md`

---

## [2026-03-29] Codex game-developer 기준 게임 규칙 품질 리뷰 문서 추가

### 작업 유형
- 📝 문서 추가 (game-developer 정의 기준 게임플레이 규칙 일관성/엣지 케이스 리뷰)

### 목적 및 영향
- **목적:** `digimon-tamagotchi-frontend`를 `game-developer` 관점으로 다시 읽고, 진화 조건, 케어미스, 배틀 명중률, 사망 조건, 배고픔/힘/배변/수명 변화, 훈련/먹이주기 로직의 도메인 일관성을 점검.
- **내용:** 정상 루프(먹이 -> 훈련 -> 배틀 -> 진화), 실패 루프(배고픔/힘 0 -> 콜 -> 케어미스 -> 사망), 통합 경계(실시간 타이머, lazy update, 냉장고, Firestore 저장/복구)를 중심으로 정적 리뷰를 수행. 실시간 타이머와 lazy update의 다중 사이클 처리 차이, 사망 판정 경로 불일치, 훈련/먹이 규칙의 중복 구현, arena 상대 power fallback, sleep care mistake 오프라인 미재구성, jogress/진화 리셋 분산을 우선순위 순으로 정리.
- **게임 규칙 관찰:**
  - 가장 큰 리스크는 플레이 결과가 규칙 데이터보다 "실시간 경로를 탔는지, 복귀 경로를 탔는지"에 따라 달라질 수 있다는 점임.
  - 진화 데이터와 일반 진화 해석기 자체는 강점이지만, 시간 기반 규칙과 훈련/먹이 규칙은 canonical source가 하나로 닫혀 있지 않음.
  - 가장 먼저 고정해야 할 것은 시간 기반 characterization 테스트와 사망 판정 단일화임.

### 영향받은 파일
- `codex analyze/15_digimon-tamagotchi-frontend-game-developer-validated.md` (신규)
- `docs/REFACTORING_LOG.md`

---

## [2026-03-29] Codex performance-engineer 기준 성능 리뷰 문서 추가

### 작업 유형
- 📝 문서 추가 (performance-engineer 정의 기준 렌더링/저장 비용 리스크 리뷰)

### 목적 및 영향
- **목적:** `digimon-tamagotchi-frontend`를 `performance-engineer` 관점으로 다시 읽고, lazy update 준수 여부, 불필요한 렌더링, 큰 컴포넌트/Hook의 과도한 상태 갱신, Firestore write/read 비용 리스크를 정리.
- **내용:** 실시간 타이머와 UI 업데이트, 상태 파생 계산, 저장 빈도를 중심으로 재검토. 루트의 다중 1초 타이머, `Canvas` 재초기화 가능성, action당 `getDoc + updateDoc + addDoc` 패턴, 슬롯 전체 `onSnapshot` 구독, 큰 spread props 전파, render-phase `setCurrentAnimation()` 호출을 핵심 finding으로 정리.
- **성능 관찰:**
  - lazy update 원칙은 연속 스탯 저장에서는 유지되지만, 이벤트성 write와 로그 subcollection append 때문에 Firestore 비용 최적화는 덜 닫혀 있음.
  - 가장 큰 프론트엔드 리스크는 초당 루트 리렌더가 큰 UI 트리와 `Canvas` 초기화로 전파될 가능성이 높다는 점임.
  - 가장 먼저 계측할 대상은 idle 중 React commit 수, `Canvas.initImages()` 호출 수, 액션 1회당 Firestore read/write 수임.

### 영향받은 파일
- `codex analyze/14_digimon-tamagotchi-frontend-performance-engineer-validated.md` (신규)
- `docs/REFACTORING_LOG.md`

---

## [2026-03-29] Codex reviewer 기준 PR 리뷰 문서 추가

### 작업 유형
- 📝 문서 추가 (reviewer 정의 기준 correctness / regression risk / missing tests 리뷰)

### 목적 및 영향
- **목적:** `digimon-tamagotchi-frontend`를 `reviewer` 관점으로 다시 읽고, PR 리뷰처럼 위험도가 높은 correctness 이슈와 회귀 위험, 테스트 공백을 우선순위 순으로 정리.
- **내용:** 특히 시간 기반 스탯 변경, lazy update, 진화 조건, 배틀 계산, 저장 시점, 모달 상태 관리를 중심으로 코드상 근거를 재검토. 실시간 타이머의 stale closure 가능성, 냉장고 시간을 포함해버리는 사망 판정 경로, 메모리 상태 기준 lazy update, 분산된 저장 시점, Arena power fallback, battle modal 전이 리스크를 findings 형태로 문서화.
- **리뷰 관찰:**
  - 가장 큰 correctness 리스크는 시간 기반 엔진과 사망 조건의 경로별 불일치임.
  - 저장 경계가 `saveStats` 하나로 닫혀 있지 않고 direct Firestore write가 여러 군데 남아 있어 회귀 면적이 큼.
  - 진화/배틀/모달은 즉시 치명적 버그보다 테스트 공백이 더 큰 위험 요인으로 보임.

### 영향받은 파일
- `codex analyze/13_digimon-tamagotchi-frontend-reviewer-pr-review-validated.md` (신규)
- `docs/REFACTORING_LOG.md`

---

## [2026-03-29] Codex architect-reviewer 기준 아키텍처 리뷰 문서 추가

### 작업 유형
- 📝 문서 추가 (architect-reviewer 정의 기준 장기 유지보수 리스크 리뷰)

### 목적 및 영향
- **목적:** `digimon-tamagotchi-frontend`의 현재 아키텍처를 `architect-reviewer` 관점으로 다시 점검하고, 특히 `Game.jsx` 비대화, Hook 간 책임 분리, `logic`/UI 계층 경계, repository 패턴 일관성, Firebase/localStorage 지원 구조의 실제 상태를 우선순위 기준으로 정리.
- **내용:** 실제 런타임 경로와 문서화된 설계가 어디서 어긋나는지 다시 검토. `Game.jsx`가 페이지를 넘어 서비스/오케스트레이션/저장 조정 역할을 동시에 수행하고 있다는 점, `useGameData`를 중심으로 보이는 저장 경계가 실제로는 여러 Hook와 페이지로 분산되어 있다는 점, repository 문서와 실사용 경계가 불일치한다는 점을 근거 중심으로 정리.
- **구조 관찰:**
  - dual-storage와 repository 패턴은 문서상 계약에 더 가깝고, 실제 런타임은 Firebase 중심 구조임.
  - Hook 분리는 되어 있지만 UI, 도메인 규칙, Firestore write 책임이 서로 섞여 있어 변경 비용이 높음.
  - 시간 기반 규칙 소스가 `data/stats`, `logic/stats`, `Game.jsx` 타이머에 분산되어 있어 장기적으로 drift 위험이 큼.

### 영향받은 파일
- `codex analyze/12_digimon-tamagotchi-frontend-architect-review-validated.md` (신규)
- `docs/REFACTORING_LOG.md`

---

## [2026-03-29] Codex code-mapper 재확인 기준 구조 분석 문서 추가

### 작업 유형
- 📝 문서 추가 (code-mapper 정의 재확인 후 구조 분석 정리)

### 목적 및 영향
- **목적:** `digimon-tamagotchi-frontend`의 전체 구조를 `code-mapper` 기준으로 다시 정리하고, 실제 호출 흐름, 상태 관리 경계, 저장소 경계, lazy update 적용 지점을 문서화.
- **내용:** `App.jsx`, `Game.jsx`, `hooks`, `logic`, `repositories`, `data/v1` 중심으로 실제 런타임 구조를 재점검. 특히 Firebase 중심 저장 경계, `useGameState`/`useGameData` 역할 분리, `data/v1` 원본과 adapted 맵의 이중 소비, load/action/save/timer별 lazy update 적용 지점을 다시 정리.
- **구조 관찰:**
  - 현재 게임 경로는 사실상 Firebase 전제이며 localStorage는 보조 UI 설정용으로 남아 있음.
  - `Game.jsx`가 여전히 오케스트레이션 중심이며 `useGameData`가 실질적인 영속성 경계를 소유함.
  - 시간 기반 엔진은 `data/stats`, `logic/stats`, 실시간 타이머 조합으로 분산되어 있음.

### 영향받은 파일
- `codex analyze/11_digimon-tamagotchi-frontend-code-mapper-validated-structure-analysis.md` (신규)
- `docs/REFACTORING_LOG.md`

---

## [2026-03-29] Codex 종합 분석 문서 추가

### 작업 유형
- 📝 문서 추가 (구조/아키텍처/리뷰/성능/게임 규칙/리팩터링 관점 종합 분석)

### 목적 및 영향
- **목적:** `digimon-tamagotchi-frontend`를 여러 리뷰 관점으로 통합 평가하고, 현재 구조 요약, 개발 상태와 강점, 핵심 리스크, 개선 필요 영역, 우선순위별 제안을 한 문서로 정리.
- **내용:** 기존 구조 분석, 아키텍처 리뷰, PR 리뷰, 성능 리뷰, 게임 규칙 리뷰, 리팩터링 로드맵을 하나로 묶어 현재 프로젝트의 실질적인 상태를 설명. 특히 `Game.jsx` 중심 구조, Firestore 중심 저장 경계, 시간 기반 규칙 분산, 테스트 부재, 문서-코드 드리프트를 핵심 주제로 재정리.
- **종합 관찰:**
  - 프로젝트는 기능적으로 성숙했지만 아키텍처 계약과 canonical rule source가 모호함.
  - 가장 큰 리스크는 시간 기반 규칙과 저장 경계의 분산, 그리고 테스트 안전망 부재임.
  - 우선순위는 계약/문서 정리 -> 테스트 안전망 확보 -> `Game.jsx` 조립 코드 분리 -> 저장 경계 정리 -> 규칙 소스 단일화 순이 적절함.

### 영향받은 파일
- `codex analyze/10_digimon-tamagotchi-frontend-comprehensive-analysis.md` (신규)
- `docs/REFACTORING_LOG.md`

---

## [2026-03-29] Codex 문서 정책 및 구조 설명 문서 리뷰 추가

### 작업 유형
- 📝 문서 추가 (문서 정책 검토 및 구조 설명 문서 개선 제안)

### 목적 및 영향
- **목적:** 현재 코드 구조와 프로젝트 문서 정책을 비교해 `REFACTORING_LOG`의 권장 기록 형식과 구조 설명 문서의 부족한 부분을 정리.
- **내용:** `REFACTORING_LOG`의 현재 강점과 한계를 분석하고, 행동 변화/저장 영향/검증 여부를 포함한 권장 템플릿을 제안. 동시에 루트 `README`, `src/repositories/README`, `docs/game_mechanics.md`, 구조 분석 문서들의 최신성 및 기준 문서 부재 문제를 정리.
- **문서 정책 관찰:**
  - 현재 로그 문화는 잘 자리잡았지만 코드 변경과 분석 문서 추가가 같은 레벨로 섞여 추적성이 떨어질 수 있음.
  - 구조 설명 문서가 여러 개 존재하지만 기준 문서가 명확하지 않고 일부는 중복 또는 현재 코드와 불일치함.
  - 저장 모드, repository 패턴, lazy update 기준 경로 같은 핵심 사실은 "현재 구현"과 "과거 설계"를 분리해 문서화할 필요가 있음.

### 영향받은 파일
- `codex analyze/9_digimon-tamagotchi-frontend-documentation-policy-review.md` (신규)
- `docs/REFACTORING_LOG.md`

---

## [2026-03-29] Codex 회귀 테스트 자동화 우선순위 계획 문서 추가

### 작업 유형
- 📝 문서 추가 (회귀 위험 높은 순수 로직 테스트 자동화 우선순위 정리)

### 목적 및 영향
- **목적:** `digimon-tamagotchi-frontend`에서 회귀 위험이 큰 순수 로직 후보를 기준으로, 어떤 규칙부터 자동 테스트를 추가해야 하는지 테스트 관점의 우선순위 계획 수립.
- **내용:** `applyLazyUpdate`, 진화 조건, 배틀 계산, 사망 조건을 비교하여 테스트 자동화 순서를 정리하고, 왜 `applyLazyUpdate`가 최우선인지, 왜 사망 조건은 현재 구조상 characterization 테스트에 더 가깝게 접근해야 하는지 문서화.
- **테스트 자동화 관찰:**
  - 시간 기반 상태 생성 로직이 진화/사망/저장 결과의 선행 조건이므로 `applyLazyUpdate`가 가장 높은 ROI를 가짐.
  - 진화 조건은 분기 수와 데이터 구조 복잡도가 높아 2순위 유닛 테스트 대상임.
  - 배틀 계산은 랜덤 제어만 추가하면 deterministic 테스트가 가능해 3순위로 적합함.
  - 사망 조건은 현재 `logic`과 `hooks`에 분산되어 있어, 초기에는 순수 유닛 테스트보다 characterization 테스트 접근이 더 안전함.

### 영향받은 파일
- `codex analyze/8_digimon-tamagotchi-frontend-regression-test-automation-plan.md` (신규)
- `docs/REFACTORING_LOG.md`

---

## [2026-03-29] Codex 테스트 전략 리뷰 문서 추가

### 작업 유형
- 📝 문서 추가 (QA 관점 테스트 전략 및 유닛 테스트 우선순위 정리)

### 목적 및 영향
- **목적:** `digimon-tamagotchi-frontend`의 현재 테스트 커버리지 약점을 정리하고, `/src/logic`의 순수 함수들 중 무엇부터 유닛 테스트를 추가해야 하는지 우선순위를 수립.
- **내용:** 현재 `App.test.js`만 존재하는 상태를 기준으로, 시간 기반 스탯 변화, lazy update, 진화 조건, 배틀 계산, 저장 타이밍, 모달/이벤트 흐름에 대한 테스트 공백을 분석하고, `/src/logic` 기준 우선 테스트 대상 파일과 추천 테스트 레이어를 문서화.
- **테스트 전략 관찰:**
  - 현재 테스트는 CRA 기본 샘플 수준이라 실질적인 회귀 방지 효과가 없음.
  - `/src/logic` 유닛 테스트는 가장 빠른 안전망이지만, 실제 런타임 규칙 소스가 `data/*`에도 분산되어 있어 characterization 테스트가 병행되어야 함.
  - 초기 ROI가 가장 높은 대상은 `evolution/checker`, `battle/hitrate`, `battle/calculator`, `stats/hunger`, `stats/strength` 순.

### 영향받은 파일
- `codex analyze/7_digimon-tamagotchi-frontend-test-strategy-review.md` (신규)
- `docs/REFACTORING_LOG.md`

---

## [2026-03-29] Codex 아키텍처 리뷰 문서 추가

### 작업 유형
- 📝 문서 추가 (현재 아키텍처 장기 유지보수 리스크 리뷰)

### 목적 및 영향
- **목적:** `digimon-tamagotchi-frontend`의 현재 아키텍처를 구조 관점에서 재검토하고, 장기 유지보수 리스크를 우선순위 기준으로 정리.
- **내용:** `Game.jsx` 비대화, 주요 Hook 간 책임 분리 실패, `logic` 계층과 UI 계층 경계 혼합, `repositories` 패턴의 실사용 불일치, Firebase/localStorage 이중 저장소 설명과 실제 런타임 차이를 문서화.
- **구조적 관찰:**
  - 문서상 dual-storage 구조와 실제 Firebase 중심 런타임이 다름.
  - `Game.jsx`가 여전히 실질적인 서비스 레이어 역할을 수행함.
  - Hook 분리가 책임 분리보다 사이드이펙트 분산에 가까움.
  - `data/stats.js`와 `logic/stats/stats.js`가 병존해 핵심 규칙 단일성이 약함.

### 영향받은 파일
- `codex analyze/digimon-tamagotchi-frontend-architecture-review.md` (신규)
- `docs/REFACTORING_LOG.md`

---

## [2026-03-29] Codex 구조 분석 문서 추가

### 작업 유형
- 📝 문서 추가 (프로젝트 구조 분석 정리)

### 목적 및 영향
- **목적:** `digimon-tamagotchi-frontend`의 실제 구조를 코드 기준으로 다시 정리한 분석 문서를 별도 폴더에 추가.
- **내용:** `App.jsx`, `Game.jsx`, `hooks`, `logic`, `repositories`, `data/v1` 중심으로 실제 호출 흐름, 상태 관리 경계, 저장소 경계, lazy update 적용 지점을 문서화.
- **구조적 관찰:**
  - 실제 런타임은 문서상 설명과 달리 Firebase 중심 경로가 강함.
  - Repository 계층은 존재하지만 핵심 경로에서는 사용되지 않음.
  - `data/stats.js`와 `logic/stats/stats.js`가 공존하여 스탯 엔진이 완전히 단일화되어 있지 않음.

### 영향받은 파일
- `codex analyze/digimon-tamagotchi-frontend-structure-analysis.md` (신규)
- `docs/REFACTORING_LOG.md`

---

## [2026-03-08] 도감 마스터 칭호 및 슬롯 확장 (도감 완성 시 +5 슬롯)

### 작업 유형
- ✨ 기능 추가 (achievements, maxSlots, 계정 설정 UI)

### 목적 및 영향
- **목적:** 버전별 도감을 모두 채우면 칭호(Ver.1 Master, Ver.2 Master) 부여 및 최대 슬롯이 5개씩 증가하도록 구현.
- **데이터 구조:** Firestore `users/{uid}`에 `achievements: string[]` (예: `["ver1_master", "ver2_master"]`), `maxSlots: number` (기본 10, 마스터당 +5) 저장.
- **구현 요약:**
  - **userProfileUtils.js** 신규: `getAchievementsAndMaxSlots(uid)`, `getMaxSlots(uid)`, `updateAchievementsAndMaxSlots(uid, achievements)`, `computeMaxSlotsFromAchievements(achievements)`. 상수: `BASE_MAX_SLOTS = 10` (기존 앱과 동일), `SLOTS_PER_MASTER = 5`, `ACHIEVEMENT_VER1_MASTER`, `ACHIEVEMENT_VER2_MASTER`.
  - **logic/encyclopediaMaster.js** 신규: `getRequiredDigimonIds(v1Map, v2Map, version)`, `isVersionComplete(versionData, requiredIds)` (도감 완성 판정, EncyclopediaModal과 동일 규칙).
  - **useEncyclopedia.js**: `saveEncyclopedia` 저장 후 `checkAndGrantEncyclopediaMasters(currentUser, merged)` 호출로 도감 완성 시 achievements·maxSlots 자동 갱신.
  - **SelectScreen.jsx**: Firestore 모드에서 `getMaxSlots(uid)`로 사용자별 최대 슬롯 조회 후 `orderBy('createdAt','desc'), limit(maxSlots)` 적용. 새 슬롯 생성 시 빈 슬롯 탐색도 `maxSlots` 기준. localStorage 모드는 기존대로 `MAX_SLOTS_LOCAL = 10`.
  - **AccountSettingsModal.jsx**: 계정 설정 진입 시 `getAchievementsAndMaxSlots` 로드 후 칭호 배지([Ver.1 Master], [Ver.2 Master]) 및 "최대 슬롯: N개 (도감 마스터 보너스 반영)" 표시. 선택적 `slotCount` prop으로 "슬롯: N개 / 최대 M개" 표시.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/utils/userProfileUtils.js` (신규)
- `digimon-tamagotchi-frontend/src/logic/encyclopediaMaster.js` (신규)
- `digimon-tamagotchi-frontend/src/hooks/useEncyclopedia.js`
- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
- `digimon-tamagotchi-frontend/src/components/AccountSettingsModal.jsx`
- `docs/ACCOUNT_SETTINGS_AND_MASTER_TITLES_DESIGN.md`
- `docs/REFACTORING_LOG.md`

---

## [2026-02-22] 계정 설정에 Discord 웹훅 URL·알람 받기 기능 재구현

### 작업 유형
- ✨ 기능 추가 (Discord 알림 설정 UI)

### 목적 및 영향
- **목적:** 계정 설정 화면에서 Discord 웹훅 URL 입력 및 알람 수신 여부(알람 받기) 설정 기능 복구.
- **구현:**
  - **userSettingsUtils.js** 신규: `getUserSettings(uid)`, `saveUserSettings(uid, { discordWebhookUrl, isNotificationEnabled })`, `isValidDiscordWebhookUrl(url)`. Firestore `users/{uid}`에 `discordWebhookUrl`, `isNotificationEnabled` 저장. URL 검증: `https://discord.com/api/webhooks/`, `https://discordapp.com/api/webhooks/` 로 시작하는 경우만 허용.
  - **AccountSettingsModal.jsx**: 테이머명 섹션 아래에 "Discord 알림" 섹션 추가. 웹훅 URL 입력란, "알람 받기 (호출 등 알림 수신)" 체크박스, "알림 설정 저장" 버튼. 설정 로드는 계정 설정 진입 시, 저장 시 userSettingsUtils 사용.
- **데이터:** Firestore 문서 `users/{uid}` 필드: `discordWebhookUrl` (string | null), `isNotificationEnabled` (boolean).

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/utils/userSettingsUtils.js` (신규)
- `digimon-tamagotchi-frontend/src/components/AccountSettingsModal.jsx`
- `docs/REFACTORING_LOG.md`

---

## [2026-02-22] digimonDisplayName·게임 타이틀을 게임 UI 형식으로 통일 (한글명 + Ver.1/Ver.2)

### 작업 유형
- ✨ 동작 변경 (표시 형식)

### 목적 및 영향
- **목적:** Firestore `digimonDisplayName`과 게임 상단 타이틀을 **게임에서 보이는 것과 동일한 형식**으로 맞춤.
- **형식:** 별명 없음 → `한글명 Ver.1` (예: `블리츠그레이몬 Ver.1`). 별명 있음 → `별명(한글명 Ver.2)` (예: `뚱떙이(오메가몬 Alter-S Ver.2)`).
- **구현:** useGameData.js에서 digimonDisplayName 계산 시 `slotVersion`을 한글명 뒤에 붙임. Game.jsx 상단 h2에서도 동일하게 `digimonName + versionSuffix` 표시.
- **문서:** FIRESTORE_DIGIMON_NAME_FOR_SCRIPT.md 표 형식 설명 갱신.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `docs/FIRESTORE_DIGIMON_NAME_FOR_SCRIPT.md`
- `docs/REFACTORING_LOG.md`

---

## [2026-02-22] 슬롯 문서에 digimonDisplayName 저장 (구글 스크립트/Discord 디지몬명)

### 작업 유형
- ✨ 기능 추가 (디지몬 표시명 필드 저장)

### 목적 및 영향
- **목적:** 구글 앱스 스크립트·Discord 알림에서 "디지몬명"을 한 필드로 읽을 수 있도록, 슬롯 문서에 **digimonDisplayName** 저장.
- **형식:** 별명이 있으면 `"별명(한글명)"`, 없으면 `"한글명"` (예: `치치(파닥몬)`, `아구몬`). 스탯 저장 시마다 갱신.
- **구현:** useGameData에 selectedDigimon, digimonNickname, slotVersion 전달. saveStats 시 dataMap으로 한글명 조회 후 digimonDisplayName·selectedDigimon를 updateData에 포함해 저장. Game.jsx에서 해당 인자 전달.
- **문서:** FIRESTORE_DIGIMON_NAME_FOR_SCRIPT.md에 digimonDisplayName 권장 및 fallback 정리.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `docs/FIRESTORE_DIGIMON_NAME_FOR_SCRIPT.md`
- `docs/REFACTORING_LOG.md`

---

## [2026-02-18] 진화 버튼 ⭕/❌ — 개발자 모드 + 진화조건 무시 분리

### 작업 유형
- 🐛 버그 수정 (dev mode ON이어도 「진화조건 무시」가 꺼져 있으면 진화 불가 시 ❌ 표시)

### 목적 및 영향
- **원인:** 개발자 모드가 켜져 있으면 무조건 `setIsEvoEnabled(true)`로 ⭕ 표시하여, 「진화조건 무시」를 끈 상태에서도 시간/조건 미충족 시 ⭕로 나오던 문제.
- **해결:** `developerMode`만으로 early return 하지 않고, `developerMode && ignoreEvolutionTime`일 때만 무조건 ⭕. 그 외(dev ON + 조건 무시 OFF, 또는 dev OFF)에는 기존대로 `checkEvolution`으로 ⭕/❌ 판정.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `docs/REFACTORING_LOG.md`

---

## [2026-02-18] 진화 버튼 ⭕/❌ — 진화 시간·가이드 달성 여부 반영

### 작업 유형
- 🐛 버그 수정 (진화 시간이 남아 있는데 버튼이 「진화! ⭕」로 표시되던 현상)

### 목적 및 영향
- **원인:** (1) `checkEvolution`에서 `timeToEvolveSeconds`가 `undefined`/NaN일 때 시간 조건을 통과해 버튼이 ⭕로 나옴. (2) 슬롯 로딩 중에는 기본/빈 스탯으로 effect가 돌아 ⭕가 잠깐 보일 수 있음.
- **해결:**
  1. **logic/evolution/checker.js**  
     - 1단계 시간 체크 시 `Number(currentStats.timeToEvolveSeconds)`로 정규화.  
     - `Number.isNaN(tte) || tte > 0`이면 `NOT_READY` 반환(남은 시간은 NaN이면 criteria 값, 아니면 `Math.max(0, tte)` 사용).
  2. **pages/Game.jsx**  
     - 진화 버튼 상태 effect 맨 앞에 `isLoadingSlot`일 때 `setIsEvoEnabled(false)` 후 return 추가.  
     - effect 의존 배열에 `isLoadingSlot` 추가.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/logic/evolution/checker.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `docs/REFACTORING_LOG.md`

---

## [2026-02-18] 조그레스 진화 실행 로직 (로컬)

### 작업 유형
- ✨ 기능 추가 (로컬 조그레스: 현재 슬롯 진화 + 파트너 슬롯 사망, Firestore writeBatch)

### 목적 및 영향
- **목적:** 조그레스 진화 버튼 → 로컬 → 파트너 슬롯 선택 후, 실제로 현재 슬롯을 조그레스 결과 디지몬으로 진화시키고, 선택한 파트너 슬롯을 사망 처리하도록 실행 로직 구현.
- **변경 사항:**
  1. **logic/evolution/jogress.js** (신규): `getJogressResult(digimonIdA, digimonIdB, digimonDataMap)` — 두 디지몬이 조그레스 가능한지 검사하고 결과 `targetId` 반환.
  2. **hooks/useEvolution.js**: `proceedJogressLocal(partnerSlot)` 추가. 동일 버전 검사 → `getJogressResult` 검증 → Lazy Update 적용 → 현재 슬롯용 진화 스탯·로그 생성 → Firestore `writeBatch`로 슬롯 A(진화), 슬롯 B(사망) 동시 갱신 → 로컬 상태 갱신, 도감·서브컬렉션 로그 반영.
  3. **Game.jsx**: `onJogressPartnerSelected`에서 `proceedJogressLocal(slot)` 호출로 실행 연결.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/logic/evolution/jogress.js` (신규)
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `docs/REFACTORING_LOG.md`

---

## [2025-02-08] 디지타마(v1·v2) 10초/8초 진화 조건 적용 보강

### 작업 유형
- 🐛 버그 수정 (디지타마·디지타마V2일 때 진화 시간 조건이 적용되지 않던 경우 보정)

### 목적 및 영향
- **원인:** (1) `timeToEvolveSeconds`가 `undefined`일 때 `updateLifespan`/`applyLazyUpdate`에서 `undefined - deltaSec` → NaN이 되어 값이 깨짐. (2) 구 저장 데이터에 `timeToEvolveSeconds` 필드가 없으면 로드 후에도 0으로만 처리되어 즉시 진화 가능. (3) `isNewStart`가 `Digitama`만 보고 있어 v2 다음 세대(DigitamaV2) 시 초기화 분기가 적용되지 않음.
- **해결:**
  1. **data/stats.js**  
     - `updateLifespan`: `timeToEvolveSeconds`가 숫자가 아니거나 NaN이면 0으로 간주 후 감소만 적용해 NaN 방지.  
     - `applyLazyUpdate`: 동일하게 유효 숫자가 아니면 0으로 간주 후 경과 시간만큼 감소.  
     - `isNewStart`: `(digiName === "Digitama" || digiName === "DigitamaV2")` 로 넓혀 v2 다음 세대 시작 시에도 동일 초기화 적용.
  2. **useGameData.js**  
     - 슬롯 로드 후 기존 스탯이 있을 때, `savedName`이 `Digitama` 또는 `DigitamaV2`이고 `timeToEvolveSeconds`가 없음/0/NaN이면 `dataMap[savedName].timeToEvolveSeconds`로 보정한 뒤 `applyLazyUpdate` 호출. (구 저장·초기화 누락 대비)

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `docs/REFACTORING_LOG.md`

---

## [2025-02-08] Ver.2 시작 시 디지타마(DigitamaV2)로 동일하게 시작

### 작업 유형
- ✨ 기능 일관성 (v2도 v1처럼 알(디지타마)부터 시작)

### 목적 및 영향
- **목적:** Ver.2 슬롯도 Ver.1과 동일하게 **디지타마(알)** 부터 시작하도록 통일. 이전에는 v2 새 슬롯/빈 스탯 시 `Punimon`(푸니몬)으로 저장·로드되어 알 단계가 건너뛰어졌음.
- **변경 사항:**
  1. **SelectScreen.jsx:** 새 슬롯 생성 시 Ver.2면 `selectedDigimon: "DigitamaV2"` 저장 (기존 "Punimon" → "DigitamaV2").
  2. **useGameData.js:** 슬롯 로드 시 `slotData.version` 기준으로 데이터 맵 선택 (`dataMap = Ver.2 ? adaptedV2 : adaptedV1`). 저장된 디지몬 없을 때 기본값을 Ver.2면 `"DigitamaV2"`, Ver.1이면 `"Digitama"`로 설정. `initializeStats(savedName, {}, dataMap)`, `getSleepSchedule(..., dataMap)`, 스프라이트 동기화에 `dataMap` 사용.
  3. **Game.jsx:** useGameData에 `adaptedV1`, `adaptedV2` 전달하여 로드 시점에 버전별 데이터 맵 사용 (로드 시 slotVersion 상태는 아직 반영 전이므로 slotData.version으로 선택).

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `docs/REFACTORING_LOG.md`

---

## [2025-02-08] 디지타마 10초 진화 조건 복원 및 다음 세대 적용

### 작업 유형
- 🐛 버그 수정 (디지타마 → 다음 세대 시 10초 진화 조건이 적용되지 않던 현상)

### 목적 및 영향
- **원인 (두 가지):**
  1. v1 디지몬 데이터에서 디지타마의 `timeToEvolveSeconds`가 8초로 되어 있었고, 레거시 매뉴얼 기준 10초가 맞음.
  2. `initializeStats`에 **원본** `digimonDataVer1`(v1 구조)을 넘기는 경로(useGameData 새 슬롯, useEvolution 진화 후, useDeath 오하카다몬→디지타마, useGameState 초기값, SettingsModal 디지몬 변경)에서는 `custom`이 `{ id, name, stage, stats, evolutionCriteria, evolutions }` 형태라 **최상위에 `timeToEvolveSeconds`가 없음**. `merged = { ...defaultStats, ...custom }`만으로는 `timeToEvolveSeconds`가 0으로 남아, 디지타마/다음 단계 진화 시간 조건이 사라짐.
- **해결:**
  1. **데이터:** `src/data/v1/digimons.js` 디지타마 `evolutionCriteria.timeToEvolveSeconds`를 8 → **10**으로 복원 (주석: "10초 후 자동 진화 (다음 세대 알 → 깜몬)").
  2. **로직:** `src/data/stats.js`의 `initializeStats`에서 `merged` 생성 직후, `timeToEvolveSeconds`가 없거나 0일 때 `custom.evolutionCriteria?.timeToEvolveSeconds`가 있으면 그 값으로 설정. 이렇게 해서 원본 v1 데이터를 넘기든, adapted(최상위 timeToEvolveSeconds 포함) 데이터를 넘기든 모두 진화까지 시간이 올바르게 적용됨.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/v1/digimons.js`
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `docs/REFACTORING_LOG.md`

---

## [2025-02-08] 케어미스 isLogged 'DB 망령' 보정 (10분 미만이면 무조건 false)

### 작업 유형
- 🐛 버그 수정 (새로고침 후에도 케어미스 이력·판정 카운터가 계속 증가하지 않던 현상)

### 목적 및 영향
- **원인:** 예전에 isLogged: true로 DB에 저장된 슬롯을 새로고침해 불러오면, 복원 시 `existingStartedAt`이 이미 있어서 `!existingStartedAt` 분기를 타지 않음. 그래서 isLogged가 DB의 true를 그대로 유지하고, checkCallTimeouts가 "이미 로그 찍혔다"고 판단해 카운트·로그 추가를 계속 스킵함.
- **해결:** "아직 10분이 안 지났다면" (호출이 타임아웃 전이면) **무조건 isLogged = false**로 보정. 판정 대기 상태에서는 로그를 안 찍은 것이 맞으므로, DB에 true가 남아 있어도 보정함.

### 변경 사항
- **hooks/useGameLogic.js** (checkCalls)
  - 복원 분기(existingStartedAt 있을 때): `hungerElapsed = now - existingStartedAt`, `hungerElapsed < HUNGER_CALL_TIMEOUT_MS`이면 `callStatus.hunger.isLogged = false`. Strength 동일.
- **data/stats.js** (applyLazyUpdate)
  - Hunger: `hungerStartedAt` 있을 때 `hungerElapsed < HUNGER_CALL_TIMEOUT`이면 `callStatus.hunger.isLogged = false`. Strength 동일.
  - loadSlot → applyLazyUpdate 경로에서도 동일 보정 적용되어, 로드 직후부터 올바른 상태로 시작.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `docs/REFACTORING_LOG.md`

---

## [2025-02-08] 케어미스 판정 카운터/이력 미증가 수정 (isLogged 새 호출 시 초기화)

### 작업 유형
- 🐛 버그 수정 (새로고침 후에도 케어미스 발생 이력·판정 카운터가 더 이상 증가하지 않던 현상)

### 목적 및 영향
- **원인:** `callStatus.hunger.isLogged` / `callStatus.strength.isLogged`를 타임아웃 시 true로 두어 중복 로그를 막았는데, **새 호출을 시작할 때** isLogged를 false로 초기화하지 않음. 그래서 한 번 타임아웃 후 DB에 isLogged=true가 저장되고, 다음에 배고픔/힘이 다시 0이 되어도 **이전 값이 그대로** 남아 `checkCallTimeouts`에서 `alreadyLogged === true`로 판단해 careMistakes 증가·로그 추가가 스킵됨.
- **해결:** `checkCalls`에서 **새 호출을 세팅하는 분기** (`!existingStartedAt`) 안에서 `callStatus.hunger.isLogged = false`, `callStatus.strength.isLogged = false` 명시적으로 설정. 호출 해제(fullness/strength > 0) 시에는 기존대로 isLogged = false 유지.

### 변경 사항
- **hooks/useGameLogic.js** (checkCalls)
  - Hunger: `if (!existingStartedAt)` 블록에 `callStatus.hunger.isLogged = false` 추가.
  - Strength: `if (!existingStartedAt)` 블록에 `callStatus.strength.isLogged = false` 추가.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `docs/REFACTORING_LOG.md`

---

## [2025-02-08] 케어미스 이력 틱 중복 방지 (ref 기반 1회 추가)

### 작업 유형
- 🐛 버그 수정 (케어미스 이력만 중복, 부상 이력은 중복 없음 → 원인 비교 후 케어미스 쪽만 보강)

### 목적 및 영향
- **원인:** 부상은 `poopCount > oldPoopCount`가 **한 틱만** true라 로그가 1번만 추가됨. 케어미스는 `careMistakes > oldCareMistakes`가 React 상태 갱신 전에 **연속 틱**에서 true가 되어 같은 이벤트 로그가 2~3번 쌓임. addActivityLog의 hasDuplicateCareMistakeLog는 “넘겨받은 배열”만 보므로, 이전 틱에서 넣은 로그가 아직 반영되지 않은 배열이 넘어오면 중복으로 인식하지 못함.
- **해결:** 틱에서 케어미스 로그를 넣기 전에 **ref(Set)** 로 “이미 이 이벤트(timeoutOccurredAt + hunger/strength/sleep) 로그를 넣었는지” 확인. 이미 넣었으면 추가 생략. 같은 타임아웃이 연속 틱에서 들어와도 1회만 로그 추가.

### 변경 사항
- **pages/Game.jsx**
  - `lastAddedCareMistakeKeysRef = useRef(new Set())` 추가.
  - 케어미스 로그 블록에서 `eventKey = \`${timeoutOccurredAt}-${callType}\``(callType: hunger/strength/sleep/other) 계산 후, `lastAddedCareMistakeKeysRef.current.has(eventKey)`이면 로그 추가·setActivityLogs·updatedStats 반영 생략. 추가할 때만 `lastAddedCareMistakeKeysRef.current.add(eventKey)`.
- **docs/CAREMISTAKE_VS_INJURY_LOG_DEDUPE.md** (신규): 케어미스 vs 부상 이력 중복 차이 비교 문서.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/docs/CAREMISTAKE_VS_INJURY_LOG_DEDUPE.md` (신규)
- `docs/REFACTORING_LOG.md`

---

## [2025-02-08] 부상 이력 새로고침 없이 즉시 표시

### 작업 유형
- 🐛 버그 수정 (부상 이력이 새로고침해야만 보이는 현상)

### 목적 및 영향
- **원인:** 부상(똥 8개 등) 발생 시 틱에서 로그를 `updatedStats.activityLogs`에 넣고 `setDigimonStats(updatedStats)`로 반영하지만, (1) 해당 시점에 DB 저장을 하지 않아 다른 저장이 덮어쓸 수 있고, (2) StatsPopup이 `stats.activityLogs`만 참조해 틱에서 `setActivityLogs`로만 갱신된 로그가 반영되기 전에 보이지 않을 수 있음.
- **해결:** (1) 틱에서 똥 8개 부상이 발생한 경우(`injuryJustHappened`)에도 `setDigimonStatsAndSave(updatedStats)` 호출 → activityLogs·isInjured 등이 DB에 함께 저장되어 단일 소스 유지. (2) StatsPopup에 `activityLogs` prop 다시 전달하고, `displayActivityLogs`를 "prop이 stats.activityLogs 이상 길이일 때 prop 사용"으로 설정해 틱에서 `setActivityLogs` 직후에도 부상/케어미스 이력이 즉시 표시되도록 함.

### 변경 사항
- **pages/Game.jsx** (1초 틱)
  - 저장 조건에 `injuryJustHappened` 추가: `(updatedStats.poopCount || 0) > (prevStats.poopCount || 0) && updatedStats.isInjured && (updatedStats.poopCount || 0) >= 8`일 때도 `setDigimonStatsAndSave(updatedStats)` 호출.
- **components/GameModals.jsx**
  - StatsPopup에 `activityLogs={activityLogs}` 전달.
- **components/StatsPopup.jsx**
  - `activityLogs` prop 추가. `displayActivityLogs = (activityLogsProp != null && activityLogsProp.length >= statsLogs.length) ? activityLogsProp : statsLogs` 로 설정해 틱에서 갱신된 로그를 즉시 반영.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/GameModals.jsx`
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx`
- `docs/REFACTORING_LOG.md`

---

## [2025-02-08] 케어미스 이력 중복 방지 (isLogged + addActivityLog 멱등성)

### 작업 유형
- 🐛 버그 수정 (케어미스 발생 이력 1건인데 2건으로 중복 표시)

### 목적 및 영향
- **원인:** 타임아웃이 10분 지난 뒤 10분 1초, 10분 2초… 매 틱마다 "10분 초과"가 참이 되어 로그/카운트가 중복될 수 있고, applyLazyUpdate가 로드·액션 시마다 "아직 로그 없네?"라고 판단해 "[과거 재구성]" 로그를 또 추가하던 문제.
- **1. callStatus.isLogged:** 해당 호출(배고픔/힘)에 대해 케어미스 로그를 **한 번만** 남기도록, `callStatus.hunger.isLogged` / `callStatus.strength.isLogged` 플래그 추가. 타임아웃 시 `isLogged = true`로 설정하고 careMistakes 증가·로그 추가는 `!isLogged`일 때만 수행. 호출 해제(밥/훈련 등) 시 `isLogged = false`로 초기화. DB에 저장되어 새로고침 후 applyLazyUpdate가 재추가하지 않음.
- **2. addActivityLog 멱등성:** 케어미스(CAREMISTAKE) 로그 추가 전에, 동일 사유(배고픔 콜/힘 콜/수면) 로그가 **기준 시각 ±2분** 안에 이미 있으면 추가하지 않고 기존 배열 반환. 실시간 틱과 과거 재구성 경로가 둘 다 로그를 넣어도 한 번만 쌓이도록 함.
- **3. applyLazyUpdate:** 과거 재구성으로 케어미스 로그를 넣기 전에 `callStatus.hunger.isLogged` / `callStatus.strength.isLogged` 확인. 이미 true면 로그·careMistakes 증가 생략, 호출 상태만 정리.

### 변경 사항
- **hooks/useGameLogic.js**
  - callStatus 초기 형태에 `isLogged: false` 추가 (hunger, strength). 냉장고/리셋 시 `isLogged: false`.
  - **checkCallTimeouts:** 타임아웃 시 `!callStatus.hunger.isLogged`일 때만 careMistakes 증가 및 `isLogged = true`. 이미 isLogged면 상태만 정리.
  - **addActivityLog:** `hasDuplicateCareMistakeLog()` 도입. type CAREMISTAKE이고 텍스트에 '배고픔 콜'/'힘 콜'/'수면' 포함 시, 기존 로그 중 동일 사유·±2분 내 존재하면 새 로그 추가 안 함.
  - **resetCallStatus:** hunger/strength 리셋 시 `isLogged = false` 설정.
- **data/stats.js**
  - callStatus 기본값 및 merge 시 `isLogged: false` 포함. applyLazyUpdate에서 타임아웃 처리 전 `callStatus.hunger.isLogged` / `callStatus.strength.isLogged` 확인, 이미 로그됐으면 로그·카운트 생략 후 상태만 정리. 호출 리셋 시 `isLogged = false`.
- **pages/Game.jsx**
  - 틱에서 케어미스가 **방금** 증가한 경우(`careMistakeJustIncreased`)에도 `setDigimonStatsAndSave(updatedStats)` 호출 → activityLogs와 callStatus.isLogged를 DB에 함께 저장해 새로고침 후 재추가 방지.
- **data/defaultStatsFile.js**, **hooks/useFridge.js**: callStatus 생성 시 `isLogged: false` 추가.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/data/defaultStatsFile.js`
- `digimon-tamagotchi-frontend/src/hooks/useFridge.js`
- `docs/REFACTORING_LOG.md`

---

## [2025-02-08] 케어미스 데드라인 DB 저장 및 UI 데드라인 우선 사용

### 작업 유형
- 🐛 버그 수정 (새로고침 시 타임아웃 시간 초기화의 근본 해결)

### 목적 및 영향
- **발생 시점/데드라인을 DB에 저장:** 케어미스 타임아웃의 "생존 신고"가 메모리(리액트 상태)에서만 일어나 새로고침 시 초기화되던 문제. `birthTime`처럼 **변하지 않는 절대 기준**을 DB에 두기 위해 `hungerMistakeDeadline`/`strengthMistakeDeadline`을 도입해, 배고픔·힘 0 발생 시 **값이 없을 때만** 데드라인을 설정하고 DB에 저장. 새로고침·브라우저 종료 후 재접속해도 "10분 타임아웃" 판정이 유지됨.
- **수면 중 데드라인 푸시:** 수면 중에는 타임아웃이 멈추므로 `checkCallTimeouts`에서 `startedAt`을 now로 밀 때 **데드라인도 now+10분**으로 갱신. StatsPopup에서 이 데드라인을 쓰면 수면 중에도 남은 시간이 일관되게 표시됨.
- **타임아웃·리셋 시 데드라인 제거:** 타임아웃 발생 시 또는 배고픔/힘이 0이 아닐 때 `hungerMistakeDeadline`/`strengthMistakeDeadline`을 null로 설정해 중복 판정 방지.

### 변경 사항
- **data/v1/defaultStats.js**
  - `hungerMistakeDeadline`, `strengthMistakeDeadline` (null) 추가. DB 저장·로드 대상.
- **hooks/useGameLogic.js**
  - **checkCalls:** 배고픔/힘 0으로 호출이 막 활성화될 때, `hungerMistakeDeadline`/`strengthMistakeDeadline`이 **없을 때만** `lastHungerZeroAt`/`lastStrengthZeroAt + 10분`으로 설정. 호출 리셋 시 두 데드라인 null.
  - **checkCallTimeouts:** 수면 중 `startedAt` 푸시 시 `hungerMistakeDeadline`/`strengthMistakeDeadline`을 now+10분으로 갱신. 타임아웃 발생 시 두 데드라인 null.
- **components/StatsPopup.jsx**
  - Hunger Call / Strength Call 섹션: 남은 시간·데드라인 표시 시 **DB 데드라인 우선.** `deadlineMs = hungerMistakeDeadline || (startedAt + 10분)`, `remaining = max(0, deadlineMs - currentTime)`. 수면 중이어도 동일 공식 사용(수면 시 데드라인이 틱마다 갱신되므로 새로고침 후에도 일치).
- **pages/Game.jsx** (1초 틱)
  - `lastHungerZeroAt`/`lastStrengthZeroAt` 변경뿐 아니라 **hungerMistakeDeadline / strengthMistakeDeadline 변경 시**에도 `setDigimonStatsAndSave` 호출해 DB에 반영.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/v1/defaultStats.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `docs/REFACTORING_LOG.md`

---

## [2025-02-08] 케어미스 타임아웃 새로고침 유지 + 이력 중복 방지

### 작업 유형
- 🐛 버그 수정 (새로고침 시 데드라인 초기화, 케어미스 이력 중복)

### 목적 및 영향
- **새로고침 시 타임아웃/데드라인 초기화:** 호출(배고픔/힘 0)이 활성화되면 `lastHungerZeroAt`/`lastStrengthZeroAt`가 틱에서만 메모리에 반영되고, 사용자 액션 전까지 DB에 저장되지 않아 새로고침 시 "지금부터 10분"으로 리셋되던 문제. **호출이 막 활성화된 순간** DB에 한 번 저장하도록 해 새로고침 후에도 데드라인이 유지됨.
- **케어미스 [과거 재구성] 이력 중복:** applyLazyUpdate가 액션마다 호출될 때 같은 케어미스가 여러 번 쌓여 "16:22" 동일 시각 로그가 4건 나오던 문제. **alreadyHasLogInWindow**를 케어미스에만 재도입해, 같은 사유(배고픔 콜/힘 콜) 로그가 기준 시각 ±2분 안에 있으면 추가하지 않음. 진화 판정 카운터(careMistakes)는 기존대로 정상 연동.

### 변경 사항
- **pages/Game.jsx** (1초 틱)
  - `lastHungerZeroAt` 또는 `lastStrengthZeroAt`가 이전 틱 대비 새로 설정된 경우(호출 활성화) `setTimeout(..., 0)`으로 **setDigimonStatsAndSave(updatedStats)** 한 번 호출. Firestore에 저장되어 새로고침 후에도 데드라인 유지.
- **data/stats.js**
  - **alreadyHasLogInWindow(activityLogs, type, timeMs, textContains, windowMs = 120000)** 재추가. applyLazyUpdate에서 배고픔/힘 콜 타임아웃 케어미스 로그 추가 전에 **alreadyHasBackdatedLog**에 더해 **alreadyHasLogInWindow**로도 검사해 ±2분 안에 동일 사유 로그가 있으면 추가 생략.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/data/stats.js`

---

## [2025-02-08] 케어미스/부상 이력 중복 방지 및 실시간 이력 반영

### 작업 유형
- 🐛 버그 수정 (이력 중복, 실시간 미반영)

### 목적 및 영향
- **똥 부상/케어미스 중복:** 동일 이벤트가 "즉시 로그(1초 틱)"와 "과거 재구성(applyLazyUpdate)" 두 경로에서 각각 들어가 타임스탬프만 다르게 중복 쌓이던 문제. 동일 사유 로그가 기준 시각 ±2분 안에 있으면 추가하지 않도록 시간 윈도우 dedupe 적용.
- **실시간 이력 미반영:** 케어미스/부상 발생 시 StatsPopup이 `digimonStats.activityLogs`만 참조해, 1초 틱에서 `setActivityLogs`로만 추가된 로그는 새로고침 전까지 이력에 안 보이던 문제. 상위에서 `activityLogs` state를 넘기면 즉시 반영되도록 수정.

### 변경 사항
- **data/stats.js**
  - **alreadyHasLogInWindow(activityLogs, type, timeMs, textContains, windowMs = 120000)** 추가. 동일 타입·텍스트 패턴 로그가 기준 시각 ±2분 안에 있으면 true. 즉시 로그와 과거 재구성 로그가 서로 다른 시각으로 들어가는 중복 방지.
  - 똥 8개 부상(즉시/이미 8개/소급), 8시간 경과, 배고픔/힘 콜 타임아웃 케어미스: `alreadyHasBackdatedLog`에 더해 `alreadyHasLogInWindow`로도 검사 후 로그 추가.
- **hooks/useGameData.js** (applyLazyUpdateForAction)
  - 액션 전 Lazy Update 시 **현재 activityLogs state를 digimonStats와 병합**해 applyLazyUpdate에 전달. 1초 틱에서만 반영된 즉시 로그를 applyLazyUpdate 쪽에서도 보고, 이미 있으면 과거 재구성 로그를 추가하지 않음.
- **components/GameModals.jsx**
  - StatsPopup에 **activityLogs={gameState?.activityLogs}** 전달.
- **components/StatsPopup.jsx**
  - **activityLogs** prop 추가. 표시용으로 **displayActivityLogs = activityLogsProp ?? stats?.activityLogs ?? []** 사용. 케어미스/부상/수면 방해 이력 및 야행성 모드 토글 시 currentLogs에 displayActivityLogs 사용.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/components/GameModals.jsx`
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx`

---

## [2025-02-08] Game 화면 생성일 표시 및 슬롯 삭제 시 서브컬렉션 정리

### 작업 유형
- ✨ UX 개선 (생성일 포맷) / 🐛 버그 수정 (삭제 후 재생성 시 옛 로그 로드)

### 목적 및 영향
- **생성일:** Game 화면에서 생성일이 `1770523686372` 같은 숫자로만 보이던 것을 Select 화면처럼 사람이 읽기 쉬운 로케일 형식(예: `2026. 2. 8. 오후 1:30:16`)으로 표시.
- **슬롯 삭제:** Firestore에서 문서를 삭제해도 **서브컬렉션(logs, battleLogs)은 자동 삭제되지 않음**. 같은 슬롯 번호로 디지몬을 다시 만들면 옛 로그가 그대로 로드되어 "옛날거까지 불러오는 듯한" 현상이 발생. 슬롯 삭제 시 서브컬렉션을 먼저 비운 뒤 문서를 삭제하도록 변경.

### 변경 사항
- **utils/dateUtils.js**
  - **formatSlotCreatedAt(value)** 추가. 숫자(ms)는 `toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })`, 문자열(구 데이터)은 그대로 반환.
- **utils/firestoreHelpers.js** (신규)
  - **deleteSlotWithSubcollections(db, userId, slotId)** 추가. `logs`, `battleLogs` 서브컬렉션 내 모든 문서 삭제 후 슬롯 문서 삭제.
- **pages/Game.jsx**
  - `formatSlotCreatedAt` import 후 생성일 표시를 `{formatSlotCreatedAt(slotCreatedAt)}`로 변경.
- **pages/SelectScreen.jsx**
  - 로컬 `formatSlotCreatedAt` 제거, `dateUtils.formatSlotCreatedAt` 사용. 슬롯 삭제 시 `deleteDoc(slotRef)` 대신 `deleteSlotWithSubcollections(db, currentUser.uid, slotId)` 호출.
- **repositories/UserSlotRepository.js**
  - **deleteUserSlot**에서 `deleteDoc(slotRef)` 대신 `deleteSlotWithSubcollections(db, userId, slotId)` 사용.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/utils/dateUtils.js`
- `digimon-tamagotchi-frontend/src/utils/firestoreHelpers.js` (신규)
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
- `digimon-tamagotchi-frontend/src/repositories/UserSlotRepository.js`

---

## [2025-02-08] 로드 시 케어미스 발생 이력이 사라져 보이던 문제 수정

### 작업 유형
- 🐛 버그 수정 (케어미스 이력 표시)

### 목적 및 영향
- **목적:** 슬롯 로드 후 **케어미스 발생 이력**이 0건으로 보이거나 이전 이력이 사라진 것처럼 보이던 현상 수정. 진화 판정 카운터(Care Mistakes: N)는 1인데 이력은 0건으로 나오는 불일치 제거.
- **원인:** activityLogs는 서브컬렉션(logs)에만 저장되고, 로드 시 `setActivityLogs(logs)`로 state만 채워졌음. `setDigimonStats(savedStats)`에 넘기는 `savedStats`에는 서브컬렉션에서 읽은 로그가 들어가지 않아 `digimonStats.activityLogs`가 비어 있었고, StatsPopup은 `stats?.activityLogs`만 참조해 이력이 비어 보임.
- **영향:** 로드 시 서브컬렉션에서 읽은 로그를 `savedStats.activityLogs`에 넣은 뒤 `applyLazyUpdate` → `setDigimonStats` 하므로, StatsPopup에 케어미스 이력이 정상 표시됨. 서브컬렉션은 timestamp desc로 가져오므로, 이력 표시용으로 오래된 순으로 뒤집어 저장.

### 변경 사항
- **hooks/useGameData.js** (loadSlot)
  - Activity Logs 로드 시 `loadedActivityLogs` 변수에 담고, `setActivityLogs(loadedActivityLogs)` 호출 후 **`savedStats.activityLogs = [...loadedActivityLogs].reverse()`** 추가. 이후 `applyLazyUpdate(savedStats, ...)`가 전체 이력을 기준으로 동작하고, `setDigimonStats(savedStats)` 시 `digimonStats.activityLogs`에 전체 이력이 들어감.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`

---

## [2025-02-08] 케어미스/부상 이력 중복 및 진화 판정 카운터 보정

### 작업 유형
- 🐛 버그 수정 (이력 중복, 카운터 일치)

### 목적 및 영향
- **목적:** applyLazyUpdate가 액션/로드마다 호출될 때 같은 타임아웃·같은 부상 이벤트에 대해 **로그와 careMistakes가 반복 적용**되던 문제 수정. 이력은 중복 쌓이고 진화 판정용 careMistakes는 한 번만 증가해야 함.
- **영향:** 동일 이벤트(타입 + 타임스탬프 + 텍스트 패턴) 로그가 이미 있으면 **해당 호출에서는 로그 추가 및 careMistakes 증가를 하지 않음**. 호출 타임아웃 후에는 startedAt/null 처리만 하고, 로그·카운터는 한 번만 반영.

### 변경 사항
- **data/stats.js**
  - **alreadyHasBackdatedLog(activityLogs, type, timestampMs, textContains)** 헬퍼 추가. 기존 로그 배열에 동일 타입·타임스탬프·텍스트 패턴이 있으면 true 반환.
  - **호출 타임아웃(배고픔/힘 10분):** 타임아웃 시 `timeoutOccurredAt` 기준으로 이미 해당 케어미스 로그가 있으면 `careMistakes` 증가와 pushBackdatedActivityLog 호출을 생략. startedAt/null 리셋은 항상 수행.
  - **부상(똥 8개 즉시·소급·8시간 경과):** 해당 이벤트 시각으로 이미 "Too much poop" / "8시간 경과" 로그가 있으면 pushBackdatedActivityLog만 생략. isInjured/injuries 등 스탯 갱신은 기존대로 수행.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/stats.js`

### 참고
- 진화 판정 카운터(Care Mistakes: N)는 `stats.careMistakes`를 그대로 표시. 중복 적용이 제거되면 액션/저장 후 동일 값이 유지되어 이력 건수와 일치하기 쉬움.

---

## [2025-02-08] 똥 8개 8시간 방치 시 추가 부상 + 케어미스 동시 적용

### 작업 유형
- ✨ 기능 추가 (게임 규칙)

### 목적 및 영향
- **목적:** 똥 8개 유지 시 8시간마다 **추가 부상(injuries++)** 과 **케어미스(careMistakes++)** 를 둘 다 적용하도록 통일.
- **영향:** 기존에는 1초 틱(updateLifespan)에서 8시간 경과 시 케어미스만 증가했고, applyLazyUpdate에는 8시간 추가 부상 로직이 없었음. 이제 두 경로 모두에서 8시간마다 부상·케어미스 동시 적용.

### 변경 사항
- **data/stats.js**
  - **updateLifespan**: 8시간(28800초) 경과 시 `careMistakes++` 유지하고, `injuries++`, `injuredAt = Date.now()`, `isInjured = true`, `healedDosesCurrent = 0`, `lastMaxPoopTime` 리셋 추가.
  - **applyLazyUpdate**: 로컬 헬퍼 `getElapsedTimeExcludingFridge` 추가. "이미 8개였고" 분기에서 `lastMaxPoopTime` 기준 냉장고 제외 경과로 8시간 단위 개수(`periods`) 계산 후, `careMistakes`·`injuries`에 periods만큼 가산, `injuredAt`·`lastMaxPoopTime = now`, 과거 재구성 시 activityLog 1건 추가.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `digimon-tamagotchi-frontend/docs/TIME_BASED_CARE_AND_DEATH_ANALYSIS.md` (§10 정리)

---

## [2025-02-08] 똥 8개 도달 시 부상 "즉시" 적용

### 작업 유형
- ✨ 동작 변경 (게임 규칙)

### 목적 및 영향
- **목적:** 똥이 8개가 되는 **그 턴**에서 바로 부상 적용(기존: 다음 applyLazyUpdate 호출 시 소급).
- **영향:** 1초 틱에서 8이 되면 약 1초 이내 화면에 부상 반영. 액션 없이도 UI와 로직 일치.

### 변경 사항
- **data/stats.js**
  - **applyLazyUpdate**: `poopCount === 8 && !lastMaxPoopTime` 블록에서 `lastMaxPoopTime` 설정 직후, 동일 턴에 `isInjured`/`injuredAt`/`injuries`/`healedDosesCurrent`/`injuryReason`/activityLog 설정.
  - **updateLifespan**: `poopCount === 8 && !lastMaxPoopTime` 블록에서 `lastMaxPoopTime` 설정 직후 `isInjured`/`injuredAt`/`injuries`/`healedDosesCurrent`/`injuryReason` 설정(1초 틱에서는 activityLog 미추가).
- 기존 "이미 8개 이상"·"이미 8개였고" 소급 분기는 로드/과거 재구성용으로 유지.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `digimon-tamagotchi-frontend/docs/TIME_BASED_CARE_AND_DEATH_ANALYSIS.md` (§10)

---

## [2025-02-08] 절대 시각/데드라인 기반 시간 판정 1차 적용

### 작업 유형
- 🐛 버그 수정 + 리팩터링 (시간 판정)

### 목적 및 영향
- **목적:** 카운터 기반이 아닌 **절대 시각(데드라인)** 기반으로 전환. `T_rem = max(0, T_deadline - T_now)` 일관성 확보. 부상 발생 시각 소급 적용, syncCallStatus 덮어쓰기 방지, UI 경과/남은 시간 클램프.
- **영향:** applyLazyUpdate에서 부상 시각을 시뮬레이션 시각으로만 설정, callStatus startedAt 미래 방지, syncCallStatus에서 lastHungerZeroAt/lastStrengthZeroAt 복원 시 now 덮어쓰기 제거, StatsPopup에서 모든 경과/남은 시간에 Math.max(0, ...) 적용.

### 변경 사항
- **data/stats.js**: (1) "이미 8개였고 부상 없음" 분기에서 `injuredAt`을 `lastMaxPoopTime` 기반 소급 시각으로 설정. (2) Hunger/Strength 호출 수면 보정 시 `startedAt = Math.min(now.getTime(), pushedStart)`.
- **useGameLogic.js**: syncCallStatus에서 `lastHungerZeroAt`/`lastStrengthZeroAt`이 있으면 `startedAt` 및 해당 필드를 그대로 복원, 없을 때만 `now` 사용.
- **StatsPopup.jsx**: getElapsedTimeExcludingFridge 모든 반환에 Math.max(0, ...). 케어미스/사망/똥/부상 방치 남은 시간에 `remaining = Math.max(0, threshold - elapsed)` 적용.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx`

### 후속 (동일일)
- **과거 재구성 시 이력 생성**: applyLazyUpdate에서 부상(똥 8개) 또는 케어미스(호출 타임아웃)가 발생한 것으로 재구성될 때, 해당 **시뮬레이션 시각**으로 activityLogs에 로그 추가. `pushBackdatedActivityLog` 헬퍼 추가, POOP(부상)/CAREMISTAKE 로그 4곳 적용. 부상 이력·케어미스 이력이 0건으로 나오던 문제 완화.
- **호출부에서 서브컬렉션 반영**: useGameData에서 applyLazyUpdate 호출 후 추가된 로그만 `slice`해 `appendLogToSubcollection(log)` 호출. `applyLazyUpdateForAction`·`loadSlot` 두 곳 적용. 로그가 서브컬렉션에만 저장되는 구조에서도 과거 재구성 로그가 유지되도록 함.

### 참고
- `digimon-tamagotchi-frontend/docs/TIME_BASED_CARE_AND_DEATH_ANALYSIS.md` (§9 적용 완료)

---

## [2026-01-28] Refactor: 배틀 로그 서브컬렉션(battleLogs) 분리

### 작업 유형
- ♻️ 리팩토링 (Firestore 저장 구조)

### 목적 및 영향
- **목적:** `battleLogs`를 슬롯 문서가 아닌 서브컬렉션 `users/{uid}/slots/slot{N}/battleLogs`에 저장하여 활동 로그와 동일한 패턴으로 통일, 슬롯 문서 크기·쓰기 비용 절감.
- **영향:** 저장 시 슬롯 문서에서 `battleLogs` 제외. 배틀 발생 시 `appendBattleLogToSubcollection(entry)`로 서브컬렉션에만 추가. 로드 시 `battleLogs` 서브컬렉션 쿼리(또는 fallback으로 기존 문서의 `battleLogs`).

### 변경 사항
- **useGameData.js**: saveStats에서 `battleLogs` 제외, loadSlot에서 `battleLogs` 서브컬렉션 쿼리(orderBy timestamp desc, limit 100), `appendBattleLogToSubcollection(entry)` 추가·반환.
- **useGameActions.js**: 파라미터에 `appendBattleLogToSubcollection` 추가. 스파링·아레나·에너지 부족 스킵·퀘스트 승/패 시 동일 entry로 `appendBattleLogToSubcollection(entry).catch(() => {})` 호출(5곳).
- **Game.jsx**: useGameData에서 `appendBattleLogToSubcollection` destructure, useGameActions에 전달.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/docs/ACTIVITY_VS_BATTLE_LOGS_SUBCOLLECTION.md`

### 참고
- Firestore에서 `battleLogs` 서브컬렉션에 `orderBy("timestamp","desc")` 쿼리 사용 시 복합 인덱스 필요할 수 있음. 에러 링크 따라 인덱스 생성하면 됨.

---

## [2026-01-28] Refactor: Activity Logs 전면 서브컬렉션(방안 A) 적용

### 작업 유형
- ♻️ 리팩토링 (Firestore 저장 구조)

### 목적 및 영향
- **목적:** `activityLogs`를 슬롯 문서가 아닌 서브컬렉션 `users/{uid}/slots/slot{N}/logs`에만 저장하여 문서 크기·쓰기 비용 절감.
- **영향:** 저장 시 슬롯 문서에서 `activityLogs` 제외, 로그 추가 시마다 `logs` 서브컬렉션에만 `addDoc`. 로드 시 `logs` 쿼리(또는 fallback으로 기존 문서의 `activityLogs`).

### 변경 사항
- **useGameData.js**: saveStats에서 `activityLogs` 제외, loadSlot에서 `logs` 서브컬렉션 쿼리, `appendLogToSubcollection(logEntry)` 추가·반환.
- **Game.jsx**: 1초 타이머(CALL, CARE_MISTAKE, POOP, DEATH), resetDigimon(NEW_START), handlers에 `appendLogToSubcollection` 포함.
- **useGameActions, useGameAnimations, useGameHandlers, useEvolution, useDeath, useFridge**: 파라미터에 `appendLogToSubcollection` 추가, 로그 추가 직후 `appendLogToSubcollection(마지막 로그).catch(() => {})` 호출.
- **GameModals.jsx**: handlers에서 `appendLogToSubcollection` 사용, DIET/REST/DETOX/PLAY_OR_SNACK/CAREMISTAKE 및 수면방해 처리 시 서브컬렉션 기록, StatsPopup에 prop 전달.
- **StatsPopup.jsx**: `appendLogToSubcollection` prop 추가, 야행성 모드 ACTION 로그 추가 시 호출.
- **docs/ACTIVITY_LOGS_AND_SUBCOLLECTION.md**: §5 방안 A 적용 완료 및 기존 슬롯 마이그레이션 안내 추가.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameAnimations.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameHandlers.js`
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
- `digimon-tamagotchi-frontend/src/hooks/useDeath.js`
- `digimon-tamagotchi-frontend/src/hooks/useFridge.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/GameModals.jsx`
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx`
- `digimon-tamagotchi-frontend/docs/ACTIVITY_LOGS_AND_SUBCOLLECTION.md`

---

## [2026-01-28] Refactor: 시간 필드 숫자(ms) 통일 및 null 필드 정리

### 작업 유형
- ♻️ 리팩토링 (데이터 정밀도·용량 개선)

### 목적 및 영향
- **목적:** Firestore 저장 데이터의 정렬·비교 효율 향상 및 불필요 필드 누적 방지. 기존 문자열 날짜 데이터는 하위 호환 유지.
- **영향:** 새 슬롯은 `createdAt` 숫자(ms), 일일 수면 케어 미스는 `sleepMistakeDate` 해당일 0시 ms. 표시 시에만 포맷. 저장 시 null/undefined 제거(cleanObject)로 문서 크기·가독성 개선.

### 변경 사항

#### 1. `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
- 슬롯 생성 시 `createdAt: now.getTime()` (숫자 ms) 저장. `createdAtStr` 제거.
- `formatSlotCreatedAt(value)` 추가: 숫자면 `new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })`, 문자열(구 데이터)이면 그대로 표시.
- 슬롯 카드·순서변경 모달에서 생성일 표시를 `formatSlotCreatedAt(slot.createdAt)` 사용.

#### 2. `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- 1초 타이머 내 일자 변경 감지: `todayStartMs = new Date(y,m,d).getTime()`, `sleepMistakeDate` 비교 시 숫자면 `!== todayStartMs`, 문자열이면 `!== toDateString()` 호환.
- 새 날이면 `sleepMistakeDate = todayStartMs`, `dailySleepMistake = false`.
- 수면 케어 미스 발생 시 `sleepMistakeDate = todayStartMs`로 기록 (저장 시 새 형식으로 유지).

#### 3. `digimon-tamagotchi-frontend/docs/FIREBASE_SLOT_STORAGE.md`
- §6.1 적용 완료: cleanObject, createdAt 숫자(ms), sleepMistakeDate 해당일 0시 ms 정리.
- §8 다음 단계: 3·4번에 적용 완료 사항 반영.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/docs/FIREBASE_SLOT_STORAGE.md`

---

## [2026-01-28] Fix: BlitzGreymon·CresGarurumon 등 v1·v2 공통 ID 버전별 데이터 사용

### 작업 유형
- 🐛 버그 수정

### 목적 및 영향
- **목적:** v2에서 BlitzGreymon, CresGarurumon으로 ID 변경 후, merge 시 v2가 v1을 덮어써 Ver.1 슬롯에서 잘못된 스프라이트/스탯이 나오던 문제 수정
- **영향:** 슬롯 버전(Ver.1/Ver.2)에 따라 올바른 디지몬 데이터 사용. Ver.1 슬롯은 v1 전용 맵, Ver.2 슬롯은 v2 우선(공통 ID 시 v2) 맵 사용

### 변경 사항

#### 1. `src/pages/Game.jsx`
- `adaptedV1` = adaptDataMapToOldFormat(v1만), `mergedAdapted` = adaptDataMapToOldFormat(v1+v2 merge) 추가
- `digimonDataForSlot` = slotVersion === "Ver.2" ? mergedAdapted : adaptedV1
- `evolutionDataForSlot` = slotVersion === "Ver.2" ? mergedDigimonData : newDigimonDataVer1
- useGameData, useEvolution, useDeath, useGameHandlers, useGameAnimations, GameModals에 `digimonDataVer1` 대신 `digimonDataForSlot` 전달
- evolution·이름 lookup에 `evolutionDataForSlot` 사용. 스프라이트/수면/초기화 등에 `digimonDataForSlot` 사용
- useGameState에는 초기 상태용으로 `adaptedV1` 전달

#### 2. `src/pages/SelectScreen.jsx`
- `mergedDigimonData` 제거, `getDigimonDataForSlot(digimonId, slotVersion)` 도입
- 슬롯별 디지몬 이름/placeholder는 `getDigimonDataForSlot(slot.selectedDigimon, slot.version)` 사용

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`

---

## [2026-01-28] Refactor: v2 digimons.js를 v1과 동일 구조로 구성 (사망/알 Ver.2 전용 ID)

### 작업 유형
- ♻️ 리팩토링

### 목적 및 영향
- **목적:** v2 디지몬 데이터를 v1/digimons.js와 동일한 스키마·항목 구성으로 통일. 오하카다몬V2·디지타마V2는 공통으로 쓰지 않고 Ver.2 전용 ID 사용
- **영향:** Ver.2 전용 사망 폼(Ohakadamon1V2/Ohakadamon2V2), 알(DigitamaV2), Baby I/II(Punimon, Tsunomon) 및 Child~Super Ultimate 라인까지 v1과 동일 구조. 디지몬 이름(name)은 사용자가 직접 수정

### 변경 사항

#### 1. `src/data/v2modkor/digimons.js`
- v1과 동일한 JSDoc 스키마 + `spriteBasePath`, `V2_SPRITE_BASE` 유지
- 사망: `Ohakadamon1V2`, `Ohakadamon2V2` (이름 placeholder: "사망(일반)", "사망(perfect)")
- 알: `DigitamaV2` (이름 placeholder: "알") → 8초 후 Punimon
- Baby I: Punimon → Tsunomon
- Baby II: Tsunomon → GabumonV2, BetamonV2 (v1 Koromon과 동일 조건 구조)
- Child~Super Ultimate: GabumonV2, BetamonV2, GreymonV2, … OmegamonAlterSV2, CresGarurumonV2 (v1과 동일 진화/스탯 구조, sprite 번호·이름은 placeholder)

#### 2. Ver.2 사망/알/진화 연동
- **useDeath.js:** Ver.2일 때 `Ohakadamon1V2`/`Ohakadamon2V2` 사용. 도감 업데이트 시 `DigitamaV2` 제외
- **Game.jsx:** `DEATH_FORM_IDS`에 Ohakadamon1V2, Ohakadamon2V2 추가. resetDigimon 시 Ver.2면 `DigitamaV2`로 초기화. DigitamaV2 수면/idle 처리. 진화·이름 lookup에 `mergedDigimonData` 사용
- **DeathPopup.jsx:** 사망 폼 판별에 Ohakadamon1V2, Ohakadamon2V2 포함
- **EncyclopediaModal.jsx:** 사망 폼 제외를 `stage !== "Ohakadamon"`만 사용

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/v2modkor/digimons.js`
- `digimon-tamagotchi-frontend/src/hooks/useDeath.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/DeathPopup.jsx`
- `digimon-tamagotchi-frontend/src/components/EncyclopediaModal.jsx`

---

## [2026-01-28] Fix: Ver.2 슬롯 로드 시 초기 디지몬 푸니몬(Punimon) 유지

### 작업 유형
- 🐛 버그 수정

### 목적 및 영향
- **목적:** Ver.2 슬롯을 열었을 때 저장된 `selectedDigimon`(Punimon)이 깜몬(Digitama/Botamon)으로 덮어씌워지던 문제 수정
- **영향:** Ver.2 슬롯 로드 시 푸니몬이 올바르게 표시됨. 빈 스탯인 새 Ver.2 슬롯도 Punimon으로 초기화

### 변경 사항

#### `src/hooks/useGameData.js`
- `savedName`: `slotData.selectedDigimon`이 없을 때 Ver.2면 `"Punimon"`, Ver.1이면 `"Digitama"`로 기본값 설정
- `savedStats`가 비어 있을 때(새 디지몬): `initializeStats("Digitama", ...)` / `setSelectedDigimon("Digitama")` 대신 **저장된 이름(`savedName`)** 으로 초기화하여 Ver.2 슬롯의 Punimon 유지

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`

---

## [2026-01-28] Feat: SelectScreen Ver.2 선택 기능 및 도감 Ver.2 별도 관리

### 작업 유형
- ✨ 기능 추가

### 목적 및 영향
- **목적:** 선택 화면에서 Ver.2 선택 가능, Ver.2 선택 시 Punimon으로 시작. 도감에서 Ver.1과 Ver.2를 별도로 관리
- **영향:** 사용자가 Ver.2를 선택하면 Punimon으로 시작하며, 도감에서 Ver.1/Ver.2 탭으로 분리하여 관리

### 변경 사항

#### 1. `src/pages/SelectScreen.jsx`
- Ver.2 옵션 활성화 (disabled 제거)
- Ver.2 선택 시 `selectedDigimon: "Punimon"`으로 시작 (Ver.1은 "Digitama")
- v1+v2 merge된 데이터로 디지몬 이름 표시

#### 2. `src/hooks/useEncyclopedia.js`
- `updateEncyclopedia`에 `version` 파라미터 추가 (기본값 "Ver.1")
- Ver.2 도감 데이터를 `encyclopedia["Ver.2"]`에 별도 저장

#### 3. `src/hooks/useEvolution.js`, `src/hooks/useDeath.js`
- `version` 파라미터 추가 (기본값 "Ver.1")
- `updateEncyclopedia` 호출 시 `version` 전달

#### 4. `src/pages/Game.jsx`
- `useEvolution`, `useDeath` 호출 시 `slotVersion || "Ver.1"` 전달

#### 5. `src/components/EncyclopediaModal.jsx`
- Ver.2 탭 추가 (Ver.1과 별도 표시)
- `selectedVersion`에 따라 v1/v2 디지몬 목록 표시
- v2 디지몬 스프라이트 경로 (`spriteBasePath`) 처리
- 도감 강제 업데이트 시 v2 디지몬도 처리

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
- `digimon-tamagotchi-frontend/src/hooks/useEncyclopedia.js`
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
- `digimon-tamagotchi-frontend/src/hooks/useDeath.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/EncyclopediaModal.jsx`

---

## [2026-01-28] Feat: Ver.2 푸니몬 테스트 추가 및 v2 스프라이트 경로(Ver2_Mod_Kor) 반영

### 작업 유형
- ✨ 기능 추가

### 목적 및 영향
- **목적:** v2 디지몬 테스트로 푸니몬 추가, v2 스프라이트를 `public/Ver2_Mod_Kor` 경로에서 로드하도록 반영
- **영향:** Game.jsx에서 v1+v2 merge 후 adapter 적용. Punimon 선택 시 Canvas가 `/Ver2_Mod_Kor/210.png` 등으로 이미지 로드

### 변경 사항

#### 1. `src/data/v2modkor/digimons.js`
- 푸니몬(Punimon) 엔트리 추가: Baby I, sprite 210, `spriteBasePath: '/Ver2_Mod_Kor'`
- `V2_SPRITE_BASE` export 추가

#### 2. `src/data/v1/adapter.js`
- `adaptNewDataToOldFormat`에 `spriteBasePath` 전달 추가 (v2 UI 경로용)

#### 3. `src/pages/Game.jsx`
- `digimonDataVer2` import, v1+v2 merge 후 `adaptDataMapToOldFormat(mergedDigimonData)` 적용
- `digimonImageBase = digimonData?.spriteBasePath || "/images"` 계산 후 GameScreen에 `digimonImageBase` prop 전달

#### 4. `src/components/GameScreen.jsx`
- `digimonImageBase` prop 추가 (기본값 `/images`), Canvas에 전달

#### 5. `src/components/Canvas.jsx`
- `digimonImageBase` prop 추가 (기본값 `/images`)
- 디지몬 프레임 이미지 경로: `/images/${fn}.png` → `${digimonImageBase}/${fn}.png`

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/v2modkor/digimons.js`
- `digimon-tamagotchi-frontend/src/data/v2modkor/index.js`
- `digimon-tamagotchi-frontend/src/data/v1/adapter.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/GameScreen.jsx`
- `digimon-tamagotchi-frontend/src/components/Canvas.jsx`

---

## [2026-01-28] Refactor: 미사용 데이터 nonuse 이동 및 v2 버전 관리 폴더(v2modkor) 추가

### 작업 유형
- ♻️ 리팩토링

### 목적 및 영향
- **목적:** 미사용 데이터 파일을 `data/nonuse/` 아래로 정리하고, v2 디지몬 버전 관리를 위해 `src/data/v2modkor/` 구조 추가
- **영향:** 기존 앱 동작 변경 없음. 데이터 참조는 모두 v1/digimons.js만 사용 중이므로 이동한 파일은 미사용 상태 유지

### 변경 사항

#### 1. 미사용 파일 → `src/data/nonuse/` 이동
- `digimondata_digitalmonstercolor25th_ver1.js` → `nonuse/digimondata_digitalmonstercolor25th_ver1.js`
- `digimondata_digitalmonstercolor25th_ver2.js` → `nonuse/digimondata_digitalmonstercolor25th_ver2.js`
- `evolution_digitalmonstercolor25th_ver1.js` → `nonuse/evolution_digitalmonstercolor25th_ver1.js`  
- 원본 파일은 삭제 (내용은 nonuse 아래에 보존)

#### 2. v2 버전 관리 폴더 추가: `src/data/v2modkor/`
- `v2modkor/digimons.js`: `digimonDataVer2` export (v1과 동일 스키마, 현재 빈 객체)
- `v2modkor/index.js`: re-export  
- Ver.2 라인(푸니몬, 쯔노몬 등) 추가 시 이 폴더에 정의하여 버전별로 관리

#### 3. 문서 수정
- `digimon-tamagotchi-frontend/docs/DIGIMON_DATA_AND_V2_GUIDE.md`: 미사용 파일 경로를 nonuse 기준으로 수정, v2 추가 방법을 v2modkor 기준으로 수정

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/nonuse/` (신규 3개 파일)
- `digimon-tamagotchi-frontend/src/data/v2modkor/digimons.js` (신규)
- `digimon-tamagotchi-frontend/src/data/v2modkor/index.js` (신규)
- `digimon-tamagotchi-frontend/src/data/digimondata_digitalmonstercolor25th_ver1.js` (삭제)
- `digimon-tamagotchi-frontend/src/data/digimondata_digitalmonstercolor25th_ver2.js` (삭제)
- `digimon-tamagotchi-frontend/src/data/evolution_digitalmonstercolor25th_ver1.js` (삭제)
- `digimon-tamagotchi-frontend/docs/DIGIMON_DATA_AND_V2_GUIDE.md`

---

## [2026-01-28] Fix: 티라노몬 수면 중 데블몬 스프라이트 표시 버그 수정 (2차 수정)

### 작업 유형
- 🐛 버그 수정

### 목적 및 영향
- **문제:** 티라노몬이 수면 중일 때 데블몬 스프라이트가 표시되고, 수면 중인데도 수면 호출 배지가 표시되는 버그
- **원인:** 
  1. 모든 프레임 계산에서 `digimonStats.sprite`를 사용하여 데이터 불일치 발생
  2. 수면 중일 때 수면 호출을 비활성화하는 로직 누락
- **해결:** 모든 프레임 계산을 `selectedDigimon`에서 직접 스프라이트를 가져오도록 수정, 수면 중 수면 호출 비활성화 로직 추가

### 변경 사항

#### 1. `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- **위치:** 920-983줄
- **변경 내용:**
  - 모든 프레임 계산(일반, 죽음, 부상, 수면)에서 `selectedDigimon`에서 직접 스프라이트 가져오기
  - `baseSprite` 변수를 한 번만 계산하여 모든 프레임 계산에 사용
  - 데이터 일관성 보장

```javascript
// 변경 전: 각 프레임 계산마다 digimonStats.sprite 사용
idleFrames= idleOff.map(n=> `${digimonStats.sprite + n}`);
idleFrames= [ `${digimonStats.sprite+14}` ];
idleFrames = [`${digimonStats.sprite + 13}`, `${digimonStats.sprite + 14}`];

// 변경 후: baseSprite를 한 번만 계산하여 모든 곳에서 사용
const digimonData = digimonDataVer1[selectedDigimon];
const baseSprite = digimonData?.sprite ?? digimonStats.sprite;
idleFrames= idleOff.map(n=> `${baseSprite + n}`);
idleFrames= [ `${baseSprite+14}` ];
idleFrames = [`${baseSprite + 13}`, `${baseSprite + 14}`];
```

#### 2. `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- **위치:** 520-533줄
- **변경 내용:**
  - 수면 중일 때 수면 호출 비활성화 로직 추가
  - `isActuallySleeping`이 true일 때 수면 호출 즉시 비활성화

```javascript
// 변경 전
if (isSleepTime && isLightsOn && !callStatus.sleep.isActive) {
  callStatus.sleep.isActive = true;
  callStatus.sleep.startedAt = now.getTime();
}

// 변경 후
if (isActuallySleeping) {
  // 실제로 잠들었으면 수면 호출 비활성화
  callStatus.sleep.isActive = false;
  callStatus.sleep.startedAt = null;
} else {
  // 잠들지 않았을 때만 수면 호출 체크
  // ... 기존 로직 ...
}
```

### 해결된 문제
1. ✅ 티라노몬 수면 중 올바른 스프라이트(301, 302) 표시
2. ✅ 모든 상태(일반, 죽음, 부상, 수면)에서 올바른 스프라이트 표시
3. ✅ 수면 중일 때 수면 호출 배지 비활성화
4. ✅ 데이터 일관성 보장

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`

### 관련 문서
- `docs/TYRANOMON_SLEEP_SPRITE_BUG_ANALYSIS.md` - 상세 분석 문서

---

## [2026-01-28] Fix: 티라노몬 수면 중 데블몬 스프라이트 표시 버그 수정 (1차 수정)

### 작업 유형
- 🐛 버그 수정

### 목적 및 영향
- **문제:** 티라노몬이 수면 중일 때 데블몬 스프라이트가 표시되는 버그
- **원인:** `selectedDigimon`과 `digimonStats.sprite` 값이 불일치하여 수면 프레임 계산이 잘못됨
- **해결:** 수면 프레임 계산 시 `selectedDigimon`에서 직접 스프라이트를 가져오도록 수정

### 변경 사항

#### 1. `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- **위치:** 971-979줄
- **변경 내용:**
  - 수면 프레임 계산 시 `digimonStats.sprite` 대신 `selectedDigimon`에서 직접 스프라이트 가져오기
  - 데이터 일관성 보장을 위해 `digimonDataVer1[selectedDigimon]?.sprite` 우선 사용
  - `digimonStats.sprite`는 fallback으로만 사용

```javascript
// 변경 전
idleFrames = [`${digimonStats.sprite + 11}`, `${digimonStats.sprite + 12}`];

// 변경 후
const digimonData = digimonDataVer1[selectedDigimon];
const baseSprite = digimonData?.sprite ?? digimonStats.sprite;
idleFrames = [`${baseSprite + 11}`, `${baseSprite + 12}`];
```

#### 2. `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
- **위치:** 209줄 근처
- **변경 내용:**
  - 진화 시 스프라이트 값 강제 동기화 추가
  - `initializeStats` 후 `digimonDataVer1`에서 직접 스프라이트 가져와서 덮어쓰기

```javascript
const nx = initializeStats(newName, resetStats, digimonDataVer1);

// 스프라이트 값 강제 동기화 (데이터 일관성 보장)
if (newDigimonData?.sprite !== undefined) {
  nx.sprite = newDigimonData.sprite;
}
```

#### 3. `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- **위치:** 461줄 근처
- **변경 내용:**
  - 슬롯 로드 시 `selectedDigimon`과 `digimonStats.sprite` 일치 여부 확인
  - 불일치 시 자동으로 올바른 스프라이트 값으로 수정

```javascript
// 스프라이트 값 동기화 확인 (데이터 일관성 보장)
if (digimonDataVer1 && savedName && digimonDataVer1[savedName]) {
  const expectedSprite = digimonDataVer1[savedName].sprite;
  if (expectedSprite !== undefined && savedStats.sprite !== expectedSprite) {
    console.warn("[loadSlot] 스프라이트 불일치 감지 및 수정:", {
      selectedDigimon: savedName,
      savedSprite: savedStats.sprite,
      expectedSprite: expectedSprite,
    });
    savedStats.sprite = expectedSprite;
  }
}
```

### 해결된 문제
1. ✅ 티라노몬 수면 중 올바른 스프라이트 표시
2. ✅ 진화 후 스프라이트 값 자동 동기화
3. ✅ 기존 불일치 데이터 자동 수정

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`

### 관련 문서
- `docs/TYRANOMON_SLEEP_SPRITE_BUG_ANALYSIS.md` - 상세 분석 문서

---
# 2026-03-29

## PR 리뷰 문서 추가

- `codex analyze/digimon-tamagotchi-frontend-pr-review.md` 문서를 추가했다.
- 현재 코드베이스를 PR 리뷰 형식으로 검토해 correctness, regression risk, missing tests 관점의 우선순위 높은 위험 지점을 정리했다.
- 중점 검토 영역은 시간 기반 스탯 변경, lazy update, 진화 조건, 배틀 계산, 저장 시점, 모달 상태 관리였다.

### 영향받은 파일

- `codex analyze/digimon-tamagotchi-frontend-pr-review.md`
- `docs/REFACTORING_LOG.md`

### 비고

- 애플리케이션 코드는 수정하지 않았고 분석 문서만 추가했다.
# 2026-03-29

## code-mapper 구조 분석 문서 추가 (`codex analyze_2`)

- `codex analyze_2/1_digimon-tamagotchi-frontend-code-mapper-structure-analysis.md` 문서를 추가했다.
- `App.jsx`, `Game.jsx`, `hooks`, `logic`, `repositories`, `data/v1`를 기준으로 실제 호출 흐름, 상태 경계, Firebase/localStorage 경계, lazy update 적용 지점을 다시 정리했다.
- 특히 문서상 dual-storage 설명과 실제 Firebase 중심 런타임의 차이, `Game.jsx`의 controller 비대화, `useGameData`에 집중된 영속성 경계를 핵심 관찰 포인트로 기록했다.

### 영향받은 파일

- `codex analyze_2/1_digimon-tamagotchi-frontend-code-mapper-structure-analysis.md`
- `docs/REFACTORING_LOG.md`

### 비고

- 애플리케이션 코드는 수정하지 않았고 분석 문서만 추가했다.
# 2026-03-29

## 성능 리뷰 문서 추가

- `codex analyze/digimon-tamagotchi-frontend-performance-review.md` 문서를 추가했다.
- lazy update 준수 여부, 루트 리렌더링 압력, Canvas 초기화 비용, Firestore read/write 비용, 저장 빈도 리스크를 중심으로 성능 관점 분석을 정리했다.
- 특히 `Game.jsx`의 1초 타이머 구조, `Canvas` 재초기화 패턴, `saveStats` 경로의 Firestore 비용, 슬롯 문서 구독에 따른 리렌더 전파를 우선순위 높게 다뤘다.

### 영향받은 파일

- `codex analyze/digimon-tamagotchi-frontend-performance-review.md`
- `docs/REFACTORING_LOG.md`

### 비고

- 애플리케이션 코드는 수정하지 않았고 분석 문서만 추가했다.
# 2026-03-29

## 게임 규칙 리뷰 문서 추가

- `codex analyze/digimon-tamagotchi-frontend-game-rules-review.md` 문서를 추가했다.
- 진화 조건, 케어미스, 배틀 명중률/파워, 사망 조건, 시간 기반 스탯 변화, 훈련/먹이 규칙의 도메인 일관성을 중심으로 분석했다.
- 특히 실시간 규칙과 lazy update 규칙의 불일치, 수면 중 콜 타이머 처리, 아레나 배틀 데이터 해석, 중복된 규칙 소스 파일을 우선순위 높게 정리했다.

### 영향받은 파일

- `codex analyze/digimon-tamagotchi-frontend-game-rules-review.md`
- `docs/REFACTORING_LOG.md`

### 비고

- 애플리케이션 코드는 수정하지 않았고 분석 문서만 추가했다.
# 2026-03-29

## 안전한 리팩터링 로드맵 문서 추가

- `codex analyze/6_digimon-tamagotchi-frontend-safe-refactoring-roadmap.md` 문서를 추가했다.
- 현재 구조 분석 결과를 바탕으로 `Game.jsx`와 대형 Hook들을 behavior preserving 원칙으로 나누는 단계별 리팩터링 순서를 정리했다.
- 각 단계마다 목표, 영향 파일, 기대 효과, 회귀 위험을 함께 기록했다.

### 영향받은 파일

- `codex analyze/6_digimon-tamagotchi-frontend-safe-refactoring-roadmap.md`
- `docs/REFACTORING_LOG.md`

### 비고

- 애플리케이션 코드는 수정하지 않았고 분석 문서만 추가했다.
# 2026-03-29

## Lifespan NaN 방어 수정

### 변경 내용
- `lifespanSeconds`가 `undefined`/`NaN`일 때 `NaN` 전파가 발생하지 않도록 초기화/실시간/lazy update 경로에 숫자 보정을 추가했다.
- 디버그 패널의 `Lifespan`, `Time to Evolve` 표시 포맷터에도 안전 장치를 넣어 화면에 `NaN`이 직접 노출되지 않게 했다.

### 영향 파일
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `digimon-tamagotchi-frontend/src/logic/stats/stats.js`
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx`

### 근거
- 새 슬롯 진입 직후 디버그 패널에서 `Lifespan: NaN`이 재현되었고, `lifespanSeconds`를 숫자로 가정하고 바로 누적하는 경로가 존재했다.
- 시간 기반 규칙 전체를 흔드는 증상이므로 다른 규칙 조사 전에 먼저 안전하게 막는 쪽이 우선순위가 높았다.

# 2026-03-29

## 진화 후 새로고침 시 표시 디지몬 롤백 방어

### 변경 내용
- `saveStats()`가 루트 `selectedDigimon`을 오래된 Hook 클로저 값으로 다시 쓰지 않도록, `newStats.selectedDigimon`을 우선 사용하는 저장 경로를 추가했다.
- 메모리 상태(`digimonStats`)에도 현재 디지몬 ID를 함께 유지하고, Firestore의 `digimonStats` 중첩 객체에는 중복 저장하지 않도록 분리했다.
- 일반 진화, 조그레스 진화, 사망 폼 전환, 새 시작 시 생성되는 새 스탯 객체에 `selectedDigimon`을 함께 실어 저장/새로고침 후 단계 불일치가 생기지 않도록 맞췄다.
- 슬롯 로드 시에도 `digimonStats.selectedDigimon`을 현재 루트 선택값과 동기화하도록 보강했다.

### 영향 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
- `digimon-tamagotchi-frontend/src/hooks/useDeath.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/utils/masterDataUtils.js`

### 근거
- 진화 직후에는 `timeToEvolveSeconds`와 내부 스탯이 다음 단계 기준으로 저장되는데, 새로고침 후 루트 `selectedDigimon`만 이전 디지몬으로 돌아가는 불일치가 재현되었다.
- 일반 진화 경로가 `setDigimonStatsAndSave()`와 `setSelectedDigimonAndSave()`를 분리 호출하고 있었고, `saveStats()`가 오래된 `selectedDigimon` 상태를 다시 Firestore 루트에 쓰는 구조라 이후 저장 타이밍에 따라 롤백될 수 있었다.
- 재현 확인 과정에서 `MasterDataContext`가 기대하는 캐시 read/write export가 누락되어 개발 서버 재컴파일이 막혀 있었고, 같은 검증 라운드에서 최소한의 캐시 유틸을 함께 보강해 로컬 확인이 가능하도록 맞췄다.

# 2026-03-29

## 게임 화면 overflow 클리핑 보강

### 변경 내용
- `GameScreen` 최상위 래퍼에 `overflow: hidden`과 `box-sizing: border-box`를 추가했다.
- 부상/사망 이모지, 호출 토스트, 기타 절대 배치 연출이 게임 화면 경계 바깥으로 살짝 튀면서 페이지 전체 스크롤 폭과 높이를 흔들던 현상을 게임 화면 내부에서 클리핑하도록 바꿨다.
- 루트 스타일에 `scrollbar-gutter: stable both-edges`와 `body { overflow-x: hidden; }`를 추가해, 세로 스크롤바가 생겼다 사라질 때 문서 폭이 흔들리며 가로 스크롤까지 같이 튀는 현상을 줄이도록 보강했다.

### 영향 파일
- `digimon-tamagotchi-frontend/src/components/GameScreen.jsx`
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### 근거
- 데스크톱 게임 화면에서 위아래/좌우 스크롤바가 생겼다 사라졌다 하는 현상이 재현되었고, 게임 화면 내부의 떠다니는 이모지/토스트가 문서 전체 overflow를 만드는 구조였다.
- 문제 원인이 페이지 레이아웃 전체보다는 게임 화면 절대 배치 연출과 문서 스크롤 폭의 흔들림에 가까워, 전역 overflow를 전부 막기보다 `GameScreen` 경계 클리핑과 루트 스크롤 거터 고정을 함께 적용하는 쪽이 더 안전했다.

# 2026-03-29

## Ably 재사용 경로 상태 동기화 보강

### 변경 내용
- `AblyContextProvider` effect 시작 시 이전 cleanup에서 예약해 둔 클라이언트 종료 타이머를 먼저 정리하도록 바꿨다.
- 기존 Ably 클라이언트를 재사용하는 경로에서 `setAblyClient(clientRef.current)`를 다시 호출해 React state와 실제 싱글톤 클라이언트 참조가 어긋나지 않도록 맞췄다.
- 같은 `clientId`라도 연결 상태가 `closed` 또는 `failed`면 재사용하지 않고 정리 후 새 클라이언트를 만들도록 조건을 보강했다.

### 영향 파일
- `digimon-tamagotchi-frontend/src/contexts/AblyContext.jsx`
- `docs/REFACTORING_LOG.md`

### 근거
- 화면에서는 `REACT_APP_ABLY_KEY`와 테이머명이 모두 있는 상태인데도 `Ably 연결 중...` 메시지가 계속 유지되는 현상이 재현되었다.
- 기존 구현은 같은 `clientId`의 클라이언트를 재사용할 때 React state를 다시 연결하지 않고 바로 return하는 구조였고, 이전 effect cleanup이 예약한 종료 타이머가 남아 있으면 실제 클라이언트와 `ablyClient` state가 어긋난 채 로딩 UI에 머무를 수 있었다.

# 2026-03-29

## 수면 스케줄 공용화 및 배포 빌드 복구

### 변경 내용
- `sleepUtils`에 수면 스케줄 정규화, 시간대 포함 판정, 시간 이동, 다음 수면/기상 시점 계산을 공용 유틸로 정리했다.
- `useGameLogic`, `useGameActions`, `useGameHandlers`가 각자 들고 있던 수면 판정 로직을 공용 유틸 기반으로 맞췄다.
- `adapter.js`가 구조화된 디지몬 데이터에서 `sleepSchedule`, `maxEnergy`, `attackSprite`, `type` 같은 런타임 호환 필드를 더 완전하게 만들어 주도록 보강했다.
- 마스터 데이터 편집 패널을 설정 화면에서도 별도 모달로 열 수 있게 연결하고, 관련 UI 구성을 정리했다.
- 직전 배포 커밋에서 `normalizeSleepSchedule` import가 먼저 올라가고 실제 export가 빠져 빌드가 실패했던 문제를, 남아 있던 로컬 변경을 정리해 추가 커밋하는 방식으로 복구했다.

### 영향 파일
- `digimon-tamagotchi-frontend/src/utils/sleepUtils.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameHandlers.js`
- `digimon-tamagotchi-frontend/src/data/v1/adapter.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/AdminModal.jsx`
- `digimon-tamagotchi-frontend/src/components/SettingsModal.jsx`
- `digimon-tamagotchi-frontend/src/components/DigimonMasterDataPanel.jsx`
- `digimon-tamagotchi-frontend/src/components/DigimonMasterDataModal.jsx`

### 근거
- Vercel 배포 로그에서 `normalizeSleepSchedule is not exported from ../../utils/sleepUtils` 에러가 재현되었고, 로컬 워크트리에는 관련 수면 유틸/호출부 변경이 아직 미커밋 상태로 남아 있었다.
- 로컬 `npm run build` 기준으로는 이 변경 묶음이 적용된 상태에서 빌드가 정상 통과했기 때문에, 배포 실패의 직접 원인은 코드 자체보다 커밋 누락에 가까웠다.
- 수면 규칙은 시간 기반 상태와 케어미스 판정에 직접 연결되므로, 중복된 구현을 유지하기보다 공용 유틸로 합치는 쪽이 이후 버그 추적과 테스트 추가에 유리했다.

# 2026-03-29

## 디지몬 마스터 데이터 전역 저장 구조 재정비

### 변경 내용
- `디지몬 마스터 데이터` 진입점을 아레나 관리자 탭에서 분리하고, `설정 > 개발자 옵션` 아래 전용 버튼으로 옮겼다.
- 마스터 데이터 저장을 Firestore 전역 문서 `game_settings/digimon_master_data` 기준으로만 반영되도록 정리하고, 저장 성공 후에만 런타임 데이터에 적용되게 바꿨다.
- 각 저장 시점마다 스냅샷을 `game_settings/digimon_master_data/snapshots`에 남기도록 바꾸고, 저장 시각, 저장자, 액션 종류, 변경 대상, before/after override를 함께 기록하도록 했다.
- 행 단위 기본 복원, 전체 기본 복원, 저장 스냅샷 기준 복원 기능을 추가했다.
- 편집 패널에서 `기본값`, `현재값`, `편집값`을 한눈에 비교할 수 있게 UI를 재구성했다.
- 미반영 상태였던 `wake hour/min`, `alt attack sprite`, `CSV/JSON 일괄 import`를 편집/저장 흐름에 포함했다.
- `sleepUtils`, `adapter`, `Game` 동기화 경로를 보강해 분 단위 수면/기상 시간이 실제 런타임 판정과 현재 개체 동기화에도 반영되게 맞췄다.

### 영향 파일
- `digimon-tamagotchi-frontend/src/contexts/MasterDataContext.jsx`
- `digimon-tamagotchi-frontend/src/components/SettingsModal.jsx`
- `digimon-tamagotchi-frontend/src/components/DigimonMasterDataModal.jsx`
- `digimon-tamagotchi-frontend/src/components/DigimonMasterDataPanel.jsx`
- `digimon-tamagotchi-frontend/src/components/AdminModal.jsx`
- `digimon-tamagotchi-frontend/src/utils/masterDataUtils.js`
- `digimon-tamagotchi-frontend/src/utils/sleepUtils.js`
- `digimon-tamagotchi-frontend/src/data/v1/adapter.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameHandlers.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/logic/stats/stats.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `docs/REFACTORING_LOG.md`

### 근거
- 기존 구현은 아레나 리더보드 탭 안에 진입점이 숨겨져 있었고, 로컬 캐시를 먼저 반영한 뒤 Firestore를 쓰는 구조라 전역 관리자 기능으로서 동작 범위가 불명확했다.
- 사용자 요구사항은 `설정` 안의 전용 진입, Firestore 성공 시에만 반영, 저장 이력/되돌리기/기본값 복원을 명확히 제공하는 쪽이었다.
- `wake hour/min`은 단순 표기만으로는 의미가 없어 실제 수면 판정과 기상 에너지 회복 로직까지 같은 기준으로 맞춰야 했고, 그래서 공용 수면 유틸과 런타임 어댑터를 함께 정리했다.
