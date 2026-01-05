# 디지몬 사망 상태 표시 분석

## 📋 개요

디지몬이 사망했을 때 화면에 어떻게 표시되는지 전체적인 흐름을 분석한 문서입니다.

---

## 🎨 시각적 표시 요소

### 1. 스프라이트 애니메이션

**위치**: `src/pages/Game.jsx` (727-737줄)

```javascript
// 죽음 상태: 모션 15번(아픔2) 사용, 스프라이트 1과 14 표시
if(digimonStats.isDead){
  // 모션 15번 (아픔2) - digimonAnimations[15] = battleLose (frames: [1, 14])
  // 스프라이트 1과 14를 번갈아 표시 (애니메이션 정의에 맞춤)
  idleFrames= [ `${digimonStats.sprite+1}`, `${digimonStats.sprite+14}` ];
  eatFramesArr= [ `${digimonStats.sprite+1}`, `${digimonStats.sprite+14}` ];
  rejectFramesArr= [ `${digimonStats.sprite+1}`, `${digimonStats.sprite+14}` ];
  // 죽음 상태에서는 항상 아픔2 모션 사용
  if(currentAnimation !== "pain2"){
    setCurrentAnimation("pain2");
  }
}
```

**동작**:
- 기본 스프라이트에서 `+1`, `+14` 오프셋을 사용
- 예: `sprite`가 360이면 `361.png`, `374.png`를 번갈아 표시
- `pain2` 애니메이션으로 두 프레임이 반복 재생됨
- 모든 액션(idle, eat, reject)에서 동일한 스프라이트 사용

**애니메이션 정의**: `src/data/digimonAnimations.js`
```javascript
15: { name: "battleLose", frames: [1, 14] },
```

---

### 2. 해골 이모지 (💀) 4개 표시

**위치**: `src/components/GameScreen.jsx` (128-195줄)

```javascript
{/* 죽음 상태: 해골 디지몬 주변에 4개 표시 */}
{digimonStats.isDead && (
  <>
    {/* 왼쪽 위 해골 */}
    <div style={{
      position: "absolute",
      top: "30%",
      left: "10%",
      transform: "translateY(-50%)",
      zIndex: 5,
      fontSize: 48,
      opacity: 0.7,
      animation: "float 2s ease-in-out infinite",
    }}>💀</div>
    
    {/* 왼쪽 아래 해골 */}
    <div style={{
      position: "absolute",
      top: "70%",
      left: "10%",
      transform: "translateY(-50%)",
      zIndex: 5,
      fontSize: 48,
      opacity: 0.7,
      animation: "float 2s ease-in-out infinite",
      animationDelay: "0.5s",
    }}>💀</div>
    
    {/* 오른쪽 위 해골 */}
    <div style={{
      position: "absolute",
      top: "30%",
      right: "10%",
      transform: "translateY(-50%)",
      zIndex: 5,
      fontSize: 48,
      opacity: 0.7,
      animation: "float 2s ease-in-out infinite",
      animationDelay: "1s",
    }}>💀</div>
    
    {/* 오른쪽 아래 해골 */}
    <div style={{
      position: "absolute",
      top: "70%",
      right: "10%",
      transform: "translateY(-50%)",
      zIndex: 5,
      fontSize: 48,
      opacity: 0.7,
      animation: "float 2s ease-in-out infinite",
      animationDelay: "1.5s",
    }}>💀</div>
  </>
)}
```

**동작**:
- 디지몬 주변 4곳(왼쪽 위/아래, 오른쪽 위/아래)에 해골 이모지 표시
- 각 해골은 `float` 애니메이션으로 위아래로 부드럽게 움직임
- 애니메이션 딜레이가 다르게 설정되어 시각적 리듬감 제공
- 투명도 0.7로 설정하여 배경과 자연스럽게 블렌딩

---

### 3. 상태 배지 표시

**위치**: `src/components/DigimonStatusBadges.jsx` (68-71줄)

```javascript
// 1. 사망 상태
if (isDead) {
  messages.push({ 
    text: "사망 💀", 
    color: "text-red-600", 
    bgColor: "bg-red-200", 
    priority: 1, 
    category: "critical" 
  });
}
```

**동작**:
- 상태 배지 영역에 "사망 💀" 배지가 최우선순위(priority: 1)로 표시
- 빨간색 텍스트와 배경으로 강조
- `category: "critical"`로 분류되어 항상 최상단에 표시

---

### 4. 상태 텍스트 표시

**위치**: `src/components/DigimonStatusText.jsx` (47-50줄)

```javascript
// 1. 사망 상태
if (isDead) {
  return { text: "사망했습니다... 💀", color: "text-red-600", priority: 1 };
}
```

