# 리팩토링 및 아키텍처 변경 일지 (D2 Tamagotchi)

이 파일은 Cursor AI를 통해 수행된 주요 아키텍처 및 코드 변경 사항을 추적하기 위해 작성되었습니다.

---

## [2025-12-23] Fix: Log persistence & Timestamp, Feat: Manual-based Meat/Protein Logic (Overfeed cycle delay, 4-Protein bonus)

### 작업 유형
- 버그 수정
- 기능 구현
- 로직 정밀화
- 사용자 경험 향상

### 목적 및 영향
Activity Log의 안정성을 더욱 강화하고, 매뉴얼 기반의 Meat/Protein 로직을 정밀하게 구현하여 게임 메커니즘의 정확성을 높였습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/logic/food/meat.js`
  - `feedMeat()`: 오버피드 발생 시 `hungerCountdown`에 `hungerTimer * 60` (한 주기 시간)을 더해주는 로직 추가
  - 오버피드 효과: 배고픔 감소를 1회 지연시키는 메커니즘 구현
  - 반환값에 `isOverfeed` 플래그 추가
  
- `digimon-tamagotchi-frontend/src/logic/food/protein.js`
  - `feedProtein()`: 4회 보너스 로직은 이미 구현되어 있음 (확인 완료)
  
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - 모든 `setActivityLogs()` 호출을 함수형 업데이트 패턴 `(prevLogs) => ...`로 변경하여 이전 로그 보존 보장
  - `eatCycle()`: Meat 오버피드 효과 적용 및 로그 개선
  - `eatCycle()`: Protein 4회 보너스 로그 개선
  - `cleanCycle()`: 함수형 업데이트 패턴 적용
  - `handleToggleLights()`: 함수형 업데이트 패턴 적용
  
- `digimon-tamagotchi-frontend/src/data/defaultStatsFile.js`
  - `consecutiveMeatFed: 0` 필드 확인 (이미 존재, Firestore 저장됨)

### 주요 기능

#### 1. Activity Log 안정화 강화
- **문제**: `setActivityLogs` 직접 호출 시 이전 로그가 덮어씌워질 수 있는 위험
- **해결**: 
  - 모든 `setActivityLogs()` 호출을 함수형 업데이트 패턴으로 변경
  - `setActivityLogs((prevLogs) => addActivityLog(prevLogs, ...))` 형식으로 이전 로그 보존 보장
  - 진화 시에도 로그 배열 초기화하지 않고 계승

#### 2. Meat (고기) 로직 정밀 구현
- **기본 효과**: Weight +1g, Fullness +1 (max 제한 확인)
- **오버피드(Overfeed) 발동**:
  - `consecutiveMeatFed`가 10이 되는 순간:
    - `overfeeds` +1 증가
    - **효과**: `hungerCountdown`에 `hungerTimer * 60` (한 주기 시간)을 더해줘서 배고픔 감소를 1회 지연
    - `consecutiveMeatFed` = 0 (리셋)
    - 로그: "Overfeed! Hunger drop delayed (Wt +1g, HungerCycle +Xmin)"
- **저장**: `consecutiveMeatFed` 변수가 Firestore에 저장되어 새로고침에도 유지

#### 3. Protein (단백질) 로직 정밀 구현
- **기본 효과**: Weight +2g, Strength +1 (Max 제한 확인)
- **4회 보너스 로직**:
  - `proteinCount` +1 증가
  - `proteinCount % 4 === 0` 일 때마다:
    - `energy` +1 (Max 제한 확인)
    - `proteinOverdose` +1 (Max 7 제한)
    - 로그: "Feed: Protein (...) - Protein Bonus! (En +1, Overdose +1) => (...)"
- **일반 로그**: "Feed: Protein (Wt +2g, Str +1) => (...)"

#### 4. 배틀/스파링 기록 구분 (이미 완료)
- **Sparring**: 배틀 횟수/승률에 영향 없음. 로그에만 "Sparring Practice" 기록
- **Battle/Arena**: 승패에 따라 `battles`, `wins`, `losses` 증가 및 저장

### 사용자 경험 개선
- Activity Log가 더욱 안정적으로 유지되어 모든 활동 내역 추적 가능
- Meat 오버피드 효과가 정확하게 작동하여 게임 밸런스 향상
- Protein 4회 보너스 로직이 명확하게 표시되어 사용자 이해도 향상
- 모든 로그가 함수형 업데이트로 보존되어 데이터 손실 방지

### 관련 파일
- `digimon-tamagotchi-frontend/src/logic/food/meat.js`
- `digimon-tamagotchi-frontend/src/logic/food/protein.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/data/defaultStatsFile.js`

---

## [2025-12-23] Fix: Log persistence, Timestamp formatting, Age calculation, and Battle record logic

### 작업 유형
- 버그 수정
- 기능 개선
- 사용자 경험 향상

### 목적 및 영향
Activity Log의 안정성을 개선하고, 타임스탬프 포맷팅을 추가하며, 나이 계산 로직을 경과 시간 기반으로 수정하고, 배틀 기록 로직을 개선했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/utils/dateUtils.js` (신규)
  - `formatTimestamp()` 함수: 타임스탬프를 읽기 쉬운 형식으로 포맷팅 (MM/DD HH:mm)
  - `formatElapsedTime()` 함수: 경과 시간을 읽기 쉬운 형식으로 포맷팅
  
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - 모든 `addActivityLog()` 호출에서 `currentLogs` 사용하도록 수정 (이전 로그 보존)
  - `handleEvolution()`: 진화 시 `activityLogs` 계승하도록 수정
  - `handleBattleComplete()`: Sparring 모드는 배틀 횟수에 반영하지 않고 로그만 남기도록 수정
  - 모든 액션 핸들러에서 `activityLogs`를 최신 상태로 가져와서 로그 추가
  
- `digimon-tamagotchi-frontend/src/data/stats.js`
  - `applyLazyUpdate()`: 나이 계산 로직 추가 (경과 시간 기반: `(CurrentTime - birthTime) / (24 * 60 * 60 * 1000)`)
  - `initializeStats()`: `birthTime` 이어받기 로직 추가 (진화 시 유지)
  
- `digimon-tamagotchi-frontend/src/data/defaultStatsFile.js`
  - `birthTime: null` 필드 추가 (디지몬 생성 시간)
  
- `digimon-tamagotchi-frontend/src/components/DigimonInfoModal.jsx`
  - `formatTimestamp` import 추가
  - Activity Log 화면에서 타임스탬프 포맷팅 적용
  
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx`
  - `formatTimestamp` import 추가
  - 타임스탬프 표시에 포맷팅 적용

### 주요 기능

#### 1. Activity Log 안정화
- **문제**: 똥(Pooped) 이벤트 발생 시 이전 로그가 사라지거나, 진화 시 로그가 초기화되는 현상
- **해결**: 
  - 모든 `addActivityLog()` 호출에서 `currentLogs = updatedStats.activityLogs || activityLogs || []` 패턴 사용
  - 이전 로그 배열을 항상 보존하도록 수정
  - 진화 시 `activityLogs` 필드를 초기화하지 않고 계승
  - 훈련, 배틀의 모든 분기(성공/실패/중도취소)에서 로그가 반드시 남도록 확인

#### 2. 타임스탬프 포맷팅
- **기존**: `1766...` 같은 밀리초 타임스탬프 표시
- **개선**: 
  - `formatTimestamp()` 함수 생성 (MM/DD HH:mm 형식)
  - Activity Log 화면에서 포맷팅된 시간 표시
  - Stats UI에서도 타임스탬프 포맷팅 적용

#### 3. 배틀 기록 및 스파링 구분
- **Sparring(스파링)**: 
  - 배틀 횟수/승률에 반영하지 않음
  - 로그에만 "Sparring Practice (No record)"로 기록
- **Real Battle(아레나/통신)**: 
  - `battles`, `battlesWon`, `battlesLost` 스탯이 확실히 증가하고 저장되도록 로직 점검

#### 4. Age(나이) 증가 로직 수정
- **기존**: 단순 +1 증가
- **개선**: 
  - 경과 시간 기반 계산: `(CurrentTime - birthTime) / (24 * 60 * 60 * 1000)`
  - `applyLazyUpdate()` 함수 내에 나이 계산 로직 추가
  - 진화 시 `birthTime` 유지하여 나이 계속 증가

### 사용자 경험 개선
- Activity Log가 안정적으로 유지되어 모든 활동 내역 추적 가능
- 타임스탬프가 읽기 쉬운 형식으로 표시되어 시간 파악 용이
- 나이가 정확하게 계산되어 디지몬의 실제 나이를 확인 가능
- 배틀 기록이 정확하게 구분되어 기록됨

### 관련 파일
- `digimon-tamagotchi-frontend/src/utils/dateUtils.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `digimon-tamagotchi-frontend/src/data/defaultStatsFile.js`
- `digimon-tamagotchi-frontend/src/components/DigimonInfoModal.jsx`
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx`

---

## [2025-12-23] Fix: Training Log accuracy and Reskinned Heal Modal to Pixel UI

### 작업 유형
- 버그 수정
- UI 개선
- 사용자 경험 향상

### 목적 및 영향
훈련 로그가 제대로 기록되지 않는 문제를 해결하고, 치료(Heal) 팝업을 Pixel 스타일의 모달로 개선하여 사용자 경험을 향상시켰습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - `handleTrainResult()` 함수 수정: 훈련 결과가 확정된 바로 그 시점에 로그 생성
  - `activityLogs`를 최신 상태로 가져와서 로그 추가하도록 수정
  - `handleHeal()` 함수 수정: 모달을 열도록 변경 (alert 제거)
  - `executeHeal()` 함수 추가: 모달에서 실제 치료 실행
  - `healCycle()` 함수 수정: 모달 상태 업데이트를 위해 스탯 반영
  - `showHealModal` state 추가
  - HealModal 컴포넌트 import 및 렌더링 추가
  
- `digimon-tamagotchi-frontend/src/components/HealModal.jsx` (신규)
  - Pixel 스타일의 치료 모달 컴포넌트 생성
  - 상태에 따른 메시지 및 아이콘 표시
  - [ HEAL ] 버튼과 [ CLOSE ] 버튼 제공
  - 부상 상태, 치료 진행 상태, 완치 상태를 시각적으로 표시

### 주요 기능

#### 1. 훈련 로그 정합성 수정
- **문제**: 훈련 결과 로그가 제대로 기록되지 않음
- **해결**: 
  - 훈련 결과(`isSuccess`)가 확정된 바로 그 시점에 로그 생성
  - `activityLogs`를 최신 상태로 가져와서 로그 추가
  - 로그 포맷 엄격히 지키기:
    - 성공: `"Training: Success (Str +1, Wt -2g, En -1) => (Str 2→3, Wt 10→8g, En 5→4)"`
    - 실패: `"Training: Fail (Wt -2g, En -1) => (Wt 10→8g, En 5→4)"`
    - 에너지 부족: `"Training: Skipped (Not enough Energy)"`

#### 2. 치료(Heal) 팝업 UI 개선
- **기존**: 단순한 alert 형태
- **개선**: Pixel 스타일의 모달 컴포넌트
  - Title: "MEDICAL CARE"
  - Status Icon: 부상 상태에 따라 💀, 💚, ✅ 표시
  - Message:
    - 부상 상태: "Injured! Needs medicine."
    - 치료 진행 중: "Doses: [current] / [needed]"
    - 완치: "Fully Recovered!"
  - Buttons:
    - `[ HEAL ]`: 약 투여 버튼
    - `[ CLOSE ]`: 닫기 버튼

#### 3. Game.jsx 연결
- 'Bandage' 아이콘 클릭 시 `HealModal` 열기
- 모달 내부에서 'Heal' 버튼 클릭 시 `executeHeal()` 함수 실행
- 치료 결과에 따라 모달 내 메시지 자동 업데이트

### 사용자 경험 개선
- 훈련 로그가 정확하게 기록되어 활동 내역 추적 가능
- 치료 과정을 시각적으로 확인 가능
- Pixel 스타일로 게임 테마와 일관성 유지

### 관련 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/HealModal.jsx`

---

## [2025-12-23] Feature: Persisted Sprite Settings with Uniform Scale and Reset options

### 작업 유형
- 기능 구현
- UI 개선
- 사용자 경험 향상

### 목적 및 영향
스프라이트 크기 설정을 localStorage에 저장하여 사용자가 설정한 크기를 유지하고, Uniform Scale(비율 고정) 기능과 Reset Size 버튼을 추가하여 더 편리하게 스프라이트 크기를 조절할 수 있도록 개선했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - `loadSpriteSettings()` 함수 추가: localStorage에서 스프라이트 설정 로드
  - `saveSpriteSettings()` 함수 추가: 스프라이트 설정을 localStorage에 저장
  - `width`, `height` 초기값을 localStorage에서 로드하도록 수정
  - `useEffect`로 width/height 변경 시 자동 저장
  
- `digimon-tamagotchi-frontend/src/components/SettingsModal.jsx`
  - `uniformScale` state 추가: 비율 고정 체크박스 상태
  - `aspectRatio` state 추가: 현재 비율 저장
  - `handleUniformScaleToggle()` 함수 추가: 체크박스 토글 및 비율 기준점 설정
  - `handleLocalWidthChange()` 수정: Uniform Scale 활성화 시 height 자동 조정
  - `handleLocalHeightChange()` 수정: Uniform Scale 활성화 시 width 자동 조정
  - `handleResetSize()` 함수 추가: 기본값(300x200)으로 리셋
  - UI에 Uniform Scale 체크박스 추가
  - UI에 Reset Size 버튼 추가
  - Uniform Scale 슬라이더 제거 (체크박스 방식으로 변경)

### 주요 기능

#### 1. localStorage 저장/로드
- **키**: `digimon_view_settings`
- **저장 데이터**: `{ width: number, height: number }`
- 앱 시작 시 자동 로드, 변경 시 자동 저장

#### 2. Uniform Scale (비율 고정)
- 체크박스로 활성화/비활성화
- 활성화 시:
  - Width 변경 → Height가 현재 비율에 맞춰 자동 조정
  - Height 변경 → Width가 현재 비율에 맞춰 자동 조정
  - 체크박스 활성화 시점의 비율을 기준점으로 사용

#### 3. Reset Size 버튼
- 클릭 시 Width와 Height를 기본값(300x200)으로 리셋
- 즉시 적용 (Save 버튼 없이)

### 사용자 경험 개선
- 설정이 브라우저를 닫아도 유지됨
- 비율을 유지하면서 크기 조절 가능
- 한 번의 클릭으로 기본값으로 복원 가능

### 관련 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/SettingsModal.jsx`

---

## [2025-12-23] Feature: Implemented Call System with Independent Timers and Lazy Mistake Calculation

### 작업 유형
- 기능 구현
- 시스템 확장
- UI 개선

### 목적 및 영향
'Call(호출)' 시스템을 구현하여 디지몬이 배고픔, 힘 부족, 수면 필요 시 사용자에게 알림을 보내고, 일정 시간 내에 응답하지 않으면 자동으로 careMistakes가 증가하도록 했습니다. Independent State 방식으로 각 호출 상태를 독립적으로 관리합니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/data/defaultStatsFile.js`
  - `callStatus` 객체 추가 (hunger, strength, sleep 각각 isActive, startedAt 필드)
  
- `digimon-tamagotchi-frontend/src/data/stats.js`
  - 진화 시 `callStatus` 리셋 추가
  - `applyLazyUpdate`에 호출 상태 확인 및 careMistakes 계산 로직 추가
  - Hunger/Strength: 10분 타임아웃, 반복 실수 계산
  - Sleep: 60분 타임아웃, 1회 실수
  
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
  - `checkCalls()` 함수 추가 (호출 트리거 로직)
  - `resetCallStatus()` 함수 추가 (호출 해제)
  - `checkCallTimeouts()` 함수 추가 (실시간 타임아웃 체크)
  
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - `checkCalls`, `resetCallStatus`, `checkCallTimeouts` import 추가
  - Lazy Update 타이머에 호출 체크 로직 추가
  - `handleFeed`: fullness > 0 시 hunger 호출 리셋, protein 시 strength 호출 리셋
  - `handleTrainResult`: strength > 0 시 strength 호출 리셋
  - `handleToggleLights`: 불이 꺼지면 sleep 호출 리셋
  - Call Icon UI 추가 (우측 하단, 깜빡임 애니메이션)
  - Toast 메시지 UI 추가 (클릭 시 "Hungry!", "No Energy!", "Sleepy!" 표시)
  
- `digimon-tamagotchi-frontend/src/index.css`
  - `@keyframes blink` 애니메이션 추가 (Call Icon 깜빡임)

### 주요 기능

#### 1. 데이터 스키마 확장
- **callStatus 객체**:
  ```javascript
  callStatus: {
    hunger: { isActive: false, startedAt: null },   // 제한시간 10분
    strength: { isActive: false, startedAt: null }, // 제한시간 10분
    sleep: { isActive: false, startedAt: null }     // 제한시간 60분
  }
  ```

#### 2. 호출 트리거 로직
- **Hunger**: `fullness === 0`이고 `callStatus.hunger.isActive`가 false면 활성화
- **Strength**: `strength === 0`이고 `callStatus.strength.isActive`가 false면 활성화
- **Sleep**: 수면 시간이고 `isLightsOn === true`이고 `callStatus.sleep.isActive`가 false면 활성화

#### 3. Lazy Update 로직 (오프라인 처리)
- **Hunger/Strength (반복 실수)**:
  - 호출이 활성화되어 있고 `(CurrentTime - startedAt) > 10분`이면 `careMistakes +1`
  - 추가로 `(방치시간) / (TimerCycle + 10분)` 만큼 추가 실수 계산
- **Sleep (1회 실수)**:
  - 호출이 활성화되어 있고 `(CurrentTime - startedAt) > 60분`이면 `careMistakes +1`
  - 수면은 반복되지 않음

#### 4. 호출 해제 로직
- **밥 먹기(Feed)**: `fullness > 0`이 되는 순간 `callStatus.hunger` 리셋
- **단백질/훈련**: `strength > 0`이 되는 순간 `callStatus.strength` 리셋
- **불 끄기**: `isLightsOn`이 false가 되는 순간 `callStatus.sleep` 리셋
- **타임아웃**: 실시간으로 앱을 켜두고 있을 때도, 10분/60분이 지나면 자동으로 아이콘이 꺼지고 `careMistakes +1` 처리

#### 5. UI 구현
- **Call Icon (📣)**: 화면 우측 하단에 표시, 하나라도 `isActive`이면 점등 (CSS animation blink)
- **Toast 메시지**: 클릭 시 "Hungry!", "No Energy!", "Sleepy!" 중 원인을 텍스트로 표시 (2초 후 자동 사라짐)

### 기술적 세부 사항

#### 호출 트리거
```javascript
// Hunger 호출 트리거
if (updatedStats.fullness === 0 && !callStatus.hunger.isActive) {
  callStatus.hunger.isActive = true;
  callStatus.hunger.startedAt = now.getTime();
}
```

#### Lazy Update에서 호출 처리
```javascript
// Hunger 호출 타임아웃 체크
if (callStatus.hunger.isActive && callStatus.hunger.startedAt) {
  const elapsed = now.getTime() - startedAt;
  if (elapsed > HUNGER_CALL_TIMEOUT) {
    updatedStats.careMistakes = (updatedStats.careMistakes || 0) + 1;
    // 추가 실수 계산
    if (updatedStats.hungerTimer > 0) {
      const timerCycleMs = updatedStats.hungerTimer * 60 * 1000;
      const additionalMistakes = Math.floor(elapsed / (timerCycleMs + HUNGER_CALL_TIMEOUT));
      updatedStats.careMistakes += additionalMistakes;
    }
    callStatus.hunger.isActive = false;
    callStatus.hunger.startedAt = null;
  }
}
```

#### 호출 해제
```javascript
// 밥 먹기 후 호출 해제
if (updatedStats.fullness > 0) {
  updatedStats = resetCallStatus(updatedStats, 'hunger');
}
```

### 결과 / 성과
- **자동 Care Mistake 판정**: 사용자가 오프라인 상태에서도 호출을 무시하면 자동으로 careMistakes 증가
- **Independent State**: 각 호출 상태를 독립적으로 관리하여 정확한 타임아웃 계산
- **시각적 피드백**: Call Icon과 Toast 메시지로 사용자에게 명확한 알림 제공
- **반복 실수 계산**: Hunger/Strength는 타이머 주기를 고려하여 반복 실수를 정확히 계산

### 관련 파일
- `digimon-tamagotchi-frontend/src/data/defaultStatsFile.js`
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/index.css`

---

## [2025-12-23] 치료(Heal), 부상(Injury), 사망(Death), 단백질 과다(Overdose) 시스템 전면 구현

### 작업 유형
- 기능 구현
- 시스템 확장
- UI 개선

### 목적 및 영향
치료, 부상, 사망, 단백질 과다 시스템을 전면 구현하여 게임의 깊이와 전략성을 향상시켰습니다. 부상 발생 조건, 치료 시스템, 사망 조건을 명확히 정의하고 UI로 시각화했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/data/defaultStatsFile.js`
  - `proteinCount: 0` 추가 (먹인 단백질 누적 개수)
  - `injuredAt: null` 추가 (부상 당한 시각)
  - `injuries: 0` 추가 (누적 부상 횟수)
  - `healedDosesCurrent: 0` 추가 (현재 투여된 치료제 횟수)
  
- `digimon-tamagotchi-frontend/src/data/stats.js`
  - 진화 시 `proteinCount`, `injuries`, `isInjured`, `injuredAt`, `healedDosesCurrent` 리셋 추가
  - 똥 8개 부상 발생 시 `injuries +1`, `injuredAt` 기록, `healedDosesCurrent` 리셋
  - 부상 과다 사망 체크: `injuries >= 15`
  - 부상 방치 사망 체크: `isInjured` 상태이고 6시간(21600000ms) 경과
  
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - `showHealAnimation`, `healStep` 상태 추가
  - `handleHeal()` 함수 구현 (치료 액션)
  - `healCycle()` 함수 구현 (치료 연출)
  - `handleMenuClick`에 "heal" 케이스 추가
  - 배틀 부상 발생 시 `injuries +1`, `healedDosesCurrent` 리셋
  - 사망 체크 로직에 부상 과다/방치 조건 추가
  - 해골 아이콘 UI 추가 (부상 상태 표시)
  - 치료 연출 UI 추가 (주사기, 알약, 반짝임)
  
- `digimon-tamagotchi-frontend/src/index.css`
  - `@keyframes float` 애니메이션 추가 (해골 아이콘)
  - `@keyframes fadeInOut` 애니메이션 추가 (치료 연출)

### 주요 기능

#### 1. 데이터 스키마 확장
- **부상 관련 필드**:
  - `isInjured` (Bool): 현재 부상 여부
  - `injuredAt` (Timestamp): 부상 당한 시각 (6시간 사망 체크용)
  - `injuries` (Number): 이 단계에서 누적된 부상 횟수 (15회 사망 체크용)
  - `healedDosesCurrent` (Number): 현재 투여된 치료제 횟수
  
- **단백질 과다 필드**:
  - `proteinCount` (Number): 먹인 단백질 누적 개수
  - `proteinOverdose` (Number): 단백질 과다 수치 (4개당 +1, 최대 7)

#### 2. 단백질 과다 로직
- 단백질을 먹일 때마다 `proteinCount +1`
- `proteinCount % 4 === 0`이 될 때마다 `proteinOverdose +1` 증가 (최대 7)
- 진화 시 `proteinCount`, `proteinOverdose` 리셋

#### 3. 부상 발생 로직
- **Case A: 배틀 (`handleBattleComplete`)**:
  - 승리 시: 20% 확률로 부상
  - 패배 시: `10 + (proteinOverdose * 10)`% 확률로 부상 (최대 80%)
  - 부상 발생 시: `isInjured = true`, `injuredAt = Date.now()`, `injuries +1`, `healedDosesCurrent = 0`
  
- **Case B: 똥 (`applyLazyUpdate`)**:
  - 똥(`poopCount`)이 8개가 되면 즉시 `isInjured = true`
  - 처음 부상 발생 시에만 `injuries +1`, `injuredAt` 기록, `healedDosesCurrent = 0`

#### 4. 사망(Death) 체크 로직
- 기존 사망 로직에 다음 조건 추가:
  1. **부상 과다**: `injuries >= 15` 이면 사망 (`isDead = true`)
  2. **부상 방치**: `isInjured` 상태이고, `Date.now() - injuredAt >= 6시간(21600000ms)` 이면 사망

#### 5. 치료(Heal) 액션 구현
- 'Bandage' 아이콘 클릭 시 실행
- `isInjured`가 false면 "Not injured!" 알림
- `isInjured`가 true면:
  - `healedDosesCurrent +1`
  - 현재 디지몬의 필요 치료 횟수(`digimonData.stats.healDoses`)와 비교
  - **충족 시**: `isInjured = false`, `injuredAt = null`, `healedDosesCurrent = 0`, "Fully Healed!" 알림
  - **미충족 시**: "Need more medicine... (현재/필요)" 알림 (아직 부상 상태 유지)
- 수면 중 치료 시도 시 수면 방해 처리

#### 6. UI 구현
- **해골 아이콘**: `isInjured`가 true일 때 디지몬 옆에 '💀' 아이콘이 둥둥 떠있게 표시 (좌측 상단)
- **치료 연출**: 치료 버튼 클릭 시 주사기(💉), 알약(💊), 반짝임(✨) 이모지가 잠깐 나타났다 사라지는 연출

### 기술적 세부 사항

#### 부상 발생 시 처리
```javascript
if (isInjured) {
  finalStats.isInjured = true;
  finalStats.injuredAt = Date.now();
  finalStats.injuries = (battleStats.injuries || 0) + 1;
  finalStats.healedDosesCurrent = 0; // 치료제 횟수 리셋
}
```

#### 사망 체크 로직
```javascript
// 부상 과다 사망 체크: injuries >= 15
if ((updatedStats.injuries || 0) >= 15 && !updatedStats.isDead) {
  updatedStats.isDead = true;
}

// 부상 방치 사망 체크: isInjured 상태이고 6시간 경과
if (updatedStats.isInjured && updatedStats.injuredAt && !updatedStats.isDead) {
  const elapsedSinceInjury = now.getTime() - injuredTime;
  if (elapsedSinceInjury >= 21600000) { // 6시간 = 21600000ms
    updatedStats.isDead = true;
  }
}
```

#### 치료 로직
```javascript
const requiredDoses = currentDigimonData.stats?.healDoses || 1;
const newHealedDoses = (currentStats.healedDosesCurrent || 0) + 1;

if (newHealedDoses >= requiredDoses) {
  // 완전 회복
  updatedStats.isInjured = false;
  updatedStats.injuredAt = null;
  updatedStats.healedDosesCurrent = 0;
}
```

### 결과 / 성과
- **시스템 완성도 향상**: 부상, 치료, 사망 시스템이 완전히 구현됨
- **게임 깊이 증가**: 전략적 요소 추가 (치료 타이밍, 부상 관리)
- **시각적 피드백**: 해골 아이콘과 치료 연출로 상태를 명확히 표시
- **Ver.1 스펙 준수**: 매뉴얼 기반 로직 구현

### 관련 파일
- `digimon-tamagotchi-frontend/src/data/defaultStatsFile.js`
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/index.css`
- `digimon-tamagotchi-frontend/src/logic/food/protein.js`
- `digimon-tamagotchi-frontend/src/logic/battle/calculator.js`

