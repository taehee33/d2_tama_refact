// src/hooks/useEvolution.js
// Game.jsx의 진화(Evolution) 로직을 분리한 Custom Hook

import { useRef } from "react";
import { writeBatch, doc, increment, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { checkEvolution } from "../logic/evolution/checker";
import {
  buildEvolutionStatsForCheck,
  getNormalEvolutionCandidates,
  isIgnoringAllEvolutionConditions,
} from "../logic/evolution/developerOptions";
import { getJogressResult } from "../logic/evolution/jogress";
import { sanitizeDigimonStatsForSlotDocument } from "./useGameData";
import { buildEvolutionTransitionState } from "./evolutionStateHelpers";
import { syncEvolutionEncyclopediaEntries } from "./evolutionEncyclopediaHelpers";
import {
  finalizeOnlineJogressCompletionState,
} from "./jogressCompletionHelpers";
import {
  buildJogressArchivePayload,
  buildJogressSummary,
} from "./jogressPresentationHelpers";
import { showJogressSuccessFeedback } from "./jogressUiFeedbackHelpers";
import {
  useJogressRoomLifecycle,
} from "./useJogressRoomLifecycle";
import { archiveJogressLog, createLogArchiveId } from "../utils/logArchiveApi";
import {
  getDigimonDataMapByVersion,
  getDigimonDataMapsByPreference,
  getStarterDigimonId,
  normalizeDigimonVersionLabel,
} from "../utils/digimonVersionUtils";
import { resolveTamerNamePriority } from "../utils/tamerNameUtils";
import { resolveDigimonDataFromMap } from "./game-runtime/gamePageActionHelpers";
import {
  completeJogressRoomApi,
  joinJogressRoomApi,
  JogressApiError,
} from "../utils/jogressApi";

/** 맵 키 또는 entry.id로 한글 이름 조회 (슬롯에 id가 저장된 경우 대비) */
function getDigimonDisplayName(maps, digimonId) {
  const lookupId = typeof digimonId === "string" ? digimonId.trim() : digimonId;
  if (!lookupId) return digimonId;
  const mapList = Array.isArray(maps) ? maps : [maps];
  for (const map of mapList) {
    if (!map || typeof map !== "object") continue;
    const byKey = map[lookupId]?.name;
    if (byKey) return byKey;
    const entry = Object.values(map).find((e) => e && e.id === lookupId);
    if (entry?.name) return entry.name;
  }
  return digimonId;
}

export async function persistJogressLogWithArchive({
  currentUser,
  archivePayload,
  warningLabel,
}) {
  const archiveId = createLogArchiveId("jogress");

  await archiveJogressLog(currentUser, {
    id: archiveId,
    ...archivePayload,
  }).catch((archiveErr) => {
    console.warn(`${warningLabel} Supabase archive 저장 실패:`, archiveErr);
    return null;
  });
}

const EVOLUTION_SHAKE_DURATION_MS = 2000;
const EVOLUTION_FLASH_DURATION_MS = 2000;
const EVOLUTION_COMPLETE_DELAY_MS = 500;
const EVOLUTION_REVEAL_BEFORE_MODAL_DELAY_MS = 1200;

function normalizeEvolutionTransitionToken(value, fallback = "unknown") {
  const normalized = typeof value === "string" ? value.trim() : "";
  return (normalized || fallback).replace(/[^a-zA-Z0-9_-]+/g, "-");
}

function createEvolutionTransitionId({ fromDigimon, targetDigimon, nowMs = Date.now() } = {}) {
  const browserCrypto = typeof window !== "undefined" ? window.crypto : null;
  const randomId =
    browserCrypto?.randomUUID?.() ||
    Math.random().toString(36).slice(2);
  return [
    "evolution",
    nowMs,
    normalizeEvolutionTransitionToken(fromDigimon, "unknown"),
    normalizeEvolutionTransitionToken(targetDigimon, "unknown"),
    normalizeEvolutionTransitionToken(randomId, "random"),
  ].join(":");
}

/**
 * useEvolution Hook
 * 진화 관련 로직을 담당하는 Custom Hook
 * 
 * @param {Object} params - 초기화 파라미터
 * @param {Object} params.digimonStats - 현재 디지몬 스탯
 * @param {Function} params.setDigimonStats - 스탯 업데이트 함수
 * @param {Function} params.setSelectedDigimon - 선택된 디지몬 설정 함수
 * @param {Function} params.setSelectedDigimonAndSave - 선택된 디지몬 저장 함수
 * @param {Function} params.setDigimonStatsAndSave - 스탯 저장 함수
 * @param {Function} params.applyLazyUpdateBeforeAction - Lazy Update 적용 함수
 * @param {Function} params.setActivityLogs - Activity Logs 설정 함수
 * @param {Array} params.activityLogs - 현재 Activity Logs
 * @param {string} params.selectedDigimon - 현재 선택된 디지몬
 * @param {boolean} params.developerMode - 개발자 모드 여부
 * @param {boolean} params.ignoreEvolutionTime - 모든 진화 조건 무시 (개발자 옵션, 체크 시 첫 번째 진화 대상으로 바로 진화)
 * @param {Function} params.setIsEvolving - 진화 중 플래그 설정 함수
 * @param {Function} params.setEvolutionStage - 진화 단계 설정 함수
 * @param {Function} params.setEvolvedDigimonName - 진화된 디지몬 이름 설정 함수
 * @param {Object} params.digimonDataVer1 - 디지몬 데이터 (구버전)
 * @param {Object} params.newDigimonDataVer1 - 디지몬 데이터 (신버전, 슬롯별 진화용)
 * @param {Object} [params.evolutionDataVer1] - Ver.1 진화 맵 (조그레스 시 호스트/게스트 Ver.1용, 미전달 시 newDigimonDataVer1 사용)
 * @param {string} params.version - 슬롯 버전 ("Ver.1" | "Ver.2" 등, 도감 관리용)
 * @returns {Object} evolve, checkEvolutionReady, isEvolving, evolutionStage, evolvedDigimonName
 */
export function useEvolution({
  digimonStats,
  setDigimonStats,
  setSelectedDigimon,
  setSelectedDigimonAndSave,
  setDigimonStatsAndSave,
  applyLazyUpdateBeforeAction,
  setActivityLogs,
  activityLogs,
  appendLogToSubcollection,
  selectedDigimon,
  developerMode,
  ignoreEvolutionTime = false,
  setIsEvolving,
  setEvolutionStage,
  setEvolvedDigimonName,
  setEvolutionCompleteIsJogress,
  setEvolutionCompleteJogressSummary,
  digimonDataVer1,
  newDigimonDataVer1,
  evolutionDataVer1, // 조그레스 시 호스트/게스트 Ver.1 맵 (항상 v1 데이터)
  digimonDataVer2 = {},
  adaptedDataMapsByVersion = {},
  slotId,
  slotName,
  tamerName,
  digimonNickname,
  currentUser,
  refreshGameRevision,
  flushOutbox,
  toggleModal,
  version = "Ver.1", // 슬롯 버전 (도감 관리용)
}) {
  const slotRuntimeDataMap = digimonDataVer1 || {};
  const slotEvolutionDataMap = newDigimonDataVer1 || {};
  const normalizedSlotVersion = normalizeDigimonVersionLabel(version);
  const evolutionInFlightRef = useRef(null);

  function getPreferredMaps(versionLabel = normalizedSlotVersion, extraMaps = []) {
    const normalizedVersion = normalizeDigimonVersionLabel(versionLabel);
    const versionAdaptedMap = adaptedDataMapsByVersion?.[normalizedVersion];

    return [
      ...extraMaps,
      versionAdaptedMap,
      getDigimonDataMapByVersion(normalizedVersion),
      ...getDigimonDataMapsByPreference(normalizedVersion),
      digimonDataVer1,
      digimonDataVer2,
      slotRuntimeDataMap,
      slotEvolutionDataMap,
    ].filter(Boolean);
  }

  const {
    createJogressRoom,
    createJogressRoomForSlot,
    cancelJogressRoom,
    applyHostJogressStatusFromRoom,
  } = useJogressRoomLifecycle({
    currentUser,
    slotId,
    selectedDigimon,
    version,
    tamerName,
    digimonNickname,
    slotEvolutionDataMap,
    flushOutbox,
    refreshGameRevision,
  });

  /**
   * 진화 버튼 클릭 핸들러 - 확인 모달 열기
   */
  function handleEvolutionButton() {
    // 진화 확인 모달 열기
    if (toggleModal) {
      toggleModal('evolutionConfirm', true);
    }
  }

  /**
   * 실제 진화 진행 함수
   */
  async function proceedEvolution(selectedTargetId = null) {
    if (evolutionInFlightRef.current) {
      return;
    }

    evolutionInFlightRef.current = "proceedEvolution";
    let releaseOnReturn = true;

    try {
      // 모달 닫기
      if (toggleModal) {
        toggleModal('evolutionConfirm', false);
      }

      // 액션 전 Lazy Update 적용
      const updatedStats = await applyLazyUpdateBeforeAction();
      setDigimonStats(updatedStats);

      if (updatedStats.isDead && !developerMode) {
        return;
      }

      // 현재 디지몬 데이터 가져오기 (새 데이터 구조 사용 - evolutionCriteria 포함)
      // selectedDigimon이 없으면 evolutionStage를 통해 찾기
      const digimonName = selectedDigimon || (updatedStats.evolutionStage ?
        Object.keys(slotEvolutionDataMap).find(key => slotEvolutionDataMap[key]?.stage === updatedStats.evolutionStage) :
        "Digitama");

      const resolvedCurrentDigimon = resolveDigimonDataFromMap(
        slotEvolutionDataMap,
        digimonName
      );
      const currentDigimonData = resolvedCurrentDigimon?.data;
      const currentDigimonKey = resolvedCurrentDigimon?.key || digimonName;
      const playEvolutionSequence = (targetId) => {
        releaseOnReturn = false;
        if (typeof setIsEvolving === 'function') setIsEvolving(true);
        setEvolutionStage('shaking');
        setTimeout(() => {
          setEvolutionStage('flashing');
          setTimeout(() => {
            setEvolutionStage('revealing');
            setTimeout(async () => {
              try {
                await evolve(targetId, { allowInFlight: true });
                setEvolutionStage('revealed');
                setTimeout(() => {
                  setEvolutionStage('complete');
                  if (typeof setIsEvolving === 'function') setIsEvolving(false);
                  if (evolutionInFlightRef.current === "proceedEvolution") {
                    evolutionInFlightRef.current = null;
                  }
                }, EVOLUTION_REVEAL_BEFORE_MODAL_DELAY_MS);
              } catch (error) {
                console.error("진화 처리 오류:", error);
                if (typeof setIsEvolving === 'function') setIsEvolving(false);
                if (evolutionInFlightRef.current === "proceedEvolution") {
                  evolutionInFlightRef.current = null;
                }
              }
            }, EVOLUTION_COMPLETE_DELAY_MS);
          }, EVOLUTION_FLASH_DURATION_MS);
        }, EVOLUTION_SHAKE_DURATION_MS);
      };

      if (!currentDigimonData) {
        console.error(`No data for ${digimonName} in slotEvolutionDataMap!`);
        console.error('Available keys:', Object.keys(slotEvolutionDataMap));
        console.error('selectedDigimon:', selectedDigimon);
        console.error('evolutionStage:', updatedStats.evolutionStage);
        return;
      }

      // 전체 조건 무시는 개발자 모드에서만 적용하며, 일반 진화 후보만 선택할 수 있다.
      if (isIgnoringAllEvolutionConditions(developerMode, ignoreEvolutionTime)) {
        const candidates = getNormalEvolutionCandidates(currentDigimonData, slotEvolutionDataMap);
        const targetId = selectedTargetId || candidates[0]?.targetId;

        if (!targetId) {
          alert("진화 가능한 형태가 없습니다.");
          return;
        }

        const isValidTarget = candidates.some((candidate) => candidate.targetId === targetId);
        if (!isValidTarget) {
          alert("선택할 수 없는 진화 대상입니다.");
          return;
        }
        const targetData = resolveDigimonDataFromMap(slotEvolutionDataMap, targetId)?.data;
        const evolvedName = targetData?.name || targetData?.id || targetId;
        setEvolvedDigimonName(evolvedName);
        playEvolutionSequence(targetId);
        return;
      }

      // 개발자 모드: 시간 조건만 0으로 두고 나머지 조건은 판정
      const statsForCheck = buildEvolutionStatsForCheck(updatedStats, developerMode);
      const evolutionResult = checkEvolution(
        statsForCheck,
        currentDigimonData,
        currentDigimonKey,
        slotEvolutionDataMap
      );

      if (evolutionResult.success) {
        const targetId = evolutionResult.targetId;
        const targetData = resolveDigimonDataFromMap(slotEvolutionDataMap, targetId)?.data;
        const evolvedName = targetData?.name || targetData?.id || targetId;
        setEvolvedDigimonName(evolvedName);
        playEvolutionSequence(targetId);
      } else if (evolutionResult.reason === "NOT_READY") {
        const remainingSeconds = evolutionResult.remainingTime;
        const mm = Math.floor(remainingSeconds / 60);
        const ss = Math.floor(remainingSeconds % 60);
        alert(`아직 진화할 준비가 안 됐어!\n\n남은 시간: ${mm}분 ${ss}초`);
      } else if (evolutionResult.reason === "CONDITIONS_UNMET") {
        const detailsText = evolutionResult.details
          .map(d => `• ${d.target}: ${d.missing}`)
          .join("\n");
        alert(`진화 조건을 만족하지 못했어!\n\n[부족한 조건]\n${detailsText}`);
      }
    } finally {
      if (releaseOnReturn && evolutionInFlightRef.current === "proceedEvolution") {
        evolutionInFlightRef.current = null;
      }
    }
  }

  /**
   * 진화 대상 ID를 데이터 맵에 있는 키로 보정 (대소문자/오타 대응)
   * @param {string} targetId - 진화 대상 ID (예: skullmamon)
   * @param {Object} dataMap - 디지몬 데이터 맵 (슬롯 버전에 맞는 데이터)
   * @returns {string|null} 실제 키 또는 null
   */
  function resolveEvolutionTargetKey(targetId, dataMap) {
    if (!targetId || !dataMap || typeof dataMap !== "object") return null;
    if (dataMap[targetId]) return targetId;
    const lower = targetId.toLowerCase();
    const found = Object.keys(dataMap).find((k) => k.toLowerCase() === lower);
    if (found) return found;
    const byId = Object.entries(dataMap).find(([, v]) => (v && v.id && String(v.id).toLowerCase() === lower));
    return byId ? byId[0] : null;
  }

  /**
   * 진화 실행 함수
   * @param {string} newName - 진화할 디지몬 이름 (ID)
   */
  async function evolve(newName, options = {}) {
    const allowInFlight = options?.allowInFlight === true;
    if (!allowInFlight) {
      if (evolutionInFlightRef.current) {
        return;
      }
      evolutionInFlightRef.current = "evolve";
    }

    try {
      const resolvedKey = resolveEvolutionTargetKey(newName, slotRuntimeDataMap) || newName;
      if (!slotRuntimeDataMap[resolvedKey]) {
        const fallback = getStarterDigimonId(version);
        console.error(`No data for ${newName} (resolved: ${resolvedKey}) in slot data! fallback => ${fallback}`);
        newName = fallback;
      } else {
        newName = resolvedKey;
      }
      const currentStats = await applyLazyUpdateBeforeAction();
      const old = { ...currentStats };
      const existingLogs = currentStats.activityLogs || activityLogs || [];
      const transitionId = createEvolutionTransitionId({
        fromDigimon: selectedDigimon || old.selectedDigimon,
        targetDigimon: newName,
      });
      const {
        targetDigimonData: newDigimonData,
        updatedLogs,
        nextStatsWithLogs: nxWithLogs,
      } = buildEvolutionTransitionState({
        currentStats: old,
        existingLogs,
        targetId: newName,
        targetMap: slotRuntimeDataMap,
        snapshotArgs: [
          slotRuntimeDataMap,
          slotEvolutionDataMap,
          evolutionDataVer1,
          digimonDataVer2,
        ],
        transitionId,
      });

      if (newDigimonData?.sprite !== undefined) {
        console.log("[evolve] 스프라이트 동기화:", {
          digimon: newName,
          sprite: newDigimonData.sprite,
        });
      }
      if (appendLogToSubcollection) await appendLogToSubcollection(updatedLogs[updatedLogs.length - 1]).catch(() => {});
      try {
        await setDigimonStatsAndSave(nxWithLogs, updatedLogs);
      } catch (saveError) {
        console.error("진화 상태 저장 오류:", saveError);
        return;
      }
      await setSelectedDigimonAndSave(newName);

      await syncEvolutionEncyclopediaEntries({
        previousDigimonId: selectedDigimon,
        previousStats: old,
        targetId: newName,
        nextStats: nxWithLogs,
        currentUser,
        version,
      });
    } finally {
      if (!allowInFlight && evolutionInFlightRef.current === "evolve") {
        evolutionInFlightRef.current = null;
      }
    }
  }

  /**
   * 로컬 조그레스 실행: 현재 슬롯 진화 + 파트너 슬롯 사망 처리 (Firestore writeBatch)
   * @param {Object} partnerSlot - 파트너 슬롯 객체 { id, selectedDigimon, digimonStats, version, ... }
   */
  async function proceedJogressLocal(partnerSlot) {
    if (!partnerSlot || partnerSlot.id == null) return;
    if (!currentUser?.uid || !slotId || !db) {
      alert("조그레스에는 로그인이 필요합니다.");
      return;
    }
    // 현재 슬롯 버전 기준으로 조그레스 결과 판정 (Ver.1↔Ver.2 크로스 조그레스 가능)
    const result = getJogressResult(
      selectedDigimon,
      partnerSlot.selectedDigimon,
      newDigimonDataVer1
    );
    if (!result.success) {
      alert(result.reason || "조그레스할 수 있는 조합이 아닙니다.");
      return;
    }

    const targetId = resolveEvolutionTargetKey(result.targetId, digimonDataVer1) || result.targetId;
    if (!digimonDataVer1[targetId]) {
      alert("진화 대상 디지몬 데이터를 찾을 수 없습니다.");
      return;
    }

    if (toggleModal) toggleModal("jogressPartnerSlot", false);
    if (typeof setIsEvolving === "function") setIsEvolving(true);

    try {
      const currentStats = await applyLazyUpdateBeforeAction();
      const old = { ...currentStats };
      const existingLogs = currentStats.activityLogs || activityLogs || [];
      const localJogressName = digimonDataVer1[targetId]?.name || targetId;
      const {
        resultName: newDigimonName,
        updatedLogs,
        nextStatsWithLogs: nxWithLogs,
      } = buildEvolutionTransitionState({
        currentStats: old,
        existingLogs,
        targetId,
        targetMap: digimonDataVer1,
        logText: `조그레스 진화(로컬): ${localJogressName}!`,
        snapshotArgs: [
          digimonDataVer1,
          newDigimonDataVer1,
          evolutionDataVer1,
          digimonDataVer2,
        ],
      });

      const nowMs = Date.now();
      const slotARef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
      const slotBRef = doc(db, "users", currentUser.uid, "slots", `slot${partnerSlot.id}`);
      const statsAForDb = sanitizeDigimonStatsForSlotDocument(nxWithLogs);
      const partnerStats = partnerSlot.digimonStats || {};
      const { activityLogs: _dropP1, battleLogs: _dropP2, ...partnerRest } = partnerStats;
      const partnerStatsForDb = sanitizeDigimonStatsForSlotDocument({
        ...partnerRest,
        isDead: true,
        deathReason: "JOGRESS_PARTNER (조그레스 파트너)",
        lastSavedAt: nowMs,
      });

      const batch = writeBatch(db);
      batch.update(slotARef, {
        selectedDigimon: targetId,
        digimonStats: statsAForDb,
        lastSavedAt: nowMs,
        lastSavedAtServer: serverTimestamp(),
        updatedAt: serverTimestamp(),
        revision: increment(1),
        combatRevision: increment(1),
      });
      batch.update(slotBRef, {
        digimonStats: partnerStatsForDb,
        lastSavedAt: nowMs,
        lastSavedAtServer: serverTimestamp(),
        updatedAt: serverTimestamp(),
        revision: increment(1),
      });
      await batch.commit();

      if (refreshGameRevision) {
        await refreshGameRevision(nxWithLogs);
      }

      setDigimonStats(nxWithLogs);
      setSelectedDigimon(targetId);
      const newLogEntry = updatedLogs[updatedLogs.length - 1];
      if (appendLogToSubcollection && newLogEntry) {
        await appendLogToSubcollection(newLogEntry).catch(() => {});
      }

      await syncEvolutionEncyclopediaEntries({
        previousDigimonId: selectedDigimon,
        previousStats: old,
        targetId,
        nextStats: nxWithLogs,
        currentUser,
        version,
      });

      // 조그레스 성공 요약: 현재 디지몬 / 파트너(조그레스 파트너 사망) 구분 표시용
      const currentDisplayName = getDigimonDisplayName(
        getPreferredMaps(version, [slotEvolutionDataMap]),
        selectedDigimon
      );
      const partnerDisplayName = getDigimonDisplayName(
        getPreferredMaps(partnerSlot.version),
        partnerSlot.selectedDigimon
      );
      const resultDisplayName =
        getDigimonDisplayName(getPreferredMaps(version, [slotEvolutionDataMap]), targetId) ||
        newDigimonName;
      const hostSlotLabel = slotName || `슬롯${slotId}`;
      const guestSlotLabel = partnerSlot.slotName || `슬롯${partnerSlot.id}`;
      const jogressSummary = buildJogressSummary({
        currentDisplayName,
        partnerDisplayName,
        resultDisplayName,
        hostSlotLabel,
        guestSlotLabel,
      });
      if (setEvolutionCompleteJogressSummary) setEvolutionCompleteJogressSummary(jogressSummary);
      if (setEvolvedDigimonName) setEvolvedDigimonName(resultDisplayName);

      const tamerDisplay = resolveTamerNamePriority({
        tamerName,
        currentUser,
        fallback: null,
      });
      await persistJogressLogWithArchive({
        currentUser,
        warningLabel: "[proceedJogressLocal]",
        archivePayload: buildJogressArchivePayload({
          mode: "local",
          hostUid: currentUser.uid,
          hostTamerName: tamerDisplay,
          hostSlotId: slotId,
          hostDigimonName: currentDisplayName,
          hostSlotVersion: version || "Ver.1",
          guestUid: currentUser.uid,
          guestTamerName: tamerDisplay,
          guestSlotId: partnerSlot.id,
          guestDigimonName: partnerDisplayName,
          guestSlotVersion: partnerSlot.version || "Ver.1",
          targetId,
          targetName: newDigimonName,
          isOnline: false,
          resultName: resultDisplayName,
          hostSlotLabel,
          guestSlotLabel,
        }),
      });

      if (setEvolutionCompleteIsJogress) setEvolutionCompleteIsJogress(true);
      if (setEvolutionStage) setEvolutionStage("complete");
    } catch (err) {
      console.error("[proceedJogressLocal] 오류:", err);
      alert("조그레스 처리 중 오류가 발생했습니다.");
    } finally {
      if (typeof setIsEvolving === "function") setIsEvolving(false);
    }
  }

  /**
   * 진화 준비 상태 확인
   * @returns {boolean} 진화 가능 여부
   */
  function checkEvolutionReady() {
    if (digimonStats.isDead && !developerMode) return false;
    // 실제 진화 조건 체크는 handleEvolutionButton에서 수행
    return true;
  }

  // ========== 서버 주도 온라인 조그레스 ==========

  async function applyServerOutcome(outcome, targetSlotId) {
    if (!outcome) return false;
    const isCurrentSlot = String(targetSlotId) === String(slotId);
    if (isCurrentSlot) {
      setSelectedDigimon?.(outcome.selectedDigimon);
      setDigimonStats?.(outcome.digimonStats || {});
      if (Array.isArray(outcome.digimonStats?.activityLogs)) {
        setActivityLogs?.(outcome.digimonStats.activityLogs);
      }
      await refreshGameRevision?.(outcome.digimonStats || {});
    }
    return isCurrentSlot;
  }

  async function proceedJogressOnlineAsGuestServer(room, guestSlot) {
    if (!currentUser?.uid || !room?.id || guestSlot?.id == null) return;
    try {
      if (String(guestSlot.id) === String(slotId)) await flushOutbox?.();
      const expectedRevision = String(guestSlot.id) === String(slotId)
        ? await refreshGameRevision?.()
        : Number(guestSlot.revision);
      const result = await joinJogressRoomApi(currentUser, {
        roomId: room.id,
        guestSlotId: guestSlot.id,
        expectedRevision,
      });
      await applyServerOutcome(result?.slotOutcome, guestSlot.id);
      if (result?.room?.completionMode === "ghost") {
        const resultDisplayName = result?.slotOutcome?.resultName || result?.slotOutcome?.selectedDigimon;
        await persistJogressLogWithArchive({
          currentUser,
          warningLabel: "[joinJogressGhostServer]",
          archivePayload: buildJogressArchivePayload({
            mode: "online-ghost",
            hostUid: result.room.hostUid,
            hostTamerName: result.room.hostTamerName || null,
            hostSlotId: result.room.hostSlotId,
            hostDigimonName: result.room.hostSnapshot?.name || result.room.hostDigimonId,
            hostSlotVersion: result.room.hostSnapshot?.version || result.room.hostSlotVersion,
            guestUid: currentUser.uid,
            guestTamerName: tamerName || currentUser.displayName || null,
            guestSlotId: guestSlot.id,
            guestDigimonName: guestSlot.selectedDigimon,
            guestSlotVersion: guestSlot.version,
            targetId: result?.slotOutcome?.selectedDigimon,
            targetName: resultDisplayName,
            isOnline: true,
            resultName: resultDisplayName,
            roomId: result.room.id,
          }),
        });
      }
      showJogressSuccessFeedback({
        resultDisplayName: result?.slotOutcome?.resultName || result?.slotOutcome?.selectedDigimon,
        toggleModal,
        closeModalName: "jogressRoomList",
      });
      return result;
    } catch (error) {
      console.error("[proceedJogressOnlineAsGuestServer]", error);
      alert(error instanceof JogressApiError ? error.message : "참가 처리 중 오류가 발생했습니다.");
      return null;
    }
  }

  async function completeServerRoom(room, currentSlotOnly = false) {
    if (!currentUser?.uid || !room?.id) return null;
    const hostSlotId = room.hostSlotId ?? slotId;
    try {
      let expectedRevision = Number(room.hostRevision);
      if (String(hostSlotId) === String(slotId)) {
        await flushOutbox?.();
        expectedRevision = await refreshGameRevision?.();
      } else if (currentSlotOnly) {
        throw new JogressApiError("현재 슬롯의 조그레스 상태가 아닙니다.");
      }
      if (!Number.isInteger(Number(expectedRevision))) {
        throw new JogressApiError("호스트 슬롯의 최신 상태를 다시 불러와 주세요.");
      }
      const result = await completeJogressRoomApi(currentUser, {
        roomId: room.id,
        expectedRevision: Number(expectedRevision),
      });
      await applyServerOutcome(result?.slotOutcome, hostSlotId);
      const resultDisplayName = result?.slotOutcome?.resultName || result?.slotOutcome?.selectedDigimon;
      const completedRoom = result?.room || room;
      await persistJogressLogWithArchive({
        currentUser,
        warningLabel: "[completeJogressRoomServer]",
        archivePayload: buildJogressArchivePayload({
          mode: "online-server",
          hostUid: currentUser.uid,
          hostTamerName: completedRoom.hostTamerName || tamerName || null,
          hostSlotId,
          hostDigimonName: resultDisplayName,
          hostSlotVersion: completedRoom.hostSlotVersion || version,
          guestUid: completedRoom.guestUid || null,
          guestTamerName: completedRoom.guestTamerName || null,
          guestSlotId: completedRoom.guestSlotId ?? null,
          guestDigimonName: completedRoom.guestDigimonId || null,
          guestSlotVersion: completedRoom.guestSlotVersion || null,
          targetId: result?.slotOutcome?.selectedDigimon,
          targetName: resultDisplayName,
          isOnline: true,
          resultName: resultDisplayName,
          roomId: completedRoom.id || room.id,
        }),
      });
      finalizeOnlineJogressCompletionState({
        resultDisplayName,
        setEvolutionCompleteIsJogress,
        setEvolvedDigimonName,
        setEvolutionStage,
      });
      showJogressSuccessFeedback({ resultDisplayName, toggleModal, closeModalName: "jogressRoomList" });
      return result;
    } catch (error) {
      console.error("[completeJogressRoomServer]", error);
      alert(error instanceof JogressApiError ? error.message : "조그레스 진화 처리 중 오류가 발생했습니다.");
      return null;
    } finally {
      if (typeof setIsEvolving === "function") setIsEvolving(false);
    }
  }

  async function proceedJogressOnlineAsHostServer(jogressStatus) {
    if (!jogressStatus?.roomId) {
      alert("진화할 수 있는 상태가 아닙니다.");
      return null;
    }
    if (typeof setIsEvolving === "function") setIsEvolving(true);
    return completeServerRoom({
      id: jogressStatus.roomId,
      hostSlotId: slotId,
      hostRevision: jogressStatus.hostRevision,
    }, true);
  }

  async function proceedJogressOnlineAsHostForRoomServer(room) {
    if (typeof setIsEvolving === "function") setIsEvolving(true);
    return completeServerRoom(room, false);
  }

  return {
    evolve,
    handleEvolutionButton,
    proceedEvolution,
    proceedJogressLocal,
    checkEvolutionReady,
    createJogressRoom,
    createJogressRoomForSlot,
    cancelJogressRoom,
    proceedJogressOnlineAsGuest: proceedJogressOnlineAsGuestServer,
    applyHostJogressStatusFromRoom,
    proceedJogressOnlineAsHost: proceedJogressOnlineAsHostServer,
    proceedJogressOnlineAsHostForRoom: proceedJogressOnlineAsHostForRoomServer,
  };
}
