import { getSleepSchedule } from "../useGameHandlers";
import { isJogressPartnerSupportedInApp } from "../../utils/jogressUtils";

function formatCurrentTime(customTime) {
  return customTime.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function buildHeaderDigimonLabel({
  selectedDigimon,
  digimonNickname,
  evolutionDataForSlot,
}) {
  const digimonName =
    evolutionDataForSlot?.[selectedDigimon]?.name || selectedDigimon;
  const nickname = typeof digimonNickname === "string" ? digimonNickname.trim() : "";

  return nickname ? `${nickname}(${digimonName})` : digimonName;
}

export function buildGamePageViewModel({
  selectedDigimon,
  digimonNickname,
  evolutionDataForSlot,
  digimonStats,
  activityLogs,
  digimonDataForSlot,
  customTime,
  slotVersion = "Ver.1",
  slotJogressStatus,
  currentAnimation,
  feedType,
  isEvoEnabled,
  isEvolving,
  width,
  height,
  backgroundNumber,
  feedStep,
  foodSizeScale,
  cleanStep,
  sleepStatus,
  isLightsOn,
  modals,
  evolutionStage,
  developerMode,
  wakeUntil,
  deathReason,
}) {
  const statsLogs = Array.isArray(digimonStats?.activityLogs) ? digimonStats.activityLogs : [];
  const displayActivityLogs =
    Array.isArray(activityLogs) && activityLogs.length >= statsLogs.length
      ? activityLogs
      : statsLogs;
  const displayDigimonStats =
    displayActivityLogs === statsLogs
      ? digimonStats
      : {
          ...digimonStats,
          activityLogs: displayActivityLogs,
        };
  const sleepSchedule = getSleepSchedule(
    selectedDigimon,
    digimonDataForSlot,
    digimonStats
  );
  const currentDigimonDataForEvo = evolutionDataForSlot?.[selectedDigimon];
  const supportsOnlineJogress =
    slotVersion === "Ver.1" || slotVersion === "Ver.2";
  const canJogressEvolve = Boolean(
    currentDigimonDataForEvo?.evolutions?.some(
      (e) => e.jogress && isJogressPartnerSupportedInApp(e.jogress)
    )
  );
  const hasUnavailableJogress = Boolean(
    currentDigimonDataForEvo?.evolutions?.some(
      (e) => e.jogress && !isJogressPartnerSupportedInApp(e.jogress)
    )
  );
  const hasNormalEvolution = Boolean(
    currentDigimonDataForEvo?.evolutions?.some((e) => !e.jogress)
  );

  return {
    headerDigimonLabel: buildHeaderDigimonLabel({
      selectedDigimon,
      digimonNickname,
      evolutionDataForSlot,
    }),
    currentTimeText: formatCurrentTime(customTime),
    sleepSchedule,
    statusBadgeProps: {
      digimonStats,
      sleepStatus,
      isDead: digimonStats.isDead,
      currentAnimation,
      feedType,
      canEvolve: isEvoEnabled,
      sleepSchedule,
      wakeUntil,
      sleepLightOnStart: digimonStats.sleepLightOnStart || null,
      deathReason: deathReason || digimonStats.deathReason || null,
    },
    controlPanelProps: {
      width,
      height,
      sleepStatus,
      isFrozen: digimonStats.isFrozen || false,
      isLightsOn,
    },
    gameScreenDisplayProps: {
      width,
      height,
      backgroundNumber,
      currentAnimation,
      showFood: modals.food,
      feedStep,
      feedType,
      foodSizeScale,
      poopCount: digimonStats.poopCount || 0,
      showPoopCleanAnimation: modals.poopCleanAnimation,
      cleanStep,
      sleepStatus,
      isLightsOn,
      digimonStats: displayDigimonStats,
      selectedDigimon,
      showHealAnimation: modals.healAnimation,
      showCallModal: modals.call,
      isFrozen: digimonStats.isFrozen || false,
      frozenAt: digimonStats.frozenAt || null,
      takeOutAt: digimonStats.takeOutAt || null,
      evolutionStage,
      developerMode,
      isRefused: currentAnimation === "foodRejectRefuse" && feedType === "meat",
    },
    jogressControls: {
      canJogressEvolve,
      hasNormalEvolution,
      showEvolutionButton: hasNormalEvolution || canJogressEvolve,
      isEvolving,
      jogressLabel: slotJogressStatus?.canEvolve
        ? "(조그레스 진화 가능)"
        : slotJogressStatus?.isWaiting
          ? "(대기중)"
          : canJogressEvolve && !supportsOnlineJogress
            ? "(로컬 전용)"
          : hasUnavailableJogress
            ? "(가이드 확인)"
            : "(-)",
    },
  };
}
