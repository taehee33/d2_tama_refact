import React from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  getPrimaryHeaderNavItems,
  HEADER_APP_ICON_SRC,
} from "../../data/headerNavigation";

function getDisplayTamerName(currentUser) {
  return (
    currentUser?.displayName ||
    currentUser?.email?.split("@")[0] ||
    "익명의 테이머"
  );
}

export function LandingTopBar() {
  const { currentUser } = useAuth();
  const displayTamerName = getDisplayTamerName(currentUser);
  const navItems = getPrimaryHeaderNavItems({ includeTamer: Boolean(currentUser) });

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
            {currentUser ? (
              <Link className="landing-topbar__account" to="/me">
                <span>{displayTamerName}</span>
                <span aria-hidden="true">▾</span>
              </Link>
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
