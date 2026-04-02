# REFACTORING LOG

## 2026-04-03

### 랜딩 전용 헤더를 다크 글래스 톤으로 재정렬
- `/landing`에서만 보이는 `LandingTopBar`에 surface 래퍼를 추가하고, 브랜드/네비/계정 CTA 구조는 유지한 채 전시형 다크 글래스 헤더로 톤을 바꿨습니다.
- 활성 링크를 밝은 민트 pill에서 얇은 보더와 은은한 glow 중심으로 바꾸고, 브랜드 마크와 CTA 버튼도 히어로의 어두운 무드에 맞춰 재조정했습니다.
- 모바일에서는 기존처럼 중앙 네비를 숨기되, 헤더 높이와 패딩을 줄여 첫 화면 겹침을 완화했습니다.

### 영향받은 파일
- `src/components/landing/LandingTopBar.jsx`
- `src/components/landing/LandingShell.test.jsx`
- `src/styles/landing.css`

### 아키텍처 결정 근거
- 랜딩 헤더는 이미 공통 서비스 셸과 분리돼 있으므로, 랜딩 전용 컴포넌트와 스타일만 수정해 다른 페이지 헤더에 영향을 주지 않도록 했습니다.
- 새 인터랙션이나 메뉴 구조 변경 없이 스타일 계층만 재설계해 기존 라우팅과 인증 동선을 그대로 유지했습니다.

## 2026-04-02

### 랜딩 페이지를 전시형 6섹션 구조로 재편
- 기존 서비스 소개형 `Landing`을 `Hero / Intro / EggScroll / Growth / Gallery / CTA` 구조로 분리했습니다.
- 랜딩 전용 컴포넌트, 데이터, 스타일 파일을 별도로 추가해 기존 전역 스타일 누적을 줄였습니다.
- `Digitama(133)`, `Botamon(210)`, `Koromon(225)`, `Agumon(240)` 자산을 랜딩 감정선에 맞춰 연결했습니다.

### 영향받은 파일
- `src/pages/Landing.jsx`
- `src/pages/Landing.test.jsx`
- `src/components/landing/*`
- `src/data/landingContent.js`
- `src/styles/landing.css`
- `src/components/landing/hooks/useEggScrollProgress.test.js`

### 아키텍처 결정 근거
- 현재 프로젝트는 CRA + JSX 중심이므로, Vite/TypeScript/shadcn 전체 스캐폴드를 가져오지 않고 섹션 구조만 채택했습니다.
- 스크롤 상태 계산은 `EggScroll` 내부에 하드코딩하지 않고 Hook으로 분리해 테스트 가능성과 유지보수성을 높였습니다.
- 랜딩 전용 스타일은 `landing.css`로 분리해 이후 모바일 튜닝과 인터랙션 보강을 독립적으로 이어갈 수 있게 했습니다.

### `/landing` 전용 풀블리드 전시형 레이아웃으로 확장
- `/landing`을 공통 `ServiceLayout` 밖으로 분리하고, `LandingShell`과 `LandingTopBar`를 추가해 전용 헤더와 본문 구조를 구성했습니다.
- Hero를 viewport 기준 풀블리드 스테이지로 재구성하고, 중간 `Gallery` 구간은 `Memory Scene` 역할의 대형 회상 장면으로 전환했습니다.
- 외부 대형 아트 없이도 동작하도록 `landingContent`에 optional artwork 필드를 추가하고, 기본값은 repo 스프라이트 합성 모드로 두었습니다.

### 추가 영향 파일
- `src/components/landing/LandingShell.jsx`
- `src/components/landing/LandingTopBar.jsx`
- `src/components/landing/LandingShell.test.jsx`
- `src/App.jsx`
- `src/App.test.js`
