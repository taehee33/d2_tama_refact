"use strict";

const {
  getDocument,
  runQuery,
} = require("../digimon-tamagotchi-frontend/api/_lib/firestoreAdmin");
const {
  collectSlotNotificationDiagnostic,
} = require("./slotNotificationDiagnosticCore");

function readArgument(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

function readPendingArguments() {
  const baseRevision = readArgument("pending-base-revision");
  const updatedAt = readArgument("pending-updated-at");
  const isDead = readArgument("pending-is-dead");
  if (baseRevision == null && updatedAt == null && isDead == null) return null;
  return {
    baseRevision,
    updatedAt,
    isDead: String(isDead).toLowerCase() === "true",
  };
}

async function main() {
  const uid = readArgument("uid");
  const slotId = readArgument("slot") || "slot5";
  const result = await collectSlotNotificationDiagnostic({
    uid,
    slotId,
    pending: readPendingArguments(),
    getDocumentByPath: getDocument,
    queryDocuments: runQuery,
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.diagnosis.category === "NEEDS_SCOPE_APPROVAL") {
    process.exitCode = 2;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[slot notification diagnostic] 실패: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { readArgument, readPendingArguments };
