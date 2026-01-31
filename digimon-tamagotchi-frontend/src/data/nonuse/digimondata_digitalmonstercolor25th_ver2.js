// src/data/nonuse/digimondata_digitalmonstercolor25th_ver2.js (미사용 — v2는 src/data/v2modkor/ 사용)
// 실제로는 Ver.2 디지몬 정보( Punimon, Tsunomon, etc. )를 넣어주시면 됩니다.

const entriesVer2 = {
    Digitama: {
      sprite: 133, 
      evolutionStage: "Digitama",
      timeToEvolveSeconds: 10,
      hungerTimer: 0,
      strengthTimer: 0,
      poopTimer: 0,
      minWeight: 0,
      maxStamina: 0,
    },
    // Ver.2용 Baby1, Baby2, etc...
    // Punimon, Tsunomon, ...
  };
  
  const defaultStatsV2 = {
    sprite: 133,
    evolutionStage: "Digitama",
    maxStamina: 0,
    minWeight: 0,
    lifespanSeconds: 0,
    lifespanMinutes: 0,
    timeToEvolve: 0,
    timeToEvolveSeconds: 0,
    hungerTimer: 0,
    strengthTimer: 0,
    poopTimer: 0,
    hungerCountdown: 0,
    strengthCountdown: 0,
    age: 0,
    weight: 0,
    fullness: 0,
    health: 0,
    // etc...
  };
  
  export function initializeStats(digimonName) {
    const custom = entriesVer2[digimonName] || {};
    const merged = { ...defaultStatsV2, ...custom };
    merged.hungerCountdown = merged.hungerTimer * 60;
    merged.strengthCountdown = merged.strengthTimer * 60;
    return merged;
  }
  
  export function updateLifespan(prev, deltaTime) {
    const s = { ...prev };
    s.lifespanSeconds += deltaTime;
    s.lifespanMinutes += deltaTime / 60;
    s.timeToEvolveSeconds = Math.max(0, s.timeToEvolveSeconds - deltaTime);
    // etc...
    return s;
  }
  
  export function updateAge(stats) {
    return stats;
  }
  
  // 예시 Ver.2 진화조건
  export const evolutionConditions = {
    Digitama: {
      evolution: [
        {
          next: "Punimon",
          condition: {
            check: (stats) => stats.timeToEvolveSeconds <= 0,
          },
        },
      ],
    },
    Punimon: {
      evolution: [
        {
          next: "Tsunomon",
          condition: {
            check: (stats) => stats.timeToEvolveSeconds <= 0,
          },
        },
      ],
    },
    // ...
    Tsunomon: {
      evolution: [],
    },
  };
