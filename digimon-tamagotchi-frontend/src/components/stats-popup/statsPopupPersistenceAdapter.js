/**
 * 기존 stats 저장 callback을 payload 변경 없이 호출합니다.
 */
export function persistStatsPopupChange({ onChangeStats, nextStats }) {
  onChangeStats(nextStats);
}

/**
 * 레거시 야행성 저장 순서를 보존합니다.
 * 로그 append를 시작하고 rejection catch를 등록한 뒤, 기다리지 않고 stats를 저장합니다.
 */
export function persistStatsPopupNocturnalChange({
  appendLogToSubcollection,
  onChangeStats,
  mutation,
}) {
  if (appendLogToSubcollection) {
    appendLogToSubcollection(mutation.logPayload).catch(() => {});
  }
  onChangeStats(mutation.nextStats);
}
