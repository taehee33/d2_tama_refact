// src/data/v1/digimons.js
// Digital Monster Color 매뉴얼 기반 디지몬 데이터 스키마

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
 * @property {Object} evolutionCriteria - 진화 조건
 * @property {Object} evolutionCriteria.mistakes - 실수 조건 {min: number, max: number}
 * @property {number} evolutionCriteria.trainings - 최소 훈련 횟수
 * @property {number} evolutionCriteria.overfeeds - 최대 오버피드 횟수
 * @property {number} evolutionCriteria.battles - 최소 배틀 횟수
 * @property {number} evolutionCriteria.winRatio - 최소 승률 (%)
 * @property {number} evolutionCriteria.minWeight - 최소 체중
 * @property {number} evolutionCriteria.minStrength - 최소 힘
 * @property {number} evolutionCriteria.minEffort - 최소 노력치
 * @property {string} evolutionCriteria.requiredType - 필수 속성
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
    },
    evolutionCriteria: null, // 진화 불가
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
    },
    evolutionCriteria: null, // 진화 불가
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
    },
    evolutionCriteria: {
      // 8초 후 자동 진화
      timeToEvolveSeconds: 8,
    },
  },

  // Baby I (In-Training I)
  Botamon: {
    id: "Botamon",
    name: "Botamon",
    stage: "Baby I",
    sprite: 210,
    stats: {
      hungerCycle: 3, // 3분마다 배고픔 감소
      strengthCycle: 3, // 3분마다 힘 감소
      poopCycle: 3, // Stage I: 3분마다 똥
      maxOverfeed: 3,
      basePower: 0,
      maxEnergy: 0,
      minWeight: 5,
      type: null,
    },
    evolutionCriteria: {
      // 10분 후 진화
      timeToEvolveSeconds: 600, // 10분 = 600초
    },
  },

  // Baby II (In-Training II)
  Koromon: {
    id: "Koromon",
    name: "Koromon",
    stage: "Baby II",
    sprite: 225,
    stats: {
      hungerCycle: 4,
      strengthCycle: 4,
      poopCycle: 60, // Stage II: 60분마다 똥
      maxOverfeed: 2,
      basePower: 0,
      maxEnergy: 0,
      minWeight: 6,
      type: null,
    },
    evolutionCriteria: {
      // 12시간 후 진화
      timeToEvolveSeconds: 43200, // 12시간 = 43200초
      mistakes: {
        max: 3, // 실수 3개 이하 → Agumon
      },
      // 실수 4개 이상 → Betamon (별도 조건으로 처리)
    },
  },

  // Child (Rookie) - Agumon
  Agumon: {
    id: "Agumon",
    name: "Agumon",
    stage: "Child",
    sprite: 240,
    stats: {
      hungerCycle: 5,
      strengthCycle: 5,
      poopCycle: 120, // Stage III+: 120분마다 똥
      maxOverfeed: 4,
      basePower: 0, // TODO: 매뉴얼에서 실제 파워 값 확인 필요
      maxEnergy: 100,
      minWeight: 10,
      type: "Vaccine", // TODO: 실제 속성 확인 필요
    },
    evolutionCriteria: {
      // 24시간 후 진화
      timeToEvolveSeconds: 86400, // 24시간 = 86400초
      mistakes: {
        max: 3, // 실수 3개 이하 → Greymon
      },
      // 실수 4개 이상 → Betamon (별도 조건으로 처리)
    },
  },

  // Child (Rookie) - Betamon
  Betamon: {
    id: "Betamon",
    name: "Betamon",
    stage: "Child",
    sprite: 255,
    stats: {
      hungerCycle: 5,
      strengthCycle: 5,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 0,
      maxEnergy: 100,
      minWeight: 10,
      type: "Data", // TODO: 실제 속성 확인 필요
    },
    evolutionCriteria: null, // 진화 불가 (최종 형태)
  },

  // Adult (Champion) - Greymon
  Greymon: {
    id: "Greymon",
    name: "Greymon",
    stage: "Adult",
    sprite: 270,
    stats: {
      hungerCycle: 5,
      strengthCycle: 5,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 0, // TODO: 매뉴얼에서 실제 파워 값 확인 필요
      maxEnergy: 100,
      minWeight: 0,
      type: "Vaccine",
    },
    evolutionCriteria: {
      // 36시간 후 진화
      timeToEvolveSeconds: 129600, // 36시간 = 129600초
      battles: 15, // 최소 15번 배틀 필요
      winRatio: 40, // 최소 40% 승률 (80%면 보장)
      mistakes: {
        max: 4, // 실수 4개 이하
      },
    },
  },

  // TODO: Perfect, Ultimate, Super Ultimate 추가 필요
};

