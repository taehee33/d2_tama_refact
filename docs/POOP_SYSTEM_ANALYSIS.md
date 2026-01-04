# Poop(똥) 시스템 분석 문서

## 📋 목차
1. [개요](#개요)
2. [데이터 구조](#데이터-구조)
3. [똥 생성 로직](#똥-생성-로직)
4. [똥 청소 로직](#똥-청소-로직)
5. [부상 및 케어 미스 처리](#부상-및-케어-미스-처리)
6. [UI 표시](#ui-표시)
7. [주요 파일](#주요-파일)
8. [로직 흐름도](#로직-흐름도)

---

## 개요

Poop 시스템은 디지몬이 일정 주기마다 똥을 생성하고, 8개가 쌓이면 부상 상태가 되며, 8시간 이상 방치하면 추가 부상이 발생하는 시스템입니다.

### 핵심 기능
1. **똥 생성**: `poopTimer` 주기마다 자동 생성 (최대 8개)
2. **부상 발생**: 똥이 8개가 되면 `isInjured = true`
3. **추가 부상**: 8개 상태를 8시간 이상 방치하면 `injuries++`
4. **똥 청소**: 사용자가 청소하면 모든 똥 제거 및 부상 해제

---

## 데이터 구조

### 스탯 필드

```javascript
{
  poopCount: 0,           // 현재 똥 개수 (0-8)
  poopTimer: 3,           // 똥 생성 주기 (분 단위)
  poopCountdown: 180,     // 똥 생성 타이머 카운트다운 (초 단위)
  lastMaxPoopTime: null,  // 똥이 8개가 된 시간 (timestamp)
  isInjured: false,       // 부상 상태 (똥 8개 시 true)
  injuredAt: null,        // 부상 당한 시간
  injuries: 0,            // 누적 부상 횟수 (15회 시 사망)
}
```

### 디지몬별 poopCycle (분 단위)

| Stage | poopCycle | 설명 |
|-------|-----------|------|
| Baby I | 3분 | 매우 자주 생성 |
| Baby II | 3분 | 매우 자주 생성 |
| Child | 60분 | 1시간마다 생성 |
| Adult+ | 120분 | 2시간마다 생성 |

**데이터 위치**: `digimons.js`의 `stats.poopCycle`

---

## 똥 생성 로직

### 1. 실시간 업데이트 (`updateLifespan`)

**파일**: `src/logic/stats/stats.js` (121-150줄)

```javascript
// 똥 생성 (poopCycle에 따라)
if (s.poopTimer > 0) {
  s.poopCountdown -= deltaSec;  // 1초마다 감소
  if (s.poopCountdown <= 0) {
    if (s.poopCount < 8) {
      // 똥 개수 증가
      s.poopCount++;
      s.poopCountdown = s.poopTimer * 60;  // 타이머 리셋
      
      // 8개가 되면 시간 기록
      if (s.poopCount === 8 && !s.lastMaxPoopTime) {
        s.lastMaxPoopTime = Date.now();
      }
    } else {
      // 이미 8개 이상
      if (!s.lastMaxPoopTime) {
        s.lastMaxPoopTime = Date.now();
      } else {
        // 8시간(28800초) 지났다면 부상
        const e = (Date.now() - s.lastMaxPoopTime) / 1000;
        if (e >= 28800) {
          s.injuries++;           // 부상 횟수 증가
          s.injuredAt = Date.now();
          s.lastMaxPoopTime = Date.now(); // 리셋
        }
      }
      s.poopCountdown = s.poopTimer * 60;
    }
  }
}
```

**특징**:
- ✅ 수면 중에는 타이머가 감소하지 않음 (`!isSleeping` 체크)
- ✅ 최대 8개까지만 생성
- ✅ 8개가 되면 `lastMaxPoopTime` 기록
- ✅ 8시간 방치 시 `injuries++` (부상 횟수 증가)

### 2. Lazy Update (`applyLazyUpdate`)

**파일**: `src/logic/stats/stats.js` (249-284줄)

```javascript
// 배변 처리
if (updatedStats.poopTimer > 0) {
  updatedStats.poopCountdown -= elapsedSeconds;
  
  while (updatedStats.poopCountdown <= 0) {
    if (updatedStats.poopCount < 8) {
      updatedStats.poopCount++;
      updatedStats.poopCountdown += updatedStats.poopTimer * 60;
      
      if (updatedStats.poopCount === 8 && !updatedStats.lastMaxPoopTime) {
        const timeToMax = lastSaved.getTime() + 
          (elapsedSeconds - updatedStats.poopCountdown) * 1000;
        updatedStats.lastMaxPoopTime = timeToMax;
      }
    } else {
      // 8개 이상 처리
      if (!updatedStats.lastMaxPoopTime) {
        const timeToMax = lastSaved.getTime() + 
          (elapsedSeconds - updatedStats.poopCountdown) * 1000;
        updatedStats.lastMaxPoopTime = timeToMax;
      } else {
        const lastMaxTime = typeof updatedStats.lastMaxPoopTime === "number"
          ? updatedStats.lastMaxPoopTime
          : new Date(updatedStats.lastMaxPoopTime).getTime();
        const elapsedSinceMax = (now.getTime() - lastMaxTime) / 1000;
        
        if (elapsedSinceMax >= 28800) {
          updatedStats.injuries++;
          updatedStats.injuredAt = now.getTime();
          updatedStats.lastMaxPoopTime = now.getTime();
        }
      }
      updatedStats.poopCountdown += updatedStats.poopTimer * 60;
    }
  }
}
```

**특징**:
- ✅ 오프라인 시간도 계산하여 똥 생성
- ✅ `while` 루프로 여러 개 생성 가능
- ✅ 정확한 시간 계산 (경과 시간 기반)

### 3. 부상 상태 설정

**파일**: `src/data/stats.js` (272-278줄)

```javascript
// 똥 8개 시 부상 상태 설정
if (updatedStats.poopCount >= 8 && !updatedStats.isInjured) {
  updatedStats.isInjured = true;
  if (!updatedStats.injuredAt) {
    updatedStats.injuredAt = Date.now();
  }
}
```

**특징**:
- ✅ `poopCount >= 8`이면 `isInjured = true`
- ✅ 부상 시간 기록

---

## 똥 청소 로직

### 1. 청소 핸들러 (`handleCleanPoop`)

**파일**: `src/hooks/useGameActions.js` (492-502줄)

```javascript
const handleCleanPoop = async () => {
  // 액션 전 Lazy Update 적용
  const updatedStats = await applyLazyUpdateBeforeAction();
  if(updatedStats.poopCount <= 0){
    return;  // 똥이 없으면 종료
  }
  setDigimonStats(updatedStats);
  setShowPoopCleanAnimation(true);  // 청소 애니메이션 시작
  setCleanStep(0);
  cleanCycle(0);
};
```

**특징**:
- ✅ Lazy Update 먼저 적용
- ✅ 똥이 없으면 종료
- ✅ 청소 애니메이션 시작

### 2. 청소 사이클 (`cleanCycle`)

**파일**: `src/hooks/useGameActions.js` (507-563줄)

```javascript
const cleanCycle = async (step) => {
  if(step > 3){
    // 애니메이션 완료
    setShowPoopCleanAnimation(false);
    setCleanStep(0);
    
    setDigimonStats((prevStats) => {
      const oldPoopCount = prevStats.poopCount || 0;
      const wasInjured = prevStats.isInjured || false;
      
      const updatedStats = {
        ...prevStats,
        poopCount: 0,              // 모든 똥 제거
        lastMaxPoopTime: null,     // 시간 기록 리셋
        isInjured: false,          // 부상 상태 해제
        lastSavedAt: now
      };
      
      // Activity Log 추가
      let logText = `Cleaned Poop (Full flush, ${oldPoopCount} → 0)`;
      if (wasInjured) {
        logText += ' - Injury healed!';
      }
      
      // Firestore 저장
      // ...
      
      return statsWithLogs;
    });
    return;
  }
  
  // 다음 애니메이션 단계
  setCleanStep(step);
  setTimeout(() => cleanCycle(step + 1), 400);
};
```

**특징**:
- ✅ 4단계 애니메이션 (step 0-3)
- ✅ 모든 똥 제거 (`poopCount = 0`)
- ✅ 부상 상태 해제 (`isInjured = false`)
- ✅ Activity Log 기록
- ✅ Firestore 저장

---

## 부상 및 케어 미스 처리

### 부상 발생 조건

1. **똥 8개 달성**
   - `poopCount >= 8` → `isInjured = true`
   - `lastMaxPoopTime` 기록

2. **8시간 방치**
   - `lastMaxPoopTime`으로부터 8시간(28800초) 경과
   - `injuries++` (부상 횟수 증가)
   - `injuredAt` 업데이트
   - `lastMaxPoopTime` 리셋

### 부상 해제 조건

1. **똥 청소**
   - `handleCleanPoop` 실행 시
   - `isInjured = false`
   - `poopCount = 0`
   - `lastMaxPoopTime = null`

### 사망 조건

- `injuries >= 15` → 사망 (`isDead = true`)
- 부상 횟수가 15회 이상이면 디지몬 사망

---

## UI 표시

### 1. Canvas에 똥 렌더링

**파일**: `src/components/Canvas.jsx` (187-217줄)

```javascript
// 똥 표시 (정확한 개수만큼 렌더링)
const validPoopCount = Math.min(Math.max(0, poopCount), 8);
Array.from({ length: validPoopCount }).forEach((_, i) => {
  // 위치 계산 (분산 배치)
  const posIndex = i % poopPositions.length;
  const pos = poopPositions[posIndex];
  
  // 오프셋 추가 (겹치지 않도록)
  const offsetX = Math.sin(i * 0.5) * (width * 0.03);
  const offsetY = Math.cos(i * 0.7) * (height * 0.02);
  
  // 둥둥 떠다니는 애니메이션
  const floatOffset = Math.sin(frame * 0.05 + i) * 2;
  
  ctx.drawImage(poopImg, px, py + floatOffset, pw, ph);
});
```

**특징**:
- ✅ `poopCount`만큼 정확히 렌더링
- ✅ 위치 분산 (겹치지 않도록)
- ✅ 둥둥 떠다니는 애니메이션

### 2. 상태 배지 표시

**파일**: `src/components/DigimonStatusBadges.jsx`

```javascript
// 똥 8개: 위험
if (poopCount >= 8) {
  messages.push({ 
    text: "똥이 너무 많아요! 💩🚨", 
    category: "critical",
    priority: 2 
  });
}
// 똥 6개 이상: 경고
else if (poopCount >= 6) {
  messages.push({ 
    text: "똥이 많아요! 💩", 
    category: "warning",
    priority: 3 
  });
}
```

### 3. StatsPopup 표시

**파일**: `src/components/StatsPopup.jsx`

```javascript
<li>PoopTimer: {poopTimer || 0} min (남은 시간: {formatCountdown(poopCountdown)})</li>
<li>PoopCount: {poopCount}/8</li>
<li>LastMaxPoopTime: {formatTimestamp(lastMaxPoopTime)}</li>
```

---

## 주요 파일

### 핵심 로직 파일

1. **`src/logic/stats/stats.js`**
   - `updateLifespan()`: 실시간 똥 생성
   - `applyLazyUpdate()`: 오프라인 시간 계산

2. **`src/data/stats.js`**
   - `updateLifespan()`: 구 버전 (수면 중 타이머 정지)
   - 부상 상태 설정

3. **`src/hooks/useGameActions.js`**
   - `handleCleanPoop()`: 청소 핸들러
   - `cleanCycle()`: 청소 애니메이션

### UI 파일

4. **`src/components/Canvas.jsx`**
   - 똥 렌더링
   - 청소 애니메이션

5. **`src/components/DigimonStatusBadges.jsx`**
   - 똥 상태 배지 표시

6. **`src/components/StatsPopup.jsx`**
   - 똥 관련 스탯 표시

### 데이터 파일

7. **`src/data/v1/digimons.js`**
   - `stats.poopCycle`: 디지몬별 똥 생성 주기

---

## 로직 흐름도

### 똥 생성 흐름

```
[게임 시작]
    ↓
[poopTimer 설정] (디지몬별로 다름: 3분/60분/120분)
    ↓
[poopCountdown 감소] (1초마다)
    ↓
[poopCountdown <= 0?]
    ├─ No → 계속 감소
    └─ Yes → poopCount++
         ↓
    [poopCount < 8?]
         ├─ Yes → 타이머 리셋, 계속 생성
         └─ No (8개 달성)
              ↓
         [lastMaxPoopTime 기록]
              ↓
         [isInjured = true] (부상 상태)
              ↓
         [8시간 경과?]
              ├─ No → 대기
              └─ Yes → injuries++, lastMaxPoopTime 리셋
```

### 똥 청소 흐름

```
[사용자가 청소 버튼 클릭]
    ↓
[handleCleanPoop() 호출]
    ↓
[Lazy Update 적용]
    ↓
[똥이 있나?]
    ├─ No → 종료
    └─ Yes → 청소 애니메이션 시작
         ↓
    [cleanCycle(0) 시작]
         ↓
    [4단계 애니메이션] (step 0-3, 400ms 간격)
         ↓
    [애니메이션 완료]
         ↓
    [poopCount = 0]
    [lastMaxPoopTime = null]
    [isInjured = false]
         ↓
    [Activity Log 추가]
         ↓
    [Firestore 저장]
```

---

## 주요 특징

### ✅ 잘 구현된 부분

1. **정확한 시간 계산**
   - 실시간 업데이트와 Lazy Update 모두 정확히 계산
   - 수면 중 타이머 정지

2. **부상 시스템**
   - 8개 달성 시 즉시 부상
   - 8시간 방치 시 추가 부상
   - 청소 시 부상 해제

3. **UI/UX**
   - 똥 개수만큼 정확히 렌더링
   - 상태 배지로 경고 표시
   - 청소 애니메이션

4. **데이터 저장**
   - Firestore에 정확히 저장
   - Activity Log 기록

### ⚠️ 주의사항

1. **두 곳에서 로직 구현**
   - `logic/stats/stats.js` (새 버전)
   - `data/stats.js` (구 버전)
   - 둘 다 사용 중이므로 일관성 유지 필요

2. **부상 횟수 vs 부상 상태**
   - `injuries`: 누적 부상 횟수 (15회 시 사망)
   - `isInjured`: 현재 부상 상태 (똥 8개 시 true)
   - 구분하여 사용

3. **타이머 필드명**
   - 새 구조: `stats.poopCycle`
   - 구 구조: `poopTimer`
   - 어댑터로 변환 중

---

## 참고 문서

- [STATS_ANALYSIS.md](./STATS_ANALYSIS.md) - 스탯 전체 분석
- [ACTION_LOGIC_ANALYSIS.md](./ACTION_LOGIC_ANALYSIS.md) - 액션 로직 분석
- [REFACTORING_LOG.md](./REFACTORING_LOG.md) - 리팩토링 이력

---

**작성일**: 2026-01-XX  
**상태**: 현재 구현 완료 ✅

