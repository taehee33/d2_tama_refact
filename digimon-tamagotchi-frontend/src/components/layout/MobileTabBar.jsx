import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

function MobileTabBar() {
  const { currentUser } = useAuth();
  const homePath = currentUser ? "/" : "/landing";
  const tabs = [
    { to: homePath, label: "홈", icon: "🏠", end: true },
    { to: "/play", label: "플레이", icon: "🕹️" },
    { to: "/community", label: "커뮤니티", icon: "💬" },
    { to: "/me", label: "테이머(설정)", icon: "🧢", authOnly: true },
    { to: "/notebook", label: "노트북", icon: "💻" },
  ];

  return (
    <nav className="service-tabbar">
      {tabs
        .filter((tab) => !tab.authOnly || currentUser)
        .map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `service-tabbar__item${isActive ? " service-tabbar__item--active" : ""}`
            }
          >
            <span className="service-tabbar__icon" aria-hidden="true">
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
    </nav>
  );
}

export default MobileTabBar;
