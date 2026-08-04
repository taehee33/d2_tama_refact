#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { applicationDefault, cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const {
  JOGRESS_ROOM_LIMIT,
  JOGRESS_ROOM_SCHEMA_VERSION,
  createLegacyGhostRegistrationKey,
  createJogressRegistrationKey,
  getRoomHostSnapshot,
} = require("../digimon-tamagotchi-frontend/api/_lib/jogressDomain");
const {
  getDigimonEntryByVersion,
  normalizeDigimonVersionLabel,
} = require("../digimon-tamagotchi-frontend/api/_generated/gameProjection.cjs");

const BACKUP_COLLECTION = "jogress_room_v3_migration_backups";

function parseArgs(argv) {
  const options = {
    apply: false,
    rollback: false,
    projectId: null,
    projectExplicit: false,
    confirmProjectId: null,
    allowApplicationDefault: false,
    reportPath: null,
    roomIds: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--dry-run") options.apply = false;
    else if (arg === "--rollback") options.rollback = true;
    else if (arg === "--project") { options.projectId = argv[++index] || null; options.projectExplicit = true; }
    else if (arg === "--confirm-project") options.confirmProjectId = argv[++index] || null;
    else if (arg === "--allow-application-default") options.allowApplicationDefault = true;
    else if (arg === "--report") options.reportPath = argv[++index] || null;
    else if (arg === "--room-id") options.roomIds.push(argv[++index] || "");
    else if (arg === "--help") options.help = true;
    else throw new Error(`지원하지 않는 옵션입니다: ${arg}`);
  }
  options.roomIds = [...new Set(options.roomIds.filter(Boolean))];
  return options;
}

function credentialSource() {
  if (process.env.FIRESTORE_EMULATOR_HOST) return "firestore-emulator";
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return "service-account-json";
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) return "service-account-path";
  return "application-default";
}

function validateOptions(options) {
  if (!options.projectId || !options.projectExplicit) throw new Error("대상 project를 --project로 명시해야 합니다.");
  if ((options.apply || options.rollback) && options.confirmProjectId !== options.projectId) {
    throw new Error("운영 쓰기에는 동일한 --confirm-project 값이 필요합니다.");
  }
  if (options.rollback && options.roomIds.length === 0) throw new Error("rollback에는 하나 이상의 --room-id가 필요합니다.");
  const source = credentialSource();
  if ((options.apply || options.rollback) && source === "application-default" && !options.allowApplicationDefault) {
    throw new Error("운영 쓰기에는 명시적 service account 또는 --allow-application-default 확인이 필요합니다.");
  }
  return source;
}

function loadCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    return cert(JSON.parse(fs.readFileSync(path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH), "utf8")));
  }
  return applicationDefault();
}

