import { act, renderHook } from "@testing-library/react";
import usePwaInstallPrompt from "./usePwaInstallPrompt";

function createMatchMedia(matches = false) {
  const listeners = new Set();

  return {
    matches,
    media: "(display-mode: standalone)",
    addEventListener: jest.fn((eventName, listener) => {
      if (eventName === "change") {
        listeners.add(listener);
      }
    }),
    removeEventListener: jest.fn((eventName, listener) => {
      if (eventName === "change") {
        listeners.delete(listener);
      }
    }),
    addListener: jest.fn((listener) => {
      listeners.add(listener);
    }),
    removeListener: jest.fn((listener) => {
      listeners.delete(listener);
    }),
  };
}

describe("usePwaInstallPrompt", () => {
  const originalMatchMedia = window.matchMedia;
  const originalAlert = window.alert;
  const originalUserAgent = window.navigator.userAgent;
  const originalStandalone = window.navigator.standalone;
  const originalMSStream = window.MSStream;

  beforeEach(() => {
    const matchMediaMock = createMatchMedia(false);
    window.matchMedia = jest.fn().mockImplementation(() => matchMediaMock);
    window.alert = jest.fn();
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36",
    });
    Object.defineProperty(window.navigator, "standalone", {
      configurable: true,
      value: false,
    });
    window.MSStream = undefined;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    window.alert = originalAlert;
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: originalUserAgent,
    });
    Object.defineProperty(window.navigator, "standalone", {
      configurable: true,
      value: originalStandalone,
    });
    window.MSStream = originalMSStream;
  });

  test("beforeinstallprompt를 받으면 설치 가능 상태가 된다", () => {
    const { result } = renderHook(() => usePwaInstallPrompt());
    const promptEvent = new Event("beforeinstallprompt");
    promptEvent.preventDefault = jest.fn();
    promptEvent.prompt = jest.fn().mockResolvedValue(undefined);
    promptEvent.userChoice = Promise.resolve({ outcome: "accepted" });

    act(() => {
      window.dispatchEvent(promptEvent);
    });

    expect(promptEvent.preventDefault).toHaveBeenCalled();
    expect(result.current.isInstallable).toBe(true);
    expect(result.current.isActionable).toBe(true);
    expect(result.current.isInstalled).toBe(false);
  });

  test("설치 프롬프트 승인 후 설치 상태로 전환한다", async () => {
    const { result } = renderHook(() => usePwaInstallPrompt());
    const promptEvent = new Event("beforeinstallprompt");
    promptEvent.preventDefault = jest.fn();
    promptEvent.prompt = jest.fn().mockResolvedValue(undefined);
    promptEvent.userChoice = Promise.resolve({ outcome: "accepted" });

    act(() => {
      window.dispatchEvent(promptEvent);
    });

    await act(async () => {
      await result.current.openInstallPrompt();
    });

    expect(promptEvent.prompt).toHaveBeenCalled();
    expect(result.current.isInstalled).toBe(true);
    expect(result.current.isInstallable).toBe(false);
    expect(result.current.isActionable).toBe(false);
  });

  test("appinstalled 이벤트를 받으면 설치 완료 상태로 전환한다", () => {
    const { result } = renderHook(() => usePwaInstallPrompt());

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.isActionable).toBe(false);
  });

  test("iOS Safari에서는 비설치 상태여도 설치 안내를 노출한다", async () => {
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });

    const { result } = renderHook(() => usePwaInstallPrompt());

    expect(result.current.isIOS).toBe(true);
    expect(result.current.isInstalled).toBe(false);
    expect(result.current.isActionable).toBe(true);

    await act(async () => {
      await result.current.openInstallPrompt();
    });

    expect(result.current.showIOSInstructions).toBe(true);
  });

  test("iOS standalone에서는 이미 설치된 상태로 본다", () => {
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    Object.defineProperty(window.navigator, "standalone", {
      configurable: true,
      value: true,
    });

    const { result } = renderHook(() => usePwaInstallPrompt());

    expect(result.current.isIOS).toBe(true);
    expect(result.current.isInstalled).toBe(true);
    expect(result.current.isActionable).toBe(false);
  });

  test("지원되지 않는 브라우저에서는 설치 액션이 비활성화된다", () => {
    const { result } = renderHook(() => usePwaInstallPrompt());

    expect(result.current.isIOS).toBe(false);
    expect(result.current.isInstalled).toBe(false);
    expect(result.current.isInstallable).toBe(false);
    expect(result.current.isActionable).toBe(false);
  });
});
