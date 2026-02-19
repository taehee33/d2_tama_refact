# 조그레스 진화 온라인 기능 — 상세 설계

## 1. 왜 “아레나/배틀 등록” 패턴인가

- **아레나**: `arena_entries`에 “내 디지몬 스냅샷” 등록 → 다른 유저는 **목록 조회** 후 **챌린저 선택** → 배틀 진행.  
  방(room) 개념은 없고, “등록된 엔트리 목록”이 곧 대전 상대 목록.
- **조그레스 온라인**: “조그레스 대기 방”이 필요함.  
  - **방 생성** = “나(호스트)가 이 슬롯으로 조그레스 파트너를 기다린다”  
  - **방 참가** = “상대(게스트)가 자신의 슬롯을 선택해 이 방에 참가한다”  
  → “방 목록 보기 → 방 선택 → 내 슬롯 선택” 플로우는 아레나의 “챌린저 목록 → 상대 선택”과 **개념적으로 동일**하므로, **같은 UX 패턴(목록 + 선택)** 을 쓰는 것이 일관되고 학습 비용이 적다.

따라서 **큰 틀**은 다음과 같이 가져가는 것이 좋다.

- **방(room) 단위 컬렉션** 하나로 “누가 조그레스 파트너를 기다리는지” 표현.
- **방 목록 조회** = 아레나의 “챌린저 목록”과 유사 (다만 “나와 조그레스 가능한 디지몬을 가진 방”만 보여주거나, 전부 보여주고 참가 시 검증).
- **참가** = “이 방에 내 슬롯으로 참가” → 검증(`getJogressResult`) 통과 시 **게스트 쪽 먼저 진화 처리** + **호스트 슬롯에 `canEvolve` 플래그** → 호스트는 실시간 감지 후 진화 실행.

---

## 2. 세계 수준 설계 원칙 (요약)

| 원칙 | 적용 |
|------|------|
| **단일 소스 오브 트루스** | 조그레스 “가능 여부”는 `getJogressResult` 한 곳에서만 판단. 로컬/온라인 공통. |
| **비대칭 처리 명확화** | 게스트(B): 즉시 진화 + 슬롯 사망. 호스트(A): `canEvolve` 플래그로 “진화 가능” 상태만 저장, 유저가 버튼 눌렀을 때 진화. |
| **원자성** | 게스트 진화·사망은 한 번의 writeBatch. 호스트 쪽 플래그/방 상태는 트랜잭션 또는 일관된 순서로 업데이트. |
| **Firestore만 사용** | Ably 없이, `onSnapshot`으로 “진화 가능” 감지. 기존 아키텍처와 동일. |
| **보안** | 호스트는 자기 방만 생성/취소. 게스트는 “방 문서 + 자기 슬롯”만 수정. Firestore Rules로 본인 문서만 쓰기 허용. |
| **UX 일관성** | “방 목록 → 방 선택 → (내 슬롯 선택) → 참가” = 아레나 “챌린저 목록 → 상대 선택 → 배틀”과 동일한 2단계 선택 플로우. |

---

## 3. Firestore 데이터 구조

### 3.1 컬렉션: `jogress_rooms`

한 문서가 “조그레스 대기 방” 하나.

| 필드 | 타입 | 설명 |
|------|------|------|
| `hostUid` | string | 방 만든 유저 UID |
| `hostSlotId` | number | 호스트의 슬롯 ID |
| `hostDigimonId` | string | 호스트 슬롯의 디지몬 ID (예: BlitzGreymon, CresGarurumonV2) |
| `hostSlotVersion` | string | "Ver.1" \| "Ver.2" (조그레스 결과·검증에 사용) |
| `hostTamerName` | string | 표시용 테이머명 |
| `createdAt` | Timestamp | 방 생성 시각 (목록 정렬·만료 판단용) |
| `status` | string | `waiting` \| `paired` \| `completed` \| `cancelled` |
| `guestUid` | string? | 참가한 유저 UID (paired 이후) |
| `guestSlotId` | number? | 게스트 슬롯 ID |
| `guestDigimonId` | string? | 게스트 디지몬 ID |
| `guestSlotVersion` | string? | "Ver.1" \| "Ver.2" |
| `targetId` | string? | 조그레스 결과 디지몬 ID (paired 시 한 번만 설정, 호스트·게스트 모두 동일) |
| `completedAt` | Timestamp? | 호스트가 진화 완료한 시각 (completed 시) |

- **인덱스**: `status` + `createdAt` (목록: status==waiting, orderBy createdAt desc). 필요 시 `hostUid` 복합.

### 3.2 슬롯 문서: `users/{uid}/slots/slot{n}`

