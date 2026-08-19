import React from "react";
import { buildCommunitySnapshotVisual } from "../../utils/communitySnapshotUtils";
import { normalizeSleepStatusForDisplay } from "../../utils/callStatusUtils";
import {
  GAME_SCENE_ASPECT_RATIO,
  getDefaultDigimonSceneStyle,
} from "../../utils/gameSceneGeometry";

const DEFAULT_DIGIMON_SCENE_STYLE = getDefaultDigimonSceneStyle();

function CommunitySnapshotScene({ snapshot, variant = "card" }) {
  const visual = buildCommunitySnapshotVisual(snapshot);
  const sleepStatus = normalizeSleepStatusForDisplay(visual.sleepStatus);

  if (!visual) {
    return null;
  }

  const showOverlay = variant === "composer";
  const sceneBadges = [];

  if (visual.isFrozen) {
    sceneBadges.push({ key: "frozen", label: "냉장고", tone: "cool" });
  } else if (sleepStatus === "NAPPING") {
    sceneBadges.push({ key: "napping", label: "낮잠", tone: "sleep" });
  } else if (sleepStatus === "SLEEPING") {
    sceneBadges.push({ key: "sleeping", label: "Zzz...", tone: "sleep" });
  } else if (sleepStatus === "SLEEPING_LIGHT_ON") {
    sceneBadges.push({ key: "sleeping-light-on", label: "불 켜짐 경고!", tone: "warn" });
  } else if (sleepStatus === "FALLING_ASLEEP") {
    sceneBadges.push({ key: "falling-asleep", label: "잠들기 준비", tone: "warn" });
  } else if (sleepStatus === "AWAKE_INTERRUPTED") {
    sceneBadges.push({ key: "awake-interrupted", label: "강제 기상", tone: "warn" });
  }

  if (visual.isDead) {
    sceneBadges.push({ key: "dead", label: "사망", tone: "danger" });
  } else if (visual.isInjured) {
    sceneBadges.push({ key: "injured", label: "치료 필요", tone: "danger" });
  }

  return (
    <div
      className={`community-scene community-scene--${variant}`}
      style={{ "--community-scene-aspect-ratio": GAME_SCENE_ASPECT_RATIO }}
    >
      <img
        src={`/images/${visual.backgroundNumber}.png`}
        alt="커뮤니티 배경"
        className="community-scene__background"
        style={{ objectFit: "fill" }}
      />

      {!visual.isLightsOn ? <div className="community-scene__lights-off" /> : null}

      <div
        className="community-scene__sprite-shell"
        style={DEFAULT_DIGIMON_SCENE_STYLE}
      >
        <img
          src={visual.spriteSrc}
          alt={snapshot?.digimonDisplayName || "디지몬 스냅샷"}
          className="community-scene__sprite"
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      {showOverlay && sceneBadges.length ? (
        <div className="community-scene__badge-row">
          {sceneBadges.map((badge) => (
            <span
              key={badge.key}
              className={`community-scene__badge community-scene__badge--${badge.tone}`}
            >
              {badge.label}
            </span>
          ))}
        </div>
      ) : null}

      {showOverlay ? (
        <div className="community-scene__caption">
          <strong>{snapshot?.digimonDisplayName || "디지몬"}</strong>
          <span>
            {snapshot?.stageLabel || "단계 미상"} · {snapshot?.version || "Ver.1"}
          </span>
          <span>{snapshot?.slotName || "슬롯"}</span>
        </div>
      ) : null}
    </div>
  );
}

export default CommunitySnapshotScene;
