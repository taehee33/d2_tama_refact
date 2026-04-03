import React from "react";
import { formatTimestamp } from "../../utils/dateUtils";
import CommunitySnapshotScene from "./CommunitySnapshotScene";

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
  const digimonDisplayName = snapshot.digimonDisplayName || "디지몬";
  const stageLabel = snapshot.stageLabel || "단계 미상";
  const version = snapshot.version || "Ver.1";
  const slotName = snapshot.slotName || "슬롯 미상";

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
                작성일 : {formatTimestamp(post.createdAt, "short")}
              </span>
            </div>

            {canManage ? (
              <div className="community-post-card__manage-box" aria-label="게시글 관리">
                <span className="community-post-card__manage-label">관리</span>
                <div className="community-post-card__manage-actions">
                  <button
                    type="button"
                    className="community-post-card__manage-action community-post-card__manage-action--edit"
                    onClick={onEdit}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    className="community-post-card__manage-action community-post-card__manage-action--delete"
                    onClick={onDelete}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="community-post-card__summary-body">
            <div className="community-post-card__fact-card community-post-card__fact-card--title">
              <span className="community-post-card__fact-label">제목 :</span>
              <h3 className="community-post-card__list-title">{post.title}</h3>
            </div>

            <div className="community-post-card__fact-grid">
              <div className="community-post-card__fact-card community-post-card__fact-card--accent">
                <span className="community-post-card__fact-label">작성자 :</span>
                <strong className="community-post-card__fact-value">
                  {post.authorTamerName}
                </strong>
              </div>

              <div className="community-post-card__fact-card">
                <span className="community-post-card__fact-label">댓글 :</span>
                <strong className="community-post-card__fact-value">
                  {post.commentCount ?? 0}개
                </strong>
              </div>

              <div className="community-post-card__fact-card community-post-card__fact-card--accent">
                <span className="community-post-card__fact-label">디지몬 :</span>
                <strong className="community-post-card__fact-value">
                  {digimonDisplayName}
                </strong>
              </div>

              <div className="community-post-card__fact-card">
                <span className="community-post-card__fact-label">단계 :</span>
                <strong className="community-post-card__fact-value">
                  {stageLabel} · {version}
                </strong>
              </div>
            </div>

            <div className="community-post-card__fact-strip">
              <span className="community-post-card__fact-label">슬롯 :</span>
              <strong className="community-post-card__fact-value">{slotName}</strong>
            </div>
          </div>
        </div>

        <div className="community-post-card__thumbnail">
          <span className="community-post-card__thumbnail-label">대표 장면</span>
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
