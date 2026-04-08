// src/data/v3/digimons.js
// Digital Monster Color Ver.3 골격 데이터
// 주의:
// - 진화 구조/파워/주요 분기 조건은 Ver.3 계열 자료를 바탕으로 정리했습니다.
// - sprite 값은 로컬 자산 정합 작업 전까지 임시 번호입니다.
// - 이후 Ver.3 전용 스프라이트가 정리되면 PROVISIONAL_V3_SPRITES만 교체하면 됩니다.

export const V3_SPRITE_BASE = "/Ver3_Mod_TH";

const PROVISIONAL_V3_SPRITES = {
  Ohakadamon1V3: 159,
  Ohakadamon2V3: 160,
  DigitamaV3: 133,
  Poyomon: 210,
  Tokomon: 225,
  Patamon: 240,
  Kunemon: 255,
  Unimon: 270,
  Centaurmon: 285,
  Ogremon: 300,
  Bakemon: 315,
  Shellmon: 345,
  Drimogemon: 330,
  Scumon: 360,
  Andromon: 375,
  Giromon: 390,
  Etemon: 405,
  Chimairamon: 421,
  HiAndromon: 436,
  Gokumon: 451,
  BanchoLeomon: 466,
};

function buildEntry({
  id,
  name,
  stage,
  sprite,
  stats,
  evolutionCriteria = null,
  evolutions = [],
}) {
  return {
    id,
    name,
    stage,
    sprite,
    spriteBasePath: V3_SPRITE_BASE,
    stats,
    evolutionCriteria,
    evolutions,
  };
}

function buildStats({
  hungerCycle,
  strengthCycle,
  poopCycle = 120,
  maxOverfeed,
  basePower,
  maxEnergy,
  minWeight,
  healDoses,
  type,
  sleepTime,
  attackSprite,
}) {
  return {
    hungerCycle,
    strengthCycle,
    poopCycle,
    maxOverfeed,
    basePower,
    maxEnergy,
    minWeight,
    healDoses,
    type,
    sleepTime,
    attackSprite,
  };
}

const ADULT_FALLBACK_EVOLUTION = {
  targetId: "Chimairamon",
  targetName: "키메라몬",
};

function buildAdultEvolutions() {
  return [
    {
      targetId: "Giromon",
      targetName: "기로몬",
      conditions: {
        careMistakes: { min: 1, max: 4 },
        battles: { min: 15 },
        winRatio: { min: 80 },
      },
    },
    {
      targetId: "Andromon",
      targetName: "안드로몬",
      conditions: {
        careMistakes: { max: 0 },
        trainings: { min: 15 },
        battles: { min: 15 },
        winRatio: { min: 80 },
      },
    },
    {
      targetId: "Etemon",
      targetName: "에테몬",
      conditions: {
        careMistakes: { max: 0 },
        trainings: { max: 14 },
        battles: { min: 15 },
        winRatio: { min: 80 },
      },
    },
    ADULT_FALLBACK_EVOLUTION,
  ];
}

