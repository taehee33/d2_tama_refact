import {
  ArenaApiError,
  deleteArenaGhost,
  fetchArenaGhosts,
  registerArenaGhost,
  submitArenaGhostBattle,
} from "./arenaApi";

function createUser() {
  return { getIdToken: jest.fn().mockResolvedValue("token") };
}

function createResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(JSON.stringify(payload)),
  };
}

describe("Ghost V2 arena API", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test("내 Ghost 조회는 schema version과 slotId를 보낸다", async () => {
    global.fetch.mockResolvedValue(createResponse(200, { ghosts: [], capacity: { used: 0, limit: 3 } }));
    await fetchArenaGhosts(createUser(), { scope: "mine", slotId: 4 });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/arena/ghosts?scope=mine&slotId=4",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Arena-Client-Schema-Version": "2",
        }),
      })
    );
  });

  test("등록 요청은 slotId만 보낸다", async () => {
    global.fetch.mockResolvedValue(createResponse(201, { ghost: { ghostId: "ghost-a" } }));
    await registerArenaGhost(createUser(), 4);
    const request = global.fetch.mock.calls[0][1];
    expect(JSON.parse(request.body)).toEqual({ slotId: "4" });
  });

  test("삭제 요청은 Ghost 경로를 사용한다", async () => {
    global.fetch.mockResolvedValue(createResponse(200, { deletedGhostId: "ghost-a" }));
    await deleteArenaGhost(createUser(), "ghost-a");
    expect(global.fetch.mock.calls[0][0]).toBe("/api/arena/ghosts/ghost-a");
  });

  test("서버 확정 배틀 요청은 식별자 3개만 전송한다", async () => {
    global.fetch.mockResolvedValue(createResponse(200, { battle: { battleId: "battle-a" } }));
    const battle = await submitArenaGhostBattle(createUser(), {
      requestId: "request-a",
      attackerSlotId: 4,
      defenderGhostId: "ghost-a",
    });
    const [url, request] = global.fetch.mock.calls[0];
    expect(url).toBe("/api/arena/battles");
    expect(JSON.parse(request.body)).toEqual({
      requestId: "request-a",
      attackerSlotId: "4",
      defenderGhostId: "ghost-a",
    });
    expect(request.headers["X-Arena-Client-Schema-Version"]).toBe("2");
    expect(battle.battleId).toBe("battle-a");
  });

  test("structured Arena 오류를 code와 details까지 보존한다", async () => {
    global.fetch.mockResolvedValue(
      createResponse(409, {
        error: {
          code: "ARENA_GHOST_ALREADY_REGISTERED",
          message: "이미 등록됨",
          retryable: false,
          details: { existingGhostId: "ghost-a" },
        },
      })
    );
    await expect(registerArenaGhost(createUser(), 4)).rejects.toMatchObject({
      name: "ArenaApiError",
      code: "ARENA_GHOST_ALREADY_REGISTERED",
      status: 409,
      details: { existingGhostId: "ghost-a" },
    });
    expect(ArenaApiError.prototype).toBeInstanceOf(Error);
  });
});
