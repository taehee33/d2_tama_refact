export const landingHeroContent = {
  eyebrow: "DIGIMON MEMORY EXHIBITION",
  title: ["그 시절,", "우리는 모두 선택받은 아이들이었다"],
  description:
    "어린 시절의 모험과 파트너 디지몬. 다시 시작되는 작은 모험이, 이제 당신의 손 안에서 천천히 깨어납니다.",
  backgroundArtworkSrc: null,
  imageSrc: "/images/133.png",
  imageAlt: "빛을 머금은 디지타마 포스터 비주얼",
  posterMeta: "DIGITAMA / MEMORY SIGNAL / 1999",
};

export const landingIntroContent = {
  eyebrow: "INTRODUCTION",
  title: "화면 너머로만 보이던 디지털 월드가 다시 열립니다",
  body: [
    "어린 시절 TV 화면 너머로만 보이던 세계.",
    "선택받은 아이들과 파트너 디지몬, 그리고 함께했던 성장의 기억.",
    "이 랜딩은 그 감정을 다시 꺼내기 위한 조용한 입구입니다.",
  ],
  caption: "Digimon Adventure / Memory / Connection",
  bridgeNote:
    "설명보다 장면이 먼저 도착하고, 스크롤이 깊어질수록 브랜드 페이지에서 디지털 월드로 분위기가 전환됩니다.",
};

export const landingEggStates = [
  {
    key: "detected",
    hudLabel: "SIGNAL 01",
    status: "DIGITAL EGG DETECTED",
    message: "신호를 감지했습니다",
    note: "아직은 미세한 파동만 감지됩니다. 조용하지만 분명한 시작입니다.",
    imageSrc: "/images/133.png",
    imageAlt: "부화를 기다리는 디지타마",
  },
  {
    key: "connecting",
    hudLabel: "SIGNAL 02",
    status: "WORLD LINK IN PROGRESS",
    message: "디지털 월드와 연결 중",
    note: "빛의 결이 조금씩 짙어지고, 알의 표면 위로 연결 신호가 쌓여 갑니다.",
    imageSrc: "/images/133.png",
    imageAlt: "연결 신호를 받는 디지타마",
  },
  {
    key: "hatching",
    hudLabel: "SIGNAL 03",
    status: "HATCHING SEQUENCE STARTED",
    message: "부화가 시작됩니다",
    note: "균열은 아주 작게 시작되지만, 한번 열린 틈은 다시 닫히지 않습니다.",
    imageSrc: "/images/210.png",
    imageAlt: "깜몬의 실루엣이 비치는 부화 장면",
  },
  {
    key: "awake",
    hudLabel: "SIGNAL 04",
    status: "CONNECTION ESTABLISHED",
    message: "첫 번째 생명이 깨어납니다",
    note: "부화는 끝이 아니라 연결의 시작입니다. 이제 첫 번째 파트너를 만날 시간입니다.",
    imageSrc: "/images/210.png",
    imageAlt: "부화 직후 깨어난 깜몬",
  },
];

export const landingGrowthContent = {
  eyebrow: "FIRST PARTNER",
  title: "코로몬",
  stage: "유년기 II / 첫 번째 파트너",
  description:
    "처음 만난 파트너는 아직 작고 연약하지만, 그 작은 존재가 모험의 온도를 완전히 바꿉니다. 지금은 돌보고, 부르고, 함께 시간을 쌓는 순간입니다.",
  imageSrc: "/images/225.png",
  imageAlt: "첫 번째 파트너 코로몬",
  nextTitle: "다음 진화 신호",
  nextName: "아구몬",
  nextImageSrc: "/images/240.png",
  nextImageAlt: "다음 진화를 예고하는 아구몬",
  statusBars: [
    { label: "동기화율", value: 82, tone: "blue" },
    { label: "안정도", value: 91, tone: "green" },
    { label: "유대", value: 76, tone: "blue" },
  ],
  actions: ["FEED", "CALL", "TRAIN"],
};

export const landingMemorySceneContent = {
  eyebrow: "MEMORY SCENE",
  title: "그 여름의 디지털 월드",
  description:
    "한 장면만으로도 여름빛, 모험, 파트너의 온도가 돌아오는 구간입니다. 정보보다 감정이 먼저 닿도록 크게 펼쳐 둡니다.",
  overlayQuote: "그 시절, 우리는 모두 선택받은 아이들이었다",
  backgroundArtworkSrc: null,
  spriteBand: [
    {
      id: "botamon",
      src: "/images/210.png",
      alt: "회상 장면 속 깜몬",
      className: "landing-memory-scene__sprite--botamon",
    },
    {
      id: "koromon",
      src: "/images/225.png",
      alt: "회상 장면 속 코로몬",
      className: "landing-memory-scene__sprite--koromon",
    },
    {
      id: "agumon-main",
      src: "/images/240.png",
      alt: "회상 장면 속 아구몬",
      className: "landing-memory-scene__sprite--agumon-main",
    },
    {
      id: "agumon-side",
      src: "/images/240.png",
      alt: "회상 장면 속 또 다른 아구몬",
      className: "landing-memory-scene__sprite--agumon-side",
    },
  ],
};

export const landingCtaContent = {
  eyebrow: "START ADVENTURE",
  title: "지금, 다시 모험을 시작하세요",
  description:
    "로그인해 당신의 디지몬을 깨우거나, 먼저 둘러보며 이 세계의 결을 천천히 확인해 보세요.",
  publicLinks: [
    { to: "/notebook", label: "노트북 둘러보기" },
    { to: "/support", label: "저장 방식 확인" },
  ],
};
