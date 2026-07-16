const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const KST_DAY_MS = 24 * 60 * 60 * 1000;
const KST_HALF_HOUR_MS = 30 * 60 * 1000;

function pad(value) {
  return String(value).padStart(2, "0");
}

export function getKstDateParts(value) {
  const timestamp = toEpochMs(value);
  if (timestamp == null) {
    return null;
  }

  const date = new Date(timestamp + KST_OFFSET_MS);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hours: date.getUTCHours(),
    minutes: date.getUTCMinutes(),
    seconds: date.getUTCSeconds(),
    milliseconds: date.getUTCMilliseconds(),
  };
}

export function getKstMinutesOfDay(value = Date.now()) {
  const parts = getKstDateParts(value);
  if (!parts) {
    return null;
  }

  return parts.hours * 60 + parts.minutes;
}

export function getKstDateTimeMs(
  {
    year,
    month,
    day,
    hours = 0,
    minutes = 0,
    seconds = 0,
    milliseconds = 0,
  } = {},
  dayOffset = 0
) {
  const values = [
    year,
    month,
    day,
    hours,
    minutes,
    seconds,
    milliseconds,
    dayOffset,
  ].map(Number);

  if (values.some((value) => !Number.isFinite(value))) {
    return null;
  }

  const [
    safeYear,
    safeMonth,
    safeDay,
    safeHours,
    safeMinutes,
    safeSeconds,
    safeMilliseconds,
    safeDayOffset,
  ] = values;

  return (
    Date.UTC(
      safeYear,
      safeMonth - 1,
      safeDay + safeDayOffset,
      safeHours,
      safeMinutes,
      safeSeconds,
      safeMilliseconds
    ) - KST_OFFSET_MS
  );
}

export function getKstTimeOnDateMs(
  baseValue,
  hours,
  minutes = 0,
  dayOffset = 0
) {
  const parts = getKstDateParts(baseValue);
  if (!parts) {
    return null;
  }

  return getKstDateTimeMs(
    {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hours,
      minutes,
    },
    dayOffset
  );
}

export function getNextKstHalfHourBoundaryMs(value = Date.now()) {
  const timestamp = toEpochMs(value);
  if (timestamp == null) {
    return null;
  }

  return (
    (Math.floor((timestamp + KST_OFFSET_MS) / KST_HALF_HOUR_MS) + 1) *
      KST_HALF_HOUR_MS -
    KST_OFFSET_MS
  );
}

export function formatKstTime(value) {
  const parts = getKstDateParts(value);
  if (!parts) {
    return "";
  }

  const period = parts.hours >= 12 ? "오후" : "오전";
  const hour12 =
    parts.hours > 12 ? parts.hours - 12 : parts.hours === 0 ? 12 : parts.hours;

  return `${period} ${hour12}:${pad(parts.minutes)}`;
}

export function toEpochMs(value) {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  if (typeof value === "object") {
    if (typeof value.toMillis === "function") {
      try {
        const timestamp = value.toMillis();
        return Number.isFinite(timestamp) ? timestamp : null;
      } catch (_error) {
        return null;
      }
    }

    if (typeof value.toDate === "function") {
      try {
        const date = value.toDate();
        if (date instanceof Date) {
          const timestamp = date.getTime();
          return Number.isFinite(timestamp) ? timestamp : null;
        }
      } catch (_error) {
        return null;
      }
    }

    if ("seconds" in value) {
      const seconds = Number(value.seconds);
      const nanoseconds =
        value.nanoseconds != null ? Number(value.nanoseconds) : 0;
      const timestamp = seconds * 1000 + nanoseconds / 1000000;
      return Number.isFinite(timestamp) ? timestamp : null;
    }
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function getStartOfKstDayMs(value = Date.now()) {
  const timestamp = toEpochMs(value);
  if (timestamp == null) {
    return null;
  }

  return (
    Math.floor((timestamp + KST_OFFSET_MS) / KST_DAY_MS) * KST_DAY_MS -
    KST_OFFSET_MS
  );
}

export function isSameKstDay(left, right) {
  const leftDayStart = getStartOfKstDayMs(left);
  const rightDayStart = getStartOfKstDayMs(right);

  if (leftDayStart == null || rightDayStart == null) {
    return false;
  }

  return leftDayStart === rightDayStart;
}

export function formatTimestamp(timestamp, format = "short") {
  const parts = getKstDateParts(timestamp);
  if (!parts) {
    return "N/A";
  }

  const month = pad(parts.month);
  const day = pad(parts.day);
  const hours = pad(parts.hours);
  const minutes = pad(parts.minutes);
  const seconds = pad(parts.seconds);

  switch (format) {
    case "long":
      return `${parts.year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    case "time":
      return `${hours}:${minutes}:${seconds}`;
    case "short":
    default:
      return `${month}/${day} ${hours}:${minutes}`;
  }
}

export function formatSlotCreatedAt(value) {
  if (value == null || value === "") {
    return "";
  }

  const timestamp = toEpochMs(value);
  if (timestamp == null) {
    return String(value);
  }

  return new Date(timestamp).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
  });
}

export { KST_DAY_MS };
