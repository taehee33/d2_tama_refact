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
          // 실수 3개 이하 → Greymon
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
  Betamon: {
    evolution: [], // 최종 형태
  },
  Greymon: {
    evolution: [
      // TODO: 매뉴얼 기반으로 Perfect 단계 진화 조건 추가 필요
      // - 36시간 내 15번 이상 배틀
      // - 최소 40% 승률 (80%면 보장)
      // - 실수 4개 이하
    ],
  },
};

