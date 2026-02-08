# 케어미스 이력 vs 부상 이력 중복 차이

## 현상

- **케어미스 발생 이력**: 같은 사유·같은 시각 로그가 2~3건 중복 (예: "배고픔 콜 10분 무시" 17:14가 여러 건, "[과거 재구성]" 포함).
- **부상 이력**: 중복 없이 1건만 쌓임.

## 원인 비교

### 부상 이력이 중복되지 않는 이유

1. **틱에서 조건이 “한 번만” true**
   - 조건: `(updatedStats.poopCount || 0) > oldPoopCount`
   - 똥이 7→8이 되는 **그 한 틱**에서만 true.
   - 다음 틱에서는 `prevStats.poopCount`가 이미 8이므로 조건이 false → 로그 추가 블록에 다시 안 들어감.

2. **로그 추가 경로가 명확**
   - 틱: `poopCount` 증가 시 1회만 `addActivityLog` 호출.
   - applyLazyUpdate: `alreadyHasBackdatedLog(..., 'POOP', timeToMax, 'Too much poop')`로 **동일 타임스탬프·동일 문구**가 있으면 추가 안 함.

3. **이벤트가 “순간” 하나로 정해짐**
   - “똥 8개가 된 시각”이 `lastMaxPoopTime` 하나로 고정되어, 같은 이벤트가 여러 번 인식되지 않음.

### 케어미스 이력이 중복되던 이유

1. **틱에서 조건이 “여러 틱” true일 수 있음**
   - 조건: `(updatedStats.careMistakes || 0) > oldCareMistakes`
   - 타임아웃 시 `checkCallTimeouts`에서 careMistakes를 올리고 `setDigimonStats(updatedStats)`를 반환하지만, **React가 상태를 반영하기 전에 다음 틱**이 돌 수 있음.
   - 그때는 `prevStats`가 아직 이전 값(stale)이라, 같은 타임아웃인데도 `careMistakes > oldCareMistakes`가 **연속 두 틱** true → 로그를 두 번 넣음.

2. **두 경로에서 같은 이벤트 로그 추가**
   - **틱**: `"케어미스(사유: 배고픔 콜 10분 무시): 1 → 2"` + `timeoutOccurredAt`
   - **applyLazyUpdate**: `"케어미스(사유: 배고픔 콜 10분 무시) [과거 재구성]"` + `timeoutOccurredAt`
   - 로드/액션 시 applyLazyUpdate가 돌 때, 넘겨받은 `activityLogs`에 틱에서 넣은 로그가 아직 없으면 “[과거 재구성]”을 한 번 더 넣음.

3. **addActivityLog 쪽 중복 체크의 한계**
   - `hasDuplicateCareMistakeLog`는 **넘겨받은 배열**만 봄.
   - 틱이 연속으로 돌 때, 두 번째 틱의 `currentLogs`는 아직 첫 틱에서 추가한 로그가 반영되지 않은(같은 클로저/이전 스냅샷) 배열일 수 있어, “이미 있음”으로 안 잡힘.

## 적용한 해결 (케어미스 쪽만)

1. **틱에서 “같은 이벤트” 1회만 로그**
   - `lastAddedCareMistakeKeysRef`(Set)에 `timeoutOccurredAt` + 호출 타입(hunger/strength/sleep)을 키로 저장.
   - 케어미스 로그를 넣기 전에 해당 키가 이미 있으면 **추가하지 않음**.
   - React 상태가 한 틱 늦게 반영되어 같은 타임아웃으로 두 번 들어와도, ref는 이미 갱신되어 있어 한 번만 로그가 쌓임.

2. **기존 방어 로직 유지**
   - applyLazyUpdate: `alreadyHasBackdatedLog` + `alreadyHasLogInWindow` + `callStatus.isLogged`로 “[과거 재구성]” 중복 방지.
   - addActivityLog: `hasDuplicateCareMistakeLog`로 동일 사유·±2분 윈도우 내 중복 방지.

## 요약 표

| 항목           | 부상 이력                    | 케어미스 이력 (수정 전)              | 케어미스 이력 (수정 후)     |
|----------------|-----------------------------|--------------------------------------|-----------------------------|
| 틱 조건        | `poopCount > oldPoopCount`  | `careMistakes > oldCareMistakes`     | 동일                        |
| 조건 true 횟수 | 7→8 되는 한 틱만            | 상태 지연으로 연속 2틱 가능          | ref로 “이미 추가한 이벤트” 1회만 |
| 추가 경로      | 틱 1회 + applyLazyUpdate(가드) | 틱(여러 번) + applyLazyUpdate(가드)  | 틱 1회(ref) + applyLazyUpdate(가드) |
| 이벤트 식별    | lastMaxPoopTime             | timeoutOccurredAt + callType         | ref 키 = timeoutOccurredAt-callType |

이렇게 케어미스 쪽만 “같은 타임아웃 이벤트는 ref로 한 번만 로그”를 보장해, 부상 이력처럼 중복 없이 1건만 쌓이도록 맞춰 두었습니다.
