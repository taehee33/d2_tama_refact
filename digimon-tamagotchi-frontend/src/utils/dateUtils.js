// src/utils/dateUtils.js

/**
 * 타임스탬프를 읽기 쉬운 형식으로 포맷팅
 * @param {number|Date|string} timestamp - 밀리초 타임스탬프, Date 객체, 또는 ISO 문자열
 * @param {string} format - 포맷 옵션 ('short' | 'long' | 'time')
 * @returns {string} 포맷팅된 날짜 문자열
 */
export function formatTimestamp(timestamp, format = 'short') {
  if (!timestamp) return 'N/A';
  
  let date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    return 'N/A';
  }
  
  if (isNaN(date.getTime())) {
    return 'N/A';
  }
  
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  switch (format) {
    case 'long':
      return `${date.getFullYear()}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    case 'time':
      return `${hours}:${minutes}:${seconds}`;
    case 'short':
    default:
      return `${month}/${day} ${hours}:${minutes}`;
  }
}

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


