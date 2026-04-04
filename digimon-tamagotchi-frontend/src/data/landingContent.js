export const landingHeroContent = {
  eyebrow: "DIGIMON MEMORY EXHIBITION",
  title: ["그 시절,", "우리는 모두", "선택받은", "아이들이었다"],
  description:
    "어린 시절의 모험과 파트너 디지몬. 다시 시작되는 작은 모험이, 이제 당신의 손 안에서 천천히 깨어납니다.",
  backgroundArtworkSrc: "/images/landing/hero-memory-window.png",
  backgroundArtworkAlt: "선택받은 아이들이 창밖으로 손을 흔드는 히어로 장면",
  backgroundArtworkPosition: "center top",
  backgroundArtworkSize: "cover",
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
  ],
  caption: "",
  bridgeNote: "",
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
  nextTitle: "다음 진화 디지몬",
  nextName: "아구몬",
  nextImageSrc: "/images/240.png",
  nextImageAlt: "다음 진화를 예고하는 아구몬",
  statusBars: [
    { label: "배고픔", value: 82, tone: "blue" },
    { label: "힘", value: 91, tone: "green" },
    { label: "훈련", value: 76, tone: "blue" },
  ],
  actions: ["FEED", "CALL", "TRAIN"],
};

export const landingMemorySceneContent = {
  eyebrow: "",
  title: "",
  description: "",
  overlayQuote: "1999년 그 여름, 디지털월드",
  backgroundArtworkSrc: null,
  backgroundArtworkPosition: "center",
  backgroundArtworkSize: "cover",
  featuredArtworkSrc: null,
  featuredArtworkAlt: "회상 장면을 채우는 대표 비주얼",
  featuredArtworkCaption: "MEMORY CUT / YOUR ARTWORK",
  featuredArtworkPosition: "center",
  featuredArtworkItems: [
    {
      id: "memory-cut-01",
      src: "/images/landing/memory-cut-01.png",
      alt: "대표 장면 첫 번째 컷",
      caption: "대표컷 01 / 여름의 시작",
      position: "center",
    },
    {
      id: "memory-cut-02",
      src: "/images/landing/memory-cut-02.jpg",
      alt: "대표 장면 두 번째 컷",
      caption: "대표컷 02 / 함께한 모험",
      position: "center",
    },
    {
      id: "memory-cut-03",
      src: "/images/landing/memory-cut-03.png",
      alt: "대표 장면 세 번째 컷",
      caption: "대표컷 03 / 다시 떠오르는 기억",
      position: "center",
    },
  ],
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
  description: "",
  featuredImageSrc: "/images/landing/cta-device.webp",
  featuredImageAlt: "손 위에 올려진 디지바이스 회상 장면",
  publicLinks: [
    { to: "/notebook", label: "노트북 둘러보기" },
    { to: "/support", label: "저장 방식 확인" },
  ],
};
