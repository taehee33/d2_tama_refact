# Firestore 읽기 원인 계측 실행 계획

작성일: 2026-08-13  
대상 브랜치: main  
기준 커밋: ed90fea  
상태: 구현 준비 완료

## 목표

Firebase의 하루 총 읽기를 기능별 원인으로 분해할 수 있도록 클라이언트와 Vercel API의 주요 Firestore read 경로를 계측한다. 이번 작업은 쿼리 최적화가 아니라 측정 기반을 만드는 작업이다.

- 기존 Firestore read/write 수와 게임 동작을 바꾸지 않는다.
- 반환 문서 수, 호출 수, 오류 수, 지연시간을 operation 단위로 기록한다.
- UID, 문서 경로, 이메일, 토큰, 문서 payload는 기록하지 않는다.
- 자체 합계를 청구 reads로 표현하지 않는다.
- 클라이언트와 서버를 두 PR로 분리해 배포·회귀 범위를 제한한다.

## 확정 결정

1. PR 1A는 클라이언트 계측만 담당한다.
2. PR 1B는 서버 알림 API 계측만 담당하며 1A 병합 후 진행한다.
3. 클라이언트는 기존 src/utils/runtimeMetrics.js를 확장하고 별도 전역 저장소를 만들지 않는다.
4. 계정 전환 시 session generation을 올리고, 이전 세션에서 늦게 완료된 read의 계측 이벤트는 폐기한다.
5. 서버는 firestoreAdmin.js를 수정하지 않고 알림 도메인의 각 read 호출부가 operation 이름을 명시한다.
6. 클라이언트 계측은 모든 빌드에서 메모리 집계하되 자동 로그나 외부 전송은 하지 않는다.

## What already exists

| 기존 기반 | 현재 역할 | 이번 계획 |
|---|---|---|
| src/utils/runtimeMetrics.js | window.__DIGIMON_RUNTIME_METRICS__에 일반 런타임 카운터 저장 | firestoreReads 전용 영역과 summary API를 추가해 재사용 |
| MasterDataContext.jsx | 인증 UID 변경 시 전역 마스터 문서와 최대 30개 스냅샷 로드 | 기존 getDoc/getDocs 호출만 wrapper로 감쌈 |
| useEncyclopedia.js | 슬롯 전체와 슬롯별 logs/battleLogs 복구 | 기존 복구 순서와 fallback을 유지하며 반환 수만 집계 |
| api/_lib/firestoreAdmin.js | 서버의 Firestore REST read/write 경계 | 변경하지 않음 |
| userNotifications.js와 urgentCareNotifications.js | read 함수를 주입받는 알림 도메인 서비스 | 명시적인 operation을 가진 wrapper를 호출부에 연결 |
| Jest와 node:test | 클라이언트·서버 회귀 테스트 | 기존 테스트 파일에 연결 검증을 추가하고 helper 전용 테스트 생성 |
| Vercel Runtime Logs | console 출력 수집 및 요청별 조회 | 서버의 한 줄 JSON 로그를 별도 서비스 없이 수집 |

## 공통 계측 계약

operation 이름은 다음 정규식을 만족해야 한다.

    ^(client|server)\.[a-z0-9]+(\.[a-z0-9]+)+$

raw metric 필드는 다음으로 제한한다.

| 필드 | 값 |
|---|---|
| operation | 정적인 기능 식별자 |
| source | client 또는 server |
| kind | document 또는 query |
| documents | 반환 문서 수 |
| durationMs | 실행 시간 |
| outcome | success 또는 error |
| fromCache | true, false 또는 unknown |
| timestamp | 생성 시각 |

계측 wrapper의 불변 조건은 다음과 같다.

- 원래 Promise의 성공값을 동일한 객체로 반환한다.
- 원래 Promise가 실패하면 동일한 오류 객체를 다시 throw한다.
- clock, 정규화, store, logger가 실패해도 원래 작업 결과는 바뀌지 않는다.
- invalid operation의 원문은 기록하지 않고 안전한 other bucket으로 보낸다.
- 문서 payload, document path, 오류 message/stack은 계측 데이터에 넣지 않는다.

