# 냉장고(냉동수면) 기능 구현 계획

## 📋 현재 개발 상태 분석

### ✅ 구현 가능 여부: **가능**

현재 코드베이스는 냉장고 기능 구현에 필요한 모든 요소를 갖추고 있습니다:
- Lazy Update 시스템 (`applyLazyUpdate`)
- 스프라이트 렌더링 시스템 (`Canvas.jsx`)
- 상태 관리 (`useGameState`, `useGameData`)
- 버튼 비활성화 패턴 (기존 코드에서 사용 중)

---

## 🎯 기능 요구사항

### 1. 핵심 기능
- **성장 정지**: 나이(Age)와 진화 타이머(Evolution Timer)가 멈춤
- **수치 고정**: 배고픔, 힘, 에너지 등 모든 수치가 고정
- **사망 방지**: 호출(Call) 무시, 케어 실수 해도 죽지 않음
- **시간 보존**: 냉장고에 넣은 시간을 기록하고, 꺼낼 때 그 시간만큼 제외

### 2. UI/UX 요구사항
- **냉장고에 넣을 때**:
  - 밥 위치에 552 냉장고 스프라이트 표시
  - 디지몬 위에 554, 555 스프라이트 덮기 (저장 효과)
  - 화면 가운데에 553 냉장고 안에 저장된 스프라이트 표시 (계속해서)
- **냉장고에서 꺼낼 때**: 반대 순서로 애니메이션
- **버튼 비활성화**: 냉장고 상태일 때 먹이 주기, 훈련하기 버튼 비활성화

---

## 🔧 구현 계획

### 1단계: 데이터 구조 추가

#### `src/data/v1/defaultStats.js` 수정
```javascript
export const defaultStats = {
  // ... 기존 필드들 ...
  
  // 냉장고 관련
  isFrozen: false,        // 냉장고 보관 여부
  frozenAt: null,         // 냉장고에 넣은 시간 (timestamp)
};
```

#### `src/data/defaultStatsFile.js` 수정
```javascript
export const defaultStats = {
  // ... 기존 필드들 ...
  isFrozen: false,
  frozenAt: null,
};
```

---

### 2단계: Lazy Update 로직 수정

#### `src/logic/stats/stats.js`의 `applyLazyUpdate` 함수 수정
```javascript
export function applyLazyUpdate(stats, lastSavedAt, sleepSchedule = null, maxEnergy = null) {
  // ... 기존 코드 ...
  
  // 냉장고 상태 체크
  if (stats.isFrozen && stats.frozenAt) {
    // 냉장고에 넣은 시간 이후의 경과 시간을 계산에서 제외
    const frozenTime = typeof stats.frozenAt === 'number' 
      ? stats.frozenAt 
      : new Date(stats.frozenAt).getTime();
    
    // frozenAt 이후의 시간은 계산하지 않음
    // lastSavedAt을 frozenAt으로 조정하여 경과 시간을 0으로 만듦
    const adjustedLastSaved = Math.max(
      lastSaved.getTime(),
      frozenTime
    );
    
    // 조정된 시간으로 경과 시간 재계산
    const adjustedElapsedSeconds = Math.floor((now.getTime() - adjustedLastSaved) / 1000);
    
    if (adjustedElapsedSeconds <= 0) {
      // 냉장고 상태에서는 모든 수치 고정
      return { ...stats, lastSavedAt: now };
    }
    
    // 냉장고 상태에서는 경과 시간을 0으로 처리
    return { ...stats, lastSavedAt: now };
  }
  
  // ... 기존 로직 계속 ...
}
```

---

### 3단계: 냉장고 상태 관리 Hook 생성

#### `src/hooks/useFridge.js` 생성
```javascript
// src/hooks/useFridge.js
// 냉장고(냉동수면) 기능 관리 Hook

export function useFridge({
  digimonStats,
  setDigimonStatsAndSave,
  applyLazyUpdateBeforeAction,
  setActivityLogs,
  activityLogs,
  addActivityLog,
}) {
  /**
   * 냉장고에 넣기
   */
  async function putInFridge() {
    const currentStats = await applyLazyUpdateBeforeAction();
    
    if (currentStats.isDead) {
      alert("사망한 디지몬은 냉장고에 넣을 수 없습니다.");
      return;
    }
    
    const updatedStats = {
      ...currentStats,
      isFrozen: true,
      frozenAt: Date.now(),
    };
    
    const updatedLogs = addActivityLog(
      activityLogs || [],
      'FRIDGE',
      '냉장고에 보관했습니다. 시간이 멈춥니다.'
    );
    
    await setDigimonStatsAndSave(updatedStats, updatedLogs);
  }
  
  /**
   * 냉장고에서 꺼내기
   */
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
    
    // 냉장고 상태 해제
    const updatedStats = {
      ...currentStats,
      isFrozen: false,
      frozenAt: null,
      // lastSavedAt을 현재 시간으로 업데이트하여 다음 Lazy Update가 정상 작동하도록
      lastSavedAt: new Date(),
    };
    
    // 냉장고 전용 대사
    const messages = [
      "추웠어!",
      "잘 잤다!",
      "냉장고에서 나왔어!",
      "시간이 다시 흐르기 시작했어!",
    ];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    
    const durationText = frozenDurationSeconds < 60
      ? `${frozenDurationSeconds}초`
      : frozenDurationSeconds < 3600
      ? `${Math.floor(frozenDurationSeconds / 60)}분`
      : `${Math.floor(frozenDurationSeconds / 3600)}시간`;
    
    const updatedLogs = addActivityLog(
      activityLogs || [],
      'FRIDGE',
      `냉장고에서 꺼냈습니다. (${durationText} 동안 보관) - ${randomMessage}`
    );
    
    await setDigimonStatsAndSave(updatedStats, updatedLogs);
  }
  
  return {
    putInFridge,
    takeOutFromFridge,
  };
}
```

