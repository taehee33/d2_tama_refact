const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockDoc = jest.fn((_db, ...segments) => ({
  path: segments.join("/"),
}));

jest.mock("firebase/firestore", () => ({
  doc: mockDoc,
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
}));

jest.mock("../firebase", () => ({
  db: { name: "test-db" },
}));

const {
  getUserSettings,
  saveUserSettings,
} = require("./userSettingsUtils");

function createSnapshot(data) {
  return {
    exists: () => data !== null && data !== undefined,
    data: () => data,
  };
}

describe("userSettingsUtils", () => {
  beforeEach(() => {
    mockDoc.mockClear();
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
  });

  test("settings/main 문서가 있으면 새 경로 값을 우선 사용한다", async () => {
    mockGetDoc.mockResolvedValueOnce(
      createSnapshot({
        discordWebhookUrl: "https://discord.com/api/webhooks/new",
        isNotificationEnabled: true,
        siteTheme: "notebook",
      })
    );

    const result = await getUserSettings("tester");

    expect(mockGetDoc).toHaveBeenCalledTimes(1);
    expect(mockDoc).toHaveBeenCalledWith({ name: "test-db" }, "users", "tester", "settings", "main");
    expect(result).toEqual({
      discordWebhookUrl: "https://discord.com/api/webhooks/new",
      isNotificationEnabled: true,
      siteTheme: "notebook",
    });
  });

  test("settings/main 문서가 없으면 루트 users 문서를 fallback으로 읽는다", async () => {
    mockGetDoc
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(
        createSnapshot({
          discordWebhookUrl: "https://discord.com/api/webhooks/root",
          isNotificationEnabled: true,
          siteTheme: "default",
        })
      );

    const result = await getUserSettings("tester");

    expect(mockGetDoc).toHaveBeenCalledTimes(2);
    expect(mockDoc.mock.calls[0]).toEqual([{ name: "test-db" }, "users", "tester", "settings", "main"]);
    expect(mockDoc.mock.calls[1]).toEqual([{ name: "test-db" }, "users", "tester"]);
    expect(result).toEqual({
      discordWebhookUrl: "https://discord.com/api/webhooks/root",
      isNotificationEnabled: true,
      siteTheme: "default",
    });
  });

  test("설정 저장은 users/{uid}/settings/main에 merge 저장한다", async () => {
    await saveUserSettings("tester", {
      discordWebhookUrl: " https://discord.com/api/webhooks/abc ",
      isNotificationEnabled: true,
      siteTheme: "notebook",
    });

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockDoc).toHaveBeenCalledWith({ name: "test-db" }, "users", "tester", "settings", "main");
    expect(mockSetDoc.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        discordWebhookUrl: "https://discord.com/api/webhooks/abc",
        isNotificationEnabled: true,
        siteTheme: "notebook",
        updatedAt: expect.any(Date),
      })
    );
    expect(mockSetDoc.mock.calls[0][2]).toEqual({ merge: true });
  });
});
