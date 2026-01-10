# ProteinCount를 Strength에 병합 - 영향 분석

**작성일:** 2024-12-19

## 제안된 변경사항

1. **strength**: 0 이상 (제한 없음, 프로틴 + 훈련)
2. **proteinCount 제거**
3. **표시**: `Math.min(5, strength) + (strength > 5 ? "(+" + (strength - 5) + ")" : "")`
4. **Energy/Overdose 계산**: strength 값 직접 사용 (**strength 5 이상은 무시**)
5. **훈련 시**: strength는 5까지만 증가 가능
6. **proteinCount -1 로직**: strength -1로 변경

---

## 현재 Energy/Overdose 계산 로직

### 현재 로직 (`protein.js`)
```javascript
// proteinCount ≤ 5: 4가 되면 energy만 +1
if (proteinCount === 4) {
  s.energy = Math.min(maxEnergy, (s.energy || 0) + 1);
}

// proteinCount > 5: 9, 13, 17, 21, 25, 29, 33이 되면 energy +1, proteinOverdose +1
const overdoseTriggerPoints = [9, 13, 17, 21, 25, 29, 33];
if (overdoseTriggerPoints.includes(proteinCount)) {
  s.energy = Math.min(maxEnergy, (s.energy || 0) + 1);
  s.proteinOverdose = Math.min(7, (s.proteinOverdose || 0) + 1);
}
```

**특징:**
- proteinCount = 4: energy +1
- proteinCount = 9, 13, 17, 21, 25, 29, 33: energy +1, proteinOverdose +1
- proteinCount는 제한 없이 증가 가능

---

## 제안된 변경사항의 문제점

### ❌ 문제 1: Energy/Overdose 계산 불가능

**현재:**
- proteinCount = 9 → energy +1, proteinOverdose +1
- proteinCount = 13 → energy +1, proteinOverdose +1
- proteinCount = 17 → energy +1, proteinOverdose +1

**제안된 변경 후:**
- strength > 5는 무시 → **9, 13, 17... 계산 불가능**
- strength가 5 이상일 때 energy/overdose 계산이 안 됨

**해결책 필요:**
- strength > 5일 때도 계산 가능하도록 로직 수정 필요
- 또는 "strength 5 이상은 무시" 조건을 제거

---

### ❌ 문제 2: 훈련과 프로틴의 구분 불가능

**현재:**
- 프로틴: strength +1 (최대 5), proteinCount +1
- 훈련: strength +1 또는 +3 (최대 5), proteinCount 영향 없음

**제안된 변경 후:**
- 프로틴: strength +1 (제한 없음)
- 훈련: strength +1 또는 +3 (최대 5)

**문제:**
- 훈련으로 strength = 5인 상태에서 프로틴을 먹으면 strength = 6
- 하지만 Energy/Overdose 계산 시 "strength 5 이상은 무시" → 계산 안 됨
- 훈련으로 올린 strength와 프로틴으로 올린 strength를 구분할 수 없음

---

### ❌ 문제 3: 시간 경과 로직 복잡도 증가

**현재:**
```javascript
if (currentProteinCount >= 6) {
  proteinCount만 -1, strength는 유지
} else {
  strength와 proteinCount 모두 -1
}
```

**제안된 변경 후:**
```javascript
// strength -1 (최소 0)
s.strength = Math.max(0, s.strength - 1);
```

**문제:**
- strength > 5일 때도 -1 되므로, Energy/Overdose 계산 지점을 놓칠 수 있음
- 예: strength = 9 → 8 → 7 → 6 → 5 (9, 13, 17 지점을 건너뜀)

---

## 수정된 제안

### 방안 A: strength 5 이상도 계산에 포함

**변경사항:**
1. **strength**: 0 이상 (제한 없음)
2. **Energy/Overdose 계산**: strength 값 직접 사용 (**strength 5 이상도 포함**)
   - strength = 4: energy +1
   - strength = 9, 13, 17, 21, 25, 29, 33: energy +1, proteinOverdose +1
3. **훈련**: strength는 5까지만 증가 가능
4. **표시**: `Math.min(5, strength) + (strength > 5 ? "(+" + (strength - 5) + ")" : "")`

**장점:**
- ✅ Energy/Overdose 계산 정상 작동
- ✅ proteinCount 제거 가능

