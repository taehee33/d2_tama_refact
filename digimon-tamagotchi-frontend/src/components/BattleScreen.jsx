// src/components/BattleScreen.jsx
// 턴제 전투 화면 및 애니메이션 (발사체 방식)

import React, { useState, useEffect, useRef } from "react";
import { playQuestRound } from "../logic/battle/questEngine";
import { simulateBattle } from "../logic/battle/calculator";
import { getAttributeBonus } from "../logic/battle/types";
import { digimonDataVer1 as newDigimonDataVer1 } from "../data/v1/digimons";
import { digimonDataVer2 } from "../data/v2modkor";
import { getQuestArea } from "../data/v1/quests";
import { getQuestAreaVer2 } from "../data/v2modkor/quests";
import { calculatePower } from "../logic/battle/hitrate";
import { BATTLE_CARD_BY_ID } from "../data/battleCards";
import "../styles/Battle.css";

// 타격 이펙트는 이제 텍스트로 표시되므로 스프라이트 경로는 더 이상 필요 없음

export default function BattleScreen({
  userDigimon,
  userStats,
  userSlotName,
  userDigimonNickname,
  areaId,
  roundIndex,
  questVersion = "Ver.1",
  battleType,
  sparringEnemySlot,
  arenaChallenger,
  realtimeBattleResult,
  realtimeDeckBattle,
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
  const [showUserPowerDetails, setShowUserPowerDetails] = useState(false); // 유저 파워 상세 정보 표시 여부
  const [showEnemyPowerDetails, setShowEnemyPowerDetails] = useState(false); // 상대방 파워 상세 정보 표시 여부
  const [showBattleGuide, setShowBattleGuide] = useState(false); // 배틀 가이드 표시 여부
  const [deckChoiceRemainingSec, setDeckChoiceRemainingSec] = useState(null);
  /** 덱 배틀: 이번 라운드에서 내가 선택한 카드의 인덱스(remainingCards 기준) — 같은 종류 여러 장 구분용 */
  const [selectedCardIndexForCurrentRound, setSelectedCardIndexForCurrentRound] = useState(null);
  /** 덱 배틀: 확인 버튼으로 선택을 전송했는지 (중복 전송 방지) */
  const [choiceSentForCurrentRound, setChoiceSentForCurrentRound] = useState(false);
  // Start를 누르기 전까지는 상대방 정보를 숨김
  const hideEnemyInfo = !hasRoundStarted;

  // 덱 배틀: 제한시간 초 단위 갱신
  useEffect(() => {
    if (battleType !== 'realtime' || !realtimeDeckBattle?.choiceTimeoutAt) {
      setDeckChoiceRemainingSec(null);
      return;
    }
    const tick = () => {
      const remain = Math.max(0, Math.ceil((realtimeDeckBattle.choiceTimeoutAt - Date.now()) / 1000));
      setDeckChoiceRemainingSec(remain);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [battleType, realtimeDeckBattle?.choiceTimeoutAt]);

  // 덱 배틀: 라운드가 끝나면 선택 카드·전송 완료 표시 초기화
  useEffect(() => {
    if (battleType !== 'realtime' || !realtimeDeckBattle) return;
    if (realtimeDeckBattle.pendingChoiceRoundIndex == null) {
      setSelectedCardIndexForCurrentRound(null);
      setChoiceSentForCurrentRound(false);
    }
  }, [battleType, realtimeDeckBattle?.pendingChoiceRoundIndex, realtimeDeckBattle]);

  // 발사체 및 이펙트 상태
  const [projectile, setProjectile] = useState(null); // { type: "user" | "enemy", sprite: number }
  const [hitText, setHitText] = useState(null); // { target: "user" | "enemy" } - 타격 텍스트
  const [missText, setMissText] = useState(null); // { target: "user" | "enemy" }
  
  const userDigimonRef = useRef(null);
  const userDigimonImgRef = useRef(null);
  const enemyDigimonRef = useRef(null);
  const enemyDigimonImgRef = useRef(null);
  const battleAreaRef = useRef(null);

  // 실시간 배틀: 참가 시 선택한 슬롯 디지몬(스냅샷)으로 표시·판정
  const mySnap = realtimeBattleResult?.mySnapshot;
  const effectiveUserDigimon = (battleType === 'realtime' && mySnap) ? { id: mySnap.digimonId, name: mySnap.digimonName, stats: mySnap.stats || {}, sprite: mySnap.sprite, spriteBasePath: mySnap.spriteBasePath } : userDigimon;
  const effectiveUserStats = (battleType === 'realtime' && mySnap) ? (mySnap.stats || {}) : userStats;
  const effectiveUserSlotName = (battleType === 'realtime' && mySnap?.slotName) ? mySnap.slotName : userSlotName;
  const effectiveUserDigimonNickname = (battleType === 'realtime' && mySnap) ? (mySnap.digimonNickname || null) : userDigimonNickname;

  // 모달이 열렸을 때 배경 스크롤 방지
  useEffect(() => {
    // 컴포넌트가 마운트될 때 body 스크롤 막기
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    // 컴포넌트가 언마운트될 때 원래대로 복구
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // 배틀 시작 시 적 데이터 가져오기 및 배틀 실행
  // roundIndex가 변경되면 새로운 배틀 시작
  useEffect(() => {
    // roundIndex가 변경되면 battleState를 loading으로 리셋
    setBattleState("loading");
  }, [areaId, roundIndex]);

  useEffect(() => {
    if (battleState === "loading") {
      // 실시간 배틀 진행 중(결과 미도착): playQuestRound/simulateBattle 실행 금지, 빈 상태로 ready만 설정
      if (battleType === 'realtime' && !realtimeBattleResult) {
        setBattleResult(null);
        setEnemyData(null);
        setCurrentLogIndex(0);
        setUserHits(0);
        setEnemyHits(0);
        setBattleState("ready");
        return;
      }

      let result;

      if (battleType === 'realtime' && realtimeBattleResult) {
        const { room, isHost, battleLog, userHits: uh, enemyHits: eh, battleWinner: winner } = realtimeBattleResult;
        const enemySnap = isHost ? room?.guestDigimonSnapshot : room?.hostDigimonSnapshot;
        const enemyTamerName = isHost ? room?.guestTamerName : room?.hostTamerName;
        // winner가 null이면 배틀 진행 중 → win을 null로 두어 LOSE/승리 모달이 뜨지 않게 함
        const resolvedWin = winner == null ? null : ((winner === 'host' && isHost) || (winner === 'guest' && !isHost));
        result = {
          win: resolvedWin,
          logs: battleLog || [],
          enemy: enemySnap ? {
            name: enemySnap.digimonName || enemySnap.digimonId,
            power: enemySnap.stats?.power ?? 0,
            attribute: enemySnap.stats?.type ?? null,
            isBoss: false,
            tamerName: enemyTamerName || '상대',
            trainerName: enemyTamerName || '상대',
            sprite: enemySnap.sprite ?? 0,
            spriteBasePath: enemySnap.spriteBasePath || null,
            attackSprite: enemySnap.stats?.attackSprite ?? enemySnap.sprite ?? 0,
            digimonId: enemySnap.digimonId || enemySnap.digimonName,
            digimonNickname: enemySnap.digimonNickname || null,
          } : null,
          isAreaClear: false,
          reward: null,
          rounds: (battleLog || []).length,
          userHits: uh ?? 0,
          enemyHits: eh ?? 0,
        };
      } else if (battleType === 'sparring' && sparringEnemySlot) {
        // Sparring 모드: 상대 슬롯 버전에 따라 v1/v2 디지몬 데이터 사용 (v1에 없으면 v2 시도)
        const id = sparringEnemySlot.selectedDigimon;
        const fromV1 = newDigimonDataVer1[id];
        const fromV2 = digimonDataVer2[id];
        const enemyDigimonData = (sparringEnemySlot.version === "Ver.2" ? (fromV2 || fromV1) : (fromV1 || fromV2)) || {
          id,
          name: sparringEnemySlot.selectedDigimon,
          stats: {},
        };
        
        // 저장된 power가 0이면 계산 사용 (스파링 상대 파워가 0으로 보이지 않도록)
        const savedPower = sparringEnemySlot.digimonStats?.power;
        const enemyPower = (savedPower != null && savedPower > 0)
          ? savedPower
          : (calculatePower(sparringEnemySlot.digimonStats || {}, enemyDigimonData) || enemyDigimonData?.stats?.basePower || 0);
        
        const enemyStats = {
          power: enemyPower,
          type: enemyDigimonData.stats?.type || null,
        };
        
        // 배틀 시뮬레이션 (디지몬 별명 반영: 별명(디지몬명) 형식)
        const userDigimonName = userDigimon.name || userDigimon.id || "Unknown";
        const enemyDigimonName = enemyDigimonData.name || enemyDigimonData.id || "Unknown";
        // 유저 디지몬 별명이 있으면 "별명(디지몬명)", 없으면 "디지몬명"
        const userDisplayName = userDigimonNickname && userDigimonNickname.trim()
          ? `${userDigimonNickname}(${userDigimonName})`
          : userDigimonName;
        const userName = userSlotName 
          ? `${userSlotName}의 ${userDisplayName}`
          : userDisplayName;
        // 스파링 모드에서는 항상 상대 디지몬명 앞에 (Ghost) 추가
        // 적 디지몬 별명이 있으면 "별명(디지몬명)", 없으면 "디지몬명"
        const enemyDisplayName = sparringEnemySlot?.digimonNickname && sparringEnemySlot.digimonNickname.trim()
          ? `${sparringEnemySlot.digimonNickname}(${enemyDigimonName})`
          : enemyDigimonName;
        const enemyName = sparringEnemySlot?.slotName
          ? `(Ghost) ${sparringEnemySlot.slotName}의 ${enemyDisplayName}`
          : `(Ghost) ${enemyDisplayName}`;
        
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
            name: `(Ghost) ${enemyDisplayName}`,
            power: enemyPower,
            attribute: enemyStats.type,
            isBoss: false,
            slotName: sparringEnemySlot.slotName,
            sprite: enemyDigimonData?.sprite ?? 0,
            spriteBasePath: enemyDigimonData?.spriteBasePath || null,
            attackSprite: enemyDigimonData?.stats?.attackSprite ?? enemyDigimonData?.sprite ?? 0,
            digimonId: enemyDigimonData?.id || sparringEnemySlot.selectedDigimon,
            digimonNickname: sparringEnemySlot.digimonNickname || null,
          },
          isAreaClear: false,
          reward: null,
          rounds: battleResult.rounds,
          userHits: battleResult.userHits,
          enemyHits: battleResult.enemyHits,
          userPower: battleResult.userPower,
          userPowerDetails: battleResult.userPowerDetails,
        };
      } else if (battleType === 'arena' && arenaChallenger) {
        // Arena 모드: arenaChallenger 데이터 사용
        const enemyDigimonData = newDigimonDataVer1[arenaChallenger.digimonSnapshot.digimonId] || {
          id: arenaChallenger.digimonSnapshot.digimonId,
          name: arenaChallenger.digimonSnapshot.digimonName,
          stats: arenaChallenger.digimonSnapshot.stats,
        };

        // Power 계산: snapshot에 power가 있으면 사용, 없으면 basePower 사용
        const snapshotPower = arenaChallenger.digimonSnapshot.stats?.power;
        const calculatedEnemyPower = snapshotPower !== undefined && snapshotPower !== null && snapshotPower !== 0
          ? snapshotPower
          : enemyDigimonData.stats?.basePower || 0;

        // 디버깅: 상대방 Power 값 확인
        console.log("🔍 [BattleScreen] 상대방 Power 디버깅:", {
          digimonId: arenaChallenger.digimonSnapshot.digimonId,
          digimonName: arenaChallenger.digimonSnapshot.digimonName,
          snapshotStats: arenaChallenger.digimonSnapshot.stats,
          powerFromSnapshot: snapshotPower,
          basePowerFromData: enemyDigimonData.stats?.basePower,
          finalPower: calculatedEnemyPower,
        });

        const enemyStats = {
          power: calculatedEnemyPower,
          type: arenaChallenger.digimonSnapshot.stats?.type || null,
        };

        const userDigimonName = userDigimon.name || userDigimon.id || "Unknown";
        // 유저 디지몬 별명이 있으면 "별명(디지몬명)", 없으면 "디지몬명"
        const userDisplayName = userDigimonNickname && userDigimonNickname.trim()
          ? `${userDigimonNickname}(${userDigimonName})`
          : userDigimonName;
        const userName = userSlotName
          ? `${userSlotName}의 ${userDisplayName}`
          : userDisplayName;
        // 적 디지몬 별명이 있으면 "별명(디지몬명)", 없으면 "디지몬명"
        const enemyDigimonName = enemyDigimonData.name || enemyDigimonData.id;
        const enemyDigimonNickname = arenaChallenger.digimonSnapshot?.digimonNickname;
        const enemyDisplayName = enemyDigimonNickname && enemyDigimonNickname.trim()
          ? `${enemyDigimonNickname}(${enemyDigimonName})`
          : enemyDigimonName;
        const enemyName = `${arenaChallenger.tamerName || arenaChallenger.trainerName || 'Unknown'}의 ${enemyDisplayName}`;

        const battleResult = simulateBattle(
          userDigimon,
          userStats,
          enemyDigimonData,
          enemyStats,
          userName,
          enemyName
        );

        const snap = arenaChallenger.digimonSnapshot;
        result = {
          win: battleResult.won,
          logs: battleResult.log,
          enemy: {
            name: enemyDigimonData.name || enemyDigimonData.id,
            power: calculatedEnemyPower,
            attribute: enemyStats.type,
            isBoss: false,
            tamerName: arenaChallenger.tamerName || arenaChallenger.trainerName || 'Unknown',
            trainerName: arenaChallenger.tamerName || arenaChallenger.trainerName || 'Unknown',
            sprite: snap?.sprite ?? enemyDigimonData.sprite ?? 0,
            spriteBasePath: snap?.spriteBasePath || null,
            attackSprite: snap?.stats?.attackSprite ?? enemyDigimonData.stats?.attackSprite ?? enemyDigimonData.sprite ?? 0,
            digimonId: enemyDigimonData.id || snap?.digimonId,
            digimonNickname: snap?.digimonNickname || null,
          },
          isAreaClear: false,
          reward: null,
          rounds: battleResult.rounds,
          userHits: battleResult.userHits,
          enemyHits: battleResult.enemyHits,
          userPower: battleResult.userPower,
          userPowerDetails: battleResult.userPowerDetails,
        };
      } else {
        // Quest 모드: 버전에 따라 Ver.1/Ver.2 퀘스트 데이터 사용
        result = playQuestRound(userDigimon, userStats, areaId, roundIndex, questVersion);
      }
      
      setBattleResult(result);
      setEnemyData(result.enemy);
      setCurrentLogIndex(0);
      // 로그를 순차 재생하는 모드(아레나/스파링/퀘스트 등)는 히트를 0으로 시작하고, 로그 재생 시 공격 성공할 때만 증가시킴
      const hasLogs = result.logs && result.logs.length > 0;
      setUserHits(hasLogs ? 0 : (result.userHits ?? 0));
      setEnemyHits(hasLogs ? 0 : (result.enemyHits ?? 0));
      setProjectile(null);
      setHitText(null);
      setMissText(null);

      // 실시간 배틀 진행 중(winner null): 준비 모달 없이 바로 배틀 화면 → 카드 선택 대기
      if (battleType === 'realtime' && result.win == null) {
        setShowReadyModal(false);
        setHasRoundStarted(true);
        setBattleState("playing");
      } else {
        // 라운드 준비 모달 표시
        setShowReadyModal(true);
        setHasRoundStarted(false);
        setBattleState("ready");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleState, userDigimon, userStats, areaId, roundIndex, questVersion, battleType, sparringEnemySlot, arenaChallenger, realtimeBattleResult]);

  // 실시간 배틀: realtimeBattleResult 갱신 시 로그/히트 반영, battleWinner 시 결과 화면 전환
  useEffect(() => {
    if (battleType !== 'realtime' || !realtimeBattleResult) return;
    const { battleLog: logs, userHits: uh, enemyHits: eh, battleWinner: winner, isHost } = realtimeBattleResult;
    setBattleResult((prev) =>
      prev
        ? {
            ...prev,
            logs: logs ?? prev.logs ?? [],
            userHits: uh ?? prev.userHits ?? 0,
            enemyHits: eh ?? prev.enemyHits ?? 0,
          }
        : null
    );
    setUserHits(uh ?? 0);
    setEnemyHits(eh ?? 0);
    if (winner != null && battleState !== 'victory' && battleState !== 'result') {
      const win = (winner === 'host' && isHost) || (winner === 'guest' && !isHost);
      setBattleResult((prev) => (prev ? { ...prev, win } : null));
      if (win) setBattleState('victory');
      else setBattleState('result'); // 패배
    }
  }, [battleType, realtimeBattleResult, battleState]);

  // 적 디지몬 데이터 가져오기 (퀘스트 버전에 따라 Ver.1/Ver.2 도감 사용)
  const getEnemyDigimonData = () => {
    if (!enemyData) return null;
    const isVer2 = questVersion === "Ver.2";
    const getArea = isVer2 ? getQuestAreaVer2 : getQuestArea;
    const digimonData = isVer2 ? digimonDataVer2 : newDigimonDataVer1;
    const questArea = getArea(areaId);
    if (questArea && questArea.enemies[roundIndex]) {
      const enemyId = questArea.enemies[roundIndex].enemyId;
      return digimonData[enemyId] || null;
    }
    return digimonData[enemyData.name] || null;
  };

  const enemyDigimonData = getEnemyDigimonData();
  const userDigimonData = newDigimonDataVer1[effectiveUserDigimon.id || effectiveUserDigimon.name] || effectiveUserDigimon;

  // 속성 정보 가져오기
  const userAttribute = userDigimonData?.stats?.type || effectiveUserStats.type || null;
  // 적 속성: enemyData.attribute (quest), enemyDigimonData.stats.type, 또는 battleResult에서 가져오기
  const enemyAttribute = enemyData?.attribute || enemyDigimonData?.stats?.type || null;
  
  // 속성 한글 변환
  const getAttributeName = (attr) => {
    if (!attr) return "없음";
    const attrMap = {
      "Vaccine": "백신",
      "Virus": "바이러스",
      "Data": "데이터",
      "Free": "프리"
    };
    return attrMap[attr] || attr;
  };
  
  // 상성 계산 (유저가 적에게 공격할 때)
  const userAttrBonus = getAttributeBonus(userAttribute, enemyAttribute);
  const getAttributeAdvantageText = (bonus) => {
    if (bonus > 0) return " (유리)";
    if (bonus < 0) return " (불리)";
    return "";
  };

  // 유저 파워 계산 (battleResult에서 상세 정보 가져오기)
  const userPower = battleResult?.userPower || effectiveUserStats.power || userDigimonData?.stats?.basePower || 0;
  const userPowerDetails = battleResult?.userPowerDetails || {
    basePower: userDigimonData?.stats?.basePower || 0,
    strengthBonus: 0,
    traitedEggBonus: 0,
    effortBonus: 0,
  };
  const enemyPower = enemyData?.power || battleResult?.enemyPower || 0;
  // 상대방 파워 상세 정보 (battleResult에서 가져오거나 기본값 사용)
  const enemyPowerDetails = battleResult?.enemyPowerDetails || {
    basePower: enemyDigimonData?.stats?.basePower || enemyData?.power || 0,
    strengthBonus: 0,
    traitedEggBonus: 0,
    effortBonus: 0,
  };

  // 퀘스트 클리어 여부 확인
  const isQuestCleared = battleResult?.isAreaClear || false;

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
          // 적 공격 발사체: 항상 Ver.1 공격 스프라이트 사용 (/images/ 경로와 호환)
          const enemyV1Data = newDigimonDataVer1[enemyData?.digimonId || enemyData?.name];
          const attackSprite = enemyV1Data?.stats?.attackSprite ?? enemyV1Data?.sprite ?? enemyDigimonData?.stats?.attackSprite ?? enemyDigimonData?.sprite ?? 0;
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
        // 모든 로그 재생 완료 - 승리/패배 확인 (실시간 진행 중이면 win이 null이므로 결과 전환 안 함)
        if (battleResult.win === true) {
          setBattleState("victory"); // 승리 모달 표시
        } else if (battleResult.win === false) {
          setBattleState("result"); // 패배 결과 표시
        }
        // win === null이면 배틀 진행 중(예: 덱 카드 선택 대기), 결과 화면으로 넘기지 않음
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleState, currentLogIndex, battleResult, userDigimonData, enemyDigimonData, hasRoundStarted]);

  // 다음 라운드 진행
  const handleNextBattle = () => {
    if (isQuestCleared) {
      // 퀘스트 클리어 시 마지막 승리도 배틀 기록에 남긴 뒤 onQuestClear 호출
      if (battleResult && onBattleComplete) {
        onBattleComplete(battleResult);
      }
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
    // Arena/퀘스트 모드: 결과가 있으면 배틀 기록 저장 후 종료
    if (battleResult && onBattleComplete) {
      if (battleType === 'arena') {
        console.log("🔍 [BattleScreen] Arena 모드 종료 - onBattleComplete 호출");
      }
      onBattleComplete(battleResult);
    }
    onClose();
  };

  // 재전투 (아레나 전용)
  const handleRematch = () => {
    console.log("🔍 [BattleScreen] 재전투 시작 - 상태 초기화");
    // 주의: onBattleComplete를 호출하지 않음 (재전투 시에는 결과 저장하지 않음)
    // 배틀 상태만 리셋하여 새로운 배틀 시작
    // 모든 배틀 관련 상태 초기화
    setShowLogReview(false);
    setCurrentLogIndex(0);
    setUserHits(0);
    setEnemyHits(0);
    setHasRoundStarted(false);
    setShowReadyModal(false);
    // 발사체 및 이펙트 상태도 초기화
    setProjectile(null);
    setHitText(null);
    setMissText(null);
    // battleResult는 나중에 useEffect에서 설정되므로 여기서는 null로 설정
    setBattleResult(null);
    // 마지막에 battleState를 "loading"으로 설정하여 useEffect가 다시 실행되도록 함
    // 이렇게 하면 useEffect의 의존성 배열에 battleState가 포함되어 있어서 다시 실행됨
    console.log("🔍 [BattleScreen] 재전투 - battleState를 loading으로 설정");
    setBattleState("loading");
  };

  // 패배 처리
  const handleDefeat = () => {
    // Arena/퀘스트 모드: 패배 결과를 배틀 기록에 저장
    if (battleResult && onBattleComplete) {
      if (battleType === 'arena') {
        console.log("🔍 [BattleScreen] Arena 모드 패배 - onBattleComplete 호출");
      }
      onBattleComplete(battleResult);
    }
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
    // Exit를 누르면 나가기 (상대방 정보는 이미 숨겨져 있음)
    onClose();
  };

  if (battleState === "loading") {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" style={{ paddingTop: '80px', paddingBottom: '20px', overflow: 'hidden' }}>
        <div className="text-white text-xl">배틀 준비 중...</div>
      </div>
    );
  }

  const showDeckChoice = battleType === 'realtime' && realtimeDeckBattle?.pendingChoiceRoundIndex != null && (realtimeDeckBattle.remainingCards?.length ?? 0) > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" style={{ paddingTop: '80px', paddingBottom: '80px', overflow: 'hidden' }}>
      {/* 덱 배틀: 카드 선택 (제한시간 내 미선택 시 자동 랜덤) */}
      {showDeckChoice && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-center mb-2">
              라운드 {realtimeDeckBattle.pendingChoiceRoundIndex} — 카드 선택
            </h3>
            <p className="text-center text-gray-600 mb-2">
              {deckChoiceRemainingSec != null && deckChoiceRemainingSec > 0
                ? `${deckChoiceRemainingSec}초 안에 선택하세요 (미선택 시 자동 선택)`
                : '선택 중…'}
            </p>
            {realtimeDeckBattle.opponentChoiceReceived && (
              <p className="text-center text-green-600 font-medium mb-4">상대방 선택 완료</p>
            )}

            {/* 사용된 카드 (이미 쓴 카드) */}
            {(realtimeDeckBattle.usedCardIds?.length ?? 0) > 0 && (
              <div className="mb-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">사용된 카드</div>
                <div className="flex flex-wrap gap-2">
                  {realtimeDeckBattle.usedCardIds.map((cardId, idx) => {
                    const meta = BATTLE_CARD_BY_ID[cardId];
                    return (
                      <span
                        key={`used-${cardId}-${idx}`}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gray-200 text-gray-600 text-sm font-medium border border-gray-300"
                      >
                        {meta?.nameKo || cardId} <span className="ml-1 text-gray-400">(라운드 {idx + 1})</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 사용 가능 카드 (이번 라운드에서 고를 수 있는 카드) — 같은 종류여도 장수만큼만 표시, 한 장만 선택 표시 */}
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">사용 가능 카드</div>
              <div className="flex flex-wrap gap-3 justify-center">
                {(realtimeDeckBattle.remainingCards || []).map((cardId, idx) => {
                  const meta = BATTLE_CARD_BY_ID[cardId];
                  const isSelected = idx === selectedCardIndexForCurrentRound;
                  return (
                    <button
                      key={`remaining-${idx}-${cardId}`}
                      type="button"
                      onClick={() => setSelectedCardIndexForCurrentRound(idx)}
                      disabled={choiceSentForCurrentRound}
                      className={`px-4 py-3 rounded-lg font-medium border-2 transition-colors ${
                        isSelected
                          ? 'border-green-500 bg-green-100 text-green-800 ring-2 ring-green-400'
                          : 'border-indigo-500 bg-indigo-50 text-indigo-800 hover:bg-indigo-200'
                      } ${choiceSentForCurrentRound ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                      <span className="block">{meta?.nameKo || cardId}</span>
                      {isSelected && <span className="block text-xs font-bold text-green-600 mt-1">✓ 선택 카드</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                disabled={selectedCardIndexForCurrentRound == null || choiceSentForCurrentRound}
                onClick={() => {
                  if (selectedCardIndexForCurrentRound == null || choiceSentForCurrentRound) return;
                  const cardId = realtimeDeckBattle.remainingCards[selectedCardIndexForCurrentRound];
                  if (cardId) {
                    realtimeDeckBattle.sendChoice(cardId);
                    setChoiceSentForCurrentRound(true);
                  }
                }}
                className="px-6 py-3 rounded-lg font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 라운드 준비 모달 */}
      {showReadyModal && !hasRoundStarted && (
        <div className="round-ready-modal fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-70">
          <div className="bg-white p-8 rounded-lg shadow-xl text-center modal-mobile" style={{ minWidth: "400px" }}>
            <h2 className="text-4xl font-bold mb-2">
              {battleType === 'sparring' ? 'Sparring' : battleType === 'arena' ? 'Arena' : battleType === 'realtime' ? '실시간 배틀' : `Round ${roundIndex + 1}`}
            </h2>
            <p className="text-xl text-gray-700 mb-6">
              VS {hideEnemyInfo 
                ? "???" 
                : battleType === 'arena' && (enemyData?.tamerName || enemyData?.trainerName)
                ? `${enemyData.tamerName || enemyData.trainerName}의 ${enemyDigimonData?.name || enemyData?.name || "Unknown"}`
                : enemyDigimonData?.name || enemyData?.name || "Unknown"}
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
      
      <div className="battle-screen bg-white rounded-lg shadow-xl w-full max-w-4xl modal-mobile flex flex-col" style={{ maxHeight: 'calc(100vh - 160px)', height: 'auto' }}>
        {/* 스크롤 가능한 콘텐츠 영역 */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 pt-4 sm:pt-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 #f1f5f9' }}>
          {/* 라운드 정보 */}
          <div className="text-center mb-4 pb-3 border-b border-gray-200">
            <h2 className="text-2xl font-bold">
            {battleType === 'sparring'
              ? `Sparring - ${enemyDigimonData?.name || enemyData?.name || "Unknown"}`
              : battleType === 'arena'
              ? `Arena - ${enemyData.tamerName || enemyData.trainerName}의 ${enemyDigimonData?.name || enemyData?.name || "Unknown"}`
              : battleType === 'realtime'
              ? `실시간 배틀 - ${enemyDigimonData?.name || enemyData?.name || "Unknown"}`
              : `Round ${roundIndex + 1} - ${enemyDigimonData?.name || enemyData?.name || "Unknown"}`}
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
              {effectiveUserSlotName || "USER"}
            </div>
            <div
              ref={userDigimonRef}
              className="digimon-sprite player-digimon"
              style={{ position: "relative" }}
            >
              <img
                ref={userDigimonImgRef}
                src={`${(effectiveUserDigimon?.spriteBasePath || userDigimonData?.spriteBasePath) || "/images"}/${effectiveUserDigimon?.spriteBasePath ? (effectiveUserDigimon?.sprite ?? 0) : (userDigimonData?.sprite ?? effectiveUserDigimon?.sprite ?? 0)}.png`}
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
                <div className="hit-text">💀!HIT!💀</div>
              )}
              {/* MISS 텍스트 */}
              {missText?.target === "user" && (
                <div className="miss-text">MISS</div>
              )}
            </div>
            <div className="digimon-info mt-2">
              <p className="font-bold">
                {(() => {
                  const digimonName = userDigimonData?.name || "User";
                  if (effectiveUserDigimonNickname && effectiveUserDigimonNickname.trim()) {
                    return effectiveUserSlotName
                      ? `${effectiveUserSlotName}의 ${effectiveUserDigimonNickname}(${digimonName})`
                      : `${effectiveUserDigimonNickname}(${digimonName})`;
                  }
                  return effectiveUserSlotName
                    ? `${effectiveUserSlotName}의 ${digimonName}`
                    : digimonName;
                })()}
              </p>
              <p className="text-sm text-gray-600">
                속성: {getAttributeName(userAttribute)}
                {!hideEnemyInfo && enemyAttribute && (
                  <span className={userAttrBonus > 0 ? 'text-green-600 font-semibold' : userAttrBonus < 0 ? 'text-red-600 font-semibold' : ''}>
                    {getAttributeAdvantageText(userAttrBonus)}
                  </span>
                )}
              </p>
              <div className="flex items-center justify-center gap-2">
                <p>
                  Power: {userPower}
                  {(() => {
                    // 보너스 개수 계산
                    let bonusCount = 0;
                    if (userPowerDetails.strengthBonus > 0) bonusCount++;
                    if (userPowerDetails.traitedEggBonus > 0) bonusCount++;
                    if (userPowerDetails.effortBonus > 0) bonusCount++;
                    // 보너스가 있으면 ↑ 아이콘 표시
                    return bonusCount > 0 ? (
                      <span className="text-green-600 ml-1">
                        {Array(bonusCount).fill('↑').join('')}
                      </span>
                    ) : null;
                  })()}
                </p>
                <button
                  onClick={() => setShowUserPowerDetails(!showUserPowerDetails)}
                  className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded transition-colors flex items-center gap-1"
                  title="파워 계산 상세 보기"
                >
                  <span>상세</span>
                  <span>{showUserPowerDetails ? '▼' : '▶'}</span>
                </button>
              </div>
              {showUserPowerDetails && (
                <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                  <div className="font-semibold mb-1">파워 계산:</div>
                  <div className="space-y-1">
                    <div>Base Power: {userPowerDetails.basePower}</div>
                    <div className={userPowerDetails.strengthBonus > 0 ? 'font-bold text-green-600' : 'text-gray-500'}>
                      Strength 보너스: {userPowerDetails.strengthBonus > 0 ? `(+${userPowerDetails.strengthBonus}) ✅` : '0'}
                    </div>
                    <div className={userPowerDetails.traitedEggBonus > 0 ? 'font-bold text-green-600' : 'text-gray-500'}>
                      Traited Egg 보너스: {userPowerDetails.traitedEggBonus > 0 ? `(+${userPowerDetails.traitedEggBonus}) ✅` : '0'}
                    </div>
                    <div className={userPowerDetails.effortBonus > 0 ? 'font-bold text-green-600' : 'text-gray-500'}>
                      Effort 보너스: {userPowerDetails.effortBonus > 0 ? `(+${userPowerDetails.effortBonus}) ✅` : '0'}
                    </div>
                    <div className="border-t pt-1 mt-1">
                      <div>
                        = {userPowerDetails.basePower} 
                        {userPowerDetails.strengthBonus > 0 && ` + (${userPowerDetails.strengthBonus})`}
                        {userPowerDetails.traitedEggBonus > 0 && ` + (${userPowerDetails.traitedEggBonus})`}
                        {userPowerDetails.effortBonus > 0 && ` + (${userPowerDetails.effortBonus})`}
                      </div>
                      <div className="font-bold mt-1">
                        = {userPower}
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                top: "calc(50% - 40px)", // 디지몬 스프라이트의 상단 부분에서 발사되도록 조정
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
              {hideEnemyInfo 
                ? "???"
                : battleType === 'sparring' && enemyData?.slotName 
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
                src={`${battleType === 'quest' ? (enemyDigimonData?.spriteBasePath || "/images") : (enemyData?.spriteBasePath || "/images")}/${hideEnemyInfo 
                  ? 0
                  : (battleType === 'sparring' && enemyData?.sprite !== undefined) 
                  ? enemyData.sprite 
                  : (battleType === 'arena' && enemyData?.sprite !== undefined)
                  ? enemyData.sprite
                  : (enemyDigimonData?.sprite ?? enemyData?.sprite ?? 0)}.png`}
                alt={hideEnemyInfo ? "???" : (enemyData?.name || "Enemy Digimon")}
                className={projectile?.type === "enemy" ? "animate-attack-cpu" : ""}
                style={{
                  imageRendering: "pixelated",
                  width: "120px",
                  height: "120px",
                  opacity: hideEnemyInfo ? 0.3 : 1, // 숨길 때 반투명 처리
                }}
              />
              {/* HIT! 텍스트 */}
              {hitText?.target === "enemy" && (
                <div className="hit-text">💀!HIT!💀</div>
              )}
              {/* MISS 텍스트 */}
              {missText?.target === "enemy" && (
                <div className="miss-text">MISS</div>
              )}
            </div>
            <div className="digimon-info mt-2">
              <p className="font-bold">
                {hideEnemyInfo 
                  ? "???" 
                  : (() => {
                      if (battleType === 'arena' && (enemyData?.tamerName || enemyData?.trainerName)) {
                        const enemyDigimonName = enemyDigimonData?.name || enemyData?.name || "Unknown";
                        const enemyNickname = enemyData?.digimonNickname;
                        const enemyDisplayName = enemyNickname && enemyNickname.trim()
                          ? `${enemyNickname}(${enemyDigimonName})`
                          : enemyDigimonName;
                        return `${enemyData.tamerName || enemyData.trainerName}의 ${enemyDisplayName}`;
                      } else if (battleType === 'sparring' && enemyData?.digimonNickname) {
                        const enemyDigimonName = enemyDigimonData?.name || enemyData?.name || "Enemy";
                        const enemyNickname = enemyData.digimonNickname;
                        return enemyNickname && enemyNickname.trim()
                          ? `${enemyNickname}(${enemyDigimonName})`
                          : enemyDigimonName;
                      }
                      return enemyDigimonData?.name || enemyData?.name || "Enemy";
                    })()}
              </p>
              {!hideEnemyInfo && enemyAttribute && (
                <p className="text-sm text-gray-600">
                  속성: {getAttributeName(enemyAttribute)}
                </p>
              )}
              {hideEnemyInfo && (
                <p className="text-sm text-gray-600">속성: ???</p>
              )}
              <div className="flex items-center justify-center gap-2">
                <p>
                  Power: {hideEnemyInfo ? "??" : enemyPower}
                  {(() => {
                    // 보너스 개수 계산
                    let bonusCount = 0;
                    if (enemyPowerDetails.strengthBonus > 0) bonusCount++;
                    if (enemyPowerDetails.traitedEggBonus > 0) bonusCount++;
                    if (enemyPowerDetails.effortBonus > 0) bonusCount++;
                    // 보너스가 있으면 ↑ 아이콘 표시
                    return !hideEnemyInfo && bonusCount > 0 ? (
                      <span className="text-green-600 ml-1">
                        {Array(bonusCount).fill('↑').join('')}
                      </span>
                    ) : null;
                  })()}
                </p>
                {!hideEnemyInfo && (
                  <button
                    onClick={() => setShowEnemyPowerDetails(!showEnemyPowerDetails)}
                    className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded transition-colors flex items-center gap-1"
                    title="파워 계산 상세 보기"
                  >
                    <span>상세</span>
                    <span>{showEnemyPowerDetails ? '▼' : '▶'}</span>
                  </button>
                )}
              </div>
              {!hideEnemyInfo && showEnemyPowerDetails && (
                <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                  <div className="space-y-1">
                    <div>Base Power: {enemyPowerDetails.basePower}</div>
                    <div className={enemyPowerDetails.strengthBonus > 0 ? 'font-bold text-green-600' : 'text-gray-500'}>
                      Strength 보너스: {enemyPowerDetails.strengthBonus > 0 ? `(+${enemyPowerDetails.strengthBonus}) ✅` : '0'}
                    </div>
                    <div className={enemyPowerDetails.traitedEggBonus > 0 ? 'font-bold text-green-600' : 'text-gray-500'}>
                      Traited Egg 보너스: {enemyPowerDetails.traitedEggBonus > 0 ? `(+${enemyPowerDetails.traitedEggBonus}) ✅` : '0'}
                    </div>
                    <div className={enemyPowerDetails.effortBonus > 0 ? 'font-bold text-green-600' : 'text-gray-500'}>
                      Effort 보너스: {enemyPowerDetails.effortBonus > 0 ? `(+${enemyPowerDetails.effortBonus}) ✅` : '0'}
                    </div>
                    <div className="border-t pt-1 mt-1">
                      <div>
                        = {enemyPowerDetails.basePower} 
                        {enemyPowerDetails.strengthBonus > 0 && ` + (${enemyPowerDetails.strengthBonus})`}
                        {enemyPowerDetails.traitedEggBonus > 0 && ` + (${enemyPowerDetails.traitedEggBonus})`}
                        {enemyPowerDetails.effortBonus > 0 && ` + (${enemyPowerDetails.effortBonus})`}
                      </div>
                      <div className="font-bold mt-1">
                        = {enemyPower}
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
          <div className="battle-log-container mb-4 mt-4 pt-4 border-t border-gray-200">
            {/* 실시간 덱 배틀: 이번 라운드 선택 카드 — 내 카드 / 상대 카드 두 블록으로 구분 표시 */}
            {battleType === 'realtime' && realtimeDeckBattle?.lastRoundIndex != null && realtimeDeckBattle.lastRoundHostCardId != null && realtimeDeckBattle.lastRoundGuestCardId != null && (() => {
              const isHost = realtimeBattleResult?.isHost;
              const myCardId = isHost ? realtimeDeckBattle.lastRoundHostCardId : realtimeDeckBattle.lastRoundGuestCardId;
              const oppCardId = isHost ? realtimeDeckBattle.lastRoundGuestCardId : realtimeDeckBattle.lastRoundHostCardId;
              const myName = BATTLE_CARD_BY_ID[myCardId]?.nameKo ?? '?';
              const oppName = BATTLE_CARD_BY_ID[oppCardId]?.nameKo ?? '?';
              return (
                <div className="mb-4">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 text-center">라운드 {realtimeDeckBattle.lastRoundIndex} 선택 카드</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-lg border-2 border-indigo-300 bg-indigo-50 text-center">
                      <div className="text-xs font-bold text-indigo-600 mb-1">내 카드</div>
                      <div className="text-lg font-bold text-indigo-900">{myName}</div>
                    </div>
                    <div className="p-4 rounded-lg border-2 border-gray-300 bg-gray-100 text-center">
                      <div className="text-xs font-bold text-gray-600 mb-1">상대 카드</div>
                      <div className="text-lg font-bold text-gray-800">{oppName}</div>
                    </div>
                  </div>
                </div>
              );
            })()}
            {(() => {
              const currentLog = battleResult.logs[currentLogIndex];
              // 배틀 로그와 동일한 색상 로직 적용
              const logClass = currentLog 
                ? (currentLog.attacker === "user" 
                    ? (currentLog.hit ? "user-hit" : "user-miss")
                    : (currentLog.hit ? "enemy-hit" : "enemy-miss"))
                : "";
              
              return (
                <div className={`battle-log-entry text-center text-sm mb-2 p-2 rounded ${logClass}`}>
                  <strong>현재 턴:</strong> {currentLog?.message || "배틀 진행 중..."}
                </div>
              );
            })()}
            
            {/* 배틀 가이드 (아코디언) */}
            <div className="mb-3">
              <button
                onClick={() => setShowBattleGuide(!showBattleGuide)}
                className="w-full text-left flex items-center justify-between py-2 px-3 bg-blue-50 hover:bg-blue-100 rounded transition-colors text-xs font-bold"
              >
                <span>❓ 배틀가이드 상세 확인</span>
                <div className="flex items-center gap-1">
                  <span className="text-gray-600">{showBattleGuide ? '접기' : '펼치기'}</span>
                  <span className="text-gray-500">{showBattleGuide ? '▼' : '▶'}</span>
                </div>
              </button>
              {showBattleGuide && (
                <div className="mt-2 p-3 bg-blue-50 rounded text-xs">
                  {/* 배틀 로직 공식 */}
                  <div className="mb-3">
                    <div className="font-bold mb-1">📊 명중률 계산:</div>
                    <div className="font-mono bg-white p-2 rounded border">
                      명중률 = (내파워 × 100) ÷ (내파워 + 상대파워) + 속성보너스
                    </div>
                    <div className="mt-1 text-gray-600">
                      • 속성보너스: 유리 +5%, 불리 -5%, 무관 0%
                    </div>
                  </div>

                  {/* 주사위 메커니즘 */}
                  <div className="mb-3">
                    <div className="font-bold mb-1">🎲 주사위 메커니즘:</div>
                    <div className="bg-white p-2 rounded border space-y-2">
                      <div>
                        <div className="font-semibold text-purple-600 mb-1">1. 주사위 굴리기</div>
                        <div className="text-xs text-gray-700 ml-2">
                          • 0 ~ 100 사이의 랜덤 값 생성
                          <br />
                          • 예: 45.23, 78.91, 12.34 등
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-blue-600 mb-1">2. 명중 판정</div>
                        <div className="text-xs text-gray-700 ml-2">
                          • <span className="font-bold text-green-600">주사위 값 &lt; 명중률</span> → 명중 (HIT) 💀
                          <br />
                          • <span className="font-bold text-red-600">주사위 값 ≥ 명중률</span> → 미스 (MISS) ❌
                        </div>
                      </div>
                      <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                        <div className="font-semibold text-orange-600 mb-1">📌 예시:</div>
                        <div className="text-xs text-gray-700">
                          명중률: <span className="font-mono">67.5%</span>
                          <br />
                          주사위: <span className="font-mono">45.23</span> → <span className="text-green-600 font-bold">45.23 &lt; 67.5</span> → <span className="text-green-600 font-bold">명중! 💀</span>
                          <br />
                          주사위: <span className="font-mono">78.91</span> → <span className="text-red-600 font-bold">78.91 ≥ 67.5</span> → <span className="text-red-600 font-bold">미스... ❌</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* 속성 상성 가이드 */}
                  <div>
                    <div className="font-bold mb-2">속성 상성 가이드:</div>
                    <div className="space-y-2">
                      <div className="bg-white p-2 rounded border">
                        <div className="font-semibold text-green-600 mb-1">백신 (Vaccine)</div>
                        <div className="text-xs">
                          <span className="text-green-600">✓ 유리:</span> 바이러스 (+5%)
                          <br />
                          <span className="text-red-600">✗ 불리:</span> 데이터 (-5%)
                        </div>
                      </div>
                      
                      <div className="bg-white p-2 rounded border">
                        <div className="font-semibold text-red-600 mb-1">바이러스 (Virus)</div>
                        <div className="text-xs">
                          <span className="text-green-600">✓ 유리:</span> 데이터 (+5%)
                          <br />
                          <span className="text-red-600">✗ 불리:</span> 백신 (-5%)
                        </div>
                      </div>
                      
                      <div className="bg-white p-2 rounded border">
                        <div className="font-semibold text-blue-600 mb-1">데이터 (Data)</div>
                        <div className="text-xs">
                          <span className="text-green-600">✓ 유리:</span> 백신 (+5%)
                          <br />
                          <span className="text-red-600">✗ 불리:</span> 바이러스 (-5%)
                        </div>
                      </div>
                      
                      <div className="bg-white p-2 rounded border">
                        <div className="font-semibold text-gray-600 mb-1">프리 (Free)</div>
                        <div className="text-xs text-gray-500">상성 없음 (0%)</div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-600 italic">
                      💡 백신 → 바이러스 → 데이터 → 백신 (삼각 상성)
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* 배틀 로직 섹션 */}
            {battleResult.logs[currentLogIndex] && (() => {
              const currentLog = battleResult.logs[currentLogIndex];
              // 배틀 로그와 동일한 색상 로직 적용
              const logClass = currentLog.attacker === "user" 
                ? (currentLog.hit ? "user-hit" : "user-miss")
                : (currentLog.hit ? "enemy-hit" : "enemy-miss");
              
              // 공격자 정보
              const attackerName = currentLog.attacker === "user" 
                ? (effectiveUserSlotName ? `${effectiveUserSlotName}의 ${effectiveUserDigimonNickname || effectiveUserDigimon.name || "내"}` : "내")
                : (enemyData?.tamerName || enemyData?.trainerName || enemyData?.name || "상대");
              const attackLabel = currentLog.attacker === "user" ? "내 공격" : "상대 공격";
              
              // 명중률과 주사위 값 추출
              const hitRate = parseFloat(currentLog.hitRate || 0);
              const roll = parseFloat(currentLog.roll || 0);
              const isHit = currentLog.hit;
              
              return (
                <div className="battle-logic-section bg-gray-100 p-3 rounded mb-2">
                  <div className="text-xs font-bold mb-2">배틀 로직 :</div>
                  <div className={`battle-log-entry ${logClass} p-2 rounded`}>
                    {/* 공격자 정보 */}
                    <div className="text-xs font-bold mb-2 text-gray-800">
                      {attackLabel} ({attackerName})
                    </div>
                    
                    {currentLog.formula && (
                      <div className="mb-2">
                        <div className="text-xs font-semibold mb-1">📊 명중률 계산 과정:</div>
                        <div className="text-xs font-mono">
                          {currentLog.formula}
                        </div>
                      </div>
                    )}
                    {currentLog.roll !== undefined && (
                      <div className="mb-2">
                        <div className="text-xs font-semibold mb-1">🎲 주사위 결과:</div>
                        <div className="text-xs font-mono mb-1">
                          Rolled: {currentLog.roll} {currentLog.hit ? "(Hit!)" : "(Miss)"}
                        </div>
                        {/* 판정 결과 */}
                        <div className={`text-xs font-bold mt-1 p-1 rounded ${
                          isHit 
                            ? "bg-green-100 text-green-700" 
                            : "bg-red-100 text-red-700"
                        }`}>
                          {isHit ? (
                            <>명중률({hitRate.toFixed(2)}%) &gt; 주사위({roll.toFixed(2)}) =&gt; <span className="text-green-700">공격 성공! 💀</span></>
                          ) : (
                            <>명중률({hitRate.toFixed(2)}%) ≤ 주사위({roll.toFixed(2)}) =&gt; <span className="text-red-700">빗나감... ❌</span></>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
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
          <div className="victory-modal fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]" style={{ paddingTop: '80px', paddingBottom: '80px' }}>
            <div className="bg-white rounded-lg shadow-xl text-center modal-mobile w-full max-w-md mx-4 p-6 sm:p-8">
              {isQuestCleared ? (
                <>
                  <div className="text-5xl font-bold text-green-600 mb-4">Quest Cleared!</div>
                  <div className="text-2xl font-bold text-green-600 mb-6">WIN!</div>
                  <p className="text-gray-700 mb-6">{battleResult.reward || "Area 클리어!"}</p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => setShowLogReview(true)}
                      className="px-6 py-3 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 transition-colors text-base min-h-[44px]"
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
                      className="px-6 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors text-base min-h-[44px]"
                    >
                      Exit
                    </button>
                  </div>
                </>
              ) : battleType === 'sparring' ? (
                <>
                  <div className="text-4xl font-bold text-green-600 mb-4">WIN!</div>
                  <p className="text-gray-700 mb-6">Practice Match Completed!</p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => setShowLogReview(true)}
                      className="px-6 py-3 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 transition-colors text-base min-h-[44px]"
                    >
                      Review Log
                    </button>
                    <button
                      onClick={handleExit}
                      className="px-6 py-3 bg-gray-500 text-white rounded-lg font-bold hover:bg-gray-600 transition-colors text-base min-h-[44px]"
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
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => setShowLogReview(true)}
                      className="px-6 py-3 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 transition-colors text-base min-h-[44px]"
                    >
                      Review Log
                    </button>
                    <button
                      onClick={handleRematch}
                      className="px-6 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors text-base min-h-[44px]"
                    >
                      재전투
                    </button>
                    <button
                      onClick={handleExit}
                      className="px-6 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors text-base min-h-[44px]"
                    >
                      Return to Arena
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-4xl font-bold text-green-600 mb-4">WIN!</div>
                  <p className="text-gray-700 mb-6">다음 라운드로 진행하시겠습니까?</p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
                    <button
                      onClick={() => setShowLogReview(true)}
                      className="px-6 py-3 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 transition-colors text-base min-h-[44px]"
                    >
                      Review Log
                    </button>
                    <button
                      onClick={handleNextBattle}
                      className="px-6 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors text-base min-h-[44px]"
                    >
                      Next Battle
                    </button>
                    <button
                      onClick={handleExit}
                      className="px-6 py-3 bg-gray-500 text-white rounded-lg font-bold hover:bg-gray-600 transition-colors text-base min-h-[44px]"
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
          <div className="victory-modal fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]" style={{ paddingTop: '80px', paddingBottom: '80px' }}>
            <div className="bg-white rounded-lg shadow-xl text-center modal-mobile w-full max-w-md mx-4 p-6 sm:p-8" style={{ maxHeight: "calc(100vh - 160px)", overflowY: "auto" }}>
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
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]" style={{ paddingTop: '80px', paddingBottom: '80px' }}>
            <div className="bg-white rounded-lg shadow-xl text-center modal-mobile w-full max-w-md mx-4 p-6 sm:p-8">
              <div className="battle-result text-center pb-4">
                <div className="text-3xl sm:text-4xl font-bold text-red-600 mb-4">LOSE...</div>
                {battleType === 'arena' && (
                  <p className="text-gray-700 mb-4">Rank Updated!</p>
                )}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => setShowLogReview(true)}
                    className="px-4 sm:px-6 py-3 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 transition-colors text-base min-h-[44px]"
                  >
                    Review Log
                  </button>
                  {battleType === 'arena' && (
                    <button
                      onClick={handleRematch}
                      className="px-4 sm:px-6 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors text-base min-h-[44px]"
                    >
                      재전투
                    </button>
                  )}
                  <button
                    onClick={handleDefeat}
                    className={`px-4 sm:px-6 py-3 rounded-lg font-bold transition-colors text-base min-h-[44px] ${
                      battleType === 'arena'
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-red-500 text-white hover:bg-red-600'
                    }`}
                  >
                    {battleType === 'arena' ? 'Return to Arena' : '돌아가기'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 패배 로그 리뷰 화면 */}
        {battleState === "result" && showLogReview && battleResult?.logs && (
          <div className="victory-modal fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]" style={{ paddingTop: '80px', paddingBottom: '80px' }}>
            <div className="bg-white rounded-lg shadow-xl text-center modal-mobile w-full max-w-md mx-4 p-6 sm:p-8" style={{ maxHeight: "calc(100vh - 160px)", overflowY: "auto" }}>
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

        </div>
        
        {/* 하단 고정 버튼 영역 */}
        {battleState !== "result" && battleState !== "victory" && (
          <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-3">
            <button
              onClick={onClose}
              className="w-full px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-bold text-base"
            >
              중단
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
