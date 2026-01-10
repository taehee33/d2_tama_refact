# Energy 100 버그 분석

## 📋 문제 현상

디지타마, 오하카다몬, 깜몬, 코로몬일 때 energy가 100으로 표시됨
- 실제 maxEnergy는 0이어야 함
- Energy (Current): 100/0 형식으로 표시됨

## 🔍 근본 원인 분석

### 1. 문제 위치 1: `logic/stats/stats.js` (77줄)

```javascript
merged.energy = merged.maxEnergy || merged.maxStamina || merged.energy || 100;
```

**문제:**
- `maxEnergy`가 0일 때 falsy로 평가되어 다음 값으로 넘어감
- `maxStamina`도 0이면 `merged.energy`를 확인하고, 그것도 없으면 100으로 설정
- 결과: `maxEnergy = 0`일 때 `energy = 100`으로 설정됨

### 2. 문제 위치 2: `useGameData.js` (260, 409, 481줄)

```javascript
maxEnergy = digimonData.stats?.maxEnergy || digimonStats.maxEnergy || digimonStats.maxStamina || 100;
```

**문제:**
- `maxEnergy`가 0일 때 falsy로 평가되어 100을 fallback으로 사용
- `applyLazyUpdate`에 잘못된 `maxEnergy` 값(100)이 전달됨

### 3. 문제 위치 3: `useEvolution.js` (170줄)

```javascript
const maxEnergy = newDigimonData.stats?.maxEnergy || newDigimonData.stats?.maxStamina || newDigimonData.maxEnergy || newDigimonData.maxStamina || 100;
```

**문제:**
- 진화 시 `maxEnergy`가 0일 때 100으로 설정됨
- 진화 후 `energy`를 `maxEnergy`로 설정하면 100이 됨

### 4. 문제 위치 4: `logic/food/protein.js` (32줄)

```javascript
const maxEnergy = s.maxEnergy || s.maxStamina || 100;
```

**문제:**
- 단백질 먹이기 시 `maxEnergy`가 0일 때 100을 사용
- `Math.min(maxEnergy, ...)` 계산 시 잘못된 값 사용

### 5. 데이터 확인

**`digimons.js`에서 확인:**
- `Digitama`: `maxEnergy: 0`
- `Ohakadamon1`: `maxEnergy: 0`
- `Ohakadamon2`: `maxEnergy: 0`
- `Botamon` (깜몬): `maxEnergy: 0`
- `Koromon` (코로몬): `maxEnergy: 0`

**정상:**
- `Agumon` (아구몬): `maxEnergy: 20`
- `Greymon` (그레이몬): `maxEnergy: 30`

## 💡 해결 방안

### 방안 1: Nullish Coalescing 사용 (추천)

`||` 연산자 대신 `??` (nullish coalescing) 사용하여 0도 유효한 값으로 처리

**수정 위치 1:** `logic/stats/stats.js`
```javascript
// 수정 전
merged.energy = merged.maxEnergy || merged.maxStamina || merged.energy || 100;

// 수정 후
const calculatedMaxEnergy = merged.maxEnergy ?? merged.maxStamina ?? 0;
merged.energy = oldStats.energy !== undefined ? oldStats.energy : (calculatedMaxEnergy || 0);
```

**수정 위치 2:** `useGameData.js`
```javascript
// 수정 전
maxEnergy = digimonData.stats?.maxEnergy || digimonStats.maxEnergy || digimonStats.maxStamina || 100;

// 수정 후
maxEnergy = digimonData.stats?.maxEnergy ?? digimonStats.maxEnergy ?? digimonStats.maxStamina ?? 0;
```

**수정 위치 3:** `useEvolution.js`
```javascript
// 수정 전
const maxEnergy = newDigimonData.stats?.maxEnergy || newDigimonData.stats?.maxStamina || newDigimonData.maxEnergy || newDigimonData.maxStamina || 100;

// 수정 후
const maxEnergy = newDigimonData.stats?.maxEnergy ?? newDigimonData.stats?.maxStamina ?? newDigimonData.maxEnergy ?? newDigimonData.maxStamina ?? 0;
```

**수정 위치 4:** `logic/food/protein.js`
```javascript
// 수정 전
const maxEnergy = s.maxEnergy || s.maxStamina || 100;

// 수정 후
const maxEnergy = s.maxEnergy ?? s.maxStamina ?? 0;
```

### 방안 2: 명시적 체크

`maxEnergy`가 `undefined` 또는 `null`일 때만 fallback 사용

```javascript
const maxEnergy = (digimonData.stats?.maxEnergy !== undefined && digimonData.stats?.maxEnergy !== null)
  ? digimonData.stats.maxEnergy
  : (digimonStats.maxEnergy !== undefined && digimonStats.maxEnergy !== null)
  ? digimonStats.maxEnergy
  : (digimonStats.maxStamina !== undefined && digimonStats.maxStamina !== null)
  ? digimonStats.maxStamina
  : 0; // fallback을 100 대신 0으로 변경
```

## 📊 개선 효과

### 개선 전
- ❌ `maxEnergy = 0`일 때 `energy = 100`으로 설정
- ❌ Energy (Current): 100/0 표시
- ❌ 단백질 먹이기 시 잘못된 maxEnergy 사용

### 개선 후
- ✅ `maxEnergy = 0`일 때 `energy = 0`으로 설정
- ✅ Energy (Current): 0/0 표시
- ✅ 단백질 먹이기 시 올바른 maxEnergy 사용

## 🔧 구현 우선순위

1. **높음:** `useGameData.js`의 maxEnergy 계산 수정
2. **높음:** `logic/stats/stats.js`의 energy 초기화 수정
3. **중간:** `useEvolution.js`의 maxEnergy 계산 수정
4. **낮음:** `logic/food/protein.js`의 maxEnergy 계산 수정

## ✅ 결론

**문제 원인:** `||` 연산자가 0을 falsy로 평가하여 fallback 값(100)을 사용

**해결책:** `??` (nullish coalescing) 사용 또는 명시적 체크로 0도 유효한 값으로 처리
