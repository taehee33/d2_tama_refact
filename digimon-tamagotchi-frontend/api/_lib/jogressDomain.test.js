"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertExpectedRevision,
  buildLocalJogressPartnerOutcome,
  classifyRoomLink,
  createLocalJogressReceiptId,
  createLocalJogressRequestFingerprint,
  getSlotSourceIdentity,
  isRoomSourceCurrent,
  resolveLocalJogressPair,
  resolveOnlineJogressPair,
} = require("./jogressDomain");
const {
  getDigimonDataMapByVersion,
} = require("../_generated/gameProjection.cjs");

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

test("로컬 조그레스 receipt와 fingerprint는 결정적이고 payload 변경을 구분한다", () => {
  const input = {
    uid: "user-a",
    requestId: "request-1",
    currentSlotId: 1,
    partnerSlotId: 2,
    expectedCurrentRevision: 4,
    expectedPartnerRevision: 7,
  };
  assert.equal(
    createLocalJogressReceiptId(input),
    createLocalJogressReceiptId(input)
  );
  assert.equal(
    createLocalJogressRequestFingerprint(input),
    createLocalJogressRequestFingerprint({
      ...input,
      currentSlotId: "slot1",
      partnerSlotId: "slot2",
    })
  );
  assert.notEqual(
    createLocalJogressRequestFingerprint(input),
    createLocalJogressRequestFingerprint({
      ...input,
      expectedPartnerRevision: 8,
    })
  );
});

test("로컬 조그레스는 현재 슬롯 결과를 계산하고 파트너 생명을 사망 처리한다", () => {
  const currentMap = getDigimonDataMapByVersion("Ver.3");
  const partnerMap = getDigimonDataMapByVersion("Ver.4");
  const current = {
    slot: { selectedDigimon: "BanchoLeomon" },
    dataMap: currentMap,
  };
  const partner = {
    slot: { selectedDigimon: "Darkdramon" },
    dataMap: partnerMap,
  };
  assert.equal(resolveLocalJogressPair({ current, partner }).targetId, "Chaosmon");

  const outcome = buildLocalJogressPartnerOutcome({
    slot: {
      selectedDigimon: "Darkdramon",
      revision: 7,
      combatRevision: 3,
      lastSavedAt: 1000,
      digimonStats: { isDead: false, age: 4 },
    },
    version: "Ver.4",
    rawMap: partnerMap,
    nowMs: 2000,
  });
  assert.equal(outcome.selectedDigimon, "Darkdramon");
  assert.equal(outcome.digimonStats.isDead, true);
  assert.equal(outcome.digimonStats.deathReason, "JOGRESS_PARTNER (조그레스 파트너)");
  assert.equal(outcome.revision, 8);
  assert.equal(outcome.combatRevision, 4);
});
