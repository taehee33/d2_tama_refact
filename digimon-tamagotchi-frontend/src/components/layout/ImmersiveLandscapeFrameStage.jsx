import React, { useEffect, useMemo, useRef, useState } from "react";

const GAME_SCREEN_ASPECT_RATIO = 3 / 2;
const FALLBACK_SCREEN_SIZE = Object.freeze({
  width: 300,
  height: 200,
});

function getContainedGameScreenSize(boundsWidth, boundsHeight) {
  if (!(boundsWidth > 0) || !(boundsHeight > 0)) {
    return { ...FALLBACK_SCREEN_SIZE };
  }

  let width = Math.floor(
    Math.min(boundsWidth, boundsHeight * GAME_SCREEN_ASPECT_RATIO)
  );
  let height = Math.floor(width / GAME_SCREEN_ASPECT_RATIO);

  if (height > boundsHeight) {
    height = Math.floor(boundsHeight);
    width = Math.floor(height * GAME_SCREEN_ASPECT_RATIO);
  }

  return {
    width: Math.max(width, 1),
    height: Math.max(height, 1),
  };
}

function ImmersiveLandscapeFrameStage({ skin, renderScreen }) {
  const viewportRef = useRef(null);
  const [screenSize, setScreenSize] = useState(FALLBACK_SCREEN_SIZE);
  const viewportStyle = useMemo(
    () => ({
      left: `${skin.landscapeViewport.leftPct}%`,
      top: `${skin.landscapeViewport.topPct}%`,
      width: `${skin.landscapeViewport.widthPct}%`,
      height: `${skin.landscapeViewport.heightPct}%`,
    }),
    [skin]
  );

  useEffect(() => {
    const viewportNode = viewportRef.current;

    if (!viewportNode) {
      return undefined;
    }

    const updateScreenSize = () => {
      const bounds = viewportNode.getBoundingClientRect();
      setScreenSize(getContainedGameScreenSize(bounds.width, bounds.height));
    };

    updateScreenSize();

    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(updateScreenSize);
      observer.observe(viewportNode);

      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateScreenSize);

    return () => window.removeEventListener("resize", updateScreenSize);
  }, [skin]);

  return (
    <div
      className="immersive-landscape-frame-stage"
      data-skin-id={skin.id}
      data-testid="immersive-landscape-frame-stage"
    >
      <img
        src={skin.landscapeFrameSrc}
        alt={`${skin.name} 디바이스 프레임`}
        className="immersive-landscape-frame-stage__image"
      />
      <div
        ref={viewportRef}
        className="immersive-landscape-frame-stage__viewport"
        style={viewportStyle}
        data-testid="immersive-landscape-frame-viewport"
      >
        <div
          className="immersive-landscape-frame-stage__screen"
          style={{
            width: `${screenSize.width}px`,
            height: `${screenSize.height}px`,
          }}
        >
          {renderScreen(screenSize)}
        </div>
      </div>
    </div>
  );
}

export default ImmersiveLandscapeFrameStage;
