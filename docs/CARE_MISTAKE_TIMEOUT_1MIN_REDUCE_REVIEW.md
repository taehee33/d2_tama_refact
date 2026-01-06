# 케어미스 타임아웃 1분 감소 기능 검토

## 📋 현재 구현 상태

### 현재 타임아웃 값
- **Hunger Call**: 10분 (10 * 60 * 1000 ms)
- **Strength Call**: 10분 (10 * 60 * 1000 ms)
- **Sleep Call**: 60분 (60 * 60 * 1000 ms)

### 사용 위치
1. `useGameLogic.js` - `checkCallTimeouts` 함수
2. `data/stats.js` - `applyLazyUpdate` 함수
3. `logic/stats/stats.js` - `applyLazyUpdate` 함수

---

## 💡 1분 감소 기능 설계 방안

### 방안 1: 각 타임아웃별 독립적인 감소량 저장 (권장)

#### 구조
```javascript
// localStorage에 저장할 구조
{
  hungerCallTimeoutReduce: 0,    // 감소한 분 수 (0 = 기본값)
  strengthCallTimeoutReduce: 0,  // 감소한 분 수
  sleepCallTimeoutReduce: 0      // 감소한 분 수
}
```

#### 동작 방식
- 버튼 클릭 시 각 타임아웃을 1분씩 감소
- 최소값 제한: 1분 (0분 이하로는 감소 불가)
- 기본값 복원 버튼도 제공

#### 예시
- 초기: Hunger Call = 10분, Strength Call = 10분, Sleep Call = 60분
- 1분 감소 1회: Hunger Call = 9분, Strength Call = 9분, Sleep Call = 59분
- 1분 감소 2회: Hunger Call = 8분, Strength Call = 8분, Sleep Call = 58분
- ...

#### 장점
- 각 타임아웃을 독립적으로 조절 가능
- 유연한 테스트 환경 제공
- 명확한 상태 관리

#### 단점
- 구현이 약간 복잡함
- localStorage에 3개의 값 저장 필요

---

### 방안 2: 통합 감소량 저장

#### 구조
```javascript
// localStorage에 저장할 구조
{
  careMistakeTimeoutReduce: 0  // 모든 타임아웃에 공통으로 적용되는 감소 분 수
}
```

#### 동작 방식
- 버튼 클릭 시 모든 타임아웃을 동시에 1분씩 감소
- 최소값 제한: 1분

#### 예시
- 초기: 모든 타임아웃 기본값
- 1분 감소 1회: 모든 타임아웃 -1분
- 1분 감소 2회: 모든 타임아웃 -2분
- ...

#### 장점
- 구현이 간단함
- localStorage에 1개의 값만 저장
- 모든 타임아웃을 동일하게 조절

#### 단점
- 개별 조절 불가능
- Sleep Call (60분)과 Hunger/Strength Call (10분)을 동일하게 감소시키면 Sleep Call이 더 오래 남음

---

### 방안 3: 비율 기반 감소

#### 구조
```javascript
// localStorage에 저장할 구조
{
  careMistakeTimeoutReducePercent: 0  // 감소 비율 (0 = 기본값, 10 = 10% 감소)
}
```

#### 동작 방식
- 버튼 클릭 시 각 타임아웃을 10%씩 감소
- 최소값 제한: 원래 값의 10%

#### 예시
- 초기: Hunger Call = 10분, Sleep Call = 60분
- 10% 감소 1회: Hunger Call = 9분, Sleep Call = 54분
- 10% 감소 2회: Hunger Call = 8.1분, Sleep Call = 48.6분
- ...

#### 장점
- 비율적으로 감소하여 균형 유지
- Sleep Call과 다른 Call의 비율 유지

#### 단점
- 소수점 처리 필요
- 직관적이지 않을 수 있음

---

## ✅ 권장 방안: 방안 1 (각 타임아웃별 독립적인 감소량)

### 구현 계획

#### 1. localStorage 관리 함수 추가
```javascript
// useGameState.js 또는 별도 유틸리티 파일
const getCareMistakeTimeoutReduce = () => {
  try {
    const saved = localStorage.getItem('digimon_care_mistake_timeout_reduce');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('케어미스 타임아웃 감소량 로드 오류:', error);
  }
  return {
    hungerCallTimeoutReduce: 0,
    strengthCallTimeoutReduce: 0,
    sleepCallTimeoutReduce: 0
  };
};

const saveCareMistakeTimeoutReduce = (reduces) => {
  try {
    localStorage.setItem('digimon_care_mistake_timeout_reduce', JSON.stringify(reduces));
  } catch (error) {
    console.error('케어미스 타임아웃 감소량 저장 오류:', error);
  }
};
```

