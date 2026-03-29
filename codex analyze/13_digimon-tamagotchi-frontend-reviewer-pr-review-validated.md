# Digimon Tamagotchi Frontend PR Review

작성일: 2026-03-29  
기준: `reviewer.toml`의 PR 리뷰 관점  
범위: `digimon-tamagotchi-frontend` 전체 코드베이스 중 시간 기반 스탯, lazy update, 진화 조건, 배틀 계산, 저장 시점, 모달 상태 관리

## 리뷰 범위와 확인한 경로

- 정상 경로: `App -> Game -> 액션 Hook -> saveStats -> Firestore updateDoc`
- 실패 경로: 탭 이탈 저장, 실시간 타이머 기반 사망 판정, lazy update 직전/직후 사망 체크
- 통합 경계: Arena snapshot -> BattleScreen -> battle calculator, lights toggle -> saveStats -> direct updateDoc

이번 리뷰는 정적 코드 리뷰다. 실제 브라우저 재현이나 Firestore 실환경 동시성 검증은 하지 않았다.

## Findings

### [P1] 1초 타이머가 많은 외부 상태를 closure로 잡고 있는데 effect 재설정 의존성은 `digimonStats.isDead` 하나뿐이다

**근거**
- `src/pages/Game.jsx:448-809`
- 타이머 내부에서 `wakeUntil`, `isLightsOn`, `currentAnimation`, `dailySleepMistake`, `selectedDigimon`, `digimonDataForSlot`, `hasSeenDeathPopup`, `deathReason`를 직접 참조함.
- 그런데 effect dependency는 `src/pages/Game.jsx:809`의 `[digimonStats.isDead]`만 남아 있다.

**왜 위험한가**
- 조명 on/off, 기상 override, 선택 디지몬, 현재 애니메이션, death popup 상태가 바뀌어도 타이머는 같은 interval closure를 계속 사용한다.
- 이 경로는 배고픔/힘 감소, 수면 판정, 케어미스 증가, call timeout, death transition, 로그 추가까지 모두 담당하므로 stale closure가 바로 사용자 체감 버그로 이어질 수 있다.
- 특히 `handleToggleLights`에서 `isLightsOn`과 `fastSleepStart`를 바꾼 직후 타이머가 이전 값을 읽으면 수면/피로 판정이 늦게 반영되거나 잘못 누적될 수 있다.

**최소 대응 제안**
- 타이머가 참조하는 외부 값을 ref로 정리하거나, effect를 더 작은 타이머들로 분리해 dependency를 정직하게 맞추는 쪽이 안전하다.
- 최소한 lights/wake/sleep 관련 값에 대한 characterization 테스트가 먼저 필요하다.

### [P1] 굶주림/탈진 사망 판정이 경로마다 다르고, 일부 경로는 냉장고 시간을 제외하지 않는다

**근거**
- 실시간 타이머 경로: `src/pages/Game.jsx:632-652`
- lazy update 이후 사망 사유 판정: `src/hooks/useGameData.js:388-416`
- death hook의 사망 판정: `src/hooks/useDeath.js:123-182`
- lazy update 본체: `src/data/stats.js:387-620`

**왜 위험한가**
- `useDeath.checkDeathCondition()`은 굶주림/탈진 모두 냉장고 시간을 제외한다.
- 그런데 `Game.jsx` 타이머와 `useGameData.checkDeathStatus()`는 `Date.now() - lastHungerZeroAt` / `lastStrengthZeroAt`만 사용한다.
- 즉 같은 저장 데이터라도 “실시간 타이머에서 볼 때”와 “death hook에서 볼 때” 사망 여부가 달라질 수 있다.
- 냉장고에서 시간을 멈추는 규칙을 의도했다면 현재 구현은 굶주림/탈진 사망에서 그 규칙이 일관되지 않다.

**최소 대응 제안**
- 사망 조건 계산을 한 곳으로 수렴시키고, 냉장고 시간 제외 규칙을 굶주림/탈진/부상 방치 전부에 동일하게 적용해야 한다.
- 테스트는 `zeroAt -> freeze -> thaw` 시나리오를 최우선으로 고정하는 게 좋다.

### [P1] `applyLazyUpdateForAction()`은 서버의 `lastSavedAt`만 읽고, 실제 계산은 Firestore 슬롯 데이터가 아니라 현재 메모리 상태를 기준으로 한다

**근거**
- `src/hooks/useGameData.js:308-381`
- `slotSnap`에서 읽는 값은 사실상 `lastSavedAt`뿐이며 (`:356-360`), 실제 lazy update는 `applyLazyUpdate(digimonStats, lastSavedAt, ...)`로 수행된다 (`:362`).

**왜 위험한가**
- 메모리 상태가 이미 오래됐거나, 다른 write 경로에서 Firestore 문서가 먼저 바뀌었거나, unload save와 snapshot 반영 타이밍이 엇갈리면 계산 기준점이 어긋날 수 있다.
- 이 함수는 액션 직전의 기준 스탯을 만드는 핵심 경로라서, 여기서 drift가 생기면 먹이/훈련/배틀/환생 이후 저장 결과가 모두 오염된다.
- 로그 재구성도 `prevLogs.length` 기준 slice(`src/hooks/useGameData.js:361-369`)를 쓰고 있어서, 메모리 로그와 서버 로그가 어긋난 경우 잘못된 “새 로그” 판단이 생길 수 있다.

