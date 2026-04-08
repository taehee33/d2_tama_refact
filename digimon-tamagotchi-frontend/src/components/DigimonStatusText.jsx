// src/components/DigimonStatusText.jsx
import React from "react";
import { willRefuseMeat } from "../logic/food/meat";
import { willRefuseProtein } from "../logic/food/protein";
import { normalizeSleepStatusForDisplay } from "../utils/callStatusUtils";

/**
 * DigimonStatusText 컴포넌트
 * 디지몬의 현재 상태를 텍스트 + 이모티콘으로 표시
 */
const DigimonStatusText = ({
  digimonStats = {},
  sleepStatus = "AWAKE",
  isDead = false,
  currentAnimation = "idle",
  feedType = null,
}) => {
  const {
    fullness = 0,
    strength = 0,
    poopCount = 0,
    injuries = 0,
    proteinOverdose = 0,
    overfeeds = 0,
    callStatus = {},
  } = digimonStats;
  const visibleSleepStatus = normalizeSleepStatusForDisplay(sleepStatus);

  // 상태 우선순위에 따라 메시지 결정
  const getStatusMessage = () => {
    // 0. 먹는 중 (최우선순위)
    if (currentAnimation === "eat") {
      if (feedType === "meat") {
        return { text: "와구와구... 🍖", color: "text-orange-500", priority: 0 };
      }
      if (feedType === "protein") {
        return { text: "와구와구... 💪", color: "text-blue-500", priority: 0 };
      }
      return { text: "와구와구... 🍽️", color: "text-orange-500", priority: 0 };
    }

    // 0.5. 과식 상태 (오버피드 발생)
    if (willRefuseMeat(digimonStats) && overfeeds > 0) {
      return { text: "과식!!! 🍖💥", color: "text-red-600", priority: 0.5 };
    }

    // 0.6. 먹이 거부 상태 (오버피드/과다 복용으로 더 이상 못 먹음)
    if (willRefuseMeat(digimonStats)) {
      return { text: "고기를 더이상 못 먹어요! 🍖🚫", color: "text-red-500", priority: 0.6 };
    }
    if (willRefuseProtein(digimonStats)) {
      return { text: "단백질 과다 복용으로 더이상 못 먹어요! ⚠️💪", color: "text-red-600", priority: 0.6 };
    }

    // 1. 사망 상태
    if (isDead) {
      return { text: "사망했습니다... 💀", color: "text-red-600", priority: 1 };
    }

    // 2. 부상 상태 (injuries > 0)
    if (injuries > 0) {
      if (injuries >= 15) {
        return { text: "부상이 심각해요! 🏥", color: "text-red-600", priority: 2 };
      }
      if (injuries >= 10) {
        return { text: "부상이 많아요! 🏥", color: "text-orange-600", priority: 2 };
      }
      return { text: "부상이 있어요 🏥", color: "text-yellow-600", priority: 2 };
    }

    // 3. 똥 위험 (poopCount >= 8)
    if (poopCount >= 8) {
      return { text: "똥이 너무 많아요! 💩", color: "text-red-600", priority: 3 };
    }
    if (poopCount >= 6) {
      return { text: "똥이 많아요 💩", color: "text-orange-600", priority: 3 };
    }

    // 4. 수면 상태
    if (visibleSleepStatus === "AWAKE_INTERRUPTED") {
      return { text: "강제 기상 중... ⏰", color: "text-orange-500", priority: 4 };
    }
    if (visibleSleepStatus === "FALLING_ASLEEP") {
      return { text: "잠들기 준비 중... 🌙", color: "text-slate-500", priority: 4 };
    }
    if (visibleSleepStatus === "NAPPING") {
      return { text: "낮잠 중... 😴", color: "text-blue-500", priority: 4 };
    }
    if (visibleSleepStatus === "SLEEPING_LIGHT_ON") {
      return { text: "수면 중(불 켜짐 경고!) 😴", color: "text-yellow-600", priority: 4 };
    }
    if (visibleSleepStatus === "SLEEPING") {
      return { text: "수면 중... 😴", color: "text-blue-500", priority: 4 };
    }

    // 5. 배고픔/힘 0 (호출 상태)
    if (callStatus.hunger?.isActive) {
      return { text: "배고파요! 🍖", color: "text-red-500", priority: 5 };
    }
    if (callStatus.strength?.isActive) {
      return { text: "힘이 없어요! 💪", color: "text-red-500", priority: 5 };
    }
    if (callStatus.sleep?.isActive) {
      return { text: "수면 조명 경고! 💡", color: "text-yellow-500", priority: 5 };
    }

    // 6. 배고픔/힘 낮음 (0은 아니지만 낮음)
    if (fullness === 0) {
      return { text: "배고파요 🍖", color: "text-orange-500", priority: 6 };
    }
    if (strength === 0) {
      return { text: "힘이 없어요 💪", color: "text-orange-500", priority: 6 };
    }
    if (fullness <= 1) {
      return { text: "배고픔이 있어요 🍖", color: "text-yellow-500", priority: 6 };
    }
    if (strength <= 1) {
      return { text: "힘이 부족해요 💪", color: "text-yellow-500", priority: 6 };
    }

    // 7. 오버피드/단백질 과다 복용
    if (fullness > 5) {
      return { text: "고기를 너무 많이 먹었어요! 🍖", color: "text-orange-500", priority: 7 };
    }
    // 단백질 과다 복용 경고 (거부 전 단계)
    if (proteinOverdose >= 6) {
      return { text: "단백질 과다 복용 위험! (거의 한계) ⚠️💪", color: "text-red-600", priority: 7 };
    }
    if (proteinOverdose >= 4) {
      return { text: "단백질 과다 복용 주의! ⚠️💪", color: "text-orange-600", priority: 7 };
    }
    if (proteinOverdose >= 2) {
      return { text: "단백질 과다 복용 경고 ⚠️💪", color: "text-yellow-600", priority: 7 };
    }
    if (proteinOverdose >= 1) {
      return { text: "단백질 과다 복용 시작 💪", color: "text-yellow-500", priority: 7 };
    }

    // 8. 정상 상태 (배부름, 힘 충만)
    if (fullness >= 5 && strength >= 5) {
      return { text: "완벽한 상태예요! 😊", color: "text-green-500", priority: 8 };
    }
    if (fullness >= 5) {
      return { text: "배부르네요! 😊", color: "text-green-500", priority: 8 };
    }
    if (strength >= 5) {
      return { text: "에너지 충만! ⚡", color: "text-green-500", priority: 8 };
    }

    // 9. 기본 상태
    return { text: "평범한 하루예요 😊", color: "text-gray-600", priority: 9 };
  };

  const status = getStatusMessage();

  return (
    <div className="flex items-center justify-center mt-2">
      <span className={`text-sm font-semibold ${status.color} px-3 py-1 rounded-lg bg-white bg-opacity-80 border border-gray-300 shadow-sm`}>
        {status.text}
      </span>
    </div>
  );
};

export default DigimonStatusText;
