import React from "react";
import { formatTimestamp } from "../../utils/dateUtils";
import CommunitySnapshotScene from "./CommunitySnapshotScene";
import CommunitySnapshotSummary from "./CommunitySnapshotSummary";

function CommunityPostCard({
  post,
  isSample = false,
  isActive = false,
  canManage = false,
  onOpen,
  onEdit,
  onDelete,
}) {
  const snapshot = post.snapshot || {};

  return (
    <article className={`community-post-card${isActive ? " community-post-card--active" : ""}`}>
      <div className="community-post-card__list-layout">
        <div className="community-post-card__summary">
          <div className="community-post-card__summary-header">
            <div className="community-post-card__summary-meta">
              <span
                className={`service-badge ${isSample ? "service-badge--cool" : "service-badge--accent"}`}
              >
                {isSample ? "샘플 공개" : "내 디지몬 자랑"}
              </span>
              <span className="community-post-card__timestamp">
                {formatTimestamp(post.createdAt, "short")}
              </span>
            </div>

            {canManage ? (
              <div className="community-inline-actions">
                <button type="button" className="service-text-link" onClick={onEdit}>
                  수정
                </button>
                <button type="button" className="service-text-link" onClick={onDelete}>
                  삭제
                </button>
              </div>
            ) : null}
          </div>

          <div className="community-post-card__summary-body">
            <h3 className="community-post-card__list-title">{post.title}</h3>
            <div className="community-post-card__summary-line">
              <span>작성자 {post.authorTamerName}</span>
              <span>댓글 {post.commentCount ?? 0}개</span>
            </div>
            <CommunitySnapshotSummary snapshot={snapshot} variant="card" />
          </div>
        </div>

        <div className="community-post-card__thumbnail">
          <CommunitySnapshotScene snapshot={snapshot} variant="card" />
        </div>
      </div>

      {onOpen ? (
        <div className="community-action-row community-action-row--compact">
          <button type="button" className="service-button service-button--ghost" onClick={onOpen}>
            상세 보기
          </button>
        </div>
      ) : null}
    </article>
  );
}

export default CommunityPostCard;
