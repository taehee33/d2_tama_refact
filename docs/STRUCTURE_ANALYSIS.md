# 구조 분석 문서 안내

이 문서는 구조 분석의 **요약 안내판**입니다.  
현재 기준으로 더 자세하고 신뢰도 높은 문서는 아래 두 개입니다.

- 현재 코드 구조 상세:
  [CURRENT_PROJECT_STRUCTURE_ANALYSIS.md](./CURRENT_PROJECT_STRUCTURE_ANALYSIS.md)
- 현재 인증/저장 계약 상세:
  [CURRENT_AUTH_STORAGE_CONTRACT.md](./CURRENT_AUTH_STORAGE_CONTRACT.md)

## 아주 짧은 요약

- 실제 실행 앱은 `digimon-tamagotchi-frontend` 아래에 있다.
- 메인 화면 흐름은 `App.jsx -> Login -> SelectScreen -> Game.jsx`다.
- `Game.jsx`는 현재도 메인 오케스트레이터다.
- 저장의 중심은 `useGameData`와 Firestore다.
- 게스트 로그인도 현재는 Firebase Auth 기반이다.
- `localStorage`는 현재 보조 UI/개발 설정 저장소에 가깝다.
- `src/repositories`는 남아 있지만, 현재 메인 런타임 저장 경계는 아니다.

## 이 문서를 어떻게 쓰면 좋은가?

- 빠르게 개요만 보고 싶을 때 이 문서를 본다.
- 실제 저장 구조, localStorage 범위, repository 실사용 여부까지 확인하려면 상세 문서를 본다.

## 권장 읽기 순서

1. [README.md](../README.md)
2. [CURRENT_AUTH_STORAGE_CONTRACT.md](./CURRENT_AUTH_STORAGE_CONTRACT.md)
3. [CURRENT_PROJECT_STRUCTURE_ANALYSIS.md](./CURRENT_PROJECT_STRUCTURE_ANALYSIS.md)
4. [REFACTORING_LOG.md](./REFACTORING_LOG.md)
