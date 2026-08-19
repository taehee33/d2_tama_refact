import {
  GAME_SCENE_ASPECT_RATIO,
  GAME_SCENE_GEOMETRY,
  getDefaultDigimonDrawState,
  getDefaultDigimonSceneStyle,
} from "./gameSceneGeometry";

describe("gameSceneGeometry", () => {
  test("일반 게임 화면의 3:2 비율과 40% 스프라이트 계약을 제공한다", () => {
    expect(GAME_SCENE_ASPECT_RATIO).toBe("3 / 2");
    expect(GAME_SCENE_GEOMETRY).toEqual({
      digimonWidthRatio: 0.4,
      digimonHeightRatio: 0.4,
    });
  });

  test("기본 디지몬을 화면 중앙의 40% 영역에 배치한다", () => {
    expect(getDefaultDigimonDrawState(300, 200)).toEqual({
      digiW: 120,
      digiH: 80,
      digiX: 90,
      digiY: 60,
      flip: false,
    });
    expect(getDefaultDigimonSceneStyle()).toEqual({
      left: "30%",
      top: "30%",
      width: "40%",
      height: "40%",
    });
  });

  test("먹기 애니메이션의 기존 오른쪽 배치를 유지한다", () => {
    expect(getDefaultDigimonDrawState(300, 200, "eat")).toEqual({
      digiW: 120,
      digiH: 80,
      digiX: 120,
      digiY: 60,
      flip: false,
    });
  });
});
