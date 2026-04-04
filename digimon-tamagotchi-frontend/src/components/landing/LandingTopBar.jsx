import React from "react";
import { Link, NavLink } from "react-router-dom";
import {
  getPrimaryHeaderNavItems,
  HEADER_APP_ICON_SRC,
} from "../../data/headerNavigation";
import { useHeaderAccountMenu } from "../../hooks/useHeaderAccountMenu";

export function LandingTopBar({ tamerName = "" }) {
  const {
    currentUser,
    displayTamerName,
    isAccountMenuOpen,
    isLogoutLoading,
    menuError,
    accountMenuRef,
    toggleAccountMenu,
    handleSettingsClick,
    handleLogoutClick,
  } = useHeaderAccountMenu({ tamerName });
  const navItems = getPrimaryHeaderNavItems({ includeTamer: Boolean(currentUser) });
  const mobileHomePath = currentUser ? "/" : "/auth";

  return (
    <header className="landing-topbar">
      <div className="landing-topbar__inner">
        <div className="landing-topbar__surface">
          <Link className="landing-topbar__brand" to={currentUser ? "/" : "/landing"}>
            <span className="landing-topbar__brand-mark" aria-hidden="true">
              <img
                className="landing-topbar__brand-mark-image"
                src={HEADER_APP_ICON_SRC}
                alt=""
              />
            </span>
            <span className="landing-topbar__brand-copy">
              <span className="landing-topbar__eyebrow">D2 TAMAGOTCHI</span>
              <span className="landing-topbar__title">디지몬 키우기</span>
            </span>
          </Link>

          <nav className="landing-topbar__nav" aria-label="랜딩 주요 이동">
            <div className="landing-topbar__nav-group">
              {navItems.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `landing-topbar__link${isActive ? " landing-topbar__link--active" : ""}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>

          <div className="landing-topbar__actions">
            <Link
              className="landing-topbar__mobile-home"
              to={mobileHomePath}
              aria-label="랜딩 모바일 홈"
            >
              홈
            </Link>

            {currentUser ? (
              <div className="landing-topbar__account-wrap" ref={accountMenuRef}>
                <button
                  type="button"
                  className={`landing-topbar__account${
                    isAccountMenuOpen ? " landing-topbar__account--open" : ""
                  }`}
                  onClick={toggleAccountMenu}
                  aria-haspopup="menu"
                  aria-expanded={isAccountMenuOpen}
                  aria-label={`${displayTamerName} 계정 메뉴`}
                >
                  <span className="landing-topbar__account-name">{displayTamerName}</span>
                  <span className="landing-topbar__account-caret" aria-hidden="true">
                    {isAccountMenuOpen ? "▴" : "▾"}
                  </span>
                </button>

                {isAccountMenuOpen ? (
                  <div className="landing-topbar__menu" role="menu" aria-label="계정 메뉴">
                    <button
                      type="button"
                      className="landing-topbar__menu-item"
                      onClick={handleSettingsClick}
                      role="menuitem"
                    >
                      계정설정
                    </button>
                    <button
                      type="button"
                      className="landing-topbar__menu-item landing-topbar__menu-item--danger"
                      onClick={handleLogoutClick}
                      disabled={isLogoutLoading}
                      role="menuitem"
                    >
                      {isLogoutLoading ? "🚪 로그아웃 중..." : "🚪 로그아웃"}
                    </button>
                    {menuError ? (
                      <p className="landing-topbar__menu-error" role="alert">
                        {menuError}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <Link className="landing-topbar__account" to="/auth">
                로그인
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default LandingTopBar;
