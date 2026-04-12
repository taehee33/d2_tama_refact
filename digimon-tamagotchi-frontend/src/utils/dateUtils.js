// src/utils/dateUtils.js

export { formatSlotCreatedAt, formatTimestamp } from "./time";

/**
 * 경과 시간을 읽기 쉬운 형식으로 포맷팅
 * @param {number} seconds - 경과 시간 (초)
 * @returns {string} 포맷팅된 시간 문자열 (예: "1 day 2 hours 30 min")
 */
export function formatElapsedTime(seconds) {
  if (!seconds || seconds < 0) return '0 sec';
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} min`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs} sec`);
  
  return parts.join(' ');
}



