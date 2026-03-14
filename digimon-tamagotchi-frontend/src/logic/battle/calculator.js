// src/logic/battle/calculator.js
// Digital Monster Color 매뉴얼 기반 배틀 계산기 및 시뮬레이터

import { getAttributeBonus } from './types';
import { calculatePower } from './hitrate';

/**
 * 히트레이트 계산
 * 매뉴얼 공식: ((p1 * 100) / (p1 + p2)) + bonus
 * 
 * @param {number} attackerPower - 공격자 파워
 * @param {number} defenderPower - 방어자 파워
 * @param {number} attrBonus - 속성 보너스 (-5, 0, 또는 +5)
 * @returns {number} 히트레이트 (0~100 사이로 클램핑)
 */
export function calculateHitRate(attackerPower, defenderPower, attrBonus = 0) {
  // 분모가 0인 경우 처리
  const totalPower = attackerPower + defenderPower;
  if (totalPower === 0) {
    return 50; // 기본값 50%
  }

  // 기본 히트레이트 계산: (공격자 파워 * 100) / (공격자 파워 + 방어자 파워)
  const baseHitRate = (attackerPower * 100) / totalPower;

  // 속성 보너스 적용
  const hitRate = baseHitRate + attrBonus;

  // 0~100 사이로 클램핑
  return Math.max(0, Math.min(100, hitRate));
}

/**
 * 배틀 시뮬레이터
 * 두 디지몬의 데이터를 받아서 턴제 시뮬레이션을 수행
 * 
 * 규칙:
 * - 라운드마다 서로 한 번씩 공격
 * - 각 공격은 Math.random() * 100 < hitRate 여부로 명중 판정
 * - 먼저 3번 명중(Hits)시킨 쪽이 승리
 * 
 * @param {Object} userDigimon - 유저 디지몬 데이터
 * @param {Object} userStats - 유저 디지몬 스탯
 * @param {Object} enemyDigimon - 적 디지몬 데이터
 * @param {Object} enemyStats - 적 디지몬 스탯
 * @returns {Object} 배틀 결과
 * @returns {boolean} returns.won - 유저 승리 여부
 * @returns {number} returns.rounds - 총 라운드 수
 * @returns {Array} returns.log - 배틀 로그 (누가 때렸고 맞았는지 배열)
 */
