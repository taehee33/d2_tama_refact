import React from "react";
import { render, screen } from "@testing-library/react";
import ImmersiveDeviceShell from "./ImmersiveDeviceShell";

describe("ImmersiveDeviceShell", () => {
  test("세로와 가로 셸 클래스를 구분하고 회전 안내를 표시할 수 있다", () => {
    const { rerender, container } = render(
      <ImmersiveDeviceShell layoutMode="portrait" skinId="tama-classic-pink">
        <div>portrait</div>
      </ImmersiveDeviceShell>
    );

    expect(container.firstChild).toHaveClass("immersive-device-shell--portrait");

    rerender(
      <ImmersiveDeviceShell
        layoutMode="landscape"
        skinId="tama-mint"
        showRotateHint
        landscapeSide="left"
        landscapeSideMode="auto"
      >
        <div>landscape</div>
      </ImmersiveDeviceShell>
    );

    expect(container.firstChild).toHaveClass("immersive-device-shell--landscape");
    expect(container.firstChild).toHaveAttribute("data-landscape-side", "left");
    expect(screen.getByRole("note")).toHaveTextContent("왼쪽이나 오른쪽으로 돌리면");
  });
});
