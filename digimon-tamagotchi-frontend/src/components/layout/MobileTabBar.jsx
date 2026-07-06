import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getMobileBottomTabItems } from "../../data/headerNavigation";
import {
  communityBoards,
  getCommunityBoardHref,
  resolveCommunityBoardId,
} from "../../data/serviceContent";

function MobileTabBar() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [isCommunityMenuOpen, setIsCommunityMenuOpen] = useState(false);
  const communityMenuRef = useRef(null);
  const communityTriggerRef = useRef(null);
  const homePath = currentUser ? "/" : "/landing";
  const activeCommunityBoardId = resolveCommunityBoardId(location.search);
  const isCommunityRoute = location.pathname === "/community";
  const iconByKey = {
    home: "🏠",
    play: "🕹️",
    community: "💬",
    me: "🧢",
  };
  const tabs = getMobileBottomTabItems({
    includeTamer: Boolean(currentUser),
    homePath,
  }).map((tab) => ({
    ...tab,
    icon: iconByKey[tab.key] || "•",
  }));

  useEffect(() => {
    setIsCommunityMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!isCommunityMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      const target = event.target;
      if (
        communityMenuRef.current?.contains(target) ||
        communityTriggerRef.current?.contains(target)
      ) {
        return;
      }

      setIsCommunityMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsCommunityMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCommunityMenuOpen]);

  return (
    <nav className="service-tabbar">
      {isCommunityMenuOpen ? (
        <div
          ref={communityMenuRef}
          className="service-tabbar-community-menu"
          role="menu"
          aria-label="커뮤니티 게시판 메뉴"
        >
          {communityBoards.map((board) => {
            const isActive = isCommunityRoute && board.id === activeCommunityBoardId;

            return (
              <Link
                key={board.id}
                to={getCommunityBoardHref(board.id)}
                role="menuitem"
                className={`service-tabbar-community-menu__link${
                  isActive ? " service-tabbar-community-menu__link--active" : ""
                }`}
                onClick={() => setIsCommunityMenuOpen(false)}
              >
                <strong>{board.title}</strong>
                <span>{board.status}</span>
              </Link>
            );
          })}
        </div>
      ) : null}

      {tabs.map((tab) => {
        if (tab.key === "community") {
          const className = `service-tabbar__item service-tabbar__item--button${
            isCommunityRoute ? " service-tabbar__item--active" : ""
          }${isCommunityMenuOpen ? " service-tabbar__item--open" : ""}`;

          return (
            <button
              key={tab.key}
              ref={communityTriggerRef}
              type="button"
              className={className}
              aria-haspopup="menu"
              aria-expanded={isCommunityMenuOpen}
              aria-label={tab.label}
              onClick={() => setIsCommunityMenuOpen((isOpen) => !isOpen)}
            >
              <span className="service-tabbar__icon" aria-hidden="true">
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          );
        }

        return (
          <NavLink
            key={tab.key}
            to={tab.to}
            end={tab.end}
            onClick={() => setIsCommunityMenuOpen(false)}
            className={({ isActive }) =>
              `service-tabbar__item${isActive ? " service-tabbar__item--active" : ""}`
            }
          >
            <span className="service-tabbar__icon" aria-hidden="true">
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export default MobileTabBar;
