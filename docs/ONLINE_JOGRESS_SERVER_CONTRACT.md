# 조그레스 서버 저장 계약

온라인 조그레스 방은 등록 당시 디지몬을 불변 `hostSnapshot`으로 보존한다. 현재 슬롯의 `digimonInstanceId + combatRevision`이 등록 Identity와 같으면 `live`, 진화·사망·환생·슬롯 삭제로 달라지면 1회용 `ghost`로 분류한다. 같은 슬롯의 새 형태도 별도 방으로 등록할 수 있다.

## API와 인증

- `GET /api/jogress?scope=mine|waiting`: 활성 방을 `live|ghost`로 분류해 조회
- `POST /api/jogress`: `create`, `join`, `complete`, `complete-local`
- `DELETE /api/jogress?roomId=...`: 호스트 대기방 취소

모든 요청은 Firebase ID Token이 필요하다. UID, 슬롯 버전, 디지몬 ID, 결과 ID와 저장 스탯은 서버가 Firestore 슬롯 정본과 Ver.1~5 projection bundle로 계산한다. 클라이언트는 작업 직전 현재 슬롯 outbox를 flush하고, 온라인은 자신의 `expectedRevision`, 로컬은 두 슬롯의 `expectedCurrentRevision` / `expectedPartnerRevision`을 보낸다.

## 상태와 원자성

상태는 `waiting → paired → completed`를 유지한다. 같은 형태의 생성 재요청, 같은 게스트의 참가 재요청, 완료 재요청은 저장된 방과 outcome을 반환한다. 활성 방은 `waiting + paired` 합계 최대 3개다.

- `join(live)`: 방·호스트 슬롯·게스트 슬롯 검증, 게스트 진화, 로그, 도감, revision 증가, 호스트 `jogressStatus`, `paired` 전이를 한 transaction으로 저장한다.
- `join(ghost)`: 등록 snapshot과 게스트의 조합만 검증하고 게스트만 진화시킨 뒤 즉시 `completed/ghost`로 소비한다. 현재 호스트 슬롯은 읽기 결과와 관계없이 수정하지 않는다.
- `complete`: 호스트 Identity/revision 검증, 호스트 진화, 로그, 도감, `jogressStatus` 해제, `completed` 전이를 한 transaction으로 저장한다.
- live 참가 뒤 호스트 형태가 바뀌면 게스트 결과는 유지하고 `completed/ghostFallback`으로 정리한다.
- 양쪽 모두 생존하며 `digimonInstanceId`는 유지하고 `combatRevision`은 1 증가한다.

## 로컬 조그레스

`complete-local`은 같은 사용자의 서로 다른 두 슬롯을 요구한다. 서버는 두 슬롯의 현재 형태·버전·생명 identity와 조합을 projection bundle로 다시 검증한다.

- 현재 슬롯의 진화, 파트너 슬롯의 `JOGRESS_PARTNER` 사망, 양쪽 revision/combat identity, 양쪽 활동 로그, 도감, 멱등 receipt를 하나의 transaction으로 commit한다.
- 클라이언트는 두 슬롯을 직접 `writeBatch`하지 않는다. 서버 성공 응답 후에만 현재 화면 상태를 반영한다.
- `requestId`와 canonical fingerprint를 결정적 receipt ID에 보존한다. 동일 요청 재시도는 저장된 outcome을 반환하고, 같은 `requestId`의 다른 payload는 `409 IDEMPOTENCY_KEY_REUSED`로 거부한다.
- 양쪽 revision 중 하나라도 다르거나 저장 중 예외가 발생하면 두 슬롯·로그·도감·receipt를 모두 변경하지 않는다.
- 두 슬롯의 최신 상태를 함께 확정해야 하므로 오프라인 대기를 지원하지 않는다.

`jogress_rooms`, `jogress_room_owners`, `jogress_room_registrations`, migration backup은 Admin SDK/API 전용이다. Identity 없는 레거시 waiting 방은 현재 슬롯과 재연결하지 않고 모두 `legacyGhost`로 전환한다. 유효한 expired 방은 waiting Ghost로 복원하고 paired 방은 `ghostFallback`으로 완료한다. 마이그레이션은 기본 dry-run이며 apply 전 원본 room payload를 백업한다.
