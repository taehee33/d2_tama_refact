import React from "react";

export function StatusBar({ label, value, tone = "blue" }) {
  return (
    <div className="landing-status-bar">
      <div className="landing-status-bar__meta">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="landing-status-bar__track" aria-hidden="true">
        <span
          className={`landing-status-bar__fill landing-status-bar__fill--${tone}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export default StatusBar;
