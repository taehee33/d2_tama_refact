import React from "react";
import ImmersiveDeviceShell from "./ImmersiveDeviceShell";
import ImmersiveLandscapeControls from "./ImmersiveLandscapeControls";
import ImmersiveLandscapeFrameStage from "./ImmersiveLandscapeFrameStage";

function ImmersiveLandscapeSection({
  deviceShellProps = {},
  hasLandscapeFrameSkin = false,
  immersiveSkin,
  controlsProps = {},
  renderLandscapeGameScreen = () => null,
  slotMeta = {},
  statusNode = null,
  supportActionsNode = null,
}) {
  const shellLayoutMode = deviceShellProps.layoutMode || "landscape";
  const shellSkinId =
    deviceShellProps.skinId || immersiveSkin?.id || "tama-default-none";
  const shellLandscapeSide = deviceShellProps.landscapeSide || "right";
  const shellLandscapeSideMode = deviceShellProps.landscapeSideMode || "auto";
  const shouldRenderInlineInfo = !hasLandscapeFrameSkin;
  const shouldUseFrameSideControls =
    hasLandscapeFrameSkin && !deviceShellProps.showRotateHint;

  const slotId = slotMeta.slotId ?? slotMeta.slotNumber ?? null;
  const slotVersion = slotMeta.normalizedSlotVersion ?? slotMeta.slotVersion ?? null;
  const slotName = slotMeta.slotName ?? null;

  return (
    <ImmersiveDeviceShell
      {...deviceShellProps}
      layoutMode={shellLayoutMode}
      skinId={shellSkinId}
      landscapeSide={shellLandscapeSide}
      landscapeSideMode={shellLandscapeSideMode}
    >
      <div
        className={`immersive-landscape-layout ${
          hasLandscapeFrameSkin ? "immersive-landscape-layout--frame-skin" : ""
        } immersive-landscape-layout--side-${shellLandscapeSide}`.trim()}
        data-testid="immersive-landscape-layout"
        data-slot-id={slotId ?? undefined}
        data-slot-version={slotVersion ?? undefined}
        data-slot-name={slotName ?? undefined}
      >
        <div
          className={`immersive-landscape-display ${
            hasLandscapeFrameSkin
              ? "immersive-landscape-display--frame-skin"
              : ""
          }`.trim()}
        >
          {hasLandscapeFrameSkin ? (
            shouldUseFrameSideControls ? (
              <div className="immersive-landscape-frame-shell">
                <ImmersiveLandscapeFrameStage
                  skin={immersiveSkin}
                  renderScreen={renderLandscapeGameScreen}
                />
                <ImmersiveLandscapeControls
                  {...controlsProps}
                  layout="sidebar"
                />
              </div>
            ) : (
              <>
                <ImmersiveLandscapeControls
                  {...controlsProps}
                  layout="strip"
                  groupId="basic"
                />
                <ImmersiveLandscapeFrameStage
                  skin={immersiveSkin}
                  renderScreen={renderLandscapeGameScreen}
                />
                <ImmersiveLandscapeControls
                  {...controlsProps}
                  layout="strip"
                  groupId="care"
                />
              </>
            )
          ) : (
            <div className="immersive-landscape-display__lcd">
              {renderLandscapeGameScreen()}
            </div>
          )}
          {shouldRenderInlineInfo ? statusNode : null}
          {shouldRenderInlineInfo ? supportActionsNode : null}
        </div>
        {!hasLandscapeFrameSkin ? (
          <ImmersiveLandscapeControls {...controlsProps} layout="panel" />
        ) : null}
      </div>
    </ImmersiveDeviceShell>
  );
}

export default ImmersiveLandscapeSection;
