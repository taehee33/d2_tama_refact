// src/data/stats.js
import { defaultStats } from "./defaultStatsFile";
import { MAX_ACTIVITY_LOGS } from "../constants/activityLogs";
import { calculateSleepSecondsInRange } from "../utils/sleepUtils";
import { getElapsedTimeExcludingFridge, toTimestamp } from "../utils/fridgeTime";
import { sanitizeDigimonLogSnapshot } from "../utils/digimonLogSnapshot";
import { appendCareMistakeEntry } from "../logic/stats/careMistakeLedger";
import { evaluateDeathConditions } from "../logic/stats/death";

function migrateLegacyPoopTimers(target, fallbackTime = null) {
  if ((target.poopCount || 0) < 8) {
    target.poopReachedMaxAt = null;
    target.lastPoopPenaltyAt = null;
    delete target.lastMaxPoopTime;
    return;
  }

  const fallbackMs = toTimestamp(fallbackTime);
  const legacyMaxTime = toTimestamp(target.lastMaxPoopTime);
  const existingReachedMaxAt = toTimestamp(target.poopReachedMaxAt);
  const existingPenaltyAt = toTimestamp(target.lastPoopPenaltyAt);
  const reachedMaxAt = existingReachedMaxAt ?? legacyMaxTime ?? existingPenaltyAt ?? fallbackMs;
  const penaltyAt = existingPenaltyAt ?? legacyMaxTime ?? reachedMaxAt;

  target.poopReachedMaxAt = reachedMaxAt ?? null;
  target.lastPoopPenaltyAt = penaltyAt ?? null;
  delete target.lastMaxPoopTime;
}

function applyPoopInjury(target, timestampMs, count = 1) {
  target.isInjured = true;
  target.injuredAt = timestampMs;
  target.injuryFrozenDurationMs = 0;
  target.injuries = (target.injuries || 0) + count;
  target.healedDosesCurrent = 0;
  target.injuryReason = "poop";
}

export function clearPoopOverflowState(stats, lastSavedAt = new Date()) {
  return {
    ...stats,
    poopCount: 0,
    poopReachedMaxAt: null,
    lastPoopPenaltyAt: null,
    poopPenaltyFrozenDurationMs: 0,
    lastSavedAt,
  };
}

export function clearActiveInjuryState(stats) {
  return {
    ...stats,
    isInjured: false,
    injuredAt: null,
    injuryFrozenDurationMs: 0,
    healedDosesCurrent: 0,
    injuryReason: null,
  };
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
    merged.hungerZeroFrozenDurationMs = 0;
    merged.lastStrengthZeroAt = null;
    merged.strengthZeroFrozenDurationMs = 0;
    merged.hungerMistakeDeadline = null;
    merged.strengthMistakeDeadline = null;
    merged.injuredAt = null;
    merged.injuryFrozenDurationMs = 0;
    merged.isInjured = false;
    merged.injuries = 0;
    merged.deathReason = null; // 새로운 시작이면 deathReason 리셋
    // 새로운 시작: 기본 스탯 설정
    merged.fullness = 0;
    merged.strength = 0;
    // 새로운 시작: 똥 초기화
    merged.poopCount = 0;
    merged.poopReachedMaxAt = null;
    merged.lastPoopPenaltyAt = null;
    merged.poopPenaltyFrozenDurationMs = 0;
  } else {
    merged.age = oldStats.age || merged.age;
    merged.birthTime = oldStats.birthTime || Date.now();
    // 진화 시에는 isDead를 명시적으로 false로 설정하지 않음 (기존 값 유지)
    // 하지만 defaultStats에 이미 false가 있으므로 문제 없음
  }
  
  merged.weight = oldStats.weight !== undefined ? oldStats.weight : merged.weight;
  merged.lifespanSeconds = Number.isFinite(oldStats.lifespanSeconds)
    ? oldStats.lifespanSeconds
    : (Number.isFinite(merged.lifespanSeconds) ? merged.lifespanSeconds : 0);

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
  merged.careMistakeLedger = [];
  merged.injuries = isNewStart
    ? 0
    : (oldStats.injuries !== undefined ? oldStats.injuries : (merged.injuries || 0)); // 이번 생 누적 부상 횟수 유지
  merged.isInjured = false; // 부상 상태 리셋
  merged.injuredAt = null; // 부상 시간 리셋
  merged.injuryFrozenDurationMs = 0;
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

  migrateLegacyPoopTimers(merged, null);

  // 야행성 모드 (진화 시 유지)
  merged.isNocturnal = oldStats.isNocturnal !== undefined ? oldStats.isNocturnal : false;

  // 현재 진화 단계 시작 시각 (케어미스 이력 필터: 이 시점 이후 로그만 표시 → 카운터와 일치)
  if (isNewStart) {
    merged.evolutionStageStartedAt = merged.birthTime || Date.now();
  } else {
    merged.evolutionStageStartedAt = Date.now();
  }

  delete merged.lastMaxPoopTime;

  return merged;
}

