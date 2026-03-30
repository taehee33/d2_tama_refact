import React from "react";

function FolderYellowIcon() {
  return (
    <svg viewBox="0 0 128 96" aria-hidden="true">
      <path
        d="M16 24h34l10 12h52v40c0 8-6 14-14 14H16C8 90 2 84 2 76V38c0-8 6-14 14-14Z"
        fill="#ffe600"
        stroke="#111"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path d="M20 28h30l8 10H20Z" fill="#fff7a0" opacity="0.7" />
    </svg>
  );
}

function FolderBlueIcon() {
  return (
    <svg viewBox="0 0 128 96" aria-hidden="true">
      <path
        d="M16 24h34l10 12h52v40c0 8-6 14-14 14H16C8 90 2 84 2 76V38c0-8 6-14 14-14Z"
        fill="#93dcff"
        stroke="#111"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path d="M20 28h30l8 10H20Z" fill="#d9f5ff" opacity="0.72" />
    </svg>
  );
}

function StarOrangeIcon() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <path
        d="M60 6 76 42l38 4-29 25 9 37-33-19-33 19 9-37L8 46l38-4Z"
        fill="#ff7b17"
        stroke="#111"
        strokeWidth="6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function renderIcon(icon) {
  if (icon === "folder-yellow") {
    return <FolderYellowIcon />;
  }

  if (icon === "folder-blue") {
    return <FolderBlueIcon />;
  }

  return <StarOrangeIcon />;
}

function DesktopIcon({ icon, label, description, isActive, onClick }) {
  return (
    <button
      type="button"
      className={`notebook-desktop-icon${isActive ? " notebook-desktop-icon--active" : ""}`}
      onClick={onClick}
      title={description}
      aria-pressed={isActive}
    >
      <span className="notebook-desktop-icon__graphic">{renderIcon(icon)}</span>
      <span className="notebook-desktop-icon__label">{label}</span>
    </button>
  );
}

export default DesktopIcon;
