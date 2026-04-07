// src/components/GameScreen.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import Canvas from "./Canvas";
import { buildCallStatusViewModel } from "../utils/callStatusUtils";

const CALL_CARD_STYLES = {
  hunger: {
    container: "border-red-300 bg-red-50",
    title: "text-red-700",
    button: "bg-red-500 hover:bg-red-600",
  },
  strength: {
    container: "border-blue-300 bg-blue-50",
    title: "text-blue-700",
    button: "bg-blue-500 hover:bg-blue-600",
  },
  sleep: {
    container: "border-amber-300 bg-amber-50",
    title: "text-amber-700",
    button: "bg-amber-500 hover:bg-amber-600",
  },
};

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
  idleMotionTimeline = [],
  eatFrames = [],
  foodRejectFrames = [],
  digimonImageBase = "/images", // v2는 /Ver2_Mod_Kor
  
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
  showCallModal = false,
  onCallIconClick = () => {},
  onCallModalClose = () => {},
  onResolveCallAction = () => {},
  showSleepDisturbanceToast = false,
  sleepDisturbanceToastMessage = "",
  
  
  // 진화 애니메이션
  evolutionStage = null,
  
  // 개발자 모드
  developerMode = false,
  
  // 냉장고 상태
  isFrozen = false,
  frozenAt = null,
  takeOutAt = null,
}) => {
  // 부상 상태 이모티콘 목록
  const sickEmojis = ["😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "😵‍💫", "🤯"];
  
  // 부상 상태일 때 랜덤으로 4개 선택 (부상 상태가 시작될 때 한 번만 선택)
  const [selectedSickEmojis, setSelectedSickEmojis] = useState([]);
  const prevIsInjured = useRef(digimonStats.isInjured);
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  useEffect(() => {
    // 부상 상태가 시작될 때 랜덤으로 4개 선택
    // 똥 8개로 인한 부상일 때도 이모티콘이 표시되도록 조건 수정
    if (digimonStats.isInjured) {
      // 이전에 부상 상태가 아니었거나, 이모티콘이 선택되지 않은 경우에만 선택
      if (!prevIsInjured.current || selectedSickEmojis.length === 0) {
        const shuffled = [...sickEmojis].sort(() => Math.random() - 0.5);
        setSelectedSickEmojis(shuffled.slice(0, 4));
      }
    } else if (!digimonStats.isInjured && prevIsInjured.current) {
      // 부상 상태가 끝나면 초기화
      setSelectedSickEmojis([]);
    }
    prevIsInjured.current = digimonStats.isInjured;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digimonStats.isInjured, selectedSickEmojis.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const callStatusViewModel = useMemo(
    () =>
      buildCallStatusViewModel({
        digimonStats,
        sleepStatus,
        isLightsOn,
        currentTime,
      }),
    [digimonStats, sleepStatus, isLightsOn, currentTime]
  );

  const renderCallCard = (call) => {
    const styles = CALL_CARD_STYLES[call.type] || CALL_CARD_STYLES.hunger;

    return (
      <div
        key={call.type}
        className={`rounded-lg border-2 p-4 shadow-sm ${styles.container}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className={`text-lg font-bold ${styles.title}`}>{call.title}</h3>
            <p className="mt-1 text-sm text-gray-700">{call.reason}</p>
          </div>
          <button
            type="button"
            onClick={() => onResolveCallAction(call.actionKey)}
            className={`rounded-md px-3 py-2 text-sm font-semibold text-white transition-colors ${styles.button}`}
          >
            {call.actionLabel}
          </button>
        </div>

        <div className="mt-3 space-y-1 text-sm">
          <p className="font-semibold text-gray-900">{call.statusLabel}</p>
          {call.pauseReason ? (
            <p className="text-blue-700">{call.pauseReason}</p>
          ) : null}
          {call.deadlineText ? (
            <p className="text-xs text-gray-500">{call.deadlineText}</p>
          ) : null}
          <p className={call.type === "sleep" ? "text-amber-700" : "text-red-600"}>
            {call.riskText}
          </p>
        </div>
      </div>
    );
  };
  
  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        border: "2px solid #555",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
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
      
      {/* 수면/피곤 상태 아이콘 (냉장고 상태에서는 표시하지 않음) */}
      {!isFrozen && (sleepStatus === "SLEEPING" || sleepStatus === "TIRED") && (
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
      {callStatusViewModel.hasActiveCalls && (
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
            title={callStatusViewModel.summaryLabel}
            aria-label="호출 상태 열기"
          >
            📣
          </button>
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
          style={{ padding: '20px' }}
        >
          <div
            className="bg-white p-6 rounded-lg shadow-xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            style={{
              border: "3px solid #000",
              width: '90%',
              maxWidth: '400px',
              margin: 'auto'
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-2xl font-bold">📣 호출 상태</h2>
                <p className="mt-1 text-sm text-gray-500">{callStatusViewModel.summaryLabel}</p>
              </div>
              <button
                onClick={onCallModalClose}
                className="text-red-500 hover:text-red-700 text-2xl font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              {callStatusViewModel.hasActiveCalls ? (
                callStatusViewModel.activeCalls.map(renderCallCard)
              ) : (
                <div className="border-2 border-gray-300 p-3 rounded bg-gray-50">
                  <p className="font-semibold text-gray-700">현재 활성 호출이 없습니다.</p>
                  {callStatusViewModel.recentCallHistory.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm font-semibold text-gray-600">최근 호출/케어미스 기록</p>
                      {callStatusViewModel.recentCallHistory.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded border border-gray-200 bg-white px-3 py-2 text-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-gray-800">{entry.title}</span>
                            <span className="text-xs text-gray-400">{entry.timestampLabel}</span>
                          </div>
                          <p className="mt-1 text-gray-600">{entry.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500">최근 호출 기록도 없습니다.</p>
                  )}
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-gray-500">
                💡 배고픔/힘 호출은 10분 내 대응이 필요하고, 수면 호출은 경고 전용입니다.
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
        digimonImageBase={digimonImageBase}
        currentAnimation={currentAnimation}
        idleFrames={idleFrames}
        idleMotionTimeline={idleMotionTimeline}
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
        isFrozen={isFrozen}
        frozenAt={digimonStats.frozenAt || null}
        takeOutAt={digimonStats.takeOutAt || null}
      />
    </div>
  );
};

export default GameScreen;
