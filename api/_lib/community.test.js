const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildCommunitySnapshot,
  resolveStageLabel,
  validateCommentPayload,
  validatePostPayload,
} = require("./community");

test("buildCommunitySnapshot generates normalized post snapshot", () => {
  const snapshot = buildCommunitySnapshot(
    {
      slotName: "슬롯1",
      selectedDigimon: "Koromon",
      digimonDisplayName: "깜몬",
      version: "Ver.1",
      device: "Digital Monster Color 25th",
      digimonStats: {
        evolutionStage: "Child",
        weight: 12,
        careMistakes: 3,
        totalBattles: 9,
        totalBattlesWon: 6,
      },
    },
    1
  );

  assert.deepEqual(snapshot, {
    slotId: "1",
    slotName: "슬롯1",
    selectedDigimon: "Koromon",
    digimonDisplayName: "깜몬",
    stageLabel: "성장기",
    version: "Ver.1",
    device: "Digital Monster Color 25th",
    weight: 12,
    careMistakes: 3,
    totalBattles: 9,
    totalBattlesWon: 6,
    winRate: 67,
  });
});

test("resolveStageLabel supports legacy stage aliases", () => {
  assert.equal(resolveStageLabel("Baby1"), "유년기 I");
  assert.equal(resolveStageLabel("Baby II"), "유년기 II");
});

test("validatePostPayload requires title and slot", () => {
  const validation = validatePostPayload({ title: " ", slotId: "", body: "" });

  assert.equal(validation.isValid, false);
  assert.deepEqual(validation.errors, ["슬롯을 선택해 주세요.", "제목을 입력해 주세요."]);
});

test("validateCommentPayload requires non-empty body", () => {
  const validation = validateCommentPayload({ body: " " });

  assert.equal(validation.isValid, false);
  assert.deepEqual(validation.errors, ["댓글 내용을 입력해 주세요."]);
});
