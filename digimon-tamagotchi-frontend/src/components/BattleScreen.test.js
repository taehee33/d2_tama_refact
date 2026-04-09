import {
  buildArenaEnemyBattleData,
  getDigimonDataByVersionFallback,
  resolveEnemyProjectileSprite,
} from "./BattleScreen";

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
        spriteBasePath: "/Ver3_Mod_TH",
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
                spriteBasePath: "/Ver3_Mod_TH",
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
      spriteBasePath: "/Ver3_Mod_TH",
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
          spriteBasePath: "/Ver3_Mod_TH",
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
      spriteBasePath: "/Ver3_Mod_TH",
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
});
