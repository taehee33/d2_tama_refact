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
  getUserSettings,
  isValidDiscordWebhookUrl,
  saveUserSettings,
} from "../../utils/userSettingsUtils";
import {
  ACHIEVEMENT_VER1_MASTER,
  ACHIEVEMENT_VER2_MASTER,
  BASE_MAX_SLOTS,
  SLOTS_PER_MASTER,
  getAchievementsAndMaxSlots,
} from "../../utils/userProfileUtils";

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

function AccountSettingsPanel({
  slotCount,
  tamerName: parentTamerName = "",
  setTamerName: setTamerNameParent,
  refreshProfile,
}) {
  const { currentUser } = useAuth();
  const { themeId, setTheme, isThemeLoading } = useTheme();
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
  const [discordSettingsLoading, setDiscordSettingsLoading] = useState(false);
  const [discordSettingsMessage, setDiscordSettingsMessage] = useState("");
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
        const [resolvedTamerName, settings, profile] = await Promise.all([
          getTamerName(currentUser.uid, getDefaultTamerName(currentUser)),
          getUserSettings(currentUser.uid),
          getAchievementsAndMaxSlots(currentUser.uid),
        ]);

        if (!isMounted) {
          return;
        }

        const nextTamerName = resolvedTamerName || getDefaultTamerName(currentUser);
        setTamerName(nextTamerName);
        setTamerNameInput(nextTamerName);
        setDiscordWebhookUrl(settings.discordWebhookUrl || "");
        setIsNotificationEnabled(settings.isNotificationEnabled === true);
        setAchievements(profile.achievements || []);
        setMaxSlots(profile.maxSlots ?? 10);
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
  }, [currentUser]);

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
      });
      setDiscordSettingsMessage("Discord 알림 설정이 저장되었습니다.");
    } catch (error) {
      setDiscordSettingsMessage(error.message || "저장 중 오류가 발생했습니다.");
    } finally {
      setDiscordSettingsLoading(false);
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
          호출, 상태 변화 같은 알림을 Discord로 받기
        </label>

        {discordSettingsMessage ? (
          <p className={getMessageClassName(discordSettingsMessage)}>
            {discordSettingsMessage}
          </p>
        ) : (
          <p className="service-muted">
            웹훅을 등록하면 디지몬 호출과 주요 상태 변화를 Discord 채널에서 확인할 수 있습니다.
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
    </div>
  );
}

export default AccountSettingsPanel;
