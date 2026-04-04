import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { SITE_THEME_OPTIONS, useTheme } from "../contexts/ThemeContext";
import useEncyclopediaSummary from "../hooks/useEncyclopediaSummary";
import useTamerProfile from "../hooks/useTamerProfile";
import useUserSlots from "../hooks/useUserSlots";
import {
  ACHIEVEMENT_VER1_MASTER,
  ACHIEVEMENT_VER2_MASTER,
} from "../utils/userProfileUtils";
import { getSlotDisplayName, getSlotStageLabel } from "../utils/slotViewUtils";
import { getUserSettings } from "../utils/userSettingsUtils";

const DEFAULT_SETTINGS_SUMMARY = {
  loading: true,
  isNotificationEnabled: false,
};

function Me() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { themeId } = useTheme();
  const { displayTamerName, achievements, maxSlots } = useTamerProfile();
  const { slots, loading, recentSlot, recentSlots } = useUserSlots({ maxSlots });
  const {
    loading: isCollectionLoading,
    versions,
    totalDiscoveredCount,
    totalRequiredCount,
  } = useEncyclopediaSummary();
  const [settingsSummary, setSettingsSummary] = useState(DEFAULT_SETTINGS_SUMMARY);

  useEffect(() => {
    let isCancelled = false;

    const loadSettingsSummary = async () => {
      if (!currentUser?.uid) {
        setSettingsSummary({
          loading: false,
          isNotificationEnabled: false,
        });
        return;
      }

      setSettingsSummary((currentSummary) => ({
        ...currentSummary,
        loading: true,
      }));

      try {
        const settings = await getUserSettings(currentUser.uid);

        if (!isCancelled) {
          setSettingsSummary({
            loading: false,
            isNotificationEnabled: settings.isNotificationEnabled,
          });
        }
      } catch (error) {
        console.error("마이 설정 요약 로드 오류:", error);
        if (!isCancelled) {
          setSettingsSummary({
            loading: false,
            isNotificationEnabled: false,
          });
        }
      }
    };

    loadSettingsSummary();

    return () => {
      isCancelled = true;
    };
  }, [currentUser?.uid]);

  const themeLabel = useMemo(
    () =>
      SITE_THEME_OPTIONS.find((option) => option.id === themeId)?.label || "기본",
    [themeId]
  );
  const secondaryRecentSlots = recentSlots.slice(1, 3);

  return (
    <section className="service-page">
      <div className="service-hero">
        <div className="service-hero__content">
          <p className="service-section-label">테이머(설정)</p>
          <h1>{displayTamerName}님의 테이머 카드</h1>
          <p>내 테이머 기록과 수집 현황, 계정 설정을 한곳에서 확인합니다.</p>
          <div className="service-chip-row">
            <span className="service-badge">{`슬롯 ${slots.length} / ${maxSlots}`}</span>
            {achievements.includes(ACHIEVEMENT_VER1_MASTER) && (
              <span className="service-badge service-badge--accent">👑 Ver.1 마스터</span>
            )}
            {achievements.includes(ACHIEVEMENT_VER2_MASTER) && (
              <span className="service-badge service-badge--cool">👑 Ver.2 마스터</span>
            )}
          </div>
        </div>

        <div className="service-hero__panel">
          <div className="service-card service-card--soft">
            <p className="service-section-label">계정 설정</p>
            <h2>환경 요약</h2>
            <div className="service-settings-summary">
              <div className="service-key-value">
                <strong>현재 테마</strong>
                <span>{themeLabel}</span>
              </div>
              <div className="service-key-value">
                <strong>Discord 알림</strong>
                <span>
                  {settingsSummary.loading
                    ? "불러오는 중"
                    : settingsSummary.isNotificationEnabled
                      ? "켜짐"
                      : "꺼짐"}
                </span>
              </div>
            </div>
            <p className="service-muted">
              테이머명, 화면 테마, 알림, 로그아웃은 설정 페이지에서 관리합니다.
            </p>
            <Link className="service-button service-button--primary" to="/me/settings">
              계정 설정 열기
            </Link>
          </div>
        </div>
      </div>

      <div className="service-two-column">
        <div className="service-card service-card--soft">
          <p className="service-section-label">수집 현황</p>
          <h2>도감 진행도</h2>
          {isCollectionLoading ? (
            <p className="service-muted">도감 요약을 불러오는 중입니다.</p>
          ) : (
            <>
              <p className="service-muted">
                {`총 ${totalDiscoveredCount} / ${totalRequiredCount}종을 발견했습니다.`}
              </p>
              <div className="service-collection-summary">
                {versions.map((summary) => {
                  const hasMaster =
                    summary.version === "Ver.1"
                      ? achievements.includes(ACHIEVEMENT_VER1_MASTER) || summary.isComplete
                      : achievements.includes(ACHIEVEMENT_VER2_MASTER) || summary.isComplete;

                  return (
                    <div
                      key={summary.version}
                      className={`service-collection-card${
                        hasMaster ? " service-collection-card--complete" : ""
                      }`}
                    >
                      <strong>{summary.version}</strong>
                      <span>{`${summary.discoveredCount} / ${summary.totalCount} 발견`}</span>
                      <span>{hasMaster ? "👑 마스터 달성" : `${summary.remainingCount}종 남음`}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <div className="service-inline-actions">
            <Link className="service-button service-button--primary" to="/me/collection">
              도감 보러가기
            </Link>
          </div>
        </div>

        <div className="service-card service-card--mint">
          <p className="service-section-label">최근 육성 중인 디지몬</p>
          <h2>이어 키우기</h2>
          {loading ? (
            <p className="service-muted">슬롯을 불러오는 중입니다.</p>
          ) : recentSlot ? (
            <>
              <button
                type="button"
                className="service-feature-card"
                onClick={() => navigate(`/play/${recentSlot.id}`)}
              >
                <span className="service-section-label">대표 슬롯</span>
                <strong>{getSlotDisplayName(recentSlot)}</strong>
                <span>{getSlotStageLabel(recentSlot)}</span>
                <span>가장 최근에 이어서 육성한 디지몬으로 바로 돌아갑니다.</span>
              </button>
              <div className="service-inline-actions">
                <button
                  type="button"
                  className="service-button service-button--primary"
                  onClick={() => navigate(`/play/${recentSlot.id}`)}
                >
                  이어하기
                </button>
                <Link className="service-button service-button--ghost" to="/play">
                  플레이 허브
                </Link>
              </div>
              {secondaryRecentSlots.length > 0 ? (
                <div className="service-mini-list">
                  {secondaryRecentSlots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      className="service-mini-card"
                      onClick={() => navigate(`/play/${slot.id}`)}
                    >
                      <strong>{getSlotDisplayName(slot)}</strong>
                      <span>{getSlotStageLabel(slot)}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <p className="service-muted">아직 시작한 디지몬이 없습니다.</p>
              <div className="service-inline-actions">
                <Link className="service-button service-button--primary" to="/play">
                  첫 디지몬 시작하기
                </Link>
                <Link className="service-button service-button--ghost" to="/guide">
                  진화 가이드 보기
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="service-card">
        <p className="service-section-label">바로가기</p>
        <h2>자주 찾는 메뉴</h2>
        <div className="service-shortcut-grid">
          <Link className="service-shortcut-card" to="/me/collection">
            <strong>도감</strong>
            <span>발견한 디지몬과 수집 기록을 다시 확인합니다.</span>
          </Link>
          <Link className="service-shortcut-card" to="/guide">
            <strong>진화 가이드</strong>
            <span>진화 조건과 육성 팁을 다시 살펴봅니다.</span>
          </Link>
          <Link className="service-shortcut-card" to="/play">
            <strong>플레이 허브</strong>
            <span>슬롯 정리와 새 디지몬 시작을 이어서 진행합니다.</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default Me;
