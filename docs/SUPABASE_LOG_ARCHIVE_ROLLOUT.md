# Supabase Log Archive 롤아웃 순서

## 목적

- `arena_battle_logs`, `jogress_logs`의 장기 이력 저장을 Supabase archive로 이전한다.
- 2026-04-02 기준으로 Preview/Prod archive API 검증과 Firestore slimming 2단계까지 완료했다.

## 현재 상태 (2026-04-02)

- Preview
  - `SUPABASE_SERVICE_ROLE_KEY`를 runtime env로 주입한 preview 배포를 만들고, `vercel curl`로 보호 배포를 우회해 archive API 스모크를 통과했다.
- Production
  - `POST /api/logs/arena-battles/archive`
  - `GET /api/logs/arena-battles/:archiveId/replay`
  - `POST /api/logs/jogress/archive`
  - 세 경로 모두 Firebase 인증 기준으로 정상 동작하고, Supabase row 생성까지 확인했다.
- Firestore slimming
  - `jogress_logs` Firestore write 제거 완료
  - `arena_battle_logs`는 summary-only 구조로 전환 완료
  - 아레나 다시보기는 Supabase archive만 읽고, Firestore `logs[]` fallback은 제거 완료
- 주의
  - `archiveId`가 없는 과거 Firestore-only 아레나 로그는 더 이상 상세 다시보기를 제공하지 않는다.
  - 아레나 로그 목록에서는 이런 과거 기록을 `구버전 로그`로 명시하고, `이 기록은 이전 저장 방식으로 생성되어 상세 다시보기를 지원하지 않습니다.` 안내를 함께 노출한다.

## 0. 배포 경로 정합성

현재 Vercel `rootDirectory`는 `digimon-tamagotchi-frontend`다.
따라서 `/api/logs/*` 엔드포인트도 반드시 `digimon-tamagotchi-frontend/api/...` 아래에 있어야 한다.

이번 라운드에서 맞춘 경로:

- `digimon-tamagotchi-frontend/api/_lib/logArchives.js`
- `digimon-tamagotchi-frontend/api/_lib/logArchiveHandlers.js`
- `digimon-tamagotchi-frontend/api/logs/arena-battles/archive.js`
- `digimon-tamagotchi-frontend/api/logs/arena-battles/[archiveId]/replay.js`
- `digimon-tamagotchi-frontend/api/logs/jogress/archive.js`

루트 `api/...` 경로는 로컬 테스트 호환용 shim으로만 유지한다.

## 1. 환경변수 확인

### 서버(Vercel)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_API_KEY`

### 프론트(Vercel)

- `REACT_APP_COMMUNITY_API_BASE_URL`
  - 프론트와 API가 같은 프로젝트/도메인이면 비워도 된다.
  - 별도 origin을 쓰면 해당 API 주소를 넣는다.
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`

주의:

- `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용이다.
- `REACT_APP_*`로 service role key를 노출하면 안 된다.

## 2. Supabase SQL 적용

수동 적용 SQL:

- `supabase/migrations/20260402_log_archives.sql`

적용 순서:

1. 기존 community migration이 이미 운영에 적용돼 있어야 한다.
2. Supabase SQL Editor에서 `20260402_log_archives.sql`을 실행한다.

이 migration은 additive다.

- `arena_battle_log_archives`
- `jogress_log_archives`
- 관련 created_at 인덱스
- RLS enable

SQL 적용 직후 확인:

- 두 테이블이 생성됐는지
- 인덱스가 생성됐는지
- RLS가 enable 상태인지

## 3. Preview 배포 및 검증

배포 전 자동 검증:

```bash
node --test api/_lib/logArchiveHandlers.test.js
cd digimon-tamagotchi-frontend
CI=true npm test -- --watchAll=false --runInBand src/utils/logArchiveApi.test.js src/hooks/useGameActions.test.js
NODE_OPTIONS=--openssl-legacy-provider npm run build
```

Preview 검증 결과:

1. preview 배포 보호 때문에 일반 fetch 대신 `vercel curl`을 사용했다.
2. Firebase 익명 로그인 토큰으로 archive API를 호출해 아레나 archive 저장, replay 조회, 조그레스 archive 저장을 모두 확인했다.
3. Supabase `arena_battle_log_archives`, `jogress_log_archives` row 생성까지 직접 확인했다.
4. Preview 환경에는 기본적으로 `SUPABASE_SERVICE_ROLE_KEY`가 없었기 때문에, 검증용 preview 배포에 runtime env를 주입했다.

운영 로그 확인:

- Vercel 함수 로그의 `/api/logs/*` 404/500 여부
- 브라우저 콘솔의 archive warning 여부

## 4. Prod 배포 및 검증

Preview 검증이 통과한 뒤 production target으로 다시 build/deploy 했다.

- Supabase 단일 프로젝트 기준으로 SQL은 재적용하지 않았다.

Prod 검증 결과:

1. 운영 도메인 `https://dthama.vercel.app`에서 archive POST / replay GET을 직접 확인했다.
2. Supabase row 생성까지 확인했다.
3. 이후 Firestore slimming 코드도 같은 production 배포에 반영할 수 있는 상태를 확보했다.

## 5. 롤백 기준

### SQL만 적용된 상태

- 테이블은 additive라서 그대로 둔다.
- 앱 배포만 중단하면 된다.

### Preview 배포 후 문제

- Preview만 폐기한다.
- DB rollback은 하지 않는다.

### Prod 배포 후 문제

- Vercel을 이전 배포로 즉시 롤백한다.
- Supabase archive row는 남겨도 된다.

## 남은 작업

- `arena_battle_logs` / `jogress_logs`의 오래된 Firestore 문서를 정리할 운영 정책 수립
- archive 실패율과 replay 404를 운영 로그로 모니터링
