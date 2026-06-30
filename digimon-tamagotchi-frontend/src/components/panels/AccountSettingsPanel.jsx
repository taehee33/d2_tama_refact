import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { SITE_THEME_OPTIONS, useTheme } from "../../contexts/ThemeContext";
import { emitTamerProfileRefresh } from "../../hooks/useTamerProfile";
import {
  checkNicknameAvailability,
  getTamerName,
  hasCollapsedSpaces,
  normalizeNicknameInput,
  resetToDefaultTamerName,
  resolveTamerNamePriority,
  updateTamerName,
  withNormalizationNotice,
} from "../../utils/tamerNameUtils";
import {
  DEFAULT_NOTIFICATION_CHANNELS,
  getUserSettings,
  isValidDiscordWebhookUrl,
  normalizeNotificationChannels,
  saveUserSettings,
} from "../../utils/userSettingsUtils";
import {
  getNotificationStatus,
  sendTestNotification,
  subscribeWebPush,
  unsubscribeWebPush,
} from "../../utils/notificationApi";
import {
  getWebPushSupportInfo,
  isWebPushSupported,
  removeWebPushSubscription,
  requestWebPushSubscription,
} from "../../utils/webPushClient";
import {
  ACHIEVEMENT_VER1_MASTER,
  ACHIEVEMENT_VER2_MASTER,
  BASE_MAX_SLOTS,
  SLOTS_PER_MASTER,
  getAchievementsAndMaxSlots,
} from "../../utils/userProfileUtils";
import HomeScreenInstallSection from "../HomeScreenInstallSection";
import usePwaInstallPrompt from "../../hooks/usePwaInstallPrompt";

function getDefaultTamerName(currentUser) {
  return resolveTamerNamePriority({
    currentUser,
    fallback: `Trainer_${currentUser?.uid?.slice(0, 6) || "000000"}`,
  });
}

function getMessageClassName(message) {
  if (!message) {
    return "service-muted";
  }

  if (message.includes("늦을 수 있습니다")) {
    return "text-sm font-semibold text-amber-600";
  }

  if (
    message.includes("오류") ||
    message.includes("이미 사용") ||
    message.includes("부족") ||
    message.includes("시작해야")
  ) {
    return "text-sm font-semibold text-red-500";
  }

  if (message.includes("저장") || message.includes("복구") || message.includes("가능")) {
    return "text-sm font-semibold text-green-600";
  }

  return "text-sm text-gray-600";
}

function getDefaultNotificationStatus() {
  return {
    settings: {
      isNotificationEnabled: false,
      hasDiscordWebhook: false,
      hasWebPushSubscription: false,
      activePushSubscriptionCount: 0,
      notificationChannels: { ...DEFAULT_NOTIFICATION_CHANNELS },
    },
    projection: {
      totalSlots: 0,
      projectedSlots: 0,
      frozenSlots: 0,
      unavailableSlots: [],
      projectionUnavailable: 0,
    },
    delivery: {
      activeIssueSlotCount: 0,
      recentDeliveries: [],
      lastDiscordResult: null,
    },
    recentNotifications: [],
    urgentCheck: null,
    diagnostics: {
      nextUrgentCheckAt: null,
      latestTestNotification: null,
      currentSlot: null,
    },
  };
}

function formatDateTime(value) {
  if (!value) {
    return "기록 없음";
  }

  const parsed = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "기록 없음";
  }

  return parsed.toLocaleString("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getDiscordResultLabel(result) {
  if (!result) {
    return "전송 이력 없음";
  }

  if (result.status === "sent" || result.status === "acknowledged") {
    return "성공";
  }

  if (result.status === "failed") {
    return "실패";
  }

  if (result.status === "pending") {
    return "대기 중";
  }

  if (result.status === "cancelled") {
    return "취소됨";
  }

  return result.status || "기록 없음";
}