**동작**:
- 디지몬 상태 텍스트 영역에 "사망했습니다... 💀" 메시지 표시
- 빨간색 텍스트로 강조

---

### 5. 사망 팝업 (DeathPopup)

**위치**: `src/components/DeathPopup.jsx`

```javascript
export default function DeathPopup({ isOpen, onConfirm, onClose, reason }) {
  if (!isOpen) return null;

  // 좀 더 같이 있기: 팝업만 닫고 현재 죽어있는 디지몬을 계속 보여줌
  const handleStay = () => {
    if (onClose) {
      onClose();
    }
  };

  // 사망 확인(안녕..): 오하카다몬으로 환생 처리
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl text-center max-w-md">
        <h2 className="text-3xl font-bold text-red-600 mb-4">
          YOUR DIGIMON HAS DIED
        </h2>
        {/* 사망 원인 상세 정보 표시 */}
        <div className="flex gap-4 justify-center">
          <button onClick={handleStay}>
            좀 더 같이 있기
          </button>
          <button onClick={handleConfirm}>
            사망 확인 (안녕..)
          </button>
        </div>
      </div>
    </div>
  );
}
```

**동작**:
- **자동 표시 안 함**: 사망 시 자동으로 팝업이 표시되지 않음
- **수동 열기**: Death Info 버튼을 클릭했을 때만 표시됨
- **사망 원인 표시**: 사망 원인(`deathReason`)을 아이콘, 제목, 설명과 함께 상세하게 표시
- **두 가지 선택지**:
  - **"좀 더 같이 있기"** 버튼: 팝업만 닫고 현재 죽어있는 디지몬을 계속 보여줌 (환생하지 않음)
  - **"사망 확인 (안녕..)"** 버튼: 오하카다몬으로 환생 처리

**사망 원인 종류**:
- `STARVATION (굶주림)`: 배고픔이 0이고 12시간 경과
- `EXHAUSTION (힘 소진)`: 힘이 0이고 12시간 경과
- `INJURY OVERLOAD (부상 과다: 15회)`: 누적 부상 15회
- `INJURY NEGLECT (부상 방치: 6시간)`: 부상 상태에서 6시간 방치
- `OLD AGE (수명 다함)`: 수명이 최대치에 도달

---

### 6. Death Info 버튼

**위치**: `src/pages/Game.jsx` (1140-1149줄)

```javascript
{/* Death Info 버튼: 죽었을 때만 표시 */}
{digimonStats.isDead && (
  <button
    onClick={() => toggleModal('deathModal', true)}
    className="px-4 py-2 text-white bg-red-800 rounded pixel-art-button hover:bg-red-900"
    title="사망 정보"
  >
    💀 Death Info
  </button>
)}
```

**동작**:
- 사망 상태일 때만 표시되는 버튼
- 클릭하면 사망 팝업을 다시 열 수 있음
- 빨간색 배경으로 강조

---

## 🔄 사망 감지 및 처리 흐름

### 1. 사망 조건 체크

**위치**: `src/pages/Game.jsx` (367-404줄)

타이머가 1초마다 다음 조건들을 체크:

```javascript
// 배고픔/힘이 0이고 12시간 경과 시 사망 체크
if(updatedStats.fullness === 0 && updatedStats.lastHungerZeroAt){
  const elapsed = (Date.now() - updatedStats.lastHungerZeroAt) / 1000;
  if(elapsed >= 43200){ // 12시간 = 43200초
    updatedStats.isDead = true;
    setDeathReason('STARVATION (굶주림)');
  }
}

if(updatedStats.strength === 0 && updatedStats.lastStrengthZeroAt){
  const elapsed = (Date.now() - updatedStats.lastStrengthZeroAt) / 1000;
  if(elapsed >= 43200){
    updatedStats.isDead = true;
    setDeathReason('EXHAUSTION (힘 소진)');
  }
}

// 부상 과다 사망 체크: injuries >= 15
if((updatedStats.injuries || 0) >= 15 && !updatedStats.isDead){
  updatedStats.isDead = true;
  setDeathReason('INJURY OVERLOAD (부상 과다: 15회)');
}

// 부상 방치 사망 체크: isInjured 상태이고 6시간 경과
if(updatedStats.isInjured && updatedStats.injuredAt && !updatedStats.isDead){
  const injuredTime = typeof updatedStats.injuredAt === 'number'
    ? updatedStats.injuredAt
    : new Date(updatedStats.injuredAt).getTime();
  const elapsedSinceInjury = Date.now() - injuredTime;
  if(elapsedSinceInjury >= 21600000){ // 6시간 = 21600000ms
    updatedStats.isDead = true;
    setDeathReason('INJURY NEGLECT (부상 방치: 6시간)');
  }
}

// 수명 종료 체크
const maxLifespan = currentDigimonData?.maxLifespan || 999999;
if(updatedStats.lifespanSeconds >= maxLifespan && !updatedStats.isDead){
  updatedStats.isDead = true;
  setDeathReason('OLD AGE (수명 다함)');
}
```