---

## [2025-12-23] 배틀 부상 확률 로직 구현, 오버피드 저장, 변수명 통일 (Ver.1 완벽 구현)

### 작업 유형
- 기능 구현
- 버그 수정
- 변수명 통일

### 목적 및 영향
배틀 부상 확률 로직을 Ver.1 스펙에 맞게 구현하고, 오버피드 연속성을 보장하며, 변수명을 통일하여 코드 일관성을 향상시켰습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - 배틀 부상 확률 로직 구현: 승리 시 20%, 패배 시 10% + (프로틴 과다 * 10%) 확률
  - `calculateInjuryChance` 함수 import 및 사용
  - 부상 발생 시 Activity Log에 "Injured during battle!" 기록
  - `feedMeat` import 경로 수정 (`logic/food/meat.js`)
  
- `digimon-tamagotchi-frontend/src/data/train_digitalmonstercolor25th_ver1.js`
  - `trainingCount` 제거, `trainings`로 통일
  - `effort` 증가 로직을 `trainings` 기준으로 수정 (4회마다)
  
- `digimon-tamagotchi-frontend/src/data/stats.js`
  - `trainingCount` → `trainings`로 변경
  - `consecutiveMeatFed` 초기화 추가 (진화 시 리셋)
  
- `digimon-tamagotchi-frontend/src/data/defaultStatsFile.js`
  - `consecutiveMeatFed: 0` 필드 추가
  
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
  - `trainingCount` fallback 제거, `trainings`만 사용
  
- `digimon-tamagotchi-frontend/src/logic/evolution/checker.js`
  - `trainingCount` fallback 제거, `trainings`만 사용
  
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx`
  - `trainingCount` → `trainings`로 변경
  
- `digimon-tamagotchi-frontend/src/components/TrainPopup.jsx`
  - `trainingCount` → `trainings`로 변경

### 주요 기능

#### 1. 배틀 부상 확률 로직
- **승리 시**: 20% 확률로 부상 발생
- **패배 시**: `10 + (proteinOverdose * 10)`% 확률로 부상 발생 (최대 80%)
- 부상 발생 시 `isInjured = true`, `injuredAt = Date.now()` 설정
- Activity Log에 "Injured during battle!" 기록

#### 2. 오버피드 연속성 보장
- `consecutiveMeatFed` 필드를 `defaultStatsFile.js`에 추가
- Firestore에 `consecutiveMeatFed` 저장 (새로고침 해도 연속 카운트 유지)
- 진화 시 `consecutiveMeatFed` 리셋

#### 3. 변수명 통일
- 프로젝트 전체에서 `trainingCount` → `trainings`로 통일
- `effort` 증가 로직을 `trainings` 기준으로 수정 (4회마다)

### 기술적 세부 사항

#### 배틀 부상 확률 계산
```javascript
const proteinOverdose = battleStats.proteinOverdose || 0;
const injuryChance = calculateInjuryChance(battleResult.win, proteinOverdose);
const isInjured = Math.random() * 100 < injuryChance;
```

#### 오버피드 연속성
- `consecutiveMeatFed`는 `digimonStats`에 포함되어 Firestore에 자동 저장됨
- `setDigimonStatsAndSave()`를 통해 모든 스탯과 함께 저장

### 결과 / 성과
- **Ver.1 스펙 완벽 구현**: 배틀 부상 확률 로직이 매뉴얼과 일치
- **오버피드 연속성 보장**: 새로고침 해도 연속 카운트 유지
- **변수명 통일**: `trainings`로 통일하여 코드 일관성 향상
- **코드 품질 향상**: 불필요한 fallback 제거

### 관련 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/data/train_digitalmonstercolor25th_ver1.js`
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `digimon-tamagotchi-frontend/src/data/defaultStatsFile.js`
- `digimon-tamagotchi-frontend/src/logic/battle/hitrate.js`
- `digimon-tamagotchi-frontend/src/logic/food/meat.js`

---

## [2025-12-23] StatsPanel/Popup UI 개편 및 변수명 통일, Ver.1 상세 스펙 뷰 구현

### 작업 유형
- UI 개선
- 변수명 통일
- 기능 추가

### 목적 및 영향
StatsPanel과 StatsPopup의 UI를 개편하고, 변수명을 통일하여 코드 일관성을 향상시켰습니다. 또한 StatsPopup에 Ver.1 스펙 뷰를 추가하여 사용자가 종족 고정 파라미터와 개체 상태값을 명확히 구분하여 확인할 수 있게 되었습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/components/StatsPanel.jsx`
  - 헤더 추가: `<h2>StatsPanel</h2>` (컨테이너 최상단, 중앙 정렬)
  - `energy` 통일: `stamina` fallback 제거, `energy`만 사용
  
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx`
  - `health` 필드 완전 제거 (표시 및 개발자 모드 수정 기능)
  - `energy` 통일: `stamina` fallback 제거, `energy`만 사용
  - `hungerTimer` 통일: `hungerCycle` 대신 `hungerTimer` 사용
  - 탭 UI 구현: `[ Old ]` | `[ New ]` 탭 추가
  - Old 탭: 기존 팝업 내용 유지 (health 제거)
  - New 탭: Ver.1 스펙 뷰 구현
    - Sec 1: 종(Species) 고정 파라미터
    - Sec 2: 개체(Instance) 상태값
    - Sec 3: 행동 델타 규칙 (Action Delta)
    - Sec 4: 진화 판정 카운터
    - Sec 5: 내부/고급 카운터
  - `digimonData` prop 추가: 종족 고정 파라미터 표시용
  
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - StatsPopup에 `digimonData` prop 전달 추가
  - 모달 래퍼 div 제거 (StatsPopup 내부에서 처리)
  
- `docs/game_mechanics.md`
  - Ver.1 오리지널 스펙 상세 섹션 추가
  - 종(Species) 고정 파라미터 테이블 추가
  - 개체(Instance) 상태값, 행동 델타 규칙, 진화 판정 카운터, 배틀/컨디션 내부 로직 설명 추가

### 주요 기능

#### 1. StatsPanel UI 개선
- 헤더 추가로 컴포넌트 식별 용이
- `energy` 변수명 통일로 일관성 향상

#### 2. StatsPopup 탭 구조
- **Old 탭**: 기존 스타일 유지 (레거시 호환)
- **New 탭**: Ver.1 스펙 기반 구조화된 뷰
  - 5개 섹션으로 정보 분류
  - 종족값과 상태값 구분
  - 타이머 남은 시간 표시

#### 3. 변수명 통일
- `health` → 완전 제거 (이미 `strength`로 통일됨)
- `stamina` → `energy`로 통일 (fallback 제거)
- `hungerCycle` → `hungerTimer`로 통일 (adapter에서 변환)

#### 4. Ver.1 스펙 뷰 (New 탭)
- **Sec 1**: Sleep Time, Max DP, Min Weight, Stomach Capacity, Lifespan
- **Sec 2**: Age, Weight, Hunger, Strength, Energy, Win Ratio, Flags
- **Sec 3**: Action Delta 규칙 (고정 텍스트)
- **Sec 4**: Care Mistakes, Training Count, Overfeeds, Sleep Disturbances, Total Battles
- **Sec 5**: Timers (남은 시간 포함), PoopCount, Lifespan, Time to Evolve

### 기술적 세부 사항

#### 타이머 남은 시간 계산
```javascript
const formatCountdown = (countdown) => {
  if (!countdown || countdown <= 0) return '0s';
  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  return `${minutes}m ${seconds}s`;
};
```

#### 종족 고정 파라미터 추출
```javascript
const speciesData = digimonData?.stats || {};
const speciesHungerTimer = speciesData.hungerCycle || hungerTimer || 0;
const stomachCapacity = 5 + (speciesData.maxOverfeed || maxOverfeed || 0);
```

### 결과 / 성과
- **변수명 통일**: `health`, `stamina`, `hungerCycle` 혼용 문제 해결
- **UI 개선**: 탭 구조로 정보 접근성 향상
- **Ver.1 스펙 준수**: 종족값과 상태값을 명확히 구분하여 표시
- **가독성 향상**: 섹션별로 정보를 구조화하여 이해하기 쉬움

### 관련 파일
- `digimon-tamagotchi-frontend/src/components/StatsPanel.jsx`
- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `docs/game_mechanics.md`

---

## [2025-12-23] DigimonInfoModal 메뉴 선택형 구조 구현 및 Activity Logs 시스템

### 작업 유형
- UI 개선
- 기능 추가
- 데이터 구조 확장

### 목적 및 영향
'?' 버튼 모달을 메뉴 선택형 구조로 개편하여 사용자가 Digimon Info, Evolution Guide, Activity Logs를 쉽게 탐색할 수 있도록 개선했습니다. 또한 Activity Logs 시스템을 구현하여 주요 액션(Feed, Train, Battle, Clean, CareMistake)을 기록하고 표시할 수 있게 되었습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/components/DigimonInfoModal.jsx` (신규)
  - EvolutionGuideModal.jsx를 기반으로 메뉴 선택형 구조로 재구성
  - MENU, INFO, EVOLUTION, LOGS 4개 뷰 구현
  - 헤더 UI: MENU일 때는 타이틀만, 그 외에는 "← Back" 버튼과 타이틀 표시
  
- `digimon-tamagotchi-frontend/src/components/EvolutionGuideModal.jsx` (Deprecated)
  - DigimonInfoModal.jsx로 대체됨 (EVOLUTION 뷰에 통합)
  
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
  - `initializeActivityLogs()` 함수 추가: 로그 배열 초기화
  - `addActivityLog()` 함수 추가: 로그 추가 (최대 100개 유지)
  
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - `showEvolutionGuide` → `showDigimonInfo`로 변경
  - `activityLogs` state 추가 및 Firestore에서 로드/저장
  - 각 액션마다 Activity Log 추가:
    - Feed: "Fed Meat" / "Fed Protein"
    - Train: "Training Success (X/5 hits)" / "Training Failed (X/5 hits)"
    - Battle: "Battle Won" / "Battle Lost" / "Battle Won - Area Cleared!"
    - Clean: "Cleaned Poop"
    - CareMistake: "Care Mistake: Tired for too long"
  - `setDigimonStatsAndSave()` 함수에 `updatedLogs` 파라미터 추가

### 주요 기능

#### 1. 메뉴 선택형 구조
- **MENU View**: 3개의 큰 버튼 (Digimon Info, Evolution Guide, Activity Logs)
- **INFO View**: 현재 디지몬의 상세 스펙 표시
  - Profile: 이름, 스테이지, 속성, 스프라이트
  - Specs: Base Power, Max DP, Lifespan, Min Weight
  - Cycles: Hunger, Strength, Poop 주기 (분 단위)
  - Status: Age, Weight, Win Rate, Fullness, Strength, Energy
- **EVOLUTION View**: 기존 진화 가이드 UI (진화 트리 및 조건 달성 확인)
- **LOGS View**: 활동 로그 리스트 (최신순, "MM/DD HH:mm - [Action] 내용" 형식)

#### 2. Activity Logs 시스템
- **데이터 구조**: Firestore 슬롯의 `activityLogs` 배열
- **로그 포맷**: `{ type: 'FEED', text: 'Fed Meat', timestamp: Date.now() }`
- **로그 타입**: 'FEED', 'TRAIN', 'BATTLE', 'CLEAN', 'CAREMISTAKE'
- **최대 개수**: 100개 (오래된 것부터 삭제)
- **자동 저장**: 각 액션 시 Firestore에 자동 저장

#### 3. 헤더 UI
- MENU일 때: "Digimon Menu" 타이틀만 표시
- 그 외: "← Back" 버튼 + 해당 뷰 타이틀 표시

### 기술적 세부 사항

#### Activity Logs 초기화
```javascript
const logs = initializeActivityLogs(slotData.activityLogs);
setActivityLogs(logs);
```

#### Activity Log 추가
```javascript
const updatedLogs = addActivityLog(activityLogs, 'FEED', 'Fed Meat');
setDigimonStatsAndSave(updatedStats, updatedLogs);
```

#### Cycles 표시
- `hungerCycle`, `strengthCycle`, `poopCycle`을 초 단위에서 분 단위로 변환
- 예: `3600초` → `60m`

### 결과 / 성과
- **사용자 경험 향상**: 메뉴 선택형 구조로 정보 접근성 개선
- **활동 추적**: 주요 액션을 자동으로 기록하여 육성 이력 확인 가능
- **코드 구조 개선**: EvolutionGuideModal을 DigimonInfoModal로 통합하여 유지보수성 향상

### 관련 파일
- `digimon-tamagotchi-frontend/src/components/DigimonInfoModal.jsx`
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`

---

## [2025-12-22] 게임 로직 Ver.1 오리지널 스펙 전면 리팩토링

### 작업 유형
- 게임 로직 개선
- 데이터 구조 통일
- Ver.1 스펙 준수

### 목적 및 영향
게임 로직을 Ver.1 오리지널 스펙에 맞춰 전면 리팩토링하여 일관성 있는 게임플레이를 제공하고, 데이터 구조를 통일하여 유지보수성을 향상시켰습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/data/defaultStatsFile.js`
  - `health` 필드 제거 (strength로 통일)
  - `isInjured` 필드 추가 (부상 상태 플래그)
  
- `digimon-tamagotchi-frontend/src/data/stats.js`
  - `health` → `strength`로 통일 (힘 감소 처리)
  - `lastStrengthZeroAt` 기록 로직 추가 (힘이 0이 되면 기록)
  - 힘이 0이고 12시간 경과 시 사망 로직 추가
  - 똥 8개 시 `careMistakes++` 대신 `isInjured: true` 설정
  
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - `health` → `strength`로 통일
  - 수면 중 먹이/훈련/배틀 시도 시 수면 방해 처리 추가
  - 배틀 완료 시 Weight -4g, Energy -1 소모 로직 추가
  
- `digimon-tamagotchi-frontend/src/components/StatsPanel.jsx`
  - `Health` 표시 제거 (UI는 Fullness와 Strength 2개만 표시)
  
- `digimon-tamagotchi-frontend/src/logic/food/meat.js`
  - `hunger` → `fullness`로 통일
  - 오버피드 로직 개선 (연속 고기 10개 추적)
  
- `digimon-tamagotchi-frontend/src/logic/food/protein.js`
  - `willRefuseProtein` 수정 (health 체크 제거)
  - Energy 회복 로직 개선
  
- `digimon-tamagotchi-frontend/src/data/train_digitalmonstercolor25th_ver1.js`
  - Ver.1 스펙 적용: 5번 중 3번 이상 성공 시 Strength +1
  - Weight -2g, Energy -1 소모 (결과와 상관없이)
  - 훈련 횟수(trainings)는 성공/실패 무관하게 +1

### 주요 기능

#### 1. 데이터 구조 및 명칭 통일
- **Strength 통일**: `health` 변수를 모두 삭제하고 `strength`로 통일
- **UI 하트 표시**: Fullness와 Strength 2개만 표시
- **DP/Energy**: 변수명 및 UI 'DP/Energy'로 통일
- **부상(Injury) 로직**: 똥 8개 시 `careMistakes` 대신 `isInjured: true` 설정

#### 2. 액션별 수치 변화 (Ver.1 스펙)
- **Food (Meat)**: Weight +1g, Fullness +1
- **Protein**: Weight +2g, Strength +1, Energy 회복 (4개당 +1)
- **Train**: 
  - Weight -2g, Energy -1 (결과와 상관없이)
  - 5번 중 3번 이상 성공 시 Strength +1
  - 훈련 횟수(trainings)는 성공/실패 무관하게 +1
- **Battle**: Weight -4g, Energy -1 (승패 무관)

#### 3. 수면 방해 (Sleep Disturbance)
- 수면 중(`isSleeping`)에 밥, 훈련, 배틀 시도 시:
  - `sleepDisturbances` +1
  - `wakeUntil`을 현재시간 + 10분으로 설정하여 잠시 깨움

### 기술적 세부 사항

#### 힘(Strength) 감소 로직
- `strengthTimer` 주기마다 `strength` -1
- `strength`가 0이 되면 `lastStrengthZeroAt` 기록
- `strength`가 0이고 12시간(43200초) 경과 시 사망

#### 부상(Injury) 로직
- 똥 8개가 되면 `isInjured: true` 설정
- 똥 청소 시 `isInjured: false`로 리셋
- 기존의 `careMistakes++` 로직 제거

#### 훈련 성공 판정
- 5번 중 3번 이상 성공 시 훈련 성공 (Strength +1)
- 3번 미만 성공 시 훈련 실패 (Strength 안 오름)
- 결과와 상관없이 Weight -2g, Energy -1 소모

### 결과 / 성과
- **데이터 구조 통일**: `health` → `strength`로 완전 통일
- **Ver.1 스펙 준수**: 모든 액션의 수치 변화가 Ver.1 스펙에 맞춰짐
- **수면 방해 로직 개선**: 수면 중 액션 시도 시 명확한 피드백 제공
- **부상 시스템 개선**: 똥 8개 시 `isInjured` 플래그로 명확한 상태 관리

### 관련 파일
- `digimon-tamagotchi-frontend/src/data/defaultStatsFile.js`
- `digimon-tamagotchi-frontend/src/data/stats.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/StatsPanel.jsx`
- `digimon-tamagotchi-frontend/src/logic/food/meat.js`
- `digimon-tamagotchi-frontend/src/logic/food/protein.js`
- `digimon-tamagotchi-frontend/src/data/train_digitalmonstercolor25th_ver1.js`

---

## [2025-12-22] Game 화면 우측 상단 UI 통일 (설정 버튼 + 구글 로그인 프로필)

### 작업 유형
- UI 개선
- 사용자 경험 향상
- 레이아웃 통일

### 목적 및 영향
Game 화면과 Select 화면의 UI를 통일하여 일관된 사용자 경험을 제공하고, 우측 상단에 설정 버튼과 프로필 정보를 함께 배치하여 접근성을 개선했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - `logout` 함수를 `useAuth`에서 가져오도록 수정
  - `handleLogout` 함수 추가: 로그아웃 처리 및 로그인 페이지로 리디렉션
  - 우측 상단에 `fixed` 위치의 UI 컨테이너 추가 (`top-4 right-4 z-50`)
  - Settings 버튼을 우측 상단으로 이동 (기존 위치에서 제거)
  - SelectScreen과 동일한 프로필 UI 추가:
    - 프로필 이미지 (photoURL)
    - 사용자 이름 (displayName 또는 email)
    - 로그아웃 버튼
  - localStorage 모드일 때 표시되는 텍스트 추가
  - 프로필 UI 스타일: `bg-white bg-opacity-90`로 반투명 배경 적용

### 주요 기능
- **UI 통일**: Select 화면과 Game 화면의 프로필 UI 스타일 및 레이아웃 통일
- **접근성 개선**: Settings 버튼과 프로필 정보를 화면 우측 상단에 고정 배치
- **반응형 디자인**: 프로필 이미지 크기 (w-8 h-8)와 버튼 스타일을 Select 화면과 동일하게 맞춤

### 기술적 세부 사항
- **레이아웃**: `flex items-center gap-2`로 가로 정렬
- **위치**: `fixed top-4 right-4 z-50`로 게임 화면 위에 고정
- **스타일 통일**: 
  - 프로필 이미지: `w-8 h-8 rounded-full`
  - 프로필 텍스트: `text-sm text-gray-600`
  - 로그아웃 버튼: `px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm`
  - Settings 버튼: `px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded`

### 결과 / 성과
- **UI 일관성**: Select 화면과 Game 화면의 프로필 UI가 동일한 스타일로 통일됨
- **사용자 경험 향상**: 설정과 프로필 정보에 쉽게 접근 가능
- **코드 재사용성**: SelectScreen의 프로필 UI 로직을 Game 화면에 재사용

### 관련 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
- `docs/REFACTORING_LOG.md`

---

## [2025-12-22] 사망 팝업 무한 루프 수정 및 수동 확인 버튼 추가

### 작업 유형
- 버그 수정
- UI 개선
- 상태 관리 개선

### 목적 및 영향
사망 팝업이 무한 루프로 반복 표시되는 문제를 해결하고, 사용자가 원할 때 사망 정보를 다시 확인할 수 있는 수동 버튼을 추가하여 사용자 경험을 개선했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - `isDeathModalOpen` state 추가: 사망 모달의 표시 여부를 제어
  - `hasSeenDeathPopup` state 추가: 사망 팝업이 자동으로 한 번 떴는지 체크하는 플래그
  - 사망 팝업 자동 실행 로직 수정: `isDead && !hasSeenDeathPopup` 조건으로 한 번만 자동 표시
  - '💀 Death Info' 버튼 추가: 사망 시에만 표시되며, 클릭 시 사망 모달을 다시 열 수 있음
  - `DeathPopup` 컴포넌트에 `isOpen`, `onClose` props 전달
  - 리셋 시 `hasSeenDeathPopup` 플래그도 초기화
- `digimon-tamagotchi-frontend/src/components/DeathPopup.jsx`
  - `isOpen` prop 추가: 모달 표시 여부 제어
  - `onClose` prop 추가: 모달 닫기 핸들러
  - `isOpen`이 false일 때 null 반환하여 렌더링 최적화
  - 확인 버튼 클릭 시 `onConfirm`과 `onClose` 모두 호출

### 주요 기능
- **무한 루프 방지**: `hasSeenDeathPopup` 플래그로 사망 팝업이 한 번만 자동으로 표시되도록 제어
- **수동 확인 버튼**: 사망 상태일 때 '💀 Death Info' 버튼이 표시되어 사용자가 원할 때 사망 정보를 다시 확인 가능
- **상태 관리 개선**: `isDeathModalOpen` state로 모달 표시 여부를 명확히 제어

### 기술적 세부 사항
- **상태 관리**:
  ```javascript
  const [isDeathModalOpen, setIsDeathModalOpen] = useState(false);
  const [hasSeenDeathPopup, setHasSeenDeathPopup] = useState(false);
  ```
- **자동 팝업 조건**: `if(!prevStats.isDead && updatedStats.isDead && !hasSeenDeathPopup)`
- **수동 버튼 표시 조건**: `{digimonStats.isDead && <button>💀 Death Info</button>}`
- **리셋 시 초기화**: 리셋 함수에서 `setHasSeenDeathPopup(false)` 호출

### 결과 / 성과
- **버그 수정**: 사망 팝업 무한 루프 문제 해결
- **사용자 경험 개선**: 사망 정보를 원할 때 다시 확인할 수 있는 기능 추가
- **코드 품질 향상**: 상태 관리 로직이 더 명확하고 예측 가능하게 개선

### 관련 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/DeathPopup.jsx`
- `docs/REFACTORING_LOG.md`

---

## [2025-12-17] 진화 시스템 리팩토링 (Data-Driven 통합)

### 작업 유형
- 아키텍처 개편
- 데이터 구조 통합
- 코드 리팩토링

### 목적 및 영향
파편화된 진화 로직(evolution.js, _ver1.js)을 digimons.js의 구조화된 JSON 데이터로 통합하여 유지보수성을 향상시키고, 코드 수정 없이 데이터 추가만으로 새로운 진화 루트를 생성할 수 있도록 개선했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/data/v1/digimons.js`
  - 진화 조건을 새로운 스키마로 변환
  - `conditions`: 단일 조건 그룹 (AND Logic)
  - `conditionGroups`: 다중 조건 그룹 (OR Logic) - Numemon 같은 복합 진화 조건 지원
- `digimon-tamagotchi-frontend/src/logic/evolution/checker.js`
  - 함수 실행 방식에서 데이터 해석기(Interpreter) 패턴으로 변경
  - `checkConditions()` 헬퍼 함수 추가: conditions 객체를 해석하여 스탯과 비교
  - OR 로직 처리: conditionGroups 배열을 순회하며 하나라도 통과하면 success 반환
- `digimon-tamagotchi-frontend/src/components/EvolutionGuideModal.jsx`
  - 단일 데이터 소스(digimons.js)만 참조하도록 단순화
  - 다중 진화 루트 표시: conditionGroups가 있는 경우 "진화 방법 1", "진화 방법 2" 형식으로 표시
  - `convertConditionsToRequirements()` 함수 추가: conditions 객체를 requirements 형식으로 변환
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - `checkEvolution()` 호출 시 evolutionConditionsVer1 파라미터 제거
  - 개발자 모드에서도 digimons.js의 evolutions 배열 사용
  - 진화 가능 여부 체크 로직을 Data-Driven 방식으로 변경
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
  - `checkEvolutionAvailability()`에 battles, winRatio 지원 추가
- `digimon-tamagotchi-frontend/src/data/v1/evolution.js`
  - Deprecated 표시 추가 (레거시 호환성 유지)
- `digimon-tamagotchi-frontend/src/data/evolution_digitalmonstercolor25th_ver1.js`
  - Deprecated 표시 추가 (레거시 호환성 유지)

### 주요 기능
- **데이터 구조 통합**: 모든 진화 조건을 digimons.js 하나로 통합
- **다중 조건 지원**: Numemon처럼 여러 진화 루트를 conditionGroups로 표현
- **데이터 해석기 패턴**: 함수 실행 대신 데이터를 해석하여 판정
- **UI 연동**: 진화 가이드 모달이 통합된 데이터를 참조하여 다중 진화 루트를 명확히 표시

### 기술적 세부 사항
- **새로운 스키마**:
  ```javascript
  // Case 1: 단일 조건 (AND Logic)
  {
    targetId: "Greymon",
    conditions: {
      careMistakes: { max: 3 },
      trainings: { min: 32 }
    }
  }
  
  // Case 2: 다중 조건 (OR Logic)
  {
    targetId: "Numemon",
    conditionGroups: [
      { careMistakes: { min: 4 }, trainings: { max: 4 } },
      { careMistakes: { min: 4 }, overfeeds: { max: 2 } },
      // ... 더 많은 루트
    ]
  }
  ```
- **조건 비교 로직**:
  - `min`: `stats.val >= min`
  - `max`: `stats.val <= max`
  - 둘 다 있으면: `min <= stats.val <= max`
- **OR 로직 처리**: conditionGroups 배열을 순회하며 하나라도 통과하면 success 반환

### 결과 / 성과
- **유지보수성 향상**: 진화 밸런스 패치 시 digimons.js 파일 하나만 수정하면 로직과 UI(도감)가 동시에 반영됨
- **확장성 확보**: 코드 수정 없이 데이터 추가만으로 새로운 진화 루트 생성 가능
- **코드 단순화**: 복잡한 함수 파싱 로직 제거, 명확한 데이터 구조로 가독성 향상

### 관련 파일
- `digimon-tamagotchi-frontend/src/data/v1/digimons.js`
- `digimon-tamagotchi-frontend/src/logic/evolution/checker.js`
- `digimon-tamagotchi-frontend/src/components/EvolutionGuideModal.jsx`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/data/v1/evolution.js` (Deprecated)
- `digimon-tamagotchi-frontend/src/data/evolution_digitalmonstercolor25th_ver1.js` (Deprecated)

