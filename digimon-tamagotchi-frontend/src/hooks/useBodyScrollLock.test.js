import React from "react";
import { render } from "@testing-library/react";
import useBodyScrollLock from "./useBodyScrollLock";

function ScrollLockHarness({ isLocked = true }) {
  useBodyScrollLock(isLocked);
  return <div>locked</div>;
}

describe("useBodyScrollLock", () => {
  const originalScrollTo = window.scrollTo;

  beforeEach(() => {
    document.documentElement.removeAttribute("style");
    document.body.removeAttribute("style");
    Object.defineProperty(window, "scrollY", { configurable: true, value: 240 });
    window.scrollTo = jest.fn();
  });

  afterAll(() => {
    window.scrollTo = originalScrollTo;
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  });

  test("html과 body를 잠그고 해제 시 기존 style과 스크롤 위치를 복원한다", () => {
    document.documentElement.style.overflow = "auto";
    document.body.style.position = "relative";
    document.body.style.width = "92%";

    const { unmount } = render(<ScrollLockHarness />);

    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-240px");
    expect(document.body.style.width).toBe("100%");

    unmount();

    expect(document.documentElement.style.overflow).toBe("auto");
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.position).toBe("relative");
    expect(document.body.style.width).toBe("92%");
    expect(window.scrollTo).toHaveBeenCalledWith(0, 240);
  });

  test("잠금이 비활성화되면 문서 style과 스크롤을 변경하지 않는다", () => {
    document.documentElement.style.overflow = "auto";
    document.body.style.position = "relative";

    const { unmount } = render(<ScrollLockHarness isLocked={false} />);

    expect(document.documentElement.style.overflow).toBe("auto");
    expect(document.body.style.position).toBe("relative");
    unmount();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
