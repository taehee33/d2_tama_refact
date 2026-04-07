// src/utils/userSettingsUtils.js
// 사용자별 설정 (Discord 웹훅, 알림 수신 여부, 사이트 테마) - Firestore users/{uid}/settings/main 저장

import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

/** Discord 웹훅 URL 허용 도메인 (discord.com, discordapp.com) */
const DISCORD_WEBHOOK_PREFIXES = ["https://discord.com/api/webhooks/", "https://discordapp.com/api/webhooks/"];
const SITE_THEMES = new Set(["default", "notebook"]);
const USER_SETTINGS_DOC_ID = "main";

function getUserRootRef(uid) {
  return doc(db, "users", uid);
}

function getUserSettingsRef(uid) {
  return doc(db, "users", uid, "settings", USER_SETTINGS_DOC_ID);
}

function getDefaultUserSettings() {
  return { discordWebhookUrl: null, isNotificationEnabled: false, siteTheme: null };
}

function mapSettings(data) {
  return {
    discordWebhookUrl: data?.discordWebhookUrl ?? null,
    isNotificationEnabled: data?.isNotificationEnabled === true,
    siteTheme: normalizeSiteTheme(data?.siteTheme),
  };
}

/**
 * URL이 유효한 Discord 웹훅 URL인지 검사
 * @param {string} url - 검사할 URL
 * @returns {boolean}
 */
export function isValidDiscordWebhookUrl(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  return DISCORD_WEBHOOK_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

/**
 * 사이트 테마 값을 정규화
 * @param {string|null|undefined} themeId - 정규화할 테마 ID
 * @returns {"default"|"notebook"|null}
 */
export function normalizeSiteTheme(themeId) {
  if (typeof themeId !== "string") {
    return null;
  }

  const trimmed = themeId.trim();
  return SITE_THEMES.has(trimmed) ? trimmed : null;
}

/**
 * 사용자 설정 가져오기 (Discord 웹훅 URL, 알림 수신 여부, 사이트 테마)
 * @param {string} uid - 사용자 ID
 * @returns {Promise<{ discordWebhookUrl: string|null, isNotificationEnabled: boolean, siteTheme: "default"|"notebook"|null }>}
 */
export async function getUserSettings(uid) {
  if (!uid) {
    return getDefaultUserSettings();
  }
  try {
    const settingsRef = getUserSettingsRef(uid);
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists()) {
      return mapSettings(settingsSnap.data());
    }

    const userRef = getUserRootRef(uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      return mapSettings(userSnap.data());
    }
    return getDefaultUserSettings();
  } catch (error) {
    console.error("사용자 설정 로드 오류:", error);
    return getDefaultUserSettings();
  }
}

/**
 * Discord 웹훅 URL·알림 수신 여부·사이트 테마 저장
 * @param {string} uid - 사용자 ID
 * @param {Object} options
 * @param {string|null} [options.discordWebhookUrl] - Discord 웹훅 URL (빈 문자열이면 null로 저장)
 * @param {boolean} [options.isNotificationEnabled] - 알림 수신 여부
 * @param {"default"|"notebook"} [options.siteTheme] - 사이트 테마
 * @returns {Promise<void>}
 */
export async function saveUserSettings(uid, { discordWebhookUrl, isNotificationEnabled, siteTheme }) {
  if (!uid) throw new Error("사용자 ID가 필요합니다.");
  const settingsRef = getUserSettingsRef(uid);
  const updates = { updatedAt: new Date() };
  if (discordWebhookUrl !== undefined) {
    const val = typeof discordWebhookUrl === "string" ? discordWebhookUrl.trim() || null : null;
    if (val !== null && !isValidDiscordWebhookUrl(val)) {
      throw new Error("Discord 웹훅 URL은 https://discord.com/api/webhooks/ 또는 https://discordapp.com/api/webhooks/ 로 시작해야 합니다.");
    }
    updates.discordWebhookUrl = val;
  }
  if (isNotificationEnabled !== undefined) {
    updates.isNotificationEnabled = Boolean(isNotificationEnabled);
  }
  if (siteTheme !== undefined) {
    const normalizedTheme = normalizeSiteTheme(siteTheme);
    if (!normalizedTheme) {
      throw new Error("사이트 테마는 기본 또는 한솔이의 노트북만 선택할 수 있습니다.");
    }
    updates.siteTheme = normalizedTheme;
  }
  await setDoc(settingsRef, updates, { merge: true });
}
