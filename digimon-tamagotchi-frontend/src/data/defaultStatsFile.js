// src/data/defaultStatsFile.js
export const defaultStats = {
    sprite: 133,
    evolutionStage: "Digitama",
    age: 0,
    birthTime: null, // 디지몬 생성 시간 (나이 계산용)
    weight: 0,
    strength: 0,
    stamina: 0, // 기존 필드 (호환성 유지)
    energy: 0, // 매뉴얼의 DP 개념 (Energy/DP)
    effort: 0,
    fullness: 0,
    winRate: 0,
    careMistakes: 0,
  
    lifespanSeconds: 0,
    timeToEvolveSeconds: 0,
  
    hungerTimer: 0,
    hungerCountdown: 0,
    strengthTimer: 0,
    strengthCountdown: 0,
    poopTimer: 0,
  
    maxOverfeed: 0,
    overfeeds: 0, // 오버피드 횟수 누적
    consecutiveMeatFed: 0, // 연속으로 먹은 고기 개수 (오버피드 체크용)
    isDead: false,
    lastHungerZeroAt: null,
  
    maxStamina: 0,
    minWeight: 0,
    healing: 0,
    attribute: 0,
    power: 0,
    attackSprite: 0,
    altAttackSprite: 65535,
    
    // 매뉴얼 기반 추가 필드
    // proteinCount 제거됨 - strength로 통합
    proteinOverdose: 0, // 프로틴 과다 복용 횟수 (최대 7, 4개당 +1)
    
    // 배틀 관련: 총 토탈 (진화 시 유지)
    totalBattles: 0, // 전체 생애 동안의 총 배틀 횟수
    totalBattlesWon: 0, // 전체 생애 동안의 총 승리 횟수
    totalBattlesLost: 0, // 전체 생애 동안의 총 패배 횟수
    totalWinRate: 0, // 전체 생애 동안의 총 승률 (%)
    
    // 배틀 관련: 현재 디지몬 (진화 시 리셋)
    battles: 0, // 현재 디지몬일 때의 배틀 횟수 (진화 조건용)
    battlesWon: 0, // 현재 디지몬일 때의 승리 횟수 (진화 조건용)
    battlesLost: 0, // 현재 디지몬일 때의 패배 횟수 (진화 조건용)
    winRate: 0, // 현재 디지몬일 때의 승률 (%) (진화 조건용)
    isInjured: false, // 부상 상태 (똥 8개, 배틀 부상 시 true)
    injuredAt: null, // 부상 당한 시각 (6시간 사망 체크용)
    injuries: 0, // 이 단계에서 누적된 부상 횟수 (15회 사망 체크용)
    healedDosesCurrent: 0, // 현재 투여된 치료제 횟수
    // 호출(Call) 시스템
    callStatus: {
      hunger: { isActive: false, startedAt: null }, // 제한시간 10분
      strength: { isActive: false, startedAt: null }, // 제한시간 10분
      sleep: { isActive: false, startedAt: null }     // 제한시간 60분
    },
  };