# Stats 업데이트 시스템 분석 및 제안 코드 비교

## 📋 현재 코드 분석

### 현재 `handleTrainResult` 함수 구조

```javascript
const handleTrainResult = async (userSelections) => {
  // 1. Lazy Update 적용 (최신 스탯 가져오기)
  const updatedStats = await applyLazyUpdateBeforeAction();
  
  // 2. 수면 중 체크 및 처리
  if (nowSleeping) {
    // 수면 방해 로그 추가
    setDigimonStats((prevStats) => { ... });
  }
  
  // 3. 스탯 업데이트
  setDigimonStats(updatedStats);
  
  // 4. 에너지 부족 체크
  if (energy <= 0) {
    // 에너지 부족 로그 추가
    setDigimonStats((prevStats) => { ... });
    return;
  }
  
  // 5. 훈련 로직 실행
  const result = doVer1Training(updatedStats, userSelections);
  let finalStats = result.updatedStats;
  
  // 6. 호출 해제 처리
  if (finalStats.strength > 0) {
    finalStats = resetCallStatus(finalStats, 'strength');
  }
  
  // 7. 로그 텍스트 생성
  let logText = result.isSuccess 
    ? `Training: Success (Str +${strengthDelta}, Wt ${weightDelta}g)`
    : `Training: Fail (Wt ${weightDelta}g)`;
  
  // 8. 통합 업데이트: 스탯 + 로그를 한 번에 처리
  setDigimonStats((prevStats) => {
    const newLog = { type: 'TRAIN', text: logText, timestamp: Date.now() };
    const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 50);
    const finalStatsWithLogs = {
      ...finalStats,
      activityLogs: updatedLogs
    };
    
    // 9. Firestore 저장 (비동기)
    setDigimonStatsAndSave(finalStatsWithLogs, updatedLogs).catch(...);
    
    return finalStatsWithLogs;
  });
};
```

### 현재 시스템의 작동 방식

#### 1. **State 관리 구조**
- `useGameState.js`에서 `useState`로 `digimonStats` 관리
- `setDigimonStats`는 React의 `setState` 함수
- `activityLogs`는 `digimonStats.activityLogs`에 포함되어 함께 관리

#### 2. **업데이트 패턴 (Atomic Update)**
```javascript
setDigimonStats((prevStats) => {
  // 1. 새 로그 생성
  const newLog = { ... };
  
  // 2. 로그 배열 업데이트
  const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 50);
  
  // 3. 스탯과 로그를 함께 반환
  return {
    ...finalStats,  // 스탯 변경사항
    activityLogs: updatedLogs  // 로그도 함께
  };
});
```

**장점:**
- ✅ 스탯과 로그가 **원자적으로(atomically)** 업데이트됨
- ✅ React의 함수형 업데이트로 **이전 상태를 보장**받음
- ✅ **Race condition 방지**

#### 3. **저장 로직**
- `setDigimonStatsAndSave`는 `setDigimonStats` + Firestore 저장을 함께 처리
- 함수형 업데이트 **내부**에서 호출하여 최신 상태를 저장

---

## 🔄 제안된 코드 분석

### 제안된 `handleTrainResult` 함수

```javascript
const handleTrainResult = (success) => {
  setStats(prev => {
    // 1. 로그 내용 미리 생성
    const newLog = { 
      text: success ? "훈련 성공! (힘 +1, 무게 -2g)" : "훈련 실패...", 
      type: 'TRAIN', 
      timestamp: Date.now() 
    };

    // 2. 스탯 계산 + 로그 합치기 (동시 리턴)
    return {
      ...prev,
      // 스탯 변경
      weight: Math.max(0, prev.weight - 2),
      strength: success ? prev.strength + 1 : prev.strength,
      energy: Math.max(0, prev.energy - 2),
      // 로그 변경 (여기서 같이 함!)
      activityLogs: [newLog, ...(prev.activityLogs || [])].slice(0, 50)
    };
  });
  
  // 주의: 여기서 addActivityLog()를 또 부르지 마세요!
};
```

### 제안 코드의 특징

#### ✅ 장점
1. **단순함**: 복잡한 로직 없이 핵심만 처리
2. **명확함**: 스탯 계산과 로그 추가가 한 곳에
3. **원자성**: 함수형 업데이트로 스탯과 로그가 동시에 업데이트

#### ⚠️ 차이점 (현재 코드와 비교)

| 항목 | 현재 코드 | 제안 코드 |
|------|----------|----------|
| **함수명** | `setDigimonStats` | `setStats` |
| **파라미터** | `userSelections` (배열) | `success` (boolean) |
| **Lazy Update** | ✅ `applyLazyUpdateBeforeAction()` | ❌ 없음 |
| **수면 체크** | ✅ 있음 | ❌ 없음 |
| **에너지 체크** | ✅ 있음 | ❌ 없음 |
| **훈련 로직** | ✅ `doVer1Training()` | ❌ 직접 계산 |
| **호출 해제** | ✅ `resetCallStatus()` | ❌ 없음 |
| **저장 로직** | ✅ `setDigimonStatsAndSave()` | ❌ 없음 |
| **로그 포맷** | 상세 (델타 계산) | 단순 (고정 텍스트) |

---

