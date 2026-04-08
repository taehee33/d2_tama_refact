import React from "react";

function ImmersiveDeviceShell({
  layoutMode = "portrait",
  skinId = "tama-default-none",
  isMobile = false,
  showRotateHint = false,
  landscapeSide = "right",
  landscapeSideMode = "auto",
  children,
}) {
  return (
    <section
      className={`immersive-device-shell immersive-device-shell--${layoutMode} ${
        isMobile ? "immersive-device-shell--mobile" : ""
      } ${showRotateHint ? "immersive-device-shell--rotate-hint" : ""}`.trim()}
      data-skin-id={skinId}
      data-landscape-side={layoutMode === "landscape" ? landscapeSide : undefined}
      data-landscape-side-mode={layoutMode === "landscape" ? landscapeSideMode : undefined}
    >
      <div className="immersive-device-shell__frame">
        <div className="immersive-device-shell__shine" aria-hidden="true" />
        <div className="immersive-device-shell__content">{children}</div>
        <div className="immersive-device-shell__hardware" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
      {showRotateHint ? (
        <p className="immersive-device-shell__rotate-hint" role="note">
          세로로 들고 있다면 왼쪽이나 오른쪽으로 돌리면 더 디지바이스답게 볼 수 있어요.
        </p>
      ) : null}
    </section>
  );
}

export default ImmersiveDeviceShell;
