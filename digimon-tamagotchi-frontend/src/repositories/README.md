# Repository 패턴 가이드

## 개요

이 프로젝트는 **Repository 패턴**을 사용하여 데이터 저장소를 추상화했습니다. 현재는 `localStorage`를 사용하지만, 나중에 `Firestore`로 쉽게 교체할 수 있습니다.

## 사용 방법

### 1. Repository import

```javascript
import { slotRepository } from './repositories/SlotRepository';
```

### 2. 슬롯 데이터 가져오기

```javascript
// 단일 슬롯 가져오기
const slot = await slotRepository.getSlot(slotId);
if (slot) {
  console.log(slot.selectedDigimon);
  console.log(slot.digimonStats);
}

// 모든 슬롯 가져오기
const allSlots = await slotRepository.getAllSlots(10);
```

### 3. 슬롯 데이터 저장하기

```javascript
// 전체 슬롯 데이터 저장
await slotRepository.saveSlot(slotId, {
  selectedDigimon: 'Agumon',
  digimonStats: { /* ... */ },
  slotName: '내 디지몬',
  createdAt: new Date().toISOString(),
  device: 'Digital Monster Color 25th',
  version: 'Ver.1',
});

// 디지몬 스탯만 저장 (자주 호출되는 경우)
await slotRepository.saveDigimonStats(slotId, digimonStats);

// 선택된 디지몬만 저장
await slotRepository.saveSelectedDigimon(slotId, 'Greymon');
```

### 4. 슬롯 삭제

```javascript
await slotRepository.deleteSlot(slotId);
```

### 5. 빈 슬롯 찾기

```javascript
const emptySlotId = await slotRepository.findEmptySlot(10);
if (emptySlotId) {
  // 새 슬롯 생성
} else {
  // 슬롯이 모두 찼습니다
}
```

## 환경변수 설정

`.env` 파일에 다음을 추가하세요:

```env
# 저장소 타입 선택 (localStorage 또는 firestore)
REACT_APP_STORAGE_TYPE=localStorage
```

현재는 `localStorage`가 기본값입니다. Firestore로 전환하려면:

```env
REACT_APP_STORAGE_TYPE=firestore
```

## Firestore로 전환하기

1. `.env` 파일에서 `REACT_APP_STORAGE_TYPE=firestore` 설정
2. `src/repositories/SlotRepository.js`의 `FirestoreSlotRepository` 클래스 구현 완료
3. Firebase 프로젝트 설정 및 인증 완료

## 기존 코드 마이그레이션 예시

### Before (localStorage 직접 사용)

```javascript
// Game.jsx
const savedName = localStorage.getItem(`slot${slotId}_selectedDigimon`) || "Digitama";
const savedStatsStr = localStorage.getItem(`slot${slotId}_digimonStats`);
localStorage.setItem(`slot${slotId}_digimonStats`, JSON.stringify(newStats));
```

### After (Repository 패턴 사용)

```javascript
// Game.jsx
import { slotRepository } from '../repositories/SlotRepository';

const slot = await slotRepository.getSlot(slotId);
const savedName = slot?.selectedDigimon || "Digitama";
const savedStats = slot?.digimonStats || {};

await slotRepository.saveDigimonStats(slotId, newStats);
```

## API 참조

### SlotRepository 메서드

| 메서드 | 설명 | 반환값 |
|--------|------|--------|
| `getSlot(slotId)` | 슬롯 데이터 가져오기 | `Promise<Object\|null>` |
| `getAllSlots(maxSlots)` | 모든 슬롯 목록 가져오기 | `Promise<Array>` |
| `saveSlot(slotId, slotData)` | 슬롯 데이터 저장하기 | `Promise<void>` |
| `saveDigimonStats(slotId, stats)` | 디지몬 스탯만 저장 | `Promise<void>` |
| `saveSelectedDigimon(slotId, name)` | 선택된 디지몬만 저장 | `Promise<void>` |
| `deleteSlot(slotId)` | 슬롯 삭제 | `Promise<void>` |
| `findEmptySlot(maxSlots)` | 빈 슬롯 찾기 | `Promise<number\|null>` |

