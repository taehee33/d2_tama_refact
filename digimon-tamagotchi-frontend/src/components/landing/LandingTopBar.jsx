import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  getPrimaryHeaderNavItems,
  getMobileLandingOverflowItems,
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
  const location = useLocation();
  const displayTamerName = getDisplayTamerName(currentUser);
  const navItems = getPrimaryHeaderNavItems({ includeTamer: Boolean(currentUser) });
  const mobileMenuItems = getMobileLandingOverflowItems({
    includeTamer: Boolean(currentUser),
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef(null);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!mobileMenuRef.current?.contains(event.target)) {
        setIsMobileMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileMenuOpen]);

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
            <div className="landing-topbar__mobile-menu" ref={mobileMenuRef}>
              <button
                type="button"
                className={`landing-topbar__mobile-trigger${
                  isMobileMenuOpen ? " landing-topbar__mobile-trigger--open" : ""
                }`}
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={isMobileMenuOpen}
                aria-label="랜딩 모바일 더보기 메뉴"
              >
                더보기
              </button>

              {isMobileMenuOpen ? (
                <div
                  className="landing-topbar__mobile-panel"
                  role="menu"
                  aria-label="랜딩 모바일 더보기"
                >
                  {mobileMenuItems.map((item) => (
                    <NavLink
                      key={item.key}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `landing-topbar__mobile-link${
                          isActive ? " landing-topbar__mobile-link--active" : ""
                        }`
                      }
                      onClick={() => setIsMobileMenuOpen(false)}
                      role="menuitem"
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>

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
