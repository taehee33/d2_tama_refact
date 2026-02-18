# 조그레스 진화 기획 및 설계

## 1. 요약

- **조그레스 가능 디지몬**: 진화 버튼 문구를 "진화(조그레스)"로 표시하고, **조그레스 진화** 전용 버튼을 노출.
- **조그레스 진화** 클릭 시: **로컬** / **온라인** 선택.
  - **로컬**: 현재 슬롯(A) + 내 다른 슬롯(B) 선택 → A는 조그레스 결과로 진화, B는 사망(초기화) 처리.
  - **온라인**: 방 등록 → 상대가 조그레스 신청 → 플래그로 "진화 가능" 설정 → 양측 진화 처리.

Ably는 사용하지 않고, **Firestore만**으로 온라인 조그레스(방·플래그·실시간 감지)를 구현하는 방향을 권장합니다.

---

## 2. 현재 코드 상태

- `digimons.js` (v1): `BlitzGreymon` → `jogress: { partner: "CresGarurumon" }`, `CresGarurumon`은 조그레스 전용 placeholder.
- `checker.js`: `evolutionOption.jogress`인 경우 **스킵** (조그레스는 일반 진화 판정에서 제외).
- `useEvolution.js`: `evolutions.find((e) => !e.jogress)` 로 **비조그레스**만 일반 진화에 사용.
- `EvolutionConfirmModal`: 일반 "진화" 확인만 있음.
- `DigimonInfoModal` / `EvolutionGuideModal`: 조그레스는 "아직 지원되지 않습니다" 메시지.

→ 조그레스 전용 **진입점(버튼·모달)** 과 **로직(결과 디지몬 계산, 로컬/온라인 플로우)** 을 새로 붙이면 됩니다.

---

## 3. 핵심 로직: 조그레스 결과 디지몬

### 3.1 `getJogressResult(digimonIdA, digimonIdB, digimonDataMap)`

- **역할**: 두 디지몬 ID가 조그레스 가능 조합인지 확인하고, 결과 디지몬 ID를 반환.
- **규칙**:
  - A의 `evolutions` 중 `jogress.partner === B` 인 항목이 있으면 → 해당 `targetId` 반환.
  - B의 `evolutions` 중 `jogress.partner === A` 인 항목이 있으면 → 해당 `targetId` 반환.
  - 둘 다 없으면 `null` (조합 불가).
- **위치**: `src/logic/evolution/jogress.js` (신규).
- **반환**: `{ success: boolean, targetId: string | null, reason?: string }`

이 함수를 먼저 만들면, 로컬/온라인 모두 "이 둘로 조그레스 가능한가?" 검증에 재사용할 수 있습니다.

---

## 4. UI 변경

### 4.1 진화 버튼 영역 (Game.jsx)

- **조그레스만 있는 디지몬** (evolutions에 일반 진화 없고, jogress만 있음):
  - 기존 "진화!" 버튼: 문구만 **"진화(조그레스)"** 로 변경하고, 클릭 시 **조그레스 전용 플로우**로 연결 (아래 4.2).
  - 또는: "진화!" 버튼은 숨기고 **"조그레스 진화"** 버튼만 표시 (기획서대로라면 이쪽이 더 명확).
- **일반 진화도 있는 디지몬**:
  - "진화!" 버튼: 기존처럼 일반 진화 확인 모달.
  - **"조그레스 진화"** 버튼: 조그레스 전용 (조그레스 가능할 때만 표시).

정리하면:

- `canNormalEvolve`: 기존 `checkEvolution` 결과 (jogress 제외).
- `canJogressEvolve`: evolutions 중 `jogress` 항목이 하나라도 있으면 true.
- 버튼 노출:
  - 일반만 있음 → "진화!" 만.
  - 조그레스만 있음 → "진화(조그레스)" 또는 "조그레스 진화" 하나만.
  - 둘 다 있음 → "진화!" + "조그레스 진화".

### 4.2 조그레스 진화 클릭 시 플로우