## 데이터 흐름

    Firestore read 시작
      |
      +-- client: 현재 session generation 캡처
      |
      +-- 원래 getDoc/getDocs/REST read 실행
              |
              +-- 성공 -> 결과 형태만 정규화 -> documents/cache 계산
              |
              +-- 실패 -> documents=0, outcome=error -> 동일 오류 재throw
      |
      +-- 계측 자체를 별도 try/catch에서 기록
              |
              +-- client: generation이 그대로면 bounded aggregate 갱신
              |
              +-- server: 안전한 한 줄 JSON 로그 출력
      |
      +-- 원래 호출자에게 결과 또는 오류 전달

이 파이프라인은 runtimeMetrics.js와 새 서버 helper에 짧은 ASCII 주석으로 남긴다. 호출부에는 operation 상수 외의 장문 주석을 추가하지 않는다.

## PR 1A — 클라이언트 계측

### 파일 범위

| 파일 | 변경 |
|---|---|
| digimon-tamagotchi-frontend/src/utils/runtimeMetrics.js | Firestore 집계, session generation, wrapper, clear/summary 추가 |
| digimon-tamagotchi-frontend/src/utils/runtimeMetrics.test.js | helper 전체 분기 테스트 신규 작성 |
| digimon-tamagotchi-frontend/src/contexts/MasterDataContext.jsx | active 문서와 snapshots 쿼리 연결 |
| digimon-tamagotchi-frontend/src/contexts/MasterDataContext.test.jsx | 문서 수·오류·계정 전환 회귀 검증 |
| digimon-tamagotchi-frontend/src/hooks/useEncyclopedia.js | legacy slots와 슬롯별 복구 로그 연결 |
| digimon-tamagotchi-frontend/src/hooks/useEncyclopedia.test.js | N개 슬롯 집계 공식과 fallback 검증 |
| docs/REFACTORING_LOG.md | 목적, 한계, 연결 범위 기록 |

### runtimeMetrics 확장 계약

기존 counters와 lastPayloads를 유지하고 같은 전역 객체에 firestoreReads를 추가한다. Firestore 계측에는 raw event 배열과 lastPayloads를 사용하지 않는다.

operation별 aggregate는 다음 필드만 가진다.

| 필드 | 의미 |
|---|---|
| calls | 호출 완료 수 |
| errors | 실패 수 |
| totalDocuments | 반환 문서 수 합계 |
| totalDurationMs | 지연시간 합계 |
| maxDurationMs | 최대 지연시간 |
| cacheHits | fromCache=true 수 |
| cacheMisses | fromCache=false 수 |
| cacheUnknown | 캐시 여부를 알 수 없는 수 |

API는 다음 책임으로 나눈다.

- beginFirestoreReadMetricsSession(sessionKey): UID를 module private 값으로만 비교한다. 값이 바뀌면 aggregate를 비우고 generation을 증가시킨다.
- withClientFirestoreReadMetric({ operation, kind }, execute): 현재 generation을 캡처한 뒤 execute를 실행하고 결과를 정규화한다. 완료 시 generation이 달라졌으면 기록만 건너뛴다.
- getFirestoreReadMetricsSummary(): operation별 clone을 정렬된 배열로 반환한다.
- printFirestoreReadMetricsSummary(): 명시적으로 호출할 때만 console.table을 실행하고 동일한 summary를 반환한다.
- clearFirestoreReadMetrics(): Firestore aggregate만 비운다.
- resetRuntimeMetrics(): 기존 카운터와 Firestore aggregate를 모두 초기화해 기존 의미를 보존한다.

전역 operation key는 최대 50개다. client.other를 위한 한 자리를 예약해 최대 49개 명명 operation과 하나의 overflow bucket만 유지한다.

### 연결 operation

| Operation | 호출 형태 | 예상식 |
|---|---|---|
| client.master.active | active master getDoc | 세션 초기화 1회당 calls=1, documents=0 또는 1 |
| client.master.snapshots | limit(30) getDocs | 세션 초기화 1회당 calls=1, documents=0~30 |
| client.encyclopedia.legacy.slots | 사용자 slots getDocs | 도감 로드 1회당 calls=1, documents=슬롯 수 N |
| client.encyclopedia.recovery.logs | 슬롯별 logs와 battleLogs getDocs | 유효한 슬롯 N개당 calls=2N, documents=두 컬렉션 반환 수 합계 |

