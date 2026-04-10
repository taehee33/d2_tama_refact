export function buildJogressSummary({
  currentDisplayName,
  partnerDisplayName,
  resultDisplayName,
  hostSlotLabel,
  guestSlotLabel,
  partnerTamerName,
  includePartnerDigimonName = false,
}) {
  return {
    currentLabel: `${currentDisplayName}(${hostSlotLabel})`,
    partnerLabel: `${partnerDisplayName}(${guestSlotLabel})`,
    ...(partnerTamerName !== undefined ? { partnerTamerName } : {}),
    ...(includePartnerDigimonName
      ? { partnerDigimonName: partnerDisplayName }
      : {}),
    resultName: resultDisplayName,
  };
}

export function buildJogressArchivePayload({
  mode,
  hostUid,
  hostTamerName,
  hostSlotId,
  hostDigimonName,
  hostSlotVersion,
  guestUid,
  guestTamerName,
  guestSlotId,
  guestDigimonName,
  guestSlotVersion,
  targetId,
  targetName,
  isOnline,
  resultName,
  hostSlotLabel,
  guestSlotLabel,
  roomId,
}) {
  return {
    hostUid,
    hostTamerName,
    hostSlotId,
    hostDigimonName,
    hostSlotVersion,
    guestUid,
    guestTamerName,
    guestSlotId,
    guestDigimonName,
    guestSlotVersion,
    targetId,
    targetName,
    isOnline,
    payload: {
      mode,
      resultName,
      ...(hostSlotLabel !== undefined ? { hostSlotLabel } : {}),
      ...(guestSlotLabel !== undefined ? { guestSlotLabel } : {}),
      ...(roomId !== undefined ? { roomId } : {}),
    },
  };
}
