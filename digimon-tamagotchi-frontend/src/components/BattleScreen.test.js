import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { simulateBattle } from "../logic/battle/calculator";
import BattleScreen, {
  buildArenaSessionBattleResult,
  buildBattleAreaClassName,
  buildArenaEnemyBattleData,
  buildDigimonImpactClassName,
  getDigimonDataByVersionFallback,
  resolveHitImpactTarget,
  resolveEnemyProjectileSprite,
  shouldCompleteArenaBattleBeforeAction,
  shouldKeepArenaBattleScreenOpenAfterComplete,
} from "./BattleScreen";

test("서버 확정 아레나 session을 replay 전용 화면 결과로 변환한다", () => {
  const result = buildArenaSessionBattleResult({
    battleId: "battle-1",
    attacker: { digimonName: "그레이몬", combatPowerAtCapture: 10 },
    defenderGhost: { ghostId: "ghost-1", snapshot: { digimonName: "엔젤몬", combatPowerAtCapture: 8, sprite: 3 } },
    powerBreakdown: { attackerBase: 10, attackerActiveGhostBonus: 2, attackerEffective: 12, defenderBase: 8, defenderGhostDefenseBonus: 1, defenderEffective: 9 },
    result: { attackerWon: true },
    replay: [{ round: 1, actor: "attacker", hit: true, attackerHits: 1, defenderHits: 0 }],
    archive: { archiveId: "battle-1", status: "pending" },
  });

  expect(result.win).toBe(true);
  expect(result.logs[0]).toEqual(expect.objectContaining({ attacker: "user", hit: true }));
  expect(result.userPower).toBe(12);
  expect(result.enemyPower).toBe(9);
  expect(result.userPowerDetails.activeGhostBonus).toBe(2);
  expect(result.enemyPowerDetails.ghostDefenseBonus).toBe(1);
});

jest.mock("../logic/battle/calculator", () => ({
  ...jest.requireActual("../logic/battle/calculator"),
  simulateBattle: jest.fn(),
}));

