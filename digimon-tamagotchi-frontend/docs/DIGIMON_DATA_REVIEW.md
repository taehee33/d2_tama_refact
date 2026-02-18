# 디지몬 데이터(v1/v2) 수정 검토 요약

## 수정 내용 요약

### v1/digimons.js
| 항목 | 변경 전 | 변경 후 | 비고 |
|------|---------|---------|------|
| BlitzGreymon.id | "BlitzGreymon" | "BlitzGreymonV1" | ✅ 표시용, 객체 키는 그대로 |
| BlitzGreymon.name | "블리츠그레이몬" | "블리츠그레이몬 Ver.1" | ✅ |
| BlitzGreymon.evolutions[0].targetId | "OmegamonAlterS" | "OmegamonAlterSV1" | ❌ **복구함** (아래 참고) |
| BlitzGreymon.evolutions[0].targetName | "오메가몬 Alter-S" | "오메가몬 Alter-S Ver.1" | ✅ |
| OmegamonAlterS.id | "OmegamonAlterS" | "OmegamonAlterSV1" | ✅ 표시용 |
| OmegamonAlterS.name | "오메가몬 Alter-S" | "오메가몬 Alter-S Ver.1" | ✅ |
| CresGarurumon.id | "CresGarurumon" | "CresGarurumonV1forJogress" | ✅ 표시용, 객체 키는 그대로 |
| CresGarurumon.name | "크레스가루몬" | "크레스가루몬 Ver.1 (for Jogress)" | ✅ |

### v2modkor/digimons.js
| 항목 | 변경 전 | 변경 후 | 비고 |
|------|---------|---------|------|
| BlitzGreymonV2.id | "BlitzGreymonV2" | "BlitzGreymonV2Jogress" | ✅ 표시용, 객체 키는 그대로 |
| BlitzGreymonV2.name | "블리츠그레이몬 Ver.2" | "블리츠그레이몬 Ver.2 (for Jogress)" | ✅ |

---

## 영향 검토

### 1. 객체 키 vs targetId / id / name

- **객체 키**(예: `BlitzGreymon`, `OmegamonAlterS`, `CresGarurumon`)는 **그대로** 두었기 때문에  
  `digimonDataVer1["BlitzGreymon"]`, `digimonDataVer1["OmegamonAlterS"]` 등 모든 조회는 **정상**입니다.
- **id / name** 변경은 UI·표시용으로만 쓰이므로, 키로 접근하는 로직에는 **영향 없음**.

### 2. targetId "OmegamonAlterSV1"에 맞춘 수정 (완료)

- **조치:** `targetId: "OmegamonAlterSV1"`를 유지하고, **객체 키를 `OmegamonAlterSV1`로 통일**했습니다.
- **v1/digimons.js:** `OmegamonAlterS` → **`OmegamonAlterSV1`** (키 변경). 이제 `digimonDataVer1["OmegamonAlterSV1"]`로 정상 조회됩니다.
- **v1/quests.js:** 해당 보스 enemyId를 **`"OmegamonAlterS"` → `"OmegamonAlterSV1"`**로 변경해 퀘스트에서 동일 키로 참조하도록 했습니다.

### 3. 다른 참조처

- **v1/quests.js**: `enemyId: "OmegamonAlterS"`, `"BlitzGreymon"` → 객체 키 그대로라 **영향 없음.**
- **v2/quests.js**: `OmegamonAlterSV2`, `CresGarurumonV2` 등 → v2 키와 일치, **영향 없음.**
- **EncyclopediaModal**: Ver.1에서 `CresGarurumon`, Ver.2에서 `BlitzGreymonV2` 키로 제외 처리 → 키 변경 없어 **영향 없음.**
- **조그레스 로직**: `getJogressResult`는 `jogress.partner` 문자열과 `baseJogressId(partnerDigimonId)`로만 비교하므로, 객체 내부 `id` 변경과 무관. **영향 없음.**

---

## 결론

- **v1**: `targetId`만 `"OmegamonAlterS"`로 복구해 두었습니다.  
  그 외 id/name 변경은 표시용이라 **영향 없고**, 퀘스트·진화·도감·조그레스 모두 **정상 동작**합니다.
- **v2**: 객체 키 변경 없고 id/name만 바뀌어 **영향 없음**입니다.

앞으로 **진화 targetId**를 바꿀 때는 반드시 **같은 파일 안에 그 targetId를 키로 가진 객체가 있는지** 확인하면 됩니다.
