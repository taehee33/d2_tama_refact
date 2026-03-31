import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useTheme } from "../../contexts/ThemeContext";
import MobileTabBar from "./MobileTabBar";
import TopNavigation from "./TopNavigation";

function ServiceLayout({ tamerName = "" }) {
  const location = useLocation();
  const { resolvedTheme } = useTheme();
  const isNotebookRoute = location.pathname === "/notebook";
  const shellClassName = isNotebookRoute
    ? "service-shell service-shell--notebook"
    : `service-shell service-shell--theme-${resolvedTheme}`;

  return (
    <div className={shellClassName}>
      <div className="service-shell__backdrop" aria-hidden="true" />
      <TopNavigation tamerName={tamerName} />
      <main
        className={`service-shell__main${
          isNotebookRoute ? " service-shell__main--notebook" : ""
        }`}
      >
        <Outlet />
      </main>
      <MobileTabBar />
    </div>
  );
}

export default ServiceLayout;