---

## [2025-12-21] 진화 시스템 고도화: 조건 로직 검증, 애니메이션 연출, 그리고 진화 가이드 UI 구현

### 작업 유형
- 기능 추가
- UI/UX 개선
- 애니메이션 구현

### 목적 및 영향
진화 시스템을 고도화하여 사용자가 진화 조건을 명확히 파악하고, 진화 시 시각적 피드백을 받을 수 있도록 개선했습니다. 진화 가이드 모달을 통해 모든 진화 루트와 달성 현황을 한눈에 확인할 수 있으며, 진화 애니메이션으로 더욱 몰입감 있는 경험을 제공합니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
  - `checkEvolutionAvailability(currentStats, requirements)` 함수 추가
  - 진화 조건을 체크하고 부족한 조건을 반환하는 유틸 함수
- `digimon-tamagotchi-frontend/src/components/EvolutionGuideModal.jsx` (신규)
  - 진화 가이드 모달 컴포넌트 생성
  - 현재 디지몬에서 진화 가능한 모든 루트를 카드 리스트로 표시
  - 각 진화 루트별 달성 현황을 프로그레스 텍스트로 표시
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - 진화 애니메이션 상태 추가 (`isEvolving`, `evolutionStage`)
  - 진화 애니메이션 시퀀스 구현 (Shaking → Flashing → Complete)
  - 진화 버튼 옆에 '❓' 버튼 추가 (진화 가이드 모달 열기)
  - `EvolutionGuideModal` 컴포넌트 통합
- `digimon-tamagotchi-frontend/src/index.css`
  - 진화 애니메이션 CSS 추가 (`@keyframes shake`, `@keyframes flash`)
  - 픽셀 아트/레트로 스타일 클래스 추가 (`.pixel-art-modal`, `.pixel-art-text`, `.pixel-art-button`, `.pixel-art-card`)

### 주요 기능
- **진화 조건 체크**: `checkEvolutionAvailability` 함수로 조건 만족 여부와 부족한 조건 확인
- **진화 가이드 모달**: 모든 진화 루트와 달성 현황을 한눈에 확인
- **진화 애니메이션**: 3단계 애니메이션 (Shaking → Flashing → Complete)
- **픽셀 아트 스타일**: 레트로 게임 느낌의 UI 스타일 적용

### 기술적 세부 사항
- 진화 애니메이션은 `setTimeout`을 사용하여 순차적으로 실행
- Canvas에 인라인 스타일로 애니메이션 적용 (`animation`, `filter` 속성)
- 진화 가이드 모달은 `evolutionConditionsVer1`와 `digimons.js`의 `evolutions` 배열을 매칭하여 표시
- 조건 체크는 기존 `evolutions` 배열의 `condition` 객체를 `requirements` 형식으로 변환하여 처리

### 관련 파일
- `digimon-tamagotchi-frontend/src/hooks/useGameLogic.js`
- `digimon-tamagotchi-frontend/src/components/EvolutionGuideModal.jsx`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/index.css`

---

## [2025-12-17] UI Upgrade: Expanded Leaderboard filters to support All-Time, Current Season, and browsable Past Season archives.

### 작업 유형
- UI/UX 개선
- 기능 확장

### 목적 및 영향
- 리더보드 필터를 All-Time, Current Season, Past Season(아카이브)까지 확장해 시즌별 기록 탐색성을 높였습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`

### 관련 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`

---

## [2025-12-17] Game 화면 UI 정리 (Select/Reset)

### 작업 유형
- UI/UX 개선
- 유지보수

### 목적 및 영향
- Select 화면 이동 버튼을 루트 상단으로 올려 슬롯 선택 화면으로 더 빠르게 이동할 수 있게 했습니다.
- Reset Digimon 버튼을 제거해 우발적인 초기화를 방지하고 UI를 단순화했습니다.
- Select 버튼 영역 배경을 메인 화면과 동일하게 적용해 상단 여백의 색상 불일치를 해소했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - Select 화면 이동 버튼을 루트 직하로 이동하여 DOM 순서를 반영
  - Reset Digimon 버튼 제거

### 관련 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`

---

## [2025-12-17] Arena 리더보드(시즌/전체) 추가

### 작업 유형
- 기능 추가
- 데이터 연동
- UI/UX 개선

### 목적 및 영향
Arena 모드에 All-Time 및 시즌별 리더보드를 추가하여 경쟁 요소를 강화했습니다. 시즌 ID를 도입해 시즌 전적과 누적 전적을 모두 관리하며, 상위 랭커를 한눈에 확인할 수 있습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - `CURRENT_SEASON_ID` 상수 추가
  - Arena 배틀 결과 저장 시 시즌 전적(`seasonWins`, `seasonLosses`, `seasonId`)을 함께 업데이트
- `digimon-tamagotchi-frontend/src/components/ArenaScreen.jsx`
  - Leaderboard 탭 추가 (All-Time / Season 토글)
  - Firestore에서 승수/시즌 승수 기준 상위 랭킹 조회 (최대 20개)
  - 순위/테이머명/디지몬명/승수/승률 표시, 1~3위 강조
  - 인덱스 오류 발생 시 콘솔 안내 추가

---

## [2025-12-17] Arena Admin Panel & Season Archive

### 작업 유형
- 기능 추가
- 관리 도구
- 데이터 관리

### 목적 및 영향
Dev 모드에서 접근 가능한 Admin Panel을 추가해 시즌 설정(이름/기간/ID)을 수정하고, 시즌 종료 시 아카이브 저장 및 시즌 전적 리셋을 지원합니다. 아카이브 관리(삭제) 기능으로 지난 시즌 기록을 정리할 수 있습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - Dev 전용 Admin 진입 버튼 추가 (`IS_DEV_MODE`)
  - `currentSeasonId/seasonName/seasonDuration` 상태 관리 및 ArenaScreen/AdminModal에 전달
  - Arena 배틀 결과 업데이트 시 시즌 전적 필드(seasonWins/seasonLosses/seasonId) 사용
- `digimon-tamagotchi-frontend/src/components/ArenaScreen.jsx`
  - 시즌 기간(seasonDuration) UI 표시 (Leaderboard 탭 상단)
  - Leaderboard 시즌 조회 시 동적 시즌 ID 사용
- `digimon-tamagotchi-frontend/src/components/AdminModal.jsx` (신규)
  - 시즌 설정 수정 (Season ID/Name/Duration)
  - End Season & Archive: 시즌 Top 50을 `season_archives`에 저장, 시즌 ID 증가, 시즌 전적 리셋
  - 아카이브 조회/삭제 기능

### 주요 기능
- Dev 모드 Admin 버튼 → AdminModal 열기
- 시즌 설정 업데이트 (game_settings/arena_config)
- 시즌 종료 시 Top 50 스냅샷을 season_archives에 저장 후 시즌 ID +1
- 시즌 전적(seasonWins/Losses) 리셋 및 seasonId 갱신
- 아카이브 목록 조회 및 삭제

### 관련 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/ArenaScreen.jsx`
- `digimon-tamagotchi-frontend/src/components/AdminModal.jsx`

---

## [2025-12-17] Arena Leaderboard 필터 확장 (Current/All/Past)

### 작업 유형
- UI/UX 개선
- 데이터 조회 확장

### 목적 및 영향
리더보드 필터를 Current Season, All-Time, Past Seasons 3가지로 확장해 시즌별/누적/과거 아카이브별 랭킹을 손쉽게 조회할 수 있게 했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/components/ArenaScreen.jsx`
  - 리더보드 필터 3-way(현재/전체/과거) 버튼 추가
  - Past 선택 시 season_archives에서 드롭다운 제공, 선택된 아카이브의 entries 배열을 그대로 표시
  - Current/All은 기존 arena_entries 쿼리 유지(정렬만 조정)

### 주요 개선 사항
- Current: 현재 시즌 seasonWins 기준 정렬
- All-Time: 누적 wins 기준 정렬
- Past: season_archives 문서 entries를 직접 표시, 아카이브 없으면 안내 표시

### 관련 파일
- `digimon-tamagotchi-frontend/src/components/ArenaScreen.jsx`

---

## [2025-12-17] Sleep & Lights 시스템 (Time-based)

### 작업 유형
- 기능 추가
- 게임 로직
- UI/UX 개선

### 목적 및 영향
수면 스케줄 기반으로 조명 관리, 수면 방해, 케어 미스(30분 방치) 로직을 추가하여 보다 현실적인 수면 시스템을 구현했습니다. 인터랙션 시 10분 깨우기와 Dark Overlay, 수면 스프라이트 적용으로 UX를 개선했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/data/digimondata_digitalmonstercolor25th_ver1.js`
  - 수면 스케줄 기본값(stage별 start/end) 자동 주입
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - 상태: `isLightsOn`, `wakeUntil`, `dailySleepMistake`, `isSleeping`
  - 수면 판단(스케줄 + wakeUntil), 조명 케어 미스 30분 처리, 하루 1회 제한
  - 수면 중 인터랙션 시 10분 깨우기 + `sleepDisturbances` 증가
  - Lights 토글 버튼, Dark Overlay, 수면 시 sleep 애니메이션 적용

### 주요 개선 사항
- 스케줄 기반 수면/기상 판단, wakeUntil로 일시 깨움
- 조명 ON 상태로 30분 방치 시 careMistakes +1 (일 1회)
- 수면 방해 시 10분 깨우기 및 sleepDisturbances 카운트
- 수면 시 Sleep 애니메이션, Lights Off 시 화면 어둡게 오버레이

### 관련 파일
- `digimon-tamagotchi-frontend/src/data/digimondata_digitalmonstercolor25th_ver1.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`

### 주요 개선 사항
- 시즌/누적 전적을 분리 관리하여 시즌제 경쟁 지원
- 상위 랭커 리스트로 Arena 참여 동기 부여
- 인덱스 오류 시 안내 메시지로 디버깅 편의성 제공

### 관련 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/ArenaScreen.jsx`

---

## [2025-12-16] 스파링 모드 리소스 동기화 및 UI 버그 수정

### 작업 유형
- 버그 수정
- UI/UX 개선
- 데이터 동기화

### 목적 및 영향
Sparring 모드에서 Ghost 디지몬의 스프라이트와 데이터가 제대로 표시되지 않던 문제를 수정하고, 배틀 로그에 실제 디지몬 이름을 표시하도록 개선했습니다. 또한 Sparring 모드의 승리 화면에서 불필요한 "Next Battle" 버튼을 제거하고, 슬롯 선택 목록에서 파워가 0으로 표시되던 버그를 수정했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx` (수정)
  - **Ghost 디지몬 스프라이트 및 데이터 동기화**
    - Sparring 모드일 때 `enemy` 객체에 `sprite`, `attackSprite`, `digimonId` 필드 추가
    - 적 디지몬 이미지 렌더링 시 Sparring 모드일 때 `enemyData.sprite` 우선 사용
    - 공격 발사체 스프라이트도 `enemyData.attackSprite` 우선 사용
    - 적 이름을 `Ghost ${enemyDigimonData.name}` 형식으로 변경
  - **배틀 종료 화면 로직 수정**
    - Sparring 모드일 때 승리 화면에서 "Next Battle" 버튼 제거
    - "Practice Match Completed!" 메시지 표시
    - "Return to Menu" 버튼만 표시

- `digimon-tamagotchi-frontend/src/logic/battle/calculator.js` (수정)
  - **배틀 로그 명칭 구체화**
    - `simulateBattle` 함수에 `userName`, `enemyName` 파라미터 추가
    - 로그 메시지에서 "유저", "CPU" 대신 실제 디지몬 이름 사용
    - `comparison` 필드에도 실제 디지몬 이름 반영
    - 예: "라운드 1: Agumon 공격 성공!" / "Hit Rate(Agumon) 71.67 > Roll(Agumon) 26.32 => HIT!! 💀"

- `digimon-tamagotchi-frontend/src/logic/battle/questEngine.js` (수정)
  - **Quest 모드에서도 디지몬 이름 전달**
    - `playQuestRound`에서 `simulateBattle` 호출 시 디지몬 이름 전달

- `digimon-tamagotchi-frontend/src/components/SparringModal.jsx` (수정)
  - **슬롯 선택 목록 파워 표시 버그 수정**
    - `calculatePower` 함수 import 추가
    - `digimonDataVer1` import 추가
    - 파워 계산 로직 개선:
      - `slot.digimonStats?.power` 우선 사용
      - 없으면 `calculatePower(slot.digimonStats, digimonData)` 사용
      - 없으면 `digimonData.stats.basePower` 사용
    - 실제 파워 값이 정확하게 표시되도록 수정

### 주요 개선 사항

#### 1. Ghost 디지몬 데이터 동기화
- Sparring 모드에서 선택된 슬롯의 디지몬 스프라이트가 정확히 표시됨
- 공격 스프라이트도 올바르게 적용됨
- 적 이름이 "Ghost [디지몬 이름]" 형식으로 표시됨

#### 2. 배틀 로그 가독성 향상
- 실제 디지몬 이름이 로그에 표시되어 어떤 디지몬끼리 싸우는지 명확히 파악 가능
- Quest 모드와 Sparring 모드 모두에 적용

#### 3. Sparring 모드 UI 개선
- 연속 전투가 아닌 Sparring 모드의 특성에 맞게 "Next Battle" 버튼 제거
- "Practice Match Completed!" 메시지로 연습전임을 명확히 표시

#### 4. 파워 표시 버그 수정
- 슬롯 선택 목록에서 실제 파워 값이 정확하게 표시됨
- `calculatePower` 함수를 사용하여 Strength Hearts 보너스 등이 반영된 실제 파워 표시

### 사용 흐름
1. Sparring 모드에서 슬롯 선택 → 실제 파워 값 확인 가능
2. 배틀 시작 → Ghost 디지몬의 올바른 스프라이트 표시
3. 배틀 로그 → 실제 디지몬 이름으로 표시 (예: "Agumon 공격 성공!")
4. 승리 시 → "Practice Match Completed!" 메시지와 "Return to Menu" 버튼만 표시

### 관련 파일
- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx`
- `digimon-tamagotchi-frontend/src/components/SparringModal.jsx`
- `digimon-tamagotchi-frontend/src/logic/battle/calculator.js`
- `digimon-tamagotchi-frontend/src/logic/battle/questEngine.js`

---

## [2025-12-15] 배틀 메뉴 계층화 및 스파링(Self-PvP) 모드 추가

### 작업 유형
- 기능 추가
- UI/UX 개선
- 배틀 시스템 확장

### 목적 및 영향
배틀 메뉴를 계층화하여 Quest Mode와 Communication 모드를 분리하고, Communication 하위에 Sparring (Self PvP) 모드를 추가했습니다. 사용자는 자신의 다른 슬롯과 대전할 수 있으며, 스파링 모드는 배틀 기록에 영향을 주지 않습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/components/BattleSelectionModal.jsx` (수정)
  - **Communication 버튼 활성화**
    - `onCommunicationStart` prop 추가
    - Communication 버튼 클릭 시 하위 메뉴로 이동

- `digimon-tamagotchi-frontend/src/components/CommunicationModal.jsx` (신규 생성)
  - **Communication 하위 메뉴 모달**
    - Sparring (Self PvP): 활성화, 클릭 시 SparringModal로 이동
    - Arena (Ghost): 비활성화 (Coming Soon)
    - Live Duel: 비활성화 (Coming Soon)

- `digimon-tamagotchi-frontend/src/components/SparringModal.jsx` (신규 생성)
  - **Sparring 슬롯 선택 모달**
    - 현재 슬롯을 제외한 모든 슬롯 리스트 표시
    - Firebase/LocalStorage 모드 지원
    - 슬롯 정보: 슬롯 이름, 디지몬 이름, Power 표시
    - 슬롯 선택 시 `onSelectSlot` 콜백 호출

- `digimon-tamagotchi-frontend/src/pages/Game.jsx` (수정)
  - **배틀 타입 및 상태 관리**
    - `battleType` 상태 추가 ('quest' | 'sparring')
    - `sparringEnemySlot` 상태 추가 (스파링 상대 슬롯 정보)
    - `showCommunicationModal`, `showSparringModal` 상태 추가
  - **핸들러 추가**
    - `handleCommunicationStart`: Communication 모달 표시
    - `handleSparringStart`: Sparring 모달 표시
    - `handleSparringSlotSelect`: 스파링 슬롯 선택 처리
  - **배틀 완료 처리 수정**
    - `battleType === 'sparring'`일 때 배틀 기록(battles, wins, losses) 업데이트하지 않음
    - "Practice Match Completed" 메시지 표시
  - **BattleScreen props 전달**
    - `userSlotName`: 유저 슬롯 이름 전달
    - `battleType`: 배틀 타입 전달
    - `sparringEnemySlot`: 스파링 상대 슬롯 정보 전달

- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx` (수정)
  - **Sparring 모드 지원**
    - `battleType`, `sparringEnemySlot`, `userSlotName` props 추가
    - Sparring 모드일 때 `simulateBattle` 직접 호출
    - 적 디지몬 이름에 "(Ghost)" 접두사 추가
    - 적 슬롯 이름을 배지에 표시
  - **UI 개선**
    - 유저 배지: 슬롯 이름 표시 (예: "슬롯1 - 아구몬")
    - CPU 배지: Sparring 모드일 때 상대 슬롯 이름 표시
    - 라운드 정보: Sparring 모드일 때 "Sparring" 표시

### 주요 개선 사항

#### 1. 배틀 메뉴 계층화
- **1단계**: Battle Mode Selection (Quest Mode / Communication)
- **2단계**: Communication 하위 메뉴 (Sparring / Arena / Live Duel)
- **3단계**: Sparring 슬롯 선택

#### 2. Sparring (Self PvP) 모드
- 자신의 다른 슬롯과 대전 가능
- 배틀 기록에 영향 없음 (연습전)
- 슬롯 정보 표시로 어떤 슬롯끼리 대전하는지 명확히 표시

#### 3. UI 개선
- 슬롯 번호와 이름을 배지에 표시
- Sparring 모드와 Quest 모드 구분
- 적 디지몬 이름에 "(Ghost)" 접두사 추가

### 사용 흐름
1. Battle 버튼 클릭 → Battle Mode Selection 모달
2. Communication 선택 → Communication 모달
3. Sparring (Self PvP) 선택 → Sparring 슬롯 선택 모달
4. 상대 슬롯 선택 → 배틀 시작
5. 배틀 완료 → "Practice Match Completed" 메시지 (기록 없음)

### 관련 파일
- `digimon-tamagotchi-frontend/src/components/BattleSelectionModal.jsx`
- `digimon-tamagotchi-frontend/src/components/CommunicationModal.jsx`
- `digimon-tamagotchi-frontend/src/components/SparringModal.jsx`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx`

---

## [2025-12-15] 배틀 공격 시 전진(Lunge) 애니메이션 추가

### 작업 유형
- UI/UX 개선
- 배틀 애니메이션 강화

### 목적 및 영향
배틀 화면에서 공격하는 디지몬이 앞으로 튀어나가는(Lunge) 애니메이션을 추가하여 공격의 타격감과 시각적 피드백을 강화했습니다. 유저와 CPU 디지몬 모두 공격 시 전진 모션을 보여줍니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/styles/Battle.css` (수정)
  - **공격 전진 애니메이션 추가**
    - `@keyframes attack-lunge-user`: 유저 디지몬이 오른쪽으로 30px 전진 후 원위치로 복귀
    - `@keyframes attack-lunge-cpu`: CPU 디지몬이 왼쪽으로 30px 전진 후 원위치로 복귀
    - `.animate-attack-user`: 유저 공격 애니메이션 클래스 (0.4초, ease-out)
    - `.animate-attack-cpu`: CPU 공격 애니메이션 클래스 (0.4초, ease-out)

- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx` (수정)
  - **디지몬 이미지 ref 추가**
    - `userDigimonImgRef`: 유저 디지몬 이미지 참조
    - `enemyDigimonImgRef`: 적 디지몬 이미지 참조
  - **조건부 애니메이션 클래스 적용**
    - 유저 디지몬 이미지: `projectile?.type === "user"`일 때 `animate-attack-user` 클래스 추가
    - 적 디지몬 이미지: `projectile?.type === "enemy"`일 때 `animate-attack-cpu` 클래스 추가
    - 발사체가 생성되는 시점에 자동으로 애니메이션 트리거

### 주요 개선 사항

#### 1. 공격 전진 애니메이션
- **유저 공격**: 오른쪽으로 30px 전진 (적 방향)
- **CPU 공격**: 왼쪽으로 30px 전진 (유저 방향)
- 애니메이션 시간: 0.4초 (발사체 비행 시간 0.8초와 조화)
- Ease-out 타이밍으로 자연스러운 움직임

#### 2. 시각적 피드백 강화
- 발사체가 날아가는 동안 공격자가 전진하여 공격의 연속성 강조
- 공격의 타격감과 몰입도 향상

#### 3. 자동 트리거
- 발사체(`projectile`) 상태가 설정되면 자동으로 애니메이션 시작
- 별도의 상태 관리 없이 기존 발사체 로직과 통합

### 사용 흐름
1. 배틀 로그 재생 중 공격 턴 감지
2. 발사체 생성 (`setProjectile({ type: "user" | "enemy" })`)
3. 해당 디지몬 이미지에 전진 애니메이션 클래스 자동 적용
4. 0.4초 동안 전진 애니메이션 재생
5. 발사체가 목표에 도달한 후 타격/회피 처리

### 관련 파일
- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx`
- `digimon-tamagotchi-frontend/src/styles/Battle.css`

---

## [2025-12-14] 사망 원인 표시 기능 구현

### 작업 유형
- UI/UX 개선
- 게임 피드백 강화

### 목적 및 영향
디지몬이 사망했을 때 사망 원인을 명확하게 표시하여 사용자가 왜 사망했는지 파악할 수 있도록 했습니다. 굶주림, 부상 과다, 수명 종료 등 다양한 사망 원인을 구분하여 표시합니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx` (수정)
  - **사망 원인 상태 추가**
    - `const [deathReason, setDeathReason] = useState(null);` 상태 추가
  - **사망 원인 설정 로직 추가**
    - 타이머에서 사망 체크 시 원인 설정:
      - 굶주림: `fullness === 0`이고 12시간 경과 시 `setDeathReason('STARVATION (굶주림)')`
      - 부상 과다: `health === 0`이고 12시간 경과 시 `setDeathReason('INJURY (부상 과다)')`
      - 수명 종료: `lifespanSeconds >= maxLifespan` 시 `setDeathReason('OLD AGE (수명 다함)')`
    - Lazy Update에서 사망 감지 시에도 동일한 원인 설정 로직 적용
  - **DeathPopup 컴포넌트 통합**
    - 기존 인라인 사망 확인 UI를 `DeathPopup` 컴포넌트로 교체
    - `reason={deathReason}` prop 전달
    - `handleDeathConfirm`에서 사망 원인 초기화 (`setDeathReason(null)`)
  - **DeathPopup import 추가**
    - `import DeathPopup from "../components/DeathPopup";` 추가

- `digimon-tamagotchi-frontend/src/components/DeathPopup.jsx` (신규 생성)
  - **사망 팝업 컴포넌트 구현**
    - 모달 형태의 사망 확인 팝업
    - "YOUR DIGIMON HAS DIED" 제목 표시
    - `reason` prop이 있을 경우 "Cause: {reason}" 표시
    - 사망 확인 버튼 제공

### 주요 개선 사항

#### 1. 사망 원인 분류
- **STARVATION (굶주림)**: 배고픔이 0이고 12시간 경과
- **INJURY (부상 과다)**: 힘이 0이고 12시간 경과
- **OLD AGE (수명 다함)**: 수명이 최대치에 도달

#### 2. UI 개선
- 기존: 단순한 인라인 사망 확인 메시지
- 개선: 모달 형태의 전용 DeathPopup 컴포넌트
- 사망 원인을 명확하게 표시하여 사용자 피드백 강화

#### 3. 사망 원인 감지 로직
- 타이머 기반 실시간 감지
- Lazy Update 기반 감지 (게임 재진입 시)
- 두 경로 모두 동일한 원인 설정 로직 적용

### 사용 흐름
1. 디지몬이 사망 조건에 도달
2. 사망 원인 자동 감지 및 설정
3. DeathPopup 모달 표시 (사망 원인 포함)
4. 사용자가 "사망 확인" 버튼 클릭
5. 사망 원인 초기화 및 다음 단계 진행

### 관련 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/DeathPopup.jsx`

---

## [2025-12-14] 퀘스트 선택 화면 Unlock 정보 표시(클리어 전 ??? 처리)

### 작업 유형
- UI/UX 개선
- 정보 블라인드 처리

### 목적 및 영향
퀘스트 선택 화면에서 각 Area의 Unlock 조건을 표시하되, 클리어 전에는 "???"로 블라인드 처리하여 스포일러를 방지하고 게임의 재미를 높였습니다. 클리어 후에는 실제 Unlock 조건을 표시하여 사용자가 다음 목표를 파악할 수 있도록 했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/components/QuestSelectionModal.jsx` (수정)
  - **Unlock 정보 표시 추가**
    - 상태 배지(CLEARED / Challenge!) 바로 아래에 Unlock 정보 표시
    - `unlockCondition` 필드가 있을 때만 렌더링
    - 조건부 렌더링:
      - 클리어 전 (!isCleared): `Unlock: ???` (회색, 흐릿하게, opacity-50)
      - 클리어 후 (isCleared): `Unlock: [unlockCondition 값]` (예: "Unlock: The Grid")
    - 스타일링:
      - 텍스트 크기: `text-xs`
      - 색상: 클리어 전 `text-gray-400 opacity-50`, 클리어 후 `text-gray-600`
      - 배지와의 간격: `mt-1`
      - 우측 정렬: `text-right`

### 주요 개선 사항

#### 1. Unlock 정보 표시
- 기존: Unlock 정보가 Area 이름 아래에 일반 텍스트로 표시
- 개선: 상태 배지 아래에 조건부로 표시
- 클리어 전/후에 따라 다른 스타일 적용

#### 2. 블라인드 처리
- 클리어 전: "Unlock: ???"로 표시하여 스포일러 방지
- 클리어 후: 실제 Unlock 조건 표시하여 다음 목표 파악 가능

#### 3. 시각적 피드백
- 클리어 전: 흐릿한 회색 텍스트로 "알 수 없음" 느낌 강조
- 클리어 후: 명확한 회색 텍스트로 정보 제공

### 사용 흐름
1. 퀘스트 선택 화면 진입
2. 클리어하지 않은 Area: "Unlock: ???" 표시 (흐릿하게)
3. 클리어한 Area: "Unlock: [조건]" 표시 (명확하게)
4. 다음 목표 파악 가능

### 관련 파일
- `digimon-tamagotchi-frontend/src/components/QuestSelectionModal.jsx`

---

## [2025-12-14] 배틀 로그 용어(CPU) 통일 및 퀘스트 정보 블라인드(???) 처리

### 작업 유형
- UI/UX 개선
- 용어 통일
- 정보 보안(스포일러 방지)

### 목적 및 영향
배틀 로그에서 "Enemy" 또는 "적"으로 표시되던 용어를 "CPU"로 통일하여 일관성을 높였습니다. 또한 퀘스트 선택 화면에서 아직 클리어하지 않은 퀘스트의 적 정보를 "???"로 블라인드 처리하여 스포일러를 방지하고 게임의 재미를 높였습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/logic/battle/calculator.js` (수정)
  - **배틀 로그 용어 변경**
    - `Hit Rate(Enemy)` → `Hit Rate(CPU)`
    - `Roll(Enemy)` → `Roll(CPU)`
    - `라운드 ${rounds}: 적 공격 성공!` → `라운드 ${rounds}: CPU 공격 성공!`
    - `라운드 ${rounds}: 적 공격 실패` → `라운드 ${rounds}: CPU 공격 실패`

