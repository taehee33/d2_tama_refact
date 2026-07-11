const test = require("node:test");
const assert = require("node:assert/strict");

const {
  NOTIFICATION_SECRET_HEADER,
  createDailyDigimonReportHandler,
  formatKstDate,
  normalizeDiscordWebhookUrl,
  resolveActiveDeathDiseaseCounters,
  resolveSlotIssues,
} = require("./notificationReports");

const HOUR_FOR_TEST = 60 * 60 * 1000;

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(payload) {
      if (payload !== undefined) {
        this.body = typeof payload === "string" ? JSON.parse(payload) : payload;
      }
    },
  };
}

function createRuntimeStats(overrides = {}) {
  return {
    isDead: false,
    birthTime: Date.parse("2026-07-01T00:00:00.000Z"),
    lifespanSeconds: 0,
    timeToEvolveSeconds: 999999,
    hungerTimer: 60,
    hungerCountdown: 60,
    fullness: 1,
    strengthTimer: 60,
    strengthCountdown: 60,
    strength: 1,
    poopTimer: 120,
    poopCountdown: 7200,
    poopCount: 0,
    maxEnergy: 20,
    sleepSchedule: { start: 0, end: 0, startMinute: 0, endMinute: 0 },
    callStatus: {
      hunger: { isActive: false, startedAt: null, isLogged: false },
      strength: { isActive: false, startedAt: null, isLogged: false },
      sleep: { isActive: false, startedAt: null, isLogged: false },
    },
    careMistakes: 0,
    careMistakeLedger: [],
    injuries: 0,
    isInjured: false,
    injuredAt: null,
    activityLogs: [],
    isFrozen: false,
    frozenAt: null,
    takeOutAt: null,
    lastHungerZeroAt: null,
    lastStrengthZeroAt: null,
    ...overrides,
  };
}

test("Discord webhook은 공식 HTTPS 호스트만 허용한다", () => {
  assert.equal(
    normalizeDiscordWebhookUrl("https://discord.com/api/webhooks/id/token"),
    "https://discord.com/api/webhooks/id/token"
  );
  assert.equal(normalizeDiscordWebhookUrl("http://discord.com/api/webhooks/id/token"), null);
  assert.equal(normalizeDiscordWebhookUrl("https://example.com/api/webhooks/id/token"), null);
});

test("KST 확인 시간은 Discord 긴급 알림과 같은 AM/PM 형식으로 표시한다", () => {
  assert.equal(formatKstDate("2026-07-01T12:52:43.000Z"), "2026. 7. 1. PM 9:52:43");
});

test("진행 중 사망·질병 카운터는 냉장고 누적 시간을 제외해 경과·남음·데드라인을 표시한다", () => {
  const nowMs = Date.parse("2026-07-11T00:00:00.000Z");
  const stats = createRuntimeStats({ fullness: 0, strength: 0, lastHungerZeroAt: nowMs - 3 * HOUR_FOR_TEST, lastStrengthZeroAt: nowMs - 4 * HOUR_FOR_TEST, hungerZeroFrozenDurationMs: HOUR_FOR_TEST });
  const counters = resolveActiveDeathDiseaseCounters({ digimonStats: stats }, nowMs);
  assert.equal(counters.length, 2);
  assert.match(counters[0], /경과 2시간 0분 0초 · 남음 10시간 0분 0초/);
  assert.match(counters[0], /데드라인 2026\. 7\. 11\. PM 7:00:00/);
  assert.match(counters[1], /경과 4시간 0분 0초 · 남음 8시간 0분 0초/);
});

test("똥·부상 방치·부상 누적 카운터를 복합 표시한다", () => {
  const nowMs = Date.parse("2026-07-11T00:00:00.000Z");
  const stats = createRuntimeStats({ poopCount: 8, poopReachedMaxAt: nowMs - 2 * HOUR_FOR_TEST, lastPoopPenaltyAt: nowMs - 2 * HOUR_FOR_TEST, isInjured: true, injuredAt: nowMs - HOUR_FOR_TEST, injuries: 3 });
  const counters = resolveActiveDeathDiseaseCounters({ digimonStats: stats }, nowMs);
  assert.equal(counters.length, 3);
  assert.match(counters[0], /다음 추가 부상.*남음 6시간/);
  assert.match(counters[1], /부상 방치.*남음 5시간/);
  assert.equal(counters[2], "🩹 부상 누적: 3/15회");
});

