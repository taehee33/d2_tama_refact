# 모바일 실시간 배틀 모달 디자인 QA

## Source visual truth

- 경로: `/var/folders/c3/yvqftb655357f3vlx335f7lm0000gn/T/codex-clipboard-cc40e2a6-0836-454b-bc36-7eb2f94f8538.png`
- 원본 픽셀: `1170 × 2532`
- 정규화 기준: iPhone 캡처 `3x`를 `390 × 844 CSS px` 기준으로 해석했다. 원본에는 Safari 상·하단 브라우저 크롬이 포함되어 있어 모달 외곽 비교에서는 웹 콘텐츠 영역을 기준으로 삼았다.
- 목표 상태: 실시간 배틀 라운드 4/7, 선택 대기, 0초 긴급 안내, 행동 선택 영역 노출.

## Implementation evidence

- 경로: `/private/tmp/realtime-arena-lobby-mobile-fixed-final.png`
- 구현 캡처: `390 × 844 px`, CSS viewport `390 × 844`, device scale factor `1`
- 구현 상태: 동일한 실시간 배틀 모달의 로비 화면. 로컬 게스트 계정은 비공개 실시간 아레나 테스트 참가자가 아니어서 실제 배틀 보드 진입은 제한되었고, 배틀 보드의 단계별 콘텐츠는 컴포넌트 테스트로 검증했다.
- 브라우저 검증: 로컬 CRA 화면을 390×844와 1024×768에서 열어 모달을 진입·측정하고 스크린샷을 캡처했다.

## Comparison evidence

### Full-view comparison

소스는 브라우저 크롬을 포함한 판정/선택 화면이고 구현 캡처는 크롬을 제외한 로비 화면이므로 내부 콘텐츠는 동일 상태로 비교하지 않았다. 대신 동일한 모달 셸의 상단 여백, 좌우 여백, 흰색 표면, 헤더/닫기 버튼, 화면 하단까지 이어지는 고정 외곽을 비교했다.

- 390×844 구현에서 모달 top `8px`, height `828px`, bottom `8px`로 확인했다.
- 소스의 웹 콘텐츠 영역에서도 모달이 상단에 밀착되고 화면 아래까지 고정되는 의도와 일치한다.
- 데스크톱 1024×768에서는 모달 height `454px`, top `157px`로 중앙 정렬을 확인했다.

### Focused-region comparison

모달 셸과 헤더/닫기 버튼 영역을 focused region으로 확인했다. 배틀 보드 내부의 스프라이트와 행동 카드 이미지는 기존 자산·스타일을 변경하지 않았고, 단계별 슬롯은 DOM 컴포넌트 테스트에서 상태 전환을 비교했다.

## Required fidelity surfaces

- Fonts and typography: 기존 프로젝트의 Pretendard/SUIT 계열과 헤더의 기존 Tailwind 크기·굵기를 유지했다. 긴 선택 안내 문구는 status grid의 유연한 두 번째 열에서 자연스럽게 줄바꿈된다.
- Spacing and layout rhythm: 모바일 top `8px`, 고정 모달 높이, header 고정, body 내부 스크롤, 단계별 빈 슬롯 높이를 적용했다. 공통 `Battle.css`의 80px 모바일 상단 규칙은 실시간 배틀 오버레이에 한정해 우선순위를 보정했다.
- Colors and visual tokens: 흰색 모달·어두운 오버레이·기존 보라색/상태 색상은 유지했고 빈 슬롯에는 별도 문구나 색상 플레이스홀더를 추가하지 않았다.
- Image quality and asset fidelity: 스프라이트·아이콘·행동 카드는 변경하지 않고 기존 렌더링 자산을 그대로 사용한다.
- Copy and content: 연결 복구, 판정, 행동 선택, 최근 라운드 결과 콘텐츠만 상태에 따라 표시하며 비활성 슬롯에는 문구를 표시하지 않는다. 0초 상태 테스트도 추가했다.

## Findings

발견된 P0/P1/P2 시각 이슈는 없다.

## Comparison history

1. 초기 구현 캡처에서 공통 `.fixed.inset-0.bg-black` 규칙이 더 높은 specificity로 적용되어 모바일/태블릿에서 상단 `80px` 여백이 남는 것을 확인했다.
2. `.realtime-arena-overlay.fixed.inset-0.bg-black` 범위의 CSS override를 추가했다.
3. 동일 390×844 viewport로 재캡처해 top `8px`, 고정 height `828px`, body `overflow-y: auto`를 확인했다. 1024×768에서도 자연 높이·중앙 정렬을 재확인했다.

## Implementation checklist

- [x] 모바일 모달 top 여백을 약 8px로 고정
- [x] 모바일 모달 전체 높이 고정 및 내부 스크롤
- [x] 헤더·닫기 버튼 고정 영역
- [x] 연결 복구·판정·행동 선택·최근 라운드 결과 슬롯 예약
- [x] 빈 슬롯에 플레이스홀더 문구 미표시
- [x] 데스크톱 자연 높이·중앙 정렬 유지
- [x] 배틀 보드 단계 전환 컴포넌트 테스트
- [x] 0초 긴급 상태 테스트
- [x] 브라우저 콘솔 확인

## Open questions and residual test gap

- 브라우저 게스트 계정에서 비공개 테스트 참가자 제한으로 실제 네트워크 배틀 보드의 0초/긴 문구 상태를 직접 캡처하지 못했다. `RealtimeArenaComponents.test.jsx`에서 선택 대기·판정 중·최근 라운드 슬롯과 0초 긴급 상태를 검증했다.
- 브라우저 콘솔에는 기존 게스트 API 접근 제한으로 보이는 `403 Forbidden` 리소스 오류가 기록되었으나, 이번 CSS/컴포넌트 변경에서 발생한 JavaScript 오류는 없었다.

## Follow-up polish

- 테스트 참가자 계정으로 실제 배틀 보드의 390×844 캡처를 추가하면 소스의 스프라이트·행동 카드 상태까지 동일 상태로 대조할 수 있다.

final result: passed
