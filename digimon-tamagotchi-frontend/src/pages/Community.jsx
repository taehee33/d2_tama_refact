import React, { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import CommunityFreePostComposer from "../components/community/CommunityFreePostComposer";
import CommunityFreePostRow from "../components/community/CommunityFreePostRow";
import CommunityPostCard from "../components/community/CommunityPostCard";
import CommunityPostComposer from "../components/community/CommunityPostComposer";
import CommunityPostDetailDialog from "../components/community/CommunityPostDetailDialog";
import { useAuth } from "../contexts/AuthContext";
import {
  communityBoards,
  communityDiscordChannels,
  communityDiscordInvite,
  communitySupportLink,
  communitySupportNotice,
  communityFreeBoardCategories,
  communityFreeBoardPinnedPosts,
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
  createCommunityComment,
  createCommunityPost,
  deleteCommunityComment,
  deleteCommunityPost,
  getCommunityPostDetail,
  listCommunityPosts,
  updateCommunityComment,
  updateCommunityPost,
} from "../utils/communityApi";
import { buildCommunityPreviewFromSlot } from "../utils/communitySnapshotUtils";

const FREE_BOARD_ALL_CATEGORY = "all";
const FREE_BOARD_DEFAULT_CATEGORY = "general";
const FREE_BOARD_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const FREE_BOARD_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function getErrorMessage(error, fallbackMessage) {
  return error instanceof Error ? error.message : fallbackMessage;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string" && reader.result) {
        resolve(reader.result);
        return;
      }

      reject(new Error("이미지 데이터를 읽지 못했습니다."));
    };

    reader.onerror = () => {
      reject(new Error("이미지 데이터를 읽지 못했습니다."));
    };

    reader.readAsDataURL(file);
  });
}