---

### 4단계: 스프라이트 렌더링 추가

#### `src/components/Canvas.jsx` 수정
```javascript
// 냉장고 스프라이트 추가
const fridgeSprites = [
  "/images/552.png", // 냉장고 (밥 위치)
  "/images/553.png", // 냉장고 안 (화면 가운데)
  "/images/554.png", // 덮개 1 (디지몬 위)
  "/images/555.png", // 덮개 2 (디지몬 위)
];

// initImages 함수에 냉장고 스프라이트 추가
if (isFrozen) {
  fridgeSprites.forEach((src, idx) => {
    imageSources[`fridge${idx}`] = src;
  });
}

// startAnimation 함수에 냉장고 렌더링 추가
if (isFrozen) {
  // 1. 밥 위치에 냉장고 (552)
  const fridgeImg0 = spriteCache.current['fridge0'];
  if (fridgeImg0) {
    const fridgeW = width * 0.3;
    const fridgeH = height * 0.3;
    const fridgeX = width * 0.2; // 왼쪽 (밥 위치)
    const fridgeY = height * 0.6;
    ctx.drawImage(fridgeImg0, fridgeX, fridgeY, fridgeW, fridgeH);
  }
  
  // 2. 화면 가운데 냉장고 안 (553)
  const fridgeImg1 = spriteCache.current['fridge1'];
  if (fridgeImg1) {
    const fridgeW = width * 0.5;
    const fridgeH = height * 0.5;
    const fridgeX = (width - fridgeW) / 2;
    const fridgeY = (height - fridgeH) / 2;
    ctx.drawImage(fridgeImg1, fridgeX, fridgeY, fridgeW, fridgeH);
  }
  
  // 3. 디지몬 위에 덮개 (554, 555)
  const fridgeImg2 = spriteCache.current['fridge2'];
  const fridgeImg3 = spriteCache.current['fridge3'];
  if (fridgeImg2 && fridgeImg3) {
    const coverW = width * 0.4;
    const coverH = height * 0.4;
    const coverX = (width - coverW) / 2;
    const coverY = (height - height*0.4) / 2 - coverH * 0.3;
    
    // 덮개 1 (554)
    ctx.drawImage(fridgeImg2, coverX, coverY, coverW, coverH);
    // 덮개 2 (555) - 약간 아래
    ctx.drawImage(fridgeImg3, coverX, coverY + coverH * 0.2, coverW, coverH);
  }
}
```

---

### 5단계: UI 버튼 비활성화

#### `src/components/MenuIconButtons.jsx` 수정
```javascript
const MenuIconButtons = ({ 
  width, 
  height, 
  activeMenu, 
  onMenuClick, 
  isMobile = false,
  isFrozen = false, // 냉장고 상태 추가
}) => {
  // 냉장고 상태일 때 비활성화할 메뉴
  const disabledMenus = isFrozen ? ['eat', 'train'] : [];
  
  // ... 기존 코드 ...
  
  <IconButton
    key={menu}
    icon={iconPath(menu)}
    onClick={() => onMenuClick(menu)}
    isActive={activeMenu === menu}
    disabled={disabledMenus.includes(menu)} // 비활성화 추가
    width={60}
    height={60}
    className="icon-button-mobile touch-button"
    label={menuLabel(menu)}
  />
};
```

#### `src/components/IconButton.jsx` 수정
```javascript
const IconButton = ({ 
  icon, 
  onClick, 
  isActive = false, 
  width = 40, 
  height = 40,
  className = "",
  label = "",
  disabled = false, // disabled prop 추가
}) => {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`${className} ${isActive ? 'active' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      style={{ width, height }}
    >
      {/* ... 기존 코드 ... */}
    </button>
  );
};
```

---

### 6단계: 냉장고 모달/버튼 추가

#### `src/components/FridgeModal.jsx` 생성
```javascript
// src/components/FridgeModal.jsx
// 냉장고 모달 컴포넌트

import React from "react";
import "../styles/Battle.css";

