# 냉장고(냉동수면) 기능 분석

**작성일:** 2026년 1월 28일  
**분석 대상:** 냉장고 기능의 전체 구현 및 동작 방식

## 📋 개요

냉장고 기능은 디지몬을 냉동수면 상태로 보관하여 시간을 정지시키는 기능입니다. 이 기능을 통해 사용자는 디지몬의 성장을 일시 정지하고, 모든 수치를 고정시킬 수 있습니다.

## 🎯 핵심 기능

### 1. 시간 정지 (Time Freeze)

**구현 위치:** `src/logic/stats/stats.js` - `applyLazyUpdate` 함수

```javascript:277:282:digimon-tamagotchi-frontend/src/logic/stats/stats.js
// 냉장고 상태 체크: 냉장고에 넣은 경우 모든 수치 고정 (시간 정지)
if (stats.isFrozen) {
  // 냉장고 상태에서는 모든 수치 고정 (경과 시간 0으로 처리)
  // lastSavedAt만 업데이트하여 다음 lazy update가 정상 작동하도록 함
  return { ...stats, lastSavedAt: now };
}
```

**동작 방식:**
- `isFrozen === true`일 때 `applyLazyUpdate`가 즉시 반환
- 경과 시간 계산을 건너뛰어 모든 수치 고정
- `lastSavedAt`만 업데이트하여 다음 Lazy Update가 정상 작동하도록 함

**영향받는 수치:**
- ✅ 나이 (Age) - 증가하지 않음
- ✅ 진화 타이머 (Time to Evolve) - 감소하지 않음
- ✅ 배고픔 (Fullness) - 감소하지 않음
- ✅ 힘 (Strength) - 감소하지 않음
- ✅ 에너지 (Energy) - 변화 없음
- ✅ 똥 개수 (Poop Count) - 증가하지 않음
- ✅ 수명 (Lifespan) - 증가하지 않음

### 2. 실시간 타이머 정지

**구현 위치:** `src/pages/Game.jsx` - 1초 타이머 useEffect

```javascript:405:408:digimon-tamagotchi-frontend/src/pages/Game.jsx
// 냉장고 상태에서는 모든 수치 고정 (시간 정지)
if(prevStats.isFrozen) {
  return prevStats;
}
```

**동작 방식:**
- 1초마다 실행되는 타이머에서 `isFrozen` 체크
- 냉장고 상태일 때는 상태 업데이트를 건너뜀
- UI 업데이트도 정지됨

### 3. 호출(Call) 비활성화

**구현 위치:** `src/hooks/useGameLogic.js` - `checkCalls` 함수

```javascript:421:438:digimon-tamagotchi-frontend/src/hooks/useGameLogic.js
// 냉장고 상태에서는 호출을 무시
if (updatedStats.isFrozen) {
  // callStatus 초기화 (호출 비활성화)
  if (!updatedStats.callStatus) {
    updatedStats.callStatus = {
      hunger: { isActive: false, startedAt: null, sleepStartAt: null },
      strength: { isActive: false, startedAt: null, sleepStartAt: null },
      sleep: { isActive: false, startedAt: null }
    };
  } else {
    // 기존 호출 모두 비활성화
    updatedStats.callStatus = {
      hunger: { isActive: false, startedAt: null, sleepStartAt: null },
      strength: { isActive: false, startedAt: null, sleepStartAt: null },
      sleep: { isActive: false, startedAt: null }
    };
  }
  return updatedStats;
}
```

**동작 방식:**
- 냉장고 상태일 때 모든 호출(배고픔, 힘, 수면) 비활성화
- 호출 타임아웃 체크도 건너뜀 (`checkCallTimeouts` 함수에서도 처리)

### 4. 케어 실수 방지

**구현 위치:** `src/hooks/useGameLogic.js` - `checkCallTimeouts` 함수

```javascript:592:593:digimon-tamagotchi-frontend/src/hooks/useGameLogic.js
// 냉장고 상태에서는 호출 타임아웃을 무시 (케어 실수 발생하지 않음)
if (stats.isFrozen) {
```

**동작 방식:**
- 냉장고 상태에서는 호출 타임아웃 체크를 건너뜀
- 케어 실수(Care Mistake)가 발생하지 않음

## 🎨 UI/UX 구현

### 1. 냉장고 모달

**구현 위치:** `src/components/FridgeModal.jsx`

**기능:**
- 냉장고에 넣기/꺼내기 버튼 제공
- 상태에 따라 다른 메시지 표시
- 간단한 설명 텍스트 제공

### 2. 버튼 비활성화

