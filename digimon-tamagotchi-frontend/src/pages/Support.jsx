import React from "react";
import { Link } from "react-router-dom";
import { supportChecklist, supportFaqs, supportStatusCards } from "../data/serviceContent";

function Support() {
  return (
    <section className="service-page">
      <div className="service-card">
        <p className="service-section-label">지원</p>
        <h1>도움말, 계정 방식, 버그 제보 가이드</h1>
        <p>
          현재 서비스 셸 기준 인증/저장 계약과, 문제 제보 시 같이 남기면 좋은 정보를 한
          화면에 정리했습니다.
        </p>
        <div className="service-inline-actions">
          <Link className="service-button service-button--ghost" to="/auth">
            로그인 화면 보기
          </Link>
          <Link className="service-button service-button--ghost" to="/guide">
            가이드 보기
          </Link>
        </div>
      </div>

      <div className="service-action-grid">
        {supportStatusCards.map((item) => (
          <article key={item.id} className="service-action-card">
            <strong>{item.title}</strong>
            <span>{item.description}</span>
          </article>
        ))}
      </div>

      <div className="service-two-column">
        <div className="service-card">
          <p className="service-section-label">자주 묻는 질문</p>
          <h2>FAQ</h2>
          <div className="space-y-4">
            {supportFaqs.map((faq) => (
              <div key={faq.id} className="service-inline-panel">
                <strong>{faq.question}</strong>
                <p className="service-muted">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="service-card service-card--soft">
          <p className="service-section-label">버그 제보 체크리스트</p>
          <h2>함께 남기면 좋은 정보</h2>
          <ul className="service-list">
            {supportChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default Support;
