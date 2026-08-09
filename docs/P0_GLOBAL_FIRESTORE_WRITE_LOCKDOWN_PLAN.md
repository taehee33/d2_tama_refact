# P0-A 전역 Firestore 쓰기 차단 실행 계획

작성일: 2026-08-09
상태: P0-A0~A4 구현·배포·Production 운영자 UI smoke·main CI 필수 검사 등록 완료
우선순위: P0
범위: `jogress_logs`, legacy `arena_entries`, `game_settings/digimon_master_data`와 `snapshots`

## 1. 결론

다음 정책을 목표 상태로 확정한다.

1. `jogress_logs`의 모든 클라이언트 쓰기를 즉시 차단한다.
2. Ghost V2 운영 롤백 기간이 종료됐음을 배포 전에 확인한 뒤 legacy `arena_entries`의 생성·수정·삭제를 모두 차단한다.
3. 마스터 데이터 변경은 기존 `/api/operator/status` Vercel Function에 전용 action을 추가해 서버에서만 처리한다.
4. 서버 전환 검증이 끝나면 `game_settings/digimon_master_data`와 그 하위 `snapshots`에 대한 모든 클라이언트 쓰기를 차단한다. 운영자 클라이언트도 예외가 아니다.
5. 이 변경에 필요한 Firestore Emulator 검사를 일반 CI의 필수 job으로 승격한다.

마스터 데이터는 Rules에서 `operator_roles/{uid}`를 직접 조회해 클라이언트 쓰기를 허용하지 않는다. 기존 서버 운영자 판정 경계를 재사용해야 payload 검증, 작성자, 서버 시각, 변경 이력을 한 곳에서 확정할 수 있기 때문이다.

## 2. 현재 상태와 위험

| 경로 | 현재 클라이언트 정책 | 현재 사용 상태 | 위험 | 목표 |
| --- | --- | --- | --- | --- |
| `jogress_logs/{logId}` | 로그인 사용자 읽기·쓰기 허용 | 현재 조그레스 정본 아님 | 익명 계정을 포함한 로그인 사용자가 전역 로그 위조·삭제 가능 | 모든 클라이언트 쓰기 거부 |
| `arena_entries/{entryId}` | 로그인 사용자의 조건부 생성, 소유자 삭제 허용 | Ghost V2 이전 레거시 | 운영 V2와 별개인 레거시 엔트리 재생성·삭제 가능 | 생성·수정·삭제 거부 |
| `game_settings/digimon_master_data` | 로그인 사용자 쓰기 허용 | 전역 마스터 데이터 정본 | 일반·익명 계정이 전체 게임 데이터를 변조 가능 | Admin SDK/API 전용 쓰기 |
| `.../snapshots/{snapshotId}` | 로그인 사용자 쓰기 허용 | 마스터 데이터 변경 이력 | 작성자·시각·before/after 이력 위조 및 삭제 가능 | Admin SDK/API 전용 쓰기 |

`MasterDataContext`의 운영자 확인은 화면 접근 제어일 뿐 보안 경계가 아니다. 현재 저장은 클라이언트 `writeBatch`로 실행되므로 직접 Firebase SDK를 호출하면 UI 검사를 우회할 수 있다.

## 3. 범위와 비범위

### 포함

- 위 세 전역 경로의 클라이언트 쓰기 차단
- 기존 `operator_roles/{uid}`를 사용하는 서버 운영자 인증
- 마스터 데이터 저장·복원 API와 서버 측 검증·감사 이력
- 프런트엔드 마스터 데이터 저장 경계의 API 전환
- Rules, API, 프런트엔드, Emulator, 배포 계약 테스트
- 단계별 배포·검증·롤백 절차

### 제외

- 과거 `jogress_logs` 또는 `arena_entries` 데이터 삭제·이관
- 두 레거시 컬렉션의 읽기 권한 제거
- 슬롯 정본, IndexedDB outbox, 진화 저장 계약 변경
- custom claim 기반 운영자 권한 체계 도입
- 신규 Vercel Function 추가
- 마스터 데이터 문서 구조 또는 지원 버전 체계 개편