**구현 위치:** `src/components/MenuIconButtons.jsx`

```javascript:38:39:digimon-tamagotchi-frontend/src/components/MenuIconButtons.jsx
// 냉장고 상태일 때 비활성화할 메뉴
const disabledMenus = isFrozen ? ['eat', 'train'] : [];
```

**비활성화되는 기능:**
- ✅ 먹이 주기 (eat)
- ✅ 훈련하기 (train)
- ❌ 배틀 (battle) - 활성화됨 (냉장고에서도 배틀 가능)
- ❌ 교감 (communication) - 활성화됨
- ❌ 화장실 (bathroom) - 활성화됨
- ❌ 치료 (heal) - 활성화됨

### 3. 애니메이션 시스템

**구현 위치:** `src/components/Canvas.jsx`

#### 넣기 애니메이션 (3단계)

**1단계 (0~1.0초):** 밥 위치에 냉장고(552)만 표시
```javascript:520:536:digimon-tamagotchi-frontend/src/components/Canvas.jsx
// 1단계: 밥 위치에 냉장고 (552)만 표시
if (currentStage === 0) {
  const fridgeImg0 = spriteCache.current['fridge0'];
  if(fridgeImg0 && fridgeImg0.naturalWidth > 0){
    const fridgeW = width * 0.3;
    const fridgeH = height * 0.3;
    const fridgeX = width * 0.2 - fridgeW / 2; // 왼쪽 (밥 위치)
    const fridgeY = height * 0.6 - fridgeH / 2;
    ctx.drawImage(fridgeImg0, fridgeX, fridgeY, fridgeW, fridgeH);
  }
}
```

**2단계 (1.0~2.5초):** 밥 위치 냉장고(552) + 디지몬 위에 덮개(554/555 교차)
```javascript:538:584:digimon-tamagotchi-frontend/src/components/Canvas.jsx
// 2단계: 밥 위치 냉장고(552) + 디지몬 위에 덮개(554/555 교차)
if (currentStage === 1) {
  // 552 표시
  // 554와 555를 0.5초 간격으로 교차 표시
}
```

**3단계 (2.5초 이후):** 화면 가운데 냉장고 안(553)만 표시
```javascript:586:602:digimon-tamagotchi-frontend/src/components/Canvas.jsx
// 3단계: 화면 가운데 냉장고 안 (553)만 표시
if (currentStage === 2) {
  const fridgeImg1 = spriteCache.current['fridge1'];
  // 화면 중앙에 553 표시
}
```

#### 꺼내기 애니메이션 (4단계)

**1단계 (0~0.8초):** 해제 신호 (553 진동 효과)
```javascript:396:416:digimon-tamagotchi-frontend/src/components/Canvas.jsx
// 1단계: 해제 신호 (553 진동 효과)
if (currentStage === 1) {
  // sin 함수를 사용한 좌우 진동 효과
  const shakeOffset = Math.sin(elapsedSeconds * shakeSpeed) * shakeAmount;
}
```

**2단계 (0.8~2.0초):** 해동 시작 (555 → 554 얼음 감소, 553 사라짐)
```javascript:418:454:digimon-tamagotchi-frontend/src/components/Canvas.jsx
// 2단계: 해동 시작 (555 → 554 얼음 감소, 553 사라짐)
if (currentStage === 2) {
  // 554와 555를 0.2초 단위로 교차 표시
}
```

**3단계 (2.0~2.5초):** 얼음 깨짐 (552 제거, 펑 효과)
```javascript:456:488:digimon-tamagotchi-frontend/src/components/Canvas.jsx
// 3단계: 얼음 깨짐 (552 제거)
if (currentStage === 3) {
  // 펑 효과: 점점 작아지면서 사라지는 효과
  const scale = 1 - fadeProgress; // 1에서 0으로 감소
  ctx.globalAlpha = scale; // 투명도도 함께 감소
}
```

**4단계 (2.5~3.5초):** 기상 완료 (디지몬만 표시)
```javascript:490:499:digimon-tamagotchi-frontend/src/components/Canvas.jsx
// 4단계: 기상 완료 (디지몬만 표시, 냉장고 스프라이트 모두 사라짐)
if (currentStage === 4) {
  // 냉장고 스프라이트는 표시하지 않음
}
```