1. **모달**: "조그레스 진화" 선택 모달
   - **로컬**: 내 다른 슬롯과 합체
   - **온라인**: 다른 유저와 합체 (방 등록 / 참가)

2. **로컬 선택 시**  
   → "파트너 슬롯 선택" 모달: 현재 유저의 다른 슬롯 목록 표시 (현재 슬롯 제외, 사망한 슬롯 제외 가능 여부는 기획에 따라).  
   → 슬롯 선택 후 `getJogressResult(현재디지몬, 선택슬롯의 디지몬)` 검증.  
   → 성공 시 확인 문구 후 실행 (아래 5.1).

3. **온라인 선택 시**  
   → "방 만들기" 또는 "방 참가" (아래 6절).

---

## 5. 로컬 조그레스 (내 슬롯 간)

### 5.1 처리 순서 (원자성)

1. **파트너 슬롯 B** 선택.
2. **검증**: `getJogressResult(현재 슬롯 A의 selectedDigimon, 슬롯 B의 selectedDigimon)` → 조합 가능해야 함.
3. **Firestore writeBatch** (한 번에):
   - **슬롯 A**:  
     - `selectedDigimon` → 조그레스 결과 디지몬 ID  
     - `digimonStats` → 진화 후 스탯 초기화 (기존 `evolve()`와 동일한 보정)  
     - `activityLogs` 등에 "조그레스 진화(로컬)" 기록  
   - **슬롯 B**:  
     - 사망 처리: `digimonStats.isDead = true`, `deathReason = 'JOGRESS_PARTNER (조그레스 파트너)'`  
     - 또는 “알 상태로 초기화” 등 정책에 따라 선택  
   - 필요 시 두 문서 모두 `jogressStatus` cleanup (아래 5.2)
4. **클라이언트 상태**: 현재 게임 화면은 슬롯 A 기준이므로, A는 진화 결과로 갱신, 슬롯 목록 등에서 B는 사망/빈 슬롯으로 반영되도록 갱신.

### 5.2 데이터 구조 (digimonStats 또는 슬롯 루트)

로컬만 쓸 때는 최소한이어도 되고, 온라인과 통일하려면 슬롯에 다음 정도를 두면 됩니다.

```js
// 슬롯 문서 또는 digimonStats 내부 (팀 정책에 따라)
jogressStatus: {
  isWaiting: false,        // 온라인 대기 중 여부
  partnerSlotId: null,    // 로컬일 때 상대 슬롯 ID (같은 유저)
  canEvolve: false,       // 온라인에서 상대가 승인 후 true
  jogressPoint: 0         // 선택: 조그레스 보너스 등
}
```

로컬 조그레스 직후에는 `partnerSlotId` 만 썼다가 정리하거나, 로컬은 이 필드를 비워두고 “진화 이력”만 activityLogs로 남길 수 있습니다.

---

## 6. 온라인 조그레스 (다른 유저와)

Ably 없이 **Firestore만** 사용하는 경우:

### 6.1 컬렉션 구조 (제안)

- **`jogress_rooms`** (또는 `users/{uid}/jogress_room` 한 문서):
  - `roomId`, `hostUid`, `hostSlotId`, `hostDigimonId`, `createdAt`
  - `guestUid`, `guestSlotId`, `guestDigimonId` (참가 시 채움)
  - `status`: `waiting` | `paired` | `completed` | `cancelled`

- **슬롯 문서** `users/{uid}/slots/slot{n}`:
  - `jogressStatus.canEvolve`: 상대가 “조그레스 수락” 시 true로 갱신
  - `jogressStatus.partnerUserId`, `jogressStatus.partnerSlotId` (선택): 상대 정보

### 6.2 플로우

1. **등록(방 만들기)**  
   - 유저 A가 "조그레스 진화" → 온라인 → "방 만들기"  
   - `jogress_rooms`에 방 생성 (host = A, 현재 슬롯/디지몬 저장)  
   - A의 슬롯에 `jogressStatus.isWaiting = true` (선택)

