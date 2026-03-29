# repositories 폴더 현재 상태 안내

## 이 문서의 목적

이 문서는 `src/repositories` 폴더를 처음 보는 사람이 아래 질문에 바로 답할 수 있도록 작성되었습니다.

- repositories는 지금 실제로 쓰이고 있는가?
- 이 폴더를 믿고 저장 구조를 따라가도 되는가?
- localStorage / Firestore 전환 구조가 현재도 살아 있는가?
- 오늘 저장 로직을 수정하려면 어디를 먼저 봐야 하는가?

## 먼저 결론

2026-03-29 기준으로, `src/repositories`는 **현재 메인 런타임 저장 경계가 아닙니다.**

현재 실제 저장 흐름은 주로 아래 경로를 봐야 합니다.

- `src/hooks/useGameData.js`
- `src/pages/SelectScreen.jsx`
- `src/pages/Game.jsx`
- `src/contexts/AuthContext.jsx`

즉, repositories 폴더는 현재 프로젝트에서 아래 성격에 가깝습니다.

- 보존된 추상화
- 과거 설계 흔적
- 향후 다시 도입할 수 있는 참고 구현

## 왜 이렇게 판단하는가?

### 1. 실제 런타임 저장은 `useGameData`가 중심이다

현재 슬롯 로드/저장, lazy update 적용, Firestore 문서 갱신의 중심은 `useGameData`입니다.

### 2. `SlotRepository.js` 주석 자체가 현재 상태를 설명한다

`SlotRepository.js`에는 다음과 같은 뜻의 주석이 있습니다.

- localStorage 모드는 제거되었다
- 이제 Firebase만 사용한다
- 실제 코드에서는 이 Repository를 직접 사용하지 않는다

즉, 파일 스스로도 "현재 실사용 중심이 아니다"라고 설명하고 있습니다.

### 3. 코드 검색상 active import가 거의 없다

현재 런타임 코드에서 `slotRepository`, `userSlotRepository`를 적극적으로 import해서 핵심 저장 경로로 쓰는 모습은 보이지 않습니다.

## repositories가 원래 하려던 역할

이 폴더는 원래 아래 같은 목표를 가진 것으로 볼 수 있습니다.

- 저장소를 추상화한다
- localStorage든 Firestore든 같은 인터페이스로 다룬다
- 화면/게임 로직은 저장소 구현을 몰라도 되게 만든다

이 방향 자체는 나쁘지 않습니다.  
하지만 현재 코드베이스에서는 이 추상화가 저장 경계의 중심까지는 올라오지 못했습니다.

## 현재 구조에서 이 폴더를 어떻게 읽어야 하나?

### `SlotRepository.js`

- Firestore repository 형태의 구현이 남아 있음
- 하지만 경로가 현재 실제 슬롯 저장 구조와 완전히 같다고 보기 어려움
- 실제 메인 코드에서 직접 쓰지 않음

### `UserSlotRepository.js`

- 사용자 기준 슬롯 저장 유틸리티 성격
- 일부 참고 구현으로는 읽을 수 있음
- 하지만 현재 "메인 저장 진입점"이라고 부르기는 어려움

## 오늘 저장 로직을 수정하려면 어디부터 봐야 하나?

다음 순서로 보는 것이 정확합니다.

1. `src/hooks/useGameData.js`
2. `src/pages/SelectScreen.jsx`
3. `src/pages/Game.jsx`
4. 필요한 경우 `src/hooks/useGameActions.js`, `useEvolution.js`, `useGameHandlers.js`

즉, repositories 폴더보다 먼저 `useGameData`를 봐야 합니다.

## localStorage / Firestore 전환 문서를 지금 그대로 믿으면 안 되는 이유

예전 문서에는 다음 전제가 많이 남아 있습니다.

- localStorage가 기본 저장소
- 환경변수로 Firestore/localStorage를 전환
- repository를 통해 저장소를 갈아끼움

하지만 현재 코드는 그 구조와 다릅니다.

- 실제 주요 화면은 Firebase 로그인 기준으로 이동 제어
- 슬롯 저장의 주 경로는 Firestore
- localStorage는 주로 UI/개발 설정과 일부 보조값

따라서 `src/repositories` 문서를 읽을 때는 아래처럼 해석해야 합니다.

> 이 폴더는 "현재 저장 구조의 기준 문서"가 아니라 "남아 있는 추상화 계층 설명"이다.

## 지금 이 폴더에 대해 공식적으로 어떻게 적는 것이 좋은가?

현재 프로젝트 문서에는 아래 표현이 가장 안전합니다.

- repositories 폴더는 존재한다
- 하지만 현재 메인 저장 경계는 아니다
- 현재 공식 슬롯 저장은 Firestore 중심이다
- localStorage 기반 슬롯 모드는 공식 운영 계약이 아니다

## 나중에 repository 패턴을 다시 살리고 싶다면

가능합니다. 다만 그때는 문서만 바꾸면 안 됩니다.

필요한 최소 조건:

1. 실제 모든 저장 진입점을 하나의 adapter/repository 경계로 모으기
2. `useGameData`와 page/hook의 direct Firestore 호출 줄이기
3. Firestore/localStorage 두 경로를 모두 테스트하기
4. lazy update와 저장 정책을 두 경로 모두에서 보장하기

즉, repository 패턴 재도입은 "문서 정리"가 아니라 "구조 리팩터링 + 테스트 작업"입니다.

## 이 폴더에 대한 권장 운영 정책

- 현재는 참고용으로 유지
- 실제 저장 구조 설명은 다른 기준 문서에서 수행
- 런타임 경계를 오해하게 만드는 오래된 예시는 제거 또는 명확한 주석 처리

## 관련 문서

- 현재 인증/저장 계약:
  [CURRENT_AUTH_STORAGE_CONTRACT.md](../../../docs/CURRENT_AUTH_STORAGE_CONTRACT.md)
- 현재 구조 기준 문서:
  [CURRENT_PROJECT_STRUCTURE_ANALYSIS.md](../../../docs/CURRENT_PROJECT_STRUCTURE_ANALYSIS.md)