test("시작 시간이 없는 활성 카운터는 데드라인을 추정하지 않는다", () => {
  const counters = resolveActiveDeathDiseaseCounters({ digimonStats: createRuntimeStats({ fullness: 0, lastHungerZeroAt: null }) }, Date.parse("2026-07-11T00:00:00.000Z"));
  assert.deepEqual(counters, ["🍖 배고픔 0 지속: 시작 시간 확인 불가"]);
});

test("임계치를 넘긴 시간형 카운터는 위험 단계이며 사망 슬롯에는 카운터를 만들지 않는다", () => {
  const nowMs = Date.parse("2026-07-11T00:00:00.000Z");
  const danger = resolveActiveDeathDiseaseCounters({ digimonStats: createRuntimeStats({ fullness: 0, lastHungerZeroAt: nowMs - 13 * HOUR_FOR_TEST }) }, nowMs);
  assert.match(danger[0], /경과 13시간 0분 0초 · 위험 단계/);
  const dead = resolveActiveDeathDiseaseCounters({ digimonStats: createRuntimeStats({ isDead: true, fullness: 0, lastHungerZeroAt: nowMs - 13 * HOUR_FOR_TEST }) }, nowMs);
  assert.deepEqual(dead, []);
});

test("이미 케어미스로 처리된 배고픔·기력 호출은 일일보고 상태이상에서 제외한다", () => {
  const stats = createRuntimeStats({
    fullness: 3,
    strength: 2,
    callStatus: {
      hunger: { isActive: false, startedAt: null, isLogged: true },
      strength: { isActive: false, startedAt: null, isLogged: true },
      sleep: { isActive: false, startedAt: null, isLogged: false },
    },
  });

  assert.deepEqual(resolveSlotIssues({ digimonStats: stats }), []);
});

test("케어미스 처리 이력이 있어도 현재 0 상태와 사망 카운터는 유지한다", () => {
  const nowMs = Date.parse("2026-07-11T00:00:00.000Z");
  const stats = createRuntimeStats({
    fullness: 0,
    strength: 0,
    lastHungerZeroAt: nowMs - HOUR_FOR_TEST,
    lastStrengthZeroAt: nowMs - HOUR_FOR_TEST,
    callStatus: {
      hunger: { isActive: false, startedAt: null, isLogged: true },
      strength: { isActive: false, startedAt: null, isLogged: true },
      sleep: { isActive: false, startedAt: null, isLogged: false },
    },
  });

  assert.deepEqual(resolveSlotIssues({ digimonStats: stats }, nowMs), ["🍖 배고픔", "🔋 기력부족"]);
  assert.equal(resolveActiveDeathDiseaseCounters({ digimonStats: stats }, nowMs).length, 2);
});

test("활성 수면 호출은 계속 표시하고 사망 판정은 다른 상태보다 우선한다", () => {
  const sleepingStats = createRuntimeStats({
    callStatus: {
      hunger: { isActive: false, startedAt: null, isLogged: true },
      strength: { isActive: false, startedAt: null, isLogged: true },
      sleep: { isActive: true, startedAt: Date.parse("2026-07-10T23:30:00.000Z"), isLogged: false },
    },
  });
  assert.deepEqual(resolveSlotIssues({ digimonStats: sleepingStats, isLightsOn: true }), ["💡 수면호출"]);

  const deadStats = createRuntimeStats({ isDead: true, fullness: 0, strength: 0 });
  assert.deepEqual(resolveSlotIssues({ digimonStats: deadStats }), ["💀 사망 판정"]);
});

