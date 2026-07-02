import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import SettingsModal from "./SettingsModal";

jest.mock("../hooks/usePwaInstallPrompt", () => () => ({
  canInstall: false,
  isInstalled: false,
  isIos: false,
  isStandalone: false,
  promptInstall: jest.fn(),
}));

function renderSettingsModalWithParentState() {
  function Wrapper() {
    const [developerMode, setDeveloperMode] = React.useState(false);
    const [encyclopediaShowQuestionMark, setEncyclopediaShowQuestionMark] =
      React.useState(false);
    const [ignoreEvolutionTime, setIgnoreEvolutionTime] =
      React.useState(false);

    return (
      <SettingsModal
        onClose={jest.fn()}
        foodSizeScale={0.31}
        setFoodSizeScale={jest.fn()}
        developerMode={developerMode}
        setDeveloperMode={setDeveloperMode}
        encyclopediaShowQuestionMark={encyclopediaShowQuestionMark}
        setEncyclopediaShowQuestionMark={setEncyclopediaShowQuestionMark}
        ignoreEvolutionTime={ignoreEvolutionTime}
        setIgnoreEvolutionTime={setIgnoreEvolutionTime}
        width={300}
        height={200}
        setWidth={jest.fn()}
        setHeight={jest.fn()}
        backgroundNumber={1}
        setBackgroundNumber={jest.fn()}
        digimonSizeScale={1}
        setDigimonSizeScale={jest.fn()}
        timeMode="real"
        setTimeMode={jest.fn()}
        timeSpeed={1}
        setTimeSpeed={jest.fn()}
        customTime=""
        setCustomTime={jest.fn()}
        newDigimonDataVer1={null}
        digimonDataVer1={null}
        digimonDataVer2={null}
        initializeStats={null}
        setDigimonStatsAndSave={null}
        setSelectedDigimonAndSave={null}
        selectedDigimon="Agumon"
        digimonStats={{}}
        slotVersion="Ver.1"
      />
    );
  }

  return render(<Wrapper />);
}

describe("SettingsModal developer options", () => {
  test("개발자 옵션 체크 변경이 저장 전 Developer Mode draft를 끄지 않는다", () => {
    renderSettingsModalWithParentState();

    fireEvent.click(screen.getByRole("button", { name: "OFF" }));
    expect(screen.getByRole("button", { name: "ON" })).toBeInTheDocument();
    expect(screen.getByText("개발자 옵션")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("checkbox", { name: "도감 미발견 디지몬 공개" })
    );

    expect(screen.getByRole("button", { name: "ON" })).toBeInTheDocument();
    expect(screen.getByText("개발자 옵션")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "모든 진화 조건 무시 (체크 시 바로 진화 가능)",
      })
    );

    expect(screen.getByRole("button", { name: "ON" })).toBeInTheDocument();
    expect(screen.getByText("개발자 옵션")).toBeInTheDocument();
  });
});
