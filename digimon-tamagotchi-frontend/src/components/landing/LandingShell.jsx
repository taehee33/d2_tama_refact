import React from "react";
import Landing from "../../pages/Landing";
import LandingTopBar from "./LandingTopBar";

function LandingShell({ tamerName = "" }) {
  return (
    <div className="landing-shell">
      <LandingTopBar tamerName={tamerName} />
      <Landing />
    </div>
  );
}

export default LandingShell;
