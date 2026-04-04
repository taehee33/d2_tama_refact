# 리팩토링 로그

이 문서는 프로젝트의 주요 변경사항을 기록합니다.

---

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
  - 선택된 보드 소개 영역은 `커뮤니티 + 상태 + 제목 + 짧은 설명 + 핵심 칩`만 남기는 컴팩트 헤더로 줄이고, 기존 대형 hero 액션 버튼은 제거했다.
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