export function simulateBattle(userDigimon, userStats, enemyDigimon, enemyStats, userName = "User", enemyName = "CPU") {
  const log = [];
  let userHits = 0; // 유저가 적에게 명중한 횟수
  let enemyHits = 0; // 적이 유저에게 명중한 횟수
  let rounds = 0;

  // 유저와 적의 파워 계산 (calculatePower 사용)
  const userPowerResult = calculatePower(userStats, userDigimon, true);
  const userPower = userPowerResult.power || userStats.power || userDigimon.stats?.basePower || 0;
  const userPowerDetails = userPowerResult.details || {
    basePower: userDigimon.stats?.basePower || 0,
    strengthBonus: 0,
    traitedEggBonus: 0,
    effortBonus: 0,
  };
  
  // 적의 파워는 stats.power가 있으면 사용, 없으면 basePower 사용
  const enemyPower = enemyStats.power || enemyDigimon.stats?.basePower || 0;
  const enemyPowerDetails = {
    basePower: enemyDigimon.stats?.basePower || 0,
    strengthBonus: 0,
    traitedEggBonus: 0,
    effortBonus: 0,
  };

  // 속성 보너스 계산
  const userAttr = userDigimon.stats?.type || userStats.type || null;
  const enemyAttr = enemyDigimon.stats?.type || enemyStats.type || null;
  
  const userAttrBonus = getAttributeBonus(userAttr, enemyAttr);
  const enemyAttrBonus = getAttributeBonus(enemyAttr, userAttr);

  // 히트레이트 계산
  const userHitRate = calculateHitRate(userPower, enemyPower, userAttrBonus);
  const enemyHitRate = calculateHitRate(enemyPower, userPower, enemyAttrBonus);
  
  // 계산 공식 문자열 생성
  const userFormula = `Hit Rate: ((${userPower} * 100) / (${userPower} + ${enemyPower})) + ${userAttrBonus} = ${userHitRate.toFixed(2)}%`;
  const enemyFormula = `Hit Rate: ((${enemyPower} * 100) / (${enemyPower} + ${userPower})) + ${enemyAttrBonus} = ${enemyHitRate.toFixed(2)}%`;

  // 배틀 진행 (최대 100라운드로 제한하여 무한 루프 방지)
  while (userHits < 3 && enemyHits < 3 && rounds < 100) {
    rounds++;

    // 유저 공격
    const userRoll = Math.random() * 100;
    const userHit = userRoll < userHitRate;
    
    if (userHit) {
      userHits++;
      log.push({
        round: rounds,
        attacker: "user",
        defender: "enemy",
        hit: true,
        roll: userRoll.toFixed(2),
        hitRate: userHitRate.toFixed(2),
        formula: userFormula,
        comparison: `Hit Rate(${userName}) ${userHitRate.toFixed(2)} > Roll(${userName}) ${userRoll.toFixed(2)} => HIT!! 💀`,
        message: `라운드 ${rounds}: ${userName} 공격 성공! (${userHits}/3)`,
      });
    } else {
      log.push({
        round: rounds,
        attacker: "user",
        defender: "enemy",
        hit: false,
        roll: userRoll.toFixed(2),
        hitRate: userHitRate.toFixed(2),
        formula: userFormula,
        comparison: `Hit Rate(${userName}) ${userHitRate.toFixed(2)} <= Roll(${userName}) ${userRoll.toFixed(2)} => MISS...`,
        message: `라운드 ${rounds}: ${userName} 공격 실패`,
      });
    }

    // 3번 명중하면 승리
    if (userHits >= 3) {
      break;
    }

    // 적 공격
    const enemyRoll = Math.random() * 100;
    const enemyHit = enemyRoll < enemyHitRate;
    
    if (enemyHit) {
      enemyHits++;
      log.push({
        round: rounds,
        attacker: "enemy",
        defender: "user",
        hit: true,
        roll: enemyRoll.toFixed(2),
        hitRate: enemyHitRate.toFixed(2),
        formula: enemyFormula,
        comparison: `Hit Rate(${enemyName}) ${enemyHitRate.toFixed(2)} > Roll(${enemyName}) ${enemyRoll.toFixed(2)} => HIT!! 💀`,
        message: `라운드 ${rounds}: ${enemyName} 공격 성공! (${enemyHits}/3)`,
      });
    } else {
      log.push({
        round: rounds,
        attacker: "enemy",
        defender: "user",
        hit: false,
        roll: enemyRoll.toFixed(2),
        hitRate: enemyHitRate.toFixed(2),
        formula: enemyFormula,
        comparison: `Hit Rate(${enemyName}) ${enemyHitRate.toFixed(2)} <= Roll(${enemyName}) ${enemyRoll.toFixed(2)} => MISS...`,
        message: `라운드 ${rounds}: ${enemyName} 공격 실패`,
      });
    }

    // 3번 명중하면 패배
    if (enemyHits >= 3) {
      break;
    }
  }

  // 승패 결정
  const won = userHits >= 3;

  return {
    won,
    rounds,
    log,
    userHits,
    enemyHits,
    userHitRate: userHitRate.toFixed(2),
    enemyHitRate: enemyHitRate.toFixed(2),
    userAttrBonus,
    enemyAttrBonus,
    userPower,
    enemyPower,
    userPowerDetails,
    enemyPowerDetails,
  };
}

/**
 * 시드 기반 의사난수 (실시간 PvP 동기화용)
 * @param {number} seed - 시드 값
 * @returns {number} 0 이상 1 미만
 */
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * 1라운드만 시뮬레이션 (실시간 배틀용, 시드로 동기화)
 * 유저 공격 → 적 공격 순서. 각각 hitRate로 명중 판정.
 *
 * @param {number} roundIndex - 라운드 번호 (시드 합성용)
 * @param {number} userPower - 유저 파워
 * @param {number} enemyPower - 적 파워
 * @param {number} userAttrBonus - 유저 속성 보너스
 * @param {number} enemyAttrBonus - 적 속성 보너스
 * @param {number} roomSeed - 방 시드
 * @param {string} userName - 유저 표시명
 * @param {string} enemyName - 적 표시명
 * @returns {{ userHit: boolean, enemyHit: boolean, userRoll: number, enemyRoll: number, userHitRate: number, enemyHitRate: number, logEntries: Array }}
 */
