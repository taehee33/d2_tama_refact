# 계정 설정 화면 개선 및 도감 마스터 칭호·슬롯 확장 설계

도감 완성 보상(버전별 마스터 칭호 + 슬롯 확장)과 계정 전역 설정 구조 변경에 대한 분석 및 UI/데이터 구조 추천입니다.

**구현 상태 (2026-03-08):** 도감 마스터 칭호 및 슬롯 확장(마스터당 +5)까지 구현 완료. `userProfileUtils`, `logic/encyclopediaMaster`, `useEncyclopedia` 연동, SelectScreen maxSlots 반영, AccountSettingsModal 칭호·슬롯 표시 적용.

---

## 1. 현재 구조 요약

### 1.1 계정 설정 화면 (AccountSettingsModal)

| 섹션 | 내용 | 데이터 소스 |
|------|------|-------------|
| 테이머명 | 입력란, 중복 확인, 저장/기본값 복구 | `users/{uid}.tamerName` (tamerNameUtils) |
| 현재 테이머명 표시 | "현재 테이머명: 한태희" | 동일 |
| Discord 알림 | 웹훅 URL, "알람 받기" 체크박스, 알림 설정 저장 | `users/{uid}/settings/main.discordWebhookUrl`, `isNotificationEnabled`, `siteTheme` (userSettingsUtils, 루트 fallback 호환) |

- **한계**: 칭호/슬롯 정보 없음, 전역 설정(테마·버프 등)이 계정 단위로 분리되어 있지 않음.

### 1.2 Firestore `users/{uid}` 문서 (현재)

- `tamerName`, `displayName`, `updatedAt`
- `discordWebhookUrl`, `isNotificationEnabled`
- `encyclopedia`: 루트 필드는 마이그레이션 fallback 용도로만 남아 있고, 신규 저장은 `users/{uid}/encyclopedia/{version}` 문서 우선
- 칭호(achievements), 최대 슬롯(maxSlots), 전역 설정(settings) **없음**.

### 1.3 슬롯 수

- **SelectScreen**: `MAX_SLOTS = 10` 하드코딩.
- **Firestore**: SelectScreen에서 `getDocs(slotsRef)`로 **limit 없이** 전체 슬롯 조회 후 클라이언트에서 처리.
- **UserSlotRepository**: `getUserSlots(userId, maxSlots=10)`, `findEmptyUserSlot(userId, maxSlots=10)` — 호출부에서 `maxSlots`를 사용자별로 넘기지 않음.

---

## 2. 목표 기능

1. **버전별 도감 완성 보상**
   - Ver.1 도감 완성 → `ver1_master` 칭호 + 슬롯 5개 추가.
   - Ver.2 도감 완성 → `ver2_master` 칭호 + 슬롯 5개 추가.
2. **UI**: 사용자명(테이머명) 옆/주변에 칭호 표시 (예: `[Ver.1 Master] 한태희`).
3. **계정 설정 확장**: 전역 설정(테마, 진화 버프 등)을 `settings` 객체로 관리하고, 계정 설정 화면에서 편집 가능하게.

---

## 3. 데이터 구조 추천

### 3.1 `users/{uid}` 확장

```text
users/{uid}
├── tamerName: string | null
├── displayName: string
├── updatedAt: Timestamp
├── discordWebhookUrl: string | null
├── isNotificationEnabled: boolean
├── achievements: string[]              // 신규. 예: ["ver1_master", "ver2_master"]
├── maxSlots: number                    // 신규. 기본값 2, 도감 마스터당 +5 (또는 기본 10, 마스터당 +5)
└── settings: {                         // 신규. 전역 설정
      isEvolutionBuffEnabled?: boolean,
      theme?: "light" | "dark" | "system",
      // 추후: notifyQuietHoursStart, notifyQuietHoursEnd, profileImageUrl 등
    }

users/{uid}/encyclopedia/{version}
└── { [digimonId]: EncyclopediaEntry }  // 예: Ver.1, Ver.2
```

- **achievements**: 도감 완성 시에만 추가. 중복 방지로 배열에 없을 때만 `ver1_master` / `ver2_master` push.
- **maxSlots**: 기본값을 2로 두고 도감 마스터당 +5 하거나, 현재처럼 기본 10으로 두고 마스터당 +5로 상한만 늘릴 수 있음. (기획에 따라 선택.)
- **settings**: 기존 `discordWebhookUrl`, `isNotificationEnabled`를 `settings` 안으로 옮길지는 선택 사항.  
  - 옮기면: `settings.discordWebhookUrl`, `settings.isNotificationEnabled`로 통일.  
  - 안 옮기면: 기존 필드는 유지하고, 새 전역 설정만 `settings`에 추가해도 됨.

### 3.2 도감 “완성” 정의

- **Ver.1 완성**: `encyclopedia["Ver.1"]`에서, Ver.1 도감 목록(EncyclopediaModal의 `getDigimonList("Ver.1")`)에 있는 모든 ID가 **isDiscovered**인 경우.
- **Ver.2 완성**: 동일하게 `getDigimonList("Ver.2")` 기준으로 `encyclopedia["Ver.2"]` 전원 발견.
- 도감 완성 시점에 한 번만:
  - `achievements`에 해당 `ver*_master` 없으면 추가.
  - `maxSlots`를 증가 (예: +5).

도감 완성 체크/보상 부여는 **도감 저장 시**(예: `saveEncyclopedia` 호출 후) 또는 **계정 설정/도감 모달 진입 시**에 체크해서 부여하면 됨.

