import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import NotebookTopBar from "../home/NotebookTopBar";

const links = [
  { to: "/", label: "홈" },
  { to: "/play", label: "플레이" },
  { to: "/guide", label: "가이드" },
  { to: "/community", label: "커뮤니티" },
  { to: "/news", label: "소식" },
];

function getDisplayTamerName(currentUser, tamerName) {
  return (
    tamerName ||
    currentUser?.displayName ||
    currentUser?.email?.split("@")[0] ||
    "익명의 테이머"
  );
}

function TopNavigation({ tamerName = "" }) {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isNotebookRoute = location.pathname === "/notebook";
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isLogoutLoading, setIsLogoutLoading] = useState(false);
  const [menuError, setMenuError] = useState("");
  const accountMenuRef = useRef(null);
  const displayTamerName = getDisplayTamerName(currentUser, tamerName);

  useEffect(() => {
    setIsAccountMenuOpen(false);
    setMenuError("");
  }, [location.pathname]);

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) {
        setIsAccountMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsAccountMenuOpen(false);
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
  }, [isAccountMenuOpen]);

  const handleAccountMenuToggle = () => {
    setMenuError("");
    setIsAccountMenuOpen((prev) => !prev);
  };

  const handleSettingsClick = () => {
    setIsAccountMenuOpen(false);
    navigate("/me/settings");
  };

  const handleLogoutClick = async () => {
    setIsLogoutLoading(true);
    setMenuError("");

    try {
      await logout();
      setIsAccountMenuOpen(false);
      navigate("/auth");
    } catch (error) {
      setMenuError(error.message || "로그아웃 중 오류가 발생했습니다.");
    } finally {
      setIsLogoutLoading(false);
    }
  };

  if (isNotebookRoute) {
    return <NotebookTopBar />;
  }

  return (
    <header className="service-topnav">
      <div className="service-topnav__inner">
        <Link className="service-brand" to="/">
          <span className="service-brand__eyebrow">D2 TAMAGOTCHI</span>
          <span className="service-brand__title">디지몬 키우기</span>
        </Link>

        <nav className="service-nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `service-nav__link${isActive ? " service-nav__link--active" : ""}`
              }
            >
              {link.label}
            </NavLink>
          ))}
          {currentUser && (
            <NavLink
              to="/me"
              className={({ isActive }) =>
                `service-nav__link${isActive ? " service-nav__link--active" : ""}`
              }
            >
              마이
            </NavLink>
          )}
          <NavLink
            to="/notebook"
            className={({ isActive }) =>
              `service-nav__link${isActive ? " service-nav__link--active" : ""}`
            }
          >
            노트북
          </NavLink>
        </nav>

        <div className="service-topnav__actions">
          {currentUser ? (
            <div className="service-topnav__account" ref={accountMenuRef}>
              <button
                type="button"
                className={`service-topnav__cta service-topnav__cta--account${
                  isAccountMenuOpen ? " service-topnav__cta--open" : ""
                }`}
                onClick={handleAccountMenuToggle}
                aria-haspopup="menu"
                aria-expanded={isAccountMenuOpen}
                aria-label={`${displayTamerName} 계정 메뉴`}
              >
                <span className="service-topnav__account-name">{displayTamerName}</span>
                <span className="service-topnav__account-caret" aria-hidden="true">
                  {isAccountMenuOpen ? "▴" : "▾"}
                </span>
              </button>

              {isAccountMenuOpen ? (
                <div className="service-topnav__menu" role="menu" aria-label="계정 메뉴">
                  <button
                    type="button"
                    className="service-topnav__menu-item"
                    onClick={handleSettingsClick}
                    role="menuitem"
                  >
                    계정설정
                  </button>
                  <button
                    type="button"
                    className="service-topnav__menu-item service-topnav__menu-item--danger"
                    onClick={handleLogoutClick}
                    disabled={isLogoutLoading}
                    role="menuitem"
                  >
                    {isLogoutLoading ? "로그아웃 중..." : "로그아웃"}
                  </button>
                  {menuError ? (
                    <p className="service-topnav__menu-error" role="alert">
                      {menuError}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <Link className="service-topnav__cta" to="/auth">
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export default TopNavigation;
