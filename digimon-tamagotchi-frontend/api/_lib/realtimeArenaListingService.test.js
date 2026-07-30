"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { listWaitingRealtimeBattles } = require("./realtimeArenaListingService");

function document(id, data) {
  return { id, data: () => data };
}

test("대기방 목록은 만료·참가 완료 방과 UID를 제외하고 최신순으로 반환한다", async () => {
  const docs = [
    document("old", { hostUid: "host-1", guestUid: null, status: "waiting", createdAt: new Date("2026-07-30T00:00:00Z"), expiresAt: new Date("2026-07-30T00:20:00Z"), listing: { hostDigimonName: "아구몬", stage: "Child" } }),
    document("new", { hostUid: "viewer", guestUid: null, status: "waiting", createdAt: new Date("2026-07-30T00:05:00Z"), expiresAt: new Date("2026-07-30T00:20:00Z"), listing: { hostDigimonName: "레오몬", stage: "Adult" } }),
    document("full", { hostUid: "host-2", guestUid: "guest", status: "waiting", createdAt: new Date("2026-07-30T00:06:00Z"), expiresAt: new Date("2026-07-30T00:20:00Z") }),
    document("expired", { hostUid: "host-3", guestUid: null, status: "waiting", createdAt: new Date("2026-07-30T00:07:00Z"), expiresAt: new Date("2026-07-29T23:59:00Z") }),
  ];
  const query = { where: () => query, orderBy: () => query, limit: () => query, get: async () => ({ docs }) };
  const db = { collection: () => query };

  const rooms = await listWaitingRealtimeBattles({ uid: "viewer", deps: { db, now: new Date("2026-07-30T00:10:00Z") } });

  assert.deepEqual(rooms.map((room) => room.battleId), ["new", "old"]);
  assert.equal(rooms[0].isOwn, true);
  assert.equal(rooms[0].digimonName, "레오몬");
  assert.equal(JSON.stringify(rooms).includes("hostUid"), false);
});
