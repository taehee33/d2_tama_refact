import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CommunityPostCard from "../components/community/CommunityPostCard";
import CommunityPostComposer from "../components/community/CommunityPostComposer";
import CommunityPostDetailDialog from "../components/community/CommunityPostDetailDialog";
import { useAuth } from "../contexts/AuthContext";
import {
  communityBoards,
  communityGuidelines,
  communityShowcaseSamples,
} from "../data/serviceContent";
import useUserSlots from "../hooks/useUserSlots";
import { useTamerProfile } from "../hooks/useTamerProfile";
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
  const [selectedSamplePost, setSelectedSamplePost] = useState(null);
  const [postDetail, setPostDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingPostId, setEditingPostId] = useState("");
  const [composerLoading, setComposerLoading] = useState(false);
  const [composerError, setComposerError] = useState("");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
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

  const detailData = currentUser
    ? postDetail
    : selectedSamplePost
      ? { post: selectedSamplePost, comments: [] }
      : null;

  const feedPosts = currentUser ? posts : communityShowcaseSamples;

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
      setPostsError(
        getErrorMessage(error, "커뮤니티 글 목록을 불러오지 못했습니다.")
      );
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
        setDetailError(
          getErrorMessage(error, "게시글 상세를 불러오지 못했습니다.")
        );
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
      setSelectedSamplePost(null);
      setPostDetail(null);
      setIsComposerOpen(false);
      return;
    }

    setSelectedSamplePost(null);

    if (posts.length === 0) {
      setSelectedPostId("");
      setPostDetail(null);
      return;
    }

    const stillExists = posts.some((post) => post.id === selectedPostId);
    if (selectedPostId && !stillExists) {
      setSelectedPostId("");
      setPostDetail(null);
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

  const handleCloseComposer = useCallback(() => {
    resetComposer();
    setIsComposerOpen(false);
  }, [resetComposer]);

  const handleOpenComposer = useCallback(() => {
    resetComposer();
    setIsComposerOpen(true);
  }, [resetComposer]);

  const handleCloseDetail = useCallback(() => {
    setSelectedPostId("");
    setSelectedSamplePost(null);
    setPostDetail(null);
    setDetailError("");
    setCommentDraft("");
    setCommentError("");
    setEditingCommentId("");
    setEditingCommentBody("");
    setCommentActionId("");
  }, []);

  const handleSubmitPost = useCallback(
    async (event) => {
      event.preventDefault();
      setComposerLoading(true);
      setComposerError("");

      try {
        let savedPost = null;

        if (editingPostId) {
          savedPost = await updateShowcasePost(currentUser, editingPostId, {
            title,
            body,
          });
        } else {
          savedPost = await createShowcasePost(currentUser, {
            slotId: selectedSlot ? String(selectedSlot.id) : "",
            title,
            body,
            snapshot: preview,
          });
        }

        resetComposer();
        setIsComposerOpen(false);
        await refreshPosts();
        setSelectedPostId(savedPost.id);
      } catch (error) {
        setComposerError(getErrorMessage(error, "게시글을 저장하지 못했습니다."));
      } finally {
        setComposerLoading(false);
      }
    },
    [
      body,
      currentUser,
      editingPostId,
      preview,
      refreshPosts,
      resetComposer,
      selectedSlot,
      title,
    ]
  );

  const handleEditPost = useCallback((post) => {
    setEditingPostId(post.id);
    setSelectedSlotId(String(post.slotId));
    setTitle(post.title);
    setBody(post.body || "");
    setComposerError("");
    setIsComposerOpen(true);
  }, []);

  const handleDeletePost = useCallback(
    async (postId) => {
      if (!currentUser || !window.confirm("이 게시글을 삭제할까요?")) {
        return;
      }

      try {
        await deleteShowcasePost(currentUser, postId);

        if (editingPostId === postId) {
          handleCloseComposer();
        }

        if (selectedPostId === postId) {
          handleCloseDetail();
        }

        await refreshPosts();
      } catch (error) {
        setPostsError(getErrorMessage(error, "게시글을 삭제하지 못했습니다."));
      }
    },
    [
      currentUser,
      editingPostId,
      handleCloseComposer,
      handleCloseDetail,
      refreshPosts,
      selectedPostId,
    ]
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
        await createShowcaseComment(currentUser, postDetail.post.id, {
          body: commentDraft,
        });
        setCommentDraft("");
        await Promise.all([
          refreshPosts(),
          refreshPostDetail(postDetail.post.id),
        ]);
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
        await updateShowcaseComment(currentUser, commentId, {
          body: editingCommentBody,
        });
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

        await Promise.all([
          refreshPosts(),
          refreshPostDetail(postDetail.post.id),
        ]);
      } catch (error) {
        setCommentError(getErrorMessage(error, "댓글을 삭제하지 못했습니다."));
      } finally {
        setCommentActionId("");
      }
    },
    [currentUser, editingCommentId, postDetail, refreshPostDetail, refreshPosts]
  );

  return (
    <section className="community-page">
      <header className="community-hero">
        <div className="community-hero__content">
          <p className="service-section-label">커뮤니티</p>
          <h1>내 디지몬 자랑 피드</h1>
          <p className="community-hero__description">
            서비스 소개 카드가 아니라, 대표 장면과 성장 로그가 바로 보이는 피드로 다시
            묶었습니다. 자랑하기를 누르면 현재 슬롯 상태를 바탕으로 스냅샷 카드가 자동으로
            생성됩니다.
          </p>
          <div className="community-hero__chips">
            <span className="community-hero__chip">대표 장면 자동 생성</span>
            <span className="community-hero__chip">댓글 중심 상세 보기</span>
            <span className="community-hero__chip">
              {currentUser ? `실제 피드 ${posts.length}개` : `샘플 피드 ${communityShowcaseSamples.length}개`}
            </span>
          </div>
        </div>

        <div className="community-hero__actions">
          {currentUser ? (
            <>
              <button
                type="button"
                className="service-button service-button--primary"
                onClick={handleOpenComposer}
              >
                자랑하기
              </button>
              <Link to="/guide" className="service-button service-button--ghost">
                기록 가이드 보기
              </Link>
            </>
          ) : (
            <>
              <Link to="/auth" className="service-button service-button--primary">
                로그인하고 자랑하기
              </Link>
              <Link to="/guide" className="service-button service-button--ghost">
                운영 가이드 보기
              </Link>
            </>
          )}
        </div>
      </header>

      <div className="community-board-tabs" role="tablist" aria-label="커뮤니티 보드">
        {boardCards.map((board) => {
          const isShowcase = board.id === "showcase";
          return (
            <button
              key={board.id}
              type="button"
              role="tab"
              aria-selected={isShowcase}
              disabled={!isShowcase}
              className={`community-board-tab${isShowcase ? " community-board-tab--active" : ""}`}
            >
              <span className="community-board-tab__status">{board.status}</span>
              <strong>{board.title}</strong>
              <span>{board.description}</span>
            </button>
          );
        })}
      </div>

      <div className="community-feed-shell">
        <div className="community-feed-toolbar">
          <div>
            <p className="service-section-label">
              {currentUser ? "실제 피드" : "샘플 피드"}
            </p>
            <h2>대표 장면과 성장 로그를 한눈에 보기</h2>
            <p className="service-muted">
              {currentUser
                ? "피드 카드를 눌러 댓글과 상세 스냅샷을 열고, 자랑하기에서 현재 슬롯 상태를 바로 기록해 보세요."
                : "지금은 샘플 피드만 공개됩니다. 로그인하면 실제 글 작성과 댓글 참여가 열립니다."}
            </p>
          </div>

          <div className="community-feed-toolbar__aside">
            <span className="service-badge service-badge--accent">
              {feedPosts.length}개 글
            </span>
            {currentUser ? (
              <span className="service-badge service-badge--cool">
                {displayTamerName || "테이머"}
              </span>
            ) : null}
          </div>
        </div>

        {!currentUser ? (
          <div className="community-public-note">
            <strong>공개 모드에서는 샘플 피드만 확인할 수 있습니다.</strong>
            <span>
              글 작성과 댓글은 로그인 후 열리며, 실제 자랑 글은 Firebase 슬롯 데이터를 읽어
              서버에서 자동으로 스냅샷을 저장합니다.
            </span>
          </div>
        ) : null}

        {postsError ? <p className="community-error-text">{postsError}</p> : null}
        {postsLoading ? (
          <p className="service-muted">게시글을 불러오는 중입니다...</p>
        ) : null}
        {currentUser && slotsLoading ? (
          <p className="service-muted">슬롯 정보를 확인하는 중입니다...</p>
        ) : null}

        {!postsLoading && feedPosts.length === 0 ? (
          <div className="community-empty-box">
            <strong>아직 등록된 자랑 글이 없습니다.</strong>
            <span>첫 번째 기록을 올려서 내 디지몬 성장 로그를 남겨 보세요.</span>
          </div>
        ) : (
          <div className="community-feed-list">
            {feedPosts.map((post) => (
              <CommunityPostCard
                key={post.id}
                post={post}
                isSample={!currentUser}
                isActive={
                  currentUser
                    ? selectedPostId === post.id
                    : selectedSamplePost?.id === post.id
                }
                canManage={Boolean(currentUser && post.authorUid === currentUser.uid)}
                onOpen={() => {
                  if (currentUser) {
                    setSelectedSamplePost(null);
                    setSelectedPostId(post.id);
                    return;
                  }

                  setSelectedPostId("");
                  setSelectedSamplePost(post);
                }}
                onEdit={currentUser ? () => handleEditPost(post) : undefined}
                onDelete={currentUser ? () => handleDeletePost(post.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      <details className="community-guideline-panel">
        <summary>운영 가이드와 게시 팁 보기</summary>
        <div className="community-guideline-panel__body">
          <p className="service-muted">
            이번 보드는 소개 페이지보다 피드 탐색을 우선합니다. 대신 게시 전에 필요한 팁은
            접어서 정리해 두었습니다.
          </p>
          <ul className="community-guideline-list">
            {communityGuidelines.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </details>

      {currentUser ? (
        <CommunityPostComposer
          open={isComposerOpen}
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
          onClose={handleCloseComposer}
        />
      ) : null}

      <CommunityPostDetailDialog
        open={Boolean(currentUser ? selectedPostId : selectedSamplePost)}
        postDetail={detailData}
        detailLoading={currentUser ? detailLoading : false}
        detailError={detailError}
        currentUser={currentUser}
        commentDraft={commentDraft}
        commentLoading={commentLoading}
        commentError={commentError}
        editingCommentId={editingCommentId}
        editingCommentBody={editingCommentBody}
        commentActionId={commentActionId}
        onClose={handleCloseDetail}
        onCommentDraftChange={setCommentDraft}
        onCreateComment={handleCreateComment}
        onStartEditComment={(comment) => {
          setEditingCommentId(comment.id);
          setEditingCommentBody(comment.body);
        }}
        onEditingCommentBodyChange={setEditingCommentBody}
        onCancelEditComment={() => {
          setEditingCommentId("");
          setEditingCommentBody("");
        }}
        onSaveCommentEdit={handleSaveCommentEdit}
        onDeleteComment={handleDeleteComment}
      />
    </section>
  );
}

export default Community;
