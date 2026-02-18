// src/components/DigimonInfoModal.jsx
import React, { useState } from "react";
import { checkEvolutionAvailability } from "../hooks/useGameLogic";
import { translateStage } from "../utils/stageTranslator";

/**
 * 조그레스 파트너 표시명: Ver.1↔Ver.2 크로스이므로 반대 버전 맵에서 이름 조회
 */
function getJogressPartnerDisplayName(partnerId, slotVersion, digimonDataVer1, digimonDataVer2) {
  if (!partnerId) return "";
  const otherMap = slotVersion === "Ver.2" ? digimonDataVer1 : digimonDataVer2;
  // v1 맵 키는 "BlitzGreymon", v2 맵 키는 "CresGarurumonV2" 형태이므로 V1/V2 접미사 정규화
  const keyForV1 = partnerId.replace(/V1$/i, "").replace(/V2$/i, "");
  const keyForV2 = keyForV1 + "V2";
  const otherKey = slotVersion === "Ver.2" ? keyForV1 : keyForV2;
  const data = otherMap?.[otherKey] || otherMap?.[partnerId];
  const baseName = data?.name || data?.id || partnerId;
  const versionSuffix = slotVersion === "Ver.2" ? " Ver.1" : " Ver.2";
  // 데이터 이름에 이미 버전이 포함돼 있으면 중복 붙이지 않음
  if (baseName.endsWith(" Ver.1") || baseName.endsWith(" Ver.2")) return baseName;
  return baseName + versionSuffix;
}

/**
 * 디지몬 정보 모달 컴포넌트 (메뉴 선택형 구조)
 * MENU, INFO, EVOLUTION, LOGS 뷰를 포함합니다.
 */
