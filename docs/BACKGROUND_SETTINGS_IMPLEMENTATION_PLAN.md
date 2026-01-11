# 배경화면 설정 기능 구현 계획

## 현재 코드 상태 분석

### 1. 배경화면 렌더링 위치
- **파일**: `digimon-tamagotchi-frontend/src/components/GameScreen.jsx`
- **현재 구현**: 
  ```jsx
  <img
    src={`/images/${backgroundNumber}.png`}
    alt="bg"
    style={{ ... }}
  />
  ```
- **상태 관리**: `useGameState.js`에서 `backgroundNumber` 상태 (기본값: 162)
- **설정 저장**: `SettingsModal.jsx`에서 배경화면 번호 직접 입력 가능

### 2. 현재 배경화면 설정 방식
- 단순히 숫자로 배경화면 번호를 저장 (`backgroundNumber = 162`)
- 시간에 따른 자동 변경 기능 없음
- 고정/자동 모드 구분 없음

## 제안된 기능 요구사항

### 1. 배경화면 종류
- 6종류의 배경화면
- 각 배경화면마다 3가지 스프라이트 (시간대별)
- 스프라이트 시작 번호: 162, 165, 168, 171, 174, 177

### 2. 시간별 자동 변경 규칙
- **오전 5시~7시**: 2번째 스프라이트 (Dusk)
- **오전 7시~18시**: 1번째 스프라이트 (Day)
- **저녁 18시~20시**: 2번째 스프라이트 (Dusk)
- **저녁 20시~오전 5시**: 3번째 스프라이트 (Night)

### 3. 모드 설정
- **자동 모드 (auto)**: 시간에 따라 자동으로 변경
- **고정 모드 (0, 1, 2)**: 특정 스프라이트 고정

### 4. 기본값
- 별도 설정이 없으면 162 배경화면 고정 (현재와 동일)

## 구현 계획

### 1. 데이터 구조 정의

#### 1.1 배경화면 데이터 파일 생성
**파일**: `digimon-tamagotchi-frontend/src/data/backgroundData.js`

```javascript
export const BACKGROUND_TYPES = [
  { 
    id: 'default', 
    name: '기본 배경', 
    baseSprite: 162,
    sprites: [162, 163, 164] // Day, Dusk, Night
  },
  { 
    id: 'forest', 
    name: '평온한 숲', 
    baseSprite: 165,
    sprites: [165, 166, 167]
  },
  { 
    id: 'city', 
    name: '네온 시티', 
    baseSprite: 168,
    sprites: [168, 169, 170]
  },
  { 
    id: 'desert', 
    name: '모래 사막', 
    baseSprite: 171,
    sprites: [171, 172, 173]
  },
  { 
    id: 'ocean', 
    name: '푸른 바다', 
    baseSprite: 174,
    sprites: [174, 175, 176]
  },
  { 
    id: 'space', 
    name: '우주 기지', 
    baseSprite: 177,
    sprites: [177, 178, 179]
  },
];
```

#### 1.2 배경화면 설정 저장 구조
**저장 위치**: `localStorage` 또는 `digimonStats` (슬롯별 설정)

```javascript
backgroundSettings: {
  selectedId: 'default', // 'default' | 'forest' | 'city' | 'desert' | 'ocean' | 'space'
  mode: 'auto' // 'auto' | '0' | '1' | '2'
}
```

**기본값**: `{ selectedId: 'default', mode: '0' }` (162 고정)

### 2. 시간 계산 유틸리티

#### 2.1 시간별 스프라이트 인덱스 계산
**파일**: `digimon-tamagotchi-frontend/src/utils/backgroundUtils.js`

