// src/components/GameScreen.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import Canvas from "./Canvas";
import {
  buildCallStatusViewModel,
  normalizeSleepStatusForDisplay,
} from "../utils/callStatusUtils";
import {
  formatSleepCountdown,
  getFallingAsleepRemainingSeconds,
} from "../utils/sleepUtils";
import { isStarterDigimonId } from "../utils/digimonVersionUtils";

const SICK_EMOJI_POOL = [
  "😷",
  "🤒",
  "🤕",
  "🤢",
  "🤮",
  "🤧",
  "🥵",
  "🥶",
  "🥴",
  "😵",
  "😵‍💫",
  "🤯",
];

const SICK_EMOJI_POSITIONS = [
  { key: "left-top", top: "22%", left: "10%", animationDelay: "0s" },
  { key: "left-bottom", top: "62%", left: "10%", animationDelay: "0.5s" },
  { key: "right-top", top: "22%", right: "10%", animationDelay: "1s" },
  { key: "right-bottom", top: "62%", right: "10%", animationDelay: "1.5s" },
];

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
  onAcknowledgeRecentCalls = () => {},
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
  currentTime: currentTimeProp = null,
  }) => {
  const visibleSleepStatus = normalizeSleepStatusForDisplay(sleepStatus);
  const isDigitama = isStarterDigimonId(selectedDigimon);
  const isDigitamaHatchFlash = isDigitama && evolutionStage === "flashing";
  
  // 부상 상태일 때 11시/5시만 랜덤, 1시/7시는 주사기로 고정
  const [selectedSickEmojis, setSelectedSickEmojis] = useState([]);
  const prevIsInjured = useRef(digimonStats.isInjured);
  const prevShowCallModal = useRef(showCallModal);
  const [liveCurrentTime, setLiveCurrentTime] = useState(Date.now());
  const [callModalTab, setCallModalTab] = useState(null);
  
  useEffect(() => {
    if (digimonStats.isInjured) {
      if (!prevIsInjured.current || selectedSickEmojis.length === 0) {
        const shuffled = [...SICK_EMOJI_POOL].sort(() => Math.random() - 0.5);
        setSelectedSickEmojis([shuffled[0], "💉", "💉", shuffled[1]]);
      }
    } else if (!digimonStats.isInjured && prevIsInjured.current) {
      setSelectedSickEmojis([]);
    }
    prevIsInjured.current = digimonStats.isInjured;
  }, [digimonStats.isInjured, selectedSickEmojis.length]);

  useEffect(() => {
    if (currentTimeProp != null) {
      return undefined;
    }

    const timer = setInterval(() => {
      setLiveCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [currentTimeProp]);

  const currentTime = currentTimeProp ?? liveCurrentTime;
  const fallingAsleepRemainingSeconds =
    visibleSleepStatus === "FALLING_ASLEEP"
      ? getFallingAsleepRemainingSeconds(
          digimonStats.fastSleepStart || null,
          currentTime
        )
      : null;
  const napRemainingText =
    visibleSleepStatus === "NAPPING" &&
    digimonStats.napUntil &&
    currentTime < digimonStats.napUntil
      ? formatSleepCountdown(digimonStats.napUntil - currentTime)
      : null;

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

  useEffect(() => {
    if (showCallModal && !prevShowCallModal.current) {
      setCallModalTab(callStatusViewModel.defaultTab);
    }
    prevShowCallModal.current = showCallModal;
  }, [showCallModal, callStatusViewModel.defaultTab]);

  const openCallModal = (tab) => {
    setCallModalTab(tab);
    onCallIconClick();
  };
  const selectedCallModalTab = callModalTab || callStatusViewModel.defaultTab;
  const unreadRecentCallIds = useMemo(
    () => callStatusViewModel.recentCallHistory
      .filter((entry) => !entry.isAcknowledged)
      .map((entry) => entry.id),
    [callStatusViewModel.recentCallHistory]
  );
  const hasUnreadRecentCalls = unreadRecentCallIds.length > 0;
  const handleAcknowledgeRecentCalls = () => {
    if (!hasUnreadRecentCalls) return;
    onAcknowledgeRecentCalls(unreadRecentCallIds);
  };

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
      
      {/* 수면 상태 아이콘 (냉장고 상태에서는 표시하지 않음) */}
      {!isFrozen && visibleSleepStatus !== "AWAKE" && (
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
          {visibleSleepStatus === "FALLING_ASLEEP"
            ? fallingAsleepRemainingSeconds != null &&
              fallingAsleepRemainingSeconds > 0
              ? `잠들기 준비 ${fallingAsleepRemainingSeconds}초`
              : "잠들기 준비 중"
            : visibleSleepStatus === "NAPPING"
              ? napRemainingText
                ? `낮잠 ${napRemainingText} 남음`
                : "낮잠 중"
              : visibleSleepStatus === "SLEEPING"
                ? "Zzz…"
                : visibleSleepStatus === "SLEEPING_LIGHT_ON"
                  ? "💡 불 켜짐 경고!"
                  : "⏰ 강제 기상"}
        </div>
      )}
      
      {/* 부상 상태: 1시/7시는 주사기, 11시/5시는 랜덤 이모티콘 표시 */}
      {digimonStats.isInjured && !digimonStats.isDead && selectedSickEmojis.length === 4 && (
        <>
          {selectedSickEmojis.map((emoji, index) => (
            <div
              key={SICK_EMOJI_POSITIONS[index].key}
              style={{
                position: "absolute",
                top: SICK_EMOJI_POSITIONS[index].top,
                left: SICK_EMOJI_POSITIONS[index].left,
                right: SICK_EMOJI_POSITIONS[index].right,
                transform: "translateY(-50%)",
                zIndex: 5,
                fontSize: 48,
                opacity: 0.7,
                animation: "float 2s ease-in-out infinite",
                animationDelay: SICK_EMOJI_POSITIONS[index].animationDelay,
              }}
            >
              {emoji}
            </div>
          ))}
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
            onClick={() => openCallModal("active")}
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
      {!callStatusViewModel.hasActiveCalls && callStatusViewModel.hasUnreadRecentCalls && (
          <button
            onClick={() => openCallModal("recent")}
            style={{
              position: "absolute",
              bottom: 8,
              right: 8,
              zIndex: 4,
              background: "rgba(75, 85, 99, 0.85)",
              color: "white",
              border: "2px solid #000",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 20,
              cursor: "pointer",
              fontWeight: "bold",
            }}
            title={callStatusViewModel.summaryLabel}
            aria-label="최근 호출 열기"
          >
            🕘📣
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
            className="bg-white rounded-lg shadow-xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            style={{
              border: "3px solid #000",
              width: '90%',
              maxWidth: '400px',
              margin: 'auto'
            }}
          >
            <div className="sticky top-0 z-20 bg-white px-6 pt-6 pb-4 border-b border-gray-200 shadow-sm">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold">📣 호출 상태</h2>
                  <p className="mt-1 text-sm text-gray-500">{callStatusViewModel.summaryLabel}</p>
                </div>
                <button
                  type="button"
                  onClick={onCallModalClose}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-2xl font-bold leading-none text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
                  aria-label="호출 상태 닫기"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1" role="tablist" aria-label="호출 상태 탭">
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedCallModalTab === "active"}
                  className={`rounded-md px-3 py-2 text-sm font-semibold ${
                    selectedCallModalTab === "active" ? "bg-white text-gray-900 shadow" : "text-gray-500"
                  }`}
                  onClick={() => setCallModalTab("active")}
                >
                  현재 호출
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedCallModalTab === "recent"}
                  className={`rounded-md px-3 py-2 text-sm font-semibold ${
                    selectedCallModalTab === "recent" ? "bg-white text-gray-900 shadow" : "text-gray-500"
                  }`}
                  onClick={() => setCallModalTab("recent")}
                >
                  최근 호출/케어미스 기록
                </button>
              </div>
            </div>

            <div className="space-y-4 px-6 pt-4 pb-6">
              {selectedCallModalTab === "active" ? (
                callStatusViewModel.hasActiveCalls ? (
                  callStatusViewModel.activeCalls.map(renderCallCard)
                ) : (
                  <div className="border-2 border-gray-300 p-3 rounded bg-gray-50">
                    <p className="font-semibold text-gray-700">현재 활성 호출이 없습니다.</p>
                  </div>
                )
              ) : (
                <div className="border-2 border-gray-300 p-3 rounded bg-gray-50">
                  <p className="font-semibold text-gray-700">
                    {callStatusViewModel.hasActiveCalls
                      ? "최근 호출/케어미스 기록"
                      : "현재 활성 호출이 없습니다."}
                  </p>
                  {callStatusViewModel.recentCallHistory.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-gray-600">최근 호출/케어미스 기록</p>
                        {hasUnreadRecentCalls ? (
                          <button
                            type="button"
                            onClick={handleAcknowledgeRecentCalls}
                            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                          >
                            모두 확인
                          </button>
                        ) : null}
                      </div>
                      {callStatusViewModel.recentCallHistory.map((entry) => (
                        <div
                          key={entry.id}
                          className={`rounded border px-3 py-2 text-sm ${
                            entry.isAcknowledged
                              ? "border-gray-200 bg-white"
                              : "border-amber-300 bg-amber-50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-gray-800">{entry.title}</span>
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  entry.isAcknowledged
                                    ? "bg-gray-100 text-gray-500"
                                    : "bg-amber-200 text-amber-800"
                                }`}
                              >
                                {entry.isAcknowledged ? "확인됨" : "미확인"}
                              </span>
                              <span className="text-xs text-gray-400">{entry.timestampLabel}</span>
                            </div>
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
            
            <div className="px-6 pb-6">
              <div className="pt-4 border-t">
              <p className="text-xs text-gray-500">
                💡 배고픔/힘 호출은 10분 내 대응이 필요하고, 수면 조명 경고는 30분 내 조명이 정리돼야 합니다.
              </p>
              </div>
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
          filter:
            evolutionStage === 'flashing' && !isDigitamaHatchFlash
              ? undefined
              : 'none',
          transition:
            evolutionStage === 'flashing' && !isDigitamaHatchFlash
              ? undefined
              : 'none',
        }}
        className={
          evolutionStage === 'flashing' && !isDigitamaHatchFlash
            ? 'evolution-flashing'
            : ''
        }
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
