# Firebase 슬롯 저장 구조 및 개선 가이드

## 1. 🚨 '1초마다 업데이트' 문제 (시급 대응)

### 원칙: UI 업데이트와 서버 저장 분리
- **화면의 시간 흐름**: 1초 타이머는 React state(`setDigimonStats`)만 업데이트. Firestore 쓰기는 하지 않음.
- **서버 저장 시점**: **액션 기반** — 먹이 주기, 훈련, 배틀, 청소, 조명, 배경 설정, 사망/환생, **그리고 탭 이탈 시 1회**.

### 적용한 조치
| 조치 | 설명 |
|------|------|
| 1초 타이머 내 쓰기 금지 | `Game.jsx` setInterval 안에서는 `setDigimonStats`만 호출. `updateDoc`은 **사망 시 1회**만 호출. 주석으로 명시함. |
| 로드 시 쓰기 제거 | `useGameData.loadSlot`에서 Lazy Update 적용 후 `updateDoc` 호출 제거. 진입만 해도 문서가 갱신되던 문제 제거. |
| 탭 이탈 시 저장 | `visibilitychange`(탭 숨김)와 `beforeunload`(탭 닫기) 시 `setDigimonStatsAndSave(latestStatsRef.current)` 호출로, 마지막 스탯 저장 시도. |
| **배경 설정 저장 1초 루프 제거** | **원인:** `saveBackgroundSettings`가 `useGameData` 안에서 매 렌더마다 새로 생성됨 → 1초마다 `setDigimonStats`로 리렌더 → `useEffect([..., saveBackgroundSettings])`가 1초마다 실행 → `updateDoc(updatedAt)` 1초마다 호출. **해결:** `useGameData`에서 `saveBackgroundSettings`를 `useCallback`으로 감싸 참조를 고정. 배경을 실제로 바꿀 때만 effect가 실행되도록 함. |

### 참고: setInterval 내부에서 저장을 호출하는 코드 여부
- **없음.** 1초 타이머 콜백은 `setDigimonStats(prev => ...)`만 수행하며, 그 안에서 `updateDoc`을 부르는 경우는 **사망 감지 시 1회**뿐임.

---

## 2. 데이터 중복 및 비효율성

### 2.1 activityLogs
- **저장**: `digimonStats.activityLogs` 한 곳에만 저장. 루트에 별도 `activityLogs` 필드는 쓰지 않음.
- **로드**: 레거시 호환으로 `savedStats.activityLogs || slotData.activityLogs` fallback만 사용.

### 2.2 설정값 중복 (isLightsOn, wakeUntil)
- **문제**: 루트와 `digimonStats` 내부에 둘 다 두면, 한쪽만 갱신될 때 "불은 켜져 있는데 스탯은 자고 있는" 등 정합성 버그 가능.
- **적용**: `useGameData.saveStats`에서 Firestore에 쓸 때 **digimonStats에는 isLightsOn, wakeUntil를 넣지 않음.** 루트에만 저장. (`const { isLightsOn: _dropl, wakeUntil: _dropw, ...digimonStatsOnly } = ...`)

### 2.3 lastSavedAt (중복 제거 적용)
- **역할**: Lazy Update 계산용. “마지막으로 스탯이 실제로 저장된 시점”.
- **저장**: **루트에만** 저장. `saveStats` 시 `digimonStats`에서 `lastSavedAt`을 제거하고 루트 필드로만 전송.
- **로드**: `loadSlot`에서 `slotData.lastSavedAt || slotData.updatedAt || new Date()`로 읽어 `applyLazyUpdate`에 전달. 반환된 스탯에는 메모리용 `lastSavedAt`이 들어 있어 다음 저장까지 유지.

### 2.4 updatedAt
- **역할**: 문서 “마지막 수정 시각”. **실제 저장이 일어날 때만** 갱신.
- **갱신 위치**: `useGameData.saveStats`, 사망 시, 조명/배경/별명/슬롯 변경 등. 로드 직후에는 갱신하지 않음.

---

## 3. 로그(activityLogs) 비대화 대응

- **현재**: 로그가 `digimonStats.activityLogs` 배열로 문서 내부에 포함. 문서 최대 1MB 제한이 있으므로, 배틀/훈련을 수백 번 반복하면 슬롯 문서가 비대해질 수 있음.
- **권장 (향후 개선)**: 로그를 **서브컬렉션**으로 분리 저장.
  - 예: `users/{uid}/slots/slot5/logs` (문서 ID: 타임스탬프 또는 자동 ID)
  - 슬롯 문서에는 최근 N개 요약만 두거나, 로그는 서브컬렉션에서만 조회.

**상세**: 로그에 저장되는 항목(타입·발생 위치)과 서브컬렉션 분리 시 영향·마이그레이션 전략은 **[ACTIVITY_LOGS_AND_SUBCOLLECTION.md](./ACTIVITY_LOGS_AND_SUBCOLLECTION.md)** 참고.

현재는 기존 구조 유지. 로그가 수백 개 이상으로 늘어나는 사용 패턴이 확인되면 서브컬렉션 마이그레이션 검토.

---

## 4. 구조 정리 (Before / After)

### Before (중복 있던 구조)
```js
{
  activityLogs: [...],        // 루트 중복 (레거시, 쓰기는 안 함)
  isLightsOn: true,
  wakeUntil: ...,
  digimonStats: {
    activityLogs: [...],
    isLightsOn: true,         // 중복
    wakeUntil: ...,           // 중복
    ...
  }
}
```

