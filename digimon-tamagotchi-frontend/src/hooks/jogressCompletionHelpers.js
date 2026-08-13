import { MAX_ACTIVITY_LOGS } from "../constants/activityLogs";

export function mergeJogressActivityLog(currentLogs = [], serverLog = null) {
  const logs = Array.isArray(currentLogs) ? currentLogs : [];
  if (!serverLog || typeof serverLog !== "object") return logs;

  const eventId = typeof serverLog.eventId === "string"
    ? serverLog.eventId.trim()
    : "";
  const withoutDuplicate = eventId
    ? logs.filter((log) => log?.eventId !== eventId)
    : logs;
  return [...withoutDuplicate, serverLog].slice(-MAX_ACTIVITY_LOGS);
}

export function finalizeOnlineJogressCompletionState({
  resultDisplayName,
  setEvolutionCompleteIsJogress,
  setEvolvedDigimonName,
  setEvolutionStage,
}) {
  if (typeof setEvolutionCompleteIsJogress === "function") {
    setEvolutionCompleteIsJogress(true);
  }

  if (typeof setEvolvedDigimonName === "function") {
    setEvolvedDigimonName(resultDisplayName);
  }

  if (typeof setEvolutionStage === "function") {
    setEvolutionStage("complete");
  }
}
