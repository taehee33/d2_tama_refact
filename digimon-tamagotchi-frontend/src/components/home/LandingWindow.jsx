import React from "react";

function LandingWindow({ eyebrow, title, subtitle, status, children }) {
  return (
    <section className="notebook-window">
      <header className="notebook-window__titlebar">
        <div className="notebook-window__lights" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="notebook-window__meta">
          <p className="notebook-window__eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          {subtitle ? <p className="notebook-window__subtitle">{subtitle}</p> : null}
        </div>
        {status ? <span className="notebook-window__status">{status}</span> : null}
      </header>

      <div className="notebook-window__body">{children}</div>
    </section>
  );
}

export default LandingWindow;
