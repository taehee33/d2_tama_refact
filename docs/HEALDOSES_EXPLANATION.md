# Heal Doses (치료 필요 횟수) 설명

## 📋 역할

`healDoses`는 **디지몬이 부상당했을 때 완전히 회복하기 위해 필요한 치료제(medicine)의 횟수**를 나타냅니다.

## 📖 매뉴얼 설명

Digital Monster Color Manual의 **Heal (Bandage Icon)** 섹션:

> "Digimon can get injured from battling or from accumulating 8 poops. When your Digimon is injured, it will have a skull floating next to it. When this happens you can use this option to heal them! **Select this icon to heal your Digimon, and note that multiple doses of medicine may be necessary.** You can see how many doses your Digimon requires by clicking on that Digimon in the Evolution Guide."

**번역:**
> "디지몬은 배틀을 하거나 똥 8개가 쌓이면 부상당할 수 있습니다. 디지몬이 부상당하면 옆에 해골이 떠다닙니다. 이때 이 옵션을 사용하여 치료할 수 있습니다! **이 아이콘을 선택하여 디지몬을 치료하세요. 여러 번의 치료제가 필요할 수 있습니다.** 진화 가이드에서 해당 디지몬을 클릭하면 필요한 치료 횟수를 확인할 수 있습니다."

## 🎮 게임 내 동작

### 1. 부상 발생 조건

- **배틀**: 승리 시 20% 확률, 패배 시 10% + (Protein Overdose × 10%) 확률
- **똥 8개**: 똥이 8개 쌓이면 즉시 부상

### 2. 치료 과정

1. **부상 발생**: `isInjured = true`, `healedDosesCurrent = 0`
2. **치료 버튼 클릭**: 치료 모달 열림
3. **치료제 투여**: `healedDosesCurrent + 1`
4. **회복 체크**:
   - `healedDosesCurrent >= healDoses` → **완전 회복** (`isInjured = false`)
   - `healedDosesCurrent < healDoses` → **추가 치료 필요** (부상 상태 유지)

### 3. 코드 동작

**위치**: `digimon-tamagotchi-frontend/src/hooks/useGameAnimations.js`

```javascript
const healCycle = async (step, currentStats) => {
  // 현재 디지몬의 필요 치료 횟수 가져오기
  const requiredDoses = currentDigimonData.stats?.healDoses || 1; // 기본값 1
  
  // 치료제 투여
  const newHealedDoses = (currentStats.healedDosesCurrent || 0) + 1;
  
  // 필요 치료 횟수 충족 시 완전 회복
  if (newHealedDoses >= requiredDoses) {
    updatedStats.isInjured = false;
    updatedStats.injuredAt = null;
    updatedStats.healedDosesCurrent = 0; // 리셋
    // "Fully Healed!" 메시지
  } else {
    // "Need more medicine... (현재/필요)" 메시지
    // 부상 상태 유지
  }
};
```

## 📊 예시 시나리오

### 시나리오 1: Agumon (healDoses: 2)

1. **부상 발생**: 배틀에서 부상 → `isInjured = true`, `healedDosesCurrent = 0`
2. **1회 치료**: `healedDosesCurrent = 1` → 아직 부상 상태 (1/2)
3. **2회 치료**: `healedDosesCurrent = 2` → **완전 회복!** (2/2)

### 시나리오 2: Botamon (healDoses: 1)

1. **부상 발생**: 똥 8개 → `isInjured = true`, `healedDosesCurrent = 0`
2. **1회 치료**: `healedDosesCurrent = 1` → **즉시 완전 회복!** (1/1)

### 시나리오 3: 특정 디지몬 (healDoses: 3)

1. **부상 발생**: 배틀에서 부상 → `isInjured = true`, `healedDosesCurrent = 0`
2. **1회 치료**: `healedDosesCurrent = 1` → 아직 부상 상태 (1/3)
3. **2회 치료**: `healedDosesCurrent = 2` → 아직 부상 상태 (2/3)
4. **3회 치료**: `healedDosesCurrent = 3` → **완전 회복!** (3/3)

## ⚠️ 중요 사항

### 1. 사망 조건

- **부상 15회**: 한 단계에서 부상을 15번 당하면 사망
- **부상 6시간 방치**: 부상 상태로 6시간 방치하면 사망

### 2. 치료제 투여 카운터

- `healedDosesCurrent`: 현재 투여된 치료제 횟수
- 부상 발생 시: `healedDosesCurrent = 0` (리셋)
- 완전 회복 시: `healedDosesCurrent = 0` (리셋)
- 진화 시: `healedDosesCurrent = 0` (리셋)

### 3. 디지몬별 차이

- **Baby I, Baby II**: 보통 `healDoses: 1` (1회 치료로 회복)
- **Child (Rookie)**: `healDoses: 1` 또는 `2` (디지몬별로 다름)
- **Adult (Champion) 이상**: `healDoses: 2` 이상 (더 강한 디지몬은 더 많은 치료 필요)

## 🔍 UI 표시

### HealModal
- **상태 메시지**: `"Doses: {currentDoses} / {requiredDoses}"`
- **완전 회복 시**: `"Fully Recovered!"`
- **부상 없음**: `"Not injured!"`

### StatsPopup
- **"1. 종(Species) 고정 파라미터"** 섹션에 `"Heal Doses: {healDoses}"` 표시

## 📌 요약

| 항목 | 설명 |
|------|------|
| **필드명** | `stats.healDoses` |
| **타입** | `number` |
| **기본값** | `1` |
| **범위** | `1` 이상 (일반적으로 1-3) |
| **용도** | 부상 회복에 필요한 치료제 횟수 |
| **리셋 시점** | 진화 시 (유지되지 않음) |
| **표시 위치** | StatsPopup, HealModal |

---

**작성일**: 2026-01-03  
**참고**: Digital Monster Color Manual - Heal (Bandage Icon) 섹션


