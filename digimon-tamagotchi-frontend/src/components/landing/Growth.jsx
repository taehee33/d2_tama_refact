import React from "react";
import { landingGrowthContent } from "../../data/landingContent";
import { SectionEyebrow } from "./ui/SectionEyebrow";
import { StatusBar } from "./ui/StatusBar";
import { ActionChip } from "./ui/ActionChip";
import { ImageWithFallback } from "./figma/ImageWithFallback";

export function Growth() {
  return (
    <section className="landing-section landing-growth-section" aria-labelledby="landing-growth-title">
      <div className="landing-constrain landing-growth">
        <div className="landing-growth__visual-card">
          <div className="landing-growth__visual-glow" aria-hidden="true" />
          <ImageWithFallback
            src={landingGrowthContent.imageSrc}
            alt={landingGrowthContent.imageAlt}
            className="landing-growth__sprite"
          />
          <p className="landing-growth__visual-caption">{landingGrowthContent.stage}</p>
        </div>

        <div className="landing-growth__copy">
          <SectionEyebrow>{landingGrowthContent.eyebrow}</SectionEyebrow>
          <h2 id="landing-growth-title" className="landing-section__title landing-growth__title">
            {landingGrowthContent.title}
          </h2>
          <p className="landing-growth__stage">{landingGrowthContent.stage}</p>
          <p className="landing-growth__description">{landingGrowthContent.description}</p>

          <div className="landing-growth__status-list">
            {landingGrowthContent.statusBars.map((statusBar) => (
              <StatusBar
                key={statusBar.label}
                label={statusBar.label}
                value={statusBar.value}
                tone={statusBar.tone}
              />
            ))}
          </div>

          <div className="landing-growth__actions" aria-label="첫 번째 파트너 인터랙션 라벨">
            {landingGrowthContent.actions.map((action) => (
              <ActionChip key={action}>{action}</ActionChip>
            ))}
          </div>

          <div className="landing-growth__next-card">
            <div>
              <p className="landing-growth__next-label">{landingGrowthContent.nextTitle}</p>
              <strong>{landingGrowthContent.nextName}</strong>
            </div>
            <ImageWithFallback
              src={landingGrowthContent.nextImageSrc}
              alt={landingGrowthContent.nextImageAlt}
              className="landing-growth__next-sprite"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default Growth;
