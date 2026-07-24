# API 배포 구조

## 단일 원본

Vercel 프로젝트의 Root Directory는 `digimon-tamagotchi-frontend`다. 실제 배포되는 API 구현은 아래 디렉터리만 정본으로 사용한다.

```text
브라우저·외부 서비스
        ↓ /api/*
digimon-tamagotchi-frontend/api
  ├─ _lib/                  실제 비즈니스 구현
  ├─ arena-v2.js            아레나 통합 라우터
  ├─ notifications/[operation].js
  └─ 나머지 배포 진입점
```

저장소 루트의 `api/` 구현은 제거했다. 호환 shim도 현재는 필요하지 않으므로 0개다. 외부 API URL, Firebase 인증, Firestore 경로, Supabase 저장 계약은 이 정리로 변경되지 않는다.

## 현재 배포 진입점

현재 서버리스 함수 진입점은 11개다.

- `arena-v2.js`
- `arena/admin/archives/[archiveId].js`
- `arena/admin/config.js`
- 커뮤니티 진입점 4개
- 로그 보관 진입점 2개
- `notifications/[operation].js`
- `operator/status.js`

아레나 Ghost·배틀·작업·구형 archive URL은 `vercel.json` rewrite를 거쳐 `arena-v2.js`로 전달된다. 일일·긴급 알림의 기존 URL은 같은 rewrite를 거쳐 알림 단일 라우터로 전달된다. 현재 함수 수는 Vercel Hobby 상한 12개보다 1개 적다.

## 테스트와 재발 방지

서버 API 테스트는 `tests/api/`에 두고 `digimon-tamagotchi-frontend/api`의 실제 구현을 직접 불러온다. 배포 계약 테스트는 다음을 고정한다.

- 배포 진입점 11개와 Linux 대소문자 경로
- 커뮤니티 진입점 4개
- 알림 operation 9개
- 아레나 관리자 사용자 조회·시즌 종료·운영자 설정 분기
- 일반 운영자 상태·Ably 토큰 분기
- Vercel 함수 수 12개 이하

`npm run check:api-single-source`는 루트 중복 구현, 허용되지 않은 shim, 존재하지 않는 shim 대상, 배포 진입점 변경을 검사한다. 이 명령은 루트 `npm run check`에 포함되어 PR마다 실행된다.

## 변경 규칙

새 API 기능은 반드시 `digimon-tamagotchi-frontend/api`에 추가한다. 외부 URL을 통합 라우터에 연결할 수 있으면 새 함수 파일보다 `vercel.json` rewrite 또는 기존 operation 분기를 우선한다. 진입점을 추가하거나 제거할 때는 배포 계약 목록과 함수 수 상한을 함께 검토한다.