export const digimonDataVer3 = {
  Ohakadamon1V3: buildEntry({
    id: "Ohakadamon1V3",
    name: "사망(일반 Ver.3)",
    stage: "Ohakadamon",
    sprite: PROVISIONAL_V3_SPRITES.Ohakadamon1V3,
    stats: buildStats({
      hungerCycle: 0,
      strengthCycle: 0,
      poopCycle: 0,
      maxOverfeed: 0,
      basePower: 0,
      maxEnergy: 0,
      minWeight: 0,
      healDoses: 0,
      type: null,
      sleepTime: null,
      attackSprite: null,
    }),
  }),

  Ohakadamon2V3: buildEntry({
    id: "Ohakadamon2V3",
    name: "사망(perfect Ver.3)",
    stage: "Ohakadamon",
    sprite: PROVISIONAL_V3_SPRITES.Ohakadamon2V3,
    stats: buildStats({
      hungerCycle: 0,
      strengthCycle: 0,
      poopCycle: 0,
      maxOverfeed: 0,
      basePower: 0,
      maxEnergy: 0,
      minWeight: 0,
      healDoses: 0,
      type: null,
      sleepTime: null,
      attackSprite: null,
    }),
  }),

  DigitamaV3: buildEntry({
    id: "DigitamaV3",
    name: "디지타마 Ver.3",
    stage: "Digitama",
    sprite: PROVISIONAL_V3_SPRITES.DigitamaV3,
    stats: buildStats({
      hungerCycle: 0,
      strengthCycle: 0,
      poopCycle: 999,
      maxOverfeed: 0,
      basePower: 0,
      maxEnergy: 0,
      minWeight: 0,
      healDoses: 0,
      type: null,
      sleepTime: null,
      attackSprite: null,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 8,
    },
    evolutions: [{ targetId: "Poyomon", targetName: "포요몬" }],
  }),

  Poyomon: buildEntry({
    id: "Poyomon",
    name: "포요몬",
    stage: "Baby I",
    sprite: PROVISIONAL_V3_SPRITES.Poyomon,
    stats: buildStats({
      hungerCycle: 3,
      strengthCycle: 3,
      poopCycle: 3,
      maxOverfeed: 3,
      basePower: 0,
      maxEnergy: 5,
      minWeight: 5,
      healDoses: 0,
      type: "Free",
      sleepTime: null,
      attackSprite: 1,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 600,
    },
    evolutions: [{ targetId: "Tokomon", targetName: "토코몬" }],
  }),

  Tokomon: buildEntry({
    id: "Tokomon",
    name: "토코몬",
    stage: "Baby II",
    sprite: PROVISIONAL_V3_SPRITES.Tokomon,
    stats: buildStats({
      hungerCycle: 30,
      strengthCycle: 30,
      poopCycle: 60,
      maxOverfeed: 2,
      basePower: 0,
      maxEnergy: 10,
      minWeight: 10,
      healDoses: 1,
      type: "Free",
      sleepTime: "20:00",
      attackSprite: 7,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 43200,
    },
    evolutions: [
      {
        targetId: "Patamon",
        targetName: "파타몬",
        conditions: { careMistakes: { max: 2 } },
      },
      {
        targetId: "Kunemon",
        targetName: "쿠네몬",
        conditions: { careMistakes: { min: 3 } },
      },
    ],
  }),

  Patamon: buildEntry({
    id: "Patamon",
    name: "파타몬",
    stage: "Child",
    sprite: PROVISIONAL_V3_SPRITES.Patamon,
    stats: buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 4,
      basePower: 30,
      maxEnergy: 20,
      minWeight: 20,
      healDoses: 2,
      type: "Data",
      sleepTime: "20:00",
      attackSprite: 4,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 86400,
    },
    evolutions: [
      {
        targetId: "Unimon",
        targetName: "유니몬",
        conditions: {
          careMistakes: { max: 2 },
          trainings: { min: 15 },
        },
      },
      {
        targetId: "Ogremon",
        targetName: "오거몬",
        conditions: {
          careMistakes: { max: 2 },
          trainings: { max: 14 },
        },
      },
      {
        targetId: "Shellmon",
        targetName: "쉘몬",
        conditions: {
          careMistakes: { min: 3 },
        },
      },
    ],
  }),

  Kunemon: buildEntry({
    id: "Kunemon",
    name: "쿠네몬",
    stage: "Child",
    sprite: PROVISIONAL_V3_SPRITES.Kunemon,
    stats: buildStats({
      hungerCycle: 38,
      strengthCycle: 38,
      maxOverfeed: 2,
      basePower: 25,
      maxEnergy: 20,
      minWeight: 20,
      healDoses: 2,
      type: "Virus",
      sleepTime: "21:00",
      attackSprite: 5,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 86400,
    },
    evolutions: [
      {
        targetId: "Scumon",
        targetName: "스카몬",
        conditions: {
          careMistakes: { min: 3 },
          trainings: { max: 4 },
        },
      },
      {
        targetId: "Centaurmon",
        targetName: "켄타루몬",
        conditions: {
          careMistakes: { min: 3 },
          trainings: { min: 5, max: 11 },
          overfeeds: { max: 1 },
          sleepDisturbances: { max: 4 },
        },
      },
      {
        targetId: "Bakemon",
        targetName: "바케몬",
        conditionGroups: [
          {
            careMistakes: { min: 3 },
            trainings: { min: 12 },
          },
          {
            careMistakes: { min: 3 },
            trainings: { min: 5, max: 11 },
            overfeeds: { min: 2 },
          },
          {
            careMistakes: { min: 3 },
            trainings: { min: 5, max: 11 },
            sleepDisturbances: { min: 5 },
          },
        ],
      },
    ],
  }),

  Unimon: buildEntry({
    id: "Unimon",
    name: "유니몬",
    stage: "Adult",
    sprite: PROVISIONAL_V3_SPRITES.Unimon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 50,
      maxEnergy: 30,
      minWeight: 30,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "21:00",
      attackSprite: 4,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: buildAdultEvolutions(),
  }),

  Centaurmon: buildEntry({
    id: "Centaurmon",
    name: "켄타루몬",
    stage: "Adult",
    sprite: PROVISIONAL_V3_SPRITES.Centaurmon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 45,
      maxEnergy: 30,
      minWeight: 20,
      healDoses: 2,
      type: "Data",
      sleepTime: "22:00",
      attackSprite: 4,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: buildAdultEvolutions(),
  }),

  Ogremon: buildEntry({
    id: "Ogremon",
    name: "오거몬",
    stage: "Adult",
    sprite: PROVISIONAL_V3_SPRITES.Ogremon,
    stats: buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 50,
      maxEnergy: 30,
      minWeight: 40,
      healDoses: 1,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 51,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: buildAdultEvolutions(),
  }),

  Bakemon: buildEntry({
    id: "Bakemon",
    name: "바케몬",
    stage: "Adult",
    sprite: PROVISIONAL_V3_SPRITES.Bakemon,
    stats: buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 45,
      maxEnergy: 30,
      minWeight: 30,
      healDoses: 2,
      type: "Virus",
      sleepTime: "00:00",
      attackSprite: 17,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: buildAdultEvolutions(),
  }),

  Shellmon: buildEntry({
    id: "Shellmon",
    name: "쉘몬",
    stage: "Adult",
    sprite: PROVISIONAL_V3_SPRITES.Shellmon,
    stats: buildStats({
      hungerCycle: 38,
      strengthCycle: 38,
      maxOverfeed: 2,
      basePower: 50,
      maxEnergy: 30,
      minWeight: 20,
      healDoses: 2,
      type: "Data",
      sleepTime: "23:00",
      attackSprite: 15,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: buildAdultEvolutions(),
  }),

  Drimogemon: buildEntry({
    id: "Drimogemon",
    name: "드리모게몬",
    stage: "Adult",
    sprite: PROVISIONAL_V3_SPRITES.Drimogemon,
    stats: buildStats({
      hungerCycle: 38,
      strengthCycle: 38,
      maxOverfeed: 2,
      basePower: 45,
      maxEnergy: 30,
      minWeight: 20,
      healDoses: 2,
      type: "Data",
      sleepTime: "22:00",
      attackSprite: 6,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: buildAdultEvolutions(),
  }),

  Scumon: buildEntry({
    id: "Scumon",
    name: "스카몬",
    stage: "Adult",
    sprite: PROVISIONAL_V3_SPRITES.Scumon,
    stats: buildStats({
      hungerCycle: 28,
      strengthCycle: 28,
      maxOverfeed: 2,
      basePower: 40,
      maxEnergy: 30,
      minWeight: 10,
      healDoses: 3,
      type: "Virus",
      sleepTime: "00:00",
      attackSprite: 16,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: buildAdultEvolutions(),
  }),

  Andromon: buildEntry({
    id: "Andromon",
    name: "안드로몬",
    stage: "Perfect",
    sprite: PROVISIONAL_V3_SPRITES.Andromon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 100,
      maxEnergy: 40,
      minWeight: 40,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "20:00",
      attackSprite: 11,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
    },
    evolutions: [
      {
        targetId: "HiAndromon",
        targetName: "하이안드로몬",
        conditions: {
          careMistakes: { max: 2 },
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
      {
        targetId: "Gokumon",
        targetName: "고쿠몬",
        conditions: {
          careMistakes: { min: 3, max: 4 },
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Giromon: buildEntry({
    id: "Giromon",
    name: "기로몬",
    stage: "Perfect",
    sprite: PROVISIONAL_V3_SPRITES.Giromon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 85,
      maxEnergy: 40,
      minWeight: 20,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "23:00",
      attackSprite: 8,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
    },
    evolutions: [
      {
        targetId: "HiAndromon",
        targetName: "하이안드로몬",
        conditions: {
          careMistakes: { max: 2 },
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
      {
        targetId: "Gokumon",
        targetName: "고쿠몬",
        conditions: {
          careMistakes: { min: 3, max: 4 },
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Etemon: buildEntry({
    id: "Etemon",
    name: "에테몬",
    stage: "Perfect",
    sprite: PROVISIONAL_V3_SPRITES.Etemon,
    stats: buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 100,
      maxEnergy: 40,
      minWeight: 40,
      healDoses: 1,
      type: "Virus",
      sleepTime: "21:00",
      attackSprite: 23,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
    },
    evolutions: [
      {
        targetId: "BanchoLeomon",
        targetName: "반쵸레오몬",
        conditions: {
          careMistakes: { max: 2 },
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
      {
        targetId: "Gokumon",
        targetName: "고쿠몬",
        conditions: {
          careMistakes: { min: 3, max: 4 },
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Chimairamon: buildEntry({
    id: "Chimairamon",
    name: "키메라몬",
    stage: "Perfect",
    sprite: PROVISIONAL_V3_SPRITES.Chimairamon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 100,
      maxEnergy: 40,
      minWeight: 40,
      healDoses: 1,
      type: "Data",
      sleepTime: "23:00",
      attackSprite: 31,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
    },
    evolutions: [
      {
        targetId: "Gokumon",
        targetName: "고쿠몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  HiAndromon: buildEntry({
    id: "HiAndromon",
    name: "하이안드로몬",
    stage: "Ultimate",
    sprite: PROVISIONAL_V3_SPRITES.HiAndromon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 150,
      maxEnergy: 50,
      minWeight: 40,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "23:00",
      attackSprite: 49,
    }),
  }),

  Gokumon: buildEntry({
    id: "Gokumon",
    name: "고쿠몬",
    stage: "Ultimate",
    sprite: PROVISIONAL_V3_SPRITES.Gokumon,
    stats: buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 170,
      maxEnergy: 50,
      minWeight: 40,
      healDoses: 2,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 52,
    }),
  }),

  BanchoLeomon: buildEntry({
    id: "BanchoLeomon",
    name: "반쵸레오몬",
    stage: "Ultimate",
    sprite: PROVISIONAL_V3_SPRITES.BanchoLeomon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 180,
      maxEnergy: 50,
      minWeight: 50,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "23:00",
      attackSprite: 116,
    }),
  }),
};
