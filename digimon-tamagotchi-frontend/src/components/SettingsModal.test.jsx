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

function renderSettingsModalWithParentState({ canUseDeveloperMode = true } = {}) {
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
        canUseDeveloperMode={canUseDeveloperMode}
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
  test("운영자에게 Developer Mode 운영자 권한 라벨과 토글을 표시한다", () => {
    renderSettingsModalWithParentState({ canUseDeveloperMode: true });

    expect(screen.getByText("Developer Mode (운영자 권한)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "OFF" })).toBeInTheDocument();
  });

  test("개발자 옵션 체크 변경이 저장 전 Developer Mode draft를 끄지 않는다", () => {
    renderSettingsModalWithParentState();

    fireEvent.click(screen.getByRole("button", { name: "OFF" }));
    expect(screen.getByRole("button", { name: "ON" })).toBeInTheDocument();
    expect(screen.getByText("개발자 옵션")).toBeInTheDocument();
    expect(screen.queryByText("디지몬 마스터 데이터")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("checkbox", { name: "도감 미발견 디지몬 공개" })
    );

    expect(screen.getByRole("button", { name: "ON" })).toBeInTheDocument();
    expect(screen.getByText("개발자 옵션")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "모든 진화 조건 무시 (후보 선택 후 즉시 진화 가능)",
      })
    );

    expect(screen.getByRole("button", { name: "ON" })).toBeInTheDocument();
    expect(screen.getByText("개발자 옵션")).toBeInTheDocument();
  });

  test("비운영자에게 Developer Mode와 개발자 옵션을 숨긴다", () => {
    renderSettingsModalWithParentState({ canUseDeveloperMode: false });

    expect(screen.queryByText(/Developer Mode/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "OFF" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ON" })).not.toBeInTheDocument();
    expect(screen.queryByText("개발자 옵션")).not.toBeInTheDocument();
  });

  test("비운영자 저장 시 Developer Mode를 false로 보정한다", () => {
    const setDeveloperMode = jest.fn();

    render(
      <SettingsModal
        onClose={jest.fn()}
        foodSizeScale={0.31}
        setFoodSizeScale={jest.fn()}
        developerMode
        setDeveloperMode={setDeveloperMode}
        canUseDeveloperMode={false}
        encyclopediaShowQuestionMark={false}
        setEncyclopediaShowQuestionMark={jest.fn()}
        ignoreEvolutionTime={false}
        setIgnoreEvolutionTime={jest.fn()}
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

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(setDeveloperMode).toHaveBeenCalledWith(false);
  });

  test("개발자 모드를 OFF로 저장하면 전체 조건 무시도 해제한다", () => {
    const setIgnoreEvolutionTime = jest.fn();

    render(
      <SettingsModal
        onClose={jest.fn()}
        foodSizeScale={0.31}
        setFoodSizeScale={jest.fn()}
        developerMode
        setDeveloperMode={jest.fn()}
        canUseDeveloperMode
        encyclopediaShowQuestionMark={false}
        setEncyclopediaShowQuestionMark={jest.fn()}
        ignoreEvolutionTime
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

    fireEvent.click(screen.getByRole("button", { name: "ON" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(setIgnoreEvolutionTime).toHaveBeenCalledWith(false);
  });
});
