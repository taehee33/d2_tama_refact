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
});