기존 슬롯 문서에 **선택 필드**만 추가.

| 필드 | 타입 | 설명 |
|------|------|------|
| `jogressStatus` | map? | 온라인 조그레스 상태 (없으면 미사용) |
| `jogressStatus.isWaiting` | boolean | true = 이 슬롯이 “방 대기 중” (호스트) |
| `jogressStatus.roomId` | string? | 대기 중인 방 문서 ID (취소/중복 방지) |
| `jogressStatus.canEvolve` | boolean | true = 상대가 참가 완료, 진화 버튼 눌러도 됨 |
| `jogressStatus.partnerUserId` | string? | 상대 유저 UID (선택, 로그/표시용) |
| `jogressStatus.partnerSlotId` | number? | 상대 슬롯 ID (선택) |
| `jogressStatus.targetId` | string? | 조그레스 결과 디지몬 ID (진화 시 사용) |
| `jogressStatus.pairedAt` | Timestamp? | paired 된 시각 (선택) |

- 로컬 조그레스 후에는 `jogressStatus`를 비우거나 유지해도 되며, 온라인만 쓸 때는 “방 생성 시 isWaiting, 참가 완료 시 canEvolve, 진화 완료 시 clear”로 정리하면 됨.

### 3.3 컬렉션: `jogress_logs` (조그레스 성공 감사 로그)

**역할**: “어떤 사용자의 어떤 디지몬 + 어떤 사용자의 어떤 디지몬 → 조그레스 성공” 기록. 로컬/온라인 모두 성공 시 한 문서 추가.

| 필드 | 타입 | 설명 |
|------|------|------|
| `hostUid` | string | 진화하는 쪽(호스트) 유저 UID |
| `hostTamerName` | string? | 호스트 테이머 표시명 |
| `hostSlotId` | number | 호스트 슬롯 ID |
| `hostDigimonName` | string | 호스트 디지몬 한글명 |
| `hostSlotVersion` | string | "Ver.1" \| "Ver.2" |
| `guestUid` | string | 사망/합체되는 쪽(게스트) 유저 UID (로컬이면 hostUid와 동일) |
| `guestTamerName` | string? | 게스트 테이머 표시명 |
| `guestSlotId` | number | 게스트 슬롯 ID |
| `guestDigimonName` | string | 게스트 디지몬 한글명 |
| `guestSlotVersion` | string | "Ver.1" \| "Ver.2" |
| `targetId` | string | 결과 디지몬 ID |
| `targetName` | string | 결과 디지몬 한글명 |
| `isOnline` | boolean | true = 온라인 조그레스, false = 로컬 |
| `createdAt` | Timestamp | 성공 시각 |

- **진화 완료 모달**: 조그레스 성공 시 “파트너 디지몬은 데이터가 되어 사라졌습니다.” 아래에 **요약 한 줄** 표시 (예: `블리츠그레이몬(슬롯1) + 크레스가루루몬(슬롯2) → 오메가몬 Alter-S`). 상태 `evolutionCompleteJogressSummary`로 전달.

---

## 4. 플로우 (호스트 A / 게스트 B)

### 4.1 호스트: 방 만들기

1. 유저 A가 게임 화면에서 “조그레스 진화” → “온라인” 선택.
2. “방 만들기” 클릭.
3. **검증**: 현재 슬롯에 조그레스 가능 진화가 있는지 (evolutions 중 jogress 존재).
4. `jogress_rooms`에 문서 추가:
   - `hostUid`, `hostSlotId`, `hostDigimonId`, `hostSlotVersion`, `hostTamerName`, `createdAt`, `status: 'waiting'`.
5. (선택) A의 슬롯에 `jogressStatus: { isWaiting: true, roomId: doc.id }` 업데이트 → “이 슬롯은 이미 대기 중” 중복 방지.
6. UI: “방이 생성되었습니다. 다른 테이머가 참가할 때까지 기다려 주세요.” + “방 목록에서 본인 방 취소” 가능.

### 4.2 게스트: 방 목록 보기 & 참가

1. 유저 B가 “조그레스 진화” → “온라인” → “방 참가”.
2. `jogress_rooms` 쿼리: `status == 'waiting'`, `orderBy createdAt desc` (필요 시 limit).
3. 목록 표시: 호스트 테이머명, 디지몬명(한글), 슬롯 버전 등. **아레나 챌린저 목록과 같은 카드/리스트 UI**.
4. B가 “이 방에 참가” 클릭 → “참가할 내 슬롯 선택” 모달 (자기 slots 중 사망 제외, 조그레스 가능한 슬롯만 강조 권장).
5. 슬롯 선택 후:
   - `getJogressResult(방의 hostDigimonId, B가 선택한 슬롯의 selectedDigimon, **호스트 버전 기준 맵**)` 호출.  
     (또는 Ver.1↔Ver.2 크로스이므로 **현재 구현처럼 baseJogressId로 매칭**하면 됨.)
   - 실패 시: “조합할 수 없는 파트너입니다.” 토스트/알림.
   - 성공 시: `targetId` 확정.

