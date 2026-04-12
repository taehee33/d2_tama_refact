import { fetchOperatorStatus } from "./operatorApi";

describe("operatorApi", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("운영자 상태 API 응답을 그대로 반환한다", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: jest
        .fn()
        .mockResolvedValue(
          JSON.stringify({
            viewer: {
              isOperator: true,
              canAccessUserDirectory: true,
            },
          })
        ),
    });

    const currentUser = {
      uid: "operator-1",
      email: "operator@example.com",
      getIdToken: jest.fn().mockResolvedValue("token"),
    };

    await expect(fetchOperatorStatus(currentUser)).resolves.toEqual({
      isOperator: true,
      canAccessUserDirectory: true,
    });
  });

  test("API 오류는 그대로 전달한다", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: jest
        .fn()
        .mockResolvedValue(JSON.stringify({ error: { message: "운영자 권한이 없습니다." } })),
    });

    const currentUser = {
      uid: "user-1",
      email: "user@example.com",
      getIdToken: jest.fn().mockResolvedValue("token"),
    };

    await expect(fetchOperatorStatus(currentUser)).rejects.toThrow("운영자 권한이 없습니다.");
  });
});
