# Status 메뉴 분석 문서

이 문서는 현재 프로젝트에서 사용되는 모든 Status 표시 컴포넌트와 메뉴를 분석합니다.

---

## 📊 Status 표시 컴포넌트 목록

### 1. **StatsPanel** (항상 표시되는 작은 패널)
- **위치**: `src/components/StatsPanel.jsx`
- **표시 위치**: Game 화면 좌측 하단 (MenuIconButtons 옆)
- **표시 방식**: 항상 보임 (고정 패널)

### 2. **StatsPopup** (Status 메뉴 클릭 시 모달)
- **위치**: `src/components/StatsPopup.jsx`
- **표시 위치**: 화면 중앙 모달 (오버레이)
- **표시 방식**: "status" 메뉴 아이콘 클릭 시 표시

### 3. **DigimonInfoModal - INFO View** (❓ 버튼 클릭 시)
- **위치**: `src/components/DigimonInfoModal.jsx` (INFO 뷰)
- **표시 위치**: 화면 중앙 모달 (오버레이)
- **표시 방식**: '?' 버튼 클릭 → Digimon Info 선택

### 4. **Game.jsx 직접 표시** (게임 화면 상단)
- **위치**: `src/pages/Game.jsx` (렌더링 부분)
- **표시 위치**: 게임 화면 상단 (Canvas 위)
- **표시 방식**: 항상 보임 (고정 텍스트)

---

## 📋 각 컴포넌트 상세 분석

### 1. StatsPanel (항상 표시 패널)

#### 표시되는 스탯
```javascript
- Age
- Weight
- Strength
- Energy (DP)
- WinRate
- Effort
- CareMistakes
- Sleep (sleepStatus prop)
- Fullness (오버피드 표시 포함)
- Dev Info (개발자 모드):
  - Protein Overdose
  - Overfeeds
  - Battles
  - Wins / Losses
```

#### 변수 연결 상태
- **Props**: `stats` (digimonStats), `sleepStatus`
- **데이터 소스**: `digimonStats` (Game.jsx에서 전달)
- **업데이트**: `digimonStats` 변경 시 자동 업데이트
- **문제점**: 
  - `health` 필드가 제거되었지만 코드에는 없음 (이미 수정됨)
  - `stamina`와 `energy` 혼용 (energy 우선, 없으면 stamina)

#### 장점
✅ **항상 보임**: 게임 중 주요 스탯을 한눈에 확인 가능  
✅ **간결함**: 핵심 정보만 표시  
✅ **실시간 업데이트**: `digimonStats` 변경 시 즉시 반영  
✅ **개발자 정보**: Dev Info 섹션으로 디버깅 용이

#### 단점
❌ **공간 제약**: 작은 패널이라 정보가 제한적  
❌ **스타일**: 기본적인 텍스트 리스트 형식 (시각적 매력 부족)  
❌ **변수명 혼용**: `energy`와 `stamina` 혼용 (호환성 유지용이지만 혼란 가능)  
❌ **Health 표시 제거**: 이전에는 Health가 있었지만 제거됨 (의도적)

---

### 2. StatsPopup (Status 메뉴 모달)

#### 표시되는 스탯
```javascript
// 기본 스탯
- Age, Sprite, Stage
- Strength, Energy (DP), Effort, WinRate
- CareMistakes
- Lifespan, TimeToEvolve
- Fullness (오버피드 표시)
- Health (⚠️ 레거시 필드, 제거되어야 함)
- Weight, MaxOverfeed
- isDead

// 타이머
- HungerTimer, StrengthTimer, PoopTimer

// 숨겨진 스탯
- MaxStamina, MinWeight
- Healing, Attribute, Power
- Attack Sprite, Alt Attack Sprite
- Training (trainingCount)

// 똥 관련
- PoopCount, LastMaxPoopTime

// 매뉴얼 기반 필드
- Protein Overdose
- Overfeeds
- Battles, Battles Won, Battles Lost
- Battles for Evolution
```

#### 변수 연결 상태
- **Props**: `stats` (digimonStats), `devMode`, `onChangeStats`
- **데이터 소스**: `digimonStats` (Game.jsx에서 전달)
- **업데이트**: `digimonStats` 변경 시 자동 업데이트
- **개발자 모드**: `devMode`가 true일 때 select box로 수정 가능
- **문제점**: 
  - ⚠️ **`health` 필드 표시**: 이미 제거된 필드인데 여전히 표시됨 (120번째 줄)
  - ⚠️ **`stamina`와 `energy` 혼용**: `stats.energy !== undefined ? stats.energy : (stamina || 0)`
  - ⚠️ **레거시 필드 표시**: `healing`, `attribute` 등 미사용 필드 표시

#### 장점
✅ **상세 정보**: 모든 스탯을 한 번에 확인 가능  
✅ **개발자 모드**: select box로 스탯 수정 가능 (디버깅 용이)  
✅ **스크롤 가능**: 많은 정보를 표시하기 위해 스크롤 지원  
✅ **타임스탬프 표시**: `lastMaxPoopTime` 등 시간 정보 표시

