// src/data/v1/digimons.js
// Digital Monster Color 매뉴얼 기반 디지몬 데이터 스키마
// Ver.1 전체 진화 트리 데이터 (Baby I ~ Super Ultimate)

/**
 * 디지몬 데이터 스키마
 * 
 * @typedef {Object} DigimonData
 * @property {string} id - 디지몬 고유 ID
 * @property {string} name - 디지몬 이름
 * @property {string} stage - 진화 단계 (Digitama, Baby I, Baby II, Child, Adult, Perfect, Ultimate, Super Ultimate)
 * @property {number} sprite - 스프라이트 번호
 * @property {Object} stats - 스탯 정보
 * @property {number} stats.hungerCycle - 배고픔 감소 주기 (분)
 * @property {number} stats.strengthCycle - 힘 감소 주기 (분)
 * @property {number} stats.poopCycle - 똥 생성 주기 (분, Stage별로 다름: I=3분, II=60분, III+=120분)
 * @property {number} stats.maxOverfeed - 최대 오버피드 허용치
 * @property {number} stats.basePower - 기본 파워
 * @property {number} stats.maxEnergy - 최대 에너지 (DP)
 * @property {number} stats.minWeight - 최소 체중
 * @property {number} stats.healDoses - 치료 필요 횟수 (기본값 1)
 * @property {string} stats.type - 속성 ("Vaccine", "Data", "Virus", "Free" 또는 null)
 * @property {string} stats.sleepTime - 수면 시간 (HH:MM 형식)
 * @property {number} stats.attackSprite - 공격 스프라이트 번호 (공격 시 사용, null이면 기본 sprite 사용)
 * @property {Object} evolutionCriteria - 진화 조건
 * @property {Array} evolutions - 진화 경로 배열
 */

