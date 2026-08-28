# Ghost 아레나 모바일 공간 재배치 디자인 QA

## 비교 대상

- source visual truth: `/Users/hantaehee/Downloads/IMG_4778.PNG`, `/Users/hantaehee/Downloads/IMG_4779.PNG`
- browser-rendered implementation: `docs/design-qa/arena-ghost-mobile-space-final.png`
- 200% 확대 대응: `docs/design-qa/arena-ghost-mobile-space-200pct.png`
- combined comparison evidence: `docs/design-qa/arena-ghost-mobile-space-comparison.png`

## 정규화와 상태

- 원본은 `1170×2532` PNG에서 Safari 브라우저 chrome을 제외한 모달 영역 `1098×1950`을 crop한 뒤 `390px` 폭으로 정규화했다.
- 구현은 `390×844` CSS viewport·`390×844` PNG·device scale factor 1이다. 200% 확대 대응은 동등한 `195×422` CSS viewport에서 별도로 확인했다.
- 실제 `ArenaGhostScreen`과 프로덕션 CSS를 번들하고 Auth·Arena API·기록만 로컬 fixture로 교체했다. 원본의 Tokomon과 fixture의 Poyomon 차이는 레이아웃과 무관한 콘텐츠 차이다.

## 전체 비교와 필수 fidelity surface

- **fonts and typography:** 기존 시스템 글꼴, 제목·본문·메타 굵기와 상태 색을 유지했다. 320px 미만에서는 제목을 18px로 줄이고 보조 문구를 숨겨 세로 한 글자씩 줄바꿈되는 문제를 제거했다.
- **spacing and layout rhythm:** 현재 디지몬의 독립 Power 박스를 64px 이미지 우측 요약 버튼으로 통합했다. `내 Ghost`는 1행 헤더로 접히고 상대 영역이 남은 높이와 320px 최소 높이를 사용해 원본보다 상대 카드를 더 많이 노출한다.
- **colors and tokens:** 기존 blue·emerald·red Tailwind 상태 토큰, 파란 현재 디지몬 배경, 흰 카드와 gray border를 그대로 재사용했다.
- **image quality:** 기존 버전별 PNG 스프라이트와 `pixelated` 렌더링을 재사용했으며 대체 자산을 추가하지 않았다.
- **copy and content:** Power 계산값, 공격·방어 전적, 슬롯 상태, 등록·삭제·도전·정렬 문구는 유지했다. 접힌 헤더는 사용자 선택대로 이름·썸네일 없이 수량만 표시한다.

## 상호작·접근성

- 390×844에서 `내 Ghost 펼치기`는 `aria-expanded=false`, `aria-controls=arena-my-ghosts-content`로 시작하고 클릭 후 `내 Ghost 접기`, `aria-expanded=true`로 변화한다.
- 탭 이동 상태 유지와 모달 재마운트 시 기본 접힘은 Jest로 검증했다. 데스크톱에서는 toggle을 렌더링하지 않고 카드를 항상 노출한다.
- 접기·펼치기, 규칙, 닫기, 등록, 새로고침, 도전 버튼은 44px 이상 높이를 유지한다.
- 브라우저 console error/warning은 0건이다.

## Findings와 비교 이력

- 1차 200% 확대 동등 비교에서 195px CSS 폭의 헤더 제목이 한 글자씩 줄바꿈되는 P2 문제를 확인했다.
- 수정: 320px 미만에서 헤더를 2행으로 전환하고, 제목 크기·모달 여백을 줄이고 보조 문구를 숨겼다.
- 2차 비교에서 제목이 한 행으로 복구되고 탭·규칙·닫기·현재 디지몬·Power가 수평 스크롤 없이 독립적으로 재배치되었다. 추가 P0/P1/P2는 없다.
- P3: 200% 확대에서 현재 디지몬의 전적과 등록 버튼은 세로 스크롤 후 확인해야 한다. 핵심 정보가 순서대로 reflow되고 조작이 잘리지 않으므로 차단 이슈로 분류하지 않았다.

## Implementation Checklist

- [x] 모바일 내 Ghost 기본 접힘·수량 요약·탭 상태 유지
- [x] 데스크톱 항상 펼침
- [x] 현재 디지몬 인라인 Power 요약·기존 상세 패널 재사용
- [x] 도전 상대 320px 최소 높이·독립 스크롤
- [x] 390×844, 200% 확대 대응, 접기·펼치기, console 검증

final result: passed