#### 단점
❌ **레거시 필드**: 제거된 `health` 필드가 여전히 표시됨  
❌ **정보 과다**: 너무 많은 정보로 인해 가독성 저하  
❌ **스타일**: 기본적인 리스트 형식 (시각적 매력 부족)  
❌ **변수명 혼용**: `stamina`와 `energy` 혼용  
❌ **미사용 필드**: `healing`, `attribute` 등 실제로 사용되지 않는 필드 표시

---

### 3. DigimonInfoModal - INFO View (❓ 버튼)

#### 표시되는 스탯

**Profile 섹션:**
- Name, Stage, Type, Sprite

**Specs 섹션:**
- Base Power, Max DP, Lifespan, Min Weight

**Cycles 섹션:**
- Hunger (분 단위), Strength (분 단위), Poop (분 단위)
- Sleep Schedule

**Status 섹션:**
- Age (days), Weight (g), Win Rate (%)
- Fullness (/5), Strength (/5), Energy (DP)

#### 변수 연결 상태
- **Props**: `currentDigimonData` (종족값), `currentStats` (상태값), `currentDigimonName`
- **데이터 소스**: 
  - `currentDigimonData`: `newDigimonDataVer1[selectedDigimon]` (종족 고정값)
  - `currentStats`: `digimonStats` (개체 상태값)
- **업데이트**: `digimonStats` 변경 시 자동 업데이트
- **문제점**: 
  - `hungerCycle`과 `hungerTimer` 혼용 (호환성 유지)
  - `maxEnergy`와 `maxStamina` 혼용 (호환성 유지)

#### 장점
✅ **구조화된 정보**: Profile, Specs, Cycles, Status로 카테고리화  
✅ **시각적 개선**: 카드 형식으로 가독성 향상  
✅ **종족값 + 상태값**: 디지몬 종족 고정값과 개체 상태값을 구분하여 표시  
✅ **단위 표시**: "days", "g", "%", "/5" 등 명확한 단위 표시  
✅ **Cycles 변환**: 초 단위를 분 단위로 변환하여 표시

#### 단점
❌ **변수명 혼용**: `hungerCycle`과 `hungerTimer` 혼용 (호환성 유지용)  
❌ **제한된 정보**: StatsPopup보다 적은 정보만 표시  
❌ **접근성**: 메뉴를 거쳐야 접근 가능 (2단계 클릭)

---

### 4. Game.jsx 직접 표시 (게임 화면 상단)

#### 표시되는 스탯
```javascript
- Time to Evolve: {formatTimeToEvolve(digimonStats.timeToEvolveSeconds)}
- Lifespan: {formatLifespan(digimonStats.lifespanSeconds)}
- Current Time: {customTime.toLocaleString()}
```

#### 변수 연결 상태
- **데이터 소스**: `digimonStats.timeToEvolveSeconds`, `digimonStats.lifespanSeconds`, `customTime`
- **업데이트**: `digimonStats` 변경 시 자동 업데이트
- **문제점**: 없음 (명확한 연결)

#### 장점
✅ **항상 보임**: 중요한 시간 정보를 항상 확인 가능  
✅ **간결함**: 핵심 시간 정보만 표시  
✅ **실시간 업데이트**: 자동으로 업데이트됨

#### 단점
❌ **제한된 정보**: 시간 정보만 표시  
❌ **스타일**: 기본 텍스트 형식

---

## 🔄 변수 연결 상태 비교

### 공통 변수 연결
| 변수명 | StatsPanel | StatsPopup | DigimonInfoModal | Game.jsx 직접 |
|--------|-----------|------------|------------------|---------------|
| `age` | ✅ | ✅ | ✅ | ❌ |
| `weight` | ✅ | ✅ | ✅ | ❌ |
| `strength` | ✅ | ✅ | ✅ | ❌ |
| `energy` | ✅ (stamina fallback) | ✅ (stamina fallback) | ✅ | ❌ |
| `winRate` | ✅ | ✅ | ✅ | ❌ |
| `effort` | ✅ | ✅ | ❌ | ❌ |
| `careMistakes` | ✅ | ✅ | ❌ | ❌ |
| `fullness` | ✅ (오버피드 표시) | ✅ (오버피드 표시) | ✅ | ❌ |
| `lifespanSeconds` | ❌ | ✅ | ❌ | ✅ |
| `timeToEvolveSeconds` | ❌ | ✅ | ❌ | ✅ |
| `sleepStatus` | ✅ (prop) | ❌ | ❌ | ❌ |
| `health` | ❌ (제거됨) | ⚠️ (레거시) | ❌ | ❌ |

