import {
  createShowcasePost,
} from "./communityApi";

describe("communityApi", () => {
  const currentUser = {
    getIdToken: jest.fn().mockResolvedValue("token-123"),
  };

  beforeEach(() => {
    currentUser.getIdToken.mockClear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  it("중첩된 error.message를 우선 노출한다", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          error: {
            message: "선택한 슬롯을 찾을 수 없습니다.",
          },
        })
      ),
    });

    await expect(
      createShowcasePost(currentUser, {
        slotId: "1",
        title: "테스트",
        body: "본문",
      })
    ).rejects.toThrow("선택한 슬롯을 찾을 수 없습니다.");
  });

  it("HTML 404 응답이면 로컬 개발용 안내 메시지로 바꾼다", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: jest.fn().mockResolvedValue("<!doctype html><html><body>Not Found</body></html>"),
    });

    await expect(
      createShowcasePost(currentUser, {
        slotId: "1",
        title: "테스트",
        body: "본문",
      })
    ).rejects.toThrow("커뮤니티 API 경로를 찾지 못했습니다.");
  });
});
