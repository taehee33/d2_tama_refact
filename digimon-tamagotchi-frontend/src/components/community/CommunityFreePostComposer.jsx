import React, { useEffect, useRef, useState } from "react";
import {
  communityFreeBoardCategories,
} from "../../data/serviceContent";
import CommunityDialog from "./CommunityDialog";

function CommunityFreePostComposer({
  open,
  displayTamerName,
  category,
  title,
  body,
  imagePreviewUrl,
  imageName,
  imageErrorMessage,
  hasExistingImage = false,
  isEditing,
  isSubmitting,
  errorMessage,
  onCategoryChange,
  onTitleChange,
  onBodyChange,
  onImageChange,
  onRemoveImage,
  onSubmit,
  onClose,
}) {
  const formId = "community-free-composer-form";
  const fileInputRef = useRef(null);
  const [localImagePreviewUrl, setLocalImagePreviewUrl] = useState("");
  const [localImageName, setLocalImageName] = useState("");
  const [localImageErrorMessage, setLocalImageErrorMessage] = useState("");
  const categoryOptions = communityFreeBoardCategories.filter((item) => item.id !== "all");
  const resolvedImagePreviewUrl = imagePreviewUrl || localImagePreviewUrl;
  const resolvedImageName = imageName || localImageName;
  const resolvedImageErrorMessage = imageErrorMessage || localImageErrorMessage;
  const hasVisibleImage = Boolean(resolvedImagePreviewUrl) || hasExistingImage;

  useEffect(() => {
    return () => {
      if (
        typeof localImagePreviewUrl === "string" &&
        localImagePreviewUrl.startsWith("blob:")
      ) {
        URL.revokeObjectURL(localImagePreviewUrl);
      }
    };
  }, [localImagePreviewUrl]);

  useEffect(() => {
    if (open) {
      return;
    }

    if (
      typeof localImagePreviewUrl === "string" &&
      localImagePreviewUrl.startsWith("blob:")
    ) {
      URL.revokeObjectURL(localImagePreviewUrl);
    }

    setLocalImagePreviewUrl("");
    setLocalImageName("");
    setLocalImageErrorMessage("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [localImagePreviewUrl, open]);

  const handleImageInputChange = async (event) => {
    const nextFile = event.target.files?.[0] || null;

    if (!nextFile) {
      return;
    }

    if (!nextFile.type.startsWith("image/")) {
      setLocalImageErrorMessage("이미지 파일만 첨부할 수 있습니다.");
      event.target.value = "";
      return;
    }

    if (nextFile.size > 2 * 1024 * 1024) {
      setLocalImageErrorMessage("이미지는 2MB 이하로 첨부해 주세요.");
      event.target.value = "";
      return;
    }

    if (typeof onImageChange === "function") {
      await onImageChange(nextFile);
    }

    if (
      typeof localImagePreviewUrl === "string" &&
      localImagePreviewUrl.startsWith("blob:")
    ) {
      URL.revokeObjectURL(localImagePreviewUrl);
    }

    const nextPreviewUrl = URL.createObjectURL(nextFile);
    setLocalImagePreviewUrl(nextPreviewUrl);
    setLocalImageName(nextFile.name);
    setLocalImageErrorMessage("");
  };

  const handleRemoveImage = () => {
    if (
      typeof localImagePreviewUrl === "string" &&
      localImagePreviewUrl.startsWith("blob:")
    ) {
      URL.revokeObjectURL(localImagePreviewUrl);
    }

    setLocalImagePreviewUrl("");
    setLocalImageName("");
    setLocalImageErrorMessage("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (typeof onRemoveImage === "function") {
      onRemoveImage();
    }
  };

  return (
    <CommunityDialog
      open={open}
      title={isEditing ? "자유게시판 글 수정" : "자유게시판 글쓰기"}
      eyebrow="글쓰기"
      onClose={onClose}
      size="md"
      className="community-free-composer-modal"
    >
      <div className="community-section-header">
        <p className="service-muted">
          자유게시판은 텍스트 중심으로 빠르게 읽히는 흐름을 우선합니다. 말머리와 제목을
          맞춰 두면 질문과 공략이 훨씬 잘 정리됩니다.
        </p>
        <span className="service-badge service-badge--accent">{displayTamerName || "테이머"}</span>
      </div>

      <form id={formId} className="community-panel-stack" onSubmit={onSubmit}>
        <label className="community-field">
          <span>말머리</span>
          <select
            className="community-input"
            value={category}
            onChange={(event) => onCategoryChange(event.target.value)}
            disabled={isSubmitting}
          >
            {categoryOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="community-field">
          <span>제목</span>
          <input
            className="community-input"
            type="text"
            value={title}
            maxLength={80}
            placeholder="예: 완전체 루트에서 실수 줄이는 팁 있나요?"
            onChange={(event) => onTitleChange(event.target.value)}
            disabled={isSubmitting}
          />
        </label>

        <label className="community-field">
          <span>본문</span>
          <textarea
            className="community-input community-input--textarea"
            value={body}
            maxLength={500}
            placeholder="오늘 플레이 근황, 질문, 공략 메모를 자유롭게 남겨 주세요."
            onChange={(event) => onBodyChange(event.target.value)}
            disabled={isSubmitting}
          />
        </label>

        <div className="community-field community-free-image-uploader">
          <div className="community-free-image-uploader__header">
            <span>이미지 첨부</span>
            <span className="community-free-image-uploader__hint">선택</span>
          </div>

          <p className="community-free-image-uploader__note">
            JPG, PNG, WebP 이미지를 1장만 첨부할 수 있습니다. 텍스트 보드 흐름을 위해
            목록에는 이미지를 보여주지 않고 상세에서만 노출합니다.
          </p>

          <div className="community-free-image-uploader__actions">
            <input
              ref={fileInputRef}
              className="community-free-image-uploader__input"
              type="file"
              aria-label="이미지 첨부"
              accept="image/*"
              onChange={handleImageInputChange}
              disabled={isSubmitting}
            />
            <button
              type="button"
              className="service-button service-button--ghost community-free-image-uploader__button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
            >
              {resolvedImagePreviewUrl || hasExistingImage ? "이미지 다시 선택" : "이미지 선택"}
            </button>
            {hasVisibleImage ? (
              <span className="community-free-image-uploader__status">
                {resolvedImageName || (hasExistingImage ? "기존 첨부 이미지" : "이미지 첨부됨")}
              </span>
            ) : null}
            {hasVisibleImage || resolvedImagePreviewUrl ? (
              <button
                type="button"
                className="service-text-link community-free-image-uploader__remove"
                onClick={handleRemoveImage}
                disabled={isSubmitting}
              >
                제거
              </button>
            ) : null}
          </div>

          {resolvedImagePreviewUrl ? (
            <figure className="community-free-image-uploader__preview">
              <img
                className="community-free-image-uploader__preview-image"
                src={resolvedImagePreviewUrl}
                alt={resolvedImageName ? `${resolvedImageName} 미리보기` : "첨부 이미지 미리보기"}
              />
              <figcaption className="community-free-image-uploader__preview-meta">
                <strong className="community-free-image-uploader__filename">
                  {resolvedImageName || "선택된 이미지"}
                </strong>
                <span className="community-free-image-uploader__preview-help">
                  업로드 전 미리보기입니다.
                </span>
              </figcaption>
            </figure>
          ) : null}

          {resolvedImageErrorMessage ? (
            <p className="community-error-text">{resolvedImageErrorMessage}</p>
          ) : null}
        </div>

        {errorMessage ? <p className="community-error-text">{errorMessage}</p> : null}

        <div className="community-action-row community-action-row--submit">
          <button
            type="submit"
            form={formId}
            className="service-button service-button--primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "저장 중..." : isEditing ? "수정 저장" : "글 올리기"}
          </button>
        </div>
      </form>
    </CommunityDialog>
  );
}

export default CommunityFreePostComposer;
