import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AdBanner from "../components/AdBanner";
import KakaoAd from "../components/KakaoAd";
import NewDigimonModal from "../components/play/NewDigimonModal";
import SlotCard from "../components/play/SlotCard";
import SlotOrderModal from "../components/play/SlotOrderModal";
import useTamerProfile from "../hooks/useTamerProfile";
import useUserSlots from "../hooks/useUserSlots";
import {
  getSlotDisplayName,
  getSlotSpriteSrc,
} from "../utils/slotViewUtils";
import {
  getSlotPrimaryInfo,
  getSlotSecondaryInfo,
} from "../utils/slotInfoUtils";
import {
  ACHIEVEMENT_VER1_MASTER,
  ACHIEVEMENT_VER2_MASTER,
} from "../utils/userProfileUtils";

function PlayHub() {
  const navigate = useNavigate();
  const { displayTamerName, achievements, maxSlots } = useTamerProfile();
  const {
    slots,
    loading,
    error,
    createSlot,
    deleteSlot,
    saveNickname,
    resetNickname,
    saveOrder,
    canCreateMore,
    recentSlot,
  } = useUserSlots({ maxSlots });

  const [showNewDigimonModal, setShowNewDigimonModal] = useState(false);
  const [openNicknameSlotId, setOpenNicknameSlotId] = useState(null);
  const [digimonNicknameEdits, setDigimonNicknameEdits] = useState({});
  const [orderedSlots, setOrderedSlots] = useState([]);
  const [initialOrderedSlots, setInitialOrderedSlots] = useState([]);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [highlightedSlotId, setHighlightedSlotId] = useState(null);
  const [pageError, setPageError] = useState("");
  const [isCreatingSlot, setIsCreatingSlot] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const showVer1Master = achievements.includes(ACHIEVEMENT_VER1_MASTER);
  const showVer2Master = achievements.includes(ACHIEVEMENT_VER2_MASTER);
  const hasSlots = slots.length > 0;

  const hasOrderChanged = useMemo(
    () =>
      orderedSlots.length === initialOrderedSlots.length &&
      orderedSlots.some((slot, index) => slot.id !== initialOrderedSlots[index]?.id),
    [initialOrderedSlots, orderedSlots]
  );

  const handleStartNewDigimon = async ({ device, version }) => {
    try {
      setIsCreatingSlot(true);
      setPageError("");
      const slotId = await createSlot({ device, version });
      setShowNewDigimonModal(false);
      navigate(`/play/${slotId}`);
    } catch (createError) {
      setPageError(createError.message || "새 디지몬을 시작하지 못했습니다.");
    } finally {
      setIsCreatingSlot(false);
    }
  };

  const handleDeleteSlot = async (slotId) => {
    if (!window.confirm(`슬롯 ${slotId}을 정말 삭제하시겠습니까?`)) {
      return;
    }

    try {
      setPageError("");
      await deleteSlot(slotId);
    } catch (deleteError) {
      setPageError(deleteError.message || "슬롯 삭제에 실패했습니다.");
    }
  };

  const handleSaveNickname = async (slotId) => {
    try {
      setPageError("");
      await saveNickname(slotId, digimonNicknameEdits[slotId] || "");
      setOpenNicknameSlotId(null);
    } catch (nicknameError) {
      setPageError(nicknameError.message || "별명 저장에 실패했습니다.");
    }
  };

  const handleResetNickname = async (slotId) => {
    try {
      setPageError("");
      await resetNickname(slotId);
      setOpenNicknameSlotId(null);
    } catch (nicknameError) {
      setPageError(nicknameError.message || "별명 초기화에 실패했습니다.");
    }
  };

  const handleOpenOrderModal = () => {
    const copiedSlots = [...slots];
    setOrderedSlots(copiedSlots);
    setInitialOrderedSlots(copiedSlots.map((slot) => ({ ...slot })));
    setHighlightedSlotId(null);
    setIsOrderModalOpen(true);
  };

  const handleMoveSlot = (index, nextIndex) => {
    if (nextIndex < 0 || nextIndex >= orderedSlots.length) {
      return;
    }

    const nextSlots = [...orderedSlots];
    const movedSlot = nextSlots[index];
    [nextSlots[index], nextSlots[nextIndex]] = [nextSlots[nextIndex], nextSlots[index]];
    setOrderedSlots(nextSlots);
    setHighlightedSlotId(movedSlot.id);
    window.setTimeout(() => setHighlightedSlotId(null), 800);
  };

  const handleCloseOrderModal = () => {
    if (hasOrderChanged && !window.confirm("변경한 순서를 저장하지 않고 닫을까요?")) {
      return;
    }

    setIsOrderModalOpen(false);
    setOrderedSlots([]);
    setInitialOrderedSlots([]);
    setHighlightedSlotId(null);
  };

  const handleSaveOrder = async () => {
    try {
      setIsSavingOrder(true);
      setPageError("");
      await saveOrder(orderedSlots);
      setIsOrderModalOpen(false);
      setOrderedSlots([]);
      setInitialOrderedSlots([]);
      setHighlightedSlotId(null);
    } catch (saveError) {
      setPageError(saveError.message || "순서 저장에 실패했습니다.");
    } finally {
      setIsSavingOrder(false);
    }
  };

  return (
    <section className="service-page service-page--play">
      <div className="service-hero">
        <div className="service-hero__content">
          <p className="service-section-label">플레이 허브</p>
          <h1>{displayTamerName}님의 디지몬 보관함</h1>
          <p>
            새 디지몬 시작, 이어하기, 순서 정리까지 한 화면에서 바로 처리합니다.
          </p>
          <div className="service-chip-row">
            <span className="service-badge">{`현재 ${slots.length} / 최대 ${maxSlots}`}</span>
            {showVer1Master ? (
              <span className="service-badge service-badge--accent">👑 Ver.1 마스터</span>
            ) : null}
            {showVer2Master ? (
              <span className="service-badge service-badge--cool">👑 Ver.2 마스터</span>
            ) : null}
          </div>
          <div className="service-inline-actions">
            <button
              type="button"
              className="service-button service-button--primary"
              onClick={() => setShowNewDigimonModal(true)}
              disabled={!canCreateMore}
            >
              새 디지몬 시작
            </button>
            {hasSlots ? (
              <button
                type="button"
                className="service-button service-button--ghost"
                onClick={handleOpenOrderModal}
              >
                슬롯 순서 정리
              </button>
            ) : null}
          </div>
        </div>

        <div className="service-hero__panel">
          <div className="service-card service-card--warm">
            <p className="service-section-label">최근 이어하기</p>
            {loading ? (
              <>
                <h2>슬롯을 불러오는 중입니다.</h2>
                <p className="service-muted">현재 계정의 디지몬 목록을 준비하고 있습니다.</p>
              </>
            ) : recentSlot ? (
              <>
                <div className="service-recent-slot">
                  <div className="service-slot-card__media service-recent-slot__media">
                    <img
                      src={getSlotSpriteSrc(recentSlot)}
                      alt={`${getSlotDisplayName(recentSlot)} 썸네일`}
                      className="service-slot-card__sprite"
                      style={{ imageRendering: "pixelated" }}
                    />
                  </div>
                  <div className="service-recent-slot__body">
                    <p className="service-section-label">{`슬롯 ${recentSlot.id}`}</p>
                    <h2>{getSlotDisplayName(recentSlot)}</h2>
                    <div className="service-slot-meta">
                      <p className="service-slot-meta__item">
                        {getSlotPrimaryInfo(recentSlot)}
                      </p>
                      <p className="service-slot-meta__item">
                        {getSlotSecondaryInfo(recentSlot)}
                      </p>
                    </div>
                    <div className="service-inline-actions">
                      <button
                        type="button"
                        className="service-button service-button--primary"
                        onClick={() => navigate(`/play/${recentSlot.id}`)}
                      >
                        이어하기
                      </button>
                      <button
                        type="button"
                        className="service-button service-button--ghost"
                        onClick={() => navigate(`/play/${recentSlot.id}/full`)}
                      >
                        몰입형 화면
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2>첫 디지몬을 시작하세요.</h2>
                <p>아직 슬롯이 없다면 새 디지타마를 열고 첫 성장 루트를 시작하면 됩니다.</p>
                <div className="service-inline-actions">
                  <button
                    type="button"
                    className="service-button service-button--primary"
                    onClick={() => setShowNewDigimonModal(true)}
                  >
                    첫 디지몬 시작
                  </button>
                  <Link className="service-button service-button--ghost" to="/guide">
                    가이드 보기
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {(pageError || error) ? (
        <div className="service-alert">
          {pageError || error?.message || "슬롯 정보를 불러오는 중 오류가 발생했습니다."}
        </div>
      ) : null}

      <div className="service-section-header">
        <div>
          <p className="service-section-label">내 디지몬</p>
          <h2>슬롯 목록</h2>
        </div>
        {hasSlots ? (
          <p className="service-muted">
            순서는 저장된 `displayOrder`를 따르며, 정렬 모달에서 바로 바꿀 수 있습니다.
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="service-empty-state">
          <div className="service-spinner" aria-hidden="true" />
          <h3>슬롯 데이터를 불러오는 중입니다.</h3>
          <p>현재 계정의 저장 슬롯과 최근 디지몬을 확인하고 있습니다.</p>
        </div>
      ) : !hasSlots ? (
        <div className="service-empty-state">
          <h3>아직 시작한 디지몬이 없습니다.</h3>
          <p>새 디지타마를 시작하면 이곳에 슬롯 카드와 이어하기 동선이 표시됩니다.</p>
          <div className="service-inline-actions">
            <button
              type="button"
              className="service-button service-button--primary"
              onClick={() => setShowNewDigimonModal(true)}
            >
              첫 디지몬 시작하기
            </button>
            <Link className="service-button service-button--ghost" to="/guide">
              진화 가이드 보기
            </Link>
          </div>
          <div className="service-mini-list">
            <Link className="service-mini-card" to="/guide">
              <strong>처음 시작할 때</strong>
              <span>기종별 차이와 기본 시스템을 먼저 훑어봅니다.</span>
            </Link>
            <Link className="service-mini-card" to="/support">
              <strong>저장 방식 확인</strong>
              <span>현재는 Firebase 계정과 Firestore 저장 기준으로 동작합니다.</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="service-slot-grid">
          {slots.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              isNicknameOpen={openNicknameSlotId === slot.id}
              nicknameValue={
                digimonNicknameEdits[slot.id] !== undefined
                  ? digimonNicknameEdits[slot.id]
                  : slot.digimonNickname || ""
              }
              onToggleNickname={() =>
                setOpenNicknameSlotId((currentSlotId) =>
                  currentSlotId === slot.id ? null : slot.id
                )
              }
              onNicknameChange={(nextNickname) =>
                setDigimonNicknameEdits((currentEdits) => ({
                  ...currentEdits,
                  [slot.id]: nextNickname,
                }))
              }
              onNicknameSave={() => handleSaveNickname(slot.id)}
              onNicknameReset={() => handleResetNickname(slot.id)}
              onContinue={() => navigate(`/play/${slot.id}`)}
              onImmersive={() => navigate(`/play/${slot.id}/full`)}
              onDelete={() => handleDeleteSlot(slot.id)}
            />
          ))}
        </div>
      )}

      {hasSlots ? (
        <>
          <div className="service-card service-card--soft">
            <p className="service-section-label">다음 이동</p>
            <h2>관련 페이지</h2>
            <div className="service-action-grid">
              <Link className="service-action-card" to="/guide">
                <strong>진화 가이드</strong>
                <span>조건표와 기본 시스템을 다시 확인합니다.</span>
                </Link>
                <Link className="service-action-card" to="/me">
                  <strong>테이머(설정)</strong>
                  <span>도감, 계정 설정, 최근 디지몬 카드로 이동합니다.</span>
                </Link>
              <Link className="service-action-card" to="/community">
                <strong>커뮤니티</strong>
                <span>실시간 채팅과 자랑 게시판 구성을 확인합니다.</span>
              </Link>
            </div>
          </div>

          <div className="service-ad-stack hidden lg:grid">
            <AdBanner />
            <KakaoAd />
          </div>
        </>
      ) : null}

      <NewDigimonModal
        open={showNewDigimonModal}
        onClose={() => setShowNewDigimonModal(false)}
        onStart={handleStartNewDigimon}
        isSubmitting={isCreatingSlot}
      />

      <SlotOrderModal
        open={isOrderModalOpen}
        orderedSlots={orderedSlots}
        highlightedSlotId={highlightedSlotId}
        onMoveUp={(index) => handleMoveSlot(index, index - 1)}
        onMoveDown={(index) => handleMoveSlot(index, index + 1)}
        onClose={handleCloseOrderModal}
        onSave={handleSaveOrder}
        isSaving={isSavingOrder}
      />
    </section>
  );
}

export default PlayHub;
