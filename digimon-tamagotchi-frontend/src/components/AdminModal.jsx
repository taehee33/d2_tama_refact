// src/components/AdminModal.jsx
// Arena Admin Panel (Dev 전용)

import React, { useEffect, useState } from "react";
import { collection, doc, getDocs, updateDoc, setDoc, deleteDoc, query, orderBy, limit, where } from "firebase/firestore";
import { db } from "../firebase";

const AdminModal = ({ onClose, currentSeasonId, seasonName, seasonDuration, onConfigUpdated }) => {
  const [activeTab, setActiveTab] = useState("season"); // season | archive
  const [localSeasonId, setLocalSeasonId] = useState(currentSeasonId || 1);
  const [localSeasonName, setLocalSeasonName] = useState(seasonName || `Season ${currentSeasonId || 1}`);
  const [localSeasonDuration, setLocalSeasonDuration] = useState(seasonDuration || "");
  const [archives, setArchives] = useState([]);
  const [loadingArchives, setLoadingArchives] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setLocalSeasonId(Number(currentSeasonId) || 1);
    setLocalSeasonName(seasonName || `Season ${currentSeasonId || 1}`);
    setLocalSeasonDuration(seasonDuration || "");
  }, [currentSeasonId, seasonName, seasonDuration]);

  useEffect(() => {
    if (activeTab === "archive") {
      loadArchives();
    }
  }, [activeTab]);

  const loadArchives = async () => {
    if (!db) return;
    try {
      setLoadingArchives(true);
      const colRef = collection(db, "season_archives");
      const q = query(colRef, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setArchives(list);
    } catch (err) {
      console.error("아카이브 로드 오류:", err);
    } finally {
      setLoadingArchives(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!db) return;
    try {
      setSaving(true);
      const configRef = doc(db, "game_settings", "arena_config");
      await setDoc(
        configRef,
        {
          currentSeasonId: Number(localSeasonId) || 1,
          seasonName: localSeasonName || `Season ${localSeasonId || 1}`,
          seasonDuration: localSeasonDuration || "",
        },
        { merge: true }
      );
      if (onConfigUpdated) {
        onConfigUpdated({
          currentSeasonId: Number(localSeasonId) || 1,
          seasonName: localSeasonName || `Season ${localSeasonId || 1}`,
          seasonDuration: localSeasonDuration || "",
        });
      }
      alert("설정이 저장되었습니다.");
    } catch (err) {
      console.error("설정 저장 오류:", err);
      alert(`설정 저장 중 오류가 발생했습니다.\n${err.message || err.code || "알 수 없는 오류"}`);
    } finally {
      setSaving(false);
    }
  };

  // 시즌 종료 및 아카이브 저장
  const handleEndSeason = async () => {
    if (!db) return;
    if (!window.confirm("현재 시즌을 종료하고 아카이브에 저장하시겠습니까?")) return;

    try {
      setArchiving(true);
      setIsProcessing(true);
      const currentId = Number(localSeasonId) || 1;

      // 시즌 랭킹 Top 50 (seasonWins 기준)
      const entriesRef = collection(db, "arena_entries");
      const seasonQuery = query(
        entriesRef,
        where("record.seasonId", "==", currentId),
        orderBy("record.seasonWins", "desc"),
        limit(50)
      );
      const snap = await getDocs(seasonQuery);
      const topEntries = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          tamerName: data.tamerName || data.trainerName || "Unknown",
          digimonName: data.digimonSnapshot?.digimonName || "Unknown",
          seasonWins: data.record?.seasonWins || 0,
          seasonLosses: data.record?.seasonLosses || 0,
          wins: data.record?.wins || 0,
          losses: data.record?.losses || 0,
        };
      });

      // 아카이브 저장
      const archiveRef = doc(db, "season_archives", `season_${currentId}`);
      await setDoc(archiveRef, {
        seasonId: currentId,
        seasonName: localSeasonName || `Season ${currentId}`,
        seasonDuration: localSeasonDuration || "",
        entries: topEntries,
        createdAt: new Date(),
      });

      // 시즌 ID +1로 업데이트
      const nextSeason = currentId + 1;
      const configRef = doc(db, "game_settings", "arena_config");
      await setDoc(
        configRef,
        {
          currentSeasonId: Number(nextSeason),
          seasonName: `Season ${nextSeason}`,
          seasonDuration: localSeasonDuration || "",
        },
        { merge: true }
      );

      // seasonWins/seasonLosses 초기화: 모든 arena_entries에 대해 리셋
      const resetSnap = await getDocs(entriesRef);
      for (const d of resetSnap.docs) {
        const entryRef = doc(db, "arena_entries", d.id);
        await updateDoc(entryRef, {
          "record.seasonWins": 0,
          "record.seasonLosses": 0,
          "record.seasonId": Number(nextSeason),
        });
      }

      // 로컬 상태 갱신
      setLocalSeasonId(nextSeason);
      setLocalSeasonName(`Season ${nextSeason}`);
      if (onConfigUpdated) {
        onConfigUpdated({
          currentSeasonId: nextSeason,
          seasonName: `Season ${nextSeason}`,
          seasonDuration: localSeasonDuration || "",
        });
      }

      alert("시즌 종료 및 아카이브 저장 완료. 시즌이 다음 시즌으로 전환되었습니다.");
    } catch (err) {
      console.error("End Season Error:", err);
      const tip = err?.message?.toLowerCase().includes("index")
        ? "\n\n콘솔(F12)의 파란색 링크를 클릭하여 인덱스를 생성하세요."
        : "";
      alert(`시즌 종료 실패: ${err.message || err.code || "알 수 없는 오류"}${tip}`);
    } finally {
      setArchiving(false);
      setIsProcessing(false);
    }
  };

  const handleDeleteArchive = async (archiveId) => {
    if (!db) return;
    if (!window.confirm("이 아카이브를 삭제하시겠습니까? (복구 불가)")) return;
    try {
      await deleteDoc(doc(db, "season_archives", archiveId));
      await loadArchives();
      alert("아카이브가 삭제되었습니다.");
    } catch (err) {
      console.error("아카이브 삭제 오류:", err);
      alert(`삭제 중 오류가 발생했습니다.\n${err.message || err.code || "알 수 없는 오류"}`);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50" style={{ zIndex: 80 }}>
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-3xl w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Arena Admin</h2>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            닫기
          </button>
        </div>

        <div className="flex gap-3 mb-4 border-b">
          <button
            onClick={() => setActiveTab("season")}
            className={`px-4 py-2 font-bold transition-colors ${
              activeTab === "season"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Current Season
          </button>
          <button
            onClick={() => setActiveTab("archive")}
            className={`px-4 py-2 font-bold transition-colors ${
              activeTab === "archive"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            History
          </button>
        </div>

        {activeTab === "season" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1">Current Season ID</label>
              <input
                type="number"
                className="w-full border rounded px-3 py-2"
                value={localSeasonId}
                onChange={(e) => setLocalSeasonId(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Season Name</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                value={localSeasonName}
                onChange={(e) => setLocalSeasonName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Season Duration (e.g., 2025.12.01 ~ 12.31)</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                value={localSeasonDuration}
                onChange={(e) => setLocalSeasonDuration(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Update"}
              </button>
              <button
                onClick={handleEndSeason}
                disabled={archiving}
                className="px-4 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {archiving ? "Archiving..." : "End Season & Archive"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "archive" && (
          <div>
            {loadingArchives ? (
              <p className="text-gray-600">로딩 중...</p>
            ) : archives.length === 0 ? (
              <p className="text-gray-600">아카이브가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {archives.map((arc) => (
                  <div key={arc.id} className="p-3 border rounded flex justify-between items-start">
                    <div>
                      <p className="font-bold">{arc.seasonName || arc.id}</p>
                      <p className="text-xs text-gray-600">{arc.seasonDuration || "기간 정보 없음"}</p>
                      <p className="text-xs text-gray-500">Entries: {arc.entries?.length || 0}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteArchive(arc.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminModal;

