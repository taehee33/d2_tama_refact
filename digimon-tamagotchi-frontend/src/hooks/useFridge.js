// src/hooks/useFridge.js
// 냉장고(냉동수면) 기능 관리 Hook

import { addActivityLog } from "./useGameLogic";

/**
 * useFridge Hook
 * 냉장고에 넣기/꺼내기 로직을 담당하는 Custom Hook
 * 
 * @param {Object} params - 초기화 파라미터
 * @param {Object} params.digimonStats - 현재 디지몬 스탯
 * @param {Function} params.setDigimonStatsAndSave - 스탯 저장 함수
 * @param {Function} params.applyLazyUpdateBeforeAction - Lazy Update 적용 함수
 * @param {Function} params.setActivityLogs - Activity Logs 설정 함수
 * @param {Array} params.activityLogs - Activity Logs 배열
 * @returns {Object} putInFridge, takeOutFromFridge
 */
export function useFridge({
  digimonStats,
  setDigimonStatsAndSave,
  applyLazyUpdateBeforeAction,
  setActivityLogs,
  activityLogs,
}) {
  /**
   * 냉장고에 넣기
   */
  async function putInFridge() {
    const currentStats = await applyLazyUpdateBeforeAction();
    
    if (currentStats.isDead) {
      alert("사망한 디지몬은 냉장고에 넣을 수 없습니다.");
      return;
    }
    
    if (currentStats.isFrozen) {
      alert("이미 냉장고에 보관되어 있습니다.");
      return;
    }
    
    const updatedStats = {
      ...currentStats,
      isFrozen: true,
      frozenAt: Date.now(),
      // 호출 상태 모두 비활성화
      callStatus: {
        hunger: { isActive: false, startedAt: null, sleepStartAt: null },
        strength: { isActive: false, startedAt: null, sleepStartAt: null },
        sleep: { isActive: false, startedAt: null }
      },
    };
    
    const updatedLogs = addActivityLog(
      activityLogs || [],
      'FRIDGE',
      '냉장고에 보관했습니다. 시간이 멈춥니다.'
    );
    
    await setDigimonStatsAndSave(updatedStats, updatedLogs);
  }
  
  /**
   * 냉장고에서 꺼내기
   */
  async function takeOutFromFridge() {
    const currentStats = await applyLazyUpdateBeforeAction();
    
    if (!currentStats.isFrozen) {
      return;
    }
    
    // 냉장고에 넣은 시간 이후의 경과 시간 계산
    const frozenTime = typeof currentStats.frozenAt === 'number'
      ? currentStats.frozenAt
      : new Date(currentStats.frozenAt).getTime();
    const frozenDuration = Date.now() - frozenTime;
    const frozenDurationSeconds = Math.floor(frozenDuration / 1000);
    
    // 냉장고 상태 해제 (꺼내기 애니메이션을 위해 takeOutAt 기록)
    const updatedStats = {
      ...currentStats,
      isFrozen: false,
      frozenAt: null,
      takeOutAt: Date.now(), // 꺼내기 애니메이션 시작 시간 기록
      // lastSavedAt을 현재 시간으로 업데이트하여 다음 Lazy Update가 정상 작동하도록
      lastSavedAt: new Date(),
    };
    
    // 냉장고 전용 대사
    const messages = [
      "추웠어!",
      "잘 잤다!",
      "냉장고에서 나왔어!",
      "시간이 다시 흐르기 시작했어!",
    ];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    
    // 보관 시간 포맷팅
    let durationText;
    if (frozenDurationSeconds < 60) {
      durationText = `${frozenDurationSeconds}초`;
    } else if (frozenDurationSeconds < 3600) {
      durationText = `${Math.floor(frozenDurationSeconds / 60)}분`;
    } else {
      const hours = Math.floor(frozenDurationSeconds / 3600);
      const minutes = Math.floor((frozenDurationSeconds % 3600) / 60);
      durationText = minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
    }
    
    const updatedLogs = addActivityLog(
      activityLogs || [],
      'FRIDGE',
      `냉장고에서 꺼냈습니다. (${durationText} 동안 보관) - ${randomMessage}`
    );
    
    await setDigimonStatsAndSave(updatedStats, updatedLogs);
  }
  
  return {
    putInFridge,
    takeOutFromFridge,
  };
}
