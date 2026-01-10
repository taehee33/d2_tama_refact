# TIRED 상태 케어미스 영속성 개선 방안

**작성일:** 2025-01-XX

## 📋 문제점 분석

### 현재 구현 방식

**위치:** `src/pages/Game.jsx` (940-976줄)

```javascript
const { tiredStartRef, tiredCountedRef } = refs;

useEffect(() => {
  const timer = setInterval(() => {
    const status = getSleepStatus({...});
    
    if (status === "TIRED") {
      if (!tiredStartRef.current) {
        tiredStartRef.current = Date.now();
        tiredCountedRef.current = false;
      }
      const threshold = developerMode ? 60 * 1000 : 30 * 60 * 1000;
      if (!tiredCountedRef.current && tiredStartRef.current && 
          (Date.now() - tiredStartRef.current) >= threshold) {
        tiredCountedRef.current = true;
        // careMistakes +1
      }
    } else {
      tiredStartRef.current = null;
      tiredCountedRef.current = false;
    }
  }, 1000);
}, [selectedDigimon, isLightsOn, wakeUntil, developerMode, digimonStats]);
```

### 문제점

1. **Ref는 새로고침 시 초기화됨**
   - `tiredStartRef.current`와 `tiredCountedRef.current`는 메모리 상태
   - 새로고침 시 `null`로 초기화됨

2. **시나리오 예시**
   - 사용자가 29분 동안 TIRED 상태 유지
   - 새로고침 발생
   - `tiredStartRef.current`가 `null`로 초기화
   - 다시 30분을 기다려야 케어미스 발생

3. **일관성 부족**
   - `sleepLightOnStart`는 `digimonStats`에 저장되어 영속성 보장
   - TIRED 케어미스는 ref 사용으로 일관성 부족

---

## 💡 개선 방안

### 제안: `digimonStats`에 타임스탬프 저장

`sleepLightOnStart` 패턴을 따라 `tiredStartAt`을 `digimonStats`에 저장합니다.

### 변경 사항

#### 1. `digimonStats`에 필드 추가

```javascript
digimonStats = {
  // ... 기존 필드
  tiredStartAt: null,        // TIRED 상태 시작 시간 (timestamp)
  tiredCounted: false,       // TIRED 케어미스 발생 여부 (세션 내)
}
```

#### 2. 타이머 useEffect에서 처리 (1초마다)

**위치:** `src/pages/Game.jsx` (타이머 useEffect, 276-423줄)

```javascript
// 수면 관련 스탯 업데이트
updatedStats.sleepDisturbances = updatedStats.sleepDisturbances || 0;

// TIRED 상태 체크 및 케어미스 처리
const currentSleepStatus = getSleepStatus({
  sleepSchedule: schedule,
  isLightsOn,
  wakeUntil,
  fastSleepStart: prevStats.fastSleepStart || null,
  now: nowDate,
});

if (currentSleepStatus === "TIRED") {
  // TIRED 상태 시작 시간 기록
  if (!updatedStats.tiredStartAt) {
    updatedStats.tiredStartAt = nowMs;
    updatedStats.tiredCounted = false;
  } else {
    // TIRED 상태 지속 시간 체크
    const elapsed = nowMs - updatedStats.tiredStartAt;
    const threshold = developerMode ? 60 * 1000 : 30 * 60 * 1000; // 테스트 모드는 1분, 기본 30분
    
    if (!updatedStats.tiredCounted && elapsed >= threshold) {
      updatedStats.careMistakes = (updatedStats.careMistakes || 0) + 1;
      updatedStats.tiredCounted = true;
      // Activity Log 추가
      const currentLogs = updatedStats.activityLogs || [];
      updatedStats.activityLogs = addActivityLog(
        currentLogs, 
        'CAREMISTAKE', 
        'Care Mistake: Tired for too long'
      );
    }
  }
} else {
  // TIRED 상태가 아니면 리셋
  updatedStats.tiredStartAt = null;
  updatedStats.tiredCounted = false;
}
```

#### 3. 기존 useEffect 제거

**제거 대상:** `src/pages/Game.jsx` (940-976줄)

기존의 `tiredStartRef`, `tiredCountedRef`를 사용하는 useEffect를 제거합니다.

#### 4. Lazy Update에서 처리 (선택적)

**위치:** `src/logic/stats/stats.js` - `applyLazyUpdate()`