export function updateLifespan(stats, deltaSec=1, isSleeping=false){
  if(stats.isDead) return stats;

  const s= { ...stats };
  const currentLifespan = typeof s.lifespanSeconds === 'number' && !Number.isNaN(s.lifespanSeconds)
    ? s.lifespanSeconds
    : 0;
  s.lifespanSeconds = currentLifespan + deltaSec;
  // undefined면 NaN 방지 및 디지타마 초기값 누락 대비 (0으로 간주해 감소만 적용)
  const currentTimeToEvolve = typeof s.timeToEvolveSeconds === 'number' && !Number.isNaN(s.timeToEvolveSeconds) ? s.timeToEvolveSeconds : 0;
  s.timeToEvolveSeconds = Math.max(0, currentTimeToEvolve - deltaSec);

  // 배고픔/힘 감소 로직은 handleHungerTick, handleStrengthTick으로 이동
  // 이 함수는 lifespanSeconds, timeToEvolveSeconds, poop만 처리

  if (s.fullness > 0) {
    s.lastHungerZeroAt = null;
    s.hungerZeroFrozenDurationMs = 0;
  }
  if (s.strength > 0) {
    s.lastStrengthZeroAt = null;
    s.strengthZeroFrozenDurationMs = 0;
  }

  // ★ (3) poop 로직 (수면 중에는 타이머 감소하지 않음)
  if(s.poopTimer>0 && !isSleeping){
    s.poopCountdown -= deltaSec;
    if(s.poopCountdown <= 0){
      if(s.poopCount < 8){
        s.poopCount++;
        s.poopCountdown = s.poopTimer*60;

        if (s.poopCount === 8 && !s.poopReachedMaxAt) {
          const reachedMaxAt = Date.now();
          s.poopReachedMaxAt = reachedMaxAt;
          s.lastPoopPenaltyAt = reachedMaxAt;
          s.poopPenaltyFrozenDurationMs = 0;
          applyPoopInjury(s, reachedMaxAt);
        }
      } else {
        if (!s.poopReachedMaxAt) {
          const reachedMaxAt = Date.now();
          s.poopReachedMaxAt = reachedMaxAt;
          s.lastPoopPenaltyAt = reachedMaxAt;
          s.poopPenaltyFrozenDurationMs = 0;
          applyPoopInjury(s, reachedMaxAt);
        } else if (!s.lastPoopPenaltyAt) {
          s.lastPoopPenaltyAt = s.poopReachedMaxAt;
          s.poopPenaltyFrozenDurationMs = 0;
        } else {
          const elapsedSincePenalty = getElapsedTimeExcludingFridge(
            s.lastPoopPenaltyAt,
            Date.now(),
            s.frozenAt,
            s.takeOutAt,
            s.poopPenaltyFrozenDurationMs
          ) / 1000;
          const periods = Math.floor(elapsedSincePenalty / 28800);
          if (periods >= 1) {
            const penaltyTime = Date.now();
            applyPoopInjury(s, penaltyTime, periods);
            s.lastPoopPenaltyAt = penaltyTime;
            s.poopPenaltyFrozenDurationMs = 0;
          }
        }
        s.poopCountdown = s.poopTimer*60;
      }
    }
  }

  if ((s.poopCount || 0) < 8) {
    s.poopReachedMaxAt = null;
    s.lastPoopPenaltyAt = null;
    s.poopPenaltyFrozenDurationMs = 0;
  }

  const deathEvaluation = evaluateDeathConditions(s, Date.now());
  if (deathEvaluation.isDead) {
    s.isDead = true;
    if (deathEvaluation.reason) {
      s.deathReason = deathEvaluation.reason;
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
  return toTimestamp(val);
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
function pushBackdatedActivityLog(
  activityLogs,
  type,
  text,
  timestampMs,
  maxLogs = MAX_ACTIVITY_LOGS,
  extraFields = {}
) {
  const logs = Array.isArray(activityLogs) ? activityLogs : [];
  const next = [...logs, { type, text, timestamp: timestampMs, ...extraFields }];
  return next.length > maxLogs ? next.slice(-maxLogs) : next;
}

/**
 * 로그 항목의 timestamp를 ms 숫자로 정규화 (Firestore Timestamp 지원).
 * null/undefined 또는 파싱 실패 시 null 반환, 예외 없음.
 * @param {Object|null|undefined} log - 로그 객체 (timestamp 필드 보유)
 * @returns {number|null} ms 단위 타임스탬프 또는 null
 */
function logTimestampToMs(log) {
  if (log == null || typeof log !== 'object' || log.timestamp == null) return null;
  const t = log.timestamp;
  if (typeof t === 'number' && !Number.isNaN(t)) return t;
  if (typeof t === 'object' && t !== null && t.seconds != null) {
    const sec = Number(t.seconds);
    const nano = t.nanoseconds != null ? Number(t.nanoseconds) : 0;
    return Number.isNaN(sec) ? null : sec * 1000 + nano / 1e6;
  }
  try {
    const d = new Date(t);
    return isNaN(d.getTime()) ? null : d.getTime();
  } catch (_) {
    return null;
  }
}

/** 이미 동일 이벤트(타입+타임스탬프+텍스트 패턴) 로그가 있으면 true. 중복 로그/카운터 방지용. Firestore timestamp 정규화 적용 */
function alreadyHasBackdatedLog(activityLogs, type, timestampMs, textContains = '') {
  const logs = Array.isArray(activityLogs) ? activityLogs : [];
  const targetMs = typeof timestampMs === 'number' ? timestampMs : null;
  if (targetMs == null) return false;
  return logs.some((log) => {
    if (log.type !== type) return false;
    if (textContains && (!log.text || !log.text.includes(textContains))) return false;
    const logMs = logTimestampToMs(log);
    return logMs != null && logMs === targetMs;
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
export function applyLazyUpdate(
  stats,
  lastSavedAt,
  sleepSchedule = null,
  maxEnergy = null,
  options = {}
) {
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
  const digimonSnapshot = sanitizeDigimonLogSnapshot(options?.digimonSnapshot);
  migrateLegacyPoopTimers(updatedStats);
  
  // birthTime이 없으면 현재 시간으로 설정
  if (!updatedStats.birthTime) {
    updatedStats.birthTime = now.getTime();
  }
  
  // 나이는 updateAge 함수에서 자정에만 증가하도록 처리 (여기서는 계산하지 않음)
  
  // updateLifespan을 경과 시간만큼 호출
  // 하지만 한 번에 처리하는 것이 더 효율적이므로 직접 계산
  const currentLifespan = typeof updatedStats.lifespanSeconds === 'number' && !Number.isNaN(updatedStats.lifespanSeconds)
    ? updatedStats.lifespanSeconds
    : 0;
  updatedStats.lifespanSeconds = currentLifespan + elapsedSeconds;
  // undefined/NaN 방지 — 구 저장 데이터에 timeToEvolveSeconds 없을 수 있음
  const currentTte = typeof updatedStats.timeToEvolveSeconds === 'number' && !Number.isNaN(updatedStats.timeToEvolveSeconds) ? updatedStats.timeToEvolveSeconds : 0;
  updatedStats.timeToEvolveSeconds = Math.max(0, currentTte - elapsedSeconds);

  // 배고픔 감소 처리 (수면 중에는 타이머 감소하지 않음)
  if (updatedStats.hungerTimer > 0) {
    if (updatedStats.fullness > 0) {
      updatedStats.lastHungerZeroAt = null;
      updatedStats.hungerZeroFrozenDurationMs = 0;
    }

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
        updatedStats.hungerZeroFrozenDurationMs = 0;
      }
    }
  }

  // 힘 감소 처리 (수면 중에는 타이머 감소하지 않음)
  if (updatedStats.strengthTimer > 0) {
    if (updatedStats.strength > 0) {
      updatedStats.lastStrengthZeroAt = null;
      updatedStats.strengthZeroFrozenDurationMs = 0;
    }

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
        updatedStats.strengthZeroFrozenDurationMs = 0;
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
      const poopEventTime = now.getTime() + (updatedStats.poopCountdown * 1000);

      if (updatedStats.poopCount < 8) {
        updatedStats.poopCount++;

        if (updatedStats.poopCount === 8 && !updatedStats.poopReachedMaxAt) {
          const timeToMax = poopEventTime;
          updatedStats.poopReachedMaxAt = timeToMax;
          updatedStats.lastPoopPenaltyAt = timeToMax;
          updatedStats.poopPenaltyFrozenDurationMs = 0;
          applyPoopInjury(updatedStats, timeToMax);
          if (!alreadyHasBackdatedLog(updatedStats.activityLogs, 'POOP', timeToMax, 'Too much poop')) {
            updatedStats.activityLogs = pushBackdatedActivityLog(
              updatedStats.activityLogs,
              'POOP',
              'Pooped (Total: 8) - Injury: Too much poop (8 piles) [과거 재구성]',
              timeToMax,
              MAX_ACTIVITY_LOGS,
              digimonSnapshot
            );
          }
        }
        updatedStats.poopCountdown += updatedStats.poopTimer * 60;
      } else {
        migrateLegacyPoopTimers(updatedStats, poopEventTime);

        if (updatedStats.poopReachedMaxAt && !updatedStats.isInjured) {
          applyPoopInjury(updatedStats, updatedStats.poopReachedMaxAt);
          if (!alreadyHasBackdatedLog(updatedStats.activityLogs, 'POOP', updatedStats.poopReachedMaxAt, 'Too much poop')) {
            updatedStats.activityLogs = pushBackdatedActivityLog(
              updatedStats.activityLogs,
              'POOP',
              'Pooped (Total: 8) - Injury: Too much poop (8 piles) [과거 재구성]',
              updatedStats.poopReachedMaxAt,
              MAX_ACTIVITY_LOGS,
              digimonSnapshot
            );
          }
        }

        const penaltyAnchor = ensureTimestamp(updatedStats.lastPoopPenaltyAt) ?? ensureTimestamp(updatedStats.poopReachedMaxAt);
        if (penaltyAnchor) {
          const elapsedSincePenaltyMs = getElapsedTimeExcludingFridge(
            penaltyAnchor,
            now.getTime(),
            updatedStats.frozenAt,
            updatedStats.takeOutAt,
            updatedStats.poopPenaltyFrozenDurationMs
          );
          const periods = Math.floor((elapsedSincePenaltyMs / 1000) / 28800);
          if (periods >= 1) {
            const nowMs = now.getTime();
            applyPoopInjury(updatedStats, nowMs, periods);
            updatedStats.lastPoopPenaltyAt = nowMs;
            updatedStats.poopPenaltyFrozenDurationMs = 0;
            if (!alreadyHasBackdatedLog(updatedStats.activityLogs, 'POOP', nowMs, '8시간 경과')) {
              updatedStats.activityLogs = pushBackdatedActivityLog(
                updatedStats.activityLogs,
                'POOP',
                `똥 8개 방치 8시간 경과 x${periods} - 추가 부상 [과거 재구성]`,
                nowMs,
                MAX_ACTIVITY_LOGS,
                digimonSnapshot
              );
            }
          }
        }

        updatedStats.poopCountdown += updatedStats.poopTimer * 60;
      }
    }
  }

  // 사망 체크는 공통 evaluator를 기준으로 단일화
  if (!updatedStats.isDead) {
    const deathEvaluation = evaluateDeathConditions(updatedStats, now.getTime());
    if (deathEvaluation.isDead) {
      updatedStats.isDead = true;
      if (deathEvaluation.reason) {
        updatedStats.deathReason = deathEvaluation.reason;
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
    const hungerZeroTime = ensureTimestamp(updatedStats.lastHungerZeroAt);
    const hungerStartedAt = ensureTimestamp(callStatus.hunger.startedAt);
    const alreadyLogged = callStatus.hunger.isLogged === true;

    if (hungerZeroTime && alreadyLogged) {
      callStatus.hunger.isActive = false;
      callStatus.hunger.startedAt = null;
      updatedStats.hungerMistakeDeadline = null;
    } else if (hungerZeroTime) {
      if (!hungerStartedAt) {
        callStatus.hunger.isActive = true;
        callStatus.hunger.startedAt = hungerZeroTime;
      } else {
        callStatus.hunger.isActive = true;
      }

      if (!updatedStats.hungerMistakeDeadline) {
        updatedStats.hungerMistakeDeadline = hungerZeroTime + HUNGER_CALL_TIMEOUT;
      }

      const activeStartedAt = ensureTimestamp(callStatus.hunger.startedAt);
      if (activeStartedAt) {
        const elapsed = now.getTime() - activeStartedAt;
        if (elapsed < HUNGER_CALL_TIMEOUT) {
          callStatus.hunger.isLogged = false;
        }
      }

      if (activeStartedAt && sleepSchedule) {
        const sleepDuringCall = calculateSleepSecondsInRange(activeStartedAt, now.getTime(), sleepSchedule);
        const totalElapsedMs = now.getTime() - activeStartedAt;
        const activeCallDurationMs = totalElapsedMs - (sleepDuringCall * 1000);

        if (activeCallDurationMs > HUNGER_CALL_TIMEOUT) {
          const timeoutOccurredAt = activeStartedAt + HUNGER_CALL_TIMEOUT;
          if (!alreadyLogged) {
            const result = appendCareMistakeEntry(updatedStats, {
              occurredAt: timeoutOccurredAt,
              reasonKey: "hunger_call",
              text: "케어미스(사유: 배고픔 콜 10분 무시) [과거 재구성]",
              source: "backfill",
            });
            updatedStats.careMistakes = result.nextStats.careMistakes;
            updatedStats.careMistakeLedger = result.nextStats.careMistakeLedger;
            if (result.added &&
                !alreadyHasBackdatedLog(updatedStats.activityLogs, 'CAREMISTAKE', timeoutOccurredAt, '배고픔 콜')) {
              updatedStats.activityLogs = pushBackdatedActivityLog(
                updatedStats.activityLogs,
                'CAREMISTAKE',
                '케어미스(사유: 배고픔 콜 10분 무시) [과거 재구성]',
                timeoutOccurredAt
              );
            }
            callStatus.hunger.isLogged = true;
          }
          callStatus.hunger.isActive = false;
          callStatus.hunger.startedAt = null;
          updatedStats.hungerMistakeDeadline = null;
        } else {
          const pushedStart = activeStartedAt + (sleepDuringCall * 1000);
          callStatus.hunger.startedAt = Math.min(now.getTime(), pushedStart);
        }
      } else if (activeStartedAt) {
        const elapsed = now.getTime() - activeStartedAt;
        if (elapsed > HUNGER_CALL_TIMEOUT) {
          const timeoutOccurredAt = activeStartedAt + HUNGER_CALL_TIMEOUT;
          if (!alreadyLogged) {
            const result = appendCareMistakeEntry(updatedStats, {
              occurredAt: timeoutOccurredAt,
              reasonKey: "hunger_call",
              text: "케어미스(사유: 배고픔 콜 10분 무시) [과거 재구성]",
              source: "backfill",
            });
            updatedStats.careMistakes = result.nextStats.careMistakes;
            updatedStats.careMistakeLedger = result.nextStats.careMistakeLedger;
            if (result.added &&
                !alreadyHasBackdatedLog(updatedStats.activityLogs, 'CAREMISTAKE', timeoutOccurredAt, '배고픔 콜')) {
              updatedStats.activityLogs = pushBackdatedActivityLog(
                updatedStats.activityLogs,
                'CAREMISTAKE',
                '케어미스(사유: 배고픔 콜 10분 무시) [과거 재구성]',
                timeoutOccurredAt
              );
            }
            callStatus.hunger.isLogged = true;
          }
          callStatus.hunger.isActive = false;
          callStatus.hunger.startedAt = null;
          updatedStats.hungerMistakeDeadline = null;
        }
      }
    } else {
      callStatus.hunger.isActive = false;
      callStatus.hunger.startedAt = null;
      updatedStats.hungerMistakeDeadline = null;
    }
  } else {
    callStatus.hunger.isActive = false;
    callStatus.hunger.startedAt = null;
    callStatus.hunger.isLogged = false;
    updatedStats.lastHungerZeroAt = null;
    updatedStats.hungerZeroFrozenDurationMs = 0;
    updatedStats.hungerMistakeDeadline = null;
  }

  // Strength 호출 처리
  if (updatedStats.strength === 0) {
    const strengthZeroTime = ensureTimestamp(updatedStats.lastStrengthZeroAt);
    const strengthStartedAt = ensureTimestamp(callStatus.strength.startedAt);
    const alreadyLogged = callStatus.strength.isLogged === true;

    if (strengthZeroTime && alreadyLogged) {
      callStatus.strength.isActive = false;
      callStatus.strength.startedAt = null;
      updatedStats.strengthMistakeDeadline = null;
    } else if (strengthZeroTime) {
      if (!strengthStartedAt) {
        callStatus.strength.isActive = true;
        callStatus.strength.startedAt = strengthZeroTime;
      } else {
        callStatus.strength.isActive = true;
      }

      if (!updatedStats.strengthMistakeDeadline) {
        updatedStats.strengthMistakeDeadline = strengthZeroTime + STRENGTH_CALL_TIMEOUT;
      }

      const activeStartedAt = ensureTimestamp(callStatus.strength.startedAt);
      if (activeStartedAt) {
        const strengthElapsed = now.getTime() - activeStartedAt;
        if (strengthElapsed < STRENGTH_CALL_TIMEOUT) {
          callStatus.strength.isLogged = false;
        }
      }

      if (activeStartedAt && sleepSchedule) {
        const sleepDuringCall = calculateSleepSecondsInRange(activeStartedAt, now.getTime(), sleepSchedule);
        const totalElapsedMs = now.getTime() - activeStartedAt;
        const activeCallDurationMs = totalElapsedMs - (sleepDuringCall * 1000);

        if (activeCallDurationMs > STRENGTH_CALL_TIMEOUT) {
          const timeoutOccurredAt = activeStartedAt + STRENGTH_CALL_TIMEOUT;
          if (!alreadyLogged) {
            const result = appendCareMistakeEntry(updatedStats, {
              occurredAt: timeoutOccurredAt,
              reasonKey: "strength_call",
              text: "케어미스(사유: 힘 콜 10분 무시) [과거 재구성]",
              source: "backfill",
            });
            updatedStats.careMistakes = result.nextStats.careMistakes;
            updatedStats.careMistakeLedger = result.nextStats.careMistakeLedger;
            if (result.added &&
                !alreadyHasBackdatedLog(updatedStats.activityLogs, 'CAREMISTAKE', timeoutOccurredAt, '힘 콜')) {
              updatedStats.activityLogs = pushBackdatedActivityLog(
                updatedStats.activityLogs,
                'CAREMISTAKE',
                '케어미스(사유: 힘 콜 10분 무시) [과거 재구성]',
                timeoutOccurredAt
              );
            }
            callStatus.strength.isLogged = true;
          }
          callStatus.strength.isActive = false;
          callStatus.strength.startedAt = null;
          updatedStats.strengthMistakeDeadline = null;
        } else {
          const pushedStart = activeStartedAt + (sleepDuringCall * 1000);
          callStatus.strength.startedAt = Math.min(now.getTime(), pushedStart);
        }
      } else if (activeStartedAt) {
        const elapsed = now.getTime() - activeStartedAt;
        if (elapsed > STRENGTH_CALL_TIMEOUT) {
          const timeoutOccurredAt = activeStartedAt + STRENGTH_CALL_TIMEOUT;
          if (!alreadyLogged) {
            const result = appendCareMistakeEntry(updatedStats, {
              occurredAt: timeoutOccurredAt,
              reasonKey: "strength_call",
              text: "케어미스(사유: 힘 콜 10분 무시) [과거 재구성]",
              source: "backfill",
            });
            updatedStats.careMistakes = result.nextStats.careMistakes;
            updatedStats.careMistakeLedger = result.nextStats.careMistakeLedger;
            if (result.added &&
                !alreadyHasBackdatedLog(updatedStats.activityLogs, 'CAREMISTAKE', timeoutOccurredAt, '힘 콜')) {
              updatedStats.activityLogs = pushBackdatedActivityLog(
                updatedStats.activityLogs,
                'CAREMISTAKE',
                '케어미스(사유: 힘 콜 10분 무시) [과거 재구성]',
                timeoutOccurredAt
              );
            }
            callStatus.strength.isLogged = true;
          }
          callStatus.strength.isActive = false;
          callStatus.strength.startedAt = null;
          updatedStats.strengthMistakeDeadline = null;
        }
      }
    } else {
      callStatus.strength.isActive = false;
      callStatus.strength.startedAt = null;
      updatedStats.strengthMistakeDeadline = null;
    }
  } else {
    callStatus.strength.isActive = false;
    callStatus.strength.startedAt = null;
    callStatus.strength.isLogged = false;
    updatedStats.lastStrengthZeroAt = null;
    updatedStats.strengthZeroFrozenDurationMs = 0;
    updatedStats.strengthMistakeDeadline = null;
  }

  // Sleep 호출 처리 (수면 주기당 1회만)
  // 수면 호출은 실시간으로만 처리 (Lazy Update에서는 처리하지 않음)
  // 이유: 수면 호출은 수면 시간이 시작될 때 한 번만 발생해야 하므로

  // 나이 업데이트: 마지막 저장 시간부터 현재까지의 모든 자정 체크
  updatedStats = updateAgeWithLazyUpdate(updatedStats, lastSaved, now);

  // 마지막 저장 시간 업데이트
  updatedStats.lastSavedAt = now;
  delete updatedStats.lastMaxPoopTime;

  return updatedStats;
}
