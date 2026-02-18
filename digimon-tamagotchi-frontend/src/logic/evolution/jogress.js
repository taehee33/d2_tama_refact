// src/logic/evolution/jogress.js
// 조그레스 진화 결과 판정 (순수 함수)

/**
 * Ver.1 / Ver.2 동일 캐릭터 매칭용: ID에서 V2 접미사 제거
 * @param {string} id - 디지몬 ID (예: CresGarurumonV2, BlitzGreymon)
 * @returns {string} 베이스 ID (예: CresGarurumon, BlitzGreymon)
 */
function baseJogressId(id) {
  if (typeof id !== "string") return "";
  return id.replace(/V2$/i, "");
}

/**
 * 두 디지몬이 조그레스 가능한지 확인하고, **현재 슬롯** 기준 결과 디지몬 ID를 반환한다.
 * Ver.1 블리츠그레이몬 + Ver.2 크레스가루루몬처럼 버전이 달라도, 파트너 이름이 같으면 조그레스 가능.
 *
 * @param {string} currentDigimonId - 현재 슬롯 디지몬 ID (진화하는 쪽)
 * @param {string} partnerDigimonId - 파트너 슬롯 디지몬 ID (사망 처리되는 쪽)
 * @param {Object} currentSlotDataMap - 현재 슬롯 버전의 디지몬 데이터 맵 (evolutions·jogress 포함)
 * @returns {{ success: boolean, targetId?: string, reason?: string }}
 */
export function getJogressResult(currentDigimonId, partnerDigimonId, currentSlotDataMap = {}) {
  if (!currentDigimonId || !partnerDigimonId || !currentSlotDataMap || typeof currentSlotDataMap !== "object") {
    return { success: false, reason: "잘못된 입력입니다." };
  }

  const dataA = currentSlotDataMap[currentDigimonId];
  if (!dataA) {
    return { success: false, reason: "조그레스할 수 있는 조합이 아닙니다." };
  }

  const partnerBase = baseJogressId(partnerDigimonId);

  // 현재 슬롯 디지몬의 진화 옵션 중, 파트너가 일치하는 조그레스가 있는지 (정확 일치 또는 V2 제거 후 일치)
  const evolutionsA = dataA.evolutions || [];
  for (const evo of evolutionsA) {
    if (!evo.jogress) continue;
    const p = evo.jogress.partner;
    const match = p === partnerDigimonId || baseJogressId(p) === partnerBase;
    if (match) {
      const targetId = evo.targetId || evo.targetName;
      if (targetId) {
        return { success: true, targetId };
      }
    }
  }

  return { success: false, reason: "조그레스할 수 있는 조합이 아닙니다." };
}
