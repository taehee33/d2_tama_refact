import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  addMissingEncyclopediaEntries,
  loadEncyclopedia,
} from "../../hooks/useEncyclopedia";
import { getRequiredDigimonIds } from "../../logic/encyclopediaMaster";
import { translateStage } from "../../utils/stageTranslator";
import {
  SUPPORTED_DIGIMON_VERSIONS,
  getDigimonDataMapByVersion,
  getDigimonVersionByDigimonId,
} from "../../utils/digimonVersionUtils";
import EncyclopediaDetailModal from "../EncyclopediaDetailModal";
import "../../styles/Battle.css";

const ENCYCLOPEDIA_GRID_TEMPLATE = "repeat(auto-fit, minmax(8rem, 1fr))";

function getEncyclopediaEntry(versionData, digimonKey) {
  return (
    versionData[digimonKey] ||
    Object.entries(versionData).find(
      ([key]) => (key || "").toLowerCase() === (digimonKey || "").toLowerCase()
    )?.[1]
  );
}

function getDigimonList(version) {
  const dataMap = getDigimonDataMapByVersion(version);

  return getRequiredDigimonIds(version)
    .map((key) => ({
      listKey: key,
      id: key,
      ...dataMap[key],
    }))
    .sort((a, b) => {
      const stageOrder = {
        Digitama: 0,
        "Baby I": 1,
        "Baby II": 2,
        Child: 3,
        Adult: 4,
        Perfect: 5,
        Ultimate: 6,
        "Super Ultimate": 7,
      };

      const aOrder = stageOrder[a.stage] ?? 999;
      const bOrder = stageOrder[b.stage] ?? 999;

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      return (a.name || a.id).localeCompare(b.name || b.id, "ko");
    });
}

function formatSyncFailureStages(error) {
  if (!Array.isArray(error?.details) || error.details.length === 0) {
    return error?.stage ? [error.stage] : [];
  }

  return [...new Set(error.details.map((detail) => detail?.stage).filter(Boolean))];
}

function formatCompatFailureStages(syncResult) {
  return [
    ...new Set(
      (syncResult?.compat?.failures || [])
        .map((failure) => failure?.stage)
        .filter(Boolean)
    ),
  ];
}

