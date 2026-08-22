import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import SparringModal, {
  getSparringSlotDisplayName,
  getSparringSlotSpriteSrc,
} from "./SparringModal";

const mockUseAuth = jest.fn();
const mockGetDocs = jest.fn();
const mockGetDigimonDataMapByVersion = jest.fn();
const mockGetSpriteBasePathByVersion = jest.fn();
const mockCalculatePower = jest.fn();

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  getDocs: (...args) => mockGetDocs(...args),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
}));

jest.mock("../firebase", () => ({
  db: { name: "test-db" },
}));

jest.mock("../logic/battle/hitrate", () => ({
  calculatePower: (...args) => mockCalculatePower(...args),
}));

jest.mock("../data/v1/digimons", () => ({
  digimonDataVer1: {},
}));

jest.mock("../data/v2modkor", () => ({
  digimonDataVer2: {},
}));

jest.mock("../utils/digimonVersionUtils", () => ({
  getDigimonDataMapByVersion: (...args) =>
    mockGetDigimonDataMapByVersion(...args),
  getSpriteBasePathByVersion: (...args) =>
    mockGetSpriteBasePathByVersion(...args),
}));

function createDoc(id, data) {
  return {
    id,
    data: () => data,
  };
}

describe("SparringModal", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      currentUser: { uid: "tester" },
      isFirebaseAvailable: true,
    });
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockGetDigimonDataMapByVersion.mockImplementation((version) => {
      if (version === "Ver.2") {
        return {
          Ver2mon: {
            id: "Ver2mon",
            name: "버전2몬",
            sprite: 310,
            spriteBasePath: "/Ver2_Mod_Kor",
            stats: { basePower: 80 },
          },
        };
      }

      if (version === "Ver.3") {
        return {
          Ver3mon: {
            id: "Ver3mon",
            name: "버전3몬",
            sprite: 405,
            spriteBasePath: "/Ver3_Mod_codex",
            stats: { basePower: 90 },
          },
        };
      }

      return {
        Agumon: {
          id: "Agumon",
          name: "아구몬",
          sprite: 210,
          stats: { basePower: 50 },
        },
      };
    });
    mockGetSpriteBasePathByVersion.mockImplementation((version) => {
      if (version === "Ver.2") return "/Ver2_Mod_Kor";
      if (version === "Ver.3") return "/Ver3_Mod_codex";
      return "/images";
    });
    mockCalculatePower.mockReturnValue(50);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("각 상대 슬롯에 버전별 디지몬 이미지와 별명을 표시한다", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        createDoc("slot1", {
          slotName: "슬롯1",
          selectedDigimon: "Agumon",
          version: "Ver.1",
          digimonNickname: "불꽃이",
          digimonStats: { power: 60 },
        }),
        createDoc("slot2", {
          slotName: "슬롯2",
          selectedDigimon: "Ver2mon",
          version: "Ver.2",
          digimonStats: { power: 80 },
        }),
        createDoc("slot3", {
          slotName: "슬롯3",
          selectedDigimon: "Agumon",
          version: "Ver.1",
        }),
        createDoc("slot4", {
          slotName: "슬롯4",
          selectedDigimon: "Ver3mon",
          version: "Ver.3",
        }),
      ],
    });

    render(
      <SparringModal
        onClose={jest.fn()}
        onSelectSlot={jest.fn()}
        currentSlotId={3}
      />
    );

    expect(await screen.findByText("슬롯1")).toBeInTheDocument();

    expect(screen.getByAltText("불꽃이(아구몬)")).toHaveAttribute(
      "src",
      "/images/210.png"
    );
    expect(screen.getByAltText("버전2몬")).toHaveAttribute(
      "src",
      "/Ver2_Mod_Kor/310.png"
    );
    expect(screen.getByAltText("버전3몬")).toHaveAttribute(
      "src",
      "/Ver3_Mod_codex/405.png"
    );
    expect(screen.queryByText("슬롯3")).not.toBeInTheDocument();
    expect(screen.getByText('"불꽃이(아구몬)"')).toBeInTheDocument();
  });

  test("슬롯 카드를 선택하면 기존 선택·닫기 동작을 호출한다", async () => {
    const onClose = jest.fn();
    const onSelectSlot = jest.fn();
    const slot = {
      slotName: "슬롯1",
      selectedDigimon: "Agumon",
      version: "Ver.1",
    };
    mockGetDocs.mockResolvedValue({ docs: [createDoc("slot1", slot)] });

    render(
      <SparringModal
        onClose={onClose}
        onSelectSlot={onSelectSlot}
        currentSlotId={2}
      />
    );

    await screen.findByAltText("아구몬");
    fireEvent.click(screen.getByRole("button", { name: /슬롯1/ }));

    expect(onSelectSlot).toHaveBeenCalledWith({
      id: 1,
      slotName: "슬롯1",
      selectedDigimon: "Agumon",
      version: "Ver.1",
      digimonStats: {},
      digimonNickname: null,
      createdAt: "",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("로딩 중에는 슬롯 목록 대신 로딩 상태를 표시한다", () => {
    mockGetDocs.mockReturnValue(new Promise(() => {}));

    render(
      <SparringModal
        onClose={jest.fn()}
        onSelectSlot={jest.fn()}
        currentSlotId={1}
      />
    );

    expect(screen.getByText("슬롯 로딩 중...")).toBeInTheDocument();
  });

  test("디지몬 데이터가 없어도 기본 스프라이트 경로를 만든다", () => {
    expect(
      getSparringSlotSpriteSrc(
        { selectedDigimon: "Unknown", version: "Ver.1" },
        null,
        {}
      )
    ).toBe("/images/0.png");
    expect(
      getSparringSlotDisplayName(
        { selectedDigimon: "Unknown", digimonNickname: "" },
        null
      )
    ).toBe("Unknown");
  });
});
