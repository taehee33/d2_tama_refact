import React from "react";
import { formatTimestamp } from "../../utils/dateUtils";
import CommunitySnapshotScene from "./CommunitySnapshotScene";
import CommunityPostStatsPanel from "./CommunityPostStatsPanel";

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
        <div className="community-post-card__meta-primary">
          <span
            className={`service-badge ${isSample ? "service-badge--cool" : "service-badge--accent"}`}
          >
            {isSample ? "샘플 공개" : "내 디지몬 자랑"}
          </span>
          <span className="community-meta-box community-meta-box--author">
            <span className="community-meta-box__label">작성자</span>
            <strong className="community-meta-box__value">{post.authorTamerName}</strong>
          </span>
        </div>

        <div className="community-post-card__meta-secondary">
          <span className="community-post-card__timestamp">
            {formatTimestamp(post.createdAt, "short")}
          </span>
          {canManage ? (
            <div className="community-meta-box community-meta-box--actions">
              <span className="community-meta-box__label">관리</span>
              <div className="community-inline-actions community-inline-actions--stacked">
              <button type="button" className="service-text-link" onClick={onEdit}>
                수정
              </button>
              <button type="button" className="service-text-link" onClick={onDelete}>
                삭제
              </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="community-post-card__content">
        <section className="community-post-card__section community-post-card__section--title" aria-label="게시글 제목">
          <span className="community-post-card__section-label">제목</span>
          <h3 className="community-post-card__section-value community-post-card__section-value--title">
            {post.title}
          </h3>
        </section>

        <CommunitySnapshotScene snapshot={snapshot} variant="card" />

        <CommunityPostStatsPanel snapshot={snapshot} commentCount={post.commentCount} />

        <section className="community-post-card__section community-post-card__section--body" aria-label="게시글 내용">
          <span className="community-post-card__section-label">내용</span>
          <p className="community-post-card__body">{post.body || "작성된 내용이 없습니다."}</p>
        </section>
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
