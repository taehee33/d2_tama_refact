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
  const bodyPreview = post.body?.trim() || "아직 남긴 코멘트가 없습니다.";
  const previewComments = Array.isArray(post.previewComments)
    ? post.previewComments.slice(0, 3)
    : [];
  const parsedCommentCount = Number(post.commentCount);
  const totalCommentCount = Number.isFinite(parsedCommentCount)
    ? parsedCommentCount
    : previewComments.length;
  const hasMoreComments = totalCommentCount > previewComments.length;

  return (
    <article className={`community-post-card${isActive ? " community-post-card--active" : ""}`}>
      <div className="community-post-card__topbar">
        <span
          className={`service-badge ${isSample ? "service-badge--cool" : "service-badge--accent"}`}
        >
          {isSample ? "샘플 공개" : "내 디지몬 자랑"}
        </span>

        <div className="community-post-card__topbar-right">
          <div
            className="community-post-card__meta-block"
            aria-label="게시글 작성 정보"
          >
            <span className="community-post-card__meta-item">
              작성자 : {post.authorTamerName}
            </span>
            <span className="community-post-card__meta-item">
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
      </div>

      <div className="community-post-card__list-layout">
        <div className="community-post-card__content-column">
          <div className="community-post-card__fact-card community-post-card__fact-card--title">
            <span className="community-post-card__fact-label">제목 :</span>
            <h3 className="community-post-card__list-title">{post.title}</h3>
          </div>

          <div className="community-post-card__fact-card community-post-card__fact-card--body">
            <span className="community-post-card__fact-label">내용 :</span>
            <p className="community-post-card__body-preview">{bodyPreview}</p>
          </div>

          <div className="community-post-card__fact-card community-post-card__fact-card--comment">
            <span className="community-post-card__fact-label">댓글 :</span>
            <strong className="community-post-card__fact-value">
              {totalCommentCount}개
            </strong>

            {previewComments.length ? (
              <ul className="community-post-card__comment-preview-list">
                {previewComments.map((comment) => (
                  <li
                    key={comment.id || `${post.id}-preview-${comment.createdAt || comment.body}`}
                    className="community-post-card__comment-preview-item"
                  >
                    <strong className="community-post-card__comment-preview-author">
                      {comment.authorTamerName || "익명"} :
                    </strong>
                    <span className="community-post-card__comment-preview-body">
                      {comment.body?.trim() || "내용 없음"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : totalCommentCount === 0 ? (
              <span className="community-post-card__comment-empty">
                아직 댓글이 없습니다.
              </span>
            ) : null}

            {hasMoreComments && onOpen ? (
              <button
                type="button"
                className="community-post-card__comment-more"
                onClick={onOpen}
              >
                더보기...
              </button>
            ) : null}
          </div>
        </div>

        <div className="community-post-card__media-column">
          <div className="community-post-card__thumbnail">
            <span className="community-post-card__thumbnail-label">대표 장면</span>
            <CommunitySnapshotScene snapshot={snapshot} variant="card" />
          </div>

          <div className="community-post-card__media-meta">
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
