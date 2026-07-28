# StatsPopup 저장 신뢰성 계약과 운영 가이드

**상태:** A+1~A+4 구현 및 운영 반영 완료

**검증 실행일:** 2026-07-26

**문서 확정일:** 2026-07-28

## 1. 목적과 결과

StatsPopup은 더 이상 팝업을 열 때 복사한 전체 stats snapshot을 저장하지 않는다. 사용자가 바꾼 필드와 사건 시각만 schema v1 command로 전달하고, 기존 직렬 저장 큐가 실행 시점의 최신 durable 상태에 명령을 적용한다.

이 구조는 다음을 보장한다.

- 오래 열어 둔 팝업이 다른 게임 액션의 변경을 과거 값으로 되돌리지 않는다.
- 빠른 서로 다른 필드 변경은 모두 보존되고, 같은 필드의 연속 변경은 최신 의도가 이긴다.
- pending 상태의 시간 변화는 큐 안에서 실행 시각까지 한 번만 lazy projection 된다.
- 원격 저장, 기기 대기, 충돌, context 차단, 완전 실패와 로컬 cleanup 경고를 구분한다.
- 야행성 state와 activity log의 부분 실패는 실패한 구성요소만 같은 identity로 재시도한다.

## 2. 공식 저장 계약

```text
Firestore: 슬롯 데이터의 공식 정본
IndexedDB: Firestore에 아직 전달되지 않은 변경의 내구성 있는 임시 outbox
localStorage: 설정·보조 데이터 저장소
```

outbox를 먼저 기록하는 실행 순서는 Firestore의 정본 지위를 바꾸지 않는다. 완전 오프라인 localStorage 슬롯 모드는 현재 공식 지원 범위가 아니다.

## 3. 저장 흐름과 책임 경계

```text
StatsPopup intent
  → uid/slotId/generation 검증
  → 기존 saveQueueRef 안에서 최신 pending·동기화·메모리 상태 선택
  → executionNow까지 lazy projection
  → 순수 command reducer 적용
  → IndexedDB outbox 기록
  → 기존 Firestore revision transaction
  → 성공한 exact mutation 정리·재조회 검증
  → 구조화된 receipt 반환
```

기준 상태 조회부터 cleanup까지 한 큐 작업 안에서 직렬화한다. UI나 큐 진입 전에 저장 snapshot 또는 patch를 완성하지 않는다. 추가 Firestore read, 새 polling, 실시간 저장 타이머는 없다.

주요 책임은 다음과 같이 분리한다.

| 경계 | 책임 |
|---|---|
| `statsPopupCommands.js` | schema v1 검증, 순수 reducer, 배변·부상 사건 시각 규칙 |
| `useGameData.js` | command API 연결, StatsPopup/legacy full-save 혼재 의도 보존 |
| `useDurableGamePersistence.js` | 직렬 큐, 최신 기준 상태 선택, outbox, revision transaction, cleanup |
| `gameSaveReceipt.js` | 내부 저장 결과와 legacy boolean/rejection 계약 변환 |
| controller/adapter | optimistic overlay, 사용자 문구, retry와 수명주기 guard |

## 4. command와 시간 계약

StatsPopup이 생성하는 명령의 핵심 shape은 다음과 같다.

```javascript
{
  schemaVersion: 1,
  type: "setStat" | "setPoopCount" | "setInjuryState" | "setNocturnal",
  field: "fullness",
  value: 3,
  occurredAt: 1785000000000
}
```

저장 경계는 고유 `commandId`, 필드별 sequence와 `uid/slotId/generation` context를 부여한다. `expectedRevision`은 UI에서 미리 고정하지 않고, pending의 `baseRevision` 또는 큐 실행 시점의 revision을 사용한다.

- `occurredAt`: 사용자가 의도를 만든 시각. retry에서도 고정하며 부상 시작·배변 임계 사건에 사용한다.
- `executionNow`: 큐가 실제 실행되는 시각. 매 실행에서 새로 계산하며 lazy projection에만 사용한다.

