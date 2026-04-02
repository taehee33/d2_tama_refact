import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  communityBoards,
  getCommunityBoardHref,
  resolveCommunityBoardId,
} from "../../data/serviceContent";
import NotebookTopBar from "../home/NotebookTopBar";

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
  const isCommunityRoute = location.pathname === "/community";
  const activeCommunityBoardId = resolveCommunityBoardId(location.search);
  const homePath = currentUser ? "/" : "/landing";
  const links = [
    { to: homePath, label: "홈" },
    { to: "/play", label: "플레이" },
    { to: "/guide", label: "가이드" },
    { id: "community", label: "커뮤니티" },
    { to: "/news", label: "소식" },
  ];
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isCommunityMenuOpen, setIsCommunityMenuOpen] = useState(false);
  const [isLogoutLoading, setIsLogoutLoading] = useState(false);
  const [menuError, setMenuError] = useState("");
  const accountMenuRef = useRef(null);
  const communityMenuRef = useRef(null);
  const displayTamerName = getDisplayTamerName(currentUser, tamerName);

  useEffect(() => {
    setIsAccountMenuOpen(false);
    setIsCommunityMenuOpen(false);
    setMenuError("");
  }, [location.pathname, location.search]);

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

  useEffect(() => {
    if (!isCommunityMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!communityMenuRef.current?.contains(event.target)) {
        setIsCommunityMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsCommunityMenuOpen(false);
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
  }, [isCommunityMenuOpen]);

  const handleAccountMenuToggle = () => {
    setMenuError("");
    setIsCommunityMenuOpen(false);
    setIsAccountMenuOpen((prev) => !prev);
  };

  const handleCommunityMenuToggle = () => {
    setMenuError("");
    setIsAccountMenuOpen(false);
    setIsCommunityMenuOpen((prev) => !prev);
  };

  const handleCloseCommunityMenu = () => {
    setIsCommunityMenuOpen(false);
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
        <Link className="service-brand" to={homePath}>
          <span className="service-brand__eyebrow">D2 TAMAGOTCHI</span>
          <span className="service-brand__title">디지몬 키우기</span>
        </Link>

        <nav className="service-nav">
          {links.map((link) => (
            link.id === "community" ? (
              <div
                key={link.id}
                className="service-nav__item service-nav__item--menu"
                ref={communityMenuRef}
              >
                <button
                  type="button"
                  className={`service-nav__link service-nav__link--button${
                    isCommunityRoute ? " service-nav__link--active" : ""
                  }${isCommunityMenuOpen ? " service-nav__link--open" : ""}`}
                  onClick={handleCommunityMenuToggle}
                  aria-haspopup="menu"
                  aria-expanded={isCommunityMenuOpen}
                  aria-label="커뮤니티"
                >
                  {link.label}
                </button>

                {isCommunityMenuOpen ? (
                  <div
                    className="service-nav__dropdown"
                    role="menu"
                    aria-label="커뮤니티 게시판 메뉴"
                  >
                    {communityBoards.map((board) => {
                      const isActiveBoard =
                        isCommunityRoute && board.id === activeCommunityBoardId;

                      return (
                        <Link
                          key={board.id}
                          to={getCommunityBoardHref(board.id)}
                          className={`service-nav__dropdown-link${
                            isActiveBoard
                              ? " service-nav__dropdown-link--active"
                              : ""
                          }`}
                          onClick={handleCloseCommunityMenu}
                        >
                          <strong>{board.title}</strong>
                          <span>{board.status}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === homePath}
                className={({ isActive }) =>
                  `service-nav__link${isActive ? " service-nav__link--active" : ""}`
                }
              >
                {link.label}
              </NavLink>
            )
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
          {currentUser ? (
            <NavLink
              to="/landing"
              className={({ isActive }) =>
                `service-nav__link${isActive ? " service-nav__link--active" : ""}`
              }
            >
              둘러보기
            </NavLink>
          ) : null}
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
