import React from "react";
import { Outlet } from "react-router-dom";
import MobileTabBar from "./MobileTabBar";
import TopNavigation from "./TopNavigation";

function ServiceLayout() {
  return (
    <div className="service-shell">
      <div className="service-shell__backdrop" aria-hidden="true" />
      <TopNavigation />
      <main className="service-shell__main">
        <Outlet />
      </main>
      <MobileTabBar />
    </div>
  );
}

export default ServiceLayout;
