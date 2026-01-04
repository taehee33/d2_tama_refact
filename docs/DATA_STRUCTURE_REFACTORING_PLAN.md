# 데이터 구조 통일 리팩토링 계획서

## 📋 목차
1. [현재 상태 분석](#현재-상태-분석)
2. [리팩토링 목표](#리팩토링-목표)
3. [영향받는 파일 목록](#영향받는-파일-목록)
4. [필드 매핑 테이블](#필드-매핑-테이블)
5. [단계별 리팩토링 계획](#단계별-리팩토링-계획)
6. [고려사항 및 위험 요소](#고려사항-및-위험-요소)
7. [테스트 전략](#테스트-전략)
8. [마이그레이션 체크리스트](#마이그레이션-체크리스트)

---

## 현재 상태 분석

### 데이터 구조 현황

#### 1. 새 데이터 구조 (`digimons.js` - v1)
```javascript
{
  id: "Botamon",
  name: "Botamon",
  stage: "Baby I",
  sprite: 210,
  stats: {
    hungerCycle: 3,        // ← 구 구조: hungerTimer
    strengthCycle: 3,     // ← 구 구조: strengthTimer
    poopCycle: 3,         // ← 구 구조: poopTimer
    maxOverfeed: 3,
    maxEnergy: 50,        // ← 구 구조: maxStamina
    minWeight: 5,
    basePower: 20,
    sleepSchedule: { start: 20, end: 8 },
    // ...
  },
  evolutionCriteria: {
    timeToEvolveSeconds: 600,
    // ...
  },
  evolutions: [/* ... */]
}
```

#### 2. 구 데이터 구조 (`digimondata_digitalmonstercolor25th_ver1.js`)
```javascript
{
  sprite: 210,
  evolutionStage: "Baby1",  // ← 새 구조: stage
  timeToEvolveSeconds: 600,
  hungerTimer: 3,           // ← 새 구조: stats.hungerCycle
  strengthTimer: 3,         // ← 새 구조: stats.strengthCycle
  poopTimer: 3,             // ← 새 구조: stats.poopCycle
  maxOverfeed: 3,
  minWeight: 5,
  maxStamina: 50,           // ← 새 구조: stats.maxEnergy
}
```

### 현재 사용 패턴

#### 어댑터 사용 위치
- **`Game.jsx`**: 어댑터를 통해 변환된 데이터 사용
  ```javascript
  const digimonDataVer1 = adaptDataMapToOldFormat(newDigimonDataVer1);
  ```

#### 혼용 사용 위치
- **`useEvolution.js`**: 
  - `newDigimonDataVer1` 직접 사용 (진화 체크)
  - `digimonDataVer1` 사용 (진화 실행)
  
- **`BattleScreen.jsx`**: `newDigimonDataVer1` 직접 사용

- **`useGameData.js`**: `digimonDataVer1` 사용 (어댑터 변환된 것)

#### 필드 접근 패턴 불일치
```javascript
// 패턴 1: 어댑터 변환된 데이터 (구 구조)
digimonDataVer1[name].maxStamina
digimonDataVer1[name].hungerTimer

// 패턴 2: 새 데이터 직접 접근
newDigimonDataVer1[name].stats.maxEnergy
newDigimonDataVer1[name].stats.hungerCycle

// 패턴 3: 혼용 (둘 다 체크)
const maxEnergy = newDigimonData.stats?.maxEnergy 
               || newDigimonData.stats?.maxStamina 
               || newDigimonData.maxEnergy 
               || newDigimonData.maxStamina;
```

---

## 리팩토링 목표

### 1. 데이터 소스 통일
- ✅ 모든 코드가 `digimons.js` (새 구조)만 사용
- ❌ `digimondata_digitalmonstercolor25th_ver1.js` 제거
- ❌ 어댑터(`adapter.js`) 제거

### 2. 필드 접근 패턴 통일
- ✅ 모든 필드 접근이 새 구조 형식으로 통일
- ✅ `stats.maxEnergy`, `stats.hungerCycle` 등 일관된 접근

### 3. 코드 단순화
- ✅ `maxEnergy || maxStamina` 같은 혼용 체크 제거
- ✅ 명확한 필드 경로로 가독성 향상

### 4. 유지보수성 향상
- ✅ 단일 데이터 소스로 관리 용이
- ✅ 필드 추가/수정 시 한 곳만 수정

---

## 영향받는 파일 목록

### 핵심 파일 (우선순위 높음)
1. **`src/pages/Game.jsx`** ⭐⭐⭐
   - 어댑터 사용 중
   - `digimonDataVer1` 전달
   - 영향도: 매우 높음

2. **`src/hooks/useEvolution.js`** ⭐⭐⭐
   - `newDigimonDataVer1`와 `digimonDataVer1` 혼용
   - 진화 로직 핵심
   - 영향도: 매우 높음

3. **`src/hooks/useGameData.js`** ⭐⭐⭐
   - `digimonDataVer1` 사용
   - Lazy Update 로직
   - 영향도: 매우 높음

4. **`src/hooks/useGameHandlers.js`** ⭐⭐
   - `getSleepSchedule` 등 유틸 함수
   - 영향도: 높음

5. **`src/hooks/useGameState.js`** ⭐⭐
   - `digimonDataVer1` prop 받음
   - 영향도: 높음

### 컴포넌트 파일
6. **`src/components/BattleScreen.jsx`** ⭐⭐
   - `newDigimonDataVer1` 직접 사용
   - 영향도: 높음

7. **`src/components/ArenaScreen.jsx`** ⭐
   - 디지몬 데이터 접근
   - 영향도: 중간

8. **`src/components/SparringModal.jsx`** ⭐
   - `digimonDataVer1` 사용
   - 영향도: 중간

9. **`src/components/QuestSelectionModal.jsx`** ⭐
   - `digimonDataVer1` 사용
   - 영향도: 중간

10. **`src/components/StatsPopup.jsx`** ⭐
    - `maxEnergy || maxStamina` 혼용 체크
    - 영향도: 중간

11. **`src/components/DigimonInfoModal.jsx`** ⭐
    - `maxEnergy || maxStamina` 혼용 체크
    - 영향도: 중간

### 로직 파일
12. **`src/logic/stats/stats.js`** ⭐⭐
    - `initializeStats` 함수
    - `maxEnergy || maxStamina` 혼용 체크
    - 영향도: 높음

13. **`src/logic/food/protein.js`** ⭐
    - `maxEnergy || maxStamina` 혼용 체크
    - 영향도: 낮음

14. **`src/logic/battle/questEngine.js`** ⭐
    - 디지몬 데이터 접근
    - 영향도: 낮음

### 데이터 파일
15. **`src/data/v1/adapter.js`** ⭐⭐⭐
    - 제거 대상
    - 영향도: 제거

16. **`src/data/digimondata_digitalmonstercolor25th_ver1.js`** ⭐⭐⭐
    - 제거 대상 (백업 후)
    - 영향도: 제거

---

## 필드 매핑 테이블

### 필드명 변경 매핑

| 구 구조 (평면) | 새 구조 (중첩) | 변환 예시 |
|---------------|---------------|----------|
| `evolutionStage` | `stage` | `data.stage` |
| `timeToEvolveSeconds` | `evolutionCriteria.timeToEvolveSeconds` | `data.evolutionCriteria?.timeToEvolveSeconds` |
| `hungerTimer` | `stats.hungerCycle` | `data.stats?.hungerCycle` |
| `strengthTimer` | `stats.strengthCycle` | `data.stats?.strengthCycle` |
| `poopTimer` | `stats.poopCycle` | `data.stats?.poopCycle` |
| `maxOverfeed` | `stats.maxOverfeed` | `data.stats?.maxOverfeed` |
| `minWeight` | `stats.minWeight` | `data.stats?.minWeight` |
| `maxStamina` | `stats.maxEnergy` | `data.stats?.maxEnergy` |
| `sleepSchedule` | `stats.sleepSchedule` | `data.stats?.sleepSchedule` |
| `basePower` | `stats.basePower` | `data.stats?.basePower` |

### 접근 패턴 변경 예시

#### Before (구 구조)
```javascript
const digimonData = digimonDataVer1[name];
const maxEnergy = digimonData.maxStamina;
const hungerTimer = digimonData.hungerTimer;
const stage = digimonData.evolutionStage;
```

#### After (새 구조)
```javascript
const digimonData = newDigimonDataVer1[name];
const maxEnergy = digimonData.stats?.maxEnergy;
const hungerTimer = digimonData.stats?.hungerCycle;
const stage = digimonData.stage;
```

---

## 단계별 리팩토링 계획

### Phase 1: 준비 단계 (1-2일)

#### 1.1 백업 및 브랜치 생성
- [ ] `digimondata_digitalmonstercolor25th_ver1.js` 백업
- [ ] 리팩토링 전용 브랜치 생성: `refactor/unify-data-structure`
- [ ] 현재 상태 커밋

#### 1.2 영향도 분석 완료
- [x] 모든 사용 위치 파악
- [x] 필드 매핑 테이블 작성
- [ ] 각 파일별 변경 사항 문서화

#### 1.3 테스트 계획 수립
- [ ] 각 기능별 테스트 시나리오 작성
- [ ] 리팩토링 전 현재 동작 캡처 (스크린샷/로그)

### Phase 2: 유틸 함수 리팩토링 (2-3일)

#### 2.1 `useGameHandlers.js` 수정
- [ ] `getSleepSchedule` 함수 수정
  ```javascript
  // Before
  const sleepSchedule = digimonDataVer1[name].sleepSchedule;
  
  // After
  const sleepSchedule = newDigimonDataVer1[name]?.stats?.sleepSchedule;
  ```

#### 2.2 헬퍼 함수 생성
- [ ] `src/utils/digimonData.js` 생성
  ```javascript
  // 안전한 필드 접근 헬퍼 함수들
  export function getMaxEnergy(digimonData) {
    return digimonData?.stats?.maxEnergy || 0;
  }
  
  export function getHungerCycle(digimonData) {
    return digimonData?.stats?.hungerCycle || 0;
  }
  
  export function getStage(digimonData) {
    return digimonData?.stage || "Digitama";
  }
  ```

### Phase 3: Hooks 리팩토링 (3-4일)

#### 3.1 `useGameData.js` 수정
- [ ] `digimonDataVer1` → `newDigimonDataVer1` 변경
- [ ] 모든 필드 접근 패턴 수정
  ```javascript
  // Before
  const digimonData = digimonDataVer1[currentDigimonName];
  const maxEnergy = digimonData.stats?.maxEnergy || digimonStats.maxEnergy || digimonStats.maxStamina;
  
  // After
  const digimonData = newDigimonDataVer1[currentDigimonName];
  const maxEnergy = digimonData?.stats?.maxEnergy || digimonStats.maxEnergy || 100;
  ```

#### 3.2 `useEvolution.js` 수정
- [ ] `digimonDataVer1` 제거, `newDigimonDataVer1`만 사용
- [ ] 필드 접근 패턴 통일
  ```javascript
  // Before
  const newDigimonData = digimonDataVer1[newName] || {};
  const minWeight = newDigimonData.stats?.minWeight || newDigimonData.minWeight || 0;
  const maxEnergy = newDigimonData.stats?.maxEnergy || newDigimonData.stats?.maxStamina || ...;
  
  // After
  const newDigimonData = newDigimonDataVer1[newName];
  if (!newDigimonData) {
    console.error(`No data for ${newName}`);
    return;
  }
  const minWeight = newDigimonData.stats?.minWeight || 0;
  const maxEnergy = newDigimonData.stats?.maxEnergy || 100;
  ```

#### 3.3 `useGameState.js` 수정
- [ ] `digimonDataVer1` prop → `newDigimonDataVer1` prop 변경
- [ ] 내부 사용 패턴 수정

### Phase 4: 컴포넌트 리팩토링 (3-4일)

#### 4.1 `Game.jsx` 수정 ⭐⭐⭐
- [ ] 어댑터 import 제거
- [ ] `digimonDataVer1` 변수 제거
- [ ] `newDigimonDataVer1` 직접 사용
- [ ] 모든 하위 컴포넌트에 `newDigimonDataVer1` 전달
  ```javascript
  // Before
  import { adaptDataMapToOldFormat } from "../data/v1/adapter";
  import { digimonDataVer1 as newDigimonDataVer1 } from "../data/v1/digimons";
  const digimonDataVer1 = adaptDataMapToOldFormat(newDigimonDataVer1);
  
  // After
  import { digimonDataVer1 as newDigimonDataVer1 } from "../data/v1/digimons";
  // digimonDataVer1 변수 제거, newDigimonDataVer1 직접 사용
  ```

#### 4.2 `BattleScreen.jsx` 수정
- [ ] 이미 `newDigimonDataVer1` 사용 중이므로 필드 접근만 확인
- [ ] `stats.maxEnergy` 등 올바른 경로 사용 확인

#### 4.3 `ArenaScreen.jsx`, `SparringModal.jsx`, `QuestSelectionModal.jsx` 수정
- [ ] `digimonDataVer1` → `newDigimonDataVer1` 변경
- [ ] 필드 접근 패턴 수정

#### 4.4 `StatsPopup.jsx`, `DigimonInfoModal.jsx` 수정
- [ ] `maxEnergy || maxStamina` 혼용 체크 제거
- [ ] `stats.maxEnergy` 직접 사용

### Phase 5: 로직 파일 리팩토링 (2-3일)

#### 5.1 `logic/stats/stats.js` 수정
- [ ] `initializeStats` 함수 수정
- [ ] `maxEnergy || maxStamina` 혼용 체크 제거
  ```javascript
  // Before
  merged.energy = merged.maxEnergy || merged.maxStamina || merged.energy || 100;
  
  // After
  merged.energy = merged.maxEnergy || merged.energy || 100;
  ```

#### 5.2 `logic/food/protein.js` 수정
- [ ] `maxEnergy || maxStamina` 혼용 체크 제거

#### 5.3 `logic/battle/questEngine.js` 수정
- [ ] 디지몬 데이터 접근 패턴 수정

### Phase 6: 정리 및 제거 (1일)

#### 6.1 어댑터 제거
- [ ] `src/data/v1/adapter.js` 삭제
- [ ] 모든 import 제거

#### 6.2 구 데이터 파일 제거
- [ ] `src/data/digimondata_digitalmonstercolor25th_ver1.js` 삭제
- [ ] 모든 import 제거
- [ ] 백업 파일은 유지 (필요시)

#### 6.3 불필요한 import 정리
- [ ] 사용하지 않는 import 제거
- [ ] ESLint 경고 해결

### Phase 7: 테스트 및 검증 (2-3일)

#### 7.1 기능 테스트
- [ ] 게임 시작/로드 테스트
- [ ] 진화 테스트
- [ ] 배틀 테스트
- [ ] 퀘스트 테스트
- [ ] 아레나 테스트
- [ ] 스파링 테스트

#### 7.2 데이터 검증
- [ ] 모든 디지몬 데이터 로드 확인
- [ ] 필드 누락 확인
- [ ] 기본값 처리 확인

#### 7.3 성능 확인
- [ ] 어댑터 제거로 인한 성능 향상 확인
- [ ] 메모리 사용량 확인

---

## 고려사항 및 위험 요소

### 1. 데이터 누락 위험
**위험도**: 높음

**문제**: 새 데이터 구조에 일부 디지몬이 누락될 수 있음

**대응**:
- 리팩토링 전 모든 디지몬 데이터 검증
- 누락된 디지몬이 있으면 `digimons.js`에 추가
- 기본값 처리 로직 강화

### 2. 필드명 불일치
**위험도**: 중간

**문제**: `evolutionStage` vs `stage` 등 필드명 차이

**대응**:
- 필드 매핑 테이블 준수
- 일괄 검색/치환 사용
- 코드 리뷰 시 주의

### 3. 중첩 구조 접근
**위험도**: 중간

**문제**: `stats.maxEnergy` 등 옵셔널 체이닝 필요

**대응**:
- 모든 접근에 `?.` 사용
- 기본값 처리 명확히
- 헬퍼 함수 활용

### 4. 기존 저장 데이터 호환성
**위험도**: 낮음

**문제**: Firestore/localStorage에 저장된 데이터 구조

**대응**:
- 저장 데이터는 영향 없음 (스탯만 저장)
- 디지몬 데이터는 런타임에만 사용

### 5. 테스트 커버리지
**위험도**: 중간

**문제**: 리팩토링 범위가 넓어 테스트 누락 가능

**대응**:
- 단계별 테스트 수행
- 각 Phase 완료 후 검증
- 주요 기능 우선 테스트

---

## 테스트 전략

### 단위 테스트 (각 Phase별)
1. **필드 접근 테스트**
   ```javascript
   // 각 파일 수정 후
   const digimonData = newDigimonDataVer1['Botamon'];
   expect(digimonData.stats.maxEnergy).toBe(50);
   expect(digimonData.stats.hungerCycle).toBe(3);
   ```

2. **기본값 처리 테스트**
   ```javascript
   const digimonData = newDigimonDataVer1['Unknown'];
   expect(getMaxEnergy(digimonData)).toBe(0);
   ```

### 통합 테스트 (Phase 7)
1. **게임 플로우 테스트**
   - 디지몬 생성 → 진화 → 배틀 → 사망
   - 모든 단계에서 데이터 정상 로드 확인

2. **에러 케이스 테스트**
   - 존재하지 않는 디지몬 접근
   - 누락된 필드 접근
   - null/undefined 처리

### 수동 테스트 체크리스트
- [ ] 게임 시작 시 디지몬 정상 표시
- [ ] 진화 시 새 디지몬 데이터 정상 로드
- [ ] 배틀 시 파워 계산 정상
- [ ] 스탯 팝업에 모든 정보 정상 표시
- [ ] 수면 스케줄 정상 작동
- [ ] 퀘스트/아레나/스파링 정상 작동

---

## 마이그레이션 체크리스트

### Phase별 체크리스트

#### Phase 1: 준비
- [ ] 백업 완료
- [ ] 브랜치 생성
- [ ] 영향도 분석 완료

#### Phase 2: 유틸 함수
- [ ] `useGameHandlers.js` 수정 완료
- [ ] 헬퍼 함수 생성 완료
- [ ] 테스트 통과

#### Phase 3: Hooks
- [ ] `useGameData.js` 수정 완료
- [ ] `useEvolution.js` 수정 완료
- [ ] `useGameState.js` 수정 완료
- [ ] 테스트 통과

#### Phase 4: 컴포넌트
- [ ] `Game.jsx` 수정 완료
- [ ] 모든 모달 컴포넌트 수정 완료
- [ ] 테스트 통과

#### Phase 5: 로직
- [ ] `logic/stats/stats.js` 수정 완료
- [ ] `logic/food/protein.js` 수정 완료
- [ ] `logic/battle/questEngine.js` 수정 완료
- [ ] 테스트 통과

#### Phase 6: 정리
- [ ] 어댑터 파일 삭제
- [ ] 구 데이터 파일 삭제
- [ ] import 정리 완료
- [ ] ESLint 경고 해결

#### Phase 7: 최종 검증
- [ ] 모든 기능 테스트 통과
- [ ] 성능 확인 완료
- [ ] 문서 업데이트 완료
- [ ] 코드 리뷰 완료
- [ ] 메인 브랜치 머지

---

## 예상 소요 시간

- **Phase 1**: 1-2일
- **Phase 2**: 2-3일
- **Phase 3**: 3-4일
- **Phase 4**: 3-4일
- **Phase 5**: 2-3일
- **Phase 6**: 1일
- **Phase 7**: 2-3일

**총 예상 시간**: 14-20일 (약 2-3주)

---

## 리팩토링 후 기대 효과

### 1. 코드 품질
- ✅ 단일 데이터 소스로 관리 용이
- ✅ 필드 접근 패턴 일관성 향상
- ✅ 코드 가독성 향상

### 2. 유지보수성
- ✅ 필드 추가/수정 시 한 곳만 수정
- ✅ 버그 발생 가능성 감소
- ✅ 신규 개발자 온보딩 용이

### 3. 성능
- ✅ 어댑터 변환 오버헤드 제거
- ✅ 메모리 사용량 감소 (중복 데이터 제거)

### 4. 확장성
- ✅ 새 버전(Ver.2, Ver.3 등) 추가 용이
- ✅ 데이터 구조 확장 용이

---

## 참고 문서

- [REFACTORING_LOG.md](./REFACTORING_LOG.md) - 리팩토링 이력
- [DIGIMON_STATS_ANALYSIS.md](./DIGIMON_STATS_ANALYSIS.md) - 스탯 분석
- [EVOLUTION_SYSTEM_ANALYSIS.md](./EVOLUTION_SYSTEM_ANALYSIS.md) - 진화 시스템 분석

---

**작성일**: 2026-01-XX  
**작성자**: AI Assistant  
**상태**: 계획 단계