### 4.3 게스트: 참가 확정 (원자 처리)

1. **트랜잭션 또는 순서 보장**으로:
   - `jogress_rooms` 문서: `status = 'paired'`, `guestUid`, `guestSlotId`, `guestDigimonId`, `guestSlotVersion`, `targetId` 설정.
   - **게스트(B) 슬롯**: 조그레스 결과로 진화 + 스탯 초기화, **사망 처리** (로컬과 동일한 writeBatch 패턴).  
     + activityLog: "조그레스 진화(온라인): [결과 디지몬명]!"
   - **호스트(A) 슬롯** 문서: `jogressStatus: { canEvolve: true, roomId, targetId, partnerUserId: B.uid, ... }` 업데이트.
2. B 쪽 UI: “조그레스 완료! 파트너 디지몬은 데이터가 되어 사라졌습니다.” (로컬과 동일한 성공 메시지).
3. B는 해당 슬롯이 진화된 상태로 게임 화면 갱신.

### 4.4 호스트: “진화 가능” 감지 및 진화 실행

1. 호스트 A가 해당 슬롯을 보고 있을 때:
   - `onSnapshot(doc(db, 'users', uid, 'slots', 'slot' + slotId))` 로 **해당 슬롯 문서** 구독.
2. `digimonStats` 또는 루트의 `jogressStatus.canEvolve === true` 이면:
   - UI: “조그레스 파트너가 참가했습니다! 진화하려면 버튼을 누르세요.” + **진화 버튼 활성화** (기존 조그레스 전용 버튼 재사용 가능).
3. A가 “진화!” 클릭:
   - `proceedJogressOnlineAsHost(slotId, jogressStatus.targetId)` 같은 전용 함수 호출:
     - applyLazyUpdate → 진화 후 스탯 초기화 (로컬 evolve와 동일 로직).
     - 슬롯 문서: `selectedDigimon = targetId`, `digimonStats` 갱신, **`jogressStatus` 제거 또는 초기화**.
     - `jogress_rooms` 문서: `status = 'completed'`, `completedAt = now`.
   - 성공 메시지: “디지몬 진화~~!” + “파트너 디지몬은 데이터가 되어 사라졌습니다.” (기존 플래그 `evolutionCompleteIsJogress` 재사용).

### 4.5 취소 / 만료

- **호스트가 취소**: “방 나가기” → `jogress_rooms` 문서 `status = 'cancelled'`, 호스트 슬롯의 `jogressStatus` 제거.
- **타임아웃 (선택)**: `createdAt`이 N분(예: 30분) 지나면 목록에서 제외하거나, “만료된 방”으로 표시. 참가 시도 시 “이미 만료되었습니다” 처리.  
  (구현 1단계에서는 만료 없이 “취소”만 해도 됨.)

---

## 5. 아레나와의 차이·공통점

| 항목 | 아레나 | 조그레스 온라인 |
|------|--------|------------------|
| 등록 단위 | 내 디지몬 1마리 = 1 엔트리 (arena_entries) | 내 슬롯 1개 = 1 방 (jogress_rooms, status=waiting) |
| 목록 | 다른 유저 엔트리 = 챌린저 목록 | status=waiting 인 방 = “참가 가능 방 목록” |
| 선택 후 | 배틀 시작 (승패 계산) | “참가할 내 슬롯” 선택 → getJogressResult 검증 → 게스트 즉시 진화, 호스트는 canEvolve 플래그 |
| 실시간 | 배틀 결과만 저장, 실시간 대기 없음 | 호스트는 onSnapshot으로 canEvolve 감지 후 진화 버튼 |

공통: **Firestore 컬렉션 1개 + “목록 조회 → 하나 선택 → 다음 단계(슬롯 선택 또는 배틀)”** 구조.

---

## 6. 구현 순서 제안

1. **Firestore**
   - `jogress_rooms` 컬렉션 규칙 및 인덱스 (status, createdAt).
   - `jogress_logs` 컬렉션: 조그레스 성공 시 감사 로그 (hostUid, guestUid 등으로 “내 조그레스 기록” 조회 가능).
   - 슬롯 문서에 `jogressStatus` 필드 허용 (기존 규칙이 막지 않으면 추가만).

