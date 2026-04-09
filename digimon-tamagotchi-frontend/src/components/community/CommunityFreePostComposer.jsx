import React from "react";
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
  isEditing,
  isSubmitting,
  errorMessage,
  onCategoryChange,
  onTitleChange,
  onBodyChange,
  onSubmit,
  onClose,
}) {
  const formId = "community-free-composer-form";
  const categoryOptions = communityFreeBoardCategories.filter((item) => item.id !== "all");

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
