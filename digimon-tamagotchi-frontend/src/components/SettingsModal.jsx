import React, { useState, useEffect } from "react";
import { translateStage } from "../utils/stageTranslator";
import {
  getDigimonDataMapByVersion,
  getStarterDigimonIdFromDataMap,
} from "../utils/digimonVersionUtils";
import DigimonMasterDataModal from "./DigimonMasterDataModal";
import HomeScreenInstallSection from "./HomeScreenInstallSection";
import usePwaInstallPrompt from "../hooks/usePwaInstallPrompt";

const SettingsModal = ({
  onClose,
  // 기본 상태들
  foodSizeScale, setFoodSizeScale,
  developerMode, setDeveloperMode,
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
  }) => {
  const [showMasterDataModal, setShowMasterDataModal] = useState(false);
  const slotEvolutionDataMap = newDigimonDataVer1;
  const slotRuntimeDataMap = digimonDataVer1;
  const installPrompt = usePwaInstallPrompt();
  
  // 로컬 상태
  const [localWidth, setLocalWidth] = useState(width);
  const [localHeight, setLocalHeight] = useState(height);
  const [localDevMode, setLocalDevMode] = useState(developerMode);
  const [localEncyclopediaQuestionMark, setLocalEncyclopediaQuestionMark] = useState(encyclopediaShowQuestionMark);
  const [localIgnoreEvolutionTime, setLocalIgnoreEvolutionTime] = useState(ignoreEvolutionTime);
  const [uniformScale, setUniformScale] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(height / width); // 초기 비율 저장

  // 초기값
  useEffect(() => {
    setLocalWidth(width);
    setLocalHeight(height);
    setLocalDevMode(developerMode);
    setLocalEncyclopediaQuestionMark(encyclopediaShowQuestionMark);
    setLocalIgnoreEvolutionTime(ignoreEvolutionTime);
    setAspectRatio(height / width); // 비율 업데이트
  }, [width, height, developerMode, encyclopediaShowQuestionMark, ignoreEvolutionTime]);

  // Width/Height 변경
  const handleLocalWidthChange = (e) => {
    const val = parseInt(e.target.value) || 100;
    setLocalWidth(val);
    
    // Uniform Scale이 켜져 있으면 비율에 맞춰 height 자동 조정
    if (uniformScale) {
      const newHeight = Math.round(val * aspectRatio);
      setLocalHeight(newHeight);
    }
  };
  
  const handleLocalHeightChange = (e) => {
    const val = parseInt(e.target.value) || 100;
    setLocalHeight(val);
    
    // Uniform Scale이 켜져 있으면 비율에 맞춰 width 자동 조정
    if (uniformScale) {
      const newWidth = Math.round(val / aspectRatio);
      setLocalWidth(newWidth);
    }
  };

  // Uniform Scale 체크박스 토글
  const handleUniformScaleToggle = (e) => {
    const isChecked = e.target.checked;
    setUniformScale(isChecked);
    
    // 체크박스를 켤 때 현재 비율을 기준점으로 설정
    if (isChecked) {
      setAspectRatio(localHeight / localWidth);
    }
  };

  // Reset Size 버튼
  const handleResetSize = () => {
    const defaultWidth = 300;
    const defaultHeight = 200;
    setLocalWidth(defaultWidth);
    setLocalHeight(defaultHeight);
    setAspectRatio(defaultHeight / defaultWidth);
    // 즉시 적용
    setWidth(defaultWidth);
    setHeight(defaultHeight);
  };

  // Dev Mode toggle
  const toggleDevMode = () => {
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
    setWidth(localWidth);
    setHeight(localHeight);
    setDeveloperMode(localDevMode);
    // TODO: timeMode, timeSpeed, customTime 등도 저장 로직
    onClose();
  };
  return (
    <>
      <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex justify-center items-center z-50">
        <div className="bg-white rounded-lg shadow-lg w-96 flex flex-col max-h-[90vh]" modal-mobile>
        {/* 헤더 */}
        <div className="p-6 pb-4 border-b border-gray-200">
          <h2 className="text-xl">Settings</h2>
        </div>

        {/* 스크롤 가능한 컨텐츠 영역 */}
        <div className="flex-1 overflow-y-auto p-6 pt-4">
          {/* Dev Mode */}
          <div className="mb-4">
            <label className="block font-semibold">Developer Mode</label>
            <button
              className={`px-3 py-1 rounded mt-1 ${localDevMode ? "bg-green-500" : "bg-gray-500"} text-white`}
              onClick={toggleDevMode}
            >
              {localDevMode ? "ON" : "OFF"}
            </button>
          </div>

          {/* Developer Mode Options */}
          {localDevMode && (
            <div className="mb-4 pt-4 border-t border-gray-300">
              <h3 className="font-semibold mb-2">개발자 옵션</h3>
              {/* 도감 물음표 켜기/끄기 (Dev 모드일 때만) */}
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
                    <span>도감 물음표 켜기 (미발견 시 ??? 표시)</span>
                  </label>
                </div>
              )}
              {/* 모든 진화 조건 무시 (체크 시 시간·훈련·배틀 등 조건 없이 바로 진화 가능) */}
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
                    <span>모든 진화 조건 무시 (체크 시 바로 진화 가능)</span>
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

              <div className="mb-1">
                <button
                  type="button"
                  onClick={() => setShowMasterDataModal(true)}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  디지몬 마스터 데이터
                </button>
                <p className="mt-1 text-xs text-gray-500">
                  전역 Firestore 기준으로 종족 기본값, 스냅샷, 기본 복원, 가져오기를 관리합니다.
                </p>
              </div>
            </div>
          )}

          {/* Size Settings */}
          <div className="mb-4">
            <h3 className="font-semibold mb-2">Size Settings</h3>
            
            {/* Uniform Scale 체크박스 */}
            <div className="mb-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={uniformScale}
                  onChange={handleUniformScaleToggle}
                  className="mr-2"
                />
                <span>Uniform Scale (비율 고정)</span>
              </label>
            </div>
            
            {/* Width */}
            <div className="mb-2">
              <label>Width: {localWidth}px</label>
              <input
                type="range"
                min="100"
                max="600"
                value={localWidth}
                onChange={handleLocalWidthChange}
                className="w-full"
              />
              <input
                type="number"
                min="100"
                max="600"
                value={localWidth}
                onChange={handleLocalWidthChange}
                className="w-full p-1 border rounded mt-1"
              />
            </div>
            
            {/* Height */}
            <div className="mb-2">
              <label>Height: {localHeight}px</label>
              <input
                type="range"
                min="100"
                max="600"
                value={localHeight}
                onChange={handleLocalHeightChange}
                className="w-full"
              />
              <input
                type="number"
                min="100"
                max="600"
                value={localHeight}
                onChange={handleLocalHeightChange}
                className="w-full p-1 border rounded mt-1"
              />
            </div>
            
            {/* Reset Size 버튼 */}
            <div className="mt-3">
              <button
                onClick={handleResetSize}
                className="w-full px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded"
              >
                Reset Size
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

      {showMasterDataModal && (
        <DigimonMasterDataModal onClose={() => setShowMasterDataModal(false)} />
      )}
    </>
  );
};

export default SettingsModal;
