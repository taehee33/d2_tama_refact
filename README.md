# Digimon THamagotchi

디지털 몬스터 컬러 휴대용 기기에서 영감을 받은 디지몬 육성 웹 애플리케이션입니다.  
실제 실행 앱은 [digimon-tamagotchi-frontend](./digimon-tamagotchi-frontend) 아래에 있습니다.

## 현재 공식 운영 계약

2026-03-29 기준으로, 이 프로젝트를 이해할 때 가장 먼저 알아야 할 계약은 아래와 같습니다.

- 플레이하려면 로그인해야 합니다.
- 로그인 방식은 `Google 로그인` 또는 `게스트(익명) 로그인` 두 가지입니다.
- 여기서 말하는 게스트 로그인도 `Firebase Auth`를 사용합니다.
- 현재 공식 슬롯 저장소는 `Firestore`입니다.
- `localStorage`는 현재 슬롯 저장소가 아니라 `UI 설정`, `개발자 옵션`, `일부 보조 값`에 주로 사용됩니다.
- `src/repositories` 폴더는 남아 있지만, 현재 메인 런타임 저장 경계는 아닙니다.

즉, 현재 프로젝트를 한 줄로 요약하면 다음과 같습니다.

> "게스트 로그인도 포함해 Firebase 로그인 후 Firestore 슬롯을 사용하는 구조이며, localStorage는 보조 저장소로 남아 있다."

## 이 문서를 먼저 읽어야 하는 사람

- 프로젝트를 처음 여는 사람
- "지금 localStorage 모드가 실제로 되는지" 헷갈리는 사람
- "repositories가 아직 살아 있는 구조인지" 확인하려는 사람
- 1주차 작업으로 저장소 계약과 기준 문서를 정리하려는 사람

## 먼저 읽으면 좋은 문서

- 현재 인증/저장 계약 상세:
  [CURRENT_AUTH_STORAGE_CONTRACT.md](./docs/CURRENT_AUTH_STORAGE_CONTRACT.md)
- 현재 코드 기준 구조 설명:
  [CURRENT_PROJECT_STRUCTURE_ANALYSIS.md](./docs/CURRENT_PROJECT_STRUCTURE_ANALYSIS.md)
- 저장소 추상화 폴더의 현재 상태:
  [repositories/README.md](./digimon-tamagotchi-frontend/src/repositories/README.md)
- 작업 기록:
  [REFACTORING_LOG.md](./docs/REFACTORING_LOG.md)

## 저장 구조를 짧게 설명하면

### 1. 로그인 없이 플레이 가능한가?

아니요. 현재는 로그인 후 플레이하는 구조입니다.

- `Google 로그인`
- `게스트(익명) 로그인`

두 방식 모두 현재 구현상 Firebase를 통과합니다.  
예전 문서나 주석에는 localStorage 모드 설명이 남아 있지만, 현재 메인 화면 진입 경로는 Firebase 사용자 존재를 전제로 합니다.

### 2. 슬롯은 어디에 저장되는가?

여기서 "슬롯"은 디지몬 저장 슬롯을 뜻합니다.

- 현재 공식 저장 위치: `Firestore`
- 대표 경로: `users/{uid}/slots/slot{slotId}`

즉, 각 사용자는 자기 UID 아래에 여러 슬롯을 갖고, 각 슬롯 문서에 선택된 디지몬과 스탯, 배경, 버전, 부가 정보가 저장됩니다.

### 3. localStorage는 지금 어디에 쓰이는가?

현재 localStorage는 주로 다음 범주의 값에 쓰입니다.

- 스프라이트 크기/뷰 설정
- 개발자 모드, 도감 표시 옵션, 진화 시간 무시 같은 개발 보조 옵션
- 패널 접힘/펼침 상태 같은 UI 상태
- 일부 보조 값
  예: 특정 슬롯의 `clearedQuestIndex`
- 레거시 또는 폴백 흔적
  예: 일부 컴포넌트의 localStorage 기반 분기

중요한 점은, 현재 localStorage를 "디지몬의 공식 저장 슬롯"이라고 보면 안 된다는 것입니다.

### 4. repositories는 지금 살아 있는 구조인가?

폴더와 파일은 남아 있지만, 현재 메인 런타임 저장 경계는 아닙니다.

- 실제 슬롯 로드/저장은 `useGameData` 중심 Firestore 경로가 더 중요합니다.
- `src/repositories/SlotRepository.js`에는 "실제 코드에서는 직접 사용하지 않는다"는 주석도 남아 있습니다.
- 따라서 현재 `repositories`는 "주 저장 경계"라기보다 `남아 있는 추상화/보존된 설계 흔적`에 가깝습니다.

## 권장 방향

현재 상태와 유지보수 비용을 함께 보면, 당장은 아래 방향을 권장합니다.

- 공식 계약은 `Firebase 중심`으로 명확히 선언
- `게스트 로그인`도 Firebase 기반 로그인으로 설명
- `localStorage`는 보조 저장으로 제한
- `repositories`는 현재 실사용 경계가 아니라는 점을 문서에 명시
- 완전 오프라인 localStorage 슬롯 모드는 별도 기능 프로젝트로 분리

이 방향을 택하면 문서, 코드, 테스트 전략을 한 방향으로 정렬하기 쉽습니다.

## 실행 방법

실행은 프론트엔드 앱 디렉토리에서 합니다.

```bash
cd digimon-tamagotchi-frontend
npm install
npm start
```

현재 프로젝트는 `start`/`build` 시 `NODE_OPTIONS=--openssl-legacy-provider`를 사용합니다.