2. **로직**
   - `proceedJogressOnlineAsGuest(roomId, mySlot)`  
     → getJogressResult 검증 → 방 문서 업데이트 + 게스트 슬롯 진화·사망 writeBatch + 호스트 슬롯 jogressStatus.canEvolve 업데이트.
   - `proceedJogressOnlineAsHost(slotId)`  
     → 현재 슬롯의 jogressStatus.targetId로 진화 처리, jogressStatus 초기화, 방 status=completed.

3. **UI**
   - “온라인” 선택 시: “방 만들기” / “방 참가” 탭 또는 버튼.
   - 방 만들기: 현재 슬롯으로 방 생성 + (선택) “내 대기 방 취소” 버튼.
   - 방 참가: 방 목록 (카드/리스트) → 방 선택 → “참가할 슬롯 선택” 모달 → 참가 실행.
   - 호스트: 해당 슬롯 화면에서 onSnapshot 구독, canEvolve 시 “진화 가능!” 문구 + 진화 버튼 노출.

4. **에러/엣지**
   - 이미 paired/completed/cancelled 방에 참가 시도 → “이미 마감된 방입니다.”
   - 게스트 참가 직후 호스트가 취소하지 않도록, paired 이후에는 호스트 취소 시 “이미 파트너가 참가했습니다. 진화를 진행해 주세요.” 등 처리.

---

## 7. 방 등록자(호스트)가 “진화 성공”을 알기 쉽게

호스트는 **방을 만들어 둔 뒤** 다른 테이머가 참가하면, **자기 슬롯에 `jogressStatus.canEvolve === true`** 가 설정된다. 이걸 “내가 등록해 둔 디지몬이 조그레스 진화에 성공할 준비가 됐다”로 알려주려면 아래처럼 하면 된다.

| 장소 | 구현 방법 |
|------|-----------|
| **게임 화면(해당 슬롯 플레이 중)** | 해당 슬롯 문서를 `onSnapshot`으로 구독. `jogressStatus.canEvolve === true` 이면 상단에 **배너** 표시: “조그레스 파트너가 참가했습니다! 진화하려면 버튼을 눌러 주세요.” + 기존 **진화 버튼** 활성화. |
| **슬롯 선택 화면(SelectScreen)** | 슬롯 목록을 불러올 때 각 슬롯 문서에 `jogressStatus` 포함. `jogressStatus?.canEvolve === true` 인 슬롯 카드에 **뱃지/라벨** 표시: “진화 가능!” 또는 아이콘. 클릭 시 해당 슬롯으로 진입하면 게임 화면에서 위 배너와 진화 버튼으로 진행. |
| **(선택) 다른 슬롯 플레이 중** | 현재 플레이 중인 슬롯이 아닌데, 다른 슬롯에 canEvolve가 있는 경우: 슬롯 목록에서만 뱃지로 알 수 있게 하거나, 게임 상단에 “슬롯 N: 조그레스 진화 가능” 토스트 한 번 띄우기 등. 1단계에서는 **해당 슬롯 진입 시 배너 + SelectScreen 뱃지**만 해도 충분함. |

정리하면, **SelectScreen에서 슬롯 카드에 “진화 가능!” 뱃지** + **해당 슬롯 게임 화면에서 onSnapshot 후 “진화 가능” 배너 + 진화 버튼** 두 가지만 넣어도, 방 등록자가 “내가 등록해 둔 디지몬이 조그레스 진화에 성공할 수 있는 상태”를 쉽게 인지할 수 있다.

---

## 8. 정리

- **큰 틀**: 아레나처럼 “등록(방 생성) → 목록(방 목록) → 선택(방 선택 후 슬롯 선택) → 액션(참가/진화)” 로 가면 된다.
- **데이터**: `jogress_rooms` 한 컬렉션 + 슬롯의 `jogressStatus` 로 상태를 명확히 하고, Firestore만으로 실시간 감지(onSnapshot)까지 처리 가능하다.
- **로그**: `jogress_logs`에 “누가·어떤 디지몬 + 누가·어떤 디지몬 → 결과”를 남기고, 진화 완료 모달에 요약 한 줄을 보여 준다.
- **호스트 알림**: SelectScreen 슬롯 뱃지 + 해당 슬롯 게임 화면 배너로 “진화 가능” 상태를 알기 쉽게 한다.
- **보안·일관성**: getJogressResult로 조합 검증, 게스트는 자기 슬롯만, 호스트는 자기 슬롯·자기 방만 수정하도록 Rules와 함수를 나누면 “세계 수준”의 명확한 설계가 된다.

이 문서를 기준으로 6절 구현 순서대로 단계별로 코딩하면 된다.
