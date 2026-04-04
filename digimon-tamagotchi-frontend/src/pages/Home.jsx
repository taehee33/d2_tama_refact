import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import useTamerProfile from "../hooks/useTamerProfile";
import useUserSlots from "../hooks/useUserSlots";
import { getSlotDisplayName, getSlotStageLabel } from "../utils/slotViewUtils";
import {
  ACHIEVEMENT_VER1_MASTER,
  ACHIEVEMENT_VER2_MASTER,
} from "../utils/userProfileUtils";

function Home() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { displayTamerName, achievements, maxSlots } = useTamerProfile();
  const { slots, loading, recentSlot } = useUserSlots({ maxSlots });

  if (!currentUser) {
    return null;
  }

  return (
    <section className="service-page">
      <div className="service-hero">
        <div className="service-hero__content">
          <p className="service-section-label">홈</p>
          <h1>{displayTamerName}님, 오늘도 디지몬이 기다리고 있습니다.</h1>
          <p>최근 슬롯을 바로 이어서 플레이하거나, 플레이 허브에서 새 디지타마를 시작하세요.</p>
          <div className="service-chip-row">
            <span className="service-badge">{`현재 슬롯 ${slots.length} / ${maxSlots}`}</span>
            {achievements.includes(ACHIEVEMENT_VER1_MASTER) && (
              <span className="service-badge service-badge--accent">👑 Ver.1 마스터</span>
            )}
            {achievements.includes(ACHIEVEMENT_VER2_MASTER) && (
              <span className="service-badge service-badge--accent">👑 Ver.2 마스터</span>
            )}
          </div>
        </div>

        <div className="service-hero__panel">
          <div className="service-card service-card--mint">
            <p className="service-section-label">오늘 할 일</p>
            {loading ? (
              <p className="service-muted">최근 슬롯을 불러오는 중입니다.</p>
            ) : recentSlot ? (
              <>
                <h2>{getSlotDisplayName(recentSlot)}</h2>
                <p>{getSlotStageLabel(recentSlot)} 단계에서 다시 이어서 키울 수 있습니다.</p>
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
              </>
            ) : (
              <>
                <h2>새 디지몬 시작하기</h2>
                <p>플레이 허브에서 첫 번째 디지타마를 준비해 보세요.</p>
                <Link className="service-button service-button--primary" to="/play">
                  플레이 허브 열기
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="service-two-column">
        <div className="service-card">
          <p className="service-section-label">빠른 이동</p>
          <h2>다음 단계</h2>
          <div className="service-action-grid">
            <Link className="service-action-card" to="/play">
              <strong>플레이 허브</strong>
              <span>슬롯 정리, 새 디지몬 시작, 몰입형 화면 이동</span>
            </Link>
            <Link className="service-action-card" to="/notebook">
              <strong>노트북</strong>
              <span>한솔의 노트북과 파일섬 랜딩 화면으로 이동</span>
            </Link>
            <Link className="service-action-card" to="/me">
              <strong>테이머(설정)</strong>
              <span>내 디지몬과 도감, 계정 설정으로 바로 이동</span>
            </Link>
            <Link className="service-action-card" to="/guide">
              <strong>가이드</strong>
              <span>진화 루트와 게임 팁 다시 보기</span>
            </Link>
          </div>
        </div>

        <div className="service-card service-card--soft">
          <p className="service-section-label">최근 디지몬</p>
          <h2>바로 이어서 키우기</h2>
          {loading ? (
            <p className="service-muted">슬롯을 준비하고 있습니다.</p>
          ) : slots.length === 0 ? (
            <p className="service-muted">아직 시작한 디지몬이 없습니다.</p>
          ) : (
            <div className="service-mini-list">
              {slots.slice(0, 3).map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  className="service-mini-card"
                  onClick={() => navigate(`/play/${slot.id}`)}
                >
                  <strong>{getSlotDisplayName(slot)}</strong>
                  <span>{getSlotStageLabel(slot)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default Home;
