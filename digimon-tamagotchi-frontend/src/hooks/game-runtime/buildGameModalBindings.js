import { getSleepSchedule } from "../useGameHandlers";

export function buildGameModalBindings({
  handlersInput,
  dataInput,
  uiState,
  statusDetailMessages,
  selectedDigimon,
  digimonDataForSlot,
  digimonStats,
  wakeUntil,
  sleepStatus,
}) {
  return {
    handlers: {
      ...handlersInput,
    },
    data: {
      ...dataInput,
    },
    ui: {
      ...uiState,
      statusDetailMessages,
      sleepSchedule: getSleepSchedule(selectedDigimon, digimonDataForSlot, digimonStats),
      sleepStatus,
      wakeUntil,
      sleepLightOnStart: digimonStats.sleepLightOnStart || null,
    },
  };
}