loadMasterData와 loadEncyclopedia 진입 시 session을 먼저 동기화한다. 로그아웃처럼 read가 실행되지 않는 경로도 null session으로 초기화한다.

### PR 1A 완료 조건

- 기존 마스터 데이터와 도감 반환값·fallback·경고 동작이 동일하다.
- 계정 전환 중 이전 read가 늦게 끝나도 새 세션 집계에 들어가지 않는다.
- 프로덕션 빌드에서도 메모리 집계가 동작하지만 네트워크 전송과 자동 console 출력은 없다.
- 테스트에서 operation 50개 상한, invalid operation, empty result, cache 상태, 동일 오류 재throw를 확인한다.

## PR 1B — 서버 API 계측

PR 1A가 병합되어 operation 규칙과 실패 무해성 계약이 검증된 뒤 시작한다.

### 파일 범위

| 파일 | 변경 |
|---|---|
| digimon-tamagotchi-frontend/api/_lib/firestoreReadMetrics.js | CommonJS 서버 wrapper와 안전한 JSON logger 신규 작성 |
| digimon-tamagotchi-frontend/api/_lib/firestoreReadMetrics.test.js | 정규화·오류 동일성·logger 장애 테스트 신규 작성 |
| digimon-tamagotchi-frontend/api/_lib/userNotifications.js | notification status read 호출부 연결 |
| tests/api/userNotifications.test.js | status operation별 호출·문서 수·fallback 검증 |
| digimon-tamagotchi-frontend/api/_lib/urgentCareNotifications.js | immediate slot evaluation read 호출부 연결 |
| tests/api/cases/urgentCareRuntime.cases.js | evaluate early return·성공·오류별 계측 검증 |
| docs/REFACTORING_LOG.md | 서버 연결 범위와 Vercel 조회법 추가 |

### 서버 helper 계약

- withServerFirestoreReadMetric({ operation, kind }, execute, options?) 형태를 사용한다.
- document 결과는 존재하면 1, null이면 0으로 정규화한다.
- query/list 결과는 배열 길이를 사용하고 알 수 없는 성공 결과는 0으로 둔다.
- fromCache는 항상 unknown이다.
- 한 read마다 console.log(JSON.stringify(metric)) 한 줄만 남긴다.
- logger와 clock은 테스트에서 주입할 수 있지만 운영 호출부에서는 기본값을 사용한다.
- logger, JSON 직렬화, clock 오류는 삼키며 원래 결과와 오류를 보존한다.

### notification status operation

| Operation | read |
|---|---|
| server.notification.status.settings | users/{uid}/settings/main document |
| server.notification.status.user | users/{uid} document |
| server.notification.status.notifications | notifications collection |
| server.notification.status.deliveries | 최근 delivery query |
| server.notification.status.states | notificationState collection |
| server.notification.status.push.subscriptions | pushSubscriptions collection |
| server.notification.status.slots | projection용 slots collection |
| server.notification.status.runtime | notification_runtime/urgentCare document |
| server.notification.status.current.slot | slotId가 있을 때 현재 slot document |

각 read는 현재의 개별 catch fallback보다 안쪽에서 계측한다. 따라서 read 실패는 outcome=error로 남고, 기존 catch는 계속 빈 배열 또는 null로 복구한다.

### urgent slot evaluation operation

| Operation | read |
|---|---|
| server.notification.evaluate.slot.settings | settings document |
| server.notification.evaluate.slot.user | user root document |
| server.notification.evaluate.slot.profile | profile document |
| server.notification.evaluate.slot.document | 대상 slot document |
| server.notification.evaluate.slot.pending.deliveries | pending delivery query |
| server.notification.evaluate.slot.state | notificationState document |
| server.notification.evaluate.slot.push.subscriptions | 실제 web push 전송 경로의 subscriptions collection |

invalid request는 Firestore를 읽기 전에 종료하므로 metric을 만들지 않는다. disabled, missing_slot, not_eligible 같은 early return은 실제로 실행된 read만 기록한다.

### PR 1B 완료 조건

