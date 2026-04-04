import React from "react";
import { landingIntroContent } from "../../data/landingContent";
import { SectionEyebrow } from "./ui/SectionEyebrow";

export function Intro() {
  const bodyParagraphs = landingIntroContent.body.filter(Boolean);
  const hasCaption = Boolean(landingIntroContent.caption);
  const hasBridge = Boolean(landingIntroContent.bridgeNote);

  return (
    <section
      id="landing-intro"
      className="landing-section landing-intro-section"
      aria-labelledby="landing-intro-title"
    >
      <div className={`landing-constrain landing-intro${hasBridge ? "" : " landing-intro--compact"}`}>
        <div className="landing-intro__copy">
          <SectionEyebrow>{landingIntroContent.eyebrow}</SectionEyebrow>
          <h2 id="landing-intro-title" className="landing-section__title">
            {landingIntroContent.title}
          </h2>
          <div className="landing-intro__body">
            {bodyParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {hasCaption ? <p className="landing-intro__caption">{landingIntroContent.caption}</p> : null}
        </div>

        {hasBridge ? (
          <div className="landing-intro__bridge">
            <p className="landing-intro__bridge-label">SCENE CHANGE</p>
            <p>{landingIntroContent.bridgeNote}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default Intro;
