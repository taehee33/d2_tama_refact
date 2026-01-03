# Heal Doses 구현 상태 확인

## ✅ 구현 완료 항목

### 1. 부상 발생

#### ✅ 배틀: 승리 시 20%, 패배 시 10% + (Protein Overdose × 10%)

**위치**: `digimon-tamagotchi-frontend/src/logic/battle/calculator.js`, `digimon-tamagotchi-frontend/src/logic/battle/hitrate.js`

```177:184:digimon-tamagotchi-frontend/src/logic/battle/calculator.js
export function calculateInjuryChance(won, proteinOverdose) {
  if (won) {
    return 20; // 승리 시 20%
  } else {
    // 패배 시 10% + (프로틴 과다 * 10%)
    return Math.min(80, 10 + (proteinOverdose || 0) * 10);
  }
}
```

**사용 위치**: `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`

```790:801:digimon-tamagotchi-frontend/src/hooks/useGameActions.js
      // 부상 확률 체크 (승리 시 20%)
      const proteinOverdose = battleStats.proteinOverdose || 0;
      const injuryChance = calculateInjuryChance(true, proteinOverdose);
      const isInjured = Math.random() * 100 < injuryChance;
      
      if (isInjured) {
        finalStats.isInjured = true;
        finalStats.injuredAt = Date.now();
        finalStats.injuries = (battleStats.injuries || 0) + 1;
        finalStats.healedDosesCurrent = 0;
      }
```

```871:881:digimon-tamagotchi-frontend/src/hooks/useGameActions.js
      // 부상 확률 체크 (패배 시 10% + 프로틴 과다 * 10%, 최대 80%)
      const proteinOverdose = battleStats.proteinOverdose || 0;
      const injuryChance = calculateInjuryChance(false, proteinOverdose);
      const isInjured = Math.random() * 100 < injuryChance;
      
      if (isInjured) {
        finalStats.isInjured = true;
        finalStats.injuredAt = Date.now();
        finalStats.injuries = (battleStats.injuries || 0) + 1;
        finalStats.healedDosesCurrent = 0;
      }
```

#### ✅ 똥 8개: 즉시 부상

**위치**: `digimon-tamagotchi-frontend/src/data/stats.js`

```262:269:digimon-tamagotchi-frontend/src/data/stats.js
            // 똥 8개가 되면 부상 상태로 설정
            if (!updatedStats.isInjured) {
              // 처음 부상 발생 시에만 injuries 증가 및 시간 기록
              updatedStats.isInjured = true;
              updatedStats.injuredAt = timeToMax;
              updatedStats.injuries = (updatedStats.injuries || 0) + 1;
              updatedStats.healedDosesCurrent = 0; // 치료제 횟수 리셋
            }
```

```272:277:digimon-tamagotchi-frontend/src/data/stats.js
            if (updatedStats.poopCount >= 8 && !updatedStats.isInjured) {
              updatedStats.isInjured = true;
              updatedStats.injuredAt = now.getTime();
              updatedStats.injuries = (updatedStats.injuries || 0) + 1;
              updatedStats.healedDosesCurrent = 0; // 치료제 횟수 리셋
            }
```

#### ✅ 부상 시: `isInjured = true`, `healedDosesCurrent = 0`

**구현 완료**: 위의 배틀과 똥 8개 로직에서 모두 구현됨

---

### 2. 치료 과정

#### ✅ 치료 버튼 클릭 → `healedDosesCurrent + 1`

**위치**: `digimon-tamagotchi-frontend/src/hooks/useGameAnimations.js`

```226:234:digimon-tamagotchi-frontend/src/hooks/useGameAnimations.js
      // 치료 로직
      const currentDigimonData = newDigimonDataVer1[selectedDigimon] || {};
      const requiredDoses = currentDigimonData.stats?.healDoses || 1; // 기본값 1
      const newHealedDoses = (currentStats.healedDosesCurrent || 0) + 1;
      
      let updatedStats = {
        ...currentStats,
        healedDosesCurrent: newHealedDoses,
      };
```

#### ✅ `healedDosesCurrent >= healDoses` → 완전 회복

**위치**: `digimon-tamagotchi-frontend/src/hooks/useGameAnimations.js`

```236:242:digimon-tamagotchi-frontend/src/hooks/useGameAnimations.js
      // 필요 치료 횟수 충족 시 완전 회복
      if (newHealedDoses >= requiredDoses) {
        updatedStats.isInjured = false;
        updatedStats.injuredAt = null;
        updatedStats.healedDosesCurrent = 0;
        const updatedLogs = addActivityLog(updatedStats.activityLogs || [], 'HEAL', 'Fully Healed!');
        setDigimonStatsAndSave({ ...updatedStats, activityLogs: updatedLogs }, updatedLogs);
```

#### ✅ `healedDosesCurrent < healDoses` → 추가 치료 필요

**위치**: `digimon-tamagotchi-frontend/src/hooks/useGameAnimations.js`

```243:246:digimon-tamagotchi-frontend/src/hooks/useGameAnimations.js
      } else {
        const updatedLogs = addActivityLog(updatedStats.activityLogs || [], 'HEAL', `Need more medicine... (${newHealedDoses}/${requiredDoses})`);
        setDigimonStatsAndSave({ ...updatedStats, activityLogs: updatedLogs }, updatedLogs);
      }
```

---

### 3. 사망 조건

#### ✅ 부상 15회 누적 시 사망

**위치**: `digimon-tamagotchi-frontend/src/data/stats.js`, `digimon-tamagotchi-frontend/src/pages/Game.jsx`

