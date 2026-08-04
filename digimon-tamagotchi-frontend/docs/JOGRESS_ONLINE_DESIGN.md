# 온라인 조그레스 — 서버 transaction 및 1회용 Ghost 설계

## 목표

온라인 조그레스는 등록 당시 디지몬을 불변 `hostSnapshot`으로 보존한다. 등록 Identity와 현재 슬롯의 `digimonInstanceId + combatRevision`이 같으면 `live`, 다르면 `ghost`로 표시한다.

- `live`: 게스트가 먼저 진화하고, 호스트가 확인하면 호스트도 진화한다.
- `ghost`: 등록 당시 snapshot과 참가자의 조합을 검증해 참가자만 진화하고 즉시 소비한다.
- 진화·사망·환생·슬롯 삭제는 기존 방을 만료시키지 않는다.
- 같은 슬롯의 새로운 형태는 별도 방으로 등록할 수 있다.

## 저장 계약

`jogress_rooms`는 `schemaVersion: 3`이며 다음 핵심 필드를 가진다.

| 필드 | 의미 |
|---|---|
| `hostSnapshot` | 등록 당시 디지몬 ID·버전·표시명·스프라이트의 불변 snapshot |
| `hostDigimonInstanceId` | 등록 생명체 Identity |
| `hostCombatRevision` | 등록 형태 revision |
| `linkStatus` | 응답 시 계산되는 `live` 또는 `ghost` |
| `completionMode` | `live`, `ghost`, `ghostFallback` |
| `status` | `waiting`, `paired`, `completed`, `cancelled` |

`jogress_room_registrations`는 동일 현재 형태의 중복 생성을 막고, `jogress_room_owners`는 사용자별 `waiting + paired` 최대 3개를 transaction에서 강제한다. 클라이언트는 세 컬렉션에 직접 쓰지 않는다.

## API 흐름

모든 `/api/jogress` 요청은 Firebase ID Token으로 인증한다. 슬롯·버전·디지몬·결과·스탯은 클라이언트 입력이 아니라 Firestore 슬롯 정본과 서버 게임 projection으로 계산한다.

1. `create`: outbox를 먼저 flush하고 `slotId`, `expectedRevision`을 전송한다. 같은 Identity가 이미 등록됐다면 기존 방을 멱등 반환한다.
2. `join(live)`: 한 transaction에서 조합 검증, 게스트 슬롯 진화·로그·도감 저장, 방의 `paired` 전이, 호스트 `jogressStatus` 저장을 처리한다.
3. `complete(live)`: 한 transaction에서 호스트 Identity를 재검증하고 호스트 슬롯 진화·로그·도감 저장 및 방 완료를 처리한다.
4. `join(ghost)`: `hostSnapshot`과 게스트 정본을 검증해 게스트만 진화시키고 방을 즉시 `completed/ghost`로 소비한다. 현재 호스트 슬롯은 수정하지 않는다.
5. `complete` 직전 live 연결이 끊겼다면 게스트 결과를 유지하고 `completed/ghostFallback`으로 정리하며 현재 호스트 형태는 진화시키지 않는다.

## UI 계약

- live 카드: `현재 형태 · 양쪽 진화`
- Ghost 카드: `등록 형태 Ghost · 참가자만 진화 · 1회용`
- Ghost 참가 확인창은 현재 호스트 슬롯이 변경되지 않음을 명시한다.
- Ghost에는 호스트 진화 버튼을 표시하지 않는다.
- 같은 슬롯에 옛 Ghost가 있어도 새 현재 형태는 `옛 형태 Ghost 유지 · 등록 가능`으로 안내한다.

## 레거시 마이그레이션

`scripts/migrateJogressRoomsToGhostV3.js`는 기본 dry-run이며 명시적 `--apply`와 프로젝트 확인이 있어야 쓰기 작업을 한다.

- Identity 없는 waiting 방: `legacyGhost`로 전환
- 유효한 expired 방: waiting Ghost로 복원
- paired 방: 호스트를 수정하지 않고 `completed/ghostFallback`으로 정리
- 사용자별 복원 후보: 기존 waiting 우선, 나머지는 최신 생성순으로 최대 3개
- apply 전 원본 room payload: `jogress_room_v3_migration_backups`에 저장
- `--rollback-room`으로 지정한 room ID를 백업에서 복원 가능

자세한 API 오류 및 운영 저장 계약은 루트의 `docs/ONLINE_JOGRESS_SERVER_CONTRACT.md`를 따른다.
