import { buildGameAnimationViewModel } from "./gameAnimationViewModel";
import { digimonDataVer5, V5_SPRITE_BASE } from "../../data/v5";

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
    evolutionStage: "idle",
    ...overrides,
  };
}

describe("buildGameAnimationViewModel", () => {
  test("디지타마 기본 상태에서는 기존 알 idle 프레임을 유지한다", () => {
    const result = buildGameAnimationViewModel(
      createParams({
        selectedDigimon: "Digitama",
        digimonStats: {
          sprite: 133,
          isDead: false,
          isInjured: false,
        },
        digimonDataForSlot: {
          Digitama: {
            sprite: 133,
            spriteBasePath: "/images",
          },
        },
      })
    );

    expect(result.idleFrames).toEqual(["133", "134"]);
  });

  test("디지타마가 shaking 단계면 기존 알 프레임을 유지한다", () => {
    const result = buildGameAnimationViewModel(
      createParams({
        selectedDigimon: "Digitama",
        digimonStats: {
          sprite: 133,
          isDead: false,
          isInjured: false,
        },
        digimonDataForSlot: {
          Digitama: {
            sprite: 133,
            spriteBasePath: "/images",
          },
        },
        evolutionStage: "shaking",
      })
    );

    expect(result.idleFrames).toEqual(["133", "134"]);
  });

  test("디지타마가 flashing 단계면 모든 프레임을 135로 고정한다", () => {
    const result = buildGameAnimationViewModel(
      createParams({
        selectedDigimon: "Digitama",
        digimonStats: {
          sprite: 133,
          isDead: false,
          isInjured: false,
        },
        digimonDataForSlot: {
          Digitama: {
            sprite: 133,
            spriteBasePath: "/images",
          },
        },
        evolutionStage: "flashing",
      })
    );

    expect(result.idleFrames).toEqual(["135"]);
    expect(result.eatFramesArr).toEqual(["135"]);
    expect(result.rejectFramesArr).toEqual(["135"]);
  });

  test("Ver.5 디지타마는 전용 idle과 부화 프레임을 사용한다", () => {
    const baseParams = createParams({
      selectedDigimon: "DigitamaV5",
      digimonStats: {
        sprite: 133,
        isDead: false,
        isInjured: false,
      },
      digimonDataForSlot: digimonDataVer5,
    });

    const idle = buildGameAnimationViewModel(baseParams);
    const flashing = buildGameAnimationViewModel({
      ...baseParams,
      evolutionStage: "flashing",
    });

    expect(idle.digimonImageBase).toBe(V5_SPRITE_BASE);
    expect(idle.idleFrames).toEqual(["133", "134"]);
    expect(flashing.idleFrames).toEqual(["135"]);
    expect(flashing.eatFramesArr).toEqual(["135"]);
    expect(flashing.rejectFramesArr).toEqual(["135"]);
  });

  test.each([
    ["Ohakadamon1V5", "159"],
    ["Ohakadamon2V5", "160"],
  ])("Ver.5 사망 폼 %s는 %s 고정 프레임을 사용한다", (selectedDigimon, frame) => {
    const result = buildGameAnimationViewModel(
      createParams({
        selectedDigimon,
        digimonStats: {
          sprite: Number(frame),
          isDead: true,
          isInjured: false,
        },
        digimonDataForSlot: digimonDataVer5,
      })
    );

    expect(result.digimonImageBase).toBe(V5_SPRITE_BASE);
    expect(result.idleFrames).toEqual([frame]);
    expect(result.eatFramesArr).toEqual([frame]);
    expect(result.rejectFramesArr).toEqual([frame]);
  });

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

  test("사망 상태는 pain2 고정 프레임만 반환하고 idle 모션을 비운다", () => {
    const result = buildGameAnimationViewModel(
      createParams({
        digimonStats: {
          sprite: 100,
          isDead: true,
          isInjured: false,
        },
      })
    );

    expect(result.idleFrames).toEqual(["114"]);
    expect(result.idleMotionTimeline).toEqual([]);
    expect(result.desiredAnimation).toBe("pain2");
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

  test("낮잠 상태도 sleep 애니메이션과 수면 프레임을 사용한다", () => {
    const result = buildGameAnimationViewModel(
      createParams({
        sleepStatus: "NAPPING",
      })
    );

    expect(result.idleFrames).toEqual(["111", "112"]);
    expect(result.eatFramesArr).toEqual(["111", "112"]);
    expect(result.rejectFramesArr).toEqual(["111", "112"]);
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

  test("일반 디지몬은 evolutionStage가 있어도 기존 프레임 계산을 유지한다", () => {
    const result = buildGameAnimationViewModel(
      createParams({
        evolutionStage: "flashing",
      })
    );

    expect(result.idleFrames).toEqual(["100", "101", "107"]);
    expect(result.eatFramesArr).toEqual(["100", "109", "108"]);
    expect(result.rejectFramesArr).toEqual(["110", "110"]);
  });

  test.each(["shaking", "revealing", "revealed"])(
    "일반 디지몬도 진화 %s 단계에서는 idle 이동 타임라인을 사용하지 않는다",
    (evolutionStage) => {
      const result = buildGameAnimationViewModel(
        createParams({
          evolutionStage,
        })
      );

      expect(result.idleMotionTimeline).toEqual([]);
    }
  );

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
