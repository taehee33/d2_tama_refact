# 실시간 배틀 및 덱 빌딩 구현 계획

**작성일:** 2026-03-08  
**목적:** 1:1 온라인 실시간 배틀, 덱 빌딩(카드 선택) 배틀, 방 UI, 끊김 처리 등 지금까지 논의 내용을 반영한 통합 구현 계획.

---

## 1. 구현 순서 (우선순위)

| 단계 | 내용 | 비고 |
|------|------|------|
| **1** | 1:1 실시간 배틀 (덱 없음, 기존 hitRate만) | 방 생성/참가, Ably 라운드 동기화, 공유 시드 또는 서버 판정 |
| **2** | 덱 빌딩 배틀 | 카드 정의(attack/defend/heavy_attack), 슬롯별 덱, 덱 편집 UI, 배틀 시 드로우·선택·판정 |
| **3** | (선택) 공격/방어 단순 선택 | 턴마다 공격/방어만 고르는 모드, 방어 횟수 제한 또는 부분 방어 |
| **4** | (선택) 2:2 동시 배틀, 필살기 | 추후 확장 |

---

## 2. 1:1 실시간 배틀

### 2.1 아키텍처

- **방·참가·승패**: Firestore 컬렉션 `realtime_battle_rooms`
- **라운드 동기화**: Ably 채널 `realtime-battle:{roomId}`
- **판정**: 1단계는 공유 시드 + 호스트가 1라운드 계산 후 `round` 메시지 publish. (조작 방지 필요 시 Cloud Function으로 서버 판정 전환)

### 2.2 Firestore: `realtime_battle_rooms`

| 필드 | 타입 | 설명 |
|------|------|------|
| hostUid | string | 방 만든 유저 UID |
| hostSlotId | number | 호스트 슬롯 ID |
| hostDigimonSnapshot | map | 호스트 디지몬 스냅샷 (digimonId, power, type, name, sprite, slotName 등) |
| hostTamerName | string | 표시용 테이머명 |
| guestUid | string? | 참가한 유저 UID (참가 시) |
| guestSlotId | number? | 게스트 슬롯 ID |
| guestDigimonSnapshot | map? | 게스트 디지몬 스냅샷 (참가 시 채움) |
| guestTamerName | string? | 게스트 테이머명 |
| status | string | waiting \| ready \| fighting \| finished \| cancelled |
| roomSeed | number | 공유 시드 (라운드 판정 일치용) |
| createdAt | Timestamp | 방 생성 시각 |
| finishedAt | Timestamp? | 종료 시각 |
| winner | string? | host \| guest \| draw (종료 시) |
| disconnectReason | string? | opponent_left 등 (선택) |

### 2.3 Ably 메시지

- **채널**: `realtime-battle:{roomId}`

| type | 발신 | 내용 |
|------|------|------|
| ready | host/guest | { role: 'host'\|'guest' } — 둘 다 오면 배틀 시작 |
| round | host | { roundIndex, userHit, enemyHit, userHits, enemyHits } — 라운드 N 결과 |
| result | 호스트 또는 판정 주체 | { winner: 'host'\|'guest' } — 3히트 도달 시 |
| rejoined | 재접속한 쪽 | (재접속 대기 도입 시) |

### 2.4 싸우는 디지몬

- **호스트**: 방 만들 때 **현재 선택한 슬롯 1개**의 디지몬. 해당 슬롯의 `selectedDigimon` + `digimonStats`를 **스냅샷**으로 `hostDigimonSnapshot`에 저장.
- **게스트**: 참가 시 **내 슬롯 목록에서 1개 선택** → 그 슬롯 기준 스냅샷을 `guestDigimonSnapshot`에 저장.
- 배틀 중에는 **스냅샷만** 사용 (실시간 슬롯 재조회 없음). 기존 아레나 `createDigimonSnapshot` 패턴 재사용.

### 2.5 방 UI

- **방 목록 (대기 중인 방)**  
  - `status == 'waiting'` 쿼리.  
  - **표시**: 호스트 테이머명, "대기 중", 방 만든 시간.  
  - **숨김/블러**: 상대(호스트) 디지몬 이름·스프라이트·파워·속성 — 카운터 픽 방지. "???", 실루엣, 블러 처리.  
  - **참가** 버튼 → 참가 플로우 (내 슬롯 선택 후 확정).

- **참가 확정 후 (방 안)**  
  - **비로소** 호스트/게스트 디지몬 정보 표시 (이름, 스프라이트, 파워).  
  - 준비 버튼 → Ably `ready`. 둘 다 ready 시 배틀 시작 → BattleScreen.

- **호스트 대기 화면**  
  - 내 디지몬 정보, "다른 테이머가 참가할 때까지 대기 중…", 방 나가기(취소).

### 2.6 끊김 처리

- **기본**: 끊긴 쪽 **패배**, 상대 **승리**.  
  - 상대가 **N초(예: 90초)** 안에 `round`/행동을 안 보내면 타임아웃 → 내 승리.  
  - 또는 **Ably presence**로 상대가 채널에서 나가면 → 상대 이탈 = 내 승리.
- **결과 반영**: Firestore `status: finished`, `winner`, (선택) `disconnectReason`. 양쪽 슬롯 `battles`/`battlesWon`/`battlesLost` 반영.
- **(선택) 재접속 대기**: 끊김 감지 시 60초 타이머. 그 안에 `rejoined` 오면 배틀 재개; 지나면 끊긴 쪽 패배.

### 2.7 판정 (라운드)

- **공유 시드**: `roundSeed = f(roomSeed, roundIndex)`.  
  - `simulateOneRound(roundIndex, userPower, enemyPower, roundSeed)` 추가 — 기존 `simulateBattle`를 라운드 단위로 분리하거나 시드 기반 RNG 사용.
