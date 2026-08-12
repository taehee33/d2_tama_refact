import React, { useEffect, useMemo, useRef, useState } from "react";
import DiagnosticsTab from "./stats-center/DiagnosticsTab";
import StatusTab from "./stats-center/StatusTab";
import {
  buildStatsCenterViewModel,
  getDiagnosticsAccessState,
} from "./stats-center/statsCenterViewModel";

const STATUS_TAB = "STATUS";
const DIAGNOSTICS_TAB = "DIAGNOSTICS";

export default function StatsCenterPopup({
  stats = {},
  digimonData = null,
  sleepStatus = "AWAKE",
  canViewDiagnostics = false,
  isOperatorStatusLoading = false,
  onClose,
  onOpenLegacy,
  onSaveOperatorStats,
}) {
  const [activeTab, setActiveTab] = useState(STATUS_TAB);
  const statusTabRef = useRef(null);
  const diagnosticsTabRef = useRef(null);
  const diagnosticsAccessState = getDiagnosticsAccessState({
    canViewDiagnostics,
    isOperatorStatusLoading,
  });
  const canShowDiagnostics = diagnosticsAccessState === "allowed";
  const viewModel = useMemo(
    () => buildStatsCenterViewModel({ stats, digimonData, sleepStatus }),
    [digimonData, sleepStatus, stats]
  );

  useEffect(() => {
    statusTabRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!canShowDiagnostics && activeTab === DIAGNOSTICS_TAB) {
      setActiveTab(STATUS_TAB);
      statusTabRef.current?.focus();
    }
  }, [activeTab, canShowDiagnostics]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // 권한이 회수된 렌더에서는 effect를 기다리지 않고 즉시 상태 탭만 노출한다.
  const isStatusTab = activeTab === STATUS_TAB || !canShowDiagnostics;

  const handleTabKeyDown = (event) => {
    if (!canShowDiagnostics) {
      return;
    }

    const supportedKeys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!supportedKeys.includes(event.key)) {
      return;
    }

    event.preventDefault();
    const nextTab = event.key === "Home"
      ? STATUS_TAB
      : event.key === "End"
        ? DIAGNOSTICS_TAB
        : event.currentTarget.id === "stats-center-status-tab"
          ? DIAGNOSTICS_TAB
          : STATUS_TAB;
    setActiveTab(nextTab);
    (nextTab === STATUS_TAB ? statusTabRef : diagnosticsTabRef).current?.focus();
  };

  return (
    <div className="stats-center-popup fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div
        className="stats-center-popup__surface modal-mobile stats-popup-mobile relative flex w-96 max-w-[calc(100vw-2rem)] flex-col rounded bg-white p-4 shadow-xl"
        style={{ maxHeight: "80vh" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stats-center-title"
      >
        <div className="stats-center-popup__header mb-2 flex flex-shrink-0 items-center justify-between">
          <h2 id="stats-center-title" className="stats-center-popup__title text-lg font-bold">
            디지몬 상태
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="stats-center-popup__close rounded bg-red-500 px-3 py-1 text-sm font-bold text-white hover:bg-red-600"
            title="닫기"
            aria-label="스탯 센터 닫기"
          >
            ✕
          </button>
        </div>

        <div
          className="stats-center-popup__tabs mb-4 flex flex-shrink-0 gap-2 border-b"
          role="tablist"
          aria-label="스탯 센터 탭"
          aria-busy={diagnosticsAccessState === "loading"}
        >
          <button
            ref={statusTabRef}
            id="stats-center-status-tab"
            type="button"
            role="tab"
            aria-selected={isStatusTab}
            aria-controls="stats-center-tabpanel"
            tabIndex={isStatusTab ? 0 : -1}
            onClick={() => setActiveTab(STATUS_TAB)}
            onKeyDown={handleTabKeyDown}
            className={`px-4 py-2 font-bold ${
              isStatusTab
                ? "border-b-2 border-blue-500 text-blue-500"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            [ 상태 ]
          </button>
          {canShowDiagnostics && (
            <button
              ref={diagnosticsTabRef}
              id="stats-center-diagnostics-tab"
              type="button"
              role="tab"
              aria-selected={!isStatusTab}
              aria-controls="stats-center-tabpanel"
              tabIndex={isStatusTab ? -1 : 0}
              onClick={() => setActiveTab(DIAGNOSTICS_TAB)}
              onKeyDown={handleTabKeyDown}
              className={`px-4 py-2 font-bold ${
                !isStatusTab
                  ? "border-b-2 border-blue-500 text-blue-500"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              [ 고급·진단 ]
            </button>
          )}
        </div>

        <div
          id="stats-center-tabpanel"
          className="stats-center-popup__content min-h-0 flex-1 overflow-y-auto"
          role="tabpanel"
          aria-labelledby={
            isStatusTab ? "stats-center-status-tab" : "stats-center-diagnostics-tab"
          }
        >
          {isStatusTab ? (
            <StatusTab items={viewModel.statusItems} />
          ) : (
            <DiagnosticsTab
              sections={viewModel.diagnosticSections}
              stats={stats}
              digimonData={digimonData}
              onSaveOperatorStats={onSaveOperatorStats}
            />
          )}
        </div>

        <div className="mt-3 flex-shrink-0 border-t border-gray-200 pt-3">
          <button
            type="button"
            onClick={onOpenLegacy}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            기존 Old/New 화면 보기
          </button>
        </div>
      </div>
    </div>
  );
}
