# Ghost 아레나 대전 중심 재구성 디자인 QA

## 비교 대상

- source visual truth:
  - `/var/folders/c3/yvqftb655357f3vlx335f7lm0000gn/T/codex-clipboard-2b794694-f784-45dc-a0dc-15ea24d07639.png`
  - `/var/folders/c3/yvqftb655357f3vlx335f7lm0000gn/T/codex-clipboard-73ac041a-4d40-4907-a395-14986b8138d5.png`
  - `/var/folders/c3/yvqftb655357f3vlx335f7lm0000gn/T/codex-clipboard-d3ac3fc3-7e8a-44ee-9dab-94da3e33790b.png`
  - 확정 계획의 `대전/기록` 탭, 고정 높이 모달, 압축 카드, 우측·하단 상세 패널 요구사항
- browser-rendered implementation:
  - `docs/design-qa/arena-ghost-desktop.png`
  - `docs/design-qa/arena-ghost-history.png`
  - `docs/design-qa/arena-ghost-guide.png`
  - `docs/design-qa/arena-ghost-mobile.png`
- combined comparison evidence: `docs/design-qa/arena-ghost-comparison.png`

## 정규화와 상태

- 기존 대전 화면 source는 `1756×1568` PNG이며, 구현 데스크톱은 `1440×900` CSS viewport·`1440×900` PNG·device scale factor 1 기준으로 캡처했다. 비교 보드는 양쪽 이미지를 같은 `object-fit: contain` 영역에 배치해 전체 정보 밀도와 세로 길이를 비교했다.
- 모바일은 브라우저 DOM 기준 `390×844` CSS viewport에서 dialog `336×820`, 대전 패널 `336×698`을 확인했다. 인앱 브라우저 저장 캡처는 가용 표면에 맞춰 `360×844` PNG로 정규화되었으므로 수치 판정은 DOM 측정값을 함께 사용했다.
- 상태는 현재 Poyomon, 내 Ghost 3/3, 도전 상대 10개, 배틀 기록 5개다. 실제 `ArenaGhostScreen` 소스와 CSS를 번들하고 Auth·Arena API·기록 데이터만 로컬 fixture로 교체한 비교 하네스를 사용해 운영 Firestore 쓰기나 신규 계정 생성을 피했다.

## 전체 화면 비교

- 기존 화면에서 세로로 분리되어 있던 현재 디지몬, 규칙, 내 Ghost, 상대, 기록이 기본 `대전` 탭과 별도 `기록` 탭으로 재편되었다.
- `1440×900`에서 헤더·탭·현재 디지몬·내 Ghost 3개·도전 상대 목록이 모달 외부 스크롤 없이 모두 보인다. 상대가 많을 때는 상대 영역만 독립적으로 스크롤한다.
- 기록 5개는 한 화면 안에 압축 행으로 표시되고 필터·새로고침·더보기 조작이 유지된다.
- 규칙과 Power 상세는 본문 높이를 바꾸지 않는 우측 패널로 열리며, 모바일에서는 하단 패널 규칙으로 전환된다.

## 필수 fidelity surface

- **typography:** 기존 시스템 글꼴·굵기·상태 색을 유지했다. 제목 20–24px, 카드 제목 14–16px, 보조 메타데이터 11–12px로 위계를 줄였고 긴 이름과 상태는 카드 경계에서 말줄임 처리한다.
- **spacing/layout rhythm:** 모달 최대 폭을 넓히고 12–16px 섹션 간격, 8–12px 카드 간격, 64px 현재 스프라이트, 48px Ghost 스프라이트를 사용한다. 데스크톱 상단은 현재 디지몬과 Ghost 3개가 한 행이며 하단 상대 영역이 남은 높이를 채운다.
- **colors/tokens:** 기존 Tailwind blue·emerald·red 상태 토큰, 흰 카드, 옅은 파란 현재 디지몬 배경을 유지해 기존 제품과 시각적으로 이어진다. 신규 탭 선택선과 상세 패널 오버레이 대비도 충분하다.
- **image quality:** 모든 디지몬과 은닉 상대는 기존 실제 PNG 자산과 `pixelated` 렌더링을 사용한다. 임의 도형·대체 아이콘·늘린 이미지는 추가하지 않았다.
- **copy/content:** 등록 형태 전적, Ghost 방어 전적, 등록일, Power, 서버 확정 안내와 상대 은닉 문구는 유지했다. 공간 절약을 위해 반복 설명만 상세 패널로 이동했다.

## 상호작용과 접근성

- `대전/기록`은 `tablist/tab/tabpanel`, 메인 화면은 `dialog/aria-modal`, 상세 패널은 이름 있는 중첩 dialog로 확인했다.
- 기록은 탭을 처음 선택할 때 마운트되고 대전으로 돌아간 뒤에도 상태 경계를 유지한다.
- 상세 패널은 Escape로 닫히고 실행했던 `Power 상세 보기` 버튼으로 포커스가 복귀한다.
- 모바일 `390×844`에서 대전 본문은 내부 세로 스크롤(`698/804px`), 내 Ghost는 가로 스크롤(`271/736px`), 상대는 1열로 계산된다. 탭·닫기·규칙·등록·삭제·도전 등 주요 조작은 44px 높이를 유지한다.
- 미리보기 URL의 console error/warning은 0건이다.

## Findings

- P0/P1/P2 없음.
- P3: 모바일에서 세 Ghost 카드의 보조 메타데이터가 조밀하다. 가로 스크롤로 카드 폭을 보존하고 주요 조작은 44px를 유지하므로 차단 이슈로 분류하지 않았다.

## 비교 이력

- 1차 비교: 데스크톱 레이아웃은 목표 밀도를 충족했지만 로컬 fixture의 sprite path가 실제 버전별 자산과 달라 잘못된 이미지가 보였다.
- 수정: Poyomon·레오몬·하이안드로몬·가지몬 fixture에 실제 `Ver3/4/5_Mod_codex` 경로와 번호를 적용하고 자산을 다시 포함했다.
- 2차 비교: `arena-ghost-desktop.png`과 `arena-ghost-comparison.png`에서 모든 실제 픽셀 스프라이트, 한 화면 대전 구성, 상대 내부 스크롤을 확인했다. 추가 P0/P1/P2는 없었다.

## Implementation Checklist

- [x] 대전·기록 탭과 기록 최초 지연 마운트
- [x] 고정 높이 모달과 현재 디지몬·내 Ghost 압축 카드
- [x] 상대 2열·모바일 1열 내부 스크롤
- [x] 규칙·Power 우측/하단 상세 패널
- [x] Escape 닫기·포커스 복귀·44px 주요 조작
- [x] 데스크톱·모바일·기록·규칙 브라우저 캡처와 콘솔 검사

final result: passed