**애니메이션 완료 처리:**
```javascript:1148:1182:digimon-tamagotchi-frontend/src/pages/Game.jsx
// 냉장고 꺼내기 애니메이션 완료 처리 (3.5초 후 takeOutAt을 null로 설정)
useEffect(() => {
  if (!digimonStats.takeOutAt) return;
  
  const takeOutTime = typeof digimonStats.takeOutAt === 'number' 
    ? digimonStats.takeOutAt 
    : new Date(digimonStats.takeOutAt).getTime();
  
  const checkInterval = setInterval(() => {
    const elapsed = Date.now() - takeOutTime;
    // 3.5초(3500ms) 이상 경과하면 takeOutAt을 null로 설정
    if (elapsed >= 3500) {
      setDigimonStats((prevStats) => {
        if (!prevStats.takeOutAt) return prevStats;
        return {
          ...prevStats,
          takeOutAt: null,
        };
      });
    }
  }, 100);
  
  return () => clearInterval(checkInterval);
}, [digimonStats.takeOutAt]);
```

## 📊 데이터 구조

### 스탯 필드

**위치:** `src/data/v1/defaultStats.js`

```javascript:75:78:digimon-tamagotchi-frontend/src/data/v1/defaultStats.js
// 냉장고(냉동수면) 관련
isFrozen: false,    // 냉장고 보관 여부
frozenAt: null,     // 냉장고에 넣은 시간 (timestamp)
takeOutAt: null,    // 냉장고에서 꺼낸 시간 (timestamp, 꺼내기 애니메이션용)
```

### 스프라이트 파일

**위치:** `src/components/Canvas.jsx`

```javascript:9:9:digimon-tamagotchi-frontend/src/components/Canvas.jsx
const fridgeSprites= ["/images/552.png", "/images/553.png", "/images/554.png", "/images/555.png"]; // 냉장고 스프라이트 (냉장고, 냉장고 안, 덮개1, 덮개2)
```

- **552.png:** 냉장고 (밥 위치에 표시)
- **553.png:** 냉장고 안 (화면 중앙에 표시)
- **554.png:** 덮개 1 (얼음 덮개)
- **555.png:** 덮개 2 (얼음 덮개)

## 🔧 핵심 로직

### 1. 냉장고에 넣기

**구현 위치:** `src/hooks/useFridge.js` - `putInFridge` 함수

```javascript:28:60:digimon-tamagotchi-frontend/src/hooks/useFridge.js
async function putInFridge() {
  const currentStats = await applyLazyUpdateBeforeAction();
  
  if (currentStats.isDead) {
    alert("사망한 디지몬은 냉장고에 넣을 수 없습니다.");
    return;
  }
  
  if (currentStats.isFrozen) {
    alert("이미 냉장고에 보관되어 있습니다.");
    return;
  }
  
  const updatedStats = {
    ...currentStats,
    isFrozen: true,
    frozenAt: Date.now(),
    // 호출 상태 모두 비활성화
    callStatus: {
      hunger: { isActive: false, startedAt: null, sleepStartAt: null },
      strength: { isActive: false, startedAt: null, sleepStartAt: null },
      sleep: { isActive: false, startedAt: null }
    },
  };
  
  const updatedLogs = addActivityLog(
    activityLogs || [],
    'FRIDGE',
    '냉장고에 보관했습니다. 시간이 멈춥니다.'
  );
  
  await setDigimonStatsAndSave(updatedStats, updatedLogs);
}
```

**동작 순서:**
1. Lazy Update 적용 (최신 스탯 가져오기)
2. 사망 상태 체크 (사망한 디지몬은 넣을 수 없음)
3. 이미 냉장고에 있는지 체크
4. `isFrozen: true`, `frozenAt: Date.now()` 설정
5. 모든 호출 상태 비활성화
6. Activity Log 추가
7. Firestore/localStorage에 저장

### 2. 냉장고에서 꺼내기

**구현 위치:** `src/hooks/useFridge.js` - `takeOutFromFridge` 함수

