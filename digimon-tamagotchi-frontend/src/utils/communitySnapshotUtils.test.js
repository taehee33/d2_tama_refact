const {
  buildCommunityPreviewFromSlot,
  buildCommunitySnapshotVisual,
} = require("./communitySnapshotUtils");

describe("communitySnapshotUtils", () => {
  it("슬롯 데이터를 커뮤니티 미리보기와 시각 장면으로 변환한다", () => {
    const preview = buildCommunityPreviewFromSlot({
      id: 3,
      slotName: "슬롯3",
      digimonDisplayName: "코로몬",
      selectedDigimon: "Koromon",
      version: "Ver.2",
      device: "Digital Monster Color 25th",
      backgroundSettings: {
        selectedId: "forest",
        mode: "fixed",
        timeOfDay: "night",
      },
      digimonStats: {
        evolutionStage: "Child",
        weight: 19,
        careMistakes: 2,
        totalBattles: 8,
        totalBattlesWon: 6,
        poopCount: 6,
        isLightsOn: false,
        sleepStatus: "SLEEPING_LIGHT_ON",
        isInjured: true,
      },
    });

    expect(preview).toEqual(
      expect.objectContaining({
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
      })
    );

    expect(preview.visual).toEqual(
      expect.objectContaining({
        spriteBasePath: expect.any(String),
        spriteNumber: expect.any(Number),
        backgroundNumber: expect.any(Number),
        isLightsOn: false,
        sleepStatus: "SLEEPING_LIGHT_ON",
        poopCount: 6,
        isInjured: true,
      })
    );
  });

  it("저장된 스냅샷에서도 동일한 시각 장면을 복원한다", () => {
    expect(
      buildCommunitySnapshotVisual({
        digimonDisplayName: "가브몬",
        stageLabel: "성숙기",
        version: "Ver.1",
        slotName: "슬롯4",
        visual: {
          spriteBasePath: "/images",
          spriteNumber: 45,
          backgroundNumber: 168,
          isLightsOn: false,
          sleepStatus: "SLEEPING",
          poopCount: 1,
          isFrozen: false,
          isDead: false,
          isInjured: false,
        },
      })
    ).toEqual(
      expect.objectContaining({
        digimonDisplayName: "가브몬",
        stageLabel: "성숙기",
        version: "Ver.1",
        backgroundNumber: 168,
        isLightsOn: false,
        sleepStatus: "SLEEPING",
        poopCount: 1,
        spriteSrc: "/images/45.png",
      })
    );
  });
});
