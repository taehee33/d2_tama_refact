# 단백질 시스템 개선 (방안 1 적용)

## 📅 날짜: 2026-01-03

## 변경 사항

### 1. `src/logic/food/protein.js` - `willRefuseProtein` 함수 수정

**변경 전:**
```javascript
export function willRefuseProtein(stats) {
  // 힘이 가득 찬 경우 거부
  return stats.strength >= 5;
}
```

**변경 후:**
```javascript
export function willRefuseProtein(stats) {
  // strength가 5여도 단백질을 먹을 수 있음 (energy와 proteinOverdose를 위해)
  // proteinOverdose가 최대치(7)에 도달했을 때만 거부
  const proteinOverdose = stats.proteinOverdose || 0;
  return proteinOverdose >= 7;
}
```

### 2. `src/hooks/useGameActions.js` - 거부 메시지 개선

**변경 전:**
```javascript
text: 'Feed: Refused (Already stuffed)',
```

**변경 후:**
```javascript
text: proteinOverdose >= 7 
  ? 'Feed: Refused (Protein Overdose max reached: 7/7)' 
  : 'Feed: Refused',
```

## 효과

### 변경 전:
- 단백질 최대 5개만 먹을 수 있음 (`strength >= 5`일 때 거부)
- `proteinOverdose` 최대값: 1 (4개째에만 +1)
- `proteinOverdose` 최대값 7을 달성할 수 없음

### 변경 후:
- 단백질 최대 28개까지 먹을 수 있음 (`proteinOverdose >= 7`일 때만 거부)
- `strength`가 5여도 계속 먹을 수 있음
- `proteinOverdose` 최대값: 7 (28개째에 달성)
- 전략적 선택: `energy` 회복 vs `proteinOverdose` 위험

## 시나리오

### 단백질 먹이기 시나리오:

1. **단백질 1-4개**: `strength` 증가 (0→1→2→3→4), `proteinCount` 증가
2. **단백질 4개째**: `proteinOverdose: 0 → 1` (4의 배수)
3. **단백질 5개**: `strength: 4 → 5`, `proteinCount: 4 → 5`
4. **단백질 6-7개**: `strength` 변화 없음 (5 유지), `proteinCount` 계속 증가
5. **단백질 8개째**: `proteinOverdose: 1 → 2` (4의 배수)
6. **단백질 12개째**: `proteinOverdose: 2 → 3`
7. **단백질 16개째**: `proteinOverdose: 3 → 4`
8. **단백질 20개째**: `proteinOverdose: 4 → 5`
9. **단백질 24개째**: `proteinOverdose: 5 → 6`
10. **단백질 28개째**: `proteinOverdose: 6 → 7` (최대치 달성)
11. **단백질 29개 시도**: 거부됨 (`proteinOverdose >= 7`)

## 관련 파일

- `digimon-tamagotchi-frontend/src/logic/food/protein.js`
- `digimon-tamagotchi-frontend/src/hooks/useGameActions.js`
- `docs/PROTEIN_SYSTEM_ANALYSIS.md` (분석 문서)

