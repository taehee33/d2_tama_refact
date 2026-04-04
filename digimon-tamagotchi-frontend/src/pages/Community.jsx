import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import CommunityPostCard from "../components/community/CommunityPostCard";
import CommunityPostComposer from "../components/community/CommunityPostComposer";
import CommunityPostDetailDialog from "../components/community/CommunityPostDetailDialog";
import { useAuth } from "../contexts/AuthContext";
import {
  communityBoards,
  communityDiscordChannels,
  communityDiscordChecklist,
  communityDiscordInvite,
  communityFreeBoardTips,
  communityFreeBoardTopics,
  communityGuidelines,
  communityShowcaseSamples,
  getCommunityBoardHref,
  resolveCommunityBoardId,
  supportChecklist,
  supportFaqs,
  supportStatusCards,
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
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { displayTamerName, maxSlots } = useTamerProfile();
  const { slots, loading: slotsLoading } = useUserSlots({ maxSlots });

  const [activeBoardId, setActiveBoardId] = useState(() =>
    resolveCommunityBoardId(location.search)
  );
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
  const isShowcaseBoard = activeBoardId === "showcase";

  const handleSelectBoard = useCallback(
    (boardId) => {
      const nextBoardId = resolveCommunityBoardId(`board=${boardId}`);

      setActiveBoardId(nextBoardId);
      navigate(getCommunityBoardHref(nextBoardId));
    },
    [navigate]
  );

  const activeBoardCopy = useMemo(() => {
    switch (activeBoardId) {
      case "free":
        return {
          title: "자유게시판",
          description:
            "플레이 근황, 공략 메모, 짧은 질문을 편하게 나누는 대화형 보드입니다.",
        };
      case "support":
        return {
          title: "버그제보 / QnA",
          description:
            "버그 제보 체크리스트와 FAQ를 한 화면에 모아 빠르게 확인하는 지원 보드입니다.",
        };
      case "discord":
        return {
          title: "디스코드 커뮤니티",
          description:
            "실시간 질문, 스냅샷 공유, 채널 입장 링크를 함께 안내하는 커뮤니티 입구입니다.",
        };
      case "showcase":
      default:
        return {
          title: "내 디지몬 자랑 피드",
          description:
            "대표 장면과 성장 로그를 바로 둘러보고, 현재 슬롯 상태로 스냅샷 글을 남기는 메인 피드입니다.",
        };
    }
  }, [activeBoardId]);

  const activeBoardMeta = useMemo(
    () =>
      boardCards.find((board) => board.id === activeBoardId) || boardCards[0] || null,
    [activeBoardId, boardCards]
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
    const nextBoardId = resolveCommunityBoardId(location.search);

    setActiveBoardId((prev) => (prev === nextBoardId ? prev : nextBoardId));
  }, [location.search]);

  useEffect(() => {
    if (!selectedSlotId && slots.length > 0) {
      setSelectedSlotId(String(slots[0].id));
    }
  }, [selectedSlotId, slots]);

  useEffect(() => {
    if (!isShowcaseBoard) {
      return;
    }

    refreshPosts();
  }, [isShowcaseBoard, refreshPosts]);

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
    if (!currentUser || !selectedPostId || !isShowcaseBoard) {
      return;
    }

    refreshPostDetail(selectedPostId);
  }, [currentUser, isShowcaseBoard, selectedPostId, refreshPostDetail]);

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

  useEffect(() => {
    if (activeBoardId === "showcase") {
      return;
    }

    handleCloseComposer();
    handleCloseDetail();
  }, [activeBoardId, handleCloseComposer, handleCloseDetail]);

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
        await Promise.all([
          refreshPosts(),
          refreshPostDetail(postDetail.post.id),
        ]);
      } catch (error) {
        setCommentError(getErrorMessage(error, "댓글을 수정하지 못했습니다."));
      } finally {
        setCommentActionId("");
      }
    },
    [currentUser, editingCommentBody, postDetail, refreshPostDetail, refreshPosts]
  );

  const handleDeleteComment = useCallback(
    async (commentId) => {
      if (
        !currentUser ||
        !postDetail?.post?.id ||
        !window.confirm("이 댓글을 삭제할까요?")
      ) {
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

  const renderBoardToolbarActions = (boardId) => {
    if (boardId === "free") {
      return (
        <>
          <button
            type="button"
            className="service-button service-button--primary"
            onClick={() => handleSelectBoard("showcase")}
          >
            자랑게시판 보기
          </button>
          <button
            type="button"
            className="service-button service-button--ghost"
            onClick={() => handleSelectBoard("support")}
          >
            버그제보 / QnA 보기
          </button>
        </>
      );
    }

    if (boardId === "support") {
      return (
        <>
          <button
            type="button"
            className="service-button service-button--primary"
            onClick={() => handleSelectBoard("discord")}
          >
            디스코드 보기
          </button>
          <button
            type="button"
            className="service-button service-button--ghost"
            onClick={() => handleSelectBoard("showcase")}
          >
            자랑게시판 보기
          </button>
        </>
      );
    }

    if (boardId === "discord") {
      return (
        <>
          <a
            href={communityDiscordInvite.url}
            target="_blank"
            rel="noreferrer"
            className="service-button service-button--primary"
          >
            디스코드 바로가기
          </a>
          <button
            type="button"
            className="service-button service-button--ghost"
            onClick={() => handleSelectBoard("support")}
          >
            버그제보 / QnA 보기
          </button>
        </>
      );
    }

    if (currentUser) {
      return (
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
      );
    }

    return (
      <>
        <Link to="/auth" className="service-button service-button--primary">
          로그인하고 자랑하기
        </Link>
        <Link to="/guide" className="service-button service-button--ghost">
          운영 가이드 보기
        </Link>
      </>
    );
  };

  const renderShowcaseBoard = () => (
    <div className="community-panel-stack">
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
            <div className="community-feed-toolbar__badges">
              <span className="service-badge service-badge--accent">
                {feedPosts.length}개 글
              </span>
              {currentUser ? (
                <span className="service-badge service-badge--cool">
                  {displayTamerName || "테이머"}
                </span>
              ) : null}
            </div>
            <div className="community-feed-toolbar__actions">
              {renderBoardToolbarActions("showcase")}
            </div>
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
            자랑게시판은 소개 카드보다 피드 탐색을 우선합니다. 대신 게시 전에 필요한 팁은
            접어서 정리해 두었습니다.
          </p>
          <ul className="community-guideline-list">
            {communityGuidelines.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );

  const renderFreeBoard = () => (
    <div className="community-panel-stack">
      <div className="community-feed-shell">
        <div className="community-feed-toolbar">
          <div>
            <p className="service-section-label">자유게시판</p>
            <h2>플레이 근황과 소소한 질문을 가볍게 나누는 공간</h2>
            <p className="service-muted">
              자유게시판은 일상 대화와 짧은 메모가 빠르게 오가는 보드로 두고, 자랑용
              기록과 운영 문의는 다른 보드로 분리해 흐름을 명확하게 유지합니다.
            </p>
          </div>

          <div className="community-feed-toolbar__aside">
            <div className="community-feed-toolbar__badges">
              <span className="service-badge service-badge--accent">
                추천 주제 {communityFreeBoardTopics.length}개
              </span>
              <span className="service-badge service-badge--cool">
                가벼운 대화 보드
              </span>
            </div>
            <div className="community-feed-toolbar__actions">
              {renderBoardToolbarActions("free")}
            </div>
          </div>
        </div>

        <div className="service-action-grid">
          {communityFreeBoardTopics.map((topic) => (
            <article
              key={topic.id}
              className="service-inline-panel community-board-info-card"
            >
              <p className="service-section-label">{topic.badge}</p>
              <strong>{topic.title}</strong>
              <span className="service-muted">{topic.description}</span>
            </article>
          ))}
        </div>

        <div className="community-public-note">
          <strong>대표 장면과 성장 로그가 중심인 글은 자랑게시판으로 분리해 두었습니다.</strong>
          <span>
            자유게시판은 공략 잡담, 오늘 플레이 근황, 짧은 질문처럼 빠르게 주고받는 대화
            흐름에 맞춰 운영합니다.
          </span>
        </div>
      </div>

      <details className="community-guideline-panel">
        <summary>자유게시판 운영 메모 보기</summary>
        <div className="community-guideline-panel__body">
          <p className="service-muted">
            대화형 보드는 읽는 속도가 중요해서, 질문과 근황이 한눈에 구분되도록 운영 기준을
            먼저 정리해 둡니다.
          </p>
          <ul className="community-guideline-list">
            {communityFreeBoardTips.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );

  const renderSupportBoard = () => (
    <div className="community-panel-stack">
      <div className="community-feed-shell">
        <div className="community-feed-toolbar">
          <div>
            <p className="service-section-label">버그제보 / QnA</p>
            <h2>재현 정보와 자주 묻는 질문을 한 번에 보기</h2>
            <p className="service-muted">
              오류 제보에 필요한 핵심 정보와 운영 FAQ를 같은 보드에 모아 두면, 질문과
              답변이 흩어지지 않고 다시 찾기 쉬워집니다.
            </p>
          </div>

          <div className="community-feed-toolbar__aside">
            <div className="community-feed-toolbar__badges">
              <span className="service-badge service-badge--accent">
                상태 카드 {supportStatusCards.length}개
              </span>
              <span className="service-badge service-badge--cool">
                FAQ {supportFaqs.length}개
              </span>
            </div>
            <div className="community-feed-toolbar__actions">
              {renderBoardToolbarActions("support")}
            </div>
          </div>
        </div>

        <div className="service-action-grid">
          {supportStatusCards.map((item) => (
            <article
              key={item.id}
              className="service-action-card community-board-info-card"
            >
              <strong>{item.title}</strong>
              <span className="service-muted">{item.description}</span>
            </article>
          ))}
        </div>
      </div>

      <div className="service-two-column">
        <div className="community-feed-shell">
          <div className="community-feed-toolbar">
            <div>
              <p className="service-section-label">자주 묻는 질문</p>
              <h2>FAQ</h2>
            </div>
          </div>

          <div className="community-panel-stack">
            {supportFaqs.map((faq) => (
              <div
                key={faq.id}
                className="service-inline-panel community-board-info-card"
              >
                <strong>{faq.question}</strong>
                <p className="service-muted">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="community-feed-shell">
          <div className="community-feed-toolbar">
            <div>
              <p className="service-section-label">버그 제보 체크리스트</p>
              <h2>함께 남기면 좋은 정보</h2>
            </div>
          </div>

          <ul className="service-list">
            {supportChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <div className="community-public-note">
            <strong>빠른 확인이 필요한 이슈는 디스코드 채널과 함께 운영해도 좋습니다.</strong>
            <span>
              긴 설명이 필요한 질문은 이 보드 기준으로 정리하고, 실시간 확인은 디스코드
              보드에서 안내하는 채널로 이어서 연결할 수 있습니다.
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDiscordBoard = () => (
    <div className="community-panel-stack">
      <div className="community-feed-shell">
        <div className="community-feed-toolbar">
          <div>
            <p className="service-section-label">디스코드 접속 정보</p>
            <h2>실시간 질문과 스냅샷 공유를 위한 입구</h2>
            <p className="service-muted">
              링크만 던져 두지 않고, 입장 후 먼저 볼 채널과 자주 쓰는 흐름까지 같이 안내해
              두면 커뮤니티 진입이 더 매끄럽습니다.
            </p>
          </div>

          <div className="community-feed-toolbar__aside">
            <div className="community-feed-toolbar__badges">
              <span className="service-badge service-badge--accent">
                권장 채널 {communityDiscordChannels.length}개
              </span>
              <span className="service-badge service-badge--cool">
                초대 링크 제공
              </span>
            </div>
            <div className="community-feed-toolbar__actions">
              {renderBoardToolbarActions("discord")}
            </div>
          </div>
        </div>

        <div className="community-public-note">
          <strong>{communityDiscordInvite.label}</strong>
          <span>{communityDiscordInvite.description}</span>
          <a
            href={communityDiscordInvite.url}
            target="_blank"
            rel="noreferrer"
            className="service-text-link"
          >
            {communityDiscordInvite.url}
          </a>
        </div>

        <div className="service-action-grid">
          {communityDiscordChannels.map((channel) => (
            <article
              key={channel.id}
              className="service-action-card community-board-info-card"
            >
              <strong>{channel.title}</strong>
              <span className="service-muted">{channel.description}</span>
            </article>
          ))}
        </div>
      </div>

      <details className="community-guideline-panel">
        <summary>디스코드 채널 이용 흐름 보기</summary>
        <div className="community-guideline-panel__body">
          <p className="service-muted">
            디스코드는 실시간 응답이 강점이라, 먼저 볼 채널과 제보 형식을 짧게 고정해 두는
            편이 운영 효율이 좋습니다.
          </p>
          <ul className="community-guideline-list">
            {communityDiscordChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );

  const renderActiveBoard = () => {
    switch (activeBoardId) {
      case "free":
        return renderFreeBoard();
      case "support":
        return renderSupportBoard();
      case "discord":
        return renderDiscordBoard();
      case "showcase":
      default:
        return renderShowcaseBoard();
    }
  };

  return (
    <section className="community-page">
      <div className="community-board-tabs" role="tablist" aria-label="커뮤니티 보드">
        {boardCards.map((board) => {
          const isActive = board.id === activeBoardId;

          return (
            <button
              key={board.id}
              id={`community-board-tab-${board.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`community-board-panel-${board.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => handleSelectBoard(board.id)}
              className={`community-board-tab${isActive ? " community-board-tab--active" : ""}`}
            >
              <span className="community-board-tab__label">{board.title}</span>
            </button>
          );
        })}
      </div>

      <header className="community-hero">
        <div className="community-hero__content">
          <div className="community-hero__eyebrow">
            <p className="service-section-label">커뮤니티</p>
            {activeBoardMeta ? (
              <span className="community-hero__status">{activeBoardMeta.status}</span>
            ) : null}
          </div>
          <h1>{activeBoardCopy.title}</h1>
          <p className="community-hero__description">{activeBoardCopy.description}</p>
        </div>
      </header>

      <div
        id={`community-board-panel-${activeBoardId}`}
        role="tabpanel"
        aria-labelledby={`community-board-tab-${activeBoardId}`}
        className="community-board-panel"
      >
        {renderActiveBoard()}
      </div>

      {currentUser && isShowcaseBoard ? (
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

      {isShowcaseBoard ? (
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
      ) : null}
    </section>
  );
}

export default Community;
