# 단백질 시스템 상세 분석 및 개선안

## 📋 현재 구현 상태

### 1. 단백질 먹이기 로직

**위치:** `src/logic/food/protein.js`

```javascript
export function feedProtein(stats) {
  const s = { ...stats };
  
  // 힘 하트 +1 (최대 5)
  if (s.strength < 5) {
    s.strength = s.strength + 1;
  }
  
  // 체중 +2 Gigabyte
  s.weight = (s.weight || 0) + 2;
  
  // 프로틴 카운트 증가 (4개당 Energy +1, Protein Overdose +1)
  const proteinCount = (s.proteinCount || 0) + 1;
  s.proteinCount = proteinCount;
  
  // 4개마다 Energy +1, Protein Overdose +1
  if (proteinCount % 4 === 0) {
    s.energy = Math.min(maxEnergy, (s.energy || 0) + 1);
    s.proteinOverdose = Math.min(7, (s.proteinOverdose || 0) + 1); // 최대 7
  }
}

export function willRefuseProtein(stats) {
  // 힘이 가득 찬 경우 거부
  return stats.strength >= 5;
}
```

### 2. 호버 툴팁 위치

**위치:** `src/components/StatusHearts.jsx` (125번째 줄)

```javascript
<span 
  className={`${heartSize} ${warningColor}`}
  style={{ ... }}
  title={`Protein Overdose: ${proteinOverdose}/7 (Injury Risk: +${injuryChance - 10}%)`}
>
  ⚠️
</span>
```

**확인 방법:**
- 게임 화면에서 Strength 하트 옆의 ⚠️ 아이콘에 마우스를 올리면 툴팁이 표시됩니다.
- 모바일에서는 `title` 속성이 작동하지 않을 수 있습니다.

---

## 🔍 문제점 분석

### 문제 1: 단백질 최대치 혼란

**현재 상황:**
- `strength` (힘 하트): 최대 5
- `proteinCount` (단백질 누적 개수): 제한 없음 (이론상)
- `proteinOverdose`: 최대 7 (4개당 +1)
- `willRefuseProtein`: `strength >= 5`일 때 거부

**실제 동작:**
1. 단백질 1개 먹기 → `strength: 0 → 1`, `proteinCount: 0 → 1`
2. 단백질 2개 먹기 → `strength: 1 → 2`, `proteinCount: 1 → 2`
3. 단백질 3개 먹기 → `strength: 2 → 3`, `proteinCount: 2 → 3`
4. 단백질 4개 먹기 → `strength: 3 → 4`, `proteinCount: 3 → 4`, **`proteinOverdose: 0 → 1`** (4의 배수)
5. 단백질 5개 먹기 → `strength: 4 → 5`, `proteinCount: 4 → 5`
6. 단백질 6개 먹기 시도 → **거부됨** (`strength >= 5`)

**결과:**
- 실제로 먹을 수 있는 단백질: **최대 5개**
- `proteinOverdose` 최대값: **1** (4개째에만 +1)
- 하지만 코드에서는 `proteinOverdose` 최대값을 **7**로 설정

### 문제 2: 로직 모순

**모순점:**
1. `proteinOverdose`는 최대 7까지 증가할 수 있도록 설계됨
2. 하지만 `strength >= 5`일 때 단백질을 거부하므로, 실제로는 5개 이상 먹을 수 없음
3. 따라서 `proteinOverdose`는 최대 1까지만 증가 가능

**의도된 동작인가?**
- 매뉴얼: "Every four Protein will increase your Energy and Protein Overdose by 1 each."
- 매뉴얼에는 `strength`가 5일 때도 단백질을 계속 먹을 수 있다는 언급이 없음
- 하지만 `proteinOverdose` 최대값이 7이라는 것은, 최소 28개(7 × 4)의 단백질을 먹을 수 있어야 함을 의미

---

## 💡 개선 방안

### 방안 1: Strength가 5여도 단백질 먹기 허용 (추천)

**변경 사항:**
- `willRefuseProtein` 함수 수정: `strength >= 5`일 때도 거부하지 않음
- `feedProtein` 함수 수정: `strength`가 5여도 `proteinCount`는 계속 증가
- `strength`는 5에서 멈추지만, `proteinCount`와 `proteinOverdose`는 계속 증가

**장점:**
- `proteinOverdose` 최대값 7을 실제로 달성 가능
- 매뉴얼의 "Every four Protein" 규칙을 완전히 구현
- 전략적 선택: `strength`는 가득 찼지만, `energy`와 `proteinOverdose`를 위해 계속 먹을 수 있음

**단점:**
- `strength`가 5인데도 단백질을 먹을 수 있다는 것이 직관적이지 않을 수 있음

