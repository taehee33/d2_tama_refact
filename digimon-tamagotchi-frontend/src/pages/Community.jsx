import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CommunityPostComposer from "../components/community/CommunityPostComposer";
import CommunityPostCard from "../components/community/CommunityPostCard";
import { useAuth } from "../contexts/AuthContext";
import {
  communityBoards,
  communityGuidelines,
  communityShowcaseSamples,
} from "../data/serviceContent";
import useUserSlots from "../hooks/useUserSlots";
import { useTamerProfile } from "../hooks/useTamerProfile";
import { formatTimestamp } from "../utils/dateUtils";
import {
  createShowcaseComment,
  createShowcasePost,
  deleteShowcaseComment,
  deleteShowcasePost,
  getShowcasePostDetail,
  listShowcasePosts,
  updateShowcaseComment,
  updateShowcasePost,
} from "../utils/communityApi";
import { buildCommunityPreviewFromSlot } from "../utils/communitySnapshotUtils";

function getErrorMessage(error, fallbackMessage) {
  return error instanceof Error ? error.message : fallbackMessage;
}

function Community() {
  const { currentUser } = useAuth();
  const { displayTamerName, maxSlots } = useTamerProfile();
  const { slots, loading: slotsLoading } = useUserSlots({ maxSlots });

  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState("");
  const [selectedPostId, setSelectedPostId] = useState("");
  const [postDetail, setPostDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingPostId, setEditingPostId] = useState("");
  const [composerLoading, setComposerLoading] = useState(false);
  const [composerError, setComposerError] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [editingCommentId, setEditingCommentId] = useState("");
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [commentActionId, setCommentActionId] = useState("");

  const boardCards = useMemo(
    () =>
      communityBoards.map((board) =>
        board.id === "showcase"
          ? {
              ...board,
              status: currentUser ? "운영 중" : "샘플 공개 중",
            }
          : board
      ),
    [currentUser]
  );

  const selectedSlot = useMemo(() => {
    if (slots.length === 0) {
      return null;
    }

    return (
      slots.find((slot) => String(slot.id) === String(selectedSlotId)) ||
      slots[0] ||
      null
    );
  }, [selectedSlotId, slots]);

  const preview = useMemo(
    () => buildCommunityPreviewFromSlot(selectedSlot),
    [selectedSlot]
  );

  const refreshPosts = useCallback(async () => {
    if (!currentUser) {
      setPosts([]);
      setPostsLoading(false);
      setPostsError("");
      return [];
    }

    setPostsLoading(true);
    setPostsError("");

    try {
      const nextPosts = await listShowcasePosts(currentUser);
      setPosts(nextPosts);
      return nextPosts;
    } catch (error) {
      setPosts([]);
      setPostsError(getErrorMessage(error, "커뮤니티 글 목록을 불러오지 못했습니다."));
      return [];
    } finally {
      setPostsLoading(false);
    }
  }, [currentUser]);

  const refreshPostDetail = useCallback(
    async (postId) => {
      if (!currentUser || !postId) {
        setPostDetail(null);
        setDetailError("");
        return null;
      }

      setDetailLoading(true);
      setDetailError("");

      try {
        const detail = await getShowcasePostDetail(currentUser, postId);
        setPostDetail(detail);
        return detail;
      } catch (error) {
        setPostDetail(null);
        setDetailError(getErrorMessage(error, "게시글 상세를 불러오지 못했습니다."));
        return null;
      } finally {
        setDetailLoading(false);
      }
    },
    [currentUser]
  );

  useEffect(() => {
    if (!selectedSlotId && slots.length > 0) {
      setSelectedSlotId(String(slots[0].id));
    }
  }, [selectedSlotId, slots]);

  useEffect(() => {
    refreshPosts();
  }, [refreshPosts]);

  useEffect(() => {
    if (!currentUser) {
      setSelectedPostId("");
      setPostDetail(null);
      return;
    }

    if (posts.length === 0) {
      setSelectedPostId("");
      setPostDetail(null);
      return;
    }

    const stillExists = posts.some((post) => post.id === selectedPostId);
    if (!stillExists) {
      setSelectedPostId(posts[0].id);
    }
  }, [currentUser, posts, selectedPostId]);

  useEffect(() => {
    if (!currentUser || !selectedPostId) {
      return;
    }

    refreshPostDetail(selectedPostId);
  }, [currentUser, selectedPostId, refreshPostDetail]);

  const resetComposer = useCallback(() => {
    setEditingPostId("");
    setTitle("");
    setBody("");
    setComposerError("");
  }, []);

  const handleSubmitPost = useCallback(
    async (event) => {
      event.preventDefault();
      setComposerLoading(true);
      setComposerError("");

      try {
        let savedPost = null;

        if (editingPostId) {
          savedPost = await updateShowcasePost(currentUser, editingPostId, { title, body });
        } else {
          savedPost = await createShowcasePost(currentUser, {
            slotId: selectedSlot ? String(selectedSlot.id) : "",
            title,
            body,
          });
        }

        resetComposer();
        await refreshPosts();
        setSelectedPostId(savedPost.id);
      } catch (error) {
        setComposerError(getErrorMessage(error, "게시글을 저장하지 못했습니다."));
      } finally {
        setComposerLoading(false);
      }
    },
    [body, currentUser, editingPostId, refreshPosts, resetComposer, selectedSlot, title]
  );

  const handleEditPost = useCallback((post) => {
    setEditingPostId(post.id);
    setSelectedSlotId(String(post.slotId));
    setTitle(post.title);
    setBody(post.body || "");
    setComposerError("");
  }, []);

  const handleDeletePost = useCallback(
    async (postId) => {
      if (!currentUser || !window.confirm("이 게시글을 삭제할까요?")) {
        return;
      }

      try {
        await deleteShowcasePost(currentUser, postId);
        if (editingPostId === postId) {
          resetComposer();
        }

        if (selectedPostId === postId) {
          setSelectedPostId("");
        }

        await refreshPosts();
      } catch (error) {
        setPostsError(getErrorMessage(error, "게시글을 삭제하지 못했습니다."));
      }
    },
    [currentUser, editingPostId, refreshPosts, resetComposer, selectedPostId]
  );

  const handleCreateComment = useCallback(
    async (event) => {
      event.preventDefault();

      if (!postDetail?.post?.id) {
        return;
      }

      setCommentLoading(true);
      setCommentError("");

      try {
        await createShowcaseComment(currentUser, postDetail.post.id, { body: commentDraft });
        setCommentDraft("");
        await Promise.all([refreshPosts(), refreshPostDetail(postDetail.post.id)]);
      } catch (error) {
        setCommentError(getErrorMessage(error, "댓글을 등록하지 못했습니다."));
      } finally {
        setCommentLoading(false);
      }
    },
    [commentDraft, currentUser, postDetail, refreshPostDetail, refreshPosts]
  );

  const handleSaveCommentEdit = useCallback(
    async (commentId) => {
      if (!currentUser || !postDetail?.post?.id) {
        return;
      }

      setCommentActionId(commentId);
      setCommentError("");

      try {
        await updateShowcaseComment(currentUser, commentId, { body: editingCommentBody });
        setEditingCommentId("");
        setEditingCommentBody("");
        await refreshPostDetail(postDetail.post.id);
      } catch (error) {
        setCommentError(getErrorMessage(error, "댓글을 수정하지 못했습니다."));
      } finally {
        setCommentActionId("");
      }
    },
    [currentUser, editingCommentBody, postDetail, refreshPostDetail]
  );

  const handleDeleteComment = useCallback(
    async (commentId) => {
      if (!currentUser || !postDetail?.post?.id || !window.confirm("이 댓글을 삭제할까요?")) {
        return;
      }

      setCommentActionId(commentId);
      setCommentError("");

      try {
        await deleteShowcaseComment(currentUser, commentId);
        if (editingCommentId === commentId) {
          setEditingCommentId("");
          setEditingCommentBody("");
        }
        await Promise.all([refreshPosts(), refreshPostDetail(postDetail.post.id)]);
      } catch (error) {
        setCommentError(getErrorMessage(error, "댓글을 삭제하지 못했습니다."));
      } finally {
        setCommentActionId("");
      }
    },
    [currentUser, editingCommentId, postDetail, refreshPostDetail, refreshPosts]
  );

  const renderGuidelines = (
    <div className="service-card service-card--soft">
      <p className="service-section-label">운영 가이드</p>
      <h2>게시 전 체크</h2>
      <ul className="service-list">
        {communityGuidelines.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );

  return (
    <section className="service-page">
      <div className="service-card service-card--mint">
        <p className="service-section-label">커뮤니티</p>
        <h1>내 디지몬 자랑과 기록을 모을 공간</h1>
        <p>
          자랑 피드는 Supabase 게시글 저장소로 분리하고, 슬롯 스냅샷은 Firebase 원본
          데이터를 서버에서 읽어 자동으로 기록합니다.
        </p>
      </div>

      <div className="service-action-grid">
        {boardCards.map((board) => (
          <article key={board.id} className="service-action-card">
            <strong>{board.title}</strong>
            <span>{board.description}</span>
            <span className="service-badge service-badge--cool">{board.status}</span>
          </article>
        ))}
      </div>

      {!currentUser ? (
        <>
          <div className="service-two-column community-layout">
            <div className="service-card service-card--warm">
              <p className="service-section-label">공개 모드</p>
              <h2>로그인 전에는 샘플 글만 볼 수 있습니다</h2>
              <p className="service-muted">
                실제 사용자 피드와 댓글은 로그인 후에만 열립니다. 지금은 공개 샘플 구조만
                먼저 확인할 수 있습니다.
              </p>
              <div className="community-action-row">
                <Link to="/auth" className="service-button service-button--primary">
                  로그인하고 커뮤니티 참여하기
                </Link>
                <Link to="/guide" className="service-button service-button--ghost">
                  커뮤니티 가이드 보기
                </Link>
              </div>
            </div>
            {renderGuidelines}
          </div>

          <div className="community-feed-list">
            {communityShowcaseSamples.map((post) => (
              <CommunityPostCard key={post.id} post={post} isSample />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="service-two-column community-layout">
            <CommunityPostComposer
              displayTamerName={displayTamerName}
              slots={slots}
              selectedSlotId={selectedSlotId}
              preview={preview}
              title={title}
              body={body}
              isEditing={Boolean(editingPostId)}
              isSubmitting={composerLoading}
              errorMessage={composerError}
              onSelectedSlotIdChange={setSelectedSlotId}
              onTitleChange={setTitle}
              onBodyChange={setBody}
              onSubmit={handleSubmitPost}
              onCancelEdit={resetComposer}
            />

            <div className="service-card community-feed-column">
              <div className="community-section-header">
                <div>
                  <p className="service-section-label">실제 피드</p>
                  <h2>내 디지몬 자랑</h2>
                </div>
                <span className="service-badge service-badge--accent">{posts.length}개 글</span>
              </div>

              {postsError ? <p className="community-error-text">{postsError}</p> : null}
              {postsLoading ? <p className="service-muted">게시글을 불러오는 중입니다...</p> : null}
              {slotsLoading ? <p className="service-muted">슬롯 정보를 확인하는 중입니다...</p> : null}

              {!postsLoading && posts.length === 0 ? (
                <div className="community-empty-box">
                  <strong>아직 등록된 자랑 글이 없습니다.</strong>
                  <span>첫 번째 기록을 올려서 내 디지몬 성장 로그를 남겨 보세요.</span>
                </div>
              ) : (
                <div className="community-feed-list">
                  {posts.map((post) => (
                    <CommunityPostCard
                      key={post.id}
                      post={post}
                      isActive={selectedPostId === post.id}
                      canManage={post.authorUid === currentUser.uid}
                      onOpen={() => setSelectedPostId(post.id)}
                      onEdit={() => handleEditPost(post)}
                      onDelete={() => handleDeletePost(post.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="service-two-column community-layout">
            <div className="service-card community-detail-card">
              <div className="community-section-header">
                <div>
                  <p className="service-section-label">게시글 상세</p>
                  <h2>{postDetail?.post?.title || "선택한 글이 없습니다"}</h2>
                </div>
                {postDetail?.post ? (
                  <span className="service-badge service-badge--cool">
                    {postDetail.comments?.length || 0}개 댓글
                  </span>
                ) : null}
              </div>

              {detailError ? <p className="community-error-text">{detailError}</p> : null}
              {detailLoading ? <p className="service-muted">게시글 상세를 불러오는 중입니다...</p> : null}

              {!detailLoading && !postDetail?.post ? (
                <div className="community-empty-box">
                  <strong>상세를 볼 게시글을 선택해 주세요.</strong>
                  <span>오른쪽 피드에서 글을 고르면 댓글과 스냅샷을 함께 볼 수 있습니다.</span>
                </div>
              ) : null}

              {postDetail?.post ? (
                <div className="community-panel-stack">
                  <div className="community-detail-summary">
                    <p className="community-post-card__body">{postDetail.post.body || "작성된 코멘트가 없습니다."}</p>
                    <div className="community-snapshot-chip-list">
                      <span className="community-snapshot-chip">
                        {postDetail.post.snapshot?.slotName || "슬롯"}
                      </span>
                      <span className="community-snapshot-chip">
                        {postDetail.post.snapshot?.digimonDisplayName || "디지몬"}
                      </span>
                      <span className="community-snapshot-chip">
                        {postDetail.post.snapshot?.stageLabel || "단계 미상"}
                      </span>
                      <span className="community-snapshot-chip">
                        {postDetail.post.snapshot?.version || "Ver.1"}
                      </span>
                      <span className="community-snapshot-chip">
                        승률 {postDetail.post.snapshot?.winRate ?? 0}%
                      </span>
                    </div>
                    <p className="service-muted">
                      작성자 {postDetail.post.authorTamerName} · {formatTimestamp(postDetail.post.createdAt, "long")}
                    </p>
                  </div>

                  <div className="community-comment-section">
                    <div className="community-section-header">
                      <div>
                        <p className="service-section-label">댓글</p>
                        <h3>기록에 반응 남기기</h3>
                      </div>
                    </div>

                    {commentError ? <p className="community-error-text">{commentError}</p> : null}

                    <div className="community-comment-list">
                      {postDetail.comments?.length ? (
                        postDetail.comments.map((comment) => {
                          const isOwnComment = comment.authorUid === currentUser.uid;
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
                                    onChange={(event) => setEditingCommentBody(event.target.value)}
                                    disabled={commentActionId === comment.id}
                                  />
                                  <div className="community-action-row">
                                    <button
                                      type="button"
                                      className="service-button service-button--primary"
                                      onClick={() => handleSaveCommentEdit(comment.id)}
                                      disabled={commentActionId === comment.id}
                                    >
                                      저장
                                    </button>
                                    <button
                                      type="button"
                                      className="service-button service-button--ghost"
                                      onClick={() => {
                                        setEditingCommentId("");
                                        setEditingCommentBody("");
                                      }}
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
                                    onClick={() => {
                                      setEditingCommentId(comment.id);
                                      setEditingCommentBody(comment.body);
                                    }}
                                  >
                                    수정
                                  </button>
                                  <button
                                    type="button"
                                    className="service-text-link"
                                    onClick={() => handleDeleteComment(comment.id)}
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

                    <form className="community-panel-stack" onSubmit={handleCreateComment}>
                      <label className="community-field">
                        <span>새 댓글</span>
                        <textarea
                          className="community-input community-input--textarea"
                          value={commentDraft}
                          maxLength={300}
                          placeholder="응원, 기록 팁, 다음 목표를 남겨 보세요."
                          onChange={(event) => setCommentDraft(event.target.value)}
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
                  </div>
                </div>
              ) : null}
            </div>

            {renderGuidelines}
          </div>
        </>
      )}
    </section>
  );
}

export default Community;
