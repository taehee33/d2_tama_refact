"use strict";

const { getDocument, listDocuments } = require("./firestoreAdmin");
const { allowMethods, handleApiError, sendJson } = require("./http");

const KST_TIME_ZONE = "Asia/Seoul";
const NOTIFICATION_SECRET_HEADER = "x-d2-scheduler-secret";
const REPORT_BORDER = "━━━━━━━━━━━━━━━━━━";

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

function formatKstDate(date = new Date()) {
  const sourceDate = date instanceof Date ? date : new Date(date);
  const safeDate = Number.isNaN(sourceDate.getTime()) ? new Date() : sourceDate;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const partMap = formatter.formatToParts(safeDate).reduce((accumulator, part) => {
    if (part.type !== "literal") {
      accumulator[part.type] = part.value;
    }
    return accumulator;
  }, {});

  return `${partMap.year}-${partMap.month}-${partMap.day} ${partMap.hour}:${partMap.minute}:${partMap.second}`;
}

function resolveNotificationSettings(settingsData, rootData) {
  const discordWebhookUrl = hasOwnField(settingsData, "discordWebhookUrl")
    ? normalizeString(settingsData.discordWebhookUrl) || null
    : normalizeString(rootData?.discordWebhookUrl) || null;
  const isNotificationEnabled = hasOwnField(settingsData, "isNotificationEnabled")
    ? settingsData.isNotificationEnabled === true
    : rootData?.isNotificationEnabled === true;

  return {
    discordWebhookUrl,
    isNotificationEnabled,
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

function resolveSlotIssues(slotData = {}) {
  const stats = slotData?.digimonStats && typeof slotData.digimonStats === "object" ? slotData.digimonStats : {};
  const callStatus = stats?.callStatus && typeof stats.callStatus === "object" ? stats.callStatus : {};
  const hungerCall = normalizeCallEntry(callStatus.hunger);
  const strengthCall = normalizeCallEntry(callStatus.strength);
  const sleepCall = normalizeCallEntry(callStatus.sleep);
  const fullness = normalizeNumber(stats.fullness, 1);
  const strength = normalizeNumber(stats.strength, 1);
  const issues = [];

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

function buildUserDailyReport({ uid, tamerName, webhookUrl, slotDocuments = [], generatedAt }) {
  const abnormalList = [];
  const healthyList = [];

  sortSlotDocuments(slotDocuments).forEach((slotDocument) => {
    const slotId = normalizeString(slotDocument?.id || slotDocument?.name?.split("/").pop(), "slot?");
    const slotData = slotDocument?.data && typeof slotDocument.data === "object" ? slotDocument.data : {};

    if (isStoredInCareStorage(slotData)) {
      return;
    }

    const digimonName = resolveDigimonDisplayName(slotData);
    const issues = resolveSlotIssues(slotData);

    if (issues.length > 0) {
      abnormalList.push(`- **${digimonName}** (${slotId}): ${issues.join(", ")}`);
      return;
    }

    healthyList.push(`- **${digimonName}** (${slotId})`);
  });

  let messageContent = `${REPORT_BORDER}\n📊 **디지몬 상태 일일 보고**\n\n👤 **테이머**: ${tamerName}\n`;

  if (abnormalList.length > 0) {
    messageContent += `⚠️ **상태이상 발생!**\n${abnormalList.join("\n")}\n`;
  } else {
    messageContent += "✅ **상태이상 디지몬이 없습니다!**\n현재 모든 디지몬이 아주 건강합니다. ✨\n";
  }

  if (healthyList.length > 0) {
    messageContent += `\n🍀 **정상 상태 디지몬 목록**\n${healthyList.join("\n")}\n`;
  }

  messageContent += `\n⏰ **확인 시간**: ${generatedAt}\n${REPORT_BORDER}`;

  return {
    uid,
    tamerName,
    webhookUrl,
    messageContent,
    abnormalCount: abnormalList.length,
    healthyCount: healthyList.length,
  };
}

async function buildDailyDigimonReportPayload({
  users = [],
  getDocumentByPath,
  listCollectionDocuments,
  currentTime = new Date(),
}) {
  if (typeof getDocumentByPath !== "function" || typeof listCollectionDocuments !== "function") {
    throw new TypeError("알림 리포트 생성에 필요한 Firestore 헬퍼가 없습니다.");
  }

  const userDocuments = Array.isArray(users) ? users : [];
  const generatedAt = formatKstDate(currentTime);
  const skippedUsersByReason = {
    invalidUser: 0,
    notificationDisabled: 0,
    missingWebhook: 0,
    noSlots: 0,
  };

  const userResults = await Promise.all(
    userDocuments.map(async (userDocument) => {
      const uid = normalizeString(userDocument?.id || userDocument?.name?.split("/").pop());
      const rootData = userDocument?.data && typeof userDocument.data === "object" ? userDocument.data : {};

      if (!uid) {
        return {
          activeNotificationUser: false,
          slotCount: 0,
          skipReason: "invalidUser",
        };
      }

      const settingsDocument = await getDocumentByPath(`users/${uid}/settings/main`);
      const settings = resolveNotificationSettings(settingsDocument?.data, rootData);

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

      const [profileDocument, slotDocuments] = await Promise.all([
        getDocumentByPath(`users/${uid}/profile/main`),
        listCollectionDocuments(`users/${uid}/slots`),
      ]);
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
      totalUsers: userDocuments.length,
      activeNotificationUsers,
      reportCount: reports.length,
      skippedUsers: userDocuments.length - reports.length,
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
  const getDocumentByPath = deps.getDocument || getDocument;
  const getCurrentTime = deps.getCurrentTime || (() => new Date());
  const getSchedulerSecret = deps.getSchedulerSecret || (() => process.env.NOTIFICATION_API_SECRET || "");

  return async function dailyDigimonReportHandler(req, res) {
    if (!allowMethods(req, res, ["POST"])) {
      return;
    }

    try {
      verifySchedulerSecret(req, getSchedulerSecret());

      const users = await listCollectionDocuments("users");
      const payload = await buildDailyDigimonReportPayload({
        users,
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
  resolveSlotIssues,
  resolveTamerName,
};
