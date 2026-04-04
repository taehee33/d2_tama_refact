import React, { useEffect, useState } from "react";
import { landingMemorySceneContent } from "../../data/landingContent";
import { SectionEyebrow } from "./ui/SectionEyebrow";
import { ImageWithFallback } from "./figma/ImageWithFallback";

export function Gallery() {
  const [selectedArtwork, setSelectedArtwork] = useState(null);
  const hasEyebrow = Boolean(landingMemorySceneContent.eyebrow);
  const hasTitle = Boolean(landingMemorySceneContent.title);
  const hasQuote = Boolean(landingMemorySceneContent.overlayQuote);
  const hasDescription = Boolean(landingMemorySceneContent.description);
  const featuredArtworkItems =
    landingMemorySceneContent.featuredArtworkItems?.length > 0
      ? landingMemorySceneContent.featuredArtworkItems
      : landingMemorySceneContent.featuredArtworkSrc
        ? [
            {
              id: "featured-artwork-fallback",
              src: landingMemorySceneContent.featuredArtworkSrc,
              alt: landingMemorySceneContent.featuredArtworkAlt,
              caption: landingMemorySceneContent.featuredArtworkCaption,
              position: landingMemorySceneContent.featuredArtworkPosition,
            },
          ]
        : [];
  const memorySceneStyle = landingMemorySceneContent.backgroundArtworkSrc
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(6, 8, 12, 0.36), rgba(6, 8, 12, 0.78)), url(${landingMemorySceneContent.backgroundArtworkSrc})`,
        backgroundPosition: landingMemorySceneContent.backgroundArtworkPosition,
        backgroundSize: landingMemorySceneContent.backgroundArtworkSize,
      }
    : undefined;
  const hasFeaturedArtwork = featuredArtworkItems.length > 0;

  useEffect(() => {
    if (!selectedArtwork) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setSelectedArtwork(null);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [selectedArtwork]);

  return (
    <section
      className="landing-section landing-memory-section"
      aria-labelledby={hasTitle ? "landing-memory-title" : undefined}
      aria-label={hasTitle ? undefined : "대표 장면 갤러리"}
    >
      <div
        className={`landing-memory-scene${hasFeaturedArtwork ? " landing-memory-scene--with-artwork" : ""}`}
        style={memorySceneStyle}
      >
        <div className="landing-memory-scene__grain" aria-hidden="true" />
        {!landingMemorySceneContent.backgroundArtworkSrc && !hasFeaturedArtwork ? (
          <div className="landing-memory-scene__sprite-band" aria-hidden="true">
            {landingMemorySceneContent.spriteBand.map((sprite) => (
              <ImageWithFallback
                key={sprite.id}
                src={sprite.src}
                alt={sprite.alt}
                className={`landing-memory-scene__sprite ${sprite.className}`}
              />
            ))}
          </div>
        ) : null}
        <div
          className={`landing-constrain landing-memory-scene__copy${
            hasFeaturedArtwork ? " landing-memory-scene__copy--with-artwork" : ""
          }`}
        >
          {hasEyebrow ? <SectionEyebrow>{landingMemorySceneContent.eyebrow}</SectionEyebrow> : null}
          {hasTitle ? (
            <h2 id="landing-memory-title" className="landing-memory-scene__title">
              {landingMemorySceneContent.title}
            </h2>
          ) : null}
          {hasQuote ? <p className="landing-memory-scene__quote">{landingMemorySceneContent.overlayQuote}</p> : null}
          {hasDescription ? (
            <p className="landing-memory-scene__description">
              {landingMemorySceneContent.description}
            </p>
          ) : null}
          {hasFeaturedArtwork ? (
            <div className="landing-memory-scene__featured-gallery" aria-label="중간 대표 장면">
              {featuredArtworkItems.map((artwork, index) => (
                <figure
                  key={artwork.id}
                  className={`landing-memory-scene__featured-card landing-memory-scene__featured-card--${
                    index + 1
                  }`}
                >
                  <button
                    type="button"
                    className="landing-memory-scene__featured-trigger"
                    onClick={() => setSelectedArtwork(artwork)}
                    aria-label={`${artwork.alt} 전체화면으로 보기`}
                  >
                    <ImageWithFallback
                      src={artwork.src}
                      alt={artwork.alt}
                      className="landing-memory-scene__featured-image"
                      style={{ objectPosition: artwork.position || "center" }}
                    />
                  </button>
                </figure>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {selectedArtwork ? (
        <div
          className="landing-memory-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedArtwork.alt} 전체화면 보기`}
          onClick={() => setSelectedArtwork(null)}
        >
          <button
            type="button"
            className="landing-memory-viewer__close"
            onClick={() => setSelectedArtwork(null)}
            aria-label="대표컷 전체화면 닫기"
          >
            닫기
          </button>
          <div
            className="landing-memory-viewer__content"
            onClick={(event) => event.stopPropagation()}
          >
            <ImageWithFallback
              src={selectedArtwork.src}
              alt={selectedArtwork.alt}
              className="landing-memory-viewer__image"
              style={{ objectPosition: selectedArtwork.position || "center" }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default Gallery;