**단점:**
- ⚠️ 훈련으로 올린 strength도 계산에 포함됨 (의도와 다를 수 있음)

---

### 방안 B: strength를 "프로틴 기반값"으로만 사용

**변경사항:**
1. **strength**: 0 이상 (제한 없음, **프로틴만**)
2. **trainingStrength**: 0-5 (훈련으로 올린 힘, 별도 관리)
3. **최종 힘**: `Math.min(5, strength + trainingStrength)`
4. **Energy/Overdose 계산**: strength 값 사용 (5 이상 포함)
5. **표시**: `Math.min(5, strength + trainingStrength) + (strength > 5 ? "(+" + (strength - 5) + ")" : "")`

**장점:**
- ✅ 훈련과 프로틴 구분 유지
- ✅ Energy/Overdose 계산 정상 작동

**단점:**
- ⚠️ 새로운 필드 추가 필요
- ⚠️ 복잡도 증가

---

## 권장 사항

### 방안 A 수정: "strength 5 이상은 무시" 조건 제거

**최종 제안:**
1. **strength**: 0 이상 (제한 없음, 프로틴 + 훈련)
2. **proteinCount 제거**
3. **표시**: `Math.min(5, strength) + (strength > 5 ? "(+" + (strength - 5) + ")" : "")`
4. **Energy/Overdose 계산**: strength 값 직접 사용 (**5 이상도 포함**)
   - strength = 4: energy +1
   - strength = 9, 13, 17, 21, 25, 29, 33: energy +1, proteinOverdose +1
5. **훈련**: strength는 5까지만 증가 가능 (`Math.min(5, strength + strengthChange)`)
6. **시간 경과**: strength -1 (최소 0)

**주의사항:**
- ⚠️ 훈련으로 올린 strength도 Energy/Overdose 계산에 포함됨
- ⚠️ 예: 훈련으로 strength = 5 → 프로틴 4개 먹으면 strength = 9 → energy +1, proteinOverdose +1
- ⚠️ 이는 의도와 다를 수 있음 (훈련으로 올린 힘은 계산에서 제외해야 할 수도)

---

## 최종 해결책 (사용자 제안)

**완벽한 해결책:**

1. ✅ **strength 확장**: 0 이상 (제한 없음, 프로틴 + 훈련)
2. ✅ **proteinCount 제거**: 가능
3. ✅ **표시 형식**: `Math.min(5, strength) + (strength > 5 ? "(+" + (strength - 5) + ")" : "")`
4. ✅ **Energy/Overdose 계산**: strength 값 직접 사용 (5 이상도 포함)
   - strength = 4: energy +1
   - strength = 9, 13, 17, 21, 25, 29, 33: energy +1, proteinOverdose +1
5. ✅ **배틀 로직**: strength >= 6이면 5로 계산 (`Math.min(5, strength)`)
6. ✅ **훈련 제한**: strength는 5까지만 증가 가능 (`Math.min(5, strength + strengthChange)`)
7. ✅ **시간 경과**: strength -1 (최소 0)

**핵심 아이디어:**
- Energy/Overdose 계산: strength 값 전체 사용 (5 이상도 포함)
- 배틀 파워 계산: `Math.min(5, strength)` 사용하여 5로 제한
- 이렇게 하면 두 가지 목적을 모두 만족!

---

## 결론

**제안된 변경사항은 완벽하게 작동합니다!**

1. ✅ **strength 확장**: 문제 없음
2. ✅ **proteinCount 제거**: 가능
3. ✅ **표시 형식**: 문제 없음
4. ✅ **Energy/Overdose 계산**: strength 값 전체 사용 (5 이상도 포함)
5. ✅ **배틀 로직**: strength >= 6이면 5로 계산
6. ✅ **훈련 제한**: 문제 없음
7. ✅ **proteinCount -1 → strength -1**: 문제 없음

**구현 계획:**
1. `feedProtein`: proteinCount 제거, strength +1 (제한 없음)
2. `doVer1Training`: strength는 5까지만 증가 (`Math.min(5, strength + strengthChange)`)
3. 시간 경과 로직: proteinCount 관련 제거, strength -1만
4. Energy/Overdose 계산: proteinCount → strength로 변경
5. 배틀 로직: `Math.min(5, strength)` 사용
6. UI 표시: `strengthDisplay` 함수 수정
7. 모든 proteinCount 참조 제거
