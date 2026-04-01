import React, { useId, useState } from "react";

function CommunityPostStatsPanel({ snapshot = {}, commentCount = 0 }) {
  const [collapsed, setCollapsed] = useState(true);
  const panelId = useId();
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
  const collapsedSummary = [
    snapshot.stageLabel || "단계 미상",
    snapshot.version || "Ver.1",
    `승률 ${snapshot.winRate ?? 0}%`,
  ].join(" · ");

  return (
    <section className="community-stats-panel" aria-label="디지몬 스탯">
      <div className="community-stats-panel__header">
        <div className="community-stats-panel__heading">
          <span className="community-post-card__section-label">디지몬 스탯</span>
          {collapsed ? (
            <span className="community-stats-panel__summary">{collapsedSummary}</span>
          ) : (
            <span className="community-stats-panel__summary">상세 수치를 확인할 수 있습니다.</span>
          )}
        </div>

        <button
          type="button"
          className="community-stats-panel__toggle"
          aria-expanded={!collapsed}
          aria-controls={panelId}
          onClick={() => setCollapsed((prev) => !prev)}
        >
          {collapsed ? "스탯 펼치기" : "스탯 접기"}
        </button>
      </div>

      {!collapsed ? (
        <div id={panelId} className="community-stats-grid">
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
      ) : null}
    </section>
  );
}

export default CommunityPostStatsPanel;
