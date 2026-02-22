# 구글 스크립트가 디지몬명·별명을 읽을 Firestore 위치

구글 앱스 스크립트(디스코드 호출 알림 등)에서 **디지몬 표시명**, **별명(nickname)**, **어떤 조건으로 어떤 필드를 읽을지** 정리합니다.

---

## 스크립트에서 가져갈 때 (요약)

| 읽을 값 | 필드 | 조건(우선순위) |
|--------|------|----------------|
| **표시용 디지몬명** (한글명만, 별명 있으면 포함) | `digimonDisplayName` | 1순위. 있으면 이걸 쓰면 됨. (버전 접미사 없음) |
| ↑ 없을 때 대체 | `digimonNickname` | 2순위. 별명만 있는 경우. |
| ↑ 없을 때 대체 | `selectedDigimon` | 3순위. 영문 ID (Agumon, BlitzGreymon 등). |
| **별명만** 필요할 때 | `digimonNickname` | 있으면 string, 없으면 null/없음. |

**조건(로직):**  
`digimonDisplayName`이 있으면 → 그대로 표시용 디지몬명으로 사용.  
없으면 → `digimonNickname`이 있으면 그걸, 없으면 `selectedDigimon`을 사용.

---

## 저장 기준 (언제 / 어떻게 바뀌는지)

| 필드 | 저장 시점 | 저장 조건 |
|------|-----------|-----------|
| **digimonDisplayName** | **스탯 저장할 때마다** + **진화/사망 시** | ① 게임에서 `saveStats()`가 호출될 때 (먹이주기, 훈련, 배틀, 수면 등 액션 후 또는 주기 저장 시). ② **진화** 또는 **사망 후 환생** 시 `setSelectedDigimonAndSave(새 디지몬 ID)` 호출 시에도 함께 갱신됨. 조건: 슬롯 로딩이 끝난 후, 선택된 디지몬이 있을 때. 값은 `evolutionDataForSlot` 한글명 또는 `selectedDigimon` ID만. 별명이 있으면 `별명(한글명)` 형태. (버전 접미사 안 붙임) |
| **digimonNickname** | **슬롯 별명을 사용자가 저장할 때만** | 슬롯 선택 화면(SelectScreen)에서 슬롯별 “별명”을 수정하고 저장할 때만 Firestore 슬롯 문서의 `digimonNickname`이 갱신됨. 게임 내 스탯 저장(`saveStats`)에서는 `digimonNickname` 필드를 쓰지 않음. (표시용 `digimonDisplayName`만 계산 시 현재 메모리 상의 별명을 반영해 저장.) |

요약: **digimonDisplayName**은 스탯 저장 시 + **진화·사망 후 환생 시** 현재 디지몬·버전·별명 기준으로 갱신되고, **digimonNickname**은 사용자가 슬롯 설정에서 별명을 바꾸고 저장할 때만 바뀝니다.

---

## 읽을 문서 경로

**슬롯 문서 한 개:**

```
Firestore 경로: users / {uid} / slots / slot{슬롯번호}
예: users/abc123/slots/slot2
```

구글 스크립트에서 컬렉션 그룹 쿼리로 `slots`를 조회했다면, 각 결과 `document`가 위 경로 형태의 슬롯 문서입니다.

---

## 디지몬명: digimonDisplayName 사용 (권장)

앱에서 스탯 저장 시 슬롯 문서에 **digimonDisplayName** 필드를 넣습니다.

| Firestore 필드명 | 타입   | 설명 |
|------------------|--------|------|
| **digimonDisplayName** | string | **표시용 디지몬명.** 한글명 또는 ID만 (Ver.1/Ver.2 안 붙임). 별명 없음: `"한글명"` (예: `파피몬`). 별명 있음: `"별명(한글명)"`. 구글 스크립트는 이 필드만 읽으면 됨. |

**구글 스크립트에서 읽기:**

```javascript
// slotDoc.fields = dFields
var digimonName = "알 수 없는 디지몬";
if (dFields.digimonDisplayName && dFields.digimonDisplayName.stringValue) {
  digimonName = dFields.digimonDisplayName.stringValue;
}
```

---

## 그 외 필드 (슬롯 문서 루트)

| Firestore 필드명       | 타입   | 비고 |
|------------------------|--------|------|
| **selectedDigimon**   | string | 디지몬 ID (Agumon, Koromon 등). digimonDisplayName 없을 때 fallback. |
| **digimonNickname**   | string \| null | 사용자 별명. digimonDisplayName 없을 때 fallback. |
| **slotName**          | string | 슬롯 이름 (예: slot2, 내 디지몬). |

**digimonDisplayName이 없는 오래된 문서**를 위한 fallback 예시:

```javascript
var digimonName = "알 수 없는 디지몬";
if (dFields.digimonDisplayName && dFields.digimonDisplayName.stringValue) {
  digimonName = dFields.digimonDisplayName.stringValue;
} else if (dFields.digimonNickname && dFields.digimonNickname.stringValue) {
  digimonName = dFields.digimonNickname.stringValue;
} else if (dFields.selectedDigimon && dFields.selectedDigimon.stringValue) {
  digimonName = dFields.selectedDigimon.stringValue;
}
```

---

## 별명(nickname)만 따로 가져갈 때

| 목적 | 필드 | 타입 | 조건 |
|------|------|------|------|
| 사용자가 붙인 별명 | `digimonNickname` | string \| null | 값이 있으면 별명 있음, null/필드 없음이면 별명 없음. |

**구글 스크립트 예시 (표시명 + 별명 둘 다):**

```javascript
// dFields = slotDoc.fields (Firestore REST API 시 필드가 .stringValue 등으로 옴)

// 1) 표시용 디지몬명 (조건: digimonDisplayName → digimonNickname → selectedDigimon)
var displayName = "알 수 없는 디지몬";
if (dFields.digimonDisplayName && dFields.digimonDisplayName.stringValue) {
  displayName = dFields.digimonDisplayName.stringValue;
} else if (dFields.digimonNickname && dFields.digimonNickname.stringValue) {
  displayName = dFields.digimonNickname.stringValue;
} else if (dFields.selectedDigimon && dFields.selectedDigimon.stringValue) {
  displayName = dFields.selectedDigimon.stringValue;
}

// 2) 별명만 (있으면 사용, 없으면 null/빈 문자열)
var nickname = null;
if (dFields.digimonNickname && dFields.digimonNickname.stringValue) {
  nickname = dFields.digimonNickname.stringValue.trim();
}
// 사용 예: 알림 문구에 "별명: 뚱떙이" 같이 넣고 싶을 때 nickname 사용
```

---

## 요약

| 목적 | Firestore에서 읽을 필드 | 조건 |
|------|-------------------------|------|
| **표시용 디지몬명** | `digimonDisplayName` (1순위) | 있으면 그대로 사용. |
| 표시명 fallback | `digimonNickname` (2) → `selectedDigimon` (3) | `digimonDisplayName` 없을 때만. |
| **별명만** | `digimonNickname` | 있으면 string, 없으면 null/없음. |

**구글 스크립트는 `users/{uid}/slots/slot{id}` 문서에서 위 필드들을 읽어가면 됩니다.**
