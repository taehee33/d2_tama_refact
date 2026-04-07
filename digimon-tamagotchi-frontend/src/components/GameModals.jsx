// src/components/GameModals.jsx
// Game.jsx의 모든 모달 렌더링 로직을 분리한 컴포넌트

import React from "react";
import StatsPopup from "./StatsPopup";
import FeedPopup from "./FeedPopup";
import SettingsModal from "./SettingsModal";
import TrainPopup from "./TrainPopup";
import BattleSelectionModal from "./BattleSelectionModal";
import BattleScreen from "./BattleScreen";
import QuestSelectionModal from "./QuestSelectionModal";
import CommunicationModal from "./CommunicationModal";
import SparringModal from "./SparringModal";
import ArenaScreen from "./ArenaScreen";
import AdminModal from "./AdminModal";
import DeathPopup from "./DeathPopup";
import DigimonInfoModal from "./DigimonInfoModal";
import HealModal from "./HealModal";
import DigimonStatusDetailModal from "./DigimonStatusDetailModal";
import OverfeedConfirmModal from "./OverfeedConfirmModal";
import InteractionModal from "./InteractionModal";
import DietModal from "./DietModal";
import RestModal from "./RestModal";
import DetoxModal from "./DetoxModal";
import PlayOrSnackModal from "./PlayOrSnackModal";
import TeaseModal from "./TeaseModal";
import LightsModal from "./LightsModal";
import ExtraMenuModal from "./ExtraMenuModal";
import BattleLogModal from "./BattleLogModal";
import CollectionModal from "./CollectionModal";
import BackgroundSettingsModal from "./BackgroundSettingsModal";
import ActivityLogModal from "./ActivityLogModal";
import EncyclopediaModal from "./EncyclopediaModal";
import FridgeModal from "./FridgeModal";
import EvolutionConfirmModal from "./EvolutionConfirmModal";
import EvolutionGuideModal from "./EvolutionGuideModal";
import JogressModeSelectModal from "./JogressModeSelectModal";
import JogressPartnerSlotModal from "./JogressPartnerSlotModal";
import JogressOnlineSelectModal from "./JogressOnlineSelectModal";
import JogressRoomListModal from "./JogressRoomListModal";
import { MAX_ACTIVITY_LOGS } from "../constants/activityLogs";
import { addActivityLog, hasDuplicateSleepDisturbanceLog, createSleepDisturbanceLog } from "../hooks/useGameLogic";
import { getSleepSchedule, isWithinSleepSchedule } from "../hooks/useGameHandlers";
import { checkEvolution } from "../logic/evolution/checker";
import { appendCareMistakeEntry, resolveLatestCareMistakeEntry } from "../logic/stats/careMistakeLedger";

/**
 * GameModals 컴포넌트
 * Game.jsx의 모든 모달 렌더링을 담당하는 컴포넌트
 * 
 * @param {Object} props
 * @param {Object} props.modals - 모달 상태 객체
 * @param {Function} props.toggleModal - 모달 토글 함수
 * @param {Object} props.gameState - 게임 상태 (stats, selectedDigimon, 등)
 * @param {Object} props.handlers - 모든 핸들러 함수들
 * @param {Object} props.data - 기타 필요한 데이터 (digimonData, quests, 등)
 * @param {Object} props.ui - UI 상태 (width, height, 등)
 * @param {Object} props.flags - 플래그 상태 (developerMode, 등)
 */
