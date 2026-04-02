import React from "react";

export function ScrollCue({ href, label }) {
  return (
    <a className="landing-scroll-cue" href={href}>
      <span className="landing-scroll-cue__line" aria-hidden="true" />
      <span className="landing-scroll-cue__text">{label}</span>
      <span className="landing-scroll-cue__icon" aria-hidden="true">
        v
      </span>
    </a>
  );
}

export default ScrollCue;
