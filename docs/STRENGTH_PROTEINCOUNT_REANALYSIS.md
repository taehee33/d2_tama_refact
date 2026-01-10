# Strength와 ProteinCount 재분석

**작성일:** 2024-12-19

## 현재 로직 분석

### 1. 프로틴 먹기 (`feedProtein`)
```javascript
// strength +1 (최대 5)
if (currentStrength < 5) {
  s.strength = currentStrength + 1;
}
// proteinCount +1 (제한 없음)
s.proteinCount = (s.proteinCount || 0) + 1;

// proteinCount로 energy/overdose 계산
if (proteinCount === 4) { energy +1 }
if (proteinCount in [9, 13, 17, 21, 25, 29, 33]) { energy +1, proteinOverdose +1 }
```

### 2. 훈련 (`doVer1Training`)
```javascript
// strength +1 또는 +3 (최대 5)
s.strength = Math.min(5, (s.strength || 0) + strengthChange);
// proteinCount는 영향 없음
```

### 3. 시간 경과로 strength 감소
```javascript
if (currentProteinCount >= 6) {
  // proteinCount만 -1, strength는 유지
  s.proteinCount = Math.max(0, currentProteinCount - 1);
} else {
  // strength와 proteinCount 모두 -1
  s.strength = Math.max(0, s.strength - 1);
  s.proteinCount = Math.max(0, currentProteinCount - 1);
}
```

### 4. 누워있기
```javascript
// proteinCount만 -1
s.proteinCount = Math.max(0, currentProteinCount - 1);
```

### 5. 진화 시
```javascript
// 둘 다 리셋
strength: 0
proteinCount: 0
```

---

## 문제점 분석

### 핵심 문제: 사실상 같은 값을 따로 관리

**현재 상황:**
1. **proteinCount <= 5일 때:**
   - 프로틴 먹기: strength +1, proteinCount +1
   - 시간 경과: strength -1, proteinCount -1
   - **결과: strength ≈ proteinCount** (훈련 제외)

2. **proteinCount > 5일 때:**
   - 프로틴 먹기: strength 유지(5), proteinCount +1
   - 시간 경과: strength 유지(5), proteinCount -1
   - **결과: strength = 5 (고정), proteinCount만 변동**

3. **훈련:**
   - strength만 증가, proteinCount는 영향 없음
   - **문제: 훈련으로 strength = 5인데 proteinCount = 3이면 불일치 발생**

### 실제 사용처

**proteinCount의 용도:**
1. Energy 회복 계산 (proteinCount = 4, 또는 9, 13, 17, 21, 25, 29, 33)
2. Protein Overdose 계산 (proteinCount > 5일 때 특정 지점에서 증가)
3. UI 표시 (proteinCount > 5일 때 "5(+3)" 형태)

**strength의 용도:**
1. 배틀 파워 계산
2. 진화 조건 체크
3. 호출 시스템 (strength = 0일 때)

---

## 결론: proteinCount는 사실상 strength의 "프로틴 기반값"

### 현재 로직의 의미

**proteinCount의 실제 의미:**
- "프로틴으로 올린 strength"의 누적 카운터
- strength 감소 시 proteinCount도 감소 → **같은 값을 추적**
- proteinCount >= 6일 때만 strength와 분리됨 (strength는 5로 고정)

**문제:**
- proteinCount와 strength가 거의 동일한 역할
- 훈련으로 올린 strength는 proteinCount와 무관 → 불일치 가능
- 두 값을 따로 관리하는 것이 불필요한 복잡성

---

## 개선 방안: proteinCount를 strength에 병합

### 방안: strength를 확장하여 proteinCount 역할 통합

**새로운 구조:**
```javascript
// strength: 0-5 (기본 힘, 프로틴 + 훈련)
// strengthOver: 0 이상 (프로틴으로 올린 초과분, proteinCount > 5일 때)
// 최종 proteinCount = strength + strengthOver
```

**변경사항:**
1. **proteinCount 제거**
2. **strength**: 0-5 (프로틴 + 훈련으로 올린 힘)
3. **strengthOver**: 0 이상 (프로틴으로 올린 초과분, proteinCount > 5일 때의 초과분)
4. **계산:**
   - 프로틴 먹기: `strength = min(5, strength + 1)`, `strengthOver = max(0, strengthOver + (strength가 5면 1, 아니면 0))`
   - 시간 경과: `strengthOver > 0`이면 `strengthOver -1`, 아니면 `strength -1`
   - Energy/Overdose: `totalProteinCount = strength + strengthOver`로 계산

**장점:**
- ✅ 중복 제거
- ✅ 명확한 구조
- ✅ 훈련과 프로틴의 구분 유지

**단점:**
- ⚠️ 기존 데이터 마이그레이션 필요
- ⚠️ 코드 변경 범위 큼

---

## 대안: 현재 구조 유지하되 로직 단순화

### 방안: strength를 "기본값"으로, proteinCount를 "누적 카운터"로 명확히 구분

**현재 로직 유지하되:**
1. **strength**: 현재 힘 상태 (0-5, 프로틴 + 훈련)
2. **proteinCount**: 프로틴을 먹은 총 개수 (제한 없음, Energy/Overdose 계산용)

**변경사항:**
- strength 감소 시 proteinCount 감소 로직 제거
- proteinCount는 프로틴 먹기/누워있기로만 변경
- strength는 프로틴/훈련/시간 경과로만 변경

**장점:**
- ✅ 최소한의 변경
- ✅ 두 값의 역할 명확화

**단점:**
- ⚠️ 여전히 두 값을 관리해야 함
- ⚠️ proteinCount <= 5일 때는 여전히 중복

---

## 권장 사항

**사용자 요청에 따라: proteinCount를 strength에 병합**

**구현 방법:**
1. `strength`를 확장하여 `strengthOver` 개념 추가
2. `proteinCount` 제거
3. Energy/Overdose 계산 시 `strength + strengthOver` 사용
4. 기존 `proteinCount` 사용처를 모두 `strength + strengthOver`로 변경

**핵심 원칙:**
- `strength`: 0-5 (프로틴 + 훈련으로 올린 힘)
- `strengthOver`: 0 이상 (프로틴으로 올린 초과분)
- `totalProteinCount = strength + strengthOver` (계산용)