**구현:**
```javascript
export function willRefuseProtein(stats) {
  // strength가 5여도 단백질을 먹을 수 있음 (energy와 proteinOverdose를 위해)
  return false; // 항상 허용
  // 또는 특정 조건에서만 거부 (예: proteinOverdose >= 7)
}
```

### 방안 2: ProteinOverdose 최대값을 1로 제한

**변경 사항:**
- `proteinOverdose` 최대값을 7에서 1로 변경
- 현재 로직 유지 (strength >= 5일 때 거부)

**장점:**
- 현재 로직과 일치
- 구현이 간단함

**단점:**
- 매뉴얼의 최대값 7을 구현하지 못함
- 전략적 깊이가 줄어듦

### 방안 3: 하이브리드 접근

**변경 사항:**
- `strength < 5`: 단백질 먹기 → `strength +1`, `proteinCount +1`
- `strength >= 5`: 단백질 먹기 → `strength` 변화 없음, `proteinCount +1`만 증가
- `willRefuseProtein`: 항상 허용 (또는 `proteinOverdose >= 7`일 때만 거부)

**장점:**
- `proteinOverdose` 최대값 7 달성 가능
- `strength`는 5에서 멈추지만, 계속 먹을 수 있음
- 전략적 선택 가능

**단점:**
- 로직이 약간 복잡해짐

---

## 🎯 추천 구현: 방안 1 (Strength 5여도 허용)

### 이유:
1. 매뉴얼의 `proteinOverdose` 최대값 7을 실제로 구현 가능
2. 전략적 깊이: `strength`는 가득 찼지만, `energy` 회복을 위해 계속 먹을 수 있음
3. 단백질 과다 복용의 위험성(부상 확률 증가)을 실제로 경험할 수 있음

### 구현 세부사항:

```javascript
// src/logic/food/protein.js

export function feedProtein(stats) {
  const s = { ...stats };
  const oldStrength = s.strength || 0;
  
  // 힘 하트 +1 (최대 5) - strength가 5여도 proteinCount는 증가
  if (s.strength < 5) {
    s.strength = s.strength + 1;
  }
  
  // 체중 +2 Gigabyte (항상 증가)
  s.weight = (s.weight || 0) + 2;
  
  // 프로틴 카운트 증가 (항상 증가, strength와 무관)
  const proteinCount = (s.proteinCount || 0) + 1;
  s.proteinCount = proteinCount;
  
  // 4개마다 Energy +1, Protein Overdose +1
  if (proteinCount % 4 === 0) {
    const maxEnergy = s.maxEnergy || s.maxStamina || 100;
    s.energy = Math.min(maxEnergy, (s.energy || 0) + 1);
    s.proteinOverdose = Math.min(7, (s.proteinOverdose || 0) + 1);
  }
  
  return {
    updatedStats: s,
    strengthIncreased: s.strength > oldStrength,
    energyRestored: proteinCount % 4 === 0,
    proteinOverdoseIncreased: proteinCount % 4 === 0,
  };
}

export function willRefuseProtein(stats) {
  // strength가 5여도 단백질을 먹을 수 있음
  // proteinOverdose가 최대치(7)에 도달했을 때만 거부할 수도 있음
  // 현재는 항상 허용
  return false;
  
  // 또는 proteinOverdose 최대치 체크:
  // return (stats.proteinOverdose || 0) >= 7;
}
```

---

## 📊 시나리오 비교

### 현재 (문제 있음):
- 단백질 1-5개: 먹을 수 있음
- 단백질 6개: 거부됨 (strength >= 5)
- `proteinOverdose` 최대: 1
- 실제로는 `proteinOverdose` 최대값 7을 달성할 수 없음

### 개선 후 (방안 1):
- 단백질 1-5개: `strength` 증가, `proteinCount` 증가
- 단백질 6-28개: `strength` 변화 없음 (5 유지), `proteinCount` 계속 증가
- `proteinOverdose` 최대: 7 (28개째에 달성)
- 전략적 선택: `energy` 회복 vs `proteinOverdose` 위험

---

## ✅ 결론

**현재 문제:**
- `strength >= 5`일 때 단백질을 거부하므로, `proteinOverdose`는 최대 1까지만 증가 가능
- 하지만 코드에서는 최대값을 7로 설정하여 모순 발생

**개선 방안:**
- `willRefuseProtein`을 수정하여 `strength >= 5`여도 단백질을 먹을 수 있도록 변경
- 또는 `proteinOverdose >= 7`일 때만 거부하도록 변경
- 이렇게 하면 `proteinOverdose` 최대값 7을 실제로 달성할 수 있음

**호버 툴팁:**
- 현재 `title` 속성으로 구현되어 있음 (125번째 줄)
- 데스크톱에서 ⚠️ 아이콘에 마우스를 올리면 표시됨
- 모바일에서는 작동하지 않을 수 있으므로, 툴팁을 항상 표시하거나 다른 방식으로 개선 필요

