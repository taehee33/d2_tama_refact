import React, { useEffect, useRef } from "react";

export default function HomeScreenInstallSection({
  id,
  title = "홈화면에 추가",
  description = null,
  headingTag: HeadingTag = "h3",
  sectionClassName = "",
  headerClassName = "",
  titleClassName = "font-semibold mb-2",
  descriptionClassName = "text-sm text-gray-600 mb-2",
  buttonClassName = "w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-semibold",
  installedBoxClassName = "p-3 bg-green-100 border border-green-400 rounded text-sm",
  unsupportedBoxClassName = "p-3 bg-gray-100 border border-gray-300 rounded text-sm",
  iosInstructionsClassName = "p-3 bg-blue-50 border border-blue-300 rounded text-sm",
  closeInstructionsButtonClassName = "mt-2 text-blue-600 hover:text-blue-800 underline text-xs",
  installState,
  showUnsupported = true,
  autoFocusOnMount = false,
}) {
  const sectionRef = useRef(null);
  const hasFocusedRef = useRef(false);

  useEffect(() => {
    if (!autoFocusOnMount) {
      hasFocusedRef.current = false;
      return;
    }

    if (!sectionRef.current || hasFocusedRef.current) {
      return;
    }

    sectionRef.current.scrollIntoView?.({ block: "start" });
    sectionRef.current.focus?.();
    hasFocusedRef.current = true;
  }, [autoFocusOnMount]);

  const {
    isInstalled = false,
    isInstallable = false,
    isIOS = false,
    showIOSInstructions = false,
    openInstallPrompt,
    setShowIOSInstructions = () => {},
  } = installState || {};

  const isActionable = !isInstalled && (isInstallable || isIOS);

  return (
    <section
      id={id}
      ref={sectionRef}
      role="region"
      aria-label={title}
      tabIndex={id || autoFocusOnMount ? -1 : undefined}
      className={sectionClassName}
    >
      {title || description ? (
        <div className={headerClassName}>
          {title ? <HeadingTag className={titleClassName}>{title}</HeadingTag> : null}
          {description ? <p className={descriptionClassName}>{description}</p> : null}
        </div>
      ) : null}

      {isInstalled ? (
        <div className={installedBoxClassName}>
          <p className="text-green-800">✅ 앱이 설치되어 있습니다!</p>
        </div>
      ) : isActionable ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              void openInstallPrompt?.();
            }}
            className={buttonClassName}
          >
            {isIOS ? "📱 iOS 설치 안내" : "📱 홈화면에 추가"}
          </button>

          {showIOSInstructions ? (
            <div className={iosInstructionsClassName}>
              <p className="font-semibold mb-2">iOS Safari 설치 방법:</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-700">
                <li>하단 공유 버튼(□↑) 탭</li>
                <li>"홈 화면에 추가" 선택</li>
                <li>"추가" 버튼 탭</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSInstructions(false)}
                className={closeInstructionsButtonClassName}
              >
                닫기
              </button>
            </div>
          ) : null}
        </div>
      ) : showUnsupported ? (
        <div className={unsupportedBoxClassName}>
          <p className="text-gray-600">이 브라우저에서는 설치가 지원되지 않습니다.</p>
          <p className="text-xs text-gray-500 mt-1">
            Chrome, Edge, Safari 등 최신 브라우저에서 사용 가능합니다.
          </p>
        </div>
      ) : null}
    </section>
  );
}