- `digimon-tamagotchi-frontend/src/components/QuestSelectionModal.jsx` (수정)
  - **미공개 퀘스트 정보 블라인드 처리**
    - `isCleared` 변수 추가: `index < clearedQuestIndex`
    - 클리어 전 (!isCleared):
      - 적 디지몬 스프라이트 대신 물음표 아이콘(❓) 표시
      - Boss 이름을 "???"로 표시
      - Area 이름은 그대로 유지 (단계는 알 수 있게)
    - 클리어 후 (isCleared):
      - 적 디지몬 스프라이트와 이름 정상 표시
    - `digimonDataVer1` import 추가하여 스프라이트 조회

- `digimon-tamagotchi-frontend/src/components/QuestSelectionModal.css` (새로 생성)
  - **미공개 상태 스타일**
    - `.unknown-quest-icon`: 물음표 아이콘 스타일
      - 회색톤 (#9ca3af)
      - 흐릿한 효과 (opacity 0.5, blur 1px)
      - 호버 시 약간 선명해짐

### 주요 개선 사항

#### 1. 배틀 로그 용어 통일
- 기존: "Enemy", "적" 혼용
- 개선: "CPU"로 통일
- 일관성 있는 사용자 경험 제공

#### 2. 퀘스트 정보 블라인드 처리
- 클리어 전: 적 정보 숨김 (스포일러 방지)
- 클리어 후: 적 정보 공개 (재플레이 시 참고)
- 게임의 재미와 긴장감 유지

#### 3. 시각적 피드백
- 물음표 아이콘으로 미공개 상태 명확히 표시
- 흐릿한 효과로 "알 수 없음" 느낌 강조

### 사용 흐름
1. 퀘스트 선택 화면 진입
2. 클리어하지 않은 Area: "???" 및 물음표 아이콘 표시
3. 클리어한 Area: 적 디지몬 스프라이트와 이름 표시
4. 배틀 로그: 모든 "Enemy"/"적" 용어가 "CPU"로 표시

### 관련 파일
- `digimon-tamagotchi-frontend/src/logic/battle/calculator.js`
- `digimon-tamagotchi-frontend/src/components/QuestSelectionModal.jsx`
- `digimon-tamagotchi-frontend/src/components/QuestSelectionModal.css`

---

## [2025-12-14] Meramon 스프라이트 수정 및 퀘스트 스테이지 선택(해금) 시스템 구현

### 작업 유형
- 데이터 수정
- 게임 상태 관리
- UI/UX 개선
- 진행 시스템 구현

### 목적 및 영향
퀘스트 모드에 스테이지 선택 및 해금 시스템을 추가하여 사용자가 순차적으로 Area를 클리어하며 다음 스테이지를 해금할 수 있도록 개선했습니다. 또한 Meramon의 공격 스프라이트를 추가하여 배틀 연출을 개선했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/data/v1/digimons.js` (수정)
  - **Meramon 스프라이트 수정**
    - ID 10번 Meramon의 `stats.attackSprite`를 `17`로 설정
    - 기존: `attackSprite: null`
    - 변경: `attackSprite: 17`

- `digimon-tamagotchi-frontend/src/pages/Game.jsx` (수정)
  - **게임 상태 관리**
    - `clearedQuestIndex` 상태 추가 (0이면 Area 1 도전 가능, 1이면 Area 2 해금)
    - 로컬 스토리지에 저장하여 새로고침 후에도 유지
    - `useEffect`로 로컬 스토리지에서 로드 및 저장

  - **퀘스트 관련 함수 추가**
    - `handleQuestStart`: 퀘스트 선택 모달 표시
    - `handleSelectArea`: 선택한 Area로 전투 시작
    - `handleQuestComplete`: Area 클리어 시 다음 Area 해금

  - **컴포넌트 추가**
    - `QuestSelectionModal` import 및 렌더링
    - `quests` 데이터 import

- `digimon-tamagotchi-frontend/src/components/QuestSelectionModal.jsx` (새로 생성)
  - **퀘스트 선택 화면 구현**
    - `quests` 배열을 그리드 형태로 표시
    - Area 상태에 따른 UI:
      - **Locked**: 인덱스가 `clearedQuestIndex`보다 크면 비활성화 (회색, 자물쇠 아이콘)
      - **Open**: 인덱스가 `clearedQuestIndex`와 같으면 "Challenge!" 버튼 (활성화)
      - **Cleared**: 인덱스가 `clearedQuestIndex`보다 작으면 "CLEARED" 뱃지 (다시하기 가능)
    - Area 클릭 시 `onSelectArea(areaId)` 호출

- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx` (수정)
  - **전투 종료 및 해금 연결**
    - `onQuestClear` prop 추가 (콜백 함수)
    - 마지막 라운드(Boss) 승리 시:
      - `handleNextBattle`에서 `onQuestClear()` 호출
      - Exit 버튼 클릭 시에도 `onQuestClear()` 호출
    - Area 클리어 시 다음 Area 해금 처리

### 주요 개선 사항

#### 1. Meramon 스프라이트 수정
- 공격 스프라이트 추가로 배틀 연출 개선
- `attackSprite: 17` 설정

#### 2. 퀘스트 스테이지 선택 시스템
- 순차적 해금 시스템 구현
- 로컬 스토리지에 진행 상황 저장
- 새로고침 후에도 진행 상황 유지

#### 3. UI/UX 개선
- 퀘스트 선택 모달로 Area 선택 가능
- Locked/Open/Cleared 상태를 시각적으로 구분
- 클리어한 Area는 다시 플레이 가능

#### 4. 진행 시스템
- Area 클리어 시 자동으로 다음 Area 해금
- `clearedQuestIndex`로 진행 상황 추적

### 사용 흐름
1. 배틀 버튼 클릭 → 'Quest Mode' 선택
2. 퀘스트 선택 모달 표시
3. 해금된 Area 선택 → 전투 시작
4. Area 클리어 → 다음 Area 자동 해금
5. 새로고침 후에도 진행 상황 유지

### 관련 파일
- `digimon-tamagotchi-frontend/src/data/v1/digimons.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/components/QuestSelectionModal.jsx`
- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx`
- `digimon-tamagotchi-frontend/src/data/v1/quests.js`

---

## [2025-12-14] 배틀 로그 가독성 개선(순서 변경 및 Bold 처리)

### 작업 유형
- UI/UX 개선
- 로그 가독성 향상

### 목적 및 영향
배틀 로그의 가독성을 향상시키기 위해 로그 데이터 구조를 분리하고, 렌더링 순서를 변경하여 판정 결과를 더 명확하게 표시하도록 개선했습니다. 히트레이트 계산식과 판정 결과를 분리하여 사용자가 전투 과정을 더 쉽게 이해할 수 있게 했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/logic/battle/calculator.js` (수정)
  - **로그 데이터 구조 분리**
    - 기존 `detail` 필드를 `comparison`으로 변경
    - `formula`: 히트레이트 계산식 (예: `Hit Rate: ((30 * 100) / (30 + 15)) + 5 = 71.67%`)
    - `comparison`: 판정 결과 수식 (예: `Hit Rate(User) 71.67 > Roll(User) 26.32 => HIT!! 💀`)
    - 유저와 적 공격 모두에 적용

- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx` (수정)
  - **로그 렌더링 순서 및 스타일 수정**
    - 렌더링 순서 변경:
      1. 메인 메시지 (예: `[User] attacks!`)
      2. `formula` (계산식) - 일반 텍스트
      3. `comparison` (판정 결과) - **굵은 글씨 (font-weight: 700)**
    - 하단 로그 창과 로그 리뷰 화면 모두에 적용
    - 기존 `detail` 필드 제거, `comparison` 필드 사용

### 주요 개선 사항

#### 1. 로그 데이터 구조 분리
- 기존: `detail` 필드 하나에 모든 정보 포함
- 개선: `formula`와 `comparison`으로 분리
  - `formula`: 히트레이트 계산 과정
  - `comparison`: 최종 판정 결과

#### 2. 렌더링 순서 변경
- 기존: 메시지 → detail → formula
- 개선: 메시지 → formula → comparison (Bold)
- 판정 결과가 더 눈에 띄게 표시됨

#### 3. 스타일 개선
- `comparison` 필드를 Bold 처리 (font-weight: 700)
- 계산식과 판정 결과를 시각적으로 구분
- 가독성 향상

### 사용 흐름
1. 전투 진행 중 → 계산식 먼저 표시, 그 다음 판정 결과 (Bold)
2. 로그 리뷰 → 동일한 순서와 스타일로 표시

### 관련 파일
- `digimon-tamagotchi-frontend/src/logic/battle/calculator.js`
- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx`

---

## [2025-12-14] 배틀 로그 수식 상세화 및 CPU 우측 회피 구현

### 작업 유형
- UI/UX 개선
- 애니메이션 추가
- 로그 상세화

### 목적 및 영향
배틀 로그에 수학적 근거를 상세히 표시하여 사용자가 전투 결과를 더 명확하게 이해할 수 있도록 개선했습니다. 또한 유저의 공격이 빗나갔을 때 CPU(적) 디지몬이 오른쪽으로 회피하는 애니메이션을 추가하여 시각적 피드백을 강화했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/logic/battle/calculator.js` (수정)
  - **상세 로그 포맷팅**
    - 로그 객체에 `detail` 필드 추가
    - Hit(명중) 시: `Hit Rate(${attackerName}) ${hitRate} > Roll(${attackerName}) ${roll} => HIT!! 💀`
    - Miss(빗나감) 시: `Hit Rate(${attackerName}) ${hitRate} <= Roll(${attackerName}) ${roll} => MISS...`
    - 유저와 적 공격 모두에 적용

- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx` (수정)
  - **상세 로그 렌더링**
    - 하단 로그 창: 메인 로그 메시지 아래에 `detail` 수식 표시
    - 로그 리뷰 화면: 승리/패배 모달의 로그 리뷰에도 `detail` 표시
    - 스타일: 작은 글씨, 연한 색상(opacity 0.8), 등폭(monospace) 폰트

  - **CPU 회피 로직 적용**
    - 유저 공격이 빗나갔을 때(attacker: "user", hit: false):
      - CPU(적) 디지몬에 `.dodging` 클래스 추가
      - 0.5초 후 클래스 제거
      - 기존 `dodge-motion` 대신 `dodging` 클래스 사용

- `digimon-tamagotchi-frontend/src/styles/Battle.css` (수정)
  - **CPU 우측 회피 애니메이션**
    - `@keyframes dodgeRight` 정의:
      - 0%: 원위치
      - 50%: 오른쪽으로 10px 이동, opacity 0.7
      - 100%: 원위치로 복귀
    - `.enemy-digimon.dodging` 클래스에 애니메이션 적용
    - 애니메이션 시간: 0.5초

### 주요 개선 사항

#### 1. 배틀 로그 수식 상세화
- 기존: 단순 메시지와 공식만 표시
- 개선: Hit/Miss 판정의 수학적 근거를 명확히 표시
  - 예: `Hit Rate(User) 37.50 > Roll(User) 25.30 => HIT!! 💀`
  - 예: `Hit Rate(User) 37.50 <= Roll(User) 45.20 => MISS...`
- 사용자가 왜 맞았는지/빗나갔는지 쉽게 이해 가능

#### 2. CPU 우측 회피 애니메이션
- 유저 공격이 빗나갔을 때 CPU가 오른쪽으로 회피
- 기존 왼쪽 회피(`dodge-motion`)와 대칭되는 애니메이션
- 더 자연스러운 전투 연출

#### 3. 로그 렌더링 개선
- 메인 메시지와 상세 수식을 시각적으로 구분
- 등폭 폰트로 수식 가독성 향상
- 연한 색상으로 계층 구조 명확화

### 사용 흐름
1. 전투 진행 중 → 상세 수식이 로그에 실시간 표시
2. 유저 공격 빗나감 → CPU가 오른쪽으로 회피 애니메이션
3. 로그 리뷰 → 상세 수식을 다시 확인 가능

### 관련 파일
- `digimon-tamagotchi-frontend/src/logic/battle/calculator.js`
- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx`
- `digimon-tamagotchi-frontend/src/styles/Battle.css`

---

## [2025-12-14] 배틀 피드백 강화(해골 이모티콘, 로그 컬러링, 결과창 로그 리뷰)

### 작업 유형
- UI/UX 개선
- 시각적 피드백 강화
- 사용자 경험 개선

### 목적 및 영향
배틀 화면의 시각적 피드백을 강화하여 사용자가 전투 상황을 더 명확하게 파악할 수 있도록 개선했습니다. 타격 이펙트에 해골 이모티콘을 추가하고, 배틀 로그에 컬러링을 적용하여 공격자와 결과를 시각적으로 구분할 수 있게 했습니다. 또한 결과 화면에서 전투 로그를 다시 볼 수 있는 기능을 추가하여 사용자가 전투 결과를 분석할 수 있도록 했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx` (수정)
  - **타격 텍스트 수정**
    - "HIT!" → "💀💀!HIT!💀💀"로 변경
    - 더 강렬한 시각적 피드백 제공

  - **배틀 로그 컬러링**
    - 로그 렌더링 시 공격자와 결과에 따라 클래스 추가:
      - `user-hit`: 유저 공격 성공 → 초록색
      - `user-miss`: 유저 공격 실패 → 주황색
      - `enemy-hit`: 적 공격 성공 → 빨간색
      - `enemy-miss`: 적 공격 실패 → 파란색
    - 현재 진행 중인 로그는 `current-log` 클래스로 강조

  - **로그 리뷰 기능 추가**
    - `showLogReview` state 추가
    - 승리/패배 모달에 [Review Log] 버튼 추가
    - 로그 리뷰 화면:
      - 전체 전투 로그 리스트 표시 (스크롤 가능)
      - 각 로그에 컬러링 적용
      - 계산 공식 및 Roll 결과 표시
      - [Back] 버튼으로 결과 화면으로 복귀

- `digimon-tamagotchi-frontend/src/styles/Battle.css` (수정)
  - **배틀 로그 컬러링 스타일**
    - `.battle-log-entry.user-hit`: 초록색 텍스트, 연한 초록 배경, 초록 테두리
    - `.battle-log-entry.user-miss`: 주황색 텍스트, 연한 주황 배경, 주황 테두리
    - `.battle-log-entry.enemy-hit`: 빨간색 텍스트, 연한 빨강 배경, 빨강 테두리
    - `.battle-log-entry.enemy-miss`: 파란색 텍스트, 연한 파랑 배경, 파랑 테두리
    - `.battle-log-entry.current-log`: 현재 로그 강조 (굵은 글씨, 그림자)

  - **로그 리뷰 화면 스타일**
    - `.battle-log-review`: 모노스페이스 폰트, 왼쪽 정렬
    - 최대 높이 96 (max-h-96), 스크롤 가능

### 주요 개선 사항

#### 1. 타격 이펙트 강화
- 기존: "HIT!" 텍스트
- 개선: "💀💀!HIT!💀💀" 이모티콘 추가
- 더 강렬하고 재미있는 시각적 피드백

#### 2. 배틀 로그 컬러링
- 공격자와 결과에 따라 색상 구분
- 유저 성공: 초록색 (긍정적)
- 유저 실패: 주황색 (중립적)
- 적 성공: 빨간색 (부정적)
- 적 실패: 파란색 (중립적)
- 시각적으로 전투 흐름을 쉽게 파악 가능

#### 3. 로그 리뷰 기능
- 승리/패배 후 전투 로그를 다시 볼 수 있음
- "왜 졌는지/이겼는지" 상세 분석 가능
- 계산 공식과 Roll 결과를 다시 확인 가능
- [Back] 버튼으로 결과 화면으로 복귀

### 사용 흐름
1. 전투 진행 중 → 컬러링된 로그로 실시간 확인
2. 승리/패배 → [Review Log] 버튼 표시
3. [Review Log] 클릭 → 전체 로그 리뷰 화면 표시
4. [Back] 클릭 → 결과 화면으로 복귀

### 관련 파일
- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx`
- `digimon-tamagotchi-frontend/src/styles/Battle.css`

---

## [2025-12-14] 배틀 라운드 시작 방식을 자동 애니메이션에서 수동 팝업으로 변경

### 작업 유형
- 성능 최적화
- UX 개선
- 애니메이션 제거

### 목적 및 영향
라운드 시작 시 자동으로 재생되던 오버레이 애니메이션이 렉을 유발하는 문제를 해결하기 위해, 자동 애니메이션을 제거하고 사용자가 직접 시작할 수 있는 준비 팝업으로 변경했습니다. 이를 통해 성능을 개선하고 사용자에게 더 나은 제어권을 제공합니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx` (수정)
  - **기존 오버레이 제거**
    - `showRoundStart` state 제거
    - `roundStart` battleState 제거
    - 자동으로 1.5~2초 후 전투 시작하는 로직 제거
    - `round-start-overlay` JSX 제거

  - **라운드 준비 모달 구현**
    - `showReadyModal` state 추가
    - `ready` battleState 추가
    - 준비 모달 내용:
      - 제목: "Round [N]" (예: Round 1)
      - 부제목: "VS [적 디지몬 이름]"
      - 버튼:
        - [Start]: 팝업 닫고 전투 로그 재생 시작
        - [Exit]: 배틀 종료하고 나가기
    - `handleRoundStart()`: Start 버튼 핸들러
    - `handleRoundExit()`: Exit 버튼 핸들러

- `digimon-tamagotchi-frontend/src/styles/Battle.css` (수정)
  - **기존 오버레이 스타일 제거**
    - `.round-start-overlay` 제거
    - `.round-start-text` 제거
    - `roundStartFadeOut` 애니메이션 제거

  - **준비 모달 스타일 추가**
    - `.round-ready-modal`: 화면 중앙에 위치, 반투명 검정 배경
    - `.round-ready-modal > div`: 깔끔한 박스 디자인 (기존 `.victory-modal > div`와 유사)
    - 최소 너비 400px, 최대 너비 500px

### 주요 개선 사항

#### 1. 성능 최적화
- 기존: 자동 애니메이션으로 인한 렉 발생
- 개선: 애니메이션 제거로 성능 향상
- 사용자가 직접 시작 버튼을 눌러야 하므로 불필요한 렌더링 방지

#### 2. 사용자 제어권 향상
- 기존: 자동으로 1.5~2초 후 전투 시작 (강제 대기)
- 개선: 사용자가 준비되면 [Start] 버튼으로 즉시 시작 가능
- [Exit] 버튼으로 언제든지 배틀 종료 가능

#### 3. UX 개선
- 명확한 라운드 정보 표시 (Round 번호, 적 이름)
- 사용자가 배틀을 시작할 준비가 되었을 때 시작
- 불필요한 대기 시간 제거

### 사용 흐름
1. 라운드 진입 → 배틀 결과 즉시 계산
2. 준비 모달 표시 → "Round [N]" / "VS [적 이름]"
3. 사용자 선택:
   - [Start]: 전투 로그 재생 시작
   - [Exit]: 배틀 종료

### 관련 파일
- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx`
- `digimon-tamagotchi-frontend/src/styles/Battle.css`

---

## [2025-12-14] 배틀 UI 보정(Round Start, HIT 텍스트, 배지 위치)

### 작업 유형
- UI/UX 개선
- 애니메이션 추가
- 레이아웃 조정

### 목적 및 영향
배틀 화면의 사용자 경험을 개선하기 위해 라운드 시작 알림을 추가하고, 타격 이펙트를 스프라이트에서 텍스트로 변경하여 더 명확한 시각적 피드백을 제공했습니다. 또한 배지 위치를 조정하여 디지몬 스프라이트와 겹치지 않도록 개선했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx` (수정)
  - **라운드 시작 알림 구현**
    - 배틀 진입 시 "Round [N] Start!" 오버레이 표시
    - `showRoundStart` state 추가
    - `battleState`에 "roundStart" 상태 추가
    - 1.5~2초 후 오버레이가 사라지면서 전투 로그 재생 시작

  - **타격 이펙트 변경**
    - 기존 스프라이트 번갈아 보여주기 방식 제거
    - 피격된 디지몬 머리 위에 "HIT!" 텍스트 표시
    - `hitEffect` state를 `hitText` state로 변경
    - MISS 텍스트와 유사한 방식으로 구현

  - **발사체 방향 수정**
    - 유저 발사체에 `transform: scaleX(-1)` 적용
    - `user-projectile` 클래스 추가하여 유저 발사체만 좌우 반전

  - **배지 텍스트 및 위치 수정**
    - "ME" → "USER"로 변경
    - 배지 위치를 `top: -30px`로 조정하여 디지몬 스프라이트와 겹치지 않도록 개선
    - `margin-bottom: 10px` 추가

- `digimon-tamagotchi-frontend/src/styles/Battle.css` (수정)
  - **라운드 시작 오버레이 스타일**
    - `.round-start-overlay`: 화면 중앙, 반투명 배경
    - `.round-start-text`: 큰 글씨 (64px), 흰색, 그림자 효과
    - `roundStartFadeOut` 애니메이션: 페이드 아웃 효과

  - **타격 텍스트 스타일**
    - `.hit-text`: "HIT!" 텍스트 스타일
    - 빨간색, 굵은 폰트 (28px), 그림자 효과
    - `hitTextBounce` 애니메이션: 위로 튀어오르며 사라지는 효과

  - **배지 위치 조정**
    - `.battle-badge`: `top: -30px`로 변경 (기존 -10px)
    - `margin-bottom: 10px` 추가

  - **발사체 스타일**
    - `.projectile.user-projectile`: `transform: scaleX(-1)` 추가
    - 유저 발사체만 좌우 반전 적용

### 주요 개선 사항

#### 1. 라운드 시작 알림
- 배틀 진입 시 즉시 전투가 시작되지 않고 라운드 시작 알림 표시
- 사용자가 배틀 시작을 명확히 인지할 수 있음
- 1.5~2초 후 자동으로 전투 시작

#### 2. 타격 이펙트 개선
- 기존: 스프라이트 이미지 번갈아 표시 (복잡함)
- 개선: "HIT!" 텍스트로 명확한 피드백
- MISS 텍스트와 일관된 스타일

#### 3. 발사체 방향 수정
- 유저 발사체가 적을 향하도록 좌우 반전
- 더 자연스러운 공격 연출

#### 4. 배지 위치 조정
- 디지몬 스프라이트와 겹치지 않도록 위쪽으로 이동
- 시각적 가독성 향상

### 애니메이션 타이밍
- 라운드 시작 오버레이: 1.5~2초 (랜덤)
- HIT! 텍스트: 1초
- MISS 텍스트: 1초 (기존 유지)

### 관련 파일
- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx`
- `digimon-tamagotchi-frontend/src/styles/Battle.css`

---

## [2025-12-14] 배틀 연출 고도화(발사체, 타격감, 상세 로그)

### 작업 유형
- 애니메이션 시스템 전면 개편
- UI/UX 개선
- 배틀 로그 상세화

### 목적 및 영향
배틀 애니메이션을 Body Transformation 방식에서 Projectile Launch(발사체) 방식으로 전면 개편했습니다. 발사체가 날아가는 시각적 연출과 타격/회피 이펙트를 추가하여 배틀의 몰입감을 크게 향상시켰습니다. 또한 배틀 로그에 계산 공식을 포함시켜 사용자가 확률 계산을 이해할 수 있도록 개선했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx` (전면 개편)
  - **발사체 시스템 구현**
    - 공격 시 디지몬 이미지를 교체하지 않고 별도의 `<img className="projectile" />` 요소 생성
    - 유저 공격: 왼쪽에서 오른쪽으로 날아가는 애니메이션 (`shoot-right`)
    - 적 공격: 오른쪽에서 왼쪽으로 날아가는 애니메이션 (`shoot-left`)
    - 발사체 이미지는 `attackSprite` 사용 (없으면 기본 `sprite`)
    - 발사체 비행 시간: 800ms

  - **타격(Hit) 연출**
    - 타격 시 상대방 디지몬 위에 타격 이펙트 오버레이 표시
    - 2개의 스프라이트를 번갈아 보여주는 깜빡임 애니메이션 (`hit-flash-1`, `hit-flash-2`)
    - 타격 이펙트 스프라이트 경로 상수 정의: `HIT_SPRITE_1`, `HIT_SPRITE_2` (나중에 실제 경로로 교체 가능)

  - **회피(Miss) 연출**
    - 발사체가 닿기 직전에 상대방이 뒤로 빠지거나 투명해지는 애니메이션 (`dodge-motion`)
    - 상대방 머리 위에 "MISS" 텍스트가 위로 올라가며 사라지는 효과 (`missTextFloat`)

  - **배틀 로그 상세화**
    - 현재 턴의 계산 공식 표시 (`battle-formula`)
    - Roll 결과 표시 (`battle-roll`)
    - 전체 배틀 로그 히스토리에 각 턴의 상세 정보 포함

  - **UI 텍스트 수정**
    - 플레이어 배지: "YOU" → "ME"
    - 적 배지: "CPU" 추가

- `digimon-tamagotchi-frontend/src/styles/Battle.css` (전면 개편)
  - **발사체 애니메이션**
    - `.projectile.shoot-right`: 왼쪽에서 오른쪽으로 이동하는 애니메이션
    - `.projectile.shoot-left`: 오른쪽에서 왼쪽으로 이동하는 애니메이션
    - 발사체는 절대 위치로 배틀 영역 위에 오버레이

  - **타격 이펙트 스타일**
    - `.hit-effect`: 타격 이펙트 컨테이너 (절대 위치)
    - `.hit-flash-1`, `.hit-flash-2`: 번갈아 깜빡이는 애니메이션

  - **회피 애니메이션**
    - `.dodge-motion`: 뒤로 빠지며 투명해지는 애니메이션
    - `.miss-text`: "MISS" 텍스트가 위로 올라가며 사라지는 효과

  - **배지 스타일**
    - `.badge.me`: 파란색 계열 (기존 player-badge)
    - `.badge.cpu`: 빨간색 계열 (새로 추가)

  - **배틀 로그 스타일**
    - `.battle-formula`: 계산 공식 표시 스타일 (파란색 테두리)
    - `.battle-roll`: Roll 결과 표시 스타일

  - **반응형 디자인**
    - 모바일 환경에서 발사체 애니메이션 경로 조정

- `digimon-tamagotchi-frontend/src/logic/battle/calculator.js` (수정)
  - **배틀 로그 상세화**
    - 각 로그에 `formula` 필드 추가: 히트레이트 계산 공식 문자열
    - 예: `"Hit Rate: ((30 * 100) / (30 + 50)) + 0 = 37.50%"`
    - `roll` 필드는 기존에 있음 (유지)

### 주요 개선 사항

#### 1. 발사체 시스템
- 기존: 디지몬 이미지를 공격 스프라이트로 교체
- 개선: 별도의 발사체 이미지가 날아가는 시각적 연출
- 효과: 더 명확한 공격 시각화, 몰입감 향상

#### 2. 타격 연출
- 타격 이펙트 오버레이로 명확한 피격 표시
- 깜빡임 애니메이션으로 타격감 강화
- 나중에 실제 타격 이펙트 스프라이트로 교체 가능

#### 3. 회피 연출
- 회피 애니메이션으로 회피 상황 명확히 표시
- "MISS" 텍스트로 시각적 피드백 제공

#### 4. 배틀 로그 상세화
- 계산 공식 표시로 확률 계산 과정 투명화
- Roll 결과 표시로 확률 검증 가능
- 사용자가 배틀 결과를 더 잘 이해할 수 있음

#### 5. UI 개선
- "ME" / "CPU" 배지로 플레이어/적 구분 명확화
- 배지 색상으로 시각적 구분 강화

### 애니메이션 타이밍
- 발사체 비행: 800ms
- 타격 이펙트: 500ms
- 회피 애니메이션: 600ms
- MISS 텍스트: 1000ms
- 전체 턴 간격: 1.5~2초 (랜덤)

### 관련 파일
- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx`
- `digimon-tamagotchi-frontend/src/styles/Battle.css`
- `digimon-tamagotchi-frontend/src/logic/battle/calculator.js`
- `digimon-tamagotchi-frontend/src/logic/battle/questEngine.js`

---

## [2025-12-14] 배틀 UX 개선(속도, 공격모션, 수동 진행, 좌우반전)

### 작업 유형
- UX/UI 개선
- 애니메이션 개선
- 흐름 제어 개선

### 목적 및 영향
배틀 시스템의 사용자 경험을 전면 개선했습니다. 전투 속도를 조절하고, 승리 시 자동 진행을 방지하여 사용자가 결과를 확인하고 선택할 수 있도록 했습니다. 또한 플레이어 디지몬을 좌우 반전시켜 적을 바라보게 하고, 공격 시 공격 스프라이트를 사용하도록 개선했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx` (수정)
  - **배틀 템포 개선**
    - 턴 재생 속도를 1.5~2초로 조절 (랜덤하게 1500ms ~ 2000ms)
    - 기존 1초에서 더 여유롭게 변경하여 사용자가 전투를 더 잘 관찰할 수 있도록 함

  - **자동 진행 방지 및 결과 모달**
    - 승리 시 `battleState`를 "victory"로 설정하여 자동 진행 방지
    - 승리 모달(`victory-modal`) 표시:
      - 일반 승리: "WIN!" 메시지 + [Next Battle] / [Exit] 버튼
      - 퀘스트 클리어: "Quest Cleared!" 메시지 + [Exit] 버튼만 표시
    - 패배 시 기존과 동일하게 "LOSE..." 메시지 표시

  - **공격 모션 및 스프라이트**
    - 공격 시 `attackSprite` 사용 (없으면 기본 `sprite` 사용)
    - `currentSprite` state로 공격 중 스프라이트 관리
    - 공격 애니메이션 종료 후 원래 스프라이트로 복원

  - **플레이어 식별**
    - 플레이어 디지몬 상단에 "YOU" 배지 추가
    - 플레이어 디지몬 이미지 좌우 반전 (`scaleX(-1)`) 적용하여 적을 바라보게 함

- `digimon-tamagotchi-frontend/src/styles/Battle.css` (수정)
  - **플레이어 디지몬 좌우 반전**
    - `.player-digimon img`, `.player-sprite`: `transform: scaleX(-1)` 적용
    - 모든 애니메이션에서 좌우 반전 유지:
      - `playerAttackLunge`: 공격 시 좌우 반전 유지하면서 돌진
      - `playerShake`: 피격 시 좌우 반전 유지하면서 흔들림
      - `playerDodgeBack`: 회피 시 좌우 반전 유지하면서 회피

  - **플레이어 배지 스타일**
    - `.battle-badge`, `.player-badge`: 파란색 배경, 흰색 텍스트, 그림자 효과
    - 디지몬 상단에 절대 위치로 배치

  - **히트 마커 개선**
    - 크기 증가 (20px → 24px)
    - 채워진 상태 시 발광 효과 강화 (box-shadow 증가)
    - `hitMarkerPulse` 애니메이션 추가: 채워질 때 펄스 효과

  - **승리 모달 스타일**
    - `.victory-modal`: 오버레이 스타일 (z-index: 60)
    - 버튼 2개 (Next Battle / Exit) 가로 배치
    - 반응형 디자인 지원

- `digimon-tamagotchi-frontend/src/data/v1/digimons.js` (수정)
  - **attackSprite 필드 추가**
    - 모든 디지몬의 `stats` 객체에 `attackSprite: null` 필드 추가
    - 공격 스프라이트가 없으면 기본 `sprite` 사용
    - JSDoc 주석에 `attackSprite` 필드 설명 추가

### 주요 개선 사항

#### 1. 배틀 템포 조절
- 기존: 1초 간격으로 턴 재생
- 개선: 1.5~2초 간격으로 랜덤하게 재생 (더 여유롭게 관찰 가능)

#### 2. 자동 진행 방지
- 기존: 승리 시 자동으로 다음 라운드로 진행
- 개선: 승리 모달 표시 → 사용자가 [Next Battle] 또는 [Exit] 선택

#### 3. 퀘스트 클리어 처리
- 퀘스트 클리어 시 "Quest Cleared!" 메시지 표시
- [Next Battle] 버튼 없이 [Exit] 버튼만 표시
- 무한 루프 방지

#### 4. 공격 모션 개선
- 공격 시 `attackSprite` 사용 (있는 경우)
- 공격 애니메이션 종료 후 원래 스프라이트로 복원
- 돌진 거리 증가 (30px → 40px)

#### 5. 플레이어 식별 개선
- "YOU" 배지 추가로 플레이어 명확히 식별
- 플레이어 디지몬 좌우 반전으로 적을 바라보게 함
- 모든 애니메이션에서 좌우 반전 유지

#### 6. 히트 마커 시각적 개선
- 크기 증가 및 발광 효과 강화
- 채워질 때 펄스 애니메이션 추가

### 사용 흐름 개선
1. 배틀 시작 → 전투 진행 (1.5~2초 간격)
2. 승리 시 → 승리 모달 표시
   - 일반 승리: [Next Battle] / [Exit] 선택
   - 퀘스트 클리어: [Exit]만 표시
3. 패배 시 → "LOSE..." 메시지 → 게임 화면 복귀

### 관련 파일
- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx`
- `digimon-tamagotchi-frontend/src/styles/Battle.css`
- `digimon-tamagotchi-frontend/src/data/v1/digimons.js`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`

---

## [2025-12-14] 배틀 모드 선택 및 턴제 전투 애니메이션 UI 구현

### 작업 유형
- UI 컴포넌트 구현
- 전투 애니메이션 구현
- 배틀 시스템 UI 통합

### 목적 및 영향
배틀 모드 선택 모달과 턴제 전투 화면을 구현했습니다. 사용자가 배틀 아이콘을 클릭하면 모달이 나타나고, 퀘스트 모드를 선택하면 실제 전투 화면이 표시됩니다. 전투는 엔진이 즉시 계산하지만, UI는 로그를 1초 간격으로 재생하여 시각적인 전투 연출을 제공합니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/components/BattleSelectionModal.jsx` (신규 생성)
  - **배틀 모드 선택 모달**
    - [Quest Mode] 버튼: 클릭 시 `handleQuestStart()` 실행
    - [Communication] 버튼: 비활성화 상태, 클릭 시 "아직 준비 중입니다!" 알림
    - 닫기 버튼 포함
    - 도트 감성 스타일링

- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx` (신규 생성)
  - **턴제 전투 화면**
    - 레이아웃:
      - 좌측: 유저 디지몬 (이미지, 이름, Power)
      - 우측: 적 디지몬 (이미지, 이름, Power)
      - 상단: 라운드 정보 (예: "Round 1 - Betamon")
      - 중앙: 히트 마커 (양쪽에 빈 동그라미 3개, 맞을 때마다 채워짐)
    - 전투 애니메이션:
      - 공격 시: 공격자 이미지가 앞으로 튀어나가는 애니메이션 (`attackLunge`)
      - 피격 시: 피해자 이미지가 흔들리는 애니메이션 (`shake`) + 히트 마커 채워짐
      - 회피 시: 피해자가 뒤로 빠지거나 흐릿해지는 애니메이션 (`dodgeBack`)
    - Replay 로직:
      - `playQuestRound`가 반환한 `logs` 배열을 1초 간격으로 순회
      - 각 로그에 따라 애니메이션 클래스 적용
      - 히트 마커 실시간 업데이트
    - 결과 처리:
      - 승리 시: "WIN!" 메시지 + 다음 라운드 진행 버튼
      - 패배 시: "LOSE..." 메시지 + 게임 화면 복귀 버튼
      - Area 클리어 시: 보상 메시지 표시

- `digimon-tamagotchi-frontend/src/styles/Battle.css` (신규 생성)
  - **배틀 화면 스타일링**
    - 도트 감성 스타일 (`image-rendering: pixelated`)
    - 애니메이션 클래스:
      - `.shake`: 흔들림 애니메이션 (피격 시)
      - `.attack-lung` / `user-attack-hit`, `enemy-attack-hit`: 공격 애니메이션
      - `.hit-flash`: 피격 깜빡임 애니메이션
      - `.dodgeBack` / `user-attack-miss`, `enemy-attack-miss`: 회피 애니메이션
    - 히트 마커 스타일:
      - 빈 상태: 투명 배경, 검은 테두리
      - 채워진 상태: 빨간 배경, 빨간 테두리, 발광 효과
    - 반응형 디자인 지원

- `digimon-tamagotchi-frontend/src/pages/Game.jsx` (수정)
  - **배틀 시스템 통합**
    - 배틀 관련 상태 추가:
      - `showBattleSelectionModal`: 배틀 모드 선택 모달 표시 여부
      - `showBattleScreen`: 배틀 스크린 표시 여부
      - `currentQuestArea`: 현재 퀘스트 Area ID
      - `currentQuestRound`: 현재 라운드 인덱스
    - `handleMenuClick`: "battle" 케이스 추가 → 배틀 모드 선택 모달 표시
    - `handleQuestStart()`: 퀘스트 시작 (Area 1부터 시작)
    - `handleBattleComplete()`: 배틀 완료 처리
      - 승리 시: 배틀 기록 업데이트 (`battles`, `battlesWon`, `battlesForEvolution` 증가)
      - 패배 시: 배틀 기록 업데이트 (`battles`, `battlesLost` 증가)
      - Area 클리어 시: 보상 메시지 표시 및 배틀 종료
      - 다음 라운드로 진행 또는 게임 화면 복귀

### 전투 애니메이션 상세

#### 공격 애니메이션 (`attackLunge`)
- 공격자가 앞으로 30px 이동 후 원위치
- 0.5초 동안 실행

#### 피격 애니메이션 (`shake`)
- 피해자가 좌우로 흔들림 (-5px ~ +5px)
- 0.5초 동안 실행
- 히트 마커가 채워짐

#### 회피 애니메이션 (`dodgeBack`)
- 피해자가 뒤로 20px 이동하며 투명도 감소 (50%)
- 0.5초 동안 실행

### 히트 마커 시스템
- 양쪽에 빈 동그라미 3개 표시
- 명중 시 해당 마커가 빨간색으로 채워짐
- 발광 효과로 시각적 피드백 제공
- 먼저 3개를 채운 쪽이 승리

### 배틀 로그 재생
- 엔진이 즉시 계산한 결과를 `logs` 배열로 받음
- 각 로그를 1초 간격으로 순회하며 애니메이션 재생
- 로그 메시지 실시간 표시
- 모든 로그 재생 완료 후 결과 화면 표시

### 사용 흐름
1. 사용자가 배틀 아이콘 클릭
2. 배틀 모드 선택 모달 표시
3. [Quest Mode] 버튼 클릭
4. 배틀 스크린 표시 (Area 1, Round 0)
5. 전투 애니메이션 재생 (1초 간격)
6. 승리/패배 결과 표시
7. 승리 시: 다음 라운드로 진행 또는 Area 클리어
8. 패배 시: 게임 화면으로 복귀

### 관련 파일
- `digimon-tamagotchi-frontend/src/components/BattleSelectionModal.jsx`
- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx`
- `digimon-tamagotchi-frontend/src/styles/Battle.css`
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
- `digimon-tamagotchi-frontend/src/logic/battle/questEngine.js`
- `digimon-tamagotchi-frontend/src/logic/battle/calculator.js`

---

## [2025-12-14] Ver.1 퀘스트 모드 전체 데이터(Area 1~F) 및 엔진 구현

### 작업 유형
- 퀘스트 데이터 구현
- 퀘스트 엔진 구현
- 배틀 시스템 통합

### 목적 및 영향
Digital Monster Color Ver.1 퀘스트 모드를 완전히 구현했습니다. Area 1부터 Area F까지 모든 퀘스트 데이터를 입력하고, 퀘스트 엔진을 구현하여 실제 게임에서 퀘스트 모드를 플레이할 수 있게 되었습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/data/v1/quests.js` (신규 생성)
  - **퀘스트 데이터 구조 정의**
    - `quests` 배열: Area 1 ~ Area 7, Area F (총 8개 Area)
    - 각 Area는 여러 적(Enemy)을 포함하며, 마지막 적은 Boss
    - 적 데이터 구조:
      - `enemyId`: 디지몬 ID (digimons.js 참조)
      - `name`: 디지몬 이름
      - `attribute`: 속성 (Vaccine, Data, Virus, Free)
      - `power`: 파워 (퀘스트 전용 값, 도감 값과 다를 수 있음)
      - `isBoss`: 보스 여부
    - `unlockCondition`: Area 언락 조건 (예: "The Grid", "DMC Logo", "Box Art")

  - **헬퍼 함수**
    - `getQuestArea(areaId)`: Area ID로 퀘스트 데이터 찾기
    - `getQuestEnemy(areaId, roundIndex)`: Area의 특정 Round(적) 데이터 가져오기

- `digimon-tamagotchi-frontend/src/logic/battle/questEngine.js` (신규 생성)
  - **퀘스트 엔진 구현**
    - `playQuestRound(userDigimon, userStats, areaId, roundIndex)` 함수
      - 지정된 Area와 Round의 적 데이터를 가져옴
      - `calculator.js`의 `simulateBattle`을 실행하여 배틀 수행
      - **중요**: 적의 `power`는 퀘스트 데이터의 값을 강제로 적용 (도감 값 무시)
      - 반환값:
        - `win`: 승리 여부 (boolean)
        - `logs`: 배틀 로그 배열
        - `enemy`: 적 정보 { name, power, attribute, isBoss }
        - `isAreaClear`: Area 클리어 여부
        - `reward`: 보상 (Area 클리어 시)
        - `rounds`, `userHits`, `enemyHits`: 추가 배틀 정보

    - `playQuestArea(userDigimon, userStats, areaId)` 함수
      - Area의 모든 라운드를 순차적으로 플레이
      - 한 번이라도 패배하면 중단
      - 전체 Area 플레이 결과 반환

- `digimon-tamagotchi-frontend/src/logic/battle/index.js` (수정)
  - 퀘스트 엔진 함수들 export 추가

### 퀘스트 데이터 상세

#### Area 1: The Grid (Unlock: "The Grid")
- Betamon (Virus, Power: 15)
- Agumon (Vaccine, Power: 19)
- Meramon (Boss, Data, Power: 23)

#### Area 2
- Numemon (Virus, Power: 19)
- Seadramon (Data, Power: 23)
- Devimon (Boss, Virus, Power: 28)

#### Area 3
- Tyrannomon (Data, Power: 28)
- Airdramon (Vaccine, Power: 37)
- Greymon (Boss, Vaccine, Power: 45)

#### Area 4: DMC Logo (Unlock: "DMC Logo")
- Seadramon (Data, Power: 45)
- Meramon (Data, Power: 55)
- Devimon (Virus, Power: 65)
- Mamemon (Boss, Data, Power: 80)

#### Area 5
- Airdramon (Vaccine, Power: 55)
- Tyrannomon (Data, Power: 70)
- Greymon (Vaccine, Power: 85)
- Metal Greymon (Virus) (Boss, Power: 105)

#### Area 6
- Meramon (Data, Power: 55)
- Mamemon (Data, Power: 80)
- Monzaemon (Vaccine, Power: 95)
- Bancho Mamemon (Boss, Data, Power: 120)

#### Area 7
- Numemon (Virus, Power: 75)
- Metal Greymon (Virus) (Power: 90)
- Monzaemon (Vaccine, Power: 110)
- Blitz Greymon (Virus, Power: 130)
- Shin Monzaemon (Boss, Vaccine, Power: 145)

#### Area F (Final): Box Art (Unlock: "Box Art")
- Metal Greymon (Virus) (Power: 85)
- Bancho Mamemon (Data, Power: 100)
- Shin Monzaemon (Vaccine, Power: 135)
- Blitz Greymon (Virus, Power: 160)
- Omegamon Alter-S (Boss, Virus, Power: 220)

### 주요 특징

1. **퀘스트 전용 파워 값**
   - 적의 파워는 도감 값이 아닌 퀘스트 데이터의 값을 사용
   - 같은 디지몬이라도 Area에 따라 다른 파워를 가질 수 있음

2. **Boss 시스템**
   - 각 Area의 마지막 적은 `isBoss: true`로 표시
   - Boss를 처치하면 Area 클리어

3. **언락 시스템**
   - 일부 Area는 특정 조건을 만족해야 언락됨
   - `unlockCondition` 필드로 관리

4. **배틀 로그**
   - 각 배틀의 상세 로그를 제공
   - 승패, 라운드 수, 명중 횟수 등 모든 정보 포함

### 사용 예시
```javascript
import { playQuestRound, playQuestArea } from '../logic/battle';
import { digimonDataVer1 } from '../data/v1/digimons';

// 단일 라운드 플레이
const result = playQuestRound(
  userDigimon,    // digimons.js의 디지몬 데이터
  userStats,      // 유저 스탯
  "area1",        // Area ID
  0               // Round 인덱스 (0부터 시작)
);

// 전체 Area 플레이
const areaResult = playQuestArea(
  userDigimon,
  userStats,
  "area1"
);
```

### 관련 파일
- `digimon-tamagotchi-frontend/src/data/v1/quests.js`
- `digimon-tamagotchi-frontend/src/logic/battle/questEngine.js`
- `digimon-tamagotchi-frontend/src/logic/battle/calculator.js`
- `digimon-tamagotchi-frontend/src/logic/battle/index.js`

---

## [2025-12-14] DMC 배틀 공식(HitRate + Type Advantage) 엔진 구현

### 작업 유형
- 배틀 시스템 구현
- 속성 상성 로직 구현
- 배틀 시뮬레이터 구현

### 목적 및 영향
Digital Monster Color 매뉴얼 기반 배틀 계산기를 구현했습니다. 속성 상성 시스템과 히트레이트 계산 공식을 정확히 반영하고, 턴제 배틀 시뮬레이터를 추가하여 실제 배틀 결과를 시뮬레이션할 수 있게 되었습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/logic/battle/types.js` (신규 생성)
  - **속성 상성 시스템 구현**
    - Vaccine > Virus > Data > Vaccine 삼각 상성 관계 정의
    - `getAttributeBonus(attackerAttr, defenderAttr)` 함수
      - 유리한 경우: +5 반환
      - 불리한 경우: -5 반환
      - 무관한 경우: 0 반환
      - Free 속성은 상성 없음

- `digimon-tamagotchi-frontend/src/logic/battle/calculator.js` (신규 생성)
  - **히트레이트 계산기**
    - `calculateHitRate(attackerPower, defenderPower, attrBonus)` 함수
      - 매뉴얼 공식: `((p1 * 100) / (p1 + p2)) + bonus`
      - 결과값을 0~100 사이로 클램핑
      - 분모가 0인 경우 기본값 50% 반환

  - **배틀 시뮬레이터**
    - `simulateBattle(userDigimon, userStats, enemyDigimon, enemyStats)` 함수
      - 턴제 시뮬레이션 수행
      - 라운드마다 서로 한 번씩 공격
      - 각 공격은 `Math.random() * 100 < hitRate` 여부로 명중 판정
      - 먼저 3번 명중(Hits)시킨 쪽이 승리
      - 반환값:
        - `won`: 승패 여부 (boolean)
        - `rounds`: 총 라운드 수 (number)
        - `log`: 배틀 로그 배열 (누가 때렸고 맞았는지 상세 정보)
        - `userHits`: 유저 명중 횟수
        - `enemyHits`: 적 명중 횟수
        - `userHitRate`, `enemyHitRate`: 각각의 히트레이트
        - `userAttrBonus`, `enemyAttrBonus`: 각각의 속성 보너스

- `digimon-tamagotchi-frontend/src/logic/battle/index.js` (수정)
  - 새로운 배틀 계산기 함수들 export 추가
  - 기존 `hitrate.js` 함수들과의 호환성 유지

### 배틀 시스템 상세

#### 속성 상성 관계
```
Vaccine > Virus > Data > Vaccine (삼각 상성)
Free: 상성 없음
```

#### 히트레이트 계산 공식
```
hitRate = ((attackerPower * 100) / (attackerPower + defenderPower)) + attrBonus
```
- `attrBonus`: 속성 보너스 (-5, 0, 또는 +5)
- 결과값은 0~100 사이로 클램핑

#### 배틀 규칙
1. **턴제 시스템**: 라운드마다 유저와 적이 각각 한 번씩 공격
2. **명중 판정**: `Math.random() * 100 < hitRate`로 결정
3. **승리 조건**: 먼저 상대에게 3번 명중시킨 쪽이 승리
4. **최대 라운드**: 무한 루프 방지를 위해 최대 100라운드로 제한

#### 배틀 로그 구조
```javascript
{
  round: 1,
  attacker: "user" | "enemy",
  defender: "user" | "enemy",
  hit: true | false,
  roll: "45.23", // 랜덤 값
  hitRate: "65.50", // 히트레이트
  message: "라운드 1: 유저 공격 성공! (1/3)"
}
```

### 사용 예시
```javascript
import { simulateBattle, calculateHitRate, getAttributeBonus } from '../logic/battle';

// 배틀 시뮬레이션
const result = simulateBattle(
  userDigimon,    // 유저 디지몬 데이터
  userStats,      // 유저 스탯
  enemyDigimon,   // 적 디지몬 데이터
  enemyStats      // 적 스탯
);

console.log(result.won);      // true/false
console.log(result.rounds);    // 총 라운드 수
console.log(result.log);       // 상세 로그 배열
```

### 관련 파일
- `digimon-tamagotchi-frontend/src/logic/battle/types.js`
- `digimon-tamagotchi-frontend/src/logic/battle/calculator.js`
- `digimon-tamagotchi-frontend/src/logic/battle/index.js`
- `digimon-tamagotchi-frontend/src/logic/battle/hitrate.js` (기존 파일, 호환성 유지)

---

## [2025-12-14] Ver.1 전체 진화 트리 데이터 입력 (Baby I ~ Super Ultimate)

### 작업 유형
- 데이터 전면 업데이트
- 완전한 진화 트리 구현
- 모든 스탯 값 정확 반영

### 목적 및 영향
사용자가 제공한 18장의 상세 스탯 카드 및 진화 트리 이미지를 분석하여 `digimons.js`를 전면 업데이트했습니다. Baby I부터 Super Ultimate까지 모든 단계의 디지몬 데이터를 정확히 반영하고, 모든 수치(Hunger Loss, Strength Loss, Sleep Time, Power, Energy, Min Weight 등)를 이미지 분석 데이터에 맞춰 입력했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/data/v1/digimons.js` (전면 재작성)
  - **전체 디지몬 데이터 구조 재정의**
  - **sleepTime 필드 추가**: 수면 시간을 "HH:MM" 형식으로 저장
  - **진화 우선순위 적용**: 까다로운 진화 조건을 배열 앞쪽에, Numemon 같은 Fallback 진화를 맨 뒤에 배치

### 추가/업데이트된 디지몬 목록

#### Baby I (In-Training I)
1. **Botamon** (ID: 1, Free)
   - Power: 0, Min Weight: 5, Energy: 0
   - Hunger Loss: 3분, Strength Loss: 3분
   - Sleep: null
   - 진화: Koromon (Time 10분)

#### Baby II (In-Training II)
2. **Koromon** (ID: 2, Free)
   - Power: 0, Min Weight: 10, Energy: 0
   - Hunger Loss: 30분, Strength Loss: 30분
   - Sleep: 20:00
   - 진화: Agumon (Mistakes [0, 3]), Betamon (Mistakes [4, 99])

#### Child (Rookie)
3. **Agumon** (ID: 3, Vaccine)
   - Power: 30, Min Weight: 20, Energy: 20
   - Hunger Loss: 48분, Strength Loss: 48분
   - Sleep: 20:00
   - 진화: Greymon, Devimon, Tyranomon, Meramon, Numemon (Fallback)

4. **Betamon** (ID: 4, Virus)
   - Power: 25, Min Weight: 20, Energy: 20
   - Hunger Loss: 38분, Strength Loss: 38분
   - Sleep: 21:00
   - 진화: Devimon, Meramon, Airdramon, Seadramon, Numemon (Fallback)

#### Adult (Champion)
5. **Greymon** (ID: 5, Vaccine)
   - Power: 50, Min Weight: 30, Energy: 30
   - Hunger Loss: 59분, Strength Loss: 59분
   - Sleep: 21:00
   - 진화: Metal Greymon (Virus) (Battles 15+, WinRatio 80%+)

6. **Devimon** (ID: 6, Virus)
   - Power: 50, Min Weight: 40, Energy: 30
   - Hunger Loss: 48분, Strength Loss: 48분
   - Sleep: 23:00
   - 진화: Metal Greymon (Virus) (Battles 15+, WinRatio 80%+)

7. **Airdramon** (ID: 7, Vaccine)
   - Power: 50, Min Weight: 30, Energy: 30
   - Hunger Loss: 38분, Strength Loss: 38분
   - Sleep: 23:00
   - 진화: Metal Greymon (Virus) (Battles 15+, WinRatio 80%+)

8. **Numemon** (ID: 8, Virus)
   - Power: 40, Min Weight: 10, Energy: 30
   - Hunger Loss: 28분, Strength Loss: 28분
   - Sleep: 00:00
   - 진화: Monzaemon (Battles 15+, WinRatio 80%+)

9. **Tyranomon** (ID: 9, Data)
   - Power: 45, Min Weight: 20, Energy: 30
   - Hunger Loss: 59분, Strength Loss: 59분
   - Sleep: 22:00
   - 진화: Mamemon (Battles 15+, WinRatio 80%+)

10. **Meramon** (ID: 10, Data)
    - Power: 45, Min Weight: 30, Energy: 30
    - Hunger Loss: 48분, Strength Loss: 48분
    - Sleep: 00:00
    - 진화: Mamemon (Battles 15+, WinRatio 80%+)

11. **Seadramon** (ID: 11, Data)
    - Power: 45, Min Weight: 20, Energy: 30
    - Hunger Loss: 38분, Strength Loss: 38분
    - Sleep: 23:00
    - 진화: Mamemon (Battles 15+, WinRatio 80%+)

#### Perfect (Ultimate)
12. **Metal Greymon (Virus)** (ID: 12, Virus)
    - Power: 100, Min Weight: 40, Energy: 40
    - Hunger Loss: 59분, Strength Loss: 59분
    - Sleep: 20:00
    - 진화: Blitz Greymon (Mistakes [0, 1], Battles 15+, WinRatio 80%+)

13. **Monzaemon** (ID: 13, Vaccine)
    - Power: 100, Min Weight: 40, Energy: 40
    - Hunger Loss: 48분, Strength Loss: 48분
    - Sleep: 21:00
    - 진화: Shin Monzaemon (Mistakes [0, 1], Battles 15+, WinRatio 80%+)

14. **Mamemon** (ID: 14, Data)
    - Power: 85, Min Weight: 5, Energy: 40
    - Hunger Loss: 59분, Strength Loss: 59분
    - Sleep: 23:00
    - 진화: Bancho Mamemon (Mistakes [0, 1], Battles 15+, WinRatio 80%+)

#### Ultimate
15. **Blitz Greymon** (ID: 15, Virus)
    - Power: 170, Min Weight: 50, Energy: 50
    - Hunger Loss: 59분, Strength Loss: 59분
    - Sleep: 23:00
    - 진화: Omegamon Alter-S (Jogress with Cres Garurumon)

16. **Shin Monzaemon** (ID: 16, Vaccine)
    - Power: 170, Min Weight: 40, Energy: 50
    - Hunger Loss: 48분, Strength Loss: 48분
    - Sleep: 23:00
    - 진화: [] (최종 단계)

17. **Bancho Mamemon** (ID: 17, Data)
    - Power: 150, Min Weight: 5, Energy: 50
    - Hunger Loss: 59분, Strength Loss: 59분
    - Sleep: 23:00
    - 진화: [] (최종 단계)

#### Super Ultimate
18. **Omegamon Alter-S** (ID: 18, Virus)
    - Power: 200, Min Weight: 40, Energy: 50
    - Hunger Loss: 66분, Strength Loss: 66분
    - Sleep: 23:00
    - 진화: [] (최종 단계)

#### Jogress 파트너
19. **Cres Garurumon** (ID: 19, Ultimate)
    - Placeholder (Jogress 파트너용)
    - Blitz Greymon과 조그레스하여 Omegamon Alter-S 진화

### 주요 변경 사항

1. **스탯 필드 정확 반영**
   - 모든 Hunger Loss / Strength Loss 값을 분 단위 정수로 변환
   - Sleep Time을 "HH:MM" 형식으로 저장
   - Power, Energy, Min Weight 값 정확히 반영

2. **진화 조건 우선순위**
   - 까다로운 진화 조건(상위 루트)을 배열 앞쪽에 배치
   - Numemon 같은 Fallback 진화를 맨 뒤에 배치
   - 조건 체크 순서가 진화 결과에 영향을 주도록 설계

3. **Perfect 단계 진화 조건**
   - Mistakes [0, 1] 조건 추가
   - Battles 15+, WinRatio 80%+ 조건 유지

4. **Jogress 진화 구현**
   - Blitz Greymon → Omegamon Alter-S (Jogress with Cres Garurumon)
   - `jogress: true` 플래그 및 `partner` 필드 추가

5. **최종 단계 디지몬**
   - Shin Monzaemon, Bancho Mamemon, Omegamon Alter-S는 `evolutionCriteria: null`, `evolutions: []`로 설정

### 데이터 소스
- 18장의 상세 스탯 카드 이미지 (사용자 제공)
- Ver.1 진화 트리 이미지 (사용자 제공)

### 관련 파일
- `digimon-tamagotchi-frontend/src/data/v1/digimons.js`
- `digimon-tamagotchi-frontend/src/data/v1/evolution.js` (향후 업데이트 필요)

---

## [2025-12-14] Ver.1 성장기/성숙기 데이터 및 진화 조건 입력

### 작업 유형
- 데이터 대량 추가
- 진화 트리 구현
- 스탯 데이터 업데이트

### 목적 및 영향
Ver.1 진화 트리 이미지를 기반으로 성장기(Child)와 성숙기(Adult) 디지몬들의 데이터를 대량 추가했습니다. 이미지에서 확인한 스탯 값(Power, Min Weight, Energy, Hunger Loss, Strength Loss 등)을 반영하고, 복잡한 진화 조건을 구현했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/data/v1/digimons.js` (대폭 수정)
  - **Agumon (Child)**: 스탯 업데이트 및 진화 조건 추가
    - Power: 30, Min Weight: 20, Energy: 20
    - Hunger Loss: 48분, Strength Loss: 48분
    - 진화 대상: Greymon, Tyranomon, Devimon, Meramon, Numemon (5가지 경로)
  - **Betamon (Child)**: 스탯 업데이트 및 진화 조건 추가
    - Power: 25, Min Weight: 20, Energy: 20
    - Hunger Loss: 38분, Strength Loss: 38분
    - 진화 대상: Airdramon, Seadramon, Devimon, Meramon, Numemon (5가지 경로)
  - **Greymon (Adult)**: 스탯 업데이트
    - Power: 50, Min Weight: 30, Energy: 30
    - Hunger Loss: 59분, Strength Loss: 59분
    - 진화 대상: Metal Greymon (Virus) (15+ Battles, 80%+ Win Ratio)
  - **Tyranomon (Adult)**: 신규 추가
    - Power: 45, Min Weight: 20, Energy: 30
    - Hunger Loss: 59분, Strength Loss: 59분
    - 진화 대상: Mamemon (15+ Battles, 80%+ Win Ratio)
  - **Meramon (Adult)**: 신규 추가
    - 진화 대상: Metal Greymon (Virus) (15+ Battles, 80%+ Win Ratio)
  - **Seadramon (Adult)**: 신규 추가
    - 진화 대상: Metal Greymon (Virus) (15+ Battles, 80%+ Win Ratio)
  - **Numemon (Adult)**: 신규 추가
    - Power: 40, Min Weight: 10, Energy: 30
    - Hunger Loss: 28분, Strength Loss: 28분
    - 진화 대상: Monzaemon (15+ Battles, 80%+ Win Ratio)
  - **Devimon (Adult)**: 신규 추가
    - Power: 50, Min Weight: 40, Energy: 30
    - Hunger Loss: 48분, Strength Loss: 48분
    - 진화 대상: Metal Greymon (Virus) (15+ Battles, 80%+ Win Ratio)
  - **Airdramon (Adult)**: 신규 추가
    - Power: 50, Min Weight: 30, Energy: 30
    - Hunger Loss: 38분, Strength Loss: 38분
    - 진화 대상: Metal Greymon (Virus) (15+ Battles, 80%+ Win Ratio)
  - **Metal Greymon (Virus) (Perfect)**: 신규 추가
  - **Mamemon (Perfect)**: 신규 추가
  - **Monzaemon (Perfect)**: 신규 추가

- `digimon-tamagotchi-frontend/src/data/v1/evolution.js` (대폭 수정)
  - **Agumon 진화 조건**: 9가지 경로 구현
    - Greymon: 0-3 Care Mistakes, 32+ Training
    - Tyranomon: 4+ Care Mistakes, 5-15 Training, 3+ Overfeed, 4-5 Sleep Disturbances
    - Devimon: 0-3 Care Mistakes, 0-31 Training
    - Meramon: 4+ Care Mistakes, 16+ Training, 3+ Overfeed, 6+ Sleep Disturbances
    - Numemon: 5가지 조건 (Choose one)
  - **Betamon 진화 조건**: 8가지 경로 구현
    - Airdramon: 4+ Care Mistakes, 8-31 Training, 0-3 Overfeed, 9+ Sleep Disturbances
    - Seadramon: 4+ Care Mistakes, 8-31 Training, 4+ Overfeed, 0-8 Sleep Disturbances
    - Devimon: 0-3 Care Mistakes, 48+ Training
    - Meramon: 0-3 Care Mistakes, 0-47 Training
    - Numemon: 4가지 조건 (Choose one)
  - **Adult → Perfect 진화 조건**: 모든 성숙기 디지몬에 15+ Battles, 80%+ Win Ratio 조건 추가
    - Greymon → Metal Greymon (Virus)
    - Tyranomon → Mamemon
    - Meramon → Metal Greymon (Virus)
    - Seadramon → Metal Greymon (Virus)
    - Numemon → Monzaemon
    - Devimon → Metal Greymon (Virus)
    - Airdramon → Metal Greymon (Virus)

### 진화 트리 구조

#### Child → Adult 진화 경로
1. **Agumon → Adult**
   - Greymon: 0-3 실수, 32+ 훈련
   - Tyranomon: 4+ 실수, 5-15 훈련, 3+ 오버피드, 4-5 수면 방해
   - Devimon: 0-3 실수, 0-31 훈련
   - Meramon: 4+ 실수, 16+ 훈련, 3+ 오버피드, 6+ 수면 방해
   - Numemon: 5가지 조건 중 하나 (실패 진화)

2. **Betamon → Adult**
   - Airdramon: 4+ 실수, 8-31 훈련, 0-3 오버피드, 9+ 수면 방해
   - Seadramon: 4+ 실수, 8-31 훈련, 4+ 오버피드, 0-8 수면 방해
   - Devimon: 0-3 실수, 48+ 훈련
   - Meramon: 0-3 실수, 0-47 훈련
   - Numemon: 4가지 조건 중 하나 (실패 진화)

#### Adult → Perfect 진화 조건
- 모든 성숙기 디지몬: 15+ 배틀, 80%+ 승률 필요

### 데이터 소스
- Ver.1 진화 트리 이미지 (사용자 제공)
- 각 디지몬의 상세 정보 카드 이미지 (Power, Min Weight, Energy, Hunger Loss, Strength Loss 등)

### 미완성 항목
- Perfect 단계 디지몬들의 스탯 값 (TODO 주석으로 표시)
- Ultimate, Super Ultimate 단계 디지몬 데이터 (향후 추가 예정)
- 일부 디지몬의 sprite 번호 (0으로 임시 설정, TODO 주석으로 표시)

### 관련 파일
- `digimon-tamagotchi-frontend/src/data/v1/digimons.js`
- `digimon-tamagotchi-frontend/src/data/v1/evolution.js`
- `digimon-tamagotchi-frontend/src/logic/evolution/checker.js` (기존 로직 활용)

---

## [2025-12-14] Botamon/Koromon 초기 진화 데이터 입력

### 작업 유형
- 데이터 입력
- 에러 핸들링 개선
- 버그 수정

### 목적 및 영향
Botamon과 Koromon의 진화 데이터를 추가하고, 진화 체커에서 디지몬 이름을 찾을 수 없을 때의 예외 처리를 개선했습니다. "N/A" 대신 정상적인 피드백이 표시되도록 수정했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/data/v1/digimons.js` (수정)
  - **Botamon**: `evolutions` 배열 추가
    - Koromon으로 진화 (10분 후, `timeToEvolveSeconds: 600`)
  - **Koromon**: `evolutions` 배열 추가
    - Agumon으로 진화 (실수 0~3회)
    - Betamon으로 진화 (실수 4회 이상)
  - **Agumon, Betamon**: 기본 데이터 확인 (이미 존재함)

- `digimon-tamagotchi-frontend/src/logic/evolution/checker.js` (수정)
  - `checkEvolution` 함수에 `digimonDataMap` 파라미터 추가 (5번째 인자)
  - `targetName` 찾기 로직에 예외 처리 추가:
    - `digimonDataMap`에서 디지몬 데이터 찾기
    - 찾을 수 없으면 `"Unknown Digimon (ID: ${targetName})"` 형식으로 표시
    - "N/A" 대신 구체적인 정보 제공

- `digimon-tamagotchi-frontend/src/pages/Game.jsx` (수정)
  - `checkEvolution` 호출 시 `digimonDataVer1`을 5번째 인자로 전달
  - 진화 성공 시 `targetName`을 올바르게 표시하도록 수정

### 진화 데이터 구조

#### Botamon → Koromon
```javascript
evolutions: [
  {
    targetId: "Koromon",
    targetName: "Koromon",
    condition: {
      type: "time",
      value: 600, // 10분 = 600초
    },
  },
]
```

#### Koromon → Agumon / Betamon
```javascript
evolutions: [
  {
    targetId: "Agumon",
    targetName: "Agumon",
    condition: {
      type: "mistakes",
      value: [0, 3], // 실수 0~3회
    },
  },
  {
    targetId: "Betamon",
    targetName: "Betamon",
    condition: {
      type: "mistakes",
      value: [4, 99], // 실수 4회 이상
    },
  },
]
```

### 에러 핸들링 개선

#### Before
- 디지몬 이름을 찾을 수 없을 때 "N/A" 표시
- 구체적인 정보 부족

#### After
- `digimonDataMap`에서 디지몬 데이터 찾기
- 찾을 수 없으면 `"Unknown Digimon (ID: ${targetId})"` 형식으로 표시
- 구체적인 ID 정보 제공

### 버그 수정

#### 문제
- 진화 버튼 클릭 시 "N/A" 표시
- 시간 부족 시 정상적인 피드백이 표시되지 않음

#### 해결
- `targetName` 찾기 로직에 예외 처리 추가
- `digimonDataMap`을 통해 디지몬 이름 정확히 찾기
- Fallback 처리로 항상 의미 있는 정보 제공

### 테스트 시나리오

1. **Botamon 진화 테스트**:
   - Botamon 선택 후 10분 대기
   - Evolution 버튼 클릭
   - "디지몬 진화~~~! 🎉 곧 Koromon으로 변신합니다!" 메시지 확인

2. **시간 부족 테스트**:
   - Botamon 선택 후 5분 대기
   - Evolution 버튼 클릭
   - "아직 진화할 준비가 안 됐어! 남은 시간: 5분 0초" 메시지 확인

3. **조건 부족 테스트**:
   - Koromon 선택 후 실수 5회 발생
   - Evolution 버튼 클릭
   - "진화 조건을 만족하지 못했어! [부족한 조건] ..." 메시지 확인

### 다음 단계
1. 모든 디지몬의 `evolutions` 배열 추가
2. 진화 조건 타입 확장 (time, mistakes 외 추가)
3. 진화 애니메이션 및 효과 추가

---

## [2025-12-14] 진화 상세 피드백 구현 및 Lifespan 버그 수정

### 작업 유형
- 진화 로직 고도화
- 사용자 피드백 시스템
- 버그 수정

### 목적 및 영향
진화 시도 시 사용자에게 상세한 피드백을 제공하고, Lifespan이 버튼 클릭에 의해 수정되지 않도록 보장했습니다. 진화 실패 시 구체적인 사유를 알려주어 사용자가 무엇이 부족한지 명확히 알 수 있게 했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/logic/evolution/checker.js` (수정)
  - `checkEvolution` 함수가 단순 ID 반환이 아닌 상세 결과 객체를 반환하도록 변경
  - 반환 형식:
    - 성공: `{ success: true, reason: "SUCCESS", targetId: "..." }`
    - 시간 부족: `{ success: false, reason: "NOT_READY", remainingTime: ... }`
    - 조건 불만족: `{ success: false, reason: "CONDITIONS_UNMET", details: [...] }`
  - 각 진화 후보별로 조건 체크 및 실패 사유 분석
  - `details` 배열에 각 후보별 부족한 조건 상세 정보 포함

- `digimon-tamagotchi-frontend/src/pages/Game.jsx` (수정)
  - `handleEvolutionButton`: 진화 결과 객체를 처리하여 상세 피드백 제공
    - 성공 시: `alert("디지몬 진화~~~! 🎉\n\n곧 ${targetName}으로 변신합니다!")`
    - 시간 부족 시: `alert("아직 진화할 준비가 안 됐어!\n\n남은 시간: ${mm}분 ${ss}초")`
    - 조건 부족 시: `alert("진화 조건을 만족하지 못했어!\n\n[부족한 조건]\n${detailsText}")`
  - Lifespan 버그 수정: `handleEvolutionButton` 내부에서 `lifespanSeconds`를 수정하는 로직이 없음을 확인 (이미 올바르게 구현됨)

### 진화 피드백 시스템

#### 결과 객체 구조
```javascript
// 성공
{
  success: true,
  reason: "SUCCESS",
  targetId: "Greymon"
}

// 시간 부족
{
  success: false,
  reason: "NOT_READY",
  remainingTime: 3600 // 초 단위
}

// 조건 불만족
{
  success: false,
  reason: "CONDITIONS_UNMET",
  details: [
    {
      target: "Greymon",
      missing: "배틀 (현재: 0, 필요: 15), 승률 (현재: 0%, 필요: 40%)"
    }
  ]
}
```

#### 체크하는 조건들
- 실수 (mistakes): 범위 체크
- 오버피드 (overfeeds): 범위 체크
- 배틀 (battles): 최소값 체크
- 승률 (winRatio): 최소값 체크
- 훈련 (trainings): 최소값 체크
- 체중 (minWeight): 최소값 체크
- 힘 (minStrength): 최소값 체크
- 노력치 (minEffort): 최소값 체크
- 속성 (requiredType): 필수 속성 체크

### 사용자 피드백

#### 성공 메시지
```
디지몬 진화~~~! 🎉

곧 Greymon으로 변신합니다!
```

#### 시간 부족 메시지
```
아직 진화할 준비가 안 됐어!

남은 시간: 60분 30초
```

#### 조건 부족 메시지
```
진화 조건을 만족하지 못했어!

[부족한 조건]
• Greymon: 배틀 (현재: 0, 필요: 15), 승률 (현재: 0%, 필요: 40%)
• Betamon: 실수 (현재: 2, 필요: 최대 3)
```

### Lifespan 버그 수정

#### 확인 사항
- `handleEvolutionButton` 내부에서 `lifespanSeconds`를 직접 수정하는 로직이 없음을 확인
- `lifespanSeconds`는 오직 `useEffect`의 `setInterval` 타이머에서만 증가
- `applyLazyUpdateBeforeAction`은 마지막 저장 시간부터 현재까지의 경과 시간을 계산하여 스탯을 업데이트하지만, `lifespanSeconds`는 정상적으로 증가함

#### 보장 사항
- 버튼 클릭이 `lifespanSeconds`에 직접적인 영향을 주지 않음
- `lifespanSeconds`는 시간 경과에 따라만 증가

### 장점
1. **사용자 경험 향상**: 진화 실패 시 구체적인 사유를 알 수 있어 다음 행동 계획 수립 가능
2. **디버깅 용이**: 개발자가 진화 조건을 쉽게 확인 가능
3. **명확한 피드백**: 시간 부족, 조건 부족 등 상황별로 명확한 메시지 제공
4. **버그 수정**: Lifespan이 버튼 클릭에 의해 수정되지 않음을 보장

### 다음 단계
1. 진화 애니메이션 추가
2. 진화 성공 시 특별 효과 추가
3. 진화 조건을 UI에 표시 (진화 가능 여부 미리 보기)

---

## [2025-12-14] DMC 스타일 진화 판정 엔진 구현

### 작업 유형
- 진화 로직 구현
- 매뉴얼 규칙 적용
- 코드 리팩토링

### 목적 및 영향
Digital Monster Color 매뉴얼 규칙을 기반으로 한 진화 판정 엔진을 구현했습니다. 기존의 단순한 진화 로직을 매뉴얼의 복합 조건(mistakes, overfeeds, battles, winRatio, training 등)을 정확히 체크하는 시스템으로 교체했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/logic/evolution/checker.js` (신규)
  - `checkEvolution`: 매뉴얼 기반 진화 판정 함수
    - 1단계: 시간 체크 (`timeToEvolveSeconds`가 0 이하인지 확인)
    - 2단계: 조건 매칭 (mistakes, overfeeds, battles, winRatio, training, minWeight, minStrength, minEffort, requiredType)
    - 3단계: 진화 대상 반환 (조건을 만족하는 첫 번째 진화 대상의 ID 반환)
  - `findEvolutionTarget`: 진화 대상 찾기 함수 (기존 로직과의 호환성 유지)

- `digimon-tamagotchi-frontend/src/logic/evolution/index.js` (수정)
  - `checkEvolution`, `findEvolutionTarget` export 추가

- `digimon-tamagotchi-frontend/src/pages/Game.jsx` (수정)
  - `handleEvolutionButton`: `checkEvolution` 함수 사용하도록 변경
  - `handleEvolution`: 진화 성공 시 스탯 리셋 로직 추가
    - `careMistakes`, `overfeeds`, `battlesForEvolution`, `proteinOverdose`, `injuries`, `trainings`, `sleepDisturbances`, `trainingCount` 리셋

### 진화 판정 로직

#### 체크하는 조건들
1. **시간 체크**: `timeToEvolveSeconds`가 0 이하인지 확인
2. **mistakes**: 범위 체크 (min/max)
3. **overfeeds**: 범위 체크 (단일 값 또는 배열)
4. **battles**: 최소값 체크 (총 배틀 횟수)
5. **winRatio**: 최소값 체크 (승률 %)
6. **trainings**: 최소값 체크 (훈련 횟수)
7. **minWeight**: 최소 체중 체크
8. **minStrength**: 최소 힘 체크
9. **minEffort**: 최소 노력치 체크
10. **requiredType**: 필수 속성 체크

#### 진화 대상 결정
- 조건을 모두 만족하면 `evolutionConditionsVer1`에서 진화 대상을 찾음
- 조건을 만족하는 첫 번째 진화 대상의 ID를 반환
- 조건을 만족하는 대상이 없으면 `null` 반환

### 진화 시 스탯 리셋

매뉴얼 규칙에 따라 진화 시 다음 스탯이 리셋됩니다:
- `careMistakes`: 0
- `overfeeds`: 0
- `battlesForEvolution`: 0
- `proteinOverdose`: 0
- `injuries`: 0
- `trainings`: 0
- `sleepDisturbances`: 0
- `trainingCount`: 0

진화 시 유지되는 스탯:
- `energy`
- `battles`
- `battlesWon`
- `battlesLost`
- `winRate`

### 코드 구조 개선

#### Before (기존 로직)
```javascript
// 단순 조건 체크
for(let e of evo.evolution){
  if(e.condition.check(test)){
    await handleEvolution(e.next);
    return;
  }
}
```

#### After (매뉴얼 기반)
```javascript
// 매뉴얼 기반 복합 조건 체크
const evolutionTarget = checkEvolution(
  updatedStats, 
  currentDigimonData, 
  evolutionConditionsVer1, 
  selectedDigimon
);
if(evolutionTarget) {
  await handleEvolution(evolutionTarget);
}
```

### 장점
1. **매뉴얼 규칙 정확 반영**: 복합 조건을 정확히 체크
2. **코드 재사용성**: 순수 함수로 구현되어 테스트 및 재사용 용이
3. **유지보수성 향상**: 진화 조건이 명확하게 분리됨
4. **확장성**: 새로운 진화 조건 추가가 쉬움

### 다음 단계
1. 모든 디지몬의 진화 조건을 `digimons.js`에 추가
2. 진화 조건 테스트 코드 작성
3. 진화 애니메이션 및 효과 추가

---

## [2025-12-14] 스탯 데이터 구조 확장(Energy, Overdose 등) 및 UI 반영

### 작업 유형
- 데이터 구조 확장
- UI 업데이트
- 초기화 로직 수정

### 목적 및 영향
매뉴얼 기반 로직을 지원하기 위해 스탯 데이터 구조를 확장하고, 개발자가 확인할 수 있도록 UI에 반영했습니다. Energy(DP), Protein Overdose, Overfeed Count, Battles/Wins 등의 필드를 추가하여 매뉴얼 규칙을 정확히 구현할 수 있는 기반을 마련했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/data/defaultStatsFile.js` (수정)
  - `energy: 0` 추가 - 매뉴얼의 DP 개념 (기존 stamina와 병행)
  - `proteinOverdose: 0` 추가 - 프로틴 과다 복용 횟수 (최대 7)
  - `overfeeds: 0` 추가 - 오버피드 횟수 누적
  - `battles: 0` 추가 - 총 배틀 횟수 (진화 조건용)
  - `battlesWon: 0` 추가 - 총 승리 횟수 (진화 조건용)
  - `battlesLost: 0` 추가 - 총 패배 횟수 (진화 조건용)
  - `battlesForEvolution: 0` 추가 - 진화를 위한 배틀 횟수 (진화 시 리셋)

- `digimon-tamagotchi-frontend/src/components/StatsPanel.jsx` (수정)
  - `Stamina` 라벨을 `Energy (DP)`로 변경
  - `energy` 필드 표시 (stamina가 없으면 energy 사용)
  - 개발자용 정보 섹션 추가:
    - Protein Overdose
    - Overfeeds
    - Battles
    - Wins / Losses

- `digimon-tamagotchi-frontend/src/components/StatsPopup.jsx` (수정)
  - `Stamina` 라벨을 `Energy (DP)`로 변경
  - 매뉴얼 기반 필드 섹션 추가:
    - Protein Overdose
    - Overfeeds
    - Battles
    - Battles Won / Lost
    - Battles for Evolution

- `digimon-tamagotchi-frontend/src/data/stats.js` (수정)
  - `initializeStats` 함수에서 새 필드 초기화 로직 추가:
    - 진화 시 리셋되는 필드: `overfeeds`, `proteinOverdose`, `battlesForEvolution`, `careMistakes`
    - 진화 시 유지되는 필드: `energy`, `battles`, `battlesWon`, `battlesLost`, `winRate`

### 데이터 구조 확장

#### 추가된 필드
```javascript
{
  // 매뉴얼 기반 필드
  energy: 0,              // Energy/DP (기존 stamina와 병행)
  proteinOverdose: 0,     // 프로틴 과다 복용 횟수 (최대 7)
  overfeeds: 0,           // 오버피드 횟수 누적
  battles: 0,             // 총 배틀 횟수
  battlesWon: 0,          // 총 승리 횟수
  battlesLost: 0,         // 총 패배 횟수
  battlesForEvolution: 0, // 진화를 위한 배틀 횟수 (진화 시 리셋)
}
```

#### 초기화 로직
- **진화 시 리셋**: `overfeeds`, `proteinOverdose`, `battlesForEvolution`, `careMistakes`
- **진화 시 유지**: `energy`, `battles`, `battlesWon`, `battlesLost`, `winRate`

### UI 업데이트

#### StatsPanel.jsx
- Energy (DP) 표시 (stamina 대신 energy 우선 사용)
- 개발자용 정보 섹션 추가 (Protein Overdose, Overfeeds, Battles, Wins/Losses)

#### StatsPopup.jsx
- Energy (DP) 표시
- 매뉴얼 기반 필드 섹션 추가

### 호환성
- 기존 `stamina` 필드는 유지되어 하위 호환성 보장
- `energy`가 없으면 `stamina`를 사용하도록 fallback 처리

### 다음 단계
1. 배틀 시스템 구현 시 `battles`, `battlesWon`, `battlesLost` 필드 활용
2. 진화 조건 체크 시 `overfeeds`, `battlesForEvolution` 필드 활용
3. 프로틴 먹이기 로직에서 `proteinOverdose` 필드 활용 (이미 구현됨)
4. 오버피드 로직에서 `overfeeds` 필드 활용 (이미 구현됨)

---

## [2025-12-14] 스탯 로직(Hunger/Strength) 모듈화 및 매뉴얼 규칙 적용

### 작업 유형
- 로직 모듈화
- 매뉴얼 규칙 적용
- 코드 리팩토링

### 목적 및 영향
Game.jsx에 하드코딩되어 있던 배고픔/힘 감소 로직을 매뉴얼 기반 순수 함수로 모듈화했습니다. 오버피드, 프로틴 효과 등 매뉴얼 규칙을 정확히 반영하여 게임 로직의 정확성과 유지보수성을 향상시켰습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/logic/stats/hunger.js` (수정)
  - `handleHungerTick`: 시간 경과에 따른 배고픔 감소 처리
    - 오버피드 상태면 감소 지연 로직 포함 (매뉴얼: "Overfeeding will give you one extra Hunger Loss cycle")
    - 배고픔이 0이 되면 시간 기록
  - `feedMeat`: 고기 먹기 처리
    - Hunger +1, Weight +1 (매뉴얼 규칙)
    - 배고픔이 가득 찬 상태에서 10개 더 먹으면 오버피드 발생
    - 오버피드 카운트 추적
  - `willRefuseMeat`: 고기 거부 체크

- `digimon-tamagotchi-frontend/src/logic/stats/strength.js` (신규)
  - `handleStrengthTick`: 시간 경과에 따른 힘 감소 처리
    - 힘이 0이 되면 시간 기록
  - `feedProtein`: 프로틴 먹기 처리
    - Strength +1, Weight +2 (매뉴얼 규칙)
    - 4개마다 Energy +1, Protein Overdose +1 (매뉴얼 규칙)
  - `willRefuseProtein`: 프로틴 거부 체크

- `digimon-tamagotchi-frontend/src/logic/stats/index.js` (수정)
  - `handleHungerTick`, `feedMeat`, `willRefuseMeat` export 추가
  - `handleStrengthTick`, `feedProtein`, `willRefuseProtein` export 추가

- `digimon-tamagotchi-frontend/src/pages/Game.jsx` (수정)
  - 클라이언트 타이머에서 `handleHungerTick`, `handleStrengthTick` 사용
  - `handleFeed` 함수에서 `willRefuseMeat`, `willRefuseProtein` 사용
  - `applyEatResult` 함수를 `feedMeat`, `feedProtein` 사용하도록 변경
  - 배고픔/힘이 0이고 12시간 경과 시 사망 체크 로직 추가

- `digimon-tamagotchi-frontend/src/data/stats.js` (수정)
  - `updateLifespan` 함수에서 배고픔/힘 감소 로직 제거
  - 이제 `lifespanSeconds`, `timeToEvolveSeconds`, `poop`만 처리
  - 배고픔/힘 감소는 `handleHungerTick`, `handleStrengthTick`에서 처리

### 매뉴얼 규칙 적용

#### 배고픔 (Hunger)
- **고기 먹기**: Hunger +1, Weight +1
- **오버피드**: 배고픔이 가득 찬 상태(5)에서 10개 더 먹으면 오버피드 발생
- **오버피드 효과**: "Overfeeding will give you one extra Hunger Loss cycle before one of your hearts drop"
- **거부**: 배고픔이 최대치(5 + maxOverfeed)에 도달하면 거부

#### 힘 (Strength)
- **프로틴 먹기**: Strength +1, Weight +2
- **프로틴 효과**: 4개마다 Energy +1, Protein Overdose +1 (최대 7)
- **거부**: 힘과 배고픔이 모두 가득 찬 경우 거부

### 코드 구조 개선

#### Before (하드코딩)
```javascript
// Game.jsx 내부
function applyEatResult(old, type) {
  let s = {...old};
  const limit = 5 + (s.maxOverfeed || 0);
  if(type === "meat") {
    if(s.fullness < limit) {
      s.fullness++;
      s.weight++;
    }
  } else {
    // ...
  }
  return s;
}
```

#### After (모듈화)
```javascript
// logic/stats/hunger.js
export function feedMeat(currentStats) {
  // 매뉴얼 규칙 정확히 반영
  // 오버피드 로직 포함
}

// Game.jsx
function applyEatResult(old, type) {
  if(type === "meat") {
    const result = feedMeat(old);
    return result.updatedStats;
  } else {
    const result = feedProtein(old);
    return result.updatedStats;
  }
}
```

### 장점
1. **매뉴얼 규칙 정확 반영**: 오버피드, 프로틴 효과 등이 정확히 구현됨
2. **코드 재사용성**: 순수 함수로 구현되어 테스트 및 재사용 용이
3. **유지보수성 향상**: 로직이 모듈화되어 수정 및 확장이 쉬움
4. **일관성**: 모든 곳에서 동일한 로직 사용

### 주의사항
- `applyLazyUpdate` 함수는 아직 기존 로직을 사용 중 (별도 리팩토링 필요)
- `updateLifespan`에서 배고픔/힘 감소 로직을 제거했으므로, 다른 곳에서 사용 시 주의 필요

### 다음 단계
1. `applyLazyUpdate` 함수도 새 로직을 사용하도록 리팩토링
2. 배고픔/힘이 0이고 12시간 경과 시 사망 로직을 `handleHungerTick`, `handleStrengthTick` 내부로 이동
3. 테스트 코드 작성

---

## [2025-12-14] 데이터 소스 마이그레이션 (v1)

### 작업 유형
- 데이터 소스 변경
- 호환성 어댑터 구현
- 점진적 마이그레이션

### 목적 및 영향
Game.jsx에서 옛날 데이터 파일(`digimondata_digitalmonstercolor25th_ver1.js`) 대신 새로 만든 데이터 파일(`data/v1/digimons.js`)을 사용하도록 변경했습니다. 기존 코드와의 호환성을 위해 어댑터 패턴을 적용하여 필드명 차이를 해결했습니다.

### 변경된 파일
- `digimon-tamagotchi-frontend/src/data/v1/adapter.js` (신규)
  - 새 데이터 구조를 옛날 구조로 변환하는 호환성 어댑터
  - `adaptNewDataToOldFormat`: 단일 디지몬 데이터 변환
  - `adaptDataMapToOldFormat`: 전체 데이터 맵 변환
  - 필드 매핑:
    - `sprite` → `sprite` (동일)
    - `stage` → `evolutionStage`
    - `evolutionCriteria.timeToEvolveSeconds` → `timeToEvolveSeconds`
    - `stats.hungerCycle` → `hungerTimer`
    - `stats.strengthCycle` → `strengthTimer`
    - `stats.poopCycle` → `poopTimer`
    - `stats.maxOverfeed` → `maxOverfeed`
    - `stats.minWeight` → `minWeight`
    - `stats.maxEnergy` → `maxStamina`

- `digimon-tamagotchi-frontend/src/pages/Game.jsx` (수정)
  - 옛날 데이터 import 제거: `import { digimonDataVer1 } from "../data/digimondata_digitalmonstercolor25th_ver1"`
  - 새 데이터 import 추가: `import { digimonDataVer1 as newDigimonDataVer1 } from "../data/v1/digimons"`
  - 어댑터 import: `import { adaptDataMapToOldFormat } from "../data/v1/adapter"`
  - 어댑터를 통해 변환된 데이터 사용: `const digimonDataVer1 = adaptDataMapToOldFormat(newDigimonDataVer1)`

### 호환성 전략
- **어댑터 패턴 적용**: 새 데이터 구조를 옛날 구조로 변환하여 기존 코드 수정 최소화
- **점진적 마이그레이션**: Game.jsx의 다른 부분은 수정하지 않고, 데이터 소스만 변경
- **필드 매핑**: 새 구조의 중첩된 객체(`stats`, `evolutionCriteria`)를 옛날 구조의 평면 필드로 변환

### 장점
1. **코드 수정 최소화**: Game.jsx의 대부분 코드를 수정하지 않고 데이터 소스만 변경
2. **기존 기능 유지**: 어댑터를 통해 기존 로직이 그대로 작동
3. **점진적 마이그레이션**: 나중에 Game.jsx를 새 구조에 맞게 리팩토링 가능
4. **데이터 소스 통일**: 새로 만든 매뉴얼 기반 데이터 구조 사용

### 단점
1. **중간 변환 단계**: 어댑터를 통해 변환하므로 약간의 성능 오버헤드 (무시 가능한 수준)
2. **임시 해결책**: 어댑터는 임시 해결책이며, 장기적으로는 Game.jsx를 새 구조에 맞게 리팩토링 필요
3. **필드 매핑 복잡도**: 새 구조와 옛날 구조의 차이로 인한 매핑 로직 필요

### 예상 문제점 및 해결 방안
1. **누락된 필드**: 새 데이터에 없는 필드가 옛날 코드에서 사용될 경우
   - 해결: 어댑터에서 기본값(0 또는 null) 반환
2. **타입 불일치**: 새 데이터의 타입이 옛날 코드와 다를 경우
   - 해결: 어댑터에서 타입 변환 처리
3. **데이터 불완전성**: 새 데이터에 일부 디지몬이 아직 추가되지 않은 경우
   - 해결: 어댑터에서 null 체크 및 fallback 처리
4. **진화 조건 차이**: 새 구조의 `evolutionCriteria`가 옛날 구조와 다를 경우
   - 해결: `evolutionConditionsVer1`은 여전히 옛날 파일 사용 (별도 마이그레이션 필요)

### 테스트 필요 사항
- [ ] 게임 화면에서 디지몬이 정상적으로 표시되는지 확인
- [ ] 진화 기능이 정상 작동하는지 확인
- [ ] 스탯 업데이트가 정상 작동하는지 확인
- [ ] 먹이기, 훈련 등 모든 기능이 정상 작동하는지 확인

### 다음 단계
1. Game.jsx를 새 데이터 구조에 맞게 전면 리팩토링 (어댑터 제거)
2. `evolutionConditionsVer1`도 새 구조로 마이그레이션
3. 다른 컴포넌트들도 새 데이터 구조 사용하도록 변경

---

## [2025-12-14] 폴더 구조 재설계 및 매뉴얼 기반 데이터 스키마 정의

### 작업 유형
- 프로젝트 구조 재설계
- 데이터 스키마 정의
- 로직 모듈화
- 문서화

### 목적 및 영향
Digital Monster Color 매뉴얼을 기반으로 프로젝트 구조를 재설계하고, 상세한 데이터 스키마와 로직 모듈을 정의했습니다:
- 버전별/기능별 폴더 구조로 코드 조직화
- 매뉴얼 기반 상세 데이터 스키마 정의
- 로직 모듈화로 유지보수성 향상
- Humulos 스타일 복잡한 육성 시스템 구현을 위한 기반 마련

### 변경된 파일
- **새 폴더 구조 생성**:
  - `src/data/v1/` - Ver.1 데이터 파일들
  - `src/logic/stats/` - 스탯 관리 로직
  - `src/logic/food/` - 음식 관련 로직
  - `src/logic/training/` - 훈련 관련 로직
  - `src/logic/battle/` - 배틀 관련 로직
  - `src/logic/evolution/` - 진화 관련 로직

- `docs/DIGITAL_MONSTER_COLOR_MANUAL.md` (신규)
  - Digital Monster Color 공식 매뉴얼을 마크다운 형식으로 저장
  - 모든 게임 메커니즘 문서화

- `src/data/v1/defaultStats.js` (신규)
  - 매뉴얼 기반 기본 스탯 정의
  - 표시되는 스탯: age, weight, hunger, strength, effort, energy, winRatio
  - 숨겨진 스탯: type, power, basePower, careMistakes, proteinOverdose, injuries 등
  - 진화 시 리셋되는 스탯: trainings, overfeeds, sleepDisturbances, battlesForEvolution 등

- `src/data/v1/digimons.js` (신규)
  - 매뉴얼 기반 상세 디지몬 데이터 스키마
  - 필수 필드: id, name, stage, sprite
  - stats 객체: hungerCycle, strengthCycle, poopCycle, maxOverfeed, basePower, maxEnergy, minWeight, type
  - evolutionCriteria 객체: mistakes, trainings, overfeeds, battles, winRatio, minWeight, minStrength, minEffort, requiredType

- `src/data/v1/evolution.js` (신규)
  - 매뉴얼 기반 진화 조건 정의
  - 복합 조건 체크 함수 구조

- `src/logic/stats/stats.js` (신규)
  - 스탯 초기화 및 업데이트 로직
  - initializeStats, updateLifespan, updateAge, applyLazyUpdate 함수

- `src/logic/stats/hunger.js` (신규)
  - 배고픔 관리 로직
  - feedMeat, checkOverfeed, decreaseHunger 함수

- `src/logic/food/meat.js` (신규)
  - 고기 먹이기 로직
  - 매뉴얼: "add one heart to the hunger meter, and add one gigabyte to their weight"
  - 오버피드 체크: "feeding 10 more meat after having full hearts"

- `src/logic/food/protein.js` (신규)
  - 프로틴 먹이기 로직
  - 매뉴얼: "add one heart to the strength meter and two gigabytes to their weight"
  - "Every four Protein will increase your Energy and Protein Overdose by 1 each"

- `src/logic/training/train.js` (신규)
  - 훈련 로직 (Ver.1-Ver.5)
  - 매뉴얼: "Every four trainings will add one Effort Heart"
  - "Your Digimon will also lose 1 gigabyte of weight every time they train"
  - "If training is successful, you will also gain a strength heart"

- `src/logic/battle/hitrate.js` (신규)
  - 배틀 히트레이트 계산 로직
  - 매뉴얼 공식: `hitrate = ((playerPower * 100)/(playerPower + opponentPower)) + attributeAdvantage`
  - 속성 상성 계산: Vaccine > Virus > Data > Vaccine
  - 파워 계산: Base Power + Strength Hearts 보너스 + Traited Egg 보너스
  - 부상 확률 계산: 승리 20%, 패배 10% + (프로틴 과다 * 10%)

- `src/logic/evolution/index.js` (신규)
  - 진화 조건 체크 로직
  - 매뉴얼 기반 복합 조건 체크: mistakes, trainings, overfeeds, battles, winRatio, minWeight, minStrength, minEffort, requiredType

- 각 폴더의 `index.js` 파일들 (신규)
  - 통합 export를 위한 인덱스 파일

### 새로운 폴더 구조
```
src/
  data/
    v1/
      defaultStats.js      # 기본 스탯 정의
      digimons.js          # 디지몬 데이터 스키마
      evolution.js         # 진화 조건 정의
      index.js             # 통합 export
    # 기존 파일들은 호환성을 위해 유지
  
  logic/
    stats/
      stats.js             # 스탯 관리 로직
      hunger.js            # 배고픔 관리 로직
      index.js             # 통합 export
    food/
      meat.js              # 고기 먹이기 로직
      protein.js           # 프로틴 먹이기 로직
      index.js             # 통합 export
    training/
      train.js             # 훈련 로직 (Ver.1-Ver.5)
      index.js             # 통합 export
    battle/
      hitrate.js           # 배틀 히트레이트 계산
      index.js             # 통합 export
    evolution/
      index.js             # 진화 조건 체크 로직
```

### 데이터 스키마 정의

#### 디지몬 데이터 스키마 (digimons.js)
```javascript
{
  id: "Agumon",
  name: "Agumon",
  stage: "Child",
  sprite: 240,
  stats: {
    hungerCycle: 5,        // 배고픔 감소 주기 (분)
    strengthCycle: 5,      // 힘 감소 주기 (분)
    poopCycle: 120,        // 똥 생성 주기 (분, Stage별로 다름)
    maxOverfeed: 4,        // 최대 오버피드 허용치
    basePower: 0,          // 기본 파워
    maxEnergy: 100,        // 최대 에너지 (DP)
    minWeight: 10,         // 최소 체중
    type: "Vaccine",       // 속성
  },
  evolutionCriteria: {
    timeToEvolveSeconds: 86400,  // 24시간
    mistakes: { max: 3 },          // 실수 3개 이하
    battles: 15,                  // 최소 15번 배틀
    winRatio: 40,                 // 최소 40% 승률
    // ... 기타 조건
  },
}
```

#### 기본 스탯 스키마 (defaultStats.js)
- **표시되는 스탯**: age, weight, hunger, strength, effort, energy, winRatio
- **숨겨진 스탯**: type, power, basePower, careMistakes, proteinOverdose, injuries, battlesWon, battlesLost
- **진화 시 리셋**: trainings, overfeeds, sleepDisturbances, battlesForEvolution, careMistakes, proteinOverdose, injuries

### 로직 모듈화

#### Stats 로직 (logic/stats/)
- `stats.js`: 스탯 초기화 및 시간 경과 처리
- `hunger.js`: 배고픔 관리 (고기 먹기, 오버피드 체크)

#### Food 로직 (logic/food/)
- `meat.js`: 고기 먹이기 (배고픔 +1, 체중 +1, 오버피드 체크)
- `protein.js`: 프로틴 먹이기 (힘 +1, 체중 +2, 4개당 Energy +1, Protein Overdose +1)

#### Training 로직 (logic/training/)
- `train.js`: Ver.1-Ver.5 훈련 로직
- Ver.1: 5라운드 중 3회 이상 성공 시 훈련 성공
- 4회 훈련마다 effort +1
- 훈련 시 체중 -1 (성공 시 힘 +1/+3)

#### Battle 로직 (logic/battle/)
- `hitrate.js`: 히트레이트 계산, 속성 상성, 파워 계산, 부상 확률

#### Evolution 로직 (logic/evolution/)
- `index.js`: 복합 진화 조건 체크 (mistakes, trainings, overfeeds, battles, winRatio 등)

### 매뉴얼 반영 사항

#### Status 섹션
- Age, Weight, Hunger, Strength, Effort, Energy, Win Ratio 구현
- Type (속성), Power, Care Mistakes, Protein Overdose 구현

#### Food 섹션
- Meat: 배고픔 +1, 체중 +1, 오버피드 로직
- Protein: 힘 +1, 체중 +2, 4개당 Energy +1, Protein Overdose +1

#### Training 섹션
- Ver.1 훈련 로직 구현
- 4회 훈련마다 effort +1
- 훈련 시 체중 감소, 성공 시 힘 증가

#### Battles 섹션
- 히트레이트 공식 구현
- 속성 상성 계산 (Vaccine > Virus > Data > Vaccine)
- 파워 보너스 계산 (Strength Hearts, Traited Egg)
- 부상 확률 계산

#### Evolution 섹션
- 진화 시간표 반영 (8초, 10분, 12시간, 24시간, 36시간, 48시간)
- 복합 진화 조건 구조 정의 (mistakes, trainings, overfeeds, battles, winRatio 등)

### 호환성 유지
- 기존 파일들은 호환성을 위해 유지
- 새 구조와 기존 구조를 병행 사용 가능
- 점진적 마이그레이션 가능

### 다음 단계
1. 기존 코드의 import 경로를 새 구조로 점진적 변경
2. 매뉴얼의 모든 디지몬 데이터 추가
3. 진화 조건 로직 완전 구현
4. 배틀 시스템 구현
5. 자동 진화 시스템 구현

### 참고사항
- 매뉴얼은 `docs/DIGITAL_MONSTER_COLOR_MANUAL.md`에 저장
- 새 스키마는 매뉴얼의 모든 규칙을 반영하도록 설계
- 로직 모듈은 매뉴얼의 각 섹션(Status, Food, Training, Battles)을 기반으로 구성
- 기존 코드와의 호환성을 위해 기존 파일 유지

---

## [2025-12-14] 클라이언트 타이머 도입 및 실시간 UI 업데이트 구현

### 작업 유형
- 실시간 UI 업데이트
- 클라이언트 사이드 타이머 구현
- 사용자 경험 개선

### 목적 및 영향
사용자가 게임을 플레이하는 동안 Time to Evolve, Lifespan, Waste(똥) 등의 시간 관련 스탯이 실시간으로 업데이트되도록 클라이언트 타이머를 도입했습니다:
- 1초마다 UI가 실시간으로 업데이트되어 사용자가 시간 경과를 즉시 확인 가능
- 똥이 실시간으로 쌓이는 모습을 UI에 반영
- Firestore 쓰기 작업은 사용자 액션 시에만 실행하여 비용 절감

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - **updateLifespan import 추가**: `stats.js`에서 `updateLifespan` 함수 import
  - **클라이언트 타이머 구현**: `useEffect`와 `setInterval`을 사용하여 1초마다 UI 업데이트
  - **함수형 업데이트 사용**: `setDigimonStats`에 함수형 업데이트를 사용하여 최신 상태 참조
  - **사망 상태 체크**: 사망한 경우 타이머 중지
  - **메모리 누수 방지**: `useEffect` cleanup 함수에서 `clearInterval` 호출

### 주요 변경사항

#### Game.jsx - 클라이언트 타이머 구현
- **타이머 설정**: `useEffect` 내에서 `setInterval`로 1초마다 실행되는 타이머 생성
- **updateLifespan 호출**: 매초 `updateLifespan(prevStats, 1)` 호출하여 1초 경과 처리
- **실시간 UI 업데이트**: 
  - `lifespanSeconds` 증가
  - `timeToEvolveSeconds` 감소
  - `fullness` 감소 (hungerTimer에 따라)
  - `health` 감소 (strengthTimer에 따라)
  - `poopCount` 증가 (poopTimer에 따라)
- **사망 감지**: 사망 상태 변경 시 `setShowDeathConfirm(true)` 호출
- **메모리 상태만 업데이트**: Firestore 쓰기 작업 없이 메모리 상태만 업데이트

#### stats.js - updateLifespan 함수 활용
- 기존 `updateLifespan` 함수를 활용하여 1초 경과 처리
- 배고픔, 건강, 똥(poop) 누적 로직이 이미 구현되어 있음
- 사망 조건 처리 포함

### 타이머 동작 방식
1. **타이머 시작**: 컴포넌트 마운트 시 `useEffect` 실행
2. **1초마다 실행**: `setInterval`로 1초마다 콜백 함수 실행
3. **상태 업데이트**: `updateLifespan`으로 1초 경과 처리 후 `setDigimonStats` 호출
4. **UI 반영**: React가 상태 변경을 감지하여 UI 자동 업데이트
5. **타이머 정리**: 컴포넌트 언마운트 시 `clearInterval`로 타이머 제거

### 실시간 업데이트 항목
- **Time to Evolve**: 매초 1초씩 감소
- **Lifespan**: 매초 1초씩 증가
- **Fullness**: `hungerTimer`에 따라 주기적으로 감소
- **Health**: `strengthTimer`에 따라 주기적으로 감소
- **Poop Count**: `poopTimer`에 따라 주기적으로 증가 (최대 8개)
- **Care Mistakes**: 똥이 8개인 상태로 8시간 경과 시 증가

### Firestore 쓰기 전략
- **클라이언트 타이머**: 메모리 상태만 업데이트 (Firestore 쓰기 없음)
- **사용자 액션**: 먹이주기, 훈련하기, 진화하기, 청소하기 등 액션 시에만 Firestore에 저장
- **비용 절감**: 매초 Firestore 쓰기를 하지 않아 비용 절감 및 성능 향상

### 메모리 누수 방지
- **useEffect cleanup**: 컴포넌트 언마운트 시 `clearInterval(timer)` 호출
- **사망 시 중지**: `digimonStats.isDead`가 true일 때 타이머 중지
- **함수형 업데이트**: `setDigimonStats`에 함수형 업데이트를 사용하여 최신 상태 참조

### 사용자 경험 개선
- **실시간 피드백**: 시간 경과를 즉시 확인 가능
- **시각적 효과**: 똥이 실시간으로 쌓이는 모습을 UI에 반영
- **반응성 향상**: 1초마다 UI가 업데이트되어 게임이 살아있는 느낌 제공

### 참고사항
- `updateLifespan` 함수는 `stats.js`에 이미 구현되어 있어 재사용
- Firestore 쓰기는 사용자 액션 시에만 실행되므로 비용 효율적
- 함수형 업데이트를 사용하여 타이머가 매초 재설정되지 않도록 최적화
- 사망한 디지몬은 타이머가 중지되어 불필요한 업데이트 방지

---

## [2025-12-14] 데이터 저장 완료 후 페이지 이동 및 로딩 상태 관리 개선

### 작업 유형
- 비동기 로직 개선
- 에러 처리 강화
- 사용자 경험 개선
- 로딩 상태 관리

### 목적 및 영향
데이터 저장이 완료된 후에만 페이지 이동하도록 보장하고, Game.jsx에서 데이터 로딩이 완료될 때까지 불필요한 리디렉션을 방지하도록 개선했습니다:
- 데이터 저장 실패 시 페이지 이동 방지
- 명확한 에러 메시지 제공
- 로딩 상태 표시로 사용자 경험 개선
- 데이터 로딩 완료 전 리디렉션 방지

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
  - **비동기 로직 개선**: `handleNewTama` 함수에서 데이터 저장 완료 후에만 `navigate` 호출
  - **저장 성공 확인**: `saveSuccess` 플래그를 사용하여 저장 성공 여부 확인
  - **에러 처리 강화**: localStorage 저장 시도/캐치 추가
  - **페이지 이동 조건**: `saveSuccess && slotId`가 모두 true일 때만 페이지 이동
  - **에러 발생 시 처리**: 에러 발생 시 알림 표시 후 `return`으로 페이지 이동 방지

- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - **로딩 상태 관리**: `isLoadingSlot` state 추가하여 슬롯 데이터 로딩 상태 추적
  - **로딩 표시**: 데이터 로딩 중일 때 로딩 스피너와 메시지 표시
  - **리디렉션 개선**: Firebase 모드에서 로그인 체크 시 로딩 상태를 false로 설정한 후 리디렉션
  - **에러 처리**: try/catch/finally 블록으로 에러 발생 시에도 로딩 상태 해제
  - **데이터 로딩 완료 보장**: `finally` 블록에서 항상 `setIsLoadingSlot(false)` 호출

### 주요 변경사항

#### SelectScreen.jsx - handleNewTama 함수
- **저장 성공 확인**: `saveSuccess` 플래그로 Firestore 또는 localStorage 저장 성공 여부 확인
- **localStorage 에러 처리**: localStorage 저장 시도/캐치로 저장 실패 시 에러 발생
- **조건부 페이지 이동**: `if (saveSuccess && slotId)` 조건으로 저장 성공 시에만 페이지 이동
- **에러 시 처리**: catch 블록에서 에러 메시지 표시 후 `return`으로 함수 종료

#### Game.jsx - 슬롯 로드 로직
- **로딩 상태 추가**: `const [isLoadingSlot, setIsLoadingSlot] = useState(true)` 추가
- **로딩 시작**: `loadSlot` 함수 시작 시 `setIsLoadingSlot(true)` 호출
- **로딩 완료**: `finally` 블록에서 `setIsLoadingSlot(false)` 호출
- **로딩 UI**: `isLoadingSlot`이 true일 때 로딩 스피너와 메시지 표시
- **리디렉션 개선**: Firebase 모드에서 로그인 체크 시 로딩 상태를 false로 설정한 후 리디렉션

### 데이터 저장 흐름
1. **SelectScreen**: "새 다마고치 시작" 버튼 클릭
2. **슬롯 찾기**: 빈 슬롯 찾기
3. **데이터 저장**: Firestore 또는 localStorage에 데이터 저장
4. **저장 성공 확인**: `saveSuccess` 플래그로 저장 성공 여부 확인
5. **페이지 이동**: 저장 성공 시에만 `/game/${slotId}`로 이동

### 데이터 로딩 흐름
1. **Game.jsx 마운트**: `isLoadingSlot = true`로 시작
2. **모드 확인**: Firebase 모드인지 localStorage 모드인지 확인
3. **데이터 로드**: Firestore 또는 localStorage에서 슬롯 데이터 로드
4. **로딩 완료**: `finally` 블록에서 `isLoadingSlot = false`로 설정
5. **UI 표시**: 로딩 중일 때는 로딩 UI, 완료 후 게임 화면 표시

### 사용자 경험 개선
- **명확한 피드백**: 데이터 저장 실패 시 명확한 에러 메시지 표시
- **로딩 표시**: 데이터 로딩 중 로딩 스피너로 진행 상황 표시
- **안정성 향상**: 데이터 저장 완료 전 페이지 이동 방지로 데이터 손실 방지
- **에러 처리**: 모든 에러 케이스에 대한 적절한 처리

### 참고사항
- localStorage 저장은 동기 작업이지만, 에러 발생 가능성을 고려하여 try/catch로 감쌈
- Firestore 저장은 비동기 작업이므로 `await`로 완료 대기
- 로딩 상태는 `finally` 블록에서 항상 해제하여 무한 로딩 방지
- Firebase 모드에서 로그인 체크 실패 시에도 로딩 상태를 해제한 후 리디렉션

---

## [2025-12-14] 전역 인증 상태 관리 개선 및 리디렉션 로직 정리

### 작업 유형
- 인증 상태 관리 개선
- 사용자 경험 개선
- 코드 정리

### 목적 및 영향
AuthContext의 `onAuthStateChanged` 리스너를 활용하여 전역 인증 상태를 관리하고, SelectScreen에서 자동으로 인증 상태를 감지하여 리디렉션하도록 개선했습니다:
- 전역 인증 상태 구독을 통한 자동 리디렉션
- 불필요한 팝업 제거로 사용자 경험 개선
- 로그인 성공 후 단순한 리디렉션으로 코드 단순화

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
  - **전역 인증 상태 구독**: AuthContext의 `currentUser`를 구독하여 자동으로 인증 상태 감지
  - **자동 리디렉션**: Firebase 모드에서 `currentUser`가 null일 경우 자동으로 로그인 페이지로 리디렉션
  - **팝업 제거**: "로그인이 필요합니다" alert 제거, 대신 자동 리디렉션 사용
  - **handleNewTama 함수**: 버튼 클릭 시에도 인증 체크하되 팝업 없이 리디렉션

- `digimon-tamagotchi-frontend/src/pages/Login.jsx`
  - **로그인 성공 리디렉션**: 로그인 성공 시 단순히 `/select`로 이동
  - **state 전달 제거**: `navigate("/select", { state: { mode: 'firebase' } })` → `navigate("/select")`
  - **로컬 모드 리디렉션**: localStorage 모드로 이동할 때도 state 전달 제거

### 주요 변경사항

#### SelectScreen.jsx
- **전역 인증 상태 구독**: `useAuth()` 훅으로 `currentUser`를 구독
- **자동 리디렉션 로직**: `useEffect`에서 `currentUser`가 null이고 Firebase 모드일 경우 자동으로 `/`로 리디렉션
- **팝업 제거**: `alert("로그인이 필요합니다.")` 제거
- **handleNewTama 함수**: 버튼 클릭 시에도 인증 체크하되 팝업 없이 리디렉션

#### Login.jsx
- **로그인 성공 처리**: Firestore에 유저 정보 저장 후 단순히 `/select`로 이동
- **state 전달 제거**: AuthContext의 `onAuthStateChanged` 리스너가 자동으로 `currentUser`를 업데이트하므로 별도 state 전달 불필요
- **로컬 모드 리디렉션**: localStorage 모드로 이동할 때도 state 전달 제거

### 인증 상태 관리 흐름
1. **AuthContext**: `onAuthStateChanged` 리스너가 Firebase 인증 상태 변경을 감지
2. **전역 상태 업데이트**: 인증 상태 변경 시 `currentUser` 상태 자동 업데이트
3. **SelectScreen 구독**: `useAuth()` 훅으로 `currentUser` 구독
4. **자동 리디렉션**: `currentUser`가 null이고 Firebase 모드일 경우 자동으로 로그인 페이지로 리디렉션

### 사용자 경험 개선
- **자동 리디렉션**: 로그인하지 않은 상태에서 SelectScreen 접근 시 자동으로 로그인 페이지로 이동
- **팝업 제거**: 불필요한 "로그인이 필요합니다" 팝업 제거로 더 부드러운 사용자 경험
- **상태 동기화**: AuthContext의 전역 상태를 통해 모든 컴포넌트에서 일관된 인증 상태 유지

### 참고사항
- AuthContext는 이미 `onAuthStateChanged` 리스너를 사용하여 전역 인증 상태를 관리하고 있음
- SelectScreen은 이 전역 상태를 구독하여 자동으로 인증 상태를 감지
- 로그인 성공 후 별도의 state 전달 없이도 SelectScreen에서 자동으로 인증 상태를 인식
- 로컬 모드(`mode === 'local'`)로 온 경우는 인증 체크를 건너뜀

---

## [2025-12-14] Backend 폴더 제거 및 프로젝트 정리

### 작업 유형
- 프로젝트 구조 정리
- 불필요한 파일 제거
- 아키텍처 단순화

### 목적 및 영향
프로젝트가 Firebase/Vercel 서버리스 아키텍처로 완전히 전환되었으므로, 더 이상 필요하지 않은 Express 기반 백엔드 폴더를 제거했습니다:
- Express 서버 및 관련 의존성 제거
- 프로젝트 구조 단순화
- 순수한 React + Firebase 클라이언트 앱으로 정리

### 변경된 파일
- **backend/** 폴더 전체 삭제
  - `server.js` (Express 서버 파일)
  - `package.json` (백엔드 의존성)
  - `node_modules/` (백엔드 의존성 패키지)
  - `build/` (빌드 결과물)

- `digimon-tamagotchi-frontend/package.json`
  - 확인 결과: 백엔드 관련 스크립트 없음 (이미 정리되어 있음)
  - 현재 스크립트: `start`, `build`, `test`, `eject` (순수 React 앱 스크립트만 유지)
  - `concurrently`, `server`, `start-dev` 등의 백엔드 관련 스크립트 없음

### 제거된 내용
- Express 서버 (`server.js`)
- node-cron (서버 사이드 스케줄링)
- cross-fetch (서버 사이드 HTTP 요청)
- Express 관련 의존성 및 설정

### 프로젝트 구조 변화
**Before:**
```
d2_tama_refact/
  ├── backend/          # Express 서버 (제거됨)
  │   ├── server.js
  │   ├── package.json
  │   └── node_modules/
  └── digimon-tamagotchi-frontend/
      └── package.json
```

**After:**
```
d2_tama_refact/
  └── digimon-tamagotchi-frontend/
      └── package.json  # 순수 React 앱만 유지
```

### 주요 변경사항

#### Backend 폴더 삭제
- Express 기반 백엔드 서버 전체 제거
- 서버 사이드 의존성 제거 (node-cron, express, cross-fetch)
- 빌드 결과물 및 node_modules 제거

#### Package.json 확인
- 백엔드 관련 스크립트 없음 확인
- 순수 React 앱 스크립트만 유지:
  - `start`: React 개발 서버 시작
  - `build`: React 앱 빌드
  - `test`: 테스트 실행
  - `eject`: Create React App eject

### 아키텍처 정리
프로젝트가 완전히 서버리스 아키텍처로 전환되었습니다:
- **클라이언트**: React 앱 (Firebase SDK 사용)
- **백엔드**: Firebase (Firestore + Authentication + Serverless Functions)
- **호스팅**: Vercel (프론트엔드) + Firebase (백엔드)

### 참고사항
- Express 서버는 더 이상 필요하지 않음 (Firebase로 완전 전환)
- 모든 데이터 저장/인증은 Firebase를 통해 처리
- Lazy Update 패턴으로 서버 사이드 스케줄링 불필요
- 프로젝트가 순수한 클라이언트 앱으로 단순화됨

---

## [2025-12-14] Google 로그인 계정 선택 강제 및 로그아웃 기능 추가

### 작업 유형
- 기능 개선
- 테스트 환경 개선
- 사용자 경험 향상

### 목적 및 영향
테스트 환경 개선을 위해 Google 로그인 시 매번 계정 선택 창이 뜨도록 하고, 게임 내에서 로그아웃할 수 있는 기능을 추가했습니다:
- Google 로그인 시 `prompt: 'select_account'` 옵션을 강제하여 매번 계정 선택 창 표시
- SettingsModal에 로그아웃 버튼 추가로 게임 중간에 계정 전환 가능
- 로그아웃 후 자동으로 로그인 페이지로 리디렉션

### 변경된 파일
- `digimon-tamagotchi-frontend/src/contexts/AuthContext.jsx`
  - **Google 로그인 개선**: `GoogleAuthProvider`에 `setCustomParameters({ prompt: 'select_account' })` 추가
  - 매번 로그인 시 계정 선택 창이 표시되어 테스트 시 여러 계정 전환 용이

- `digimon-tamagotchi-frontend/src/components/SettingsModal.jsx`
  - **로그아웃 기능 추가**: `useAuth` 훅으로 `logout`, `isFirebaseAvailable`, `currentUser` 가져오기
  - **로그아웃 버튼**: Firebase 모드에서만 표시되는 로그아웃 버튼 추가
  - **리디렉션**: 로그아웃 성공 시 `navigate("/")`로 로그인 페이지로 이동
  - **에러 처리**: 로그아웃 실패 시 에러 메시지 표시

### 주요 변경사항

#### AuthContext.jsx
- `signInWithGoogle()` 함수에서 `provider.setCustomParameters({ prompt: 'select_account' })` 추가
- 매번 로그인 시 Google 계정 선택 창이 표시되어 테스트 환경 개선

#### SettingsModal.jsx
- `useNavigate()` 훅 추가로 페이지 이동 기능 구현
- `useAuth()` 훅으로 인증 관련 함수 및 상태 가져오기
- Firebase 모드에서만 로그아웃 버튼 표시 (조건부 렌더링)
- 로그아웃 버튼 클릭 시 `logout()` 호출 후 로그인 페이지로 리디렉션
- 로그아웃 실패 시 사용자에게 알림 표시

### 사용자 경험 개선
- **계정 전환 용이**: 매번 계정 선택 창이 표시되어 여러 계정으로 테스트 가능
- **게임 중 로그아웃**: Settings 모달에서 바로 로그아웃하여 계정 전환 가능
- **테스트 효율성**: 개발 및 테스트 시 계정 전환이 간편해짐

### 참고사항
- `prompt: 'select_account'` 옵션은 Google OAuth의 표준 파라미터로, 매번 계정 선택 창을 강제로 표시
- 로그아웃 버튼은 Firebase 모드에서만 표시되며, localStorage 모드에서는 표시되지 않음
- 로그아웃 후 자동으로 로그인 페이지로 이동하여 새로운 계정으로 로그인 가능

---

## [2025-12-14] Firebase/LocalStorage 이중 모드 지원 구현

### 작업 유형
- 기능 추가
- 데이터 저장소 분기 처리
- 라우팅 상태 관리

### 목적 및 영향
사용자가 Firebase 인증 없이도 로컬 저장소 모드로 게임을 시작할 수 있도록 지원했습니다:
- SelectScreen에서 "로컬 저장소 모드 시작" 버튼 추가로 Firebase Auth 없이 게임 시작 가능
- Login.jsx는 Firebase 로그인만 전담하되, 로그인 후 mode: 'firebase' 상태 전달
- Game.jsx에서 mode 값(firebase/local)을 기반으로 데이터 저장 로직 분기 처리
- React Router의 location.state를 활용하여 페이지 간 mode 상태 전달

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
  - **로컬 모드 시작 버튼**: `handleNewTamaLocal()` 함수 추가
  - **로컬 모드 슬롯 생성**: localStorage에 초기 데이터 저장 후 Game.jsx로 이동 (mode: 'local')
  - **Firebase 모드 슬롯 생성**: 기존 로직 유지하되 Game.jsx로 이동 시 mode: 'firebase' 전달
  - **이어하기 기능**: 현재 모드에 따라 state에 mode 값 전달

- `digimon-tamagotchi-frontend/src/pages/Login.jsx`
  - **Firebase 로그인 후**: SelectScreen으로 이동 시 `navigate("/select", { state: { mode: 'firebase' } })` 전달
  - **로컬 모드 시작**: Firebase 미설정 시 SelectScreen으로 이동 시 mode: 'local' 전달

- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - **mode 상태 관리**: `useLocation()` 훅으로 location.state에서 mode 값 가져오기
  - **슬롯 로드 분기**: mode에 따라 Firestore 또는 localStorage에서 데이터 로드
  - **스탯 저장 분기**: `setDigimonStatsAndSave()` 함수에서 mode에 따라 Firestore 또는 localStorage 저장
  - **Lazy Update 분기**: `applyLazyUpdateBeforeAction()` 함수에서 mode에 따라 데이터 소스 선택
  - **디지몬 이름 저장 분기**: `setSelectedDigimonAndSave()` 함수에서 mode에 따라 저장 방식 분기
  - **청소 기능 분기**: `cleanCycle()` 함수에서 mode에 따라 저장 방식 분기

### 데이터 저장 로직 분기
Game.jsx의 모든 저장 작업이 mode 값에 따라 분기 처리됩니다:
- **mode === 'firebase'**: Firestore의 `users/{uid}/slots/{slotId}` 경로에 저장
- **mode === 'local'**: localStorage의 `slot{slotId}_*` 키에 저장

### 주요 변경사항

#### SelectScreen.jsx
- `handleNewTamaLocal()`: 로컬 모드로 새 다마고치 시작 (Firebase Auth 불필요)
- `handleNewTama()`: Firebase 모드로 새 다마고치 시작 (기존 로직 유지)
- `handleContinue()`: 현재 모드에 따라 state에 mode 값 전달
- UI에 "로컬 저장소 모드 시작" 버튼 추가

#### Login.jsx
- Firebase 로그인 성공 시 SelectScreen으로 이동할 때 mode: 'firebase' 전달
- localStorage 모드 시작 시 SelectScreen으로 이동할 때 mode: 'local' 전달

#### Game.jsx
- `mode` 변수: location.state에서 가져오거나, 기본값은 현재 인증 상태 기반
- 모든 데이터 저장/로드 작업이 mode 값에 따라 Firestore 또는 localStorage로 분기
- Lazy Update 로직도 mode에 따라 적절한 데이터 소스에서 마지막 저장 시간 조회

### 참고사항
- React Router v6의 `navigate(path, { state })`를 사용하여 페이지 간 상태 전달
- `useLocation()` 훅으로 전달받은 state 접근
- mode 값이 없을 경우 현재 인증 상태를 기반으로 자동 판단 (firebase 또는 local)
- Firebase 모드에서는 인증이 필수이며, 미인증 시 Login 페이지로 리디렉션

---

## [2025-12-14] localStorage 완전 제거 및 Firestore 전용 전환

### 작업 유형
- 코드 리팩토링
- 데이터 저장소 통합
- Lazy Update 최적화

### 목적 및 영향
Game.jsx에서 모든 localStorage 관련 코드를 제거하고 Firestore 전용으로 전환했습니다:
- Firebase 인증이 필수 조건이 되었으며, localStorage fallback 제거
- 모든 데이터 저장/로드가 Firestore의 `users/{uid}/slots/{slotId}` 경로로 통일
- 데이터 저장 시점 명확화: 로그인/슬롯 선택 시 로드, 먹이/훈련/진화/청소 시 저장
- Lazy Update 로직이 모든 액션 전에 적용되어 정확한 스탯 계산 보장

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - **슬롯 로드**: localStorage 분기 완전 제거, Firestore 전용으로 변경
  - **스탯 저장**: `setDigimonStatsAndSave()` 함수에서 localStorage 분기 제거
  - **Lazy Update**: `applyLazyUpdateBeforeAction()` 함수에서 localStorage 분기 제거
  - **디지몬 이름 저장**: `setSelectedDigimonAndSave()` 함수에서 localStorage 분기 제거
  - **청소 기능**: `cleanCycle()` 함수에서 `lastSavedAt` 필드 업데이트 추가
  - **먹이 기능**: `handleFeed()` 함수에서 업데이트된 스탯 기준으로 검증 로직 수정

### 데이터 저장 시점
다음 액션 시점에 Firestore에 자동 저장됩니다:
1. **슬롯 로드 시**: Lazy Update 적용 후 업데이트된 스탯 저장
2. **먹이 주기**: `setDigimonStatsAndSave()` 호출 시 저장
3. **훈련하기**: `setDigimonStatsAndSave()` 호출 시 저장
4. **진화하기**: `setDigimonStatsAndSave()` 호출 시 저장
5. **청소하기**: `cleanCycle()` 함수에서 직접 저장

### Lazy Update 적용
모든 액션 전에 `applyLazyUpdateBeforeAction()` 함수가 호출되어:
- Firestore에서 마지막 저장 시간(`lastSavedAt`) 조회
- 현재 시간과의 차이 계산
- `stats.js`의 `applyLazyUpdate()` 함수로 경과 시간만큼 스탯 차감
- 사망 상태 변경 감지 및 알림

### Firestore 데이터 구조
```
users/{uid}/slots/{slotId}
  - selectedDigimon: string
  - digimonStats: {
      ... (모든 스탯 필드)
      lastSavedAt: Date  // Lazy Update용 마지막 저장 시간
    }
  - slotName: string
  - createdAt: string
  - device: string
  - version: string
  - updatedAt: Timestamp
  - lastSavedAt: Timestamp  // 문서 레벨 마지막 저장 시간
```

### 주요 변경사항

#### Game.jsx
- **슬롯 로드**: Firebase 인증 필수, localStorage fallback 제거
- **스탯 저장**: 모든 저장 작업이 Firestore로 통일
- **액션 전 Lazy Update**: 모든 사용자 액션(먹이, 훈련, 진화, 청소) 전에 경과 시간 반영
- **에러 처리**: Firestore 작업 실패 시 콘솔 에러 로그만 출력 (사용자 경험 유지)

#### stats.js
- localStorage 관련 코드 없음 (변경 없음)
- `applyLazyUpdate()` 함수가 이미 Lazy Update 로직 구현
- `updateLifespan()` 함수는 유지 (필요 시 사용 가능)

### 성능 개선
- **Before**: localStorage와 Firestore 이중 분기 처리
- **After**: Firestore 단일 경로로 코드 단순화 및 유지보수성 향상
- 모든 액션 시점에만 저장하여 Firestore 쓰기 횟수 최소화

### 참고사항
- Firebase 인증이 필수 조건이 되었으므로, 로그인하지 않은 사용자는 SelectScreen으로 리디렉션
- `isFirebaseAvailable` 체크는 유지하여 Firebase 초기화 실패 시 안전하게 처리
- 모든 Firestore 작업은 비동기로 처리되어 UI 블로킹 방지

---

## [2025-12-14] Firebase Google 로그인 및 Firestore 직접 연동 구현

### 작업 유형
- 인증 시스템 구현
- Firestore 직접 연동
- 사용자별 데이터 분리

### 목적 및 영향
Firebase Authentication과 Firestore를 사용하여 사용자별 슬롯 데이터를 관리하도록 구현했습니다:
- Google 로그인을 통한 사용자 인증
- 로그인된 유저의 UID 기반으로 Firestore `/users/{uid}/slots` 컬렉션에서 데이터 관리
- Repository 패턴에서 Firestore 직접 호출로 전환하여 코드 명확성 향상

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/Login.jsx`
  - Firebase `signInWithPopup(GoogleAuthProvider)`를 사용한 Google 로그인 구현
  - `userSlotRepository` 제거, Firestore 직접 호출로 변경
  - `doc(db, 'users', user.uid)` + `setDoc`으로 유저 정보 저장
  - 로그인 성공 시 유저 UID를 사용하여 SelectScreen으로 리디렉션

- `digimon-tamagotchi-frontend/src/pages/SelectScreen.jsx`
  - `userSlotRepository` 제거, Firestore 직접 호출로 변경
  - Firestore의 `collection(db, 'users', currentUser.uid, 'slots')`에서 슬롯 목록 가져오기
  - `doc(db, 'users', currentUser.uid, 'slots', 'slot{slotId}')`로 슬롯 CRUD 작업
  - `getDocs`, `setDoc`, `updateDoc`, `deleteDoc` 직접 사용

### Firestore 데이터 구조
```
users/
  {uid}/                    # 유저 UID
    email: string
    displayName: string
    photoURL: string
    createdAt: Timestamp
    updatedAt: Timestamp
    slots/                   # 서브컬렉션
      slot1/
        selectedDigimon: string
        digimonStats: {...}
        slotName: string
        createdAt: string
        device: string
        version: string
        updatedAt: Timestamp
        lastSavedAt: Timestamp
      slot2/
        ...
```

### 주요 변경사항

#### Login.jsx
- `signInWithPopup(auth, GoogleAuthProvider)` 사용
- 로그인 성공 후 `user.uid`를 사용하여 SelectScreen으로 리디렉션
- Firestore에 유저 정보 자동 저장

#### SelectScreen.jsx
- **슬롯 목록 로드**: `collection(db, 'users', uid, 'slots')` + `getDocs(query(...))`
- **슬롯 생성**: `doc(db, 'users', uid, 'slots', 'slot{id}')` + `setDoc`
- **슬롯 삭제**: `doc(...)` + `deleteDoc`
- **슬롯 이름 수정**: `doc(...)` + `updateDoc`

### 관련 파일
- `digimon-tamagotchi-frontend/src/contexts/AuthContext.jsx` - 인증 상태 관리
- `digimon-tamagotchi-frontend/src/firebase.js` - Firebase 초기화

### 참고사항
- 모든 Firestore 작업은 유저 UID 기반으로 수행
- Firestore 보안 규칙으로 유저별 데이터 접근 제어 필요
- localStorage 모드는 Firebase가 설정되지 않았을 때 fallback으로 동작

---

## [2025-12-14] localStorage → Firestore 직접 호출 리팩토링

### 작업 유형
- 데이터 저장소 마이그레이션
- 코드 리팩토링

### 목적 및 영향
Game.jsx에서 userSlotRepository를 사용하던 부분을 Firestore의 doc, getDoc, setDoc, updateDoc을 직접 사용하도록 변경했습니다. 이를 통해:
- Repository 추상화 레이어를 제거하고 Firestore를 직접 사용
- DigimonStats JSON 구조를 그대로 Firestore 문서에 저장
- 코드의 명확성과 직접성 향상

### 변경된 파일
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - userSlotRepository import 제거
  - Firestore doc, getDoc, setDoc, updateDoc 직접 import
  - 슬롯 로드: getDoc 사용
  - 스탯 저장: updateDoc 사용 (매초 자동 저장 및 수동 저장)
  - 디지몬 이름 저장: updateDoc 사용
  - 청소 기능: updateDoc 사용

### Firestore 데이터 구조
```
users/{userId}/slots/{slotId}
  - selectedDigimon: string
  - digimonStats: DigimonStats (JSON 객체 전체)
  - slotName: string
  - createdAt: string
  - device: string
  - version: string
  - updatedAt: Timestamp
```

### 참고사항
- stats.js는 localStorage를 사용하지 않으므로 변경 없음
- 모든 Firestore 호출은 에러 처리를 포함
- 비동기 저장 작업은 사용자 경험에 영향을 주지 않도록 처리

---

## [2025-12-14] Lazy Update 로직 구현 (node-cron 제거)

### 작업 유형
- 아키텍처 변경
- 성능 최적화
- 서버리스 환경 대응

### 목적 및 영향
Vercel/Firebase 환경에서 node-cron의 비효율성을 해결하기 위해 Lazy Update 패턴을 도입했습니다:
- 매초 실행되던 타이머 제거 → 서버 리소스 절약
- 유저 접속/액션 시점에만 시간 경과 계산 및 스탯 업데이트
- 마지막 저장 시간(`lastSavedAt`) 기반으로 경과 시간 계산
- 서버리스 환경에 최적화된 구조

### 변경된 파일
- `digimon-tamagotchi-frontend/src/data/stats.js`
  - `applyLazyUpdate()` 함수 추가
  - 마지막 저장 시간부터 현재까지 경과 시간 계산
  - 배고픔, 건강, 배변, 수명 등을 한 번에 업데이트
  - 사망 조건 처리 (배고픔 0 상태 12시간 경과)

- `digimon-tamagotchi-frontend/src/pages/Game.jsx`
  - 매초 실행되던 `setInterval` 타이머 제거
  - `updateLifespan`, `updateAge` import 제거
  - `applyLazyUpdate` import 추가
  - 슬롯 로드 시 Lazy Update 적용
  - 모든 액션(먹이, 훈련, 진화, 청소 등) 전에 Lazy Update 적용
  - `applyLazyUpdateBeforeAction()` 헬퍼 함수 추가
  - Firestore에 `lastSavedAt` 필드 저장

### Lazy Update 로직
```javascript
// 마지막 저장 시간과 현재 시간의 차이 계산
const elapsedSeconds = (현재 시간 - 마지막 저장 시간) / 1000

// 경과 시간만큼 스탯 업데이트
- lifespanSeconds += elapsedSeconds
- timeToEvolveSeconds -= elapsedSeconds
- 배고픔/건강 타이머 감소 및 상태 업데이트
- 배변 카운트 증가
- 사망 조건 확인
```

### Firestore 데이터 구조 변경
```
users/{userId}/slots/{slotId}
  ...
  + lastSavedAt: Timestamp  // 마지막 저장 시간 (Lazy Update용)
```

### 성능 개선
- **Before**: 매초 Firestore 업데이트 (60회/분)
- **After**: 액션 시점에만 업데이트 (필요 시에만)
- 서버리스 환경에서 비용 및 리소스 절약

### 참고사항
- 기존 `updateLifespan()` 함수는 유지 (필요 시 사용 가능)
- `lastSavedAt`이 없으면 현재 시간으로 초기화
- Firestore Timestamp, Date, number, string 모두 지원
- 사망한 디지몬은 더 이상 업데이트하지 않음

---