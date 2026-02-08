// src/data/stats.js
import { defaultStats } from "./defaultStatsFile";
import { calculateSleepSecondsInRange } from "../utils/sleepUtils";

/** 냉장고 구간을 제외한 경과 시간(ms). data/stats 내 applyLazyUpdate 8시간 부상/케어미스 판정용 */
function getElapsedTimeExcludingFridge(startTime, endTime, frozenAt = null, takeOutAt = null) {
  if (!frozenAt) return endTime - startTime;
  const frozenMs = typeof frozenAt === 'number' ? frozenAt : new Date(frozenAt).getTime();
  const takeOutMs = takeOutAt ? (typeof takeOutAt === 'number' ? takeOutAt : new Date(takeOutAt).getTime()) : endTime;
  if (frozenMs < startTime || frozenMs >= endTime) return endTime - startTime;
  const frozenDuration = takeOutMs - frozenMs;
  return Math.max(0, (endTime - startTime) - frozenDuration);
} 

export function initializeStats(digiName, oldStats={}, dataMap={}){
  if(!dataMap[digiName]){
    console.error(`initializeStats: [${digiName}] not found in dataMap!`);
    digiName= "Digitama"; // fallback
  }
  const custom = dataMap[digiName] || {};
  
  let merged= { ...defaultStats, ...custom };

  // 원본 v1 데이터(evolutionCriteria 내 timeToEvolveSeconds)를 쓰는 경로 대비: 진화까지 시간 반영
  if (merged.timeToEvolveSeconds === undefined || merged.timeToEvolveSeconds === 0) {
    const fromCriteria = custom.evolutionCriteria?.timeToEvolveSeconds;
    if (fromCriteria !== undefined && fromCriteria !== null) {
      merged.timeToEvolveSeconds = fromCriteria;
    }
  }

  // 새로운 시작(디지타마/디지타마V2 초기화)인지 확인
  const isNewStart = (digiName === "Digitama" || digiName === "DigitamaV2") && oldStats.totalReincarnations !== undefined;
  
  // 기존 이어받기 (나이, 수명)
  // 새로운 시작이면 age를 0으로, 그렇지 않으면 기존 값 유지
  if (isNewStart) {
    merged.age = 0;
    merged.birthTime = oldStats.birthTime || Date.now();
    merged.isDead = false; // 새로운 시작이면 항상 false
    // 새로운 시작: 사망 관련 필드 완전 초기화
    merged.lastHungerZeroAt = null;
    merged.lastStrengthZeroAt = null;
    merged.hungerMistakeDeadline = null;
    merged.strengthMistakeDeadline = null;
    merged.injuredAt = null;
    merged.isInjured = false;
    merged.injuries = 0;
    merged.deathReason = null; // 새로운 시작이면 deathReason 리셋
    // 새로운 시작: 기본 스탯 설정
    merged.fullness = 0;
    merged.strength = 0;
    // 새로운 시작: 똥 초기화
    merged.poopCount = 0;
    merged.lastMaxPoopTime = null;
  } else {
    merged.age = oldStats.age || merged.age;
    merged.birthTime = oldStats.birthTime || Date.now();
    // 진화 시에는 isDead를 명시적으로 false로 설정하지 않음 (기존 값 유지)
    // 하지만 defaultStats에 이미 false가 있으므로 문제 없음
  }
  
  merged.weight = oldStats.weight !== undefined ? oldStats.weight : merged.weight;
  merged.lifespanSeconds= oldStats.lifespanSeconds || merged.lifespanSeconds;

  // ★ strength, effort는 진화 시 리셋 (resetStats에서 0으로 설정됨)
  // merged.strength, merged.effort는 defaultStats에서 가져온 기본값 사용 (보통 0)

  // ★ trainings는 새 디지몬 생성(진화) 시 무조건 0
  merged.trainings = 0;

  // 매뉴얼 기반 필드 초기화 (진화 시 리셋되는 필드)
  merged.overfeeds = 0;
  merged.consecutiveMeatFed = 0; // 오버피드 연속 카운트도 리셋
  // proteinCount 제거됨 - strength로 통합
  merged.proteinOverdose = 0; // 단백질 과다 리셋
  merged.battlesForEvolution = 0;
  merged.careMistakes = 0;
  merged.injuries = 0; // 부상 횟수 리셋
  merged.isInjured = false; // 부상 상태 리셋
  merged.injuredAt = null; // 부상 시간 리셋
  merged.healedDosesCurrent = 0; // 치료제 횟수 리셋
  // 호출 상태 초기화 (진화 시 리셋)
  merged.callStatus = {
    hunger: { isActive: false, startedAt: null, isLogged: false },
    strength: { isActive: false, startedAt: null, isLogged: false },
    sleep: { isActive: false, startedAt: null }
  };
  
  // 매뉴얼 기반 필드 초기화
  
  // Energy는 진화 시 리셋되므로, resetStats에서 이미 0으로 설정된 값을 사용
  merged.energy = oldStats.energy !== undefined ? oldStats.energy : (merged.energy || 0);
  
  // 총 토탈 배틀 값 (진화 시 유지)
  merged.totalBattles = oldStats.totalBattles !== undefined ? oldStats.totalBattles : (merged.totalBattles || 0);
  merged.totalBattlesWon = oldStats.totalBattlesWon !== undefined ? oldStats.totalBattlesWon : (merged.totalBattlesWon || 0);
  merged.totalBattlesLost = oldStats.totalBattlesLost !== undefined ? oldStats.totalBattlesLost : (merged.totalBattlesLost || 0);
  merged.totalWinRate = oldStats.totalWinRate !== undefined ? oldStats.totalWinRate : (merged.totalWinRate || 0);
  
  // 환생 횟수 (진화 시 유지)
  merged.totalReincarnations = oldStats.totalReincarnations !== undefined ? oldStats.totalReincarnations : (merged.totalReincarnations || 0);
  merged.normalReincarnations = oldStats.normalReincarnations !== undefined ? oldStats.normalReincarnations : (merged.normalReincarnations || 0);
  merged.perfectReincarnations = oldStats.perfectReincarnations !== undefined ? oldStats.perfectReincarnations : (merged.perfectReincarnations || 0);
  
  // 현재 디지몬 배틀 값 (진화 시 리셋)
  // resetStats에서 이미 0으로 설정되거나, 없으면 기본값 0 사용
  merged.battles = oldStats.battles !== undefined ? oldStats.battles : 0;
  merged.battlesWon = oldStats.battlesWon !== undefined ? oldStats.battlesWon : 0;
  merged.battlesLost = oldStats.battlesLost !== undefined ? oldStats.battlesLost : 0;
  merged.winRate = oldStats.winRate !== undefined ? oldStats.winRate : 0;

  // 타이머 계산
  merged.hungerCountdown   = merged.hungerTimer   * 60;
  merged.strengthCountdown = merged.strengthTimer * 60;

  // poop 관련
  merged.poopCount = (oldStats.poopCount !== undefined)
    ? oldStats.poopCount
    : 0;
  merged.poopTimer = merged.poopTimer || 0; 
  
  // poopCountdown 초기화: poopTimer가 변경되었거나 poopCountdown이 잘못된 값이면 초기화
  const oldPoopTimer = oldStats.poopTimer || 0;
  const newPoopTimer = merged.poopTimer || 0;
  const maxValidCountdown = newPoopTimer * 60; // 최대 유효한 countdown 값
  
  if (oldStats.poopCountdown !== undefined) {
    // poopTimer가 변경되었거나 poopCountdown이 잘못된 값이면 초기화
    if (oldPoopTimer !== newPoopTimer || 
        oldStats.poopCountdown < 0 || 
        oldStats.poopCountdown > maxValidCountdown ||
        isNaN(oldStats.poopCountdown)) {
      merged.poopCountdown = maxValidCountdown;
    } else {
      merged.poopCountdown = oldStats.poopCountdown;
    }
  } else {
    merged.poopCountdown = maxValidCountdown;
  }

  merged.lastMaxPoopTime = oldStats.lastMaxPoopTime || null;

  // 야행성 모드 (진화 시 유지)
  merged.isNocturnal = oldStats.isNocturnal !== undefined ? oldStats.isNocturnal : false;

  return merged;
}

