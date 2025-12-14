// src/logic/battle/calculator.js
// Digital Monster Color 매뉴얼 기반 배틀 계산기 및 시뮬레이터

import { getAttributeBonus } from './types';

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
export function simulateBattle(userDigimon, userStats, enemyDigimon, enemyStats) {
  const log = [];
  let userHits = 0; // 유저가 적에게 명중한 횟수
  let enemyHits = 0; // 적이 유저에게 명중한 횟수
  let rounds = 0;

  // 유저와 적의 파워 계산
  const userPower = userStats.power || userDigimon.stats?.basePower || 0;
  const enemyPower = enemyStats.power || enemyDigimon.stats?.basePower || 0;

  // 속성 보너스 계산
  const userAttr = userDigimon.stats?.type || userStats.type || null;
  const enemyAttr = enemyDigimon.stats?.type || enemyStats.type || null;
  
  const userAttrBonus = getAttributeBonus(userAttr, enemyAttr);
  const enemyAttrBonus = getAttributeBonus(enemyAttr, userAttr);

  // 히트레이트 계산
  const userHitRate = calculateHitRate(userPower, enemyPower, userAttrBonus);
  const enemyHitRate = calculateHitRate(enemyPower, userPower, enemyAttrBonus);

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
        message: `라운드 ${rounds}: 유저 공격 성공! (${userHits}/3)`,
      });
    } else {
      log.push({
        round: rounds,
        attacker: "user",
        defender: "enemy",
        hit: false,
        roll: userRoll.toFixed(2),
        hitRate: userHitRate.toFixed(2),
        message: `라운드 ${rounds}: 유저 공격 실패`,
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
        message: `라운드 ${rounds}: 적 공격 성공! (${enemyHits}/3)`,
      });
    } else {
      log.push({
        round: rounds,
        attacker: "enemy",
        defender: "user",
        hit: false,
        roll: enemyRoll.toFixed(2),
        hitRate: enemyHitRate.toFixed(2),
        message: `라운드 ${rounds}: 적 공격 실패`,
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
  };
}

