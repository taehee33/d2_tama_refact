export const newsHighlights = [
  {
    id: "service-shell",
    category: "서비스 셸",
    date: "2026-03-30",
    title: "홈·플레이·마이 흐름을 서비스 구조로 정리했습니다.",
    summary:
      "홈에서 플레이 허브, 게임 화면, 마이 허브로 이어지는 공통 라우트와 레이아웃을 정리했습니다.",
  },
  {
    id: "panel-upgrade",
    category: "페이지 승격",
    date: "2026-03-30",
    title: "도감·계정 설정·가이드를 페이지형 패널로 올렸습니다.",
    summary:
      "기존 모달 본문을 공용 패널로 분리해 게임 내 모달과 서비스 페이지에서 같은 내용을 재사용하도록 바꿨습니다.",
  },
  {
    id: "master-data",
    category: "운영",
    date: "2026-03-29",
    title: "디지몬 마스터 데이터 편집 흐름을 다시 정리했습니다.",
    summary:
      "설정 안의 관리자 진입점, Firestore 저장, 스냅샷 기록과 복원 흐름을 다시 정비했습니다.",
  },
];

export const newsRoadmap = [
  "커뮤니티 게시판 및 자랑 피드 실제 데이터 연결",
  "운영 공지와 패치 노트 전용 컬렉션 설계",
  "지원 페이지 FAQ와 문의 경로 고도화",
];

export const communityBoards = [
  {
    id: "showcase",
    title: "내 디지몬 자랑",
    description: "성장 기록, 대표 장면, 오늘의 상태 화면을 올리는 메인 피드",
    status: "준비 중",
  },
  {
    id: "evolution-notes",
    title: "진화 노트",
    description: "케어 미스, 훈련, 배틀 수와 진화 결과를 기록하는 데이터형 게시판",
    status: "기획 정리 중",
  },
  {
    id: "jogress",
    title: "조그레스 모집",
    description: "온라인 파트너 모집과 방 생성 규칙을 연결하는 실시간 모집 보드",
    status: "실시간 연동 예정",
  },
];

export const communityGuidelines = [
  "스크린샷과 진화 기록은 슬롯 정보가 보이도록 함께 올리기",
  "조그레스 모집 글은 버전, 목표 진화, 가능한 시간대를 함께 적기",
  "배틀 결과와 케어 조건은 가능한 한 숫자 기준으로 적기",
];

export const supportFaqs = [
  {
    id: "auth-required",
    question: "로그인 없이 플레이할 수 있나요?",
    answer:
      "현재 서비스 셸 기준 플레이는 Firebase Auth가 필요합니다. Google 로그인과 게스트 로그인 모두 Firebase 기반이며, 완전 오프라인 localStorage 슬롯 모드는 현재 공식 지원하지 않습니다.",
  },
  {
    id: "guest-account",
    question: "게스트 로그인도 저장되나요?",
    answer:
      "네. 현재 게스트 로그인도 Firebase 익명 계정으로 동작하며, 슬롯과 진행 상태는 Firestore에 저장됩니다.",
  },
  {
    id: "collection-sync",
    question: "도감과 계정 설정이 바로 반영되지 않으면 어떻게 하나요?",
    answer:
      "최근 구조 개편 이후에는 페이지 새로고침 없이 반영되도록 정리했습니다. 그래도 반영이 늦다면 다시 진입하거나 네트워크 상태를 먼저 확인해 주세요.",
  },
  {
    id: "bug-report",
    question: "버그 제보 시 무엇을 같이 남기면 좋나요?",
    answer:
      "슬롯 번호, 기종/버전, 현재 디지몬 이름, 마지막 행동, 에러 화면 또는 콘솔 메시지를 함께 남겨주면 원인 파악이 훨씬 빨라집니다.",
  },
];

export const supportChecklist = [
  "슬롯 번호와 디지몬 이름",
  "문제가 발생한 화면 경로 (/play, /play/:slotId 등)",
  "기종과 버전 (Ver.1 / Ver.2)",
  "직전 행동과 재현 순서",
  "가능하면 스크린샷 또는 로그",
];

export const supportStatusCards = [
  {
    id: "storage",
    title: "현재 저장 방식",
    description: "공식 저장소는 Firestore이며, localStorage는 UI/개발 설정 중심으로 남아 있습니다.",
  },
  {
    id: "account",
    title: "현재 계정 방식",
    description: "Google 로그인과 게스트 로그인 모두 Firebase Auth를 사용합니다.",
  },
];
