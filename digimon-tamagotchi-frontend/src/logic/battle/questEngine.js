// src/logic/battle/questEngine.js
// Digital Monster Color Ver.1 퀘스트 모드 엔진

import { simulateBattle } from './calculator';
import { getQuestEnemy, getQuestArea } from '../../data/v1/quests';
import { digimonDataVer1 } from '../../data/v1/digimons';

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
 * @returns {Object} 배틀 결과
 * @returns {boolean} returns.win - 승리 여부
 * @returns {Array} returns.logs - 배틀 로그 배열
 * @returns {Object} returns.enemy - 적 정보 { name, power, attribute, isBoss }
 * @returns {boolean} returns.isAreaClear - Area 클리어 여부
 * @returns {string|null} returns.reward - 보상 (Area 클리어 시)
 */
export function playQuestRound(userDigimon, userStats, areaId, roundIndex) {
  // 퀘스트 적 데이터 가져오기
  const questEnemy = getQuestEnemy(areaId, roundIndex);
  if (!questEnemy) {
    throw new Error(`Invalid quest: areaId=${areaId}, roundIndex=${roundIndex}`);
  }

  // 적 디지몬 데이터 가져오기 (digimons.js에서)
  // enemyId가 없으면 이름 문자열을 사용
  let enemyDigimon = digimonDataVer1[questEnemy.enemyId];
  
  // 디지몬 데이터가 없으면 기본 구조 생성
  if (!enemyDigimon) {
    enemyDigimon = {
      id: questEnemy.enemyId,
      name: questEnemy.name,
      stage: "Unknown",
      sprite: 0,
      stats: {
        basePower: questEnemy.power, // 퀘스트 파워 사용
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

  // 적 스탯 생성 (퀘스트 파워를 강제로 적용)
  const enemyStats = {
    power: questEnemy.power, // 중요: 도감 값이 아닌 퀘스트 데이터의 power 사용
    type: questEnemy.attribute,
    strength: 0,
    fullness: 0,
    energy: 0,
  };

  // 배틀 시뮬레이션 실행
  const battleResult = simulateBattle(
    userDigimon,
    userStats,
    enemyDigimon,
    enemyStats,
    userDigimon.name || userDigimon.id || "User",
    questEnemy.name || "CPU"
  );

  // Area 클리어 여부 확인
  const area = getQuestArea(areaId);
  const isLastRound = roundIndex === area.enemies.length - 1;
  const isAreaClear = battleResult.won && isLastRound;

  // 보상 결정 (Area 클리어 시)
  let reward = null;
  if (isAreaClear) {
    // Area 클리어 보상 (향후 확장 가능)
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
  };
}

/**
 * Area의 모든 라운드를 순차적으로 플레이
 * 
 * @param {Object} userDigimon - 유저 디지몬 데이터
 * @param {Object} userStats - 유저 디지몬 스탯
 * @param {string} areaId - Area ID
 * @returns {Object} 전체 Area 플레이 결과
 */
export function playQuestArea(userDigimon, userStats, areaId) {
  const area = getQuestArea(areaId);
  if (!area) {
    throw new Error(`Invalid areaId: ${areaId}`);
  }

  const results = [];
  let allWon = true;

  // 각 라운드를 순차적으로 플레이
  for (let i = 0; i < area.enemies.length; i++) {
    const result = playQuestRound(userDigimon, userStats, areaId, i);
    results.push(result);

    // 한 번이라도 패배하면 중단
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

