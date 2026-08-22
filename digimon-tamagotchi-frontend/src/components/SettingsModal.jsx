import React, { useState, useEffect } from "react";
import { translateStage } from "../utils/stageTranslator";
import {
  getDigimonDataMapByVersion,
  getStarterDigimonIdFromDataMap,
} from "../utils/digimonVersionUtils";
import HomeScreenInstallSection from "./HomeScreenInstallSection";
import usePwaInstallPrompt from "../hooks/usePwaInstallPrompt";
import { IMMERSIVE_SKINS } from "../data/immersiveSettings";
import {
  GAME_SCENE_SIZE,
  GAME_SCENE_SIZE_MAX,
  GAME_SCENE_SIZE_MIN,
  normalizeGameSceneSize,
} from "../utils/gameSceneGeometry";

const PIXEL_SKINS = IMMERSIVE_SKINS.filter((skin) => skin.portraitPixel);

function resolveSceneSizeDraft(value, fallbackSize) {
  const rawValue = typeof value === "string" ? value.trim() : value;

  if (rawValue === "" || rawValue === null || rawValue === undefined) {
    return fallbackSize;
  }

  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue)) {
    return fallbackSize;
  }

  return normalizeGameSceneSize({ width: numericValue }).width;
}

const SettingsModal = ({
  onClose,
  // 기본 상태들
  foodSizeScale, setFoodSizeScale,
  developerMode, setDeveloperMode,
  canUseDeveloperMode = false,
  encyclopediaShowQuestionMark = true,
  setEncyclopediaShowQuestionMark,
  ignoreEvolutionTime = false,
  setIgnoreEvolutionTime,
  width, height, setWidth, setHeight,
  backgroundNumber, setBackgroundNumber,
  digimonSizeScale, setDigimonSizeScale,
  timeMode, setTimeMode,
  timeSpeed, setTimeSpeed,
  customTime, setCustomTime,
  // Dev Digimon Select 관련 props
  newDigimonDataVer1,
  digimonDataVer1,
  digimonDataVer2,
  initializeStats,
  setDigimonStatsAndSave,
  setSelectedDigimonAndSave,
  selectedDigimon,
  digimonStats,
  slotVersion,
  immersiveSettings,
  onSelectImmersiveSkin,
  onOpenAppearanceSettings,
  }) => {
  const slotEvolutionDataMap = newDigimonDataVer1;
  const slotRuntimeDataMap = digimonDataVer1;
  const installPrompt = usePwaInstallPrompt();
  
  // 로컬 상태
  const [localSceneSize, setLocalSceneSize] = useState(() =>
    normalizeGameSceneSize({ width, height }).width
  );
  const [localSceneSizeInput, setLocalSceneSizeInput] = useState(() =>
    String(normalizeGameSceneSize({ width, height }).width)
  );
  const [localDevMode, setLocalDevMode] = useState(developerMode);
  const [localEncyclopediaQuestionMark, setLocalEncyclopediaQuestionMark] = useState(encyclopediaShowQuestionMark);
  const [localIgnoreEvolutionTime, setLocalIgnoreEvolutionTime] = useState(ignoreEvolutionTime);

  // 부모 상태가 개별로 바뀔 때 해당 draft만 갱신한다.
  // 여러 설정을 한 effect에서 동기화하면 개발자 옵션 체크 시 Dev Mode draft가 되돌아간다.
  useEffect(() => {
    const nextSize = normalizeGameSceneSize({ width, height }).width;
    setLocalSceneSize(nextSize);
    setLocalSceneSizeInput(String(nextSize));
  }, [width, height]);

  useEffect(() => {
    setLocalDevMode(canUseDeveloperMode ? developerMode : false);
  }, [canUseDeveloperMode, developerMode]);

  useEffect(() => {
    setLocalEncyclopediaQuestionMark(encyclopediaShowQuestionMark);
  }, [encyclopediaShowQuestionMark]);

  useEffect(() => {
    setLocalIgnoreEvolutionTime(ignoreEvolutionTime);
  }, [ignoreEvolutionTime]);

  // 숫자 입력은 편집 중간값을 유지하고, 입력 완료 시에만 범위를 보정한다.
  const commitLocalSceneSizeInput = () => {
    const nextSize = resolveSceneSizeDraft(localSceneSizeInput, localSceneSize);
    setLocalSceneSize(nextSize);
    setLocalSceneSizeInput(String(nextSize));
    return nextSize;
  };

  // 슬라이더는 브라우저가 제공하는 숫자를 즉시 반영한다.
  const handleLocalSceneSizeRangeChange = (e) => {
    const nextSize = normalizeGameSceneSize({ width: e.target.value }).width;
    setLocalSceneSize(nextSize);
    setLocalSceneSizeInput(String(nextSize));
  };

  // 직접 입력은 빈 값·중간 숫자·범위 밖 숫자를 편집 중 그대로 보여준다.
  const handleLocalSceneSizeInputChange = (e) => {
    setLocalSceneSizeInput(e.target.value);
  };

  const handleLocalSceneSizeInputKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    commitLocalSceneSizeInput();
  };

  // Reset Size 버튼
  const handleResetSize = () => {
    const defaultSize = GAME_SCENE_SIZE.width;
    setLocalSceneSize(defaultSize);
    setLocalSceneSizeInput(String(defaultSize));
    // 즉시 적용
    setWidth(defaultSize);
    setHeight(defaultSize);
  };

  // Dev Mode toggle
  const toggleDevMode = () => {
    if (!canUseDeveloperMode) return;
    setLocalDevMode(!localDevMode);
  };

  // 디지몬을 stage별로 그룹화하여 정렬된 옵션 생성 (Ver.2 슬롯이면 v2 디지몬, 아니면 v1)
  const groupedDigimonOptions = React.useMemo(() => {
    const dataMap =
      getDigimonDataMapByVersion(slotVersion) ||
      slotEvolutionDataMap ||
      slotRuntimeDataMap ||
      digimonDataVer2;
    if (!dataMap || typeof dataMap !== 'object') return null;

    // Stage 순서 정의
    const stageOrder = [
      "Digitama",
      "Baby I",
      "Baby II",
      "Child",
      "Adult",
      "Perfect",
      "Ultimate",
      "Super Ultimate",
      "Ohakadamon"
    ];

    // 디지몬을 stage별로 그룹화
    const digimonByStage = {};
    Object.keys(dataMap).forEach(key => {
      const digimon = dataMap[key];
      const stage = digimon?.stage || "Unknown";
      if (!digimonByStage[stage]) {
        digimonByStage[stage] = [];
      }
      digimonByStage[stage].push({
        key,
        name: digimon?.name || key,
        stage
      });
    });

    // 각 stage 내에서 이름순 정렬
    stageOrder.forEach(stage => {
      if (digimonByStage[stage]) {
        digimonByStage[stage].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      }
    });

    return { stageOrder, digimonByStage };
  }, [slotVersion, slotEvolutionDataMap, slotRuntimeDataMap, digimonDataVer2]);

  // Save
  const handleSave = () => {
    const committedSize = commitLocalSceneSizeInput();
    setWidth(committedSize);
    setHeight(committedSize);
    setDeveloperMode(canUseDeveloperMode ? localDevMode : false);
    if (!localDevMode || !canUseDeveloperMode) {
      setLocalIgnoreEvolutionTime(false);
      setIgnoreEvolutionTime?.(false);
    }
    // TODO: timeMode, timeSpeed, customTime 등도 저장 로직
    onClose();
  };
  return (
    <>
      <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex justify-center items-center z-50">
        <div className="bg-white rounded-lg shadow-lg w-96 flex flex-col max-h-[90vh] modal-mobile">
        {/* 헤더 */}
        <div className="p-6 pb-4 border-b border-gray-200">
          <h2 className="text-xl">Settings</h2>
        </div>

        {/* 스크롤 가능한 컨텐츠 영역 */}
        <div className="flex-1 overflow-y-auto p-6 pt-4">
          <section className="mb-4 rounded-lg border-2 border-slate-300 bg-slate-50 p-4" aria-label="몰입형 세로 화면 설정">
            <h3 className="font-bold text-slate-900">몰입형 세로 화면</h3>
            <p className="mt-1 text-xs text-slate-600">기본 게임 화면은 그대로 두고 선택한 픽셀 스킨만 적용합니다.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onSelectImmersiveSkin?.("tama-default-none")} aria-pressed={immersiveSettings?.skinId === "tama-default-none"} className={`min-h-11 rounded border-2 px-2 text-sm font-bold ${immersiveSettings?.skinId === "tama-default-none" ? "border-blue-600 bg-blue-100" : "border-slate-300 bg-white"}`}>기본 UI</button>
              {PIXEL_SKINS.map((skin) => (
                <button key={skin.id} type="button" onClick={() => onSelectImmersiveSkin?.(skin.id)} aria-pressed={immersiveSettings?.skinId === skin.id} className={`min-h-11 rounded border-2 px-2 text-xs font-bold ${immersiveSettings?.skinId === skin.id ? "border-blue-600 bg-blue-100" : "border-slate-300 bg-white"}`}>{skin.name}</button>
              ))}
            </div>
            <button type="button" onClick={onOpenAppearanceSettings} className="mt-3 min-h-11 w-full rounded bg-slate-900 px-4 font-bold text-white">외형 꾸미기</button>
          </section>

          {/* Dev Mode */}
          {canUseDeveloperMode && (
            <div className="mb-4">
              <label className="block font-semibold">Developer Mode (운영자 권한)</label>
              <button
                className={`px-3 py-1 rounded mt-1 ${localDevMode ? "bg-green-500" : "bg-gray-500"} text-white`}
                onClick={toggleDevMode}
              >
                {localDevMode ? "ON" : "OFF"}
              </button>
            </div>
          )}

          {/* Developer Mode Options */}
          {canUseDeveloperMode && localDevMode && (
            <div className="mb-4 pt-4 border-t border-gray-300">
              <h3 className="font-semibold mb-2">개발자 옵션</h3>
              {/* 도감 미발견 공개/숨김 (Dev 모드일 때만) */}
              {setEncyclopediaShowQuestionMark && (
                <div className="mb-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={localEncyclopediaQuestionMark}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setLocalEncyclopediaQuestionMark(checked);
                        setEncyclopediaShowQuestionMark(checked);
                      }}
                      className="mr-2"
                    />
                    <span>도감 미발견 디지몬 공개</span>
                  </label>
                </div>
              )}
              {/* 모든 진화 조건 무시 (후보 선택 후 일반 진화 가능) */}
              {setIgnoreEvolutionTime && (
                <div className="mb-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={localIgnoreEvolutionTime}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setLocalIgnoreEvolutionTime(checked);
                        setIgnoreEvolutionTime(checked);
                      }}
                      className="mr-2"
                    />
                    <span>모든 진화 조건 무시 (후보 선택 후 즉시 진화 가능)</span>
                  </label>
                </div>
              )}
              {/* Dev Digimon Select (Dev 모드 ON이면 Ver.1/Ver.2 슬롯 모두 표시) */}
              {groupedDigimonOptions && initializeStats && setDigimonStatsAndSave && setSelectedDigimonAndSave && (
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Dev Digimon Select:</label>
                  <select
                    onChange={(e) => {
                      const nm = e.target.value;
                      const dataMap =
                        getDigimonDataMapByVersion(slotVersion) ||
                        slotEvolutionDataMap ||
                        slotRuntimeDataMap ||
                        digimonDataVer2;
                      if (!nm || nm.startsWith('--')) return; // 구분자 선택 무시
                      if (!dataMap?.[nm]) {
                        console.error(`No data for ${nm}`);
                        const fallbackStarterId = getStarterDigimonIdFromDataMap(dataMap);
                        const fallback = initializeStats(fallbackStarterId, digimonStats, dataMap);
                        setDigimonStatsAndSave(fallback);
                        setSelectedDigimonAndSave(fallbackStarterId);
                        return;
                      }
                      const old = { ...digimonStats };
                      const nx = initializeStats(nm, old, dataMap);
                      setDigimonStatsAndSave(nx);
                      setSelectedDigimonAndSave(nm);
                    }}
                    defaultValue={selectedDigimon}
                    className="w-full p-2 border border-gray-300 rounded"
                  >
                    {groupedDigimonOptions.stageOrder.map(stage => {
                      const digimons = groupedDigimonOptions.digimonByStage[stage];
                      if (!digimons || digimons.length === 0) return null;
                      
                      return (
                        <React.Fragment key={stage}>
                          <option disabled value={`--${stage}--`} style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>
                            -- {translateStage(stage)} --
                          </option>
                          {digimons.map(digimon => (
                            <option key={digimon.key} value={digimon.key}>
                              {digimon.name}
                            </option>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </select>
                </div>
              )}

            </div>
          )}

          {/* 정사각형 화면 크기 설정 */}
          <div className="mb-4">
            <h3 className="font-semibold mb-2">화면 크기</h3>

            <div className="mb-2">
              <label htmlFor="game-scene-size-range">
                화면 한 변: {localSceneSize}px
              </label>
              <input
                id="game-scene-size-range"
                type="range"
                min={GAME_SCENE_SIZE_MIN}
                max={GAME_SCENE_SIZE_MAX}
                value={localSceneSize}
                onChange={handleLocalSceneSizeRangeChange}
                className="w-full"
              />
              <input
                aria-label="화면 한 변 직접 입력"
                type="number"
                min={GAME_SCENE_SIZE_MIN}
                max={GAME_SCENE_SIZE_MAX}
                value={localSceneSizeInput}
                onChange={handleLocalSceneSizeInputChange}
                onBlur={commitLocalSceneSizeInput}
                onKeyDown={handleLocalSceneSizeInputKeyDown}
                className="w-full p-1 border rounded mt-1"
              />
            </div>
            
            {/* Reset Size 버튼 */}
            <div className="mt-3">
              <button
                onClick={handleResetSize}
                className="w-full px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded"
              >
                기본 크기로 초기화
              </button>
            </div>
          </div>

          <HomeScreenInstallSection
            sectionClassName="mb-4 pt-4 border-t border-gray-300"
            installState={installPrompt}
          />

          {/* 디스코드 링크 */}
          <div className="mb-4 pt-4 border-t border-gray-300">
            <p className="text-base font-bold text-gray-800 mb-3">💬 디스코드 (버그리포트, Q&A 등)</p>
            <a
              href="https://discord.gg/BWXFtSCnGt"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors text-sm break-all shadow-md hover:shadow-lg"
            >
              🔗 https://discord.gg/BWXFtSCnGt
            </a>
          </div>
        </div>

        {/* 푸터 (Save / Cancel 버튼) */}
        <div className="p-6 pt-4 border-t border-gray-200 flex justify-end space-x-2">
          <button className="px-4 py-2 bg-gray-300 rounded" onClick={onClose}>
            Cancel
          </button>
          <button className="px-4 py-2 bg-blue-500 text-white rounded" onClick={handleSave}>
            Save
          </button>
        </div>
        </div>
      </div>

    </>
  );
};

export default SettingsModal;
