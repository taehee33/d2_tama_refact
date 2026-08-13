# docs 안내

이 디렉토리에는 현재 운영 기준 문서와 과거 분석/참고 문서가 함께 있습니다.  
문서를 읽을 때는 아래 우선순위로 해석하는 것을 기본 원칙으로 둡니다.

## 1. 현재 기준 문서

아래 문서는 현재 코드와 운영 계약을 설명하는 기준 문서입니다.

- `README.md`
- `docs/CURRENT_AUTH_STORAGE_CONTRACT.md`
- `docs/CURRENT_PROJECT_STRUCTURE_ANALYSIS.md`
- `docs/P0_GLOBAL_FIRESTORE_WRITE_LOCKDOWN_PLAN.md`
- `digimon-tamagotchi-frontend/src/repositories/README.md`
- `docs/REFACTORING_LOG.md`

현재 저장 계약은 `slotInstanceId`로 슬롯 번호 재사용을, `digimonInstanceId`로 디지몬 생애를 격리합니다. 새 생애·일반 진화는 Firestore transaction으로, 로컬 조그레스는 `/api/jogress` `complete-local` 서버 transaction으로 확정하며, 활동 로그는 현재 생애 최대 50개만 조회합니다.

## 2. 참고 / 분석 문서

아래 문서들은 특정 시점의 분석, 설계 메모, 문제 추적 기록입니다.

- `*_ANALYSIS.md`
- `*_PLAN.md`
- `todo/*`
- `game_mechanics.md`

이 문서들은 여전히 의사결정 근거로 유용하지만, 작성 시점 이후 코드가 바뀌었을 수 있습니다.  
현재 코드와 충돌할 때는 기준 문서와 실제 소스코드를 우선합니다.

## 3. 실시간 아레나 개발 기준

실시간 아레나를 구현할 때는 아래 순서로 읽습니다.

1. [MVP 개발 실행 계획](./REALTIME_ARENA_MVP_IMPLEMENTATION_PLAN.md)
2. [전투 규칙 밸런스 분석 보고서](./REALTIME_ARENA_BALANCE_ANALYSIS_REPORT.md)
3. [밸런스 분석 요청서와 확정 서버 계약](./REALTIME_ARENA_BALANCE_ANALYSIS_REQUEST.md)

개발 실행 계획은 Firestore 공개/secret 문서, `battleId + round` 멱등성, timeout·재접속, 임시 `mvp-0` 규칙 버전, PR 순서와 출시 게이트를 고정합니다. 밸런스 보고서의 추천값은 프로덕션 확정값이 아니라 친선 플레이테스트 기준선으로 해석합니다.

## 4. 현재 런타임 구조 메모

2026-04-07 기준으로 게임 런타임 책임은 아래처럼 나뉩니다.

- `src/pages/Game.jsx`
  컨테이너 조립, 모달/화면 wiring, 구독 연결
- `src/hooks/game-runtime/useGameRealtimeLoop.js`
  1초 실시간 스탯 업데이트, call/care/death 흐름
- `src/hooks/game-runtime/useGameSleepStatusLoop.js`
  수면 상태 전용 갱신
- `src/hooks/game-runtime/useGameSaveOnLeave.js`
  `visibilitychange` / `beforeunload` 저장
- `src/hooks/game-runtime/gameAnimationViewModel.js`
  렌더용 애니메이션 프레임 계산과 desired animation 결정

## 5. 계측 메모

런타임 계측 값은 브라우저에서 `window.__DIGIMON_RUNTIME_METRICS__`로 확인할 수 있습니다.

- `game_page_commits`
- `slot_jogress_snapshot_wakeups`
- `slot_jogress_state_updates`
- `canvas_initImages_calls`
