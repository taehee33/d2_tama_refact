import { fetchOperatorStatus } from "./operatorApi";

describe("operatorApi", () => {
  const originalFetch = global.fetch;
  const originalOperatorEmails = process.env.REACT_APP_OPERATOR_EMAILS;
  const originalArenaEmails = process.env.REACT_APP_ARENA_ADMIN_EMAILS;
  const originalNewsEmails = process.env.REACT_APP_NEWS_EDITOR_EMAILS;

  beforeEach(() => {
    process.env.REACT_APP_OPERATOR_EMAILS = "";
    process.env.REACT_APP_ARENA_ADMIN_EMAILS = "";
    process.env.REACT_APP_NEWS_EDITOR_EMAILS = "";
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.REACT_APP_OPERATOR_EMAILS = originalOperatorEmails;
    process.env.REACT_APP_ARENA_ADMIN_EMAILS = originalArenaEmails;
    process.env.REACT_APP_NEWS_EDITOR_EMAILS = originalNewsEmails;
  });

  test("localhost 개발환경에서는 로컬 운영자 이메일로 fallback 한다", async () => {
    process.env.REACT_APP_OPERATOR_EMAILS = "hth3381@gmail.com";
    global.fetch.mockRejectedValue(new Error("fetch failed"));

    const currentUser = {
      uid: "operator-1",
      email: "hth3381@gmail.com",
      getIdToken: jest.fn().mockResolvedValue("token"),
    };

    await expect(fetchOperatorStatus(currentUser)).resolves.toEqual({
      isOperator: true,
      canAccessUserDirectory: true,
    });
  });

  test("로컬 화이트리스트에 없으면 기존 오류를 유지한다", async () => {
    process.env.REACT_APP_OPERATOR_EMAILS = "someone@example.com";
    global.fetch.mockRejectedValue(new Error("fetch failed"));

    const currentUser = {
      uid: "user-1",
      email: "hth3381@gmail.com",
      getIdToken: jest.fn().mockResolvedValue("token"),
    };

    await expect(fetchOperatorStatus(currentUser)).rejects.toThrow("fetch failed");
  });
});
