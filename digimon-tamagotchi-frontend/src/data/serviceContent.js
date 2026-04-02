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
  "커뮤니티 자랑 피드와 자동 스냅샷 카드 연결",
  "운영 공지와 패치 노트 전용 컬렉션 설계",
  "지원 페이지 FAQ와 문의 경로 고도화",
];

export const communityBoards = [
  {
    id: "free",
    title: "자유게시판",
    description: "플레이 근황, 공략 잡담, 짧은 질문을 나누는 대화형 보드",
    status: "오픈 안내",
  },
  {
    id: "showcase",
    title: "자랑게시판",
    description: "대표 장면과 성장 로그를 올리는 메인 피드",
    status: "피드형",
  },
  {
    id: "support",
    title: "버그제보 / QnA",
    description: "버그 재현 정보와 FAQ를 함께 모아 보는 지원 보드",
    status: "바로 이용 가능",
  },
  {
    id: "discord",
    title: "디스코드",
    description: "실시간 채널 안내와 커뮤니티 접속 정보를 모은 보드",
    status: "실시간 안내",
  },
];

export const defaultCommunityBoardId = "showcase";
export const communityBoardIds = communityBoards.map((board) => board.id);
const communityBoardIdSet = new Set(communityBoardIds);

export function resolveCommunityBoardId(search = "") {
  const boardId = new URLSearchParams(search).get("board");

  return communityBoardIdSet.has(boardId)
    ? boardId
    : defaultCommunityBoardId;
}

export function getCommunityBoardHref(boardId = defaultCommunityBoardId) {
  const resolvedBoardId = communityBoardIdSet.has(boardId)
    ? boardId
    : defaultCommunityBoardId;

  return `/community?board=${resolvedBoardId}`;
}

export const communityFreeBoardTopics = [
  {
    id: "daily-log",
    badge: "근황 공유",
    title: "오늘 플레이 로그",
    description:
      "배틀 결과, 수면 루틴, 훈련 기록처럼 짧게 남기고 싶은 근황을 가볍게 나누는 주제입니다.",
  },
  {
    id: "care-tip",
    badge: "공략 잡담",
    title: "케어 팁과 루틴 메모",
    description:
      "먹이 간격, 호출 대응, 실수 줄인 방법처럼 바로 따라 해 볼 수 있는 운영 팁을 모읍니다.",
  },
  {
    id: "small-question",
    badge: "짧은 질문",
    title: "소소한 QnA",
    description:
      "지금 디지몬 상태가 괜찮은지, 다음 목표를 뭘로 잡을지처럼 가벼운 질문을 편하게 주고받습니다.",
  },
];

