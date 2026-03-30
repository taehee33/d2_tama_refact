import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { digimonDataVer1 } from "../../data/v1/digimons";
import { digimonDataVer2 } from "../../data/v2modkor";
import {
  addMissingEncyclopediaEntries,
  loadEncyclopedia,
  saveEncyclopedia,
} from "../../hooks/useEncyclopedia";
import { translateStage } from "../../utils/stageTranslator";
import EncyclopediaDetailModal from "../EncyclopediaDetailModal";
import "../../styles/Battle.css";

function getEncyclopediaEntry(versionData, digimonKey) {
  return (
    versionData[digimonKey] ||
    Object.entries(versionData).find(
      ([key]) => (key || "").toLowerCase() === (digimonKey || "").toLowerCase()
    )?.[1]
  );
}

function getDigimonList(version) {
  const dataMap = version === "Ver.2" ? digimonDataVer2 : digimonDataVer1;

  return Object.keys(dataMap)
    .filter((key) => {
      const digimon = dataMap[key];

      if (!digimon || digimon.stage === "Ohakadamon") {
        return false;
      }

      if (version === "Ver.1" && key === "CresGarurumon") {
        return false;
      }

      if (version === "Ver.2" && key === "BlitzGreymonV2") {
        return false;
      }

      return true;
    })
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

function EncyclopediaPanel({
  currentDigimonId,
  developerMode = false,
  encyclopediaShowQuestionMark = true,
}) {
  const { currentUser, isFirebaseAvailable } = useAuth();
  const [encyclopedia, setEncyclopedia] = useState({ "Ver.1": {} });
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

  const listVer1 = getDigimonList("Ver.1");
  const listVer2 = getDigimonList("Ver.2");
  const digimonList = selectedVersion === "Ver.2" ? listVer2 : listVer1;
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
      const fromV2 = digimonDataVer2[currentDigimonId];
      const fromV1 = digimonDataVer1[currentDigimonId];
      const digimonData = fromV2 ?? fromV1;
      const digimonVersion = fromV2 ? "Ver.2" : fromV1 ? "Ver.1" : null;

      if (digimonVersion === "Ver.2") {
        const data = await loadEncyclopedia(currentUser);
        if (!data["Ver.2"]) {
          data["Ver.2"] = {};
        }

        if (!data["Ver.2"][currentDigimonId]?.isDiscovered) {
          data["Ver.2"][currentDigimonId] = {
            isDiscovered: true,
            firstDiscoveredAt: Date.now(),
            raisedCount: 1,
            lastRaisedAt: Date.now(),
            bestStats: {},
            history: [],
          };
          await saveEncyclopedia(data, currentUser);
          setEncyclopedia(data);
          setFixingMessage(`도감(Ver.2)에 ${digimonData?.name || currentDigimonId} 반영되었습니다.`);
        } else {
          setFixingMessage("이미 도감(Ver.2)에 등록되어 있습니다.");
        }
      } else {
        const { added, skipped } = await addMissingEncyclopediaEntries(currentUser, [
          currentDigimonId,
        ]);
        const data = await loadEncyclopedia(currentUser);
        setEncyclopedia(data);

        if (added.length > 0) {
          setFixingMessage(
            `도감(Ver.1)에 ${digimonDataVer1[currentDigimonId]?.name || currentDigimonId} 반영되었습니다.`
          );
        } else if (skipped.length > 0) {
          setFixingMessage("이미 도감에 등록되어 있습니다.");
        } else {
          setFixingMessage("반영할 항목이 없습니다.");
        }
      }
    } catch (error) {
      setFixingMessage(`보정 실패: ${error.message || "알 수 없는 오류"}`);
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
        <button
          type="button"
          onClick={() => setSelectedVersion("Ver.1")}
          className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
            selectedVersion === "Ver.1"
              ? "bg-emerald-700 text-white"
              : "bg-slate-200 text-slate-700 hover:bg-slate-300"
          }`}
        >
          {isVersionComplete(listVer1, encyclopedia["Ver.1"] || {}) ? "👑 " : ""}
          Ver.1
        </button>
        <button
          type="button"
          onClick={() => setSelectedVersion("Ver.2")}
          className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
            selectedVersion === "Ver.2"
              ? "bg-emerald-700 text-white"
              : "bg-slate-200 text-slate-700 hover:bg-slate-300"
          }`}
        >
          {isVersionComplete(listVer2, encyclopedia["Ver.2"] || {}) ? "👑 " : ""}
          Ver.2
        </button>
      </div>

      <div className="rounded-[1.5rem] border border-slate-200 bg-white/70 p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
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
          digimonData={
            selectedVersion === "Ver.2"
              ? digimonDataVer2[selectedDigimon]
              : digimonDataVer1[selectedDigimon]
          }
          encyclopediaData={getEncyclopediaEntry(versionData, selectedDigimon)}
          onClose={() => setSelectedDigimon(null)}
        />
      ) : null}
    </div>
  );
}

export default EncyclopediaPanel;
