# 아레나 Ghost PR0 감사 보고서

- 감사일: 2026-07-18
- 범위: `ARENA_GHOST_SYSTEM_IMPLEMENTATION_PLAN.md` PR0
- 원칙: 운영 데이터는 읽기 전용으로만 확인하고 runtime write는 수행하지 않는다.

## 확인된 배포 전제

- Vercel 프로젝트의 실제 Root Directory는 `digimon-tamagotchi-frontend`다.
- 루트 `api/`는 프런트 디렉터리의 canonical handler를 불러오는 repository-level 호환 wrapper다.
- `firebase-admin@13.7.0`은 저장소 루트에만 설치되어 있고 Vercel root package에는 없다. PR1에서 `digimon-tamagotchi-frontend/package.json`의 직접 의존성으로 추가해야 한다.
- Vercel Node.js runtime은 24.x다.
- 현재 `digimon-tamagotchi-frontend/vercel.json`에는 cron 설정이 없다. Ghost worker를 추가할 때 5분 cadence와 `CRON_SECRET` 인증을 함께 추가한다.
- 현재 Firestore Admin helper는 REST commit 기반이며 실제 `runTransaction()`을 지원하지 않는다. Ghost V2는 Admin SDK transaction store를 별도 경계로 추가해야 한다.

## combat identity 변화 경로

형태 또는 생명이 바뀌는 쓰기 경로는 다음과 같다.

1. `useUserSlots.createSlot`: 새 슬롯과 새 생명 생성
2. `useGamePageActionFlows.resetDigimon`: 사망 후 새 디지타마 시작
3. `useDeath.confirmDeath`: 사망 폼 전환
4. `useEvolution.evolve`: 정상 진화
5. `useEvolution.proceedJogressLocal`: 현재 슬롯 정상 진화와 partner 사망
6. `useEvolution.proceedJogressOnlineAsHost`: 현재 host 정상 진화
7. `useEvolution`의 paired/remote host 완료 경로: 비현재 host 슬롯 정상 진화
8. `useUserSlots.deleteSlot`와 `UserSlotRepository.deleteUserSlot`: 원본 슬롯 삭제

현재 정상 진화와 사망 폼 전환 중 일부는 `digimonStats`와 `selectedDigimon`을 별도 write로 저장한다. strict identity Rules에서는 허용할 수 없으므로 PR1에서 다음 저장 경계를 먼저 만든다.

- 정상 형태 전환: `selectedDigimon + digimonStats + combatRevision + 1`
- 새 생명 전환: `selectedDigimon + digimonStats + 새 digimonInstanceId + combatRevision 1`
- 사망 상태 확정: identity는 보존하고 `isAlive` projection만 false

## Ghost snapshot allowlist

서버가 슬롯과 버전별 데이터 맵에서 계산해 복사할 필드는 다음으로 고정한다.

- `gameVersion`
- `digimonId`
- `digimonName`
- `stage`
- `attribute`
- `spriteBasePath`
- `sprite`
- `attackSprite`
- `combatPowerAtCapture`
- `ageAtCapture`
- `weightAtCapture`
- `capturedAt`

클라이언트의 기존 `digimonSnapshot.stats` 전체 복사와 클라이언트 계산 power는 V2 입력으로 사용하지 않는다.

## 기능 플래그와 maintenance 전환

`game_settings/arena_config`에 다음 additive 필드를 사용한다.

- `ghostSystemMode: "legacy" | "maintenance" | "v2"`
- `minArenaClientSchemaVersion: number`
- `battleRulesVersion: "arena-ghost-v1"`

PR1~PR5 동안 기본값은 `legacy`다. 운영 cutover는 `maintenance → migration/검증 → v2` 순서를 따르며 V2 write 이후에는 legacy write를 다시 열지 않는다.

## 운영 데이터 감사 재현

다음 명령은 `arena_entries`, `arena_battle_logs`, `game_settings/arena_config`, 모든 user slot을 읽기만 하며 write를 수행하지 않는다.

```bash
FIREBASE_SERVICE_ACCOUNT_PATH=<service-account.json> \
node scripts/auditArenaGhostReadiness.js \
  --project d2tamarefact \
  --report docs/generated/arena-ghost-pr0-production.json
```

보고서에서 확인할 값은 legacy entry 수, 사용자별 최대 수, 3개 초과 사용자 수, 손상 snapshot 수, 시즌별 wins/losses 합계, 과거 log의 entry ID 참조율, identity 누락 slot 수다. 생성 JSON은 운영 식별자나 개별 사용자 데이터를 포함하지 않고 집계만 저장한다.

### 2026-07-18 운영 읽기 전용 결과

- legacy entry: 14개, 소유자 9명, 사용자별 최대 3개, 초과 사용자 0명
- V2 allowlist 기준 불완전 legacy snapshot: 8개
- 현재 시즌 3 legacy 합계: 40승 71패
- `arena_battle_logs`: 1,264개, entry ID 참조 필드 보유율 100%
- 현재 남아 있는 entry를 찾을 수 없는 과거 log: 1,177개
- user slot: 30개, combat identity 누락 30개
- identity backfill dry-run: 대상 30개, 변경 예정 30개, 오류 0개 (`--apply` 미실행)

따라서 migration은 불완전 snapshot을 `disabled`로 보존하고, 기존 entry ID를 Ghost ID로 유지해야 한다. 현재 entry 문서가 이미 삭제된 과거 로그가 많으므로 로그 참조를 현재 슬롯이나 이름으로 재연결하려 해서는 안 된다. slot backfill은 30개 전체에 대해 absent-only로 수행한다.

## 아직 외부 환경에서 확인할 게이트

- preview 배포에서 Admin SDK transaction 실제 호출
- Vercel Cron 5분 호출과 `CRON_SECRET` 전달
- Supabase archive row ID와 기존 Firestore `archiveId`의 대응률
- migration dry-run 전후 count·합계 승인

이 항목은 로컬 코드만으로 승인할 수 없으므로 PR1~PR3 구현과 별개로 preview/운영 전 활성화 게이트로 유지한다.
