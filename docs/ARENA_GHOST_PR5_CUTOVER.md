# 아레나 Ghost PR5 프런트 V2 Cutover

## 활성화 방식

PR5 UI는 CRA 빌드 환경변수 뒤에 있으며 기본값은 비활성이다.

```text
REACT_APP_ARENA_GHOST_V2=true
```

Preview에서만 먼저 켜고 다음 항목을 검증한다.

- 내 Ghost, 상대 Ghost가 `/api/arena/ghosts` DTO와 일치한다.
- Ghost가 0개인 계정도 상대에게 도전할 수 있다.
- 등록·삭제 요청에 snapshot, power, identity, record를 보내지 않는다.
- 배틀 요청은 `requestId`, `attackerSlotId`, `defenderGhostId`만 전송한다.
- `BattleScreen`은 서버 `replay`만 재생하며 `simulateBattle()`을 호출하지 않는다.
- 서버 `attackerSlotOutcome.digimonStats`가 현재 화면에 즉시 반영된다.
- 재전투는 새 request ID로 새 서버 배틀을 확정한다.
- 로그는 immutable attacker/defender snapshot으로 표시하고 삭제된 Ghost ID도 필터에 남긴다.
- archive `pending`, `failed`, `ready`, legacy 안내가 구분된다.
- `ARENA_MAINTENANCE`에서 선택 상태를 유지하고 자동 재요청하지 않는다.

## 운영 활성화 금지 조건

다음 중 하나라도 충족하지 않으면 Production flag를 켜지 않는다.

- `game_settings/arena_config.mode == active` 전환 시점이 확정되지 않음
- V2 API와 최소 client schema version 2가 배포되지 않음
- Firestore Rules/index가 배포되지 않음
- mirror/archive Cron과 `CRON_SECRET` 검증이 끝나지 않음
- Supabase archive V2 migration이 적용되지 않음
- legacy `/api/arena/battles/complete`와 `arena_entries` client write 차단 시점이 확정되지 않음
- 운영 migration 사후 count 검증이 끝나지 않음

Production에서는 사용자별 cohort를 사용하지 않는다. maintenance 창에서 legacy write를 전역 동결한 뒤 V2를 전체 사용자에게 동시에 활성화한다.

## Rollback

- V2 write 전 오류: Preview flag를 끄고 legacy 운영 경로를 유지한다.
- V2 write 후 오류: legacy complete를 다시 열지 않고 `mode = maintenance`로 mutation을 차단한 뒤 V2를 수리해 roll-forward한다.
- `arena_entries`, V2 Ghost, battle, log, archive 자료를 자동 삭제하지 않는다.
