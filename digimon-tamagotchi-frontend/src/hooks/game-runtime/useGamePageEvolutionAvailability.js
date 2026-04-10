import { useEffect } from "react";
import { shouldEnableEvolutionButton } from "./gamePageActionHelpers";

export function useGamePageEvolutionAvailability({
  isLoadingSlot,
  digimonStats,
  developerMode,
  ignoreEvolutionTime,
  selectedDigimon,
  evolutionDataForSlot,
  setIsEvoEnabled,
  customTime,
}) {
  useEffect(() => {
    void customTime;
    setIsEvoEnabled(
      shouldEnableEvolutionButton({
        isLoadingSlot,
        digimonStats,
        developerMode,
        ignoreEvolutionTime,
        selectedDigimon,
        evolutionDataForSlot,
      })
    );
  }, [
    customTime,
    developerMode,
    digimonStats,
    evolutionDataForSlot,
    ignoreEvolutionTime,
    isLoadingSlot,
    selectedDigimon,
    setIsEvoEnabled,
  ]);
}
