import { showJogressSuccessFeedback } from "./jogressUiFeedbackHelpers";

describe("jogressUiFeedbackHelpers", () => {
  test("showJogressSuccessFeedback는 guest 성공 시 alert만 표시한다", () => {
    const alertFn = jest.fn();

    showJogressSuccessFeedback({
      resultDisplayName: "오메가몬",
      alertFn,
    });

    expect(alertFn).toHaveBeenCalledWith(
      "조그레스 진화 완료! 오메가몬(으)로 진화했습니다."
    );
  });

  test("showJogressSuccessFeedback는 host room 성공 시 모달을 닫고 alert를 표시한다", () => {
    const alertFn = jest.fn();
    const toggleModal = jest.fn();

    showJogressSuccessFeedback({
      resultDisplayName: "오메가몬",
      toggleModal,
      closeModalName: "jogressRoomList",
      alertFn,
    });

    expect(toggleModal).toHaveBeenCalledWith("jogressRoomList", false);
    expect(alertFn).toHaveBeenCalledWith(
      "조그레스 진화 완료! 오메가몬(으)로 진화했습니다."
    );
  });

  test("showJogressSuccessFeedback는 toggleModal이 없어도 throw하지 않는다", () => {
    const alertFn = jest.fn();

    expect(() =>
      showJogressSuccessFeedback({
        resultDisplayName: "오메가몬",
        closeModalName: "jogressRoomList",
        alertFn,
      })
    ).not.toThrow();

    expect(alertFn).toHaveBeenCalledWith(
      "조그레스 진화 완료! 오메가몬(으)로 진화했습니다."
    );
  });
});
