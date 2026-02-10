// src/data/v2modkor/quests.js
// Digital Monster Color Ver.2 퀘스트 모드 데이터 (v1과 동일 구조)

/**
 * @typedef {Object} QuestEnemy
 * @property {string} enemyId - 디지몬 ID
 * @property {string} name - 디지몬 이름
 * @property {string} attribute - 속성 (Vaccine, Data, Virus, Free)
 * @property {number} power - 파워
 * @property {boolean} isBoss - 보스 여부
 */

/**
 * @typedef {Object} QuestArea
 * @property {string} areaId
 * @property {string} areaName
 * @property {string|null} unlockCondition
 * @property {Array<QuestEnemy>} enemies
 */

// Ver.2 퀘스트: 제공 테이블 기준. 유키다루몬 = 프리지몬(Frigimon). name은 한글 표기.
// enemyId는 digimonDataVer2 키와 일치해야 스프라이트 표시됨.
export const questsVer2 = [
  { areaId: "area1", areaName: "Area 1", unlockCondition: "The Grid", enemies: [
    { enemyId: "Elecmon", name: "에렉몬", attribute: "Data", power: 15, isBoss: false },
    { enemyId: "Gabumon", name: "파피몬", attribute: "Data", power: 19, isBoss: false },
    { enemyId: "Frigimon", name: "프리지몬", attribute: "Vaccine", power: 23, isBoss: true },
  ]},
  { areaId: "area2", areaName: "Area 2", unlockCondition: null, enemies: [
    { enemyId: "Vegiemon", name: "베지몬", attribute: "Virus", power: 19, isBoss: false },
    { enemyId: "Whamon", name: "고래몬", attribute: "Vaccine", power: 23, isBoss: false },
    { enemyId: "Angemon", name: "엔젤몬", attribute: "Vaccine", power: 28, isBoss: true },
  ]},
  { areaId: "area3", areaName: "Area 3", unlockCondition: null, enemies: [
    { enemyId: "Garurumon", name: "가루몬", attribute: "Vaccine", power: 28, isBoss: false },
    { enemyId: "Birdramon", name: "버드라몬", attribute: "Vaccine", power: 37, isBoss: false },
    { enemyId: "Kabuterimon", name: "캅테리몬", attribute: "Vaccine", power: 45, isBoss: true },
  ]},
  { areaId: "area4", areaName: "Area 4", unlockCondition: "DMC Logo", enemies: [
    { enemyId: "Whamon", name: "고래몬", attribute: "Vaccine", power: 45, isBoss: false },
    { enemyId: "Frigimon", name: "프리지몬", attribute: "Vaccine", power: 55, isBoss: false },
    { enemyId: "Angemon", name: "엔젤몬", attribute: "Vaccine", power: 65, isBoss: false },
    { enemyId: "MetalMammemon", name: "메탈콩알몬", attribute: "Data", power: 80, isBoss: true },
  ]},
  { areaId: "area5", areaName: "Area 5", unlockCondition: null, enemies: [
    { enemyId: "Birdramon", name: "버드라몬", attribute: "Vaccine", power: 55, isBoss: false },
    { enemyId: "Garurumon", name: "가루몬", attribute: "Vaccine", power: 70, isBoss: false },
    { enemyId: "Kabuterimon", name: "캅테리몬", attribute: "Vaccine", power: 85, isBoss: false },
    { enemyId: "SkullGreymon", name: "스컬그레이몬", attribute: "Virus", power: 105, isBoss: true },
  ]},
  { areaId: "area6", areaName: "Area 6", unlockCondition: null, enemies: [
    { enemyId: "Frigimon", name: "프리지몬", attribute: "Vaccine", power: 65, isBoss: false },
    { enemyId: "MetalMammemon", name: "메탈콩알몬", attribute: "Data", power: 80, isBoss: false },
    { enemyId: "Vademon", name: "베이더몬", attribute: "Virus", power: 95, isBoss: false },
    { enemyId: "CresGarurumonV2", name: "크레스가루몬", attribute: "Data", power: 120, isBoss: true },
  ]},
  { areaId: "area7", areaName: "Area 7", unlockCondition: null, enemies: [
    { enemyId: "Vegiemon", name: "베지몬", attribute: "Virus", power: 75, isBoss: false },
    { enemyId: "SkullGreymon", name: "스컬그레이몬", attribute: "Virus", power: 90, isBoss: false },
    { enemyId: "Vademon", name: "베이더몬", attribute: "Virus", power: 110, isBoss: false },
    { enemyId: "SkullMammon", name: "스컬맘몬", attribute: "Vaccine", power: 130, isBoss: false },
    { enemyId: "Ebemon", name: "이바몬", attribute: "Virus", power: 145, isBoss: true },
  ]},
  { areaId: "areaF", areaName: "Area F (Final)", unlockCondition: "Box Art", enemies: [
    { enemyId: "SkullGreymon", name: "스컬그레이몬", attribute: "Virus", power: 85, isBoss: false },
    { enemyId: "SkullMammon", name: "스컬맘몬", attribute: "Vaccine", power: 100, isBoss: false },
    { enemyId: "Ebemon", name: "이바몬", attribute: "Virus", power: 135, isBoss: false },
    { enemyId: "CresGarurumonV2", name: "크레스가루몬", attribute: "Data", power: 160, isBoss: false },
    { enemyId: "OmegamonAlterSV2", name: "오메가몬 Alter-S", attribute: "Virus", power: 220, isBoss: true },
  ]},
];

export function getQuestAreaVer2(areaId) {
  return questsVer2.find(area => area.areaId === areaId) || null;
}

export function getQuestEnemyVer2(areaId, roundIndex) {
  const area = getQuestAreaVer2(areaId);
  if (!area || roundIndex < 0 || roundIndex >= area.enemies.length) return null;
  return area.enemies[roundIndex];
}