## 5. receipt와 사용자 표시

내부 state 저장은 다음 결과를 반환한다.

| status | 의미 | 대표 UI |
|---|---|---|
| `synced` | Firestore 반영 완료 | 저장됨 |
| `queued` | IndexedDB에 보존, 원격 대기 | 연결되면 동기화 |
| `conflict` | revision 충돌 | 기존 동기화 충돌 UI |
| `blocked` | 사용자·슬롯·generation 불일치 | 저장하지 않음 |
| `failed` | 로컬·원격 모두 안전하게 보존하지 못함 | 저장 실패·다시 시도 |

원격 성공 뒤 outbox 삭제 검증이 실패하면 원격 성공을 취소하지 않고 `localCleanup: failed` 경고를 표시한다. 해당 mutation은 같은 세션의 자동 flush에서 제외하며, 재시작 뒤에도 이미 반영된 서버 revision보다 오래된 pending을 전송하지 않는다. 기존 `saveStats()` 호출자는 A+ 전의 boolean·rejection 계약을 그대로 받는다.

## 6. 야행성 state와 activity log

야행성 변경은 toggle 재실행이 아니라 최초 목표값을 가진 `setNocturnal` 명령이다. state와 log는 같은 command context를 사용하지만 기존 비용 계약에 따라 별도 저장한다.

- state: 기존 슬롯 state transaction 1회
- log: 기존 activity log write 1회
- log 의미: 성공 완료가 아니라 `야행성 모드 ON/OFF 변경 요청`
- 선택 메타데이터: `actionKind`, `targetField`, `targetValue`, `commandId`; 기존 필수 필드와 경로는 유지

state 5종 결과와 log 4종 결과의 20개 조합을 순수 `deriveOverallReceipt()`로 계산한다. `conflict`와 `blocked`는 전체 결과를 우선하고, 부분 실패는 warning으로 드러낸다. retry는 `failed` 구성요소만 실행하고, log는 같은 `eventId`, state는 같은 목표값을 사용한다. 같은 필드의 더 최신 command가 있으면 과거 retry를 폐기한다.

## 7. 수명주기와 관측성

- 모달을 닫아도 부모 게임 저장 작업과 outbox 처리는 계속된다.
- unmount·close/reopen 뒤 늦게 끝난 Promise는 controller state를 갱신하지 않는다.
- UID·slot context가 바뀌면 optimistic overlay와 이전 저장 표시를 정리한다.
- sequence guard가 과거 완료 결과의 최신 UI 덮어쓰기를 막는다.
- `GameSyncInfo`는 state·activity·battle·feed의 전체 pending 수와 가장 오래된 대기 시간을 기존 갱신 주기로 표시한다.
- UI·로그·텔레메트리에 UID 또는 slot payload를 새로 남기지 않는다.

## 8. 비용과 호환성 불변식

| 항목 | A+ 전 | A+ 후 |
|---|---:|---:|
| 일반 StatsPopup 변경 | state transaction 1회 | 동일 |
| 야행성 변경 | state 1회 + log 1회 | 동일 |
| 추가 Firestore read | 없음 | 없음 |
| 실시간 저장 timer/polling | 없음 | 없음 |
| Firestore 경로·슬롯 문서 스키마 | 기존 계약 | 불변 |
| IndexedDB outbox 스키마 | 기존 계약 | 불변 |

로컬 IndexedDB 조회와 명령 reduce만 늘었다. batching, debounce, 전체 게임 command 전환과 Firebase 비용 최적화는 이번 범위가 아니다.

## 9. 검증과 병합 증거

