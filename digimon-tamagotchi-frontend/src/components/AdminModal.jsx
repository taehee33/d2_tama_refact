// src/components/AdminModal.jsx
// 아레나 관리자 모달 (개발자 모드에서 열리지만 권한은 서버에서 검증)

import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import UserDirectoryPanel from "./admin/UserDirectoryPanel";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebase";
import {
  deleteArenaArchive,
  endArenaSeason,
  fetchArenaArchiveMonitoring,
  saveArenaAdminConfig,
} from "../utils/arenaApi";

function normalizeInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeArchiveItem(docSnapshot) {
  const data = typeof docSnapshot.data === "function" ? docSnapshot.data() : docSnapshot;
  const archive = data || {};

  return {
    id: docSnapshot.id || archive.id,
    seasonId: normalizeInteger(archive.seasonId, 0),
    seasonName: archive.seasonName || `Season ${normalizeInteger(archive.seasonId, 0) || "?"}`,
    seasonDuration: archive.seasonDuration || "",
    entryCount: normalizeInteger(archive.entryCount, Array.isArray(archive.entries) ? archive.entries.length : 0),
    isDeleted: archive.isDeleted === true,
  };
}

function sortSeasonPreviewEntries(entries = []) {
  return [...entries].sort((left, right) => {
    const leftWins = normalizeInteger(left.record?.seasonWins, 0);
    const rightWins = normalizeInteger(right.record?.seasonWins, 0);
    const leftLosses = normalizeInteger(left.record?.seasonLosses, 0);
    const rightLosses = normalizeInteger(right.record?.seasonLosses, 0);

    if (rightWins !== leftWins) {
      return rightWins - leftWins;
    }

    if (leftLosses !== rightLosses) {
      return leftLosses - rightLosses;
    }

    return String(left.tamerName || left.trainerName || "").localeCompare(
      String(right.tamerName || right.trainerName || ""),
      "ko"
    );
  });
}

function createEmptyMonitoringSourceSummary() {
  return {
    counts: {
      success: 0,
      bad_request: 0,
      forbidden: 0,
      not_found: 0,
      error: 0,
    },
    totalCount: 0,
    failureCount: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
  };
}

function createEmptyArchiveMonitoringSummary() {
  return {
    windowHours: 24,
    sources: {
      arena_archive_post: createEmptyMonitoringSourceSummary(),
      arena_replay_get: createEmptyMonitoringSourceSummary(),
      jogress_archive_post: createEmptyMonitoringSourceSummary(),
    },
  };
}

function getMonitoringSourceSummary(summary, sourceKey) {
  return summary?.sources?.[sourceKey] || createEmptyMonitoringSourceSummary();
}

function formatMonitoringTimestamp(value) {
  if (!value) {
    return "기록 없음";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "기록 없음";
  }

  return date.toLocaleString("ko-KR");
}

function getMonitoringSourceLabel(source) {
  switch (source) {
    case "arena_archive_post":
      return "아레나 archive 저장";
    case "arena_replay_get":
      return "아레나 replay 조회";
    case "jogress_archive_post":
      return "조그레스 archive 저장";
    default:
      return source || "알 수 없음";
  }
}

function buildMonitoringEventMessage(event) {
  if (event.errorMessage) {
    return event.errorMessage;
  }

  if (event.source === "arena_archive_post") {
    return "아레나 archive 저장 성공";
  }

  if (event.source === "arena_replay_get") {
    return "아레나 replay 조회 성공";
  }

  if (event.source === "jogress_archive_post") {
    return "조그레스 archive 저장 성공";
  }

  return "상세 메시지 없음";
}

function getOutcomeClassName(outcome) {
  switch (outcome) {
    case "success":
      return "bg-green-100 text-green-700";
    case "not_found":
      return "bg-yellow-100 text-yellow-700";
    case "bad_request":
      return "bg-orange-100 text-orange-700";
    case "forbidden":
      return "bg-red-100 text-red-700";
    default:
      return "bg-red-100 text-red-700";
  }
}

