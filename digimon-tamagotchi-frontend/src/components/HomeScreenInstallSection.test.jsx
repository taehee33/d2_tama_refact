import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import HomeScreenInstallSection from "./HomeScreenInstallSection";

function createInstallState(overrides = {}) {
  return {
    isInstalled: false,
    isInstallable: false,
    isIOS: false,
    showIOSInstructions: false,
    openInstallPrompt: jest.fn(),
    setShowIOSInstructions: jest.fn(),
    ...overrides,
  };
}

describe("HomeScreenInstallSection", () => {
  test("설치 완료 상태면 완료 메시지를 보여준다", () => {
    render(
      <HomeScreenInstallSection
        installState={createInstallState({ isInstalled: true })}
      />
    );

    expect(screen.getByText("✅ 앱이 설치되어 있습니다!")).toBeInTheDocument();
  });

  test("설치 가능한 상태면 홈화면에 추가 버튼을 누를 수 있다", () => {
    const installState = createInstallState({ isInstallable: true });

    render(<HomeScreenInstallSection installState={installState} />);

    fireEvent.click(screen.getByRole("button", { name: "📱 홈화면에 추가" }));

    expect(installState.openInstallPrompt).toHaveBeenCalled();
  });

  test("iOS 안내 상태면 설치 방법과 닫기 버튼을 보여준다", () => {
    const installState = createInstallState({
      isIOS: true,
      showIOSInstructions: true,
    });

    render(<HomeScreenInstallSection installState={installState} />);

    expect(screen.getByText("iOS Safari 설치 방법:")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(installState.setShowIOSInstructions).toHaveBeenCalledWith(false);
  });

  test("설치가 지원되지 않으면 지원 불가 안내를 보여준다", () => {
    render(<HomeScreenInstallSection installState={createInstallState()} />);

    expect(
      screen.getByText("이 브라우저에서는 설치가 지원되지 않습니다.")
    ).toBeInTheDocument();
  });
});
