# 케어미스 V2 Phase 2 저장 계약

## 전환 경계

- V1 슬롯은 `NEW_LIFE`를 포함해 기존 client persistence를 유지한다.
- V1→V2 승격은 명시적 migration API만 수행한다.
- V2 슬롯의 상태, projection, receipt, incident, 관련 로그는 `/api/operator/status?action=care-mistake-v2` trusted transaction으로만 변경한다. Vercel Hobby 12-function 상한을 지키기 위해 기존 인증·운영자 단일 라우터에 합쳤다.
- Phase 2는 로컬 코드와 Emulator 검증만 다룬다. 운영 배포·migration·repair와 슬롯 4·5 변경은 포함하지 않는다.

## Command·revision

`gameTransitions/{commandId}`는 slot·action·domain payload와 root/current receipt, stage, expected revision을 canonical fingerprint로 저장한다. 재시도는 slot stale 검증보다 transition을 먼저 읽어 동일 fingerprint이면 추가 write 없이 기존 결과를 반환한다. 다른 fingerprint의 동일 ID는 `COMMAND_ID_REUSE_CONFLICT`로 거부한다.

`NATIVE_INIT`은 새 slot·state·root receipt·transition을 한 transaction에서 생성하며 revision과 `cutoverRevision`은 1이다. 이후 모든 성공 command, migration, repair는 revision을 정확히 1 증가시킨다. incident의 `occurredRevision`은 결과 revision이며 ID는 command scope와 operation index로 결정한다.

V2 `NEW_LIFE`는 전용 새 생애 흐름도 client Firestore transaction을 사용하지 않고 내구성 outbox에 적재한 뒤 trusted command로 commit한다. 서버는 `slotInstanceId`를 보존하고 새 `digimonInstanceId`, `combatRevision=1`, 새 root/stage를 확정하며, 일반 mutation이 identity 필드를 덮어쓰는 것을 무시한다.

## Integrity·repair

Integrity GET은 Firestore read transaction의 동일 snapshot에서 slot, receipt lineage, head를 검증한다. 실제 invariant 위반은 `repair_required`, transaction·network·5xx 실패는 저장하지 않는 `integrity_unknown`이다. 둘 다 mutation 생성과 flush를 보류한다.

`baseline_override`는 legacy baseline만 변경하고 structured incident/count를 보존한다. `linked_head_repair`는 운영자 pointer 입력 없이 서버가 최대 400건을 재구성한다. 401건, ordering metadata 오류, semantic key 중복은 write 0건으로 거부한다. Repair receipt는 request fingerprint를 저장해 동일 repair ID의 다른 요청 재사용을 막는다.

## Client outbox

Hydration은 integrity 확정 전에 gameplay mutation을 막는다. V2 epoch은 state, activity/feed/battle event, transition outbox record에 함께 저장한다. pre-V2·old root·old receipt·old stage command는 IndexedDB 하나의 transaction으로 state, event, transition 전체를 `legacy_quarantine`으로 이동한다. 격리 자료는 자동 재전송하거나 삭제하지 않는다.

## Rules 책임

Rules는 V1 compatible write를 유지하되 client의 V2 self-upgrade와 기존 V2 slot·receipt·incident·transition·로그 직접 write를 거부한다. Lineage, linked head, command epoch, repair supersession은 trusted server transaction이 검증한다.
