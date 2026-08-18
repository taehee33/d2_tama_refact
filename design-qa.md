# 10버튼 원작풍 세로 스킨 디자인 QA

## 비교 대상

- source visual truth:
  - `digimon-tamagotchi-frontend/public/images/immersive/portrait-pixel/split-brick-10.png`
  - `digimon-tamagotchi-frontend/public/images/immersive/portrait-pixel/red-device-10.png`
  - `digimon-tamagotchi-frontend/public/images/immersive/portrait-pixel/dark-battle-10.png`
- browser-rendered implementation:
  - `docs/design-qa/pixel-split-mobile.png`
  - `docs/design-qa/pixel-red-mobile.png`
  - `docs/design-qa/pixel-dark-mobile.png`
  - `docs/design-qa/pixel-split-wide-full.png`
  - `docs/design-qa/pixel-red-wide-full.png`
  - `docs/design-qa/pixel-dark-wide-full.png`
- combined comparison evidence: `docs/design-qa/pixel-skins-comparison.png`

## 정규화와 상태

- 모바일 viewport: `390×844` CSS px, device scale factor 1 기준. 세 구현 캡처는 모두 `390×844` PNG다.
- 넓은 화면 viewport: `1024×900` CSS px. 프레임은 구현의 `max-width: 500px` 규칙에 따라 중앙 정렬했으며 전체 페이지 캡처로 세로 잘림을 배제했다.
- source raster: 각 `853×1844` PNG를 같은 `390×844` 비율로 축소해 비교했다.
- state: 현재 시각 `16:09`, 디지몬 라벨 `코로몬`, 상태 메뉴 활성, 조명 켜짐, 냉장고 해제. LCD에는 실제 게임 배경 자산을 넣어 빈 마젠타 영역 대체와 프레임 크롭을 확인했다.
- 운영 Firestore에 QA 슬롯을 새로 만들지 않기 위해, 브라우저 비교는 실제 컴포넌트와 동일한 DOM 클래스·CSS·래스터·메뉴 아이콘으로 구성한 로컬 전용 비교 하네스에서 캡처했다. 실제 콜백·잠금·저장 계약은 Jest 컴포넌트 테스트로 별도 검증했다.

## 전체 화면 비교

- 세 스킨 모두 중앙 LCD, 게임기 프레임, 10개 원형 버튼의 `5×2` 리듬이 시안과 일치한다.
- 블루·화이트 스킨의 소형 게임기, 좌우 분할 배경, 상단 엠블럼을 유지했다.
- 레드 디바이스와 다크 배틀은 각각 청록 그리드/붉은 벽돌, 검정 그리드/붉은 균열의 원작풍 질감과 프레임 비율을 유지했다.
- 구현에서는 마젠타 LCD를 게임 화면으로, 마젠타 버튼 중심을 실제 픽셀 아이콘과 한국어 라벨로 교체했다. 이는 계획된 기능적 차이다.
- 넓은 화면에서는 셸을 500px로 제한하고 중앙 정렬해 늘어짐과 픽셀 텍스처 흐림을 막았다.

## 필수 fidelity surface

- typography: 짧은 한국어 라벨은 monospace 굵은 글꼴과 어두운 픽셀 그림자를 사용한다. 390px에서 줄바꿈·잘림이 없고 현재 시각/디지몬 이름의 위계가 과하지 않다.
- spacing/layout rhythm: 10개 버튼이 정확히 두 행, 각 다섯 칸으로 정렬된다. 버튼 터치 영역은 최소 44px이며 LCD·버튼·배경 사이 충돌이 없다.
- colors/tokens: 스킨 기본 팔레트가 시안에서 추출한 색을 사용하고, 좌/우 배경과 게임기 틴트를 스킨별 실제 PNG 알파 마스크에 독립 토큰으로 적용한다. 활성 메뉴의 노란 링과 비활성 opacity가 배경과 구분된다.
- image quality: 세 셸과 모든 메뉴 아이콘은 실제 PNG 래스터다. 390px와 500px 모두 `image-rendering: pixelated`로 픽셀 경계가 유지되며 늘림·잘못된 크롭·투명도 가장자리 문제가 없다.
- copy/content: 버튼 라벨은 `상태, 먹이, 훈련, 배틀, 교감 / 화장실, 조명, 치료, 호출, 더보기` 순서로 기존 게임 정의와 일치한다.

## 상호작용과 접근성

- 10개 버튼의 순서, 한국어 접근성 이름, 메뉴 ID 콜백, 활성 `aria-pressed`를 테스트했다.
- 조명 꺼짐과 냉장고 상태의 비활성/이유 문구는 기존 `getMenuDisabledState` 정책을 그대로 사용한다.
- 첫 스킨의 왼쪽 위 소형 게임기만 `외형 꾸미기 열기` 버튼으로 동작한다.
- 외형 모달의 프리셋, 자유 색상, 스킨별 draft 독립성, 초기화, 취소, 저장 1회 전달을 테스트했다.
- 브라우저 캡처 중 콘솔 error는 0건이었다.

## Findings

- P0/P1/P2 없음.
- P3: 현재 라벨은 원작 기기 밀도를 우선해 작게 보인다. 390px에서 판독 가능하고 44px 터치 영역을 확보해 차단 이슈로 분류하지 않았다.

## 비교 이력

- 1차 비교: 세 모바일 시안과 구현을 동일한 `390×844` 상태로 결합해 확인했다. 액션 가능한 P0/P1/P2 차이가 없어 수정 반복은 필요하지 않았다.
- 넓은 화면 확인: 세 스킨 모두 500px 최대 폭과 중앙 정렬이 유지되고 전체 페이지 캡처에서 영구 컨트롤 잘림이 없음을 확인했다.

## Implementation Checklist

- [x] 3개 래스터 셸과 10버튼 `5×2` 배치
- [x] 실제 `GameScreen`과 기존 메뉴 정의 연결
- [x] 독립 외형 색상과 스킨별 저장 복구
- [x] 모바일/넓은 화면 캡처
- [x] 콜백·잠금·저장 회귀 테스트

final result: passed
