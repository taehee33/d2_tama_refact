import React, { useEffect, useRef } from "react";

export default function ArenaDetailPanel({ title, onClose, children }) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.requestAnimationFrame(() => previousFocus?.focus?.());
    };
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-20 flex items-end sm:items-stretch sm:justify-end">
      <button
        type="button"
        aria-label="상세 패널 닫기"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/45"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="arena-detail-panel-title"
        className="relative z-10 max-h-[82%] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-h-none sm:w-[30rem] sm:rounded-none sm:rounded-l-2xl sm:p-6"
      >
        <header className="mb-5 flex items-center justify-between gap-3 border-b pb-3">
          <h3 id="arena-detail-panel-title" className="text-xl font-bold">{title}</h3>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={`${title} 닫기`}
            className="min-h-11 min-w-11 rounded-lg border border-gray-200 px-3 text-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >닫기</button>
        </header>
        {children}
      </aside>
    </div>
  );
}
