import { buildGameAnimationViewModel } from "./gameAnimationViewModel";

function createParams(overrides = {}) {
  return {
    selectedDigimon: "Agumon",
    digimonStats: {
      sprite: 100,
      isDead: false,
      isInjured: false,
    },
    digimonDataForSlot: {
      Agumon: {
        sprite: 100,
        spriteBasePath: "/images",
      },
    },
    currentAnimation: "idle",
    sleepStatus: "AWAKE",
    ...overrides,
  };
}

describe("buildGameAnimationViewModel", () => {
  test("부상 상태면 sick 애니메이션과 부상 프레임을 우선한다", () => {
    const result = buildGameAnimationViewModel(
      createParams({
        digimonStats: {
          sprite: 100,
          isDead: false,
          isInjured: true,
        },
      })
    );

    expect(result.idleFrames).toEqual(["113", "114"]);
    expect(result.eatFramesArr).toEqual(["113", "114"]);
    expect(result.rejectFramesArr).toEqual(["113", "114"]);
    expect(result.desiredAnimation).toBe("sick");
  });

  test("수면 상태면 sleep 애니메이션과 수면 프레임을 사용한다", () => {
    const result = buildGameAnimationViewModel(
      createParams({
        sleepStatus: "SLEEPING",
      })
    );

    expect(result.idleFrames).toEqual(["111", "112"]);
    expect(result.desiredAnimation).toBe("sleep");
  });

  test("정상 상태로 돌아오면 상태 전용 애니메이션만 idle로 되돌린다", () => {
    const result = buildGameAnimationViewModel(
      createParams({
        currentAnimation: "sick",
      })
    );

    expect(result.desiredAnimation).toBe("idle");
  });

  test("오하카다몬은 고정 프레임과 idle 애니메이션만 사용한다", () => {
    const result = buildGameAnimationViewModel(
      createParams({
        selectedDigimon: "Ohakadamon1",
        digimonStats: {
          sprite: 410,
          isDead: false,
          isInjured: false,
        },
        digimonDataForSlot: {
          Ohakadamon1: {
            sprite: 410,
            spriteBasePath: "/images",
          },
        },
        currentAnimation: "pain2",
      })
    );

    expect(result.idleFrames).toEqual(["410"]);
    expect(result.eatFramesArr).toEqual(["410"]);
    expect(result.rejectFramesArr).toEqual(["410"]);
    expect(result.desiredAnimation).toBe("idle");
  });
});
