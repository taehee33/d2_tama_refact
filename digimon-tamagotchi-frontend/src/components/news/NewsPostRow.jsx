import React from "react";
import { getNewsCategoryLabel } from "../../data/serviceContent";
import { formatTimestamp } from "../../utils/dateUtils";

function buildNewsMeta(post) {
  const version = post.newsContext?.version || "";
  const scope = post.newsContext?.scope || "";
  const summary = post.newsContext?.summary || "";

  if (version && scope) {
    return `${version} · ${scope}`;
  }

  if (version) {
    return version;
  }

  if (scope) {
    return scope;
  }

  if (summary) {
    return summary;
  }

  return "메타 정보 없음";
}

function NewsPostRow({
  post,
  isActive = false,
  onOpen,
  onEdit,
  onDelete,
}) {
  const commentCount = Number(post.commentCount || 0);

  return (
    <article className={`news-post-row${isActive ? " news-post-row--active" : ""}`}>
      <span className="news-post-row__category">{getNewsCategoryLabel(post.category)}</span>

      <button type="button" className="news-post-row__title" onClick={onOpen}>
        <span>{post.title}</span>
        {post.newsContext?.featured ? (
          <strong className="news-post-row__featured" aria-hidden="true">
            대표
          </strong>
        ) : null}
      </button>

      <span className="news-post-row__meta">{buildNewsMeta(post)}</span>
      <span className="news-post-row__date">{formatTimestamp(post.createdAt, "short")}</span>

      <div className="news-post-row__comments">
        <strong>{commentCount}개</strong>
        <span>댓글</span>
        {post.canManage ? (
          <div className="news-post-row__manage">
            <button type="button" className="service-text-link" onClick={onEdit}>
              수정
            </button>
            <button type="button" className="service-text-link" onClick={onDelete}>
              삭제
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default NewsPostRow;
