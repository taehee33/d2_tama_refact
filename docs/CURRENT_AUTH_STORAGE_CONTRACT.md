# 현재 인증/저장 계약 설명서

**문서 상태:** current  
**작성일:** 2026-03-29  
**검증 기준:** 현재 코드 기준 정적 확인  
**대상 앱:** `digimon-tamagotchi-frontend`

이 문서는 다음 질문에 답하기 위해 작성되었습니다.

- 로그인 없이 플레이 가능한가?
- 슬롯은 어디에 저장되는가?
- localStorage에는 지금 무엇이 들어가는가?
- repositories는 실제로 쓰이고 있는가?
- 앞으로 어떤 방향을 공식 계약으로 잡는 것이 좋은가?
- Firebase에 Oracle Cloud를 붙이면 구조가 어떻게 달라질 수 있는가?

이 문서는 "현재 실제 런타임 계약"을 설명하는 문서입니다.  
예전 설계 의도나 오래된 문서에 적힌 내용보다 현재 코드 동작을 우선합니다.

## 1. 한 번에 보는 결론

현재 프로젝트의 공식 운영 계약은 아래처럼 정리하는 것이 가장 정확합니다.

- 플레이하려면 로그인해야 한다.
- 로그인 방식은 `Google 로그인` 또는 `게스트(익명) 로그인`이다.
- 게스트 로그인도 현재는 `Firebase Auth` 기반이다.
- 슬롯 저장의 공식 저장소는 `Firestore`다.
- `localStorage`는 보조 저장소다.
- `repositories` 폴더는 남아 있지만, 현재 메인 런타임 저장 경계는 아니다.

즉, 현재는 `완전 오프라인 localStorage 슬롯 모드`를 공식 지원한다고 보기 어렵습니다.

## 2. 로그인 없이 플레이 가능한가?

### 짧은 답

아니요. 현재는 로그인해야 플레이 가능합니다.

### 조금 더 정확한 답

로그인은 두 방식이 있습니다.

- Google 로그인
- 게스트(익명) 로그인

여기서 중요한 점은, 게스트 로그인도 "아무 인증 없이 localStorage만 쓰는 모드"가 아니라는 것입니다.

- `Login.jsx`는 `signInAnonymously()`를 호출합니다.
- `AuthContext.jsx`도 Firebase Auth의 익명 로그인을 사용합니다.
- 로그인 후에는 `users/{uid}` 문서를 Firestore에 생성/병합 저장합니다.

즉, 현재 게스트 로그인은 `로컬 전용 게스트 모드`가 아니라 `Firebase 기반 익명 사용자 계정`에 더 가깝습니다.

### 왜 헷갈리기 쉬운가?

현재 코드와 문서에는 예전 localStorage 모드 흔적이 남아 있습니다.

- 주석에 `localStorage 모드` 설명이 남아 있음
- 일부 컴포넌트에 localStorage 폴백 분기가 남아 있음
- 문서에 dual storage 설명이 남아 있음

하지만 실제 주요 화면 흐름은 `Firebase 사용자 존재`를 전제로 움직입니다.

## 3. 슬롯 저장은 어디에 되는가?

### "슬롯"이 무엇인가?

여기서 말하는 슬롯은 디지몬 저장 슬롯입니다.

- 슬롯 1
- 슬롯 2
- 슬롯 3

같은 식으로 사용자가 여러 저장 칸을 갖는 구조입니다.

### 현재 공식 저장 위치

현재 슬롯의 공식 저장 위치는 Firestore입니다.

대표 경로는 아래처럼 이해하면 됩니다.

```text
users/{uid}/slots/slot{slotId}
```

예를 들면:

```text
users/abc123/slots/slot1
users/abc123/slots/slot2
```

### 슬롯 문서에 들어가는 대표 값

현재 코드 기준으로 슬롯 문서에는 아래 종류의 값이 들어갑니다.

- `selectedDigimon`
- `digimonStats`
- `slotName`
- `createdAt`
- `device`
- `version`
- `backgroundSettings`
- 기타 플레이 진행 정보

추가로 로그성 데이터는 별도 서브컬렉션이나 별도 Firestore 경로로 저장될 수 있습니다.

### 지금 localStorage에 슬롯이 저장된다고 보면 안 되는 이유

일부 오래된 분기나 폴백 흔적을 제외하면, 현재 메인 플레이 루프는 localStorage를 슬롯의 정식 저장소로 사용하지 않습니다.

즉 아래처럼 이해하는 것이 안전합니다.

- 공식 슬롯 저장: Firestore
- localStorage: 보조값/설정/레거시 흔적

## 4. localStorage는 지금 무엇에 쓰이고 있는가?

### 현재 실제로 확인되는 범주

현재 코드에서 localStorage는 주로 아래 범주에 사용됩니다.

#### 4.1 UI 표시 설정

- 디지몬 스프라이트 크기
- 뷰 관련 설정

대표 예:

- `digimon_view_settings`

#### 4.2 개발자/디버그 옵션

- 개발자 모드
- 도감 미발견 물음표 표시 여부
- 진화 시간 무시 옵션

대표 예:

- `digimon_developer_mode`
- `digimon_encyclopedia_show_question_mark`
- `digimon_ignore_evolution_time`

#### 4.3 UI 상태 유지

- StatsPanel 접기/펼치기 상태
- 섹션별 아코디언 열림 상태

#### 4.4 일부 보조 진행 값

- `clearedQuestIndex`

이 값은 슬롯별로 저장되지만, 현재 Firestore 정식 슬롯 구조보다 localStorage 보조값에 가깝게 다뤄지고 있습니다.

#### 4.5 레거시/폴백 분기

일부 화면에는 예전 localStorage 슬롯 모드 흔적이 남아 있습니다.

- `ArenaScreen.jsx`의 localStorage 분기
- `SelectScreen.jsx`에 남아 있는 주석/폴백 흔적

이 부분은 "현재 공식 계약"이라기보다 "남아 있는 이전 구조 흔적"으로 보는 편이 맞습니다.

### 일반적으로 localStorage에 남겨도 좋은 것

지금 구조와 비용을 고려하면, localStorage에는 아래 종류가 남는 것이 가장 안전하고 효율적입니다.

- 순수 UI 설정
- 개발자 옵션
- 비핵심 토글
- 다시 계산 가능하거나 잃어도 치명적이지 않은 값
- 캐시/최근 선택 상태

예:

- 화면 크기 설정
- 패널 열림 상태
- 마지막 선택 메뉴
- 디버그 옵션

### localStorage에 남기지 않는 편이 좋은 것

다음은 Firestore 같은 공식 저장소가 더 적합합니다.

- 디지몬 현재 스탯
- 시간 기반 게임 진행 상태
- 사망/진화/케어미스 같은 핵심 플레이 결과
- 사용자 간 공유/동기화가 필요한 데이터
- 슬롯의 공식 진실(source of truth)

## 5. repositories는 무엇이고, 지금 어떻게 쓰이고 있는가?

### repositories가 원래 의미하는 것

`Repository 패턴`은 "데이터를 어디에 저장하든, 앱 쪽에서는 같은 인터페이스로 다루자"는 구조입니다.

예를 들면:

- 지금은 Firestore
- 나중에는 localStorage
- 혹은 다른 DB

여기서도 코드가 같은 메서드만 호출하게 만드는 것이 목표입니다.

### 이 프로젝트에서 repositories 폴더의 현재 상태

현재 `src/repositories`에는 아래 파일이 있습니다.

- `SlotRepository.js`
- `UserSlotRepository.js`
- `README.md`

하지만 현재 메인 런타임 저장 흐름은 이 폴더가 아닙니다.

### 왜 "현재 실사용 구조가 아니다"라고 보는가?

코드 검색 기준으로 보면:

- 런타임 코드에서 `slotRepository`, `userSlotRepository`를 적극적으로 import해서 쓰는 경로가 거의 보이지 않습니다.
- 실제 저장/로드의 중심은 `useGameData`입니다.
- `SlotRepository.js` 주석에도 "실제 코드에서는 이 Repository를 직접 사용하지 않는다"고 적혀 있습니다.

즉 현재 repositories 폴더는 다음 중 하나에 가깝습니다.

- 과거 설계 흔적
- 보존된 추상화
- 향후 다시 사용할 수 있는 참고 구현

### 오늘 코드를 읽을 때 repositories를 어떻게 해석해야 하나?

이렇게 보면 됩니다.

- "현재 실제 저장 흐름을 알려주는 폴더"가 아니다.
- "프로젝트가 한때 또는 미래에 지향했던 추상화 방향을 보여주는 참고 폴더"다.

실제 저장 로직을 따라가려면 아래를 먼저 봐야 합니다.

- `src/hooks/useGameData.js`
- `src/pages/SelectScreen.jsx`
- `src/pages/Game.jsx`
- `src/contexts/AuthContext.jsx`

## 6. 추천 방향: 지금 무엇을 공식 계약으로 잡는 것이 좋은가?

현재 코드 상태와 유지보수 비용을 함께 보면, 아래 방향을 추천합니다.

### 추천 결론

- `Firebase-first`
- `로그인 필수`
- `게스트 로그인 허용`
- `슬롯 저장은 Firestore`
- `localStorage는 보조 저장`
- `repositories는 현재 실사용 경계 아님`

### 왜 이 방향이 좋은가?

#### 6.1 현재 코드와 가장 덜 충돌한다

이미 실제 흐름이 Firebase 중심입니다.  
문서를 여기에 맞추면 코드와 문서가 같은 방향을 보게 됩니다.

#### 6.2 테스트와 리팩터링 범위가 줄어든다

지금 dual storage를 공식 지원한다고 선언하면, 앞으로 모든 저장 변경을 두 경로에서 테스트해야 합니다.