export default function FridgeModal({
  isFrozen,
  onPutIn,
  onTakeOut,
  onClose,
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="battle-modal bg-white p-6 rounded-lg shadow-xl">
        <h2 className="text-2xl font-bold mb-4 text-center">냉장고</h2>
        
        <div className="space-y-4">
          {!isFrozen ? (
            <>
              <p className="text-center text-gray-700 mb-4">
                디지몬을 냉장고에 보관하면 시간이 멈춥니다.
                <br />
                모든 수치가 고정되고 사망하지 않습니다.
              </p>
              <button
                onClick={() => {
                  onPutIn();
                  onClose();
                }}
                className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors"
              >
                냉장고에 넣기
              </button>
            </>
          ) : (
            <>
              <p className="text-center text-gray-700 mb-4">
                디지몬이 냉장고에 보관되어 있습니다.
                <br />
                꺼내면 시간이 다시 흐르기 시작합니다.
              </p>
              <button
                onClick={() => {
                  onTakeOut();
                  onClose();
                }}
                className="w-full px-6 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors"
              >
                냉장고에서 꺼내기
              </button>
            </>
          )}
          
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gray-500 text-white rounded-lg font-bold hover:bg-gray-600 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### `src/components/ExtraMenuModal.jsx` 수정
```javascript
// 냉장고 버튼 추가
<button
  onClick={() => {
    if (onOpenFridge) {
      onOpenFridge();
    }
    onClose();
  }}
  className="px-6 py-3 bg-cyan-500 text-white rounded-lg font-bold hover:bg-cyan-600 transition-colors"
>
  냉장고
</button>
```

---

### 7단계: Game.jsx 통합

#### `src/pages/Game.jsx` 수정
```javascript
// useFridge Hook 추가
import { useFridge } from "../hooks/useFridge";

// Game.jsx 내부
const {
  putInFridge,
  takeOutFromFridge,
} = useFridge({
  digimonStats,
  setDigimonStatsAndSave,
  applyLazyUpdateBeforeAction,
  setActivityLogs,
  activityLogs,
  addActivityLog,
});

// handlers에 추가
const handlers = {
  // ... 기존 handlers ...
  putInFridge,
  takeOutFromFridge,
};

// GameModals에 전달
<GameModals
  // ... 기존 props ...
  handlers={handlers}
/>

// Canvas에 isFrozen 전달
<Canvas
  // ... 기존 props ...
  isFrozen={digimonStats.isFrozen || false}
/>
```

---

## 📝 구현 체크리스트

### 데이터 구조
- [ ] `defaultStats.js`에 `isFrozen`, `frozenAt` 필드 추가
- [ ] `defaultStatsFile.js`에 `isFrozen`, `frozenAt` 필드 추가

### 로직
- [ ] `applyLazyUpdate` 함수에 냉장고 상태 처리 추가
- [ ] `useFridge.js` Hook 생성
- [ ] 냉장고 상태에서 호출(Call) 무시 로직 추가
- [ ] 냉장고 상태에서 케어 실수 무시 로직 추가

### UI
- [ ] `Canvas.jsx`에 냉장고 스프라이트 렌더링 추가
- [ ] `FridgeModal.jsx` 생성
- [ ] `ExtraMenuModal.jsx`에 냉장고 버튼 추가
- [ ] `MenuIconButtons.jsx`에 버튼 비활성화 로직 추가
- [ ] `IconButton.jsx`에 `disabled` prop 추가

### 통합
- [ ] `Game.jsx`에 `useFridge` Hook 통합
- [ ] `GameModals.jsx`에 `FridgeModal` 추가
- [ ] `ControlPanel.jsx`에 `isFrozen` prop 전달

---

## ⚠️ 주의사항

1. **Lazy Update 처리**: 냉장고 상태일 때 `frozenAt` 이후의 시간을 계산에서 제외해야 함
2. **사망 체크**: 냉장고 상태에서는 `checkDeathCondition`이 항상 `false`를 반환해야 함
3. **호출 처리**: 냉장고 상태에서는 모든 호출(Call)을 무시해야 함
4. **애니메이션**: 냉장고 스프라이트는 애니메이션이 아닌 정적 이미지로 표시

---

## 🎨 UI/UX 개선 아이디어

1. **냉장고 전용 대사**: 꺼낼 때 "추웠어!", "잘 잤다!" 등 랜덤 메시지
2. **보관 시간 표시**: 냉장고 상태일 때 보관 시간 표시
3. **애니메이션 효과**: 냉장고에 넣을 때/꺼낼 때 부드러운 전환 효과

---

## 📚 참고사항

- 스프라이트 번호: 552 (냉장고), 553 (냉장고 안), 554 (덮개 1), 555 (덮개 2)
- 냉장고 상태는 `isFrozen`과 `frozenAt`으로 관리
- 모든 시간 기반 로직은 `applyLazyUpdate`를 통해 처리되므로, 여기서 냉장고 상태를 체크하면 됨
