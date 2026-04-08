# REFACTORING LOG

## 2026-04-08

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

### 영향받은 파일
- `src/components/TrainPopup.jsx`
- `src/components/TrainPopup.test.jsx`
- `src/components/TrainPopup.strictmode.test.jsx`
- `src/styles/TrainPopup.css`

### 아키텍처 결정 근거
- 시간 표시가 단순 interval 누적에 의존하면 개발 모드와 실제 렌더 타이밍 차이에서 체감이 어긋날 수 있어, 라운드 종료 시각 기준으로 다시 계산하는 편이 더 안전합니다.
- 훈련 UI는 장식보다 `어디를 쳤고`, `상대가 어디를 막았고`, `결과가 무엇인지`를 즉시 읽히는 것이 중요하므로, 숨김 위치와 결과 라벨을 전투 경로 중심으로 모으는 쪽이 더 적합합니다.