**최소 대응 제안**
- 기준 데이터를 메모리 단일 소스로 공식화할지, Firestore 문서를 기준으로 hydrate 후 계산할지 계약을 먼저 정해야 한다.
- 어느 쪽이든 multi-source drift를 잡는 characterization 테스트가 필요하다.

### [P2] 저장 시점이 `saveStats`, 실시간 타이머 예외 저장, 직접 `updateDoc`, unload 저장으로 분산돼 있어 회귀 위험이 크다

**근거**
- unload/visibility 저장: `src/pages/Game.jsx:404-428`
- 실시간 타이머 내 사망 저장과 경계 이벤트 저장: `src/pages/Game.jsx:767-799`
- selectedDigimon 직접 저장: `src/pages/Game.jsx:1048-1068`
- 조명 토글 후 추가 direct write: `src/hooks/useGameHandlers.js:273-326`
- 일반 액션 save: `src/hooks/useGameData.js:144-302`
- arena 결과 direct write: `src/hooks/useGameActions.js:706-757`

**왜 위험한가**
- 같은 상태 전이가 여러 저장 경로를 타면 어떤 필드가 어느 타이밍에 canonical인지 추적하기 어려워진다.
- `handleToggleLights()`는 `setDigimonStatsAndSave()`를 한 번 호출하고, 직후 `isLightsOn`만 다시 `updateDoc()`한다.
- `Game.jsx`의 timer는 사망 시 직접 `updateDoc()`를 하고, 다른 경계 이벤트는 `setDigimonStatsAndSave()`를 `setTimeout(..., 0)`으로 비동기 호출한다.
- 이런 구조는 “어떤 필드가 최신인지”, “어떤 경로가 activity log를 같이 저장하는지”, “어떤 에러가 swallow되는지”를 헷갈리게 만든다.

**최소 대응 제안**
- PR 관점에서 가장 작은 완화책은 저장 경로별 책임표를 먼저 문서화하고, 신규 write는 한 경로로만 추가하도록 강제하는 것이다.
- 이후에는 `saveStats` 하나로 합치거나, 적어도 direct write가 허용되는 예외 목록을 고정하는 편이 낫다.

### [P2] Arena 배틀은 상대 snapshot에 `power`가 없으면 실제 전투력 재계산 없이 `basePower`로 후퇴한다

**근거**
- Arena snapshot 생성: `src/components/ArenaScreen.jsx:571-596`
- Arena battle power 선택: `src/components/BattleScreen.jsx:162-180`
- Battle calculator의 적 파워 해석: `src/logic/battle/calculator.js:57-85`

**왜 위험한가**
- Arena 등록 시점에는 snapshot에 계산된 `power`를 넣는다.
- 하지만 battle 시점에는 snapshot power가 비어 있거나 0이면 `basePower`만 사용한다.
- `simulateBattle()` 역시 적 파워를 `enemyStats.power || enemyDigimon.stats?.basePower || 0`로 처리해, 상대 strength/effort/traited egg 보너스를 복구하지 않는다.
- 과거 스냅샷이나 부분 데이터가 들어오면 Arena 전투 난이도가 조용히 낮아질 수 있다.

**최소 대응 제안**
- Arena challenger snapshot 계약을 고정하고, 누락 시 fallback 규칙을 테스트로 명확히 박아두는 게 우선이다.

### [P2] 모달 전이가 boolean 조합과 imperative reset 체인에 의존해서 회귀에 취약하다

**근거**
- battle screen 렌더 조건: `src/components/GameModals.jsx:583-618`
- battle screen close에서 여러 상태를 수동 reset: `src/components/GameModals.jsx:601-615`
- 메뉴 클릭과 모달 오픈 분기: `src/hooks/useGameHandlers.js:147-190`
- `Game.jsx` 곳곳의 toast modal auto-close: `src/pages/Game.jsx:861`, `src/pages/Game.jsx:955`, `src/pages/Game.jsx:1034`, `src/pages/Game.jsx:1847`

**왜 위험한가**
- `modals.battleScreen` 하나만 true라고 화면이 열리는 게 아니라 `currentQuestArea || battleType === 'sparring' || battleType === 'arena'`까지 동시에 맞아야 한다.
- close 시에도 `battleType`, `sparringEnemySlot`, `arenaChallenger`, `arenaEnemyId`, `myArenaEntryId`를 순서 의존적으로 수동 reset한다.
- 이런 UI는 새 모달 경로나 새 battle mode가 추가될수록 “닫혔는데 상태가 남는다”, “상태는 있는데 화면이 안 뜬다” 같은 회귀가 나오기 쉽다.

**최소 대응 제안**
- 당장 코드를 바꾸지 않더라도 modal transition matrix를 문서화하고, battle/sparring/arena open-close 경로의 integration 테스트를 추가하는 게 좋다.

## 추가 관찰