export const communityShowcaseSamples = [
  {
    id: "sample-showcase-1",
    authorTamerName: "가루몬마스터",
    title: "오늘은 배틀 승률 70%를 넘겼어요",
    body: "훈련 12회 찍고 들어가니 체감이 확실하네요. 다음 목표는 케어 미스 줄이기입니다.",
    commentCount: 2,
    createdAt: "2026-03-31T20:15:00.000Z",
    snapshot: {
      slotName: "슬롯2",
      digimonDisplayName: "가루몬",
      selectedDigimon: "Garurumon",
      stageLabel: "성숙기",
      version: "Ver.1",
      device: "Digital Monster Color 25th",
      weight: 18,
      careMistakes: 1,
      totalBattles: 10,
      totalBattlesWon: 7,
      winRate: 70,
      visual: {
        backgroundNumber: 162,
        isLightsOn: true,
        sleepStatus: "AWAKE",
        poopCount: 1,
        isFrozen: false,
        isDead: false,
        isInjured: false,
        recordedAt: "2026-03-31T20:15:00.000Z",
      },
    },
  },
  {
    id: "sample-showcase-2",
    authorTamerName: "코로몬연구원",
    title: "수면 루틴 맞추니 상태 관리가 훨씬 편해졌습니다",
    body: "밤에는 꼭 불을 끄고, 아침에 바로 체크하니 실수가 많이 줄었어요.",
    commentCount: 1,
    createdAt: "2026-03-30T08:42:00.000Z",
    snapshot: {
      slotName: "슬롯1",
      digimonDisplayName: "코로몬",
      selectedDigimon: "Koromon",
      stageLabel: "유년기 II",
      version: "Ver.2",
      device: "Digital Monster Color 25th",
      weight: 9,
      careMistakes: 0,
      totalBattles: 3,
      totalBattlesWon: 2,
      winRate: 67,
      visual: {
        backgroundNumber: 163,
        isLightsOn: false,
        sleepStatus: "SLEEPING",
        poopCount: 0,
        isFrozen: false,
        isDead: false,
        isInjured: false,
        recordedAt: "2026-03-30T08:42:00.000Z",
      },
    },
  },
  {
    id: "sample-showcase-3",
    authorTamerName: "메모 수집가",
    title: "상태 화면만 짧게 남기는 용도로도 좋아요",
    body: "오늘 하트 상태와 배틀 수만 빠르게 남기고 싶을 때 쓰는 예시입니다. 스크린샷 대신 숫자 기록만 남겨도 비교가 편합니다.",
    commentCount: 0,
    createdAt: "2026-04-01T03:05:00.000Z",
    snapshot: {
      slotName: "슬롯4",
      digimonDisplayName: "가브몬",
      selectedDigimon: "Gabumon",
      stageLabel: "성숙기",
      version: "Ver.1",
      device: "Digital Monster Color 25th",
      weight: 16,
      careMistakes: 0,
      totalBattles: 6,
      totalBattlesWon: 5,
      winRate: 83,
      visual: {
        backgroundNumber: 168,
        isLightsOn: true,
        sleepStatus: "TIRED",
        poopCount: 6,
        isFrozen: false,
        isDead: false,
        isInjured: false,
        recordedAt: "2026-04-01T03:05:00.000Z",
      },
    },
  },
];

export const communityGuidelines = [
  "대표 장면은 슬롯명과 디지몬 이름이 함께 보이게 올리기",
  "자랑 글에는 오늘 상태나 다음 목표를 한 줄 더 적기",
  "댓글에는 훈련 루틴이나 배틀 결과를 덧붙여 흐름 이어가기",
];

export const communityFreeBoardTips = [
  "자유게시판은 짧은 플레이 근황과 공략 잡담을 빠르게 주고받는 공간으로 사용합니다.",
  "자랑용 대표 장면과 성장 로그는 자랑게시판에 남기면 흐름이 더 잘 정리됩니다.",
  "운영 문의, 오류 제보, 저장 문제는 버그제보 / QnA 보드로 분리해서 남겨 주세요.",
];

export const communityDiscordInvite = {
  label: "디지몬 키우기 디스코드 입장",
  url: "https://discord.gg/BWXFtSCnGt",
  description:
    "실시간으로 질문을 주고받거나, 스냅샷을 바로 공유하고 싶다면 디스코드 채널에서 이어서 대화할 수 있습니다.",
};

export const communityDiscordChannels = [
  {
    id: "notice",
    title: "공지 확인",
    description: "업데이트 공지, 이용 규칙, 최근 변경사항을 먼저 확인하는 진입 흐름입니다.",
  },
  {
    id: "showoff",
    title: "자랑 스냅샷",
    description: "대표 장면과 성장 로그를 실시간으로 공유할 때 먼저 둘러보면 좋은 영역입니다.",
  },
  {
    id: "support",
    title: "버그제보 / QnA",
    description: "재현 순서, 오류 메시지, 질문 답변을 빠르게 연결해 확인하는 지원 흐름입니다.",
  },
  {
    id: "free-talk",
    title: "자유잡담",
    description: "플레이 근황, 공략 메모, 소소한 질문을 편하게 주고받는 대화 용도입니다.",
  },
];

export const communityDiscordChecklist = [
  "입장 후 먼저 공지와 운영 규칙을 확인해 주세요.",
  "버그 제보는 슬롯 번호, 버전, 마지막 행동, 재현 순서를 함께 남기면 확인이 빨라집니다.",
  "자랑 스냅샷과 자유잡담은 채널 성격에 맞춰 분리해서 올리면 기록을 다시 찾기 쉽습니다.",
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
