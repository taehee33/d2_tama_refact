import { persistJogressLogWithArchive } from "./useEvolution";
import { archiveJogressLog, createLogArchiveId } from "../utils/logArchiveApi";

jest.mock("../utils/logArchiveApi", () => ({
  archiveJogressLog: jest.fn(),
  createLogArchiveId: jest.fn(),
}));

describe("persistJogressLogWithArchive", () => {
  const currentUser = { uid: "user-1" };

  beforeEach(() => {
    jest.clearAllMocks();
    createLogArchiveId.mockReturnValue("jogress_test_1");
  });

  test("조그레스 로그는 Supabase archive에만 저장한다", async () => {
    archiveJogressLog.mockResolvedValue({ id: "jogress_test_1" });

    await persistJogressLogWithArchive({
      currentUser,
      warningLabel: "[test]",
      archivePayload: {
        hostUid: "user-1",
        targetName: "오메가몬",
      },
    });

    expect(createLogArchiveId).toHaveBeenCalledWith("jogress");
    expect(archiveJogressLog).toHaveBeenCalledWith(currentUser, {
      id: "jogress_test_1",
      hostUid: "user-1",
      targetName: "오메가몬",
    });
  });

  test("archive 저장 실패는 삼키고 게임 흐름을 막지 않는다", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    archiveJogressLog.mockRejectedValue(new Error("archive failed"));

    await expect(
      persistJogressLogWithArchive({
        currentUser,
        warningLabel: "[test]",
        archivePayload: {
          hostUid: "user-1",
          targetName: "오메가몬",
        },
      })
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