export function updateLifespan(stats, deltaSec=1, isSleeping=false){
  if(stats.isDead) return stats;

  const s= { ...stats };
  s.lifespanSeconds += deltaSec;
  // undefined면 NaN 방지 및 디지타마 초기값 누락 대비 (0으로 간주해 감소만 적용)
  const currentTimeToEvolve = typeof s.timeToEvolveSeconds === 'number' && !Number.isNaN(s.timeToEvolveSeconds) ? s.timeToEvolveSeconds : 0;
  s.timeToEvolveSeconds = Math.max(0, currentTimeToEvolve - deltaSec);

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

  // ★ (3) poop 로직 (수면 중에는 타이머 감소하지 않음)
  if(s.poopTimer>0 && !isSleeping){
    s.poopCountdown -= deltaSec;
    if(s.poopCountdown <= 0){
      if(s.poopCount < 8){
        s.poopCount++;
        s.poopCountdown = s.poopTimer*60;

        // ★ 8이 딱 되었으면 그 순간 lastMaxPoopTime 기록 + 즉시 부상 적용
        if(s.poopCount === 8 && !s.lastMaxPoopTime){
          s.lastMaxPoopTime = Date.now();
          if(!s.isInjured){
            s.isInjured = true;
            s.injuredAt = Date.now();
            s.injuries = (s.injuries || 0) + 1;
            s.healedDosesCurrent = 0;
            s.injuryReason = 'poop';
          }
        }
      } else {
        // 이미 8 이상
        if(!s.lastMaxPoopTime){
          // 아직 기록 안된 경우
          s.lastMaxPoopTime = Date.now();
        } else {
          // 기록되어 있고, 8시간(28800초) 지났다면 추가 부상 + 케어미스
          const e = (Date.now() - s.lastMaxPoopTime)/1000;
          if(e >= 28800){
            s.careMistakes++;
            s.injuries = (s.injuries || 0) + 1;
            s.injuredAt = Date.now();
            s.isInjured = true;
            s.healedDosesCurrent = 0;
            s.lastMaxPoopTime = Date.now(); // 다시 리셋
          }
        }
        s.poopCountdown = s.poopTimer*60;
      }
    }
  }


  return s;
}

/**
 * 나이 업데이트 (자정 경과 확인)
 * 마지막으로 age가 증가한 날짜를 추적하여 하루에 한 번만 증가하도록 함
 * @param {Object} stats - 현재 스탯
 * @returns {Object} 업데이트된 스탯
 */
export function updateAge(stats){
  const now= new Date();
  const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // 자정(00:00)이고, 오늘 아직 age가 증가하지 않았으면 증가
  if(now.getHours()===0 && now.getMinutes()===0){
    const lastAgeUpdateDate = stats.lastAgeUpdateDate 
      ? new Date(stats.lastAgeUpdateDate)
      : null;
    
    // 마지막 증가 날짜가 없거나 오늘이 아니면 age 증가
    if (!lastAgeUpdateDate || lastAgeUpdateDate.getTime() !== currentDate.getTime()) {
      return { 
        ...stats, 
        age: (stats.age || 0) + 1,
        lastAgeUpdateDate: currentDate.getTime()
      };
    }
  }
  return stats;
}