```javascript
/**
 * 현재 시간에 따른 배경화면 스프라이트 인덱스 반환
 * @param {Date} now - 현재 시간 (기본값: new Date())
 * @returns {number} 스프라이트 인덱스 (0: Day, 1: Dusk, 2: Night)
 */
export const getTimeBasedSpriteIndex = (now = new Date()) => {
  const hour = now.getHours();

  // 오전 7시 ~ 오후 18시 : 1번째 (Day)
  if (hour >= 7 && hour < 18) return 0;

  // 오전 5시 ~ 7시 / 오후 18시 ~ 20시 : 2번째 (Dusk)
  if ((hour >= 5 && hour < 7) || (hour >= 18 && hour < 20)) return 1;

  // 오후 20시 ~ 오전 5시 : 3번째 (Night)
  return 2;
};

/**
 * 배경화면 설정에 따라 실제 스프라이트 번호 반환
 * @param {Object} backgroundSettings - 배경화면 설정 { selectedId, mode }
 * @param {Date} currentTime - 현재 시간
 * @returns {number} 스프라이트 번호
 */
export const getBackgroundSprite = (backgroundSettings, currentTime = new Date()) => {
  const { selectedId = 'default', mode = '0' } = backgroundSettings || {};
  
  // BACKGROUND_TYPES에서 선택된 배경 찾기
  const selectedBg = BACKGROUND_TYPES.find(bg => bg.id === selectedId) || BACKGROUND_TYPES[0];
  
  let spriteIndex;
  if (mode === 'auto') {
    // 자동 모드: 시간에 따라 변경
    spriteIndex = getTimeBasedSpriteIndex(currentTime);
  } else {
    // 고정 모드: 지정된 인덱스 사용
    spriteIndex = parseInt(mode, 10);
  }
  
  return selectedBg.sprites[spriteIndex];
};
```

### 3. 상태 관리 수정

#### 3.1 useGameState.js 수정
**기존**: `backgroundNumber` 상태만 관리
**변경**: `backgroundSettings` 상태 추가

```javascript
// 기존
const [backgroundNumber, setBackgroundNumber] = useState(162);

// 변경 후
const [backgroundSettings, setBackgroundSettings] = useState(() => {
  // localStorage에서 로드, 없으면 기본값
  const saved = localStorage.getItem('backgroundSettings');
  if (saved) {
    return JSON.parse(saved);
  }
  return { selectedId: 'default', mode: '0' }; // 162 고정
});

// backgroundSettings 변경 시 localStorage에 저장
useEffect(() => {
  localStorage.setItem('backgroundSettings', JSON.stringify(backgroundSettings));
}, [backgroundSettings]);

// 실제 배경화면 번호 계산 (호환성 유지)
const backgroundNumber = useMemo(() => {
  return getBackgroundSprite(backgroundSettings, customTime || new Date());
}, [backgroundSettings, customTime]);
```

### 4. UI 구현

#### 4.1 CollectionModal 수정
**파일**: `digimon-tamagotchi-frontend/src/components/CollectionModal.jsx`