describe("BattleScreen arena helper", () => {
  test("버전별 데이터 맵을 먼저 조회하고 같은 ID의 ver1 fallback보다 우선한다", () => {
    const getDigimonDataMap = jest.fn((version) => {
      if (version === "Ver.2") {
        return {
          Gabumon: {
            id: "Gabumon",
            name: "파피몬",
            sprite: 256,
            spriteBasePath: "/Ver2_Mod_Kor",
            stats: {
              basePower: 30,
              type: "Data",
              attackSprite: 4,
            },
          },
        };
      }

      return {};
    });

    const result = getDigimonDataByVersionFallback("Gabumon", "Ver.2", {
      getDigimonDataMap,
      fallbackV1Map: {
        Gabumon: {
          id: "Gabumon",
          name: "잘못된 fallback",
          stats: { basePower: 999 },
        },
      },
      fallbackV2Map: {},
    });

    expect(getDigimonDataMap).toHaveBeenCalledWith("Ver.2");
    expect(result).toMatchObject({
      id: "Gabumon",
      name: "파피몬",
      spriteBasePath: "/Ver2_Mod_Kor",
      stats: {
        basePower: 30,
        type: "Data",
        attackSprite: 4,
      },
    });
  });

  test("아레나 snapshot의 power/type을 우선하고 종족 기본값은 해당 버전 데이터에서 읽는다", () => {
    const arenaChallenger = {
      tamerName: "테이머",
      digimonSnapshot: {
        digimonId: "Pomumon",
        digimonName: "포무몬",
        slotVersion: "Ver.3",
        sprite: 405,
        spriteBasePath: "/Ver3_Mod_codex",
        attackSprite: 466,
        stats: {
          power: 88,
          type: "Virus",
        },
      },
    };

    const result = buildArenaEnemyBattleData(arenaChallenger, {
      getDigimonDataMap: (version) =>
        version === "Ver.3"
          ? {
              Pomumon: {
                id: "Pomumon",
                name: "포무몬",
                sprite: 390,
                spriteBasePath: "/Ver3_Mod_codex",
                stats: {
                  basePower: 55,
                  type: "Data",
                  attackSprite: 421,
                },
              },
            }
          : {},
      fallbackV1Map: {},
      fallbackV2Map: {},
    });

    expect(result.enemyDigimonData).toMatchObject({
      id: "Pomumon",
      spriteBasePath: "/Ver3_Mod_codex",
      stats: {
        basePower: 55,
        type: "Data",
        attackSprite: 421,
      },
    });
    expect(result.enemyStats).toEqual({
      power: 88,
      type: "Virus",
    });
    expect(result.calculatedEnemyPower).toBe(88);
  });

  test("아레나 원본 데이터를 찾지 못하면 snapshot 기반 fallback enemy data를 만든다", () => {
    const result = buildArenaEnemyBattleData(
      {
        digimonSnapshot: {
          digimonId: "UnknownV3",
          digimonName: "미확인체",
          slotVersion: "Ver.3",
          sprite: 451,
          spriteBasePath: "/Ver3_Mod_codex",
          attackSprite: 466,
          stats: {
            type: "Free",
          },
        },
      },
      {
        getDigimonDataMap: () => ({}),
        fallbackV1Map: {},
        fallbackV2Map: {},
      }
    );

    expect(result.enemyDigimonData).toMatchObject({
      id: "UnknownV3",
      name: "미확인체",
      sprite: 451,
      spriteBasePath: "/Ver3_Mod_codex",
      stats: {
        type: "Free",
        attackSprite: 466,
      },
    });
    expect(result.calculatedEnemyPower).toBe(0);
  });

  test("적 발사체는 arena snapshot attackSprite를 가장 먼저 사용한다", () => {
    const result = resolveEnemyProjectileSprite({
      arenaSnapshot: {
        attackSprite: 466,
      },
      enemyData: {
        attackSprite: 320,
        digimonId: "Agumon",
      },
      enemyDigimonData: {
        sprite: 210,
        stats: {
          attackSprite: 315,
        },
      },
      fallbackV1Map: {
        Agumon: {
          sprite: 120,
          stats: {
            attackSprite: 111,
          },
        },
      },
    });

    expect(result).toBe(466);
  });

  test("snapshot 발사체가 없으면 enemyData, enemyDigimonData, fallback 순으로 내려간다", () => {
    expect(
      resolveEnemyProjectileSprite({
        arenaSnapshot: null,
        enemyData: {
          attackSprite: 320,
          digimonId: "Agumon",
        },
        enemyDigimonData: {
          sprite: 210,
          stats: {
            attackSprite: 315,
          },
        },
        fallbackV1Map: {
          Agumon: {
            sprite: 120,
            stats: {
              attackSprite: 111,
            },
          },
        },
      })
    ).toBe(320);

    expect(
      resolveEnemyProjectileSprite({
        arenaSnapshot: null,
        enemyData: {
          digimonId: "Agumon",
        },
        enemyDigimonData: {
          sprite: 210,
          stats: {
            attackSprite: 315,
          },
        },
        fallbackV1Map: {
          Agumon: {
            sprite: 120,
            stats: {
              attackSprite: 111,
            },
          },
        },
      })
    ).toBe(315);

    expect(
      resolveEnemyProjectileSprite({
        arenaSnapshot: null,
        enemyData: {
          digimonId: "Agumon",
        },
        enemyDigimonData: {
          stats: {},
        },
        fallbackV1Map: {
          Agumon: {
            sprite: 120,
            stats: {
              attackSprite: 111,
            },
          },
        },
      })
    ).toBe(111);
  });

  test("명중 로그만 피격 효과 대상에 매핑한다", () => {
    expect(resolveHitImpactTarget({ attacker: "user", hit: true })).toBe("enemy");
    expect(resolveHitImpactTarget({ attacker: "enemy", hit: true })).toBe("user");
    expect(resolveHitImpactTarget({ attacker: "user", hit: false })).toBeNull();
  });

  test("피격 클래스는 기존 배틀 영역과 대상 디지몬 클래스에 추가만 한다", () => {
    expect(buildBattleAreaClassName("battle-area flex", "user")).toBe(
      "battle-area flex hit-impact-screen hit-impact-user"
    );
    expect(buildBattleAreaClassName("battle-area flex", null)).toBe("battle-area flex");

    expect(buildDigimonImpactClassName("digimon-sprite player-digimon", "user", "user")).toBe(
      "digimon-sprite player-digimon hit-impact hit-impact-user"
    );
    expect(buildDigimonImpactClassName("digimon-sprite enemy-digimon", "user", "enemy")).toBe(
      "digimon-sprite enemy-digimon"
    );
  });

  test("아레나 결과만 저장 전 액션 전에 확정 저장 대상으로 판단한다", () => {
    expect(
      shouldCompleteArenaBattleBeforeAction({
        battleType: "arena",
        battleResult: { win: true },
        hasCompleted: false,
      })
    ).toBe(true);
    expect(
      shouldCompleteArenaBattleBeforeAction({
        battleType: "arena",
        battleResult: { win: true },
        hasCompleted: true,
      })
    ).toBe(false);
    expect(
      shouldCompleteArenaBattleBeforeAction({
        battleType: "quest",
        battleResult: { win: true },
        hasCompleted: false,
      })
    ).toBe(false);
  });

  test("아레나 저장 후 전투 화면 유지 옵션을 판단한다", () => {
    expect(shouldKeepArenaBattleScreenOpenAfterComplete({ keepBattleScreenOpen: true })).toBe(true);
    expect(shouldKeepArenaBattleScreenOpenAfterComplete()).toBe(false);
  });
});

