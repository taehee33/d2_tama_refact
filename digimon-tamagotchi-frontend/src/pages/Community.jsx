import React from "react";
import { communityBoards, communityGuidelines } from "../data/serviceContent";

function Community() {
  return (
    <section className="service-page">
      <div className="service-card service-card--mint">
        <p className="service-section-label">커뮤니티</p>
        <h1>내 디지몬 자랑과 기록을 모을 공간</h1>
        <p>
          자랑 피드, 진화 노트, 조그레스 모집처럼 서로 다른 성격의 커뮤니티를 구분할 수
          있도록 보드 구조를 먼저 정리했습니다.
        </p>
      </div>

      <div className="service-action-grid">
        {communityBoards.map((board) => (
          <article key={board.id} className="service-action-card">
            <strong>{board.title}</strong>
            <span>{board.description}</span>
            <span className="service-badge service-badge--cool">{board.status}</span>
          </article>
        ))}
      </div>

      <div className="service-two-column">
        <div className="service-card">
          <p className="service-section-label">운영 가이드</p>
          <h2>게시 전 체크</h2>
          <ul className="service-list">
            {communityGuidelines.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="service-card service-card--soft">
          <p className="service-section-label">현재 상태</p>
          <h2>실시간 채팅은 바로 사용 가능</h2>
          <p className="service-muted">
            우하단 채팅 버튼으로 실시간 대화를 열 수 있습니다. 게시글 데이터와
            조그레스 모집 흐름은 다음 라운드에서 이어서 연결하는 편이 안전합니다.
          </p>
        </div>
      </div>
    </section>
  );
}

export default Community;