현재 구조에서는 그 비용이 너무 큽니다.

#### 6.3 오프라인 모드는 별도 기능으로 다루는 편이 안전하다

완전한 localStorage 슬롯 모드는 단순 문서 수정으로 끝나지 않습니다.

필요한 것:

- 슬롯 저장 전 경로 복구
- lazy update 경로 양쪽 검증
- 마이그레이션 정책
- 테스트 추가
- UI 문구 정리

이건 별도 에픽으로 분리하는 것이 맞습니다.

## 7. Firebase + Oracle Cloud를 같이 쓰면 어떻게 달라질 수 있는가?

### 짧은 답

쓸 수는 있습니다.  
하지만 `Oracle Cloud를 붙인다고 Firestore를 막 실시간으로 써도 되는 구조가 되지는 않습니다.`

### 현실적으로 좋아질 수 있는 부분

Oracle Cloud 무료 티어 VM은 아래 같은 용도로는 유용할 수 있습니다.

- 배치 작업
- 관리자용 API
- 시즌 정산/통계 집계
- 랭킹 계산
- 백업/내보내기 작업
- 알림/스케줄러
- 운영용 도구 서버

즉, `클라이언트가 직접 Firestore만 보는 구조`에서 부족한 "백그라운드 처리"를 보완하는 용도로는 좋습니다.

### 그런데 왜 Firestore를 막 써도 된다는 뜻은 아닌가?

현재 게임의 핵심 저장이 Firestore에 있다면, 결국 아래 비용과 제약은 그대로 남습니다.

- 슬롯 문서 write 비용
- read 비용
- snapshot 재수신 비용
- 문서 단위 contention
- index 비용

Firestore 공식 문서도 다음을 분명히 말합니다.

- 무료 Spark 플랜의 Firestore Standard는 하루 `20K writes`, `50K reads`, `20K deletes` 한도가 있습니다.
- 단일 문서 update 최대율은 workload에 따라 달라지며, 높은 write rate에서는 contention, latency, errors가 생길 수 있습니다.
- 순차적으로 증가하는 필드를 인덱싱한 컬렉션은 최대 write rate가 제한될 수 있습니다.

즉, Oracle VM이 하나 있다고 해서 Firestore에 초당 write를 마음 놓고 넣는 구조가 되지는 않습니다.

### 어떤 경우에 구조가 정말 달라지나?

아래처럼 바꾸면 구조가 크게 달라집니다.

- authoritative game state를 Oracle 쪽 서버/DB로 옮긴다
- 클라이언트는 서버 API/WebSocket만 본다
- Firestore는 계정/부가 데이터/로그/백오피스 일부만 맡긴다

하지만 이건 "운영 보조 인프라 추가"가 아니라 사실상 아키텍처 전환입니다.

필요한 것:

- 서버 권위(authoritative server) 설계
- 서버 상태 저장소
- 세션/동기화 설계
- 장애/재접속 처리
- 인증 위임
- 클라이언트-서버 프로토콜

지금 단계에서 바로 이 방향으로 가는 것은 리팩터링보다 제품 구조 변경에 가깝습니다.

### 그래서 현재 추천은?

현재 추천은 아래입니다.

- 게임의 핵심 저장은 계속 Firestore
- lazy update 원칙은 유지
- Oracle Cloud는 필요할 때 운영성/배치/보조 API 용도로만 도입

즉:

> Oracle Cloud를 붙여도 "초당 실시간 Firestore write를 마음 놓고 해도 된다"는 결론은 아닙니다.

## 8. 1주차에 실제로 해야 할 일

### 목표

"현재 코드가 실제로 어떤 계약으로 동작하는지"를 문서에 맞추는 것입니다.

### 해야 할 일

1. 루트 README에서 현재 계약을 선언
2. repositories 문서를 현재 상태 기준으로 다시 쓰기
3. 구조 문서에 현재 계약 요약 반영
4. `REFACTORING_LOG`에 결정과 근거 남기기

### 이번 주에는 하지 않는 것이 좋은 일

- 아직 테스트 없이 저장 계층을 대수술하는 것
- 아직 결정 없이 dual storage를 공식 지원한다고 쓰는 것
- Oracle Cloud 도입을 전제로 Firestore write 정책을 느슨하게 푸는 것

## 9. 이후 추천 순서

1. 문서 계약 정리
2. `applyLazyUpdate` 테스트
3. 진화 조건 테스트
4. 배틀 계산 테스트
5. `Game.jsx` 조립 책임 분리
6. 저장 경계 일원화

## 10. 참고한 공식 문서

- Firebase Pricing:
  [https://firebase.google.com/pricing](https://firebase.google.com/pricing)
- Cloud Firestore Best Practices:
  [https://firebase.google.com/docs/firestore/best-practices](https://firebase.google.com/docs/firestore/best-practices)
- Oracle Cloud Always Free Resources:
  [https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
