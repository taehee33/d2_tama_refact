# Game.jsx 리팩토링 분석 보고서

## 📊 현재 상태 분석

### 기본 통계
- **총 라인 수**: 1,846줄
- **함수 개수**: 18개
- **State 개수**: 39개 (useState, useRef 포함)
- **Effect 훅**: 8개

### 복잡도 평가
- ⚠️ **매우 높음**: 1,846줄은 단일 컴포넌트로는 과도함
- ⚠️ **책임 과다**: 너무 많은 책임을 한 컴포넌트가 담당
- ⚠️ **유지보수 어려움**: 변경 시 영향 범위가 넓음

---

## 🔍 주요 책임 분석

### 1. **State 관리** (39개 state)
- 디지몬 스탯 관리
- UI 상태 (팝업, 모달, 애니메이션)
- 배틀 관련 상태 (Arena, Quest, Sparring)
- 슬롯 정보
- 개발자 모드 설정

### 2. **데이터 로드/저장** (Firestore)
- `setDigimonStatsAndSave`: 스탯 저장 로직
- `applyLazyUpdateBeforeAction`: Lazy Update 적용
- 슬롯 데이터 로드 (useEffect)

### 3. **게임 로직 함수들**
- `handleEvolutionButton`: 진화 버튼 처리
- `handleEvolution`: 진화 실행
- `handleDeathConfirm`: 사망 처리
- `handleHeal`: 치료 로직
- `handleToggleLights`: 조명 토글
- `eatCycle`, `cleanCycle`: 애니메이션 사이클

### 4. **렌더링** (JSX)
- 메인 게임 화면
- 여러 모달/팝업 (Stats, Feed, Settings, Battle, Quest, Arena 등)
- 조건부 렌더링이 많음

---

## ✅ 이미 분리된 부분

1. **비즈니스 로직**: `useGameActions` 훅으로 분리됨
   - `handleFeed`, `handleTrainResult`, `handleBattleComplete`, `handleCleanPoop`

2. **UI 컴포넌트**: 일부 분리됨
   - `GameScreen`: 메인 게임 화면 렌더링
   - `ControlPanel`: 하단 컨트롤 패널

---

## 🎯 추가 리팩토링 제안

### 우선순위 1: State 관리 분리 (High Priority)

#### 1.1 `useGameState.js` 훅 생성
```javascript
// 모든 state를 하나의 훅으로 관리
export function useGameState(slotId, currentUser) {
  // 디지몬 관련 state
  const [selectedDigimon, setSelectedDigimon] = useState("Digitama");
  const [digimonStats, setDigimonStats] = useState(...);
  
  // UI 관련 state
  const [showStatsPopup, setShowStatsPopup] = useState(false);
  // ... 등등
  
  return {
    // 디지몬
    selectedDigimon, setSelectedDigimon,
    digimonStats, setDigimonStats,
    // UI
    showStatsPopup, setShowStatsPopup,
    // ...
  };
}
```

**장점:**
- State 관리 로직 집중화
- Game.jsx가 더 간결해짐
- State 간 의존성 관리 용이

---

### 우선순위 2: 데이터 로드/저장 로직 분리 (High Priority)

#### 2.1 `useGameData.js` 훅 생성
```javascript
export function useGameData(slotId, currentUser) {
  // 슬롯 데이터 로드
  // setDigimonStatsAndSave
  // applyLazyUpdateBeforeAction
  // Firestore 관련 모든 로직
}
```

**장점:**
- 데이터 로직과 UI 로직 분리
- 테스트 용이성 향상
- 재사용 가능

---

### 우선순위 3: 진화/사망 로직 분리 (Medium Priority)

#### 3.1 `useEvolution.js` 훅 생성
```javascript
export function useEvolution(
  selectedDigimon,
  digimonStats,
  setDigimonStats,
  // ...
) {
  const handleEvolutionButton = async () => { ... };
  const handleEvolution = async (newName) => { ... };
  
  return {
    handleEvolutionButton,
    handleEvolution,
    isEvolving,
    evolutionStage,
  };
}
```

#### 3.2 `useDeath.js` 훅 생성
```javascript
export function useDeath(
  digimonStats,
  setDigimonStats,
  // ...
) {
  const handleDeathConfirm = async () => { ... };
  
  return {
    handleDeathConfirm,
    showDeathConfirm,
    deathReason,
  };
}
```

---

### 우선순위 4: 모달/팝업 관리 분리 (Medium Priority)

#### 4.1 `useModals.js` 훅 생성
```javascript
export function useModals() {
  const [showStatsPopup, setShowStatsPopup] = useState(false);
  const [showFeedPopup, setShowFeedPopup] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  // ... 모든 모달 state
  
  return {
    modals: {
      stats: { show: showStatsPopup, set: setShowStatsPopup },
      feed: { show: showFeedPopup, set: setShowFeedPopup },
      // ...
    },
    openModal: (name) => { ... },
    closeModal: (name) => { ... },
  };
}
```

---

### 우선순위 5: 렌더링 분리 (Low Priority)

#### 5.1 모달 컴포넌트들을 별도 파일로 분리
- `GameModals.jsx`: 모든 모달을 렌더링하는 컨테이너
- 각 모달은 이미 분리되어 있지만, 조건부 렌더링 로직을 모아서 관리

#### 5.2 배틀 관련 UI 분리
- `BattleUI.jsx`: BattleScreen, QuestSelectionModal, ArenaScreen 등을 관리

---

## 📋 리팩토링 로드맵

### Phase 1: State 관리 분리 (1-2일)
1. `useGameState.js` 생성
2. 모든 state를 훅으로 이동
3. Game.jsx에서 훅 사용

### Phase 2: 데이터 로직 분리 (1일)
1. `useGameData.js` 생성
2. Firestore 관련 로직 이동
3. Lazy Update 로직 이동

### Phase 3: 게임 로직 분리 (2일)
1. `useEvolution.js` 생성
2. `useDeath.js` 생성
3. `useHeal.js` 생성 (치료 로직)

### Phase 4: UI 관리 분리 (1일)
1. `useModals.js` 생성
2. 모달 상태 관리 통합

### Phase 5: 렌더링 최적화 (1일)
1. 모달 컨테이너 컴포넌트 생성
2. 조건부 렌더링 로직 정리

---

## 🎯 예상 효과

### Before (현재)
- Game.jsx: 1,846줄
- 단일 파일에 모든 로직
- 유지보수 어려움

### After (리팩토링 후)
- Game.jsx: ~400-500줄 (예상)
- 각 훅: 100-200줄
- 명확한 책임 분리
- 테스트 용이성 향상
- 재사용 가능한 훅들

---

## ⚠️ 주의사항

1. **점진적 리팩토링**: 한 번에 모든 것을 바꾸지 말고 단계적으로 진행
2. **테스트**: 각 단계마다 기능이 정상 작동하는지 확인
3. **의존성 관리**: 훅 간 의존성을 명확히 정의
4. **성능**: 불필요한 리렌더링이 발생하지 않도록 주의

---

## 📝 결론

**Game.jsx는 현재 과도하게 큰 파일입니다.** 

**추천 사항:**
1. ✅ **즉시 진행**: State 관리 분리 (`useGameState`)
2. ✅ **즉시 진행**: 데이터 로직 분리 (`useGameData`)
3. ⚠️ **단기간 내**: 진화/사망 로직 분리
4. 💡 **중장기**: 모달 관리 및 렌더링 최적화

리팩토링을 통해 코드 가독성과 유지보수성을 크게 향상시킬 수 있습니다.



