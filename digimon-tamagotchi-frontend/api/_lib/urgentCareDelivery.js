"use strict";

const crypto = require("node:crypto");

const FIRESTORE_WRITE_BATCH_SIZE = 450;

function buildDeliveryId(uid, slotId, issueKeys, occurrenceSeed = 0) {
  return crypto
    .createHash("sha256")
    .update(`${uid}|${slotId}|${[...issueKeys].sort().join(",")}|${occurrenceSeed}`)
    .digest("hex")
    .slice(0, 32);
}

async function commitInBatches(writes, commit) {
  for (let index = 0; index < writes.length; index += FIRESTORE_WRITE_BATCH_SIZE) {
    await commit(writes.slice(index, index + FIRESTORE_WRITE_BATCH_SIZE));
  }
}

function buildUrgentMessage(tamerName, slotAlerts, generatedAt) {
  const safeSlotAlerts = Array.isArray(slotAlerts) ? slotAlerts : [];
  const issueCount = safeSlotAlerts.reduce(
    (total, slot) => total + (Array.isArray(slot?.issues) ? slot.issues.length : 0),
    0
  );
  const lines = safeSlotAlerts.flatMap((slot) => {
    const slotLabel = String(slot?.slotId || "slot?").replace(/^slot\s*/i, "슬롯 ");
    const issues = Array.isArray(slot?.issues) ? slot.issues : [];
    return [
      `🐾 **${slot?.digimonName || "알 수 없는 디지몬"}** · \`${slotLabel}\``,
      ...issues.map((issue) => `> ${issue.label}`),
      "",
    ];
  });

  return [
    "━━━━━━━━━━━━━━━━━━",
    "🚨 **디지몬 긴급 케어 알림**",
    "지금 확인이 필요한 상태가 발생했습니다.",
    "",
    `👤 **테이머**: ${tamerName}`,
    `⚠️ **긴급 대상**: ${safeSlotAlerts.length}마리 · ${issueCount}건`,
    "",
    ...lines,
    "📱 앱을 열어 현재 상태를 확인해 주세요.",
    "",
    `⏰ **확인 시간**: ${generatedAt}`,
    "━━━━━━━━━━━━━━━━━━",
  ].join("\n");
}

function formatKstDate(nowMs) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(nowMs));
}

module.exports = {
  buildDeliveryId,
  buildUrgentMessage,
  commitInBatches,
  formatKstDate,
};
