import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { SITE_THEME_OPTIONS, useTheme } from "../contexts/ThemeContext";

const landingBadges = [
  "게스트 시작 가능",
  "모바일 플레이 지원",
  "Ver.1 · Ver.2 성장 루트",
];

const starterFlow = [
  {
    step: "01",
    title: "디지타마 선택",
    description: "플레이 허브에서 원하는 기종과 버전을 고르고 첫 알을 엽니다.",
  },
  {
    step: "02",
    title: "키우기와 진화",
    description: "먹이, 훈련, 배틀 흐름을 따라 나만의 성장 루트를 만듭니다.",
  },
  {
    step: "03",
    title: "기록과 도감 정리",
    description: "마이 허브, 도감, 노트북으로 플레이 흔적을 이어서 모읍니다.",
  },
];

const publicExploreLinks = [
  {
    to: "/notebook",
    title: "노트북 둘러보기",
    description: "파일섬 감성의 공개 둘러보기 화면을 먼저 열어 보고 서비스 분위기를 확인합니다.",
  },
  {
    to: "/guide",
    title: "가이드 보기",
    description: "진화 조건, 기본 조작, 스탯 해석을 로그인 없이 먼저 읽어볼 수 있습니다.",
  },
  {
    to: "/support",
    title: "저장 방식 확인",
    description: "인증 방식, 저장 구조, 자주 묻는 질문을 한 번에 확인합니다.",
  },
];

const memberFeatures = [
  {
    title: "플레이 허브",
    description: "새 디지몬 시작, 최근 이어하기, 슬롯 순서 정리를 한 화면에서 처리합니다.",
  },
  {
    title: "몰입형 플레이",
    description: "슬롯별 전체 화면 경로로 더 집중해서 키울 수 있습니다.",
  },
  {
    title: "마이 허브와 도감",
    description: "내 디지몬 기록과 계정 설정, 수집 도감을 서비스 흐름으로 이어서 봅니다.",
  },
];

function Landing() {
  const { currentUser } = useAuth();
  const { themeId, isThemeLoading, setTheme } = useTheme();
  const primaryCta = currentUser
    ? { to: "/play", label: "플레이 허브 열기" }
    : { to: "/auth", label: "로그인하고 시작하기" };
  const bottomCta = currentUser
    ? { to: "/", label: "내 홈으로 돌아가기" }
    : { to: "/auth", label: "지금 시작하기" };
  const themeHint = currentUser
    ? "로그인된 상태에서도 둘러보기를 다시 보며 공개 탐색 페이지로 이동할 수 있습니다."
    : "비로그인 상태에서도 둘러보기 분위기를 먼저 바꿔볼 수 있습니다.";
  const bottomCopy = currentUser
    ? "현재 계정으로 바로 플레이 허브와 내 기록 흐름으로 이어서 이동할 수 있습니다."
    : "Google 로그인과 게스트 시작 중 원하는 방식으로 들어갈 수 있고, 이후에는 플레이 허브와 내 기록 흐름이 같은 계정 안에서 이어집니다.";

  return (
    <section className="service-page landing-page">
      <div className="service-hero landing-hero">
        <div className="service-hero__content landing-hero__content">
          <div className="landing-hero__copy">
            <p className="service-section-label">둘러보기</p>
            <h1>디지타마에서 시작해 나만의 디지몬을 키우는 웹 디지바이스</h1>
            <p>
              모바일 플레이, 성장 루트, 기록/도감/가이드 흐름을 한 서비스 안에서 자연스럽게
              이어주는 첫 진입점을 준비했습니다.
            </p>
          </div>

          <div className="service-chip-row">
            {landingBadges.map((badge) => (
              <span key={badge} className="service-badge">
                {badge}
              </span>
            ))}
          </div>

          <div className="service-inline-actions">
            <Link className="service-button service-button--primary" to={primaryCta.to}>
              {primaryCta.label}
            </Link>
            <Link className="service-button service-button--ghost" to="/notebook">
              노트북 둘러보기
            </Link>
            <Link className="service-text-link" to="/guide">
              가이드 먼저 보기
            </Link>
          </div>

          <div className="landing-theme-block">
            <div
              className="service-theme-switcher service-theme-switcher--wide"
              role="group"
              aria-label="서비스 테마 선택"
            >
              <span className="service-theme-switcher__label">테마</span>
              {SITE_THEME_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`service-theme-switcher__option${
                    themeId === option.id ? " service-theme-switcher__option--active" : ""
                  }`}
                  onClick={() => setTheme(option.id)}
                  disabled={isThemeLoading}
                  aria-pressed={themeId === option.id}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="service-theme-switcher__hint">
              {themeHint}
            </p>
          </div>
        </div>

        <div className="service-hero__panel">
          <div className="service-card service-card--warm landing-preview">
            <p className="service-section-label">첫 플레이 흐름</p>
            <h2>디지타마 선택 → 키우기 → 기록/도감 정리</h2>
            <div className="landing-flow">
              {starterFlow.map((item) => (
                <article key={item.step} className="landing-flow__item">
                  <span className="landing-flow__step">{item.step}</span>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
            <div className="service-chip-row">
              <span className="service-badge service-badge--accent">플레이 허브</span>
              <span className="service-badge service-badge--cool">몰입형 화면</span>
              <span className="service-badge">마이 허브</span>
            </div>
          </div>
        </div>
      </div>

      <div className="service-two-column landing-two-column">
        <div className="service-card service-card--mint">
          <p className="service-section-label">로그인 없이 둘러보기</p>
          <h2>먼저 탐색해 보기</h2>
          <div className="service-action-grid landing-card-grid">
            {publicExploreLinks.map((item) => (
              <Link key={item.to} className="service-action-card" to={item.to}>
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </Link>
            ))}
          </div>
          <div className="service-inline-actions">
            <Link className="service-text-link" to="/community">
              커뮤니티 구조 보기
            </Link>
            <Link className="service-text-link" to="/news">
              업데이트 소식 보기
            </Link>
          </div>
        </div>

        <div className="service-card service-card--soft">
          <p className="service-section-label">로그인 후 열리는 것</p>
          <h2>본격적으로 키우기</h2>
          <div className="landing-feature-list">
            {memberFeatures.map((item) => (
              <article key={item.title} className="landing-feature-card">
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="service-card landing-bottom-cta">
        <p className="service-section-label">Ready</p>
        <h2>처음은 가볍게, 이후에는 오래 키우기</h2>
        <p>{bottomCopy}</p>
        <div className="service-inline-actions">
          <Link className="service-button service-button--primary" to={bottomCta.to}>
            {bottomCta.label}
          </Link>
          <Link className="service-button service-button--ghost" to="/guide">
            성장 루트 먼저 보기
          </Link>
        </div>
      </div>
    </section>
  );
}

export default Landing;
