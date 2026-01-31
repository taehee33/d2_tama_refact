// src/data/v2modkor/digimons.js
// Digital Monster Color Ver.2 매뉴얼 기반 디지몬 데이터 스키마
// Ver.2 전체 진화 트리 데이터 (v1/digimons.js와 동일 구조). 스프라이트는 public/Ver2_Mod_Kor 경로 사용.
// 한글/영문 이름은 20주년 벽돌제품 Ver.2 차트 기준 적용 (푸니몬, 뿔몬, 파피몬, 에레키몬, 캅테리몬, 엔젤몬, 가루몬, 프리지몬, 베지몬, 버드라몬, 고래몬, 스컬그레이몬, 메탈콩알몬, 베이더몬, 스컬맘몬, 크레스가루루몬, 블리츠그레이몬, 오메가몬 Alter-S).
// 오하카다몬V2·디지타마V2는 공통으로 쓰지 않고 Ver.2 전용 ID 사용.

/** v2 스프라이트 기준 경로 (public/Ver2_Mod_Kor → 서빙 경로 /Ver2_Mod_Kor) */
export const V2_SPRITE_BASE = '/Ver2_Mod_Kor';

/**
 * Ver.2 디지몬 데이터 스키마 (v1과 동일 + spriteBasePath)
 * @typedef {Object} DigimonData
 * @property {string} id - 디지몬 고유 ID
 * @property {string} name - 디지몬 이름
 * @property {string} stage - 진화 단계 (Digitama, Baby I, Baby II, Child, Adult, Perfect, Ultimate, Super Ultimate)
 * @property {number} sprite - 스프라이트 번호
 * @property {string} [spriteBasePath] - 스프라이트 이미지 기준 경로 (v2는 /Ver2_Mod_Kor)
 * @property {Object} stats - 스탯 정보
 * @property {number} stats.hungerCycle - 배고픔 감소 주기 (분)
 * @property {number} stats.strengthCycle - 힘 감소 주기 (분)
 * @property {number} stats.poopCycle - 똥 생성 주기 (분)
 * @property {number} stats.maxOverfeed - 최대 오버피드 허용치
 * @property {number} stats.basePower - 기본 파워
 * @property {number} stats.maxEnergy - 최대 에너지 (DP)
 * @property {number} stats.minWeight - 최소 체중
 * @property {number} stats.healDoses - 치료 필요 횟수
 * @property {string} stats.type - 속성 ("Vaccine", "Data", "Virus", "Free" 또는 null)
 * @property {string} stats.sleepTime - 수면 시간 (HH:MM 형식)
 * @property {number} stats.attackSprite - 공격 스프라이트 번호 (null이면 기본 sprite 사용)
 * @property {Object} evolutionCriteria - 진화 조건
 * @property {Array} evolutions - 진화 경로 배열
 */

