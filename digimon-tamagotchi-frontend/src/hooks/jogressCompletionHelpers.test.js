import {
  finalizeOnlineJogressCompletionState,
  mergeJogressActivityLog,
} from "./jogressCompletionHelpers";

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

  test("로컬 조그레스 서버 로그를 eventId로 중복 없이 현재 생애 이력에 반영한다", () => {
    const previous = Array.from({ length: 50 }, (_, index) => ({
      eventId: `event-${index}`,
      timestamp: index,
    }));
    const serverLog = {
      eventId: "jogress:local:current",
      type: "EVOLUTION",
      timestamp: 100,
    };

    const first = mergeJogressActivityLog(previous, serverLog);
    const retry = mergeJogressActivityLog(first, serverLog);

    expect(first).toHaveLength(50);
    expect(first[first.length - 1]).toEqual(serverLog);
    expect(retry.filter((log) => log.eventId === serverLog.eventId)).toHaveLength(1);
  });
});