```314:317:digimon-tamagotchi-frontend/src/data/stats.js
  // 부상 과다 사망 체크: injuries >= 15
  if ((updatedStats.injuries || 0) >= 15 && !updatedStats.isDead) {
    updatedStats.isDead = true;
  }
```

```358:362:digimon-tamagotchi-frontend/src/pages/Game.jsx
        // 부상 과다 사망 체크: injuries >= 15
        if((updatedStats.injuries || 0) >= 15 && !updatedStats.isDead){
          updatedStats.isDead = true;
          setDeathReason('INJURY OVERLOAD (부상 과다: 15회)');
        }
```

#### ✅ 부상 상태로 6시간 방치 시 사망

**위치**: `digimon-tamagotchi-frontend/src/data/stats.js`, `digimon-tamagotchi-frontend/src/pages/Game.jsx`

```319:329:digimon-tamagotchi-frontend/src/data/stats.js
  // 부상 방치 사망 체크: isInjured 상태이고 6시간(21600000ms) 경과
  if (updatedStats.isInjured && updatedStats.injuredAt && !updatedStats.isDead) {
    const injuredTime = typeof updatedStats.injuredAt === 'number'
      ? updatedStats.injuredAt
      : new Date(updatedStats.injuredAt).getTime();
    const elapsedSinceInjury = now.getTime() - injuredTime;
    
    if (elapsedSinceInjury >= 21600000) { // 6시간 = 21600000ms
      updatedStats.isDead = true;
    }
  }
```

```363:373:digimon-tamagotchi-frontend/src/pages/Game.jsx
        // 부상 방치 사망 체크: isInjured 상태이고 6시간 경과
        if(updatedStats.isInjured && updatedStats.injuredAt && !updatedStats.isDead){
          const injuredTime = typeof updatedStats.injuredAt === 'number'
            ? updatedStats.injuredAt
            : new Date(updatedStats.injuredAt).getTime();
          const elapsedSinceInjury = Date.now() - injuredTime;
          if(elapsedSinceInjury >= 21600000){ // 6시간 = 21600000ms
            updatedStats.isDead = true;
            setDeathReason('INJURY NEGLECT (부상 방치: 6시간)');
          }
        }
```

---

### 4. 치료제 투여 카운터

#### ✅ `healedDosesCurrent`: 현재 투여된 치료제 횟수

**위치**: `digimon-tamagotchi-frontend/src/data/defaultStatsFile.js`

```57:57:digimon-tamagotchi-frontend/src/data/defaultStatsFile.js
    healedDosesCurrent: 0, // 현재 투여된 치료제 횟수
```

#### ✅ 부상 발생 시 0으로 리셋

**구현 완료**: 
- 배틀 부상: `useGameActions.js`에서 `healedDosesCurrent = 0` 설정
- 똥 8개 부상: `stats.js`에서 `healedDosesCurrent = 0` 설정

#### ✅ 완전 회복 시 0으로 리셋

**위치**: `digimon-tamagotchi-frontend/src/hooks/useGameAnimations.js`

```237:240:digimon-tamagotchi-frontend/src/hooks/useGameAnimations.js
      if (newHealedDoses >= requiredDoses) {
        updatedStats.isInjured = false;
        updatedStats.injuredAt = null;
        updatedStats.healedDosesCurrent = 0;
```

#### ✅ 진화 시 0으로 리셋

**위치**: `digimon-tamagotchi-frontend/src/data/stats.js`

```35:38:digimon-tamagotchi-frontend/src/data/stats.js
  merged.injuries = 0; // 부상 횟수 리셋
  merged.isInjured = false; // 부상 상태 리셋
  merged.injuredAt = null; // 부상 시간 리셋
  merged.healedDosesCurrent = 0; // 치료제 횟수 리셋
```

---

## 📊 요약

| 항목 | 상태 | 위치 |
|------|------|------|
| **부상 발생 - 배틀** | ✅ 완료 | `useGameActions.js`, `calculator.js` |
| **부상 발생 - 똥 8개** | ✅ 완료 | `stats.js` |
| **부상 시 초기화** | ✅ 완료 | 배틀/똥 모두 구현 |
| **치료 버튼 클릭** | ✅ 완료 | `useGameAnimations.js` |
| **완전 회복 체크** | ✅ 완료 | `useGameAnimations.js` |
| **추가 치료 필요** | ✅ 완료 | `useGameAnimations.js` |
| **부상 15회 사망** | ✅ 완료 | `stats.js`, `Game.jsx` |
| **부상 6시간 방치 사망** | ✅ 완료 | `stats.js`, `Game.jsx` |
| **치료제 카운터 필드** | ✅ 완료 | `defaultStatsFile.js` |
| **부상 발생 시 리셋** | ✅ 완료 | 배틀/똥 모두 구현 |
| **완전 회복 시 리셋** | ✅ 완료 | `useGameAnimations.js` |
| **진화 시 리셋** | ✅ 완료 | `stats.js` |

---

## ✅ 결론

**모든 기능이 완벽하게 구현되어 있습니다!**

- 부상 발생 로직 (배틀, 똥 8개)
- 치료 과정 로직 (치료제 투여, 완전 회복 체크)
- 사망 조건 체크 (15회 누적, 6시간 방치)
- 치료제 카운터 관리 (부상 발생/완전 회복/진화 시 리셋)

모든 항목이 매뉴얼 스펙에 맞게 정확히 구현되어 있습니다.

---

**작성일**: 2026-01-03


