# 냉장고 기능 버그 수정 요약

**작성일:** 2026년 1월 28일  
**수정 완료:** ✅

## 🐛 발견된 문제

냉장고 상태(`isFrozen: true`)임에도 불구하고:
- 배고픔이 감소함 (배고픔 0 상태)
- 똥이 계속 생성됨 (똥 8개까지 차오름)
- 수명이 증가함 (사망까지 이어짐)
- 부상 방치 타이머가 진행됨

## 🔍 원인

**핵심 문제:** `applyLazyUpdate` 함수에서 냉장고 상태일 때 경과 시간을 0으로 처리하지만, **냉장고에 넣은 시간(`frozenAt`) 이후의 시간만 제외해야 함**

**시나리오:**
- `lastSavedAt = 10:00` (냉장고에 넣기 전 마지막 저장)
- `frozenAt = 11:00` (냉장고에 넣은 시간)
- `now = 12:00` (현재 시간)
- **기존 로직:** `isFrozen === true`이므로 경과 시간 = 0 (❌ 잘못됨)
- **올바른 로직:** `10:00 ~ 11:00` 사이의 1시간은 경과 시간에 포함되어야 함

## ✅ 수정 내용

### 1. `logic/stats/stats.js`의 `applyLazyUpdate` 수정

**위치:** 277-303줄

**변경 내용:**
- 냉장고 상태일 때 `frozenAt` 이후의 시간만 제외하도록 수정
- `frozenAt`이 `lastSavedAt`보다 이후인 경우, 냉장고에 넣기 전의 시간만 계산
- `frozenAt`이 `lastSavedAt`보다 이전이거나 같은 경우, 경과 시간 = 0

```javascript
// 냉장고 시간을 제외한 경과 시간 계산
let elapsedSeconds;
if (stats.isFrozen && stats.frozenAt) {
  const frozenTime = typeof stats.frozenAt === 'number' 
    ? stats.frozenAt 
    : new Date(stats.frozenAt).getTime();
  const lastSavedTime = lastSaved.getTime();
  
  if (frozenTime > lastSavedTime) {
    // 냉장고에 넣기 전의 시간만 계산
    elapsedSeconds = Math.floor((frozenTime - lastSavedTime) / 1000);
  } else {
    // 냉장고에 넣은 이후의 시간만 있었으므로 경과 시간 = 0
    elapsedSeconds = 0;
  }
  
  if (elapsedSeconds <= 0) {
    return { ...stats, lastSavedAt: now };
  }
} else {
  // 냉장고 상태가 아니면 일반 경과 시간 계산
  elapsedSeconds = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);
}
```

### 2. `data/stats.js`의 `applyLazyUpdate` 수정

**위치:** 298-330줄

**변경 내용:**
- `useGameData.js`에서 사용하는 `applyLazyUpdate` 함수도 동일하게 수정
- 냉장고 시간을 제외한 경과 시간 계산

**중요:** 두 파일 모두 수정 필요 (`logic/stats/stats.js`와 `data/stats.js`)

## 📊 수정 전/후 비교

### 수정 전
```javascript
if (stats.isFrozen) {
  return { ...stats, lastSavedAt: now }; // 경과 시간 = 0
}
```

**문제:**
- 냉장고에 넣기 전의 시간도 무시됨
- 냉장고에 넣은 후 오프라인 후 복귀 시 스탯이 변경되지 않음

### 수정 후
```javascript
if (stats.isFrozen && stats.frozenAt) {
  if (frozenTime > lastSavedTime) {
    // 냉장고에 넣기 전의 시간만 계산
    elapsedSeconds = Math.floor((frozenTime - lastSavedTime) / 1000);
  } else {
    // 냉장고에 넣은 이후의 시간만 있었으므로 경과 시간 = 0
    elapsedSeconds = 0;
  }
}
```

**해결:**
- 냉장고에 넣기 전의 시간은 정상적으로 계산됨
- 냉장고에 넣은 이후의 시간만 제외됨

## 🎯 예상 결과

### 수정 후 동작

1. **냉장고에 넣기 전:**
   - 정상적으로 스탯 변경 (배고픔 감소, 똥 생성 등)

2. **냉장고에 넣은 후:**
   - 모든 스탯 고정 (배고픔, 힘, 똥, 수명 등)
   - 호출 비활성화
   - 케어 실수 발생하지 않음

3. **냉장고에서 꺼낸 후:**
   - 시간이 다시 흐르기 시작
   - `lastSavedAt` 업데이트
   - `lastHungerZeroAt`, `lastStrengthZeroAt` 리셋

## 📝 수정된 파일

1. `digimon-tamagotchi-frontend/src/logic/stats/stats.js`
   - `applyLazyUpdate` 함수 수정

2. `digimon-tamagotchi-frontend/src/data/stats.js`
   - `applyLazyUpdate` 함수 수정

3. `docs/FRIDGE_BUG_ANALYSIS_AND_FIX.md`
   - 버그 분석 및 수정 문서

4. `docs/FRIDGE_BUG_FIX_SUMMARY.md`
   - 수정 요약 문서 (이 파일)

## ⚠️ 주의사항

1. **두 `applyLazyUpdate` 함수 모두 수정 필요**
   - `logic/stats/stats.js`와 `data/stats.js` 모두 수정됨 ✅

2. **테스트 필요**
   - 냉장고에 넣은 후 오프라인 후 복귀 시 스탯 변경 없음 확인
   - 냉장고에 넣기 전의 시간은 정상적으로 계산되는지 확인

3. **기존 데이터**
   - 이미 냉장고에 넣은 상태의 데이터는 수정 후 정상 작동할 것으로 예상

---

**관련 문서:**
- `docs/FRIDGE_FEATURE_ANALYSIS.md` - 냉장고 기능 분석
- `docs/FRIDGE_BUG_ANALYSIS_AND_FIX.md` - 버그 분석 및 수정 상세
