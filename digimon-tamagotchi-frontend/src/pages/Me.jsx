import React from "react";
import { Link, useNavigate } from "react-router-dom";
import useTamerProfile from "../hooks/useTamerProfile";
import useUserSlots from "../hooks/useUserSlots";
import {
  ACHIEVEMENT_VER1_MASTER,
  ACHIEVEMENT_VER2_MASTER,
} from "../utils/userProfileUtils";
import { getSlotDisplayName, getSlotStageLabel } from "../utils/slotViewUtils";

function Me() {
  const navigate = useNavigate();
  const { displayTamerName, achievements, maxSlots } = useTamerProfile();
  const { slots, loading } = useUserSlots({ maxSlots });

  return (
    <section className="service-page">
      <div className="service-hero service-hero--compact">
        <div className="service-hero__content">
          <p className="service-section-label">마이</p>
          <h1>{displayTamerName}님의 테이머 카드</h1>
          <p>현재 키우는 디지몬과 수집 현황, 계정 설정으로 바로 이동할 수 있습니다.</p>
          <div className="service-chip-row">
            <span className="service-badge">{`슬롯 ${slots.length} / ${maxSlots}`}</span>
            {achievements.includes(ACHIEVEMENT_VER1_MASTER) && (
              <span className="service-badge service-badge--accent">👑 Ver.1 마스터</span>
            )}
            {achievements.includes(ACHIEVEMENT_VER2_MASTER) && (
              <span className="service-badge service-badge--accent">👑 Ver.2 마스터</span>
            )}
          </div>
        </div>
      </div>

      <div className="service-two-column">
        <div className="service-card">
          <p className="service-section-label">빠른 메뉴</p>
          <h2>자주 여는 곳</h2>
          <div className="service-action-grid">
            <Link className="service-action-card" to="/me/collection">
              <strong>도감 보기</strong>
              <span>발견한 디지몬과 육성 기록을 도감 페이지에서 확인합니다.</span>
            </Link>
            <Link className="service-action-card" to="/me/settings">
              <strong>계정 설정</strong>
              <span>테이머명, 알림, 로그아웃을 설정 페이지에서 관리합니다.</span>
            </Link>
            <Link className="service-action-card" to="/guide">
              <strong>진화 가이드</strong>
              <span>진화 조건과 게임 팁을 가이드 페이지에서 다시 확인합니다.</span>
            </Link>
            <Link className="service-action-card" to="/play">
              <strong>플레이 허브</strong>
              <span>슬롯을 정리하고 새 디지몬을 시작합니다.</span>
            </Link>
          </div>
        </div>

        <div className="service-card service-card--mint">
          <p className="service-section-label">최근 디지몬</p>
          <h2>이어 키우기</h2>
          {loading ? (
            <p className="service-muted">슬롯을 불러오는 중입니다.</p>
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

export default Me;
