function formatCountdown(countdownSeconds = 0) {
  const safeSeconds = Number.isFinite(Number(countdownSeconds))
    ? Math.max(0, Number(countdownSeconds))
    : 0;

  if (safeSeconds <= 0) {
    return "0s";
  }

  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}m ${seconds}s`;
}

export function getInternalCounterTimerDisplay({
  evolutionStage,
  timerKind,
  timerMinutes,
  countdownSeconds,
}) {
  const safeMinutes = Number.isFinite(Number(timerMinutes))
    ? Math.max(0, Number(timerMinutes))
    : 0;
  const normalizedStage = String(evolutionStage || "").trim().toLowerCase();

  if (safeMinutes <= 0) {
    return {
      label: "비활성",
      countdownLabel: "",
      showCountdown: false,
    };
  }

  if (
    timerKind === "poop" &&
    normalizedStage === "digitama" &&
    safeMinutes >= 999
  ) {
    return {
      label: "알 단계 전용",
      countdownLabel: "",
      showCountdown: false,
    };
  }

  return {
    label: `${safeMinutes} min`,
    countdownLabel: formatCountdown(countdownSeconds),
    showCountdown: true,
  };
}
