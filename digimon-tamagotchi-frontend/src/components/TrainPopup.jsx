// src/components/TrainPopup.jsx
import React, { useEffect, useState } from "react";
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
  setDigimonStatsAndSave // Game.jsx에서 props로 받음
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

  // 이번 훈련에 사용할 방어 패턴 (길이=5)
  const [chosenPattern, setChosenPattern] = useState(null);

  // === (1) 훈련 시작 ===
  function startTrain() {
    // 1~6번 패턴 순환
    // -> trainings를 사용 (기존 stats에 누적)
    // -> 0이면 1번 패턴, 1이면 2번 패턴... 5면 6번 패턴, 6이면 다시 1번
    const tCount = digimonStats.trainings || 0;
    const patternIndex = tCount % 6; // 0~5
    const pattern = defensePatterns[patternIndex];

    // 선택한 패턴 설정
    setChosenPattern(pattern);

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
      // doVer1Training 호출
      const trainResult = doVer1Training(digimonStats, updated);
      // stats 업데이트
      setDigimonStatsAndSave(trainResult.updatedStats);

      // 최종결과 표시
      setFinalResult(trainResult);
      setShowFinal(true);
      setRound(6);  // 6 => 더이상 진행 X
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
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50" modal-overlay-mobile>
        <div className="bg-white p-4 rounded shadow-xl w-64">
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
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" modal-overlay-mobile>
        <div className="bg-white p-4 rounded shadow-xl" style={{ width: "700px", height: "400px" }}>
          <div className="flex w-full h-full">

            {/* 왼쪽: 라운드 정보/공격버튼/타이머 */}
            <div className="flex flex-col w-1/2 pr-2 border-r">
              {!isTrainingDone && (
                <>
                  <h2 className="text-lg font-bold">Round {round} / 5</h2>
                  <p className="text-sm">남은시간: {timeLeft}초</p>

                  <div className="mt-4 space-x-2">
                    <button
                      onClick={() => doSelectAttack("U")}
                      disabled={hasChosen}
                      className="px-3 py-1 bg-green-500 text-white rounded"
                    >
                      ↑ (위)
                    </button>
                    <button
                      onClick={() => doSelectAttack("D")}
                      disabled={hasChosen}
                      className="px-3 py-1 bg-blue-500 text-white rounded"
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

              {/* 하단에 닫기 */}
              <button
                onClick={closePopup}
                className="mt-auto px-3 py-1 bg-gray-400 text-white rounded self-start"
              >
                닫기
              </button>
            </div>

            {/* 오른쪽: 라운드별 결과 리스트 + 최종결과 */}
            <div className="flex flex-col w-1/2 pl-2">
              <div className="font-bold text-sm mb-1">라운드별 결과</div>
              <div className="border flex-1 overflow-y-auto p-2 text-sm">
                {partialResults.map((r) => (
                  <div key={r.round} className="mb-1">
                    Round {r.round}: 공격={r.attack}, 방어={r.defend} →{" "}
                    {r.isHit ? (
                      <span className="text-red-500 font-bold">HIT!</span>
                    ) : (
                      "막힘"
                    )}
                  </div>
                ))}
              </div>

              {/* 마지막 라운드가 끝났으면 showFinal=true -> 최종결과 */}
              {showFinal && finalResult && (
                <div className="mt-2 p-2 border bg-gray-50 text-sm">
                  <p className="font-bold mb-1">
                    최종 훈련 결과: {finalResult.message}
                  </p>
                  <p>
                    {finalResult.hits} HIT / {finalResult.fails} FAIL
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // (그 외) null
  return null;
}