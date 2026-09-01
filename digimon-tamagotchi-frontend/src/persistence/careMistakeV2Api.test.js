import {
  CARE_MISTAKE_V2_INTEGRITY,
  buildCareMistakeV2Command,
  canMutateWithCareIntegrity,
  commitCareMistakeV2ApiCommand,
  deleteCareMistakeV2ApiSlot,
  fetchCareMistakeV2Integrity,
  nativeInitCareMistakeV2ApiSlot,
} from "./careMistakeV2Api";

const user = { getIdToken: jest.fn(async () => "token") };
const state = {
  schemaVersion: 2,
  rootReceiptId: "root-a",
  receiptId: "receipt-b",
  evolutionStageInstanceId: "stage-c",
};

function response(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

test("integrity API 일시 실패는 저장 상태가 아닌 integrity_unknown으로 반환한다", async () => {
  const result = await fetchCareMistakeV2Integrity(user, 4, {
    fetchImpl: jest.fn(async () => { throw new Error("network down"); }),
  });

  expect(result).toEqual(expect.objectContaining({
    effectiveIntegrityStatus: CARE_MISTAKE_V2_INTEGRITY.UNKNOWN,
    retryable: true,
  }));
  expect(canMutateWithCareIntegrity(result.effectiveIntegrityStatus)).toBe(false);
});

test("command는 현재 root/receipt/stage/revision epoch를 전송한다", async () => {
  const fetchImpl = jest.fn(async () => response({ revision: 12 }));
  const command = buildCareMistakeV2Command({
    commandId: "command-1",
    commandType: "STATE_MUTATION",
    state,
    expectedRevision: 11,
    payload: { updateData: { hunger: 3 } },
  });

  await commitCareMistakeV2ApiCommand(user, 4, command, { fetchImpl });
  const request = JSON.parse(fetchImpl.mock.calls[0][1].body);
  expect(request.command).toEqual(expect.objectContaining({
    rootReceiptId: "root-a",
    receiptId: "receipt-b",
    evolutionStageInstanceId: "stage-c",
    expectedRevision: 11,
  }));
});

test("V2 command JSON은 Firestore sentinel과 서버 소유 필드를 전송하지 않는다", async () => {
  const fetchImpl = jest.fn(async () => response({ revision: 12 }));
  const command = buildCareMistakeV2Command({
    commandId: "command-json-safe",
    commandType: "STATE_MUTATION",
    state,
    expectedRevision: 11,
    payload: {
      updateData: {
        digimonStats: { fullness: 4 },
        lastSavedAt: 1234,
        updatedAt: { _methodName: "serverTimestamp" },
        lastSavedAtServer: { _methodName: "serverTimestamp" },
        dailySleepMistake: { _methodName: "deleteField" },
      },
    },
  });

  await commitCareMistakeV2ApiCommand(user, 4, command, { fetchImpl });

  const body = fetchImpl.mock.calls[0][1].body;
  const request = JSON.parse(body);
  expect(body).not.toContain("_methodName");
  expect(request.command.payload.updateData).toEqual({
    digimonStats: { fullness: 4 },
    lastSavedAt: 1234,
  });
});

test("허용 경로 밖의 sentinel-shaped object는 전송 전에 거부한다", async () => {
  const fetchImpl = jest.fn();
  const command = buildCareMistakeV2Command({
    commandId: "command-invalid-sentinel",
    commandType: "STATE_MUTATION",
    state,
    expectedRevision: 11,
    payload: {
      updateData: {
        digimonStats: {
          fullness: 4,
          nested: { _methodName: "serverTimestamp" },
        },
      },
    },
  });

  await expect(
    commitCareMistakeV2ApiCommand(user, 4, command, { fetchImpl })
  ).rejects.toMatchObject({ code: "INVALID_PAYLOAD", status: 400 });
  expect(fetchImpl).not.toHaveBeenCalled();
});

test("native bootstrap은 client 직접 Firestore write 없이 server endpoint를 사용한다", async () => {
  const fetchImpl = jest.fn(async () => response({ revision: 1 }, { status: 201 }));
  const result = await nativeInitCareMistakeV2ApiSlot(user, 2, {
    commandId: "native-1",
    slotData: { slotInstanceId: "slot-life", digimonInstanceId: "digi-life" },
    fetchImpl,
  });

  expect(result.revision).toBe(1);
  expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual(expect.objectContaining({
    action: "native_init",
    slotId: 2,
  }));
});

test("V2 슬롯 삭제는 slot instance와 최초 revision을 trusted endpoint로 보낸다", async () => {
  const fetchImpl = jest.fn(async () => response({
    status: "complete",
    operationId: "delete-a",
    idempotent: false,
  }));
  const result = await deleteCareMistakeV2ApiSlot(user, 4, {
    slotInstanceId: "slot-life-a",
    expectedRevision: 9,
    fetchImpl,
  });

  expect(result.status).toBe("complete");
  expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
    action: "delete_slot",
    slotId: 4,
    slotInstanceId: "slot-life-a",
    expectedRevision: 9,
  });
});

test("active deletion lease의 202 응답은 in_progress 결과로 유지한다", async () => {
  const fetchImpl = jest.fn(async () => response({
    status: "in_progress",
    operationId: "delete-a",
    retryAfterMs: 1000,
  }, { status: 202 }));
  const result = await deleteCareMistakeV2ApiSlot(user, 4, {
    slotInstanceId: "slot-life-a",
    expectedRevision: 9,
    fetchImpl,
  });
  expect(result).toEqual(expect.objectContaining({
    status: "in_progress",
    retryAfterMs: 1000,
  }));
});
