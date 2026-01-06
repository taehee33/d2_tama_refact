# 디지몬 이름 한글화 분석

## 📋 현재 구현 상태

### 디지몬 이름 정의 위치
- **주요 파일**: `digimon-tamagotchi-frontend/src/data/v1/digimons.js`
- **구조**: 객체 키와 `name` 속성 모두 영어로 정의됨

```javascript
export const digimonDataVer1 = {
  Botamon: {
    id: "Botamon",
    name: "Botamon",  // 표시용 이름
    stage: "Baby I",
    // ...
    evolutions: [
      {
        targetId: "Koromon",  // 진화 대상 ID (키로 사용)
        targetName: "Koromon", // 진화 대상 이름
      }
    ]
  }
}
```

---

## 🔍 디지몬 이름 사용처 분석

### 1. 객체 키로 사용 (가장 중요)
**위치**: 전역적으로 사용
```javascript
// Game.jsx, useEvolution.js 등
const digimonData = digimonDataVer1[selectedDigimon];
const currentDigimonData = newDigimonDataVer1[digimonName];
```

**문제점**:
- 객체 키는 JavaScript 식별자 규칙을 따라야 함
- 한글을 키로 사용하면 문법적으로는 가능하지만:
  - `digimonDataVer1["아구몬"]` 형태로 접근해야 함
  - 점 표기법(`digimonDataVer1.아구몬`) 사용 불가
  - 코드 가독성 저하
  - IDE 자동완성 지원 제한

### 2. Firestore 저장 필드
**위치**: `useGameData.js`, `Game.jsx`
```javascript
// Firestore에 저장
await updateDoc(slotRef, {
  selectedDigimon: name,  // "Botamon" 형태로 저장
  // ...
});
```

**문제점**:
- 기존 저장된 데이터와 호환성 문제
- 마이그레이션 필요
- 데이터베이스 쿼리 시 한글 검색 이슈 가능

### 3. 진화 경로 (targetId, targetName)
**위치**: `digimons.js`의 `evolutions` 배열
```javascript
evolutions: [
  {
    targetId: "Koromon",    // 진화 대상 키
    targetName: "Koromon",  // 진화 대상 표시명
  }
]
```

**문제점**:
- `targetId`는 객체 키로 사용되므로 한글화 시 모든 참조 수정 필요
- 진화 로직에서 `digimonDataMap[targetId]` 형태로 접근
- 한 곳이라도 누락되면 진화 실패

### 4. UI 표시용 (name 필드)
**위치**: `DigimonInfoModal.jsx`, `GameScreen.jsx` 등
```javascript
<p>{currentDigimonData.name || currentDigimonName}</p>
```

**문제점**:
- 가장 안전하게 변경 가능한 부분
- `name` 필드만 한글로 변경하면 UI에 한글로 표시됨

### 5. 로컬스토리지 저장
**위치**: `useGameData.js`
```javascript
localStorage.setItem(`digimon_slot${slotId}_selectedDigimon`, name);
```

**문제점**:
- 기존 저장된 데이터와 호환성 문제
- 마이그레이션 필요

### 6. 진화 체크 로직
**위치**: `logic/evolution/checker.js`
```javascript
const targetData = digimonDataMap[targetId];
if (!targetData) {
  // 진화 실패
}
```

**문제점**:
- `targetId`가 한글이면 모든 참조를 수정해야 함
- 한 곳이라도 누락되면 런타임 에러

---

## ⚠️ 한글화 시 발생 가능한 문제점

### 문제 1: 객체 키 변경의 복잡성
**영향도**: 🔴 **매우 높음**

**현재**:
```javascript
digimonDataVer1["Botamon"]  // 또는 digimonDataVer1.Botamon
```

**한글화 후**:
```javascript
digimonDataVer1["보타몬"]  // 점 표기법 불가
```

**필요한 작업**:
- 모든 객체 키를 한글로 변경
- 모든 참조 코드 수정 (수백 곳)
- 진화 경로의 모든 `targetId` 수정

### 문제 2: 기존 데이터 호환성
**영향도**: 🔴 **매우 높음**

**문제**:
- Firestore에 저장된 `selectedDigimon: "Botamon"` 데이터
- 로컬스토리지에 저장된 데이터
- 기존 사용자 데이터와 호환 불가

**해결 방안**:
- 마이그레이션 스크립트 필요
- 영어 → 한글 매핑 테이블 필요
- 데이터 변환 로직 구현

### 문제 3: 코드 가독성 및 유지보수
**영향도**: 🟡 **중간**

**문제**:
- 한글 키는 점 표기법 사용 불가
- IDE 자동완성 제한
- 코드 검색/리팩토링 어려움

**예시**:
```javascript
// 영어 (현재)
const data = digimonDataVer1.Botamon;

// 한글 (변경 후)
const data = digimonDataVer1["보타몬"];  // 점 표기법 불가
```

### 문제 4: 진화 로직 복잡도 증가
**영향도**: 🟡 **중간**

