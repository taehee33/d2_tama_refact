// src/components/GameScreen.jsx
import React, { useState, useEffect, useRef } from "react";
import Canvas from "./Canvas";
import StatusHearts from "./StatusHearts";

/**
 * GameScreen 컴포넌트
 * 디지몬 스프라이트, 배경, 똥, 상태 아이콘 등이 표시되는 메인 게임 화면 영역
 */
const GameScreen = ({
  // 스타일 및 크기
  width = 300,
  height = 200,
  backgroundNumber = 162,
  
  // 디지몬 애니메이션
  currentAnimation = "idle",
  idleFrames = [],
  eatFrames = [],
  foodRejectFrames = [],
  
  // 먹이 관련
  showFood = false,
  feedStep = 0,
  feedType = null,
  foodSizeScale = 0.31,
  meatSprites = [],
  proteinSprites = [],
  isRefused = false, // 고기 거절 상태 (오버피드)
  
  // 똥 관련
  poopCount = 0,
  showPoopCleanAnimation = false,
  cleanStep = 0,
  
  // 수면 상태
  sleepStatus = "AWAKE",
  isLightsOn = true,
  
  // 상태 아이콘
  digimonStats = {},
  selectedDigimon = "", // 선택된 디지몬 이름 (디지타마 수면 상태 체크용)
  showHealAnimation = false,
  showCallToast = false,
  callToastMessage = "",
  showCallModal = false,
  onCallIconClick = () => {},
  onCallModalClose = () => {},
  showSleepDisturbanceToast = false,
  sleepDisturbanceToastMessage = "",
  
  
  // 진화 애니메이션
  evolutionStage = null,
  
  // 개발자 모드
  developerMode = false,
}) => {
  // 부상 상태 이모티콘 목록
  const sickEmojis = ["😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "😵‍💫", "🤯"];
  
  // 부상 상태일 때 랜덤으로 4개 선택 (부상 상태가 시작될 때 한 번만 선택)
  const [selectedSickEmojis, setSelectedSickEmojis] = useState([]);
  const prevIsInjured = useRef(digimonStats.isInjured);
  
  useEffect(() => {
    // 부상 상태가 시작될 때 랜덤으로 4개 선택
    if (digimonStats.isInjured && !prevIsInjured.current) {
      const shuffled = [...sickEmojis].sort(() => Math.random() - 0.5);
      setSelectedSickEmojis(shuffled.slice(0, 4));
    } else if (!digimonStats.isInjured && prevIsInjured.current) {
      // 부상 상태가 끝나면 초기화
      setSelectedSickEmojis([]);
    }
    prevIsInjured.current = digimonStats.isInjured;
  }, [digimonStats.isInjured]);
  
  return (
    <div style={{ position: "relative", width, height, border: "2px solid #555" }}>
      {/* 배경 이미지 */}
      <img
        src={`/images/${backgroundNumber}.png`}
        alt="bg"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          imageRendering: "pixelated",
          zIndex: 1,
        }}
      />
      
      {/* Lights Off Overlay (게임 화면만) */}
      {!isLightsOn && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            pointerEvents: "none",
            zIndex: 3,
          }}
        />
      )}
      
      {/* 수면/피곤 상태 아이콘 */}
      {(sleepStatus === "SLEEPING" || sleepStatus === "TIRED") && (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 4,
            background: "rgba(0,0,0,0.4)",
            color: "white",
            padding: "4px 8px",
            borderRadius: 8,
            fontWeight: "bold",
            fontSize: 12,
          }}
        >
          {sleepStatus === "SLEEPING" ? "Zzz…" : "💡 불 꺼줘!"}
        </div>
      )}
      
      {/* 부상 상태: 이모티콘 디지몬 주변에 4개 표시 (왼쪽 2개, 오른쪽 2개) */}
      {digimonStats.isInjured && !digimonStats.isDead && selectedSickEmojis.length === 4 && (
        <>
          {/* 왼쪽 위 이모티콘 */}
          <div
            style={{
              position: "absolute",
              top: "30%",
              left: "10%",
              transform: "translateY(-50%)",
              zIndex: 5,
              fontSize: 48,
              opacity: 0.7,
              animation: "float 2s ease-in-out infinite",
            }}
          >
            {selectedSickEmojis[0]}
          </div>
          {/* 왼쪽 아래 이모티콘 */}
          <div
            style={{
              position: "absolute",
              top: "70%",
              left: "10%",
              transform: "translateY(-50%)",
              zIndex: 5,
              fontSize: 48,
              opacity: 0.7,
              animation: "float 2s ease-in-out infinite",
              animationDelay: "0.5s",
            }}
          >
            {selectedSickEmojis[1]}
          </div>
          {/* 오른쪽 위 이모티콘 */}
          <div
            style={{
              position: "absolute",
              top: "30%",
              right: "10%",
              transform: "translateY(-50%)",
              zIndex: 5,
              fontSize: 48,
              opacity: 0.7,
              animation: "float 2s ease-in-out infinite",
              animationDelay: "1s",
            }}
          >
            {selectedSickEmojis[2]}
          </div>
          {/* 오른쪽 아래 이모티콘 */}
          <div
            style={{
              position: "absolute",
              top: "70%",
              right: "10%",
              transform: "translateY(-50%)",
              zIndex: 5,
              fontSize: 48,
              opacity: 0.7,
              animation: "float 2s ease-in-out infinite",
              animationDelay: "1.5s",
            }}
          >
            {selectedSickEmojis[3]}
          </div>
        </>
      )}

      {/* 죽음 상태: 해골 디지몬 주변에 4개 표시 */}
      {digimonStats.isDead && (
        <>
          {/* 왼쪽 위 해골 */}
          <div
            style={{
              position: "absolute",
              top: "30%",
              left: "10%",
              transform: "translateY(-50%)",
              zIndex: 5,
              fontSize: 48,
              opacity: 0.7,
              animation: "float 2s ease-in-out infinite",
            }}
          >
            💀
          </div>
          {/* 왼쪽 아래 해골 */}
          <div
            style={{
              position: "absolute",
              top: "70%",
              left: "10%",
              transform: "translateY(-50%)",
              zIndex: 5,
              fontSize: 48,
              opacity: 0.7,
              animation: "float 2s ease-in-out infinite",
              animationDelay: "0.5s",
            }}
          >
            💀
          </div>
          {/* 오른쪽 위 해골 */}
          <div
            style={{
              position: "absolute",
              top: "30%",
              right: "10%",
              transform: "translateY(-50%)",
              zIndex: 5,
              fontSize: 48,
              opacity: 0.7,
              animation: "float 2s ease-in-out infinite",
              animationDelay: "1s",
            }}
          >
            💀
          </div>
          {/* 오른쪽 아래 해골 */}
          <div
            style={{
              position: "absolute",
              top: "70%",
              right: "10%",
              transform: "translateY(-50%)",
              zIndex: 5,
              fontSize: 48,
              opacity: 0.7,
              animation: "float 2s ease-in-out infinite",
              animationDelay: "1.5s",
            }}
          >
            💀
          </div>
        </>
      )}
      
      {/* 치료 연출 (주사기) */}
      {showHealAnimation && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 5,
            fontSize: 32,
            animation: "fadeInOut 1.5s ease-in-out",
          }}
        >
          💉
        </div>
      )}
      
      {/* 호출(Call) 아이콘 */}
      {digimonStats.callStatus && (
        (digimonStats.callStatus.hunger?.isActive || 
         digimonStats.callStatus.strength?.isActive || 
         digimonStats.callStatus.sleep?.isActive) && (
          <button
            onClick={onCallIconClick}
            style={{
              position: "absolute",
              bottom: 8,
              right: 8,
              zIndex: 4,
              background: "rgba(255, 165, 0, 0.8)",
              color: "white",
              border: "2px solid #000",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 24,
              cursor: "pointer",
              animation: "blink 1s infinite",
              fontWeight: "bold",
            }}
            title="Call Icon - Click to see reason"
          >
            📣
          </button>
        )
      )}
      
      {/* 호출 Toast 메시지 (간략) */}
      {showCallToast && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 6,
            background: "rgba(0, 0, 0, 0.8)",
            color: "white",
            padding: "16px 24px",
            borderRadius: 8,
            fontSize: 20,
            fontWeight: "bold",
            border: "2px solid #fff",
            animation: "fadeInOut 2s ease-in-out",
          }}
        >
          {callToastMessage}
        </div>
      )}
      
      {/* 수면 방해 Toast 메시지 */}
      {showSleepDisturbanceToast && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 6,
            background: "rgba(255, 165, 0, 0.9)",
            color: "white",
            padding: "16px 24px",
            borderRadius: 8,
            fontSize: 20,
            fontWeight: "bold",
            border: "2px solid #fff",
            animation: "fadeInOut 3s ease-in-out",
          }}
        >
          {sleepDisturbanceToastMessage}
        </div>
      )}
      
      {/* 호출 상세 정보 팝업 (callSign 버튼 클릭 시) */}
      {showCallModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={onCallModalClose}
        >
          <div
            className="bg-white p-6 rounded-lg shadow-xl w-96 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            style={{
              border: "3px solid #000",
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">📣 Call Status Log</h2>
              <button
                onClick={onCallModalClose}
                className="text-red-500 hover:text-red-700 text-2xl font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              {digimonStats.callStatus?.hunger?.isActive && (
                <div className="border-2 border-red-400 p-3 rounded bg-red-50">
                  <h3 className="font-bold text-lg text-red-700 mb-2">🍽️ Hunger Call</h3>
                  <div className="text-sm space-y-1">
                    <p><strong>Status:</strong> Active</p>
                    <p><strong>Started At:</strong> {digimonStats.callStatus.hunger.startedAt 
                      ? new Date(digimonStats.callStatus.hunger.startedAt).toLocaleString('ko-KR')
                      : 'N/A'}</p>
                    <p><strong>Elapsed Time:</strong> {digimonStats.callStatus.hunger.startedAt 
                      ? `${Math.floor((Date.now() - digimonStats.callStatus.hunger.startedAt) / 1000 / 60)}분 ${Math.floor(((Date.now() - digimonStats.callStatus.hunger.startedAt) / 1000) % 60)}초`
                      : 'N/A'}</p>
                    <p><strong>Timeout:</strong> 10분</p>
                    <p><strong>Reason:</strong> Fullness reached 0</p>
                    <p className="text-red-600 font-semibold">⚠️ If ignored for 10 minutes, Care Mistake will increase!</p>
                  </div>
                </div>
              )}
              
              {digimonStats.callStatus?.strength?.isActive && (
                <div className="border-2 border-blue-400 p-3 rounded bg-blue-50">
                  <h3 className="font-bold text-lg text-blue-700 mb-2">💪 Strength Call</h3>
                  <div className="text-sm space-y-1">
                    <p><strong>Status:</strong> Active</p>
                    <p><strong>Started At:</strong> {digimonStats.callStatus.strength.startedAt 
                      ? new Date(digimonStats.callStatus.strength.startedAt).toLocaleString('ko-KR')
                      : 'N/A'}</p>
                    <p><strong>Elapsed Time:</strong> {digimonStats.callStatus.strength.startedAt 
                      ? `${Math.floor((Date.now() - digimonStats.callStatus.strength.startedAt) / 1000 / 60)}분 ${Math.floor(((Date.now() - digimonStats.callStatus.strength.startedAt) / 1000) % 60)}초`
                      : 'N/A'}</p>
                    <p><strong>Timeout:</strong> 10분</p>
                    <p><strong>Reason:</strong> Strength reached 0</p>
                    <p className="text-blue-600 font-semibold">⚠️ If ignored for 10 minutes, Care Mistake will increase!</p>
                  </div>
                </div>
              )}
              
              {digimonStats.callStatus?.sleep?.isActive && (
                <div className="border-2 border-purple-400 p-3 rounded bg-purple-50">
                  <h3 className="font-bold text-lg text-purple-700 mb-2">😴 Sleep Call</h3>
                  <div className="text-sm space-y-1">
                    <p><strong>Status:</strong> Active</p>
                    <p><strong>Started At:</strong> {digimonStats.callStatus.sleep.startedAt 
                      ? new Date(digimonStats.callStatus.sleep.startedAt).toLocaleString('ko-KR')
                      : 'N/A'}</p>
                    <p><strong>Elapsed Time:</strong> {digimonStats.callStatus.sleep.startedAt 
                      ? `${Math.floor((Date.now() - digimonStats.callStatus.sleep.startedAt) / 1000 / 60)}분 ${Math.floor(((Date.now() - digimonStats.callStatus.sleep.startedAt) / 1000) % 60)}초`
                      : 'N/A'}</p>
                    <p><strong>Timeout:</strong> 60분</p>
                    <p><strong>Reason:</strong> Sleep time and lights are ON</p>
                    <p className="text-purple-600 font-semibold">⚠️ If ignored for 60 minutes, Care Mistake will increase!</p>
                  </div>
                </div>
              )}
              
              {(!digimonStats.callStatus?.hunger?.isActive && 
                !digimonStats.callStatus?.strength?.isActive && 
                !digimonStats.callStatus?.sleep?.isActive) && (
                <div className="border-2 border-gray-300 p-3 rounded bg-gray-50">
                  <p className="text-gray-600">No active calls at the moment.</p>
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-gray-500">
                💡 <strong>Tip:</strong> Respond to calls before timeout to avoid Care Mistakes!
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Canvas - 디지몬 스프라이트 렌더링 */}
      <Canvas
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 2,
          animation: evolutionStage === 'shaking' ? 'shake 0.5s infinite' : 'none',
          filter: evolutionStage === 'flashing' ? 'invert(1)' : 'none',
          transition: evolutionStage === 'flashing' ? 'filter 0.1s' : 'none',
        }}
        className={evolutionStage === 'flashing' ? 'evolution-flashing' : ''}
        width={width}
        height={height}
        currentAnimation={currentAnimation}
        idleFrames={idleFrames}
        eatFrames={eatFrames}
        foodRejectFrames={foodRejectFrames}
        showFood={showFood}
        feedStep={feedStep}
        foodSizeScale={foodSizeScale}
        developerMode={developerMode}
        foodSprites={feedType === "protein" ? proteinSprites : meatSprites}
        poopCount={poopCount}
        showPoopCleanAnimation={showPoopCleanAnimation}
        cleanStep={cleanStep}
        sleepStatus={sleepStatus}
        isRefused={isRefused}
        isInjured={digimonStats.isInjured && !digimonStats.isDead}
        isDead={digimonStats.isDead || false}
        selectedDigimon={selectedDigimon}
      />
    </div>
  );
};

export default GameScreen;


