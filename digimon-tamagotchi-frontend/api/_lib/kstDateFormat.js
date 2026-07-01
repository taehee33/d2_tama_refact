"use strict";

const KST_TIME_ZONE = "Asia/Seoul";

function toSafeDate(date = new Date()) {
  const sourceDate = date instanceof Date ? date : new Date(date);
  return Number.isNaN(sourceDate.getTime()) ? new Date() : sourceDate;
}

function getKstParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: KST_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return formatter.formatToParts(toSafeDate(date)).reduce((parts, part) => {
    if (part.type !== "literal") {
      parts[part.type] = part.value;
    }
    return parts;
  }, {});
}

function formatKstDate(date = new Date()) {
  const parts = getKstParts(date);
  return `${parts.year}. ${parts.month}. ${parts.day}. ${parts.dayPeriod} ${parts.hour}:${parts.minute}:${parts.second}`;
}

module.exports = {
  formatKstDate,
};
