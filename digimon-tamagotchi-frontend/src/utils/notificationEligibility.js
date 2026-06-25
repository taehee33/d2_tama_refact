export function isSlotInNotificationExcludedStorage(slotData = {}) {
  const stats = slotData?.digimonStats || slotData || {};
  return (
    slotData?.isFrozen === true ||
    slotData?.isRefrigerated === true ||
    stats?.isFrozen === true ||
    stats?.isRefrigerated === true
  );
}

export function resolveSlotNotificationEligible({
  selectedDigimon = null,
  stats = {},
  slotData = {},
  isLoadingSlot = false,
} = {}) {
  const effectiveStats =
    stats && Object.keys(stats).length ? stats : slotData?.digimonStats || {};
  const effectiveSelectedDigimon =
    selectedDigimon || effectiveStats?.selectedDigimon || slotData?.selectedDigimon || null;

  if (isLoadingSlot || !effectiveSelectedDigimon) {
    return false;
  }

  return !isSlotInNotificationExcludedStorage({
    ...slotData,
    digimonStats: effectiveStats,
  });
}
