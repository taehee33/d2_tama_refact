import { fireEvent, render, screen } from "@testing-library/react";
import GameSlotLoadState, { GameLocalPersistenceWarning } from "./GameSlotLoadState";

describe("GameSlotLoadState", () => {
  test("loading에서는 게임 대신 안전한 로딩 안내를 표시한다", () => {
    render(<GameSlotLoadState phase="loading" />);

    expect(screen.getByText("슬롯 데이터 로딩 중...")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  test("failed에서는 데이터 미변경 안내와 복구 동선을 제공한다", () => {
    const onRetry = jest.fn();
    const onBack = jest.fn();
    render(
      <GameSlotLoadState
        phase="failed"
        error={{ code: "SLOT_NOT_FOUND" }}
        onRetry={onRetry}
        onBack={onBack}
      />
    );

    expect(screen.getByText("슬롯을 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByText("게임 데이터는 변경되지 않았습니다.")).toBeInTheDocument();
    expect(screen.getByText("요청한 슬롯을 찾을 수 없습니다.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    fireEvent.click(screen.getByRole("button", { name: "플레이 허브로 돌아가기" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test("IndexedDB만 사용할 수 없으면 서버 저장 지속 경고를 표시한다", () => {
    render(<GameLocalPersistenceWarning />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "이 기기의 임시 저장소를 사용할 수 없습니다. 서버 저장은 계속 시도됩니다."
    );
  });
});
