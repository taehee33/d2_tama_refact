import { finalizeOnlineJogressCompletionState } from "./jogressCompletionHelpers";

describe("jogressCompletionHelpers", () => {
  test("finalizeOnlineJogressCompletionState는 온라인 조그레스 완료 상태를 반영한다", () => {
    const setEvolutionCompleteIsJogress = jest.fn();
    const setEvolvedDigimonName = jest.fn();
    const setEvolutionStage = jest.fn();

    finalizeOnlineJogressCompletionState({
      resultDisplayName: "오메가몬",
      setEvolutionCompleteIsJogress,
      setEvolvedDigimonName,
      setEvolutionStage,
    });

    expect(setEvolutionCompleteIsJogress).toHaveBeenCalledWith(true);
    expect(setEvolvedDigimonName).toHaveBeenCalledWith("오메가몬");
    expect(setEvolutionStage).toHaveBeenCalledWith("complete");
  });

  test("finalizeOnlineJogressCompletionState는 없는 setter를 건너뛴다", () => {
    expect(() =>
      finalizeOnlineJogressCompletionState({
        resultDisplayName: "오메가몬",
      })
    ).not.toThrow();
  });
});