function isInteractiveBoard(boardId) {
  return boardId === "showcase" || boardId === "free";
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
  const [category, setCategory] = useState(FREE_BOARD_DEFAULT_CATEGORY);
  const [freeBoardFilter, setFreeBoardFilter] = useState(FREE_BOARD_ALL_CATEGORY);
  const [isFreePinnedOpen, setIsFreePinnedOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageDraft, setImageDraft] = useState(null);
  const [existingImagePath, setExistingImagePath] = useState("");
  const [existingImageUrl, setExistingImageUrl] = useState("");
  const [shouldRemoveExistingImage, setShouldRemoveExistingImage] = useState(false);
  const [imageErrorMessage, setImageErrorMessage] = useState("");
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

  const isShowcaseBoard = activeBoardId === "showcase";
  const isFreeBoard = activeBoardId === "free";

  const boardCards = useMemo(
    () =>
      communityBoards.map((board) => {
        if (board.id === "showcase") {
          return {
            ...board,
            status: currentUser ? "운영 중" : "샘플 공개 중",
          };
        }

        if (board.id === "free") {
          return {
            ...board,
            status: currentUser ? "운영 중" : "로그인 전용",
          };
        }

        return board;
      }),
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
    : isShowcaseBoard && selectedSamplePost
      ? { post: selectedSamplePost, comments: [] }
      : null;

  const feedPosts = currentUser
    ? posts
    : isShowcaseBoard
      ? communityShowcaseSamples
      : [];

  const activeBoardCopy = useMemo(() => {
    switch (activeBoardId) {
      case "free":
        return {
          title: "자유게시판",
          description:
            "플레이 근황, 공략 메모, 짧은 질문을 말머리와 함께 빠르게 나누는 텍스트 보드입니다.",
        };
      case "support":
        return {
          title: "버그제보 / QnA",
          description:
            "버그 제보 체크리스트와 FAQ를 한 화면에 모아 빠르게 확인하는 지원 보드입니다.",
        };
      case "discord":
        return {
          title: "디스코드/후원",
          description:
            "실시간 질문, 스냅샷 공유, 디스코드 입장과 운영 응원 링크를 함께 정리하는 커뮤니티 입구입니다.",
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

  const refreshPosts = useCallback(
    async (boardId = activeBoardId, options = {}) => {
      if (!currentUser || !isInteractiveBoard(boardId)) {
        setPosts([]);
        setPostsLoading(false);
        setPostsError("");
        return [];
      }

      const categoryFilter =
        boardId === "free"
          ? options.category ??
            (freeBoardFilter !== FREE_BOARD_ALL_CATEGORY ? freeBoardFilter : "")
          : "";

      setPostsLoading(true);
      setPostsError("");

      try {
        const nextPosts = await listCommunityPosts(currentUser, boardId, {
          category: categoryFilter,
        });
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
    },
    [activeBoardId, currentUser, freeBoardFilter]
  );

  const refreshPostDetail = useCallback(
    async (postId, boardId = activeBoardId) => {
      if (!currentUser || !postId || !isInteractiveBoard(boardId)) {
        setPostDetail(null);
        setDetailError("");
        return null;
      }

      setDetailLoading(true);
      setDetailError("");

      try {
        const detail = await getCommunityPostDetail(currentUser, boardId, postId);
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
    [activeBoardId, currentUser]
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

  const resolveDefaultComposerCategory = useCallback(
    () =>
      freeBoardFilter !== FREE_BOARD_ALL_CATEGORY
        ? freeBoardFilter
        : FREE_BOARD_DEFAULT_CATEGORY,
    [freeBoardFilter]
  );

  const resetComposer = useCallback(() => {
    setEditingPostId("");
    setTitle("");
    setBody("");
    setImageDraft(null);
    setExistingImagePath("");
    setExistingImageUrl("");
    setShouldRemoveExistingImage(false);
    setImageErrorMessage("");
    setComposerError("");
    setCategory(resolveDefaultComposerCategory());
  }, [resolveDefaultComposerCategory]);

  const handleCloseComposer = useCallback(() => {
    resetComposer();
    setIsComposerOpen(false);
  }, [resetComposer]);

  const handleOpenComposer = useCallback(() => {
    resetComposer();
    setIsComposerOpen(true);
  }, [resetComposer]);

  const handleFreeBoardImageChange = useCallback(async (nextFile) => {
    setImageErrorMessage("");

    const isFileLike =
      nextFile &&
      typeof nextFile === "object" &&
      typeof nextFile.type === "string" &&
      typeof nextFile.size === "number";

    if (!isFileLike) {
      setImageDraft(null);
      return;
    }

    if (!FREE_BOARD_IMAGE_MIME_TYPES.has(nextFile.type)) {
      setImageDraft(null);
      setImageErrorMessage("JPG, PNG, WEBP 이미지만 첨부할 수 있습니다.");
      return;
    }

    if (nextFile.size > FREE_BOARD_IMAGE_MAX_BYTES) {
      setImageDraft(null);
      setImageErrorMessage("이미지는 2MB 이하로 첨부해 주세요.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(nextFile);

      flushSync(() => {
        setImageDraft({
          dataUrl,
          fileName: nextFile.name || "community-image",
          mimeType: nextFile.type,
          size: nextFile.size,
        });
        setShouldRemoveExistingImage(false);
      });
    } catch (error) {
      setImageDraft(null);
      setImageErrorMessage(getErrorMessage(error, "이미지를 준비하지 못했습니다."));
    }
  }, []);

  const handleFreeBoardImageRemove = useCallback(() => {
    setImageErrorMessage("");

    if (imageDraft) {
      setImageDraft(null);
      return;
    }

    if (existingImagePath) {
      setShouldRemoveExistingImage(true);
    }
  }, [existingImagePath, imageDraft]);

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
    handleCloseComposer();
    handleCloseDetail();
    setPosts([]);
    setPostsError("");
    setPostsLoading(false);
    setIsFreePinnedOpen(false);
  }, [activeBoardId, handleCloseComposer, handleCloseDetail]);

  useEffect(() => {
    if (!currentUser || !isInteractiveBoard(activeBoardId)) {
      setPosts([]);
      setPostsError("");
      setPostsLoading(false);
      return;
    }

    refreshPosts(activeBoardId);
  }, [activeBoardId, currentUser, freeBoardFilter, refreshPosts]);

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
    if (!currentUser || !selectedPostId || !isInteractiveBoard(activeBoardId)) {
      return;
    }

    refreshPostDetail(selectedPostId, activeBoardId);
  }, [activeBoardId, currentUser, refreshPostDetail, selectedPostId]);

  const handleSelectBoard = useCallback(
    (boardId) => {
      const nextBoardId = resolveCommunityBoardId(`board=${boardId}`);

      setActiveBoardId(nextBoardId);
      navigate(getCommunityBoardHref(nextBoardId));
    },
    [navigate]
  );

  const handleSubmitPost = useCallback(
    async (event) => {
      event.preventDefault();
      setComposerLoading(true);
      setComposerError("");

      try {
        let savedPost = null;
        let nextCategoryFilter = freeBoardFilter;

        if (editingPostId) {
          const nextPayload = {
            ...(isFreeBoard ? { category } : {}),
            title,
            body,
          };

          if (isFreeBoard) {
            if (imageDraft) {
              nextPayload.image = {
                dataUrl: imageDraft.dataUrl,
                fileName: imageDraft.fileName,
                mimeType: imageDraft.mimeType,
              };
            } else if (existingImagePath && shouldRemoveExistingImage) {
              nextPayload.imageAction = "remove";
            }
          }

          savedPost = await updateCommunityPost(currentUser, activeBoardId, editingPostId, {
            ...nextPayload,
          });
        } else if (isFreeBoard) {
          const nextPayload = {
            category,
            title,
            body,
          };

          if (imageDraft) {
            nextPayload.image = {
              dataUrl: imageDraft.dataUrl,
              fileName: imageDraft.fileName,
              mimeType: imageDraft.mimeType,
            };
          }

          savedPost = await createCommunityPost(currentUser, "free", nextPayload);
        } else {
          savedPost = await createCommunityPost(currentUser, "showcase", {
            slotId: selectedSlot ? String(selectedSlot.id) : "",
            title,
            body,
            snapshot: preview,
          });
        }

        if (
          isFreeBoard &&
          freeBoardFilter !== FREE_BOARD_ALL_CATEGORY &&
          savedPost.category &&
          freeBoardFilter !== savedPost.category
        ) {
          nextCategoryFilter = savedPost.category;
          setFreeBoardFilter(savedPost.category);
        }

        resetComposer();
        setIsComposerOpen(false);
        await refreshPosts(activeBoardId, { category: nextCategoryFilter });
        setSelectedPostId(savedPost.id);
      } catch (error) {
        setComposerError(getErrorMessage(error, "게시글을 저장하지 못했습니다."));
      } finally {
        setComposerLoading(false);
      }
    },
    [
      activeBoardId,
      body,
      category,
      currentUser,
      editingPostId,
      existingImagePath,
      freeBoardFilter,
      imageDraft,
      isFreeBoard,
      preview,
      refreshPosts,
      resetComposer,
      selectedSlot,
      shouldRemoveExistingImage,
      title,
    ]
  );

  const handleEditPost = useCallback(
    (post) => {
      setEditingPostId(post.id);
      setTitle(post.title);
      setBody(post.body || "");
      setImageDraft(null);
      setImageErrorMessage("");
      setExistingImagePath(post.imagePath || "");
      setExistingImageUrl(post.imageUrl || "");
      setShouldRemoveExistingImage(false);
      setComposerError("");

      if (post.boardId === "showcase") {
        setSelectedSlotId(String(post.slotId));
      } else {
        setCategory(post.category || FREE_BOARD_DEFAULT_CATEGORY);
      }

      setIsComposerOpen(true);
    },
    []
  );

  const handleDeletePost = useCallback(
    async (postId) => {
      if (!currentUser || !window.confirm("이 게시글을 삭제할까요?")) {
        return;
      }

      try {
        await deleteCommunityPost(currentUser, activeBoardId, postId);

        if (editingPostId === postId) {
          handleCloseComposer();
        }

        if (selectedPostId === postId) {
          handleCloseDetail();
        }

        await refreshPosts(activeBoardId);
      } catch (error) {
        setPostsError(getErrorMessage(error, "게시글을 삭제하지 못했습니다."));
      }
    },
    [
      activeBoardId,
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
        await createCommunityComment(currentUser, activeBoardId, postDetail.post.id, {
          body: commentDraft,
        });
        setCommentDraft("");
        await Promise.all([
          refreshPosts(activeBoardId),
          refreshPostDetail(postDetail.post.id, activeBoardId),
        ]);
      } catch (error) {
        setCommentError(getErrorMessage(error, "댓글을 등록하지 못했습니다."));
      } finally {
        setCommentLoading(false);
      }
    },
    [activeBoardId, commentDraft, currentUser, postDetail, refreshPostDetail, refreshPosts]
  );

  const handleSaveCommentEdit = useCallback(
    async (commentId) => {
      if (!currentUser || !postDetail?.post?.id) {
        return;
      }

      setCommentActionId(commentId);
      setCommentError("");

      try {
        await updateCommunityComment(currentUser, activeBoardId, commentId, {
          body: editingCommentBody,
        });
        setEditingCommentId("");
        setEditingCommentBody("");
        await Promise.all([
          refreshPosts(activeBoardId),
          refreshPostDetail(postDetail.post.id, activeBoardId),
        ]);
      } catch (error) {
        setCommentError(getErrorMessage(error, "댓글을 수정하지 못했습니다."));
      } finally {
        setCommentActionId("");
      }
    },
    [
      activeBoardId,
      currentUser,
      editingCommentBody,
      postDetail,
      refreshPostDetail,
      refreshPosts,
    ]
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
        await deleteCommunityComment(currentUser, activeBoardId, commentId);

        if (editingCommentId === commentId) {
          setEditingCommentId("");
          setEditingCommentBody("");
        }

        await Promise.all([
          refreshPosts(activeBoardId),
          refreshPostDetail(postDetail.post.id, activeBoardId),
        ]);
      } catch (error) {
        setCommentError(getErrorMessage(error, "댓글을 삭제하지 못했습니다."));
      } finally {
        setCommentActionId("");
      }
    },
    [
      activeBoardId,
      currentUser,
      editingCommentId,
      postDetail,
      refreshPostDetail,
      refreshPosts,
    ]
  );

  const renderBoardToolbarActions = (boardId) => {
    if (boardId === "free") {
      if (currentUser) {
        return (
          <button
            type="button"
            className="service-button service-button--primary"
            onClick={handleOpenComposer}
          >
            글쓰기
          </button>
        );
      }

      return (
        <Link to="/auth" className="service-button service-button--primary">
          로그인하고 글쓰기
        </Link>
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
            디스코드/후원 보기
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
            디스코드 입장하기
          </a>
          <a
            href={communitySupportLink.url}
            target="_blank"
            rel="noreferrer"
            className="service-button service-button--ghost"
          >
            {communitySupportLink.label}
          </a>
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

  const composerImagePreviewUrl = imageDraft?.dataUrl ||
    (!shouldRemoveExistingImage ? existingImageUrl : "");
  const composerImageName = imageDraft?.fileName ||
    (!shouldRemoveExistingImage && existingImagePath ? "현재 첨부 이미지" : "");
  const composerHasExistingImage = Boolean(existingImagePath) && !shouldRemoveExistingImage;

  const renderShowcaseBoard = () => (
    <div className="community-panel-stack">
      <div className="community-feed-shell">
        <div className="community-feed-toolbar">
          <div>
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
              자유게시판은 카드보다 읽는 속도를 우선하는 텍스트 보드입니다. 말머리만 맞춰도
              질문과 공략이 훨씬 빠르게 정리됩니다.
            </p>
          </div>

          <div className="community-feed-toolbar__aside">
            <div className="community-feed-toolbar__badges">
              <span className="service-badge service-badge--accent">
                안내 {communityFreeBoardPinnedPosts.length}개
              </span>
              <span className="service-badge service-badge--cool">
                {currentUser ? `${posts.length}개 글` : "로그인 전용"}
              </span>
            </div>
            <div className="community-feed-toolbar__actions">
              {renderBoardToolbarActions("free")}
            </div>
          </div>
        </div>

        <div className="community-free-pinned-section">
          <button
            type="button"
            className={`community-free-pinned-toggle${isFreePinnedOpen ? " community-free-pinned-toggle--open" : ""}`}
            onClick={() => setIsFreePinnedOpen((prev) => !prev)}
            aria-expanded={isFreePinnedOpen}
            aria-controls="community-free-pinned-posts"
          >
            <span>{isFreePinnedOpen ? "안내 카드 접기" : "안내 카드 펼치기"}</span>
            <span className="community-free-pinned-toggle__count">
              {communityFreeBoardPinnedPosts.length}개
            </span>
            <span className="community-free-pinned-toggle__arrow" aria-hidden="true" />
          </button>

          {isFreePinnedOpen ? (
            <div
              id="community-free-pinned-posts"
              className="service-action-grid community-free-pinned-grid"
            >
              {communityFreeBoardPinnedPosts.map((item) => (
                <article
                  key={item.id}
                  className="service-inline-panel community-board-info-card"
                >
                  <p className="service-section-label">{item.badge}</p>
                  <strong>{item.title}</strong>
                  <span className="service-muted">{item.description}</span>
                </article>
              ))}
            </div>
          ) : null}
        </div>

        {!currentUser ? (
          <div className="community-empty-box">
            <strong>자유게시판 실제 글은 로그인 후 확인할 수 있습니다.</strong>
            <span>
              지금은 운영 안내만 먼저 공개됩니다. 로그인하면 목록, 상세, 댓글, 글쓰기가 모두
              열립니다.
            </span>
          </div>
        ) : (
          <>
            <div className="community-free-filter-row" aria-label="자유게시판 말머리 필터">
              {communityFreeBoardCategories.map((item) => {
                const isActive = freeBoardFilter === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`community-free-filter-chip${isActive ? " community-free-filter-chip--active" : ""}`}
                    onClick={() => setFreeBoardFilter(item.id)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {postsError ? <p className="community-error-text">{postsError}</p> : null}
            {postsLoading ? (
              <p className="service-muted">게시글을 불러오는 중입니다...</p>
            ) : null}

            {!postsLoading && posts.length === 0 ? (
              <div className="community-empty-box">
                <strong>아직 등록된 자유게시판 글이 없습니다.</strong>
                <span>첫 근황이나 질문을 남겨 대화를 시작해 보세요.</span>
              </div>
            ) : (
              <div className="community-free-post-list">
                <div className="community-free-post-list__header" aria-hidden="true">
                  <span>말머리</span>
                  <span>제목</span>
                  <span>글쓴이</span>
                  <span>작성일</span>
                  <span>관리</span>
                </div>

                {posts.map((post) => (
                  <CommunityFreePostRow
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
          </>
        )}
      </div>

      <details className="community-guideline-panel">
        <summary>자유게시판 운영 메모 보기</summary>
        <div className="community-guideline-panel__body">
          <ul className="community-guideline-list">
            {communityFreeBoardTips.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
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
            <strong>빠른 확인이 필요한 이슈는 디스코드/후원 보드와 함께 운영해도 좋습니다.</strong>
            <span>
              긴 설명이 필요한 질문은 이 보드 기준으로 정리하고, 실시간 확인이나 운영 응원
              안내는 디스코드/후원 보드에서 이어서 연결할 수 있습니다.
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDiscordBoard = () => (
    <div className="community-panel-stack">
      <div className="community-feed-shell">
        <p className="service-section-label">디스코드 / 후원</p>

        <div className="community-discord-support-layout">
          <section className="community-board-spotlight community-board-spotlight--discord">
            <div className="community-board-spotlight__header">
              <div className="community-board-spotlight__title-group">
                <p className="service-section-label">디스코드</p>
                <h3>디스코드 관련사항</h3>
              </div>
              <span className="community-board-spotlight__badge community-board-spotlight__badge--discord">
                채널 4개
              </span>
            </div>

            <div className="community-board-highlight community-board-highlight--discord">
              <strong>{communityDiscordInvite.label}</strong>
              <p className="community-board-highlight__description">
                {communityDiscordInvite.description}
              </p>
              <div className="community-board-highlight__actions">
                <a
                  href={communityDiscordInvite.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={communityDiscordInvite.label}
                  className="service-button community-board-link-button community-board-link-button--discord"
                >
                  디스코드 입장하기
                </a>
                <a
                  href={communityDiscordInvite.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${communityDiscordInvite.label} 주소`}
                  className="service-text-link community-board-highlight__url"
                >
                  {communityDiscordInvite.url}
                </a>
              </div>
            </div>

            <div className="community-discord-channel-grid">
              {communityDiscordChannels.map((channel) => (
                <article key={channel.id} className="community-discord-channel-card">
                  <strong>{channel.title}</strong>
                  <span>{channel.description}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="community-board-spotlight community-board-spotlight--support">
            <div className="community-board-spotlight__header">
              <div className="community-board-spotlight__title-group">
                <p className="service-section-label">후원</p>
                <h3>후원 관련사항</h3>
              </div>
              <span className="community-board-spotlight__badge community-board-spotlight__badge--support">
                Ko-fi
              </span>
            </div>

            <div className="community-board-highlight community-board-highlight--support">
              <strong>{communitySupportLink.label}</strong>
              <p className="community-board-highlight__description">
                {communitySupportNotice.description}
              </p>
              <div className="community-board-highlight__actions">
                <a
                  href={communitySupportLink.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={communitySupportLink.label}
                  className="service-button community-board-link-button community-board-link-button--support"
                >
                  Ko-fi로 응원하기
                </a>
                <a
                  href={communitySupportLink.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${communitySupportLink.label} 주소`}
                  className="service-text-link community-board-highlight__url"
                >
                  {communitySupportLink.url}
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>

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
            <p className="service-section-label">
              커뮤니티 &gt; {activeBoardMeta?.title || activeBoardCopy.title}
            </p>
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

      {currentUser && isFreeBoard ? (
        <CommunityFreePostComposer
          open={isComposerOpen}
          displayTamerName={displayTamerName}
          category={category}
          title={title}
          body={body}
          imagePreviewUrl={composerImagePreviewUrl}
          imageName={composerImageName}
          imageErrorMessage={imageErrorMessage}
          hasExistingImage={composerHasExistingImage}
          isEditing={Boolean(editingPostId)}
          isSubmitting={composerLoading}
          errorMessage={composerError}
          onCategoryChange={setCategory}
          onTitleChange={setTitle}
          onBodyChange={setBody}
          onImageChange={handleFreeBoardImageChange}
          onRemoveImage={handleFreeBoardImageRemove}
          onSubmit={handleSubmitPost}
          onClose={handleCloseComposer}
        />
      ) : null}

      {(currentUser ? Boolean(selectedPostId) : Boolean(selectedSamplePost)) ? (
        <CommunityPostDetailDialog
          open={currentUser ? Boolean(selectedPostId) : Boolean(selectedSamplePost)}
          boardId={currentUser ? activeBoardId : "showcase"}
          postDetail={detailData}
          detailLoading={detailLoading}
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
