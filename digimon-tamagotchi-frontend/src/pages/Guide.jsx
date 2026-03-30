import React from "react";
import { Link } from "react-router-dom";
import DigimonGuidePanel from "../components/panels/DigimonGuidePanel";
import { useAuth } from "../contexts/AuthContext";
import { digimonDataVer1 } from "../data/v1/digimons";
import { digimonDataVer2 } from "../data/v2modkor";

function Guide() {
  const { currentUser } = useAuth();
  const backTo = currentUser ? "/me" : "/";

  return (
    <section className="service-page">
      <div className="service-hero service-hero--compact">
        <div className="service-hero__content">
          <p className="service-section-label">가이드</p>
          <h1>디지몬 육성 가이드</h1>
          <p>진화 조건, 기본 조작, 디지몬 스탯 해석을 한곳에서 다시 확인할 수 있습니다.</p>
          <div className="service-inline-actions">
            <span className="service-badge">기본 정보 + 진화 가이드</span>
            <Link className="service-text-link" to={backTo}>
              ← 돌아가기
            </Link>
          </div>
        </div>
      </div>

      <div className="service-card service-card--soft">
        <p className="service-section-label">디지몬 가이드</p>
        <h2>정보와 팁</h2>
        <DigimonGuidePanel
          currentDigimonName={digimonDataVer1.Digitama?.name || "디지타마"}
          currentDigimonData={digimonDataVer1.Digitama}
          currentStats={{}}
          digimonDataMap={digimonDataVer1}
          slotVersion="Ver.1"
          digimonDataVer1={digimonDataVer1}
          digimonDataVer2={digimonDataVer2}
        />
      </div>
    </section>
  );
}

export default Guide;
