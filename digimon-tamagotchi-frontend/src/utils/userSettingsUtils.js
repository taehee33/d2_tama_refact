// src/utils/userSettingsUtils.js
// 사용자별 설정 (Discord 웹훅, 알림 수신 여부) - Firestore users/{uid} 저장

import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

/** Discord 웹훅 URL 허용 도메인 (discord.com, discordapp.com) */
const DISCORD_WEBHOOK_PREFIXES = ["https://discord.com/api/webhooks/", "https://discordapp.com/api/webhooks/"];

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
 * 사용자 설정 가져오기 (Discord 웹훅 URL, 알림 수신 여부)
 * @param {string} uid - 사용자 ID
 * @returns {Promise<{ discordWebhookUrl: string|null, isNotificationEnabled: boolean }>}
 */
export async function getUserSettings(uid) {
  if (!uid) {
    return { discordWebhookUrl: null, isNotificationEnabled: false };
  }
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      return {
        discordWebhookUrl: data.discordWebhookUrl ?? null,
        isNotificationEnabled: data.isNotificationEnabled === true,
      };
    }
    return { discordWebhookUrl: null, isNotificationEnabled: false };
  } catch (error) {
    console.error("사용자 설정 로드 오류:", error);
    return { discordWebhookUrl: null, isNotificationEnabled: false };
  }
}

/**
 * Discord 웹훅 URL·알림 수신 여부 저장
 * @param {string} uid - 사용자 ID
 * @param {Object} options
 * @param {string|null} [options.discordWebhookUrl] - Discord 웹훅 URL (빈 문자열이면 null로 저장)
 * @param {boolean} [options.isNotificationEnabled] - 알림 수신 여부
 * @returns {Promise<void>}
 */
export async function saveUserSettings(uid, { discordWebhookUrl, isNotificationEnabled }) {
  if (!uid) throw new Error("사용자 ID가 필요합니다.");
  const userRef = doc(db, "users", uid);
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
  await updateDoc(userRef, updates);
}
