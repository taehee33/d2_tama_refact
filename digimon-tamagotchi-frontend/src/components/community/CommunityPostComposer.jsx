import React from "react";
import CommunityDialog from "./CommunityDialog";
import CommunitySnapshotScene from "./CommunitySnapshotScene";

function CommunityPostComposer({
  open,
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
  onClose,
}) {
  const hasSlots = slots.length > 0;
  const formId = "community-composer-form";

  return (
    <CommunityDialog
      open={open}
      title={isEditing ? "자랑 글 수정" : "내 디지몬 자랑"}
      eyebrow="자랑하기"
      onClose={onClose}
      size="xl"
      className="community-composer-modal"
    >
      <div className="community-section-header">
        <p className="service-muted">
          슬롯 상태 스냅샷은 서버에서 다시 읽어 저장합니다. 제목과 짧은 코멘트만 입력하면
          대표 장면 카드가 함께 올라갑니다.
        </p>
        <span className="service-badge service-badge--accent">{displayTamerName || "테이머"}</span>
      </div>

      {!hasSlots ? (
        <div className="community-empty-box">
          <strong>게시 가능한 슬롯이 없습니다.</strong>
          <span>플레이 허브에서 슬롯을 먼저 만든 뒤 커뮤니티 글을 작성해 주세요.</span>
        </div>
      ) : (
        <form id={formId} className="community-composer__form" onSubmit={onSubmit}>
          <div className="community-composer__layout">
            <div className="community-preview community-preview--spotlight">
              <div className="community-preview__header">
                <div>
                  <strong>{preview?.digimonDisplayName || "디지몬"}</strong>
                  <span>{preview?.stageLabel || "단계 미상"}</span>
                </div>
                <span className="service-badge service-badge--cool">
                  {preview?.slotName || "슬롯"}
                </span>
              </div>

              {preview ? <CommunitySnapshotScene snapshot={preview} variant="composer" /> : null}

              {preview ? (
                <div className="community-snapshot-chip-list">
                  <span className="community-snapshot-chip">{preview.version}</span>
                  <span className="community-snapshot-chip">{preview.weight}g</span>
                  <span className="community-snapshot-chip">케어 미스 {preview.careMistakes}</span>
                  <span className="community-snapshot-chip">
                    배틀 {preview.totalBattlesWon}/{preview.totalBattles}
                  </span>
                  <span className="community-snapshot-chip">승률 {preview.winRate}%</span>
                </div>
              ) : null}
            </div>

            <div className="community-composer__fields">
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
                <span>짧은 코멘트</span>
                <textarea
                  className="community-input community-input--textarea"
                  value={body}
                  maxLength={500}
                  placeholder="오늘 상태, 목표 진화, 자랑 포인트를 짧게 적어 주세요."
                  onChange={(event) => onBodyChange(event.target.value)}
                  disabled={isSubmitting}
                />
              </label>
            </div>
          </div>

          {errorMessage ? <p className="community-error-text">{errorMessage}</p> : null}

          <div className="community-action-row community-action-row--submit">
            <button
              type="submit"
              form={formId}
              className="service-button service-button--primary"
              disabled={!hasSlots || isSubmitting}
            >
              {isSubmitting ? "저장 중..." : isEditing ? "수정 저장" : "자랑 글 올리기"}
            </button>
          </div>
        </form>
      )}
    </CommunityDialog>
  );
}

export default CommunityPostComposer;
