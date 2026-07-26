import { getElapsedTimeExcludingFridge } from "./fridgeTime";

describe("getElapsedTimeExcludingFridge", () => {
  test("냉장고 사용이 없으면 별도 누적 정지 시간만 제외한다", () => {
    expect(getElapsedTimeExcludingFridge(1000, 10000, null, null, 1000)).toBe(8000);
  });

  test("완료된 냉장고 구간을 경과 시간에서 제외한다", () => {
    expect(getElapsedTimeExcludingFridge(1000, 10000, 4000, 7000)).toBe(6000);
  });

  test("현재 냉장고 안이면 냉장고에 넣기 전까지만 경과한다", () => {
    expect(getElapsedTimeExcludingFridge(1000, 10000, 4000, null)).toBe(3000);
  });

  test("잘못된 시작 시각과 음수 결과를 0으로 제한한다", () => {
    expect(getElapsedTimeExcludingFridge(null, 10000)).toBe(0);
    expect(getElapsedTimeExcludingFridge(10000, 1000)).toBe(0);
  });
});
