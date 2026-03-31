const { buildCommunityPreviewFromSlot } = require("./communitySnapshotUtils");

describe("communitySnapshotUtils", () => {
  it("슬롯 데이터를 커뮤니티 미리보기 형태로 변환한다", () => {
    expect(
      buildCommunityPreviewFromSlot({
        id: 3,
        slotName: "슬롯3",
        digimonDisplayName: "코로몬",
        version: "Ver.2",
        device: "Digital Monster Color 25th",
        digimonStats: {
          evolutionStage: "Child",
          weight: 19,
          careMistakes: 2,
          totalBattles: 8,
          totalBattlesWon: 6,
        },
      })
    ).toEqual({
      slotId: "3",
      slotName: "슬롯3",
      digimonDisplayName: "코로몬",
      stageLabel: "성장기",
      version: "Ver.2",
      device: "Digital Monster Color 25th",
      weight: 19,
      careMistakes: 2,
      totalBattles: 8,
      totalBattlesWon: 6,
      winRate: 75,
    });
  });
});
