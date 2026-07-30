"use strict";

const { getArenaFirestore } = require("./arenaTransactions");
const { timestampToIso } = require("./realtimeArenaDomain");

const WAITING_ROOM_LIMIT = 30;

function toMillis(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function serializeWaitingRoom(doc, uid) {
  const battle = doc.data() || {};
  const listing = battle.listing || {};
  return {
    battleId: doc.id,
    isOwn: battle.hostUid === uid,
    ownerDisplayName: listing.ownerDisplayName || "알 수 없는 테이머",
    createdAt: timestampToIso(battle.createdAt),
    expiresAt: timestampToIso(battle.expiresAt),
  };
}

async function listWaitingRealtimeBattles({ uid, deps = {} }) {
  const db = deps.db || getArenaFirestore();
  const now = deps.now || new Date();
  const snapshot = await db.collection("realtimeArenaBattles")
    .where("status", "==", "waiting")
    .orderBy("createdAt", "desc")
    .limit(WAITING_ROOM_LIMIT * 2)
    .get();

  return snapshot.docs
    .filter((doc) => {
      const battle = doc.data() || {};
      return !battle.guestUid && toMillis(battle.expiresAt) > now.getTime();
    })
    .sort((left, right) => toMillis(right.data()?.createdAt) - toMillis(left.data()?.createdAt))
    .slice(0, WAITING_ROOM_LIMIT)
    .map((doc) => serializeWaitingRoom(doc, uid));
}

module.exports = { WAITING_ROOM_LIMIT, listWaitingRealtimeBattles, serializeWaitingRoom };
