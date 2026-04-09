const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const KST_DAY_MS = 24 * 60 * 60 * 1000;

function pad(value) {
  return String(value).padStart(2, "0");
}

function getKstDateParts(value) {
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
  };
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
