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
