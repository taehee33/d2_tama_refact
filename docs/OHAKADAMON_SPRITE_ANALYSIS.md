# 오하카다몬 스프라이트 표시 분석

## 📋 개요

오하카다몬은 디지몬이 사망한 후 환생할 때 나타나는 특별한 디지몬입니다. 일반 디지몬과 달리 고정 스프라이트만 사용하며 애니메이션이 없습니다.

---

## 🎨 스프라이트 정보

### 오하카다몬 종류

**위치**: `src/data/digimondata_digitalmonstercolor25th_ver1.js`, `src/data/v1/digimons.js`

1. **Ohakadamon1** (일반 진화 단계)
   - `sprite: 159`
   - 일반 진화 단계(Perfect 이하)에서 사망 시 환생
   - 스프라이트 파일: `159.png`

2. **Ohakadamon2** (Perfect 이상)
   - `sprite: 160`
   - Perfect, Ultimate, SuperUltimate 단계에서 사망 시 환생
   - 스프라이트 파일: `160.png`

**선택 로직**: `src/hooks/useDeath.js` (38-45줄)
```javascript
let ohaka = "Ohakadamon1";
if (perfectStages.includes(currentStats.evolutionStage)) {
  ohaka = "Ohakadamon2";
}
```

---

## 🖼️ 스프라이트 표시 방식

### 1. 고정 스프라이트 사용 (애니메이션 없음)

**위치**: `src/pages/Game.jsx` (712-718줄)

```javascript
// 오하카다몬: idle 애니메이션 고정 (스프라이트 변경 방지)
if(selectedDigimon === "Ohakadamon1" || selectedDigimon === "Ohakadamon2"){
  // 오하카다몬은 고정 스프라이트만 사용 (애니메이션 없음)
  idleFrames = [ `${digimonStats.sprite}` ];
  eatFramesArr = [ `${digimonStats.sprite}` ];
  rejectFramesArr = [ `${digimonStats.sprite}` ];
}
```

**동작**:
- **고정 스프라이트**: 기본 `sprite` 값만 사용 (159 또는 160)
- **애니메이션 없음**: 모든 액션(idle, eat, reject)에서 동일한 스프라이트 사용
- **프레임 변경 없음**: 다른 디지몬처럼 여러 프레임을 번갈아 표시하지 않음

### 2. 일반 디지몬과의 차이점

**일반 디지몬**:
```javascript
// 애니메이션 프레임 계산
const idleOff = digimonAnimations[idleAnimId]?.frames || [0];
let idleFrames = idleOff.map(n => `${digimonStats.sprite + n}`);
// 예: sprite 240이면 [240, 241, 242, ...] 등 여러 프레임 사용
```

**오하카다몬**:
```javascript
// 고정 스프라이트만 사용
idleFrames = [`${digimonStats.sprite}`];
// 예: sprite 159이면 [159]만 사용 (애니메이션 없음)
```

---

## 🔄 표시 우선순위

### 스프라이트 설정 순서

1. **기본 애니메이션 프레임 계산** (702-710줄)
   ```javascript
   let idleFrames = idleOff.map(n => `${digimonStats.sprite + n}`);
   let eatFramesArr = eatOff.map(n => `${digimonStats.sprite + n}`);
   let rejectFramesArr = rejectOff.map(n => `${digimonStats.sprite + n}`);
   ```

2. **오하카다몬 특별 처리** (712-718줄) ✅ **최우선**
   ```javascript
   if(selectedDigimon === "Ohakadamon1" || selectedDigimon === "Ohakadamon2"){
     // 모든 프레임을 기본 sprite로 고정
     idleFrames = [ `${digimonStats.sprite}` ];
     eatFramesArr = [ `${digimonStats.sprite}` ];
     rejectFramesArr = [ `${digimonStats.sprite}` ];
   }
   ```

3. **수면/피곤 상태 처리** (719-725줄) - 오하카다몬 제외
   ```javascript
   else if(sleepStatus === "SLEEPING" || sleepStatus === "TIRED"){
     // 오하카다몬은 이미 위에서 처리되었으므로 여기서는 제외됨
     idleFrames = [`${digimonStats.sprite + 11}`, `${digimonStats.sprite + 12}`];
   }
   ```

4. **죽음 상태 처리** (727-738줄) - 오하카다몬은 이미 환생한 상태이므로 적용 안 됨
   ```javascript
   if(digimonStats.isDead){
     // 오하카다몬은 isDead가 false이므로 이 로직은 실행되지 않음
     idleFrames = [ `${digimonStats.sprite+1}`, `${digimonStats.sprite+14}` ];
   }
   ```

---

## 📊 실제 표시되는 스프라이트

### Ohakadamon1
- **기본 스프라이트**: `159.png`
- **표시되는 프레임**: `[159]` (고정)
- **애니메이션**: 없음 (정지 상태)

### Ohakadamon2
- **기본 스프라이트**: `160.png`
- **표시되는 프레임**: `[160]` (고정)
- **애니메이션**: 없음 (정지 상태)

---

## 🎯 특징 요약

| 항목 | 일반 디지몬 | 오하카다몬 |
|------|------------|-----------|
| **스프라이트** | 여러 프레임 (예: 240, 241, 242, ...) | 단일 프레임 (159 또는 160) |
| **애니메이션** | 있음 (프레임 전환) | 없음 (고정) |
| **Idle 액션** | 여러 프레임 번갈아 표시 | 기본 sprite만 |
| **Eat 액션** | 여러 프레임 번갈아 표시 | 기본 sprite만 |
| **Reject 액션** | 여러 프레임 번갈아 표시 | 기본 sprite만 |
| **수면 상태** | sprite+11, sprite+12 사용 | 기본 sprite만 (변경 없음) |
| **죽음 상태** | sprite+1, sprite+14 사용 | 적용 안 됨 (이미 환생한 상태) |

---

## 🔍 관련 파일

1. **`src/pages/Game.jsx`** (712-718줄): 오하카다몬 스프라이트 고정 로직
2. **`src/data/digimondata_digitalmonstercolor25th_ver1.js`**: 오하카다몬 데이터 정의
3. **`src/data/v1/digimons.js`**: 오하카다몬 데이터 정의 (새 구조)
4. **`src/hooks/useDeath.js`**: 오하카다몬 선택 로직 (Ohakadamon1 vs Ohakadamon2)
5. **`src/components/Canvas.jsx`**: 스프라이트 렌더링

---

## 💡 설계 의도

오하카다몬은 **사망한 디지몬의 무덤**을 나타내는 특별한 형태입니다. 따라서:
- **고정 스프라이트**: 움직이지 않는 무덤의 특성 반영
- **애니메이션 없음**: 정적이고 고요한 분위기 연출
- **단순한 표시**: 복잡한 애니메이션 없이 단순하게 표시

이를 통해 사용자가 디지몬의 사망을 인지하고, 새로운 디지몬으로 다시 시작할 수 있도록 유도합니다.

---

**작성일**: 2026년 1월 5일  
**버전**: 1.0

