# 디지몬 종 고정 파라미터 분석

## 📋 요청된 필드 목록

사용자가 확인을 요청한 필드들:
1. **Power**: 30
2. **Min Weight**: 20
3. **Sleep Time**: 8:00 PM
4. **Heal Doses**: 2
5. **Energy (DP)**: 20
6. **Hunger Loss**: 48 Minutes
7. **Strength Loss**: 48 Minutes

---

## 🔍 현재 데이터 구조 분석

### 파일 위치
- **주요 데이터 파일**: `digimon-tamagotchi-frontend/src/data/v1/digimons.js`
- **구버전 데이터 파일**: `digimon-tamagotchi-frontend/src/data/digimondata_digitalmonstercolor25th_ver1.js`

### 데이터 스키마 (`digimons.js`)

```javascript
{
  id: "Agumon",
  name: "Agumon",
  stage: "Child",
  sprite: 240,
  stats: {
    hungerCycle: 48,        // ✅ Hunger Loss (분)
    strengthCycle: 48,       // ✅ Strength Loss (분)
    poopCycle: 120,
    maxOverfeed: 4,
    basePower: 30,           // ✅ Power
    maxEnergy: 20,           // ✅ Energy (DP)
    minWeight: 20,           // ✅ Min Weight
    type: "Vaccine",
    sleepTime: "20:00",      // ✅ Sleep Time (HH:MM 형식)
    attackSprite: 4,
    // ❌ healDoses: 없음
  },
  evolutionCriteria: { ... },
  evolutions: [ ... ]
}
```

---

## ✅ 필드 존재 여부 분석

### 1. Power (basePower)
- **필드명**: `stats.basePower`
- **상태**: ✅ **존재함**
- **예시**: Agumon의 경우 `basePower: 30`
- **용도**: 배틀 파워 계산에 사용

### 2. Min Weight (minWeight)
- **필드명**: `stats.minWeight`
- **상태**: ✅ **존재함**
- **예시**: Agumon의 경우 `minWeight: 20`
- **용도**: 진화 시 체중 리셋 값으로 사용

### 3. Sleep Time (sleepTime)
- **필드명**: `stats.sleepTime`
- **상태**: ✅ **존재함**
- **형식**: `"HH:MM"` (예: `"20:00"` = 8:00 PM)
- **예시**: Agumon의 경우 `sleepTime: "20:00"`
- **용도**: 수면 스케줄 계산에 사용

### 4. Heal Doses (healDoses)
- **필드명**: `stats.healDoses`
- **상태**: ❌ **존재하지 않음**
- **현재 동작**: 
  - `useGameAnimations.js`의 `healCycle` 함수에서 사용
  - `currentDigimonData.stats?.healDoses || 1`로 접근
  - **기본값 1**을 사용 (필드가 없을 경우)
- **문제점**: 
  - 디지몬별로 다른 치료 횟수가 필요한데, 모든 디지몬이 기본값 1을 사용
  - 매뉴얼에 따르면 디지몬마다 다른 치료 횟수가 필요할 수 있음

### 5. Energy (DP) (maxEnergy)
- **필드명**: `stats.maxEnergy`
- **상태**: ✅ **존재함**
- **예시**: Agumon의 경우 `maxEnergy: 20`
- **용도**: 최대 에너지(DP) 제한으로 사용

### 6. Hunger Loss (hungerCycle)
- **필드명**: `stats.hungerCycle`
- **상태**: ✅ **존재함**
- **단위**: 분 (Minutes)
- **예시**: Agumon의 경우 `hungerCycle: 48` (48분)
- **용도**: 배고픔 감소 주기 계산에 사용

### 7. Strength Loss (strengthCycle)
- **필드명**: `stats.strengthCycle`
- **상태**: ✅ **존재함**
- **단위**: 분 (Minutes)
- **예시**: Agumon의 경우 `strengthCycle: 48` (48분)
- **용도**: 힘 감소 주기 계산에 사용

