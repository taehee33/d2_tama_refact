import {
  createSlotInstanceIdentity,
  hasValidSlotInstanceIdentity,
  preserveOrCreateSlotInstanceIdentity,
} from "./slotInstanceIdentity";

describe("slotInstanceIdentity", () => {
  test("새 슬롯 생명 ID를 스키마 버전과 함께 생성한다", () => {
    expect(createSlotInstanceIdentity(() => "slot-life-a")).toEqual({
      slotInstanceIdSchemaVersion: 1,
      slotInstanceId: "slot-life-a",
    });
  });

  test("기존의 유효한 ID를 보존한다", () => {
    expect(
      preserveOrCreateSlotInstanceIdentity(
        { slotInstanceIdSchemaVersion: 1, slotInstanceId: " slot-life-a " },
        () => "slot-life-b"
      )
    ).toEqual({
      slotInstanceIdSchemaVersion: 1,
      slotInstanceId: "slot-life-a",
    });
  });

  test("필드가 부족하면 legacy 슬롯으로 판정한다", () => {
    expect(hasValidSlotInstanceIdentity({ slotInstanceId: "slot-life-a" })).toBe(false);
    expect(
      preserveOrCreateSlotInstanceIdentity(
        { slotInstanceId: "slot-life-a" },
        () => "slot-life-new"
      )
    ).toEqual({
      slotInstanceIdSchemaVersion: 1,
      slotInstanceId: "slot-life-new",
    });
  });
});
