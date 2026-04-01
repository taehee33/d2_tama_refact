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

  return (
    <article className={`community-post-card${isActive ? " community-post-card--active" : ""}`}>
      <div className="community-post-card__meta">
        <span className={`service-badge ${isSample ? "service-badge--cool" : "service-badge--accent"}`}>
          {isSample ? "샘플 공개" : "내 디지몬 자랑"}
        </span>
        <span className="community-post-card__author">작성자 {post.authorTamerName}</span>
        <span className="community-post-card__timestamp">{formatTimestamp(post.createdAt, "short")}</span>
      </div>

      <CommunitySnapshotScene snapshot={snapshot} variant="card" />

      <div className="community-post-card__header">
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

      <div className="community-post-card__content">
        <section className="community-post-card__section community-post-card__section--title" aria-label="게시글 제목">
          <span className="community-post-card__section-label">제목</span>
          <h3 className="community-post-card__section-value community-post-card__section-value--title">
            {post.title}
          </h3>
        </section>

        <section className="community-post-card__section community-post-card__section--body" aria-label="게시글 내용">
          <span className="community-post-card__section-label">내용</span>
          <p className="community-post-card__body">{post.body || "작성된 내용이 없습니다."}</p>
        </section>
      </div>

      <div className="community-snapshot-chip-list">
        <span className="community-snapshot-chip">{snapshot.stageLabel || "단계 미상"}</span>
        <span className="community-snapshot-chip">{snapshot.version || "Ver.1"}</span>
        <span className="community-snapshot-chip">{snapshot.slotName || "슬롯"}</span>
        <span className="community-snapshot-chip">{snapshot.device || "기종 미상"}</span>
      </div>

      <div className="community-stat-row">
        <span>케어 미스 {snapshot.careMistakes ?? 0}</span>
        <span>체중 {snapshot.weight ?? 0}g</span>
        <span>승률 {snapshot.winRate ?? 0}%</span>
        <span>댓글 {post.commentCount ?? 0}개</span>
      </div>

      {onOpen ? (
        <div className="community-action-row">
          <button type="button" className="service-button service-button--ghost" onClick={onOpen}>
            {isSample ? "샘플 글 보기" : `댓글 ${post.commentCount ?? 0}개 보기`}
          </button>
        </div>
      ) : null}
    </article>
  );
}

export default CommunityPostCard;
