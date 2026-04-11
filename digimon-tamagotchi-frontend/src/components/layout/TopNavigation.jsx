import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  communityBoards,
  getCommunityBoardHref,
  resolveCommunityBoardId,
} from "../../data/serviceContent";
import {
  getPrimaryHeaderNavItems,
  getMobileServiceOverflowItems,
  HEADER_APP_ICON_SRC,
} from "../../data/headerNavigation";
import { useHeaderAccountMenu } from "../../hooks/useHeaderAccountMenu";
import NotebookTopBar from "../home/NotebookTopBar";

function TopNavigation({ tamerName = "" }) {
  const location = useLocation();
  const {
    currentUser,
    displayTamerName,
    isAccountMenuOpen,
    isLogoutLoading,
    menuError,
    accountMenuRef,
    toggleAccountMenu,
    closeAccountMenu,
    handleSettingsClick,
    handleLogoutClick,
  } = useHeaderAccountMenu({ tamerName });
  const isNotebookRoute = location.pathname === "/notebook";
  const isCommunityRoute = location.pathname === "/community";
  const activeCommunityBoardId = resolveCommunityBoardId(location.search);
  const homePath = currentUser ? "/" : "/landing";
  const links = getPrimaryHeaderNavItems({ includeTamer: Boolean(currentUser) });
  const mobileOverflowItems = getMobileServiceOverflowItems();
  const [isCommunityMenuOpen, setIsCommunityMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const communityMenuRef = useRef(null);
  const mobileMenuRef = useRef(null);

  useEffect(() => {
    setIsCommunityMenuOpen(false);
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.search]);

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

  const handleAccountMenuToggle = () => {
    setIsCommunityMenuOpen(false);
    setIsMobileMenuOpen(false);
    toggleAccountMenu();
  };

  const handleCommunityMenuToggle = () => {
    closeAccountMenu();
    setIsMobileMenuOpen(false);
    setIsCommunityMenuOpen((prev) => !prev);
  };

  const handleCloseCommunityMenu = () => {
    setIsCommunityMenuOpen(false);
  };

  const handleMobileMenuToggle = () => {
    closeAccountMenu();
    setIsCommunityMenuOpen(false);
    setIsMobileMenuOpen((prev) => !prev);
  };

  const handleCloseMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  if (isNotebookRoute) {
    return <NotebookTopBar />;
  }

  return (
    <header className="service-topnav">
      <div className="service-topnav__inner">
        <Link className="service-brand" to={homePath}>
          <span className="service-brand__mark" aria-hidden="true">
            <img
              className="service-brand__mark-image"
              src={HEADER_APP_ICON_SRC}
              alt=""
            />
          </span>
          <span className="service-brand__copy">
            <span className="service-brand__eyebrow">Digimon THamagotchi</span>
            <span className="service-brand__title">디지몬 키우기</span>
          </span>
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
                end={link.end}
                className={({ isActive }) =>
                  `service-nav__link${isActive ? " service-nav__link--active" : ""}`
                }
              >
                {link.label}
              </NavLink>
            )
          ))}
        </nav>

        <div className="service-topnav__actions">
          <div className="service-topnav__mobile-menu" ref={mobileMenuRef}>
            <button
              type="button"
              className={`service-topnav__mobile-trigger${
                isMobileMenuOpen ? " service-topnav__mobile-trigger--open" : ""
              }`}
              onClick={handleMobileMenuToggle}
              aria-haspopup="menu"
              aria-expanded={isMobileMenuOpen}
              aria-label="모바일 더보기 메뉴"
            >
              더보기
            </button>

            {isMobileMenuOpen ? (
              <div
                className="service-topnav__mobile-panel"
                role="menu"
                aria-label="모바일 더보기"
              >
                {mobileOverflowItems.map((item) => (
                  <NavLink
                    key={item.key}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `service-topnav__mobile-link${
                        isActive ? " service-topnav__mobile-link--active" : ""
                      }`
                    }
                    onClick={handleCloseMobileMenu}
                    role="menuitem"
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ) : null}
          </div>

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
                    {isLogoutLoading ? "🚪 로그아웃 중..." : "🚪 로그아웃"}
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
