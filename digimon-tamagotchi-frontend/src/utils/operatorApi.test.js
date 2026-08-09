import {
  fetchOperatorStatus,
  restoreOperatorMasterData,
  saveOperatorMasterData,
} from "./operatorApi";

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

    const error = await fetchOperatorStatus(currentUser).catch((caught) => caught);

    expect(error).toMatchObject({
      name: "OperatorApiError",
      status: 403,
      code: null,
      message: "운영자 권한이 없습니다.",
    });
  });

  test("마스터 데이터 저장을 POST action으로 전송한다", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({ result: { snapshotId: "snapshot-1", revisionAfter: 4 } })
      ),
    });
    const currentUser = {
      getIdToken: jest.fn().mockResolvedValue("operator-token"),
    };
    const input = {
      requestId: "request-1",
      expectedRevision: 3,
      actionType: "reset_all",
      note: "테스트",
      versionLabel: null,
      targetDigimonId: null,
      overrides: { ver1: {} },
    };

    await expect(saveOperatorMasterData(currentUser, input)).resolves.toEqual({
      snapshotId: "snapshot-1",
      revisionAfter: 4,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/operator/status?action=master-data-save",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer operator-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }
    );
  });

  test("복원 API의 네트워크 재시도는 동일 requestId와 body를 재사용한다", async () => {
    const response = {
      ok: true,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({ result: { snapshotId: "receipt-2", revisionAfter: 8 } })
      ),
    };
    global.fetch
      .mockRejectedValueOnce(new TypeError("network failed"))
      .mockResolvedValueOnce(response);
    const currentUser = {
      getIdToken: jest.fn().mockResolvedValue("operator-token"),
    };
    const input = {
      requestId: "restore-request-1",
      expectedRevision: 7,
      snapshotId: "source-snapshot",
      note: "",
    };

    await restoreOperatorMasterData(currentUser, input);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0]).toEqual(global.fetch.mock.calls[1]);
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual(input);
  });

  test("구조화된 충돌 오류의 code와 currentRevision을 보존한다", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 409,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          error: {
            code: "MASTER_DATA_REVISION_CONFLICT",
            message: "마스터 데이터가 다른 운영자에 의해 변경되었습니다.",
            details: { currentRevision: 9 },
          },
        })
      ),
    });
    const currentUser = {
      getIdToken: jest.fn().mockResolvedValue("operator-token"),
    };

    const error = await saveOperatorMasterData(currentUser, {}).catch(
      (caught) => caught
    );

    expect(error).toMatchObject({
      status: 409,
      code: "MASTER_DATA_REVISION_CONFLICT",
      details: { currentRevision: 9 },
    });
  });
});