### 2. 사망 팝업 자동 표시

**위치**: `src/pages/Game.jsx` (461-483줄)

```javascript
// 사망 상태 변경 감지 (한 번만 자동으로 팝업 표시)
if(!prevStats.isDead && updatedStats.isDead && !hasSeenDeathPopup){
  toggleModal('deathModal', true);
  setHasSeenDeathPopup(true);
  // 사망 로그 추가
  const reason = deathReason || 'Unknown';
  setActivityLogs((prevLogs) => {
    const currentLogs = updatedStats.activityLogs || prevLogs || [];
    const updatedLogs = addActivityLog(currentLogs, 'DEATH', `Death: Passed away (Reason: ${reason})`);
    // Firestore에도 저장
    if(slotId && currentUser){
      const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
      updateDoc(slotRef, {
        digimonStats: { ...updatedStats, activityLogs: updatedLogs },
        activityLogs: updatedLogs,
        updatedAt: new Date(),
      }).catch((error) => {
        console.error("사망 로그 저장 오류:", error);
      });
    }
    return updatedLogs;
  });
}
```

**동작**:
- `isDead`가 `false`에서 `true`로 변경될 때 한 번만 실행
- `hasSeenDeathPopup` 플래그로 중복 표시 방지
- Activity Log에 사망 기록 추가
- Firestore에 사망 상태 및 로그 저장

### 3. 타이머 중지

**위치**: `src/pages/Game.jsx` (282-285줄, 290-293줄)

```javascript
// 사망한 경우 타이머 중지
if(digimonStats.isDead) {
  return;
}

const timer = setInterval(() => {
  setDigimonStats((prevStats) => {
    // 사망한 경우 업데이트 중지
    if(prevStats.isDead) {
      return prevStats;
    }
    // ... 스탯 업데이트 로직
  });
}, 1000);
```

**동작**:
- 사망 상태가 되면 타이머가 중지되어 스탯이 더 이상 변경되지 않음
- 디지몬이 정지된 상태로 유지됨

---

## 🎯 사망 시 동작 제한

### 1. 진화 비활성화

**위치**: `src/pages/Game.jsx` (759-762줄)

```javascript
if(digimonStats.isDead && !developerMode) {
  setIsEvoEnabled(false);
  return;
}
```

**동작**:
- 사망 상태에서는 진화 버튼이 비활성화됨
- 개발자 모드가 아닌 경우 진화 불가

### 2. 부상 아이콘 숨김

**위치**: `src/components/GameScreen.jsx` (108줄)

```javascript
{/* 부상 상태 아이콘 (병원 십자가) */}
{digimonStats.isInjured && !digimonStats.isDead && (
  // 부상 아이콘 표시
)}
```

**동작**:
- 사망 상태에서는 부상 아이콘이 표시되지 않음

---

## 📊 전체 표시 요소 요약

| 요소 | 위치 | 표시 내용 | 우선순위 |
|------|------|-----------|----------|
| 스프라이트 | Game.jsx | `sprite+1`, `sprite+14` 번갈아 표시 | - |
| 애니메이션 | Canvas.jsx | `pain2` 모션 사용 | - |
| 해골 이모지 | GameScreen.jsx | 4개 (주변 배치, float 애니메이션) | - |
| 상태 배지 | DigimonStatusBadges.jsx | "사망 💀" (빨간색) | 1 (최우선) |
| 상태 텍스트 | DigimonStatusText.jsx | "사망했습니다... 💀" | 1 |
| 사망 팝업 | DeathPopup.jsx | "YOUR DIGIMON HAS DIED" + 사망 원인 | - |
| Death Info 버튼 | Game.jsx | 💀 Death Info (빨간색) | - |

---

## 🔍 관련 파일 목록

1. **`src/pages/Game.jsx`**: 사망 감지, 스프라이트 설정, 팝업 표시
2. **`src/components/DeathPopup.jsx`**: 사망 팝업 UI
3. **`src/components/GameScreen.jsx`**: 해골 이모지 표시
4. **`src/components/Canvas.jsx`**: 사망 애니메이션 렌더링
5. **`src/components/DigimonStatusBadges.jsx`**: 상태 배지 표시
6. **`src/components/DigimonStatusText.jsx`**: 상태 텍스트 표시
7. **`src/hooks/useDeath.js`**: 사망/환생 로직
8. **`src/data/digimonAnimations.js`**: 애니메이션 정의 (15번: battleLose)

---

**작성일**: 2026년 1월 5일  
**버전**: 1.0

