# 배틀 시스템 분석

## 📋 개요

디지몬 배틀은 턴제 전투 시스템으로, 먼저 3번 명중(Hit)한 쪽이 승리합니다.

---

## 🔧 배틀 타입

### 1. Quest 모드 (퀘스트)
- **위치**: `src/logic/battle/questEngine.js`
- **적 데이터**: `src/data/v1/quests.js`
- **특징**: 퀘스트 데이터의 power 값 사용 (도감 값 무시)

### 2. Sparring 모드 (스파링)
- **위치**: `src/components/SparringModal.jsx`
- **특징**: 다른 슬롯과 연습전, 배틀 기록에 반영 안 됨

### 3. Arena 모드 (아레나)
- **위치**: `src/components/ArenaScreen.jsx`
- **특징**: 다른 유저와 대전, Firestore에 기록 저장

---

## 🎯 배틀 계산 로직

### 1. 히트레이트 계산

**위치**: `src/logic/battle/calculator.js` - `calculateHitRate()`

```javascript
hitRate = ((attackerPower * 100) / (attackerPower + defenderPower)) + attrBonus
```

**속성 보너스**:
- Vaccine > Virus: +5%
- Virus > Data: +5%
- Data > Vaccine: +5%
- 역방향: -5%
- Free: 0%

### 2. 배틀 시뮬레이션

**위치**: `src/logic/battle/calculator.js` - `simulateBattle()`

**규칙**:
- 라운드마다 서로 한 번씩 공격
- `Math.random() * 100 < hitRate`로 명중 판정
- 먼저 3번 명중한 쪽 승리
- 최대 100라운드 제한

### 3. 파워 계산

**위치**: `src/logic/battle/hitrate.js` - `calculatePower()`

```javascript
power = basePower + (strength >= 5 ? stageBonus : 0) + (traitedEgg ? stageBonus : 0)
```

**Stage 보너스**:
- Child: +5
- Adult: +8
- Perfect: +15
- Ultimate/Super Ultimate: +25

---

## 📊 배틀 결과 처리

### 1. 공통 효과 (승패 무관)
- **Weight**: -4g
- **Energy**: -1

### 2. 부상 확률

**위치**: `src/logic/battle/calculator.js` - `calculateInjuryChance()`

- **승리 시**: 20%
- **패배 시**: 10% + (Protein Overdose × 10%), 최대 80%

### 3. 배틀 기록 업데이트

**Quest/Arena 모드**:
- `battles` +1
- 승리: `battlesWon` +1
- 패배: `battlesLost` +1
- `winRate` 재계산
- `totalBattles`, `totalBattlesWon/Lost`도 업데이트

**Sparring 모드**:
- 배틀 기록 반영 안 됨 (연습전)

---

## 🎮 배틀 UI

**위치**: `src/components/BattleScreen.jsx`

**상태**:
- `loading`: 배틀 준비 중
- `ready`: 라운드 준비 모달
- `playing`: 배틀 진행 중
- `victory`: 승리 모달
- `result`: 패배 결과

**애니메이션**:
- 발사체 발사
- HIT!/MISS 텍스트
- 회피 애니메이션

---

## 📝 관련 파일

- `src/logic/battle/calculator.js` - 배틀 계산
- `src/logic/battle/hitrate.js` - 히트레이트 계산
- `src/logic/battle/types.js` - 속성 상성
- `src/logic/battle/questEngine.js` - 퀘스트 엔진
- `src/components/BattleScreen.jsx` - 배틀 UI
- `src/hooks/useGameActions.js` - 배틀 완료 처리

---

**작성일**: 2026-01-XX
