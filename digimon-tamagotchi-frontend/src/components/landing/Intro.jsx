import React from "react";
import { landingIntroContent } from "../../data/landingContent";
import { SectionEyebrow } from "./ui/SectionEyebrow";

export function Intro() {
  return (
    <section
      id="landing-intro"
      className="landing-section landing-intro-section"
      aria-labelledby="landing-intro-title"
    >
      <div className="landing-constrain landing-intro">
        <div className="landing-intro__copy">
          <SectionEyebrow>{landingIntroContent.eyebrow}</SectionEyebrow>
          <h2 id="landing-intro-title" className="landing-section__title">
            {landingIntroContent.title}
          </h2>
          <div className="landing-intro__body">
            {landingIntroContent.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <p className="landing-intro__caption">{landingIntroContent.caption}</p>
        </div>

        <div className="landing-intro__bridge">
          <p className="landing-intro__bridge-label">SCENE CHANGE</p>
          <p>{landingIntroContent.bridgeNote}</p>
        </div>
      </div>
    </section>
  );
}

export default Intro;