```javascript:65:121:digimon-tamagotchi-frontend/src/hooks/useFridge.js
async function takeOutFromFridge() {
  const currentStats = await applyLazyUpdateBeforeAction();
  
  if (!currentStats.isFrozen) {
    return;
  }
  
  // 냉장고에 넣은 시간 이후의 경과 시간 계산
  const frozenTime = typeof currentStats.frozenAt === 'number'
    ? currentStats.frozenAt
    : new Date(currentStats.frozenAt).getTime();
  const frozenDuration = Date.now() - frozenTime;
  const frozenDurationSeconds = Math.floor(frozenDuration / 1000);
  
  // 냉장고 상태 해제 (꺼내기 애니메이션을 위해 takeOutAt 기록)
  const updatedStats = {
    ...currentStats,
    isFrozen: false,
    frozenAt: null,
    takeOutAt: Date.now(), // 꺼내기 애니메이션 시작 시간 기록
    // lastSavedAt을 현재 시간으로 업데이트하여 다음 Lazy Update가 정상 작동하도록
    lastSavedAt: new Date(),
    // 냉장고에 넣은 동안 시간이 멈췄으므로, 힘이 0이었던 시간 타이머 리셋
    // (냉장고에서 꺼낸 후부터 다시 12시간 카운트 시작)
    lastHungerZeroAt: currentStats.fullness === 0 ? Date.now() : currentStats.lastHungerZeroAt,
    lastStrengthZeroAt: currentStats.strength === 0 ? Date.now() : currentStats.lastStrengthZeroAt,
  };
  
  // 냉장고 전용 대사
  const messages = [
    "추웠어!",
    "잘 잤다!",
    "냉장고에서 나왔어!",
    "시간이 다시 흐르기 시작했어!",
  ];
  const randomMessage = messages[Math.floor(Math.random() * messages.length)];
  
  // 보관 시간 포맷팅
  let durationText;
  if (frozenDurationSeconds < 60) {
    durationText = `${frozenDurationSeconds}초`;
  } else if (frozenDurationSeconds < 3600) {
    durationText = `${Math.floor(frozenDurationSeconds / 60)}분`;
  } else {
    const hours = Math.floor(frozenDurationSeconds / 3600);
    const minutes = Math.floor((frozenDurationSeconds % 3600) / 60);
    durationText = minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
  }
  
  const updatedLogs = addActivityLog(
    activityLogs || [],
    'FRIDGE',
    `냉장고에서 꺼냈습니다. (${durationText} 동안 보관) - ${randomMessage}`
  );
  
  await setDigimonStatsAndSave(updatedStats, updatedLogs);
}
```

**동작 순서:**
1. Lazy Update 적용
2. 냉장고 상태 체크
3. 보관 시간 계산
4. `isFrozen: false`, `frozenAt: null`, `takeOutAt: Date.now()` 설정
5. `lastSavedAt` 업데이트 (다음 Lazy Update 정상 작동)
6. `lastHungerZeroAt`, `lastStrengthZeroAt` 리셋 (0이었던 시간 타이머 재시작)
7. 랜덤 대사 선택 및 보관 시간 포맷팅
8. Activity Log 추가
9. Firestore/localStorage에 저장

**중요한 처리:**
- `lastHungerZeroAt`, `lastStrengthZeroAt` 리셋: 냉장고에 넣은 동안 시간이 멈췄으므로, 0이었던 시간 타이머를 현재 시간으로 리셋하여 냉장고에서 꺼낸 후부터 다시 12시간 카운트 시작

### 3. 냉장고 시간 제외 계산

**구현 위치:** `src/pages/Game.jsx`, `src/hooks/useGameData.js`, `src/components/StatsPopup.jsx`

```javascript:48:71:digimon-tamagotchi-frontend/src/pages/Game.jsx
function getElapsedTimeExcludingFridge(startTime, endTime = Date.now(), frozenAt = null, takeOutAt = null) {
  if (!frozenAt) {
    // 냉장고에 넣은 적이 없으면 일반 경과 시간 반환
    return endTime - startTime;
  }
  
  const frozenTime = typeof frozenAt === 'number' ? frozenAt : new Date(frozenAt).getTime();
  const takeOutTime = takeOutAt ? (typeof takeOutAt === 'number' ? takeOutAt : new Date(takeOutAt).getTime()) : endTime;
  
  // 냉장고에 넣은 시간이 시작 시간보다 이전이면 무시
  if (frozenTime < startTime) {
    return endTime - startTime;
  }
  
  // 냉장고에 넣은 시간이 종료 시간보다 이후면 무시
  if (frozenTime > endTime) {
    return endTime - startTime;
  }
  
  // 냉장고에 넣은 시간부터 꺼낸 시간(또는 현재)까지의 시간을 제외
  const frozenDuration = takeOutTime - frozenTime;
  
  // 냉장고 시간을 제외한 경과 시간 반환
  return (endTime - startTime) - frozenDuration;
}
```

**사용 예시:**
- 부상 타이머 계산 시 냉장고 시간 제외
- 호출 타임아웃 계산 시 냉장고 시간 제외
- StatsPopup에서 경과 시간 표시 시 냉장고 시간 제외

## 🔄 통합된 기능들

### 1. 수면 시스템과의 통합

**냉장고 상태에서는 수면 개념이 없음:**
- Zzz 애니메이션 표시 안 함
- 수면 호출 비활성화
- 수면 배지 표시 안 함