읽기 권한과 과거 데이터 보존 정책은 별도 후속 작업으로 다룬다. P0에서는 변조 경로를 닫는 데 집중한다.

## 4. 목표 권한 모델

### 4.1 Firestore Rules

목표 정책은 다음과 같다.

```text
jogress_logs
  read: 기존 정책 유지
  create/update/delete: false

arena_entries
  read: 기존 정책 유지
  create/update/delete: false

game_settings/arena_config
  read: 기존 정책 유지
  create/update/delete: false

game_settings/digimon_master_data
  read: 로그인 사용자 허용
  create/update/delete: false

game_settings/digimon_master_data/snapshots/*
  read: 로그인 사용자 허용
  create/update/delete: false
```

가능하면 `game_settings`의 포괄적 로그인 사용자 쓰기 허용을 제거하고 문서별 allowlist로 바꾼다. 현재 또는 향후 다른 `game_settings` 문서가 클라이언트 쓰기를 정말 필요로 한다면 해당 경로와 허용 필드를 명시적으로 분리하고 Emulator 테스트를 추가한다. 용도를 확인하지 않은 채 포괄 규칙을 유지하는 것은 완료로 보지 않는다.

### 4.2 서버 운영자 판정

- Firebase ID token을 검증한다.
- 기존 `operator_roles/{uid}` 기반 `getOperatorAccess`를 재사용한다.
- `isOperator !== true`이면 `403`을 반환한다.
- 클라이언트가 보낸 이메일, 역할, 작성자 필드는 신뢰하지 않는다.
- Firestore Admin SDK만 활성 문서와 snapshot을 쓴다.

클라이언트 운영자 여부는 메뉴 표시와 사용자 안내에만 사용한다. 저장 권한의 최종 판정은 매 요청마다 서버가 수행한다.

## 5. 마스터 데이터 API 계약

기존 배포 함수 수를 늘리지 않기 위해 `/api/operator/status` 엔트리포인트에 POST action을 추가한다. 내부 구현은 status handler와 분리된 `masterData` handler/service로 둔다.

권장 action은 다음 두 개다.

| Method | 경로 | 역할 |
| --- | --- | --- |
| `POST` | `/api/operator/status?action=master-data-save` | 검증된 변경을 활성 문서와 새 snapshot에 원자적으로 저장 |
| `POST` | `/api/operator/status?action=master-data-restore` | 지정 snapshot을 서버에서 읽고 검증한 뒤 새 복원 이력과 함께 활성화 |

### 5.1 저장 요청

클라이언트가 보낼 수 있는 값은 아래로 제한한다.

- `requestId`: 재시도 멱등성 키
- 변경할 버전과 디지몬 ID
- `MASTER_DATA_EDITABLE_FIELDS`에 포함된 변경 필드
- 선택적 운영 메모(길이 제한 적용)
- `expectedRevision`: 클라이언트가 마지막으로 읽은 활성 문서 revision

서버는 다음 값을 직접 결정한다.

- 운영자 uid와 필요한 최소 표시 정보
- 서버 timestamp
- 현재 활성 문서에서 읽은 before 값
- 검증·정규화된 after 값
- 변경 필드 목록과 요약
- snapshot ID
- 다음 revision

알 수 없는 버전·디지몬 ID·필드, 타입 불일치, 범위를 벗어난 수치, 지나치게 큰 payload는 `400`으로 거부한다. 클라이언트가 보낸 `createdBy`, `updatedBy`, timestamp, snapshot 본문, before 값은 저장에 사용하지 않는다.

### 5.2 복원 요청

복원 요청은 `requestId`, `snapshotId`, `expectedRevision`, 선택적 메모만 받는다. 서버가 snapshot을 직접 읽고 현재 지원 스키마로 검증한다. 복원도 현재 활성 문서 revision이 `expectedRevision`과 일치할 때만 실행한다. 복원은 기존 이력을 수정하거나 삭제하지 않고 다음 내용을 담은 새 snapshot을 생성한다.

