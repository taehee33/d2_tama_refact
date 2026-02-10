// src/logic/battle/questEngine.js
// Digital Monster Color Ver.1 / Ver.2 퀘스트 모드 엔진

import { simulateBattle } from './calculator';
import { getQuestEnemy, getQuestArea } from '../../data/v1/quests';
import { getQuestEnemyVer2, getQuestAreaVer2 } from '../../data/v2modkor/quests';
import { digimonDataVer1 } from '../../data/v1/digimons';
import { digimonDataVer2 } from '../../data/v2modkor';

/**
 * 퀘스트 라운드 플레이
 * 지정된 Area와 Round의 적과 배틀을 수행합니다.
 *
 * 중요: 적의 power는 퀘스트 데이터의 값을 사용하며, 도감 값은 무시됩니다.
 *
 * @param {Object} userDigimon - 유저 디지몬 데이터 (digimons.js 형식)
 * @param {Object} userStats - 유저 디지몬 스탯
 * @param {string} areaId - Area ID (예: "area1", "areaF")
 * @param {number} roundIndex - Round 인덱스 (0부터 시작)
 * @param {string} [version="Ver.1"] - 퀘스트 버전 ("Ver.1" | "Ver.2")
 * @returns {Object} 배틀 결과
 * @returns {boolean} returns.win - 승리 여부
 * @returns {Array} returns.logs - 배틀 로그 배열
 * @returns {Object} returns.enemy - 적 정보 { name, power, attribute, isBoss }
 * @returns {boolean} returns.isAreaClear - Area 클리어 여부
 * @returns {string|null} returns.reward - 보상 (Area 클리어 시)
 */
export function playQuestRound(userDigimon, userStats, areaId, roundIndex, version = "Ver.1") {
  const isVer2 = version === "Ver.2";
  const getEnemy = isVer2 ? getQuestEnemyVer2 : getQuestEnemy;
  const getArea = isVer2 ? getQuestAreaVer2 : getQuestArea;
  const digimonData = isVer2 ? digimonDataVer2 : digimonDataVer1;

  const questEnemy = getEnemy(areaId, roundIndex);
  if (!questEnemy) {
    throw new Error(`Invalid quest: areaId=${areaId}, roundIndex=${roundIndex}, version=${version}`);
  }

  let enemyDigimon = digimonData[questEnemy.enemyId];

  if (!enemyDigimon) {
    enemyDigimon = {
      id: questEnemy.enemyId,
      name: questEnemy.name,
      stage: "Unknown",
      sprite: 0,
      spriteBasePath: isVer2 ? "/Ver2_Mod_Kor" : undefined,
      stats: {
        basePower: questEnemy.power,
        type: questEnemy.attribute,
        hungerCycle: 0,
        strengthCycle: 0,
        poopCycle: 120,
        maxOverfeed: 0,
        maxEnergy: 0,
        minWeight: 0,
        sleepTime: null,
      },
    };
  }

  const enemyStats = {
    power: questEnemy.power,
    type: questEnemy.attribute,
    strength: 0,
    fullness: 0,
    energy: 0,
  };

  const battleResult = simulateBattle(
    userDigimon,
    userStats,
    enemyDigimon,
    enemyStats,
    userDigimon.name || userDigimon.id || "User",
    questEnemy.name || "CPU"
  );

  const area = getArea(areaId);
  const isLastRound = roundIndex === area.enemies.length - 1;
  const isAreaClear = battleResult.won && isLastRound;

  let reward = null;
  if (isAreaClear) {
    reward = `Area ${area.areaName} 클리어!`;
  }

  return {
    win: battleResult.won,
    logs: battleResult.log,
    enemy: {
      name: questEnemy.name,
      power: questEnemy.power,
      attribute: questEnemy.attribute,
      isBoss: questEnemy.isBoss,
    },
    isAreaClear,
    reward,
    rounds: battleResult.rounds,
    userHits: battleResult.userHits,
    enemyHits: battleResult.enemyHits,
    userPower: battleResult.userPower,
    userPowerDetails: battleResult.userPowerDetails,
  };
}

/**
 * Area의 모든 라운드를 순차적으로 플레이
 *
 * @param {Object} userDigimon - 유저 디지몬 데이터
 * @param {Object} userStats - 유저 디지몬 스탯
 * @param {string} areaId - Area ID
 * @param {string} [version="Ver.1"] - 퀘스트 버전 ("Ver.1" | "Ver.2")
 * @returns {Object} 전체 Area 플레이 결과
 */
export function playQuestArea(userDigimon, userStats, areaId, version = "Ver.1") {
  const isVer2 = version === "Ver.2";
  const getArea = isVer2 ? getQuestAreaVer2 : getQuestArea;
  const area = getArea(areaId);
  if (!area) {
    throw new Error(`Invalid areaId: ${areaId}`);
  }

  const results = [];
  let allWon = true;

  for (let i = 0; i < area.enemies.length; i++) {
    const result = playQuestRound(userDigimon, userStats, areaId, i, version);
    results.push(result);
    if (!result.win) {
      allWon = false;
      break;
    }
  }

  return {
    areaId,
    areaName: area.areaName,
    cleared: allWon && results.length === area.enemies.length,
    results,
    totalRounds: results.reduce((sum, r) => sum + r.rounds, 0),
  };
}