- firestoreAdmin.js와 모든 query 조건·limit·fallback을 변경하지 않는다.
- 한 API 요청의 로그만으로 실제 실행된 document/query read의 operation과 반환 수를 확인할 수 있다.
- 개별 status read 실패는 기존 200 fallback을 유지하면서 error metric을 남긴다.
- evaluate read 실패는 기존 handler 오류 응답을 유지하면서 동일 오류를 전달한다.
- 로그 문자열에 UID, 실제 Firestore path, payload, 오류 message/stack이 없다.

## 코드 품질 리뷰 결과

### CQ1. 계측 오류와 원래 read 오류를 분리한다 — P1

wrapper의 execute try/catch와 metric finalize try/catch를 분리한다. record 단계의 예외가 원래 Firestore 오류처럼 다시 throw되는 구현은 금지한다.

### CQ2. operation은 상수와 validation으로 고정한다 — P1

동적 ID나 path를 문자열 보간으로 operation에 넣지 않는다. invalid operation 원문은 로그나 warning에 포함하지 않고 source별 other bucket으로 정규화한다.

### CQ3. raw 결과를 저장하거나 직렬화하지 않는다 — P1

DocumentSnapshot, QuerySnapshot, 서버 document 객체에서 count와 metadata만 읽는다. 기존 runtimeMetrics.lastPayloads에 Firestore 결과를 전달하지 않는다.

### CQ4. 테스트 fixture를 실제 Snapshot 최소 형태에 맞춘다 — P2

도감과 마스터 테스트의 snapshot fixture에 size, docs, metadata.fromCache를 추가한다. 이는 테스트용 형태 보강이며 런타임 코드가 비표준 fixture에 의존하도록 만들지 않는다.

## 테스트 커버리지 설계

    CODE PATHS                                             USER FLOWS
    [+] client session                                     [+] 로그인 후 앱 초기화
      +-- [PLANNED ★★★] same UID 유지                        +-- [PLANNED] master 2개 operation 확인
      +-- [PLANNED ★★★] UID/null 변경 시 reset               +-- [PLANNED] 화면 기능 변화 없음
      +-- [PLANNED ★★★] 이전 generation 지연 완료 폐기       |
    [+] client wrapper                                     [+] /me/collection 또는 도감 모달
      +-- [PLANNED ★★★] document exists/missing              +-- [PLANNED] slots calls=1, documents=N
      +-- [PLANNED ★★★] query size/docs/empty                 +-- [PLANNED] recovery calls=2N
      +-- [PLANNED ★★★] cache true/false/unknown             +-- [PLANNED] 일부 로그 실패 후 복구 지속
      +-- [PLANNED ★★★] 동일 오류 재throw                    |
      +-- [PLANNED ★★★] invalid/overflow/metric failure     [+] 알림 상태 로드와 window focus
    [+] server wrapper                                     | +-- [PLANNED] 실제 status 하위 operation 로그
      +-- [PLANNED ★★★] document/array/unknown                +-- [PLANNED] 개별 read 실패 fallback
      +-- [PLANNED ★★★] 동일 오류 재throw                    |
      +-- [PLANNED ★★★] clock/logger/JSON 실패              [+] /play/:slotId 저장 후 긴급 평가
    [+] status service                                     | +-- [PLANNED] early return별 실제 read만 기록
      +-- [PLANNED ★★★] 8개 기본 read                        +-- [PLANNED] 생성 경로에서 push subscriptions 기록
      +-- [PLANNED ★★★] optional current slot               |
      +-- [PLANNED ★★★] 개별 catch fallback                [+] 계정 전환
    [+] urgent evaluate                                    | +-- [PLANNED] 기존 집계 즉시 clear
      +-- [PLANNED ★★★] invalid request/initial reads        +-- [PLANNED] 이전 요청 완료값 미혼입
      +-- [PLANNED ★★★] disabled/missing/not eligible
      +-- [PLANNED ★★★] stored/projection/clear/reuse
      +-- [PLANNED ★★★] created + conditional push read

새 계측 분기는 현재 0%이며, 구현 PR에서 위 분기를 모두 테스트한 뒤 병합한다. UI 동작을 바꾸지 않으므로 신규 E2E suite는 만들지 않는다. 기존 React/Node 통합 테스트와 프로덕션 빌드의 수동 로그 검증을 사용한다.

