import React from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

function getDisplayTamerName(currentUser) {
  return (
    currentUser?.displayName ||
    currentUser?.email?.split("@")[0] ||
    "익명의 테이머"
  );
}

const navItems = [
  { to: "/play", label: "플레이" },
  { to: "/guide", label: "가이드" },
  { to: "/community", label: "커뮤니티" },
  { to: "/news", label: "소식" },
  { to: "/notebook", label: "노트북" },
  { to: "/landing", label: "둘러보기", end: true },
];

export function LandingTopBar() {
  const { currentUser } = useAuth();
  const displayTamerName = getDisplayTamerName(currentUser);

  return (
    <header className="landing-topbar">
      <div className="landing-topbar__inner">
        <div className="landing-topbar__surface">
          <Link className="landing-topbar__brand" to={currentUser ? "/" : "/landing"}>
            <span className="landing-topbar__brand-mark" aria-hidden="true" />
            <span className="landing-topbar__brand-copy">
              <span className="landing-topbar__eyebrow">D2 TAMAGOTCHI</span>
              <span className="landing-topbar__title">디지몬 키우기</span>
            </span>
          </Link>

          <nav className="landing-topbar__nav" aria-label="랜딩 주요 이동">
            <div className="landing-topbar__nav-group">
              <Link className="landing-topbar__link" to="/">
                홈
              </Link>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
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
