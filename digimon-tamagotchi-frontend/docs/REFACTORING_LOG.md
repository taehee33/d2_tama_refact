# REFACTORING LOG

## 2026-04-10

### 도감 canonical 병합 코어와 관리자 마이그레이션 도구 추가
- `src/utils/encyclopediaMigrationCore.js`를 추가해 도감 엔트리 병합 규칙을 공통화했습니다. 이제 `isDiscovered` OR, `firstDiscoveredAt` 최소값, `lastRaisedAt` 최대값, `raisedCount` 최대값, `bestStats` 항목별 최대값, `history` 중복 제거 후 최신순 5개 유지 규칙을 한 곳에서 사용합니다.
- `src/hooks/useEncyclopedia.js`는 더 이상 `version docs -> root fallback -> 비어 있으면 slot/log 복구`처럼 단계별 조기 종료하지 않고, `users/{uid}/encyclopedia/{version}`, root `users/{uid}.encyclopedia`, legacy `slots/slotN.encyclopedia`, 슬롯/로그 기반 복구를 canonical 규칙으로 합쳐서 반환하도록 정리했습니다.
- 운영 중 fallback가 아직 필요한 계정은 브라우저 콘솔에서 한 번만 경고를 남기도록 해, version docs 이관이 끝나지 않은 사용자를 추적할 수 있게 했습니다.
- `scripts/backfillUserEncyclopedia.js`는 단순 root -> version 복사 스크립트에서, dry-run/apply 모드, UID 필터, achievement/maxSlots 재계산, `encyclopediaMigration` 메타데이터 기록까지 포함하는 관리자용 마이그레이션 엔진으로 확장했습니다.
- root `users/{uid}`는 여전히 compatibility mirror로 남기고, 1차 마이그레이션에서는 legacy root/slot 도감 필드를 삭제하지 않도록 유지했습니다.

### 테스트 보강
- `src/hooks/useEncyclopedia.test.js`는 load 시 slot legacy 확인이 항상 한 번 추가되는 현재 흐름에 맞춰 Firestore read expectation을 갱신했습니다.
- `tests/encyclopedia-migration.test.js`를 추가해 canonical 병합 규칙, dry-run 무변경 보장, apply 시 version/profile/root mirror 갱신을 검증했습니다.

### 영향받은 파일
- `src/utils/encyclopediaMigrationCore.js`
- `src/hooks/useEncyclopedia.js`
- `src/hooks/useEncyclopedia.test.js`
- `scripts/backfillUserEncyclopedia.js`
- `tests/encyclopedia-migration.test.js`
- `package.json`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 도감 데이터는 이미 `slots -> root -> version docs` 3세대가 혼재해 있어, 화면 로드와 관리자 백필이 서로 다른 병합 규칙을 쓰면 다시 누락이 생길 수 있습니다. 그래서 병합 규칙 자체를 공통 코어로 분리해 읽기와 이관이 같은 canonical 결과를 만들도록 맞췄습니다.
- version docs를 최종 원본으로 두되, root/slot legacy 데이터를 바로 지우면 운영 복구 위험이 크므로 1차 단계는 `읽기 fallback 유지 + 배치 이관 + 메타데이터 추적`까지로 범위를 제한하는 편이 가장 안전합니다.

### 디지타마 내부/고급 카운터 센티널 표시 보정
- `src/components/StatsPopup.jsx`, `src/components/StatsPanel.jsx`의 `내부/고급 카운터`는 더 이상 디지타마용 센티널 타이머를 raw 분/초 숫자로 그대로 노출하지 않고, `비활성`, `알 단계 전용` 같은 상태 문구로 치환해 보여 주도록 정리했습니다.
- 공통 표시 규칙은 `src/utils/internalCounterTimerDisplay.js`로 분리해, `hunger/strength <= 0`, `Digitama + poop >= 999` 같은 예외를 한 곳에서 처리하고 일반 단계 타이머는 기존 `X min (남은 시간: Ym Zs)` 형식을 유지하도록 맞췄습니다.
- 디버그 점검에 쓰이는 `StatsPopup` OLD 탭의 raw 숫자 목록은 그대로 두고, 실제 사용자가 혼동하기 쉬운 NEW 탭과 축약형 `StatsPanel`의 표현 계층만 좁게 보정했습니다.

### 테스트 보강
- `src/components/StatsPopup.test.jsx`에 디지타마 센티널 표시 케이스와 일반 단계 회귀 케이스를 추가했습니다.
- `src/components/StatsPanel.test.jsx`를 새로 추가해 축약형 패널도 같은 규칙으로 `비활성`, `알 단계 전용`, 일반 countdown 표시를 렌더링하는지 고정했습니다.

### 영향받은 파일
- `src/utils/internalCounterTimerDisplay.js`
- `src/components/StatsPopup.jsx`
- `src/components/StatsPanel.jsx`
- `src/components/StatsPopup.test.jsx`
- `src/components/StatsPanel.test.jsx`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 이번 작업은 저장 데이터나 lazy update 계산을 바꾸는 것이 아니라, 디지타마 단계의 센티널 값을 사람이 읽는 진단 문구로 바꾸는 표시 계층 문제이므로 공용 helper와 렌더링 레이어만 좁게 수정하는 편이 가장 안전합니다.
- `999`를 모든 상황에서 숨기면 이후 실제 긴 주기 데이터까지 가릴 수 있으므로, 현재 단계가 `Digitama`인 경우에만 특수 처리하고 일반 단계 카운터 형식은 그대로 유지하는 쪽이 회귀 위험이 낮습니다.

### StatsPopup 개발자 모드 NEW 탭 실시간 갱신 복구
- `src/components/StatsPopup.jsx`는 그동안 개발자 모드가 켜져 있으면 NEW 탭도 `editableStats` 스냅샷을 계속 바라봐서, 실제 게임 루프가 `lifespanSeconds`, `timeToEvolveSeconds`를 갱신해도 팝업 안에서는 시간이 멈춘 것처럼 보일 수 있었습니다.
- 이제 편집용 로컬 상태는 `OLD` 탭에서만 사용하고, NEW 탭은 항상 최신 `stats` props를 직접 렌더링하도록 바꿨습니다. 동시에 OLD 탭 밖에 있을 때는 `editableStats`를 최신 props로 다시 동기화해, 다시 OLD 탭으로 돌아가도 오래된 스냅샷을 붙잡지 않도록 정리했습니다.
- `src/components/StatsPopup.test.jsx`에는 개발자 모드 NEW 탭에서 props rerender 시 `Lifespan`, `Time to Evolve`가 실제로 갱신되는 회귀 테스트를 추가했습니다.

### 영향받은 파일
- `src/components/StatsPopup.jsx`
- `src/components/StatsPopup.test.jsx`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 이 버그는 게임 시간 계산이나 저장 로직이 아니라, 팝업이 어떤 state source를 기준으로 렌더링하느냐의 문제였으므로 `useGameRealtimeLoop`나 lazy update를 건드리지 않고 `StatsPopup` 내부 상태 선택 규칙만 국소적으로 수정하는 편이 가장 안전합니다.
- 개발자 모드 편집 기능은 OLD 탭에서만 필요하므로, NEW 탭까지 편집 스냅샷을 공유하지 않게 분리하면 실시간 표시 정확성과 수동 편집 UX를 동시에 유지할 수 있습니다.

### 홈과 플레이 허브 이어하기 카드에 슬롯 메타/스프라이트 요약 추가
- `src/pages/Home.jsx`의 `오늘 할 일` 카드는 이제 최근 슬롯 스프라이트를 함께 보여 주고, `슬롯 번호`, `성장 단계·기종·버전`, `슬롯 이름·생성일`을 카드 안에서 바로 확인할 수 있도록 확장했습니다.
- 홈 하단 `최근 디지몬` 목록도 최신 활동 기준 슬롯을 우선 사용하고, 각 카드에 스프라이트와 슬롯 메타를 함께 노출해 이어하기 전 현재 슬롯 상태를 더 빨리 파악할 수 있게 정리했습니다.
- `src/pages/PlayHub.jsx`의 `최근 이어하기` 카드에도 같은 슬롯 메타 블록을 추가해, 홈과 플레이 허브가 서로 다른 정보량을 보여 주던 차이를 줄였습니다.
- 공통 문자열 조합은 `src/utils/slotInfoUtils.js`로 분리하고, 관련 UI 검증은 `Home.test.jsx`, `PlayHub.test.jsx`에 보강했습니다.

### 영향받은 파일
- `src/pages/Home.jsx`
- `src/pages/PlayHub.jsx`
- `src/utils/slotInfoUtils.js`
- `src/index.css`
- `src/pages/Home.test.jsx`
- `src/pages/PlayHub.test.jsx`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 이번 변경은 저장 구조나 슬롯 정렬 규칙을 바꾸는 작업이 아니라, 이미 존재하는 슬롯 메타데이터를 홈/허브 진입점에서 어떻게 요약해서 보여 주느냐의 문제이므로 읽기 전용 표시 계층과 문자열 helper만 좁게 확장하는 편이 가장 안전합니다.
- 홈과 플레이 허브의 최근 슬롯 카드가 같은 데이터를 서로 다르게 보여 주면 사용자가 이어하기 직전 맥락을 다시 확인해야 하므로, 스프라이트와 메타 형식을 공통 helper로 맞춰 두는 편이 이후 다른 진입점으로 확장할 때도 유지보수에 유리합니다.

## 2026-04-09

### BattleScreen 아레나 snapshot 우선순위와 adapter `24:00` 경계 보정
- `src/components/BattleScreen.jsx`에 아레나 상대 데이터 해석 helper를 추가해, 아레나 배틀은 `digimonSnapshot.slotVersion` 기준의 데이터맵을 먼저 조회하고 `snapshot.stats.power`, `snapshot.stats.type`, `snapshot.attackSprite`를 우선 사용하도록 정리했습니다.
- 적 발사체는 이제 `arena snapshot attackSprite -> enemyData.attackSprite -> 버전 데이터맵 attackSprite -> 기존 v1 fallback` 순으로 해석해, Ver.2/Ver.3 슬롯 상대가 Ver.1 발사체로 잘못 보일 가능성을 줄였습니다.
- `src/data/v1/adapter.js`는 `24:00`을 더 이상 `23:00`으로 clamp하지 않고 표시 문자열은 그대로 유지한 채, `sleepSchedule` 계산에서만 자정(`0`)으로 변환하도록 수정했습니다.
- `src/components/GameModals.jsx`, `src/hooks/useEvolution.js`에는 `slotRuntimeDataMap`, `slotEvolutionDataMap` alias를 추가해, 슬롯별 데이터맵과 옛날 prop 이름 사이의 혼동을 줄였습니다.

### 테스트 보강
- `src/components/BattleScreen.test.js`를 추가해 버전별 데이터맵 우선 조회, 아레나 snapshot power/type 반영, snapshot fallback enemy data 생성, 적 발사체 우선순위를 고정했습니다.
- `src/data/v1/adapter.test.js`를 추가해 `sleepTime: "24:00"`과 `wakeTime: "24:00"`이 표시 문자열을 유지하면서 `sleepSchedule.start/end`만 자정으로 계산되는지 검증했습니다.

### 영향받은 파일
- `src/components/BattleScreen.jsx`
- `src/components/BattleScreen.test.js`
- `src/components/GameModals.jsx`
- `src/hooks/useEvolution.js`
- `src/data/v1/adapter.js`
- `src/data/v1/adapter.test.js`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 이번 변경은 훈련/배틀 규칙이나 진화 밸런스를 바꾸는 작업이 아니라, 이미 저장된 슬롯 버전과 아레나 snapshot이 가진 메타데이터를 어느 계층에서 우선 해석하느냐의 문제라서 표시/참조 경계만 좁게 보정하는 편이 가장 안전합니다.
- 어댑터는 아직 런타임 호환 계층으로 필요하지만, `24:00` 같은 데이터 왜곡은 실제 수면 스케줄 계산에 영향을 줄 수 있으므로 제거보다 국소 보정이 유지보수와 운영 안정성 모두에 유리합니다.

### 슬롯 데이터맵 alias 정리로 `ver1` 직접 참조 오해 줄이기
- `src/hooks/useGameAnimations.js`, `src/hooks/useGameHandlers.js`, `src/hooks/useDeath.js`, `src/hooks/useGameData.js`, `src/components/SettingsModal.jsx`에서, props 이름은 그대로 유지하되 내부에서는 `slotEvolutionDataMap`, `slotRuntimeDataMap`, `digimonDataMap` 같은 역할 중심 alias를 사용하도록 정리했습니다.
- 이 변경으로 현재 슬롯 버전 데이터를 받는 훅/모달 내부에서 `newDigimonDataVer1`, `digimonDataVer1`가 실제 Ver.1 고정 데이터인지, 아니면 슬롯별 데이터맵인지 코드를 읽을 때 더 분명하게 드러나도록 맞췄습니다.
- `SettingsModal`의 개발자 디지몬 선택도 더 이상 `Ver.2면 v2, 아니면 v1` 식의 좁은 분기만 보지 않고, `getDigimonDataMapByVersion(slotVersion)`과 현재 슬롯 데이터 fallback을 함께 쓰도록 정리해 Ver.3 이후에도 같은 흐름을 재사용할 수 있게 했습니다.

### 영향받은 파일
- `src/hooks/useGameAnimations.js`
- `src/hooks/useGameHandlers.js`
- `src/hooks/useDeath.js`
- `src/hooks/useGameData.js`
- `src/components/SettingsModal.jsx`
- `docs/REFACTORING_LOG.md`

### 검증
- `CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/hooks/useGameHandlers.test.js src/hooks/useGameData.test.js src/hooks/useEvolution.test.js src/components/GameModals.test.jsx src/hooks/game-runtime/buildGameModalBindings.test.js`
- `NODE_OPTIONS=--openssl-legacy-provider npm run build`

### Ver.3 원작 로스터를 Super Ultimate 2종까지 확장
- `src/data/v3/digimons.js`에 Ver.3 최종 로스터 기준 `Chaosmon`, `Millenniumon`을 `Super Ultimate`로 추가해, 기존 21엔트리 골격을 23엔트리 완성형 데이터셋으로 확장했습니다.
- `BanchoLeomon -> Chaosmon`, `Chimairamon -> Millenniumon` 조그레스 메타데이터를 원작 기준으로 반영했지만, 현재 앱은 Ver.4/Ver.5 활성 슬롯이 없으므로 실제 획득 경로보다 마스터데이터/도감 완성을 우선했습니다.
- `Centaurmon`, `Ogremon` 내부 ID는 기존 저장 호환성을 위해 유지하고, 원작 외부 표기 차이는 코드 주석과 문서 판단 기준으로만 관리합니다.

### 조그레스 가이드 표시를 외부 버전 파트너까지 안전하게 일반화
- `src/utils/jogressUtils.js`를 추가해 Ver.1↔Ver.2 크로스 조그레스 이름 표기와, Ver.3처럼 현재 앱에 없는 외부 버전 파트너가 필요한 조그레스의 안내 문구를 한 곳에서 처리하도록 정리했습니다.
- `EvolutionGuideModal`, `DigimonGuidePanel`은 이제 `Darkdramon Ver.4`, `Mugendramon Ver.5` 같은 파트너를 텍스트로 정확히 보여주고, 실제 앱에서 아직 지원되지 않는 조합은 “정보 표시용”이라는 안내를 함께 렌더링합니다.
- `buildGamePageViewModel`은 현재 지원되는 버전에 실제 파트너 데이터가 있는 조그레스만 액션 버튼을 열도록 바꿔, Ver.3 최종 로스터를 추가해도 플레이 버튼이 잘못 노출되지 않게 했습니다.

### Ver.3 placeholder 자산과 테스트 보강
- `public/Ver3_Mod_TH/481.png`, `public/Ver3_Mod_TH/496.png`를 기존 Ver.3 임시 자산 복사본으로 추가해 `Chaosmon`, `Millenniumon`이 도감/마스터데이터/UI에서 깨진 이미지 없이 렌더링되도록 맞췄습니다.
- 테스트는 Ver.3 도감 대상에 `Chaosmon`, `Millenniumon`이 포함되는지, 외부 버전 파트너 조그레스가 안내 전용으로 보이는지, 외부 버전 조그레스가 액션 버튼을 열지 않는지를 고정했습니다.

