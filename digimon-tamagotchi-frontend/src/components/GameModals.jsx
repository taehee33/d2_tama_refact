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
import { addActivityLog } from "../hooks/useGameLogic";

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
    currentQuestArea,
    currentQuestRound,
    clearedQuestIndex,
    battleType,
    sparringEnemySlot,
    arenaChallenger,
    currentSeasonId,
    activityLogs,
    deathReason,
  } = gameState || {};

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
  } = handlers || {};

  const {
    newDigimonDataVer1,
    digimonDataVer1,
    quests,
    seasonName,
    seasonDuration,
    ver1DigimonList,
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
    setEvolutionStage,
    setEvolvedDigimonName,
    setWidth,
    setHeight,
    setBackgroundNumber,
    setTimeSpeed,
    setCustomTime,
    setFoodSizeScale,
  } = ui || {};

  const { developerMode, setDeveloperMode, setIsEvolving, mode } = flags || {};

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

      {/* Stats Popup */}
      {modals?.stats && (
        <StatsPopup
          stats={digimonStats}
          digimonData={currentDigimonData}
          onClose={() => toggleModal?.('stats', false) || (() => {})}
          devMode={developerMode}
          onChangeStats={(ns) => setDigimonStatsAndSave?.(ns) || (() => {})}
          sleepSchedule={ui?.sleepSchedule || null}
          sleepStatus={ui?.sleepStatus || "AWAKE"}
          wakeUntil={ui?.wakeUntil || null}
          sleepLightOnStart={ui?.sleepLightOnStart || null}
          isLightsOn={gameState?.isLightsOn || false}
          callStatus={digimonStats?.callStatus || null}
        />
      )}

      {/* Feed Modal */}
      {modals.feed && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <FeedPopup
            onClose={() => toggleModal('feed', false)}
            onSelect={(foodType) => {
              toggleModal?.('feed', false);
              handleFeed?.(foodType);
            }}
          />
        </div>
      )}

      {/* Settings Modal */}
      {modals.settings && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <SettingsModal
            onClose={() => toggleModal('settings', false)}
            developerMode={developerMode}
            setDeveloperMode={setDeveloperMode || (() => {})}
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
            // TODO: 놀아주기/간식주기 기능 구현
            console.log("놀아주기/간식주기 클릭");
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
              
              const updatedStats = {
                ...currentStats,
                fullness: newFullness,
              };
              
              // Activity Log 추가
              const currentLogs = currentStats.activityLogs || activityLogs || [];
              const updatedLogs = addActivityLog(
                currentLogs,
                'DIET',
                `다이어트 성공! 포만감: ${currentStats.fullness || 0} → ${newFullness}`
              );
              
              // 스탯 저장
              if (setDigimonStatsAndSave) {
                await setDigimonStatsAndSave(updatedStats, updatedLogs);
              }
            }
          }}
        />
      )}

      {/* Rest Modal (누워있기) */}
      {modals.rest && (
        <RestModal
          onClose={() => toggleModal('rest', false)}
          currentProteinCount={digimonStats?.proteinCount || 0}
          onComplete={async (result) => {
            if (result === "success") {
              // 성공 시 Protein Count -1 (최소 0)
              const currentStats = digimonStats || {};
              const newProteinCount = Math.max(0, (currentStats.proteinCount || 0) - 1);
              
              const updatedStats = {
                ...currentStats,
                proteinCount: newProteinCount,
              };
              
              // Activity Log 추가
              const currentLogs = currentStats.activityLogs || activityLogs || [];
              const updatedLogs = addActivityLog(
                currentLogs,
                'REST',
                `누워있기 성공! Protein Count: ${currentStats.proteinCount || 0} → ${newProteinCount}`
              );
              
              // 스탯 저장
              if (setDigimonStatsAndSave) {
                await setDigimonStatsAndSave(updatedStats, updatedLogs);
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
              
              const updatedStats = {
                ...currentStats,
                proteinOverdose: newProteinOverdose,
              };
              
              // Activity Log 추가
              const currentLogs = currentStats.activityLogs || activityLogs || [];
              const updatedLogs = addActivityLog(
                currentLogs,
                'DETOX',
                `디톡스 성공! Protein Overdose: ${currentStats.proteinOverdose || 0} → ${newProteinOverdose}`
              );
              
              // 스탯 저장
              if (setDigimonStatsAndSave) {
                await setDigimonStatsAndSave(updatedStats, updatedLogs);
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
          mode={mode}
          currentSeasonId={currentSeasonId}
          isDevMode={developerMode}
          onOpenAdmin={() => toggleModal('admin', true)}
          selectedDigimon={selectedDigimon}
          digimonStats={digimonStats}
        />
      )}

      {/* Sparring Modal */}
      {modals.sparring && (
        <SparringModal
          onClose={() => toggleModal('sparring', false)}
          onSelectSlot={handleSparringSlotSelect}
          currentSlotId={parseInt(slotId)}
          mode={mode}
        />
      )}

      {/* Quest Selection Modal */}
      {modals.questSelection && (
        <QuestSelectionModal
          quests={quests}
          clearedQuestIndex={clearedQuestIndex}
          onSelectArea={handleSelectArea}
          onClose={() => toggleModal('questSelection', false)}
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
          areaId={currentQuestArea}
          roundIndex={currentQuestRound}
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
            <button
              onClick={() => {
                setEvolutionStage('idle');
                setEvolvedDigimonName(null);
                setIsEvolving(false);
              }}
              className="px-6 py-3 bg-green-500 text-white font-bold rounded pixel-art-button hover:bg-green-600"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}

