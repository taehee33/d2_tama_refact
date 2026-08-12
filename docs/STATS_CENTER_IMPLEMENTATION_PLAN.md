# 스탯 센터 1차 구현 계획

## 목표

- 현재 상태 아이콘 하나를 유지한다.
- 상태 아이콘은 신규 `statsCenter` 모달을 연다.
- 일반 사용자에게는 `[상태]`, 운영자에게는 `[상태] [고급·진단]`을 보여준다.
- 기존 `StatsPopup`/`stats` 모달의 `[Old] [New]`, 편집, 저장, 재시도 계약은 그대로 보존한다.
- 인게임 `StatsPanel`은 한글화하되 숫자 나열과 아코디언 구조를 유지한다.

## 범위 잠금

### 포함

1. `statsCenter` 모달 key와 상태 아이콘 진입 경로
2. 기본은 읽기 전용이며, 운영자에게만 1차 허용 항목 편집을 제공하는 `StatsCenterPopup`
3. 운영자 권한에 따른 `고급·진단` 탭 노출
4. 기존 `stats` 모달로의 안전한 전환
5. `StatsPanel` 노출 문구 한글화
6. 저장 시점 운영자 권한 재확인과 편집 allowlist·범위 정규화
7. 단위·조립 테스트와 실제 화면 QA

### 제외

- `StatsPopup.jsx` 리팩터링 또는 `[Old] [New]` 변경
- Firestore 경로, 슬롯 스키마, 저장 payload, IndexedDB outbox 변경
- lazy update 재계산 또는 실시간 저장 타이머 추가
- 스탯 비교표, 기준값 대비 차이
- 1차 allowlist 밖의 수명·진화 타이머·종 고정값·냉장·사망·호출·메타데이터 편집
- 로컬 `developerMode`를 운영자 판정으로 사용하는 변경

## 핵심 구현 계약

### 1. 모달 전환은 하나의 handler가 소유한다

`openLegacyStats()`가 `statsCenter=false`, `stats=true`를 함께 처리한다. 하위 컴포넌트가 `close → open`을 각각 호출하지 않는다. 이 경계에서 `statsCenter`와 `stats`의 동시 open을 금지한다.

### 2. 운영자 권한은 3가지 표시 상태로 검증한다

| 상태 | `고급·진단` 탭 |
|---|---|
| `isOperatorStatusLoading=true` | 표시하지 않음 |
| `loading=false && canViewDiagnostics=false` | 표시하지 않음 |
| `loading=false && canViewDiagnostics=true` | 표시함 |

팝업이 열린 상태에서 `canViewDiagnostics` 가 `true → false`로 바뀌면 즉시 `[상태]`로 복귀한다. 운영자 상태는 `Game` 상위의 기존 `useOperatorStatus()` 결과를 재사용하며, 팝업을 열 때마다 API를 재호출하지 않는다.

### 3. `statsCenterViewModel`은 표시 정규화만 담당한다

```text
raw game state
   ↓
statsCenterViewModel
   ↓
display-only normalized values
```

허용 범위는 `winRate/winRatio`, `hunger/fullness` 같은 표시용 fallback과 한글 표시 포맷으로 제한한다.

- 원본 객체 mutation 금지
- 저장용 payload 생성 금지
- lazy update 호출 금지
- fallback을 명분으로 게임 규칙 재계산 금지

### 4. `[상태]` 1차 필드를 고정한다

`[상태]`에는 아래 값만 노출한다.

1. 나이
2. 몸무게
3. 배고픔
4. 힘
5. 에너지
6. 승률
7. 노력치
8. 케어 미스
9. 수면 상태
10. 부상 상태

내부 timestamp, revision, ledger, raw timer/counter/flag는 `[상태]`에서 제외하고 읽기 전용 `[고급·진단]`에만 배치한다.

### 5. 운영자 편집은 1차 allowlist로 한정한다

`[고급·진단]`의 진단 값은 기본적으로 읽기 전용으로 유지한다. 서버에서 확인된 운영자만 별도 `스탯 수정` 폼으로 진입할 수 있다.

- 배고픔·힘: 0~5
- 에너지: 0~현재 종 최대치
- 체중, 케어 미스, 훈련, 과식, 현재 형태 승리·패배: 0 이상 정수
- 배변: 0~8, 프로틴 과다: 0~7, 부상 횟수: 0~15
- 부상 상태: boolean

수면 상태는 수면 일정·조명·현재 시각에서 계산되므로 수정에서 제외한다. 승률과 현재 형태 배틀 수는 승·패 횟수에서 자동 재계산한다. 저장 버튼을 누를 때 operator API로 권한을 다시 확인하고, 운영자가 실제로 건드린 필드만 기존 StatsPopup command 저장 큐에 넘긴다.

## 테스트 계약

- 상태 아이콘은 `statsCenter`를 연다.
- 기존 `stats`를 다른 경로에서 직접 열도 `StatsPopup` 의 `[Old] [New]`는 정상 동작한다.
- `openLegacyStats()` 후 `statsCenter=false`, `stats=true`이다.
- 위 3가지 권한 상태를 모두 검증한다.
- 고급 탭 선택 중 권한 소실 시 `[상태]`로 복귀한다.
- `StatsCenterPopup` unmount 후 reopen하면 `[상태]`로 초기화된다.
- `statsCenterViewModel`이 원본을 변경하지 않는다.
- 일반 사용자는 고급·진단과 편집 컨트롤을 볼 수 없다.
- 운영자 편집은 allowlist 밖 필드를 거부하고 항목별 범위를 정규화한다.
- 편집 중 외부 상태가 갱신돼도 직접 수정한 필드만 저장한다.

## 기준선과 완료 조건

- `BASE_SHA`: `9edfc627a814ef8999703fb2334d06213a1327ea`
- 구현 전 기준선: StatsPopup, StatsPanel, GameModals, useGameHandlers 관련 5 suite / 48 test 통과
- 최종 필수: 직접 관련 테스트, `npm run check`, 실제 브라우저의 일반·운영자·권한 소실 경로 QA
- 저장·Rules 변경이 없으므로 Firestore Emulator는 이 작업의 기본 범위에 포함하지 않는다.

## 예상 구현 순서

1. `statsCenter` modal key와 진입/전환 handler 추가
2. 표시용 view model과 `StatsCenterPopup` 추가
3. 운영자 3상태 게이트 연결
4. `StatsPanel` 한글화
5. 자동 테스트, 브라우저 시각 QA, `npm run check`
6. `docs/REFACTORING_LOG.md`와 최종 검증 결과 갱신
