# 온라인 조그레스 서버 저장 계약

온라인 조그레스 방은 등록 당시 디지몬을 불변 `hostSnapshot`으로 보존한다. 현재 슬롯의 `digimonInstanceId + combatRevision`이 등록 Identity와 같으면 `live`, 진화·사망·환생·슬롯 삭제로 달라지면 1회용 `ghost`로 분류한다. 같은 슬롯의 새 형태도 별도 방으로 등록할 수 있다.

## API와 인증

- `GET /api/jogress?scope=mine|waiting`: 활성 방을 `live|ghost`로 분류해 조회
- `POST /api/jogress`: `create`, `join`, `complete`
- `DELETE /api/jogress?roomId=...`: 호스트 대기방 취소

모든 요청은 Firebase ID Token이 필요하다. UID, 슬롯 버전, 디지몬 ID, 결과 ID와 저장 스탯은 서버가 Firestore 슬롯 정본과 Ver.1~5 projection bundle로 계산한다. 클라이언트는 온라인 작업 직전 outbox를 flush하고 `expectedRevision`을 보낸다.

## 상태와 원자성

상태는 `waiting → paired → completed`를 유지한다. 같은 형태의 생성 재요청, 같은 게스트의 참가 재요청, 완료 재요청은 저장된 방과 outcome을 반환한다. 활성 방은 `waiting + paired` 합계 최대 3개다.

- `join(live)`: 방·호스트 슬롯·게스트 슬롯 검증, 게스트 진화, 로그, 도감, revision 증가, 호스트 `jogressStatus`, `paired` 전이를 한 transaction으로 저장한다.
- `join(ghost)`: 등록 snapshot과 게스트의 조합만 검증하고 게스트만 진화시킨 뒤 즉시 `completed/ghost`로 소비한다. 현재 호스트 슬롯은 읽기 결과와 관계없이 수정하지 않는다.
- `complete`: 호스트 Identity/revision 검증, 호스트 진화, 로그, 도감, `jogressStatus` 해제, `completed` 전이를 한 transaction으로 저장한다.
- live 참가 뒤 호스트 형태가 바뀌면 게스트 결과는 유지하고 `completed/ghostFallback`으로 정리한다.
- 양쪽 모두 생존하며 `digimonInstanceId`는 유지하고 `combatRevision`은 1 증가한다.

`jogress_rooms`, `jogress_room_owners`, `jogress_room_registrations`, migration backup은 Admin SDK/API 전용이다. Identity 없는 레거시 waiting 방은 현재 슬롯과 재연결하지 않고 모두 `legacyGhost`로 전환한다. 유효한 expired 방은 waiting Ghost로 복원하고 paired 방은 `ghostFallback`으로 완료한다. 마이그레이션은 기본 dry-run이며 apply 전 원본 room payload를 백업한다.
