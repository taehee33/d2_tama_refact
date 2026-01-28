# Firestore 데이터베이스 구조 분석

**작성일:** 2026년 1월 28일  
**분석 대상:** Firestore 슬롯 데이터 구조 및 저장 패턴

## 📋 개요

현재 Firestore에 저장되는 데이터 구조를 분석하여 중복 데이터와 불필요한 쓰기 빈도를 확인했습니다.

## 🔍 발견된 문제점

### 1. 중복 데이터 저장

#### 문제 1-1: `isLightsOn` 중복 저장

**현재 구조:**
```javascript
{
  // 루트 레벨
  isLightsOn: true,
  
  // digimonStats 내부
  digimonStats: {
    isLightsOn: true,  // ❌ 중복
    // ... 기타 스탯
  }
}
```

**원인:**
- `useGameData.js`의 `saveStats` 함수 (203-204줄)에서 `finalStats`에 `isLightsOn`을 포함
- `finalStats`는 `digimonStats`로 저장됨 (230줄)
- 동시에 루트 레벨에도 `isLightsOn` 저장 (231줄)

**코드 위치:**
```javascript:203:232:digimon-tamagotchi-frontend/src/hooks/useGameData.js
const finalStats = {
  ...mergedStats,
  ...newStats,
  activityLogs: finalLogs,
  isLightsOn,        // ❌ digimonStats 내부에 포함됨
  wakeUntil,         // ❌ digimonStats 내부에 포함됨
  dailySleepMistake,
  lastSavedAt: now,
};

// ...

const updateData = {
  digimonStats: statsWithoutProteinCount,  // isLightsOn, wakeUntil 포함
  isLightsOn,                              // ❌ 루트 레벨에도 저장
  wakeUntil,                               // ❌ 루트 레벨에도 저장
  lastSavedAt: statsWithoutProteinCount.lastSavedAt,
  updatedAt: now,
};
```

**영향:**
- 불필요한 저장 공간 사용
- 데이터 일관성 문제 가능성 (두 값이 다를 수 있음)
- 읽기 시 어느 값을 사용해야 할지 혼란

#### 문제 1-2: `wakeUntil` 중복 저장

**현재 구조:**
```javascript
{
  // 루트 레벨
  wakeUntil: 1769610218917,
  
  // digimonStats 내부
  digimonStats: {
    wakeUntil: 1769610218917,  // ❌ 중복
    // ... 기타 스탯
  }
}
```

**원인:** `isLightsOn`과 동일한 패턴

#### 문제 1-3: `lastSavedAt` 중복 가능성

**현재 구조:**
```javascript
{
  // 루트 레벨
  lastSavedAt: Timestamp,
  
  // digimonStats 내부
  digimonStats: {
    lastSavedAt: Timestamp,  // ❌ 중복
    // ... 기타 스탯
  }
}
```

**원인:**
- `finalStats`에 `lastSavedAt` 포함 (206줄)
- 루트 레벨에도 `lastSavedAt` 저장 (233줄)

### 2. 쓰기 빈도 분석

#### 정상적인 쓰기 패턴

✅ **사용자 액션 기반 저장 (정상)**
- 먹이주기, 훈련, 배틀 등 사용자 액션마다 `setDigimonStatsAndSave` 호출
- Lazy Update 패턴 사용으로 불필요한 쓰기 방지
- 1초 타이머는 UI만 업데이트하고 저장하지 않음 (좋음)

#### 잠재적 문제: 직접 `updateDoc` 호출

⚠️ **일부 코드에서 `setDigimonStatsAndSave` 대신 직접 `updateDoc` 호출**

**발견된 위치:**
1. `Game.jsx` (662줄) - 사망 로그 저장
2. `useGameAnimations.js` (214줄, 221줄) - 청소 애니메이션 중 저장
3. `useGameHandlers.js` (312줄) - 조명 토글 후 추가 저장
4. `SelectScreen.jsx` (343줄, 442줄, 463줄, 575줄) - 슬롯 관리

**문제점:**
- `setDigimonStatsAndSave`를 통하지 않고 직접 저장하면:
  - 중복 저장 가능성
  - 일관성 없는 저장 패턴
  - 디버깅 어려움

**예시 코드:**
```javascript:214:224:digimon-tamagotchi-frontend/src/hooks/useGameAnimations.js
// Firestore에도 저장 (비동기 처리)
if (slotId && currentUser) {
  const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
  updateDoc(slotRef, {
    digimonStats: { ...updatedStats, activityLogs: updatedLogs },
    isLightsOn,
    wakeUntil: nowSleeping ? updatedStats.wakeUntil : wakeUntil,
    lastSavedAt: now,
    updatedAt: now,
  }).catch((error) => {
    console.error("청소 상태 저장 오류:", error);
  });
}
```

이 코드는 `setDigimonStatsAndSave`를 호출한 후 추가로 `updateDoc`을 호출하여 중복 저장을 발생시킬 수 있습니다.

### 3. Activity Logs 저장 패턴

✅ **현재는 정상적으로 처리됨**

**코드:**
```javascript:242:243:digimon-tamagotchi-frontend/src/hooks/useGameData.js
// Activity Logs는 digimonStats 안에 이미 포함되어 있으므로 별도 저장 불필요
// (중복 저장 방지)
```

