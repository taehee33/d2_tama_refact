# 단백질 과다 복용(Protein Overdose) 시스템 분석 및 개선안

## 📋 현재 구현 상태

### 1. 로직 구현

**위치:** `src/logic/food/protein.js`

```javascript
// 단백질 4개마다 Energy +1, Protein Overdose +1
if (proteinCount % 4 === 0) {
  const maxEnergy = s.maxEnergy || s.maxStamina || 100;
  s.energy = Math.min(maxEnergy, (s.energy || 0) + 1);
  s.proteinOverdose = Math.min(7, (s.proteinOverdose || 0) + 1); // 최대 7
}
```

**특징:**
- 단백질을 4개 먹을 때마다 `proteinOverdose` +1
- 최대 7까지 증가
- 진화 시 리셋됨

### 2. 효과 (배틀 부상 확률)

**위치:** `src/logic/battle/calculator.js`, `src/logic/battle/hitrate.js`

```javascript
export function calculateInjuryChance(won, proteinOverdose) {
  if (won) {
    return 20; // 승리 시 20%
  } else {
    // 패배 시 10% + (프로틴 과다 * 10%)
    return Math.min(80, 10 + (proteinOverdose || 0) * 10);
  }
}
```

**효과:**
- 승리 시: 20% 부상 확률 (변화 없음)
- 패배 시: 10% + (proteinOverdose × 10%) 부상 확률
  - proteinOverdose = 0: 10%
  - proteinOverdose = 1: 20%
  - proteinOverdose = 2: 30%
  - ...
  - proteinOverdose = 7: 80% (최대)

### 3. UI 표시 현황

**현재 표시 위치:**
1. **StatsPanel** (개발자 모드 전용)
   - `Dev Info` 섹션에 텍스트로만 표시
   - 일반 사용자는 보이지 않음

2. **StatsPopup** (상세 스탯 팝업)
   - 텍스트로만 표시

3. **비주얼 표시 없음**
   - 오버피드처럼 하트 아이콘으로 표시되지 않음
   - 게임 화면에서 바로 확인 불가능

---

## 🔍 문제점 분석

### 1. 사용자 인지도 낮음
- 단백질 과다 복용 상태를 시각적으로 확인할 수 없음
- 배틀 전에 부상 위험을 알 수 없음
- 개발자 모드에서만 확인 가능

### 2. 오버피드와의 일관성 부족
- 오버피드: 하트 표시에 오렌지 하트(🧡)로 명확히 표시
- 단백질 과다 복용: 비주얼 표시 없음

### 3. 게임플레이 영향
- 단백질 과다 복용이 높을수록 배틀 패배 시 부상 확률이 크게 증가 (최대 80%)
- 하지만 사용자가 이를 인지하지 못하면 전략적 의사결정 불가

---

## 💡 개선 방안

### 방안 1: StatusHearts 컴포넌트에 경고 표시 추가 (추천)

**구현:**
- Strength 하트 옆에 경고 아이콘(⚠️) 표시
- 단백질 과다 복용 수치에 따라 색상/크기 변화
- 오버피드와 유사한 방식으로 통일성 확보

**장점:**
- 게임 화면에서 바로 확인 가능
- 오버피드와 일관된 UI
- 직관적인 시각적 피드백

**단점:**
- UI가 약간 복잡해질 수 있음

### 방안 2: 배틀 화면에 부상 확률 경고 표시

**구현:**
- 배틀 시작 전 단백질 과다 복용 수치 표시
- 예상 부상 확률 표시
- 경고 메시지: "⚠️ Protein Overdose: X/7 (Injury Chance: Y%)"

**장점:**
- 배틀 전 전략적 의사결정 가능
- 명확한 위험 경고

**단점:**
- 게임 화면에서 실시간 확인 불가

### 방안 3: 하이브리드 접근 (방안 1 + 방안 2)

**구현:**
- StatusHearts에 경고 표시 (실시간 확인)
- 배틀 화면에 부상 확률 표시 (전략적 의사결정)

**장점:**
- 최고의 사용자 경험
- 모든 정보 제공

**단점:**
- 구현 복잡도 증가

---

## 🎯 추천 구현: 방안 1 (StatusHearts 개선)

### 구현 세부사항

1. **StatusHearts 컴포넌트 수정**
   - `proteinOverdose` prop 추가
   - Strength 하트 옆에 경고 표시
   - 수치에 따른 색상 변화:
     - 0-2: 노란색 경고 (⚠️)
     - 3-5: 주황색 경고 (⚠️)
     - 6-7: 빨간색 경고 (⚠️)

2. **표시 방식**
   ```
   💪 Strength: ❤️❤️❤️❤️❤️ ⚠️(3/7)
   ```
   또는
   ```
   💪 Strength: ❤️❤️❤️❤️❤️
   ⚠️ Protein Overdose: 3/7 (Injury Risk: +30%)
   ```

3. **GameScreen 통합**
   - `digimonStats.proteinOverdose` 전달
   - 경고 표시 활성화

---

## 📝 구현 체크리스트

- [ ] StatusHearts 컴포넌트에 `proteinOverdose` prop 추가
- [ ] 경고 아이콘/텍스트 표시 로직 구현
- [ ] 색상 변화 로직 구현 (수치에 따른)
- [ ] GameScreen에서 `proteinOverdose` 전달
- [ ] StatsPanel에서도 표시 확인
- [ ] 배틀 화면 부상 확률 표시 (선택사항)

---

## 🔄 오버피드와의 비교

| 항목 | 오버피드 (Overfeed) | 단백질 과다 복용 (Protein Overdose) |
|------|---------------------|-------------------------------------|
| **발생 조건** | 배고픔 5 상태에서 고기 10개 연속 | 단백질 4개마다 +1 |
| **최대 수치** | 제한 없음 (fullness > 5) | 7 |
| **비주얼 표시** | ✅ 오렌지 하트(🧡) | ❌ 없음 |
| **게임 효과** | 배고픔 감소 지연 | 배틀 패배 시 부상 확률 증가 |
| **사용자 인지도** | 높음 (하트로 표시) | 낮음 (숨겨진 정보) |

---

## ✅ 결론

**단백질 과다 복용은 오버피드처럼 비주얼 반영이 필요합니다.**

이유:
1. 게임플레이에 중요한 영향을 미침 (부상 확률 증가)
2. 사용자가 전략적 의사결정을 할 수 있어야 함
3. 오버피드와의 일관성 확보
4. 현재는 개발자 모드에서만 확인 가능하여 일반 사용자는 인지 불가

**추천 구현:**
- StatusHearts 컴포넌트에 경고 표시 추가
- 배틀 화면에 부상 확률 표시 (선택사항)


