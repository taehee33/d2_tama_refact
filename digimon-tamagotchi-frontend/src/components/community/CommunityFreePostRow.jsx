import React from "react";
import { getCommunityFreeBoardCategoryLabel } from "../../data/serviceContent";
import { formatTimestamp } from "../../utils/dateUtils";

function CommunityFreePostRow({
  post,
  isActive = false,
  canManage = false,
  getCategoryLabel = getCommunityFreeBoardCategoryLabel,
  onOpen,
  onEdit,
  onDelete,
}) {
  const categoryLabel = getCategoryLabel(post.category);
  const commentCount = Number(post.commentCount || 0);

  return (
    <article
      className={`community-free-post-row${isActive ? " community-free-post-row--active" : ""}`}
    >
      <span className="community-free-post-row__category">{categoryLabel}</span>

      <button
        type="button"
        className="community-free-post-row__title"
        onClick={onOpen}
      >
        <span>{post.title}</span>
        {commentCount > 0 ? (
          <strong className="community-free-post-row__comment-count">
            [{commentCount}]
          </strong>
        ) : null}
      </button>

      <span className="community-free-post-row__author">{post.authorTamerName}</span>
      <span className="community-free-post-row__date">
        {formatTimestamp(post.createdAt, "short")}
      </span>

      <div className="community-free-post-row__actions">
        <button
          type="button"
          className="service-text-link"
          onClick={onOpen}
        >
          보기
        </button>
        {canManage ? (
          <>
            <button
              type="button"
              className="service-text-link"
              onClick={onEdit}
            >
              수정
            </button>
            <button
              type="button"
              className="service-text-link"
              onClick={onDelete}
            >
              삭제
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}

export default CommunityFreePostRow;
