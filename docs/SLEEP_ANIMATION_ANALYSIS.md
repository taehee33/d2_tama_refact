# 잠자는 애니메이션 분석 문서

## 📋 목차
1. [개요](#개요)
2. [애니메이션 구성 요소](#애니메이션-구성-요소)
3. [디지몬 스프라이트](#디지몬-스프라이트)
4. [Zzz 애니메이션](#zzz-애니메이션)
5. [애니메이션 로직](#애니메이션-로직)
6. [주요 파일](#주요-파일)
7. [코드 흐름](#코드-흐름)

---

## 개요

잠자는 애니메이션은 두 가지 요소로 구성됩니다:
1. **디지몬 스프라이트**: 수면 상태에 맞는 스프라이트 프레임
2. **Zzz 애니메이션**: 디지몬 머리 위에 표시되는 수면 표시

---

## 애니메이션 구성 요소

### 1. 디지몬 스프라이트 (수면 프레임)

**위치**: `src/pages/Game.jsx` (719-724줄)

```javascript
// 수면/피곤 상태에서는 고정 슬립 프레임 (오하카다몬 제외)
else if(sleepStatus === "SLEEPING" || sleepStatus === "TIRED"){
  idleFrames = [`${digimonStats.sprite + 12}`, `${digimonStats.sprite + 13}`];
  eatFramesArr = idleFrames;
  rejectFramesArr = idleFrames;
}
```

**특징**:
- `sleepStatus === "SLEEPING"` 또는 `"TIRED"`일 때 적용
- 디지몬의 기본 스프라이트 번호에 +11, +12를 더한 프레임 사용
- 예: 스프라이트 210이면 → 221, 222 프레임 사용
- `digimonAnimations[8] = { name: "sleep", frames: [11, 12] }` 정의에 맞춤
- `idleFrames`, `eatFramesArr`, `rejectFramesArr` 모두 동일한 수면 프레임 사용

### 2. Zzz 애니메이션

**위치**: `src/components/Canvas.jsx` (243-262줄)

```javascript
// Zzz 스프라이트 정의
const zzzSprites = [
  "/images/535.png", 
  "/images/536.png", 
  "/images/537.png", 
  "/images/538.png"
]; // 4개 프레임

// 렌더링
if(sleepStatus === "SLEEPING" || sleepStatus === "TIRED"){
  const zzzFrameIdx = Math.floor(frame/speed) % zzzSprites.length;
  const zzzKey = `zzz${zzzFrameIdx}`;
  const zzzImg = spriteCache.current[zzzKey];
  if(zzzImg && zzzImg.naturalWidth > 0){
    // 디지몬 머리 위에 표시
    const zzzW = width * 0.3;
    const zzzH = height * 0.2;
    const zzzX = (width - zzzW) / 2;
    const zzzY = (height - height*0.4) / 2 - zzzH; // 디지몬 위쪽
    ctx.drawImage(zzzImg, zzzX, zzzY, zzzW, zzzH);
  }
}
```

**특징**:
- 4개의 Zzz 스프라이트 (535.png ~ 538.png)
- 디지몬 머리 위 중앙에 표시
- 애니메이션 속도: `speed = 25` (25프레임마다 다음 프레임)
- 순환 애니메이션: 0 → 1 → 2 → 3 → 0 → ...

---

## 디지몬 스프라이트

### 애니메이션 정의

**위치**: `src/data/digimonAnimations.js` (13줄)

```javascript
8: { name: "sleep", frames: [11, 12] },
```

**참고**: 
- 애니메이션 정의: `[11, 12]`
- 실제 코드: `sprite + 11`, `sprite + 12` 사용
- ✅ **일치**: 정의와 코드가 일치함

### 스프라이트 계산

```javascript
// 예시: Botamon (sprite = 210)
idleFrames = ["221", "222"]; // 210 + 11, 210 + 12

// 실제 이미지 파일
// /images/221.png
// /images/222.png
```

### 프레임 전환

**위치**: `src/components/Canvas.jsx` (147-159줄)

```javascript
// 디지몬 애니메이션
const idx = Math.floor(frame/speed) % frames.length;
const name = frames[idx]; // "222" 또는 "223"
const digimonImg = spriteCache.current[`digimon${idx}`];
ctx.drawImage(digimonImg, digiX, digiY, digiW, digiH);
```

**특징**:
- `speed = 25` (25프레임마다 다음 프레임)
- 2개 프레임 순환: 0 → 1 → 0 → 1 → ...
- 약 0.4초마다 프레임 전환 (60fps 기준)

---

## Zzz 애니메이션

### 스프라이트 파일

```
/images/535.png  (Zzz 프레임 1)
/images/536.png  (Zzz 프레임 2)
/images/537.png  (Zzz 프레임 3)
/images/538.png  (Zzz 프레임 4)
```

### 애니메이션 로직

```javascript
// 프레임 인덱스 계산
const zzzFrameIdx = Math.floor(frame/speed) % zzzSprites.length;
// 0 → 1 → 2 → 3 → 0 → 1 → ...

// 이미지 로드
if(sleepStatus === "SLEEPING" || sleepStatus === "TIRED"){
  zzzSprites.forEach((src, idx) => {
    imageSources[`zzz${idx}`] = src;
  });
}
```

### 위치 및 크기

```javascript
const zzzW = width * 0.3;        // 화면 너비의 30%
const zzzH = height * 0.2;       // 화면 높이의 20%
const zzzX = (width - zzzW) / 2; // 중앙 정렬
const zzzY = (height - height*0.4) / 2 - zzzH; // 디지몬 위쪽
```

**레이아웃**:
```
┌─────────────────┐
│                 │
│     [Zzz]       │ ← zzzY (디지몬 위)
│                 │
│   [디지몬]      │ ← 디지몬 위치
│                 │
└─────────────────┘
```

---

## 애니메이션 로직

### 전체 흐름

```
[게임 시작]
    ↓
[sleepStatus 확인]
    ├─ AWAKE → 일반 idle 애니메이션
    ├─ TIRED → 수면 애니메이션
    └─ SLEEPING → 수면 애니메이션
         ↓
    [디지몬 스프라이트 변경]
    idleFrames = [sprite + 12, sprite + 13]
         ↓
    [Zzz 스프라이트 로드]
    zzzSprites = [535.png, 536.png, 537.png, 538.png]
         ↓
    [애니메이션 시작]
    - 디지몬: 2프레임 순환 (25프레임마다)
    - Zzz: 4프레임 순환 (25프레임마다)
```

### 상태별 동작

| 상태 | 디지몬 스프라이트 | Zzz 표시 | 애니메이션 |
|------|------------------|---------|-----------|
| **AWAKE** | 일반 idle 프레임 | ❌ 없음 | 일반 애니메이션 |
| **TIRED** | sprite + 11, +12 | ✅ 표시 | 수면 애니메이션 |
| **SLEEPING** | sprite + 11, +12 | ✅ 표시 | 수면 애니메이션 |

---

## 주요 파일

### 1. `src/components/Canvas.jsx`
- **역할**: 애니메이션 렌더링
- **주요 함수**:
  - `initImages()`: Zzz 스프라이트 로드
  - `startAnimation()`: 애니메이션 루프
  - Zzz 렌더링 로직 (243-262줄)

### 2. `src/pages/Game.jsx`
- **역할**: 수면 상태에 따른 프레임 설정
- **주요 로직**:
  - `sleepStatus` 확인 (719-724줄)
  - `idleFrames` 설정

### 3. `src/data/digimonAnimations.js`
- **역할**: 애니메이션 정의
- **내용**:
  - `8: { name: "sleep", frames: [11, 12] }`
  - **참고**: 실제 코드와 불일치 (코드는 +12, +13 사용)

---

## 코드 흐름

### 1. 수면 상태 감지

```javascript
// Game.jsx
const sleepStatus = getSleepStatus({
  sleepSchedule: schedule,
  isLightsOn,
  wakeUntil,
  fastSleepStart,
  now: nowDate,
});

// sleepStatus === "SLEEPING" || "TIRED"
```

### 2. 프레임 설정

```javascript
// Game.jsx (719-724줄)
if(sleepStatus === "SLEEPING" || sleepStatus === "TIRED"){
  idleFrames = [`${digimonStats.sprite + 11}`, `${digimonStats.sprite + 12}`];
  eatFramesArr = idleFrames;
  rejectFramesArr = idleFrames;
}
```

### 3. Zzz 스프라이트 로드

```javascript
// Canvas.jsx (105-110줄)
if(sleepStatus === "SLEEPING" || sleepStatus === "TIRED"){
  zzzSprites.forEach((src, idx) => {
    imageSources[`zzz${idx}`] = src;
  });
}
```

### 4. 애니메이션 렌더링

```javascript
// Canvas.jsx (147-159줄) - 디지몬
const idx = Math.floor(frame/speed) % frames.length;
const digimonImg = spriteCache.current[`digimon${idx}`];
ctx.drawImage(digimonImg, digiX, digiY, digiW, digiH);

// Canvas.jsx (243-262줄) - Zzz
const zzzFrameIdx = Math.floor(frame/speed) % zzzSprites.length;
const zzzImg = spriteCache.current[`zzz${zzzFrameIdx}`];
ctx.drawImage(zzzImg, zzzX, zzzY, zzzW, zzzH);
```

---

## 애니메이션 속도

### 프레임 전환 속도

```javascript
const speed = 25; // 25프레임마다 다음 프레임
```

**계산**:
- 60fps 기준: 25프레임 = 약 0.42초
- 디지몬: 2프레임 순환 → 약 0.84초 주기
- Zzz: 4프레임 순환 → 약 1.68초 주기

---

## 특징 및 주의사항

### ✅ 잘 구현된 부분

1. **상태별 분기**: AWAKE/TIRED/SLEEPING에 따라 다른 애니메이션
2. **Zzz 애니메이션**: 디지몬 머리 위에 자연스럽게 표시
3. **프레임 순환**: 부드러운 애니메이션 루프

### ⚠️ 주의사항

1. **애니메이션 정의 일치** ✅
   - `digimonAnimations[8]` = `frames: [11, 12]`
   - 실제 코드 = `sprite + 11, sprite + 12`
   - ✅ **일치**: 정의와 코드가 일치함

2. **애니메이션 속도**
   - 디지몬과 Zzz가 같은 속도(`speed = 25`) 사용
   - 동기화되어 있지만, 필요시 분리 가능

3. **오하카다몬 예외 처리**
   - 오하카다몬은 수면 애니메이션 적용 안 됨
   - 고정 스프라이트만 사용

---

## 개선 제안

### 1. 애니메이션 정의 일치 ✅ (완료)

```javascript
// Game.jsx (수정 완료)
idleFrames = [`${digimonStats.sprite + 11}`, `${digimonStats.sprite + 12}`];
// digimonAnimations[8] = { name: "sleep", frames: [11, 12] }와 일치
```

### 2. 애니메이션 속도 분리 (선택사항)

```javascript
const digimonSpeed = 25;
const zzzSpeed = 20; // Zzz는 조금 더 빠르게
```

### 3. 수면 애니메이션 전용 함수 (선택사항)

```javascript
function getSleepFrames(sprite) {
  return [`${sprite + 12}`, `${sprite + 13}`];
}
```

---

## 참고 문서

- [SLEEP_SYSTEM_ANALYSIS.md](./SLEEP_SYSTEM_ANALYSIS.md) - 수면 시스템 분석
- [REFACTORING_LOG.md](./REFACTORING_LOG.md) - 리팩토링 이력

---

**작성일**: 2026-01-XX  
**상태**: 현재 구현 완료 ✅