## 🔍 제안 코드 적용 시 예상 동작

### 1. **함수 시그니처 변경**
```javascript
// 현재
handleTrainResult(userSelections)  // ["U", "D", "U", "D", "U"]

// 제안
handleTrainResult(success)  // true 또는 false
```

**영향:**
- 호출하는 쪽에서 `doVer1Training` 결과를 미리 계산해야 함
- 또는 `handleTrainResult` 내부에서 `doVer1Training`을 호출해야 함

### 2. **State 업데이트 흐름**

#### 현재 흐름:
```
1. applyLazyUpdateBeforeAction() → 최신 스탯
2. doVer1Training() → 훈련 결과 계산
3. setDigimonStats((prev) => { ... }) → 스탯 + 로그 업데이트
4. setDigimonStatsAndSave() → Firestore 저장
```

#### 제안 코드 흐름:
```
1. setStats((prev) => { ... }) → 스탯 + 로그 업데이트
   (끝)
```

**영향:**
- ✅ 더 단순함
- ❌ Lazy Update가 적용되지 않음 (시간 경과 반영 안 됨)
- ❌ Firestore 저장이 없음 (데이터 손실 가능)

### 3. **로그 포맷**

#### 현재:
```javascript
"Training: Success (Str +1, Wt -2g)"
"Training: Fail (Wt -2g)"
```

#### 제안:
```javascript
"훈련 성공! (힘 +1, 무게 -2g)"
"훈련 실패..."
```

**영향:**
- ✅ 한국어로 더 읽기 쉬움
- ⚠️ 델타 값이 하드코딩됨 (실제 계산값과 다를 수 있음)

### 4. **스탯 계산**

#### 현재:
```javascript
const result = doVer1Training(updatedStats, userSelections);
// result.updatedStats에 모든 계산된 스탯 포함
```

#### 제안:
```javascript
weight: Math.max(0, prev.weight - 2),
strength: success ? prev.strength + 1 : prev.strength,
energy: Math.max(0, prev.energy - 2),
```

**영향:**
- ⚠️ 하드코딩된 값 (실제 `doVer1Training` 로직과 다를 수 있음)
- ⚠️ `trainings` 카운트, `battlesForEvolution` 등 다른 필드 업데이트 없음

---

## 💡 제안 코드 적용 시 필요한 수정

### 옵션 1: 제안 코드를 그대로 적용 (단순화)

**장점:**
- 코드가 매우 단순해짐
- 이해하기 쉬움

**단점:**
- Lazy Update 누락
- Firestore 저장 누락
- 실제 훈련 로직과 불일치 가능

### 옵션 2: 제안 코드 패턴 + 현재 로직 유지 (하이브리드)

```javascript
const handleTrainResult = async (userSelections) => {
  // 1. Lazy Update 적용
  const updatedStats = await applyLazyUpdateBeforeAction();
  
  // 2. 수면/에너지 체크 (기존 로직 유지)
  // ...
  
  // 3. 훈련 로직 실행
  const result = doVer1Training(updatedStats, userSelections);
  let finalStats = result.updatedStats;
  
  // 4. 호출 해제
  if (finalStats.strength > 0) {
    finalStats = resetCallStatus(finalStats, 'strength');
  }
  
  // 5. 제안 코드 패턴 적용: 스탯 + 로그를 한 번에 업데이트
  setDigimonStats((prevStats) => {
    const newLog = {
      type: 'TRAIN',
      text: result.isSuccess 
        ? "훈련 성공! (힘 +1, 무게 -2g)" 
        : "훈련 실패...",
      timestamp: Date.now()
    };
    
    return {
      ...finalStats,  // 실제 계산된 스탯
      activityLogs: [newLog, ...(prevStats.activityLogs || [])].slice(0, 50)
    };
  });
  
  // 6. 저장 (별도 호출)
  setDigimonStatsAndSave(finalStats, updatedLogs);
};
```

**장점:**
- ✅ 제안 코드의 단순한 패턴 유지
- ✅ 현재 로직의 모든 기능 보존
- ✅ 실제 계산값 사용

---

## 🎯 결론

### 제안 코드의 핵심 아이디어
**"스탯 계산과 로그 추가를 하나의 함수형 업데이트로 통합"**

이 아이디어는 **현재 코드에도 이미 적용되어 있습니다!**

현재 코드의 430-455번째 줄이 바로 이 패턴을 사용하고 있습니다:

```javascript
setDigimonStats((prevStats) => {
  const newLog = { ... };
  const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 50);
  return {
    ...finalStats,
    activityLogs: updatedLogs
  };
});
```

### 제안 코드를 적용하면?

1. **함수 시그니처 단순화**: `userSelections` → `success`
2. **로직 단순화**: 복잡한 체크 제거
3. **하지만 기능 손실**: Lazy Update, 저장, 실제 계산 로직 등

### 권장 사항

**제안 코드의 패턴은 이미 적용되어 있으므로, 추가 수정은 필요 없습니다.**

만약 더 단순화하고 싶다면:
- 제안 코드의 **패턴**은 유지 (함수형 업데이트로 통합)
- 현재 코드의 **로직**은 유지 (Lazy Update, 저장, 실제 계산)

이렇게 하면 **단순함과 기능을 모두** 유지할 수 있습니다.

