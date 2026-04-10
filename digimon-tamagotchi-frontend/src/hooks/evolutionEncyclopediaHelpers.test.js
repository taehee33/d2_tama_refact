import { syncEvolutionEncyclopediaEntries } from "./evolutionEncyclopediaHelpers";

const mockUpdateEncyclopedia = jest.fn();

jest.mock("./useEncyclopedia", () => ({
  updateEncyclopedia: (...args) => mockUpdateEncyclopedia(...args),
}));

describe("evolutionEncyclopediaHelpers", () => {
  const currentUser = { uid: "user-1" };
  const previousStats = { stage: "Child" };
  const nextStats = { stage: "Perfect" };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateEncyclopedia.mockResolvedValue(undefined);
  });

  test("syncEvolutionEncyclopediaEntries는 evolution과 discovery를 순서대로 갱신한다", async () => {
    await syncEvolutionEncyclopediaEntries({
      previousDigimonId: "Agumon",
      previousStats,
      targetId: "Omegamon",
      nextStats,
      currentUser,
      version: "Ver.1",
    });

    expect(mockUpdateEncyclopedia).toHaveBeenNthCalledWith(
      1,
      "Agumon",
      previousStats,
      "evolution",
      currentUser,
      "Ver.1"
    );
    expect(mockUpdateEncyclopedia).toHaveBeenNthCalledWith(
      2,
      "Omegamon",
      nextStats,
      "discovery",
      currentUser,
      "Ver.1"
    );
  });

  test("syncEvolutionEncyclopediaEntries는 스타터 디지몬 discovery를 건너뛴다", async () => {
    await syncEvolutionEncyclopediaEntries({
      previousDigimonId: "Agumon",
      previousStats,
      targetId: "Digitama",
      nextStats,
      currentUser,
      version: "Ver.1",
    });

    expect(mockUpdateEncyclopedia).toHaveBeenCalledTimes(1);
    expect(mockUpdateEncyclopedia).toHaveBeenCalledWith(
      "Agumon",
      previousStats,
      "evolution",
      currentUser,
      "Ver.1"
    );
  });

  test("syncEvolutionEncyclopediaEntries는 이전 디지몬이 없으면 discovery만 기록한다", async () => {
    await syncEvolutionEncyclopediaEntries({
      targetId: "Omegamon",
      nextStats,
      currentUser,
      version: "Ver.1",
    });

    expect(mockUpdateEncyclopedia).toHaveBeenCalledTimes(1);
    expect(mockUpdateEncyclopedia).toHaveBeenCalledWith(
      "Omegamon",
      nextStats,
      "discovery",
      currentUser,
      "Ver.1"
    );
  });

  test("syncEvolutionEncyclopediaEntries는 targetId가 없으면 evolution만 기록한다", async () => {
    await syncEvolutionEncyclopediaEntries({
      previousDigimonId: "Agumon",
      previousStats,
      currentUser,
      version: "Ver.1",
    });

    expect(mockUpdateEncyclopedia).toHaveBeenCalledTimes(1);
    expect(mockUpdateEncyclopedia).toHaveBeenCalledWith(
      "Agumon",
      previousStats,
      "evolution",
      currentUser,
      "Ver.1"
    );
  });

  test("syncEvolutionEncyclopediaEntries는 swallowErrors가 false면 예외를 전파한다", async () => {
    mockUpdateEncyclopedia.mockRejectedValueOnce(new Error("encyclopedia failed"));

    await expect(
      syncEvolutionEncyclopediaEntries({
        previousDigimonId: "Agumon",
        previousStats,
        targetId: "Omegamon",
        nextStats,
        currentUser,
        version: "Ver.1",
      })
    ).rejects.toThrow("encyclopedia failed");
  });

  test("syncEvolutionEncyclopediaEntries는 swallowErrors가 true면 예외를 삼키고 계속 진행한다", async () => {
    mockUpdateEncyclopedia
      .mockRejectedValueOnce(new Error("evolution failed"))
      .mockResolvedValueOnce(undefined);

    await expect(
      syncEvolutionEncyclopediaEntries({
        previousDigimonId: "Agumon",
        previousStats,
        targetId: "Omegamon",
        nextStats,
        currentUser,
        version: "Ver.1",
        swallowErrors: true,
      })
    ).resolves.toBeUndefined();

    expect(mockUpdateEncyclopedia).toHaveBeenCalledTimes(2);
    expect(mockUpdateEncyclopedia).toHaveBeenNthCalledWith(
      2,
      "Omegamon",
      nextStats,
      "discovery",
      currentUser,
      "Ver.1"
    );
  });
});