2. **참가(다른 사람이 조그레스)**  
   - 유저 B가 "방 목록"에서 A 방 선택 (또는 방 코드 입력)  
   - B가 자신의 슬롯 선택  
   - `getJogressResult(A디지몬, B디지몬)` 검증  
   - 성공 시:
     - 방 상태를 `paired` 등으로 변경
     - **A의 슬롯** 문서에 `jogressStatus.canEvolve = true` (및 partner 정보) 업데이트
     - **B**는 즉시 자신의 슬롯을 조그레스 결과로 진화 + 스탯 보정 (그리고 B 슬롯은 “사망” 또는 알로 초기화 정책 적용)

3. **A 쪽 진화**  
   - A는 게임 화면에서 해당 슬롯을 보고 있을 때, `onSnapshot(users/A/slots/slotX)` 로 `jogressStatus.canEvolve === true` 감지  
   - "진화 가능!" 연출 후 진화 버튼 활성화  
   - A가 진화 실행 → 조그레스 결과로 진화, `jogressStatus` 초기화, 방은 `completed` 처리

4. **취소**  
   - 방 나가기/취소 시: 방 문서 `cancelled`, 해당 슬롯의 `jogressStatus` clear

### 6.3 Edge case

- **조합 오류**: `getJogressResult`가 실패하면 "조합할 수 없는 파트너입니다" 메시지.
- **로컬 슬롯 유실**: writeBatch에서 **먼저 슬롯 A 진화 확정**, 그 다음 슬롯 B 사망 처리 순서로 하면, 중간에 끊겨도 A는 이미 진화된 상태로 남음.
- **온라인**: B가 먼저 진화 처리하고, A 슬롯에만 `canEvolve` 플래그를 주는 방식이면, A가 나중에 진화할 때 별도 동기화 이슈는 줄어듦.

---

## 7. 구현 순서 제안

1. **`getJogressResult`**  
   - `src/logic/evolution/jogress.js`  
   - 단위 테스트 가능한 순수 함수로 구현.

2. **UI: 조그레스 가능 여부 + 버튼**  
   - `canJogressEvolve` 계산 (evolutions에 jogress 있는지).  
   - Game.jsx에서 "진화(조그레스)" / "조그레스 진화" 버튼 노출 및 클릭 시 "로컬 / 온라인" 모달로 연결.

3. **로컬 조그레스**  
   - "파트너 슬롯 선택" 모달 (현재 유저의 다른 슬롯 목록은 Firestore `users/{uid}/slots` getDocs로 로드).  
   - `getJogressResult` 검증 → writeBatch (A 진화, B 사망) + activityLogs.  
   - useEvolution의 `evolve()` 재사용 또는 조그레스 전용 `evolveJogressLocal(slotIdA, slotIdB, targetId)`.

4. **온라인 조그레스**  
   - 방 생성/목록/참가 UI.  
   - Firestore `jogress_rooms` + 슬롯의 `jogressStatus.canEvolve` 업데이트.  
   - A 쪽 onSnapshot으로 "진화 가능" 감지 후 진화 실행.

5. **도감/가이드**  
   - DigimonInfoModal, EvolutionGuideModal에서 조그레스 항목을 "조그레스 진화(로컬/온라인)로 진행할 수 있습니다" 등으로 문구 변경.

---

## 8. 정리

- **로컬**: 현재 슬롯 + 내 다른 슬롯 선택 → `getJogressResult` 검증 → writeBatch로 A 진화 + B 사망, 원자성 유지.
- **온라인**: Firestore 방 + 슬롯 플래그(`canEvolve`)만으로 진행 가능하며, Ably 없이 구현 가능.
- **공통**: `getJogressResult(digimonA, digimonB)`를 먼저 구현하면 검증·UI·로컬/온라인 모두에서 재사용할 수 있습니다.

다음 단계로는 **1) `getJogressResult` 함수 구현** 또는 **2) "파트너 슬롯 선택" UI 설계** 중 하나부터 진행하면 됩니다. 원하시는 쪽을 정해 주시면 그 부분부터 구체 코드 초안을 잡아 드리겠습니다.
