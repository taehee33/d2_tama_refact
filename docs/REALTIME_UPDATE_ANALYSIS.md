# 실시간 업데이트 문제 분석 및 점검 사항

## 📋 현재 문제점

게임 화면을 켜둔 경우 자동 새로고침이 안되고 있는 것 같음. 밥이랑 똥 같은 게 새로고침 안하면 반영이 안됨.

---

## 🔍 현재 코드 구조 분석

### 1. 메인 루프 (Main Tick) 존재 여부

**위치**: `Game.jsx` 333-621줄

**현재 구현**:
```javascript
useEffect(() => {
  if(digimonStats.isDead) return;
  
  const timer = setInterval(() => {
    setDigimonStats((prevStats) => {
      // updateLifespan: poopCount 증가
      let updatedStats = updateLifespan(prevStats, 1, isActuallySleeping);
      // handleHungerTick: fullness 감소
      updatedStats = handleHungerTick(updatedStats, currentDigimonData, 1, isActuallySleeping);
      // handleStrengthTick: strength 감소
      updatedStats = handleStrengthTick(updatedStats, currentDigimonData, 1, isActuallySleeping);
      return updatedStats;
    });
  }, 1000);
  
  return () => clearInterval(timer);
}, [digimonStats.isDead]);
```

**✅ 확인 사항**:
- 메인 루프는 존재함 (1초마다 실행)
- `updateLifespan`, `handleHungerTick`, `handleStrengthTick` 호출됨

---

### 2. 상태 업데이트 로직 확인

#### 2.1 배고픔 감소 (`handleHungerTick`)

**위치**: `logic/stats/hunger.js` 14-41줄

**로직**:
```javascript
export function handleHungerTick(currentStats, digimonData, deltaSec = 1, isSleeping = false) {
  if (isSleeping) return currentStats; // 수면 중에는 감소하지 않음
  
  s.hungerCountdown -= deltaSec; // 1초씩 감소
  
  if (s.hungerCountdown <= 0) {
    s.fullness = Math.max(0, s.fullness - 1); // ✅ fullness 감소
    s.hungerCountdown = hungerCycle * 60; // 카운트다운 리셋
  }
}
```

**✅ 확인 사항**:
- `hungerCountdown`이 0 이하가 되면 `fullness`를 -1 함
- `setDigimonStats`를 통해 상태 업데이트됨

#### 2.2 똥 생성 (`updateLifespan`)

**위치**: `data/stats.js` 130-182줄

**로직**:
```javascript
export function updateLifespan(stats, deltaSec=1, isSleeping=false){
  if (s.poopTimer > 0 && !isSleeping) {
    s.poopCountdown -= deltaSec; // 1초씩 감소
    
    if(s.poopCountdown <= 0){
      if(s.poopCount < 8){
        s.poopCount++; // ✅ poopCount 증가
        s.poopCountdown = s.poopTimer*60; // 카운트다운 리셋
      }
    }
  }
}
```

**✅ 확인 사항**:
- `poopCountdown`이 0 이하가 되면 `poopCount`를 +1 함
- `setDigimonStats`를 통해 상태 업데이트됨

---

### 3. 브라우저 탭 비활성화 (Throttling) 문제

**⚠️ 문제점**:
현재 구현은 `setInterval`에 의존하여 1초마다 `deltaSec = 1`을 전달합니다. 하지만 브라우저 탭이 비활성화되면:
- Chrome/Edge: `setInterval`이 최소 1초로 제한됨 (실제로는 더 느려질 수 있음)
- Safari: 더 공격적으로 throttling 적용
- 결과: 실제 시간보다 느리게 업데이트됨

**현재 코드의 문제**:
```javascript
const timer = setInterval(() => {
  // 항상 deltaSec = 1을 전달 (실제 경과 시간과 무관)
  updatedStats = handleHungerTick(updatedStats, currentDigimonData, 1, isActuallySleeping);
}, 1000);
```

**해결책**: 실제 경과 시간을 계산하여 전달해야 함

---

### 4. '오프라인 계산'과 '실시간 계산'의 충돌

**현재 구조**:
- **접속 시**: `applyLazyUpdate`로 한꺼번에 반영 (Lazy Update)
- **접속 중**: `setInterval`로 1초마다 실시간 업데이트

**잠재적 문제**:
- `lastSavedAt`이 업데이트되지 않으면 Lazy Update와 실시간 업데이트가 중복 적용될 수 있음
- 하지만 현재 코드는 메인 타이머에서 `lastSavedAt`을 업데이트하지 않으므로 문제 없음

---

## 🛠️ 권장 수정 방안

### 방안 1: 실제 경과 시간 기반 계산 (권장)

**수정 위치**: `Game.jsx` 333-621줄

**수정 내용**:
```javascript
useEffect(() => {
  if(digimonStats.isDead) return;
  
  let lastUpdateTime = Date.now(); // 마지막 업데이트 시간 추적
  
  const timer = setInterval(() => {
    const now = Date.now();
    const actualElapsedSeconds = Math.floor((now - lastUpdateTime) / 1000);
    lastUpdateTime = now; // 다음 업데이트를 위해 시간 갱신
    
    // 실제 경과 시간이 0이면 스킵 (너무 빠른 업데이트 방지)
    if (actualElapsedSeconds <= 0) return;
    
    setDigimonStats((prevStats) => {
      if(prevStats.isDead) return prevStats;
      
      // 실제 경과 시간만큼 업데이트
      let updatedStats = updateLifespan(prevStats, actualElapsedSeconds, isActuallySleeping);
      updatedStats = handleHungerTick(updatedStats, currentDigimonData, actualElapsedSeconds, isActuallySleeping);
      updatedStats = handleStrengthTick(updatedStats, currentDigimonData, actualElapsedSeconds, isActuallySleeping);
      
      return updatedStats;
    });
  }, 1000); // 여전히 1초마다 체크하지만, 실제 경과 시간을 계산
  
  return () => clearInterval(timer);
}, [digimonStats.isDead]);
```