- 복원 직전 상태
- 복원 결과 상태
- 원본 snapshot ID
- 실행 운영자 uid
- 서버 timestamp
- 변경 요약

### 5.3 revision bootstrap

- 저장과 복원의 동시성 사전조건은 `expectedRevision: number` 하나로 통일한다.
- 기존 활성 문서에 revision이 없으면 P0-A2 서버 API의 첫 transaction에서 현재 문서를 revision `0`으로 해석한다.
- 첫 성공 mutation이 revision `1`과 함께 활성 문서와 snapshot을 저장한다.
- bootstrap도 같은 transaction 안에서 실행하며 별도 무조건 덮어쓰기 경로를 만들지 않는다.
- 현재 revision이 `expectedRevision`과 다르면 `409 MASTER_DATA_REVISION_CONFLICT`를 반환한다.

`updatedAt`은 사용자 표시와 감사 정보로만 사용하며 동시성 사전조건으로 사용하지 않는다.

### 5.4 원자성·동시성·멱등성

- Firestore transaction으로 활성 문서의 예상 revision을 확인한다.
- 활성 문서 갱신과 snapshot 생성을 하나의 transaction에서 완료한다.
- revision 충돌은 덮어쓰지 않고 `409`로 반환해 운영자가 최신 상태를 다시 확인하게 한다.
- snapshot 문서 ID는 `operatorUid + action + requestId`를 충돌 없이 canonicalize한 입력의 결정적 hash로 생성한다. 원문 uid나 `requestId`를 문서 ID에 직접 이어 붙이지 않는다.
- snapshot에는 최소 `requestId`, `action`, `requestFingerprint`, `revisionBefore`, `revisionAfter`, `createdByUid`, `createdAt`을 저장한다.
- `requestFingerprint`는 action과 서버가 정규화한 mutation 입력 전체를 canonical serialization한 뒤 hash한 값이다. 인증·감사 메타데이터와 메모 포함 여부도 계약에서 고정한다.
- 동일 `requestId`와 동일 fingerprint의 재시도는 기존 snapshot에 기록된 성공 결과를 반환하고 활성 문서를 다시 변경하지 않는다.
- 동일 `requestId`에 다른 fingerprint가 들어오면 `409 IDEMPOTENCY_KEY_REUSED`로 거부한다.
- transaction 실패 시 활성 문서와 snapshot 어느 쪽에도 부분 변경이 남지 않아야 한다.

별도 receipt 컬렉션은 만들지 않는다. 기존 `game_settings/digimon_master_data/snapshots/{snapshotId}` 문서를 성공 이력과 멱등성 영수증으로 함께 사용한다.

### 5.5 응답과 로깅

- 성공 응답은 적용된 revision, snapshot ID, 서버 시각, 정규화된 변경 요약만 반환한다.
- 응답에 `Cache-Control: private, no-store`를 설정한다.
- 오류는 `401`, `403`, `400`, `404`, `409`, `500`을 구분하고 안정적인 error code를 제공한다.
- 구조화 로그에는 `requestId`, action, 운영자 uid, 결과, revision, snapshot ID, 변경 필드 수만 남긴다.
- 전체 마스터 데이터 payload, ID token, 이메일은 로그에 남기지 않는다.

## 6. 구현 순서

각 단계는 독립적으로 배포·검증 가능한 작은 체크포인트로 진행한다.

### P0-A0. 선행 증거와 CI 게이트

1. 배포 환경에서 `REACT_APP_ARENA_GHOST_V2=true`와 `game_settings/arena_config.mode=active`, 최소 schema version을 다시 확인한다.
2. Ghost V2 전환 문서의 롤백 기간 종료와 운영 API 상태를 확인한다.
3. 코드 검색과 운영 로그로 `jogress_logs` 쓰기 호출이 없음을 확인한다.
4. legacy `arena_entries` 쓰기가 V2 운영 화면에서 호출되지 않음을 smoke test로 확인한다.
5. 별도 `firestore-emulator` CI job을 추가하고 PR 필수 검사로 지정한다.

