// src/data/v5/digimons.js
// Digital Monster Color Ver.5 데이터
// 주의:
// - 진화 조건은 Humulos / Wikimon / 원작 차트 기준으로 정리했습니다.
// - 스프라이트는 공식 Individual Sprites를 우선 사용하고, 누락 자산은 placeholder로 유지합니다.

export const V5_SPRITE_BASE = "/Ver5_Mod_TH";

const V5_SPRITES = {
  Placeholder: 0,
  DigitamaV5: 133,
  Ohakadamon1V5: 159,
  Ohakadamon2V5: 160,
  Zurumon: 210,
  Pagumon: 225,
  Gazimon: 240,
  Gizamon: 255,
  DarkTyranomon: 270,
  Cyclomon: 285,
  Devidramon: 300,
  Tuskmon: 315,
  Flymon: 330,
  Deltamon: 345,
  Raremon: 360,
  MetalTyranomon: 375,
  Nanomon: 390,
  ExTyranomon: 405,
  Mugendramon: 420,
  Raidenmon: 435,
  Gaioumon: 450,
  Millenniumon: 465,
  Chaosdramon: 480,
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
    spriteBasePath: V5_SPRITE_BASE,
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

function buildNeutralStats() {
  return buildStats({
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
  });
}

export const digimonDataVer5 = {
  Ohakadamon1V5: buildEntry({
    id: "Ohakadamon1V5",
    name: "사망(일반 Ver.5)",
    stage: "Ohakadamon",
    sprite: V5_SPRITES.Ohakadamon1V5,
    stats: buildNeutralStats(),
  }),

  Ohakadamon2V5: buildEntry({
    id: "Ohakadamon2V5",
    name: "사망(perfect Ver.5)",
    stage: "Ohakadamon",
    sprite: V5_SPRITES.Ohakadamon2V5,
    stats: buildNeutralStats(),
  }),

  DigitamaV5: buildEntry({
    id: "DigitamaV5",
    name: "디지타마 Ver.5",
    stage: "Digitama",
    sprite: V5_SPRITES.DigitamaV5,
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
    evolutions: [{ targetId: "Zurumon", targetName: "주루몬" }],
  }),

  Zurumon: buildEntry({
    id: "Zurumon",
    name: "주루몬",
    stage: "Baby I",
    sprite: V5_SPRITES.Zurumon,
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
    evolutions: [{ targetId: "Pagumon", targetName: "파구몬" }],
  }),

  Pagumon: buildEntry({
    id: "Pagumon",
    name: "파구몬",
    stage: "Baby II",
    sprite: V5_SPRITES.Pagumon,
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
        targetId: "Gazimon",
        targetName: "가즈몬",
        conditions: { careMistakes: { max: 4 } },
      },
      {
        targetId: "Gizamon",
        targetName: "기자몬",
        conditions: { careMistakes: { min: 5 } },
      },
    ],
  }),

  Gazimon: buildEntry({
    id: "Gazimon",
    name: "가즈몬",
    stage: "Child",
    sprite: V5_SPRITES.Gazimon,
    stats: buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 4,
      basePower: 30,
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
        targetId: "DarkTyranomon",
        targetName: "다크티라노몬",
        conditions: {
          careMistakes: { max: 3 },
          trainings: { max: 31 },
        },
      },
      {
        targetId: "Cyclomon",
        targetName: "사이클론몬",
        conditions: {
          careMistakes: { max: 3 },
          trainings: { min: 32 },
        },
      },
      {
        targetId: "Devidramon",
        targetName: "데비드라몬",
        conditions: {
          careMistakes: { min: 4 },
          trainings: { max: 31 },
        },
      },
      {
        targetId: "Tuskmon",
        targetName: "터스크몬",
        conditions: {
          careMistakes: { min: 4 },
          trainings: { min: 32 },
        },
      },
    ],
  }),

  Gizamon: buildEntry({
    id: "Gizamon",
    name: "기자몬",
    stage: "Child",
    sprite: V5_SPRITES.Gizamon,
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
        targetId: "Devidramon",
        targetName: "데비드라몬",
        conditions: {
          trainings: { min: 5, max: 23 },
          overfeeds: { min: 2 },
          sleepDisturbances: { max: 2 },
        },
      },
      {
        targetId: "Tuskmon",
        targetName: "터스크몬",
        conditions: {
          trainings: { min: 24 },
          overfeeds: { min: 2 },
          sleepDisturbances: { max: 4 },
        },
      },
      {
        targetId: "Flymon",
        targetName: "플라이몬",
        conditions: {
          trainings: { max: 23 },
          overfeeds: { max: 3 },
          sleepDisturbances: { min: 3 },
        },
      },
      {
        targetId: "Deltamon",
        targetName: "델타몬",
        conditions: {
          trainings: { min: 24 },
          overfeeds: { min: 4 },
          sleepDisturbances: { max: 2 },
        },
      },
      {
        targetId: "Raremon",
        targetName: "레어몬",
      },
    ],
  }),

  DarkTyranomon: buildEntry({
    id: "DarkTyranomon",
    name: "다크티라노몬",
    stage: "Adult",
    sprite: V5_SPRITES.DarkTyranomon,
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
    evolutions: [
      {
        targetId: "MetalTyranomon",
        targetName: "메탈티라노몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Cyclomon: buildEntry({
    id: "Cyclomon",
    name: "사이클론몬",
    stage: "Adult",
    sprite: V5_SPRITES.Cyclomon,
    stats: buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 45,
      maxEnergy: 30,
      minWeight: 20,
      healDoses: 2,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 17,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: [
      {
        targetId: "MetalTyranomon",
        targetName: "메탈티라노몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Devidramon: buildEntry({
    id: "Devidramon",
    name: "데비드라몬",
    stage: "Adult",
    sprite: V5_SPRITES.Devidramon,
    stats: buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 50,
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
    evolutions: [
      {
        targetId: "Nanomon",
        targetName: "나노몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Tuskmon: buildEntry({
    id: "Tuskmon",
    name: "터스크몬",
    stage: "Adult",
    sprite: V5_SPRITES.Tuskmon,
    stats: buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 45,
      maxEnergy: 30,
      minWeight: 30,
      healDoses: 2,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 6,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: [
      {
        targetId: "Nanomon",
        targetName: "나노몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Flymon: buildEntry({
    id: "Flymon",
    name: "플라이몬",
    stage: "Adult",
    sprite: V5_SPRITES.Flymon,
    stats: buildStats({
      hungerCycle: 38,
      strengthCycle: 38,
      maxOverfeed: 2,
      basePower: 50,
      maxEnergy: 30,
      minWeight: 20,
      healDoses: 2,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 15,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: [
      {
        targetId: "ExTyranomon",
        targetName: "엑스티라노몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Deltamon: buildEntry({
    id: "Deltamon",
    name: "델타몬",
    stage: "Adult",
    sprite: V5_SPRITES.Deltamon,
    stats: buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 45,
      maxEnergy: 30,
      minWeight: 20,
      healDoses: 2,
      type: "Virus",
      sleepTime: "22:00",
      attackSprite: 8,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: [
      {
        targetId: "ExTyranomon",
        targetName: "엑스티라노몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Raremon: buildEntry({
    id: "Raremon",
    name: "레어몬",
    stage: "Adult",
    sprite: V5_SPRITES.Raremon,
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
    evolutions: [
      {
        targetId: "ExTyranomon",
        targetName: "엑스티라노몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  MetalTyranomon: buildEntry({
    id: "MetalTyranomon",
    name: "메탈티라노몬",
    stage: "Perfect",
    sprite: V5_SPRITES.MetalTyranomon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 100,
      maxEnergy: 40,
      minWeight: 40,
      healDoses: 1,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 23,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
    },
    evolutions: [
      {
        targetId: "Mugendramon",
        targetName: "무겐드라몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Nanomon: buildEntry({
    id: "Nanomon",
    name: "나노몬",
    stage: "Perfect",
    sprite: V5_SPRITES.Nanomon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 85,
      maxEnergy: 40,
      minWeight: 20,
      healDoses: 1,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 31,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
    },
    evolutions: [
      {
        targetId: "Raidenmon",
        targetName: "라이덴몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  ExTyranomon: buildEntry({
    id: "ExTyranomon",
    name: "엑스티라노몬",
    stage: "Perfect",
    sprite: V5_SPRITES.ExTyranomon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 100,
      maxEnergy: 40,
      minWeight: 40,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "23:00",
      attackSprite: 49,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
    },
    evolutions: [
      {
        targetId: "Gaioumon",
        targetName: "가이오우몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Mugendramon: buildEntry({
    id: "Mugendramon",
    name: "무겐드라몬",
    stage: "Ultimate",
    sprite: V5_SPRITES.Mugendramon,
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
    evolutions: [
      {
        targetId: "Millenniumon",
        targetName: "밀레니엄몬",
        jogress: {
          partner: "Chimairamon",
          partnerName: "키메라몬",
          partnerVersion: "Ver.3",
        },
      },
      {
        targetId: "Chaosdramon",
        targetName: "카오스드라몬",
        jogress: {
          partner: "Darkdramon",
          partnerName: "다크드라몬",
          partnerVersion: "Ver.4",
        },
      },
    ],
  }),

  Raidenmon: buildEntry({
    id: "Raidenmon",
    name: "라이덴몬",
    stage: "Ultimate",
    sprite: V5_SPRITES.Raidenmon,
    stats: buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 150,
      maxEnergy: 50,
      minWeight: 40,
      healDoses: 2,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 52,
    }),
  }),

  Gaioumon: buildEntry({
    id: "Gaioumon",
    name: "가이오우몬",
    stage: "Ultimate",
    sprite: V5_SPRITES.Gaioumon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 180,
      maxEnergy: 50,
      minWeight: 50,
      healDoses: 1,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 116,
    }),
  }),

  Millenniumon: buildEntry({
    id: "Millenniumon",
    name: "밀레니엄몬",
    stage: "Super Ultimate",
    sprite: V5_SPRITES.Millenniumon,
    stats: buildStats({
      hungerCycle: 66,
      strengthCycle: 66,
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

  Chaosdramon: buildEntry({
    id: "Chaosdramon",
    name: "카오스드라몬",
    stage: "Super Ultimate",
    sprite: V5_SPRITES.Chaosdramon,
    stats: buildStats({
      hungerCycle: 66,
      strengthCycle: 66,
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