export default function DigimonInfoModal({
  currentDigimonName,
  currentDigimonData,
  currentStats,
  digimonDataMap,
  slotVersion = "Ver.1",
  digimonDataVer1 = {},
  digimonDataVer2 = {},
  activityLogs = [],
  onClose,
}) {
  const [currentView, setCurrentView] = useState('MENU');

  // 헤더 UI
  const renderHeader = () => {
    const titles = {
      'MENU': '디지몬 가이드',
      'INFO': '디지몬 정보',
      'EVOLUTION': '진화 가이드',
      'TIPS': '게임 팁',
      'GUIDE': '기본 가이드',
    };

    return (
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        {currentView === 'MENU' ? (
          <h2 className="text-xl sm:text-2xl font-bold text-yellow-400 pixel-art-text break-words">
            {titles[currentView]}
          </h2>
        ) : (
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <button
              onClick={() => setCurrentView('MENU')}
              className="text-white hover:text-yellow-400 text-base sm:text-lg font-bold pixel-art-button whitespace-nowrap"
            >
              ← Back
            </button>
            <h2 className="text-xl sm:text-2xl font-bold text-yellow-400 pixel-art-text break-words">
              {titles[currentView]}
            </h2>
          </div>
        )}
        <button
          onClick={onClose}
          className="text-white hover:text-red-400 text-2xl font-bold pixel-art-button"
        >
          ✕
        </button>
      </div>
    );
  };

  // 화면 1: 메인 메뉴 (MENU View)
  const renderMenuView = () => {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setCurrentView('INFO')}
          className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg pixel-art-button text-left flex items-center gap-3"
        >
          <span className="text-2xl">📊</span>
          <span>디지몬 정보</span>
        </button>
        <button
          onClick={() => setCurrentView('EVOLUTION')}
          className="w-full px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg pixel-art-button text-left flex items-center gap-3"
        >
          <span className="text-2xl">🧬</span>
          <span>진화 가이드</span>
        </button>
        <button
          onClick={() => setCurrentView('TIPS')}
          className="w-full px-6 py-4 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg pixel-art-button text-left flex items-center gap-3"
        >
          <span className="text-2xl">💡</span>
          <span>게임 팁</span>
        </button>
        <button
          onClick={() => setCurrentView('GUIDE')}
          className="w-full px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg pixel-art-button text-left flex items-center gap-3"
        >
          <span className="text-2xl">📖</span>
          <span>기본 가이드</span>
        </button>
      </div>
    );
  };

  // 화면 2: 상세 정보 (INFO View)
  const renderInfoView = () => {
    if (!currentDigimonData) {
      return <p className="text-white">디지몬 데이터를 불러올 수 없습니다.</p>;
    }

    const stats = currentDigimonData.stats || {};
    const digimonStats = currentStats || {};

    // Cycles를 분 단위로 변환 (초 단위인 경우)
    const formatCycle = (cycleSeconds) => {
      if (!cycleSeconds) return 'N/A';
      const minutes = Math.floor(cycleSeconds / 60);
      return `${minutes}m`;
    };

    // hungerCycle, strengthCycle, poopCycle은 초 단위로 저장되어 있을 수 있음
    const hungerCycle = stats.hungerCycle || stats.hungerTimer || 0;
    const strengthCycle = stats.strengthCycle || stats.strengthTimer || 0;
    const poopCycle = stats.poopCycle || stats.poopTimer || 0;

    return (
      <div className="space-y-6">
        {/* Profile */}
        <div className="bg-gray-700 border-2 border-gray-600 rounded p-4 pixel-art-card">
          <h3 className="text-xl font-bold text-yellow-300 mb-3 pixel-art-text">Profile</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-gray-400 text-sm">Name</p>
              <p className="text-white font-bold">{currentDigimonData.name || currentDigimonName}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">세대</p>
              <p className="text-white font-bold">{translateStage(currentDigimonData.stage)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Type</p>
              <p className="text-white font-bold">{stats.type || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Sprite</p>
              <p className="text-white font-bold">#{currentDigimonData.sprite || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Specs */}
        <div className="bg-gray-700 border-2 border-gray-600 rounded p-4 pixel-art-card">
          <h3 className="text-xl font-bold text-yellow-300 mb-3 pixel-art-text">Specs</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-gray-400 text-sm">Base Power</p>
              <p className="text-white font-bold">{stats.basePower || 0}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Max DP</p>
              <p className="text-white font-bold">{stats.maxEnergy || stats.maxStamina || 0}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Lifespan</p>
              <p className="text-white font-bold">{stats.lifespan ? `${stats.lifespan}h` : 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Min Weight</p>
              <p className="text-white font-bold">{stats.minWeight || 0}g</p>
            </div>
          </div>
        </div>

        {/* Cycles */}
        <div className="bg-gray-700 border-2 border-gray-600 rounded p-4 pixel-art-card">
          <h3 className="text-xl font-bold text-yellow-300 mb-3 pixel-art-text">Cycles</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-gray-400 text-sm">Hunger</p>
              <p className="text-white font-bold">{formatCycle(hungerCycle)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Strength</p>
              <p className="text-white font-bold">{formatCycle(strengthCycle)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Poop</p>
              <p className="text-white font-bold">{formatCycle(poopCycle)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Sleep Schedule</p>
              <p className="text-white font-bold">
                {stats.sleepSchedule 
                  ? `${stats.sleepSchedule.start}:00 - ${stats.sleepSchedule.end}:00`
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="bg-gray-700 border-2 border-gray-600 rounded p-4 pixel-art-card">
          <h3 className="text-xl font-bold text-yellow-300 mb-3 pixel-art-text">Status</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-gray-400 text-sm">Age</p>
              <p className="text-white font-bold">{digimonStats.age || 0} days</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Weight</p>
              <p className="text-white font-bold">{digimonStats.weight || 0}g</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Win Rate</p>
              <p className="text-white font-bold">{digimonStats.winRate || 0}%</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Fullness</p>
              <p className="text-white font-bold">{digimonStats.fullness || 0}/5</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Strength</p>
              <p className="text-white font-bold">{digimonStats.strength || 0}/5</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Energy (DP)</p>
              <p className="text-white font-bold">{digimonStats.energy || 0}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 화면 3: 진화 가이드 (EVOLUTION View)
  const renderEvolutionView = () => {
    if (!currentDigimonData || !currentDigimonData.evolutions || currentDigimonData.evolutions.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-white">현재 디지몬은 더 이상 진화할 수 없습니다.</p>
        </div>
      );
    }

    // evolutions 배열을 처리하여 진화 목록 생성
    const evolutionList = [];
    
    currentDigimonData.evolutions.forEach((evo, index) => {
      const targetId = evo.targetId || evo.targetName;
      
      const targetData = digimonDataMap[targetId];
      const targetName = targetData?.name || targetData?.id || targetId || "Unknown";

      // Case 1: 단일 조건 그룹 (conditions)
      if (evo.conditions) {
        const requirements = {
          timeToEvolveSeconds: currentDigimonData.evolutionCriteria?.timeToEvolveSeconds,
          ...convertConditionsToRequirements(evo.conditions),
        };
        
        const availability = checkEvolutionAvailability(currentStats, requirements);
        
        evolutionList.push({
          targetId,
          targetName,
          targetData,
          requirements,
          availability,
          conditions: evo.conditions,
          conditionType: 'single',
        });
      }
      // Case 2: 다중 조건 그룹 (conditionGroups) - OR Logic
      else if (evo.conditionGroups && Array.isArray(evo.conditionGroups)) {
        evo.conditionGroups.forEach((group, groupIndex) => {
          const requirements = {
            timeToEvolveSeconds: currentDigimonData.evolutionCriteria?.timeToEvolveSeconds,
            ...convertConditionsToRequirements(group),
          };
          
          const availability = checkEvolutionAvailability(currentStats, requirements);
          
          const displayName = evo.conditionGroups.length > 1 
            ? `${targetName} (진화 방법 ${groupIndex + 1})`
            : targetName;
          
          evolutionList.push({
            targetId,
            targetName: displayName,
            targetData,
            requirements,
            availability,
            conditions: group,
            conditionType: 'group',
            groupIndex: groupIndex + 1,
            totalGroups: evo.conditionGroups.length,
          });
        });
      }
      // Case 3: 조그레스 (jogress) — Ver.1↔Ver.2 크로스, 파트너는 반대 버전 표기
      else if (evo.jogress) {
        const partnerId = evo.jogress?.partner || "";
        const partnerName = getJogressPartnerDisplayName(partnerId, slotVersion, digimonDataVer1, digimonDataVer2);
        evolutionList.push({
          targetId,
          targetName,
          targetData,
          requirements: {},
          availability: { isAvailable: true, missingConditions: [] },
          conditionType: 'jogress',
          jogress: evo.jogress,
          jogressPartnerName: partnerName,
        });
      }
      // Case 4: 조건이 없는 경우 (시간 조건만 있거나 자동 진화)
      else {
        const requirements = {
          timeToEvolveSeconds: currentDigimonData.evolutionCriteria?.timeToEvolveSeconds,
        };
        
        const availability = checkEvolutionAvailability(currentStats, requirements);
        
        evolutionList.push({
          targetId,
          targetName,
          targetData,
          requirements,
          availability: {
            isAvailable: availability.isAvailable,
            missingConditions: availability.missingConditions.length > 0 
              ? availability.missingConditions 
              : ["진화 조건 없음 (시간 조건만 만족하면 진화)"],
          },
          conditions: null,
          conditionType: 'time_only',
        });
      }
    });

    return (
      <div className="space-y-4">
        {evolutionList.map((evo, index) => (
          <div
            key={index}
            className="bg-gray-700 border-2 border-gray-600 rounded p-4 pixel-art-card hover:border-yellow-400 transition-colors"
          >
            <h3 className="text-xl font-bold text-yellow-300 mb-2 pixel-art-text">
              → {evo.targetName}
            </h3>

            <div className="space-y-2">
              {evo.conditionType === 'jogress' ? (
                <div className="text-amber-300 text-sm space-y-1">
                  <p className="font-medium">조그레스 진화(로컬/온라인)로 진행할 수 있습니다.</p>
                  {evo.jogressPartnerName && (
                    <p className="text-gray-400">파트너: {evo.jogressPartnerName}</p>
                  )}
                </div>
              ) : evo.availability.missingConditions.length > 0 ? (
                evo.availability.missingConditions.map((condition, idx) => {
                  const isMet = condition.includes("달성 ✅");
                  const isMissing = condition.includes("부족 ❌") || condition.includes("초과 ❌");
                  const isNoCondition = condition.includes("진화 조건 없음");
                  
                  return (
                    <div key={idx} className="flex items-center space-x-2">
                      <span className={`text-sm ${
                        isMet ? "text-green-400" : 
                        isMissing ? "text-red-400" : 
                        isNoCondition ? "text-yellow-400" :
                        "text-gray-300"
                      }`}>
                        {condition}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="text-green-400 font-bold">✅ 모든 조건을 만족했습니다!</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 화면 4: 게임 팁 (TIPS View)
  const renderTipsView = () => {
    return (
      <div className="space-y-4">
        <div className="bg-gray-700 border-2 border-yellow-400 rounded p-4 pixel-art-card">
          <h3 className="text-xl font-bold text-yellow-300 mb-3 pixel-art-text">🍖 먹이기 팁</h3>
          <ul className="space-y-2 text-white text-sm break-words">
            <li className="break-words">• <strong>고기(Meat):</strong> 배고픔 하트 +1, 체중 +1g. 배고픔이 가득 찬 상태에서 10개 더 먹으면 오버피드 발생!</li>
            <li className="break-words">• <strong>단백질(Protein):</strong> 힘 하트 +1, 체중 +2g. 4개마다 에너지 +1, 단백질 과다 복용 +1</li>
            <li className="break-words">• <strong>단백질 과다 복용:</strong> 배틀 패배 시 부상 확률이 증가합니다 (최대 80%)</li>
            <li className="break-words">• <strong>힘이 가득 찬 후:</strong> 단백질을 계속 먹을 수 있지만, 단백질 과다 복용 위험이 있습니다</li>
          </ul>
        </div>

        <div className="bg-gray-700 border-2 border-blue-400 rounded p-4 pixel-art-card">
          <h3 className="text-xl font-bold text-blue-300 mb-3 pixel-art-text">⚔️ 배틀 팁</h3>
          <ul className="space-y-2 text-white text-sm break-words">
            <li className="break-words">• <strong>승리 시:</strong> 20% 확률로 부상 발생</li>
            <li className="break-words">• <strong>패배 시:</strong> 10% + (단백질 과다 복용 × 10%) 확률로 부상 발생</li>
            <li className="break-words">• <strong>부상 방치:</strong> 부상 상태에서 6시간 방치하면 사망합니다</li>
            <li className="break-words">• <strong>승률:</strong> 완전체, 궁극체 진화를 위해 높은 승률이 필요합니다</li>
          </ul>
        </div>

        <div className="bg-gray-700 border-2 border-green-400 rounded p-4 pixel-art-card">
          <h3 className="text-xl font-bold text-green-300 mb-3 pixel-art-text">🏋️ 훈련 팁</h3>
          <ul className="space-y-2 text-white text-sm break-words">
            <li className="break-words">• <strong>훈련 4회:</strong> 노력치(Effort) 하트 +1</li>
            <li className="break-words">• <strong>훈련 성공:</strong> 힘 +1, 체중 -2g</li>
            <li className="break-words">• <strong>훈련 실패:</strong> 체중만 -2g</li>
            <li className="break-words">• <strong>수면/피곤 상태:</strong> 훈련할 수 없습니다</li>
          </ul>
        </div>

        <div className="bg-gray-700 border-2 border-purple-400 rounded p-4 pixel-art-card">
          <h3 className="text-xl font-bold text-purple-300 mb-3 pixel-art-text">🧬 진화 팁</h3>
          <ul className="space-y-2 text-white text-sm break-words">
            <li className="break-words">• <strong>케어 미스:</strong> 호출을 무시하면 케어 미스가 증가합니다</li>
            <li className="break-words">• <strong>훈련 횟수:</strong> 많은 진화 경로에서 훈련 횟수가 중요합니다</li>
            <li className="break-words">• <strong>배틀 횟수:</strong> 최소 15번의 배틀을 해야 완전체, 궁극체 진화가 가능합니다</li>
            <li className="break-words">• <strong>승률:</strong> 높은 승률이 필요한 진화 경로가 있습니다</li>
          </ul>
        </div>

        <div className="bg-gray-700 border-2 border-red-400 rounded p-4 pixel-art-card">
          <h3 className="text-xl font-bold text-red-300 mb-3 pixel-art-text">⚠️ 주의사항</h3>
          <ul className="space-y-2 text-white text-sm break-words">
            <li className="break-words">• <strong>배고픔/힘 0:</strong> 12시간 방치하면 사망합니다</li>
            <li className="break-words">• <strong>똥 8개:</strong> 즉시 부상 발생 + 8시간이후 추가 부상 발생</li>
            <li className="break-words">• <strong>부상 15회:</strong> 사망합니다</li>
            <li className="break-words">• <strong>수면 방해:</strong> 수면 중 불을 켜두면 케어 미스가 증가합니다</li>
          </ul>
        </div>
      </div>
    );
  };

  // 화면 6: 기본 가이드 (GUIDE View)
  const renderGuideView = () => {
    return (
      <div className="space-y-4">
        <div className="bg-gray-700 border-2 border-indigo-400 rounded p-4 pixel-art-card">
          <h3 className="text-xl font-bold text-indigo-300 mb-3 pixel-art-text">🎮 기본 조작</h3>
          <ul className="space-y-2 text-white text-sm break-words">
            <li className="break-words">• <strong>상단 메뉴:</strong> 상태, 먹이기, 훈련, 배틀</li>
            <li className="break-words">• <strong>하단 메뉴:</strong> 화장실, 조명, 치료, 호출</li>
            <li className="break-words">• <strong>Evolution 버튼:</strong> 진화 조건을 만족하면 진화할 수 있습니다</li>
            <li className="break-words">• <strong>❓ 버튼:</strong> 디지몬 정보, 진화 가이드, 활동 로그 등을 확인할 수 있습니다</li>
          </ul>
        </div>

        <div className="bg-gray-700 border-2 border-indigo-400 rounded p-4 pixel-art-card">
          <h3 className="text-xl font-bold text-indigo-300 mb-3 pixel-art-text">📊 스탯 이해하기</h3>
          <ul className="space-y-2 text-white text-sm break-words">
            <li className="break-words">• <strong>Age:</strong> 디지몬이 살아온 일수</li>
            <li className="break-words">• <strong>Weight:</strong> 체중 (기가바이트). 먹으면 증가, 훈련/배틀하면 감소</li>
            <li className="break-words">• <strong>Hunger (Fullness):</strong> 배고픔 하트 (0-5, 오버피드 시 5 초과 가능)</li>
            <li className="break-words">• <strong>Strength:</strong> 힘 하트 (0-5). 가득 차면 파워 보너스</li>
            <li className="break-words">• <strong>Effort:</strong> 노력치 하트 (0-5). 훈련 4회당 +1</li>
            <li className="break-words">• <strong>Energy (DP):</strong> 스태미나. 배틀에 필요</li>
            <li className="break-words">• <strong>Energy 회복:</strong> 기상 시 기본 DP까지 회복, 매 정각/30분마다 +1</li>
            <li>• <strong>Win Rate:</strong> 승률 (%). Stage V, VI 진화에 중요</li>
          </ul>
        </div>

        <div className="bg-gray-700 border-2 border-indigo-400 rounded p-4 pixel-art-card">
          <h3 className="text-xl font-bold text-indigo-300 mb-3 pixel-art-text">⏰ 시간 시스템</h3>
          <ul className="space-y-2 text-white text-sm break-words">
            <li className="break-words">• <strong>HungerTimer:</strong> 배고픔이 감소하는 주기 (분 단위)</li>
            <li className="break-words">• <strong>StrengthTimer:</strong> 힘이 감소하는 주기 (분 단위)</li>
            <li className="break-words">• <strong>PoopTimer:</strong> 똥이 생성되는 주기 (분 단위)</li>
            <li className="break-words">• <strong>Time to Evolve:</strong> 진화까지 남은 시간</li>
            <li className="break-words">• <strong>Lifespan:</strong> 디지몬의 수명</li>
          </ul>
        </div>

        <div className="bg-gray-700 border-2 border-indigo-400 rounded p-4 pixel-art-card">
          <h3 className="text-xl font-bold text-indigo-300 mb-3 pixel-art-text">📣 호출(Call) 시스템</h3>
          <ul className="space-y-2 text-white text-sm break-words">
            <li className="break-words">• <strong>Hunger Call:</strong> 배고픔이 0이 되면 호출 시작. 10분 무시 시 케어 미스 +1</li>
            <li className="break-words">• <strong>Strength Call:</strong> 힘이 0이 되면 호출 시작. 10분 무시 시 케어 미스 +1</li>
            <li className="break-words">• <strong>Sleep Call:</strong> 수면 시간에 불이 켜져 있으면 호출 시작. 60분 무시 시 케어 미스 +1</li>
            <li className="break-words">• <strong>호출 아이콘(📣):</strong> 호출이 활성화되면 표시됩니다</li>
          </ul>
        </div>

        <div className="bg-gray-700 border-2 border-indigo-400 rounded p-4 pixel-art-card">
          <h3 className="text-xl font-bold text-indigo-300 mb-3 pixel-art-text">💤 수면 시스템</h3>
          <ul className="space-y-2 text-white text-sm break-words">
            <li className="break-words">• <strong>수면 시간:</strong> 각 디지몬마다 정해진 수면 시간이 있습니다</li>
            <li className="break-words">• <strong>불 끄기:</strong> 수면 시간에는 불을 꺼야 합니다</li>
            <li className="break-words">• <strong>수면 방해:</strong> 수면 중 불을 켜두면 30분 후 케어 미스 +1</li>
            <li className="break-words">• <strong>빠른 잠들기:</strong> 수면 시간에 불을 꺼주면, 수면 방해로 깨어있어도 10초 후 자동으로 잠듭니다</li>
          </ul>
        </div>

        <div className="bg-gray-700 border-2 border-indigo-400 rounded p-4 pixel-art-card">
          <h3 className="text-xl font-bold text-indigo-300 mb-3 pixel-art-text">⚡ Energy (DP) 회복</h3>
          <ul className="space-y-2 text-white text-sm break-words">
            <li className="break-words">• <strong>기상 시 회복:</strong> 수면 시간이 끝나고 기상 시간이 되면 디지몬의 기본 DP 값까지 완전히 회복됩니다</li>
            <li className="break-words">• <strong>정각/30분 회복:</strong> 매 정각(00분)과 30분마다 Energy가 +1씩 회복됩니다 (최대 DP까지)</li>
            <li className="break-words">• <strong>프로틴 회복:</strong> 프로틴 4개를 먹이면 Energy +1 회복됩니다</li>
            <li className="break-words">• <strong>Energy 소모:</strong> 훈련 시 -1, 배틀 시 -1 소모됩니다</li>
          </ul>
        </div>

        <div className="bg-gray-700 border-2 border-indigo-400 rounded p-4 pixel-art-card">
          <h3 className="text-xl font-bold text-indigo-300 mb-3 pixel-art-text">🏥 부상 및 치료</h3>
          <ul className="space-y-2 text-white text-sm break-words">
            <li className="break-words">• <strong>부상 발생:</strong> 배틀 승리(20%) 또는 패배(10%+) 시 부상 발생 가능</li>
            <li className="break-words">• <strong>똥 8개:</strong> 즉시 부상 발생</li>
            <li className="break-words">• <strong>치료:</strong> 치료 아이콘을 눌러 치료제를 투여합니다</li>
            <li className="break-words">• <strong>부상 방치:</strong> 부상 상태에서 6시간 방치하면 사망합니다</li>
            <li className="break-words">• <strong>부상 15회:</strong> 누적 부상이 15회가 되면 사망합니다</li>
          </ul>
        </div>
      </div>
    );
  };

  // 메인 렌더링
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 border-4 border-yellow-500 rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto pixel-art-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
      >
        {renderHeader()}

        <div className="mt-4">
          {currentView === 'MENU' && renderMenuView()}
          {currentView === 'INFO' && renderInfoView()}
          {currentView === 'EVOLUTION' && renderEvolutionView()}
          {currentView === 'TIPS' && renderTipsView()}
          {currentView === 'GUIDE' && renderGuideView()}
        </div>

        {currentView === 'MENU' && (
          <div className="mt-6 text-center">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-yellow-500 text-black font-bold rounded pixel-art-button hover:bg-yellow-400"
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * conditions 객체를 requirements 형식으로 변환
 * @param {Object} conditions - { careMistakes: { min: 4 }, trainings: { min: 5, max: 15 }, ... }
 * @returns {Object} requirements 객체
 */
function convertConditionsToRequirements(conditions) {
  const requirements = {};
  
  if (conditions.careMistakes) {
    if (conditions.careMistakes.min !== undefined) {
      requirements.minMistakes = conditions.careMistakes.min;
    }
    if (conditions.careMistakes.max !== undefined) {
      requirements.maxMistakes = conditions.careMistakes.max;
    }
  }
  
  if (conditions.trainings) {
    if (conditions.trainings.min !== undefined) {
      requirements.minTrainings = conditions.trainings.min;
    }
    if (conditions.trainings.max !== undefined) {
      requirements.maxTrainings = conditions.trainings.max;
    }
  }
  
  if (conditions.overfeeds) {
    if (conditions.overfeeds.min !== undefined) {
      requirements.minOverfeeds = conditions.overfeeds.min;
    }
    if (conditions.overfeeds.max !== undefined) {
      requirements.maxOverfeeds = conditions.overfeeds.max;
    }
  }
  
  if (conditions.sleepDisturbances) {
    if (conditions.sleepDisturbances.min !== undefined) {
      requirements.minSleepDisturbances = conditions.sleepDisturbances.min;
    }
    if (conditions.sleepDisturbances.max !== undefined) {
      requirements.maxSleepDisturbances = conditions.sleepDisturbances.max;
    }
  }
  
  if (conditions.battles) {
    if (conditions.battles.min !== undefined) {
      requirements.minBattles = conditions.battles.min;
    }
    if (conditions.battles.max !== undefined) {
      requirements.maxBattles = conditions.battles.max;
    }
  }
  
  if (conditions.winRatio) {
    if (conditions.winRatio.min !== undefined) {
      requirements.minWinRatio = conditions.winRatio.min;
    }
    if (conditions.winRatio.max !== undefined) {
      requirements.maxWinRatio = conditions.winRatio.max;
    }
  }
  
  if (conditions.weight) {
    if (conditions.weight.min !== undefined) {
      requirements.minWeight = conditions.weight.min;
    }
    if (conditions.weight.max !== undefined) {
      requirements.maxWeight = conditions.weight.max;
    }
  }
  
  if (conditions.strength) {
    if (conditions.strength.min !== undefined) {
      requirements.minStrength = conditions.strength.min;
    }
    if (conditions.strength.max !== undefined) {
      requirements.maxStrength = conditions.strength.max;
    }
  }
  
  if (conditions.power) {
    if (conditions.power.min !== undefined) {
      requirements.minPower = conditions.power.min;
    }
    if (conditions.power.max !== undefined) {
      requirements.maxPower = conditions.power.max;
    }
  }
  
  return requirements;
}

