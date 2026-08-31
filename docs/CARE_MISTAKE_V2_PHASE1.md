# 케어미스 V2 1단계 계약

## 목적

운영 슬롯을 변경하지 않고 레거시 케어미스 baseline과 V2 incident chain의 정합성을 분류한다. 레거시 canonical은 `digimonStats.careMistakes`이며 활동 로그와 기존 incident는 진단 자료로만 사용한다.

## Identity와 projection

- `rootReceiptId`: 현재 디지몬 생애의 V2 원장 lineage. 생애 동안 변경하지 않는다.
- `receiptId`: 현재 projection을 확정한 최신 migration/repair evidence. repair 성공 시 변경한다.
- `evolutionStageInstanceId`: 현재 진화 단계 epoch.
- `revision`: slot command 동시성 epoch.
- `unresolvedCareMistakeCount = baselineRemainingCount + postCutoverUnresolvedCount`이며 root/nested mirror는 모두 같은 값이어야 한다.
- 저장된 integrity 값은 단독으로 신뢰하지 않는다. hydration 검증으로 `effectiveIntegrityStatus`를 계산하고 drift가 있으면 자동 보정 없이 `repair_required`로 차단한다.

## Incident ordering과 chain

V2 unresolved chain 대상은 아래 조건을 모두 만족하는 incident뿐이다.

```text
careSchemaVersion == 2
rootReceiptId == careMistakeState.rootReceiptId
evolutionStageInstanceId == careMistakeState.evolutionStageInstanceId
status == "unresolved"
resolvedAt == null
```

발생 순서는 `occurredRevision → operationIndex → incidentId` 오름차순이다. revision과 operation index는 0 이상의 정수여야 하며 동일 root/stage의 `(occurredRevision, operationIndex)` 중복은 자동 정렬하거나 복구하지 않는다.

Hydration은 현재 head 한 건만 검증한다. 정상 해소 transaction은 current head와 previous incident까지 검증한다. Dry-run과 repair는 전체 chain의 cycle, 중복 방문, identity/status, count, null 종단, 실제 unresolved 집합과의 일치를 검사한다.

## Repair 경계

- 자동 repair 최대치는 400건이다. 저장 count 또는 실제 대상이 401건 이상이면 일부를 잘라 처리하지 않고 `OVER_REPAIR_BOUNDARY`로 종료한다.
- `linked_head_repair`는 운영자가 pointer를 입력하지 않는다. 서버가 immutable occurrence metadata로 head와 pointer를 재계산한다.
- 변경 가능한 값은 incident pointer, state head/current receipt, slot revision과 신규 immutable receipt뿐이다.
- incident ID·발생 순서·root/stage·해소 상태와 baseline/post-cutover/unresolved count는 변경할 수 없다.
- migration과 모든 repair는 expected revision을 확인하고 성공 시 revision을 정확히 1 증가시킨다.

## Read-only dry-run

```bash
npm run care-mistake:v2-dry-run -- \
  --project d2tamarefact \
  --uid-file /private/tmp/dthama-care-uid \
  --slots 4,5 \
  --redact-identifiers \
  --report /private/tmp/care-mistake-v2-slot4-slot5.json
```

스크립트는 Firestore read만 수행하며 결과의 `writesPerformed`는 항상 `0`이다. 출력에는 canonical baseline, classification, diagnostics, V2 unresolved 수, 저장된 post-cutover count, head, chain/order 상태와 repairability를 포함한다.

금지 사항은 운영 slot write, 로그 기반 baseline 변경, 합성 incident 생성, 400건 초과 truncation, ordering 오류 자동 보정과 projection drift 자동 repair다.
