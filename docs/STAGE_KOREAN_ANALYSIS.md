# Stage 한글화 검토 분석

## 현재 상태

### Stage 값 정의
- **위치**: `digimon-tamagotchi-frontend/src/data/v1/digimons.js`
- **값 목록**:
  - `"Digitama"`
  - `"Baby I"`
  - `"Baby II"`
  - `"Child"`
  - `"Adult"`
  - `"Perfect"`
  - `"Ultimate"`
  - `"Super Ultimate"`
  - `"Ohakadamon"`

### Stage 사용처 분석

#### 1. UI 표시 (표시만, 로직 영향 없음)
- **ArenaScreen.jsx** (4곳):
  - Line 784: `Stage: {currentDigimonInfo.digimonData?.stage || "Unknown"}`
  - Line 886: `Stage: {entry.digimonSnapshot?.stage || "Unknown"}`
  - Line 972: `Stage: {challenger.digimonSnapshot?.stage || "Unknown"}`
  - Line 1423: `Stage: {selectedEntry.digimonSnapshot?.stage || "Unknown"}`
- **DigimonInfoModal.jsx**:
  - Line 136: `{currentDigimonData.stage || 'Unknown'}`

#### 2. 로직 비교 (영향 있음 ⚠️)
- **useGameData.js** (Line 249-257):
  ```javascript
  if (stage === "Digitama" || stage === "Baby I" || stage === "Baby II") {
    sleepSchedule = { start: 20, end: 8 };
  } else if (stage === "Child") {
    sleepSchedule = { start: 21, end: 7 };
  } else if (stage === "Adult" || stage === "Perfect") {
    sleepSchedule = { start: 22, end: 6 };
  } else {
    sleepSchedule = { start: 23, end: 7 };
  }
  ```

#### 3. evolutionStage 비교 (영향 있음 ⚠️)
- **GameModals.jsx** (Line 131, 142):
  ```javascript
  newDigimonDataVer1[key]?.stage === digimonStats.evolutionStage
  ```
- **useGameData.js** (Line 235-236):
  ```javascript
  Object.keys(digimonDataVer1).find(key => 
    digimonDataVer1[key]?.evolutionStage === digimonStats.evolutionStage
  )
  ```

## 한글화 방안

### 방안 1: 표시용 함수 사용 (권장 ✅)

**장점**:
- 내부 로직은 영어 유지 (안정성)
- UI만 한글로 표시
- 기존 코드 영향 최소화

**구현 방법**:
```javascript
// utils/stageTranslator.js
export const stageTranslations = {
  "Digitama": "디지타마",
  "Baby I": "유아기 I",
  "Baby II": "유아기 II",
  "Child": "성장기",
  "Adult": "성숙기",
  "Perfect": "완전체",
  "Ultimate": "궁극체",
  "Super Ultimate": "초궁극체",
  "Ohakadamon": "오하카다몬"
};

export function translateStage(stage) {
  return stageTranslations[stage] || stage || "Unknown";
}
```

**수정 필요 파일**:
- ArenaScreen.jsx (4곳)
- DigimonInfoModal.jsx (1곳)

**영향 범위**: UI 표시만 변경, 로직 영향 없음

### 방안 2: 데이터 자체를 한글로 변경 (비권장 ❌)

**단점**:
- 모든 로직 비교 코드 수정 필요
- 버그 발생 가능성 높음
- evolutionStage와의 일관성 문제

**수정 필요 파일**:
- digimons.js (모든 stage 값)
- useGameData.js (sleepSchedule 로직)
- GameModals.jsx (evolutionStage 비교)
- 기타 stage 비교 로직

**영향 범위**: 전체 코드베이스

## 권장 사항

**방안 1 (표시용 함수)을 권장합니다.**

### 이유:
1. **안정성**: 기존 로직은 그대로 유지
2. **유지보수성**: 표시와 로직 분리로 관리 용이
3. **확장성**: 나중에 다른 언어 추가 시에도 유연함
4. **리스크 최소화**: 버그 발생 가능성 낮음

### 구현 예시:
```javascript
// ArenaScreen.jsx
import { translateStage } from '../utils/stageTranslator';

// 기존
<p className="text-xs text-gray-500 text-center">Stage: {currentDigimonInfo.digimonData?.stage || "Unknown"}</p>

// 변경 후
<p className="text-xs text-gray-500 text-center">세대: {translateStage(currentDigimonInfo.digimonData?.stage)}</p>
```

## 한글 Stage 번역 제안

| 영어 | 한글 제안 |
|------|----------|
| Digitama | 디지타마 |
| Baby I | 유아기 I |
| Baby II | 유아기 II |
| Child | 성장기 |
| Adult | 성숙기 |
| Perfect | 완전체 |
| Ultimate | 궁극체 |
| Super Ultimate | 초궁극체 |
| Ohakadamon | 오하카다몬 |

## 결론

**한글화 가능**: ✅ 가능  
**권장 방법**: 표시용 함수 사용 (방안 1)  
**영향 범위**: UI 표시 부분만 (5곳)  
**예상 작업 시간**: 약 30분  
**리스크**: 낮음

