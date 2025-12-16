// src/components/BattleScreen.jsx
// 턴제 전투 화면 및 애니메이션 (발사체 방식)

import React, { useState, useEffect, useRef } from "react";
import { playQuestRound } from "../logic/battle/questEngine";
import { simulateBattle } from "../logic/battle/calculator";
import { digimonDataVer1 as newDigimonDataVer1 } from "../data/v1/digimons";
import { getQuestArea } from "../data/v1/quests";
import "../styles/Battle.css";

// 타격 이펙트는 이제 텍스트로 표시되므로 스프라이트 경로는 더 이상 필요 없음

export default function BattleScreen({
  userDigimon,
  userStats,
  userSlotName,
  areaId,
  roundIndex,
  battleType,
  sparringEnemySlot,
  arenaChallenger,
  onBattleComplete,
  onQuestClear,
  onClose,
}) {
  const [battleState, setBattleState] = useState("loading"); // loading, ready, playing, result, victory
  const [currentLogIndex, setCurrentLogIndex] = useState(0);
  const [battleResult, setBattleResult] = useState(null);
  const [userHits, setUserHits] = useState(0);
  const [enemyHits, setEnemyHits] = useState(0);
  const [enemyData, setEnemyData] = useState(null);
  const [showReadyModal, setShowReadyModal] = useState(false); // 라운드 준비 모달 표시 여부
  const [hasRoundStarted, setHasRoundStarted] = useState(false); // 라운드 시작 여부
  const [showLogReview, setShowLogReview] = useState(false); // 로그 리뷰 화면 표시 여부
  
  // 발사체 및 이펙트 상태
  const [projectile, setProjectile] = useState(null); // { type: "user" | "enemy", sprite: number }
  const [hitText, setHitText] = useState(null); // { target: "user" | "enemy" } - 타격 텍스트
  const [missText, setMissText] = useState(null); // { target: "user" | "enemy" }
  
  const userDigimonRef = useRef(null);
  const userDigimonImgRef = useRef(null);
  const enemyDigimonRef = useRef(null);
  const enemyDigimonImgRef = useRef(null);
  const battleAreaRef = useRef(null);

  // 배틀 시작 시 적 데이터 가져오기 및 배틀 실행
  // roundIndex가 변경되면 새로운 배틀 시작
  useEffect(() => {
    // roundIndex가 변경되면 battleState를 loading으로 리셋
    setBattleState("loading");
  }, [areaId, roundIndex]);

  useEffect(() => {
    if (battleState === "loading") {
      let result;
      
      if (battleType === 'sparring' && sparringEnemySlot) {
        // Sparring 모드: 직접 simulateBattle 호출
        const enemyDigimonData = newDigimonDataVer1[sparringEnemySlot.selectedDigimon] || {
          id: sparringEnemySlot.selectedDigimon,
          name: sparringEnemySlot.selectedDigimon,
          stats: {},
        };
        
        // 적 스탯에서 power 계산 (digimonStats.power 또는 basePower 사용)
        const enemyPower = sparringEnemySlot.digimonStats?.power || enemyDigimonData.stats?.basePower || 0;
        
        const enemyStats = {
          power: enemyPower,
          type: enemyDigimonData.stats?.type || null,
        };
        
        // 배틀 시뮬레이션 (슬롯 정보로 이름 통일: 슬롯명(디지몬명) 형식)
        const userDigimonName = userDigimon.name || userDigimon.id || "Unknown";
        const enemyDigimonName = enemyDigimonData.name || enemyDigimonData.id || "Unknown";
        const userName = userSlotName 
          ? `${userSlotName}(${userDigimonName})`
          : userDigimonName;
        // 스파링 모드에서는 항상 상대 디지몬명 앞에 (Ghost) 추가
        const enemyName = sparringEnemySlot?.slotName
          ? `(Ghost) ${sparringEnemySlot.slotName}(${enemyDigimonName})`
          : `(Ghost) ${enemyDigimonName}`;
        
        const battleResult = simulateBattle(
          userDigimon, 
          userStats, 
          enemyDigimonData, 
          enemyStats,
          userName,
          enemyName
        );
        
        result = {
          win: battleResult.won,
          logs: battleResult.log,
          enemy: {
            name: `(Ghost) ${enemyDigimonData.name || enemyDigimonData.id}`,
            power: enemyPower,
            attribute: enemyStats.type,
            isBoss: false,
            slotName: sparringEnemySlot.slotName,
            sprite: enemyDigimonData.sprite || 0,
            attackSprite: enemyDigimonData.stats?.attackSprite || enemyDigimonData.sprite || 0,
            digimonId: enemyDigimonData.id || sparringEnemySlot.selectedDigimon,
          },
          isAreaClear: false,
          reward: null,
          rounds: battleResult.rounds,
          userHits: battleResult.userHits,
          enemyHits: battleResult.enemyHits,
        };
      } else if (battleType === 'arena' && arenaChallenger) {
        // Arena 모드: arenaChallenger 데이터 사용
        const enemyDigimonData = newDigimonDataVer1[arenaChallenger.digimonSnapshot.digimonId] || {
          id: arenaChallenger.digimonSnapshot.digimonId,
          name: arenaChallenger.digimonSnapshot.digimonName,
          stats: arenaChallenger.digimonSnapshot.stats,
        };

        const enemyStats = {
          power: arenaChallenger.digimonSnapshot.stats?.power || 0,
          type: arenaChallenger.digimonSnapshot.stats?.type || null,
        };

        const userDigimonName = userDigimon.name || userDigimon.id || "Unknown";
        const userName = userSlotName
          ? `${userSlotName}의 ${userDigimonName}`
          : userDigimonName;
        const enemyName = `${arenaChallenger.tamerName || arenaChallenger.trainerName || 'Unknown'}의 ${enemyDigimonData.name || enemyDigimonData.id}`;

        const battleResult = simulateBattle(
          userDigimon,
          userStats,
          enemyDigimonData,
          enemyStats,
          userName,
          enemyName
        );

        result = {
          win: battleResult.won,
          logs: battleResult.log,
          enemy: {
            name: enemyDigimonData.name || enemyDigimonData.id, // 실제 디지몬 이름
            power: enemyStats.power,
            attribute: enemyStats.type,
            isBoss: false,
            tamerName: arenaChallenger.tamerName || arenaChallenger.trainerName || 'Unknown',
            trainerName: arenaChallenger.tamerName || arenaChallenger.trainerName || 'Unknown', // For backward compatibility
            sprite: enemyDigimonData.sprite || 0,
            attackSprite: enemyDigimonData.stats?.attackSprite || enemyDigimonData.sprite || 0,
            digimonId: enemyDigimonData.id || arenaChallenger.digimonSnapshot.digimonId,
          },
          isAreaClear: false,
          reward: null,
          rounds: battleResult.rounds,
          userHits: battleResult.userHits,
          enemyHits: battleResult.enemyHits,
        };
      } else {
        // Quest 모드: 기존 로직
        result = playQuestRound(userDigimon, userStats, areaId, roundIndex);
      }
      
      setBattleResult(result);
      setEnemyData(result.enemy);
      setCurrentLogIndex(0);
      setUserHits(0);
      setEnemyHits(0);
      setProjectile(null);
      setHitText(null);
      setMissText(null);
      
      // 라운드 준비 모달 표시
      setShowReadyModal(true);
      setHasRoundStarted(false); // 새로운 라운드 시작 시 리셋
      setBattleState("ready");
    }
  }, [battleState, userDigimon, userStats, areaId, roundIndex, battleType, sparringEnemySlot, arenaChallenger]);

  // 적 디지몬 데이터 가져오기
  const getEnemyDigimonData = () => {
    if (!enemyData) return null;
    // enemyId로 먼저 찾고, 없으면 name으로 찾기
    const questArea = getQuestArea(areaId);
    if (questArea && questArea.enemies[roundIndex]) {
      const enemyId = questArea.enemies[roundIndex].enemyId;
      return newDigimonDataVer1[enemyId] || null;
    }
    return newDigimonDataVer1[enemyData.name] || null;
  };

  const enemyDigimonData = getEnemyDigimonData();
  const userDigimonData = newDigimonDataVer1[userDigimon.id || userDigimon.name] || userDigimon;

  // 유저 파워 계산
  const userPower = userStats.power || userDigimonData?.stats?.basePower || 0;
  const enemyPower = enemyData?.power || 0;

  // 퀘스트 클리어 여부 확인
  const questArea = getQuestArea(areaId);
  const isQuestCleared = battleResult?.isAreaClear || false;
  const isLastRound = questArea && roundIndex === questArea.enemies.length - 1;

  // 로그 재생 애니메이션 (1.5~2초 간격)
  useEffect(() => {
    // hasRoundStarted가 false이면 애니메이션 재생하지 않음
    if (!hasRoundStarted) return;
    
    if (battleState === "playing" && battleResult && battleResult.logs) {
      if (currentLogIndex < battleResult.logs.length) {
        const log = battleResult.logs[currentLogIndex];
        
        // 발사체 생성
        if (log.attacker === "user") {
          const attackSprite = userDigimonData?.stats?.attackSprite || userDigimonData?.sprite || 0;
          setProjectile({ type: "user", sprite: attackSprite });
        } else {
          // Sparring/Arena 모드일 때는 enemyData에서 attackSprite 가져오기
          const attackSprite = (battleType === 'sparring' || battleType === 'arena') && enemyData?.attackSprite !== undefined
            ? enemyData.attackSprite
            : (enemyDigimonData?.stats?.attackSprite || enemyDigimonData?.sprite || 0);
          setProjectile({ type: "enemy", sprite: attackSprite });
        }

        // 발사체가 목표에 도달한 후 처리
        const projectileDuration = 800; // 발사체 비행 시간 (ms)
        
        setTimeout(() => {
          setProjectile(null); // 발사체 제거
          
          if (log.hit) {
            // 타격 처리 - HIT! 텍스트 표시
            if (log.attacker === "user") {
              setHitText({ target: "enemy" });
              setUserHits(prev => prev + 1);
              
              // HIT! 텍스트 제거
              setTimeout(() => {
                setHitText(null);
              }, 1000);
            } else {
              setHitText({ target: "user" });
              setEnemyHits(prev => prev + 1);
              
              // HIT! 텍스트 제거
              setTimeout(() => {
                setHitText(null);
              }, 1000);
            }
          } else {
            // 회피 처리
            if (log.attacker === "user") {
              // 유저 공격이 빗나감 → CPU(적)가 오른쪽으로 회피
              setMissText({ target: "enemy" });
              if (enemyDigimonRef.current) {
                enemyDigimonRef.current.classList.add("dodging");
                setTimeout(() => {
                  if (enemyDigimonRef.current) {
                    enemyDigimonRef.current.classList.remove("dodging");
                  }
                }, 500);
              }
            } else {
              // 적 공격이 빗나감 → 유저가 왼쪽으로 회피
              setMissText({ target: "user" });
              if (userDigimonRef.current) {
                userDigimonRef.current.classList.add("dodge-motion");
                setTimeout(() => {
                  if (userDigimonRef.current) {
                    userDigimonRef.current.classList.remove("dodge-motion");
                  }
                }, 600);
              }
            }
            
            // MISS 텍스트 제거
            setTimeout(() => {
              setMissText(null);
            }, 1000);
          }
        }, projectileDuration);

        // 1.5~2초 후 다음 로그로 (랜덤하게 1.5~2초 사이)
        const delay = 1500 + Math.random() * 500; // 1500ms ~ 2000ms
        const timer = setTimeout(() => {
          setCurrentLogIndex(prev => prev + 1);
        }, delay);

        return () => clearTimeout(timer);
      } else {
        // 모든 로그 재생 완료 - 승리/패배 확인
        if (battleResult.win) {
          setBattleState("victory"); // 승리 모달 표시
        } else {
          setBattleState("result"); // 패배 결과 표시
        }
      }
    }
  }, [battleState, currentLogIndex, battleResult, userDigimonData, enemyDigimonData, hasRoundStarted]);

  // 다음 라운드 진행
  const handleNextBattle = () => {
    if (isQuestCleared) {
      // 퀘스트 클리어 시 onQuestClear 호출 후 종료
      if (onQuestClear) {
        onQuestClear();
      }
      onClose();
    } else {
      // 다음 라운드로 진행
      onBattleComplete(battleResult);
    }
  };

  // 배틀 종료
  const handleExit = () => {
    onClose();
  };

  // 패배 처리
  const handleDefeat = () => {
    onClose();
  };

  // 라운드 준비 모달 - Start 버튼
  const handleRoundStart = () => {
    setHasRoundStarted(true);
    setShowReadyModal(false);
    setBattleState("playing");
  };

  // 라운드 준비 모달 - Exit 버튼
  const handleRoundExit = () => {
    onClose();
  };

  if (battleState === "loading") {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="text-white text-xl">배틀 준비 중...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      {/* 라운드 준비 모달 */}
      {showReadyModal && !hasRoundStarted && (
        <div className="round-ready-modal fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-70">
          <div className="bg-white p-8 rounded-lg shadow-xl text-center" style={{ minWidth: "400px" }}>
            <h2 className="text-4xl font-bold mb-2">
              {battleType === 'sparring' ? 'Sparring' : battleType === 'arena' ? 'Arena' : `Round ${roundIndex + 1}`}
            </h2>
            <p className="text-xl text-gray-700 mb-6">
              VS {battleType === 'arena' && (enemyData?.tamerName || enemyData?.trainerName)
                ? `${enemyData.tamerName || enemyData.trainerName}의 ${enemyData?.name || "Unknown"}`
                : enemyData?.name || "Unknown"}
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleRoundStart}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors"
              >
                Start
              </button>
              <button
                onClick={handleRoundExit}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg font-bold hover:bg-gray-600 transition-colors"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="battle-screen bg-white p-6 rounded-lg shadow-xl w-full max-w-4xl">
        {/* 라운드 정보 */}
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold">
            {battleType === 'sparring'
              ? `Sparring - ${enemyData?.name || "Unknown"}`
              : battleType === 'arena'
              ? `Arena - ${enemyData.tamerName || enemyData.trainerName}의 ${enemyData?.name || "Unknown"}`
              : `Round ${roundIndex + 1} - ${enemyData?.name || "Unknown"}`}
          </h2>
          {enemyData?.isBoss && (
            <span className="text-red-600 font-bold">BOSS</span>
          )}
        </div>

        {/* 배틀 영역 */}
        <div 
          ref={battleAreaRef}
          className="battle-area flex justify-between items-center mb-4"
          style={{ position: "relative" }}
        >
          {/* 유저 디지몬 */}
          <div className="battle-side user-side">
            {/* 플레이어 배지 */}
            <div className="battle-badge badge user">
              {userSlotName || "USER"}
            </div>
            <div
              ref={userDigimonRef}
              className="digimon-sprite player-digimon"
              style={{ position: "relative" }}
            >
              <img
                ref={userDigimonImgRef}
                src={`/images/${userDigimonData?.sprite || 0}.png`}
                alt={userDigimonData?.name || "User Digimon"}
                className={`player-sprite ${projectile?.type === "user" ? "animate-attack-user" : ""}`}
                style={{
                  imageRendering: "pixelated",
                  width: "120px",
                  height: "120px",
                }}
              />
              {/* HIT! 텍스트 */}
              {hitText?.target === "user" && (
                <div className="hit-text">💀💀!HIT!💀💀</div>
              )}
              {/* MISS 텍스트 */}
              {missText?.target === "user" && (
                <div className="miss-text">MISS</div>
              )}
            </div>
            <div className="digimon-info mt-2">
              <p className="font-bold">
                {userSlotName
                  ? `${userSlotName}의 ${userDigimonData?.name || "User"}`
                  : userDigimonData?.name || "User"}
              </p>
              <p>Power: {userPower}</p>
            </div>
            {/* 히트 마커 */}
            <div className="hit-markers flex justify-center gap-2 mt-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`hit-marker ${i < userHits ? "filled" : ""}`}
                />
              ))}
            </div>
          </div>

          {/* 발사체 */}
          {projectile && (
            <img
              className={`projectile ${projectile.type === "user" ? "shoot-right user-projectile" : "shoot-left"}`}
              src={`/images/${projectile.sprite}.png`}
              alt="Projectile"
              style={{
                position: "absolute",
                width: "60px",
                height: "60px",
                imageRendering: "pixelated",
                zIndex: 50,
                left: projectile.type === "user" ? "200px" : "calc(100% - 260px)",
                top: "50%",
                transform: projectile.type === "user" ? "translateY(-50%) scaleX(-1)" : "translateY(-50%)",
              }}
            />
          )}

          {/* VS 텍스트 */}
          <div className="vs-text text-3xl font-bold">VS</div>

          {/* 적 디지몬 */}
          <div className="battle-side enemy-side">
            {/* 적 배지 */}
            <div className="battle-badge badge cpu">
              {battleType === 'sparring' && enemyData?.slotName 
                ? enemyData.slotName 
                : battleType === 'arena' && (enemyData?.tamerName || enemyData?.trainerName)
                ? enemyData.tamerName || enemyData.trainerName
                : "CPU"}
            </div>
            <div
              ref={enemyDigimonRef}
              className="digimon-sprite enemy-digimon"
              style={{ position: "relative" }}
            >
              <img
                ref={enemyDigimonImgRef}
                src={`/images/${(battleType === 'sparring' && enemyData?.sprite !== undefined) 
                  ? enemyData.sprite 
                  : (battleType === 'arena' && enemyData?.sprite !== undefined)
                  ? enemyData.sprite
                  : (enemyDigimonData?.sprite || 0)}.png`}
                alt={enemyData?.name || "Enemy Digimon"}
                className={projectile?.type === "enemy" ? "animate-attack-cpu" : ""}
                style={{
                  imageRendering: "pixelated",
                  width: "120px",
                  height: "120px",
                }}
              />
              {/* HIT! 텍스트 */}
              {hitText?.target === "enemy" && (
                <div className="hit-text">💀💀!HIT!💀💀</div>
              )}
              {/* MISS 텍스트 */}
              {missText?.target === "enemy" && (
                <div className="miss-text">MISS</div>
              )}
            </div>
            <div className="digimon-info mt-2">
              <p className="font-bold">
                {battleType === 'arena' && (enemyData?.tamerName || enemyData?.trainerName)
                  ? `${enemyData.tamerName || enemyData.trainerName}의 ${enemyData?.name || "Unknown"}`
                  : enemyData?.name || "Enemy"}
              </p>
              <p>Power: {enemyPower}</p>
            </div>
            {/* 히트 마커 */}
            <div className="hit-markers flex justify-center gap-2 mt-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`hit-marker ${i < enemyHits ? "filled" : ""}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 배틀 로그 */}
        {battleState === "playing" && battleResult?.logs && (
          <div className="battle-log-container mb-4">
            <div className="battle-log text-center text-sm text-gray-600 mb-2">
              <strong>현재 턴:</strong> {battleResult.logs[currentLogIndex]?.message || "배틀 진행 중..."}
            </div>
            {/* 상세 계산 공식 */}
            {battleResult.logs[currentLogIndex]?.formula && (
              <div className="battle-formula text-xs text-gray-500 mb-2 font-mono">
                {battleResult.logs[currentLogIndex].formula}
              </div>
            )}
            {battleResult.logs[currentLogIndex]?.roll !== undefined && (
              <div className="battle-roll text-xs text-gray-500 mb-2 font-mono">
                Rolled: {battleResult.logs[currentLogIndex].roll} {battleResult.logs[currentLogIndex].hit ? "(Hit!)" : "(Miss)"}
              </div>
            )}
            {/* 전체 배틀 로그 (스크롤 가능) */}
            <div className="battle-log-history bg-gray-100 p-3 rounded max-h-32 overflow-y-auto">
              <div className="text-xs font-bold mb-1">배틀 로그:</div>
              {battleResult.logs.slice(0, currentLogIndex + 1).map((log, idx) => {
                // 로그 컬러링 클래스 결정
                const logClass = log.attacker === "user" 
                  ? (log.hit ? "user-hit" : "user-miss")
                  : (log.hit ? "enemy-hit" : "enemy-miss");
                const isCurrent = idx === currentLogIndex;
                
                return (
                  <div key={idx} className={`battle-log-entry text-xs mb-1 ${logClass} ${isCurrent ? 'current-log' : ''}`}>
                    <div className="font-medium">{idx + 1}. {log.message}</div>
                    {log.formula && (
                      <div className="ml-4 text-gray-500 font-mono text-xs mt-1">
                        {log.formula}
                      </div>
                    )}
                    {log.comparison && (
                      <div className="ml-4 text-gray-600 font-mono text-xs mt-1 font-bold" style={{ fontWeight: 700 }}>
                        {log.comparison}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 승리 모달 (자동 진행 방지) */}
        {battleState === "victory" && !showLogReview && (
          <div className="victory-modal fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-60">
            <div className="bg-white p-8 rounded-lg shadow-xl text-center">
              {isQuestCleared ? (
                <>
                  <div className="text-5xl font-bold text-green-600 mb-4">Quest Cleared!</div>
                  <div className="text-2xl font-bold text-green-600 mb-6">WIN!</div>
                  <p className="text-gray-700 mb-6">{battleResult.reward || "Area 클리어!"}</p>
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={() => setShowLogReview(true)}
                      className="px-6 py-3 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 transition-colors"
                    >
                      Review Log
                    </button>
                    <button
                      onClick={() => {
                        if (onQuestClear) {
                          onQuestClear();
                        }
                        handleExit();
                      }}
                      className="px-6 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors"
                    >
                      Exit
                    </button>
                  </div>
                </>
              ) : battleType === 'sparring' ? (
                <>
                  <div className="text-4xl font-bold text-green-600 mb-4">WIN!</div>
                  <p className="text-gray-700 mb-6">Practice Match Completed!</p>
                  <div className="flex gap-4 justify-center flex-wrap">
                    <button
                      onClick={() => setShowLogReview(true)}
                      className="px-6 py-3 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 transition-colors"
                    >
                      Review Log
                    </button>
                    <button
                      onClick={handleExit}
                      className="px-6 py-3 bg-gray-500 text-white rounded-lg font-bold hover:bg-gray-600 transition-colors"
                    >
                      Return to Menu
                    </button>
                  </div>
                </>
              ) : battleType === 'arena' ? (
                <>
                  <div className="text-4xl font-bold text-green-600 mb-4">WIN!</div>
                  <p className="text-gray-700 mb-4">Rank Updated!</p>
                  <p className="text-sm text-gray-600 mb-6">Arena 전투에서 승리했습니다!</p>
                  <div className="flex gap-4 justify-center flex-wrap">
                    <button
                      onClick={() => setShowLogReview(true)}
                      className="px-6 py-3 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 transition-colors"
                    >
                      Review Log
                    </button>
                    <button
                      onClick={handleExit}
                      className="px-6 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors"
                    >
                      Return to Arena
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-4xl font-bold text-green-600 mb-4">WIN!</div>
                  <p className="text-gray-700 mb-6">다음 라운드로 진행하시겠습니까?</p>
                  <div className="flex gap-4 justify-center flex-wrap">
                    <button
                      onClick={() => setShowLogReview(true)}
                      className="px-6 py-3 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 transition-colors"
                    >
                      Review Log
                    </button>
                    <button
                      onClick={handleNextBattle}
                      className="px-6 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors"
                    >
                      Next Battle
                    </button>
                    <button
                      onClick={handleExit}
                      className="px-6 py-3 bg-gray-500 text-white rounded-lg font-bold hover:bg-gray-600 transition-colors"
                    >
                      Exit
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 로그 리뷰 화면 */}
        {battleState === "victory" && showLogReview && battleResult?.logs && (
          <div className="victory-modal fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-60">
            <div className="bg-white p-8 rounded-lg shadow-xl text-center" style={{ maxWidth: "800px", maxHeight: "80vh", overflowY: "auto" }}>
              <h2 className="text-2xl font-bold mb-4">전투 로그 리뷰</h2>
              <div className="battle-log-review bg-gray-100 p-4 rounded max-h-96 overflow-y-auto mb-4">
                {battleResult.logs.map((log, idx) => {
                  // 로그 컬러링 클래스 결정
                  const logClass = log.attacker === "user" 
                    ? (log.hit ? "user-hit" : "user-miss")
                    : (log.hit ? "enemy-hit" : "enemy-miss");
                  
                  return (
                    <div key={idx} className={`battle-log-entry text-sm mb-2 p-2 rounded ${logClass}`}>
                      <div className="font-bold">{idx + 1}. {log.message}</div>
                      {log.formula && (
                        <div className="ml-4 text-gray-700 font-mono text-xs mt-1">
                          {log.formula}
                        </div>
                      )}
                      {log.comparison && (
                        <div className="ml-4 text-gray-600 font-mono text-xs mt-1 font-bold" style={{ fontWeight: 700 }}>
                          {log.comparison}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => setShowLogReview(false)}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg font-bold hover:bg-gray-600 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* 패배 결과 화면 */}
        {battleState === "result" && !showLogReview && (
          <div className="battle-result text-center">
            <div className="text-4xl font-bold text-red-600 mb-4">LOSE...</div>
            {battleType === 'arena' && (
              <p className="text-gray-700 mb-4">Rank Updated!</p>
            )}
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setShowLogReview(true)}
                className="px-6 py-3 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 transition-colors"
              >
                Review Log
              </button>
              <button
                onClick={handleDefeat}
                className={`px-6 py-3 rounded-lg font-bold transition-colors ${
                  battleType === 'arena'
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                {battleType === 'arena' ? 'Return to Arena' : '돌아가기'}
              </button>
            </div>
          </div>
        )}

        {/* 패배 로그 리뷰 화면 */}
        {battleState === "result" && showLogReview && battleResult?.logs && (
          <div className="victory-modal fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-60">
            <div className="bg-white p-8 rounded-lg shadow-xl text-center" style={{ maxWidth: "800px", maxHeight: "80vh", overflowY: "auto" }}>
              <h2 className="text-2xl font-bold mb-4">전투 로그 리뷰</h2>
              <div className="battle-log-review bg-gray-100 p-4 rounded max-h-96 overflow-y-auto mb-4">
                {battleResult.logs.map((log, idx) => {
                  // 로그 컬러링 클래스 결정
                  const logClass = log.attacker === "user" 
                    ? (log.hit ? "user-hit" : "user-miss")
                    : (log.hit ? "enemy-hit" : "enemy-miss");
                  
                  return (
                    <div key={idx} className={`battle-log-entry text-sm mb-2 p-2 rounded ${logClass}`}>
                      <div className="font-bold">{idx + 1}. {log.message}</div>
                      {log.formula && (
                        <div className="ml-4 text-gray-700 font-mono text-xs mt-1">
                          {log.formula}
                        </div>
                      )}
                      {log.comparison && (
                        <div className="ml-4 text-gray-600 font-mono text-xs mt-1 font-bold" style={{ fontWeight: 700 }}>
                          {log.comparison}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => setShowLogReview(false)}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg font-bold hover:bg-gray-600 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* 닫기 버튼 (결과 화면이 아닐 때만) */}
        {battleState !== "result" && battleState !== "victory" && (
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            중단
          </button>
        )}
      </div>
    </div>
  );
}
