# 배틀 스탯 분석 문서

## 📊 배틀 스탯 구조

### 1. 배틀 스탯 필드

#### 현재 디지몬 배틀 스탯 (진화 조건용, 진화 시 리셋)
- `battles`: 현재 디지몬의 총 배틀 횟수 (승리 + 패배)
- `battlesWon`: 현재 디지몬의 승리 횟수
- `battlesLost`: 현재 디지몬의 패배 횟수
- `winRate`: 현재 디지몬의 승률 (%) = (battlesWon / battles) * 100

#### 전체 생애 배틀 스탯 (진화 시 유지)
- `totalBattles`: 전체 생애 동안의 총 배틀 횟수
- `totalBattlesWon`: 전체 생애 동안의 총 승리 횟수
- `totalBattlesLost`: 전체 생애 동안의 총 패배 횟수
- `totalWinRate`: 전체 생애 동안의 총 승률 (%)

---

## 🎯 진화 조건에서 사용하는 배틀 스탯

### 진화 판정 로직 (`src/logic/evolution/checker.js`)

**중요**: 진화 조건 체크 시 **현재 디지몬의 배틀 스탯만** 사용합니다.

```javascript
// battles 체크 (현재 디지몬 값만 사용)
if (conditions.battles !== undefined) {
  const currentBattles = (stats.battlesWon || 0) + (stats.battlesLost || 0);
  // currentBattles를 진화 조건과 비교
}

// winRatio 체크 (현재 디지몬 값만 사용)
if (conditions.winRatio !== undefined) {
  const currentBattles = (stats.battlesWon || 0) + (stats.battlesLost || 0);
  const winRatio = ((stats.battlesWon || 0) / currentBattles) * 100;
  // winRatio를 진화 조건과 비교
}
```

**사용되는 필드**:
- ✅ `battles` (또는 `battlesWon + battlesLost`)
- ✅ `battlesWon`
- ✅ `battlesLost`
- ✅ `winRate` (계산: `battlesWon / battles * 100`)

**사용되지 않는 필드**:
- ❌ `totalBattles`
- ❌ `totalBattlesWon`
- ❌ `totalBattlesLost`
- ❌ `totalWinRate`

---

## 🎮 배틀 모드별 처리 방식

### 1. Quest 모드 (퀘스트)

**위치**: `src/hooks/useGameActions.js` - `handleBattleComplete` 함수

**배틀 스탯 업데이트**:
- ✅ **현재 디지몬 스탯 업데이트**: `battles`, `battlesWon`, `battlesLost`, `winRate`
- ✅ **전체 생애 스탯 업데이트**: `totalBattles`, `totalBattlesWon`, `totalBattlesLost`, `totalWinRate`

**승리 시**:
```javascript
const newBattles = (battleStats.battles || 0) + 1;
const newBattlesWon = (battleStats.battlesWon || 0) + 1;
const newWinRate = newBattles > 0 ? Math.round((newBattlesWon / newBattles) * 100) : 0;

// 총 토탈 값도 업데이트
const newTotalBattles = (battleStats.totalBattles || 0) + 1;
const newTotalBattlesWon = (battleStats.totalBattlesWon || 0) + 1;
```

**패배 시**:
```javascript
const newBattles = (battleStats.battles || 0) + 1;
const newBattlesLost = (battleStats.battlesLost || 0) + 1;
const newBattlesWon = battleStats.battlesWon || 0;
const newWinRate = newBattles > 0 ? Math.round((newBattlesWon / newBattles) * 100) : 0;

// 총 토탈 값도 업데이트
const newTotalBattles = (battleStats.totalBattles || 0) + 1;
const newTotalBattlesLost = (battleStats.totalBattlesLost || 0) + 1;
```

**기타 효과**:
- Weight: -4g (승패 무관)
- Energy: -1 (승패 무관)
- 부상 확률: 승리 시 20%, 패배 시 10% + (Protein Overdose × 10%)

---

### 2. Sparring 모드 (스파링)

**위치**: `src/hooks/useGameActions.js` - `handleBattleComplete` 함수

**배틀 스탯 업데이트**:
- ❌ **배틀 기록에 반영하지 않음** (연습전이므로)
- ✅ **Activity Log만 기록**: "Sparring: Practice Match (No Record)"

**코드**:
```javascript
if (battleType === 'sparring') {
  // 배틀 횟수에 반영하지 않고 로그만 남김
  // Weight -4g, Energy -1만 적용
  return; // 배틀 스탯 업데이트 없이 종료
}
```

**기타 효과**:
- Weight: -4g
- Energy: -1
- 부상: 없음

---

### 3. Arena 모드 (아레나)

**위치**: `src/hooks/useGameActions.js` - `handleBattleComplete` 함수

**배틀 스탯 업데이트**:
- ✅ **로컬 스탯 업데이트**: `battles`, `battlesWon`, `battlesLost`, `winRate`, `totalBattles`, `totalBattlesWon`, `totalBattlesLost`, `totalWinRate`
- ✅ **Firestore `arena_entries` 컬렉션 업데이트**: `record.wins`, `record.losses`, `record.seasonWins`, `record.seasonLosses`
- ✅ **Firestore `arena_battle_logs` 컬렉션에 배틀 로그 저장**