Lazy Update에서도 TIRED 케어미스를 처리할 수 있습니다:

```javascript
export function applyLazyUpdate(stats, lastSavedAt, sleepSchedule = null, maxEnergy = null) {
  // ... 기존 로직
  
  // TIRED 상태 케어미스 체크 (Lazy Update)
  if (sleepSchedule && stats.tiredStartAt) {
    const now = new Date();
    const status = getSleepStatus({
      sleepSchedule,
      isLightsOn: stats.isLightsOn || false,
      wakeUntil: stats.wakeUntil || null,
      fastSleepStart: stats.fastSleepStart || null,
      now,
    });
    
    if (status === "TIRED") {
      const elapsed = now.getTime() - stats.tiredStartAt;
      const threshold = 30 * 60 * 1000; // 30분
      
      if (!stats.tiredCounted && elapsed >= threshold) {
        updatedStats.careMistakes = (updatedStats.careMistakes || 0) + 1;
        updatedStats.tiredCounted = true;
      }
    } else {
      // TIRED 상태가 아니면 리셋
      updatedStats.tiredStartAt = null;
      updatedStats.tiredCounted = false;
    }
  }
  
  return updatedStats;
}
```

**주의:** Lazy Update에서 처리하면 실시간 체크와 중복될 수 있으므로, 실시간 체크만 사용하는 것을 권장합니다.

---

## ✅ 개선 효과

### 1. 영속성 보장
- 새로고침 후에도 TIRED 상태 시작 시간 유지
- 29분 후 새로고침해도 1분 후 케어미스 발생

### 2. 일관성 향상
- `sleepLightOnStart`와 동일한 패턴
- 모든 타임스탬프 기반 케어미스가 `digimonStats`에 저장

### 3. Lazy Update 호환
- 필요 시 Lazy Update에서도 처리 가능
- 오프라인 기간 중 누락 방지

### 4. 디버깅 용이
- `digimonStats.tiredStartAt`으로 시작 시간 확인 가능
- 개발자 도구에서 상태 추적 용이

---

## 🔄 마이그레이션

기존 데이터와의 호환성을 위해:

```javascript
// 기존 데이터 로드 시
if (!digimonStats.tiredStartAt && digimonStats.tiredCounted === undefined) {
  digimonStats.tiredStartAt = null;
  digimonStats.tiredCounted = false;
}
```

---

## 📝 구현 체크리스트

- [ ] `digimonStats`에 `tiredStartAt`, `tiredCounted` 필드 추가
- [ ] 타이머 useEffect에서 TIRED 케어미스 처리 로직 추가
- [ ] 기존 `tiredStartRef`, `tiredCountedRef` 사용하는 useEffect 제거
- [ ] `useGameState.js`에서 ref 제거 (선택적)
- [ ] 테스트: 29분 후 새로고침 시나리오 확인
- [ ] 문서 업데이트: `SLEEP_ELECTRIC_SYSTEM_ANALYSIS.md`에 반영

---

## ⚠️ 주의사항

1. **중복 체크 방지**
   - 실시간 타이머와 Lazy Update에서 동시에 처리하지 않도록 주의
   - `tiredCounted` 플래그로 중복 방지

2. **상태 전이**
   - TIRED → AWAKE/SLEEPING 전이 시 `tiredStartAt` 리셋
   - 불을 꺼서 SLEEPING 상태가 되면 리셋

3. **성능**
   - 1초마다 체크하므로 부담이 적음
   - `getSleepStatus` 호출은 이미 타이머에서 수행 중

---

## 📊 비교표

| 항목 | 현재 (Ref) | 개선안 (digimonStats) |
|------|-----------|---------------------|
| 새로고침 후 유지 | ❌ | ✅ |
| Lazy Update 호환 | ❌ | ✅ |
| 일관성 | ⚠️ | ✅ |
| 디버깅 | ⚠️ | ✅ |
| 구현 복잡도 | 낮음 | 중간 |

---

## 🎯 결론

**권장사항:** `sleepLightOnStart` 패턴을 따라 `tiredStartAt`을 `digimonStats`에 저장하는 방식으로 개선하는 것을 권장합니다.

**우선순위:** 중간 (세션 내에서는 현재 방식도 충분히 작동하지만, 사용자 경험 개선을 위해 개선 권장)