export default function AdminModal({
  onClose,
  currentSeasonId,
  seasonName,
  seasonDuration,
  onConfigUpdated,
}) {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState("season");
  const [localSeasonId, setLocalSeasonId] = useState(currentSeasonId || 1);
  const [localSeasonName, setLocalSeasonName] = useState(seasonName || `Season ${currentSeasonId || 1}`);
  const [localSeasonDuration, setLocalSeasonDuration] = useState(seasonDuration || "");
  const [archives, setArchives] = useState([]);
  const [loadingArchives, setLoadingArchives] = useState(false);
  const [seasonSummary, setSeasonSummary] = useState({
    totalEntryCount: 0,
    currentSeasonEntryCount: 0,
    previewEntries: [],
  });
  const [seasonSummaryLoading, setSeasonSummaryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deletingArchiveId, setDeletingArchiveId] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [monitoringSummary, setMonitoringSummary] = useState(createEmptyArchiveMonitoringSummary());
  const [monitoringEvents, setMonitoringEvents] = useState([]);
  const [loadingMonitoring, setLoadingMonitoring] = useState(false);
  const [monitoringError, setMonitoringError] = useState("");

  useEffect(() => {
    setLocalSeasonId(Number(currentSeasonId) || 1);
    setLocalSeasonName(seasonName || `Season ${currentSeasonId || 1}`);
    setLocalSeasonDuration(seasonDuration || "");
  }, [currentSeasonId, seasonName, seasonDuration]);

  useEffect(() => {
    if (activeTab === "archive") {
      void loadArchives();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "season") {
      void loadSeasonSummary(Number(localSeasonId) || 1);
    }
  }, [activeTab, localSeasonId]);

  useEffect(() => {
    if (activeTab !== "monitoring") {
      return undefined;
    }

    let isMounted = true;

    void (async () => {
      if (!currentUser) {
        if (isMounted) {
          setMonitoringSummary(createEmptyArchiveMonitoringSummary());
          setMonitoringEvents([]);
          setMonitoringError("로그인이 필요합니다.");
        }
        return;
      }

      try {
        if (isMounted) {
          setLoadingMonitoring(true);
          setMonitoringError("");
        }

        const payload = await fetchArenaArchiveMonitoring(currentUser, {
          hours: 24,
          limit: 50,
        });

        if (isMounted) {
          setMonitoringSummary(payload?.summary || createEmptyArchiveMonitoringSummary());
          setMonitoringEvents(Array.isArray(payload?.events) ? payload.events : []);
        }
      } catch (error) {
        console.error("archive 관측 로드 오류:", error);
        if (isMounted) {
          setMonitoringSummary(createEmptyArchiveMonitoringSummary());
          setMonitoringEvents([]);
          setMonitoringError(error.message || "archive 관측 정보를 불러오지 못했습니다.");
        }
      } finally {
        if (isMounted) {
          setLoadingMonitoring(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [activeTab, currentUser]);

  const expectedConfirmationText = useMemo(
    () => `SEASON ${Number(localSeasonId) || 1}`,
    [localSeasonId]
  );

  async function loadArchives() {
    if (!db) {
      setArchives([]);
      return;
    }

    try {
      setLoadingArchives(true);
      const colRef = collection(db, "season_archives");
      const archiveQuery = query(colRef, orderBy("seasonId", "desc"));
      const snap = await getDocs(archiveQuery);
      const list = snap.docs
        .map((docSnapshot) => normalizeArchiveItem(docSnapshot))
        .filter((archive) => archive.isDeleted !== true);
      setArchives(list);
    } catch (error) {
      console.error("아카이브 로드 오류:", error);
    } finally {
      setLoadingArchives(false);
    }
  }

  async function loadSeasonSummary(targetSeasonId) {
    if (!db) {
      setSeasonSummary({
        totalEntryCount: 0,
        currentSeasonEntryCount: 0,
        previewEntries: [],
      });
      return;
    }

    try {
      setSeasonSummaryLoading(true);
      const snap = await getDocs(collection(db, "arena_entries"));
      const entries = snap.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      }));
      const currentSeasonEntries = sortSeasonPreviewEntries(
        entries.filter((entry) => normalizeInteger(entry.record?.seasonId, 0) === targetSeasonId)
      );

      setSeasonSummary({
        totalEntryCount: entries.length,
        currentSeasonEntryCount: currentSeasonEntries.length,
        previewEntries: currentSeasonEntries.slice(0, 5),
      });
    } catch (error) {
      console.error("시즌 요약 로드 오류:", error);
      setSeasonSummary({
        totalEntryCount: 0,
        currentSeasonEntryCount: 0,
        previewEntries: [],
      });
    } finally {
      setSeasonSummaryLoading(false);
    }
  }

  async function handleSaveConfig() {
    if (!currentUser) {
      alert("로그인이 필요합니다.");
      return;
    }

    try {
      setSaving(true);
      const config = await saveArenaAdminConfig(currentUser, {
        currentSeasonId: Number(localSeasonId) || 1,
        seasonName: localSeasonName || `Season ${localSeasonId || 1}`,
        seasonDuration: localSeasonDuration || "",
      });

      if (config && onConfigUpdated) {
        onConfigUpdated(config);
      }

      alert("시즌 설정을 저장했습니다.");
    } catch (error) {
      console.error("설정 저장 오류:", error);
      alert(`시즌 설정 저장에 실패했습니다.\n${error.message || "알 수 없는 오류"}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleEndSeason() {
    if (!currentUser) {
      alert("로그인이 필요합니다.");
      return;
    }

    if (confirmationText.trim() !== expectedConfirmationText) {
      alert(`확인 문구를 정확히 입력해 주세요.\n입력값: ${expectedConfirmationText}`);
      return;
    }

    try {
      setArchiving(true);
      const season = await endArenaSeason(currentUser, {
        currentSeasonId: Number(localSeasonId) || 1,
        seasonName: localSeasonName || `Season ${localSeasonId || 1}`,
        seasonDuration: localSeasonDuration || "",
      });

      const nextConfig = {
        currentSeasonId: season?.currentSeasonId || Number(localSeasonId) + 1,
        seasonName: season?.seasonName || `Season ${(season?.currentSeasonId || Number(localSeasonId) + 1)}`,
        seasonDuration: season?.seasonDuration || localSeasonDuration || "",
      };

      setLocalSeasonId(nextConfig.currentSeasonId);
      setLocalSeasonName(nextConfig.seasonName);
      setLocalSeasonDuration(nextConfig.seasonDuration);
      setConfirmationText("");

      if (onConfigUpdated) {
        onConfigUpdated(nextConfig);
      }

      await Promise.all([loadArchives(), loadSeasonSummary(nextConfig.currentSeasonId)]);
      alert(
        `시즌 종료가 완료되었습니다.\n아카이브 엔트리: ${season?.archivedEntryCount || 0}건\n현재 시즌: ${nextConfig.seasonName}`
      );
    } catch (error) {
      console.error("시즌 종료 오류:", error);
      alert(`시즌 종료에 실패했습니다.\n${error.message || "알 수 없는 오류"}`);
    } finally {
      setArchiving(false);
    }
  }

  async function handleDeleteArchive(archiveId) {
    if (!currentUser) {
      alert("로그인이 필요합니다.");
      return;
    }

    if (!window.confirm("이 아카이브를 목록에서 숨기시겠습니까?\n소프트 삭제되며 서버 기록은 유지됩니다.")) {
      return;
    }

    try {
      setDeletingArchiveId(archiveId);
      await deleteArenaArchive(currentUser, archiveId);
      await loadArchives();
      alert("아카이브를 숨겼습니다.");
    } catch (error) {
      console.error("아카이브 삭제 오류:", error);
      alert(`아카이브 삭제에 실패했습니다.\n${error.message || "알 수 없는 오류"}`);
    } finally {
      setDeletingArchiveId("");
    }
  }

  async function loadArchiveMonitoring() {
    if (!currentUser) {
      setMonitoringSummary(createEmptyArchiveMonitoringSummary());
      setMonitoringEvents([]);
      setMonitoringError("로그인이 필요합니다.");
      return;
    }

    try {
      setLoadingMonitoring(true);
      setMonitoringError("");
      const payload = await fetchArenaArchiveMonitoring(currentUser, {
        hours: 24,
        limit: 50,
      });
      setMonitoringSummary(payload?.summary || createEmptyArchiveMonitoringSummary());
      setMonitoringEvents(Array.isArray(payload?.events) ? payload.events : []);
    } catch (error) {
      console.error("archive 관측 로드 오류:", error);
      setMonitoringSummary(createEmptyArchiveMonitoringSummary());
      setMonitoringEvents([]);
      setMonitoringError(error.message || "archive 관측 정보를 불러오지 못했습니다.");
    } finally {
      setLoadingMonitoring(false);
    }
  }

  const arenaArchiveSummary = getMonitoringSourceSummary(monitoringSummary, "arena_archive_post");
  const arenaReplaySummary = getMonitoringSourceSummary(monitoringSummary, "arena_replay_get");
  const jogressArchiveSummary = getMonitoringSourceSummary(monitoringSummary, "jogress_archive_post");

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50"
      style={{ zIndex: 80 }}
      role="presentation"
    >
      <div
        className="bg-white p-6 rounded-lg shadow-xl max-w-7xl w-full m-4 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arena-admin-title"
      >
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 id="arena-admin-title" className="text-2xl font-bold">
              관리자 도구
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              개발자 모드에서 열리지만, 실제 관리자 권한은 서버에서 최종 검증됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            aria-label="관리자 도구 닫기"
          >
            닫기
          </button>
        </div>

        <div className="flex gap-3 mb-4 border-b">
          <button
            type="button"
            onClick={() => setActiveTab("season")}
            className={`px-4 py-2 font-bold transition-colors ${
              activeTab === "season"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            시즌 설정
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("archive")}
            className={`px-4 py-2 font-bold transition-colors ${
              activeTab === "archive"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            아카이브
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("monitoring")}
            className={`px-4 py-2 font-bold transition-colors ${
              activeTab === "monitoring"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            로그 관측
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 font-bold transition-colors ${
              activeTab === "users"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            사용자
          </button>
        </div>

        {activeTab === "season" && (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-bold mb-1" htmlFor="arena-season-id">
                  현재 시즌 ID
                </label>
                <input
                  id="arena-season-id"
                  type="number"
                  className="w-full border rounded px-3 py-2"
                  value={localSeasonId}
                  onChange={(event) => setLocalSeasonId(event.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1" htmlFor="arena-season-name">
                  시즌 이름
                </label>
                <input
                  id="arena-season-name"
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={localSeasonName}
                  onChange={(event) => setLocalSeasonName(event.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1" htmlFor="arena-season-duration">
                  시즌 기간
                </label>
                <input
                  id="arena-season-duration"
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  placeholder="예: 2026.04.01 ~ 04.30"
                  value={localSeasonDuration}
                  onChange={(event) => setLocalSeasonDuration(event.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-base font-bold mb-2">시즌 종료 영향 미리보기</h3>
              {seasonSummaryLoading ? (
                <p className="text-sm text-gray-500">현재 시즌 현황을 불러오는 중입니다.</p>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded border bg-white p-3">
                      <p className="text-xs text-gray-500">현재 시즌 아카이브 대상</p>
                      <p className="text-lg font-bold">{seasonSummary.currentSeasonEntryCount}건</p>
                    </div>
                    <div className="rounded border bg-white p-3">
                      <p className="text-xs text-gray-500">시즌 기록 리셋 대상</p>
                      <p className="text-lg font-bold">{seasonSummary.totalEntryCount}건</p>
                    </div>
                    <div className="rounded border bg-white p-3">
                      <p className="text-xs text-gray-500">확인 문구</p>
                      <p className="text-lg font-bold">{expectedConfirmationText}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">현재 시즌 상위 미리보기</p>
                    {seasonSummary.previewEntries.length === 0 ? (
                      <p className="text-sm text-gray-500">아직 이번 시즌 엔트리가 없습니다.</p>
                    ) : (
                      <div className="space-y-2">
                        {seasonSummary.previewEntries.map((entry, index) => (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between rounded border bg-white px-3 py-2 text-sm"
                          >
                            <span className="font-medium">
                              {index + 1}. {entry.tamerName || entry.trainerName || "Unknown"} -{" "}
                              {entry.digimonSnapshot?.digimonName || "Unknown"}
                            </span>
                            <span className="text-gray-500">
                              {normalizeInteger(entry.record?.seasonWins, 0)}승{" "}
                              {normalizeInteger(entry.record?.seasonLosses, 0)}패
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <h3 className="text-base font-bold text-red-700 mb-2">시즌 종료</h3>
              <p className="text-sm text-red-700 mb-3">
                현재 시즌을 아카이브로 저장하고, 모든 아레나 엔트리의 시즌 전적을 다음 시즌 기준으로 초기화합니다.
              </p>
              <label className="block text-sm font-bold mb-1" htmlFor="arena-season-confirmation">
                확인 문구 입력
              </label>
              <input
                id="arena-season-confirmation"
                type="text"
                className="w-full border rounded px-3 py-2 bg-white"
                placeholder={expectedConfirmationText}
                value={confirmationText}
                onChange={(event) => setConfirmationText(event.target.value)}
              />
              <p className="mt-2 text-xs text-red-600">
                정확히 <span className="font-bold">{expectedConfirmationText}</span> 를 입력해야 시즌 종료를 실행할 수 있습니다.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={saving}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {saving ? "저장 중..." : "시즌 설정 저장"}
              </button>
              <button
                type="button"
                onClick={handleEndSeason}
                disabled={archiving || confirmationText.trim() !== expectedConfirmationText}
                className="px-4 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {archiving ? "종료 처리 중..." : "시즌 종료 및 아카이브"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "archive" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-600">
                삭제 버튼은 소프트 삭제입니다. 목록에서 숨기지만 서버 기록은 유지합니다.
              </p>
            </div>

            {loadingArchives ? (
              <p className="text-gray-600">아카이브를 불러오는 중입니다.</p>
            ) : archives.length === 0 ? (
              <p className="text-gray-600">표시할 아카이브가 없습니다.</p>
            ) : (
              archives.map((archive) => (
                <div
                  key={archive.id}
                  className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-xl font-bold">{archive.seasonName}</p>
                    <p className="text-sm text-gray-500">
                      {archive.seasonDuration || "기간 미설정"}
                    </p>
                    <p className="text-sm text-gray-500">엔트리: {archive.entryCount}건</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteArchive(archive.id)}
                    disabled={deletingArchiveId === archive.id}
                    className="self-start px-4 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {deletingArchiveId === archive.id ? "삭제 중..." : "소프트 삭제"}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "monitoring" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div>
                <p className="text-sm font-semibold text-gray-800">최근 24시간 archive 관측</p>
                <p className="text-xs text-gray-500">
                  Supabase event table 기준으로 archive 저장 실패와 replay 404를 확인합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadArchiveMonitoring()}
                disabled={loadingMonitoring}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {loadingMonitoring ? "새로고침 중..." : "새로고침"}
              </button>
            </div>

            {monitoringError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {monitoringError}
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-sm font-bold text-gray-800">아레나 archive</p>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-gray-500">성공</p>
                    <p className="text-2xl font-bold text-green-600">{arenaArchiveSummary.counts.success}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">실패</p>
                    <p className="text-2xl font-bold text-red-600">{arenaArchiveSummary.failureCount}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-1 text-xs text-gray-500">
                  <p>마지막 성공: {formatMonitoringTimestamp(arenaArchiveSummary.lastSuccessAt)}</p>
                  <p>마지막 실패: {formatMonitoringTimestamp(arenaArchiveSummary.lastFailureAt)}</p>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-sm font-bold text-gray-800">아레나 replay</p>
                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-gray-500">성공</p>
                    <p className="text-2xl font-bold text-green-600">{arenaReplaySummary.counts.success}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">404</p>
                    <p className="text-2xl font-bold text-yellow-600">{arenaReplaySummary.counts.not_found}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">실패</p>
                    <p className="text-2xl font-bold text-red-600">
                      {arenaReplaySummary.counts.bad_request +
                        arenaReplaySummary.counts.forbidden +
                        arenaReplaySummary.counts.error}
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-1 text-xs text-gray-500">
                  <p>마지막 성공: {formatMonitoringTimestamp(arenaReplaySummary.lastSuccessAt)}</p>
                  <p>마지막 실패: {formatMonitoringTimestamp(arenaReplaySummary.lastFailureAt)}</p>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-sm font-bold text-gray-800">조그레스 archive</p>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-gray-500">성공</p>
                    <p className="text-2xl font-bold text-green-600">{jogressArchiveSummary.counts.success}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">실패</p>
                    <p className="text-2xl font-bold text-red-600">{jogressArchiveSummary.failureCount}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-1 text-xs text-gray-500">
                  <p>마지막 성공: {formatMonitoringTimestamp(jogressArchiveSummary.lastSuccessAt)}</p>
                  <p>마지막 실패: {formatMonitoringTimestamp(jogressArchiveSummary.lastFailureAt)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold">최신 이벤트 50건</h3>
                <p className="text-xs text-gray-500">
                  source / outcome / status code / archiveId / 요약 메시지
                </p>
              </div>

              {loadingMonitoring ? (
                <p className="text-sm text-gray-500">archive 관측 정보를 불러오는 중입니다.</p>
              ) : monitoringEvents.length === 0 ? (
                <p className="text-sm text-gray-500">최근 관측 이벤트가 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {monitoringEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-gray-800">
                            {getMonitoringSourceLabel(event.source)}
                          </span>
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-bold ${getOutcomeClassName(
                              event.outcome
                            )}`}
                          >
                            {event.outcome}
                          </span>
                          <span className="text-xs text-gray-500">
                            HTTP {event.statusCode ?? "-"}
                          </span>
                          {event.archiveId && (
                            <span className="text-xs text-gray-500">archiveId: {event.archiveId}</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatMonitoringTimestamp(event.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-700">{buildMonitoringEventMessage(event)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <UserDirectoryPanel currentUser={currentUser} />
        )}
      </div>
    </div>
  );
}
