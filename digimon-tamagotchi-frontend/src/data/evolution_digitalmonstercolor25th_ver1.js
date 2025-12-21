// src/data/evolution_digitalmonstercolor25th_ver1.js
// ⚠️ DEPRECATED: 이 파일은 더 이상 사용되지 않습니다.
// 모든 진화 조건은 src/data/v1/digimons.js의 구조화된 데이터 형식으로 통합되었습니다.
// 
// 레거시 호환성을 위해 일시적으로 유지되지만, 새로운 진화 조건은 digimons.js에만 추가하세요.

/**
 * @deprecated 이 데이터는 더 이상 사용되지 않습니다. digimons.js를 사용하세요.
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
            check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes < 4,
          },
        },
        {
          next: "Betamon",
          condition: {
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
            check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes < 4,
          },
        },
        {
          next: "Betamon",
          condition: {
            check: (stats) => stats.timeToEvolveSeconds <= 0 && stats.careMistakes >= 4,
          },
        },
      ],
    },
    Betamon: {
      evolution: [],
    },
    Greymon: {
      evolution: [],
    },
    // ...
  };