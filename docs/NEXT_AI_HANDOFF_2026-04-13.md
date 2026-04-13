# 2026-04-13 다음 AI 인수인계 메모

## 한 줄 요약
- 지금은 **멈춰도 안전한 시점**이다.
- 안정 기준점은 원격 `main`의 `0ea65b3` `docs: add development workflow guardrails`까지다.
- 다만 현재 워킹트리에는 **커뮤니티 작성자명 fallback 수정 WIP**와 `.DS_Store` 삭제가 남아 있으니, 다음 AI는 이 부분부터 먼저 정리해야 한다.

## 지금 멈춰도 되는 이유
- 최근 대형 리팩터링은 의미 있는 체크포인트마다 커밋/푸시가 끝난 상태다.
- 구조 분리 운영 규칙도 [AGENTS.md](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/AGENTS.md)에 반영되어 있다.
- 현재 추가로 열어야 할 다음 큰 작업은 `useGameData.saveStats` 분리인데, 영향 범위가 크므로 세션 종료 직전에 새로 시작하지 않는 편이 낫다.

## 현재 워킹트리 상태
- **안정 기준점:** `main @ 0ea65b3`
- **남아 있는 미커밋 변경:**
  - [community.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/api/_lib/community.js)
  - [firebaseAdmin.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/api/_lib/firebaseAdmin.js)
  - [REFACTORING_LOG.md](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/docs/REFACTORING_LOG.md)
  - [community-lib.test.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/tests/community-lib.test.js)
  - `.DS_Store` 삭제 1건

## 현재 미커밋 WIP의 의미
- 목적은 **커뮤니티 작성자명 해석을 최신 테이머명 저장 구조와 맞추는 것**이다.
- 현재 커뮤니티 API는 작성자명을 읽을 때:
  - `users/{uid}/profile/main.tamerName`
  - 없으면 root `users/{uid}.tamerName`
  - 없으면 root `users/{uid}.displayName`
  - 마지막으로 토큰/이메일 fallback
  순서로 내려가도록 수정되어 있다.
- 이 변경은 자랑게시판 댓글/게시글 작성자명이 예전 표시 이름으로 저장되던 문제를 막기 위한 것이다.

## 이 WIP의 검증 상태
- `cd digimon-tamagotchi-frontend && NODE_OPTIONS=--openssl-legacy-provider npm run build`
  - **성공**
- `node --test tests/community-lib.test.js`
  - **현재 환경에서는 전체 녹색 게이트로 쓰기 어렵다**
  - 이유: 기존 여러 테스트가 Firestore Admin 서비스 계정 환경 변수를 요구해서 실패한다.
  - 새로 추가된 회귀 테스트 `resolveAuthorTamerName는 profile/main의 테이머명을 root displayName보다 우선한다` 자체는 통과했다.

## 지금까지 왜 이런 리팩터링을 했는지
- **`Game.jsx`와 페이지 조립 분리**
  - 화면 조립, immersive layout, 페이지 액션 흐름을 presenter/helper/hook으로 나눠 페이지 비대화를 줄였다.
- **대형 gameplay hook 분리**
  - `useEvolution`, `useGameData`, `useGameActions`, `useGameLogic`에서 outcome/log/persistence/runtime 계산을 helper로 계속 분리했다.
  - 목적은 저장 규칙과 로그 조립, 배틀 결과, 수면 경고, 진화 조건 같은 위험 구간을 테스트 가능한 단위로 고정하는 것이었다.
- **소형 훅 정리**
  - `useDeath`, `useFridge`, `useGameAnimations`, `useGameHandlers`, `useArenaLogic`도 1차 이상 분리했다.
- **운영 규칙 문서화**
  - 앞으로는 큰 파일에 기능을 바로 누적하지 않도록 분리 우선 / 사용자 확인 / 체크포인트 커밋 규칙을 문서화했다.

## 현재 큰 파일 현황
- [Game.jsx](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/src/pages/Game.jsx): 1520줄
- [useGameData.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/src/hooks/useGameData.js): 1459줄
- [useGameActions.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/src/hooks/useGameActions.js): 1440줄
- [useGameLogic.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/src/hooks/useGameLogic.js): 999줄
- [useEvolution.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/src/hooks/useEvolution.js): 913줄
- [useGameAnimations.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/src/hooks/useGameAnimations.js): 506줄

## 다음 AI가 먼저 할 일
1. `git status`로 현재 미커밋 변경이 커뮤니티 fallback WIP + `.DS_Store`인지 확인
2. 이 커뮤니티 WIP를 **별도 작은 커밋으로 마무리할지**, 아니면 **stash/폐기하고 안정 기준점에서 다시 시작할지** 결정
3. 그 다음 우선순위는 [useGameData.js](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/src/hooks/useGameData.js)의 `saveStats` 분리

## 다음 리팩터링 1순위
- **대상:** `useGameData.saveStats`
- **이유:** 현재 남은 가장 큰 구조 개선 효과 구간이고, `loadSlot` 쪽은 이미 helper 경계가 많이 생겨 있다.
- **목표:** lazy update 적용 판단, 저장 payload 조립, Firestore/local commit, 로그 append, 배경/몰입형 설정 저장 경계를 더 잘게 분리

## 시작 전 체크리스트
- [AGENTS.md](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/AGENTS.md)의 “구조 분리 및 사용자 확인 규칙” 먼저 확인
- 루트 [REFACTORING_LOG.md](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/docs/REFACTORING_LOG.md)와 프론트 [REFACTORING_LOG.md](/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/d2/d2_tama_refact/digimon-tamagotchi-frontend/docs/REFACTORING_LOG.md) 최신 항목 확인
- 새 작업은 characterization test를 먼저 추가
- 빌드/테스트가 녹색인 작은 체크포인트 단위로 커밋

## 참고 커밋 묶음
- `0ea65b3` `docs: add development workflow guardrails`
- `0166f8a` `refactor: extract battle outcome helpers`
- `eb6a70c` `refactor: extract battle commit helpers`
- `dbce7fc` `refactor: extract action sleep interaction helpers`
- `7d6ee43` `refactor: extract animation sleep interaction helper`
- `1b142da` `refactor: extract game animation feed helpers`
- `4484d54` `refactor: extract game animation outcome helpers`
- `80468de` `refactor: extract fridge commit helpers`
- `f3af0d3` `refactor: extract death reincarnation helpers`
- `8af0774` `refactor: extract evolution range helpers`
- `ed2c2d4` `refactor: extract sleep warning logic helpers`

## 메모
- 이번 중단 시점에서 가장 중요한 사실은 **안정 기준점은 이미 원격에 있고**, 현재 손에 남은 건 **작은 커뮤니티 WIP 1묶음**이라는 점이다.
- 다음 AI는 새 리팩터링을 열기 전에 이 WIP를 먼저 정리해야 혼선이 없다.
