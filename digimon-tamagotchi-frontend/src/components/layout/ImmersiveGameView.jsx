import React, { forwardRef } from "react";
import ImmersiveChatOverlay from "../chat/ImmersiveChatOverlay";
import ImmersiveGameTopBar from "./ImmersiveGameTopBar";
import ImmersiveLandscapeActionViewer from "./ImmersiveLandscapeActionViewer";
import ImmersiveLandscapeInfoOverlay from "./ImmersiveLandscapeInfoOverlay";
import ImmersiveSkinPicker from "./ImmersiveSkinPicker";

const ImmersiveGameView = forwardRef(function ImmersiveGameView(
  {
    layoutMode = "portrait",
    topBarNode = null,
    topBarProps = null,
    orientationStatusNode = null,
    orientationStatusMessage = null,
    orientationStatusTone = "success",
    chatOverlayNode = null,
    chatOverlayProps = null,
    actionViewerNode = null,
    actionViewerProps = null,
    landscapeInfoOverlayNode = null,
    landscapeInfoOverlayProps = null,
    skinPickerNode = null,
    skinPickerProps = null,
    portraitContentNode = null,
    landscapeContentNode = null,
    className = "",
  },
  ref
) {
  const isLandscape = layoutMode === "landscape";
  const resolvedTopBarNode =
    topBarNode || (topBarProps ? <ImmersiveGameTopBar {...topBarProps} /> : null);
  const resolvedOrientationStatusNode =
    orientationStatusNode ||
    (orientationStatusMessage ? (
      <div
        className={`immersive-orientation-status immersive-orientation-status--${orientationStatusTone}`.trim()}
        role="status"
        aria-live="polite"
      >
        {orientationStatusMessage}
      </div>
    ) : null);
  const resolvedChatOverlayNode =
    chatOverlayNode ||
    (chatOverlayProps ? <ImmersiveChatOverlay {...chatOverlayProps} /> : null);
  const resolvedActionViewerNode =
    actionViewerNode ||
    (actionViewerProps ? (
      <ImmersiveLandscapeActionViewer {...actionViewerProps} />
    ) : null);
  const resolvedLandscapeInfoOverlayNode =
    landscapeInfoOverlayNode ||
    (landscapeInfoOverlayProps ? (
      <ImmersiveLandscapeInfoOverlay {...landscapeInfoOverlayProps} />
    ) : null);
  const resolvedSkinPickerNode =
    skinPickerNode ||
    (skinPickerProps ? <ImmersiveSkinPicker {...skinPickerProps} /> : null);
  const stageContent = isLandscape ? landscapeContentNode : portraitContentNode;

  return (
    <section
      ref={ref}
      className={`immersive-mode-root immersive-game-view immersive-game-view--${layoutMode} ${className}`.trim()}
      data-testid="immersive-game-view"
      data-layout-mode={layoutMode}
    >
      {resolvedTopBarNode ? (
        <div className="immersive-game-view__top-bar" data-testid="immersive-game-view-top-bar">
          {resolvedTopBarNode}
        </div>
      ) : null}

      {resolvedOrientationStatusNode ? (
        <div className="immersive-game-view__orientation-status" data-testid="immersive-game-view-orientation-status">
          {resolvedOrientationStatusNode}
        </div>
      ) : null}

      {resolvedChatOverlayNode ? (
        <div className="immersive-game-view__chat-overlay" data-testid="immersive-game-view-chat-overlay">
          {resolvedChatOverlayNode}
        </div>
      ) : null}

      {resolvedActionViewerNode ? (
        <div
          className="immersive-game-view__action-viewer"
          data-testid="immersive-game-view-action-viewer"
        >
          {resolvedActionViewerNode}
        </div>
      ) : null}

      {resolvedLandscapeInfoOverlayNode ? (
        <div
          className="immersive-game-view__landscape-info-overlay"
          data-testid="immersive-game-view-landscape-info-overlay"
        >
          {resolvedLandscapeInfoOverlayNode}
        </div>
      ) : null}

      {resolvedSkinPickerNode ? (
        <div className="immersive-game-view__skin-picker" data-testid="immersive-game-view-skin-picker">
          {resolvedSkinPickerNode}
        </div>
      ) : null}

      <div
        className="immersive-game-shell immersive-game-view__stage"
        data-testid="immersive-game-view-stage"
      >
        {stageContent}
      </div>
    </section>
  );
});

export default ImmersiveGameView;
