import {
  cancelJogressRoomApi,
  completeLocalJogressApi,
  completeJogressRoomApi,
  createJogressRoomApi,
  fetchJogressRooms,
  joinJogressRoomApi,
  JogressApiError,
} from "./jogressApi";

const user = { getIdToken: jest.fn().mockResolvedValue("token") };

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "{}" });
});

test("목록·생성·참가·완료·로컬 완료·취소는 단일 인증 API 계약을 사용한다", async () => {
  await fetchJogressRooms(user, "mine");
  await createJogressRoomApi(user, { slotId: 1, expectedRevision: 2 });
  await joinJogressRoomApi(user, { roomId: "r", guestSlotId: 2, expectedRevision: 3 });
  await completeJogressRoomApi(user, { roomId: "r", expectedRevision: 4 });
  await completeLocalJogressApi(user, {
    requestId: "local-1",
    currentSlotId: 1,
    partnerSlotId: 2,
    expectedCurrentRevision: 4,
    expectedPartnerRevision: 7,
  });
  await cancelJogressRoomApi(user, "r");
  expect(global.fetch).toHaveBeenNthCalledWith(1, "/api/jogress?scope=mine", expect.objectContaining({ method: "GET" }));
  expect(global.fetch).toHaveBeenNthCalledWith(2, "/api/jogress", expect.objectContaining({ body: JSON.stringify({ action: "create", slotId: 1, expectedRevision: 2 }) }));
  expect(global.fetch).toHaveBeenNthCalledWith(5, "/api/jogress", expect.objectContaining({
    body: JSON.stringify({
      action: "complete-local",
      requestId: "local-1",
      currentSlotId: 1,
      partnerSlotId: 2,
      expectedCurrentRevision: 4,
      expectedPartnerRevision: 7,
    }),
  }));
  expect(global.fetch).toHaveBeenNthCalledWith(6, "/api/jogress?roomId=r", expect.objectContaining({ method: "DELETE" }));
});

test("구조화 오류를 JogressApiError로 노출한다", async () => {
  global.fetch.mockResolvedValue({
    ok: false,
    status: 409,
    text: async () => JSON.stringify({ error: { code: "JOGRESS_STATE_CONFLICT", message: "충돌", retryable: true, details: { actualRevision: 9 } } }),
  });
  await expect(fetchJogressRooms(user)).rejects.toMatchObject({
    name: "JogressApiError",
    code: "JOGRESS_STATE_CONFLICT",
    retryable: true,
    details: { actualRevision: 9 },
  });
  await expect(fetchJogressRooms(null)).rejects.toBeInstanceOf(JogressApiError);
});
