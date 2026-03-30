export const notebookFileIslandVariant = {
  id: "notebook_file_island_v1",
  metaBarText: "HANSOL'S NOTEBOOK V2.1 // FILE_ISLAND_SYNC",
  defaultWindowId: "file-island",
  icons: [
    {
      id: "file-island",
      label: "파일 섬",
      icon: "folder-yellow",
      eyebrow: "LOGIN / PLAY",
      description: "로그인과 플레이 허브, 최근 디지몬 진입을 담당하는 메인 아이콘",
    },
    {
      id: "folder-island",
      label: "폴더 섬",
      icon: "folder-blue",
      eyebrow: "GUIDE / ARCHIVE",
      description: "가이드, 저장 방식, 기록 정리를 담당하는 정보 아이콘",
    },
    {
      id: "memories",
      label: "추억",
      icon: "star-orange",
      eyebrow: "MEMORY / NOTE",
      description: "기억 메모와 감성 문장을 담는 아카이브 아이콘",
    },
  ],
  windows: {
    fileIsland: {
      subtitle: "디지몬 키우기의 첫 진입점",
    },
    folderIsland: {
      subtitle: "가이드와 기록을 정리한 폴더 묶음",
    },
    memories: {
      subtitle: "조용히 남겨 둔 기억의 메모",
    },
  },
  memoryNotes: [
    {
      id: "first-note",
      title: "파일 섬의 첫 메모",
      body: "로그인하면 한솔의 노트북 안에 저장된 디지몬 기록과 최근 플레이를 다시 열어볼 수 있습니다.",
    },
    {
      id: "station-note",
      title: "마지막 열차에서 안녕",
      body: "열차가 떠난 플랫폼에 남은 건 작은 디지바이스의 빛과, 다시 만나자는 짧은 인사뿐이었습니다.",
    },
    {
      id: "shell-note",
      title: "다음 버전 티저",
      body: "몰입형 플레이에서는 디지바이스 셸을 고르고, 액정 안에 디지몬이 살아 있는 장면까지 확장할 예정입니다.",
    },
  ],
  immersiveTeaser: {
    label: "다음 확장",
    title: "디지바이스 셸 선택",
    body: "이번 버전은 홈 랜딩만 바꾸고, 액정형 몰입 UI는 `/play/:slotId/full`에서 따로 확장합니다.",
  },
};

export default notebookFileIslandVariant;
