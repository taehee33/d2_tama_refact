import React from "react";
import Landing from "../../pages/Landing";
import LandingTopBar from "./LandingTopBar";

function LandingShell() {
  return (
    <div className="landing-shell">
      <LandingTopBar />
      <Landing />
    </div>
  );
}

export default LandingShell;
