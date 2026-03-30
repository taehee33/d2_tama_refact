import React, { useState } from "react";
import { checkEvolutionAvailability } from "../../hooks/useGameLogic";
import { translateStage } from "../../utils/stageTranslator";

function getJogressPartnerDisplayName(partnerId, slotVersion, digimonDataVer1, digimonDataVer2) {
  if (!partnerId) {
    return "";
  }

  const otherMap = slotVersion === "Ver.2" ? digimonDataVer1 : digimonDataVer2;
  const keyForV1 = partnerId.replace(/V1$/i, "").replace(/V2$/i, "");
  const keyForV2 = `${keyForV1}V2`;
  const otherKey = slotVersion === "Ver.2" ? keyForV1 : keyForV2;
  const data = otherMap?.[otherKey] || otherMap?.[partnerId];
  const baseName = data?.name || data?.id || partnerId;
  const versionSuffix = slotVersion === "Ver.2" ? " Ver.1" : " Ver.2";

  if (baseName.endsWith(" Ver.1") || baseName.endsWith(" Ver.2")) {
    return baseName;
  }

  return `${baseName}${versionSuffix}`;
}

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

function DigimonGuidePanel({
  currentDigimonName,
  currentDigimonData,
  currentStats,
  digimonDataMap,
  slotVersion = "Ver.1",
  digimonDataVer1 = {},
  digimonDataVer2 = {},
  onClose,
  showCloseButton = false,
  initialView = "MENU",
}) {
  const [currentView, setCurrentView] = useState(initialView);

  const titles = {
    MENU: "디지몬 가이드",
    INFO: "디지몬 정보",
    EVOLUTION: "진화 가이드",
    TIPS: "게임 팁",
    GUIDE: "기본 가이드",
  };

  const renderHeader = () => (
    <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
      {currentView === "MENU" ? (
        <h2 className="break-words text-xl font-bold text-yellow-400 pixel-art-text sm:text-2xl">
          {titles[currentView]}
        </h2>
      ) : (
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => setCurrentView("MENU")}
            className="pixel-art-button whitespace-nowrap text-base font-bold text-white hover:text-yellow-400 sm:text-lg"
          >
            ← 뒤로
          </button>
          <h2 className="break-words text-xl font-bold text-yellow-400 pixel-art-text sm:text-2xl">
            {titles[currentView]}
          </h2>
        </div>
      )}
      {showCloseButton && typeof onClose === "function" ? (
        <button
          type="button"
          onClick={onClose}
          className="pixel-art-button text-2xl font-bold text-white hover:text-red-400"
        >
          ✕
        </button>
      ) : null}
    </div>
  );

  const renderMenuView = () => (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setCurrentView("INFO")}
        className="pixel-art-button flex w-full items-center gap-3 rounded-lg bg-blue-600 px-6 py-4 text-left font-bold text-white hover:bg-blue-700"
      >
        <span className="text-2xl">📊</span>
        <span>디지몬 정보</span>
      </button>
      <button
        type="button"
        onClick={() => setCurrentView("EVOLUTION")}
        className="pixel-art-button flex w-full items-center gap-3 rounded-lg bg-purple-600 px-6 py-4 text-left font-bold text-white hover:bg-purple-700"
      >
        <span className="text-2xl">🧬</span>
        <span>진화 가이드</span>
      </button>
      <button
        type="button"
        onClick={() => setCurrentView("TIPS")}
        className="pixel-art-button flex w-full items-center gap-3 rounded-lg bg-yellow-600 px-6 py-4 text-left font-bold text-white hover:bg-yellow-700"
      >
        <span className="text-2xl">💡</span>
        <span>게임 팁</span>
      </button>
      <button
        type="button"
        onClick={() => setCurrentView("GUIDE")}
        className="pixel-art-button flex w-full items-center gap-3 rounded-lg bg-indigo-600 px-6 py-4 text-left font-bold text-white hover:bg-indigo-700"
      >
        <span className="text-2xl">📖</span>
        <span>기본 가이드</span>
      </button>
    </div>
  );

  const renderInfoView = () => {
    if (!currentDigimonData) {
      return <p className="text-white">디지몬 데이터를 불러올 수 없습니다.</p>;
    }

    const stats = currentDigimonData.stats || {};
    const digimonStats = currentStats || {};

    const formatCycle = (cycleSeconds) => {
      if (!cycleSeconds) {
        return "N/A";
      }
      return `${Math.floor(cycleSeconds / 60)}m`;
    };

    const hungerCycle = stats.hungerCycle || stats.hungerTimer || 0;
    const strengthCycle = stats.strengthCycle || stats.strengthTimer || 0;
    const poopCycle = stats.poopCycle || stats.poopTimer || 0;

    return (
      <div className="space-y-6">
        <div className="pixel-art-card rounded border-2 border-gray-600 bg-gray-700 p-4">
          <h3 className="mb-3 text-xl font-bold text-yellow-300 pixel-art-text">프로필</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm text-gray-400">이름</p>
              <p className="font-bold text-white">{currentDigimonData.name || currentDigimonName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">세대</p>
              <p className="font-bold text-white">{translateStage(currentDigimonData.stage)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">타입</p>
              <p className="font-bold text-white">{stats.type || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">스프라이트</p>
              <p className="font-bold text-white">#{currentDigimonData.sprite || "N/A"}</p>
            </div>
          </div>
        </div>

        <div className="pixel-art-card rounded border-2 border-gray-600 bg-gray-700 p-4">
          <h3 className="mb-3 text-xl font-bold text-yellow-300 pixel-art-text">기본 스펙</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm text-gray-400">기본 파워</p>
              <p className="font-bold text-white">{stats.basePower || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">최대 DP</p>
              <p className="font-bold text-white">{stats.maxEnergy || stats.maxStamina || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">수명</p>
              <p className="font-bold text-white">{stats.lifespan ? `${stats.lifespan}h` : "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">최소 체중</p>
              <p className="font-bold text-white">{stats.minWeight || 0}g</p>
            </div>
          </div>
        </div>

        <div className="pixel-art-card rounded border-2 border-gray-600 bg-gray-700 p-4">
          <h3 className="mb-3 text-xl font-bold text-yellow-300 pixel-art-text">감소 주기</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm text-gray-400">배고픔</p>
              <p className="font-bold text-white">{formatCycle(hungerCycle)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">힘</p>
              <p className="font-bold text-white">{formatCycle(strengthCycle)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">배변</p>
              <p className="font-bold text-white">{formatCycle(poopCycle)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">수면 시간</p>
              <p className="font-bold text-white">
                {stats.sleepSchedule
                  ? `${stats.sleepSchedule.start}:00 - ${stats.sleepSchedule.end}:00`
                  : "N/A"}
              </p>
            </div>
          </div>
        </div>

        <div className="pixel-art-card rounded border-2 border-gray-600 bg-gray-700 p-4">
          <h3 className="mb-3 text-xl font-bold text-yellow-300 pixel-art-text">현재 상태</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm text-gray-400">나이</p>
              <p className="font-bold text-white">{digimonStats.age || 0}일</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">체중</p>
              <p className="font-bold text-white">{digimonStats.weight || 0}g</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">승률</p>
              <p className="font-bold text-white">{digimonStats.winRate || 0}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">배고픔 하트</p>
              <p className="font-bold text-white">{digimonStats.fullness || 0}/5</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">힘 하트</p>
              <p className="font-bold text-white">{digimonStats.strength || 0}/5</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">에너지 (DP)</p>
              <p className="font-bold text-white">{digimonStats.energy || 0}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEvolutionView = () => {
    if (!currentDigimonData || !currentDigimonData.evolutions?.length) {
      return (
        <div className="py-8 text-center">
          <p className="text-white">현재 디지몬은 더 이상 진화할 수 없습니다.</p>
        </div>
      );
    }

    const evolutionList = [];

    currentDigimonData.evolutions.forEach((evo) => {
      const targetId = evo.targetId || evo.targetName;
      const targetData = digimonDataMap[targetId];
      const targetName = targetData?.name || targetData?.id || targetId || "Unknown";

      if (evo.conditions) {
        const requirements = {
          timeToEvolveSeconds: currentDigimonData.evolutionCriteria?.timeToEvolveSeconds,
          ...convertConditionsToRequirements(evo.conditions),
        };
        const availability = checkEvolutionAvailability(currentStats, requirements);

        evolutionList.push({
          targetName,
          availability,
          conditionType: "single",
        });
      } else if (Array.isArray(evo.conditionGroups)) {
        evo.conditionGroups.forEach((group, groupIndex) => {
          const requirements = {
            timeToEvolveSeconds: currentDigimonData.evolutionCriteria?.timeToEvolveSeconds,
            ...convertConditionsToRequirements(group),
          };
          const availability = checkEvolutionAvailability(currentStats, requirements);

          evolutionList.push({
            targetName:
              evo.conditionGroups.length > 1
                ? `${targetName} (진화 방법 ${groupIndex + 1})`
                : targetName,
            availability,
            conditionType: "group",
          });
        });
      } else if (evo.jogress) {
        evolutionList.push({
          targetName,
          availability: { isAvailable: true, missingConditions: [] },
          conditionType: "jogress",
          jogressPartnerName: getJogressPartnerDisplayName(
            evo.jogress?.partner || "",
            slotVersion,
            digimonDataVer1,
            digimonDataVer2
          ),
        });
      } else {
        const requirements = {
          timeToEvolveSeconds: currentDigimonData.evolutionCriteria?.timeToEvolveSeconds,
        };
        const availability = checkEvolutionAvailability(currentStats, requirements);

        evolutionList.push({
          targetName,
          availability: {
            isAvailable: availability.isAvailable,
            missingConditions:
              availability.missingConditions.length > 0
                ? availability.missingConditions
                : ["진화 조건 없음 (시간 조건만 만족하면 진화)"],
          },
          conditionType: "time_only",
        });
      }
    });

    return (
      <div className="space-y-4">
        {evolutionList.map((evo, index) => (
          <div
            key={`${evo.targetName}-${index}`}
            className="pixel-art-card rounded border-2 border-gray-600 bg-gray-700 p-4 transition-colors hover:border-yellow-400"
          >
            <h3 className="mb-2 text-xl font-bold text-yellow-300 pixel-art-text">
              → {evo.targetName}
            </h3>
            <div className="space-y-2">
              {evo.conditionType === "jogress" ? (
                <div className="space-y-1 text-sm text-amber-300">
                  <p className="font-medium">조그레스 진화(로컬/온라인)로 진행할 수 있습니다.</p>
                  {evo.jogressPartnerName ? (
                    <p className="text-gray-400">파트너: {evo.jogressPartnerName}</p>
                  ) : null}
                </div>
              ) : evo.availability.missingConditions.length > 0 ? (
                evo.availability.missingConditions.map((condition) => {
                  const isMet = condition.includes("달성 ✅");
                  const isMissing = condition.includes("부족 ❌") || condition.includes("초과 ❌");
                  const isNoCondition = condition.includes("진화 조건 없음");

                  return (
                    <div key={condition} className="flex items-center space-x-2">
                      <span
                        className={`text-sm ${
                          isMet
                            ? "text-green-400"
                            : isMissing
                              ? "text-red-400"
                              : isNoCondition
                                ? "text-yellow-400"
                                : "text-gray-300"
                        }`}
                      >
                        {condition}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="font-bold text-green-400">✅ 모든 조건을 만족했습니다!</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTipsView = () => (
    <div className="space-y-4">
      <div className="pixel-art-card rounded border-2 border-yellow-400 bg-gray-700 p-4">
        <h3 className="mb-3 text-xl font-bold text-yellow-300 pixel-art-text">🍖 먹이기 팁</h3>
        <ul className="space-y-2 break-words text-sm text-white">
          <li>• <strong>고기(Meat):</strong> 배고픔 하트 +1, 체중 +1g. 배고픔이 가득 찬 상태에서 10개 더 먹으면 오버피드 발생!</li>
          <li>• <strong>단백질(Protein):</strong> 힘 하트 +1, 체중 +2g. 4개마다 에너지 +1, 단백질 과다 복용 +1</li>
          <li>• <strong>단백질 과다 복용:</strong> 배틀 패배 시 부상 확률이 증가합니다 (최대 80%)</li>
          <li>• <strong>힘이 가득 찬 후:</strong> 단백질을 계속 먹을 수 있지만, 단백질 과다 복용 위험이 있습니다</li>
        </ul>
      </div>

      <div className="pixel-art-card rounded border-2 border-blue-400 bg-gray-700 p-4">
        <h3 className="mb-3 text-xl font-bold text-blue-300 pixel-art-text">⚔️ 배틀 팁</h3>
        <ul className="space-y-2 break-words text-sm text-white">
          <li>• <strong>승리 시:</strong> 20% 확률로 부상 발생</li>
          <li>• <strong>패배 시:</strong> 10% + (단백질 과다 복용 × 10%) 확률로 부상 발생</li>
          <li>• <strong>부상 방치:</strong> 부상 상태에서 6시간 방치하면 사망합니다</li>
          <li>• <strong>승률:</strong> 완전체, 궁극체 진화를 위해 높은 승률이 필요합니다</li>
        </ul>
      </div>

      <div className="pixel-art-card rounded border-2 border-green-400 bg-gray-700 p-4">
        <h3 className="mb-3 text-xl font-bold text-green-300 pixel-art-text">🏋️ 훈련 팁</h3>
        <ul className="space-y-2 break-words text-sm text-white">
          <li>• <strong>훈련 4회:</strong> 노력치(Effort) 하트 +1</li>
          <li>• <strong>훈련 성공:</strong> 힘 +1, 체중 -2g</li>
          <li>• <strong>훈련 실패:</strong> 체중만 -2g</li>
          <li>• <strong>수면/피곤 상태:</strong> 훈련할 수 없습니다</li>
        </ul>
      </div>

      <div className="pixel-art-card rounded border-2 border-purple-400 bg-gray-700 p-4">
        <h3 className="mb-3 text-xl font-bold text-purple-300 pixel-art-text">🧬 진화 팁</h3>
        <ul className="space-y-2 break-words text-sm text-white">
          <li>• <strong>케어 미스:</strong> 호출을 무시하면 케어 미스가 증가합니다</li>
          <li>• <strong>훈련 횟수:</strong> 많은 진화 경로에서 훈련 횟수가 중요합니다</li>
          <li>• <strong>배틀 횟수:</strong> 최소 15번의 배틀을 해야 완전체, 궁극체 진화가 가능합니다</li>
          <li>• <strong>승률:</strong> 높은 승률이 필요한 진화 경로가 있습니다</li>
        </ul>
      </div>

      <div className="pixel-art-card rounded border-2 border-red-400 bg-gray-700 p-4">
        <h3 className="mb-3 text-xl font-bold text-red-300 pixel-art-text">⚠️ 주의사항</h3>
        <ul className="space-y-2 break-words text-sm text-white">
          <li>• <strong>배고픔/힘 0:</strong> 12시간 방치하면 사망합니다</li>
          <li>• <strong>똥 8개:</strong> 즉시 부상 발생 + 8시간이후 추가 부상 발생</li>
          <li>• <strong>부상 15회:</strong> 사망합니다</li>
          <li>• <strong>수면 방해:</strong> 수면 중 불을 켜두면 케어 미스가 증가합니다</li>
        </ul>
      </div>
    </div>
  );

  const renderGuideView = () => (
    <div className="space-y-4">
      <div className="pixel-art-card rounded border-2 border-indigo-400 bg-gray-700 p-4">
        <h3 className="mb-3 text-xl font-bold text-indigo-300 pixel-art-text">🎮 기본 조작</h3>
        <ul className="space-y-2 break-words text-sm text-white">
          <li>• <strong>상단 메뉴:</strong> 상태, 먹이기, 훈련, 배틀</li>
          <li>• <strong>하단 메뉴:</strong> 화장실, 조명, 치료, 호출</li>
          <li>• <strong>Evolution 버튼:</strong> 진화 조건을 만족하면 진화할 수 있습니다</li>
          <li>• <strong>❓ 버튼:</strong> 디지몬 정보, 진화 가이드, 활동 로그 등을 확인할 수 있습니다</li>
        </ul>
      </div>

      <div className="pixel-art-card rounded border-2 border-indigo-400 bg-gray-700 p-4">
        <h3 className="mb-3 text-xl font-bold text-indigo-300 pixel-art-text">📊 스탯 이해하기</h3>
        <ul className="space-y-2 break-words text-sm text-white">
          <li>• <strong>Age:</strong> 디지몬이 살아온 일수</li>
          <li>• <strong>Weight:</strong> 체중 (기가바이트). 먹으면 증가, 훈련/배틀하면 감소</li>
          <li>• <strong>Hunger (Fullness):</strong> 배고픔 하트 (0-5, 오버피드 시 5 초과 가능)</li>
          <li>• <strong>Strength:</strong> 힘 하트 (0-5). 가득 차면 파워 보너스</li>
          <li>• <strong>Effort:</strong> 노력치 하트 (0-5). 훈련 4회당 +1</li>
          <li>• <strong>Energy (DP):</strong> 스태미나. 배틀에 필요</li>
          <li>• <strong>Energy 회복:</strong> 기상 시 기본 DP까지 회복, 매 정각/30분마다 +1</li>
          <li>• <strong>Win Rate:</strong> 승률 (%). Stage V, VI 진화에 중요</li>
        </ul>
      </div>

      <div className="pixel-art-card rounded border-2 border-indigo-400 bg-gray-700 p-4">
        <h3 className="mb-3 text-xl font-bold text-indigo-300 pixel-art-text">⏰ 시간 시스템</h3>
        <ul className="space-y-2 break-words text-sm text-white">
          <li>• <strong>HungerTimer:</strong> 배고픔이 감소하는 주기 (분 단위)</li>
          <li>• <strong>StrengthTimer:</strong> 힘이 감소하는 주기 (분 단위)</li>
          <li>• <strong>PoopTimer:</strong> 똥이 생성되는 주기 (분 단위)</li>
          <li>• <strong>Time to Evolve:</strong> 진화까지 남은 시간</li>
          <li>• <strong>Lifespan:</strong> 디지몬의 수명</li>
        </ul>
      </div>

      <div className="pixel-art-card rounded border-2 border-indigo-400 bg-gray-700 p-4">
        <h3 className="mb-3 text-xl font-bold text-indigo-300 pixel-art-text">📣 호출(Call) 시스템</h3>
        <ul className="space-y-2 break-words text-sm text-white">
          <li>• <strong>Hunger Call:</strong> 배고픔이 0이 되면 호출 시작. 10분 무시 시 케어 미스 +1</li>
          <li>• <strong>Strength Call:</strong> 힘이 0이 되면 호출 시작. 10분 무시 시 케어 미스 +1</li>
          <li>• <strong>Sleep Call:</strong> 수면 시간에 불이 켜져 있으면 호출 시작. 60분 무시 시 케어 미스 +1</li>
          <li>• <strong>호출 아이콘(📣):</strong> 호출이 활성화되면 표시됩니다</li>
        </ul>
      </div>

      <div className="pixel-art-card rounded border-2 border-indigo-400 bg-gray-700 p-4">
        <h3 className="mb-3 text-xl font-bold text-indigo-300 pixel-art-text">💤 수면 시스템</h3>
        <ul className="space-y-2 break-words text-sm text-white">
          <li>• <strong>수면 시간:</strong> 각 디지몬마다 정해진 수면 시간이 있습니다</li>
          <li>• <strong>불 끄기:</strong> 수면 시간에는 불을 꺼야 합니다</li>
          <li>• <strong>수면 방해:</strong> 수면 중 불을 켜두면 30분 후 케어 미스 +1</li>
          <li>• <strong>빠른 잠들기:</strong> 수면 시간에 불을 꺼주면, 수면 방해로 깨어있어도 10초 후 자동으로 잠듭니다</li>
        </ul>
      </div>

      <div className="pixel-art-card rounded border-2 border-indigo-400 bg-gray-700 p-4">
        <h3 className="mb-3 text-xl font-bold text-indigo-300 pixel-art-text">⚡ Energy (DP) 회복</h3>
        <ul className="space-y-2 break-words text-sm text-white">
          <li>• <strong>기상 시 회복:</strong> 수면 시간이 끝나고 기상 시간이 되면 디지몬의 기본 DP 값까지 완전히 회복됩니다</li>
          <li>• <strong>정각/30분 회복:</strong> 매 정각(00분)과 30분마다 Energy가 +1씩 회복됩니다 (최대 DP까지)</li>
          <li>• <strong>프로틴 회복:</strong> 프로틴 4개를 먹이면 Energy +1 회복됩니다</li>
          <li>• <strong>Energy 소모:</strong> 훈련 시 -1, 배틀 시 -1 소모됩니다</li>
        </ul>
      </div>

      <div className="pixel-art-card rounded border-2 border-indigo-400 bg-gray-700 p-4">
        <h3 className="mb-3 text-xl font-bold text-indigo-300 pixel-art-text">🏥 부상 및 치료</h3>
        <ul className="space-y-2 break-words text-sm text-white">
          <li>• <strong>부상 발생:</strong> 배틀 승리(20%) 또는 패배(10%+) 시 부상 발생 가능</li>
          <li>• <strong>똥 8개:</strong> 즉시 부상 발생</li>
          <li>• <strong>치료:</strong> 치료 아이콘을 눌러 치료제를 투여합니다</li>
          <li>• <strong>부상 방치:</strong> 부상 상태에서 6시간 방치하면 사망합니다</li>
          <li>• <strong>부상 15회:</strong> 누적 부상이 15회가 되면 사망합니다</li>
        </ul>
      </div>
    </div>
  );

  return (
    <div
      className="pixel-art-modal rounded-lg border-4 border-yellow-500 bg-gray-800 p-6"
      style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
    >
      {renderHeader()}

      <div className="mt-4">
        {currentView === "MENU" ? renderMenuView() : null}
        {currentView === "INFO" ? renderInfoView() : null}
        {currentView === "EVOLUTION" ? renderEvolutionView() : null}
        {currentView === "TIPS" ? renderTipsView() : null}
        {currentView === "GUIDE" ? renderGuideView() : null}
      </div>

      {currentView === "MENU" && showCloseButton && typeof onClose === "function" ? (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onClose}
            className="pixel-art-button rounded bg-yellow-500 px-6 py-2 font-bold text-black hover:bg-yellow-400"
          >
            닫기
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default DigimonGuidePanel;
