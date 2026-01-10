# Strength와 ProteinCount 개선 방안

**작성일:** 2024-12-19

## 현재 문제점

`strength`와 `proteinCount`의 관계가 `fullness`와 `overfeeds`의 관계와 유사하지만, 명확하게 분리되지 않아 혼란을 야기합니다.

### 현재 구조

**strength (힘 하트)**
- 범위: 0-5
- 증가: 프로틴 + 훈련
- 감소: 시간 경과
- 용도: 게임플레이 (배틀, 진화)

**proteinCount (프로틴 누적 개수)**
- 범위: 제한 없음
- 증가: 프로틴만
- 감소: 누워있기 (시간 경과로는 감소하지 않음)
- 용도: Energy/Overdose 계산

### 문제점

1. **부분적 중복**: `proteinCount ≤ 5`일 때는 `strength`와 거의 동일
2. **혼란스러운 관계**: `proteinCount`를 변경하면 `strength`도 자동 계산되는 코드 존재 (`StatsPopup.jsx`)
3. **훈련으로 올린 strength 무시**: 훈련으로 `strength = 5`인데 `proteinCount = 3`이면, `proteinCount`를 변경하면 `strength`가 덮어씌워짐

---

## 참고: fullness와 overfeeds 패턴

**fullness (배고픔 하트)**
- 범위: 0-5 (시간 경과로 감소)
- 증가: 고기 먹기
- 감소: 시간 경과
- 용도: 게임플레이 (사망 조건, 호출 시스템)

**overfeeds (과식 횟수)**
- 범위: 0 이상 (누적 카운터)
- 증가: `fullness = 5`일 때 10개 더 먹으면 +1
- 감소: 없음 (진화 시 리셋)
- 용도: 진화 조건

**핵심 차이점:**
- `fullness`와 `overfeeds`는 **완전히 독립적**
- `fullness`가 감소해도 `overfeeds`는 유지
- 두 값은 서로 다른 목적을 가짐

---

## 개선 방안

### 방안 1: 완전 분리 (권장) ⭐

`fullness`와 `overfeeds` 패턴을 따라 `strength`와 `proteinCount`를 완전히 분리합니다.

**strength (힘 하트)**
- 독립적으로 관리
- 프로틴, 훈련, 시간 경과 모두 영향
- 게임플레이에 직접 사용

**proteinCount (프로틴 누적 카운터)**
- 프로틴을 먹은 총 개수만 추적
- Energy/Overdose 계산에만 사용
- `strength`와 완전히 독립적

**장점:**
- ✅ 명확한 책임 분리
- ✅ `fullness`/`overfeeds` 패턴과 일관성
- ✅ 훈련으로 올린 `strength` 보존
- ✅ 코드 이해도 향상

**단점:**
- ⚠️ `proteinCount`가 `strength`와 동기화되지 않음 (의도된 동작)

---

### 방안 2: proteinCount를 "기본 strength"로 사용

`proteinCount`는 프로틴으로 올린 `strength`만 추적하고, 훈련으로 올린 부분은 별도로 관리합니다.

**구조:**
```javascript
// 최종 strength = min(5, proteinCount + trainingStrength)
const finalStrength = Math.min(5, proteinCount + trainingStrength);
```

**새로운 필드:**
- `proteinCount`: 프로틴으로 올린 strength (0-5)
- `trainingStrength`: 훈련으로 올린 strength (0-5)
- `strength`: 최종 힘 = `min(5, proteinCount + trainingStrength)`

**장점:**
- ✅ `proteinCount`와 `strength`의 관계 명확화
- ✅ 훈련으로 올린 부분 보존

**단점:**
- ⚠️ 새로운 필드 추가 필요
- ⚠️ 복잡도 증가
- ⚠️ 기존 데이터 마이그레이션 필요

---

### 방안 3: 현재 구조 유지 + 명확화

현재 구조를 유지하되, 두 값의 관계를 명확히 문서화하고 코드를 정리합니다.

**변경사항:**
1. `StatsPopup.jsx`에서 `proteinCount` 변경 시 `strength` 자동 계산 제거
2. 두 값을 독립적으로 관리
3. 주석 및 문서화 강화

**장점:**
- ✅ 최소한의 코드 변경
- ✅ 기존 데이터 구조 유지

**단점:**
- ⚠️ 여전히 혼란스러울 수 있음
- ⚠️ `fullness`/`overfeeds` 패턴과 불일치

---

## 권장 사항

**방안 1 (완전 분리)**을 권장합니다.

### 이유:
1. `fullness`/`overfeeds` 패턴과 일관성
2. 명확한 책임 분리
3. 코드 유지보수성 향상
4. 훈련으로 올린 `strength` 보존

### 구현 단계:

1. **`StatsPopup.jsx` 수정**
   - `proteinCount` 변경 시 `strength` 자동 계산 제거
   - 두 값을 독립적으로 관리

2. **`protein.js` 확인**
   - `proteinCount`는 프로틴 누적 개수만 추적
   - `strength`는 별도로 증가

3. **문서화**
   - 두 값의 관계 명확히 문서화
   - 코드 주석 추가

---

## 구현 예시

### 현재 (문제 있음):
```javascript
// StatsPopup.jsx
const newStrength = Math.min(5, newProteinCount); // ❌ 훈련으로 올린 strength 무시
```

### 개선 후:
```javascript
// StatsPopup.jsx
// proteinCount와 strength는 독립적으로 관리
// proteinCount는 Energy/Overdose 계산에만 사용
// strength는 게임플레이에 사용
```

### protein.js (변경 없음):
```javascript
// 프로틴 먹기
s.strength = Math.min(5, s.strength + 1); // strength 증가
s.proteinCount = (s.proteinCount || 0) + 1; // proteinCount 증가 (독립적)
```

---

## 결론

`strength`와 `proteinCount`를 `fullness`와 `overfeeds`처럼 완전히 분리하여 관리하는 것이 가장 명확하고 일관성 있는 구조입니다.

**핵심 원칙:**
- `strength`: 현재 힘 상태 (게임플레이용)
- `proteinCount`: 프로틴 누적 카운터 (Energy/Overdose 계산용)
- 두 값은 독립적으로 관리
