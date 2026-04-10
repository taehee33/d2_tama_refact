export function showJogressSuccessFeedback({
  resultDisplayName,
  toggleModal,
  closeModalName,
  alertFn = window.alert,
}) {
  if (closeModalName && typeof toggleModal === "function") {
    toggleModal(closeModalName, false);
  }

  if (typeof alertFn === "function") {
    alertFn(`조그레스 진화 완료! ${resultDisplayName}(으)로 진화했습니다.`);
  }
}
