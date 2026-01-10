# 상처원인 표시 버그 분석

## 🐛 문제 상황

**현상:**
- 똥 8개로 부상 발생 → 상처원인: "똥 8개" 표시 (정상)
- 똥을 다 치움 → 상처원인: "배틀"로 변경됨 (버그)
- 실제로는 배틀로 인한 부상이 아님

**예상 동작:**
- 부상 발생 시 원인을 저장하고, 똥을 치워도 원래 원인이 표시되어야 함

**실제 동작:**
- 현재 `poopCount`만 확인하여 똥을 치우면 "배틀"로 표시됨

## 📋 코드 분석

### 1. `HealModal.jsx` 상처원인 표시 로직 (115줄)

```javascript
상처원인: {digimonStats.poopCount >= 8 ? '똥 8개' : '배틀'}
```

**문제점:**
- 현재 `poopCount`만 확인
- 똥을 치우면 `poopCount < 8`이 되어 "배틀"로 표시됨
- 부상 발생 시점의 원인을 저장하지 않음

### 2. 부상 발생 로직

#### 똥 8개로 부상 발생 (`data/stats.js` 390-397줄)

```javascript
// 똥 8개가 되면 부상 상태로 설정
if (!updatedStats.isInjured) {
  updatedStats.isInjured = true;
  updatedStats.injuredAt = timeToMax;
  updatedStats.injuries = (updatedStats.injuries || 0) + 1;
  updatedStats.healedDosesCurrent = 0;
  // ⚠️ injuryReason 저장하지 않음
}
```

#### 배틀로 부상 발생 (`useGameActions.js` 1026-1031줄, 1106-1111줄)

```javascript
if (isInjured) {
  finalStats.isInjured = true;
  finalStats.injuredAt = Date.now();
  finalStats.injuries = (battleStats.injuries || 0) + 1;
  finalStats.healedDosesCurrent = 0;
  // ⚠️ injuryReason 저장하지 않음
}
```

### 3. 똥 청소 로직 (`useGameActions.js` 542-580줄)

```javascript
const handleCleanPoop = async () => {
  // ...
  updatedStats.poopCount = 0;
  // ⚠️ isInjured가 false가 되면 injuryReason도 리셋되어야 함
  // 하지만 injuryReason이 없어서 문제 없음 (다만 표시 로직이 잘못됨)
}
```

## 🔍 문제 원인

**핵심 문제:**
- 부상 발생 시 원인(`injuryReason`)을 저장하지 않음
- `HealModal`에서 현재 `poopCount`만 확인하여 원인을 추론
- 똥을 치우면 `poopCount < 8`이 되어 잘못된 원인 표시

## 💡 해결 방안

### 해결책 1: `injuryReason` 필드 추가 (권장)

**장점:**
- 부상 발생 시점의 원인을 정확히 저장
- 똥을 치워도 원래 원인 유지
- 명확하고 확장 가능

**구현:**
1. 부상 발생 시 `injuryReason` 저장
   - 똥 8개: `injuryReason = 'poop'`
   - 배틀: `injuryReason = 'battle'`
2. `HealModal`에서 `injuryReason` 확인
3. 치료 완료 시 `injuryReason` 리셋

### 해결책 2: `activityLogs` 확인

**장점:**
- 추가 필드 없이 구현 가능
- 이력 추적 가능

**단점:**
- 로그 파싱 필요
- 성능 오버헤드
- 로그가 없으면 추적 불가

### 해결책 3: `injuredAt` 시점의 `poopCount` 저장

**장점:**
- 간단한 구현

**단점:**
- `poopCountAtInjury` 같은 필드 추가 필요
- 배틀 부상과 구분 어려움

## 🎯 권장 해결책

**해결책 1: `injuryReason` 필드 추가**

1. 부상 발생 시 `injuryReason` 저장
2. `HealModal`에서 `injuryReason` 확인하여 표시
3. 치료 완료 시 `injuryReason` 리셋

## 📊 수정 전/후 비교

### 수정 전

| 상황 | poopCount | injuryReason | 표시 |
|------|-----------|--------------|------|
| 똥 8개 부상 | 8 | 없음 | "똥 8개" ✅ |
| 똥 치운 후 | 0 | 없음 | "배틀" ❌ |

### 수정 후

| 상황 | poopCount | injuryReason | 표시 |
|------|-----------|--------------|------|
| 똥 8개 부상 | 8 | 'poop' | "똥 8개" ✅ |
| 똥 치운 후 | 0 | 'poop' | "똥 8개" ✅ |
| 배틀 부상 | 0 | 'battle' | "배틀" ✅ |

## ✅ 결론

**문제 원인:**
- 부상 발생 시 원인을 저장하지 않음
- `HealModal`에서 현재 `poopCount`만 확인하여 원인 추론
- 똥을 치우면 잘못된 원인 표시

**해결 방법:**
- `injuryReason` 필드를 추가하여 부상 발생 시 원인 저장
- `HealModal`에서 `injuryReason` 확인하여 표시
- 치료 완료 시 `injuryReason` 리셋
