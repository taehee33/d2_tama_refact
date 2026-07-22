# Arena Ghost 현재 디지몬 정보 복구 QA

- source visual truth path: `/var/folders/c3/yvqftb655357f3vlx335f7lm0000gn/T/codex-clipboard-66ffcee4-13ae-494a-9941-40ecd8412762.png`
- implementation screenshot path: `/private/tmp/arena-restore-preview-collapsed.png`
- expanded implementation screenshot path: `/private/tmp/arena-restore-preview.png`
- viewport: 1248 × 720 CSS px
- source pixels: 1748 × 958 px (제공 스크린샷, density 정보 없음)
- implementation pixels: 1248 × 720 px (브라우저 캡처, device scale 1)
- density normalization: 전체 화면의 1:1 픽셀 비교 대신 동일한 현재 디지몬 정보 영역을 한 비교 입력에서 나란히 확인했습니다. 원본과 구현 캡처의 화면 크기와 콘텐츠 범위가 달라 절대 좌표 비교는 적용하지 않았습니다.
- state: 현재 디지몬 Tokomon, 활성 Ghost 2마리, Power 상세 접힘/펼침, 배틀 공식 접힘/펼침

## Findings

- P0/P1/P2 차이 없음.
- 현재 디지몬 스프라이트가 실제 자산으로 선명하게 표시되고, 이름·슬롯·단계·속성·전적의 기존 정보 위계가 유지됩니다.
- 기존의 단일 Power 문구는 같은 영역 안에서 요약식과 펼칠 수 있는 상세 계산으로 확장되어 정보 밀도를 조절합니다.
- 배틀 공식은 별도 접이식 패널로 복구되어 내 Ghost 목록을 과도하게 아래로 밀지 않습니다.

## Required Fidelity Surfaces

- Fonts and typography: 프로젝트 기존 Tailwind 글꼴과 굵기 체계를 유지했고, 제목/보조 설명/계산 결과의 위계와 줄바꿈이 안정적입니다.
- Spacing and layout rhythm: 기존 파란 현재 디지몬 카드의 패딩과 라운드를 유지하면서 이미지 열과 정보 열을 반응형으로 배치했습니다.
- Colors and visual tokens: 기존 blue 계열 현재 카드, green/red 전적 색상, emerald 계열 안내 패널을 사용해 프로젝트 토큰과 일치합니다.
- Image quality and asset fidelity: `spriteBasePath`의 실제 PNG를 `object-contain` 및 pixelated 렌더링으로 표시하며 깨진 이미지가 없는 것을 `naturalWidth=48`, `naturalHeight=48`로 확인했습니다.
- Copy and content: Power 구성 항목, 활성 Ghost 최대 +3, 방어 보너스 +1, 3회 명중, 최대 100라운드, 속성 ±5%, 배틀 후 Weight/Energy 반영을 현재 V2 서버 규칙과 대조했습니다.

## Full-view Comparison Evidence

- 원본과 구현 캡처를 동일 비교 입력에서 확인했습니다.
- 원본의 현재 디지몬 카드 구조는 유지되며, 누락됐던 스프라이트가 왼쪽에 복구됐습니다.
- 추가 상세 정보는 카드 내부와 바로 아래 안내 패널에 배치되어 내 Ghost/도전 상대 섹션의 기존 구조를 변경하지 않습니다.

## Focused Region Comparison Evidence

- 현재 디지몬 카드와 Power 영역을 확대 확인했습니다.
- 접힘 상태에서 핵심 Power 식이 한 줄로 보이고, 펼침 상태에서 Base/Strength/Traited Egg/Effort 및 Ghost 보너스가 두 열로 읽힙니다.
- 배틀 공식 패널의 접힘/펼침 버튼과 모든 규칙 문구가 브라우저 DOM에서 노출되는 것을 확인했습니다.

## Interaction and Runtime Checks

- Power 상세 접기/펼치기 동작 확인.
- 배틀 공식 및 규칙 접기/펼치기 동작 확인.
- 현재 디지몬 이미지 로드 완료와 자연 크기 확인.
- 기능 관련 콘솔 오류 없음. 로컬 환경에서 기존 Ably 연결 타임아웃 로그 1건은 확인됐으나 이번 아레나 UI 변경과 무관합니다.

## Comparison History

1. 첫 캡처에서 QA용 fixture의 임시 sprite 경로가 잘못되어 이미지가 깨지는 P1 문제를 발견했습니다.
2. fixture를 실제 `spriteBasePath`인 `/Ver3_Mod_codex`로 수정했습니다. 제품 코드는 처음부터 `currentDigimonData.spriteBasePath`를 사용했습니다.
3. 재캡처에서 실제 이미지가 표시되고 P0/P1/P2 문제가 남지 않은 것을 확인했습니다.

## Implementation Checklist

- [x] 현재 디지몬 실제 이미지 복구
- [x] Power 요약 및 상세 계산 복구
- [x] V2 서버 기준 배틀 공식 복구
- [x] 접기/펼치기 상호작용 확인
- [x] 전체 프론트엔드 테스트 및 프로덕션 빌드 통과

## Follow-up Polish

- 없음.

final result: passed
