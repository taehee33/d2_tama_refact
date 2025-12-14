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
    name: "Ohakadamon",
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
    name: "Ohakadamon",
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
    name: "Digitama",
    stage: "Digitama",
    sprite: 133,
    stats: {
      hungerCycle: 0,
      strengthCycle: 0,
      poopCycle: 3, // Stage I: 3분마다 똥
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
        targetName: "Botamon",
        condition: {
          type: "time",
          value: 8, // 8초
        },
      },
    ],
  },

  // Baby I (In-Training I)
  Botamon: {
    id: "Botamon",
    name: "Botamon",
    stage: "Baby I",
    sprite: 210,
    stats: {
      hungerCycle: 3, // Hunger Loss: 3 Minutes
      strengthCycle: 3, // Strength Loss: 3 Minutes
      poopCycle: 3, // Stage I: 3분마다 똥
      maxOverfeed: 3,
      basePower: 0, // Power: 0
      maxEnergy: 0, // Energy: 0
      minWeight: 5, // Min Weight: 5
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
        targetName: "Koromon",
        condition: {
          type: "time",
          value: 600, // 10분 = 600초
        },
      },
    ],
  },

  // Baby II (In-Training II)
  Koromon: {
    id: "Koromon",
    name: "Koromon",
    stage: "Baby II",
    sprite: 225,
    stats: {
      hungerCycle: 30, // Hunger Loss: 30 Minutes
      strengthCycle: 30, // Strength Loss: 30 Minutes
      poopCycle: 60, // Stage II: 60분마다 똥
      maxOverfeed: 2,
      basePower: 0, // Power: 0
      maxEnergy: 0, // Energy: 0
      minWeight: 10, // Min Weight: 10
      type: "Free", // Free
      sleepTime: "20:00",
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 20:00
    },
    evolutionCriteria: {
      // 12시간 후 진화
      timeToEvolveSeconds: 43200, // 12시간 = 43200초
    },
    evolutions: [
      {
        targetId: "Agumon",
        targetName: "Agumon",
        condition: {
          type: "mistakes",
          value: [0, 3], // Mistakes [0, 3]
        },
      },
      {
        targetId: "Betamon",
        targetName: "Betamon",
        condition: {
          type: "mistakes",
          value: [4, 99], // Mistakes [4, 99]
        },
      },
    ],
  },

  // Child (Rookie) - Agumon
  Agumon: {
    id: "Agumon",
    name: "Agumon",
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
        targetName: "Greymon",
        condition: {
          type: "mistakes",
          value: [0, 3], // Mistakes [0, 3]
          trainings: 32, // Training 32+
        },
      },
      {
        targetId: "Devimon",
        targetName: "Devimon",
        condition: {
          type: "mistakes",
          value: [0, 3], // Mistakes [0, 3]
          trainings: [0, 31], // Training 0-31
        },
      },
      {
        targetId: "Tyranomon",
        targetName: "Tyranomon",
        condition: {
          type: "mistakes",
          value: [4, 99], // Mistakes [4, 99]
          trainings: [5, 15], // Training 5-15
          overfeeds: [3, 99], // Overfeed 3+
          sleepDisturbances: [4, 5], // SleepDisturb 4-5
        },
      },
      {
        targetId: "Meramon",
        targetName: "Meramon",
        condition: {
          type: "mistakes",
          value: [4, 99], // Mistakes [4, 99]
          trainings: [16, 99], // Training 16+
          overfeeds: [3, 99], // Overfeed 3+
          sleepDisturbances: [6, 99], // SleepDisturb 6+
        },
      },
      // Fallback 진화는 맨 뒤에 배치
      {
        targetId: "Numemon",
        targetName: "Numemon",
        condition: {
          type: "fallback", // Fallback 진화
        },
      },
    ],
  },

  // Child (Rookie) - Betamon
  Betamon: {
    id: "Betamon",
    name: "Betamon",
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
      type: "Virus", // Virus
      sleepTime: "21:00",
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용)
    },
    evolutionCriteria: {
      // 24시간 후 진화
      timeToEvolveSeconds: 86400, // 24시간 = 86400초
    },
    evolutions: [
      // 우선순위: 까다로운 진화를 앞에 배치
      {
        targetId: "Devimon",
        targetName: "Devimon",
        condition: {
          type: "mistakes",
          value: [0, 3], // Mistakes [0, 3]
          trainings: [48, 99], // Training 48+
        },
      },
      {
        targetId: "Meramon",
        targetName: "Meramon",
        condition: {
          type: "mistakes",
          value: [0, 3], // Mistakes [0, 3]
          trainings: [0, 47], // Training 0-47
        },
      },
      {
        targetId: "Airdramon",
        targetName: "Airdramon",
        condition: {
          type: "mistakes",
          value: [4, 99], // Mistakes [4, 99]
          trainings: [8, 31], // Training 8-31
          overfeeds: [0, 3], // Overfeed 0-3
          sleepDisturbances: [9, 99], // SleepDisturb 9+
        },
      },
      {
        targetId: "Seadramon",
        targetName: "Seadramon",
        condition: {
          type: "mistakes",
          value: [4, 99], // Mistakes [4, 99]
          trainings: [8, 31], // Training 8-31
          overfeeds: [4, 99], // Overfeed 4+
          sleepDisturbances: [0, 8], // SleepDisturb 0-8
        },
      },
      // Fallback 진화는 맨 뒤에 배치
      {
        targetId: "Numemon",
        targetName: "Numemon",
        condition: {
          type: "fallback", // Fallback 진화
        },
      },
    ],
  },

  // Adult (Champion) - Greymon
  Greymon: {
    id: "Greymon",
    name: "Greymon",
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
      type: "Vaccine", // Vaccine
      sleepTime: "21:00",
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 21:00
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
        targetName: "Metal Greymon (Virus)",
        condition: {
          type: "battles",
          battles: 15, // Battles 15+
          winRatio: 80, // WinRatio 80%+
        },
      },
    ],
  },

  // Adult (Champion) - Devimon
  Devimon: {
    id: "Devimon",
    name: "Devimon",
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
      type: "Virus", // Virus
      sleepTime: "23:00",
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
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
        targetName: "Metal Greymon (Virus)",
        condition: {
          type: "battles",
          battles: 15, // Battles 15+
          winRatio: 80, // WinRatio 80%+
        },
      },
    ],
  },

  // Adult (Champion) - Airdramon
  Airdramon: {
    id: "Airdramon",
    name: "Airdramon",
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
      type: "Vaccine", // Vaccine
      sleepTime: "23:00",
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
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
        targetName: "Metal Greymon (Virus)",
        condition: {
          type: "battles",
          battles: 15, // Battles 15+
          winRatio: 80, // WinRatio 80%+
        },
      },
    ],
  },

  // Adult (Champion) - Numemon
  Numemon: {
    id: "Numemon",
    name: "Numemon",
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
      type: "Virus", // Virus
      sleepTime: "00:00",
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 00:00
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
        targetName: "Monzaemon",
        condition: {
          type: "battles",
          battles: 15, // Battles 15+
          winRatio: 80, // WinRatio 80%+
        },
      },
    ],
  },

  // Adult (Champion) - Tyranomon
  Tyranomon: {
    id: "Tyranomon",
    name: "Tyranomon",
    stage: "Adult",
    sprite: 290, // TODO: Check actual sprite
    stats: {
      hungerCycle: 59, // Hunger Loss: 59 Minutes
      strengthCycle: 59, // Strength Loss: 59 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 45, // Power: 45
      maxEnergy: 30, // Energy: 30
      minWeight: 20, // Min Weight: 20
      type: "Data", // Data
      sleepTime: "22:00",
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 22:00
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
        targetName: "Mamemon",
        condition: {
          type: "battles",
          battles: 15, // Battles 15+
          winRatio: 80, // WinRatio 80%+
        },
      },
    ],
  },

  // Adult (Champion) - Meramon
  Meramon: {
    id: "Meramon",
    name: "Meramon",
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
        targetName: "Mamemon",
        condition: {
          type: "battles",
          battles: 15, // Battles 15+
          winRatio: 80, // WinRatio 80%+
        },
      },
    ],
  },

  // Adult (Champion) - Seadramon
  Seadramon: {
    id: "Seadramon",
    name: "Seadramon",
    stage: "Adult",
    sprite: 330, // TODO: Check actual sprite
    stats: {
      hungerCycle: 38, // Hunger Loss: 38 Minutes
      strengthCycle: 38, // Strength Loss: 38 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 45, // Power: 45
      maxEnergy: 30, // Energy: 30
      minWeight: 20, // Min Weight: 20
      type: "Data", // Data
      sleepTime: "23:00",
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
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
        targetName: "Mamemon",
        condition: {
          type: "battles",
          battles: 15, // Battles 15+
          winRatio: 80, // WinRatio 80%+
        },
      },
    ],
  },

  // Perfect (Ultimate) - Metal Greymon (Virus)
  MetalGreymonVirus: {
    id: "MetalGreymonVirus",
    name: "Metal Greymon (Virus)",
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
      type: "Virus", // Virus
      sleepTime: "20:00",
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 20:00
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
        targetName: "Blitz Greymon",
        condition: {
          type: "mistakes",
          value: [0, 1], // Mistakes [0, 1]
          battles: 15, // Battles 15+
          winRatio: 80, // WinRatio 80%+
        },
      },
    ],
  },

  // Perfect (Ultimate) - Monzaemon
  Monzaemon: {
    id: "Monzaemon",
    name: "Monzaemon",
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
      type: "Vaccine", // Vaccine
      sleepTime: "21:00",
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 21:00
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
        targetName: "Shin Monzaemon",
        condition: {
          type: "mistakes",
          value: [0, 1], // Mistakes [0, 1]
          battles: 15, // Battles 15+
          winRatio: 80, // WinRatio 80%+
        },
      },
    ],
  },

  // Perfect (Ultimate) - Mamemon
  Mamemon: {
    id: "Mamemon",
    name: "Mamemon",
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
      type: "Data", // Data
      sleepTime: "23:00",
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
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
        targetName: "Bancho Mamemon",
        condition: {
          type: "mistakes",
          value: [0, 1], // Mistakes [0, 1]
          battles: 15, // Battles 15+
          winRatio: 80, // WinRatio 80%+
        },
      },
    ],
  },

  // Ultimate - Blitz Greymon
  BlitzGreymon: {
    id: "BlitzGreymon",
    name: "Blitz Greymon",
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
      type: "Virus", // Virus
      sleepTime: "23:00",
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
    },
    evolutionCriteria: {
      // 조그레스 진화
      jogress: true, // Jogress with Cres Garurumon
    },
    evolutions: [
      {
        targetId: "OmegamonAlterS",
        targetName: "Omegamon Alter-S",
        condition: {
          type: "jogress",
          partner: "CresGarurumon", // Jogress with Cres Garurumon
        },
      },
    ],
  },

  // Ultimate - Shin Monzaemon
  ShinMonzaemon: {
    id: "ShinMonzaemon",
    name: "Shin Monzaemon",
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
      type: "Vaccine", // Vaccine
      sleepTime: "23:00",
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
    },
    evolutionCriteria: null, // 최종 단계
    evolutions: [], // 최종 단계
  },

  // Ultimate - Bancho Mamemon
  BanchoMamemon: {
    id: "BanchoMamemon",
    name: "Bancho Mamemon",
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
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
    },
    evolutionCriteria: null, // 최종 단계
    evolutions: [], // 최종 단계
  },

  // Super Ultimate - Omegamon Alter-S
  OmegamonAlterS: {
    id: "OmegamonAlterS",
    name: "Omegamon Alter-S",
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
      type: "Virus", // Virus
      sleepTime: "23:00",
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
    },
    evolutionCriteria: null, // 최종 단계
    evolutions: [], // 최종 단계
  },

  // Ultimate - Cres Garurumon (Jogress 파트너용 Placeholder)
  CresGarurumon: {
    id: "CresGarurumon",
    name: "Cres Garurumon",
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
      type: null, // Placeholder
      sleepTime: null,
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용) // Placeholder
    },
    evolutionCriteria: null, // Jogress 파트너용
    evolutions: [], // Jogress 파트너용
  },
};
