import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getMobileBottomTabItems } from "../../data/headerNavigation";

function MobileTabBar() {
  const { currentUser } = useAuth();
  const homePath = currentUser ? "/" : "/landing";
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

  return (
    <nav className="service-tabbar">
      {tabs.map((tab) => (
        <NavLink
          key={tab.key}
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
