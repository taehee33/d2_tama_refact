// src/hooks/useEvolution.js
// Game.jsx의 진화(Evolution) 로직을 분리한 Custom Hook

import { writeBatch, doc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { checkEvolution } from "../logic/evolution/checker";
import { getJogressResult } from "../logic/evolution/jogress";
import { sanitizeDigimonStatsForSlotDocument } from "./useGameData";
import { buildEvolutionTransitionState } from "./evolutionStateHelpers";
import { syncEvolutionEncyclopediaEntries } from "./evolutionEncyclopediaHelpers";
import {
  buildCompletedJogressRoomUpdate,
  buildCompletedJogressSlotUpdate,
  buildGuestPairingRoomUpdate,
  syncCurrentJogressSlot,
} from "./jogressPersistenceHelpers";
import {
  finalizeOnlineJogressCompletionState,
} from "./jogressCompletionHelpers";
import {
  buildJogressArchivePayload,
  buildJogressSummary,
} from "./jogressPresentationHelpers";
import { showJogressSuccessFeedback } from "./jogressUiFeedbackHelpers";
import {
  isOnlineJogressSupported,
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

/** 맵 키 또는 entry.id로 한글 이름 조회 (슬롯에 id가 저장된 경우 대비) */
function getDigimonDisplayName(maps, digimonId) {
  if (!digimonId) return digimonId;
  const mapList = Array.isArray(maps) ? maps : [maps];
  for (const map of mapList) {
    if (!map || typeof map !== "object") continue;
    const byKey = map[digimonId]?.name;
    if (byKey) return byKey;
    const entry = Object.values(map).find((e) => e && e.id === digimonId);
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
  toggleModal,
  version = "Ver.1", // 슬롯 버전 (도감 관리용)
}) {
  const slotRuntimeDataMap = digimonDataVer1 || {};
  const slotEvolutionDataMap = newDigimonDataVer1 || {};
  const normalizedSlotVersion = normalizeDigimonVersionLabel(version);

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

  const resolveJogressPartnerDisplayName = ({
    versionLabel = "Ver.1",
    digimonId,
  }) => {
    const v1Map = evolutionDataVer1 ?? newDigimonDataVer1;
    const versionMap = versionLabel === "Ver.2" ? digimonDataVer2 : v1Map;

    return getDigimonDisplayName(
      [versionMap, digimonDataVer1, digimonDataVer2],
      digimonId
    );
  };

  const {
    createJogressRoom,
    createJogressRoomForSlot,
    cancelJogressRoom,
    cancelOwnedWaitingJogressRoomsForSlot,
    applyHostJogressStatusFromRoom,
  } = useJogressRoomLifecycle({
    currentUser,
    slotId,
    selectedDigimon,
    version,
    tamerName,
    digimonNickname,
    slotEvolutionDataMap,
    resolveGuestDigimonName: resolveJogressPartnerDisplayName,
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
  async function proceedEvolution() {
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
    
    const currentDigimonData = slotEvolutionDataMap[digimonName];
    if (!currentDigimonData) {
      console.error(`No data for ${digimonName} in slotEvolutionDataMap!`);
      console.error('Available keys:', Object.keys(slotEvolutionDataMap));
      console.error('selectedDigimon:', selectedDigimon);
      console.error('evolutionStage:', updatedStats.evolutionStage);
      return;
    }
    
    // '모든 진화 조건 무시' 옵션: 조건 검사 없이 첫 번째 진화 대상으로 진화
    if (ignoreEvolutionTime) {
      const evolutions = currentDigimonData.evolutions || [];
      const firstOption = evolutions.find((e) => !e.jogress);
      const targetId = firstOption ? (firstOption.targetId || firstOption.targetName) : null;
      if (!targetId) {
        alert("진화 가능한 형태가 없습니다.");
        return;
      }
      const targetData = slotEvolutionDataMap[targetId];
      const evolvedName = targetData?.name || targetData?.id || targetId;
      setEvolvedDigimonName(evolvedName);
      if (developerMode) {
        setEvolutionStage('complete');
        await evolve(targetId);
      } else {
        if (typeof setIsEvolving === 'function') setIsEvolving(true);
        setEvolutionStage('shaking');
        setTimeout(() => {
          setEvolutionStage('flashing');
          setTimeout(() => {
            setEvolutionStage('complete');
            setTimeout(async () => {
              await evolve(targetId);
              if (typeof setIsEvolving === 'function') setIsEvolving(false);
            }, 500);
          }, 2000);
        }, 2000);
      }
      return;
    }
    
    // 개발자 모드: 시간 조건만 0으로 두고 나머지 조건은 판정
    const statsForCheck = developerMode
      ? { ...updatedStats, timeToEvolveSeconds: 0 }
      : updatedStats;
    const evolutionResult = checkEvolution(statsForCheck, currentDigimonData, digimonName, slotEvolutionDataMap);
    
    if (evolutionResult.success) {
      const targetId = evolutionResult.targetId;
      const targetData = slotEvolutionDataMap[targetId];
      const evolvedName = targetData?.name || targetData?.id || targetId;
      setEvolvedDigimonName(evolvedName);
      if (developerMode) {
        setEvolutionStage('complete');
        await evolve(targetId);
      } else {
        if (typeof setIsEvolving === 'function') setIsEvolving(true);
        setEvolutionStage('shaking');
        setTimeout(() => {
          setEvolutionStage('flashing');
          setTimeout(() => {
            setEvolutionStage('complete');
            setTimeout(async () => {
              await evolve(targetId);
              if (typeof setIsEvolving === 'function') setIsEvolving(false);
            }, 500);
          }, 2000);
        }, 2000);
      }
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
  async function evolve(newName) {
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
    });

    if (newDigimonData?.sprite !== undefined) {
      console.log("[evolve] 스프라이트 동기화:", {
        digimon: newName,
        sprite: newDigimonData.sprite,
      });
    }
    if (appendLogToSubcollection) await appendLogToSubcollection(updatedLogs[updatedLogs.length - 1]).catch(() => {});
    await setDigimonStatsAndSave(nxWithLogs, updatedLogs);
    await setSelectedDigimonAndSave(newName);
    
    await syncEvolutionEncyclopediaEntries({
      previousDigimonId: selectedDigimon,
      previousStats: old,
      targetId: newName,
      nextStats: nxWithLogs,
      currentUser,
      version,
    });
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
      });
      batch.update(slotBRef, {
        digimonStats: partnerStatsForDb,
        lastSavedAt: nowMs,
        lastSavedAtServer: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();

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

      // 조그레스 성공 요약: 현재 디지몬 / 파트너(사라짐) 디지몬 구분 표시용 (한글명 사용, 키 또는 id로 조회)
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

  // ========== 온라인 조그레스 ==========

  /**
   * 게스트: 방에 참가 시 사망 없이 즉시 조그레스 진화 (참가자 슬롯이 결과 디지몬으로 진화)
   * @param {Object} room - jogress_rooms 문서 스냅 데이터 + id
   * @param {Object} guestSlot - 참가할 내 슬롯 { id, selectedDigimon, digimonStats, version, ... }
   */
  async function proceedJogressOnlineAsGuest(room, guestSlot) {
    if (!currentUser?.uid || !db || !room?.id) return;
    if (
      !isOnlineJogressSupported(room.hostSlotVersion) ||
      !isOnlineJogressSupported(guestSlot?.version)
    ) {
      alert("Ver.3~Ver.5 온라인 조그레스는 아직 준비 중입니다.");
      return;
    }
    const v1Map = evolutionDataVer1 ?? newDigimonDataVer1;
    const hostMap = room.hostSlotVersion === "Ver.2" ? digimonDataVer2 : v1Map;
    const result = getJogressResult(room.hostDigimonId, guestSlot.selectedDigimon, hostMap);
    if (!result.success) {
      alert(result.reason || "조그레스할 수 있는 조합이 아닙니다.");
      return;
    }
    const hostTargetId = resolveEvolutionTargetKey(result.targetId, hostMap) || result.targetId;
    const guestVersion = guestSlot.version || "Ver.1";
    const guestMap = guestVersion === "Ver.2" ? digimonDataVer2 : v1Map;
    const guestTargetId =
      resolveEvolutionTargetKey(hostTargetId, guestMap) ||
      (guestMap[hostTargetId.replace(/V1$/i, "V2")] ? hostTargetId.replace(/V1$/i, "V2") : null) ||
      (guestMap[hostTargetId.replace(/V2$/i, "V1")] ? hostTargetId.replace(/V2$/i, "V1") : null) ||
      hostTargetId;
    const newDigimonData = guestMap[guestTargetId] || {};
    const guestStats = guestSlot.digimonStats || {};
    const existingLogs = Array.isArray(guestStats.activityLogs) ? guestStats.activityLogs : [];
    const onlineGuestName = newDigimonData.name || guestTargetId;
    const {
      resultName,
      updatedLogs,
      nextStatsWithLogs: nxWithLogs,
    } = buildEvolutionTransitionState({
      currentStats: guestStats,
      existingLogs,
      targetId: guestTargetId,
      targetMap: guestMap,
      logText: `조그레스 진화(온라인): ${onlineGuestName}!`,
      snapshotArgs: [guestMap, digimonDataVer1, newDigimonDataVer1],
    });
    const statsForDb = sanitizeDigimonStatsForSlotDocument(nxWithLogs);
    const nowMs = Date.now();

    try {
      const roomRef = doc(db, "jogress_rooms", room.id);
      const guestSlotRef = doc(db, "users", currentUser.uid, "slots", `slot${guestSlot.id}`);
      const batch = writeBatch(db);
      const serverTimestampValue = serverTimestamp();
      batch.update(
        roomRef,
        buildGuestPairingRoomUpdate({
          currentUser,
          tamerName,
          guestSlot,
          guestVersion,
          hostTargetId,
          serverTimestampValue,
        })
      );
      batch.update(
        guestSlotRef,
        buildCompletedJogressSlotUpdate({
          targetId: guestTargetId,
          statsForDb,
          nowMs,
          serverTimestampValue,
          clearJogressStatus: false,
        })
      );
      await batch.commit();

      const isCurrentSlot = slotId != null && String(guestSlot.id) === String(slotId);
      await syncCurrentJogressSlot({
        isCurrentSlot,
        targetId: guestTargetId,
        nextStatsWithLogs: nxWithLogs,
        updatedLogs,
        syncMode: "save-if-possible",
        setDigimonStatsAndSave,
        setSelectedDigimonAndSave,
      });

      await cancelOwnedWaitingJogressRoomsForSlot(guestSlot.id);

      showJogressSuccessFeedback({
        resultDisplayName: resultName,
      });
    } catch (err) {
      console.error("[proceedJogressOnlineAsGuest] 오류:", err);
      alert("참가 처리 중 오류가 발생했습니다.");
    }
  }

  /**
   * 호스트: 조그레스 온라인 진화 실행 (jogressStatus.canEvolve일 때)
   * @param {Object} jogressStatus - 현재 슬롯의 jogressStatus (canEvolve, targetId, roomId)
   */
  async function proceedJogressOnlineAsHost(jogressStatus) {
    if (!currentUser?.uid || !slotId || !db || !jogressStatus?.canEvolve || !jogressStatus?.targetId) {
      alert("진화할 수 있는 상태가 아닙니다.");
      return;
    }
    if (!isOnlineJogressSupported(version)) {
      alert("Ver.3~Ver.5 온라인 조그레스는 아직 준비 중입니다.");
      return;
    }
    const targetId = jogressStatus.targetId;
    const roomId = jogressStatus.roomId;
    const v1Map = evolutionDataVer1 ?? newDigimonDataVer1;
    const hostMap = version === "Ver.2" ? digimonDataVer2 : v1Map;
    if (!hostMap[targetId]) {
      alert("진화 대상 디지몬 데이터를 찾을 수 없습니다.");
      return;
    }
    if (toggleModal) toggleModal("jogressOnlineSelect", false);
    if (typeof setIsEvolving === "function") setIsEvolving(true);
    try {
      const roomRef = doc(db, "jogress_rooms", roomId);
      const roomSnap = await getDoc(roomRef);
      const roomData = roomSnap.exists() ? roomSnap.data() : {};
      const currentStats = await applyLazyUpdateBeforeAction();
      const old = { ...currentStats };
      const existingLogs = currentStats.activityLogs || activityLogs || [];
      const onlineHostName = hostMap[targetId]?.name || targetId;
      const {
        targetDigimonData: newDigimonData,
        resultName: newDigimonName,
        updatedLogs,
        nextStatsWithLogs: nxWithLogs,
      } = buildEvolutionTransitionState({
        currentStats: old,
        existingLogs,
        targetId,
        targetMap: hostMap,
        logText: `조그레스 진화(온라인): ${onlineHostName}!`,
        snapshotArgs: [hostMap, digimonDataVer1, newDigimonDataVer1],
      });
      const nowMs = Date.now();
      const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
      const statsForDb = sanitizeDigimonStatsForSlotDocument(nxWithLogs);
      const serverTimestampValue = serverTimestamp();
      await updateDoc(
        slotRef,
        buildCompletedJogressSlotUpdate({
          targetId,
          statsForDb,
          nowMs,
          serverTimestampValue,
        })
      );
      await updateDoc(roomRef, buildCompletedJogressRoomUpdate(serverTimestampValue));
      await syncCurrentJogressSlot({
        isCurrentSlot: true,
        targetId,
        nextStatsWithLogs: nxWithLogs,
        updatedLogs,
        appendLogToSubcollection,
        appendLogWhenCurrent: true,
        syncMode: "local-only",
        setDigimonStats,
        setSelectedDigimon,
      });
      await syncEvolutionEncyclopediaEntries({
        previousDigimonId: selectedDigimon,
        previousStats: old,
        targetId,
        nextStats: nxWithLogs,
        currentUser,
        version,
      });
      const hostDisplayName = getDigimonDisplayName([hostMap, digimonDataVer1, digimonDataVer2], selectedDigimon);
      const guestDigimonName = getDigimonDisplayName(
        [roomData.guestSlotVersion === "Ver.2" ? digimonDataVer2 : digimonDataVer1, digimonDataVer1, digimonDataVer2],
        roomData.guestDigimonId
      );
      const resultDisplayName = getDigimonDisplayName([digimonDataVer1, digimonDataVer2], targetId) || newDigimonName;
      const hostSlotLabel = slotName || `슬롯${slotId}`;
      const guestSlotLabel = roomData.guestSlotId != null ? `슬롯${roomData.guestSlotId}` : "";
      const guestTamerName = roomData.guestTamerName || "참가자";
      const jogressSummary = buildJogressSummary({
        currentDisplayName: hostDisplayName,
        partnerDisplayName: guestDigimonName,
        resultDisplayName,
        hostSlotLabel,
        guestSlotLabel,
        partnerTamerName: guestTamerName,
        includePartnerDigimonName: true,
      });
      if (setEvolutionCompleteJogressSummary) setEvolutionCompleteJogressSummary(jogressSummary);
      const tamerDisplay = resolveTamerNamePriority({
        tamerName,
        currentUser,
        fallback: null,
      });
      await persistJogressLogWithArchive({
        currentUser,
        warningLabel: "[proceedJogressOnlineAsHost]",
        archivePayload: buildJogressArchivePayload({
          mode: "online-host",
          hostUid: currentUser.uid,
          hostTamerName: tamerDisplay,
          hostSlotId: slotId,
          hostDigimonName: newDigimonData.name || selectedDigimon,
          hostSlotVersion: version || "Ver.1",
          guestUid: roomData.guestUid || null,
          guestTamerName: roomData.guestTamerName || null,
          guestSlotId: roomData.guestSlotId ?? null,
          guestDigimonName: guestDigimonName,
          guestSlotVersion: roomData.guestSlotVersion || "Ver.1",
          targetId,
          targetName: newDigimonName,
          isOnline: true,
          resultName: resultDisplayName,
          hostSlotLabel,
          guestSlotLabel,
          roomId: roomData.id || null,
        }),
      });
      finalizeOnlineJogressCompletionState({
        resultDisplayName,
        setEvolutionCompleteIsJogress,
        setEvolvedDigimonName,
        setEvolutionStage,
      });
    } catch (err) {
      console.error("[proceedJogressOnlineAsHost] 오류:", err);
      alert("조그레스 진화 처리 중 오류가 발생했습니다.");
    } finally {
      if (typeof setIsEvolving === "function") setIsEvolving(false);
    }
  }

  /**
   * 호스트: 모달에서 특정 방(paired)에 대해 진화 실행 (해당 슬롯 문서만 갱신, 현재 슬롯이면 로컬 상태도 반영)
   * @param {Object} room - jogress_rooms 문서 스냅 (id, hostSlotId, targetId, hostSlotVersion, guest* 등)
   */
  async function proceedJogressOnlineAsHostForRoom(room) {
    if (!currentUser?.uid || !db || !room?.id || room?.status !== "paired") {
      alert("진화할 수 있는 상태가 아닙니다.");
      return;
    }
    if (!isOnlineJogressSupported(room.hostSlotVersion)) {
      alert("Ver.3~Ver.5 온라인 조그레스는 아직 준비 중입니다.");
      return;
    }
    const targetId = room.targetId;
    const hostSlotId = room.hostSlotId;
    const v1Map = evolutionDataVer1 ?? newDigimonDataVer1;
    const hostMap = room.hostSlotVersion === "Ver.2" ? digimonDataVer2 : v1Map;
    if (!hostMap[targetId]) {
      alert("진화 대상 디지몬 데이터를 찾을 수 없습니다.");
      return;
    }
    if (typeof setIsEvolving === "function") setIsEvolving(true);
    try {
      const roomRef = doc(db, "jogress_rooms", room.id);
      const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${hostSlotId}`);
      const slotSnap = await getDoc(slotRef);
      const slotData = slotSnap.exists() ? slotSnap.data() : {};
      const currentStats = slotData.digimonStats || {};
      const old = { ...currentStats };
      const existingLogs = Array.isArray(currentStats.activityLogs) ? currentStats.activityLogs : [];
      const onlineRoomName = hostMap[targetId]?.name || targetId;
      const {
        resultName: newDigimonName,
        updatedLogs,
        nextStatsWithLogs: nxWithLogs,
      } = buildEvolutionTransitionState({
        currentStats: old,
        existingLogs,
        targetId,
        targetMap: hostMap,
        logText: `조그레스 진화(온라인): ${onlineRoomName}!`,
        snapshotArgs: [hostMap, digimonDataVer1, newDigimonDataVer1],
      });
      const statsForDb = sanitizeDigimonStatsForSlotDocument(nxWithLogs);
      const nowMs = Date.now();
      const serverTimestampValue = serverTimestamp();
      await updateDoc(
        slotRef,
        buildCompletedJogressSlotUpdate({
          targetId,
          statsForDb,
          nowMs,
          serverTimestampValue,
        })
      );
      await updateDoc(roomRef, buildCompletedJogressRoomUpdate(serverTimestampValue));
      const hostVersion = room.hostSlotVersion || "Ver.1";
      const prevDigimon = slotData.selectedDigimon;
      await syncEvolutionEncyclopediaEntries({
        previousDigimonId: prevDigimon,
        previousStats: old,
        targetId,
        nextStats: nxWithLogs,
        currentUser,
        version: hostVersion,
        swallowErrors: true,
      });
      const guestDigimonName = getDigimonDisplayName(
        [room.guestSlotVersion === "Ver.2" ? digimonDataVer2 : v1Map, digimonDataVer1, digimonDataVer2],
        room.guestDigimonId
      );
      const resultDisplayName = getDigimonDisplayName([digimonDataVer1, digimonDataVer2], targetId) || newDigimonName;
      const isCurrentSlot = slotId != null && String(hostSlotId) === String(slotId);
      await persistJogressLogWithArchive({
        currentUser,
        warningLabel: "[proceedJogressOnlineAsHostForRoom]",
        archivePayload: buildJogressArchivePayload({
          mode: "online-room",
          hostUid: currentUser.uid,
          hostTamerName: resolveTamerNamePriority({
            tamerName,
            currentUser,
            fallback: null,
          }),
          hostSlotId: hostSlotId,
          hostDigimonName: newDigimonName,
          hostSlotVersion: hostVersion,
          guestUid: room.guestUid || null,
          guestTamerName: room.guestTamerName || null,
          guestSlotId: room.guestSlotId ?? null,
          guestDigimonName: guestDigimonName || room.guestDigimonId,
          guestSlotVersion: room.guestSlotVersion || "Ver.1",
          targetId,
          targetName: newDigimonName,
          isOnline: true,
          resultName: resultDisplayName,
          roomId: room.id,
        }),
      });
      await syncCurrentJogressSlot({
        isCurrentSlot,
        targetId,
        nextStatsWithLogs: nxWithLogs,
        updatedLogs,
        appendLogToSubcollection,
        appendLogWhenCurrent: true,
        syncMode: "save-if-possible",
        setDigimonStatsAndSave,
        setSelectedDigimonAndSave,
        setDigimonStats,
        setSelectedDigimon,
      });
      finalizeOnlineJogressCompletionState({
        resultDisplayName,
        setEvolutionCompleteIsJogress,
        setEvolvedDigimonName,
        setEvolutionStage,
      });
      showJogressSuccessFeedback({
        resultDisplayName,
        toggleModal,
        closeModalName: "jogressRoomList",
      });
    } catch (err) {
      console.error("[proceedJogressOnlineAsHostForRoom] 오류:", err);
      alert("조그레스 진화 처리 중 오류가 발생했습니다.");
    } finally {
      if (typeof setIsEvolving === "function") setIsEvolving(false);
    }
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
    proceedJogressOnlineAsGuest,
    applyHostJogressStatusFromRoom,
    proceedJogressOnlineAsHost,
    proceedJogressOnlineAsHostForRoom,
  };
}