function getUrgentCheckLabel(urgentCheck) {
  if (!urgentCheck) {
    return "검사 이력 없음";
  }

  if (urgentCheck.status === "success") {
    return `정상 · 새 전송 ${urgentCheck.newDeliveries || 0}건`;
  }

  if (urgentCheck.status === "error") {
    return `오류 · ${urgentCheck.errorMessage || "상세 없음"}`;
  }

  return urgentCheck.status || "기록 없음";
}

function getUrgentCheckSummary(urgentCheck) {
  if (!urgentCheck) {
    return "10분 서버 검사 기록이 없습니다.";
  }

  if (urgentCheck.status === "error") {
    return "Apps Script 실행 기록과 Vercel 로그를 확인해 주세요.";
  }

  return [
    `계산 성공 ${urgentCheck.projectedSlots || 0}/${urgentCheck.totalSlots || 0}개`,
    `계산 제외 ${urgentCheck.projectionUnavailable || 0}개`,
    `새 전송 ${urgentCheck.newDeliveries || 0}건`,
    `만료 정리 ${urgentCheck.expiredDeliveries || 0}개`,
  ].join(" · ");
}

function getCurrentSlotDiagnosticLabel(currentSlot) {
  if (!currentSlot) {
    return "현재 슬롯 정보 없음";
  }
  if (currentSlot.status === "urgent") {
    return `긴급 이슈 ${currentSlot.issues?.length || 0}건`;
  }
  if (currentSlot.status === "clear") {
    return "긴급 이슈 없음";
  }
  if (currentSlot.status === "not_eligible") {
    return "계산 대상 아님";
  }
  if (currentSlot.status === "stored") {
    return "보관함 제외";
  }
  if (currentSlot.status === "missing") {
    return "슬롯 문서 없음";
  }
  if (currentSlot.status === "error") {
    return "진단 오류";
  }
  return currentSlot.reason || currentSlot.status || "진단 불가";
}

function safeNormalizeNotificationChannels(channels) {
  return normalizeNotificationChannels(channels) || { ...DEFAULT_NOTIFICATION_CHANNELS };
}

function getChannelSummary(channels) {
  const normalized = safeNormalizeNotificationChannels(channels);
  return [
    normalized.inApp ? "앱 표시" : "앱 숨김",
    normalized.discord ? "Discord 켜짐" : "Discord 꺼짐",
    normalized.webPush ? "푸시 켜짐" : "푸시 꺼짐",
  ].join(" · ");
}

