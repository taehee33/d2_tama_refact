// src/components/TrainPopup.jsx
import React, { useEffect, useState, useRef } from "react";
import { doVer1Training } from "../data/train_digitalmonstercolor25th_ver1";

// 6가지 패턴(문제에서 제시된 것) - 순서대로 ①~⑥
const defensePatterns = [
  ["U","D","U","D","D"], // 1번
  ["D","D","U","U","D"], // 2번
  ["D","U","U","D","D"], // 3번
  ["U","D","D","U","U"], // 4번
  ["D","U","D","U","D"], // 5번
  ["U","D","U","D","U"], // 6번
];

export default function TrainPopup({
  onClose,
  digimonStats,          // Game.jsx에서 props로 받음
  setDigimonStatsAndSave, // Game.jsx에서 props로 받음
  onTrainResult          // handleTrainResult 핸들러
}) {
  // phase: "ready" → "ing" (훈련 중)
  const [phase, setPhase] = useState("ready");       
  // 라운드 (1~5)
  const [round, setRound] = useState(1);            
  // 매 라운드 5초 제한
  const [timeLeft, setTimeLeft] = useState(5);      
  // 현재 라운드에서 공격 선택했나?
  const [hasChosen, setHasChosen] = useState(false); 

  // 각 라운드의 (round, attack, defend, isHit)를 쌓은 배열
  const [partialResults, setPartialResults] = useState([]); 
  // 최종 훈련 결과
  const [finalResult, setFinalResult] = useState(null);
  // 마지막 라운드 끝난 뒤, 최종 결과 보이기
  const [showFinal, setShowFinal] = useState(false); 
  // 훈련 전 스탯 (능력치 변화 계산용)
  const [beforeStats, setBeforeStats] = useState(null);
  // 라운드별 결과 스크롤 컨테이너 ref
  const resultsScrollRef = useRef(null);

  // 이번 훈련에 사용할 방어 패턴 (길이=5)
  const [chosenPattern, setChosenPattern] = useState(null);

  // === (1) 훈련 시작 ===
  function startTrain() {
    // 훈련 시작 전 Weight와 Energy 체크
    const currentWeight = digimonStats.weight || 0;
    const currentEnergy = digimonStats.energy || 0;
    
    if (currentWeight <= 0) {
      alert("⚠️ 체중이 너무 낮습니다!\n🍖 Eat food to gain weight!");
      return;
    }
    
    if (currentEnergy <= 0) {
      alert("⚠️ 에너지가 부족합니다!\n💤 Sleep to restore Energy!");
      return;
    }
    
    // 1~6번 패턴 순환
    // -> trainings를 사용 (기존 stats에 누적)
    // -> 0이면 1번 패턴, 1이면 2번 패턴... 5면 6번 패턴, 6이면 다시 1번
    const tCount = digimonStats.trainings || 0;
    const patternIndex = tCount % 6; // 0~5
    const pattern = defensePatterns[patternIndex];

    // 선택한 패턴 설정
    setChosenPattern(pattern);

    // 훈련 전 스탯 저장 (능력치 변화 계산용)
    setBeforeStats({
      weight: digimonStats.weight || 0,
      energy: digimonStats.energy || 0,
      strength: digimonStats.strength || 0,
      effort: digimonStats.effort || 0,
    });

    // 상태 초기화
    setPhase("ing");
    setRound(1);
    setTimeLeft(5);
    setHasChosen(false);
    setPartialResults([]);
    setShowFinal(false);
    setFinalResult(null);
  }

  // 라운드 바뀔 때마다 timeLeft=5, hasChosen=false
  useEffect(() => {
    if (phase !== "ing") return;
    if (round > 5) return;
    setTimeLeft(5);
    setHasChosen(false);
  }, [phase, round]);

  // 라운드별 결과가 추가될 때마다 스크롤을 맨 아래로 이동
  useEffect(() => {
    if (resultsScrollRef.current && partialResults.length > 0) {
      // 약간의 지연을 두어 DOM 업데이트 후 스크롤
      setTimeout(() => {
        if (resultsScrollRef.current) {
          resultsScrollRef.current.scrollTop = resultsScrollRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [partialResults]);

  // (2) 1초 타이머
  useEffect(() => {
    if (phase !== "ing") return;
    if (round > 5) return;

    if (timeLeft <= 0) {
      // 5초 시간 끝, 아직 공격 선택X => 랜덤 "U" or "D"
      if (!hasChosen) {
        const dir = Math.random() < 0.5 ? "U" : "D";
        doSelectAttack(dir);
      }
      return;
    }
    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, phase, round, hasChosen]);

  // (3) 공격 선택
  function doSelectAttack(attackDir) {
    if (phase !== "ing") return;
    if (round > 5) return;      // 이미 끝
    if (hasChosen) return;      // 이미 선택됨

    setHasChosen(true);

    if (!chosenPattern) {
      console.error("훈련 패턴이 없습니다!");
      return;
    }
    // 라운드별 방어패턴
    const defend = chosenPattern[round - 1]; 
    const isHit = (attackDir !== defend); // 공격!=방어 => HIT

    const newPartial = {
      round,
      attack: attackDir,
      defend,
      isHit,
    };
    const updated = [...partialResults, newPartial];
    setPartialResults(updated);

    // (A) 마지막 라운드라면 => 최종결과 계산
    if (round === 5) {
      // onTrainResult를 통해 훈련 결과 처리 (Energy/Weight 체크 포함)
      if (onTrainResult) {
        onTrainResult(updated).then((trainResult) => {
          if (trainResult) {
            // 최종결과 표시
            setFinalResult(trainResult);
            setShowFinal(true);
            setRound(6);  // 6 => 더이상 진행 X
          } else {
            // 훈련이 취소됨 (Weight/Energy 부족)
            // 팝업 닫기
            onClose();
          }
        }).catch((error) => {
          console.error("훈련 결과 처리 오류:", error);
          onClose();
        });
      } else {
        // fallback: onTrainResult가 없으면 기존 방식 사용
        const trainResult = doVer1Training(digimonStats, updated);
        setDigimonStatsAndSave(trainResult.updatedStats);
        setFinalResult(trainResult);
        setShowFinal(true);
        setRound(6);
      }
    } else {
      // (B) 다음 라운드로
      setRound(round + 1);
    }
  }

  // 닫기
  function closePopup() {
    onClose();
  }

  // *** 단계별 렌더링 ***

  // (I) "훈련 시작" 준비 화면
  if (phase === "ready") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50" style={{ padding: '20px' }}>
        <div className="bg-white p-4 rounded shadow-xl" style={{ 
          width: '90%', 
          maxWidth: '400px',
          margin: 'auto'
        }}>
          <h2 className="text-lg font-bold mb-2">훈련 시작</h2>
          <button
            onClick={startTrain}
            className="px-3 py-1 bg-blue-500 text-white rounded"
          >
            시작
          </button>
          <button
            onClick={closePopup}
            className="px-3 py-1 bg-gray-500 text-white rounded ml-2"
          >
            취소
          </button>
        </div>
      </div>
    );
  }

  // (II) 진행 화면 (라운드1~5)
  if (phase === "ing") {
    const isTrainingDone = round > 5; // 6이 되면 끝
    const isMobile = window.innerWidth <= 768;
    
    // 능력치 변화 계산
    const statChanges = finalResult && beforeStats ? {
      weight: (finalResult.updatedStats?.weight || 0) - beforeStats.weight,
      energy: (finalResult.updatedStats?.energy || 0) - beforeStats.energy,
      strength: (finalResult.updatedStats?.strength || 0) - beforeStats.strength,
      effort: (finalResult.updatedStats?.effort || 0) - beforeStats.effort,
    } : null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{ padding: '20px' }}>
        <div className="bg-white p-4 rounded shadow-xl" style={{ 
          width: "90%", 
          maxWidth: "700px", 
          height: isMobile ? "85vh" : "600px",
          maxHeight: "90vh",
          margin: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* 상단 닫기 버튼 */}
          <div className="flex justify-end mb-2">
            <button
              onClick={closePopup}
              className="px-3 py-1 bg-gray-400 text-white rounded text-sm"
            >
              닫기
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden" style={{ 
            flexDirection: isMobile ? 'column' : 'row',
            gap: '12px'
          }}>
            {/* 왼쪽: 라운드 정보/공격버튼/타이머 */}
            <div className={`flex flex-col ${isMobile ? 'w-full' : 'w-1/2'} ${!isMobile ? 'pr-2 border-r' : 'border-b pb-2 mb-2'}`}>
              {!isTrainingDone && (
                <>
                  <h2 className="text-lg font-bold">Round {round} / 5</h2>
                  <p className="text-sm mb-4">남은시간: {timeLeft}초</p>

                  <div className={`${isMobile ? 'flex flex-col space-y-2' : 'flex space-x-2'}`}>
                    <button
                      onClick={() => doSelectAttack("U")}
                      disabled={hasChosen}
                      className={`px-4 py-2 bg-green-500 text-white rounded font-bold ${hasChosen ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-600'}`}
                      style={{ fontSize: isMobile ? '16px' : '14px' }}
                    >
                      ↑ (위)
                    </button>
                    <button
                      onClick={() => doSelectAttack("D")}
                      disabled={hasChosen}
                      className={`px-4 py-2 bg-blue-500 text-white rounded font-bold ${hasChosen ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}
                      style={{ fontSize: isMobile ? '16px' : '14px' }}
                    >
                      ↓ (아래)
                    </button>
                  </div>
                </>
              )}

              {isTrainingDone && (
                <div className="text-sm text-gray-600 mt-2">
                  모든 라운드가 종료되었습니다.
                </div>
              )}
            </div>

            {/* 오른쪽: 라운드별 결과 리스트 + 최종결과 */}
            <div className={`flex flex-col ${isMobile ? 'w-full flex-1' : 'w-1/2'} ${!isMobile ? 'pl-2' : ''}`} style={{ minHeight: 0 }}>
              <div className="font-bold text-sm mb-2">라운드별 결과</div>
              <div 
                ref={resultsScrollRef}
                className="border flex-1 overflow-y-auto p-2 text-sm" 
                style={{ maxHeight: isMobile ? '200px' : 'none' }}
              >
                {partialResults.length === 0 ? (
                  <div className="text-gray-400 text-center py-4">라운드 결과가 여기에 표시됩니다</div>
                ) : (
                  partialResults.map((r) => (
                    <div key={r.round} className="mb-2 p-2 bg-gray-50 rounded">
                      <div className="font-semibold">Round {r.round}</div>
                      <div className="text-xs text-gray-600">
                        공격={r.attack === "U" ? "↑ 위" : "↓ 아래"}, 방어={r.defend === "U" ? "↑ 위" : "↓ 아래"}
                      </div>
                      <div className="mt-1">
                        {r.isHit ? (
                          <span className="text-red-600 font-bold">✓ HIT!</span>
                        ) : (
                          <span className="text-gray-500">✗ 막힘</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 마지막 라운드가 끝났으면 showFinal=true -> 최종결과 */}
              {showFinal && finalResult && (() => {
                // 최종 결과 메시지 결정 (훈련 로직에 따라)
                const getResultMessage = () => {
                  if (finalResult.message) {
                    return finalResult.message;
                  }
                  // fallback: hits 수에 따라 메시지 결정
                  const hits = finalResult.hits || 0;
                  if (hits >= 3) {
                    return "< 좋은 훈련이었다! >";
                  } else {
                    return "< X!꽝!X >";
                  }
                };

                const resultMessage = getResultMessage();
                const hits = finalResult.hits || 0;
                const fails = finalResult.fails !== undefined ? finalResult.fails : (5 - hits);
                const isSuccess = finalResult.isSuccess !== undefined ? finalResult.isSuccess : (hits >= 3);
                
                return (
                  <div className="mt-2 p-3 border-2 border-blue-300 bg-blue-50 rounded text-sm">
                    <p className="font-bold text-base mb-2 text-blue-800">
                      최종 훈련 결과: {resultMessage}
                    </p>
                    <div className="mb-2">
                      <span className="font-semibold">성공률: </span>
                      <span className={`font-bold ${isSuccess ? 'text-green-600' : 'text-red-600'}`}>
                        {hits} HIT / {fails} FAIL
                      </span>
                      <span className="text-xs text-gray-600 ml-2">
                        ({isSuccess ? '성공' : '실패'})
                      </span>
                    </div>
                    
                    {/* 능력치 변화 표시 */}
                    {statChanges && (
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <div className="font-bold text-sm mb-2 text-gray-700">능력치 변화:</div>
                        <div className="space-y-1 text-xs">
                          {/* 체중: 항상 -2g */}
                          <div className="flex justify-between">
                            <span>체중:</span>
                            <span className="font-bold text-red-600">
                              {statChanges.weight}g
                            </span>
                          </div>
                          {/* 에너지: 항상 -1 */}
                          <div className="flex justify-between">
                            <span>에너지:</span>
                            <span className="font-bold text-red-600">
                              {statChanges.energy}
                            </span>
                          </div>
                          {/* 힘: 성공 시에만 +1 (hits >= 3) */}
                          {statChanges.strength !== 0 ? (
                            <div className="flex justify-between">
                              <span>힘:</span>
                              <span className="font-bold text-green-600">
                                +{statChanges.strength}
                              </span>
                            </div>
                          ) : (
                            <div className="flex justify-between text-gray-500">
                              <span>힘:</span>
                              <span>변화 없음</span>
                            </div>
                          )}
                          {/* 노력: 4회마다 +1 (trainings % 4 === 0) */}
                          {statChanges.effort !== 0 ? (
                            <div className="flex justify-between">
                              <span>노력:</span>
                              <span className="font-bold text-green-600">
                                +{statChanges.effort}
                              </span>
                            </div>
                          ) : (
                            <div className="flex justify-between text-gray-500">
                              <span>노력:</span>
                              <span>변화 없음</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // (그 외) null
  return null;
}