// src/data/train_digitalmonstercolor25th_ver1.js

/**
 * Ver.1 훈련 결과 계산
 * partialResults: 5라운드 {round, attack, defend, isHit}
 * 
 * Ver.1 스펙:
 * - 5번 중 3번 이상 성공 시 → Strength +1 (훈련 성공)
 * - 3번 미만 성공 시 → Strength 안 오름 (훈련 실패)
 * - 결과와 상관없이 Weight -2g, Energy(DP) -1 소모
 * - 훈련 횟수(trainings)는 성공/실패 무관하게 +1
 */
export function doVer1Training(digimonStats, partialResults) {
    const hits = partialResults.filter((r) => r.isHit).length;
    const fails = partialResults.length - hits; // 보통 5 - hits
  
    // Ver.1 스펙: 5번 중 3번 이상 성공 시 훈련 성공
    const isSuccess = hits >= 3;
  
    // message
    let message = "";
    if (isSuccess) {
      message = "< 좋은 훈련이었다! >";
    } else {
      message = "< X!꽝!X >";
    }
  
    // stat update
    let s = { ...digimonStats };
  
    // 체중 -2g (결과와 상관없이)
    s.weight = Math.max(0, (s.weight || 0) - 2);
  
    // Energy(DP) -1 (결과와 상관없이)
    s.energy = Math.max(0, (s.energy || 0) - 1);
  
    // Strength +1 (성공 시만)
    if (isSuccess) {
      s.strength = Math.min(5, (s.strength || 0) + 1);
    }
  
    // 훈련 횟수++ (성공/실패 무관하게)
    s.trainings = (s.trainings || 0) + 1;
  
    // 4회마다 effort+1 (trainings 기준)
    if (s.trainings % 4 === 0) {
      s.effort = Math.min(5, (s.effort || 0) + 1);
    }
  
    // 최종 결과 리턴
    return {
      updatedStats: s,
      hits,
      fails,
      message,
      isSuccess,
      roundResults: partialResults,
    };
  }