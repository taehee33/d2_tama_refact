// src/data/v1/quests.js
// Digital Monster Color Ver.1 퀘스트 모드 데이터

/**
 * 퀘스트 Area 데이터
 * 각 Area는 여러 적(Enemy)을 포함하며, 마지막 적은 Boss입니다.
 * 
 * @typedef {Object} QuestEnemy
 * @property {string} enemyId - 디지몬 ID (digimons.js 참조)
 * @property {string} name - 디지몬 이름
 * @property {string} attribute - 속성 (Vaccine, Data, Virus, Free)
 * @property {number} power - 파워 (퀘스트 전용 값, 도감 값과 다를 수 있음)
 * @property {boolean} isBoss - 보스 여부
 */

/**
 * @typedef {Object} QuestArea
 * @property {string} areaId - Area ID (예: "area1", "areaF")
 * @property {string} areaName - Area 이름
 * @property {string|null} unlockCondition - 언락 조건 (null이면 처음부터 사용 가능)
 * @property {Array<QuestEnemy>} enemies - 적 목록
 */

export const quests = [
  // Area 1: The Grid
  {
    areaId: "area1",
    areaName: "Area 1",
    unlockCondition: "The Grid",
    enemies: [
      {
        enemyId: "Betamon",
        name: "Betamon",
        attribute: "Virus",
        power: 15,
        isBoss: false,
      },
      {
        enemyId: "Agumon",
        name: "Agumon",
        attribute: "Vaccine",
        power: 19,
        isBoss: false,
      },
      {
        enemyId: "Meramon",
        name: "Meramon",
        attribute: "Data",
        power: 23,
        isBoss: true,
      },
    ],
  },

  // Area 2
  {
    areaId: "area2",
    areaName: "Area 2",
    unlockCondition: null,
    enemies: [
      {
        enemyId: "Numemon",
        name: "Numemon",
        attribute: "Virus",
        power: 19,
        isBoss: false,
      },
      {
        enemyId: "Seadramon",
        name: "Seadramon",
        attribute: "Data",
        power: 23,
        isBoss: false,
      },
      {
        enemyId: "Devimon",
        name: "Devimon",
        attribute: "Virus",
        power: 28,
        isBoss: true,
      },
    ],
  },

  // Area 3
  {
    areaId: "area3",
    areaName: "Area 3",
    unlockCondition: null,
    enemies: [
      {
        enemyId: "Tyranomon",
        name: "Tyranomon",
        attribute: "Data",
        power: 28,
        isBoss: false,
      },
      {
        enemyId: "Airdramon",
        name: "Airdramon",
        attribute: "Vaccine",
        power: 37,
        isBoss: false,
      },
      {
        enemyId: "Greymon",
        name: "Greymon",
        attribute: "Vaccine",
        power: 45,
        isBoss: true,
      },
    ],
  },

  // Area 4: DMC Logo
  {
    areaId: "area4",
    areaName: "Area 4",
    unlockCondition: "DMC Logo",
    enemies: [
      {
        enemyId: "Seadramon",
        name: "Seadramon",
        attribute: "Data",
        power: 45,
        isBoss: false,
      },
      {
        enemyId: "Meramon",
        name: "Meramon",
        attribute: "Data",
        power: 55,
        isBoss: false,
      },
      {
        enemyId: "Devimon",
        name: "Devimon",
        attribute: "Virus",
        power: 65,
        isBoss: false,
      },
      {
        enemyId: "Mamemon",
        name: "Mamemon",
        attribute: "Data",
        power: 80,
        isBoss: true,
      },
    ],
  },

  // Area 5
  {
    areaId: "area5",
    areaName: "Area 5",
    unlockCondition: null,
    enemies: [
      {
        enemyId: "Airdramon",
        name: "Airdramon",
        attribute: "Vaccine",
        power: 55,
        isBoss: false,
      },
      {
        enemyId: "Tyranomon",
        name: "Tyranomon",
        attribute: "Data",
        power: 70,
        isBoss: false,
      },
      {
        enemyId: "Greymon",
        name: "Greymon",
        attribute: "Vaccine",
        power: 85,
        isBoss: false,
      },
      {
        enemyId: "MetalGreymonVirus",
        name: "Metal Greymon (Virus)",
        attribute: "Virus",
        power: 105,
        isBoss: true,
      },
    ],
  },

  // Area 6
  {
    areaId: "area6",
    areaName: "Area 6",
    unlockCondition: null,
    enemies: [
      {
        enemyId: "Meramon",
        name: "Meramon",
        attribute: "Data",
        power: 55,
        isBoss: false,
      },
      {
        enemyId: "Mamemon",
        name: "Mamemon",
        attribute: "Data",
        power: 80,
        isBoss: false,
      },
      {
        enemyId: "Monzaemon",
        name: "Monzaemon",
        attribute: "Vaccine",
        power: 95,
        isBoss: false,
      },
      {
        enemyId: "BanchoMamemon",
        name: "Bancho Mamemon",
        attribute: "Data",
        power: 120,
        isBoss: true,
      },
    ],
  },

  // Area 7
  {
    areaId: "area7",
    areaName: "Area 7",
    unlockCondition: null,
    enemies: [
      {
        enemyId: "Numemon",
        name: "Numemon",
        attribute: "Virus",
        power: 75,
        isBoss: false,
      },
      {
        enemyId: "MetalGreymonVirus",
        name: "Metal Greymon (Virus)",
        attribute: "Virus",
        power: 90,
        isBoss: false,
      },
      {
        enemyId: "Monzaemon",
        name: "Monzaemon",
        attribute: "Vaccine",
        power: 110,
        isBoss: false,
      },
      {
        enemyId: "BlitzGreymon",
        name: "Blitz Greymon",
        attribute: "Virus",
        power: 130,
        isBoss: false,
      },
      {
        enemyId: "ShinMonzaemon",
        name: "Shin Monzaemon",
        attribute: "Vaccine",
        power: 145,
        isBoss: true,
      },
    ],
  },

  // Area F (Final): Box Art
  {
    areaId: "areaF",
    areaName: "Area F (Final)",
    unlockCondition: "Box Art",
    enemies: [
      {
        enemyId: "MetalGreymonVirus",
        name: "Metal Greymon (Virus)",
        attribute: "Virus",
        power: 85,
        isBoss: false,
      },
      {
        enemyId: "BanchoMamemon",
        name: "Bancho Mamemon",
        attribute: "Data",
        power: 100,
        isBoss: false,
      },
      {
        enemyId: "ShinMonzaemon",
        name: "Shin Monzaemon",
        attribute: "Vaccine",
        power: 135,
        isBoss: false,
      },
      {
        enemyId: "BlitzGreymon",
        name: "Blitz Greymon",
        attribute: "Virus",
        power: 160,
        isBoss: false,
      },
      {
        enemyId: "OmegamonAlterS",
        name: "Omegamon Alter-S",
        attribute: "Virus",
        power: 220,
        isBoss: true,
      },
    ],
  },
];

/**
 * Area ID로 퀘스트 데이터 찾기
 * 
 * @param {string} areaId - Area ID (예: "area1", "areaF")
 * @returns {QuestArea|null} 퀘스트 Area 데이터 또는 null
 */
export function getQuestArea(areaId) {
  return quests.find(area => area.areaId === areaId) || null;
}

/**
 * Area의 특정 Round(적) 데이터 가져오기
 * 
 * @param {string} areaId - Area ID
 * @param {number} roundIndex - Round 인덱스 (0부터 시작)
 * @returns {QuestEnemy|null} 적 데이터 또는 null
 */
export function getQuestEnemy(areaId, roundIndex) {
  const area = getQuestArea(areaId);
  if (!area || roundIndex < 0 || roundIndex >= area.enemies.length) {
    return null;
  }
  return area.enemies[roundIndex];
}

