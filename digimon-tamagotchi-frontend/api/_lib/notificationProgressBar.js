"use strict";

const PROGRESS_BAR_SEGMENTS = 20;

function formatNotificationProgressBar(elapsedMs, thresholdMs) {
  const safeThresholdMs = Number(thresholdMs);
  if (!Number.isFinite(safeThresholdMs) || safeThresholdMs <= 0) return null;

  const safeElapsedMs = Number.isFinite(Number(elapsedMs)) ? Number(elapsedMs) : 0;
  const progressRatio = Math.min(1, Math.max(0, safeElapsedMs / safeThresholdMs));
  const filledSegments = Math.round(progressRatio * PROGRESS_BAR_SEGMENTS);
  const emptySegments = PROGRESS_BAR_SEGMENTS - filledSegments;
  const progressPercentage = Math.floor(progressRatio * 100);
  return `\`${"█".repeat(filledSegments)}${"░".repeat(emptySegments)}\` ${progressPercentage}%`;
}

module.exports = {
  formatNotificationProgressBar,
};
