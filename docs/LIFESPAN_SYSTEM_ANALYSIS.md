# 수명(Lifespan) 시스템 분석

## 📋 개요

디지몬의 수명은 게임 내에서 계속 증가하며, 최대 수명에 도달하면 자연 사망하는 시스템입니다.

---

## 🔧 구현된 기능

### 1. 수명 저장 방식

**필드명**: `lifespanSeconds`  
**타입**: `number`  
**단위**: 초 (seconds)  
**초기값**: `0`

**위치**: 
- `src/data/v1/defaultStats.js` (30번째 줄)
- `src/data/defaultStatsFile.js` (16번째 줄)

```javascript
lifespanSeconds: 0,  // 수명 (초)
```

---

### 2. 수명 증가 로직

#### 2.1 실시간 타이머 (1초마다)

**위치**: `src/pages/Game.jsx` (392번째 줄)

```javascript
let updatedStats = updateLifespan(prevStats, safeElapsedSeconds, isActuallySleeping);
```

**함수**: `src/logic/stats/stats.js` - `updateLifespan()` (93-135줄)

```javascript
export function updateLifespan(stats, deltaSec = 1, isSleeping = false) {
  if (stats.isDead) return stats;
  
  const s = { ...stats };
  s.lifespanSeconds += deltaSec;  // ✅ 수명 증가
  s.timeToEvolveSeconds = Math.max(0, s.timeToEvolveSeconds - deltaSec);
  
  // 똥 생성 로직 등...
  
  return s;
}
```

**특징**:
- 1초마다 `lifespanSeconds`가 1씩 증가
- 수면 중에도 수명은 계속 증가 (수면 중에도 시간은 흐름)
- 사망한 경우(`isDead === true`) 수명 증가 중지

#### 2.2 Lazy Update (오프라인 후 복귀 시)

**위치**: `src/data/stats.js` - `applyLazyUpdate()` (282-635줄)

```javascript
export function applyLazyUpdate(stats, lastSavedAt, sleepSchedule = null, maxEnergy = null) {
  // ...
  const elapsedSeconds = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);
  
  // 경과 시간만큼 한 번에 업데이트
  updatedStats.lifespanSeconds += elapsedSeconds;  // ✅ 수명 증가
  // ...
}
```

**특징**:
- 마지막 저장 시간부터 현재까지의 경과 시간을 계산
- 경과 시간만큼 한 번에 수명 증가
- 오프라인 후 복귀 시에도 정확한 수명 계산

---

### 3. 최대 수명 설정

**위치**: `src/pages/Game.jsx` (538번째 줄)

```javascript
const maxLifespan = currentDigimonData?.maxLifespan || 999999;
```

**현재 상태**:
- ⚠️ **디지몬 데이터에 `maxLifespan` 필드가 없음**
- 기본값으로 `999999` 초 (약 11.5일) 사용
- `game_mechanics.md`에는 `lifespan: 72` (Hours)로 언급되어 있으나 실제 구현되지 않음

**문제점**:
- 디지몬별로 다른 최대 수명을 설정할 수 없음
- 모든 디지몬이 동일한 최대 수명(999999초) 사용
- 매뉴얼에 명시된 수명 값(예: 72시간)이 반영되지 않음

---

### 4. 수명 다함 사망 체크

**위치**: `src/pages/Game.jsx` (536-544번째 줄)

```javascript
// 수명 종료 체크 (lifespanSeconds가 최대치에 도달했는지 확인)
const maxLifespan = currentDigimonData?.maxLifespan || 999999;
if(updatedStats.lifespanSeconds >= maxLifespan && !updatedStats.isDead){
  updatedStats.isDead = true;
  const reason = 'OLD AGE (수명 다함)';
  updatedStats.deathReason = reason;
  setDeathReason(reason);
}
```

**동작**:
- 실시간 타이머에서 1초마다 체크
- `lifespanSeconds >= maxLifespan`이면 사망 처리
- 사망 원인: `'OLD AGE (수명 다함)'`

---

### 5. 진화 시 수명 처리

**위치**: `src/data/stats.js` - `initializeStats()` (44번째 줄)

```javascript
merged.lifespanSeconds = oldStats.lifespanSeconds || merged.lifespanSeconds;
```

**특징**:
- ✅ **진화 시 수명은 유지됨** (리셋되지 않음)
- 디지타마부터 최종 진화까지 누적된 수명이 계속 증가
- 새로운 시작(디지타마 초기화) 시에도 수명은 유지됨

---

### 6. UI 표시

#### 6.1 StatsPopup - 수명 게이지

**위치**: `src/components/StatsPopup.jsx` (1695-1755번째 줄)