function AccountSettingsPanel({
  slotCount,
  slotId = "",
  tamerName: parentTamerName = "",
  setTamerName: setTamerNameParent,
  refreshProfile,
  installSectionId = "install",
  focusSection = null,
}) {
  const { currentUser } = useAuth();
  const { themeId, setTheme, isThemeLoading } = useTheme();
  const installPrompt = usePwaInstallPrompt();
  const [loading, setLoading] = useState(true);
  const [tamerName, setTamerName] = useState(parentTamerName || "");
  const [tamerNameInput, setTamerNameInput] = useState(parentTamerName || "");
  const [tamerNameLoading, setTamerNameLoading] = useState(false);
  const [tamerNameMessage, setTamerNameMessage] = useState("");
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [achievements, setAchievements] = useState([]);
  const [maxSlots, setMaxSlots] = useState(10);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);
  const [notificationChannels, setNotificationChannels] = useState({
    ...DEFAULT_NOTIFICATION_CHANNELS,
  });
  const [discordSettingsLoading, setDiscordSettingsLoading] = useState(false);
  const [discordSettingsMessage, setDiscordSettingsMessage] = useState("");
  const [notificationStatus, setNotificationStatus] = useState(getDefaultNotificationStatus);
  const [notificationStatusMessage, setNotificationStatusMessage] = useState("");
  const [isSendingTestNotification, setIsSendingTestNotification] = useState(false);
  const [isUpdatingWebPush, setIsUpdatingWebPush] = useState(false);
  const [webPushMessage, setWebPushMessage] = useState("");
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeMessage, setThemeMessage] = useState("");

  useEffect(() => {
    if (!parentTamerName || tamerName) {
      return;
    }

    setTamerName(parentTamerName);
    setTamerNameInput(parentTamerName);
  }, [parentTamerName, tamerName]);

  useEffect(() => {
    let isMounted = true;

    const loadPanelData = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const [resolvedTamerName, settings, profile, loadedNotificationStatus] = await Promise.all([
          getTamerName(currentUser.uid, getDefaultTamerName(currentUser)),
          getUserSettings(currentUser.uid),
          getAchievementsAndMaxSlots(currentUser.uid),
          getNotificationStatus(currentUser, { slotId }).catch((error) => {
            console.warn("알림 상태 로드 오류:", error);
            return null;
          }),
        ]);

        if (!isMounted) {
          return;
        }

        const nextTamerName = resolvedTamerName || getDefaultTamerName(currentUser);
        setTamerName(nextTamerName);
        setTamerNameInput(nextTamerName);
        setDiscordWebhookUrl(settings.discordWebhookUrl || "");
        setIsNotificationEnabled(settings.isNotificationEnabled === true);
        setNotificationChannels(
          safeNormalizeNotificationChannels(settings.notificationChannels)
        );
        setAchievements(profile.achievements || []);
        setMaxSlots(profile.maxSlots ?? 10);
        setNotificationStatus(loadedNotificationStatus || getDefaultNotificationStatus());
        setNotificationStatusMessage(
          loadedNotificationStatus ? "" : "알림 상태를 불러오지 못했습니다."
        );
      } catch (error) {
        console.error("계정 설정 패널 로드 오류:", error);
        if (!isMounted) {
          return;
        }

        const fallbackName = getDefaultTamerName(currentUser);
        setTamerName(fallbackName);
        setTamerNameInput(fallbackName);
        setAchievements([]);
        setMaxSlots(10);
        setNotificationStatus(getDefaultNotificationStatus());
        setNotificationStatusMessage("알림 상태를 불러오지 못했습니다.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPanelData();

    return () => {
      isMounted = false;
    };
  }, [currentUser, slotId]);

  const updateNotificationChannel = (channelName, checked) => {
    setNotificationChannels((previous) => ({
      ...safeNormalizeNotificationChannels(previous),
      [channelName]: checked,
    }));
    setDiscordSettingsMessage("");
  };

  const syncProfileState = async (nextTamerName) => {
    if (typeof setTamerNameParent === "function") {
      setTamerNameParent(nextTamerName);
    }

    let refreshError = null;

    if (typeof refreshProfile === "function") {
      try {
        await refreshProfile();
      } catch (error) {
        refreshError = error;
        console.error("테이머 프로필 새로고침 오류:", error);
      }
    }

    emitTamerProfileRefresh({ uid: currentUser?.uid });

    if (refreshError) {
      throw refreshError;
    }
  };

  const handleCheckAvailability = async () => {
    if (!tamerNameInput.trim()) {
      setTamerNameMessage("테이머명을 입력해주세요.");
      return;
    }

    setIsCheckingAvailability(true);
    setTamerNameMessage("");

    try {
      const result = await checkNicknameAvailability(tamerNameInput, currentUser?.uid || null);
      if (result.didNormalizeSpaces) {
        setTamerNameInput(result.normalizedNickname);
      }
      setTamerNameMessage(result.message);
    } catch (error) {
      setTamerNameMessage(`오류: ${error.message}`);
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  const handleSaveTamerName = async () => {
    if (!currentUser) {
      return;
    }

    const normalizedCurrentTamerName = normalizeNicknameInput(tamerName);
    const normalizedNextTamerName = normalizeNicknameInput(tamerNameInput);
    const isNoOpNickname =
      Boolean(normalizedNextTamerName) && normalizedNextTamerName === normalizedCurrentTamerName;

    if (isNoOpNickname) {
      if (tamerNameInput !== normalizedNextTamerName) {
        setTamerNameInput(normalizedNextTamerName);
      }

      setTamerNameMessage(
        withNormalizationNotice("현재 사용 중인 테이머명입니다.", hasCollapsedSpaces(tamerNameInput))
      );
      return;
    }

    setTamerNameLoading(true);
    setTamerNameMessage("");

    try {
      const result = await updateTamerName(currentUser.uid, tamerNameInput, tamerName);
      const nextTamerName = result.normalizedNickname;
      setTamerName(nextTamerName);
      setTamerNameInput(nextTamerName);
      const savedMessage = result.didNormalizeSpaces
        ? "연속된 공백은 1칸으로 자동 변경됩니다. 테이머명이 저장되었습니다."
        : "테이머명이 저장되었습니다.";

      try {
        await syncProfileState(nextTamerName);
        setTamerNameMessage(savedMessage);
      } catch (error) {
        setTamerNameMessage(`${savedMessage} 프로필 새로고침이 늦을 수 있습니다.`);
      }
    } catch (error) {
      setTamerNameMessage(`오류: ${error.message}`);
    } finally {
      setTamerNameLoading(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!currentUser) {
      return;
    }

    setTamerNameLoading(true);
    setTamerNameMessage("");

    try {
      await resetToDefaultTamerName(
        currentUser.uid,
        currentUser.displayName,
        tamerName !== getDefaultTamerName(currentUser) ? tamerName : null
      );

      const defaultName = getDefaultTamerName(currentUser);
      setTamerName(defaultName);
      setTamerNameInput(defaultName);
      try {
        await syncProfileState(defaultName);
        setTamerNameMessage("기본값으로 복구되었습니다.");
      } catch (error) {
        setTamerNameMessage("기본값으로 복구되었습니다. 프로필 새로고침이 늦을 수 있습니다.");
      }
    } catch (error) {
      setTamerNameMessage(`오류: ${error.message}`);
    } finally {
      setTamerNameLoading(false);
    }
  };

  const handleSaveDiscordSettings = async () => {
    if (!currentUser) {
      return;
    }

    const urlTrimmed = discordWebhookUrl.trim();
    if (urlTrimmed && !isValidDiscordWebhookUrl(urlTrimmed)) {
      setDiscordSettingsMessage(
        "Discord 웹훅 URL은 https://discord.com/api/webhooks/ 또는 https://discordapp.com/api/webhooks/ 로 시작해야 합니다."
      );
      return;
    }

    setDiscordSettingsLoading(true);
    setDiscordSettingsMessage("");

    try {
      await saveUserSettings(currentUser.uid, {
        discordWebhookUrl: urlTrimmed || null,
        isNotificationEnabled,
        notificationChannels: safeNormalizeNotificationChannels(notificationChannels),
      });
      setDiscordSettingsMessage("알림 설정이 저장되었습니다.");
      const nextNotificationStatus = await getNotificationStatus(currentUser, { slotId }).catch(() => null);
      if (nextNotificationStatus) {
        setNotificationStatus(nextNotificationStatus);
        setNotificationStatusMessage("");
      }
    } catch (error) {
      setDiscordSettingsMessage(error.message || "저장 중 오류가 발생했습니다.");
    } finally {
      setDiscordSettingsLoading(false);
    }
  };

  const handleSendTestNotification = async () => {
    if (!currentUser) {
      return;
    }

    setIsSendingTestNotification(true);
    setNotificationStatusMessage("");

    try {
      await sendTestNotification(currentUser);
      const nextNotificationStatus = await getNotificationStatus(currentUser, { slotId }).catch(() => null);
      if (nextNotificationStatus) {
        setNotificationStatus(nextNotificationStatus);
      }
      setNotificationStatusMessage("테스트 알림을 보냈습니다.");
    } catch (error) {
      setNotificationStatusMessage(error.message || "테스트 알림을 보내지 못했습니다.");
    } finally {
      setIsSendingTestNotification(false);
    }
  };

  const refreshNotificationStatus = async () => {
    const nextNotificationStatus = await getNotificationStatus(currentUser, { slotId }).catch(() => null);
    if (nextNotificationStatus) {
      setNotificationStatus(nextNotificationStatus);
      setNotificationStatusMessage("");
    }
  };

  const handleEnableWebPush = async () => {
    if (!currentUser) {
      return;
    }

    setIsUpdatingWebPush(true);
    setWebPushMessage("");

    try {
      const subscription = await requestWebPushSubscription();
      await subscribeWebPush(currentUser, subscription);
      await refreshNotificationStatus();
      setWebPushMessage("브라우저 푸시 알림이 연결되었습니다.");
    } catch (error) {
      setWebPushMessage(error.message || "브라우저 푸시 알림을 연결하지 못했습니다.");
    } finally {
      setIsUpdatingWebPush(false);
    }
  };

  const handleDisableWebPush = async () => {
    if (!currentUser) {
      return;
    }

    setIsUpdatingWebPush(true);
    setWebPushMessage("");

    try {
      const endpoint = await removeWebPushSubscription();
      if (!endpoint) {
        setWebPushMessage("현재 브라우저에 해제할 푸시 구독이 없습니다.");
        return;
      }
      await unsubscribeWebPush(currentUser, endpoint);
      await refreshNotificationStatus();
      setWebPushMessage("브라우저 푸시 알림이 해제되었습니다.");
    } catch (error) {
      setWebPushMessage(error.message || "브라우저 푸시 알림을 해제하지 못했습니다.");
    } finally {
      setIsUpdatingWebPush(false);
    }
  };

  const handleThemeChange = async (nextThemeId) => {
    if (nextThemeId === themeId) {
      return;
    }

    setThemeSaving(true);
    setThemeMessage("");

    try {
      await setTheme(nextThemeId);
      setThemeMessage("화면 테마가 저장되었습니다.");
    } catch (error) {
      setThemeMessage(error.message || "테마 저장 중 오류가 발생했습니다.");
    } finally {
      setThemeSaving(false);
    }
  };

  const normalizedInputValue = normalizeNicknameInput(tamerNameInput);
  const normalizedCurrentTamerName = normalizeNicknameInput(tamerName);
  const isSameAsCurrentTamerName =
    Boolean(normalizedInputValue) && normalizedInputValue === normalizedCurrentTamerName;
  const projectionSummary = notificationStatus.projection || getDefaultNotificationStatus().projection;
  const lastDiscordResult = notificationStatus.delivery?.lastDiscordResult || null;
  const urgentCheck = notificationStatus.urgentCheck || null;
  const hasUnavailableSlots = Number(projectionSummary.projectionUnavailable || 0) > 0;
  const notificationSettings = notificationStatus.settings || getDefaultNotificationStatus().settings;
  const diagnostics = notificationStatus.diagnostics || getDefaultNotificationStatus().diagnostics;
  const editableChannels = safeNormalizeNotificationChannels(notificationChannels);
  const effectiveChannels = safeNormalizeNotificationChannels(
    notificationSettings.notificationChannels || editableChannels
  );
  const latestTestNotification = diagnostics.latestTestNotification || null;
  const latestTestChannelState = latestTestNotification?.channelState || null;
  const webPushSupportInfo = getWebPushSupportInfo() || {
    supported: false,
    reason: "unsupported",
    message: "현재 브라우저는 푸시 알림을 지원하지 않습니다.",
  };
  const webPushSupported = isWebPushSupported();
  const hasWebPushSubscription = notificationSettings.hasWebPushSubscription === true;

  if (!currentUser) {
    return (
      <div className="service-alert">
        계정 설정은 로그인한 상태에서만 사용할 수 있습니다.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="service-empty-state">
        <div className="service-spinner" aria-hidden="true" />
        <h3>계정 정보를 불러오는 중입니다.</h3>
        <p>테이머 프로필과 Discord 알림 설정을 준비하고 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="service-inline-panel">
        <div className="service-field">
          <span>테이머명</span>
          <div className="flex flex-col gap-2 md:flex-row">
            <input
              type="text"
              value={tamerNameInput}
              onChange={(event) => {
                setTamerNameInput(event.target.value);
                setTamerNameMessage("");
              }}
              placeholder="테이머명을 입력하세요"
              maxLength={20}
            />
            <button
              type="button"
              onClick={handleCheckAvailability}
              disabled={isCheckingAvailability || !tamerNameInput.trim()}
              className="service-button service-button--ghost"
            >
              {isCheckingAvailability ? "확인 중..." : "중복 확인"}
            </button>
          </div>
        </div>

        {tamerNameMessage ? (
          <p className={getMessageClassName(tamerNameMessage)}>{tamerNameMessage}</p>
        ) : null}

        <div className="service-inline-actions">
          <button
            type="button"
            onClick={handleSaveTamerName}
            disabled={
              tamerNameLoading ||
              !normalizedInputValue ||
              isSameAsCurrentTamerName
            }
            className="service-button service-button--primary"
          >
            {tamerNameLoading ? "저장 중..." : "테이머명 저장"}
          </button>
          <button
            type="button"
            onClick={handleResetToDefault}
            disabled={tamerNameLoading || tamerName === getDefaultTamerName(currentUser)}
            className="service-button service-button--ghost"
          >
            기본값 복구
          </button>
        </div>

        <div className="space-y-2">
          <p className="service-muted">
            현재 테이머명: <strong>{tamerName}</strong>
          </p>
          <div className="service-chip-row">
            <span className="service-badge">{`슬롯 ${typeof slotCount === "number" ? slotCount : 0} / ${maxSlots}`}</span>
            {achievements.includes(ACHIEVEMENT_VER1_MASTER) ? (
              <span className="service-badge service-badge--accent">👑 Ver.1 마스터</span>
            ) : null}
            {achievements.includes(ACHIEVEMENT_VER2_MASTER) ? (
              <span className="service-badge service-badge--cool">👑 Ver.2 마스터</span>
            ) : null}
          </div>
          {achievements.length > 0 ? (
            <p className="service-muted">
              기본 {BASE_MAX_SLOTS}개 슬롯에 도감 마스터 칭호마다 {SLOTS_PER_MASTER}개씩 추가됩니다.
            </p>
          ) : null}
        </div>
      </div>

      <div className="service-inline-panel">
        <div className="service-field">
          <span>화면 테마</span>
          <p className="service-muted">
            서비스 홈, 가이드, 테이머(설정), 커뮤니티 같은 일반 페이지 분위기를 바꿉니다.
            노트북 쇼케이스 화면은 별도로 유지됩니다.
          </p>
        </div>

        <div className="service-theme-switcher service-theme-switcher--wide" role="group" aria-label="화면 테마 선택">
          <span className="service-theme-switcher__label">선택</span>
          {SITE_THEME_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`service-theme-switcher__option${
                themeId === option.id ? " service-theme-switcher__option--active" : ""
              }`}
              onClick={() => handleThemeChange(option.id)}
              disabled={themeSaving || isThemeLoading}
              aria-pressed={themeId === option.id}
            >
              {option.label}
            </button>
          ))}
        </div>

        {themeMessage ? (
          <p className={getMessageClassName(themeMessage)}>{themeMessage}</p>
        ) : (
          <p className="service-muted">
            선택 즉시 적용되고 다음 접속에도 같은 분위기로 유지됩니다.
          </p>
        )}
      </div>

      <HomeScreenInstallSection
        id={installSectionId}
        autoFocusOnMount={focusSection === "install"}
        sectionClassName="service-inline-panel"
        headerClassName="service-field"
        headingTag="span"
        titleClassName="block font-semibold text-slate-700"
        descriptionClassName="service-muted"
        description="자주 쓰는 기기라면 앱처럼 빠르게 다시 열 수 있습니다. iPhone과 iPad에서는 수동 설치 방법을 안내합니다."
        buttonClassName="service-button service-button--primary w-full sm:w-auto"
        installState={installPrompt}
      />

      <div className="service-inline-panel">
        <div className="service-field">
          <span>Discord 웹훅 URL</span>
          <input
            type="url"
            value={discordWebhookUrl}
            onChange={(event) => {
              setDiscordWebhookUrl(event.target.value);
              setDiscordSettingsMessage("");
            }}
            placeholder="https://discord.com/api/webhooks/..."
          />
        </div>

        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={isNotificationEnabled}
            onChange={(event) => setIsNotificationEnabled(event.target.checked)}
            className="h-4 w-4 rounded"
          />
          호출, 상태 변화 같은 알림 받기
        </label>

        <div className="grid gap-2 rounded-md border border-slate-200 bg-white/70 p-3 text-sm">
          <label className="flex items-center gap-2 font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={editableChannels.inApp !== false}
              onChange={(event) => updateNotificationChannel("inApp", event.target.checked)}
              className="h-4 w-4 rounded"
            />
            앱 알림함에 표시
          </label>
          <label className="flex items-center gap-2 font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={editableChannels.discord !== false}
              onChange={(event) => updateNotificationChannel("discord", event.target.checked)}
              className="h-4 w-4 rounded"
            />
            Discord로 보내기
          </label>
          <label className="flex items-center gap-2 font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={editableChannels.webPush !== false}
              onChange={(event) => updateNotificationChannel("webPush", event.target.checked)}
              className="h-4 w-4 rounded"
            />
            브라우저 푸시로 보내기
          </label>
        </div>

        {discordSettingsMessage ? (
          <p className={getMessageClassName(discordSettingsMessage)}>
            {discordSettingsMessage}
          </p>
        ) : (
          <p className="service-muted">
            알림 사건 문서는 기록하고, 선택한 채널에만 표시하거나 전송합니다.
          </p>
        )}

        <div className="service-inline-actions">
          <button
            type="button"
            onClick={handleSaveDiscordSettings}
            disabled={discordSettingsLoading}
            className="service-button service-button--primary"
          >
            {discordSettingsLoading ? "저장 중..." : "알림 설정 저장"}
          </button>
        </div>
      </div>

      <div className="service-inline-panel">
        <div className="service-field">
          <span>알림 상태</span>
          <p className="service-muted">
            10분 긴급 알림 계산과 앱 알림함, Discord, 브라우저 푸시 전송 상태를 확인합니다. 현재 슬롯 저장 상태는 게임 화면의 저장 및 동기화 카드에서 확인합니다.
          </p>
        </div>

        <div className="service-settings-summary md:grid-cols-2">
          <div className="service-key-value">
            <p className="service-section-label">알림 수신 설정</p>
            <strong>
              {isNotificationEnabled ? "알림 켜짐" : "알림 꺼짐"}
            </strong>
            <p className="service-muted">
              Discord 웹훅: {discordWebhookUrl.trim() ? "연결됨" : "미연결"}
            </p>
            <p className="service-muted">
              {getChannelSummary(effectiveChannels)}
            </p>
          </div>
          <div className="service-key-value">
            <p className="service-section-label">브라우저 푸시</p>
            <strong>
              {!webPushSupported
                ? "지원 안 됨"
                : hasWebPushSubscription
                ? "연결됨"
                : "미연결"}
            </strong>
            <p className="service-muted">
              활성 기기 {notificationSettings.activePushSubscriptionCount || 0}개
            </p>
          </div>
          <div className="service-key-value">
            <p className="service-section-label">마지막 Discord 전송</p>
            <strong>{getDiscordResultLabel(lastDiscordResult)}</strong>
            <p className="service-muted">
              {formatDateTime(lastDiscordResult?.at)}
            </p>
          </div>
          <div className="service-key-value">
            <p className="service-section-label">마지막 스케줄러 확인</p>
            <strong>{getUrgentCheckLabel(urgentCheck)}</strong>
            <p className="service-muted">
              마지막 긴급 확인 시간: {formatDateTime(urgentCheck?.checkedAt)}
            </p>
            <p className="service-muted">
              다음 예상 확인 시간: {formatDateTime(diagnostics.nextUrgentCheckAt)}
            </p>
            <p className="service-muted">
              {getUrgentCheckSummary(urgentCheck)}
            </p>
          </div>
          <div className="service-key-value">
            <p className="service-section-label">10분 긴급 계산 대상</p>
            <strong>
              {projectionSummary.projectedSlots || 0} / {projectionSummary.totalSlots || 0} 슬롯
            </strong>
            <p className="service-muted">
              보관함 제외 {projectionSummary.frozenSlots || 0}개 · 계산 제외 {projectionSummary.projectionUnavailable || 0}개
            </p>
          </div>
          <div className="service-key-value">
            <p className="service-section-label">앱 알림함</p>
            <strong>{notificationStatus.recentNotifications?.length || 0}개</strong>
            <p className="service-muted">
              {effectiveChannels.inApp
                ? "최근 알림은 오른쪽 위 종 아이콘에서 확인합니다."
                : "앱 알림함 표시가 꺼져 있어 목록에서 숨깁니다."}
            </p>
          </div>
          <div className="service-key-value">
            <p className="service-section-label">현재 슬롯 긴급 진단</p>
            <strong>{getCurrentSlotDiagnosticLabel(diagnostics.currentSlot)}</strong>
            <p className="service-muted">
              {(diagnostics.currentSlot?.issues || []).map((issue) => issue.label).join(", ") || "표시할 이슈 없음"}
            </p>
          </div>
          <div className="service-key-value">
            <p className="service-section-label">최근 테스트 알림</p>
            <strong>{latestTestNotification ? formatDateTime(latestTestNotification.createdAt) : "기록 없음"}</strong>
            <p className="service-muted">
              {latestTestChannelState
                ? [
                    `Discord ${latestTestChannelState.discord?.status || "기록 없음"}`,
                    `푸시 ${latestTestChannelState.webPush?.status || "기록 없음"}`,
                  ].join(" · ")
                : "테스트 알림 결과가 없습니다."}
            </p>
          </div>
        </div>

        <div className="service-inline-actions">
          <button
            type="button"
            onClick={hasWebPushSubscription ? handleDisableWebPush : handleEnableWebPush}
            disabled={isUpdatingWebPush || !webPushSupported}
            className="service-button service-button--ghost"
          >
            {isUpdatingWebPush
              ? "처리 중..."
              : hasWebPushSubscription
                ? "브라우저 푸시 해제"
                : "이 브라우저 푸시 연결"}
          </button>
        </div>

        {webPushMessage ? (
          <p className={getMessageClassName(webPushMessage)}>{webPushMessage}</p>
        ) : !webPushSupported ? (
          <p className="service-muted">
            {webPushSupportInfo.message || "현재 브라우저는 푸시 알림을 지원하지 않습니다."}
          </p>
        ) : null}

        {hasUnavailableSlots ? (
          <div className="service-alert">
            <strong>계산 제외 슬롯 {projectionSummary.projectionUnavailable}개</strong>
            <p>
              {projectionSummary.unavailableSlots.join(", ")} 슬롯의 10분 알림 계산 데이터가 오래되었습니다.
              해당 슬롯을 한 번 열고 저장하면 긴급 알림 대상에 포함됩니다.
            </p>
          </div>
        ) : (
          <p className="service-muted">
            현재 계산 제외 슬롯이 없습니다.
          </p>
        )}

        {notificationStatusMessage ? (
          <p className={getMessageClassName(notificationStatusMessage)}>
            {notificationStatusMessage}
          </p>
        ) : null}

        <div className="service-inline-actions">
          <button
            type="button"
            onClick={handleSendTestNotification}
            disabled={isSendingTestNotification}
            className="service-button service-button--ghost"
          >
            {isSendingTestNotification ? "전송 중..." : "테스트 알림 보내기"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AccountSettingsPanel;
