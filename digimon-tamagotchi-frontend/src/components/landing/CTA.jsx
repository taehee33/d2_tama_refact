import React from "react";
import { Link } from "react-router-dom";
import { landingCtaContent } from "../../data/landingContent";
import { SectionEyebrow } from "./ui/SectionEyebrow";
import { ImageWithFallback } from "./figma/ImageWithFallback";

export function CTA({ isLoggedIn }) {
  const hasDescription = Boolean(landingCtaContent.description);
  const primaryAction = isLoggedIn
    ? { to: "/play", label: "플레이 허브 열기" }
    : { to: "/auth", label: "로그인하고 시작하기" };
  const secondaryAction = isLoggedIn
    ? { to: "/", label: "내 홈으로 돌아가기" }
    : { to: "/guide", label: "가이드 먼저 보기" };
  const auxiliaryLinks = landingCtaContent.publicLinks.slice(0, 2);

  return (
    <section className="landing-section landing-cta-section" aria-labelledby="landing-cta-title">
      <div className="landing-cta">
        <div className="landing-constrain landing-cta__copy-zone">
          <SectionEyebrow>{landingCtaContent.eyebrow}</SectionEyebrow>
          <h2 id="landing-cta-title" className="landing-section__title">
            {landingCtaContent.title}
          </h2>
          {hasDescription ? (
            <p className="landing-cta__description">{landingCtaContent.description}</p>
          ) : null}

          <div className="landing-cta__actions">
            <Link className="landing-button landing-button--primary" to={primaryAction.to}>
              {primaryAction.label}
            </Link>
            <Link className="landing-button landing-button--ghost" to={secondaryAction.to}>
              {secondaryAction.label}
            </Link>
          </div>

          <div className="landing-cta__links" aria-label="공개 둘러보기 링크">
            {auxiliaryLinks.map((link) => (
              <Link key={link.to} className="landing-cta__text-link" to={link.to}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {landingCtaContent.featuredImageSrc ? (
          <div className="landing-cta__image-zone">
            <div className="landing-cta__featured-image-wrap">
              <ImageWithFallback
                src={landingCtaContent.featuredImageSrc}
                alt={landingCtaContent.featuredImageAlt}
                className="landing-cta__featured-image"
                loading="lazy"
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default CTA;
