import React from "react";
import GuideOverview from "../components/guide/GuideOverview";
import { useAuth } from "../contexts/AuthContext";
import "../styles/guide.css";

function Guide() {
  const { currentUser } = useAuth();

  return (
    <section className="service-page service-page--guide">
      <div className="service-hero">
        <div className="service-hero__content guide-hero-copy">
          <div className="guide-hero-copy__title">
            <p className="service-section-label">가이드</p>
            <h1>디지몬 육성 가이드</h1>
          </div>
        </div>
      </div>

      <div className="service-card guide-hero-panel">
        <p className="service-section-label">먼저 보는 순서</p>
        <h2>홈에서 시작해 기록과 커뮤니티까지 자연스럽게 이어집니다</h2>
        <div className="guide-hero-panel__list">
          <article className="guide-hero-panel__item">
            <span>01</span>
            <div>
              <strong>홈 / 플레이 허브</strong>
              <p>최근 슬롯과 메타를 보고 오늘 이어갈 흐름을 고릅니다.</p>
            </div>
          </article>
          <article className="guide-hero-panel__item">
            <span>02</span>
            <div>
              <strong>게임 안 기본 루프</strong>
              <p>상태, 먹이, 훈련, 배틀, 교감과 케어 대응을 짧게 반복합니다.</p>
            </div>
          </article>
          <article className="guide-hero-panel__item">
            <span>03</span>
            <div>
              <strong>노트북 / 커뮤니티 / 설정</strong>
              <p>기록은 다시 보고, 질문은 나누고, 테마는 현재 서비스 분위기에 맞춰 조정합니다.</p>
            </div>
          </article>
        </div>
      </div>

      <GuideOverview currentUser={currentUser} />
    </section>
  );
}

export default Guide;
