import React from "react";
import { Link } from "react-router-dom";
import EncyclopediaPanel from "../components/panels/EncyclopediaPanel";

function Collection() {
  return (
    <section className="service-page">
      <div className="service-hero service-hero--compact">
        <div className="service-hero__content">
          <p className="service-section-label">도감</p>
          <h1>발견한 디지몬 도감</h1>
          <p>버전별 수집 현황을 확인하고, 발견한 디지몬의 상세 정보를 다시 열어볼 수 있습니다.</p>
          <div className="service-inline-actions">
            <span className="service-badge">Ver.1 / Ver.2 통합 보기</span>
            <Link className="service-text-link" to="/me">
              ← 테이머(설정)로 돌아가기
            </Link>
          </div>
        </div>
      </div>

      <div className="service-card service-card--soft">
        <p className="service-section-label">컬렉션</p>
        <h2>버전별 도감 현황</h2>
        <EncyclopediaPanel />
      </div>
    </section>
  );
}

export default Collection;
