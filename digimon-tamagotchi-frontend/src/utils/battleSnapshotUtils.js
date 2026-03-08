// src/utils/battleSnapshotUtils.js
// 아레나/실시간 배틀용 디지몬 스냅샷 생성 (공통)

import { calculatePower } from '../logic/battle/hitrate';

/**
 * 슬롯 데이터로부터 배틀용 디지몬 스냅샷 생성
 * @param {Object} slot - { id, selectedDigimon, digimonStats, slotName, version, digimonNickname }
 * @param {Object} digimonDataVer1 - v1 디지몬 맵
 * @param {Object} digimonDataVer2 - v2 디지몬 맵
 * @returns {Object} 스냅샷 (digimonId, digimonName, stats.power, type, sprite, slotId, slotName 등)
 */
export function createDigimonSnapshotForBattle(slot, digimonDataVer1, digimonDataVer2 = {}) {
  const ver = slot.version === 'Ver.2' ? 'Ver.2' : 'Ver.1';
  const digimonData = ver === 'Ver.2'
    ? (digimonDataVer2[slot.selectedDigimon] || digimonDataVer1[slot.selectedDigimon] || {})
    : (digimonDataVer1[slot.selectedDigimon] || digimonDataVer2[slot.selectedDigimon] || {});
  const stats = slot.digimonStats || {};
  const base = calculatePower(stats, digimonData) ?? digimonData?.stats?.basePower ?? 0;
  const calculatedPower = (stats.power != null && stats.power > 0) ? stats.power : base;

  const out = {
    digimonId: slot.selectedDigimon,
    digimonName: slot.selectedDigimon,
    digimonNickname: slot.digimonNickname || null,
    sprite: digimonData?.sprite ?? 0,
    spriteBasePath: digimonData?.spriteBasePath ?? null,
    slotVersion: slot.version || 'Ver.1',
    attackSprite: digimonData?.stats?.attackSprite ?? digimonData?.sprite ?? 0,
    stage: digimonData?.stage ?? 'Unknown',
    stats: {
      ...stats,
      power: calculatedPower,
      type: digimonData?.stats?.type ?? stats.type ?? null,
    },
    image: digimonData?.sprite ?? 0,
    slotId: slot.id,
    slotName: slot.slotName,
  };
  if (slot.battleDeck && Array.isArray(slot.battleDeck)) {
    out.battleDeck = [...slot.battleDeck];
  }
  return out;
}