export const digimonDataVer2 = {
  // 사망 형태 (Ver.2 전용 ID — 이름은 직접 수정)
  Ohakadamon1V2: {
    id: "Ohakadamon1V2",
    name: "사망(일반 Ver.2)",
    stage: "Ohakadamon",
    sprite: 159,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 0,
      strengthCycle: 0,
      poopCycle: 0,
      maxOverfeed: 0,
      basePower: 0,
      maxEnergy: 0,
      minWeight: 0,
      type: null,
      sleepTime: null,
      attackSprite: null,
    },
    evolutionCriteria: null,
    evolutions: [],
  },
  Ohakadamon2V2: {
    id: "Ohakadamon2V2",
    name: "사망(perfect Ver.2)",
    stage: "Ohakadamon",
    sprite: 160,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 0,
      strengthCycle: 0,
      poopCycle: 0,
      maxOverfeed: 0,
      basePower: 0,
      maxEnergy: 0,
      minWeight: 0,
      type: null,
      sleepTime: null,
      attackSprite: null,
    },
    evolutionCriteria: null,
    evolutions: [],
  },

  // Digitama (Ver.2 전용 ID — 이름은 직접 수정)
  DigitamaV2: {
    id: "DigitamaV2",
    name: "디지타마 Ver.2",
    stage: "Digitama",
    sprite: 133,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 0,
      strengthCycle: 0,
      poopCycle: 999,
      maxOverfeed: 0,
      basePower: 0,
      maxEnergy: 0,
      minWeight: 0,
      type: null,
      sleepTime: null,
      attackSprite: null,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 8,
    },
    evolutions: [
      { targetId: "Punimon", targetName: "푸니몬" },
    ],
  },

  // Baby I (In-Training I)
  Punimon: {
    id: "Punimon",
    name: "푸니몬",
    stage: "Baby I",
    sprite: 226,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
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
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 600,
    },
    evolutions: [
      { targetId: "Tsunomon", targetName: "뿔몬" },
    ],
  },

  // Baby II (In-Training II) — 뿔몬
  Tsunomon: {
    id: "Tsunomon",
    name: "뿔몬",
    stage: "Baby II",
    sprite: 241,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
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
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 43200,
    },
    evolutions: [
      {
        targetId: "Gabumon",
        targetName: "파피몬",
        conditions: { careMistakes: { max: 3 } },
      },
      {
        targetId: "Elecmon",
        targetName: "에레키몬",
        conditions: { careMistakes: { min: 4 } },
      },
    ],
  },

  // Child (Rookie) — 파피몬 (Gabumon)
  Gabumon: {
    id: "Gabumon",
    name: "파피몬",
    stage: "Child",
    sprite: 256,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 48,
      strengthCycle: 48,
      poopCycle: 120,
      maxOverfeed: 4,
      basePower: 30,
      maxEnergy: 20,
      minWeight: 20,
      healDoses: 2,
      type: "Vaccine",
      sleepTime: "20:00",
      attackSprite: 4,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 86400,
    },
    evolutions: [
      {
        targetId: "Kabuterimon",
        targetName: "캅테리몬",
        conditions: { careMistakes: { max: 3 }, trainings: { min: 32 } },
      },
      {
        targetId: "Angemon",
        targetName: "엔젤몬",
        conditions: { careMistakes: { max: 3 }, trainings: { max: 31 } },
      },
      {
        targetId: "Garurumon",
        targetName: "가루몬",
        conditions: {
          careMistakes: { min: 4 },
          trainings: { min: 5, max: 15 },
          overfeeds: { min: 3 },
          sleepDisturbances: { min: 4, max: 5 },
        },
      },
      {
        targetId: "Frigimon",
        targetName: "프리지몬",
        conditions: {
          careMistakes: { min: 4 },
          trainings: { min: 16 },
          overfeeds: { min: 3 },
          sleepDisturbances: { min: 6 },
        },
      },
      {
        targetId: "Vegiemon",
        targetName: "베지몬",
        conditionGroups: [
          { careMistakes: { min: 4 }, trainings: { max: 4 } },
          { careMistakes: { min: 4 }, overfeeds: { max: 2 } },
          { careMistakes: { min: 4 }, trainings: { min: 5, max: 15 }, overfeeds: { min: 3 }, sleepDisturbances: { max: 3 } },
          { careMistakes: { min: 4 }, trainings: { min: 5, max: 15 }, overfeeds: { min: 3 }, sleepDisturbances: { min: 6 } },
          { careMistakes: { min: 4 }, trainings: { min: 16 }, overfeeds: { min: 3 }, sleepDisturbances: { max: 5 } },
        ],
      },
    ],
  },

  // Child (Rookie) — 에레키몬 (Elecmon)
  Elecmon: {
    id: "Elecmon",
    name: "에레키몬",
    stage: "Child",
    sprite: 271,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 38,
      strengthCycle: 38,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 25,
      maxEnergy: 20,
      minWeight: 20,
      healDoses: 2,
      type: "Virus",
      sleepTime: "21:00",
      attackSprite: 5,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 86400,
    },
    evolutions: [
      {
        targetId: "Angemon",
        targetName: "엔젤몬",
        conditions: { careMistakes: { max: 3 }, trainings: { min: 48 } },
      },
      {
        targetId: "Frigimon",
        targetName: "프리지몬",
        conditions: { careMistakes: { max: 3 }, trainings: { max: 47 } },
      },
      {
        targetId: "Birdramon",
        targetName: "버드라몬",
        conditions: {
          careMistakes: { min: 4 },
          trainings: { min: 8, max: 31 },
          overfeeds: { max: 3 },
          sleepDisturbances: { min: 9 },
        },
      },
      {
        targetId: "Whamon",
        targetName: "고래몬",
        conditions: {
          careMistakes: { min: 4 },
          trainings: { min: 8, max: 31 },
          overfeeds: { min: 4 },
          sleepDisturbances: { max: 8 },
        },
      },
      {
        targetId: "Vegiemon",
        targetName: "베지몬",
        conditionGroups: [
          { careMistakes: { min: 4 }, trainings: { max: 7 } },
          { careMistakes: { min: 4 }, trainings: { min: 32 } },
          { careMistakes: { min: 4 }, trainings: { min: 8, max: 31 }, overfeeds: { min: 4 }, sleepDisturbances: { min: 9 } },
          { careMistakes: { min: 4 }, trainings: { min: 8, max: 31 }, overfeeds: { max: 3 }, sleepDisturbances: { max: 8 } },
        ],
      },
    ],
  },

  // Adult (Champion) — 캅테리몬 (Kabuterimon)
  Kabuterimon: {
    id: "Kabuterimon",
    name: "캅테리몬",
    stage: "Adult",
    sprite: 286,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 59,
      strengthCycle: 59,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 50,
      maxEnergy: 30,
      minWeight: 30,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "21:00",
      attackSprite: 4,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
      battles: 15,
      winRatio: 80,
    },
    evolutions: [
      {
        targetId: "SkullGreymon",
        targetName: "스컬그레이몬",
        conditions: { battles: { min: 15 }, winRatio: { min: 80 } },
      },
    ],
  },

  // Adult (Champion) — 엔젤몬 (Angemon)
  Angemon: {
    id: "Angemon",
    name: "엔젤몬",
    stage: "Adult",
    sprite: 316,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 48,
      strengthCycle: 48,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 50,
      maxEnergy: 30,
      minWeight: 40,
      healDoses: 1,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 51,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
      battles: 15,
      winRatio: 80,
    },
    evolutions: [
      {
        targetId: "SkullGreymon",
        targetName: "스컬그레이몬",
        conditions: { battles: { min: 15 }, winRatio: { min: 80 } },
      },
    ],
  },

  // Adult (Champion) — 버드라몬 (Birdramon)
  Birdramon: {
    id: "Birdramon",
    name: "버드라몬",
    stage: "Adult",
    sprite: 346,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 38,
      strengthCycle: 38,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 50,
      maxEnergy: 30,
      minWeight: 30,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "23:00",
      attackSprite: 6,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
      battles: 15,
      winRatio: 80,
    },
    evolutions: [
      {
        targetId: "SkullGreymon",
        targetName: "스컬그레이몬",
        conditions: { battles: { min: 15 }, winRatio: { min: 80 } },
      },
    ],
  },

  // Adult (Champion) — 베지몬 (Vegiemon)
  Vegiemon: {
    id: "Vegiemon",
    name: "베지몬",
    stage: "Adult",
    sprite: 376,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 28,
      strengthCycle: 28,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 40,
      maxEnergy: 30,
      minWeight: 10,
      healDoses: 3,
      type: "Virus",
      sleepTime: "00:00",
      attackSprite: 16,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
      battles: 15,
      winRatio: 80,
    },
    evolutions: [
      {
        targetId: "MetalMammemon",
        targetName: "메탈콩알몬",
        conditions: { battles: { min: 15 }, winRatio: { min: 80 } },
      },
    ],
  },

  // Adult (Champion) — 가루몬 (Garurumon)
  Garurumon: {
    id: "Garurumon",
    name: "가루몬",
    stage: "Adult",
    sprite: 301,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 59,
      strengthCycle: 59,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 45,
      maxEnergy: 30,
      minWeight: 20,
      healDoses: 2,
      type: "Data",
      sleepTime: "22:00",
      attackSprite: 4,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
      battles: 15,
      winRatio: 80,
    },
    evolutions: [
      {
        targetId: "Vademon",
        targetName: "베이더몬",
        conditions: { battles: { min: 15 }, winRatio: { min: 80 } },
      },
    ],
  },

  // Adult (Champion) — 프리지몬 (Frigimon)
  Frigimon: {
    id: "Frigimon",
    name: "프리지몬",
    stage: "Adult",
    sprite: 331,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 48,
      strengthCycle: 48,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 45,
      maxEnergy: 30,
      minWeight: 30,
      healDoses: 2,
      type: "Data",
      sleepTime: "00:00",
      attackSprite: 17,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
      battles: 15,
      winRatio: 80,
    },
    evolutions: [
      {
        targetId: "Vademon",
        targetName: "베이더몬",
        conditions: { battles: { min: 15 }, winRatio: { min: 80 } },
      },
    ],
  },

  // Adult (Champion) — 고래몬 (Whamon)
  Whamon: {
    id: "Whamon",
    name: "고래몬",
    stage: "Adult",
    sprite: 361,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 38,
      strengthCycle: 38,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 45,
      maxEnergy: 30,
      minWeight: 20,
      healDoses: 2,
      type: "Data",
      sleepTime: "23:00",
      attackSprite: 15,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
      battles: 15,
      winRatio: 80,
    },
    evolutions: [
      {
        targetId: "SkullGreymon",
        targetName: "스컬그레이몬",
        conditions: { battles: { min: 15 }, winRatio: { min: 80 } },
      },
    ],
  },

  // Perfect (Ultimate) — 스컬그레이몬 (SkullGreymon)
  SkullGreymon: {
    id: "SkullGreymon",
    name: "스컬그레이몬",
    stage: "Perfect",
    sprite: 391,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 59,
      strengthCycle: 59,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 100,
      maxEnergy: 40,
      minWeight: 40,
      healDoses: 1,
      type: "Virus",
      sleepTime: "20:00",
      attackSprite: 11,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
      mistakes: { max: 1 },
      battles: 15,
      winRatio: 80,
    },
    evolutions: [
      {
        targetId: "BlitzGreymon",
        targetName: "블리츠그레이몬",
        conditions: {
          careMistakes: { max: 1 },
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  },

  // Perfect (Ultimate) — 메탈콩알몬 (MetalMamemon)
  MetalMammemon: {
    id: "MetalMammemon",
    name: "메탈콩알몬",
    stage: "Perfect",
    sprite: 406,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 48,
      strengthCycle: 48,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 100,
      maxEnergy: 40,
      minWeight: 40,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "21:00",
      attackSprite: 23,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
      mistakes: { max: 1 },
      battles: 15,
      winRatio: 80,
    },
    evolutions: [
      {
        targetId: "SkullMammon",
        targetName: "스컬맘몬",
        conditions: {
          careMistakes: { max: 1 },
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  },

  // Perfect (Ultimate) — 베이더몬 (Vademon)
  Vademon: {
    id: "Vademon",
    name: "베이더몬",
    stage: "Perfect",
    sprite: 421,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 59,
      strengthCycle: 59,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 85,
      maxEnergy: 40,
      minWeight: 5,
      healDoses: 1,
      type: "Data",
      sleepTime: "23:00",
      attackSprite: 8,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
      mistakes: { max: 1 },
      battles: 15,
      winRatio: 80,
    },
    evolutions: [
      {
        targetId: "CresGarurumon",
        targetName: "크레스가루루몬",
        conditions: {
          careMistakes: { max: 1 },
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  },

  // Ultimate
  Ebemon: {
    id: "Ebemon",
    name: "이바몬",
    stage: "Ultimate",
    sprite: 466,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 59,
      strengthCycle: 59,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 170,
      maxEnergy: 50,
      minWeight: 50,
      healDoses: 1,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 49,
    },
    evolutionCriteria: {
      jogress: true,
    },
    evolutions: [
      {
        targetId: "OmegamonAlterSV2",
        targetName: "오메가몬 Alter-S",
        jogress: { partner: "CresGarurumon" },
      },
    ],
  },

  // Ultimate — 스컬맘몬 (SkullMammon)
  SkullMammon: {
    id: "SkullMammon",
    name: "스컬맘몬",
    stage: "Ultimate",
    sprite: 436,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 48,
      strengthCycle: 48,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 170,
      maxEnergy: 50,
      minWeight: 40,
      healDoses: 2,
      type: "Vaccine",
      sleepTime: "23:00",
      attackSprite: 52,
    },
    evolutionCriteria: null,
    evolutions: [],
  },

  // Ultimate — 크레스가루루몬 (CresGarurumon)
  CresGarurumonV2: {
    id: "CresGarurumonV2",
    name: "크레스가루루몬 Ver.2",
    stage: "Ultimate",
    sprite: 451,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 59,
      strengthCycle: 59,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 150,
      maxEnergy: 50,
      minWeight: 5,
      type: "Data",
      sleepTime: "23:00",
      attackSprite: 116,
    },
    evolutionCriteria: null,
    evolutions: [],
  },

  // Super Ultimate
  OmegamonAlterSV2: {
    id: "OmegamonAlterSV2",
    name: "오메가몬 Alter-S(Ver.2)",
    stage: "Super Ultimate",
    sprite: 211,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 66,
      strengthCycle: 66,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 200,
      maxEnergy: 50,
      minWeight: 40,
      healDoses: 1,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 31,
    },
    evolutionCriteria: null,
    evolutions: [],
  },

  // Ultimate — Jogress 파트너 (크레스가루루몬 / CresGarurumon)
  BlitzGreymonV2: {
    id: "BlitzGreymonV2",
    name: "블리츠그레이몬 Ver.2",
    stage: "Ultimate",
    sprite: 210,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 0,
      strengthCycle: 0,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 0,
      maxEnergy: 0,
      minWeight: 0,
      healDoses: 1,
      type: null,
      sleepTime: null,
      attackSprite: null,
    },
    evolutionCriteria: null,
    evolutions: [],
  },
};
