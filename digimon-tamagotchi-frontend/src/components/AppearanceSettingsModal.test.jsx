import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import AppearanceSettingsModal from "./AppearanceSettingsModal";
import { DEFAULT_IMMERSIVE_SETTINGS } from "../data/immersiveSettings";

describe("AppearanceSettingsModal", () => {
  it("편집은 draft에만 반영하고 저장할 때 한 번 전달한다", () => {
    const onSave = jest.fn();
    render(<AppearanceSettingsModal immersiveSettings={DEFAULT_IMMERSIVE_SETTINGS} initialSkinId="pixel-split-brick" onSave={onSave} onClose={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("배경 왼쪽 색상"), { target: { value: "#123456" } });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]["pixel-split-brick"].backgroundLeft).toBe("#123456");
  });

  it("스킨별 draft를 독립 보존하고 프리셋과 초기화를 제공한다", () => {
    const onSave = jest.fn();
    render(<AppearanceSettingsModal immersiveSettings={DEFAULT_IMMERSIVE_SETTINGS} initialSkinId="pixel-split-brick" onSave={onSave} onClose={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("중앙 게임기 색상"), { target: { value: "#112233" } });
    fireEvent.click(screen.getByRole("tab", { name: "레드 디바이스" }));
    fireEvent.click(screen.getByRole("button", { name: "디지털 블루" }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    const saved = onSave.mock.calls[0][0];
    expect(saved["pixel-split-brick"].device).toBe("#112233");
    expect(saved["pixel-red-device"].backgroundLeft).toBe("#238DF1");
  });

  it("취소하면 외형 값을 전달하지 않는다", () => {
    const onSave = jest.fn();
    const onClose = jest.fn();
    render(<AppearanceSettingsModal immersiveSettings={DEFAULT_IMMERSIVE_SETTINGS} onSave={onSave} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
