import React from "react";
import { newsHighlights, newsRoadmap } from "../data/serviceContent";

function News() {
  return (
    <section className="service-page">
      <div className="service-card service-card--warm">
        <p className="service-section-label">소식</p>
        <h1>업데이트 소식</h1>
        <p>
          지금은 정적 페이지지만, 실제 운영 공지와 패치 노트가 들어갈 구조를 먼저
          정리하고 있습니다.
        </p>
      </div>

      <div className="service-two-column">
        <div className="service-card">
          <p className="service-section-label">최근 반영</p>
          <h2>현재 코드 기준 주요 변경</h2>
          <div className="service-mini-list">
            {newsHighlights.map((item) => (
              <article key={item.id} className="service-mini-card">
                <strong>{item.title}</strong>
                <span>{item.summary}</span>
              </article>
            ))}
          </div>
        </div>

        <div className="service-card service-card--soft">
          <p className="service-section-label">다음 예정</p>
          <h2>운영 페이지 확장</h2>
          <ul className="service-list">
            {newsRoadmap.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="service-muted">
            실제 데이터 계층이 붙기 전까지는 이 페이지를 서비스 운영 메모 보드처럼 사용합니다.
          </p>
        </div>
      </div>
    </section>
  );
}

export default News;