export default function GameModals({
  modals,
  toggleModal,
  gameState,
  handlers,
  data,
  ui,
  flags,
}) {
  // 필수 props가 없으면 렌더링하지 않음
  if (!modals || !toggleModal || !gameState || !handlers || !data || !ui || !flags) {
    console.warn('GameModals: 필수 props가 누락되었습니다.', { modals, toggleModal, gameState, handlers, data, ui, flags });
    return null;
  }

  const {
    digimonStats,
    selectedDigimon,
    slotId,
    slotName,
    slotVersion,
    digimonNickname,
    currentQuestArea,
    currentQuestRound,
    currentQuestVersion,
    clearedQuestIndex,
    battleType,
    sparringEnemySlot,
    arenaChallenger,
    currentSeasonId,
    activityLogs,
    deathReason,
    isLightsOn,
  } = gameState || {};
  
  // 수면방해 처리 함수
  // 반환값: { updatedStats, updatedLogs, sleepDisturbed: boolean }
  const handleSleepDisturbance = (updatedStats, updatedLogs, actionType) => {
    const schedule = getSleepSchedule(selectedDigimon, digimonDataVer1, updatedStats);
    const nowSleeping = isWithinSleepSchedule(schedule, new Date()) && !(wakeUntil && Date.now() < wakeUntil);
    
    if (nowSleeping && setWakeUntil && setDigimonStatsAndSave) {
      // 동일 강제 기상 창 내 수면 방해 로그가 있으면 중복 추가·증가 방지
      if (hasDuplicateSleepDisturbanceLog(updatedLogs || [], Date.now())) {
        return { updatedStats, updatedLogs, sleepDisturbed: false };
      }
      const until = Date.now() + 10 * 60 * 1000; // 10분
      setWakeUntil(until);
      
      // 수면방해 로그 추가
      const sleepDisturbanceLog = createSleepDisturbanceLog(`교감 - ${actionType}`);
      const logsWithDisturbance = [sleepDisturbanceLog, ...updatedLogs].slice(0, MAX_ACTIVITY_LOGS);
      
      const statsWithDisturbance = {
        ...updatedStats,
        wakeUntil: until,
        sleepDisturbances: (updatedStats.sleepDisturbances || 0) + 1,
        activityLogs: logsWithDisturbance,
      };
      if (appendLogToSubcollection) appendLogToSubcollection(sleepDisturbanceLog).catch(() => {});
      setDigimonStatsAndSave(statsWithDisturbance, logsWithDisturbance);
      return {
        updatedStats: statsWithDisturbance,
        updatedLogs: logsWithDisturbance,
        sleepDisturbed: true,
      };
    }
    return {
      updatedStats,
      updatedLogs,
      sleepDisturbed: false,
    };
  };

  const {
    handleFeed,
    handleTrainResult,
    handleBattleComplete,
    handleQuestStart,
    handleCommunicationStart,
    handleSparringStart,
    handleArenaStart,
    handleArenaBattleStart,
    handleSparringSlotSelect,
    handleSelectArea,
    handleQuestComplete,
    handleAdminConfigUpdated,
    startHealCycle,
    handleDeathConfirm,
    resetDigimon,
    setDigimonStatsAndSave,
    setSelectedDigimonAndSave,
    setCurrentQuestArea,
    setCurrentQuestRound,
    setBattleType,
    setSparringEnemySlot,
    setArenaChallenger,
    setArenaEnemyId,
    setMyArenaEntryId,
    handleToggleLights,
    appendLogToSubcollection,
  } = handlers || {};

  const {
    newDigimonDataVer1,
    digimonDataVer1,
    digimonDataVer2,
    quests,
    questsVer2,
    seasonName,
    seasonDuration,
    initializeStats,
  } = data || {};

  const {
    width,
    height,
    backgroundNumber,
    timeSpeed,
    customTime,
    foodSizeScale,
    evolutionStage,
    evolvedDigimonName,
    evolutionCompleteIsJogress,
    evolutionCompleteJogressSummary,
    setEvolutionStage,
    setEvolvedDigimonName,
    setEvolutionCompleteIsJogress,
    setEvolutionCompleteJogressSummary,
    myJogressRoomId,
    setMyJogressRoomId,
    jogressRoomListRefresh,
    setJogressRoomListRefresh,
    setWidth,
    setHeight,
    setBackgroundNumber,
    setTimeSpeed,
    setCustomTime,
    setFoodSizeScale,
    wakeUntil,
    setWakeUntil,
  } = ui || {};

  const { developerMode, setDeveloperMode, encyclopediaShowQuestionMark, setEncyclopediaShowQuestionMark, ignoreEvolutionTime, setIgnoreEvolutionTime, setIsEvolving } = flags || {};
  const ignoreAllEvolutionConditions = !!ignoreEvolutionTime;

  // selectedDigimon 또는 evolutionStage로 디지몬 데이터 찾기
  const getCurrentDigimonData = () => {
    if (!newDigimonDataVer1 || !digimonStats) return {};
    const digimonKey = selectedDigimon || 
      (digimonStats.evolutionStage ? 
        Object.keys(newDigimonDataVer1).find(key => 
          newDigimonDataVer1[key]?.stage === digimonStats.evolutionStage
        ) : 
        "Digitama"
      );
    return newDigimonDataVer1[digimonKey] || {};
  };

  const currentDigimonData = getCurrentDigimonData();
  const currentDigimonKey = selectedDigimon || 
    (digimonStats?.evolutionStage ? 
      Object.keys(newDigimonDataVer1 || {}).find(key => 
        newDigimonDataVer1[key]?.stage === digimonStats.evolutionStage
      ) : 
      "Digitama"
    ) || "Digitama";

  return (
    <>
      {/* Death Modal */}
      {modals?.deathModal && (
        <DeathPopup
          isOpen={modals.deathModal}
          onConfirm={handleDeathConfirm || (() => {})}
          onClose={() => toggleModal?.('deathModal', false) || (() => {})}
          reason={deathReason}
          selectedDigimon={selectedDigimon}
          onNewStart={resetDigimon || (() => {})}
          digimonStats={gameState?.digimonStats || {}}
        />
      )}

      {/* Stats Popup - 이력: activityLogs(틱 즉시 반영) 우선, 없으면 digimonStats.activityLogs (새로고침 없이 부상/케어미스 이력 표시) */}
      {modals?.stats && (
        <StatsPopup
          stats={digimonStats}
          activityLogs={activityLogs}
          digimonData={currentDigimonData}
          digimonDataMap={newDigimonDataVer1}
          selectedDigimonId={selectedDigimon}
          slotVersion={slotVersion || "Ver.1"}
          onClose={() => toggleModal?.('stats', false) || (() => {})}
          devMode={developerMode}
          onChangeStats={(ns) => setDigimonStatsAndSave?.(ns) || (() => {})}
          sleepSchedule={ui?.sleepSchedule || null}
          sleepStatus={ui?.sleepStatus || "AWAKE"}
          wakeUntil={ui?.wakeUntil || null}
          sleepLightOnStart={ui?.sleepLightOnStart || null}
          isLightsOn={gameState?.isLightsOn || false}
          appendLogToSubcollection={appendLogToSubcollection}
        />
      )}

      {/* Feed Modal */}
      {modals.feed && (
        <FeedPopup
          onClose={() => toggleModal('feed', false)}
          onSelect={(foodType) => {
            toggleModal?.('feed', false);
            handleFeed?.(foodType);
          }}
        />
      )}

      {/* Settings Modal */}
      {modals.settings && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <SettingsModal
            onClose={() => toggleModal('settings', false)}
            developerMode={developerMode}
            setDeveloperMode={setDeveloperMode || (() => {})}
            encyclopediaShowQuestionMark={encyclopediaShowQuestionMark}
            setEncyclopediaShowQuestionMark={setEncyclopediaShowQuestionMark || (() => {})}
            ignoreEvolutionTime={ignoreEvolutionTime}
            setIgnoreEvolutionTime={setIgnoreEvolutionTime || (() => {})}
            width={width}
            height={height}
            setWidth={setWidth}
            setHeight={setHeight}
            backgroundNumber={backgroundNumber}
            setBackgroundNumber={setBackgroundNumber}
            timeSpeed={timeSpeed}
            setTimeSpeed={setTimeSpeed}
            customTime={customTime}
            setCustomTime={setCustomTime}
            foodSizeScale={foodSizeScale}
            setFoodSizeScale={setFoodSizeScale}
            newDigimonDataVer1={newDigimonDataVer1}
            digimonDataVer1={digimonDataVer1}
            digimonDataVer2={digimonDataVer2}
            initializeStats={initializeStats}
            setDigimonStatsAndSave={setDigimonStatsAndSave}
            setSelectedDigimonAndSave={setSelectedDigimonAndSave}
            selectedDigimon={selectedDigimon}
            digimonStats={digimonStats}
            slotVersion={slotVersion}
          />
        </div>
      )}

      {/* Train Modal */}
      {modals.train && (
        <TrainPopup
          onClose={() => toggleModal('train', false)}
          digimonStats={digimonStats}
          setDigimonStatsAndSave={setDigimonStatsAndSave}
          onTrainResult={handleTrainResult}
        />
      )}

      {/* Battle Selection Modal */}
      {modals.battleSelection && (
        <BattleSelectionModal
          onClose={() => toggleModal('battleSelection', false)}
          onQuestStart={handleQuestStart}
          onCommunicationStart={handleCommunicationStart}
          onOpenBattleLog={() => {
            toggleModal('battleSelection', false);
            toggleModal('battleLog', true);
          }}
        />
      )}

      {/* Communication Modal */}
      {modals.communication && (
        <CommunicationModal
          onClose={() => toggleModal('communication', false)}
          onSparringStart={handleSparringStart}
          onArenaStart={handleArenaStart}
        />
      )}

      {/* Interaction Modal (교감) */}
      {modals.interaction && (
        <InteractionModal
          onClose={() => toggleModal('interaction', false)}
          onDiet={() => {
            toggleModal('interaction', false);
            toggleModal('diet', true);
          }}
          onRest={() => {
            toggleModal('interaction', false);
            toggleModal('rest', true);
          }}
          onDetox={() => {
            toggleModal('interaction', false);
            toggleModal('detox', true);
          }}
          onPlayOrSnack={() => {
            toggleModal('interaction', false);
            toggleModal('playOrSnack', true);
          }}
          onTease={() => {
            toggleModal('interaction', false);
            toggleModal('tease', true);
          }}
        />
      )}

      {/* Diet Modal (다이어트) */}
      {modals.diet && (
        <DietModal
          onClose={() => toggleModal('diet', false)}
          currentFullness={digimonStats?.fullness || 0}
          onComplete={async (result) => {
            if (result === "success") {
              // 성공 시 포만감 -1 (최소 0)
              const currentStats = digimonStats || {};
              const newFullness = Math.max(0, (currentStats.fullness || 0) - 1);
              
              let updatedStats = {
                ...currentStats,
                fullness: newFullness,
              };
              
              // Activity Log 추가
              const currentLogs = currentStats.activityLogs || activityLogs || [];
              const updatedLogs = addActivityLog(
                currentLogs,
                "DIET",
                `다이어트 성공! 포만감: ${currentStats.fullness || 0} → ${newFullness}`
              );
              if (appendLogToSubcollection) appendLogToSubcollection(updatedLogs[updatedLogs.length - 1]).catch(() => {});
              const sleepResult = handleSleepDisturbance(updatedStats, updatedLogs, "다이어트");
              
              // 수면방해가 발생하지 않았을 때만 저장 (수면방해 발생 시 handleSleepDisturbance에서 이미 저장됨)
              if (!sleepResult.sleepDisturbed && setDigimonStatsAndSave) {
                await setDigimonStatsAndSave(sleepResult.updatedStats, sleepResult.updatedLogs);
              }
            }
          }}
        />
      )}

      {/* Rest Modal (누워있기) */}
      {modals.rest && (
        <RestModal
          onClose={() => toggleModal('rest', false)}
          currentStrength={digimonStats?.strength || 0}
          onComplete={async (result) => {
            if (result === "success") {
              // 성공 시 Strength -1 (최소 0)
              const currentStats = digimonStats || {};
              const newStrength = Math.max(0, (currentStats.strength || 0) - 1);
              
              let updatedStats = {
                ...currentStats,
                strength: newStrength,
              };
              
              // Activity Log 추가
              const currentLogs = currentStats.activityLogs || activityLogs || [];
              const updatedLogs = addActivityLog(
                currentLogs,
                "REST",
                `누워있기 성공! Strength: ${currentStats.strength || 0} → ${newStrength}`
              );
              if (appendLogToSubcollection) appendLogToSubcollection(updatedLogs[updatedLogs.length - 1]).catch(() => {});
              const sleepResult = handleSleepDisturbance(updatedStats, updatedLogs, "누워있기");
              
              // 수면방해가 발생하지 않았을 때만 저장 (수면방해 발생 시 handleSleepDisturbance에서 이미 저장됨)
              if (!sleepResult.sleepDisturbed && setDigimonStatsAndSave) {
                await setDigimonStatsAndSave(sleepResult.updatedStats, sleepResult.updatedLogs);
              }
            }
          }}
        />
      )}

      {/* Detox Modal (디톡스) */}
      {modals.detox && (
        <DetoxModal
          onClose={() => toggleModal('detox', false)}
          currentProteinOverdose={digimonStats?.proteinOverdose || 0}
          onComplete={async (result) => {
            if (result === "success") {
              // 성공 시 Protein Overdose -1 (최소 0)
              const currentStats = digimonStats || {};
              const newProteinOverdose = Math.max(0, (currentStats.proteinOverdose || 0) - 1);
              
              let updatedStats = {
                ...currentStats,
                proteinOverdose: newProteinOverdose,
              };
              
              // Activity Log 추가
              const currentLogs = currentStats.activityLogs || activityLogs || [];
              const updatedLogs = addActivityLog(
                currentLogs,
                "DETOX",
                `디톡스 성공! Protein Overdose: ${currentStats.proteinOverdose || 0} → ${newProteinOverdose}`
              );
              if (appendLogToSubcollection) appendLogToSubcollection(updatedLogs[updatedLogs.length - 1]).catch(() => {});
              const sleepResult = handleSleepDisturbance(updatedStats, updatedLogs, "디톡스");
              
              // 수면방해가 발생하지 않았을 때만 저장 (수면방해 발생 시 handleSleepDisturbance에서 이미 저장됨)
              if (!sleepResult.sleepDisturbed && setDigimonStatsAndSave) {
                await setDigimonStatsAndSave(sleepResult.updatedStats, sleepResult.updatedLogs);
              }
            }
          }}
        />
      )}

      {/* Play Or Snack Modal (놀아주기/간식주기) */}
      {modals.playOrSnack && (
        <PlayOrSnackModal
          onClose={() => toggleModal('playOrSnack', false)}
          currentCareMistakes={digimonStats?.careMistakes || 0}
          onComplete={async (result) => {
            if (result === "success") {
              const currentStats = digimonStats || {};
              const resolvedAt = Date.now();
              const resolutionResult = resolveLatestCareMistakeEntry(currentStats, {
                resolvedAt,
                resolvedBy: "play_or_snack",
              });
              const updatedStats = resolutionResult.nextStats;
              const newCareMistakes = updatedStats.careMistakes || 0;
              
              // Activity Log 추가
              const currentLogs = currentStats.activityLogs || activityLogs || [];
              const updatedLogs = addActivityLog(
                currentLogs,
                "PLAY_OR_SNACK",
                `놀아주기/간식주기 성공! Care Mistakes: ${currentStats.careMistakes || 0} → ${newCareMistakes}`
              );
              if (appendLogToSubcollection) appendLogToSubcollection(updatedLogs[updatedLogs.length - 1]).catch(() => {});
              const sleepResult = handleSleepDisturbance(updatedStats, updatedLogs, "놀아주기/간식주기");
              
              // 수면방해가 발생하지 않았을 때만 저장 (수면방해 발생 시 handleSleepDisturbance에서 이미 저장됨)
              if (!sleepResult.sleepDisturbed && setDigimonStatsAndSave) {
                await setDigimonStatsAndSave(sleepResult.updatedStats, sleepResult.updatedLogs);
              }
            }
          }}
        />
      )}

      {/* Tease Modal (괜히 괴롭히기) */}
      {modals.tease && (
        <TeaseModal
          onClose={() => toggleModal('tease', false)}
          currentCareMistakes={digimonStats?.careMistakes || 0}
          onComplete={async (result) => {
            if (result === "success") {
              const currentStats = digimonStats || {};
              const occurredAt = Date.now();
              const appendResult = appendCareMistakeEntry(currentStats, {
                occurredAt,
                reasonKey: "tease",
                text: `케어미스(사유: 괜히 괴롭히기): ${currentStats.careMistakes || 0} → ${(currentStats.careMistakes || 0) + 1}`,
                source: "interaction",
              });
              const updatedStats = appendResult.nextStats;
              const newCareMistakes = updatedStats.careMistakes || 0;
              
              // Activity Log 추가
              const currentLogs = currentStats.activityLogs || activityLogs || [];
              const updatedLogs = addActivityLog(
                currentLogs,
                "CAREMISTAKE",
                `케어미스(사유: 괜히 괴롭히기): ${currentStats.careMistakes || 0} → ${newCareMistakes}`,
                occurredAt
              );
              if (appendLogToSubcollection) appendLogToSubcollection(updatedLogs[updatedLogs.length - 1]).catch(() => {});
              const sleepResult = handleSleepDisturbance(updatedStats, updatedLogs, "괜히 괴롭히기");
              
              // 수면방해가 발생하지 않았을 때만 저장 (수면방해 발생 시 handleSleepDisturbance에서 이미 저장됨)
              if (!sleepResult.sleepDisturbed && setDigimonStatsAndSave) {
                await setDigimonStatsAndSave(sleepResult.updatedStats, sleepResult.updatedLogs);
              }
            }
          }}
        />
      )}

      {/* Arena Screen */}
      {modals.arenaScreen && (
        <ArenaScreen
          onClose={() => toggleModal('arenaScreen', false)}
          onStartBattle={handleArenaBattleStart}
          currentSlotId={typeof slotId === 'number' ? slotId : (slotId ? parseInt(slotId) : null)}
          currentSeasonId={currentSeasonId}
          seasonName={seasonName}
          seasonDuration={seasonDuration}
          isDevMode={developerMode}
          onOpenAdmin={() => toggleModal('admin', true)}
          selectedDigimon={selectedDigimon}
          digimonStats={digimonStats}
          digimonNickname={digimonNickname || null}
        />
      )}

      {/* Sparring Modal */}
      {modals.sparring && (
        <SparringModal
          onClose={() => toggleModal('sparring', false)}
          onSelectSlot={handleSparringSlotSelect}
          currentSlotId={parseInt(slotId)}
        />
      )}

      {/* Quest Selection Modal */}
      {modals.questSelection && (
        <QuestSelectionModal
          quests={quests}
          questsVer2={questsVer2 || []}
          defaultVersion={slotVersion === "Ver.2" ? "Ver.2" : "Ver.1"}
          clearedQuestIndex={clearedQuestIndex}
          onSelectArea={handleSelectArea}
          onClose={() => toggleModal('questSelection', false)}
          digimonDataVer2={digimonDataVer2 || {}}
        />
      )}

      {/* Battle Screen */}
      {modals.battleScreen && (currentQuestArea || battleType === 'sparring' || battleType === 'arena') && (
        <BattleScreen
          userDigimon={newDigimonDataVer1[selectedDigimon] || {
            id: selectedDigimon,
            name: selectedDigimon,
            stats: digimonDataVer1[selectedDigimon] || {},
          }}
          userStats={digimonStats}
          userSlotName={slotName || `슬롯${slotId}`}
          userDigimonNickname={digimonNickname || null}
          areaId={currentQuestArea}
          roundIndex={currentQuestRound}
          questVersion={currentQuestVersion || "Ver.1"}
          battleType={battleType}
          sparringEnemySlot={sparringEnemySlot}
          arenaChallenger={arenaChallenger}
          onBattleComplete={handleBattleComplete}
          onQuestClear={handleQuestComplete}
          onClose={() => {
            toggleModal('battleScreen', false);
            setCurrentQuestArea(null);
            setCurrentQuestRound(0);
            
            // Arena 모드일 때는 Arena 화면으로 복귀
            if (battleType === 'arena') {
              toggleModal('arenaScreen', true);
            }
            
            setBattleType(null);
            setSparringEnemySlot(null);
            setArenaChallenger(null);
            setArenaEnemyId(null);
            setMyArenaEntryId(null);
          }}
        />
      )}

      {/* Admin Modal (Dev 모드에서만 표시) */}
      {developerMode && modals.admin && (
        <AdminModal
          onClose={() => toggleModal('admin', false)}
          currentSeasonId={currentSeasonId}
          seasonName={seasonName}
          seasonDuration={seasonDuration}
          onConfigUpdated={handleAdminConfigUpdated}
        />
      )}

      {/* Digimon Info Modal */}
      {modals.digimonInfo && (
        <DigimonInfoModal
          currentDigimonName={currentDigimonKey}
          currentDigimonData={currentDigimonData}
          currentStats={digimonStats}
          digimonDataMap={newDigimonDataVer1}
          slotVersion={slotVersion || "Ver.1"}
          digimonDataVer1={data?.jogressDigimonDataVer1 || {}}
          digimonDataVer2={data?.jogressDigimonDataVer2 || {}}
          activityLogs={activityLogs}
          onClose={() => toggleModal('digimonInfo', false)}
        />
      )}

      {/* Heal Modal */}
      {modals.heal && (
        <HealModal
          isInjured={(gameState.healModalStats || digimonStats).isInjured || false}
          currentDoses={(gameState.healModalStats || digimonStats).healedDosesCurrent || 0}
          requiredDoses={newDigimonDataVer1[selectedDigimon]?.stats?.healDoses || 1}
          onHeal={startHealCycle}
          onClose={() => {
            toggleModal('heal', false);
            // 모달 닫을 때 healModalStats 및 healTreatmentMessage 초기화
            if (gameState.setHealModalStats) {
              gameState.setHealModalStats(null);
            }
            if (gameState.setHealTreatmentMessage) {
              gameState.setHealTreatmentMessage(null);
            }
          }}
          treatmentMessage={(gameState.healModalStats?.treatmentMessage) || (gameState.healTreatmentMessage) || null}
          digimonStats={digimonStats || {}}
        />
      )}

      {/* Overfeed Confirm Modal */}
      {modals.overfeedConfirm && (
        <OverfeedConfirmModal
          onConfirm={handlers.onOverfeedConfirm}
          onCancel={handlers.onOverfeedCancel}
        />
      )}

      {/* Status Detail Modal */}
      {modals.statusDetail && (
        <DigimonStatusDetailModal
          statusMessages={ui.statusDetailMessages || []}
          onClose={() => toggleModal('statusDetail', false)}
        />
      )}

      {/* Evolution Animation Complete Message */}
      {evolutionStage === 'complete' && evolvedDigimonName && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
          <div className="bg-yellow-400 border-4 border-yellow-600 rounded-lg p-8 text-center pixel-art-modal">
            <h2 className="text-3xl font-bold text-black mb-2 pixel-art-text"> 🎉 디지몬 진화~~! 🎉</h2>
            <p className="text-2xl font-bold text-black mb-6 pixel-art-text"> 🎉 {evolvedDigimonName} 🎉 </p>
            {evolutionCompleteIsJogress && (
              <>
                <p className="text-black mb-2 pixel-art-text">조그레스 진화 완료 (with 참가자명 / 디지몬명)</p>
                {evolutionCompleteJogressSummary && typeof evolutionCompleteJogressSummary === "object" && (
                  <div className="text-black mb-6 text-sm pixel-art-text border border-black border-opacity-20 rounded px-3 py-2 bg-white bg-opacity-60 space-y-1">
                    <p><span className="font-bold">방장:</span> {evolutionCompleteJogressSummary.currentLabel} → {evolutionCompleteJogressSummary.resultName}</p>
                    <p><span className="font-bold">참가자:</span> {evolutionCompleteJogressSummary.partnerTamerName || "참가자"} / {evolutionCompleteJogressSummary.partnerDigimonName || evolutionCompleteJogressSummary.partnerLabel}</p>
                  </div>
                )}
              </>
            )}
            <button
              onClick={() => {
                setEvolutionStage('idle');
                setEvolvedDigimonName(null);
                if (setEvolutionCompleteIsJogress) setEvolutionCompleteIsJogress(false);
                if (setEvolutionCompleteJogressSummary) setEvolutionCompleteJogressSummary(null);
                setIsEvolving(false);
              }}
              className="px-6 py-3 bg-green-500 text-white font-bold rounded pixel-art-button hover:bg-green-600"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* Lights Modal (조명 제어) */}
      {modals.lights && (
        <LightsModal
          onClose={() => toggleModal('lights', false)}
          onTurnOn={() => {
            if (handleToggleLights && !isLightsOn) {
              handleToggleLights();
            }
          }}
          onTurnOff={() => {
            if (handleToggleLights && isLightsOn) {
              handleToggleLights();
            }
          }}
          isLightsOn={isLightsOn || false}
        />
      )}

      {/* Extra Menu Modal (추가 기능) */}
      {modals.extra && (
        <ExtraMenuModal
          onClose={() => toggleModal('extra', false)}
          onOpenSettings={() => toggleModal('settings', true)}
          onOpenCollection={() => toggleModal('collection', true)}
          onOpenActivityLog={() => toggleModal('activityLog', true)}
          onOpenBattleLog={() => toggleModal('battleLog', true)}
          onOpenEncyclopedia={() => toggleModal('encyclopedia', true)}
          onOpenFridge={() => toggleModal('fridge', true)}
        />
      )}

      {/* Fridge Modal (냉장고) */}
      {modals.fridge && (
        <FridgeModal
          isFrozen={digimonStats?.isFrozen || false}
          onPutIn={handlers?.putInFridge || (() => {})}
          onTakeOut={handlers?.takeOutFromFridge || (() => {})}
          onClose={() => toggleModal('fridge', false)}
        />
      )}

      {/* Encyclopedia Modal (도감) */}
      {modals.encyclopedia && (
        <EncyclopediaModal
          currentDigimonId={selectedDigimon}
          onClose={() => toggleModal('encyclopedia', false)}
          developerMode={developerMode}
          encyclopediaShowQuestionMark={encyclopediaShowQuestionMark}
        />
      )}

      {/* Activity Log Modal (활동 로그) */}
      {modals.activityLog && (
        <ActivityLogModal
          activityLogs={activityLogs || []}
          onClose={() => toggleModal('activityLog', false)}
        />
      )}

      {/* Battle Log Modal (배틀 기록) */}
      {modals.battleLog && (
        <BattleLogModal
          battleLogs={digimonStats?.battleLogs || []}
          onClose={() => toggleModal('battleLog', false)}
        />
      )}

      {/* Collection Modal (컬렉션 메인 메뉴) */}
      {modals.collection && (
        <CollectionModal
          onClose={() => toggleModal('collection', false)}
          onBack={() => {
            toggleModal('collection', false);
            toggleModal('extra', true);
          }}
          onOpenBackgroundSettings={() => {
            toggleModal('collection', false);
            toggleModal('backgroundSettings', true);
          }}
        />
      )}

      {/* Background Settings Modal (배경화면 설정) */}
      {modals.backgroundSettings && (
        <BackgroundSettingsModal
          onClose={() => toggleModal('backgroundSettings', false)}
          onBack={() => {
            toggleModal('backgroundSettings', false);
            toggleModal('collection', true);
          }}
          backgroundSettings={ui?.backgroundSettings}
          setBackgroundSettings={ui?.setBackgroundSettings}
          currentTime={ui?.customTime || new Date()}
        />
      )}

      {/* Evolution Confirm Modal (진화 확인) */}
      {modals.evolutionConfirm && (() => {
        // '모든 진화 조건 무시' 옵션 시 항상 진화 가능, 시간 미표시
        let canEvolve = true;
        let remainingTime = null;
        
        if (!ignoreAllEvolutionConditions && digimonStats && currentDigimonData && newDigimonDataVer1) {
          const evolutionResult = checkEvolution(
            digimonStats,
            currentDigimonData,
            currentDigimonKey,
            newDigimonDataVer1
          );
          canEvolve = evolutionResult.success;
          if (evolutionResult.reason === "NOT_READY" && evolutionResult.remainingTime) {
            remainingTime = evolutionResult.remainingTime;
          }
        }
        
        return (
          <EvolutionConfirmModal
            onConfirm={handlers?.proceedEvolution || (() => {})}
            onOpenGuide={() => {
              toggleModal('evolutionConfirm', false);
              toggleModal('evolutionGuide', true);
            }}
            onClose={() => toggleModal('evolutionConfirm', false)}
            canEvolve={canEvolve}
            remainingTime={ignoreAllEvolutionConditions ? null : remainingTime}
          />
        );
      })()}

      {/* Evolution Guide Modal (진화 가이드) */}
      {modals.evolutionGuide && (
        <EvolutionGuideModal
          currentDigimonName={selectedDigimon}
          currentDigimonData={getCurrentDigimonData()}
          currentStats={digimonStats}
          digimonDataMap={newDigimonDataVer1}
          slotVersion={slotVersion || "Ver.1"}
          digimonDataVer1={data?.jogressDigimonDataVer1 || {}}
          digimonDataVer2={data?.jogressDigimonDataVer2 || {}}
          onClose={() => toggleModal('evolutionGuide', false)}
        />
      )}

      {/* Jogress Mode Select Modal (조그레스: 로컬/온라인 선택) */}
      {modals.jogressModeSelect && (
        <JogressModeSelectModal
          onClose={() => toggleModal('jogressModeSelect', false)}
          onSelectLocal={() => {
            toggleModal('jogressModeSelect', false);
            toggleModal('jogressPartnerSlot', true);
          }}
          onSelectOnline={() => {
            toggleModal('jogressModeSelect', false);
            toggleModal('jogressRoomList', true);
          }}
        />
      )}

      {/* Jogress Online Select Modal (방 만들기 / 방 참가) */}
      {modals.jogressOnlineSelect && (
        <JogressOnlineSelectModal
          onClose={() => toggleModal('jogressOnlineSelect', false)}
          onCreateRoom={async () => {
            const result = await handlers?.createJogressRoom?.();
            if (result?.roomId && setMyJogressRoomId) {
              setMyJogressRoomId(result.roomId);
              alert("방이 생성되었습니다. 다른 테이머가 참가할 때까지 기다려 주세요.");
            }
          }}
          onJoinRoom={() => {
            toggleModal('jogressOnlineSelect', false);
            toggleModal('jogressRoomList', true);
          }}
        />
      )}

      {/* Jogress Room List Modal (온라인: 방 목록 + 참가할 슬롯 선택) */}
      {modals.jogressRoomList && (
        <JogressRoomListModal
          currentUser={data?.currentUser}
          currentSlotId={slotId != null ? parseInt(slotId, 10) : null}
          digimonDataVer1={data?.jogressDigimonDataVer1 || {}}
          digimonDataVer2={data?.jogressDigimonDataVer2 || {}}
          refreshTrigger={`${myJogressRoomId}-${jogressRoomListRefresh}`}
          onClose={() => toggleModal('jogressRoomList', false)}
          onSelectRoomAndSlot={(room, slot) => {
            handlers?.proceedJogressOnlineAsGuest?.(room, slot);
            toggleModal('jogressRoomList', false);
          }}
          onCreateRoom={async () => {
            const result = await handlers?.createJogressRoom?.();
            if (result?.roomId && setMyJogressRoomId) {
              setMyJogressRoomId(result.roomId);
              if (setJogressRoomListRefresh) setJogressRoomListRefresh((n) => n + 1);
              alert("방이 생성되었습니다. 다른 테이머가 참가할 때까지 기다려 주세요.");
            }
          }}
          onCreateRoomForSlot={handlers?.createJogressRoomForSlot}
          onRefresh={setJogressRoomListRefresh ? () => setJogressRoomListRefresh((n) => n + 1) : undefined}
          onCancelRoom={async (roomId) => {
            await handlers?.cancelJogressRoom?.(roomId);
            if (roomId === myJogressRoomId && setMyJogressRoomId) setMyJogressRoomId(null);
            if (setJogressRoomListRefresh) setJogressRoomListRefresh((n) => n + 1);
          }}
          onHostEvolveFromRoom={handlers?.proceedJogressOnlineAsHostForRoom}
        />
      )}

      {/* Jogress Partner Slot Modal (로컬: 파트너 슬롯 선택) */}
      {modals.jogressPartnerSlot && (
        <JogressPartnerSlotModal
          currentUser={data?.currentUser}
          currentSlotId={slotId != null ? parseInt(slotId, 10) : 0}
          currentDigimonId={selectedDigimon}
          currentSlotVersion={slotVersion || "Ver.1"}
          digimonDataVer1={data?.jogressDigimonDataVer1 || {}}
          digimonDataVer2={data?.jogressDigimonDataVer2 || {}}
          onClose={() => toggleModal('jogressPartnerSlot', false)}
          onSelectPartner={handlers?.onJogressPartnerSelected}
        />
      )}
    </>
  );
}
