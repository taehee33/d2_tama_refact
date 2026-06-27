import { buildPlayHubProjectedSlot } from "./playHubSlotProjection";

describe("buildPlayHubProjectedSlot", () => {
  test("원본 digimonStats를 변경하지 않고 projectedDigimonStats를 추가한다", () => {
    const stats = {
      isDead: false,
      fullness: 0,
      lastHungerZeroAt: 1,
      sprite: 226,
    };
    const slot = {
      id: 2,
      selectedDigimon: "Punimon",
      version: "Ver.2",
      lastSavedAt: 1,
      digimonStats: stats,
    };

    const projectedSlot = buildPlayHubProjectedSlot(slot);

    expect(projectedSlot).not.toBe(slot);
    expect(projectedSlot.digimonStats).toBe(stats);
    expect(projectedSlot.digimonStats.isDead).toBe(false);
    expect(projectedSlot.projectedDigimonStats).not.toBe(stats);
    expect(projectedSlot.projectedDigimonStats.isDead).toBe(true);
  });

  test("오래된 deathReason만 남은 생존 슬롯은 사망으로 투영하지 않는다", () => {
    const projectedSlot = buildPlayHubProjectedSlot({
      id: 3,
      selectedDigimon: "OmegamonAlterSV2",
      version: "Ver.2",
      lastSavedAt: Date.now(),
      digimonStats: {
        isDead: false,
        deathReason: "STARVATION (굶주림)",
        fullness: 5,
        strength: 5,
        poopCount: 0,
        sprite: 211,
      },
    });

    expect(projectedSlot.projectedDigimonStats.isDead).toBe(false);
  });
});