CI job은 Node 24와 현재 두 lockfile 설치 절차를 사용하고 최소한 다음을 실행한다.

```bash
npm run test:firestore-emulator
npm run test:arena-emulator
```

완료 조건:

- 로컬과 CI에서 Emulator가 동일한 Rules를 읽는다.
- Emulator 프로세스 시작 실패나 테스트 skip이 성공으로 처리되지 않는다.
- 기존 14개 Emulator 검사와 새 권한 회귀 검사가 모두 통과한다.

### P0-A1. 사용 종료 전역 경로 잠금

1. `jogress_logs`의 `create/update/delete`를 `false`로 바꾼다.
2. `arena_entries`의 `create/update/delete`를 `false`로 바꾼다.
3. 비인증, 익명 인증, 일반 인증, 운영자 인증 클라이언트가 모두 쓸 수 없음을 Rules 테스트로 고정한다.
4. Admin SDK 기반 Ghost V2와 조그레스 API 회귀 테스트를 실행한다.
5. Rules만 먼저 배포하고 거부 오류·Arena 등록/해제·조그레스 완료 흐름을 관찰한다.

이 단계에서는 과거 문서를 삭제하지 않고 읽기 정책도 바꾸지 않는다.

완료 조건:

- 두 컬렉션에 대한 모든 클라이언트 쓰기가 거부된다.
- Ghost V2 등록·해제·배틀과 현재 조그레스 흐름이 정상이다.
- 운영 화면에서 legacy 쓰기 권한 오류가 발생하지 않는다.

### 2026-08-09 P0-A0·A1 실행 결과

- Production 번들의 `ARENA_GHOST_V2_ENABLED`는 `true`로 컴파일돼 있다.
- Production `game_settings/arena_config`는 `mode=active`, `minArenaClientSchemaVersion=2`이며 2026-07-22에 마지막으로 갱신됐다.
- Production V2 Ghost API는 인증 경계에서 `401 ARENA_AUTH_REQUIRED`, legacy complete API는 `426 ARENA_CLIENT_UPGRADE_REQUIRED`를 반환한다.
- `jogress_logs` 14개 문서의 마지막 생성·갱신은 2026-02-26이며 현재 런타임 write 참조는 발견되지 않았다.
- legacy `arena_entries` 14개 문서의 마지막 생성은 2026-07-19, 마지막 갱신도 2026-07-19로 V2 전역 cutover 이전이다.
- 독립 `firestore-emulator` CI job을 추가했고 기본 1개와 Arena·Jogress 14개 상위 테스트(하위 인증 행렬 포함 총 18개 assertion test)가 통과했다.
- `jogress_logs`와 `arena_entries`의 모든 클라이언트 쓰기를 `false`로 배포했다.
- Production 임시 익명 계정의 두 컬렉션 create 요청이 모두 `403`으로 거부됐으며 계정은 검증 직후 삭제했다.
- 과거 문서와 로그인 사용자 읽기 권한은 변경하지 않았다.

main 병합 후 CI run `31294195035`에서 `firestore-emulator`와 `check`가 모두 성공했다. branch protection의 strict 설정과 기존 `check`를 보존하면서 `firestore-emulator` status context를 필수 검사로 추가했다.

### P0-A2. 마스터 데이터 서버 경계 추가

1. 기존 operator API 엔트리포인트에 두 POST action을 라우팅한다.
2. 인증·운영자 판정, payload allowlist, 타입·범위·크기 검증을 구현한다.
3. transaction 기반 revision 확인, 활성 문서+snapshot 원자 저장, 멱등 재시도를 구현한다.
4. 저장과 복원 handler/service 테스트를 추가한다.
5. API 배포 함수 수가 현재 제한을 넘지 않는지 deployment contract 테스트로 확인한다.
6. 서버 API를 먼저 배포한다. 이 시점에는 기존 클라이언트가 계속 동작하므로 운영 중단이 없다.

