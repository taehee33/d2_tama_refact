import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const tabs = [
  { to: "/", label: "홈", icon: "🏠" },
  { to: "/play", label: "플레이", icon: "🕹️" },
  { to: "/community", label: "커뮤니티", icon: "💬" },
  { to: "/me", label: "마이", icon: "🧢", authOnly: true },
];

function MobileTabBar() {
  const { currentUser } = useAuth();

  return (
    <nav className="service-tabbar">
      {tabs
        .filter((tab) => !tab.authOnly || currentUser)
        .map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
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
