# 리팩토링 로그

이 문서는 프로젝트의 주요 변경사항을 기록합니다.

---

## [2026-04-12] Firestore 기반 운영자 권한 관리로 전환

### 작업 유형
- 🔐 운영자 권한 원천을 Firestore `operator_roles`로 전환
- 🧾 `operator_role_events` 감사 로그 저장 추가
- 👥 사용자 디렉터리에서 운영자 지정/해제 액션 추가
- 🛠️ 기존 env 운영자 이관용 스크립트 추가

### 목적 및 영향
- **목적:** 운영자 권한을 Vercel 환경변수 화이트리스트에 묶어 두지 않고, 실제 운영 화면에서 바로 지정·해제할 수 있도록 권한 원천을 Firestore로 옮긴다.
- **범위:** 상단 `사용자관리` 메뉴 노출, 아레나 관리자 판별, 소식 작성 운영자 판별, 사용자 디렉터리 권한 표시는 모두 단일 Firestore 운영자 역할 기준으로 통일한다.
- **내용:**
  - `operator_roles/{uid}` 문서를 읽어 런타임 운영자 여부를 판별하도록 `operatorConfig`와 관련 auth/access 경로를 재작성했다.
  - `operator_role_events/{eventId}` 감사 로그를 추가해 사용자 디렉터리에서 권한을 지정·해제할 때 누가 누구를 변경했는지 기록하도록 했다.
  - 기존 `api/arena/admin/config` 엔드포인트에 `action=set-operator`를 추가해 함수 수를 늘리지 않고 운영자 지정/해제를 처리하도록 확장했다.
  - 사용자 디렉터리 패널에 `운영자 지정 / 운영자 해제` 버튼, 마지막 운영자 보호 문구, Firestore 기준 역할 갱신 시각을 추가했다.
  - 기존 `OPERATOR_*`, `ARENA_ADMIN_*`, `NEWS_EDITOR_*` 환경변수를 읽어 Firestore 역할 문서를 만드는 1회용 `operator:backfill` 스크립트를 추가했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/api/_lib/operatorConfig.js`
- `digimon-tamagotchi-frontend/api/_lib/auth.js`
- `digimon-tamagotchi-frontend/api/_lib/operatorAccess.js`
- `digimon-tamagotchi-frontend/api/_lib/operatorHandlers.js`
- `digimon-tamagotchi-frontend/api/_lib/arenaHandlers.js`
- `digimon-tamagotchi-frontend/api/_lib/community.js`
- `digimon-tamagotchi-frontend/api/arena/admin/config.js`
- `digimon-tamagotchi-frontend/api/community/[boardId]/posts/index.js`
- `digimon-tamagotchi-frontend/api/community/[boardId]/posts/[postId].js`
- `digimon-tamagotchi-frontend/src/components/admin/UserDirectoryPanel.jsx`
- `digimon-tamagotchi-frontend/src/components/admin/UserDirectoryPanel.test.jsx`
- `digimon-tamagotchi-frontend/src/components/AdminModal.test.jsx`
- `digimon-tamagotchi-frontend/src/utils/arenaApi.js`
- `digimon-tamagotchi-frontend/src/utils/operatorApi.js`
- `digimon-tamagotchi-frontend/src/utils/operatorApi.test.js`
- `api/_lib/arenaHandlers.test.js`
- `api/_lib/operatorHandlers.test.js`
- `tests/community-lib.test.js`
- `scripts/migrateOperatorRoles.js`
- `package.json`
- `docs/REFACTORING_LOG.md`

### 검증
- `node --test api/_lib/arenaHandlers.test.js api/_lib/operatorHandlers.test.js tests/arena-entrypoints.test.js tests/community-lib.test.js`
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/components/admin/UserDirectoryPanel.test.jsx src/components/AdminModal.test.jsx src/components/layout/TopNavigation.test.jsx src/pages/OperatorUsers.test.jsx src/utils/operatorApi.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

## [2026-04-12] `useGameLogic` 4차 분리: activity log helper 추출

### 작업 유형
- 🧩 activity log input 정규화 helper 추출
- 🧩 activity log base entry builder 추출
- 🧩 activity log timestamp/eventId/trim helper 추출
- 🧪 activity log helper 테스트 추가

### 목적 및 영향
- **목적:** `addActivityLog` 안에 섞여 있던 timestamp/options 입력 정규화, base log 조립, eventId 부여, 최대 로그 수 제한 처리를 분리해 로그 append 흐름을 더 읽기 쉽게 만든다.
- **범위:** 기존 eventId 계산, dedupe 규칙, 최대 로그 수 제한은 그대로 유지한다.
- **내용:**
  - `resolveActivityLogInput`을 추가해 number/object 입력에서 `timestamp`와 추가 필드를 정규화했다.
  - `buildActivityLogEntry`를 추가해 `addActivityLog`가 사용할 base log 조립을 분리했다.
  - `resolveActivityLogTimestampMs`, `buildActivityLogWithEventId`, `trimActivityLogs`를 추가해 timestamp 읽기, eventId 부여, 최대 로그 수 제한을 helper로 분리했다.
  - helper 테스트를 추가해 object 입력 분해, base log 생성, timestamp 변환, eventId 부여, trim 계약을 고정했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameLogic.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameLogic.js src/hooks/useGameLogic.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

## [2026-04-12] `useDeath` 1차 분리: death reincarnation helper 추출

### 작업 유형
- 🧩 death form 선택 helper 추출
- 🧩 환생 상태/로그 조립 helper 추출
- 🧩 death encyclopedia 기록 여부 helper 추출
- 🧪 `useDeath` helper 테스트 추가

### 목적 및 영향
- **목적:** `confirmDeath` 안에 섞여 있던 죽음 폼 결정, 환생 상태 조립, 도감 기록 여부 판단을 분리해 훅 본문을 오케스트레이션 중심으로 정리한다.
- **범위:** 사망 후 환생 대상 결정, activity log 기록, 도감 업데이트 여부, 모달 닫기 순서는 그대로 유지한다.
- **내용:**
  - `resolveDeathReincarnationDigimonId`를 추가해 슬롯 버전과 완전체 여부에 따른 묘지 폼 선택 및 스타터 fallback을 공통화했다.
  - `buildDeathReincarnationState`를 추가해 `initializeStats`와 환생 activity log 조립을 한 곳으로 모았다.
  - `shouldRecordDeathEncyclopedia`를 추가해 스타터 디지몬 제외 규칙을 helper로 분리했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useDeath.js`
- `digimon-tamagotchi-frontend/src/hooks/useDeath.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useDeath.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useDeath.js src/hooks/useDeath.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

## [2026-04-12] `useFridge` 1차 분리: fridge commit helper 추출

### 작업 유형
- 🧩 냉장고 넣기 commit state helper 추출
- 🧩 냉장고 꺼내기 commit state helper 추출
- 🧩 보관 시간 포맷/log text helper 추출
- 🧪 `useFridge` helper 테스트 보강

### 목적 및 영향
- **목적:** `putInFridge`와 `takeOutFromFridge` 안에 섞여 있던 상태 조립과 보관 시간 문구 포맷을 분리해, 훅 본문을 “검사 → helper 결과 적용 → 저장” 흐름으로 단순화한다.
- **범위:** 냉장고 보관/복귀 시 호출 창 이동 규칙, zero duration 누적, 저장 순서와 activity log 문구 의미는 그대로 유지한다.
- **내용:**
  - `buildPutInFridgeCommitState`를 추가해 냉장고 진입 시 frozen 상태와 callStatus 비활성화 조립을 분리했다.
  - `buildTakeOutFridgeCommitState`를 추가해 보관 시간 계산, zero frozen duration 누적, 호출 창 이동, sleep call reset을 한 곳으로 모았다.
  - `formatFridgeDurationText`, `buildTakeOutFridgeLogText`를 추가해 보관 시간 문구와 꺼내기 로그 텍스트 조립을 공통화했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useFridge.js`
- `digimon-tamagotchi-frontend/src/hooks/useFridge.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useFridge.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useFridge.js src/hooks/useFridge.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

## [2026-04-12] `useGameLogic` 3차 분리: evolution range requirement helper 추출

### 작업 유형
- 🧩 evolution range 판정 helper 추출
- 🧩 evolution 조건 문자열 formatter 추출
- 🧪 evolution helper 및 `checkEvolutionAvailability` 테스트 추가

### 목적 및 영향
- **목적:** `checkEvolutionAvailability` 안에서 반복되던 `min/max/range` 판정 로직을 공통 helper로 정리해, 실질적인 진화 조건 판단과 문구 포맷을 분리한다.
- **범위:** 진화 조건 설명 문자열 포맷과 `isAvailable` 판정은 그대로 유지한다.
- **내용:**
  - `evaluateEvolutionRangeRequirement`를 추가해 `mistakes/trainings/overfeeds/sleepDisturbances/battles/winRatio`의 range 판정을 공통화했다.
  - `formatEvolutionRangeCondition`를 추가해 기존 `(...현재...) / ... (진화기준)` 문자열 포맷을 공통 formatter로 분리했다.
  - `checkEvolutionAvailability`는 이제 range helper 결과를 적용하는 구조로 단순화됐다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameLogic.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameLogic.js src/hooks/useGameLogic.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

## [2026-04-12] `useGameLogic` 2차 분리: sleep light warning helper 추출

### 작업 유형
- 🧩 sleep warning state helper 추출
- 🧩 sleep warning timeout helper 추출
- 🧪 `useGameLogic` sleep warning helper 테스트 추가

### 목적 및 영향
- **목적:** `checkCalls`와 `checkCallTimeouts` 안의 수면 조명 경고 경로를 hunger/strength call helper와 같은 패턴으로 맞춰, 경고 상태 복원과 timeout 후처리를 분리한다.
- **범위:** `sleepLightOnStart` 복원 규칙, 30분 초과 시 1회만 케어미스를 올리는 규칙, 기존 수면 경고 테스트 동작은 그대로 유지한다.
- **내용:**
  - `resolveSleepLightWarningState`를 추가해 수면 조명 경고 상태에서 `startedAt` 복원과 비경고 상태 reset을 공통화했다.
  - `resolveSleepLightWarningTimeout`를 추가해 수면 조명 경고 30분 초과 시 care mistake 기록과 `isLogged` 갱신을 분리했다.
  - helper 테스트를 추가해 저장된 시작 시각 복원과 timeout 후 1회 기록 계약을 고정했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameLogic.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameLogic.js src/hooks/useGameLogic.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

## [2026-04-12] `useGameLogic` 1차 분리: hunger/strength call helper 추출

### 작업 유형
- 🧩 call 상태 초기화 helper 추출
- 🧩 hunger/strength call 상태/timeout helper 추출
- 🧪 `useGameLogic` helper 테스트 추가

### 목적 및 영향
- **목적:** `checkCalls`와 `checkCallTimeouts` 안에서 반복되던 hunger/strength 호출 로직을 공통 helper로 분리해, 수면 경고와 분리된 읽기 경계를 만든다.
- **범위:** hunger/strength 호출 활성화/중지 규칙, sleep pause/resume 처리, timeout 후 care mistake 증가 규칙은 그대로 유지한다.
- **내용:**
  - `buildInitialCallStatus`를 추가해 callStatus 기본 구조와 저장값 병합을 한 곳으로 모았다.
  - `resolveNeedCallState`를 추가해 hunger/strength 호출 상태 활성화, sleep pause/resume, deadline 조립을 공통화했다.
  - `resolveNeedCallTimeout`를 추가해 hunger/strength timeout 후 care mistake 기록과 call 상태 정리를 공통화했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameLogic.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameLogic.js src/hooks/useGameLogic.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

## [2026-04-12] `useArenaLogic` 1차 분리: arena config/battle plan helper 추출

### 작업 유형
- 🧩 arena config patch helper 추출
- 🧩 arena battle plan helper 추출
- 🧪 `useArenaLogic` 첫 테스트 파일 추가

### 목적 및 영향
- **목적:** 현재 워킹트리의 UI 변경과 충돌을 피하면서, 작은 훅인 `useArenaLogic`부터 읽기/계획/적용 경계를 분리한다.
- **범위:** Firestore에서 arena 설정을 읽는 시점, arena battle 진입 순서, modal open/close 순서는 그대로 유지한다.
- **내용:**
  - `buildArenaConfigState`를 추가해 Firestore/admin 설정 객체를 setter 입력용 patch로 정리했다.
  - `buildArenaBattlePlan`를 추가해 challenger 검증 뒤 필요한 arena battle setter 입력값과 modal toggle 순서를 한 곳에서 조립하도록 만들었다.
  - `useArenaLogic.test.js`를 새로 추가해 arena config load, battle start, invalid challenger, admin config update 흐름을 고정했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useArenaLogic.js`
- `digimon-tamagotchi-frontend/src/hooks/useArenaLogic.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useArenaLogic.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useArenaLogic.js src/hooks/useArenaLogic.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

## [2026-04-12] `useGameHandlers` 2차 분리: menu/heal plan helper 추출

### 작업 유형
- 🧩 primary 메뉴 action helper 추출
- 🧩 heal modal plan helper 추출
- 🧪 helper 및 heal 핸들러 테스트 추가

### 목적 및 영향
- **목적:** `handleMenuClick`과 `handleHeal` 안의 판단 로직을 순수 helper로 분리해, 훅 본문이 “실행” 중심으로 더 읽히게 만든다.
- **범위:** 메뉴 클릭 시 실제 modal open/clean action 호출, heal modal open 순서, lazy update 호출 시점은 그대로 유지한다.
- **내용:**
  - `resolvePrimaryMenuAction`를 추가해 메뉴 접근 가능 여부와 `actionKey` 결정을 helper로 분리했다.
  - `buildHealModalPlan`를 추가해 heal modal을 열 수 있는지와 전달할 최신 stats를 helper에서 조립하도록 정리했다.
  - `handleMenuClick`은 action plan을 적용하는 형태로, `handleHeal`은 plan 결과를 적용하는 형태로 단순화했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameHandlers.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameHandlers.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameHandlers.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameHandlers.js src/hooks/useGameHandlers.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

## [2026-04-12] `useGameHandlers` 1차 분리: 조명/퀘스트 선택 helper 추출

### 작업 유형
- 🧩 `handleToggleLights` 저장 helper 추출
- 🧩 퀘스트/스파링 선택 상태 helper 추출
- 🧪 helper 및 핸들러 테스트 추가

### 목적 및 영향
- **목적:** 현재 워킹트리의 UI 변경과 충돌을 피하기 위해, `useGameHandlers` 안에서만 끝나는 작은 상태 조립 경계를 먼저 분리한다.
- **범위:** 메뉴 클릭 동작, 조명 토글 저장 순서, 퀘스트/스파링 진입 흐름, 모달 열기/닫기 순서는 그대로 유지한다.
- **내용:**
  - `buildToggledLightsCommitState`를 추가해 조명 토글 후 activity log와 저장 대상 stats 조립을 helper로 분리했다.
  - `buildQuestSelectionState`, `buildSparringSelectionState`, `shouldAdvanceClearedQuest`를 추가해 퀘스트/스파링 진입과 클리어 해금 판단을 순수 helper로 정리했다.
  - `handleSelectArea`, `handleSparringSlotSelect`, `handleQuestComplete`, `handleToggleLights`는 이제 helper 결과를 적용하는 오케스트레이션에 가깝게 읽힌다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameHandlers.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameHandlers.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameHandlers.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameHandlers.js src/hooks/useGameHandlers.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

## [2026-04-12] 소식 탭을 공식 소식 피드 구조로 전환

### 작업 유형
- 📰 공식 소식 피드 보드 추가
- 🔐 운영 계정 화이트리스트 발행 권한 분리
- 🧪 소식 보드 API/페이지 테스트 보강

### 목적 및 영향
- **목적:** 정적 카드 2개 수준이던 소식 페이지를 실제 운영 공지·패치 노트·이벤트·점검 피드로 올리고, 자유게시판/지원보드와는 다른 `발행형 구조`를 갖게 한다.
- **내용:**
  - 커뮤니티 공용 데이터 모델에 `board_id = news`와 `news_context jsonb`를 추가하고, `notice/patch/event/maintenance` 말머리 및 요약·버전·영향 범위·기간·대표 소식 메타를 저장하도록 확장했다.
  - 소식 목록/상세는 로그인 후 읽을 수 있고 댓글은 그대로 허용하되, 글 작성/수정/삭제는 `NEWS_EDITOR_UIDS`, `NEWS_EDITOR_EMAILS` 화이트리스트 계정만 가능하도록 서버 권한을 분리했다.
  - `News.jsx`는 대표 소식 히어로, 말머리 필터, 압축형 피드 목록, 접기형 운영 메모, 소식 전용 발행 모달과 상세 모달을 갖는 공식 피드 페이지로 재구성했다.
  - 기존 정적 `newsHighlights`, `newsRoadmap`는 실제 피드 데이터로 대체하지 않고, 빈 상태와 운영 메모 영역에서만 보조 안내로 축소 유지했다.
- **영향:** 소식 탭이 자유게시판과 같은 대화형 게시판이 아니라 운영팀 발행 피드로 역할이 분리되고, 향후 실제 운영 공지 축적과 댓글 반응 흐름을 같은 구조 안에서 이어갈 수 있게 됐다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/News.jsx`
- `digimon-tamagotchi-frontend/src/components/news/NewsPostRow.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunityFreePostComposer.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunityPostDetailDialog.jsx`
- `digimon-tamagotchi-frontend/src/data/serviceContent.js`
- `digimon-tamagotchi-frontend/src/utils/communityApi.js`
- `digimon-tamagotchi-frontend/src/utils/communityApi.test.js`
- `digimon-tamagotchi-frontend/src/pages/News.test.jsx`
- `digimon-tamagotchi-frontend/src/styles/news.css`
- `api/_lib/community.js`
- `api/_lib/community.test.js`
- `api/community/[boardId]/posts/index.js`
- `api/community/[boardId]/posts/[postId].js`
- `tests/community-lib.test.js`
- `supabase/migrations/20260412_community_news_board.sql`
- `docs/REFACTORING_LOG.md`

### 검증
- `node --test api/_lib/community.test.js tests/community-lib.test.js`
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/pages/News.test.jsx src/utils/communityApi.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

## [2026-04-11] 도감 저장을 `version docs + root mirror` 호환 단계로 조정

### 작업 유형
- 🧩 도감 저장 구조 호환 단계 명시
- 🔁 version docs와 root encyclopedia 동시 유지
- 🧪 앱 저장/관리자 백필 계약 정렬

### 목적 및 영향
- **목적:** 완전 이관 전에 기존 `users/{uid}.encyclopedia` 루트 필드를 급하게 제거하지 않고, `users/{uid}/encyclopedia/{version}`를 정식 원본으로 삼되 root mirror를 함께 유지하는 보수적 마이그레이션 단계를 고정한다.
- **내용:**
  - `saveEncyclopedia()`는 이제 버전별 문서를 계속 저장하면서 루트 `users/{uid}.encyclopedia`에도 canonical mirror를 함께 기록한다.
  - 루트 문서에 `encyclopediaStructure.storageMode = version-docs-with-root-mirror`, `phase = compat` 메타데이터를 남겨 현재 계정이 호환 단계에 있음을 확인할 수 있게 했다.
  - 관리자용 `backfillUserEncyclopedia`도 root encyclopedia mirror와 구조 메타데이터를 같은 형식으로 기록하도록 맞췄다.
- `loadEncyclopedia()`는 legacy root/slot fallback으로 복구된 계정을 읽을 때, 같은 세션에서 한 번만 version docs/root mirror를 self-heal 저장하고 `profile/main`도 best effort로 생성해 관리자 키 없이도 구조가 점진적으로 최신 형태로 맞춰지도록 했다.
- **영향:** 운영에서 기존 계정은 root fallback으로 계속 복구 가능하고, 이후 앱 저장 또는 백필이 발생하면 새 구조와 legacy mirror가 함께 정렬된다.

## [2026-04-11] 신규 도감 저장을 `version docs + root metadata`로 축소

### 작업 유형
- 🧩 신규 저장 경로 축소
- ♻️ legacy root encyclopedia 읽기 호환 유지
- 🧪 저장 결과/메시지 기준 정리

### 목적 및 영향
- **목적:** 신규 저장부터는 `users/{uid}.encyclopedia` root mirror를 더 이상 늘리지 않고, `users/{uid}/encyclopedia/{version}`를 정식 저장소로 고정한다.
- **내용:**
  - `saveEncyclopedia()`는 이제 version docs를 canonical로 저장하고, root 문서에는 `encyclopediaStructure` 메타데이터만 갱신한다.
  - 기존 root `encyclopedia`와 slot legacy 도감은 읽기 fallback으로 그대로 남겨 두어, 과거 계정 복구 경로는 유지한다.
  - 도감 패널의 저장 메시지는 `canonical`, `rootMetadata`, `profileMirror` 단계 기준으로 안내한다.
- **영향:** 신규 저장은 서브컬렉션 중심으로 단순화되고, 기존 root encyclopedia는 더 이상 신규 저장으로 갱신되지 않는다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useEncyclopedia.js`
- `digimon-tamagotchi-frontend/src/hooks/useEncyclopedia.test.js`
- `digimon-tamagotchi-frontend/src/components/panels/EncyclopediaPanel.jsx`
- `digimon-tamagotchi-frontend/docs/REFACTORING_LOG.md`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useEncyclopedia.test.js src/components/panels/EncyclopediaPanel.test.jsx src/utils/userProfileUtils.test.js`

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useEncyclopedia.js`
- `digimon-tamagotchi-frontend/src/hooks/useEncyclopedia.test.js`
- `scripts/backfillUserEncyclopedia.js`
- `tests/encyclopedia-migration.test.js`
- `digimon-tamagotchi-frontend/docs/REFACTORING_LOG.md`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useEncyclopedia.test.js`
- `node --test tests/encyclopedia-migration.test.js`

## [2026-04-11] `useGameActions` 9차 분리: sleep disturbance commit helper 추출

### 작업 유형
- 🧩 공통 수면 방해 commit helper 추출
- 🧪 수면 방해 entry/commit state 단위 테스트 추가

### 목적 및 영향
- **목적:** feed/train/battle에서 반복되던 `createSleepDisturbanceLog + buildActivityLogCommitState` 조합을 helper로 묶어, 액션별 수면 방해 후처리 블록을 더 짧고 동일한 형태로 맞춘다.
- **범위:** duplicate suppression, `wakeForInteraction`, `appendLogToSubcollection`, `setDigimonStatsAndSave` 호출 순서와 동작은 그대로 유지한다.
- **내용:**
  - `buildSleepDisturbanceCommitState`를 추가해 reason과 다음 stats를 받아 수면 방해 로그 entry와 activity log commit state를 함께 반환하도록 정리했다.
  - `eatCycle`, `handleTrainResult`, `handleBattleComplete`의 수면 방해 분기가 동일 helper를 사용하도록 맞췄다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameActions.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameActions.js src/hooks/useGameActions.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

## [2026-04-11] `useGameActions` 8차 분리: clean outcome helper 추출

### 작업 유형
- 🧩 똥 청소 결과 outcome helper 추출
- 🧪 청소 후 overflow 상태 초기화 테스트 추가

### 목적 및 영향
- **목적:** `cleanCycle` 완료 분기에 남아 있던 poop overflow 초기화와 로그 문구 조립을 helper로 묶어, 청소 액션 본문에서는 애니메이션 종료와 저장 흐름만 더 잘 보이게 만든다.
- **범위:** `setShowPoopCleanAnimation`, `setCleanStep`, `setDigimonStatsAndSave`, log append 순서와 청소 시 부상 상태를 회복하지 않는 기존 동작은 그대로 유지한다.
- **내용:**
  - `buildCleanOutcome`를 추가해 `clearPoopOverflowState` 결과와 `Cleaned Poop` 로그 문구를 함께 반환하도록 정리했다.
  - `cleanCycle`의 완료 분기는 이제 helper 결과를 받아 activity log commit만 수행한다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameActions.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameActions.js src/hooks/useGameActions.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- `useGameActions`는 이제 feed/training/clean 쪽 핵심 결과 조립을 helper 경계로 나눠 가지게 됐다. 다음 후보는 남아 있는 공통 수면 방해 post-action 분기나 sparring/arena/quest 완료 후 알림 tail을 더 줄이는 것이다.

## [2026-04-11] `useGameActions` 7차 분리: feed outcome helper 추출

### 작업 유형
- 🧩 먹이 결과 outcome helper 추출
- 🧪 거절/프로틴 bonus + 호출 해제 테스트 추가

### 목적 및 영향
- **목적:** `eatCycle` 안에 남아 있던 `feedMeat`/`feedProtein` 분기, hunger/strength 호출 해제, feed log text 조립을 하나의 helper로 묶어, 먹이 액션 본문에서 저장/애니메이션 흐름만 더 잘 보이게 만든다.
- **범위:** `applyLazyUpdateBeforeAction`, 수면 방해 처리, feed 애니메이션 step 진행, `setDigimonStatsAndSave`, log append 순서는 그대로 유지한다.
- **내용:**
  - `buildFeedOutcome`를 추가해 먹이 타입과 거절 여부에 따라 `eatResult`, 최종 `updatedStats`, 로그 문자열을 함께 반환하도록 정리했다.
  - `resetCallStatus`의 얕은 복사 영향을 줄이기 위해 targeted callStatus clone helper를 같이 도입해 helper 순수성을 유지했다.
  - `eatCycle`은 이제 helper 결과를 받아 debug logging과 activity log commit만 수행한다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameActions.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameActions.js src/hooks/useGameActions.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- `useGameActions`는 이제 battle/action log commit helper뿐 아니라 training/feed outcome helper까지 갖게 됐다. 다음 후보는 clean cycle이나 sleep disturbance post-action 분기처럼 남아 있는 action 후처리 묶음을 outcome/helper 패턴으로 맞추는 것이다.

## [2026-04-11] `useGameActions` 6차 분리: training skip helper 추출

### 작업 유형
- 🧩 훈련 건너뜀 outcome helper 추출
- 🧪 체중 부족 / 에너지 부족 안내 문구 테스트 추가

### 목적 및 영향
- **목적:** `handleTrainResult` 안에 남아 있던 체중 부족, 에너지 부족 분기의 로그 문구와 alert 문구 조립을 helper로 묶어, 본문에서는 저장/종료 흐름만 더 잘 보이게 만든다.
- **범위:** `setDigimonStatsAndSave`, activity log append, alert 호출 순서, `null` 반환 계약은 그대로 유지한다.
- **내용:**
  - `buildTrainingSkipOutcome`를 추가해 훈련 skip 사유별 activity log entry와 alert 문구를 한 번에 반환하도록 정리했다.
  - `handleTrainResult`의 체중 부족/에너지 부족 분기는 이제 helper 결과를 사용해 commit state 조립과 alert만 수행한다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameActions.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameActions.js src/hooks/useGameActions.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- `useGameActions`는 이제 battle result, battle log, activity log, feed/training text, training outcome에 이어 training skip 분기도 helper 경계를 갖게 됐다. 다음 후보는 feed 결과 patch나 clean/sleep disturbance 후처리의 outcome 경계를 맞추는 것이다.

## [2026-04-11] `useGameActions` 5차 분리: training outcome helper 추출

### 작업 유형
- 🧩 training 결과 상태/로그 helper 추출
- 🧪 training outcome 단위 테스트 추가

### 목적 및 영향
- **목적:** `handleTrainResult` 안의 `finalStats` 보정과 로그 문자열 조립을 하나의 순수 helper로 묶어, training action의 본문에서 저장/알림 흐름만 더 잘 보이게 만든다.
- **범위:** `doVer1Training(...)` 호출 시점, 수면 방해 처리, train skip 분기, `setDigimonStatsAndSave`, alert 타이밍은 그대로 유지한다.
- **내용:**
  - `buildTrainingOutcome`를 추가해 `trainingResult.updatedStats`를 받아 `strength` 호출 상태 해제와 로그 문자열 조립을 한 번에 수행하도록 정리했다.
  - helper 내부에서 `callStatus.strength`를 안전하게 복사한 뒤 `resetCallStatus("strength")`를 적용해 입력 객체를 직접 건드리지 않도록 맞췄다.
  - `handleTrainResult`는 이제 `finalStats`와 `logText`를 helper에서 받아 activity log commit만 수행한다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameActions.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameActions.js src/hooks/useGameActions.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 이제 `useGameActions`의 training 경로는 precheck/수면 방해/save sequencing은 그대로 두고, 결과 조립은 helper를 통해 지나간다. 다음 후보는 train skip payload나 feed outcome patch를 같은 패턴으로 정리하는 것이다.

## [2026-04-11] `useGameActions` 4차 분리: feed/training 결과 문자열 helper 추출

### 작업 유형
- 🧩 feed/training 결과 로그 문자열 helper 추출
- 🧪 feed/training log text 단위 테스트 추가

### 목적 및 영향
- **목적:** `eatCycle`과 `handleTrainResult`에 남아 있던 변화량 계산/문자열 조립을 순수 helper로 분리해, action 본문에서 실제 상태 전이와 저장 흐름만 더 잘 보이게 만든다.
- **범위:** `feedMeat`/`feedProtein`/`doVer1Training` 실행 시점, 수면 방해 처리, `setDigimonStatsAndSave`, animation 타이밍은 그대로 유지한다.
- **내용:**
  - `buildFeedLogText`를 추가해 고기 일반 섭취, 오버피드, 거절, 프로틴 보너스 로그 문자열 조립을 한 곳으로 정리했다.
  - `buildTrainingLogText`를 추가해 훈련 성공/실패 로그 문자열을 변화 전후 값 기준으로 공통화했다.
  - `eatCycle`과 `handleTrainResult`는 이제 helper 결과를 받아 activity log 저장만 수행한다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameActions.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameActions.js src/hooks/useGameActions.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- `useGameActions`는 이제 battle 결과/로그 helper뿐 아니라 feed/training log text helper도 갖게 됐다. 다음 단계는 train skip payload나 feed outcome patch처럼 결과 object 조립까지 helper로 옮길지, 아니면 이 체크포인트에서 커밋하고 다음 관심사로 넘어갈지 판단하는 것이다.

## [2026-04-11] `useGameActions` 3차 분리: activity log commit helper 추출

### 작업 유형
- 🧩 feed/train/clean/sleep disturbance 공통 activity log commit helper 추출
- 🧪 activity log helper 단위 테스트 추가

### 목적 및 영향
- **목적:** `useGameActions` 전반에 반복되던 `updatedLogs`와 `statsWithLogs` 조립을 한 곳으로 모아, action별 로그 저장 boilerplate를 줄인다.
- **범위:** `appendLogToSubcollection`, `setDigimonStatsAndSave`, duplicate sleep disturbance suppression, alert, animation 타이밍은 그대로 유지한다.
- **내용:**
  - `buildActivityLogCommitState`를 추가해 `prevStats`, `nextStats`, `entry`만으로 다음 activityLogs와 저장 대상 stats를 조립하도록 정리했다.
  - Protein 거부, feed 결과, train 수면 방해, train skip, train 결과, clean, quest battle 수면 방해 경로가 모두 같은 helper를 재사용하도록 맞췄다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameActions.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameActions.js src/hooks/useGameActions.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 이제 `useGameActions`는 battle 쪽뿐 아니라 activity log commit 상태도 helper 경계를 갖게 됐다. 다음 단계는 feed/training 결과 문자열/patch 조립을 순수 helper로 옮기는 쪽이 가장 자연스럽다.

## [2026-04-11] `useGameActions` 2차 분리: 배틀 로그 helper 추출

### 작업 유형
- 🧩 배틀 로그 entry / commit state helper 추출
- 🧪 battle log helper 단위 테스트 추가

### 목적 및 영향
- **목적:** `handleBattleComplete` 안에서 반복되던 battle log object 조립과 `battleLogs` 반영 패턴을 순수 helper로 분리해, 배틀 분기마다 남아 있던 boilerplate를 줄인다.
- **범위:** `appendBattleLogToSubcollection`, `setDigimonStatsAndSave`, alert, 화면 닫기/상태 리셋, remote arena write 타이밍은 그대로 유지한다.
- **내용:**
  - `buildBattleLogEntry`를 추가해 `mode`, `text`, `win`, `enemyName`, `injury`, `timestamp`, digimon snapshot 조합을 한 곳에서 처리하도록 정리했다.
  - `buildBattleLogCommitState`를 추가해 `appendBattleLog(...)`와 `statsWithBattleLogs` 조립을 helper로 묶었다.
  - Sparring / Arena / Quest 승리 / Quest 패배 / Energy 부족 skip 경로가 모두 같은 helper를 사용하도록 맞췄다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameActions.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameActions.js src/hooks/useGameActions.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 이제 `useGameActions`의 battle 쪽은 비용 차감, 전적 집계, 부상 적용, battle log entry/commit까지 helper 경계를 가지게 됐다. 다음 후보는 activity log commit state 공통화 또는 feed/training 결과 조립 helper다.

## [2026-04-11] `useGameActions` 1차 분리: 배틀 결과 계산 helper 추출

### 작업 유형
- 🧩 `handleBattleComplete`의 순수 배틀 결과 계산 helper 추출
- 🧪 배틀 비용/전적/부상 helper 테스트 추가

### 목적 및 영향
- **목적:** `handleBattleComplete` 안에 섞여 있던 Ver.1 배틀 비용 차감, 승패 전적 집계, 퀘스트 부상 적용을 순수 helper로 분리해 battle action orchestration을 더 읽기 쉽게 만든다.
- **범위:** `completeArenaBattle` 호출 시점, `appendBattleLogToSubcollection`, alert, animation/UI 전환, `setDigimonStatsAndSave` 타이밍은 그대로 유지한다.
- **내용:**
  - `buildBattleCostStats`를 추가해 공통 배틀 피로(`weight -4`, `energy -1`)와 delta 계산을 한 곳에서 처리하도록 정리했다.
  - `buildRecordedBattleStats`를 추가해 승패에 따른 현재/총 전적과 승률 계산을 Arena/Quest가 같이 쓰도록 맞췄다.
  - `applyBattleInjuryOutcome`를 추가해 퀘스트 전투의 부상 확률 적용과 부상 필드 세팅을 순수 helper로 분리했다.
  - `handleBattleComplete`는 helper 결과를 받아 로그 문자열과 저장 흐름만 조합하도록 단순화했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameActions.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameActions.js src/hooks/useGameActions.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- `useGameActions`는 animation/save sequencing이 여전히 핵심 리스크라, 다음 단계도 setter/timeout은 유지한 채 계산 helper를 추가로 분리하는 방식이 안전하다. 현재 기준으로는 수면 방해 처리보다 battle 결과 조립이 훨씬 좋은 순수 helper 경계였다.

## [2026-04-11] `useGameData` 9차 분리: loaded slot hydration plan helper 추출

### 작업 유형
- 🧩 `loadSlot`의 starter-init / saved-runtime 분기 helper 추출
- 🧪 hydration plan wiring 테스트 추가

### 목적 및 영향
- **목적:** `loadSlot`에 남아 있던 “빈 슬롯 초기화 vs 저장된 슬롯 runtime rebuild” 분기를 helper로 묶어, effect 본문을 Firestore read와 setter fan-out 중심으로 더 단순화한다.
- **범위:** `Date.now()` 기반 starter 초기화, saved runtime rebuild, reconstructed log persistence 타이밍은 그대로 유지하고, 실제 `appendLogToSubcollection` 호출은 caller에 남긴다.
- **내용:**
  - `buildLoadedSlotHydrationPlan`을 추가해 starter-init 경로와 saved-runtime 경로를 공통 인터페이스(`hydrationResult`, `reconstructedLogsToPersist`)로 반환하도록 정리했다.
  - `loadSlot`은 collections merge 이후 hydration plan만 받아 setter 적용과 reconstructed log persist만 수행하게 되었다.
  - 테스트로 빈 슬롯 starter 조립과 저장된 stats의 runtime rebuild wiring을 각각 고정했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameData.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameData.js src/hooks/useGameData.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 이제 `loadSlot`은 `slot read -> collections load -> collections merge -> hydration plan -> persistence hints -> setter fan-out` 순서로 읽힌다. 다음 단계는 setter fan-out을 그대로 두고, `useGameData`를 여기서 정리한 뒤 `useGameActions` 리팩터링으로 넘어갈지 판단하는 것이다.

## [2026-04-11] `useGameData` 8차 분리: action lazy update runtime context helper 추출

### 작업 유형
- 🧩 `applyLazyUpdateForAction`의 runtime context 계산 helper 추출
- 🧪 evolutionStage lookup / stage 기본 수면시간 테스트 추가

### 목적 및 영향
- **목적:** `applyLazyUpdateForAction`에 남아 있던 “현재 디지몬 기준 sleepSchedule / maxEnergy 계산”을 순수 helper로 분리해, action 경로의 Firestore I/O와 runtime metadata 계산 책임을 나눈다.
- **범위:** 기존 evolutionStage 기반 현재 디지몬 탐색 규칙과 stage별 기본 수면시간 fallback은 그대로 유지하고, `updateDoc`, `appendLogToSubcollection`, death popup 처리 타이밍은 변경하지 않는다.
- **내용:**
  - `resolveActionLazyUpdateRuntimeContext`를 추가해 action 경로에서 사용할 `currentDigimonName`, `sleepSchedule`, `maxEnergy`를 한 번에 계산하도록 정리했다.
  - `applyLazyUpdateForAction`은 이제 helper 결과를 받아 lazy update kernel만 호출하게 되어, 함수 본문이 더 명확하게 읽히도록 만들었다.
  - 테스트로 evolutionStage 기반 lookup, stage 기본 수면시간 fallback, runtime data map 미존재 시 null context 계약을 고정했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameData.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameData.js src/hooks/useGameData.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 이제 `useGameData`는 `loadSlot`의 helper 경계뿐 아니라 action 직전 lazy update의 runtime context 계산도 순수 함수로 분리됐다. 다음 선택지는 load 경로의 starter-init vs saved-runtime 분기 자체를 helper plan으로 묶거나, `useGameData`를 여기서 멈추고 `useGameActions` 리팩터링으로 넘어가는 것이다.

## [2026-04-11] `useGameData` 7차 분리: lazy update runtime 계산 코어 공통화

### 작업 유형
- 🧩 `loadSlot` / `applyLazyUpdateForAction` 공통 lazy update runtime helper 추출
- 🧪 공통 helper 단위 테스트 추가

### 목적 및 영향
- **목적:** `loadSlot`과 action 직전 lazy update가 같은 `applyLazyUpdate + repairCareMistakeLedger + reconstructed log slice` 계산 코어를 쓰도록 맞춰, 두 경로의 의미를 한 곳에서 관리한다.
- **범위:** sleepSchedule/maxEnergy 계산, Firestore read/write, death popup 처리, sprite sync는 각 caller에 그대로 두고, 공통 계산기만 `buildLazyUpdateRuntimeResult`로 추출한다.
- **내용:**
  - `buildLazyUpdateRuntimeResult`를 추가해 `baseStats`, `lastSavedAt`, sleep context, selectedDigimon, data maps를 받아 최종 `digimonStats`와 `reconstructedLogsToPersist`를 함께 반환하게 했다.
  - `buildLoadedSlotRuntimeState`는 starter TTE 보정 이후 이 helper를 재사용하고, sprite sync만 후처리로 남겼다.
  - `applyLazyUpdateForAction`도 같은 helper를 사용하도록 바꿔, action 경로와 load 경로의 ledger repair / new log slice 계산을 공통화했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameData.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameData.js src/hooks/useGameData.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 이제 `useGameData`는 저장 payload, hydration packaging, fallback init, collections read, collections merge, lazy-update runtime rebuild까지 helper 경계를 갖게 됐다. 다음 큰 선택지는 `useGameData`를 여기서 마무리하고 `useGameActions`로 넘어가거나, `applyLazyUpdateForAction`의 sleep context 계산까지 별도 helper로 올려 load/action 양쪽의 문맥 계산을 더 맞추는 것이다.

## [2026-04-11] `useGameData` 6차 분리: fallback slot initializer helper 추출

### 작업 유형
- 🧩 `slot 없음` / `load 실패` 경로용 fallback hydration helper 추출
- 🧪 fallback starter 및 기본 설정 조립 테스트 추가

### 목적 및 영향
- **목적:** `loadSlot`의 실패 경로에서도 초기 상태 조립을 helper로 묶어, 성공/실패 모두 “결과 object를 만들고 setter로 반영한다”는 패턴을 더 맞춘다.
- **범위:** 기존 동작을 바꾸지 않기 위해 helper는 fallback starter, 기본 background/immersive 설정, 슬롯 이름만 조립하고, 어떤 setter를 실제로 적용할지는 기존 분기에서 그대로 결정한다.
- **내용:**
  - `buildFallbackSlotHydrationResult`를 추가해 `getStarterDigimonIdFromDataMap` + `initializeStats` 기반 fallback starter 상태를 한 곳에서 만들도록 정리했다.
  - `slot 문서 없음` 경로와 `load 실패` 경로는 같은 helper 결과를 재사용하되, 배경 설정 적용 여부 같은 분기별 차이는 그대로 유지했다.
  - `loadSlotCollectionsState`도 fallback battle logs를 숫자 timestamp로 정규화해 helper 반환값 일관성을 맞췄다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameData.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameData.js src/hooks/useGameData.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- `useGameData`의 `loadSlot`은 이제 성공 경로의 logs read / collections merge / runtime rebuild / hydration packaging 뿐 아니라, 실패 경로 fallback 초기화도 helper 경계를 갖게 됐다. 다음 단계는 `applyLazyUpdateForAction` 쪽에서 `loadSlot`과 겹치는 reconstruction 패턴을 공통화하는 방향이 가장 자연스럽다.

## [2026-04-11] `useGameData` 5차 분리: logs/battleLogs loader helper 추출

### 작업 유형
- 🧩 `loadSlot`의 logs/battleLogs Firestore read fallback helper 추출
- 🧪 subcollection 우선 / legacy fallback 계약 테스트 추가

### 목적 및 영향
- **목적:** `loadSlot` effect에 남아 있던 Firestore `logs`/`battleLogs` read 분기를 helper로 이동해, effect 본문을 더 오케스트레이션 중심으로 만든다.
- **범위:** 쿼리 조건(`timestamp desc`, activity max 100개, battle max 100개), `createdAt` filtering, activity fallback의 `initializeActivityLogs`, battle fallback의 legacy `digimonStats.battleLogs` 규칙은 그대로 유지한다.
- **내용:**
  - `loadSlotCollectionsState`를 추가해 `slotRef`를 기준으로 `logs`와 `battleLogs`를 읽고, 없거나 실패하면 legacy 배열로 fallback 하도록 정리했다.
  - 테스트에서는 loader 콜백 주입 방식으로 subcollection 우선 사용과 빈 결과/실패 시 fallback 계약을 고정했다.
  - `loadSlot`은 이제 `slot document read -> log collections load -> collections merge -> runtime reconstruction -> hydration result -> setter` 단계로 읽힌다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameData.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameData.js src/hooks/useGameData.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- `useGameData`의 `loadSlot` effect는 이제 read/fallback, collections merge, runtime rebuild, hydration packaging, setter fan-out이 각각 helper 경계를 갖게 됐다. 다음 단계에서는 `slot 없음`/`load 실패` fallback initializer를 helper로 올리거나, `applyLazyUpdateForAction` 쪽 재구성 로직과 중복되는 부분을 공통화하는 방향이 자연스럽다.

## [2026-04-11] `useGameData` 4차 분리: loaded collections 병합 helper 추출

### 작업 유형
- 🧩 `activityLogs`/`battleLogs` 병합과 proteinCount cleanup 힌트 helper 추출
- 🧪 collections 병합 helper 테스트 추가

### 목적 및 영향
- **목적:** `loadSlot` effect에서 로그 컬렉션 read 결과를 `savedStats`에 합치는 단계와 runtime 재구성 단계를 분리해, effect의 책임을 더 작게 나눈다.
- **범위:** Firestore read 자체와 proteinCount 삭제용 `updateDoc`, reconstructed log 저장, setter 호출은 그대로 두고, `loadedActivityLogs`/`loadedBattleLogs`를 stats로 편입하는 계산만 `buildLoadedSlotCollectionsState`로 이동한다.
- **내용:**
  - `buildLoadedSlotCollectionsState`를 추가해 UI용 로그 순서와 runtime용 stats 내부 로그 순서 차이를 한 곳에서 처리했다.
  - battle log timestamp normalize와 `proteinCount` 제거 여부를 helper가 같이 반환하도록 바꿔, effect 본문은 `needsProteinCountCleanup`만 보고 Firestore cleanup write를 수행하게 정리했다.
  - `buildLoadedSlotRuntimeState`는 이제 이미 병합된 `savedStats`만 받아 lazy update 이후 runtime 상태를 계산하도록 입력이 더 단순해졌다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameData.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameData.js src/hooks/useGameData.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 이제 `loadSlot`은 `컬렉션 병합 -> runtime 재구성 -> hydration 결과 조립 -> setter 반영` 네 단계로 읽을 수 있게 됐다. 다음 단계에서는 Firestore `logs`/`battleLogs` read fallback 자체를 작은 loader helper로 옮기면 effect 본문이 더 명확해질 수 있다.

## [2026-04-11] `useGameData` 3차 분리: 로드된 로그 기반 runtime 재구성 helper 추출

### 작업 유형
- 🧩 `loadSlot`의 non-empty stats 경로에서 runtime 재구성 helper 추출
- 🧪 로그 병합 / starter TTE 보정 / sprite sync 테스트 추가

### 목적 및 영향
- **목적:** `loadSlot` 안에 남아 있던 `activityLogs`/`battleLogs` 결합, lazy update 입력 조합, reconstructed log 계산을 순수 helper로 분리해 effect 본문을 더 작게 만든다.
- **범위:** Firestore read, proteinCount 마이그레이션 write, reconstructed log의 서브컬렉션 저장, setter 호출은 그대로 유지하고, 기존 저장본을 메모리 runtime 상태로 복원하는 계산만 `buildLoadedSlotRuntimeState`로 이동한다.
- **내용:**
  - `buildLoadedSlotRuntimeState`를 추가해 loaded logs를 `digimonStats`에 반영하고, `resolveLazyUpdateBaseStats` + `applyLazyUpdate` + `repairCareMistakeLedger` + reconstructed log 계산을 한 곳으로 모았다.
  - 스타터 디지몬의 `timeToEvolveSeconds` 보정과 sprite sync도 helper 경계 안으로 옮겨, `loadSlot`이 직접 계산하던 조건 분기를 줄였다.
  - effect 본문에서는 helper 결과의 `reconstructedLogsToPersist`만 순회해 `appendLogToSubcollection`을 호출하고, 나머지는 기존 hydration helper에 넘기도록 정리했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameData.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameData.js src/hooks/useGameData.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 이제 `useGameData`의 `loadSlot` effect에는 `runtime 재구성`과 `setter 반영` 사이에 명시적인 helper 경계가 생겼다. 다음 단계에서는 `logs/battleLogs` read fallback 자체를 별도 helper로 정리하거나, `proteinCount` cleanup 같은 write 힌트를 helper 반환값으로 끌어올리는 방향이 자연스럽다.

## [2026-04-11] `useGameData` 2차 분리: 로드 hydration 결과 object helper 추출

### 작업 유형
- 🧩 `loadSlot` effect의 setter 입력용 hydration 결과 object helper 추출
- 🧪 hydration 결과 기본값/복원 규칙 테스트 추가

### 목적 및 영향
- **목적:** `useGameData`의 `loadSlot` effect에서 “읽은 문서/로그를 어떤 React 상태로 반영할지” 계산과 실제 setter 호출을 분리한다.
- **범위:** Firestore read, lazy update, 로그 재구성, 마이그레이션 write 타이밍은 그대로 유지하고, 최종 상태 조립만 `buildLoadedSlotHydrationResult`로 이동한다.
- **내용:**
  - `buildLoadedSlotHydrationResult`를 추가해 슬롯 메타, 루트 필드, 배경/몰입형 설정, activityLogs, `selectedDigimon`, `digimonStats`, `deathReason`을 setter 입력용 object로 조립하도록 했다.
  - `loadSlot`에서는 로그를 읽고 lazy update를 적용한 뒤 helper 결과를 받아 `setSlotName`, `setSelectedDigimon`, `setDigimonStats`, `setBackgroundSettings`, `setImmersiveSettings`만 적용하도록 정리했다.
  - 로드 경로에서 `backgroundSettings`와 `immersiveSettings` 기본값 fallback, deathReason 복원, `selectedDigimon` 포함 상태 조립 규칙을 테스트로 고정했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameData.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameData.js src/hooks/useGameData.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 이제 `loadSlot`은 “데이터 읽기/재구성”과 “setter 반영” 사이에 명시적인 hydration 결과 경계가 생겼다. 다음 단계에서는 `logs` / `battleLogs` 로드와 lazy update 입력 조합을 별도 순수 helper로 좁혀 나가면, effect 본문을 더 안전하게 줄일 수 있다.

## [2026-04-10] `useGameData` 1차 분리: 슬롯 문서 update payload helper 추출

### 작업 유형
- 🧩 `saveStats` / `persistDeathSnapshot` 공통 Firestore update payload helper 추출
- 🧪 payload shape characterization test 추가

### 목적 및 영향
- **목적:** `useGameData`에서 가장 안전한 중복 제거 지점인 슬롯 루트 문서 update payload 조립을 한 곳으로 모아, 이후 저장/로딩 경계 분리를 더 쉽게 만든다.
- **범위:** 저장 순서, lazy update 호출, 사망 스냅샷 저장 타이밍은 그대로 유지하고, `updateDoc`에 전달하는 payload 조립만 helper로 통일한다.
- **내용:**
  - `buildSlotDocumentUpdatePayload`를 추가해 `digimonStats`, 루트 필드, `dailySleepMistake` 삭제, `lastSavedAt`, `lastSavedAtServer`, `updatedAt` 조립을 공통화했다.
  - `saveStats`는 background 설정과 `selectedDigimon`/`digimonDisplayName` 저장 gate를 기존 의미 그대로 helper 인자로 넘기도록 정리했다.
  - `persistDeathSnapshot`도 같은 helper를 재사용해, 사망 직후 스냅샷 저장 계약이 `saveStats`와 같은 구조를 따르도록 맞췄다.
  - 테스트에는 기본 payload shape, 로딩 완료 후 표시명 저장 gate, backgroundSettings 포함 조건을 추가했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameData.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useGameData.js src/hooks/useGameData.test.js`

### 아키텍처 메모
- 이 helper는 `useGameData`의 저장 계약을 먼저 고정하는 역할이다. 다음 단계에서는 더 큰 리스크가 있는 `loadSlot` effect 분리보다, 저장/복원에 공통으로 쓰이는 순수 계산이나 hydration 결과 object 조립을 단계적으로 분리하는 편이 안전하다.

## [2026-04-10] `useEvolution` 10차 분리: 조그레스 성공 UI 피드백 helper 추출

### 작업 유형
- 🧩 guest 성공 alert / room-host modal close+alert를 UI helper로 추출
- 🧪 성공 피드백 helper 단위 테스트 및 host-room 흐름 assertion 보강

### 목적 및 영향
- **목적:** `useEvolution`에 남아 있던 조그레스 성공 UI tail을 helper로 옮겨, 도메인 흐름과 UI 피드백을 더 분리한다.
- **범위:** 성공 시 alert 문구와 room-host 모달 닫기만 helper로 이동하고, 저장/도감/archive/완료 상태 반영 순서는 그대로 유지한다.
- **내용:**
  - `jogressUiFeedbackHelpers`에 `showJogressSuccessFeedback`를 추가했다.
  - guest 성공 경로는 alert 직접 호출 대신 helper를 사용하고, room-host 성공 경로는 `toggleModal("jogressRoomList", false)` + success alert를 helper로 묶었다.
  - `useEvolution.test.js`에는 room-host 성공 alert assertion을 추가했고, helper 단위 테스트로 guest/host-room/`toggleModal` 없는 경우를 고정했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.test.js`
- `digimon-tamagotchi-frontend/src/hooks/jogressUiFeedbackHelpers.js`
- `digimon-tamagotchi-frontend/src/hooks/jogressUiFeedbackHelpers.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/jogressUiFeedbackHelpers.test.js src/hooks/evolutionEncyclopediaHelpers.test.js src/hooks/jogressCompletionHelpers.test.js src/hooks/useEvolution.test.js src/hooks/useJogressRoomLifecycle.test.js src/hooks/jogressPresentationHelpers.test.js src/hooks/jogressPersistenceHelpers.test.js src/hooks/evolutionStateHelpers.test.js src/hooks/game-runtime/useJogressSubscriptions.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useEvolution.js src/hooks/useEvolution.test.js src/hooks/jogressUiFeedbackHelpers.js src/hooks/jogressUiFeedbackHelpers.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 이제 `useEvolution`의 guest/host-room 성공 UI 후처리도 helper 경계가 생겼다. 남은 큰 정리 대상은 direct host 시작 시 `toggleModal("jogressOnlineSelect", false)` 같은 진입 UI 제어나, 더 이상 확장하지 않을 helper 이름/폴더 구조 정리 정도다.

## [2026-04-10] `useEvolution` 9차 분리: 일반 진화와 로컬 조그레스 encyclopedia 흐름도 helper로 통일

### 작업 유형
- 🧩 `evolve`와 `proceedJogressLocal`의 encyclopedia update 분기를 helper 재사용으로 정리
- 🧪 encyclopedia helper 가드 케이스 테스트 추가

### 목적 및 영향
- **목적:** 앞 단계에서 host 완료 경로에만 적용했던 encyclopedia helper를 일반 진화와 로컬 조그레스까지 확장해, `useEvolution` 내부의 encyclopedia update 패턴을 한 방식으로 통일한다.
- **범위:** 기존 에러 전파 동작은 그대로 유지하고, `selectedDigimon`/`targetId` 유무에 따른 호출 가드만 helper로 옮긴다.
- **내용:**
  - `evolve`의 진화 전 기록 + 진화 후 discovery 분기를 `syncEvolutionEncyclopediaEntries` 호출로 교체했다.
  - `proceedJogressLocal`의 encyclopedia 분기도 같은 helper로 정리해 host/local/room-host가 같은 계약을 공유하도록 맞췄다.
  - helper 테스트에는 `previousDigimonId`만 있는 경우, `targetId`만 있는 경우를 추가해 가드 케이스를 고정했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
- `digimon-tamagotchi-frontend/src/hooks/evolutionEncyclopediaHelpers.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/evolutionEncyclopediaHelpers.test.js src/hooks/jogressCompletionHelpers.test.js src/hooks/useEvolution.test.js src/hooks/useJogressRoomLifecycle.test.js src/hooks/jogressPresentationHelpers.test.js src/hooks/jogressPersistenceHelpers.test.js src/hooks/evolutionStateHelpers.test.js src/hooks/game-runtime/useJogressSubscriptions.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useEvolution.js src/hooks/evolutionEncyclopediaHelpers.js src/hooks/evolutionEncyclopediaHelpers.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 이제 `useEvolution`에서 encyclopedia update는 모두 helper를 통해 지나간다. 다음 단계는 guest 성공 alert / room-host modal close 같은 UI 후처리를 작은 helper로 정리하는 선택지가 자연스럽다.

## [2026-04-10] `useEvolution` 8차 분리: host 조그레스 encyclopedia update helper 추출

### 작업 유형
- 🧩 host 완료 경로의 encyclopedia update 분기를 helper로 추출
- 🧪 starter skip / swallowErrors 계약 테스트 추가

### 목적 및 영향
- **목적:** `proceedJogressOnlineAsHost`, `proceedJogressOnlineAsHostForRoom`에 남아 있던 encyclopedia update 분기를 한 곳으로 모아, 남은 side effect를 더 작게 다룰 수 있게 한다.
- **범위:** host 완료 경로 두 곳에만 적용하고, `evolve`와 local jogress의 encyclopedia 흐름은 그대로 둔다.
- **내용:**
  - `evolutionEncyclopediaHelpers`에 `syncEvolutionEncyclopediaEntries`를 추가했다.
  - 일반 host 완료 경로는 기존처럼 encyclopedia update 오류를 전파하고, room 기반 완료 경로는 `swallowErrors: true`로 기존 `.catch(() => {})` 의미를 유지했다.
  - helper 단위 테스트에서 evolution/discovery 순서, 스타터 discovery skip, 예외 전파, 예외 삼키기 계약을 고정했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
- `digimon-tamagotchi-frontend/src/hooks/evolutionEncyclopediaHelpers.js`
- `digimon-tamagotchi-frontend/src/hooks/evolutionEncyclopediaHelpers.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/evolutionEncyclopediaHelpers.test.js src/hooks/jogressCompletionHelpers.test.js src/hooks/useEvolution.test.js src/hooks/useJogressRoomLifecycle.test.js src/hooks/jogressPresentationHelpers.test.js src/hooks/jogressPersistenceHelpers.test.js src/hooks/evolutionStateHelpers.test.js src/hooks/game-runtime/useJogressSubscriptions.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useEvolution.js src/hooks/evolutionEncyclopediaHelpers.js src/hooks/evolutionEncyclopediaHelpers.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 이제 online host 완료 경로는 `room lifecycle`, `state/log transition`, `persistence payload`, `presentation/archive payload`, `completion state`, `encyclopedia sync`까지 helper 경계가 생겼다. 다음 단계는 guest 성공 alert와 host-room modal/alert 같은 UI 후처리를 더 좁히거나, `evolve`/local jogress encyclopedia 흐름까지 같은 패턴으로 맞추는 선택지로 이어질 수 있다.

## [2026-04-10] `useEvolution` 7차 분리: host 완료 상태 마무리 helper 추출

### 작업 유형
- 🧩 online host 완료 후 공통 상태 반영을 작은 helper로 추출
- 🧪 완료 상태 setter 회귀 테스트 보강

### 목적 및 영향
- **목적:** `proceedJogressOnlineAsHost`, `proceedJogressOnlineAsHostForRoom`에 남아 있던 동일한 완료 상태 반영 코드를 한 곳으로 모아, 이후 encyclopedia/post-effect 분리를 더 안전하게 진행할 수 있게 한다.
- **범위:** `setEvolutionCompleteIsJogress`, `setEvolvedDigimonName`, `setEvolutionStage` 호출만 helper로 이동하고, archive/save/modal/alert 순서는 그대로 유지한다.
- **내용:**
  - `jogressCompletionHelpers`에 `finalizeOnlineJogressCompletionState`를 추가했다.
  - 두 host 완료 경로는 이제 공통 helper를 통해 완료 상태를 반영한다.
  - `useEvolution.test.js`에는 host room 완료 시 완료 상태 setter들이 실제로 호출되는 assertion을 추가했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.test.js`
- `digimon-tamagotchi-frontend/src/hooks/jogressCompletionHelpers.js`
- `digimon-tamagotchi-frontend/src/hooks/jogressCompletionHelpers.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/jogressCompletionHelpers.test.js src/hooks/useEvolution.test.js src/hooks/useJogressRoomLifecycle.test.js src/hooks/jogressPresentationHelpers.test.js src/hooks/jogressPersistenceHelpers.test.js src/hooks/evolutionStateHelpers.test.js src/hooks/game-runtime/useJogressSubscriptions.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useEvolution.js src/hooks/useEvolution.test.js src/hooks/jogressCompletionHelpers.js src/hooks/jogressCompletionHelpers.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 이번 단계는 아주 작은 공통 성공 tail만 묶은 것이다. 다음 단계는 이 안전망 위에서 host/room complete 경로의 `updateEncyclopedia` 분기를 별도 helper로 옮기는 쪽이 가장 자연스럽다.

## [2026-04-10] `useEvolution` 6차 분리: guest waiting room cleanup을 lifecycle hook으로 이동

### 작업 유형
- 🧩 guest waiting room 정리 로직을 `useJogressRoomLifecycle` 새 메서드로 추출
- 🧪 indexed query / fallback query cleanup 테스트 추가

### 목적 및 영향
- **목적:** `proceedJogressOnlineAsGuest` 안에 남아 있던 `jogress_rooms` 조회와 자기 waiting room 취소 분기를 `useEvolution` 밖으로 옮겨 온라인 조그레스 guest 완료 흐름을 더 얇게 만든다.
- **범위:** room `paired` 전이, guest slot 저장, current-slot sync 순서는 그대로 유지하고, cleanup query + `cancelJogressRoom` 위임만 lifecycle hook으로 이동한다.
- **내용:**
  - `useJogressRoomLifecycle`에 `cancelOwnedWaitingJogressRoomsForSlot`를 추가해 현재 유저의 waiting room 중 특정 슬롯과 연결된 방만 찾아 취소하도록 정리했다.
  - 인덱스 쿼리가 실패할 때는 기존과 동일하게 `status=waiting` fallback 조회 후 `hostUid`로 다시 거르는 동작을 유지했다.
  - `useEvolution`의 guest join 경로는 이제 cleanup block 대신 새 lifecycle 메서드만 호출하도록 단순화했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
- `digimon-tamagotchi-frontend/src/hooks/useJogressRoomLifecycle.js`
- `digimon-tamagotchi-frontend/src/hooks/useJogressRoomLifecycle.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useEvolution.test.js src/hooks/useJogressRoomLifecycle.test.js src/hooks/jogressPresentationHelpers.test.js src/hooks/jogressPersistenceHelpers.test.js src/hooks/evolutionStateHelpers.test.js src/hooks/game-runtime/useJogressSubscriptions.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useEvolution.js src/hooks/useJogressRoomLifecycle.js src/hooks/useJogressRoomLifecycle.test.js src/hooks/jogressPresentationHelpers.js src/hooks/jogressPresentationHelpers.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 이제 guest join 완료 경로에서 `useEvolution`에 남은 Firestore 직접 질의는 실질적으로 사라지고, room 관리 책임은 `useJogressRoomLifecycle` 쪽으로 더 모였다. 다음 단계는 `updateEncyclopedia` 분기나 host/room complete 후처리처럼 아직 남아 있는 side effect 묶음을 더 작게 나누는 것이다.

## [2026-04-10] `useEvolution` 5차 분리: 조그레스 summary/archive payload helper 추출

### 작업 유형
- 🧩 조그레스 완료 summary/archive payload 조립을 순수 helper로 추출
- 🧪 presentation helper 단위 테스트 및 host-room archive payload 회귀 테스트 추가

### 목적 및 영향
- **목적:** `useEvolution` 온라인 조그레스 완료 경로에 남아 있던 summary 구성과 archive payload 조립 중복을 줄여, 다음 단계에서 waiting room 정리나 encyclopedia 분기를 더 안전하게 분리할 수 있게 한다.
- **범위:** Firestore write 순서, current-slot sync, encyclopedia 업데이트, modal 제어는 그대로 두고 결과 presentation/archive object 조립만 helper로 이동한다.
- **내용:**
  - `jogressPresentationHelpers`를 추가해 `buildJogressSummary`, `buildJogressArchivePayload`를 만들고 local/online host/room 완료 경로에서 공통으로 사용하도록 정리했다.
  - local 조그레스와 online host 조그레스에서 반복되던 `currentLabel`, `partnerLabel`, `resultName`, archive `payload.mode/resultName/slotLabel/roomId` 조립을 호출부 밖으로 옮겼다.
  - `proceedJogressOnlineAsHostForRoom` 테스트에는 archive payload의 `mode`, `resultName`, `roomId`까지 고정하는 assertion을 추가해 helper 연결 회귀를 막았다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.test.js`
- `digimon-tamagotchi-frontend/src/hooks/jogressPresentationHelpers.js`
- `digimon-tamagotchi-frontend/src/hooks/jogressPresentationHelpers.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/jogressPresentationHelpers.test.js src/hooks/useEvolution.test.js src/hooks/jogressPersistenceHelpers.test.js src/hooks/evolutionStateHelpers.test.js src/hooks/useJogressRoomLifecycle.test.js src/hooks/game-runtime/useJogressSubscriptions.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/jogressPresentationHelpers.js src/hooks/jogressPresentationHelpers.test.js src/hooks/useEvolution.js src/hooks/useEvolution.test.js src/hooks/jogressPersistenceHelpers.js src/hooks/evolutionStateHelpers.js src/hooks/useJogressRoomLifecycle.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 이제 `useEvolution`의 온라인 조그레스 완료 경로는 `room lifecycle`, `state/log transition`, `persistence payload`, `presentation/archive payload`까지 helper 경계가 생겼다. 다음 안전 단계는 여전히 guest waiting room 정리와 encyclopedia update 분기인데, 이 둘은 Firestore 질의와 side effect가 남아 있어서 이번처럼 characterization test를 유지한 채 더 작게 떼는 편이 적합하다.

## [2026-04-10] `useEvolution` 4차 분리 준비: 온라인 조그레스 guest/host complete 흐름 테스트 고정

### 작업 유형
- 🧪 `useEvolution` public hook 기준 온라인 조그레스 흐름 characterization test 추가
- 🧭 guest join / current-slot sync / host complete 회귀 포인트 문서화

### 목적 및 영향
- **목적:** `proceedJogressOnlineAsGuest` 와 `proceedJogressOnlineAsHostForRoom` 를 더 작게 분해하기 전에, 현재 동작을 public hook 기준으로 고정해 이후 리팩터링 리스크를 낮춘다.
- **범위:** 테스트와 문서화만 추가하고, 실제 저장 순서와 archive/도감 로직은 변경하지 않는다.
- **내용:**
  - `useEvolution.test.js`를 확장해 guest join 시 room이 `paired` 로 바뀌고 guest slot 문서가 진화 결과로 저장되는 경로를 고정했다.
  - 같은 테스트 파일에서 현재 보고 있는 guest slot일 때 `setDigimonStatsAndSave`/`setSelectedDigimonAndSave`가 호출되고, 자기 waiting room이 `cancelJogressRoom` 경유로 정리되는 흐름을 추가로 묶었다.
  - host complete 경로는 `proceedJogressOnlineAsHostForRoom` 기준으로 slot 문서 update, room `completed` 전이, current-slot append/save 동기화가 함께 일어나는지를 검증하도록 추가했다.
  - 이 테스트는 helper를 전부 mock하지 않고 실제 `useEvolution` 조합을 기준으로 잡아, 이후 내부 helper 분리에도 회귀를 더 잘 잡도록 했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useEvolution.test.js src/hooks/jogressPersistenceHelpers.test.js src/hooks/evolutionStateHelpers.test.js src/hooks/useJogressRoomLifecycle.test.js src/hooks/game-runtime/useJogressSubscriptions.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/useEvolution.test.js src/hooks/jogressPersistenceHelpers.test.js src/hooks/evolutionStateHelpers.test.js src/hooks/useEvolution.js src/hooks/jogressPersistenceHelpers.js src/hooks/evolutionStateHelpers.js src/hooks/useJogressRoomLifecycle.js src/hooks/useJogressRoomLifecycle.test.js src/hooks/game-runtime/useJogressSubscriptions.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 이제 `useEvolution`은 room lifecycle helper, state/log payload helper, persistence helper, 그리고 실제 guest/host complete characterization test까지 갖춘 상태다. 다음 단계는 남은 복잡도인 waiting room 정리와 archive/summary 구성 분기를 worker/helper로 더 나누되, 이번에 추가한 public flow 테스트를 안전망으로 삼는 방식이 적합하다.

## [2026-04-10] `useEvolution` 3차 분리: 조그레스 persistence payload/helper 정리

### 작업 유형
- 🧩 온라인 조그레스 완료 payload와 현재 슬롯 동기화 분기를 helper로 추출
- 🧪 persistence helper 계약 테스트 추가

### 목적 및 영향
- **목적:** `proceedJogressOnlineAsGuest`, `proceedJogressOnlineAsHost`, `proceedJogressOnlineAsHostForRoom`에 남아 있던 Firestore update payload와 current slot sync 분기를 정리해 다음 완료 경로 리팩터링의 결합도를 낮춘다.
- **범위:** room `paired/completed` payload, completed slot payload, current viewed slot sync 분기만 helper로 이동하고, room 검색/도감/archive/alert 흐름은 기존 호출부에 남긴다.
- **내용:**
  - `jogressPersistenceHelpers`를 추가해 guest room `paired` payload, host room `completed` payload, completed slot 저장 payload를 공통 함수로 만들었다.
  - `syncCurrentJogressSlot` helper를 추가해 현재 보고 있는 슬롯일 때 save-backed/local-only/auto fallback 분기를 한 곳에서 처리하도록 정리했다.
  - `useEvolution`의 guest join, host complete, room-based host complete 경로는 이제 helper가 만든 payload를 사용해 updateDoc/writeBatch와 현재 슬롯 동기화만 연결한다.
  - guest join에서는 기존처럼 `jogressStatus`를 비우지 않고, host complete 경로에서는 `jogressStatus: {}`를 유지하는 차이를 helper 옵션으로 명시했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
- `digimon-tamagotchi-frontend/src/hooks/jogressPersistenceHelpers.js`
- `digimon-tamagotchi-frontend/src/hooks/jogressPersistenceHelpers.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/jogressPersistenceHelpers.test.js src/hooks/evolutionStateHelpers.test.js src/hooks/useJogressRoomLifecycle.test.js src/hooks/useEvolution.test.js src/hooks/game-runtime/useJogressSubscriptions.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/jogressPersistenceHelpers.js src/hooks/jogressPersistenceHelpers.test.js src/hooks/evolutionStateHelpers.js src/hooks/evolutionStateHelpers.test.js src/hooks/useJogressRoomLifecycle.js src/hooks/useJogressRoomLifecycle.test.js src/hooks/useEvolution.js src/hooks/useEvolution.test.js src/hooks/game-runtime/useJogressSubscriptions.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 이번 단계는 guest/host complete 경로의 저장 payload와 현재 슬롯 동기화 분기를 먼저 정리한 것이다. 다음 단계는 이제 상대적으로 남은 복잡도인 `내 waiting room 정리`, `archive payload 구성`, `도감 업데이트/summary 계산`을 더 작은 worker/helper로 옮기는 쪽이 자연스럽다.

## [2026-04-10] 자유게시판 1장 이미지 첨부 지원 추가

### 작업 유형
- 🖼 자유게시판 전용 이미지 첨부 기능 추가
- ☁️ Supabase Storage 버킷/DB 메타데이터 확장
- 🧪 커뮤니티 서버/클라이언트/페이지 회귀 테스트 보강

### 목적 및 영향
- **목적:** 자유게시판 글에서 텍스트 중심 흐름은 유지하되, 필요한 경우 이미지 1장을 함께 첨부해 상세에서 더 풍부하게 확인할 수 있게 한다.
- **범위:** 자유게시판(`board=free`) 글쓰기/수정/상세에만 적용하고, 자랑게시판 스냅샷 카드 구조는 그대로 유지한다.
- **내용:**
  - `community_posts`에 `image_path` 컬럼을 추가하고, `community-post-images` 공개 버킷을 생성하는 마이그레이션을 추가했다.
  - 서버 커뮤니티 유틸은 자유게시판 글 생성/수정 시 `JPG/PNG/WEBP`, 최대 2MB 이미지 1장을 data URL로 받아 Supabase Storage에 업로드하고 `image_path`를 저장하도록 확장했다.
  - 자유게시판 글 수정에서는 기존 이미지 유지, 새 이미지로 교체, 기존 이미지 제거를 모두 처리하고, 게시글 삭제 시 storage 파일도 함께 정리하도록 넣었다.
  - 게시글 목록/상세 응답에는 `imagePath`, `imageUrl`, `imageAlt`를 포함해 프론트가 별도 스토리지 계산 없이 바로 렌더링할 수 있게 맞췄다.
  - 자유게시판 글쓰기 모달은 파일 선택, 미리보기, 제거 버튼, 첨부 정책 안내를 추가했고, 상세 모달은 이미지가 있으면 본문과 함께 자연스럽게 노출하도록 확장했다.
  - 목록은 여전히 텍스트 보드 성격을 유지하도록 썸네일 없이 두고, 이미지는 상세에서만 크게 보여 주는 방향을 유지했다.

### 영향받은 파일
- `supabase/migrations/20260410_community_free_board_images.sql`
- `api/_lib/community.js`
- `api/_lib/community.test.js`
- `tests/community-lib.test.js`
- `digimon-tamagotchi-frontend/src/pages/Community.jsx`
- `digimon-tamagotchi-frontend/src/pages/Community.test.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunityFreePostComposer.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunityPostDetailDialog.jsx`
- `digimon-tamagotchi-frontend/src/utils/communityApi.test.js`
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### 검증
- `node --test api/_lib/community.test.js tests/community-lib.test.js`
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/pages/Community.test.jsx src/utils/communityApi.test.js`
- `node -e "require('./api/_lib/community'); require('./api/community/[boardId]/posts/index.js'); require('./api/community/[boardId]/posts/[postId].js'); require('./api/community/[boardId]/posts/[postId]/comments/index.js'); require('./api/community/[boardId]/comments/[commentId].js'); console.log('api-ok');"`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

## [2026-04-10] `useEvolution` 2차 분리: 진화 결과 state/log payload helper 추출

### 작업 유형
- 🧩 일반 진화/조그레스에 공통인 결과 state/log 조립을 순수 helper로 추출
- 🧪 helper 레벨 characterization test 추가

### 목적 및 영향
- **목적:** `useEvolution` 내부의 일반 진화, 로컬 조그레스, 온라인 guest/host complete 경로에 반복되던 reset/log 조립을 한 곳으로 모아 다음 저장 순서 분리 단계의 리스크를 줄인다.
- **범위:** `initializeStats`, sprite 동기화, `EVOLUTION` activity log 추가, `{ ...stats, activityLogs, selectedDigimon }` 조립만 helper로 이동하고, Firestore write 순서와 도감/archive/모달 부작용은 기존 호출부에 남긴다.
- **내용:**
  - `evolutionStateHelpers`를 추가해 진화 시 리셋되는 공통 스탯과 진화 결과 payload를 순수 함수로 만들었다.
  - `useEvolution`의 `evolve`, `proceedJogressLocal`, `proceedJogressOnlineAsGuest`, `proceedJogressOnlineAsHost`, `proceedJogressOnlineAsHostForRoom`는 이제 helper가 만든 `nextStatsWithLogs`와 `updatedLogs`를 받아 저장/부작용만 처리한다.
  - `buildDigimonLogSnapshot` 인자는 함수마다 조금씩 달라서 helper 입력을 `snapshotArgs`로 열어두고, 호출부가 기존 계약을 그대로 넘기도록 유지했다.
  - 이 단계로 중복이 큰 “target data 조회 → reset stats → initializeStats → sprite sync → EVOLUTION log 추가” 패턴이 한 군데로 모였다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
- `digimon-tamagotchi-frontend/src/hooks/evolutionStateHelpers.js`
- `digimon-tamagotchi-frontend/src/hooks/evolutionStateHelpers.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/evolutionStateHelpers.test.js src/hooks/useJogressRoomLifecycle.test.js src/hooks/useEvolution.test.js src/hooks/game-runtime/useJogressSubscriptions.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/hooks/evolutionStateHelpers.js src/hooks/evolutionStateHelpers.test.js src/hooks/useEvolution.js src/hooks/useEvolution.test.js src/hooks/useJogressRoomLifecycle.js src/hooks/useJogressRoomLifecycle.test.js src/hooks/game-runtime/useJogressSubscriptions.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 이번 단계는 `useEvolution`의 저장 순서 자체를 건드리지 않고, 반복되는 결과 payload 조립만 줄인 안전한 중간 단계다. 다음 라운드는 이 helper를 유지한 채 guest join과 host complete 경로의 DB write/local sync/archive 분기를 더 작은 worker/helper로 나누는 쪽이 적합하다.

## [2026-04-10] `useEvolution` 1차 분리: 온라인 조그레스 room lifecycle 추출

### 작업 유형
- 🧩 온라인 조그레스 room 생성/취소/호스트 상태 반영을 전용 lifecycle 훅으로 추출
- 🧪 room lifecycle payload와 상태 전이 characterization test 추가

### 목적 및 영향
- **목적:** `useEvolution`에서 가장 먼저 분리하기 쉬운 온라인 조그레스 room lifecycle 경계를 떼어내, 이후 guest/host complete 경로 분해를 위한 안전한 기반을 만든다.
- **범위:** `createJogressRoom`, `createJogressRoomForSlot`, `cancelJogressRoom`, `applyHostJogressStatusFromRoom`만 새 훅으로 이동하고, 실제 guest/host 조그레스 진화 처리와 도감/archive/로컬 저장 동기화는 그대로 유지한다.
- **내용:**
  - `useJogressRoomLifecycle`를 추가해 room 생성, host slot의 `jogressStatus.isWaiting` 반영, room 취소, paired room을 host slot의 `canEvolve` 상태로 번역하는 로직을 `useEvolution` 밖으로 옮겼다.
  - `useEvolution`은 새 lifecycle 훅을 내부에서 조합해 기존 public API 키를 그대로 반환하도록 유지했다.
  - `isOnlineJogressSupported`를 lifecycle 계층으로 같이 이동해 버전 지원 판정이 guest/host complete 경로와 같은 규칙을 계속 사용하도록 맞췄다.
  - 이번 단계에서는 `proceedJogressOnlineAsGuest`, `proceedJogressOnlineAsHost`, `proceedJogressOnlineAsHostForRoom`의 저장 순서와 부작용은 건드리지 않았다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
- `digimon-tamagotchi-frontend/src/hooks/useJogressRoomLifecycle.js`
- `digimon-tamagotchi-frontend/src/hooks/useJogressRoomLifecycle.test.js`
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useJogressRoomLifecycle.test.js src/hooks/useEvolution.test.js src/hooks/game-runtime/useJogressSubscriptions.test.js`

### 아키텍처 메모
- room lifecycle은 Firestore room/slot 상태 전이만 담당하고, 실제 진화 결과 계산·도감 업데이트·archive 저장보다 결합도가 낮아 `useEvolution` 첫 분리 대상으로 적합했다. 다음 단계는 이 테스트를 유지한 채 guest join과 host complete 경로의 reset/log payload 중복을 줄이는 쪽이 안전하다.

## [2026-04-10] 운영 도감 발견 이력 복구: 루트/버전 문서 병합 로드

### 작업 유형
- 🛠️ 도감 마이그레이션 회귀 버그 수정
- 🛟 빈 도감 문서에 대한 슬롯/로그 기반 복구 경로 추가
- 🧪 부분 이전 상태 재현 테스트 추가

### 목적 및 영향
- **목적:** 운영 계정에서 `users/{uid}.encyclopedia`에 남아 있던 기존 발견 이력이, 새 `users/{uid}/encyclopedia/{version}` 문서가 일부만 존재하는 상태에서 0건처럼 보이던 문제를 복구한다.
- **범위:** 도감 로드 로직과 관련 훅 테스트만 수정하고, 저장 위치는 기존처럼 버전 문서 분리 구조를 유지한다.
- **내용:**
  - `loadEncyclopedia()`가 이제 루트 legacy 도감과 버전별 문서를 함께 읽어 병합한다.
  - 같은 디지몬 키가 양쪽에 모두 있으면 최신 분리 저장 문서 값을 우선 사용하고, 루트에만 남아 있는 과거 발견 이력은 유지한다.
  - 현재 문서가 모두 비어 있으면, 더 오래된 `users/{uid}/slots/slotN.encyclopedia` legacy 슬롯 도감까지 읽어 합친다.
  - 위 legacy 슬롯 도감도 비어 있으면, 각 슬롯의 `selectedDigimon`, 문서 내 activity/battle 로그, 서브컬렉션 `logs`/`battleLogs`를 스캔해 최소한의 발견 이력을 재구성한다.
  - 진화/환생/조그레스 전환 로그의 텍스트와 `digimonId`/`digimonName` 스냅샷을 함께 해석해, 계정 도감 문서가 사라져도 슬롯 기록에서 복구 가능한 종은 다시 보이도록 했다.
  - 비어 있는 버전 문서가 존재해도 루트 도감 데이터가 가려지지 않는 회귀 테스트를 추가했다.
  - 계정 통합 이전에 슬롯 단위로만 남아 있던 도감, 그리고 계정 도감 문서가 비어 있어도 슬롯 기록에 남아 있는 도감은 화면에서 다시 보이도록 복구 경로를 열었다.
  - 이 변경으로 운영환경 도감 모달과 `/me/collection` 페이지가 모두 같은 병합 데이터를 사용하게 된다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useEncyclopedia.js`
- `digimon-tamagotchi-frontend/src/hooks/useEncyclopedia.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useEncyclopedia.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

## [2026-04-10] 커뮤니티 `디스코드/후원` 보드에 Ko-fi 링크 우선 연결

### 작업 유형
- 🔗 Ko-fi 외부 링크 실제 반영
- 🧭 디스코드/후원 보드 정보 구조 단순화
- 🧪 디스코드/후원 보드 회귀 테스트 보강

### 목적 및 영향
- **목적:** 전달받은 Ko-fi 링크를 바로 노출해 커뮤니티 보드 안에서 실제 후원 동선이 작동하도록 만든다.
- **범위:** 디스코드 보드의 `board=discord` 경로는 그대로 유지하고, 후원 영역 문구와 외부 CTA만 조정한다.
- **내용:**
  - `serviceContent`에 Ko-fi 링크(`https://ko-fi.com/hth3381`)를 추가하고, `Ko-fi 링크`라는 이름으로 별도 후원 섹션에서 노출하도록 정리했다.
  - 디스코드/후원 보드 상단은 중복 배지와 CTA를 걷어내고, `디스코드`와 `후원` 두 개의 큰 카테고리 섹션으로 다시 묶었다.
  - `디스코드` 섹션에는 `디스코드 링크`와 `공지 확인`, `자랑 스냅샷`, `버그제보 / QnA`, `자유잡담` 목록만 남겨 흐름을 단순화했다.
  - `후원` 섹션에는 `Ko-fi 링크`와 `Ko-fi를 통해 후원으로 응원해 주세요.` 문구만 남겨, 지원 동선을 별도 카드로 분리했다.
  - 테스트는 두 섹션 안에서 링크와 텍스트가 각각 렌더되는지 기준으로 갱신했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/serviceContent.js`
- `digimon-tamagotchi-frontend/src/pages/Community.jsx`
- `digimon-tamagotchi-frontend/src/pages/Community.test.jsx`
- `docs/REFACTORING_LOG.md`

## [2026-04-10] `Game.jsx` 4차 분리: 페이지 액션 helper/hook 추출

### 작업 유형
- 🧩 과식 확인/취소, 환생 초기화, evo 버튼 활성화 계산을 전용 helper/hook으로 추출
- 🧪 액션 흐름과 evo availability를 고정하는 characterization test 추가

### 목적 및 영향
- **목적:** presenter 분리 뒤에도 `Game.jsx`에 남아 있던 페이지 전용 액션 로직을 안전한 경계로 옮겨, 다음 단계의 `useEvolution`/`useGameData` 정리를 준비한다.
- **범위:** `handleOverfeedConfirm`, `handleOverfeedCancel`, `resetDigimon`, `isEvoEnabled` 계산만 이동하고, 저장 계약과 lazy update 규칙은 유지한다.
- **내용:**
  - `gamePageActionHelpers`를 추가해 `resetDigimon` 초기 상태 계산과 evo 버튼 활성화 조건을 순수 함수로 분리했다.
  - `useGamePageActionFlows`를 추가해 과식 확인/취소 흐름과 `resetDigimon` 저장 순서를 `Game.jsx` 밖으로 옮겼다.
  - `useGamePageEvolutionAvailability`를 추가해 `customTime` 기준 1초 재계산과 `ignoreEvolutionTime`/개발자 모드/evolution checker 분기를 전용 훅으로 분리했다.
  - `resetDigimon`의 로그 append 경로는 promise 반환 여부와 빈 로그 배열에 방어적으로 대응하도록 정리해, 테스트 더블이나 향후 리팩터링 중에도 저장 흐름이 끊기지 않게 했다.
  - `Game.jsx`는 이제 route/context 연결, view-model 조합, modal binding 연결에 더 집중하고, 페이지 액션 구현 세부사항은 전용 훅에 위임한다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/gamePageActionHelpers.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/gamePageActionHelpers.test.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useGamePageActionFlows.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useGamePageActionFlows.test.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useGamePageEvolutionAvailability.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useGamePageEvolutionAvailability.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/game-runtime/gamePageActionHelpers.test.js src/hooks/game-runtime/useGamePageActionFlows.test.js src/hooks/game-runtime/useGamePageEvolutionAvailability.test.js src/components/layout/GameHeaderPanel.test.jsx src/components/layout/ImmersiveLandscapeStatusPanel.test.jsx src/components/layout/GameDefaultSection.test.jsx src/components/layout/ImmersiveLandscapeSection.test.jsx src/components/layout/GamePageToolbar.test.jsx src/components/layout/GamePageView.test.jsx src/components/layout/ImmersiveGameView.test.jsx src/components/layout/ImmersiveGameTopBar.test.jsx src/components/layout/ImmersiveDeviceShell.test.jsx src/components/layout/ImmersiveLandscapeControls.test.jsx src/components/layout/ImmersiveLandscapeFrameStage.test.jsx src/components/layout/ImmersiveSkinPicker.test.jsx src/components/chat/ImmersiveChatOverlay.test.jsx src/components/GameScreen.test.jsx src/hooks/game-runtime/useImmersiveGameLayout.test.js`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/pages/Game.jsx src/hooks/game-runtime/gamePageActionHelpers.js src/hooks/game-runtime/gamePageActionHelpers.test.js src/hooks/game-runtime/useGamePageActionFlows.js src/hooks/game-runtime/useGamePageActionFlows.test.js src/hooks/game-runtime/useGamePageEvolutionAvailability.js src/hooks/game-runtime/useGamePageEvolutionAvailability.test.js src/components/layout/GameHeaderPanel.jsx src/components/layout/GameHeaderPanel.test.jsx src/components/layout/ImmersiveLandscapeStatusPanel.jsx src/components/layout/ImmersiveLandscapeStatusPanel.test.jsx`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 이번 단계는 `Game.jsx`를 얇은 route container로 수렴시키는 마지막 액션 분리 단계에 가깝다. 이후 우선순위는 페이지에 남은 `resetDigimon` 연관 테스트를 유지한 채 `useEvolution`의 온라인 조그레스 흐름과 `useGameData`의 UI side effect를 경계별로 더 쪼개는 쪽이다.

## [2026-04-09] `Game.jsx` 3차 분리: 헤더/상태 presenter 추출

### 작업 유형
- 🧩 `GameHeaderPanel`, `ImmersiveLandscapeStatusPanel` 추가
- 🧪 헤더 메타/상태 요약 presenter 테스트 보강

### 목적 및 영향
- **목적:** `Game.jsx`에 남아 있던 `defaultHeaderSection`과 `landscapeStatusNode` 조립 블록을 presenter로 분리해 페이지를 더 얇은 route container에 가깝게 정리한다.
- **범위:** 헤더/상태 표시 JSX만 이동하고, 저장/진화/모달 제어 로직은 그대로 둔다.
- **내용:**
  - 기본 화면 헤더는 `GameHeaderPanel`로 이동해 슬롯 제목, 메타 정보, 하트 요약, 상태 배지를 한 곳에서 조립하도록 정리했다.
  - 가로 몰입형 상태 영역은 `ImmersiveLandscapeStatusPanel`로 이동해 슬롯 정보, 시간, 냉장고 표시, 상태 하트/배지를 별도 presenter로 분리했다.
  - `Game.jsx`는 이제 `sharedStatusHeartsProps`, `sharedStatusBadgesProps`만 만들고 각 presenter에 전달하도록 단순화했다.
  - 테스트는 두 presenter가 메타/하트/배지 props를 올바르게 연결하는지와 fallback 텍스트를 유지하는지 확인하도록 추가했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/GameHeaderPanel.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/GameHeaderPanel.test.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/ImmersiveLandscapeStatusPanel.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/ImmersiveLandscapeStatusPanel.test.jsx`
- `docs/REFACTORING_LOG.md`

### 아키텍처 메모
- `Game.jsx`에서 화면 조립을 presenter로 먼저 옮기고 액션/영속성 훅 정리는 뒤로 미루는 전략을 유지한다. 이 단계까지 끝나면 페이지 파일에는 route/context 연결과 view-model 조합 책임이 더 분명하게 남는다.

## [2026-04-09] 커뮤니티 디스코드 보드를 `디스코드/후원`으로 재정리

### 작업 유형
- 🧭 커뮤니티 보드 라벨과 안내 카피 조정
- 📝 카카오페이·Ko-fi 후원 링크가 들어올 자리 확보
- 🧪 디스코드 보드 라벨 회귀 테스트 추가

### 목적 및 영향
- **목적:** 커뮤니티 안에서 디스코드 초대와 운영 응원 링크를 같은 입구로 안내할 수 있게 보드 의미를 넓힌다.
- **범위:** `?board=discord` 쿼리와 라우트 구조는 그대로 유지하고, 사용자에게 보이는 탭명/드롭다운명/보드 설명만 `디스코드/후원` 기준으로 재정리한다.
- **내용:**
  - `communityBoards`의 `discord` 보드 제목과 설명을 `디스코드/후원` 기준으로 바꾸고, 상단 드롭다운과 커뮤니티 탭에서도 같은 이름이 보이도록 맞췄다.
  - `Community`의 hero 카피, 지원 보드에서 넘어가는 CTA, 디스코드 보드 툴바/안내 문구를 모두 같은 표현으로 통일했다.
  - 디스코드 보드 본문에는 카카오페이와 Ko-fi 링크가 들어올 예정이라는 안내 노트를 추가해, 실제 링크를 붙이기 전에도 후원 동선 자리가 어디인지 바로 보이게 했다.
  - 테스트는 `?board=discord` 진입 시 `디스코드/후원` 제목과 후원 안내 예고가 렌더되는지 고정했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/serviceContent.js`
- `digimon-tamagotchi-frontend/src/pages/Community.jsx`
- `digimon-tamagotchi-frontend/src/pages/Community.test.jsx`
- `docs/REFACTORING_LOG.md`

## [2026-04-09] `Game.jsx` 2차 분리: 기본/가로 몰입형 section presenter 연결

### 작업 유형
- 🧩 `GameDefaultSection`, `ImmersiveLandscapeSection`를 `Game.jsx`에 실제 연결
- 🧪 section presenter prop 계약과 가로 몰입형 분기 테스트 보강

### 목적 및 영향
- **목적:** `Game.jsx` 안에 남아 있던 `defaultGameSection`, `landscapeImmersiveSection` 대형 JSX 블록을 안전하게 presenter로 치환해 페이지 파일을 더 얇게 만든다.
- **범위:** 저장 순서, lazy update, 진화/환생 액션 로직은 건드리지 않고 화면 조립 경계만 이동한다.
- **내용:**
  - `Game.jsx`는 기본 화면 조립을 `GameDefaultSection`에, 가로 몰입형 shell 내부 조립을 `ImmersiveLandscapeSection`에 위임하도록 정리했다.
  - `GameDefaultSection`은 기존 `Game.jsx` 마크업과 동일하게 헤더 노드와 화면/컨트롤 컬럼을 sibling 구조로 유지하도록 맞췄다.
  - `ImmersiveLandscapeSection`은 `statusNode`와 `supportActionsNode`를 그대로 주입받으면서 frame skin / non-frame skin 분기, control strip/panel 조립만 맡도록 경계를 고정했다.
  - 테스트는 `GameDefaultSection`의 `GameScreen`/`ControlPanel` prop 전달과 모바일 클래스 분기를 직접 검증하고, `ImmersiveLandscapeSection`은 child presenter mock 기반으로 frame/panel 분기와 layout metadata 전달을 확인하도록 바꿨다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/GameDefaultSection.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/GameDefaultSection.test.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/ImmersiveLandscapeSection.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/ImmersiveLandscapeSection.test.jsx`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/components/layout/GameDefaultSection.test.jsx src/components/layout/ImmersiveLandscapeSection.test.jsx src/components/layout/GamePageToolbar.test.jsx src/components/layout/GamePageView.test.jsx src/components/layout/ImmersiveGameView.test.jsx src/hooks/game-runtime/useImmersiveGameLayout.test.js src/components/layout/ImmersiveGameTopBar.test.jsx src/components/layout/ImmersiveDeviceShell.test.jsx src/components/layout/ImmersiveLandscapeControls.test.jsx src/components/layout/ImmersiveLandscapeFrameStage.test.jsx src/components/layout/ImmersiveSkinPicker.test.jsx src/components/chat/ImmersiveChatOverlay.test.jsx src/components/GameScreen.test.jsx`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/pages/Game.jsx src/components/layout/GameDefaultSection.jsx src/components/layout/GameDefaultSection.test.jsx src/components/layout/ImmersiveLandscapeSection.jsx src/components/layout/ImmersiveLandscapeSection.test.jsx src/components/layout/GamePageToolbar.jsx src/components/layout/GamePageToolbar.test.jsx src/components/layout/GamePageView.jsx src/components/layout/GamePageView.test.jsx src/components/layout/ImmersiveGameView.jsx src/components/layout/ImmersiveGameView.test.jsx src/hooks/game-runtime/useImmersiveGameLayout.js src/hooks/game-runtime/useImmersiveGameLayout.test.js`

### 아키텍처 메모
- 이번 단계는 `Game.jsx`를 얇은 route container로 수렴시키는 중간 단계다. `statusNode` 같은 opaque node 주입은 아직 남아 있지만, 저장/도메인 로직을 건드리지 않고 화면 블록을 먼저 고립시키는 편이 회귀 리스크가 가장 낮다.

## [2026-04-09] 게임 시간 표현을 epoch ms + 서버 저장 시각 기준으로 정비

### 작업 유형
- ⏱ 공용 시간 유틸 추가 및 timestamp 정규화 로직 통합
- ☁️ Firestore 슬롯 저장에 `lastSavedAtServer` 도입 및 metadata 시간 저장 방식 정리
- 🌏 KST 기준 day-boundary로 lazy update/나이 증가 규칙 통일
- 🧪 시간 유틸/게임 저장 경로/아레나 로그 정렬 회귀 테스트와 빌드 검증

### 목적 및 영향
- **목적:** 클라이언트 `new Date()`만으로 lazy update 기준 시각을 잡던 구조를 보완해, 멀티기기 시계 차이·수동 시계 변경·비게임 metadata 수정 때문에 게임 진행 시간이 멈추거나 과가속되는 문제를 줄인다.
- **범위:** 프런트 공용 시간 유틸, `useGameData` 저장/로드 경로, `stats.js`의 나이/`lastSavedAt` 처리, 일부 Firestore metadata 쓰기 경로(`useUserSlots`, `useEvolution`, repository), 로그 표시/정렬 컴포넌트, 관련 테스트와 문서를 함께 조정한다. Supabase `timestamptz` 스키마는 변경하지 않는다.
- **내용:**
  - `src/utils/time.js`를 추가해 `toEpochMs`, `formatTimestamp`, `getStartOfKstDayMs`, `isSameKstDay`를 공용 규약으로 만들고, Firestore Timestamp / Date / ISO string / number 혼용 입력을 한 곳에서 정규화하도록 맞췄다.
  - `useGameData`는 슬롯 로드와 액션 직전 lazy update에서 `lastSavedAtServer -> lastSavedAt -> persisted stats` 순으로 저장 기준 시각을 고르도록 바꿨고, 기존 `slotData.updatedAt` fallback은 제거했다.
  - 슬롯 저장 시 게임 계산용 시간은 epoch ms 숫자로 정규화해 `digimonStats`에 저장하고, 루트 문서에는 `lastSavedAt`(number)와 `lastSavedAtServer`/`updatedAt`(`serverTimestamp`)를 함께 기록하도록 정리했다.
  - `stats.js`는 `lastSavedAt`을 더 이상 `Date`로 되돌리지 않고 epoch ms로 유지하며, age/day rollover를 KST 자정 기준으로 계산하도록 바꿨다.
  - Activity/Battle/Arena 로그 정렬과 표시도 공용 시간 유틸을 사용하도록 맞춰, Firestore Timestamp와 숫자 타임스탬프가 섞여 있어도 같은 규칙으로 보이게 했다.
  - 조그레스/슬롯 metadata 업데이트 경로는 `updatedAt: serverTimestamp()`를 사용하게 정리했고, 새 슬롯 생성 시 `createdAt` 숫자는 유지하면서 `createdAtServer`와 `lastSavedAtServer`를 추가해 additive migration 형태를 유지했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/utils/time.js`
- `digimon-tamagotchi-frontend/src/utils/time.test.js`
- `digimon-tamagotchi-frontend/src/utils/dateUtils.js`
- `digimon-tamagotchi-frontend/src/utils/fridgeTime.js`
- `digimon-tamagotchi-frontend/src/utils/slotLogUtils.js`
- `digimon-tamagotchi-frontend/src/utils/slotRecency.js`
- `digimon-tamagotchi-frontend/src/utils/sleepUtils.js`
- `digimon-tamagotchi-frontend/src/utils/callStatusUtils.js`
- `digimon-tamagotchi-frontend/src/logic/stats/careMistakeLedger.js`
- `digimon-tamagotchi-frontend/src/logic/stats/injuryHistory.js`
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `digimon-tamagotchi-frontend/src/data/stats.test.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.test.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/hooks/useFridge.js`
- `digimon-tamagotchi-frontend/src/hooks/useUserSlots.js`
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
- `digimon-tamagotchi-frontend/src/components/ActivityLogModal.jsx`
- `digimon-tamagotchi-frontend/src/components/BattleLogModal.jsx`
- `digimon-tamagotchi-frontend/src/components/ArenaScreen.jsx`
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx`
- `digimon-tamagotchi-frontend/src/components/fridgeRenderPolicy.js`
- `digimon-tamagotchi-frontend/src/components/digimonStatusMessages.js`
- `digimon-tamagotchi-frontend/src/repositories/UserSlotRepository.js`
- `digimon-tamagotchi-frontend/src/repositories/SlotRepository.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/utils/time.test.js src/hooks/useGameData.test.js src/data/stats.test.js src/components/ArenaScreen.test.jsx src/utils/slotRecency.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 게임 계산용 시간과 metadata 시간을 분리했다. 게임 계산은 epoch ms 숫자와 `lastSavedAtServer` 우선 규칙을 사용하고, 정렬/감사용 metadata는 Firestore `serverTimestamp()`로 남긴다. 덕분에 lazy update 알고리즘은 유지하면서도 기기별 시계 차이와 비게임 문서 수정이 진행 시간에 섞여드는 문제를 줄일 수 있다.

## [2026-04-09] 가로 몰입형 섹션 presenter 분리

### 작업 유형
- 🧩 `ImmersiveLandscapeSection` presenter 추가
- 🧪 frame skin / non-frame skin 분기와 status/support 노드 노출 테스트 추가

### 목적 및 영향
- **목적:** `Game.jsx`의 `landscapeImmersiveSection` JSX를 그대로 옮겨 붙을 수 있도록, 가로 몰입형 레이아웃 조립만 담당하는 전용 컴포넌트를 먼저 분리한다.
- **범위:** `Game.jsx`는 수정하지 않았고, `ImmersiveDeviceShell`, `ImmersiveLandscapeControls`, `ImmersiveLandscapeFrameStage`를 조립하는 새 presenter와 그 테스트만 추가했다.
- **내용:**
  - `ImmersiveLandscapeSection`을 추가해 `deviceShellProps`, `hasLandscapeFrameSkin`, `immersiveSkin`, `controlsProps`, `renderLandscapeGameScreen`, `slotMeta`, `statusNode`, `supportActionsNode`만으로 가로 몰입형 화면을 조립할 수 있게 했다.
  - 프레임 스킨이 있는 경우 양쪽 strip 조작 패널과 `ImmersiveLandscapeFrameStage`를, 없는 경우 LCD 화면과 일반 조작 패널을 렌더하도록 분기했다.
  - `statusNode`와 `supportActionsNode`가 화면에 그대로 노출되는지, `slotMeta`가 데이터 속성으로 전달되는지 검증하는 테스트를 추가했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/components/layout/ImmersiveLandscapeSection.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/ImmersiveLandscapeSection.test.jsx`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true npm test -- --runInBand ImmersiveLandscapeSection`

### 아키텍처 메모
- 이번 분리는 `Game.jsx`의 `landscapeImmersiveSection`을 presenter로 옮길 때 필요한 최소 경계다. 다음 라운드에서는 이 컴포넌트에 `Game.jsx`의 실제 상태/핸들러를 연결하면 된다.

## [2026-04-09] Game 기본 화면 presenter 분리 준비

### 작업 유형
- 🧩 `Game.jsx`의 기본 화면 섹션을 옮길 수 있는 presenter 컴포넌트 추가
- 🧪 `GameScreen` / `ControlPanel` / `supportActionsNode` 렌더 및 모바일 분기 테스트 추가

### 목적 및 영향
- **목적:** `Game.jsx`의 `defaultGameSection` JSX를 나중에 그대로 옮겨 붙을 수 있도록, 기본 화면 조립만 담당하는 전용 컴포넌트를 먼저 분리한다.
- **범위:** `Game.jsx`는 수정하지 않았고, 기본 헤더 노드, `GameScreen`, `ControlPanel`, 지원 액션 노드 조합만 담당하는 새 presenter와 그 테스트만 추가했다.
- **내용:**
  - `GameDefaultSection`을 추가해 `headerNode`, `gameScreenProps`, `controlPanelProps`, `activeMenu`, `onMenuClick`, `stats`, `isMobile`, `supportActionsNode`만으로 기본 화면을 조립할 수 있게 했다.
  - `GameScreen`과 `ControlPanel`은 presenter 내부에서 렌더링되도록 설계했다.
  - 기본 헤더, 화면, 컨트롤 패널, 지원 액션 노드가 렌더되는지와 모바일 클래스 분기를 검증하는 테스트를 추가했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/components/layout/GameDefaultSection.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/GameDefaultSection.test.jsx`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && npm test -- --runInBand src/components/layout/GameDefaultSection.test.jsx`

### 아키텍처 메모
- 이번 분리는 `Game.jsx`의 기본 화면을 바로 옮길 수 있게 만드는 최소 단위다. 다음 라운드에서는 `defaultGameSection`의 실제 JSX를 이 presenter로 치환하기 전에, 필요한 props만 그대로 연결하면 된다.

## [2026-04-09] 케어미스/부상 로그 eventId 도입과 StatsPopup 일관성 정리

### 작업 유형
- 🐛 로그 중복 방지 경로 정리 (`CAREMISTAKE`, 부상성 `POOP`)
- 🧭 `StatsPopup`의 케어미스 의미를 현재 시스템 기준에 맞게 명확화
- 🧪 eventId, 메모리 dedupe, Firestore 저장 멱등성, 진단 UI 회귀 테스트 추가

### 목적 및 영향
- **목적:** 케어미스와 부상 로그가 실시간 틱, lazy update 과거 재구성, 상호작용 모달을 오가며 같은 사건이 중복 기록되는 문제를 앞으로 생기는 로그부터 막는다. 동시에 `careMistakes`는 누적이 아니라 **현재 해소 가능한 값**이라는 현재 구현 의미를 화면에서 오해 없이 보여준다.
- **범위:** 저장 스키마의 기존 `careMistakes` 필드는 유지하고, 레거시 Firestore 로그 문서는 마이그레이션하지 않는다. 기존 중복 로그는 삭제하지 않고 그대로 둔다.
- **내용:**
  - `activityLogEventId` 유틸을 추가해 `CAREMISTAKE`와 부상성 `POOP` 로그에 타입·원인·발생 시각 기반의 안정적인 `eventId`를 부여했다.
  - `addActivityLog`와 `data/stats.js`의 과거 재구성 로그 생성 경로가 이제 `eventId` 기준으로 같은 사건을 다시 넣지 않도록 정리했다.
  - Firestore `logs` 서브컬렉션 저장은 `eventId`가 있는 로그에 대해 랜덤 `addDoc` 대신 고정 doc id `setDoc`을 사용하도록 바꿔, 같은 사건 재저장 시 문서가 늘어나지 않게 했다.
  - `injuryHistory`는 새 로그의 `eventId`를 우선 사용해 표시용 dedupe를 수행한다. 기존 레거시 로그는 그대로 읽되, 새 로그부터만 더 안정적으로 합쳐진다.
  - `StatsPopup`은 `Care Mistakes`를 이제 `(현재 활성 기준, 감소 가능)`으로 설명하고, 호출 진행/케어미스 반영 후 호출 종료/12시간 카운트 지속 상태를 더 분리된 문구로 보여준다.
  - `StatsPopup`에는 현재 카운터와 원본 이력이 어긋날 때 과거 중복 로그나 레거시 데이터 가능성을 알려주는 비파괴 진단 문구를 추가했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/utils/activityLogEventId.js`
- `digimon-tamagotchi-frontend/src/utils/activityLogEventId.test.js`
- `digimon-tamagotchi-frontend/src/utils/activityLogPersistence.js`
- `digimon-tamagotchi-frontend/src/utils/activityLogPersistence.test.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.test.js`
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `digimon-tamagotchi-frontend/src/data/stats.test.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/logic/stats/injuryHistory.js`
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx`
- `digimon-tamagotchi-frontend/src/components/StatsPopup.test.jsx`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true npm test -- --runInBand --watchAll=false src/utils/activityLogEventId.test.js src/utils/activityLogPersistence.test.js src/data/stats.test.js src/hooks/useGameLogic.test.js src/logic/stats/injuryHistory.test.js src/components/StatsPopup.test.jsx src/components/GameScreen.test.jsx`

### 아키텍처 메모
- 이번 변경은 `careMistakes`를 누적 진화 카운터로 바꾸지 않는다. 현재 저장/표시 모델을 유지한 채, “같은 사건이 여러 경로에서 다시 기록되는 문제”만 앞으로 생기는 로그부터 차단하는 방향으로 제한했다.

## [2026-04-09] Game.jsx 1차 분리: 몰입형 layout hook 및 페이지 presenter 연결

### 작업 유형
- 🧩 `Game.jsx`에서 몰입형 layout 상태/핸들러를 전용 Hook으로 분리
- 🪟 페이지 툴바와 몰입형 화면 조립을 presenter 계층으로 이동
- 🧪 새 Hook/presenter 테스트 추가 및 관련 UI 테스트 검증

### 목적 및 영향
- **목적:** `Game.jsx`를 한 번에 대형 리팩터링하지 않고, 가장 안전한 1차 단계인 화면 조립과 몰입형 layout 책임부터 분리해 페이지 파일을 얇게 만든다.
- **범위:** `Game.jsx`의 모바일/데스크톱 툴바 렌더, 몰입형 top bar/chat/skin picker 조립, 몰입형 orientation/fullscreen 상태 계산을 새 파일로 이동한다. `resetDigimon`, 과식 처리, 진화 가능 여부 계산, 저장 계약, lazy update, Firestore 경로는 변경하지 않는다.
- **내용:**
  - `useImmersiveGameLayout`를 추가해 immersive settings 정규화, 회전/전체화면 상태, skin picker 제어, 채팅 토글, 가로/세로 전환 핸들러를 `Game.jsx` 밖으로 옮겼다.
  - `GamePageToolbar`, `GamePageView`, `ImmersiveGameView`를 도입해 `Game.jsx`의 모바일 헤더, 데스크톱 툴바, 몰입형 top bar/chat/picker 조립을 presenter 계층으로 이동했다.
  - `Game.jsx`는 기존 게임 상태/데이터/액션 orchestration과 `defaultGameSection`, `landscapeImmersiveSection` 같은 화면 내용 조립은 유지하되, 최종 return 블록과 몰입형 UI 상태 코드를 크게 줄이는 방향으로 정리했다.
  - 새 Hook과 presenter 테스트를 추가했고, 기존 몰입형 UI/게임 화면 테스트와 함께 관련 범위를 다시 검증했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useImmersiveGameLayout.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useImmersiveGameLayout.test.js`
- `digimon-tamagotchi-frontend/src/components/layout/GamePageView.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/GamePageView.test.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/GamePageToolbar.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/GamePageToolbar.test.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/ImmersiveGameView.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/ImmersiveGameView.test.jsx`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand src/hooks/game-runtime/useImmersiveGameLayout.test.js src/components/layout/GamePageView.test.jsx src/components/layout/GamePageToolbar.test.jsx src/components/layout/ImmersiveGameView.test.jsx src/components/layout/ImmersiveGameTopBar.test.jsx src/components/layout/ImmersiveDeviceShell.test.jsx src/components/layout/ImmersiveLandscapeControls.test.jsx src/components/layout/ImmersiveSkinPicker.test.jsx src/components/chat/ImmersiveChatOverlay.test.jsx src/components/GameScreen.test.jsx src/components/ControlPanel.test.jsx`
- `cd digimon-tamagotchi-frontend && ./node_modules/.bin/eslint src/pages/Game.jsx src/components/layout/GamePageView.jsx src/components/layout/GamePageToolbar.jsx src/components/layout/ImmersiveGameView.jsx src/hooks/game-runtime/useImmersiveGameLayout.js src/components/layout/GamePageView.test.jsx src/components/layout/GamePageToolbar.test.jsx src/components/layout/ImmersiveGameView.test.jsx src/hooks/game-runtime/useImmersiveGameLayout.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build` 실행 시 기존 워킹트리의 별도 오류 `src/logic/stats/injuryHistory.js`의 `toTimestamp` 미정의로 실패

### 아키텍처 메모
- 이번 라운드는 presenter 분리와 immersive layout 분리만 먼저 진행한 안전한 1차 단계다. `Game.jsx`의 최종 조립부와 몰입형 상태는 분리했지만, 저장 순서가 민감한 페이지 잔여 액션과 `useEvolution`/`useGameData` 경계 축소는 아직 다음 라운드로 남긴다.

## [2026-04-09] Game.jsx 분리 전 리스크·가능사항 분석 메모 작성

### 작업 유형
- 🧭 `Game.jsx` 후속 분리 라운드 사전 분석
- 📋 presenter / immersive layout / 페이지 잔여 액션 / `useEvolution` / `useGameData` 위험도 분류
- 📝 실행 전 기준 문서 추가

### 목적 및 영향
- **목적:** `Game.jsx` 후속 분리 작업을 구현하기 전에, 어떤 단계부터 안전하게 착수할 수 있는지와 어떤 부분은 테스트를 먼저 확보해야 하는지를 코드 기준으로 판정한다.
- **범위:** 문서화만 수행한다. 런타임 동작, 저장 스키마, lazy update 규칙, Firestore 경로, 모달 key 이름, 테스트 동작은 변경하지 않는다.
- **내용:**
  - `Game.jsx`, `useEvolution`, `useGameData`, 관련 테스트 파일을 기준으로 현재 복잡도와 책임 분포를 다시 점검했다.
  - 후속 분리 순서를 `presenter 분리 -> immersive layout hook 분리 -> 페이지 잔여 액션 분리 -> useEvolution 온라인 조그레스 분리 -> useGameData 경계 축소`로 고정했다.
  - 각 단계마다 `분리 가능`, `선행 테스트 필요`, `지금은 보류` 중 하나로 판정하고, 선행 조건과 회귀 포인트, characterization test 후보를 정리한 메모를 추가했다.

### 영향받은 파일
- `docs/GAME_JSX_SPLIT_RISK_FEASIBILITY_ANALYSIS.md`
- `docs/REFACTORING_LOG.md`

### 검증
- 정적 코드 분석과 기존 테스트 파일/문서 확인만 수행

### 아키텍처 메모
- 현재 구조에서는 `Game.jsx`의 렌더 조립과 몰입형 layout 상태를 먼저 떼어내는 것이 가장 안전하다. 반면 `resetDigimon`, 온라인 조그레스 완료 흐름, `useGameData`의 hydration/save/UI side effect 경계는 저장 순서와 회귀 면적이 커서 선행 테스트 없이 바로 분리하면 위험하다.

## [2026-04-09] 자유게시판을 로그인 전용 작성형 게시판으로 전환

### 작업 유형
- 🧩 커뮤니티 데이터 모델을 `showcase`/`free` 공용 게시판 구조로 확장
- ✍️ 자유게시판 전용 글쓰기/상세/댓글 UI 추가
- 🔀 게시판별 API 라우트와 클라이언트 API를 board-aware 구조로 일반화
- 🧪 서버/클라이언트 회귀 테스트와 프로덕션 빌드 검증

### 목적 및 영향
- **목적:** 기존 안내형 패널에 머물던 자유게시판을 실제 글 작성이 가능한 로그인 전용 게시판으로 바꾸고, 자랑게시판은 기존 스냅샷 중심 UX를 유지한 채 두 게시판을 공용 인프라 위에서 운영할 수 있게 만든다.
- **범위:** 커뮤니티 서버 유틸, Vercel API 엔트리포인트, Supabase 마이그레이션, 프런트 커뮤니티 페이지/모달/목록 UI, 관련 테스트와 문서를 함께 조정한다. 게임 런타임, 슬롯 저장 구조, 자랑게시판의 스냅샷 생성 규칙은 유지한다.
- **내용:**
  - `community_posts`에 `category`를 추가하고 `slot_id`/`snapshot`을 nullable로 완화하는 신규 마이그레이션을 만들었다. 동시에 체크 제약으로 `showcase`는 슬롯 스냅샷 필수, `free`는 말머리 필수 + 슬롯 스냅샷 금지를 강제했다.
  - 서버 커뮤니티 유틸은 `boardId`를 받는 공용 함수로 재구성했다. 자유게시판은 `general/question/guide` 말머리 기반 검증과 필터링을 사용하고, 자랑게시판은 기존 슬롯 스냅샷 재조회 흐름을 그대로 유지한다.
  - API 라우트는 `api/community/[boardId]/...` 동적 구조로 통합했다. 댓글 수정/삭제도 부모 글의 `board_id`를 확인하도록 맞춰 다른 게시판 경로 오용을 막았다.
  - 프런트 `communityApi`를 board-aware 함수로 교체하고, `Community.jsx`는 자유게시판에 정적 공지 카드 + 압축 행 리스트 + 말머리 필터 + 텍스트 전용 작성 모달을 제공하도록 개편했다.
  - `CommunityPostDetailDialog`는 게시판 종류에 따라 렌더링을 분기해, 자유게시판에서는 스냅샷/스탯 패널 없이 제목, 본문, 댓글 중심 상세를 표시하도록 조정했다.
  - 비로그인 사용자는 자유게시판에서 실제 글 목록을 조회하지 않고 로그인 게이트와 운영 안내만 보게 하여 초기 정책을 UI와 API 흐름 모두에 반영했다.

### 영향받은 파일
- `api/_lib/community.js`
- `api/_lib/community.test.js`
- `api/community/[boardId]/posts/index.js`
- `api/community/[boardId]/posts/[postId].js`
- `api/community/[boardId]/posts/[postId]/comments/index.js`
- `api/community/[boardId]/comments/[commentId].js`
- `api/community/showcase/posts/index.js` (삭제)
- `api/community/showcase/posts/[postId].js` (삭제)
- `api/community/showcase/posts/[postId]/comments/index.js` (삭제)
- `api/community/showcase/comments/[commentId].js` (삭제)
- `supabase/migrations/20260409_community_free_board.sql`
- `digimon-tamagotchi-frontend/src/pages/Community.jsx`
- `digimon-tamagotchi-frontend/src/pages/Community.test.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunityPostDetailDialog.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunityFreePostComposer.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunityFreePostRow.jsx`
- `digimon-tamagotchi-frontend/src/utils/communityApi.js`
- `digimon-tamagotchi-frontend/src/utils/communityApi.test.js`
- `digimon-tamagotchi-frontend/src/data/serviceContent.js`
- `digimon-tamagotchi-frontend/src/index.css`
- `tests/community-lib.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `node --test api/_lib/community.test.js tests/community-lib.test.js`
- `node -e "require('./api/community/[boardId]/posts/index.js'); require('./api/community/[boardId]/posts/[postId].js'); require('./api/community/[boardId]/posts/[postId]/comments/index.js'); require('./api/community/[boardId]/comments/[commentId].js'); console.log('ok');"`
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/pages/Community.test.jsx src/utils/communityApi.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 게시판 종류별 차이는 DB 제약과 공용 service 레이어에서 먼저 제한하고, 프런트는 그 계약을 소비하는 형태로 두었다. 덕분에 이후 공략/질문 전용 보드나 관리자 공지 보드를 추가해도 라우트 구조를 다시 복제하지 않고 `boardId`와 입력 규칙만 확장하면 된다.

## [2026-04-08] Vercel Hobby 함수 제한 대응으로 아레나 관리자 라우트 1개를 기존 엔드포인트에 병합

### 작업 유형
- 🧩 서버리스 함수 수 절감을 위한 관리자 API 통합
- 🔁 관리자 모니터링 호출 경로 재배선
- 🧪 `arenaHandlers` 관리자 GET 분기 테스트 추가

### 목적 및 영향
- **목적:** `api/notifications/daily-digimon-report`를 추가한 뒤 Vercel Hobby의 "Serverless Functions 최대 12개" 제한에 걸리던 배포 실패를 해소한다.
- **범위:** 아레나 관리자용 `archive-monitoring` 전용 라우트를 제거하고, 같은 관리자 경계의 기존 `config` 엔드포인트가 `GET` 요청에서 모니터링 스냅샷을 반환하도록 합친다. 알림 API와 일반 사용자 기능 경로는 유지한다.
- **내용:**
  - `createArenaAdminConfigHandler()`가 이제 `PUT`뿐 아니라 `GET`도 받아, 관리자 인증 후 archive monitoring 스냅샷을 반환할 수 있게 확장했다.
  - 프런트 `fetchArenaArchiveMonitoring()`은 `/api/arena/admin/archive-monitoring` 대신 `/api/arena/admin/config?view=archive-monitoring...` 경로를 사용하도록 바꿨다.
  - 별도 함수 파일 `digimon-tamagotchi-frontend/api/arena/admin/archive-monitoring.js`를 삭제해 배포 함수 수를 1개 줄였다.
  - 서버 테스트에 관리자 `GET` 분기를 추가해 모니터링 응답이 같은 handler에서 계속 유지되는지 고정했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/api/_lib/arenaHandlers.js`
- `digimon-tamagotchi-frontend/src/utils/arenaApi.js`
- `digimon-tamagotchi-frontend/api/arena/admin/archive-monitoring.js` (삭제)
- `api/_lib/arenaHandlers.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `node --test api/_lib/arenaHandlers.test.js`

### 아키텍처 메모
- Hobby 플랜에서는 함수 수가 하드 제한이므로, 관리자 전용 보조 읽기 엔드포인트는 같은 권한 경계의 기존 함수에 메서드 분기로 합치는 편이 운영 비용 대비 효율적이다.

## [2026-04-08] Discord 상태 알림을 Firestore 직접 조회에서 서버 API 경유 구조로 전환

### 작업 유형
- 🔐 Firestore Admin 기반 서버 알림 API 추가
- 🤖 Apps Script 연동용 비밀키 인증 계약 정의
- 🧪 `node --test` 서버 API 회귀 테스트 및 엔트리포인트 확인 추가
- 📝 운영 가이드와 스크립트 문서 갱신

### 목적 및 영향
- **목적:** Google Apps Script가 Firestore REST API를 인증 없이 직접 조회하면서 `PERMISSION_DENIED`가 발생하던 경로를 제거하고, Firestore Rules를 완화하지 않은 채 Discord 상태 리포트를 계속 보낼 수 있게 한다.
- **범위:** 새 알림 API 헬퍼/엔드포인트, 루트 배포 래퍼, 서버 테스트, 운영 문서와 Apps Script 가이드를 추가한다. 게임 런타임, Firestore Rules, Discord 설정 UI는 변경하지 않는다.
- **내용:**
  - `api/notifications/daily-digimon-report`를 추가해 `x-d2-scheduler-secret` 헤더와 `NOTIFICATION_API_SECRET` 환경변수로만 호출 가능한 서버 간 엔드포인트를 만들었다.
  - 서버는 Firestore Admin 헬퍼로 `users`, `users/{uid}/settings/main`, `users/{uid}/profile/main`, `users/{uid}/slots`를 읽어 사용자별 Discord 전송용 `messageContent`를 조합한다.
  - 알림 설정은 `settings/main` 우선 + 루트 fallback, 테이머명은 `profile/main.tamerName` 우선 + 루트 `tamerName/displayName` fallback으로 읽어 최신 사용자 구조를 놓치지 않도록 맞췄다.
  - 슬롯 판정은 기존 Apps Script 규칙을 유지하면서 냉장/냉동 슬롯을 제외하고, `fullness/strength/callStatus/isJogressReady` 기준으로 이상 상태 문구를 생성하도록 옮겼다.
  - 루트 래퍼와 `node --test` 파일을 추가해 헬퍼 로직과 엔드포인트 로딩을 독립적으로 검증할 수 있게 했고, 운영 문서에는 Vercel 환경변수, Script Properties, Apps Script 예시를 함께 정리했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/api/_lib/notificationReports.js`
- `digimon-tamagotchi-frontend/api/notifications/daily-digimon-report.js`
- `api/_lib/notificationReports.js`
- `api/_lib/notificationReports.test.js`
- `api/notifications/daily-digimon-report.js`
- `tests/notification-entrypoints.test.js`
- `package.json`
- `docs/DISCORD_NOTIFICATION_API_GUIDE.md`
- `docs/FIRESTORE_DIGIMON_NAME_FOR_SCRIPT.md`
- `docs/REFACTORING_LOG.md`

### 검증
- `npm run test:notification-api`

### 아키텍처 메모
- Firestore Rules는 계속 사용자 본인 읽기 기준을 유지하고, 운영용 일괄 조회는 서버 API + 서비스 계정으로만 처리한다. 덕분에 Apps Script는 스케줄러와 Discord 전송만 맡고, 데이터 구조 변경은 서버 한 곳에서만 따라가면 된다.

## [2026-04-08] 낮잠 reload 경로에도 루트 조명 상태를 합쳐 poop timer 정합성 복구

### 작업 유형
- 💤 낮잠 lazy update 입력 스탯 정합성 수정
- 🔁 슬롯 로드 경로와 액션 경로의 루트 상태 병합 규칙 통일
- 🧪 `useGameData` 회귀 테스트 추가

### 목적 및 영향
- **목적:** 낮잠 중에는 세션 내 실시간 루프와 새로고침 후 lazy update가 모두 같은 수면 판정을 사용하도록 맞춰, `poopCountdown`이 reload 전후로 다르게 흐르지 않게 한다.
- **범위:** `useGameData`의 슬롯 로드 경로와 관련 helper/test만 조정한다. 저장 스키마, 실시간 poop 감소 로직, `data/stats`의 낮잠 제외 규칙은 유지한다.
- **내용:**
  - 슬롯 로드 시 `digimonStats`만 바로 `applyLazyUpdate()`에 넘기던 흐름을 정리하고, 액션 전 경로와 같은 `resolveLazyUpdateBaseStats()`를 거쳐 루트 `isLightsOn`/`wakeUntil`을 합친 뒤 lazy update를 적용하도록 변경했다.
  - 로드 직후 메모리에 올리는 `digimonStats`도 같은 병합 결과를 기준으로 사용해, 첫 렌더 상태 판정과 다음 액션 직전 판정이 어긋나지 않도록 맞췄다.
  - helper 테스트를 보강해 persisted stats에 조명 필드가 없어도 로드용 lazy update 입력에는 루트 조명/기상 상태가 반드시 합쳐지는 계약을 고정했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameData.test.js src/data/stats.test.js`

### 아키텍처 메모
- 슬롯 문서 스키마는 그대로 유지하고, 루트에 저장된 조명/기상 상태를 lazy update 입력 단계에서만 재조합한다. 덕분에 Firebase 문서 구조를 바꾸지 않고도 실시간 루프와 reload 복원 로직의 수면 판정을 같은 기준으로 유지할 수 있다.

## [2026-04-08] 디지타마 부화 중 `135` 스프라이트를 전용 모션으로 적용

### 작업 유형
- 🥚 디지타마 부화 모션 정의 활성화
- 🎞 진화 상태 기반 렌더 프레임 분기 추가
- 🧪 부화 프레임 회귀 테스트 보강

### 목적 및 영향
- **목적:** 디지타마 부화 연출을 `알 흔들림 -> 깨진 알 정지 컷 -> 실제 진화` 순서로 보이게 만들어, 깨진 알이 흔들리거나 반전되어 보이는 어색함을 없앤다.
- **범위:** `digimonAnimations`, `gameAnimationViewModel`, `Game.jsx` 전달부, 관련 테스트와 문서만 조정한다. 저장 스키마, lazy update, 진화 타이밍은 변경하지 않는다.
- **내용:**
  - `digimonAnimations`에 주석으로만 남아 있던 `digitamaEvolve(91)`를 실제 정의로 추가해 base sprite `133` 기준 `135`를 공식적으로 참조하도록 정리했다.
  - `buildGameAnimationViewModel()`은 `evolutionStage`를 입력받아 `Digitama`와 `DigitamaV2`가 `shaking`일 때는 기존 알 프레임(`133`, `134`)을 유지하고, `flashing`일 때만 idle/eat/reject 프레임을 모두 `135` 단일 프레임으로 고정하도록 조정했다.
  - `GameScreen`은 디지타마의 `flashing` 단계에서만 기존 `invert`/`.evolution-flashing` 효과를 끄고, 깨진 알을 정지 컷으로 보여주도록 분기했다. 일반 디지몬의 진화 플래시는 그대로 유지한다.
  - 테스트는 디지타마 `shaking`과 `flashing`의 프레임 차이, 디지타마/일반 디지몬의 플래시 스타일 차이를 확인하도록 확장했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/digimonAnimations.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/gameAnimationViewModel.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/gameAnimationViewModel.test.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/game-runtime/gameAnimationViewModel.test.js src/components/Canvas.test.jsx`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 부화 연출은 별도 저장 상태를 추가하지 않고 기존 `evolutionStage`만 재사용해 렌더 단계에서만 분기한다. 덕분에 Firebase/localStorage 저장 계약과 lazy update 규칙은 그대로 유지되고, 디지타마 전용 시각 효과만 독립적으로 다룰 수 있다.

## [2026-04-08] `dailySleepMistake` 잔재 상태를 저장/전달 경로에서 제거

### 작업 유형
- 🧹 사용되지 않는 수면 케어미스 필드 정리
- 🔌 상태/훅 시그니처 단순화
- 🧪 저장 helper 및 런타임 전달 테스트 갱신

### 목적 및 영향
- **목적:** 실제 수면 조명 케어미스 판정에 더 이상 쓰이지 않는 `dailySleepMistake`를 상태, 저장, 전달 경로에서 제거해 케어미스 로직 이해를 단순화하고 불필요한 루트 필드 동기화를 없앤다.
- **범위:** `useGameState`, `Game.jsx`, `useGameData`, `useGameRuntimeEffects`, `useGameRealtimeLoop`, `useGameActions`의 시그니처와 저장 payload, 관련 테스트와 문서만 정리한다.
- **내용:**
  - `useGameState` flags에서 `dailySleepMistake/setDailySleepMistake`를 제거하고, `Game.jsx` 및 런타임 훅 전달층도 해당 prop 없이 동작하도록 정리했다.
  - `useGameData`의 루트 필드 해석과 lazy update 기준 스탯 조합에서 `dailySleepMistake`를 제거하고, 저장 시에는 `deleteField()`를 함께 보내 예전 루트 슬롯 문서에 남아 있던 필드가 다음 저장 때 정리되도록 맞췄다.
  - `sanitizeDigimonStatsForSlotDocument()`도 stale `dailySleepMistake`를 제거하도록 보강해, 과거 세션에서 메모리에 남아 있던 값이 다시 `digimonStats` 안으로 저장되지 않게 했다.
  - `useGameRuntimeEffects.test.js`, `useGameData.test.js`는 새 계약에 맞게 갱신했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameState.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.test.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useGameRuntimeEffects.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useGameRuntimeEffects.test.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useGameRealtimeLoop.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameData.test.js src/hooks/game-runtime/useGameRuntimeEffects.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- `dailySleepMistake`는 이제 런타임 계약에서 사라지고, 수면 조명 케어미스 잠금은 `callStatus.sleep.isLogged`와 사건 경계만으로 설명된다.

## [2026-04-08] 오프라인 복귀 시 수면 조명 케어미스와 낮잠 제외 시간을 lazy update로 복원

### 작업 유형
- 🛌 lazy update 수면 상태 재구성 보강
- 💡 수면 조명 경고 케어미스 백필 보정
- 🧪 오프라인 복귀/낮잠/강제 기상 회귀 테스트 추가

### 목적 및 영향
- **목적:** 앱이 꺼져 있거나 저장 경계를 넘는 동안 발생한 `SLEEPING_LIGHT_ON` 30분 경고와 `NAPPING` 제외 시간을 `applyLazyUpdate()`에서도 실시간 로직과 같은 기준으로 복원해, 케어미스와 호출 데드라인이 재접속 후 어긋나지 않게 한다.
- **범위:** `src/data/stats.js`의 lazy update 경로, 해당 회귀 테스트, 문서만 조정한다. 저장 스키마는 유지하고 `dailySleepMistake` 정리 작업은 별도 후속으로 남긴다.
- **내용:**
  - lazy update에 `FALLING_ASLEEP`, `NAPPING`, `SLEEPING`, `SLEEPING_LIGHT_ON`, `AWAKE_INTERRUPTED`를 계산하는 수면 상태 분석 함수를 추가해 배고픔/힘/똥 countdown과 10분 호출 타이머가 실제 수면 구간만 멈추도록 맞췄다.
  - `sleepLightOnStart`와 `callStatus.sleep.isLogged`를 이용해 수면 조명 경고를 사건 단위로 이어 붙이도록 보정해, 저장 경계를 넘어도 같은 사건을 중복 집계하지 않고 끝난 사건의 30분 케어미스는 정확히 복원되게 했다.
  - `wakeUntil`이 남아 있던 강제 기상 시간은 수면 제외 시간으로 잘못 빼지 않도록 정리했고, 이미 끝난 낮잠의 `fastSleepStart`/`napUntil`은 lazy update 시점에 함께 청소되도록 맞췄다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `digimon-tamagotchi-frontend/src/data/stats.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/data/stats.test.js`
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameLogic.test.js`
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/utils/callStatusUtils.test.js`

### 아키텍처 메모
- 이번 보정으로 케어미스 복원 책임은 실시간 루프와 lazy update가 같은 수면 상태 정의를 공유하게 됐고, 탭 종료나 재접속 여부와 무관하게 동일한 결과를 기대할 수 있게 됐다.

## [2026-04-08] 수면 조명 경고 케어미스를 하루 1회에서 사건별 1회로 전환

### 작업 유형
- 💡 수면 조명 경고 케어미스 집계 규칙 수정
- 🔁 조명 경고 사건 시작/종료 시 상태 초기화 정리
- 🧪 같은 사건 1회 / 새 사건 재집계 테스트 추가

### 목적 및 영향
- **목적:** `SLEEPING_LIGHT_ON`이 30분을 넘겼을 때 케어미스가 자정 기준으로만 다시 열리는 구조를 없애고, 불을 껐다가 다시 켜 새 경고 사건이 시작되면 다시 집계되는 방식으로 더 자연스럽게 만든다.
- **범위:** 수면 조명 경고 timeout 판정, 실시간 루프의 일일 잠금 처리, 냉장고/리셋 경로의 sleep call state, 관련 테스트와 문서만 조정한다.
- **내용:**
  - `checkCallTimeouts()`는 더 이상 `dailySleepMistake`로 수면 조명 경고를 잠그지 않고, 같은 `callStatus.sleep` 사건에서 `isLogged`가 `false`일 때만 30분 timeout 케어미스를 1회 추가하도록 바꿨다.
  - `checkCalls()`는 `SLEEPING_LIGHT_ON`에서만 sleep call 사건을 유지하고, 사건이 끝나면 `startedAt/isLogged`를 함께 초기화해 다음 조명 경고를 새 사건으로 시작하도록 정리했다.
  - `useGameRealtimeLoop()`에서 자정 기준 `sleepMistakeDate/dailySleepMistake` 리셋 로직을 제거해, 수면 조명 경고는 날짜가 아니라 사건 종료 여부로만 다시 열리게 했다.
  - 냉장고 입출고처럼 수면 조명 경고 사건이 강제로 끝나는 경로도 `sleep.isLogged = false`로 정리해, 이후 새 사건이 정상 집계되도록 맞췄다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useGameRealtimeLoop.js`
- `digimon-tamagotchi-frontend/src/hooks/useFridge.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameLogic.test.js`

### 아키텍처 메모
- 수면 조명 경고는 이제 `일자`가 아니라 `경고 사건 인스턴스` 단위로 잠기므로, 배고픔/힘 호출과 같은 “사건별 1회” 규칙과 더 일관된 모델이 됐다.

## [2026-04-07] 수면 상태 기계를 6단계로 재정의하고 조명 경고 규칙을 수면 축으로 정렬

### 작업 유형
- 😴 수면 상태 enum 재정의
- ⏱ 배고픔/힘 호출 일시정지 기준 재정렬
- 💡 수면 호출을 `수면 조명 경고` 30분 규칙으로 전환
- 🧪 상태 전이/UI/호출 테스트 갱신

### 목적 및 영향
- **목적:** `TIRED`와 `sleepy` 표현을 제거하고, 실제 수면 여부와 조명 경고 여부를 분리한 상태 기계로 정리해 수면 중 호출/케어미스 표기와 실제 규칙이 어긋나지 않게 한다.
- **범위:** `getSleepStatus`, 실시간 루프, 호출 view-model, 상태 메시지/배지/커뮤니티 스냅샷, 관련 테스트와 문서만 조정하고 저장 스키마는 유지한다.
- **내용:**
  - 수면 상태를 `AWAKE`, `FALLING_ASLEEP`, `NAPPING`, `SLEEPING`, `SLEEPING_LIGHT_ON`, `AWAKE_INTERRUPTED`로 재정의하고, `FROZEN`은 기존 `isFrozen` 축으로 유지했다.
  - `NAPPING`, `SLEEPING`, `SLEEPING_LIGHT_ON`은 실제 수면으로 취급해 배고픔/힘 감소와 10분 호출을 멈추고, `FALLING_ASLEEP`, `AWAKE`, `AWAKE_INTERRUPTED`는 깨어 있는 상태로 처리하도록 런타임과 액션 로직을 맞췄다.
  - 배고픔/힘 호출은 `sleepStartAt` 기준으로 일시정지 시점의 남은 시간을 고정해서 보여주고, 깨어날 때만 `startedAt/deadline`을 한 번 밀도록 정리했다.
  - 기존 `Sleep Call 60분 경고`는 제거하고, `SLEEPING_LIGHT_ON`일 때만 `수면 조명 경고` 30분 타이머가 돌며 케어미스를 1회 올리도록 변경했다.
  - `TIRED`/`SLEEPY` 레거시 입력은 화면 레이어에서 `SLEEPING_LIGHT_ON`으로 정규화해 저장 호환성을 유지했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useGameRealtimeLoop.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameAnimations.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/gameAnimationViewModel.js`
- `digimon-tamagotchi-frontend/src/utils/callStatusUtils.js`
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx`
- `digimon-tamagotchi-frontend/src/components/GameScreen.jsx`
- `digimon-tamagotchi-frontend/src/components/digimonStatusMessages.js`
- `digimon-tamagotchi-frontend/src/components/DigimonStatusText.jsx`
- `digimon-tamagotchi-frontend/src/components/Canvas.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunitySnapshotScene.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunitySnapshotSummary.jsx`
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.test.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.test.js`
- `digimon-tamagotchi-frontend/src/utils/callStatusUtils.test.js`
- `digimon-tamagotchi-frontend/src/components/GameScreen.test.jsx`
- `digimon-tamagotchi-frontend/src/components/digimonStatusMessages.test.js`
- `digimon-tamagotchi-frontend/src/utils/communitySnapshotUtils.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameLogic.test.js src/hooks/useGameActions.test.js src/utils/callStatusUtils.test.js src/components/GameScreen.test.jsx src/components/digimonStatusMessages.test.js src/utils/communitySnapshotUtils.test.js src/components/community/CommunitySnapshotScene.test.jsx src/hooks/game-runtime/buildGameModalBindings.test.js src/hooks/game-runtime/gameAnimationViewModel.test.js`

### 아키텍처 메모
- 이번 라운드는 저장 스키마를 늘리지 않고 `fastSleepStart`, `napUntil`, `wakeUntil`, `sleepLightOnStart`, `sleepStartAt` 조합만으로 상태 전이와 호출 일시정지를 표현했다.
- 수면 관련 UI는 이제 `현재 상태`와 `페널티 타이머`를 분리해 보여 주므로, 앞으로 커뮤니티 카드/상단 배지/호출 모달이 같은 상태명을 공유할 수 있다.

## [2026-04-07] 사용자 프로필을 `profile/main`으로 분리하는 호환 단계 도입

### 작업 유형
- 👤 사용자 프로필 저장 경로 분리
- 🔁 루트 + `profile/main` dual-write 호환 단계 도입
- 🧾 닉네임 인덱스 운영 스크립트 경로 정합성 갱신
- 🧪 프로필/닉네임 유틸 테스트 보강

### 목적 및 영향
- **목적:** `users/{uid}` 루트 문서에 몰려 있던 `tamerName`, `achievements`, `maxSlots`를 `users/{uid}/profile/main`으로 분리해 문서 결합도를 낮추고, 이후 루트 사용자 문서를 인증 메타 중심으로 정리할 준비를 한다.
- **범위:** 런타임 프로필/닉네임 유틸, 닉네임 백필·verify 스크립트, Firestore rules, 프로필 백필 스크립트와 문서만 조정하며, 기존 화면 계약과 로그인 bootstrap 로직은 유지한다.
- **내용:**
  - `userProfileUtils`는 `profile/main`을 우선 읽고 루트 `users/{uid}`를 fallback으로 읽도록 바꿨으며, 칭호 저장 시 루트와 `profile/main`을 함께 갱신한다.
  - `tamerNameUtils`는 테이머명을 `profile/main` 우선으로 읽고, 닉네임 저장/기본값 복구 transaction에서 루트와 `profile/main`을 함께 갱신하도록 정리했다.
  - `scripts/nicknameIndexShared.js`, `backfillNicknameIndex.js`, `verifyNicknameIndex.js`는 `profile/main` 우선 기준으로 닉네임 상태를 수집·정규화하도록 갱신했다.
  - `scripts/backfillUserProfile.js`와 `npm run profile:backfill`를 추가해 루트 프로필 필드를 `profile/main`으로 안전하게 복사할 수 있도록 했다.
  - `firestore.rules`에 `users/{uid}/profile/{profileId}` owner 규칙을 추가했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/utils/userProfileUtils.js`
- `digimon-tamagotchi-frontend/src/utils/userProfileUtils.test.js`
- `digimon-tamagotchi-frontend/src/utils/tamerNameUtils.js`
- `digimon-tamagotchi-frontend/src/utils/tamerNameUtils.test.js`
- `scripts/nicknameIndexShared.js`
- `scripts/backfillNicknameIndex.js`
- `scripts/verifyNicknameIndex.js`
- `scripts/backfillUserProfile.js`
- `package.json`
- `firestore.rules`
- `docs/ACCOUNT_SETTINGS_AND_MASTER_TITLES_DESIGN.md`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true npm test -- --watchAll=false --runInBand src/utils/userProfileUtils.test.js src/utils/tamerNameUtils.test.js src/components/panels/AccountSettingsPanel.test.jsx src/pages/Home.test.jsx src/pages/Me.test.jsx`
- `node --check scripts/backfillUserProfile.js`
- `node --test tests/nickname-index-migration.test.js`

### 아키텍처 메모
- 이번 라운드는 루트 필드를 삭제하지 않는 호환 단계라서, 구버전 탭/캐시와의 충돌을 줄이기 위해 루트와 `profile/main`을 함께 갱신한다.
- 다음 단계는 `profile:backfill` 운영 반영 후, 루트 프로필 필드의 읽기/쓰기 제거 여부를 결정하는 것이다.

## [2026-04-07] 호출 상태 UI를 공통 view-model 기반으로 통합

### 작업 유형
- 📣 호출 상태 공통 helper 도입
- 🧭 호출 모달/아이콘 진입 동선 단순화
- 🌐 호출 로그/문구 한국어 정리
- 🧪 호출 helper 및 화면 회귀 테스트 추가

### 목적 및 영향
- **목적:** 배고픔/힘/수면 호출의 실제 게임 규칙은 유지하면서, `GameScreen` 호출 모달과 `StatsPopup` 호출 섹션이 같은 계산과 같은 문구를 쓰도록 정리해 오해를 줄인다.
- **범위:** 호출 상태 표시 UI, 호출 관련 최근 로그 표현, 호출 진입 동선, 관련 테스트와 문서만 조정하고 Firestore/localStorage 저장 스키마는 바꾸지 않는다.
- **내용:**
  - `src/utils/callStatusUtils.js`를 추가해 호출 카드 view-model, 최근 호출 이력, 영문 레거시 호출 로그 한국어 보정 로직을 한 곳으로 모았다.
  - `GameScreen`은 기존 영어 `Call Status Log`/토스트 흐름을 제거하고, 공통 helper 기반 한국어 호출 모달과 해결 버튼(`먹이 메뉴 열기`, `조명 설정 열기`)을 사용하도록 바꿨다.
  - 화면 안 `📣` 호출 아이콘 클릭과 하단 `호출` 버튼이 모두 같은 `call` 모달을 열도록 정리하고, 호출 토스트 상태는 제거했다.
  - `StatsPopup`의 호출 안내는 더 이상 별도 인라인 계산을 하지 않고, 공통 helper 결과를 사용해 수면 경고 전용 규칙과 수면/냉장고 일시정지 문구를 `GameScreen`과 맞췄다.
  - 실시간 호출 시작 로그는 `배고픔 호출이 시작되었습니다.`, `힘 호출이 시작되었습니다.`, `수면 호출이 시작되었습니다.`로 통일했고, `ActivityLogModal`에서도 예전 영어 호출 로그를 한국어로 보정해 보여준다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/utils/callStatusUtils.js`
- `digimon-tamagotchi-frontend/src/utils/callStatusUtils.test.js`
- `digimon-tamagotchi-frontend/src/components/GameScreen.jsx`
- `digimon-tamagotchi-frontend/src/components/GameScreen.test.jsx`
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx`
- `digimon-tamagotchi-frontend/src/components/GameModals.jsx`
- `digimon-tamagotchi-frontend/src/components/ActivityLogModal.jsx`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/hooks/useGameState.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameHandlers.test.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useGameRealtimeLoop.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/buildGamePageViewModel.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/buildGamePageViewModel.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/utils/callStatusUtils.test.js src/components/GameScreen.test.jsx src/hooks/useGameHandlers.test.js src/hooks/game-runtime/buildGamePageViewModel.test.js`

### 아키텍처 메모
- 호출 표시를 view-model helper로 분리해 두면, 이후 Discord 알림, 상단 상태 요약, 활동 로그 탭도 같은 호출 라벨/문구 규칙을 재사용할 수 있다.
- 이번 라운드는 저장 구조나 lazy update 규칙을 건드리지 않고, UI 표현과 진입 동선만 로직에 맞춰 재정렬해 리스크를 화면 범위로 제한했다.

## [2026-04-07] `Game.jsx` 2차 축소: runtime/persistence composite hook 도입

### 작업 유형
- 🧭 `Game.jsx` orchestration 축소
- ⏱ runtime effect composite hook 도입
- 💾 page persistence effect composite hook 도입
- 🧪 composite hook characterization 테스트 추가

### 목적 및 영향
- **목적:** `Game.jsx`에 남아 있던 runtime effect 묶음과 master-data/background/localStorage persistence effect 묶음을 한 단계 더 바깥으로 옮겨, 페이지를 조합 중심 컨테이너에 가깝게 줄인다.
- **범위:** `Game.jsx`, `src/hooks/game-runtime/*`, 관련 테스트와 로그 문서만 조정하고, Firestore 경로, localStorage key, `GameModals`/`GameScreen`/`ControlPanel`/`DigimonStatusBadges`의 공개 prop shape는 유지한다.
- **내용:**
  - `src/hooks/game-runtime/useGameRuntimeEffects.js`를 추가해 `useGameClock`, `useGameSaveOnLeave`, `useGameRealtimeLoop`, `useGameSleepStatusLoop`, `useTakeOutCleanup` 호출을 한 곳으로 모았다.
  - `src/hooks/game-runtime/useGamePagePersistenceEffects.js`를 추가해 master data sync, background save gate, sprite 크기 localStorage 저장, `clearedQuestIndex` load/save를 한 곳으로 모았다.
  - `Game.jsx`에서는 위 두 composite hook과 기존 `useJogressSubscriptions`만 호출하고, animation view-model / page view-model / modal bindings / render 조합에 집중하도록 줄였다.
  - `syncRemainingByElapsed`는 page persistence hook 내부 private helper로 이동했고, `digimon_view_settings`, `slot${slotId}_clearedQuestIndex` key는 그대로 유지했다.
  - `useGameRuntimeEffects.test.js`, `useGamePagePersistenceEffects.test.js`를 추가해 기존 입력 매핑, background gate, master-data sync countdown 보정, 기존 localStorage key 유지 여부를 고정했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useGameRuntimeEffects.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useGamePagePersistenceEffects.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useGameRuntimeEffects.test.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useGamePagePersistenceEffects.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/game-runtime/useGameRuntimeEffects.test.js src/hooks/game-runtime/useGamePagePersistenceEffects.test.js src/hooks/game-runtime/useJogressSubscriptions.test.js src/hooks/game-runtime/useTakeOutCleanup.test.js src/hooks/game-runtime/buildGamePageViewModel.test.js src/hooks/game-runtime/buildGameModalBindings.test.js`
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`
- `node --test tests/*.test.js api/_lib/*.test.js`

### 아키텍처 메모
- 이번 라운드는 `좋은 수준의 추가 축소`까지만 목표로 하므로, `useJogressSubscriptions`는 별도 hook으로 유지하고 animation/evolution gating effect도 `Game.jsx`에 남겼다.
- 다음 단계는 이 구조를 바탕으로 persistence 세부 경계나 `Game.jsx` 내 남은 page-specific effect를 더 다루되, 이번처럼 composite 수준 이상으로 뭉치지 않는 방향이 안전하다.

## [2026-04-07] `Game.jsx` 구독/effect/view-model 안전 분리 1차

### 작업 유형
- 🧭 `Game.jsx` 오케스트레이션 책임 축소
- 🔔 조그레스 구독/냉장고 take-out 정리 훅 분리
- 🧱 화면 파생 props / 모달 바인딩 helper 분리
- 🧪 새 runtime helper 기준 characterization 테스트 추가

### 목적 및 영향
- **목적:** `Game.jsx` 내부에 남아 있던 조그레스 구독, `takeOutAt` 정리 타이머, 렌더용 파생 props 조립, `GameModals`용 큰 객체 조립을 바깥으로 옮겨 페이지를 오케스트레이션 허브에 가깝게 줄인다.
- **범위:** `Game.jsx`, `src/hooks/game-runtime/*`, 관련 테스트와 로그 문서만 조정하고, `GameScreen` / `ControlPanel` / `GameModals`의 공개 prop 계약과 Firestore 경로는 유지한다.
- **내용:**
  - `src/hooks/game-runtime/useJogressSubscriptions.js`를 추가해 현재 슬롯 `jogressStatus`, 내가 만든 room, waiting room의 Firestore 구독을 한 곳으로 모았다.
  - `src/hooks/game-runtime/useTakeOutCleanup.js`를 추가해 냉장고에서 꺼낸 뒤 `takeOutAt`을 3.5초 후 정리하는 타이머를 분리했다.
  - `src/hooks/game-runtime/buildGamePageViewModel.js`를 추가해 헤더 표시명, 현재 시간 문자열, 수면 스케줄, `DigimonStatusBadges` / `ControlPanel` / `GameScreen`용 파생 display props, 조그레스 CTA 상태를 계산하도록 분리했다.
  - `src/hooks/game-runtime/buildGameModalBindings.js`를 추가해 `GameModals`에 전달하는 `handlers`, `data`, `ui` payload 조립을 한 곳으로 모으고, 기존 nested key shape는 그대로 유지했다.
  - `Game.jsx`는 이제 새 helper/hook을 호출하고 최종 렌더를 조합하는 쪽으로 축소했으며, 조그레스 구독 hook에는 `currentUser?.uid`만 넘기도록 경계를 더 명확히 했다.
  - 이전 실험 파일이던 `gamePageViewModel.js`, `gameModalBindings.js`와 대응 테스트는 더 이상 참조되지 않아 제거하고 새 `build*` 파일 기준으로 정리했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useJogressSubscriptions.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useTakeOutCleanup.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/buildGamePageViewModel.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/buildGameModalBindings.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useJogressSubscriptions.test.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useTakeOutCleanup.test.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/buildGamePageViewModel.test.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/buildGameModalBindings.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/game-runtime/buildGamePageViewModel.test.js src/hooks/game-runtime/buildGameModalBindings.test.js src/hooks/game-runtime/useTakeOutCleanup.test.js src/hooks/game-runtime/useJogressSubscriptions.test.js`
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand`
  - `src/logic/stats/injuryHistory.test.js` 3건은 이번 변경과 무관하게 계속 실패했고, 새 runtime helper 관련 테스트는 모두 통과했다.
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 이번 라운드는 container/presenter 분리나 조그레스 persistence adapter 도입 전 단계로, 외부 컴포넌트 prop 이름을 바꾸지 않고 `계산/조립만 외부화`하는 방식으로 리스크를 제한했다.
- `GameModals`는 가장 민감한 계약이므로 top-level 7개 prop과 내부 `handlers/data/ui` key shape를 유지한 채 조립 위치만 옮겼다.
- 다음 단계에서는 이 구조를 바탕으로 `Game.jsx` 내 나머지 persistence/effect 덩어리와 조그레스 read 최적화를 더 안전하게 다룰 수 있다.

---

## [2026-04-07] 상단 상태 요약을 핵심 3개 중심으로 재구성하고 수면 정보 우선순위를 하향

### 작업 유형
- 🏷 상단 상태 배지 우선순위 재정의
- 🧩 상태 메시지 공용 helper 도입
- 🪟 상태 상세 모달 severity 구조 정리
- 🧪 상태 요약/상세 회귀 테스트 추가

### 목적 및 영향
- **목적:** 게임 화면 상단 상태 요약을 플레이어 친화적으로 정리하고, 수면 관련 생활 정보가 긴급 경고보다 앞에 나오지 않도록 순서를 바로잡는다.
- **범위:** `DigimonStatusBadges`, `DigimonStatusDetailModal`, 공용 상태 메시지 helper와 관련 테스트, 로그 문서만 조정하고 저장 구조와 수면 판정 로직은 유지한다.
- **내용:**
  - `src/components/digimonStatusMessages.js`를 추가해 상태 텍스트, 우선순위, 카테고리, 상세 힌트를 한 곳에서 생성하도록 분리했다.
  - 상단 요약은 이제 우선순위 높은 상태 최대 3개만 보여주고, 나머지는 `+N개 더`로 접는다.
  - `수면까지 ...` 메시지는 계속 생성하지만, 배고픔/힘 부족/부상/수면 방해 같은 경고가 있을 때는 상단 요약에서 숨기고 상세 모달에서만 확인되도록 바꿨다.
  - 영어 상태 문구였던 `SLEEPY(Lights Off plz)`는 `졸림! 불을 꺼 주세요 😴`로 교체하고, 남은 시간/케어 미스 구간 설명은 상세 힌트로 분리했다.
  - `DigimonStatusDetailModal`은 `지금 바로 확인 / 곧 대응 필요 / 지금 하고 있는 행동 / 상태 정보 / 안정적인 상태` 순서의 섹션으로 재배치해 상단에서 접힌 상태도 왜 중요한지 바로 이해할 수 있게 정리했다.
  - `DigimonStatusBadges.test.jsx`, `DigimonStatusDetailModal.test.jsx`, `digimonStatusMessages.test.js`를 추가해 핵심 3개 요약, 숨겨진 수면 정보 전달, 수면 방해/수면 카운트다운 우선순위를 고정했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/components/DigimonStatusBadges.jsx`
- `digimon-tamagotchi-frontend/src/components/DigimonStatusDetailModal.jsx`
- `digimon-tamagotchi-frontend/src/components/digimonStatusMessages.js`
- `digimon-tamagotchi-frontend/src/components/DigimonStatusBadges.test.jsx`
- `digimon-tamagotchi-frontend/src/components/DigimonStatusDetailModal.test.jsx`
- `digimon-tamagotchi-frontend/src/components/digimonStatusMessages.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand src/components/digimonStatusMessages.test.js src/components/DigimonStatusBadges.test.jsx src/components/DigimonStatusDetailModal.test.jsx`
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand src/hooks/useGameLogic.test.js src/hooks/useGameData.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 상태 메시지는 이제 UI용 공용 모델을 통해 생성하므로, 이후 `StatsPanel`이나 `StatsPopup`도 같은 규칙으로 맞추고 싶을 때 재사용할 수 있다.
- 이번 라운드에서는 저장 구조나 lazy update를 건드리지 않고, 상태 메시지 생성 규칙과 표현만 바꿔 리스크를 UI 범위로 제한했다.

---

## [2026-04-07] 게임 화면 메뉴 구조를 메타데이터 기반 5+5 그룹으로 재정렬

### 작업 유형
- 🎮 게임 메뉴 정보 구조 재정렬
- 🧭 더보기 허브 섹션형 재구성
- 🔒 메뉴 잠금 상태 UI 일관화
- 🧪 메뉴/가이드 회귀 테스트 추가

### 목적 및 영향
- **목적:** 게임 화면의 10개 1차 아이콘 구조는 유지하면서도, `기본 조작 / 케어·도구 / 더보기` 기준으로 메뉴 의미를 더 분명하게 정리한다.
- **범위:** 게임 메뉴 메타데이터, 메뉴 버튼 렌더링, 더보기 모달, 메뉴 클릭 차단 규칙, 기본 가이드 문구, 관련 테스트와 로그 문서만 조정한다.
- **내용:**
  - `src/constants/gameMenus.js`를 추가해 1차 메뉴와 더보기 메뉴를 공통 메타데이터로 정의하고, 그룹/순서/라벨/잠금 규칙을 한곳에서 관리하도록 정리했다.
  - `MenuIconButtons`, `IconButton`, `ControlPanel`은 이 메타데이터를 읽어 데스크톱과 모바일 모두 같은 `5 + 5` 그룹 구조를 보여 주고, 잠긴 메뉴에는 `잠김` 배지와 안내 문구를 표시하도록 바꿨다.
  - `useGameHandlers`의 `handleMenuClick()`은 더 이상 브라우저 `alert()`를 띄우지 않고, 메뉴 메타데이터 기반 잠금 규칙을 검사한 뒤 접근 가능한 메뉴만 열도록 정리했다.
  - `ExtraMenuModal`은 `기록 / 자료 / 보관·꾸미기 / 시스템` 섹션형 허브로 재구성했고, 하단의 `가이드` 버튼과 중복되던 `디지몬 가이드` 진입은 제거했다.
  - `DigimonGuidePanel`의 기본 가이드 문구도 실제 메뉴 구조와 같은 `기본 조작 / 케어·도구 / 더보기` 기준으로 갱신했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/constants/gameMenus.js`
- `digimon-tamagotchi-frontend/src/components/IconButton.jsx`
- `digimon-tamagotchi-frontend/src/components/MenuIconButtons.jsx`
- `digimon-tamagotchi-frontend/src/components/ControlPanel.jsx`
- `digimon-tamagotchi-frontend/src/components/ExtraMenuModal.jsx`
- `digimon-tamagotchi-frontend/src/components/GameModals.jsx`
- `digimon-tamagotchi-frontend/src/components/panels/DigimonGuidePanel.jsx`
- `digimon-tamagotchi-frontend/src/hooks/useGameHandlers.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/buildGamePageViewModel.js`
- `digimon-tamagotchi-frontend/src/styles/MenuIconButtons.css`
- `digimon-tamagotchi-frontend/src/components/MenuIconButtons.test.jsx`
- `digimon-tamagotchi-frontend/src/components/ControlPanel.test.jsx`
- `digimon-tamagotchi-frontend/src/components/ExtraMenuModal.test.jsx`
- `digimon-tamagotchi-frontend/src/components/panels/DigimonGuidePanel.test.jsx`
- `digimon-tamagotchi-frontend/src/hooks/useGameHandlers.test.js`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/components/IconButton.test.jsx src/components/MenuIconButtons.test.jsx src/components/ControlPanel.test.jsx src/components/ExtraMenuModal.test.jsx src/components/panels/DigimonGuidePanel.test.jsx src/hooks/useGameHandlers.test.js`

### 아키텍처 메모
- 메뉴 순서, 라벨, 잠금 규칙, 더보기 분류를 공용 메타데이터로 묶으면 실제 렌더링과 가이드 문구가 다시 어긋날 가능성을 크게 줄일 수 있다.
- 조명 꺼짐/냉장고 보관 상태를 클릭 시점 경고보다 메뉴 잠금 상태와 화면 내 안내로 표현하는 편이 모바일과 몰입형 플레이 모두에서 더 자연스럽고 예측 가능하다.

## [2026-04-07] 게임 런타임 루프 분리와 저장 경계 정리

### 작업 유형
- ⏱ 실시간 게임 런타임 훅 분리
- 💾 선택 디지몬/사망 스냅샷 저장 어댑터 도입
- 🎞 렌더용 애니메이션 view model 분리
- 📏 런타임 계측 포인트 추가
- 📚 기준 문서/참고 문서 구분 정리

### 목적 및 영향
- **목적:** `Game.jsx`에 몰려 있던 1초 타이머, 탭 이탈 저장, 수면 상태 계산, 렌더 중 애니메이션 상태 변경을 분리해 실시간 제어와 렌더 책임을 구분한다.
- **범위:** 게임 런타임 훅, `useGameData`, `Canvas`, `Game.jsx`, 관련 단위 테스트와 문서만 조정하고 공개 API/Firestore 경로는 유지한다.
- **내용:**
  - `src/hooks/game-runtime/useGameRealtimeLoop.js`, `useGameSleepStatusLoop.js`, `useGameSaveOnLeave.js`, `useGameClock.js`를 추가해 기존 `Game.jsx` 내부 effect 덩어리를 역할별로 분리했다.
  - `src/hooks/game-runtime/gameAnimationViewModel.js`를 추가하고, 렌더 분기 안에서 직접 호출하던 `setCurrentAnimation()`을 `desiredAnimation` 기반 effect로 옮겼다.
  - `useGameData`에 `saveSelectedDigimon`, `persistDeathSnapshot`, `buildDigimonDisplayName`, `sanitizeDigimonStatsForSlotDocument`, `resolveLazyUpdateBaseStats`를 추가해 페이지의 직접 Firestore 쓰기를 줄였다.
  - `applyLazyUpdateForAction()`은 Firestore 문서의 저장 시각과 서버 스냅샷을 기준으로 lazy update를 계산하되, 최신 로그와 루트 상태는 메모리 값을 우선하도록 조정했다.
  - `Canvas`와 `Game`에는 `window.__DIGIMON_RUNTIME_METRICS__` 기반 계측을 추가해 `game_page_commits`, `slot_jogress_snapshot_wakeups`, `slot_jogress_state_updates`, `canvas_initImages_calls`를 브라우저에서 확인할 수 있게 했다.
  - `docs/README.md`를 추가해 현재 기준 문서와 참고/분석 문서를 구분하고, `game_mechanics.md`와 `CURRENT_PROJECT_STRUCTURE_ANALYSIS.md`도 현재 구현 기준으로 갱신했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.test.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useGameClock.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useGameRealtimeLoop.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useGameSaveOnLeave.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/useGameSleepStatusLoop.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/gameAnimationViewModel.js`
- `digimon-tamagotchi-frontend/src/hooks/game-runtime/gameAnimationViewModel.test.js`
- `digimon-tamagotchi-frontend/src/components/Canvas.jsx`
- `digimon-tamagotchi-frontend/src/utils/runtimeMetrics.js`
- `docs/README.md`
- `docs/game_mechanics.md`
- `docs/CURRENT_PROJECT_STRUCTURE_ANALYSIS.md`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameData.test.js src/hooks/game-runtime/gameAnimationViewModel.test.js`
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand`
- `node --test tests/*.test.js api/_lib/*.test.js`

### 아키텍처 메모
- `Game.jsx`는 여전히 컨테이너 허브이지만, 실시간 루프/수면 상태/이탈 저장/애니메이션 프레임 계산은 `src/hooks/game-runtime/*`로 먼저 분리해 이후 container/presenter 분리의 발판을 만들었다.
- `saveSelectedDigimon`과 `persistDeathSnapshot`를 `useGameData`로 이동시켜 저장 경계를 한 단계 더 닫았고, `Game.jsx`는 저장 adapter를 호출하는 쪽으로 역할을 축소했다.
- 조그레스 Firestore write adapter와 구독 범위 축소는 다음 단계 과제로 남기되, 먼저 계측값으로 실제 wake-up/재초기화 빈도를 확인할 수 있게 했다.

---

## [2026-04-04] 랜딩 모바일 헤더의 더보기를 홈 링크로 단순화

### 작업 유형
- 📱 랜딩 모바일 헤더 단순화
- 🔗 로그인 상태별 홈 링크 분기 정리
- 🧪 랜딩 헤더 회귀 테스트 갱신

### 목적 및 영향
- **목적:** 소개 페이지 모바일 헤더 가운데 `더보기`를 제거하고, 더 직접적인 `홈` 링크로 바꿔 랜딩 첫 화면의 구조를 단순화한다.
- **범위:** `LandingTopBar`와 랜딩 헤더 스타일, 관련 테스트와 로그 문서만 조정한다.
- **내용:**
  - `src/components/landing/LandingTopBar.jsx`에서 모바일 오버플로우 메뉴 상태와 패널 렌더링을 제거했다.
  - 가운데 pill은 모바일 전용 `홈` 링크로 교체하고, 로그인 시 `/`, 비로그인 시 `/auth`로 이동하도록 분기했다.
  - `src/styles/landing.css`에서는 기존 모바일 메뉴 스타일을 제거하고, 같은 비율의 `홈` 링크 스타일로 정리했다.
  - `src/components/landing/LandingShell.test.jsx`는 새 `홈` 링크 동작 기준으로 갱신했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/components/landing/LandingTopBar.jsx`
- `digimon-tamagotchi-frontend/src/components/landing/LandingShell.test.jsx`
- `digimon-tamagotchi-frontend/src/styles/landing.css`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true npm test -- --runInBand --watchAll=false src/components/layout/NavigationLinks.test.jsx src/components/landing/LandingShell.test.jsx`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 랜딩 모바일에서는 메뉴를 더 노출하는 것보다, 사용자가 다음 행동으로 바로 이동할 수 있는 단일 홈 링크가 더 단순한 흐름을 만든다.
- 일반 서비스 헤더의 모바일 `더보기` 구조는 유지하고, 소개 페이지 모바일 헤더만 별도 단순화해 역할 차이를 분명히 했다.

## [2026-04-04] 일반 모바일 헤더 비율을 랜딩 헤더와 같은 구조 리듬으로 보정

### 작업 유형
- 📱 일반 서비스 헤더 모바일 비율 조정
- ✍️ 브랜드 텍스트 줄바꿈 방지
- 🧪 헤더 회귀 검증

### 목적 및 영향
- **목적:** 모바일에서 일반 서비스 헤더의 `디지몬 키우기`가 두 줄로 내려가던 문제를 해결하고, 랜딩 헤더와 같은 배치 리듬으로 보이게 정렬한다.
- **범위:** 일반 헤더의 모바일 전용 CSS만 보강하며, 밝은 테마와 기존 링크 구조는 유지한다.
- **내용:**
  - `src/index.css`에 일반 헤더의 `max-width: 900px / 720px` 규칙을 추가해, pill 내부 패딩·아이콘 크기·브랜드 gap·버튼 높이를 랜딩 헤더 모바일 비율과 맞췄다.
  - `service-brand__copy`, `service-brand__eyebrow`, `service-brand__title`에는 모바일 한 줄 우선 + 말줄임 규칙을 넣어 `디지몬 키우기`가 줄바꿈 대신 한 줄로 유지되게 했다.
  - `더보기`와 계정 버튼도 모바일에서 랜딩 헤더와 유사한 높이와 폭 비율을 갖도록 다시 조정했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true npm test -- --runInBand --watchAll=false src/components/layout/NavigationLinks.test.jsx src/components/landing/LandingShell.test.jsx`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 이번 조정은 테마를 통일하는 작업이 아니라, 모바일에서의 여백·비율·줄바꿈 정책만 랜딩 헤더와 맞추는 작업으로 제한했다.
- 브랜드 텍스트는 두 줄 허용보다 한 줄 우선 + 말줄임이 모바일 헤더 안정성에 더 적합하므로, 기본 정책을 그쪽으로 고정했다.

## [2026-04-04] 모바일 소개/노트북 진입을 상단 더보기 메뉴로 재구성

### 작업 유형
- 📱 모바일 하단 탭 축소
- 🍔 일반/랜딩 헤더 모바일 오버플로우 메뉴 추가
- 🧪 모바일 내비게이션 회귀 테스트 보강

### 목적 및 영향
- **목적:** 모바일에서는 하단 탭을 핵심 행동 중심으로 유지하고, `소개`와 `노트북`은 상단 `더보기` 메뉴로 이동시켜 탐색 밀도를 줄인다.
- **범위:** `MobileTabBar`, 일반 `TopNavigation`, 랜딩 `LandingTopBar`, 공용 헤더 메뉴 정의와 관련 테스트를 함께 조정한다.
- **내용:**
  - `src/data/headerNavigation.js`에 모바일 하단 탭/서비스 오버플로우/랜딩 오버플로우 메뉴 헬퍼를 추가했다.
  - `src/components/layout/MobileTabBar.jsx`는 `홈 / 플레이 / 커뮤니티 / 테이머(설정)`만 남기고 `노트북`을 제거했다.
  - `src/components/layout/TopNavigation.jsx`에는 모바일 `더보기` 패널을 추가해 `가이드 / 소식 / 노트북 / 소개`를 상단에서 열 수 있게 했다.
  - `src/components/landing/LandingTopBar.jsx`에는 랜딩 전용 모바일 `더보기` 패널을 추가하고, 현재 페이지인 `소개`는 제외한 나머지 주요 링크를 노출하도록 맞췄다.
  - 일반/랜딩 헤더 스타일과 관련 테스트를 함께 갱신해 모바일에서 새 탐색 흐름이 유지되도록 정리했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/components/layout/MobileTabBar.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/TopNavigation.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/NavigationLinks.test.jsx`
- `digimon-tamagotchi-frontend/src/components/landing/LandingTopBar.jsx`
- `digimon-tamagotchi-frontend/src/components/landing/LandingShell.test.jsx`
- `digimon-tamagotchi-frontend/src/data/headerNavigation.js`
- `digimon-tamagotchi-frontend/src/index.css`
- `digimon-tamagotchi-frontend/src/styles/landing.css`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true npm test -- --runInBand --watchAll=false src/components/layout/NavigationLinks.test.jsx src/components/landing/LandingShell.test.jsx`

### 아키텍처 메모
- 모바일 하단 탭은 빈도 높은 행동만 남기고, 정보성 진입점은 헤더 오버플로우 메뉴로 이동시키는 편이 좁은 화면에서 더 안정적이다.
- 랜딩과 일반 헤더는 시각 톤은 다르지만 모바일 탐색 패턴은 동일하게 맞춰, 페이지 전환 시 학습 비용이 커지지 않도록 했다.

## [2026-04-04] 사망 판정 공통화와 recovery/cleanup 경계 테스트 추가

### 작업 유형
- ☠️ 시간 기반 사망 판정 공통 evaluator 도입
- 🧹 회복/청소/치료 경계 동작 공통 helper 정리
- 🧪 사망/회복 경계 회귀 테스트 추가

### 목적 및 영향
- **목적:** 배고픔/힘 0, 부상 방치, 부상 과다 사망 판정을 하나의 계약으로 묶어 실시간 틱, lazy update, 슬롯 로드 경로가 같은 기준을 보게 한다.
- **범위:** `src/data/stats.js`, `useDeath`, `useGameData`, `Game`의 사망 판정과 `poop 청소`, `치료`, `0 -> 회복 -> 다시 0` 경계 동작을 함께 정리한다.
- **내용:**
  - `src/logic/stats/death.js`에 `evaluateDeathConditions(stats, nowMs)`를 추가하고 `STARVATION`, `EXHAUSTION`, `INJURY OVERLOAD`, `INJURY NEGLECT`의 threshold와 reason 문자열을 한 곳으로 모았다.
  - 냉장고 제외 helper를 공통 evaluator에서 사용하도록 맞춰, 시간 기반 사망 판정이 실시간/로드/lazy update 경로에서 같은 계산을 쓰게 정리했다.
  - `clearPoopOverflowState`, `clearActiveInjuryState`를 추가해 똥 청소는 poop overflow 시간 필드만 정리하고, 치료는 active injury만 해제하며 누적 `injuries`는 유지하도록 계약을 분리했다.
  - `stats.test.js`와 `death.test.js`에 굶주림/탈진/부상 방치/부상 과다, 회복 후 zero 재시작, 청소/치료 경계 케이스를 추가해 회귀를 고정했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/logic/stats/death.js`
- `digimon-tamagotchi-frontend/src/logic/stats/death.test.js`
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `digimon-tamagotchi-frontend/src/data/stats.test.js`
- `digimon-tamagotchi-frontend/src/hooks/useDeath.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameAnimations.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && npm test -- --runInBand --watchAll=false src/logic/stats/death.test.js src/data/stats.test.js src/hooks/useGameLogic.test.js src/logic/evolution/checker.test.js src/logic/battle/hitrate.test.js src/logic/battle/calculator.test.js`
- `cd digimon-tamagotchi-frontend && npm run build`

### 아키텍처 메모
- 이번 라운드에서는 `src/data/stats.js`를 계속 canonical engine으로 유지하고, 사망 판정 기준만 공통 evaluator로 묶었다.
- `src/logic/stats/stats.js` 중복 엔진 정리는 후속 리팩터링 과제로 남긴다.

---

## [2026-04-04] 커뮤니티 자랑 목록 카드 라벨과 구역 구분 강화

### 작업 유형
- 🏷 자랑게시판 목록 카드 필드 라벨 강화
- 🎨 목록 카드 정보 구역 시각 분리
- 🖼 오른쪽 대표 장면 썸네일 확대 및 메타 재배치
- 💬 댓글 3개 미리보기와 더보기 흐름 추가
- 🧪 카드 정보 라벨 회귀 테스트 추가

### 목적 및 영향
- **목적:** 자랑게시판 목록 카드에서 제목, 작성자, 댓글, 디지몬 정보가 한눈에 무엇인지 바로 읽히도록 라벨과 구역 구분을 강화한다.
- **범위:** 목록 카드 UI와 스타일, 관련 페이지 테스트를 함께 갱신한다.
- **내용:**
  - `CommunityPostCard.jsx`에서 상단을 `배지 / 작성자·작성일 / 관리` 구조로 재배치해 작성 정보와 액션이 한 줄에서 명확히 읽히도록 정리했다.
  - 왼쪽 본문은 `제목 :` 아래에 글 제목, 그 아래 `내용 :`, 마지막에 `댓글 :` 순서로 이어지는 일반 게시판형 흐름으로 맞췄고, 본문 텍스트 대비와 카드 배경도 더 또렷하게 조정했다.
  - 오른쪽은 더 넓어진 `대표 장면` 썸네일과 그 아래 `디지몬 :`, `단계 :` 정보만 남기고, 슬롯 정보는 목록 카드에서 제거했다.
  - 목록 응답에 `previewComments`를 추가해, 카드 안에서 최신 댓글 최대 3개를 `작성자 : 본문 한 줄` 형식으로 바로 보여주고 4개 이상은 `더보기...`로 기존 상세 모달을 열도록 연결했다.
  - 작성자 본인에게만 보이는 `수정/삭제`는 카드 오른쪽 상단의 별도 `관리` 박스로 분리하고, 액션 버튼도 독립된 pill 버튼으로 보여 식별성을 높였다.
  - `작성자 : / 작성일 :` 메타 줄도 별도 정보 박스로 감싸 상단 정보 대비를 더 선명하게 맞췄다.
  - `Community.test.jsx`에 라벨/구역 분리 렌더를 검증하는 테스트를 추가했다.

### 영향받은 파일
- `api/_lib/community.js`
- `api/_lib/community.test.js`
- `digimon-tamagotchi-frontend/src/components/community/CommunityPostCard.jsx`
- `digimon-tamagotchi-frontend/src/data/serviceContent.js`
- `digimon-tamagotchi-frontend/src/index.css`
- `digimon-tamagotchi-frontend/src/pages/Community.test.jsx`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watchAll=false --runTestsByPath src/pages/Community.test.jsx`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 상세 정보는 계속 상세 모달에서 확인하되, 목록 카드도 최신 댓글 흐름을 일부 보여주는 “요약 피드 + 빠른 대화 미리보기” 역할까지 맡도록 확장했다.

---

## [2026-04-04] 커뮤니티 상단을 칩형 보드 선택과 컴팩트 헤더로 축소

### 작업 유형
- 🎛 커뮤니티 보드 선택 UI를 카드형에서 칩형 탭으로 축소
- 🪶 선택 보드 hero를 컴팩트 헤더로 재구성
- ↔️ 보드별 CTA를 상단 hero에서 각 콘텐츠 툴바로 이동
- 🧪 커뮤니티 상단 레이아웃 회귀 테스트 보강

### 목적 및 영향
- **목적:** 커뮤니티 페이지 상단에서 보드 선택 카드와 대형 설명 hero가 차지하던 공간을 줄여, 게시판 본문이 더 빨리 보이도록 정리한다.
- **범위:** `/community` 상단 탭/헤더 레이아웃, 보드별 툴바 액션 배치, 관련 CSS와 페이지 테스트를 함께 갱신한다.
- **내용:**
  - `Community.jsx`의 4개 보드 선택 UI를 긴 설명이 들어간 카드형 그리드 대신 제목 중심의 둥근 칩형 탭으로 바꿨다.
  - 선택된 보드 소개 영역은 `커뮤니티 > 현재 게시판 + 상태 + 제목 + 짧은 설명`만 남기는 컴팩트 헤더로 줄이고, 보조 안내 칩과 기존 대형 hero 액션 버튼은 제거했다.
  - 자랑게시판 본문 툴바의 `실제 피드 / 샘플 피드` 보조 라벨도 제거해 제목이 바로 시작되도록 더 간결하게 정리했다.
  - `자랑하기`, `로그인하고 자랑하기`, 보드 간 이동 버튼, 디스코드 바로가기 같은 CTA는 각 보드 `community-feed-toolbar__aside`로 이동해 상단 높이를 더 낮췄다.
  - 디스코드 보드의 초대 버튼은 툴바 CTA로 통합하고, 본문 공개 노트에는 텍스트 링크만 남겨 중복을 줄였다.
  - `Community.test.jsx`에 칩형 탭 구조와 CTA 위치 이동 검증을 추가해 상단 레이아웃 회귀를 고정했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/pages/Community.jsx`
- `digimon-tamagotchi-frontend/src/pages/Community.test.jsx`
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watchAll=false --runTestsByPath src/pages/Community.test.jsx`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 보드 전환 로직과 `/community?board=` URL 계약은 그대로 유지하고, 상단 레이아웃만 정보 밀도 위주로 재구성한다.
- 상단 CTA는 hero에서 분리하고 각 보드의 실제 콘텐츠 툴바에 배치해, 이후 보드별 액션이 늘어나도 보드 내부 맥락에서 관리할 수 있게 유지한다.

---

## [2026-04-04] 과거 아레나 로그를 `구버전 로그`로 명시

### 작업 유형
- 🧭 아레나 배틀 로그 UX 보강
- 🧪 구버전/신규 replay 상태 테스트 추가
- 📘 archive 롤아웃 문서 정책 반영

### 목적 및 영향
- **목적:** `archiveId`가 없는 과거 Firestore-only 아레나 로그가 지금 구조에서는 다시보기를 지원하지 않는다는 점을 사용자에게 명확히 보여 주기.
- **범위:** 아레나 배틀 로그 목록 카드의 상태 문구와 클릭 가능 여부를 정리하고, 관련 테스트와 운영 문서를 함께 갱신한다.
- **내용:**
  - `ArenaScreen`에 replay 상태 헬퍼를 추가해 `archiveId`가 있는 신규 로그와 `archiveId`가 없는 과거 로그를 명확히 구분하도록 정리했다.
  - 과거 로그 카드에는 `구버전 로그` 배지와 `이 기록은 이전 저장 방식으로 생성되어 상세 다시보기를 지원하지 않습니다.` 안내를 표시하고, hover/pointer 및 다시보기 클릭 동작은 제거했다.
  - 신규 로그는 기존처럼 `📖 배틀 로그 다시보기` 문구와 클릭 동작을 유지한다.
  - 테스트를 보강해 `archiveId` 유무에 따른 UI 상태와, 구버전 로그 클릭 시 모달이 열리지 않는 흐름을 고정했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/components/ArenaScreen.jsx`
- `digimon-tamagotchi-frontend/src/components/ArenaScreen.test.jsx`
- `docs/SUPABASE_LOG_ARCHIVE_ROLLOUT.md`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true npm test -- --watchAll=false --runInBand src/components/ArenaScreen.test.jsx`

### 아키텍처 메모
- `archiveId`가 없는 아레나 로그는 과거 Firestore-only 로그로 보고, 목록만 유지하며 상세 다시보기는 지원하지 않는다.

---

## [2026-04-01] Supabase log archive API를 배포 루트로 정렬

### 작업 유형
- 🚚 Vercel 배포 루트 기준 API 경로 정렬
- 📦 log archive 서버 핸들러 배포 트리 추가
- 📘 Supabase archive 운영 적용 순서 문서화

### 목적 및 영향
- **목적:** `digimon-tamagotchi-frontend`를 Vercel `rootDirectory`로 쓰는 현재 배포 구조에서, 새 `/api/logs/*` archive 엔드포인트가 실제 Preview/Prod 배포 결과물에 포함되도록 맞춘다.
- **범위:** log archive API와 공용 `_lib`를 프론트엔드 배포 트리 아래로 추가하고, Supabase SQL 적용/Preview/Prod 검증 순서를 README에 문서화한다.
- **내용:**
  - `digimon-tamagotchi-frontend/api/_lib/logArchives.js`, `logArchiveHandlers.js`를 추가해 Supabase archive 입력 검증과 권한 검사를 기존 community API와 같은 배포 루트에서 처리하도록 맞췄다.
  - `digimon-tamagotchi-frontend/api/logs/arena-battles/archive.js`, `[archiveId]/replay.js`, `jogress/archive.js`를 추가해 아레나 archive 저장, replay 조회, 조그레스 archive 저장 경로가 실제 Vercel 함수로 배포되도록 정렬했다.
  - `README.md`에 `20260402_log_archives.sql` 수동 적용, Preview 후 Prod 배포, 필수 환경변수와 dual-write 단계 범위를 함께 정리했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/api/_lib/logArchives.js` (신규)
- `digimon-tamagotchi-frontend/api/_lib/logArchiveHandlers.js` (신규)
- `digimon-tamagotchi-frontend/api/logs/arena-battles/archive.js` (신규)
- `digimon-tamagotchi-frontend/api/logs/arena-battles/[archiveId]/replay.js` (신규)
- `digimon-tamagotchi-frontend/api/logs/jogress/archive.js` (신규)
- `README.md`
- `docs/REFACTORING_LOG.md`

### 검증
- `node --test api/_lib/logArchiveHandlers.test.js`
- `cd digimon-tamagotchi-frontend && CI=true npm test -- --watchAll=false --runInBand src/utils/logArchiveApi.test.js src/hooks/useGameActions.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- Vercel `rootDirectory`를 바꾸지 않고, 새 archive API를 `digimon-tamagotchi-frontend/api` 아래로 맞추는 것을 기본 배포 경계로 유지한다.
- 이번 배포는 archive 추가와 replay 연결까지만 포함하며, Firestore slimming 단계는 다음 라운드로 분리한다.

---

## [2026-04-01] 테이머명 self-match 중복 확인 UX 정리

### 작업 유형
- 🧭 테이머명 중복 확인 상태 분리
- 🚫 동일 이름 no-op 저장 차단
- 🧪 self-match / 중복 확인 UI 테스트 보강

### 목적 및 영향
- **목적:** 현재 사용 중인 테이머명을 다시 입력했을 때 `사용 가능`으로 보여 혼란을 주던 흐름을 `현재 사용 중인 테이머명입니다.` 안내로 분리하고, 변경 없는 저장으로 Firestore write가 발생하지 않게 정리한다.
- **범위:** `nickname_index` 기반 중복 확인 결과 타입, 계정 설정 패널의 메시지/버튼 상태, 관련 유닛 테스트와 UI 테스트를 함께 갱신한다.
- **내용:**
  - `checkNicknameAvailability()`가 이제 `available`, `current-user`, `taken` 상태를 구분해서 반환하고, 현재 로그인 사용자의 기존 테이머명과 일치하는 경우에는 `현재 사용 중인 테이머명입니다.`를 반환하도록 바꿨다.
  - 계정 설정 패널은 정규화된 입력값이 현재 테이머명과 같으면 저장 버튼을 비활성화하고, 저장 핸들러에서도 동일 가드로 no-op 저장을 막도록 정리했다.
  - `A B`와 `A  B`처럼 공백만 다른 입력도 정규화 후 self-match로 처리해, 중복 확인 메시지와 저장 가능 여부가 일관되게 맞도록 정리했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/utils/tamerNameUtils.js`
- `digimon-tamagotchi-frontend/src/utils/tamerNameUtils.test.js`
- `digimon-tamagotchi-frontend/src/components/panels/AccountSettingsPanel.jsx`
- `digimon-tamagotchi-frontend/src/components/panels/AccountSettingsPanel.test.jsx`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true npm test -- --watchAll=false --runInBand src/utils/tamerNameUtils.test.js src/components/panels/AccountSettingsPanel.test.jsx`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 다른 사용자 이름에 대한 중복 판정 source of truth는 계속 `nickname_index/{normalizedKey}`다.
- 현재 사용자의 기존 이름은 오류가 아니라 self-match 안내 상태로 분리하고, 저장은 no-op로 취급한다.

---

## [2026-04-01] 모바일 로비 채팅 입력창 가시성 복구

### 작업 유형
- 📱 모바일 채팅 드로어 레이아웃 조정
- 💬 입력창 고정 composer 구조 추가
- 🧪 drawer variant 회귀 테스트 추가

### 목적 및 영향
- **목적:** 모바일에서 로비 채팅 드로어를 열었을 때 입력창이 화면 아래로 잘려 메시지를 입력할 수 없던 문제를 해결한다.
- **범위:** 전역 로비 채팅 drawer variant의 내부 레이아웃과 모바일 CSS만 조정하며, 커뮤니티/일반 채팅 화면 구조는 유지한다.
- **내용:**
  - `ChatRoom`의 drawer variant에서 접속 상태/온라인 목록/메시지 영역을 스크롤 영역으로 묶고, 입력줄은 별도 composer 영역으로 분리해 하단에 항상 남도록 정리했다.
  - 모바일 `play-chat-drawer`를 기존보다 낮고 크게 보이는 바텀시트 형태로 조정하고, `dvh + safe-area + flex` 조합으로 키보드가 올라와도 입력줄이 보이도록 맞췄다.
  - 온라인 목록 높이를 제한해 접속자 수가 많아져도 입력줄이 밀려나지 않도록 했고, drawer variant 전용 테스트를 추가해 composer가 스크롤 영역 바깥에 렌더되는지 고정했다.
  - 추가로 모바일 브라우저 하단 툴바와 겹쳐 입력창 하단이 살짝 잘리는 현상을 줄이기 위해, drawer의 `bottom` 최소값을 올리고 `max-height`를 함께 줄여 바텀시트 전체를 조금 위로 이동시켰다.
  - 접속자 수가 늘어나도 입력칸이 다시 밀려나지 않도록 drawer variant를 `상단 스크롤 영역 + 하단 sticky composer` 구조로 강화하고, 모바일 bottom clearance를 더 높였다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/components/ChatRoom.jsx`
- `digimon-tamagotchi-frontend/src/components/ChatRoom.test.jsx` (신규)
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true npm test -- --watchAll=false --runInBand src/components/ChatRoom.test.jsx src/components/chat/PlayChatButton.test.jsx`

### 아키텍처 메모
- drawer variant는 입력창을 패널 하단의 고정 영역으로 유지하고, 스크롤은 상단 정보/메시지 영역만 담당한다.
- 별도 viewport 계산 JS 없이 CSS 레이아웃만으로 모바일 키보드와 세이프에어리어 대응을 우선 처리한다.

---

## [2026-04-01] 테이머명 저장 트랜잭션 핫픽스 및 레거시 닉네임 정리 단계 추가

### 작업 유형
- 🚑 Firestore transaction read/write 순서 핫픽스
- ⚠️ 저장 성공 후 후속 동기화 경고 분리
- 🧹 레거시 `metadata/nicknames` 정리 스크립트 추가
- 🧪 저장/복구 회귀 테스트 보강

### 목적 및 영향
- **목적:** 테이머명 저장 시 `Firestore transactions require all reads to be executed before all writes.` 오류를 제거하고, 저장은 성공했는데 후속 새로고침만 늦는 경우를 저장 실패로 오인하지 않게 분리한다.
- **범위:** `nickname_index` 기반 테이머명 저장/복구 로직, 계정 설정 패널 메시지, 운영 닉네임 정리 스크립트와 관련 테스트/문서를 함께 갱신한다.
- **내용:**
  - `tamerNameUtils.js`의 `updateTamerName()`과 `resetToDefaultTamerName()`이 transaction 안에서 모든 `get`을 먼저 수행한 뒤 `update/set/delete`를 실행하도록 순서를 고쳤다.
  - 저장 시에는 실제 사용자 문서의 현재 `tamerName`을 우선 기준으로 이전 인덱스를 계산해, 화면에 들고 있던 예전 값이 어긋나 있어도 잘못된 인덱스 삭제를 줄이도록 보강했다.
  - `AccountSettingsPanel.jsx`는 저장 단계와 후속 `refreshProfile()` 동기화 단계를 분리해, 저장은 성공했지만 새로고침이 늦는 경우 `프로필 새로고침이 늦을 수 있습니다.` 경고로만 표시하도록 정리했다.
  - `scripts/cleanupLegacyNicknameMetadata.js`와 `nickname:cleanup` 스크립트를 추가해, `nickname:verify` 통과 후 레거시 `metadata/nicknames` 문서를 안전하게 삭제할 수 있게 했다.
  - `tamerNameUtils.test.js`, `AccountSettingsPanel.test.jsx`를 보강해 transaction의 read-before-write 순서와 저장 후 경고 흐름을 고정했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/utils/tamerNameUtils.js`
- `digimon-tamagotchi-frontend/src/utils/tamerNameUtils.test.js`
- `digimon-tamagotchi-frontend/src/components/panels/AccountSettingsPanel.jsx`
- `digimon-tamagotchi-frontend/src/components/panels/AccountSettingsPanel.test.jsx`
- `scripts/backfillNicknameIndex.js`
- `scripts/cleanupLegacyNicknameMetadata.js` (신규)
- `package.json`
- `README.md`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && CI=true npm test -- --watchAll=false --runInBand src/utils/tamerNameUtils.test.js src/components/panels/AccountSettingsPanel.test.jsx`
- `node --test tests/nickname-index-migration.test.js`

### 아키텍처 메모
- 런타임의 테이머명 중복 판정 source of truth는 계속 `nickname_index/{normalizedKey}`다.
- 운영 정리는 `nickname:audit -> nickname:backfill -> nickname:verify -> nickname:cleanup` 순서를 기준으로 진행한다.

---

## [2026-04-01] Supabase 기반 커뮤니티 1차 MVP 연결

### 작업 유형
- 🌐 Supabase `community_posts` / `community_post_comments` 스키마 추가
- 🔐 Firebase Auth 검증 + Vercel API 브리지 추가
- 📝 `/community` 공개 샘플 피드 / 로그인 실사용 피드 분기 구현
- 💬 게시글 상세, 댓글 작성/수정/삭제 1차 흐름 연결
- 🧪 커뮤니티 스냅샷/페이지 테스트와 Node API 헬퍼 테스트 추가

### 목적 및 영향
- **목적:** 게임/슬롯 원본 데이터는 Firestore에 유지하면서, 커뮤니티는 장기적으로 Supabase 축으로 분리할 수 있는 1차 MVP를 실제 동작 상태로 올리기.
- **범위:** `/community` 페이지, Supabase용 SQL 스키마, Firebase Admin + Supabase service role 기반 Vercel API, 게시글/댓글 CRUD, 공개 샘플 데이터와 테스트를 함께 정리했다.
- **내용:**
  - 루트에 `api/community/showcase/...` 서버리스 엔드포인트를 추가하고, 모든 실제 커뮤니티 요청이 Firebase ID 토큰 검증 뒤 Supabase service role로만 처리되도록 구성했다.
  - 게시글 작성 시 클라이언트가 스냅샷을 보내지 못하도록 막고, 서버가 Firestore `users/{uid}/slots/{slotId}`를 직접 읽어 `slotName`, `digimonDisplayName`, `stageLabel`, `weight`, `careMistakes`, `totalBattles`, `winRate` 등을 자동 스냅샷으로 생성하도록 했다.
  - `/community`는 비로그인 상태에서 `communityShowcaseSamples`만 보여 주고, 로그인 상태에서는 실제 피드/작성 패널/상세 패널/댓글 흐름을 열도록 분리했다.
  - `CommunityPostComposer`, `CommunityPostCard`, `communityApi`, `communitySnapshotUtils`를 정리해 슬롯 선택 기반 자동 미리보기와 실제 API 연동을 붙였다.
  - `supabase/migrations/20260401_community_showcase.sql`을 추가해 `community_posts`, `community_post_comments`, 인덱스, cascade delete, RLS 활성화까지 초기 스키마를 문서화했다.
  - `communitySnapshotUtils.test.js`, `Community.test.jsx`, `tests/community-lib.test.js`를 추가해 공개/로그인 분기, 슬롯 미리보기 스냅샷, 서버 헬퍼의 슬롯/검증 로직을 고정했다.

### 영향받은 파일
- `package.json`
- `package-lock.json`
- `api/_lib/http.js`
- `api/_lib/auth.js`
- `api/_lib/firebaseAdmin.js`
- `api/_lib/supabaseAdmin.js`
- `api/_lib/community.js`
- `api/community/showcase/posts/index.js`
- `api/community/showcase/posts/[postId].js`
- `api/community/showcase/posts/[postId]/comments/index.js`
- `api/community/showcase/comments/[commentId].js`
- `supabase/migrations/20260401_community_showcase.sql`
- `tests/community-lib.test.js`
- `digimon-tamagotchi-frontend/src/pages/Community.jsx`
- `digimon-tamagotchi-frontend/src/pages/Community.test.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunityPostComposer.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunityPostCard.jsx`
- `digimon-tamagotchi-frontend/src/utils/communityApi.js`
- `digimon-tamagotchi-frontend/src/utils/communitySnapshotUtils.js`
- `digimon-tamagotchi-frontend/src/utils/communitySnapshotUtils.test.js`
- `digimon-tamagotchi-frontend/src/data/serviceContent.js`
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### 검증
- `npm run test:community-api`
- `CI=true npm test -- --watchAll=false --runInBand src/pages/Community.test.jsx src/utils/communitySnapshotUtils.test.js`
- `NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 아키텍처 메모
- 실제 사용자 커뮤니티 글은 로그인 상태에서만 읽고 쓰며, 공개 라우트에서는 로컬 샘플 데이터만 노출한다.
- Supabase는 커뮤니티 저장소로만 사용하고, 슬롯/프로필/게임 상태의 source of truth는 계속 Firestore다.
- 현재 구현은 `내 디지몬 자랑(showcase)` 보드만 실사용하며, `진화 노트`와 `조그레스 모집`은 같은 구조를 재사용할 수 있게 카드/상태만 먼저 유지한다.

---

## [2026-04-01] 테이머명 중복 확인을 `nickname_index` 문서 인덱스로 전환

### 작업 유형
- 🗂 `metadata/nicknames` 단일 문서 의존 제거
- ✍️ 테이머명 입력 공백 정규화 규칙 도입
- 🔒 닉네임 인덱스 전용 Firestore 보안 규칙 추가
- 🧰 감사 / 백필 스크립트 추가
- ✅ 운영 검증 / 정리 스크립트 추가
- 🧪 테이머명 유틸 / 계정 설정 패널 테스트 보강

### 목적 및 영향
- **목적:** 전역 단일 문서 병목을 없애고, 테이머명 변경을 사용자 문서와 닉네임 인덱스 문서가 함께 갱신되는 원자적 흐름으로 바꾸기.
- **범위:** 테이머명 중복 확인, 저장/초기화, Firestore 보안 규칙, 닉네임 인덱스 마이그레이션 스크립트와 관련 테스트/문서를 함께 갱신한다.
- **내용:**
  - `src/utils/tamerNameUtils.js`를 `nickname_index/{normalizedKey}` 기반 구조로 재작성하고, `trim + 연속 공백 1칸 축약 + 영문 소문자화` 규칙을 공통 유틸로 고정했다.
  - `checkNicknameAvailability()`는 전체 목록을 읽지 않고 단일 인덱스 문서만 조회하도록 바꾸고, 공백 자동 정규화가 일어나면 안내 문구와 정규화 결과를 함께 반환하도록 확장했다.
  - `updateTamerName()`과 `resetToDefaultTamerName()`은 Firestore transaction으로 바꿔 `users/{uid}.tamerName`과 `nickname_index`를 한 번에 반영하도록 정리했다.
  - `AccountSettingsPanel.jsx`는 중복 확인/저장 시 정규화된 테이머명으로 입력창을 즉시 맞추고, `연속된 공백은 1칸으로 자동 변경됩니다.` 안내를 성공 문구와 함께 보여주도록 보강했다.
  - 루트 `scripts/`에 `nickname:audit`, `nickname:backfill`, `nickname:verify` 스크립트를 추가해 `users/{uid}.tamerName`을 진실 소스로 충돌 감사, 인덱스 백필, 운영 검증을 수행할 수 있게 했다.
  - `nickname:backfill`은 이제 `nickname_index`만 채우지 않고, 공백 정규화가 필요한 기존 `users/{uid}.tamerName`도 함께 정리하며, 더 이상 사용되지 않는 `nickname_index` 문서는 정리한다.
  - 운영 스크립트는 `.firebaserc`의 기본 프로젝트 ID를 자동으로 읽도록 보강해, 별도 `FIREBASE_PROJECT_ID` 환경변수가 없어도 같은 Firebase 프로젝트를 기준으로 동작하게 했다.
  - 운영 스크립트는 `~/.config/firebase/d2tamarefact-adminsdk.json` 같은 표준 서비스 계정 경로도 자동 탐색하도록 보강해, 이후에는 해당 위치에 키 파일만 두면 별도 환경변수 없이 실행할 수 있게 했다.
  - `firestore.rules`, `README.md`, `FIRESTORE_RULES.md`를 새 경계 `nickname_index/{normalizedKey}` 기준으로 갱신했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/utils/tamerNameUtils.js`
- `digimon-tamagotchi-frontend/src/utils/tamerNameUtils.test.js` (신규)
- `digimon-tamagotchi-frontend/src/components/panels/AccountSettingsPanel.jsx`
- `digimon-tamagotchi-frontend/src/components/panels/AccountSettingsPanel.test.jsx`
- `firestore.rules`
- `scripts/nicknameIndexShared.js` (신규)
- `scripts/auditNicknameIndex.js` (신규)
- `scripts/backfillNicknameIndex.js` (신규)
- `scripts/verifyNicknameIndex.js` (신규)
- `package.json`
- `tests/nickname-index-migration.test.js` (신규)
- `README.md`
- `FIRESTORE_RULES.md`
- `docs/REFACTORING_LOG.md`

### 검증
- `cd digimon-tamagotchi-frontend && npm test -- --runInBand --watchAll=false src/utils/tamerNameUtils.test.js src/components/panels/AccountSettingsPanel.test.jsx`
- `node --test tests/nickname-index-migration.test.js`

### 아키텍처 메모
- 앞으로 테이머명 중복 판정은 `users/{uid}.tamerName`과 별개로 `nickname_index/{normalizedKey}` 문서를 통해 이뤄진다.
- 표시용 닉네임과 중복 판정 키를 모두 공백 정규화 규칙에 맞춰 저장하므로, `A B`와 `A  B`는 같은 이름으로 간주된다.
- 레거시 `metadata/nicknames` 문서는 즉시 삭제하지 않고, 마이그레이션 완료 후 미사용 상태로 남겨 둔다.
- 운영 전환은 `rules 배포 -> nickname:audit -> nickname:backfill -> nickname:verify` 순서를 기준으로 진행한다.

---

## [2026-03-31] 수면 규칙을 `경고`와 `실제 수면 방해`로 재정의

### 작업 유형
- 🛠 `Sleep Call`과 `TIRED`를 경고 전용 상태로 축소
- 🌙 자는 중 강제 깨움만 `sleepDisturbances`로 집계하도록 정리
- 🧪 강제 깨움 / 수면 호출 경계 테스트 보강

### 목적 및 영향
- **목적:** 수면 규칙의 의미를 명확히 분리하기. 앞으로는 `자는 중 액션으로 실제로 깨운 사건`만 수면 방해로 집계하고, `TIRED`와 `Sleep Call`은 경고 상태로만 유지한다.
- **범위:** 수면 방해 로그 타입, `Sleep Call` 타임아웃 동작, 관련 UI/가이드 문구와 테스트를 함께 조정하며, hunger/strength call과 lazy update 저장 규칙은 유지한다.
- **내용:**
  - `useGameLogic.js`에 수면 방해 공용 판별/로그 헬퍼를 추가하고, `hasDuplicateSleepDisturbanceLog()`를 `SLEEP_DISTURBANCE` 기준으로 재정의했다.
  - `checkCallTimeouts()`에서 `Sleep Call 60분`이 더 이상 `careMistakes`를 올리지 않도록 바꾸고, 경고 상태는 조건이 해제될 때까지 유지되도록 정리했다.
  - `useGameActions.js`, `useGameAnimations.js`, `GameModals.jsx`의 자는 중 액션 로그를 `CARE_MISTAKE`가 아닌 `SLEEP_DISTURBANCE` 전용 로그로 통일했다.
  - `StatsPopup.jsx`, `ActivityLogModal.jsx`, `DigimonGuidePanel.jsx`의 표시/설명 문구를 새 규칙에 맞게 정리했다.
  - `useGameActions.test.js`를 추가하고 `useGameLogic.test.js`를 갱신해, 자는 중 액션은 `sleepDisturbances +1`과 `wakeUntil`만 발생하고 `careMistakes`는 변하지 않는다는 규칙을 테스트로 고정했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameAnimations.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.test.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.test.js`
- `digimon-tamagotchi-frontend/src/components/ActivityLogModal.jsx`
- `digimon-tamagotchi-frontend/src/components/GameModals.jsx`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx`
- `digimon-tamagotchi-frontend/src/components/panels/DigimonGuidePanel.jsx`
- `docs/REFACTORING_LOG.md`

### 검증
- `npm test -- --runInBand --watchAll=false src/hooks/useGameLogic.test.js src/hooks/useGameActions.test.js src/data/stats.test.js`
- `npm run build`

### 아키텍처 메모
- 수면 관련 카운터는 이제 명확히 분리된다.
  - `careMistakes`: 배고픔/힘 호출 무시, 괴롭히기 등 일반 케어미스
  - `sleepDisturbances`: 자는 중 강제로 깨운 실제 사건 수
- `dailySleepMistake`, `sleepMistakeDate`, `tiredCounted` 같은 이전 일일 수면 케어미스 필드는 저장 호환성 때문에 남겨두되, 더 이상 실제 수면 방해 판정 기준으로 사용하지 않는다.

---

## [2026-03-31] `applyLazyUpdate` 1차 회귀 테스트 추가

### 작업 유형
- 🧪 시간 기반 스탯 로직 characterization 테스트 추가
- ⏱ hunger/strength call 복원 및 타임아웃 경계 검증
- 😴 sleep call / 수면 방해 중복 경계 테스트 추가
- 🧬 진화 조건 순수 로직 테스트 추가
- ☠️ 사망 조건 임계값 characterization 테스트 추가
- ⚔️ 배틀 계산 / 명중률 순수 로직 테스트 추가

### 목적 및 영향
- **목적:** 최근 `Lifespan NaN`, 진화 후 새로고침 상태 불일치, call/deadline 정합성 문제를 연달아 수정한 뒤, 가장 회귀 위험이 큰 `applyLazyUpdate()` 경로를 자동 테스트로 먼저 고정하기.
- **범위:** `src/data/stats.js`의 lazy update 로직에 대해 단위 테스트를 추가하며, 실제 게임 UI/저장 흐름은 바꾸지 않는다.
- **내용:** `src/data/stats.test.js`를 추가해 다음 케이스를 검증하도록 했다.
  - 마지막 저장 시각이 없을 때 현재 시각만 기록하는지
  - 일반 시간 경과 시 수명/진화시간과 hunger/strength call 상태를 함께 재구성하는지
  - 수면 시간은 hunger/strength/poop countdown에서 제외하는지
  - 냉장고에 넣은 이후 시간은 경과 계산에서 제외하는지
  - 새로고침 시 `lastHungerZeroAt`, `lastStrengthZeroAt`를 기준으로 hunger/strength call을 복원하는지
  - hunger/strength call 10분 초과 시 케어미스를 1회만 올리고 호출을 닫는지
  - `src/hooks/useGameLogic.test.js`를 추가해 수면 시간 + 불 켜짐 상태에서 `TIRED`, `sleep call`이 시작되는지, 실제로 잠든 상태에서는 `sleep call`이 비활성화되는지, `sleep call` 60분 초과 시 케어미스가 1회만 오르는지, `수면 방해` 로그가 15분 이내 중복 감지되는지 검증했다.
  - `src/logic/evolution/checker.test.js`를 추가해 진화 시간 미충족(`NOT_READY`), 단일 조건 그룹, OR 조건 그룹, 자동 진화, 조건 미충족 상세 정보, `findEvolutionTarget` 레거시 호환 동작을 검증했다.
  - `src/data/stats.test.js`에 굶주림 12시간, 힘 12시간, 부상 15회, 부상 방치 6시간 사망 임계값 테스트를 추가해 `applyLazyUpdate()`가 사망 이유를 올바르게 설정하는지 검증했다.
  - `src/logic/battle/hitrate.test.js`, `src/logic/battle/calculator.test.js`를 추가해 속성 상성, 파워 계산 cap, 히트레이트 클램핑, 결정적 전투 시뮬레이션, 부상 확률 cap을 검증했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/stats.test.js` (신규)
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.test.js` (신규)
- `digimon-tamagotchi-frontend/src/logic/evolution/checker.test.js` (신규)
- `digimon-tamagotchi-frontend/src/logic/battle/hitrate.test.js` (신규)
- `digimon-tamagotchi-frontend/src/logic/battle/calculator.test.js` (신규)
- `docs/REFACTORING_LOG.md`

### 검증
- `npm test -- --runInBand --watchAll=false src/data/stats.test.js`
- `npm test -- --runInBand --watchAll=false src/data/stats.test.js src/hooks/useGameLogic.test.js`
- `npm test -- --runInBand --watchAll=false src/data/stats.test.js src/hooks/useGameLogic.test.js src/logic/evolution/checker.test.js`
- `npm test -- --runInBand --watchAll=false src/data/stats.test.js src/hooks/useGameLogic.test.js src/logic/evolution/checker.test.js src/logic/battle/hitrate.test.js src/logic/battle/calculator.test.js`

### 아키텍처 메모
- 이 테스트는 `codex analyze`에서 우선순위가 가장 높게 지목된 시간 기반 규칙 세이프티넷의 첫 단계다.
- 다음 라운드는 동일한 축에서 `실제 케어미스 중복/드리프트 수정`, `App smoke test 보강`, `Game.jsx 조립 책임 분리 전 characterization 확장` 순으로 확장하는 것이 가장 안전하다.

---

## [2026-03-30] 채팅 버튼 라벨 단순화 및 접속 수 통합

### 작업 유형
- 💬 전역 채팅 진입 UI 정리
- 🎛 상단 액션 중복 제거
- 🧪 채팅 버튼 표시 테스트 추가

### 목적 및 영향
- **목적:** 우하단 플로팅 버튼의 이름을 `채팅`으로 단순화하고, 별도로 흩어져 있던 실시간 접속 수를 버튼 안으로 통합해 전역 실시간 진입점을 더 명확하게 만들기.
- **범위:** 일반 서비스 셸의 전역 채팅 버튼과 상단 네비만 바뀌며, 드로어 내부 채팅 내용과 게임 화면 안의 별도 접속자 표시 UI는 그대로 유지한다.
- **내용:** `PlayChatButton`에 `presenceCount`를 연결해 `채팅` 텍스트 오른쪽에 `N명`을 함께 표시하도록 바꿨다. 닫힘 상태 라벨은 `로비 채팅`에서 `채팅`으로 단순화했고, 상단 우측의 별도 초록 접속 수 pill은 제거해 전역 실시간 진입점을 플로팅 채팅 버튼 하나로 일원화했다. 서비스 페이지 안내 문구도 `로비 채팅`에서 `채팅` 기준으로 맞췄다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/components/chat/PlayChatButton.jsx`
- `digimon-tamagotchi-frontend/src/components/chat/PlayChatButton.test.jsx`
- `digimon-tamagotchi-frontend/src/components/chat/PlayChatDrawer.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/TopNavigation.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/NavigationLinks.test.jsx`
- `digimon-tamagotchi-frontend/src/pages/Community.jsx`
- `digimon-tamagotchi-frontend/src/pages/PlayHub.jsx`
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### 아키텍처 메모
- 서비스 셸 기준 실시간 진입점은 우하단 플로팅 채팅 버튼 하나로 충분하므로, 상단 네비의 별도 접속 수 표시까지 유지하는 것보다 버튼 안에 접속 수를 통합하는 편이 정보 밀도와 UI 일관성 모두에 더 유리하다.

---

## [2026-03-30] 홈 히어로 패널의 사각 래퍼 테두리 제거

### 작업 유형
- 🎨 서비스 홈 카드 레이어 정리

### 목적 및 영향
- **목적:** 홈의 `오늘 할 일` 카드 바깥에 사각 래퍼 테두리가 남아 둥근 카드 뒤로 네모 프레임이 비쳐 보이던 문제를 정리하기.
- **범위:** 홈 히어로 영역의 패널 래퍼(`service-hero__panel`)만 수정되며, 실제 카드의 둥근 모서리와 내부 콘텐츠 스타일은 그대로 유지된다.
- **내용:** `service-hero__panel`이 공통 카드 스타일 규칙에 포함되어 사각 테두리, 배경, 그림자, 블러를 함께 받고 있었기 때문에, 공통 묶음에서 제외하고 래퍼를 투명 상태로 정리했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### 아키텍처 메모
- 시각적으로 실제 카드 역할을 하는 요소와 단순 레이아웃 래퍼를 같은 카드 스타일 규칙에 묶지 않는 편이 이후 레이어 충돌과 중복 테두리 문제를 줄이는 데 유리하다.

---

## [2026-03-30] 상단 네비 접속자 표시에서 채팅 바로가기 버튼 제거

### 작업 유형
- 🎛 상단 네비 액션 밀도 정리
- 💬 채팅 진입점 역할 분리

### 목적 및 영향
- **목적:** 서비스 상단 네비에서 접속자 수 옆에 붙어 있던 별도 말풍선 버튼을 제거해 액션 영역을 단순화하고, 채팅 진입은 우하단 로비 채팅 드로어 버튼으로 일원화하기.
- **범위:** 상단 네비의 접속자 표시만 바뀌고, 게임 화면 등 다른 `OnlineUsersCount` 사용처는 기존처럼 채팅 바로가기 버튼을 유지할 수 있다.
- **내용:** `OnlineUsersCount`에 `showChatShortcut` 옵션을 추가해 채팅 바로가기 버튼 표시 여부를 제어할 수 있게 만들었다. `TopNavigation`에서는 이 값을 `false`로 넘겨 접속자 수 버튼만 보이도록 바꿨고, 기존 채팅 드로어와 접속자 팝업 동작은 그대로 유지했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/components/OnlineUsersCount.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/TopNavigation.jsx`
- `docs/REFACTORING_LOG.md`

### 아키텍처 메모
- 실시간 로비 채팅은 이미 전역 플로팅 드로어 버튼으로 접근할 수 있으므로, 상단 네비까지 같은 기능의 보조 버튼을 중복해서 두기보다 접속자 표시와 채팅 진입점을 분리하는 편이 정보 밀도와 시각적 우선순위 모두에 더 유리하다.

---

## [2026-03-30] 커뮤니티 채팅 UI를 플로팅 로비 드로어로 통일

### 작업 유형
- 💬 커뮤니티 채팅 진입 방식 통일
- 🧪 커뮤니티 라우트 회귀 테스트 보강

### 목적 및 영향
- **목적:** 커뮤니티만 인라인 전체 채팅을 따로 쓰던 구조를 정리하고, 다른 서비스 페이지와 동일하게 플로팅 로비 채팅 드로어를 사용하도록 통일하기.
- **범위:** 로그인 상태의 `/community`도 이제 `/home`, `/guide`, `/play`, `/me`와 같은 플로팅 로비 채팅 버튼을 사용한다. `/notebook`, `/auth`, `/play/:slotId/full`은 계속 제외된다.
- **내용:** `App.jsx`의 `ChatRoomWrapper`에서 `/community` 전용 인라인 `ChatRoom` 렌더링 분기를 제거하고, 일반 서비스 경로 공통 로비 드로어 정책으로 통일했다. `Community.jsx`의 상태 안내 문구도 “실시간 기능은 다음 단계”에서 “실시간 로비 채팅은 바로 사용 가능”으로 바꿔 현재 동작과 맞췄다. `App.test.js`에는 `/community`에서도 인라인 채팅 대신 플로팅 채팅 드로어가 준비되는지 확인하는 테스트를 추가했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/App.jsx`
- `digimon-tamagotchi-frontend/src/App.test.js`
- `digimon-tamagotchi-frontend/src/pages/Community.jsx`
- `docs/REFACTORING_LOG.md`

### 아키텍처 메모
- 로비 채팅은 특정 페이지 전용이 아니라 서비스 전역의 실시간 입구 역할이므로, 커뮤니티만 다른 UI를 유지하기보다 공통 드로어 인터랙션으로 맞추는 편이 사용성도 단순하고 유지보수도 쉽다.

---

## [2026-03-30] 로비 채팅 플로팅 런처 노출 경로 확대

### 작업 유형
- 💬 실시간 채팅 진입 범위 확장
- 🧪 라우트 회귀 테스트 보강

### 목적 및 영향
- **목적:** `/play` 허브에서만 보이던 로비 채팅 플로팅 버튼을 일반 서비스 페이지에서도 접근 가능하게 만들어, 홈이나 가이드, 마이페이지 같은 화면에서도 바로 실시간 로비로 들어갈 수 있게 하기.
- **범위:** `/community`는 기존 인라인 전체 채팅을 유지하고, 로그인 상태의 일반 서비스 경로에서는 플로팅 채팅 드로어를 공통으로 노출한다. `/notebook`, `/auth`, 몰입형 전체화면(`/full`)은 계속 제외한다.
- **내용:** `App.jsx`의 `ChatRoomWrapper` 조건을 `/play` 전용에서 공통 서비스 경로 기준으로 바꿨다. 이제 로그인 상태라면 `/community`를 제외한 일반 경로에서 `PlayChatDrawer`가 렌더링되고, `/community`는 기존처럼 인라인 채팅을 유지한다. 동시에 `App.test.js`에 `/guide` 같은 커뮤니티 외 경로에서도 채팅 드로어가 준비되는 스모크 테스트를 추가했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/App.jsx`
- `digimon-tamagotchi-frontend/src/App.test.js`
- `docs/REFACTORING_LOG.md`

### 화면 테마 노트북 라벨을 한솔이의 노트북으로 바꾸고 로그아웃 액션에 출구 이모티콘 추가

- 화면 테마 선택 라벨의 `노트북`을 `한솔이의 노트북`으로 바꿔, 설정 패널과 테이머 화면 요약 카드에서 더 서비스 톤에 맞는 이름으로 보이게 정리했다.
- 저장 유효성 검사 문구도 같은 기준으로 맞춰, 잘못된 테마 값 안내에서 `기본 또는 한솔이의 노트북`으로 표시되도록 수정했다.
- 로그아웃 주요 액션은 `🚪 로그아웃` 기준으로 맞췄다. 설정 페이지 섹션 제목과 확인 버튼, 상단 계정 메뉴, 레거시 계정 설정 모달에서 같은 표현을 사용한다.
- 관련 테스트의 버튼/메뉴 이름도 새 라벨 기준으로 갱신했다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/contexts/ThemeContext.jsx`
- `digimon-tamagotchi-frontend/src/utils/userSettingsUtils.js`
- `digimon-tamagotchi-frontend/src/pages/Settings.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/TopNavigation.jsx`
- `digimon-tamagotchi-frontend/src/components/AccountSettingsModal.jsx`
- `digimon-tamagotchi-frontend/src/contexts/ThemeContext.test.jsx`
- `digimon-tamagotchi-frontend/src/components/panels/AccountSettingsPanel.test.jsx`
- `digimon-tamagotchi-frontend/src/pages/Me.test.jsx`
- `digimon-tamagotchi-frontend/src/pages/Home.test.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/NavigationLinks.test.jsx`
- `docs/REFACTORING_LOG.md`

### 아키텍처 메모
- 로비 채팅은 플레이 허브 전용 기능이 아니라 사이트 전반의 실시간 로비라는 성격이 더 강하므로, 일반 서비스 페이지에서도 일관되게 접근 가능한 쪽이 사용자 경험과 정보 구조에 더 잘 맞는다.

---

## [2026-03-30] 서비스 셸 테마 선택 기능 도입

### 작업 유형
- ✨ 서비스 셸 테마 기능 추가
- 🎨 `default / notebook` 테마 분리
- 🧪 테마 저장/적용 테스트 추가

### 목적 및 영향
- **목적:** 전체 사이트를 한 번에 노트북 UI로 고정하지 않고, 사용자가 서비스 셸 분위기를 `기본` 또는 `노트북`으로 선택할 수 있게 만들기.
- **범위:** `홈`, `가이드`, `마이`, `소식`, `커뮤니티`, `설정`, `플레이 허브` 같은 일반 서비스 페이지의 상단바/배경/카드/버튼 톤을 테마로 바꾸고, `/notebook`은 기존 쇼케이스 화면을 그대로 유지한다. 실제 게임 내부 UI와 몰입형 플레이는 이번 범위에서 제외한다.
- **내용:** `ThemeProvider`를 추가해 `siteTheme`를 전역 상태로 관리하고, 로그인 사용자는 `users/{uid}` 문서의 `siteTheme` 필드, 비로그인 사용자는 `localStorage(siteTheme)`를 사용하도록 우선순위를 정리했다. `ServiceLayout`은 일반 서비스 라우트에 `service-shell--theme-default` 또는 `service-shell--theme-notebook` 클래스를 붙이고, `/notebook`은 기존 notebook 전용 셸 분기를 유지한다. `Home.jsx` 비로그인 화면에는 공개 테마 토글을 추가해 로그인 전에도 사이트 분위기를 미리 바꿔볼 수 있게 했고, `AccountSettingsPanel`에는 `화면 테마` 섹션을 추가해 로그인 사용자가 즉시 적용 + 저장 방식으로 테마를 바꿀 수 있게 했다. `userSettingsUtils`는 `siteTheme` 필드를 읽고 쓰도록 확장했고, `index.css`의 서비스 셸 계열 스타일은 CSS 토큰 기반으로 정리해 notebook 테마가 카드, 버튼, 배지, 상단 네비, 모바일 탭바에 일관되게 적용되도록 맞췄다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/contexts/ThemeContext.jsx` (신규)
- `digimon-tamagotchi-frontend/src/utils/userSettingsUtils.js`
- `digimon-tamagotchi-frontend/src/App.jsx`
- `digimon-tamagotchi-frontend/src/App.test.js`
- `digimon-tamagotchi-frontend/src/components/layout/ServiceLayout.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/ServiceLayout.test.jsx` (신규)
- `digimon-tamagotchi-frontend/src/pages/Home.jsx`
- `digimon-tamagotchi-frontend/src/pages/Home.test.jsx` (신규)
- `digimon-tamagotchi-frontend/src/pages/Settings.jsx`
- `digimon-tamagotchi-frontend/src/components/panels/AccountSettingsPanel.jsx`
- `digimon-tamagotchi-frontend/src/components/panels/AccountSettingsPanel.test.jsx` (신규)
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### 아키텍처 메모
- `/notebook`은 별도 콘셉트 랜딩으로 이미 역할이 명확하기 때문에, 전역 테마의 일부로 합치기보다 독립 쇼케이스로 유지하는 편이 구조적으로 더 깔끔하다.
- 로그인 사용자와 게스트의 저장 경로가 다르기 때문에 `user settings > localStorage > default` 우선순위를 `ThemeProvider`에서 강제해 두는 것이 이후 배경/폰트/셸 확장에도 안전하다.

---

## [2026-03-30] `한솔의 노트북 / 파일섬` variant를 별도 랜딩 화면으로 추가

### 작업 유형
- ✨ 홈 랜딩 리디자인
- 🧭 홈 전용 variant 구조 추가
- 🧪 홈 상호작용 테스트 추가

### 목적 및 영향
- **목적:** `/` 홈을 일반 서비스 카드형 랜딩에서 벗어나, `한솔의 노트북` 바탕화면 안에서 `파일 섬 / 폴더 섬 / 추억` 아이콘을 열어 이동하는 세계관형 진입 화면으로 바꾸기.
- **범위:** 기존 `/` 홈은 서비스 카드형 랜딩으로 유지하고, 새 notebook variant는 `/notebook` 라우트에 별도 화면으로 추가한다. `/play`, `/guide`, `/community`, `/me` 등 기존 서비스 페이지 구조는 그대로 둔다. `마지막 열차에서 안녕` 감성은 `추억` 패널 안의 짧은 메모 카드로만 반영하고, 디지바이스 셸 선택과 액정형 몰입 UI는 후속 `/play/:slotId/full` 작업으로 분리한다.
- **내용:** `homeLandingVariants.js`에 `notebook_file_island_v1` 데이터를 추가하고, `NotebookLanding.jsx`를 variant config를 읽는 구조로 구현했다. 노트북 랜딩에는 검은 시스템 바 스타일의 `NotebookTopBar`, OS 아이콘 느낌의 `DesktopIcon`, faux-window 역할의 `LandingWindow`, 메모 카드용 `MemoryNotesPanel`을 도입했다. 비로그인 상태에서는 `파일 섬`에서 로그인과 가이드 CTA를 열고, 로그인 상태에서는 최근 디지몬 이어하기와 플레이 허브 진입을 보여 준다. `폴더 섬`은 가이드/마이/저장 방식 안내를, `추억`은 감성 카피와 메모 카드, 몰입형 UI 티저를 보여 주도록 정리했다. `ServiceLayout`과 `TopNavigation`은 `/notebook`에서만 전용 셸 분기를 타게 변경했고, `index.css`에는 CRT 노이즈, 노을 그라데이션, 아이콘 호버, mobile desktop 축약 레이아웃까지 포함한 notebook 전용 스타일을 추가했다. 동시에 `Home.jsx`는 기존 서비스 홈으로 복원했다. 또한 `NotebookLanding.test.js`를 추가해 비로그인 랜딩, `추억` 패널 전환, 로그인 후 최근 슬롯 이어하기 흐름을 검증했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/components/home/DesktopIcon.jsx` (신규)
- `digimon-tamagotchi-frontend/src/components/home/LandingWindow.jsx` (신규)
- `digimon-tamagotchi-frontend/src/components/home/MemoryNotesPanel.jsx` (신규)
- `digimon-tamagotchi-frontend/src/components/home/NotebookTopBar.jsx` (신규)
- `digimon-tamagotchi-frontend/src/components/layout/ServiceLayout.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/TopNavigation.jsx`
- `digimon-tamagotchi-frontend/src/data/homeLandingVariants.js` (신규)
- `digimon-tamagotchi-frontend/src/index.css`
- `digimon-tamagotchi-frontend/src/pages/Home.jsx`
- `digimon-tamagotchi-frontend/src/pages/NotebookLanding.jsx` (신규)
- `digimon-tamagotchi-frontend/src/pages/NotebookLanding.test.js` (신규)
- `docs/REFACTORING_LOG.md`

### 아키텍처 메모
- notebook variant를 별도 라우트로 분리해 두면, 기본 홈을 안정적으로 유지하면서도 세계관형 랜딩을 계속 실험할 수 있다.
- `NotebookLanding`을 정적 JSX 덩어리 대신 config 기반으로 두면, 이후 `파일섬`, `폴더섬`, `추억`, `디지바이스 셸` 같은 테마를 같은 구조 안에서 교체하거나 확장하기 쉬워진다.

---

## [2026-03-30] `/play` 플로팅 채팅 복구 및 Firestore Rules repo 관리 추가

### 작업 유형
- ✨ `/play` 실시간 채팅 UX 복구
- 🔐 Firestore Rules 기준 파일 추가
- 🧭 PlayHub 모바일 밀도 마무리

### 목적 및 영향
- **목적:** `/play`에서 커뮤니티 채팅을 완전히 없애지 않고, 서비스 셸과 충돌하지 않는 형태로 다시 노출하면서 Firestore 권한 경계도 저장소 기준 파일로 고정하기.
- **범위:** `/community`는 기존 인라인 채팅을 유지하고, `/play`에서는 플로팅 버튼과 드로어로 채팅을 연다. Firestore Rules는 `users/{uid}`와 슬롯/로그 경계를 공식 기준으로 관리하며, 나머지 공유 컬렉션은 기능 회귀를 막기 위한 auth 기반 호환 허용으로 남긴다.
- **내용:** `ChatRoom`에 `variant` 개념을 도입해 인라인/드로어 레이아웃을 공용화하고, `PlayChatButton`, `PlayChatDrawer`를 추가해 `/play`에 우하단 플로팅 채팅 진입점을 복구했다. `AblyContextProvider`는 더 이상 no-client 상태에서 고정 placeholder를 직접 렌더링하지 않고, route-aware wrapper가 `/community` 전용 안내 카드 또는 `/play`용 무노출 정책을 선택하게 바꿨다. 루트에 `firestore.rules`, `firebase.json`, `.firebaserc`를 추가하고, Firebase CLI용 npm script까지 포함해 실제 Rules 배포 절차를 저장소 기준으로 고정했다. `FIRESTORE_RULES.md`, `TROUBLESHOOTING.md`, `README.md`도 같은 절차로 맞췄고, `PlayHub` 카피와 하단 여백도 더 짧고 촘촘하게 다듬어 첫 화면에서 행동 우선 흐름을 강화했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/App.jsx`
- `digimon-tamagotchi-frontend/src/App.test.js`
- `digimon-tamagotchi-frontend/src/components/ChatRoom.jsx`
- `digimon-tamagotchi-frontend/src/components/chat/PlayChatButton.jsx` (신규)
- `digimon-tamagotchi-frontend/src/components/chat/PlayChatDrawer.jsx` (신규)
- `digimon-tamagotchi-frontend/src/contexts/AblyContext.jsx`
- `digimon-tamagotchi-frontend/src/index.css`
- `digimon-tamagotchi-frontend/src/pages/PlayHub.jsx`
- `firestore.rules` (신규)
- `firebase.json` (신규)
- `FIRESTORE_RULES.md`
- `TROUBLESHOOTING.md`
- `README.md`
- `docs/REFACTORING_LOG.md`

### 아키텍처 메모
- `/play`에서 채팅을 항상 인라인으로 붙이면 탭바, 광고, 빈 상태 카드와 경쟁이 심해지므로, unread 신호만 남기는 드로어형 보조 기능으로 분리했다.
- `firestore.rules`는 현재 `users/slots/logs/battleLogs` 경계만을 공식 관리 대상으로 보고, `jogress`/`arena`/`game_settings`는 후속 라운드에서 별도 정책 확정을 전제로 auth-only 호환 규칙으로 유지한다.

---

## [2026-03-30] PlayHub 허브 UX 보강 및 서비스 콘텐츠 데이터 구조 추가

### 작업 유형
- ✨ 서비스 페이지 확장
- 🧭 플레이 허브 UX 보강
- 📝 현재 인증/저장 계약 노출 강화
- 🐛 슬롯 삭제 권한 오류 완화

### 목적 및 영향
- **목적:** `/play` 허브를 단순 슬롯 목록보다 실제 서비스 허브처럼 다듬고, `News/Community/Support`를 데이터형 구조를 가진 페이지로 올리기.
- **범위:** 실제 게임 저장 로직은 그대로 유지하고, 서비스 셸 영역의 정보 구조와 안내 문구를 보강한다. 오프라인 localStorage 슬롯 모드는 이번 라운드에서 복구하지 않고 Firebase 중심 계약을 더 분명히 드러낸다.
- **내용:** `serviceContent.js`를 추가해 소식 카드, 커뮤니티 보드, 지원 FAQ/체크리스트를 정적 데이터 배열로 정리했다. `News`, `Community`, `Support`는 이 구조를 사용해 단순 placeholder 대신 확장 가능한 콘텐츠형 페이지로 바꿨다. `PlayHub`는 최근 디지몬 이어하기, 허브 운영 기준, 관련 페이지 이동을 강화하고 모바일에서 광고 스택을 숨기며, 슬롯이 없을 때는 저신호 설명 카드를 걷어내고 시작 CTA와 핵심 안내만 남기도록 정리했다. 서비스 셸 모바일 패딩도 줄여 첫 화면에서 콘텐츠가 더 빨리 보이게 맞췄다. `Login`에는 현재 저장 계약이 Firestore 중심이라는 안내를 명시적으로 추가했다. 또한 보호 라우트가 nested route의 `Outlet`을 반환하도록 바로잡아 `/play`가 빈 화면처럼 보이던 문제를 해결했다. 이어서 슬롯 삭제 시 `logs`/`battleLogs` 서브컬렉션 정리 권한이 없어도 슬롯 문서 삭제는 계속 진행하도록 완화하고, 새 슬롯 로드 시 현재 슬롯 생성 시각보다 오래된 로그를 걸러 이전 슬롯 잔여 로그가 다시 보이지 않도록 보정했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/data/serviceContent.js` (신규)
- `digimon-tamagotchi-frontend/src/components/layout/RequireAuth.jsx`
- `digimon-tamagotchi-frontend/src/pages/PlayHub.jsx`
- `digimon-tamagotchi-frontend/src/pages/News.jsx`
- `digimon-tamagotchi-frontend/src/pages/Community.jsx`
- `digimon-tamagotchi-frontend/src/pages/Support.jsx`
- `digimon-tamagotchi-frontend/src/pages/Login.jsx`
- `digimon-tamagotchi-frontend/src/index.css`
- `digimon-tamagotchi-frontend/src/App.test.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/utils/firestoreHelpers.js`
- `digimon-tamagotchi-frontend/src/utils/slotLogUtils.js` (신규)
- `digimon-tamagotchi-frontend/src/utils/slotLogUtils.test.js` (신규)
- `docs/REFACTORING_LOG.md`

### 아키텍처 메모
- 현재 코드 기준으로 슬롯 저장 공식 경계는 Firestore이고, localStorage는 UI/개발 설정 성격이 강하다. 그래서 반쯤 남은 dual-storage 인상을 줄이기보다, 서비스 UI에서 현재 계약을 더 명확히 보여 주는 쪽을 우선했다.
- `News/Community/Support`는 아직 백엔드 컬렉션이 없으므로, 먼저 정적 배열 기반 데이터 구조를 고정해 두면 이후 Firestore/Supabase 등 실제 소스로 바꿀 때도 페이지 조립 방식을 크게 건드리지 않아도 된다.

---

## [2026-03-30] 계정 설정·도감·가이드 모달 본문을 공용 패널로 승격

### 작업 유형
- ♻️ 페이지/모달 공용화 리팩토링
- ✨ 서비스 페이지 확장
- 🧪 라우트 스모크 테스트 보강

### 목적 및 영향
- **목적:** `/me/settings`, `/me/collection`, `/guide`가 더 이상 "모달을 억지로 페이지에 올린 화면"이 아니라 실제 서비스 페이지로 동작하도록, 기존 모달 본문을 공용 패널로 분리했다.
- **범위:** 게임 내부에서는 `AccountSettingsModal`, `EncyclopediaModal`, `DigimonInfoModal` 호출 계약을 그대로 유지하고, 서비스 라우트에서는 같은 본문을 페이지 카드 안에서 직접 렌더링한다. `News/Community/Support`는 이번 라운드에서 데이터 계층을 붙이지 않고 정적 페이지 상태를 유지한다.
- **내용:** `AccountSettingsPanel`, `EncyclopediaPanel`, `DigimonGuidePanel`을 추가해 기존 모달 내부 상태와 본문 UI를 패널 컴포넌트로 옮겼다. 설정 패널은 테이머명 저장/기본값 복구 후 `window.location.reload()`를 제거하고, `useTamerProfile`의 전역 refresh 이벤트(`d2:tamer-profile-refresh`)를 통해 서비스 셸과 게임 화면의 테이머명 표시를 즉시 동기화하도록 바꿨다. `Settings`, `Collection`, `Guide` 페이지는 이제 모달을 직접 렌더링하지 않고 패널을 서비스 카드 안에 배치하며, `Settings`에는 페이지형 로그아웃 확인 흐름을 별도로 추가했다. `Me`의 빠른 메뉴 카피도 페이지형 동선에 맞게 조정했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/components/AccountSettingsModal.jsx`
- `digimon-tamagotchi-frontend/src/components/EncyclopediaModal.jsx`
- `digimon-tamagotchi-frontend/src/components/DigimonInfoModal.jsx`
- `digimon-tamagotchi-frontend/src/components/panels/AccountSettingsPanel.jsx` (신규)
- `digimon-tamagotchi-frontend/src/components/panels/EncyclopediaPanel.jsx` (신규)
- `digimon-tamagotchi-frontend/src/components/panels/DigimonGuidePanel.jsx` (신규)
- `digimon-tamagotchi-frontend/src/hooks/useTamerProfile.js`
- `digimon-tamagotchi-frontend/src/pages/Settings.jsx`
- `digimon-tamagotchi-frontend/src/pages/Collection.jsx`
- `digimon-tamagotchi-frontend/src/pages/Guide.jsx`
- `digimon-tamagotchi-frontend/src/pages/Me.jsx`
- `digimon-tamagotchi-frontend/src/App.test.js`
- `docs/REFACTORING_LOG.md`

### 아키텍처 메모
- 모달과 페이지의 차이는 바깥 프레임과 닫기/뒤로 동선에만 두고, 실제 본문 로직은 패널에 집중시켰다. 이 구조면 이후 `Collection` 상세 확장이나 `Guide` 탭 재배치도 모달/페이지를 따로 수정하지 않아도 된다.
- `useTamerProfile`는 Context가 아니라 각 호출 지점마다 독립 상태를 가지므로, 설정 저장 후 헤더와 게임 화면을 함께 갱신하려면 강제 새로고침 대신 브로드캐스트형 refresh 이벤트가 필요했다.

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

## 서비스 셸 라우팅 및 플레이 허브 구조 도입

### 변경 내용
- `App` 라우트를 서비스 셸 기준으로 재구성해 `/`, `/auth`, `/play`, `/play/:slotId`, `/play/:slotId/full`, `/me`, `/guide`, `/news`, `/community`, `/support` 흐름을 연결했다.
- `ServiceLayout`, `TopNavigation`, `MobileTabBar`, `RequireAuth`를 추가해 홈/허브/마이/커뮤니티 페이지에 공통 셸을 적용했다.
- `useTamerProfile`, `useUserSlots`, `PlayHub`, `SlotCard`, `NewDigimonModal`, `SlotOrderModal`을 추가해 기존 `SelectScreen`의 슬롯 관리 책임을 새 허브 구조로 옮겼다.
- `SelectScreen`은 레거시 `/select` 리다이렉트 전용으로 축소했고, `/game/:slotId`도 새 `/play/:slotId` 흐름으로 리다이렉트되게 맞췄다.
- `Game`에 몰입형 경로(`/play/:slotId/full`) 분기와 새 플레이 허브 네비게이션을 보강했다.
- `Home`, `Me`, `Guide`, `Collection`, `Settings`, `News`, `Community`, `Support` 페이지를 추가해 서비스형 정보 구조를 확장했다.
- `App.test.js`를 갱신해 홈, 보호 라우트, 레거시 리다이렉트 스모크 테스트를 추가했다.

### 영향 파일
- `digimon-tamagotchi-frontend/src/App.jsx`
- `digimon-tamagotchi-frontend/src/App.test.js`
- `digimon-tamagotchi-frontend/src/index.css`
- `digimon-tamagotchi-frontend/src/hooks/useTamerProfile.js`
- `digimon-tamagotchi-frontend/src/hooks/useUserSlots.js`
- `digimon-tamagotchi-frontend/src/components/layout/ServiceLayout.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/TopNavigation.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/MobileTabBar.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/RequireAuth.jsx`
- `digimon-tamagotchi-frontend/src/components/play/SlotCard.jsx`
- `digimon-tamagotchi-frontend/src/components/play/NewDigimonModal.jsx`
- `digimon-tamagotchi-frontend/src/components/play/SlotOrderModal.jsx`
- `digimon-tamagotchi-frontend/src/pages/Home.jsx`
- `digimon-tamagotchi-frontend/src/pages/Login.jsx`
- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
- `digimon-tamagotchi-frontend/src/pages/PlayHub.jsx`
- `digimon-tamagotchi-frontend/src/pages/PlayFull.jsx`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/pages/Me.jsx`
- `digimon-tamagotchi-frontend/src/pages/Collection.jsx`
- `digimon-tamagotchi-frontend/src/pages/Settings.jsx`
- `digimon-tamagotchi-frontend/src/pages/Guide.jsx`
- `digimon-tamagotchi-frontend/src/pages/News.jsx`
- `digimon-tamagotchi-frontend/src/pages/Community.jsx`
- `digimon-tamagotchi-frontend/src/pages/Support.jsx`
- `digimon-tamagotchi-frontend/src/utils/slotViewUtils.js`
- `docs/REFACTORING_LOG.md`

### 근거
- 기존 구조는 `/`, `/select`, `/game/:slotId` 중심이라 서비스형 홈/허브/마이 흐름을 붙이기 어려웠고, `SelectScreen`이 슬롯 데이터/프로필/설정/UI를 모두 한 파일에 품고 있었다.
- 이번 개편의 목적은 게임 코어를 전면 재작성하지 않고도 서비스 셸과 플레이 허브를 먼저 세워, 라우트 확장과 페이지 추가를 안전하게 진행할 수 있는 기반을 만드는 데 있었다.
- 레거시 경로는 유지하되 새 구조로 자연스럽게 흘러가게 만들어 기존 북마크나 진입 습관을 깨지 않도록 했다.

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

# 2026-03-30

## PlayHub UX 보강 및 서비스 셸 정적 데이터 구조 추가

### 변경 내용
- `PlayHub`에 최근 이어하기 카드, 허브 운영 기준, 관련 페이지 이동 카드 구성을 보강하고 모바일에서는 광고 스택을 숨기도록 정리했다.
- `News`, `Community`, `Support`를 단순 placeholder 문구 대신 로컬 구조화 데이터(`serviceShellContent`) 기반 페이지로 바꿨다.
- 지원 페이지에 현재 인증/저장 계약을 반영해, 게스트 로그인도 Firebase 익명 계정 기반이며 localStorage 전용 오프라인 슬롯 모드는 현재 공식 계약이 아니라는 점을 명시했다.
- 실시간 채팅 컨테이너를 서비스 셸 폭에 맞추고, 모바일 하단 탭과 겹치지 않도록 하단 여백과 채팅 박스 높이를 조정했다.

### 영향 파일
- `digimon-tamagotchi-frontend/src/pages/PlayHub.jsx`
- `digimon-tamagotchi-frontend/src/pages/News.jsx`
- `digimon-tamagotchi-frontend/src/pages/Community.jsx`
- `digimon-tamagotchi-frontend/src/pages/Support.jsx`
- `digimon-tamagotchi-frontend/src/data/serviceShellContent.js`
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### 근거
- 플레이 허브는 라우트만 정리된 상태보다 `최근 이어하기`, `정렬 기준`, `관련 페이지 이동`이 함께 보일 때 실제 서비스 화면으로서 이해가 빨랐다.
- `News/Community/Support`는 아직 백엔드 컬렉션이 없기 때문에, 우선 로컬 구조화 데이터로 페이지 모양과 필요한 필드 형태를 먼저 고정하는 편이 다음 단계 연결에 유리했다.
- localStorage 오프라인 슬롯 모드는 현재 문서와 달리 런타임 계약에서 이미 빠져 있으므로, 이번 라운드에서는 무리하게 부활시키기보다 로그인 중심 구조를 명시적으로 드러내는 쪽이 더 안전했다.

## 모달 본문 패널 분리 및 서비스 페이지 승격

### 변경 내용
- `계정 설정`, `도감`, `디지몬 가이드`의 실제 본문을 각각 `AccountSettingsPanel`, `EncyclopediaPanel`, `DigimonGuidePanel`로 분리했다.
- 기존 `AccountSettingsModal`, `EncyclopediaModal`, `DigimonInfoModal`은 오버레이와 프레임만 담당하는 얇은 래퍼로 정리하고, 내부 본문은 공용 패널을 렌더링하도록 바꿨다.
- `/me/settings`, `/me/collection`, `/guide` 페이지가 더 이상 “페이지 안에 모달”을 그대로 띄우지 않고, 서비스 페이지 안에서 공용 패널을 직접 렌더링하도록 바꿨다.
- `AccountSettingsPanel`에서 테이머명 저장/기본값 복구 후 `window.location.reload()`를 제거하고, `useTamerProfile` 갱신 이벤트와 부모 상태 동기화로 즉시 반영되게 바꿨다.
- `Me`의 빠른 메뉴 카피를 페이지형 동선에 맞게 다듬고, `App.test.js`에 가이드/도감/설정 페이지 스모크 기대값을 추가했다.

### 영향 파일
- `digimon-tamagotchi-frontend/src/components/AccountSettingsModal.jsx`
- `digimon-tamagotchi-frontend/src/components/EncyclopediaModal.jsx`
- `digimon-tamagotchi-frontend/src/components/DigimonInfoModal.jsx`
- `digimon-tamagotchi-frontend/src/components/panels/AccountSettingsPanel.jsx`
- `digimon-tamagotchi-frontend/src/components/panels/EncyclopediaPanel.jsx`
- `digimon-tamagotchi-frontend/src/components/panels/DigimonGuidePanel.jsx`
- `digimon-tamagotchi-frontend/src/hooks/useTamerProfile.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/pages/Settings.jsx`
- `digimon-tamagotchi-frontend/src/pages/Collection.jsx`
- `digimon-tamagotchi-frontend/src/pages/Guide.jsx`
- `digimon-tamagotchi-frontend/src/pages/Me.jsx`
- `digimon-tamagotchi-frontend/src/App.test.js`
- `docs/REFACTORING_LOG.md`

### 근거
- 1차 서비스 셸 라우팅 이후 `Collection`, `Settings`, `Guide`는 페이지 경로를 가졌지만 실제로는 모달 컴포넌트를 그대로 렌더링하고 있어서, 페이지 경험과 재사용 구조가 모두 어정쩡한 상태였다.
- 게임 내 모달 동작은 유지하면서 서비스 페이지 품질을 올리려면, 모달을 없애기보다 “본문만 공용 패널로 분리”하는 쪽이 회귀 위험이 가장 낮았다.
- 특히 계정 설정은 저장 후 전체 새로고침에 의존하고 있었기 때문에, 페이지 전환 이후에는 `useTamerProfile` 기준 갱신 이벤트와 부모 상태 동기화가 더 자연스러운 구조였다.

# 2026-03-30

## Home ↔ Notebook 전역 이동 동선 추가

### 변경 내용
- 상단 전역 네비에 `노트북` 항목을 추가해 `/`와 `/notebook`을 같은 레벨의 진입점처럼 오갈 수 있게 했다.
- 모바일 하단 탭바를 5탭 구조로 확장하고 `노트북` 탭을 추가했다.
- 비로그인 홈 히어로의 보조 CTA를 `노트북 열기`로 바꾸고, 로그인 홈 `빠른 이동` 카드에도 노트북 진입 카드를 추가했다.
- 노트북 전용 상단 바에 `HOME:// RETURN` 링크를 추가하고, 하단 taskbar의 `HANSOL_NOTEBOOK` 라벨도 홈 복귀 링크로 연결했다.
- 전역 링크 노출 이후에도 한 줄 레이아웃이 유지되도록 탑네비/탭바 폰트와 간격을 소폭 조정하고, 관련 테스트를 추가했다.

### 영향 파일
- `digimon-tamagotchi-frontend/src/components/layout/TopNavigation.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/MobileTabBar.jsx`
- `digimon-tamagotchi-frontend/src/components/home/NotebookTopBar.jsx`
- `digimon-tamagotchi-frontend/src/pages/Home.jsx`
- `digimon-tamagotchi-frontend/src/pages/NotebookLanding.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/NavigationLinks.test.jsx`
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### 근거
- 사용자는 기존 서비스 홈과 노트북 랜딩을 번갈아 보며 비교/조정하고 있었고, 양쪽을 매번 URL 입력이나 뒤로가기로 오가는 대신 전역 동선 안에서 바로 왕복하길 원했다.
- 노트북 랜딩이 더 이상 숨겨진 실험 화면이 아니라 별도 콘셉트 랜딩으로 자리 잡았기 때문에, 데스크톱과 모바일 모두에서 명시적으로 접근 가능한 링크를 두는 편이 구조 이해와 반복 피드백에 유리했다.

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

# 2026-03-31

## 모바일 몰입형 상단 바 겹침 보정

### 변경 내용
- `Game`의 몰입형(`/play/:slotId/full`) 상단 버튼 묶음을 `ImmersiveGameTopBar`로 분리해 모바일 전용 레이아웃과 데스크톱 레이아웃을 분기했다.
- 모바일 몰입형 상단 바에 safe-area 상단 여백, 반투명 배경, 하단 경계선, 그림자를 추가해 게임 정보 영역과 시각적으로 구분되게 맞췄다.
- 슬롯 제목/메타 영역은 기존 `pt-8` 하드코딩 대신 `game-page-header` 계열 클래스를 사용하도록 바꿔, 모바일 몰입형일 때 상단 바 높이만큼 본문 시작 위치를 충분히 확보했다.
- `ImmersiveGameTopBar.test.jsx`를 추가해 모바일 전용 상단 바가 버튼과 이동 핸들러를 정상 렌더링하는지 고정했다.

### 영향 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/ImmersiveGameTopBar.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/ImmersiveGameTopBar.test.jsx`
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### 근거
- 몰입형 화면에서 상단 바가 `fixed`로 떠 있는 반면, 모바일 본문 헤더는 낮은 상단 패딩만 사용하고 있어 `슬롯 n - 디지몬명` 제목이 버튼 영역과 겹치는 현상이 재현되었다.
- 이 문제는 단순 경계선 추가만으로는 해결되지 않고, 모바일 몰입형 상단 바 높이와 iPhone safe-area를 반영한 본문 오프셋이 함께 필요했다.
- 데스크톱 몰입형과 일반 게임 화면 동작은 유지해야 했기 때문에, 모바일 몰입형 분기만 국소적으로 분리하는 쪽이 가장 안전한 수정 범위였다.

# 2026-03-31

## 모바일 아이콘 메뉴 세로 밀도 압축

### 변경 내용
- `ControlPanel`의 모바일 메뉴 래퍼가 내부 메뉴 그리드와 같은 `menu-icon-buttons-mobile` 클래스를 중복으로 쓰던 구조를 정리해, 바깥 래퍼에 의한 추가 패딩/그리드 간섭을 제거했다.
- `IconButton`에 모바일 분기를 명시적으로 전달하고, 모바일에서는 `box-sizing: border-box` 기준의 실제 높이와 패딩을 사용하도록 바꿔 아이콘 버튼 외곽 높이가 의도보다 커지지 않게 맞췄다.
- 모바일 아이콘 메뉴의 세로 밀도를 위해 `control-panel-mobile` 간격, `menu-icon-buttons-mobile` gap, 내부 세로 padding, 모바일 버튼 padding을 한 단계씩 줄였다.
- `IconButton.test.jsx`를 추가해 모바일 아이콘 버튼이 컴팩트한 높이와 `border-box` 기준을 유지하는지 고정했다.

### 영향 파일
- `digimon-tamagotchi-frontend/src/components/ControlPanel.jsx`
- `digimon-tamagotchi-frontend/src/components/IconButton.jsx`
- `digimon-tamagotchi-frontend/src/components/MenuIconButtons.jsx`
- `digimon-tamagotchi-frontend/src/components/IconButton.test.jsx`
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### 근거
- 아이콘 그리드는 이미 4열 고정이라 좌우 정렬은 안정적이었지만, 모바일에서 버튼 자체가 `content-box`처럼 커지고 외곽 래퍼까지 같은 그리드 클래스를 공유하면서 실제 세로 점유가 과하게 넓어져 있었다.
- 12 Pro와 14 Pro 차이는 기기 자체보다 브라우저 UI 노출과 상단 콘텐츠 높이 영향이 더 커 보였기 때문에, 레이아웃 구조를 바꾸기보다 세로 밀도만 소폭 압축하는 쪽이 더 안전했다.
- 터치 영역은 44px 이상을 유지하면서도 `스탯`, `식사`, `교감`, `호출`, `추가기능`까지 더 빨리 한눈에 들어오도록 하는 것이 이번 조정의 핵심이었다.

# 2026-03-31

## 기본 화면 모바일 헤더 제목 가림 보정

### 변경 내용
- `Game`의 기본 화면 모바일 경로에 `game-page-header--default-mobile` 클래스를 별도로 붙여, 일반 모바일 상단 바 높이를 본문 헤더 spacing에 반영하도록 분리했다.
- 모바일 기본 화면 헤더는 `safe-area-inset-top`을 포함한 더 큰 상단 패딩을 사용하도록 조정해 `슬롯 n - 디지몬명` 제목이 2단 고정 상단 바 아래에서 시작되게 맞췄다.

### 영향 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### 근거
- 일반 모바일 기본 화면은 상단 고정 바 안에 버튼 행과 `테이머/칭호` 행이 함께 들어가는데, 본문 헤더는 기존 `80px` 기준만 사용하고 있어 `슬롯 1 - 깜몬` 제목이 상단 바 아래에 일부 가려지는 현상이 재현되었다.
- 몰입형 화면과 기본 화면의 상단 바 높이가 다르기 때문에, 기본 화면 모바일에만 별도 오프셋을 주는 쪽이 가장 작은 수정 범위였다.

## [2026-03-31] 서비스 상단 CTA를 테이머명 계정 드롭다운으로 전환

### 작업 유형
- ✨ 서비스 헤더 계정 접근 UX 개선
- 🧪 상단 네비 드롭다운 테스트 보강

### 목적 및 영향
- **목적:** 상단 우측의 `내 디지몬 보기` CTA를 사용자의 테이머명으로 바꾸고, 클릭했을 때 바로 `계정설정`과 `로그아웃` 메뉴가 아래로 열리도록 만들어 계정 관련 동선을 더 짧게 만들기.
- **범위:** 일반 서비스 셸의 `TopNavigation`만 바뀌며, 플레이 링크 자체는 기존 네비 탭에서 계속 접근할 수 있다. 노트북 전용 상단 바와 게임 내부 상단 UI는 이번 변경 범위에 포함되지 않는다.
- **내용:** `TopNavigation`이 `useTamerProfile()`에서 가져온 표시용 테이머명을 우선 사용하도록 연결하고, 로그인 상태에서는 pill 링크 대신 계정 드롭다운 버튼을 렌더링하게 바꿨다. 버튼 클릭 시 아래에 `계정설정`, `로그아웃` 메뉴가 열리고, 메뉴는 바깥 영역 클릭, 라우트 변경, `Escape` 입력 시 닫히도록 정리했다. `계정설정`은 `/me/settings`, `로그아웃`은 기존 auth context의 `logout()` 후 `/auth` 이동으로 연결했다. 관련 테스트도 새 헤더 계약에 맞게 갱신했다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/components/layout/TopNavigation.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/NavigationLinks.test.jsx`
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### 아키텍처 메모
- 플레이 진입 CTA와 계정 관리 CTA는 성격이 다르기 때문에, 상단 우측의 단일 버튼이 `내 디지몬 보기`로 남아 있으면 설정/로그아웃 접근이 한 단계 더 깊어지는 문제가 있었다.
- 서비스 셸 전역에서 이미 `useTamerProfile`을 기준으로 사용자 표시명을 맞추고 있으므로, 상단 계정 버튼도 같은 테이머명 소스를 우선 사용하도록 맞추는 편이 일관성과 기대 동작 모두에 더 적합하다.

# 2026-03-31

## 게임 헤더 메타 정보 접기/펼치기 추가

### 변경 내용
- `Game` 헤더의 `슬롯 이름`, `기종`, `현재 시간` 3줄을 `GameHeaderMeta` 컴포넌트로 분리하고, 제목 아래에서만 접기/펼치기 할 수 있도록 정리했다.
- 헤더 메타 정보는 전역 UI 선호값인 `game_header_info_collapsed` 키를 통해 `localStorage`에 저장되며, 기본값은 모든 환경에서 접힘 상태로 시작하도록 맞췄다.
- `GameHeaderMeta.test.jsx`를 추가해 기본 접힘 상태, 토글 동작, 새로고침 이후에도 마지막 상태가 유지되는 흐름을 고정했다.
- 상태 하트와 상태 배지는 기존 위치를 유지해 메타 정보 접힘 여부와 무관하게 계속 보이도록 유지했다.

### 영향 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/GameHeaderMeta.jsx`
- `digimon-tamagotchi-frontend/src/components/GameHeaderMeta.test.jsx`
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### 근거
- 모바일과 기본 화면 모두에서 헤더 메타 정보가 늘 펼쳐져 있으면 상단 정보 밀도가 높아져 게임 화면 진입 직후 핵심 영역이 아래로 밀리는 문제가 있었다.
- 사용자가 자주 보는 정보는 슬롯 제목과 상태 영역이므로, 접기 대상은 제목 아래의 메타 3줄로만 제한하고 나머지 HUD는 항상 유지하는 편이 정보 위계를 더 명확하게 만든다.
- 마지막 접힘 상태를 전역 UI 선호값으로 저장하면 슬롯을 바꾸거나 새로고침해도 사용자가 다시 매번 접을 필요가 없어 반복 조작을 줄일 수 있다.

## [2026-03-31] 메인 빌드를 깨는 수면 케어 함수 참조 제거

### 작업 유형
- 🐛 프로덕션 빌드 복구

### 목적 및 영향
- **목적:** `main`에 반영된 `Game.jsx`가 아직 커밋되지 않은 `applyTiredCareMistake` 함수를 import 하면서 Vercel 프로덕션 빌드가 실패하던 문제를 즉시 복구하기.
- **범위:** 이번 수정은 `Game.jsx`의 미완성 수면 케어 함수 참조만 제거하며, 실제 수면 케어 로직 WIP는 별도 작업 브랜치에서 계속 분리 유지한다.
- **내용:** `Game.jsx`에서 `applyTiredCareMistake` import 와 호출을 제거해, 현재 `main`에 존재하는 `useGameLogic` 공개 API와 코드가 다시 일치하도록 맞췄다.

### 영향 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `docs/REFACTORING_LOG.md`

### 근거
- 수면 케어 로직 자체는 아직 별도 WIP 변경으로만 존재하고 있었는데, 그 일부 참조만 먼저 `main`에 들어가면서 빌드 단계에서 import error가 발생했다.
- 미완성 기능 전체를 급히 함께 올리는 것보다, `main`에서 그 참조만 제거해 배포를 정상화하는 쪽이 더 안전하다.

## [2026-03-31] 비로그인 랜딩/히어로 페이지 추가

### 작업 유형
- ✨ 퍼블릭 첫 진입 UX 신설
- 🧭 라우팅/내비게이션 진입 경로 정리

### 목적 및 영향
- **목적:** 로그인 전에도 서비스 첫인상과 주요 흐름을 보여줄 수 있는 전용 랜딩/히어로 페이지를 추가하고, 퍼블릭 진입 동선을 `랜딩 → 로그인/노트북/가이드` 흐름으로 정리하기.
- **범위:** 새 `/landing` 공개 경로, 비로그인 루트 리다이렉트, 상단/모바일 홈 링크 타겟 조정, 기존 `Home`의 역할을 로그인 홈 중심으로 단순화하는 변경이 포함된다.
- **내용:** `Landing` 페이지를 추가해 감성 + 전환 혼합형 히어로, 공개 탐색 카드, 로그인 후 기능 소개, 하단 재전환 CTA를 구성했다. `/`는 비로그인 시 `/landing`으로, 로그인 시 기존 `Home`으로 분기되도록 변경했고, 비로그인 상태의 브랜드/홈 링크와 모바일 홈 탭은 `/landing`을 가리키도록 맞췄다. 공개 테마 전환 기능도 `Home`에서 `Landing`으로 옮겨 비로그인 상태에서 계속 사용할 수 있게 유지했다.

### 영향 파일
- `digimon-tamagotchi-frontend/src/App.jsx`
- `digimon-tamagotchi-frontend/src/pages/Landing.jsx`
- `digimon-tamagotchi-frontend/src/pages/Home.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/TopNavigation.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/MobileTabBar.jsx`
- `digimon-tamagotchi-frontend/src/index.css`
- `digimon-tamagotchi-frontend/src/App.test.js`
- `digimon-tamagotchi-frontend/src/pages/Home.test.jsx`
- `digimon-tamagotchi-frontend/src/pages/Landing.test.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/NavigationLinks.test.jsx`
- `docs/REFACTORING_LOG.md`

### 근거
- 기존 `/`는 비로그인 홈과 로그인 홈이 한 파일 안에서 섞여 있어 첫 화면을 확장할수록 개인화 홈까지 같이 복잡해지는 구조였다.
- 전용 `/landing`을 두면 퍼블릭 메시지와 로그인 후 홈의 책임이 분리되어, 랜딩은 감성과 전환에 집중하고 `Home`은 플레이 허브/최근 슬롯 중심의 개인화 홈으로 유지하기 쉽다.
- 비로그인 상태의 홈 링크가 그대로 `/`를 가리키면 랜딩에서 활성 상태와 실제 도착 경로가 어긋나므로, 퍼블릭 네비게이션은 `/landing`을 직접 가리키는 편이 더 자연스럽다.

## [2026-04-01] 랜딩 재진입 허용과 노트북 상단 메뉴 보강

### 작업 유형
- 🧭 로그인 상태 랜딩 재진입 허용
- 📚 노트북 상단 빠른 메뉴 추가

### 목적 및 영향
- **목적:** 로그인 이후에도 랜딩을 다시 볼 수 있게 하고, 노트북 상단 바 오른쪽에서 `랜딩`, `가이드`, `커뮤니티`, `소식`으로 바로 이동할 수 있게 만들기.
- **범위:** `/landing` 진입 가드, 랜딩 CTA 문구, 일반 서비스 상단 네비의 `랜딩` 메뉴, 노트북 상단 바 메뉴와 모바일 배치가 함께 조정된다.
- **내용:** `LandingEntry`의 로그인 리다이렉트를 제거해 로그인 상태에서도 `/landing`을 그대로 열 수 있게 바꿨다. 랜딩 페이지는 로그인 상태일 때 `플레이 허브 열기`, `내 홈으로 돌아가기` CTA를 보여주도록 정리했고, 일반 서비스 상단 네비에는 로그인 사용자에게만 `랜딩` 메뉴를 추가했다. 노트북 상단 바에는 `랜딩`, `가이드`, `커뮤니티`, `소식` 빠른 메뉴를 추가하고, 모바일에서는 가로 스크롤 가능한 한 줄 메뉴로 노출되게 조정했다.

### 영향 파일
- `digimon-tamagotchi-frontend/src/App.jsx`
- `digimon-tamagotchi-frontend/src/App.test.js`
- `digimon-tamagotchi-frontend/src/pages/Landing.jsx`
- `digimon-tamagotchi-frontend/src/pages/Landing.test.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/TopNavigation.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/NavigationLinks.test.jsx`
- `digimon-tamagotchi-frontend/src/components/home/NotebookTopBar.jsx`
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### 근거
- 랜딩이 공개 소개 페이지 역할을 한다면 로그인 이후에도 다시 돌아와 공개 탐색 링크를 사용하는 흐름이 자연스럽다.
- 노트북 경로는 일반 서비스 헤더를 쓰지 않기 때문에, `노트북 오른쪽 메뉴` 요청을 반영하려면 노트북 전용 상단 바에 직접 빠른 메뉴를 넣는 편이 가장 일관된다.

## [2026-04-01] `랜딩` UI 이름을 `둘러보기`로 정리

### 작업 유형
- ✏️ 퍼블릭 탐색 페이지 네이밍 정리

### 목적 및 영향
- **목적:** 로그인 이후에도 다시 열 수 있는 `/landing` 페이지의 성격이 더 잘 드러나도록, 사용자에게 보이는 이름을 `랜딩` 대신 `둘러보기`로 바꾸기.
- **범위:** 경로(`/landing`)는 유지하고, 메뉴/페이지 표기와 관련 테스트만 `둘러보기` 기준으로 조정한다.
- **내용:** 일반 서비스 상단 네비, 노트북 상단 빠른 메뉴, 둘러보기 페이지 내부 레이블과 안내 문구를 `둘러보기`로 통일했다.

### 영향 파일
- `digimon-tamagotchi-frontend/src/components/layout/TopNavigation.jsx`
- `digimon-tamagotchi-frontend/src/components/home/NotebookTopBar.jsx`
- `digimon-tamagotchi-frontend/src/pages/Landing.jsx`
- `digimon-tamagotchi-frontend/src/pages/Landing.test.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/NavigationLinks.test.jsx`
- `docs/REFACTORING_LOG.md`

### 근거
- `/landing`은 구현용 이름이지만, 실제 사용자 입장에서는 이 페이지가 서비스와 공개 콘텐츠를 먼저 보는 `둘러보기` 허브에 가깝다.
- 로그인 이후에도 다시 들어올 수 있는 페이지라면 기능 중심 이름인 `둘러보기`가 더 자연스럽다.

## [2026-04-01] Supabase 기반 커뮤니티 `내 디지몬 자랑` MVP 구현

### 작업 유형
- ✨ 커뮤니티 실데이터 MVP 추가
- 🧱 Vercel API + Supabase 서버 브리지 도입
- 🧪 커뮤니티 UI/API 테스트 보강

### 목적 및 영향
- **목적:** `/community`를 플레이스홀더에서 실제로 글 작성과 댓글이 가능한 1차 커뮤니티 피드로 올리고, 커뮤니티 데이터는 Supabase로 분리하되 슬롯 원본 데이터는 계속 Firestore에서 읽도록 구조를 확정하기.
- **범위:** Vercel API 라우트, Firebase Admin 인증 검증, Supabase CRUD 헬퍼, 커뮤니티 공개/로그인 2모드 UI, 슬롯 스냅샷 미리보기, 샘플 공개 글, SQL 스키마 문서와 테스트가 함께 포함된다.
- **내용:** 로그인 사용자는 `내 디지몬 자랑` 보드에서 자신의 슬롯을 골라 글을 만들고 댓글을 남길 수 있게 바꿨다. 게시글 생성 시 클라이언트는 `slotId`, `title`, `body`만 보내고, 서버가 Firebase ID 토큰을 검증한 뒤 `users/{uid}/slots/{slotId}`를 다시 읽어 스냅샷을 만든다. 실제 게시글/댓글 저장은 Supabase `community_posts`, `community_post_comments` 테이블로 처리하고, 비로그인 상태의 `/community`는 샘플 공개 글만 보여주도록 분리했다. `진화 노트`, `조그레스 모집` 카드는 아직 안내 카드 상태로 유지한다.

### 영향 파일
- `package.json`
- `package-lock.json`
- `api/_lib/http.js`
- `api/_lib/community.js`
- `api/_lib/firebaseAdmin.js`
- `api/_lib/supabaseAdmin.js`
- `api/_lib/communityStore.js`
- `api/_lib/communityHandlers.js`
- `api/_lib/community.test.js`
- `api/_lib/communityHandlers.test.js`
- `api/community/showcase/posts/index.js`
- `api/community/showcase/posts/[postId].js`
- `api/community/showcase/posts/[postId]/comments/index.js`
- `api/community/showcase/comments/[commentId].js`
- `digimon-tamagotchi-frontend/src/pages/Community.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunityPostComposer.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunityPostCard.jsx`
- `digimon-tamagotchi-frontend/src/utils/communityApi.js`
- `digimon-tamagotchi-frontend/src/utils/communitySnapshotUtils.js`
- `digimon-tamagotchi-frontend/src/utils/communitySnapshotUtils.test.js`
- `digimon-tamagotchi-frontend/src/pages/Community.test.jsx`
- `digimon-tamagotchi-frontend/src/data/serviceContent.js`
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/SUPABASE_COMMUNITY_SCHEMA.sql`
- `docs/REFACTORING_LOG.md`

### 근거
- 커뮤니티는 게시글/댓글 조회와 정렬이 많아질수록 Firestore 단독 운용보다 Postgres 계열이 장기적으로 관리하기 쉬우므로, 커뮤니티만 Supabase 축으로 분리하는 편이 확장성 면에서 유리하다.
- 반대로 게임 상태와 슬롯은 이미 Firestore `users/{uid}/slots/{slotId}`를 source of truth로 사용하고 있으므로, 게시 시점 스냅샷도 서버에서 Firestore를 다시 읽어 생성해야 클라이언트 조작을 막고 데이터 일관성을 유지할 수 있다.
- 실제 유저 커뮤니티를 공개 읽기로 바로 열기보다, 1차에서는 비로그인 사용자에게 샘플 공개 글만 보여주고 실데이터는 로그인 후에만 보이게 두는 편이 운영 리스크와 어뷰징 대응 면에서 더 안전하다.
## 2026-04-01

### Firestore 활동 로그 저장 정책 축소로 반복 write 1차 절감

- `useGameData.appendLogToSubcollection()`에 Firestore 영구 저장 정책을 추가해, 반복성 높은 일반 액션 로그는 더 이상 `logs` 서브컬렉션에 쓰지 않도록 정리했다.
- 이번 1차 절감에서는 `FEED`, `TRAIN`, `CLEAN`, `ACTION`, `DIET`, `REST`, `DETOX`, `PLAY_OR_SNACK`처럼 사용자가 자주 발생시키는 일반 활동 로그를 세션 메모리에서만 유지하고, `CALL`, `CAREMISTAKE`, `SLEEP_DISTURBANCE`, `POOP`, `HEAL`, `EVOLUTION`, `DEATH`, `FRIDGE` 등 핵심 이력만 Firestore에 남기도록 고정했다.
- 이로써 슬롯 상태 저장 write는 유지하되, 활동 로그 서브컬렉션 addDoc 빈도를 가장 잦은 일반 상호작용 구간에서 바로 줄일 수 있게 됐다.
- 정책은 별도 순수 유틸로 분리해 테스트 가능하게 만들었고, 이후 2차 단계에서 `arena_battle_logs`·`jogress_logs`의 Supabase 이관 여부를 같은 기준으로 확장할 수 있게 했다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/utils/activityLogPersistence.js`
- `digimon-tamagotchi-frontend/src/utils/activityLogPersistence.test.js`
- `docs/REFACTORING_LOG.md`

### 아레나/조그레스 로그 Supabase archive 2차 이관 경로 추가

- `arena_battle_logs`와 `jogress_logs`를 한 번에 떼어내지 않고, 먼저 `Supabase archive`로 병행 저장하는 2차 이관 경로를 추가했다.
- 프론트에는 `logArchiveApi`를 추가해 `Firebase ID 토큰 -> Vercel API` 경로로 아카이브를 기록하고 조회하게 했고, 아레나 배틀 저장 시 `archiveId`를 클라이언트에서 먼저 만들어 Firestore 요약 로그와 Supabase 상세 로그가 같은 키를 공유하게 맞췄다.
- 아레나 배틀은 아직 검증 단계라 Firestore `arena_battle_logs.logs`를 유지하면서 Supabase에도 `replayLogs`를 같이 저장하는 dual-write로 두었고, `ArenaScreen`의 다시보기는 `archiveId`가 있으면 API를 우선 조회하고 실패 시 기존 Firestore 상세 로그로 fallback 하도록 바꿨다.
- 조그레스는 읽는 UI가 없으므로 `jogress_logs`도 `archiveId`를 공유해 Firestore + Supabase dual-write를 붙였고, 이후 검증이 끝나면 Firestore 쓰기를 끊을 수 있게 helper로 경로를 묶었다.
- 서버 쪽은 기존 커뮤니티 패턴을 재사용해 `Firebase 인증 -> Vercel API -> Supabase service-role` 구조의 로그 archive 핸들러와 SQL migration을 추가했다.
- 추가 확인 결과, Vercel `rootDirectory`가 `digimon-tamagotchi-frontend`라서 새 `/api/logs/*` 엔드포인트가 루트 `api/`에만 있으면 실제 배포에 포함되지 않을 수 있었다. 이를 막기 위해 배포용 source-of-truth를 `digimon-tamagotchi-frontend/api/logs/...`와 `digimon-tamagotchi-frontend/api/_lib/logArchive*.js`로 편입시키고, 루트 `api/` 경로는 테스트 호환용 shim으로 정리했다.
- 후속 운영 점검에서 POST 엔드포인트 두 개가 `_lib` 상대 경로를 한 단계 더 잘못 올라가고 있던 문제를 발견해 `../../_lib/logArchiveHandlers`로 수정했고, 배포 루트 기준 entrypoint가 실제로 `require()` 가능한지 확인하는 Node 테스트도 추가했다.
- SQL 적용과 Preview/Prod 검증 순서는 별도 운영 문서 `docs/SUPABASE_LOG_ARCHIVE_ROLLOUT.md`로 정리해, 실제 롤아웃 시 `배포 경로 정합성 -> SQL 수동 적용 -> Preview 스모크 -> Prod 반영` 순서를 그대로 따를 수 있게 맞췄다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/utils/logArchiveApi.js`
- `digimon-tamagotchi-frontend/src/utils/logArchiveApi.test.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
- `digimon-tamagotchi-frontend/src/components/ArenaScreen.jsx`
- `digimon-tamagotchi-frontend/api/_lib/logArchives.js`
- `digimon-tamagotchi-frontend/api/_lib/logArchiveHandlers.js`
- `digimon-tamagotchi-frontend/api/logs/arena-battles/archive.js`
- `digimon-tamagotchi-frontend/api/logs/arena-battles/[archiveId]/replay.js`
- `digimon-tamagotchi-frontend/api/logs/jogress/archive.js`
- `api/_lib/logArchives.js`
- `api/_lib/logArchiveHandlers.js`
- `api/_lib/logArchiveHandlers.test.js`
- `api/logs/arena-battles/archive.js`
- `api/logs/arena-battles/[archiveId]/replay.js`
- `api/logs/jogress/archive.js`
- `supabase/migrations/20260402_log_archives.sql`
- `tests/log-archive-entrypoints.test.js`
- `docs/SUPABASE_LOG_ARCHIVE_ROLLOUT.md`
- `docs/REFACTORING_LOG.md`

### 게임 데스크톱 상단 툴바를 문서 흐름으로 옮겨 헤더 중앙 가림 문제 수정

- 데스크톱 기본 게임 화면에서 `플레이 허브 / 몰입형 플레이`와 `접속자 수 / 설정 / 프로필` 묶음이 `fixed`로 헤더를 덮고 있던 구조를 제거했다.
- 상단 컨트롤을 `Game.jsx` 본문 상단의 전용 데스크톱 툴바로 재배치해서, 슬롯 제목·생성일·기종/버전·현재 시간이 다시 화면 중앙에서 안정적으로 보이게 맞췄다.
- `.game-page-header--default`의 상단 패딩을 고정 버튼 회피용 값에서 일반 문서 흐름에 맞는 값으로 줄이고, 새 `.game-page-toolbar` 스타일을 추가했다.
- 추가 확인 결과, 위 정렬 규칙이 `@media (max-width: 768px)` 안에 잘못 들어가 있어서 데스크톱에서 적용되지 않고 있었다. 관련 `game-page-*`와 `game-header-meta*` 규칙을 전역 스타일로 옮겨 실제 데스크톱 화면에도 적용되도록 바로잡았다.
- 모바일 상단바와 몰입형 플레이 상단바는 그대로 유지해서 화면별 동작은 건드리지 않았다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### 조명 상태 저장 경로 단일화 및 즉시 새로고침 복원 버그 수정

- `useGameData.saveStats()`가 루트 전용 필드(`isLightsOn`, `wakeUntil`, `dailySleepMistake`)를 저장할 때 훅 클로저 상태 대신 `newStats`의 최신값을 우선 사용하도록 수정했다.
- `useGameHandlers.handleToggleLights()`에서 `updatedStats.isLightsOn = next`를 명시적으로 포함시키고, 별도의 Firestore 직접 `updateDoc()`를 제거해 저장 경로를 `saveStats()` 한 곳으로 통일했다.
- 이로써 `불 끄기 -> 즉시 새로고침` 시 루트 `slot.isLightsOn`이 예전 값으로 덮여 복원되지 않던 레이스를 막았다.
- `useGameData` 루트 필드 해석 테스트와 `useGameHandlers` 조명 토글 회귀 테스트를 추가했다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameHandlers.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.test.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameHandlers.test.js`

### 모바일 플레이 채팅 드로어 상단 압축 및 하단 입력 구획 분리

- `PlayChatDrawer`의 헤더를 제목 중심 구조로 정리하고, 헤더 아래 별도 줄로 보이던 `접속 n명` 배지는 제거했다.
- `닫기` 버튼은 다시 헤더 우측으로 올리되 `실시간 로비` 라벨이 아니라 `테이머 채팅` 제목 줄과 같은 선상에 오도록 정렬했다.
- 드로어 본문은 `play-chat-drawer__content` 단일 영역으로 단순화했고, `ChatRoom`의 drawer variant는 기존 `scroll + composer` 구조를 유지하면서 하단 입력부를 `composer-shell`과 `composer-grid`로 감싸 고정 구획처럼 보이게 유지했다.
- 모바일 CSS에서는 헤더/본문 여백을 다시 맞추고, 상단 접속자 배지 제거 이후에도 하단 입력창과 메시지 영역 우선순위가 유지되도록 정리했다.
- `접속 중인 테이머` 목록과 채팅 메시지 박스 오른쪽에는 실제 scrollbar 스타일과 별도 고정 track 시각 신호를 추가해서, 모바일 WebKit에서도 스크롤 가능한 영역이라는 점이 더 직관적으로 보이게 했다.
- `PlayChatDrawer` 렌더 테스트는 상단 접속자 배지가 더 이상 보이지 않고 `닫기` 버튼이 헤더 안에 있는 구조로 갱신했고, `ChatRoom` 테스트는 하단 입력 shell/grid 구조가 scroll 영역 밖에 유지되는지 계속 검증한다.
- 후속 조정으로 헤더 아래 별도 줄에 있던 `접속 n명` 배지는 제거하고, `닫기` 버튼은 다시 `테이머 채팅` 제목 줄 우측으로 올려 헤더를 더 단순하게 정리했다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/components/chat/PlayChatDrawer.jsx`
- `digimon-tamagotchi-frontend/src/components/chat/PlayChatDrawer.test.jsx`
- `digimon-tamagotchi-frontend/src/components/ChatRoom.jsx`
- `digimon-tamagotchi-frontend/src/components/ChatRoom.test.jsx`
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

## 2026-04-02

### 플레이 채팅 미읽음 수를 마지막 읽은 메시지 기준으로 전환

- `unreadCount` 를 `채팅창이 닫혀 있을 때 새 메시지마다 +1` 하던 방식에서, `lastReadCursor` 와 현재 `chatLog` 를 비교해 파생 계산하는 방식으로 바꿨다.
- 읽음 기준점은 사용자별 `localStorage` (`tamer-lobby:last-read:${clientId}`) 에 `{ messageId, timestamp }` 형태로 저장해서, 같은 브라우저에서는 새로고침 후에도 미읽음 상태를 복원하도록 맞췄다.
- `ChatRoom` 은 히스토리 로드 후 첫 방문이면 최신 메시지를 읽은 기준점으로 초기화하고, 채팅 UI가 실제로 보이며 문서가 visible 인 상태에서 최신 메시지 커서를 `markChatRead()` 로 갱신하도록 정리했다.
- `PlayChatDrawer` 는 열림 상태라는 이유만으로 unread 를 지우지 않게 바꿨고, `OnlineUsersCount` 팝업 역시 열어도 unread 를 초기화하지 않게 수정했다.
- `OnlineUsersCount` 의 채팅 바로가기 버튼은 inline chat 컨테이너가 없을 때 drawer 를 직접 열도록 바꿔, 미읽음 뱃지가 보이는 경로와 실제 읽음 처리 경로가 어긋나지 않게 했다.
- unread 계산 helper 와 관련 단위 테스트를 추가했고, `ChatRoom`/`PlayChatDrawer`/`OnlineUsersCount` 테스트도 새 읽음 기준에 맞게 갱신했다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/contexts/AblyContext.jsx`
- `digimon-tamagotchi-frontend/src/components/ChatRoom.jsx`
- `digimon-tamagotchi-frontend/src/components/ChatRoom.test.jsx`
- `digimon-tamagotchi-frontend/src/components/chat/PlayChatDrawer.jsx`
- `digimon-tamagotchi-frontend/src/components/chat/PlayChatDrawer.test.jsx`
- `digimon-tamagotchi-frontend/src/components/OnlineUsersCount.jsx`
- `digimon-tamagotchi-frontend/src/components/OnlineUsersCount.test.jsx`
- `digimon-tamagotchi-frontend/src/utils/chatUnreadUtils.js`
- `digimon-tamagotchi-frontend/src/utils/chatUnreadUtils.test.js`
- `docs/REFACTORING_LOG.md`

### 커뮤니티 작성 모달 액션 위치 재정렬 및 Firestore 재조회 실패 폴백 추가

- 커뮤니티 작성 모달의 상단 오른쪽 `닫기` 버튼을 다시 복원하고, 제출 액션은 하단 오른쪽 `자랑 글 올리기` 단일 버튼으로 정리했다.
- `createShowcasePost` 요청은 기존 `slotId`, `title`, `body`에 더해 현재 작성 미리보기 스냅샷도 함께 보내도록 확장했다.
- 프론트 커뮤니티 API 유틸은 실패 응답에서 `error.message`, 문자열 `error`, 일반 `message`, HTML 404 fallback까지 순서대로 해석해서 실제 원인 메시지를 더 잘 보여주도록 수정했다.
- 서버 `createCommunityPost`는 여전히 Firestore 슬롯 재조회를 우선 사용하지만, 이 단계가 실패하면 클라이언트 preview snapshot을 허용 필드만 정규화해 `community_posts.snapshot`에 저장하는 폴백을 추가했다.
- 테이머명도 Firestore 프로필 재조회 실패 시 토큰의 이름/이메일 prefix 기반 이름으로 폴백해, 작성 자체가 불필요하게 막히지 않도록 했다.
- 로컬 개발 메모로 `npm start` 단독 실행만으로는 `/api/community/...`가 연결되지 않을 수 있으므로 `vercel dev` 또는 `REACT_APP_COMMUNITY_API_BASE_URL` 설정이 필요하다는 점을 README에 명시했다.
- 관련 테스트를 보강해 preview snapshot 전송, 비정형 에러 메시지 파싱, 서버 재조회 성공/실패 폴백, 잘못된 snapshot 거부 시나리오를 고정했다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/components/community/CommunityDialog.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunityPostComposer.jsx`
- `digimon-tamagotchi-frontend/src/pages/Community.jsx`
- `digimon-tamagotchi-frontend/src/pages/Community.test.jsx`
- `digimon-tamagotchi-frontend/src/utils/communityApi.js`
- `digimon-tamagotchi-frontend/src/utils/communityApi.test.js`
- `digimon-tamagotchi-frontend/src/utils/communitySnapshotUtils.js`
- `digimon-tamagotchi-frontend/src/index.css`
- `api/_lib/community.js`
- `digimon-tamagotchi-frontend/api/_lib/community.js`
- `tests/community-lib.test.js`
- `README.md`
- `docs/REFACTORING_LOG.md`

### 커뮤니티 자랑 보드를 피드형 화면과 자동 스냅샷 카드 중심으로 재설계

- `/community`를 소개 카드와 고정 상세 패널 중심 구조에서 벗어나, 상단 피드 헤더와 보드 탭, 단일 피드 리스트, 모달형 작성/상세 흐름으로 다시 정리했다.
- `자랑하기`는 상시 노출 폼 대신 모달/모바일 풀시트 구조로 바꾸고, 슬롯 선택 시 현재 상태를 기준으로 한 대표 장면 카드 미리보기가 즉시 갱신되도록 구성했다.
- 게시글 카드는 텍스트 칩 묶음 위주에서 벗어나 배경, 디지몬 스프라이트, 조명/수면/부상/배변 상태를 보여주는 `CommunitySnapshotScene` 중심 카드로 전환했다.
- 게시글 상세도 별도 우측 패널 대신 모달로 열리게 바꾸고, 큰 스냅샷 장면, 본문, 요약 정보, 댓글 흐름을 한 컨텍스트 안에서 보게 만들었다.
- 비로그인 상태에서는 같은 카드 UI로 샘플 피드를 둘러볼 수 있게 두고, 댓글 영역은 읽기 전용 안내로 바꿔 실제 운영 피드와 공개 미리보기의 톤을 맞췄다.
- 클라이언트 커뮤니티 미리보기 유틸과 서버 커뮤니티 스냅샷 생성 로직이 같은 시각 필드(`spriteBasePath`, `spriteNumber`, `backgroundNumber`, `isLightsOn`, `sleepStatus`, `poopCount`, `isFrozen`, `isDead`, `isInjured`, `recordedAt`)를 사용하도록 정리했다.
- 커뮤니티 전용 테스트를 추가해 스냅샷 시각 해석, 장면 렌더링, 공개/로그인 피드 분기, 작성 모달과 상세 모달 흐름을 고정했다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/pages/Community.jsx`
- `digimon-tamagotchi-frontend/src/pages/Community.test.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunityDialog.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunityPostCard.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunityPostComposer.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunityPostDetailDialog.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunitySnapshotScene.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunitySnapshotScene.test.jsx`
- `digimon-tamagotchi-frontend/src/utils/communitySnapshotUtils.js`
- `digimon-tamagotchi-frontend/src/utils/communitySnapshotUtils.test.js`
- `digimon-tamagotchi-frontend/src/data/serviceContent.js`
- `digimon-tamagotchi-frontend/src/index.css`
- `api/_lib/community.js`
- `digimon-tamagotchi-frontend/api/_lib/community.js`
- `tests/community-lib.test.js`
- `docs/REFACTORING_LOG.md`

### 커뮤니티 카드 메타 구획 강조 및 디지몬 스탯 기본 접힘 추가

- 커뮤니티 카드와 상세 모달의 `작성자` 표시를 별도 메타 박스로 감싸, 배지와 섞이지 않고 독립된 정보 블록처럼 읽히도록 정리했다.
- 작성자 본인에게만 보이는 `수정`, `삭제`는 시간 아래에 별도 관리 박스로 배치해 메타 흐름을 유지하면서도 조작 영역이 분명하게 보이게 만들었다.
- `디지몬 스탯`은 새 `CommunityPostStatsPanel` 컴포넌트로 분리하고, 카드와 상세 모두에서 기본값을 접힘 상태로 고정했다.
- 접힌 상태에서는 `단계 · 버전 · 승률` 요약만 먼저 보여주고, `스탯 펼치기`를 누르면 기종, 슬롯, 체중, 댓글 수까지 박스형 그리드로 펼쳐지도록 구성했다.
- 관련 테스트를 추가해 스탯 패널이 기본 접힘 상태로 렌더되고, 버튼으로 정상적으로 펼치고 다시 접을 수 있는 흐름을 고정했다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/components/community/CommunityPostCard.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunityPostDetailDialog.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunityPostStatsPanel.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunityPostStatsPanel.test.jsx`
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### 커뮤니티 탭을 자유게시판·자랑게시판·버그제보/QnA·디스코드 4개 보드로 분리

- 기존 `/community`는 사실상 자랑게시판 단일 흐름이었고 다른 보드는 비활성 카드였는데, 이번에 실제 `tab` 상태를 도입해 4개 보드를 직접 전환할 수 있게 정리했다.
- 자랑게시판은 기존 스냅샷 피드, 작성 모달, 상세/댓글 흐름을 그대로 유지하고, 보드별 헤더 문구와 CTA만 현재 탭에 맞게 바뀌도록 분리했다.
- 자유게시판은 플레이 근황, 공략 잡담, 짧은 질문을 위한 추천 주제와 운영 메모를 먼저 보여 주는 정보형 보드로 추가했다.
- 버그제보 / QnA는 기존 지원 페이지에 흩어져 있던 상태 카드, FAQ, 버그 제보 체크리스트를 커뮤니티 안에서도 바로 볼 수 있게 묶었다.
- 디스코드 보드는 초대 링크와 `공지 확인`, `자랑 스냅샷`, `버그제보 / QnA`, `자유잡담` 같은 용도형 안내를 한 화면에서 확인할 수 있도록 추가했다.
- 추가로 커뮤니티 진입 직후 게시판 종류 목록이 먼저 보이도록 순서를 바꿔, 선택 가능한 보드 목록이 설명 카드보다 위에 먼저 나타나게 정리했다.
- 현재 선택된 게시판 카드는 민트 톤 배경, 더 강한 보더/그림자, 텍스트 대비를 적용해 비선택 카드와 바로 구별되도록 강조했다.
- 탭 전환 테스트를 보강해 자유게시판, 버그제보 / QnA, 디스코드 보드가 각각 다른 콘텐츠를 렌더하는지 고정했다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/pages/Community.jsx`
- `digimon-tamagotchi-frontend/src/pages/Community.test.jsx`
- `digimon-tamagotchi-frontend/src/data/serviceContent.js`
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

**검증**
- `cd digimon-tamagotchi-frontend && CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watchAll=false --runTestsByPath src/pages/Community.test.jsx`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 상단 `커뮤니티` 메뉴를 게시판 드롭다운 진입점으로 연결

- 일반 서비스 상단 메뉴와 노트북 상단 메뉴의 `커뮤니티`를 단일 링크 대신 드롭다운 트리거로 바꿔, `자유게시판`, `자랑게시판`, `버그제보 / QnA`, `디스코드` 4개 보드에 바로 진입할 수 있게 했다.
- 드롭다운은 클릭 토글 방식으로 열리고, 바깥 클릭, `Esc`, 라우트 이동 시 자동으로 닫히도록 정리해 상단 계정 메뉴와 상호작용이 충돌하지 않게 분리했다.
- 커뮤니티 페이지는 이제 `?board=free|showcase|support|discord` query를 읽어 초기 보드를 결정하고, 페이지 안에서 보드를 바꿀 때도 같은 query 형식으로 URL을 함께 갱신하도록 맞췄다.
- 잘못된 `board` 값이나 query가 없는 직접 진입은 기존처럼 `showcase`를 기본값으로 삼아, 예전 `/community` 링크도 깨지지 않게 유지했다.
- 상단 드롭다운과 커뮤니티 본문이 같은 보드 해석 규칙을 쓰도록 공용 helper를 `serviceContent`에 두고, 테스트도 네비게이션 드롭다운과 커뮤니티 query 동기화까지 함께 검증하도록 보강했다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/components/layout/TopNavigation.jsx`
- `digimon-tamagotchi-frontend/src/components/home/NotebookTopBar.jsx`
- `digimon-tamagotchi-frontend/src/pages/Community.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/NavigationLinks.test.jsx`
- `digimon-tamagotchi-frontend/src/pages/Community.test.jsx`
- `digimon-tamagotchi-frontend/src/data/serviceContent.js`
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### 배고픔/힘 10분 호출과 12시간 사망 카운터의 기준 시각을 분리해 정합성 복구

- `lastHungerZeroAt`, `lastStrengthZeroAt`를 이제 배고픔/힘 0 상태의 단일 기준 시각으로 취급하고, `callStatus.hunger/strength`는 그 위에 얹힌 10분 케어 호출 UI 상태로만 다루도록 정리했다.
- 실시간 호출 타임아웃과 lazy update 타임아웃 모두에서, 10분이 지나면 케어미스를 1회 올리고 호출을 닫되 `last*ZeroAt`는 stat이 여전히 0인 동안 유지하도록 바꿨다.
- 그 결과 상단 호출 배지와 하단 `0 상태 12시간 지속` 카운터가 더 이상 서로 다른 사건을 가리키지 않게 되었고, 새로고침 후에도 사망 카운터가 끊기지 않는다.
- 이미 10분 호출이 처리된 0 구간은 `isLogged`를 기준으로 다시 열리지 않도록 해서, 같은 0 구간에서 케어미스가 중복으로 쌓이거나 상단 호출이 다시 살아나는 드리프트를 막았다.
- `StatsPopup` 상단 호출 안내는 `10분 케어 호출 종료 - 0 상태 12시간 지속 카운터는 계속 진행 중` 문구를 보여주게 바꿔, 호출 종료와 사망 카운터 지속을 화면에서도 구분해 이해할 수 있게 했다.
- `Game.jsx`의 저장 트리거는 `last*ZeroAt`가 설정될 때뿐 아니라 null로 회복될 때도 저장되도록 바꿔, 회복 직후 새로고침 시 오래된 zeroAt가 남는 문제를 방지했다.
- 관련 테스트를 보강해 실시간 timeout, 새로고침 복원, 이미 처리된 0 구간 재열림 방지까지 모두 회귀 테스트로 고정했다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/data/stats.test.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.test.js`
- `docs/REFACTORING_LOG.md`

**검증**
- `cd digimon-tamagotchi-frontend && npm test -- --runInBand --watchAll=false src/data/stats.test.js src/hooks/useGameLogic.test.js`
- `cd digimon-tamagotchi-frontend && npm test -- --runInBand --watchAll=false src/data/stats.test.js src/hooks/useGameLogic.test.js src/hooks/useGameActions.test.js src/logic/evolution/checker.test.js src/logic/battle/hitrate.test.js src/logic/battle/calculator.test.js`
- `cd digimon-tamagotchi-frontend && npm run build`

### 커뮤니티 자랑게시판을 일반 게시판형 목록으로 압축하고 스크린샷 정보 오버레이 제거

- 자랑게시판 목록 카드를 소개형 카드에서 일반 게시판형 리스트로 바꿔, 제목·작성자·작성일·디지몬 요약·댓글 수만 먼저 읽히고 본문과 스탯은 상세에서만 보이도록 분리했다.
- 목록 썸네일은 오른쪽 작은 스크린샷으로 줄이고, `상세 보기` 버튼과 댓글 개수만 남겨 피드 스캔 속도를 높였다.
- `CommunitySnapshotScene`은 이제 `card`와 `detail` 변형에서 화면 위 캡션과 상태 배지를 렌더하지 않고, 작성 모달 미리보기(`composer`)에서만 오버레이를 유지한다.
- 상세 모달은 `메타 → 큰 스크린샷 → 디지몬 정보 요약 → 본문 → 스탯 → 댓글` 순서로 재배치해, 스크린샷을 가리지 않으면서도 필요한 정보는 모두 아래에서 확인하게 정리했다.
- 스냅샷 아래 정보는 공용 `CommunitySnapshotSummary` 컴포넌트로 분리해 카드와 상세가 같은 디지몬 이름·단계·버전 기준을 쓰고, 상세에서는 기종·배경·상태 칩까지 함께 보여주도록 맞췄다.
- 관련 테스트를 보강해 목록에서 본문/스탯이 숨겨지고, 상세에서만 정보가 보이며, 오버레이가 `composer`에만 남는 흐름을 회귀 테스트로 고정했다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/components/community/CommunityPostCard.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunityPostDetailDialog.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunitySnapshotScene.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunitySnapshotSummary.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunitySnapshotScene.test.jsx`
- `digimon-tamagotchi-frontend/src/pages/Community.test.jsx`
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### Supabase archive 운영 스모크 완료 후 조그레스 Firestore 제거 및 아레나 summary-only 전환

- Preview는 `SUPABASE_SERVICE_ROLE_KEY`를 runtime env로 주입한 별도 배포를 만들고, `vercel curl`로 보호 배포를 우회해 아레나 archive 저장, replay 조회, 조그레스 archive 저장, Supabase row 생성을 모두 확인했다.
- Production도 최신 archive API 배포를 다시 반영한 뒤 같은 스모크를 수행해 운영 도메인에서 archive POST / replay GET / Supabase row 생성이 정상 동작하는 것을 확인했다.
- `useEvolution`의 조그레스 이력 저장은 이제 Firestore `jogress_logs`를 더 이상 쓰지 않고 Supabase archive만 사용한다. archive 저장 실패는 기존처럼 경고만 남기고 게임 진행을 막지 않는다.
- `useGameActions`는 아레나 배틀 로그 저장 구조를 요약/상세로 분리해, Firestore `arena_battle_logs`에는 `archiveId`와 목록용 summary 필드만 남기고 상세 `logs[]`는 Supabase archive payload에만 저장하도록 바꿨다.
- `ArenaScreen`은 더 이상 Firestore `logs[]`를 fallback으로 사용하지 않고 `archiveId`가 있는 로그만 다시보기 대상으로 취급한다. archive replay 조회 실패 시에는 기존 Firestore 로그를 대신 보여주지 않고 `상세 다시보기를 불러오지 못했습니다.` 안내로 degrade 한다.
- 회귀 테스트를 추가해 조그레스 archive-only 동작, 아레나 summary-only 저장 구조, `archiveId` 기준 다시보기 판단을 고정했다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
- `digimon-tamagotchi-frontend/src/hooks/useEvolution.test.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.test.js`
- `digimon-tamagotchi-frontend/src/components/ArenaScreen.jsx`
- `digimon-tamagotchi-frontend/src/components/ArenaScreen.test.jsx`
- `docs/SUPABASE_LOG_ARCHIVE_ROLLOUT.md`
- `README.md`
- `docs/REFACTORING_LOG.md`

**검증**
- `cd digimon-tamagotchi-frontend && CI=true npm test -- --watchAll=false --runInBand src/hooks/useGameActions.test.js src/hooks/useEvolution.test.js src/components/ArenaScreen.test.jsx src/utils/logArchiveApi.test.js`
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`
- Preview archive 스모크:
  - `POST /api/logs/arena-battles/archive`
  - `GET /api/logs/arena-battles/:archiveId/replay`
  - `POST /api/logs/jogress/archive`
  - `arena_battle_log_archives`, `jogress_log_archives` row 생성 확인
- Production archive 스모크:
  - `POST /api/logs/arena-battles/archive`
  - `GET /api/logs/arena-battles/:archiveId/replay`
  - `POST /api/logs/jogress/archive`
  - `arena_battle_log_archives`, `jogress_log_archives` row 생성 확인

### 똥/부상/사망 카운터 계약을 분리해 poop 과부하와 부상 방치 판정을 정합화

- `poopCount >= 8` 상태를 위한 시간 필드를 `poopReachedMaxAt`와 `lastPoopPenaltyAt`로 분리해, “처음 8개가 된 시각”과 “다음 8시간 추가 부상 기준 시각”을 더 이상 같은 필드에 섞지 않도록 정리했다.
- `src/data/stats.js`를 poop/injury/death의 canonical engine으로 고정하고, `poopCount 7 -> 8` 전환 시 즉시 부상 1회를 발생시키며 `poopReachedMaxAt`와 `lastPoopPenaltyAt`를 같은 시각으로 세팅하도록 맞췄다.
- `poopCount >= 8` 상태에서 8시간이 추가로 지나면 이제 `injuries`만 증가시키고 `careMistakes`는 올리지 않게 바꿨다. 추가 부상 발생 시 `injuredAt`와 `lastPoopPenaltyAt`는 현재 시각으로 갱신된다.
- 기존 저장 데이터의 `lastMaxPoopTime`는 읽기 시에만 새 필드로 마이그레이션하고, `poopCount < 8`이면 stale 값이 남지 않도록 즉시 null 처리한다. 이후 저장은 새 필드만 사용한다.
- `부상 방치 6시간 사망`은 `src/data/stats.js`, `src/hooks/useGameData.js`, `src/hooks/useDeath.js`, `src/pages/Game.jsx` 전부에서 냉장고 시간을 제외하는 공통 helper 기준으로 맞췄다.
- `StatsPopup`과 `StatsPanel`은 이제 `PoopReachedMaxAt`와 `LastPoopPenaltyAt`를 분리해 보여주며, “즉시 부상 발생 시간”과 “다음 추가 부상까지”를 서로 다른 기준 시각으로 표시한다.
- 관련 테스트를 추가해 8개 도달 즉시 부상, 8시간 추가 부상, legacy 필드 마이그레이션, 냉장고 시간 제외 부상 방치 판정을 회귀 테스트로 고정했다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `digimon-tamagotchi-frontend/src/data/stats.test.js`
- `digimon-tamagotchi-frontend/src/data/defaultStatsFile.js`
- `digimon-tamagotchi-frontend/src/data/v1/defaultStats.js`
- `digimon-tamagotchi-frontend/src/utils/fridgeTime.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameAnimations.js`
- `digimon-tamagotchi-frontend/src/hooks/useDeath.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx`
- `digimon-tamagotchi-frontend/src/components/StatsPanel.jsx`
- `docs/REFACTORING_LOG.md`

**검증**
- `cd digimon-tamagotchi-frontend && npm test -- --runInBand --watchAll=false src/data/stats.test.js`
- `cd digimon-tamagotchi-frontend && npm test -- --runInBand --watchAll=false src/hooks/useGameLogic.test.js src/hooks/useGameActions.test.js src/logic/evolution/checker.test.js src/logic/battle/hitrate.test.js src/logic/battle/calculator.test.js`
- `cd digimon-tamagotchi-frontend && npm run build`

### 마이 화면을 프로필·수집 허브형으로 재구성하고 최근 슬롯 기준을 분리

- `Me.jsx`를 프로필·수집 허브형으로 재구성해, 본문 큰 카드의 `계정 설정`을 제거하고 히어로 오른쪽 `환경 요약` 카드로 분리했다.
- 마이 본문 1순위 섹션은 `도감 진행도`로 바꾸고, Ver.1/Ver.2별 발견 수·남은 수·마스터 달성 여부를 한눈에 보이는 요약 카드로 노출했다.
- `최근 육성 중인 디지몬`은 대표 슬롯 1개와 보조 슬롯 1~2개 구조로 낮춰, 이전의 동등한 리스트보다 집중도가 높게 보이도록 정리했다.
- `useUserSlots`는 이제 `slots`의 표시 순서와 별개로 `recentSlots`/`recentSlot`을 제공하며, 최근성 기준은 `lastSavedAt || updatedAt || createdAt` 순으로 계산한다.
- 수집 현황은 새 `useEncyclopediaSummary` 훅과 `encyclopediaSummary` 유틸에서 계산하도록 분리해, 마이 화면이 전체 `EncyclopediaPanel` 없이도 가벼운 요약만 사용할 수 있게 만들었다.
- `바로가기`는 `도감`, `진화 가이드`, `플레이 허브` 3개만 남기고, 저빈도 설정 동선을 더 이상 본문 핵심 카드로 강조하지 않도록 조정했다.
- 관련 단위 테스트를 추가해 최근 슬롯 정렬 기준, 도감 요약 계산, 마이 화면의 새 섹션 구성을 회귀 테스트로 고정했다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/pages/Me.jsx`
- `digimon-tamagotchi-frontend/src/pages/Me.test.jsx`
- `digimon-tamagotchi-frontend/src/hooks/useUserSlots.js`
- `digimon-tamagotchi-frontend/src/hooks/useEncyclopediaSummary.js`
- `digimon-tamagotchi-frontend/src/utils/slotRecency.js`
- `digimon-tamagotchi-frontend/src/utils/slotRecency.test.js`
- `digimon-tamagotchi-frontend/src/utils/encyclopediaSummary.js`
- `digimon-tamagotchi-frontend/src/utils/encyclopediaSummary.test.js`
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### 마이 라벨을 테이머로 정리하고 마스터 완료 문구에 왕관 추가

- 주요 사용자 노출 라벨의 `마이`를 `테이머`로 정리해, 상단 네비게이션, 모바일 탭, 홈/플레이 허브 바로가기, 설정/도감 복귀 링크, 로그인 소개 문구가 같은 명칭을 쓰도록 맞췄다.
- 테이머 화면의 도감 진행 카드에서 완료 상태 문구는 `👑 마스터 달성`으로 바꿔, 달성 여부가 카드 안에서 더 바로 읽히도록 조정했다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/pages/Me.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/TopNavigation.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/MobileTabBar.jsx`
- `digimon-tamagotchi-frontend/src/pages/Home.jsx`
- `digimon-tamagotchi-frontend/src/pages/PlayHub.jsx`
- `digimon-tamagotchi-frontend/src/pages/Collection.jsx`
- `digimon-tamagotchi-frontend/src/pages/Settings.jsx`
- `digimon-tamagotchi-frontend/src/pages/Login.jsx`
- `digimon-tamagotchi-frontend/src/components/panels/AccountSettingsPanel.jsx`
- `digimon-tamagotchi-frontend/src/data/serviceContent.js`
- `digimon-tamagotchi-frontend/src/App.test.js`
- `docs/REFACTORING_LOG.md`

### 테이머 메뉴명을 테이머(설정)으로 조정

- 모바일 탭, 홈/플레이 허브 이동 카드, `/me` 상단 라벨, 설정·도감 복귀 링크의 메뉴명을 `테이머(설정)`으로 맞춰 계정/설정 성격이 더 바로 드러나도록 정리했다.
- 화면 테마 설명과 로그아웃 안내 문구도 같은 메뉴명을 따라가도록 조정했다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/components/layout/MobileTabBar.jsx`
- `digimon-tamagotchi-frontend/src/pages/Home.jsx`
- `digimon-tamagotchi-frontend/src/pages/PlayHub.jsx`
- `digimon-tamagotchi-frontend/src/pages/Collection.jsx`
- `digimon-tamagotchi-frontend/src/pages/Settings.jsx`
- `digimon-tamagotchi-frontend/src/pages/Me.jsx`
- `digimon-tamagotchi-frontend/src/components/panels/AccountSettingsPanel.jsx`
- `docs/REFACTORING_LOG.md`

### 플레이 채팅 FAB 미읽음 배지를 말풍선 아이콘 위로 이동

- 하단 플로팅 `채팅` 버튼의 미읽음 배지를 버튼 우상단이 아니라 왼쪽 말풍선 아이콘 기준으로 다시 배치해, 알림 위치가 더 직관적으로 읽히도록 정리했다.
- `PlayChatButton`은 아이콘 전용 래퍼를 추가하고 배지를 그 내부로 옮겨, 라벨과 접속자 수 간격은 유지하면서 배지 기준점만 아이콘으로 고정했다.
- 후속 미세 조정으로 배지의 세로 위치를 조금 더 위로 올려, 말풍선 이모티콘이 숫자에 과하게 가려지지 않도록 맞췄다.
- 추가 미세 조정으로 배지를 더 위로 올려, 작은 해상도에서도 말풍선 이모티콘이 더 또렷하게 보이도록 여백을 확보했다.
- 관련 테스트를 보강해 배지가 계속 렌더되는지만이 아니라 아이콘 래퍼 내부에 배치되는 구조도 함께 회귀 테스트로 고정했다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/components/chat/PlayChatButton.jsx`
- `digimon-tamagotchi-frontend/src/components/chat/PlayChatButton.test.jsx`
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### 사용자 설정을 `users/{uid}/settings/main`으로 분리 시작

- 사용자 설정 1단계로 `discordWebhookUrl`, `isNotificationEnabled`, `siteTheme` 저장 경로를 루트 `users/{uid}` 문서에서 `users/{uid}/settings/main` 문서로 옮기기 시작했다.
- `userSettingsUtils`는 이제 새 경로를 우선 읽고, 아직 마이그레이션되지 않은 기존 사용자에 대해서만 루트 문서를 fallback으로 읽는다.
- 설정 저장은 `setDoc(..., { merge: true })` 기반으로 `settings/main`에만 쓰도록 바꿔, 이후 `profile`과 `encyclopedia` 분리와 충돌하지 않도록 했다.
- Firestore 규칙에 `users/{uid}/settings/{settingsId}` 소유자 접근 규칙을 추가했고, 유틸 단위 테스트로 `settings/main 우선 읽기`, `루트 fallback`, `새 경로 저장`을 고정했다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/utils/userSettingsUtils.js`
- `digimon-tamagotchi-frontend/src/utils/userSettingsUtils.test.js`
- `firestore.rules`
- `docs/ACCOUNT_SETTINGS_AND_MASTER_TITLES_DESIGN.md`
- `docs/REFACTORING_LOG.md`

### 사용자 도감을 `users/{uid}/encyclopedia/{version}`으로 분리 시작

- 도감 저장 2단계로 루트 `users/{uid}.encyclopedia` 대신 `users/{uid}/encyclopedia/Ver.1`, `users/{uid}/encyclopedia/Ver.2` 문서를 우선 사용하도록 변경했다.
- `loadEncyclopedia`는 새 버전 문서를 먼저 읽고, 두 문서가 모두 없을 때만 기존 루트 `encyclopedia`를 fallback으로 읽는다.
- `saveEncyclopedia`는 새 버전 문서에만 저장하고, `updateEncyclopedia`와 `addMissingEncyclopediaEntries`도 같은 경로를 타도록 유지했다.
- 새 구조가 일부만 생성된 사용자를 나중에 정리할 수 있도록 `scripts/backfillUserEncyclopedia.js`와 `npm run encyclopedia:backfill` 스크립트를 추가했다.
- 이번 단계에서는 루트 `users/{uid}.encyclopedia` 필드를 삭제하지 않고, 운영 백필과 안정화 이후 정리할 수 있게 남겨둔다.

- 도감 저장 실패가 사용자에게 숨겨지지 않도록 `saveEncyclopedia()`를 canonical/version-doc 저장과 compat/root-profile 보정 단계로 분리했다.
- Firestore write 전에 도감 payload를 재귀 sanitize해 중첩 객체 안 `undefined`로 인한 전체 저장 실패를 줄였고, canonical 실패는 예외로 다시 던지게 바꿨다.
- `loadEncyclopedia()`의 self-heal은 canonical 저장이 실제로 성공했을 때만 완료 처리해, 한 번 실패한 계정도 같은 세션에서 다시 동기화할 수 있게 했다.
- 도감 패널은 이제 보정 성공/부분 실패/실패를 분리해서 표시하고, 실패 시 `canonical`, `rootMirror`, `profileMirror` 단계를 함께 보여준다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/hooks/useEncyclopedia.js`
- `digimon-tamagotchi-frontend/src/hooks/useEncyclopedia.test.js`
- `digimon-tamagotchi-frontend/src/components/panels/EncyclopediaPanel.jsx`
- `digimon-tamagotchi-frontend/src/components/panels/EncyclopediaPanel.test.jsx`
- `firestore.rules`
- `package.json`
- `scripts/backfillUserEncyclopedia.js`
- `docs/ACCOUNT_SETTINGS_AND_MASTER_TITLES_DESIGN.md`
- `docs/REFACTORING_LOG.md`

## 2026-04-10

### 커뮤니티 디스코드/후원 보드를 섹션별 색상 카드로 재정리

- `디스코드 / 후원` 보드를 두 개의 큰 카테고리 카드로 다시 나눠, 디스코드는 청록 계열 안내 보드, 후원은 오렌지 계열 Ko-fi 응원 카드로 색을 확실히 분리했다.
- 디스코드 섹션은 초대 링크를 CTA 버튼과 주소 표시로 정리하고, `공지 확인`, `자랑 스냅샷`, `버그제보 / QnA`, `자유잡담`을 작은 카드 그리드로 배치해 한눈에 읽히도록 다듬었다.
- 후원 섹션은 `Ko-fi 링크`와 안내 문구를 강조 카드 안에 묶어, 링크와 응원 문장이 퍼져 보이지 않도록 흐름을 단순화했다.
- 모바일에서는 두 섹션이 세로로 쌓이고 디스코드 채널 카드도 1열로 바뀌도록 반응형 스타일을 함께 정리했다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/pages/Community.jsx`
- `digimon-tamagotchi-frontend/src/index.css`
- `docs/REFACTORING_LOG.md`

### 버그제보 / QnA 보드를 자유게시판형 작성 게시판으로 전환

- `support` 보드를 정적 FAQ 패널이 아니라 실제 작성형 텍스트 보드로 확장해, 로그인 사용자가 `버그 / 질문 / 해결` 말머리와 함께 글·댓글을 남길 수 있도록 바꿨다.
- 자유게시판 전용이던 텍스트 보드 공용 흐름을 `free/support` 공용 구조로 정리하고, support 보드에는 `슬롯 번호`, `화면 경로`, `버전`, `이미지 1장` 입력과 상세 메타 표시를 추가했다.
- `community_posts`에는 `support_context jsonb`를 저장하도록 마이그레이션을 추가하고, 게시판 shape 제약을 `showcase / free / support` 3종으로 확장해 support 글이 `slot_id/snapshot` 없이만 저장되도록 고정했다.
- 클라이언트 `listCommunityPosts()`는 `payload?.posts ?? []`로 null-safe 처리해 support 전환 중 보이던 `Cannot read properties of null (reading 'posts')` 런타임 오류를 함께 막았다.
- support 보드의 기존 FAQ/체크리스트는 삭제하지 않고, 자유게시판과 같은 `안내 카드 + 접기형 운영 메모` 안으로 재배치했다.

**영향 파일**
- `digimon-tamagotchi-frontend/src/pages/Community.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunityFreePostComposer.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunityFreePostRow.jsx`
- `digimon-tamagotchi-frontend/src/components/community/CommunityPostDetailDialog.jsx`
- `digimon-tamagotchi-frontend/src/utils/communityApi.js`
- `digimon-tamagotchi-frontend/src/utils/communityApi.test.js`
- `digimon-tamagotchi-frontend/src/data/serviceContent.js`
- `digimon-tamagotchi-frontend/src/pages/Community.test.jsx`
- `digimon-tamagotchi-frontend/src/index.css`
- `api/_lib/community.js`
- `api/_lib/community.test.js`
- `digimon-tamagotchi-frontend/api/_lib/community.js`
- `tests/community-lib.test.js`
- `supabase/migrations/20260411_community_support_board.sql`
- `docs/REFACTORING_LOG.md`

**검증**
- `node --test api/_lib/community.test.js tests/community-lib.test.js`
- `CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/pages/Community.test.jsx src/utils/communityApi.test.js`
- `node -e "require('./api/_lib/community'); require('./digimon-tamagotchi-frontend/api/_lib/community'); console.log('community-api-ok');"`
- `NODE_OPTIONS=--openssl-legacy-provider npm run build`

## [2026-04-12] 프로필·테이머명도 새 구조 기준으로 정리

- **목적:** 도감 저장이 `users/{uid}/encyclopedia/{version}` 기준으로 정리된 뒤, 주변 프로필 코드도 신규 쓰기 기준을 새 구조에 맞춘다.
- **변경사항:**
  - `userProfileUtils.js`는 `achievements`, `maxSlots`를 `users/{uid}/profile/main`에만 쓰고, root `users/{uid}`는 읽기 fallback으로만 남겼다.
  - `tamerNameUtils.js`는 테이머명 저장·기본값 초기화를 `profile/main` 기준으로 바꾸고, root `tamerName`는 과거 데이터 fallback으로만 읽는다.
  - `Login.jsx`는 root `users/{uid}`에 일반 계정 정보만 저장하고, 테이머명 기본 상태는 `initializeTamerName()`를 통해 `profile/main`에서 시작하도록 정리했다.
  - `backfillUserEncyclopedia.js`는 현재 런타임 계약에 맞춰 root encyclopedia mirror를 다시 쓰지 않고, root에는 `encyclopediaStructure`, `encyclopediaMigration` 메타데이터만 남기도록 맞췄다.
- **현재 상태:**
  - 도감 저장: `users/{uid}/encyclopedia/{version}`
  - 프로필 저장: `users/{uid}/profile/main`
  - 조회: 새 구조 우선 + legacy root fallback
- **영향 파일:**
  - `digimon-tamagotchi-frontend/src/utils/userProfileUtils.js`
  - `digimon-tamagotchi-frontend/src/utils/userProfileUtils.test.js`
  - `digimon-tamagotchi-frontend/src/utils/tamerNameUtils.js`
  - `digimon-tamagotchi-frontend/src/utils/tamerNameUtils.test.js`
  - `digimon-tamagotchi-frontend/src/pages/Login.jsx`
  - `digimon-tamagotchi-frontend/src/hooks/useEncyclopedia.js`
  - `digimon-tamagotchi-frontend/src/hooks/useEncyclopedia.test.js`
- `scripts/backfillUserEncyclopedia.js`
- `tests/encyclopedia-migration.test.js`
- `docs/REFACTORING_LOG.md`

## [2026-04-12] 관리자 도구에 전체 사용자 디렉터리 탭 추가

- **목적:** 실제 화면에서 전체 사용자 목록을 한 번에 보고, 현재 운영자 화이트리스트 기준으로 `운영자 / 일반`을 구분할 수 있게 한다.
- **변경사항:**
  - 아레나 관리자 전용 API `/api/arena/admin/users`를 추가해 Firestore `users/{uid}`와 `users/{uid}/profile/main`을 함께 읽어 사용자 디렉터리를 반환하도록 했다.
  - 역할 구분은 현재 서버 정책에 맞춰 `ARENA_ADMIN_UIDS / ARENA_ADMIN_EMAILS`, `NEWS_EDITOR_UIDS / NEWS_EDITOR_EMAILS` 화이트리스트를 기준으로 계산하도록 맞췄다.
  - `AdminModal`에 `사용자` 탭을 추가하고, 검색·요약 카드·역할 배지·업적 수·최대 슬롯·최근 갱신 시각을 함께 보여 주는 관리자용 목록 화면으로 구성했다.
  - 일반 사용자에게 공개하지 않고, 기존 아레나 관리자 권한 검증을 재사용해 운영 도구 안에서만 접근 가능하게 유지했다.
- **영향 파일:**
  - `digimon-tamagotchi-frontend/api/_lib/arenaHandlers.js`
  - `digimon-tamagotchi-frontend/api/arena/admin/users.js`
  - `api/arena/admin/users.js`
  - `digimon-tamagotchi-frontend/src/utils/arenaApi.js`
  - `digimon-tamagotchi-frontend/src/components/AdminModal.jsx`
  - `api/_lib/arenaHandlers.test.js`
  - `digimon-tamagotchi-frontend/src/components/AdminModal.test.jsx`
  - `docs/REFACTORING_LOG.md`
- **검증:**
  - `node --test api/_lib/arenaHandlers.test.js`
  - `CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/components/AdminModal.test.jsx`
  - `NODE_OPTIONS=--openssl-legacy-provider npm run build`

## [2026-04-12] 테이머명 표시 우선순위를 전역 공통 헬퍼로 통일

- **목적:** `tamerName -> displayName/email -> 추가 fallback` 규칙이 화면과 저장 payload마다 다르게 흩어져 있던 부분을 공통 우선순위 구조로 맞춘다.
- **변경사항:**
  - `tamerNameUtils.js`에 `resolveTamerNamePriority()`, `getAccountDisplayFallback()`, `resolveTamerNameInitial()`를 추가해 테이머명, 계정 표시명, 아바타 이니셜 계산을 한 곳에서 처리하도록 정리했다.
  - 헤더/툴바/계정 설정/아레나/조그레스 저장 payload가 모두 같은 우선순위 헬퍼를 사용하도록 맞췄다.
  - `getTamerName()` 호출 시에도 `displayName`만 넘기지 않고, 현재 사용자 기준 기본 fallback을 함께 넘겨 profile/main이 비어 있어도 같은 기준으로 이름이 풀리게 맞췄다.
  - 결과적으로 신규 저장과 주요 UI 표시가 `profile/main.tamerName`을 최우선으로 보고, 없을 때만 계정 기본 표시명과 email prefix, 슬롯 라벨 같은 보조 fallback으로 내려간다.
- **영향 파일:**
  - `digimon-tamagotchi-frontend/src/utils/tamerNameUtils.js`
  - `digimon-tamagotchi-frontend/src/utils/tamerNameUtils.test.js`
  - `digimon-tamagotchi-frontend/src/hooks/useTamerProfile.js`
  - `digimon-tamagotchi-frontend/src/hooks/useHeaderAccountMenu.js`
  - `digimon-tamagotchi-frontend/src/components/layout/GamePageToolbar.jsx`
  - `digimon-tamagotchi-frontend/src/components/panels/AccountSettingsPanel.jsx`
  - `digimon-tamagotchi-frontend/src/components/ArenaScreen.jsx`
  - `digimon-tamagotchi-frontend/src/hooks/jogressPersistenceHelpers.js`
  - `digimon-tamagotchi-frontend/src/hooks/jogressPersistenceHelpers.test.js`
  - `digimon-tamagotchi-frontend/src/hooks/useJogressRoomLifecycle.js`
  - `digimon-tamagotchi-frontend/src/hooks/useEvolution.js`
  - `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
  - `digimon-tamagotchi-frontend/src/hooks/useGameActions.test.js`
  - `docs/REFACTORING_LOG.md`
- **검증:**
  - `CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/utils/tamerNameUtils.test.js src/hooks/jogressPersistenceHelpers.test.js src/hooks/useGameActions.test.js src/components/layout/GamePageToolbar.test.jsx src/components/panels/AccountSettingsPanel.test.jsx`

## [2026-04-12] 운영자 전용 사용자 디렉터리를 상단 메뉴로 이동

- **목적:** 게임 안 관리자 모달 깊숙한 곳에 있던 사용자 디렉터리를, 실제 서비스 운영 동선에 맞게 상단 메뉴에서 바로 접근할 수 있도록 옮긴다.
- **변경사항:**
  - 운영자 상태 조회 API `/api/operator/status`를 추가해 현재 로그인 계정의 `아레나 / 소식` 운영 권한을 프론트에서 안전하게 확인할 수 있게 했다.
  - 상단 메뉴의 `소개` 오른쪽에 `사용자관리` 항목을 추가하고, 현재 운영 권한이 있는 계정에게만 보이도록 분기했다.
  - 사용자 디렉터리 UI를 `UserDirectoryPanel` 공용 컴포넌트로 분리해, 운영자 전용 페이지와 기존 관리자 도구에서 같은 화면을 재사용하도록 정리했다.
  - 사용자 디렉터리 조회 권한은 기존 `아레나 관리자` 전용에서 `아레나 운영자 또는 소식 운영자` 기준으로 확장해, 실제 운영 계정 전반이 사용할 수 있도록 맞췄다.
- **영향 파일:**
  - `digimon-tamagotchi-frontend/api/_lib/operatorAccess.js`
  - `digimon-tamagotchi-frontend/api/_lib/operatorHandlers.js`
  - `digimon-tamagotchi-frontend/api/operator/status.js`
  - `api/operator/status.js`
  - `digimon-tamagotchi-frontend/api/_lib/arenaHandlers.js`
  - `digimon-tamagotchi-frontend/src/utils/operatorApi.js`
  - `digimon-tamagotchi-frontend/src/hooks/useOperatorStatus.js`
  - `digimon-tamagotchi-frontend/src/data/headerNavigation.js`
  - `digimon-tamagotchi-frontend/src/components/layout/TopNavigation.jsx`
  - `digimon-tamagotchi-frontend/src/components/layout/TopNavigation.test.jsx`
  - `digimon-tamagotchi-frontend/src/components/admin/UserDirectoryPanel.jsx`
  - `digimon-tamagotchi-frontend/src/components/AdminModal.jsx`
  - `digimon-tamagotchi-frontend/src/pages/OperatorUsers.jsx`
  - `digimon-tamagotchi-frontend/src/pages/OperatorUsers.test.jsx`
  - `api/_lib/operatorHandlers.test.js`
  - `api/_lib/arenaHandlers.test.js`
  - `docs/REFACTORING_LOG.md`
- **검증:**
  - `node --test api/_lib/arenaHandlers.test.js api/_lib/operatorHandlers.test.js`
  - `CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/components/AdminModal.test.jsx src/components/layout/TopNavigation.test.jsx src/pages/OperatorUsers.test.jsx`
  - `NODE_OPTIONS=--openssl-legacy-provider npm run build`

## [2026-04-12] 운영자 권한 체계를 단일 `운영자` 역할로 통합

- **목적:** 소식 운영자와 아레나 관리자를 따로 구분하던 구조를 줄이고, 실제 운영 화면과 권한 판단을 하나의 `운영자` 기준으로 읽히게 정리한다.
- **변경사항:**
  - `OPERATOR_UIDS`, `OPERATOR_EMAILS`를 공통 운영자 기준 env로 추가하고, 기존 `ARENA_ADMIN_*`, `NEWS_EDITOR_*` 값도 함께 읽는 호환 레이어를 `operatorConfig.js`에 분리했다.
  - 아레나 관리자 검증과 소식 발행 검증이 모두 같은 `isOperatorIdentity()`를 사용하도록 맞춰 서버 권한 기준을 하나로 통합했다.
  - 운영자 상태 API, 사용자 디렉터리 요약 카드, 역할 배지, 운영자 페이지 헤더에서 `아레나 / 소식` 세부 역할 표기를 제거하고 `운영자` 단일 역할만 보여 주도록 정리했다.
  - 사용자 디렉터리 요약도 `전체 사용자 / 운영자 / 일반 사용자` 3개 수치만 노출해 실제 화면에서 역할 구분이 더 단순하게 보이도록 정리했다.
  - `localhost` 개발환경에서는 `/api/operator/status`가 없거나 실패해도 `REACT_APP_OPERATOR_*` 기준으로 운영자 메뉴를 볼 수 있도록 클라이언트 fallback을 추가했다.
- **영향 파일:**
  - `digimon-tamagotchi-frontend/api/_lib/operatorConfig.js`
  - `digimon-tamagotchi-frontend/api/_lib/auth.js`
  - `digimon-tamagotchi-frontend/api/_lib/community.js`
  - `digimon-tamagotchi-frontend/api/_lib/operatorAccess.js`
  - `digimon-tamagotchi-frontend/api/_lib/arenaHandlers.js`
  - `digimon-tamagotchi-frontend/src/utils/operatorApi.js`
  - `digimon-tamagotchi-frontend/src/utils/operatorApi.test.js`
  - `digimon-tamagotchi-frontend/src/hooks/useOperatorStatus.js`
  - `digimon-tamagotchi-frontend/src/components/admin/UserDirectoryPanel.jsx`
  - `digimon-tamagotchi-frontend/src/pages/OperatorUsers.jsx`
  - `api/_lib/operatorHandlers.test.js`
  - `api/_lib/arenaHandlers.test.js`
  - `digimon-tamagotchi-frontend/src/components/AdminModal.test.jsx`
  - `digimon-tamagotchi-frontend/src/pages/OperatorUsers.test.jsx`
  - `docs/REFACTORING_LOG.md`
- **검증:**
  - `node --test api/_lib/arenaHandlers.test.js api/_lib/operatorHandlers.test.js`
  - `CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/components/AdminModal.test.jsx src/components/layout/TopNavigation.test.jsx src/pages/OperatorUsers.test.jsx`
  - `NODE_OPTIONS=--openssl-legacy-provider npm run build`

## [2026-04-12] Vercel Hobby 함수 수 제한에 맞춰 아레나 관리자 엔드포인트 통합

- **목적:** Vercel Hobby 플랜의 Serverless Function 12개 제한에 걸리지 않도록, 아레나 관리자용 세부 엔드포인트를 하나의 진입점으로 줄인다.
- **변경사항:**
  - `digimon-tamagotchi-frontend/api/arena/admin/config.js`가 이제 설정 저장뿐 아니라 `action=end-season`, `view=user-directory` 분기까지 함께 처리하도록 통합했다.
  - 프론트 클라이언트는 시즌 종료 요청을 `/api/arena/admin/config?action=end-season`, 사용자 디렉터리 조회를 `/api/arena/admin/config?view=user-directory`로 보내도록 바꿨다.
  - 중복 함수 수를 만들던 `digimon-tamagotchi-frontend/api/arena/admin/end-season.js`, `digimon-tamagotchi-frontend/api/arena/admin/users.js`는 제거한다.
- **영향 파일:**
  - `digimon-tamagotchi-frontend/api/arena/admin/config.js`
  - `digimon-tamagotchi-frontend/src/utils/arenaApi.js`
  - `tests/arena-entrypoints.test.js`
  - `docs/REFACTORING_LOG.md`
- **검증:**
  - `node --test tests/arena-entrypoints.test.js`
  - `CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/components/AdminModal.test.jsx src/utils/operatorApi.test.js`
  - `NODE_OPTIONS=--openssl-legacy-provider npm run build`
