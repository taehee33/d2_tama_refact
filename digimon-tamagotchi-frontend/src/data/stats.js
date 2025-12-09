// src/data/stats.js
import { defaultStats } from "./defaultStatsFile"; 

export function initializeStats(digiName, oldStats={}, dataMap={}){
  if(!dataMap[digiName]){
    console.error(`initializeStats: [${digiName}] not found in dataMap!`);
    digiName= "Digitama"; // fallback
  }
  const custom = dataMap[digiName] || {};
  
  let merged= { ...defaultStats, ...custom };

  // 기존 이어받기 (나이, 체중, 수명)
  merged.age = oldStats.age || merged.age;
  merged.weight = oldStats.weight || merged.weight;
  merged.lifespanSeconds= oldStats.lifespanSeconds || merged.lifespanSeconds;

  // ★ 추가: strength, effort 이어받기
  merged.strength = (oldStats.strength!==undefined)
    ? oldStats.strength
    : merged.strength;

  merged.effort   = (oldStats.effort!==undefined)
    ? oldStats.effort
    : merged.effort;

  // ★ trainingCount는 새 디지몬 생성(진화) 시 무조건 0
  merged.trainingCount = 0;

  // 타이머 계산
  merged.hungerCountdown   = merged.hungerTimer   * 60;
  merged.strengthCountdown = merged.strengthTimer * 60;

  // poop 관련
  merged.poopCount = (oldStats.poopCount !== undefined)
    ? oldStats.poopCount
    : 0;
  merged.poopTimer = merged.poopTimer || 0; 
  merged.poopCountdown = (oldStats.poopCountdown !== undefined)
    ? oldStats.poopCountdown
    : (merged.poopTimer * 60);

  merged.lastMaxPoopTime = oldStats.lastMaxPoopTime || null;

  return merged;
}

export function updateLifespan(stats, deltaSec=1){
  if(stats.isDead) return stats;

  const s= { ...stats };
  s.lifespanSeconds += deltaSec;
  s.timeToEvolveSeconds= Math.max(0, s.timeToEvolveSeconds - deltaSec);

  // fullness--
  if(s.hungerTimer>0){
    s.hungerCountdown -= deltaSec;
    if(s.hungerCountdown<=0){
      s.fullness= Math.max(0, s.fullness-1);
      s.hungerCountdown= s.hungerTimer*60;
      if(s.fullness===0 && !s.lastHungerZeroAt){
        s.lastHungerZeroAt= Date.now();
      }
    }
  }
  // health--
  if(s.strengthTimer>0){
    s.strengthCountdown -= deltaSec;
    if(s.strengthCountdown<=0){
      s.health= Math.max(0, s.health-1);
      s.strengthCountdown= s.strengthTimer*60;
    }
  }

  // hunger=0 => 12h->사망
  if(s.fullness>0){
    s.lastHungerZeroAt= null;
  } else if(s.fullness===0 && s.lastHungerZeroAt){
    const elapsed= (Date.now()- s.lastHungerZeroAt)/1000;
    if(elapsed>=43200){
      s.isDead= true;
    }
  }

  // ★ (3) poop 로직
  if(s.poopTimer>0){
    s.poopCountdown -= deltaSec;
    if(s.poopCountdown <= 0){
      if(s.poopCount < 8){
        s.poopCount++;
        s.poopCountdown = s.poopTimer*60;

        // ★ 추가: 8이 딱 되었으면 그 순간 lastMaxPoopTime 기록
        if(s.poopCount === 8 && !s.lastMaxPoopTime){
          s.lastMaxPoopTime = Date.now();
        }
      } else {
        // 이미 8 이상
        if(!s.lastMaxPoopTime){
          // 아직 기록 안된 경우
          s.lastMaxPoopTime = Date.now();
        } else {
          // 기록되어 있고, 8시간(28800초) 지났다면 careMistakes++
          const e = (Date.now() - s.lastMaxPoopTime)/1000;
          if(e >= 28800){
            s.careMistakes++;
            s.lastMaxPoopTime = Date.now(); // 다시 리셋
          }
        }
        s.poopCountdown = s.poopTimer*60;
      }
    }
  }


  return s;
}

export function updateAge(stats){
  const now= new Date();
  if(now.getHours()===0 && now.getMinutes()===0){
    return { ...stats, age: stats.age+1 };
  }
  return stats;
}

/**
 * Lazy Update: 마지막 저장 시간부터 현재까지 경과한 시간을 계산하여
 * 스탯(배고픔, 수명 등)을 한 번에 차감
 * 
 * @param {Object} stats - 현재 디지몬 스탯
 * @param {Date|number|string} lastSavedAt - 마지막 저장 시간 (Date, timestamp, 또는 ISO string)
 * @returns {Object} 업데이트된 스탯
 */