function buildArenaBattleResult(message = "공격 성공") {
  return {
    won: true,
    log: [{ attacker: "user", hit: true, message }],
    rounds: 1,
    userHits: 1,
    enemyHits: 0,
    userPower: 50,
    userPowerDetails: {
      basePower: 50,
      strengthBonus: 0,
      traitedEggBonus: 0,
      effortBonus: 0,
    },
  };
}

function renderArenaBattleScreen(onBattleComplete = jest.fn(() => Promise.resolve({ id: "saved" }))) {
  simulateBattle.mockReturnValueOnce(buildArenaBattleResult("첫 전투"));

  render(
    <BattleScreen
      userDigimon={{
        id: "Angemon",
        name: "엔젤몬",
        sprite: 0,
        stats: {
          basePower: 50,
          type: "Vaccine",
          attackSprite: 1,
        },
      }}
      userStats={{ power: 50, type: "Vaccine" }}
      userSlotName="슬롯4"
      userDigimonNickname="탱탱볼"
      battleType="arena"
      arenaChallenger={{
        id: "enemy-entry-1",
        tamerName: "Young Jae Jun",
        digimonSnapshot: {
          digimonId: "Koromon",
          digimonName: "코로몬",
          slotVersion: "Ver.1",
          sprite: 0,
          stats: {
            power: 0,
            type: "Free",
          },
        },
      }}
      onBattleComplete={onBattleComplete}
      onClose={jest.fn()}
    />
  );

  return { onBattleComplete };
}

async function finishSingleLogBattle() {
  fireEvent.click(await screen.findByRole("button", { name: "Start" }));

  await act(async () => {
    jest.advanceTimersByTime(2600);
  });

  await waitFor(() => expect(screen.getByText("WIN!")).toBeInTheDocument());
}

describe("BattleScreen arena result modal", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Math, "random").mockReturnValue(0);
    simulateBattle.mockReset();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    Math.random.mockRestore();
  });

  test("아레나 결과 팝업은 작은 Review Log와 주요 액션 두 개를 표시한다", async () => {
    renderArenaBattleScreen();

    await finishSingleLogBattle();

    expect(screen.getByRole("button", { name: "Review Log" })).toHaveClass(
      "arena-result-review-button"
    );
    expect(screen.getByRole("button", { name: "재전투" })).toHaveClass(
      "arena-result-action-button--rematch"
    );
    expect(screen.getByRole("button", { name: "Return to Arena" })).toHaveClass(
      "arena-result-action-button--return"
    );
  });

  test("재전투는 아레나 결과를 저장하되 전투 화면을 유지하고 같은 상대 새 배틀을 만든다", async () => {
    const onBattleComplete = jest.fn(() => Promise.resolve({ id: "saved" }));
    renderArenaBattleScreen(onBattleComplete);

    await finishSingleLogBattle();

    simulateBattle.mockReturnValueOnce(buildArenaBattleResult("재전투"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "재전투" }));
    });

    await waitFor(() =>
      expect(onBattleComplete).toHaveBeenCalledWith(
        expect.objectContaining({ win: true }),
        { keepBattleScreenOpen: true }
      )
    );
    await waitFor(() => expect(simulateBattle).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("button", { name: "Start" })).toBeInTheDocument();
  });
});
