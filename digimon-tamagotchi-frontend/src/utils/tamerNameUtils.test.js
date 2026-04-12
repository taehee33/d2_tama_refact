const mockGetDoc = jest.fn();
const mockDoc = jest.fn((_db, ...segments) => ({
  path: segments.join("/"),
}));
const mockRunTransaction = jest.fn();

jest.mock("firebase/firestore", () => ({
  doc: (...args) => mockDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  runTransaction: (...args) => mockRunTransaction(...args),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
}));

jest.mock("../firebase", () => ({
  db: { name: "test-db" },
}));

const {
  checkNicknameAvailability,
  getAccountDisplayFallback,
  getTamerName,
  normalizeNicknameInput,
  resetToDefaultTamerName,
  resolveTamerNameInitial,
  resolveTamerNamePriority,
  toNicknameKey,
  updateTamerName,
} = require("./tamerNameUtils");

function createSnapshot(data) {
  return {
    exists: () => data !== null && data !== undefined,
    data: () => data,
  };
}

describe("tamerNameUtils", () => {
  beforeEach(() => {
    mockDoc.mockClear();
    mockGetDoc.mockReset();
    mockRunTransaction.mockReset();
  });

  test("연속 공백을 1칸으로 정규화한다", () => {
    expect(normalizeNicknameInput("  A   B  ")).toBe("A B");
  });

  test("닉네임 키는 정규화 후 영문 대소문자를 무시한다", () => {
    expect(toNicknameKey("  TaMer   Name  ")).toBe("tamer name");
  });

  test("우선순위 테이머명은 커스텀 tamerName을 최우선으로 사용한다", () => {
    expect(
      resolveTamerNamePriority({
        tamerName: "  커스텀 테이머  ",
        currentUser: {
          uid: "tester",
          displayName: "표시 이름",
          email: "tester@example.com",
        },
      })
    ).toBe("커스텀 테이머");
  });

  test("우선순위 테이머명은 displayName, email, 추가 fallback 순서로 내려간다", () => {
    expect(
      resolveTamerNamePriority({
        currentUser: {
          uid: "tester",
          displayName: "",
          email: "tester@example.com",
        },
        extraFallbacks: ["슬롯1"],
      })
    ).toBe("tester");

    expect(
      resolveTamerNamePriority({
        currentUser: {
          uid: "tester",
          displayName: "",
          email: "",
        },
        extraFallbacks: ["슬롯1"],
      })
    ).toBe("슬롯1");
  });

  test("계정 표시 fallback과 이니셜은 Trainer 기본값까지 일관되게 계산한다", () => {
    const currentUser = {
      uid: "tester123",
      displayName: "",
      email: "",
    };

    expect(getAccountDisplayFallback(currentUser)).toBe("Trainer_tester");
    expect(
      resolveTamerNameInitial({
        currentUser,
      })
    ).toBe("T");
  });

  test("중복 확인은 정규화 안내와 함께 성공 결과를 반환한다", async () => {
    mockGetDoc.mockResolvedValue(createSnapshot(null));

    const result = await checkNicknameAvailability("A   B", "tester");

    expect(mockGetDoc).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: "available",
      isAvailable: true,
      message: "연속된 공백은 1칸으로 자동 변경됩니다. 사용 가능한 테이머명입니다.",
      normalizedNickname: "A B",
      normalizedKey: "a b",
      didNormalizeSpaces: true,
    });
  });

  test("같은 사용자가 이미 점유한 닉네임은 현재 사용 중 안내를 반환한다", async () => {
    mockGetDoc.mockResolvedValue(createSnapshot({ uid: "tester" }));

    const result = await checkNicknameAvailability("Tamer", "tester");

    expect(result.status).toBe("current-user");
    expect(result.isAvailable).toBe(true);
    expect(result.message).toBe("현재 사용 중인 테이머명입니다.");
  });

  test("다른 사용자가 점유한 닉네임은 연속 공백 정규화 후에도 거절한다", async () => {
    mockGetDoc.mockResolvedValue(createSnapshot({ uid: "other-user" }));

    const result = await checkNicknameAvailability("A  B", "tester");

    expect(result.status).toBe("taken");
    expect(result.isAvailable).toBe(false);
    expect(result.message).toBe("연속된 공백은 1칸으로 자동 변경됩니다. 이미 사용 중인 테이머명입니다.");
    expect(result.normalizedNickname).toBe("A B");
    expect(result.normalizedKey).toBe("a b");
  });

  test("공백만 다른 현재 이름도 self-match로 처리한다", async () => {
    mockGetDoc.mockResolvedValue(createSnapshot({ uid: "tester" }));

    const result = await checkNicknameAvailability("A  B", "tester");

    expect(result.status).toBe("current-user");
    expect(result.isAvailable).toBe(true);
    expect(result.message).toBe("연속된 공백은 1칸으로 자동 변경됩니다. 현재 사용 중인 테이머명입니다.");
    expect(result.normalizedNickname).toBe("A B");
    expect(result.normalizedKey).toBe("a b");
  });

  test("테이머명 저장은 트랜잭션으로 profile/main과 인덱스를 함께 갱신한다", async () => {
    const operations = [];
    const order = [];
    let getCount = 0;

    mockGetDoc.mockResolvedValue(createSnapshot(null));
    mockRunTransaction.mockImplementation(async (_db, callback) => {
      const transaction = {
        get: jest.fn().mockImplementation(async () => {
          getCount += 1;
          order.push({ type: "get" });

          if (getCount === 1) {
            return createSnapshot({ tamerName: "Old Name", uid: "tester", displayName: "테스터" });
          }

          if (getCount === 2) {
            return createSnapshot({ tamerName: "Old Name" });
          }

          if (getCount === 3) {
            return createSnapshot(null);
          }

          if (getCount === 4) {
            return createSnapshot({ uid: "tester" });
          }

          return createSnapshot(null);
        }),
        update: jest.fn((_ref, data) => {
          order.push({ type: "update" });
          operations.push({ type: "update", data });
        }),
        set: jest.fn((_ref, data, options) => {
          order.push({ type: "set" });
          operations.push({ type: "set", data, options });
        }),
        delete: jest.fn(() => {
          order.push({ type: "delete" });
          operations.push({ type: "delete" });
        }),
      };

      return callback(transaction);
    });

    const result = await updateTamerName("tester", "New   Name", "Old Name");

    expect(result).toEqual({
      normalizedNickname: "New Name",
      normalizedKey: "new name",
      didNormalizeSpaces: true,
    });

    expect(operations.length).toBeGreaterThanOrEqual(2);
    expect(operations[0]).toMatchObject({
      type: "set",
      data: expect.objectContaining({
        tamerName: "New Name",
        updatedAt: expect.any(Date),
      }),
      options: { merge: true },
    });
    expect(operations[1]).toMatchObject({
      type: "set",
      data: expect.objectContaining({
        uid: "tester",
        nickname: "New Name",
        normalizedKey: "new name",
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
      options: { merge: true },
    });
    expect(operations.find((entry) => entry.type === "update")).toBeUndefined();
    const orderTypes = order.map((entry) => entry.type);
    const firstWriteIndex = orderTypes.findIndex((type) => type !== "get");
    expect(firstWriteIndex).toBeGreaterThan(0);
    expect(orderTypes.slice(0, firstWriteIndex).every((type) => type === "get")).toBe(true);
    expect(orderTypes.slice(firstWriteIndex).includes("get")).toBe(false);
  });

  test("기본값 복구도 모든 읽기를 끝낸 뒤 삭제를 수행한다", async () => {
    const order = [];
    let getCount = 0;

    mockRunTransaction.mockImplementation(async (_db, callback) => {
      const transaction = {
        get: jest.fn().mockImplementation(async () => {
          getCount += 1;
          order.push({ type: "get" });

          if (getCount === 1) {
            return createSnapshot({ tamerName: "한 솔" });
          }

          if (getCount === 2) {
            return createSnapshot({ tamerName: "한 솔" });
          }

          if (getCount === 3) {
            return createSnapshot({ uid: "tester" });
          }

          return createSnapshot(null);
        }),
        update: jest.fn(() => {
          order.push({ type: "update" });
        }),
        set: jest.fn(() => {
          order.push({ type: "set" });
        }),
        delete: jest.fn(() => {
          order.push({ type: "delete" });
        }),
      };

      return callback(transaction);
    });

    await resetToDefaultTamerName("tester", "한솔", "한 솔");

    const orderTypes = order.map((entry) => entry.type);
    const firstWriteIndex = orderTypes.findIndex((type) => type !== "get");
    expect(firstWriteIndex).toBeGreaterThanOrEqual(1);
    expect(orderTypes.slice(0, firstWriteIndex).every((type) => type === "get")).toBe(true);
    expect(orderTypes.slice(firstWriteIndex).includes("get")).toBe(false);
    expect(orderTypes).not.toContain("update");
  });

  test("테이머명 로드는 profile/main 값을 우선 사용한다", async () => {
    mockGetDoc
      .mockResolvedValueOnce(createSnapshot({ tamerName: "프로필 이름" }))
      .mockResolvedValueOnce(
        createSnapshot({
          tamerName: "루트 이름",
          displayName: "표시 이름",
        })
      );

    const result = await getTamerName("tester", "Auth 이름");

    expect(result).toBe("프로필 이름");
  });
});
