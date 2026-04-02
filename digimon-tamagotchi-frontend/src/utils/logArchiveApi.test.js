import {
  archiveArenaBattleLog,
  archiveJogressLog,
  createLogArchiveId,
  getArenaBattleReplay,
} from "./logArchiveApi";

describe("logArchiveApi", () => {
  const currentUser = {
    getIdToken: jest.fn().mockResolvedValue("test-token"),
  };

  beforeEach(() => {
    global.fetch = jest.fn();
    jest.clearAllMocks();
    currentUser.getIdToken.mockResolvedValue("test-token");
  });

  test("POST 아카이브 요청은 Firebase Bearer 토큰과 JSON body를 포함한다", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ archive: { id: "arena_1" } }),
    });

    const archive = await archiveArenaBattleLog(currentUser, { id: "arena_1", summary: "요약" });

    expect(archive).toEqual({ id: "arena_1" });
    expect(global.fetch).toHaveBeenCalledWith("/api/logs/arena-battles/archive", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: "arena_1", summary: "요약" }),
    });
  });

  test("GET 다시보기 요청은 archiveId 경로를 사용한다", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ archive: { id: "arena_1", replayLogs: [{ message: "hit" }] } }),
    });

    const archive = await getArenaBattleReplay(currentUser, "arena_1");

    expect(archive.replayLogs).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledWith("/api/logs/arena-battles/arena_1/replay", {
      method: "GET",
      headers: {
        Authorization: "Bearer test-token",
      },
      body: undefined,
    });
  });

  test("조그레스 아카이브도 같은 인증 패턴을 사용한다", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ archive: { id: "jogress_1" } }),
    });

    const archive = await archiveJogressLog(currentUser, { id: "jogress_1", targetName: "오메가몬" });

    expect(archive).toEqual({ id: "jogress_1" });
    expect(global.fetch).toHaveBeenCalledWith("/api/logs/jogress/archive", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer test-token",
      }),
    }));
  });

  test("archive id는 prefix를 포함해 생성된다", () => {
    const archiveId = createLogArchiveId("arena");

    expect(archiveId.startsWith("arena_")).toBe(true);
  });
});