**코드**:
```javascript
if (battleType === 'arena' && arenaChallenger && currentUser) {
  // Firestore 업데이트
  await updateDoc(myEntryRef, {
    'record.wins': increment(1), // 또는 losses
    'record.seasonWins': increment(1), // 또는 seasonLosses
  });
  
  // 배틀 로그 저장
  await addDoc(battleLogsRef, battleLogData);
  
  // 로컬 스탯도 업데이트 (Quest 모드와 동일한 로직)
  if (battleResult.win) {
    finalStats = {
      ...battleStats,
      battles: newBattles,
      battlesWon: newBattlesWon,
      winRate: newWinRate,
      totalBattles: newTotalBattles,
      totalBattlesWon: newTotalBattlesWon,
      totalWinRate: newTotalWinRate,
    };
  } else {
    // 패배 시 battlesLost 업데이트
  }
}
```

**기타 효과**:
- Weight: -4g (Activity Log에만 기록)
- Energy: -1 (Activity Log에만 기록)
- 부상: 없음 (Arena 모드에서는 부상 처리 안 함)

---

## 📈 스탯 표시 위치

### 1. StatsPopup (`src/components/StatsPopup.jsx`)

**섹션 5. 진화 판정 카운터**:
```javascript
<li>Total Battles: {battles || 0} (Wins: {battlesWon || 0}, Losses: {battlesLost || 0})</li>
```

**표시되는 값**:
- **배틀 기록 (현재 디지몬)**:
  - `battles`: 현재 디지몬의 총 배틀 횟수
  - `battlesWon`: 현재 디지몬의 승리 횟수
  - `battlesLost`: 현재 디지몬의 패배 횟수
  - 승률: `(battlesWon / battles) * 100` (계산된 값)
- **배틀 기록 (전체 생애)**:
  - `totalBattles`: 전체 생애 동안의 총 배틀 횟수
  - `totalBattlesWon`: 전체 생애 동안의 총 승리 횟수
  - `totalBattlesLost`: 전체 생애 동안의 총 패배 횟수
  - 총 승률: `(totalBattlesWon / totalBattles) * 100` (계산된 값)

**섹션 2. 개체(Instance) 상태값**:
```javascript
<li>Win Ratio: {winRate || 0}%</li>
```

**표시되는 값**:
- `winRate`: 현재 디지몬의 승률 (%)

---

## 🔍 진화 가이드에서 표시되는 배틀 정보

**위치**: Evolution Guide (진화 가이드 모달)

**표시 형식**:
```
배틀: 0 (현재 디지몬) / 15+ (진화기준) (부족)
승률: 배틀을 하지 않았습니다 (부족)
```

**표시되는 값**:
- 현재 배틀 횟수: `battles` (또는 `battlesWon + battlesLost`)
- 진화 기준 배틀 횟수: `evolutionCriteria.battles.min`
- 현재 승률: `(battlesWon / battles) * 100` (배틀을 하지 않았으면 "배틀을 하지 않았습니다")
- 진화 기준 승률: `evolutionCriteria.winRatio.min`

---

## 📝 요약

### 진화 조건 체크
- ✅ **현재 디지몬의 배틀 스탯만 사용**: `battles`, `battlesWon`, `battlesLost`, `winRate`
- ❌ **전체 생애 스탯은 사용하지 않음**: `totalBattles`, `totalBattlesWon`, `totalBattlesLost`, `totalWinRate`

### 배틀 모드별 스탯 업데이트
| 모드 | 현재 디지몬 스탯 | 전체 생애 스탯 | Firestore |
|------|----------------|--------------|-----------|
| **Quest** | ✅ 업데이트 | ✅ 업데이트 | ❌ |
| **Sparring** | ❌ 업데이트 안 함 | ❌ 업데이트 안 함 | ❌ |
| **Arena** | ✅ 업데이트 | ✅ 업데이트 | ✅ 업데이트 |

### 스탯 표시
- **StatsPopup**: 
  - 현재 디지몬의 `battles`, `battlesWon`, `battlesLost`, 승률 표시
  - 전체 생애의 `totalBattles`, `totalBattlesWon`, `totalBattlesLost`, 총 승률 표시
- **Evolution Guide**: 현재 디지몬의 배틀 횟수와 승률을 진화 기준과 비교하여 표시

---

## ✅ 해결된 이슈

1. ~~**Arena 모드 배틀 스탯 미반영**~~: ✅ **해결됨** (2026-01-04)
   - Arena 모드에서도 로컬 스탯(`battles`, `battlesWon`, `battlesLost`, `winRate`)을 업데이트하도록 수정 완료
   - Quest 모드와 동일한 로직으로 현재 디지몬 스탯과 전체 생애 스탯 모두 업데이트

## ✅ 해결된 이슈

2. ~~**전체 생애 스탯 미표시**~~: ✅ **해결됨** (2026-01-04)
   - StatsPopup의 "5. 진화 판정 카운터" 섹션에 전체 생애 배틀 기록 추가
   - 현재 디지몬 배틀 기록과 전체 생애 배틀 기록을 구분하여 표시

---

## 📚 관련 파일

- `src/logic/evolution/checker.js`: 진화 조건 체크 로직
- `src/hooks/useGameActions.js`: 배틀 완료 핸들러
- `src/components/StatsPopup.jsx`: 스탯 표시 UI
- `src/data/defaultStatsFile.js`: 기본 스탯 구조 정의

