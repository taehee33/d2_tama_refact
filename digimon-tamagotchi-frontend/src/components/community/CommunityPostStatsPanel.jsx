import React from "react";

function CommunityPostStatsPanel({ snapshot = {}, commentCount = 0 }) {
  const statItems = [
    { label: "단계", value: snapshot.stageLabel || "단계 미상" },
    { label: "버전", value: snapshot.version || "Ver.1" },
    { label: "슬롯", value: snapshot.slotName || "슬롯" },
    { label: "기종", value: snapshot.device || "기종 미상", wide: true },
    { label: "케어 미스", value: `${snapshot.careMistakes ?? 0}` },
    { label: "체중", value: `${snapshot.weight ?? 0}g` },
    { label: "승률", value: `${snapshot.winRate ?? 0}%` },
    { label: "댓글", value: `${commentCount ?? 0}개` },
  ];

  return (
    <section className="community-stats-panel" aria-label="디지몬 스탯">
      <div className="community-stats-panel__header">
        <span className="community-post-card__section-label">디지몬 스탯</span>
      </div>

      <div className="community-stats-grid">
        {statItems.map((item) => (
          <div
            key={item.label}
            className={`community-stats-grid__item${item.wide ? " community-stats-grid__item--wide" : ""}`}
          >
            <span className="community-stats-grid__label">{item.label}</span>
            <strong className="community-stats-grid__value">{item.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export default CommunityPostStatsPanel;
