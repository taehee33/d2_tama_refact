// src/data/v3/digimons.js
// Digital Monster Color Ver.3 데이터
// 주의:
// - 진화 구조/파워/주요 분기 조건은 로컬 `v3 정리` 이미지 자료를 바탕으로 정리했습니다.
// - sprite 값은 public/Ver3_Mod_codex 자산과 정합성을 확인한 번호입니다.

export const V3_SPRITE_BASE = "/Ver3_Mod_codex";

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
  Chaosmon: 481,
  Millenniumon: 496,
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

function buildAndromonChimairamonEvolutions() {
  return [
    {
      targetId: "Andromon",
      targetName: "안드로몬",
      conditions: {
        trainings: { max: 31 },
        battles: { min: 15 },
        winRatio: { min: 80 },
      },
    },
    {
      targetId: "Chimairamon",
      targetName: "키메라몬",
      conditions: {
        trainings: { min: 32 },
        battles: { min: 15 },
        winRatio: { min: 80 },
      },
    },
  ];
}

function buildGiromonEvolution() {
  return [
    {
      targetId: "Giromon",
      targetName: "기로몬",
      conditions: {
        battles: { min: 15 },
        winRatio: { min: 80 },
      },
    },
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
        conditions: { careMistakes: { max: 3 } },
      },
      {
        targetId: "Kunemon",
        targetName: "쿠네몬",
        conditions: { careMistakes: { min: 4 } },
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
      sleepTime: "21:00",
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
          careMistakes: { max: 3 },
          trainings: { min: 32 },
        },
      },
      {
        targetId: "Centaurmon",
        targetName: "켄타루몬",
        conditions: {
          careMistakes: { min: 4 },
          trainings: { min: 5, max: 23 },
          overfeeds: { min: 2 },
          sleepDisturbances: { max: 2 },
        },
      },
      {
        targetId: "Ogremon",
        targetName: "오거몬",
        conditions: {
          careMistakes: { max: 3 },
          trainings: { max: 31 },
        },
      },
      {
        targetId: "Bakemon",
        targetName: "바케몬",
        conditions: {
          careMistakes: { min: 4 },
          trainings: { min: 24 },
          overfeeds: { min: 2 },
          sleepDisturbances: { max: 4 },
        },
      },
      {
        targetId: "Scumon",
        targetName: "스카몬",
        conditionGroups: [
          {
            careMistakes: { min: 4 },
            trainings: { max: 4 },
          },
          {
            careMistakes: { min: 4 },
            overfeeds: { max: 1 },
          },
          {
            careMistakes: { min: 4 },
            sleepDisturbances: { min: 5 },
          },
          {
            careMistakes: { min: 4 },
            trainings: { min: 5, max: 23 },
            sleepDisturbances: { min: 3, max: 4 },
          },
        ],
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
      sleepTime: "22:00",
      attackSprite: 5,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 86400,
    },
    evolutions: [
      {
        targetId: "Shellmon",
        targetName: "쉘몬",
        conditionGroups: [
          {
            careMistakes: { max: 3 },
            trainings: { max: 7 },
          },
          {
            careMistakes: { max: 3 },
            trainings: { min: 24, max: 31 },
          },
          {
            careMistakes: { max: 3 },
            trainings: { min: 8, max: 23 },
            overfeeds: { min: 4 },
          },
          {
            careMistakes: { max: 3 },
            trainings: { min: 8, max: 23 },
            sleepDisturbances: { max: 2 },
          },
        ],
      },
      {
        targetId: "Drimogemon",
        targetName: "드리모게몬",
        conditions: {
          careMistakes: { min: 4 },
          trainings: { min: 24 },
          overfeeds: { min: 4 },
          sleepDisturbances: { max: 2 },
        },
      },
      {
        targetId: "Ogremon",
        targetName: "오거몬",
        conditions: {
          careMistakes: { max: 3 },
          trainings: { min: 32 },
        },
      },
      {
        targetId: "Bakemon",
        targetName: "바케몬",
        conditions: {
          careMistakes: { max: 3 },
          trainings: { min: 8, max: 23 },
          overfeeds: { max: 3 },
          sleepDisturbances: { min: 3 },
        },
      },
      {
        targetId: "Scumon",
        targetName: "스카몬",
        conditionGroups: [
          {
            careMistakes: { min: 4 },
            trainings: { max: 23 },
          },
          {
            careMistakes: { min: 4 },
            overfeeds: { max: 3 },
          },
          {
            careMistakes: { min: 4 },
            sleepDisturbances: { min: 3 },
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
      sleepTime: "22:00",
      attackSprite: 4,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: buildAndromonChimairamonEvolutions(),
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
      minWeight: 28,
      healDoses: 2,
      type: "Data",
      sleepTime: "23:00",
      attackSprite: 4,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: buildGiromonEvolution(),
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
      minWeight: 20,
      healDoses: 1,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 51,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: buildAndromonChimairamonEvolutions(),
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
      sleepTime: "22:00",
      attackSprite: 17,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: buildGiromonEvolution(),
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
      minWeight: 30,
      healDoses: 2,
      type: "Data",
      sleepTime: "22:00",
      attackSprite: 15,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: buildAndromonChimairamonEvolutions(),
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
      sleepTime: "21:00",
      attackSprite: 6,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: buildGiromonEvolution(),
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
      sleepTime: "22:00",
      attackSprite: 16,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: [
      {
        targetId: "Etemon",
        targetName: "에테몬",
        conditions: {
          trainings: { max: 39 },
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
      {
        targetId: "Chimairamon",
        targetName: "키메라몬",
        conditions: {
          trainings: { min: 40 },
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
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
      minWeight: 20,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "22:00",
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
          careMistakes: { max: 1 },
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
      minWeight: 5,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "21:00",
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
          careMistakes: { max: 1 },
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
      minWeight: 20,
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
          careMistakes: { max: 1 },
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
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 100,
      maxEnergy: 40,
      minWeight: 20,
      healDoses: 2,
      type: "Data",
      sleepTime: "23:00",
      attackSprite: 31,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
    },
    evolutions: [
      {
        targetId: "BanchoLeomon",
        targetName: "반쵸레오몬",
        conditions: {
          careMistakes: { max: 1 },
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
      {
        targetId: "Millenniumon",
        targetName: "밀레니엄몬",
        jogress: {
          partner: "Mugendramon",
          partnerName: "무겐드라몬",
          partnerVersion: "Ver.5",
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
      minWeight: 30,
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
      minWeight: 30,
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
      minWeight: 25,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "23:00",
      attackSprite: 116,
    }),
    evolutionCriteria: null,
    evolutions: [
      {
        targetId: "Chaosmon",
        targetName: "카오스몬",
        jogress: {
          partner: "Darkdramon",
          partnerName: "다크드라몬",
          partnerVersion: "Ver.4",
        },
      },
    ],
  }),

  Chaosmon: buildEntry({
    id: "Chaosmon",
    name: "카오스몬",
    stage: "Super Ultimate",
    sprite: PROVISIONAL_V3_SPRITES.Chaosmon,
    stats: buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 200,
      maxEnergy: 50,
      minWeight: 32,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "23:00",
      attackSprite: 49,
    }),
  }),

  Millenniumon: buildEntry({
    id: "Millenniumon",
    name: "밀레니엄몬",
    stage: "Super Ultimate",
    sprite: PROVISIONAL_V3_SPRITES.Millenniumon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 200,
      maxEnergy: 50,
      minWeight: 40,
      healDoses: 1,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 52,
    }),
  }),
};
