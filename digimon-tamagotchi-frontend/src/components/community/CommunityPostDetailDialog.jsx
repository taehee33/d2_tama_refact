import React from "react";
import { formatTimestamp } from "../../utils/dateUtils";
import CommunityDialog from "./CommunityDialog";
import CommunityPostStatsPanel from "./CommunityPostStatsPanel";
import CommunitySnapshotScene from "./CommunitySnapshotScene";

function CommunityPostDetailDialog({
  open,
  postDetail,
  detailLoading,
  detailError,
  currentUser,
  commentDraft,
  commentLoading,
  commentError,
  editingCommentId,
  editingCommentBody,
  commentActionId,
  onClose,
  onCommentDraftChange,
  onCreateComment,
  onStartEditComment,
  onEditingCommentBodyChange,
  onCancelEditComment,
  onSaveCommentEdit,
  onDeleteComment,
}) {
  const post = postDetail?.post || null;
  const comments = postDetail?.comments || [];
  const commentCount = post?.commentCount ?? comments.length;

  return (
    <CommunityDialog
      open={open}
      title={post?.title || "게시글 상세"}
      eyebrow="피드 상세"
      onClose={onClose}
      size="xl"
      className="community-detail-modal"
    >
      {detailError ? <p className="community-error-text">{detailError}</p> : null}
      {detailLoading ? <p className="service-muted">게시글 상세를 불러오는 중입니다...</p> : null}

      {!detailLoading && !post ? (
        <div className="community-empty-box">
          <strong>상세를 볼 게시글을 선택해 주세요.</strong>
          <span>피드 카드에서 글을 열면 대표 장면과 댓글을 함께 볼 수 있습니다.</span>
        </div>
      ) : null}

      {post ? (
        <div className="community-panel-stack">
          <div className="community-detail-summary">
            <div className="community-post-card__meta">
              <div className="community-post-card__meta-primary">
                <span className="service-badge service-badge--accent">내 디지몬 자랑</span>
                <span className="community-post-card__author">작성자 {post.authorTamerName}</span>
              </div>

              <div className="community-post-card__meta-secondary">
                <span className="community-post-card__timestamp">
                  {formatTimestamp(post.createdAt, "long")}
                </span>
              </div>
            </div>

            <div className="community-post-card__content">
              <section
                className="community-post-card__section community-post-card__section--title"
                aria-label="게시글 제목"
              >
                <span className="community-post-card__section-label">제목</span>
                <h3 className="community-post-card__section-value community-post-card__section-value--title">
                  {post.title}
                </h3>
              </section>

              <CommunitySnapshotScene snapshot={post.snapshot} variant="detail" />

              <CommunityPostStatsPanel
                snapshot={post.snapshot}
                commentCount={post.commentCount ?? comments.length}
              />

              <section
                className="community-post-card__section community-post-card__section--body"
                aria-label="게시글 내용"
              >
                <span className="community-post-card__section-label">내용</span>
                <p className="community-post-card__body">
                  {post.body || "작성된 코멘트가 없습니다."}
                </p>
              </section>
            </div>
          </div>

          <div className="community-comment-section">
            <div className="community-section-header">
              <div>
                <p className="service-section-label">댓글</p>
                <h3>기록에 반응 남기기</h3>
              </div>
              <span className="service-badge service-badge--cool">{commentCount}개</span>
            </div>

            {commentError ? <p className="community-error-text">{commentError}</p> : null}

            {!currentUser ? (
              <div className="community-empty-box">
                <strong>로그인 후 댓글을 남길 수 있습니다.</strong>
                <span>공개 모드에서는 샘플 글 구조와 대표 장면 카드만 먼저 확인할 수 있습니다.</span>
              </div>
            ) : (
              <>
                <div className="community-comment-list">
                  {comments.length ? (
                    comments.map((comment) => {
                      const isOwnComment = comment.authorUid === currentUser?.uid;
                      const isEditingComment = editingCommentId === comment.id;

                      return (
                        <div key={comment.id} className="community-comment-card">
                          <div className="community-comment-meta">
                            <strong>{comment.authorTamerName}</strong>
                            <span>{formatTimestamp(comment.createdAt, "short")}</span>
                          </div>

                          {isEditingComment ? (
                            <div className="community-panel-stack">
                              <textarea
                                className="community-input community-input--textarea"
                                value={editingCommentBody}
                                onChange={(event) => onEditingCommentBodyChange(event.target.value)}
                                disabled={commentActionId === comment.id}
                              />
                              <div className="community-action-row">
                                <button
                                  type="button"
                                  className="service-button service-button--primary"
                                  onClick={() => onSaveCommentEdit(comment.id)}
                                  disabled={commentActionId === comment.id}
                                >
                                  저장
                                </button>
                                <button
                                  type="button"
                                  className="service-button service-button--ghost"
                                  onClick={onCancelEditComment}
                                  disabled={commentActionId === comment.id}
                                >
                                  취소
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p>{comment.body}</p>
                          )}

                          {isOwnComment && !isEditingComment ? (
                            <div className="community-inline-actions">
                              <button
                                type="button"
                                className="service-text-link"
                                onClick={() => onStartEditComment(comment)}
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                className="service-text-link"
                                onClick={() => onDeleteComment(comment.id)}
                                disabled={commentActionId === comment.id}
                              >
                                삭제
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <div className="community-empty-box">
                      <strong>아직 댓글이 없습니다.</strong>
                      <span>첫 댓글로 응원이나 기록 팁을 남겨 보세요.</span>
                    </div>
                  )}
                </div>

                <form className="community-panel-stack" onSubmit={onCreateComment}>
                  <label className="community-field">
                    <span>새 댓글</span>
                    <textarea
                      className="community-input community-input--textarea"
                      value={commentDraft}
                      maxLength={300}
                      placeholder="응원, 기록 팁, 다음 목표를 남겨 보세요."
                      onChange={(event) => onCommentDraftChange(event.target.value)}
                      disabled={commentLoading}
                    />
                  </label>
                  <div className="community-action-row">
                    <button
                      type="submit"
                      className="service-button service-button--primary"
                      disabled={commentLoading}
                    >
                      {commentLoading ? "등록 중..." : "댓글 남기기"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      ) : null}
    </CommunityDialog>
  );
}

export default CommunityPostDetailDialog;
