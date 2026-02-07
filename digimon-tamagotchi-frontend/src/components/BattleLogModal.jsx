// src/components/BattleLogModal.jsx
// 배틀 기록 전용 모달 (battleLogs 배열 표시)

import React, { useState, useMemo } from "react";
import { formatTimestamp } from "../utils/dateUtils";

const MODE_LABEL = { sparring: "스파링", arena: "아레나", quest: "퀘스트", skip: "건너뜀" };

const TABS = [
  { id: "all", label: "전체", mode: null },
  { id: "quest", label: "퀘스트", mode: "quest" },
  { id: "arena", label: "아레나", mode: "arena" },
  { id: "sparring", label: "스파링", mode: "sparring" },
  { id: "skip", label: "건너뜀", mode: "skip" },
];

/**
 * BattleLogModal
 * digimonStats.battleLogs만 표시 (배틀 기록 따로 관리). 모드별 탭 필터 지원.
 */
export default function BattleLogModal({ battleLogs = [], onClose }) {
  const [activeTab, setActiveTab] = useState("all");

  const sorted = useMemo(
    () => [...battleLogs].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
    [battleLogs]
  );

  const filtered = useMemo(() => {
    if (activeTab === "all") return sorted;
    const tab = TABS.find((t) => t.id === activeTab);
    if (!tab || tab.mode === null) return sorted;
    return sorted.filter((log) => log.mode === tab.mode);
  }, [sorted, activeTab]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 border-4 border-amber-600 rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto pixel-art-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
      >
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-2xl font-bold text-amber-400 pixel-art-text">⚔️ 배틀 기록</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-red-400 text-2xl font-bold pixel-art-button"
          >
            ✕
          </button>
        </div>
        <p className="text-gray-400 text-sm mb-4">최대 100개까지 저장됩니다.</p>

        {/* 모드별 탭 */}
        <div className="flex flex-wrap gap-1 mb-4 border-b border-gray-600 pb-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? "bg-amber-500 text-black"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white">
                {activeTab === "all" ? "배틀 기록이 없습니다." : "해당 종류의 기록이 없습니다."}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {filtered.map((log, index) => (
                <div
                  key={index}
                  className="bg-gray-700 border-2 border-gray-600 rounded p-3 pixel-art-card flex flex-wrap items-start justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    {log.mode && (
                      <span className="text-amber-400 text-xs font-semibold mr-2">
                        [{MODE_LABEL[log.mode] || log.mode}]
                      </span>
                    )}
                    {typeof log.win === "boolean" && (
                      <span className={log.win ? "text-green-400" : "text-red-400"}>({log.win ? "승" : "패"})</span>
                    )}
                    <p className="text-white text-sm break-words mt-0.5">{log.text || "-"}</p>
                  </div>
                  <div className="text-gray-400 text-xs whitespace-nowrap">
                    {formatTimestamp(log.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-amber-500 text-black font-bold rounded pixel-art-button hover:bg-amber-400"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
