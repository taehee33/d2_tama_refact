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
  const lines = slotAlerts.flatMap((slot) => [
    `**${slot.digimonName}** (${slot.slotId})`,
    ...slot.issues.map((issue) => `- ${issue.label}`),
  ]);
  return [
    "━━━━━━━━━━━━━━━━━━",
    "🚨 **긴급 케어 알림**",
    `👤 **테이머**: ${tamerName}`,
    "",
    ...lines,
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
