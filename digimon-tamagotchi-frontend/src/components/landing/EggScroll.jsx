import React from "react";
import { landingEggStates } from "../../data/landingContent";
import { useEggScrollProgress } from "./hooks/useEggScrollProgress";
import { SectionEyebrow } from "./ui/SectionEyebrow";
import { ImageWithFallback } from "./figma/ImageWithFallback";

const SECTION_ID = "landing-egg-scroll";

export function EggScroll() {
  const { progress, state } = useEggScrollProgress(SECTION_ID, landingEggStates.length);
  const activeState = landingEggStates[state];

  return (
    <section
      id={SECTION_ID}
      className="landing-section landing-egg-section"
      aria-labelledby="landing-egg-title"
    >
      <div className="landing-egg">
        <div className="landing-egg__sticky">
          <div className="landing-egg__status">
            <div>
              <p className="landing-egg__hud-label">SYSTEM STATUS</p>
              <strong>{activeState.status}</strong>
            </div>
            <div>
              <p className="landing-egg__hud-label">SCROLL PROGRESS</p>
              <strong>{Math.round(progress * 100)}%</strong>
            </div>
          </div>

          <div className="landing-egg__visual">
            <div
              className={`landing-egg__frame landing-egg__frame--${activeState.key}`}
              style={{
                transform: `translateY(${progress * -16}px) scale(${1 + progress * 0.08}) rotate(${
                  (progress - 0.5) * 6
                }deg)`,
              }}
            >
              <div
                className="landing-egg__glow"
                style={{ opacity: 0.28 + progress * 0.62 }}
                aria-hidden="true"
              />
              <div className="landing-egg__noise" aria-hidden="true" />
              <ImageWithFallback
                src={activeState.imageSrc}
                alt={activeState.imageAlt}
                className="landing-egg__sprite"
              />
              {state >= 2 && (
                <>
                  <span className="landing-egg__crack landing-egg__crack--left" aria-hidden="true" />
                  <span
                    className="landing-egg__crack landing-egg__crack--right"
                    aria-hidden="true"
                  />
                </>
              )}
              {state === landingEggStates.length - 1 && (
                <span className="landing-egg__burst" aria-hidden="true" />
              )}
            </div>
            <div className="landing-egg__copy">
              <SectionEyebrow>{activeState.hudLabel}</SectionEyebrow>
              <h2 id="landing-egg-title" className="landing-section__title">
                {activeState.message}
              </h2>
              <p>{activeState.note}</p>
              <div className="landing-egg__meter" aria-hidden="true">
                <span style={{ width: `${((state + 1) / landingEggStates.length) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default EggScroll;