- 호스트가 1라운드 결과 계산 후 Ably `round` publish → 양쪽 동일 로그로 BattleScreen 재생.

---

## 3. 덱 빌딩 배틀

### 3.1 카드 정의 (`src/data/battleCards.js`)

**1단계 (최소 2~3장)**

| 카드 ID | 이름(한글) | 효과 | 덱당 제한 |
|---------|------------|------|-----------|
| attack | 기본 공격 | 기존 hitRate로 명중 시 1히트 | 5장 |
| defend | 방어 | 이 턴 받는 공격 1회 무효 | 2장 |
| heavy_attack | 강타 | 명중률 -15%, 성공 시 2히트 | 1장 |

**추가 카드 (단계적)**

| 카드 ID | 이름(한글) | 효과 |
|---------|------------|------|
| quick_attack | 빠른 공격 | 명중률 +10%, 1히트 |
| snipe | 저격 | 명중률 +5%, 방어 시 50%로 1히트 가능 |
| counter | 반격 | 방어 + 상대 공격 시 명중하면 1히트 반환 |
| guard | 철벽 | 받는 공격 1회 무효, 다음 턴 내 명중률 +5% |
| finisher | 필살기 | 명중률 70% 고정, 성공 시 2히트. 배틀당 1회 |
| all_in | 올인 | 명중률 +20%, 1히트. 실패 시 내가 1히트 |
| heal | 회복 | 공격 없음, 받은 히트 1 회복. 제한 있음 |

### 3.2 방어 설계

- **역할**: "한 턴 버티기" — 3히트 직전에 사용.
- **무한 방어 방지**: 덱에 **defend 2~4장**만 넣을 수 있게 하여, 다 쓰면 방어 불가. 또는 방어 = "명중률 50%" 등 부분 방어.
- **왜 방어를 쓰냐**: 횟수 제한이면 "죽기 직전 1~2턴만" 아껴 쓸 때 의미 있음.

### 3.3 덱 저장

- **위치**: 슬롯 문서 또는 `digimonStats` 하위.
- **필드**: `battleDeck: string[]` (카드 ID 배열, 예: `['attack','attack','attack','defend','defend']`).
- **기본 덱**: 값 없으면 기본 덱 사용 (attack 5 + defend 2 등).

### 3.4 배틀 플로우 (덱)

- 시작: 양쪽 덱 셔플, **초기 핸드** N장 드로우 (예: 3장).
- 매 라운드: 손패에서 **1장 선택** → (실시간이면 Ably로 `choice` 전송) → **resolveCardRound(내 카드, 상대 카드, 파워 등)** → hit/방어 적용.
- 사용한 카드 버림, **드로우 1장** (덱 비면 버린 카드 셔플 후).
- 3히트 시 종료.

### 3.5 덱 빌딩 UI

- 메뉴에 "배틀 덱 편집" (또는 "덱 빌딩"). 현재 슬롯의 `battleDeck` 로드.
- 카드 풀 목록 + 현재 덱 목록. 추가/제거, `maxInDeck`·덱 최대 장수 제한.
- 저장 시 슬롯/디지몬에 `battleDeck` 반영.

---

## 4. 온라인 + 덱 함께 쓸 때

- 매 라운드 **선택**: "내가 낸 카드 ID"를 Ably로 전송. 예: `{ type: 'choice', roundIndex, cardId: 'attack' }`.
- **판정**: 호스트가 두 카드 수신 후 `resolveCardRound` 실행 → `round` 결과 publish. (또는 서버가 판정.)
- 조작 방지: 선택만 클라이언트, 판정은 공유 시드 또는 서버.

---

## 5. 조작 방지 요약

| 요소 | 대응 |
|------|------|
| 내 스탯 | 방/참가 시 Firestore 슬롯에서 스냅샷만 사용, 클라이언트 임의 수정 불인정 |
| 난수 | 공유 시드 또는 서버 1라운드 판정 |
| 승패/라운드 결과 | 서버 판정 또는 상대도 동일 시드로 검증 |
| 방 목록에서 상대 정보 | 블러/숨김 — 참가 후에만 노출 |

---

## 6. 관련 파일

- 배틀 계산: `digimon-tamagotchi-frontend/src/logic/battle/calculator.js`, `hitrate.js`, `types.js`
- 배틀 UI: `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx`, `ArenaScreen.jsx`
- 실시간: Ably 연동 문서, AblyContext
- 방 패턴 참고: `digimon-tamagotchi-frontend/docs/JOGRESS_ONLINE_DESIGN.md`
- 기존 배틀 분석: `docs/BATTLE_SYSTEM_ANALYSIS.md`

---

## 7. 체크리스트 (구현 시)

- [ ] Firestore `realtime_battle_rooms` 스키마 및 Rules
- [ ] 방 목록 UI (대기 중, 호스트 디지몬 블러)
- [ ] 방 생성 / 참가 / 준비 플로우
- [ ] Ably 채널 구독, ready/round/result 메시지
- [ ] simulateOneRound(시드) 또는 서버 판정
- [ ] BattleScreen 실시간 모드 (round 메시지로 로그 누적 재생)
- [ ] 끊김 감지 및 타임아웃/이탈 = 패배 처리
- [x] `battleCards.js` 카드 정의, 기본 덱
- [x] 슬롯에 `battleDeck` 저장/로드
- [x] DeckBuildingModal (덱 편집)
- [x] resolveCardRound (덱 배틀 판정 함수 구현), 덱 배틀 플로우(실시간/퀘스트 연동은 추후)
- [ ] (선택) 재접속 60초 대기