test("daily digimon report handler rejects unsupported methods", async () => {
  const handler = createDailyDigimonReportHandler({
    getSchedulerSecret: () => "top-secret",
    listDocuments: async () => [],
  });

  const res = createMockRes();
  await handler({ method: "GET", headers: {} }, res);

  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "POST");
});

test("daily digimon report handler rejects missing scheduler secret", async () => {
  const handler = createDailyDigimonReportHandler({
    getSchedulerSecret: () => "top-secret",
    listDocuments: async () => [],
  });

  const res = createMockRes();
  await handler({ method: "POST", headers: {} }, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, "스케줄러 인증에 실패했습니다.");
});

test("daily digimon report handler rejects mismatched scheduler secret", async () => {
  const handler = createDailyDigimonReportHandler({
    getSchedulerSecret: () => "top-secret",
    listDocuments: async () => [],
  });

  const res = createMockRes();
  await handler(
    {
      method: "POST",
      headers: {
        [NOTIFICATION_SECRET_HEADER]: "wrong-secret",
      },
    },
    res
  );

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, "스케줄러 인증에 실패했습니다.");
});

test("daily digimon report handler는 공용 활성 구독자 조회 결과만 처리한다", async () => {
  const handler = createDailyDigimonReportHandler({
    getSchedulerSecret: () => "top-secret",
    getCurrentTime: () => new Date("2026-04-08T05:00:00.000Z"),
    listNotificationSubscribers: async () => [
      {
        uid: "user-1",
        data: {
          isNotificationEnabled: true,
          discordWebhookUrl: "https://discord.com/api/webhooks/active-user-1/token",
        },
      },
      {
        uid: "user-2",
        data: {
          isNotificationEnabled: true,
          discordWebhookUrl: "https://discord.com/api/webhooks/active-user-2/token",
        },
      },
    ],
    listDocuments: async (path) => {
      if (path === "users/user-1/slots") {
        return [
          {
            id: "slot2",
            data: {
              selectedDigimon: "Agumon",
              digimonNickname: "보리",
              isLightsOn: false,
              digimonStats: {
                fullness: 3,
                strength: 2,
                callStatus: {
                  hunger: { isLogged: false },
                  strength: { isLogged: false },
                  sleep: { isActive: false },
                },
              },
            },
          },
          {
            id: "slot1",
            data: {
              digimonDisplayName: "별빛(파피몬)",
              selectedDigimon: "Patamon",
              isLightsOn: true,
              digimonStats: {
                fullness: 0,
                strength: 4,
                callStatus: {
                  hunger: { isLogged: false },
                  strength: { isLogged: false },
                  sleep: { isActive: false },
                },
              },
            },
          },
          {
            id: "slot3",
            data: {
              selectedDigimon: "Agumon",
              digimonDisplayName: "아구몬",
              digimonStats: {
                fullness: 0,
                strength: 0,
                isDead: true,
              },
            },
          },
          {
            id: "slot4",
            data: {
              digimonDisplayName: "냉장중",
              digimonStats: {
                fullness: 0,
                strength: 0,
                isFrozen: true,
              },
            },
          },
        ];
      }

      if (path === "users/user-2/slots") {
        return [];
      }

      throw new Error(`Unexpected listDocuments path: ${path}`);
    },
    getDocument: async (path) => {
      if (path === "users/user-1") return { data: { displayName: "루트표시명" } };
      if (path === "users/user-1/profile/main") {
        return {
          data: {
            tamerName: "프로필 테이머",
          },
        };
      }
      if (path === "users/user-2") return { data: { displayName: "루트 fallback" } };
      if (path === "users/user-2/profile/main") {
        return null;
      }

      return null;
    },
  });

  const res = createMockRes();
  await handler(
    {
      method: "POST",
      headers: {
        [NOTIFICATION_SECRET_HEADER]: "top-secret",
      },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.generatedAt, formatKstDate("2026-04-08T05:00:00.000Z"));
  assert.deepEqual(res.body.summary, {
    totalUsers: 2,
    activeNotificationUsers: 2,
    reportCount: 1,
    skippedUsers: 1,
    totalSlots: 4,
    skippedUsersByReason: {
      invalidUser: 0,
      notificationDisabled: 0,
      missingWebhook: 0,
      noSlots: 1,
    },
  });
  assert.equal(res.body.reports.length, 1);
  assert.deepEqual(res.body.reports[0], {
    uid: "user-1",
    tamerName: "프로필 테이머",
    webhookUrl: "https://discord.com/api/webhooks/active-user-1/token",
    messageContent:
      "━━━━━━━━━━━━━━━━━━\n" +
      "📊 **디지몬 상태 일일 보고**\n\n" +
      "👤 **테이머**: 프로필 테이머 (총 4마리)\n" +
      "⚠️ **상태이상 발생!** (2마리)\n" +
      "- **별빛(파피몬)** (slot1): 🍖 배고픔\n" +
      "  ⏳ **진행 중 카운터**\n" +
      "  - 🍖 배고픔 0 지속: 시작 시간 확인 불가\n" +
      "- **아구몬** (slot3): 💀 사망 판정\n\n" +
      "🍀 **정상 상태 디지몬 목록** (1마리)\n" +
      "- **보리(Agumon)** (slot2)\n\n" +
      "🧊 **냉장고 보관 중 목록** (1마리)\n" +
      "- **냉장중** (slot4)\n\n" +
      `⏰ **확인 시간**: ${formatKstDate("2026-04-08T05:00:00.000Z")}\n` +
      "━━━━━━━━━━━━━━━━━━",
    abnormalCount: 2,
    healthyCount: 1,
    frozenCount: 1,
    totalCount: 4,
  });
  assert.equal(res.body.reports[0].messageContent.includes("- **냉장중** (slot4): 🍖 배고픔"), false);
  assert.equal(res.body.reports[0].messageContent.includes("- **냉장중** (slot4): 🔋 기력부족"), false);
});

test("일일보고는 서버 투영 사망 슬롯을 다른 상태보다 우선해 사망 판정으로 표시한다", async () => {
  const currentTime = new Date("2026-07-03T00:27:14.000Z");
  const handler = createDailyDigimonReportHandler({
    getSchedulerSecret: () => "top-secret",
    getCurrentTime: () => currentTime,
    listNotificationSubscribers: async () => [
      {
        uid: "user-1",
        data: {
          isNotificationEnabled: true,
          discordWebhookUrl: "https://discord.com/api/webhooks/active-user/token",
        },
      },
    ],
    listDocuments: async (path) => {
      if (path === "users/user-1/slots") {
        return [
          {
            id: "slot1",
            data: {
              selectedDigimon: "Agumon",
              digimonDisplayName: "아구몬",
              lastSavedAt: currentTime.getTime() - 13 * 60 * 60 * 1000,
              digimonStats: createRuntimeStats({
                callStatus: {
                  hunger: { isActive: true, startedAt: currentTime.getTime() - 13 * 60 * 60 * 1000, isLogged: true },
                  strength: { isActive: true, startedAt: currentTime.getTime() - 13 * 60 * 60 * 1000, isLogged: true },
                  sleep: { isActive: false, startedAt: null, isLogged: false },
                },
              }),
            },
          },
        ];
      }
      throw new Error(`Unexpected listDocuments path: ${path}`);
    },
    getDocument: async (path) => {
      if (path === "users/user-1/profile/main") {
        return { data: { tamerName: "히히히" } };
      }
      if (path === "users/user-1") {
        return { data: {} };
      }
      return null;
    },
  });

  const res = createMockRes();
  await handler(
    {
      method: "POST",
      headers: {
        [NOTIFICATION_SECRET_HEADER]: "top-secret",
      },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.reports[0].messageContent.includes("- **아구몬** (slot1): 💀 사망 판정"), true);
  assert.equal(res.body.reports[0].messageContent.includes("🍖 배고픔"), false);
  assert.equal(res.body.reports[0].messageContent.includes("🔋 기력부족"), false);
});
