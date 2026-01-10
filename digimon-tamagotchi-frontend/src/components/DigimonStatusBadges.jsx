// src/components/DigimonStatusBadges.jsx
import React, { useState, useEffect } from "react";
import { willRefuseMeat } from "../logic/food/meat";
import { willRefuseProtein } from "../logic/food/protein";
import DigimonStatusDetailModal from "./DigimonStatusDetailModal";
import { getTimeUntilSleep } from "../utils/sleepUtils";

/**
 * DigimonStatusBadges 컴포넌트
 * 디지몬의 현재 상태를 배지 형태로 여러 개 표시하고, 클릭하면 상세 팝업 표시
 */
const DigimonStatusBadges = ({
  digimonStats = {},
  sleepStatus = "AWAKE",
  isDead = false,
  currentAnimation = "idle",
  feedType = null,
  onOpenStatusDetail = null,
  canEvolve = false, // 진화 가능 여부
  sleepSchedule = null, // 수면 스케줄 { start, end }
  wakeUntil = null, // 깨어있는 시간 (timestamp)
  sleepLightOnStart = null, // 수면 중 불 켜진 시작 시간 (timestamp)
  deathReason = null, // 사망 원인
}) => {
  const {
    fullness = 0,
    strength = 0,
    poopCount = 0,
    injuries = 0,
    proteinOverdose = 0,
    callStatus = {},
    sleepDisturbances = 0,
  } = digimonStats;

  // 실시간 업데이트를 위한 상태
  const [currentTime, setCurrentTime] = useState(Date.now());

  // 1초마다 현재 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 모든 상태 메시지를 수집하는 함수
  const getAllStatusMessages = () => {
    const messages = [];

    // 0. 먹는 중 (최우선순위)
    if (currentAnimation === "eat") {
      if (feedType === "meat") {
        messages.push({ text: "와구와구... 🍖", color: "text-orange-500", bgColor: "bg-orange-100", priority: 0, category: "action" });
      } else if (feedType === "protein") {
        messages.push({ text: "와구와구... 💪", color: "text-blue-500", bgColor: "bg-blue-100", priority: 0, category: "action" });
      } else {
        messages.push({ text: "와구와구... 🍽️", color: "text-orange-500", bgColor: "bg-orange-100", priority: 0, category: "action" });
      }
    }

    // 0.5. 먹이 거부 상태
    if (willRefuseMeat(digimonStats)) {
      messages.push({ text: "고기 거부 🍖🚫", color: "text-red-500", bgColor: "bg-red-100", priority: 0.5, category: "warning" });
    }
    if (willRefuseProtein(digimonStats)) {
      messages.push({ text: "단백질 거부 ⚠️💪", color: "text-red-600", bgColor: "bg-red-100", priority: 0.5, category: "warning" });
    }

    // 1. 사망 상태
    if (isDead) {
      // 사망 원인에 따른 표시
      let deathText = "사망 💀";
      if (deathReason) {
        // 사망 원인을 간단한 형태로 변환
        const reasonMap = {
          'STARVATION (굶주림)': '굶주림',
          'EXHAUSTION (힘 소진)': '힘 소진',
          'INJURY OVERLOAD (부상 과다: 15회)': '부상 과다',
          'INJURY NEGLECT (부상 방치: 6시간)': '부상 방치',
          'OLD AGE (수명 다함)': '수명 종료',
        };
        const reasonTitle = reasonMap[deathReason] || deathReason;
        deathText = `사망 💀 (${reasonTitle})`;
      }
      messages.push({ text: deathText, color: "text-red-600", bgColor: "bg-red-200", priority: 1, category: "critical" });
    }

    // 1.5. 진화 가능 상태 (사망 다음 우선순위, 높은 가시성)
    if (canEvolve && !isDead) {
      messages.push({ text: "진화 가능! ✨", color: "text-purple-600", bgColor: "bg-purple-100", priority: 1.5, category: "good" });
    }

    // 2. 부상 상태 (긴급)
    if (digimonStats.isInjured) {
      // 부상 원인 추론: 똥 8개인지 배틀인지 확인
      let injuryReason = "";
      if (poopCount >= 8) {
        injuryReason = " (똥 8개)";
      } else {
        injuryReason = " (배틀)";
      }
      messages.push({ text: `치료필요! 🏥${injuryReason}`, color: "text-red-600", bgColor: "bg-red-100", priority: 2, category: "critical" });
    } else if (injuries > 0) {
      // 부상 이력이 있지만 현재 부상 상태가 아닌 경우
      messages.push({ text: `다쳤던 횟수 : ${injuries} 회 🏥`, color: "text-yellow-600", bgColor: "bg-yellow-100", priority: 2.5, category: "warning" });
    }

    // 3. 똥 위험
    if (poopCount >= 8) {
      messages.push({ text: "똥 위험 💩", color: "text-red-600", bgColor: "bg-red-100", priority: 3, category: "critical" });
    } else if (poopCount >= 6) {
      messages.push({ text: "똥 많음 💩", color: "text-orange-600", bgColor: "bg-orange-100", priority: 3, category: "warning" });
    }

    // 3.5. 수면 방해 - 깨어있는 시간 표시 (wakeUntil이 있을 때, 초 단위)
    if (wakeUntil && currentTime < wakeUntil) {
      const remainingMs = wakeUntil - currentTime;
      const remainingMinutes = Math.floor(remainingMs / 60000);
      const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
      if (remainingMs > 0) {
        messages.push({ 
          text: `수면 방해! (${remainingMinutes}분 ${remainingSeconds}초 남음) 😴`, 
          color: "text-orange-500", 
          bgColor: "bg-orange-100", 
          priority: 3.5, 
          category: "warning" 
        });
      }
    }

    // 4. 수면/피곤 상태
    if (sleepStatus === "SLEEPING") {
      messages.push({ text: "수면 중 😴", color: "text-blue-500", bgColor: "bg-blue-100", priority: 4, category: "info" });
    } else if (sleepStatus === "TIRED") {
      // TIRED 상태일 때 불 켜진 시간 카운트다운 표시
      if (sleepLightOnStart) {
        const elapsedMs = currentTime - sleepLightOnStart;
        const thresholdMs = 30 * 60 * 1000; // 30분
        const remainingMs = thresholdMs - elapsedMs;
        
        if (remainingMs > 0) {
          const remainingMinutes = Math.floor(remainingMs / 60000);
          const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
          messages.push({ 
            text: `피곤함 😫 (불 끄기까지 ${remainingMinutes}분 ${remainingSeconds}초)`, 
            color: "text-yellow-600", 
            bgColor: "bg-yellow-100", 
            priority: 4, 
            category: "warning" 
          });
        } else {
          messages.push({ 
            text: `피곤함 😫 (케어 미스 발생!)`, 
            color: "text-red-600", 
            bgColor: "bg-red-100", 
            priority: 4, 
            category: "critical" 
          });
        }
      } else {
        messages.push({ text: "피곤함 😫", color: "text-yellow-600", bgColor: "bg-yellow-100", priority: 4, category: "warning" });
      }
    }

    // 4.5. 수면까지 남은 시간 표시 (AWAKE 상태이고 wakeUntil이 없을 때)
    // 우선순위를 낮춰서 다른 중요한 상태 메시지 뒤에 표시
    if (sleepStatus === "AWAKE" && !wakeUntil && sleepSchedule) {
      const timeUntil = getTimeUntilSleep(sleepSchedule, new Date());
      messages.push({ 
        text: `수면까지 ${timeUntil} 😴`, 
        color: "text-blue-500", 
        bgColor: "bg-blue-100", 
        priority: 7, 
        category: "info" 
      });
    }

    // 5. 호출 상태
    if (callStatus.hunger?.isActive) {
      messages.push({ text: "배고픔 호출 🍖", color: "text-red-500", bgColor: "bg-red-100", priority: 5, category: "critical" });
    }
    if (callStatus.strength?.isActive) {
      messages.push({ text: "힘 호출 💪", color: "text-red-500", bgColor: "bg-red-100", priority: 5, category: "critical" });
    }
    if (callStatus.sleep?.isActive) {
      messages.push({ text: "수면 호출 😴", color: "text-yellow-500", bgColor: "bg-yellow-100", priority: 5, category: "warning" });
    }

    // 6. 배고픔/힘 낮음
    if (fullness === 0) {
      messages.push({ text: "배고픔 0 🍖", color: "text-orange-500", bgColor: "bg-orange-100", priority: 6, category: "warning" });
    } else if (fullness <= 1) {
      messages.push({ text: "배고픔 낮음 🍖", color: "text-yellow-500", bgColor: "bg-yellow-100", priority: 6, category: "info" });
    }
    if (strength === 0) {
      messages.push({ text: "힘 0 💪", color: "text-orange-500", bgColor: "bg-orange-100", priority: 6, category: "warning" });
    } else if (strength <= 1) {
      messages.push({ text: "힘 낮음 💪", color: "text-yellow-500", bgColor: "bg-yellow-100", priority: 6, category: "info" });
    }

    // 7. 오버피드/단백질 과다 복용
    if (fullness > 5) {
      messages.push({ text: "고기 오버피드 🍖", color: "text-orange-500", bgColor: "bg-orange-100", priority: 7, category: "warning" });
    }
    // 단백질 과다 복용 (약물중독)
    // proteinOverdose는 0-7 범위, 7일 때 거부됨
    if (proteinOverdose > 0) {
      // 수치에 따른 색상 결정
      let color = "text-yellow-600";
      let bgColor = "bg-yellow-100";
      let category = "info";
      
      if (proteinOverdose >= 6) {
        color = "text-red-600";
        bgColor = "bg-red-100";
        category = "warning";
      } else if (proteinOverdose >= 4) {
        color = "text-orange-600";
        bgColor = "bg-orange-100";
        category = "warning";
      } else if (proteinOverdose >= 2) {
        color = "text-yellow-600";
        bgColor = "bg-yellow-100";
        category = "warning";
      }
      
      messages.push({ 
        text: `약물중독🤢💉 (x${proteinOverdose})`, 
        color: color, 
        bgColor: bgColor, 
        priority: 7, 
        category: category 
      });
    }

    // 8. 정상 상태
    if (fullness >= 5 && strength >= 5) {
      messages.push({ text: "완벽함 😊", color: "text-green-500", bgColor: "bg-green-100", priority: 8, category: "good" });
    } else if (fullness >= 5) {
      messages.push({ text: "배부름 😊", color: "text-green-500", bgColor: "bg-green-100", priority: 8, category: "good" });
    } else if (strength >= 5) {
      messages.push({ text: "에너지 충만 ⚡", color: "text-green-500", bgColor: "bg-green-100", priority: 8, category: "good" });
    }

    // 우선순위 순으로 정렬
    messages.sort((a, b) => a.priority - b.priority);
    return messages;
  };

  const allMessages = getAllStatusMessages();
  // 상위 2-3개만 표시 (우선순위가 낮은 것은 제외)
  const displayMessages = allMessages.filter((msg, idx) => {
    // 최대 3개까지, 단 priority가 8 이상인 것은 1개만 표시
    if (idx >= 3) return false;
    if (idx >= 2 && msg.priority >= 8) return false;
    return true;
  });

  const handleClick = () => {
    if (onOpenStatusDetail) {
      onOpenStatusDetail(allMessages);
    }
  };

  if (displayMessages.length === 0) {
    return null;
  }

  return (
    <>
      <div 
        className="flex items-center justify-center mt-2 gap-2 flex-wrap cursor-pointer"
        onClick={handleClick}
        title="클릭하여 모든 상태 보기"
      >
        {displayMessages.map((msg, idx) => (
          <span
            key={idx}
            className={`text-xs font-semibold ${msg.color} px-2 py-1 rounded-lg ${msg.bgColor} border border-gray-300 shadow-sm hover:shadow-md transition-shadow`}
          >
            {msg.text}
          </span>
        ))}
        {allMessages.length > displayMessages.length && (
          <span className="text-xs font-semibold text-gray-500 px-2 py-1 rounded-lg bg-gray-100 border border-gray-300">
            +{allMessages.length - displayMessages.length}개 더
          </span>
        )}
      </div>
    </>
  );
};

export default DigimonStatusBadges;

