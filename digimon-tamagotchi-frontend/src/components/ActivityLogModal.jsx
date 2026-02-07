// src/components/ActivityLogModal.jsx
// 활동 로그 모달 컴포넌트 (종류별 탭 필터)

import React, { useState, useMemo } from "react";
import { formatTimestamp } from "../utils/dateUtils";

/** 수면 관련 로그: 잠듦/깨어남, 수면 방해, 수면 케어미스, 불 켜짐/꺼짐 */
function isSleepLog(log) {
  if (!log) return false;
  const t = log.type;
  const text = (log.text || "").trim();
  if (t === "SLEEP_START" || t === "SLEEP_END") return true;
  if (t === "CARE_MISTAKE" && (text.includes("수면 방해") || text.includes("수면 케어미스"))) return true;
  if (t === "ACTION" && text.includes("Lights")) return true;
  return false;
}

/** 케어미스 로그만: 배고픔/힘/수면 케어미스, 괴롭히기, Tired 등 (텍스트 또는 type 기준) */
function isCareMistakeLog(log) {
  if (!log) return false;
  if (log.type === "CAREMISTAKE") return true;
  if (log.type === "CARE_MISTAKE") {
    const text = (log.text || "").trim();
    return text.includes("케어미스") || text.includes("Care Mistake");
  }
  return false;
}

/** 활동 로그 탭: id, 라벨, types(배열) 또는 filter(함수) */
const ACTIVITY_TABS = [
  { id: "all", label: "전체", types: null },
  { id: "feed", label: "음식", types: ["FEED"] },
  { id: "sleep", label: "수면", filter: isSleepLog },
  { id: "care", label: "케어", filter: isCareMistakeLog },
  { id: "poop", label: "배변", types: ["POOP"] },
  { id: "heal", label: "치료", types: ["HEAL", "INJURY"] },
  { id: "train", label: "훈련", types: ["TRAIN"] },
  { id: "evolution", label: "진화", types: ["EVOLUTION", "REINCARNATION", "NEW_START"] },
  { id: "death", label: "생명", types: ["DEATH"] },
  { id: "fridge", label: "냉장고", types: ["FRIDGE"] },
  { id: "call", label: "호출", types: ["CALL"] },
  { id: "etc", label: "기타", types: ["ACTION", "CLEAN", "DIET", "REST", "DETOX", "PLAY_OR_SNACK"] },
];

/** 로그 한 건의 카테고리 라벨 (전체 탭에서 [카테고리] 표시용) */
function getActivityCategoryLabel(log) {
  if (!log) return "기타";
  const t = log.type;
  const text = (log.text || "").trim();
  if (t === "FEED") return "음식";
  if (isSleepLog(log)) return "수면";
  if (isCareMistakeLog(log)) return "케어";
  if (t === "POOP") return "배변";
  if (t === "HEAL" || t === "INJURY") return "치료";
  if (t === "TRAIN") return "훈련";
  if (t === "EVOLUTION" || t === "REINCARNATION" || t === "NEW_START") return "진화";
  if (t === "DEATH") return "생명";
  if (t === "FRIDGE") return "냉장고";
  if (t === "CALL") return "호출";
  return "기타";
}

/**
 * ActivityLogModal 컴포넌트
 * 디지몬의 활동 로그를 표시하는 모달. 종류별 탭으로 필터링.
 */
export default function ActivityLogModal({
  activityLogs = [],
  onClose,
}) {
  const [activeTab, setActiveTab] = useState("all");

  const sortedLogs = useMemo(
    () =>
      [...(activityLogs || [])].sort((a, b) => {
        const timeA = a.timestamp || 0;
        const timeB = b.timestamp || 0;
        return timeB - timeA;
      }),
    [activityLogs]
  );

  const filteredLogs = useMemo(() => {
    if (activeTab === "all") return sortedLogs;
    const tab = ACTIVITY_TABS.find((t) => t.id === activeTab);
    if (!tab) return sortedLogs;
    if (tab.filter && typeof tab.filter === "function") return sortedLogs.filter(tab.filter);
    if (tab.types) return sortedLogs.filter((log) => tab.types.includes(log.type));
    return sortedLogs;
  }, [sortedLogs, activeTab]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 border-4 border-yellow-500 rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto pixel-art-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
      >
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-2xl font-bold text-yellow-400 pixel-art-text">
            활동 로그
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-red-400 text-2xl font-bold pixel-art-button"
          >
            ✕
          </button>
        </div>
        <p className="text-gray-400 text-sm mb-4">최대 100개까지 저장됩니다.</p>

        {/* 종류별 탭 */}
        <div className="flex flex-wrap gap-1 mb-4 border-b border-gray-600 pb-2">
          {ACTIVITY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? "bg-yellow-500 text-black"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-2">
          {!activityLogs || activityLogs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white">활동 로그가 없습니다.</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white">해당 종류의 기록이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {filteredLogs.map((log, index) => (
                <div
                  key={index}
                  className="bg-gray-700 border-2 border-gray-600 rounded p-3 pixel-art-card flex flex-wrap items-start justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    {activeTab === "all" && (
                      <span className="text-yellow-400 text-xs font-semibold mr-2">
                        [{getActivityCategoryLabel(log)}]
                      </span>
                    )}
                    <p className="text-white text-sm break-words mt-0.5">
                      {log.text || log.type || "Unknown"}
                    </p>
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
            className="px-6 py-2 bg-yellow-500 text-black font-bold rounded pixel-art-button hover:bg-yellow-400"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
