# 사망 원인 확인 불가 문제 분석 및 개선 방안

## 📋 현재 문제점

### 1. 문제 현상
- 사망한 디지몬의 상태를 확인할 때 "사망 원인 확인 불가"가 표시됨
- 새로고침 후 사망 원인이 사라짐

### 2. 근본 원인 분석

#### 2.1 `deathReason`이 State로만 관리됨
**위치:** `src/hooks/useGameState.js`
```javascript
const [deathReason, setDeathReason] = useState(null);
```

**문제:**
- `deathReason`이 React state로만 관리되어 새로고침 시 초기화됨
- `digimonStats`에 저장되지 않아 영구적으로 보존되지 않음

#### 2.2 사망 시 `deathReason`이 `digimonStats`에 저장되지 않음

**위치 1:** `src/pages/Game.jsx` (375-413줄)
```javascript
if(updatedStats.fullness === 0 && updatedStats.lastHungerZeroAt && !updatedStats.isDead){
  const elapsed = (Date.now() - updatedStats.lastHungerZeroAt) / 1000;
  if(elapsed >= 43200){
    updatedStats.isDead = true;
    setDeathReason('STARVATION (굶주림)'); // ❌ state만 설정, digimonStats에 저장 안 함
  }
}
```

**위치 2:** `src/hooks/useGameData.js` (315-343줄)
```javascript
function checkDeathStatus(updated) {
  if (!digimonStats.isDead && updated.isDead) {
    // ... 사망 원인 추론 ...
    setDeathReason('STARVATION (굶주림)'); // ❌ state만 설정, digimonStats에 저장 안 함
  }
}
```

**문제:**
- `setDeathReason`만 호출하고 `updatedStats.deathReason`에 저장하지 않음
- 결과적으로 Firestore/localStorage에 저장되지 않음

#### 2.3 `applyLazyUpdate`에서 사망 원인을 설정하지 않음

**위치:** `src/data/stats.js` (409-458줄)
```javascript
if (elapsedSinceZero >= 43200) {
  updatedStats.isDead = true;
  // ❌ deathReason 설정 없음
}
```

**문제:**
- 오프라인 상태에서 사망한 경우, `applyLazyUpdate`에서 사망 원인을 추론하지 않음
- 새로고침 시 사망 원인이 null로 유지됨

#### 2.4 로드 시 `deathReason` 복원 로직 없음

**위치:** `src/hooks/useGameData.js` (loadSlot 함수)
```javascript
// ❌ digimonStats.deathReason을 deathReason state로 복원하는 로직 없음
```

**문제:**
- 저장된 `digimonStats.deathReason`이 있어도 state로 복원되지 않음

#### 2.5 `DeathPopup`에서 `digimonStats.deathReason` 미사용

**위치:** `src/components/DeathPopup.jsx` (4줄)
```javascript
export default function DeathPopup({ isOpen, onConfirm, onClose, reason, selectedDigimon, onNewStart, digimonStats = {} }) {
  const finalReason = reason; // ❌ digimonStats.deathReason을 우선 사용하지 않음
```

**문제:**
- `reason` prop이 null이면 `digimonStats.deathReason`을 확인하지 않음

---

## 💡 개선 방안

### 방안 1: `digimonStats.deathReason` 필드 추가 및 저장 (추천)

#### 1.1 사망 시 `deathReason`을 `digimonStats`에 저장

**수정 위치 1:** `src/pages/Game.jsx`
```javascript
if(updatedStats.fullness === 0 && updatedStats.lastHungerZeroAt && !updatedStats.isDead){
  const elapsed = (Date.now() - updatedStats.lastHungerZeroAt) / 1000;
  if(elapsed >= 43200){
    updatedStats.isDead = true;
    const reason = 'STARVATION (굶주림)';
    updatedStats.deathReason = reason; // ✅ digimonStats에 저장
    setDeathReason(reason);
  }
}
```

**수정 위치 2:** `src/hooks/useGameData.js` (checkDeathStatus)
```javascript
function checkDeathStatus(updated) {
  if (!digimonStats.isDead && updated.isDead) {
    let reason = null;
    if (updated.fullness === 0 && updated.lastHungerZeroAt) {
      const elapsed = (Date.now() - updated.lastHungerZeroAt) / 1000;
      if (elapsed >= 43200) {
        reason = 'STARVATION (굶주림)';
      }
    } else if (updated.strength === 0 && updated.lastStrengthZeroAt) {
      const elapsed = (Date.now() - updated.lastStrengthZeroAt) / 1000;
      if (elapsed >= 43200) {
        reason = 'EXHAUSTION (힘 소진)';
      }
    } else if ((updated.injuries || 0) >= 15) {
      reason = 'INJURY OVERLOAD (부상 과다: 15회)';
    } else if (updated.isInjured && updated.injuredAt) {
      const injuredTime = typeof updated.injuredAt === 'number'
        ? updated.injuredAt
        : new Date(updated.injuredAt).getTime();
      const elapsedSinceInjury = Date.now() - injuredTime;
      if (elapsedSinceInjury >= 21600000) {
        reason = 'INJURY NEGLECT (부상 방치: 6시간)';
      }
    } else {
      reason = 'OLD AGE (수명 다함)';
    }
    
    if (reason) {
      updated.deathReason = reason; // ✅ digimonStats에 저장
      setDeathReason(reason);
    }
  }
}
```

