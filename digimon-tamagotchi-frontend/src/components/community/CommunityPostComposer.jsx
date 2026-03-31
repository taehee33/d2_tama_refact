import React from "react";

function CommunityPostComposer({
  displayTamerName,
  slots,
  selectedSlotId,
  preview,
  title,
  body,
  isEditing,
  isSubmitting,
  errorMessage,
  onSelectedSlotIdChange,
  onTitleChange,
  onBodyChange,
  onSubmit,
  onCancelEdit,
}) {
  const hasSlots = slots.length > 0;

  return (
    <div className="service-card community-composer">
      <div className="community-section-header">
        <div>
          <p className="service-section-label">글 작성</p>
          <h2>{isEditing ? "자랑 글 수정" : "내 슬롯에서 글 만들기"}</h2>
        </div>
        <span className="service-badge service-badge--accent">{displayTamerName || "테이머"}</span>
      </div>

      <p className="service-muted">
        슬롯 상태 스냅샷은 서버에서 다시 읽어 저장합니다. 제목과 짧은 코멘트만 입력하면 됩니다.
      </p>

      {!hasSlots ? (
        <div className="community-empty-box">
          <strong>게시 가능한 슬롯이 없습니다.</strong>
          <span>플레이 허브에서 슬롯을 먼저 만든 뒤 커뮤니티 글을 작성해 주세요.</span>
        </div>
      ) : (
        <form className="community-composer__form" onSubmit={onSubmit}>
          <label className="community-field">
            <span>대상 슬롯</span>
            <select
              className="community-input"
              value={selectedSlotId}
              onChange={(event) => onSelectedSlotIdChange(event.target.value)}
              disabled={isEditing || isSubmitting}
            >
              {slots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.slotName} · {slot.digimonDisplayName || slot.selectedDigimon || "디지몬"}
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
              placeholder="예: 오늘 드디어 완전체에 도달했어요"
              onChange={(event) => onTitleChange(event.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <label className="community-field">
            <span>한 줄 코멘트</span>
            <textarea
              className="community-input community-input--textarea"
              value={body}
              maxLength={500}
              placeholder="오늘 상태, 목표 진화, 자랑 포인트를 짧게 적어 주세요."
              onChange={(event) => onBodyChange(event.target.value)}
              disabled={isSubmitting}
            />
          </label>

          {preview ? (
            <div className="community-preview">
              <div className="community-preview__header">
                <strong>{preview.digimonDisplayName}</strong>
                <span>{preview.stageLabel}</span>
              </div>
              <div className="community-snapshot-chip-list">
                <span className="community-snapshot-chip">{preview.slotName}</span>
                <span className="community-snapshot-chip">{preview.version}</span>
                <span className="community-snapshot-chip">{preview.weight}g</span>
                <span className="community-snapshot-chip">케어 미스 {preview.careMistakes}</span>
                <span className="community-snapshot-chip">
                  배틀 {preview.totalBattlesWon}/{preview.totalBattles}
                </span>
                <span className="community-snapshot-chip">승률 {preview.winRate}%</span>
              </div>
            </div>
          ) : null}

          {errorMessage ? <p className="community-error-text">{errorMessage}</p> : null}

          <div className="community-action-row">
            <button
              type="submit"
              className="service-button service-button--primary"
              disabled={!hasSlots || isSubmitting}
            >
              {isSubmitting ? "저장 중..." : isEditing ? "수정 저장" : "자랑 글 올리기"}
            </button>
            {isEditing ? (
              <button
                type="button"
                className="service-button service-button--ghost"
                onClick={onCancelEdit}
                disabled={isSubmitting}
              >
                수정 취소
              </button>
            ) : null}
          </div>
        </form>
      )}
    </div>
  );
}

export default CommunityPostComposer;
