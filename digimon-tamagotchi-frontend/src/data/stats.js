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
  // birthTime 이어받기 (없으면 현재 시간으로 설정)
  // 진화 시에는 birthTime을 유지 (나이 계속 증가)
  merged.birthTime = oldStats.birthTime || Date.now();

  // ★ 추가: strength, effort 이어받기
  merged.strength = (oldStats.strength!==undefined)
    ? oldStats.strength
    : merged.strength;

  merged.effort   = (oldStats.effort!==undefined)
    ? oldStats.effort
    : merged.effort;

  // ★ trainings는 새 디지몬 생성(진화) 시 무조건 0
  merged.trainings = 0;

  // 매뉴얼 기반 필드 초기화 (진화 시 리셋되는 필드)
  merged.overfeeds = 0;
  merged.consecutiveMeatFed = 0; // 오버피드 연속 카운트도 리셋
  merged.proteinCount = 0; // 단백질 누적 개수 리셋
  merged.proteinOverdose = 0; // 단백질 과다 리셋
  merged.battlesForEvolution = 0;
  merged.careMistakes = 0;
  merged.injuries = 0; // 부상 횟수 리셋
  merged.isInjured = false; // 부상 상태 리셋
  merged.injuredAt = null; // 부상 시간 리셋
  merged.healedDosesCurrent = 0; // 치료제 횟수 리셋
  // 호출 상태 초기화 (진화 시 리셋)
  merged.callStatus = {
    hunger: { isActive: false, startedAt: null },
    strength: { isActive: false, startedAt: null },
    sleep: { isActive: false, startedAt: null }
  };
  
  // 매뉴얼 기반 필드 초기화 (진화 시 유지되는 필드)
  merged.energy = oldStats.energy !== undefined ? oldStats.energy : (merged.energy || 0);
  merged.battles = oldStats.battles !== undefined ? oldStats.battles : (merged.battles || 0);
  merged.battlesWon = oldStats.battlesWon !== undefined ? oldStats.battlesWon : (merged.battlesWon || 0);
  merged.battlesLost = oldStats.battlesLost !== undefined ? oldStats.battlesLost : (merged.battlesLost || 0);
  merged.winRate = oldStats.winRate !== undefined ? oldStats.winRate : (merged.winRate || 0);

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

  // 배고픔/힘 감소 로직은 handleHungerTick, handleStrengthTick으로 이동
  // 이 함수는 lifespanSeconds, timeToEvolveSeconds, poop만 처리

  // hunger=0 => 12h->사망 (이 로직은 handleHungerTick에서 처리하지만, 여기서도 체크)
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
  
  // 나이 계산 (경과 시간 기반)
  if (updatedStats.birthTime) {
    const birthTime = typeof updatedStats.birthTime === 'number' 
      ? updatedStats.birthTime 
      : new Date(updatedStats.birthTime).getTime();
    const ageInDays = Math.floor((now.getTime() - birthTime) / (24 * 60 * 60 * 1000));
    updatedStats.age = Math.max(0, ageInDays);
  } else {
    // birthTime이 없으면 현재 시간으로 설정하고 age는 0
    updatedStats.birthTime = now.getTime();
    updatedStats.age = 0;
  }
  
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

  // 힘 감소 처리
  if (updatedStats.strengthTimer > 0) {
    updatedStats.strengthCountdown -= elapsedSeconds;
    
    // countdown이 0 이하가 되면 strength 감소
    while (updatedStats.strengthCountdown <= 0) {
      updatedStats.strength = Math.max(0, updatedStats.strength - 1);
      updatedStats.strengthCountdown += updatedStats.strengthTimer * 60;
      
      // strength가 0이 되면 lastStrengthZeroAt 기록
      if (updatedStats.strength === 0 && !updatedStats.lastStrengthZeroAt) {
        const timeToZero = lastSaved.getTime() + (elapsedSeconds - updatedStats.strengthCountdown) * 1000;
        updatedStats.lastStrengthZeroAt = timeToZero;
      }
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
            // 똥 8개가 되면 부상 상태로 설정
            if (!updatedStats.isInjured) {
              // 처음 부상 발생 시에만 injuries 증가 및 시간 기록
              updatedStats.isInjured = true;
              updatedStats.injuredAt = timeToMax;
              updatedStats.injuries = (updatedStats.injuries || 0) + 1;
              updatedStats.healedDosesCurrent = 0; // 치료제 횟수 리셋
            }
          } else {
            // 이미 8개였고, 계속 8개 이상이면 부상 상태 유지
            if (updatedStats.poopCount >= 8 && !updatedStats.isInjured) {
              updatedStats.isInjured = true;
              updatedStats.injuredAt = now.getTime();
              updatedStats.injuries = (updatedStats.injuries || 0) + 1;
              updatedStats.healedDosesCurrent = 0; // 치료제 횟수 리셋
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

  // 힘이 0이고 12시간(43200초) 경과 시 사망
  if (updatedStats.strength === 0 && updatedStats.lastStrengthZeroAt) {
    const strengthZeroTime = typeof updatedStats.lastStrengthZeroAt === 'number'
      ? updatedStats.lastStrengthZeroAt
      : new Date(updatedStats.lastStrengthZeroAt).getTime();
    const elapsedSinceZero = (now.getTime() - strengthZeroTime) / 1000;
    
    if (elapsedSinceZero >= 43200) {
      updatedStats.isDead = true;
    }
  } else if (updatedStats.strength > 0) {
    // 힘이 다시 채워지면 리셋
    updatedStats.lastStrengthZeroAt = null;
  }

  // 부상 과다 사망 체크: injuries >= 15
  if ((updatedStats.injuries || 0) >= 15 && !updatedStats.isDead) {
    updatedStats.isDead = true;
  }

  // 부상 방치 사망 체크: isInjured 상태이고 6시간(21600000ms) 경과
  if (updatedStats.isInjured && updatedStats.injuredAt && !updatedStats.isDead) {
    const injuredTime = typeof updatedStats.injuredAt === 'number'
      ? updatedStats.injuredAt
      : new Date(updatedStats.injuredAt).getTime();
    const elapsedSinceInjury = now.getTime() - injuredTime;
    
    if (elapsedSinceInjury >= 21600000) { // 6시간 = 21600000ms
      updatedStats.isDead = true;
    }
  }

  // 호출(Call) 시스템 처리 (Lazy Update)
  // callStatus 초기화 (없으면 생성)
  if (!updatedStats.callStatus) {
    updatedStats.callStatus = {
      hunger: { isActive: false, startedAt: null },
      strength: { isActive: false, startedAt: null },
      sleep: { isActive: false, startedAt: null }
    };
  }

  const callStatus = updatedStats.callStatus;
  const HUNGER_CALL_TIMEOUT = 10 * 60 * 1000; // 10분
  const STRENGTH_CALL_TIMEOUT = 10 * 60 * 1000; // 10분
  const SLEEP_CALL_TIMEOUT = 60 * 60 * 1000; // 60분

  // Hunger 호출 처리
  if (updatedStats.fullness === 0) {
    // 배고픔이 0이면 호출 활성화 (아직 활성화되지 않은 경우)
    if (!callStatus.hunger.isActive && updatedStats.lastHungerZeroAt) {
      // lastHungerZeroAt 시점에 호출 시작
      const hungerZeroTime = typeof updatedStats.lastHungerZeroAt === 'number'
        ? updatedStats.lastHungerZeroAt
        : new Date(updatedStats.lastHungerZeroAt).getTime();
      callStatus.hunger.isActive = true;
      callStatus.hunger.startedAt = hungerZeroTime;
    }
    
    // 호출이 활성화되어 있고 타임아웃 경과 시 careMistakes 증가
    if (callStatus.hunger.isActive && callStatus.hunger.startedAt) {
      const startedAt = typeof callStatus.hunger.startedAt === 'number'
        ? callStatus.hunger.startedAt
        : new Date(callStatus.hunger.startedAt).getTime();
      const elapsed = now.getTime() - startedAt;
      
      if (elapsed > HUNGER_CALL_TIMEOUT) {
        // 10분 경과 시 careMistakes +1
        updatedStats.careMistakes = (updatedStats.careMistakes || 0) + 1;
        
        // 추가 실수 계산: (방치시간) / (TimerCycle + 10분) 만큼 추가 실수
        if (updatedStats.hungerTimer > 0) {
          const timerCycleMs = updatedStats.hungerTimer * 60 * 1000;
          const additionalMistakes = Math.floor(elapsed / (timerCycleMs + HUNGER_CALL_TIMEOUT));
          updatedStats.careMistakes += additionalMistakes;
        }
        
        // 호출 리셋
        callStatus.hunger.isActive = false;
        callStatus.hunger.startedAt = null;
      }
    }
  } else {
    // 배고픔이 0이 아니면 호출 리셋
    callStatus.hunger.isActive = false;
    callStatus.hunger.startedAt = null;
  }

  // Strength 호출 처리
  if (updatedStats.strength === 0) {
    // 힘이 0이면 호출 활성화 (아직 활성화되지 않은 경우)
    if (!callStatus.strength.isActive && updatedStats.lastStrengthZeroAt) {
      // lastStrengthZeroAt 시점에 호출 시작
      const strengthZeroTime = typeof updatedStats.lastStrengthZeroAt === 'number'
        ? updatedStats.lastStrengthZeroAt
        : new Date(updatedStats.lastStrengthZeroAt).getTime();
      callStatus.strength.isActive = true;
      callStatus.strength.startedAt = strengthZeroTime;
    }
    
    // 호출이 활성화되어 있고 타임아웃 경과 시 careMistakes 증가
    if (callStatus.strength.isActive && callStatus.strength.startedAt) {
      const startedAt = typeof callStatus.strength.startedAt === 'number'
        ? callStatus.strength.startedAt
        : new Date(callStatus.strength.startedAt).getTime();
      const elapsed = now.getTime() - startedAt;
      
      if (elapsed > STRENGTH_CALL_TIMEOUT) {
        // 10분 경과 시 careMistakes +1
        updatedStats.careMistakes = (updatedStats.careMistakes || 0) + 1;
        
        // 추가 실수 계산: (방치시간) / (TimerCycle + 10분) 만큼 추가 실수
        if (updatedStats.strengthTimer > 0) {
          const timerCycleMs = updatedStats.strengthTimer * 60 * 1000;
          const additionalMistakes = Math.floor(elapsed / (timerCycleMs + STRENGTH_CALL_TIMEOUT));
          updatedStats.careMistakes += additionalMistakes;
        }
        
        // 호출 리셋
        callStatus.strength.isActive = false;
        callStatus.strength.startedAt = null;
      }
    }
  } else {
    // 힘이 0이 아니면 호출 리셋
    callStatus.strength.isActive = false;
    callStatus.strength.startedAt = null;
  }

  // Sleep 호출 처리 (수면 주기당 1회만)
  // 수면 호출은 실시간으로만 처리 (Lazy Update에서는 처리하지 않음)
  // 이유: 수면 호출은 수면 시간이 시작될 때 한 번만 발생해야 하므로

  // 나이 업데이트 (자정 경과 확인)
  updatedStats = updateAge(updatedStats);

  // 마지막 저장 시간 업데이트
  updatedStats.lastSavedAt = now;

  return updatedStats;
}