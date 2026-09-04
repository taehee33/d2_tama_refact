# 케어미스 V2 Phase 2 저장 계약

## 전환 경계

- V1 슬롯은 `NEW_LIFE`를 포함해 기존 client persistence를 유지한다.
- V1→V2 승격은 명시적 migration API만 수행한다.
- V2 슬롯의 상태, projection, receipt, incident, 관련 로그는 `/api/operator/status?action=care-mistake-v2` trusted transaction으로만 변경한다. Vercel Hobby 12-function 상한을 지키기 위해 기존 인증·운영자 단일 라우터에 합쳤다.
- Phase 2는 로컬 코드와 Emulator 검증만 다룬다. 운영 배포·migration·repair와 슬롯 4·5 변경은 포함하지 않는다.

## Command·revision

`gameTransitions/{commandId}`는 slot·action·domain payload와 root/current receipt, stage, expected revision을 canonical fingerprint로 저장한다. 재시도는 slot stale 검증보다 transition을 먼저 읽어 동일 fingerprint이면 추가 write 없이 기존 결과를 반환한다. 다른 fingerprint의 동일 ID는 `COMMAND_ID_REUSE_CONFLICT`로 거부한다.

`NATIVE_INIT`은 새 slot·state·root receipt·transition을 한 transaction에서 생성하며 revision과 `cutoverRevision`은 1이다. 이후 모든 성공 command, migration, repair는 revision을 정확히 1 증가시킨다. incident의 `occurredRevision`은 결과 revision이며 ID는 command scope와 operation index로 결정한다.

V2 `NEW_LIFE`는 전용 새 생애 흐름도 client Firestore transaction을 사용하지 않고 내구성 outbox에 적재한 뒤 trusted command로 commit한다. 서버는 `slotInstanceId`를 보존하고 새 `digimonInstanceId`, `combatRevision=1`, 새 root/stage를 확정하며, 일반 mutation이 identity 필드를 덮어쓰는 것을 무시한다. 서버 확정 전에는 클라이언트가 기존 묘지와 생애 identity를 유지하고, 수동·백그라운드 재시도는 대기 중인 동일 `transitionId`·`commandId`를 재사용한다. 성공 receipt를 받은 뒤에만 디지타마와 새 identity를 반영하고 이전 생애 outbox를 정리한다.

## Trusted slot delete

V2 슬롯 삭제는 owner 인증 API만 허용하고, `users/{uid}/careMistakeV2SlotDeletions/{operationId}` operation과 `users/{uid}/careMistakeV2SlotDeletionLocks/{slotId}` 외부 lock을 사용한다. Operation ID는 uid·slotId·slotInstanceId로 결정되며 complete operation은 영구 보존한다. Lock이 존재하는 동안 native init, command, migration, repair와 client의 slot/descendant write를 모두 거부한다.

삭제 요청은 현재 slot보다 operation을 먼저 읽는다. Complete operation은 현재 slot을 읽거나 recursive delete하지 않고 즉시 멱등 성공한다. In-progress operation은 저장된 slot instance identity만 확인하고 최초 `expectedRevision`을 다시 검증하지 않는다. 5분 execution lease가 유효하면 두 번째 실행은 `202 in_progress`를 반환하고, 명시적 실패 또는 lease 만료 뒤에만 다른 executor가 부분 삭제를 이어간다.

Operation이 없는 최초 요청만 현재 V2 slot의 instance와 revision을 검증한 뒤 operation·lock·deletion marker를 한 transaction에서 생성한다. Recursive delete는 수행 중 존재하는 descendants를 제거하며, 성공 후 operation을 complete로 바꾸고 같은 operation을 가리키는 lock을 해제한다. 서버 완료 전에는 IndexedDB outbox를 지우지 않는다. V1 슬롯 삭제는 기존 client 경로를 유지한다.

## Integrity·repair

Integrity GET은 Firestore read transaction의 동일 snapshot에서 slot, receipt lineage, head를 검증한다. 실제 invariant 위반은 `repair_required`, transaction·network·5xx 실패는 저장하지 않는 `integrity_unknown`이다. 둘 다 mutation 생성과 flush를 보류한다.

`baseline_override`는 legacy baseline만 변경하고 structured incident/count를 보존한다. `linked_head_repair`는 운영자 pointer 입력 없이 서버가 최대 400건을 재구성한다. 401건, ordering metadata 오류, semantic key 중복은 write 0건으로 거부한다. Repair receipt는 request fingerprint를 저장해 동일 repair ID의 다른 요청 재사용을 막는다. Migration과 두 repair action은 operator-only이며 일반 사용자 action은 인증 token의 자기 UID만 사용하고 `targetUid` 주입을 거부한다.

## Client outbox

Hydration은 integrity 확정 전에 gameplay mutation을 막는다. V2 epoch은 state, activity/feed/battle event, transition outbox record에 함께 저장한다. pre-V2·old root·old receipt·old stage command는 IndexedDB 하나의 transaction으로 state, event, transition 전체를 `legacy_quarantine`으로 이동한다. 격리 자료는 자동 재전송하거나 삭제하지 않는다. 단, 서버가 아직 묘지를 정본으로 반환하는 대기 중 `NEW_LIFE`는 일반 형태/사망 hydration 충돌로 격리하지 않고 outbox 동기화 대상으로 유지한다.

## Rules 책임

Rules는 V1 compatible write를 유지하되 client의 V2 self-upgrade와 기존 V2 slot·receipt·incident·transition·로그 직접 write를 거부한다. 외부 deletion lock이 있으면 V1 create/update/delete와 모든 descendant write도 거부하며 deletion operation·lock 자체는 server-only다. Lineage, linked head, command epoch, repair supersession은 trusted server transaction이 검증한다.