**문제**:
- 진화 경로의 모든 `targetId` 수정 필요
- 한 곳이라도 누락되면 진화 실패
- 디버깅 어려움

### 문제 5: 외부 API/라이브러리 호환성
**영향도**: 🟢 **낮음** (현재는 해당 없음)

**문제**:
- 향후 외부 API 연동 시 영어 이름 필요할 수 있음
- 국제화(i18n) 대응 어려움

---

## ✅ 권장 해결 방안

### 방안 1: 이중 구조 유지 (권장) ⭐

**구조**:
```javascript
export const digimonDataVer1 = {
  Botamon: {  // 키는 영어 유지
    id: "Botamon",
    name: "보타몬",  // 표시용만 한글
    nameEn: "Botamon",  // 영어 이름도 유지 (필요시)
    stage: "Baby I",
    evolutions: [
      {
        targetId: "Koromon",  // 키는 영어 유지
        targetName: "코로몬",  // 표시용만 한글
      }
    ]
  }
}
```

**장점**:
- ✅ 기존 코드 수정 최소화
- ✅ 기존 데이터 호환성 유지
- ✅ 점 표기법 사용 가능
- ✅ IDE 자동완성 지원
- ✅ UI에만 한글 표시

**단점**:
- ⚠️ `name` 필드만 수정 필요 (작업량 적음)

**필요한 작업**:
1. `digimons.js`의 모든 `name` 필드를 한글로 변경
2. `evolutions` 배열의 `targetName`을 한글로 변경
3. UI에서 `name` 필드 사용 확인

### 방안 2: 완전 한글화

**구조**:
```javascript
export const digimonDataVer1 = {
  "보타몬": {  // 키도 한글
    id: "보타몬",
    name: "보타몬",
    // ...
  }
}
```

**장점**:
- ✅ 완전한 한글화
- ✅ 코드에서도 한글 사용

**단점**:
- ❌ 모든 코드 수정 필요 (수백 곳)
- ❌ 기존 데이터 마이그레이션 필요
- ❌ 점 표기법 사용 불가
- ❌ IDE 자동완성 제한
- ❌ 유지보수 어려움

**필요한 작업**:
1. 모든 객체 키를 한글로 변경
2. 모든 참조 코드 수정
3. Firestore 데이터 마이그레이션
4. 로컬스토리지 데이터 마이그레이션
5. 진화 경로의 모든 `targetId` 수정

### 방안 3: 매핑 테이블 사용

**구조**:
```javascript
// 이름 매핑 테이블
const digimonNameMap = {
  "Botamon": "보타몬",
  "Koromon": "코로몬",
  // ...
};

// 데이터는 영어 유지
export const digimonDataVer1 = {
  Botamon: {
    id: "Botamon",
    name: "Botamon",
    // ...
  }
}

// UI에서 사용
const koreanName = digimonNameMap[digimonData.name] || digimonData.name;
```

**장점**:
- ✅ 기존 코드 수정 없음
- ✅ 기존 데이터 호환성 유지
- ✅ 한글/영어 전환 가능

**단점**:
- ⚠️ 매핑 테이블 유지 필요
- ⚠️ UI에서 매번 변환 필요

---

## 📊 작업량 비교

| 방안 | 코드 수정 | 데이터 마이그레이션 | 작업 시간 | 위험도 |
|------|----------|-------------------|----------|--------|
| 방안 1 (이중 구조) | 적음 (~50줄) | 불필요 | 1-2시간 | 낮음 |
| 방안 2 (완전 한글화) | 많음 (수백 곳) | 필요 | 10-20시간 | 높음 |
| 방안 3 (매핑 테이블) | 적음 (~100줄) | 불필요 | 2-3시간 | 낮음 |

---

## 🎯 최종 권장사항

**방안 1 (이중 구조 유지)**을 강력히 권장합니다.

**이유**:
1. 작업량이 가장 적음
2. 기존 코드와 데이터 호환성 유지
3. 유지보수 용이
4. UI에만 한글 표시 (사용자 경험 개선)
5. 향후 확장성 (영어 이름도 유지 가능)

**구현 단계**:
1. `digimons.js`의 모든 `name` 필드를 한글로 변경
2. `evolutions` 배열의 `targetName`을 한글로 변경
3. UI 컴포넌트에서 `name` 필드 사용 확인
4. 테스트: 진화, 저장/로드, UI 표시

---

## 📝 참고사항

### 현재 name 필드 사용처
- `DigimonInfoModal.jsx`: `currentDigimonData.name`
- `GameScreen.jsx`: 디지몬 이름 표시
- `EvolutionGuideModal.jsx`: 진화 경로 표시
- 기타 UI 컴포넌트

### 변경 시 주의사항
- `name` 필드만 변경하고 `id`와 객체 키는 유지
- 진화 로직은 `targetId`를 사용하므로 영향 없음
- Firestore 저장은 `selectedDigimon` (키)를 사용하므로 영향 없음

