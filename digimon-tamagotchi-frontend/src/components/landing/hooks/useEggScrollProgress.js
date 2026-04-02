import { useEffect, useState } from "react";

export function clampEggProgress(progress) {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.max(0, Math.min(1, progress));
}

export function getEggScrollState(progress, totalStates = 4) {
  const clampedProgress = clampEggProgress(progress);

  if (totalStates <= 1) {
    return 0;
  }

  if (clampedProgress >= 1) {
    return totalStates - 1;
  }

  return Math.floor(clampedProgress * totalStates);
}

export function useEggScrollProgress(sectionId, totalStates = 4) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const section = document.getElementById(sectionId);

      if (!section) {
        setProgress(0);
        return;
      }

      const sectionTop = section.offsetTop;
      const scrollableDistance = Math.max(1, section.offsetHeight - window.innerHeight);
      const nextProgress = clampEggProgress((window.scrollY - sectionTop) / scrollableDistance);

      setProgress(nextProgress);
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, [sectionId]);

  return {
    progress,
    state: getEggScrollState(progress, totalStates),
  };
}

export default useEggScrollProgress;