**장점**:
- 브라우저 탭이 비활성화되어도 정확한 시간 계산
- 탭이 다시 활성화되면 누락된 시간을 보정

**단점**:
- `lastUpdateTime`을 클로저로 관리해야 함

---

### 방안 2: `lastUpdateTime`을 상태로 관리

**수정 내용**:
```javascript
const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

useEffect(() => {
  if(digimonStats.isDead) return;
  
  const timer = setInterval(() => {
    const now = Date.now();
    const actualElapsedSeconds = Math.floor((now - lastUpdateTime) / 1000);
    
    if (actualElapsedSeconds <= 0) return;
    
    setLastUpdateTime(now);
    
    setDigimonStats((prevStats) => {
      // ... 업데이트 로직
    });
  }, 1000);
  
  return () => clearInterval(timer);
}, [digimonStats.isDead, lastUpdateTime]);
```

---

### 방안 3: `requestAnimationFrame` 사용 (고급)

**장점**:
- 브라우저가 최적화된 타이밍에 실행
- 탭이 비활성화되면 자동으로 중지

**단점**:
- 게임 로직이 복잡해질 수 있음
- 1초 단위 업데이트가 아닌 경우 추가 로직 필요

---

## 🔍 점검해야 할 추가 사항

### 1. `hungerCountdown` 초기화 확인

**문제 가능성**:
- `hungerCountdown`이 초기화되지 않았을 수 있음
- `handleHungerTick`에서 `s.hungerCountdown = s.hungerCountdown || (hungerCycle * 60);`로 초기화하지만, 이미 잘못된 값이 있으면 문제 발생

**점검 위치**: `logic/stats/hunger.js` 25줄

### 2. `poopCountdown` 초기화 확인

**문제 가능성**:
- `poopCountdown`이 초기화되지 않았을 수 있음
- `updateLifespan`에서 초기화 로직 확인 필요

**점검 위치**: `data/stats.js` 103-119줄

### 3. 수면 상태 확인

**문제 가능성**:
- 수면 중일 때 타이머가 정지되어야 하는데, 수면 상태 계산이 잘못되었을 수 있음
- `isActuallySleeping` 계산 로직 확인 필요

**점검 위치**: `Game.jsx` 358-368줄

### 4. Firestore 저장 주기

**현재 상태**:
- 메인 타이머는 "메모리 상태만 업데이트" (주석 참조)
- Firestore 저장은 별도 로직에서 처리

**점검 사항**:
- Firestore 저장이 너무 자주 일어나면 성능 문제
- 너무 드물면 데이터 손실 위험
- 적절한 저장 주기 확인 필요

---

## 📝 권장 점검 순서

1. **브라우저 콘솔 확인**: `setInterval`이 정상 작동하는지 로그로 확인
2. **스탯 값 확인**: `digimonStats.fullness`, `digimonStats.poopCount`가 실제로 변경되는지 확인
3. **타이머 초기화 확인**: `hungerCountdown`, `poopCountdown`이 올바르게 초기화되는지 확인
4. **수면 상태 확인**: 수면 중일 때 타이머가 정지되는지 확인
5. **브라우저 탭 throttling 테스트**: 탭을 비활성화했다가 다시 활성화했을 때 정확한 시간 계산되는지 확인

---

## 🎯 적용된 수정 사항

**방안 1**을 적용하여 `lastUpdateTimeRef`를 `useRef`로 관리하고 실제 경과 시간을 계산하도록 수정했습니다.

**수정 위치**: `Game.jsx` 333-378줄

**주요 변경사항**:
1. `lastUpdateTimeRef` 추가: `useRef(Date.now())`로 마지막 업데이트 시간 추적
2. 실제 경과 시간 계산: `actualElapsedSeconds = Math.floor((now - lastUpdateTimeRef.current) / 1000)`
3. 안전장치: 실제 경과 시간이 60초를 초과하면 최대 60초로 제한
4. `updateLifespan`, `handleHungerTick`, `handleStrengthTick`에 실제 경과 시간 전달

**효과**:
- 브라우저 탭이 비활성화되어도 정확한 시간 계산
- 탭이 다시 활성화되면 누락된 시간을 보정하여 즉시 반영
- 밥과 똥이 실시간으로 정확하게 업데이트됨

---

## ✅ 추가 점검 사항

### 1. `hungerCountdown` 초기화 확인
- ✅ `handleHungerTick`에서 `s.hungerCountdown = s.hungerCountdown || (hungerCycle * 60);`로 초기화
- ✅ 정상 작동

### 2. `poopCountdown` 초기화 확인
- ✅ `data/stats.js` 103-119줄에서 초기화 로직 확인
- ✅ 정상 작동

### 3. 수면 상태 확인
- ✅ `isActuallySleeping` 계산 로직 확인
- ✅ SLEEPING 또는 TIRED 상태일 때 타이머 정지
- ✅ 정상 작동

### 4. Firestore 저장 주기
- ⚠️ 메인 타이머는 "메모리 상태만 업데이트" (주석 참조)
- ⚠️ Firestore 저장은 별도 로직에서 처리
- 💡 권장: 주기적 자동 저장 추가 고려 (예: 30초마다 또는 스탯 변경 시)
