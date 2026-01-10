// src/utils/sleepUtils.js
// 수면 관련 유틸리티 함수

/**
 * 수면까지 남은 시간을 계산합니다.
 * @param {Object} sleepSchedule - 수면 스케줄 { start: number, end: number }
 * @param {Date} now - 현재 시간 (기본값: new Date())
 * @returns {string} "X시간 Y분 후" 형식의 문자열
 */
export function getTimeUntilSleep(sleepSchedule, now = new Date()) {
  if (!sleepSchedule || sleepSchedule.start === undefined) {
    return "정보 없음";
  }
  
  const hour = now.getHours();
  const minute = now.getMinutes();
  const { start } = sleepSchedule;
  
  // 수면 시간이 이미 지났는지 확인
  if (hour < start) {
    // 오늘 수면 시간까지
    const hoursUntil = start - hour - 1;
    const minutesUntil = 60 - minute;
    
    if (hoursUntil > 0) {
      return `${hoursUntil}시간 ${minutesUntil}분 후`;
    } else {
      return `${minutesUntil}분 후`;
    }
  } else {
    // 내일 수면 시간까지
    const hoursUntil = 24 - hour - 1 + start;
    const minutesUntil = 60 - minute;
    
    if (hoursUntil > 0) {
      return `${hoursUntil}시간 ${minutesUntil}분 후`;
    } else {
      return `${minutesUntil}분 후`;
    }
  }
}

/**
 * 기상까지 남은 시간을 계산합니다.
 * @param {Object} sleepSchedule - 수면 스케줄 { start: number, end: number }
 * @param {Date} now - 현재 시간 (기본값: new Date())
 * @returns {string} "X시간 Y분 후" 형식의 문자열
 */
export function getTimeUntilWake(sleepSchedule, now = new Date()) {
  if (!sleepSchedule || sleepSchedule.end === undefined) {
    return "정보 없음";
  }
  
  const hour = now.getHours();
  const minute = now.getMinutes();
  const { end } = sleepSchedule;
  
  // 기상 시간이 이미 지났는지 확인
  if (hour < end) {
    // 오늘 기상 시간까지
    const hoursUntil = end - hour - 1;
    const minutesUntil = 60 - minute;
    
    if (hoursUntil > 0) {
      return `${hoursUntil}시간 ${minutesUntil}분 후`;
    } else {
      return `${minutesUntil}분 후`;
    }
  } else {
    // 내일 기상 시간까지
    const hoursUntil = 24 - hour - 1 + end;
    const minutesUntil = 60 - minute;
    
    if (hoursUntil > 0) {
      return `${hoursUntil}시간 ${minutesUntil}분 후`;
    } else {
      return `${minutesUntil}분 후`;
    }
  }
}

/**
 * 수면 시간을 포맷팅합니다.
 * @param {Object} sleepSchedule - 수면 스케줄 { start: number, end: number }
 * @returns {string} "오후 10:00 - 오전 6:00" 형식의 문자열
 */
export function formatSleepSchedule(sleepSchedule) {
  if (!sleepSchedule || sleepSchedule.start === undefined || sleepSchedule.end === undefined) {
    return "정보 없음";
  }
  
  const { start, end } = sleepSchedule;
  const startPeriod = start >= 12 ? '오후' : '오전';
  const endPeriod = end >= 12 ? '오후' : '오전';
  const startHour12 = start > 12 ? start - 12 : (start === 0 ? 12 : start);
  const endHour12 = end > 12 ? end - 12 : (end === 0 ? 12 : end);
  
  return `${startPeriod} ${startHour12}:00 - ${endPeriod} ${endHour12}:00`;
}

/**
 * 특정 기간 내에 포함된 수면 시간(초)을 계산합니다.
 * @param {number|Date} startTime - 시작 시간 (timestamp 또는 Date)
 * @param {number|Date} endTime - 종료 시간 (timestamp 또는 Date)
 * @param {Object} schedule - 수면 스케줄 { start: number, end: number }
 * @returns {number} 수면 시간(초)
 */
export function calculateSleepSecondsInRange(startTime, endTime, schedule) {
  if (!schedule || schedule.start === undefined || schedule.end === undefined) {
    return 0;
  }

  const startMs = startTime instanceof Date ? startTime.getTime() : startTime;
  const endMs = endTime instanceof Date ? endTime.getTime() : endTime;
  
  if (startMs >= endMs) {
    return 0;
  }

  const { start, end } = schedule;
  let sleepMs = 0;
  
  // 최대 7일(604800000ms)로 제한하여 성능 보호
  const maxRange = 7 * 24 * 60 * 60 * 1000;
  const actualEnd = Math.min(endMs, startMs + maxRange);
  
  // 1분(60,000ms) 단위로 루프를 돌며 체크
  const step = 60 * 1000;
  let current = new Date(startMs);
  const finish = new Date(actualEnd);
  
  while (current < finish) {
    const hour = current.getHours();
    let isSleep = false;
    
    if (start < end) {
      // 일반 케이스 (예: 14:00 ~ 16:00)
      isSleep = hour >= start && hour < end;
    } else {
      // 자정 넘김 케이스 (예: 22:00 ~ 06:00)
      isSleep = hour >= start || hour < end;
    }
    
    if (isSleep) {
      sleepMs += step;
    }
    
    current = new Date(current.getTime() + step);
  }
  
  return Math.floor(sleepMs / 1000);
}

