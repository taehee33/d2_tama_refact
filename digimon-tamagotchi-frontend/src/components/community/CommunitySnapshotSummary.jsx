import React from "react";
import { buildCommunitySnapshotVisual } from "../../utils/communitySnapshotUtils";
import { normalizeSleepStatusForDisplay } from "../../utils/callStatusUtils";

function getSnapshotStatusItems(visual) {
  if (!visual) {
    return [];
  }

  const items = [];
  const sleepStatus = normalizeSleepStatusForDisplay(visual.sleepStatus);

  if (!visual.isLightsOn) {
    items.push("불 꺼짐");
  }

  if (visual.isFrozen) {
    items.push("냉장고");
  } else if (sleepStatus === "NAPPING") {
    items.push("낮잠 중");
  } else if (sleepStatus === "SLEEPING") {
    items.push("수면 중");
  } else if (sleepStatus === "SLEEPING_LIGHT_ON") {
    items.push("수면 중(불 켜짐 경고)");
  } else if (sleepStatus === "FALLING_ASLEEP") {
    items.push("잠들기 준비 중");
  } else if (sleepStatus === "AWAKE_INTERRUPTED") {
    items.push("강제 기상 중");
  }

  if (visual.isDead) {
    items.push("사망");
  } else if (visual.isInjured) {
    items.push("치료 필요");
  }

  if ((visual.poopCount || 0) > 0) {
    items.push(`똥 ${visual.poopCount}개`);
  }

  return items;
}

function CommunitySnapshotSummary({ snapshot = {}, variant = "card" }) {
  const visual = buildCommunitySnapshotVisual(snapshot);
  const digimonDisplayName =
    snapshot.digimonDisplayName || visual?.digimonDisplayName || "디지몬";
  const stageLabel = snapshot.stageLabel || visual?.stageLabel || "단계 미상";
  const version = snapshot.version || visual?.version || "Ver.1";
  const slotName = snapshot.slotName || "슬롯";
  const device = snapshot.device || "기종 미상";
  const metaItems =
    variant === "detail"
      ? [slotName, device, visual?.backgroundLabel].filter(Boolean)
      : [slotName];
  const statusItems = variant === "detail" ? getSnapshotStatusItems(visual) : [];

  return (
    <section
      className={`community-snapshot-summary community-snapshot-summary--${variant}`}
      aria-label={variant === "detail" ? "디지몬 정보" : "디지몬 요약"}
    >
      <div className="community-snapshot-summary__primary">
        <strong>{digimonDisplayName}</strong>
        <span>
          {stageLabel} · {version}
        </span>
      </div>

      <div className="community-snapshot-summary__meta">
        {metaItems.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>

      {statusItems.length ? (
        <div className="community-snapshot-chip-list">
          {statusItems.map((item) => (
            <span key={item} className="community-snapshot-chip">
              {item}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default CommunitySnapshotSummary;