## 실패 모드

| 코드 경로 | 현실적인 실패 | 테스트 | 처리 | 사용자 영향 |
|---|---|---|---|---|
| client wrapper | metadata getter 또는 clock이 throw | helper 단위 테스트 | metric만 폐기 | 없음 |
| client session | 계정 전환 전 요청이 늦게 완료 | deferred Promise 테스트 | generation 불일치 event 폐기 | 없음 |
| client aggregate | 50개 초과 operation 유입 | boundary 테스트 | client.other로 합침 | 없음 |
| summary | console.table 미지원 또는 throw | helper 단위 테스트 | summary 반환, 출력 실패 무시 | 없음 |
| master reads | Promise.all 중 한 read 실패 | Context 회귀 테스트 | 기존 fallback과 error 상태 유지 | 기존 오류 처리와 동일 |
| encyclopedia logs | 슬롯 하나의 logs read 실패 | hook 회귀 테스트 | error metric 후 해당 슬롯 복구 스킵 | 기존 warning과 동일 |
| server wrapper | logger/JSON stringify 실패 | helper 단위 테스트 | 로그만 유실, read 결과 유지 | 없음 |
| status read | 하위 collection 한 개 실패 | API 테스트 | error metric 후 기존 빈 fallback | 기존 화면 fallback과 동일 |
| urgent evaluate | 초기 document/query 실패 | runtime case 테스트 | 동일 오류가 handler까지 전달 | 기존 API 오류와 동일 |
| Vercel 로그 | 로그 보존기간 만료 | 수동 운영 절차 | 측정 직후 결과 기록 | 게임 영향 없음, 진단 자료만 유실 |

테스트와 오류 처리가 모두 없는 silent critical gap은 없다.

## 성능 리뷰 결과

1. 클라이언트는 raw event를 저장하지 않고 최대 50개 aggregate key만 유지한다.
2. 각 read의 추가 작업은 clock 2회, 결과 형태 확인, 작은 객체 합산으로 제한한다.
3. console.table은 명시적으로 호출할 때만 실행한다.
4. 서버는 read당 한 줄만 출력한다. status는 최대 9줄, evaluate는 일반적으로 5~7줄로 Vercel 요청당 로그 상한보다 충분히 작다.
5. 첫 진단에서는 sampling을 적용하지 않는다. 호출 수 순위를 얻는 목적과 충돌하기 때문이다.
6. 계측을 위한 Firestore read/write, beacon, localStorage, interval을 추가하지 않는다.

## 수동 재현 시나리오와 기대 흐름

| 시나리오 | 기대 operation |
|---|---|
| 로그인 후 세션 초기화 | client.master.active 1회, client.master.snapshots 1회, 전역 알림이 활성화된 경로에서는 status 하위 operation |
| 알림 상태 열기 또는 창 focus | server.notification.status.*가 API 호출당 동일한 이름으로 반복 |
| 게임 저장 성공 | server.notification.evaluate.slot.* 중 실제 분기에서 실행된 read만 출력 |
| 도감 열기 | legacy.slots calls=1/documents=N, recovery.logs calls=2N/documents=로그 합계 |
| 아레나 열기 | 이번 P0에는 arena operation이 없어야 함. Firebase 총량 차이가 크면 P1 후보로 승격 |

측정 결과는 날짜, 빌드 커밋, 시나리오, operation별 calls/documents/errors 표로 별도 기록한다. 자체 합계와 Firebase 총 reads의 일치율을 성공 기준으로 사용하지 않는다.

## 검증 명령

PR 1A 대상 테스트:

    npm --prefix digimon-tamagotchi-frontend test -- --watchAll=false --runInBand src/utils/runtimeMetrics.test.js src/contexts/MasterDataContext.test.jsx src/hooks/useEncyclopedia.test.js

PR 1B 대상 테스트:

    node --test digimon-tamagotchi-frontend/api/_lib/firestoreReadMetrics.test.js tests/api/userNotifications.test.js tests/api/urgentCareNotifications.test.js

각 PR 공통 최종 검사:

    npm run check
    git diff --check

Firestore Rules, schema, transaction을 바꾸지 않으므로 이 두 PR만을 위해 로컬 emulator 검사를 추가하지 않는다. 기존 CI의 emulator job은 그대로 유지한다.

