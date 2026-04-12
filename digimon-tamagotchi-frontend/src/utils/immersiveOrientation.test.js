import {
  enterImmersiveFullscreen,
  enterImmersiveLandscapeMode,
  exitImmersiveFullscreen,
  exitImmersiveLandscapeMode,
  getImmersiveOrientationSupportState,
  isProbablyIosSafari,
} from "./immersiveOrientation";

describe("immersiveOrientation utils", () => {
  test("iPhone Safari는 가로 고정 미지원으로 판별한다", () => {
    expect(
      isProbablyIosSafari({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        vendor: "Apple Computer, Inc.",
      })
    ).toBe(true);

    expect(
      getImmersiveOrientationSupportState({
        documentRef: { documentElement: {} },
        screenRef: { orientation: { lock: jest.fn() } },
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        vendor: "Apple Computer, Inc.",
      }).orientationLockSupported
    ).toBe(false);
  });

  test("지원 브라우저에서는 fullscreen 뒤 landscape lock을 시도한다", async () => {
    const documentRef = {
      documentElement: {},
      fullscreenElement: null,
    };
    const callOrder = [];
    const element = {
      requestFullscreen: jest.fn(async () => {
        callOrder.push("fullscreen");
        documentRef.fullscreenElement = element;
      }),
    };
    const screenRef = {
      orientation: {
        lock: jest.fn(async (mode) => {
          callOrder.push(`lock:${mode}`);
        }),
      },
    };

    const result = await enterImmersiveLandscapeMode({
      element,
      documentRef,
      screenRef,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
      vendor: "Google Inc.",
    });

    expect(callOrder).toEqual(["fullscreen", "lock:landscape"]);
    expect(screenRef.orientation.lock).toHaveBeenCalledWith("landscape");
    expect(result).toEqual({
      isFullscreen: true,
      orientationLockSupported: true,
      errorMessage: null,
    });
  });

  test("fullscreen-only 진입 성공 시 전체화면 상태를 돌려준다", async () => {
    const documentRef = {
      documentElement: {},
      fullscreenElement: null,
    };
    const element = {
      requestFullscreen: jest.fn(async () => {
        documentRef.fullscreenElement = element;
      }),
    };

    const result = await enterImmersiveFullscreen({
      element,
      documentRef,
      screenRef: {},
      userAgent:
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
      vendor: "Google Inc.",
    });

    expect(element.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      isFullscreen: true,
      fullscreenSupported: true,
      errorMessage: null,
    });
  });

  test("fullscreen-only 미지원 브라우저에서는 안내 메시지를 돌려준다", async () => {
    const documentRef = {
      documentElement: {},
      fullscreenElement: null,
    };

    const result = await enterImmersiveFullscreen({
      element: {},
      documentRef,
      screenRef: {},
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      vendor: "Apple Computer, Inc.",
    });

    expect(result.isFullscreen).toBe(false);
    expect(result.fullscreenSupported).toBe(false);
    expect(result.errorMessage).toContain("전체화면");
  });

  test("fullscreen-only request가 거부되면 실패 안내 메시지를 돌려준다", async () => {
    const documentRef = {
      documentElement: {},
      fullscreenElement: null,
    };
    const element = {
      requestFullscreen: jest.fn(async () => {
        throw new Error("fullscreen denied");
      }),
    };

    const result = await enterImmersiveFullscreen({
      element,
      documentRef,
      screenRef: {},
      userAgent:
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
      vendor: "Google Inc.",
    });

    expect(result.isFullscreen).toBe(false);
    expect(result.fullscreenSupported).toBe(true);
    expect(result.errorMessage).toContain("전체화면 전환");
  });

  test("가로 고정이 미지원이면 fullscreen 이후 안내 메시지를 돌려준다", async () => {
    const documentRef = {
      documentElement: {},
      fullscreenElement: null,
    };
    const element = {
      requestFullscreen: jest.fn(async () => {
        documentRef.fullscreenElement = element;
      }),
    };

    const result = await enterImmersiveLandscapeMode({
      element,
      documentRef,
      screenRef: {},
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      vendor: "Apple Computer, Inc.",
    });

    expect(element.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(result.isFullscreen).toBe(true);
    expect(result.orientationLockSupported).toBe(false);
    expect(result.errorMessage).toContain("직접 돌려");
  });

  test("lock이 거부되면 실패 안내 메시지를 돌려준다", async () => {
    const documentRef = {
      documentElement: {},
      fullscreenElement: null,
    };
    const element = {
      requestFullscreen: jest.fn(async () => {
        documentRef.fullscreenElement = element;
      }),
    };
    const screenRef = {
      orientation: {
        lock: jest.fn(async () => {
          throw new Error("lock denied");
        }),
      },
    };

    const result = await enterImmersiveLandscapeMode({
      element,
      documentRef,
      screenRef,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
      vendor: "Google Inc.",
    });

    expect(result.isFullscreen).toBe(true);
    expect(result.orientationLockSupported).toBe(true);
    expect(result.errorMessage).toContain("브라우저가 허용하지 않았어요");
  });

  test("세로 전환 시 unlock과 exitFullscreen을 best effort로 호출한다", async () => {
    const documentRef = {
      fullscreenElement: {},
      exitFullscreen: jest.fn(async () => {
        documentRef.fullscreenElement = null;
      }),
    };
    const screenRef = {
      orientation: {
        unlock: jest.fn(),
      },
    };

    const result = await exitImmersiveLandscapeMode({
      documentRef,
      screenRef,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
      vendor: "Google Inc.",
    });

    expect(screenRef.orientation.unlock).toHaveBeenCalledTimes(1);
    expect(documentRef.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(result.errorMessage).toBeNull();
    expect(result.isFullscreen).toBe(false);
  });

  test("fullscreen-only 종료 시 exitFullscreen을 best effort로 호출한다", async () => {
    const documentRef = {
      fullscreenElement: {},
      exitFullscreen: jest.fn(async () => {
        documentRef.fullscreenElement = null;
      }),
    };

    const result = await exitImmersiveFullscreen({
      documentRef,
      screenRef: {},
      userAgent:
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
      vendor: "Google Inc.",
    });

    expect(documentRef.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(result.errorMessage).toBeNull();
    expect(result.isFullscreen).toBe(false);
    expect(result.fullscreenSupported).toBe(false);
  });
});