완료 조건:

- 미인증은 `401`, 일반·익명 계정은 `403`, 유효 운영자는 성공한다.
- allowlist 밖의 필드와 위조된 감사 필드는 저장되지 않는다.
- 충돌·중복 요청·transaction 실패에서 이력이 정확하다.
- 신규 Vercel Function이 생기지 않는다.

### P0-A3. 프런트엔드 API 전환

1. `operatorApi`에 저장·복원 요청 함수를 추가한다.
2. `MasterDataContext`에서 mutation용 Firestore `writeBatch`를 제거하고 서버 API만 호출한다.
3. 읽기는 현재 Firestore 구독/조회 계약을 유지한다.
4. API 성공 응답 또는 후속 snapshot을 통해 화면 상태를 갱신한다.
5. 실패 시 로컬 상태를 성공으로 확정하지 않고 한국어 오류와 재시도 안내를 표시한다.
6. API 장애 때 Firestore 직접 쓰기로 fallback하지 않고 읽기 전용으로 실패한다.
7. preview와 production에서 운영자 저장·복원·새로고침을 smoke test한다.

완료 조건:

- 저장·복원 시 클라이언트 Firestore mutation이 호출되지 않는다.
- 운영자 UI의 저장·snapshot·복원 동작이 기존 기능 수준을 유지한다.
- 일반 사용자가 UI와 직접 API 호출 양쪽에서 거부된다.
- API 장애가 전역 데이터의 부분 저장이나 로컬 성공 표시로 이어지지 않는다.

### P0-A4. 마스터 데이터 Rules 최종 차단

1. `game_settings/digimon_master_data`와 `snapshots/**`의 모든 클라이언트 쓰기를 `false`로 바꾼다.
2. 포괄 `game_settings/{docId}` 쓰기 규칙을 제거하거나 명시적 allowlist로 축소한다.
3. 운영자 클라이언트도 직접 SDK 쓰기가 거부됨을 Emulator로 검증한다.
4. Rules 배포 후 운영자 API 저장·복원과 일반 사용자 읽기를 재검증한다.

완료 조건:

- 익명·일반·운영자 클라이언트가 직접 마스터 데이터와 snapshot을 쓸 수 없다.
- 서버 API만 활성 문서와 감사 이력을 함께 변경한다.
- `arena_config`의 기존 쓰기 차단과 다른 `game_settings` 읽기 동작이 회귀하지 않는다.

### 2026-08-09 P0-A2~A4 실행 결과

- 기존 `/api/operator/status`에 `master-data-save`, `master-data-restore` POST action을 추가했고 배포 Function 수를 12개로 유지했다.
- validation 후 stable canonical serialization, SHA-256 deterministic snapshot ID, request fingerprint, `expectedRevision`, transaction 기반 활성 문서+snapshot 원자 저장을 구현했다.
- 동일 requestId·payload는 기존 결과를 재사용하고, 다른 payload는 `409 IDEMPOTENCY_KEY_REUSED`, revision 불일치는 `409 MASTER_DATA_REVISION_CONFLICT`로 거부한다.
- Admin transaction Emulator에서 revision `0→1` bootstrap, 재시도, requestId 오용, 충돌, 복원, 중간 실패 롤백을 확인했다.
- Production API는 미인증 저장·복원을 `401 MASTER_DATA_AUTH_REQUIRED`, 임시 익명 계정 저장을 `403 MASTER_DATA_FORBIDDEN`으로 거부했다.
- `MasterDataContext`의 mutation `writeBatch`를 제거하고 저장·복원을 operator API로 전환했다. 네트워크 1회 재시도는 동일 requestId/body를 재사용하며 revision 충돌 시 최신 정본을 다시 읽는다.
- 프런트 API 전환을 Production deployment `dpl_EvV5QqGAgCivgrG4AqAuhENtDMbX`로 선배포했다.
- 클라이언트 런타임에 남은 `game_settings` 접근은 읽기뿐임을 확인하고, 포괄 Rules를 문서·하위 경로 모두 `write: false`로 Production에 배포했다.
- Rules Emulator에서 비인증·익명·일반·운영자 클라이언트의 `game_settings`, master 활성 문서, snapshot create/update/delete가 모두 거부되고 로그인 읽기는 유지됨을 확인했다.
- Production 임시 익명 계정의 임의 `game_settings` 문서와 master snapshot create가 모두 `permission-denied`였고 검증 계정은 즉시 삭제했다.
- 실제 Production 운영자 계정으로 `깜몬 [SMOKE]` 저장, 새로고침 후 전역 반영, 직전 snapshot 복원, 재새로고침 후 `깜몬` 원상복구까지 확인했다.