---

## 📊 실제 디지몬 데이터 예시

### Agumon (Child)
```javascript
Agumon: {
  id: "Agumon",
  name: "Agumon",
  stage: "Child",
  sprite: 240,
  stats: {
    hungerCycle: 48,        // ✅ 48 Minutes
    strengthCycle: 48,       // ✅ 48 Minutes
    poopCycle: 120,
    maxOverfeed: 4,
    basePower: 30,           // ✅ Power: 30
    maxEnergy: 20,           // ✅ Energy (DP): 20
    minWeight: 20,           // ✅ Min Weight: 20
    type: "Vaccine",
    sleepTime: "20:00",      // ✅ Sleep Time: 8:00 PM
    attackSprite: 4,
    // ❌ healDoses: 없음 (기본값 1 사용)
  }
}
```

### Botamon (Baby I)
```javascript
Botamon: {
  id: "Botamon",
  name: "Botamon",
  stage: "Baby I",
  sprite: 210,
  stats: {
    hungerCycle: 3,          // ✅ 3 Minutes
    strengthCycle: 3,         // ✅ 3 Minutes
    poopCycle: 3,
    maxOverfeed: 3,
    basePower: 0,            // ✅ Power: 0
    maxEnergy: 0,            // ✅ Energy (DP): 0
    minWeight: 5,            // ✅ Min Weight: 5
    type: "Free",
    sleepTime: null,         // ✅ Sleep Time: null (수면 없음)
    attackSprite: 1,
    // ❌ healDoses: 없음 (기본값 1 사용)
  }
}
```

---

## ⚠️ 발견된 문제점

### 1. Heal Doses 필드 누락
- **문제**: `stats.healDoses` 필드가 디지몬 데이터에 정의되어 있지 않음
- **현재 동작**: 모든 디지몬이 기본값 1을 사용
- **영향**: 
  - 디지몬별로 다른 치료 횟수가 필요한 경우를 처리할 수 없음
  - 매뉴얼에 따르면 일부 디지몬은 2회 이상의 치료가 필요할 수 있음
- **해결 방안**: 
  - 각 디지몬의 `stats` 객체에 `healDoses` 필드 추가
  - 기본값은 1로 유지하되, 필요한 디지몬은 명시적으로 설정

---

## 📝 권장 사항

### 1. Heal Doses 필드 추가
각 디지몬 데이터에 `healDoses` 필드를 추가해야 합니다:

```javascript
// 예시: Agumon에 healDoses 추가
Agumon: {
  stats: {
    // ... 기존 필드들 ...
    healDoses: 2,  // 치료 필요 횟수 (기본값 1)
  }
}
```

### 2. 데이터 일관성 확인
- 모든 디지몬이 필수 필드를 가지고 있는지 확인
- 누락된 필드가 있으면 기본값 또는 null로 명시적으로 표시

### 3. 문서화
- 각 필드의 의미와 용도를 명확히 문서화
- 필드 단위(분, 시간, 퍼센트 등)를 명시

---

## 📌 요약

| 필드 | 필드명 | 상태 | 비고 |
|------|--------|------|------|
| Power | `basePower` | ✅ 존재 | 모든 디지몬에 정의됨 |
| Min Weight | `minWeight` | ✅ 존재 | 모든 디지몬에 정의됨 |
| Sleep Time | `sleepTime` | ✅ 존재 | "HH:MM" 형식, 일부는 null |
| **Heal Doses** | `healDoses` | ❌ **누락** | **기본값 1 사용, 필드 추가 필요** |
| Energy (DP) | `maxEnergy` | ✅ 존재 | 모든 디지몬에 정의됨 |
| Hunger Loss | `hungerCycle` | ✅ 존재 | 분 단위 |
| Strength Loss | `strengthCycle` | ✅ 존재 | 분 단위 |

---

**작성일**: 2026-01-03  
**분석 대상**: `digimon-tamagotchi-frontend/src/data/v1/digimons.js`


