// src/data/v4/digimons.js
// Digital Monster Color Ver.4 데이터
// 주의:
// - 진화 조건은 Humulos / Wikimon / 원작 차트 기준으로 정리했습니다.
// - 스프라이트는 공식 Individual Sprites를 우선 사용하고, 누락 자산은 placeholder로 유지합니다.

export const V4_SPRITE_BASE = "/Ver4_Mod_TH";

const V4_SPRITES = {
  Placeholder: 0,
  DigitamaV4: 133,
  Ohakadamon1V4: 159,
  Ohakadamon2V4: 160,
  Yuramon: 210,
  Tanemon: 225,
  Piyomon: 240,
  Palmon: 255,
  Monochromon: 270,
  Kokatorimon: 285,
  Leomon: 300,
  Kuwagamon: 315,
  Coelamon: 330,
  Mojyamon: 345,
  Nanimon: 360,
  Ultimatedramon: 375,
  Piccolomon: 390,
  Digitamamon: 405,
  Darkdramon: 420,
  BloomLordmon: 435,
  Gankoomon: 450,
  Chaosmon: 465,
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
    spriteBasePath: V4_SPRITE_BASE,
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

export const digimonDataVer4 = {
  Ohakadamon1V4: buildEntry({
    id: "Ohakadamon1V4",
    name: "사망(일반 Ver.4)",
    stage: "Ohakadamon",
    sprite: V4_SPRITES.Ohakadamon1V4,
    stats: buildNeutralStats(),
  }),

  Ohakadamon2V4: buildEntry({
    id: "Ohakadamon2V4",
    name: "사망(perfect Ver.4)",
    stage: "Ohakadamon",
    sprite: V4_SPRITES.Ohakadamon2V4,
    stats: buildNeutralStats(),
  }),

  DigitamaV4: buildEntry({
    id: "DigitamaV4",
    name: "디지타마 Ver.4",
    stage: "Digitama",
    sprite: V4_SPRITES.DigitamaV4,
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
    evolutions: [{ targetId: "Yuramon", targetName: "유라몬" }],
  }),

  Yuramon: buildEntry({
    id: "Yuramon",
    name: "유라몬",
    stage: "Baby I",
    sprite: V4_SPRITES.Yuramon,
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
    evolutions: [{ targetId: "Tanemon", targetName: "타네몬" }],
  }),

  Tanemon: buildEntry({
    id: "Tanemon",
    name: "타네몬",
    stage: "Baby II",
    sprite: V4_SPRITES.Tanemon,
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
        targetId: "Piyomon",
        targetName: "피요몬",
        conditions: { careMistakes: { max: 4 } },
      },
      {
        targetId: "Palmon",
        targetName: "팔몬",
        conditions: { careMistakes: { min: 5 } },
      },
    ],
  }),

  Piyomon: buildEntry({
    id: "Piyomon",
    name: "피요몬",
    stage: "Child",
    sprite: V4_SPRITES.Piyomon,
    stats: buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 4,
      basePower: 30,
      maxEnergy: 20,
      minWeight: 20,
      healDoses: 2,
      type: "Vaccine",
      sleepTime: "20:00",
      attackSprite: 4,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 86400,
    },
    evolutions: [
      {
        targetId: "Monochromon",
        targetName: "모노크로몬",
        conditions: {
          careMistakes: { max: 3 },
          trainings: { max: 31 },
        },
      },
      {
        targetId: "Kokatorimon",
        targetName: "코카트리몬",
        conditions: {
          careMistakes: { max: 3 },
          trainings: { min: 32 },
        },
      },
      {
        targetId: "Leomon",
        targetName: "레오몬",
        conditions: {
          careMistakes: { min: 4 },
          trainings: { max: 31 },
        },
      },
      {
        targetId: "Kuwagamon",
        targetName: "쿠와가몬",
        conditions: {
          careMistakes: { min: 4 },
          trainings: { min: 32 },
        },
      },
    ],
  }),

  Palmon: buildEntry({
    id: "Palmon",
    name: "팔몬",
    stage: "Child",
    sprite: V4_SPRITES.Palmon,
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
        targetId: "Leomon",
        targetName: "레오몬",
        conditions: {
          trainings: { min: 5, max: 23 },
          overfeeds: { min: 2 },
          sleepDisturbances: { max: 2 },
        },
      },
      {
        targetId: "Kuwagamon",
        targetName: "쿠와가몬",
        conditions: {
          trainings: { min: 24 },
          overfeeds: { min: 2 },
          sleepDisturbances: { max: 4 },
        },
      },
      {
        targetId: "Coelamon",
        targetName: "코엘라몬",
        conditions: {
          trainings: { max: 23 },
          overfeeds: { max: 3 },
          sleepDisturbances: { min: 3 },
        },
      },
      {
        targetId: "Mojyamon",
        targetName: "모쟈몬",
        conditions: {
          trainings: { min: 24 },
          overfeeds: { min: 4 },
          sleepDisturbances: { max: 2 },
        },
      },
      {
        targetId: "Nanimon",
        targetName: "나니몬",
      },
    ],
  }),

  Monochromon: buildEntry({
    id: "Monochromon",
    name: "모노크로몬",
    stage: "Adult",
    sprite: V4_SPRITES.Monochromon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 50,
      maxEnergy: 30,
      minWeight: 30,
      healDoses: 1,
      type: "Data",
      sleepTime: "21:00",
      attackSprite: 15,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: [
      {
        targetId: "Ultimatedramon",
        targetName: "얼티메이트드라몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Kokatorimon: buildEntry({
    id: "Kokatorimon",
    name: "코카트리몬",
    stage: "Adult",
    sprite: V4_SPRITES.Kokatorimon,
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
      attackSprite: 17,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: [
      {
        targetId: "Ultimatedramon",
        targetName: "얼티메이트드라몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Leomon: buildEntry({
    id: "Leomon",
    name: "레오몬",
    stage: "Adult",
    sprite: V4_SPRITES.Leomon,
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
    evolutions: [
      {
        targetId: "Piccolomon",
        targetName: "피콜로몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Kuwagamon: buildEntry({
    id: "Kuwagamon",
    name: "쿠와가몬",
    stage: "Adult",
    sprite: V4_SPRITES.Kuwagamon,
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
      attackSprite: 6,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: [
      {
        targetId: "Piccolomon",
        targetName: "피콜로몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Coelamon: buildEntry({
    id: "Coelamon",
    name: "코엘라몬",
    stage: "Adult",
    sprite: V4_SPRITES.Coelamon,
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
    evolutions: [
      {
        targetId: "Digitamamon",
        targetName: "디지타마몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Mojyamon: buildEntry({
    id: "Mojyamon",
    name: "모쟈몬",
    stage: "Adult",
    sprite: V4_SPRITES.Mojyamon,
    stats: buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 45,
      maxEnergy: 30,
      minWeight: 30,
      healDoses: 2,
      type: "Data",
      sleepTime: "22:00",
      attackSprite: 8,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: [
      {
        targetId: "Digitamamon",
        targetName: "디지타마몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Nanimon: buildEntry({
    id: "Nanimon",
    name: "나니몬",
    stage: "Adult",
    sprite: V4_SPRITES.Nanimon,
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
        targetId: "Digitamamon",
        targetName: "디지타마몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Ultimatedramon: buildEntry({
    id: "Ultimatedramon",
    name: "얼티메이트드라몬",
    stage: "Perfect",
    sprite: V4_SPRITES.Ultimatedramon,
    stats: buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 80,
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
        targetId: "Darkdramon",
        targetName: "다크드라몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Piccolomon: buildEntry({
    id: "Piccolomon",
    name: "피콜로몬",
    stage: "Perfect",
    sprite: V4_SPRITES.Piccolomon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 75,
      maxEnergy: 40,
      minWeight: 30,
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
        targetId: "Gankoomon",
        targetName: "강쿠몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Digitamamon: buildEntry({
    id: "Digitamamon",
    name: "디지타마몬",
    stage: "Perfect",
    sprite: V4_SPRITES.Digitamamon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 85,
      maxEnergy: 40,
      minWeight: 20,
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
        targetId: "BloomLordmon",
        targetName: "블룸로드몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Darkdramon: buildEntry({
    id: "Darkdramon",
    name: "다크드라몬",
    stage: "Ultimate",
    sprite: V4_SPRITES.Darkdramon,
    stats: buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 120,
      maxEnergy: 50,
      minWeight: 40,
      healDoses: 2,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 52,
    }),
    evolutions: [
      {
        targetId: "Chaosmon",
        targetName: "카오스몬",
        jogress: {
          partner: "BanchoLeomon",
          partnerName: "반쵸레오몬",
          partnerVersion: "Ver.3",
        },
      },
      {
        targetId: "Chaosdramon",
        targetName: "카오스드라몬",
        jogress: {
          partner: "Mugendramon",
          partnerName: "무겐드라몬",
          partnerVersion: "Ver.5",
        },
      },
    ],
  }),

  BloomLordmon: buildEntry({
    id: "BloomLordmon",
    name: "블룸로드몬",
    stage: "Ultimate",
    sprite: V4_SPRITES.BloomLordmon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 130,
      maxEnergy: 50,
      minWeight: 40,
      healDoses: 1,
      type: "Data",
      sleepTime: "23:00",
      attackSprite: 49,
    }),
  }),

  Gankoomon: buildEntry({
    id: "Gankoomon",
    name: "강쿠몬",
    stage: "Ultimate",
    sprite: V4_SPRITES.Gankoomon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 140,
      maxEnergy: 50,
      minWeight: 50,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "23:00",
      attackSprite: 116,
    }),
  }),

  Chaosmon: buildEntry({
    id: "Chaosmon",
    name: "카오스몬",
    stage: "Super Ultimate",
    sprite: V4_SPRITES.Chaosmon,
    stats: buildStats({
      hungerCycle: 66,
      strengthCycle: 66,
      maxOverfeed: 2,
      basePower: 200,
      maxEnergy: 50,
      minWeight: 40,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "23:00",
      attackSprite: 49,
    }),
  }),

  Chaosdramon: buildEntry({
    id: "Chaosdramon",
    name: "카오스드라몬",
    stage: "Super Ultimate",
    sprite: V4_SPRITES.Chaosdramon,
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