## 7. 필수 테스트 행렬

### 7.1 Firestore Rules Emulator

| 대상 | 비인증 | 익명 로그인 | 일반 로그인 | 운영자 로그인 |
| --- | --- | --- | --- | --- |
| `jogress_logs` 쓰기 | 거부 | 거부 | 거부 | 거부 |
| `arena_entries` 쓰기 | 거부 | 거부 | 거부 | 거부 |
| master 활성 문서 쓰기 | 거부 | 거부 | 거부 | 거부 |
| snapshot 쓰기·삭제 | 거부 | 거부 | 거부 | 거부 |
| master 읽기 | 거부 | 허용 | 허용 | 허용 |

Rules 테스트의 운영자 계정은 클라이언트 Rules 관점에서는 다른 로그인 사용자와 똑같이 거부되어야 한다. Admin SDK는 Security Rules의 허용 대상이 아니라 Rules를 우회하는 서버 권한이므로 이 행렬에 포함하지 않는다.

### 7.2 API

- token 누락·만료·위조: `401`
- `operator_roles`가 없는 사용자: `403`
- 허용되지 않은 action/method: `404` 또는 `405`
- 알 수 없는 필드·버전·디지몬·잘못된 타입/범위: `400`
- 존재하지 않거나 손상된 snapshot 복원: `404` 또는 `400`
- expected revision 불일치: `409`, 저장 없음
- 같은 `requestId` 재전송: 결과 재사용, snapshot 한 개
- transaction 중간 실패: 활성 문서와 snapshot 모두 변경 없음
- 작성자·시각·before/after: 서버가 확정한 값만 저장
- Admin SDK/server service: Rules와 독립된 transaction 테스트에서 활성 문서와 snapshot 원자 저장 성공
- deployment contract: 배포 함수 수 유지

### 7.3 프런트엔드

- 저장·복원이 올바른 action과 ID token을 사용한다.
- `MasterDataContext` mutation 경로가 Firestore batch를 호출하지 않는다.
- API 오류 시 화면이 성공 상태로 바뀌지 않는다.
- revision 충돌 시 최신 데이터를 다시 불러오도록 안내한다.
- 저장 후 새로고침해도 서버 정본과 동일하다.
- 읽기 권한 오류와 쓰기 권한 오류를 구분해 표시한다.

### 7.4 전체 회귀

각 체크포인트에서 최소 다음을 실행한다.

```bash
npm run check
npm run test:firestore-emulator
npm run test:arena-emulator
```

## 8. 배포와 관찰

배포 순서는 바꾸지 않는다.

1. Emulator 필수 CI
2. `jogress_logs`·`arena_entries` Rules 잠금
3. 마스터 데이터 서버 API 선배포
4. 프런트엔드 API 전환
5. production 운영자 smoke test
6. 마스터 데이터 Rules 최종 잠금
7. 최종 smoke test와 관찰

배포 후 최소 다음 신호를 확인한다.

