// Regression: gstack 브라우저 QA에서 확인한 비로그인 Firestore 권한 오류를 방지한다.
import { canLoadRemoteMasterData } from "./MasterDataContext";

jest.mock("../firebase", () => ({
  db: {},
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  serverTimestamp: jest.fn(),
  writeBatch: jest.fn(),
}));

jest.mock("./AuthContext", () => ({
  useAuth: jest.fn(() => ({ currentUser: null })),
}));

describe("canLoadRemoteMasterData", () => {
  test("비로그인 상태에서는 관리자 전용 Firestore 마스터 데이터를 조회하지 않는다", () => {
    expect(canLoadRemoteMasterData({}, null)).toBe(false);
  });

  test("Firebase와 로그인 사용자가 모두 있을 때만 원격 데이터를 조회한다", () => {
    expect(canLoadRemoteMasterData({}, { uid: "user-1" })).toBe(true);
    expect(canLoadRemoteMasterData(null, { uid: "user-1" })).toBe(false);
  });
});