export function simulateOneRound(
  roundIndex,
  userPower,
  enemyPower,
  userAttrBonus,
  enemyAttrBonus,
  roomSeed,
  userName = "User",
  enemyName = "Enemy"
) {
  const userHitRate = calculateHitRate(userPower, enemyPower, userAttrBonus);
  const enemyHitRate = calculateHitRate(enemyPower, userPower, enemyAttrBonus);
  const userFormula = `Hit Rate: ((${userPower} * 100) / (${userPower} + ${enemyPower})) + ${userAttrBonus} = ${userHitRate.toFixed(2)}%`;
  const enemyFormula = `Hit Rate: ((${enemyPower} * 100) / (${enemyPower} + ${userPower})) + ${enemyAttrBonus} = ${enemyHitRate.toFixed(2)}%`;

  const seed1 = roomSeed + roundIndex * 1000 + 1;
  const seed2 = roomSeed + roundIndex * 1000 + 2;
  const userRoll = seededRandom(seed1) * 100;
  const enemyRoll = seededRandom(seed2) * 100;
  const userHit = userRoll < userHitRate;
  const enemyHit = enemyRoll < enemyHitRate;

  const logEntries = [];
  if (userHit) {
    logEntries.push({
      round: roundIndex,
      attacker: "user",
      defender: "enemy",
      hit: true,
      roll: userRoll.toFixed(2),
      hitRate: userHitRate.toFixed(2),
      formula: userFormula,
      comparison: `Hit Rate(${userName}) ${userHitRate.toFixed(2)} > Roll(${userName}) ${userRoll.toFixed(2)} => HIT!!`,
      message: `라운드 ${roundIndex}: ${userName} 공격 성공!`,
    });
  } else {
    logEntries.push({
      round: roundIndex,
      attacker: "user",
      defender: "enemy",
      hit: false,
      roll: userRoll.toFixed(2),
      hitRate: userHitRate.toFixed(2),
      formula: userFormula,
      comparison: `Hit Rate(${userName}) ${userHitRate.toFixed(2)} <= Roll(${userName}) ${userRoll.toFixed(2)} => MISS...`,
      message: `라운드 ${roundIndex}: ${userName} 공격 실패`,
    });
  }
  if (enemyHit) {
    logEntries.push({
      round: roundIndex,
      attacker: "enemy",
      defender: "user",
      hit: true,
      roll: enemyRoll.toFixed(2),
      hitRate: enemyHitRate.toFixed(2),
      formula: enemyFormula,
      comparison: `Hit Rate(${enemyName}) ${enemyHitRate.toFixed(2)} > Roll(${enemyName}) ${enemyRoll.toFixed(2)} => HIT!!`,
      message: `라운드 ${roundIndex}: ${enemyName} 공격 성공!`,
    });
  } else {
    logEntries.push({
      round: roundIndex,
      attacker: "enemy",
      defender: "user",
      hit: false,
      roll: enemyRoll.toFixed(2),
      hitRate: enemyHitRate.toFixed(2),
      formula: enemyFormula,
      comparison: `Hit Rate(${enemyName}) ${enemyHitRate.toFixed(2)} <= Roll(${enemyName}) ${enemyRoll.toFixed(2)} => MISS...`,
      message: `라운드 ${roundIndex}: ${enemyName} 공격 실패`,
    });
  }

  return {
    userHit,
    enemyHit,
    userRoll,
    enemyRoll,
    userHitRate,
    enemyHitRate,
    logEntries,
  };
}

/**
 * 부상 확률 계산
 * 매뉴얼: "you have a 20% chance of getting injured when you win, and a 10% chance when you lose."
 * "That 10% chance is increased by 10% for every Protein Overdose you have, for a maximum of 80%."
 * 
 * @param {boolean} won - 승리 여부
 * @param {number} proteinOverdose - 프로틴 과다 수치
 * @returns {number} 부상 확률 (0-100)
 */
export function calculateInjuryChance(won, proteinOverdose) {
  if (won) {
    return 20; // 승리 시 20%
  } else {
    // 패배 시 10% + (프로틴 과다 * 10%)
    return Math.min(80, 10 + (proteinOverdose || 0) * 10);
  }
}