| 단계 | 증거 | 결과 |
|---|---|---|
| G0 저장 계약 | PR [#28](https://github.com/taehee33/d2_tama_refact/pull/28), main `4564f81adc59b48d1795fea4eaf46fd34d9afab6` | 문서 계약·main CI 성공 |
| A+0 기준선 | base `4564f81adc59b48d1795fea4eaf46fd34d9afab6`, Node 24.14.0 | `npm run check` 성공, 구현 가능성 8항목 확인 |
| A+1 receipt/outbox | PR [#29](https://github.com/taehee33/d2_tama_refact/pull/29), main `17ee0b70be7c43933a8ae49cef9dc6a3e1ff5200` | Preview·PR CI·main CI 성공 |
| A+2 intent command | PR [#30](https://github.com/taehee33/d2_tama_refact/pull/30), main `efa1754f0fb8efa9b53355a6337adb73a029a8e5` | Preview·PR CI·main CI 성공 |
| A+3 부분 실패 | PR [#31](https://github.com/taehee33/d2_tama_refact/pull/31), main `731f7c80ca09cf08e2e9c6e7ddc96a65781850e8` | Preview·PR CI·main CI 성공 |
| A+4 UX·관측성 | PR [#32](https://github.com/taehee33/d2_tama_refact/pull/32), main `a24888d6bec1b4920760ed114e755372f9b8c381` | Preview·PR CI·main CI·Production 배포 성공 |
| 운영 공개 smoke | `https://dthama.vercel.app/landing` | 200, 앱 JS/CSS·이미지 정상 응답, 새 로그 기준 콘솔 오류 없음 |

최종 로컬 검증은 Node 24.14.0에서 다음 결과로 완료했다.

- command·receipt·controller·adapter·`useGameData`·durable persistence·IndexedDB outbox 직접 테스트: 12 suite, 178 test 통과
- Firestore Emulator revision·eventId·delivery 원자성/멱등성 테스트: 1 test 통과, skip 없음
- `npm run lint`, `npm run typecheck`, `npm run check`: 성공
- 전체 check: 프런트 182 suite·1,154 test 통과, 서버 193 pass·6 Emulator-only skip, production build와 server projection 검사 성공
- `npm run deadcode:report`: 비차단 진단 완료. 26 unused files, 3 unused dependencies, 4 unlisted dependencies, 248 unused exports, 19 duplicate exports를 후속 품질 기준선으로 유지
- `git diff --check`: 성공

A+ 전·후 두 lockfile SHA-256은 각각 다음과 같고 변경되지 않았다.

- root `package-lock.json`: `581113fa66b68fcb976b4de63ce99de3404543c42239a39bfa0c1f141c9a29fd`
- frontend `package-lock.json`: `ae4144db05865a1d26782e45707b530d0be8a32df477c2f91b42527c0bec9b76`

인증된 실제 슬롯의 쓰기 canary는 승인되지 않은 운영 데이터 변경을 피하기 위해 자동 실행하지 않는다. 저장 동작은 command/reducer, controller, durable outbox와 Firestore Emulator revision/conflict 테스트로 검증하고, 운영 canary는 공개 화면의 배포 건전성 확인으로 한정한다. Vercel 고유 Preview URL이 인증 보호 뒤에 있으면 GitHub deployment success와 공개 운영 도메인의 동일 빌드 smoke를 함께 증거로 사용한다.

## 10. 운영 점검과 복구

1. 사용자의 저장 문구와 `GameSyncInfo` pending 수·최장 대기 시간을 함께 확인한다.
2. `queued`는 자동 retry 대상으로 두고 동일 intent를 반복 호출하지 않는다.
3. `conflict`는 기존 충돌 UI에서 서버 또는 기기 상태를 선택해 해소한다.
4. `failed` 또는 야행성 warning에서만 표시되는 `다시 시도`로 실패 구성요소를 재실행한다.
5. `localCleanup` 경고가 지속되면 서버 revision과 해당 mutation의 outbox 잔존 여부를 확인한다.

각 A+ 코드 PR은 Firestore·outbox 스키마 migration 없이 독립 merge revert가 가능하다. 되돌릴 때는 의존 순서의 역순으로 A+4 → A+3 → A+2 → A+1을 적용하고, 매 단계에서 main CI와 공개 운영 smoke를 다시 확인한다.
