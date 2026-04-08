import React from "react";
import { render, waitFor } from "@testing-library/react";
import Canvas from "./Canvas";
import { resetRuntimeMetrics } from "../utils/runtimeMetrics";

function buildIdleMotionTimeline(overrides = {}) {
  return [
    { f: 1, spriteNumber: 210, x: 24, y: 24, flip: false, ...overrides[0] },
    { f: 2, spriteNumber: 211, x: 18, y: 24, flip: true, ...overrides[1] },
  ];
}

function getCanvasInitCount() {
  return (
    window.__DIGIMON_RUNTIME_METRICS__?.counters?.canvas_initImages_calls || 0
  );
}

describe("Canvas idle motion timeline", () => {
  const originalImage = global.Image;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  let loadedImageSources = [];

  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      clearRect: jest.fn(),
      drawImage: jest.fn(),
      save: jest.fn(),
      scale: jest.fn(),
      restore: jest.fn(),
      fillText: jest.fn(),
    }));

    global.Image = class MockImage {
      constructor() {
        this.naturalWidth = 16;
      }

      set src(value) {
        this._src = value;
        loadedImageSources.push(value);
      }
    };
  });

  afterAll(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    global.Image = originalImage;
  });

  beforeEach(() => {
    resetRuntimeMetrics();
    jest.clearAllMocks();
    loadedImageSources = [];
  });

  test("같은 의미의 idle 타임라인으로 다시 렌더링되면 캔버스를 재초기화하지 않는다", async () => {
    const baseProps = {
      width: 300,
      height: 200,
      currentAnimation: "idle",
      idleFrames: ["210", "211"],
    };

    const { rerender } = render(
      <Canvas
        {...baseProps}
        idleMotionTimeline={buildIdleMotionTimeline()}
      />
    );

    await waitFor(() => {
      expect(getCanvasInitCount()).toBe(1);
    });

    rerender(
      <Canvas
        {...baseProps}
        idleMotionTimeline={buildIdleMotionTimeline()}
      />
    );

    await waitFor(() => {
      expect(getCanvasInitCount()).toBe(1);
    });
  });

  test("idle 타임라인 의미값이 바뀌면 캔버스를 다시 초기화한다", async () => {
    const baseProps = {
      width: 300,
      height: 200,
      currentAnimation: "idle",
      idleFrames: ["210", "211"],
    };

    const { rerender } = render(
      <Canvas
        {...baseProps}
        idleMotionTimeline={buildIdleMotionTimeline()}
      />
    );

    await waitFor(() => {
      expect(getCanvasInitCount()).toBe(1);
    });

    rerender(
      <Canvas
        {...baseProps}
        idleMotionTimeline={buildIdleMotionTimeline({
          1: { x: 12, spriteNumber: 212 },
        })}
      />
    );

    await waitFor(() => {
      expect(getCanvasInitCount()).toBe(2);
    });
  });

  test("낮잠 상태에서는 idle 타임라인 스프라이트를 preload하지 않고 수면 프레임만 사용한다", async () => {
    render(
      <Canvas
        width={300}
        height={200}
        currentAnimation="idle"
        sleepStatus="NAPPING"
        selectedDigimon="Agumon"
        idleFrames={["111", "112"]}
        idleMotionTimeline={buildIdleMotionTimeline()}
      />
    );

    await waitFor(() => {
      expect(getCanvasInitCount()).toBe(1);
    });

    expect(loadedImageSources).toContain("/images/111.png");
    expect(loadedImageSources).toContain("/images/112.png");
    expect(loadedImageSources).not.toContain("/images/210.png");
    expect(loadedImageSources).not.toContain("/images/211.png");
  });

  test("부상 상태에서는 idle 타임라인 스프라이트를 preload하지 않고 부상 프레임만 사용한다", async () => {
    render(
      <Canvas
        width={300}
        height={200}
        currentAnimation="idle"
        isInjured
        idleFrames={["123", "124"]}
        idleMotionTimeline={buildIdleMotionTimeline()}
      />
    );

    await waitFor(() => {
      expect(getCanvasInitCount()).toBe(1);
    });

    expect(loadedImageSources).toContain("/images/123.png");
    expect(loadedImageSources).toContain("/images/124.png");
    expect(loadedImageSources).toContain("/images/541.png");
    expect(loadedImageSources).toContain("/images/542.png");
    expect(loadedImageSources).not.toContain("/images/210.png");
    expect(loadedImageSources).not.toContain("/images/211.png");
  });
});