- operator API action별 `2xx/4xx/5xx` 비율
- revision 충돌과 중복 request 비율
- 저장 1회당 snapshot 1개 생성 여부
- `jogress_logs`, `arena_entries` 신규 client write가 0인지 여부
- Arena Ghost V2 등록·해제·배틀 성공률
- 운영자 화면의 저장·복원 실패 로그

로그와 지표에는 마스터 데이터 전체 payload와 인증 토큰을 포함하지 않는다.

## 9. 롤백 원칙

### 레거시 경로

`jogress_logs`와 `arena_entries`의 전역 클라이언트 쓰기는 다시 열지 않는다. 문제가 발견되면 현재 서버 경로를 수정하거나 해당 기능을 일시적으로 읽기 전용/점검 상태로 전환한다. Ghost V2 정본이 이미 생성된 뒤 legacy 경로로 되돌리는 것은 데이터 분기를 만들 수 있으므로 rollback이 아니라 roll-forward로 복구한다.

### 마스터 데이터

- Rules 최종 잠금 전: 새 API나 프런트엔드 문제를 수정한 뒤 재배포한다.
- Rules 최종 잠금 후: 운영자 화면을 읽기 전용으로 전환하고 서버/API를 roll-forward한다.
- 장애 대응을 이유로 `isSignedIn()` 전역 쓰기를 복구하지 않는다.
- 데이터 복구는 검증된 snapshot을 서버 restore action으로 적용하며 문서 수동 덮어쓰기를 표준 절차로 삼지 않는다.
- snapshot은 멱등성 receipt를 겸하므로 retention/TTL 정책을 도입할 때 requestId 재사용 보증 기간을 함께 정의한다.

## 10. 예상 변경 파일

- `firestore.rules`
- `.github/workflows/ci.yml` 또는 별도 Firestore Emulator workflow
- `tests/firestore-emulator.test.js`
- 관련 Arena·Jogress Rules/Emulator 테스트
- `digimon-tamagotchi-frontend/api/operator/status.js`
- `digimon-tamagotchi-frontend/api/_lib/operatorHandlers.js`
- 신규 master-data handler/service와 테스트
- `digimon-tamagotchi-frontend/src/utils/operatorApi.js`
- `digimon-tamagotchi-frontend/src/contexts/MasterDataContext.jsx`
- 관련 프런트엔드 테스트
- `docs/REFACTORING_LOG.md`

실제 구현에서 책임이 커지므로 server handler의 인증·HTTP 처리, master-data 검증·transaction, 프런트 요청 helper를 각각 분리한다. 대형 `MasterDataContext`에는 API 연결과 상태 반영만 남긴다.

## 11. 구현 승인 항목

구현 시작 전에 다음 세 항목을 승인받는다.

1. `jogress_logs`와 `arena_entries`는 과거 데이터와 읽기를 유지하고 모든 클라이언트 쓰기만 영구 차단한다.
2. 마스터 데이터 쓰기·복원은 기존 `/api/operator/status`의 POST action으로 이동하며 신규 Vercel Function은 추가하지 않는다.
3. 최종 Rules에서는 운영자도 클라이언트 SDK로 쓸 수 없고, 장애 시에도 로그인 사용자 전역 쓰기를 다시 열지 않는다.

위 세 항목은 2026-08-09 승인됐다. P0-A0부터 P0-A4까지 순서대로 진행하며, 각 단계의 테스트와 운영 확인이 끝나기 전 다음 보안 경계를 닫지 않는다.

## 12. 후속 P1 Read Exposure Audit

P0-A에서는 현재 읽기 동작을 보존한다. 이후 별도 P1에서 익명 로그인을 포함한 모든 로그인 사용자가 마스터 데이터를 읽어야 하는지 검토한다. 미공개 디지몬, 숨겨진 진화 조건, 운영 전용 값이 포함돼 있다면 공개 데이터 projection과 운영자 전용 원본을 분리하는 방안을 평가한다.