`activityLogs`는 `digimonStats.activityLogs`에만 저장되고 루트 레벨에는 저장하지 않습니다. (정상)

## 💡 권장 해결 방안

### 해결책 1: `digimonStats`에서 중복 필드 제거

**수정 위치:** `useGameData.js` - `saveStats` 함수

**변경 전:**
```javascript
const finalStats = {
  ...mergedStats,
  ...newStats,
  activityLogs: finalLogs,
  isLightsOn,        // ❌ 제거 필요
  wakeUntil,         // ❌ 제거 필요
  dailySleepMistake,
  lastSavedAt: now,
};
```

**변경 후:**
```javascript
const finalStats = {
  ...mergedStats,
  ...newStats,
  activityLogs: finalLogs,
  dailySleepMistake,  // digimonStats 내부에만 저장
  lastSavedAt: now,    // digimonStats 내부에만 저장
  // isLightsOn, wakeUntil은 루트 레벨에만 저장
};
```

**이유:**
- `isLightsOn`, `wakeUntil`은 슬롯 레벨의 설정이므로 루트 레벨에만 저장하는 것이 적절
- `digimonStats`는 디지몬의 상태만 포함해야 함

### 해결책 2: `lastSavedAt` 통합

**옵션 A: 루트 레벨에만 저장 (권장)**
```javascript
const updateData = {
  digimonStats: statsWithoutProteinCount,
  isLightsOn,
  wakeUntil,
  lastSavedAt: now,  // 루트 레벨에만
  updatedAt: now,
};
```

**옵션 B: `digimonStats` 내부에만 저장**
```javascript
const finalStats = {
  ...mergedStats,
  ...newStats,
  lastSavedAt: now,  // digimonStats 내부에만
};

const updateData = {
  digimonStats: statsWithoutProteinCount,  // lastSavedAt 포함
  isLightsOn,
  wakeUntil,
  updatedAt: now,
};
```

**권장:** 옵션 A (루트 레벨에만 저장)
- 슬롯 전체의 마지막 저장 시간이므로 루트 레벨이 적절
- `digimonStats`는 디지몬 상태만 포함

### 해결책 3: 직접 `updateDoc` 호출 제거

**모든 저장은 `setDigimonStatsAndSave`를 통하도록 통일**

**수정 예시:**
```javascript
// ❌ 변경 전
if (slotId && currentUser) {
  const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
  updateDoc(slotRef, {
    digimonStats: { ...updatedStats, activityLogs: updatedLogs },
    // ...
  });
}

// ✅ 변경 후
await setDigimonStatsAndSave(updatedStats, updatedLogs);
```

**예외:**
- `SelectScreen.jsx`의 슬롯 관리 기능은 별도 처리 가능 (슬롯 메타데이터만 변경)

## 📊 예상 효과

### 저장 공간 절감
- 중복 필드 제거로 약 **10-20% 저장 공간 절감** (필드 크기에 따라 다름)

### 쓰기 비용 절감
- 중복 저장 제거로 **불필요한 Firestore 쓰기 감소**
- 일관된 저장 패턴으로 **디버깅 시간 단축**

### 데이터 일관성 향상
- 단일 소스 원칙 준수
- 데이터 불일치 가능성 제거

## 🔄 마이그레이션 계획

### 1단계: 코드 수정
1. `useGameData.js`에서 중복 필드 제거
2. 직접 `updateDoc` 호출을 `setDigimonStatsAndSave`로 변경

### 2단계: 기존 데이터 정리 (선택사항)
```javascript
// Firestore 함수 또는 스크립트로 기존 데이터 정리
const cleanupDuplicateFields = async (userId, slotId) => {
  const slotRef = doc(db, 'users', userId, 'slots', `slot${slotId}`);
  const slotData = await getDoc(slotRef);
  
  if (slotData.exists()) {
    const data = slotData.data();
    const digimonStats = data.digimonStats || {};
    
    // 중복 필드 제거
    const { isLightsOn, wakeUntil, lastSavedAt, ...cleanedStats } = digimonStats;
    
    await updateDoc(slotRef, {
      digimonStats: cleanedStats,
      // 루트 레벨 값 유지
    });
  }
};
```

## ✅ 체크리스트

- [ ] `useGameData.js`에서 `digimonStats` 내부의 `isLightsOn`, `wakeUntil` 제거
- [ ] `lastSavedAt` 저장 위치 통일 (루트 레벨 권장)
- [ ] 직접 `updateDoc` 호출을 `setDigimonStatsAndSave`로 변경
- [ ] 모든 저장 경로가 `setDigimonStatsAndSave`를 통하도록 확인
- [ ] 테스트: Firebase와 localStorage 양쪽에서 정상 작동 확인
- [ ] `REFACTORING_LOG.md` 업데이트

## 📝 참고

- **Lazy Update 패턴:** 이미 잘 구현되어 있음 ✅
- **Activity Logs:** 중복 저장 방지됨 ✅
- **1초 타이머:** 저장하지 않음 ✅

---

**다음 단계:** 코드 수정 및 테스트 진행