### [P3] 진화 로직은 구조적으로 괜찮지만 테스트가 거의 없어서 경계값 회귀에 취약하다

**근거**
- `src/logic/evolution/checker.js:19-155`

**관찰 포인트**
- `timeToEvolveSeconds`가 `NaN`이면 `NOT_READY`로 처리한다 (`:45-55`).
- `conditionGroups`는 OR 그룹으로 평가하지만 실패 상세는 첫 번째 그룹 기준만 남긴다 (`:97-111`).
- `jogress`는 여기서 건너뛰고 다른 로직에 맡긴다 (`:113-117`).

**의미**
- 지금 당장 명백한 버그라고 단정할 근거는 부족하다.
- 대신 시간 경계, `conditionGroups`, `winRatio`/`battles` 경계값, 자동 진화 케이스를 테스트로 고정하지 않으면 데이터 변경 때 회귀가 날 가능성이 높다.

### [P3] 배틀 부상 확률 함수가 두 파일에 중복 구현되어 drift 위험이 있다

**근거**
- `src/logic/battle/calculator.js:197-203`
- `src/logic/battle/hitrate.js:151-158`

**의미**
- 현재 `useGameActions`는 `calculator` 쪽을 import하고 있지만, 중복된 규칙이 남아 있으면 이후 한쪽만 수정되는 drift가 생기기 쉽다.

## Missing Tests

### 최우선

1. 시간 기반 스탯 엔진 characterization 테스트
   - 대상: `src/data/stats.js`, `src/pages/Game.jsx` 타이머 경계
   - 케이스:
     - `lastSavedAt`에서 수 시간 지난 뒤 hunger/strength/poop/lifespan 동시 반영
     - 수면 시간 포함/미포함
     - `fullness`/`strength`가 0이 되는 순간 `lastHungerZeroAt`/`lastStrengthZeroAt` 기록
     - 냉장고 진입/해제 전후 경과 시간 제외

2. 사망 조건 일관성 테스트
   - 대상: `useDeath.checkDeathCondition`, `useGameData.checkDeathStatus`, 실시간 타이머 death branch
   - 케이스:
     - 굶주림 12시간, 탈진 12시간, 부상 방치 6시간
     - freeze 중 경과 시간 제외 여부
     - 동일 입력에서 세 경로가 같은 결과를 내는지 비교

3. 저장 타이밍 통합 테스트
   - 대상: `Game.jsx`, `useGameData`, `useGameHandlers`
   - 케이스:
     - lights toggle
     - tab hide / beforeunload
     - 사망 직후 저장
     - call timeout / care mistake 경계 이벤트 저장

### 다음 우선순위

4. 진화 조건 유닛 테스트
   - 대상: `src/logic/evolution/checker.js`
   - 케이스:
     - `conditions`
     - `conditionGroups`
     - `NaN`/undefined `timeToEvolveSeconds`
     - battle count / win ratio 경계값

5. Arena battle 계산 테스트
   - 대상: `src/components/BattleScreen.jsx`, `src/logic/battle/calculator.js`
   - 케이스:
     - snapshot power 존재
     - snapshot power 누락
     - basePower fallback
     - 속성 상성 보너스

6. 모달 상태 전이 integration 테스트
   - 대상: `src/components/GameModals.jsx`, `src/hooks/useGameHandlers.js`
   - 케이스:
     - quest -> battle -> close
     - sparring -> battle -> close
     - arena -> battle -> arena return
     - toast auto-close 후 상태 누수 여부

## 이번 리뷰에서 확인한 것 / 아직 런타임 확인이 필요한 것

### 코드상 확인한 것

- 실시간 타이머 dependency와 closure 사용 방식
- 사망 판정의 냉장고 시간 제외 규칙 불일치
- lazy update 직전 계산의 기준 데이터 불일치 가능성
- 저장 경로 분산과 direct write 예외 경로 존재
- Arena power fallback 규칙
- battle screen modal의 조합식 렌더 조건

### 런타임 검증이 더 필요한 것

- stale closure가 실제 브라우저에서 lights toggle 직후 얼마나 쉽게 드러나는지
- multi-tab 또는 snapshot 지연 상황에서 `applyLazyUpdateForAction()`이 실제로 데이터 drift를 만드는지
- `feed`/`food` 모달 키가 실제로 의도된 이중 상태인지, 아니면 과거 분리의 잔재인지

## 결론

현재 코드베이스는 기능은 풍부하지만, PR 리뷰 관점에서 가장 위험한 지점은 시간 기반 상태 엔진과 저장 경계가 여러 경로로 흩어져 있다는 점이다. 이번 범위에서 우선순위가 가장 높은 문제는 다음 세 가지다.

1. 실시간 타이머의 stale closure 가능성
2. 사망 조건의 경로별 규칙 불일치
3. lazy update 기준 데이터와 저장 시점의 분산

코드 수정 없이 다음 단계만 정한다면, 먼저 시간 엔진/사망 조건/저장 타이밍에 대한 characterization 테스트를 만들고, 그 다음에 저장 경계와 타이머 책임을 줄이는 리팩터링으로 넘어가는 순서가 가장 안전하다.
