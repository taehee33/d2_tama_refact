import { useEffect } from "react";

/**
 * 모달이 열린 동안 문서 스크롤을 잠그고 닫힐 때 원래 위치와 inline style을 복원합니다.
 * iOS Safari의 스크롤 체이닝을 막기 위해 html과 body를 함께 잠급니다.
 */
export default function useBodyScrollLock(isLocked = true) {
  useEffect(() => {
    if (!isLocked || typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    const root = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const rootStyles = {
      overflow: root.style.overflow,
      overscrollBehavior: root.style.getPropertyValue("overscroll-behavior"),
    };
    const bodyStyles = {
      overflow: body.style.overflow,
      overscrollBehavior: body.style.getPropertyValue("overscroll-behavior"),
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };

    root.style.overflow = "hidden";
    root.style.setProperty("overscroll-behavior", "none");
    body.style.overflow = "hidden";
    body.style.setProperty("overscroll-behavior", "none");
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    return () => {
      root.style.overflow = rootStyles.overflow;
      if (rootStyles.overscrollBehavior) {
        root.style.setProperty("overscroll-behavior", rootStyles.overscrollBehavior);
      } else {
        root.style.removeProperty("overscroll-behavior");
      }
      body.style.overflow = bodyStyles.overflow;
      if (bodyStyles.overscrollBehavior) {
        body.style.setProperty("overscroll-behavior", bodyStyles.overscrollBehavior);
      } else {
        body.style.removeProperty("overscroll-behavior");
      }
      body.style.position = bodyStyles.position;
      body.style.top = bodyStyles.top;
      body.style.left = bodyStyles.left;
      body.style.right = bodyStyles.right;
      body.style.width = bodyStyles.width;
      window.scrollTo(0, scrollY);
    };
  }, [isLocked]);
}