export function applyLazyUpdate(stats, lastSavedAt) {
  if (!lastSavedAt) {
    // 마지막 저장 시간이 없으면 현재 시간으로 설정
    return { ...stats, lastSavedAt: new Date() };
  }

  // 마지막 저장 시간을 Date 객체로 변환
  let lastSaved;
  if (lastSavedAt instanceof Date) {
    lastSaved = lastSavedAt;
  } else if (typeof lastSavedAt === 'number') {
    lastSaved = new Date(lastSavedAt);
  } else if (typeof lastSavedAt === 'string') {
    lastSaved = new Date(lastSavedAt);
  } else if (lastSavedAt.toDate) {
    // Firestore Timestamp인 경우
    lastSaved = lastSavedAt.toDate();
  } else {
    // 알 수 없는 형식이면 현재 시간으로 설정
    return { ...stats, lastSavedAt: new Date() };
  }

  const now = new Date();
  const elapsedSeconds = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);

  // 경과 시간이 없거나 음수면 그대로 반환
  if (elapsedSeconds <= 0) {
    return { ...stats, lastSavedAt: now };
  }

  // 사망한 경우 더 이상 업데이트하지 않음
  if (stats.isDead) {
    return { ...stats, lastSavedAt: now };
  }

  // 경과 시간만큼 한 번에 업데이트
  let updatedStats = { ...stats };
  
  // updateLifespan을 경과 시간만큼 호출
  // 하지만 한 번에 처리하는 것이 더 효율적이므로 직접 계산
  updatedStats.lifespanSeconds += elapsedSeconds;
  updatedStats.timeToEvolveSeconds = Math.max(0, updatedStats.timeToEvolveSeconds - elapsedSeconds);

  // 배고픔 감소 처리
  if (updatedStats.hungerTimer > 0) {
    updatedStats.hungerCountdown -= elapsedSeconds;
    
    // countdown이 0 이하가 되면 fullness 감소
    while (updatedStats.hungerCountdown <= 0) {
      updatedStats.fullness = Math.max(0, updatedStats.fullness - 1);
      updatedStats.hungerCountdown += updatedStats.hungerTimer * 60;
      
      // fullness가 0이 되면 lastHungerZeroAt 기록
      if (updatedStats.fullness === 0 && !updatedStats.lastHungerZeroAt) {
        // 마지막 저장 시간부터 fullness가 0이 된 시점 계산
        const timeToZero = lastSaved.getTime() + (elapsedSeconds - updatedStats.hungerCountdown) * 1000;
        updatedStats.lastHungerZeroAt = timeToZero;
      }
    }
  }

  // 건강 감소 처리
  if (updatedStats.strengthTimer > 0) {
    updatedStats.strengthCountdown -= elapsedSeconds;
    
    // countdown이 0 이하가 되면 health 감소
    while (updatedStats.strengthCountdown <= 0) {
      updatedStats.health = Math.max(0, updatedStats.health - 1);
      updatedStats.strengthCountdown += updatedStats.strengthTimer * 60;
    }
  }

  // 배변 처리
  if (updatedStats.poopTimer > 0) {
    updatedStats.poopCountdown -= elapsedSeconds;
    
    while (updatedStats.poopCountdown <= 0) {
      if (updatedStats.poopCount < 8) {
        updatedStats.poopCount++;
        updatedStats.poopCountdown += updatedStats.poopTimer * 60;
        
        // 8개가 되면 lastMaxPoopTime 기록
        if (updatedStats.poopCount === 8 && !updatedStats.lastMaxPoopTime) {
          const timeToMax = lastSaved.getTime() + (elapsedSeconds - updatedStats.poopCountdown) * 1000;
          updatedStats.lastMaxPoopTime = timeToMax;
        }
      } else {
        // 이미 8개 이상
        if (!updatedStats.lastMaxPoopTime) {
          const timeToMax = lastSaved.getTime() + (elapsedSeconds - updatedStats.poopCountdown) * 1000;
          updatedStats.lastMaxPoopTime = timeToMax;
        } else {
          // 8시간(28800초) 경과 확인
          const lastMaxTime = typeof updatedStats.lastMaxPoopTime === 'number' 
            ? updatedStats.lastMaxPoopTime 
            : new Date(updatedStats.lastMaxPoopTime).getTime();
          const elapsedSinceMax = (now.getTime() - lastMaxTime) / 1000;
          
          if (elapsedSinceMax >= 28800) {
            updatedStats.careMistakes++;
            updatedStats.lastMaxPoopTime = now.getTime();
          }
        }
        updatedStats.poopCountdown += updatedStats.poopTimer * 60;
      }
    }
  }

  // 배고픔이 0이고 12시간(43200초) 경과 시 사망
  if (updatedStats.fullness === 0 && updatedStats.lastHungerZeroAt) {
    const hungerZeroTime = typeof updatedStats.lastHungerZeroAt === 'number'
      ? updatedStats.lastHungerZeroAt
      : new Date(updatedStats.lastHungerZeroAt).getTime();
    const elapsedSinceZero = (now.getTime() - hungerZeroTime) / 1000;
    
    if (elapsedSinceZero >= 43200) {
      updatedStats.isDead = true;
    }
  } else if (updatedStats.fullness > 0) {
    // 배고픔이 다시 채워지면 리셋
    updatedStats.lastHungerZeroAt = null;
  }

  // 나이 업데이트 (자정 경과 확인)
  updatedStats = updateAge(updatedStats);

  // 마지막 저장 시간 업데이트
  updatedStats.lastSavedAt = now;

  return updatedStats;
}