#### 1.2 `applyLazyUpdate`에서 사망 원인 추론 및 저장

**수정 위치:** `src/data/stats.js` (applyLazyUpdate 함수)
```javascript
// 배고픔이 0이고 12시간 경과 시 사망
if (elapsedSinceZero >= 43200) {
  updatedStats.isDead = true;
  updatedStats.deathReason = 'STARVATION (굶주림)'; // ✅ 사망 원인 저장
}

// 힘이 0이고 12시간 경과 시 사망
if (elapsedSinceZero >= 43200) {
  updatedStats.isDead = true;
  updatedStats.deathReason = 'EXHAUSTION (힘 소진)'; // ✅ 사망 원인 저장
}

// 부상 과다 사망
if ((updatedStats.injuries || 0) >= 15) {
  updatedStats.isDead = true;
  updatedStats.deathReason = 'INJURY OVERLOAD (부상 과다: 15회)'; // ✅ 사망 원인 저장
}

// 부상 방치 사망
if (elapsedSinceInjury >= 21600000) {
  updatedStats.isDead = true;
  updatedStats.deathReason = 'INJURY NEGLECT (부상 방치: 6시간)'; // ✅ 사망 원인 저장
}
```

#### 1.3 로드 시 `deathReason` 복원

**수정 위치:** `src/hooks/useGameData.js` (loadSlot 함수)
```javascript
// Firestore에서 로드
const savedStats = docSnap.data()?.digimonStats || {};
if (savedStats.deathReason) {
  setDeathReason(savedStats.deathReason); // ✅ 복원
}

// localStorage에서 로드
const savedStats = JSON.parse(localStorage.getItem(`slot${slotId}_stats`) || '{}');
if (savedStats.deathReason) {
  setDeathReason(savedStats.deathReason); // ✅ 복원
}
```

#### 1.4 `DeathPopup`에서 `digimonStats.deathReason` 우선 사용

**수정 위치:** `src/components/DeathPopup.jsx`
```javascript
export default function DeathPopup({ isOpen, onConfirm, onClose, reason, selectedDigimon, onNewStart, digimonStats = {} }) {
  // ✅ digimonStats.deathReason을 우선 사용, 없으면 reason prop 사용
  const finalReason = digimonStats.deathReason || reason;
  
  const reasonInfo = getDeathReasonInfo(finalReason);
  // ...
}
```

#### 1.5 `GameModals`에서 `digimonStats` 전달 확인

**수정 위치:** `src/components/GameModals.jsx`
```javascript
<DeathPopup
  isOpen={modals.deathModal}
  onConfirm={handleDeathConfirm || (() => {})}
  onClose={() => toggleModal?.('deathModal', false) || (() => {})}
  reason={deathReason}
  selectedDigimon={selectedDigimon}
  onNewStart={resetDigimon || (() => {})}
  digimonStats={digimonStats} // ✅ 이미 전달되고 있음 (확인 필요)
/>
```

#### 1.6 초기화 시 `deathReason` 리셋

**수정 위치:** `src/data/stats.js` (initializeStats 함수)
```javascript
// 새로운 시작이면 deathReason 리셋
if (isNewStart) {
  merged.deathReason = null; // ✅ 리셋
}
```

**수정 위치:** `src/data/stats.js` (applyLazyUpdate 함수)
```javascript
// 진화 시에는 deathReason을 유지 (사망한 상태에서 진화하는 경우는 없지만 안전을 위해)
// 새로운 시작이면 deathReason 리셋
if (isNewStart) {
  updatedStats.deathReason = null; // ✅ 리셋
}
```

---

## 📊 개선 효과

### 개선 전
- ❌ 새로고침 시 사망 원인 사라짐
- ❌ 오프라인 상태에서 사망 시 원인 추론 안 됨
- ❌ "사망 원인 확인 불가" 표시

### 개선 후
- ✅ 사망 원인이 `digimonStats`에 영구 저장
- ✅ 새로고침 후에도 사망 원인 유지
- ✅ 오프라인 상태에서도 사망 원인 추론 및 저장
- ✅ `digimonStats.deathReason` 우선 사용으로 안정성 향상

---

## 🔧 구현 우선순위

1. **높음:** `Game.jsx`와 `useGameData.js`에서 사망 시 `deathReason` 저장
2. **높음:** `applyLazyUpdate`에서 사망 원인 추론 및 저장
3. **중간:** 로드 시 `deathReason` 복원
4. **중간:** `DeathPopup`에서 `digimonStats.deathReason` 우선 사용
5. **낮음:** 초기화 시 `deathReason` 리셋

---

## ✅ 결론

**개선 가능 여부:** ✅ **가능**

**핵심 해결책:**
1. `digimonStats.deathReason` 필드 추가
2. 사망 시 `deathReason`을 `digimonStats`에 저장
3. 로드 시 `deathReason` 복원
4. `DeathPopup`에서 `digimonStats.deathReason` 우선 사용

이 개선을 통해 새로고침 후에도 사망 원인을 확인할 수 있게 됩니다.