---

## 4. 계정 설정 화면 수정 제안 (스크린샷 기준)

### 4.1 테이머명 섹션

- **상단 또는 라벨 옆에 칭호 표시**
  - 예: `테이머명` 라벨 옆에 배지 형태로 `[Ver.1 Master]`, `[Ver.2 Master]` 표시 (획득한 것만).
  - 또는 "현재 테이머명" 아래 한 줄 추가:
    - `현재 테이머명: 한태희`
    - `칭호: [Ver.1 Master] [Ver.2 Master]` (없으면 "칭호 없음" 또는 미표시)

- **슬롯 정보 한 줄**
  - 예: `슬롯: 7/12 (기본 2 + 도감 마스터 10)`  
  - 또는 `사용 가능 슬롯: 12개 (도감 마스터 보너스 +10)`  
  - 목적: 도감 완성 보상이 슬롯 확장임을 사용자에게 명확히 전달.

### 4.2 Discord 알림 섹션

- 유지: 웹훅 URL, "알람 받기" 체크박스, "알림 설정 저장" 버튼.
- Discord/외부 알림 메시지 포맷에서 **테이머명 앞에 칭호**를 붙이도록 권장:
  - 예: `[Ver.1 Master] 테이머 혜빈` (메시지를 만드는 쪽이 `users/{uid}.achievements`와 `tamerName`을 읽어서 조합).

### 4.3 전역 설정 섹션 (신규)

- **settings** 구조에 맞춰 UI 추가:
  - 예: "진화 버프 사용" 체크박스 → `settings.isEvolutionBuffEnabled`
  - 예: "테마" 선택 (라이트/다크/시스템) → `settings.theme`
- 저장 시 `users/{uid}/settings/main` 문서만 업데이트하고, 마이그레이션 기간 동안은 루트 `users/{uid}` 값을 fallback으로 읽는다.

### 4.4 배치 순서 제안

1. **테이머명** (입력 + 중복 확인 + 저장/기본값 복구)  
2. **현재 테이머명** + **칭호** (한 줄 또는 두 줄)  
3. **슬롯** (현재/최대 또는 사용 가능 슬롯 설명)  
4. **전역 설정** (진화 버프, 테마 등)  
5. **Discord 알림** (웹훅 URL, 알람 받기, 저장)  
6. **닫기**

---

## 5. 슬롯 확장 로직

- **기본 maxSlots**: 10 (기존 앱과 동일 유지). 도감 마스터당 +5.
- **도감 완성 시**:  
  - `ver1_master` 획득 시 `maxSlots += 5`  
  - `ver2_master` 획득 시 `maxSlots += 5`  
- **사용처**
  - SelectScreen: 슬롯 목록을 가져올 때 `users/{uid}.maxSlots`를 사용해 **limit(maxSlots)** 적용.  
  - 새 슬롯 생성 시: `slots.length < maxSlots`일 때만 생성 허용.  
  - 빈 슬롯 찾기: `UserSlotRepository.findEmptyUserSlot(userId, maxSlots)`에 사용자별 `maxSlots` 전달.
- **표시**: "슬롯 목록 (현재 N개 / 최대 M개)"에서 M을 사용자별 `maxSlots`로 표시.

---

## 6. 구현 시 영향 파일

| 구분 | 파일 | 변경 요약 |
|------|------|-----------|
| 데이터·유틸 | `userSettingsUtils.js` | `getUserSettings`에 achievements, maxSlots, settings 반환; 저장 함수 확장 |
| 데이터·유틸 | `tamerNameUtils.js` 또는 신규 `userProfileUtils.js` | maxSlots, achievements 읽기/갱신 (도감 완성 시 호출) |
| 도감 | `useEncyclopedia.js` | 저장 후 도감 완성 여부 판단, achievements·maxSlots 업데이트 |
| 도감 완성 판정 | 신규 `logic/encyclopediaMaster.js` 등 | Ver.1/Ver.2별 “전원 발견” 여부 순수 함수 |
| 슬롯 | `SelectScreen.jsx` | maxSlots를 users 문서에서 로드, 슬롯 개수 제한·표시에 반영 |
| 슬롯 | `UserSlotRepository.js` | getUserSlots/findEmptyUserSlot 호출 시 사용자별 maxSlots 전달 |
| UI | `AccountSettingsModal.jsx` | 칭호·슬롯 정보 표시, 전역 설정(settings) 섹션 추가 |
| Discord 등 | (알림 메시지 생성 측) | 테이머명 앞에 achievements 기반 칭호 문자열 조합 |

---

## 7. 정리

- **도감 완성 보상**: `users/{uid}`에 `achievements`, `maxSlots`를 두고, 버전별 도감 완성 시에만 갱신.
- **계정 설정 화면**: 테이머명 옆/아래에 **칭호**, **슬롯 수(현재/최대)** 를 넣고, **전역 설정(settings)** 섹션을 추가하면, 추천하신 “사용자 구조 변경”과 “버전별 마스터 칭호·슬롯 확장”을 한 번에 반영할 수 있습니다.
- Discord 알림 메시지에는 `[Ver.1 Master] 테이머명` 형태로 칭호를 붙이도록 메시지 생성 쪽만 수정하면 됩니다.

이 설계를 기준으로 단계별로 데이터 구조 → 도감 완성 체크/보상 → 계정 설정 UI 순으로 구현하시면 됩니다.
