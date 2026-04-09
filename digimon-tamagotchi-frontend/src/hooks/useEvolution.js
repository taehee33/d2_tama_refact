// src/hooks/useEvolution.js
// Game.jsx의 진화(Evolution) 로직을 분리한 Custom Hook

import { writeBatch, doc, collection, addDoc, updateDoc, getDoc, getDocs, query, where, limit, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { checkEvolution } from "../logic/evolution/checker";
import { getJogressResult } from "../logic/evolution/jogress";
import { initializeStats } from "../data/stats";
import { addActivityLog } from "./useGameLogic";
import { sanitizeDigimonStatsForSlotDocument } from "./useGameData";
import { updateEncyclopedia } from "./useEncyclopedia";
import { archiveJogressLog, createLogArchiveId } from "../utils/logArchiveApi";
import { buildDigimonLogSnapshot } from "../utils/digimonLogSnapshot";
import {
  getDigimonDataMapByVersion,
  getDigimonDataMapsByPreference,
  getStarterDigimonId,
  isStarterDigimonId,
  normalizeDigimonVersionLabel,
} from "../utils/digimonVersionUtils";

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

  function isOnlineJogressSupported(versionLabel = "Ver.1") {
    const normalizedVersion = normalizeDigimonVersionLabel(versionLabel);
    return normalizedVersion === "Ver.1" || normalizedVersion === "Ver.2";
  }

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
    
    // 진화 시 스탯 리셋 (매뉴얼 규칙)
    // careMistakes, overfeeds, battlesForEvolution, proteinOverdose 등은 리셋하지만,
    // injuries는 이번 생 누적으로 유지한다.
    
    // 새 디지몬 데이터 가져오기 (minWeight, maxEnergy 확인용)
    const newDigimonData = slotRuntimeDataMap[newName] || {};
    // minWeight는 stats.minWeight 또는 직접 minWeight로 저장될 수 있음
    const minWeight = newDigimonData.stats?.minWeight || newDigimonData.minWeight || 0;
    // maxEnergy는 stats.maxEnergy 또는 maxStamina로 저장될 수 있음 (0도 유효한 값이므로 ?? 사용)
    const maxEnergy = newDigimonData.stats?.maxEnergy ?? newDigimonData.stats?.maxStamina ?? newDigimonData.maxEnergy ?? newDigimonData.maxStamina ?? 0;
    
    const resetStats = {
      ...old,
      careMistakes: 0,
      overfeeds: 0,
      proteinOverdose: 0,
      trainings: 0,
      sleepDisturbances: 0,
      strength: 0, // 진화 시 strength 리셋
      effort: 0, // 진화 시 effort 리셋
      energy: maxEnergy, // 진화 시 energy를 최대값으로 설정
      weight: minWeight, // 진화 시 weight를 새 디지몬의 minWeight로 리셋
      // 현재 디지몬 배틀 값 리셋 (총 토탈은 유지)
      battles: 0,
      battlesWon: 0,
      battlesLost: 0,
      winRate: 0,
      // 총 토탈 배틀 값은 유지 (이미 old에 포함되어 있음)
    };
    
    const nx = initializeStats(newName, resetStats, slotRuntimeDataMap);
    
    // 스프라이트 값 강제 동기화 (데이터 일관성 보장)
    // digimonStats.sprite가 잘못된 값일 수 있으므로 digimonDataVer1에서 직접 가져오기
    if (newDigimonData?.sprite !== undefined) {
      nx.sprite = newDigimonData.sprite;
      console.log("[evolve] 스프라이트 동기화:", {
        digimon: newName,
        sprite: newDigimonData.sprite,
      });
    }
    
    const existingLogs = currentStats.activityLogs || activityLogs || [];
    const newDigimonName = newDigimonData.name || newName;
    const updatedLogs = addActivityLog(
      existingLogs,
      "EVOLUTION",
      `Evolution: Evolved to ${newDigimonName}!`,
      buildDigimonLogSnapshot(
        newName,
        slotRuntimeDataMap,
        slotEvolutionDataMap,
        evolutionDataVer1,
        digimonDataVer2
      )
    );
    if (appendLogToSubcollection) await appendLogToSubcollection(updatedLogs[updatedLogs.length - 1]).catch(() => {});
    const nxWithLogs = { ...nx, activityLogs: updatedLogs, selectedDigimon: newName };
    await setDigimonStatsAndSave(nxWithLogs, updatedLogs);
    await setSelectedDigimonAndSave(newName);
    
    // ✅ 도감 업데이트: 스타터 단계를 포함한 진화 전 디지몬 기록
    if (selectedDigimon) {
      await updateEncyclopedia(
        selectedDigimon,
        old, // 진화 전 스탯
        'evolution',
        currentUser,
        version // 버전 전달 (Ver.2 별도 관리)
      );
    }
    
    // ✅ 도감 업데이트: 진화 후 디지몬 발견 처리 (계정별 통합, 버전별 관리)
    if (newName && !isStarterDigimonId(newName)) {
      await updateEncyclopedia(
        newName,
        nxWithLogs, // 진화 후 스탯
        'discovery',
        currentUser,
        version // 버전 전달 (Ver.2 별도 관리)
      );
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
      const newDigimonData = digimonDataVer1[targetId] || {};
      const minWeight = newDigimonData.stats?.minWeight ?? newDigimonData.minWeight ?? 0;
      const maxEnergy = newDigimonData.stats?.maxEnergy ?? newDigimonData.stats?.maxStamina ?? newDigimonData.maxEnergy ?? newDigimonData.maxStamina ?? 0;

      const resetStats = {
        ...old,
        careMistakes: 0,
        overfeeds: 0,
        proteinOverdose: 0,
        trainings: 0,
        sleepDisturbances: 0,
        strength: 0,
        effort: 0,
        energy: maxEnergy,
        weight: minWeight,
        battles: 0,
        battlesWon: 0,
        battlesLost: 0,
        winRate: 0,
      };
      const nx = initializeStats(targetId, resetStats, digimonDataVer1);
      if (newDigimonData?.sprite !== undefined) nx.sprite = newDigimonData.sprite;

      const existingLogs = currentStats.activityLogs || activityLogs || [];
      const newDigimonName = newDigimonData.name || targetId;
      const updatedLogs = addActivityLog(
        existingLogs,
        "EVOLUTION",
        `조그레스 진화(로컬): ${newDigimonName}!`,
        buildDigimonLogSnapshot(
          targetId,
          digimonDataVer1,
          newDigimonDataVer1,
          evolutionDataVer1,
          digimonDataVer2
        )
      );
      const nxWithLogs = { ...nx, activityLogs: updatedLogs, selectedDigimon: targetId };

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

      if (selectedDigimon) {
        await updateEncyclopedia(selectedDigimon, old, "evolution", currentUser, version);
      }
      if (targetId && !isStarterDigimonId(targetId)) {
        await updateEncyclopedia(targetId, nxWithLogs, "discovery", currentUser, version);
      }

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
      const jogressSummary = {
        currentLabel: `${currentDisplayName}(${hostSlotLabel})`,
        partnerLabel: `${partnerDisplayName}(${guestSlotLabel})`,
        resultName: resultDisplayName,
      };
      if (setEvolutionCompleteJogressSummary) setEvolutionCompleteJogressSummary(jogressSummary);
      if (setEvolvedDigimonName) setEvolvedDigimonName(resultDisplayName);

      const tamerDisplay = tamerName || currentUser?.displayName || null;
      await persistJogressLogWithArchive({
        currentUser,
        warningLabel: "[proceedJogressLocal]",
        archivePayload: {
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
          payload: {
            mode: "local",
            resultName: resultDisplayName,
            hostSlotLabel,
            guestSlotLabel,
          },
        },
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
   * 조그레스 방 생성 (호스트)
   * @returns {Promise<{ roomId: string }|null>}
   */
  async function createJogressRoom() {
    if (!currentUser?.uid || !slotId || !db) {
      alert("조그레스에는 로그인이 필요합니다.");
      return null;
    }
    if (!isOnlineJogressSupported(version)) {
      alert("Ver.3~Ver.5 온라인 조그레스는 아직 준비 중입니다. 로컬 조그레스를 이용해 주세요.");
      return null;
    }
    const evolutions = newDigimonDataVer1[selectedDigimon]?.evolutions || [];
    const hasJogress = evolutions.some((e) => e.jogress);
    if (!hasJogress) {
      alert("현재 디지몬은 조그레스 진화가 불가능합니다.");
      return null;
    }
    try {
      const hostTamerName = tamerName || currentUser.displayName || null;
      const roomsRef = collection(db, "jogress_rooms");
      const docRef = await addDoc(roomsRef, {
        hostUid: currentUser.uid,
        hostSlotId: slotId,
        hostDigimonId: selectedDigimon,
        hostSlotVersion: version || "Ver.1",
        hostTamerName,
        hostDigimonNickname: (digimonNickname && digimonNickname.trim()) ? digimonNickname.trim() : null,
        status: "waiting",
        createdAt: serverTimestamp(),
      });
      const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
      await updateDoc(slotRef, {
        jogressStatus: { isWaiting: true, roomId: docRef.id },
        updatedAt: serverTimestamp(),
      });
      return { roomId: docRef.id };
    } catch (err) {
      console.error("[createJogressRoom] 오류:", err);
      alert("방 생성 중 오류가 발생했습니다.");
      return null;
    }
  }

  /**
   * 조그레스 방 생성 (지정 슬롯으로, 모달에서 슬롯 선택 시)
   * @param {Object} slot - { id, selectedDigimon, version, ... }
   * @returns {Promise<{ roomId: string }|null>}
   */
  async function createJogressRoomForSlot(slot) {
    if (!currentUser?.uid || !db || !slot?.id) {
      alert("조그레스에는 로그인이 필요합니다.");
      return null;
    }
    const digimonId = slot.selectedDigimon;
    const slotVersion = slot.version || "Ver.1";
    if (!isOnlineJogressSupported(slotVersion)) {
      alert("Ver.3~Ver.5 온라인 조그레스는 아직 준비 중입니다. 로컬 조그레스를 이용해 주세요.");
      return null;
    }
    // 선택한 슬롯 버전 기준 진화 데이터 사용 (현재 플레이 슬롯이 아님)
    const dataMap = getDigimonDataMapByVersion(slotVersion);
    const evolutions = dataMap[digimonId]?.evolutions || [];
    const hasJogress = evolutions.some((e) => e.jogress);
    if (!hasJogress) {
      alert("선택한 디지몬은 조그레스 진화가 불가능합니다.");
      return null;
    }
    try {
      const hostTamerName = tamerName || currentUser.displayName || null;
      const roomsRef = collection(db, "jogress_rooms");
      const docRef = await addDoc(roomsRef, {
        hostUid: currentUser.uid,
        hostSlotId: slot.id,
        hostDigimonId: digimonId,
        hostSlotVersion: slotVersion,
        hostTamerName,
        hostDigimonNickname: (slot.digimonNickname && slot.digimonNickname.trim()) ? slot.digimonNickname.trim() : null,
        status: "waiting",
        createdAt: serverTimestamp(),
      });
      const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slot.id}`);
      await updateDoc(slotRef, {
        jogressStatus: { isWaiting: true, roomId: docRef.id },
        updatedAt: serverTimestamp(),
      });
      return { roomId: docRef.id };
    } catch (err) {
      console.error("[createJogressRoomForSlot] 오류:", err);
      alert("방 생성 중 오류가 발생했습니다.");
      return null;
    }
  }

  /**
   * 조그레스 방 취소 (호스트) — 해당 방의 hostSlotId 슬롯 jogressStatus 초기화
   * @param {string} roomId
   */
  async function cancelJogressRoom(roomId) {
    if (!currentUser?.uid || !roomId || !db) return;
    try {
      const roomRef = doc(db, "jogress_rooms", roomId);
      const roomSnap = await getDoc(roomRef);
      const data = roomSnap.exists() ? roomSnap.data() : {};
      if (data.hostUid !== currentUser.uid || data.status !== "waiting") {
        alert("취소할 수 있는 방이 없습니다.");
        return;
      }
      const hostSlotId = data.hostSlotId;
      await updateDoc(roomRef, { status: "cancelled", updatedAt: serverTimestamp() });
      if (hostSlotId != null) {
        const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${hostSlotId}`);
        await updateDoc(slotRef, { jogressStatus: {}, updatedAt: serverTimestamp() });
      }
    } catch (err) {
      console.error("[cancelJogressRoom] 오류:", err);
      alert("방 취소 중 오류가 발생했습니다.");
    }
  }

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
    const minWeight = newDigimonData.stats?.minWeight ?? newDigimonData.minWeight ?? 0;
    const maxEnergy = newDigimonData.stats?.maxEnergy ?? newDigimonData.stats?.maxStamina ?? newDigimonData.maxEnergy ?? newDigimonData.maxStamina ?? 0;
    const guestStats = guestSlot.digimonStats || {};
    const resetStats = {
      ...guestStats,
      careMistakes: 0,
      overfeeds: 0,
      proteinOverdose: 0,
      trainings: 0,
      sleepDisturbances: 0,
      strength: 0,
      effort: 0,
      energy: maxEnergy,
      weight: minWeight,
      battles: 0,
      battlesWon: 0,
      battlesLost: 0,
      winRate: 0,
    };
    const nx = initializeStats(guestTargetId, resetStats, guestMap);
    if (newDigimonData?.sprite !== undefined) nx.sprite = newDigimonData.sprite;
    const resultName = newDigimonData.name || guestTargetId;
    const existingLogs = Array.isArray(guestStats.activityLogs) ? guestStats.activityLogs : [];
    const updatedLogs = addActivityLog(
      existingLogs,
      "EVOLUTION",
      `조그레스 진화(온라인): ${resultName}!`,
      buildDigimonLogSnapshot(guestTargetId, guestMap, digimonDataVer1, newDigimonDataVer1)
    );
    const nxWithLogs = { ...nx, activityLogs: updatedLogs, selectedDigimon: guestTargetId };
    const statsForDb = sanitizeDigimonStatsForSlotDocument(nxWithLogs);
    const nowMs = Date.now();

    try {
      const roomRef = doc(db, "jogress_rooms", room.id);
      const guestSlotRef = doc(db, "users", currentUser.uid, "slots", `slot${guestSlot.id}`);
      const batch = writeBatch(db);
      batch.update(roomRef, {
        status: "paired",
        guestUid: currentUser.uid,
        guestTamerName: tamerName || currentUser?.displayName || null,
        guestSlotId: guestSlot.id,
        guestDigimonId: guestSlot.selectedDigimon,
        guestDigimonNickname: (guestSlot.digimonNickname && guestSlot.digimonNickname.trim()) ? guestSlot.digimonNickname.trim() : null,
        guestSlotVersion: guestVersion,
        targetId: hostTargetId,
        updatedAt: serverTimestamp(),
      });
      batch.update(guestSlotRef, {
        selectedDigimon: guestTargetId,
        digimonStats: statsForDb,
        lastSavedAt: nowMs,
        lastSavedAtServer: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();

      // 참가한 슬롯이 현재 화면의 슬롯이면 로컬 상태를 즉시 반영 (새로고침 없이 진화 결과 표시)
      const isCurrentSlot = slotId != null && String(guestSlot.id) === String(slotId);
      if (isCurrentSlot && setDigimonStatsAndSave && setSelectedDigimonAndSave) {
        await setDigimonStatsAndSave(nxWithLogs, updatedLogs).catch(() => {});
        await setSelectedDigimonAndSave(guestTargetId).catch(() => {});
      }

      // 진화한 슬롯이 '내 조그레스 등록'에 있으면 해당 방 취소 (등록 목록에서 제거)
      try {
        const myRoomsRef = collection(db, "jogress_rooms");
        let myRoomsDocs = [];
        try {
          const q = query(myRoomsRef, where("hostUid", "==", currentUser.uid), where("status", "==", "waiting"));
          const snap = await getDocs(q);
          myRoomsDocs = snap.docs;
        } catch (idxErr) {
          const all = await getDocs(query(myRoomsRef, where("status", "==", "waiting"), limit(50)));
          myRoomsDocs = all.docs.filter((d) => d.data().hostUid === currentUser.uid);
        }
        const guestSlotIdNum = typeof guestSlot.id === "number" ? guestSlot.id : parseInt(guestSlot.id, 10);
        for (const d of myRoomsDocs) {
          const data = d.data();
          if (data.hostSlotId === guestSlot.id || data.hostSlotId === guestSlotIdNum) {
            await cancelJogressRoom(d.id);
          }
        }
      } catch (cancelErr) {
        console.warn("[proceedJogressOnlineAsGuest] 내 등록 방 취소 시 오류(무시):", cancelErr);
      }

      alert(`조그레스 진화 완료! ${resultName}(으)로 진화했습니다.`);
    } catch (err) {
      console.error("[proceedJogressOnlineAsGuest] 오류:", err);
      alert("참가 처리 중 오류가 발생했습니다.");
    }
  }

  /**
   * 호스트: room이 paired일 때 내 슬롯에 canEvolve 반영 (호스트 클라이언트에서 room 구독 후 호출)
   * @param {Object} roomData - room 문서 데이터 (status paired, targetId, guestUid 등)
   * @param {string} roomId
   */
  async function applyHostJogressStatusFromRoom(roomData, roomId) {
    if (
      !isOnlineJogressSupported(roomData?.hostSlotVersion) ||
      !isOnlineJogressSupported(roomData?.guestSlotVersion)
    ) {
      return;
    }
    if (!currentUser?.uid || roomData?.hostUid !== currentUser.uid || roomData?.status !== "paired" || !db) return;
    const hostSlotId = roomData.hostSlotId;
    if (hostSlotId == null) return;
    const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${hostSlotId}`);
    const v1Map = evolutionDataVer1 ?? newDigimonDataVer1;
    const guestDigimonName = getDigimonDisplayName(
      [roomData.guestSlotVersion === "Ver.2" ? digimonDataVer2 : v1Map, digimonDataVer1, digimonDataVer2],
      roomData.guestDigimonId
    );
    await updateDoc(slotRef, {
      jogressStatus: {
        canEvolve: true,
        roomId,
        targetId: roomData.targetId,
        partnerUserId: roomData.guestUid || null,
        partnerSlotId: roomData.guestSlotId ?? null,
        guestTamerName: roomData.guestTamerName || null,
        guestDigimonId: roomData.guestDigimonId || null,
        guestDigimonName: guestDigimonName || roomData.guestDigimonId || null,
      },
      updatedAt: serverTimestamp(),
    });
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
      const newDigimonData = hostMap[targetId] || {};
      const minWeight = newDigimonData.stats?.minWeight ?? newDigimonData.minWeight ?? 0;
      const maxEnergy = newDigimonData.stats?.maxEnergy ?? newDigimonData.stats?.maxStamina ?? newDigimonData.maxEnergy ?? newDigimonData.maxStamina ?? 0;
      const resetStats = {
        ...old,
        careMistakes: 0,
        overfeeds: 0,
        proteinOverdose: 0,
        trainings: 0,
        sleepDisturbances: 0,
        strength: 0,
        effort: 0,
        energy: maxEnergy,
        weight: minWeight,
        battles: 0,
        battlesWon: 0,
        battlesLost: 0,
        winRate: 0,
      };
      const nx = initializeStats(targetId, resetStats, hostMap);
      if (newDigimonData?.sprite !== undefined) nx.sprite = newDigimonData.sprite;
      const newDigimonName = newDigimonData.name || targetId;
      const existingLogs = currentStats.activityLogs || activityLogs || [];
      const updatedLogs = addActivityLog(
        existingLogs,
        "EVOLUTION",
        `조그레스 진화(온라인): ${newDigimonName}!`,
        buildDigimonLogSnapshot(targetId, hostMap, digimonDataVer1, newDigimonDataVer1)
      );
      const nxWithLogs = { ...nx, activityLogs: updatedLogs, selectedDigimon: targetId };
      const nowMs = Date.now();
      const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
      const statsForDb = sanitizeDigimonStatsForSlotDocument(nxWithLogs);
      await updateDoc(slotRef, {
        selectedDigimon: targetId,
        digimonStats: statsForDb,
        jogressStatus: {},
        lastSavedAt: nowMs,
        lastSavedAtServer: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(roomRef, {
        status: "completed",
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setDigimonStats(nxWithLogs);
      setSelectedDigimon(targetId);
      if (appendLogToSubcollection && updatedLogs[updatedLogs.length - 1]) {
        await appendLogToSubcollection(updatedLogs[updatedLogs.length - 1]).catch(() => {});
      }
      if (selectedDigimon) await updateEncyclopedia(selectedDigimon, old, "evolution", currentUser, version);
      if (targetId && !isStarterDigimonId(targetId)) {
        await updateEncyclopedia(targetId, nxWithLogs, "discovery", currentUser, version);
      }
      const hostDisplayName = getDigimonDisplayName([hostMap, digimonDataVer1, digimonDataVer2], selectedDigimon);
      const guestDigimonName = getDigimonDisplayName(
        [roomData.guestSlotVersion === "Ver.2" ? digimonDataVer2 : digimonDataVer1, digimonDataVer1, digimonDataVer2],
        roomData.guestDigimonId
      );
      const resultDisplayName = getDigimonDisplayName([digimonDataVer1, digimonDataVer2], targetId) || newDigimonName;
      const hostSlotLabel = slotName || `슬롯${slotId}`;
      const guestSlotLabel = roomData.guestSlotId != null ? `슬롯${roomData.guestSlotId}` : "";
      const guestTamerName = roomData.guestTamerName || "참가자";
      const jogressSummary = {
        currentLabel: `${hostDisplayName}(${hostSlotLabel})`,
        partnerLabel: `${guestDigimonName}(${guestSlotLabel})`,
        partnerTamerName: guestTamerName,
        partnerDigimonName: guestDigimonName,
        resultName: resultDisplayName,
      };
      if (setEvolutionCompleteJogressSummary) setEvolutionCompleteJogressSummary(jogressSummary);
      const tamerDisplay = tamerName || currentUser?.displayName || null;
      await persistJogressLogWithArchive({
        currentUser,
        warningLabel: "[proceedJogressOnlineAsHost]",
        archivePayload: {
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
          payload: {
            mode: "online-host",
            resultName: resultDisplayName,
            hostSlotLabel,
            guestSlotLabel,
            roomId: roomData.id || null,
          },
        },
      });
      if (setEvolutionCompleteIsJogress) setEvolutionCompleteIsJogress(true);
      if (setEvolvedDigimonName) setEvolvedDigimonName(resultDisplayName);
      if (setEvolutionStage) setEvolutionStage("complete");
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
      const newDigimonData = hostMap[targetId] || {};
      const minWeight = newDigimonData.stats?.minWeight ?? newDigimonData.minWeight ?? 0;
      const maxEnergy = newDigimonData.stats?.maxEnergy ?? newDigimonData.stats?.maxStamina ?? newDigimonData.maxEnergy ?? newDigimonData.maxStamina ?? 0;
      const resetStats = {
        ...old,
        careMistakes: 0,
        overfeeds: 0,
        proteinOverdose: 0,
        trainings: 0,
        sleepDisturbances: 0,
        strength: 0,
        effort: 0,
        energy: maxEnergy,
        weight: minWeight,
        battles: 0,
        battlesWon: 0,
        battlesLost: 0,
        winRate: 0,
      };
      const nx = initializeStats(targetId, resetStats, hostMap);
      if (newDigimonData?.sprite !== undefined) nx.sprite = newDigimonData.sprite;
      const newDigimonName = newDigimonData.name || targetId;
      const existingLogs = Array.isArray(currentStats.activityLogs) ? currentStats.activityLogs : [];
      const updatedLogs = addActivityLog(
        existingLogs,
        "EVOLUTION",
        `조그레스 진화(온라인): ${newDigimonName}!`,
        buildDigimonLogSnapshot(targetId, hostMap, digimonDataVer1, newDigimonDataVer1)
      );
      const nxWithLogs = { ...nx, activityLogs: updatedLogs, selectedDigimon: targetId };
      const statsForDb = sanitizeDigimonStatsForSlotDocument(nxWithLogs);
      const nowMs = Date.now();
      await updateDoc(slotRef, {
        selectedDigimon: targetId,
        digimonStats: statsForDb,
        jogressStatus: {},
        lastSavedAt: nowMs,
        lastSavedAtServer: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(roomRef, {
        status: "completed",
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const hostVersion = room.hostSlotVersion || "Ver.1";
      const prevDigimon = slotData.selectedDigimon;
      if (prevDigimon) await updateEncyclopedia(prevDigimon, old, "evolution", currentUser, hostVersion).catch(() => {});
      if (targetId && !isStarterDigimonId(targetId)) {
        await updateEncyclopedia(targetId, nxWithLogs, "discovery", currentUser, hostVersion).catch(() => {});
      }
      const guestDigimonName = getDigimonDisplayName(
        [room.guestSlotVersion === "Ver.2" ? digimonDataVer2 : v1Map, digimonDataVer1, digimonDataVer2],
        room.guestDigimonId
      );
      const resultDisplayName = getDigimonDisplayName([digimonDataVer1, digimonDataVer2], targetId) || newDigimonName;
      const isCurrentSlot = slotId != null && String(hostSlotId) === String(slotId);
      if (appendLogToSubcollection && isCurrentSlot && updatedLogs[updatedLogs.length - 1]) {
        await appendLogToSubcollection(updatedLogs[updatedLogs.length - 1]).catch(() => {});
      }
      await persistJogressLogWithArchive({
        currentUser,
        warningLabel: "[proceedJogressOnlineAsHostForRoom]",
        archivePayload: {
          hostUid: currentUser.uid,
          hostTamerName: tamerName || currentUser?.displayName || null,
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
          payload: {
            mode: "online-room",
            resultName: resultDisplayName,
            roomId: room.id,
          },
        },
      });
      if (isCurrentSlot && setDigimonStatsAndSave && setSelectedDigimonAndSave) {
        await setDigimonStatsAndSave(nxWithLogs, updatedLogs).catch(() => {});
        await setSelectedDigimonAndSave(targetId).catch(() => {});
      } else if (isCurrentSlot) {
        setDigimonStats(nxWithLogs);
        setSelectedDigimon(targetId);
      }
      if (setEvolutionCompleteIsJogress) setEvolutionCompleteIsJogress(true);
      if (setEvolvedDigimonName) setEvolvedDigimonName(resultDisplayName);
      if (setEvolutionStage) setEvolutionStage("complete");
      if (toggleModal) toggleModal("jogressRoomList", false);
      alert(`조그레스 진화 완료! ${resultDisplayName}(으)로 진화했습니다.`);
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
