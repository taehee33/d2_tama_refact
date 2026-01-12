# selectedId 변경 영향 범위 분석

## 개요
`selectedId`는 배경화면 설정에서 선택된 배경화면 타입을 식별하는 값입니다. 이 값은 `BACKGROUND_TYPES` 배열의 `id` 필드와 매칭됩니다.

## 현재 구조

### 1. backgroundData.js
```javascript
export const BACKGROUND_TYPES = [
  { id: 'default', name: '초원', baseSprite: 162, sprites: [162, 163, 164] },
  { id: 'forest', name: '사막', baseSprite: 165, sprites: [165, 166, 167] },
  { id: 'city', name: '숲', baseSprite: 168, sprites: [168, 169, 170] },
  { id: 'desert', name: '산맥', baseSprite: 171, sprites: [171, 172, 173] },
  { id: 'ocean', name: '바다', baseSprite: 174, sprites: [174, 175, 176] },
  { id: 'space', name: '파일섬', baseSprite: 177, sprites: [177, 178, 179] },
];

export const DEFAULT_BACKGROUND_SETTINGS = {
  selectedId: 'default',  // 기본값
  mode: '0'
};
```

## 영향 받는 파일 및 위치

### 1. ✅ backgroundData.js
**위치**: `digimon-tamagotchi-frontend/src/data/backgroundData.js`
**영향**: 
- `BACKGROUND_TYPES` 배열의 각 항목의 `id` 값
- `DEFAULT_BACKGROUND_SETTINGS.selectedId` 값

**변경 필요 항목**:
- `BACKGROUND_TYPES` 배열의 `id` 값들 (6개)
- `DEFAULT_BACKGROUND_SETTINGS.selectedId` 기본값

### 2. ✅ backgroundUtils.js
**위치**: `digimon-tamagotchi-frontend/src/utils/backgroundUtils.js`
**영향**:
- `getBackgroundSprite` 함수에서 `selectedId`로 `BACKGROUND_TYPES`를 찾음
- 기본값으로 `'default'` 사용

**변경 필요 항목**:
- Line 33: `const { selectedId = 'default', mode = '0' } = settings;`
  - 기본값 `'default'`를 새로운 기본값으로 변경

### 3. ✅ BackgroundSettingsModal.jsx
**위치**: `digimon-tamagotchi-frontend/src/components/BackgroundSettingsModal.jsx`
**영향**:
- `tempSettings?.selectedId === bg.id` 비교
- `backgroundSettings?.selectedId === bg.id` 비교

**변경 필요 항목**:
- 없음 (동적으로 `bg.id`와 비교하므로 자동으로 반영됨)

### 4. ✅ useGameState.js
**위치**: `digimon-tamagotchi-frontend/src/hooks/useGameState.js`
**영향**:
- `setBackgroundNumber` 호환성 함수에서 숫자를 `selectedId`로 변환
- 하드코딩된 `id` 값들 사용

**변경 필요 항목**:
- Line 246-251: `setBackgroundNumber` 함수 내부의 하드코딩된 `id` 값들
  ```javascript
  const bgId = number >= 162 && number <= 164 ? 'default' :
               number >= 165 && number <= 167 ? 'forest' :
               number >= 168 && number <= 170 ? 'city' :
               number >= 171 && number <= 173 ? 'desert' :
               number >= 174 && number <= 176 ? 'ocean' :
               number >= 177 && number <= 179 ? 'space' : 'default';
  ```

### 5. ✅ useGameData.js
**위치**: `digimon-tamagotchi-frontend/src/hooks/useGameData.js`
**영향**:
- Firebase/localStorage에서 배경화면 설정 로드/저장
- `DEFAULT_BACKGROUND_SETTINGS` import 사용

**변경 필요 항목**:
- 없음 (import한 `DEFAULT_BACKGROUND_SETTINGS` 사용)

### 6. ✅ Game.jsx
**위치**: `digimon-tamagotchi-frontend/src/pages/Game.jsx`
**영향**:
- 배경화면 설정 저장/로드 로직

**변경 필요 항목**:
- 없음 (동적으로 처리됨)

## 변경 시나리오별 체크리스트

### 시나리오 1: BACKGROUND_TYPES의 id 값 변경
예: `'default'` → `'grassland'`, `'forest'` → `'desert'` 등

**변경 필요 항목**:
1. ✅ `backgroundData.js` - `BACKGROUND_TYPES` 배열의 모든 `id` 값
2. ✅ `backgroundData.js` - `DEFAULT_BACKGROUND_SETTINGS.selectedId` (기본값이 변경된 경우)
3. ✅ `backgroundUtils.js` - Line 33의 기본값 `'default'` (기본값이 변경된 경우)
4. ✅ `useGameState.js` - Line 246-251의 하드코딩된 `id` 값들

**주의사항**:
- 기존에 저장된 Firebase/localStorage 데이터의 `selectedId` 값과 불일치할 수 있음
- 마이그레이션 로직이 필요할 수 있음

### 시나리오 2: DEFAULT_BACKGROUND_SETTINGS의 selectedId만 변경
예: 기본 배경화면을 `'default'`에서 `'city'`로 변경

**변경 필요 항목**:
1. ✅ `backgroundData.js` - `DEFAULT_BACKGROUND_SETTINGS.selectedId`
2. ✅ `backgroundUtils.js` - Line 33의 기본값 `'default'` → 새로운 기본값

**주의사항**:
- 새로 생성되는 슬롯만 영향받음
- 기존 슬롯은 저장된 값 유지

## 마이그레이션 고려사항

기존 데이터와의 호환성을 위해 다음을 고려해야 합니다:

1. **Firebase 데이터**: 기존 사용자의 `backgroundSettings.selectedId` 값
2. **localStorage 데이터**: 로컬 모드 사용자의 저장된 값
3. **기본값**: 새로 생성되는 슬롯의 기본 배경화면

## 권장 변경 순서

1. `backgroundData.js`에서 `BACKGROUND_TYPES`의 `id` 값 변경
2. `backgroundData.js`에서 `DEFAULT_BACKGROUND_SETTINGS.selectedId` 변경
3. `backgroundUtils.js`에서 기본값 변경
4. `useGameState.js`에서 하드코딩된 `id` 값 변경
5. 테스트: 새로고침, 슬롯 변경, 배경화면 설정 변경