function EncyclopediaPanel({
  currentDigimonId,
  developerMode = false,
  encyclopediaShowQuestionMark = true,
}) {
  const { currentUser, isFirebaseAvailable } = useAuth();
  const [encyclopedia, setEncyclopedia] = useState(() =>
    Object.fromEntries(SUPPORTED_DIGIMON_VERSIONS.map((version) => [version, {}]))
  );
  const [selectedVersion, setSelectedVersion] = useState("Ver.1");
  const [selectedDigimon, setSelectedDigimon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fixingMessage, setFixingMessage] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const data = await loadEncyclopedia(currentUser);
        if (isMounted) {
          setEncyclopedia(data);
        }
      } catch (error) {
        console.error("도감 로드 오류:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const versionLists = Object.fromEntries(
    SUPPORTED_DIGIMON_VERSIONS.map((version) => [version, getDigimonList(version)])
  );
  const digimonList = versionLists[selectedVersion] || [];
  const versionData = encyclopedia[selectedVersion] || {};

  const isVersionComplete = (list, data) =>
    list.length > 0 &&
    list.every((digimon) => getEncyclopediaEntry(data, digimon.listKey || digimon.id)?.isDiscovered);

  const discoveredCount = digimonList.filter((digimon) =>
    getEncyclopediaEntry(versionData, digimon.listKey || digimon.id)?.isDiscovered
  ).length;

  const handleFixEncyclopedia = async () => {
    if (!currentDigimonId) {
      setFixingMessage("현재 선택된 디지몬이 없습니다.");
      window.setTimeout(() => setFixingMessage(null), 3000);
      return;
    }

    setFixingMessage("처리 중...");

    try {
      const digimonVersion = getDigimonVersionByDigimonId(currentDigimonId);
      const digimonData = getDigimonDataMapByVersion(digimonVersion)?.[currentDigimonId];
      const { added, skipped, syncResult } = await addMissingEncyclopediaEntries(
        currentUser,
        [currentDigimonId],
        digimonVersion
      );
      const data = await loadEncyclopedia(currentUser);
      setEncyclopedia(data);
      const compatFailureStages = formatCompatFailureStages(syncResult);
      const compatFailureSuffix =
        compatFailureStages.length > 0
          ? ` 단, 호환 구조 메타데이터 동기화 일부 실패(${compatFailureStages.join(", ")}).`
          : "";

      if (added.length > 0) {
        setFixingMessage(
          `도감(${digimonVersion})에 ${digimonData?.name || currentDigimonId} 반영되었습니다.${compatFailureSuffix}`
        );
      } else if (skipped.length > 0) {
        setFixingMessage(
          `이미 도감(${digimonVersion})에 등록되어 있습니다.${compatFailureSuffix}`
        );
      } else {
        setFixingMessage("반영할 항목이 없습니다.");
      }
    } catch (error) {
      const failedStages = formatSyncFailureStages(error);
      const failureSuffix =
        failedStages.length > 0 ? ` (${failedStages.join(", ")})` : "";
      setFixingMessage(`보정 실패${failureSuffix}: ${error.message || "알 수 없는 오류"}`);
    }

    window.setTimeout(() => setFixingMessage(null), 4000);
  };

  if (loading) {
    return (
      <div className="service-empty-state">
        <div className="service-spinner" aria-hidden="true" />
        <h3>도감을 불러오는 중입니다.</h3>
        <p>버전별 발견 기록과 최근 육성 이력을 준비하고 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SUPPORTED_DIGIMON_VERSIONS.map((version) => (
          <button
            key={version}
            type="button"
            onClick={() => setSelectedVersion(version)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              selectedVersion === version
                ? "bg-emerald-700 text-white"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            }`}
          >
            {isVersionComplete(versionLists[version] || [], encyclopedia[version] || {}) ? "👑 " : ""}
            {version}
          </button>
        ))}
      </div>

      <div className="rounded-[1.5rem] border border-slate-200 bg-white/70 p-4">
        <div
          data-testid="encyclopedia-grid"
          className="grid gap-3"
          style={{ gridTemplateColumns: ENCYCLOPEDIA_GRID_TEMPLATE }}
        >
          {digimonList.map((digimon) => {
            const digimonKey = digimon.listKey || digimon.id || digimon.name;
            const discoveredData = getEncyclopediaEntry(versionData, digimonKey);
            const isDiscovered = discoveredData?.isDiscovered === true;
            const showAsDiscovered =
              isDiscovered || (developerMode && !encyclopediaShowQuestionMark);

            return (
              <button
                key={digimonKey}
                type="button"
                onClick={() => {
                  if (showAsDiscovered) {
                    setSelectedDigimon(digimonKey);
                  }
                }}
                disabled={!showAsDiscovered}
                className={`relative flex flex-col items-center gap-2 rounded-[1.2rem] border-2 p-3 text-center transition-all ${
                  showAsDiscovered
                    ? "cursor-pointer border-emerald-200 bg-white hover:border-emerald-500 hover:shadow-lg"
                    : "cursor-not-allowed border-slate-300 bg-slate-100 opacity-70"
                }`}
              >
                <img
                  src={`${digimon.spriteBasePath || "/images"}/${digimon.sprite || 0}.png`}
                  alt={digimon.name || digimonKey}
                  className="h-16 w-16"
                  style={{
                    imageRendering: "pixelated",
                    filter: showAsDiscovered ? "none" : "blur(8px) grayscale(100%)",
                    opacity: showAsDiscovered ? 1 : 0.5,
                  }}
                />
                <div className="text-sm font-bold">
                  {showAsDiscovered ? digimon.name || digimonKey : "???"}
                </div>
                {showAsDiscovered ? (
                  <div className="text-xs text-slate-500">{translateStage(digimon.stage)}</div>
                ) : null}
                {isDiscovered ? (
                  <span className="absolute right-2 top-2 text-lg font-bold text-emerald-500">
                    ✓
                  </span>
                ) : null}
                {!showAsDiscovered ? (
                  <span className="absolute inset-0 flex items-center justify-center text-3xl">
                    🔒
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <div>
          발견: {discoveredCount} / {digimonList.length}
        </div>
        {currentDigimonId && currentUser && isFirebaseAvailable ? (
          <div className="mt-2 space-y-1">
            <button
              type="button"
              onClick={handleFixEncyclopedia}
              className="text-sm font-semibold text-emerald-700 hover:underline"
            >
              현재 디지몬을 도감에 반영하기
            </button>
            {fixingMessage ? <div className="text-xs text-slate-700">{fixingMessage}</div> : null}
          </div>
        ) : null}
      </div>

      {selectedDigimon ? (
        <EncyclopediaDetailModal
          digimonName={selectedDigimon}
          digimonData={getDigimonDataMapByVersion(selectedVersion)?.[selectedDigimon]}
          encyclopediaData={getEncyclopediaEntry(versionData, selectedDigimon)}
          onClose={() => setSelectedDigimon(null)}
        />
      ) : null}
    </div>
  );
}

export default EncyclopediaPanel;
