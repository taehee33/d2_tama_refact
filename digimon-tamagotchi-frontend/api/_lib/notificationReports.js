"use strict";

const { getDocument, listDocuments } = require("./firestoreAdmin");
const { allowMethods, handleApiError, sendJson } = require("./http");
const {
  listNotificationSubscribers,
  normalizeDiscordWebhookUrl,
} = require("./notificationSubscribers");
const { formatKstDate } = require("./kstDateFormat");
const { projectSlotForUrgentCare } = require("./urgentCareProjection");

const NOTIFICATION_SECRET_HEADER = "x-d2-scheduler-secret";
const REPORT_BORDER = "━━━━━━━━━━━━━━━━━━";
const DEFAULT_NOTIFICATION_CHANNELS = {
  inApp: true,
  discord: true,
  webPush: true,
};
const HOUR_MS = 60 * 60 * 1000;
const DEATH_COUNTER_THRESHOLDS = {
  hunger: 12 * HOUR_MS,
  strength: 12 * HOUR_MS,
  poop: 8 * HOUR_MS,
  injury: 6 * HOUR_MS,
};

function createNotificationError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function hasOwnField(data, fieldName) {
  return !!data && Object.prototype.hasOwnProperty.call(data, fieldName);
}

function normalizeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTimestamp(value) {
  if (value == null) return null;
  const timestamp = value instanceof Date ? value.getTime() : Number(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatDuration(durationMs) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}시간 ${minutes}분 ${seconds}초`;
}

function getEffectiveElapsedMs(startedAt, nowMs, excludedMs = 0) {
  const startMs = normalizeTimestamp(startedAt);
  if (startMs == null) return null;
  return Math.max(0, nowMs - startMs - Math.max(0, normalizeNumber(excludedMs, 0)));
}

function buildTimedCounter({ label, startedAt, thresholdMs, excludedMs, nowMs, repeat = false }) {
  const elapsedTotalMs = getEffectiveElapsedMs(startedAt, nowMs, excludedMs);
  if (elapsedTotalMs == null) return `${label}: 시작 시간 확인 불가`;

  const elapsedMs = repeat ? elapsedTotalMs % thresholdMs : elapsedTotalMs;
  const remainingMs = Math.max(0, thresholdMs - elapsedMs);
  const isDanger = !repeat && elapsedTotalMs >= thresholdMs;
  const deadlineMs = nowMs + remainingMs;
  const status = isDanger ? "위험 단계" : `남음 ${formatDuration(remainingMs)}`;
  return `${label}: 경과 ${formatDuration(elapsedMs)} · ${status} · 데드라인 ${formatKstDate(deadlineMs)}`;
}

function resolveActiveDeathDiseaseCounters(slotData = {}, nowMs = Date.now(), projectedStats = null) {
  const storedStats = slotData?.digimonStats && typeof slotData.digimonStats === "object" ? slotData.digimonStats : {};
  const stats = projectedStats && typeof projectedStats === "object" ? projectedStats : storedStats;
  if (stats.isDead === true || slotData.isDead === true) return [];

  const counters = [];
  if (normalizeNumber(stats.fullness, 1) === 0) {
    counters.push(buildTimedCounter({ label: "🍖 배고픔 0 지속", startedAt: stats.lastHungerZeroAt ?? stats.callStatus?.hunger?.startedAt, thresholdMs: DEATH_COUNTER_THRESHOLDS.hunger, excludedMs: stats.hungerZeroFrozenDurationMs, nowMs }));
  }
  if (normalizeNumber(stats.strength, 1) === 0) {
    counters.push(buildTimedCounter({ label: "💪 힘 0 지속", startedAt: stats.lastStrengthZeroAt ?? stats.callStatus?.strength?.startedAt, thresholdMs: DEATH_COUNTER_THRESHOLDS.strength, excludedMs: stats.strengthZeroFrozenDurationMs, nowMs }));
  }
  if (normalizeNumber(stats.poopCount, 0) >= 8) {
    counters.push(buildTimedCounter({ label: "💩 똥 8개(다음 추가 부상)", startedAt: stats.lastPoopPenaltyAt ?? stats.poopReachedMaxAt, thresholdMs: DEATH_COUNTER_THRESHOLDS.poop, excludedMs: stats.poopPenaltyFrozenDurationMs, nowMs, repeat: true }));
  }
  if (stats.isInjured === true) {
    counters.push(buildTimedCounter({ label: "🏥 부상 방치", startedAt: stats.injuredAt, thresholdMs: DEATH_COUNTER_THRESHOLDS.injury, excludedMs: stats.injuryFrozenDurationMs, nowMs }));
  }
  const injuries = Math.max(0, Math.floor(normalizeNumber(stats.injuries, 0)));
  if (injuries > 0) counters.push(`🩹 부상 누적: ${injuries}/15회`);
  return counters;
}

function getHeaderValue(headers = {}, headerName) {
  if (!headers || typeof headers !== "object") {
    return "";
  }

  const normalizedName = String(headerName).toLowerCase();
  const matchedEntry = Object.entries(headers).find(([key]) => String(key).toLowerCase() === normalizedName);
  if (!matchedEntry) {
    return "";
  }

  const rawValue = Array.isArray(matchedEntry[1]) ? matchedEntry[1][0] : matchedEntry[1];
  return typeof rawValue === "string" ? rawValue.trim() : "";
}

function resolveNotificationSettings(settingsData, rootData) {
  const discordWebhookUrl = normalizeDiscordWebhookUrl(
    hasOwnField(settingsData, "discordWebhookUrl")
      ? settingsData.discordWebhookUrl
      : rootData?.discordWebhookUrl
  );
  const isNotificationEnabled = hasOwnField(settingsData, "isNotificationEnabled")
    ? settingsData.isNotificationEnabled === true
    : rootData?.isNotificationEnabled === true;
  const channelSource = hasOwnField(settingsData, "notificationChannels")
    ? settingsData.notificationChannels
    : rootData?.notificationChannels;
  const notificationChannels =
    channelSource && typeof channelSource === "object"
      ? {
          inApp: channelSource.inApp !== false,
          discord: channelSource.discord !== false,
          webPush: channelSource.webPush !== false,
        }
      : { ...DEFAULT_NOTIFICATION_CHANNELS };

  return {
    discordWebhookUrl,
    isNotificationEnabled,
    notificationChannels,
  };
}

function resolveTamerName(profileData, rootData) {
  return (
    normalizeString(profileData?.tamerName) ||
    normalizeString(rootData?.tamerName) ||
    normalizeString(rootData?.displayName) ||
    "테이머"
  );
}

function normalizeCallEntry(entry) {
  return entry && typeof entry === "object" ? entry : {};
}

function resolveDigimonDisplayName(slotData = {}) {
  const storedDisplayName = normalizeString(slotData.digimonDisplayName);
  if (storedDisplayName) {
    return storedDisplayName;
  }

  const nickname = normalizeString(slotData.digimonNickname);
  const selectedDigimon = normalizeString(slotData.selectedDigimon);
  if (nickname) {
    return `${nickname}(${selectedDigimon || "디지몬"})`;
  }

  return selectedDigimon || "디지몬";
}

function isStoredInCareStorage(slotData = {}) {
  const stats = slotData?.digimonStats && typeof slotData.digimonStats === "object" ? slotData.digimonStats : {};

  return (
    slotData?.isFrozen === true ||
    slotData?.isRefrigerated === true ||
    stats?.isFrozen === true ||
    stats?.isRefrigerated === true
  );
}

function resolveSlotIssues(slotData = {}, nowMs = Date.now()) {
  const storedStats = slotData?.digimonStats && typeof slotData.digimonStats === "object" ? slotData.digimonStats : {};
  const projection = projectSlotForUrgentCare(slotData, nowMs);
  const stats = projection.status === "projected" ? projection.stats : storedStats;
  const callStatus = stats?.callStatus && typeof stats.callStatus === "object" ? stats.callStatus : {};
  const hungerCall = normalizeCallEntry(callStatus.hunger);
  const strengthCall = normalizeCallEntry(callStatus.strength);
  const sleepCall = normalizeCallEntry(callStatus.sleep);
  const fullness = normalizeNumber(stats.fullness, 1);
  const strength = normalizeNumber(stats.strength, 1);
  const issues = [];

  if (stats.isDead === true || slotData?.isDead === true) {
    return ["💀 사망 판정"];
  }
  if (projection.status === "projected" && projection.stats?.isDead === true) {
    return ["💀 사망 판정"];
  }
  if (fullness === 0) {
    issues.push("🍖 배고픔");
  }
  if (strength === 0) {
    issues.push("🔋 기력부족");
  }
  if (sleepCall.isActive === true && slotData?.isLightsOn !== false) {
    issues.push("💡 수면호출");
  }
  if (hungerCall.isLogged === true) {
    issues.push("❗ 배고픔방치");
  }
  if (strengthCall.isLogged === true) {
    issues.push("❗ 기력방치");
  }
  if (stats.isJogressReady === true) {
    issues.push("💎 조그레스대기");
  }

  return issues;
}

function sortSlotDocuments(slotDocuments = []) {
  return [...slotDocuments].sort((left, right) => {
    const leftId = normalizeString(left?.id || left?.name?.split("/").pop());
    const rightId = normalizeString(right?.id || right?.name?.split("/").pop());
    const leftNumber = Number.parseInt(leftId.replace(/^slot/i, ""), 10);
    const rightNumber = Number.parseInt(rightId.replace(/^slot/i, ""), 10);

    if (Number.isInteger(leftNumber) && Number.isInteger(rightNumber) && leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }

    return leftId.localeCompare(rightId, "ko");
  });
}

function buildUserDailyReport({ uid, tamerName, webhookUrl, slotDocuments = [], generatedAt, currentTimeMs }) {
  const abnormalList = [];
  const healthyList = [];
  const frozenList = [];

  sortSlotDocuments(slotDocuments).forEach((slotDocument) => {
    const slotId = normalizeString(slotDocument?.id || slotDocument?.name?.split("/").pop(), "slot?");
    const slotData = slotDocument?.data && typeof slotDocument.data === "object" ? slotDocument.data : {};
    const digimonName = resolveDigimonDisplayName(slotData);

    if (isStoredInCareStorage(slotData)) {
      frozenList.push(`- **${digimonName}** (${slotId})`);
      return;
    }

    const projection = projectSlotForUrgentCare(slotData, currentTimeMs);
    const projectedStats = projection.status === "projected" ? projection.stats : null;
    const issues = resolveSlotIssues(slotData, currentTimeMs);
    const counters = resolveActiveDeathDiseaseCounters(slotData, currentTimeMs, projectedStats);
    const counterLines = counters.length > 0
      ? `\n  ⏳ **진행 중 카운터**\n${counters.map((counter) => `  - ${counter}`).join("\n")}`
      : "";

    if (issues.length > 0) {
      abnormalList.push(`- **${digimonName}** (${slotId}): ${issues.join(", ")}${counterLines}`);
      return;
    }

    healthyList.push(`- **${digimonName}** (${slotId})${counterLines}`);
  });

  const totalCount = abnormalList.length + healthyList.length + frozenList.length;
  let messageContent = `${REPORT_BORDER}\n📊 **디지몬 상태 일일 보고**\n\n👤 **테이머**: ${tamerName} (총 ${totalCount}마리)\n`;

  if (abnormalList.length > 0) {
    messageContent += `⚠️ **상태이상 발생!** (${abnormalList.length}마리)\n${abnormalList.join("\n")}\n`;
  } else {
    messageContent += "✅ **상태이상 디지몬이 없습니다!** (0마리)\n현재 모든 디지몬이 아주 건강합니다. ✨\n";
  }

  if (healthyList.length > 0) {
    messageContent += `\n🍀 **정상 상태 디지몬 목록** (${healthyList.length}마리)\n${healthyList.join("\n")}\n`;
  }

  if (frozenList.length > 0) {
    messageContent += `\n🧊 **냉장고 보관 중 목록** (${frozenList.length}마리)\n${frozenList.join("\n")}\n`;
  }

  messageContent += `\n⏰ **확인 시간**: ${generatedAt}\n${REPORT_BORDER}`;

  return {
    uid,
    tamerName,
    webhookUrl,
    messageContent,
    abnormalCount: abnormalList.length,
    healthyCount: healthyList.length,
    frozenCount: frozenList.length,
    totalCount,
  };
}

async function buildDailyDigimonReportPayload({
  subscribers = [],
  getDocumentByPath,
  listCollectionDocuments,
  currentTime = new Date(),
}) {
  if (typeof getDocumentByPath !== "function" || typeof listCollectionDocuments !== "function") {
    throw new TypeError("알림 리포트 생성에 필요한 Firestore 헬퍼가 없습니다.");
  }

  const subscriberDocuments = Array.isArray(subscribers) ? subscribers : [];
  const generatedAt = formatKstDate(currentTime);
  const currentTimeMs = currentTime instanceof Date ? currentTime.getTime() : Number(currentTime);
  const skippedUsersByReason = {
    invalidUser: 0,
    notificationDisabled: 0,
    missingWebhook: 0,
    noSlots: 0,
  };

  const userResults = await Promise.all(
    subscriberDocuments.map(async (subscriber) => {
      const uid = normalizeString(subscriber?.uid || subscriber?.id);

      if (!uid) {
        return {
          activeNotificationUser: false,
          slotCount: 0,
          skipReason: "invalidUser",
        };
      }

      const settings = resolveNotificationSettings(subscriber?.data, {});

      if (settings.isNotificationEnabled !== true) {
        return {
          activeNotificationUser: false,
          slotCount: 0,
          skipReason: "notificationDisabled",
        };
      }

      if (!settings.discordWebhookUrl) {
        return {
          activeNotificationUser: false,
          slotCount: 0,
          skipReason: "missingWebhook",
        };
      }

      const [rootDocument, profileDocument, slotDocuments] = await Promise.all([
        getDocumentByPath(`users/${uid}`),
        getDocumentByPath(`users/${uid}/profile/main`),
        listCollectionDocuments(`users/${uid}/slots`),
      ]);
      const rootData = rootDocument?.data && typeof rootDocument.data === "object"
        ? rootDocument.data
        : {};
      const safeSlotDocuments = Array.isArray(slotDocuments) ? slotDocuments : [];

      if (safeSlotDocuments.length === 0) {
        return {
          activeNotificationUser: true,
          slotCount: 0,
          skipReason: "noSlots",
        };
      }

      return {
        activeNotificationUser: true,
        slotCount: safeSlotDocuments.length,
        report: buildUserDailyReport({
          uid,
          tamerName: resolveTamerName(profileDocument?.data, rootData),
          webhookUrl: settings.discordWebhookUrl,
          slotDocuments: safeSlotDocuments,
          generatedAt,
          currentTimeMs,
        }),
      };
    })
  );

  let activeNotificationUsers = 0;
  let totalSlots = 0;
  const reports = [];

  userResults.forEach((result) => {
    if (result?.activeNotificationUser) {
      activeNotificationUsers += 1;
      totalSlots += normalizeNumber(result.slotCount, 0);
    }

    if (result?.report) {
      reports.push(result.report);
      return;
    }

    const reasonKey = normalizeString(result?.skipReason);
    if (reasonKey && hasOwnField(skippedUsersByReason, reasonKey)) {
      skippedUsersByReason[reasonKey] += 1;
    }
  });

  return {
    ok: true,
    generatedAt,
    summary: {
      totalUsers: subscriberDocuments.length,
      activeNotificationUsers,
      reportCount: reports.length,
      skippedUsers: subscriberDocuments.length - reports.length,
      totalSlots,
      skippedUsersByReason,
    },
    reports,
  };
}

function verifySchedulerSecret(req, schedulerSecret) {
  const resolvedSecret = normalizeString(schedulerSecret);
  if (!resolvedSecret) {
    throw createNotificationError(500, "NOTIFICATION_API_SECRET 환경변수가 설정되지 않았습니다.");
  }

  const providedSecret = getHeaderValue(req?.headers, NOTIFICATION_SECRET_HEADER);
  if (!providedSecret || providedSecret !== resolvedSecret) {
    throw createNotificationError(401, "스케줄러 인증에 실패했습니다.");
  }
}

function createDailyDigimonReportHandler(deps = {}) {
  const listCollectionDocuments = deps.listDocuments || listDocuments;
  const listSubscribers = deps.listNotificationSubscribers || listNotificationSubscribers;
  const getDocumentByPath = deps.getDocument || getDocument;
  const getCurrentTime = deps.getCurrentTime || (() => new Date());
  const getSchedulerSecret = deps.getSchedulerSecret || (() => process.env.NOTIFICATION_API_SECRET || "");

  return async function dailyDigimonReportHandler(req, res) {
    if (!allowMethods(req, res, ["POST"])) {
      return;
    }

    try {
      verifySchedulerSecret(req, getSchedulerSecret());

      const subscribers = await listSubscribers();
      const payload = await buildDailyDigimonReportPayload({
        subscribers,
        getDocumentByPath,
        listCollectionDocuments,
        currentTime: getCurrentTime(),
      });

      sendJson(res, 200, payload);
    } catch (error) {
      handleApiError(res, error);
    }
  };
}

module.exports = {
  NOTIFICATION_SECRET_HEADER,
  buildDailyDigimonReportPayload,
  createDailyDigimonReportHandler,
  formatKstDate,
  resolveDigimonDisplayName,
  resolveNotificationSettings,
  normalizeDiscordWebhookUrl,
  resolveSlotIssues,
  resolveActiveDeathDiseaseCounters,
  resolveTamerName,
  verifySchedulerSecret,
};