**표시 내용**:
- 현재 수명: `formatTime(lifespanSeconds)` 형식으로 표시
- 수명 게이지: 최대 20일 기준으로 표시 (각 박스 = 1일)
- 사망 시: "💀 사망 (자연 수명 종료)" 메시지 표시

**게이지 색상**:
- 10일 미만: 회색 (`bg-gray-300`)
- 10일 이상: 회색 (`bg-gray-400`)
- 15일 이상: 회색 (`bg-gray-500`)
- 20일 이상: 진한 회색 (`bg-gray-600`)

**제한사항**:
- 최대 표시: 20일 (1728000초)
- 20일 이상이어도 게이지는 20일까지만 표시

#### 6.2 DeathPopup - 사망 원인 표시

**위치**: `src/components/DeathPopup.jsx` (68-70번째 줄)

```javascript
'OLD AGE (수명 다함)': {
  title: '수명 종료',
  description: '디지몬의 수명이 다하여 자연스럽게 사망했습니다.',
  // ...
}
```

---

## ⚠️ 현재 문제점 및 개선 필요 사항

### 1. 최대 수명 설정 미구현

**문제**:
- 디지몬 데이터에 `maxLifespan` 필드가 없음
- 모든 디지몬이 동일한 최대 수명(999999초) 사용
- 매뉴얼에 명시된 수명 값이 반영되지 않음

**해결 방안**:
```javascript
// digimons.js에 maxLifespan 추가 필요
Agumon: {
  stats: {
    // ...
    maxLifespan: 72 * 3600,  // 72시간 = 259200초
  }
}
```

### 2. 수명 게이지 표시 제한

**문제**:
- 최대 20일까지만 게이지 표시
- 20일 이상이어도 게이지가 꽉 차서 표시됨

**해결 방안**:
- 실제 최대 수명에 맞춰 게이지 표시
- 또는 동적 게이지 (현재 수명 / 최대 수명 비율)

### 3. 수명 단위 혼용

**문제**:
- 매뉴얼: 시간(Hours) 단위
- 코드: 초(Seconds) 단위
- UI 표시: 일/시간/분/초 형식

**해결 방안**:
- 디지몬 데이터에 시간 단위로 저장하고, 코드에서 초로 변환
- 또는 초 단위로 통일하고 문서화

---

## 📊 수명 관련 데이터 흐름

### 1. 수명 증가 흐름

```
실시간 타이머 (1초마다)
  ↓
updateLifespan(stats, 1, isSleeping)
  ↓
lifespanSeconds += 1
  ↓
수명 다함 체크
  ↓
lifespanSeconds >= maxLifespan?
  ↓
Yes → isDead = true, deathReason = 'OLD AGE (수명 다함)'
```

### 2. 오프라인 후 복귀 시

```
applyLazyUpdate(stats, lastSavedAt)
  ↓
경과 시간 계산: elapsedSeconds
  ↓
lifespanSeconds += elapsedSeconds
  ↓
수명 다함 체크 (Game.jsx에서)
```

### 3. 진화 시

```
진화 발생
  ↓
initializeStats(newDigimon, oldStats)
  ↓
lifespanSeconds = oldStats.lifespanSeconds (유지)
  ↓
계속 증가
```

---

## 🔍 관련 파일 목록

### 핵심 로직
- `src/logic/stats/stats.js` - `updateLifespan()` 함수
- `src/data/stats.js` - `updateLifespan()`, `applyLazyUpdate()` 함수
- `src/pages/Game.jsx` - 실시간 타이머 및 수명 다함 체크

### UI 컴포넌트
- `src/components/StatsPopup.jsx` - 수명 게이지 표시
- `src/components/DeathPopup.jsx` - 사망 원인 표시

### 데이터
- `src/data/v1/defaultStats.js` - 기본 스탯 정의
- `src/data/v1/digimons.js` - 디지몬 데이터 (maxLifespan 없음)

### 문서
- `docs/game_mechanics.md` - 매뉴얼 기반 스펙 (lifespan: 72 Hours)
- `docs/STATS_ANALYSIS.md` - 스탯 분석 문서

---

## 📝 요약

### ✅ 구현 완료
1. 수명 저장: `lifespanSeconds` (초 단위)
2. 수명 증가: 실시간 타이머 + Lazy Update
3. 수명 다함 사망 체크
4. UI 표시: StatsPopup에 수명 게이지
5. 진화 시 수명 유지

### ⚠️ 개선 필요
1. **디지몬별 최대 수명 설정**: `maxLifespan` 필드 추가 필요
2. **수명 게이지 개선**: 실제 최대 수명에 맞춰 동적 표시
3. **매뉴얼 반영**: 72시간 등 매뉴얼 수명 값 반영

---

**작성일**: 2026-01-XX
