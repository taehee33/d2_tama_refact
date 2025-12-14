// src/data/v1/evolution.js
// Digital Monster Color 매뉴얼 기반 진화 조건 정의

/**
 * 진화 조건 체크 함수
 * 매뉴얼의 진화 규칙을 반영하여 복합 조건을 체크
 */
export const evolutionConditionsVer1 = {
  Digitama: {
    evolution: [
      {
        next: "Botamon",
        condition: {
          check: (stats) => stats.timeToEvolveSeconds <= 0,
        },
      },
    ],
  },
  Botamon: {
    evolution: [
      {
        next: "Koromon",
        condition: {
          check: (stats) => stats.timeToEvolveSeconds <= 0,
        },
      },
    ],
  },
  Koromon: {
    evolution: [
      {
        next: "Agumon",
        condition: {
          // 실수 3개 이하 → Agumon
          check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes <= 3,
        },
      },
      {
        next: "Betamon",
        condition: {
          // 실수 4개 이상 → Betamon
          check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes >= 4,
        },
      },
    ],
  },
  Agumon: {
    evolution: [
      {
        next: "Greymon",
        condition: {
          // 0-3 Care Mistakes, 32+ Training
          check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes <= 3 && (stats.trainings || 0) >= 32,
        },
      },
      {
        next: "Tyranomon",
        condition: {
          // 4+ Care Mistakes, 5-15 Training, 3+ Overfeed, 4-5 Sleep Disturbances
          check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes >= 4 && 
            (stats.trainings || 0) >= 5 && (stats.trainings || 0) <= 15 &&
            (stats.overfeeds || 0) >= 3 && (stats.sleepDisturbances || 0) >= 4 && (stats.sleepDisturbances || 0) <= 5,
        },
      },
      {
        next: "Devimon",
        condition: {
          // 0-3 Care Mistakes, 0-31 Training
          check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes <= 3 && 
            (stats.trainings || 0) >= 0 && (stats.trainings || 0) <= 31,
        },
      },
      {
        next: "Meramon",
        condition: {
          // 4+ Care Mistakes, 16+ Training, 3+ Overfeed, 6+ Sleep Disturbances
          check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes >= 4 && 
            (stats.trainings || 0) >= 16 && (stats.overfeeds || 0) >= 3 && (stats.sleepDisturbances || 0) >= 6,
        },
      },
      {
        next: "Numemon",
        condition: {
          // 4+ Care Mistakes, 0-4 Training
          check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes >= 4 && 
            (stats.trainings || 0) >= 0 && (stats.trainings || 0) <= 4,
        },
      },
      {
        next: "Numemon",
        condition: {
          // 4+ Care Mistakes, 0-2 Overfeed
          check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes >= 4 && 
            (stats.overfeeds || 0) >= 0 && (stats.overfeeds || 0) <= 2,
        },
      },
      {
        next: "Numemon",
        condition: {
          // 4+ Care Mistakes, 5-15 Training, 3+ Overfeed, 0-3 Sleep Disturbances
          check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes >= 4 && 
            (stats.trainings || 0) >= 5 && (stats.trainings || 0) <= 15 &&
            (stats.overfeeds || 0) >= 3 && (stats.sleepDisturbances || 0) >= 0 && (stats.sleepDisturbances || 0) <= 3,
        },
      },
      {
        next: "Numemon",
        condition: {
          // 4+ Care Mistakes, 5-15 Training, 3+ Overfeed, 6+ Sleep Disturbances
          check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes >= 4 && 
            (stats.trainings || 0) >= 5 && (stats.trainings || 0) <= 15 &&
            (stats.overfeeds || 0) >= 3 && (stats.sleepDisturbances || 0) >= 6,
        },
      },
      {
        next: "Numemon",
        condition: {
          // 4+ Care Mistakes, 16+ Training, 3+ Overfeed, 0-5 Sleep Disturbances
          check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes >= 4 && 
            (stats.trainings || 0) >= 16 && (stats.overfeeds || 0) >= 3 && 
            (stats.sleepDisturbances || 0) >= 0 && (stats.sleepDisturbances || 0) <= 5,
        },
      },
    ],
  },
  Betamon: {
    evolution: [
      {
        next: "Airdramon",
        condition: {
          // 4+ Care Mistakes, 8-31 Training, 0-3 Overfeed, 9+ Sleep Disturbances
          check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes >= 4 && 
            (stats.trainings || 0) >= 8 && (stats.trainings || 0) <= 31 &&
            (stats.overfeeds || 0) >= 0 && (stats.overfeeds || 0) <= 3 && (stats.sleepDisturbances || 0) >= 9,
        },
      },
      {
        next: "Seadramon",
        condition: {
          // 4+ Care Mistakes, 8-31 Training, 4+ Overfeed, 0-8 Sleep Disturbances
          check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes >= 4 && 
            (stats.trainings || 0) >= 8 && (stats.trainings || 0) <= 31 &&
            (stats.overfeeds || 0) >= 4 && (stats.sleepDisturbances || 0) >= 0 && (stats.sleepDisturbances || 0) <= 8,
        },
      },
      {
        next: "Devimon",
        condition: {
          // 0-3 Care Mistakes, 48+ Training
          check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes <= 3 && (stats.trainings || 0) >= 48,
        },
      },
      {
        next: "Meramon",
        condition: {
          // 0-3 Care Mistakes, 0-47 Training
          check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes <= 3 && 
            (stats.trainings || 0) >= 0 && (stats.trainings || 0) <= 47,
        },
      },
      {
        next: "Numemon",
        condition: {
          // 4+ Care Mistakes, 0-7 Training
          check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes >= 4 && 
            (stats.trainings || 0) >= 0 && (stats.trainings || 0) <= 7,
        },
      },
      {
        next: "Numemon",
        condition: {
          // 4+ Care Mistakes, 32+ Training
          check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes >= 4 && (stats.trainings || 0) >= 32,
        },
      },
      {
        next: "Numemon",
        condition: {
          // 4+ Care Mistakes, 8-31 Training, 4+ Overfeed, 9+ Sleep Disturbances
          check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes >= 4 && 
            (stats.trainings || 0) >= 8 && (stats.trainings || 0) <= 31 &&
            (stats.overfeeds || 0) >= 4 && (stats.sleepDisturbances || 0) >= 9,
        },
      },
      {
        next: "Numemon",
        condition: {
          // 4+ Care Mistakes, 8-31 Training, 0-3 Overfeed, 0-8 Sleep Disturbances
          check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes >= 4 && 
            (stats.trainings || 0) >= 8 && (stats.trainings || 0) <= 31 &&
            (stats.overfeeds || 0) >= 0 && (stats.overfeeds || 0) <= 3 && 
            (stats.sleepDisturbances || 0) >= 0 && (stats.sleepDisturbances || 0) <= 8,
        },
      },
    ],
  },
  Greymon: {
    evolution: [
      {
        next: "MetalGreymonVirus",
        condition: {
          // 15+ Battles, 80%+ Win Ratio
          check: (stats) => {
            const totalBattles = (stats.battlesWon || 0) + (stats.battlesLost || 0);
            if (totalBattles < 15) return false;
            const winRatio = totalBattles > 0 ? ((stats.battlesWon || 0) / totalBattles) * 100 : 0;
            return stats.timeToEvolveSeconds <= 0 && winRatio >= 80;
          },
        },
      },
    ],
  },
  Tyranomon: {
    evolution: [
      {
        next: "Mamemon",
        condition: {
          // 15+ Battles, 80%+ Win Ratio
          check: (stats) => {
            const totalBattles = (stats.battlesWon || 0) + (stats.battlesLost || 0);
            if (totalBattles < 15) return false;
            const winRatio = totalBattles > 0 ? ((stats.battlesWon || 0) / totalBattles) * 100 : 0;
            return stats.timeToEvolveSeconds <= 0 && winRatio >= 80;
          },
        },
      },
    ],
  },
  Meramon: {
    evolution: [
      {
        next: "MetalGreymonVirus",
        condition: {
          // 15+ Battles, 80%+ Win Ratio
          check: (stats) => {
            const totalBattles = (stats.battlesWon || 0) + (stats.battlesLost || 0);
            if (totalBattles < 15) return false;
            const winRatio = totalBattles > 0 ? ((stats.battlesWon || 0) / totalBattles) * 100 : 0;
            return stats.timeToEvolveSeconds <= 0 && winRatio >= 80;
          },
        },
      },
    ],
  },
  Seadramon: {
    evolution: [
      {
        next: "MetalGreymonVirus",
        condition: {
          // 15+ Battles, 80%+ Win Ratio
          check: (stats) => {
            const totalBattles = (stats.battlesWon || 0) + (stats.battlesLost || 0);
            if (totalBattles < 15) return false;
            const winRatio = totalBattles > 0 ? ((stats.battlesWon || 0) / totalBattles) * 100 : 0;
            return stats.timeToEvolveSeconds <= 0 && winRatio >= 80;
          },
        },
      },
    ],
  },
  Numemon: {
    evolution: [
      {
        next: "Monzaemon",
        condition: {
          // 15+ Battles, 80%+ Win Ratio
          check: (stats) => {
            const totalBattles = (stats.battlesWon || 0) + (stats.battlesLost || 0);
            if (totalBattles < 15) return false;
            const winRatio = totalBattles > 0 ? ((stats.battlesWon || 0) / totalBattles) * 100 : 0;
            return stats.timeToEvolveSeconds <= 0 && winRatio >= 80;
          },
        },
      },
    ],
  },
  Devimon: {
    evolution: [
      {
        next: "MetalGreymonVirus",
        condition: {
          // 15+ Battles, 80%+ Win Ratio
          check: (stats) => {
            const totalBattles = (stats.battlesWon || 0) + (stats.battlesLost || 0);
            if (totalBattles < 15) return false;
            const winRatio = totalBattles > 0 ? ((stats.battlesWon || 0) / totalBattles) * 100 : 0;
            return stats.timeToEvolveSeconds <= 0 && winRatio >= 80;
          },
        },
      },
    ],
  },
  Airdramon: {
    evolution: [
      {
        next: "MetalGreymonVirus",
        condition: {
          // 15+ Battles, 80%+ Win Ratio
          check: (stats) => {
            const totalBattles = (stats.battlesWon || 0) + (stats.battlesLost || 0);
            if (totalBattles < 15) return false;
            const winRatio = totalBattles > 0 ? ((stats.battlesWon || 0) / totalBattles) * 100 : 0;
            return stats.timeToEvolveSeconds <= 0 && winRatio >= 80;
          },
        },
      },
    ],
  },
};
