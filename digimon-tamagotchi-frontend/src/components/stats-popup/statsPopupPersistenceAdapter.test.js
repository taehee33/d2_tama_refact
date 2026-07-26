import {
  persistStatsPopupChange,
  persistStatsPopupNocturnalChange,
} from "./statsPopupPersistenceAdapter";

describe("statsPopupPersistenceAdapter", () => {
  test("stats payload를 변경 없이 callback에 전달한다", () => {
    const onChangeStats = jest.fn();
    const nextStats = { fullness: 3 };
    persistStatsPopupChange({ onChangeStats, nextStats });
    expect(onChangeStats).toHaveBeenCalledWith(nextStats);
  });

  test("로그 append를 시작한 뒤 기다리지 않고 stats callback을 호출한다", () => {
    const order = [];
    const appendLogToSubcollection = jest.fn(() => {
      order.push("append");
      return Promise.resolve();
    });
    const onChangeStats = jest.fn(() => order.push("stats"));
    const mutation = { logPayload: { text: "로그" }, nextStats: { isNocturnal: true } };

    persistStatsPopupNocturnalChange({ appendLogToSubcollection, onChangeStats, mutation });

    expect(order).toEqual(["append", "stats"]);
    expect(appendLogToSubcollection).toHaveBeenCalledWith(mutation.logPayload);
    expect(onChangeStats).toHaveBeenCalledWith(mutation.nextStats);
  });

  test("로그 append rejection을 무시하고 stats callback 결과를 유지한다", async () => {
    const appendLogToSubcollection = jest.fn(() => Promise.reject(new Error("실패")));
    const onChangeStats = jest.fn();
    const mutation = { logPayload: {}, nextStats: { isNocturnal: false } };

    persistStatsPopupNocturnalChange({ appendLogToSubcollection, onChangeStats, mutation });
    await Promise.resolve();

    expect(onChangeStats).toHaveBeenCalledWith(mutation.nextStats);
  });
});