```javascript:122:127:digimon-tamagotchi-frontend/src/components/Canvas.jsx
// Zzz 스프라이트 (수면 상태일 때, 사망 상태가 아닐 때만, 디지타마 제외, 냉장고 상태 제외)
if((sleepStatus === "SLEEPING" || sleepStatus === "TIRED") && !isDead && !isFrozen && selectedDigimon !== "Digitama"){
  zzzSprites.forEach((src, idx)=>{
    imageSources[`zzz${idx}`]= src;
  });
}
```

### 2. 호출 시스템과의 통합

**냉장고 상태에서는 모든 호출 비활성화:**
- 배고픔 호출 비활성화
- 힘 호출 비활성화
- 수면 호출 비활성화
- 호출 타임아웃 무시

### 3. 사망 시스템과의 통합

**냉장고 상태에서는 사망하지 않음:**
- `applyLazyUpdate`에서 경과 시간을 계산하지 않으므로 사망 조건 체크도 건너뜀
- 냉장고에 넣은 동안 시간이 멈추므로 사망 타이머도 정지

### 4. StatsPopup과의 통합

**냉장고 상태 표시:**
- 모든 타이머에 "🧊 멈춤" 표시
- 냉장고 시간을 제외한 경과 시간 계산
- 냉장고 상태 섹션 표시

## 📝 주요 파일 및 위치

### 핵심 로직
- `src/hooks/useFridge.js` - 냉장고 넣기/꺼내기 로직
- `src/logic/stats/stats.js` - Lazy Update에서 냉장고 상태 처리
- `src/pages/Game.jsx` - 실시간 타이머에서 냉장고 상태 처리
- `src/hooks/useGameLogic.js` - 호출 시스템에서 냉장고 상태 처리

### UI 컴포넌트
- `src/components/FridgeModal.jsx` - 냉장고 모달
- `src/components/Canvas.jsx` - 냉장고 애니메이션
- `src/components/MenuIconButtons.jsx` - 버튼 비활성화
- `src/components/StatsPopup.jsx` - 냉장고 상태 표시

### 데이터 구조
- `src/data/v1/defaultStats.js` - 기본 스탯 정의
- `src/data/defaultStatsFile.js` - 레거시 스탯 정의

## ✅ 구현 완료 사항

- [x] 데이터 구조 추가 (`isFrozen`, `frozenAt`, `takeOutAt`)
- [x] Lazy Update에서 냉장고 상태 처리
- [x] 실시간 타이머에서 냉장고 상태 처리
- [x] 호출 시스템에서 냉장고 상태 처리
- [x] 케어 실수 방지 로직
- [x] 냉장고 넣기/꺼내기 Hook
- [x] 냉장고 모달 UI
- [x] 냉장고 애니메이션 (넣기/꺼내기)
- [x] 버튼 비활성화 (먹이 주기, 훈련하기)
- [x] 냉장고 시간 제외 계산 함수
- [x] StatsPopup 통합

## 🎯 특징

### 장점
1. **완전한 시간 정지**: 모든 수치가 고정되어 안전하게 보관 가능
2. **사망 방지**: 냉장고에 넣은 동안 사망하지 않음
3. **케어 실수 방지**: 호출 무시해도 케어 실수 발생하지 않음
4. **부드러운 애니메이션**: 넣기/꺼내기 애니메이션이 자연스러움
5. **정확한 시간 계산**: 냉장고 시간을 제외한 경과 시간 계산

### 제한사항
1. **사망한 디지몬은 넣을 수 없음**: 사망 후에는 사용 불가
2. **일부 기능은 여전히 활성화**: 배틀, 교감, 화장실, 치료는 가능
3. **애니메이션 시간**: 꺼내기 애니메이션이 3.5초 소요

## 🔍 디버깅 팁

### 냉장고 상태 확인
```javascript
// 콘솔에서 확인
console.log({
  isFrozen: digimonStats.isFrozen,
  frozenAt: digimonStats.frozenAt,
  takeOutAt: digimonStats.takeOutAt,
});
```

### 애니메이션 단계 확인
- 개발자 모드에서 각 단계의 경과 시간 표시
- Canvas.jsx의 `developerMode` 플래그 활성화

### 시간 계산 확인
- `getElapsedTimeExcludingFridge` 함수로 냉장고 시간 제외 계산 확인
- StatsPopup에서 경과 시간 표시 확인

---

**관련 문서:**
- `docs/FRIDGE_IMPLEMENTATION_PLAN.md` - 구현 계획 문서
- `docs/DATABASE_STRUCTURE_ANALYSIS.md` - DB 구조 분석