function timeValue(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildSnapshot(room) {
  const legacy = getRoomHostSnapshot(room);
  const version = normalizeDigimonVersionLabel(legacy.version || "Ver.1");
  const entry = legacy.digimonId ? getDigimonEntryByVersion(version, legacy.digimonId) : null;
  return {
    ...legacy,
    version,
    name: legacy.name || entry?.name || legacy.digimonId || "알 수 없음",
    stage: legacy.stage || entry?.stage || null,
    sprite: legacy.sprite ?? entry?.sprite ?? null,
    spriteBasePath: legacy.spriteBasePath || entry?.spriteBasePath || null,
  };
}

function buildRoomPlan(id, room, now) {
  const snapshot = buildSnapshot(room);
  const validSnapshot = Boolean(snapshot.digimonId && getDigimonEntryByVersion(snapshot.version, snapshot.digimonId));
  const identityRoom = Boolean(room.hostSourceIdentityId);
  const base = {
    schemaVersion: JOGRESS_ROOM_SCHEMA_VERSION,
    hostSnapshot: snapshot,
    snapshotKind: identityRoom ? "identity" : "legacyGhost",
    linkStatus: identityRoom ? (room.linkStatus || "live") : "ghost",
    updatedAt: now,
    migration: { schemaVersion: 3, migratedAt: now, sourceStatus: room.status || null },
  };
  if (room.status === "paired") {
    return { id, ownerUid: room.hostUid, active: false, category: "completed", patch: {
      ...base, status: "completed", linkStatus: "ghost", completionMode: "ghostFallback",
      completedAt: room.completedAt || now,
    } };
  }
  if (room.status === "waiting" || (room.status === "expired" && validSnapshot)) {
    const registrationKey = identityRoom
      ? (room.registrationKey || createJogressRegistrationKey({ ownerUid: room.hostUid, sourceIdentityId: room.hostSourceIdentityId }))
      : createLegacyGhostRegistrationKey(id);
    return { id, ownerUid: room.hostUid, active: true, category: room.status === "expired" ? "restored" : "waiting", patch: {
      ...base, status: "waiting", completionMode: null, registrationKey,
      ...(room.status === "expired" ? { restoredFromExpiredAt: now } : {}),
    } };
  }
  return { id, ownerUid: room.hostUid || null, active: false, category: "excluded", patch: base };
}

function planMigration(rooms, now = new Date()) {
  const plans = rooms.map(({ id, data }) => ({ ...buildRoomPlan(id, data || {}, now), original: data || {} }));
  const byOwner = new Map();
  for (const plan of plans.filter((item) => item.active && item.ownerUid)) {
    const list = byOwner.get(plan.ownerUid) || [];
    list.push(plan);
    byOwner.set(plan.ownerUid, list);
  }
  for (const list of byOwner.values()) {
    list.sort((left, right) => {
      const waitingPriority = Number(right.category === "waiting") - Number(left.category === "waiting");
      return waitingPriority || timeValue(right.original.createdAt) - timeValue(left.original.createdAt) || left.id.localeCompare(right.id);
    });
    list.slice(JOGRESS_ROOM_LIMIT).forEach((plan) => {
      plan.active = false;
      plan.category = "excluded";
      plan.patch = {
        ...plan.patch,
        status: "expired",
        linkStatus: "ghost",
        completionMode: null,
        migration: { ...plan.patch.migration, exclusionReason: "ROOM_LIMIT" },
      };
    });
  }
  return plans;
}

function planCurrentIndexes(rooms) {
  return rooms.map(({ id, data }) => {
    const room = data || {};
    const active = room.status === "waiting" || room.status === "paired";
    const category = active ? "waiting" : (room.status === "completed" ? "completed" : "excluded");
    const registrationKey = room.registrationKey || (room.hostSourceIdentityId
      ? createJogressRegistrationKey({ ownerUid: room.hostUid, sourceIdentityId: room.hostSourceIdentityId })
      : createLegacyGhostRegistrationKey(id));
    return {
      id,
      ownerUid: room.hostUid || null,
      active,
      category,
      original: room,
      patch: {
        registrationKey,
        snapshotKind: room.snapshotKind || (room.hostSourceIdentityId ? "identity" : "legacyGhost"),
        hostSnapshot: getRoomHostSnapshot(room),
      },
    };
  });
}

function buildReport(plans, options, source, now) {
  const perUser = {};
  for (const plan of plans) {
    const uid = plan.ownerUid || "__unknown__";
    perUser[uid] ||= { target: 0, restored: 0, completed: 0, excluded: 0, active: 0 };
    perUser[uid].target += 1;
    perUser[uid][plan.category] = (perUser[uid][plan.category] || 0) + 1;
    if (plan.active) perUser[uid].active += 1;
  }
  return {
    schemaVersion: 3,
    migration: "jogress-one-time-ghost-v3",
    mode: options.rollback ? "rollback" : (options.apply ? "apply" : "dry-run"),
    projectId: options.projectId,
    credentialSource: source,
    generatedAt: now.toISOString(),
    totals: {
      target: plans.length,
      waiting: plans.filter((plan) => plan.category === "waiting").length,
      restored: plans.filter((plan) => plan.category === "restored").length,
      completed: plans.filter((plan) => plan.category === "completed").length,
      excluded: plans.filter((plan) => plan.category === "excluded").length,
      active: plans.filter((plan) => plan.active).length,
    },
    perUser,
    roomIds: plans.map((plan) => plan.id),
  };
}

async function rebuildOwnerIndexes(db, plans, now) {
  const ownerIds = [...new Set(plans.map((plan) => plan.ownerUid).filter(Boolean))];
  for (const uid of ownerIds) {
    const active = plans.filter((plan) => plan.ownerUid === uid && plan.active);
    await db.doc(`jogress_room_owners/${uid}`).set({ schemaVersion: 1, activeRoomIds: active.map((plan) => plan.id), updatedAt: now });
    for (const plan of active) {
      await db.doc(`jogress_room_registrations/${plan.patch.registrationKey}`).set({
        ownerUid: uid,
        sourceIdentityId: plan.patch.hostSnapshot.sourceIdentityId || null,
        roomId: plan.id,
        legacyGhost: plan.patch.snapshotKind === "legacyGhost",
        createdAt: plan.original.createdAt || now,
      });
    }
  }
}

async function applyPlans(db, plans, now) {
  for (const plan of plans) {
    await db.runTransaction(async (transaction) => {
      const roomRef = db.doc(`jogress_rooms/${plan.id}`);
      const backupRef = db.doc(`${BACKUP_COLLECTION}/${plan.id}`);
      const [roomSnap, backupSnap] = await transaction.getAll(roomRef, backupRef);
      if (!roomSnap.exists) return;
      if (!backupSnap.exists) {
        transaction.create(backupRef, {
          schemaVersion: 1,
          roomId: plan.id,
          originalRoom: roomSnap.data() || {},
          backedUpAt: now,
        });
      }
      transaction.set(roomRef, plan.patch, { merge: true });
      if (!plan.active && plan.original.registrationKey) {
        transaction.delete(db.doc(`jogress_room_registrations/${plan.original.registrationKey}`));
      }
    });
  }
  await rebuildOwnerIndexes(db, plans, now);
}

async function rollbackRooms(db, roomIds, now) {
  for (const roomId of roomIds) {
    await db.runTransaction(async (transaction) => {
      const roomRef = db.doc(`jogress_rooms/${roomId}`);
      const backupRef = db.doc(`${BACKUP_COLLECTION}/${roomId}`);
      const [room, backup] = await transaction.getAll(roomRef, backupRef);
      if (!backup.exists) throw new Error(`백업을 찾을 수 없습니다: ${roomId}`);
      const migratedRegistrationKey = room.exists ? room.data()?.registrationKey : null;
      if (migratedRegistrationKey) {
        transaction.delete(db.doc(`jogress_room_registrations/${migratedRegistrationKey}`));
      }
      transaction.set(roomRef, backup.data().originalRoom || {});
      transaction.update(backupRef, { restoredAt: now });
    });
  }
}

async function runMigration(options, dependencies = {}) {
  const source = validateOptions(options);
  if (!dependencies.db && getApps().length === 0) initializeApp({ credential: loadCredential(), projectId: options.projectId });
  const db = dependencies.db || getFirestore();
  const now = dependencies.now || new Date();
  if (options.rollback) {
    await rollbackRooms(db, options.roomIds, now);
    const snapshot = await db.collection("jogress_rooms").get();
    const rooms = snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
    const plans = planCurrentIndexes(rooms);
    await rebuildOwnerIndexes(db, plans, now);
    const restoredPlans = plans.filter((plan) => options.roomIds.includes(plan.id));
    return buildReport(restoredPlans, options, source, now);
  }
  const snapshot = await db.collection("jogress_rooms").get();
  const plans = planMigration(snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} })), now);
  if (options.apply) await applyPlans(db, plans, now);
  return buildReport(plans, options, source, now);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write("node scripts/migrateJogressRoomsToGhostV3.js --project <id> [--dry-run|--apply --confirm-project <id>] [--rollback --room-id <id> --confirm-project <id>]\n");
    return;
  }
  const report = await runMigration(options);
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (options.reportPath) fs.writeFileSync(path.resolve(process.cwd(), options.reportPath), output, "utf8");
  process.stdout.write(output);
}

if (require.main === module) main().catch((error) => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });

module.exports = {
  BACKUP_COLLECTION,
  buildRoomPlan,
  parseArgs,
  planCurrentIndexes,
  planMigration,
  runMigration,
  validateOptions,
};
