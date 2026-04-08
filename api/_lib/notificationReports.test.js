const test = require("node:test");
const assert = require("node:assert/strict");

const {
  NOTIFICATION_SECRET_HEADER,
  createDailyDigimonReportHandler,
  formatKstDate,
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

test("daily digimon report handler builds reports with settings/main priority and root fallback", async () => {
  const handler = createDailyDigimonReportHandler({
    getSchedulerSecret: () => "top-secret",
    getCurrentTime: () => new Date("2026-04-08T05:00:00.000Z"),
    listDocuments: async (path) => {
      if (path === "users") {
        return [
          {
            id: "user-1",
            data: {
              displayName: "루트표시명",
              tamerName: "루트 테이머",
              isNotificationEnabled: false,
              discordWebhookUrl: "https://discord.com/api/webhooks/root-disabled",
            },
          },
          {
            id: "user-2",
            data: {
              displayName: "루트 fallback",
              tamerName: "루트 fallback 테이머",
              isNotificationEnabled: true,
              discordWebhookUrl: "https://discord.com/api/webhooks/root-fallback",
            },
          },
          {
            id: "user-3",
            data: {
              displayName: "비활성 유저",
              isNotificationEnabled: false,
              discordWebhookUrl: "https://discord.com/api/webhooks/disabled",
            },
          },
          {
            id: "user-4",
            data: {
              displayName: "웹훅 없음",
              isNotificationEnabled: true,
            },
          },
        ];
      }

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
      if (path === "users/user-1/settings/main") {
        return {
          data: {
            isNotificationEnabled: true,
            discordWebhookUrl: "https://discord.com/api/webhooks/active-user-1",
          },
        };
      }
      if (path === "users/user-1/profile/main") {
        return {
          data: {
            tamerName: "프로필 테이머",
          },
        };
      }
      if (path === "users/user-2/settings/main") {
        return null;
      }
      if (path === "users/user-2/profile/main") {
        return null;
      }
      if (path === "users/user-3/settings/main") {
        return {
          data: {
            isNotificationEnabled: false,
            discordWebhookUrl: "https://discord.com/api/webhooks/user-3",
          },
        };
      }
      if (path === "users/user-4/settings/main") {
        return {
          data: {
            isNotificationEnabled: true,
            discordWebhookUrl: null,
          },
        };
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
    totalUsers: 4,
    activeNotificationUsers: 2,
    reportCount: 1,
    skippedUsers: 3,
    totalSlots: 3,
    skippedUsersByReason: {
      invalidUser: 0,
      notificationDisabled: 1,
      missingWebhook: 1,
      noSlots: 1,
    },
  });
  assert.equal(res.body.reports.length, 1);
  assert.deepEqual(res.body.reports[0], {
    uid: "user-1",
    tamerName: "프로필 테이머",
    webhookUrl: "https://discord.com/api/webhooks/active-user-1",
    messageContent:
      "━━━━━━━━━━━━━━━━━━\n" +
      "📊 **디지몬 상태 일일 보고**\n\n" +
      "👤 **테이머**: 프로필 테이머\n" +
      "⚠️ **상태이상 발생!**\n" +
      "- **별빛(파피몬)** (slot1): 🍖 배고픔\n\n" +
      "🍀 **정상 상태 디지몬 목록**\n" +
      "- **보리(Agumon)** (slot2)\n\n" +
      `⏰ **확인 시간**: ${formatKstDate("2026-04-08T05:00:00.000Z")}\n` +
      "━━━━━━━━━━━━━━━━━━",
    abnormalCount: 1,
    healthyCount: 1,
  });
});
