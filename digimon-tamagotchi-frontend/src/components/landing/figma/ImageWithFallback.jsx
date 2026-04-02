import React, { useState } from "react";

function joinClassNames(...classNames) {
  return classNames.filter(Boolean).join(" ");
}

export function ImageWithFallback({
  src,
  fallbackSrc,
  alt,
  className = "",
  wrapperClassName = "",
  ...props
}) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  if (hasError && !fallbackSrc) {
    return (
      <div
        className={joinClassNames("landing-image-fallback", wrapperClassName, className)}
        role="img"
        aria-label={alt}
      />
    );
  }

  return (
    <img
      {...props}
      src={currentSrc}
      alt={alt}
      className={joinClassNames(wrapperClassName, className)}
      onError={() => {
        if (fallbackSrc && currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
          return;
        }
        setHasError(true);
      }}
    />
  );
}

export default ImageWithFallback;