#### 2. 타임아웃 계산 로직 수정
```javascript
// useGameLogic.js - checkCallTimeouts
const reduces = getCareMistakeTimeoutReduce();
const HUNGER_CALL_TIMEOUT = (10 - reduces.hungerCallTimeoutReduce) * 60 * 1000;
const STRENGTH_CALL_TIMEOUT = (10 - reduces.strengthCallTimeoutReduce) * 60 * 1000;
const SLEEP_CALL_TIMEOUT = (60 - reduces.sleepCallTimeoutReduce) * 60 * 1000;

// 최소값 제한 (1분)
const HUNGER_CALL_TIMEOUT = Math.max(1 * 60 * 1000, (10 - reduces.hungerCallTimeoutReduce) * 60 * 1000);
const STRENGTH_CALL_TIMEOUT = Math.max(1 * 60 * 1000, (10 - reduces.strengthCallTimeoutReduce) * 60 * 1000);
const SLEEP_CALL_TIMEOUT = Math.max(1 * 60 * 1000, (60 - reduces.sleepCallTimeoutReduce) * 60 * 1000);
```

#### 3. SettingsModal에 UI 추가
```javascript
// SettingsModal.jsx - 개발자 옵션 섹션
{localDevMode && (
  <div className="mb-4 pt-4 border-t border-gray-300">
    <h3 className="font-semibold mb-2">개발자 옵션</h3>
    
    {/* 케어미스 타임아웃 1분 감소 */}
    <div className="mb-3">
      <label className="block text-sm mb-1">케어미스 타임아웃 1분 감소</label>
      <p className="text-xs text-gray-600 mb-2">
        (테스트용: 각 호출 타임아웃을 1분씩 감소)
      </p>
      <div className="space-y-2">
        <div className="flex gap-2 items-center">
          <span className="text-sm w-24">Hunger Call:</span>
          <span className="text-sm">{10 - reduces.hungerCallTimeoutReduce}분</span>
          <button
            className="px-2 py-1 rounded text-xs bg-blue-500 text-white"
            onClick={() => handleReduceTimeout('hungerCallTimeoutReduce')}
            disabled={reduces.hungerCallTimeoutReduce >= 9}
          >
            -1분
          </button>
          <button
            className="px-2 py-1 rounded text-xs bg-gray-500 text-white"
            onClick={() => handleResetTimeout('hungerCallTimeoutReduce')}
            disabled={reduces.hungerCallTimeoutReduce === 0}
          >
            초기화
          </button>
        </div>
        {/* Strength Call, Sleep Call도 동일하게 */}
      </div>
    </div>
  </div>
)}
```

#### 4. 핸들러 함수 구현
```javascript
// SettingsModal.jsx
const [reduces, setReduces] = useState(() => getCareMistakeTimeoutReduce());

const handleReduceTimeout = (type) => {
  const newReduces = { ...reduces };
  // 최대 감소량 제한 (9분까지 감소 가능, 최소 1분)
  if (type === 'hungerCallTimeoutReduce' || type === 'strengthCallTimeoutReduce') {
    if (newReduces[type] < 9) {
      newReduces[type] += 1;
    }
  } else if (type === 'sleepCallTimeoutReduce') {
    if (newReduces[type] < 59) {
      newReduces[type] += 1;
    }
  }
  setReduces(newReduces);
  saveCareMistakeTimeoutReduce(newReduces);
};

const handleResetTimeout = (type) => {
  const newReduces = { ...reduces };
  newReduces[type] = 0;
  setReduces(newReduces);
  saveCareMistakeTimeoutReduce(newReduces);
};

const handleResetAllTimeouts = () => {
  const defaultReduces = {
    hungerCallTimeoutReduce: 0,
    strengthCallTimeoutReduce: 0,
    sleepCallTimeoutReduce: 0
  };
  setReduces(defaultReduces);
  saveCareMistakeTimeoutReduce(defaultReduces);
};
```

---

## 🔄 적용 위치

### 수정이 필요한 파일
1. **`useGameLogic.js`** - `checkCallTimeouts` 함수
2. **`data/stats.js`** - `applyLazyUpdate` 함수
3. **`logic/stats/stats.js`** - `applyLazyUpdate` 함수
4. **`useGameState.js`** - localStorage 관리 함수 추가 (또는 별도 유틸리티 파일)
5. **`SettingsModal.jsx`** - UI 및 핸들러 추가

---

## ⚠️ 주의사항

1. **최소값 제한**: 각 타임아웃은 최소 1분으로 제한
2. **즉시 반영**: localStorage에 저장하되, 게임 로직에서도 즉시 읽어서 적용
3. **기본값 복원**: 모든 감소량을 0으로 초기화하는 버튼 제공
4. **개발자 모드 전용**: 일반 사용자는 접근 불가

---

## 📊 예상 동작

### 초기 상태
- Hunger Call: 10분
- Strength Call: 10분
- Sleep Call: 60분

### 1분 감소 5회 후
- Hunger Call: 5분
- Strength Call: 5분
- Sleep Call: 55분

### 초기화 버튼 클릭 후
- 모든 타임아웃이 기본값으로 복원

---

## 🎯 결론

**방안 1 (각 타임아웃별 독립적인 감소량)**을 권장합니다.

**이유**:
- 유연한 테스트 환경 제공
- 각 타임아웃을 독립적으로 조절 가능
- 명확한 상태 관리
- 구현 난이도가 적당함

**구현 가능 여부**: ✅ 가능

**예상 작업 시간**: 약 1-2시간

