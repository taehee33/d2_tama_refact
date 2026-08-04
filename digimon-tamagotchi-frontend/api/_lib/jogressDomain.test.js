"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertExpectedRevision,
  classifyRoomLink,
  getSlotSourceIdentity,
  isRoomSourceCurrent,
  resolveOnlineJogressPair,
} = require("./jogressDomain");

test("Ver.3~5 공통 resolver는 세 조합과 역방향을 모두 해석한다", () => {
  const cases = [
    ["Ver.3", "Chimairamon", "Ver.5", "Mugendramon", "Millenniumon"],
    ["Ver.3", "BanchoLeomon", "Ver.4", "Darkdramon", "Chaosmon"],
    ["Ver.4", "Darkdramon", "Ver.5", "Mugendramon", "Chaosdramon"],
  ];
  for (const [hostVersion, hostDigimonId, guestVersion, guestDigimonId, targetId] of cases) {
    const forward = resolveOnlineJogressPair({ hostVersion, hostDigimonId, guestVersion, guestDigimonId });
    const reverse = resolveOnlineJogressPair({ hostVersion: guestVersion, hostDigimonId: guestDigimonId, guestVersion: hostVersion, guestDigimonId: hostDigimonId });
    assert.equal(forward.success, true, forward.reason);
    assert.equal(reverse.success, true, reverse.reason);
    assert.equal(forward.hostTargetId, targetId);
    assert.equal(forward.guestTargetId, targetId);
  }
});

test("형태 identity는 같은 슬롯명이 아니라 instance + combatRevision으로 달라진다", () => {
  const uid = "user-a";
  const first = { selectedDigimon: "BlitzGreymon", version: "Ver.1", digimonInstanceId: "instance-1", combatRevision: 5 };
  const evolved = { ...first, selectedDigimon: "Darkdramon", combatRevision: 6 };
  const otherSlotSameDigimon = { ...first, digimonInstanceId: "instance-2" };
  const firstIdentity = getSlotSourceIdentity(uid, first);
  assert.notEqual(firstIdentity.sourceIdentityId, getSlotSourceIdentity(uid, evolved).sourceIdentityId);
  assert.notEqual(firstIdentity.sourceIdentityId, getSlotSourceIdentity(uid, otherSlotSameDigimon).sourceIdentityId);
  assert.equal(isRoomSourceCurrent({ hostUid: uid, hostSourceIdentityId: firstIdentity.sourceIdentityId }, uid, first), true);
  assert.equal(isRoomSourceCurrent({ hostUid: uid, hostSourceIdentityId: firstIdentity.sourceIdentityId }, uid, evolved), false);
});

test("revision 충돌은 최신 revision을 구조화해 반환한다", () => {
  assert.throws(
    () => assertExpectedRevision({ revision: 9 }, 8),
    (error) => error.code === "JOGRESS_STATE_CONFLICT" && error.details.actualRevision === 9
  );
});

test("Identity 없는 legacy 방은 현재 슬롯이 같아 보여도 Ghost다", () => {
  const slot = { selectedDigimon: "BlitzGreymon", version: "Ver.1", digimonInstanceId: "life", combatRevision: 4 };
  assert.equal(classifyRoomLink({ hostUid: "host", hostDigimonId: "BlitzGreymon", hostSlotVersion: "Ver.1" }, slot), "ghost");
});