## 구현 순서와 의존성

| 단계 | 모듈 | 의존성 |
|---|---|---|
| 1A-1 | frontend utils/runtime metrics | 확정된 공통 계약 |
| 1A-2 | frontend master context | 1A-1 |
| 1A-3 | frontend encyclopedia hook | 1A-1 |
| 1A-4 | frontend tests/docs | 1A-1~3 |
| 1B-1 | API read metric helper | PR 1A 계약 검증·병합 |
| 1B-2 | notification status service | 1B-1 |
| 1B-3 | urgent care service | 1B-1 |
| 1B-4 | server tests/docs | 1B-1~3 |
| 측정 | production reproduction | PR 1A와 1B 배포 |

Lane A: PR 1A-1 → 1A-2/1A-3 → 1A-4  
Lane B: PR 1B-1 → 1B-2/1B-3 → 1B-4

두 lane은 코드상 병렬화할 수 있지만, 서버 계약을 클라이언트에서 먼저 검증하려는 분할 목적을 유지하기 위해 순차 진행한다. 별도 worktree 병렬화는 권장하지 않는다.

## Implementation Tasks

- [ ] T1 (P1, human: 약 4시간 / Codex: 약 1시간) — client metrics — runtimeMetrics에 bounded Firestore aggregate와 session generation을 구현한다.
  - Surfaced by: Architecture D2, D3, D5와 CQ1~CQ3
  - Files: src/utils/runtimeMetrics.js, src/utils/runtimeMetrics.test.js
  - Verify: client helper 대상 Jest 테스트
- [ ] T2 (P1, human: 약 2시간 / Codex: 약 30분) — master data — active와 snapshots read를 연결한다.
  - Surfaced by: MasterDataContext.jsx의 병렬 getDoc/getDocs
  - Files: src/contexts/MasterDataContext.jsx, src/contexts/MasterDataContext.test.jsx
  - Verify: 반환 상태 동일성, success/error metrics, 계정 전환 테스트
- [ ] T3 (P1, human: 약 3시간 / Codex: 약 45분) — encyclopedia — legacy slots와 슬롯별 logs/battleLogs를 연결한다.
  - Surfaced by: useEncyclopedia.js의 전체 슬롯 및 2N 로그 read
  - Files: src/hooks/useEncyclopedia.js, src/hooks/useEncyclopedia.test.js
  - Verify: N개 슬롯 공식, empty/error fallback 테스트
- [ ] T4 (P2, human: 약 1시간 / Codex: 약 15분) — PR 1A docs/verification — 정확도 한계와 콘솔 사용법을 기록하고 전체 검사를 통과시킨다.
  - Surfaced by: 운영자가 자체 합계를 billed reads로 오해할 위험
  - Files: docs/REFACTORING_LOG.md
  - Verify: npm run check, git diff --check, 프로덕션 build 수동 summary
- [ ] T5 (P1, human: 약 3시간 / Codex: 약 45분) — server metrics — 실패 무해한 CommonJS wrapper와 JSON logger를 구현한다.
  - Surfaced by: Architecture D4와 CQ1~CQ3
  - Files: api/_lib/firestoreReadMetrics.js, api/_lib/firestoreReadMetrics.test.js
  - Verify: node:test helper suite
- [ ] T6 (P1, human: 약 3시간 / Codex: 약 45분) — notification status — 9개 정적 operation을 각 read에 연결한다.
  - Surfaced by: userNotifications.js의 settings 및 병렬 status read
  - Files: api/_lib/userNotifications.js, tests/api/userNotifications.test.js
  - Verify: success, optional slot, 개별 fallback 로그 테스트
- [ ] T7 (P1, human: 약 4시간 / Codex: 약 1시간) — urgent evaluation — 초기 read, state, conditional push read를 연결한다.
  - Surfaced by: urgentCareNotifications.js의 초기 Promise.all과 early-return 분기
  - Files: api/_lib/urgentCareNotifications.js, tests/api/cases/urgentCareRuntime.cases.js
  - Verify: disabled/missing/clear/reuse/created/error runtime cases