/**
 * Lazy Update용 나이 업데이트
 * 마지막 저장 시간부터 현재까지의 모든 자정을 체크하여 age 증가
 * @param {Object} stats - 현재 스탯
 * @param {Date} lastSaved - 마지막 저장 시간
 * @param {Date} now - 현재 시간
 * @returns {Object} 업데이트된 스탯
 */
export function updateAgeWithLazyUpdate(stats, lastSaved, now) {
  let updatedStats = { ...stats };
  const lastAgeUpdateDate = updatedStats.lastAgeUpdateDate 
    ? new Date(updatedStats.lastAgeUpdateDate)
    : null;
  
  // 마지막 저장 시간의 다음 자정부터 현재까지의 모든 자정 체크
  let checkTime = new Date(lastSaved);
  checkTime.setHours(0);
  checkTime.setMinutes(0);
  checkTime.setSeconds(0);
  checkTime.setMilliseconds(0);
  
  // 마지막 저장 시간이 자정 이후라면 다음 날 자정으로 이동
  if (lastSaved.getHours() > 0 || lastSaved.getMinutes() > 0 || lastSaved.getSeconds() > 0) {
    checkTime.setDate(checkTime.getDate() + 1);
  }
  
  // 현재 시간까지의 모든 자정 체크
  while (checkTime.getTime() <= now.getTime()) {
    const checkDate = new Date(checkTime.getFullYear(), checkTime.getMonth(), checkTime.getDate());
    
    // 마지막 증가 날짜가 없거나 체크하는 날짜가 마지막 증가 날짜보다 이후면 age 증가
    if (!lastAgeUpdateDate || checkDate.getTime() > lastAgeUpdateDate.getTime()) {
      updatedStats.age = (updatedStats.age || 0) + 1;
      updatedStats.lastAgeUpdateDate = checkDate.getTime();
    }
    
    // 다음 날 자정으로 이동
    checkTime.setDate(checkTime.getDate() + 1);
  }
  
  return updatedStats;
}

/**
 * Firestore Timestamp를 안전하게 변환하는 유틸 함수
 * @param {any} val - 변환할 값 (number, Date, Firestore Timestamp, string 등)
 * @returns {number|null} - timestamp (milliseconds) 또는 null
 */
function ensureTimestamp(val) {
  if (!val) return null;
  if (typeof val === 'number') return val;
  // Firestore Timestamp 객체 처리
  if (val && typeof val === 'object' && 'seconds' in val) {
    return val.seconds * 1000 + (val.nanoseconds || 0) / 1000000;
  }
  // Date 객체나 문자열 처리
  const date = new Date(val);
  return isNaN(date.getTime()) ? null : date.getTime();
}

/**
 * 과거 재구성 시 activityLogs에 소급 시각으로 로그 한 건 추가 (이력 누락 방지)
 * @param {Array} activityLogs - 기존 활동 로그 배열
 * @param {string} type - 로그 타입 ('POOP', 'CAREMISTAKE' 등)
 * @param {string} text - 로그 텍스트
 * @param {number} timestampMs - 소급 적용할 시각 (ms)
 * @param {number} maxLogs - 최대 유지 개수
 * @returns {Array} 업데이트된 로그 배열
 */
function pushBackdatedActivityLog(activityLogs, type, text, timestampMs, maxLogs = 100) {
  const logs = Array.isArray(activityLogs) ? activityLogs : [];
  const next = [...logs, { type, text, timestamp: timestampMs }];
  return next.length > maxLogs ? next.slice(-maxLogs) : next;
}

/** 이미 동일 이벤트(타입+타임스탬프+텍스트 패턴) 로그가 있으면 true. 중복 로그/카운터 방지용 */
function alreadyHasBackdatedLog(activityLogs, type, timestampMs, textContains = '') {
  const logs = Array.isArray(activityLogs) ? activityLogs : [];
  return logs.some(
    (log) =>
      log.type === type &&
      log.timestamp === timestampMs &&
      (!textContains || (log.text && log.text.includes(textContains)))
  );
}

/** 동일 타입·텍스트 패턴 로그가 기준 시각 ±windowMs 안에 있으면 true. applyLazyUpdate가 연속 호출될 때 같은 케어미스가 여러 번 쌓이는 것 방지 */
function alreadyHasLogInWindow(activityLogs, type, timeMs, textContains, windowMs = 120000) {
  const logs = Array.isArray(activityLogs) ? activityLogs : [];
  const minT = timeMs - windowMs;
  const maxT = timeMs + windowMs;
  return logs.some((log) => {
    if (log.type !== type) return false;
    if (textContains && (!log.text || !log.text.includes(textContains))) return false;
    const t = typeof log.timestamp === 'number' ? log.timestamp : (log.timestamp?.seconds != null ? log.timestamp.seconds * 1000 : null);
    if (t == null) return false;
    return t >= minT && t <= maxT;
  });
}

/**
 * Lazy Update: 마지막 저장 시간부터 현재까지 경과한 시간을 계산하여
 * 스탯(배고픔, 수명 등)을 한 번에 차감
 * 
 * @param {Object} stats - 현재 디지몬 스탯
 * @param {Date|number|string|Object} lastSavedAt - 마지막 저장 시간 (Date, timestamp, ISO string, 또는 Firestore Timestamp)
 * @param {Object} sleepSchedule - 수면 스케줄 (선택적)
 * @param {number} maxEnergy - 최대 에너지 (선택적)
 * @returns {Object} 업데이트된 스탯
 */
