import {
  GAME_SCENE_ASPECT_RATIO,
  GAME_SCENE_GEOMETRY,
  GAME_SCENE_SIZE,
  getDefaultDigimonDrawState,
  getDefaultDigimonSceneStyle,
  getGridDigimonDrawState,
  normalizeGameSceneSize,
} from "./gameSceneGeometry";

describe("gameSceneGeometry", () => {
  test("일반 게임 화면의 1:1 비율과 40% 스프라이트 계약을 제공한다", () => {
    expect(GAME_SCENE_ASPECT_RATIO).toBe("1 / 1");
    expect(GAME_SCENE_SIZE).toEqual({ width: 300, height: 300 });
    expect(GAME_SCENE_GEOMETRY).toEqual({
      digimonWidthRatio: 0.4,
      digimonHeightRatio: 0.4,
    });
  });

  test("모션 타임라인의 좌우 끝에서도 디지몬이 300×300 화면 안에 남는다", () => {
    const left = getGridDigimonDrawState(300, 300, { x: 0, y: 24 });
    const right = getGridDigimonDrawState(300, 300, { x: 48, y: 24, flip: true });

    expect(left).toEqual({
      digiW: 120,
      digiH: 120,
      digiX: 0,
      digiY: 90,
      flip: false,
    });
    expect(right).toEqual({
      digiW: 120,
      digiH: 120,
      digiX: 180,
      digiY: 90,
      flip: true,
    });
    expect(right.digiX + right.digiW).toBe(300);
  });

  test("기본 디지몬을 화면 중앙의 40% 영역에 배치한다", () => {
    expect(getDefaultDigimonDrawState(300, 300)).toEqual({
      digiW: 120,
      digiH: 120,
      digiX: 90,
      digiY: 90,
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
    expect(getDefaultDigimonDrawState(300, 300, "eat")).toEqual({
      digiW: 120,
      digiH: 120,
      digiX: 120,
      digiY: 90,
      flip: false,
    });
  });

  test("기존 직사각형 저장값을 가로 폭 기준의 정사각형으로 정규화한다", () => {
    expect(normalizeGameSceneSize({ width: 300, height: 200 })).toEqual({
      width: 300,
      height: 300,
    });
    expect(normalizeGameSceneSize({ width: 700, height: 200 })).toEqual({
      width: 600,
      height: 600,
    });
  });
});
