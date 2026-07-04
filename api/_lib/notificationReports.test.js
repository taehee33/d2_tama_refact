const test = require("node:test");
const assert = require("node:assert/strict");

const {
  NOTIFICATION_SECRET_HEADER,
  createDailyDigimonReportHandler,
  formatKstDate,
  normalizeDiscordWebhookUrl,
} = require("./notificationReports");

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
              isFrozen: true,
              digimonStats: {
                fullness: 0,
                strength: 0,
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
      "👤 **테이머**: 프로필 테이머 (총 3마리)\n" +
      "⚠️ **상태이상 발생!** (2마리)\n" +
      "- **별빛(파피몬)** (slot1): 🍖 배고픔\n" +
      "- **아구몬** (slot3): 💀 사망 판정\n\n" +
      "🍀 **정상 상태 디지몬 목록** (1마리)\n" +
      "- **보리(Agumon)** (slot2)\n\n" +
      `⏰ **확인 시간**: ${formatKstDate("2026-04-08T05:00:00.000Z")}\n` +
      "━━━━━━━━━━━━━━━━━━",
    abnormalCount: 2,
    healthyCount: 1,
    totalCount: 3,
  });
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