- [ ] T8 (P2, human: 약 1시간 / Codex: 약 15분) — PR 1B docs/verification — Vercel 로그 조회법과 서버 범위를 기록하고 전체 검사를 통과시킨다.
  - Surfaced by: 서버 로그가 외부 저장소 없이 유일한 운영 진단 자료임
  - Files: docs/REFACTORING_LOG.md
  - Verify: npm run check, git diff --check, preview deployment JSON 로그
- [ ] T9 (P2, human: 약 2시간 / Codex: 약 30분) — measurement — 다섯 재현 시나리오를 실행하고 operation 순위표를 작성한다.
  - Surfaced by: 측정 없는 최적화 우선순위는 여전히 추정이라는 원래 문제
  - Files: 별도 측정 보고서
  - Verify: 동일 시나리오를 두 번 실행했을 때 operation 이름과 순위가 안정적임

## NOT in scope

- 도감 복구를 일회성 migration으로 바꾸는 작업 — 실제 측정 후 별도 최적화 PR에서 판단한다.
- Arena challenger fallback, battle logs limit/pagination — 이번 PR은 쿼리 동작을 바꾸지 않는다.
- Jogress 슬롯 공유와 listener 최적화 — P0 결과와 Firebase 총량 차이가 클 때 P1으로 계측한다.
- profile, slots list, game slot/activity/battle read 계측 — 첫 측정의 미설명 비중이 클 때 추가한다.
- onSnapshot callback 계측 — listener 연결·재연결·unsubscribe 수명은 별도 설계가 필요하다.
- Firebase Performance Monitoring, PostHog, Sentry, Log Drain, 신규 수집 API — 외부 운영 경계를 추가하지 않는다.
- 청구 reads 추정기와 Firebase 총량 자동 대조 — 빈 query 최소 과금과 index entry 비용 때문에 별도 문제다.
- UI 대시보드, localStorage 보존, unload beacon — 첫 진단에는 필요하지 않다.
- Firestore schema/rules, 공식 슬롯 저장 계약, IndexedDB outbox, lazy update 변경 — 저장 안정성과 무관한 계측 PR로 유지한다.
- 현재 작업 트리의 게임 저장·outbox·rules 변경 — 사용자 작업으로 간주하고 이 계획의 구현 범위에서 제외한다.

TODOS.md는 저장소에 없으므로 새 파일을 만들지 않는다. 위 후속 항목은 이 문서의 NOT in scope에 근거와 함께 보존한다.

## 검토 요약

- Step 0 Scope Challenge: 약 13개 파일의 단일 PR을 1A 클라이언트와 1B 서버로 축소했다.
- Architecture Review: 4개 결정 완료 — 기존 runtimeMetrics 재사용, generation guard, 도메인 호출부 서버 계측, 모든 빌드 bounded aggregate.
- Code Quality Review: 4개 이슈를 구현 규칙과 테스트에 반영했다.
- Test Review: 실행·오류·경계·사용자 흐름 diagram 작성, 5개 coverage group을 구현 PR의 필수 테스트로 지정했다.
- Performance Review: bounded memory와 로그량 상한을 확인했으며 sampling은 제외했다.
- Failure modes: critical gap 0개.
- Outside voice: 추가 질문을 중단해 달라는 사용자 요청과 이미 3회 검토된 승인 설계를 고려해 생략했다.
- Parallelization: 2개 lane이지만 PR 1A → PR 1B 순차 진행.
- 완전한 선택: 4/4 아키텍처 권장안을 채택했다.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---:|---|---|
| CEO Review | /plan-ceo-review | Scope & strategy | 0 | — | 이번 내부 계측에는 불필요 |
| Codex Review | /codex review | Independent 2nd opinion | 0 | — | 생략 |
| Eng Review | /plan-eng-review | Architecture & tests | 1 | CLEAR | 13파일 범위를 2 PR로 분리, 4개 아키텍처 결정, critical gap 0 |
| Design Review | /plan-design-review | UI/UX gaps | 0 | — | UI 변경 없음 |
| DX Review | /plan-devex-review | Developer experience gaps | 0 | — | 내부 개발자 계측으로 별도 검토 불필요 |

**VERDICT:** ENG CLEARED — PR 1A 구현 준비 완료

NO UNRESOLVED DECISIONS
