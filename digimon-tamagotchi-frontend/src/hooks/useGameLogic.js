// src/hooks/useGameLogic.js
// 수면 상태 계산 유틸리티

/**
 * 수면 상태를 계산한다.
 * @param {Object} params
 * @param {{start:number,end:number}} params.sleepSchedule - 수면 스케줄 (시 단위)
 * @param {boolean} params.isLightsOn - 조명 상태
 * @param {number|Date|string|null} params.wakeUntil - 강제 기상 유지 만료 시간
 * @param {Date} [params.now] - 현재 시간 (테스트용)
 * @returns {'AWAKE'|'TIRED'|'SLEEPING'}
 */
export function getSleepStatus({ sleepSchedule, isLightsOn, wakeUntil, now = new Date() }) {
  const hour = now.getHours();
  const { start = 22, end = 6 } = sleepSchedule || { start: 22, end: 6 };

  const wakeOverride = wakeUntil ? new Date(wakeUntil).getTime() > now.getTime() : false;

  const isSleepTime = (() => {
    if (start === end) return false;
    if (start < end) return hour >= start && hour < end;
    // 자정 넘김 케이스 (예: 22시~08시)
    return hour >= start || hour < end;
  })();

  // 깨어있기로 설정된 시간이 남아 있으면 무조건 AWAKE
  if (wakeOverride) return "AWAKE";
  if (!isSleepTime) return "AWAKE";

  // 수면 시간인 경우
  if (isLightsOn) return "TIRED";
  return "SLEEPING";
}

export default getSleepStatus;

