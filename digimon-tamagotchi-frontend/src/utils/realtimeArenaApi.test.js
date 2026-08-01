import { createRealtimeArenaBattle, listRealtimeArenaBattles, sendRealtimeArenaCommand } from "./realtimeArenaApi";

describe("realtimeArenaApi", () => {
  const currentUser = { getIdToken: jest.fn(async () => "token-1") };

  beforeEach(() => {
    currentUser.getIdToken.mockResolvedValue("token-1");
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ battle: { battleId: "rtb_test" } }) }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("방 생성 요청은 인증·schema header와 no-store를 사용한다", async () => {
    await createRealtimeArenaBattle(currentUser, { requestId: "request-1", slotId: "slot1" });
    expect(global.fetch).toHaveBeenCalledWith("/api/arena/realtime/battles", expect.objectContaining({
      method: "POST",
      cache: "no-store",
      headers: expect.objectContaining({ Authorization: "Bearer token-1", "X-Arena-Client-Schema-Version": "1" }),
    }));
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ requestId: "request-1", slotId: "slot1", mode: "pvp" });
  });

  test("CPU 생성 요청은 cpu 모드를 명시한다", async () => {
    await createRealtimeArenaBattle(currentUser, { requestId: "request-cpu", slotId: "slot1", mode: "cpu" });
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ requestId: "request-cpu", slotId: "slot1", mode: "cpu" });
  });

  test("command URL은 battleId를 encode하고 민감 상태를 query에 넣지 않는다", async () => {
    await sendRealtimeArenaCommand(currentUser, "rtb_a/b", { command: "restore", requestId: "request-2" });
    expect(global.fetch.mock.calls[0][0]).toBe("/api/arena/realtime/battles/rtb_a%2Fb/commands");
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ command: "restore", requestId: "request-2" });
  });

  test("대기방 목록은 인증된 GET과 no-store로 조회한다", async () => {
    await listRealtimeArenaBattles(currentUser);
    expect(global.fetch).toHaveBeenCalledWith("/api/arena/realtime/battles", expect.objectContaining({
      method: "GET",
      cache: "no-store",
      headers: expect.objectContaining({ Authorization: "Bearer token-1" }),
    }));
    expect(global.fetch.mock.calls[0][1].body).toBeUndefined();
  });
});
