"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateNotificationProgress,
  formatNotificationProgressBar,
} = require("./notificationProgressBar");

test("알림 진행 바는 20칸과 정수 퍼센트로 표시한다", () => {
  assert.equal(
    formatNotificationProgressBar(5 * 60_000, 10 * 60_000),
    "`██████████░░░░░░░░░░` 50%"
  );
});

test("알림 진행률 계산 결과는 바와 퍼센트를 개별 제공한다", () => {
  assert.deepEqual(calculateNotificationProgress(2.3, 10), {
    bar: "█████░░░░░░░░░░░░░░░",
    percentage: 23,
  });
});

test("알림 진행 바는 시작 전과 임계치 초과를 0~100% 범위로 제한한다", () => {
  assert.equal(formatNotificationProgressBar(-1, 100), "`░░░░░░░░░░░░░░░░░░░░` 0%");
  assert.equal(formatNotificationProgressBar(101, 100), "`████████████████████` 100%");
});

test("유효하지 않은 임계치에는 진행 바를 만들지 않는다", () => {
  assert.equal(formatNotificationProgressBar(0, 0), null);
  assert.equal(formatNotificationProgressBar(0, Number.NaN), null);
});