### 종족값 (digimonData) 연결
| 변수명 | StatsPanel | StatsPopup | DigimonInfoModal |
|--------|-----------|------------|------------------|
| `basePower` | ❌ | ✅ | ✅ |
| `maxEnergy` | ❌ | ✅ | ✅ |
| `lifespan` | ❌ | ❌ | ✅ |
| `minWeight` | ❌ | ✅ | ✅ |
| `hungerCycle` | ❌ | ❌ | ✅ |
| `strengthCycle` | ❌ | ❌ | ✅ |
| `poopCycle` | ❌ | ❌ | ✅ |
| `sleepSchedule` | ❌ | ❌ | ✅ |
| `type` | ❌ | ❌ | ✅ |
| `stage` | ❌ | ✅ | ✅ |

---

## ⚠️ 발견된 문제점

### 1. 레거시 필드 표시
- **StatsPopup.jsx 120번째 줄**: `Health: {health || 0}` 표시
- **문제**: `health` 필드는 이미 제거되었고 `strength`로 통일됨
- **영향**: 사용자 혼란, 잘못된 정보 표시

### 2. 변수명 혼용
- **`energy` vs `stamina`**: 
  - StatsPanel: `stats.energy !== undefined ? stats.energy : (stats.stamina || 0)`
  - StatsPopup: `stats.energy !== undefined ? stats.energy : (stamina || 0)`
  - **문제**: 두 변수명이 혼용되어 혼란 가능
- **`hungerCycle` vs `hungerTimer`**:
  - DigimonInfoModal: `stats.hungerCycle || stats.hungerTimer || 0`
  - **문제**: 두 변수명이 혼용되어 혼란 가능

### 3. 정보 중복
- **StatsPanel**과 **DigimonInfoModal INFO View**에 중복된 정보:
  - Age, Weight, Strength, Energy, WinRate, Fullness
- **StatsPopup**과 **DigimonInfoModal INFO View**에 중복된 정보:
  - 대부분의 스탯

### 4. 접근성 문제
- **StatsPopup**: "status" 메뉴 아이콘 클릭 필요
- **DigimonInfoModal**: '?' 버튼 → Digimon Info 선택 (2단계)
- **문제**: 사용자가 어디서 정보를 확인해야 할지 혼란 가능

---

## 💡 개선 제안

### 1. StatsPopup에서 `health` 필드 제거
```javascript
// 제거해야 할 코드 (120번째 줄)
<li>Health: {health || 0}</li>

// 대신 strength로 통일
<li>Strength: {strength || 0}/5</li>
```

### 2. 변수명 통일
- **`energy`로 통일**: `stamina` fallback 제거, `energy`만 사용
- **`hungerCycle`로 통일**: `hungerTimer` fallback 제거, `hungerCycle`만 사용

### 3. 정보 구조화 개선
- **StatsPanel**: 핵심 정보만 유지 (현재 상태 유지)
- **StatsPopup**: 개발자 모드 전용으로 변경 또는 제거 고려
- **DigimonInfoModal INFO View**: 일반 사용자용 상세 정보로 활용

### 4. 접근성 개선
- **StatsPanel**: 항상 보이는 핵심 정보 (현재 상태 유지)
- **DigimonInfoModal**: '?' 버튼으로 접근하는 통합 정보 센터
- **StatsPopup**: 개발자 모드에서만 표시 또는 제거

---

## 📊 현재 사용 현황

### Game.jsx에서의 사용
```javascript
// StatsPanel (항상 표시)
<StatsPanel stats={digimonStats} sleepStatus={sleepStatus} />

// StatsPopup (status 메뉴 클릭 시)
{showStatsPopup && (
  <StatsPopup
    stats={digimonStats}
    onClose={()=> setShowStatsPopup(false)}
    devMode={developerMode}
    onChangeStats={(ns)=> setDigimonStatsAndSave(ns)}
  />
)}

// DigimonInfoModal (❓ 버튼 클릭 시)
{showDigimonInfo && (
  <DigimonInfoModal
    currentDigimonName={selectedDigimon}
    currentDigimonData={newDigimonDataVer1[selectedDigimon]}
    currentStats={digimonStats}
    digimonDataMap={newDigimonDataVer1}
    activityLogs={activityLogs}
    onClose={() => setShowDigimonInfo(false)}
  />
)}
```

---

## 🎯 권장 사항

### 즉시 수정 필요
1. **StatsPopup.jsx에서 `health` 필드 제거**
2. **변수명 통일**: `energy`로 통일, `stamina` fallback 제거

### 중기 개선
1. **StatsPopup 역할 재정의**: 개발자 모드 전용 또는 제거 고려
2. **DigimonInfoModal INFO View 강화**: 일반 사용자용 상세 정보로 활용
3. **정보 중복 최소화**: 각 컴포넌트의 역할 명확화

### 장기 개선
1. **통합 Status 시스템**: 하나의 통합된 Status UI로 재구성
2. **시각적 개선**: 차트, 프로그레스 바 등 시각적 요소 추가
3. **필터링 기능**: 사용자가 원하는 정보만 표시

---

**작성일**: 2025-12-23  
**버전**: 1.0





