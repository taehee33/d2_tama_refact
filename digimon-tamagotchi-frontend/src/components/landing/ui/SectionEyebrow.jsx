import React from "react";

function joinClassNames(...classNames) {
  return classNames.filter(Boolean).join(" ");
}

export function SectionEyebrow({ children, className = "" }) {
  return <p className={joinClassNames("landing-ui-eyebrow", className)}>{children}</p>;
}

export default SectionEyebrow;
