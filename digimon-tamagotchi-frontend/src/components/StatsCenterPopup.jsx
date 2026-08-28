import React, { useEffect, useMemo, useRef, useState } from "react";
import DiagnosticsTab from "./stats-center/DiagnosticsTab";
import HealthRiskTab from "./stats-center/HealthRiskTab";
import StatusTab from "./stats-center/StatusTab";
import {
  buildStatsCenterViewModel,
  getDiagnosticsAccessState,
} from "./stats-center/statsCenterViewModel";

const STATUS_TAB = "STATUS";
const RISK_TAB = "RISK";
const DIAGNOSTICS_TAB = "DIAGNOSTICS";

const TAB_CONFIG = Object.freeze({
  [STATUS_TAB]: { id: "stats-center-status-tab", label: "[ 상태 ]" },
  [RISK_TAB]: { id: "stats-center-risk-tab", label: "[ 위험 ]" },
  [DIAGNOSTICS_TAB]: { id: "stats-center-diagnostics-tab", label: "[ 고급·진단 ]" },
});

export default function StatsCenterPopup({
  stats = {},
  activityLogs = [],
  digimonData = null,
  sleepStatus = "AWAKE",
  currentTime = null,
  canViewDiagnostics = false,
  isOperatorStatusLoading = false,
  onClose,
  onOpenLegacy,
  onSaveOperatorStats,
}) {
  const [activeTab, setActiveTab] = useState(STATUS_TAB);
  const statusTabRef = useRef(null);
  const riskTabRef = useRef(null);
  const diagnosticsTabRef = useRef(null);
  const diagnosticsAccessState = getDiagnosticsAccessState({
    canViewDiagnostics,
    isOperatorStatusLoading,
  });
  const canShowDiagnostics = diagnosticsAccessState === "allowed";
  const visibleTabs = canShowDiagnostics
    ? [STATUS_TAB, RISK_TAB, DIAGNOSTICS_TAB]
    : [STATUS_TAB, RISK_TAB];
  const tabRefs = {
    [STATUS_TAB]: statusTabRef,
    [RISK_TAB]: riskTabRef,
    [DIAGNOSTICS_TAB]: diagnosticsTabRef,
  };
  const viewModel = useMemo(
    () => buildStatsCenterViewModel({
      stats,
      activityLogs,
      digimonData,
      sleepStatus,
      currentTime,
    }),
    [activityLogs, currentTime, digimonData, sleepStatus, stats]
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

  // 권한이 회수된 렌더에서는 effect를 기다리지 않고 즉시 상태 탭을 노출한다.
  const visibleActiveTab = activeTab === DIAGNOSTICS_TAB && !canShowDiagnostics
    ? STATUS_TAB
    : activeTab;

  const handleTabKeyDown = (event) => {
    const supportedKeys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!supportedKeys.includes(event.key)) {
      return;
    }

    event.preventDefault();
    const currentTab = visibleTabs.find(
      (tab) => TAB_CONFIG[tab].id === event.currentTarget.id
    );
    const currentIndex = Math.max(0, visibleTabs.indexOf(currentTab));
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? visibleTabs.length - 1
        : event.key === "ArrowRight"
          ? (currentIndex + 1) % visibleTabs.length
          : (currentIndex - 1 + visibleTabs.length) % visibleTabs.length;
    const nextTab = visibleTabs[nextIndex];
    setActiveTab(nextTab);
    tabRefs[nextTab].current?.focus();
  };

  return (
    <div className="stats-center-popup fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div
        className="stats-center-popup__surface relative flex w-96 max-w-[calc(100vw-2rem)] flex-col rounded bg-white p-4 shadow-xl"
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
          {visibleTabs.map((tab) => {
            const isSelected = visibleActiveTab === tab;
            return (
              <button
                key={tab}
                ref={tabRefs[tab]}
                id={TAB_CONFIG[tab].id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls="stats-center-tabpanel"
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setActiveTab(tab)}
                onKeyDown={handleTabKeyDown}
                className={`px-4 py-2 font-bold ${
                  isSelected
                    ? "border-b-2 border-blue-500 text-blue-500"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {TAB_CONFIG[tab].label}
              </button>
            );
          })}
        </div>

        <div
          id="stats-center-tabpanel"
          className="stats-center-popup__content min-h-0 flex-1 overflow-y-auto"
          role="tabpanel"
          aria-labelledby={TAB_CONFIG[visibleActiveTab].id}
        >
          {visibleActiveTab === STATUS_TAB ? (
            <StatusTab
              items={viewModel.statusItems}
              sleepDisturbanceHistory={viewModel.sleepDisturbanceHistory}
            />
          ) : visibleActiveTab === RISK_TAB ? (
            <HealthRiskTab
              items={viewModel.healthRiskItems}
              lifespanInfo={viewModel.lifespanInfo}
            />
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
