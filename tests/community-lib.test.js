"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildCommunitySnapshot,
  normalizeSlotId,
  translateStageLabel,
  validateCommentInput,
  validatePostInput,
} = require("../api/_lib/community");

test("normalizeSlotId는 slot 접두사와 숫자 문자열을 모두 허용한다", () => {
  assert.equal(normalizeSlotId("slot7"), 7);
  assert.equal(normalizeSlotId("3"), 3);
  assert.equal(normalizeSlotId(2), 2);
});

test("buildCommunitySnapshot은 슬롯 문서에서 커뮤니티 스냅샷을 만든다", () => {
  const snapshot = buildCommunitySnapshot(
    {
      slotName: "슬롯1",
      selectedDigimon: "Koromon",
      digimonDisplayName: "코로몬",
      version: "Ver.1",
      device: "Digital Monster Color 25th",
      digimonStats: {
        evolutionStage: "Child",
        weight: 14,
        careMistakes: 2,
        totalBattles: 7,
        totalBattlesWon: 5,
      },
    },
    1
  );

  assert.deepEqual(snapshot, {
    slotId: "1",
    slotName: "슬롯1",
    selectedDigimon: "Koromon",
    digimonDisplayName: "코로몬",
    stageLabel: "성장기",
    version: "Ver.1",
    device: "Digital Monster Color 25th",
    weight: 14,
    careMistakes: 2,
    totalBattles: 7,
    totalBattlesWon: 5,
    winRate: 71,
  });
});

test("검증 헬퍼는 글/댓글 길이와 필수값을 확인한다", () => {
  assert.deepEqual(
    validatePostInput({
      slotId: "slot2",
      title: " 내 디지몬 근황 ",
      body: " 오늘 첫 완전체가 됐어요. ",
    }),
    {
      slotId: 2,
      title: "내 디지몬 근황",
      body: "오늘 첫 완전체가 됐어요.",
    }
  );

  assert.deepEqual(validateCommentInput({ body: " 축하합니다! " }), {
    body: "축하합니다!",
  });

  assert.equal(translateStageLabel("Baby1"), "유년기 I");
});
