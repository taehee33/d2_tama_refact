import React from "react";
import { landingHeroContent } from "../../data/landingContent";
import { SectionEyebrow } from "./ui/SectionEyebrow";
import { ScrollCue } from "./ui/ScrollCue";
import { ImageWithFallback } from "./figma/ImageWithFallback";

export function Hero() {
  const heroVisualStyle = landingHeroContent.backgroundArtworkSrc
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(6, 8, 12, 0.52), rgba(6, 8, 12, 0.82)), url(${landingHeroContent.backgroundArtworkSrc})`,
      }
    : undefined;

  return (
    <section className="landing-hero-section" aria-labelledby="landing-hero-title">
      <div className="landing-hero__stage">
        <div className="landing-constrain landing-hero">
          <div className="landing-hero__copy">
            <SectionEyebrow>{landingHeroContent.eyebrow}</SectionEyebrow>
            <h1 id="landing-hero-title" className="landing-hero__title">
              <span>{landingHeroContent.title[0]}</span>
              <span>{landingHeroContent.title[1]}</span>
            </h1>
            <p className="landing-hero__description">{landingHeroContent.description}</p>
          </div>

          <div className="landing-hero__visual" style={heroVisualStyle}>
            <div className="landing-hero__poster-noise" />
            <div className="landing-hero__poster-glow" />
            <div className="landing-hero__poster-ring landing-hero__poster-ring--outer" />
            <div className="landing-hero__poster-ring landing-hero__poster-ring--inner" />
            <ImageWithFallback
              src={landingHeroContent.imageSrc}
              alt={landingHeroContent.imageAlt}
              className="landing-hero__sprite"
              loading="eager"
            />
            <p className="landing-hero__poster-meta">{landingHeroContent.posterMeta}</p>
          </div>
        </div>
      </div>

      <ScrollCue href="#landing-intro" label="스크롤해 추억을 깨우기" />
    </section>
  );
}

export default Hero;