```javascript
import { BACKGROUND_TYPES } from '../data/backgroundData';
import { getTimeBasedSpriteIndex } from '../utils/backgroundUtils';

export default function CollectionModal({ 
  onClose,
  onBack,
  backgroundSettings,
  setBackgroundSettings,
  currentTime = new Date(),
}) {
  const handleBackgroundSelect = (bgId, mode) => {
    setBackgroundSettings({ selectedId: bgId, mode });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="battle-modal bg-white p-6 rounded-lg shadow-xl" style={{ maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 className="text-2xl font-bold mb-4 text-center">컬렉션</h2>
        
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">배경화면</h3>
          
          {/* 배경화면 목록 */}
          <div className="grid grid-cols-2 gap-4">
            {BACKGROUND_TYPES.map((bg) => {
              const isSelected = backgroundSettings?.selectedId === bg.id;
              const currentMode = isSelected ? backgroundSettings.mode : null;
              
              return (
                <div 
                  key={bg.id}
                  className={`p-3 border-2 rounded-lg ${
                    isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="font-semibold text-center mb-2">{bg.name}</div>
                  
                  {/* 스프라이트 프리뷰 (3개) */}
                  <div className="flex gap-1 mb-2">
                    {bg.sprites.map((spriteNum, idx) => (
                      <img 
                        key={idx}
                        src={`/images/${spriteNum}.png`}
                        alt={`${bg.name} ${idx === 0 ? 'Day' : idx === 1 ? 'Dusk' : 'Night'}`}
                        className={`w-1/3 h-16 object-cover rounded border ${
                          currentMode === idx.toString() ? 'border-blue-500' : 'border-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  
                  {/* 설정 버튼 */}
                  <div className="space-y-1">
                    <button
                      onClick={() => handleBackgroundSelect(bg.id, 'auto')}
                      className={`w-full text-xs py-1 rounded ${
                        isSelected && currentMode === 'auto'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      시간순 변경
                    </button>
                    <div className="flex gap-1">
                      {[0, 1, 2].map(idx => (
                        <button
                          key={idx}
                          onClick={() => handleBackgroundSelect(bg.id, idx.toString())}
                          className={`flex-1 text-[10px] py-1 rounded ${
                            isSelected && currentMode === idx.toString()
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          고정 {idx === 0 ? '낮' : idx === 1 ? '황혼' : '밤'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* 구분선 */}
          <div className="border-t border-gray-300 my-4"></div>
          
          {/* 뒤로가기 버튼 */}
          <button
            onClick={() => {
              if (onBack) {
                onBack();
              } else {
                onClose();
              }
            }}
            className="w-full px-6 py-4 bg-gray-500 text-white rounded-lg font-bold hover:bg-gray-600 transition-colors"
          >
            뒤로가기
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### 4.2 GameModals.jsx 수정
CollectionModal에 필요한 props 전달

```javascript
{modals.collection && (
  <CollectionModal
    onClose={() => toggleModal('collection', false)}
    onBack={() => {
      toggleModal('collection', false);
      toggleModal('extra', true);
    }}
    backgroundSettings={ui?.backgroundSettings}
    setBackgroundSettings={(settings) => {
      // useGameState의 setBackgroundSettings 호출
      // 또는 직접 상태 업데이트
    }}
    currentTime={ui?.customTime || new Date()}
  />
)}
```

### 5. GameScreen.jsx 수정

#### 5.1 실시간 배경화면 업데이트
현재 시간에 따라 배경화면이 자동으로 변경되도록 수정

```javascript
// GameScreen.jsx
const GameScreen = ({
  // ... 기존 props
  backgroundSettings, // 추가
  currentTime, // 추가 (customTime 또는 new Date())
}) => {
  // 배경화면 번호 계산
  const backgroundNumber = useMemo(() => {
    return getBackgroundSprite(backgroundSettings, currentTime);
  }, [backgroundSettings, currentTime]);

  // ... 나머지 코드는 동일
};
```

### 6. 호환성 유지

#### 6.1 기존 backgroundNumber 사용처
- `SettingsModal.jsx`: 기존 배경화면 번호 직접 입력 기능은 유지하되, 컬렉션 모달 사용 권장
- `Game.jsx`: `backgroundNumber` prop은 내부적으로 `backgroundSettings`에서 계산된 값 사용

## 구현 단계

### Phase 1: 데이터 구조 및 유틸리티
1. ✅ `backgroundData.js` 생성
2. ✅ `backgroundUtils.js` 생성
3. ✅ 시간 계산 로직 테스트

### Phase 2: 상태 관리
1. ✅ `useGameState.js`에 `backgroundSettings` 추가
2. ✅ localStorage 저장/로드 로직
3. ✅ `backgroundNumber` 계산 로직 (호환성 유지)

### Phase 3: UI 구현
1. ✅ `CollectionModal.jsx` 수정
2. ✅ 배경화면 선택 UI
3. ✅ 스프라이트 프리뷰 표시
4. ✅ 모드 선택 (자동/고정)

### Phase 4: 통합
1. ✅ `GameModals.jsx` 수정
2. ✅ `GameScreen.jsx` 수정
3. ✅ `Game.jsx`에서 props 전달
4. ✅ 실시간 업데이트 테스트

### Phase 5: 테스트 및 최적화
1. ✅ 시간별 자동 변경 테스트
2. ✅ 고정 모드 테스트
3. ✅ 설정 저장/로드 테스트
4. ✅ 성능 최적화 (useMemo 등)

## 주의사항

1. **기본값 처리**: 설정이 없을 때는 162 고정 (현재와 동일)
2. **호환성**: 기존 `backgroundNumber` 사용 코드와의 호환성 유지
3. **성능**: 배경화면 계산은 `useMemo`로 최적화
4. **시간 동기화**: `customTime`이 있으면 사용, 없으면 `new Date()` 사용
5. **스프라이트 번호**: 실제 스프라이트 파일이 존재하는지 확인 필요

## 다음 단계

1. 스프라이트 파일 확인 (162~179번 스프라이트 존재 여부)
2. 데이터 구조 최종 확정
3. 단계별 구현 시작