커뮤니티 API(`/api/community/...`)까지 함께 확인하려면 `npm start` 단독 실행만으로는 부족할 수 있습니다.
로컬에서 커뮤니티 글 작성/댓글까지 테스트할 때는 `vercel dev`를 사용하거나,
프론트 `.env`에 `REACT_APP_COMMUNITY_API_BASE_URL`로 실제 API origin을 지정해야 합니다.

## Firestore Rules 배포

Firestore Rules 기준 파일은 루트의 [firestore.rules](./firestore.rules) 입니다.

```bash
npm install
npm run firebase:login
npm run firestore:deploy
```

이번 라운드 기준으로 공식 관리 경계는 `users/{uid}` 계열과 `nickname_index/{normalizedKey}`이며,
공유 컬렉션(`jogress`, `arena`, `game_settings`)은 기능 호환을 위한 임시 auth 허용으로 남아 있습니다.

## 닉네임 인덱스 감사 / 백필

테이머명 중복 확인은 더 이상 `metadata/nicknames` 단일 문서를 쓰지 않고, `nickname_index/{normalizedKey}` 문서를 사용합니다.

마이그레이션은 아래 순서로 진행합니다.

```bash
npm run nickname:audit
npm run nickname:backfill
npm run nickname:verify
npm run nickname:cleanup
```

- `nickname:audit`: `users/{uid}.tamerName`을 기준으로 공백 축약 + 영문 소문자화 규칙 충돌을 검사합니다.
- `nickname:backfill`: 감사 결과에 충돌이 없을 때만 `nickname_index`를 생성하고, 공백 정규화가 필요한 `users/{uid}.tamerName`도 함께 정리합니다. 더 이상 사용되지 않는 `nickname_index` 문서는 이 단계에서 제거합니다.
- `nickname:verify`: `users/{uid}.tamerName`과 `nickname_index`가 완전히 일치하는지 검증합니다.
- `nickname:cleanup`: `nickname:verify`가 통과한 뒤 레거시 `metadata/nicknames` 문서를 삭제합니다.
- 세 스크립트는 `.firebaserc`의 기본 프로젝트 ID를 자동으로 사용하며, 실제 Firestore Admin 접근을 위해서는 `FIREBASE_SERVICE_ACCOUNT_PATH` 또는 `FIREBASE_SERVICE_ACCOUNT_JSON` 환경변수, 혹은 Application Default Credentials가 필요합니다.
- 별도 환경변수를 쓰지 않을 경우 기본 자격증명 경로로 아래 파일도 자동 탐색합니다.
  - `~/.config/firebase/d2tamarefact-adminsdk.json`
  - `~/.config/firebase/d2tamarefact-service-account.json`
  - `~/.config/firebase/service-account.json`

## Supabase Log Archive 적용 순서

아레나 배틀 상세 다시보기와 조그레스 이력 archive는 Supabase로 병행 저장합니다.

- 현재 배포 루트는 `digimon-tamagotchi-frontend` 이므로, Vercel에 실릴 API는 `digimon-tamagotchi-frontend/api/...` 아래에 있어야 합니다.
- 2026-04-02 기준으로 Preview/Prod archive API 검증과 Firestore slimming 2단계까지 반영됐습니다.
- 현재 구조는 다음과 같습니다.
  - `jogress_logs`: Firestore write 제거, Supabase archive만 사용
  - `arena_battle_logs`: Firestore에는 요약 필드만 저장
  - 아레나 상세 replay: Supabase archive만 사용
  - `archiveId`가 없는 과거 Firestore-only 로그는 상세 replay를 제공하지 않습니다.

운영 적용 순서는 아래를 기준으로 합니다.

```bash
1. digimon-tamagotchi-frontend/api/logs/... 경로가 배포 루트에 포함됐는지 확인
2. Supabase SQL Editor에서 supabase/migrations/20260402_log_archives.sql 실행
3. Preview 배포
4. Preview에서 archive POST / replay GET / Supabase row 생성 스모크 테스트
5. Prod 배포
```

필수 서버 환경변수:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_API_KEY`

프론트 환경변수:

- `REACT_APP_COMMUNITY_API_BASE_URL`
  - 프론트와 API가 같은 Vercel 프로젝트면 비워도 됩니다.
- 기존 채팅 유지용:
  - `REACT_APP_SUPABASE_URL`
  - `REACT_APP_SUPABASE_ANON_KEY`

`SUPABASE_SERVICE_ROLE_KEY`는 서버 전용입니다. `REACT_APP_*`로 노출하면 안 됩니다.

## 기술 스택

- React 18
- Firebase Auth / Firestore
- React Router DOM
- Tailwind CSS
- Create React App

## 지금 가장 중요한 구조 포인트

- 엔트리 흐름은 `App.jsx -> Login -> SelectScreen -> Game`
- 메인 오케스트레이션은 `Game.jsx`
- 상태 중심은 `useGameState`
- 저장 중심은 `useGameData`
- 시간 기반 상태 변화는 `lazy update`가 핵심 패턴
- 다만 문서와 실제 런타임 계약 사이에는 아직 정리해야 할 차이가 있음

## 이번 주에 문서를 정리하려면

가장 작은 안전한 순서는 아래와 같습니다.

1. 이 README에서 현재 계약을 선언
2. [CURRENT_AUTH_STORAGE_CONTRACT.md](./docs/CURRENT_AUTH_STORAGE_CONTRACT.md)에 상세 근거를 정리
3. [repositories/README.md](./digimon-tamagotchi-frontend/src/repositories/README.md)에서 repository 문서를 현실화
4. [CURRENT_PROJECT_STRUCTURE_ANALYSIS.md](./docs/CURRENT_PROJECT_STRUCTURE_ANALYSIS.md)에 구조 관점 요약 반영
5. [REFACTORING_LOG.md](./docs/REFACTORING_LOG.md)에 변경 근거 기록