export function applyLazyUpdate(stats, lastSavedAt, sleepSchedule = null, maxEnergy = null) {
  if (!lastSavedAt) {
    // 마지막 저장 시간이 없으면 현재 시간으로 설정
    return { ...stats, lastSavedAt: new Date() };
  }

  // 마지막 저장 시간을 Date 객체로 변환 (Firestore Timestamp 지원)
  let lastSaved;
  const lastSavedTimestamp = ensureTimestamp(lastSavedAt);
  if (lastSavedTimestamp) {
    lastSaved = new Date(lastSavedTimestamp);
  } else {
    // 알 수 없는 형식이면 현재 시간으로 설정
    return { ...stats, lastSavedAt: new Date() };
  }

  const now = new Date();
  
  // 냉장고 시간을 제외한 경과 시간 계산
  let elapsedSeconds;
  if (stats.isFrozen && stats.frozenAt) {
    // 냉장고 상태: 냉장고에 넣은 시간 이후의 시간만 제외
    const frozenTime = typeof stats.frozenAt === 'number' 
      ? stats.frozenAt 
      : new Date(stats.frozenAt).getTime();
    const lastSavedTime = lastSaved.getTime();
    
    // 냉장고에 넣은 시간이 마지막 저장 시간보다 이후인 경우
    if (frozenTime > lastSavedTime) {
      // 냉장고에 넣기 전의 시간만 계산 (냉장고에 넣은 이후의 시간은 제외)
      elapsedSeconds = Math.floor((frozenTime - lastSavedTime) / 1000);
    } else {
      // 냉장고에 넣은 시간이 마지막 저장 시간보다 이전이거나 같은 경우
      // (냉장고에 넣은 후 저장했을 수 있음)
      // 냉장고에 넣은 이후의 시간은 모두 제외하므로 경과 시간 = 0
      elapsedSeconds = 0;
    }
    
    // 경과 시간이 0이면 스탯 변경 없음
    if (elapsedSeconds <= 0) {
      // 냉장고에 넣은 이후의 시간만 있었으므로 스탯 변경 없음
      // lastSavedAt만 업데이트하여 다음 lazy update가 정상 작동하도록 함
      return { ...stats, lastSavedAt: now };
    }
    // 냉장고에 넣기 전의 시간이 있었다면 그 시간만큼만 스탯 변경
  } else {
    // 냉장고 상태가 아니면 일반 경과 시간 계산
    elapsedSeconds = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);
  }

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
  
  // birthTime이 없으면 현재 시간으로 설정
  if (!updatedStats.birthTime) {
    updatedStats.birthTime = now.getTime();
  }
  
  // 나이는 updateAge 함수에서 자정에만 증가하도록 처리 (여기서는 계산하지 않음)
  
  // updateLifespan을 경과 시간만큼 호출
  // 하지만 한 번에 처리하는 것이 더 효율적이므로 직접 계산
  updatedStats.lifespanSeconds += elapsedSeconds;
  // undefined/NaN 방지 — 구 저장 데이터에 timeToEvolveSeconds 없을 수 있음
  const currentTte = typeof updatedStats.timeToEvolveSeconds === 'number' && !Number.isNaN(updatedStats.timeToEvolveSeconds) ? updatedStats.timeToEvolveSeconds : 0;
  updatedStats.timeToEvolveSeconds = Math.max(0, currentTte - elapsedSeconds);

  // 배고픔 감소 처리 (수면 중에는 타이머 감소하지 않음)
  if (updatedStats.hungerTimer > 0) {
    // 수면 시간을 제외한 실제 활동 시간만큼만 hungerCountdown 감소
    let activeSeconds = elapsedSeconds;
    if (sleepSchedule) {
      const sleepSeconds = calculateSleepSecondsInRange(lastSaved.getTime(), now.getTime(), sleepSchedule);
      activeSeconds = elapsedSeconds - sleepSeconds;
    }
    
    // 활동 시간만큼만 hungerCountdown 감소
    if (activeSeconds > 0) {
      updatedStats.hungerCountdown -= activeSeconds;
    }
    
    // countdown이 0 이하가 되면 fullness 감소
    while (updatedStats.hungerCountdown <= 0) {
      updatedStats.fullness = Math.max(0, updatedStats.fullness - 1);
      updatedStats.hungerCountdown += updatedStats.hungerTimer * 60;
      
      // fullness가 0이 되면 lastHungerZeroAt 기록
      if (updatedStats.fullness === 0 && !updatedStats.lastHungerZeroAt) {
        // 마지막 저장 시간부터 fullness가 0이 된 시점 계산
        const timeToZero = lastSaved.getTime() + (activeSeconds - updatedStats.hungerCountdown) * 1000;
        updatedStats.lastHungerZeroAt = timeToZero;
      }
    }
  }

  // 힘 감소 처리 (수면 중에는 타이머 감소하지 않음)
  if (updatedStats.strengthTimer > 0) {
    // 수면 시간을 제외한 실제 활동 시간만큼만 strengthCountdown 감소
    let activeSeconds = elapsedSeconds;
    if (sleepSchedule) {
      const sleepSeconds = calculateSleepSecondsInRange(lastSaved.getTime(), now.getTime(), sleepSchedule);
      activeSeconds = elapsedSeconds - sleepSeconds;
    }
    
    // 활동 시간만큼만 strengthCountdown 감소
    if (activeSeconds > 0) {
      updatedStats.strengthCountdown -= activeSeconds;
    }
    
    // countdown이 0 이하가 되면 strength 감소
    while (updatedStats.strengthCountdown <= 0) {
      // strength -1 (최소 0)
      updatedStats.strength = Math.max(0, updatedStats.strength - 1);
      updatedStats.strengthCountdown += updatedStats.strengthTimer * 60;
      
      // strength가 0이 되면 lastStrengthZeroAt 기록
      if (updatedStats.strength === 0 && !updatedStats.lastStrengthZeroAt) {
        const timeToZero = lastSaved.getTime() + (activeSeconds - updatedStats.strengthCountdown) * 1000;
        updatedStats.lastStrengthZeroAt = timeToZero;
      }
    }
  }

  // 배변 처리 (수면 중에는 타이머 감소하지 않음)
  if (updatedStats.poopTimer > 0) {
    const maxValidCountdown = updatedStats.poopTimer * 60;
    
    // poopCountdown 초기화 체크 (undefined, null, NaN, 음수, 또는 잘못된 값)
    if (updatedStats.poopCountdown === undefined || 
        updatedStats.poopCountdown === null || 
        isNaN(updatedStats.poopCountdown) || 
        updatedStats.poopCountdown < 0 ||
        updatedStats.poopCountdown > maxValidCountdown) {
      // 초기화: poopTimer * 60 (초 단위)
      updatedStats.poopCountdown = maxValidCountdown;
    }
    
    // 수면 시간을 제외한 실제 활동 시간만큼만 poopCountdown 감소
    let activeSeconds = elapsedSeconds;
    if (sleepSchedule) {
      const sleepSeconds = calculateSleepSecondsInRange(lastSaved.getTime(), now.getTime(), sleepSchedule);
      activeSeconds = elapsedSeconds - sleepSeconds;
    }
    
    // 활동 시간만큼만 poopCountdown 감소
    if (activeSeconds > 0) {
      updatedStats.poopCountdown -= activeSeconds;
    }
    
    while (updatedStats.poopCountdown <= 0) {
      if (updatedStats.poopCount < 8) {
        updatedStats.poopCount++;
        updatedStats.poopCountdown += updatedStats.poopTimer * 60;
        
        // 8개가 되면 lastMaxPoopTime 기록 + 즉시 부상 적용 (같은 턴에서). !isInjured로 소급 분기와 이중 적용 방지
        if (updatedStats.poopCount === 8 && !updatedStats.lastMaxPoopTime) {
          const timeToMax = lastSaved.getTime() + (elapsedSeconds - updatedStats.poopCountdown) * 1000;
          updatedStats.lastMaxPoopTime = timeToMax;
          if (!updatedStats.isInjured) {
            updatedStats.isInjured = true;
            updatedStats.injuredAt = timeToMax;
            updatedStats.injuries = (updatedStats.injuries || 0) + 1;
            updatedStats.healedDosesCurrent = 0;
            updatedStats.injuryReason = 'poop';
            if (!alreadyHasBackdatedLog(updatedStats.activityLogs, 'POOP', timeToMax, 'Too much poop')) {
              updatedStats.activityLogs = pushBackdatedActivityLog(
                updatedStats.activityLogs,
                'POOP',
                'Pooped (Total: 8) - Injury: Too much poop (8 piles) [과거 재구성]',
                timeToMax
              );
            }
          }
        }
        } else {
          // 이미 8개 이상
          if (!updatedStats.lastMaxPoopTime) {
            const timeToMax = lastSaved.getTime() + (elapsedSeconds - updatedStats.poopCountdown) * 1000;
            updatedStats.lastMaxPoopTime = timeToMax;
            // 똥 8개 부상 (로드 시 poop 8인데 lastMaxPoopTime 없을 때). !isInjured로 즉시 분기와 이중 적용 방지
            if (!updatedStats.isInjured) {
              updatedStats.isInjured = true;
              updatedStats.injuredAt = timeToMax;
              updatedStats.injuries = (updatedStats.injuries || 0) + 1;
              updatedStats.healedDosesCurrent = 0; // 치료제 횟수 리셋
              updatedStats.injuryReason = 'poop'; // 부상 원인 저장
              if (!alreadyHasBackdatedLog(updatedStats.activityLogs, 'POOP', timeToMax, 'Too much poop')) {
                updatedStats.activityLogs = pushBackdatedActivityLog(
                  updatedStats.activityLogs,
                  'POOP',
                  'Pooped (Total: 8) - Injury: Too much poop (8 piles) [과거 재구성]',
                  timeToMax
                );
              }
            }
          } else {
            // 이미 8개였고, lastMaxPoopTime만 있고 isInjured 미설정(과거 세이드) 시 소급. !isInjured로 즉시/위 분기와 이중 적용 방지
            if (updatedStats.poopCount >= 8 && !updatedStats.isInjured) {
              const backdatedInjuryTime =
                typeof updatedStats.lastMaxPoopTime === 'number'
                  ? updatedStats.lastMaxPoopTime
                  : updatedStats.lastMaxPoopTime
                    ? new Date(updatedStats.lastMaxPoopTime).getTime()
                    : lastSaved.getTime();
              updatedStats.isInjured = true;
              updatedStats.injuredAt = backdatedInjuryTime;
              updatedStats.injuries = (updatedStats.injuries || 0) + 1;
              updatedStats.healedDosesCurrent = 0; // 치료제 횟수 리셋
              updatedStats.injuryReason = 'poop'; // 부상 원인 저장
              if (!alreadyHasBackdatedLog(updatedStats.activityLogs, 'POOP', backdatedInjuryTime, 'Too much poop')) {
                updatedStats.activityLogs = pushBackdatedActivityLog(
                  updatedStats.activityLogs,
                  'POOP',
                  'Pooped (Total: 8) - Injury: Too much poop (8 piles) [과거 재구성]',
                  backdatedInjuryTime
                );
              }
            }
            // 8시간마다 추가 부상 + 케어미스 (냉장고 시간 제외 경과로 판정)
            const lastMaxTime = typeof updatedStats.lastMaxPoopTime === 'number'
              ? updatedStats.lastMaxPoopTime
              : updatedStats.lastMaxPoopTime ? new Date(updatedStats.lastMaxPoopTime).getTime() : 0;
            if (lastMaxTime > 0) {
              const elapsedSinceMaxMs = getElapsedTimeExcludingFridge(
                lastMaxTime,
                now.getTime(),
                updatedStats.frozenAt,
                updatedStats.takeOutAt
              );
              const elapsedSinceMaxSec = elapsedSinceMaxMs / 1000;
              const periods = Math.floor(elapsedSinceMaxSec / 28800); // 8시간 = 28800초
              if (periods >= 1) {
                const nowMs = now.getTime();
                updatedStats.careMistakes = (updatedStats.careMistakes || 0) + periods;
                updatedStats.injuries = (updatedStats.injuries || 0) + periods;
                updatedStats.injuredAt = nowMs;
                updatedStats.isInjured = true;
                updatedStats.healedDosesCurrent = 0;
                updatedStats.lastMaxPoopTime = nowMs;
                if (!alreadyHasBackdatedLog(updatedStats.activityLogs, 'POOP', nowMs, '8시간 경과')) {
                  updatedStats.activityLogs = pushBackdatedActivityLog(
                    updatedStats.activityLogs,
                    'POOP',
                    `똥 8개 방치 8시간 경과 x${periods} - 추가 부상 + 케어미스 [과거 재구성]`,
                    nowMs
                  );
                }
              }
            }
          }
          updatedStats.poopCountdown += updatedStats.poopTimer * 60;
        }
    }
  }

  // 사망 체크는 isDead가 false일 때만 실행
  if (!updatedStats.isDead) {
    // 배고픔이 0이고 12시간(43200초) 경과 시 사망
    if (updatedStats.fullness === 0 && updatedStats.lastHungerZeroAt) {
      const hungerZeroTime = typeof updatedStats.lastHungerZeroAt === 'number'
        ? updatedStats.lastHungerZeroAt
        : new Date(updatedStats.lastHungerZeroAt).getTime();
      const elapsedSinceZero = (now.getTime() - hungerZeroTime) / 1000;
      
      if (elapsedSinceZero >= 43200) {
        console.log("[applyLazyUpdate] 굶주림 사망 체크:", { elapsedSinceZero, lastHungerZeroAt: updatedStats.lastHungerZeroAt });
        updatedStats.isDead = true;
        updatedStats.deathReason = 'STARVATION (굶주림)'; // 사망 원인 저장
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
        console.log("[applyLazyUpdate] 힘 소진 사망 체크:", { elapsedSinceZero, lastStrengthZeroAt: updatedStats.lastStrengthZeroAt });
        updatedStats.isDead = true;
        updatedStats.deathReason = 'EXHAUSTION (힘 소진)'; // 사망 원인 저장
      }
    } else if (updatedStats.strength > 0) {
      // 힘이 다시 채워지면 리셋
      updatedStats.lastStrengthZeroAt = null;
    }

    // 부상 과다 사망 체크: injuries >= 15
    if ((updatedStats.injuries || 0) >= 15) {
      console.log("[applyLazyUpdate] 부상 과다 사망 체크:", { injuries: updatedStats.injuries });
      updatedStats.isDead = true;
      updatedStats.deathReason = 'INJURY OVERLOAD (부상 과다: 15회)'; // 사망 원인 저장
    }

    // 부상 방치 사망 체크: isInjured 상태이고 6시간(21600000ms) 경과
    if (updatedStats.isInjured && updatedStats.injuredAt) {
      const injuredTime = typeof updatedStats.injuredAt === 'number'
        ? updatedStats.injuredAt
        : new Date(updatedStats.injuredAt).getTime();
      const elapsedSinceInjury = now.getTime() - injuredTime;
      
      if (elapsedSinceInjury >= 21600000) { // 6시간 = 21600000ms
        console.log("[applyLazyUpdate] 부상 방치 사망 체크:", { elapsedSinceInjury });
        updatedStats.isDead = true;
        updatedStats.deathReason = 'INJURY NEGLECT (부상 방치: 6시간)'; // 사망 원인 저장
      }
    }
  }

  if (!updatedStats.callStatus) {
    updatedStats.callStatus = {
      hunger: { isActive: false, startedAt: null, isLogged: false },
      strength: { isActive: false, startedAt: null, isLogged: false },
      sleep: { isActive: false, startedAt: null }
    };
  }
  if (updatedStats.callStatus.hunger && updatedStats.callStatus.hunger.isLogged === undefined) {
    updatedStats.callStatus.hunger.isLogged = false;
  }
  if (updatedStats.callStatus.strength && updatedStats.callStatus.strength.isLogged === undefined) {
    updatedStats.callStatus.strength.isLogged = false;
  }

  const callStatus = updatedStats.callStatus;
  const HUNGER_CALL_TIMEOUT = 10 * 60 * 1000; // 10분
  const STRENGTH_CALL_TIMEOUT = 10 * 60 * 1000; // 10분

  // Hunger 호출 처리
  if (updatedStats.fullness === 0) {
    // startedAt이 없으면 lastHungerZeroAt(DB 절대 기준점)를 기반으로 복원 — 값이 있으면 now로 덮어쓰지 않음
    if (!callStatus.hunger.startedAt && updatedStats.lastHungerZeroAt) {
      const hungerZeroTime = ensureTimestamp(updatedStats.lastHungerZeroAt);
      if (hungerZeroTime) {
        callStatus.hunger.isActive = true;
        callStatus.hunger.startedAt = hungerZeroTime;
      }
    } else if (callStatus.hunger.startedAt) {
      callStatus.hunger.isActive = true;
    }
    // 값이 없을 때만 딱 한 번 기록: DB에 lastHungerZeroAt가 있으면 절대 now로 덮어쓰지 않음
    if (!updatedStats.lastHungerZeroAt) {
      const fromStartedAt = ensureTimestamp(callStatus.hunger.startedAt);
      updatedStats.lastHungerZeroAt = fromStartedAt || now.getTime();
      callStatus.hunger.isActive = true;
      callStatus.hunger.startedAt = updatedStats.lastHungerZeroAt;
    }
    // 데드라인도 값이 없을 때만 설정 (birthTime처럼 절대 기준점으로 DB 저장)
    if (!updatedStats.hungerMistakeDeadline && updatedStats.lastHungerZeroAt) {
      const startMs = ensureTimestamp(updatedStats.lastHungerZeroAt);
      if (startMs) updatedStats.hungerMistakeDeadline = startMs + HUNGER_CALL_TIMEOUT;
    }

    // 타임아웃 체크 (오프라인 수면 시간 고려)
    const hungerStartedAt = ensureTimestamp(callStatus.hunger.startedAt);
    // DB isLogged 망령 보정: 아직 10분 미만이면 판정 대기 상태이므로 false
    if (hungerStartedAt) {
      const hungerElapsed = now.getTime() - hungerStartedAt;
      if (hungerElapsed < HUNGER_CALL_TIMEOUT) callStatus.hunger.isLogged = false;
    }
    if (hungerStartedAt && sleepSchedule) {
      // 호출 시작 시점부터 지금까지의 수면 시간 계산
      const sleepDuringCall = calculateSleepSecondsInRange(hungerStartedAt, now.getTime(), sleepSchedule);
      const totalElapsedMs = now.getTime() - hungerStartedAt;
      const activeCallDurationMs = totalElapsedMs - (sleepDuringCall * 1000);
      
      if (activeCallDurationMs > HUNGER_CALL_TIMEOUT) {
        const timeoutOccurredAt = hungerStartedAt + HUNGER_CALL_TIMEOUT;
        const alreadyLogged = callStatus.hunger.isLogged === true;
        if (!alreadyLogged &&
            !alreadyHasBackdatedLog(updatedStats.activityLogs, 'CAREMISTAKE', timeoutOccurredAt, '배고픔 콜') &&
            !alreadyHasLogInWindow(updatedStats.activityLogs, 'CAREMISTAKE', timeoutOccurredAt, '배고픔 콜')) {
          updatedStats.careMistakes = (updatedStats.careMistakes || 0) + 1;
          updatedStats.activityLogs = pushBackdatedActivityLog(
            updatedStats.activityLogs,
            'CAREMISTAKE',
            '케어미스(사유: 배고픔 콜 10분 무시) [과거 재구성]',
            timeoutOccurredAt
          );
          callStatus.hunger.isLogged = true;
        }
        callStatus.hunger.isActive = false;
        callStatus.hunger.startedAt = null;
        updatedStats.lastHungerZeroAt = null;
        updatedStats.hungerMistakeDeadline = null;
      } else {
        // 아직 타임아웃 전: 수면 시간만큼 startedAt을 뒤로 밀어서 보존 (UI 경과 시간 계산용)
        // 단, 절대 시각이 '현재'를 넘어가면 안 됨 → T_rem = max(0, deadline - now) 일관성 유지
        const pushedStart = hungerStartedAt + (sleepDuringCall * 1000);
        callStatus.hunger.startedAt = Math.min(now.getTime(), pushedStart);
      }
    } else if (hungerStartedAt) {
      const elapsed = now.getTime() - hungerStartedAt;
      if (elapsed > HUNGER_CALL_TIMEOUT) {
        const timeoutOccurredAt = hungerStartedAt + HUNGER_CALL_TIMEOUT;
        const alreadyLogged = callStatus.hunger.isLogged === true;
        if (!alreadyLogged &&
            !alreadyHasBackdatedLog(updatedStats.activityLogs, 'CAREMISTAKE', timeoutOccurredAt, '배고픔 콜') &&
            !alreadyHasLogInWindow(updatedStats.activityLogs, 'CAREMISTAKE', timeoutOccurredAt, '배고픔 콜')) {
          updatedStats.careMistakes = (updatedStats.careMistakes || 0) + 1;
          updatedStats.activityLogs = pushBackdatedActivityLog(
            updatedStats.activityLogs,
            'CAREMISTAKE',
            '케어미스(사유: 배고픔 콜 10분 무시) [과거 재구성]',
            timeoutOccurredAt
          );
          callStatus.hunger.isLogged = true;
        }
        callStatus.hunger.isActive = false;
        callStatus.hunger.startedAt = null;
        updatedStats.lastHungerZeroAt = null;
        updatedStats.hungerMistakeDeadline = null;
      }
    }
  } else {
    callStatus.hunger.isActive = false;
    callStatus.hunger.startedAt = null;
    callStatus.hunger.isLogged = false;
    updatedStats.lastHungerZeroAt = null;
    updatedStats.hungerMistakeDeadline = null;
  }

  // Strength 호출 처리
  if (updatedStats.strength === 0) {
    // startedAt이 없으면 lastStrengthZeroAt(DB 절대 기준점)를 기반으로 복원 — 값이 있으면 now로 덮어쓰지 않음
    if (!callStatus.strength.startedAt && updatedStats.lastStrengthZeroAt) {
      const strengthZeroTime = ensureTimestamp(updatedStats.lastStrengthZeroAt);
      if (strengthZeroTime) {
        callStatus.strength.isActive = true;
        callStatus.strength.startedAt = strengthZeroTime;
      }
    } else if (callStatus.strength.startedAt) {
      callStatus.strength.isActive = true;
    }
    // 값이 없을 때만 딱 한 번 기록
    if (!updatedStats.lastStrengthZeroAt) {
      const fromStartedAt = ensureTimestamp(callStatus.strength.startedAt);
      updatedStats.lastStrengthZeroAt = fromStartedAt || now.getTime();
      callStatus.strength.isActive = true;
      callStatus.strength.startedAt = updatedStats.lastStrengthZeroAt;
    }
    if (!updatedStats.strengthMistakeDeadline && updatedStats.lastStrengthZeroAt) {
      const startMs = ensureTimestamp(updatedStats.lastStrengthZeroAt);
      if (startMs) updatedStats.strengthMistakeDeadline = startMs + STRENGTH_CALL_TIMEOUT;
    }

    // 타임아웃 체크 (오프라인 수면 시간 고려)
    const strengthStartedAt = ensureTimestamp(callStatus.strength.startedAt);
    if (strengthStartedAt) {
      const strengthElapsed = now.getTime() - strengthStartedAt;
      if (strengthElapsed < STRENGTH_CALL_TIMEOUT) callStatus.strength.isLogged = false;
    }
    if (strengthStartedAt && sleepSchedule) {
      // 호출 시작 시점부터 지금까지의 수면 시간 계산
      const sleepDuringCall = calculateSleepSecondsInRange(strengthStartedAt, now.getTime(), sleepSchedule);
      const totalElapsedMs = now.getTime() - strengthStartedAt;
      const activeCallDurationMs = totalElapsedMs - (sleepDuringCall * 1000);
      
      if (activeCallDurationMs > STRENGTH_CALL_TIMEOUT) {
        const timeoutOccurredAt = strengthStartedAt + STRENGTH_CALL_TIMEOUT;
        const alreadyLogged = callStatus.strength.isLogged === true;
        if (!alreadyLogged &&
            !alreadyHasBackdatedLog(updatedStats.activityLogs, 'CAREMISTAKE', timeoutOccurredAt, '힘 콜') &&
            !alreadyHasLogInWindow(updatedStats.activityLogs, 'CAREMISTAKE', timeoutOccurredAt, '힘 콜')) {
          updatedStats.careMistakes = (updatedStats.careMistakes || 0) + 1;
          updatedStats.activityLogs = pushBackdatedActivityLog(
            updatedStats.activityLogs,
            'CAREMISTAKE',
            '케어미스(사유: 힘 콜 10분 무시) [과거 재구성]',
            timeoutOccurredAt
          );
          callStatus.strength.isLogged = true;
        }
        callStatus.strength.isActive = false;
        callStatus.strength.startedAt = null;
        updatedStats.lastStrengthZeroAt = null;
        updatedStats.strengthMistakeDeadline = null;
      } else {
        const pushedStart = strengthStartedAt + (sleepDuringCall * 1000);
        callStatus.strength.startedAt = Math.min(now.getTime(), pushedStart);
      }
    } else if (strengthStartedAt) {
      const elapsed = now.getTime() - strengthStartedAt;
      if (elapsed > STRENGTH_CALL_TIMEOUT) {
        const timeoutOccurredAt = strengthStartedAt + STRENGTH_CALL_TIMEOUT;
        const alreadyLogged = callStatus.strength.isLogged === true;
        if (!alreadyLogged &&
            !alreadyHasBackdatedLog(updatedStats.activityLogs, 'CAREMISTAKE', timeoutOccurredAt, '힘 콜') &&
            !alreadyHasLogInWindow(updatedStats.activityLogs, 'CAREMISTAKE', timeoutOccurredAt, '힘 콜')) {
          updatedStats.careMistakes = (updatedStats.careMistakes || 0) + 1;
          updatedStats.activityLogs = pushBackdatedActivityLog(
            updatedStats.activityLogs,
            'CAREMISTAKE',
            '케어미스(사유: 힘 콜 10분 무시) [과거 재구성]',
            timeoutOccurredAt
          );
          callStatus.strength.isLogged = true;
        }
        callStatus.strength.isActive = false;
        callStatus.strength.startedAt = null;
        updatedStats.lastStrengthZeroAt = null;
        updatedStats.strengthMistakeDeadline = null;
      }
    }
  } else {
    callStatus.strength.isActive = false;
    callStatus.strength.startedAt = null;
    callStatus.strength.isLogged = false;
    updatedStats.lastStrengthZeroAt = null;
    updatedStats.strengthMistakeDeadline = null;
  }

  // Sleep 호출 처리 (수면 주기당 1회만)
  // 수면 호출은 실시간으로만 처리 (Lazy Update에서는 처리하지 않음)
  // 이유: 수면 호출은 수면 시간이 시작될 때 한 번만 발생해야 하므로

  // 나이 업데이트: 마지막 저장 시간부터 현재까지의 모든 자정 체크
  updatedStats = updateAgeWithLazyUpdate(updatedStats, lastSaved, now);

  // 마지막 저장 시간 업데이트
  updatedStats.lastSavedAt = now;

  return updatedStats;
}