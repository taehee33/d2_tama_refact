import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CommunityFreePostComposer from "../components/community/CommunityFreePostComposer";
import CommunityPostDetailDialog from "../components/community/CommunityPostDetailDialog";
import NewsPostRow from "../components/news/NewsPostRow";
import { useAuth } from "../contexts/AuthContext";
import {
  getNewsCategoryLabel,
  newsCategories,
  newsHighlights,
  newsOperatorNotes,
  newsPinnedPosts,
  newsRoadmap,
} from "../data/serviceContent";
import { useTamerProfile } from "../hooks/useTamerProfile";
import "../styles/news.css";
import {
  createCommunityComment,
  createCommunityPost,
  deleteCommunityComment,
  deleteCommunityPost,
  getCommunityBoardFeed,
  getCommunityPostDetail,
  updateCommunityComment,
  updateCommunityPost,
} from "../utils/communityApi";
import { formatTimestamp } from "../utils/dateUtils";

const NEWS_BOARD_ID = "news";
const NEWS_ALL_CATEGORY = "all";
const NEWS_DEFAULT_CATEGORY = "notice";
const TEXT_BOARD_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const TEXT_BOARD_IMAGE_MIME_TYPES = new Set([
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

function toDateTimeInputValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatRange(startsAt, endsAt) {
  const startLabel = startsAt ? formatTimestamp(startsAt, "short") : "";
  const endLabel = endsAt ? formatTimestamp(endsAt, "short") : "";
  const hasStartLabel = Boolean(startLabel && startLabel !== "N/A");
  const hasEndLabel = Boolean(endLabel && endLabel !== "N/A");

  if (hasStartLabel && hasEndLabel) {
    return `${startLabel} ~ ${endLabel}`;
  }

  if (hasStartLabel) {
    return `${startLabel}부터`;
  }

  if (hasEndLabel) {
    return `${endLabel}까지`;
  }

  return "";
}

function News() {
  const { currentUser } = useAuth();
  const { displayTamerName } = useTamerProfile();
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState("");
  const [selectedPostId, setSelectedPostId] = useState("");
  const [postDetail, setPostDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(NEWS_ALL_CATEGORY);
  const [isPinnedOpen, setIsPinnedOpen] = useState(false);
  const [canCreateNews, setCanCreateNews] = useState(false);
  const [editingPostId, setEditingPostId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState(NEWS_DEFAULT_CATEGORY);
  const [newsSummary, setNewsSummary] = useState("");
  const [newsVersion, setNewsVersion] = useState("");
  const [newsScope, setNewsScope] = useState("");
  const [newsStartsAt, setNewsStartsAt] = useState("");
  const [newsEndsAt, setNewsEndsAt] = useState("");
  const [newsFeatured, setNewsFeatured] = useState(false);
  const [imageDraft, setImageDraft] = useState(null);
  const [existingImagePath, setExistingImagePath] = useState("");
  const [existingImageUrl, setExistingImageUrl] = useState("");
  const [shouldRemoveExistingImage, setShouldRemoveExistingImage] = useState(false);
  const [imageErrorMessage, setImageErrorMessage] = useState("");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerLoading, setComposerLoading] = useState(false);
  const [composerError, setComposerError] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [editingCommentId, setEditingCommentId] = useState("");
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [commentActionId, setCommentActionId] = useState("");

  const refreshFeed = useCallback(async () => {
    if (!currentUser) {
      setPosts([]);
      setCanCreateNews(false);
      setPostsLoading(false);
      setPostsError("");
      return { posts: [], viewer: {} };
    }

    setPostsLoading(true);
    setPostsError("");

    try {
      const payload = await getCommunityBoardFeed(currentUser, NEWS_BOARD_ID);
      const nextPosts = payload?.posts ?? [];
      setPosts(nextPosts);
      setCanCreateNews(Boolean(payload?.viewer?.canCreate));
      return payload;
    } catch (error) {
      setPosts([]);
      setCanCreateNews(false);
      setPostsError(getErrorMessage(error, "소식 목록을 불러오지 못했습니다."));
      return { posts: [], viewer: {} };
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
        const detail = await getCommunityPostDetail(currentUser, NEWS_BOARD_ID, postId);
        setPostDetail(detail);
        return detail;
      } catch (error) {
        setPostDetail(null);
        setDetailError(getErrorMessage(error, "소식 상세를 불러오지 못했습니다."));
        return null;
      } finally {
        setDetailLoading(false);
      }
    },
    [currentUser]
  );

  useEffect(() => {
    refreshFeed();
  }, [refreshFeed]);

  useEffect(() => {
    if (!currentUser) {
      setSelectedPostId("");
      setPostDetail(null);
      setIsComposerOpen(false);
      return;
    }

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
  }, [currentUser, refreshPostDetail, selectedPostId]);

  const filteredPosts = useMemo(() => {
    if (categoryFilter === NEWS_ALL_CATEGORY) {
      return posts;
    }

    return posts.filter((post) => post.category === categoryFilter);
  }, [categoryFilter, posts]);

  const featuredPost = useMemo(
    () => posts.find((post) => post.newsContext?.featured) || posts[0] || null,
    [posts]
  );

  const resetComposer = useCallback(() => {
    setEditingPostId("");
    setCategory(NEWS_DEFAULT_CATEGORY);
    setTitle("");
    setBody("");
    setNewsSummary("");
    setNewsVersion("");
    setNewsScope("");
    setNewsStartsAt("");
    setNewsEndsAt("");
    setNewsFeatured(false);
    setImageDraft(null);
    setExistingImagePath("");
    setExistingImageUrl("");
    setShouldRemoveExistingImage(false);
    setImageErrorMessage("");
    setComposerError("");
  }, []);

  const handleCloseComposer = useCallback(() => {
    resetComposer();
    setIsComposerOpen(false);
  }, [resetComposer]);

  const handleTextBoardImageChange = useCallback(async (nextFile) => {
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

    if (!TEXT_BOARD_IMAGE_MIME_TYPES.has(nextFile.type)) {
      setImageDraft(null);
      setImageErrorMessage("JPG, PNG, WEBP 이미지만 첨부할 수 있습니다.");
      return;
    }

    if (nextFile.size > TEXT_BOARD_IMAGE_MAX_BYTES) {
      setImageDraft(null);
      setImageErrorMessage("이미지는 2MB 이하로 첨부해 주세요.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(nextFile);
      setImageDraft({
        dataUrl,
        fileName: nextFile.name || "community-image",
        mimeType: nextFile.type,
        size: nextFile.size,
      });
      setShouldRemoveExistingImage(false);
    } catch (error) {
      setImageDraft(null);
      setImageErrorMessage(getErrorMessage(error, "이미지를 준비하지 못했습니다."));
    }
  }, []);

  const handleTextBoardImageRemove = useCallback(() => {
    setImageErrorMessage("");

    if (imageDraft) {
      setImageDraft(null);
      return;
    }

    if (existingImagePath) {
      setShouldRemoveExistingImage(true);
    }
  }, [existingImagePath, imageDraft]);

  const buildNewsContextPayload = useCallback(
    () => ({
      summary: newsSummary,
      version: newsVersion,
      scope: newsScope,
      startsAt: newsStartsAt,
      endsAt: newsEndsAt,
      featured: newsFeatured,
    }),
    [newsEndsAt, newsFeatured, newsScope, newsStartsAt, newsSummary, newsVersion]
  );

  const handleSubmitPost = useCallback(
    async (event) => {
      event.preventDefault();
      setComposerLoading(true);
      setComposerError("");

      try {
        const nextPayload = {
          category,
          title,
          body,
          newsContext: buildNewsContextPayload(),
        };

        if (imageDraft) {
          nextPayload.image = {
            dataUrl: imageDraft.dataUrl,
            fileName: imageDraft.fileName,
            mimeType: imageDraft.mimeType,
          };
        } else if (existingImagePath && shouldRemoveExistingImage) {
          nextPayload.imageAction = "remove";
        }

        const savedPost = editingPostId
          ? await updateCommunityPost(currentUser, NEWS_BOARD_ID, editingPostId, nextPayload)
          : await createCommunityPost(currentUser, NEWS_BOARD_ID, nextPayload);

        handleCloseComposer();
        await refreshFeed();
        setSelectedPostId(savedPost.id);
      } catch (error) {
        setComposerError(getErrorMessage(error, "소식을 저장하지 못했습니다."));
      } finally {
        setComposerLoading(false);
      }
    },
    [
      body,
      buildNewsContextPayload,
      category,
      currentUser,
      editingPostId,
      existingImagePath,
      handleCloseComposer,
      imageDraft,
      refreshFeed,
      shouldRemoveExistingImage,
      title,
    ]
  );

  const handleEditPost = useCallback((post) => {
    setEditingPostId(post.id);
    setCategory(post.category || NEWS_DEFAULT_CATEGORY);
    setTitle(post.title || "");
    setBody(post.body || "");
    setNewsSummary(post.newsContext?.summary || "");
    setNewsVersion(post.newsContext?.version || "");
    setNewsScope(post.newsContext?.scope || "");
    setNewsStartsAt(toDateTimeInputValue(post.newsContext?.startsAt));
    setNewsEndsAt(toDateTimeInputValue(post.newsContext?.endsAt));
    setNewsFeatured(Boolean(post.newsContext?.featured));
    setImageDraft(null);
    setImageErrorMessage("");
    setExistingImagePath(post.imagePath || "");
    setExistingImageUrl(post.imageUrl || "");
    setShouldRemoveExistingImage(false);
    setComposerError("");
    setIsComposerOpen(true);
  }, []);

  const handleDeletePost = useCallback(
    async (postId) => {
      if (!currentUser || !window.confirm("이 소식을 삭제할까요?")) {
        return;
      }

      try {
        await deleteCommunityPost(currentUser, NEWS_BOARD_ID, postId);

        if (editingPostId === postId) {
          handleCloseComposer();
        }

        if (selectedPostId === postId) {
          setSelectedPostId("");
          setPostDetail(null);
        }

        await refreshFeed();
      } catch (error) {
        setPostsError(getErrorMessage(error, "소식을 삭제하지 못했습니다."));
      }
    },
    [currentUser, editingPostId, handleCloseComposer, refreshFeed, selectedPostId]
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
        await createCommunityComment(currentUser, NEWS_BOARD_ID, postDetail.post.id, {
          body: commentDraft,
        });
        setCommentDraft("");
        await Promise.all([refreshFeed(), refreshPostDetail(postDetail.post.id)]);
      } catch (error) {
        setCommentError(getErrorMessage(error, "댓글을 등록하지 못했습니다."));
      } finally {
        setCommentLoading(false);
      }
    },
    [commentDraft, currentUser, postDetail, refreshFeed, refreshPostDetail]
  );

  const handleSaveCommentEdit = useCallback(
    async (commentId) => {
      if (!currentUser || !postDetail?.post?.id) {
        return;
      }

      setCommentActionId(commentId);
      setCommentError("");

      try {
        await updateCommunityComment(currentUser, NEWS_BOARD_ID, commentId, {
          body: editingCommentBody,
        });
        setEditingCommentId("");
        setEditingCommentBody("");
        await Promise.all([refreshFeed(), refreshPostDetail(postDetail.post.id)]);
      } catch (error) {
        setCommentError(getErrorMessage(error, "댓글을 수정하지 못했습니다."));
      } finally {
        setCommentActionId("");
      }
    },
    [currentUser, editingCommentBody, postDetail, refreshFeed, refreshPostDetail]
  );

  const handleDeleteComment = useCallback(
    async (commentId) => {
      if (!currentUser || !postDetail?.post?.id || !window.confirm("이 댓글을 삭제할까요?")) {
        return;
      }

      setCommentActionId(commentId);
      setCommentError("");

      try {
        await deleteCommunityComment(currentUser, NEWS_BOARD_ID, commentId);

        if (editingCommentId === commentId) {
          setEditingCommentId("");
          setEditingCommentBody("");
        }

        await Promise.all([refreshFeed(), refreshPostDetail(postDetail.post.id)]);
      } catch (error) {
        setCommentError(getErrorMessage(error, "댓글을 삭제하지 못했습니다."));
      } finally {
        setCommentActionId("");
      }
    },
    [currentUser, editingCommentId, postDetail, refreshFeed, refreshPostDetail]
  );

  const composerImagePreviewUrl =
    imageDraft?.dataUrl || (!shouldRemoveExistingImage ? existingImageUrl : "");
  const composerImageName =
    imageDraft?.fileName ||
    (!shouldRemoveExistingImage && existingImagePath ? "현재 첨부 이미지" : "");
  const composerHasExistingImage = Boolean(existingImagePath) && !shouldRemoveExistingImage;

  return (
    <section className="service-page service-page--news news-page">
      <div className="service-card service-card--warm news-hero">
        <div className="news-hero__intro">
          <p className="service-section-label">소식</p>
          <h1>업데이트 소식</h1>
          <p className="service-muted">
            운영팀이 발행하는 공지, 패치 노트, 이벤트, 점검 일정을 한 곳에서 정리합니다.
          </p>
        </div>

        {currentUser && featuredPost ? (
          <article className="news-featured-card">
            <div className="news-featured-card__meta">
              {featuredPost.newsContext?.featured ? (
                <span className="service-badge">대표 소식</span>
              ) : null}
              <span className="service-badge service-badge--accent">
                {getNewsCategoryLabel(featuredPost.category)}
              </span>
              <span className="news-featured-card__timestamp">
                {formatTimestamp(featuredPost.createdAt, "long")}
              </span>
            </div>
            <h2>{featuredPost.title}</h2>
            <p>
              {featuredPost.newsContext?.summary ||
                featuredPost.body ||
                "대표 소식의 요약이 여기에 표시됩니다."}
            </p>
            <div className="news-featured-card__chips">
              {featuredPost.newsContext?.version ? (
                <span className="service-badge service-badge--cool">
                  {featuredPost.newsContext.version}
                </span>
              ) : null}
              {featuredPost.newsContext?.scope ? (
                <span className="service-badge">{featuredPost.newsContext.scope}</span>
              ) : null}
              {featuredPost.newsContext?.startsAt || featuredPost.newsContext?.endsAt ? (
                <span className="service-badge">
                  {formatRange(
                    featuredPost.newsContext?.startsAt,
                    featuredPost.newsContext?.endsAt
                  )}
                </span>
              ) : null}
            </div>
            <div className="news-featured-card__actions">
              <button
                type="button"
                className="service-button service-button--primary"
                onClick={() => setSelectedPostId(featuredPost.id)}
              >
                상세 보기
              </button>
            </div>
          </article>
        ) : (
          <article className="news-featured-card news-featured-card--placeholder">
            <p className="service-section-label">대표 소식 준비 중</p>
            {currentUser ? (
              <>
                <h2>첫 공지나 패치 노트를 발행하면 대표 소식이 여기에 올라옵니다.</h2>
                <p>featured 표시가 켜진 글이 있으면 우선 노출되고, 없으면 최신 글이 대신 표시됩니다.</p>
              </>
            ) : (
              <>
                <h2>소식 피드는 로그인 후 확인할 수 있습니다.</h2>
                <p>로그인하면 운영 공지, 패치 노트, 이벤트 일정을 한 화면에서 바로 읽을 수 있습니다.</p>
                <div className="news-featured-card__actions">
                  <Link to="/auth" className="service-button service-button--primary">
                    로그인하기
                  </Link>
                </div>
              </>
            )}
          </article>
        )}
      </div>

      <div className="community-feed-shell news-feed-shell">
        <div className="community-feed-toolbar">
          <div>
            <p className="service-section-label">공식 소식 피드</p>
            <h2>공지와 패치 흐름을 빠르게 읽는 공간</h2>
            <p className="service-muted">
              목록은 읽기 속도를 우선하고, 댓글은 상세 화면에서만 열어 운영 소식의 흐름을 유지합니다.
            </p>
          </div>

          <div className="community-feed-toolbar__aside">
            <div className="community-feed-toolbar__badges">
              <span className="service-badge service-badge--accent">
                안내 {newsPinnedPosts.length}개
              </span>
              <span className="service-badge service-badge--cool">
                {currentUser ? `${posts.length}개 소식` : "로그인 전용"}
              </span>
            </div>
            <div className="community-feed-toolbar__actions">
              {currentUser && canCreateNews ? (
                <button
                  type="button"
                  className="service-button service-button--primary"
                  onClick={() => {
                    resetComposer();
                    setIsComposerOpen(true);
                  }}
                >
                  소식 발행
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="community-free-pinned-section">
          <button
            type="button"
            className={`community-free-pinned-toggle${isPinnedOpen ? " community-free-pinned-toggle--open" : ""}`}
            onClick={() => setIsPinnedOpen((prev) => !prev)}
            aria-expanded={isPinnedOpen}
            aria-controls="news-pinned-posts"
          >
            <span>{isPinnedOpen ? "운영 메모 접기" : "운영 메모 펼치기"}</span>
            <span className="community-free-pinned-toggle__count">{newsPinnedPosts.length}개</span>
            <span className="community-free-pinned-toggle__arrow" aria-hidden="true" />
          </button>

          {isPinnedOpen ? (
            <div id="news-pinned-posts" className="service-action-grid community-free-pinned-grid">
              {newsPinnedPosts.map((item) => (
                <article key={item.id} className="service-inline-panel community-board-info-card">
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
            <strong>소식 피드는 로그인 후 확인할 수 있습니다.</strong>
            <span>공식 공지와 패치 노트, 이벤트 일정, 점검 안내를 로그인 후 한 번에 읽을 수 있습니다.</span>
          </div>
        ) : (
          <>
            <div className="community-free-filter-row" aria-label="소식 말머리 필터">
              {newsCategories.map((item) => {
                const isActive = categoryFilter === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`community-free-filter-chip${isActive ? " community-free-filter-chip--active" : ""}`}
                    onClick={() => setCategoryFilter(item.id)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {postsError ? <p className="community-error-text">{postsError}</p> : null}
            {postsLoading ? <p className="service-muted">소식 목록을 불러오는 중입니다...</p> : null}

            {!postsLoading && filteredPosts.length === 0 ? (
              <div className="community-empty-box">
                <strong>아직 등록된 소식이 없습니다.</strong>
                <span>첫 공지나 패치 노트를 발행하면 공식 소식 피드가 여기에서 시작됩니다.</span>
              </div>
            ) : (
              <div className="news-post-list">
                <div className="news-post-list__header" aria-hidden="true">
                  <span>말머리</span>
                  <span>제목</span>
                  <span>버전 · 대상</span>
                  <span>작성일</span>
                  <span>댓글</span>
                </div>

                {filteredPosts.map((post) => (
                  <NewsPostRow
                    key={post.id}
                    post={post}
                    isActive={selectedPostId === post.id}
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
        <summary>소식 탭 운영 메모 보기</summary>
        <div className="community-guideline-panel__body">
          <p className="service-muted">
            기존 정적 소식 카드는 운영 메모와 빈 상태 안내로 축소하고, 실제 피드에는 발행된 소식만 쌓이도록 구조를 바꿉니다.
          </p>

          <ul className="community-guideline-list">
            {newsOperatorNotes.map((item) => (
              <li key={item}>{item}</li>
            ))}
            {newsRoadmap.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <div className="service-action-grid">
            {newsHighlights.map((item) => (
              <article key={item.id} className="service-inline-panel community-board-info-card">
                <p className="service-section-label">{item.category}</p>
                <strong>{item.title}</strong>
                <span className="service-muted">{item.summary}</span>
              </article>
            ))}
          </div>
        </div>
      </details>

      {currentUser && canCreateNews ? (
        <CommunityFreePostComposer
          open={isComposerOpen}
          boardId={NEWS_BOARD_ID}
          displayTamerName={displayTamerName || "운영팀"}
          category={category}
          title={title}
          body={body}
          newsSummary={newsSummary}
          newsVersion={newsVersion}
          newsScope={newsScope}
          newsStartsAt={newsStartsAt}
          newsEndsAt={newsEndsAt}
          newsFeatured={newsFeatured}
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
          onNewsSummaryChange={setNewsSummary}
          onNewsVersionChange={setNewsVersion}
          onNewsScopeChange={setNewsScope}
          onNewsStartsAtChange={setNewsStartsAt}
          onNewsEndsAtChange={setNewsEndsAt}
          onNewsFeaturedChange={setNewsFeatured}
          onImageChange={handleTextBoardImageChange}
          onRemoveImage={handleTextBoardImageRemove}
          onSubmit={handleSubmitPost}
          onClose={handleCloseComposer}
        />
      ) : null}

      {currentUser && selectedPostId ? (
        <CommunityPostDetailDialog
          open={Boolean(selectedPostId)}
          boardId={NEWS_BOARD_ID}
          postDetail={postDetail}
          detailLoading={detailLoading}
          detailError={detailError}
          currentUser={currentUser}
          commentDraft={commentDraft}
          commentLoading={commentLoading}
          commentError={commentError}
          editingCommentId={editingCommentId}
          editingCommentBody={editingCommentBody}
          commentActionId={commentActionId}
          onClose={() => {
            setSelectedPostId("");
            setPostDetail(null);
            setDetailError("");
            setCommentDraft("");
            setCommentError("");
            setEditingCommentId("");
            setEditingCommentBody("");
            setCommentActionId("");
          }}
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

export default News;
