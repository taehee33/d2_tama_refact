# 덱 배틀 "카드 선택 완료 후 한 번에 끝나는" 원인 분석

## 1. 설계상 동작 (의도된 부분)

덱 배틀은 **1라운드 = 1배틀**로 설계되어 있습니다.

- `useRealtimeBattle.js` 266–307행: `const r = 1`로 **라운드를 1번만** 돌린다.
- 카드 선택이 끝나면(양쪽 선택 또는 25초 타임아웃):
  1. `resolveDeckRound(hCard, gCard, ...)` 호출
  2. `round` 메시지 발행 (라운드 결과)
  3. **곧이어** `resolveDeckBattleWinner(uh, eh, roomSeed)`로 승자 결정
  4. `result` 메시지 발행 (`winner`, `userHits`, `enemyHits`)
  5. `setBattleWinner(winner)`, `updateRoom(..., { status: 'finished', winner })`

즉, **“카드 선택 완료 → 곧바로 승/패 결과”는 현재 설계와 일치합니다.**  
(이전 요청 “한번 딱 싸워야 하는데 라운드 마다 끝나고 계속 싸워”에 따라 1라운드만 진행하도록 바뀐 상태입니다.)

---

## 2. “한 번에 끝난다”고 느끼는 구체적 원인

### 2-1. 라운드 결과와 최종 결과 사이에 지연이 없음

- 호스트가 `round` publish 직후 **딜레이 없이** `result`를 publish한다 (304–306행).
- 게스트/호스트 모두:
  - `round` 수신 → `setUserHits`, `setEnemyHits`, `setBattleLog` 등으로 라운드 결과 반영
  - 거의 동시에 `result` 수신 → `setBattleWinner(winner)` 호출

그래서 화면에서는 “라운드 1 결과(로그/히트)”가 잠깐 보이기도 전에, 혹은 거의 동시에 승/패 화면으로 넘어갈 수 있습니다.

### 2-2. BattleScreen이 winner만 보면 바로 결과 화면으로 전환

- `Game.jsx`: 훅의 `battleWinner` 등을 `realtimeBattleResult`에 반영하는 `useEffect`가 있음.
- `BattleScreen.jsx` 342–363행: `realtimeBattleResult`가 바뀔 때  
  `winner != null`이면 곧바로 `setBattleState('victory')` 또는 `setBattleState('result')` 호출.

즉, **라운드 결과(playing) 단계를 거의 두지 않고**, winner가 세팅되는 즉시 LOSE/WIN 모달로 전환됩니다.  
그래서 사용자 입장에서는 “카드만 고르면 바로 끝난다”고 느낄 수 있습니다.

### 2-3. 요약

| 구분 | 내용 |
|------|------|
| 설계 | 1라운드만 진행 → 1판에 승패 결정 (의도된 동작) |
| 체감 원인 | round 결과 표시와 result(승/패) 전환 사이에 **딜레이가 없음** → 라운드 로그/히트를 제대로 보기 전에 LOSE/WIN이 뜸 |

---

## 3. 개선 방향 (선택)

“한 번에 끝난다”는 느낌을 줄이려면:

1. **라운드 결과를 잠깐 보여준 뒤 승패 화면으로 넘기기**
   - 호스트: `round` publish 후, `result` publish 전에 **1.5~2초** 정도 `await new Promise(r => setTimeout(r, 1500))` 추가.
   - 그러면 양쪽 클라이언트에서 “라운드 1 결과(히트/로그)”를 짧게 본 다음 승/패 모달이 뜨도록 할 수 있음.

2. **BattleScreen에서만 지연 주기**
   - `battleWinner`가 처음으로 non-null이 될 때, 1~2초 뒤에만 `setBattleState('result'/'victory')`를 호출하도록 수정.
   - 서버(호스트) 쪽은 그대로 두고, 결과 화면 전환만 늦추는 방식.

3. **다중 라운드(3선승 등)로 변경**
   - 1라운드 = 1배틀이 아니라, 3히트 선승 등으로 바꾸면 “한 판”이 여러 라운드로 이어져서 체감이 달라질 수 있음.  
     이 경우 `useRealtimeBattle.js` 덱 루프를 여러 라운드 반복 구조로 확장해야 함.

---

## 4. 관련 파일

- `digimon-tamagotchi-frontend/src/hooks/useRealtimeBattle.js` 261–307행: 덱 배틀 1라운드 + 즉시 result 발행
- `digimon-tamagotchi-frontend/src/pages/Game.jsx`: `realtimeBattleResult`에 `battleWinner` 동기화
- `digimon-tamagotchi-frontend/src/components/BattleScreen.jsx` 342–363행: `battleWinner` 시 결과 화면 전환