### 영향받은 파일
- `src/data/v3/digimons.js`
- `src/utils/jogressUtils.js`
- `src/utils/jogressUtils.test.js`
- `src/components/EvolutionGuideModal.jsx`
- `src/components/panels/DigimonGuidePanel.jsx`
- `src/components/panels/DigimonGuidePanel.test.jsx`
- `src/hooks/game-runtime/buildGamePageViewModel.js`
- `src/hooks/game-runtime/buildGamePageViewModel.test.js`
- `src/utils/encyclopediaSummary.test.js`
- `public/Ver3_Mod_TH/481.png`
- `public/Ver3_Mod_TH/496.png`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 원작 Ver.3 로스터는 [Humulos Ver.3 진화표](https://humulos.com/digimon/dmc/#c3_anchor), [Humulos Digimon List](https://humulos.com/digimon/dmc/list/), [Wikimon Ver.3](https://wikimon.net/Digital_Monster_COLOR_Ver.3)를 기준으로 확정할 수 있었지만, 현재 앱에는 Ver.4/Ver.5 실플레이 경로가 없으므로 조그레스 종착점은 `데이터/도감 완성 우선`으로 넣는 편이 안전했습니다.
- `VB for DMC Sprite Conversion`은 Ver.3 전체 로스터를 이름 기준으로 1:1 보장하지 못하므로, 신규 2종은 별도 원본 추출 대신 `placeholder` 정책으로 우선 연결했습니다.
- 조그레스 버튼 노출을 파트너 존재 여부 기반으로 좁히면, 미래에 Ver.4/Ver.5 데이터가 실제로 추가되었을 때 별도 하드코딩 없이 자연스럽게 버튼이 열리도록 유지할 수 있습니다.

### 검증
- `CI=true NODE_OPTIONS=--openssl-legacy-provider npm test -- --watch=false --runInBand --runTestsByPath src/utils/jogressUtils.test.js src/components/panels/DigimonGuidePanel.test.jsx src/hooks/game-runtime/buildGamePageViewModel.test.js src/utils/encyclopediaSummary.test.js`

## 2026-04-08

### ver3 전용 스프라이트 폴더 분리와 임시 자산 독립
- ver3 데이터는 초기 골격 단계에서 `/images`를 공유하고 있었지만, 이후 실제 ver3 스프라이트 정리 작업을 안전하게 이어가려면 ver1 공용 이미지와 경로를 분리해 두는 편이 유지보수에 유리하다고 판단했습니다.
- `src/data/v3/digimons.js`의 `V3_SPRITE_BASE`를 `/Ver3_Mod_TH`로 전환하고, 현재 ver3가 참조하는 임시 스프라이트 번호 21개만 `public/images`에서 `public/Ver3_Mod_TH`로 복사해 즉시 화면이 깨지지 않도록 정리했습니다.
- 이번 단계에서는 임시 번호 체계와 ver3 디지몬 매핑은 그대로 유지하고, 폴더 경로만 독립시켜 이후 혼합 원본 스프라이트 분류와 최종 번호 재매핑을 별도 작업으로 이어갈 수 있게 했습니다.

### 영향받은 파일
- `src/data/v3/digimons.js`
- `public/Ver3_Mod_TH/*.png`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- ver3 경로를 여전히 `/images`에 두면 추후 ver3 전용 자산을 덮어쓰는 순간 ver1 공용 스프라이트와 충돌할 가능성이 커집니다.
- 지금처럼 `spriteBasePath`만 먼저 독립시키면 데이터 구조와 렌더 호출부는 그대로 둔 채 자산 정리만 점진적으로 진행할 수 있어, 플레이 가능한 상태를 유지하면서 후속 분류 작업의 리스크를 낮출 수 있습니다.

### 검증
- `public/Ver3_Mod_TH` 생성 및 임시 번호 21개 복사 확인
- `NODE_OPTIONS=--openssl-legacy-provider npm run build`

### ver3 기본 골격 추가와 버전 공용 분기 정리
- `src/data/v3/digimons.js`와 `src/data/v3/index.js`를 추가해 ver3 전용 스타터, 사망 폼, 유년기~궁극체 기본 진화 트리를 새 데이터 셋으로 등록했습니다.
- ver3 스프라이트는 현재 로컬 리소스와 1:1 매핑이 완료되지 않아, 데이터 파일 안에 `임시 스프라이트 번호`라는 점을 주석으로 명시하고 우선 플레이 가능한 기본 골격을 먼저 연결했습니다.
- `digimonVersionUtils`를 새 공용 버전 레지스트리로 도입해 `starterId`, `deathFormIds`, `spriteBasePath`, `dataMap`을 한 곳에서 관리하도록 만들고, 새 디지몬 생성/로드/리셋/사망/도감 기록 경로가 더 이상 `Ver.1 vs Ver.2` 이분법에 묶이지 않도록 정리했습니다.
- 도감 저장 구조와 요약 계산도 `SUPPORTED_DIGIMON_VERSIONS` 기준으로 일반화해 ver3 탭이 함께 나타나고, 현재 디지몬을 도감에 보정하는 흐름도 ID 기준으로 버전을 찾아 올바른 ver3 문서에 기록되도록 바꿨습니다.
- 설정의 개발자 디지몬 선택, 마스터 데이터 패널 버전 탭, 스파링/아레나/조그레스 방 목록의 표시용 데이터 조회도 공용 버전 헬퍼를 사용하도록 바꿔 ver3 슬롯이 들어와도 v1 데이터로 잘못 표시되거나 `/images`로 강제 fallback 되는 경로를 줄였습니다.

### 영향받은 파일
- `src/data/v3/digimons.js`
- `src/data/v3/index.js`
- `src/utils/digimonVersionUtils.js`
- `src/hooks/useUserSlots.js`
- `src/data/stats.js`
- `src/utils/digimonLogSnapshot.js`
- `src/hooks/useDeath.js`
- `src/hooks/useGameData.js`
- `src/hooks/useEvolution.js`
- `src/pages/Game.jsx`
- `src/components/play/NewDigimonModal.jsx`
- `src/components/SettingsModal.jsx`
- `src/components/panels/EncyclopediaPanel.jsx`
- `src/hooks/useEncyclopedia.js`
- `src/logic/encyclopediaMaster.js`
- `src/utils/encyclopediaSummary.js`
- `src/contexts/MasterDataContext.jsx`
- `src/utils/masterDataUtils.js`
- `src/components/DigimonMasterDataPanel.jsx`
- `src/components/JogressPartnerSlotModal.jsx`
- `src/components/JogressRoomListModal.jsx`
- `src/components/SparringModal.jsx`
- `src/components/BattleScreen.jsx`
- `src/components/ArenaScreen.jsx`
- `src/utils/communitySnapshotUtils.js`
- `src/hooks/useEncyclopedia.test.js`
- `src/utils/encyclopediaSummary.test.js`
- `src/components/panels/EncyclopediaPanel.test.jsx`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 이번 작업은 ver3 데이터만 추가하는 것으로 끝나지 않고, `DigitamaV2`나 `slot.version === "Ver.2"`처럼 숨어 있던 분기를 공용 레지스트리 기반으로 바꾸는 것이 핵심이었습니다. 그래야 이후 ver4 이상을 붙일 때도 같은 자리에 또 다른 삼항 분기를 늘리지 않아도 됩니다.
- 스프라이트 자산이 아직 완전히 정리되지 않은 상태라 이번 범위에서는 `정확한 최종 번호`보다 `플레이 가능한 데이터 골격과 저장/도감/선택 흐름 정합성`을 먼저 맞추는 편이 리스크가 낮습니다.
- ver3는 아직 조그레스 특수 라인과 최종 스프라이트 매핑이 확정되지 않았으므로, 현재 단계에서는 기본 성장 루프가 끊기지 않는 최소 안전 범위까지만 연결하고 나머지는 후속 자산 정리 후 확장하는 방향이 유지보수에 유리합니다.

### 검증
- `npm test -- --runInBand --watch=false src/hooks/useEncyclopedia.test.js src/utils/encyclopediaSummary.test.js src/components/panels/EncyclopediaPanel.test.jsx`
- `NODE_OPTIONS=--openssl-legacy-provider npm run build`

### 몰입형 플레이에 가로 디지바이스 모드와 슬롯별 다마고치 스킨 추가
- 슬롯 루트 문서에 `immersiveSettings`를 추가하고, `{ layoutMode, skinId }`를 `backgroundSettings`와 같은 지연 저장 패턴으로 관리해 각 슬롯이 마지막으로 사용한 `세로/가로` 모드와 스킨 프리셋을 기억하도록 확장했습니다.
- `useGameState`, `useGameData`, `useGamePagePersistenceEffects`, `useUserSlots`를 연결해 새 슬롯 기본값은 `portrait + tama-default-none`으로 시작하고, 로드 직후에는 Firestore에 다시 쓰지 않으며 사용자가 실제로 변경했을 때만 저장되도록 게이트를 맞췄습니다.
- 몰입형 상단 바에 `세로/가로` 토글과 `스킨 변경` 버튼을 추가했고, 몰입형 내부에서만 보이는 스킨 선택 패널로 `기본(없음)`, `클래식 핑크`, `민트`, `클리어 블루` 프리셋을 전환할 수 있게 했습니다.
- 세로 몰입형은 기존 플레이 화면을 다마고치 셸 안에 감싸는 방향으로 유지했고, 가로 몰입형은 왼쪽 LCD/상태 요약/보조 액션, 오른쪽 대형 메뉴 버튼 그리드로 분리해 실제 디바이스를 만지는 느낌에 더 가깝게 재구성했습니다.
- 모바일에서는 브라우저 방향 잠금은 강제하지 않고, 가로 몰입형을 세로로 보고 있을 때만 회전 안내를 띄우고 셸 크기를 살짝 줄여 사용 흐름을 끊지 않도록 정리했습니다.
- 새 유틸/컴포넌트 테스트로 `immersiveSettings` 정규화, 저장 게이트, 상단 바 토글, 가로 조작 버튼 잠금 규칙, 셸 분기 렌더를 고정했고, 프로덕션 빌드까지 다시 돌려 JSX/스타일 조립이 문제없는지 확인했습니다.
- 후속 조정으로 `기본(없음)` 스킨을 실제 기본값으로 바꿔, 새 슬롯과 fallback 로드 모두 컬러 스킨 없이 중립적인 기본 셸로 시작하도록 정리했습니다.
- 후속 조정으로 세로 몰입형은 가로모드 개발 전의 기존 몰입형 배치로 되돌리고, 전용 디바이스 셸과 스킨 노출은 가로모드에서만 유지하도록 분기해 기존 세로 플레이 감각을 복구했습니다.

### 영향받은 파일
- `src/data/immersiveSettings.js`
- `src/utils/immersiveSettings.js`
- `src/utils/immersiveSettings.test.js`
- `src/hooks/useGameState.js`
- `src/hooks/useGameData.js`
- `src/hooks/useUserSlots.js`
- `src/hooks/game-runtime/useGamePagePersistenceEffects.js`
- `src/hooks/game-runtime/useGamePagePersistenceEffects.test.js`
- `src/pages/Game.jsx`
- `src/components/MenuIconButtons.jsx`
- `src/styles/MenuIconButtons.css`
- `src/components/layout/ImmersiveGameTopBar.jsx`
- `src/components/layout/ImmersiveGameTopBar.test.jsx`
- `src/components/layout/ImmersiveDeviceShell.jsx`
- `src/components/layout/ImmersiveDeviceShell.test.jsx`
- `src/components/layout/ImmersiveLandscapeControls.jsx`
- `src/components/layout/ImmersiveLandscapeControls.test.jsx`
- `src/components/layout/ImmersiveSkinPicker.jsx`
- `src/index.css`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 이번 변경은 게임 규칙이나 lazy update를 손대는 작업이 아니라 몰입형 뷰의 저장/표시 계층 확장이므로, `device`와 섞지 않고 슬롯 루트에 별도 `immersiveSettings`를 두는 편이 기존 기종 정보와 시각 프리셋 책임을 깔끔하게 분리할 수 있습니다.
- 저장 시점을 `backgroundSettings`와 같은 게이트 방식으로 맞추면 로드 직후 불필요한 Firestore 쓰기를 막으면서도 사용자가 토글이나 스킨을 바꾼 순간만 안전하게 영속화할 수 있어 비용과 일관성을 함께 지킬 수 있습니다.
- 가로 조작은 이번 범위에서 하드웨어식 포커스 이동까지 재설계하지 않고 기존 메뉴 액션을 큰 버튼 재배치로 재사용해, 게임 로직·잠금 규칙·모달 흐름을 건드리지 않으면서도 디바이스 감성만 선명하게 강화할 수 있습니다.

### 부상 상태에서 idle roaming이 재생되던 캔버스 렌더 회귀 수정
- `gameAnimationViewModel`은 이미 `isInjured`일 때 `sick` 애니메이션과 부상 프레임을 원하도록 되어 있었지만, `Canvas`는 `currentAnimation === "idle"`만 기준으로 `idleMotionTimeline`을 허용해 본체가 아픈 상태에서도 돌아다니는 장면이 잠깐 보일 수 있었습니다.
- `Canvas`의 idle 타임라인 preload 조건과 실제 사용 조건 모두에 `!isInjured`를 추가해, 부상 중에는 애니메이션 상태가 잠깐 `idle`이어도 roaming 좌표와 flip 타임라인을 전혀 사용하지 않고 전달된 부상 프레임만 중앙에 그리도록 보강했습니다.
- 회귀 테스트로 부상 상태에서는 `210/211` idle 타임라인 스프라이트를 preload하지 않고, 부상 프레임과 부상 아이콘 스프라이트만 사용하는 규칙을 고정했습니다.

### 영향받은 파일
- `src/components/Canvas.jsx`
- `src/components/Canvas.test.jsx`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 이번 문제는 부상 판정이나 저장 로직이 아니라, 렌더 계층이 `currentAnimation`의 잠깐의 흔들림을 어떻게 해석하느냐의 문제이므로 `useGameActions`나 상태 저장 파이프라인 대신 `Canvas`의 시각화 게이트만 좁게 수정하는 편이 가장 안전합니다.
- 수면 상태와 같은 방식으로 부상 상태에서도 idle 타임라인 자체를 차단하면, 액션 직후 `idle` 전환이 잠깐 끼더라도 sick 포즈가 안정적으로 유지되어 사용자 체감과 상태 표현이 일치합니다.

### 잠들기 준비 중 상태 배지와 화면 라벨에 15초 카운트다운 노출
- `StatsPopup`에는 이미 `fastSleepStart` 기준 15초 안내가 있었지만, 사용자가 실제로 자주 보는 상단 상태 배지와 게임 화면 우상단 수면 라벨은 `잠들기 준비 중` 고정 문자열만 보여 주고 있어 카운트다운이 보이지 않던 문제를 수정했습니다.
- `sleepUtils`에 빠른 잠들기 남은 초 계산 helper를 추가하고, `digimonStatusMessages`의 `FALLING_ASLEEP` 메시지는 `잠들기 준비 10초 🌙`처럼 본문과 상세 힌트 모두 현재 남은 초를 반영하도록 맞췄습니다.
- `GameScreen`도 같은 helper를 사용해 우상단 수면 라벨에서 `잠들기 준비 10초` 형태로 남은 초를 표시하도록 정리했고, 테스트에서는 고정된 현재 시각을 주입할 수 있도록 선택적 `currentTime` prop을 지원하게 했습니다.

### 영향받은 파일
- `src/utils/sleepUtils.js`
- `src/components/digimonStatusMessages.js`
- `src/components/digimonStatusMessages.test.js`
- `src/components/GameScreen.jsx`
- `src/components/GameScreen.test.jsx`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 이번 이슈는 수면 상태 계산이 아니라 동일한 `fastSleepStart` 기반 countdown을 어떤 UI가 실제로 소비하느냐의 문제라, 상태 기계나 저장 로직을 건드리지 않고 표시 계층에서 공용 helper를 재사용하는 편이 가장 안전합니다.
- 남은 초 계산을 helper로 모아 두면 `StatsPopup`, 상단 배지, 게임 화면 라벨이 앞으로도 같은 경계값으로 움직여 표시 불일치를 줄일 수 있습니다.

### 낮잠 중 상태 배지와 화면 라벨에 남은 낮잠 시간 노출
- `StatsPopup`에는 `napUntil` 기준 남은 낮잠 시간이 이미 보였지만, 상단 상태 배지와 게임 화면 우상단 라벨은 `낮잠 중` 고정 문구만 보여 주고 있어 언제 깨어나는지 한눈에 알기 어려웠습니다.
- 같은 수면 countdown helper를 재사용해 `NAPPING` 메시지 본문을 `낮잠 1분 5초 😴`처럼 바꾸고, 상세 힌트도 `1분 5초 뒤에 다시 깨어나요.`로 맞췄습니다.
- `GameScreen` 우상단 라벨도 `napUntil`이 남아 있는 동안은 `낮잠 1분 5초` 형태로 남은 시간을 보여 주고, `napUntil`이 없거나 지난 경우에만 기존 `낮잠 중` 문구로 fallback 하도록 정리했습니다.

### 영향받은 파일
- `src/utils/sleepUtils.js`
- `src/components/digimonStatusMessages.js`
- `src/components/digimonStatusMessages.test.js`
- `src/components/GameScreen.jsx`
- `src/components/GameScreen.test.jsx`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 이번 변경도 상태 저장이나 수면 판정 규칙이 아니라 `napUntil` 기반 남은 시간을 어떤 UI에 노출하느냐의 문제이므로, 기존 `StatsPopup` 계산식을 복제하기보다 공용 helper를 재사용해 표시 계층만 정리하는 편이 안전합니다.
- `FALLING_ASLEEP`와 `NAPPING`이 같은 duration formatter를 쓰도록 맞춰 두면, 수면 관련 요약 UI 전반에서 시간 표시 방식이 일정하게 유지됩니다.

### 낮잠 상태에서 idle 타임라인이 재생되던 수면 모션 회귀 수정
- `NAPPING` 상태 배지와 `Zzz` 오버레이는 정상인데, `Canvas`가 `currentAnimation === "idle"`만 보고 `idleMotionTimeline` 스프라이트를 계속 preload/재생해 본체가 걷는 것처럼 보이던 문제를 수정했습니다.
- `gameAnimationViewModel`은 `sleepStatus`를 표시용 기준과 같은 방식으로 정규화한 뒤 `NAPPING`, `SLEEPING`, `SLEEPING_LIGHT_ON`을 모두 수면형 상태로 취급해, 항상 수면 프레임(`+11`, `+12`)과 `sleep` 애니메이션을 반환하도록 정리했습니다.
- `Canvas`는 수면형 상태에서는 idle 타임라인 스프라이트를 preload하지 않고, 애니메이션 상태가 잠깐 `idle`이어도 `canUseIdleMotionTimeline`을 강제로 꺼서 전달받은 수면 프레임만 중앙에 그리도록 보강했습니다.
- 회귀 테스트로 `NAPPING`이 수면 프레임과 `sleep` 애니메이션을 선택하는지, 그리고 낮잠 중에는 `210/211` idle 스프라이트를 preload하지 않는지 고정했습니다.

### 영향받은 파일
- `src/hooks/game-runtime/gameAnimationViewModel.js`
- `src/hooks/game-runtime/gameAnimationViewModel.test.js`
- `src/components/Canvas.jsx`
- `src/components/Canvas.test.jsx`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 이번 이슈는 수면 상태 판정이나 저장 데이터보다 “수면 상태와 캔버스 idle 모션 렌더가 잠깐 어긋날 때 어떤 시각화를 우선하느냐”의 문제라, lazy update나 수면 상태 기계 대신 view-model과 `Canvas`의 시각화 게이트만 좁게 보강하는 편이 가장 안전합니다.
- 수면형 상태에서 idle 타임라인 자체를 차단하면, 액션 직후 `currentAnimation`이 잠깐 흔들리더라도 본체가 걷는 장면이 다시 나타나지 않아 수면 UX를 안정적으로 유지할 수 있습니다.

### Stats OLD 탭의 부상 체크박스 즉시 반영 회귀 수정
- `StatsPopup`의 OLD 탭은 controlled input인데, `GameModals`가 변경값을 비동기 `setDigimonStatsAndSave`로만 넘기고 있어 체크박스를 눌러도 한 프레임 동안 예전 값으로 다시 그려지는 문제가 있었습니다.
- Stats 팝업 변경 연결부를 `applyStatsPopupChange` helper로 분리하고, 저장 전에 `setDigimonStats`로 메모리 상태를 먼저 갱신한 뒤 같은 payload를 비동기 저장하도록 바꿨습니다.
- 이 변경으로 `isInjured` 체크박스뿐 아니라 OLD 탭의 다른 개발용 입력도 저장 완료를 기다리지 않고 즉시 UI에 반영됩니다.
- 추가로 OLD 탭의 부상 상태 입력을 작은 체크박스에서 넓은 토글 버튼으로 바꿔, 모바일 스크롤 모달 안에서도 더 쉽게 눌리고 현재 ON/OFF 상태가 바로 읽히도록 정리했습니다.
- 또 OLD 탭은 모달이 열려 있는 동안 자체 편집 상태를 유지하도록 바꿔, 부모 저장이나 실시간 틱과 별개로 토글 버튼이 즉시 ON/OFF로 반응하도록 보강했습니다.

### 영향받은 파일
- `src/components/GameModals.jsx`
- `src/components/GameModals.test.jsx`
- `src/components/StatsPopup.jsx`
- `src/components/StatsPopup.test.jsx`
- `src/pages/Game.jsx`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 문제 원인은 스탯 편집 UI가 아니라 `StatsPopup -> GameModals -> saveStats` 연결부의 비동기 반영 타이밍이었기 때문에, 입력 컴포넌트 자체를 로컬 draft 상태로 복잡하게 늘리기보다 변경 연결부만 보강하는 편이 리스크가 낮습니다.
- 메모리 상태 선반영 후 저장을 뒤따르게 하면 기존 저장 파이프라인과 lazy update 흐름은 유지하면서도 dev 편집 UI의 controlled input 체감을 안정적으로 복구할 수 있습니다.

### 부상 오버레이의 1시/7시 이모지를 주사기로 고정
- `GameScreen`의 부상 상태 오버레이가 매번 4개 이모지를 전부 랜덤으로 고르던 흐름을 정리하고, 1시와 7시 위치는 항상 `💉`가 나오도록 고정했습니다.
- 나머지 11시와 5시 위치만 기존 부상 이모지 풀에서 랜덤으로 선택되도록 바꿔, 요청한 시계 방향 배치는 유지하면서도 주변의 아픈 분위기 연출은 그대로 남겼습니다.
- 중복된 4개 절대배치 `div`는 위치 배열 기반 렌더로 통합하고, `GameScreen` 테스트에 주사기 개수/위치와 숨김 조건 회귀 케이스를 추가했습니다.

### 영향받은 파일
- `src/components/GameScreen.jsx`
- `src/components/GameScreen.test.jsx`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 이번 요청은 저장 데이터나 상태 판정이 아니라 부상 상태의 표시 방식만 바꾸는 작업이므로, `Canvas`나 게임 로직 대신 `GameScreen`의 오버레이 레이어만 수정하는 편이 가장 안전합니다.
- 위치 규칙을 배열 기반으로 고정해 두면 이후 특정 방향 이모지를 다시 바꾸더라도 렌더 순서와 애니메이션 지연을 한 곳에서 관리할 수 있어 회귀 가능성을 줄일 수 있습니다.

### idle 타임라인이 초반 구간만 반복되던 렌더 리셋 버그 수정
- `Canvas`가 `idleMotionTimeline` 배열 참조가 바뀔 때마다 애니메이션을 다시 시작하고 있어, 부모의 1초 단위 재렌더 동안 같은 내용의 타임라인도 계속 1프레임 근처로 되감기던 문제를 수정했습니다.
- idle 타임라인 전용 안정 key를 추가해 `f`, `spriteNumber`, `x`, `y`, `flip` 의미값이 실제로 달라질 때만 캔버스 초기화가 다시 일어나도록 정리했습니다.
- `Canvas` 회귀 테스트를 추가해, 같은 의미의 새 배열 인스턴스로 다시 렌더링될 때는 재초기화되지 않고, 좌표나 스프라이트 번호가 바뀌면 다시 초기화되는 규칙을 고정했습니다.

### 영향받은 파일
- `src/components/Canvas.jsx`
- `src/components/Canvas.test.jsx`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 이번 이슈는 idle 경로 데이터 자체보다 렌더 effect 의존성 안정성 문제에 가까워, 타임라인 정의나 애니메이션 속도 대신 `Canvas`의 재시작 조건만 좁게 수정하는 편이 안전합니다.
- 의미 기반 key를 쓰면 부모에서 동일한 타임라인을 새 배열로 만들어 내려줘도 재생 상태를 유지할 수 있고, 실제 타임라인 수정은 계속 정상적으로 반영할 수 있습니다.

### 몰입형 가로모드에 `벽돌 Ver.1` 이미지 프레임 스킨 추가
- 가로 몰입형에만 적용되는 `벽돌 Ver.1` 스킨을 추가하고, 제공된 디지바이스 PNG는 흰 여백을 잘라 `public/images/immersive/brick-ver1.png` 정적 자산으로 포함할 수 있게 정리했습니다.
- `IMMERSIVE_SKINS`는 이제 일반 셸 설명뿐 아니라 `landscapeFrameSrc`, `landscapeViewport`, `landscapeOnly` 메타데이터를 함께 가져, 이미지형 가로 프레임도 같은 슬롯별 `immersiveSettings.skinId`로 저장되도록 확장했습니다.
- 가로모드 왼쪽 화면 영역은 스킨 메타에 따라 기존 LCD 카드와 이미지 프레임 스테이지를 분기하도록 바꿨고, `벽돌 Ver.1`에서는 디바이스 이미지의 LCD 위치에 `GameScreen`을 절대배치해 중앙 정렬과 비율 유지를 함께 처리했습니다.
- 오른쪽 큰 버튼 패널과 아래 상태 요약/보조 버튼 배치는 유지했고, `벽돌 Ver.1` 선택 시에도 기존 메뉴 잠금 규칙과 세로 몰입형 기본 화면은 그대로 유지되도록 했습니다.
- 스킨 선택기에는 `가로 전용` 표기와 세로 모드 동작 안내를 추가해, 저장은 가능하지만 실제 프레임은 landscape에서만 드러난다는 점을 UI에서 바로 읽을 수 있게 했습니다.
- 후속 미세 조정으로 `brick-ver1`의 viewport를 좌우로 더 넓히고 세로 여백을 줄여, 사용자가 표시해 준 보라 가이드에 더 가깝게 게임 화면이 크게 보이도록 맞췄습니다.
- 추가 미세 조정으로 `brick-ver1` viewport의 상단 오프셋을 약 5px 아래로 내려, 실제 LCD 창 중앙축에 더 자연스럽게 맞추도록 보정했습니다.
- 추가 후속 조정으로 상단 오프셋을 다시 약 5px 더 내려, 현재 오버레이가 LCD 하단 쪽까지 조금 더 안정적으로 들어오도록 맞췄습니다.
- 추가 후속 조정으로 상단 오프셋을 다시 약 5px 더 내려, 사용자가 요청한 실제 프레임 기준 위치에 한 단계 더 가깝게 맞췄습니다.
- 추가 후속 조정으로 현재 기준 `top`과 `right`는 고정한 채 `left`를 2% 더 바깥으로 당기고 `height`도 2% 늘려, 화면이 왼쪽/아래 방향으로만 더 넓어지도록 맞췄습니다.
- 추가 후속 조정으로 `brick-ver1` viewport를 현재 기준에서 약 2px 위로 올려, LCD 안쪽 상하 정렬을 조금 더 타이트하게 맞췄습니다.
- 추가 후속 조정으로 `brick-ver1` viewport를 다시 약 2px 위로 올려, 상단 여백을 한 단계 더 줄였습니다.
- 추가 후속 조정으로 현재 기준 `top`과 `right`를 유지한 채 `left`를 1% 더 바깥으로 당기고 `width`, `height`를 각각 1%씩 늘려, 화면이 왼쪽/아래 방향으로만 한 단계 더 확장되도록 맞췄습니다.
- 추가 후속 조정으로 이번에는 크기는 유지한 채 viewport를 오른쪽으로 약 8px, 위로 약 8px 이동시켜 실제 LCD 중앙축과 더 자연스럽게 맞췄습니다.
- 추가 후속 조정으로 같은 기준 이동을 한 번 더 적용해, viewport를 오른쪽으로 약 8px, 위로 약 8px 추가 이동시켰습니다.
- 추가 후속 조정으로 이번에는 현재 `right`와 `top` 고정 상태를 유지한 채, viewport를 `6% 확장` 기준으로 다시 맞춰 `left`를 더 바깥으로 당기고 `width`, `height`를 함께 넓혔습니다.
- 추가 후속 조정으로 현재 viewport를 오른쪽으로 약 2px, 아래로 약 2px 이동시켜 실제 LCD 창 안쪽 중심점에 더 가깝게 맞췄습니다.
- 추가 후속 조정으로 viewport를 현재 기준에서 약 1px 더 아래로 내려, 상하 중심을 아주 미세하게 다시 맞췄습니다.
- 후속 기능 확장으로 `brick-ver1` 스킨일 때는 기존 오른쪽 조작 패널 대신 `기본 조작 5개`를 이미지 위에, `케어·도구 5개`를 이미지 아래에 두는 가로 스트립 조작 UI를 추가했고, 각 줄은 가로 스크롤로 한 번에 쭉 이동할 수 있게 바꿨습니다.
- 추가 후속 조정으로 브릭 스킨의 상단/하단 버튼 스트립도 이미지 프레임과 같은 최대 폭 기준을 사용하도록 바꿔, 버튼 정렬선이 이미지와 자연스럽게 맞도록 정리했습니다.
- 추가 후속 조정으로 `brick-ver1` 자산 자체를 border-connected 흰 배경이 투명한 RGBA PNG로 다시 만들고, 브릭 스킨 전용 프레임/상태 패널/버튼 스트립을 더 따뜻한 금속·벽돌 톤으로 재도색해 흰 카드가 떠 보이던 느낌을 줄였습니다.

### 영향받은 파일
- `public/images/immersive/brick-ver1.png`
- `src/data/immersiveSettings.js`
- `src/pages/Game.jsx`
- `src/components/layout/ImmersiveLandscapeFrameStage.jsx`
- `src/components/layout/ImmersiveLandscapeFrameStage.test.jsx`
- `src/components/layout/ImmersiveSkinPicker.jsx`
- `src/components/layout/ImmersiveSkinPicker.test.jsx`
- `src/utils/immersiveSettings.test.js`
- `src/index.css`

### 아키텍처 결정 근거
- 이미지형 디바이스 프레임도 기존 `immersiveSettings.skinId` 경로에 태우면 슬롯 저장 구조를 더 늘리지 않고도 일반 셸 스킨과 같은 저장/복원 흐름을 유지할 수 있습니다.
- `GameScreen` 자체는 기존 게임 렌더링을 그대로 재사용하는 편이 안전하므로, 새 스킨은 게임 로직을 건드리지 않고 가로 프레임 스테이지에서 외곽 배치와 반응형 크기 계산만 담당하도록 분리했습니다.
- 제공 이미지 안쪽 버튼까지 클릭 영역을 다시 설계하면 조작 규칙과 테스트 범위가 크게 늘어나므로, 이번 라운드에서는 외부 큰 버튼 패널을 유지하고 이미지 프레임은 시각 레이어에 집중하는 편이 안전합니다.

## 2026-04-07

### 이번 생 누적 부상 이력과 당시 디지몬 복원 기준 정리
- `injuries`를 현재 진화 단계 누적이 아니라 이번 생 누적으로 재정의해, 일반 진화와 조그레스에서는 유지되고 환생/새로운 시작에서만 초기화되도록 정리했습니다.
- 활동 로그/배틀 로그 서브컬렉션 저장 스키마에 `digimonId`, `digimonName` 스냅샷을 선택적으로 함께 저장하도록 확장해, 새 부상 로그와 진화/환생 로그에서 당시 디지몬 정보를 바로 읽을 수 있게 했습니다.
- 부상 이력 helper는 새 스냅샷 필드를 우선 사용하고, 예전 로그는 현재 생의 진화 로그를 시간순으로 역추적해 `당시 디지몬`을 fallback 복원하도록 변경했습니다.
- StatsPopup의 부상 카운터와 부상 이력 라벨을 `현재 단계 기준`에서 `이번 생 기준`으로 바꾸고, 각 부상 항목에 `당시 디지몬` 보조 정보를 표시하도록 업데이트했습니다.
- 부상 이력 테스트를 이번 생 기준으로 다시 정리해, `birthTime` 이후의 부상만 남는 시나리오와 진화 로그를 역추적해 당시 디지몬을 복원하는 시나리오를 함께 검증하도록 확장했습니다.
- 새 로그에는 당시 디지몬 스냅샷이 있고, 기존 로그에는 스냅샷이 없어도 진화 로그를 따라가며 `당시 디지몬`을 계산하는 흐름을 기준으로 테스트 기대값을 맞췄습니다.
- 똥 8개 추가 부상처럼 같은 틱에 여러 건이 생길 수 있는 경우도 분리 로그 형태로 유지된다는 점을 함께 확인하도록 보강했습니다.

### 영향받은 파일
- `src/utils/digimonLogSnapshot.js`
- `src/data/stats.js`
- `src/data/defaultStatsFile.js`
- `src/data/v1/defaultStats.js`
- `src/hooks/useGameLogic.js`
- `src/hooks/useGameData.js`
- `src/hooks/useGameActions.js`
- `src/hooks/useEvolution.js`
- `src/hooks/useDeath.js`
- `src/hooks/game-runtime/useGameRealtimeLoop.js`
- `src/components/StatsPopup.jsx`
- `src/components/GameModals.jsx`
- `src/data/stats.test.js`
- `src/logic/stats/injuryHistory.test.js`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 새 로그에는 스냅샷을 직접 저장하고, 기존 로그는 표시 시점에만 fallback 복원하도록 분리해 두면 저장 구조 변경 이후 데이터와 기존 누적 데이터 모두를 한 번에 호환할 수 있습니다.
- `injuries` 의미를 이번 생 누적으로 통일하면 부상 카운터, 부상 과다 사망 판정, 상태 배지, 부상 이력 UI가 같은 기준을 공유하게 되어 별도 누적 필드를 추가하지 않아도 됩니다.
- 부상 이력은 단순 문자열 목록이 아니라, "언제 어떤 디지몬 상태에서 부상했는지"를 읽는 기록이기 때문에 테스트도 시간 기준과 당시 디지몬 복원을 함께 검증해야 합니다.
- 이번 변경은 구현 상세보다 기대 동작을 명확히 남기는 데 초점을 두어, 이후 소스 반영이 들어와도 회귀를 쉽게 잡을 수 있게 합니다.

### 원작풍 상하 공격 훈련 연출로 재구성
- `TrainPopup`을 단순 기록형 리스트에서 원작 Ver.1 감성의 상단/하단 미니 전투 보드로 재구성해, 입력 직후 공격 라인, 상대 방어, 명중/막힘 결과가 짧은 연출 뒤에 드러나도록 바꿨습니다.
- 훈련 팝업 좌측에는 현재 선택한 내 디지몬의 실제 스프라이트와 별명을 표시하고, 우측에는 중앙 `?`로 방어 위치를 숨기는 연습용 퍼펫 더미를 배치해 아레나처럼 좌우 대치하는 화면으로 정리했습니다.
- 입력 패드는 내 디지몬 바로 오른쪽의 세로 컬럼으로 옮기고, `위/아래`를 한 덩어리 입력 그리드로 묶어 실제 휴대기기 방향 선택처럼 누를 수 있게 정리했습니다.
- 공격 연출의 발사체는 단순 점 대신 현재 디지몬의 `attackSprite` 이미지를 사용하도록 바꿔, 실제 공격 스프라이트가 라인을 따라 날아가는 전투 감각을 추가했습니다.
- 훈련 진행은 `입력 대기 -> 공격 연출 -> 판정 공개 -> 다음 라운드` 흐름으로 고정했고, 라운드 기록은 보조 패널과 5칸 히트 히스토리로 축소해 현재 라운드의 체감에 집중하도록 정리했습니다.
- 5라운드 종료 뒤에는 보드 하단 요약 대신 `최종 훈련 결과` 오버레이 팝업을 띄우고, 같은 자리에서 `한번 더` 또는 `닫기`를 고를 수 있게 마감 동선을 바꿨습니다.
- 입력 패드 안내 문구의 방향 지시어는 제거하고, 상단 공격은 빨강, 하단 공격은 파랑으로 구분해 텍스트보다 색과 위치로 위/아래를 읽을 수 있게 정리했습니다.
- 전투판의 `상단 라인/하단 라인` 라벨은 숨기고, 실제 공격 스프라이트가 위/아래 경로로 더 크게 날아가도록 조정했으며, 모바일에서는 전투 카드들을 2열 압축 레이아웃으로 재배치해 한 화면 안에서 보이도록 맞췄습니다.
- `React.StrictMode` 환경에서도 판정 연출 뒤 다음 라운드로 정상 진행되도록, 훈련 팝업의 예약 타이머를 전환 토큰 기반으로 재구성하고 멈춤 회귀 테스트를 추가했습니다.
- Ver.1 훈련 계산은 `logic/training/train.js`로 단일화하고, `data/train_digitalmonstercolor25th_ver1.js`는 하위 호환용 re-export만 남겨 중복 규칙 분기를 제거했습니다.
- 훈련 결과 계약은 `hits`, `fails`, `isSuccess`, `message`, `roundResults`, `updatedStats`를 공통으로 반환하도록 통일했고, `useGameActions`도 이 계약만 사용하도록 맞췄습니다.
- 훈련 관련 사용자 알림 문구를 한국어로 정리하고, 순수 로직 테스트와 팝업 상호작용 테스트를 추가해 연출 개선 이후에도 현재 앱의 스탯 규칙이 유지되는지 확인할 수 있게 했습니다.

### 영향받은 파일
- `src/components/TrainPopup.jsx`
- `src/components/GameModals.jsx`
- `src/components/TrainPopup.test.jsx`
- `src/components/TrainPopup.strictmode.test.jsx`
- `src/styles/TrainPopup.css`
- `src/logic/training/train.js`
- `src/logic/training/index.js`
- `src/logic/training/train.test.js`
- `src/data/train_digitalmonstercolor25th_ver1.js`
- `src/hooks/useGameActions.js`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 이번 변경은 원작의 입력 의미와 장면 흐름만 가져오고, 현재 앱의 스탯 경제는 그대로 유지해야 했기 때문에, 연출 상태는 `TrainPopup` 내부 UI 상태로만 다루고 저장 규칙은 기존 `doVer1Training` 경로에 묶는 편이 안전합니다.
- 훈련 규칙이 `data/`와 `logic/`에 중복되면 이후 밸런스 수정이나 테스트 보강 때 다시 어긋날 가능성이 크므로, 순수 계산은 `logic/training` 한 곳만 기준으로 두는 구조가 유지보수에 유리합니다.
- 메인 `GameScreen`의 캔버스 애니메이션을 이번 범위에서 건드리지 않으면 기존 idle/sleep/injury 렌더 정책과 충돌하지 않으면서도, 훈련 팝업만으로 충분한 입력 피드백을 줄 수 있습니다.

## 2026-04-05

### 냉장고 상태에서 디지몬이 돌아다니는 렌더 버그 수정
- 냉장고 보관 여부 자체는 정상 저장되고 있었지만, `Canvas`가 냉장고 상태에서도 먼저 디지몬 idle 이동 타임라인을 계속 적용한 뒤 냉장고 연출만 덮고 있어, 얼어 있어야 할 디지몬이 안에서 돌아다녀 보이던 문제를 수정했습니다.
- 냉장고 렌더 정책을 순수 helper로 분리해, 넣기 직후와 꺼내기 후반에는 디지몬을 화면 중앙 고정 포즈로만 보이게 하고, 냉장고 내부 단계와 해동 초반에는 디지몬 본체를 숨기도록 정리했습니다.
- `takeOutAt`가 정리되기 전까지는 idle 이동과 프레임 순환이 재개되지 않도록 맞춰, 냉장고에서 꺼낸 직후에도 3.5초 연출이 끝나기 전에는 다시 돌아다니지 않게 했습니다.

### 영향받은 파일
- `src/components/Canvas.jsx`
- `src/components/fridgeRenderPolicy.js`
- `src/components/fridgeRenderPolicy.test.js`

### 아키텍처 결정 근거
- 이번 이슈는 시간 정지나 저장소 동기화 문제가 아니라 화면 렌더 정책 문제였기 때문에, `useFridge`나 lazy update를 건드리지 않고 캔버스 레이어에서만 해결하는 편이 안전합니다.
- 냉장고 단계 계산을 순수 helper로 분리하면 `Canvas` 내부의 시간 분기를 테스트 가능하게 만들 수 있고, 이후 다른 정지 연출이 생겨도 같은 정책 레이어를 재사용하기 쉽습니다.

### 로그인 페이지 설명 카드 제거
- `/auth`에서 로그인 기능과 직접 관련 없는 좌측 설명 카드(`AUTH`, `디지몬 서비스 셸에 로그인`, 허브 소개 카드)를 제거하고, 로그인 액션 카드 하나만 중앙에 오는 단일 컬럼 레이아웃으로 단순화했습니다.
- Google 로그인, 게스트 로그인, Firebase 미설정 경고, 로그인 후 리디렉션 동작은 그대로 유지했습니다.

### 영향받은 파일
- `src/pages/Login.jsx`
- `src/pages/Login.test.jsx`

### 소개 페이지 계정 드롭다운 잘림 수정
- 소개 페이지 헤더의 계정 메뉴가 실제로는 열리지만, 헤더 surface의 `overflow: hidden` 때문에 아래로 잘리던 문제를 수정했습니다.
- 랜딩 헤더 surface의 overflow를 열어 계정설정/로그아웃 드롭다운이 모바일에서도 정상적으로 보이게 정리했습니다.

### 영향받은 파일
- `src/styles/landing.css`

### 소개 페이지 헤더의 닉네임/계정 메뉴를 일반 헤더와 공용화
- 소개 페이지 헤더가 저장된 테이머 닉네임을 보지 않고 `displayName`만 쓰던 문제를 정리하고, `App -> LandingShell -> LandingTopBar`로 `tamerName`을 전달하도록 연결했습니다.
- 일반 헤더와 소개 헤더가 같은 표시 이름 우선순위와 같은 계정 메뉴 동작을 쓰도록 `useHeaderAccountMenu` 공용 훅을 추가했습니다.
- 이제 소개 페이지에서도 이름 pill을 누르면 일반 페이지와 동일하게 `계정설정 / 로그아웃` 메뉴가 열리고, `계정설정`은 `/me/settings`, `로그아웃`은 `/auth`로 이동합니다.

### 영향받은 파일
- `src/App.jsx`
- `src/components/layout/TopNavigation.jsx`
- `src/components/landing/LandingShell.jsx`
- `src/components/landing/LandingTopBar.jsx`
- `src/components/landing/LandingShell.test.jsx`
- `src/hooks/useHeaderAccountMenu.js`
- `src/styles/landing.css`

### 아키텍처 결정 근거
- 헤더 전체를 하나로 합치기보다, 페이지별 시각 구조는 유지하고 계정 관련 동작만 공용화하는 편이 리스크가 낮고 사용자 요구에도 정확히 맞습니다.
- 표시 이름 계산과 계정 메뉴 액션을 한 훅으로 묶어 두면 소개/일반 헤더의 동작 차이가 다시 벌어질 가능성을 줄일 수 있습니다.

## 2026-04-07

### 냉장고 복귀 시 zero timer와 10분 호출 타이머를 분리
- 냉장고에서 꺼낼 때 `lastHungerZeroAt` / `lastStrengthZeroAt`를 현재 시각으로 재설정하던 흐름을 제거하고, 이 값이 계속 "실제로 0이 된 시각"만 가리키도록 고정했습니다.
- 대신 활성 배고픔/힘 호출은 `startedAt`과 mistake deadline만 냉장고 보관 시간만큼 뒤로 밀어, 10분 호출 창이 멈췄다가 이어지는 방식으로 정리했습니다.
- `takeOutAt`가 애니메이션 후 정리되더라도 12시간 사망 카운터가 냉장고 시간을 계속 제외할 수 있도록, 배고픔/힘/부상/똥 패널티별 냉장고 누적 제외 시간을 별도 필드로 저장하도록 확장했습니다.

### 관련 리셋 경로와 회귀 테스트 정리
- 새로운 시작, 청소, 치료, 배틀 부상 경로에서 새 냉장고 누적 제외 필드가 같이 초기화되도록 정리해 오래된 pause 값이 다음 생애나 다음 부상으로 넘어가지 않게 했습니다.
- `useFridge` 회귀 테스트를 추가해, 냉장고에서 꺼낸 뒤 `last*ZeroAt`는 유지되고 호출 창만 보관 시간만큼 이동하는지 확인하도록 했습니다.
- `evaluateDeathConditions` 테스트에도 누적 제외 시간이 `takeOutAt` 정리 후까지 계속 반영되는 케이스를 추가했고, `checkCalls`는 냉장고 상태에서 호출 메타를 지우지 않는다는 계약을 테스트로 고정했습니다.

### 영향받은 파일
- `src/data/defaultStatsFile.js`
- `src/data/v1/defaultStats.js`
- `src/data/stats.js`
- `src/hooks/useFridge.js`
- `src/hooks/useFridge.test.js`
- `src/hooks/useGameActions.js`
- `src/hooks/useGameAnimations.js`
- `src/hooks/useGameData.js`
- `src/hooks/useGameLogic.js`
- `src/hooks/useGameLogic.test.js`
- `src/pages/Game.jsx`
- `src/logic/stats/death.js`
- `src/logic/stats/death.test.js`
- `src/logic/stats/hunger.js`
- `src/logic/stats/strength.js`
- `src/utils/fridgeTime.js`

### 아키텍처 결정 근거
- `last*ZeroAt`는 이미 12시간 사망 판정과 zero-state history의 canonical source로 사용되고 있으므로, 냉장고 복귀 시 현재 시각으로 덮어쓰면 같은 시간을 두 번 제외하는 구조가 됩니다.
- 12시간 타이머와 10분 호출 타이머는 의미가 다르기 때문에, zero timer는 고정하고 호출 창만 이동시키는 쪽이 계약을 더 명확하게 유지합니다.
- `takeOutAt`는 짧은 애니메이션 상태라 장기적인 시간 제외 기준으로 쓰기 어렵기 때문에, 각 타이머별 누적 냉장고 제외 시간을 별도 필드로 유지하는 것이 새로고침과 후속 lazy update까지 가장 안정적으로 연결됩니다.

## 2026-04-04

### 케어미스 이력과 진화 카운터를 stage-local ledger로 동기화
- `careMistakes`를 진화 판정의 공식 값으로 유지하면서, 현재 진화 구간 전용 `careMistakeLedger`를 추가해 스탯 팝업의 `케어미스 발생 이력`이 카운터와 같은 수를 보이도록 정비했습니다.
- 실시간 호출 타임아웃, `applyLazyUpdate`의 `[과거 재구성]`, `괴롭히기`, `놀아주기/간식주기(-1)`를 공통 ledger helper로 묶어 케어미스 증감과 현재 구간 이력을 함께 갱신하게 했습니다.
- 레거시 슬롯은 로드/표시 시 현재 단계의 care 로그를 바탕으로 ledger를 복원하고, 부족한 건수는 `[기록 동기화]` placeholder로 보정해 UI에서 즉시 카운터와 맞추도록 했습니다.

### 영향받은 파일
- `src/logic/stats/careMistakeLedger.js`
- `src/logic/stats/careMistakeLedger.test.js`
- `src/data/defaultStatsFile.js`
- `src/data/stats.js`
- `src/data/stats.test.js`
- `src/hooks/useGameData.js`
- `src/hooks/useGameLogic.js`
- `src/hooks/useGameLogic.test.js`
- `src/pages/Game.jsx`
- `src/components/GameModals.jsx`
- `src/components/StatsPopup.jsx`

### 아키텍처 결정 근거
- `activityLogs`는 100건 cap과 감사 로그 성격 때문에 현재 케어미스 카운터의 단일 기준으로 쓰기 어렵습니다. 그래서 공식 source of truth는 `careMistakes`로 유지하고, 현재 진화 구간의 유효 이력만 별도 ledger로 분리했습니다.
- `과거 재구성`은 자동 시간 경과 이벤트 복구에만 유지하고, 레거시 데이터나 직접 수정으로 생긴 불일치는 ledger repair 단계에서 흡수하도록 역할을 분리했습니다.
- `-1` 액션은 최신 미해소 케어미스를 resolve하는 정책으로 고정해, 현재 카운터와 화면 이력 수가 항상 같은 의미를 갖도록 맞췄습니다.

### activityLogs 최대 보관 수를 100건으로 통일
- `GameModals`의 수면 방해 보조 로그 경로만 `slice(0, 50)`을 사용하고 있어, 특정 상호작용 후 활동 로그가 50건으로 갑자기 줄어드는 예외가 있었습니다.
- 활동 로그 최대 개수를 공용 상수로 분리하고 `useGameLogic`, `useGameActions`, `useGameData`, `data/stats`, `GameModals`가 모두 같은 `100` 기준을 쓰도록 정리했습니다.
- 활동 로그 설계 문서도 현재 구현과 맞게 갱신해, 슬롯 로드 쿼리와 수동 로그 추가 경로가 동일한 한도를 사용한다는 점을 명확히 했습니다.

### 영향받은 파일
- `src/constants/activityLogs.js`
- `src/components/GameModals.jsx`
- `src/hooks/useGameActions.js`
- `src/hooks/useGameLogic.js`
- `src/hooks/useGameData.js`
- `src/data/stats.js`
- `docs/ACTIVITY_LOGS_AND_SUBCOLLECTION.md`

### 아키텍처 결정 근거
- `activityLogs`는 단순 표시 이력뿐 아니라 최근 중복 방지와 로드 직후 UI 복원에도 함께 쓰이므로, 액션별로 다른 최대 개수를 두면 예기치 않은 잘림과 디버깅 혼선을 만들 수 있습니다.
- 최대 개수를 공용 상수로 분리하면 수동 append, lazy update, Firestore 서브컬렉션 로드가 모두 같은 기준을 공유해 이후 리팩터링에서 다시 `50/100`이 섞일 가능성을 줄일 수 있습니다.

### 랜딩 히어로의 디지타마 포스터 복구와 카피 줄바꿈 조정
- 풀블리드 대표 이미지를 유지하면서도, 우측 디지타마 포스터 비주얼을 다시 함께 노출하도록 히어로 레이아웃을 조정했습니다.
- 메인 카피는 `그 시절, / 우리는 모두 / 선택받은 / 아이들이었다`의 4줄 전개로 바꿔 첫 화면의 전시 포스터 리듬을 더 분명하게 만들었습니다.
- 관련 테스트도 갱신해 히어로 이미지와 디지타마 포스터가 동시에 렌더링되는지 확인했습니다.

### 추가 영향 파일
- `src/components/landing/Hero.jsx`
- `src/data/landingContent.js`
- `src/pages/Landing.test.jsx`
- `src/styles/landing.css`

### 랜딩의 보조 설명 문구 정리
- Intro와 Memory Scene에서 사용자가 지우길 원한 보조 설명, 캡션, `SCENE CHANGE` 블록을 제거해 화면이 더 비주얼 중심으로 보이도록 정리했습니다.
- 빈 문자열이 들어와도 빈 문단이나 빈 보조 영역이 남지 않도록 Intro와 Gallery 컴포넌트에 조건부 렌더링을 추가했습니다.

### 추가 영향 파일
- `src/components/landing/Gallery.jsx`
- `src/components/landing/Intro.jsx`
- `src/data/landingContent.js`
- `src/pages/Landing.test.jsx`
- `src/styles/landing.css`

### 랜딩의 Egg Scroll 구간 제거
- 랜딩 흐름에서 과하게 설명적으로 보이던 `EggScroll` 구간을 실제 `/landing` 조립 순서에서 제거했습니다.
- 이제 랜딩은 `Hero / Intro / Growth / Gallery / CTA`의 5개 섹션으로 이어지고, 부화 HUD 연출은 더 이상 랜딩 화면에 노출되지 않습니다.

### 추가 영향 파일
- `src/pages/Landing.jsx`
- `src/pages/Landing.test.jsx`

### 대표컷 캡션 제거와 전체화면 뷰어 추가
- Memory Scene 대표컷 카드 위에 보이던 `대표컷 ...` 캡션을 제거해 이미지 집중도를 높였습니다.
- 대표컷 이미지를 누르면 전체화면 오버레이로 크게 볼 수 있도록 랜딩 전용 뷰어를 추가했습니다.

### 추가 영향 파일
- `src/components/landing/Gallery.jsx`
- `src/pages/Landing.test.jsx`
- `src/styles/landing.css`

### 성장 섹션의 다음 진화 라벨 문구 조정
- `다음 진화 신호` 문구를 사용자가 의도한 표현인 `다음 진화 디지몬`으로 변경했습니다.

### 추가 영향 파일
- `src/data/landingContent.js`

### Memory Scene 메인 카피 문구 조정
- 중간 Memory Scene의 큰 오버레이 카피를 `그 시절, 우리는 모두 선택받은 아이들이었다`에서 `그 여름의 디지털 월드`로 변경했습니다.

### 추가 영향 파일
- `src/data/landingContent.js`

### Memory Scene 텍스트 레이어 제거
- 사용자가 요청한 대로 Memory Scene의 `MEMORY SCENE` 아이브로와 `그 여름의 디지털 월드` 텍스트 레이어를 모두 제거했습니다.
- 텍스트가 비어 있을 때도 섹션 접근성이 깨지지 않도록 Gallery 컴포넌트에 조건부 제목/라벨 처리를 추가했습니다.

### 추가 영향 파일
- `src/components/landing/Gallery.jsx`
- `src/data/landingContent.js`
- `src/pages/Landing.test.jsx`

### Memory Scene 카피 복구와 CTA 대표 이미지 추가
- Memory Scene의 큰 오버레이 카피를 `1999년 그 여름, 디지털월드`로 다시 노출하도록 조정했습니다.
- CTA 버튼 아래에는 사용자 제공 이미지를 랜딩 자산으로 추가해, 액션 버튼 아래에 회상 장면이 이어지도록 구성했습니다.

### 추가 영향 파일
- `public/images/landing/cta-device.webp`
- `src/components/landing/CTA.jsx`
- `src/data/landingContent.js`
- `src/pages/Landing.test.jsx`
- `src/styles/landing.css`

### CTA 보조 설명 문구 제거
- 사용자가 요청한 CTA 설명 문구를 제거하고, 빈 문자열일 때는 설명 문단 자체가 렌더링되지 않도록 CTA 컴포넌트를 정리했습니다.

### 추가 영향 파일
- `src/components/landing/CTA.jsx`
- `src/data/landingContent.js`
- `src/pages/Landing.test.jsx`

### 랜딩 헤더 브랜드 마크를 앱 아이콘으로 교체
- 랜딩 헤더 왼쪽의 검은 원형 장식 대신 실제 앱 아이콘인 `logo192_agumon.png`를 노출하도록 변경했습니다.
- 브랜드 링크 접근성 이름은 유지하면서, 시각 마크만 실제 앱 자산으로 교체하고 관련 테스트를 추가했습니다.

### 추가 영향 파일
- `src/components/landing/LandingShell.test.jsx`
- `src/components/landing/LandingTopBar.jsx`
- `src/styles/landing.css`

### 게임 도감 모달의 가로 눌림 레이아웃 수정
- 게임 내 `추가기능 > 도감` 모달이 공통 `battle-modal` 폭 제한을 같이 받아 좁아지던 문제를 분리해, 도감 전용 최대 폭을 안정적으로 유지하도록 조정했습니다.
- 도감 카드 목록은 화면 전체 브레이크포인트 기준 `4열/5열` 고정 그리드 대신, 모달과 페이지의 실제 컨테이너 폭에 맞춰 자동으로 열 수를 계산하는 반응형 그리드로 변경했습니다.
- 이 변경으로 데스크톱 해상도에서도 도감 카드가 좌우로 눌리거나 이름 줄바꿈이 과하게 발생하는 현상을 줄이고, 전체 페이지 도감 레이아웃도 같은 기준으로 정리했습니다.

### 영향받은 파일
- `src/components/EncyclopediaModal.jsx`
- `src/components/panels/EncyclopediaPanel.jsx`

### 아키텍처 결정 근거
- `battle-modal`은 소형 배틀 계열 모달 폭을 전제로 쓰이고 있어, 도감처럼 넓은 정보형 모달까지 공유하면 레이아웃 충돌이 생깁니다. 따라서 도감 모달만 전용 폭 설정으로 분리해 다른 모달 동작을 건드리지 않도록 했습니다.
- 도감 카드는 viewport 브레이크포인트보다 실제 렌더링 컨테이너 폭의 영향을 더 크게 받으므로, 컨테이너 기반 자동 배치가 모달/페이지 양쪽에서 더 안정적인 선택입니다.

### 몰입형 플레이 복귀 버튼 위치를 왼쪽 흐름으로 정렬
- 기본 게임 화면에서는 `몰입형 플레이` 진입 버튼이 왼쪽 액션 그룹에 있었는데, 몰입형 화면의 `기본 화면` 복귀 버튼은 오른쪽에 배치되어 흐름이 뒤집혀 보였습니다.
- 몰입형 상단 바에서 이동 버튼 묶음을 먼저 렌더링하도록 순서를 조정해, `기본 화면`과 `플레이 허브` 버튼이 왼쪽에서 시작되도록 통일했습니다.
- 데스크톱 상단 바 테스트도 추가해 복귀 버튼 묶음이 왼쪽에 유지되는지 확인할 수 있게 했습니다.

### 추가 영향 파일
- `src/components/layout/ImmersiveGameTopBar.jsx`
- `src/components/layout/ImmersiveGameTopBar.test.jsx`

### 몰입형 상단 바 버튼 순서를 플레이 허브 → 기본 화면으로 재조정
- 몰입형 화면에서 상단 이동 버튼 순서를 다시 정리해, `기본 화면` 버튼이 `플레이 허브` 오른쪽에 오도록 변경했습니다.
- 모바일과 데스크톱 레이아웃 모두 같은 순서를 사용하도록 맞춰, 화면 크기에 따라 버튼 흐름이 달라지지 않게 했습니다.
- 테스트도 새 버튼 순서 기준으로 갱신했습니다.

### 플레이 허브 최근 이어하기 카드에 디지몬 썸네일 추가
- `플레이 허브 > 최근 이어하기` 카드가 텍스트와 버튼만 보여 주던 상태에서, 현재 슬롯의 디지몬 스프라이트도 함께 노출하도록 개선했습니다.
- 기존 슬롯 카드에서 사용하던 스프라이트 경로 헬퍼와 픽셀 렌더링 스타일을 재사용해 시각 톤을 맞췄고, 모바일에서는 세로 배치로 자연스럽게 접히도록 반응형 레이아웃을 보강했습니다.

### 추가 영향 파일
- `src/pages/PlayHub.jsx`
- `src/index.css`

### 슬롯 순서 정리 모달에 썸네일과 강조 이동 버튼 추가
- `슬롯 순서 정리` 모달 각 항목에 정렬 순번과 실제 슬롯 번호를 분리해 보여 주고, 디지몬 스프라이트 썸네일을 함께 배치해 어떤 슬롯인지 즉시 구분할 수 있게 했습니다.
- 위/아래 이동 버튼은 공통 ghost 버튼 대신 전용 원형 버튼으로 바꾸고, 위는 에메랄드 계열, 아래는 앰버 계열 배경색을 적용해 방향이 더 눈에 잘 들어오도록 조정했습니다.
- 첫 항목의 위 버튼, 마지막 항목의 아래 버튼은 기존처럼 비활성 상태를 유지하되 시각적으로도 충분히 흐려지게 처리했습니다.

### 추가 영향 파일
- `src/components/play/SlotOrderModal.jsx`
- `src/components/play/SlotOrderModal.test.jsx`
- `src/index.css`

### 슬롯 카드의 삭제 버튼 강조색과 액션 순서 조정
- 플레이 허브 슬롯 카드에서 `삭제` 버튼을 빨강 계열 danger 스타일로 분리해 다른 보조 액션보다 더 눈에 띄게 조정했습니다.
- 버튼 순서도 `삭제`를 왼쪽, `별명 변경`을 오른쪽으로 옮겨 요청한 흐름에 맞췄습니다.
- 슬롯 카드 전용 테스트를 추가해 삭제 버튼의 스타일 클래스와 클릭 동작을 함께 확인할 수 있게 했습니다.

### 추가 영향 파일
- `src/components/play/SlotCard.jsx`
- `src/components/play/SlotCard.test.jsx`
- `src/index.css`

### 플레이 허브의 허브 운영 기준 안내 카드 제거
- 플레이 허브 하단의 `정렬과 보관 / 허브 운영 기준` 안내 카드를 제거해 화면을 더 간결하게 정리했습니다.
- 남아 있는 `관련 페이지` 카드가 단독으로 자연스럽게 이어지도록 해당 구간의 래퍼 구조도 함께 단순화했습니다.
- 플레이 허브 테스트에도 안내 카드가 더 이상 렌더링되지 않는지 확인하는 검증을 추가했습니다.

### 추가 영향 파일
- `src/pages/PlayHub.jsx`
- `src/pages/PlayHub.test.jsx`

### 아레나 어드민을 서버 권한으로 이관하고 리더보드/리플레이 모델을 통일
- 관리자용 시즌 설정, 시즌 종료, 아카이브 삭제를 클라이언트 Firestore 직접 쓰기에서 서버 API로 이동해 권한 경계를 명확히 했습니다.
- `developerMode`는 UI 노출용으로만 유지하고, 실제 관리자 판별은 인증 토큰과 서버 allowlist에서 수행하도록 분리했습니다.
- 시즌 종료는 아카이브 생성, 다음 시즌 전환, `arena_entries` 시즌 전적 초기화를 한 번의 서버 commit 흐름으로 묶고, 중복 시즌 아카이브 생성을 차단하도록 정리했습니다.
- 현재 시즌 / 전체 누적 / 과거 시즌 리더보드가 같은 DTO를 쓰도록 정규화하고, 기존 평탄한 archive 엔트리도 `record + digimonSnapshot` 구조로 읽을 수 있게 맞췄습니다.
- 신규 아레나 등록 시 `record.seasonId`, `record.seasonWins`, `record.seasonLosses`를 즉시 저장해 첫 배틀 전에도 현재 시즌 리더보드에 `0승 0패`로 보이게 했습니다.
- 배틀 완료는 서버에서 replay archive 업서트 성공 후 요약 로그를 기록하도록 바꿔 `archiveStatus`가 `ready`인 로그만 다시보기 CTA를 노출하게 강화했습니다.
- 관리자 모달에는 시즌 종료 영향 범위 미리보기와 확인 문구 절차를 추가했고, 아카이브 삭제는 soft delete 기준으로 바꿨습니다.

### 영향받은 파일
- `src/components/AdminModal.jsx`
- `src/components/AdminModal.test.jsx`
- `src/components/ArenaScreen.jsx`
- `src/components/ArenaScreen.test.jsx`
- `src/hooks/useGameActions.js`
- `src/utils/arenaApi.js`
- `api/_lib/auth.js`
- `api/_lib/firestoreAdmin.js`
- `api/_lib/arenaHandlers.js`
- `api/arena/admin/config.js`
- `api/arena/admin/end-season.js`
- `api/arena/admin/archives/[archiveId].js`
- `api/arena/battles/complete.js`
- `firestore.rules`
- `api/_lib/arenaHandlers.test.js`
- `tests/arena-entrypoints.test.js`

### 아키텍처 결정 근거
- 시즌 전환과 아카이브 관리처럼 운영 데이터 전체에 영향을 주는 기능은 클라이언트 직접 쓰기보다 서버 API로 옮겨야 권한 경계와 감사 가능성이 분명해집니다.
- 리더보드는 현재 시즌, 전체 누적, 과거 시즌이 모두 같은 렌더 규칙을 공유해야 유지보수가 쉬우므로, live entry와 archive entry의 DTO를 하나로 맞췄습니다.
- replay는 저장 성공 여부가 사용자 체감 품질에 직접 연결되기 때문에, archive 상태를 명시적으로 기록하고 확인된 로그만 다시보기 가능하게 하는 편이 운영 리스크를 줄입니다.

## 2026-04-03

### 랜딩 전용 헤더를 다크 글래스 톤으로 재정렬
- `/landing`에서만 보이는 `LandingTopBar`에 surface 래퍼를 추가하고, 브랜드/네비/계정 CTA 구조는 유지한 채 전시형 다크 글래스 헤더로 톤을 바꿨습니다.
- 활성 링크를 밝은 민트 pill에서 얇은 보더와 은은한 glow 중심으로 바꾸고, 브랜드 마크와 CTA 버튼도 히어로의 어두운 무드에 맞춰 재조정했습니다.
- 모바일에서는 기존처럼 중앙 네비를 숨기되, 헤더 높이와 패딩을 줄여 첫 화면 겹침을 완화했습니다.

### 영향받은 파일
- `src/components/landing/LandingTopBar.jsx`
- `src/components/landing/LandingShell.test.jsx`
- `src/styles/landing.css`

### 아키텍처 결정 근거
- 랜딩 헤더는 이미 공통 서비스 셸과 분리돼 있으므로, 랜딩 전용 컴포넌트와 스타일만 수정해 다른 페이지 헤더에 영향을 주지 않도록 했습니다.
- 새 인터랙션이나 메뉴 구조 변경 없이 스타일 계층만 재설계해 기존 라우팅과 인증 동선을 그대로 유지했습니다.

### Figma Make 분석 기반 이미지 삽입 슬롯 보강
- Figma Make 링크에서 확인된 Hero / Intro / EggScroll / Growth / Gallery / CTA 구조를 현재 랜딩과 대조한 뒤, 사용자 이미지를 히어로 배경과 중간 회상 장면에 꽂을 수 있는 슬롯을 보강했습니다.
- `landingHeroContent`에는 배경 이미지 위치와 크기 옵션을 추가했고, `landingMemorySceneContent`에는 배경 이미지 외에도 가운데 대표 컷을 넣을 수 있는 `featuredArtwork` 필드를 추가했습니다.
- 중간 `Memory Scene`은 큰 이미지가 없을 때는 기존 스프라이트 밴드를 유지하고, 사용자가 이미지를 넣으면 자동으로 큰 프레임 컷으로 전환되도록 구성했습니다.

### 추가 영향 파일
- `src/components/landing/Hero.jsx`
- `src/components/landing/Gallery.jsx`
- `src/data/landingContent.js`
- `src/data/landingContent.test.js`
- `src/pages/Landing.test.jsx`
- `src/styles/landing.css`

### 랜딩 성장 섹션의 가상 지표를 실제 게임 용어로 정리
- `동기화율 / 안정도 / 유대`처럼 현재 게임에 없는 표현을 제거하고, 성장 섹션의 상태 라벨을 `배고픔 / 힘 / 훈련`으로 교체했습니다.
- 랜딩 테스트에도 기존 가상 지표가 더 이상 노출되지 않는지 확인하는 검증을 추가했습니다.

### 추가 영향 파일
- `src/data/landingContent.js`
- `src/pages/Landing.test.jsx`

### 사용자 제공 이미지를 히어로 배경과 중간 대표컷 3장으로 반영
- 사용자 제공 4장의 이미지 중 1장은 히어로 배경으로 연결하고, 나머지 3장은 `Memory Scene`의 대표컷 카드 그리드로 전시형 배치에 맞게 반영했습니다.
- 히어로 이미지는 오른쪽 포스터 카드가 아니라 섹션 배경으로 이동시켜 첫 화면의 분위기를 바로 전달하게 했고, 중간 구간은 단일 컷 대신 3장 카드 배열로 바꿔 장면성이 더 드러나게 조정했습니다.
- 관련 테스트도 새 기본값에 맞게 갱신해, 기본 이미지 연결과 커스텀 이미지 교체 흐름이 모두 유지되는지 확인했습니다.

### 추가 영향 파일
- `public/images/landing/*`
- `src/components/landing/Gallery.jsx`
- `src/components/landing/Hero.jsx`
- `src/data/landingContent.js`
- `src/data/landingContent.test.js`
- `src/pages/Landing.test.jsx`
- `src/styles/landing.css`

## 2026-04-02

### 랜딩 페이지를 전시형 6섹션 구조로 재편
- 기존 서비스 소개형 `Landing`을 `Hero / Intro / EggScroll / Growth / Gallery / CTA` 구조로 분리했습니다.
- 랜딩 전용 컴포넌트, 데이터, 스타일 파일을 별도로 추가해 기존 전역 스타일 누적을 줄였습니다.
- `Digitama(133)`, `Botamon(210)`, `Koromon(225)`, `Agumon(240)` 자산을 랜딩 감정선에 맞춰 연결했습니다.

### 영향받은 파일
- `src/pages/Landing.jsx`
- `src/pages/Landing.test.jsx`
- `src/components/landing/*`
- `src/data/landingContent.js`
- `src/styles/landing.css`
- `src/components/landing/hooks/useEggScrollProgress.test.js`

### 아키텍처 결정 근거
- 현재 프로젝트는 CRA + JSX 중심이므로, Vite/TypeScript/shadcn 전체 스캐폴드를 가져오지 않고 섹션 구조만 채택했습니다.
- 스크롤 상태 계산은 `EggScroll` 내부에 하드코딩하지 않고 Hook으로 분리해 테스트 가능성과 유지보수성을 높였습니다.
- 랜딩 전용 스타일은 `landing.css`로 분리해 이후 모바일 튜닝과 인터랙션 보강을 독립적으로 이어갈 수 있게 했습니다.

## 2026-04-04

### archive 실패 관측을 관리자 모달에서 바로 확인할 수 있게 보강
- Supabase에 `log_archive_monitor_events` 테이블을 추가하고, 아레나 archive 저장/아레나 replay 조회/조그레스 archive 저장 API가 성공, 404, 권한 오류, 일반 실패를 best-effort로 기록하도록 확장했습니다.
- 관리자 모달에 `로그 관측` 탭을 추가해 최근 24시간 요약 카드와 최신 이벤트 50건을 서버 관리자 API로 조회할 수 있게 했습니다.
- 기존 사용자 플로우는 그대로 비차단으로 유지하고, 관측 insert 실패가 원래 archive 요청 성공/실패를 바꾸지 않도록 설계했습니다.

### 영향받은 파일
- `api/_lib/logArchiveHandlers.test.js`
- `digimon-tamagotchi-frontend/api/_lib/logArchiveHandlers.js`
- `digimon-tamagotchi-frontend/api/_lib/arenaHandlers.js`
- `digimon-tamagotchi-frontend/api/arena/admin/archive-monitoring.js`
- `digimon-tamagotchi-frontend/src/components/AdminModal.jsx`
- `digimon-tamagotchi-frontend/src/components/AdminModal.test.jsx`
- `digimon-tamagotchi-frontend/src/utils/arenaApi.js`
- `supabase/migrations/20260404_log_archive_monitoring.sql`
- `docs/SUPABASE_LOG_ARCHIVE_ROLLOUT.md`

### 아키텍처 결정 근거
- archive 실패 관측은 사용자 기능보다 운영 확인이 목적이므로, 새 페이지 대신 기존 관리자 모달과 아레나 관리자 권한 체계를 재사용했습니다.
- 외부 에러 수집 서비스를 추가하지 않고 `Vercel 로그 + Supabase event table` 조합으로 유지해 현재 서버리스 구조와 관리 복잡도를 크게 늘리지 않도록 했습니다.

### `/landing` 전용 풀블리드 전시형 레이아웃으로 확장
- `/landing`을 공통 `ServiceLayout` 밖으로 분리하고, `LandingShell`과 `LandingTopBar`를 추가해 전용 헤더와 본문 구조를 구성했습니다.
- Hero를 viewport 기준 풀블리드 스테이지로 재구성하고, 중간 `Gallery` 구간은 `Memory Scene` 역할의 대형 회상 장면으로 전환했습니다.
- 외부 대형 아트 없이도 동작하도록 `landingContent`에 optional artwork 필드를 추가하고, 기본값은 repo 스프라이트 합성 모드로 두었습니다.

## 2026-04-05

### 부상 과다와 부상 이력을 현재 단계 기준으로 정렬
- `StatsPopup`의 부상 이력 집계를 현재 슬롯 전체 로그가 아니라 `evolutionStageStartedAt` 이후 로그만 보도록 정리해, `injuries` 누적값과 같은 범위를 표시하도록 맞췄습니다.
- `activityLogs`와 `battleLogs`를 함께 정규화하는 순수 helper를 추가해, 같은 배틀 부상이 두 소스에 동시에 있어도 1건으로 dedupe 되도록 정리했습니다.
- `부상 과다` 카드의 안내 문구를 `현재 단계 누적 부상` 기준으로 고쳐, 실제 게임 규칙과 화면 텍스트가 같은 의미를 가지도록 맞췄습니다.

### 1초 틱 추가 부상 로그 누락 보정
- `updateLifespan`으로 똥 8개 방치 추가 부상이 발생했을 때, 같은 틱에서 `injuries`만 오르고 `activityLogs`가 비어 부상 이력이 덜 보이던 경로를 보정했습니다.
- poopCount가 늘지 않았더라도 `injuryReason === "poop"`이면서 `injuries`가 증가한 경우, 증가 수만큼 `POOP` 로그를 즉시 생성해 새로고침 없이도 이력 건수가 카운터와 맞도록 정리했습니다.

### 테스트 추가
- 부상 이력 helper 테스트를 추가해 현재 단계 필터링, battle/activity dedupe, 똥 8개 추가 부상 로그 분리 생성 동작을 검증하도록 했습니다.

### 영향받은 파일
- `src/components/StatsPopup.jsx`
- `src/pages/Game.jsx`
- `src/logic/stats/injuryHistory.js`
- `src/logic/stats/injuryHistory.test.js`

### 아키텍처 결정 근거
- `injuries`는 이미 현재 단계 누적 부상 수로 쓰이고 진화 시 리셋되므로, 게임 규칙을 바꾸기보다 부상 이력의 집계 범위를 현재 단계에 맞추는 편이 안전합니다.
- 배틀 로그와 활동 로그를 UI에서 직접 섞어 세면 중복/누락이 반복되므로, 표시용 정규화 함수를 하나 두고 화면은 그 결과만 읽게 하는 구조가 유지보수와 테스트에 유리합니다.

### 추가 영향 파일
- `src/components/landing/LandingShell.jsx`
- `src/components/landing/LandingTopBar.jsx`
- `src/components/landing/LandingShell.test.jsx`
- `src/App.jsx`
- `src/App.test.js`

## 2026-04-04

### 아레나 관리자 기능을 서버 API 권한 경계로 이동
- `AdminModal`의 시즌 설정 저장, 시즌 종료, 아카이브 삭제를 브라우저의 Firestore 직접 쓰기에서 아레나 전용 API 호출로 전환했습니다.
- 서버에서는 `ARENA_ADMIN_UIDS` / `ARENA_ADMIN_EMAILS` 기반 관리자 검증 뒤에만 `arena_config`, `season_archives`, 시즌 종료 배치 write를 수행하도록 정리했습니다.
- 시즌 종료는 현재 시즌 검증, 아카이브 생성, 다음 시즌 설정 반영, 모든 엔트리의 시즌 전적 초기화를 한 번의 commit payload로 묶어 처리하도록 맞췄습니다.

### 아레나 리더보드 / 로그 DTO를 하나로 정규화
- `ArenaScreen`에 live entry와 archive entry를 같은 shape로 맞추는 정규화 함수를 추가해 현재 시즌, 전체 누적, 과거 시즌이 같은 렌더 경로를 사용하도록 정리했습니다.
- 신규 등록 엔트리는 생성 시점부터 `record.seasonId`, `record.seasonWins`, `record.seasonLosses`를 함께 저장해 첫 전투 전에도 현재 시즌 리더보드에 정상 노출되게 했습니다.
- 과거 시즌 아카이브는 최소 필드만 담는 snapshot으로 정리해 이전 평탄한 archive 데이터와 새 snapshot 데이터 둘 다 화면에서 읽을 수 있게 했습니다.

### 아레나 배틀 로그 다시보기 신뢰도를 강화
- `useGameActions`의 아레나 결과 저장은 클라이언트 Firestore 직접 update 대신 `/api/arena/battles/complete` 서버 API를 사용하도록 바꿨습니다.
- 서버는 Supabase replay archive upsert가 성공한 뒤에만 Firestore summary log를 `archiveStatus: "ready"` 상태로 기록하도록 바꿔, 다시보기 CTA가 거짓 양성으로 뜨지 않게 했습니다.
- 프론트에서는 `archiveId`뿐 아니라 `archiveStatus`까지 보고 다시보기 가능 여부를 판단하도록 조정했습니다.

### 영향받은 파일
- `api/_lib/arenaHandlers.js`
- `api/_lib/arenaHandlers.test.js`
- `tests/arena-entrypoints.test.js`
- `firestore.rules`
- `src/components/AdminModal.jsx`
- `src/components/AdminModal.test.jsx`
- `src/components/ArenaScreen.jsx`
- `src/components/ArenaScreen.test.jsx`
- `src/components/GameModals.jsx`
- `src/hooks/useGameActions.js`
- `src/utils/arenaApi.js`
- `api/arena/admin/config.js`
- `api/arena/admin/end-season.js`
- `api/arena/admin/archives/[archiveId].js`
- `api/arena/battles/complete.js`
- `api/_lib/firestoreAdmin.js`
- `api/_lib/auth.js`

### 아키텍처 결정 근거
- 아레나 시즌 종료와 전적 반영은 클라이언트 권한으로 두면 조작 가능성이 높아 서버 검증과 서버 write로 이동하는 편이 맞습니다.
- 리더보드와 아카이브가 서로 다른 DTO를 쓰면 렌더 분기가 계속 늘어나므로, 정규화 계층을 하나 두고 화면은 같은 필드를 읽게 하는 구조가 유지보수에 유리합니다.
- `game_settings` 전체를 막아 버리면 기존 마스터 데이터 편집 기능까지 함께 깨지므로, 이번 라운드에서는 `arena_config`와 아레나 컬렉션만 우선 서버 전용 경계로 분리했습니다.

### Landing Memory Scene 공백 축소
- `Memory Scene`의 with-artwork 레이아웃에서 `min-height`를 자동으로 낮추고, copy grid를 `align-content: start`로 바꿔 큰 문구와 대표컷 이미지가 연속해서 붙어 보이도록 정리했습니다.
- 데스크톱과 모바일 모두 `padding`과 `gap`을 다시 잡아, `1999년 그 여름, 디지털월드` 문구 아래에서 카드가 곧바로 시작되는 전시형 배치를 유지하도록 맞췄습니다.
- 대표컷이 문구와 겹쳐 보이지 않도록, 대표컷 그리드의 상단 여백을 데스크톱에서는 크게 다시 확보하고 모바일은 별도 축약값으로 조정했습니다.
- 대표컷 아래 바닥 여백도 추가로 확장해, 다음 섹션으로 넘어가기 전 여운이 남는 전시형 구역 높이를 확보했습니다.
- 큰 문구 위쪽 여백도 대표컷 아래 바닥 여백과 같은 기준으로 맞춰, 회상 구간의 상하 여백 밸런스를 통일했습니다.

### CTA를 풀블리드 엔딩 씬으로 전환
- CTA 구간의 중앙 카드 구조를 풀고, 상단 `copy zone`과 하단 `featured image zone`으로 분리해 마지막 장면처럼 화면을 크게 쓰는 레이아웃으로 전환했습니다.
- 버튼과 보조 링크는 제목 아래에 유지하고, 디바이스 이미지는 기존 720px 카드 제한을 해제해 거의 viewport 폭에 가깝게 크게 보여주도록 확장했습니다.
- 모바일에서는 CTA 높이를 자동으로 줄이되, 버튼과 이미지가 겹치지 않도록 별도 여백과 이미지 높이를 다시 조정했습니다.

### 추가 영향 파일
- `src/components/landing/CTA.jsx`
- `src/styles/landing.css`

### 헤더 메뉴/브랜드 일관성 정리
- 랜딩, 일반 서비스, 노트북 전용 헤더가 각각 다른 메뉴 라벨을 쓰던 상태를 공용 헤더 메뉴 정의로 정리하고, `/landing` 라벨은 모두 `소개`로 통일했습니다.
- 랜딩 헤더는 로그인 시 일반 헤더와 동일하게 `테이머(설정)`을 노출하도록 맞췄고, 일반 서비스 헤더와 노트북 전용 헤더에는 앱 아이콘을 브랜드 영역에 추가했습니다.
- 노트북 전용 헤더는 기존 레트로 정보바 레이아웃을 유지하되, 소개 라벨과 브랜드 마크만 공용 기준을 재사용하도록 정리했습니다.

### 추가 영향 파일
- `src/data/headerNavigation.js`
- `src/components/layout/TopNavigation.jsx`
- `src/components/home/NotebookTopBar.jsx`
- `src/components/landing/LandingTopBar.jsx`
- `src/components/layout/NavigationLinks.test.jsx`
- `src/components/landing/LandingShell.test.jsx`
- `src/index.css`

### 추가 영향 파일
- `src/styles/landing.css`

### Landing 성장 섹션 폭 정렬
- `Growth` 섹션만 공통 `landing-constrain` 래퍼를 쓰지 않아 다른 랜딩 섹션보다 좌우 여백이 더 좁아 보이던 문제를 정리했습니다.
- 성장 섹션도 Hero, Memory, CTA와 같은 반응형 폭 규칙을 재사용하도록 래퍼를 `landing-constrain`으로 통일해, 데스크톱과 모바일 모두 같은 좌우 리듬으로 보이게 맞췄습니다.

### 추가 영향 파일
- `src/components/landing/Growth.jsx`

## 2026-04-07

### 원작풍 상하 공격 훈련의 타이머/판정 연출을 다시 정리
- `TrainPopup`의 남은 시간은 1초씩 단순 감소시키는 대신, 각 라운드의 마감 시각을 기준으로 다시 계산하도록 바꿔 실제 화면에서도 카운트가 안정적으로 줄어들게 정리했습니다.
- 공격 패드는 내 디지몬 바로 오른쪽에 더 작게 밀착시키고, 레일 영역은 더 넓혀 공격 스프라이트가 상대 쪽 끝까지 더 멀리 날아가도록 조정했습니다.
- 숨김 정보는 퍼펫 위가 아니라 공격 경로 중앙의 `?`에서만 보이게 고정했고, 판정 공개 시에는 `명중 성공` / `방어당함`, `막음` / `명중` 표기를 함께 써서 맞았는지 막혔는지 한눈에 구분되도록 강화했습니다.
- 모바일 구간도 전투 무대를 가능한 한 한 줄에 유지하도록 열 폭과 카드 크기를 다시 압축해, 한 화면 안에서 전투 흐름을 읽기 쉽게 맞췄습니다.
- 공격 스프라이트는 이제 레일의 왼쪽 끝에서 출발하고, 막힘일 때는 중간 방패 이모지에 걸려 정지하며, 명중일 때는 퍼펫 쪽까지 도달해 `피격!` 반응과 함께 상대가 맞은 장면처럼 보이도록 연출을 보강했습니다.
- 막힘 연출은 레일 중앙 `🛡️`에서 투사체가 멈추도록 바꿨고, 명중 연출은 투사체가 끝까지 날아가 퍼펫 쪽 `피격` 반응과 흔들림이 함께 보이도록 강화했습니다.
- 왼쪽 전투판은 `내 디지몬`과 `공격 패드`를 하나의 카드 안에서 단순한 2열 그리드로 합쳐, 선택과 발사 시작점이 같은 덩어리로 읽히도록 정리했습니다.
- 오른쪽 상대 퍼펫은 CSS 도형 대신 `public/images/567.png` 스프라이트 이미지를 직접 사용하도록 바꿔, 훈련용 상대가 더 선명한 픽셀 아트로 보이게 정리했습니다.
- 샌드백이 명중했을 때는 `122.png`, `123.png` 피격 이펙트를 샌드백 위에 빠르게 반복 표시하도록 추가하고, 기존 `피격!` 텍스트는 이펙트와 겹치지 않게 옆으로 밀어 함께 유지했습니다.
- 모바일 결과 모달은 한 화면에 더 안정적으로 들어오도록, 결과 카드 2열 배치와 가로 버튼 배치로 압축하고 모달 최대 높이를 viewport 기준으로 제한했습니다.
- 모바일 전투판은 공격 버튼을 샌드백 아래 세로 패널로 옮기고, 왼쪽 패널과 샌드백 카드 폭을 더 압축해 가운데 공격 레인이 더 넓게 보이도록 다시 배분했습니다.
- 모바일 헤더의 `닫기` 버튼은 우측 상단에 절대 배치로 고정해, 제목 아래로 떨어지지 않고 한 손 조작에서 바로 닿는 위치를 유지하도록 정리했습니다.
- 모바일 공격 버튼은 다시 `내 디지몬` 카드 아래로 옮기고, 상단/하단 버튼 색을 더 진하게 조정해 작은 화면에서도 방향 선택이 더 또렷하게 보이도록 다듬었습니다.
- 막힘 연출의 `🛡️` 방패 이모지는 모바일 기준에서 2배 크게 키워, 공격이 어디서 막혔는지 한눈에 식별되도록 강화했습니다.

### 영향받은 파일
- `src/components/TrainPopup.jsx`
- `src/components/TrainPopup.test.jsx`
- `src/components/TrainPopup.strictmode.test.jsx`
- `src/styles/TrainPopup.css`

### 아키텍처 결정 근거
- 시간 표시가 단순 interval 누적에 의존하면 개발 모드와 실제 렌더 타이밍 차이에서 체감이 어긋날 수 있어, 라운드 종료 시각 기준으로 다시 계산하는 편이 더 안전합니다.
- 훈련 UI는 장식보다 `어디를 쳤고`, `상대가 어디를 막았고`, `결과가 무엇인지`를 즉시 읽히는 것이 중요하므로, 숨김 위치와 결과 라벨을 전투 경로 중심으로 모으는 쪽이 더 적합합니다.

## 2026-04-09

### 수면 조명 경고 시작 시각을 실제 사건 기준으로 복원하도록 정비
- 수면 조명 경고의 30분 카운트 기준을 `화면 복귀 시각`이 아니라 `실제 경고 구간 시작 시각`으로 맞추기 위해, `stats.js`의 수면 조명 구간 분석을 공용 helper로 정리하고 lazy update와 realtime loop가 같은 기준을 쓰도록 통일했습니다.
- realtime loop는 이제 `sleepLightOnStart`가 비어 있다고 바로 `now`를 쓰지 않고, 긴 공백이 있었으면 마지막 틱부터 현재까지 수면 조명 구간을 다시 분석해 실제 활성 경고 구간의 시작 시각을 복원합니다.
- `checkCalls`와 호출 카드 view model은 수면 조명 시작 시각이 없을 때 더 이상 `now + 30분` deadline을 추정하지 않고, 시작 시각 확인 대기 상태를 보여주도록 바꿔 잘못된 데드라인이 노출되지 않게 정리했습니다.
- 수면 조명 경고 회귀 테스트도 함께 보강해, 저장된 시작 시각 유지, 백그라운드 복귀 복원, 시작 시각 미확정 시 대기 문구 표시를 각각 검증하도록 추가했습니다.

### 영향받은 파일
- `src/data/stats.js`
- `src/data/stats.test.js`
- `src/hooks/game-runtime/useGameRealtimeLoop.js`
- `src/hooks/useGameLogic.js`
- `src/hooks/useGameLogic.test.js`
- `src/utils/callStatusUtils.js`
- `src/utils/callStatusUtils.test.js`

### 아키텍처 결정 근거
- 수면 조명 경고는 lazy update와 실시간 루프가 서로 다른 시작 시각 기준을 쓰면 같은 사건이 화면마다 다른 데드라인으로 보일 수 있어, 구간 복원 로직을 한 곳으로 모으는 편이 유지보수와 회귀 방지에 더 안전합니다.
- 시작 시각이 비어 있을 때 임의로 현재 시각을 데드라인 기준으로 삼으면 사용자에게 잘못된 30분 창을 보여줄 수 있으므로, 이 경우에는 추정 deadline보다 대기 상태를 노출하는 쪽이 더 정확합니다.

### 몰입형 플레이에도 실시간 채팅 오버레이 추가
- `/play/:slotId/full` 몰입형 화면에서는 기존 전역 FAB 채팅을 일부러 숨기고 있었기 때문에, 몰입형 상단 바에 바로 여닫는 `채팅` 버튼과 unread/presence 표시를 새로 연결했습니다.
- 채팅 본문은 새 몰입형 오버레이에서 기존 `ChatRoom`의 drawer 레이아웃을 그대로 재사용해, 읽음 처리·접속자 목록·히스토리·전송 로직을 따로 복제하지 않고 같은 로비 채널을 공유하도록 유지했습니다.
- 몰입형 채팅은 닫기 버튼, 배경 클릭, `Escape` 키로 닫히고, 화면을 벗어날 때 자동으로 닫히도록 정리해 일반 플레이의 전역 drawer 상태와 섞이지 않게 맞췄습니다.
- 모바일에서는 상단 도구행 아래에 맞는 높이로 열리도록 viewport 기준 최대 높이를 따로 두고, 데스크톱은 우측 상단 오버레이 패널로 띄워 몰입형 조작 화면을 최대한 덜 가리도록 배치했습니다.
- 모바일 가로 몰입형은 실제로 폰을 눕혀 쓰는 전제가 맞기 때문에, `landscapeSide` 설정을 `자동/왼쪽/오른쪽`으로 확장하고 실제 기기 방향 감지를 우선 사용하되 사용자가 수동으로도 전환할 수 있게 보강했습니다.
- 가로 레이아웃은 이제 방향 설정에 따라 좌우 배치를 바꿀 수 있고, 모바일 `safe-area inset`도 함께 반영해 왼쪽 가로/오른쪽 가로 어느 쪽으로 돌려도 상단 바와 몰입형 화면이 더 안정적으로 맞도록 정리했습니다.

### 영향받은 파일
- `src/pages/Game.jsx`
- `src/components/layout/ImmersiveGameTopBar.jsx`
- `src/components/layout/ImmersiveGameTopBar.test.jsx`
- `src/components/layout/ImmersiveDeviceShell.jsx`
- `src/components/layout/ImmersiveDeviceShell.test.jsx`
- `src/components/chat/ImmersiveChatOverlay.jsx`
- `src/components/chat/ImmersiveChatOverlay.test.jsx`
- `src/data/immersiveSettings.js`
- `src/utils/immersiveSettings.js`
- `src/utils/immersiveSettings.test.js`
- `src/index.css`

### 아키텍처 결정 근거
- `/full`에서도 App 전역 채팅 drawer를 그대로 켜면 기존 고정 FAB가 몰입형 디바이스 레이아웃과 겹치기 쉬워, 몰입형 내부에서만 쓰는 별도 오버레이 껍데기를 두고 채팅 본문 로직은 그대로 재사용하는 편이 더 안전합니다.
- unread, presence, 마지막 읽음 커서는 이미 `AblyContext`가 단일 상태로 관리하고 있으므로, 몰입형 채팅도 같은 컨텍스트를 쓰는 쪽이 일반 플레이와 동작 차이를 만들지 않아 유지보수에 유리합니다.
- 모바일 브라우저의 landscape 좌우 방향 정보는 기기와 브라우저마다 편차가 있을 수 있어, 자동 감지에만 의존하지 않고 저장 가능한 수동 전환값을 함께 두는 편이 실제 사용성에서 더 안전합니다.

### Ver.3 데이터/자산 누락으로 인한 배포 빌드 실패 수정
- `Game`와 여러 훅/컴포넌트가 `../data/v3`, `digimonVersionUtils`, `/Ver3_Mod_TH` 스프라이트 자산을 참조하고 있었는데, 관련 파일이 로컬에만 있고 git에 포함되지 않아 Vercel에서 `Module not found`가 발생하던 문제를 정리했습니다.
- `src/data/v3`, `src/utils/digimonVersionUtils.js`, `public/Ver3_Mod_TH`를 저장소에 추가해 Ver.3 데이터/유틸/스프라이트 자산이 배포 환경에서도 같은 경로로 해석되도록 맞췄습니다.

### 영향받은 파일
- `src/data/v3/index.js`
- `src/data/v3/digimons.js`
- `src/utils/digimonVersionUtils.js`
- `public/Ver3_Mod_TH/*`
- `docs/REFACTORING_LOG.md`

### 기존 `가로` 버튼에 모바일 가로 고정 시도를 통합
- 몰입형 상단 바에 새 버튼을 늘리지 않고, 기존 `가로` 토글을 눌렀을 때 모바일에서만 `layoutMode` 전환과 함께 `requestFullscreen()` 뒤 `screen.orientation.lock("landscape")`를 best effort로 시도하도록 정리했습니다.
- iPhone Safari나 orientation lock 미지원 브라우저에서는 실패를 에러로 터뜨리지 않고, `회전 잠금을 끄고 직접 돌려 달라`는 한국어 안내 문구로 부드럽게 fallback 하도록 런타임 유틸을 분리했습니다.
- `세로` 토글을 누르면 `orientation.unlock?.()`와 fullscreen 종료를 best effort로 정리하고, 브라우저가 실제 fullscreen 상태를 바꾸면 `fullscreenchange` 구독으로 몰입형 상태 배너가 즉시 동기화되게 맞췄습니다.
- 가로 고정 성공, 미지원, 거부, 세로 복귀 경로는 `immersiveOrientation` 유틸 테스트로 분리해 검증했고, 화면에는 상단 바 바로 아래 상태 배너를 추가해 `가로 전체화면으로 보는 중` 또는 fallback 안내를 바로 확인할 수 있게 했습니다.

### 모바일 몰입형 상단 바를 더 전체화면처럼 압축
- 모바일 몰입형 상단 바는 기존처럼 넓은 흰 패널이 두 줄 이상 화면을 차지하지 않도록, 전체 폭 패널 대신 둥근 반투명 floating capsule 형태로 줄였습니다.
- `세로/가로`, 방향, 채팅, 스킨 변경 도구들은 줄바꿈 대신 가로 스크롤 가능한 한 줄 툴바로 바꿔, 버튼 수가 많아도 게임 화면 위를 크게 가리지 않도록 정리했습니다.
- 모바일에서는 `몰입형 플레이` 배지를 숨기고 버튼 패딩과 safe-area 여백을 더 촘촘하게 다듬어, 브라우저 UI 아래에서도 실제 게임 화면이 더 빨리 시작되도록 조정했습니다.
- 이에 맞춰 몰입형 본문과 채팅 오버레이의 상단 시작 위치도 함께 내려, 상단 바는 더 작아지고 디지바이스 화면은 더 많이 보이게 맞췄습니다.

### 영향받은 파일
- `src/pages/Game.jsx`
- `src/utils/immersiveOrientation.js`
- `src/utils/immersiveOrientation.test.js`
- `src/index.css`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 모바일 브라우저의 landscape lock은 사용자 클릭 맥락과 fullscreen 조건에 의존하는 경우가 많아, 별도 버튼보다 기존 `가로` 토글 안에서 `레이아웃 전환 + 가로 고정 시도`를 함께 처리하는 편이 사용 흐름과 저장 상태를 덜 어지럽힙니다.
- 브라우저별 분기와 오류 메시지를 `Game` 안에 직접 흩뿌리면 회귀 테스트가 어려워지므로, fullscreen/orientation API 호출 순서를 별도 유틸로 분리해 성공/실패/미지원 케이스를 독립적으로 검증하는 편이 유지보수에 더 안전합니다.
- 모바일 몰입형은 브라우저 주소창과 safe-area 때문에 네이티브 전체화면처럼 완전히 비울 수는 없으므로, 상단 조작부 자체를 floating overlay와 스크롤 툴바로 압축해 체감상 화면 점유율을 높이는 쪽이 웹 환경에서 더 현실적이고 안정적입니다.

## 2026-04-09

### GameDefaultSection presenter 분리
- `src/components/layout/GameDefaultSection.jsx`를 추가해 `GameScreen`과 `ControlPanel`을 내부에서 렌더링하는 기본 화면 presenter 경계를 만들었습니다.
- `headerNode`, `gameScreenProps`, `controlPanelProps`, `activeMenu`, `onMenuClick`, `stats`, `isMobile`, `supportActionsNode`만으로 동작하도록 설계해, 이후 `Game.jsx`의 `defaultGameSection` JSX를 안전하게 옮길 수 있게 했습니다.
- `src/components/layout/GameDefaultSection.test.jsx`에서는 기본 헤더, `GameScreen`, `ControlPanel`, `supportActionsNode` 렌더와 모바일 class 분기를 고정했습니다.

### 영향받은 파일
- `digimon-tamagotchi-frontend/src/components/layout/GameDefaultSection.jsx`
- `digimon-tamagotchi-frontend/src/components/layout/GameDefaultSection.test.jsx`
- `docs/REFACTORING_LOG.md`

### 검증
- `npm test -- --runInBand src/components/layout/GameDefaultSection.test.jsx`

### 모바일 몰입형 메뉴 접기와 가상 가로 fallback 추가
- 모바일 몰입형 상단 조작부는 기본적으로 접힌 상태로 시작하고, 우상단 `메뉴` FAB를 눌렀을 때만 조작 패널이 열리도록 바꿔 실제 게임 화면을 더 넓게 보이게 정리했습니다.
- 메뉴가 열린 상태에서는 바깥 영역 탭, `Esc`, 상단 액션 실행 후 자동으로 다시 접히게 맞췄고, unread 카운트는 메뉴 FAB에서도 바로 보이게 유지했습니다.
- `가로` 버튼은 여전히 실제 `fullscreen + orientation.lock("landscape")`를 먼저 시도하지만, 모바일 portrait 상태가 유지되면 작은 인앱 확인 시트로 `가상 가로 모드` 전환 여부를 묻도록 보강했습니다.
- 사용자가 한 번 가상 가로를 허용하면 같은 몰입형 세션 안에서는 이후 동일 실패에 자동으로 가상 가로를 다시 적용하고, 취소하면 그 세션 동안에는 prompt를 다시 띄우지 않도록 런타임 상태를 분리했습니다.
- 가상 가로 모드에서는 상단 메뉴와 채팅은 물리 화면 기준으로 유지하고, 게임 본문만 별도 stage 안에서 90도 회전시켜 휴대폰을 돌리지 않아도 landscape 느낌으로 볼 수 있게 구성했습니다.

### 영향받은 파일
- `src/hooks/game-runtime/useImmersiveGameLayout.js`
- `src/hooks/game-runtime/useImmersiveGameLayout.test.js`
- `src/components/layout/ImmersiveGameTopBar.jsx`
- `src/components/layout/ImmersiveGameTopBar.test.jsx`
- `src/components/layout/ImmersiveGameView.jsx`
- `src/components/layout/ImmersiveGameView.test.jsx`
- `src/pages/Game.jsx`
- `src/index.css`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 모바일 브라우저에서는 주소창과 safe-area 때문에 상단 조작부를 완전히 없애기보다, 기본 숨김 FAB와 필요 시 오버레이 패널로 나누는 편이 전체화면 체감과 조작 접근성 사이 균형이 가장 좋습니다.
- 실제 기기 회전 강제는 브라우저 제약으로 일관되지 않으므로, 먼저 표준 fullscreen/orientation API를 시도하고 실패 시 사용자 동의를 거쳐 앱 화면만 회전하는 가상 가로 fallback으로 내려가는 2단계 전략이 가장 현실적입니다.
- 가상 가로는 브라우저/기기 상태와 무관한 렌더링 fallback이므로 저장 스키마가 아니라 몰입형 세션 런타임 상태로만 관리하는 편이 예측 가능성과 회귀 방지에 유리합니다.

### Ver.4 / Ver.5 배포 누락 데이터와 스프라이트 보정
- `Game.jsx`와 버전 유틸이 이미 `Ver.4`, `Ver.5`를 참조하고 있었는데, 실제 배포에는 `src/data/v4`, `src/data/v5`, 그리고 각 버전의 스프라이트 폴더가 Git에 빠져 있어 Vercel에서 `Can't resolve '../data/v4'` 빌드 오류가 발생했습니다.
- 로컬 기준으로는 파일이 존재해 빌드가 통과했기 때문에, 이번 수정은 기능 변경이 아니라 `Ver.4`, `Ver.5` 데이터 정의와 `/Ver4_Mod_TH`, `/Ver5_Mod_TH` 정적 자산을 저장소에 포함시키는 배포 일치성 보정에 집중했습니다.
- `src/utils/digimonVersionUtils.js`도 함께 반영해 버전 선택 시 `Ver.4`, `Ver.5` 데이터 맵과 시작 디지타마, 사망 폼, 스프라이트 기준 경로를 일관되게 참조하도록 맞췄습니다.

### 영향받은 파일
- `src/data/v4/index.js`
- `src/data/v4/digimons.js`
- `src/data/v5/index.js`
- `src/data/v5/digimons.js`
- `src/utils/digimonVersionUtils.js`
- `public/Ver4_Mod_TH/*`
- `public/Ver5_Mod_TH/*`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 버전 데이터는 코드와 자산이 같이 배포되어야 의미가 있으므로, 임시 import 제거보다 실제 버전 데이터와 스프라이트 세트를 저장소에 정식 포함하는 쪽이 기능 일관성과 추후 유지보수에 더 안전합니다.
- 로컬 워크트리에는 이미 파일이 있어도 Vercel은 Git 커밋 기준으로만 빌드하므로, 버전 확장 작업에서는 데이터 정의 파일과 public 스프라이트 폴더의 추적 상태를 함께 확인하는 편이 재발 방지에 효과적입니다.

### GameDefaultSection 배포 누락 보정
- `Game.jsx`가 이미 `GameDefaultSection` presenter를 import하고 있었지만, 실제 `src/components/layout/GameDefaultSection.jsx`와 테스트 파일이 Git에 누락되어 Vercel에서 `Can't resolve '../components/layout/GameDefaultSection'` 오류가 발생했습니다.
- 로컬 빌드는 미추적 파일이 워크트리에 존재해 통과했기 때문에, 이번 수정은 presenter 기능 변경이 아니라 저장소 추적 상태를 맞춰 배포 환경과 로컬 환경을 일치시키는 데 집중했습니다.

### 영향받은 파일
- `src/components/layout/GameDefaultSection.jsx`
- `src/components/layout/GameDefaultSection.test.jsx`
- `docs/REFACTORING_LOG.md`

### GamePage presenter 배포 누락 보정
- `Game.jsx`가 `GamePageView`, `GamePageToolbar`, `ImmersiveLandscapeSection` presenter를 이미 import하고 있었지만, 실제 파일들이 Git에 누락되어 Vercel에서 `Can't resolve '../components/layout/GamePageView'` 오류가 발생했습니다.
- 세 파일은 기본 화면/툴바/가로 몰입형 셸 조합을 담당하는 presenter 계층이라, 임시로 import를 제거하기보다 파일 자체와 테스트를 함께 저장소에 포함시켜 로컬과 배포 환경을 일치시키는 쪽으로 정리했습니다.

### 영향받은 파일
- `src/components/layout/GamePageView.jsx`
- `src/components/layout/GamePageView.test.jsx`
- `src/components/layout/GamePageToolbar.jsx`
- `src/components/layout/GamePageToolbar.test.jsx`
- `src/components/layout/ImmersiveLandscapeSection.jsx`
- `src/components/layout/ImmersiveLandscapeSection.test.jsx`
- `docs/REFACTORING_LOG.md`

### Ver.4 / Ver.5 플레이 가능 확장과 Ver.3~Ver.5 로컬 조그레스 활성화
- `Ver.4`, `Ver.5`를 신규 슬롯 생성, 로드, 일반 진화, 사망, 도감, 마스터데이터까지 실제로 사용할 수 있는 지원 버전으로 승격했습니다. 기준 로스터는 [Wikimon Ver.4](https://wikimon.net/Digital_Monster_COLOR_Ver.4), [Wikimon Ver.5](https://wikimon.net/Digital_Monster_COLOR_Ver.5), [Humulos DMC](https://humulos.com/digimon/dmc/) 진화표와 DigiROM, 그리고 로컬 `VB for DMC Sprite Conversion`의 공식 로스터 폴더를 함께 대조해 확정했습니다.
- `src/data/v4`, `src/data/v5`에 각 버전별 `Digitama 1 + death 2 + living roster 19` 구조를 추가하고, stage 스키마는 현재 앱 공용 규칙인 `Digitama > Baby I > Baby II > Child > Adult > Perfect > Ultimate > Super Ultimate`를 그대로 따르도록 맞췄습니다.
- 내부 ID는 레거시 데이터 호환성을 우선해 공백 없는 기준명을 유지했습니다. Ver.4는 `Biyomon -> Piyomon`, `Cockatrimon -> Kokatorimon`, `Megadramon -> Ultimatedramon`, `Bloom Lordmon -> BloomLordmon`으로, Ver.5는 `DarkTyrannomon -> DarkTyranomon`, `MetalTyrannomon -> MetalTyranomon`, `Machinedramon -> Mugendramon`으로 별칭만 허용하고 실제 게임 데이터 ID는 통일된 이름만 쓰도록 정리했습니다.
- 스프라이트 추출은 `Individual Sprites`를 source of truth로 두고 `_0.png`를 우선 사용했습니다. `_0.png`가 없는 경우에는 같은 폴더의 첫 번째 프레임을 fallback으로 복사했고, 공식 개별 스프라이트가 비어 있는 엔트리는 `0.png` placeholder를 유지했습니다. `Digitama`와 버전별 사망 폼은 공식 로스터에 개별 파일이 없어 기존 placeholder 자산을 재사용했습니다.
- 조그레스는 이제 Ver.3~Ver.5 사이의 크로스 버전 조합까지 로컬에서 실제 획득 가능하게 열었습니다. `BanchoLeomon + Darkdramon -> Chaosmon`, `Chimairamon + Mugendramon -> Millenniumon`, `Darkdramon + Mugendramon -> Chaosdramon` 같은 조합은 가이드 표시에만 머물지 않고 실제 진화 로직과 버튼 노출까지 연결됩니다.
- 반대로 온라인 조그레스는 이번에 Ver.3~Ver.5로 일반화하지 않았습니다. Firestore room 생성/참가/완료 흐름은 여전히 Ver.1/Ver.2만 지원하고, Ver.3~Ver.5 슬롯에서는 온라인 진입을 막은 뒤 한국어 안내 문구로 후속 지원 예정임을 명시하도록 정리했습니다.

### 영향받은 파일
- `src/data/v4/index.js`
- `src/data/v4/digimons.js`
- `src/data/v5/index.js`
- `src/data/v5/digimons.js`
- `src/utils/digimonVersionUtils.js`
- `src/hooks/useGameData.js`
- `src/hooks/useEvolution.js`
- `src/hooks/game-runtime/buildGamePageViewModel.js`
- `src/utils/jogressUtils.js`
- `src/pages/Game.jsx`
- `src/components/play/NewDigimonModal.jsx`
- `src/components/GameModals.jsx`
- `src/components/JogressModeSelectModal.jsx`
- `src/components/ArenaScreen.jsx`
- `src/components/BattleScreen.jsx`
- `src/contexts/MasterDataContext.jsx`
- `src/components/DigimonMasterDataPanel.jsx`
- `src/utils/encyclopediaSummary.js`
- `src/hooks/useEncyclopedia.js`
- `src/components/panels/DigimonGuidePanel.jsx`
- `src/components/panels/EncyclopediaPanel.jsx`
- `src/utils/encyclopediaSummary.test.js`
- `src/utils/jogressUtils.test.js`
- `src/hooks/game-runtime/buildGamePageViewModel.test.js`
- `src/hooks/useEncyclopedia.test.js`
- `src/components/panels/DigimonGuidePanel.test.jsx`
- `src/components/panels/EncyclopediaPanel.test.jsx`
- `src/components/BattleScreen.test.js`
- `public/Ver4_Mod_TH/*`
- `public/Ver5_Mod_TH/*`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 버전 지원이 늘어날수록 `Ver.1/Ver.2/Ver.3` 식의 삼항 분기는 빠르게 깨지므로, 버전 레지스트리와 cross-version lookup을 공통 유틸로 끌어올리는 편이 신규 버전 추가와 회귀 방지에 훨씬 유리합니다.
- Ver.3의 `Chaosmon`, `Millenniumon`은 이미 원작 기준 최종 로스터였기 때문에, Ver.4/Ver.5를 활성화한 뒤에는 더 이상 “가이드 전용”으로 두기보다 실제 로컬 조그레스로 승격하는 편이 데이터 의미와 플레이 경험을 일치시킵니다.
- 공식 로스터 스프라이트는 버전마다 누락과 명칭 차이가 섞여 있어 전부를 강제로 정규화하기보다, `Individual Sprites 우선 + 첫 프레임 fallback + placeholder 유지` 정책을 명문화하는 쪽이 안전합니다.
- 온라인 조그레스는 Firestore room 스키마와 상대 버전 매칭 흐름까지 함께 일반화해야 하므로, 이번 범위에서는 플레이 가능한 로컬 조그레스까지 먼저 완성하고 온라인 확장은 별도 작업으로 defer하는 편이 리스크가 낮습니다.

### 몰입형 독립 전체화면 버튼 추가
- 몰입형 상단 바에 `전체화면` / `전체화면 종료` 버튼을 추가해, 세로/가로 상태를 바꾸지 않고도 현재 몰입형 화면만 fullscreen으로 전환하거나 빠져나올 수 있게 했습니다.
- 기존 `가로` 버튼은 그대로 `fullscreen + landscape lock + fallback` 흐름을 담당하고, 새 `전체화면` 버튼은 orientation lock을 건드리지 않는 별도 fullscreen-only 동작으로 분리했습니다.
- iPhone Safari처럼 fullscreen 제약이 큰 브라우저에서도 버튼은 그대로 보이게 두고, 누를 때 `전체화면 미지원` 안내 문구를 같은 몰입형 상태 배너 영역에 보여주도록 정리했습니다.
- 데스크톱과 모바일 모두 같은 버튼을 사용하고, 모바일에서는 다른 상단 액션과 동일하게 실행 후 메뉴가 자동으로 접히도록 맞췄습니다.

### 영향받은 파일
- `src/utils/immersiveOrientation.js`
- `src/utils/immersiveOrientation.test.js`
- `src/hooks/game-runtime/useImmersiveGameLayout.js`
- `src/hooks/game-runtime/useImmersiveGameLayout.test.js`
- `src/components/layout/ImmersiveGameTopBar.jsx`
- `src/components/layout/ImmersiveGameTopBar.test.jsx`
- `src/pages/Game.jsx`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- fullscreen과 landscape lock은 브라우저 지원 범위가 다르므로, 하나의 버튼에 모두 얹기보다 `가로`와 `전체화면`을 역할별로 분리하는 편이 실패 원인과 사용자 기대를 더 명확하게 맞출 수 있습니다.
- 기존 `orientationStatusMessage` 슬롯을 재사용하면 별도 토스트나 모달을 늘리지 않고도 fullscreen 실패/미지원 상태를 일관된 위치에서 전달할 수 있어 몰입형 UI 복잡도를 낮출 수 있습니다.
- 모바일과 데스크톱이 같은 몰입형 상단 바를 공유하는 구조이므로 fullscreen 버튼도 공통 props로 추가하는 편이 조건 분기와 테스트 중복을 줄이는 데 유리합니다.

### 몰입형 상단 우측 버튼 가시성 강화
- 모바일 몰입형 우측 상단 토글은 기존 아이콘-only 원형 버튼 대신 `☰ 메뉴` / `× 닫기` 라벨이 붙은 진한 네이비 캡슐형 FAB로 바꿔, 밝은 배경과 브라우저 UI 위에서도 더 빠르게 인지되도록 정리했습니다.
- 펼쳐진 모바일 메뉴 패널은 FAB와 한 세트처럼 보이도록 그림자와 외곽선 대비를 높이고, 상단에 짧은 다크 accent bar를 넣어 “전역 조작 메뉴” 성격이 중앙의 `정보 펼치기` 토글과 덜 겹치게 했습니다.
- 데스크톱 몰입형은 우측 도구군을 하나의 dark surface 안에 묶어, 채팅/스킨/세로·가로 전환 영역이 좌측 기본 액션보다 뒤로 물러나지 않고 분명한 보조 조작 패널처럼 보이도록 맞췄습니다.

### 영향받은 파일
- `src/components/layout/ImmersiveGameTopBar.jsx`
- `src/components/layout/ImmersiveGameTopBar.test.jsx`
- `src/index.css`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 모바일 세로 몰입형은 상단 공간이 제한적이라, 버튼 수를 늘리기보다 기존 FAB 자체를 더 명확한 라벨형 트리거로 만드는 편이 정보 밀도와 탐색성 사이 균형이 가장 좋습니다.
- 중앙 `정보 펼치기`와 우측 전역 메뉴는 역할이 다르므로, 동작을 바꾸기보다 색/위치/톤으로 시각 계층을 분리하는 쪽이 회귀 리스크가 낮고 학습 비용도 적습니다.
- 데스크톱과 모바일이 같은 조작 집합을 공유하더라도, 우측 도구 묶음에 공통된 surface 언어를 주면 “몰입형 전역 도구”라는 개념이 일관되게 전달돼 이후 메뉴 확장에도 유리합니다.

### 가로 몰입형 기본 화면 확대 및 정보 오버레이 분리
- 브릭 프레임 스킨의 가로 몰입형에서는 상태 카드와 보조 액션을 기본 화면에서 빼고, 디바이스 스테이지와 상하 버튼 스트립만 먼저 보이도록 바꿨습니다. 덕분에 첫 화면이 실제 디지바이스 뷰처럼 더 크게 차지합니다.
- 가로 몰입형 상단 바에 `정보/진화` / `정보/진화 닫기` 버튼을 추가해, 슬롯/기종/현재 시간/하트/상태 배지와 진화·가이드 같은 보조 액션은 별도 오버레이로 열어 볼 수 있게 분리했습니다.
- 모바일에서는 이 `정보/진화` 버튼을 메뉴 패널 안이 아니라 우측 상단 `메뉴` FAB 바로 아래의 독립 플로팅 버튼으로 분리해, 가로 몰입형에서 더 바로 접근할 수 있게 배치했습니다.
- 브릭 프레임 스킨은 landscape stage 최대 폭과 shell padding을 줄여 전체화면이나 가로 모드에서 기기 이미지가 화면을 더 가득 쓰도록 조정했고, 모바일에서는 stage와 버튼 스트립이 `100%` 폭을 쓰도록 맞췄습니다.

### 영향받은 파일
- `src/pages/Game.jsx`
- `src/hooks/game-runtime/useImmersiveGameLayout.js`
- `src/hooks/game-runtime/useImmersiveGameLayout.test.js`
- `src/components/layout/ImmersiveGameTopBar.jsx`
- `src/components/layout/ImmersiveGameTopBar.test.jsx`
- `src/components/layout/ImmersiveGameView.jsx`
- `src/components/layout/ImmersiveGameView.test.jsx`
- `src/components/layout/ImmersiveLandscapeSection.jsx`
- `src/components/layout/ImmersiveLandscapeSection.test.jsx`
- `src/components/layout/ImmersiveLandscapeInfoOverlay.jsx`
- `src/components/layout/ImmersiveLandscapeInfoOverlay.test.jsx`
- `src/index.css`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 가로 몰입형에서 가장 중요한 콘텐츠는 디바이스 프레임과 게임 화면이므로, 항상 보여야 하는 정보와 필요할 때만 보는 정보를 분리하는 편이 “몰입감”과 “조작성”을 동시에 유지하기 좋습니다.
- landscape frame skin 전용 오버레이로 처리하면 기존 세로 헤더 구조를 억지로 재사용하지 않아도 되고, non-frame landscape 레이아웃 회귀 없이 브릭 디바이스 경험만 더 강하게 다듬을 수 있습니다.
- 정보 패널을 `ImmersiveGameView`의 별도 overlay layer로 올리면 채팅/스킨 picker와 같은 방식으로 z-index, backdrop, ESC 닫기 동작을 일관되게 관리할 수 있어 이후 몰입형 보조 패널 확장에도 유리합니다.

### 브릭 가로 모바일 스케일 축소
- 모바일에서 `벽돌 Ver.1` 가로 몰입형이 과하게 확대돼 보이던 문제를 줄이기 위해, 브릭 스킨 landscape shell의 최대 폭과 frame padding을 한 단계 더 낮췄습니다.
- 함께 상·하단 버튼 스트립의 최대 폭, gap, 내부 패딩도 줄여서 디바이스와 버튼 패널이 화면 안에서 조금 더 여유 있게 보이도록 조정했습니다.
- 모바일 브릭 스트립의 버튼 크기도 살짝 낮춰, 전체 구성이 확대된 카드처럼 보이지 않고 실제 디바이스 주변 UI처럼 보이게 맞췄습니다.

### 영향받은 파일
- `src/components/layout/ImmersiveLandscapeControls.jsx`
- `src/index.css`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 모바일 브릭 가로 화면은 stage 폭만 줄이면 버튼 스트립 비율이 어색해지고, 버튼만 줄이면 프레임이 과하게 커 보여서 `쉘 + 프레임 + 스트립 버튼`을 함께 줄이는 편이 전체 균형이 가장 자연스럽습니다.
- 이 조정은 `brick-ver1` 모바일 landscape에만 집중해 적용하면 다른 세로 스킨이나 일반 landscape 레이아웃 회귀 없이 원하는 체감만 줄일 수 있습니다.

### 세로 여백 확장 + 브릭 가로 모바일 균형형 반응형 스케일
- 모바일 세로 몰입형의 상단 여백을 `3.35rem`에서 `4.35rem`로 늘려, 상단 FAB와 헤더 콘텐츠 사이 breathing room을 조금 더 확보했습니다.
- 모바일 `벽돌 Ver.1` 가로 몰입형은 고정 상한 `26.25rem / 25.2rem` 위주의 스케일에서, viewport 기반 `width budget + height cap` 반응형 스케일로 바꿨습니다.
- 실제 landscape와 가상 landscape는 사용하는 viewport 기준이 달라서, 두 경우 모두에 맞는 모바일 CSS 변수를 따로 두고 `shell width`, `frame stage width`, `control strip width`가 함께 움직이도록 맞췄습니다.
- 이어서 모바일 브릭 landscape에서는 쉘 상단 여백을 조금 더 늘리고 frame 좌측 inset은 줄여, 상단이 덜 답답하고 디바이스가 왼쪽으로 조금 더 넓게 차 보이도록 미세 조정했습니다.
- 모바일 브릭 상·하단 5버튼 스트립은 가로 스크롤 대신 `5열 고정 그리드`로 바꿔, 다섯 버튼이 항상 한눈에 보이도록 정리했습니다.
- 모바일 가로 몰입형의 `정보/진화` 버튼은 메뉴 FAB 아래가 아니라 같은 줄 왼쪽으로 옮겨, 디바이스 상단 버튼 줄과 겹치지 않고 전역 도구라는 인지가 더 쉽게 보이도록 조정했습니다.
- 세로로 들고 있는 브릭 landscape 회전 안내 상태에서는 상단 5버튼 줄이 떠 있는 전역 버튼 아래에서 시작되도록 display 상단 여백을 추가했습니다.
- 이후 같은 회전 안내 상태의 상단 여백은 기존 `2.9rem`의 `1.7배`인 `4.93rem`로 다시 늘려, 전역 버튼 줄과 상단 5버튼 줄이 더 확실히 분리되도록 미세 조정했습니다.

### 영향받은 파일
- `src/index.css`
- `src/components/layout/ImmersiveLandscapeControls.jsx`
- `src/components/layout/ImmersiveLandscapeControls.test.jsx`
- `src/components/layout/ImmersiveGameTopBar.jsx`
- `src/components/layout/ImmersiveGameTopBar.test.jsx`
- `docs/REFACTORING_LOG.md`

### 아키텍처 결정 근거
- 브라우저 UI, safe area, 노치 때문에 웹에서 모든 휴대폰을 완전히 동일한 full-bleed로 보이게 하는 것은 어렵지만, viewport 기반으로 `너비 우선 + 높이 안전 캡`을 함께 쓰면 기기마다 더 꽉 차면서도 잘리지 않는 균형형 스케일을 만들 수 있습니다.
- 세로 몰입형 여백 증가는 모바일 헤더 블록에만 적용하면 가로 몰입형과 데스크톱 레이아웃을 건드리지 않고도 시각적 답답함만 완화할 수 있습니다.
- 브릭 가로 모바일은 실제 디지바이스처럼 상·하단 5버튼이 동시에 보여야 조작성 인지가 좋아지므로, 아주 작은 화면에서도 스크롤보다 `5열 고정`이 더 적합했습니다.
- 모바일 전역 버튼은 세로 스택보다 가로 한 줄 배치가 상단 실제 게임 조작 줄과 충돌이 적고, 회전 안내 상태에서는 상단 콘텐츠 시작점도 함께 내려야 겹침을 줄일 수 있습니다.
