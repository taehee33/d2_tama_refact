import { createAblyAuthCallback, requestAblyToken } from "./ablyAuthApi";

describe("Ably 인증 API", () => {
  const currentUser = {
    getIdToken: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    currentUser.getIdToken.mockResolvedValue("firebase-token");
  });

  afterEach(() => {
    delete global.fetch;
  });

  test("Firebase ID 토큰으로 Ably 토큰 요청을 가져온다", async () => {
    const tokenRequest = { keyName: "app.key", nonce: "nonce", mac: "mac" };
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => tokenRequest,
    });

    await expect(requestAblyToken(currentUser)).resolves.toEqual(tokenRequest);
    expect(global.fetch).toHaveBeenCalledWith("/api/operator/status?action=ably-token", {
      method: "POST",
      headers: {
        Authorization: "Bearer firebase-token",
      },
    });
  });

  test("SDK auth callback에 발급 결과를 전달한다", async () => {
    const tokenRequest = { keyName: "app.key", nonce: "nonce", mac: "mac" };
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => tokenRequest,
    });
    const callback = jest.fn();

    await createAblyAuthCallback(currentUser)({}, callback);

    expect(callback).toHaveBeenCalledWith(null, tokenRequest);
  });

  test("서버 오류 메시지를 SDK auth callback 오류로 전달한다", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        error: { code: "ably_not_configured", message: "채팅 서버 미설정" },
      }),
    });
    const callback = jest.fn();

    await createAblyAuthCallback(currentUser)({}, callback);

    expect(callback.mock.calls[0][0]).toEqual(new Error("채팅 서버 미설정"));
    expect(callback.mock.calls[0][1]).toBeNull();
  });
});
