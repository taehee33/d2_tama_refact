import React, { forwardRef } from "react";
import ImmersiveChatOverlay from "../chat/ImmersiveChatOverlay";
import ImmersiveGameTopBar from "./ImmersiveGameTopBar";
import ImmersiveSkinPicker from "./ImmersiveSkinPicker";

const ImmersiveGameView = forwardRef(function ImmersiveGameView(
  {
    isMobile = false,
    layoutMode = "portrait",
    isVirtualLandscapeActive = false,
    virtualLandscapeDirection = "right",
    topBarNode = null,
    topBarProps = null,
    orientationStatusNode = null,
    orientationStatusMessage = null,
    orientationStatusTone = "success",
    virtualLandscapePromptNode = null,
    virtualLandscapePromptMessage = null,
    showVirtualLandscapePrompt = false,
    onConfirmVirtualLandscape,
    onDismissVirtualLandscape,
    chatOverlayNode = null,
    chatOverlayProps = null,
    skinPickerNode = null,
    skinPickerProps = null,
    portraitContentNode = null,
    landscapeContentNode = null,
    className = "",
  },
  ref
) {
  const isLandscape = layoutMode === "landscape";
  const shouldUseVirtualLandscape =
    isMobile && isLandscape && isVirtualLandscapeActive;
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
  const resolvedSkinPickerNode =
    skinPickerNode ||
    (skinPickerProps ? <ImmersiveSkinPicker {...skinPickerProps} /> : null);
  const resolvedVirtualLandscapePromptNode =
    virtualLandscapePromptNode ||
    (showVirtualLandscapePrompt ? (
      <div className="immersive-game-view__virtual-prompt">
        <div
          className="immersive-game-view__virtual-prompt-backdrop"
          onClick={onDismissVirtualLandscape}
          aria-hidden="true"
        />
        <div
          className="immersive-game-view__virtual-prompt-card"
          role="dialog"
          aria-modal="true"
          aria-label="가상 가로 모드 확인"
        >
          <strong>가상 가로 모드</strong>
          <p>{virtualLandscapePromptMessage}</p>
          <div className="immersive-game-view__virtual-prompt-actions">
            <button
              type="button"
              className="immersive-game-view__virtual-prompt-button immersive-game-view__virtual-prompt-button--primary"
              onClick={onConfirmVirtualLandscape}
            >
              가상 가로 시작
            </button>
            <button
              type="button"
              className="immersive-game-view__virtual-prompt-button immersive-game-view__virtual-prompt-button--secondary"
              onClick={onDismissVirtualLandscape}
            >
              취소
            </button>
          </div>
        </div>
      </div>
    ) : null);
  const stageContent = isLandscape ? landscapeContentNode : portraitContentNode;

  return (
    <section
      ref={ref}
      className={`immersive-mode-root immersive-game-view immersive-game-view--${layoutMode} ${
        shouldUseVirtualLandscape ? "immersive-game-view--virtual-landscape" : ""
      } ${className}`.trim()}
      data-testid="immersive-game-view"
      data-layout-mode={layoutMode}
      data-virtual-landscape={shouldUseVirtualLandscape ? "true" : "false"}
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

      {resolvedSkinPickerNode ? (
        <div className="immersive-game-view__skin-picker" data-testid="immersive-game-view-skin-picker">
          {resolvedSkinPickerNode}
        </div>
      ) : null}

      {resolvedVirtualLandscapePromptNode ? (
        <div
          className="immersive-game-view__virtual-prompt-layer"
          data-testid="immersive-game-view-virtual-prompt"
        >
          {resolvedVirtualLandscapePromptNode}
        </div>
      ) : null}

      <div
        className={`immersive-game-shell immersive-game-view__stage ${
          shouldUseVirtualLandscape ? "immersive-game-view__stage--virtual-landscape" : ""
        }`.trim()}
        data-testid="immersive-game-view-stage"
      >
        {shouldUseVirtualLandscape ? (
          <div
            className="immersive-game-view__virtual-stage-shell"
            data-testid="immersive-game-view-virtual-stage-shell"
          >
            <div
              className={`immersive-game-view__virtual-stage-surface immersive-game-view__virtual-stage-surface--${virtualLandscapeDirection}`.trim()}
              data-testid="immersive-game-view-virtual-stage-surface"
              data-virtual-direction={virtualLandscapeDirection}
            >
              {stageContent}
            </div>
          </div>
        ) : (
          stageContent
        )}
      </div>
    </section>
  );
});

export default ImmersiveGameView;
