const DEATH_REASON_LABELS = Object.freeze({
  "STARVATION (굶주림)": "굶주림",
  "EXHAUSTION (힘 소진)": "힘 소진",
  "INJURY OVERLOAD (부상 과다: 15회)": "부상 과다",
  "INJURY NEGLECT (부상 방치: 6시간)": "부상 방치",
  "OLD AGE (수명 다함)": "수명 종료",
});

/** 저장된 사망 원인 코드를 사용자용 한국어 라벨로 변환합니다. */
export function getDeathReasonLabel(reason) {
  return DEATH_REASON_LABELS[reason] || "원인 확인 불가";
}

/** 누적 수명 카드 등 짧은 상태 표시에 사용하는 사망 문구입니다. */
export function getDeathStatusText(reason) {
  return `사망(${getDeathReasonLabel(reason)})`;
}