### After (적용 후)
```js
{
  slotName: "슬롯5",
  version: "Ver.1",
  isLightsOn: true,           // 루트에만
  wakeUntil: ...,             // 루트에만
  lastSavedAt: ...,           // 루트에만 (digimonStats 내부 중복 제거됨)
  updatedAt: Timestamp,       // 실제 저장 시에만 갱신
  digimonStats: {
    // isLightsOn, wakeUntil, lastSavedAt 제거됨 (루트만 사용)
    activityLogs: [...],
    fullness: 0,
    age: 5,
    ...
  },
  backgroundSettings: { ... }
}
```

### 이상적 구조 (추가 개선 시 참고)
- **설정**: `settings: { isLightsOn, backgroundMode }` 등으로 묶을 수 있음.
- **날짜 형식**: `createdAt`, `birthTime`, `lastSavedAt` 등을 Number(ms) 또는 Firestore Timestamp로 통일 권장.
- **부분 업데이트**: 가능한 경우 `updateDoc(docRef, { "digimonStats.fullness": 5 })` 형태로 변경 필드만 수정해 쓰기 비용 절감.

---

## 5. updatedAt을 갱신하는 코드 위치 (참고)

- `useGameData.saveStats`: 먹이/훈련/배틀/청소 등 스탯 변경 후
- `Game.jsx`: 사망 시 로그 저장, `setSelectedDigimonAndSave`, **탭 이탈 시** (visibilitychange / beforeunload)
- `useGameHandlers`: 조명 토글 저장
- `useGameAnimations`: 청소 애니메이션 후 저장
- `useGameData.saveBackgroundSettings`: 배경 설정 저장
- `SelectScreen`: 슬롯 생성/수정/별명/순서 변경 시  
- **제거됨**: `useGameData.loadSlot` 내 로드 직후 `updateDoc`

---

## 6. 시간 표기 방식 불일치 (Time Format Inconsistency)

현재 문서 내 시간 관련 필드가 여러 형식으로 섞여 있음.

| 필드 | 현재 표기 | 권장 |
|------|-----------|------|
| `birthTime` | 숫자(ms) | 유지. 계산·비교에 가장 유리. |
| `createdAt` | 문자열 (한국어 로케일, 예: "2026. 2. 8. 오전 12:16:41") | **장기:** 숫자(ms) 저장 후 표시 시에만 포맷. 문자열이면 로케일/비교 이슈 가능. |
| `lastSavedAt` | Firestore Timestamp (저장 시) / 클라이언트 Date | **장기:** 숫자(ms)로 통일 시 `applyLazyUpdate` 등에서 일관 처리 가능. |
| `updatedAt` | Firestore Timestamp | 동일 유지 또는 숫자(ms) 통일. |
| `sleepMistakeDate` | 문자열 (영어 toDateString, 예: "Sun Feb 08 2026") | **장기:** `"YYYY-MM-DD"` 또는 해당일 0시 ms로 통일 시 정렬·비교 단순화. |

**요약:** 모든 날짜/시간을 **숫자(ms)** 또는 **Firestore Timestamp** 중 하나로 통일하면 통계·버그 추적 시 혼란이 줄어듦. 문자열("오전 12시" vs "AM 12") 비교는 피하는 것이 좋음.

### 6.1 적용 완료 (날짜·정리 로직)

| 항목 | 적용 내용 |
|------|-----------|
| **cleanObject** | `useGameData.saveStats`에서 Firestore에 쓸 `digimonStats` 직전에 1depth null/undefined 필드 제거. `spriteBasePath: null` 등 불필요 데이터 누적 방지. |
| **createdAt 숫자(ms)** | 새 슬롯 생성 시 `createdAt: now.getTime()` 저장. 표시는 `formatSlotCreatedAt(slot.createdAt)`로 숫자→로케일, 문자열(구 데이터)은 그대로 표시. |
| **sleepMistakeDate 해당일 0시 ms** | 1초 타이머에서 일자 변경 시 `sleepMistakeDate = new Date(y,m,d).getTime()`, 수면 케어 미스 발생 시에도 동일. 비교 시 숫자면 `!== todayStartMs`, 문자열(구 데이터)이면 `!== toDateString()` 호환. |

---

## 7. 기타 개선 포인트

- **updatedAt vs lastSavedAt 차이**: 두 값이 1분 정도 차이 나는 것은, 저장이 “액션 시점”과 “탭 이탈/visibilitychange 시점”에서 각각 한 번씩 일어날 수 있기 때문. 1초마다 갱신이 아니라면 정상 범위.
- **digimonNickname**: 현재 루트에 있음. 슬롯에 디지몬이 없을 때도 필요 없다면 `digimonStats` 안으로 옮기면 슬롯 메타와 “현재 디지몬 상태”가 더 명확히 구분됨. (선택)
- **spriteBasePath: null**: Ver.1은 `spriteBasePath`가 없고 Ver.2만 있음. null을 저장하지 않고, 값이 있을 때만 필드를 넣으면 문서 크기 절감 가능. (저장 시 undefined/null 필드 생략)

---

## 8. 다음 단계 제안

1. **저장 로직**: **액션 기반 + 탭 이탈 시 1회** 유지. 1초 주기 저장 없음.
2. **로그 비대화**: 로그가 매우 많아지면 서브컬렉션(`slots/slotN/logs`) 분리 검토.
3. **날짜/시간 필드**: **createdAt**, **sleepMistakeDate**는 숫자(ms) 적용 완료. 나머지는 점진적으로 **Number(ms)** 또는 Firestore **Timestamp**로 통일 가능.
4. **null 필드 생략**: **cleanObject** 적용 완료. 저장 시 null/undefined 제거로 문서 크기·가독성 개선.