export const digimonDataVer1 = {
  // 사망 형태
  Ohakadamon1: {
    id: "Ohakadamon1",
    name: "오하카다몬(일반)",
    stage: "Ohakadamon",
    sprite: 159,
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
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용)
    },
    evolutionCriteria: null, // 진화 불가
    evolutions: [],
  },
  Ohakadamon2: {
    id: "Ohakadamon2",
    name: "오하카다몬(perfect)",
    stage: "Ohakadamon",
    sprite: 160,
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
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용)
    },
    evolutionCriteria: null, // 진화 불가
    evolutions: [],
  },

  // Digitama (Digi-Egg)
  Digitama: {
    id: "Digitama",
    name: "디지타마",
    stage: "Digitama",
    sprite: 133,
    stats: {
      hungerCycle: 0,
      strengthCycle: 0,
      poopCycle: 999, // Stage I: 3분마다 똥
      maxOverfeed: 0,
      basePower: 0,
      maxEnergy: 0,
      minWeight: 0,
      type: null,
      sleepTime: null,
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용)
    },
    evolutionCriteria: {
      // 8초 후 자동 진화
      timeToEvolveSeconds: 8,
    },
    evolutions: [
      {
        targetId: "Botamon",
        targetName: "깜몬",
        // 시간 조건은 evolutionCriteria에서 처리되므로 conditions 없음
      },
    ],
  },

  // Baby I (In-Training I)
  Botamon: {
    id: "Botamon",
    name: "깜몬",
    stage: "Baby I",
    sprite: 210,
    stats: {
      hungerCycle: 3, // Hunger Loss: 3 Minutes
      strengthCycle: 3, // Strength Loss: 3 Minutes
      poopCycle: 3, // Stage I: 3분마다 똥
      maxOverfeed: 3,
      basePower: 0, // Power: 0
      maxEnergy: 5, // Energy: 0
      minWeight: 5, // Min Weight: 5
      healDoses: 0, // Heal Doses: 1 (치료 필요 횟수)
      type: "Free", // Free
      sleepTime: null,
      attackSprite: 1, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: null
      //attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용)
    },
    evolutionCriteria: {
      // 10분 후 진화
      timeToEvolveSeconds: 600, // 10분 = 600초
    },
    evolutions: [
      {
        targetId: "Koromon",
        targetName: "코로몬",
        // 시간 조건은 evolutionCriteria에서 처리되므로 conditions 없음
      },
    ],
  },

  // Baby II (In-Training II)
  Koromon: {
    id: "Koromon",
    name: "코로몬",
    stage: "Baby II",
    sprite: 225,
    stats: {
      hungerCycle: 30, // Hunger Loss: 30 Minutes
      strengthCycle: 30, // Strength Loss: 30 Minutes
      poopCycle: 60, // Stage II: 60분마다 똥
      maxOverfeed: 2,
      basePower: 0, // Power: 0
      maxEnergy: 10, // Energy: 0
      minWeight: 10, // Min Weight: 10
      healDoses: 1, // Heal Doses: 1 (치료 필요 횟수)
      type: "Free", // Free
      sleepTime: "20:00",
      attackSprite: 7, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 20:00
    },
    evolutionCriteria: {
      // 12시간 후 진화
      timeToEvolveSeconds: 43200, // 12시간 = 43200초
    },
    evolutions: [
      {
        targetId: "Agumon",
        targetName: "아구몬",
        conditions: {
          careMistakes: { max: 3 }, // 0-3 Care Mistakes
        },
      },
      {
        targetId: "Betamon",
        targetName: "베타몬",
        conditions: {
          careMistakes: { min: 4 }, // 4+ Care Mistakes
        },
      },
    ],
  },

  // Child (Rookie) - Agumon
  Agumon: {
    id: "Agumon",
    name: "아구몬",
    stage: "Child",
    sprite: 240,
    stats: {
      hungerCycle: 48, // Hunger Loss: 48 Minutes
      strengthCycle: 48, // Strength Loss: 48 Minutes
      poopCycle: 120, // Stage III+: 120분마다 똥
      maxOverfeed: 4,
      basePower: 30, // Power: 30
      maxEnergy: 20, // Energy: 20
      minWeight: 20, // Min Weight: 20
      healDoses: 2, // Heal Doses: 1 (치료 필요 횟수)
      type: "Vaccine", // Vaccine
      sleepTime: "20:00",
      attackSprite: 4, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 20:00
      //attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용)
    },
    evolutionCriteria: {
      // 24시간 후 진화
      timeToEvolveSeconds: 86400, // 24시간 = 86400초
    },
    evolutions: [
      // 우선순위: 까다로운 진화를 앞에 배치
      {
        targetId: "Greymon",
        targetName: "그레이몬",
        // Case 1: 단일 조건 그룹 (모든 조건 만족 시 진화 - AND Logic)
        conditions: {
          careMistakes: { max: 3 }, // 0-3 Care Mistakes
          trainings: { min: 32 },   // 32+ Training
        },
      },
      {
        targetId: "Devimon",
        targetName: "데블몬",
        conditions: {
          careMistakes: { max: 3 }, // 0-3 Care Mistakes
          trainings: { max: 31 },   // 0-31 Training
        },
      },
      {
        targetId: "Tyranomon",
        targetName: "티라노몬",
        conditions: {
          careMistakes: { min: 4 },           // 4+ Care Mistakes
          trainings: { min: 5, max: 15 },    // 5-15 Training
          overfeeds: { min: 3 },             // 3+ Overfeed
          sleepDisturbances: { min: 4, max: 5 }, // 4-5 Sleep Disturbances
        },
      },
      {
        targetId: "Meramon",
        targetName: "메라몬",
        conditions: {
          careMistakes: { min: 4 },      // 4+ Care Mistakes
          trainings: { min: 16 },        // 16+ Training
          overfeeds: { min: 3 },         // 3+ Overfeed
          sleepDisturbances: { min: 6 }, // 6+ Sleep Disturbances
        },
      },
      // Case 2: 다중 조건 그룹 (배열 내 조건 중 하나라도 만족 시 진화 - OR Logic)
      {
        targetId: "Numemon",
        targetName: "워매몬",
        conditionGroups: [
          // 루트 1: 4+ Care Mistakes, 0-4 Training
          { careMistakes: { min: 4 }, trainings: { max: 4 } },
          // 루트 2: 4+ Care Mistakes, 0-2 Overfeed
          { careMistakes: { min: 4 }, overfeeds: { max: 2 } },
          // 루트 3: 4+ Care Mistakes, 5-15 Training, 3+ Overfeed, 0-3 Sleep Disturbances
          { careMistakes: { min: 4 }, trainings: { min: 5, max: 15 }, overfeeds: { min: 3 }, sleepDisturbances: { max: 3 } },
          // 루트 4: 4+ Care Mistakes, 5-15 Training, 3+ Overfeed, 6+ Sleep Disturbances
          { careMistakes: { min: 4 }, trainings: { min: 5, max: 15 }, overfeeds: { min: 3 }, sleepDisturbances: { min: 6 } },
          // 루트 5: 4+ Care Mistakes, 16+ Training, 3+ Overfeed, 0-5 Sleep Disturbances
          { careMistakes: { min: 4 }, trainings: { min: 16 }, overfeeds: { min: 3 }, sleepDisturbances: { max: 5 } },
        ],
      },
    ],
  },

  // Child (Rookie) - Betamon
  Betamon: {
    id: "Betamon",
    name: "베타몬",
    stage: "Child",
    sprite: 255,
    stats: {
      hungerCycle: 38, // Hunger Loss: 38 Minutes
      strengthCycle: 38, // Strength Loss: 38 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 25, // Power: 25
      maxEnergy: 20, // Energy: 20
      minWeight: 20, // Min Weight: 20
      healDoses: 2, // Heal Doses: 1 (치료 필요 횟수)
      type: "Virus", // Virus
      sleepTime: "21:00",
      attackSprite: 5, // 공격 스프라이트 (null이면 기본 sprite 사용)
    },
    evolutionCriteria: {
      // 24시간 후 진화
      timeToEvolveSeconds: 86400, // 24시간 = 86400초
    },
    evolutions: [
      // 우선순위: 까다로운 진화를 앞에 배치
      {
        targetId: "Devimon",
        targetName: "데블몬",
        conditions: {
          careMistakes: { max: 3 }, // 0-3 Care Mistakes
          trainings: { min: 48 },   // 48+ Training
        },
      },
      {
        targetId: "Meramon",
        targetName: "메라몬",
        conditions: {
          careMistakes: { max: 3 }, // 0-3 Care Mistakes
          trainings: { max: 47 },    // 0-47 Training
        },
      },
      {
        targetId: "Airdramon",
        targetName: "에어드라몬",
        conditions: {
          careMistakes: { min: 4 },           // 4+ Care Mistakes
          trainings: { min: 8, max: 31 },      // 8-31 Training
          overfeeds: { max: 3 },              // 0-3 Overfeed
          sleepDisturbances: { min: 9 },      // 9+ Sleep Disturbances
        },
      },
      {
        targetId: "Seadramon",
        targetName: "시드라몬",
        conditions: {
          careMistakes: { min: 4 },           // 4+ Care Mistakes
          trainings: { min: 8, max: 31 },     // 8-31 Training
          overfeeds: { min: 4 },              // 4+ Overfeed
          sleepDisturbances: { max: 8 },      // 0-8 Sleep Disturbances
        },
      },
      // Case 2: 다중 조건 그룹 (OR Logic)
      {
        targetId: "Numemon",
        targetName: "워매몬",
        conditionGroups: [
          // 루트 1: 4+ Care Mistakes, 0-7 Training
          { careMistakes: { min: 4 }, trainings: { max: 7 } },
          // 루트 2: 4+ Care Mistakes, 32+ Training
          { careMistakes: { min: 4 }, trainings: { min: 32 } },
          // 루트 3: 4+ Care Mistakes, 8-31 Training, 4+ Overfeed, 9+ Sleep Disturbances
          { careMistakes: { min: 4 }, trainings: { min: 8, max: 31 }, overfeeds: { min: 4 }, sleepDisturbances: { min: 9 } },
          // 루트 4: 4+ Care Mistakes, 8-31 Training, 0-3 Overfeed, 0-8 Sleep Disturbances
          { careMistakes: { min: 4 }, trainings: { min: 8, max: 31 }, overfeeds: { max: 3 }, sleepDisturbances: { max: 8 } },
        ],
      },
    ],
  },

  // Adult (Champion) - Greymon
  Greymon: {
    id: "Greymon",
    name: "그레이몬",
    stage: "Adult",
    sprite: 270,
    stats: {
      hungerCycle: 59, // Hunger Loss: 59 Minutes
      strengthCycle: 59, // Strength Loss: 59 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 50, // Power: 50
      maxEnergy: 30, // Energy: 30
      minWeight: 30, // Min Weight: 30
      healDoses: 1, // Heal Doses: 1 (치료 필요 횟수)
      type: "Vaccine", // Vaccine
      sleepTime: "21:00",
      attackSprite: 4, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 21:00
    },
    evolutionCriteria: {
      // 36시간 후 진화
      timeToEvolveSeconds: 129600, // 36시간 = 129600초
      battles: 15, // Battles 15+
      winRatio: 80, // WinRatio 80%+
    },
    evolutions: [
      {
        targetId: "MetalGreymonVirus",
        targetName: "메탈그레이몬",
        conditions: {
          battles: { min: 15 },    // 15+ Battles
          winRatio: { min: 80 },   // 80%+ Win Ratio
        },
      },
    ],
  },

  // Adult (Champion) - Devimon
  Devimon: {
    id: "Devimon",
    name: "데블몬",
    stage: "Adult",
    sprite: 300, // TODO: Check actual sprite
    stats: {
      hungerCycle: 48, // Hunger Loss: 48 Minutes
      strengthCycle: 48, // Strength Loss: 48 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 50, // Power: 50
      maxEnergy: 30, // Energy: 30
      minWeight: 40, // Min Weight: 40
      healDoses: 1, // Heal Doses: 1 (치료 필요 횟수)
      type: "Virus", // Virus
      sleepTime: "23:00",
      attackSprite: 51, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
    },
    evolutionCriteria: {
      // 36시간 후 진화
      timeToEvolveSeconds: 129600, // 36시간 = 129600초
      battles: 15, // Battles 15+
      winRatio: 80, // WinRatio 80%+
    },
    evolutions: [
      {
        targetId: "MetalGreymonVirus",
        targetName: "메탈그레이몬",
        conditions: {
          battles: { min: 15 },    // 15+ Battles
          winRatio: { min: 80 },   // 80%+ Win Ratio
        },
      },
    ],
  },

  // Adult (Champion) - Airdramon
  Airdramon: {
    id: "Airdramon",
    name: "에어드라몬",
    stage: "Adult",
    sprite: 330, // TODO: Check actual sprite
    stats: {
      hungerCycle: 38, // Hunger Loss: 38 Minutes
      strengthCycle: 38, // Strength Loss: 38 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 50, // Power: 50
      maxEnergy: 30, // Energy: 30
      minWeight: 30, // Min Weight: 30
      healDoses: 1, // Heal Doses: 1 (치료 필요 횟수)
      type: "Vaccine", // Vaccine
      sleepTime: "23:00",
      attackSprite: 6, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
    },
    evolutionCriteria: {
      // 36시간 후 진화
      timeToEvolveSeconds: 129600, // 36시간 = 129600초
      battles: 15, // Battles 15+
      winRatio: 80, // WinRatio 80%+
    },
    evolutions: [
      {
        targetId: "MetalGreymonVirus",
        targetName: "메탈그레이몬",
        conditions: {
          battles: { min: 15 },    // 15+ Battles
          winRatio: { min: 80 },   // 80%+ Win Ratio
        },
      },
    ],
  },

  // Adult (Champion) - Numemon
  Numemon: {
    id: "Numemon",
    name: "워매몬",
    stage: "Adult",
    sprite: 360, // TODO: Check actual sprite
    stats: {
      hungerCycle: 28, // Hunger Loss: 28 Minutes
      strengthCycle: 28, // Strength Loss: 28 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 40, // Power: 40
      maxEnergy: 30, // Energy: 30
      minWeight: 10, // Min Weight: 10
      healDoses: 3, // Heal Doses: 1 (치료 필요 횟수)
      type: "Virus", // Virus
      sleepTime: "00:00",
      attackSprite: 16, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 00:00
    },
    evolutionCriteria: {
      // 36시간 후 진화
      timeToEvolveSeconds: 129600, // 36시간 = 129600초
      battles: 15, // Battles 15+
      winRatio: 80, // WinRatio 80%+
    },
    evolutions: [
      {
        targetId: "Monzaemon",
        targetName: "퍼펫몬",
        conditions: {
          battles: { min: 15 },    // 15+ Battles
          winRatio: { min: 80 },   // 80%+ Win Ratio
        },
      },
    ],
  },

  // Adult (Champion) - Tyranomon
  Tyranomon: {
    id: "Tyranomon",
    name: "티라노몬",
    stage: "Adult",
    sprite: 285, // 레거시 데이터와 일치 (수면 프레임: 296, 297)
    stats: {
      hungerCycle: 59, // Hunger Loss: 59 Minutes
      strengthCycle: 59, // Strength Loss: 59 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 45, // Power: 45
      maxEnergy: 30, // Energy: 30
      minWeight: 20, // Min Weight: 20
      healDoses: 2, // Heal Doses: 1 (치료 필요 횟수)
      type: "Data", // Data
      sleepTime: "22:00",
      attackSprite: 4, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 22:00
    },
    evolutionCriteria: {
      // 36시간 후 진화
      timeToEvolveSeconds: 129600, // 36시간 = 129600초
      battles: 15, // Battles 15+
      winRatio: 80, // WinRatio 80%+
    },
    evolutions: [
      {
        targetId: "Mamemon",
        targetName: "콩알몬",
        conditions: {
          battles: { min: 15 },    // 15+ Battles
          winRatio: { min: 80 },   // 80%+ Win Ratio
        },
      },
    ],
  },

  // Adult (Champion) - Meramon
  Meramon: {
    id: "Meramon",
    name: "메라몬",
    stage: "Adult",
    sprite: 315, // TODO: Check actual sprite
    stats: {
      hungerCycle: 48, // Hunger Loss: 48 Minutes
      strengthCycle: 48, // Strength Loss: 48 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 45, // Power: 45
      maxEnergy: 30, // Energy: 30
      minWeight: 30, // Min Weight: 30
      healDoses: 2, // Heal Doses: 1 (치료 필요 횟수)
      type: "Data", // Data
      sleepTime: "00:00",
      attackSprite: 17, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 00:00
    },
    evolutionCriteria: {
      // 36시간 후 진화
      timeToEvolveSeconds: 129600, // 36시간 = 129600초
      battles: 15, // Battles 15+
      winRatio: 80, // WinRatio 80%+
    },
    evolutions: [
      {
        targetId: "Mamemon",
        targetName: "콩알몬",
        conditions: {
          battles: { min: 15 },    // 15+ Battles
          winRatio: { min: 80 },   // 80%+ Win Ratio
        },
      },
    ],
  },

  // Adult (Champion) - Seadramon
  Seadramon: {
    id: "Seadramon",
    name: "시드라몬",
    stage: "Adult",
    sprite: 345,
    stats: {
      hungerCycle: 38, // Hunger Loss: 38 Minutes
      strengthCycle: 38, // Strength Loss: 38 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 45, // Power: 45
      maxEnergy: 30, // Energy: 30
      minWeight: 20, // Min Weight: 20
      healDoses: 2, // Heal Doses: 1 (치료 필요 횟수)
      type: "Data", // Data
      sleepTime: "23:00",
      attackSprite: 15, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
    },
    evolutionCriteria: {
      // 36시간 후 진화
      timeToEvolveSeconds: 129600, // 36시간 = 129600초
      battles: 15, // Battles 15+
      winRatio: 80, // WinRatio 80%+
    },
    evolutions: [
      {
        targetId: "MetalGreymonVirus",
        targetName: "메탈그레이몬",
        conditions: {
          battles: { min: 15 },    // 15+ Battles
          winRatio: { min: 80 },   // 80%+ Win Ratio
        },
      },
    ],
  },

  // Perfect (Ultimate) - Metal Greymon (Virus)
  MetalGreymonVirus: {
    id: "MetalGreymonVirus",
    name: "메탈그레이몬",
    stage: "Perfect",
    sprite: 375, // TODO: Check actual sprite
    stats: {
      hungerCycle: 59, // Hunger Loss: 59 Minutes
      strengthCycle: 59, // Strength Loss: 59 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 100, // Power: 100
      maxEnergy: 40, // Energy: 40
      minWeight: 40, // Min Weight: 40
      healDoses: 1, // Heal Doses: 1 (치료 필요 횟수)
      type: "Virus", // Virus
      sleepTime: "20:00",
      attackSprite: 11, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 20:00
    },
    evolutionCriteria: {
      // 48시간 후 진화
      timeToEvolveSeconds: 172800, // 48시간 = 172800초
      mistakes: {
        max: 1, // Mistakes [0, 1]
      },
      battles: 15, // Battles 15+
      winRatio: 80, // WinRatio 80%+
    },
    evolutions: [
      {
        targetId: "BlitzGreymon",
        targetName: "블리츠그레이몬",
        conditions: {
          careMistakes: { max: 1 },  // 0-1 Care Mistakes
          battles: { min: 15 },       // 15+ Battles
          winRatio: { min: 80 },      // 80%+ Win Ratio
        },
      },
    ],
  },

  // Perfect (Ultimate) - Monzaemon
  Monzaemon: {
    id: "Monzaemon",
    name: "퍼펫몬",
    stage: "Perfect",
    sprite: 405, // TODO: Check actual sprite
    stats: {
      hungerCycle: 48, // Hunger Loss: 48 Minutes
      strengthCycle: 48, // Strength Loss: 48 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 100, // Power: 100
      maxEnergy: 40, // Energy: 40
      minWeight: 40, // Min Weight: 40
      healDoses: 1, // Heal Doses: 1 (치료 필요 횟수)
      type: "Vaccine", // Vaccine
      sleepTime: "21:00",
      attackSprite: 23, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 21:00
    },
    evolutionCriteria: {
      // 48시간 후 진화
      timeToEvolveSeconds: 172800, // 48시간 = 172800초
      mistakes: {
        max: 1, // Mistakes [0, 1]
      },
      battles: 15, // Battles 15+
      winRatio: 80, // WinRatio 80%+
    },
    evolutions: [
      {
        targetId: "ShinMonzaemon",
        targetName: "신퍼펫몬",
        conditions: {
          careMistakes: { max: 1 },  // 0-1 Care Mistakes
          battles: { min: 15 },      // 15+ Battles
          winRatio: { min: 80 },     // 80%+ Win Ratio
        },
      },
    ],
  },

  // Perfect (Ultimate) - Mamemon
  Mamemon: {
    id: "Mamemon",
    name: "콩알몬",
    stage: "Perfect",
    sprite: 390, // TODO: Check actual sprite
    stats: {
      hungerCycle: 59, // Hunger Loss: 59 Minutes
      strengthCycle: 59, // Strength Loss: 59 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 85, // Power: 85
      maxEnergy: 40, // Energy: 40
      minWeight: 5, // Min Weight: 5
      healDoses: 1, // Heal Doses: 1 (치료 필요 횟수)
      type: "Data", // Data
      sleepTime: "23:00",
      attackSprite: 8, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
    },
    evolutionCriteria: {
      // 48시간 후 진화
      timeToEvolveSeconds: 172800, // 48시간 = 172800초
      mistakes: {
        max: 1, // Mistakes [0, 1]
      },
      battles: 15, // Battles 15+
      winRatio: 80, // WinRatio 80%+
    },
    evolutions: [
      {
        targetId: "BanchoMamemon",
        targetName: "반쵸콩알몬",
        conditions: {
          careMistakes: { max: 1 },  // 0-1 Care Mistakes
          battles: { min: 15 },      // 15+ Battles
          winRatio: { min: 80 },     // 80%+ Win Ratio
        },
      },
    ],
  },

  // Ultimate - Blitz Greymon
  BlitzGreymon: {
    id: "BlitzGreymon",
    name: "블리츠그레이몬",
    stage: "Ultimate",
    sprite: 420, // TODO: Check actual sprite
    stats: {
      hungerCycle: 59, // Hunger Loss: 59 Minutes
      strengthCycle: 59, // Strength Loss: 59 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 170, // Power: 170
      maxEnergy: 50, // Energy: 50
      minWeight: 50, // Min Weight: 50
      healDoses: 1, // Heal Doses: 1 (치료 필요 횟수)
      type: "Virus", // Virus
      sleepTime: "23:00",
      attackSprite: 49, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
    },
    evolutionCriteria: {
      // 조그레스 진화
      jogress: true, // Jogress with Cres Garurumon
    },
    evolutions: [
      {
        targetId: "OmegamonAlterS",
        targetName: "오메가몬 Alter-S",
        // 조그레스는 특별한 케이스이므로 conditions 대신 jogress 플래그 사용
        jogress: {
          partner: "CresGarurumon", // Jogress with Cres Garurumon
        },
      },
    ],
  },

  // Ultimate - Shin Monzaemon
  ShinMonzaemon: {
    id: "ShinMonzaemon",
    name: "신퍼펫몬",
    stage: "Ultimate",
    sprite: 450, // TODO: Check actual sprite
    stats: {
      hungerCycle: 48, // Hunger Loss: 48 Minutes
      strengthCycle: 48, // Strength Loss: 48 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 170, // Power: 170
      maxEnergy: 50, // Energy: 50
      minWeight: 40, // Min Weight: 40
      healDoses: 2, // Heal Doses: 1 (치료 필요 횟수)
      type: "Vaccine", // Vaccine
      sleepTime: "23:00",
      attackSprite: 52, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
    },
    evolutionCriteria: null, // 최종 단계
    evolutions: [], // 최종 단계
  },

  // Ultimate - Bancho Mamemon
  BanchoMamemon: {
    id: "BanchoMamemon",
    name: "반쵸콩알몬",
    stage: "Ultimate",
    sprite: 435, // TODO: Check actual sprite
    stats: {
      hungerCycle: 59, // Hunger Loss: 59 Minutes
      strengthCycle: 59, // Strength Loss: 59 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 150, // Power: 150
      maxEnergy: 50, // Energy: 50
      minWeight: 5, // Min Weight: 5
      type: "Data", // Data
      sleepTime: "23:00",
      attackSprite: 116, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
    },
    evolutionCriteria: null, // 최종 단계
    evolutions: [], // 최종 단계
  },

  // Super Ultimate - Omegamon Alter-S
  OmegamonAlterS: {
    id: "OmegamonAlterS",
    name: "오메가몬 Alter-S",
    stage: "Super Ultimate",
    sprite: 465, // TODO: Check actual sprite
    stats: {
      hungerCycle: 66, // Hunger Loss: 66 Minutes
      strengthCycle: 66, // Strength Loss: 66 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 200, // Power: 200
      maxEnergy: 50, // Energy: 50
      minWeight: 40, // Min Weight: 40
      healDoses: 1, // Heal Doses: 1 (치료 필요 횟수)
      type: "Virus", // Virus
      sleepTime: "23:00",
      attackSprite: 31, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
    },
    evolutionCriteria: null, // 최종 단계
    evolutions: [], // 최종 단계
  },

  // Ultimate - Cres Garurumon (Jogress 파트너용 Placeholder)
  CresGarurumon: {
    id: "CresGarurumon",
    name: "크레스가루몬",
    stage: "Ultimate",
    sprite: 480, // TODO: Check actual sprite
    stats: {
      hungerCycle: 0, // Placeholder
      strengthCycle: 0, // Placeholder
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 0, // Placeholder
      maxEnergy: 0, // Placeholder
      minWeight: 0, // Placeholder
      healDoses: 1, // Heal Doses: 1 (치료 필요 횟수)
      type: null, // Placeholder
      sleepTime: null,
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용) // Placeholder
    },
    evolutionCriteria: null, // Jogress 파트너용
    evolutions: [], // Jogress 파트너용
  },
};
