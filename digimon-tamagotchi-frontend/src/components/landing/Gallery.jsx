import React from "react";
import { landingMemorySceneContent } from "../../data/landingContent";
import { SectionEyebrow } from "./ui/SectionEyebrow";
import { ImageWithFallback } from "./figma/ImageWithFallback";

export function Gallery() {
  const memorySceneStyle = landingMemorySceneContent.backgroundArtworkSrc
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(6, 8, 12, 0.36), rgba(6, 8, 12, 0.78)), url(${landingMemorySceneContent.backgroundArtworkSrc})`,
      }
    : undefined;

  return (
    <section className="landing-section landing-memory-section" aria-labelledby="landing-memory-title">
      <div className="landing-memory-scene" style={memorySceneStyle}>
        <div className="landing-memory-scene__grain" aria-hidden="true" />
        {!landingMemorySceneContent.backgroundArtworkSrc ? (
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

        <div className="landing-constrain landing-memory-scene__copy">
          <SectionEyebrow>{landingMemorySceneContent.eyebrow}</SectionEyebrow>
          <h2 id="landing-memory-title" className="landing-memory-scene__title">
            {landingMemorySceneContent.title}
          </h2>
          <p className="landing-memory-scene__quote">{landingMemorySceneContent.overlayQuote}</p>
          <p className="landing-memory-scene__description">
            {landingMemorySceneContent.description}
          </p>
        </div>
      </div>
    </section>
  );
}

export default Gallery;
