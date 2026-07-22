# Arena Ghost PR4 Migration 결과

작성일: 2026-07-22

## 구현 범위

- `scripts/migrateArenaGhosts.js`
  - 기본값 `--dry-run`
  - `--apply`, `--limit`, `--resume-after`, `--report` 지원
  - apply 시 `--project`와 동일한 `--confirm-project` 필수
  - 명시적 service account 또는 `--allow-application-default` 확인 필수
- legacy `arena_entries/{entryId}`의 문서 ID를 `arena_ghosts/{entryId}`에 그대로 사용한다.
- migration은 additive write만 수행하며 `arena_entries`, 과거 battle log와 replay를 삭제하지 않는다.
- legacy identity는 현재 슬롯과 연결하지 않고 source identity 필드를 모두 `null`로 둔다.
- snapshot allowlist와 master data 검증에 실패한 항목은 삭제하지 않고 `disabled` Ghost로 보존한다.
- legacy 승패는 `legacyRecord`에 원형 보존하며 공격/방어 전적으로 나누지 않는다.
- 현재 시즌 합계는 계정별 `legacyUnclassifiedWins/Losses`에 절대값으로 저장한다.
- owner별 3개 초과 자료도 모두 보존하고 report의 `overCapacityOwners`에 기록한다.

## Emulator canary

격리된 Firestore Emulator project에서 다음을 확인했다.

- dry-run Firestore write 0건
- `--limit 2`와 `--resume-after` 조합으로 4개 entry를 누락·중복 없이 순회
- 4개 Ghost 중 정상 3개는 `active`, 깨진 snapshot 1개는 `disabled`
- owner registry에 4개를 모두 보존하고 over-capacity를 report에 기록
- legacy 시즌 합계 11승 7패를 `legacyUnclassifiedWins/Losses`에 보존
- `attackWins`, `defenseWins`는 0으로 유지해 공격/방어를 추측하지 않음
- 과거 battle log의 old entry ID 참조 2개 모두 새 Ghost ID로 해석 가능
- 같은 migration을 다시 apply했을 때 실질 write 0건
- apply 이후 dry-run도 Ghost 4개와 시즌 record를 모두 skip으로 판정
- 접두사 없는 legacy Ghost ID를 Ghost 삭제 API에서 처리
- legacy Ghost 삭제 후에도 원본 `arena_entries`와 과거 battle log 유지

## 운영 dry-run 상태

다음 명령으로 운영 write 없이 dry-run을 시도했다.

```bash
npm run arena:ghost:migrate -- \
  --project d2tamarefact \
  --dry-run \
  --report /tmp/arena-ghost-pr4-dry-run.json
```

현재 실행 세션에 Firebase Admin 자격증명이 없어 Firestore read 전에 중단됐다. `--apply`는 실행하지 않았고 운영 write는 0건이다. 자격증명을 명시한 뒤 같은 dry-run 명령을 다시 실행하고 JSON report를 검토하기 전에는 운영 migration을 적용하지 않는다.

## 운영 적용 전 체크리스트

1. 별도 preview Firebase project 또는 운영과 완전히 격리된 canary 환경을 사용한다.
2. `FIREBASE_SERVICE_ACCOUNT_PATH` 또는 `FIREBASE_SERVICE_ACCOUNT_JSON`을 명시한다.
3. 먼저 `--dry-run --report <path>`만 실행한다.
4. `scanned = created + disabled + skipped + repairedOwnerRegistries + errors`를 확인한다.
5. `originalDeletes == 0`, legacy 시즌 합계, `missingEntryIds`를 검토한다.
6. preview에서만 `--apply --confirm-project <preview-project>`를 실행한다.
7. 같은 apply와 dry-run을 재실행해 `writesPerformed == 0`을 확인한다.
8. 운영 migration은 별도 승인 후 수행한다.
