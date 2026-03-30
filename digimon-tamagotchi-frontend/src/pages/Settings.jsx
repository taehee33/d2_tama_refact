import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AccountSettingsPanel from "../components/panels/AccountSettingsPanel";
import { useAuth } from "../contexts/AuthContext";
import useTamerProfile from "../hooks/useTamerProfile";
import useUserSlots from "../hooks/useUserSlots";

function Settings() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const {
    tamerName,
    setTamerName,
    displayTamerName,
    maxSlots,
    refreshProfile,
  } = useTamerProfile();
  const { slots } = useUserSlots({ maxSlots });
  const [isLogoutConfirming, setIsLogoutConfirming] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const handleLogout = async () => {
    setLogoutLoading(true);
    setLogoutError("");

    try {
      await logout();
      navigate("/auth");
    } catch (error) {
      setLogoutError(error.message || "로그아웃 중 오류가 발생했습니다.");
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <section className="service-page">
      <div className="service-hero service-hero--compact">
        <div className="service-hero__content">
          <p className="service-section-label">설정</p>
          <h1>{displayTamerName}님의 계정 설정</h1>
          <p>테이머명, Discord 알림, 로그아웃을 한 화면에서 관리할 수 있습니다.</p>
          <div className="service-inline-actions">
            <span className="service-badge">{`슬롯 ${slots.length} / ${maxSlots}`}</span>
            <Link className="service-text-link" to="/me">
              ← 마이로 돌아가기
            </Link>
          </div>
        </div>
      </div>

      <div className="service-two-column">
        <div className="service-card service-card--soft">
          <p className="service-section-label">계정</p>
          <h2>테이머 프로필과 알림</h2>
          <AccountSettingsPanel
            slotCount={slots.length}
            tamerName={tamerName}
            setTamerName={setTamerName}
            refreshProfile={refreshProfile}
          />
        </div>

        <div className="service-card service-card--warm">
          <p className="service-section-label">세션</p>
          <h2>로그아웃</h2>
          <p>
            현재 기기에서 로그인 세션을 종료합니다. 다시 플레이하려면 Google 로그인이
            필요합니다.
          </p>

          {logoutError ? <div className="service-alert">{logoutError}</div> : null}

          {isLogoutConfirming ? (
            <div className="space-y-3">
              <div className="rounded-[1.2rem] border border-amber-200 bg-white/75 p-4 text-sm text-slate-700">
                로그아웃하면 플레이 허브와 마이페이지 접근이 종료됩니다.
              </div>
              <div className="service-inline-actions">
                <button
                  type="button"
                  onClick={() => setIsLogoutConfirming(false)}
                  className="service-button service-button--ghost"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={logoutLoading}
                  className="service-button service-button--primary"
                >
                  {logoutLoading ? "로그아웃 중..." : "로그아웃"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsLogoutConfirming(true)}
              className="service-button service-button--primary"
            >
              로그아웃 확인
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default Settings;
